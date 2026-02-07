'use client';

import React from 'react';
import type { LatLng } from '@/shared/types';
import { useCameraRegistration } from '@/features/camera-register/model/useCameraRegistration';
import { CameraList } from '@/features/camera-register/ui/CameraList';
import { CameraRegistrationForm } from '@/features/camera-register/ui/CameraRegistrationForm';

interface CameraRegisterPanelProps {
  onRegisterComplete?: () => void;
  placementMode: boolean;
  selectedLocation: LatLng | null;
  onPlacementModeChange: (enabled: boolean) => void;
  onClearSelectedLocation: () => void;
}

export const CameraRegisterPanel: React.FC<CameraRegisterPanelProps> = ({
  onRegisterComplete,
  placementMode,
  selectedLocation,
  onPlacementModeChange,
  onClearSelectedLocation,
}) => {
  const {
    name,
    latitude,
    longitude,
    description,
    isSubmitting,
    error,
    success,
    cameras,
    isLoadingCameras,
    setName,
    setLatitude,
    setLongitude,
    setDescription,
    clearSelectedLocationInputs,
    getCurrentLocation,
    handleSubmit,
  } = useCameraRegistration({
    onRegisterComplete,
    selectedLocation,
    onPlacementModeChange,
    onClearSelectedLocation,
  });

  return (
    <div className="space-y-6">
      <CameraRegistrationForm
        placementMode={placementMode}
        selectedLocation={selectedLocation}
        name={name}
        latitude={latitude}
        longitude={longitude}
        description={description}
        isSubmitting={isSubmitting}
        error={error}
        success={success}
        onPlacementModeChange={onPlacementModeChange}
        onGetCurrentLocation={() => {
          void getCurrentLocation();
        }}
        onNameChange={setName}
        onLatitudeChange={setLatitude}
        onLongitudeChange={setLongitude}
        onDescriptionChange={setDescription}
        onClearSelectedLocationInputs={clearSelectedLocationInputs}
        onSubmit={(event) => {
          void handleSubmit(event);
        }}
      />

      <CameraList cameras={cameras} isLoading={isLoadingCameras} />
    </div>
  );
};
