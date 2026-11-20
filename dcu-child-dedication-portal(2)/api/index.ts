import express, { Request, Response } from 'express';
import crypto from 'crypto';

// Inline types so Vercel Serverless (@vercel/node under "type": "module")
// has ZERO relative imports and can never fail with ERR_MODULE_NOT_FOUND.
type DedicationStatus =
  | 'submitted'
  | 'fellowship_confirmed'
  | 'office_approved'
  | 'compiled'
  | 'completed';

type UserRole =
  | 'super_admin'
  | 'office_admin'
  | 'pastor'
  | 'fellowship_leader'
  | 'parent'
  | 'admin';

interface DedicationRecord {
  id: string;
  childName: string;
  childDob: string;
  childGender: 'Male' | 'Female';
  childCountyOfBirth: string;
  childPlaceOfBirth?: string;
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
  serviceDate?: string;
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

interface UserProfile {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  assignedZone?: 'Zone A' | 'Zone B' | 'Zone C' | 'Zone D' | 'Zone E';
  assignedFellowship?: string;
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

interface StaffInvitation {
  id: string;
  email: string;
  name?: string;
  role: 'super_admin' | 'office_admin' | 'pastor' | 'fellowship_leader';
  assignedZone?: 'Zone A' | 'Zone B' | 'Zone C' | 'Zone D' | 'Zone E';
  assignedFellowship?: string;
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

interface PastDedicationRecord {
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
  selectedZone?: string;
  selectedFellowship?: string;
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

const INITIAL_DEDICATIONS: DedicationRecord[] = [
  {
    id: 'DED-2026-001',
    childName: 'Ethan Baraka Mutua',
    childDob: '2026-04-12',
    childGender: 'Male',
    childCountyOfBirth: 'Nairobi',
    childPlaceOfBirth: 'Nairobi County',
    fatherName: 'Daniel Mutua Kilonzo',
    fatherPhone: '0722 134 567',
    fatherEmail: 'dmutua@gmail.com',
    motherName: 'Faith Mwende Mutua',
    motherPhone: '0733 987 654',
    motherEmail: 'faith.mutua@gmail.com',
    parentName: 'Daniel & Faith Mutua',
    parentPhone: '0722 134 567',
    parentEmail: 'dmutua@gmail.com',
    parentRelationship: 'Parents',
    isInFellowship: true,
    selectedZone: 'Zone A',
    selectedFellowship: 'Doxa',
    residentialLocation: 'Utawala Shooters, Court 4',
    dataConsent: true,
    status: 'compiled',
    serviceDate: '2026-11-29',
    leadershipConfirmed: true,
    fellowshipLeaderName: 'Leader Peter (Zone A)',
    fellowshipConfirmedAt: '2026-09-15T10:00:00.000Z',
    fellowshipNotes: 'Active Doxa fellowship members. In good standing.',
    officeApproved: true,
    officeAdminName: 'Church Office Secretary',
    officeConfirmedAt: '2026-09-16T14:30:00.000Z',
    certificateIssued: true,
    certificateNumber: 'DCU-DED-2026-089',
    submittedBy: 'fawany@gmail.com',
    createdAt: '2026-09-14T08:30:00.000Z',
    updatedAt: '2026-10-02T11:20:00.000Z'
  },
  {
    id: 'DED-2026-002',
    childName: 'Ariana Wairimu Njoroge',
    childDob: '2026-05-28',
    childGender: 'Female',
    childCountyOfBirth: 'Kiambu',
    childPlaceOfBirth: 'Kiambu County',
    fatherName: 'Stephen Njoroge Karanja',
    fatherPhone: '0721 456 789',
    fatherEmail: 'snjoroge@yahoo.com',
    motherName: 'Priscilla Wambui Njoroge',
    motherPhone: '0728 654 321',
    motherEmail: 'priscilla.w@gmail.com',
    parentName: 'Stephen & Priscilla Njoroge',
    parentPhone: '0721 456 789',
    parentEmail: 'snjoroge@yahoo.com',
    parentRelationship: 'Parents',
    isInFellowship: true,
    selectedZone: 'Zone B',
    selectedFellowship: 'Neema',
    residentialLocation: 'Benedicta Area, near Deliverance Gate',
    dataConsent: true,
    status: 'compiled',
    serviceDate: '2026-11-29',
    leadershipConfirmed: true,
    fellowshipLeaderName: 'Leader Grace (Zone B)',
    fellowshipConfirmedAt: '2026-09-19T11:00:00.000Z',
    fellowshipNotes: 'Neema fellowship confirmed attendance.',
    officeApproved: true,
    officeAdminName: 'Office Administrator',
    officeConfirmedAt: '2026-09-20T16:00:00.000Z',
    certificateIssued: true,
    certificateNumber: 'DCU-DED-2026-090',
    submittedBy: 'snjoroge@yahoo.com',
    createdAt: '2026-09-18T10:15:00.000Z',
    updatedAt: '2026-10-04T14:10:00.000Z'
  },
  {
    id: 'DED-2026-003',
    childName: 'Jeremiah Jabali Omondi',
    childDob: '2026-06-15',
    childGender: 'Male',
    childCountyOfBirth: 'Nairobi',
    childPlaceOfBirth: 'Nairobi County',
    fatherName: 'Caleb Omondi Otieno',
    fatherPhone: '0710 334 455',
    fatherEmail: 'caleb.omondi@gmail.com',
    motherName: 'Mercy Achieng Omondi',
    motherPhone: '0715 778 899',
    motherEmail: 'mercy.achieng@gmail.com',
    parentName: 'Caleb & Mercy Omondi',
    parentPhone: '0710 334 455',
    parentEmail: 'caleb.omondi@gmail.com',
    parentRelationship: 'Parents',
    isInFellowship: true,
    selectedZone: 'Zone C',
    selectedFellowship: 'Dominion',
    residentialLocation: 'Airways Estate, Block C',
    dataConsent: true,
    status: 'fellowship_confirmed',
    serviceDate: '2026-11-29',
    leadershipConfirmed: true,
    fellowshipLeaderName: 'Leader Kamau (Zone C)',
    fellowshipConfirmedAt: '2026-09-26T14:00:00.000Z',
    fellowshipNotes: 'Confirmed by Dominion fellowship leader. Ready for office approval.',
    officeApproved: false,
    certificateIssued: false,
    submittedBy: 'caleb.omondi@gmail.com',
    createdAt: '2026-09-25T14:00:00.000Z',
    updatedAt: '2026-10-05T09:45:00.000Z'
  },
  {
    id: 'DED-2026-004',
    childName: 'Zoe Zawadi Kemunto',
    childDob: '2026-07-03',
    childGender: 'Female',
    childCountyOfBirth: 'Machakos',
    childPlaceOfBirth: 'Machakos County',
    fatherName: 'Kevin Mogaka Nyachae',
    fatherPhone: '0724 556 677',
    fatherEmail: 'kmogaka@gmail.com',
    motherName: 'Brenda Kerubo Mogaka',
    motherPhone: '0726 112 233',
    motherEmail: 'bkerubo@gmail.com',
    parentName: 'Kevin & Brenda Mogaka',
    parentPhone: '0724 556 677',
    parentEmail: 'kmogaka@gmail.com',
    parentRelationship: 'Parents',
    isInFellowship: true,
    selectedZone: 'Zone D',
    selectedFellowship: 'Transformers',
    residentialLocation: 'Gesora Road, House 12',
    dataConsent: true,
    status: 'submitted',
    serviceDate: '2026-11-29',
    leadershipConfirmed: false,
    officeApproved: false,
    certificateIssued: false,
    submittedBy: 'kmogaka@gmail.com',
    createdAt: '2026-09-29T16:20:00.000Z',
    updatedAt: '2026-10-06T12:00:00.000Z'
  },
  {
    id: 'DED-2026-005',
    childName: 'Micah Kipchirchir Koech',
    childDob: '2026-08-10',
    childGender: 'Male',
    childCountyOfBirth: 'Nakuru',
    childPlaceOfBirth: 'Nakuru County',
    fatherName: 'Gideon Kiprono Koech',
    fatherPhone: '0729 443 322',
    fatherEmail: 'gkoech@gmail.com',
    motherName: 'Lydia Jepkosgei Koech',
    motherPhone: '0731 889 900',
    motherEmail: 'lydia.koech@gmail.com',
    parentName: 'Gideon & Lydia Koech',
    parentPhone: '0729 443 322',
    parentEmail: 'gkoech@gmail.com',
    parentRelationship: 'Parents',
    isInFellowship: false,
    selectedZone: 'Unallocated',
    selectedFellowship: 'Unallocated - Follow-up Required',
    residentialLocation: 'Utawala Tamarind stage, near St. Bakhita Academy',
    dataConsent: true,
    status: 'submitted',
    serviceDate: '2026-11-29',
    leadershipConfirmed: false,
    officeApproved: false,
    certificateIssued: false,
    submittedBy: 'gkoech@gmail.com',
    createdAt: '2026-10-01T11:10:00.000Z',
    updatedAt: '2026-10-07T15:30:00.000Z'
  },
  {
    id: 'DED-2026-006',
    childName: 'Selah Imani Wanjama',
    childDob: '2026-08-22',
    childGender: 'Female',
    childCountyOfBirth: 'Nairobi',
    childPlaceOfBirth: 'Nairobi County',
    fatherName: 'Anthony Wanjama Kariuki',
    fatherPhone: '0720 890 123',
    fatherEmail: 'awanjama@gmail.com',
    motherName: 'Tabitha Muthoni Wanjama',
    motherPhone: '0725 432 109',
    motherEmail: 'tabitha.muthoni@gmail.com',
    parentName: 'Anthony & Tabitha Wanjama',
    parentPhone: '0720 890 123',
    parentEmail: 'awanjama@gmail.com',
    parentRelationship: 'Parents',
    isInFellowship: true,
    selectedZone: 'Zone E',
    selectedFellowship: 'Shekinah',
    residentialLocation: 'Eastern Bypass, Astrol Total stage',
    dataConsent: true,
    status: 'submitted',
    serviceDate: '2026-11-29',
    leadershipConfirmed: false,
    officeApproved: false,
    certificateIssued: false,
    submittedBy: 'awanjama@gmail.com',
    createdAt: '2026-10-06T09:40:00.000Z',
    updatedAt: '2026-10-06T09:40:00.000Z'
  },
  {
    id: 'DED-2026-007',
    childName: 'David Kiptoo Cheruiyot',
    childDob: '2026-01-10',
    childGender: 'Male',
    childCountyOfBirth: 'Kericho',
    childPlaceOfBirth: 'Kericho County',
    fatherName: 'Paul Cheruiyot',
    fatherPhone: '0721 112 233',
    fatherEmail: 'paul.c@gmail.com',
    motherName: 'Esther Chebet',
    motherPhone: '0722 445 566',
    motherEmail: 'esther.c@gmail.com',
    parentName: 'Paul & Esther Cheruiyot',
    parentPhone: '0721 112 233',
    parentEmail: 'paul.c@gmail.com',
    parentRelationship: 'Parents',
    isInFellowship: true,
    selectedZone: 'Zone A',
    selectedFellowship: 'Utukufu',
    residentialLocation: 'Utawala Githunguri stage',
    dataConsent: true,
    status: 'completed',
    serviceDate: '2026-08-30',
    leadershipConfirmed: true,
    fellowshipLeaderName: 'Leader Peter (Zone A)',
    fellowshipConfirmedAt: '2026-08-15T12:00:00.000Z',
    officeApproved: true,
    officeAdminName: 'Pastoral Office',
    officeConfirmedAt: '2026-08-18T10:00:00.000Z',
    certificateIssued: true,
    certificateNumber: 'DCU-DED-2026-072',
    submittedBy: 'paul.c@gmail.com',
    createdAt: '2026-08-10T08:00:00.000Z',
    updatedAt: '2026-08-30T13:00:00.000Z'
  }
];

const INITIAL_USERS: UserProfile[] = [
  {
    id: 'usr-admin-1',
    email: 'fawany@gmail.com',
    name: 'Fawany (Administrator)',
    role: 'admin',
    isApproved: true,
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
    authProvider: 'google',
    phone: '0723 102273',
    createdAt: '2026-01-01T00:00:00.000Z'
  },
  {
    id: 'usr-leader-zoneA',
    email: 'zoneA.leader@dcutawala.org',
    name: 'Zone A Fellowship Leader',
    role: 'fellowship_leader',
    assignedZone: 'Zone A',
    isApproved: true,
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
    authProvider: 'google',
    phone: '0722 001 002',
    createdAt: '2026-01-10T00:00:00.000Z'
  },
  {
    id: 'usr-leader-zoneB',
    email: 'zoneB.leader@dcutawala.org',
    name: 'Zone B Fellowship Leader',
    role: 'fellowship_leader',
    assignedZone: 'Zone B',
    isApproved: true,
    avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&auto=format&fit=crop&q=80',
    authProvider: 'google',
    phone: '0722 003 004',
    createdAt: '2026-01-12T00:00:00.000Z'
  },
  {
    id: 'usr-leader-zoneC',
    email: 'zoneC.leader@dcutawala.org',
    name: 'Zone C Fellowship Leader',
    role: 'fellowship_leader',
    assignedZone: 'Zone C',
    isApproved: true,
    avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80',
    authProvider: 'google',
    phone: '0722 005 006',
    createdAt: '2026-01-14T00:00:00.000Z'
  },
  {
    id: 'usr-leader-zoneD',
    email: 'zoneD.leader@dcutawala.org',
    name: 'Zone D Fellowship Leader',
    role: 'fellowship_leader',
    assignedZone: 'Zone D',
    isApproved: true,
    avatar: 'https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?w=150&auto=format&fit=crop&q=80',
    authProvider: 'google',
    phone: '0722 007 008',
    createdAt: '2026-01-16T00:00:00.000Z'
  },
  {
    id: 'usr-leader-zoneE',
    email: 'zoneE.leader@dcutawala.org',
    name: 'Zone E Fellowship Leader',
    role: 'fellowship_leader',
    assignedZone: 'Zone E',
    isApproved: true,
    avatar: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150&auto=format&fit=crop&q=80',
    authProvider: 'google',
    phone: '0722 009 010',
    createdAt: '2026-01-18T00:00:00.000Z'
  },
  {
    id: 'usr-parent-1',
    email: 'dmutua@gmail.com',
    name: 'Daniel Mutua Kilonzo',
    role: 'parent',
    isApproved: true,
    avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80',
    authProvider: 'google',
    phone: '0722 134 567',
    createdAt: '2026-09-14T08:30:00.000Z'
  }
];

const INITIAL_PAST_DEDICATIONS: PastDedicationRecord[] = [
  { id: 'HIST-2009-001', childName: 'Samuel Mwangi Kariuki', childDob: '2009-02-14', childGender: 'Male', childCountyOfBirth: 'Nairobi', childPlaceOfBirth: 'Nairobi County', fatherName: 'Joseph Kariuki Mwangi', fatherPhone: '0722 101 202', motherName: 'Hannah Wangari Kariuki', motherPhone: '0733 303 404', parentName: 'Joseph & Hannah Kariuki', parentPhone: '0722 101 202', dedicationYear: 2009, serviceDate: '2009-05-31', certificateNumber: 'DCU-DED-2009-001', certificateIssued: true, officiatingMinister: 'Senior Pastor & Presbytery', notes: 'Historic 2009 Register - Deliverance Church Utawala', archivalSource: 'Church Dedication Ledger 2009', createdAt: '2009-05-31T09:00:00.000Z' },
  { id: 'HIST-2009-002', childName: 'Abigail Cherono Koech', childDob: '2009-04-18', childGender: 'Female', childCountyOfBirth: 'Nakuru', childPlaceOfBirth: 'Nakuru County', fatherName: 'David Kiprono Koech', fatherPhone: '0721 556 677', motherName: 'Gladys Jepkemoi Koech', motherPhone: '0724 889 900', parentName: 'David & Gladys Koech', parentPhone: '0721 556 677', dedicationYear: 2009, serviceDate: '2009-08-30', certificateNumber: 'DCU-DED-2009-002', certificateIssued: true, officiatingMinister: 'Rev. Senior Pastor', notes: 'Historic 2009 Register', archivalSource: 'Church Dedication Ledger 2009', createdAt: '2009-08-30T10:00:00.000Z' },
  { id: 'HIST-2010-001', childName: 'David Otieno Oduor', childDob: '2010-01-11', childGender: 'Male', childCountyOfBirth: 'Kisumu', fatherName: 'Michael Oduor Otieno', fatherPhone: '0723 445 566', motherName: 'Lilian Akinyi Oduor', motherPhone: '0725 778 899', parentName: 'Michael & Lilian Oduor', parentPhone: '0723 445 566', dedicationYear: 2010, serviceDate: '2010-04-25', certificateNumber: 'DCU-DED-2010-011', certificateIssued: true, officiatingMinister: 'Senior Pastor', notes: 'Historic 2010 Register', archivalSource: 'Church Dedication Ledger 2010', createdAt: '2010-04-25T10:00:00.000Z' },
  { id: 'HIST-2011-001', childName: 'Caleb Mutiso Musyoka', childDob: '2011-03-08', childGender: 'Male', childCountyOfBirth: 'Machakos', fatherName: 'Geoffrey Musyoka Mutiso', fatherPhone: '0721 889 900', motherName: 'Agnes Mbete Musyoka', motherPhone: '0722 123 321', parentName: 'Geoffrey & Agnes Musyoka', parentPhone: '0721 889 900', dedicationYear: 2011, serviceDate: '2011-06-26', certificateNumber: 'DCU-DED-2011-018', certificateIssued: true, officiatingMinister: 'Pastoral Team', notes: 'Historic 2011 Register', archivalSource: 'Church Dedication Ledger 2011', createdAt: '2011-06-26T10:00:00.000Z' },
  { id: 'HIST-2012-001', childName: 'Elijah Kibet Kiprop', childDob: '2012-02-17', childGender: 'Male', childCountyOfBirth: 'Nandi', fatherName: 'Emmanuel Kiprop Birech', fatherPhone: '0726 112 244', motherName: 'Caroline Jepchumba Kiprop', motherPhone: '0728 334 455', parentName: 'Emmanuel & Caroline Kiprop', parentPhone: '0726 112 244', dedicationYear: 2012, serviceDate: '2012-05-27', certificateNumber: 'DCU-DED-2012-024', certificateIssued: true, officiatingMinister: 'Senior Pastor & Presbytery', notes: 'Historic 2012 Register', archivalSource: 'Church Dedication Ledger 2012', createdAt: '2012-05-27T09:30:00.000Z' },
  { id: 'HIST-2013-001', childName: 'Zion Kiprono Bett', childDob: '2013-01-20', childGender: 'Male', childCountyOfBirth: 'Kericho', fatherName: 'Collins Bett Kipngetich', fatherPhone: '0722 889 001', motherName: 'Irene Chelangat Bett', motherPhone: '0724 112 334', parentName: 'Collins & Irene Bett', parentPhone: '0722 889 001', dedicationYear: 2013, serviceDate: '2013-04-28', certificateNumber: 'DCU-DED-2013-030', certificateIssued: true, officiatingMinister: 'Presbytery Pastors', notes: 'Historic 2013 Register', archivalSource: 'Church Dedication Ledger 2013', createdAt: '2013-04-28T09:00:00.000Z' },
  { id: 'HIST-2014-001', childName: 'Nathan Kimani Ndegwa', childDob: '2014-03-03', childGender: 'Male', childCountyOfBirth: 'Nairobi', fatherName: 'Antony Ndegwa Kimani', fatherPhone: '0720 445 667', motherName: 'Phyllis Wangari Ndegwa', motherPhone: '0722 667 889', parentName: 'Antony & Phyllis Ndegwa', parentPhone: '0720 445 667', dedicationYear: 2014, serviceDate: '2014-06-29', certificateNumber: 'DCU-DED-2014-038', certificateIssued: true, officiatingMinister: 'Senior Pastor & Presbytery', notes: 'Historic 2014 Register', archivalSource: 'Church Dedication Ledger 2014', createdAt: '2014-06-29T10:00:00.000Z' },
  { id: 'HIST-2015-001', childName: 'Josiah Ochieng Anyango', childDob: '2015-02-10', childGender: 'Male', childCountyOfBirth: 'Homa Bay', fatherName: 'George Anyango Ochieng', fatherPhone: '0725 990 112', motherName: 'Vivian Akinyi Anyango', motherPhone: '0727 112 334', parentName: 'George & Vivian Anyango', parentPhone: '0725 990 112', dedicationYear: 2015, serviceDate: '2015-05-31', certificateNumber: 'DCU-DED-2015-045', certificateIssued: true, officiatingMinister: 'Pastoral Team', notes: 'Historic 2015 Register', archivalSource: 'Church Dedication Ledger 2015', createdAt: '2015-05-31T09:00:00.000Z' },
  { id: 'HIST-2016-001', childName: 'Gideon Ndegwa Gathogo', childDob: '2016-01-18', childGender: 'Male', childCountyOfBirth: 'Nairobi', fatherName: 'Samuel Gathogo Ndegwa', fatherPhone: '0724 334 556', motherName: 'Jane Wanjira Gathogo', motherPhone: '0726 556 778', parentName: 'Samuel & Jane Gathogo', parentPhone: '0724 334 556', dedicationYear: 2016, serviceDate: '2016-04-24', certificateNumber: 'DCU-DED-2016-052', certificateIssued: true, officiatingMinister: 'Senior Pastor', notes: 'Historic 2016 Register', archivalSource: 'Church Dedication Ledger 2016', createdAt: '2016-04-24T09:30:00.000Z' },
  { id: 'HIST-2017-001', childName: 'Levi Onyango Otieno', childDob: '2017-03-15', childGender: 'Male', childCountyOfBirth: 'Siaya', fatherName: 'Tobias Otieno Onyango', fatherPhone: '0711 223 344', motherName: 'Pamela Anyango Otieno', motherPhone: '0713 445 566', parentName: 'Tobias & Pamela Otieno', parentPhone: '0711 223 344', dedicationYear: 2017, serviceDate: '2017-06-25', certificateNumber: 'DCU-DED-2017-060', certificateIssued: true, officiatingMinister: 'Senior Pastor & Presbytery', notes: 'Historic 2017 Register', archivalSource: 'Church Dedication Ledger 2017', createdAt: '2017-06-25T10:00:00.000Z' },
  { id: 'HIST-2018-001', childName: 'Ezra Githinji Wanjau', childDob: '2018-02-12', childGender: 'Male', childCountyOfBirth: 'Nyeri', fatherName: 'Martin Wanjau Githinji', fatherPhone: '0716 334 556', motherName: 'Lucy Nyawira Wanjau', motherPhone: '0718 556 778', parentName: 'Martin & Lucy Wanjau', parentPhone: '0716 334 556', dedicationYear: 2018, serviceDate: '2018-05-27', certificateNumber: 'DCU-DED-2018-068', certificateIssued: true, officiatingMinister: 'Pastoral Team', notes: 'Historic 2018 Register', archivalSource: 'Church Dedication Ledger 2018', createdAt: '2018-05-27T09:30:00.000Z' },
  { id: 'HIST-2019-001', childName: 'Boaz Koech Kiprop', childDob: '2019-01-25', childGender: 'Male', childCountyOfBirth: 'Nandi', fatherName: 'Kenneth Kiprop Koech', fatherPhone: '0725 112 334', motherName: 'Diana Jepkorir Koech', motherPhone: '0727 334 556', parentName: 'Kenneth & Diana Koech', parentPhone: '0725 112 334', dedicationYear: 2019, serviceDate: '2019-04-28', certificateNumber: 'DCU-DED-2019-075', certificateIssued: true, officiatingMinister: 'Senior Pastor', notes: 'Historic 2019 Register', archivalSource: 'Church Dedication Ledger 2019', createdAt: '2019-04-28T10:00:00.000Z' },
  { id: 'HIST-2020-001', childName: 'Ephraim Karanja Mwangi', childDob: '2020-02-09', childGender: 'Male', childCountyOfBirth: 'Nairobi', fatherName: 'George Mwangi Karanja', fatherPhone: '0721 990 112', motherName: 'Caroline Wairimu Mwangi', motherPhone: '0723 112 334', parentName: 'George & Caroline Mwangi', parentPhone: '0721 990 112', dedicationYear: 2020, serviceDate: '2020-08-30', certificateNumber: 'DCU-DED-2020-081', certificateIssued: true, officiatingMinister: 'Senior Pastor & Presbytery', notes: 'Historic 2020 Register', archivalSource: 'Church Dedication Ledger 2020', createdAt: '2020-08-30T10:00:00.000Z' },
  { id: 'HIST-2021-001', childName: 'Malachi Bett Kipkemoi', childDob: '2021-01-30', childGender: 'Male', childCountyOfBirth: 'Bomet', fatherName: 'Brian Kipkemoi Bett', fatherPhone: '0728 223 445', motherName: 'Brenda Chepkirui Bett', motherPhone: '0730 445 667', parentName: 'Brian & Brenda Bett', parentPhone: '0728 223 445', dedicationYear: 2021, serviceDate: '2021-05-30', certificateNumber: 'DCU-DED-2021-088', certificateIssued: true, officiatingMinister: 'Pastoral Team', notes: 'Historic 2021 Register', archivalSource: 'Church Dedication Ledger 2021', createdAt: '2021-05-30T09:30:00.000Z' },
  { id: 'HIST-2022-001', childName: 'Simeon Mutua Kilonzo', childDob: '2022-03-11', childGender: 'Male', childCountyOfBirth: 'Machakos', fatherName: 'Daniel Mutua Kilonzo', fatherPhone: '0722 134 567', motherName: 'Faith Mwende Mutua', motherPhone: '0733 987 654', parentName: 'Daniel & Faith Mutua', parentPhone: '0722 134 567', dedicationYear: 2022, serviceDate: '2022-06-26', certificateNumber: 'DCU-DED-2022-094', certificateIssued: true, officiatingMinister: 'Senior Pastor', notes: 'Historic 2022 Register', archivalSource: 'Church Dedication Ledger 2022', createdAt: '2022-06-26T10:00:00.000Z' },
  { id: 'HIST-2023-001', childName: 'Timothy Njoroge Karanja', childDob: '2023-02-19', childGender: 'Male', childCountyOfBirth: 'Kiambu', fatherName: 'Stephen Njoroge Karanja', fatherPhone: '0721 456 789', motherName: 'Priscilla Wambui Njoroge', motherPhone: '0728 654 321', parentName: 'Stephen & Priscilla Njoroge', parentPhone: '0721 456 789', dedicationYear: 2023, serviceDate: '2023-05-28', certificateNumber: 'DCU-DED-2023-101', certificateIssued: true, officiatingMinister: 'Senior Pastor', notes: 'Historic 2023 Register', archivalSource: 'Church Dedication Ledger 2023', createdAt: '2023-05-28T10:00:00.000Z' },
  { id: 'HIST-2024-001', childName: 'Gabriel Kibet Cheruiyot', childDob: '2024-01-15', childGender: 'Male', childCountyOfBirth: 'Uasin Gishu', fatherName: 'Felix Cheruiyot Kiprotich', fatherPhone: '0721 112 334', motherName: 'Nancy Chepkemoi Cheruiyot', motherPhone: '0723 334 556', parentName: 'Felix & Nancy Cheruiyot', parentPhone: '0721 112 334', dedicationYear: 2024, serviceDate: '2024-04-28', certificateNumber: 'DCU-DED-2024-110', certificateIssued: true, officiatingMinister: 'Senior Pastor & Presbytery', notes: 'Historic 2024 Register', archivalSource: 'Church Dedication Ledger 2024', createdAt: '2024-04-28T09:30:00.000Z' },
  { id: 'HIST-2025-001', childName: 'Raphael Oduor Otieno', childDob: '2025-02-14', childGender: 'Male', childCountyOfBirth: 'Kisumu', fatherName: 'Nicholas Otieno Oduor', fatherPhone: '0718 223 344', motherName: 'Winny Achieng Otieno', motherPhone: '0720 445 566', parentName: 'Nicholas & Winny Otieno', parentPhone: '0718 223 344', dedicationYear: 2025, serviceDate: '2025-05-25', certificateNumber: 'DCU-DED-2025-118', certificateIssued: true, officiatingMinister: 'Senior Pastor & Presbytery', notes: 'Historic 2025 Register', archivalSource: 'Church Dedication Ledger 2025', createdAt: '2025-05-25T10:00:00.000Z' }
];

const app = express();
app.use(express.json({ limit: '10mb' }));

// Restore original /api/<subpath> when Vercel rewrites /api/(.*) -> /api/index?__path=$1
app.use((req, _res, next) => {
  const rawPath = req.query?.__path;
  if (typeof rawPath === 'string' && rawPath.length > 0) {
    const cleanSubpath = rawPath.replace(/^\/+/, '');
    const qsIndex = req.url.indexOf('?');
    let qs = '';
    if (qsIndex !== -1) {
      const sp = new URLSearchParams(req.url.slice(qsIndex + 1));
      sp.delete('__path');
      const rest = sp.toString();
      if (rest) qs = `?${rest}`;
    }
    delete (req.query as Record<string, any>).__path;
    req.url = `/api/${cleanSubpath}${qs}`;
  }
  next();
});

app.get('/api/health', (_req: Request, res: Response) => {
  res.json({ ok: true, runtime: 'vercel-serverless', timestamp: new Date().toISOString() });
});

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
