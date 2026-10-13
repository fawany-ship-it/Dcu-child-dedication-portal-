import React from 'react';
import { ChurchLogo } from './ChurchLogo';
import { Printer, X, Award } from 'lucide-react';
import { DedicationRecord } from '../types';

interface CertificateModalProps {
  record: DedicationRecord | null;
  onClose: () => void;
}

export function CertificateModal({ record, onClose }: CertificateModalProps) {
  if (!record) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="relative bg-white rounded-3xl max-w-4xl w-full p-6 sm:p-10 shadow-2xl my-8 animate-in fade-in zoom-in-95 duration-150">
        {/* Top dialog action bar (hidden in print) */}
        <div className="no-print flex items-center justify-between pb-4 border-b border-gray-200 mb-6">
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono font-bold bg-[#2a170e] text-[#ffd700] px-2.5 py-1 rounded-md">
              {record.certificateNumber || record.id}
            </span>
            <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">
              Official Altar Dedication Certificate
            </span>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => window.print()}
              className="bg-[#2a170e] hover:bg-[#3d2314] text-[#ffd700] border-2 border-[#d4af37] px-4 py-2 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-1.5 shadow-md transition-all cursor-pointer"
            >
              <Printer className="w-4 h-4 text-[#ffd700]" />
              Print Certificate
            </button>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-700 font-bold p-1 text-lg leading-none cursor-pointer"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Certificate Body (Prints cleanly) */}
        <div className="relative border-8 border-double border-[#d4af37] p-8 sm:p-14 rounded-2xl bg-gradient-to-b from-[#fdfbf7] via-white to-[#fbf8f1] text-center space-y-6 shadow-inner">
          {/* Inner ornamental border */}
          <div className="absolute inset-2 border border-[#d4af37]/40 rounded-xl pointer-events-none" />

          {/* Church Header */}
          <div className="space-y-2">
            <div className="flex justify-center mb-1">
              <ChurchLogo size={80} className="shadow-lg" />
            </div>
            <h2 className="text-xl sm:text-2xl font-cinzel font-bold text-[#2a170e] tracking-widest uppercase">
              Deliverance Church International
            </h2>
            <h3 className="text-sm sm:text-base font-cinzel font-semibold text-[#aa8222] tracking-wider uppercase">
              Utawala Branch • The Church of Choice
            </h3>
            <p className="text-[11px] font-serif italic text-gray-600">
              "We are a Pentecostal Church Of Choice • Transforming and Empowering Mankind in Africa and Beyond"
            </p>
          </div>

          <div className="py-2">
            <h1 className="text-2xl sm:text-4xl font-cinzel font-bold text-[#2a170e] tracking-wide border-y-2 border-[#d4af37]/60 py-2 inline-block px-8">
              Certificate of Child Dedication
            </h1>
          </div>

          {/* Scripture Verse */}
          <p className="text-xs sm:text-sm font-serif italic text-gray-700 max-w-xl mx-auto leading-relaxed">
            "I prayed for this child, and the Lord has granted me what I asked of him. So now I give him to the Lord. For his whole life he will be given over to the Lord."
            <br />
            <span className="font-sans font-bold text-[#aa8222] text-[11px] not-italic">— 1 Samuel 1:27-28</span>
          </p>

          <p className="text-xs sm:text-sm font-serif text-gray-700 uppercase tracking-widest pt-2">
            This certifies that
          </p>

          {/* Child Name */}
          <div className="py-1">
            <h2 className="text-3xl sm:text-4xl font-cinzel font-bold text-[#2a170e] underline decoration-[#d4af37] underline-offset-8">
              {record.childName}
            </h2>
          </div>

          <p className="text-xs sm:text-sm text-gray-700 max-w-lg mx-auto">
            born on <strong className="text-gray-900">{record.childDob}</strong> in <strong className="text-gray-900">{record.childCountyOfBirth || record.childPlaceOfBirth} County</strong>,
            was dedicated to Almighty God at Deliverance Church International Utawala on{' '}
            <strong className="text-[#2a170e]">{record.serviceDate || 'Monthly Dedication Sunday'}</strong>.
          </p>

          <div className="text-xs text-gray-700">
            Presented by loving parents:
            <p className="text-sm font-cinzel font-bold text-gray-900 mt-1">
              {record.fatherName && record.motherName
                ? `${record.fatherName} & ${record.motherName}`
                : record.fatherName || record.motherName || record.parentName}
            </p>
            <p className="text-[11px] text-[#aa8222] mt-0.5">
              {record.selectedFellowship} Fellowship • {record.selectedZone}
            </p>
          </div>

          {/* Signatures & Seal */}
          <div className="pt-8 grid grid-cols-2 gap-8 text-xs max-w-md mx-auto items-end">
            <div className="text-center">
              <div className="h-10 border-b border-gray-500 font-serif italic text-gray-800 text-sm flex items-end justify-center pb-1">
                Rev. Senior Pastor
              </div>
              <p className="font-bold text-[#2a170e] mt-1.5 font-cinzel">Senior Pastor</p>
              <p className="text-[10px] text-gray-500">DCI Utawala</p>
            </div>

            <div className="text-center">
              <div className="w-16 h-16 mx-auto rounded-full border-2 border-dashed border-[#d4af37] flex items-center justify-center p-1 text-[9px] text-[#aa8222] uppercase font-bold tracking-tighter leading-tight">
                Official Church Seal
              </div>
              <p className="font-bold text-[#2a170e] mt-1.5 font-cinzel">Registry Ref</p>
              <p className="text-[10px] font-mono text-gray-500">{record.certificateNumber || record.id}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
