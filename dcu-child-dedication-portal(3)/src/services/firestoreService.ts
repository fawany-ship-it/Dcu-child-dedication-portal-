import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  onSnapshot,
  writeBatch,
  serverTimestamp,
  Timestamp,
  Unsubscribe,
  limit,
} from 'firebase/firestore';
import { db, auth, OperationType, handleFirestoreError } from '../lib/firebase';
import {
  DedicationRecord,
  PastDedicationRecord,
  StaffInvitation,
  UserProfile,
  UserRole,
} from '../types';
import { INITIAL_DEDICATIONS, INITIAL_USERS } from '../data/initialDedications';
import { INITIAL_PAST_DEDICATIONS } from '../data/pastDedications';
import { ZONES } from '../data/zones';

const VALID_ZONES = new Set([
  'Zone A',
  'Zone B',
  'Zone C',
  'Zone D',
  'Zone E',
  'Unallocated',
]);

const SEED_DEDICATION_IDS = new Set(INITIAL_DEDICATIONS.map((d) => d.id));

// Track migrated (oldCollidedId + childName) -> newId locally so repeated boots are idempotent
const RECOVERY_MAP_KEY = 'dcu_firestore_recovery_map_v1';

function getRecoveryMap(): Record<string, string> {
  try {
    return JSON.parse(localStorage.getItem(RECOVERY_MAP_KEY) || '{}');
  } catch {
    return {};
  }
}

function saveRecoveryMapping(compositeKey: string, newId: string) {
  try {
    const map = getRecoveryMap();
    map[compositeKey] = newId;
    localStorage.setItem(RECOVERY_MAP_KEY, JSON.stringify(map));
  } catch {
    // ignore storage limits
  }
}

export function generateUniqueDedicationId(): string {
  const year = new Date().getFullYear();
  const timePart = Date.now().toString(36).toUpperCase().slice(-5);
  const randPart = Math.random().toString(36).toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 4).padEnd(4, 'X');
  return `DED-${year}-${timePart}${randPart}`;
}

export function isFirebaseStaffSignedIn(): boolean {
  return Boolean(auth.currentUser && auth.currentUser.email && auth.currentUser.emailVerified);
}

function timestampToIso(val: unknown, fallback?: string): string {
  if (!val) return fallback || new Date().toISOString();
  if (typeof val === 'string') return val;
  if (val instanceof Timestamp) return val.toDate().toISOString();
  if (typeof (val as any)?.toDate === 'function') {
    return (val as any).toDate().toISOString();
  }
  return fallback || new Date().toISOString();
}

export function normalizeZone(zone?: string): DedicationRecord['selectedZone'] {
  if (!zone) return 'Zone A';
  const trimmed = zone.trim();
  if (VALID_ZONES.has(trimmed)) {
    return trimmed as DedicationRecord['selectedZone'];
  }
  const lower = trimmed.toLowerCase();
  for (const valid of VALID_ZONES) {
    if (valid.toLowerCase() === lower) {
      return valid as DedicationRecord['selectedZone'];
    }
  }
  return 'Unallocated';
}

export function normalizeFellowship(zone: string, fellowship?: string): string {
  const raw = (fellowship || '').replace(/\s+/g, ' ').trim();
  if (!raw) return zone === 'Unallocated' ? 'Unallocated - Follow-up Required' : 'General';
  const stripped = raw.replace(/\s+(fellowship|micro[\s-]*church)$/i, '').trim();
  const z = ZONES.find((item) => item.name === zone);
  if (z) {
    const exact = z.fellowships.find(
      (f) => f.toLowerCase() === raw.toLowerCase() || f.toLowerCase() === stripped.toLowerCase()
    );
    if (exact) return exact;
  }
  return raw.slice(0, 100);
}

export function normalizePhoneKey(phone?: string): string {
  const digits = (phone || '').replace(/[^\d]/g, '');
  if (digits.length < 7) return '';
  return digits.length >= 9 ? digits.slice(-9) : digits;
}

async function sha256Hex(input: string): Promise<string> {
  if (typeof crypto !== 'undefined' && crypto.subtle) {
    const data = new TextEncoder().encode(input);
    const digest = await crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(digest))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  }
  // Simple deterministic fallback if subtle is unavailable in non-secure context
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h += (h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24);
  }
  return `fnv-${(h >>> 0).toString(16)}`;
}

export async function buildPhoneHashes(record: Partial<DedicationRecord>): Promise<string[]> {
  const candidates = [record.fatherPhone, record.motherPhone, record.parentPhone];
  const uniqueKeys = Array.from(
    new Set(candidates.map((p) => normalizePhoneKey(p)).filter(Boolean))
  ).slice(0, 4);
  return Promise.all(uniqueKeys.map((k) => sha256Hex(k)));
}

