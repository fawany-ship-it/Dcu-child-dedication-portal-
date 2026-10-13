import React, { useState } from 'react';
import { ChurchLogo } from './ChurchLogo';
import { Mail, Lock, Shield, CheckCircle2, AlertCircle, User, ArrowRight, UserPlus, Phone } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { ZONES } from '../data/zones';

export function AuthModal() {
  const { isAuthModalOpen, closeAuthModal, loginWithEmail, createAccount, loginWithGoogle } = useAuth();

  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [googleEmailInput, setGoogleEmailInput] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [requestedRole, setRequestedRole] = useState<'fellowship_leader' | 'admin'>('fellowship_leader');
  const [requestedZone, setRequestedZone] = useState<'Zone A' | 'Zone B' | 'Zone C' | 'Zone D' | 'Zone E'>('Zone A');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  if (!isAuthModalOpen) return null;

  const handleEmailSubmit = async (e: React.FormEvent) => {
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
      if (mode === 'signup') {
        if (!fullName.trim()) {
          setError('Please provide your full name.');
          setLoading(false);
          return;
        }
        await createAccount({
          email: email.trim(),
          name: fullName.trim(),
          password: password,
          role: requestedRole,
          assignedZone: requestedRole === 'fellowship_leader' ? requestedZone : undefined,
          phone: phone.trim()
        });
      } else {
        await loginWithEmail(email.trim(), password);
      }
      closeAuthModal();
    } catch (err: any) {
      setError(err?.message || 'Authentication failed. Please verify credentials.');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async (customEmail?: string, customName?: string, role?: any, zone?: any) => {
    setLoading(true);
    setError('');
    const emailToUse = customEmail || (googleEmailInput.trim().includes('@') ? googleEmailInput.trim() : 'fawany@gmail.com');
    const nameToUse = customName || emailToUse.split('@')[0];

    try {
      await loginWithGoogle({
        email: emailToUse,
        name: nameToUse,
        role: role,
        assignedZone: zone
      });
      closeAuthModal();
    } catch (err: any) {
      setError('Google Sign-in failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-8 space-y-5 shadow-2xl border-2 border-[#d4af37]/60 animate-in fade-in zoom-in-95 duration-150 my-6">
        {/* Header */}
        <div className="text-center space-y-2 relative">
          <button
            onClick={closeAuthModal}
            className="absolute right-0 top-0 text-gray-400 hover:text-gray-700 font-bold p-1 cursor-pointer text-lg"
          >
            ✕
          </button>
          <div className="flex justify-center mb-1">
            <ChurchLogo size={60} className="shadow-lg" />
          </div>
          <h2 className="text-xl sm:text-2xl font-cinzel font-bold text-[#2a170e]">
            {mode === 'signin' ? 'Leadership & Staff Log In' : 'Create Leadership Account'}
          </h2>
          <p className="text-xs text-gray-600 max-w-sm mx-auto">
            Fellowship Zone Leaders and Church Office Admins must sign in to review, confirm, and compile child dedication forms.
          </p>
        </div>

        {/* Tab switch between Sign In and Create Account */}
        <div className="flex rounded-xl bg-gray-100 p-1 border border-gray-200">
          <button
            type="button"
            onClick={() => { setMode('signin'); setError(''); }}
            className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${
              mode === 'signin'
                ? 'bg-[#2a170e] text-[#ffd700] shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Sign In with Google / Email
          </button>
          <button
            type="button"
            onClick={() => { setMode('signup'); setError(''); }}
            className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
              mode === 'signup'
                ? 'bg-[#2a170e] text-[#ffd700] shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <UserPlus className="w-3.5 h-3.5" />
            Create Account
          </button>
        </div>

        {error && (
          <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {mode === 'signin' ? (
          <div className="space-y-4">
            {/* Google One-Click / Custom Email Section */}
            <div className="space-y-2 p-4 rounded-2xl bg-amber-50/50 border border-[#d4af37]/40">
              <label className="block text-xs font-bold text-[#2a170e] uppercase">
                1. Sign In with Google
              </label>
              <div className="flex gap-2">
                <input
                  type="email"
                  value={googleEmailInput}
                  onChange={(e) => setGoogleEmailInput(e.target.value)}
                  placeholder="Enter your Google email (e.g. fawany@gmail.com)"
                  className="flex-1 p-2.5 text-xs border border-gray-300 rounded-xl bg-white focus:ring-2 focus:ring-[#d4af37] outline-hidden"
                />
                <button
                  type="button"
                  disabled={loading}
                  onClick={() => handleGoogleSignIn()}
                  className="bg-[#2a170e] hover:bg-[#3d2314] text-[#ffd700] border border-[#d4af37] px-4 py-2.5 rounded-xl font-bold text-xs flex items-center gap-2 shadow-xs transition-all cursor-pointer whitespace-nowrap"
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
                  Google Sign-In
                </button>
              </div>
              <p className="text-[10px] text-gray-500 italic">
                Church admin (`fawany@gmail.com`) automatically gets office compile rights.
              </p>
            </div>

            <div className="flex items-center my-1">
              <div className="flex-1 border-t border-gray-200" />
              <span className="px-3 text-[10px] text-gray-400 uppercase font-semibold">Or with Email & Password</span>
              <div className="flex-1 border-t border-gray-200" />
            </div>

            {/* Standard Email Login */}
            <form onSubmit={handleEmailSubmit} className="space-y-3">
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
                    className="w-full pl-9 pr-3 py-2 text-xs sm:text-sm border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#d4af37] outline-hidden"
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
                    className="w-full pl-9 pr-3 py-2 text-xs sm:text-sm border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#d4af37] outline-hidden"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 bg-[#2a170e] hover:bg-[#3d2314] text-[#ffd700] border-2 border-[#d4af37] font-bold rounded-xl text-xs sm:text-sm shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                {loading ? 'Signing In...' : 'Sign In'}
                <ArrowRight className="w-4 h-4" />
              </button>
            </form>

            {/* Quick 1-Click Verification for Leadership Committee */}
            <div className="pt-2 border-t border-gray-100 space-y-1.5">
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider text-center">
                Quick 1-Click Role Login (Demo & Committee)
              </p>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => handleGoogleSignIn('fawany@gmail.com', 'Fawany (Administrator)', 'admin')}
                  className="p-2 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 text-left text-xs font-bold cursor-pointer transition-colors"
                >
                  <span className="block text-[9px] text-[#aa8222] uppercase font-extrabold">Office Admin</span>
                  fawany@gmail.com
                </button>

                <button
                  type="button"
                  onClick={() => handleGoogleSignIn('zoneA.leader@dcutawala.org', 'Zone A Leader', 'fellowship_leader', 'Zone A')}
                  className="p-2 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-900 border border-emerald-200 text-left text-xs font-bold cursor-pointer transition-colors"
                >
                  <span className="block text-[9px] text-emerald-700 uppercase font-extrabold">Zone A Leader</span>
                  Zone A Only
                </button>
              </div>

              <div className="grid grid-cols-4 gap-1 pt-1">
                {(['Zone B', 'Zone C', 'Zone D', 'Zone E'] as const).map((z) => (
                  <button
                    key={z}
                    type="button"
                    onClick={() => handleGoogleSignIn(`zone${z.replace('Zone ', '')}.leader@dcutawala.org`, `${z} Leader`, 'fellowship_leader', z)}
                    className="p-1 rounded-lg bg-gray-50 hover:bg-emerald-50 text-gray-800 hover:text-emerald-900 border border-gray-200 text-center text-[10px] font-bold cursor-pointer transition-colors"
                  >
                    {z}
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : (
          /* Create Account Form */
          <form onSubmit={handleEmailSubmit} className="space-y-3.5">
            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
                Full Name
              </label>
              <div className="relative">
                <User className="w-4 h-4 text-gray-400 absolute left-3 top-3" />
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="e.g. Leader Peter Mwangi"
                  className="w-full pl-9 pr-3 py-2 text-xs sm:text-sm border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#d4af37] outline-hidden"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
                    placeholder="leader@gmail.com"
                    className="w-full pl-9 pr-3 py-2 text-xs sm:text-sm border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#d4af37] outline-hidden"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
                  Phone (Optional)
                </label>
                <div className="relative">
                  <Phone className="w-4 h-4 text-gray-400 absolute left-3 top-3" />
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="0722 000 000"
                    className="w-full pl-9 pr-3 py-2 text-xs sm:text-sm border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#d4af37] outline-hidden"
                  />
                </div>
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
                  placeholder="Create a password"
                  className="w-full pl-9 pr-3 py-2 text-xs sm:text-sm border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#d4af37] outline-hidden"
                />
              </div>
            </div>

            <div className="space-y-3 p-3 bg-amber-50/50 rounded-2xl border border-amber-200/80">
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
                  Role in Church
                </label>
                <select
                  value={requestedRole}
                  onChange={(e) => setRequestedRole(e.target.value as any)}
                  className="w-full p-2 text-xs sm:text-sm border border-gray-300 rounded-xl bg-white font-medium"
                >
                  <option value="fellowship_leader">Fellowship Zone Leader (Confirms Zone A to E)</option>
                  <option value="admin">Church Office Administrator / Pastoral Team</option>
                </select>
              </div>

              {requestedRole === 'fellowship_leader' && (
                <div>
                  <label className="block text-xs font-bold text-[#2a170e] uppercase mb-1 flex items-center justify-between">
                    <span>Assigned Fellowship Zone:</span>
                    <span className="text-amber-800 font-extrabold">{requestedZone}</span>
                  </label>
                  <select
                    value={requestedZone}
                    onChange={(e) => setRequestedZone(e.target.value as any)}
                    className="w-full p-2 text-xs sm:text-sm border-2 border-[#d4af37] rounded-xl bg-white font-bold text-[#2a170e]"
                  >
                    <option value="Zone A">Zone A (Doxa, Utukufu, Glory, Judea, Koinonia, Jerusalem, Zion, Favour, Agape)</option>
                    <option value="Zone B">Zone B (Neema, Sifa, Bethsaida, Baraka, Nazareth, Bethel, Kingdom, Rehoboth, Mamlaka, Ebenezer)</option>
                    <option value="Zone C">Zone C (Dominion, Overcomers, Elevation, Genesis, Shammah, Adonai, Shalom, Vision)</option>
                    <option value="Zone D">Zone D (Transformers, Imani, Tumaini, Berea, Theophilus, Pillars, Wisdom, Mt. Moriah)</option>
                    <option value="Zone E">Zone E (Shekinah, Believers, Shiloh, Eden, Peniel, Goshen, Salem, Uhai, Antioch, Macedonia)</option>
                  </select>
                  <p className="text-[10px] text-gray-500 mt-1 italic">
                    Strict isolation: As a {requestedZone} leader, you will only see and confirm members in {requestedZone}.
                  </p>
                </div>
              )}
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-[#2a170e] hover:bg-[#3d2314] text-[#ffd700] border-2 border-[#d4af37] font-bold rounded-xl text-xs sm:text-sm shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              {loading ? 'Creating Account...' : 'Register & Log In'}
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
