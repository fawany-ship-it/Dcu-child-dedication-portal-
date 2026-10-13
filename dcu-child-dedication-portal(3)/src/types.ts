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

export type UserRole = 'admin' | 'pastor' | 'fellowship_leader' | 'parent';

export interface UserProfile {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  assignedZone?: 'Zone A' | 'Zone B' | 'Zone C' | 'Zone D' | 'Zone E';
  isApproved: boolean;
  avatar?: string;
  authProvider: 'google' | 'email';
  phone?: string;
  createdAt: string;
  lastLoginAt?: string;
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
  selectedZone: 'Zone A' | 'Zone B' | 'Zone C' | 'Zone D' | 'Zone E' | 'Unallocated';
  selectedFellowship: string;
  dedicationYear: number;
  serviceDate: string;
  certificateNumber: string;
  certificateIssued: boolean;
  officiatingMinister?: string;
  notes?: string;
  archivalSource?: string;
  createdAt: string;
  updatedAt?: string;
}

