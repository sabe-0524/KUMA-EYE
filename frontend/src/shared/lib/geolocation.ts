'use client';

export const GEOLOCATION_PRIMARY_OPTIONS: PositionOptions = {
  enableHighAccuracy: true,
  timeout: 10000,
  maximumAge: 30000,
};

export const GEOLOCATION_FALLBACK_OPTIONS: PositionOptions = {
  enableHighAccuracy: false,
  timeout: 15000,
  maximumAge: 300000,
};

export const isGeolocationPositionError = (value: unknown): value is GeolocationPositionError => {
  if (!value || typeof value !== 'object') return false;
  return 'code' in value && typeof (value as { code?: unknown }).code === 'number';
};

export const getGeolocationErrorMessage = (error: unknown): string => {
  if (!isGeolocationPositionError(error)) {
    return '位置情報の取得に失敗しました';
  }

  switch (error.code) {
    case error.PERMISSION_DENIED:
      return '位置情報の利用が拒否されました。ブラウザの設定を確認してください';
    case error.POSITION_UNAVAILABLE:
      return '位置情報を特定できませんでした。電波状況の良い場所で再試行してください';
    case error.TIMEOUT:
      return '位置情報の取得がタイムアウトしました。再試行してください';
    default:
      return '位置情報の取得に失敗しました';
  }
};

export const getCurrentPositionWithFallback = (): Promise<GeolocationPosition> => {
  if (!navigator.geolocation) {
    return Promise.reject(new Error('Geolocation is not supported'));
  }

  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(
      resolve,
      (firstError) => {
        if (firstError.code === firstError.PERMISSION_DENIED) {
          reject(firstError);
          return;
        }

        navigator.geolocation.getCurrentPosition(
          resolve,
          reject,
          GEOLOCATION_FALLBACK_OPTIONS
        );
      },
      GEOLOCATION_PRIMARY_OPTIONS
    );
  });
};

type WatchHandlers = {
  onSuccess: (position: GeolocationPosition) => void;
  onPermissionDenied: (error: GeolocationPositionError) => void;
  onError: (error: GeolocationPositionError) => void;
};

export const startWatchPositionWithFallback = (handlers: WatchHandlers): (() => void) => {
  if (!navigator.geolocation) {
    return () => {};
  }

  let watchId: number | null = null;
  let usingFallback = false;

  const handleError = (error: GeolocationPositionError) => {
    if (error.code === error.PERMISSION_DENIED) {
      handlers.onPermissionDenied(error);
      return;
    }

    if (!usingFallback) {
      usingFallback = true;
      if (watchId !== null) {
        navigator.geolocation.clearWatch(watchId);
      }
      watchId = navigator.geolocation.watchPosition(
        handlers.onSuccess,
        handleError,
        GEOLOCATION_FALLBACK_OPTIONS
      );
      return;
    }

    handlers.onError(error);
  };

  watchId = navigator.geolocation.watchPosition(
    handlers.onSuccess,
    handleError,
    GEOLOCATION_PRIMARY_OPTIONS
  );

  return () => {
    if (watchId !== null) {
      navigator.geolocation.clearWatch(watchId);
      watchId = null;
    }
  };
};