function buildDedicationPayload(
  record: Partial<DedicationRecord> & { id: string },
  forceInitialState: boolean
): Record<string, any> {
  const zone = normalizeZone(record.selectedZone);
  const fellowship = normalizeFellowship(zone, record.selectedFellowship);
  const childName = String(record.childName || 'Unnamed Child').trim().slice(0, 160);
  const childDob = String(record.childDob || '2026-01-01').trim().slice(0, 32) || '2026-01-01';
  const childCounty = String(record.childCountyOfBirth || record.childPlaceOfBirth || 'Nairobi').trim().slice(0, 80) || 'Nairobi';
  const status = forceInitialState
    ? 'submitted'
    : (['submitted', 'fellowship_confirmed', 'office_approved', 'compiled', 'completed'].includes(String(record.status))
        ? record.status
        : 'submitted');

  const base: Record<string, any> = {
    id: record.id.replace(/[^a-zA-Z0-9_\-]/g, '-').slice(0, 128),
    childName,
    childDob,
    childGender: record.childGender === 'Female' ? 'Female' : 'Male',
    childCountyOfBirth: childCounty,
    isInFellowship: Boolean(record.isInFellowship ?? zone !== 'Unallocated'),
    selectedZone: zone,
    selectedFellowship: fellowship,
    dataConsent: true,
    status,
    leadershipConfirmed: forceInitialState ? false : Boolean(record.leadershipConfirmed),
    officeApproved: forceInitialState ? false : Boolean(record.officeApproved),
    certificateIssued: forceInitialState ? false : Boolean(record.certificateIssued),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  const optionalStrings: Array<[string, unknown, number]> = [
    ['childPlaceOfBirth', record.childPlaceOfBirth || `${childCounty} County`, 120],
    ['fatherName', record.fatherName, 160],
    ['fatherPhone', record.fatherPhone, 40],
    ['fatherEmail', record.fatherEmail, 160],
    ['motherName', record.motherName, 160],
    ['motherPhone', record.motherPhone, 40],
    ['motherEmail', record.motherEmail, 160],
    [
      'parentName',
      record.parentName ||
        `${record.fatherName || ''} & ${record.motherName || ''}`.replace(/^ & | & $/g, '').trim(),
      200,
    ],
    ['parentPhone', record.parentPhone || record.fatherPhone || record.motherPhone, 40],
    ['parentEmail', record.parentEmail || record.fatherEmail || record.motherEmail, 160],
    ['parentRelationship', record.parentRelationship || 'Parents', 60],
    ['residentialLocation', record.residentialLocation, 240],
    ['serviceDate', record.serviceDate || 'To be scheduled by Pastoral Office', 80],
    ['submittedBy', record.submittedBy, 160],
  ];

  if (!forceInitialState) {
    optionalStrings.push(
      ['fellowshipLeaderName', record.fellowshipLeaderName, 160],
      ['fellowshipConfirmedAt', record.fellowshipConfirmedAt, 64],
      ['fellowshipNotes', record.fellowshipNotes, 500],
      ['officeAdminName', record.officeAdminName, 160],
      ['officeConfirmedAt', record.officeConfirmedAt, 64],
      ['officeNotes', record.officeNotes, 500],
      ['certificateNumber', record.certificateNumber, 80]
    );
  }

  for (const [key, val, maxLen] of optionalStrings) {
    if (typeof val === 'string' && val.trim().length > 0) {
      base[key] = val.trim().slice(0, maxLen);
    }
  }

  return base;
}

async function buildDedicationStatusPayload(
  dedicationPayload: Record<string, any>,
  phoneSource: Partial<DedicationRecord>
): Promise<Record<string, any>> {
  const phoneHashes = await buildPhoneHashes(phoneSource);
  const statusDoc: Record<string, any> = {
    id: dedicationPayload.id,
    childName: dedicationPayload.childName,
    childNameLower: dedicationPayload.childName.toLowerCase(),
    selectedZone: dedicationPayload.selectedZone,
    selectedFellowship: dedicationPayload.selectedFellowship,
    status: dedicationPayload.status,
    leadershipConfirmed: Boolean(dedicationPayload.leadershipConfirmed),
    officeApproved: Boolean(dedicationPayload.officeApproved),
    certificateIssued: Boolean(dedicationPayload.certificateIssued),
    phoneHashes,
    createdAt: dedicationPayload.createdAt || serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  if (typeof dedicationPayload.serviceDate === 'string' && dedicationPayload.serviceDate.trim()) {
    statusDoc.serviceDate = dedicationPayload.serviceDate.trim().slice(0, 80);
  }
  if (typeof dedicationPayload.certificateNumber === 'string' && dedicationPayload.certificateNumber.trim()) {
    statusDoc.certificateNumber = dedicationPayload.certificateNumber.trim().slice(0, 80);
  }

  return statusDoc;
}

function docToDedicationRecord(data: Record<string, any>): DedicationRecord {
  return {
    id: data.id,
    childName: data.childName || '',
    childDob: data.childDob || '',
    childGender: data.childGender === 'Female' ? 'Female' : 'Male',
    childCountyOfBirth: data.childCountyOfBirth || 'Nairobi',
    childPlaceOfBirth: data.childPlaceOfBirth || '',
    fatherName: data.fatherName || '',
    fatherPhone: data.fatherPhone || '',
    fatherEmail: data.fatherEmail || '',
    motherName: data.motherName || '',
    motherPhone: data.motherPhone || '',
    motherEmail: data.motherEmail || '',
    parentName: data.parentName || '',
    parentPhone: data.parentPhone || '',
    parentEmail: data.parentEmail || '',
    parentRelationship: data.parentRelationship || 'Parents',
    isInFellowship: Boolean(data.isInFellowship),
    selectedZone: data.selectedZone || 'Zone A',
    selectedFellowship: data.selectedFellowship || 'General',
    residentialLocation: data.residentialLocation || '',
    dataConsent: Boolean(data.dataConsent ?? true),
    status: data.status || 'submitted',
    serviceDate: data.serviceDate || 'To be scheduled by Pastoral Office',
    leadershipConfirmed: Boolean(data.leadershipConfirmed),
    fellowshipLeaderName: data.fellowshipLeaderName,
    fellowshipConfirmedAt: data.fellowshipConfirmedAt,
    fellowshipNotes: data.fellowshipNotes,
    officeApproved: Boolean(data.officeApproved),
    officeAdminName: data.officeAdminName,
    officeConfirmedAt: data.officeConfirmedAt,
    officeNotes: data.officeNotes,
    certificateIssued: Boolean(data.certificateIssued),
    certificateNumber: data.certificateNumber,
    submittedBy: data.submittedBy,
    createdAt: timestampToIso(data.createdAt),
    updatedAt: timestampToIso(data.updatedAt),
  };
}

function docToStatusProjection(data: Record<string, any>) {
  return {
    id: data.id,
    childName: data.childName,
    status: data.status,
    serviceDate: data.serviceDate || 'To be scheduled by Pastoral Office',
    leadershipConfirmed: Boolean(data.leadershipConfirmed),
    officeApproved: Boolean(data.officeApproved),
    certificateIssued: Boolean(data.certificateIssued),
    certificateNumber: data.certificateIssued ? data.certificateNumber : undefined,
    selectedZone: data.selectedZone,
    selectedFellowship: data.selectedFellowship,
    createdAt: timestampToIso(data.createdAt),
    updatedAt: timestampToIso(data.updatedAt),
  };
}

// ==========================================
// 1. PUBLIC PARENT SUBMISSION & RECOVERY SYNC
// ==========================================

export async function submitDedicationToFirestore(
  record: Partial<DedicationRecord>
): Promise<DedicationRecord> {
  const id = (record.id && /^[a-zA-Z0-9_\-]{3,128}$/.test(record.id))
    ? record.id
    : generateUniqueDedicationId();

  // Rules enforce strict initial create state: status == 'submitted' & unconfirmed flags
  const initialPayload = buildDedicationPayload({ ...record, id }, true);
  const statusPayload = await buildDedicationStatusPayload(initialPayload, record);

  const batch = writeBatch(db);
  batch.set(doc(db, 'dedications', id), initialPayload);
  batch.set(doc(db, 'dedication_status', id), statusPayload);

  try {
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, `dedications/${id}`);
  }

  return docToDedicationRecord({
    ...initialPayload,
    createdAt: record.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });
}

// Non-disruptive recovery: upload any ongoing submissions stored in localStorage
// to Firestore so parents' and leaders' cross-device views stay completely intact.
let syncInProgress: Promise<number> | null = null;
export async function syncLocalSubmissionsToFirestore(): Promise<number> {
  if (typeof window === 'undefined') return 0;
  if (syncInProgress) return syncInProgress;

  syncInProgress = (async () => {
    let uploadedCount = 0;
    try {
      const fullRecords: DedicationRecord[] = JSON.parse(
        localStorage.getItem('dcu_v2_dedications') || '[]'
      );
      const recentRecords: any[] = JSON.parse(
        localStorage.getItem('dcu_parent_recent_submissions') || '[]'
      );
      const recoveryMap = getRecoveryMap();
      let deletedIdSet = new Set<string>();
      try {
        const deletedArr = JSON.parse(localStorage.getItem('dcu_deleted_dedication_ids_v1') || '[]');
        if (Array.isArray(deletedArr)) deletedIdSet = new Set(deletedArr);
      } catch {
        // ignore
      }

      const candidateMap = new Map<string, Partial<DedicationRecord>>();

      if (Array.isArray(fullRecords)) {
        for (const rec of fullRecords) {
          if (!rec || !rec.id || SEED_DEDICATION_IDS.has(rec.id) || deletedIdSet.has(rec.id)) continue;
          if (!rec.childName) continue;
          candidateMap.set(`${rec.id}::${rec.childName.toLowerCase().trim()}`, rec);
        }
      }

      if (Array.isArray(recentRecords)) {
        for (const item of recentRecords) {
          if (!item || !item.id || !item.childName) continue;
          if (SEED_DEDICATION_IDS.has(item.id) || deletedIdSet.has(item.id)) continue;
          const compKey = `${item.id}::${String(item.childName).toLowerCase().trim()}`;
          if (!candidateMap.has(compKey)) {
            const fallbackZone = item.selectedZone ? normalizeZone(item.selectedZone) : 'Zone A';
            const fallbackFellowship = item.selectedFellowship
              ? normalizeFellowship(fallbackZone, item.selectedFellowship)
              : 'General';
            candidateMap.set(compKey, {
              id: item.id,
              childName: item.childName,
              childDob: '2026-01-01',
              childGender: 'Male',
              childCountyOfBirth: 'Nairobi',
              parentPhone: item.phone || '',
              fatherPhone: item.phone || '',
              isInFellowship: fallbackZone !== 'Unallocated',
              selectedZone: fallbackZone,
              selectedFellowship: fallbackFellowship,
              serviceDate: item.serviceDate || 'To be scheduled by Pastoral Office',
              dataConsent: true,
              status: 'submitted',
              leadershipConfirmed: false,
              officeApproved: false,
              certificateIssued: false,
              createdAt: item.submittedAt || new Date().toISOString(),
            });
          }
        }
      }

      if (candidateMap.size === 0) return 0;

      let recentChanged = false;
      const updatedRecent = Array.isArray(recentRecords) ? [...recentRecords] : [];

      for (const [compKey, candidate] of candidateMap.entries()) {
        const targetId = recoveryMap[compKey] || candidate.id!;
        const statusRef = doc(db, 'dedication_status', targetId);
        let existingSnap;
        try {
          existingSnap = await getDoc(statusRef);
        } catch {
          continue;
        }

        if (existingSnap.exists()) {
          const existingData = existingSnap.data();
          const existingLower = String(existingData.childNameLower || '').trim();
          const candLower = String(candidate.childName || '').toLowerCase().trim();
          if (existingLower === candLower) {
            // Already exists in Firestore under targetId; ensure local recent entry points to targetId
            if (targetId !== candidate.id) {
              for (const r of updatedRecent) {
                if (
                  r.id === candidate.id &&
                  String(r.childName || '').toLowerCase().trim() === candLower
                ) {
                  r.id = targetId;
                  recentChanged = true;
                }
              }
            }
            continue;
          }

          // ID collision detected (e.g. both siblings got DED-2026-008)! Re-home this child to a unique ID.
          const newUniqueId = generateUniqueDedicationId();
          const created = await submitDedicationToFirestore({ ...candidate, id: newUniqueId });
          saveRecoveryMapping(compKey, created.id);
          uploadedCount++;

          for (const r of updatedRecent) {
            if (
              r.id === candidate.id &&
              String(r.childName || '').toLowerCase().trim() === candLower
            ) {
              r.id = created.id;
              recentChanged = true;
            }
          }
        } else {
          // Missing in Firestore — upload cleanly preserving its ID
          await submitDedicationToFirestore({ ...candidate, id: targetId });
          saveRecoveryMapping(compKey, targetId);
          uploadedCount++;
        }
      }

      if (recentChanged) {
        try {
          localStorage.setItem('dcu_parent_recent_submissions', JSON.stringify(updatedRecent));
        } catch {
          // ignore
        }
      }
    } catch (e) {
      console.warn('Background local submission sync notice:', e);
    } finally {
      syncInProgress = null;
    }
    return uploadedCount;
  })();

  return syncInProgress;
}

// ==========================================
// 2. PUBLIC LOGIN-FREE PARENT MULTI-CHILD TRACKING
// ==========================================

export async function trackDedicationsInFirestore(
  queryStr: string,
  phone?: string
): Promise<any[]> {
  const cleanQuery = queryStr.trim();
  const cleanLower = cleanQuery.toLowerCase();
  const cleanDigits = (phone || cleanQuery).replace(/[^\d]/g, '');

  const resultsMap = new Map<string, any>();

  // 1. Exact Reference ID lookup
  if (/^[a-zA-Z0-9_\-]{3,128}$/.test(cleanQuery)) {
    try {
      const snap = await getDoc(doc(db, 'dedication_status', cleanQuery.toUpperCase()));
      if (snap.exists()) {
        const proj = docToStatusProjection(snap.data());
        resultsMap.set(proj.id, proj);
      } else if (cleanQuery.toUpperCase() !== cleanQuery) {
        const snapRaw = await getDoc(doc(db, 'dedication_status', cleanQuery));
        if (snapRaw.exists()) {
          const proj = docToStatusProjection(snapRaw.data());
          resultsMap.set(proj.id, proj);
        }
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, `dedication_status/${cleanQuery}`);
    }
  }

  // 2. Certificate Number lookup
  if (cleanQuery.length >= 4) {
    try {
      const certQ = query(
        collection(db, 'dedication_status'),
        where('certificateNumber', '==', cleanQuery.toUpperCase())
      );
      const certSnap = await getDocs(certQ);
      certSnap.forEach((d) => {
        const proj = docToStatusProjection(d.data());
        resultsMap.set(proj.id, proj);
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, 'dedication_status');
    }
  }

  // 3. Phone hash lookup (returns ALL children registered under that phone!)
  const phoneKey = normalizePhoneKey(phone || cleanQuery);
  if (phoneKey.length >= 7) {
    try {
      const phoneHash = await sha256Hex(phoneKey);
      const phoneQ = query(
        collection(db, 'dedication_status'),
        where('phoneHashes', 'array-contains', phoneHash)
      );
      const phoneSnap = await getDocs(phoneQ);
      phoneSnap.forEach((d) => {
        const proj = docToStatusProjection(d.data());
        resultsMap.set(proj.id, proj);
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, 'dedication_status');
    }
  }

  // 4. Child name prefix & substring search (PII-free projection)
  if (cleanLower.length >= 2 && cleanDigits.length < 7) {
    try {
      const nameQ = query(
        collection(db, 'dedication_status'),
        where('childNameLower', '>=', cleanLower),
        where('childNameLower', '<=', cleanLower + '\uf8ff')
      );
      const nameSnap = await getDocs(nameQ);
      nameSnap.forEach((d) => {
        const proj = docToStatusProjection(d.data());
        resultsMap.set(proj.id, proj);
      });

      // Substring fallback (e.g. searching surname "Ndolo" finds "Anaya Mutheu Ndolo" & "Jayden Musyoki Ndolo")
      if (resultsMap.size === 0) {
        const allStatusSnap = await getDocs(query(collection(db, 'dedication_status'), limit(300)));
        allStatusSnap.forEach((d) => {
          const data = d.data();
          const cLower = String(data.childNameLower || data.childName || '').toLowerCase();
          const idLower = String(data.id || '').toLowerCase();
          if (cLower.includes(cleanLower) || idLower.includes(cleanLower)) {
            const proj = docToStatusProjection(data);
            resultsMap.set(proj.id, proj);
          }
        });
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, 'dedication_status');
    }
  }

  // Sort newest first
  return Array.from(resultsMap.values()).sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
}

// ==========================================
// 3. STAFF REAL-TIME SUBSCRIPTION & CRUD
// ==========================================

function buildDedicationsQueryForUser(user: UserProfile) {
  const role = (user.role as string) === 'admin' ? 'super_admin' : user.role;
  const baseCol = collection(db, 'dedications');

  if (role === 'super_admin' || role === 'office_admin') {
    return baseCol;
  }
  if (role === 'pastor') {
    if (user.assignedZone) {
      return query(baseCol, where('selectedZone', '==', normalizeZone(user.assignedZone)));
    }
    return baseCol;
  }
  if (role === 'fellowship_leader') {
    const zone = normalizeZone(user.assignedZone || 'Zone A');
    if (user.assignedFellowship && user.assignedFellowship.trim()) {
      const fellowship = normalizeFellowship(zone, user.assignedFellowship);
      return query(
        baseCol,
        where('selectedZone', '==', zone),
        where('selectedFellowship', '==', fellowship)
      );
    }
    return query(baseCol, where('selectedZone', '==', zone));
  }
  return null;
}

export function subscribeDedicationsFromFirestore(
  user: UserProfile,
  onData: (records: DedicationRecord[]) => void,
  onPermissionError?: (err: Error) => void
): Unsubscribe {
  const q = buildDedicationsQueryForUser(user);
  if (!q) {
    onData([]);
    return () => {};
  }

  return onSnapshot(
    q,
    (snapshot) => {
      const records = snapshot.docs
        .map((d) => docToDedicationRecord(d.data()))
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      onData(records);
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, 'dedications');
      } catch (wrapped: any) {
        if (onPermissionError) {
          onPermissionError(wrapped);
        }
      }
    }
  );
}

export async function fetchDedicationsFromFirestore(
  user: UserProfile
): Promise<DedicationRecord[]> {
  const q = buildDedicationsQueryForUser(user);
  if (!q) return [];
  try {
    const snap = await getDocs(q);
    return snap.docs
      .map((d) => docToDedicationRecord(d.data()))
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, 'dedications');
  }
}

