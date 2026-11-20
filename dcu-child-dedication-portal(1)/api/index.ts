import express, { Request, Response } from 'express';
import crypto from 'crypto';
import { INITIAL_DEDICATIONS, INITIAL_USERS } from '../src/data/initialDedications';
import { INITIAL_PAST_DEDICATIONS } from '../src/data/pastDedications';
import { DedicationRecord, UserProfile, UserRole, PastDedicationRecord, StaffInvitation } from '../src/types';

const app = express();
app.use(express.json({ limit: '10mb' }));

const SERVER_SECRET = process.env.SESSION_SECRET || 'dcu-uta-portal-secure-salt-key-9284918237492138';

// In-memory stores for Serverless execution (supplemented by HMAC-signed cross-device tokens)
let memoryUsers: (UserProfile & { password?: string })[] = INITIAL_USERS.map((u) => ({
  ...u,
  role: (u.role as string) === 'admin' ? 'super_admin' : u.role,
  password: u.role === 'admin' || (u.role as string) === 'super_admin' ? 'DcuAdmin2026!#' : 'DcuLeader2026!#',
  isSuspended: false
}));
let memoryDedications: DedicationRecord[] = [...INITIAL_DEDICATIONS];
let memoryPastDedications: PastDedicationRecord[] = [...INITIAL_PAST_DEDICATIONS];
let memoryInvitations: StaffInvitation[] = [];

// Ensure Super Admin exists
if (!memoryUsers.some(u => u.email.toLowerCase() === 'fawany@gmail.com')) {
  memoryUsers.unshift({
    id: 'usr-admin-1',
    email: 'fawany@gmail.com',
    name: 'Fawany (Administrator)',
    role: 'super_admin',
    isApproved: true,
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
    authProvider: 'google',
    phone: '0723 102273',
    password: 'DcuAdmin2026!#',
    createdAt: '2026-01-01T00:00:00.000Z',
    isSuspended: false
  });
}

// ==========================================
// CRYPTOGRAPHIC STATELESS SIGNED TOKENS
// Works across Vercel serverless instances & multiple devices
// ==========================================

function signPayload(prefix: string, data: Record<string, any>): string {
  const b64 = Buffer.from(JSON.stringify(data), 'utf-8').toString('base64url');
  const sig = crypto.createHmac('sha256', SERVER_SECRET).update(`${prefix}.${b64}`).digest('base64url');
  return `${prefix}.${b64}.${sig}`;
}

function verifySignedPayload<T = any>(prefix: string, token: string): T | null {
  try {
    const clean = (token || '').trim();
    const parts = clean.split('.');
    if (parts.length !== 3 || parts[0] !== prefix) return null;
    const [, b64, sig] = parts;
    const expected = crypto.createHmac('sha256', SERVER_SECRET).update(`${prefix}.${b64}`).digest('base64url');
    const a = Buffer.from(sig);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
    return JSON.parse(Buffer.from(b64, 'base64url').toString('utf-8')) as T;
  } catch {
    return null;
  }
}

interface SignedSession {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  assignedZone?: 'Zone A' | 'Zone B' | 'Zone C' | 'Zone D' | 'Zone E';
  assignedFellowship?: string;
  avatar?: string;
  authProvider: 'google' | 'email';
  exp: number;
}

interface SignedInvite {
  id: string;
  email: string;
  name?: string;
  role: 'super_admin' | 'office_admin' | 'pastor' | 'fellowship_leader';
  assignedZone?: 'Zone A' | 'Zone B' | 'Zone C' | 'Zone D' | 'Zone E';
  assignedFellowship?: string;
  expiresAt: string;
  createdAt: string;
}

interface SignedCredentialPassport {
  id: string;
  email: string;
  name: string;
  phone?: string;
  role: UserRole;
  assignedZone?: 'Zone A' | 'Zone B' | 'Zone C' | 'Zone D' | 'Zone E';
  assignedFellowship?: string;
  avatar?: string;
  authProvider: 'google' | 'email';
  passwordHash?: string;
  salt?: string;
  issuedAt: string;
}

function hashPasswordScrypt(password: string, existingSalt?: string): { hash: string; salt: string } {
  const salt = existingSalt || crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return { hash, salt };
}

