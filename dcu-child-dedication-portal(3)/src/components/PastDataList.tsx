import React, { useState, useMemo } from 'react';
import * as XLSX from 'xlsx';
import { PastDedicationRecord, DedicationRecord } from '../types';
import { ZONES } from '../data/zones';
import { 
  Download, Upload, Search, Award, CheckCircle2, Calendar, Phone, 
  MapPin, Printer, BookOpen, Plus, Filter, Database, FileSpreadsheet,
  AlertCircle, Trash2, Edit3, X, Check, RefreshCw
} from 'lucide-react';

interface PastDataListProps {
  pastDedications: PastDedicationRecord[];
  onAddPastDedication: (rec: Partial<PastDedicationRecord>) => Promise<void>;
  onBulkImportPast: (records: any[]) => Promise<void>;
  onUpdatePastDedication: (id: string, updates: Partial<PastDedicationRecord>) => Promise<void>;
  onDeletePastDedication: (id: string) => Promise<void>;
  onOpenCertificate: (record: DedicationRecord) => void;
}

export function PastDataList({
  pastDedications,
  onAddPastDedication,
  onBulkImportPast,
  onUpdatePastDedication,
  onDeletePastDedication,
  onOpenCertificate
}: PastDataListProps) {
  const [search, setSearch] = useState('');
  const [selectedZone, setSelectedZone] = useState('All');
  const [selectedYear, setSelectedYear] = useState('All');
  const [selectedGender, setSelectedGender] = useState('All');

  // Modals state
  const [showImportModal, setShowImportModal] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingRecord, setEditingRecord] = useState<PastDedicationRecord | null>(null);

  // Import modal state
  const [importedPreview, setImportedPreview] = useState<any[]>([]);
  const [importFileName, setImportFileName] = useState('');
  const [isImporting, setIsImporting] = useState(false);
  const [importError, setImportError] = useState('');
  const [importSuccessMessage, setImportSuccessMessage] = useState('');

  // Add / Edit form state
  const [formData, setFormData] = useState<Partial<PastDedicationRecord>>({
    childName: '',
    childDob: '',
    childGender: 'Male',
    childCountyOfBirth: 'Nairobi',
    fatherName: '',
    fatherPhone: '',
    motherName: '',
    motherPhone: '',
    selectedZone: 'Zone A',
    selectedFellowship: 'Doxa',
    dedicationYear: 2009,
    serviceDate: '2009-08-30',
    certificateNumber: '',
    officiatingMinister: 'Senior Pastor & Presbytery',
    notes: 'Historical church register entry'
  });

  // Calculate unique years available in dataset (sorted descending)
  const availableYears = useMemo(() => {
    const yearsSet = new Set<number>();
    // Always include historic years starting from 2009
    for (let y = 2009; y <= new Date().getFullYear(); y++) {
      yearsSet.add(y);
    }
    pastDedications.forEach((d) => {
      if (d.dedicationYear) yearsSet.add(Number(d.dedicationYear));
      else if (d.serviceDate) {
        const y = parseInt(d.serviceDate.slice(0, 4));
        if (!isNaN(y)) yearsSet.add(y);
      }
    });
    return Array.from(yearsSet).sort((a, b) => b - a);
  }, [pastDedications]);

  // Year counts mapping
  const yearCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    pastDedications.forEach((d) => {
      const y = String(d.dedicationYear || d.serviceDate?.slice(0, 4) || '2009');
      counts[y] = (counts[y] || 0) + 1;
    });
    return counts;
  }, [pastDedications]);

  // Filtered records
  const filtered = useMemo(() => {
    return pastDedications.filter((d) => {
      const recYear = String(d.dedicationYear || d.serviceDate?.slice(0, 4) || '');
      const matchesYear = selectedYear === 'All' || recYear === selectedYear;
      const matchesZone = selectedZone === 'All' || d.selectedZone === selectedZone;
      const matchesGender = selectedGender === 'All' || d.childGender === selectedGender;

      const q = search.toLowerCase().trim();
      const matchesSearch =
        !q ||
        d.childName.toLowerCase().includes(q) ||
        d.id.toLowerCase().includes(q) ||
        (d.fatherName && d.fatherName.toLowerCase().includes(q)) ||
        (d.motherName && d.motherName.toLowerCase().includes(q)) ||
        (d.parentName && d.parentName.toLowerCase().includes(q)) ||
        (d.certificateNumber && d.certificateNumber.toLowerCase().includes(q)) ||
        (d.selectedFellowship && d.selectedFellowship.toLowerCase().includes(q)) ||
        (d.notes && d.notes.toLowerCase().includes(q));

      return matchesYear && matchesZone && matchesGender && matchesSearch;
    });
  }, [pastDedications, search, selectedZone, selectedYear, selectedGender]);

  // Convert PastDedicationRecord to DedicationRecord for certificate modal
  const handleOpenCertificate = (past: PastDedicationRecord) => {
    const certRecord: DedicationRecord = {
      id: past.id,
      childName: past.childName,
      childDob: past.childDob,
      childGender: past.childGender,
      childCountyOfBirth: past.childCountyOfBirth || past.childPlaceOfBirth || 'Nairobi',
      childPlaceOfBirth: past.childCountyOfBirth || past.childPlaceOfBirth || 'Nairobi',
      fatherName: past.fatherName || '',
      fatherPhone: past.fatherPhone || '',
      fatherEmail: past.fatherEmail || '',
      motherName: past.motherName || '',
      motherPhone: past.motherPhone || '',
      motherEmail: past.motherEmail || '',
      parentName: past.parentName || `${past.fatherName || ''} & ${past.motherName || ''}`.trim(),
      parentPhone: past.parentPhone || past.fatherPhone || past.motherPhone || '',
      parentEmail: past.parentEmail || '',
      isInFellowship: true,
      selectedZone: past.selectedZone,
      selectedFellowship: past.selectedFellowship,
      dataConsent: true,
      status: 'completed',
      serviceDate: past.serviceDate,
      leadershipConfirmed: true,
      fellowshipLeaderName: 'Fellowship Leader',
      officeApproved: true,
      officeAdminName: past.officiatingMinister || 'Church Office',
      certificateIssued: true,
      certificateNumber: past.certificateNumber,
      createdAt: past.createdAt,
      updatedAt: past.updatedAt || past.createdAt
    };
    onOpenCertificate(certRecord);
  };

  // Excel Export of past records
  const handleExportExcel = () => {
    const exportData = filtered.map((d) => ({
      'Archive ID': d.id,
      'Certificate No': d.certificateNumber || d.id,
      'Child Full Name': d.childName,
      'Dedication Year': d.dedicationYear,
      'Dedicated Date': d.serviceDate,
      'Date of Birth': d.childDob,
      'Gender': d.childGender,
      'County of Birth': d.childCountyOfBirth || d.childPlaceOfBirth,
      'Father Name': d.fatherName,
      'Father Phone': d.fatherPhone || '',
      'Mother Name': d.motherName,
      'Mother Phone': d.motherPhone || '',
      'Fellowship Zone': d.selectedZone,
      'Fellowship Name': d.selectedFellowship,
      'Officiating Minister': d.officiatingMinister || 'Senior Pastor & Presbytery',
      'Notes': d.notes || '',
      'Archival Source': d.archivalSource || 'Church Dedication Register'
    }));

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Archived Since 2009');
    XLSX.writeFile(
      workbook,
      `DCU_Past_Dedications_Archive_2009_to_${new Date().getFullYear()}.xlsx`
    );
  };

  // Download Sample Template for Past Records
  const handleDownloadTemplate = () => {
    const sampleRows = [
      {
        'Child Full Name': 'Samuel Baraka Mwangi',
        'Date of Birth': '2009-03-15',
        'Gender': 'Male',
        'County of Birth': 'Nairobi',
        'Father Name': 'Joseph Mwangi Kariuki',
        'Father Phone': '0722 000 111',
        'Mother Name': 'Hannah Wangari Mwangi',
        'Mother Phone': '0733 111 222',
        'Fellowship Zone': 'Zone A',
        'Fellowship Name': 'Doxa',
        'Dedication Year': 2009,
        'Dedicated Date': '2009-08-30',
        'Certificate No': 'DCU-DED-2009-001',
        'Officiating Minister': 'Senior Pastor & Presbytery',
        'Notes': 'Historic 2009 Register'
      },
      {
        'Child Full Name': 'Abigail Chebet Koech',
        'Date of Birth': '2010-06-20',
        'Gender': 'Female',
        'County of Birth': 'Nakuru',
        'Father Name': 'David Kiprono Koech',
        'Father Phone': '0721 222 333',
        'Mother Name': 'Gladys Jepkemoi Koech',
        'Mother Phone': '0724 333 444',
        'Fellowship Zone': 'Zone B',
        'Fellowship Name': 'Neema',
        'Dedication Year': 2010,
        'Dedicated Date': '2010-10-31',
        'Certificate No': 'DCU-DED-2010-002',
        'Officiating Minister': 'Senior Pastor',
        'Notes': 'Historic 2010 Register'
      }
    ];

    const worksheet = XLSX.utils.json_to_sheet(sampleRows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Sample_Template');
    XLSX.writeFile(workbook, 'DCU_Past_Dedications_Upload_Template.xlsx');
  };

  // Handle CSV / Excel file drop or selection
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImportFileName(file.name);
    setImportError('');
    setImportSuccessMessage('');

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result;
        const workbook = XLSX.read(bstr, { type: 'binary' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        const rawJson: any[] = XLSX.utils.sheet_to_json(worksheet, { defval: '' });

        if (!rawJson || rawJson.length === 0) {
          setImportError('The uploaded file is empty or does not contain valid data rows.');
          return;
        }

        // Map columns flexibly
        const parsed = rawJson.map((row: any, idx: number) => {
          const childName = (
            row['Child Full Name'] || 
            row['Child Name'] || 
            row['Name'] || 
            row['childName'] || 
            row['Full Name'] ||
            `Child ${idx + 1}`
          ).toString().trim();

          const dob = (
            row['Date of Birth'] || 
            row['DOB'] || 
            row['childDob'] || 
            '2009-01-01'
          ).toString().trim();

          const gender = (
            row['Gender'] || 
            row['childGender'] || 
            'Male'
          ).toString().toLowerCase().includes('f') ? 'Female' : 'Male';

          const father = (
            row['Father Name'] || 
            row['Father'] || 
            row['fatherName'] || 
            ''
          ).toString().trim();

          const mother = (
            row['Mother Name'] || 
            row['Mother'] || 
            row['motherName'] || 
            ''
          ).toString().trim();

          const zoneRaw = (
            row['Fellowship Zone'] || 
            row['Zone'] || 
            row['selectedZone'] || 
            'Zone A'
          ).toString().trim();

          const matchedZone = ['Zone A', 'Zone B', 'Zone C', 'Zone D', 'Zone E'].find(
            z => z.toLowerCase() === zoneRaw.toLowerCase()
          ) || 'Zone A';

          const fellowship = (
            row['Fellowship Name'] || 
            row['Fellowship'] || 
            row['selectedFellowship'] || 
            'Fellowship'
          ).toString().trim();

          // Year detection
          let year = Number(row['Dedication Year'] || row['Year'] || row['dedicationYear']);
          const dateStr = (row['Dedicated Date'] || row['Service Date'] || row['serviceDate'] || '').toString();
          if (isNaN(year) || !year) {
            if (dateStr && dateStr.length >= 4) {
              const y = parseInt(dateStr.slice(0, 4));
              if (!isNaN(y)) year = y;
            }
          }
          if (isNaN(year) || !year) year = 2009;

          const certNo = (
            row['Certificate No'] || 
            row['Certificate Number'] || 
            row['certificateNumber'] || 
            `DCU-DED-${year}-${String(idx + 101).padStart(3, '0')}`
          ).toString().trim();

          return {
            childName,
            childDob: dob,
            childGender: gender,
            childCountyOfBirth: row['County of Birth'] || row['County'] || 'Nairobi',
            fatherName: father,
            fatherPhone: (row['Father Phone'] || row['Father Mobile'] || '').toString().trim(),
            motherName: mother,
            motherPhone: (row['Mother Phone'] || row['Mother Mobile'] || '').toString().trim(),
            parentName: `${father} & ${mother}`.trim() || father || mother,
            selectedZone: matchedZone,
            selectedFellowship: fellowship,
            dedicationYear: year,
            serviceDate: dateStr || `${year}-11-29`,
            certificateNumber: certNo,
            officiatingMinister: (row['Officiating Minister'] || row['Minister'] || 'Senior Pastor & Presbytery').toString().trim(),
            notes: (row['Notes'] || row['Remarks'] || 'Historical 2009+ register import').toString().trim(),
            archivalSource: file.name
          };
        });

        setImportedPreview(parsed);
      } catch (err: any) {
        console.error('File parsing error', err);
        setImportError(`Could not parse file: ${err.message || 'Check CSV/Excel format.'}`);
      }
    };
    reader.readAsBinaryString(file);
  };

  // Submit Bulk Import
  const handleConfirmImport = async () => {
    if (importedPreview.length === 0) return;
    setIsImporting(true);
    setImportError('');
    try {
      await onBulkImportPast(importedPreview);
      setImportSuccessMessage(`Successfully imported ${importedPreview.length} historical records into the Past Dedicated Archive!`);
      setTimeout(() => {
        setShowImportModal(false);
        setImportedPreview([]);
        setImportFileName('');
        setImportSuccessMessage('');
      }, 1400);
    } catch (err: any) {
      setImportError(`Import failed: ${err.message || 'Server error'}`);
    } finally {
      setIsImporting(false);
    }
  };

  // Save manual single record
  const handleSaveSingleRecord = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.childName) return;

    const year = Number(formData.dedicationYear) || 2009;
    const certNumber = formData.certificateNumber || `DCU-DED-${year}-${Math.floor(100 + Math.random() * 900)}`;

    if (editingRecord) {
      await onUpdatePastDedication(editingRecord.id, {
        ...formData,
        dedicationYear: year,
        certificateNumber: certNumber
      });
      setEditingRecord(null);
    } else {
      await onAddPastDedication({
        ...formData,
        dedicationYear: year,
        certificateNumber: certNumber,
        certificateIssued: true
      });
      setShowAddModal(false);
    }

    // Reset form
    setFormData({
      childName: '',
      childDob: '',
      childGender: 'Male',
      childCountyOfBirth: 'Nairobi',
      fatherName: '',
      fatherPhone: '',
      motherName: '',
      motherPhone: '',
      selectedZone: 'Zone A',
      selectedFellowship: 'Doxa',
      dedicationYear: 2009,
      serviceDate: '2009-08-30',
      certificateNumber: '',
      officiatingMinister: 'Senior Pastor & Presbytery',
      notes: 'Historical church register entry'
    });
  };

  const handleEditClick = (record: PastDedicationRecord) => {
    setEditingRecord(record);
    setFormData({
      childName: record.childName,
      childDob: record.childDob,
      childGender: record.childGender,
      childCountyOfBirth: record.childCountyOfBirth || 'Nairobi',
      fatherName: record.fatherName,
      fatherPhone: record.fatherPhone || '',
      motherName: record.motherName,
      motherPhone: record.motherPhone || '',
      selectedZone: record.selectedZone,
      selectedFellowship: record.selectedFellowship,
      dedicationYear: record.dedicationYear,
      serviceDate: record.serviceDate,
      certificateNumber: record.certificateNumber,
      officiatingMinister: record.officiatingMinister || 'Senior Pastor & Presbytery',
      notes: record.notes || ''
    });
  };

  const handleDeleteClick = async (record: PastDedicationRecord) => {
    if (window.confirm(`Are you sure you want to delete archival record for ${record.childName} (${record.certificateNumber})?`)) {
      await onDeletePastDedication(record.id);
    }
  };

  return (
    <div className="space-y-6 pb-16">
      {/* Top Banner & Header */}
      <div className="bg-gradient-to-r from-[#2a170e] via-[#3d2314] to-[#1c0d06] text-white p-6 sm:p-8 rounded-3xl shadow-xl border-2 border-[#d4af37]/50 flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-2">
          <div className="inline-flex items-center gap-2 text-xs font-bold text-[#ffd700] uppercase tracking-wider bg-[#d4af37]/20 px-3 py-1 rounded-full border border-[#d4af37]/40">
            <BookOpen className="w-3.5 h-3.5 text-[#d4af37]" /> Historical Dedications Register (Since 2009)
          </div>
          <h1 className="text-2xl sm:text-3xl font-cinzel font-bold text-white tracking-wide">
            Past Dedicated Children Archive
          </h1>
          <p className="text-xs sm:text-sm text-[#f6efe2]/80 max-w-2xl leading-relaxed">
            Historical repository of all infants dedicated at Deliverance Church Utawala from <strong>2009 to Present</strong>.
            This past database is kept <strong>strictly isolated</strong> from new ongoing parent registrations and active service compilation lists.
          </p>
          <div className="flex flex-wrap items-center gap-3 pt-2">
            <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-emerald-300 bg-emerald-950/60 border border-emerald-500/30 px-2.5 py-0.5 rounded-md">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              Isolated Archive ({pastDedications.length} total records on file)
            </span>
            <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-amber-300 bg-amber-950/60 border border-amber-500/30 px-2.5 py-0.5 rounded-md">
              <Calendar className="w-3.5 h-3.5 text-amber-400" />
              Historical Years: 2009 – {new Date().getFullYear()}
            </span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <button
            onClick={() => setShowImportModal(true)}
            className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2.5 rounded-xl font-bold text-xs sm:text-sm flex items-center gap-2 shadow-md transition-all cursor-pointer"
          >
            <Upload className="w-4 h-4" />
            Import CSV / Excel (2009+)
          </button>

          <button
            onClick={() => {
              setEditingRecord(null);
              setShowAddModal(true);
            }}
            className="bg-[#3d2314] hover:bg-[#4d2d1a] border border-[#d4af37]/60 text-[#ffd700] px-3.5 py-2.5 rounded-xl font-bold text-xs sm:text-sm flex items-center gap-2 shadow-md transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4 text-[#ffd700]" />
            Add Past Record
          </button>

          <button
            onClick={handleExportExcel}
            className="bg-[#d4af37] hover:bg-[#e8c356] text-[#2a170e] px-4 py-2.5 rounded-xl font-bold text-xs sm:text-sm flex items-center gap-2 shadow-md transition-all cursor-pointer"
          >
            <Download className="w-4 h-4 text-[#2a170e]" />
            Export Archive (Excel)
          </button>
        </div>
      </div>

      {/* Year Filter Quick-Bar */}
      <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-xs space-y-2">
        <div className="flex items-center justify-between text-xs font-bold text-gray-600 uppercase tracking-wider px-1">
          <span className="flex items-center gap-1.5">
            <Calendar className="w-4 h-4 text-[#aa8222]" /> Filter by Dedication Year (2009 to Present)
          </span>
          <span className="text-gray-400 font-normal">
            Showing {filtered.length} of {pastDedications.length} records
          </span>
        </div>
        <div className="flex items-center gap-2 overflow-x-auto pb-1 pt-1 no-scrollbar">
          <button
            onClick={() => setSelectedYear('All')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold shrink-0 transition-all cursor-pointer flex items-center gap-1.5 ${
              selectedYear === 'All'
                ? 'bg-[#2a170e] text-[#ffd700] shadow-sm'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            All Years ({pastDedications.length})
          </button>
          {availableYears.map((year) => {
            const count = yearCounts[String(year)] || 0;
            return (
              <button
                key={year}
                onClick={() => setSelectedYear(String(year))}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold shrink-0 transition-all cursor-pointer flex items-center gap-1 ${
                  selectedYear === String(year)
                    ? 'bg-[#d4af37] text-[#2a170e] shadow-sm'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                <span>{year}</span>
                {count > 0 && (
                  <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                    selectedYear === String(year) ? 'bg-[#2a170e] text-[#ffd700]' : 'bg-gray-200 text-gray-700'
                  }`}>
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Filter Row: Search, Zone, Gender */}
      <div className="bg-white p-4 sm:p-5 rounded-2xl border border-gray-200 shadow-xs grid grid-cols-1 md:grid-cols-12 gap-3">
        <div className="md:col-span-6 relative">
          <Search className="w-4 h-4 text-gray-400 absolute left-3 top-3.5" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by child name, certificate #, parent name, fellowship..."
            className="w-full pl-9 pr-3 py-2 text-xs sm:text-sm border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#d4af37] outline-hidden bg-gray-50/50"
          />
        </div>

        <div className="md:col-span-3">
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

        <div className="md:col-span-3">
          <select
            value={selectedGender}
            onChange={(e) => setSelectedGender(e.target.value)}
            className="w-full py-2 px-3 text-xs sm:text-sm border border-gray-300 rounded-xl bg-white focus:ring-2 focus:ring-[#d4af37] outline-hidden"
          >
            <option value="All">All Genders</option>
            <option value="Male">Male</option>
            <option value="Female">Female</option>
          </select>
        </div>
      </div>

      {/* Grid of Archived Records */}
      {filtered.length === 0 ? (
        <div className="bg-white p-12 rounded-3xl border border-gray-200 text-center space-y-4">
          <div className="w-16 h-16 rounded-full bg-amber-50 text-[#aa8222] flex items-center justify-center mx-auto border border-[#d4af37]/30">
            <BookOpen className="w-8 h-8 text-[#aa8222]" />
          </div>
          <h3 className="text-lg font-cinzel font-bold text-gray-800">No Past Records Found for Selected Criteria</h3>
          <p className="text-xs sm:text-sm text-gray-500 max-w-md mx-auto">
            Try adjusting your search keywords, year filter ({selectedYear}), or click <strong>"Import CSV / Excel"</strong> to upload your 2009+ dedicated children archive list.
          </p>
          <div className="flex justify-center gap-3 pt-2">
            <button
              onClick={() => {
                setSearch('');
                setSelectedZone('All');
                setSelectedYear('All');
                setSelectedGender('All');
              }}
              className="px-4 py-2 text-xs font-bold bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl cursor-pointer"
            >
              Reset Filters
            </button>
            <button
              onClick={() => setShowImportModal(true)}
              className="px-4 py-2 text-xs font-bold bg-[#d4af37] hover:bg-[#e8c356] text-[#2a170e] rounded-xl cursor-pointer"
            >
              Import 2009+ Records
            </button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((item) => (
            <div
              key={item.id}
              className="bg-white rounded-3xl p-5 sm:p-6 border-2 border-amber-200/90 hover:border-[#d4af37] shadow-xs hover:shadow-md transition-all space-y-4 flex flex-col justify-between"
            >
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-[10px] font-bold text-[#aa8222] bg-[#fbf5e6] px-2 py-0.5 rounded-md border border-[#d4af37]/30">
                        {item.certificateNumber || item.id}
                      </span>
                      <span className="text-[10px] font-bold text-purple-700 bg-purple-50 px-2 py-0.5 rounded-md border border-purple-200">
                        {item.dedicationYear || item.serviceDate?.slice(0, 4)} Dedicated
                      </span>
                    </div>
                    <h3 className="text-lg font-cinzel font-bold text-gray-900 mt-1">
                      {item.childName}
                    </h3>
                    <p className="text-[11px] text-gray-500">
                      Born: {item.childDob} ({item.childGender}) • {item.childCountyOfBirth || item.childPlaceOfBirth} County
                    </p>
                  </div>
                  <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center shrink-0">
                    <CheckCircle2 className="w-4 h-4 text-emerald-700" />
                  </div>
                </div>

                <div className="text-xs text-gray-700 space-y-1.5 bg-gray-50/80 p-3.5 rounded-2xl border border-gray-100">
                  <p>
                    <span className="text-gray-400 font-semibold">Parents:</span>{' '}
                    <strong className="text-gray-800">
                      {item.parentName || `${item.fatherName || ''} & ${item.motherName || ''}`.trim() || item.fatherName || item.motherName}
                    </strong>
                  </p>
                  {item.fatherPhone && (
                    <p className="text-[11px] text-gray-500">
                      <span className="text-gray-400">Phone:</span> {item.fatherPhone} {item.motherPhone ? `• ${item.motherPhone}` : ''}
                    </p>
                  )}
                  <p>
                    <span className="text-gray-400 font-semibold">Fellowship:</span>{' '}
                    {item.selectedFellowship} ({item.selectedZone})
                  </p>
                  <p>
                    <span className="text-gray-400 font-semibold">Dedicated On:</span>{' '}
                    <strong className="text-[#2a170e]">{item.serviceDate}</strong>
                  </p>
                  {item.officiatingMinister && (
                    <p className="text-[11px] text-gray-500">
                      <span className="text-gray-400">Minister:</span> {item.officiatingMinister}
                    </p>
                  )}
                </div>
              </div>

              {/* Bottom Actions: Certificate, Edit, Delete */}
              <div className="pt-2 flex items-center justify-between border-t border-gray-100">
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => handleEditClick(item)}
                    title="Edit Historical Record"
                    className="p-1.5 text-gray-400 hover:text-[#2a170e] hover:bg-gray-100 rounded-lg transition-all cursor-pointer"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => handleDeleteClick(item)}
                    title="Delete Archival Record"
                    className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>

                <button
                  onClick={() => handleOpenCertificate(item)}
                  className="bg-[#2a170e] hover:bg-[#3d2314] text-[#ffd700] px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-xs"
                >
                  <Award className="w-3.5 h-3.5" />
                  View Certificate
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ==================================================== */}
      {/* MODAL 1: IMPORT CSV / EXCEL ARCHIVE (2009+)          */}
      {/* ==================================================== */}
      {showImportModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="relative bg-white rounded-3xl max-w-3xl w-full p-6 sm:p-8 shadow-2xl my-8 space-y-6">
            <div className="flex items-center justify-between pb-4 border-b border-gray-200">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center">
                  <Upload className="w-5 h-5 text-emerald-700" />
                </div>
                <div>
                  <h2 className="text-xl font-cinzel font-bold text-gray-900">
                    Import Past Dedications Archive (2009 - Date)
                  </h2>
                  <p className="text-xs text-gray-500">
                    Upload your CSV or Excel file containing children dedicated since 2009.
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  setShowImportModal(false);
                  setImportedPreview([]);
                  setImportFileName('');
                }}
                className="text-gray-400 hover:text-gray-600 font-bold p-1 cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Template Download & Instructions */}
            <div className="bg-amber-50/80 p-4 rounded-2xl border border-amber-200/80 text-xs text-[#2a170e] space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-bold flex items-center gap-1.5 text-amber-900">
                  <FileSpreadsheet className="w-4 h-4 text-[#aa8222]" /> Accepted Format: CSV, XLSX, XLS
                </span>
                <button
                  onClick={handleDownloadTemplate}
                  className="text-xs font-bold text-[#aa8222] hover:text-[#2a170e] underline cursor-pointer flex items-center gap-1"
                >
                  <Download className="w-3.5 h-3.5" /> Download Sample CSV Template
                </button>
              </div>
              <p className="text-gray-600">
                Recommended columns: <strong>Child Full Name</strong>, <strong>Date of Birth</strong>, <strong>Gender</strong>, <strong>Father Name</strong>, <strong>Mother Name</strong>, <strong>Fellowship Zone</strong> (Zone A-E), <strong>Fellowship Name</strong>, <strong>Dedication Year</strong> (e.g. 2009), <strong>Dedicated Date</strong>, and <strong>Certificate No</strong>.
              </p>
            </div>

            {/* Dropzone */}
            <div className="border-2 border-dashed border-gray-300 hover:border-[#d4af37] rounded-3xl p-8 text-center space-y-3 bg-gray-50/60 transition-all">
              <Upload className="w-10 h-10 text-gray-400 mx-auto" />
              <div>
                <label className="bg-[#2a170e] hover:bg-[#3d2314] text-[#ffd700] px-5 py-2.5 rounded-xl font-bold text-xs sm:text-sm cursor-pointer shadow-md inline-block">
                  Select CSV or Excel File
                  <input
                    type="file"
                    accept=".csv, .xlsx, .xls"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                </label>
              </div>
              <p className="text-xs text-gray-500">
                {importFileName ? (
                  <span className="font-bold text-emerald-700">Selected file: {importFileName}</span>
                ) : (
                  'Or drag and drop DCU_Past_Dedications_Archive_upload.csv here'
                )}
              </p>
            </div>

            {/* Error / Success Alerts */}
            {importError && (
              <div className="p-3.5 bg-red-50 text-red-700 border border-red-200 rounded-xl text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{importError}</span>
              </div>
            )}
            {importSuccessMessage && (
              <div className="p-3.5 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-xl text-xs flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>{importSuccessMessage}</span>
              </div>
            )}

            {/* Preview of Parsed Rows */}
            {importedPreview.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-gray-700">
                    Previewing {importedPreview.length} Parsed Records (First 5 shown):
                  </span>
                  <span className="text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded-md">
                    Ready to Import
                  </span>
                </div>
                <div className="overflow-x-auto border border-gray-200 rounded-2xl max-h-48">
                  <table className="w-full text-[11px] text-left">
                    <thead className="bg-gray-100 text-gray-600 font-bold border-b border-gray-200">
                      <tr>
                        <th className="p-2">Year</th>
                        <th className="p-2">Child Name</th>
                        <th className="p-2">DOB</th>
                        <th className="p-2">Father / Mother</th>
                        <th className="p-2">Zone & Fellowship</th>
                        <th className="p-2">Cert #</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {importedPreview.slice(0, 5).map((row, idx) => (
                        <tr key={idx} className="hover:bg-gray-50">
                          <td className="p-2 font-bold text-purple-700">{row.dedicationYear}</td>
                          <td className="p-2 font-bold text-gray-800">{row.childName}</td>
                          <td className="p-2 text-gray-500">{row.childDob}</td>
                          <td className="p-2 text-gray-600">{row.fatherName || row.motherName}</td>
                          <td className="p-2 text-gray-600">{row.selectedFellowship} ({row.selectedZone})</td>
                          <td className="p-2 font-mono text-[10px] text-amber-700">{row.certificateNumber}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Modal Footer */}
            <div className="flex items-center justify-end gap-3 pt-3 border-t border-gray-200">
              <button
                type="button"
                onClick={() => {
                  setShowImportModal(false);
                  setImportedPreview([]);
                }}
                className="px-4 py-2 rounded-xl text-xs font-bold text-gray-600 hover:bg-gray-100 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmImport}
                disabled={importedPreview.length === 0 || isImporting}
                className="bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white px-5 py-2.5 rounded-xl font-bold text-xs sm:text-sm flex items-center gap-2 cursor-pointer shadow-md"
              >
                {isImporting ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    Importing {importedPreview.length} Records...
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4" />
                    Confirm & Import {importedPreview.length} Past Records
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================== */}
      {/* MODAL 2: ADD / EDIT SINGLE HISTORICAL RECORD         */}
      {/* ==================================================== */}
      {(showAddModal || editingRecord) && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="relative bg-white rounded-3xl max-w-2xl w-full p-6 sm:p-8 shadow-2xl my-8 space-y-6">
            <div className="flex items-center justify-between pb-4 border-b border-gray-200">
              <div>
                <h2 className="text-xl font-cinzel font-bold text-gray-900">
                  {editingRecord ? 'Edit Historical Record' : 'Add Past Dedicated Child (2009+)'}
                </h2>
                <p className="text-xs text-gray-500">
                  Record dedicated children from older church paper registers or archives.
                </p>
              </div>
              <button
                onClick={() => {
                  setShowAddModal(false);
                  setEditingRecord(null);
                }}
                className="text-gray-400 hover:text-gray-600 font-bold p-1 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveSingleRecord} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">
                    Child Full Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.childName || ''}
                    onChange={(e) => setFormData({ ...formData, childName: e.target.value })}
                    placeholder="e.g. Samuel Mwangi Kariuki"
                    className="w-full px-3 py-2 text-xs sm:text-sm border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#d4af37] outline-hidden"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">
                    Dedication Year (2009 to Present) *
                  </label>
                  <input
                    type="number"
                    min="2000"
                    max={new Date().getFullYear()}
                    required
                    value={formData.dedicationYear || 2009}
                    onChange={(e) => setFormData({ ...formData, dedicationYear: Number(e.target.value) })}
                    className="w-full px-3 py-2 text-xs sm:text-sm border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#d4af37] outline-hidden"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">
                    Date of Birth
                  </label>
                  <input
                    type="date"
                    value={formData.childDob || ''}
                    onChange={(e) => setFormData({ ...formData, childDob: e.target.value })}
                    className="w-full px-3 py-2 text-xs sm:text-sm border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#d4af37] outline-hidden"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">
                    Gender
                  </label>
                  <select
                    value={formData.childGender || 'Male'}
                    onChange={(e) => setFormData({ ...formData, childGender: e.target.value as any })}
                    className="w-full px-3 py-2 text-xs sm:text-sm border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#d4af37] outline-hidden"
                  >
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">
                    County of Birth
                  </label>
                  <input
                    type="text"
                    value={formData.childCountyOfBirth || 'Nairobi'}
                    onChange={(e) => setFormData({ ...formData, childCountyOfBirth: e.target.value })}
                    placeholder="e.g. Nairobi, Kiambu, Machakos"
                    className="w-full px-3 py-2 text-xs sm:text-sm border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#d4af37] outline-hidden"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">
                    Dedication Sunday Service Date
                  </label>
                  <input
                    type="date"
                    value={formData.serviceDate || '2009-08-30'}
                    onChange={(e) => setFormData({ ...formData, serviceDate: e.target.value })}
                    className="w-full px-3 py-2 text-xs sm:text-sm border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#d4af37] outline-hidden"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">
                    Father's Name
                  </label>
                  <input
                    type="text"
                    value={formData.fatherName || ''}
                    onChange={(e) => setFormData({ ...formData, fatherName: e.target.value })}
                    placeholder="Father full name"
                    className="w-full px-3 py-2 text-xs sm:text-sm border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#d4af37] outline-hidden"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">
                    Mother's Name
                  </label>
                  <input
                    type="text"
                    value={formData.motherName || ''}
                    onChange={(e) => setFormData({ ...formData, motherName: e.target.value })}
                    placeholder="Mother full name"
                    className="w-full px-3 py-2 text-xs sm:text-sm border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#d4af37] outline-hidden"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">
                    Fellowship Zone
                  </label>
                  <select
                    value={formData.selectedZone || 'Zone A'}
                    onChange={(e) => setFormData({ ...formData, selectedZone: e.target.value as any })}
                    className="w-full px-3 py-2 text-xs sm:text-sm border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#d4af37] outline-hidden"
                  >
                    {ZONES.map((z) => (
                      <option key={z.name} value={z.name}>{z.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">
                    Fellowship Name
                  </label>
                  <input
                    type="text"
                    value={formData.selectedFellowship || 'Doxa'}
                    onChange={(e) => setFormData({ ...formData, selectedFellowship: e.target.value })}
                    placeholder="e.g. Doxa, Neema, Dominion"
                    className="w-full px-3 py-2 text-xs sm:text-sm border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#d4af37] outline-hidden"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">
                    Certificate Number (Optional)
                  </label>
                  <input
                    type="text"
                    value={formData.certificateNumber || ''}
                    onChange={(e) => setFormData({ ...formData, certificateNumber: e.target.value })}
                    placeholder="Auto-generated if empty e.g. DCU-DED-2009-001"
                    className="w-full px-3 py-2 text-xs sm:text-sm border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#d4af37] outline-hidden font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">
                    Officiating Minister
                  </label>
                  <input
                    type="text"
                    value={formData.officiatingMinister || 'Senior Pastor & Presbytery'}
                    onChange={(e) => setFormData({ ...formData, officiatingMinister: e.target.value })}
                    placeholder="Senior Pastor & Presbytery"
                    className="w-full px-3 py-2 text-xs sm:text-sm border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#d4af37] outline-hidden"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  Archival Notes / Registry Reference
                </label>
                <input
                  type="text"
                  value={formData.notes || ''}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="e.g. Church Dedication Ledger Vol 1, Page 42"
                  className="w-full px-3 py-2 text-xs sm:text-sm border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#d4af37] outline-hidden"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-200">
                <button
                  type="button"
                  onClick={() => {
                    setShowAddModal(false);
                    setEditingRecord(null);
                  }}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-gray-600 hover:bg-gray-100 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="bg-[#2a170e] hover:bg-[#3d2314] text-[#ffd700] px-5 py-2.5 rounded-xl font-bold text-xs sm:text-sm flex items-center gap-1.5 cursor-pointer shadow-md"
                >
                  <Check className="w-4 h-4 text-[#ffd700]" />
                  {editingRecord ? 'Save Changes' : 'Add to Past Archive'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
