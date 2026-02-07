import { useCallback, useEffect, useRef, useState } from 'react';
import type { MutableRefObject } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
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
import { queryKeys } from '@/shared/lib/queryKeys';
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
  const queryClient = useQueryClient();

  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const lastSyncedUidRef = useRef<string | null>(null);
  const activeUidRef = useRef<string | null>(null);

  const profileQuery = useQuery({
    queryKey: queryKeys.user.profile(user?.uid ?? 'anonymous'),
    queryFn: async () => {
      if (!user) {
        throw new Error('No authenticated user');
      }
      const idToken = await user.getIdToken();
      return getMyProfile(idToken);
    },
    enabled: Boolean(user),
  });

  const setProfileData = useCallback(
    (nextProfile: UserProfile | null) => {
      if (!user) {
        return;
      }

      const profileKey = queryKeys.user.profile(user.uid);
      if (nextProfile) {
        queryClient.setQueryData(profileKey, nextProfile);
        return;
      }

      queryClient.removeQueries({ queryKey: profileKey, exact: true });
    },
    [queryClient, user]
  );

  const refreshProfile = useCallback(async (): Promise<UserProfile | null> => {
    if (!user) {
      return null;
    }

    const profileKey = queryKeys.user.profile(user.uid);

    try {
      await queryClient.invalidateQueries({ queryKey: profileKey, exact: true });
      const latestProfile = await queryClient.fetchQuery({
        queryKey: profileKey,
        queryFn: async () => {
          const idToken = await user.getIdToken();
          return getMyProfile(idToken);
        },
      });
      return latestProfile;
    } catch (error) {
      console.error('プロフィール再取得エラー:', error);
      return null;
    }
  }, [queryClient, user]);

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
            queryClient.setQueryData(queryKeys.user.profile(nextUser.uid), synced.user);
            lastSyncedUidRef.current = nextUser.uid;
          } catch (error) {
            console.error('ユーザー同期エラー:', error);
          }
        }
      } else {
        lastSyncedUidRef.current = null;
        activeUidRef.current = null;
        queryClient.removeQueries({ queryKey: queryKeys.user.all });
      }
    });

    return () => {
      unsubscribe();
    };
  }, [queryClient]);

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
    profile: profileQuery.data ?? null,
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