function verifyPasswordScrypt(password: string, hash: string, salt: string): boolean {
  try {
    const derived = crypto.scryptSync(password, salt, 64);
    const stored = Buffer.from(hash, 'hex');
    return derived.length === stored.length && crypto.timingSafeEqual(derived, stored);
  } catch {
    return false;
  }
}

function issueCredentialPassport(user: UserProfile, passwordHash?: string, salt?: string): string {
  const payload: SignedCredentialPassport = {
    id: user.id,
    email: user.email.toLowerCase().trim(),
    name: user.name,
    phone: user.phone,
    role: (user.role as string) === 'admin' ? 'super_admin' : user.role,
    assignedZone: user.assignedZone,
    assignedFellowship: user.assignedFellowship,
    avatar: user.avatar,
    authProvider: user.authProvider || 'email',
    passwordHash,
    salt,
    issuedAt: new Date().toISOString()
  };
  return signPayload('DCUCRED1', payload);
}

function verifyCredentialPassport(passport: unknown, email: string): SignedCredentialPassport | null {
  if (typeof passport !== 'string' || !passport.trim()) return null;
  const decoded = verifySignedPayload<SignedCredentialPassport>('DCUCRED1', passport);
  if (!decoded || decoded.email.toLowerCase() !== email.toLowerCase().trim()) return null;
  return decoded;
}

function issueSessionToken(user: UserProfile): string {
  const payload: SignedSession = {
    id: user.id,
    email: user.email,
    name: user.name,
    role: (user.role as string) === 'admin' ? 'super_admin' : user.role,
    assignedZone: user.assignedZone,
    assignedFellowship: user.assignedFellowship,
    avatar: user.avatar,
    authProvider: user.authProvider || 'email',
    exp: Date.now() + 7 * 24 * 60 * 60 * 1000
  };
  return signPayload('DCUSESS1', payload);
}

function getSessionUser(req: Request): UserProfile | null {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Bearer ')) return null;
  const rawToken = auth.slice(7).trim();
  const decoded = verifySignedPayload<SignedSession>('DCUSESS1', rawToken);
  if (!decoded || decoded.exp < Date.now()) return null;

  const existing = memoryUsers.find(u => u.id === decoded.id || u.email.toLowerCase() === decoded.email.toLowerCase());
  if (existing && existing.isSuspended) return null;
  if (existing) {
    const { password: _pw, ...safe } = existing;
    return safe;
  }

  return {
    id: decoded.id,
    email: decoded.email,
    name: decoded.name,
    role: decoded.role,
    assignedZone: decoded.assignedZone,
    assignedFellowship: decoded.assignedFellowship,
    isApproved: true,
    authProvider: decoded.authProvider,
    avatar: decoded.avatar,
    createdAt: new Date().toISOString(),
    lastLoginAt: new Date().toISOString()
  };
}

function sanitizeUser(u: UserProfile & { password?: string }): UserProfile {
  const { password: _pw, ...safe } = u;
  if ((safe.role as string) === 'admin') {
    safe.role = 'super_admin';
  }
  return safe;
}

function verifySignedInvitation(rawToken: string, email?: string): { valid: boolean; reason?: string; invite?: SignedInvite } {
  const cleanToken = (rawToken || '').trim();
  if (!cleanToken) return { valid: false, reason: 'Invitation token is missing.' };

  const decoded = verifySignedPayload<SignedInvite>('DCUINV1', cleanToken);
  if (!decoded) {
    return { valid: false, reason: 'Invalid or expired invitation token.' };
  }

  if (new Date(decoded.expiresAt).getTime() < Date.now()) {
    return { valid: false, reason: 'This invitation has expired.' };
  }

  if (email && decoded.email.toLowerCase() !== email.toLowerCase().trim()) {
    return {
      valid: false,
      reason: `Invitation is restricted to email: ${decoded.email}. Authenticated email (${email}) does not match.`
    };
  }

  const memInv = memoryInvitations.find(i => i.id === decoded.id);
  if (memInv && memInv.status === 'revoked') {
    return { valid: false, reason: 'This invitation has been revoked by administration.' };
  }

  return { valid: true, invite: decoded };
}

