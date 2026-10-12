import React, { useState } from 'react';
import { DedicationRecord } from '../types';
import { ZONES, MONTHLY_DEDICATION_DATES } from '../data/zones';
import { useAuth } from '../context/AuthContext';
import { 
  Building2, CheckCircle2, Clock, Search, Filter, Shield, Award, 
  Printer, Check, AlertTriangle, FileCheck, Phone, ChevronRight
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
  const [activeSubTab, setActiveSubTab] = useState<'leader_approved' | 'awaiting_leader' | 'office_compiled'>('leader_approved');

  // Categorize records
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
        fellowshipLeaderName: `${user?.name || 'Church Office'} (Admin Override - Leader Delayed/Unavailable)`,
        fellowshipConfirmedAt: new Date().toISOString(),
        fellowshipNotes: 'Approved directly from fellowship level by Church Office due to leader unavailability.',
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

  return (
    <div className="space-y-6 pb-12">
      {/* Office Header */}
      <div className="bg-gradient-to-r from-[#2a170e] via-[#331c11] to-[#221107] text-white p-6 sm:p-8 rounded-3xl shadow-xl border-2 border-[#d4af37]/40 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-1.5 text-xs font-bold text-[#ffd700] uppercase tracking-wider bg-[#d4af37]/20 px-3 py-1 rounded-full border border-[#d4af37]/40 mb-2">
              <Building2 className="w-3.5 h-3.5 text-[#d4af37]" /> Church Office Administration
            </div>
            <h1 className="text-2xl sm:text-3xl font-cinzel font-bold text-white">
              Office Compile & Verification
            </h1>
            <p className="text-xs sm:text-sm text-[#f6efe2]/80 max-w-xl">
              Church Office verifies whether fellowship leaders approved each parent's form across all fellowship zones (Zones A to E) and compiles candidates for the Dedication Sunday (conducted in a period of 3 months).
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

        {/* 3 Status Counters */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
          <button
            onClick={() => setActiveSubTab('leader_approved')}
            className={`p-3.5 rounded-2xl border text-left transition-all cursor-pointer ${
              activeSubTab === 'leader_approved'
                ? 'bg-[#d4af37]/30 border-[#ffd700] text-white shadow-md'
                : 'bg-black/20 border-white/10 text-gray-300 hover:bg-black/30'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase text-[#ffd700]">Leader Approved</span>
              <FileCheck className="w-4 h-4 text-[#ffd700]" />
            </div>
            <p className="text-2xl font-cinzel font-bold text-white mt-1">{leaderApprovedRecords.length}</p>
            <p className="text-[11px] text-gray-300">Ready for Office Compile</p>
          </button>

          <button
            onClick={() => setActiveSubTab('office_compiled')}
            className={`p-3.5 rounded-2xl border text-left transition-all cursor-pointer ${
              activeSubTab === 'office_compiled'
                ? 'bg-emerald-500/30 border-emerald-400 text-white shadow-md'
                : 'bg-black/20 border-white/10 text-gray-300 hover:bg-black/30'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase text-emerald-300">Office Compiled</span>
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            </div>
            <p className="text-2xl font-cinzel font-bold text-white mt-1">{officeCompiledRecords.length}</p>
            <p className="text-[11px] text-gray-300">Approved for Altar Dedication</p>
          </button>

          <button
            onClick={() => setActiveSubTab('awaiting_leader')}
            className={`p-3.5 rounded-2xl border text-left transition-all cursor-pointer ${
              activeSubTab === 'awaiting_leader'
                ? 'bg-amber-500/30 border-amber-400 text-white shadow-md'
                : 'bg-black/20 border-white/10 text-gray-300 hover:bg-black/30'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase text-amber-300">Awaiting Leader</span>
              <AlertTriangle className="w-4 h-4 text-amber-400" />
            </div>
            <p className="text-2xl font-cinzel font-bold text-white mt-1">{awaitingLeaderRecords.length}</p>
            <p className="text-[11px] text-gray-300">Pending Fellowship Check</p>
          </button>
        </div>
      </div>

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
              : 'Still awaiting fellowship leader endorsement.'}
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
                <th className="py-3.5 px-4">Leader Endorsement</th>
                <th className="py-3.5 px-4">Dedication Date</th>
                <th className="py-3.5 px-4 text-right">Office Action</th>
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
                      <span className="block text-[11px] text-gray-500">{item.selectedZone}</span>
                    </td>

                    {/* Fellowship Leader status */}
                    <td className="py-3.5 px-4">
                      {item.leadershipConfirmed ? (
                        <div className="space-y-0.5">
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-full">
                            <CheckCircle2 className="w-3 h-3 text-emerald-700" />
                            Approved
                          </span>
                          <p className="text-[10px] text-gray-500 truncate max-w-[120px]">
                            {item.fellowshipLeaderName || 'Leader'}
                          </p>
                        </div>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-800 bg-amber-100 px-2 py-0.5 rounded-full">
                          <Clock className="w-3 h-3 text-amber-700" />
                          Pending Leader
                        </span>
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

                    {/* Office Action */}
                    <td className="py-3.5 px-4 text-right whitespace-nowrap">
                      {item.officeApproved ? (
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => onOpenCertificate(item)}
                            title="Print / View Certificate"
                            className="bg-[#fbf5e6] hover:bg-[#f3e7c8] text-[#8a6a1c] border border-[#d4af37]/40 px-2.5 py-1 rounded-lg text-xs font-bold transition-colors cursor-pointer"
                          >
                            Certificate
                          </button>
                          {item.status !== 'completed' ? (
                            <button
                              onClick={() => handleMarkCompleted(item)}
                              className="bg-emerald-700 hover:bg-emerald-800 text-white px-2.5 py-1 rounded-lg text-xs font-bold transition-colors cursor-pointer"
                            >
                              Mark Dedicated
                            </button>
                          ) : (
                            <span className="text-[11px] font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-md">
                              Completed
                            </span>
                          )}
                        </div>
                      ) : (
                        <button
                          onClick={() => handleOfficeApprove(item)}
                          className="bg-[#2a170e] hover:bg-[#3d2314] text-[#ffd700] border border-[#d4af37] px-3.5 py-1.5 rounded-xl text-xs font-bold shadow-xs transition-all flex items-center gap-1.5 ml-auto cursor-pointer"
                        >
                          <Check className="w-3.5 h-3.5" />
                          Office Confirm
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
  );
}
