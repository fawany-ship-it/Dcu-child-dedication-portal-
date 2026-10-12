import React, { useState } from 'react';
import * as XLSX from 'xlsx';
import { DedicationRecord } from '../types';
import { ZONES } from '../data/zones';
import { 
  Download, Search, Award, CheckCircle2, Calendar, Phone, 
  MapPin, Printer, BookOpen
} from 'lucide-react';

interface PastDataListProps {
  dedications: DedicationRecord[];
  onOpenCertificate: (record: DedicationRecord) => void;
}

export function PastDataList({ dedications, onOpenCertificate }: PastDataListProps) {
  const [search, setSearch] = useState('');
  const [selectedZone, setSelectedZone] = useState('All');

  // Completed / Past dedicated records
  const pastRecords = dedications.filter(d => d.status === 'completed' || d.certificateIssued);

  const filtered = pastRecords.filter((d) => {
    const matchesSearch =
      d.childName.toLowerCase().includes(search.toLowerCase()) ||
      d.id.toLowerCase().includes(search.toLowerCase()) ||
      d.fatherName.toLowerCase().includes(search.toLowerCase()) ||
      d.motherName.toLowerCase().includes(search.toLowerCase()) ||
      (d.certificateNumber && d.certificateNumber.toLowerCase().includes(search.toLowerCase())) ||
      d.selectedFellowship.toLowerCase().includes(search.toLowerCase());

    const matchesZone = selectedZone === 'All' || d.selectedZone === selectedZone;

    return matchesSearch && matchesZone;
  });

  const handleExportExcel = () => {
    const exportData = filtered.map((d) => ({
      'Certificate No': d.certificateNumber || d.id,
      'Child Full Name': d.childName,
      'Date of Birth': d.childDob,
      'Gender': d.childGender,
      'County of Birth': d.childCountyOfBirth || d.childPlaceOfBirth,
      'Father Name': d.fatherName,
      'Father Phone': d.fatherPhone,
      'Mother Name': d.motherName,
      'Mother Phone': d.motherPhone,
      'Fellowship Zone': d.selectedZone,
      'Fellowship Name': d.selectedFellowship,
      'Dedicated Date': d.serviceDate,
      'Office Approved By': d.officeAdminName || 'Church Office',
      'Fellowship Confirmed By': d.fellowshipLeaderName || 'Leader',
      'Date Registered': new Date(d.createdAt).toLocaleDateString()
    }));

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Archived Dedications');
    XLSX.writeFile(workbook, `DCU_Past_Dedications_Archive_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="bg-gradient-to-r from-[#2a170e] to-[#3d2314] text-white p-6 sm:p-8 rounded-3xl shadow-xl border-2 border-[#d4af37]/40 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-1.5 text-xs font-bold text-[#ffd700] uppercase tracking-wider bg-[#d4af37]/20 px-3 py-1 rounded-full border border-[#d4af37]/40 mb-2">
            <BookOpen className="w-3.5 h-3.5 text-[#d4af37]" /> Church Archives & History
          </div>
          <h1 className="text-2xl sm:text-3xl font-cinzel font-bold text-white">
            Past Data List (Dedicated Archive)
          </h1>
          <p className="text-xs sm:text-sm text-[#f6efe2]/80">
            Historical records of dedicated infants who received altar blessing and church certificates.
          </p>
        </div>

        <button
          onClick={handleExportExcel}
          className="bg-[#d4af37] hover:bg-[#e8c356] text-[#2a170e] px-4 py-2.5 rounded-xl font-bold text-xs sm:text-sm flex items-center gap-2 shadow-md transition-all self-start md:self-auto cursor-pointer"
        >
          <Download className="w-4 h-4 text-[#2a170e]" />
          Download Past Archive (Excel)
        </button>
      </div>

      {/* Filter Row */}
      <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-xs flex flex-col sm:flex-row items-center gap-3">
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 text-gray-400 absolute left-3 top-3.5" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by child name, certificate number, parent..."
            className="w-full pl-9 pr-3 py-2 text-xs sm:text-sm border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#d4af37] outline-hidden"
          />
        </div>

        <div className="w-full sm:w-64">
          <select
            value={selectedZone}
            onChange={(e) => setSelectedZone(e.target.value)}
            className="w-full py-2 px-3 text-xs sm:text-sm border border-gray-300 rounded-xl bg-white focus:ring-2 focus:ring-[#d4af37] outline-hidden"
          >
            <option value="All">All Fellowship Zones (A to E)</option>
            {ZONES.map((z) => (
              <option key={z.name} value={z.name}>{z.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Grid of Past Dedicated Records */}
      {filtered.length === 0 ? (
        <div className="bg-white p-12 rounded-3xl border border-gray-200 text-center space-y-3">
          <Award className="w-12 h-12 text-gray-300 mx-auto" />
          <h3 className="text-lg font-bold text-gray-800">No Past Records Found</h3>
          <p className="text-xs text-gray-500 max-w-sm mx-auto">
            Once dedication candidates are marked as completed after Sunday service, their archival records will appear here.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((item) => (
            <div
              key={item.id}
              className="bg-white rounded-3xl p-6 border-2 border-amber-200/80 hover:border-[#d4af37] shadow-sm transition-all space-y-4"
            >
              <div className="flex items-start justify-between">
                <div>
                  <span className="font-mono text-[10px] font-bold text-[#aa8222] bg-[#fbf5e6] px-2 py-0.5 rounded-md border border-[#d4af37]/30">
                    {item.certificateNumber || item.id}
                  </span>
                  <h3 className="text-lg font-cinzel font-bold text-gray-900 mt-1">
                    {item.childName}
                  </h3>
                  <p className="text-[11px] text-gray-500">
                    Born: {item.childDob} ({item.childGender}) • {item.childCountyOfBirth || item.childPlaceOfBirth} County
                  </p>
                </div>
                <div className="w-9 h-9 rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center shrink-0">
                  <CheckCircle2 className="w-5 h-5 text-emerald-700" />
                </div>
              </div>

              <div className="text-xs text-gray-700 space-y-1 bg-gray-50/80 p-3 rounded-xl border border-gray-100">
                <p>
                  <span className="text-gray-400 font-semibold">Parents:</span> {item.fatherName || item.motherName || item.parentName}
                </p>
                <p>
                  <span className="text-gray-400 font-semibold">Fellowship:</span> {item.selectedFellowship} ({item.selectedZone})
                </p>
                <p>
                  <span className="text-gray-400 font-semibold">Dedicated On:</span> <strong className="text-[#2a170e]">{item.serviceDate}</strong>
                </p>
              </div>

              <div className="pt-1 flex items-center justify-between">
                <span className="text-[11px] text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded-md">
                  Certificate Issued
                </span>
                <button
                  onClick={() => onOpenCertificate(item)}
                  className="bg-[#2a170e] hover:bg-[#3d2314] text-[#ffd700] px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1 cursor-pointer"
                >
                  <Award className="w-3.5 h-3.5" />
                  View Certificate
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