// ==========================================
// AUTHENTICATION ENDPOINTS
// ==========================================

app.post('/api/auth/login', (req: Request, res: Response) => {
  const { email, password, credentialPassport } = req.body || {};
  const cleanEmail = (email || '').toLowerCase().trim();
  if (!cleanEmail || !password) {
    return res.status(400).json({ error: 'Email and password are required.' });
  }

  let user = memoryUsers.find(u => u.email.toLowerCase() === cleanEmail);

  // Re-hydrate invited staff user across Vercel serverless cold starts via HMAC-signed credentialPassport
  if (!user && credentialPassport) {
    const verified = verifyCredentialPassport(credentialPassport, cleanEmail);
    if (verified && verified.passwordHash && verified.salt && verifyPasswordScrypt(password, verified.passwordHash, verified.salt)) {
      user = {
        id: verified.id,
        email: verified.email,
        name: verified.name,
        phone: verified.phone,
        role: verified.role,
        assignedZone: verified.assignedZone,
        assignedFellowship: verified.assignedFellowship,
        avatar: verified.avatar,
        authProvider: verified.authProvider,
        password,
        isApproved: true,
        isSuspended: false,
        createdAt: verified.issuedAt,
        lastLoginAt: new Date().toISOString()
      };
      memoryUsers.push(user);
    }
  }

  if (!user) {
    return res.status(401).json({ error: 'Invalid email or password.' });
  }
  if (user.isSuspended) {
    return res.status(403).json({ error: 'This account has been suspended by administration.' });
  }
  if (user.password && user.password !== password) {
    return res.status(401).json({ error: 'Invalid email or password.' });
  }

  user.lastLoginAt = new Date().toISOString();
  const safe = sanitizeUser(user);
  const token = issueSessionToken(safe);
  return res.json({ user: safe, token });
});

app.post('/api/auth/register', (req: Request, res: Response) => {
  const { email, password, name, phone, role } = req.body || {};
  if (role && role !== 'parent') {
    return res.status(403).json({
      error: 'Security policy violation: Public registration cannot assign staff or administrative roles. Staff accounts require an administrator invitation.'
    });
  }
  const cleanEmail = (email || '').toLowerCase().trim();
  if (!cleanEmail || !cleanEmail.includes('@') || !password || password.length < 6) {
    return res.status(400).json({ error: 'Valid email and password (min 6 characters) are required.' });
  }
  if (memoryUsers.some(u => u.email.toLowerCase() === cleanEmail)) {
    return res.status(409).json({ error: 'An account with this email already exists.' });
  }

  const newUser: UserProfile & { password?: string } = {
    id: `usr-parent-${Date.now()}`,
    email: cleanEmail,
    name: name?.trim() || cleanEmail.split('@')[0],
    phone: phone?.trim() || '',
    role: 'parent',
    password,
    isApproved: true,
    authProvider: 'email',
    createdAt: new Date().toISOString(),
    lastLoginAt: new Date().toISOString()
  };
  memoryUsers.push(newUser);

  const safe = sanitizeUser(newUser);
  const token = issueSessionToken(safe);
  return res.status(201).json({ user: safe, token });
});

