import React, { useState, useRef } from 'react';
import * as XLSX from 'xlsx';
import { DedicationRecord } from '../types';
import { ZONES, MONTHLY_DEDICATION_DATES } from '../data/zones';
import { 
  Download, Upload, Search, CheckCircle2, 
  Award, Trash2, AlertCircle, X
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';
import { formatFirestoreUiError } from '../lib/firebase';

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
  const { user, firebaseUser, connectCloudSync, isAdmin } = useAuth();

  const [search, setSearch] = useState('');
  const [selectedZone, setSelectedZone] = useState('All');
  const [selectedStatus, setSelectedStatus] = useState('All');
  const [selectedDate, setSelectedDate] = useState('All');
  const [isImporting, setIsImporting] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<DedicationRecord | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [actionError, setActionError] = useState('');
  const [actionSuccess, setActionSuccess] = useState('');
  const [cloudConnecting, setCloudConnecting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Active records: all records that are not yet marked as 'completed', newest first
  const activeRecords = [...dedications]
    .filter(d => d.status !== 'completed')
    .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());

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
    api.logExport('active_dedications_excel', exportData.length);
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
          setActionError('Excel sheet was empty.');
          setIsImporting(false);
          return;
        }

        const mapped = rawJson.map((row) => {
          const rawDate = row['Dedication Sunday'] || row['Dedication Date'] || row['Date Dedicated'] || row['Dedicated Date'] || row['Date'] || row.serviceDate || '';
          const father = (row['Father Name'] || row['Father'] || row.fatherName || '').toString().trim();
          const mother = (row['Mother Name'] || row['Mother'] || row.motherName || '').toString().trim();
          const parents = (row['Parents'] || row['Parent Name'] || '').toString().trim();
          return {
            childName: row['Child Full Name'] || row['Child Name'] || row['Name'] || row.childName || 'Child',
            childDob: row['Date of Birth'] || row['DOB'] || row.childDob || '',
            childGender: (row['Gender'] || row['Sex'] || row.childGender || 'Male').toString().toLowerCase().includes('f') ? 'Female' : 'Male',
            childCountyOfBirth: row['County of Birth'] || row['County'] || row.childCountyOfBirth || 'Nairobi',
            fatherName: father,
            fatherPhone: (row['Father Phone'] || row['Phone'] || row.fatherPhone || '').toString().trim(),
            fatherEmail: (row['Father Email'] || row.fatherEmail || '').toString().trim(),
            motherName: mother,
            motherPhone: (row['Mother Phone'] || row.motherPhone || '').toString().trim(),
            motherEmail: (row['Mother Email'] || row.motherEmail || '').toString().trim(),
            parentName: parents || (father && mother ? `${father} & ${mother}` : father || mother || ''),
            selectedZone: row['Fellowship Zone'] || row['Zone'] || row.selectedZone || 'Zone A',
            selectedFellowship: row['Fellowship Name'] || row['Fellowship'] || row['Cell'] || row.selectedFellowship || 'Deliverance Church Utawala',
            residentialLocation: row['Residential Area'] || row['Residence'] || row['Estate'] || row.residentialLocation || 'Utawala',
            serviceDate: rawDate ? String(rawDate).trim() : '2026-10-25',
            status: row['Status'] || 'compiled',
            leadershipConfirmed: true,
            officeApproved: true
          };
        });

        await onBulkImport(mapped);
        setActionSuccess(`Successfully imported ${mapped.length} records! Existing records are preserved.`);
        setTimeout(() => setActionSuccess(''), 4000);
      } catch (err: any) {
        console.error('Import error:', err);
        setActionError(formatFirestoreUiError(err, 'Failed to parse or import Excel file.'));
      } finally {
        setIsImporting(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    };

    reader.readAsBinaryString(file);
  };

  const handleConfirmDelete = async () => {
    if (!pendingDelete) return;
    const target = pendingDelete;
    setDeletingId(target.id);
    setActionError('');
    setActionSuccess('');
    try {
      await onDeleteDedication(target.id);
      setPendingDelete(null);
      setActionSuccess(`Deleted ${target.childName} (${target.id}) successfully.`);
      setTimeout(() => setActionSuccess(''), 4000);
    } catch (err: any) {
      setActionError(
        formatFirestoreUiError(
          err,
          'Unable to delete record. Please ensure you are signed in with Google Cloud Sync as Super Admin or Office Admin.'
        )
      );
    } finally {
      setDeletingId(null);
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

      {/* Cloud Sync Banner if signed in via Email+Password only */}
      {user && isAdmin && !firebaseUser && (
        <div className="p-4 rounded-2xl bg-sky-50 border border-sky-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          <div>
            <p className="font-bold text-sky-950">Connect Google Cloud Sync for Cloud Deletions</p>
            <p className="text-sky-800">
              Sign in with Google ({user.email}) once so record updates and deletions sync across the live cloud database.
            </p>
          </div>
          <button
            type="button"
            disabled={cloudConnecting}
            onClick={async () => {
              setActionError('');
              setCloudConnecting(true);
              try {
                await connectCloudSync();
              } catch (err: any) {
                setActionError(err?.message || 'Unable to connect Google Cloud Sync.');
              } finally {
                setCloudConnecting(false);
              }
            }}
            className="px-4 py-2 bg-[#2a170e] hover:bg-[#3d2314] text-[#ffd700] font-bold rounded-xl text-xs whitespace-nowrap cursor-pointer shrink-0"
          >
            {cloudConnecting ? 'Connecting...' : 'Connect Google Cloud Sync'}
          </button>
        </div>
      )}

      {actionSuccess && (
        <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 font-semibold">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{actionSuccess}</span>
          </div>
          <button type="button" onClick={() => setActionSuccess('')} className="text-emerald-700 hover:text-emerald-900 cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {actionError && !pendingDelete && (
        <div className="p-3.5 rounded-2xl bg-red-50 border border-red-200 text-xs text-red-700 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 font-semibold">
            <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
            <span>{actionError}</span>
          </div>
          <button type="button" onClick={() => setActionError('')} className="text-red-700 hover:text-red-900 cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

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
                          type="button"
                          onClick={() => onOpenCertificate(item)}
                          title="Certificate"
                          className="p-1.5 text-[#aa8222] hover:bg-[#fbf5e6] rounded-lg transition-colors cursor-pointer"
                        >
                          <Award className="w-4 h-4" />
                        </button>
                        {isAdmin && (
                          <button
                            type="button"
                            disabled={deletingId === item.id}
                            onClick={() => {
                              setActionError('');
                              setPendingDelete(item);
                            }}
                            title="Delete"
                            className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
                          >
                            <Trash2 className="w-4 h-4" />
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

      {/* In-App Delete Confirmation Modal (avoids browser confirm() blocks in iframes & mobile) */}
      {pendingDelete && (
        <div className="fixed inset-0 z-50 bg-black/65 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl border-2 border-red-200 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <span className="p-2.5 rounded-xl bg-red-100 text-red-700 shrink-0">
                  <Trash2 className="w-5 h-5" />
                </span>
                <div>
                  <h3 className="text-base font-cinzel font-bold text-gray-900">
                    Delete Dedication Record?
                  </h3>
                  <p className="text-xs text-gray-500 font-mono">{pendingDelete.id}</p>
                </div>
              </div>
              <button
                type="button"
                disabled={Boolean(deletingId)}
                onClick={() => setPendingDelete(null)}
                className="text-gray-400 hover:text-gray-700 p-1 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-3.5 rounded-2xl bg-gray-50 border border-gray-200 text-xs space-y-1">
              <p className="font-bold text-gray-900 text-sm">{pendingDelete.childName}</p>
              <p className="text-gray-600">
                {pendingDelete.selectedZone} • {pendingDelete.selectedFellowship} Fellowship
              </p>
              <p className="text-gray-500">
                Parents: {pendingDelete.parentName || pendingDelete.fatherName || pendingDelete.motherName || 'N/A'}
              </p>
            </div>

            <p className="text-xs text-red-700 leading-relaxed">
              This will permanently remove this record from the active register and tracker across devices. This action cannot be undone.
            </p>

            {actionError && (
              <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                <span>{actionError}</span>
              </div>
            )}

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                disabled={Boolean(deletingId)}
                onClick={() => setPendingDelete(null)}
                className="px-4 py-2 rounded-xl border border-gray-300 text-xs font-bold text-gray-700 hover:bg-gray-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={Boolean(deletingId)}
                onClick={handleConfirmDelete}
                className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer disabled:opacity-60"
              >
                <Trash2 className="w-3.5 h-3.5" />
                {deletingId ? 'Deleting...' : 'Delete Permanently'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
