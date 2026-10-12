import React from 'react';
import { ChurchLogo } from './ChurchLogo';
import { MapPin, Clock, Phone, Mail, Globe, Facebook, Youtube, Video, Church, ShieldCheck, HeartHandshake } from 'lucide-react';

export function About() {
  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-12">
      {/* Main Card */}
      <div className="bg-white p-6 sm:p-10 rounded-3xl shadow-xl border-2 border-[#d4af37]/40 space-y-8">
        {/* Church Seal & Header */}
        <div className="text-center border-b border-gray-100 pb-8 space-y-3">
          <div className="flex justify-center mb-2">
            <ChurchLogo size={88} className="shadow-2xl" />
          </div>
          <h1 className="text-3xl sm:text-4xl font-cinzel font-bold text-[#2a170e]">
            Deliverance Church Int'l Utawala
          </h1>
          <p className="text-base sm:text-lg text-gray-700 italic font-serif max-w-2xl mx-auto">
            "We are a Pentecostal Church Of Choice. Our Vision is to Transform and Empower Mankind in Africa and Beyond."
          </p>
        </div>

        {/* 2-column info */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Services & Location */}
          <div className="space-y-6">
            <div className="bg-[#fcfaf6] p-6 rounded-2xl border border-[#d4af37]/30 space-y-4">
              <h2 className="text-xl font-cinzel font-bold text-[#2a170e] flex items-center gap-2">
                <Clock className="w-5 h-5 text-[#aa8222]" />
                Sunday Service Times
              </h2>
              <ul className="space-y-3 text-sm text-gray-700">
                <li className="flex items-center gap-3">
                  <span className="w-2.5 h-2.5 bg-[#d4af37] rounded-full shrink-0" />
                  <span>
                    <strong>1st Service (Early Dawn):</strong> 6:30 AM
                  </span>
                </li>
                <li className="flex items-center gap-3">
                  <span className="w-2.5 h-2.5 bg-[#d4af37] rounded-full shrink-0" />
                  <span>
                    <strong>2nd Service (Main Family):</strong> 9:30 AM
                  </span>
                </li>
              </ul>
              <p className="text-sm font-bold text-[#2a170e] pt-2 border-t border-amber-200/60">
                Karibu Sana! You and your family are warmly welcome.
              </p>
            </div>

            <div className="bg-gray-50 p-6 rounded-2xl border border-gray-200 space-y-3">
              <h2 className="text-xl font-cinzel font-bold text-[#2a170e] flex items-center gap-2">
                <MapPin className="w-5 h-5 text-[#aa8222]" />
                Location
              </h2>
              <p className="text-sm text-gray-700 leading-relaxed">
                We are located in <strong>Utawala, Nairobi, Kenya</strong>, off Eastern Bypass near Benedicta area.
              </p>
              <a
                href="https://linktr.ee/dcutawala"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-xs font-bold text-[#2a170e] hover:text-[#d4af37] underline underline-offset-4"
              >
                View Location Map (Linktree) &rarr;
              </a>
            </div>
          </div>

          {/* Contact & Socials */}
          <div className="space-y-6">
            <div className="bg-gray-50 p-6 rounded-2xl border border-gray-200 space-y-4">
              <h2 className="text-xl font-cinzel font-bold text-[#2a170e]">Contact Information</h2>
              <div className="space-y-3 text-sm text-gray-700">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-white rounded-lg border border-gray-200">
                    <Phone className="w-4 h-4 text-[#aa8222]" />
                  </div>
                  <div>
                    <p className="text-xs text-gray-400 font-bold uppercase">Mobile Hotline</p>
                    <p className="font-bold text-gray-900">0723 102273</p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="p-2 bg-white rounded-lg border border-gray-200">
                    <Mail className="w-4 h-4 text-[#aa8222]" />
                  </div>
                  <div>
                    <p className="text-xs text-gray-400 font-bold uppercase">Email Address</p>
                    <a href="mailto:dcutawala@gmail.com" className="font-bold text-[#2a170e] hover:underline">
                      dcutawala@gmail.com
                    </a>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-gray-50 p-6 rounded-2xl border border-gray-200 space-y-3">
              <h2 className="text-xl font-cinzel font-bold text-[#2a170e]">Connect Online</h2>
              <div className="grid grid-cols-2 gap-2.5">
                <a
                  href="https://dcutawala.org"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center p-3 bg-white rounded-xl border border-gray-200 hover:border-[#d4af37] hover:shadow-xs transition-all group"
                >
                  <Globe className="w-4 h-4 mr-2 text-gray-400 group-hover:text-[#d4af37]" />
                  <span className="text-xs font-bold text-gray-800">Website</span>
                </a>

                <a
                  href="https://linktr.ee/dcutawala"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center p-3 bg-white rounded-xl border border-gray-200 hover:border-blue-600 hover:shadow-xs transition-all group"
                >
                  <Facebook className="w-4 h-4 mr-2 text-gray-400 group-hover:text-blue-600" />
                  <span className="text-xs font-bold text-gray-800">Facebook</span>
                </a>

                <a
                  href="https://www.youtube.com/@DCUtawala"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center p-3 bg-white rounded-xl border border-gray-200 hover:border-red-600 hover:shadow-xs transition-all group"
                >
                  <Youtube className="w-4 h-4 mr-2 text-gray-400 group-hover:text-red-600" />
                  <span className="text-xs font-bold text-gray-800">YouTube</span>
                </a>

                <a
                  href="https://www.tiktok.com/@dcutawala1"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center p-3 bg-white rounded-xl border border-gray-200 hover:border-black hover:shadow-xs transition-all group"
                >
                  <Video className="w-4 h-4 mr-2 text-gray-400 group-hover:text-black" />
                  <span className="text-xs font-bold text-gray-800">TikTok</span>
                </a>
              </div>
            </div>
          </div>
        </div>

        {/* Dedication Ministry Philosophy */}
        <div className="bg-gradient-to-r from-[#2a170e] to-[#3a1d10] text-white p-6 sm:p-8 rounded-2xl space-y-3 border border-[#d4af37]/40">
          <h3 className="text-lg font-cinzel font-bold text-[#ffd700] flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-[#ffd700]" />
            About the Child Dedication Ministry
          </h3>
          <p className="text-xs sm:text-sm text-[#f6efe2]/90 leading-relaxed">
            The Dedication Department organizes Dedication Services in a period of 3 months (Quarterly) in conjunction with Fellowship Leaders across Zones A to E. Forms submitted by parents are approved by fellowship leaders and church administration to ensure continuous pastoral care and accurate church record-keeping.
          </p>
        </div>
      </div>
    </div>
  );
}