export async function updateDedicationInFirestore(
  id: string,
  updates: Partial<DedicationRecord>,
  actor: UserProfile,
  existingRecord?: DedicationRecord
): Promise<void> {
  const role = (actor.role as string) === 'admin' ? 'super_admin' : actor.role;
  const dedRef = doc(db, 'dedications', id);
  const statusRef = doc(db, 'dedication_status', id);

  let statusSnapExists = true;
  let dedSnapData: Record<string, any> | null = existingRecord ? { ...existingRecord } : null;
  try {
    const statusSnap = await getDoc(statusRef);
    statusSnapExists = statusSnap.exists();
    if (!statusSnapExists) {
      const dedSnap = await getDoc(dedRef);
      if (dedSnap.exists()) {
        dedSnapData = dedSnap.data();
      }
    }
  } catch {
    // Proceed with standard update if pre-flight read is skipped
  }

  const batch = writeBatch(db);
  let leaderDedUpdate: Record<string, any> | null = null;
  let leaderStatusUpdate: Record<string, any> | null = null;
  let leaderStatusCreatePayload: Record<string, any> | null = null;

  if (role === 'fellowship_leader') {
    const nextStatus = updates.leadershipConfirmed ? 'fellowship_confirmed' : 'submitted';
    leaderDedUpdate = {
      leadershipConfirmed: Boolean(updates.leadershipConfirmed),
      fellowshipLeaderName: String(updates.fellowshipLeaderName || actor.name || 'Fellowship Leader').slice(0, 160),
      fellowshipConfirmedAt: String(updates.fellowshipConfirmedAt || new Date().toISOString()).slice(0, 64),
      status: nextStatus,
      updatedAt: serverTimestamp(),
    };
    if (typeof updates.fellowshipNotes === 'string') {
      leaderDedUpdate.fellowshipNotes = updates.fellowshipNotes.slice(0, 500);
    }

    batch.update(dedRef, leaderDedUpdate);
    if (statusSnapExists) {
      leaderStatusUpdate = {
        leadershipConfirmed: Boolean(updates.leadershipConfirmed),
        status: nextStatus,
        updatedAt: serverTimestamp(),
      };
      batch.update(statusRef, leaderStatusUpdate);
    } else if (dedSnapData) {
      const mergedSource = {
        ...dedSnapData,
        ...leaderDedUpdate,
        id,
        createdAt: serverTimestamp(),
      };
      leaderStatusCreatePayload = await buildDedicationStatusPayload(
        mergedSource,
        mergedSource as unknown as Partial<DedicationRecord>
      );
      batch.set(statusRef, leaderStatusCreatePayload);
    }
  } else {
    // Super Admin, Office Admin, or Pastor update
    const allowedKeys = new Set([
      'childName', 'childDob', 'childGender', 'childCountyOfBirth', 'childPlaceOfBirth',
      'fatherName', 'fatherPhone', 'fatherEmail',
      'motherName', 'motherPhone', 'motherEmail',
      'parentName', 'parentPhone', 'parentEmail', 'parentRelationship',
      'isInFellowship', 'selectedZone', 'selectedFellowship', 'residentialLocation',
      'status', 'serviceDate',
      'leadershipConfirmed', 'fellowshipLeaderName', 'fellowshipConfirmedAt', 'fellowshipNotes',
      'officeApproved', 'officeAdminName', 'officeConfirmedAt', 'officeNotes',
      'certificateIssued', 'certificateNumber',
    ]);

    const dedUpdate: Record<string, any> = { updatedAt: serverTimestamp() };
    for (const [k, v] of Object.entries(updates)) {
      if (allowedKeys.has(k) && v !== undefined && v !== null) {
        dedUpdate[k] = v;
      }
    }
    if (dedUpdate.selectedZone) {
      dedUpdate.selectedZone = normalizeZone(dedUpdate.selectedZone);
    }
    if (dedUpdate.selectedFellowship !== undefined) {
      const targetZone = dedUpdate.selectedZone || normalizeZone(dedSnapData?.selectedZone || 'Zone A');
      dedUpdate.selectedFellowship = normalizeFellowship(targetZone, String(dedUpdate.selectedFellowship));
    }

    const statusUpdate: Record<string, any> = { updatedAt: serverTimestamp() };
    if (dedUpdate.childName !== undefined) {
      statusUpdate.childName = dedUpdate.childName;
      statusUpdate.childNameLower = String(dedUpdate.childName).toLowerCase();
    }
    if (dedUpdate.selectedZone !== undefined) statusUpdate.selectedZone = dedUpdate.selectedZone;
    if (dedUpdate.selectedFellowship !== undefined) statusUpdate.selectedFellowship = dedUpdate.selectedFellowship;
    if (dedUpdate.status !== undefined) statusUpdate.status = dedUpdate.status;
    if (dedUpdate.serviceDate !== undefined) statusUpdate.serviceDate = dedUpdate.serviceDate;
    if (dedUpdate.leadershipConfirmed !== undefined) statusUpdate.leadershipConfirmed = Boolean(dedUpdate.leadershipConfirmed);
    if (dedUpdate.officeApproved !== undefined) statusUpdate.officeApproved = Boolean(dedUpdate.officeApproved);
    if (dedUpdate.certificateIssued !== undefined) statusUpdate.certificateIssued = Boolean(dedUpdate.certificateIssued);
    if (dedUpdate.certificateNumber !== undefined) statusUpdate.certificateNumber = dedUpdate.certificateNumber;

    if (updates.fatherPhone !== undefined || updates.motherPhone !== undefined || updates.parentPhone !== undefined) {
      statusUpdate.phoneHashes = await buildPhoneHashes({
        ...(dedSnapData as Partial<DedicationRecord>),
        ...updates,
      });
    }

    batch.update(dedRef, dedUpdate);
    if (statusSnapExists) {
      batch.update(statusRef, statusUpdate);
    } else if (dedSnapData) {
      const mergedSource = {
        ...dedSnapData,
        ...dedUpdate,
        id,
        selectedZone: normalizeZone(dedUpdate.selectedZone || dedSnapData.selectedZone),
        selectedFellowship: normalizeFellowship(
          normalizeZone(dedUpdate.selectedZone || dedSnapData.selectedZone),
          dedUpdate.selectedFellowship || dedSnapData.selectedFellowship
        ),
        createdAt: serverTimestamp(),
      };
      const statusPayload = await buildDedicationStatusPayload(
        mergedSource,
        mergedSource as unknown as Partial<DedicationRecord>
      );
      batch.set(statusRef, statusPayload);
    }
  }

  try {
    await batch.commit();
  } catch (error: any) {
    const isPermDenied =
      error?.code === 'permission-denied' ||
      String(error?.message || '').includes('Missing or insufficient permissions');

    if (role === 'fellowship_leader' && isPermDenied && leaderDedUpdate) {
      try {
        await updateDoc(dedRef, leaderDedUpdate);
      } catch (dedErr) {
        handleFirestoreError(dedErr, OperationType.UPDATE, `dedications/${id}`);
      }

      try {
        if (leaderStatusUpdate) {
          await updateDoc(statusRef, leaderStatusUpdate);
        } else if (leaderStatusCreatePayload) {
          await setDoc(statusRef, leaderStatusCreatePayload);
        }
        return;
      } catch (statusErr) {
        handleFirestoreError(statusErr, OperationType.UPDATE, `dedication_status/${id}`);
      }
    }

    handleFirestoreError(error, OperationType.UPDATE, `dedications/${id}`);
  }
}

