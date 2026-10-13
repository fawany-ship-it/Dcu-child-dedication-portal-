import React, { useState, useEffect } from 'react';
import { DedicationRecord, UserProfile, StaffInvitation, AuditLog, UserRole } from '../types';
import { ZONES, MONTHLY_DEDICATION_DATES } from '../data/zones';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';
import { 
  Building2, CheckCircle2, Clock, Search, Filter, Shield, Award, 
  Printer, Check, AlertTriangle, FileCheck, Phone, ChevronRight,
  Edit3, Users, UserCheck, X, Save, RefreshCw, KeyRound, Mail, Calendar, MapPin,
  UserPlus, UserX, Copy, CheckSquare, ShieldAlert, History, Download
} from 'lucide-react';

interface OfficeCompileProps {
  dedications: DedicationRecord[];
  onUpdateDedication: (id: string, updates: Partial<DedicationRecord>) => Promise<void>;
  onOpenCertificate: (record: DedicationRecord) => void;
}

export function OfficeCompile({ dedications, onUpdateDedication, onOpenCertificate }: OfficeCompileProps) {
  const { user, isSuperAdmin } = useAuth();

  const [selectedZone, setSelectedZone] = useState('All');
  const [selectedMonth, setSelectedMonth] = useState('All');
  const [search, setSearch] = useState('');
  const [activeSubTab, setActiveSubTab] = useState<'leader_approved' | 'awaiting_leader' | 'office_compiled' | 'users_directory' | 'staff_invitations' | 'audit_logs'>('leader_approved');

  // Leadership accounts state
  const [usersList, setUsersList] = useState<UserProfile[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [usersSearch, setUsersSearch] = useState('');

  // Staff Invitations state
  const [invitationsList, setInvitationsList] = useState<StaffInvitation[]>([]);
  const [loadingInvitations, setLoadingInvitations] = useState(false);
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteName, setInviteName] = useState('');
  const [inviteRole, setInviteRole] = useState<'super_admin' | 'office_admin' | 'pastor' | 'fellowship_leader'>('fellowship_leader');
  const [inviteZone, setInviteZone] = useState<'Zone A' | 'Zone B' | 'Zone C' | 'Zone D' | 'Zone E'>('Zone A');
  const [createdInviteResult, setCreatedInviteResult] = useState<{ rawToken: string; inviteUrl: string } | null>(null);
  const [inviteError, setInviteError] = useState('');
  const [copiedToken, setCopiedToken] = useState(false);

  // Security Audit Logs state
  const [auditLogsList, setAuditLogsList] = useState<AuditLog[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(false);
  const [logSearch, setLogSearch] = useState('');
  const [logFilterOutcome, setLogFilterOutcome] = useState<'ALL' | 'SUCCESS' | 'FAILURE'>('ALL');

  // Edit record state
  const [editingRecord, setEditingRecord] = useState<DedicationRecord | null>(null);
  const [editFormData, setEditFormData] = useState<Partial<DedicationRecord>>({});
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [editSuccessMsg, setEditSuccessMsg] = useState('');

  // Fetch users when component mounts
  const fetchUsers = async () => {
    setLoadingUsers(true);
    try {
      const data = await api.getUsers();
      setUsersList(data);
    } catch (e) {
      console.error('Failed to load users directory:', e);
    } finally {
      setLoadingUsers(false);
    }
  };

  const fetchInvitations = async () => {
    setLoadingInvitations(true);
    try {
      const data = await api.getInvitations();
      setInvitationsList(data);
    } catch (e) {
      console.error('Failed to load invitations:', e);
    } finally {
      setLoadingInvitations(false);
    }
  };

  const fetchAuditLogs = async () => {
    setLoadingLogs(true);
    try {
      const data = await api.getAuditLogs();
      setAuditLogsList(data);
    } catch (e) {
      console.error('Failed to load audit logs:', e);
    } finally {
      setLoadingLogs(false);
    }
  };

  useEffect(() => {
    fetchUsers();
    if (isSuperAdmin) {
      fetchInvitations();
      fetchAuditLogs();
    }
  }, [isSuperAdmin]);

  // Categorize dedication records
  const leaderApprovedRecords = dedications.filter(d => d.leadershipConfirmed && !d.officeApproved);
  const awaitingLeaderRecords = dedications.filter(d => !d.leadershipConfirmed);
  const officeCompiledRecords = dedications.filter(d => d.officeApproved);

  // Filter based on active tab & filters
  const currentList = (
    activeSubTab === 'leader_approved'
      ? leaderApprovedRecords
      : activeSubTab === 'awaiting_leader'
      ? awaitingLeaderRecords
      : officeCompiledRecords
  ).filter((d) => {
    const matchesSearch =
      d.childName.toLowerCase().includes(search.toLowerCase()) ||
      d.id.toLowerCase().includes(search.toLowerCase()) ||
      d.fatherName.toLowerCase().includes(search.toLowerCase()) ||
      d.motherName.toLowerCase().includes(search.toLowerCase()) ||
      d.selectedFellowship.toLowerCase().includes(search.toLowerCase());

    const matchesZone = selectedZone === 'All' || d.selectedZone === selectedZone;
    const matchesMonth = selectedMonth === 'All' || d.serviceDate === selectedMonth;

    return matchesSearch && matchesZone && matchesMonth;
  });

  const handleOverrideFellowshipApprove = async (record: DedicationRecord) => {
    try {
      await onUpdateDedication(record.id, {
        leadershipConfirmed: true,
        fellowshipLeaderName: `${user?.name || 'Church Office'} (Admin / Pastor Override)`,
        fellowshipConfirmedAt: new Date().toISOString(),
        fellowshipNotes: 'Directly confirmed from fellowship level by Church Office & Pastor due to leader delay or absence.',
        status: 'fellowship_confirmed'
      });
    } catch (e) {
      console.error('Override failed:', e);
      alert('Override failed. Please try again.');
    }
  };

  const handleOfficeApprove = async (record: DedicationRecord) => {
    const certNum = record.certificateNumber || `DCU-DED-${new Date().getFullYear()}-${Math.floor(100 + Math.random() * 900)}`;
    try {
      await onUpdateDedication(record.id, {
        officeApproved: true,
        officeAdminName: user?.name || 'Church Office Administrator',
        officeConfirmedAt: new Date().toISOString(),
        status: 'compiled',
        certificateIssued: true,
        certificateNumber: certNum,
        serviceDate: record.serviceDate || '2026-11-29'
      });
    } catch (e) {
      console.error('Office approve failed:', e);
      alert('Approval failed. Please try again.');
    }
  };

  const handleMarkCompleted = async (record: DedicationRecord) => {
    try {
      await onUpdateDedication(record.id, {
        status: 'completed',
        certificateIssued: true
      });
    } catch (e) {
      console.error('Mark completed failed:', e);
    }
  };

  // Open Edit Modal to correct typos/mistakes
  const handleOpenEditModal = (record: DedicationRecord) => {
    setEditingRecord(record);
    setEditFormData({
      childName: record.childName,
      childDob: record.childDob,
      childGender: record.childGender,
      childCountyOfBirth: record.childCountyOfBirth || record.childPlaceOfBirth || 'Nairobi',
      fatherName: record.fatherName,
      fatherPhone: record.fatherPhone,
      fatherEmail: record.fatherEmail,
      motherName: record.motherName,
      motherPhone: record.motherPhone,
      motherEmail: record.motherEmail,
      selectedZone: record.selectedZone,
      selectedFellowship: record.selectedFellowship,
      residentialLocation: record.residentialLocation,
      serviceDate: record.serviceDate
    });
    setEditSuccessMsg('');
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingRecord) return;
    setIsSavingEdit(true);
    try {
      await onUpdateDedication(editingRecord.id, editFormData);
      setEditSuccessMsg('Parent form updated successfully! Mistakes corrected.');
      setTimeout(() => {
        setEditingRecord(null);
        setEditSuccessMsg('');
      }, 900);
    } catch (err) {
      console.error('Save failed:', err);
      alert('Failed to save corrections.');
    } finally {
      setIsSavingEdit(false);
    }
  };

  // User management updates
  const handleUpdateUserRole = async (userId: string, newRole: string, newZone?: string) => {
    try {
      await api.updateUserRole(userId, newRole, newZone);
      fetchUsers();
    } catch (err: any) {
      alert(err?.message || 'Failed to update user role');
    }
  };

  const handleToggleUserSuspension = async (u: UserProfile) => {
    const nextState = !u.isSuspended;
    const confirmMsg = nextState
      ? `Suspend user ${u.name} (${u.email})? Their active sessions will be terminated immediately.`
      : `Re-activate user ${u.name} (${u.email})?`;
    if (!window.confirm(confirmMsg)) return;

    try {
      await api.updateUserStatus(u.id, nextState);
      fetchUsers();
    } catch (err: any) {
      alert(err?.message || 'Failed to update suspension status');
    }
  };

  // Issue Staff Invitation
  const handleCreateInviteSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setInviteError('');
    try {
      const res = await api.inviteStaff({
        email: inviteEmail.trim(),
        name: inviteName.trim(),
        role: inviteRole,
        assignedZone: inviteRole === 'fellowship_leader' ? inviteZone : undefined
      });
      setCreatedInviteResult({ rawToken: res.rawToken, inviteUrl: res.inviteUrl });
      fetchInvitations();
    } catch (err: any) {
      setInviteError(err?.message || 'Failed to issue staff invitation.');
    }
  };

  const handleRevokeInvite = async (invId: string) => {
    if (!window.confirm('Revoke this staff invitation token? The recipient will not be able to activate access.')) return;
    try {
      await api.revokeInvitation(invId);
      fetchInvitations();
    } catch (err: any) {
      alert(err?.message || 'Failed to revoke invitation');
    }
  };

  const filteredUsers = usersList.filter(u => 
    u.name.toLowerCase().includes(usersSearch.toLowerCase()) ||
    u.email.toLowerCase().includes(usersSearch.toLowerCase()) ||
    (u.assignedZone && u.assignedZone.toLowerCase().includes(usersSearch.toLowerCase())) ||
    u.role.toLowerCase().includes(usersSearch.toLowerCase())
  );

  const filteredAuditLogs = auditLogsList.filter(log => {
    const matchesSearch = 
      log.eventType.toLowerCase().includes(logSearch.toLowerCase()) ||
      log.actorEmail.toLowerCase().includes(logSearch.toLowerCase()) ||
      (log.targetId && log.targetId.toLowerCase().includes(logSearch.toLowerCase())) ||
      (log.details && JSON.stringify(log.details).toLowerCase().includes(logSearch.toLowerCase()));
    const matchesOutcome = logFilterOutcome === 'ALL' || log.outcome === logFilterOutcome;
    return matchesSearch && matchesOutcome;
  });

  return (
    <div className="space-y-6 pb-12">
      {/* Office Header */}
      <div className="bg-gradient-to-r from-[#2a170e] via-[#331c11] to-[#221107] text-white p-6 sm:p-8 rounded-3xl shadow-xl border-2 border-[#d4af37]/40 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="p-2 rounded-xl bg-[#d4af37]/20 border border-[#d4af37]/40 text-[#ffd700]">
                <Building2 className="w-6 h-6" />
              </span>
              <h1 className="text-xl sm:text-2xl font-cinzel font-bold text-white tracking-wide">
                Church Office & Pastoral Console
              </h1>
            </div>
            <p className="text-xs sm:text-sm text-gray-300 max-w-2xl">
              Deliverance Church International Utawala administrative management system. Confirms fellowship recommendations, schedules dedication dates, corrects form errors, issues certificates, and enforces RBAC authorization.
            </p>
          </div>

          {/* Action Buttons: GitHub ZIP & Staff Invite */}
          <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
            <a
              href="/dcu-child-dedication-portal.zip"
              download="dcu-child-dedication-portal.zip"
              className="bg-white/10 hover:bg-white/20 text-[#ffd700] border border-[#d4af37]/60 font-bold px-3.5 py-2.5 rounded-xl text-xs sm:text-sm shadow-md flex items-center gap-2 cursor-pointer whitespace-nowrap transition-all"
              title="Download full project ZIP archive to commit and push to GitHub repository"
            >
              <Download className="w-4 h-4 text-[#ffd700]" />
              Download GitHub ZIP
            </a>

            {isSuperAdmin && (
              <button
                onClick={() => {
                  setIsInviteModalOpen(true);
                  setCreatedInviteResult(null);
                  setInviteEmail('');
                  setInviteName('');
                  setInviteError('');
                }}
                className="bg-[#d4af37] hover:bg-[#e6c154] text-[#2a170e] font-bold px-4 py-2.5 rounded-xl text-xs sm:text-sm shadow-md flex items-center gap-2 cursor-pointer whitespace-nowrap"
              >
                <KeyRound className="w-4 h-4 text-[#2a170e]" />
                Invite Staff / Pastor
              </button>
            )}
          </div>
        </div>

        {/* Sub-Tab Navigation Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 pt-2 border-t border-white/10">
          <button
            onClick={() => setActiveSubTab('leader_approved')}
            className={`p-3 rounded-2xl border text-left transition-all cursor-pointer ${
              activeSubTab === 'leader_approved'
                ? 'bg-[#d4af37]/30 border-[#d4af37] text-white shadow-md'
                : 'bg-black/20 border-white/10 text-gray-300 hover:bg-black/30'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase text-[#ffd700]">Leader Verified</span>
              <Check className="w-4 h-4 text-[#ffd700]" />
            </div>
            <p className="text-2xl font-cinzel font-bold text-white mt-1">{leaderApprovedRecords.length}</p>
            <p className="text-[10px] text-gray-300">Ready for Confirmation</p>
          </button>

          <button
            onClick={() => setActiveSubTab('awaiting_leader')}
            className={`p-3 rounded-2xl border text-left transition-all cursor-pointer ${
              activeSubTab === 'awaiting_leader'
                ? 'bg-amber-500/30 border-amber-400 text-white shadow-md'
                : 'bg-black/20 border-white/10 text-gray-300 hover:bg-black/30'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase text-amber-300">Awaiting Leader</span>
              <AlertTriangle className="w-4 h-4 text-amber-400" />
            </div>
            <p className="text-2xl font-cinzel font-bold text-white mt-1">{awaitingLeaderRecords.length}</p>
            <p className="text-[10px] text-gray-300">Pending Review</p>
          </button>

          <button
            onClick={() => setActiveSubTab('office_compiled')}
            className={`p-3 rounded-2xl border text-left transition-all cursor-pointer ${
              activeSubTab === 'office_compiled'
                ? 'bg-emerald-500/30 border-emerald-400 text-white shadow-md'
                : 'bg-black/20 border-white/10 text-gray-300 hover:bg-black/30'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase text-emerald-300">Office Compiled</span>
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            </div>
            <p className="text-2xl font-cinzel font-bold text-white mt-1">{officeCompiledRecords.length}</p>
            <p className="text-[10px] text-gray-300">Dedication Sunday List</p>
          </button>

          <button
            onClick={() => { setActiveSubTab('users_directory'); fetchUsers(); }}
            className={`p-3 rounded-2xl border text-left transition-all cursor-pointer ${
              activeSubTab === 'users_directory'
                ? 'bg-blue-600/30 border-blue-400 text-white shadow-md'
                : 'bg-black/20 border-white/10 text-gray-300 hover:bg-black/30'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase text-blue-300">Staff Accounts</span>
              <Users className="w-4 h-4 text-blue-300" />
            </div>
            <p className="text-2xl font-cinzel font-bold text-white mt-1">{usersList.length}</p>
            <p className="text-[10px] text-gray-300">RBAC Directory</p>
          </button>

          {isSuperAdmin && (
            <button
              onClick={() => { setActiveSubTab('staff_invitations'); fetchInvitations(); }}
              className={`p-3 rounded-2xl border text-left transition-all cursor-pointer ${
                activeSubTab === 'staff_invitations'
                  ? 'bg-purple-600/30 border-purple-400 text-white shadow-md'
                  : 'bg-black/20 border-white/10 text-gray-300 hover:bg-black/30'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase text-purple-300">Invitations</span>
                <KeyRound className="w-4 h-4 text-purple-300" />
              </div>
              <p className="text-2xl font-cinzel font-bold text-white mt-1">{invitationsList.length}</p>
              <p className="text-[10px] text-gray-300">Single-Use Tokens</p>
            </button>
          )}

          {isSuperAdmin && (
            <button
              onClick={() => { setActiveSubTab('audit_logs'); fetchAuditLogs(); }}
              className={`p-3 rounded-2xl border text-left transition-all cursor-pointer ${
                activeSubTab === 'audit_logs'
                  ? 'bg-rose-600/30 border-rose-400 text-white shadow-md'
                  : 'bg-black/20 border-white/10 text-gray-300 hover:bg-black/30'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase text-rose-300">Audit Logs</span>
                <History className="w-4 h-4 text-rose-300" />
              </div>
              <p className="text-2xl font-cinzel font-bold text-white mt-1">{auditLogsList.length}</p>
              <p className="text-[10px] text-gray-300">Security Events</p>
            </button>
          )}
        </div>
      </div>

      {/* SUB-TABS 1, 2, 3: DEDICATIONS LIST */}
      {(activeSubTab === 'leader_approved' || activeSubTab === 'awaiting_leader' || activeSubTab === 'office_compiled') && (
        <>
          {/* Filters Bar */}
          <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-xs space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="relative">
                <Search className="w-4 h-4 text-gray-400 absolute left-3 top-3.5" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search candidate, parent, fellowship..."
                  className="w-full pl-9 pr-3 py-2.5 text-xs sm:text-sm border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#d4af37] outline-hidden"
                />
              </div>

              <div>
                <select
                  value={selectedZone}
                  onChange={(e) => setSelectedZone(e.target.value)}
                  className="w-full py-2.5 px-3 text-xs sm:text-sm border border-gray-300 rounded-xl bg-white focus:ring-2 focus:ring-[#d4af37] outline-hidden font-medium"
                >
                  <option value="All">All Fellowship Zones (A to E)</option>
                  {ZONES.map((z) => (
                    <option key={z.name} value={z.name}>{z.name}</option>
                  ))}
                  <option value="Unallocated">Unallocated</option>
                </select>
              </div>

              <div>
                <select
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(e.target.value)}
                  className="w-full py-2.5 px-3 text-xs sm:text-sm border border-gray-300 rounded-xl bg-white focus:ring-2 focus:ring-[#d4af37] outline-hidden font-medium"
                >
                  <option value="All">All Dedication Dates</option>
                  {MONTHLY_DEDICATION_DATES.map((m) => (
                    <option key={m.date} value={m.date}>{m.label} ({m.date})</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Dedications Table */}
          <div className="bg-white rounded-3xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs sm:text-sm">
                <thead className="bg-[#2a170e] text-[#ffd700] font-cinzel text-xs tracking-wider border-b-2 border-[#d4af37]/40">
                  <tr>
                    <th className="py-3.5 px-4">Ref ID & Candidate</th>
                    <th className="py-3.5 px-4">Parents & Contacts</th>
                    <th className="py-3.5 px-4">Zone & Fellowship</th>
                    <th className="py-3.5 px-4">Leader Endorsement</th>
                    <th className="py-3.5 px-4">Service Sunday</th>
                    <th className="py-3.5 px-4 text-right">Office Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {currentList.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-12 text-center text-gray-500">
                        No dedication records found for this view.
                      </td>
                    </tr>
                  ) : (
                    currentList.map((item) => (
                      <tr key={item.id} className="hover:bg-amber-50/20 transition-colors">
                        <td className="py-3.5 px-4">
                          <span className="font-mono text-[11px] font-bold text-amber-900 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded">
                            {item.id}
                          </span>
                          <p className="font-bold text-[#2a170e] mt-1 text-sm">{item.childName}</p>
                          <p className="text-[11px] text-gray-500">DOB: {item.childDob} • {item.childGender}</p>
                        </td>

                        <td className="py-3.5 px-4">
                          <p className="font-semibold text-gray-800">{item.parentName || `${item.fatherName} & ${item.motherName}`}</p>
                          <p className="text-[11px] text-gray-600">Tel: {item.parentPhone || item.fatherPhone || item.motherPhone}</p>
                          <p className="text-[11px] text-gray-500">{item.parentEmail || item.fatherEmail || item.motherEmail}</p>
                        </td>

                        <td className="py-3.5 px-4">
                          <span className="font-bold text-[#2a170e] bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-md text-xs">
                            {item.selectedZone}
                          </span>
                          <p className="text-xs text-gray-700 font-medium mt-1">{item.selectedFellowship}</p>
                        </td>

                        <td className="py-3.5 px-4">
                          {item.leadershipConfirmed ? (
                            <div className="space-y-1">
                              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-full">
                                <CheckCircle2 className="w-3 h-3 text-emerald-700" />
                                Endorsed
                              </span>
                              <p className="text-[10px] text-gray-600 font-medium">By: {item.fellowshipLeaderName}</p>
                            </div>
                          ) : (
                            <div className="space-y-1.5">
                              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-800 bg-amber-100 px-2 py-0.5 rounded-full">
                                <Clock className="w-3 h-3 text-amber-700" />
                                Awaiting {item.selectedZone} Leader
                              </span>
                              <button
                                type="button"
                                onClick={() => handleOverrideFellowshipApprove(item)}
                                className="block text-[10px] bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 px-2 py-1 rounded-md font-bold cursor-pointer"
                              >
                                ⚡ Admin Override & Confirm
                              </button>
                            </div>
                          )}
                        </td>

                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <select
                            value={item.serviceDate || 'To be scheduled by Pastoral Office'}
                            onChange={(e) => onUpdateDedication(item.id, { serviceDate: e.target.value })}
                            className="text-xs p-1.5 border border-amber-300 rounded-lg bg-white font-bold text-[#2a170e]"
                          >
                            <option value="To be scheduled by Pastoral Office">To be scheduled by Pastoral Office</option>
                            {MONTHLY_DEDICATION_DATES.map((m) => (
                              <option key={m.date} value={m.date}>{m.label}</option>
                            ))}
                          </select>
                          {item.certificateNumber && (
                            <span className="block font-mono text-[10px] text-[#aa8222] mt-0.5">{item.certificateNumber}</span>
                          )}
                        </td>

                        <td className="py-3.5 px-4 text-right whitespace-nowrap">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => handleOpenEditModal(item)}
                              title="Correct spelling, contacts, or dates"
                              className="p-1.5 text-gray-500 hover:text-[#2a170e] hover:bg-amber-50 border border-gray-200 rounded-lg text-xs font-medium cursor-pointer flex items-center gap-1"
                            >
                              <Edit3 className="w-3.5 h-3.5 text-[#d4af37]" />
                              <span className="hidden lg:inline text-[11px]">Edit / Correct</span>
                            </button>

                            {item.officeApproved ? (
                              <>
                                <button
                                  onClick={() => onOpenCertificate(item)}
                                  className="bg-[#fbf5e6] hover:bg-[#f3e7c8] text-[#8a6a1c] border border-[#d4af37]/40 px-2.5 py-1.5 rounded-lg text-xs font-bold cursor-pointer"
                                >
                                  Certificate
                                </button>
                                {item.status !== 'completed' ? (
                                  <button
                                    onClick={() => handleMarkCompleted(item)}
                                    className="bg-emerald-700 hover:bg-emerald-800 text-white px-2.5 py-1.5 rounded-lg text-xs font-bold cursor-pointer"
                                  >
                                    Mark Dedicated
                                  </button>
                                ) : (
                                  <span className="text-[11px] font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-md">
                                    Completed
                                  </span>
                                )}
                              </>
                            ) : (
                              <button
                                onClick={() => handleOfficeApprove(item)}
                                className="bg-[#2a170e] hover:bg-[#3d2314] text-[#ffd700] border border-[#d4af37] px-3 py-1.5 rounded-xl text-xs font-bold shadow-xs cursor-pointer flex items-center gap-1"
                              >
                                <Check className="w-3.5 h-3.5" />
                                Office Confirm
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* SUB-TAB 4: STAFF DIRECTORY */}
      {activeSubTab === 'users_directory' && (
        <div className="space-y-4">
          <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="space-y-1">
              <h3 className="text-base font-cinzel font-bold text-[#2a170e] flex items-center gap-2">
                <Users className="w-5 h-5 text-[#d4af37]" />
                Authorized Staff & Leadership Accounts Directory
              </h3>
              <p className="text-xs text-gray-600">
                Server-enforced role assignments, fellowship allocations, and suspension controls.
              </p>
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <div className="relative flex-1 sm:w-64">
                <Search className="w-4 h-4 text-gray-400 absolute left-3 top-3" />
                <input
                  type="text"
                  value={usersSearch}
                  onChange={(e) => setUsersSearch(e.target.value)}
                  placeholder="Search staff by name, email..."
                  className="w-full pl-9 pr-3 py-2 text-xs border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#d4af37] outline-hidden"
                />
              </div>
              <button
                type="button"
                onClick={fetchUsers}
                className="p-2 border border-gray-200 rounded-xl hover:bg-gray-50 text-gray-600 cursor-pointer"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="bg-white rounded-3xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs sm:text-sm">
                <thead className="bg-[#2a170e] text-[#ffd700] font-cinzel text-xs tracking-wider border-b-2 border-[#d4af37]/40">
                  <tr>
                    <th className="py-3.5 px-4">Staff Member</th>
                    <th className="py-3.5 px-4">Email</th>
                    <th className="py-3.5 px-4">Enforced Role</th>
                    <th className="py-3.5 px-4">Assigned Zone</th>
                    <th className="py-3.5 px-4">Status</th>
                    <th className="py-3.5 px-4">Last Login</th>
                    {isSuperAdmin && <th className="py-3.5 px-4 text-right">Super Admin Control</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {loadingUsers ? (
                    <tr>
                      <td colSpan={7} className="py-10 text-center text-gray-500">Loading accounts directory...</td>
                    </tr>
                  ) : filteredUsers.map((u) => (
                    <tr key={u.id} className="hover:bg-amber-50/20 transition-colors">
                      <td className="py-3.5 px-4 font-bold text-gray-900">{u.name}</td>
                      <td className="py-3.5 px-4 font-mono text-xs text-gray-700">{u.email}</td>
                      <td className="py-3.5 px-4">
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full border bg-amber-50 text-amber-900 border-amber-300 uppercase">
                          <Shield className="w-3 h-3 text-[#aa8222]" />
                          {u.role.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 font-bold text-[#2a170e]">{u.assignedZone || 'All Zones'}</td>
                      <td className="py-3.5 px-4">
                        {u.isSuspended ? (
                          <span className="text-[11px] font-bold text-red-700 bg-red-100 px-2 py-0.5 rounded-md">
                            Suspended
                          </span>
                        ) : (
                          <span className="text-[11px] font-bold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-md">
                            Active
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-xs text-gray-500">
                        {u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleDateString() : 'Never'}
                      </td>
                      {isSuperAdmin && (
                        <td className="py-3.5 px-4 text-right whitespace-nowrap">
                          <div className="flex items-center justify-end gap-1.5">
                            {u.id !== user?.id && (
                              <button
                                onClick={() => handleToggleUserSuspension(u)}
                                className={`text-[10px] px-2 py-1 rounded-md font-bold cursor-pointer border ${
                                  u.isSuspended
                                    ? 'bg-emerald-50 text-emerald-800 border-emerald-300 hover:bg-emerald-100'
                                    : 'bg-red-50 text-red-800 border-red-300 hover:bg-red-100'
                                }`}
                              >
                                {u.isSuspended ? 'Reactivate' : 'Suspend'}
                              </button>
                            )}
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* SUB-TAB 5: STAFF INVITATIONS (SUPER ADMIN ONLY) */}
      {activeSubTab === 'staff_invitations' && isSuperAdmin && (
        <div className="space-y-4">
          <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="space-y-1">
              <h3 className="text-base font-cinzel font-bold text-[#2a170e] flex items-center gap-2">
                <KeyRound className="w-5 h-5 text-[#d4af37]" />
                Staff Invitations & Single-Use Authorization Tokens
              </h3>
              <p className="text-xs text-gray-600">
                Authorized staff accounts are invitation-only. Every invitation token is single-use, revocable, and expires in 7 days.
              </p>
            </div>

            <button
              onClick={() => {
                setIsInviteModalOpen(true);
                setCreatedInviteResult(null);
                setInviteEmail('');
                setInviteName('');
                setInviteError('');
              }}
              className="bg-[#2a170e] hover:bg-[#3d2314] text-[#ffd700] border border-[#d4af37] px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm cursor-pointer"
            >
              <UserPlus className="w-4 h-4 text-[#ffd700]" />
              Issue New Invitation
            </button>
          </div>

          <div className="bg-white rounded-3xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs sm:text-sm">
                <thead className="bg-[#2a170e] text-[#ffd700] font-cinzel text-xs tracking-wider border-b-2 border-[#d4af37]/40">
                  <tr>
                    <th className="py-3.5 px-4">Invited Email & Name</th>
                    <th className="py-3.5 px-4">Target Role</th>
                    <th className="py-3.5 px-4">Assigned Zone</th>
                    <th className="py-3.5 px-4">Expires</th>
                    <th className="py-3.5 px-4">Status</th>
                    <th className="py-3.5 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {loadingInvitations ? (
                    <tr>
                      <td colSpan={6} className="py-10 text-center text-gray-500">Loading invitations...</td>
                    </tr>
                  ) : invitationsList.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-10 text-center text-gray-500">No staff invitations issued yet.</td>
                    </tr>
                  ) : (
                    invitationsList.map((inv) => (
                      <tr key={inv.id} className="hover:bg-amber-50/20 transition-colors">
                        <td className="py-3.5 px-4">
                          <p className="font-bold text-gray-900">{inv.email}</p>
                          {inv.name && <p className="text-xs text-gray-500">{inv.name}</p>}
                        </td>
                        <td className="py-3.5 px-4 uppercase font-bold text-xs text-[#2a170e]">
                          {inv.role.replace('_', ' ')}
                        </td>
                        <td className="py-3.5 px-4 font-bold text-gray-700">
                          {inv.assignedZone || 'All Zones'}
                        </td>
                        <td className="py-3.5 px-4 text-xs text-gray-600">
                          {new Date(inv.expiresAt).toLocaleDateString()}
                        </td>
                        <td className="py-3.5 px-4">
                          {inv.status === 'accepted' ? (
                            <span className="text-[11px] font-bold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-md">Accepted</span>
                          ) : inv.status === 'revoked' ? (
                            <span className="text-[11px] font-bold text-red-800 bg-red-100 px-2 py-0.5 rounded-md">Revoked</span>
                          ) : inv.status === 'expired' ? (
                            <span className="text-[11px] font-bold text-gray-600 bg-gray-100 px-2 py-0.5 rounded-md">Expired</span>
                          ) : (
                            <span className="text-[11px] font-bold text-amber-800 bg-amber-100 px-2 py-0.5 rounded-md">Pending</span>
                          )}
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          {inv.status === 'pending' && (
                            <button
                              onClick={() => handleRevokeInvite(inv.id)}
                              className="text-[10px] bg-red-50 hover:bg-red-100 text-red-700 border border-red-300 px-2.5 py-1 rounded-md font-bold cursor-pointer"
                            >
                              Revoke
                            </button>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* SUB-TAB 6: SECURITY AUDIT LOGS (SUPER ADMIN ONLY) */}
      {activeSubTab === 'audit_logs' && isSuperAdmin && (
        <div className="space-y-4">
          <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="space-y-1">
              <h3 className="text-base font-cinzel font-bold text-[#2a170e] flex items-center gap-2">
                <History className="w-5 h-5 text-[#d4af37]" />
                Protected Security Audit Trail
              </h3>
              <p className="text-xs text-gray-600">
                Immutable, server-recorded security events: privileged logins, invitations, suspensions, and access failures.
              </p>
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <div className="relative flex-1 sm:w-64">
                <Search className="w-4 h-4 text-gray-400 absolute left-3 top-3" />
                <input
                  type="text"
                  value={logSearch}
                  onChange={(e) => setLogSearch(e.target.value)}
                  placeholder="Filter logs by event, actor..."
                  className="w-full pl-9 pr-3 py-2 text-xs border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#d4af37] outline-hidden"
                />
              </div>
              <select
                value={logFilterOutcome}
                onChange={(e) => setLogFilterOutcome(e.target.value as any)}
                className="py-2 px-3 text-xs border border-gray-300 rounded-xl bg-white font-medium"
              >
                <option value="ALL">All Outcomes</option>
                <option value="SUCCESS">Success Only</option>
                <option value="FAILURE">Failures / Blocked</option>
              </select>
              <button
                type="button"
                onClick={fetchAuditLogs}
                className="p-2 border border-gray-200 rounded-xl hover:bg-gray-50 text-gray-600 cursor-pointer"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="bg-white rounded-3xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs sm:text-sm">
                <thead className="bg-[#2a170e] text-[#ffd700] font-cinzel text-xs tracking-wider border-b-2 border-[#d4af37]/40">
                  <tr>
                    <th className="py-3.5 px-4">Timestamp</th>
                    <th className="py-3.5 px-4">Event Type</th>
                    <th className="py-3.5 px-4">Actor</th>
                    <th className="py-3.5 px-4">Outcome</th>
                    <th className="py-3.5 px-4">IP Address</th>
                    <th className="py-3.5 px-4">Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 font-mono text-xs">
                  {loadingLogs ? (
                    <tr>
                      <td colSpan={6} className="py-10 text-center text-gray-500">Loading audit trail...</td>
                    </tr>
                  ) : filteredAuditLogs.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-10 text-center text-gray-500">No audit events match your search.</td>
                    </tr>
                  ) : (
                    filteredAuditLogs.map((log) => (
                      <tr key={log.id} className="hover:bg-amber-50/20 transition-colors">
                        <td className="py-3 px-4 text-gray-500 whitespace-nowrap">
                          {new Date(log.timestamp).toLocaleString()}
                        </td>
                        <td className="py-3 px-4 font-bold text-gray-900">
                          {log.eventType}
                        </td>
                        <td className="py-3 px-4 text-gray-700">
                          {log.actorEmail} ({log.actorRole})
                        </td>
                        <td className="py-3 px-4">
                          {log.outcome === 'SUCCESS' ? (
                            <span className="text-[10px] font-bold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-md">
                              SUCCESS
                            </span>
                          ) : (
                            <span className="text-[10px] font-bold text-red-800 bg-red-100 px-2 py-0.5 rounded-md">
                              BLOCKED / FAILURE
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-gray-500">
                          {log.ip || '-'}
                        </td>
                        <td className="py-3 px-4 text-gray-600 max-w-xs truncate">
                          {log.details ? JSON.stringify(log.details) : '-'}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ISSUE STAFF INVITATION MODAL (Super Admin) */}
      {isInviteModalOpen && isSuperAdmin && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-8 space-y-5 shadow-2xl border-2 border-[#d4af37]/60 animate-in fade-in zoom-in-95 duration-150 my-6">
            <div className="flex items-center justify-between border-b pb-3 border-gray-200">
              <div className="flex items-center gap-2">
                <KeyRound className="w-5 h-5 text-[#d4af37]" />
                <h3 className="text-lg font-cinzel font-bold text-[#2a170e]">Issue Staff Invitation</h3>
              </div>
              <button
                onClick={() => setIsInviteModalOpen(false)}
                className="text-gray-400 hover:text-gray-700 p-1 cursor-pointer"
              >
                ✕
              </button>
            </div>

            {createdInviteResult ? (
              <div className="space-y-4">
                <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-900 space-y-2">
                  <p className="font-bold flex items-center gap-1.5 text-sm">
                    <CheckCircle2 className="w-5 h-5 text-emerald-700" />
                    Invitation Issued Successfully!
                  </p>
                  <p className="text-xs">
                    Share this secret single-use activation link or token with the authorized staff member:
                  </p>
                </div>

                <div className="space-y-2">
                  <label className="block text-xs font-bold text-gray-700 uppercase">Single-Use Token</label>
                  <input
                    type="text"
                    readOnly
                    value={createdInviteResult.rawToken}
                    className="w-full p-2.5 text-xs font-mono bg-gray-50 border border-gray-300 rounded-xl"
                  />
                </div>

                <div className="space-y-2">
                  <label className="block text-xs font-bold text-gray-700 uppercase">Direct Activation Link</label>
                  <input
                    type="text"
                    readOnly
                    value={createdInviteResult.inviteUrl}
                    className="w-full p-2.5 text-xs font-mono bg-gray-50 border border-gray-300 rounded-xl"
                  />
                </div>

                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(createdInviteResult.inviteUrl);
                    setCopiedToken(true);
                    setTimeout(() => setCopiedToken(false), 2000);
                  }}
                  className="w-full py-2.5 bg-[#2a170e] hover:bg-[#3d2314] text-[#ffd700] border border-[#d4af37] font-bold rounded-xl text-xs flex items-center justify-center gap-2 cursor-pointer shadow-md"
                >
                  <Copy className="w-4 h-4" />
                  {copiedToken ? 'Copied to Clipboard!' : 'Copy Invitation Link'}
                </button>
              </div>
            ) : (
              <form onSubmit={handleCreateInviteSubmit} className="space-y-4">
                {inviteError && (
                  <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700 flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
                    <span>{inviteError}</span>
                  </div>
                )}

                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Recipient Email Address</label>
                  <input
                    type="email"
                    required
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    placeholder="staff.email@dcutawala.org"
                    className="w-full p-2 text-xs sm:text-sm border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#d4af37] outline-hidden"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Staff Member Name (Optional)</label>
                  <input
                    type="text"
                    value={inviteName}
                    onChange={(e) => setInviteName(e.target.value)}
                    placeholder="e.g. Pastor David or Leader Jane"
                    className="w-full p-2 text-xs sm:text-sm border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#d4af37] outline-hidden"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Privileged Role</label>
                  <select
                    value={inviteRole}
                    onChange={(e) => setInviteRole(e.target.value as any)}
                    className="w-full p-2 text-xs sm:text-sm border border-gray-300 rounded-xl bg-white font-bold text-[#2a170e]"
                  >
                    <option value="fellowship_leader">Fellowship Zone Leader (Zone verification)</option>
                    <option value="pastor">Pastor (Pastoral review & dedication archives)</option>
                    <option value="office_admin">Church Office Admin (Full form & certificate control)</option>
                    <option value="super_admin">Super Admin (Full staff management & security)</option>
                  </select>
                </div>

                {inviteRole === 'fellowship_leader' && (
                  <div>
                    <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Assigned Fellowship Zone</label>
                    <select
                      value={inviteZone}
                      onChange={(e) => setInviteZone(e.target.value as any)}
                      className="w-full p-2 text-xs sm:text-sm border border-gray-300 rounded-xl bg-white font-bold text-[#2a170e]"
                    >
                      {ZONES.map((z) => (
                        <option key={z.name} value={z.name}>{z.name}</option>
                      ))}
                    </select>
                  </div>
                )}

                <button
                  type="submit"
                  className="w-full py-2.5 bg-[#2a170e] hover:bg-[#3d2314] text-[#ffd700] border border-[#d4af37] font-bold rounded-xl text-xs sm:text-sm shadow-md transition-all cursor-pointer flex items-center justify-center gap-2"
                >
                  <KeyRound className="w-4 h-4" />
                  Generate Single-Use Invitation
                </button>
              </form>
            )}
          </div>
        </div>
      )}

      {/* EDIT / CORRECT FORM MISTAKES MODAL */}
      {editingRecord && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-6 sm:p-8 space-y-5 shadow-2xl border-2 border-[#d4af37]/60 animate-in fade-in zoom-in-95 duration-150 my-6">
            <div className="flex items-center justify-between border-b pb-3 border-gray-200">
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono font-bold text-amber-900 bg-amber-100 px-2 py-0.5 rounded-md">
                    {editingRecord.id}
                  </span>
                  <h2 className="text-lg sm:text-xl font-cinzel font-bold text-[#2a170e]">
                    Correct Parent Form Mistakes
                  </h2>
                </div>
                <p className="text-xs text-gray-600">
                  Church Office Admins and Pastors can update names, spelling, contacts, or fellowship details.
                </p>
              </div>
              <button
                onClick={() => setEditingRecord(null)}
                className="p-1 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {editSuccessMsg && (
              <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>{editSuccessMsg}</span>
              </div>
            )}

            <form onSubmit={handleSaveEdit} className="space-y-4">
              <div className="bg-amber-50/40 p-4 rounded-2xl border border-amber-200/60 space-y-3">
                <h4 className="text-xs font-bold text-[#2a170e] uppercase tracking-wider">Child's Information</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Child Full Name</label>
                    <input
                      type="text"
                      value={editFormData.childName || ''}
                      onChange={(e) => setEditFormData({ ...editFormData, childName: e.target.value })}
                      className="w-full p-2 text-xs border border-gray-300 rounded-xl bg-white"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Date of Birth</label>
                    <input
                      type="date"
                      value={editFormData.childDob || ''}
                      onChange={(e) => setEditFormData({ ...editFormData, childDob: e.target.value })}
                      className="w-full p-2 text-xs border border-gray-300 rounded-xl bg-white"
                      required
                    />
                  </div>
                </div>
              </div>

              <div className="bg-gray-50 p-4 rounded-2xl border border-gray-200 space-y-3">
                <h4 className="text-xs font-bold text-[#2a170e] uppercase tracking-wider">Parents & Contacts</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Father's Name</label>
                    <input
                      type="text"
                      value={editFormData.fatherName || ''}
                      onChange={(e) => setEditFormData({ ...editFormData, fatherName: e.target.value })}
                      className="w-full p-2 text-xs border border-gray-300 rounded-xl bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Father's Phone</label>
                    <input
                      type="tel"
                      value={editFormData.fatherPhone || ''}
                      onChange={(e) => setEditFormData({ ...editFormData, fatherPhone: e.target.value })}
                      className="w-full p-2 text-xs border border-gray-300 rounded-xl bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Mother's Name</label>
                    <input
                      type="text"
                      value={editFormData.motherName || ''}
                      onChange={(e) => setEditFormData({ ...editFormData, motherName: e.target.value })}
                      className="w-full p-2 text-xs border border-gray-300 rounded-xl bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Mother's Phone</label>
                    <input
                      type="tel"
                      value={editFormData.motherPhone || ''}
                      onChange={(e) => setEditFormData({ ...editFormData, motherPhone: e.target.value })}
                      className="w-full p-2 text-xs border border-gray-300 rounded-xl bg-white"
                    />
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingRecord(null)}
                  className="px-4 py-2 border border-gray-300 text-gray-700 rounded-xl text-xs font-bold hover:bg-gray-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingEdit}
                  className="px-4 py-2 bg-[#2a170e] hover:bg-[#3d2314] text-[#ffd700] border border-[#d4af37] rounded-xl text-xs font-bold shadow-md cursor-pointer flex items-center gap-1.5"
                >
                  <Save className="w-4 h-4" />
                  {isSavingEdit ? 'Saving...' : 'Save Corrections'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
