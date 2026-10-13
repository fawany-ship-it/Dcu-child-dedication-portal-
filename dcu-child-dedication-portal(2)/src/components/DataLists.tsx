import React, { useState, useRef } from 'react';
import * as XLSX from 'xlsx';
import { DedicationRecord } from '../types';
import { ZONES, MONTHLY_DEDICATION_DATES } from '../data/zones';
import { 
  Download, Upload, Search, Filter, Baby, Phone, CheckCircle2, 
  Clock, Award, Trash2, Edit3, Shield
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

interface DataListsProps {
  dedications: DedicationRecord[];
  onUpdateDedication: (id: string, updates: Partial<DedicationRecord>) => Promise<void>;
  onDeleteDedication: (id: string) => Promise<void>;
  onBulkImport: (records: any[]) => Promise<void>;
  onOpenCertificate: (record: DedicationRecord) => void;
}

export function DataLists({
  dedications,
  onUpdateDedication,
  onDeleteDedication,
  onBulkImport,
  onOpenCertificate
}: DataListsProps) {
  const { user, isAdmin } = useAuth();

  const [search, setSearch] = useState('');
  const [selectedZone, setSelectedZone] = useState('All');
  const [selectedStatus, setSelectedStatus] = useState('All');
  const [selectedDate, setSelectedDate] = useState('All');
  const [isImporting, setIsImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Active records: all records that are not yet marked as 'completed'
  const activeRecords = dedications.filter(d => d.status !== 'completed');

  const filtered = activeRecords.filter((d) => {
    const matchesSearch =
      d.childName.toLowerCase().includes(search.toLowerCase()) ||
      d.id.toLowerCase().includes(search.toLowerCase()) ||
      d.fatherName.toLowerCase().includes(search.toLowerCase()) ||
      d.motherName.toLowerCase().includes(search.toLowerCase()) ||
      d.fatherPhone.includes(search) ||
      d.motherPhone.includes(search) ||
      d.selectedFellowship.toLowerCase().includes(search.toLowerCase());

    const matchesZone = selectedZone === 'All' || d.selectedZone === selectedZone;
    const matchesStatus = selectedStatus === 'All' || d.status === selectedStatus;
    const matchesDate = selectedDate === 'All' || d.serviceDate === selectedDate;

    return matchesSearch && matchesZone && matchesStatus && matchesDate;
  });

  const handleExportExcel = () => {
    const exportData = filtered.map((d) => ({
      'Reference ID': d.id,
      'Child Full Name': d.childName,
      'Date of Birth': d.childDob,
      'Gender': d.childGender,
      'County of Birth': d.childCountyOfBirth || d.childPlaceOfBirth || 'Nairobi',
      'Father Name': d.fatherName,
      'Father Phone': d.fatherPhone,
      'Father Email': d.fatherEmail,
      'Mother Name': d.motherName,
      'Mother Phone': d.motherPhone,
      'Mother Email': d.motherEmail,
      'Fellowship Zone': d.selectedZone,
      'Fellowship Name': d.selectedFellowship,
      'Residential Area': d.residentialLocation,
      'Dedication Sunday': d.serviceDate,
      'Fellowship Confirmed': d.leadershipConfirmed ? 'Yes' : 'No',
      'Fellowship Leader': d.fellowshipLeaderName || 'Pending',
      'Office Approved': d.officeApproved ? 'Yes' : 'No',
      'Office Admin': d.officeAdminName || 'Pending',
      'Status': d.status,
      'Certificate Number': d.certificateNumber || 'Pending',
      'Date Registered': new Date(d.createdAt).toLocaleDateString()
    }));

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Active Dedications');
    XLSX.writeFile(workbook, `DCU_Active_Dedications_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    const reader = new FileReader();

    reader.onload = async (evt) => {
      try {
        const bstr = evt.target?.result;
        const workbook = XLSX.read(bstr, { type: 'binary' });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const rawJson: any[] = XLSX.utils.sheet_to_json(sheet);

        if (rawJson.length === 0) {
          alert('Excel sheet was empty.');
          setIsImporting(false);
          return;
        }

        const mapped = rawJson.map((row) => ({
          childName: row['Child Full Name'] || row.childName || 'Child',
          childDob: row['Date of Birth'] || row.childDob || '2026-01-01',
          childGender: row['Gender'] || row.childGender || 'Male',
          childCountyOfBirth: row['County of Birth'] || row.childCountyOfBirth || 'Nairobi',
          fatherName: row['Father Name'] || row.fatherName || '',
          fatherPhone: row['Father Phone'] || row.fatherPhone || '',
          fatherEmail: row['Father Email'] || row.fatherEmail || '',
          motherName: row['Mother Name'] || row.motherName || '',
          motherPhone: row['Mother Phone'] || row.motherPhone || '',
          motherEmail: row['Mother Email'] || row.motherEmail || '',
          selectedZone: row['Fellowship Zone'] || row.selectedZone || 'Zone A',
          selectedFellowship: row['Fellowship Name'] || row.selectedFellowship || 'Doxa',
          residentialLocation: row['Residential Area'] || row.residentialLocation || 'Utawala',
          serviceDate: row['Dedication Sunday'] || row.serviceDate || '2026-10-25',
          status: row['Status'] || 'compiled',
          leadershipConfirmed: true,
          officeApproved: true
        }));

        await onBulkImport(mapped);
        alert(`Successfully imported ${mapped.length} records! Existing records are preserved.`);
      } catch (err) {
        console.error('Import error:', err);
        alert('Failed to parse Excel file.');
      } finally {
        setIsImporting(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    };

    reader.readAsBinaryString(file);
  };

  const handleDelete = async (id: string, name: string) => {
    if (confirm(`Are you sure you want to delete ${name}'s dedication record?`)) {
      await onDeleteDedication(id);
    }
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="bg-white p-6 sm:p-8 rounded-3xl shadow-sm border border-[#d4af37]/30 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <span className="text-xs font-bold text-[#aa8222] uppercase tracking-wider">
            Active Registration Register
          </span>
          <h1 className="text-2xl sm:text-3xl font-cinzel font-bold text-[#2a170e] mt-1">
            Data Lists (Active Candidates)
          </h1>
          <p className="text-xs sm:text-sm text-gray-500">
            Comprehensive register of ongoing child dedication applications undergoing fellowship and office review.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={handleExportExcel}
            className="bg-[#2a170e] hover:bg-[#3d2314] text-[#ffd700] border border-[#d4af37] px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-1.5 shadow-sm transition-all cursor-pointer"
          >
            <Download className="w-4 h-4 text-[#ffd700]" />
            Export to Excel
          </button>

          <label className="bg-white hover:bg-gray-50 text-gray-800 border border-gray-300 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-1.5 shadow-sm transition-all cursor-pointer">
            <Upload className="w-4 h-4 text-gray-600" />
            {isImporting ? 'Importing...' : 'Import Excel'}
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileUpload}
              accept=".xlsx, .xls, .csv"
              className="hidden"
            />
          </label>
        </div>
      </div>

      {/* Filter Row */}
      <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-xs grid grid-cols-1 sm:grid-cols-4 gap-3">
        <div className="relative">
          <Search className="w-4 h-4 text-gray-400 absolute left-3 top-3.5" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search child, parent, phone..."
            className="w-full pl-9 pr-3 py-2 text-xs sm:text-sm border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#d4af37] outline-hidden"
          />
        </div>

        <div>
          <select
            value={selectedZone}
            onChange={(e) => setSelectedZone(e.target.value)}
            className="w-full py-2 px-3 text-xs sm:text-sm border border-gray-300 rounded-xl bg-white"
          >
            <option value="All">All Zones (A to E)</option>
            {ZONES.map((z) => (
              <option key={z.name} value={z.name}>{z.name}</option>
            ))}
            <option value="Unallocated">Unallocated</option>
          </select>
        </div>

        <div>
          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="w-full py-2 px-3 text-xs sm:text-sm border border-gray-300 rounded-xl bg-white"
          >
            <option value="All">All Statuses</option>
            <option value="submitted">Submitted</option>
            <option value="fellowship_confirmed">Fellowship Confirmed</option>
            <option value="office_approved">Office Approved</option>
            <option value="compiled">Compiled for Altar</option>
          </select>
        </div>

        <div>
          <select
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="w-full py-2 px-3 text-xs sm:text-sm border border-gray-300 rounded-xl bg-white"
          >
            <option value="All">All Dedication Dates</option>
            {MONTHLY_DEDICATION_DATES.map((m) => (
              <option key={m.date} value={m.date}>{m.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-3xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs sm:text-sm">
            <thead className="bg-[#2a170e] text-[#ffd700] font-cinzel text-xs tracking-wider border-b-2 border-[#d4af37]/40">
              <tr>
                <th className="py-3 px-4">Ref ID</th>
                <th className="py-3 px-4">Child Name</th>
                <th className="py-3 px-4">County of Birth</th>
                <th className="py-3 px-4">Parents & Contact</th>
                <th className="py-3 px-4">Zone & Fellowship</th>
                <th className="py-3 px-4">Dedication Date</th>
                <th className="py-3 px-4">Approval Progress</th>
                <th className="py-3 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-10 text-center text-gray-500">
                    No active records match the filter criteria.
                  </td>
                </tr>
              ) : (
                filtered.map((item) => (
                  <tr key={item.id} className="hover:bg-amber-50/20 transition-colors">
                    <td className="py-3 px-4 font-mono font-bold text-[#2a170e]">{item.id}</td>
                    <td className="py-3 px-4">
                      <p className="font-bold text-gray-900">{item.childName}</p>
                      <span className="text-[11px] text-gray-500">{item.childDob} ({item.childGender})</span>
                    </td>
                    <td className="py-3 px-4 font-medium">{item.childCountyOfBirth || item.childPlaceOfBirth} County</td>
                    <td className="py-3 px-4">
                      <p className="font-medium text-gray-900">{item.fatherName || item.motherName}</p>
                      <p className="text-[11px] text-gray-500">{item.fatherPhone || item.motherPhone}</p>
                    </td>
                    <td className="py-3 px-4">
                      <span className="font-bold text-[#2a170e]">{item.selectedFellowship}</span>
                      <span className="block text-[11px] text-gray-500">{item.selectedZone}</span>
                    </td>
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <select
                        value={item.serviceDate || 'To be scheduled by Pastoral Office'}
                        onChange={(e) => onUpdateDedication(item.id, { serviceDate: e.target.value })}
                        className="text-xs p-1.5 border border-gray-300 rounded-lg bg-white font-bold text-[#2a170e] focus:ring-1 focus:ring-[#d4af37]"
                      >
                        <option value="To be scheduled by Pastoral Office">To be scheduled by Pastoral Office</option>
                        {MONTHLY_DEDICATION_DATES.map((m) => (
                          <option key={m.date} value={m.date}>{m.label}</option>
                        ))}
                      </select>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex flex-col gap-1">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full inline-block w-fit ${
                          item.leadershipConfirmed
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}>
                          Fellowship: {item.leadershipConfirmed ? 'Confirmed' : 'Pending'}
                        </span>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full inline-block w-fit ${
                          item.officeApproved
                            ? 'bg-blue-100 text-blue-800'
                            : 'bg-gray-100 text-gray-600'
                        }`}>
                          Office: {item.officeApproved ? 'Approved' : 'Pending'}
                        </span>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => onOpenCertificate(item)}
                          title="Certificate"
                          className="p-1.5 text-[#aa8222] hover:bg-[#fbf5e6] rounded-lg transition-colors cursor-pointer"
                        >
                          <Award className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(item.id, item.childName)}
                          title="Delete"
                          className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
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
  );
}
