import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { UserProfile, UserRole } from '../types';
import { api, getSessionToken, setSessionToken } from '../services/api';

interface AuthContextType {
  user: UserProfile | null;
  loading: boolean;
  isSuperAdmin: boolean;
  isAdmin: boolean; // super_admin or office_admin
  isOfficeAdmin: boolean; // super_admin, office_admin, or pastor
  isPastor: boolean;
  isFellowshipLeader: boolean;
  isPastorOrLeader: boolean;
  isParent: boolean;
  isStaff: boolean;
  loginWithEmail: (email: string, password: string) => Promise<void>;
  createAccount: (data: {
    email: string;
    password: string;
    name: string;
    phone?: string;
  }) => Promise<void>;
  loginWithGoogle: (preset?: { 
    email?: string; 
    name?: string; 
    avatar?: string;
    invitationToken?: string;
  }) => Promise<void>;
  acceptInvitation: (payload: {
    token: string;
    email: string;
    password: string;
    name?: string;
    phone?: string;
  }) => Promise<void>;
  refreshUser: () => Promise<void>;
  logout: () => Promise<void>;
  isAuthModalOpen: boolean;
  openAuthModal: () => void;
  closeAuthModal: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);

  // Validate server session on mount
  const refreshUser = useCallback(async () => {
    const token = getSessionToken();
    if (!token) {
      setUser(null);
      setLoading(false);
      return;
    }

    try {
      const profile = await api.getMe();
      setUser(profile);
    } catch (err) {
      console.warn('Session verification failed, logging out', err);
      setSessionToken(null);
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshUser();
  }, [refreshUser]);

  const loginWithEmail = async (email: string, password: string) => {
    const res = await api.login(email, password);
    setUser(res.user);
    setIsAuthModalOpen(false);
  };

  const createAccount = async (data: {
    email: string;
    password: string;
    name: string;
    phone?: string;
  }) => {
    const res = await api.registerParent(data);
    setUser(res.user);
    setIsAuthModalOpen(false);
  };

  const loginWithGoogle = async (preset?: { 
    email?: string; 
    name?: string; 
    avatar?: string;
    invitationToken?: string;
  }) => {
    const emailToUse = preset?.email || 'parent.visitor@gmail.com';
    const nameToUse = preset?.name || (emailToUse.split('@')[0]);
    const avatarToUse = preset?.avatar || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(nameToUse)}`;

    const res = await api.loginGoogle({
      email: emailToUse,
      name: nameToUse,
      avatar: avatarToUse,
      invitationToken: preset?.invitationToken
    });

    setUser(res.user);
    setIsAuthModalOpen(false);
  };

  const acceptInvitation = async (payload: {
    token: string;
    email: string;
    password: string;
    name?: string;
    phone?: string;
  }) => {
    const res = await api.acceptInvitation(payload);
    setUser(res.user);
    setIsAuthModalOpen(false);
  };

  const logout = async () => {
    await api.logout();
    setUser(null);
  };

  // Canonical Role Checks
  const normalizedRole: UserRole | undefined = user?.role === 'admin' ? 'super_admin' : user?.role;

  const isSuperAdmin = normalizedRole === 'super_admin';
  const isOfficeAdmin = isSuperAdmin || normalizedRole === 'office_admin';
  const isPastor = isOfficeAdmin || normalizedRole === 'pastor';
  const isFellowshipLeader = normalizedRole === 'fellowship_leader';
  const isPastorOrLeader = isPastor || isFellowshipLeader;
  const isStaff = isSuperAdmin || normalizedRole === 'office_admin' || normalizedRole === 'pastor' || normalizedRole === 'fellowship_leader';
  const isParent = normalizedRole === 'parent';
  const isAdmin = isSuperAdmin || normalizedRole === 'office_admin';

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        isSuperAdmin,
        isAdmin,
        isOfficeAdmin,
        isPastor,
        isFellowshipLeader,
        isPastorOrLeader,
        isParent,
        isStaff,
        loginWithEmail,
        createAccount,
        loginWithGoogle,
        acceptInvitation,
        refreshUser,
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
