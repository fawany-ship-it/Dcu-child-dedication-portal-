import React, { useState } from 'react';
import { Search, Baby, CheckCircle, Clock, Calendar, Church, Shield, Printer, AlertCircle, Phone, MapPin, UserCheck, Building2, Award } from 'lucide-react';
import { DedicationRecord, DedicationStatus } from '../types';

interface StatusTrackerProps {
  dedications: DedicationRecord[];
  initialSearchQuery?: string;
  onOpenCertificate?: (record: DedicationRecord) => void;
}

const STAGES = [
  { key: 'submitted', label: '1. Form Submitted', desc: 'Received in church database' },
  { key: 'fellowship_confirmed', label: '2. Fellowship Leader Confirmed', desc: 'Reviewed by Home Fellowship Leader' },
  { key: 'office_approved', label: '3. Church Office Approved', desc: 'Verified & compiled for Dedication Sunday' },
  { key: 'completed', label: '4. Dedicated & Certified', desc: 'Altar blessing & Certificate issued' }
];

export function StatusTracker({ dedications, initialSearchQuery = '', onOpenCertificate }: StatusTrackerProps) {
  const [query, setQuery] = useState(initialSearchQuery);
  const [searched, setSearched] = useState(Boolean(initialSearchQuery));

  const filtered = query.trim()
    ? dedications.filter((d) => {
        const q = query.toLowerCase().trim();
        const cleanPhone = q.replace(/\s+/g, '');
        return (
          d.childName.toLowerCase().includes(q) ||
          d.fatherName.toLowerCase().includes(q) ||
          d.motherName.toLowerCase().includes(q) ||
          (d.parentName && d.parentName.toLowerCase().includes(q)) ||
          d.fatherPhone.replace(/\s+/g, '').includes(cleanPhone) ||
          d.motherPhone.replace(/\s+/g, '').includes(cleanPhone) ||
          d.id.toLowerCase().includes(q)
        );
      })
    : [];

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setSearched(true);
  };

  const getStageIndex = (record: DedicationRecord) => {
    if (record.status === 'completed') return 3;
    if (record.officeApproved || record.status === 'compiled') return 2;
    if (record.leadershipConfirmed || record.status === 'fellowship_confirmed') return 1;
    return 0;
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-12">
      {/* Search Bar Card */}
      <div className="bg-white p-8 rounded-3xl shadow-xl border-2 border-[#d4af37]/40 text-center space-y-4">
        <div className="inline-flex items-center justify-center p-3 rounded-2xl bg-[#fbf5e6] text-[#2a170e] border border-[#d4af37]/40">
          <Search className="w-6 h-6 text-[#aa8222]" />
        </div>

        <h1 className="text-2xl sm:text-3xl font-cinzel font-bold text-[#2a170e]">
          Track Dedication Status
        </h1>

        <p className="text-sm text-gray-600 max-w-lg mx-auto">
          Please enter the <strong>Child's Name</strong>, <strong>Parent's Name</strong>, or <strong>Phone Number</strong> to check your application's review progress.
        </p>

        {/* 24 Hour Verification Notice */}
        <div className="p-3.5 rounded-2xl bg-[#fbf5e6] border border-[#d4af37]/40 max-w-xl mx-auto text-xs text-[#5d430d] flex items-center justify-center gap-2">
          <Clock className="w-4 h-4 text-[#aa8222] shrink-0" />
          <span>
            <strong>Note:</strong> Forms are reviewed by fellowship leaders and church administration. Status updates within 24 hours of submission.
          </span>
        </div>

        <form onSubmit={handleSearch} className="max-w-xl mx-auto flex gap-2 pt-2">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Enter Child Name, Phone Number, or Parent Name..."
            className="flex-1 p-3.5 text-sm border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#d4af37] focus:border-[#d4af37] outline-hidden shadow-xs"
          />
          <button
            type="submit"
            className="bg-[#2a170e] hover:bg-[#3d2314] text-[#ffd700] border border-[#d4af37] font-bold px-6 py-3.5 rounded-xl shadow-md transition-all flex items-center gap-2 text-sm shrink-0 cursor-pointer"
          >
            <Search className="w-4 h-4" />
            Check Status
          </button>
        </form>

        {/* Quick sample pills */}
        <div className="pt-2 flex flex-wrap items-center justify-center gap-2 text-xs text-gray-500">
          <span>Search hints:</span>
          {dedications.slice(0, 3).map((d) => (
            <button
              key={d.id}
              onClick={() => {
                setQuery(d.childName);
                setSearched(true);
              }}
              className="bg-gray-100 hover:bg-gray-200 text-gray-800 px-2.5 py-1 rounded-full text-[11px] font-medium transition-colors cursor-pointer"
            >
              {d.childName}
            </button>
          ))}
        </div>
      </div>

      {/* Results Section */}
      {searched && (
        <div className="space-y-6">
          {filtered.length === 0 ? (
            <div className="bg-white p-10 rounded-3xl border border-gray-200 text-center space-y-3">
              <AlertCircle className="w-10 h-10 text-amber-500 mx-auto" />
              <h3 className="text-lg font-bold text-gray-800">No Matching Record Found</h3>
              <p className="text-sm text-gray-500 max-w-md mx-auto">
                We could not find an application for "<strong>{query}</strong>". Please ensure the Child's Name, Parent's Name, or Phone Number is spelled correctly.
              </p>
            </div>
          ) : (
            filtered.map((item) => {
              const currentStageIdx = getStageIndex(item);

              return (
                <div
                  key={item.id}
                  className="bg-white rounded-3xl shadow-lg border-2 border-[#d4af37]/40 p-6 sm:p-8 space-y-6 transition-all"
                >
                  {/* Top card bar */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-100 pb-5">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono font-bold bg-[#fbf5e6] text-[#2a170e] px-2.5 py-1 rounded-md border border-[#d4af37]/30">
                          {item.id}
                        </span>
                        <span className="text-xs font-bold px-2.5 py-1 rounded-full uppercase bg-[#fbf5e6] text-[#aa8222] border border-[#d4af37]/30">
                          {item.selectedZone} • {item.selectedFellowship}
                        </span>
                      </div>
                      <h2 className="text-2xl font-cinzel font-bold text-gray-900 mt-2">
                        {item.childName}
                      </h2>
                      <p className="text-xs text-gray-500">
                        Born {item.childDob} ({item.childGender}) • {item.childCountyOfBirth || item.childPlaceOfBirth} County
                      </p>
                    </div>

                    <div className="flex flex-wrap gap-2 items-center">
                      <button
                        onClick={() => window.print()}
                        className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                      >
                        <Printer className="w-3.5 h-3.5" /> Print Voucher
                      </button>

                      {onOpenCertificate && item.status === 'completed' && (
                        <button
                          onClick={() => onOpenCertificate(item)}
                          className="bg-[#2a170e] hover:bg-[#3d2314] text-[#ffd700] border border-[#d4af37] px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
                        >
                          <Award className="w-3.5 h-3.5 text-[#ffd700]" /> View Certificate
                        </button>
                      )}
                    </div>
                  </div>

                  {/* 4-Stage Progress Timeline */}
                  <div className="space-y-3">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-gray-500">
                      Dedication Review Stages
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                      {STAGES.map((stg, idx) => {
                        const isDone = idx <= currentStageIdx;
                        const isCurrent = idx === currentStageIdx;

                        return (
                          <div
                            key={stg.key}
                            className={`p-3.5 rounded-2xl border text-center transition-all ${
                              isCurrent
                                ? 'border-[#d4af37] bg-[#fbf5e6] text-[#2a170e] font-bold shadow-xs'
                                : isDone
                                ? 'border-emerald-200 bg-emerald-50 text-emerald-800 font-semibold'
                                : 'border-gray-200 bg-gray-50/60 text-gray-400'
                            }`}
                          >
                            <div className="flex justify-center mb-1">
                              {isDone ? (
                                <CheckCircle className={`w-5 h-5 ${isCurrent ? 'text-[#aa8222]' : 'text-emerald-600'}`} />
                              ) : (
                                <Clock className="w-5 h-5 text-gray-300" />
                              )}
                            </div>
                            <p className="text-xs font-bold leading-tight">{stg.label}</p>
                            <p className="text-[10px] text-gray-500 mt-1 leading-snug">{stg.desc}</p>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Key Info Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-[#fcfaf6] p-5 rounded-2xl text-xs border border-gray-200/80">
                    <div className="space-y-1">
                      <p className="text-gray-400 font-bold uppercase">Parents</p>
                      <p className="text-gray-900 font-semibold">{item.fatherName || item.motherName || item.parentName}</p>
                      <p className="text-gray-600 flex items-center gap-1">
                        <Phone className="w-3 h-3 text-[#d4af37]" />
                        {item.fatherPhone || item.motherPhone}
                      </p>
                    </div>

                    <div className="space-y-1">
                      <p className="text-gray-400 font-bold uppercase">Dedication Sunday</p>
                      <p className="text-gray-900 font-semibold flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5 text-[#2a170e]" />
                        {item.serviceDate || 'Upcoming Dedication Sunday'}
                      </p>
                      <p className="text-gray-500 text-[11px]">Quarterly Service (Period of 3 Months)</p>
                    </div>

                    <div className="space-y-1">
                      <p className="text-gray-400 font-bold uppercase">Fellowship Zone</p>
                      <p className="text-gray-900 font-semibold">{item.selectedFellowship} Fellowship</p>
                      <p className="text-[#8a6a1c] font-bold flex items-center gap-1">
                        <MapPin className="w-3 h-3 text-[#d4af37]" />
                        {item.selectedZone}
                      </p>
                    </div>
                  </div>

                  {/* Leader and Office Status Tags */}
                  <div className="flex flex-wrap gap-3 pt-1 text-xs">
                    <div className="flex items-center gap-1.5 p-2 bg-gray-50 rounded-xl border border-gray-200">
                      <UserCheck className="w-4 h-4 text-[#aa8222]" />
                      <span>
                        Fellowship Leader:{' '}
                        <strong>
                          {item.leadershipConfirmed ? (item.fellowshipLeaderName || 'Confirmed') : 'Under Review'}
                        </strong>
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5 p-2 bg-gray-50 rounded-xl border border-gray-200">
                      <Building2 className="w-4 h-4 text-[#aa8222]" />
                      <span>
                        Church Office:{' '}
                        <strong>
                          {item.officeApproved ? (item.officeAdminName || 'Approved & Compiled') : 'Pending Fellowship Check'}
                        </strong>
                      </span>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
