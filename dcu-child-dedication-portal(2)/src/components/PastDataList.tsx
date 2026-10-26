import React, { useState, useMemo } from 'react';
import * as XLSX from 'xlsx';
import { PastDedicationRecord, DedicationRecord } from '../types';
import { ZONES } from '../data/zones';
import { api } from '../services/api';
import { 
  Download, Upload, Search, Award, CheckCircle2, Calendar, Phone, 
  MapPin, Printer, BookOpen, Plus, Filter, Database, FileSpreadsheet,
  AlertCircle, Trash2, Edit3, X, Check, RefreshCw, SlidersHorizontal,
  ArrowRight, ShieldCheck, Sparkles, ChevronDown, ChevronUp, Layers
} from 'lucide-react';

interface PastDataListProps {
  pastDedications: PastDedicationRecord[];
  onAddPastDedication: (rec: Partial<PastDedicationRecord>) => Promise<void>;
  onBulkImportPast: (records: any[], options?: { replaceYear?: number; replaceAll?: boolean }) => Promise<void>;
  onUpdatePastDedication: (id: string, updates: Partial<PastDedicationRecord>) => Promise<void>;
  onDeletePastDedication: (id: string) => Promise<void>;
  onOpenCertificate: (record: DedicationRecord) => void;
}

// -------------------------------------------------------------
// Helper: Robust Historical Date Parser
// Strictly preserves original dates from old church files
// Supports Excel serials, Kenyan/UK DD/MM/YYYY, ISO, textual dates
// -------------------------------------------------------------
export function parseHistoricalDate(raw: any, fallbackYear = 2009): { dateStr: string; year: number; rawOriginal: string } {
  if (raw === null || raw === undefined || raw === '') {
    return { dateStr: `${fallbackYear}`, year: fallbackYear, rawOriginal: '' };
  }

  const rawOriginal = String(raw).trim();

  // If already number (Excel serial date)
  if (typeof raw === 'number') {
    if (raw > 20000 && raw < 70000) {
      try {
        const utc_days = Math.floor(raw - 25569);
        const date_info = new Date(utc_days * 86400 * 1000);
        const y = date_info.getUTCFullYear();
        const m = String(date_info.getUTCMonth() + 1).padStart(2, '0');
        const d = String(date_info.getUTCDate()).padStart(2, '0');
        return { dateStr: `${y}-${m}-${d}`, year: y, rawOriginal };
      } catch {
        // pass
      }
    } else if (raw >= 1990 && raw <= 2050) {
      return { dateStr: `${raw}`, year: raw, rawOriginal };
    }
  }

  let str = rawOriginal;

  // Check if string is a 5-digit Excel serial code like "40146"
  if (/^\d{5}$/.test(str)) {
    const num = parseInt(str, 10);
    if (num > 20000 && num < 70000) {
      const utc_days = Math.floor(num - 25569);
      const date_info = new Date(utc_days * 86400 * 1000);
      const y = date_info.getUTCFullYear();
      const m = String(date_info.getUTCMonth() + 1).padStart(2, '0');
      const d = String(date_info.getUTCDate()).padStart(2, '0');
      return { dateStr: `${y}-${m}-${d}`, year: y, rawOriginal };
    }
  }

  // 1. ISO format: YYYY-MM-DD or YYYY/MM/DD
  const isoMatch = str.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
  if (isoMatch) {
    const y = parseInt(isoMatch[1], 10);
    const m = isoMatch[2].padStart(2, '0');
    const d = isoMatch[3].padStart(2, '0');
    return { dateStr: `${y}-${m}-${d}`, year: y, rawOriginal };
  }

  // 2. Day-Month-Year format (DD/MM/YYYY or DD-MM-YYYY or DD.MM.YYYY) - Standard in Kenya
  const dmyMatch = str.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})/);
  if (dmyMatch) {
    const d = dmyMatch[1].padStart(2, '0');
    const m = dmyMatch[2].padStart(2, '0');
    const y = parseInt(dmyMatch[3], 10);
    const numD = parseInt(d, 10);
    const numM = parseInt(m, 10);
    if (numM <= 12 && numD <= 31) {
      return { dateStr: `${y}-${m}-${d}`, year: y, rawOriginal };
    } else if (numD <= 12 && numM <= 31) {
      // Swapped US format: MM/DD/YYYY
      return { dateStr: `${y}-${d}-${m}`, year: y, rawOriginal };
    }
  }

  // 3. Textual dates: "29th November 2009", "29 Nov 2009", "Nov 29, 2009"
  const months: Record<string, string> = {
    jan: '01', january: '01',
    feb: '02', february: '02',
    mar: '03', march: '03',
    apr: '04', april: '04',
    may: '05',
    jun: '06', june: '06',
    jul: '07', july: '07',
    aug: '08', august: '08',
    sep: '09', sept: '09', september: '09',
    oct: '10', october: '10',
    nov: '11', november: '11',
    dec: '12', december: '12'
  };

  const textMatch1 = str.match(/(\d{1,2})(?:st|nd|rd|th)?[\s\-_]+([A-Za-z]+)[\s\-_]+(\d{4})/i);
  if (textMatch1) {
    const d = textMatch1[1].padStart(2, '0');
    const monName = textMatch1[2].toLowerCase();
    const y = parseInt(textMatch1[3], 10);
    const m = months[monName] || months[monName.slice(0, 3)];
    if (m) {
      return { dateStr: `${y}-${m}-${d}`, year: y, rawOriginal };
    }
  }

  const textMatch2 = str.match(/([A-Za-z]+)[\s\-_]+(\d{1,2})(?:st|nd|rd|th)?[\s\-_,]+(\d{4})/i);
  if (textMatch2) {
    const monName = textMatch2[1].toLowerCase();
    const d = textMatch2[2].padStart(2, '0');
    const y = parseInt(textMatch2[3], 10);
    const m = months[monName] || months[monName.slice(0, 3)];
    if (m) {
      return { dateStr: `${y}-${m}-${d}`, year: y, rawOriginal };
    }
  }

  // 4. Year detection fallback
  const yearMatch = str.match(/\b(19\d\d|20\d\d)\b/);
  const foundYear = yearMatch ? parseInt(yearMatch[0], 10) : fallbackYear;

  // Preserve the original text verbatim rather than replacing it with an invented date
  return { dateStr: str, year: foundYear, rawOriginal };
}

