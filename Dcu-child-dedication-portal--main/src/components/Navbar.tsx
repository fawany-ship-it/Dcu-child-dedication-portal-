import React, { useState } from 'react';
import { ChurchLogo } from './ChurchLogo';
import { 
  Users, Building2, Search, List, Archive, UserCheck, 
  LogOut, ChevronDown, CheckCircle2, Lock, Sparkles, BookOpen 
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { UserRole } from '../types';

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
  const { user, isAdmin, isOfficeAdmin, logout, openAuthModal, switchUserRole, switchAssignedZone } = useAuth();
  const [isRoleMenuOpen, setIsRoleMenuOpen] = useState(false);

  const roles: { role: UserRole; label: string; desc: string }[] = [
    { role: 'admin', label: 'Church Office Administrator', desc: 'Full office compile, all zones, and archive rights' },
    { role: 'fellowship_leader', label: 'Fellowship Zone Leader', desc: 'Confirms forms strictly for assigned Zone A to E' },
    { role: 'pastor', label: 'Pastoral Team / Clergy', desc: 'Pastoral oversight & final altar clearance' },
    { role: 'parent', label: 'Parent / Congregation Member', desc: 'Can only submit form & track status' }
  ];

  const zonesList: ('Zone A' | 'Zone B' | 'Zone C' | 'Zone D' | 'Zone E')[] = [
    'Zone A', 'Zone B', 'Zone C', 'Zone D', 'Zone E'
  ];

  // Exact tabs order:
  // 1. About DCU
  // 2. Home
  // 3. Register your child (or parent form)
  // 4. Leadership (for fellowship leaders to confirm sent forms)
  // 5. Office Compile (for church admins)
  // 6. Track status
  // 7. Data lists
  // 8. Past data list
  // 9. Staff log in
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
      badge: pendingLeadershipCount > 0 ? pendingLeadershipCount : undefined 
    },
    { 
      id: 'office_compile', 
      label: 'Office Compile', 
      restricted: isTabLocked('office_compile'), 
      badge: pendingOfficeCount > 0 ? pendingOfficeCount : undefined 
    },
    { id: 'track', label: 'Track Status', restricted: false },
    { id: 'data_lists', label: 'Data Lists', restricted: isTabLocked('data_lists') },
    { id: 'past_data', label: 'Past Data List', restricted: isTabLocked('past_data') }
  ];

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

          {/* Desktop Tabs Bar (Exact Requested Order) */}
          <nav className="hidden xl:flex items-center space-x-1">
            {navTabs.map((tab) => {
              const isActive = currentTab === tab.id;

              return (
                <button
                  key={tab.id}
                  onClick={() => setCurrentTab(tab.id)}
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

          {/* Staff Login / User Profile */}
          <div className="flex items-center space-x-2">
            {user ? (
              <div className="relative">
                <button
                  onClick={() => setIsRoleMenuOpen(!isRoleMenuOpen)}
                  className="flex items-center space-x-2 p-1.5 rounded-xl border border-[#d4af37]/40 hover:border-[#ffd700] bg-black/30 transition-all text-left cursor-pointer"
                >
                  <img
                    src={user.avatar || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(user.name)}`}
                    alt={user.name}
                    className="w-8 h-8 rounded-full border border-[#d4af37] object-cover"
                  />
                  <div className="hidden lg:block">
                    <p className="text-xs font-bold text-white flex items-center gap-1">
                      {user.name.length > 15 ? user.name.slice(0, 15) + '...' : user.name}
                      <ChevronDown className="w-3 h-3 text-[#d4af37]" />
                    </p>
                    <p className="text-[10px] text-[#ffd700] font-semibold uppercase tracking-wider">
                      {user.role === 'fellowship_leader' ? 'Fellowship Leader' : user.role.replace('_', ' ')}
                    </p>
                  </div>
                </button>

                {/* Dropdown for role switcher & logout */}
                {isRoleMenuOpen && (
                  <div className="absolute right-0 mt-2 w-72 bg-white text-gray-900 rounded-2xl shadow-2xl border-2 border-[#d4af37]/40 py-2 z-50 animate-in fade-in zoom-in-95 duration-100">
                    <div className="px-4 py-2 border-b border-gray-100">
                      <p className="text-xs font-bold text-[#2a170e]">{user.name}</p>
                      <p className="text-xs text-gray-500 truncate">{user.email}</p>
                      <div className="mt-1 flex items-center gap-1 text-[11px] text-emerald-700 font-semibold">
                        <CheckCircle2 className="w-3 h-3" /> Signed in via {user.authProvider}
                      </div>
                    </div>

                    <div className="px-3 py-1.5 text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                      Switch Role Mode (Testing & Demo)
                    </div>

                    {roles.map((r) => (
                      <button
                        key={r.role}
                        onClick={() => {
                          switchUserRole(r.role);
                          setIsRoleMenuOpen(false);
                        }}
                        className={`w-full text-left px-4 py-2 text-xs flex flex-col hover:bg-amber-50/50 cursor-pointer ${
                          user.role === r.role ? 'bg-[#fbf5e6] text-[#2a170e] font-bold' : 'text-gray-700'
                        }`}
                      >
                        <span className="flex items-center justify-between">
                          <span>{r.label}</span>
                          {user.role === r.role && <CheckCircle2 className="w-3.5 h-3.5 text-[#d4af37]" />}
                        </span>
                        <span className="text-[10px] text-gray-400 font-normal">{r.desc}</span>
                      </button>
                    ))}

                    {/* If fellowship leader, allow quick selection of Zone A to E */}
                    {user.role === 'fellowship_leader' && (
                      <div className="mx-3 my-2 p-2.5 bg-amber-50 rounded-xl border border-amber-200">
                        <div className="text-[10px] font-bold text-amber-900 uppercase tracking-wider mb-1.5 flex items-center justify-between">
                          <span>Assigned Zone (Strict Isolation):</span>
                          <span className="font-extrabold text-[#2a170e]">{user.assignedZone || 'Zone A'}</span>
                        </div>
                        <div className="grid grid-cols-5 gap-1">
                          {zonesList.map((z) => (
                            <button
                              key={z}
                              onClick={() => {
                                switchAssignedZone(z);
                                setIsRoleMenuOpen(false);
                              }}
                              className={`py-1 text-[11px] font-extrabold rounded-md cursor-pointer transition-colors ${
                                (user.assignedZone || 'Zone A') === z
                                  ? 'bg-[#2a170e] text-[#ffd700] shadow-xs'
                                  : 'bg-white hover:bg-amber-100 text-gray-700 border border-gray-200'
                              }`}
                            >
                              {z.replace('Zone ', '')}
                            </button>
                          ))}
                        </div>
                        <p className="text-[9px] text-amber-800 mt-1.5 italic">
                          Click A, B, C, D, or E to test that each leader ONLY sees members from their own zone.
                        </p>
                      </div>
                    )}

                    <div className="border-t border-gray-100 mt-2 pt-1">
                      <button
                        onClick={() => {
                          logout();
                          setIsRoleMenuOpen(false);
                        }}
                        className="w-full text-left px-4 py-2 text-xs text-red-600 hover:bg-red-50 flex items-center gap-2 cursor-pointer font-bold"
                      >
                        <LogOut className="w-3.5 h-3.5" /> Sign Out
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <button
                onClick={openAuthModal}
                className="bg-[#d4af37] hover:bg-[#e6c154] text-[#2a170e] px-4 py-2 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-2 shadow-md transition-all cursor-pointer whitespace-nowrap"
              >
                <UserCheck className="w-4 h-4 text-[#2a170e]" />
                Staff Log In
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
                onClick={() => setCurrentTab(tab.id)}
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
