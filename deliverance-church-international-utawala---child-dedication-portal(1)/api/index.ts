import express, { Request, Response } from 'express';
import { INITIAL_DEDICATIONS, INITIAL_USERS } from '../src/data/initialDedications';
import { INITIAL_PAST_DEDICATIONS } from '../src/data/pastDedications';
import { DedicationRecord, UserProfile, UserRole, PastDedicationRecord } from '../src/types';

const app = express();

app.use(express.json());

// In-memory stores for Serverless execution
let memoryUsers: UserProfile[] = [...INITIAL_USERS];
let memoryDedications: DedicationRecord[] = [...INITIAL_DEDICATIONS];
let memoryPastDedications: PastDedicationRecord[] = [...INITIAL_PAST_DEDICATIONS];
let memorySessions: Record<string, UserProfile> = {};

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
    createdAt: '2026-01-01T00:00:00.000Z'
  });
}

function getSessionUser(req: Request): UserProfile | null {
  const auth = req.headers.authorization;
  if (auth && auth.startsWith('Bearer ')) {
    const token = auth.slice(7).trim();
    if (memorySessions[token]) return memorySessions[token];
  }
  // Default to Super Admin for convenience in serverless preview
  return memoryUsers.find(u => u.email === 'fawany@gmail.com') || null;
}

// 1. Login
app.post('/api/auth/login', (req: Request, res: Response) => {
  const { email, password } = req.body || {};
  const cleanEmail = (email || '').toLowerCase().trim();

  if (cleanEmail === 'fawany@gmail.com') {
    if (password && password !== 'DcuAdmin2026!#') {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }
    let admin = memoryUsers.find(u => u.email === 'fawany@gmail.com');
    if (!admin) {
      admin = {
        id: 'usr-admin-1',
        email: 'fawany@gmail.com',
        name: 'Fawany (Administrator)',
        role: 'super_admin',
        isApproved: true,
        authProvider: 'google',
        createdAt: '2026-01-01T00:00:00.000Z'
      };
      memoryUsers.unshift(admin);
    }
    const token = `tok-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    memorySessions[token] = admin;
    return res.json({ user: admin, token });
  }

  const user = memoryUsers.find(u => u.email.toLowerCase() === cleanEmail);
  if (!user) {
    return res.status(401).json({ error: 'Invalid email or password.' });
  }

  const token = `tok-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  memorySessions[token] = user;
  return res.json({ user, token });
});

// 2. Google Auth
app.post('/api/auth/google', (req: Request, res: Response) => {
  const { email, name, avatar } = req.body || {};
  const cleanEmail = (email || 'fawany@gmail.com').toLowerCase().trim();

  let user = memoryUsers.find(u => u.email.toLowerCase() === cleanEmail);
  if (!user) {
    user = {
      id: `usr-${Date.now()}`,
      email: cleanEmail,
      name: name || cleanEmail.split('@')[0],
      avatar: avatar || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(cleanEmail)}`,
      role: cleanEmail === 'fawany@gmail.com' ? 'super_admin' : 'parent',
      isApproved: true,
      authProvider: 'google',
      createdAt: new Date().toISOString()
    };
    memoryUsers.push(user);
  }

  const token = `tok-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  memorySessions[token] = user;
  return res.json({ user, token });
});

// 3. Me
app.get('/api/auth/me', (req: Request, res: Response) => {
  const user = getSessionUser(req);
  if (!user) return res.status(401).json({ error: 'Not authenticated' });
  return res.json(user);
});

// 4. Dedications
app.get('/api/dedications', (req: Request, res: Response) => {
  const user = getSessionUser(req);
  if (!user) return res.json([]);
  if (user.role === 'super_admin' || user.role === 'office_admin' || user.role === 'pastor' || (user.role as string) === 'admin') {
    return res.json(memoryDedications);
  }
  if (user.role === 'fellowship_leader' && user.assignedZone) {
    return res.json(memoryDedications.filter(d => d.selectedZone === user.assignedZone));
  }
  return res.json(memoryDedications);
});

app.post('/api/dedications', (req: Request, res: Response) => {
  const rec = req.body || {};
  const newRec: DedicationRecord = {
    id: `DED-2026-${String(memoryDedications.length + 1).padStart(3, '0')}`,
    childName: rec.childName || 'Child',
    childDob: rec.childDob || '',
    childGender: rec.childGender || 'Male',
    childCountyOfBirth: rec.childCountyOfBirth || 'Nairobi',
    fatherName: rec.fatherName || '',
    fatherPhone: rec.fatherPhone || '',
    fatherEmail: rec.fatherEmail || '',
    motherName: rec.motherName || '',
    motherPhone: rec.motherPhone || '',
    motherEmail: rec.motherEmail || '',
    isInFellowship: rec.isInFellowship ?? false,
    selectedZone: rec.selectedZone || 'Zone A',
    selectedFellowship: rec.selectedFellowship || 'General',
    dataConsent: true,
    status: 'submitted',
    leadershipConfirmed: false,
    officeApproved: false,
    certificateIssued: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...rec
  };
  memoryDedications.unshift(newRec);
  return res.status(201).json(newRec);
});

app.put('/api/dedications/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  const updates = req.body || {};
  const idx = memoryDedications.findIndex(d => d.id === id);
  if (idx !== -1) {
    memoryDedications[idx] = { ...memoryDedications[idx], ...updates, updatedAt: new Date().toISOString() };
    return res.json(memoryDedications[idx]);
  }
  return res.status(404).json({ error: 'Record not found' });
});

// 5. Past Dedications
app.get('/api/past-dedications', (_req: Request, res: Response) => {
  return res.json(memoryPastDedications);
});

// 6. Users
app.get('/api/users', (_req: Request, res: Response) => {
  return res.json(memoryUsers);
});

// Export Express app for Vercel Serverless
export default app;
