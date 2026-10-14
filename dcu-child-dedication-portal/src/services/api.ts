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

const TOKEN_KEY = 'dcu_auth_session_token_v3';
const STORAGE_PREFIX = 'dcu_v2_';
const STORAGE_USERS = `${STORAGE_PREFIX}users`;
const STORAGE_DEDICATIONS = `${STORAGE_PREFIX}dedications`;
const STORAGE_PAST_DEDICATIONS = `${STORAGE_PREFIX}past_dedications`;
const STORAGE_INVITATIONS = `${STORAGE_PREFIX}invitations`;
const STORAGE_AUDIT_LOGS = `${STORAGE_PREFIX}audit_logs`;
const STORAGE_CURRENT_USER = `${STORAGE_PREFIX}current_user`;

let memoryToken: string | null = null;
let isStaticHostingMode = false;

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

function setCurrentLocalUser(user: UserProfile | null) {
  try {
    if (user) {
      localStorage.setItem(STORAGE_CURRENT_USER, JSON.stringify(user));
    } else {
      localStorage.removeItem(STORAGE_CURRENT_USER);
    }
  } catch {}
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

    if (!isStaticHostingMode) {
      try {
        const res = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: cleanEmail, password })
        });

        const contentType = res.headers.get('content-type') || '';
        if (contentType.includes('application/json')) {
          if (!res.ok) {
            const err = await res.json().catch(() => ({ error: 'Invalid credentials' }));
            throw new Error(err.error || 'Invalid credentials');
          }
          const data = await res.json();
          if (data.token) setSessionToken(data.token);
          setCurrentLocalUser(data.user);
          return data;
        } else {
          // Received HTML (Vercel static rewrite) - switch to local mode
          isStaticHostingMode = true;
        }
      } catch (err: any) {
        if (err.message && !err.message.includes('Unexpected token') && !err.message.includes('Invalid credentials')) {
          isStaticHostingMode = true;
        } else if (err.message && err.message.includes('Invalid credentials')) {
          throw err;
        } else {
          isStaticHostingMode = true;
        }
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
      
      // Accept either standard admin pass or direct 1-click
      if (password && password !== 'DcuAdmin2026!#' && password !== user.password) {
        throw new Error('Invalid email or password.');
      }
    } else {
      if (!user || (user.password && user.password !== password)) {
        throw new Error('Invalid email or password.');
      }
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
      try {
        const res = await fetch('/api/auth/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...data, email: cleanEmail, role: 'parent' })
        });
        const contentType = res.headers.get('content-type') || '';
        if (contentType.includes('application/json')) {
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
        if (err.message && !err.message.includes('Unexpected token')) throw err;
        isStaticHostingMode = true;
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

    if (!isStaticHostingMode) {
      try {
        const res = await fetch('/api/auth/google', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...payload, email: cleanEmail })
        });
        const contentType = res.headers.get('content-type') || '';
        if (contentType.includes('application/json')) {
          if (!res.ok) {
            const err = await res.json().catch(() => ({ error: 'Google authentication failed' }));
            throw new Error(err.error || 'Google authentication failed');
          }
          const data = await res.json();
          if (data.token) setSessionToken(data.token);
          setCurrentLocalUser(data.user);
          return data;
        } else {
          isStaticHostingMode = true;
        }
      } catch (err: any) {
        if (err.message && !err.message.includes('Unexpected token') && !err.message.includes('Google authentication failed')) {
          isStaticHostingMode = true;
        } else if (err.message && err.message.includes('Google authentication failed')) {
          isStaticHostingMode = true; // Fallback to local on Vercel
        } else {
          isStaticHostingMode = true;
        }
      }
    }

    // Local Fallback
    initLocalDatabase();
    const users = getLocalUsers();
    let user = users.find(u => u.email.toLowerCase() === cleanEmail);

    if (cleanEmail === 'fawany@gmail.com') {
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

    if (!isStaticHostingMode) {
      try {
        const res = await fetch('/api/auth/accept-invitation', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...payload, email: cleanEmail })
        });
        const contentType = res.headers.get('content-type') || '';
        if (contentType.includes('application/json')) {
          if (!res.ok) {
            const err = await res.json().catch(() => ({ error: 'Failed to accept invitation' }));
            throw new Error(err.error || 'Failed to accept invitation');
          }
          const data = await res.json();
          if (data.token) setSessionToken(data.token);
          setCurrentLocalUser(data.user);
          return data;
        } else {
          isStaticHostingMode = true;
        }
      } catch (err: any) {
        if (err.message && !err.message.includes('Unexpected token')) throw err;
        isStaticHostingMode = true;
      }
    }

    // Local Fallback
    initLocalDatabase();
    const invites = getLocalInvitations();
    const inv = invites.find(i => i.email.toLowerCase() === cleanEmail && i.status === 'pending');
    const role: UserRole = inv ? inv.role : 'fellowship_leader';
    const assignedZone = inv?.assignedZone;

    const users = getLocalUsers();
    let user = users.find(u => u.email.toLowerCase() === cleanEmail);

    if (user) {
      user.role = role;
      user.assignedZone = assignedZone;
      user.password = payload.password;
    } else {
      user = {
        id: `usr-staff-${Date.now()}`,
        email: cleanEmail,
        name: payload.name?.trim() || cleanEmail.split('@')[0],
        phone: payload.phone?.trim() || '',
        role,
        assignedZone,
        password: payload.password,
        isApproved: true,
        authProvider: 'email',
        createdAt: new Date().toISOString()
      };
      users.push(user);
    }
    saveLocalUsers(users);

    if (inv) {
      inv.status = 'accepted';
      inv.usedAt = new Date().toISOString();
      saveLocalInvitations(invites);
    }

    const token = `dcu-token-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    setSessionToken(token);
    setCurrentLocalUser(user);

    return { user, token };
  },

  async verifyInvitation(token: string, email?: string): Promise<any> {
    if (!isStaticHostingMode) {
      try {
        const query = new URLSearchParams({ token });
        if (email) query.set('email', email);
        const res = await fetch(`/api/auth/verify-invitation?${query.toString()}`);
        const contentType = res.headers.get('content-type') || '';
        if (contentType.includes('application/json')) {
          if (!res.ok) {
            const err = await res.json().catch(() => ({ error: 'Invalid invitation' }));
            throw new Error(err.error || 'Invalid invitation');
          }
          return res.json();
        } else {
          isStaticHostingMode = true;
        }
      } catch (err: any) {
        if (err.message && !err.message.includes('Unexpected token')) throw err;
        isStaticHostingMode = true;
      }
    }

    // Local Fallback
    const invites = getLocalInvitations();
    const inv = invites.find(i => i.status === 'pending');
    if (!inv) throw new Error('Invalid or expired invitation token.');
    return inv;
  },

  async getMe(): Promise<UserProfile> {
    const currentLocal = getCurrentLocalUser();

    if (!isStaticHostingMode) {
      try {
        const res = await fetch('/api/auth/me', {
          headers: getAuthHeaders()
        });
        const contentType = res.headers.get('content-type') || '';
        if (contentType.includes('application/json')) {
          if (!res.ok) throw new Error('Not authenticated');
          const data = await res.json();
          setCurrentLocalUser(data);
          return data;
        } else {
          isStaticHostingMode = true;
        }
      } catch (err: any) {
        if (currentLocal) return currentLocal;
        throw new Error('Not authenticated');
      }
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
      try {
        const res = await fetch('/api/security/bootstrap-admin', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...payload, email: cleanEmail })
        });
        const contentType = res.headers.get('content-type') || '';
        if (contentType.includes('application/json')) {
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
        if (err.message && !err.message.includes('Unexpected token')) throw err;
        isStaticHostingMode = true;
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
    if (!isStaticHostingMode) {
      try {
        const res = await fetch('/api/dedications', {
          headers: getAuthHeaders()
        });
        const contentType = res.headers.get('content-type') || '';
        if (contentType.includes('application/json')) {
          if (!res.ok) {
            if (res.status === 401) return [];
            throw new Error(`Failed to fetch dedications (${res.status})`);
          }
          const list = await res.json();
          saveLocalDedications(list);
          return list;
        } else {
          isStaticHostingMode = true;
        }
      } catch {
        isStaticHostingMode = true;
      }
    }

    // Local Fallback
    const user = getCurrentLocalUser();
    const all = getLocalDedications();
    if (!user) return [];

    const role = user.role;
    if (role === 'super_admin' || role === 'office_admin' || role === 'pastor' || (role as string) === 'admin') {
      return all;
    }
    if (role === 'fellowship_leader' && user.assignedZone) {
      return all.filter(d => d.selectedZone === user.assignedZone);
    }
    if (role === 'parent') {
      return all.filter(d => 
        (d.submittedBy && d.submittedBy.toLowerCase() === user.email.toLowerCase()) ||
        (d.parentEmail && d.parentEmail.toLowerCase() === user.email.toLowerCase())
      );
    }
    return all;
  },

  async createDedication(record: Partial<DedicationRecord>): Promise<DedicationRecord> {
    if (!isStaticHostingMode) {
      try {
        const res = await fetch('/api/dedications', {
          method: 'POST',
          headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
          body: JSON.stringify(record)
        });
        const contentType = res.headers.get('content-type') || '';
        if (contentType.includes('application/json')) {
          if (!res.ok) {
            const err = await res.json().catch(() => ({ error: 'Failed to create record' }));
            throw new Error(err.error || 'Submission failed');
          }
          return res.json();
        } else {
          isStaticHostingMode = true;
        }
      } catch (err: any) {
        if (err.message && !err.message.includes('Unexpected token')) throw err;
        isStaticHostingMode = true;
      }
    }

    // Local Fallback
    const all = getLocalDedications();
    const currentYear = new Date().getFullYear();
    const existingThisYear = all.filter(d => d.id.startsWith(`DED-${currentYear}`));
    const seq = String(existingThisYear.length + 1).padStart(3, '0');
    const newId = `DED-${currentYear}-${seq}`;

    const newRecord: DedicationRecord = {
      id: newId,
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
      ...record
    };

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

  async trackDedication(id: string, phone?: string): Promise<any> {
    if (!isStaticHostingMode) {
      try {
        const query = new URLSearchParams({ id });
        if (phone) query.set('phone', phone);
        const res = await fetch(`/api/dedications/track?${query.toString()}`);
        const contentType = res.headers.get('content-type') || '';
        if (contentType.includes('application/json')) {
          if (!res.ok) {
            const err = await res.json().catch(() => ({ error: 'Tracking failed' }));
            throw new Error(err.error || 'Record not found');
          }
          return res.json();
        } else {
          isStaticHostingMode = true;
        }
      } catch (err: any) {
        if (err.message && !err.message.includes('Unexpected token')) throw err;
        isStaticHostingMode = true;
      }
    }

    // Local Fallback
    const all = getLocalDedications();
    const cleanId = id.trim().toUpperCase();
    const found = all.find(d => 
      d.id.toUpperCase() === cleanId || 
      d.childName.toLowerCase().includes(id.toLowerCase())
    );
    if (!found) throw new Error('Dedication record not found.');
    return found;
  },

  async updateDedication(id: string, updates: Partial<DedicationRecord>): Promise<DedicationRecord> {
    if (!isStaticHostingMode) {
      try {
        const res = await fetch(`/api/dedications/${id}`, {
          method: 'PUT',
          headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
          body: JSON.stringify(updates)
        });
        const contentType = res.headers.get('content-type') || '';
        if (contentType.includes('application/json')) {
          if (!res.ok) {
            const err = await res.json().catch(() => ({ error: 'Update failed' }));
            throw new Error(err.error || 'Failed to update record');
          }
          return res.json();
        } else {
          isStaticHostingMode = true;
        }
      } catch (err: any) {
        if (err.message && !err.message.includes('Unexpected token')) throw err;
        isStaticHostingMode = true;
      }
    }

    // Local Fallback
    const all = getLocalDedications();
    const idx = all.findIndex(d => d.id === id);
    if (idx === -1) throw new Error('Record not found.');

    all[idx] = {
      ...all[idx],
      ...updates,
      updatedAt: new Date().toISOString()
    };
    saveLocalDedications(all);

    addLocalAuditLog({
      eventType: 'DEDICATION_UPDATED',
      targetId: id,
      outcome: 'SUCCESS',
      details: updates
    });

    return all[idx];
  },

  async deleteDedication(id: string): Promise<boolean> {
    if (!isStaticHostingMode) {
      try {
        const res = await fetch(`/api/dedications/${id}`, {
          method: 'DELETE',
          headers: getAuthHeaders()
        });
        const contentType = res.headers.get('content-type') || '';
        if (contentType.includes('application/json')) {
          if (!res.ok) {
            const err = await res.json().catch(() => ({ error: 'Delete failed' }));
            throw new Error(err.error || 'Failed to delete record');
          }
          return true;
        } else {
          isStaticHostingMode = true;
        }
      } catch (err: any) {
        if (err.message && !err.message.includes('Unexpected token')) throw err;
        isStaticHostingMode = true;
      }
    }

    // Local Fallback
    let all = getLocalDedications();
    all = all.filter(d => d.id !== id);
    saveLocalDedications(all);

    addLocalAuditLog({
      eventType: 'DEDICATION_DELETED',
      targetId: id,
      outcome: 'SUCCESS'
    });

    return true;
  },

  async bulkImport(records: any[]): Promise<{ count: number; total: number }> {
    if (!isStaticHostingMode) {
      try {
        const res = await fetch('/api/dedications/bulk-import', {
          method: 'POST',
          headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
          body: JSON.stringify(records)
        });
        const contentType = res.headers.get('content-type') || '';
        if (contentType.includes('application/json')) {
          if (!res.ok) {
            const err = await res.json().catch(() => ({ error: 'Bulk import failed' }));
            throw new Error(err.error || 'Bulk import failed');
          }
          return res.json();
        } else {
          isStaticHostingMode = true;
        }
      } catch (err: any) {
        if (err.message && !err.message.includes('Unexpected token')) throw err;
        isStaticHostingMode = true;
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
    if (!isStaticHostingMode) {
      try {
        const res = await fetch('/api/past-dedications', {
          headers: getAuthHeaders()
        });
        const contentType = res.headers.get('content-type') || '';
        if (contentType.includes('application/json')) {
          if (!res.ok) {
            if (res.status === 401 || res.status === 403) return [];
            throw new Error('Failed to load past dedications');
          }
          const list = await res.json();
          saveLocalPastDedications(list);
          return list;
        } else {
          isStaticHostingMode = true;
        }
      } catch {
        isStaticHostingMode = true;
      }
    }

    return getLocalPastDedications();
  },

  async createPastDedication(record: Partial<PastDedicationRecord>): Promise<PastDedicationRecord> {
    if (!isStaticHostingMode) {
      try {
        const res = await fetch('/api/past-dedications', {
          method: 'POST',
          headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
          body: JSON.stringify(record)
        });
        const contentType = res.headers.get('content-type') || '';
        if (contentType.includes('application/json')) {
          if (!res.ok) {
            const err = await res.json().catch(() => ({ error: 'Failed to create past record' }));
            throw new Error(err.error || 'Failed to create past record');
          }
          return res.json();
        } else {
          isStaticHostingMode = true;
        }
      } catch (err: any) {
        if (err.message && !err.message.includes('Unexpected token')) throw err;
        isStaticHostingMode = true;
      }
    }

    // Local Fallback
    const all = getLocalPastDedications();
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
      selectedZone: record.selectedZone || 'Zone A',
      selectedFellowship: record.selectedFellowship || 'General',
      dedicationYear: record.dedicationYear || 2020,
      serviceDate: record.serviceDate || '2020-01-01',
      certificateNumber: record.certificateNumber || `DCU-HIST-${Math.floor(1000 + Math.random() * 9000)}`,
      certificateIssued: record.certificateIssued ?? true,
      officiatingMinister: record.officiatingMinister || 'Senior Pastor',
      notes: record.notes || '',
      archivalSource: record.archivalSource || 'Historical Register',
      createdAt: new Date().toISOString()
    };

    all.unshift(newRecord);
    saveLocalPastDedications(all);
    return newRecord;
  },

  async bulkImportPastDedications(records: any[]): Promise<{ success: boolean; count: number }> {
    if (!isStaticHostingMode) {
      try {
        const res = await fetch('/api/past-dedications/bulk-import', {
          method: 'POST',
          headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
          body: JSON.stringify(records)
        });
        const contentType = res.headers.get('content-type') || '';
        if (contentType.includes('application/json')) {
          if (!res.ok) {
            const err = await res.json().catch(() => ({ error: 'Bulk import failed' }));
            throw new Error(err.error || 'Bulk import failed');
          }
          return res.json();
        } else {
          isStaticHostingMode = true;
        }
      } catch (err: any) {
        if (err.message && !err.message.includes('Unexpected token')) throw err;
        isStaticHostingMode = true;
      }
    }

    // Local Fallback
    const all = getLocalPastDedications();
    all.unshift(...records);
    saveLocalPastDedications(all);
    return { success: true, count: records.length };
  },

  async updatePastDedication(id: string, updates: Partial<PastDedicationRecord>): Promise<PastDedicationRecord> {
    if (!isStaticHostingMode) {
      try {
        const res = await fetch(`/api/past-dedications/${id}`, {
          method: 'PUT',
          headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
          body: JSON.stringify(updates)
        });
        const contentType = res.headers.get('content-type') || '';
        if (contentType.includes('application/json')) {
          if (!res.ok) {
            const err = await res.json().catch(() => ({ error: 'Failed to update record' }));
            throw new Error(err.error || 'Failed to update record');
          }
          return res.json();
        } else {
          isStaticHostingMode = true;
        }
      } catch (err: any) {
        if (err.message && !err.message.includes('Unexpected token')) throw err;
        isStaticHostingMode = true;
      }
    }

    // Local Fallback
    const all = getLocalPastDedications();
    const idx = all.findIndex(d => d.id === id);
    if (idx === -1) throw new Error('Past dedication record not found.');
    all[idx] = { ...all[idx], ...updates };
    saveLocalPastDedications(all);
    return all[idx];
  },

  async deletePastDedication(id: string): Promise<boolean> {
    if (!isStaticHostingMode) {
      try {
        const res = await fetch(`/api/past-dedications/${id}`, {
          method: 'DELETE',
          headers: getAuthHeaders()
        });
        const contentType = res.headers.get('content-type') || '';
        if (contentType.includes('application/json')) {
          if (!res.ok) {
            const err = await res.json().catch(() => ({ error: 'Delete failed' }));
            throw new Error(err.error || 'Delete failed');
          }
          return true;
        } else {
          isStaticHostingMode = true;
        }
      } catch (err: any) {
        if (err.message && !err.message.includes('Unexpected token')) throw err;
        isStaticHostingMode = true;
      }
    }

    // Local Fallback
    let all = getLocalPastDedications();
    all = all.filter(d => d.id !== id);
    saveLocalPastDedications(all);
    return true;
  },

  // ==========================================
  // STAFF & ROLE MANAGEMENT (Super Admin)
  // ==========================================

  async getUsers(): Promise<UserProfile[]> {
    if (!isStaticHostingMode) {
      try {
        const res = await fetch('/api/users', {
          headers: getAuthHeaders()
        });
        const contentType = res.headers.get('content-type') || '';
        if (contentType.includes('application/json')) {
          if (!res.ok) return [];
          const users = await res.json();
          saveLocalUsers(users);
          return users;
        } else {
          isStaticHostingMode = true;
        }
      } catch {
        isStaticHostingMode = true;
      }
    }

    return getLocalUsers().map(({ password, ...u }) => u);
  },

  async inviteStaff(payload: {
    email: string;
    name?: string;
    role: 'super_admin' | 'office_admin' | 'pastor' | 'fellowship_leader';
    assignedZone?: 'Zone A' | 'Zone B' | 'Zone C' | 'Zone D' | 'Zone E';
  }): Promise<{ invitation: StaffInvitation; rawToken: string; inviteUrl: string }> {
    if (!isStaticHostingMode) {
      try {
        const res = await fetch('/api/users/invite', {
          method: 'POST',
          headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
          body: JSON.stringify(payload)
        });
        const contentType = res.headers.get('content-type') || '';
        if (contentType.includes('application/json')) {
          if (!res.ok) {
            const err = await res.json().catch(() => ({ error: 'Failed to issue invitation' }));
            throw new Error(err.error || 'Failed to issue invitation');
          }
          return res.json();
        } else {
          isStaticHostingMode = true;
        }
      } catch (err: any) {
        if (err.message && !err.message.includes('Unexpected token')) throw err;
        isStaticHostingMode = true;
      }
    }

    // Local Fallback
    const token = `INV-${Date.now()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
    const inv: StaffInvitation = {
      id: `inv-${Date.now()}`,
      tokenHash: token,
      email: payload.email.toLowerCase().trim(),
      name: payload.name || payload.email.split('@')[0],
      role: payload.role,
      assignedZone: payload.assignedZone,
      invitedBy: 'usr-admin-1',
      invitedByEmail: 'fawany@gmail.com',
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      status: 'pending'
    };

    const invites = getLocalInvitations();
    invites.unshift(inv);
    saveLocalInvitations(invites);

    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    const inviteUrl = `${origin}/?invite=${token}&email=${encodeURIComponent(inv.email)}`;

    return { invitation: inv, rawToken: token, inviteUrl };
  },

  async getInvitations(): Promise<StaffInvitation[]> {
    if (!isStaticHostingMode) {
      try {
        const res = await fetch('/api/invitations', {
          headers: getAuthHeaders()
        });
        const contentType = res.headers.get('content-type') || '';
        if (contentType.includes('application/json')) {
          if (!res.ok) return [];
          return res.json();
        } else {
          isStaticHostingMode = true;
        }
      } catch {
        isStaticHostingMode = true;
      }
    }

    return getLocalInvitations();
  },

  async revokeInvitation(id: string): Promise<boolean> {
    if (!isStaticHostingMode) {
      try {
        const res = await fetch(`/api/invitations/${id}/revoke`, {
          method: 'POST',
          headers: getAuthHeaders()
        });
        const contentType = res.headers.get('content-type') || '';
        if (contentType.includes('application/json')) {
          if (!res.ok) {
            const err = await res.json().catch(() => ({ error: 'Failed to revoke' }));
            throw new Error(err.error || 'Failed to revoke');
          }
          return true;
        } else {
          isStaticHostingMode = true;
        }
      } catch (err: any) {
        if (err.message && !err.message.includes('Unexpected token')) throw err;
        isStaticHostingMode = true;
      }
    }

    // Local Fallback
    let invites = getLocalInvitations();
    invites = invites.filter(i => i.id !== id);
    saveLocalInvitations(invites);
    return true;
  },

  async updateUserRole(id: string, role: string, assignedZone?: string): Promise<UserProfile> {
    if (!isStaticHostingMode) {
      try {
        const res = await fetch(`/api/users/${id}/role`, {
          method: 'PUT',
          headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
          body: JSON.stringify({ role, assignedZone })
        });
        const contentType = res.headers.get('content-type') || '';
        if (contentType.includes('application/json')) {
          if (!res.ok) {
            const err = await res.json().catch(() => ({ error: 'Failed to update user role' }));
            throw new Error(err.error || 'Failed to update user role');
          }
          return res.json();
        } else {
          isStaticHostingMode = true;
        }
      } catch (err: any) {
        if (err.message && !err.message.includes('Unexpected token')) throw err;
        isStaticHostingMode = true;
      }
    }

    // Local Fallback
    const users = getLocalUsers();
    const user = users.find(u => u.id === id);
    if (!user) throw new Error('User not found.');
    user.role = (role === 'admin' ? 'super_admin' : role) as UserRole;
    user.assignedZone = assignedZone as any;
    saveLocalUsers(users);
    return user;
  },

  async updateUserStatus(id: string, isSuspended: boolean): Promise<UserProfile> {
    if (!isStaticHostingMode) {
      try {
        const res = await fetch(`/api/users/${id}/status`, {
          method: 'PUT',
          headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
          body: JSON.stringify({ isSuspended })
        });
        const contentType = res.headers.get('content-type') || '';
        if (contentType.includes('application/json')) {
          if (!res.ok) {
            const err = await res.json().catch(() => ({ error: 'Failed to update user status' }));
            throw new Error(err.error || 'Failed to update user status');
          }
          return res.json();
        } else {
          isStaticHostingMode = true;
        }
      } catch (err: any) {
        if (err.message && !err.message.includes('Unexpected token')) throw err;
        isStaticHostingMode = true;
      }
    }

    // Local Fallback
    const users = getLocalUsers();
    const user = users.find(u => u.id === id);
    if (!user) throw new Error('User not found.');
    user.isSuspended = isSuspended;
    saveLocalUsers(users);
    return user;
  },

  async deleteUser(id: string): Promise<boolean> {
    if (!isStaticHostingMode) {
      try {
        const res = await fetch(`/api/users/${id}`, {
          method: 'DELETE',
          headers: getAuthHeaders()
        });
        const contentType = res.headers.get('content-type') || '';
        if (contentType.includes('application/json')) {
          if (!res.ok) {
            const err = await res.json().catch(() => ({ error: 'Failed to delete user' }));
            throw new Error(err.error || 'Failed to delete user');
          }
          return true;
        } else {
          isStaticHostingMode = true;
        }
      } catch (err: any) {
        if (err.message && !err.message.includes('Unexpected token')) throw err;
        isStaticHostingMode = true;
      }
    }

    // Local Fallback
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
      try {
        const res = await fetch('/api/audit-logs', {
          headers: getAuthHeaders()
        });
        const contentType = res.headers.get('content-type') || '';
        if (contentType.includes('application/json')) {
          if (!res.ok) return [];
          return res.json();
        } else {
          isStaticHostingMode = true;
        }
      } catch {
        isStaticHostingMode = true;
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