export async function deleteDedicationInFirestore(id: string): Promise<void> {
  const batch = writeBatch(db);
  batch.delete(doc(db, 'dedications', id));
  batch.delete(doc(db, 'dedication_status', id));
  try {
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `dedications/${id}`);
  }
}

export async function adminUpsertDedicationsBatch(records: Partial<DedicationRecord>[]): Promise<void> {
  for (const rec of records) {
    const id = rec.id && /^[a-zA-Z0-9_\-]{3,128}$/.test(rec.id)
      ? rec.id
      : generateUniqueDedicationId();
    const snap = await getDoc(doc(db, 'dedications', id)).catch(() => null);
    if (snap && snap.exists()) continue;

    // Two-step create+elevate preserves strict create rules (status == 'submitted') even for historical/bulk imports
    await submitDedicationToFirestore({ ...rec, id });
    if (
      rec.status &&
      rec.status !== 'submitted' ||
      rec.leadershipConfirmed ||
      rec.officeApproved ||
      rec.certificateIssued
    ) {
      const statusVal = rec.status || 'submitted';
      const batch = writeBatch(db);
      const dedExtra: Record<string, any> = {
        status: statusVal,
        leadershipConfirmed: Boolean(rec.leadershipConfirmed),
        officeApproved: Boolean(rec.officeApproved),
        certificateIssued: Boolean(rec.certificateIssued),
        updatedAt: serverTimestamp(),
      };
      if (rec.fellowshipLeaderName) dedExtra.fellowshipLeaderName = rec.fellowshipLeaderName.slice(0, 160);
      if (rec.fellowshipConfirmedAt) dedExtra.fellowshipConfirmedAt = rec.fellowshipConfirmedAt.slice(0, 64);
      if (rec.fellowshipNotes) dedExtra.fellowshipNotes = rec.fellowshipNotes.slice(0, 500);
      if (rec.officeAdminName) dedExtra.officeAdminName = rec.officeAdminName.slice(0, 160);
      if (rec.officeConfirmedAt) dedExtra.officeConfirmedAt = rec.officeConfirmedAt.slice(0, 64);
      if (rec.officeNotes) dedExtra.officeNotes = rec.officeNotes.slice(0, 500);
      if (rec.certificateNumber) dedExtra.certificateNumber = rec.certificateNumber.slice(0, 80);

      const statusExtra: Record<string, any> = {
        status: statusVal,
        leadershipConfirmed: Boolean(rec.leadershipConfirmed),
        officeApproved: Boolean(rec.officeApproved),
        certificateIssued: Boolean(rec.certificateIssued),
        updatedAt: serverTimestamp(),
      };
      if (rec.certificateNumber) statusExtra.certificateNumber = rec.certificateNumber.slice(0, 80);

      batch.update(doc(db, 'dedications', id), dedExtra);
      batch.update(doc(db, 'dedication_status', id), statusExtra);
      await batch.commit().catch((err) => handleFirestoreError(err, OperationType.UPDATE, `dedications/${id}`));
    }
  }
}

