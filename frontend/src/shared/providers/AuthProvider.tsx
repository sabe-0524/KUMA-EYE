'use client';

import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import {
  User,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
} from 'firebase/auth';
import { auth, googleProvider } from '@/shared/lib/firebase';
import { getMyProfile, syncCurrentUser, updateMyLocation } from '@/shared/api';
import {
  getCurrentPositionWithFallback,
  isGeolocationPositionError,
  startWatchPositionWithFallback,
} from '@/shared/lib/geolocation';
import type { UserProfile } from '@/shared/types';

const LOCATION_SYNC_INTERVAL_MS = 30_000;
const LOCATION_SYNC_DISTANCE_METERS = 50;

type Coordinates = { latitude: number; longitude: number };
export type LocationSyncStatus = 'idle' | 'watching' | 'permission_denied' | 'error';

const toRadians = (value: number): number => (value * Math.PI) / 180;

const calculateDistanceMeters = (from: Coordinates, to: Coordinates): number => {
  const earthRadius = 6_371_000;
  const dLat = toRadians(to.latitude - from.latitude);
  const dLng = toRadians(to.longitude - from.longitude);
  const lat1 = toRadians(from.latitude);
  const lat2 = toRadians(to.latitude);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return earthRadius * c;
};

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
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [locationSyncStatus, setLocationSyncStatus] = useState<LocationSyncStatus>('idle');
  const [locationSyncError, setLocationSyncError] = useState<string | null>(null);
  const lastSyncedUidRef = useRef<string | null>(null);
  const watchStopRef = useRef<(() => void) | null>(null);
  const lastSentCoordinatesRef = useRef<Coordinates | null>(null);
  const lastSentAtRef = useRef<number>(0);
  const sendingLocationRef = useRef(false);

  const setProfileData = useCallback((nextProfile: UserProfile | null) => {
    setProfile(nextProfile);
  }, []);

  const stopLocationWatch = useCallback(() => {
    if (watchStopRef.current) {
      watchStopRef.current();
    }
    watchStopRef.current = null;
    lastSentCoordinatesRef.current = null;
    lastSentAtRef.current = 0;
    sendingLocationRef.current = false;
  }, []);

  const refreshProfile = useCallback(async (): Promise<UserProfile | null> => {
    if (!user) {
      setProfile(null);
      return null;
    }
    try {
      const idToken = await user.getIdToken();
      const latestProfile = await getMyProfile(idToken);
      setProfile(latestProfile);
      return latestProfile;
    } catch (error) {
      console.error('プロフィール再取得エラー:', error);
      return null;
    }
  }, [user]);

  const syncLocationIfNeeded = useCallback(async (coordinates: Coordinates): Promise<void> => {
    if (!user || !profile?.email_opt_in || sendingLocationRef.current) {
      return;
    }

    const now = Date.now();
    const lastCoordinates = lastSentCoordinatesRef.current;
    const elapsed = now - lastSentAtRef.current;
    const movedDistance = lastCoordinates
      ? calculateDistanceMeters(lastCoordinates, coordinates)
      : Number.POSITIVE_INFINITY;
    const shouldSend =
      !lastCoordinates ||
      elapsed >= LOCATION_SYNC_INTERVAL_MS ||
      movedDistance >= LOCATION_SYNC_DISTANCE_METERS;

    if (!shouldSend) {
      return;
    }

    sendingLocationRef.current = true;

    try {
      const idToken = await user.getIdToken();
      const updatedProfile = await updateMyLocation(
        coordinates.latitude,
        coordinates.longitude,
        idToken
      );
      setProfile(updatedProfile);
      setLocationSyncStatus('watching');
      setLocationSyncError(null);
      lastSentCoordinatesRef.current = coordinates;
      lastSentAtRef.current = now;
    } catch (error) {
      console.error('位置情報同期エラー:', error);
      setLocationSyncStatus('error');
      setLocationSyncError('位置情報の同期に失敗しました。');
    } finally {
      sendingLocationRef.current = false;
    }
  }, [profile?.email_opt_in, user]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setUser(user);
      setLoading(false);

      if (user) {
        if (lastSyncedUidRef.current !== user.uid) {
          try {
            const idToken = await user.getIdToken();
            const synced = await syncCurrentUser(idToken);
            setProfile(synced.user);
            lastSyncedUidRef.current = user.uid;
          } catch (error) {
            console.error('ユーザー同期エラー:', error);
          }
        }
      } else {
        lastSyncedUidRef.current = null;
        stopLocationWatch();
        setProfile(null);
        setLocationSyncStatus('idle');
        setLocationSyncError(null);
      }
    });

    return () => {
      stopLocationWatch();
      unsubscribe();
    };
  }, [stopLocationWatch]);

  useEffect(() => {
    if (!user || !profile?.email_opt_in) {
      stopLocationWatch();
      setLocationSyncStatus('idle');
      setLocationSyncError(null);
      return;
    }

    if (!navigator.geolocation) {
      setLocationSyncStatus('error');
      setLocationSyncError('このブラウザでは位置情報を利用できません。');
      return;
    }

    if (watchStopRef.current) {
      return;
    }

    const handlePosition = (position: GeolocationPosition) => {
      void syncLocationIfNeeded({
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
      });
    };

    watchStopRef.current = startWatchPositionWithFallback({
      onSuccess: handlePosition,
      onPermissionDenied: () => {
        setLocationSyncStatus('permission_denied');
        setLocationSyncError('位置情報の共有が許可されていません。');
        stopLocationWatch();
      },
      onError: () => {
        setLocationSyncStatus('error');
        setLocationSyncError('位置情報の取得に失敗しました。');
      },
    });

    void getCurrentPositionWithFallback()
      .then(handlePosition)
      .catch((error) => {
        if (isGeolocationPositionError(error) && error.code === error.PERMISSION_DENIED) {
          setLocationSyncStatus('permission_denied');
          setLocationSyncError('位置情報の共有が許可されていません。');
          stopLocationWatch();
        }
      });

    setLocationSyncStatus('watching');
    setLocationSyncError(null);
    return () => {
      stopLocationWatch();
    };
  }, [user, profile?.email_opt_in, stopLocationWatch, syncLocationIfNeeded]);

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
