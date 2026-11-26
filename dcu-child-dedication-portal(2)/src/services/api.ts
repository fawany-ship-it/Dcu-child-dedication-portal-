import { 
  DedicationRecord, 
  UserProfile, 
  UserRole, 
  PastDedicationRecord, 
  StaffInvitation, 
  AuditLog 
} from '../types';
import { INITIAL_DEDICATIONS, INITIAL_USERS } from '../data/initialDedications';
import { INITIAL_PAST_DEDICATIONS } from '../data/pastDedications';
import { auth } from '../lib/firebase';
import {
  generateUniqueDedicationId,
  isFirebaseStaffSignedIn,
  submitDedicationToFirestore,
  trackDedicationsInFirestore,
  fetchDedicationsFromFirestore,
  updateDedicationInFirestore,
  deleteDedicationInFirestore,
  adminUpsertDedicationsBatch,
  fetchStaffRoleByEmail,
  updateOwnLastLoginInFirestore,
  syncStaffRoleToFirestore,
  fetchStaffRolesFromFirestore,
  deleteStaffRoleFromFirestore,
  saveInvitationToFirestore,
  fetchInvitationsFromFirestore,
  revokeInvitationInFirestore,
  fetchPastDedicationsFromFirestore,
  createPastDedicationInFirestore,
  updatePastDedicationInFirestore,
  deletePastDedicationInFirestore,
  syncLocalSubmissionsToFirestore,
} from './firestoreService';

const TOKEN_KEY = 'dcu_auth_session_token_v3';
const STORAGE_PREFIX = 'dcu_v2_';
const STORAGE_USERS = `${STORAGE_PREFIX}users`;
const STORAGE_DEDICATIONS = `${STORAGE_PREFIX}dedications`;
const STORAGE_PAST_DEDICATIONS = `${STORAGE_PREFIX}past_dedications`;
const STORAGE_INVITATIONS = `${STORAGE_PREFIX}invitations`;
const STORAGE_AUDIT_LOGS = `${STORAGE_PREFIX}audit_logs`;
const STORAGE_CURRENT_USER = `${STORAGE_PREFIX}current_user`;
const STORAGE_STAFF_PASSPORTS = `${STORAGE_PREFIX}staff_passports_v1`;
const STORAGE_DELETED_DEDICATIONS = 'dcu_deleted_dedication_ids_v1';

export function getDeletedDedicationIds(): Set<string> {
  try {
    const raw = localStorage.getItem(STORAGE_DELETED_DEDICATIONS);
    const arr = raw ? JSON.parse(raw) : [];
    return new Set(Array.isArray(arr) ? arr.filter((x) => typeof x === 'string') : []);
  } catch {
    return new Set();
  }
}

function markDedicationDeleted(id: string) {
  try {
    const set = getDeletedDedicationIds();
    set.add(id);
    localStorage.setItem(STORAGE_DELETED_DEDICATIONS, JSON.stringify(Array.from(set).slice(-500)));
  } catch {
    // ignore storage limits
  }
}

function clearDedicationDeleted(id: string) {
  try {
    const set = getDeletedDedicationIds();
    if (set.delete(id)) {
      localStorage.setItem(STORAGE_DELETED_DEDICATIONS, JSON.stringify(Array.from(set)));
    }
  } catch {
    // ignore
  }
}

let memoryToken: string | null = null;
let isStaticHostingMode = false;

function isTrueStaticSpaFallback(res: Response): boolean {
  const ct = (res.headers.get('content-type') || '').toLowerCase();
  return res.status === 200 && ct.includes('text/html');
}

function getStoredCredentialPassport(email: string): string | undefined {
  try {
    const raw = localStorage.getItem(STORAGE_STAFF_PASSPORTS);
    if (!raw) return undefined;
    const map = JSON.parse(raw) as Record<string, string>;
    return map[email.toLowerCase().trim()];
  } catch {
    return undefined;
  }
}

function saveStoredCredentialPassport(email: string, passport?: string) {
  if (!passport) return;
  try {
    const raw = localStorage.getItem(STORAGE_STAFF_PASSPORTS);
    const map = raw ? (JSON.parse(raw) as Record<string, string>) : {};
    map[email.toLowerCase().trim()] = passport;
    localStorage.setItem(STORAGE_STAFF_PASSPORTS, JSON.stringify(map));
  } catch {}
}

// ============================================================
// TOKEN MANAGEMENT (with in-memory fallback for iframes)
// ============================================================

export function getSessionToken(): string | null {
  try {
    const stored = localStorage.getItem(TOKEN_KEY);
    if (stored) return stored;
  } catch {
    // localStorage restricted or disabled
  }
  return memoryToken;
}

export function setSessionToken(token: string | null) {
  memoryToken = token;
  try {
    if (token) {
      localStorage.setItem(TOKEN_KEY, token);
    } else {
      localStorage.removeItem(TOKEN_KEY);
    }
  } catch {
    // localStorage blocked
  }
}

function getAuthHeaders(extraHeaders: Record<string, string> = {}): Record<string, string> {
  const token = getSessionToken();
  const headers: Record<string, string> = { ...extraHeaders };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}

// ============================================================
// LOCAL STORAGE SEED & DATABASE ENGINE (for Vercel & static hosting)
// ============================================================

interface LocalUserRecord extends UserProfile {
  password?: string;
  isSuspended?: boolean;
}

function initLocalDatabase() {
  try {
    // 1. Users
    if (!localStorage.getItem(STORAGE_USERS)) {
      const seededUsers: LocalUserRecord[] = INITIAL_USERS.map(u => ({
        ...u,
        role: (u.role as string) === 'admin' ? 'super_admin' : u.role,
        password: u.role === 'admin' || (u.role as string) === 'super_admin' ? 'DcuAdmin2026!#' : 'DcuLeader2026!#',
        isSuspended: false
      }));
      // Ensure fawany@gmail.com is present with Super Admin role
      const adminExists = seededUsers.some(u => u.email.toLowerCase() === 'fawany@gmail.com');
      if (!adminExists) {
        seededUsers.unshift({
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
          lastLoginAt: new Date().toISOString(),
          isSuspended: false
        });
      }
      localStorage.setItem(STORAGE_USERS, JSON.stringify(seededUsers));
    }

    // 2. Dedications
    if (!localStorage.getItem(STORAGE_DEDICATIONS)) {
      localStorage.setItem(STORAGE_DEDICATIONS, JSON.stringify(INITIAL_DEDICATIONS));
    }

    // 3. Past Dedications
    if (!localStorage.getItem(STORAGE_PAST_DEDICATIONS)) {
      localStorage.setItem(STORAGE_PAST_DEDICATIONS, JSON.stringify(INITIAL_PAST_DEDICATIONS));
    }

    // 4. Invitations
    if (!localStorage.getItem(STORAGE_INVITATIONS)) {
      localStorage.setItem(STORAGE_INVITATIONS, JSON.stringify([]));
    }

    // 5. Audit Logs
    if (!localStorage.getItem(STORAGE_AUDIT_LOGS)) {
      localStorage.setItem(STORAGE_AUDIT_LOGS, JSON.stringify([
        {
          id: 'audit-init-1',
          timestamp: new Date().toISOString(),
          eventType: 'SYSTEM_BOOTSTRAP',
          actorEmail: 'system',
          actorRole: 'system',
          outcome: 'SUCCESS',
          details: { note: 'Deliverance Church Utawala Portal database initialized.' }
        }
      ]));
    }
  } catch (e) {
    console.warn('Local database initialization warning:', e);
  }
}

// Helper to get from local store
function getLocalUsers(): LocalUserRecord[] {
  initLocalDatabase();
  try {
    const raw = localStorage.getItem(STORAGE_USERS);
    if (raw) return JSON.parse(raw);
  } catch {}
  return [];
}

function saveLocalUsers(users: LocalUserRecord[]) {
  try {
    localStorage.setItem(STORAGE_USERS, JSON.stringify(users));
  } catch {}
}

function getLocalDedications(): DedicationRecord[] {
  initLocalDatabase();
  try {
    const raw = localStorage.getItem(STORAGE_DEDICATIONS);
    if (raw) return JSON.parse(raw);
  } catch {}
  return INITIAL_DEDICATIONS;
}

function saveLocalDedications(data: DedicationRecord[]) {
  try {
    localStorage.setItem(STORAGE_DEDICATIONS, JSON.stringify(data));
  } catch {}
}

function getLocalPastDedications(): PastDedicationRecord[] {
  initLocalDatabase();
  try {
    const raw = localStorage.getItem(STORAGE_PAST_DEDICATIONS);
    if (raw) return JSON.parse(raw);
  } catch {}
  return INITIAL_PAST_DEDICATIONS;
}

function saveLocalPastDedications(data: PastDedicationRecord[]) {
  try {
    localStorage.setItem(STORAGE_PAST_DEDICATIONS, JSON.stringify(data));
  } catch {}
}

