import React, { useState, useEffect } from 'react';
import { DedicationRecord, UserProfile } from '../types';
import { ZONES, MONTHLY_DEDICATION_DATES } from '../data/zones';
import { useAuth } from '../context/AuthContext';
import { 
  Building2, CheckCircle2, Clock, Search, Filter, Shield, Award, 
  Printer, Check, AlertTriangle, FileCheck, Phone, ChevronRight,
  Edit3, Users, UserCheck, X, Save, RefreshCw, KeyRound, Mail, Calendar, MapPin
} from 'lucide-react';

interface OfficeCompileProps {
  dedications: DedicationRecord[];
  onUpdateDedication: (id: string, updates: Partial<DedicationRecord>) => Promise<void>;
  onOpenCertificate: (record: DedicationRecord) => void;
}

export function OfficeCompile({ dedications, onUpdateDedication, onOpenCertificate }: OfficeCompileProps) {
  const { user } = useAuth();

  const [selectedZone, setSelectedZone] = useState('All');
  const [selectedMonth, setSelectedMonth] = useState('All');
  const [search, setSearch] = useState('');
  const [activeSubTab, setActiveSubTab] = useState<'leader_approved' | 'awaiting_leader' | 'office_compiled' | 'users_directory'>('leader_approved');

  // Leadership accounts state
  const [usersList, setUsersList] = useState<UserProfile[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [usersSearch, setUsersSearch] = useState('');

  // Edit record state
  const [editingRecord, setEditingRecord] = useState<DedicationRecord | null>(null);
  const [editFormData, setEditFormData] = useState<Partial<DedicationRecord>>({});
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [editSuccessMsg, setEditSuccessMsg] = useState('');

  // Fetch users when component mounts or tab is users_directory
  const fetchUsers = async () => {
    setLoadingUsers(true);
    try {
      const res = await fetch('/api/users');
      if (res.ok) {
        const data = await res.json();
        setUsersList(data);
      }
    } catch (e) {
      console.error('Failed to load users directory:', e);
    } finally {
      setLoadingUsers(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

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
        leadershipConfirmed: true, // Auto-confirms fellowship clearance if admin compiles directly
        fellowshipLeaderName: record.fellowshipLeaderName || `${user?.name || 'Church Office'} (Pastoral Clearance)`,
        officeApproved: true,
        officeAdminName: user?.name || 'Church Office',
        officeConfirmedAt: new Date().toISOString(),
        certificateNumber: certNum,
        status: 'compiled'
      });
    } catch (e) {
      console.error('Office approval failed:', e);
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
  const handleUpdateUserRole = async (userId: string, newRole: any, newZone?: any) => {
    try {
      const res = await fetch(`/api/users/${userId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: newRole, assignedZone: newZone })
      });
      if (res.ok) {
        fetchUsers();
      }
    } catch (err) {
      console.error('Update user failed:', err);
    }
  };

  const filteredUsers = usersList.filter(u => 
    u.name.toLowerCase().includes(usersSearch.toLowerCase()) ||
    u.email.toLowerCase().includes(usersSearch.toLowerCase()) ||
    (u.assignedZone && u.assignedZone.toLowerCase().includes(usersSearch.toLowerCase())) ||
    u.role.toLowerCase().includes(usersSearch.toLowerCase())
  );

  return (
    <div className="space-y-6 pb-12">
      {/* Office Header */}
      <div className="bg-gradient-to-r from-[#2a170e] via-[#331c11] to-[#221107] text-white p-6 sm:p-8 rounded-3xl shadow-xl border-2 border-[#d4af37]/40 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-1.5 text-xs font-bold text-[#ffd700] uppercase tracking-wider bg-[#d4af37]/20 px-3 py-1 rounded-full border border-[#d4af37]/40 mb-2">
              <Building2 className="w-3.5 h-3.5 text-[#d4af37]" /> Church Office & Pastoral Administration
            </div>
            <h1 className="text-2xl sm:text-3xl font-cinzel font-bold text-white">
              Office Compile, Verification & Leadership Oversight
            </h1>
            <p className="text-xs sm:text-sm text-[#f6efe2]/80 max-w-2xl">
              Church Office and Pastors oversee all 5 fellowship zones (Zones A to E), verify fellowship leader endorsements, correct any parent mistakes, override delayed approvals, and track all leaders who log on or register accounts.
            </p>
          </div>

          <div className="flex flex-wrap gap-2 text-xs">
            <button
              onClick={() => window.print()}
              className="bg-[#d4af37] hover:bg-[#e6c154] text-[#2a170e] px-4 py-2.5 rounded-xl font-bold flex items-center gap-1.5 shadow-md transition-all cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              Print Office Altar List
            </button>
          </div>
        </div>

        {/* 4 Status Counters & Tabs */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
          <button
            onClick={() => setActiveSubTab('leader_approved')}
            className={`p-3 rounded-2xl border text-left transition-all cursor-pointer ${
              activeSubTab === 'leader_approved'
                ? 'bg-[#d4af37]/30 border-[#ffd700] text-white shadow-md'
                : 'bg-black/20 border-white/10 text-gray-300 hover:bg-black/30'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase text-[#ffd700]">Leader Approved</span>
              <FileCheck className="w-4 h-4 text-[#ffd700]" />
            </div>
            <p className="text-2xl font-cinzel font-bold text-white mt-1">{leaderApprovedRecords.length}</p>
            <p className="text-[10px] text-gray-300">Ready for Office Compile</p>
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
            <p className="text-[10px] text-gray-300">Pending or Admin Override</p>
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
              <span className="text-[11px] font-bold uppercase text-blue-300">Leaders & Staff</span>
              <Users className="w-4 h-4 text-blue-300" />
            </div>
            <p className="text-2xl font-cinzel font-bold text-white mt-1">{usersList.length}</p>
            <p className="text-[10px] text-gray-300">Accounts & Login Tracker</p>
          </button>
        </div>
      </div>

      {/* Sub-Tab 1, 2, 3: Dedication Records Lists */}
      {activeSubTab !== 'users_directory' ? (
        <>
          {/* Filter and Search Bar */}
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
                    <option key={m.date} value={m.date}>{m.label}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex items-center justify-between text-xs text-gray-500 pt-1">
              <span>
                Displaying <strong>{currentList.length}</strong> records in current queue
              </span>
              <span className="text-[#2a170e] font-semibold">
                {activeSubTab === 'leader_approved'
                  ? 'Fellowship leaders have verified these candidates.'
                  : activeSubTab === 'office_compiled'
                  ? 'Officially compiled for the pastoral team.'
                  : 'Awaiting fellowship leader. Admin / Pastor can override & confirm below if delayed.'}
              </span>
            </div>
          </div>

          {/* Main Records Display */}
          <div className="bg-white rounded-3xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs sm:text-sm">
                <thead className="bg-[#2a170e] text-[#ffd700] font-cinzel text-xs tracking-wider border-b-2 border-[#d4af37]/40">
                  <tr>
                    <th className="py-3.5 px-4">Ref ID</th>
                    <th className="py-3.5 px-4">Child Full Name</th>
                    <th className="py-3.5 px-4">County / DOB</th>
                    <th className="py-3.5 px-4">Parents & Phone</th>
                    <th className="py-3.5 px-4">Fellowship & Zone</th>
                    <th className="py-3.5 px-4">Fellowship Leader Endorsement</th>
                    <th className="py-3.5 px-4">Dedication Date</th>
                    <th className="py-3.5 px-4 text-right">Office / Pastor Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {currentList.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-12 text-center text-gray-500">
                        No records found in this queue matching criteria.
                      </td>
                    </tr>
                  ) : (
                    currentList.map((item) => (
                      <tr key={item.id} className="hover:bg-[#fcfaf6] transition-colors">
                        <td className="py-3.5 px-4 font-mono font-bold text-[#2a170e] whitespace-nowrap">
                          {item.id}
                        </td>

                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <p className="font-bold text-gray-900">{item.childName}</p>
                          <span className="text-[11px] text-gray-500">{item.childGender}</span>
                        </td>

                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <p className="font-semibold text-gray-800">{item.childCountyOfBirth || item.childPlaceOfBirth} County</p>
                          <p className="text-[11px] text-gray-500">{item.childDob}</p>
                        </td>

                        <td className="py-3.5 px-4">
                          <p className="font-medium text-gray-900">
                            {item.fatherName || item.motherName || item.parentName}
                          </p>
                          <p className="text-[11px] text-gray-500 flex items-center gap-1">
                            <Phone className="w-2.5 h-2.5 text-[#d4af37]" />
                            {item.fatherPhone || item.motherPhone}
                          </p>
                        </td>

                        <td className="py-3.5 px-4">
                          <span className="font-bold text-[#2a170e]">{item.selectedFellowship}</span>
                          <span className="block text-[11px] text-gray-500 font-semibold text-amber-900">{item.selectedZone}</span>
                        </td>

                        {/* Fellowship Leader status & endorsement info */}
                        <td className="py-3.5 px-4">
                          {item.leadershipConfirmed ? (
                            <div className="space-y-1">
                              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-full">
                                <CheckCircle2 className="w-3 h-3 text-emerald-700" />
                                Endorsed
                              </span>
                              <p className="text-[10px] text-gray-600 font-medium">
                                By: {item.fellowshipLeaderName || 'Zone Leader'}
                              </p>
                              {item.fellowshipConfirmedAt && (
                                <p className="text-[9px] text-gray-400">
                                  {new Date(item.fellowshipConfirmedAt).toLocaleDateString()}
                                </p>
                              )}
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
                                title="Approve from fellowship level on behalf of unavailable zone leader"
                                className="block text-[10px] bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 px-2 py-1 rounded-md font-bold transition-all cursor-pointer whitespace-nowrap shadow-2xs"
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
                            title="Set Dedication Sunday Date (Determined by Pastor & Office)"
                            className="text-xs p-1.5 border border-amber-300 rounded-lg bg-white font-bold text-[#2a170e] focus:ring-2 focus:ring-[#d4af37] outline-hidden cursor-pointer"
                          >
                            <option value="To be scheduled by Pastoral Office">To be scheduled by Pastoral Office</option>
                            {MONTHLY_DEDICATION_DATES.map((m) => (
                              <option key={m.date} value={m.date}>
                                {m.label} ({m.cycle})
                              </option>
                            ))}
                          </select>
                          {item.certificateNumber && (
                            <span className="block font-mono text-[10px] text-[#aa8222] mt-0.5">{item.certificateNumber}</span>
                          )}
                        </td>

                        {/* Office Action & Edit mistake button */}
                        <td className="py-3.5 px-4 text-right whitespace-nowrap">
                          <div className="flex items-center justify-end gap-1.5">
                            {/* Edit / Correct Mistake Button */}
                            <button
                              onClick={() => handleOpenEditModal(item)}
                              title="Correct spelling, parents, phone numbers, or dates"
                              className="p-1.5 text-gray-500 hover:text-[#2a170e] hover:bg-amber-50 border border-gray-200 rounded-lg text-xs font-medium transition-colors cursor-pointer flex items-center gap-1"
                            >
                              <Edit3 className="w-3.5 h-3.5 text-[#d4af37]" />
                              <span className="hidden lg:inline text-[11px]">Edit / Correct</span>
                            </button>

                            {item.officeApproved ? (
                              <>
                                <button
                                  onClick={() => onOpenCertificate(item)}
                                  title="Print / View Certificate"
                                  className="bg-[#fbf5e6] hover:bg-[#f3e7c8] text-[#8a6a1c] border border-[#d4af37]/40 px-2.5 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer"
                                >
                                  Certificate
                                </button>
                                {item.status !== 'completed' ? (
                                  <button
                                    onClick={() => handleMarkCompleted(item)}
                                    className="bg-emerald-700 hover:bg-emerald-800 text-white px-2.5 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer"
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
                                className="bg-[#2a170e] hover:bg-[#3d2314] text-[#ffd700] border border-[#d4af37] px-3 py-1.5 rounded-xl text-xs font-bold shadow-xs transition-all flex items-center gap-1.5 cursor-pointer"
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
      ) : (
        /* Sub-Tab 4: Leaders & Staff Accounts Directory */
        <div className="space-y-4">
          <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="space-y-1">
              <h3 className="text-base font-cinzel font-bold text-[#2a170e] flex items-center gap-2">
                <Users className="w-5 h-5 text-[#d4af37]" />
                Registered Leaders & Staff Account Directory
              </h3>
              <p className="text-xs text-gray-600">
                Shows all fellowship leaders and church staff who logged on with Google or created accounts, their assigned fellowship zones, and last login time.
              </p>
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <div className="relative flex-1 sm:w-64">
                <Search className="w-4 h-4 text-gray-400 absolute left-3 top-3" />
                <input
                  type="text"
                  value={usersSearch}
                  onChange={(e) => setUsersSearch(e.target.value)}
                  placeholder="Search leader by name, email, zone..."
                  className="w-full pl-9 pr-3 py-2 text-xs border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#d4af37] outline-hidden"
                />
              </div>

              <button
                type="button"
                onClick={fetchUsers}
                className="p-2 border border-gray-200 rounded-xl hover:bg-gray-50 text-gray-600 cursor-pointer"
                title="Refresh Directory"
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
                    <th className="py-3.5 px-4">Leader / Staff Member</th>
                    <th className="py-3.5 px-4">Email Address</th>
                    <th className="py-3.5 px-4">Leadership Tier & Role</th>
                    <th className="py-3.5 px-4">Assigned Fellowship Zone</th>
                    <th className="py-3.5 px-4">Login Method</th>
                    <th className="py-3.5 px-4">Last Logged On</th>
                    <th className="py-3.5 px-4 text-right">Role Management</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {loadingUsers ? (
                    <tr>
                      <td colSpan={7} className="py-10 text-center text-gray-500">
                        Loading registered leadership directory...
                      </td>
                    </tr>
                  ) : filteredUsers.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-10 text-center text-gray-500">
                        No leadership accounts found.
                      </td>
                    </tr>
                  ) : (
                    filteredUsers.map((u) => (
                      <tr key={u.id} className="hover:bg-amber-50/20 transition-colors">
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-2.5">
                            <img
                              src={u.avatar || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(u.name)}`}
                              alt={u.name}
                              className="w-8 h-8 rounded-full border border-[#d4af37]/40 object-cover bg-amber-50"
                            />
                            <div>
                              <p className="font-bold text-gray-900">{u.name}</p>
                              <span className="text-[10px] text-gray-400">ID: {u.id}</span>
                            </div>
                          </div>
                        </td>

                        <td className="py-3.5 px-4 font-mono text-xs text-gray-700">
                          {u.email}
                        </td>

                        <td className="py-3.5 px-4">
                          {u.role === 'admin' ? (
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-900 bg-amber-100 px-2 py-0.5 rounded-full border border-amber-300">
                              <Shield className="w-3 h-3 text-[#aa8222]" />
                              Church Admin / Pastor
                            </span>
                          ) : u.role === 'fellowship_leader' ? (
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-900 bg-emerald-100 px-2 py-0.5 rounded-full border border-emerald-300">
                              <UserCheck className="w-3 h-3 text-emerald-700" />
                              Fellowship Zone Leader
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-gray-800 bg-gray-100 px-2 py-0.5 rounded-full">
                              Parent / Member
                            </span>
                          )}
                        </td>

                        <td className="py-3.5 px-4">
                          {u.role === 'admin' ? (
                            <span className="text-xs font-semibold text-gray-500 italic">
                              All Zones (A to E)
                            </span>
                          ) : (
                            <span className="text-xs font-bold text-[#2a170e] bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-md">
                              {u.assignedZone || 'Not Allocated'}
                            </span>
                          )}
                        </td>

                        <td className="py-3.5 px-4">
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-gray-700 bg-gray-100 px-2 py-0.5 rounded-md">
                            {u.authProvider === 'google' ? '🌐 Google Sign-In' : '✉️ Email & Pass'}
                          </span>
                        </td>

                        <td className="py-3.5 px-4 text-xs text-gray-600">
                          {u.lastLoginAt ? (
                            <div>
                              <p className="font-medium text-gray-900">
                                {new Date(u.lastLoginAt).toLocaleDateString()}
                              </p>
                              <span className="text-[10px] text-gray-400">
                                {new Date(u.lastLoginAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            </div>
                          ) : (
                            <span className="text-[10px] text-gray-400">Never logged in</span>
                          )}
                        </td>

                        <td className="py-3.5 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {u.role === 'fellowship_leader' ? (
                              <button
                                onClick={() => handleUpdateUserRole(u.id, 'admin')}
                                title="Promote to Church Office Admin"
                                className="text-[10px] bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 px-2 py-1 rounded-md font-bold cursor-pointer"
                              >
                                Promote to Admin
                              </button>
                            ) : u.role === 'admin' && u.email !== 'fawany@gmail.com' ? (
                              <button
                                onClick={() => handleUpdateUserRole(u.id, 'fellowship_leader', 'Zone A')}
                                title="Change to Zone Leader"
                                className="text-[10px] bg-gray-50 hover:bg-gray-100 text-gray-700 border border-gray-300 px-2 py-1 rounded-md font-medium cursor-pointer"
                              >
                                Set to Zone Leader
                              </button>
                            ) : (
                              <span className="text-[10px] font-bold text-amber-800">Primary Admin</span>
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
        </div>
      )}

      {/* Edit / Correct Mistakes Modal for Admin & Pastor */}
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
              {/* Child Details */}
              <div className="bg-amber-50/40 p-4 rounded-2xl border border-amber-200/60 space-y-3">
                <h4 className="text-xs font-bold text-[#2a170e] uppercase tracking-wider">
                  Child's Information
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Child Full Name</label>
                    <input
                      type="text"
                      required
                      value={editFormData.childName || ''}
                      onChange={(e) => setEditFormData({ ...editFormData, childName: e.target.value })}
                      className="w-full p-2 text-xs border border-gray-300 rounded-xl bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Date of Birth</label>
                    <input
                      type="date"
                      required
                      value={editFormData.childDob || ''}
                      onChange={(e) => setEditFormData({ ...editFormData, childDob: e.target.value })}
                      className="w-full p-2 text-xs border border-gray-300 rounded-xl bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Gender</label>
                    <select
                      value={editFormData.childGender || 'Male'}
                      onChange={(e) => setEditFormData({ ...editFormData, childGender: e.target.value as any })}
                      className="w-full p-2 text-xs border border-gray-300 rounded-xl bg-white"
                    >
                      <option value="Male">Male</option>
                      <option value="Female">Female</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">County of Birth</label>
                    <input
                      type="text"
                      value={editFormData.childCountyOfBirth || ''}
                      onChange={(e) => setEditFormData({ ...editFormData, childCountyOfBirth: e.target.value, childPlaceOfBirth: e.target.value })}
                      className="w-full p-2 text-xs border border-gray-300 rounded-xl bg-white"
                      placeholder="e.g. Nairobi, Machakos, Kiambu"
                    />
                  </div>
                </div>
              </div>

              {/* Parents Details */}
              <div className="bg-gray-50 p-4 rounded-2xl border border-gray-200 space-y-3">
                <h4 className="text-xs font-bold text-[#2a170e] uppercase tracking-wider">
                  Parents & Contacts
                </h4>
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

              {/* Zone and Dedication Schedule */}
              <div className="bg-gray-50 p-4 rounded-2xl border border-gray-200 space-y-3">
                <h4 className="text-xs font-bold text-[#2a170e] uppercase tracking-wider">
                  Fellowship & Schedule
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Fellowship Zone</label>
                    <select
                      value={editFormData.selectedZone || 'Zone A'}
                      onChange={(e) => setEditFormData({ ...editFormData, selectedZone: e.target.value as any })}
                      className="w-full p-2 text-xs border border-gray-300 rounded-xl bg-white font-medium"
                    >
                      {ZONES.map(z => (
                        <option key={z.name} value={z.name}>{z.name}</option>
                      ))}
                      <option value="Unallocated">Unallocated</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Fellowship Name</label>
                    <input
                      type="text"
                      value={editFormData.selectedFellowship || ''}
                      onChange={(e) => setEditFormData({ ...editFormData, selectedFellowship: e.target.value })}
                      className="w-full p-2 text-xs border border-gray-300 rounded-xl bg-white"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block text-xs font-medium text-gray-700 mb-1">Dedication Sunday Date</label>
                    <select
                      value={editFormData.serviceDate || 'To be scheduled by Pastoral Office'}
                      onChange={(e) => setEditFormData({ ...editFormData, serviceDate: e.target.value })}
                      className="w-full p-2 text-xs border border-amber-300 rounded-xl bg-white font-bold text-[#2a170e]"
                    >
                      <option value="To be scheduled by Pastoral Office">To be scheduled by Pastoral Office</option>
                      {MONTHLY_DEDICATION_DATES.map((m) => (
                        <option key={m.date} value={m.date}>
                          {m.label} ({m.cycle})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingRecord(null)}
                  className="px-4 py-2 border border-gray-300 rounded-xl text-xs font-medium text-gray-700 hover:bg-gray-100 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingEdit}
                  className="px-5 py-2.5 bg-[#2a170e] hover:bg-[#3d2314] text-[#ffd700] border-2 border-[#d4af37] font-bold rounded-xl text-xs shadow-md transition-all flex items-center gap-1.5 cursor-pointer"
                >
                  <Save className="w-4 h-4" />
                  {isSavingEdit ? 'Saving Changes...' : 'Save & Correct Form'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
