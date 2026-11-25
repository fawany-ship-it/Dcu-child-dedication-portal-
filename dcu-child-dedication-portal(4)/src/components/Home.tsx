import React from 'react';
import { ChurchLogo } from './ChurchLogo';
import { Baby, Calendar, ShieldCheck, HeartHandshake, ArrowRight, Clock, MapPin, Award, CheckCircle2, Shield, Search, Church } from 'lucide-react';
import { MONTHLY_DEDICATION_DATES, ZONES } from '../data/zones';

interface HomeProps {
  onNavigate: (tab: string) => void;
  totalRecordsCount: number;
}

export function Home({ onNavigate, totalRecordsCount }: HomeProps) {
  return (
    <div className="space-y-10 pb-12">
      {/* Hero Section */}
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#2a170e] via-[#381f13] to-[#1c0c05] text-white p-8 md:p-14 shadow-2xl border-2 border-[#d4af37]/50">
        {/* Decorative Golden Ambient Aura */}
        <div className="absolute top-0 right-0 -mr-20 -mt-20 w-96 h-96 bg-[#d4af37]/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 -ml-20 -mb-20 w-80 h-80 bg-[#aa8222]/15 rounded-full blur-2xl pointer-events-none" />

        <div className="relative z-10 max-w-3xl space-y-6">
          <div className="flex items-center gap-3">
            <ChurchLogo size={60} className="shadow-lg" />
            <div>
              <span className="text-xs font-bold text-[#ffd700] uppercase tracking-wider block font-cinzel">
                Deliverance Church Int'l - Utawala
              </span>
              <span className="text-xs text-[#f4e2b8]/80 font-serif italic">
                The Church of Choice
              </span>
            </div>
          </div>

          <h1 className="text-3xl md:text-5xl font-cinzel font-bold text-white leading-tight">
            Child Dedication <span className="text-[#ffd700] italic">&</span> Pastoral Care
          </h1>

          <p className="text-base md:text-lg text-[#f4e2b8] font-serif italic border-l-4 border-[#d4af37] pl-4 py-1">
            "We are a Pentecostal Church Of Choice. Our Vision is to Transform and Empower Mankind in Africa and Beyond."
          </p>

          <p className="text-sm md:text-base text-gray-300 leading-relaxed font-sans">
            Presenting your infant before God and the church altar. Register your child for the upcoming Monthly Dedication Sunday, connect with your local fellowship leader in Zones A through E, and receive your official church certificate.
          </p>

          {/* Action buttons */}
          <div className="pt-2 flex flex-wrap gap-3 items-center">
            <button
              onClick={() => onNavigate('register')}
              className="bg-[#d4af37] hover:bg-[#e6c154] text-[#2a170e] font-bold px-5 py-3 rounded-xl shadow-lg hover:shadow-xl transition-all flex items-center gap-2 text-sm sm:text-base cursor-pointer group"
            >
              <Baby className="w-5 h-5 text-[#2a170e]" />
              Register Your Child
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </button>

            <button
              onClick={() => onNavigate('track')}
              className="bg-white/10 hover:bg-white/20 text-white border border-white/20 px-5 py-3 rounded-xl text-sm sm:text-base font-semibold transition-all backdrop-blur-xs flex items-center gap-2 cursor-pointer"
            >
              <Search className="w-4 h-4 text-[#ffd700]" />
              Track Status
            </button>

            <button
              onClick={() => onNavigate('about')}
              className="bg-transparent hover:bg-white/10 text-gray-200 hover:text-[#ffd700] border border-white/20 px-4 py-3 rounded-xl text-sm font-semibold transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <Church className="w-4 h-4 text-[#ffd700]" />
              About DCU
            </button>
          </div>

          {/* Quick stats pills */}
          <div className="pt-6 grid grid-cols-2 sm:grid-cols-3 gap-4 border-t border-white/10 text-xs sm:text-sm">
            <div>
              <p className="text-gray-400">Archived & Active</p>
              <p className="text-xl font-bold text-[#ffd700]">{totalRecordsCount}+ Dedicated Children</p>
            </div>
            <div>
              <p className="text-gray-400">Fellowship Zones</p>
              <p className="text-xl font-bold text-white">Zones A, B, C, D, E</p>
            </div>
            <div className="col-span-2 sm:col-span-1">
              <p className="text-gray-400">Location</p>
              <p className="text-xl font-bold text-white">Utawala, Nairobi</p>
            </div>
          </div>
        </div>
      </section>

      {/* 3 Pillars of Dedication */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-2xl border-2 border-gray-200/80 shadow-xs hover:border-[#d4af37]/60 transition-all space-y-3">
          <div className="w-12 h-12 rounded-xl bg-[#fbf5e6] text-[#2a170e] flex items-center justify-center font-bold border border-[#d4af37]/30">
            <Baby className="w-6 h-6 text-[#aa8222]" />
          </div>
          <h3 className="text-lg font-cinzel font-bold text-[#2a170e]">1. Altar Presentation</h3>
          <p className="text-sm text-gray-600 leading-relaxed">
            Parents present their newborn to the Lord, covenanting to nurture them in the gospel of Jesus Christ with prayer and spiritual guidance.
          </p>
        </div>

        <div className="bg-white p-6 rounded-2xl border-2 border-gray-200/80 shadow-xs hover:border-[#d4af37]/60 transition-all space-y-3">
          <div className="w-12 h-12 rounded-xl bg-[#fbf5e6] text-[#2a170e] flex items-center justify-center font-bold border border-[#d4af37]/30">
            <HeartHandshake className="w-6 h-6 text-[#aa8222]" />
          </div>
          <h3 className="text-lg font-cinzel font-bold text-[#2a170e]">2. Fellowship Oversight</h3>
          <p className="text-sm text-gray-600 leading-relaxed">
            Home fellowship leaders in Zones A to E confirm and endorse each candidate, connecting families with pastoral care in their neighborhood.
          </p>
        </div>

        <div className="bg-white p-6 rounded-2xl border-2 border-gray-200/80 shadow-xs hover:border-[#d4af37]/60 transition-all space-y-3">
          <div className="w-12 h-12 rounded-xl bg-[#fbf5e6] text-[#2a170e] flex items-center justify-center font-bold border border-[#d4af37]/30">
            <Award className="w-6 h-6 text-[#aa8222]" />
          </div>
          <h3 className="text-lg font-cinzel font-bold text-[#2a170e]">3. Pastoral Certificate</h3>
          <p className="text-sm text-gray-600 leading-relaxed">
            Upon dedication on the designated Dedication Sunday (conducted in a period of 3 months), an official certificate signed by the Senior Pastor is presented to the parents.
          </p>
        </div>
      </section>

      {/* Dedication Dates Calendar (Takes place in a period of 3 months) */}
      <section className="bg-white rounded-3xl p-8 border-2 border-[#d4af37]/30 shadow-sm space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-gray-100 pb-6">
          <div>
            <span className="text-xs font-bold text-[#aa8222] uppercase tracking-wider">
              Calendar of Dedication Sundays (Every 3 Months)
            </span>
            <h2 className="text-2xl font-cinzel font-bold text-[#2a170e]">
              Dedication Schedule (Period of 3 Months)
            </h2>
            <p className="text-sm text-gray-500">
              Child dedication at Deliverance Church International Utawala takes place in a period of 3 months. Dedication dates and Sundays are determined and scheduled by the Senior Pastor and Church Office based on the church calendar.
            </p>
          </div>

          <button
            onClick={() => onNavigate('register')}
            className="self-start md:self-auto text-sm font-bold text-[#2a170e] hover:text-[#d4af37] flex items-center gap-1.5 cursor-pointer"
          >
            Register for Next Service &rarr;
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {MONTHLY_DEDICATION_DATES.slice(0, 3).map((srv, index) => (
            <div
              key={srv.date}
              className={`p-5 rounded-2xl border transition-all ${
                index === 0
                  ? 'border-[#d4af37] bg-gradient-to-b from-[#fbf5e6]/60 to-white shadow-md'
                  : 'border-gray-200 bg-gray-50/60 hover:bg-white hover:border-[#d4af37]/50'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-900">
                  {srv.cycle}
                </span>
                <Calendar className="w-4 h-4 text-[#d4af37]" />
              </div>
              <h4 className="font-bold text-gray-900 text-base">{srv.label}</h4>
              <p className="text-xs text-[#2a170e] font-semibold mt-2">
                Officiating: {srv.minister}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Guidelines Card */}
      <section className="bg-gradient-to-br from-[#2a170e] to-[#3a1d10] text-white rounded-3xl p-8 md:p-10 shadow-xl border-2 border-[#d4af37]/40 space-y-4">
        <h3 className="text-2xl font-cinzel font-bold text-[#ffd700]">
          Parental & Fellowship Process
        </h3>
        <ul className="space-y-3 text-sm text-[#f6efe2]/90">
          <li className="flex items-start gap-2.5">
            <CheckCircle2 className="w-5 h-5 text-[#ffd700] shrink-0 mt-0.5" />
            <span>
              <strong>1. Form Submission:</strong> Fill in the child's details, county of birth, and home fellowship zone (Zones A, B, C, D, or E).
            </span>
          </li>
          <li className="flex items-start gap-2.5">
            <CheckCircle2 className="w-5 h-5 text-[#ffd700] shrink-0 mt-0.5" />
            <span>
              <strong>2. Fellowship Leader Endorsement:</strong> Your Home Fellowship leader logs in to confirm and approve your sent form.
            </span>
          </li>
          <li className="flex items-start gap-2.5">
            <CheckCircle2 className="w-5 h-5 text-[#ffd700] shrink-0 mt-0.5" />
            <span>
              <strong>3. Church Office Compilation:</strong> Church Office verifies fellowship clearance and compiles candidates for the Senior Pastor.
            </span>
          </li>
          <li className="flex items-start gap-2.5">
            <CheckCircle2 className="w-5 h-5 text-[#ffd700] shrink-0 mt-0.5" />
            <span>
              <strong>4. 24-Hour Status Tracking:</strong> Parents can view verified status updates within 24 hours of submission using the Track Status tab.
            </span>
          </li>
        </ul>
      </section>
    </div>
  );
}
