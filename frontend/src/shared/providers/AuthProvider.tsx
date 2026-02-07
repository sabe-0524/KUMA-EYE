'use client';

import React, { createContext, useContext } from 'react';
import type { User } from 'firebase/auth';
import { useAuthSession } from '@/shared/providers/auth/model/useAuthSession';
import { useLocationSync, type LocationSyncStatus } from '@/shared/providers/auth/model/useLocationSync';
import type { UserProfile } from '@/shared/types';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  profile: UserProfile | null;
  locationSyncStatus: LocationSyncStatus;
  locationSyncError: string | null;
  signInWithGoogle: () => Promise<void>;
  signInWithEmailPassword: (email: string, password: string) => Promise<void>;
  signUpWithEmailPassword: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  getIdToken: () => Promise<string | null>;
  refreshProfile: () => Promise<UserProfile | null>;
  setProfileData: (profile: UserProfile | null) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const {
    user,
    loading,
    profile,
    activeUidRef,
    signInWithGoogle,
    signInWithEmailPassword,
    signUpWithEmailPassword,
    logout,
    getIdToken,
    refreshProfile,
    setProfileData,
  } = useAuthSession();

  const { locationSyncStatus, locationSyncError } = useLocationSync({
    user,
    profile,
    activeUidRef,
    setProfileData,
  });

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        profile,
        locationSyncStatus,
        locationSyncError,
        signInWithGoogle,
        signInWithEmailPassword,
        signUpWithEmailPassword,
        logout,
        getIdToken,
        refreshProfile,
        setProfileData,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
