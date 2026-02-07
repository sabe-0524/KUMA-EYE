import { useCallback, useEffect, useRef, useState } from 'react';
import type { MutableRefObject } from 'react';
import {
  User,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
} from 'firebase/auth';
import { auth, googleProvider } from '@/shared/lib/firebase';
import { getMyProfile, syncCurrentUser } from '@/shared/api';
import type { UserProfile } from '@/shared/types';

interface UseAuthSessionResult {
  user: User | null;
  loading: boolean;
  profile: UserProfile | null;
  activeUidRef: MutableRefObject<string | null>;
  signInWithGoogle: () => Promise<void>;
  signInWithEmailPassword: (email: string, password: string) => Promise<void>;
  signUpWithEmailPassword: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  getIdToken: () => Promise<string | null>;
  refreshProfile: () => Promise<UserProfile | null>;
  setProfileData: (nextProfile: UserProfile | null) => void;
}

export const useAuthSession = (): UseAuthSessionResult => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<UserProfile | null>(null);

  const lastSyncedUidRef = useRef<string | null>(null);
  const activeUidRef = useRef<string | null>(null);

  const setProfileData = useCallback((nextProfile: UserProfile | null) => {
    setProfile(nextProfile);
  }, []);

  const refreshProfile = useCallback(async (): Promise<UserProfile | null> => {
    if (!user) {
      setProfile(null);
      return null;
    }

    const requestUid = user.uid;
    try {
      const idToken = await user.getIdToken();
      const latestProfile = await getMyProfile(idToken);
      if (activeUidRef.current !== requestUid) {
        return null;
      }
      setProfile(latestProfile);
      return latestProfile;
    } catch (error) {
      console.error('プロフィール再取得エラー:', error);
      return null;
    }
  }, [user]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (nextUser) => {
      setUser(nextUser);
      setLoading(false);
      activeUidRef.current = nextUser?.uid ?? null;

      if (nextUser) {
        const requestUid = nextUser.uid;
        if (lastSyncedUidRef.current !== nextUser.uid) {
          try {
            const idToken = await nextUser.getIdToken();
            const synced = await syncCurrentUser(idToken);
            if (activeUidRef.current !== requestUid) {
              return;
            }
            setProfile(synced.user);
            lastSyncedUidRef.current = nextUser.uid;
          } catch (error) {
            console.error('ユーザー同期エラー:', error);
          }
        }
      } else {
        lastSyncedUidRef.current = null;
        activeUidRef.current = null;
        setProfile(null);
      }
    });

    return () => {
      unsubscribe();
    };
  }, []);

  const signInWithGoogle = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error) {
      console.error('Google認証エラー:', error);
      throw error;
    }
  };

  const signInWithEmailPassword = async (email: string, password: string) => {
    await signInWithEmailAndPassword(auth, email, password);
  };

  const signUpWithEmailPassword = async (email: string, password: string) => {
    await createUserWithEmailAndPassword(auth, email, password);
  };

  const logout = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error('ログアウトエラー:', error);
      throw error;
    }
  };

  const getIdToken = async (): Promise<string | null> => {
    if (!user) return null;
    try {
      return await user.getIdToken();
    } catch (error) {
      console.error('トークン取得エラー:', error);
      return null;
    }
  };

  return {
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
  };
};
