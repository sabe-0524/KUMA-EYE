import React, { useEffect } from 'react';
import { useMap, useMapEvents } from 'react-leaflet';
import type { DisplayMode, LatLng } from '@/shared/types';
import type { LocationStatus } from '@/widgets/map/model/useMapSightings';
import { NEARBY_ZOOM } from '@/widgets/map/lib/displayBounds';

interface MapInteractionControllerProps {
  displayMode: DisplayMode;
  locationStatus: LocationStatus;
  currentLocation: LatLng | null;
  manualLocation: LatLng | null;
  cameraPlacementMode: boolean;
  onCameraPlacementSelect?: (location: LatLng) => void;
  onManualLocationSelect: (location: LatLng) => void;
}

export const MapInteractionController: React.FC<MapInteractionControllerProps> = ({
  displayMode,
  locationStatus,
  currentLocation,
  manualLocation,
  cameraPlacementMode,
  onCameraPlacementSelect,
  onManualLocationSelect,
}) => {
  const map = useMap();

  useEffect(() => {
    if (displayMode !== 'nearby') return;
    const target = currentLocation ?? manualLocation;
    if (!target) return;
    map.setView([target.lat, target.lng], NEARBY_ZOOM);
  }, [displayMode, currentLocation, manualLocation, map]);

  useMapEvents({
    click: (event) => {
      if (cameraPlacementMode) {
        onCameraPlacementSelect?.({ lat: event.latlng.lat, lng: event.latlng.lng });
        return;
      }

      if (locationStatus !== 'manual' || displayMode !== 'nearby') {
        return;
      }

      const location = { lat: event.latlng.lat, lng: event.latlng.lng };
      onManualLocationSelect(location);
      map.setView([location.lat, location.lng], NEARBY_ZOOM);
    },
  });

  return null;
};