// ==========================================
// 4. STAFF ROLES & INVITATIONS
// ==========================================

function buildStaffRolePayload(u: Partial<UserProfile> & { email: string }): Record<string, any> {
  const normalizedRole: string =
    (u.role as string) === 'admin'
      ? 'super_admin'
      : u.role || 'fellowship_leader';
  const safeRole = ['super_admin', 'office_admin', 'pastor', 'fellowship_leader'].includes(normalizedRole)
    ? normalizedRole
    : 'fellowship_leader';

  const cleanEmail = u.email.toLowerCase().trim();
  const docPayload: Record<string, any> = {
    id: String(u.id || `usr-${cleanEmail}`).slice(0, 128),
    email: cleanEmail,
    name: String(u.name || cleanEmail.split('@')[0]).trim().slice(0, 160) || 'Staff Member',
    role: safeRole,
    isApproved: u.isApproved ?? true,
    isSuspended: Boolean(u.isSuspended),
    authProvider: u.authProvider === 'email' ? 'email' : 'google',
    createdAt: serverTimestamp(),
  };

  if (u.assignedZone) {
    const normZone = normalizeZone(u.assignedZone).slice(0, 40);
    docPayload.assignedZone = normZone;
    if (u.assignedFellowship) {
      docPayload.assignedFellowship = normalizeFellowship(normZone, String(u.assignedFellowship)).slice(0, 100);
    }
  } else if (u.assignedFellowship) {
    docPayload.assignedFellowship = String(u.assignedFellowship).trim().slice(0, 100);
  }
  if (u.avatar) docPayload.avatar = String(u.avatar).slice(0, 400);
  if (u.phone) docPayload.phone = String(u.phone).slice(0, 40);
  if (u.lastLoginAt) docPayload.lastLoginAt = String(u.lastLoginAt).slice(0, 64);

  return docPayload;
}

