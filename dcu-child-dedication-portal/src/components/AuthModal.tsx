import React, { useState, useEffect } from 'react';
import { ChurchLogo } from './ChurchLogo';
import { Mail, Lock, Shield, CheckCircle2, AlertCircle, User, ArrowRight, UserPlus, Phone, KeyRound, Sparkles } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';

export function AuthModal() {
  const { isAuthModalOpen, closeAuthModal, loginWithEmail, createAccount, loginWithGoogle, acceptInvitation } = useAuth();

  const [mode, setMode] = useState<'signin' | 'parent_signup' | 'accept_invite'>('signin');
  const [googleEmailInput, setGoogleEmailInput] = useState('');
  const [googleInviteToken, setGoogleInviteToken] = useState('');
  
  // Standard fields
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');

  // Staff Invitation fields
  const [inviteToken, setInviteToken] = useState('');
  const [inviteDetails, setInviteDetails] = useState<any>(null);
  const [checkingInvite, setCheckingInvite] = useState(false);

  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [loading, setLoading] = useState(false);

  // Check URL query parameters for invitation token
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const tokenFromUrl = params.get('invite');
      const emailFromUrl = params.get('email');
      if (tokenFromUrl) {
        setInviteToken(tokenFromUrl);
        if (emailFromUrl) setEmail(emailFromUrl);
        setMode('accept_invite');
        verifyInviteToken(tokenFromUrl, emailFromUrl || undefined);
      }
    }
  }, []);

  const verifyInviteToken = async (tok: string, em?: string) => {
    if (!tok.trim()) return;
    setCheckingInvite(true);
    setError('');
    try {
      const details = await api.verifyInvitation(tok.trim(), em);
      setInviteDetails(details);
      if (details.email) setEmail(details.email);
      if (details.name) setFullName(details.name);
    } catch (err: any) {
      setInviteDetails(null);
      setError(err?.message || 'Invalid or expired invitation token.');
    } finally {
      setCheckingInvite(false);
    }
  };

  if (!isAuthModalOpen) return null;

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!email.trim() || !email.includes('@')) {
      setError('Please provide a valid email address.');
      return;
    }
    if (!password) {
      setError('Please enter your password.');
      return;
    }

    setLoading(true);
    try {
      await loginWithEmail(email.trim(), password);
      closeAuthModal();
    } catch (err: any) {
      setError(err?.message || 'Authentication failed. Please verify credentials.');
    } finally {
      setLoading(false);
    }
  };

  const handleParentSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!email.trim() || !email.includes('@')) {
      setError('Please provide a valid email address.');
      return;
    }
    if (!fullName.trim()) {
      setError('Please enter your full legal name.');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }

    setLoading(true);
    try {
      await createAccount({
        email: email.trim(),
        name: fullName.trim(),
        password,
        phone: phone.trim()
      });
      closeAuthModal();
    } catch (err: any) {
      setError(err?.message || 'Registration failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleAcceptInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!inviteToken.trim()) {
      setError('Staff invitation token is required.');
      return;
    }
    if (!email.trim() || !email.includes('@')) {
      setError('Please provide your verified email matching this invitation.');
      return;
    }
    if (password.length < 6) {
      setError('Please choose a secure password (min 6 characters).');
      return;
    }

    setLoading(true);
    try {
      await acceptInvitation({
        token: inviteToken.trim(),
        email: email.trim(),
        password,
        name: fullName.trim(),
        phone: phone.trim()
      });
      setSuccessMsg('Staff account successfully authorized and activated!');
      setTimeout(() => {
        closeAuthModal();
      }, 1000);
    } catch (err: any) {
      setError(err?.message || 'Failed to activate staff invitation.');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async (customEmail?: string, customName?: string) => {
    setLoading(true);
    setError('');
    const emailToUse = customEmail || (googleEmailInput.trim().includes('@') ? googleEmailInput.trim() : '');

    if (!emailToUse) {
      setError('Please enter your Google email address.');
      setLoading(false);
      return;
    }

    try {
      await loginWithGoogle({
        email: emailToUse,
        name: customName || emailToUse.split('@')[0],
        invitationToken: googleInviteToken.trim() || undefined
      });
      closeAuthModal();
    } catch (err: any) {
      setError(err?.message || 'Google Sign-in failed. Please try again.');
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
            {mode === 'signin' && 'DCU Portal Sign In'}
            {mode === 'parent_signup' && 'Create Parent Account'}
            {mode === 'accept_invite' && 'Activate Staff Invitation'}
          </h2>
          <p className="text-xs text-gray-600 max-w-sm mx-auto">
            {mode === 'signin' && 'Sign in to access your child dedication records or staff management tools.'}
            {mode === 'parent_signup' && 'Register to manage your family dedication submissions and track review status.'}
            {mode === 'accept_invite' && 'Secure single-use token activation for authorized church leadership and staff.'}
          </p>
        </div>

        {/* Tab switch */}
        <div className="flex rounded-xl bg-gray-100 p-1 border border-gray-200">
          <button
            type="button"
            onClick={() => { setMode('signin'); setError(''); setSuccessMsg(''); }}
            className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${
              mode === 'signin'
                ? 'bg-[#2a170e] text-[#ffd700] shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Sign In
          </button>
          <button
            type="button"
            onClick={() => { setMode('parent_signup'); setError(''); setSuccessMsg(''); }}
            className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${
              mode === 'parent_signup'
                ? 'bg-[#2a170e] text-[#ffd700] shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Parent Register
          </button>
          <button
            type="button"
            onClick={() => { setMode('accept_invite'); setError(''); setSuccessMsg(''); }}
            className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1 ${
              mode === 'accept_invite'
                ? 'bg-[#2a170e] text-[#ffd700] shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <KeyRound className="w-3 h-3 text-[#d4af37]" />
            Staff Invite
          </button>
        </div>

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

        {/* MODE 1: SIGN IN */}
        {mode === 'signin' && (
          <div className="space-y-4">
            {/* Google Authentication */}
            <div className="space-y-2 p-4 rounded-2xl bg-amber-50/50 border border-[#d4af37]/40">
              <label className="block text-xs font-bold text-[#2a170e] uppercase">
                Sign In with Google
              </label>
              <div className="flex gap-2">
                <input
                  type="email"
                  value={googleEmailInput}
                  onChange={(e) => setGoogleEmailInput(e.target.value)}
                  placeholder="Enter your authorized Google email"
                  className="flex-1 p-2.5 text-xs border border-gray-300 rounded-xl bg-white focus:ring-2 focus:ring-[#d4af37] outline-hidden"
                />
                <button
                  type="button"
                  disabled={loading}
                  onClick={() => handleGoogleSignIn()}
                  className="bg-[#2a170e] hover:bg-[#3d2314] text-[#ffd700] border border-[#d4af37] px-4 py-2.5 rounded-xl font-bold text-xs flex items-center gap-2 shadow-xs transition-all cursor-pointer whitespace-nowrap"
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                  </svg>
                  Google Sign-In
                </button>
              </div>
              <p className="text-[10px] text-gray-500">
                Authorized staff accounts are authenticated with server-verified credentials.
              </p>
            </div>

            <div className="flex items-center my-1">
              <div className="flex-1 border-t border-gray-200" />
              <span className="px-3 text-[10px] text-gray-400 uppercase font-semibold">Or with Email & Password</span>
              <div className="flex-1 border-t border-gray-200" />
            </div>

            {/* Standard Email Login */}
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
                    placeholder="your.email@domain.com"
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
                {loading ? 'Authenticating...' : 'Sign In'}
                <ArrowRight className="w-4 h-4" />
              </button>
            </form>

            <div className="p-3 rounded-xl bg-gray-50 border border-gray-200 text-[11px] text-gray-600 space-y-1">
              <p className="font-semibold text-gray-800 flex items-center gap-1.5">
                <Shield className="w-3.5 h-3.5 text-amber-700" />
                Church Staff & Administration Policy
              </p>
              <p>
                Privileged administrative roles are restricted to invitation-only access. Visitors cannot self-assign staff privileges.
              </p>
            </div>
          </div>
        )}

        {/* MODE 2: PARENT REGISTRATION */}
        {mode === 'parent_signup' && (
          <form onSubmit={handleParentSignup} className="space-y-3.5">
            <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200 text-xs text-emerald-900 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
              <span>Public parent registration creates an account to manage your child dedication forms.</span>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
                Parent / Guardian Full Name
              </label>
              <div className="relative">
                <User className="w-4 h-4 text-gray-400 absolute left-3 top-3" />
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="e.g. Mary Wanjiku Kamau"
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
                    placeholder="parent@gmail.com"
                    className="w-full pl-9 pr-3 py-2 text-xs sm:text-sm border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#d4af37] outline-hidden"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
                  Phone Number
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
                Password (min 6 characters)
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
              {loading ? 'Creating Parent Account...' : 'Register as Parent'}
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>
        )}

        {/* MODE 3: ACCEPT STAFF INVITATION */}
        {mode === 'accept_invite' && (
          <form onSubmit={handleAcceptInvite} className="space-y-3.5">
            <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-xs text-amber-900 space-y-1">
              <p className="font-bold flex items-center gap-1.5">
                <KeyRound className="w-4 h-4 text-[#aa8222]" />
                Single-Use Staff Invitation Activation
              </p>
              <p>
                Enter the secret invitation token issued by the Super Administrator to authorize and activate your staff account.
              </p>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
                Invitation Token
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  required
                  value={inviteToken}
                  onChange={(e) => {
                    setInviteToken(e.target.value);
                    if (e.target.value.length > 10) {
                      verifyInviteToken(e.target.value, email);
                    }
                  }}
                  placeholder="Paste your 48-character invitation token"
                  className="flex-1 p-2 text-xs font-mono border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#d4af37] outline-hidden"
                />
                <button
                  type="button"
                  disabled={checkingInvite || !inviteToken}
                  onClick={() => verifyInviteToken(inviteToken, email)}
                  className="px-3 py-2 bg-gray-100 hover:bg-gray-200 text-xs font-bold rounded-xl text-gray-700 cursor-pointer"
                >
                  {checkingInvite ? 'Verifying...' : 'Verify'}
                </button>
              </div>
            </div>

            {inviteDetails && (
              <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-900 space-y-1">
                <p className="font-bold">✓ Valid Invitation Verified:</p>
                <p>Role: <span className="font-mono uppercase font-bold text-[#2a170e]">{inviteDetails.role}</span></p>
                {inviteDetails.assignedZone && (
                  <p>Assigned Fellowship Zone: <span className="font-bold">{inviteDetails.assignedZone}</span></p>
                )}
                <p>Authorized for: <span className="font-bold">{inviteDetails.email}</span></p>
              </div>
            )}

            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
                Invited Email Address
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Must match invited email"
                className="w-full p-2 text-xs sm:text-sm border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#d4af37] outline-hidden"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
                  Full Name
                </label>
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Your full name"
                  className="w-full p-2 text-xs sm:text-sm border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#d4af37] outline-hidden"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
                  Phone (Optional)
                </label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="0722 000 000"
                  className="w-full p-2 text-xs sm:text-sm border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#d4af37] outline-hidden"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
                Create Strong Password (min 6 characters)
              </label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full p-2 text-xs sm:text-sm border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#d4af37] outline-hidden"
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
