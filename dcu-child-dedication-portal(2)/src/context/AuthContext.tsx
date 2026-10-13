import React, { createContext, useContext, useState, useEffect } from 'react';
import { UserProfile, UserRole } from '../types';
import { api } from '../services/api';

interface AuthContextType {
  user: UserProfile | null;
  isAdmin: boolean;
  isOfficeAdmin: boolean;
  isPastorOrLeader: boolean;
  loginWithEmail: (email: string, password?: string, name?: string, role?: UserRole, assignedZone?: 'Zone A' | 'Zone B' | 'Zone C' | 'Zone D' | 'Zone E') => Promise<void>;
  createAccount: (data: {
    email: string;
    name: string;
    password?: string;
    role: UserRole;
    assignedZone?: 'Zone A' | 'Zone B' | 'Zone C' | 'Zone D' | 'Zone E';
    phone?: string;
  }) => Promise<void>;
  loginWithGoogle: (preset?: { 
    email: string; 
    name?: string; 
    avatar?: string; 
    role?: UserRole; 
    assignedZone?: 'Zone A' | 'Zone B' | 'Zone C' | 'Zone D' | 'Zone E' 
  }) => Promise<void>;
  switchUserRole: (role: UserRole, assignedZone?: 'Zone A' | 'Zone B' | 'Zone C' | 'Zone D' | 'Zone E') => void;
  switchAssignedZone: (zone: 'Zone A' | 'Zone B' | 'Zone C' | 'Zone D' | 'Zone E') => void;
  logout: () => void;
  isAuthModalOpen: boolean;
  openAuthModal: () => void;
  closeAuthModal: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const USER_SESSION_KEY = 'dcu_current_user_session_v3';

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // STRICT REQUIREMENT: App must start as unauthenticated (user = null) for general public
  // No auto-login as admin on page load.
  const [user, setUser] = useState<UserProfile | null>(() => {
    try {
      // Clean up any legacy default test sessions
      localStorage.removeItem('dcu_current_user_session_v2');
      const stored = localStorage.getItem(USER_SESSION_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        // Only restore if user explicitly signed in with real non-mock credentials
        if (parsed && parsed.email && parsed.id && parsed.id !== 'usr-admin-1') {
          return parsed;
        }
      }
    } catch (e) {
      console.warn('Could not read user session', e);
    }
    // Clean visitor state: NOT logged in
    return null;
  });

  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);

  useEffect(() => {
    if (user) {
      localStorage.setItem(USER_SESSION_KEY, JSON.stringify(user));
    } else {
      localStorage.removeItem(USER_SESSION_KEY);
    }
  }, [user]);

  const loginWithEmail = async (
    email: string, 
    _password?: string, 
    name?: string, 
    role?: UserRole, 
    assignedZone?: 'Zone A' | 'Zone B' | 'Zone C' | 'Zone D' | 'Zone E'
  ) => {
    const profile = await api.login(email, name, role, assignedZone);
    setUser(profile);
    setIsAuthModalOpen(false);
  };

  const createAccount = async (data: {
    email: string;
    name: string;
    password?: string;
    role: UserRole;
    assignedZone?: 'Zone A' | 'Zone B' | 'Zone C' | 'Zone D' | 'Zone E';
    phone?: string;
  }) => {
    const profile = await api.createAccount(data);
    setUser(profile);
    setIsAuthModalOpen(false);
  };

  const loginWithGoogle = async (preset?: { 
    email: string; 
    name?: string; 
    avatar?: string; 
    role?: UserRole; 
    assignedZone?: 'Zone A' | 'Zone B' | 'Zone C' | 'Zone D' | 'Zone E' 
  }) => {
    const emailToUse = preset?.email || 'fawany@gmail.com';
    const nameToUse = preset?.name || (emailToUse.split('@')[0]);
    const avatarToUse = preset?.avatar || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(nameToUse)}`;

    const profile = await api.loginGoogle(emailToUse, nameToUse, avatarToUse, preset?.role, preset?.assignedZone);
    if (preset?.role) {
      profile.role = preset.role;
    }
    if (preset?.assignedZone) {
      profile.assignedZone = preset.assignedZone;
    }
    // If logging in with fawany@gmail.com, ensure admin role
    if (emailToUse.toLowerCase() === 'fawany@gmail.com') {
      profile.role = 'admin';
      profile.name = 'Fawany (Administrator)';
    }

    setUser(profile);
    setIsAuthModalOpen(false);
  };

  const switchUserRole = (newRole: UserRole, assignedZone?: 'Zone A' | 'Zone B' | 'Zone C' | 'Zone D' | 'Zone E') => {
    if (!user) return;
    const updated: UserProfile = { 
      ...user, 
      role: newRole,
      assignedZone: assignedZone || (newRole === 'fellowship_leader' ? (user.assignedZone || 'Zone A') : user.assignedZone)
    };
    setUser(updated);
  };

  const switchAssignedZone = (zone: 'Zone A' | 'Zone B' | 'Zone C' | 'Zone D' | 'Zone E') => {
    if (!user) return;
    const updated: UserProfile = { ...user, assignedZone: zone };
    setUser(updated);
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem(USER_SESSION_KEY);
  };

  const isAdmin = user?.role === 'admin';
  const isOfficeAdmin = user?.role === 'admin' || user?.role === 'pastor';
  const isPastorOrLeader = user?.role === 'admin' || user?.role === 'pastor' || user?.role === 'fellowship_leader';

  return (
    <AuthContext.Provider
      value={{
        user,
        isAdmin,
        isOfficeAdmin,
        isPastorOrLeader,
        loginWithEmail,
        createAccount,
        loginWithGoogle,
        switchUserRole,
        switchAssignedZone,
        logout,
        isAuthModalOpen,
        openAuthModal: () => setIsAuthModalOpen(true),
        closeAuthModal: () => setIsAuthModalOpen(false),
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
