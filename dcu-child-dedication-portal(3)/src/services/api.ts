import { DedicationRecord, UserProfile, PastDedicationRecord } from '../types';
import { INITIAL_DEDICATIONS, INITIAL_USERS } from '../data/initialDedications';
import { INITIAL_PAST_DEDICATIONS } from '../data/pastDedications';

const LOCAL_STORAGE_KEY = 'dcu_dedications_cache_v2';
const USERS_STORAGE_KEY = 'dcu_users_cache_v2';
const PAST_STORAGE_KEY = 'dcu_past_dedications_cache_v1';

function getLocalCache(): DedicationRecord[] {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch (e) {
    console.warn('Could not read from local cache', e);
  }
  return INITIAL_DEDICATIONS;
}

function saveLocalCache(data: DedicationRecord[]) {
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(data));
  } catch (e) {
    console.warn('Could not save to local cache', e);
  }
}

function getPastLocalCache(): PastDedicationRecord[] {
  try {
    const raw = localStorage.getItem(PAST_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch (e) {
    console.warn('Could not read past local cache', e);
  }
  return INITIAL_PAST_DEDICATIONS;
}

function savePastLocalCache(data: PastDedicationRecord[]) {
  try {
    localStorage.setItem(PAST_STORAGE_KEY, JSON.stringify(data));
  } catch (e) {
    console.warn('Could not save past local cache', e);
  }
}

export const api = {
  async getDedications(): Promise<DedicationRecord[]> {
    try {
      const res = await fetch('/api/dedications');
      if (res.ok) {
        const data = await res.json();
        saveLocalCache(data);
        return data;
      }
    } catch (e) {
      console.warn('Backend fetch failed, using local cache', e);
    }
    return getLocalCache();
  },

  async createDedication(record: Partial<DedicationRecord>): Promise<DedicationRecord> {
    try {
      const res = await fetch('/api/dedications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(record)
      });
      if (res.ok) {
        const created = await res.json();
        const current = getLocalCache();
        saveLocalCache([created, ...current]);
        return created;
      }
    } catch (e) {
      console.warn('Backend POST failed, saving to local cache', e);
    }

    // Fallback local save
    const current = getLocalCache();
    const county = record.childCountyOfBirth || record.childPlaceOfBirth || 'Nairobi';
    const fallback: DedicationRecord = {
      id: `DED-${new Date().getFullYear()}-${String(current.length + 1).padStart(3, '0')}`,
      childName: record.childName || 'Child',
      childDob: record.childDob || '2026-01-01',
      childGender: record.childGender || 'Male',
      childCountyOfBirth: county,
      childPlaceOfBirth: county,
      fatherName: record.fatherName || '',
      fatherPhone: record.fatherPhone || '',
      fatherEmail: record.fatherEmail || '',
      motherName: record.motherName || '',
      motherPhone: record.motherPhone || '',
      motherEmail: record.motherEmail || '',
      parentName: `${record.fatherName || ''} & ${record.motherName || ''}`.trim(),
      parentPhone: record.fatherPhone || record.motherPhone || '',
      parentEmail: record.fatherEmail || record.motherEmail || '',
      parentRelationship: 'Parents',
      isInFellowship: record.isInFellowship ?? true,
      selectedZone: record.selectedZone || 'Zone A',
      selectedFellowship: record.selectedFellowship || 'Doxa',
      residentialLocation: record.residentialLocation || '',
      dataConsent: true,
      status: 'submitted',
      serviceDate: record.serviceDate || '2026-11-29',
      leadershipConfirmed: false,
      officeApproved: false,
      certificateIssued: false,
      certificateNumber: `DCU-DED-${new Date().getFullYear()}-${String(current.length + 90).padStart(3, '0')}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      ...record
    } as DedicationRecord;

    saveLocalCache([fallback, ...current]);
    return fallback;
  },

  async updateDedication(id: string, updates: Partial<DedicationRecord>): Promise<DedicationRecord> {
    try {
      const res = await fetch(`/api/dedications/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates)
      });
      if (res.ok) {
        const updated = await res.json();
        const current = getLocalCache().map(d => d.id === id ? updated : d);
        saveLocalCache(current);
        return updated;
      }
    } catch (e) {
      console.warn('Backend update failed, updating local cache', e);
    }

    const current = getLocalCache();
    const idx = current.findIndex(d => d.id === id);
    if (idx !== -1) {
      current[idx] = { ...current[idx], ...updates, updatedAt: new Date().toISOString() };
      saveLocalCache(current);
      return current[idx];
    }
    throw new Error('Record not found');
  },

  async deleteDedication(id: string): Promise<boolean> {
    try {
      const res = await fetch(`/api/dedications/${id}`, { method: 'DELETE' });
      if (res.ok) {
        const current = getLocalCache().filter(d => d.id !== id);
        saveLocalCache(current);
        return true;
      }
    } catch (e) {
      console.warn('Backend delete failed, removing from local cache', e);
    }

    const current = getLocalCache().filter(d => d.id !== id);
    saveLocalCache(current);
    return true;
  },

  async bulkImport(records: any[]): Promise<{ count: number; total: number }> {
    try {
      const res = await fetch('/api/dedications/bulk-import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(records)
      });
      if (res.ok) {
        const result = await res.json();
        const fresh = await this.getDedications();
        saveLocalCache(fresh);
        return result;
      }
    } catch (e) {
      console.warn('Backend bulk import failed', e);
    }

    // Local fallback
    const current = getLocalCache();
    const newItems: DedicationRecord[] = records.map((r, i) => {
      const county = r.childCountyOfBirth || r.childPlaceOfBirth || 'Nairobi';
      return {
        id: `DED-IMP-${Date.now()}-${i}`,
        childName: r.childName || 'Child',
        childDob: r.childDob || '2026-01-01',
        childGender: r.childGender || 'Male',
        childCountyOfBirth: county,
        childPlaceOfBirth: `${county} County`,
        fatherName: r.fatherName || r.parentName || '',
        fatherPhone: r.fatherPhone || r.parentPhone || '',
        fatherEmail: r.fatherEmail || r.parentEmail || '',
        motherName: r.motherName || '',
        motherPhone: r.motherPhone || '',
        motherEmail: r.motherEmail || '',
        parentName: r.parentName || r.fatherName || 'Parent',
        parentPhone: r.parentPhone || r.fatherPhone || '',
        parentEmail: r.parentEmail || r.fatherEmail || '',
        parentRelationship: r.parentRelationship || 'Parents',
        isInFellowship: r.isInFellowship ?? true,
        selectedZone: r.selectedZone || 'Zone A',
        selectedFellowship: r.selectedFellowship || 'Doxa',
        residentialLocation: r.residentialLocation || '',
        dataConsent: true,
        status: r.status || 'compiled',
        serviceDate: r.serviceDate || '2026-11-29',
        leadershipConfirmed: true,
        officeApproved: true,
        certificateIssued: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
    });

    const combined = [...newItems, ...current];
    saveLocalCache(combined);
    return { count: newItems.length, total: combined.length };
  },

  async createAccount(data: {
    email: string;
    name: string;
    role: UserProfile['role'];
    assignedZone?: 'Zone A' | 'Zone B' | 'Zone C' | 'Zone D' | 'Zone E';
    phone?: string;
  }): Promise<UserProfile> {
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      if (res.ok) return await res.json();
    } catch (e) {
      console.warn('Backend register failed, saving to local cache', e);
    }

    const isSystemAdmin = data.email.toLowerCase() === 'fawany@gmail.com' || data.email.toLowerCase().includes('admin');
    const newUser: UserProfile = {
      id: `usr-${Date.now()}`,
      email: data.email.toLowerCase(),
      name: data.name,
      role: isSystemAdmin ? 'admin' : (data.role || 'fellowship_leader'),
      assignedZone: data.assignedZone,
      phone: data.phone,
      isApproved: true,
      authProvider: 'email',
      avatar: `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(data.name)}`,
      createdAt: new Date().toISOString()
    };

    return newUser;
  },

  async login(email: string, name?: string, role?: UserProfile['role'], assignedZone?: any): Promise<UserProfile> {
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, name, role, assignedZone })
      });
      if (res.ok) return await res.json();
    } catch (e) {
      console.warn('Backend auth login failed', e);
    }

    const isSystemAdmin = email.toLowerCase() === 'fawany@gmail.com' || email.toLowerCase().includes('admin');
    return {
      id: `usr-${Date.now()}`,
      email: email.toLowerCase(),
      name: name || email.split('@')[0],
      role: isSystemAdmin ? 'admin' : (role || 'fellowship_leader'),
      assignedZone: assignedZone || (role === 'fellowship_leader' ? 'Zone A' : undefined),
      isApproved: true,
      authProvider: 'email',
      createdAt: new Date().toISOString()
    };
  },

  async loginGoogle(email: string, name: string, avatar?: string, role?: UserProfile['role'], assignedZone?: any): Promise<UserProfile> {
    try {
      const res = await fetch('/api/auth/google', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, name, avatar, role, assignedZone })
      });
      if (res.ok) return await res.json();
    } catch (e) {
      console.warn('Backend Google auth failed', e);
    }

    const isSystemAdmin = email.toLowerCase() === 'fawany@gmail.com' || email.toLowerCase().includes('admin');
    return {
      id: `usr-${Date.now()}`,
      email: email.toLowerCase(),
      name: name,
      avatar: avatar || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(name)}`,
      role: isSystemAdmin ? 'admin' : (role || (email.toLowerCase().includes('zone') ? 'fellowship_leader' : 'fellowship_leader')),
      assignedZone: assignedZone,
      isApproved: true,
      authProvider: 'google',
      createdAt: new Date().toISOString()
    };
  },

  async getUsers(): Promise<UserProfile[]> {
    try {
      const res = await fetch('/api/users');
      if (res.ok) return await res.json();
    } catch (e) {
      console.warn('Backend users fetch failed', e);
    }
    return INITIAL_USERS as UserProfile[];
  },

  // ==========================================
  // PAST / HISTORICAL DEDICATIONS (2009 - DATE)
  // Completely separate from active candidate registrations
  // ==========================================
  async getPastDedications(): Promise<PastDedicationRecord[]> {
    try {
      const res = await fetch('/api/past-dedications');
      if (res.ok) {
        const data = await res.json();
        savePastLocalCache(data);
        return data;
      }
    } catch (e) {
      console.warn('Backend past dedications fetch failed, using local cache', e);
    }
    return getPastLocalCache();
  },

  async createPastDedication(record: Partial<PastDedicationRecord>): Promise<PastDedicationRecord> {
    try {
      const res = await fetch('/api/past-dedications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(record)
      });
      if (res.ok) {
        const created = await res.json();
        const current = getPastLocalCache();
        savePastLocalCache([created, ...current]);
        return created;
      }
    } catch (e) {
      console.warn('Backend POST past dedication failed, saving to local cache', e);
    }

    const current = getPastLocalCache();
    const year = record.dedicationYear || 
      (record.serviceDate ? parseInt(record.serviceDate.slice(0, 4)) : 2024);
    const county = record.childCountyOfBirth || record.childPlaceOfBirth || 'Nairobi';
    const fallback: PastDedicationRecord = {
      id: `HIST-${year}-${String(current.length + 1).padStart(3, '0')}`,
      childName: record.childName || 'Child Name',
      childDob: record.childDob || `${year}-01-01`,
      childGender: record.childGender || 'Male',
      childCountyOfBirth: county,
      childPlaceOfBirth: county,
      fatherName: record.fatherName || '',
      fatherPhone: record.fatherPhone || '',
      motherName: record.motherName || '',
      motherPhone: record.motherPhone || '',
      parentName: record.parentName || `${record.fatherName || ''} & ${record.motherName || ''}`.trim(),
      parentPhone: record.parentPhone || record.fatherPhone || record.motherPhone || '',
      selectedZone: record.selectedZone || 'Zone A',
      selectedFellowship: record.selectedFellowship || 'Doxa',
      dedicationYear: year,
      serviceDate: record.serviceDate || `${year}-11-29`,
      certificateNumber: record.certificateNumber || `DCU-DED-${year}-${String(current.length + 1).padStart(3, '0')}`,
      certificateIssued: true,
      officiatingMinister: record.officiatingMinister || 'Senior Pastor & Presbytery',
      notes: record.notes || 'Historical register record',
      archivalSource: record.archivalSource || 'Historical Church Register',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      ...record
    } as PastDedicationRecord;

    savePastLocalCache([fallback, ...current]);
    return fallback;
  },

  async bulkImportPastDedications(records: any[]): Promise<{ success: boolean; count: number }> {
    try {
      const res = await fetch('/api/past-dedications/bulk-import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(records)
      });
      if (res.ok) {
        const result = await res.json();
        // Refresh local cache
        const fresh = await this.getPastDedications();
        return { success: true, count: result.count || records.length };
      }
    } catch (e) {
      console.warn('Backend bulk import past failed, saving to local cache', e);
    }

    // Local fallback
    const current = getPastLocalCache();
    const formatted: PastDedicationRecord[] = records.map((rec, i) => {
      const year = Number(rec.dedicationYear) || 
        (rec.serviceDate ? parseInt(String(rec.serviceDate).slice(0, 4)) : 2009);
      const county = rec.childCountyOfBirth || rec.childPlaceOfBirth || 'Nairobi';
      const childName = (rec.childName || rec['Child Full Name'] || rec['Child Name'] || 'Dedicated Child').trim();
      const father = (rec.fatherName || rec['Father Name'] || '').trim();
      const mother = (rec.motherName || rec['Mother Name'] || '').trim();

      return {
        id: rec.id || `HIST-${year}-${String(current.length + i + 1).padStart(3, '0')}`,
        childName,
        childDob: rec.childDob || rec['Date of Birth'] || `${year}-01-01`,
        childGender: (rec.childGender === 'Female' || rec['Gender'] === 'Female') ? 'Female' : 'Male',
        childCountyOfBirth: county,
        childPlaceOfBirth: county,
        fatherName: father,
        fatherPhone: rec.fatherPhone || rec['Father Phone'] || '',
        motherName: mother,
        motherPhone: rec.motherPhone || rec['Mother Phone'] || '',
        parentName: rec.parentName || rec['Parent Name'] || `${father} & ${mother}`.trim(),
        parentPhone: rec.parentPhone || rec.fatherPhone || rec.motherPhone || '',
        selectedZone: rec.selectedZone || rec['Fellowship Zone'] || 'Zone A',
        selectedFellowship: rec.selectedFellowship || rec['Fellowship Name'] || 'Fellowship',
        dedicationYear: isNaN(year) ? 2009 : year,
        serviceDate: rec.serviceDate || rec['Dedicated Date'] || `${year}-11-29`,
        certificateNumber: rec.certificateNumber || rec['Certificate No'] || `DCU-DED-${year}-${String(current.length + i + 1).padStart(3, '0')}`,
        certificateIssued: true,
        officiatingMinister: rec.officiatingMinister || rec['Officiating Minister'] || 'Senior Pastor & Presbytery',
        notes: rec.notes || rec['Notes'] || 'Imported historical archive from 2009+ register',
        archivalSource: rec.archivalSource || 'Historical Church Register',
        createdAt: new Date().toISOString()
      };
    });

    const combined = [...formatted, ...current];
    savePastLocalCache(combined);
    return { success: true, count: formatted.length };
  },

  async updatePastDedication(id: string, updates: Partial<PastDedicationRecord>): Promise<PastDedicationRecord> {
    try {
      const res = await fetch(`/api/past-dedications/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates)
      });
      if (res.ok) {
        const updated = await res.json();
        const current = getPastLocalCache();
        savePastLocalCache(current.map(d => d.id === id ? updated : d));
        return updated;
      }
    } catch (e) {
      console.warn('Backend PUT past dedication failed', e);
    }

    const current = getPastLocalCache();
    const updated = {
      ...current.find(d => d.id === id)!,
      ...updates,
      updatedAt: new Date().toISOString()
    };
    savePastLocalCache(current.map(d => d.id === id ? updated : d));
    return updated;
  },

  async deletePastDedication(id: string): Promise<boolean> {
    try {
      const res = await fetch(`/api/past-dedications/${id}`, { method: 'DELETE' });
      if (res.ok) {
        const current = getPastLocalCache();
        savePastLocalCache(current.filter(d => d.id !== id));
        return true;
      }
    } catch (e) {
      console.warn('Backend DELETE past dedication failed', e);
    }

    const current = getPastLocalCache();
    savePastLocalCache(current.filter(d => d.id !== id));
    return true;
  }
};