export async function fetchStaffRoleByEmail(email: string): Promise<UserProfile | null> {
  const cleanEmail = email.toLowerCase().trim();
  try {
    const snap = await getDoc(doc(db, 'staff_roles', cleanEmail));
    if (!snap.exists()) return null;
    const d = snap.data();
    return {
      id: d.id,
      email: d.email,
      name: d.name,
      role: d.role,
      assignedZone: d.assignedZone,
      assignedFellowship: d.assignedFellowship,
      isApproved: Boolean(d.isApproved),
      isSuspended: Boolean(d.isSuspended),
      authProvider: d.authProvider || 'google',
      avatar: d.avatar,
      phone: d.phone,
      createdAt: timestampToIso(d.createdAt),
      lastLoginAt: d.lastLoginAt,
    };
  } catch {
    return null;
  }
}

export async function updateOwnLastLoginInFirestore(
  email: string,
  name?: string,
  avatar?: string
): Promise<boolean> {
  const cleanEmail = email.toLowerCase().trim();
  const ref = doc(db, 'staff_roles', cleanEmail);
  try {
    const snap = await getDoc(ref);
    if (!snap.exists()) return false;
    const patch: Record<string, any> = {
      lastLoginAt: new Date().toISOString(),
    };
    if (name && name.trim()) patch.name = name.trim().slice(0, 160);
    if (avatar && avatar.trim()) patch.avatar = avatar.trim().slice(0, 400);
    await updateDoc(ref, patch);
    return true;
  } catch (err) {
    console.warn(`Could not update lastLoginAt for ${cleanEmail}:`, err);
    return false;
  }
}

export async function syncStaffRoleToFirestore(
  staff: Partial<UserProfile> & { email: string }
): Promise<void> {
  if (!isFirebaseStaffSignedIn()) return;
  const cleanEmail = staff.email.toLowerCase().trim();
  const ref = doc(db, 'staff_roles', cleanEmail);
  try {
    const existing = await getDoc(ref);
    if (existing.exists()) {
      const patch: Record<string, any> = {};
      if (staff.name) patch.name = staff.name.trim().slice(0, 160);
      if (staff.role) {
        patch.role = (staff.role as string) === 'admin' ? 'super_admin' : staff.role;
      }
      const resolvedZone =
        staff.assignedZone !== undefined
          ? (staff.assignedZone ? normalizeZone(staff.assignedZone) : '')
          : (existing.data().assignedZone || '');
      if (staff.assignedZone !== undefined) patch.assignedZone = resolvedZone;
      if (staff.assignedFellowship !== undefined) {
        const rawFel = String(staff.assignedFellowship || '').trim();
        patch.assignedFellowship = rawFel
          ? (resolvedZone ? normalizeFellowship(resolvedZone, rawFel) : rawFel).slice(0, 100)
          : '';
      }
      if (staff.isSuspended !== undefined) patch.isSuspended = Boolean(staff.isSuspended);
      if (staff.lastLoginAt) patch.lastLoginAt = staff.lastLoginAt.slice(0, 64);
      if (Object.keys(patch).length > 0) {
        await updateDoc(ref, patch);
      }
    } else {
      await setDoc(ref, buildStaffRolePayload(staff));
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `staff_roles/${cleanEmail}`);
  }
}

export async function fetchStaffRolesFromFirestore(): Promise<UserProfile[]> {
  try {
    const snap = await getDocs(collection(db, 'staff_roles'));
    return snap.docs.map((docSnap) => {
      const d = docSnap.data();
      return {
        id: d.id,
        email: d.email,
        name: d.name,
        role: d.role as UserRole,
        assignedZone: d.assignedZone,
        assignedFellowship: d.assignedFellowship,
        isApproved: Boolean(d.isApproved),
        isSuspended: Boolean(d.isSuspended),
        authProvider: d.authProvider || 'google',
        avatar: d.avatar,
        phone: d.phone,
        createdAt: timestampToIso(d.createdAt),
        lastLoginAt: d.lastLoginAt,
      };
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, 'staff_roles');
  }
}

export async function deleteStaffRoleFromFirestore(email: string): Promise<void> {
  const cleanEmail = email.toLowerCase().trim();
  try {
    await deleteDoc(doc(db, 'staff_roles', cleanEmail));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `staff_roles/${cleanEmail}`);
  }
}

