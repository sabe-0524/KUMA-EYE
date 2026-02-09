import { useCallback, useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getSightings } from '@/shared/api';
import { queryKeys } from '@/shared/lib/queryKeys';
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
  const SIGHTINGS_LIMIT = 200;
  const INCLUDE_TOTAL = false;
  const queryClient = useQueryClient();

  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [displayMode, setDisplayMode] = useState<DisplayMode>('national');
  const [locationStatus, setLocationStatus] = useState<LocationStatus>('idle');
  const [currentLocation, setCurrentLocation] = useState<LatLng | null>(null);
  const [manualLocation, setManualLocation] = useState<LatLng | null>(null);

  const selectedCenter = useMemo(() => {
    return currentLocation ?? manualLocation;
  }, [currentLocation, manualLocation]);

  const nearbyBounds = useMemo(() => {
    return selectedCenter ? getBoundsFromCenter(selectedCenter, NEARBY_RADIUS_KM) : null;
  }, [selectedCenter]);

  const requestBounds = displayMode === 'nearby' ? nearbyBounds : null;
  const canFetchSightings = displayMode !== 'nearby' || Boolean(requestBounds);

  const sightingsQuery = useQuery({
    queryKey: queryKeys.sightings.list({
      bounds: requestBounds,
      limit: SIGHTINGS_LIMIT,
      includeTotal: INCLUDE_TOTAL,
    }),
    queryFn: async () => {
      const response = await getSightings({
        limit: SIGHTINGS_LIMIT,
        include_total: INCLUDE_TOTAL,
        ...(requestBounds ? { bounds: requestBounds } : {}),
      });
      return response.sightings.filter((sighting) => sighting.alert_level !== 'low');
    },
    enabled: canFetchSightings,
    refetchInterval: refreshInterval,
    placeholderData: (previousData) => previousData,
  });

  useEffect(() => {
    if (refreshTrigger > 0) {
      void queryClient.invalidateQueries({ queryKey: queryKeys.sightings.all });
    }
  }, [queryClient, refreshTrigger]);

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

  const loading = canFetchSightings ? sightingsQuery.isPending || (sightingsQuery.isFetching && !sightingsQuery.data) : false;

  return {
    sightings: sightingsQuery.data ?? [],
    loading,
    error: sightingsQuery.isError ? '目撃情報の取得に失敗しました' : null,
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