app.post('/api/auth/google', (req: Request, res: Response) => {
  const { email, name, avatar, invitationToken, credentialPassport } = req.body || {};
  const cleanEmail = (email || '').toLowerCase().trim();
  if (!cleanEmail || !cleanEmail.includes('@')) {
    return res.status(400).json({ error: 'Google email is required.' });
  }

  let user = memoryUsers.find(u => u.email.toLowerCase() === cleanEmail);

  if (invitationToken) {
    const check = verifySignedInvitation(invitationToken, cleanEmail);
    if (!check.valid || !check.invite) {
      return res.status(400).json({ error: check.reason || 'Invalid or expired staff invitation.' });
    }
    const inv = check.invite;
    if (user) {
      if (user.isSuspended) {
        return res.status(403).json({ error: 'This account has been suspended by administration.' });
      }
      user.role = inv.role;
      user.assignedZone = inv.assignedZone;
      user.assignedFellowship = inv.assignedFellowship;
      user.name = name || inv.name || user.name;
      user.isApproved = true;
      user.lastLoginAt = new Date().toISOString();
    } else {
      user = {
        id: `usr-staff-${Date.now()}`,
        email: cleanEmail,
        name: name || inv.name || cleanEmail.split('@')[0],
        role: inv.role,
        assignedZone: inv.assignedZone,
        assignedFellowship: inv.assignedFellowship,
        isApproved: true,
        authProvider: 'google',
        avatar: avatar || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(cleanEmail)}`,
        createdAt: new Date().toISOString(),
        lastLoginAt: new Date().toISOString()
      };
      memoryUsers.push(user);
    }

    const memInv = memoryInvitations.find(i => i.id === inv.id);
    if (memInv) {
      memInv.status = 'accepted';
      memInv.usedAt = new Date().toISOString();
    }

    const safe = sanitizeUser(user);
    const token = issueSessionToken(safe);
    const passport = issueCredentialPassport(safe);
    return res.json({ user: safe, token, credentialPassport: passport });
  }

  // Re-hydrate staff account across Vercel serverless cold starts via HMAC-signed credentialPassport
  if (!user && credentialPassport) {
    const verified = verifyCredentialPassport(credentialPassport, cleanEmail);
    if (verified) {
      user = {
        id: verified.id,
        email: verified.email,
        name: name || verified.name,
        phone: verified.phone,
        role: verified.role,
        assignedZone: verified.assignedZone,
        assignedFellowship: verified.assignedFellowship,
        avatar: avatar || verified.avatar,
        authProvider: 'google',
        isApproved: true,
        isSuspended: false,
        createdAt: verified.issuedAt,
        lastLoginAt: new Date().toISOString()
      };
      memoryUsers.push(user);
    }
  }

  if (user) {
    if (user.isSuspended) {
      return res.status(403).json({ error: 'This account has been suspended by administration.' });
    }
    user.lastLoginAt = new Date().toISOString();
    const safe = sanitizeUser(user);
    const token = issueSessionToken(safe);
    return res.json({ user: safe, token });
  }

  // Ordinary visitor signing in with Google without invitation strictly gets 'parent'
  user = {
    id: `usr-parent-${Date.now()}`,
    email: cleanEmail,
    name: name || cleanEmail.split('@')[0],
    avatar: avatar || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(cleanEmail)}`,
    role: 'parent',
    isApproved: true,
    authProvider: 'google',
    createdAt: new Date().toISOString(),
    lastLoginAt: new Date().toISOString()
  };
  memoryUsers.push(user);
  const safe = sanitizeUser(user);
  const token = issueSessionToken(safe);
  return res.json({ user: safe, token });
});

app.get('/api/auth/verify-invitation', (req: Request, res: Response) => {
  const token = String(req.query.token || '').trim();
  const email = String(req.query.email || '').trim();
  const check = verifySignedInvitation(token, email || undefined);
  if (!check.valid || !check.invite) {
    return res.status(400).json({ error: check.reason || 'Invitation is invalid, expired, or already used.' });
  }
  return res.json(check.invite);
});

app.post('/api/auth/accept-invitation', (req: Request, res: Response) => {
  const { token, email, password, name, phone } = req.body || {};
  const cleanEmail = (email || '').toLowerCase().trim();
  if (!token || !cleanEmail) {
    return res.status(400).json({ error: 'Invitation token and email are required.' });
  }
  if (!password || password.length < 6) {
    return res.status(400).json({ error: 'A secure password of at least 6 characters is required.' });
  }

  const check = verifySignedInvitation(token, cleanEmail);
  if (!check.valid || !check.invite) {
    return res.status(400).json({ error: check.reason || 'Invalid or expired staff invitation.' });
  }

  const inv = check.invite;
  let user = memoryUsers.find(u => u.email.toLowerCase() === cleanEmail);
  const nowIso = new Date().toISOString();

  if (user) {
    user.role = inv.role;
    user.assignedZone = inv.assignedZone;
    user.assignedFellowship = inv.assignedFellowship;
    user.password = password;
    user.name = name?.trim() || inv.name || user.name;
    if (phone?.trim()) user.phone = phone.trim();
    user.isApproved = true;
    user.isSuspended = false;
    user.lastLoginAt = nowIso;
  } else {
    user = {
      id: `usr-staff-${Date.now()}`,
      email: cleanEmail,
      name: name?.trim() || inv.name || cleanEmail.split('@')[0],
      phone: phone?.trim() || '',
      role: inv.role,
      assignedZone: inv.assignedZone,
      assignedFellowship: inv.assignedFellowship,
      password,
      isApproved: true,
      isSuspended: false,
      authProvider: 'email',
      createdAt: nowIso,
      lastLoginAt: nowIso
    };
    memoryUsers.push(user);
  }

  const memInv = memoryInvitations.find(i => i.id === inv.id);
  if (memInv) {
    memInv.status = 'accepted';
    memInv.usedAt = nowIso;
  }

  const safe = sanitizeUser(user);
  const sessToken = issueSessionToken(safe);
  const { hash, salt } = hashPasswordScrypt(password);
  const credentialPassport = issueCredentialPassport(safe, hash, salt);
  return res.json({ user: safe, token: sessToken, credentialPassport });
});

app.get('/api/auth/me', (req: Request, res: Response) => {
  const user = getSessionUser(req);
  if (!user) return res.status(401).json({ error: 'Not authenticated' });
  return res.json(user);
});

app.post('/api/auth/logout', (_req: Request, res: Response) => {
  return res.json({ success: true, message: 'Logged out successfully.' });
});

// ==========================================
// DEDICATIONS ENDPOINTS
// ==========================================

app.get('/api/dedications', (req: Request, res: Response) => {
  const user = getSessionUser(req);
  if (!user) return res.status(401).json({ error: 'Authentication required.' });

  const role = (user.role as string) === 'admin' ? 'super_admin' : user.role;
  if (role === 'super_admin' || role === 'office_admin') {
    return res.json(memoryDedications);
  }
  if (role === 'pastor') {
    if (user.assignedZone) {
      return res.json(memoryDedications.filter(d => d.selectedZone === user.assignedZone));
    }
    return res.json(memoryDedications);
  }
  if (role === 'fellowship_leader') {
    if (!user.assignedZone) return res.json([]);
    let filtered = memoryDedications.filter(d => d.selectedZone === user.assignedZone);
    if (user.assignedFellowship) {
      const target = user.assignedFellowship.toLowerCase().trim();
      filtered = filtered.filter(d => (d.selectedFellowship || '').toLowerCase().trim() === target);
    }
    return res.json(filtered);
  }
  if (role === 'parent') {
    const email = user.email.toLowerCase();
    return res.json(
      memoryDedications.filter(d =>
        d.submittedBy?.toLowerCase() === email ||
        d.parentEmail?.toLowerCase() === email ||
        d.fatherEmail?.toLowerCase() === email ||
        d.motherEmail?.toLowerCase() === email
      )
    );
  }
  return res.status(403).json({ error: 'Access denied.' });
});

app.post('/api/dedications', (req: Request, res: Response) => {
  const rec = req.body || {};
  if (!rec.childName || !rec.childDob) {
    return res.status(400).json({ error: 'Child name and date of birth are required.' });
  }
  const newRec: DedicationRecord = {
    id: `DED-${new Date().getFullYear()}-${String(memoryDedications.length + 1).padStart(3, '0')}`,
    childName: rec.childName,
    childDob: rec.childDob,
    childGender: rec.childGender === 'Female' ? 'Female' : 'Male',
    childCountyOfBirth: rec.childCountyOfBirth || 'Nairobi',
    fatherName: rec.fatherName || '',
    fatherPhone: rec.fatherPhone || '',
    fatherEmail: rec.fatherEmail || '',
    motherName: rec.motherName || '',
    motherPhone: rec.motherPhone || '',
    motherEmail: rec.motherEmail || '',
    parentName: rec.parentName || `${rec.fatherName || ''} & ${rec.motherName || ''}`.trim(),
    parentPhone: rec.parentPhone || rec.fatherPhone || rec.motherPhone || '',
    parentEmail: rec.parentEmail || rec.fatherEmail || rec.motherEmail || '',
    isInFellowship: rec.isInFellowship ?? false,
    selectedZone: rec.selectedZone || 'Zone A',
    selectedFellowship: rec.selectedFellowship || 'General',
    residentialLocation: rec.residentialLocation || '',
    dataConsent: true,
    status: 'submitted',
    serviceDate: rec.serviceDate || 'To be scheduled by Pastoral Office',
    leadershipConfirmed: false,
    officeApproved: false,
    certificateIssued: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  memoryDedications.unshift(newRec);
  return res.status(201).json(newRec);
});

app.get('/api/dedications/track', (req: Request, res: Response) => {
  const id = String(req.query.id || '').trim();
  const phone = String(req.query.phone || '').trim();
  if (!id && !phone) {
    return res.status(400).json({ error: 'Please provide your Dedication Reference ID, Child Name, or Phone Number.' });
  }

  const cleanQuery = id.toLowerCase();
  const cleanDigits = (phone || id).replace(/[^\d]/g, '');
  const found = memoryDedications.find(d =>
    d.id.toLowerCase() === cleanQuery ||
    (d.certificateNumber && d.certificateNumber.toLowerCase() === cleanQuery) ||
    d.childName.toLowerCase().includes(cleanQuery) ||
    (cleanDigits.length >= 7 && (
      (d.fatherPhone || '').replace(/[^\d]/g, '').includes(cleanDigits) ||
      (d.motherPhone || '').replace(/[^\d]/g, '').includes(cleanDigits) ||
      (d.parentPhone || '').replace(/[^\d]/g, '').includes(cleanDigits)
    ))
  );
  if (!found) {
    return res.status(404).json({ error: 'Record not found. Please verify your Reference ID, Child Name, or Phone Number.' });
  }
  return res.json({
    id: found.id,
    childName: found.childName,
    status: found.status,
    serviceDate: found.serviceDate,
    leadershipConfirmed: found.leadershipConfirmed,
    officeApproved: found.officeApproved,
    certificateIssued: found.certificateIssued,
    certificateNumber: found.certificateIssued ? found.certificateNumber : undefined,
    selectedZone: found.selectedZone,
    selectedFellowship: found.selectedFellowship,
    createdAt: found.createdAt,
    updatedAt: found.updatedAt
  });
});

app.put('/api/dedications/:id', (req: Request, res: Response) => {
  const user = getSessionUser(req);
  if (!user) return res.status(401).json({ error: 'Authentication required.' });

  const { id } = req.params;
  const idx = memoryDedications.findIndex(d => d.id === id);
  if (idx === -1) return res.status(404).json({ error: 'Record not found' });

  const role = (user.role as string) === 'admin' ? 'super_admin' : user.role;
  const current = memoryDedications[idx];

  if (role === 'fellowship_leader') {
    const sameZone = Boolean(user.assignedZone) && current.selectedZone === user.assignedZone;
    const sameFellowship = !user.assignedFellowship ||
      (current.selectedFellowship || '').toLowerCase().trim() === user.assignedFellowship.toLowerCase().trim();
    if (!sameZone || !sameFellowship) {
      return res.status(403).json({ error: 'Access denied: Out of your assigned fellowship.' });
    }
  } else if (role !== 'super_admin' && role !== 'office_admin' && role !== 'pastor') {
    return res.status(403).json({ error: 'Access denied.' });
  }

  memoryDedications[idx] = { ...current, ...req.body, id, updatedAt: new Date().toISOString() };
  return res.json(memoryDedications[idx]);
});

app.delete('/api/dedications/:id', (req: Request, res: Response) => {
  const user = getSessionUser(req);
  if (!user || (user.role !== 'super_admin' && user.role !== 'office_admin')) {
    return res.status(403).json({ error: 'Access denied.' });
  }
  const { id } = req.params;
  memoryDedications = memoryDedications.filter(d => d.id !== id);
  return res.json({ success: true });
});

app.post('/api/dedications/bulk-import', (req: Request, res: Response) => {
  const user = getSessionUser(req);
  if (!user || (user.role !== 'super_admin' && user.role !== 'office_admin')) {
    return res.status(403).json({ error: 'Access denied.' });
  }
  const records = Array.isArray(req.body) ? req.body : [];
  memoryDedications.unshift(...records);
  return res.json({ count: records.length, total: memoryDedications.length });
});

// ==========================================
// PAST DEDICATIONS
// ==========================================

app.get('/api/past-dedications', (req: Request, res: Response) => {
  const user = getSessionUser(req);
  if (!user || (user.role !== 'super_admin' && user.role !== 'office_admin' && user.role !== 'pastor')) {
    return res.status(403).json({ error: 'Access denied.' });
  }
  return res.json(memoryPastDedications);
});

app.post('/api/past-dedications', (req: Request, res: Response) => {
  const user = getSessionUser(req);
  if (!user || (user.role !== 'super_admin' && user.role !== 'office_admin')) {
    return res.status(403).json({ error: 'Access denied.' });
  }
  const record = req.body || {};
  const newRecord: PastDedicationRecord = {
    id: `PAST-${Date.now()}`,
    childName: record.childName || 'Historical Dedication',
    childDob: record.childDob || '2020-01-01',
    childGender: record.childGender || 'Male',
    childCountyOfBirth: record.childCountyOfBirth || 'Nairobi',
    fatherName: record.fatherName || '',
    fatherPhone: record.fatherPhone || '',
    fatherEmail: record.fatherEmail || '',
    motherName: record.motherName || '',
    motherPhone: record.motherPhone || '',
    motherEmail: record.motherEmail || '',
    dedicationYear: record.dedicationYear || 2020,
    serviceDate: record.serviceDate || '2020-01-01',
    certificateNumber: record.certificateNumber || `DCU-HIST-${Math.floor(1000 + Math.random() * 9000)}`,
    certificateIssued: record.certificateIssued ?? true,
    officiatingMinister: record.officiatingMinister || 'Senior Pastor',
    notes: record.notes || '',
    archivalSource: record.archivalSource || 'Historical Register',
    createdAt: new Date().toISOString()
  };
  memoryPastDedications.unshift(newRecord);
  return res.status(201).json(newRecord);
});

app.post('/api/past-dedications/bulk-import', (req: Request, res: Response) => {
  const user = getSessionUser(req);
  if (!user || (user.role !== 'super_admin' && user.role !== 'office_admin')) {
    return res.status(403).json({ error: 'Access denied.' });
  }
  const body = req.body || {};
  const records = Array.isArray(body) ? body : (Array.isArray(body.records) ? body.records : []);
  if (!Array.isArray(body) && body.replaceAll) {
    memoryPastDedications = records;
  } else if (!Array.isArray(body) && body.replaceYear) {
    memoryPastDedications = [...records, ...memoryPastDedications.filter(d => d.dedicationYear !== body.replaceYear)];
  } else {
    memoryPastDedications.unshift(...records);
  }
  return res.json({ success: true, count: records.length });
});

app.put('/api/past-dedications/:id', (req: Request, res: Response) => {
  const user = getSessionUser(req);
  if (!user || (user.role !== 'super_admin' && user.role !== 'office_admin')) {
    return res.status(403).json({ error: 'Access denied.' });
  }
  const idx = memoryPastDedications.findIndex(d => d.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Past dedication record not found.' });
  memoryPastDedications[idx] = { ...memoryPastDedications[idx], ...req.body, id: req.params.id };
  return res.json(memoryPastDedications[idx]);
});

app.delete('/api/past-dedications/:id', (req: Request, res: Response) => {
  const user = getSessionUser(req);
  if (!user || (user.role !== 'super_admin' && user.role !== 'office_admin')) {
    return res.status(403).json({ error: 'Access denied.' });
  }
  memoryPastDedications = memoryPastDedications.filter(d => d.id !== req.params.id);
  return res.json({ success: true });
});

// ==========================================
// STAFF, INVITATIONS & USER DIRECTORY
// ==========================================

app.get('/api/users', (req: Request, res: Response) => {
  const user = getSessionUser(req);
  if (!user || (user.role !== 'super_admin' && user.role !== 'office_admin')) {
    return res.status(403).json({ error: 'Access denied.' });
  }
  return res.json(memoryUsers.map(sanitizeUser));
});

app.post('/api/users/invite', (req: Request, res: Response) => {
  const user = getSessionUser(req);
  if (!user || user.role !== 'super_admin') {
    return res.status(403).json({ error: 'Only Super Administrators can issue staff invitations.' });
  }

  const { email, name, role, assignedZone, assignedFellowship } = req.body || {};
  if (!email || !email.includes('@')) {
    return res.status(400).json({ error: 'Valid email address is required.' });
  }
  const validRoles: UserRole[] = ['super_admin', 'office_admin', 'pastor', 'fellowship_leader'];
  if (!role || !validRoles.includes(role)) {
    return res.status(400).json({ error: 'Invalid staff role specified.' });
  }

  const nowIso = new Date().toISOString();
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  const invitePayload: SignedInvite = {
    id: `inv-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`,
    email: email.toLowerCase().trim(),
    name: name?.trim() || undefined,
    role,
    assignedZone,
    assignedFellowship: assignedFellowship?.trim() || undefined,
    createdAt: nowIso,
    expiresAt
  };

  const rawToken = signPayload('DCUINV1', invitePayload);
  const invitation: StaffInvitation = {
    ...invitePayload,
    token: rawToken,
    invitedBy: user.id,
    invitedByEmail: user.email,
    status: 'pending'
  };
  memoryInvitations.unshift(invitation);

  const host = req.get('x-forwarded-host') || req.get('host');
  const proto = req.get('x-forwarded-proto') || req.protocol;
  return res.status(201).json({
    invitation,
    rawToken,
    inviteUrl: `${proto}://${host}/?invite=${encodeURIComponent(rawToken)}&email=${encodeURIComponent(invitePayload.email)}`
  });
});

app.get('/api/invitations', (req: Request, res: Response) => {
  const user = getSessionUser(req);
  if (!user || user.role !== 'super_admin') {
    return res.status(403).json({ error: 'Access denied.' });
  }
  return res.json(memoryInvitations);
});

app.post('/api/invitations/:id/revoke', (req: Request, res: Response) => {
  const user = getSessionUser(req);
  if (!user || user.role !== 'super_admin') {
    return res.status(403).json({ error: 'Access denied.' });
  }
  const inv = memoryInvitations.find(i => i.id === req.params.id);
  if (inv) {
    inv.status = 'revoked';
    inv.revokedAt = new Date().toISOString();
    inv.revokedBy = user.id;
  }
  return res.json({ success: true });
});

app.put('/api/users/:id/role', (req: Request, res: Response) => {
  const user = getSessionUser(req);
  if (!user || user.role !== 'super_admin') {
    return res.status(403).json({ error: 'Access denied.' });
  }
  const target = memoryUsers.find(u => u.id === req.params.id);
  if (!target) return res.status(404).json({ error: 'User not found' });
  const { role, assignedZone, assignedFellowship } = req.body || {};
  if (role) target.role = role;
  if (assignedZone !== undefined) target.assignedZone = assignedZone;
  if (assignedFellowship !== undefined) target.assignedFellowship = assignedFellowship;
  return res.json(sanitizeUser(target));
});

app.put('/api/users/:id/status', (req: Request, res: Response) => {
  const user = getSessionUser(req);
  if (!user || user.role !== 'super_admin') {
    return res.status(403).json({ error: 'Access denied.' });
  }
  const target = memoryUsers.find(u => u.id === req.params.id);
  if (!target) return res.status(404).json({ error: 'User not found' });
  target.isSuspended = Boolean(req.body?.isSuspended);
  return res.json(sanitizeUser(target));
});

app.delete('/api/users/:id', (req: Request, res: Response) => {
  const user = getSessionUser(req);
  if (!user || user.role !== 'super_admin') {
    return res.status(403).json({ error: 'Access denied.' });
  }
  memoryUsers = memoryUsers.filter(u => u.id !== req.params.id);
  return res.json({ success: true });
});

app.get('/api/audit-logs', (req: Request, res: Response) => {
  const user = getSessionUser(req);
  if (!user || user.role !== 'super_admin') {
    return res.status(403).json({ error: 'Access denied.' });
  }
  return res.json([]);
});

app.post('/api/audit/log-export', (_req: Request, res: Response) => {
  return res.json({ success: true });
});

// Ensure unknown /api/* endpoints return JSON rather than HTML
app.use('/api/*', (_req: Request, res: Response) => {
  return res.status(404).json({ error: 'API endpoint not found.' });
});

// Export Express app for Vercel Serverless
export default app;