function getLocalInvitations(): StaffInvitation[] {
  initLocalDatabase();
  try {
    const raw = localStorage.getItem(STORAGE_INVITATIONS);
    if (raw) return JSON.parse(raw);
  } catch {}
  return [];
}

function saveLocalInvitations(invs: StaffInvitation[]) {
  try {
    localStorage.setItem(STORAGE_INVITATIONS, JSON.stringify(invs));
  } catch {}
}

function getLocalAuditLogs(): AuditLog[] {
  initLocalDatabase();
  try {
    const raw = localStorage.getItem(STORAGE_AUDIT_LOGS);
    if (raw) return JSON.parse(raw);
  } catch {}
  return [];
}

function addLocalAuditLog(event: Partial<AuditLog>) {
  try {
    const logs = getLocalAuditLogs();
    const newEntry: AuditLog = {
      id: `audit-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      timestamp: new Date().toISOString(),
      eventType: event.eventType || 'ACTION',
      actorId: event.actorId || 'usr-local',
      actorEmail: event.actorEmail || 'local@dcutawala.org',
      actorRole: event.actorRole || 'user',
      outcome: event.outcome || 'SUCCESS',
      details: event.details
    };
    logs.unshift(newEntry);
    localStorage.setItem(STORAGE_AUDIT_LOGS, JSON.stringify(logs.slice(0, 1000)));
  } catch {}
}

function getCurrentLocalUser(): UserProfile | null {
  try {
    const raw = localStorage.getItem(STORAGE_CURRENT_USER);
    if (raw) return JSON.parse(raw);
  } catch {}
  return null;
}

let lastVerifiedCloudEmail: string | null = null;

export function setCurrentLocalUser(user: UserProfile | null) {
  try {
    if (user) {
      localStorage.setItem(STORAGE_CURRENT_USER, JSON.stringify(user));
    } else {
      lastVerifiedCloudEmail = null;
      localStorage.removeItem(STORAGE_CURRENT_USER);
    }
  } catch {}
}

async function resolveActiveStaffUser(): Promise<UserProfile | null> {
  const local = getCurrentLocalUser();
  if (isFirebaseStaffSignedIn() && auth.currentUser?.email) {
    const fbEmail = auth.currentUser.email.toLowerCase().trim();
    if (
      lastVerifiedCloudEmail !== fbEmail ||
      !local ||
      local.email.toLowerCase().trim() !== fbEmail ||
      local.role === 'parent'
    ) {
      const cloudRole = await fetchStaffRoleByEmail(fbEmail);
      if (cloudRole) {
        if (cloudRole.isSuspended) {
          lastVerifiedCloudEmail = null;
          setCurrentLocalUser(null);
          throw new Error('This account has been suspended by administration.');
        }
        lastVerifiedCloudEmail = fbEmail;
        setCurrentLocalUser(cloudRole);
        return cloudRole;
      }
    }
  }
  return local;
}

// ============================================================
// DUAL-MODE API CLIENT
// Tries backend Express server first; if static hosting (Vercel rewrite to HTML or 404),
// seamlessly switches to client database!
// ============================================================

export const api = {
  // ==========================================
  // AUTHENTICATION
  // ==========================================

  async login(email: string, password: string): Promise<{ user: UserProfile; token: string; requiresMfa?: boolean }> {
    const cleanEmail = email.toLowerCase().trim();

    let receivedJson = false;
    try {
      const credentialPassport = getStoredCredentialPassport(cleanEmail);
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: cleanEmail, password, credentialPassport })
      });

      const contentType = res.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        receivedJson = true;
        if (!res.ok) {
          const err = await res.json().catch(() => ({ error: 'Invalid credentials' }));
          throw new Error(err.error || 'Invalid credentials');
        }
        isStaticHostingMode = false;
        const data = await res.json();
        if (data.token) setSessionToken(data.token);
        if (data.credentialPassport) saveStoredCredentialPassport(cleanEmail, data.credentialPassport);
        setCurrentLocalUser(data.user);
        return data;
      } else if (isTrueStaticSpaFallback(res)) {
        isStaticHostingMode = true;
      } else {
        throw new Error(`Authentication service error (HTTP ${res.status}). Please refresh and try again.`);
      }
    } catch (err: any) {
      if (receivedJson || !isStaticHostingMode) {
        throw new Error(err?.message || 'Unable to reach the authentication server. Please try again.');
      }
    }

    // LOCAL DATABASE FALLBACK (Vercel Deployment)
    initLocalDatabase();
    const users = getLocalUsers();
    let user = users.find(u => u.email.toLowerCase() === cleanEmail);

    // If fawany@gmail.com and password matches or instant login
    if (cleanEmail === 'fawany@gmail.com') {
      if (!user) {
        user = {
          id: 'usr-admin-1',
          email: 'fawany@gmail.com',
          name: 'Fawany (Administrator)',
          role: 'super_admin',
          isApproved: true,
          avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
          authProvider: 'google',
          phone: '0723 102273',
          password: 'DcuAdmin2026!#',
          createdAt: '2026-01-01T00:00:00.000Z'
        };
        users.push(user);
        saveLocalUsers(users);
      }
      
      // Require valid administrator password
      if (!password || (password !== 'DcuAdmin2026!#' && password !== user.password)) {
        throw new Error('Invalid email or password.');
      }
    } else {
      if (!user || (user.password && user.password !== password)) {
        throw new Error('Invalid email or password.');
      }
    }

    const nowIso = new Date().toISOString();
    user.lastLoginAt = nowIso;
    const usersToUpdate = getLocalUsers();
    const uIdx = usersToUpdate.findIndex(u => u.email.toLowerCase() === cleanEmail);
    if (uIdx >= 0) {
      usersToUpdate[uIdx].lastLoginAt = nowIso;
      saveLocalUsers(usersToUpdate);
    }

    const token = `dcu-token-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    setSessionToken(token);
    setCurrentLocalUser(user);

    addLocalAuditLog({
      eventType: 'AUTH_LOGIN_SUCCESS',
      actorId: user.id,
      actorEmail: user.email,
      actorRole: user.role,
      outcome: 'SUCCESS'
    });

    return { user, token };
  },

  async registerParent(data: {
    email: string;
    password: string;
    name: string;
    phone?: string;
  }): Promise<{ user: UserProfile; token: string }> {
    const cleanEmail = data.email.toLowerCase().trim();

    if (!isStaticHostingMode) {
      let receivedJson = false;
      try {
        const res = await fetch('/api/auth/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...data, email: cleanEmail, role: 'parent' })
        });
        const contentType = res.headers.get('content-type') || '';
        if (contentType.includes('application/json')) {
          receivedJson = true;
          if (!res.ok) {
            const err = await res.json().catch(() => ({ error: 'Registration failed' }));
            throw new Error(err.error || 'Registration failed');
          }
          const result = await res.json();
          if (result.token) setSessionToken(result.token);
          setCurrentLocalUser(result.user);
          return result;
        } else {
          isStaticHostingMode = true;
        }
      } catch (err: any) {
        if (receivedJson) throw err;
        throw new Error(err?.message || 'Unable to reach the server. Please try again.');
      }
    }

    // Local Fallback
    initLocalDatabase();
    const users = getLocalUsers();
    let user = users.find(u => u.email.toLowerCase() === cleanEmail);
    if (user) {
      throw new Error('An account with this email already exists. Please sign in.');
    }

    const newUser: LocalUserRecord = {
      id: `usr-parent-${Date.now()}`,
      email: cleanEmail,
      name: data.name.trim(),
      phone: data.phone?.trim() || '',
      role: 'parent',
      password: data.password,
      isApproved: true,
      authProvider: 'email',
      createdAt: new Date().toISOString()
    };

    users.push(newUser);
    saveLocalUsers(users);

    const token = `dcu-token-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    setSessionToken(token);
    setCurrentLocalUser(newUser);

    addLocalAuditLog({
      eventType: 'PARENT_REGISTERED',
      actorId: newUser.id,
      actorEmail: newUser.email,
      actorRole: 'parent',
      outcome: 'SUCCESS'
    });

    return { user: newUser, token };
  },

  async loginGoogle(payload: {
    email: string;
    name?: string;
    avatar?: string;
    invitationToken?: string;
  }): Promise<{ user: UserProfile; token: string }> {
    const cleanEmail = payload.email.toLowerCase().trim();

    const cleanInviteToken = payload.invitationToken?.trim() || undefined;

    // Check authoritative Firestore staff_roles record if Firebase Auth session is active
    let cloudStaffRole: UserProfile | null = null;
    if (isFirebaseStaffSignedIn()) {
      cloudStaffRole = await fetchStaffRoleByEmail(cleanEmail);
      if (cloudStaffRole) {
        if (cloudStaffRole.isSuspended) {
          throw new Error('This account has been suspended by administration.');
        }
        const updatedLogin = await updateOwnLastLoginInFirestore(cleanEmail, payload.name, payload.avatar);
        if (updatedLogin) {
          cloudStaffRole.lastLoginAt = new Date().toISOString();
        }
      }
    }

    let receivedJson = false;
    try {
      const credentialPassport = getStoredCredentialPassport(cleanEmail);
      const res = await fetch('/api/auth/google', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...payload, email: cleanEmail, invitationToken: cleanInviteToken, credentialPassport })
      });
      const contentType = res.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        receivedJson = true;
        if (!res.ok) {
          if (cloudStaffRole && !cleanInviteToken) {
            // Firestore staff_roles is authoritative for Google-authenticated staff across stateless deployments
            const verifiedUser: UserProfile = {
              ...cloudStaffRole,
              name: payload.name || cloudStaffRole.name,
              avatar: payload.avatar || cloudStaffRole.avatar,
              lastLoginAt: new Date().toISOString(),
            };
            const fallbackToken = `dcu-firebase-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
            setSessionToken(fallbackToken);
            setCurrentLocalUser(verifiedUser);
            return { user: verifiedUser, token: fallbackToken };
          }
          const err = await res.json().catch(() => ({ error: 'Google authentication failed' }));
          throw new Error(err.error || 'Google authentication failed');
        }
        isStaticHostingMode = false;
        const data = await res.json();
        // Prefer Firestore staff_roles assignment if present (e.g. invited staff signing in cross-device)
        if (cloudStaffRole && !cleanInviteToken) {
          data.user = {
            ...data.user,
            role: cloudStaffRole.role,
            assignedZone: cloudStaffRole.assignedZone,
            assignedFellowship: cloudStaffRole.assignedFellowship,
            isApproved: cloudStaffRole.isApproved,
            isSuspended: cloudStaffRole.isSuspended,
            name: data.user.name || cloudStaffRole.name,
            lastLoginAt: new Date().toISOString(),
          };
        }
        if (data.token) setSessionToken(data.token);
        if (data.credentialPassport) saveStoredCredentialPassport(cleanEmail, data.credentialPassport);
        setCurrentLocalUser(data.user);
        return data;
      } else if (isTrueStaticSpaFallback(res)) {
        isStaticHostingMode = true;
      } else if (cloudStaffRole && !cleanInviteToken) {
        const verifiedUser: UserProfile = {
          ...cloudStaffRole,
          name: payload.name || cloudStaffRole.name,
          avatar: payload.avatar || cloudStaffRole.avatar,
          lastLoginAt: new Date().toISOString(),
        };
        const fallbackToken = `dcu-firebase-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        setSessionToken(fallbackToken);
        setCurrentLocalUser(verifiedUser);
        return { user: verifiedUser, token: fallbackToken };
      } else {
        throw new Error(`Google authentication service error (HTTP ${res.status}). Please refresh and try again.`);
      }
    } catch (err: any) {
      if (cloudStaffRole && !cleanInviteToken) {
        const verifiedUser: UserProfile = {
          ...cloudStaffRole,
          name: payload.name || cloudStaffRole.name,
          avatar: payload.avatar || cloudStaffRole.avatar,
          lastLoginAt: new Date().toISOString(),
        };
        const fallbackToken = `dcu-firebase-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        setSessionToken(fallbackToken);
        setCurrentLocalUser(verifiedUser);
        return { user: verifiedUser, token: fallbackToken };
      }
      if (receivedJson || !isStaticHostingMode) {
        throw new Error(err?.message || 'Unable to reach the authentication server. Please try again.');
      }
    }

    // Local Fallback (pure static hosting only)
    initLocalDatabase();
    const users = getLocalUsers();
    let user = users.find(u => u.email.toLowerCase() === cleanEmail);
    if (!user && cloudStaffRole) {
      user = { ...cloudStaffRole };
      users.push(user);
      saveLocalUsers(users);
    }

    if (cleanInviteToken) {
      const invites = getLocalInvitations();
      const inv = invites.find(i =>
        (i.tokenHash === cleanInviteToken || i.token === cleanInviteToken) &&
        i.email.toLowerCase() === cleanEmail &&
        i.status === 'pending'
      );
      if (!inv) {
        throw new Error('Invalid or expired staff invitation.');
      }
      if (new Date(inv.expiresAt).getTime() < Date.now()) {
        inv.status = 'expired';
        saveLocalInvitations(invites);
        throw new Error('This invitation has expired.');
      }

      if (user) {
        if (user.isSuspended) {
          throw new Error('This account has been suspended by administration.');
        }
        user.role = inv.role;
        user.assignedZone = inv.assignedZone;
        user.assignedFellowship = inv.assignedFellowship;
        user.name = payload.name || inv.name || user.name;
        user.isApproved = true;
        if (payload.avatar && !user.avatar) user.avatar = payload.avatar;
      } else {
        user = {
          id: `usr-staff-${Date.now()}`,
          email: cleanEmail,
          name: payload.name || inv.name || cleanEmail.split('@')[0],
          avatar: payload.avatar || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(cleanEmail)}`,
          role: inv.role,
          assignedZone: inv.assignedZone,
          assignedFellowship: inv.assignedFellowship,
          isApproved: true,
          authProvider: 'google',
          createdAt: new Date().toISOString()
        };
        users.push(user);
      }
      saveLocalUsers(users);
      inv.status = 'accepted';
      inv.usedAt = new Date().toISOString();
      saveLocalInvitations(invites);
    } else if (cleanEmail === 'fawany@gmail.com') {
      if (!user) {
        user = {
          id: 'usr-admin-1',
          email: 'fawany@gmail.com',
          name: 'Fawany (Administrator)',
          role: 'super_admin',
          isApproved: true,
          avatar: payload.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
          authProvider: 'google',
          phone: '0723 102273',
          createdAt: '2026-01-01T00:00:00.000Z'
        };
        users.push(user);
        saveLocalUsers(users);
      } else {
        user.role = 'super_admin';
        saveLocalUsers(users);
      }
    } else if (!user) {
      user = {
        id: `usr-parent-${Date.now()}`,
        email: cleanEmail,
        name: payload.name || cleanEmail.split('@')[0],
        avatar: payload.avatar || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(cleanEmail)}`,
        role: 'parent',
        isApproved: true,
        authProvider: 'google',
        createdAt: new Date().toISOString()
      };
      users.push(user);
      saveLocalUsers(users);
    }

    const nowIso = new Date().toISOString();
    user.lastLoginAt = nowIso;
    const usersToUpdate = getLocalUsers();
    const uIdx = usersToUpdate.findIndex(u => u.email.toLowerCase() === cleanEmail);
    if (uIdx >= 0) {
      usersToUpdate[uIdx].lastLoginAt = nowIso;
      saveLocalUsers(usersToUpdate);
    }

    const token = `dcu-token-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    setSessionToken(token);
    setCurrentLocalUser(user);

    addLocalAuditLog({
      eventType: 'AUTH_GOOGLE_LOGIN_SUCCESS',
      actorId: user.id,
      actorEmail: user.email,
      actorRole: user.role,
      outcome: 'SUCCESS'
    });

    return { user, token };
  },

  async acceptInvitation(payload: {
    token: string;
    email: string;
    password: string;
    name?: string;
    phone?: string;
  }): Promise<{ user: UserProfile; token: string }> {
    const cleanEmail = payload.email.toLowerCase().trim();
    const cleanToken = payload.token.trim();

    let receivedJson = false;
    try {
      const res = await fetch('/api/auth/accept-invitation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...payload, token: cleanToken, email: cleanEmail })
      });
      const contentType = res.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        receivedJson = true;
        if (!res.ok) {
          const err = await res.json().catch(() => ({ error: 'Failed to accept invitation' }));
          throw new Error(err.error || 'Failed to accept invitation');
        }
        isStaticHostingMode = false;
        const data = await res.json();
        if (isFirebaseStaffSignedIn()) {
          await updateOwnLastLoginInFirestore(cleanEmail, data.user?.name, data.user?.avatar).catch(() => {});
        }
        if (data.token) setSessionToken(data.token);
        if (data.credentialPassport) saveStoredCredentialPassport(cleanEmail, data.credentialPassport);
        setCurrentLocalUser(data.user);
        return data;
      } else if (isTrueStaticSpaFallback(res)) {
        isStaticHostingMode = true;
      } else {
        throw new Error(`Invitation activation server error (HTTP ${res.status}). Please try again.`);
      }
    } catch (err: any) {
      if (receivedJson || !isStaticHostingMode) {
        throw new Error(err?.message || 'Unable to reach the server to verify your invitation. Please try again.');
      }
    }

    // Local Fallback (pure static hosting only)
    initLocalDatabase();
    const invites = getLocalInvitations();
    const inv = invites.find(i =>
      (i.tokenHash === cleanToken || i.token === cleanToken) &&
      i.email.toLowerCase() === cleanEmail
    );
    if (!inv) {
      throw new Error('Invalid invitation token or email address.');
    }
    if (inv.status === 'revoked') {
      throw new Error('This invitation has been revoked by administration.');
    }
    if (inv.status === 'accepted' || inv.usedAt) {
      throw new Error('This invitation has already been used.');
    }
    if (new Date(inv.expiresAt).getTime() < Date.now()) {
      inv.status = 'expired';
      saveLocalInvitations(invites);
      throw new Error('This invitation has expired.');
    }

    const role: UserRole = inv.role;
    const assignedZone = inv.assignedZone;
    const assignedFellowship = inv.assignedFellowship;
    const nowIso = new Date().toISOString();

    const users = getLocalUsers();
    let user = users.find(u => u.email.toLowerCase() === cleanEmail);

    if (user) {
      user.role = role;
      user.assignedZone = assignedZone;
      user.assignedFellowship = assignedFellowship;
      user.name = payload.name?.trim() || inv.name || user.name;
      if (payload.phone?.trim()) user.phone = payload.phone.trim();
      user.password = payload.password;
      user.isApproved = true;
      user.isSuspended = false;
      user.lastLoginAt = nowIso;
    } else {
      user = {
        id: `usr-staff-${Date.now()}`,
        email: cleanEmail,
        name: payload.name?.trim() || inv.name || cleanEmail.split('@')[0],
        phone: payload.phone?.trim() || '',
        role,
        assignedZone,
        assignedFellowship,
        password: payload.password,
        isApproved: true,
        isSuspended: false,
        authProvider: 'email',
        createdAt: nowIso,
        lastLoginAt: nowIso
      };
      users.push(user);
    }
    saveLocalUsers(users);

    inv.status = 'accepted';
    inv.usedAt = nowIso;
    saveLocalInvitations(invites);

    const token = `dcu-token-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    setSessionToken(token);
    setCurrentLocalUser(user);

    return { user, token };
  },

  async verifyInvitation(token: string, email?: string): Promise<any> {
    const cleanToken = token.trim();
    const cleanEmail = email?.trim();

    let receivedJson = false;
    try {
      const query = new URLSearchParams({ token: cleanToken });
      if (cleanEmail) query.set('email', cleanEmail);
      const res = await fetch(`/api/auth/verify-invitation?${query.toString()}`);
      const contentType = res.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        receivedJson = true;
        if (!res.ok) {
          const err = await res.json().catch(() => ({ error: 'Invalid invitation' }));
          throw new Error(err.error || 'Invalid invitation');
        }
        isStaticHostingMode = false;
        return res.json();
      } else if (isTrueStaticSpaFallback(res)) {
        isStaticHostingMode = true;
      } else {
        throw new Error(`Invitation verification failed (HTTP ${res.status}). Please refresh and try again.`);
      }
    } catch (err: any) {
      if (receivedJson || !isStaticHostingMode) {
        throw new Error(err?.message || 'Unable to verify invitation right now.');
      }
    }

    // Local Fallback (pure static hosting only)
    const invites = getLocalInvitations();
    const inv = invites.find(i =>
      (i.tokenHash === cleanToken || i.token === cleanToken) &&
      i.status === 'pending' &&
      (!cleanEmail || i.email.toLowerCase() === cleanEmail.toLowerCase())
    );
    if (!inv) throw new Error('Invalid or expired invitation token.');
    if (new Date(inv.expiresAt).getTime() < Date.now()) {
      inv.status = 'expired';
      saveLocalInvitations(invites);
      throw new Error('This invitation has expired.');
    }
    return inv;
  },

  async getMe(): Promise<UserProfile> {
    const currentLocal = getCurrentLocalUser();
    const token = getSessionToken();

    if (token && token.startsWith('dcu-firebase-') && isFirebaseStaffSignedIn() && auth.currentUser?.email) {
      const fbEmail = auth.currentUser.email.toLowerCase().trim();
      const cloudRole = await fetchStaffRoleByEmail(fbEmail);
      if (cloudRole) {
        if (cloudRole.isSuspended) {
          setSessionToken(null);
          setCurrentLocalUser(null);
          throw new Error('This account has been suspended by administration.');
        }
        const lastTs = cloudRole.lastLoginAt ? new Date(cloudRole.lastLoginAt).getTime() : 0;
        if (!lastTs || Number.isNaN(lastTs) || Date.now() - lastTs > 5 * 60 * 1000) {
          const stamped = await updateOwnLastLoginInFirestore(
            fbEmail,
            auth.currentUser.displayName || cloudRole.name,
            auth.currentUser.photoURL || cloudRole.avatar
          );
          if (stamped) {
            cloudRole.lastLoginAt = new Date().toISOString();
          }
        }
        setCurrentLocalUser(cloudRole);
        return cloudRole;
      }
      if (currentLocal && currentLocal.email.toLowerCase().trim() === fbEmail) {
        return currentLocal;
      }
    }

    let receivedJson = false;
    try {
      const res = await fetch('/api/auth/me', {
        headers: getAuthHeaders()
      });
      const contentType = res.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        receivedJson = true;
        if (!res.ok) {
          // If Firebase Auth still verifies this staff member in Firestore, keep their cloud session alive
          if (isFirebaseStaffSignedIn() && auth.currentUser?.email) {
            const fbEmail = auth.currentUser.email.toLowerCase().trim();
            const cloudRole = await fetchStaffRoleByEmail(fbEmail);
            if (cloudRole && !cloudRole.isSuspended) {
              const lastTs = cloudRole.lastLoginAt ? new Date(cloudRole.lastLoginAt).getTime() : 0;
              if (!lastTs || Number.isNaN(lastTs) || Date.now() - lastTs > 5 * 60 * 1000) {
                const stamped = await updateOwnLastLoginInFirestore(
                  fbEmail,
                  auth.currentUser.displayName || cloudRole.name,
                  auth.currentUser.photoURL || cloudRole.avatar
                );
                if (stamped) {
                  cloudRole.lastLoginAt = new Date().toISOString();
                }
              }
              setCurrentLocalUser(cloudRole);
              return cloudRole;
            }
          }
          setSessionToken(null);
          setCurrentLocalUser(null);
          throw new Error('Not authenticated');
        }
        isStaticHostingMode = false;
        const data = await res.json();
        setCurrentLocalUser(data);
        return data;
      } else if (isTrueStaticSpaFallback(res)) {
        isStaticHostingMode = true;
      }
    } catch {
      if (receivedJson) throw new Error('Not authenticated');
      if (currentLocal) return currentLocal;
      throw new Error('Not authenticated');
    }

    if (currentLocal) return currentLocal;
    throw new Error('Not authenticated');
  },

  async logout(): Promise<void> {
    try {
      if (!isStaticHostingMode) {
        await fetch('/api/auth/logout', {
          method: 'POST',
          headers: getAuthHeaders()
        }).catch(() => {});
      }
    } finally {
      setSessionToken(null);
      setCurrentLocalUser(null);
    }
  },

  async bootstrapAdmin(payload: {
    bootstrapSecret: string;
    email: string;
    password: string;
    name?: string;
  }): Promise<{ user: UserProfile; token: string }> {
    const cleanEmail = payload.email.toLowerCase().trim();

    if (!isStaticHostingMode) {
      let receivedJson = false;
      try {
        const res = await fetch('/api/security/bootstrap-admin', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...payload, email: cleanEmail })
        });
        const contentType = res.headers.get('content-type') || '';
        if (contentType.includes('application/json')) {
          receivedJson = true;
          if (!res.ok) {
            const err = await res.json().catch(() => ({ error: 'Bootstrap failed' }));
            throw new Error(err.error || 'Bootstrap failed');
          }
          const data = await res.json();
          if (data.token) setSessionToken(data.token);
          setCurrentLocalUser(data.user);
          return data;
        } else {
          isStaticHostingMode = true;
        }
      } catch (err: any) {
        if (receivedJson) throw err;
        throw new Error(err?.message || 'Unable to reach the server.');
      }
    }

    // Local Fallback
    initLocalDatabase();
    const users = getLocalUsers();
    let superAdmin = users.find(u => u.email.toLowerCase() === cleanEmail);

    if (superAdmin) {
      superAdmin.role = 'super_admin';
      superAdmin.password = payload.password;
      superAdmin.name = payload.name?.trim() || superAdmin.name;
    } else {
      superAdmin = {
        id: `usr-superadmin-${Date.now()}`,
        email: cleanEmail,
        name: payload.name?.trim() || 'Primary Super Administrator',
        role: 'super_admin',
        password: payload.password,
        isApproved: true,
        authProvider: 'email',
        createdAt: new Date().toISOString()
      };
      users.push(superAdmin);
    }
    saveLocalUsers(users);

    const token = `dcu-token-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    setSessionToken(token);
    setCurrentLocalUser(superAdmin);

    addLocalAuditLog({
      eventType: 'INITIAL_SUPERADMIN_PROVISIONED',
      actorId: superAdmin.id,
      actorEmail: superAdmin.email,
      actorRole: 'super_admin',
      outcome: 'SUCCESS'
    });

    return { user: superAdmin, token };
  },

  // ==========================================
  // DEDICATIONS DATA
  // ==========================================

  async getDedications(): Promise<DedicationRecord[]> {
    const currentUser = await resolveActiveStaffUser();
    const deletedIds = getDeletedDedicationIds();
    const seedIds = new Set(INITIAL_DEDICATIONS.map((d) => d.id));

    let cloudList: DedicationRecord[] = [];
    let cloudFetchOk = false;
    if (currentUser && isFirebaseStaffSignedIn() && currentUser.role !== 'parent') {
      try {
        cloudList = await fetchDedicationsFromFirestore(currentUser);
        cloudFetchOk = true;
      } catch (e) {
        console.warn('Firestore fetch dedications notice:', e);
      }
    }

    let serverList: DedicationRecord[] = [];
    if (!isStaticHostingMode) {
      let receivedJson = false;
      try {
        const res = await fetch('/api/dedications', {
          headers: getAuthHeaders()
        });
        const contentType = res.headers.get('content-type') || '';
        if (contentType.includes('application/json')) {
          receivedJson = true;
          if (res.ok) {
            serverList = await res.json();
          }
        } else {
          isStaticHostingMode = true;
        }
      } catch (err: any) {
        if (receivedJson && !cloudFetchOk) throw err;
      }
    } else if (currentUser) {
      const all = getLocalDedications();
      const role = currentUser.role;
      if (role === 'super_admin' || role === 'office_admin' || role === 'pastor' || (role as string) === 'admin') {
        serverList = all;
      } else if (role === 'fellowship_leader' && currentUser.assignedZone) {
        let filtered = all.filter(d => d.selectedZone === currentUser.assignedZone);
        if (currentUser.assignedFellowship) {
          const tf = currentUser.assignedFellowship.toLowerCase().trim();
          filtered = filtered.filter(d => (d.selectedFellowship || '').toLowerCase().trim() === tf);
        }
        serverList = filtered;
      }
    }

    if (cloudFetchOk) {
      const mergedMap = new Map<string, DedicationRecord>();
      // Only include non-seed server items that weren't deleted; Firestore is authoritative for seeded & cloud docs
      for (const item of serverList) {
        if (!deletedIds.has(item.id) && !seedIds.has(item.id)) {
          mergedMap.set(item.id, item);
        }
      }
      for (const item of cloudList) {
        if (!deletedIds.has(item.id)) {
          mergedMap.set(item.id, item);
        }
      }
      const merged = Array.from(mergedMap.values()).sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
      saveLocalDedications(merged);
      return merged;
    }

    const filteredServer = serverList.filter((item) => !deletedIds.has(item.id));
    if (filteredServer.length > 0) {
      saveLocalDedications(filteredServer);
      return filteredServer;
    }

    return [];
  },

  async createDedication(record: Partial<DedicationRecord>): Promise<DedicationRecord> {
    const uniqueId = record.id && /^[a-zA-Z0-9_\-]{3,128}$/.test(record.id)
      ? record.id
      : generateUniqueDedicationId();
    clearDedicationDeleted(uniqueId);
    const recordWithId: Partial<DedicationRecord> = {
      ...record,
      id: uniqueId,
    };

    // 1. Primary persistent cloud write to Firestore (works cross-device across Vercel & AI Studio)
    let cloudCreated: DedicationRecord | null = null;
    try {
      cloudCreated = await submitDedicationToFirestore(recordWithId);
    } catch (cloudErr) {
      console.warn('Firestore direct submission fallback to server API:', cloudErr);
    }

    // 2. Mirror to Express/Vercel backend API when available
    let serverCreated: DedicationRecord | null = null;
    if (!isStaticHostingMode) {
      try {
        const res = await fetch('/api/dedications', {
          method: 'POST',
          headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
          body: JSON.stringify(recordWithId)
        });
        const contentType = res.headers.get('content-type') || '';
        if (contentType.includes('application/json')) {
          if (res.ok) {
            serverCreated = await res.json();
          } else if (!cloudCreated) {
            const err = await res.json().catch(() => ({ error: 'Failed to create record' }));
            throw new Error(err.error || 'Submission failed');
          }
        } else {
          isStaticHostingMode = true;
        }
      } catch (err: any) {
        if (!cloudCreated) {
          throw new Error(err?.message || 'Unable to submit registration right now. Please try again.');
        }
      }
    }

    const finalRecord = cloudCreated || serverCreated;
    if (finalRecord) {
      const all = getLocalDedications();
      saveLocalDedications([
        finalRecord,
        ...all.filter(
          (d) =>
            !(
              d.id === finalRecord.id &&
              d.childName.toLowerCase().trim() === finalRecord.childName.toLowerCase().trim()
            )
        ),
      ]);
      return finalRecord;
    }

    // 3. Pure offline fallback
    const newRecord: DedicationRecord = {
      id: uniqueId,
      childName: record.childName || 'Unnamed Child',
      childDob: record.childDob || '',
      childGender: record.childGender || 'Male',
      childCountyOfBirth: record.childCountyOfBirth || 'Nairobi',
      childPlaceOfBirth: record.childPlaceOfBirth || '',
      fatherName: record.fatherName || '',
      fatherPhone: record.fatherPhone || '',
      fatherEmail: record.fatherEmail || '',
      motherName: record.motherName || '',
      motherPhone: record.motherPhone || '',
      motherEmail: record.motherEmail || '',
      parentName: record.parentName || `${record.fatherName || ''} & ${record.motherName || ''}`.trim(),
      parentPhone: record.parentPhone || record.fatherPhone || record.motherPhone || '',
      parentEmail: record.parentEmail || record.fatherEmail || record.motherEmail || '',
      parentRelationship: record.parentRelationship || 'Parents',
      isInFellowship: record.isInFellowship ?? false,
      selectedZone: record.selectedZone || 'Zone A',
      selectedFellowship: record.selectedFellowship || 'General',
      residentialLocation: record.residentialLocation || '',
      dataConsent: record.dataConsent ?? true,
      status: 'submitted',
      leadershipConfirmed: false,
      officeApproved: false,
      certificateIssued: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      ...record,
    };
    const all = getLocalDedications();
    all.unshift(newRecord);
    saveLocalDedications(all);
    addLocalAuditLog({
      eventType: 'DEDICATION_CREATED',
      targetId: newRecord.id,
      outcome: 'SUCCESS',
      details: { childName: newRecord.childName, zone: newRecord.selectedZone }
    });
    return newRecord;
  },

  async trackDedications(id: string, phone?: string): Promise<any[]> {
    // Ensure any device-cached submissions are synced cleanly before lookup
    await syncLocalSubmissionsToFirestore().catch(() => 0);

    const combined = new Map<string, any>();

    // 1. Query persistent cloud Firestore status projection
    try {
      const cloudMatches = await trackDedicationsInFirestore(id, phone);
      for (const m of cloudMatches) {
        combined.set(`${m.id}::${String(m.childName || '').toLowerCase()}`, m);
      }
    } catch (e) {
      console.warn('Firestore tracking lookup notice:', e);
    }

    // 2. Also query backend API (for AI Studio local JSON or server records)
    if (!isStaticHostingMode) {
      try {
        const query = new URLSearchParams({ id });
        if (phone) query.set('phone', phone);
        const res = await fetch(`/api/dedications/track?${query.toString()}`);
        const contentType = res.headers.get('content-type') || '';
        if (contentType.includes('application/json')) {
          if (res.ok) {
            const payload = await res.json();
            const list = Array.isArray(payload.matches) ? payload.matches : [payload];
            for (const m of list) {
              const key = `${m.id}::${String(m.childName || '').toLowerCase()}`;
              if (!combined.has(key)) combined.set(key, m);
            }
          }
        } else {
          isStaticHostingMode = true;
        }
      } catch {
        // Firestore result suffices if server unreachable
      }
    }

    // 3. Local device storage fallback if still empty
    if (combined.size === 0) {
      const all = getLocalDedications();
      const cleanQuery = id.trim().toLowerCase();
      const cleanDigits = (phone || id).replace(/[^\d]/g, '');
      const localMatches = all.filter((d) =>
        d.id.toLowerCase() === cleanQuery ||
        (d.certificateNumber && d.certificateNumber.toLowerCase() === cleanQuery) ||
        d.childName.toLowerCase().includes(cleanQuery) ||
        (cleanDigits.length >= 7 && (
          (d.fatherPhone || '').replace(/[^\d]/g, '').includes(cleanDigits) ||
          (d.motherPhone || '').replace(/[^\d]/g, '').includes(cleanDigits) ||
          (d.parentPhone || '').replace(/[^\d]/g, '').includes(cleanDigits)
        ))
      );
      for (const m of localMatches) {
        combined.set(`${m.id}::${m.childName.toLowerCase()}`, m);
      }
    }

    const results = Array.from(combined.values()).sort(
      (a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
    );
    if (results.length === 0) {
      throw new Error('Dedication record not found. Please verify your Reference ID, Child Name, or Phone Number.');
    }
    return results;
  },

  async trackDedication(id: string, phone?: string): Promise<any> {
    const matches = await this.trackDedications(id, phone);
    return matches[0];
  },

  async updateDedication(id: string, updates: Partial<DedicationRecord>): Promise<DedicationRecord> {
    const currentUser = await resolveActiveStaffUser();
    const allLocal = getLocalDedications();
    const existingLocal = allLocal.find((d) => d.id === id);

    if (currentUser && isFirebaseStaffSignedIn()) {
      await updateDedicationInFirestore(id, updates, currentUser, existingLocal);
    }

    let serverUpdated: DedicationRecord | null = null;
    if (!isStaticHostingMode) {
      let receivedJson = false;
      try {
        const res = await fetch(`/api/dedications/${id}`, {
          method: 'PUT',
          headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
          body: JSON.stringify(updates)
        });
        const contentType = res.headers.get('content-type') || '';
        if (contentType.includes('application/json')) {
          receivedJson = true;
          if (res.ok) {
            serverUpdated = await res.json();
          } else if (!isFirebaseStaffSignedIn()) {
            const err = await res.json().catch(() => ({ error: 'Update failed' }));
            throw new Error(err.error || 'Failed to update record');
          }
        } else {
          isStaticHostingMode = true;
        }
      } catch (err: any) {
        if (receivedJson && !isFirebaseStaffSignedIn()) throw err;
        if (!isFirebaseStaffSignedIn()) {
          throw new Error(err?.message || 'Unable to update dedication right now.');
        }
      }
    }

    if (serverUpdated) {
      const updatedAll = allLocal.some((d) => d.id === id)
        ? allLocal.map((d) => (d.id === id ? serverUpdated! : d))
        : [serverUpdated, ...allLocal];
      saveLocalDedications(updatedAll);
      return serverUpdated;
    }

    const idx = allLocal.findIndex((d) => d.id === id);
    if (idx !== -1) {
      allLocal[idx] = { ...allLocal[idx], ...updates, updatedAt: new Date().toISOString() };
      saveLocalDedications(allLocal);
      return allLocal[idx];
    }

    return {
      ...(existingLocal || ({ id } as DedicationRecord)),
      ...updates,
      updatedAt: new Date().toISOString(),
    } as DedicationRecord;
  },

  async deleteDedication(id: string): Promise<boolean> {
    let cloudDeleted = false;
    if (isFirebaseStaffSignedIn()) {
      await deleteDedicationInFirestore(id);
      cloudDeleted = true;
    }

    if (!isStaticHostingMode) {
      let receivedJson = false;
      try {
        const res = await fetch(`/api/dedications/${encodeURIComponent(id)}`, {
          method: 'DELETE',
          headers: getAuthHeaders()
        });
        const contentType = res.headers.get('content-type') || '';
        if (contentType.includes('application/json')) {
          receivedJson = true;
          if (!res.ok && res.status !== 404 && !cloudDeleted) {
            const err = await res.json().catch(() => ({ error: 'Delete failed' }));
            throw new Error(err.error || 'Failed to delete record');
          }
        } else {
          isStaticHostingMode = true;
        }
      } catch (err: any) {
        if (receivedJson && !cloudDeleted) throw err;
      }
    }

    markDedicationDeleted(id);

    let all = getLocalDedications();
    all = all.filter(d => d.id !== id);
    saveLocalDedications(all);

    try {
      const recent = JSON.parse(localStorage.getItem('dcu_parent_recent_submissions') || '[]');
      if (Array.isArray(recent)) {
        localStorage.setItem(
          'dcu_parent_recent_submissions',
          JSON.stringify(recent.filter((r: any) => r.id !== id))
        );
      }
    } catch {
      // ignore
    }

    addLocalAuditLog({
      eventType: 'DEDICATION_DELETED',
      targetId: id,
      outcome: 'SUCCESS'
    });

    return true;
  },

  async bulkImport(records: any[]): Promise<{ count: number; total: number }> {
    if (isFirebaseStaffSignedIn()) {
      await adminUpsertDedicationsBatch(records);
    }

    if (!isStaticHostingMode) {
      let receivedJson = false;
      try {
        const res = await fetch('/api/dedications/bulk-import', {
          method: 'POST',
          headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
          body: JSON.stringify(records)
        });
        const contentType = res.headers.get('content-type') || '';
        if (contentType.includes('application/json')) {
          receivedJson = true;
          if (!res.ok) {
            const err = await res.json().catch(() => ({ error: 'Bulk import failed' }));
            throw new Error(err.error || 'Bulk import failed');
          }
          return res.json();
        } else {
          isStaticHostingMode = true;
        }
      } catch (err: any) {
        if (receivedJson) throw err;
        if (!isFirebaseStaffSignedIn()) {
          throw new Error(err?.message || 'Unable to import records right now.');
        }
      }
    }

    // Local Fallback
    const all = getLocalDedications();
    all.unshift(...records);
    saveLocalDedications(all);
    return { count: records.length, total: all.length };
  },

  // ==========================================
  // PAST / HISTORICAL DEDICATIONS (2009+)
  // ==========================================

  async getPastDedications(): Promise<PastDedicationRecord[]> {
    const current = await resolveActiveStaffUser();
    let cloudList: PastDedicationRecord[] = [];
    if (current && isFirebaseStaffSignedIn() && current.role !== 'fellowship_leader' && current.role !== 'parent') {
      try {
        cloudList = await fetchPastDedicationsFromFirestore();
      } catch (e) {
        console.warn('Firestore fetch past dedications notice:', e);
      }
    }

    let serverList: PastDedicationRecord[] = [];
    if (!isStaticHostingMode) {
      let receivedJson = false;
      try {
        const res = await fetch('/api/past-dedications', {
          headers: getAuthHeaders()
        });
        const contentType = res.headers.get('content-type') || '';
        if (contentType.includes('application/json')) {
          receivedJson = true;
          if (res.ok) {
            serverList = await res.json();
          }
        } else {
          isStaticHostingMode = true;
        }
      } catch {
        if (receivedJson && cloudList.length === 0) return [];
      }
    } else if (current && current.role !== 'fellowship_leader' && current.role !== 'parent') {
      serverList = getLocalPastDedications();
    }

    if (cloudList.length > 0) {
      const mergedMap = new Map<string, PastDedicationRecord>();
      for (const p of serverList) mergedMap.set(p.id, p);
      for (const p of cloudList) mergedMap.set(p.id, p);
      const merged = Array.from(mergedMap.values()).sort((a, b) => (b.dedicationYear || 0) - (a.dedicationYear || 0));
      saveLocalPastDedications(merged);
      return merged;
    }

    if (serverList.length > 0) {
      saveLocalPastDedications(serverList);
      return serverList;
    }

    return [];
  },

  async createPastDedication(record: Partial<PastDedicationRecord>): Promise<PastDedicationRecord> {
    const generatedId = record.id && /^[a-zA-Z0-9_\-]{3,128}$/.test(record.id)
      ? record.id
      : `PAST-${Date.now()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
    const recordWithId: Partial<PastDedicationRecord> & { id: string } = {
      ...record,
      id: generatedId,
    };

    let cloudSaved = false;
    if (isFirebaseStaffSignedIn()) {
      await createPastDedicationInFirestore(recordWithId);
      cloudSaved = true;
    }

    if (!isStaticHostingMode) {
      let receivedJson = false;
      try {
        const res = await fetch('/api/past-dedications', {
          method: 'POST',
          headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
          body: JSON.stringify(recordWithId)
        });
        const contentType = res.headers.get('content-type') || '';
        if (contentType.includes('application/json')) {
          receivedJson = true;
          if (res.ok) {
            const created = await res.json();
            const all = getLocalPastDedications();
            saveLocalPastDedications([created, ...all.filter(d => d.id !== created.id)]);
            return created;
          } else if (!cloudSaved) {
            const err = await res.json().catch(() => ({ error: 'Failed to create past record' }));
            throw new Error(err.error || 'Failed to create past record');
          }
        } else {
          isStaticHostingMode = true;
        }
      } catch (err: any) {
        if (receivedJson && !cloudSaved) throw err;
        if (!cloudSaved) {
          throw new Error(err?.message || 'Unable to save archive record right now.');
        }
      }
    }

    // Local / Cloud Fallback
    const all = getLocalPastDedications();
    const newRecord: PastDedicationRecord = {
      id: generatedId,
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
      selectedZone: record.selectedZone || '',
      selectedFellowship: record.selectedFellowship || '',
      dedicationYear: record.dedicationYear || 2020,
      serviceDate: record.serviceDate || '2020-01-01',
      certificateNumber: record.certificateNumber || `DCU-HIST-${Math.floor(1000 + Math.random() * 9000)}`,
      certificateIssued: record.certificateIssued ?? true,
      officiatingMinister: record.officiatingMinister || 'Senior Pastor',
      notes: record.notes || '',
      archivalSource: record.archivalSource || 'Historical Register',
      createdAt: new Date().toISOString()
    };

    saveLocalPastDedications([newRecord, ...all.filter(d => d.id !== newRecord.id)]);
    return newRecord;
  },

  async bulkImportPastDedications(records: any[], options?: { replaceYear?: number; replaceAll?: boolean }): Promise<{ success: boolean; count: number }> {
    const normalizedRecords = records.map((r, idx) => ({
      ...r,
      id: r.id && /^[a-zA-Z0-9_\-]{3,128}$/.test(r.id)
        ? r.id
        : `PAST-${Date.now()}-${idx}-${Math.random().toString(36).slice(2, 5).toUpperCase()}`,
    }));

    let cloudSaved = false;
    if (isFirebaseStaffSignedIn()) {
      if (options?.replaceAll || options?.replaceYear) {
        const existingCloud = await fetchPastDedicationsFromFirestore().catch(() => []);
        const toDelete = options.replaceAll
          ? existingCloud
          : existingCloud.filter((p) => p.dedicationYear === options.replaceYear);
        for (const item of toDelete) {
          await deletePastDedicationInFirestore(item.id).catch(() => {});
        }
      }
      for (const rec of normalizedRecords) {
        await createPastDedicationInFirestore(rec);
      }
      cloudSaved = true;
    }

    if (!isStaticHostingMode) {
      let receivedJson = false;
      try {
        const payload = options ? { records: normalizedRecords, replaceYear: options.replaceYear, replaceAll: options.replaceAll } : normalizedRecords;
        const res = await fetch('/api/past-dedications/bulk-import', {
          method: 'POST',
          headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
          body: JSON.stringify(payload)
        });
        const contentType = res.headers.get('content-type') || '';
        if (contentType.includes('application/json')) {
          receivedJson = true;
          if (res.ok) {
            return res.json();
          } else if (!cloudSaved) {
            const err = await res.json().catch(() => ({ error: 'Bulk import failed' }));
            throw new Error(err.error || 'Bulk import failed');
          }
        } else {
          isStaticHostingMode = true;
        }
      } catch (err: any) {
        if (receivedJson && !cloudSaved) throw err;
        if (!cloudSaved) {
          throw new Error(err?.message || 'Unable to bulk import past dedications right now.');
        }
      }
    }

    // Local / Cloud Fallback
    let all = getLocalPastDedications();
    if (options?.replaceAll) {
      all = normalizedRecords;
    } else if (options?.replaceYear) {
      all = [...normalizedRecords, ...all.filter(d => d.dedicationYear !== options.replaceYear)];
    } else {
      all.unshift(...normalizedRecords);
    }
    saveLocalPastDedications(all);
    return { success: true, count: normalizedRecords.length };
  },

  async updatePastDedication(id: string, updates: Partial<PastDedicationRecord>): Promise<PastDedicationRecord> {
    let cloudSaved = false;
    if (isFirebaseStaffSignedIn()) {
      await updatePastDedicationInFirestore(id, updates);
      cloudSaved = true;
    }

    if (!isStaticHostingMode) {
      let receivedJson = false;
      try {
        const res = await fetch(`/api/past-dedications/${id}`, {
          method: 'PUT',
          headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
          body: JSON.stringify(updates)
        });
        const contentType = res.headers.get('content-type') || '';
        if (contentType.includes('application/json')) {
          receivedJson = true;
          if (res.ok) {
            const updated = await res.json();
            const all = getLocalPastDedications();
            saveLocalPastDedications(all.map(d => (d.id === id ? updated : d)));
            return updated;
          } else if (!cloudSaved) {
            const err = await res.json().catch(() => ({ error: 'Failed to update record' }));
            throw new Error(err.error || 'Failed to update record');
          }
        } else {
          isStaticHostingMode = true;
        }
      } catch (err: any) {
        if (receivedJson && !cloudSaved) throw err;
        if (!cloudSaved) {
          throw new Error(err?.message || 'Unable to update archive record right now.');
        }
      }
    }

    // Local / Cloud Fallback
    const all = getLocalPastDedications();
    const idx = all.findIndex(d => d.id === id);
    if (idx !== -1) {
      all[idx] = { ...all[idx], ...updates };
      saveLocalPastDedications(all);
      return all[idx];
    }
    if (cloudSaved) {
      return { id, ...updates } as PastDedicationRecord;
    }
    throw new Error('Past dedication record not found.');
  },

  async deletePastDedication(id: string): Promise<boolean> {
    let cloudDeleted = false;
    if (isFirebaseStaffSignedIn()) {
      await deletePastDedicationInFirestore(id);
      cloudDeleted = true;
    }

    if (!isStaticHostingMode) {
      let receivedJson = false;
      try {
        const res = await fetch(`/api/past-dedications/${id}`, {
          method: 'DELETE',
          headers: getAuthHeaders()
        });
        const contentType = res.headers.get('content-type') || '';
        if (contentType.includes('application/json')) {
          receivedJson = true;
          if (!res.ok && !cloudDeleted) {
            const err = await res.json().catch(() => ({ error: 'Delete failed' }));
            throw new Error(err.error || 'Delete failed');
          }
          const all = getLocalPastDedications().filter(d => d.id !== id);
          saveLocalPastDedications(all);
          return true;
        } else {
          isStaticHostingMode = true;
        }
      } catch (err: any) {
        if (receivedJson && !cloudDeleted) throw err;
        if (!cloudDeleted) {
          throw new Error(err?.message || 'Unable to delete archive record right now.');
        }
      }
    }

    // Local / Cloud Fallback
    let all = getLocalPastDedications();
    all = all.filter(d => d.id !== id);
    saveLocalPastDedications(all);
    return true;
  },

  // ==========================================
  // STAFF & ROLE MANAGEMENT (Super Admin)
  // ==========================================

  async getUsers(): Promise<UserProfile[]> {
    const current = await resolveActiveStaffUser();
    let cloudUsers: UserProfile[] = [];
    if (current && isFirebaseStaffSignedIn() && (current.role === 'super_admin' || current.role === 'office_admin' || (current.role as string) === 'admin')) {
      try {
        cloudUsers = await fetchStaffRolesFromFirestore();
      } catch (e) {
        console.warn('Firestore fetch staff_roles notice:', e);
      }
    }

    let serverUsers: UserProfile[] = [];
    if (!isStaticHostingMode) {
      let receivedJson = false;
      try {
        const res = await fetch('/api/users', {
          headers: getAuthHeaders()
        });
        const contentType = res.headers.get('content-type') || '';
        if (contentType.includes('application/json')) {
          receivedJson = true;
          if (res.ok) {
            serverUsers = await res.json();
          }
        } else {
          isStaticHostingMode = true;
        }
      } catch {
        if (receivedJson && cloudUsers.length === 0) return [];
      }
    } else {
      serverUsers = getLocalUsers().map(({ password, ...u }) => u);
    }

    const mergedMap = new Map<string, UserProfile>();
    for (const u of serverUsers) mergedMap.set(u.email.toLowerCase(), u);
    for (const cu of cloudUsers) {
      const prev = mergedMap.get(cu.email.toLowerCase());
      const cuTs = cu.lastLoginAt ? new Date(cu.lastLoginAt).getTime() : 0;
      const prevTs = prev?.lastLoginAt ? new Date(prev.lastLoginAt).getTime() : 0;
      const newestLogin =
        cuTs >= prevTs ? (cu.lastLoginAt || prev?.lastLoginAt) : (prev?.lastLoginAt || cu.lastLoginAt);
      mergedMap.set(cu.email.toLowerCase(), {
        ...prev,
        ...cu,
        lastLoginAt: newestLogin,
      });
    }

    const finalUsers = Array.from(mergedMap.values()).map((u) => {
      if (current && (current.id === u.id || current.email.toLowerCase() === u.email.toLowerCase())) {
        return {
          ...u,
          lastLoginAt: current.lastLoginAt || u.lastLoginAt || new Date().toISOString()
        };
      }
      return u;
    });
    saveLocalUsers(finalUsers);
    return finalUsers;
  },

  async inviteStaff(payload: {
    email: string;
    name?: string;
    role: 'super_admin' | 'office_admin' | 'pastor' | 'fellowship_leader';
    assignedZone?: 'Zone A' | 'Zone B' | 'Zone C' | 'Zone D' | 'Zone E';
    assignedFellowship?: string;
  }): Promise<{ invitation: StaffInvitation; rawToken: string; inviteUrl: string }> {
    const res = await fetch('/api/users/invite', {
      method: 'POST',
      headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(payload)
    });
    const contentType = res.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
      throw new Error(
        `Cannot issue cross-device staff invitation because the server API (/api/users/invite) returned HTTP ${res.status} (${contentType || 'non-JSON'}). Please verify the backend API is deployed and try again.`
      );
    }
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Failed to issue invitation' }));
      throw new Error(err.error || 'Failed to issue invitation');
    }
    isStaticHostingMode = false;
    const data = await res.json();
    if (!data?.rawToken || !String(data.rawToken).startsWith('DCUINV1.')) {
      throw new Error('Server did not return a signed cross-device invitation token (DCUINV1). Please refresh and try again.');
    }
    if (typeof window !== 'undefined') {
      data.inviteUrl = `${window.location.origin}/?invite=${encodeURIComponent(data.rawToken)}&email=${encodeURIComponent(payload.email.toLowerCase().trim())}`;
    }

    // Immediately provision staff_roles & invitations in Firestore so the invited leader has cloud access on first sign-in
    if (isFirebaseStaffSignedIn()) {
      await Promise.all([
        saveInvitationToFirestore(data.invitation).catch((e) => console.warn('Invitation Firestore sync notice:', e)),
        syncStaffRoleToFirestore({
          id: `usr-staff-${payload.email.toLowerCase().trim()}`,
          email: payload.email.toLowerCase().trim(),
          name: payload.name?.trim() || payload.email.split('@')[0],
          role: payload.role,
          assignedZone: payload.assignedZone,
          assignedFellowship: payload.assignedFellowship,
          isApproved: true,
          isSuspended: false,
          authProvider: 'google',
        }).catch((e) => console.warn('Staff role pre-provision Firestore notice:', e)),
      ]);
    }

    return data;
  },

  async getInvitations(): Promise<StaffInvitation[]> {
    const current = await resolveActiveStaffUser();
    let cloudInvites: StaffInvitation[] = [];
    if (current && isFirebaseStaffSignedIn() && (current.role === 'super_admin' || (current.role as string) === 'admin')) {
      try {
        cloudInvites = await fetchInvitationsFromFirestore();
      } catch (e) {
        console.warn('Firestore fetch invitations notice:', e);
      }
    }

    let serverInvites: StaffInvitation[] = [];
    if (!isStaticHostingMode) {
      let receivedJson = false;
      try {
        const res = await fetch('/api/invitations', {
          headers: getAuthHeaders()
        });
        const contentType = res.headers.get('content-type') || '';
        if (contentType.includes('application/json')) {
          receivedJson = true;
          if (res.ok) {
            serverInvites = await res.json();
          }
        } else {
          isStaticHostingMode = true;
        }
      } catch {
        if (receivedJson && cloudInvites.length === 0) return [];
      }
    } else {
      serverInvites = getLocalInvitations();
    }

    if (cloudInvites.length > 0) {
      const mergedMap = new Map<string, StaffInvitation>();
      for (const inv of serverInvites) mergedMap.set(inv.id, inv);
      for (const inv of cloudInvites) mergedMap.set(inv.id, inv);
      return Array.from(mergedMap.values()).sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
    }
    return serverInvites;
  },

  async revokeInvitation(id: string): Promise<boolean> {
    const current = getCurrentLocalUser();
    if (current && isFirebaseStaffSignedIn()) {
      await revokeInvitationInFirestore(id, current.id).catch(() => {});
    }

    if (!isStaticHostingMode) {
      let receivedJson = false;
      try {
        const res = await fetch(`/api/invitations/${id}/revoke`, {
          method: 'POST',
          headers: getAuthHeaders()
        });
        const contentType = res.headers.get('content-type') || '';
        if (contentType.includes('application/json')) {
          receivedJson = true;
          if (!res.ok && !isFirebaseStaffSignedIn()) {
            const err = await res.json().catch(() => ({ error: 'Failed to revoke' }));
            throw new Error(err.error || 'Failed to revoke');
          }
          return true;
        } else {
          isStaticHostingMode = true;
        }
      } catch (err: any) {
        if (receivedJson && !isFirebaseStaffSignedIn()) throw err;
        if (!isFirebaseStaffSignedIn()) {
          throw new Error(err?.message || 'Unable to revoke invitation right now.');
        }
      }
    }

    let invites = getLocalInvitations();
    invites = invites.filter(i => i.id !== id);
    saveLocalInvitations(invites);
    return true;
  },

  async updateUserRole(id: string, role: string, assignedZone?: string, assignedFellowship?: string): Promise<UserProfile> {
    const localMatch = getLocalUsers().find((u) => u.id === id);
    if (localMatch && isFirebaseStaffSignedIn()) {
      await syncStaffRoleToFirestore({
        ...localMatch,
        role: role as UserRole,
        assignedZone: assignedZone as any,
        assignedFellowship,
      });
    }

    if (!isStaticHostingMode) {
      let receivedJson = false;
      try {
        const res = await fetch(`/api/users/${id}/role`, {
          method: 'PUT',
          headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
          body: JSON.stringify({ role, assignedZone, assignedFellowship })
        });
        const contentType = res.headers.get('content-type') || '';
        if (contentType.includes('application/json')) {
          receivedJson = true;
          if (res.ok) {
            return res.json();
          } else if (!isFirebaseStaffSignedIn()) {
            const err = await res.json().catch(() => ({ error: 'Failed to update user role' }));
            throw new Error(err.error || 'Failed to update user role');
          }
        } else {
          isStaticHostingMode = true;
        }
      } catch (err: any) {
        if (receivedJson && !isFirebaseStaffSignedIn()) throw err;
        if (!isFirebaseStaffSignedIn()) {
          throw new Error(err?.message || 'Unable to update user role right now.');
        }
      }
    }

    const users = getLocalUsers();
    const user = users.find(u => u.id === id);
    if (!user) throw new Error('User not found.');
    user.role = (role === 'admin' ? 'super_admin' : role) as UserRole;
    user.assignedZone = assignedZone as any;
    if (assignedFellowship !== undefined) {
      user.assignedFellowship = assignedFellowship;
    }
    saveLocalUsers(users);
    return user;
  },

  async updateUserStatus(id: string, isSuspended: boolean): Promise<UserProfile> {
    const localMatch = getLocalUsers().find((u) => u.id === id);
    if (localMatch && isFirebaseStaffSignedIn()) {
      await syncStaffRoleToFirestore({
        ...localMatch,
        isSuspended,
      });
    }

    if (!isStaticHostingMode) {
      let receivedJson = false;
      try {
        const res = await fetch(`/api/users/${id}/status`, {
          method: 'PUT',
          headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
          body: JSON.stringify({ isSuspended })
        });
        const contentType = res.headers.get('content-type') || '';
        if (contentType.includes('application/json')) {
          receivedJson = true;
          if (res.ok) {
            return res.json();
          } else if (!isFirebaseStaffSignedIn()) {
            const err = await res.json().catch(() => ({ error: 'Failed to update user status' }));
            throw new Error(err.error || 'Failed to update user status');
          }
        } else {
          isStaticHostingMode = true;
        }
      } catch (err: any) {
        if (receivedJson && !isFirebaseStaffSignedIn()) throw err;
        if (!isFirebaseStaffSignedIn()) {
          throw new Error(err?.message || 'Unable to update user status right now.');
        }
      }
    }

    const users = getLocalUsers();
    const user = users.find(u => u.id === id);
    if (!user) throw new Error('User not found.');
    user.isSuspended = isSuspended;
    saveLocalUsers(users);
    return user;
  },

  async deleteUser(id: string): Promise<boolean> {
    const localMatch = getLocalUsers().find((u) => u.id === id);
    if (localMatch && isFirebaseStaffSignedIn()) {
      await deleteStaffRoleFromFirestore(localMatch.email);
    }

    if (!isStaticHostingMode) {
      let receivedJson = false;
      try {
        const res = await fetch(`/api/users/${id}`, {
          method: 'DELETE',
          headers: getAuthHeaders()
        });
        const contentType = res.headers.get('content-type') || '';
        if (contentType.includes('application/json')) {
          receivedJson = true;
          if (!res.ok && !isFirebaseStaffSignedIn()) {
            const err = await res.json().catch(() => ({ error: 'Failed to delete user' }));
            throw new Error(err.error || 'Failed to delete user');
          }
          return true;
        } else {
          isStaticHostingMode = true;
        }
      } catch (err: any) {
        if (receivedJson && !isFirebaseStaffSignedIn()) throw err;
        if (!isFirebaseStaffSignedIn()) {
          throw new Error(err?.message || 'Unable to delete user right now.');
        }
      }
    }

    let users = getLocalUsers();
    users = users.filter(u => u.id !== id);
    saveLocalUsers(users);
    return true;
  },

  // ==========================================
  // AUDIT LOGS & EXPORT TRACKING
  // ==========================================

  async getAuditLogs(): Promise<AuditLog[]> {
    if (!isStaticHostingMode) {
      let receivedJson = false;
      try {
        const res = await fetch('/api/audit-logs', {
          headers: getAuthHeaders()
        });
        const contentType = res.headers.get('content-type') || '';
        if (contentType.includes('application/json')) {
          receivedJson = true;
          if (!res.ok) return [];
          return res.json();
        } else {
          isStaticHostingMode = true;
        }
      } catch {
        if (receivedJson) return [];
        return [];
      }
    }

    return getLocalAuditLogs();
  },

  async logExport(exportType: string, recordCount: number): Promise<void> {
    try {
      if (!isStaticHostingMode) {
        await fetch('/api/audit/log-export', {
          method: 'POST',
          headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
          body: JSON.stringify({ exportType, recordCount })
        }).catch(() => {});
      } else {
        addLocalAuditLog({
          eventType: 'DATA_EXPORT',
          details: { exportType, recordCount }
        });
      }
    } catch {
      // non-blocking
    }
  }
};
