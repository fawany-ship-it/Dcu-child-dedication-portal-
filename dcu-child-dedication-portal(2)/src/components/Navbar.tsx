import React from 'react';
import { ChurchLogo } from './ChurchLogo';
import { 
  Users, Building2, Search, List, Archive, UserCheck, 
  LogOut, CheckCircle2, Lock 
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
  const { user, isOfficeAdmin, logout, openAuthModal } = useAuth();

  // Public: About DCU, Home, Register Your Child
  // Gated: Leadership (Fellowship leaders), Office Compile, Data Lists, Past Data List (Church office)
  const isTabLocked = (tabId: string) => {
    if (tabId === 'leadership') return !user || user.role === 'parent';
    if (tabId === 'office_compile' || tabId === 'data_lists' || tabId === 'past_data') return !isOfficeAdmin;
    return false;
  };

  const navTabs = [
    { id: 'about', label: 'About DCU', restricted: false },
    { id: 'home', label: 'Home', restricted: false },
    { id: 'register', label: 'Register Your Child', restricted: false },
    { 
      id: 'leadership', 
      label: 'Leadership', 
      restricted: isTabLocked('leadership'), 
      badge: user && user.role !== 'parent' && pendingLeadershipCount > 0 ? pendingLeadershipCount : undefined 
    },
    { 
      id: 'office_compile', 
      label: 'Office Compile', 
      restricted: isTabLocked('office_compile'), 
      badge: isOfficeAdmin && pendingOfficeCount > 0 ? pendingOfficeCount : undefined 
    },
    { id: 'track', label: 'Track Status', restricted: false },
    { id: 'data_lists', label: 'Data Lists', restricted: isTabLocked('data_lists') },
    { id: 'past_data', label: 'Past Data List', restricted: isTabLocked('past_data') }
  ];

  const handleTabClick = (tabId: string) => {
    setCurrentTab(tabId);
    if (tabId === 'leadership' && (!user || user.role === 'parent')) {
      openAuthModal();
    } else if ((tabId === 'office_compile' || tabId === 'data_lists' || tabId === 'past_data') && !isOfficeAdmin) {
      openAuthModal();
    }
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
          <div className="flex items-center space-x-4 text-[11px] text-gray-300">
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
                  {tab.restricted && (
                    <Lock className={`w-3 h-3 ${isActive ? 'text-[#2a170e]' : 'text-[#d4af37]'}`} />
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
            {user ? (
              <div className="flex items-center space-x-2 bg-black/40 border border-[#d4af37]/40 px-3 py-1.5 rounded-xl shadow-md">
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
                      : user.role === 'admin' 
                      ? 'Church Office Admin' 
                      : user.role === 'pastor' 
                      ? 'Pastoral Team' 
                      : user.role.replace('_', ' ')}
                  </p>
                </div>
                <button
                  onClick={logout}
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
              >
                <UserCheck className="w-4 h-4 text-[#2a170e]" />
                Leadership Log In
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
                {tab.restricted && <Lock className="w-2.5 h-2.5 text-[#d4af37]" />}
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
