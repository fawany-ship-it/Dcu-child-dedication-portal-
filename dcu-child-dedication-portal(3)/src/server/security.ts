import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { UserProfile, UserRole, StaffInvitation, AuditLog } from '../types.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.resolve(__dirname, '../../data');

const USERS_FILE = path.join(DATA_DIR, 'users.json');
const INVITATIONS_FILE = path.join(DATA_DIR, 'invitations.json');
const SESSIONS_FILE = path.join(DATA_DIR, 'sessions.json');
const AUDIT_LOGS_FILE = path.join(DATA_DIR, 'audit_logs.json');

// Ensure directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Server Secret for HMAC and tokens
export const SERVER_SECRET = process.env.SESSION_SECRET || 'dcu-uta-portal-secure-salt-key-9284918237492138';
export const BOOTSTRAP_TOKEN = process.env.BOOTSTRAP_ADMIN_TOKEN || 'DCU-ADMIN-BOOTSTRAP-2026-SECURE';

export interface StoredUserCredential {
  passwordHash?: string;
  salt?: string;
  mfaSecret?: string;
  mfaBackupCodes?: string[];
}

export interface StoredUser extends UserProfile {
  passwordHash?: string;
  salt?: string;
  mfaSecret?: string;
  mfaBackupCodes?: string[];
  failedLoginAttempts?: number;
  lockoutUntil?: number;
}

export interface SessionRecord {
  token: string;
  tokenHash: string;
  userId: string;
  userEmail: string;
  role: UserRole;
  createdAt: number;
  expiresAt: number;
  ip?: string;
  userAgent?: string;
  requiresMfa?: boolean;
  mfaVerified?: boolean;
}

// ==========================================
// 1. CRYPTOGRAPHIC HELPERS
// ==========================================

export function generateSecureToken(bytes = 32): string {
  return crypto.randomBytes(bytes).toString('hex');
}

export function hashToken(token: string): string {
  return crypto.createHmac('sha256', SERVER_SECRET).update(token).digest('hex');
}

export function hashPassword(password: string): { hash: string; salt: string } {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return { hash, salt };
}

export function verifyPassword(password: string, storedHash?: string, salt?: string): boolean {
  if (!storedHash || !salt) return false;
  try {
    const hash = crypto.scryptSync(password, salt, 64).toString('hex');
    return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(storedHash, 'hex'));
  } catch {
    return false;
  }
}

// Safe user profile stripper (never leaks passwordHash, salt, or mfaSecret to client)
export function sanitizeUser(user: StoredUser): UserProfile {
  const { passwordHash, salt, mfaSecret, mfaBackupCodes, failedLoginAttempts, lockoutUntil, ...safeUser } = user;
  // Normalize 'admin' role to 'super_admin'
  if ((safeUser.role as string) === 'admin') {
    safeUser.role = 'super_admin';
  }
  return safeUser;
}

// ==========================================
// 2. RATE LIMITING & ABUSE PROTECTION
// ==========================================

interface RateLimitEntry {
  count: number;
  firstAttempt: number;
  blockedUntil?: number;
}

const rateLimitStore = new Map<string, RateLimitEntry>();

export function checkRateLimit(key: string, maxAttempts = 5, windowMs = 15 * 60 * 1000): { allowed: boolean; remainingWaitMs: number } {
  const now = Date.now();
  const entry = rateLimitStore.get(key);

  if (!entry) {
    rateLimitStore.set(key, { count: 1, firstAttempt: now });
    return { allowed: true, remainingWaitMs: 0 };
  }

  // Check if blocked
  if (entry.blockedUntil && entry.blockedUntil > now) {
    return { allowed: false, remainingWaitMs: entry.blockedUntil - now };
  }

  // Reset window if expired
  if (now - entry.firstAttempt > windowMs) {
    rateLimitStore.set(key, { count: 1, firstAttempt: now });
    return { allowed: true, remainingWaitMs: 0 };
  }

  entry.count += 1;
  if (entry.count > maxAttempts) {
    entry.blockedUntil = now + windowMs;
    return { allowed: false, remainingWaitMs: windowMs };
  }

  return { allowed: true, remainingWaitMs: 0 };
}

export function resetRateLimit(key: string) {
  rateLimitStore.delete(key);
}

