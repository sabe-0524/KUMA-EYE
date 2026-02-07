import { useCallback, useEffect, useMemo, useState } from 'react';
import { getSightings } from '@/shared/api';
import { getCurrentPositionWithFallback } from '@/shared/lib/geolocation';
import type { DisplayMode, LatLng, Sighting } from '@/shared/types';
import { getBoundsFromCenter, NEARBY_RADIUS_KM } from '@/widgets/map/lib/displayBounds';

export type LocationStatus = 'idle' | 'requesting' | 'granted' | 'manual';

interface DisplayContext {
  mode: DisplayMode;
  bounds: string | null;
}

interface UseMapSightingsArgs {
  refreshInterval: number;
  refreshTrigger: number;
  onDisplayContextChange?: (context: DisplayContext) => void;
}

interface UseMapSightingsResult {
  sightings: Sighting[];
  loading: boolean;
  error: string | null;
  selectedImage: string | null;
  displayMode: DisplayMode;
  locationStatus: LocationStatus;
  currentLocation: LatLng | null;
  manualLocation: LatLng | null;
  nearbyBounds: string | null;
  setDisplayMode: (mode: DisplayMode) => void;
  setManualLocation: (location: LatLng) => void;
  openImage: (url: string) => void;
  closeImage: () => void;
}

export const useMapSightings = ({
  refreshInterval,
  refreshTrigger,
  onDisplayContextChange,
}: UseMapSightingsArgs): UseMapSightingsResult => {
  const [sightings, setSightings] = useState<Sighting[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [displayMode, setDisplayMode] = useState<DisplayMode>('national');
  const [locationStatus, setLocationStatus] = useState<LocationStatus>('idle');
  const [currentLocation, setCurrentLocation] = useState<LatLng | null>(null);
  const [manualLocation, setManualLocation] = useState<LatLng | null>(null);

  const fetchSightings = useCallback(async () => {
    try {
      const bounds =
        displayMode === 'nearby'
          ? (() => {
              const center = currentLocation ?? manualLocation;
              if (!center) return null;
              return getBoundsFromCenter(center, NEARBY_RADIUS_KM);
            })()
          : null;

      if (displayMode === 'nearby' && !bounds) {
        setLoading(false);
        return;
      }

      const response = await getSightings({
        limit: 500,
        ...(bounds ? { bounds } : {}),
      });
      setSightings(response.sightings.filter((sighting) => sighting.alert_level !== 'low'));
      setError(null);
    } catch (requestError) {
      console.error('Failed to fetch sightings:', requestError);
      setError('目撃情報の取得に失敗しました');
    } finally {
      setLoading(false);
    }
  }, [displayMode, currentLocation, manualLocation]);

  useEffect(() => {
    fetchSightings();
    const interval = setInterval(fetchSightings, refreshInterval);

    return () => {
      clearInterval(interval);
    };
  }, [fetchSightings, refreshInterval]);

  useEffect(() => {
    if (refreshTrigger > 0) {
      fetchSightings();
    }
  }, [refreshTrigger, fetchSightings]);

  useEffect(() => {
    let isActive = true;

    if (displayMode !== 'nearby') {
      setLocationStatus('idle');
      setCurrentLocation(null);
      setManualLocation(null);
      return;
    }

    if (!navigator.geolocation) {
      setLocationStatus('manual');
      return;
    }

    setLocationStatus('requesting');
    getCurrentPositionWithFallback()
      .then((position) => {
        if (!isActive) return;
        setCurrentLocation({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        });
        setLocationStatus('granted');
      })
      .catch(() => {
        if (!isActive) return;
        setLocationStatus('manual');
      });

    return () => {
      isActive = false;
    };
  }, [displayMode]);

  const selectedCenter = useMemo(() => {
    return currentLocation ?? manualLocation;
  }, [currentLocation, manualLocation]);

  const nearbyBounds = useMemo(() => {
    return selectedCenter ? getBoundsFromCenter(selectedCenter, NEARBY_RADIUS_KM) : null;
  }, [selectedCenter]);

  useEffect(() => {
    onDisplayContextChange?.({
      mode: displayMode,
      bounds: displayMode === 'nearby' ? nearbyBounds : null,
    });
  }, [displayMode, nearbyBounds, onDisplayContextChange]);

  const openImage = useCallback((url: string) => {
    setSelectedImage(url);
  }, []);

  const closeImage = useCallback(() => {
    setSelectedImage(null);
  }, []);

  const handleManualLocationChange = useCallback((location: LatLng) => {
    setManualLocation(location);
  }, []);

  return {
    sightings,
    loading,
    error,
    selectedImage,
    displayMode,
    locationStatus,
    currentLocation,
    manualLocation,
    nearbyBounds,
    setDisplayMode,
    setManualLocation: handleManualLocationChange,
    openImage,
    closeImage,
  };
};
