import React, { useState } from 'react';
import { DedicationRecord } from '../types';
import { ZONES } from '../data/zones';
import { useAuth } from '../context/AuthContext';
import { 
  Users, CheckCircle2, Clock, Search, Filter, Phone, Mail, 
  MapPin, Shield, Check, MessageSquare, AlertCircle, Calendar, Lock, AlertTriangle
} from 'lucide-react';

interface LeadershipPortalProps {
  dedications: DedicationRecord[];
  onUpdateDedication: (id: string, updates: Partial<DedicationRecord>) => Promise<void>;
}

export function LeadershipPortal({ dedications, onUpdateDedication }: LeadershipPortalProps) {
  const { user, isAdmin } = useAuth();

  const isFellowshipLeader = user?.role === 'fellowship_leader';
  const leaderAssignedZone = user?.assignedZone || 'Zone A';

  // Zone A leader can only see Zone A, Zone B only Zone B, etc.
  const [selectedZone, setSelectedZone] = useState<string>('All');
  const [search, setSearch] = useState('');
  const [filterMode, setFilterMode] = useState<'pending' | 'confirmed' | 'all'>('pending');
  const [notesInput, setNotesInput] = useState<{ [id: string]: string }>({});
  const [confirmingId, setConfirmingId] = useState<string | null>(null);

  // Effective Zone: if user is a fellowship zone leader, STRICTLY lock to their assigned zone!
  const effectiveZone = isFellowshipLeader ? leaderAssignedZone : selectedZone;

  // Filter records strictly by zone for fellowship leaders
  const filtered = dedications.filter((d) => {
    // 1. Zone strict privacy check
    const matchesZone = effectiveZone === 'All' || d.selectedZone === effectiveZone;
    if (!matchesZone) return false;

    // 2. Search check
    const matchesSearch =
      d.childName.toLowerCase().includes(search.toLowerCase()) ||
      d.id.toLowerCase().includes(search.toLowerCase()) ||
      d.fatherName.toLowerCase().includes(search.toLowerCase()) ||
      d.motherName.toLowerCase().includes(search.toLowerCase()) ||
      d.fatherPhone.includes(search) ||
      d.motherPhone.includes(search) ||
      d.selectedFellowship.toLowerCase().includes(search.toLowerCase());

    // 3. Status filter
    const matchesStatus =
      filterMode === 'pending'
        ? !d.leadershipConfirmed && (d.status === 'submitted' || d.status === 'fellowship_confirmed')
        : filterMode === 'confirmed'
        ? d.leadershipConfirmed
        : true;

    return matchesSearch && matchesStatus;
  });

  const handleConfirmForm = async (record: DedicationRecord, isOverride = false) => {
    setConfirmingId(record.id);
    const leaderTitle = isOverride
      ? `${user?.name || 'Office Admin'} (Office Override - Leader Delayed/Unavailable)`
      : user?.name || `${record.selectedZone} Leader`;

    const note = notesInput[record.id] || (isOverride
      ? 'Confirmed at fellowship level by Church Office due to leader delay/unavailability.'
      : `Verified and confirmed by ${record.selectedZone} fellowship leader.`);

    try {
      await onUpdateDedication(record.id, {
        leadershipConfirmed: true,
        fellowshipLeaderName: leaderTitle,
        fellowshipConfirmedAt: new Date().toISOString(),
        fellowshipNotes: note,
        status: record.officeApproved ? 'office_approved' : 'fellowship_confirmed'
      });
    } catch (e) {
      console.error('Error confirming form:', e);
      alert('Failed to confirm form. Please try again.');
    } finally {
      setConfirmingId(null);
    }
  };

  const handleRevokeConfirm = async (record: DedicationRecord) => {
    if (confirm(`Revoke fellowship confirmation for ${record.childName}?`)) {
      await onUpdateDedication(record.id, {
        leadershipConfirmed: false,
        status: 'submitted'
      });
    }
  };

  const zoneRecords = isFellowshipLeader
    ? dedications.filter(d => d.selectedZone === leaderAssignedZone)
    : dedications;

  const pendingCount = zoneRecords.filter(d => !d.leadershipConfirmed).length;
  const confirmedCount = zoneRecords.filter(d => d.leadershipConfirmed).length;

  return (
    <div className="space-y-6 pb-12">
      {/* Leadership Header */}
      <div className="bg-gradient-to-r from-[#2a170e] to-[#3d2314] text-white p-6 sm:p-8 rounded-3xl shadow-xl border-2 border-[#d4af37]/40 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-1.5 text-xs font-bold text-[#ffd700] uppercase tracking-wider bg-[#d4af37]/20 px-3 py-1 rounded-full border border-[#d4af37]/40 mb-2">
              <Shield className="w-3.5 h-3.5 text-[#d4af37]" /> Fellowship Leadership Portal
            </div>
            <h1 className="text-2xl sm:text-3xl font-cinzel font-bold text-white">
              {isFellowshipLeader ? `${leaderAssignedZone} Leader Endorsements` : 'Fellowship Leadership Oversight'}
            </h1>
            <p className="text-xs sm:text-sm text-[#f6efe2]/80 max-w-xl">
              {isFellowshipLeader
                ? `Strict Zone Isolation: You can only view and confirm forms for candidates registered in ${leaderAssignedZone}. Parents' data in other zones remains confidential.`
                : 'Church Administrators have full oversight across all zones (Zones A to E) and can confirm forms directly if a zone leader is delayed or unavailable.'}
            </p>
          </div>

          <div className="flex gap-2 text-xs">
            <div className="bg-amber-500/20 border border-amber-400/40 p-3 rounded-2xl text-center">
              <p className="text-[#ffd700] font-bold text-lg">{pendingCount}</p>
              <p className="text-[11px] text-amber-200">Pending in {isFellowshipLeader ? leaderAssignedZone : 'View'}</p>
            </div>
            <div className="bg-emerald-500/20 border border-emerald-400/40 p-3 rounded-2xl text-center">
              <p className="text-emerald-300 font-bold text-lg">{confirmedCount}</p>
              <p className="text-[11px] text-emerald-200">Confirmed</p>
            </div>
          </div>
        </div>

        {/* Zone Isolation Notice for Fellowship Leaders */}
        {isFellowshipLeader && (
          <div className="p-3.5 bg-black/40 border border-[#d4af37]/40 rounded-2xl flex items-center gap-2.5 text-xs text-[#f6efe2]">
            <Lock className="w-4 h-4 text-[#ffd700] shrink-0" />
            <span>
              <strong>Data Privacy Active:</strong> Logged in as <strong>{user?.name}</strong>. Access is strictly isolated to <strong>{leaderAssignedZone}</strong>. Once you confirm your zone's forms, your role is completed and the Church Office takes over compilation.
            </span>
          </div>
        )}
      </div>

      {/* Filter and Zone Selector Bar */}
      <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-xs space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 pb-3">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setFilterMode('pending')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                filterMode === 'pending'
                  ? 'bg-[#2a170e] text-[#ffd700] shadow-sm'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              Pending Confirmation ({pendingCount})
            </button>
            <button
              onClick={() => setFilterMode('confirmed')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                filterMode === 'confirmed'
                  ? 'bg-[#2a170e] text-[#ffd700] shadow-sm'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              Confirmed by Leaders ({confirmedCount})
            </button>
            <button
              onClick={() => setFilterMode('all')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                filterMode === 'all'
                  ? 'bg-[#2a170e] text-[#ffd700] shadow-sm'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              All Records ({zoneRecords.length})
            </button>
          </div>

          <span className="text-xs text-gray-500 font-medium">
            Active Role: <strong className="text-[#2a170e]">{user?.name}</strong> {isFellowshipLeader && `(${leaderAssignedZone})`}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="relative sm:col-span-2">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-3.5" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={`Search child, parent, phone in ${isFellowshipLeader ? leaderAssignedZone : 'all zones'}...`}
              className="w-full pl-9 pr-3 py-2.5 text-xs sm:text-sm border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#d4af37] outline-hidden"
            />
          </div>

          {/* Zone Selector: LOCKED for Fellowship Leader, DROPDOWN for Admin */}
          <div>
            {isFellowshipLeader ? (
              <div className="p-2.5 bg-[#fbf5e6] border-2 border-[#d4af37] rounded-xl text-xs font-bold text-[#2a170e] flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <Lock className="w-3.5 h-3.5 text-[#aa8222]" />
                  <span>Zone: <strong>{leaderAssignedZone} ONLY</strong></span>
                </span>
                <span className="text-[10px] bg-[#2a170e] text-[#ffd700] px-2 py-0.5 rounded-full font-mono">
                  Locked
                </span>
              </div>
            ) : (
              <div>
                <select
                  value={selectedZone}
                  onChange={(e) => setSelectedZone(e.target.value)}
                  className="w-full py-2.5 px-3 text-xs sm:text-sm border border-gray-300 rounded-xl bg-white focus:ring-2 focus:ring-[#d4af37] outline-hidden font-bold text-[#2a170e]"
                >
                  <option value="All">All Fellowship Zones (Admin View)</option>
                  {ZONES.map((z) => (
                    <option key={z.name} value={z.name}>{z.name}</option>
                  ))}
                  <option value="Unallocated">Unallocated (Follow-up Required)</option>
                </select>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Forms List for Leaders */}
      <div className="space-y-4">
        {filtered.length === 0 ? (
          <div className="bg-white p-12 rounded-3xl border border-gray-200 text-center space-y-3">
            <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto" />
            <h3 className="text-lg font-bold text-gray-800">
              No Forms Awaiting Confirmation for {isFellowshipLeader ? leaderAssignedZone : selectedZone}
            </h3>
            <p className="text-xs text-gray-500 max-w-sm mx-auto">
              All member forms in this zone have been reviewed, or no pending registrations match this search.
            </p>
          </div>
        ) : (
          filtered.map((item) => (
            <div
              key={item.id}
              className={`bg-white rounded-3xl p-6 sm:p-7 border-2 shadow-sm transition-all space-y-5 ${
                item.leadershipConfirmed
                  ? 'border-emerald-200 bg-emerald-50/20'
                  : 'border-amber-300/80 bg-amber-50/10 hover:border-[#d4af37]'
              }`}
            >
              {/* Header Row */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-gray-100 pb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-bold text-[#2a170e] bg-amber-100/60 px-2.5 py-0.5 rounded-md">
                      {item.id}
                    </span>
                    <span className="text-xs font-bold text-[#8a6a1c] bg-[#fbf5e6] px-2.5 py-0.5 rounded-full border border-[#d4af37]/30">
                      {item.selectedZone} • {item.selectedFellowship} Fellowship
                    </span>
                    <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full uppercase ${
                      item.leadershipConfirmed
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-amber-100 text-amber-800'
                    }`}>
                      {item.leadershipConfirmed ? 'Confirmed by Leader' : 'Pending Leader Review'}
                    </span>
                  </div>

                  <h3 className="text-xl sm:text-2xl font-cinzel font-bold text-gray-900 mt-2">
                    {item.childName}
                  </h3>
                  <p className="text-xs text-gray-500">
                    Born: <strong>{item.childDob}</strong> ({item.childGender}) • Place/County: <strong>{item.childCountyOfBirth || item.childPlaceOfBirth} County</strong>
                  </p>
                </div>

                <div className="text-right sm:self-center">
                  <span className="text-xs text-gray-400 block font-sans">Dedication Schedule:</span>
                  <span className="text-xs font-bold text-[#2a170e] bg-gray-100 px-3 py-1 rounded-lg inline-block mt-0.5">
                    {item.serviceDate || 'Scheduled by Pastoral Office'}
                  </span>
                </div>
              </div>

              {/* Parents' Details & Fellowship Contact */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-gray-50/80 p-4 rounded-2xl text-xs">
                <div className="space-y-1">
                  <p className="text-gray-400 font-bold uppercase tracking-wider">Father's Details</p>
                  <p className="font-bold text-gray-900">{item.fatherName || 'N/A'}</p>
                  <p className="text-gray-600 flex items-center gap-1">
                    <Phone className="w-3 h-3 text-[#d4af37]" />
                    {item.fatherPhone || 'No phone'}
                  </p>
                  {item.fatherEmail && (
                    <p className="text-gray-500 flex items-center gap-1 truncate">
                      <Mail className="w-3 h-3 text-gray-400" />
                      {item.fatherEmail}
                    </p>
                  )}
                </div>

                <div className="space-y-1">
                  <p className="text-gray-400 font-bold uppercase tracking-wider">Mother's Details</p>
                  <p className="font-bold text-gray-900">{item.motherName || 'N/A'}</p>
                  <p className="text-gray-600 flex items-center gap-1">
                    <Phone className="w-3 h-3 text-[#d4af37]" />
                    {item.motherPhone || 'No phone'}
                  </p>
                  {item.motherEmail && (
                    <p className="text-gray-500 flex items-center gap-1 truncate">
                      <Mail className="w-3 h-3 text-gray-400" />
                      {item.motherEmail}
                    </p>
                  )}
                </div>

                <div className="space-y-1">
                  <p className="text-gray-400 font-bold uppercase tracking-wider">Residential Location</p>
                  <p className="font-medium text-gray-800 flex items-start gap-1">
                    <MapPin className="w-3.5 h-3.5 text-[#d4af37] shrink-0 mt-0.5" />
                    {item.residentialLocation || 'Utawala Area'}
                  </p>
                  <p className="text-[11px] text-gray-500 mt-1">
                    Fellowship Allocated: <strong>{item.selectedFellowship}</strong> ({item.selectedZone})
                  </p>
                </div>
              </div>

              {/* Leader Note Input & Confirmation Actions */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-1">
                <div className="w-full sm:flex-1">
                  <input
                    type="text"
                    value={notesInput[item.id] ?? (item.fellowshipNotes || '')}
                    onChange={(e) => setNotesInput({ ...notesInput, [item.id]: e.target.value })}
                    placeholder={`Enter leader recommendation note for ${item.selectedFellowship}...`}
                    className="w-full text-xs p-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#d4af37] outline-hidden bg-white"
                  />
                </div>

                <div className="flex items-center gap-2 shrink-0 w-full sm:w-auto justify-end">
                  {item.leadershipConfirmed ? (
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-emerald-700 bg-emerald-100 px-3 py-2 rounded-xl flex items-center gap-1.5">
                        <CheckCircle2 className="w-4 h-4 text-emerald-700" />
                        Confirmed: {item.fellowshipLeaderName}
                      </span>
                      {isAdmin && (
                        <button
                          onClick={() => handleRevokeConfirm(item)}
                          className="text-xs text-red-600 hover:underline px-2 py-1"
                        >
                          Revoke
                        </button>
                      )}
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      {/* If user is Admin, they have the explicit override capability */}
                      {isAdmin && (
                        <button
                          disabled={confirmingId === item.id}
                          onClick={() => handleConfirmForm(item, true)}
                          title="Confirm on behalf of fellowship leader if they are delayed or unavailable"
                          className="bg-amber-600 hover:bg-amber-700 text-white px-3.5 py-2.5 rounded-xl text-xs font-bold shadow-xs transition-all flex items-center gap-1.5 cursor-pointer"
                        >
                          <AlertTriangle className="w-3.5 h-3.5 text-amber-200" />
                          Admin Override (Leader Delayed)
                        </button>
                      )}

                      <button
                        disabled={confirmingId === item.id}
                        onClick={() => handleConfirmForm(item, false)}
                        className="bg-[#2a170e] hover:bg-[#3d2314] text-[#ffd700] border-2 border-[#d4af37] px-5 py-2.5 rounded-xl text-xs font-bold shadow-md hover:shadow-lg transition-all flex items-center gap-2 cursor-pointer"
                      >
                        <Check className="w-4 h-4" />
                        {confirmingId === item.id
                          ? 'Confirming...'
                          : isFellowshipLeader
                          ? `Confirm ${item.childName} (${leaderAssignedZone})`
                          : 'Confirm Form for Office'}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
