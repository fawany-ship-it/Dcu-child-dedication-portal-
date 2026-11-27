import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import {
  User as FirebaseUser,
  onAuthStateChanged,
  signInWithPopup,
  signOut,
} from 'firebase/auth';
import { auth, googleProvider } from '../lib/firebase';
import { UserProfile, UserRole } from '../types';
import { api, getSessionToken, setSessionToken, setCurrentLocalUser } from '../services/api';
import {
  fetchStaffRoleByEmail,
  updateOwnLastLoginInFirestore,
} from '../services/firestoreService';

interface AuthContextType {
  user: UserProfile | null;
  firebaseUser: FirebaseUser | null;
  loading: boolean;
  isSuperAdmin: boolean;
  isAdmin: boolean; // super_admin or office_admin
  isOfficeAdmin: boolean; // super_admin, office_admin, or pastor
  isPastor: boolean;
  isFellowshipLeader: boolean;
  isPastorOrLeader: boolean;
  isParent: boolean;
  isStaff: boolean;
  loginWithEmail: (email: string, password: string) => Promise<UserProfile>;
  createAccount: (data: {
    email: string;
    password: string;
    name: string;
    phone?: string;
  }) => Promise<UserProfile>;
  loginWithGoogle: (preset?: { 
    email?: string; 
    name?: string; 
    avatar?: string;
    invitationToken?: string;
  }) => Promise<UserProfile>;
  loginWithGooglePopup: (options?: {
    invitationToken?: string;
    fallbackName?: string;
  }) => Promise<UserProfile>;
  connectCloudSync: () => Promise<FirebaseUser>;
  acceptInvitation: (payload: {
    token: string;
    email: string;
    password: string;
    name?: string;
    phone?: string;
  }) => Promise<UserProfile>;
  bootstrapAdmin: (payload: {
    bootstrapSecret: string;
    email: string;
    password: string;
    name?: string;
  }) => Promise<UserProfile>;
  refreshUser: () => Promise<void>;
  logout: () => Promise<void>;
  isAuthModalOpen: boolean;
  openAuthModal: () => void;
  closeAuthModal: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function formatFirebasePopupError(err: any): Error {
  const code = String(err?.code || '');
  const host = typeof window !== 'undefined' ? window.location.hostname : 'this domain';
  if (code === 'auth/unauthorized-domain') {
    return new Error(
      `Google Sign-In is not yet authorized for domain "${host}". In Firebase Console → Authentication → Settings → Authorized domains, please add "${host}", or sign in with your Email & Password.`
    );
  }
  if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') {
    return new Error('Google sign-in popup was closed before completing sign-in.');
  }
  if (code === 'auth/popup-blocked') {
    return new Error('Google sign-in popup was blocked by your browser. Please allow popups for this site or sign in with Email & Password.');
  }
  return new Error(err?.message || 'Google sign-in failed. Please try again.');
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(auth.currentUser);
  const [loading, setLoading] = useState<boolean>(true);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);

  // Track Firebase Auth user for real-time Firestore access
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (fbUser) => {
      setFirebaseUser(fbUser);
    });
    return () => unsubscribe();
  }, []);

  // Validate server/cloud session on mount
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
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (params.get('invite')) {
        setIsAuthModalOpen(true);
      }
    }
  }, [refreshUser]);

  const loginWithEmail = async (email: string, password: string) => {
    const res = await api.login(email, password);
    setUser(res.user);
    return res.user;
  };

  const createAccount = async (data: {
    email: string;
    password: string;
    name: string;
    phone?: string;
  }) => {
    const res = await api.registerParent(data);
    setUser(res.user);
    return res.user;
  };

  const loginWithGoogle = async (preset?: { 
    email?: string; 
    name?: string; 
    avatar?: string;
    invitationToken?: string;
  }) => {
    const cleanEmail = preset?.email?.trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes('@')) {
      throw new Error('Please enter your Google email address to sign in.');
    }
    const nameToUse = preset?.name || (cleanEmail.split('@')[0]);
    const avatarToUse = preset?.avatar || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(nameToUse)}`;

    const res = await api.loginGoogle({
      email: cleanEmail,
      name: nameToUse,
      avatar: avatarToUse,
      invitationToken: preset?.invitationToken
    });

    setUser(res.user);
    return res.user;
  };

  const loginWithGooglePopup = async (options?: {
    invitationToken?: string;
    fallbackName?: string;
  }): Promise<UserProfile> => {
    let cred;
    try {
      cred = await signInWithPopup(auth, googleProvider);
    } catch (err: any) {
      throw formatFirebasePopupError(err);
    }

    const fbUser = cred.user;
    if (!fbUser?.email) {
      throw new Error('Google account did not return a verified email address.');
    }
    setFirebaseUser(fbUser);

    return loginWithGoogle({
      email: fbUser.email,
      name: fbUser.displayName || options?.fallbackName || fbUser.email.split('@')[0],
      avatar: fbUser.photoURL || undefined,
      invitationToken: options?.invitationToken,
    });
  };

  const connectCloudSync = async (): Promise<FirebaseUser> => {
    let cred;
    try {
      cred = await signInWithPopup(auth, googleProvider);
    } catch (err: any) {
      throw formatFirebasePopupError(err);
    }
    const fbUser = cred.user;
    const fbEmail = fbUser?.email?.toLowerCase().trim() || '';
    if (!fbEmail) {
      await signOut(auth).catch(() => {});
      throw new Error('Google account did not return a verified email address.');
    }
    if (user?.email && user.email.toLowerCase().trim() !== fbEmail) {
      await signOut(auth).catch(() => {});
      throw new Error(
        `Please sign in with your invited church email (${user.email}) rather than ${fbEmail}.`
      );
    }

    setFirebaseUser(fbUser);

    // Stamp lastLoginAt in Firestore so Admin directory shows active status immediately
    const stamped = await updateOwnLastLoginInFirestore(
      fbEmail,
      fbUser.displayName || user?.name,
      fbUser.photoURL || user?.avatar
    );

    const cloudRole = await fetchStaffRoleByEmail(fbEmail);
    if (cloudRole) {
      if (cloudRole.isSuspended) {
        await signOut(auth).catch(() => {});
        setFirebaseUser(null);
        throw new Error('This account has been suspended by administration.');
      }
      const nextProfile: UserProfile = {
        ...cloudRole,
        name: fbUser.displayName || cloudRole.name,
        avatar: fbUser.photoURL || cloudRole.avatar,
        lastLoginAt: stamped ? new Date().toISOString() : cloudRole.lastLoginAt || new Date().toISOString(),
      };
      setUser(nextProfile);
      setCurrentLocalUser(nextProfile);
      if (!getSessionToken()) {
        setSessionToken(`dcu-firebase-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
      }
    } else if (user && user.role !== 'super_admin') {
      throw new Error(
        `Your account (${fbEmail}) has not been synced to the Cloud Directory yet. Ask the Super Administrator to open Office Console while signed in with Google.`
      );
    }

    return fbUser;
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
    return res.user;
  };

  const bootstrapAdmin = async (payload: {
    bootstrapSecret: string;
    email: string;
    password: string;
    name?: string;
  }) => {
    const res = await api.bootstrapAdmin(payload);
    setUser(res.user);
    return res.user;
  };

  const logout = async () => {
    await Promise.all([
      api.logout().catch(() => {}),
      signOut(auth).catch(() => {}),
    ]);
    setFirebaseUser(null);
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
        firebaseUser,
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
        loginWithGooglePopup,
        connectCloudSync,
        acceptInvitation,
        bootstrapAdmin,
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
