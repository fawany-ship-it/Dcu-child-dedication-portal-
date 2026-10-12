import React, { useState } from 'react';
import { ChurchLogo } from './ChurchLogo';
import { Mail, Lock, Shield, CheckCircle2, AlertCircle, User, ArrowRight } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export function AuthModal() {
  const { user, isAuthModalOpen, closeAuthModal, loginWithEmail, loginWithGoogle } = useAuth();

  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [requestedRole, setRequestedRole] = useState<'parent' | 'fellowship_leader' | 'admin'>('parent');
  const [requestedZone, setRequestedZone] = useState<'Zone A' | 'Zone B' | 'Zone C' | 'Zone D' | 'Zone E'>('Zone A');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  if (!isAuthModalOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!email.trim() || !email.includes('@')) {
      setError('Please provide a valid email address.');
      return;
    }

    if (password.length < 4) {
      setError('Password should be at least 4 characters.');
      return;
    }

    setLoading(true);
    try {
      await loginWithEmail(email.trim(), fullName.trim());
      closeAuthModal();
    } catch (err: any) {
      setError(err?.message || 'Authentication failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async (presetEmail?: string, presetName?: string, presetRole?: any, presetZone?: any) => {
    setLoading(true);
    setError('');
    try {
      await loginWithGoogle({
        email: presetEmail || (email.includes('@') ? email : 'fawany@gmail.com'),
        name: presetName || (presetEmail ? presetEmail.split('@')[0] : 'Google Leader'),
        role: presetRole,
        assignedZone: presetZone,
      });
      closeAuthModal();
    } catch (err: any) {
      setError('Google Sign-in failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-3xl max-w-md w-full p-6 sm:p-8 space-y-6 shadow-2xl border-2 border-[#d4af37]/50 animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="text-center space-y-2 relative">
          <button
            onClick={closeAuthModal}
            className="absolute right-0 top-0 text-gray-400 hover:text-gray-600 font-bold p-1 cursor-pointer"
          >
            ✕
          </button>
          <div className="flex justify-center mb-1">
            <ChurchLogo size={64} className="shadow-lg" />
          </div>
          <h2 className="text-xl sm:text-2xl font-cinzel font-bold text-[#2a170e]">
            {mode === 'signin' ? 'Staff & Leader Sign In' : 'Create Staff Account'}
          </h2>
          <p className="text-xs text-gray-500">
            Fellowship Zone Leaders and Church Office Admins must sign in with Google to approve and compile child dedication forms.
          </p>
        </div>

        {error && (
          <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Prominent Google Sign-In as requested */}
        <div className="space-y-2.5">
          <button
            type="button"
            disabled={loading}
            onClick={() => handleGoogleSignIn('fawany@gmail.com', 'Fawany (Administrator)')}
            className="w-full py-3 px-4 rounded-xl border-2 border-[#d4af37] bg-white hover:bg-amber-50/60 font-bold text-xs sm:text-sm text-[#2a170e] flex items-center justify-center gap-2.5 shadow-md hover:shadow-lg transition-all cursor-pointer group"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24">
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
            Sign in with Google <span className="text-gray-500 font-normal">({user?.email || 'fawany@gmail.com'})</span>
          </button>
        </div>

        <div className="flex items-center my-2">
          <div className="flex-1 border-t border-gray-200" />
          <span className="px-3 text-[11px] text-gray-400 uppercase font-semibold">Or with Email</span>
          <div className="flex-1 border-t border-gray-200" />
        </div>

        {/* Email & Password Form */}
        <form onSubmit={handleSubmit} className="space-y-3.5">
          {mode === 'signup' && (
            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
                Full Name
              </label>
              <input
                type="text"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="e.g. Leader Peter Mwangi"
                className="w-full p-2.5 text-xs sm:text-sm border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#d4af37] outline-hidden"
              />
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
              Email Address
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 text-gray-400 absolute left-3 top-3" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="leader@dcutawala.org"
                className="w-full pl-9 pr-3 py-2.5 text-xs sm:text-sm border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#d4af37] outline-hidden"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
              Password
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-gray-400 absolute left-3 top-3" />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full pl-9 pr-3 py-2.5 text-xs sm:text-sm border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#d4af37] outline-hidden"
              />
            </div>
          </div>

          {mode === 'signup' && (
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
                  Role Responsibility
                </label>
                <select
                  value={requestedRole}
                  onChange={(e) => setRequestedRole(e.target.value as any)}
                  className="w-full p-2.5 text-xs sm:text-sm border border-gray-300 rounded-xl bg-white"
                >
                  <option value="fellowship_leader">Fellowship Zone Leader (Zones A to E)</option>
                  <option value="admin">Church Office Administrator</option>
                  <option value="parent">Parent / Member</option>
                </select>
              </div>

              {requestedRole === 'fellowship_leader' && (
                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
                    Assigned Zone (Data Privacy Boundary)
                  </label>
                  <select
                    value={requestedZone}
                    onChange={(e) => setRequestedZone(e.target.value as any)}
                    className="w-full p-2.5 text-xs sm:text-sm border-2 border-[#d4af37] rounded-xl bg-white font-bold text-[#2a170e]"
                  >
                    <option value="Zone A">Zone A (Doxa, Utukufu, Glory, Judea, Koinonia, Jerusalem, Zion, Favour, Agape)</option>
                    <option value="Zone B">Zone B (Neema, Sifa, Bethsaida, Baraka, Nazareth, Bethel, Kingdom, Rehoboth, Mamlaka, Ebenezer)</option>
                    <option value="Zone C">Zone C (Dominion, Overcomers, Elevation, Genesis, Shammah, Adonai, Shalom, Vision)</option>
                    <option value="Zone D">Zone D (Transformers, Imani, Tumaini, Berea, Theophilus, Pillars, Wisdom, Mt. Moriah)</option>
                    <option value="Zone E">Zone E (Shekinah, Believers, Shiloh, Eden, Peniel, Goshen, Salem, Uhai, Antioch, Macedonia)</option>
                  </select>
                </div>
              )}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-[#2a170e] hover:bg-[#3d2314] text-[#ffd700] border-2 border-[#d4af37] font-bold rounded-xl text-xs sm:text-sm shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            {loading ? 'Processing...' : mode === 'signin' ? 'Sign In with Email' : 'Register Leader Account'}
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>

        {/* Quick Presets */}
        <div className="pt-2 border-t border-gray-100">
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2 text-center">
            Quick 1-Click Role Logins (Instant Access)
          </p>
          <div className="space-y-2">
            <button
              onClick={() => handleGoogleSignIn('fawany@gmail.com', 'Fawany (Administrator)', 'admin')}
              className="w-full p-2 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-900 font-bold border border-amber-200 text-left transition-colors cursor-pointer flex items-center justify-between"
            >
              <div>
                <span className="block text-[10px] text-[#aa8222] uppercase font-extrabold">Church Office Admin (Full Access)</span>
                <span className="text-xs">fawany@gmail.com</span>
              </div>
              <span className="text-[10px] bg-[#d4af37] text-[#2a170e] px-2 py-0.5 rounded-md font-bold">Office Admin</span>
            </button>

            <div className="grid grid-cols-5 gap-1 pt-1">
              {(['Zone A', 'Zone B', 'Zone C', 'Zone D', 'Zone E'] as const).map((z) => (
                <button
                  key={z}
                  onClick={() => handleGoogleSignIn(`zone${z.replace('Zone ', '')}.leader@dcutawala.org`, `${z} Leader`, 'fellowship_leader', z)}
                  className="p-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-900 border border-emerald-200 text-center transition-colors cursor-pointer"
                >
                  <span className="block text-[9px] text-emerald-700 uppercase font-bold">Leader</span>
                  <span className="text-xs font-black">{z.replace('Zone ', '')}</span>
                </button>
              ))}
            </div>
            <p className="text-[10px] text-gray-500 text-center italic">
              Zone A leader only sees Zone A; Zone B only Zone B, etc.
            </p>
          </div>
        </div>

        {/* Toggle between sign in & sign up */}
        <div className="text-center text-xs text-gray-600 pt-1">
          {mode === 'signin' ? (
            <p>
              New leader or admin?{' '}
              <button
                onClick={() => setMode('signup')}
                className="font-bold text-[#2a170e] hover:underline cursor-pointer"
              >
                Create Account
              </button>
            </p>
          ) : (
            <p>
              Already have an account?{' '}
              <button
                onClick={() => setMode('signin')}
                className="font-bold text-[#2a170e] hover:underline cursor-pointer"
              >
                Sign In
              </button>
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
