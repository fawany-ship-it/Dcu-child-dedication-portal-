import React, { useRef } from 'react';
import { ChurchLogo } from './ChurchLogo';
import { Printer, X, Award, CheckCircle2 } from 'lucide-react';
import { DedicationRecord } from '../types';

interface CertificateModalProps {
  record: DedicationRecord | null;
  onClose: () => void;
}

export function CertificateModal({ record, onClose }: CertificateModalProps) {
  if (!record) return null;

  const handlePrint = () => {
    window.print();
  };

  // Format parent presentation line
  const parentsDisplay = 
    record.fatherName && record.motherName
      ? `${record.fatherName} & ${record.motherName}`
      : record.fatherName || record.motherName || record.parentName || 'Loving Parents';

  // Fellowship & Zone string
  const fellowshipDisplay = record.selectedFellowship && record.selectedFellowship.toLowerCase() !== 'fellowship'
    ? (record.selectedFellowship.toLowerCase().includes('fellowship') ? record.selectedFellowship : `${record.selectedFellowship} Fellowship`)
    : 'Deliverance Church Utawala';

  const zoneDisplay = record.selectedZone && record.selectedZone !== 'Unallocated' && !record.selectedFellowship?.includes(record.selectedZone)
    ? ` • ${record.selectedZone}`
    : '';

  const countyDisplay = record.childCountyOfBirth || record.childPlaceOfBirth || 'Nairobi';
  const dedicationDateDisplay = record.serviceDate || 'Dedication Sunday';
  const refNumber = record.certificateNumber || record.id;

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 overflow-y-auto">
      {/* Top Dialog Container */}
      <div className="relative bg-neutral-900/90 rounded-3xl max-w-4xl w-full p-4 sm:p-6 shadow-2xl my-4 text-white border border-[#d4af37]/40 animate-in fade-in zoom-in-95 duration-150">
        
        {/* Top Control Bar (Hidden when printing) */}
        <div className="no-print flex items-center justify-between pb-3 border-b border-white/10 mb-4">
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono font-bold bg-[#ffd700] text-[#2a170e] px-2.5 py-1 rounded-md shadow-xs">
              {refNumber}
            </span>
            <span className="text-xs font-bold text-[#ffd700] uppercase tracking-wider hidden sm:inline">
              Official Altar Dedication Certificate
            </span>
            <span className="text-[10px] bg-white/10 text-gray-300 px-2 py-0.5 rounded border border-white/10">
              A5 Landscape (148 × 210 mm)
            </span>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              onClick={handlePrint}
              className="bg-[#d4af37] hover:bg-[#e6c154] text-[#2a170e] border border-[#d4af37] px-4 py-2 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-1.5 shadow-md transition-all cursor-pointer"
            >
              <Printer className="w-4 h-4 text-[#2a170e]" />
              Print Certificate (A5)
            </button>
            <button
              onClick={onClose}
              className="bg-white/10 hover:bg-white/20 text-gray-200 hover:text-white p-2 rounded-xl text-base leading-none transition-colors cursor-pointer"
              title="Close"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Certificate Sheet (Prints cleanly in exact A5 Landscape) */}
        <div className="certificate-a5-print relative bg-gradient-to-b from-[#fdfbf7] via-white to-[#fbf8f1] text-[#2a170e] p-6 sm:p-8 md:p-10 rounded-2xl shadow-2xl border-4 border-double border-[#d4af37] mx-auto max-w-[780px]">
          {/* Inner ornamental border line */}
          <div className="absolute inset-2 sm:inset-3 border border-[#d4af37]/50 rounded-xl pointer-events-none" />

          {/* Top: Church Logo */}
          <div className="flex justify-center pt-1 mb-1.5">
            <ChurchLogo size={62} className="drop-shadow-md" />
          </div>

          {/* Certificate Title */}
          <div className="text-center py-1">
            <h1 className="text-xl sm:text-2xl md:text-3xl font-cinzel font-bold text-[#2a170e] tracking-wider uppercase border-y-2 border-[#d4af37]/60 py-1.5 inline-block px-6 sm:px-10">
              Certificate of Child Dedication
            </h1>
          </div>

          {/* Scripture Verse Reference */}
          <div className="text-center pt-1 pb-1">
            <p className="font-cinzel font-bold text-[#aa8222] text-xs sm:text-sm tracking-widest">
              — 1 Samuel 1:27-28 —
            </p>
          </div>

          {/* Certification Statement */}
          <div className="text-center pt-1 space-y-1">
            <p className="text-xs sm:text-sm font-serif uppercase tracking-widest text-gray-700">
              This certifies that
            </p>

            {/* Child's Full Name (Prominent & Clear) */}
            <div className="py-1">
              <h2 className="text-2xl sm:text-3xl md:text-4xl font-cinzel font-extrabold text-[#2a170e] tracking-wide underline decoration-[#d4af37] underline-offset-6">
                {record.childName}
              </h2>
            </div>

            {/* Dedication Sentence */}
            <p className="text-xs sm:text-sm text-gray-700 max-w-xl mx-auto leading-relaxed pt-1">
              born on <strong className="text-gray-900 font-bold">{record.childDob}</strong> in <strong className="text-gray-900 font-bold">{countyDisplay} County</strong>,
              was dedicated to Almighty God at Deliverance Church International Utawala on{' '}
              <strong className="text-[#2a170e] font-bold">{dedicationDateDisplay}</strong>.
            </p>

            {/* Parents & Fellowship Info */}
            <div className="pt-2">
              <p className="text-[11px] sm:text-xs text-gray-600 uppercase tracking-wider">
                Presented by loving parents:
              </p>
              <p className="text-sm sm:text-base font-cinzel font-bold text-gray-900 mt-0.5">
                {parentsDisplay}
              </p>
              <p className="text-[10px] sm:text-[11px] text-[#aa8222] font-semibold mt-0.5">
                {fellowshipDisplay}{zoneDisplay}
              </p>
            </div>
          </div>

          {/* Signatures & Seal Section */}
          <div className="pt-6 sm:pt-8 grid grid-cols-2 gap-6 sm:gap-12 max-w-md mx-auto items-end text-center">
            {/* Pastor Signature Block */}
            <div className="space-y-0.5">
              <div className="h-9 border-b border-gray-600 font-serif italic text-gray-900 text-sm sm:text-base flex items-end justify-center pb-0.5 font-bold">
                Rev. Emmanuel K.
              </div>
              <p className="font-bold text-[#2a170e] text-xs sm:text-sm font-cinzel tracking-wider pt-0.5">
                Senior Pastor
              </p>
              <p className="text-[10px] sm:text-xs text-gray-600 font-serif">
                DCI Utawala
              </p>
            </div>

            {/* Church Seal & Registry Ref */}
            <div className="space-y-0.5">
              <div className="w-14 h-14 sm:w-16 sm:h-16 mx-auto rounded-full border-2 border-dashed border-[#d4af37] bg-[#fbf5e6] flex items-center justify-center p-1 text-[8px] sm:text-[9px] text-[#aa8222] uppercase font-bold tracking-tighter leading-tight shadow-inner">
                Official Church Seal
              </div>
              <p className="font-bold text-[#2a170e] text-xs sm:text-sm font-cinzel tracking-wider pt-0.5">
                Registry Ref
              </p>
              <p className="text-[10px] sm:text-xs font-mono font-bold text-gray-600">
                {refNumber}
              </p>
            </div>
          </div>
        </div>

        {/* Helpful Print Instruction for Users (Hidden during print) */}
        <div className="no-print mt-3 text-center text-xs text-gray-400">
          Tip: In your browser print dialog, select <strong>Paper Size: A5</strong> and <strong>Orientation: Landscape</strong> with <strong>Margins: Default or None</strong> for best results.
        </div>
      </div>
    </div>
  );
}
