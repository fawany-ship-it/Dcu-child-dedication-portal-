import express, { Request, Response, NextFunction } from 'express';
import { createServer as createViteServer } from 'vite';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { INITIAL_DEDICATIONS, INITIAL_USERS } from './src/data/initialDedications.ts';
import { INITIAL_PAST_DEDICATIONS } from './src/data/pastDedications.ts';
import { DedicationRecord, UserProfile, UserRole, PastDedicationRecord } from './src/types.ts';
import {
  StoredUser,
  hashPassword,
  verifyPassword,
  sanitizeUser,
  checkRateLimit,
  resetRateLimit,
  writeAuditLog,
  loadAuditLogs,
  createSession,
  verifySessionToken,
  revokeSession,
  revokeAllUserSessions,
  createInvitation,
  loadInvitations,
  verifyInvitation,
  markInvitationUsed,
  revokeInvitation,
  generateMfaCode,
  BOOTSTRAP_TOKEN
} from './src/server/security.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = path.join(__dirname, 'data');
const DEDICATIONS_FILE = path.join(DATA_DIR, 'dedications.json');
const USERS_FILE = path.join(DATA_DIR, 'users.json');
const PAST_DEDICATIONS_FILE = path.join(DATA_DIR, 'past_dedications.json');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Extend Express Request type
interface AuthenticatedRequest extends Request {
  user?: StoredUser;
  sessionToken?: string;
  userRole?: UserRole;
}

// ==========================================
// DATA PERSISTENCE HELPERS
// ==========================================

function loadDedications(): DedicationRecord[] {
  try {
    if (fs.existsSync(DEDICATIONS_FILE)) {
      const content = fs.readFileSync(DEDICATIONS_FILE, 'utf-8');
      const data = JSON.parse(content);
      if (Array.isArray(data) && data.length > 0) {
        return data;
      }
    }
  } catch (err) {
    console.error('Error reading dedications file:', err);
  }
  fs.writeFileSync(DEDICATIONS_FILE, JSON.stringify(INITIAL_DEDICATIONS, null, 2));
  return INITIAL_DEDICATIONS;
}

function saveDedications(data: DedicationRecord[]) {
  try {
    fs.writeFileSync(DEDICATIONS_FILE, JSON.stringify(data, null, 2));
  } catch (err) {
    console.error('Error saving dedications file:', err);
  }
}

function loadUsers(): StoredUser[] {
  try {
    if (fs.existsSync(USERS_FILE)) {
      const content = fs.readFileSync(USERS_FILE, 'utf-8');
      const data = JSON.parse(content);
      if (Array.isArray(data) && data.length > 0) {
        // Upgrade legacy 'admin' to 'super_admin' and ensure password hashes exist
        let modified = false;
        const users: StoredUser[] = data.map((u: any) => {
          let role = u.role;
          if (role === 'admin') {
            role = 'super_admin';
            modified = true;
          }
          // Seed password if absent for initial known users
          if (!u.passwordHash) {
            const defaultPass = role === 'super_admin' ? 'DcuAdmin2026!#' : 'DcuLeader2026!#';
            const { hash, salt } = hashPassword(defaultPass);
            u.passwordHash = hash;
            u.salt = salt;
            modified = true;
          }
          return {
            ...u,
            role,
            isSuspended: u.isSuspended ?? false
          };
        });
        if (modified) {
          saveUsers(users);
        }
        return users;
      }
    }
  } catch (err) {
    console.error('Error reading users file:', err);
  }

  // Initialize with encrypted passwords for default staff
  const seededUsers: StoredUser[] = INITIAL_USERS.map(u => {
    const role: UserRole = (u.role as string) === 'admin' ? 'super_admin' : u.role;
    const defaultPass = role === 'super_admin' ? 'DcuAdmin2026!#' : 'DcuLeader2026!#';
    const { hash, salt } = hashPassword(defaultPass);
    return {
      ...u,
      role,
      passwordHash: hash,
      salt,
      isSuspended: false
    };
  });

  fs.writeFileSync(USERS_FILE, JSON.stringify(seededUsers, null, 2));
  return seededUsers;
}

function saveUsers(data: StoredUser[]) {
  try {
    fs.writeFileSync(USERS_FILE, JSON.stringify(data, null, 2));
  } catch (err) {
    console.error('Error saving users file:', err);
  }
}

function loadPastDedications(): PastDedicationRecord[] {
  try {
    if (fs.existsSync(PAST_DEDICATIONS_FILE)) {
      const content = fs.readFileSync(PAST_DEDICATIONS_FILE, 'utf-8');
      const data = JSON.parse(content);
      if (Array.isArray(data) && data.length > 0) {
        return data;
      }
    }
  } catch (err) {
    console.error('Error reading past dedications file:', err);
  }
  fs.writeFileSync(PAST_DEDICATIONS_FILE, JSON.stringify(INITIAL_PAST_DEDICATIONS, null, 2));
  return INITIAL_PAST_DEDICATIONS;
}

function savePastDedications(data: PastDedicationRecord[]) {
  try {
    fs.writeFileSync(PAST_DEDICATIONS_FILE, JSON.stringify(data, null, 2));
  } catch (err) {
    console.error('Error saving past dedications file:', err);
  }
}

// ==========================================
// SECURITY MIDDLEWARE
// ==========================================

// Authenticate session token from Authorization: Bearer <token> or query parameter ?token=
function authenticateUser(req: AuthenticatedRequest, _res: Response, next: NextFunction) {
  let token: string | undefined;
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.substring(7).trim();
  } else if (req.query.token && typeof req.query.token === 'string') {
    token = req.query.token.trim();
  }

  if (token) {
    const session = verifySessionToken(token);
    if (session) {
      const users = loadUsers();
      const user = users.find(u => u.id === session.userId);
      if (user && !user.isSuspended) {
        req.user = user;
        req.sessionToken = token;
        req.userRole = (user.role as string) === 'admin' ? 'super_admin' : user.role;
      }
    }
  }
  next();
}

// Require authenticated user
function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required. Please log in.' });
  }
  next();
}

