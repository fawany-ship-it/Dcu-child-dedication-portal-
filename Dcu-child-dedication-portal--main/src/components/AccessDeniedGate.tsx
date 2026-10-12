import React from 'react';
import { ChurchLogo } from './ChurchLogo';
import { Shield, Lock, ArrowRight, CheckCircle2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

interface AccessDeniedGateProps {
  tabTitle: string;
  tabDescription: string;
}

export function AccessDeniedGate({ tabTitle, tabDescription }: AccessDeniedGateProps) {
  const { openAuthModal, loginWithGoogle } = useAuth();

  return (
    <div className="max-w-2xl mx-auto my-12 bg-white rounded-3xl shadow-2xl border-2 border-[#d4af37]/40 p-8 sm:p-12 text-center space-y-6">
      <div className="flex justify-center">
        <ChurchLogo size={96} className="shadow-xl" />
      </div>

      <div className="space-y-2">
        <span className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-[#aa8222] bg-[#fbf5e6] px-3 py-1 rounded-full border border-[#d4af37]/40">
          <Lock className="w-3.5 h-3.5 text-[#aa8222]" /> Staff & Leader Access Only
        </span>
        <h2 className="text-2xl sm:text-3xl font-cinzel font-bold text-[#2a170e]">
          {tabTitle}
        </h2>
        <p className="text-sm text-gray-600 max-w-md mx-auto">
          {tabDescription}
        </p>
      </div>

      <div className="p-5 rounded-2xl bg-[#fdfbf7] border border-[#d4af37]/30 text-xs text-gray-700 text-left space-y-2 max-w-md mx-auto">
        <p className="font-bold text-[#2a170e] flex items-center gap-1.5">
          <Shield className="w-4 h-4 text-[#d4af37]" /> Security & Pastoral Integrity Note:
        </p>
        <ul className="space-y-1.5 list-disc pl-5 text-gray-600">
          <li>Fellowship leaders and church office admins must log in with Google to confirm and approve candidate forms.</li>
          <li>Parents only register and track status; internal data and compilation queues are restricted to church leadership.</li>
        </ul>
      </div>

      <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
        <button
          onClick={() => loginWithGoogle({ email: 'fawany@gmail.com', name: 'Fawany (Administrator)' })}
          className="w-full sm:w-auto bg-[#2a170e] hover:bg-[#3d2314] text-[#ffd700] border-2 border-[#d4af37] px-6 py-3.5 rounded-xl font-bold text-sm shadow-lg hover:shadow-xl transition-all flex items-center justify-center gap-2 cursor-pointer group"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24">
            <path
              fill="#4285F4"
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
            />
            <path
              fill="#34A853"
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            />
            <path
              fill="#FBBC05"
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
            />
            <path
              fill="#EA4335"
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
            />
          </svg>
          Sign in with Google
          <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
        </button>

        <button
          onClick={openAuthModal}
          className="w-full sm:w-auto bg-white hover:bg-gray-100 text-gray-700 border border-gray-300 px-5 py-3.5 rounded-xl font-bold text-sm transition-all cursor-pointer"
        >
          Other Sign In Options
        </button>
      </div>
    </div>
  );
}
