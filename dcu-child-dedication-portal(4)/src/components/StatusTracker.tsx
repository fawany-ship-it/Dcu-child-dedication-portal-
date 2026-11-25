import React, { useState, useEffect } from 'react';
import { Search, Baby, CheckCircle, Clock, Printer, AlertCircle, Award, Users } from 'lucide-react';
import { DedicationRecord } from '../types';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { syncLocalSubmissionsToFirestore } from '../services/firestoreService';

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
  const { user } = useAuth();
  const [refId, setRefId] = useState(initialSearchQuery);
  const [verifyPhone, setVerifyPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [matchedRecords, setMatchedRecords] = useState<any[]>([]);
  const [trackedRecord, setTrackedRecord] = useState<any | null>(null);
  const [deviceSubmissions, setDeviceSubmissions] = useState<any[]>([]);

  const handleTrackItem = (id: string, phone?: string, preferredChildName?: string) => {
    setRefId(id);
    if (phone) setVerifyPhone(phone);
    setLoading(true);
    setError('');
    setMatchedRecords([]);
    setTrackedRecord(null);

    api.trackDedications(id, phone).then((matches) => {
      setMatchedRecords(matches);
      if (preferredChildName) {
        const exact = matches.find(
          (m) => String(m.childName || '').toLowerCase().trim() === preferredChildName.toLowerCase().trim()
        );
        setTrackedRecord(exact || matches[0] || null);
      } else {
        setTrackedRecord(matches[0] || null);
      }
    }).catch((err: any) => {
      setError(err?.message || 'Application not found.');
    }).finally(() => {
      setLoading(false);
    });
  };

  useEffect(() => {
    const loadDeviceList = () => {
      try {
        const stored = JSON.parse(localStorage.getItem('dcu_parent_recent_submissions') || '[]');
        if (Array.isArray(stored)) {
          setDeviceSubmissions(stored);
        }
      } catch {
        // localStorage restricted
      }
    };

    loadDeviceList();
    syncLocalSubmissionsToFirestore().then((uploaded) => {
      if (uploaded > 0) loadDeviceList();
    }).catch(() => {});
  }, []);

  useEffect(() => {
    if (initialSearchQuery) {
      setRefId(initialSearchQuery);
      handleTrackItem(initialSearchQuery);
    }
  }, [initialSearchQuery]);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setMatchedRecords([]);
    setTrackedRecord(null);

    const cleanId = refId.trim();
    if (!cleanId) {
      setError('Please provide your Dedication Reference ID, Child Name, or Phone Number.');
      return;
    }

    setLoading(true);
    try {
      const matches = await api.trackDedications(cleanId, verifyPhone.trim() || undefined);
      setMatchedRecords(matches);
      setTrackedRecord(matches[0] || null);
    } catch (err: any) {
      setError(err?.message || 'Application not found. Please verify the Reference ID, Child Name, or Phone Number.');
    } finally {
      setLoading(false);
    }
  };

  const getStageIndex = (record: any) => {
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

        <div className="inline-flex items-center gap-1.5 bg-emerald-50 text-emerald-800 border border-emerald-300 text-[11px] font-bold px-3 py-1 rounded-full mx-auto">
          <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
          <span>Parent Self-Service Tracker • No Login Required</span>
        </div>

        <p className="text-sm text-gray-600 max-w-lg mx-auto">
          Track your child's progress through fellowship confirmation and church office approval anytime. Search using your <strong>Dedication Reference ID</strong>, <strong>Child's Full Name</strong>, or registered <strong>Phone Number</strong> (shows all children registered together).
        </p>

        {/* 24 Hour Verification Notice */}
        <div className="p-3.5 rounded-2xl bg-[#fbf5e6] border border-[#d4af37]/40 max-w-xl mx-auto text-xs text-[#5d430d] flex items-center justify-center gap-2">
          <Clock className="w-4 h-4 text-[#aa8222] shrink-0" />
          <span>
            <strong>Review Timeline:</strong> Registrations are reviewed by fellowship leaders and compiled by the Church Office. Updates reflect within 24 hours.
          </span>
        </div>

        <form onSubmit={handleSearch} className="max-w-xl mx-auto space-y-3 pt-2">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <input
              type="text"
              required
              value={refId}
              onChange={(e) => setRefId(e.target.value)}
              placeholder="Ref ID, Child Name, or Phone"
              className="p-3 text-xs sm:text-sm border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#d4af37] outline-hidden shadow-xs font-medium"
            />
            <input
              type="tel"
              value={verifyPhone}
              onChange={(e) => setVerifyPhone(e.target.value)}
              placeholder="Parent Phone (Optional verification)"
              className="p-3 text-xs sm:text-sm border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#d4af37] outline-hidden shadow-xs"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[#2a170e] hover:bg-[#3d2314] text-[#ffd700] border border-[#d4af37] font-bold p-3 rounded-xl shadow-md transition-all flex items-center justify-center gap-2 text-sm cursor-pointer"
          >
            <Search className="w-4 h-4 text-[#ffd700]" />
            {loading ? 'Finding Record...' : 'Track Application Status'}
          </button>
        </form>

        {error && (
          <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700 flex items-center justify-center gap-2 max-w-xl mx-auto">
            <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
            <span>{error}</span>
          </div>
        )}
      </div>

      {/* Submitted Registrations Quick Selector (Available to all parents with or without login) */}
      {(deviceSubmissions.length > 0 || (user && dedications.length > 0)) && (
        <div className="bg-white p-6 rounded-3xl border-2 border-[#d4af37]/40 shadow-sm space-y-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <h3 className="text-xs sm:text-sm font-bold uppercase text-[#2a170e] tracking-wider flex items-center gap-2">
              <Baby className="w-4 h-4 text-[#d4af37]" />
              Your Submitted Registrations on this Device ({deviceSubmissions.length > 0 ? deviceSubmissions.length : dedications.length})
            </h3>
            <span className="text-[11px] font-semibold text-emerald-800 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-full">
              Parent Self-Service • No Login Required
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {(deviceSubmissions.length > 0 ? deviceSubmissions : dedications).map((d: any) => (
              <button
                key={`${d.id}::${d.childName || ''}`}
                onClick={() =>
                  handleTrackItem(
                    d.id,
                    d.phone || d.parentPhone || d.fatherPhone || d.motherPhone,
                    d.childName
                  )
                }
                className="p-3.5 rounded-2xl border border-amber-200 bg-amber-50/60 hover:bg-amber-100/70 text-left transition-all cursor-pointer flex items-center justify-between group shadow-xs"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[10px] font-bold text-amber-900 bg-amber-100 px-2 py-0.5 rounded-md">
                      {d.id}
                    </span>
                    {d.serviceDate && (
                      <span className="text-[10px] text-gray-500 font-sans">
                        Sunday: {d.serviceDate}
                      </span>
                    )}
                  </div>
                  <p className="font-bold text-gray-900 text-sm mt-1">{d.childName}</p>
                  <p className="text-[10px] text-[#aa8222] font-semibold mt-0.5">
                    Click to view live verification & status →
                  </p>
                </div>
                <span className="text-xs font-bold text-[#2a170e] group-hover:translate-x-1 transition-transform">
                  Track →
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Multi-Child Selector when search returns multiple children (e.g. siblings under same parent phone or family surname) */}
      {matchedRecords.length > 1 && (
        <div className="bg-[#fbf5e6] p-5 rounded-3xl border-2 border-[#d4af37] shadow-sm space-y-3 animate-in fade-in">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <h3 className="text-xs sm:text-sm font-bold uppercase text-[#2a170e] tracking-wider flex items-center gap-2">
              <Users className="w-4 h-4 text-[#aa8222]" />
              {matchedRecords.length} Children Found — Select a Child to View Status
            </h3>
            <span className="text-[11px] font-semibold text-amber-900">
              All matching siblings are listed below
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {matchedRecords.map((rec) => {
              const isSelected = trackedRecord?.id === rec.id && trackedRecord?.childName === rec.childName;
              return (
                <button
                  key={`${rec.id}::${rec.childName}`}
                  type="button"
                  onClick={() => setTrackedRecord(rec)}
                  className={`p-3.5 rounded-2xl border-2 text-left transition-all cursor-pointer flex items-center justify-between ${
                    isSelected
                      ? 'bg-[#2a170e] text-white border-[#d4af37] shadow-md'
                      : 'bg-white text-gray-900 border-amber-200 hover:border-[#d4af37]'
                  }`}
                >
                  <div>
                    <span
                      className={`font-mono text-[10px] font-bold px-2 py-0.5 rounded-md ${
                        isSelected ? 'bg-[#d4af37] text-[#2a170e]' : 'bg-amber-100 text-amber-900'
                      }`}
                    >
                      {rec.id}
                    </span>
                    <p className="font-bold text-sm mt-1">{rec.childName}</p>
                    <p className={`text-[11px] mt-0.5 ${isSelected ? 'text-[#ffd700]' : 'text-gray-500'}`}>
                      {rec.selectedZone} • {rec.selectedFellowship}
                    </p>
                  </div>
                  <span className={`text-xs font-bold ${isSelected ? 'text-[#ffd700]' : 'text-[#2a170e]'}`}>
                    {isSelected ? 'Viewing' : 'View →'}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Results Section */}
      {trackedRecord && (
        <div className="bg-white rounded-3xl shadow-lg border-2 border-[#d4af37]/40 p-6 sm:p-8 space-y-6 animate-in fade-in zoom-in-95">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-100 pb-5">
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-mono font-bold bg-[#fbf5e6] text-[#2a170e] px-2.5 py-1 rounded-md border border-[#d4af37]/30">
                  {trackedRecord.id}
                </span>
                <span className="text-xs font-bold px-2.5 py-1 rounded-full uppercase bg-[#fbf5e6] text-[#aa8222] border border-[#d4af37]/30">
                  {trackedRecord.selectedZone} • {trackedRecord.selectedFellowship}
                </span>
              </div>
              <h2 className="text-2xl font-cinzel font-bold text-gray-900 mt-2">
                {trackedRecord.childName}
              </h2>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => window.print()}
                className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <Printer className="w-3.5 h-3.5" /> Print Voucher
              </button>
              {onOpenCertificate && trackedRecord.certificateIssued && (
                <button
                  onClick={() => onOpenCertificate(trackedRecord)}
                  className="bg-[#2a170e] hover:bg-[#3d2314] text-[#ffd700] border border-[#d4af37] px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-xs cursor-pointer"
                >
                  <Award className="w-3.5 h-3.5" /> View Certificate
                </button>
              )}
            </div>
          </div>

          {/* Stepper Progress */}
          <div className="space-y-4">
            <h4 className="text-xs font-bold uppercase tracking-wider text-gray-500">
              Application Workflow Progress
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              {STAGES.map((stg, idx) => {
                const currentStageIdx = getStageIndex(trackedRecord);
                const isPassed = currentStageIdx >= idx;
                const isCurrent = currentStageIdx === idx;

                return (
                  <div
                    key={stg.key}
                    className={`p-4 rounded-2xl border transition-all ${
                      isPassed
                        ? 'bg-emerald-50 border-emerald-300 text-emerald-950'
                        : 'bg-gray-50 border-gray-200 text-gray-400 opacity-60'
                    } ${isCurrent ? 'ring-2 ring-emerald-500 font-bold' : ''}`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      {isPassed ? (
                        <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
                      ) : (
                        <Clock className="w-4 h-4 text-gray-400 shrink-0" />
                      )}
                      <p className="text-xs font-bold">{stg.label}</p>
                    </div>
                    <p className="text-[10px] text-gray-600">{stg.desc}</p>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-amber-50/50 border border-amber-200/60 text-xs text-amber-950 flex items-center justify-between flex-wrap gap-2">
            <div>
              <p className="font-bold">Dedication Sunday Schedule:</p>
              <p className="text-sm font-cinzel font-bold text-[#2a170e] mt-0.5">
                {trackedRecord.serviceDate || 'To be scheduled by Pastoral Office'}
              </p>
            </div>
            {trackedRecord.certificateNumber && (
              <div>
                <p className="font-bold">Certificate Reference:</p>
                <p className="font-mono text-xs text-[#aa8222] mt-0.5">
                  {trackedRecord.certificateNumber}
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