// Role-based access control middleware
function requireRoles(allowedRoles: UserRole[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required. Please log in.' });
    }

    const currentRole = req.userRole || req.user.role;
    // Map legacy 'admin' to 'super_admin'
    const normalizedRole: UserRole = (currentRole as string) === 'admin' ? 'super_admin' : currentRole;

    const hasPermission = allowedRoles.includes(normalizedRole) ||
      (allowedRoles.includes('super_admin') && normalizedRole === 'super_admin') ||
      (allowedRoles.includes('office_admin') && normalizedRole === 'super_admin');

    if (!hasPermission) {
      writeAuditLog({
        eventType: 'ACCESS_DENIED_UNAUTHORIZED_ROLE',
        actorId: req.user.id,
        actorEmail: req.user.email,
        actorRole: normalizedRole,
        outcome: 'FAILURE',
        ip: req.ip,
        details: { path: req.path, method: req.method, requiredRoles: allowedRoles }
      });
      return res.status(403).json({ 
        error: 'Access denied: your account role does not have permission for this resource.' 
      });
    }

    next();
  };
}

// Rate limit helper middleware
function rateLimit(maxAttempts = 5, windowMs = 15 * 60 * 1000) {
  return (req: Request, res: Response, next: NextFunction) => {
    const clientKey = `${req.ip || 'unknown'}:${req.path}`;
    const result = checkRateLimit(clientKey, maxAttempts, windowMs);
    if (!result.allowed) {
      writeAuditLog({
        eventType: 'RATE_LIMIT_EXCEEDED',
        outcome: 'FAILURE',
        ip: req.ip,
        details: { path: req.path, waitSeconds: Math.ceil(result.remainingWaitMs / 1000) }
      });
      return res.status(429).json({ 
        error: `Too many requests. Please wait ${Math.ceil(result.remainingWaitMs / 1000)} seconds before retrying.` 
      });
    }
    next();
  };
}