export async function saveInvitationToFirestore(inv: StaffInvitation): Promise<void> {
  if (!isFirebaseStaffSignedIn()) return;
  const id = inv.id.replace(/[^a-zA-Z0-9_\-]/g, '-').slice(0, 128);
  const payload: Record<string, any> = {
    id,
    email: inv.email.toLowerCase().trim(),
    role: inv.role,
    invitedBy: String(inv.invitedBy || 'admin').slice(0, 160),
    invitedByEmail: String(inv.invitedByEmail || auth.currentUser?.email || 'fawany@gmail.com').toLowerCase().trim(),
    status: inv.status || 'pending',
    expiresAt: String(inv.expiresAt).slice(0, 64),
    createdAt: serverTimestamp(),
  };
  if (inv.name) payload.name = inv.name.trim().slice(0, 160);
  if (inv.assignedZone) payload.assignedZone = normalizeZone(inv.assignedZone).slice(0, 40);
  if (inv.assignedFellowship) {
    const zoneForInv = payload.assignedZone || '';
    payload.assignedFellowship = (zoneForInv
      ? normalizeFellowship(zoneForInv, inv.assignedFellowship)
      : inv.assignedFellowship.trim()
    ).slice(0, 100);
  }
  if (inv.usedAt) payload.usedAt = inv.usedAt.slice(0, 64);
  if (inv.revokedAt) payload.revokedAt = inv.revokedAt.slice(0, 64);
  if (inv.revokedBy) payload.revokedBy = inv.revokedBy.slice(0, 160);

  try {
    await setDoc(doc(db, 'invitations', id), payload);
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, `invitations/${id}`);
  }
}

export async function fetchInvitationsFromFirestore(): Promise<StaffInvitation[]> {
  try {
    const snap = await getDocs(collection(db, 'invitations'));
    return snap.docs
      .map((docSnap) => {
        const d = docSnap.data();
        return {
          id: d.id,
          email: d.email,
          name: d.name,
          role: d.role,
          assignedZone: d.assignedZone,
          assignedFellowship: d.assignedFellowship,
          invitedBy: d.invitedBy,
          invitedByEmail: d.invitedByEmail,
          status: d.status,
          expiresAt: d.expiresAt,
          createdAt: timestampToIso(d.createdAt),
          usedAt: d.usedAt,
          revokedAt: d.revokedAt,
          revokedBy: d.revokedBy,
        } as StaffInvitation;
      })
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, 'invitations');
  }
}

export async function revokeInvitationInFirestore(id: string, actorId: string): Promise<void> {
  if (!isFirebaseStaffSignedIn()) return;
  try {
    await updateDoc(doc(db, 'invitations', id), {
      status: 'revoked',
      revokedAt: new Date().toISOString(),
      revokedBy: actorId.slice(0, 160),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `invitations/${id}`);
  }
}

// ==========================================
// 5. PAST DEDICATIONS ARCHIVE
// ==========================================

function buildPastDedicationPayload(rec: Partial<PastDedicationRecord> & { id: string }): Record<string, any> {
  const yearNum = Number(rec.dedicationYear) || 2009;
  const clampedYear = Math.min(2100, Math.max(1990, yearNum));

  const docObj: Record<string, any> = {
    id: rec.id.replace(/[^a-zA-Z0-9_\-]/g, '-').slice(0, 128),
    childName: String(rec.childName || 'Historical Child').trim().slice(0, 160) || 'Historical Child',
    dedicationYear: clampedYear,
    serviceDate: String(rec.serviceDate || String(clampedYear)).trim().slice(0, 64),
    certificateNumber: String(rec.certificateNumber || `DCU-HIST-${clampedYear}`).trim().slice(0, 80),
    certificateIssued: Boolean(rec.certificateIssued ?? true),
    createdAt: serverTimestamp(),
  };

  if (rec.childDob) docObj.childDob = String(rec.childDob).slice(0, 32);
  if (rec.childGender === 'Male' || rec.childGender === 'Female') docObj.childGender = rec.childGender;
  if (rec.childCountyOfBirth) docObj.childCountyOfBirth = String(rec.childCountyOfBirth).slice(0, 80);
  if (rec.childPlaceOfBirth) docObj.childPlaceOfBirth = String(rec.childPlaceOfBirth).slice(0, 120);
  if (rec.fatherName) docObj.fatherName = String(rec.fatherName).slice(0, 160);
  if (rec.fatherPhone) docObj.fatherPhone = String(rec.fatherPhone).slice(0, 40);
  if (rec.fatherEmail) docObj.fatherEmail = String(rec.fatherEmail).slice(0, 160);
  if (rec.motherName) docObj.motherName = String(rec.motherName).slice(0, 160);
  if (rec.motherPhone) docObj.motherPhone = String(rec.motherPhone).slice(0, 40);
  if (rec.motherEmail) docObj.motherEmail = String(rec.motherEmail).slice(0, 160);
  if (rec.parentName) docObj.parentName = String(rec.parentName).slice(0, 200);
  if (rec.parentPhone) docObj.parentPhone = String(rec.parentPhone).slice(0, 40);
  if (rec.parentEmail) docObj.parentEmail = String(rec.parentEmail).slice(0, 160);
  if (rec.selectedZone) docObj.selectedZone = String(rec.selectedZone).slice(0, 40);
  if (rec.selectedFellowship) docObj.selectedFellowship = String(rec.selectedFellowship).slice(0, 100);
  if (rec.originalDateRaw) docObj.originalDateRaw = String(rec.originalDateRaw).slice(0, 64);
  if (rec.officiatingMinister) docObj.officiatingMinister = String(rec.officiatingMinister).slice(0, 160);
  if (rec.notes) docObj.notes = String(rec.notes).slice(0, 500);
  if (rec.archivalSource) docObj.archivalSource = String(rec.archivalSource).slice(0, 160);

  return docObj;
}

export async function fetchPastDedicationsFromFirestore(): Promise<PastDedicationRecord[]> {
  try {
    const snap = await getDocs(collection(db, 'past_dedications'));
    return snap.docs
      .map((docSnap) => {
        const d = docSnap.data();
        return {
          ...d,
          createdAt: timestampToIso(d.createdAt),
          updatedAt: d.updatedAt ? timestampToIso(d.updatedAt) : undefined,
        } as PastDedicationRecord;
      })
      .sort((a, b) => (b.dedicationYear || 0) - (a.dedicationYear || 0));
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, 'past_dedications');
  }
}

export async function createPastDedicationInFirestore(
  rec: Partial<PastDedicationRecord> & { id: string }
): Promise<void> {
  const payload = buildPastDedicationPayload(rec);
  try {
    await setDoc(doc(db, 'past_dedications', payload.id), payload);
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, `past_dedications/${payload.id}`);
  }
}