// -------------------------------------------------------------
// Helper: Clean Display for Fellowship & Zone
// Avoids ugly forced placeholders like "Fellowship (Zone A)"
// -------------------------------------------------------------
function formatFellowshipDisplay(fellowship?: string, zone?: string): string {
  const cleanF = (fellowship || '').trim();
  const cleanZ = (zone || '').trim();
  const isGenericF = !cleanF || cleanF.toLowerCase() === 'fellowship';
  const isGenericZ = !cleanZ || cleanZ.toLowerCase() === 'zone a' || cleanZ.toLowerCase() === 'unallocated';

  if (cleanF && !isGenericF && cleanZ && !isGenericZ && cleanF.toLowerCase() !== cleanZ.toLowerCase()) {
    return `${cleanF} (${cleanZ})`;
  }
  if (cleanF && !isGenericF) {
    return cleanF;
  }
  if (cleanZ && !isGenericZ) {
    return cleanZ;
  }
  return 'Deliverance Church Utawala';
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

  // Raw file & interactive mapping state
  const [rawFileRows, setRawFileRows] = useState<any[]>([]);
  const [fileColumns, setFileColumns] = useState<string[]>([]);
  const [columnMapping, setColumnMapping] = useState<Record<string, string>>({});
  const [showMapperConfig, setShowMapperConfig] = useState(false);
  const [importMode, setImportMode] = useState<'append' | 'replace_2009' | 'replace_all'>('append');

  // Preview & progress state
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
    selectedZone: '',
    selectedFellowship: 'Deliverance Church Utawala',
    dedicationYear: 2009,
    serviceDate: '2009',
    certificateNumber: '',
    officiatingMinister: '',
    notes: 'Historical church register entry'
  });

  // Calculate unique years available in dataset (sorted descending)
  const availableYears = useMemo(() => {
    const yearsSet = new Set<number>();
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
        (d.officiatingMinister && d.officiatingMinister.toLowerCase().includes(q)) ||
        (d.serviceDate && d.serviceDate.toLowerCase().includes(q)) ||
        (d.notes && d.notes.toLowerCase().includes(q));

      return matchesYear && matchesZone && matchesGender && matchesSearch;
    });
  }, [pastDedications, search, selectedZone, selectedYear, selectedGender]);

  // Convert PastDedicationRecord to DedicationRecord for certificate modal
  const handleOpenCertificate = (past: PastDedicationRecord) => {
    const certRecord: DedicationRecord = {
      id: past.id,
      childName: past.childName,
      childDob: past.childDob || `${past.dedicationYear || 2009}`,
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
      selectedZone: (past.selectedZone as any) || 'Unallocated',
      selectedFellowship: past.selectedFellowship || 'Deliverance Church Utawala',
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
      'County of Birth': d.childCountyOfBirth || d.childPlaceOfBirth || 'Nairobi',
      'Father Name': d.fatherName,
      'Father Phone': d.fatherPhone || '',
      'Mother Name': d.motherName,
      'Mother Phone': d.motherPhone || '',
      'Fellowship Zone': d.selectedZone || '',
      'Fellowship Name': d.selectedFellowship,
      'Officiating Minister': d.officiatingMinister || '',
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
    api.logExport('past_dedications_archive_excel', exportData.length);
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
        'Officiating Minister': 'Senior Pastor',
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
        'Officiating Minister': 'Presbytery Pastors',
        'Notes': 'Historic 2010 Register'
      }
    ];

    const worksheet = XLSX.utils.json_to_sheet(sampleRows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Sample_Template');
    XLSX.writeFile(workbook, 'DCU_Past_Dedications_Upload_Template.xlsx');
  };

  // Find best match for a field among available column headers
  const autoDetectColumn = (headers: string[], synonyms: string[]): string => {
    for (const syn of synonyms) {
      const found = headers.find(h => h.trim().toLowerCase() === syn.toLowerCase());
      if (found) return found;
    }
    // Partial inclusion
    for (const syn of synonyms) {
      const found = headers.find(h => h.trim().toLowerCase().includes(syn.toLowerCase()));
      if (found) return found;
    }
    return '';
  };

  // Re-map rows using current column mapping without altering user data
  const buildParsedRows = (rows: any[], mapping: Record<string, string>, fileName: string) => {
    return rows.map((row: any, idx: number) => {
      // 1. Dedication Date - strictly preserve original date from file
      const rawDateVal = mapping.serviceDate ? row[mapping.serviceDate] : (row['Dedicated Date'] || row['Dedication Date'] || row['Date'] || '');
      const parsedDate = parseHistoricalDate(rawDateVal, 2009);

      // Explicit year column if present
      let dedicationYear = mapping.dedicationYear && row[mapping.dedicationYear]
        ? parseInt(String(row[mapping.dedicationYear]), 10)
        : parsedDate.year;

      if (isNaN(dedicationYear) || !dedicationYear) dedicationYear = 2009;

      // 2. Child Name
      const childName = (mapping.childName && row[mapping.childName] ? row[mapping.childName] : (row['Child Full Name'] || row['Child Name'] || row['Name'] || `Child ${idx + 1}`)).toString().trim();

      // 3. Child DOB
      const rawDobVal = mapping.childDob ? row[mapping.childDob] : (row['Date of Birth'] || row['DOB'] || '');
      const parsedDob = rawDobVal ? parseHistoricalDate(rawDobVal, dedicationYear).dateStr : '';

      // 4. Gender
      const rawGender = (mapping.childGender && row[mapping.childGender] ? row[mapping.childGender] : (row['Gender'] || row['Sex'] || '')).toString().trim().toLowerCase();
      const childGender = rawGender.startsWith('f') || rawGender.includes('girl') ? 'Female' : 'Male';

      // 5. Parents / Father / Mother
      let father = (mapping.fatherName && row[mapping.fatherName] ? row[mapping.fatherName] : (row['Father Name'] || row['Father'] || '')).toString().trim();
      let mother = (mapping.motherName && row[mapping.motherName] ? row[mapping.motherName] : (row['Mother Name'] || row['Mother'] || '')).toString().trim();
      let parentField = (mapping.parents && row[mapping.parents] ? row[mapping.parents] : (row['Parents'] || row['Parent Name'] || '')).toString().trim();

      // If single Parents column given, split if it has & or and
      if (!father && !mother && parentField) {
        if (parentField.includes('&')) {
          const parts = parentField.split('&');
          father = parts[0]?.trim() || '';
          mother = parts[1]?.trim() || '';
        } else if (parentField.toLowerCase().includes(' and ')) {
          const parts = parentField.split(/ and /i);
          father = parts[0]?.trim() || '';
          mother = parts[1]?.trim() || '';
        }
      }

      const parentName = parentField || (father && mother ? `${father} & ${mother}` : father || mother || '');

      // 6. Fellowship & Zone
      const rawFellowship = (mapping.selectedFellowship && row[mapping.selectedFellowship] ? row[mapping.selectedFellowship] : (row['Fellowship Name'] || row['Fellowship'] || row['Cell'] || row['Residence'] || '')).toString().trim();
      const fellowship = rawFellowship.toLowerCase() === 'fellowship' ? 'Deliverance Church Utawala' : (rawFellowship || 'Deliverance Church Utawala');

      const rawZone = (mapping.selectedZone && row[mapping.selectedZone] ? row[mapping.selectedZone] : (row['Fellowship Zone'] || row['Zone'] || '')).toString().trim();
      // Only keep Zone if explicitly provided in file, don't force Zone A
      const matchedZone = ['Zone A', 'Zone B', 'Zone C', 'Zone D', 'Zone E'].find(
        z => z.toLowerCase() === rawZone.toLowerCase()
      ) || (rawZone && rawZone.toLowerCase() !== 'zone a' ? rawZone : '');

      // 7. Officiating Minister - preserve verbatim from file
      const minister = (mapping.officiatingMinister && row[mapping.officiatingMinister] ? row[mapping.officiatingMinister] : (row['Officiating Minister'] || row['Minister'] || row['Pastor'] || row['Officiated By'] || '')).toString().trim();

      // 8. Certificate Number - preserve verbatim
      const certNo = (mapping.certificateNumber && row[mapping.certificateNumber] ? row[mapping.certificateNumber] : (row['Certificate No'] || row['Certificate Number'] || row['Cert No'] || row['Certificate'] || '')).toString().trim() ||
        `DCU-DED-${dedicationYear}-${String(idx + 101).padStart(3, '0')}`;

      // 9. County / Place of Birth
      const county = (mapping.childCountyOfBirth && row[mapping.childCountyOfBirth] ? row[mapping.childCountyOfBirth] : (row['County of Birth'] || row['County'] || row['Place of Birth'] || 'Nairobi')).toString().trim();

      // 10. Notes / Archival source
      const notes = (mapping.notes && row[mapping.notes] ? row[mapping.notes] : (row['Notes'] || row['Remarks'] || '')).toString().trim() || 'Historical church register import';

      return {
        id: `HIST-${dedicationYear}-${String(Date.now()).slice(-4)}-${idx + 1}`,
        childName,
        childDob: parsedDob || `${dedicationYear}`,
        childGender,
        childCountyOfBirth: county,
        childPlaceOfBirth: county,
        fatherName: father,
        fatherPhone: (mapping.fatherPhone && row[mapping.fatherPhone] ? row[mapping.fatherPhone] : (row['Father Phone'] || row['Phone'] || row['Contact'] || '')).toString().trim(),
        motherName: mother,
        motherPhone: (mapping.motherPhone && row[mapping.motherPhone] ? row[mapping.motherPhone] : (row['Mother Phone'] || '')).toString().trim(),
        parentName,
        parentPhone: (row['Parent Phone'] || row['Phone'] || row['Contact'] || '').toString().trim(),
        selectedZone: matchedZone || 'Unallocated',
        selectedFellowship: fellowship,
        dedicationYear,
        serviceDate: parsedDate.dateStr,
        originalDateRaw: parsedDate.rawOriginal,
        certificateNumber: certNo,
        certificateIssued: true,
        officiatingMinister: minister || '',
        notes,
        archivalSource: fileName || 'Historical 2009+ Register',
        rawRowData: row
      };
    });
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
        const workbook = XLSX.read(bstr, { type: 'binary', cellDates: false });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        const rawJson: any[] = XLSX.utils.sheet_to_json(worksheet, { defval: '' });

        if (!rawJson || rawJson.length === 0) {
          setImportError('The uploaded file is empty or does not contain valid data rows.');
          return;
        }

        const headers = Object.keys(rawJson[0] || {});
        setFileColumns(headers);
        setRawFileRows(rawJson);

        // Auto-detect columns intelligently
        const initialMapping: Record<string, string> = {
          serviceDate: autoDetectColumn(headers, [
            'Dedicated Date', 'Dedication Date', 'Date Dedicated', 'Date of Dedication',
            'Service Date', 'Dedication Sunday', 'Date', 'Dedication', 'Dedicated On', 'D.O.D', 'Ded Date'
          ]),
          childName: autoDetectColumn(headers, [
            'Child Full Name', 'Child Name', "Child's Name", 'Name of Child', 'Full Name', 'Name', 'Candidate', 'Baby Name'
          ]),
          childDob: autoDetectColumn(headers, [
            'Date of Birth', 'DOB', 'D.O.B', 'Birth Date', 'Birthdate', 'Child DOB'
          ]),
          childGender: autoDetectColumn(headers, [
            'Gender', 'Sex', 'Child Gender', 'M/F'
          ]),
          parents: autoDetectColumn(headers, [
            'Parents', 'Parent Name', "Parents' Names", 'Parents Names', 'Father & Mother', 'Parent / Guardian'
          ]),
          fatherName: autoDetectColumn(headers, [
            'Father Name', "Father's Name", 'Father', 'Dad', 'Father Full Name'
          ]),
          fatherPhone: autoDetectColumn(headers, [
            'Father Phone', 'Phone', 'Phone Number', 'Contact', 'Mobile', 'Tel', 'Contacts'
          ]),
          motherName: autoDetectColumn(headers, [
            'Mother Name', "Mother's Name", 'Mother', 'Mom', 'Mother Full Name'
          ]),
          motherPhone: autoDetectColumn(headers, [
            'Mother Phone', 'Mother Mobile'
          ]),
          selectedFellowship: autoDetectColumn(headers, [
            'Fellowship Name', 'Fellowship', 'Cell', 'Cell Group', 'Home Fellowship', 'Residence', 'Estate', 'Area', 'Location'
          ]),
          selectedZone: autoDetectColumn(headers, [
            'Fellowship Zone', 'Zone', 'District', 'Region'
          ]),
          officiatingMinister: autoDetectColumn(headers, [
            'Officiating Minister', 'Minister', 'Pastor', 'Officiated By', 'Presiding Minister', 'Clergy', 'Officiating Pastor'
          ]),
          certificateNumber: autoDetectColumn(headers, [
            'Certificate No', 'Certificate Number', 'Cert No', 'Cert #', 'Certificate', 'Reg No', 'Serial No', 'S/No'
          ]),
          childCountyOfBirth: autoDetectColumn(headers, [
            'County of Birth', 'County', 'Place of Birth', 'Birth Place', 'Town'
          ]),
          dedicationYear: autoDetectColumn(headers, [
            'Dedication Year', 'Year', 'Dedication_Year'
          ]),
          notes: autoDetectColumn(headers, [
            'Notes', 'Remarks', 'Comments', 'Details', 'Source'
          ])
        };

        setColumnMapping(initialMapping);

        // Pre-parse rows with detected mapping
        const parsed = buildParsedRows(rawJson, initialMapping, file.name);
        setImportedPreview(parsed);
      } catch (err: any) {
        console.error('File parsing error', err);
        setImportError(`Could not parse file: ${err.message || 'Check CSV/Excel format.'}`);
      }
    };
    reader.readAsBinaryString(file);
  };

  // Re-calculate preview when column mapping changes
  const handleUpdateMapping = (field: string, selectedHeader: string) => {
    const updated = { ...columnMapping, [field]: selectedHeader };
    setColumnMapping(updated);
    if (rawFileRows.length > 0) {
      const parsed = buildParsedRows(rawFileRows, updated, importFileName);
      setImportedPreview(parsed);
    }
  };

  // Submit Bulk Import
  const handleConfirmImport = async () => {
    if (importedPreview.length === 0) return;
    setIsImporting(true);
    setImportError('');
    try {
      const options = {
        replaceYear: importMode === 'replace_2009' ? 2009 : undefined,
        replaceAll: importMode === 'replace_all'
      };

      await onBulkImportPast(importedPreview, options);

      const msg = importMode === 'replace_2009'
        ? `Successfully replaced 2009 archival records with ${importedPreview.length} clean, original records!`
        : `Successfully imported ${importedPreview.length} historical records into the Past Dedicated Archive!`;

      setImportSuccessMessage(msg);

      setTimeout(() => {
        setShowImportModal(false);
        setImportedPreview([]);
        setRawFileRows([]);
        setImportFileName('');
        setImportSuccessMessage('');
      }, 1500);
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

    const dedicationYear = Number(formData.dedicationYear) || 2009;
    const certNo = formData.certificateNumber || `DCU-DED-${dedicationYear}-${String(Date.now()).slice(-4)}`;
    const now = new Date().toISOString();

    const recordData: Partial<PastDedicationRecord> = {
      ...formData,
      dedicationYear,
      certificateNumber: certNo,
      certificateIssued: true,
      parentName: formData.parentName || `${formData.fatherName || ''} & ${formData.motherName || ''}`.trim() || formData.fatherName || formData.motherName,
      selectedFellowship: formData.selectedFellowship || 'Deliverance Church Utawala',
      selectedZone: formData.selectedZone || 'Unallocated',
      serviceDate: formData.serviceDate || `${dedicationYear}`,
      officiatingMinister: formData.officiatingMinister || '',
      updatedAt: now
    };

    if (editingRecord) {
      await onUpdatePastDedication(editingRecord.id, recordData);
      setEditingRecord(null);
    } else {
      await onAddPastDedication({
        ...recordData,
        id: `HIST-${dedicationYear}-${String(Date.now()).slice(-4)}`,
        createdAt: now
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
      selectedZone: '',
      selectedFellowship: 'Deliverance Church Utawala',
      dedicationYear: 2009,
      serviceDate: '2009',
      certificateNumber: '',
      officiatingMinister: '',
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
      selectedZone: record.selectedZone || '',
      selectedFellowship: record.selectedFellowship,
      dedicationYear: record.dedicationYear,
      serviceDate: record.serviceDate,
      certificateNumber: record.certificateNumber,
      officiatingMinister: record.officiatingMinister || '',
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
            Preserves <strong>original dates, fellowships, ministers, and records</strong> without automated alterations.
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
            Import / Rearrange CSV (2009+)
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
                : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
            }`}
          >
            All Years ({pastDedications.length})
          </button>
          {availableYears.map((yr) => {
            const count = yearCounts[String(yr)] || 0;
            return (
              <button
                key={yr}
                onClick={() => setSelectedYear(String(yr))}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold shrink-0 transition-all cursor-pointer flex items-center gap-1.5 ${
                  selectedYear === String(yr)
                    ? 'bg-[#d4af37] text-[#2a170e] shadow-sm ring-2 ring-[#2a170e]'
                    : count > 0
                    ? 'bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200'
                    : 'bg-gray-50 text-gray-400 hover:bg-gray-100'
                }`}
              >
                <span>{yr}</span>
                {count > 0 && (
                  <span className="px-1.5 py-0.2 bg-[#2a170e] text-[#ffd700] rounded-full text-[10px]">
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Search & Filters */}
      <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-xs grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
        <div className="md:col-span-5 relative">
          <Search className="w-4 h-4 text-gray-400 absolute left-3 top-3" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by child name, parent, fellowship, minister, or date..."
            className="w-full pl-9 pr-3 py-2 text-xs sm:text-sm border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#d4af37] outline-hidden"
          />
        </div>

        <div className="md:col-span-4">
          <select
            value={selectedZone}
            onChange={(e) => setSelectedZone(e.target.value)}
            className="w-full py-2 px-3 text-xs sm:text-sm border border-gray-300 rounded-xl bg-white focus:ring-2 focus:ring-[#d4af37] outline-hidden"
          >
            <option value="All">All Fellowship Zones</option>
            {ZONES.map((z) => (
              <option key={z.name} value={z.name}>{z.name}</option>
            ))}
            <option value="Unallocated">Historical / Unallocated</option>
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
            Try adjusting your search keywords, year filter ({selectedYear}), or click <strong>"Import / Rearrange CSV"</strong> to upload your 2009+ dedicated children archive list.
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
                      {item.childDob ? `Born: ${item.childDob} (${item.childGender})` : `Gender: ${item.childGender}`} • {item.childCountyOfBirth || item.childPlaceOfBirth || 'Nairobi'} County
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
                      {item.parentName || `${item.fatherName || ''} & ${item.motherName || ''}`.trim() || item.fatherName || item.motherName || 'Parent not specified'}
                    </strong>
                  </p>
                  {(item.fatherPhone || item.motherPhone || item.parentPhone) && (
                    <p className="text-[11px] text-gray-500">
                      <span className="text-gray-400">Phone:</span> {item.fatherPhone || item.parentPhone || ''} {item.motherPhone ? `• ${item.motherPhone}` : ''}
                    </p>
                  )}
                  <p>
                    <span className="text-gray-400 font-semibold">Fellowship / Location:</span>{' '}
                    <span className="font-medium text-gray-800">
                      {formatFellowshipDisplay(item.selectedFellowship, item.selectedZone)}
                    </span>
                  </p>
                  <p>
                    <span className="text-gray-400 font-semibold">Dedicated On:</span>{' '}
                    <strong className="text-[#2a170e] font-mono bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200/60">
                      {item.serviceDate || `${item.dedicationYear}`}
                    </strong>
                  </p>
                  {item.officiatingMinister && (
                    <p className="text-[11px] text-gray-600">
                      <span className="text-gray-400 font-semibold">Minister:</span>{' '}
                      <span className="font-medium">{item.officiatingMinister}</span>
                    </p>
                  )}
                  {item.notes && item.notes !== 'Historical church register entry' && (
                    <p className="text-[10px] text-gray-400 italic">
                      Ref: {item.notes}
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
      {/* MODAL 1: IMPORT & REARRANGE CSV / EXCEL ARCHIVE      */}
      {/* ==================================================== */}
      {showImportModal && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="relative bg-white rounded-3xl max-w-4xl w-full p-6 sm:p-8 shadow-2xl my-8 space-y-6 max-h-[92vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-4 border-b border-gray-200">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center">
                  <FileSpreadsheet className="w-5 h-5 text-emerald-700" />
                </div>
                <div>
                  <h2 className="text-xl font-cinzel font-bold text-gray-900">
                    Import Historical Dedicated Children (2009+)
                  </h2>
                  <p className="text-xs text-gray-500">
                    Upload and flexibly rearrange old registers while strictly preserving original dates and data.
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  setShowImportModal(false);
                  setImportedPreview([]);
                  setRawFileRows([]);
                  setImportFileName('');
                }}
                className="text-gray-400 hover:text-gray-600 font-bold p-1 cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Template Download & Notice */}
            <div className="bg-amber-50/90 p-4 rounded-2xl border border-amber-200/90 text-xs text-[#2a170e] space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-bold flex items-center gap-1.5 text-amber-900">
                  <ShieldCheck className="w-4 h-4 text-emerald-600" /> Original Data Preservation Policy
                </span>
                <button
                  onClick={handleDownloadTemplate}
                  className="text-xs font-bold text-[#aa8222] hover:text-[#2a170e] underline cursor-pointer flex items-center gap-1"
                >
                  <Download className="w-3.5 h-3.5" /> Download Reference Template
                </button>
              </div>
              <p className="text-gray-700 leading-relaxed">
                The system automatically detects columns from your 2009 CSV file and rearranges them to fill the archive properly.
                <strong> Original dates, ministers, and fellowships are faithfully preserved</strong> — the system will not overwrite your dates with defaults.
              </p>
            </div>

            {/* Dropzone */}
            <div className="border-2 border-dashed border-gray-300 hover:border-[#d4af37] rounded-3xl p-6 sm:p-8 text-center space-y-3 bg-gray-50/60 transition-all">
              <Upload className="w-8 h-8 text-gray-400 mx-auto" />
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
                  <span className="font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-md border border-emerald-200 inline-block">
                    ✓ Loaded File: {importFileName} ({rawFileRows.length} rows detected)
                  </span>
                ) : (
                  'Drag and drop your 2009 dedicated children CSV or click above to browse'
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

            {/* ========================================================= */}
            {/* COLUMN REARRANGEMENT / MAPPING INTERFACE                 */}
            {/* ========================================================= */}
            {fileColumns.length > 0 && (
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 sm:p-5 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-3">
                  <div className="flex items-center gap-2">
                    <SlidersHorizontal className="w-4 h-4 text-[#aa8222]" />
                    <h3 className="font-bold text-sm text-gray-900">
                      Rearrange File Columns to Fill Archive Fields
                    </h3>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowMapperConfig(!showMapperConfig)}
                    className="text-xs font-bold text-[#aa8222] hover:text-[#2a170e] flex items-center gap-1 cursor-pointer"
                  >
                    {showMapperConfig ? 'Hide Column Adjustments' : 'Adjust Column Mapping'}
                    {showMapperConfig ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                  </button>
                </div>

                {/* Mapping dropdowns */}
                {showMapperConfig && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3.5 pt-2">
                    {/* Dedication Date */}
                    <div className="space-y-1">
                      <label className="block text-[11px] font-bold text-gray-700">
                        Dedicated Date * (Preserves exact date)
                      </label>
                      <select
                        value={columnMapping.serviceDate || ''}
                        onChange={(e) => handleUpdateMapping('serviceDate', e.target.value)}
                        className="w-full text-xs p-2 border border-gray-300 rounded-xl bg-white"
                      >
                        <option value="">-- Leave Blank / Extract Year --</option>
                        {fileColumns.map(col => (
                          <option key={col} value={col}>
                            {col} {rawFileRows[0]?.[col] ? `(e.g. "${rawFileRows[0][col]}")` : ''}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Child Name */}
                    <div className="space-y-1">
                      <label className="block text-[11px] font-bold text-gray-700">
                        Child Full Name *
                      </label>
                      <select
                        value={columnMapping.childName || ''}
                        onChange={(e) => handleUpdateMapping('childName', e.target.value)}
                        className="w-full text-xs p-2 border border-gray-300 rounded-xl bg-white"
                      >
                        <option value="">-- Select Column --</option>
                        {fileColumns.map(col => (
                          <option key={col} value={col}>
                            {col} {rawFileRows[0]?.[col] ? `(e.g. "${rawFileRows[0][col]}")` : ''}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Parents Column (Composite) */}
                    <div className="space-y-1">
                      <label className="block text-[11px] font-bold text-gray-700">
                        Parents / Family (Composite)
                      </label>
                      <select
                        value={columnMapping.parents || ''}
                        onChange={(e) => handleUpdateMapping('parents', e.target.value)}
                        className="w-full text-xs p-2 border border-gray-300 rounded-xl bg-white"
                      >
                        <option value="">-- None (Use Father/Mother) --</option>
                        {fileColumns.map(col => (
                          <option key={col} value={col}>
                            {col} {rawFileRows[0]?.[col] ? `(e.g. "${rawFileRows[0][col]}")` : ''}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Father Name */}
                    <div className="space-y-1">
                      <label className="block text-[11px] font-bold text-gray-700">
                        Father's Name
                      </label>
                      <select
                        value={columnMapping.fatherName || ''}
                        onChange={(e) => handleUpdateMapping('fatherName', e.target.value)}
                        className="w-full text-xs p-2 border border-gray-300 rounded-xl bg-white"
                      >
                        <option value="">-- None --</option>
                        {fileColumns.map(col => (
                          <option key={col} value={col}>
                            {col} {rawFileRows[0]?.[col] ? `(e.g. "${rawFileRows[0][col]}")` : ''}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Mother Name */}
                    <div className="space-y-1">
                      <label className="block text-[11px] font-bold text-gray-700">
                        Mother's Name
                      </label>
                      <select
                        value={columnMapping.motherName || ''}
                        onChange={(e) => handleUpdateMapping('motherName', e.target.value)}
                        className="w-full text-xs p-2 border border-gray-300 rounded-xl bg-white"
                      >
                        <option value="">-- None --</option>
                        {fileColumns.map(col => (
                          <option key={col} value={col}>
                            {col} {rawFileRows[0]?.[col] ? `(e.g. "${rawFileRows[0][col]}")` : ''}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Phone / Contact */}
                    <div className="space-y-1">
                      <label className="block text-[11px] font-bold text-gray-700">
                        Phone / Contact
                      </label>
                      <select
                        value={columnMapping.fatherPhone || ''}
                        onChange={(e) => handleUpdateMapping('fatherPhone', e.target.value)}
                        className="w-full text-xs p-2 border border-gray-300 rounded-xl bg-white"
                      >
                        <option value="">-- None --</option>
                        {fileColumns.map(col => (
                          <option key={col} value={col}>
                            {col} {rawFileRows[0]?.[col] ? `(e.g. "${rawFileRows[0][col]}")` : ''}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Fellowship / Residence */}
                    <div className="space-y-1">
                      <label className="block text-[11px] font-bold text-gray-700">
                        Fellowship / Cell / Estate
                      </label>
                      <select
                        value={columnMapping.selectedFellowship || ''}
                        onChange={(e) => handleUpdateMapping('selectedFellowship', e.target.value)}
                        className="w-full text-xs p-2 border border-gray-300 rounded-xl bg-white"
                      >
                        <option value="">-- Deliverance Church Utawala --</option>
                        {fileColumns.map(col => (
                          <option key={col} value={col}>
                            {col} {rawFileRows[0]?.[col] ? `(e.g. "${rawFileRows[0][col]}")` : ''}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Fellowship Zone */}
                    <div className="space-y-1">
                      <label className="block text-[11px] font-bold text-gray-700">
                        Fellowship Zone (Optional)
                      </label>
                      <select
                        value={columnMapping.selectedZone || ''}
                        onChange={(e) => handleUpdateMapping('selectedZone', e.target.value)}
                        className="w-full text-xs p-2 border border-gray-300 rounded-xl bg-white"
                      >
                        <option value="">-- None (Keep as in file) --</option>
                        {fileColumns.map(col => (
                          <option key={col} value={col}>
                            {col} {rawFileRows[0]?.[col] ? `(e.g. "${rawFileRows[0][col]}")` : ''}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Officiating Minister */}
                    <div className="space-y-1">
                      <label className="block text-[11px] font-bold text-gray-700">
                        Officiating Minister / Pastor
                      </label>
                      <select
                        value={columnMapping.officiatingMinister || ''}
                        onChange={(e) => handleUpdateMapping('officiatingMinister', e.target.value)}
                        className="w-full text-xs p-2 border border-gray-300 rounded-xl bg-white"
                      >
                        <option value="">-- Leave Blank / As in file --</option>
                        {fileColumns.map(col => (
                          <option key={col} value={col}>
                            {col} {rawFileRows[0]?.[col] ? `(e.g. "${rawFileRows[0][col]}")` : ''}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Certificate Number */}
                    <div className="space-y-1">
                      <label className="block text-[11px] font-bold text-gray-700">
                        Certificate No / Register Ref
                      </label>
                      <select
                        value={columnMapping.certificateNumber || ''}
                        onChange={(e) => handleUpdateMapping('certificateNumber', e.target.value)}
                        className="w-full text-xs p-2 border border-gray-300 rounded-xl bg-white"
                      >
                        <option value="">-- Auto-generate if missing --</option>
                        {fileColumns.map(col => (
                          <option key={col} value={col}>
                            {col} {rawFileRows[0]?.[col] ? `(e.g. "${rawFileRows[0][col]}")` : ''}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Date of Birth */}
                    <div className="space-y-1">
                      <label className="block text-[11px] font-bold text-gray-700">
                        Date of Birth (DOB)
                      </label>
                      <select
                        value={columnMapping.childDob || ''}
                        onChange={(e) => handleUpdateMapping('childDob', e.target.value)}
                        className="w-full text-xs p-2 border border-gray-300 rounded-xl bg-white"
                      >
                        <option value="">-- None in file --</option>
                        {fileColumns.map(col => (
                          <option key={col} value={col}>
                            {col} {rawFileRows[0]?.[col] ? `(e.g. "${rawFileRows[0][col]}")` : ''}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* County / Place of Birth */}
                    <div className="space-y-1">
                      <label className="block text-[11px] font-bold text-gray-700">
                        County / Place of Birth
                      </label>
                      <select
                        value={columnMapping.childCountyOfBirth || ''}
                        onChange={(e) => handleUpdateMapping('childCountyOfBirth', e.target.value)}
                        className="w-full text-xs p-2 border border-gray-300 rounded-xl bg-white"
                      >
                        <option value="">-- Nairobi --</option>
                        {fileColumns.map(col => (
                          <option key={col} value={col}>
                            {col} {rawFileRows[0]?.[col] ? `(e.g. "${rawFileRows[0][col]}")` : ''}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                )}

                {/* Import Mode Selector */}
                <div className="pt-2 border-t border-slate-200">
                  <label className="block text-xs font-bold text-gray-700 mb-2">
                    Select Import Mode:
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                    <label className={`p-3 rounded-xl border flex items-start gap-2.5 cursor-pointer transition-all ${
                      importMode === 'append' ? 'bg-white border-[#aa8222] ring-2 ring-[#d4af37]/40 shadow-xs' : 'bg-slate-100 border-slate-200'
                    }`}>
                      <input
                        type="radio"
                        name="importMode"
                        checked={importMode === 'append'}
                        onChange={() => setImportMode('append')}
                        className="mt-0.5 text-[#aa8222]"
                      />
                      <div>
                        <strong className="block text-gray-800">Append New Records</strong>
                        <span className="text-[11px] text-gray-500">Add to existing past records without overwriting.</span>
                      </div>
                    </label>

                    <label className={`p-3 rounded-xl border flex items-start gap-2.5 cursor-pointer transition-all ${
                      importMode === 'replace_2009' ? 'bg-amber-50 border-amber-500 ring-2 ring-amber-400/40 shadow-xs' : 'bg-slate-100 border-slate-200'
                    }`}>
                      <input
                        type="radio"
                        name="importMode"
                        checked={importMode === 'replace_2009'}
                        onChange={() => setImportMode('replace_2009')}
                        className="mt-0.5 text-amber-600"
                      />
                      <div>
                        <strong className="block text-amber-900">Clean & Replace 2009 Records</strong>
                        <span className="text-[11px] text-amber-700">Replaces old 2009 records with this clean original CSV file.</span>
                      </div>
                    </label>

                    <label className={`p-3 rounded-xl border flex items-start gap-2.5 cursor-pointer transition-all ${
                      importMode === 'replace_all' ? 'bg-red-50 border-red-500 ring-2 ring-red-400/40 shadow-xs' : 'bg-slate-100 border-slate-200'
                    }`}>
                      <input
                        type="radio"
                        name="importMode"
                        checked={importMode === 'replace_all'}
                        onChange={() => setImportMode('replace_all')}
                        className="mt-0.5 text-red-600"
                      />
                      <div>
                        <strong className="block text-red-900">Replace Entire Archive</strong>
                        <span className="text-[11px] text-red-700">Full archive reset with this new upload.</span>
                      </div>
                    </label>
                  </div>
                </div>
              </div>
            )}

            {/* ========================================================= */}
            {/* LIVE PREVIEW OF REARRANGED ROWS                           */}
            {/* ========================================================= */}
            {importedPreview.length > 0 && (
              <div className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-gray-800">
                      Rearranged Preview ({importedPreview.length} Records Detected):
                    </span>
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Original Dates Preserved
                    </span>
                  </div>
                  <span className="text-gray-500 text-[11px]">
                    Showing first 5 rows
                  </span>
                </div>

                <div className="overflow-x-auto border border-gray-200 rounded-2xl max-h-56">
                  <table className="w-full text-[11px] text-left">
                    <thead className="bg-[#2a170e] text-[#ffd700] font-cinzel text-[11px] border-b border-gray-200 sticky top-0">
                      <tr>
                        <th className="p-2.5">Original Dedication Date</th>
                        <th className="p-2.5">Child Full Name</th>
                        <th className="p-2.5">Parents / Family</th>
                        <th className="p-2.5">Fellowship / Location</th>
                        <th className="p-2.5">Zone</th>
                        <th className="p-2.5">Officiating Minister</th>
                        <th className="p-2.5">Certificate No</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 bg-white">
                      {importedPreview.slice(0, 5).map((row, idx) => (
                        <tr key={idx} className="hover:bg-amber-50/40">
                          <td className="p-2.5 font-bold font-mono text-[#2a170e] bg-amber-50/80">
                            {row.serviceDate}
                            {row.originalDateRaw && row.originalDateRaw !== row.serviceDate && (
                              <span className="block text-[9px] text-gray-400 font-normal">
                                raw: "{row.originalDateRaw}"
                              </span>
                            )}
                          </td>
                          <td className="p-2.5 font-bold text-gray-900">{row.childName}</td>
                          <td className="p-2.5 text-gray-700">
                            {row.parentName || `${row.fatherName || ''} & ${row.motherName || ''}`.trim() || '-'}
                          </td>
                          <td className="p-2.5 font-medium text-gray-800">
                            {row.selectedFellowship}
                          </td>
                          <td className="p-2.5 text-gray-500">
                            {row.selectedZone && row.selectedZone !== 'Unallocated' ? row.selectedZone : '-'}
                          </td>
                          <td className="p-2.5 text-gray-600">
                            {row.officiatingMinister || '-'}
                          </td>
                          <td className="p-2.5 font-mono text-[10px] text-amber-800">
                            {row.certificateNumber}
                          </td>
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
                  setRawFileRows([]);
                }}
                className="px-4 py-2 rounded-xl text-xs font-bold text-gray-600 hover:bg-gray-100 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmImport}
                disabled={importedPreview.length === 0 || isImporting}
                className="bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white px-5 py-2.5 rounded-xl font-bold text-xs sm:text-sm flex items-center gap-2 cursor-pointer shadow-md transition-all"
              >
                {isImporting ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Filling Historical Archive...</span>
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4" />
                    <span>
                      {importMode === 'replace_2009'
                        ? `Confirm & Replace 2009 Archive (${importedPreview.length} Records)`
                        : importMode === 'replace_all'
                        ? `Confirm & Replace Entire Archive (${importedPreview.length} Records)`
                        : `Confirm & Import (${importedPreview.length} Records)`}
                    </span>
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
                  Record dedicated children from older church paper registers or archives without forced defaults.
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
                    Date of Birth (DOB)
                  </label>
                  <input
                    type="text"
                    value={formData.childDob || ''}
                    onChange={(e) => setFormData({ ...formData, childDob: e.target.value })}
                    placeholder="e.g. 2009-02-14 or 14/02/2009"
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
                    Dedication Sunday Service Date * (Preserves exact date)
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.serviceDate || ''}
                    onChange={(e) => setFormData({ ...formData, serviceDate: e.target.value })}
                    placeholder="e.g. 2009-08-30 or 2009"
                    className="w-full px-3 py-2 text-xs sm:text-sm border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#d4af37] outline-hidden font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">
                    County of Birth
                  </label>
                  <input
                    type="text"
                    value={formData.childCountyOfBirth || ''}
                    onChange={(e) => setFormData({ ...formData, childCountyOfBirth: e.target.value })}
                    placeholder="e.g. Nairobi, Kiambu, Nakuru"
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
                    Fellowship / Residence / Cell
                  </label>
                  <input
                    type="text"
                    value={formData.selectedFellowship || ''}
                    onChange={(e) => setFormData({ ...formData, selectedFellowship: e.target.value })}
                    placeholder="e.g. Deliverance Church Utawala, Doxa, Kincar"
                    className="w-full px-3 py-2 text-xs sm:text-sm border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#d4af37] outline-hidden"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">
                    Fellowship Zone
                  </label>
                  <select
                    value={formData.selectedZone || ''}
                    onChange={(e) => setFormData({ ...formData, selectedZone: e.target.value as any })}
                    className="w-full px-3 py-2 text-xs sm:text-sm border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#d4af37] outline-hidden"
                  >
                    <option value="">None / Historical Unallocated</option>
                    {ZONES.map((z) => (
                      <option key={z.name} value={z.name}>{z.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">
                    Officiating Minister / Pastor
                  </label>
                  <input
                    type="text"
                    value={formData.officiatingMinister || ''}
                    onChange={(e) => setFormData({ ...formData, officiatingMinister: e.target.value })}
                    placeholder="e.g. Rev. Senior Pastor, Presbytery"
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
