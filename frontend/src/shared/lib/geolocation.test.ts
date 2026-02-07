import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  GEOLOCATION_FALLBACK_OPTIONS,
  GEOLOCATION_PRIMARY_OPTIONS,
  getCurrentPositionWithFallback,
  startWatchPositionWithFallback,
} from './geolocation';

type MockGeoError = {
  code: number;
  message: string;
  PERMISSION_DENIED: 1;
  POSITION_UNAVAILABLE: 2;
  TIMEOUT: 3;
};

const createGeoError = (code: 1 | 2 | 3): MockGeoError => ({
  code,
  message: 'geolocation error',
  PERMISSION_DENIED: 1,
  POSITION_UNAVAILABLE: 2,
  TIMEOUT: 3,
});

const createPosition = (): GeolocationPosition =>
  ({
    coords: {
      latitude: 35.0,
      longitude: 139.0,
      accuracy: 10,
      altitude: null,
      altitudeAccuracy: null,
      heading: null,
      speed: null,
      toJSON: () => ({}),
    },
    timestamp: Date.now(),
    toJSON: () => ({}),
  }) as GeolocationPosition;

const originalGeolocation = navigator.geolocation;

afterEach(() => {
  Object.defineProperty(navigator, 'geolocation', {
    configurable: true,
    value: originalGeolocation,
  });
  vi.restoreAllMocks();
});

describe('getCurrentPositionWithFallback', () => {
  it('geolocation 非対応時は reject する', async () => {
    Object.defineProperty(navigator, 'geolocation', {
      configurable: true,
      value: undefined,
    });

    await expect(getCurrentPositionWithFallback()).rejects.toThrow('Geolocation is not supported');
  });

  it('PERMISSION_DENIED以外の失敗は fallback 設定で再試行する', async () => {
    const getCurrentPosition = vi
      .fn()
      .mockImplementationOnce((_success, error: PositionErrorCallback) => {
        error(createGeoError(2) as unknown as GeolocationPositionError);
      })
      .mockImplementationOnce((success: PositionCallback) => {
        success(createPosition());
      });

    Object.defineProperty(navigator, 'geolocation', {
      configurable: true,
      value: { getCurrentPosition },
    });

    const result = await getCurrentPositionWithFallback();

    expect(result.coords.latitude).toBe(35.0);
    expect(getCurrentPosition).toHaveBeenCalledTimes(2);
    expect(getCurrentPosition).toHaveBeenNthCalledWith(1, expect.any(Function), expect.any(Function), GEOLOCATION_PRIMARY_OPTIONS);
    expect(getCurrentPosition).toHaveBeenNthCalledWith(2, expect.any(Function), expect.any(Function), GEOLOCATION_FALLBACK_OPTIONS);
  });

  it('PERMISSION_DENIED は即時にエラーを返す', async () => {
    const deniedError = createGeoError(1) as unknown as GeolocationPositionError;
    const getCurrentPosition = vi.fn().mockImplementation((_success, error: PositionErrorCallback) => {
      error(deniedError);
    });

    Object.defineProperty(navigator, 'geolocation', {
      configurable: true,
      value: { getCurrentPosition },
    });

    await expect(getCurrentPositionWithFallback()).rejects.toBe(deniedError);
    expect(getCurrentPosition).toHaveBeenCalledTimes(1);
  });
});

describe('startWatchPositionWithFallback', () => {
  it('watch失敗時にfallbackへ切り替え、cleanupでclearWatchする', async () => {
    const onSuccess = vi.fn();
    const onPermissionDenied = vi.fn();
    const onError = vi.fn();
    const clearWatch = vi.fn();
    const watchPosition = vi
      .fn()
      .mockImplementationOnce((_success: PositionCallback, error: PositionErrorCallback) => {
        queueMicrotask(() => {
          error(createGeoError(2) as unknown as GeolocationPositionError);
        });
        return 1;
      })
      .mockImplementationOnce((_success: PositionCallback) => 2);

    Object.defineProperty(navigator, 'geolocation', {
      configurable: true,
      value: { watchPosition, clearWatch },
    });

    const cleanup = startWatchPositionWithFallback({
      onSuccess,
      onPermissionDenied,
      onError,
    });

    await vi.waitFor(() => {
      expect(watchPosition).toHaveBeenCalledTimes(2);
    });
    expect(watchPosition).toHaveBeenNthCalledWith(1, onSuccess, expect.any(Function), GEOLOCATION_PRIMARY_OPTIONS);
    expect(watchPosition).toHaveBeenNthCalledWith(2, onSuccess, expect.any(Function), GEOLOCATION_FALLBACK_OPTIONS);
    expect(onPermissionDenied).not.toHaveBeenCalled();
    expect(onError).not.toHaveBeenCalled();

    cleanup();
    expect(clearWatch).toHaveBeenNthCalledWith(1, 1);
    expect(clearWatch).toHaveBeenCalledWith(2);
  });
});
