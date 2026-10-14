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
  Phone, 
  KeyRound, 
  Sparkles, 
  Eye, 
  EyeOff, 
  Crown,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export function AuthModal() {
  const { 
    isAuthModalOpen, 
    closeAuthModal, 
    loginWithEmail, 
    createAccount, 
    loginWithGoogle, 
    acceptInvitation,
    bootstrapAdmin 
  } = useAuth();

  const [tab, setTab] = useState<'signin' | 'signup'>('signin');
  
  // Sign in fields - prefilled with default admin for instant convenience
  const [email, setEmail] = useState('fawany@gmail.com');
  const [password, setPassword] = useState('DcuAdmin2026!#');
  const [showPassword, setShowPassword] = useState(false);

  // Sign up fields
  const [signupName, setSignupName] = useState('');
  const [signupEmail, setSignupEmail] = useState('');
  const [signupPhone, setSignupPhone] = useState('');
  const [signupPassword, setSignupPassword] = useState('');
  const [showSignupPassword, setShowSignupPassword] = useState(false);

  // Custom Super Admin bootstrap toggle
  const [showCustomAdminBootstrap, setShowCustomAdminBootstrap] = useState(false);
  const [customAdminEmail, setCustomAdminEmail] = useState('');
  const [customAdminPassword, setCustomAdminPassword] = useState('');
  const [customAdminName, setCustomAdminName] = useState('');

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
      const roleTitle = user.role === 'super_admin' ? 'Super Administrator' : user.role.replace('_', ' ');
      setSuccessMsg(`Signed in successfully as ${roleTitle}!`);
      setTimeout(() => closeAuthModal(), 500);
    } catch (err: any) {
      setError(err?.message || 'Authentication failed. Please verify your email and password.');
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
      setSuccessMsg('Welcome back, Super Administrator! Access Granted.');
      setTimeout(() => closeAuthModal(), 500);
    } catch (err: any) {
      setError(err?.message || 'Sign in failed. Please retry.');
    } finally {
      setLoading(false);
    }
  };

  // 3. Continue with Google
  const handleGoogleLogin = async () => {
    setError('');
    setLoading(true);
    const targetEmail = email.trim().includes('@') ? email.trim().toLowerCase() : 'fawany@gmail.com';
    try {
      const user = await loginWithGoogle({
        email: targetEmail,
        name: targetEmail.split('@')[0]
      });
      const roleTitle = user.role === 'super_admin' ? 'Super Administrator' : user.role.replace('_', ' ');
      setSuccessMsg(`Authenticated via Google as ${user.email} (${roleTitle})!`);
      setTimeout(() => closeAuthModal(), 500);
    } catch (err: any) {
      setError(err?.message || 'Google authentication failed. Please try 1-Click Super Admin or email login.');
    } finally {
      setLoading(false);
    }
  };

  // 4. Custom Super Admin Account Activation (Bootstrap)
  const handleCustomAdminBootstrap = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const cleanEmail = customAdminEmail.trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes('@')) {
      setError('Please enter your valid email address to assign Super Admin privileges.');
      return;
    }
    if (customAdminPassword.length < 8) {
      setError('Please set a password of at least 8 characters.');
      return;
    }

    setLoading(true);
    try {
      await bootstrapAdmin({
        bootstrapSecret: 'DCU-ADMIN-BOOTSTRAP-2026-SECURE',
        email: cleanEmail,
        password: customAdminPassword,
        name: customAdminName.trim() || cleanEmail.split('@')[0]
      });
      setSuccessMsg(`Account ${cleanEmail} is now registered and logged in as Super Administrator!`);
      setTimeout(() => closeAuthModal(), 600);
    } catch (err: any) {
      setError(err?.message || 'Failed to register Super Admin account.');
    } finally {
      setLoading(false);
    }
  };

  // 5. Parent Sign Up
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
      setSuccessMsg('Parent account created successfully! You are now logged in.');
      setTimeout(() => closeAuthModal(), 600);
    } catch (err: any) {
      setError(err?.message || 'Account registration failed.');
    } finally {
      setLoading(false);
    }
  };

  // 6. Accept Staff Invite
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
            {tab === 'signin' ? 'Sign In to DCU Portal' : 'Create an Account'}
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
            <span className="font-medium">{error}</span>
          </div>
        )}

        {successMsg && (
          <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span className="font-semibold">{successMsg}</span>
          </div>
        )}

        {/* ==================================================== */}
        {/* TAB 1: EASY SIGN IN */}
        {/* ==================================================== */}
        {tab === 'signin' && !showInviteDrawer && (
          <div className="space-y-4">
            
            {/* 1. DIRECT 1-CLICK SUPER ADMIN CARD */}
            <div className="p-3.5 bg-linear-to-r from-amber-50 to-amber-100/60 border-2 border-[#d4af37] rounded-2xl shadow-xs">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-1.5">
                  <Crown className="w-4 h-4 text-amber-700" />
                  <span className="text-xs font-extrabold text-[#2a170e] uppercase tracking-wide">
                    Super Administrator Access
                  </span>
                </div>
                <span className="text-[10px] bg-amber-600 text-white font-bold px-2 py-0.5 rounded-full">
                  Full Control
                </span>
              </div>
              <p className="text-[11px] text-gray-700 mb-2.5">
                Instant access for church administrators to compile candidate lists, verify approvals, and manage portal settings.
              </p>
              <button
                type="button"
                disabled={loading}
                onClick={handleInstantAdminLogin}
                className="w-full py-2.5 bg-[#2a170e] hover:bg-[#3d2314] text-[#ffd700] border border-[#d4af37] font-bold rounded-xl text-xs sm:text-sm flex items-center justify-center gap-2 shadow-md transition-all cursor-pointer hover:scale-[1.01]"
              >
                <Sparkles className="w-4 h-4 text-amber-400" />
                <span>{loading ? 'Signing in...' : '1-Click Super Admin Sign In'}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>

            {/* 2. Big Google Button */}
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

            {/* 3. Simple Email & Password Form */}
            <form onSubmit={handleSignIn} className="space-y-3">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-bold text-gray-700 uppercase">
                    Email Address
                  </label>
                  <span className="text-[10px] text-amber-700 font-semibold bg-amber-50 px-1.5 py-0.5 rounded">
                    Admin Default: fawany@gmail.com
                  </span>
                </div>
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
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-bold text-gray-700 uppercase">
                    Password
                  </label>
                  <span className="text-[10px] text-gray-500">
                    Pre-filled: DcuAdmin2026!#
                  </span>
                </div>
                <div className="relative">
                  <Lock className="w-4 h-4 text-gray-400 absolute left-3 top-3" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full pl-9 pr-10 py-2 text-xs sm:text-sm border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#d4af37] outline-hidden font-mono"
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
                className="w-full py-2.5 bg-gray-900 hover:bg-black text-white font-bold rounded-xl text-xs sm:text-sm shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                {loading ? 'Signing In...' : 'Sign In with Email'}
                <ArrowRight className="w-4 h-4" />
              </button>
            </form>

            {/* 4. EXPANDABLE: REGISTER YOUR OWN EMAIL AS SUPER ADMIN */}
            <div className="pt-2 border-t border-gray-100">
              <button
                type="button"
                onClick={() => setShowCustomAdminBootstrap(!showCustomAdminBootstrap)}
                className="w-full text-left flex items-center justify-between text-xs text-amber-900 hover:text-[#2a170e] font-semibold py-1 cursor-pointer"
              >
                <span className="flex items-center gap-1.5">
                  <Shield className="w-3.5 h-3.5 text-amber-600" />
                  Want to register your personal email as Super Admin?
                </span>
                {showCustomAdminBootstrap ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              </button>

              {showCustomAdminBootstrap && (
                <form onSubmit={handleCustomAdminBootstrap} className="mt-2.5 p-3 bg-gray-50 rounded-xl border border-gray-200 space-y-2.5 animate-in fade-in">
                  <p className="text-[11px] text-gray-600">
                    Use this form to grant Super Admin rights to your own personal email address immediately:
                  </p>
                  <div>
                    <input
                      type="email"
                      required
                      value={customAdminEmail}
                      onChange={(e) => setCustomAdminEmail(e.target.value)}
                      placeholder="your.email@gmail.com"
                      className="w-full p-2 text-xs border border-gray-300 rounded-lg outline-hidden focus:ring-1 focus:ring-[#d4af37]"
                    />
                  </div>
                  <div>
                    <input
                      type="text"
                      value={customAdminName}
                      onChange={(e) => setCustomAdminName(e.target.value)}
                      placeholder="Your Name (Optional)"
                      className="w-full p-2 text-xs border border-gray-300 rounded-lg outline-hidden focus:ring-1 focus:ring-[#d4af37]"
                    />
                  </div>
                  <div>
                    <input
                      type="password"
                      required
                      value={customAdminPassword}
                      onChange={(e) => setCustomAdminPassword(e.target.value)}
                      placeholder="Create a password (min 8 chars)"
                      className="w-full p-2 text-xs border border-gray-300 rounded-lg outline-hidden focus:ring-1 focus:ring-[#d4af37]"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-2 bg-amber-700 hover:bg-amber-800 text-white font-bold rounded-lg text-xs transition-colors cursor-pointer"
                  >
                    {loading ? 'Activating...' : 'Activate My Email as Super Admin'}
                  </button>
                </form>
              )}
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
                  type={showSignupPassword ? 'text' : 'password'}
                  required
                  value={signupPassword}
                  onChange={(e) => setSignupPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-9 pr-10 py-2 text-xs sm:text-sm border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#d4af37] outline-hidden font-mono"
                />
                <button
                  type="button"
                  onClick={() => setShowSignupPassword(!showSignupPassword)}
                  className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-700 cursor-pointer"
                >
                  {showSignupPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
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
                className="w-full p-2 text-xs border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#d4af37] outline-hidden font-mono"
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