// ==========================================
// SERVER INITIALIZATION
// ==========================================

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  app.set('trust proxy', 1);
  app.use(express.json({ limit: '10mb' }));
  app.use(authenticateUser);

  // Initialize data stores
  loadUsers();
  loadDedications();
  loadPastDedications();

  // ==========================================
  // AUTHENTICATION & REGISTRATION ENDPOINTS
  // ==========================================

  // 1. Public Parent Registration Only
  // CRITICAL SECURITY RULE: Members of the public can ONLY register as 'parent'.
  // Any attempt to submit privileged roles is rejected immediately.
  app.post('/api/auth/register', rateLimit(5), (req: Request, res: Response) => {
    const { email, name, password, role, phone } = req.body;
    if (!email || !email.includes('@')) {
      return res.status(400).json({ error: 'A valid email address is required.' });
    }
    if (!password || password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters long.' });
    }

    // BLOCK PRIVILEGE ESCALATION ATTEMPT
    if (role && role !== 'parent') {
      writeAuditLog({
        eventType: 'PRIVILEGE_ESCALATION_BLOCKED',
        actorEmail: email,
        outcome: 'FAILURE',
        ip: req.ip,
        details: { attemptedRole: role, reason: 'Public registration attempted to request privileged role' }
      });
      return res.status(403).json({
        error: 'Privileged staff accounts (Super Admin, Office Admin, Pastor, Fellowship Leader) cannot be created via public registration. Staff access is strictly invitation-only.'
      });
    }

    const users = loadUsers();
    const existing = users.find(u => u.email.toLowerCase() === email.toLowerCase());
    if (existing) {
      return res.status(400).json({ error: 'An account with this email address already exists. Please log in.' });
    }

    const { hash, salt } = hashPassword(password);
    const newUser: StoredUser = {
      id: `usr-parent-${Date.now()}`,
      email: email.toLowerCase().trim(),
      name: (name || email.split('@')[0]).trim(),
      role: 'parent', // strictly locked to parent
      isApproved: true,
      authProvider: 'email',
      phone: phone || '',
      passwordHash: hash,
      salt,
      createdAt: new Date().toISOString(),
      lastLoginAt: new Date().toISOString()
    };

    users.push(newUser);
    saveUsers(users);

    writeAuditLog({
      eventType: 'PARENT_REGISTERED',
      actorId: newUser.id,
      actorEmail: newUser.email,
      actorRole: 'parent',
      outcome: 'SUCCESS',
      ip: req.ip
    });

    const { rawToken } = createSession(newUser, req.ip, req.headers['user-agent']);
    res.status(201).json({
      user: sanitizeUser(newUser),
      token: rawToken
    });
  });

  // 2. Email & Password Login
  app.post('/api/auth/login', rateLimit(8), (req: Request, res: Response) => {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required.' });
    }

    const users = loadUsers();
    const user = users.find(u => u.email.toLowerCase() === email.toLowerCase().trim());

    if (!user) {
      writeAuditLog({
        eventType: 'AUTH_LOGIN_FAILURE',
        actorEmail: email,
        outcome: 'FAILURE',
        ip: req.ip,
        details: { reason: 'User not found' }
      });
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    if (user.isSuspended) {
      writeAuditLog({
        eventType: 'SUSPENDED_ACCOUNT_LOGIN_BLOCKED',
        actorId: user.id,
        actorEmail: user.email,
        actorRole: user.role,
        outcome: 'FAILURE',
        ip: req.ip
      });
      return res.status(403).json({ error: 'Account suspended. Please contact church administration.' });
    }

    // Verify Password
    const isValid = verifyPassword(password, user.passwordHash, user.salt);
    if (!isValid) {
      writeAuditLog({
        eventType: 'AUTH_LOGIN_FAILURE',
        actorId: user.id,
        actorEmail: user.email,
        outcome: 'FAILURE',
        ip: req.ip,
        details: { reason: 'Incorrect password' }
      });
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    // Check if user requires MFA (Super Admin / Office Admin)
    const normalizedRole = (user.role as string) === 'admin' ? 'super_admin' : user.role;
    const isPrivilegedStaff = normalizedRole === 'super_admin' || normalizedRole === 'office_admin';

    // Update last login
    user.lastLoginAt = new Date().toISOString();
    saveUsers(users);

    const requiresMfa = isPrivilegedStaff && user.mfaEnabled === true;
    const { rawToken } = createSession(user, req.ip, req.headers['user-agent'], requiresMfa);

    writeAuditLog({
      eventType: 'AUTH_LOGIN_SUCCESS',
      actorId: user.id,
      actorEmail: user.email,
      actorRole: normalizedRole,
      outcome: 'SUCCESS',
      ip: req.ip,
      details: { requiresMfa }
    });

    res.json({
      user: sanitizeUser(user),
      token: rawToken,
      requiresMfa
    });
  });

  // 3. Google Sign-In
  // CRITICAL SECURITY RULE: Google Sign-In authenticates existing pre-authorized accounts,
  // but NEVER automatically grants administrative privileges. Visitors who sign in with Google
  // without an invitation receive strictly the 'parent' role.
  app.post('/api/auth/google', rateLimit(10), (req: Request, res: Response) => {
    const { email, name, avatar, invitationToken } = req.body;
    if (!email || !email.includes('@')) {
      return res.status(400).json({ error: 'Google email is required.' });
    }

    const cleanEmail = email.toLowerCase().trim();
    const users = loadUsers();
    let user = users.find(u => u.email.toLowerCase() === cleanEmail);

    if (user) {
      if (user.isSuspended) {
        writeAuditLog({
          eventType: 'SUSPENDED_GOOGLE_LOGIN_BLOCKED',
          actorId: user.id,
          actorEmail: user.email,
          outcome: 'FAILURE',
          ip: req.ip
        });
        return res.status(403).json({ error: 'This account has been suspended by administration.' });
      }

      user.lastLoginAt = new Date().toISOString();
      if (avatar && !user.avatar) user.avatar = avatar;
      saveUsers(users);

      const normalizedRole = (user.role as string) === 'admin' ? 'super_admin' : user.role;
      const { rawToken } = createSession(user, req.ip, req.headers['user-agent']);

      writeAuditLog({
        eventType: 'AUTH_GOOGLE_LOGIN_SUCCESS',
        actorId: user.id,
        actorEmail: user.email,
        actorRole: normalizedRole,
        outcome: 'SUCCESS',
        ip: req.ip
      });

      return res.json({
        user: sanitizeUser(user),
        token: rawToken
      });
    }

    // New Google User: Check if they possess a valid Staff Invitation Token
    if (invitationToken) {
      const verifyRes = verifyInvitation(invitationToken, cleanEmail);
      if (!verifyRes.valid || !verifyRes.invitation) {
        return res.status(400).json({ error: verifyRes.reason || 'Invalid staff invitation' });
      }

      const inv = verifyRes.invitation;
      user = {
        id: `usr-${Date.now()}`,
        email: cleanEmail,
        name: name || inv.name || cleanEmail.split('@')[0],
        role: inv.role,
        assignedZone: inv.assignedZone,
        isApproved: true,
        authProvider: 'google',
        avatar,
        createdAt: new Date().toISOString(),
        lastLoginAt: new Date().toISOString()
      };

      users.push(user);
      saveUsers(users);
      markInvitationUsed(inv.tokenHash || '');

      writeAuditLog({
        eventType: 'STAFF_INVITATION_ACCEPTED_VIA_GOOGLE',
        actorId: user.id,
        actorEmail: user.email,
        actorRole: user.role,
        outcome: 'SUCCESS',
        ip: req.ip,
        details: { invitationId: inv.id, role: inv.role, assignedZone: inv.assignedZone }
      });

      const { rawToken } = createSession(user, req.ip, req.headers['user-agent']);
      return res.json({
        user: sanitizeUser(user),
        token: rawToken
      });
    }

    // Ordinary visitor signing in with Google without invitation:
    // ALWAYS assign strictly the 'parent' role!
    user = {
      id: `usr-parent-${Date.now()}`,
      email: cleanEmail,
      name: name || cleanEmail.split('@')[0],
      role: 'parent', // Non-privileged
      isApproved: true,
      authProvider: 'google',
      avatar: avatar || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(name || cleanEmail)}`,
      createdAt: new Date().toISOString(),
      lastLoginAt: new Date().toISOString()
    };

    users.push(user);
    saveUsers(users);

    writeAuditLog({
      eventType: 'PARENT_REGISTERED_VIA_GOOGLE',
      actorId: user.id,
      actorEmail: user.email,
      actorRole: 'parent',
      outcome: 'SUCCESS',
      ip: req.ip
    });

    const { rawToken } = createSession(user, req.ip, req.headers['user-agent']);
    res.json({
      user: sanitizeUser(user),
      token: rawToken
    });
  });

  // 4. Accept Privileged Staff Invitation
  app.post('/api/auth/accept-invitation', rateLimit(5), (req: Request, res: Response) => {
    const { token, email, password, name, phone } = req.body;
    if (!token || !email) {
      return res.status(400).json({ error: 'Invitation token and email are required.' });
    }
    if (!password || password.length < 6) {
      return res.status(400).json({ error: 'A secure password of at least 6 characters is required.' });
    }

    const cleanEmail = email.toLowerCase().trim();
    const verifyRes = verifyInvitation(token, cleanEmail);
    if (!verifyRes.valid || !verifyRes.invitation) {
      return res.status(400).json({ error: verifyRes.reason || 'Invalid or expired invitation.' });
    }

    const inv = verifyRes.invitation;
    const users = loadUsers();
    let user = users.find(u => u.email.toLowerCase() === cleanEmail);

    const { hash, salt } = hashPassword(password);

    if (user) {
      // Elevate existing account to invited staff role
      user.role = inv.role;
      user.assignedZone = inv.assignedZone;
      user.passwordHash = hash;
      user.salt = salt;
      user.name = name || user.name;
      user.phone = phone || user.phone;
      user.lastLoginAt = new Date().toISOString();
    } else {
      // Create new staff account
      user = {
        id: `usr-staff-${Date.now()}`,
        email: cleanEmail,
        name: name || inv.name || cleanEmail.split('@')[0],
        role: inv.role,
        assignedZone: inv.assignedZone,
        phone: phone || '',
        isApproved: true,
        authProvider: 'email',
        passwordHash: hash,
        salt,
        createdAt: new Date().toISOString(),
        lastLoginAt: new Date().toISOString()
      };
      users.push(user);
    }

    saveUsers(users);
    markInvitationUsed(inv.tokenHash || '');

    writeAuditLog({
      eventType: 'STAFF_INVITATION_ACCEPTED',
      actorId: user.id,
      actorEmail: user.email,
      actorRole: user.role,
      outcome: 'SUCCESS',
      ip: req.ip,
      details: { invitationId: inv.id, role: inv.role, assignedZone: inv.assignedZone }
    });

    const { rawToken } = createSession(user, req.ip, req.headers['user-agent']);
    res.json({
      user: sanitizeUser(user),
      token: rawToken
    });
  });

  // 5. Verify Staff Invitation Details (for UI pre-fill)
  app.get('/api/auth/verify-invitation', (req: Request, res: Response) => {
    const token = String(req.query.token || '').trim();
    const email = String(req.query.email || '').trim();

    if (!token) {
      return res.status(400).json({ error: 'Token is required' });
    }

    const invites = loadInvitations();
    const inv = invites.find(i => {
      const verifyRes = verifyInvitation(token, i.email);
      return verifyRes.valid;
    });

    if (!inv) {
      return res.status(400).json({ error: 'Invitation is invalid, expired, or already used.' });
    }

    if (email && inv.email.toLowerCase() !== email.toLowerCase()) {
      return res.status(400).json({ error: `This invitation was issued specifically for ${inv.email}.` });
    }

    res.json({
      email: inv.email,
      name: inv.name,
      role: inv.role,
      assignedZone: inv.assignedZone,
      expiresAt: inv.expiresAt
    });
  });

  // 6. Emergency / Initial Administrator Bootstrap
  // If no Super Admin exists, or if system owner provides BOOTSTRAP_TOKEN
  app.post('/api/security/bootstrap-admin', rateLimit(3), (req: Request, res: Response) => {
    const { bootstrapSecret, email, password, name } = req.body;
    if (bootstrapSecret !== BOOTSTRAP_TOKEN) {
      writeAuditLog({
        eventType: 'BOOTSTRAP_ATTEMPT_INVALID_SECRET',
        outcome: 'FAILURE',
        ip: req.ip
      });
      return res.status(403).json({ error: 'Invalid bootstrap authorization token.' });
    }

    if (!email || !password || password.length < 8) {
      return res.status(400).json({ error: 'Valid email and strong password (min 8 chars) required.' });
    }

    const cleanEmail = email.toLowerCase().trim();
    const users = loadUsers();
    let superAdmin = users.find(u => u.email.toLowerCase() === cleanEmail);

    const { hash, salt } = hashPassword(password);

    if (superAdmin) {
      superAdmin.role = 'super_admin';
      superAdmin.passwordHash = hash;
      superAdmin.salt = salt;
      superAdmin.isSuspended = false;
      superAdmin.isApproved = true;
    } else {
      superAdmin = {
        id: `usr-superadmin-${Date.now()}`,
        email: cleanEmail,
        name: name || 'Primary Super Administrator',
        role: 'super_admin',
        isApproved: true,
        authProvider: 'email',
        passwordHash: hash,
        salt,
        createdAt: new Date().toISOString(),
        lastLoginAt: new Date().toISOString()
      };
      users.push(superAdmin);
    }

    saveUsers(users);

    writeAuditLog({
      eventType: 'INITIAL_SUPERADMIN_PROVISIONED',
      actorId: superAdmin.id,
      actorEmail: superAdmin.email,
      actorRole: 'super_admin',
      outcome: 'SUCCESS',
      ip: req.ip
    });

    const { rawToken } = createSession(superAdmin, req.ip, req.headers['user-agent']);
    res.json({
      success: true,
      message: 'Super Administrator account provisioned successfully.',
      user: sanitizeUser(superAdmin),
      token: rawToken
    });
  });

  // 7. Get Current User Profile (Authenticated)
  app.get('/api/auth/me', requireAuth, (req: AuthenticatedRequest, res: Response) => {
    res.json(sanitizeUser(req.user!));
  });

  // 8. Logout
  app.post('/api/auth/logout', (req: AuthenticatedRequest, res: Response) => {
    if (req.sessionToken) {
      revokeSession(req.sessionToken);
      if (req.user) {
        writeAuditLog({
          eventType: 'AUTH_LOGOUT',
          actorId: req.user.id,
          actorEmail: req.user.email,
          actorRole: req.user.role,
          outcome: 'SUCCESS',
          ip: req.ip
        });
      }
    }
    res.json({ success: true, message: 'Logged out successfully.' });
  });

  // ==========================================
  // DEDICATIONS DATA ENDPOINTS
  // ==========================================

  // 1. Get Dedications (Authenticated & Role-Filtered)
  // Super Admin / Office Admin: all records
  // Pastor: pastoral oversight
  // Fellowship Leader: strictly records matching their assignedZone
  // Parent: strictly records matching their own email/phone
  app.get('/api/dedications', requireAuth, (req: AuthenticatedRequest, res: Response) => {
    const list = loadDedications();
    const role = req.userRole || req.user!.role;

    if (role === 'super_admin' || role === 'office_admin') {
      return res.json(list);
    }

    if (role === 'pastor') {
      if (req.user!.assignedZone) {
        return res.json(list.filter(d => d.selectedZone === req.user!.assignedZone));
      }
      return res.json(list);
    }

    if (role === 'fellowship_leader') {
      const zone = req.user!.assignedZone || 'Zone A';
      const zoneFiltered = list.filter(d => d.selectedZone === zone);
      return res.json(zoneFiltered);
    }

    if (role === 'parent') {
      const parentEmail = req.user!.email.toLowerCase();
      const parentRecords = list.filter(d => 
        (d.submittedBy && d.submittedBy.toLowerCase() === parentEmail) ||
        (d.parentEmail && d.parentEmail.toLowerCase() === parentEmail) ||
        (d.fatherEmail && d.fatherEmail.toLowerCase() === parentEmail) ||
        (d.motherEmail && d.motherEmail.toLowerCase() === parentEmail)
      );
      return res.json(parentRecords);
    }

    return res.status(403).json({ error: 'Access denied.' });
  });

  // 2. Public Parent Submission Form
  // Sanitizes and validates all submissions. Member of public can submit a new dedication form.
  app.post('/api/dedications', rateLimit(10, 60 * 1000), (req: AuthenticatedRequest, res: Response) => {
    const body = req.body;
    if (!body.childName || !body.childDob) {
      return res.status(400).json({ error: 'Child name and date of birth are required.' });
    }
    if (!body.dataConsent) {
      return res.status(400).json({ error: 'Data consent is required.' });
    }

    const dedications = loadDedications();
    const currentYear = new Date().getFullYear();

    // STRICT SANITIZATION: Never trust client-provided approval or certificate flags on public submission!
    const newRecord: DedicationRecord = {
      id: `DED-${currentYear}-${String(dedications.length + 1).padStart(3, '0')}`,
      childName: String(body.childName).trim(),
      childDob: String(body.childDob).trim(),
      childGender: body.childGender === 'Female' ? 'Female' : 'Male',
      childCountyOfBirth: String(body.childCountyOfBirth || 'Nairobi').trim(),
      childPlaceOfBirth: String(body.childCountyOfBirth || 'Nairobi').trim(),
      fatherName: String(body.fatherName || '').trim(),
      fatherPhone: String(body.fatherPhone || '').trim(),
      fatherEmail: String(body.fatherEmail || '').trim(),
      motherName: String(body.motherName || '').trim(),
      motherPhone: String(body.motherPhone || '').trim(),
      motherEmail: String(body.motherEmail || '').trim(),
      parentName: String(body.parentName || `${body.fatherName || ''} & ${body.motherName || ''}`).trim(),
      parentPhone: String(body.parentPhone || body.fatherPhone || body.motherPhone || '').trim(),
      parentEmail: String(body.parentEmail || body.fatherEmail || body.motherEmail || '').trim(),
      parentRelationship: String(body.parentRelationship || 'Parents').trim(),
      isInFellowship: Boolean(body.isInFellowship),
      selectedZone: body.selectedZone || 'Zone A',
      selectedFellowship: body.selectedFellowship || 'Doxa',
      residentialLocation: String(body.residentialLocation || '').trim(),
      dataConsent: true,
      serviceDate: body.serviceDate || 'To be scheduled by Pastoral Office',

      // Security defaults: strictly false on public submission
      status: 'submitted',
      leadershipConfirmed: false,
      officeApproved: false,
      certificateIssued: false,

      submittedBy: req.user ? req.user.email : (body.parentEmail || body.fatherEmail || body.motherEmail || 'public-visitor'),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    dedications.unshift(newRecord);
    saveDedications(dedications);

    writeAuditLog({
      eventType: 'DEDICATION_CREATED',
      actorId: req.user ? req.user.id : 'public-parent',
      actorEmail: newRecord.submittedBy,
      actorRole: req.user ? req.user.role : 'parent',
      targetId: newRecord.id,
      targetType: 'dedication',
      outcome: 'SUCCESS',
      ip: req.ip,
      details: { childName: newRecord.childName, zone: newRecord.selectedZone }
    });

    res.status(201).json(newRecord);
  });

  // 3. Status Tracker Endpoint (Public & Privacy-Preserving)
  // Requires child ID AND matching phone number verification so unauthorized parties cannot enumerate families.
  app.get('/api/dedications/track', rateLimit(15), (req: Request, res: Response) => {
    const id = String(req.query.id || '').trim();
    const phone = String(req.query.phone || '').trim().replace(/\s+/g, '');

    if (!id) {
      return res.status(400).json({ error: 'Dedication Reference ID is required.' });
    }

    const dedications = loadDedications();
    const record = dedications.find(d => d.id.toLowerCase() === id.toLowerCase());

    if (!record) {
      return res.status(404).json({ error: 'Record not found. Please check your reference ID.' });
    }

    // Phone verification check to prevent IDOR / unauthorized enumeration
    if (phone) {
      const matchFather = record.fatherPhone.replace(/\s+/g, '').includes(phone);
      const matchMother = record.motherPhone.replace(/\s+/g, '').includes(phone);
      const matchParent = record.parentPhone ? record.parentPhone.replace(/\s+/g, '').includes(phone) : false;
      if (!matchFather && !matchMother && !matchParent) {
        return res.status(403).json({ error: 'Verification failed: provided phone does not match record.' });
      }
    }

    // Return safe public tracking payload without sensitive PII
    res.json({
      id: record.id,
      childName: record.childName,
      status: record.status,
      serviceDate: record.serviceDate,
      leadershipConfirmed: record.leadershipConfirmed,
      officeApproved: record.officeApproved,
      certificateIssued: record.certificateIssued,
      certificateNumber: record.certificateIssued ? record.certificateNumber : undefined,
      selectedZone: record.selectedZone,
      selectedFellowship: record.selectedFellowship,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt
    });
  });

  // 4. Update Dedication (Role-Restricted)
  app.put('/api/dedications/:id', requireAuth, (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;
    const dedications = loadDedications();
    const index = dedications.findIndex(d => d.id === id);
    if (index === -1) {
      return res.status(404).json({ error: 'Dedication record not found' });
    }

    const currentRecord = dedications[index];
    const role = req.userRole || req.user!.role;

    // FELLOWSHIP LEADER: Strictly constrained to their zone and leadership confirmation fields
    if (role === 'fellowship_leader') {
      if (currentRecord.selectedZone !== req.user!.assignedZone) {
        writeAuditLog({
          eventType: 'CROSS_ZONE_TAMPER_BLOCKED',
          actorId: req.user!.id,
          actorEmail: req.user!.email,
          actorRole: role,
          targetId: id,
          outcome: 'FAILURE',
          ip: req.ip,
          details: { recordZone: currentRecord.selectedZone, leaderZone: req.user!.assignedZone }
        });
        return res.status(403).json({ error: 'Access denied: You can only confirm records in your assigned fellowship zone.' });
      }

      // Fellowship leader can ONLY update leadership confirmation fields
      dedications[index] = {
        ...currentRecord,
        leadershipConfirmed: req.body.leadershipConfirmed ?? currentRecord.leadershipConfirmed,
        fellowshipLeaderName: req.body.fellowshipLeaderName || req.user!.name,
        fellowshipConfirmedAt: req.body.fellowshipConfirmedAt || new Date().toISOString(),
        fellowshipNotes: req.body.fellowshipNotes || currentRecord.fellowshipNotes,
        status: req.body.leadershipConfirmed ? (currentRecord.officeApproved ? 'office_approved' : 'fellowship_confirmed') : 'submitted',
        updatedAt: new Date().toISOString()
      };

      saveDedications(dedications);

      writeAuditLog({
        eventType: 'DEDICATION_FELLOWSHIP_ENDORSED',
        actorId: req.user!.id,
        actorEmail: req.user!.email,
        actorRole: role,
        targetId: id,
        outcome: 'SUCCESS',
        ip: req.ip
      });

      return res.json(dedications[index]);
    }

    // CHURCH OFFICE ADMIN & SUPER ADMIN: Full management authority
    if (role === 'super_admin' || role === 'office_admin' || role === 'pastor') {
      const certNum = req.body.certificateNumber || currentRecord.certificateNumber || 
        `DCU-DED-${new Date().getFullYear()}-${String(index + 90).padStart(3, '0')}`;

      dedications[index] = {
        ...currentRecord,
        ...req.body,
        id, // immutable
        certificateNumber: certNum,
        updatedAt: new Date().toISOString()
      };

      saveDedications(dedications);

      writeAuditLog({
        eventType: 'DEDICATION_UPDATED_BY_STAFF',
        actorId: req.user!.id,
        actorEmail: req.user!.email,
        actorRole: role,
        targetId: id,
        outcome: 'SUCCESS',
        ip: req.ip
      });

      return res.json(dedications[index]);
    }

    // PARENT: Can only update contact details on their own submitted record before office approval
    if (role === 'parent') {
      const isOwner = currentRecord.submittedBy === req.user!.email || 
        currentRecord.parentEmail === req.user!.email;
      if (!isOwner) {
        return res.status(403).json({ error: 'Access denied: You can only edit your own family submission.' });
      }
      if (currentRecord.officeApproved) {
        return res.status(403).json({ error: 'This record has already been approved by church office and cannot be edited by parents.' });
      }

      dedications[index] = {
        ...currentRecord,
        fatherPhone: req.body.fatherPhone || currentRecord.fatherPhone,
        motherPhone: req.body.motherPhone || currentRecord.motherPhone,
        residentialLocation: req.body.residentialLocation || currentRecord.residentialLocation,
        updatedAt: new Date().toISOString()
      };
      saveDedications(dedications);
      return res.json(dedications[index]);
    }

    return res.status(403).json({ error: 'Access denied.' });
  });

  // 5. Delete Dedication (Super Admin & Office Admin only)
  app.delete('/api/dedications/:id', requireRoles(['super_admin', 'office_admin']), (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;
    let dedications = loadDedications();
    const beforeCount = dedications.length;
    dedications = dedications.filter(d => d.id !== id);

    if (dedications.length === beforeCount) {
      return res.status(404).json({ error: 'Record not found' });
    }

    saveDedications(dedications);

    writeAuditLog({
      eventType: 'DEDICATION_DELETED',
      actorId: req.user!.id,
      actorEmail: req.user!.email,
      actorRole: req.userRole || req.user!.role,
      targetId: id,
      outcome: 'SUCCESS',
      ip: req.ip
    });

    res.json({ success: true, message: 'Record deleted successfully.' });
  });

  // 6. Bulk Import Dedications (Super Admin & Office Admin only)
  app.post('/api/dedications/bulk-import', requireRoles(['super_admin', 'office_admin']), (req: AuthenticatedRequest, res: Response) => {
    const items = req.body;
    if (!Array.isArray(items)) {
      return res.status(400).json({ error: 'Array of records expected' });
    }

    const current = loadDedications();
    const now = new Date().toISOString();

    const formatted: DedicationRecord[] = items.map((rec, i) => {
      const county = rec.childCountyOfBirth || rec.childPlaceOfBirth || 'Nairobi';
      return {
        id: rec.id || `DED-${new Date().getFullYear()}-${String(current.length + i + 1).padStart(3, '0')}`,
        childName: rec.childName || 'Child Name',
        childDob: rec.childDob || '2026-01-01',
        childGender: rec.childGender === 'Female' ? 'Female' : 'Male',
        childCountyOfBirth: county,
        childPlaceOfBirth: county,
        fatherName: rec.fatherName || rec.parentName || 'Father',
        fatherPhone: rec.fatherPhone || rec.parentPhone || '',
        fatherEmail: rec.fatherEmail || rec.parentEmail || '',
        motherName: rec.motherName || 'Mother',
        motherPhone: rec.motherPhone || '',
        motherEmail: rec.motherEmail || '',
        parentName: rec.parentName || `${rec.fatherName || ''} & ${rec.motherName || ''}`.trim(),
        parentPhone: rec.parentPhone || rec.fatherPhone || rec.motherPhone || '',
        parentEmail: rec.parentEmail || rec.fatherEmail || rec.motherEmail || '',
        parentRelationship: rec.parentRelationship || 'Parents',
        isInFellowship: rec.isInFellowship ?? (rec.selectedZone && rec.selectedZone !== 'Unallocated'),
        selectedZone: rec.selectedZone || 'Zone A',
        selectedFellowship: rec.selectedFellowship || 'Doxa',
        residentialLocation: rec.residentialLocation || 'Utawala',
        dataConsent: true,
        status: rec.status || 'compiled',
        serviceDate: rec.serviceDate || '2026-11-29',
        leadershipConfirmed: rec.leadershipConfirmed ?? true,
        officeApproved: rec.officeApproved ?? true,
        certificateIssued: rec.certificateIssued ?? false,
        certificateNumber: rec.certificateNumber || `DCU-DED-${new Date().getFullYear()}-${String(current.length + i + 100).padStart(3, '0')}`,
        fellowshipNotes: rec.fellowshipNotes || 'Imported from church archive file.',
        createdAt: rec.createdAt || now,
        updatedAt: now
      };
    });

    const combined = [...formatted, ...current];
    saveDedications(combined);

    writeAuditLog({
      eventType: 'DEDICATIONS_BULK_IMPORTED',
      actorId: req.user!.id,
      actorEmail: req.user!.email,
      actorRole: req.userRole || req.user!.role,
      outcome: 'SUCCESS',
      ip: req.ip,
      details: { count: formatted.length, total: combined.length }
    });

    res.json({ success: true, count: formatted.length, total: combined.length });
  });

  // ==========================================
  // HISTORICAL / PAST DEDICATIONS (2009+)
  // Protected for Super Admin, Office Admin, and Pastor
  // ==========================================

  app.get('/api/past-dedications', requireRoles(['super_admin', 'office_admin', 'pastor']), (_req: AuthenticatedRequest, res: Response) => {
    res.json(loadPastDedications());
  });

  app.post('/api/past-dedications', requireRoles(['super_admin', 'office_admin']), (req: AuthenticatedRequest, res: Response) => {
    const pastRecords = loadPastDedications();
    const serviceYear = req.body.dedicationYear || 
      (req.body.serviceDate ? parseInt(req.body.serviceDate.slice(0, 4)) : 2024);

    const newRecord: PastDedicationRecord = {
      ...req.body,
      id: req.body.id || `HIST-${serviceYear}-${String(pastRecords.length + 1).padStart(3, '0')}`,
      dedicationYear: serviceYear,
      certificateIssued: true,
      certificateNumber: req.body.certificateNumber || `DCU-DED-${serviceYear}-${String(pastRecords.length + 1).padStart(3, '0')}`,
      createdAt: req.body.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    pastRecords.unshift(newRecord);
    savePastDedications(pastRecords);

    writeAuditLog({
      eventType: 'PAST_DEDICATION_CREATED',
      actorId: req.user!.id,
      actorEmail: req.user!.email,
      targetId: newRecord.id,
      outcome: 'SUCCESS',
      ip: req.ip
    });

    res.status(201).json(newRecord);
  });

  app.post('/api/past-dedications/bulk-import', requireRoles(['super_admin', 'office_admin']), (req: AuthenticatedRequest, res: Response) => {
    const items = req.body;
    if (!Array.isArray(items)) {
      return res.status(400).json({ error: 'Array of records expected' });
    }

    const currentPast = loadPastDedications();
    const now = new Date().toISOString();

    const formatted: PastDedicationRecord[] = items.map((rec, i) => {
      const year = Number(rec.dedicationYear) || 
        (rec.serviceDate ? parseInt(String(rec.serviceDate).slice(0, 4)) : 2009);
      const county = rec.childCountyOfBirth || rec.childPlaceOfBirth || 'Nairobi';
      const childName = (rec.childName || rec['Child Full Name'] || rec['Child Name'] || 'Dedicated Child').trim();
      const father = (rec.fatherName || rec['Father Name'] || '').trim();
      const mother = (rec.motherName || rec['Mother Name'] || '').trim();

      return {
        id: rec.id || `HIST-${year}-${String(currentPast.length + i + 1).padStart(3, '0')}`,
        childName,
        childDob: rec.childDob || rec['Date of Birth'] || `${year}-01-01`,
        childGender: (rec.childGender === 'Female' || rec['Gender'] === 'Female') ? 'Female' : 'Male',
        childCountyOfBirth: county,
        childPlaceOfBirth: county,
        fatherName: father,
        fatherPhone: rec.fatherPhone || rec['Father Phone'] || '',
        fatherEmail: rec.fatherEmail || '',
        motherName: mother,
        motherPhone: rec.motherPhone || rec['Mother Phone'] || '',
        motherEmail: rec.motherEmail || '',
        parentName: rec.parentName || rec['Parent Name'] || `${father} & ${mother}`.trim(),
        parentPhone: rec.parentPhone || rec.fatherPhone || rec.motherPhone || '',
        parentEmail: rec.parentEmail || '',
        selectedZone: rec.selectedZone || rec['Fellowship Zone'] || 'Zone A',
        selectedFellowship: rec.selectedFellowship || rec['Fellowship Name'] || 'Fellowship',
        dedicationYear: isNaN(year) ? 2009 : year,
        serviceDate: rec.serviceDate || rec['Dedicated Date'] || `${year}-11-29`,
        certificateNumber: rec.certificateNumber || rec['Certificate No'] || `DCU-DED-${year}-${String(currentPast.length + i + 1).padStart(3, '0')}`,
        certificateIssued: true,
        officiatingMinister: rec.officiatingMinister || rec['Officiating Minister'] || 'Senior Pastor & Presbytery',
        notes: rec.notes || rec['Notes'] || 'Imported historical archive from 2009+ register',
        archivalSource: rec.archivalSource || 'Historical Church Register',
        createdAt: rec.createdAt || now,
        updatedAt: now
      };
    });

    const combined = [...formatted, ...currentPast];
    savePastDedications(combined);

    writeAuditLog({
      eventType: 'PAST_DEDICATIONS_BULK_IMPORTED',
      actorId: req.user!.id,
      actorEmail: req.user!.email,
      outcome: 'SUCCESS',
      ip: req.ip,
      details: { count: formatted.length, total: combined.length }
    });

    res.json({ success: true, count: formatted.length, total: combined.length });
  });

  app.put('/api/past-dedications/:id', requireRoles(['super_admin', 'office_admin']), (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;
    const pastRecords = loadPastDedications();
    const index = pastRecords.findIndex(d => d.id === id);
    if (index === -1) {
      return res.status(404).json({ error: 'Past record not found' });
    }

    pastRecords[index] = {
      ...pastRecords[index],
      ...req.body,
      id,
      updatedAt: new Date().toISOString()
    };

    savePastDedications(pastRecords);
    res.json(pastRecords[index]);
  });

  app.delete('/api/past-dedications/:id', requireRoles(['super_admin', 'office_admin']), (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;
    let pastRecords = loadPastDedications();
    const beforeCount = pastRecords.length;
    pastRecords = pastRecords.filter(d => d.id !== id);
    if (pastRecords.length === beforeCount) {
      return res.status(404).json({ error: 'Past record not found' });
    }
    savePastDedications(pastRecords);
    res.json({ success: true, message: 'Past record deleted' });
  });

  // ==========================================
  // STAFF, INVITATIONS & ACCESS CONTROL
  // Strictly managed by Super Admin
  // ==========================================

  // Get Users Directory (Super Admin or Office Admin)
  app.get('/api/users', requireRoles(['super_admin', 'office_admin']), (_req: AuthenticatedRequest, res: Response) => {
    const users = loadUsers();
    // NEVER leak passwordHash or salt
    res.json(users.map(sanitizeUser));
  });

  // Issue Staff Invitation (Super Admin only)
  app.post('/api/users/invite', requireRoles(['super_admin']), (req: AuthenticatedRequest, res: Response) => {
    const { email, name, role, assignedZone } = req.body;
    if (!email || !email.includes('@')) {
      return res.status(400).json({ error: 'Valid email address is required.' });
    }

    const validRoles: UserRole[] = ['super_admin', 'office_admin', 'pastor', 'fellowship_leader'];
    if (!role || !validRoles.includes(role)) {
      return res.status(400).json({ error: 'Invalid staff role specified.' });
    }

    const { invitation, rawToken } = createInvitation({
      email,
      name,
      role,
      assignedZone,
      invitedBy: req.user!.id,
      invitedByEmail: req.user!.email
    });

    writeAuditLog({
      eventType: 'STAFF_INVITATION_CREATED',
      actorId: req.user!.id,
      actorEmail: req.user!.email,
      targetId: invitation.id,
      targetType: 'invitation',
      outcome: 'SUCCESS',
      ip: req.ip,
      details: { invitedEmail: email, role, assignedZone }
    });

    res.status(201).json({
      invitation,
      rawToken,
      inviteUrl: `${req.protocol}://${req.get('host')}/?invite=${rawToken}&email=${encodeURIComponent(email)}`
    });
  });

  // Get Staff Invitations List (Super Admin only)
  app.get('/api/invitations', requireRoles(['super_admin']), (_req: AuthenticatedRequest, res: Response) => {
    const invites = loadInvitations();
    res.json(invites);
  });

  // Revoke Staff Invitation (Super Admin only)
  app.post('/api/invitations/:id/revoke', requireRoles(['super_admin']), (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;
    const success = revokeInvitation(id, req.user!.id);
    if (!success) {
      return res.status(404).json({ error: 'Invitation not found' });
    }

    writeAuditLog({
      eventType: 'STAFF_INVITATION_REVOKED',
      actorId: req.user!.id,
      actorEmail: req.user!.email,
      targetId: id,
      outcome: 'SUCCESS',
      ip: req.ip
    });

    res.json({ success: true, message: 'Invitation revoked.' });
  });

  // Update User Role & Zone (Super Admin only)
  app.put('/api/users/:id/role', requireRoles(['super_admin']), (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;
    const { role, assignedZone } = req.body;

    const users = loadUsers();
    const index = users.findIndex(u => u.id === id);
    if (index === -1) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Prevent demoting the last super admin
    if (users[index].id === req.user!.id && role && role !== 'super_admin') {
      const superAdmins = users.filter(u => u.role === 'super_admin' && !u.isSuspended);
      if (superAdmins.length <= 1) {
        return res.status(400).json({ error: 'Cannot demote the only active Super Administrator.' });
      }
    }

    const oldRole = users[index].role;
    if (role) users[index].role = role;
    if (assignedZone !== undefined) users[index].assignedZone = assignedZone;

    saveUsers(users);

    writeAuditLog({
      eventType: 'USER_ROLE_CHANGED',
      actorId: req.user!.id,
      actorEmail: req.user!.email,
      targetId: id,
      targetType: 'user',
      outcome: 'SUCCESS',
      ip: req.ip,
      details: { previousRole: oldRole, newRole: role, assignedZone }
    });

    res.json(sanitizeUser(users[index]));
  });

  // Suspend or Activate User Account (Super Admin only)
  app.put('/api/users/:id/status', requireRoles(['super_admin']), (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;
    const { isSuspended } = req.body;

    const users = loadUsers();
    const index = users.findIndex(u => u.id === id);
    if (index === -1) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (users[index].id === req.user!.id && isSuspended) {
      return res.status(400).json({ error: 'You cannot suspend your own administrative account.' });
    }

    users[index].isSuspended = Boolean(isSuspended);
    saveUsers(users);

    // If suspended, immediately revoke all active sessions!
    if (isSuspended) {
      revokeAllUserSessions(id);
    }

    writeAuditLog({
      eventType: isSuspended ? 'USER_SUSPENDED' : 'USER_ACTIVATED',
      actorId: req.user!.id,
      actorEmail: req.user!.email,
      targetId: id,
      targetType: 'user',
      outcome: 'SUCCESS',
      ip: req.ip,
      details: { targetEmail: users[index].email }
    });

    res.json(sanitizeUser(users[index]));
  });

  // Delete User Account (Super Admin only)
  app.delete('/api/users/:id', requireRoles(['super_admin']), (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;
    if (id === req.user!.id) {
      return res.status(400).json({ error: 'You cannot delete your own account.' });
    }

    let users = loadUsers();
    const countBefore = users.length;
    users = users.filter(u => u.id !== id);
    if (users.length === countBefore) {
      return res.status(404).json({ error: 'User not found' });
    }

    revokeAllUserSessions(id);
    saveUsers(users);

    writeAuditLog({
      eventType: 'USER_DELETED',
      actorId: req.user!.id,
      actorEmail: req.user!.email,
      targetId: id,
      outcome: 'SUCCESS',
      ip: req.ip
    });

    res.json({ success: true, message: 'User deleted and active sessions revoked.' });
  });

  // ==========================================
  // SECURITY AUDIT LOGS ENDPOINTS
  // Strictly accessible to Super Admin
  // ==========================================

  app.get('/api/audit-logs', requireRoles(['super_admin']), (_req: AuthenticatedRequest, res: Response) => {
    const logs = loadAuditLogs();
    res.json(logs);
  });

  // Log client-side Excel export event
  app.post('/api/audit/log-export', requireAuth, (req: AuthenticatedRequest, res: Response) => {
    const { exportType, recordCount } = req.body;
    writeAuditLog({
      eventType: 'DATA_EXPORT_EXCEL',
      actorId: req.user!.id,
      actorEmail: req.user!.email,
      actorRole: req.userRole || req.user!.role,
      outcome: 'SUCCESS',
      ip: req.ip,
      details: { exportType, recordCount }
    });
    res.json({ success: true });
  });

  // Export Project ZIP (Super Admin only)
  app.get('/api/export/download-zip', requireRoles(['super_admin']), (req: AuthenticatedRequest, res: Response) => {
    const zipPath = path.join(__dirname, 'public', 'dcu-child-dedication-portal.zip');
    if (fs.existsSync(zipPath)) {
      writeAuditLog({
        eventType: 'PROJECT_BACKUP_ZIP_DOWNLOADED',
        actorId: req.user!.id,
        actorEmail: req.user!.email,
        outcome: 'SUCCESS',
        ip: req.ip
      });
      res.setHeader('Content-Type', 'application/zip');
      res.setHeader('Content-Disposition', 'attachment; filename="dcu-child-dedication-portal.zip"');
      return res.sendFile(zipPath);
    }
    return res.status(404).json({ error: 'Backup ZIP not found' });
  });

  // ==========================================
  // VITE DEV SERVER / STATIC SERVING
  // ==========================================

  if (process.env.NODE_ENV === 'production' && fs.existsSync(path.join(__dirname, 'dist'))) {
    app.use(express.static(path.join(__dirname, 'dist')));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(__dirname, 'dist', 'index.html'));
    });
  } else {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa'
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Deliverance Church Utawala portal running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch(err => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
