import React, { useState, useEffect } from 'react';
import { ChurchLogo } from './ChurchLogo';
import { 
  Mail, 
  Lock, 
  Shield, 
  CheckCircle2, 
  AlertCircle, 
  User, 
  ArrowRight, 
  KeyRound, 
  Eye, 
  EyeOff, 
  Sparkles
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

interface AuthModalProps {
  onNavigate?: (tab: string) => void;
}

export function AuthModal({ onNavigate }: AuthModalProps) {
  const { 
    isAuthModalOpen, 
    closeAuthModal, 
    loginWithEmail, 
    loginWithGoogle, 
    acceptInvitation 
  } = useAuth();

  const [tab, setTab] = useState<'signin' | 'invite'>('signin');
  
  // Sign in fields - clean and empty by default
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Staff Invite activation fields
  const [inviteToken, setInviteToken] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [invitePassword, setInvitePassword] = useState('');
  const [showInvitePassword, setShowInvitePassword] = useState(false);
  const [inviteName, setInviteName] = useState('');

  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [loading, setLoading] = useState(false);

  // Auto-detect invitation tokens in URL (?invite=...&email=...)
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const token = params.get('invite');
      const em = params.get('email');
      if (token) {
        setTab('invite');
        setInviteToken(token);
        if (em) setInviteEmail(em);
      }
    }
  }, [isAuthModalOpen]);

  if (!isAuthModalOpen) return null;

  // 1. Standard Email & Password Sign In
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
      const user = await loginWithEmail(cleanEmail, password);
      const roleTitle = user.role === 'super_admin' 
        ? 'Super Administrator' 
        : user.role === 'fellowship_leader'
        ? `${user.assignedZone || 'Fellowship'} Leader`
        : user.role.replace('_', ' ');
      setSuccessMsg(`Welcome, ${user.name}! Signed in as ${roleTitle}.`);
      setTimeout(() => closeAuthModal(), 500);
    } catch (err: any) {
      setError(err?.message || 'Authentication failed. Please verify your email and password.');
    } finally {
      setLoading(false);
    }
  };

  // 2. Continue with Google
  const handleGoogleLogin = async () => {
    setError('');
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes('@')) {
      setError('Please enter your Google account email in the Email Address field above, then click Continue with Google.');
      return;
    }

    setLoading(true);
    try {
      const user = await loginWithGoogle({
        email: cleanEmail,
        name: cleanEmail.split('@')[0]
      });

      if (user.role === 'parent') {
        setError('Notice: This Google account is not registered as an authorized church leader. Fellowship leaders and pastors must be invited by Church Administration.');
        setLoading(false);
        return;
      }

      const roleTitle = user.role === 'super_admin' 
        ? 'Super Administrator' 
        : user.role === 'fellowship_leader'
        ? `${user.assignedZone || 'Fellowship'} Leader`
        : user.role.replace('_', ' ');
      setSuccessMsg(`Authenticated via Google as ${user.email} (${roleTitle})!`);
      setTimeout(() => closeAuthModal(), 500);
    } catch (err: any) {
      setError(err?.message || 'Google authentication failed. Please sign in with your email & password.');
    } finally {
      setLoading(false);
    }
  };

  // 3. Accept Staff / Leader Invite
  const handleStaffInviteSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!inviteToken.trim()) {
      setError('Please enter your single-use invitation token.');
      return;
    }
    if (!inviteEmail.trim() || !inviteEmail.includes('@')) {
      setError('Please enter the email address your invitation was sent to.');
      return;
    }
    if (invitePassword.length < 6) {
      setError('Please choose a secure password of at least 6 characters.');
      return;
    }

    setLoading(true);
    try {
      const user = await acceptInvitation({
        token: inviteToken.trim(),
        email: inviteEmail.trim().toLowerCase(),
        password: invitePassword,
        name: inviteName.trim()
      });
      const roleTitle = user.role === 'fellowship_leader' 
        ? `${user.assignedZone || 'Fellowship'} Leader` 
        : user.role.replace('_', ' ');
      setSuccessMsg(`Invitation verified! Account activated as ${roleTitle}.`);
      setTimeout(() => closeAuthModal(), 600);
    } catch (err: any) {
      setError(err?.message || 'Failed to activate invitation. Please check token and email.');
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
            {tab === 'signin' ? 'Sign In to DCU Portal' : 'Activate Leader Account'}
          </h2>
          <p className="text-xs text-gray-600 mt-1">
            Deliverance Church Utawala • Ministry Leadership
          </p>
        </div>

        {/* 2 Clean Tabs: Sign In | Activate Invitation */}
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
            onClick={() => { setTab('invite'); setError(''); setSuccessMsg(''); }}
            className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
              tab === 'invite'
                ? 'bg-[#2a170e] text-[#ffd700] shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <KeyRound className="w-3.5 h-3.5" />
            <span>Activate Invitation</span>
          </button>
        </div>

        {/* Alert Messages */}
        {error && (
          <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
            <span className="font-medium leading-relaxed">{error}</span>
          </div>
        )}

        {successMsg && (
          <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span className="font-semibold">{successMsg}</span>
          </div>
        )}

        {/* ==================================================== */}
        {/* TAB 1: CLEAN SIGN IN (EMAIL OR GOOGLE) */}
        {/* ==================================================== */}
        {tab === 'signin' && (
          <div className="space-y-4">
            
            {/* Continue with Google */}
            <button
              type="button"
              disabled={loading}
              onClick={handleGoogleLogin}
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

            <div className="flex items-center my-1.5">
              <div className="flex-1 border-t border-gray-200" />
              <span className="px-3 text-[10px] text-gray-400 uppercase font-semibold">Or sign in with email</span>
              <div className="flex-1 border-t border-gray-200" />
            </div>

            {/* Email & Password Form */}
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
                    placeholder="leader@dcutawala.org or pastor@dcutawala.org"
                    className="w-full pl-9 pr-3 py-2.5 text-xs sm:text-sm border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#d4af37] outline-hidden font-medium"
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
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter your password"
                    className="w-full pl-9 pr-10 py-2.5 text-xs sm:text-sm border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#d4af37] outline-hidden font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-700 cursor-pointer"
                    title={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 bg-gray-900 hover:bg-black text-white font-bold rounded-xl text-xs sm:text-sm shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer mt-2"
              >
                {loading ? 'Signing In...' : 'Sign In with Email'}
                <ArrowRight className="w-4 h-4" />
              </button>
            </form>

            {/* Quick link to invite tab */}
            <div className="text-center pt-1">
              <button
                type="button"
                onClick={() => { setTab('invite'); setError(''); }}
                className="text-xs text-amber-900 hover:text-[#2a170e] font-semibold underline underline-offset-2 cursor-pointer"
              >
                Received an invitation token from the Church Office? Activate here
              </button>
            </div>
          </div>
        )}

        {/* ==================================================== */}
        {/* TAB 2: ACTIVATE STAFF / LEADER INVITATION */}
        {/* ==================================================== */}
        {tab === 'invite' && (
          <form onSubmit={handleStaffInviteSubmit} className="space-y-3">
            <div className="p-3 bg-amber-50/70 rounded-xl border border-amber-200/60 text-xs text-amber-900 leading-relaxed">
              <strong>Invited Leaders & Staff:</strong> Enter the invitation token sent to you by the Church Office Super Administrator to set up your password and access your dashboard.
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
                Single-Use Invitation Token
              </label>
              <input
                type="text"
                required
                value={inviteToken}
                onChange={(e) => setInviteToken(e.target.value)}
                placeholder="e.g. dcu-inv-xxxx-xxxx"
                className="w-full p-2.5 text-xs sm:text-sm border border-gray-300 rounded-xl font-mono focus:ring-2 focus:ring-[#d4af37] outline-hidden"
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
                placeholder="leader.email@dcutawala.org"
                className="w-full p-2.5 text-xs sm:text-sm border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#d4af37] outline-hidden"
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
                placeholder="e.g. Deacon John Kamau"
                className="w-full p-2.5 text-xs sm:text-sm border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#d4af37] outline-hidden"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
                Choose Password (min 6 characters)
              </label>
              <div className="relative">
                <input
                  type={showInvitePassword ? 'text' : 'password'}
                  required
                  value={invitePassword}
                  onChange={(e) => setInvitePassword(e.target.value)}
                  placeholder="Create your secure password"
                  className="w-full pl-3 pr-10 py-2.5 text-xs sm:text-sm border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#d4af37] outline-hidden font-mono"
                />
                <button
                  type="button"
                  onClick={() => setShowInvitePassword(!showInvitePassword)}
                  className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-700 cursor-pointer"
                  title={showInvitePassword ? 'Hide password' : 'Show password'}
                >
                  {showInvitePassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 bg-[#2a170e] hover:bg-[#3d2314] text-[#ffd700] border-2 border-[#d4af37] font-bold rounded-xl text-xs sm:text-sm shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer mt-2"
            >
              {loading ? 'Activating Account...' : 'Activate Account & Sign In'}
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>
        )}

      </div>
    </div>
  );
}
