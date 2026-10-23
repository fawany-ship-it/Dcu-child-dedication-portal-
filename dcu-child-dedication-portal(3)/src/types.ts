export type DedicationStatus = 
  | 'submitted'              // Parent submitted, pending Fellowship Leader check
  | 'fellowship_confirmed'   // Fellowship Leader has reviewed & confirmed
  | 'office_approved'        // Church Office Admin has confirmed
  | 'compiled'               // Included in Monthly Dedication list
  | 'completed';             // Dedicated on Sunday & archived

export interface DedicationRecord {
  id: string;
  childName: string;
  childDob: string;
  childGender: 'Male' | 'Female';
  childCountyOfBirth: string; // County instead of hospital/town
  childPlaceOfBirth?: string;  // backwards compatibility
  
  fatherName: string;
  fatherPhone: string;
  fatherEmail: string;
  
  motherName: string;
  motherPhone: string;
  motherEmail: string;

  parentName?: string;
  parentPhone?: string;
  parentEmail?: string;
  parentRelationship?: string;

  isInFellowship: boolean;
  selectedZone: 'Zone A' | 'Zone B' | 'Zone C' | 'Zone D' | 'Zone E' | 'Unallocated';
  selectedFellowship: string;
  residentialLocation?: string;

  dataConsent: boolean;
  status: DedicationStatus;
  
  serviceDate?: string; // Dedication Sunday date determined & scheduled by Pastor and Church Office
  leadershipConfirmed: boolean;
  fellowshipLeaderName?: string;
  fellowshipConfirmedAt?: string;
  fellowshipNotes?: string;

  officeApproved: boolean;
  officeAdminName?: string;
  officeConfirmedAt?: string;
  officeNotes?: string;

  certificateIssued: boolean;
  certificateNumber?: string;
  
  submittedBy?: string;
  createdAt: string;
  updatedAt: string;
}

export type UserRole = 
  | 'super_admin' 
  | 'office_admin' 
  | 'pastor' 
  | 'fellowship_leader' 
  | 'parent'
  | 'admin'; // backwards-compatible alias for super_admin

export interface UserProfile {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  assignedZone?: 'Zone A' | 'Zone B' | 'Zone C' | 'Zone D' | 'Zone E';
  isApproved: boolean;
  isSuspended?: boolean;
  avatar?: string;
  authProvider: 'google' | 'email';
  phone?: string;
  createdAt: string;
  lastLoginAt?: string;
  requiresMfa?: boolean;
  mfaEnabled?: boolean;
  sessionToken?: string;
}

export interface StaffInvitation {
  id: string;
  email: string;
  name?: string;
  role: 'super_admin' | 'office_admin' | 'pastor' | 'fellowship_leader';
  assignedZone?: 'Zone A' | 'Zone B' | 'Zone C' | 'Zone D' | 'Zone E';
  token?: string;
  tokenHash?: string;
  invitedBy: string;
  invitedByEmail: string;
  expiresAt: string;
  createdAt: string;
  status: 'pending' | 'accepted' | 'revoked' | 'expired';
  usedAt?: string;
  revokedAt?: string;
  revokedBy?: string;
}

export interface AuditLog {
  id: string;
  timestamp: string;
  eventType: string;
  actorId: string;
  actorEmail: string;
  actorRole: string;
  targetId?: string;
  targetType?: string;
  outcome: 'SUCCESS' | 'FAILURE';
  ip?: string;
  userAgent?: string;
  details?: Record<string, any>;
}

export interface AuthSessionResponse {
  user: UserProfile;
  token: string;
  requiresMfa?: boolean;
}

export interface ZoneInfo {
  name: 'Zone A' | 'Zone B' | 'Zone C' | 'Zone D' | 'Zone E';
  fellowships: string[];
}

export interface PastDedicationRecord {
  id: string;
  childName: string;
  childDob: string;
  childGender: 'Male' | 'Female';
  childCountyOfBirth: string;
  childPlaceOfBirth?: string;
  fatherName: string;
  fatherPhone?: string;
  fatherEmail?: string;
  motherName: string;
  motherPhone?: string;
  motherEmail?: string;
  parentName?: string;
  parentPhone?: string;
  parentEmail?: string;
  selectedZone?: 'Zone A' | 'Zone B' | 'Zone C' | 'Zone D' | 'Zone E' | 'Unallocated' | string;
  selectedFellowship: string;
  dedicationYear: number;
  serviceDate: string;
  originalDateRaw?: string;
  certificateNumber: string;
  certificateIssued: boolean;
  officiatingMinister?: string;
  notes?: string;
  archivalSource?: string;
  rawRowData?: Record<string, any>;
  createdAt: string;
  updatedAt?: string;
}

