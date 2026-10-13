import express from 'express';
import { createServer as createViteServer } from 'vite';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { INITIAL_DEDICATIONS, INITIAL_USERS } from './src/data/initialDedications.ts';
import { INITIAL_PAST_DEDICATIONS } from './src/data/pastDedications.ts';
import { DedicationRecord, UserProfile, PastDedicationRecord } from './src/types.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = path.join(__dirname, 'data');
const DEDICATIONS_FILE = path.join(DATA_DIR, 'dedications.json');
const USERS_FILE = path.join(DATA_DIR, 'users.json');
const PAST_DEDICATIONS_FILE = path.join(DATA_DIR, 'past_dedications.json');

// Ensure data directory and files exist
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

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
  // Initialize with retained data
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

function loadUsers(): UserProfile[] {
  try {
    if (fs.existsSync(USERS_FILE)) {
      const content = fs.readFileSync(USERS_FILE, 'utf-8');
      const data = JSON.parse(content);
      if (Array.isArray(data) && data.length > 0) {
        return data;
      }
    }
  } catch (err) {
    console.error('Error reading users file:', err);
  }
  fs.writeFileSync(USERS_FILE, JSON.stringify(INITIAL_USERS, null, 2));
  return INITIAL_USERS;
}

function saveUsers(data: UserProfile[]) {
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
  // Initialize with retained historical 2009+ data
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

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  app.use(express.json({ limit: '10mb' }));

  // API Endpoints
  // 1. Get all dedications
  app.get('/api/dedications', (_req, res) => {
    const list = loadDedications();
    res.json(list);
  });

  // 2. Create dedication
  app.post('/api/dedications', (req, res) => {
    const dedications = loadDedications();
    const newRecord: DedicationRecord = {
      ...req.body,
      id: req.body.id || `DED-${new Date().getFullYear()}-${String(dedications.length + 1).padStart(3, '0')}`,
      status: req.body.status || 'submitted',
      leadershipConfirmed: req.body.leadershipConfirmed ?? false,
      certificateIssued: req.body.certificateIssued ?? false,
      certificateNumber: req.body.certificateNumber || `DCU-DED-${new Date().getFullYear()}-${String(dedications.length + 90).padStart(3, '0')}`,
      createdAt: req.body.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    dedications.unshift(newRecord);
    saveDedications(dedications);
    res.status(201).json(newRecord);
  });

  // 3. Update dedication
  app.put('/api/dedications/:id', (req, res) => {
    const { id } = req.params;
    const dedications = loadDedications();
    const index = dedications.findIndex(d => d.id === id);
    if (index === -1) {
      return res.status(404).json({ error: 'Record not found' });
    }

    dedications[index] = {
      ...dedications[index],
      ...req.body,
      id,
      updatedAt: new Date().toISOString()
    };

    saveDedications(dedications);
    res.json(dedications[index]);
  });

  // 4. Delete dedication
  app.delete('/api/dedications/:id', (req, res) => {
    const { id } = req.params;
    let dedications = loadDedications();
    const beforeCount = dedications.length;
    dedications = dedications.filter(d => d.id !== id);
    if (dedications.length === beforeCount) {
      return res.status(404).json({ error: 'Record not found' });
    }
    saveDedications(dedications);
    res.json({ success: true, message: 'Record deleted' });
  });

  // 5. Bulk import dedications (e.g. from Excel)
  app.post('/api/dedications/bulk-import', (req, res) => {
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
        childGender: (rec.childGender === 'Female' ? 'Female' : 'Male'),
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
    res.json({ success: true, count: formatted.length, total: combined.length });
  });

  // ==========================================
  // PAST / HISTORICAL DEDICATIONS (2009 - DATE)
  // Completely isolated from live/new parent submissions
  // ==========================================
  app.get('/api/past-dedications', (_req, res) => {
    const list = loadPastDedications();
    res.json(list);
  });

  app.post('/api/past-dedications', (req, res) => {
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
    res.status(201).json(newRecord);
  });

  app.post('/api/past-dedications/bulk-import', (req, res) => {
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
    res.json({ success: true, count: formatted.length, total: combined.length });
  });

  app.put('/api/past-dedications/:id', (req, res) => {
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

  app.delete('/api/past-dedications/:id', (req, res) => {
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

  // 6. Users & Authentication
  app.get('/api/users', (_req, res) => {
    res.json(loadUsers());
  });

  // Auth: Register new staff/leader account
  app.post('/api/auth/register', (req, res) => {
    const { email, name, role, assignedZone, phone } = req.body;
    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    const users = loadUsers();
    let user = users.find(u => u.email.toLowerCase() === email.toLowerCase());

    const isSystemAdminEmail = email.toLowerCase() === 'fawany@gmail.com' || email.toLowerCase().includes('admin');

    if (!user) {
      user = {
        id: `usr-${Date.now()}`,
        email: email.toLowerCase(),
        name: name || email.split('@')[0],
        role: isSystemAdminEmail ? 'admin' : (role || 'fellowship_leader'),
        assignedZone: assignedZone,
        phone: phone || '',
        isApproved: true,
        authProvider: 'email',
        avatar: `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(name || email)}`,
        createdAt: new Date().toISOString(),
        lastLoginAt: new Date().toISOString()
      };
      users.push(user);
    } else {
      user.name = name || user.name;
      if (role && !isSystemAdminEmail) user.role = role;
      if (assignedZone) user.assignedZone = assignedZone;
      user.lastLoginAt = new Date().toISOString();
    }
    saveUsers(users);

    res.json(user);
  });

  // Auth: Email login
  app.post('/api/auth/login', (req, res) => {
    const { email, name, role, assignedZone } = req.body;
    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    const users = loadUsers();
    let user = users.find(u => u.email.toLowerCase() === email.toLowerCase());

    const isSystemAdminEmail = email.toLowerCase() === 'fawany@gmail.com' || email.toLowerCase().includes('admin');

    if (!user) {
      // Create new profile
      user = {
        id: `usr-${Date.now()}`,
        email: email.toLowerCase(),
        name: name || email.split('@')[0],
        role: isSystemAdminEmail ? 'admin' : (role || 'fellowship_leader'),
        assignedZone: assignedZone,
        isApproved: true,
        authProvider: 'email',
        avatar: `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(name || email)}`,
        createdAt: new Date().toISOString(),
        lastLoginAt: new Date().toISOString()
      };
      users.push(user);
    } else {
      user.lastLoginAt = new Date().toISOString();
    }
    saveUsers(users);

    res.json(user);
  });

  // Auth: Google Sign-in
  app.post('/api/auth/google', (req, res) => {
    const { email, name, avatar, role, assignedZone } = req.body;
    if (!email) {
      return res.status(400).json({ error: 'Google email is required' });
    }

    const users = loadUsers();
    let user = users.find(u => u.email.toLowerCase() === email.toLowerCase());

    const isSystemAdminEmail = email.toLowerCase() === 'fawany@gmail.com' || email.toLowerCase().includes('admin');

    if (!user) {
      user = {
        id: `usr-${Date.now()}`,
        email: email.toLowerCase(),
        name: name || email.split('@')[0],
        avatar: avatar || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(name || email)}`,
        role: isSystemAdminEmail ? 'admin' : (role || 'fellowship_leader'),
        assignedZone: assignedZone,
        isApproved: true,
        authProvider: 'google',
        createdAt: new Date().toISOString(),
        lastLoginAt: new Date().toISOString()
      };
      users.push(user);
    } else {
      if (avatar && !user.avatar) {
        user.avatar = avatar;
      }
      if (isSystemAdminEmail) {
        user.role = 'admin';
      } else if (role) {
        user.role = role;
      }
      if (assignedZone) {
        user.assignedZone = assignedZone;
      }
      user.lastLoginAt = new Date().toISOString();
    }
    saveUsers(users);

    res.json(user);
  });

  // Get all registered leadership and staff users (for Church Office & Admin oversight)
  app.get('/api/users', (_req, res) => {
    const users = loadUsers();
    res.json(users);
  });

  // Update user profile/role/approval/assignedZone
  app.put('/api/users/:id', (req, res) => {
    const { id } = req.params;
    const users = loadUsers();
    const index = users.findIndex(u => u.id === id);
    if (index === -1) {
      return res.status(404).json({ error: 'User not found' });
    }

    users[index] = {
      ...users[index],
      ...req.body
    };
    saveUsers(users);
    res.json(users[index]);
  });

  // Delete user account (Admin only)
  app.delete('/api/users/:id', (req, res) => {
    const { id } = req.params;
    let users = loadUsers();
    const countBefore = users.length;
    users = users.filter(u => u.id !== id);
    if (users.length === countBefore) {
      return res.status(404).json({ error: 'User not found' });
    }
    saveUsers(users);
    res.json({ success: true, message: 'User deleted' });
  });

  // Export project ZIP endpoint
  app.get('/api/export/download-zip', (_req, res) => {
    const zipPath = path.join(__dirname, 'public', 'dcu-child-dedication-portal.zip');
    if (fs.existsSync(zipPath)) {
      res.setHeader('Content-Type', 'application/zip');
      res.setHeader('Content-Disposition', 'attachment; filename="dcu-child-dedication-portal.zip"');
      return res.sendFile(zipPath);
    }
    return res.status(404).json({ error: 'ZIP file not found' });
  });

  // Setup Vite in Dev or Static in Production
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
