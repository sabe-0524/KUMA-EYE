'use client';

import React, { useMemo } from 'react';
import { MapContainer } from 'react-leaflet';
import type { DisplayMode, LatLng, Sighting } from '@/shared/types';
import { ImageModal } from '@/shared/ui';
import {
  DEFAULT_CENTER,
  DEFAULT_ZOOM,
  JAPAN_BOUNDS,
  MIN_ZOOM_JAPAN,
} from '@/widgets/map/lib/displayBounds';
import { useMapSightings } from '@/widgets/map/model/useMapSightings';
import { MapDisplayModeToggle } from '@/widgets/map/ui/MapDisplayModeToggle';
import { MapInteractionController } from '@/widgets/map/ui/MapInteractionController';
import { MapLegend } from '@/widgets/map/ui/MapLegend';
import { MapLocationMarkers } from '@/widgets/map/ui/MapLocationMarkers';
import { MapSightingsLayer } from '@/widgets/map/ui/MapSightingsLayer';
import { MapStatusBanners } from '@/widgets/map/ui/MapStatusBanners';

interface MapViewProps {
  onSightingSelect?: (sighting: Sighting) => void;
  refreshInterval?: number;
  refreshTrigger?: number;
  onDisplayContextChange?: (context: { mode: DisplayMode; bounds: string | null }) => void;
  cameraPlacementMode?: boolean;
  cameraPlacementLocation?: LatLng | null;
  onCameraPlacementSelect?: (location: LatLng) => void;
}

export const MapView: React.FC<MapViewProps> = ({
  onSightingSelect,
  refreshInterval = 30000,
  refreshTrigger = 0,
  onDisplayContextChange,
  cameraPlacementMode = false,
  cameraPlacementLocation = null,
  onCameraPlacementSelect,
}) => {
  const {
    sightings,
    loading,
    error,
    selectedImage,
    displayMode,
    locationStatus,
    currentLocation,
    manualLocation,
    setDisplayMode,
    setManualLocation,
    openImage,
    closeImage,
  } = useMapSightings({
    refreshInterval,
    refreshTrigger,
    onDisplayContextChange,
  });

  const selectedCenter = useMemo(() => {
    return currentLocation ?? manualLocation;
  }, [currentLocation, manualLocation]);

  if (loading) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-slate-50 via-amber-50/60 to-emerald-50/40">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4" />
          <p className="text-slate-600">地図を読み込み中...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative w-full h-full">
      <MapDisplayModeToggle displayMode={displayMode} onChange={setDisplayMode} />

      <MapContainer
        center={DEFAULT_CENTER}
        zoom={DEFAULT_ZOOM}
        minZoom={MIN_ZOOM_JAPAN}
        maxBounds={JAPAN_BOUNDS}
        maxBoundsViscosity={1.0}
        className="w-full h-full"
        zoomControl={false}
        scrollWheelZoom={true}
      >
        <MapSightingsLayer
          sightings={sightings}
          onSightingSelect={onSightingSelect}
          onImageClick={openImage}
        />
        <MapLocationMarkers
          currentLocation={currentLocation}
          manualLocation={manualLocation}
          cameraPlacementLocation={cameraPlacementLocation}
        />
        <MapInteractionController
          displayMode={displayMode}
          locationStatus={locationStatus}
          currentLocation={currentLocation}
          manualLocation={manualLocation}
          cameraPlacementMode={cameraPlacementMode}
          onCameraPlacementSelect={onCameraPlacementSelect}
          onManualLocationSelect={setManualLocation}
        />
      </MapContainer>

      <MapLegend />

      <MapStatusBanners
        displayMode={displayMode}
        locationStatus={locationStatus}
        selectedCenter={selectedCenter}
        cameraPlacementMode={cameraPlacementMode}
        error={error}
      />

      {selectedImage && <ImageModal imageUrl={selectedImage} onClose={closeImage} />}
    </div>
  );
};

export default MapView;