export async function updatePastDedicationInFirestore(
  id: string,
  updates: Partial<PastDedicationRecord>
): Promise<void> {
  const allowed = new Set([
    'childName', 'childDob', 'childGender', 'childCountyOfBirth', 'childPlaceOfBirth',
    'fatherName', 'fatherPhone', 'fatherEmail',
    'motherName', 'motherPhone', 'motherEmail',
    'parentName', 'parentPhone', 'parentEmail',
    'selectedZone', 'selectedFellowship', 'dedicationYear', 'serviceDate',
    'originalDateRaw', 'certificateNumber', 'certificateIssued',
    'officiatingMinister', 'notes', 'archivalSource',
  ]);
  const patch: Record<string, any> = { updatedAt: serverTimestamp() };
  for (const [k, v] of Object.entries(updates)) {
    if (allowed.has(k) && v !== undefined) {
      patch[k] = v;
    }
  }
  try {
    await updateDoc(doc(db, 'past_dedications', id), patch);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `past_dedications/${id}`);
  }
}

export async function deletePastDedicationInFirestore(id: string): Promise<void> {
  try {
    await deleteDoc(doc(db, 'past_dedications', id));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `past_dedications/${id}`);
  }
}

// ==========================================
// 6. ONE-TIME ADMIN SEED & BACKFILL SYNC
// ==========================================

let adminSeeded = false;
export async function seedInitialDataIfAdmin(
  user: UserProfile,
  extraStaffUsers: UserProfile[] = [],
  extraDedications: DedicationRecord[] = []
): Promise<void> {
  const role = (user.role as string) === 'admin' ? 'super_admin' : user.role;
  if (role !== 'super_admin' || !isFirebaseStaffSignedIn()) return;
  if (adminSeeded) return;
  adminSeeded = true;

  try {
    // 1. Seed initial staff roles + any locally known staff (non-parents) into staff_roles
    const staffExisting = await getDocs(collection(db, 'staff_roles'));
    const existingEmails = new Set(staffExisting.docs.map((d) => d.id.toLowerCase()));

    const allKnownStaff: UserProfile[] = [
      ...INITIAL_USERS.filter((u) => u.role !== 'parent'),
      ...extraStaffUsers.filter((u) => u.role !== 'parent'),
    ];
    for (const s of allKnownStaff) {
      const cleanEmail = s.email.toLowerCase().trim();
      if (!existingEmails.has(cleanEmail)) {
        await setDoc(doc(db, 'staff_roles', cleanEmail), buildStaffRolePayload(s));
        existingEmails.add(cleanEmail);
      }
    }

    // 2. Ensure any existing staff_roles docs have normalized zone & fellowship values for strict rules matching
    for (const docSnap of staffExisting.docs) {
      const d = docSnap.data();
      if (d.assignedZone || d.assignedFellowship) {
        const normZone = d.assignedZone ? normalizeZone(d.assignedZone) : '';
        const normFel = d.assignedFellowship
          ? (normZone ? normalizeFellowship(normZone, String(d.assignedFellowship)) : String(d.assignedFellowship).trim())
          : '';
        if (normZone !== (d.assignedZone || '') || normFel !== (d.assignedFellowship || '')) {
          await updateDoc(docSnap.ref, {
            assignedZone: normZone,
            assignedFellowship: normFel,
          }).catch(() => {});
        }
      }
    }

    // 3. Seed initial dedications if dedications collection is empty, backfill any local non-seed submissions,
    // and normalize legacy fellowship names so exact Firestore security rules always match fellowship leaders
    const dedSnap = await getDocs(collection(db, 'dedications'));
    if (dedSnap.empty) {
      await adminUpsertDedicationsBatch([...INITIAL_DEDICATIONS, ...extraDedications]);
    } else {
      if (extraDedications.length > 0) {
        await adminUpsertDedicationsBatch(
          extraDedications.filter((d) => !SEED_DEDICATION_IDS.has(d.id))
        );
      }
      const statusSnapAll = await getDocs(collection(db, 'dedication_status')).catch(() => null);
      const statusById = new Map<string, Record<string, any>>();
      if (statusSnapAll) {
        for (const sDoc of statusSnapAll.docs) {
          statusById.set(sDoc.id, sDoc.data());
        }
      }

      for (const docSnap of dedSnap.docs) {
        const d = docSnap.data();
        const normZone = normalizeZone(d.selectedZone);
        const normFel = normalizeFellowship(normZone, d.selectedFellowship);
        const dedNeedsNorm = normZone !== d.selectedZone || normFel !== d.selectedFellowship;
        const existingStatus = statusById.get(docSnap.id);

        if (!existingStatus) {
          if (dedNeedsNorm) {
            await updateDoc(docSnap.ref, {
              selectedZone: normZone,
              selectedFellowship: normFel,
              updatedAt: serverTimestamp(),
            }).catch(() => {});
          }
          const statusPayload = await buildDedicationStatusPayload(
            {
              ...d,
              id: docSnap.id,
              selectedZone: normZone,
              selectedFellowship: normFel,
              createdAt: serverTimestamp(),
            },
            d as Partial<DedicationRecord>
          );
          await setDoc(doc(db, 'dedication_status', docSnap.id), statusPayload).catch(() => {});
        } else {
          const statusNeedsSync =
            existingStatus.selectedZone !== normZone ||
            existingStatus.selectedFellowship !== normFel ||
            existingStatus.status !== d.status ||
            Boolean(existingStatus.leadershipConfirmed) !== Boolean(d.leadershipConfirmed) ||
            Boolean(existingStatus.officeApproved) !== Boolean(d.officeApproved) ||
            Boolean(existingStatus.certificateIssued) !== Boolean(d.certificateIssued);

          if (dedNeedsNorm || statusNeedsSync) {
            const batch = writeBatch(db);
            if (dedNeedsNorm) {
              batch.update(docSnap.ref, {
                selectedZone: normZone,
                selectedFellowship: normFel,
                updatedAt: serverTimestamp(),
              });
            }
            if (dedNeedsNorm || statusNeedsSync) {
              batch.update(doc(db, 'dedication_status', docSnap.id), {
                selectedZone: normZone,
                selectedFellowship: normFel,
                status: d.status,
                leadershipConfirmed: Boolean(d.leadershipConfirmed),
                officeApproved: Boolean(d.officeApproved),
                certificateIssued: Boolean(d.certificateIssued),
                updatedAt: serverTimestamp(),
              });
            }
            await batch.commit().catch(() => {});
          }
        }
      }
    }

    // 4. Seed historical archive if empty
    const pastSnap = await getDocs(query(collection(db, 'past_dedications'), limit(1)));
    if (pastSnap.empty) {
      const batch = writeBatch(db);
      for (const p of INITIAL_PAST_DEDICATIONS) {
        const payload = buildPastDedicationPayload(p);
        batch.set(doc(db, 'past_dedications', payload.id), payload);
      }
      await batch.commit();
    }
  } catch (e) {
    adminSeeded = false;
    console.warn('Admin Firestore initial seed check notice:', e);
  }
}