// ==========================================
// 3. AUDIT LOGGING
// ==========================================

export function loadAuditLogs(): AuditLog[] {
  try {
    if (fs.existsSync(AUDIT_LOGS_FILE)) {
      const data = fs.readFileSync(AUDIT_LOGS_FILE, 'utf-8');
      const parsed = JSON.parse(data);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (err) {
    console.error('Failed to load audit logs:', err);
  }
  return [];
}

export function writeAuditLog(event: {
  eventType: string;
  actorId?: string;
  actorEmail?: string;
  actorRole?: string;
  targetId?: string;
  targetType?: string;
  outcome: 'SUCCESS' | 'FAILURE';
  ip?: string;
  userAgent?: string;
  details?: Record<string, any>;
}): AuditLog {
  const logs = loadAuditLogs();
  const newLog: AuditLog = {
    id: `audit-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`,
    timestamp: new Date().toISOString(),
    eventType: event.eventType,
    actorId: event.actorId || 'system',
    actorEmail: event.actorEmail || 'anonymous',
    actorRole: event.actorRole || 'public',
    targetId: event.targetId,
    targetType: event.targetType,
    outcome: event.outcome,
    ip: event.ip,
    userAgent: event.userAgent,
    details: event.details
  };

  // Prepend new log and keep last 2000 entries
  logs.unshift(newLog);
  if (logs.length > 2000) {
    logs.length = 2000;
  }

  try {
    fs.writeFileSync(AUDIT_LOGS_FILE, JSON.stringify(logs, null, 2));
  } catch (err) {
    console.error('Failed to write audit log:', err);
  }

  return newLog;
}

// ==========================================
// 4. SESSIONS STORE
// ==========================================

export function loadSessions(): SessionRecord[] {
  try {
    if (fs.existsSync(SESSIONS_FILE)) {
      const data = fs.readFileSync(SESSIONS_FILE, 'utf-8');
      const parsed = JSON.parse(data);
      if (Array.isArray(parsed)) {
        const now = Date.now();
        // filter out expired
        return parsed.filter(s => s.expiresAt > now);
      }
    }
  } catch (err) {
    console.error('Failed to load sessions:', err);
  }
  return [];
}

export function saveSessions(sessions: SessionRecord[]) {
  try {
    fs.writeFileSync(SESSIONS_FILE, JSON.stringify(sessions, null, 2));
  } catch (err) {
    console.error('Failed to save sessions:', err);
  }
}

export function createSession(user: StoredUser, ip?: string, userAgent?: string, requiresMfa = false): { session: SessionRecord; rawToken: string } {
  const rawToken = generateSecureToken(32);
  const tokenHash = hashToken(rawToken);
  const now = Date.now();
  const expiresAt = now + (24 * 60 * 60 * 1000); // 24 hours

  const session: SessionRecord = {
    token: rawToken, // used in memory, but we hash for storage check
    tokenHash,
    userId: user.id,
    userEmail: user.email,
    role: (user.role as string) === 'admin' ? 'super_admin' : user.role,
    createdAt: now,
    expiresAt,
    ip,
    userAgent,
    requiresMfa,
    mfaVerified: !requiresMfa
  };

  const sessions = loadSessions();
  sessions.push(session);
  saveSessions(sessions);

  return { session, rawToken };
}

export function verifySessionToken(rawToken: string): SessionRecord | null {
  if (!rawToken) return null;
  const tokenHash = hashToken(rawToken);
  const sessions = loadSessions();
  const session = sessions.find(s => s.tokenHash === tokenHash);

  if (!session) return null;
  if (session.expiresAt < Date.now()) {
    revokeSession(rawToken);
    return null;
  }

  return session;
}

export function revokeSession(rawToken: string) {
  const tokenHash = hashToken(rawToken);
  let sessions = loadSessions();
  sessions = sessions.filter(s => s.tokenHash !== tokenHash);
  saveSessions(sessions);
}

export function revokeAllUserSessions(userId: string) {
  let sessions = loadSessions();
  sessions = sessions.filter(s => s.userId !== userId);
  saveSessions(sessions);
}

// ==========================================
// 5. STAFF INVITATIONS
// ==========================================

export function loadInvitations(): StaffInvitation[] {
  try {
    if (fs.existsSync(INVITATIONS_FILE)) {
      const data = fs.readFileSync(INVITATIONS_FILE, 'utf-8');
      const parsed = JSON.parse(data);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (err) {
    console.error('Failed to load invitations:', err);
  }
  return [];
}

export function saveInvitations(invites: StaffInvitation[]) {
  try {
    fs.writeFileSync(INVITATIONS_FILE, JSON.stringify(invites, null, 2));
  } catch (err) {
    console.error('Failed to save invitations:', err);
  }
}

export function createInvitation(params: {
  email: string;
  name?: string;
  role: 'super_admin' | 'office_admin' | 'pastor' | 'fellowship_leader';
  assignedZone?: 'Zone A' | 'Zone B' | 'Zone C' | 'Zone D' | 'Zone E';
  invitedBy: string;
  invitedByEmail: string;
}): { invitation: StaffInvitation; rawToken: string } {
  const rawToken = generateSecureToken(24);
  const tokenHash = hashToken(rawToken);
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(); // 7 days

  const invites = loadInvitations();

  // Invalidate any prior pending invitations for this email
  invites.forEach(inv => {
    if (inv.email.toLowerCase() === params.email.toLowerCase() && inv.status === 'pending') {
      inv.status = 'revoked';
      inv.revokedAt = new Date().toISOString();
      inv.revokedAt = `Superceded by new invitation`;
    }
  });

  const invitation: StaffInvitation = {
    id: `inv-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`,
    email: params.email.toLowerCase(),
    name: params.name,
    role: params.role,
    assignedZone: params.assignedZone,
    tokenHash,
    invitedBy: params.invitedBy,
    invitedByEmail: params.invitedByEmail,
    createdAt: new Date().toISOString(),
    expiresAt,
    status: 'pending'
  };

  invites.unshift(invitation);
  saveInvitations(invites);

  return { invitation: { ...invitation, token: rawToken }, rawToken };
}

export function verifyInvitation(rawToken: string, userEmail: string): { valid: boolean; reason?: string; invitation?: StaffInvitation } {
  if (!rawToken) return { valid: false, reason: 'Invitation token is missing' };
  const tokenHash = hashToken(rawToken);
  const invites = loadInvitations();
  const invitation = invites.find(inv => inv.tokenHash === tokenHash);

  if (!invitation) {
    return { valid: false, reason: 'Invalid invitation token' };
  }

  if (invitation.status === 'revoked') {
    return { valid: false, reason: 'This invitation has been revoked by administration' };
  }

  if (invitation.status === 'accepted' || invitation.usedAt) {
    return { valid: false, reason: 'This invitation has already been used' };
  }

  if (new Date(invitation.expiresAt).getTime() < Date.now()) {
    invitation.status = 'expired';
    saveInvitations(invites);
    return { valid: false, reason: 'This invitation has expired' };
  }

  if (invitation.email.toLowerCase() !== userEmail.toLowerCase()) {
    return { 
      valid: false, 
      reason: `Invitation is restricted to email: ${invitation.email}. Authenticated email (${userEmail}) does not match.` 
    };
  }

  return { valid: true, invitation };
}

export function markInvitationUsed(tokenHash: string): boolean {
  const invites = loadInvitations();
  const invitation = invites.find(inv => inv.tokenHash === tokenHash);
  if (!invitation) return false;

  invitation.status = 'accepted';
  invitation.usedAt = new Date().toISOString();
  saveInvitations(invites);
  return true;
}

export function revokeInvitation(invitationId: string, actorId: string): boolean {
  const invites = loadInvitations();
  const invitation = invites.find(inv => inv.id === invitationId);
  if (!invitation) return false;

  invitation.status = 'revoked';
  invitation.revokedAt = new Date().toISOString();
  invitation.revokedBy = actorId;
  saveInvitations(invites);
  return true;
}

// ==========================================
// 6. MULTI-FACTOR AUTHENTICATION (MFA)
// ==========================================

export function generateMfaCode(): string {
  // Generate 6 digit numeric code
  return Math.floor(100000 + crypto.randomInt(900000)).toString();
}

export function generateMfaBackupCodes(count = 5): string[] {
  const codes: string[] = [];
  for (let i = 0; i < count; i++) {
    codes.push(crypto.randomBytes(4).toString('hex').toUpperCase());
  }
  return codes;
}
