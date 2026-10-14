import React, { useState, useEffect } from 'react';
import { ChurchLogo } from './ChurchLogo';
import { Mail, Lock, Shield, CheckCircle2, AlertCircle, User, ArrowRight, Phone, KeyRound, Sparkles } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';

export function AuthModal() {
  const { 
    isAuthModalOpen, 
    closeAuthModal, 
    loginWithEmail, 
    createAccount, 
    loginWithGoogle, 
    acceptInvitation 
  } = useAuth();

  const [tab, setTab] = useState<'signin' | 'signup'>('signin');
  
  // Sign in fields - prefilled with default admin for instant convenience
  const [email, setEmail] = useState('fawany@gmail.com');
  const [password, setPassword] = useState('DcuAdmin2026!#');

  // Sign up fields
  const [signupName, setSignupName] = useState('');
  const [signupEmail, setSignupEmail] = useState('');
  const [signupPhone, setSignupPhone] = useState('');
  const [signupPassword, setSignupPassword] = useState('');

  // Staff Invite drawer toggle
  const [showInviteDrawer, setShowInviteDrawer] = useState(false);
  const [inviteToken, setInviteToken] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [invitePassword, setInvitePassword] = useState('');
  const [inviteName, setInviteName] = useState('');

  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [loading, setLoading] = useState(false);

  // Auto-detect invitation tokens in URL
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const token = params.get('invite');
      const em = params.get('email');
      if (token) {
        setShowInviteDrawer(true);
        setInviteToken(token);
        if (em) setInviteEmail(em);
      }
    }
  }, []);

  if (!isAuthModalOpen) return null;

  // 1. Standard Sign In
  const handleSignIn = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setError('');
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes('@')) {
      setError('Please enter a valid email address.');
      return;
    }
    if (!password) {
      setError('Please enter your password.');
      return;
    }

    setLoading(true);
    try {
      await loginWithEmail(cleanEmail, password);
      setSuccessMsg('Signed in successfully!');
      setTimeout(() => closeAuthModal(), 500);
    } catch (err: any) {
      setError(err?.message || 'Authentication failed. Please verify your credentials.');
    } finally {
      setLoading(false);
    }
  };

  // 2. Direct 1-Click Super Admin Sign In
  const handleInstantAdminLogin = async () => {
    setError('');
    setEmail('fawany@gmail.com');
    setPassword('DcuAdmin2026!#');
    setLoading(true);
    try {
      await loginWithEmail('fawany@gmail.com', 'DcuAdmin2026!#');
      setSuccessMsg('Welcome back, Super Administrator!');
      setTimeout(() => closeAuthModal(), 500);
    } catch (err: any) {
      setError(err?.message || 'Sign in failed.');
    } finally {
      setLoading(false);
    }
  };

  // 3. Continue with Google
  const handleGoogleLogin = async (targetEmail = 'fawany@gmail.com') => {
    setError('');
    setLoading(true);
    try {
      await loginWithGoogle({
        email: targetEmail,
        name: targetEmail.split('@')[0]
      });
      setSuccessMsg(`Signed in with Google (${targetEmail})!`);
      setTimeout(() => closeAuthModal(), 500);
    } catch (err: any) {
      setError(err?.message || 'Google authentication failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // 4. Parent Sign Up
  const handleParentSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const cleanEmail = signupEmail.trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes('@')) {
      setError('Please enter a valid email address.');
      return;
    }
    if (!signupName.trim()) {
      setError('Please enter your full name.');
      return;
    }
    if (signupPassword.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }

    setLoading(true);
    try {
      await createAccount({
        email: cleanEmail,
        name: signupName.trim(),
        phone: signupPhone.trim(),
        password: signupPassword
      });
      setSuccessMsg('Parent account created successfully!');
      setTimeout(() => closeAuthModal(), 600);
    } catch (err: any) {
      setError(err?.message || 'Account registration failed.');
    } finally {
      setLoading(false);
    }
  };

  // 5. Accept Staff Invite
  const handleStaffInviteSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!inviteToken.trim()) {
      setError('Please enter your invitation token.');
      return;
    }
    if (!inviteEmail.trim() || !inviteEmail.includes('@')) {
      setError('Please enter the email address the invitation was sent to.');
      return;
    }
    if (invitePassword.length < 6) {
      setError('Please choose a password of at least 6 characters.');
      return;
    }

    setLoading(true);
    try {
      await acceptInvitation({
        token: inviteToken.trim(),
        email: inviteEmail.trim().toLowerCase(),
        password: invitePassword,
        name: inviteName.trim()
      });
      setSuccessMsg('Staff invitation verified and activated!');
      setTimeout(() => closeAuthModal(), 700);
    } catch (err: any) {
      setError(err?.message || 'Failed to activate staff invitation.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-3xl max-w-md w-full p-6 sm:p-8 space-y-5 shadow-2xl border-2 border-[#d4af37]/60 animate-in fade-in zoom-in-95 duration-150 my-6">
        
        {/* Header */}
        <div className="text-center relative">
          <button
            onClick={closeAuthModal}
            className="absolute right-0 top-0 text-gray-400 hover:text-gray-700 font-bold p-1 cursor-pointer text-xl"
            title="Close"
          >
            ✕
          </button>
          <div className="flex justify-center mb-2">
            <ChurchLogo size={58} className="shadow-lg" />
          </div>
          <h2 className="text-xl sm:text-2xl font-cinzel font-bold text-[#2a170e]">
            {tab === 'signin' ? 'Sign In to DCU' : 'Create an Account'}
          </h2>
          <p className="text-xs text-gray-600 mt-1">
            Deliverance Church Utawala Child Dedication Portal
          </p>
        </div>

        {/* 2 Simple Tabs: Sign In | Sign Up */}
        <div className="flex rounded-xl bg-gray-100 p-1 border border-gray-200">
          <button
            type="button"
            onClick={() => { setTab('signin'); setError(''); setSuccessMsg(''); }}
            className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${
              tab === 'signin'
                ? 'bg-[#2a170e] text-[#ffd700] shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Sign In
          </button>
          <button
            type="button"
            onClick={() => { setTab('signup'); setError(''); setSuccessMsg(''); }}
            className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${
              tab === 'signup'
                ? 'bg-[#2a170e] text-[#ffd700] shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Sign Up (Parents)
          </button>
        </div>

        {/* Alert Messages */}
        {error && (
          <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {successMsg && (
          <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* ==================================================== */}
        {/* TAB 1: EASY SIGN IN */}
        {/* ==================================================== */}
        {tab === 'signin' && !showInviteDrawer && (
          <div className="space-y-4">
            {/* 1. Big Google Button */}
            <button
              type="button"
              disabled={loading}
              onClick={() => handleGoogleLogin('fawany@gmail.com')}
              className="w-full py-2.5 px-4 bg-white hover:bg-gray-50 text-gray-800 border-2 border-gray-300 hover:border-[#d4af37] font-bold rounded-xl text-xs sm:text-sm flex items-center justify-center gap-2.5 shadow-xs transition-all cursor-pointer"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
              </svg>
              <span>Continue with Google</span>
            </button>

            <div className="flex items-center my-2">
              <div className="flex-1 border-t border-gray-200" />
              <span className="px-3 text-[10px] text-gray-400 uppercase font-semibold">Or sign in with email</span>
              <div className="flex-1 border-t border-gray-200" />
            </div>

            {/* 2. Simple Email & Password Form */}
            <form onSubmit={handleSignIn} className="space-y-3">
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
                    placeholder="fawany@gmail.com"
                    className="w-full pl-9 pr-3 py-2 text-xs sm:text-sm border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#d4af37] outline-hidden font-medium"
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

            {/* 3. 1-Click Fast Super Admin Shortcut */}
            <div className="pt-2 border-t border-gray-100 flex items-center justify-between text-xs">
              <span className="text-[11px] text-gray-500">Super Admin access:</span>
              <button
                type="button"
                disabled={loading}
                onClick={handleInstantAdminLogin}
                className="text-xs font-bold text-[#2a170e] hover:text-amber-800 bg-amber-100/80 hover:bg-amber-200/80 px-2.5 py-1 rounded-lg border border-amber-300 flex items-center gap-1 cursor-pointer transition-colors"
                title="1-Click Instant Sign In as Super Admin"
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                <span>1-Click Super Admin</span>
              </button>
            </div>

            {/* Staff invite link */}
            <div className="text-center pt-1">
              <button
                type="button"
                onClick={() => { setShowInviteDrawer(true); setError(''); }}
                className="text-[11px] text-gray-500 hover:text-[#2a170e] hover:underline cursor-pointer"
              >
                Have a staff invitation token? Click here
              </button>
            </div>
          </div>
        )}

        {/* ==================================================== */}
        {/* TAB 2: SIMPLE SIGN UP (PARENTS) */}
        {/* ==================================================== */}
        {tab === 'signup' && !showInviteDrawer && (
          <form onSubmit={handleParentSignUp} className="space-y-3">
            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
                Your Full Name
              </label>
              <div className="relative">
                <User className="w-4 h-4 text-gray-400 absolute left-3 top-3" />
                <input
                  type="text"
                  required
                  value={signupName}
                  onChange={(e) => setSignupName(e.target.value)}
                  placeholder="e.g. Mary Wanjiku Kamau"
                  className="w-full pl-9 pr-3 py-2 text-xs sm:text-sm border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#d4af37] outline-hidden"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
                Email Address
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-gray-400 absolute left-3 top-3" />
                <input
                  type="email"
                  required
                  value={signupEmail}
                  onChange={(e) => setSignupEmail(e.target.value)}
                  placeholder="parent@domain.com"
                  className="w-full pl-9 pr-3 py-2 text-xs sm:text-sm border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#d4af37] outline-hidden"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
                Phone Number (Optional)
              </label>
              <div className="relative">
                <Phone className="w-4 h-4 text-gray-400 absolute left-3 top-3" />
                <input
                  type="tel"
                  value={signupPhone}
                  onChange={(e) => setSignupPhone(e.target.value)}
                  placeholder="0722 000 000"
                  className="w-full pl-9 pr-3 py-2 text-xs sm:text-sm border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#d4af37] outline-hidden"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
                Password (min 6 characters)
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-gray-400 absolute left-3 top-3" />
                <input
                  type="password"
                  required
                  value={signupPassword}
                  onChange={(e) => setSignupPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-9 pr-3 py-2 text-xs sm:text-sm border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#d4af37] outline-hidden"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 bg-[#2a170e] hover:bg-[#3d2314] text-[#ffd700] border-2 border-[#d4af37] font-bold rounded-xl text-xs sm:text-sm shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer mt-4"
            >
              {loading ? 'Creating Account...' : 'Register as Parent'}
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>
        )}

        {/* ==================================================== */}
        {/* OPTIONAL DRAWER: STAFF INVITATION ACTIVATION */}
        {/* ==================================================== */}
        {showInviteDrawer && (
          <form onSubmit={handleStaffInviteSubmit} className="space-y-3">
            <div className="flex items-center justify-between pb-1 border-b border-gray-200">
              <span className="text-xs font-bold text-[#2a170e] flex items-center gap-1.5 uppercase">
                <KeyRound className="w-4 h-4 text-amber-700" />
                Staff Invitation Activation
              </span>
              <button
                type="button"
                onClick={() => { setShowInviteDrawer(false); setError(''); }}
                className="text-[11px] text-gray-500 hover:text-gray-800 cursor-pointer"
              >
                Back to Sign In
              </button>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
                Single-Use Token
              </label>
              <input
                type="text"
                required
                value={inviteToken}
                onChange={(e) => setInviteToken(e.target.value)}
                placeholder="Paste invitation token"
                className="w-full p-2 text-xs border border-gray-300 rounded-xl font-mono focus:ring-2 focus:ring-[#d4af37] outline-hidden"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
                Invited Email Address
              </label>
              <input
                type="email"
                required
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                placeholder="staff.email@dcutawala.org"
                className="w-full p-2 text-xs border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#d4af37] outline-hidden"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
                Your Full Name (Optional)
              </label>
              <input
                type="text"
                value={inviteName}
                onChange={(e) => setInviteName(e.target.value)}
                placeholder="Full Legal Name"
                className="w-full p-2 text-xs border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#d4af37] outline-hidden"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
                Choose Password (min 6 characters)
              </label>
              <input
                type="password"
                required
                value={invitePassword}
                onChange={(e) => setInvitePassword(e.target.value)}
                placeholder="••••••••"
                className="w-full p-2 text-xs border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#d4af37] outline-hidden"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 bg-[#2a170e] hover:bg-[#3d2314] text-[#ffd700] border-2 border-[#d4af37] font-bold rounded-xl text-xs sm:text-sm shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              {loading ? 'Activating Staff Account...' : 'Activate Staff Account'}
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
