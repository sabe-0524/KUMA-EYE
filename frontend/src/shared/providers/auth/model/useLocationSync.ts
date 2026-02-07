import { useCallback, useEffect, useRef, useState } from 'react';
import type { MutableRefObject } from 'react';
import type { User } from 'firebase/auth';
import { updateMyLocation } from '@/shared/api';
import {
  getCurrentPositionWithFallback,
  isGeolocationPositionError,
  startWatchPositionWithFallback,
} from '@/shared/lib/geolocation';
import { calculateDistanceMeters } from '@/shared/providers/auth/lib/geoDistance';
import type { UserProfile } from '@/shared/types';

const LOCATION_SYNC_INTERVAL_MS = 30_000;
const LOCATION_SYNC_DISTANCE_METERS = 50;

type Coordinates = { latitude: number; longitude: number };

export type LocationSyncStatus = 'idle' | 'watching' | 'permission_denied' | 'error';

interface UseLocationSyncArgs {
  user: User | null;
  profile: UserProfile | null;
  activeUidRef: MutableRefObject<string | null>;
  setProfileData: (profile: UserProfile | null) => void;
}

interface UseLocationSyncResult {
  locationSyncStatus: LocationSyncStatus;
  locationSyncError: string | null;
}

export const useLocationSync = ({
  user,
  profile,
  activeUidRef,
  setProfileData,
}: UseLocationSyncArgs): UseLocationSyncResult => {
  const [locationSyncStatus, setLocationSyncStatus] = useState<LocationSyncStatus>('idle');
  const [locationSyncError, setLocationSyncError] = useState<string | null>(null);

  const watchStopRef = useRef<(() => void) | null>(null);
  const lastSentCoordinatesRef = useRef<Coordinates | null>(null);
  const lastSentAtRef = useRef<number>(0);
  const sendingLocationRef = useRef(false);

  const stopLocationWatch = useCallback(() => {
    if (watchStopRef.current) {
      watchStopRef.current();
    }
    watchStopRef.current = null;
    lastSentCoordinatesRef.current = null;
    lastSentAtRef.current = 0;
    sendingLocationRef.current = false;
  }, []);

  const syncLocationIfNeeded = useCallback(
    async (coordinates: Coordinates): Promise<void> => {
      if (!user || !profile?.email_opt_in || sendingLocationRef.current) {
        return;
      }

      const requestUid = user.uid;
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
        const updatedProfile = await updateMyLocation(coordinates.latitude, coordinates.longitude, idToken);
        if (activeUidRef.current !== requestUid) {
          return;
        }

        setProfileData(updatedProfile);
        setLocationSyncStatus('watching');
        setLocationSyncError(null);
        lastSentCoordinatesRef.current = coordinates;
        lastSentAtRef.current = now;
      } catch (error) {
        console.error('位置情報同期エラー:', error);
        if (activeUidRef.current !== requestUid) {
          return;
        }

        setLocationSyncStatus('error');
        setLocationSyncError('位置情報の同期に失敗しました。');
      } finally {
        sendingLocationRef.current = false;
      }
    },
    [activeUidRef, profile?.email_opt_in, setProfileData, user]
  );

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
  }, [profile?.email_opt_in, stopLocationWatch, syncLocationIfNeeded, user]);

  return {
    locationSyncStatus,
    locationSyncError,
  };
};
