import React from 'react';
import { ChurchLogo } from './ChurchLogo';
import { 
  Users, Building2, Search, List, Archive, UserCheck, 
  LogOut, CheckCircle2, Lock, Baby, Shield
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

interface NavbarProps {
  currentTab: string;
  setCurrentTab: (tab: string) => void;
  pendingLeadershipCount: number;
  pendingOfficeCount: number;
}

export function Navbar({ 
  currentTab, 
  setCurrentTab, 
  pendingLeadershipCount, 
  pendingOfficeCount 
}: NavbarProps) {
  const { user, isOfficeAdmin, isSuperAdmin, isPastor, logout, openAuthModal } = useAuth();

  const isPrivilegedStaff = user && (
    user.role === 'super_admin' || 
    user.role === 'office_admin' || 
    user.role === 'pastor' || 
    (user.role as string) === 'admin'
  );

  const isFellowshipLeader = user && user.role === 'fellowship_leader';

  // Build clean tab list based strictly on authentication & role:
  // 1. PUBLIC TABS (Always visible to all parents & visitors)
  const navTabs: { id: string; label: string; badge?: number; icon?: any }[] = [
    { id: 'home', label: 'Home' },
    { id: 'about', label: 'About DCU' },
    { id: 'register', label: 'Register Your Child' },
    { id: 'track', label: 'Track Status' }
  ];

  // 2. FELLOWSHIP LEADER: ONLY their specific zone confirmation tab
  // Strict rule: Fellowship leaders NEVER see Office Compile, Data Lists, or Past Data List
  if (isFellowshipLeader) {
    const zoneName = user.assignedZone || 'Fellowship';
    navTabs.push({
      id: 'leadership',
      label: `${zoneName} Confirmations`,
      badge: pendingLeadershipCount > 0 ? pendingLeadershipCount : undefined
    });
  }

  // 3. CHURCH OFFICE ADMINS & PASTORS: Full oversight and compilation
  if (isPrivilegedStaff) {
    navTabs.push(
      { 
        id: 'leadership', 
        label: 'Leadership', 
        badge: pendingLeadershipCount > 0 ? pendingLeadershipCount : undefined 
      },
      { 
        id: 'office_compile', 
        label: 'Office Compile', 
        badge: pendingOfficeCount > 0 ? pendingOfficeCount : undefined 
      },
      { id: 'data_lists', label: 'Data Lists' },
      { id: 'past_data', label: 'Past Data List' }
    );
  }

  const handleTabClick = (tabId: string) => {
    setCurrentTab(tabId);
  };

  return (
    <header className="no-print sticky top-0 z-40 bg-[#2a170e] text-white border-b-2 border-[#d4af37]/50 shadow-xl">
      {/* Top Gold Micro Bar */}
      <div className="bg-gradient-to-r from-[#1c0c05] via-[#2a170e] to-[#1c0c05] text-[#ffd700] text-xs py-1 px-4 border-b border-[#d4af37]/30">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center space-x-2 font-cinzel tracking-wider text-[11px]">
            <span className="font-bold">DELIVERANCE CHURCH INT'L - UTAWALA</span>
            <span className="text-gray-400">•</span>
            <span className="font-serif italic text-white/90">THE CHURCH OF CHOICE</span>
          </div>
          <div className="flex items-center space-x-3 text-[11px] text-gray-300">
            <span>Utawala, Nairobi, Kenya</span>
            <span>Tel: 0723 102273</span>
          </div>
        </div>
      </div>

      {/* Main Nav Bar */}
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-20">
          {/* Logo and Church Name */}
          <button
            onClick={() => setCurrentTab('home')}
            className="flex items-center space-x-3 text-left focus:outline-hidden group cursor-pointer"
          >
            <ChurchLogo size={52} className="group-hover:scale-105 transition-transform" />
            <div>
              <div className="text-base sm:text-xl font-cinzel font-bold text-white tracking-wide group-hover:text-[#ffd700] transition-colors">
                DCI UTAWALA
              </div>
              <p className="text-[10px] sm:text-xs text-[#d4af37] font-serif italic tracking-tight">
                The Church of Choice
              </p>
            </div>
          </button>

          {/* Desktop Tabs Bar */}
          <nav className="hidden xl:flex items-center space-x-1">
            {navTabs.map((tab) => {
              const isActive = currentTab === tab.id;

              return (
                <button
                  key={tab.id}
                  onClick={() => handleTabClick(tab.id)}
                  className={`px-3 py-2 text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
                    isActive
                      ? 'bg-[#d4af37] text-[#2a170e] shadow-md font-extrabold'
                      : 'text-gray-200 hover:text-[#ffd700] hover:bg-white/10'
                  }`}
                >
                  {tab.id === 'track' && (
                    <span className="text-[10px] bg-emerald-500/20 text-emerald-300 border border-emerald-400/40 px-1.5 py-0.2 rounded-md font-normal">
                      No Login
                    </span>
                  )}
                  {tab.label}
                  {tab.badge && (
                    <span className="ml-0.5 bg-amber-500 text-black text-[10px] font-extrabold px-1.5 py-0.2 rounded-full">
                      {tab.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>

          {/* Authentication Status / Profile */}
          <div className="flex items-center space-x-2">
            {user && user.role !== 'parent' ? (
              <div 
                onClick={() => {
                  if (user.role === 'fellowship_leader') {
                    setCurrentTab('leadership');
                  } else {
                    setCurrentTab('office_compile');
                  }
                }}
                className="flex items-center space-x-2 bg-black/50 hover:bg-black/70 border border-[#d4af37]/60 px-3 py-1.5 rounded-xl shadow-md cursor-pointer transition-colors"
                title="Click to open your leadership dashboard"
              >
                <img
                  src={user.avatar || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(user.name)}`}
                  alt={user.name}
                  className="w-8 h-8 rounded-full border border-[#d4af37] object-cover"
                />
                <div className="hidden lg:block text-left">
                  <p className="text-xs font-bold text-white leading-tight">
                    {user.name.length > 18 ? user.name.slice(0, 18) + '...' : user.name}
                  </p>
                  <p className="text-[10px] text-[#ffd700] font-semibold uppercase tracking-wider">
                    {user.role === 'fellowship_leader' 
                      ? (user.assignedZone ? `${user.assignedZone} Leader` : 'Zone Leader') 
                      : user.role === 'super_admin' || user.role === 'admin'
                      ? 'Super Administrator'
                      : user.role === 'office_admin'
                      ? 'Church Office Admin' 
                      : user.role === 'pastor' 
                      ? 'Pastor' 
                      : String(user.role).replace('_', ' ')}
                  </p>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    logout();
                    setCurrentTab('home');
                  }}
                  title="Sign Out"
                  className="ml-2 bg-white/10 hover:bg-red-500/20 text-gray-200 hover:text-red-300 px-2 py-1 rounded-lg text-[11px] font-semibold flex items-center gap-1 transition-colors cursor-pointer border border-white/10"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Sign Out</span>
                </button>
              </div>
            ) : (
              <button
                onClick={openAuthModal}
                className="bg-[#d4af37] hover:bg-[#e6c154] text-[#2a170e] px-4 py-2 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-2 shadow-md transition-all cursor-pointer whitespace-nowrap"
                title="Church Fellowship Leaders and Office Staff Portal Sign In"
              >
                <UserCheck className="w-4 h-4 text-[#2a170e]" />
                Leader / Admin Portal
              </button>
            )}
          </div>
        </div>

        {/* Scrollable Mobile/Tablet Navigation Bar */}
        <div className="xl:hidden flex items-center space-x-1 py-2 overflow-x-auto scrollbar-none border-t border-white/10 text-xs font-semibold">
          {navTabs.map((tab) => {
            const isActive = currentTab === tab.id;

            return (
              <button
                key={tab.id}
                onClick={() => handleTabClick(tab.id)}
                className={`px-3 py-1.5 rounded-lg whitespace-nowrap transition-colors flex items-center gap-1 shrink-0 ${
                  isActive
                    ? 'bg-[#d4af37] text-[#2a170e] font-bold'
                    : 'text-gray-200 hover:text-white'
                }`}
              >
                {tab.id === 'track' && (
                  <span className="text-[9px] bg-emerald-500/20 text-emerald-300 px-1 rounded-sm">
                    No Login
                  </span>
                )}
                {tab.label}
                {tab.badge && (
                  <span className="bg-amber-400 text-black text-[9px] font-bold px-1 rounded-full">
                    {tab.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </header>
  );
}
