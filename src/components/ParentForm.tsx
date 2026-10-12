import React, { useState, useEffect } from 'react';
import { Baby, Users, Church, AlertCircle, CheckCircle2, Calendar, ShieldCheck, Printer, ArrowRight, Clock } from 'lucide-react';
import { ZONES, MONTHLY_DEDICATION_DATES, KENYAN_COUNTIES } from '../data/zones';
import { DedicationRecord } from '../types';
import { useAuth } from '../context/AuthContext';

interface ParentFormProps {
  onSubmitSuccess: (newRecord: DedicationRecord) => void;
  onNavigateToTracker: (queryId: string) => void;
}

export function ParentForm({ onSubmitSuccess, onNavigateToTracker }: ParentFormProps) {
  const { user } = useAuth();

  const [isInFellowship, setIsInFellowship] = useState<'yes' | 'no'>('yes');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submittedRecord, setSubmittedRecord] = useState<DedicationRecord | null>(null);

  const [formData, setFormData] = useState({
    childName: '',
    childDob: '',
    childGender: 'Male' as 'Male' | 'Female',
    childCountyOfBirth: 'Nairobi',

    fatherName: '',
    fatherPhone: '',
    fatherEmail: '',

    motherName: '',
    motherPhone: '',
    motherEmail: '',

    selectedZone: ZONES[0].name as 'Zone A' | 'Zone B' | 'Zone C' | 'Zone D' | 'Zone E',
    selectedFellowship: ZONES[0].fellowships[0],
    residentialLocation: '',

    serviceDate: 'To be scheduled by Pastoral Office',

    dataConsent: true,
  });

  // Prefill if logged-in parent
  useEffect(() => {
    if (user && user.role === 'parent') {
      setFormData(prev => ({
        ...prev,
        fatherEmail: prev.fatherEmail || user.email,
        fatherName: prev.fatherName || user.name,
      }));
    }
  }, [user]);

  const availableFellowships = ZONES.find((z) => z.name === formData.selectedZone)?.fellowships || [];

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => {
      const next = { ...prev, [name]: value };
      if (name === 'selectedZone') {
        const found = ZONES.find((z) => z.name === value);
        next.selectedFellowship = found?.fellowships[0] || '';
      }
      return next;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.dataConsent) {
      alert('You must consent to the Data Privacy and Protection Act to proceed with registration.');
      return;
    }

    if (!formData.childName.trim()) {
      alert('Please enter the child\'s full name.');
      return;
    }

    if (!formData.fatherPhone.trim() && !formData.motherPhone.trim()) {
      alert('Please provide at least one active phone number for fellowship leader follow-up.');
      return;
    }

    setIsSubmitting(true);

    try {
      const payload: Partial<DedicationRecord> = {
        childName: formData.childName.trim(),
        childDob: formData.childDob,
        childGender: formData.childGender,
        childCountyOfBirth: formData.childCountyOfBirth,
        childPlaceOfBirth: `${formData.childCountyOfBirth} County`,
        fatherName: formData.fatherName.trim(),
        fatherPhone: formData.fatherPhone.trim(),
        fatherEmail: formData.fatherEmail.trim(),
        motherName: formData.motherName.trim(),
        motherPhone: formData.motherPhone.trim(),
        motherEmail: formData.motherEmail.trim(),
        parentName: `${formData.fatherName.trim()} & ${formData.motherName.trim()}`.replace(/^ & | & $/g, ''),
        parentPhone: formData.fatherPhone.trim() || formData.motherPhone.trim(),
        parentEmail: formData.fatherEmail.trim() || formData.motherEmail.trim(),
        parentRelationship: 'Parents',
        isInFellowship: isInFellowship === 'yes',
        selectedZone: isInFellowship === 'yes' ? formData.selectedZone : 'Unallocated',
        selectedFellowship: isInFellowship === 'yes' ? formData.selectedFellowship : 'Unallocated - Follow-up Required',
        residentialLocation: formData.residentialLocation.trim() || (isInFellowship === 'yes' ? formData.selectedZone : ''),
        dataConsent: formData.dataConsent,
        status: 'submitted',
        serviceDate: formData.serviceDate,
        leadershipConfirmed: false,
        officeApproved: false,
        certificateIssued: false,
        submittedBy: user?.email || formData.fatherEmail || formData.motherEmail,
      };

      const res = await fetch('/api/dedications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      let savedRecord: DedicationRecord;
      if (res.ok) {
        savedRecord = await res.json();
      } else {
        savedRecord = {
          ...payload,
          id: `DED-${new Date().getFullYear()}-${Math.floor(100 + Math.random() * 900)}`,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        } as DedicationRecord;
      }

      setSubmittedRecord(savedRecord);
      onSubmitSuccess(savedRecord);
    } catch (err) {
      console.error('Error submitting dedication:', err);
      alert('Submission failed. Please check connection and try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (submittedRecord) {
    return (
      <div className="max-w-2xl mx-auto bg-white p-8 md:p-12 rounded-3xl shadow-2xl border-2 border-[#d4af37]/40 text-center space-y-6 animate-in fade-in duration-200">
        <div className="w-16 h-16 rounded-full bg-emerald-100 text-[#2a170e] mx-auto flex items-center justify-center border-2 border-[#d4af37]">
          <CheckCircle2 className="w-10 h-10 text-emerald-700" />
        </div>

        <div className="space-y-2">
          <span className="text-xs font-bold text-[#aa8222] uppercase tracking-wider bg-[#fbf5e6] px-3 py-1 rounded-full border border-[#d4af37]/30">
            Form Successfully Received
          </span>
          <h2 className="text-3xl font-cinzel font-bold text-[#2a170e]">Praise the Lord!</h2>
          <p className="text-gray-600 text-sm max-w-lg mx-auto">
            Your registration for <strong>{submittedRecord.childName}</strong> has been securely submitted to Deliverance Church International Utawala.
          </p>
        </div>

        {/* 24-hour verification notice */}
        <div className="bg-[#fbf5e6] p-4 rounded-2xl border border-[#d4af37]/40 text-left text-xs text-[#5d430d] space-y-1">
          <p className="font-bold flex items-center gap-1.5 text-[#2a170e]">
            <Clock className="w-4 h-4 text-[#aa8222]" /> 24-Hour Review Notice:
          </p>
          <p className="leading-relaxed">
            Your Home Fellowship Leader will verify your form, followed by Church Office confirmation. Progress status is updated within 24 hours of submission.
          </p>
        </div>

        {/* Summary card */}
        <div className="bg-gray-50 p-6 rounded-2xl border border-gray-200 text-left space-y-3 font-mono text-xs sm:text-sm">
          <div className="flex justify-between border-b border-gray-200 pb-2">
            <span className="text-gray-500 font-sans">Reference ID:</span>
            <span className="font-bold text-[#2a170e]">{submittedRecord.id}</span>
          </div>
          <div className="flex justify-between border-b border-gray-200 pb-2">
            <span className="text-gray-500 font-sans">Child Name:</span>
            <span className="font-bold text-gray-900">{submittedRecord.childName}</span>
          </div>
          <div className="flex justify-between border-b border-gray-200 pb-2">
            <span className="text-gray-500 font-sans">County of Birth:</span>
            <span className="font-bold text-gray-900">{submittedRecord.childCountyOfBirth} County</span>
          </div>
          <div className="flex justify-between border-b border-gray-200 pb-2">
            <span className="text-gray-500 font-sans">Fellowship Zone:</span>
            <span className="font-bold text-gray-900">{submittedRecord.selectedZone} ({submittedRecord.selectedFellowship})</span>
          </div>
          <div className="flex justify-between border-b border-gray-200 pb-2">
            <span className="text-gray-500 font-sans">Dedication Sunday:</span>
            <span className="font-bold text-gray-900">{submittedRecord.serviceDate}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500 font-sans">Status:</span>
            <span className="font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 uppercase text-xs">
              Pending Fellowship Confirmation
            </span>
          </div>
        </div>

        <p className="text-xs text-gray-500 italic">
          To track your application, use the <strong>Track Status</strong> tab and enter your Child's Name, Parent's Name, or Phone Number.
        </p>

        <div className="flex flex-wrap justify-center gap-3 pt-2">
          <button
            onClick={() => onNavigateToTracker(submittedRecord.childName)}
            className="bg-[#2a170e] hover:bg-[#3d2314] text-[#ffd700] border-2 border-[#d4af37] font-bold px-6 py-3 rounded-xl shadow-md transition-all flex items-center gap-2 text-sm cursor-pointer"
          >
            Track Status Now
            <ArrowRight className="w-4 h-4" />
          </button>

          <button
            onClick={() => window.print()}
            className="bg-white hover:bg-gray-100 text-gray-700 border border-gray-300 font-semibold px-5 py-3 rounded-xl transition-all flex items-center gap-2 text-sm cursor-pointer"
          >
            <Printer className="w-4 h-4" />
            Print Registration Slip
          </button>

          <button
            onClick={() => {
              setSubmittedRecord(null);
              setFormData({
                childName: '',
                childDob: '',
                childGender: 'Male',
                childCountyOfBirth: 'Nairobi',
                fatherName: '',
                fatherPhone: '',
                fatherEmail: '',
                motherName: '',
                motherPhone: '',
                motherEmail: '',
                selectedZone: ZONES[0].name,
                selectedFellowship: ZONES[0].fellowships[0],
                residentialLocation: '',
                serviceDate: 'To be scheduled by Pastoral Office',
                dataConsent: true,
              });
            }}
            className="text-gray-600 hover:text-gray-900 text-sm font-semibold underline py-3 cursor-pointer"
          >
            Register Another Child
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto bg-white p-6 sm:p-10 rounded-3xl shadow-xl border-2 border-[#d4af37]/40 space-y-8">
      {/* Header */}
      <div className="text-center border-b border-gray-100 pb-6 space-y-2">
        <div className="inline-flex items-center justify-center p-3 rounded-2xl bg-[#fbf5e6] text-[#2a170e] mb-2 border border-[#d4af37]/40">
          <Baby className="w-8 h-8 text-[#2a170e]" />
        </div>
        <h1 className="text-2xl sm:text-4xl font-cinzel font-bold text-[#2a170e]">
          Register Your Child for Dedication
        </h1>
        <p className="text-sm text-gray-600 max-w-xl mx-auto">
          Deliverance Church International Utawala • Child Dedication Form
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-8">
        {/* SECTION 1: CHILD DETAILS */}
        <section className="space-y-4">
          <div className="flex items-center space-x-2.5 border-b-2 border-[#d4af37] pb-2">
            <Baby className="text-[#aa8222] w-5 h-5" />
            <h2 className="text-lg sm:text-xl font-cinzel font-bold text-[#2a170e]">1. Child's Information</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                Child's Full Name <span className="text-red-500">*</span>
              </label>
              <input
                required
                type="text"
                name="childName"
                value={formData.childName}
                onChange={handleChange}
                placeholder="e.g. Ethan Baraka Mutua"
                className="w-full p-3 text-sm border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#d4af37] focus:border-[#d4af37] outline-hidden"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                Date of Birth <span className="text-red-500">*</span>
              </label>
              <input
                required
                type="date"
                name="childDob"
                value={formData.childDob}
                onChange={handleChange}
                className="w-full p-3 text-sm border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#d4af37] focus:border-[#d4af37] outline-hidden"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                Gender <span className="text-red-500">*</span>
              </label>
              <select
                name="childGender"
                value={formData.childGender}
                onChange={handleChange}
                className="w-full p-3 text-sm border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#d4af37] outline-hidden bg-white"
              >
                <option value="Male">Male</option>
                <option value="Female">Female</option>
              </select>
            </div>

            {/* County of Birth (replaces Hospital / Town) */}
            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                County of Birth <span className="text-red-500">*</span>
              </label>
              <select
                name="childCountyOfBirth"
                value={formData.childCountyOfBirth}
                onChange={handleChange}
                className="w-full p-3 text-sm border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#d4af37] outline-hidden bg-white"
              >
                {KENYAN_COUNTIES.map((c) => (
                  <option key={c} value={c}>{c} County</option>
                ))}
              </select>
            </div>
          </div>
        </section>

        {/* SECTION 2: PARENTS' DETAILS */}
        <section className="space-y-4">
          <div className="flex items-center space-x-2.5 border-b-2 border-[#d4af37] pb-2">
            <Users className="text-[#aa8222] w-5 h-5" />
            <h2 className="text-lg sm:text-xl font-cinzel font-bold text-[#2a170e]">2. Parents' Information</h2>
          </div>

          {/* Father Details */}
          <div className="bg-[#fcfaf6] p-5 rounded-2xl border border-gray-200 space-y-3">
            <h3 className="font-cinzel font-bold text-[#2a170e] text-sm">
              Father's Details
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Full Name</label>
                <input
                  type="text"
                  name="fatherName"
                  value={formData.fatherName}
                  onChange={handleChange}
                  placeholder="e.g. Daniel Mutua"
                  className="w-full p-2.5 text-sm border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-[#d4af37] outline-hidden"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Phone Number</label>
                <input
                  type="tel"
                  name="fatherPhone"
                  value={formData.fatherPhone}
                  onChange={handleChange}
                  placeholder="0722 000 000"
                  className="w-full p-2.5 text-sm border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-[#d4af37] outline-hidden"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Email Address</label>
                <input
                  type="email"
                  name="fatherEmail"
                  value={formData.fatherEmail}
                  onChange={handleChange}
                  placeholder="father@example.com"
                  className="w-full p-2.5 text-sm border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-[#d4af37] outline-hidden"
                />
              </div>
            </div>
          </div>

          {/* Mother Details */}
          <div className="bg-[#fcfaf6] p-5 rounded-2xl border border-gray-200 space-y-3">
            <h3 className="font-cinzel font-bold text-[#2a170e] text-sm">
              Mother's Details
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Full Name</label>
                <input
                  type="text"
                  name="motherName"
                  value={formData.motherName}
                  onChange={handleChange}
                  placeholder="e.g. Faith Mwende Mutua"
                  className="w-full p-2.5 text-sm border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-[#d4af37] outline-hidden"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Phone Number</label>
                <input
                  type="tel"
                  name="motherPhone"
                  value={formData.motherPhone}
                  onChange={handleChange}
                  placeholder="0733 000 000"
                  className="w-full p-2.5 text-sm border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-[#d4af37] outline-hidden"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Email Address</label>
                <input
                  type="email"
                  name="motherEmail"
                  value={formData.motherEmail}
                  onChange={handleChange}
                  placeholder="mother@example.com"
                  className="w-full p-2.5 text-sm border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-[#d4af37] outline-hidden"
                />
              </div>
            </div>
          </div>
        </section>

        {/* SECTION 3: HOME FELLOWSHIP ALLOCATION (ZONES A TO E) */}
        <section className="space-y-4">
          <div className="flex items-center space-x-2.5 border-b-2 border-[#d4af37] pb-2">
            <Church className="text-[#aa8222] w-5 h-5" />
            <h2 className="text-lg sm:text-xl font-cinzel font-bold text-[#2a170e]">
              3. Home Fellowship Allocation (Zones A to E)
            </h2>
          </div>

          <div className="p-4 bg-gray-50 rounded-2xl border border-gray-200">
            <label className="block text-sm font-semibold text-gray-900 mb-3">
              Are you currently allocated to a Deliverance Church Utawala Home Fellowship?
            </label>
            <div className="flex flex-wrap gap-6">
              <label className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="radio"
                  name="isInFellowship"
                  value="yes"
                  checked={isInFellowship === 'yes'}
                  onChange={() => setIsInFellowship('yes')}
                  className="w-4 h-4 text-[#2a170e] focus:ring-[#d4af37]"
                />
                <span className="text-sm font-medium text-gray-800">Yes, I belong to a fellowship</span>
              </label>

              <label className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="radio"
                  name="isInFellowship"
                  value="no"
                  checked={isInFellowship === 'no'}
                  onChange={() => setIsInFellowship('no')}
                  className="w-4 h-4 text-[#2a170e] focus:ring-[#d4af37]"
                />
                <span className="text-sm font-medium text-gray-800">No, I am not in a fellowship yet</span>
              </label>
            </div>
          </div>

          {isInFellowship === 'no' ? (
            <div className="bg-amber-50/80 border-l-4 border-amber-500 p-5 rounded-2xl space-y-3">
              <div className="flex items-start space-x-3">
                <AlertCircle className="text-amber-600 w-5 h-5 shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-amber-900 font-bold text-sm">Fellowship Follow-Up Needed</h4>
                  <p className="text-xs text-amber-800 mt-1">
                    Please provide your residential landmark in Utawala. A Home Fellowship leader will contact you to connect you to a nearby fellowship.
                  </p>
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-amber-900 mb-1">
                  Residential Area / Landmark <span className="text-red-500">*</span>
                </label>
                <input
                  required={isInFellowship === 'no'}
                  type="text"
                  name="residentialLocation"
                  value={formData.residentialLocation}
                  onChange={handleChange}
                  placeholder="e.g. Utawala Shooters, near St. Patrick School"
                  className="w-full p-3 text-sm border border-amber-300 rounded-xl bg-white focus:ring-2 focus:ring-amber-500 outline-hidden"
                />
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-gray-50/70 p-5 rounded-2xl border border-gray-200">
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                  Select Zone (Zone A, B, C, D, or E)
                </label>
                <select
                  name="selectedZone"
                  value={formData.selectedZone}
                  onChange={handleChange}
                  className="w-full p-3 text-sm border border-gray-300 rounded-xl bg-white focus:ring-2 focus:ring-[#d4af37] outline-hidden font-bold text-[#2a170e]"
                >
                  {ZONES.map((zone) => (
                    <option key={zone.name} value={zone.name}>
                      {zone.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                  Home Fellowship Name
                </label>
                <select
                  name="selectedFellowship"
                  value={formData.selectedFellowship}
                  onChange={handleChange}
                  className="w-full p-3 text-sm border border-gray-300 rounded-xl bg-white focus:ring-2 focus:ring-[#d4af37] outline-hidden font-semibold"
                >
                  {availableFellowships.map((f) => (
                    <option key={f} value={f}>
                      {f} Fellowship
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}
        </section>

        {/* SECTION 4: DEDICATION SERVICE SCHEDULE (PASTOR & OFFICE SCHEDULE) */}
        <section className="space-y-4">
          <div className="flex items-center space-x-2.5 border-b-2 border-[#d4af37] pb-2">
            <Calendar className="text-[#aa8222] w-5 h-5" />
            <h2 className="text-lg sm:text-xl font-cinzel font-bold text-[#2a170e]">
              4. Dedication Service Schedule
            </h2>
          </div>

          <div className="bg-[#fcfaf6] p-6 rounded-2xl border-2 border-[#d4af37]/30 space-y-3">
            <div className="flex items-start gap-3">
              <div className="p-2.5 rounded-xl bg-[#fbf5e6] text-[#aa8222] border border-[#d4af37]/30 shrink-0 mt-0.5">
                <Calendar className="w-5 h-5" />
              </div>
              <div className="space-y-1.5">
                <h4 className="font-cinzel font-bold text-[#2a170e] text-sm sm:text-base">
                  Dedication Sunday Scheduled by Senior Pastor & Church Office
                </h4>
                <p className="text-xs sm:text-sm text-gray-700 leading-relaxed">
                  Child dedications at Deliverance Church International Utawala take place in a period of <strong>3 months</strong>. Because special church events, conferences, and ministry programs fall on different months and dates, <strong>the Senior Pastor and Church Office determine and assign the exact Dedication Sunday</strong> upon fellowship leader confirmation.
                </p>
                <div className="pt-2 flex items-center gap-2 text-xs font-semibold text-[#8a6a1c]">
                  <CheckCircle2 className="w-4 h-4 text-[#aa8222]" />
                  <span>Your family's assigned Dedication Sunday will be updated and visible under the <strong>Track Status</strong> tab.</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* SECTION 5: DATA PRIVACY & PROTECTION ACT */}
        <section className="bg-gray-50/90 p-6 rounded-2xl border border-gray-200 space-y-3">
          <div className="flex items-center space-x-2 text-[#2a170e]">
            <ShieldCheck className="w-5 h-5 text-[#d4af37]" />
            <h3 className="font-cinzel font-bold text-base">Data Privacy & Protection Consent</h3>
          </div>
          <p className="text-xs text-gray-600 leading-relaxed">
            Deliverance Church International Utawala will use your details to verify fellowship connection, compile the altar dedication bulletin, and prepare the official child dedication certificate.
          </p>

          <div className="pt-3 border-t border-gray-200 flex flex-wrap items-center justify-between gap-4">
            <p className="text-xs font-bold text-gray-800">
              I CONSENT to DCI UTAWALA holding and using my information for child dedication:
            </p>
            <div className="flex items-center space-x-4">
              <label className="flex items-center space-x-1.5 cursor-pointer">
                <input
                  type="radio"
                  name="dataConsent"
                  checked={formData.dataConsent === true}
                  onChange={() => setFormData(p => ({ ...p, dataConsent: true }))}
                  className="w-4 h-4 text-[#2a170e] focus:ring-[#d4af37]"
                />
                <span className="text-xs font-bold text-emerald-800">Yes, I Consent</span>
              </label>

              <label className="flex items-center space-x-1.5 cursor-pointer">
                <input
                  type="radio"
                  name="dataConsent"
                  checked={formData.dataConsent === false}
                  onChange={() => setFormData(p => ({ ...p, dataConsent: false }))}
                  className="w-4 h-4 text-red-600 focus:ring-red-600"
                />
                <span className="text-xs font-bold text-red-600">No</span>
              </label>
            </div>
          </div>
        </section>

        {/* Submit button */}
        <button
          type="submit"
          disabled={isSubmitting || !formData.dataConsent}
          className={`w-full py-4 px-6 rounded-2xl font-bold text-base shadow-xl transition-all flex items-center justify-center gap-2 border-2 ${
            formData.dataConsent && !isSubmitting
              ? 'bg-[#2a170e] hover:bg-[#3d2314] text-[#ffd700] border-[#d4af37] cursor-pointer'
              : 'bg-gray-300 text-gray-500 border-gray-400 cursor-not-allowed'
          }`}
        >
          {isSubmitting ? (
            <span>Sending to Fellowship Leadership...</span>
          ) : (
            <>
              <CheckCircle2 className="w-5 h-5 text-[#ffd700]" />
              Submit Child Dedication Registration
            </>
          )}
        </button>
      </form>
    </div>
  );
}
