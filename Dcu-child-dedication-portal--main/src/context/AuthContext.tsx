import React, { createContext, useContext, useState, useEffect } from 'react';
import { UserProfile, UserRole } from '../types';
import { api } from '../services/api';

interface AuthContextType {
  user: UserProfile | null;
  isAdmin: boolean;
  isOfficeAdmin: boolean;
  isPastorOrLeader: boolean;
  loginWithEmail: (email: string, name?: string) => Promise<void>;
  loginWithGoogle: (preset?: { email: string; name: string; avatar?: string; role?: UserRole; assignedZone?: 'Zone A' | 'Zone B' | 'Zone C' | 'Zone D' | 'Zone E' }) => Promise<void>;
  switchUserRole: (role: UserRole, assignedZone?: 'Zone A' | 'Zone B' | 'Zone C' | 'Zone D' | 'Zone E') => void;
  switchAssignedZone: (zone: 'Zone A' | 'Zone B' | 'Zone C' | 'Zone D' | 'Zone E') => void;
  logout: () => void;
  isAuthModalOpen: boolean;
  openAuthModal: () => void;
  closeAuthModal: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const USER_SESSION_KEY = 'dcu_current_user_session_v2';

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserProfile | null>(() => {
    try {
      const stored = localStorage.getItem(USER_SESSION_KEY);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (e) {
      console.warn('Could not read user session', e);
    }
    // Default to admin fawany@gmail.com for seamless church management
    return {
      id: 'usr-admin-1',
      email: 'fawany@gmail.com',
      name: 'Fawany (Administrator)',
      role: 'admin',
      isApproved: true,
      authProvider: 'google',
      avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
      createdAt: '2026-01-01T00:00:00.000Z'
    };
  });

  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);

  useEffect(() => {
    if (user) {
      localStorage.setItem(USER_SESSION_KEY, JSON.stringify(user));
    } else {
      localStorage.removeItem(USER_SESSION_KEY);
    }
  }, [user]);

  const loginWithEmail = async (email: string, name?: string) => {
    const profile = await api.login(email, name);
    setUser(profile);
    setIsAuthModalOpen(false);
  };

  const loginWithGoogle = async (preset?: { email: string; name: string; avatar?: string; role?: UserRole; assignedZone?: 'Zone A' | 'Zone B' | 'Zone C' | 'Zone D' | 'Zone E' }) => {
    const emailToUse = preset?.email || 'fawany@gmail.com';
    const nameToUse = preset?.name || (emailToUse.split('@')[0]);
    const avatarToUse = preset?.avatar || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(nameToUse)}`;

    const profile = await api.loginGoogle(emailToUse, nameToUse, avatarToUse);
    if (preset?.role) {
      profile.role = preset.role;
    }
    if (preset?.assignedZone) {
      profile.assignedZone = preset.assignedZone;
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
