import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { createCamera, getCameras } from '@/shared/api';
import { queryKeys } from '@/shared/lib/queryKeys';
import { getCurrentPositionWithFallback, getGeolocationErrorMessage } from '@/shared/lib/geolocation';
import type { Camera as CameraType, LatLng } from '@/shared/types';
import { validateCameraRegistrationInput } from '@/features/camera-register/lib/validation';

interface UseCameraRegistrationArgs {
  onRegisterComplete?: () => void;
  selectedLocation: LatLng | null;
  onPlacementModeChange: (enabled: boolean) => void;
  onClearSelectedLocation: () => void;
}

interface UseCameraRegistrationResult {
  name: string;
  latitude: string;
  longitude: string;
  description: string;
  isSubmitting: boolean;
  error: string | null;
  success: boolean;
  cameras: CameraType[];
  isLoadingCameras: boolean;
  setName: (value: string) => void;
  setLatitude: (value: string) => void;
  setLongitude: (value: string) => void;
  setDescription: (value: string) => void;
  clearSelectedLocationInputs: () => void;
  getCurrentLocation: () => Promise<void>;
  handleSubmit: (event: FormEvent) => Promise<void>;
}

const getRequestErrorMessage = (error: unknown): string => {
  const maybeAxiosError = error as { response?: { data?: { detail?: string } } };
  return maybeAxiosError.response?.data?.detail || 'カメラの登録に失敗しました';
};

export const useCameraRegistration = ({
  onRegisterComplete,
  selectedLocation,
  onPlacementModeChange,
  onClearSelectedLocation,
}: UseCameraRegistrationArgs): UseCameraRegistrationResult => {
  const queryClient = useQueryClient();

  const [name, setName] = useState('');
  const [latitude, setLatitude] = useState('');
  const [longitude, setLongitude] = useState('');
  const [description, setDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const camerasQuery = useQuery({
    queryKey: queryKeys.cameras.list(),
    queryFn: async () => {
      const response = await getCameras();
      return response.cameras;
    },
  });

  useEffect(() => {
    if (!selectedLocation) return;
    setLatitude(selectedLocation.lat.toFixed(6));
    setLongitude(selectedLocation.lng.toFixed(6));
    setError(null);
  }, [selectedLocation]);

  const clearSelectedLocationInputs = () => {
    onClearSelectedLocation();
    setLatitude('');
    setLongitude('');
  };

  const getCurrentLocation = async () => {
    if (!navigator.geolocation) {
      setError('位置情報がサポートされていません');
      return;
    }

    try {
      const position = await getCurrentPositionWithFallback();
      setLatitude(position.coords.latitude.toFixed(6));
      setLongitude(position.coords.longitude.toFixed(6));
      setError(null);
    } catch (requestError) {
      setError(getGeolocationErrorMessage(requestError));
      console.error('Geolocation error:', requestError);
    }
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    setSuccess(false);

    const validationError = validateCameraRegistrationInput({
      name,
      latitude,
      longitude,
    });
    if (validationError) {
      setError(validationError);
      return;
    }

    setIsSubmitting(true);

    try {
      await createCamera({
        name: name.trim(),
        latitude: parseFloat(latitude),
        longitude: parseFloat(longitude),
        description: description.trim() || undefined,
      });

      await queryClient.invalidateQueries({ queryKey: queryKeys.cameras.all });

      setSuccess(true);
      setName('');
      setLatitude('');
      setLongitude('');
      setDescription('');
      onPlacementModeChange(false);
      onClearSelectedLocation();
      onRegisterComplete?.();
      setTimeout(() => setSuccess(false), 3000);
    } catch (requestError) {
      setError(getRequestErrorMessage(requestError));
    } finally {
      setIsSubmitting(false);
    }
  };

  return {
    name,
    latitude,
    longitude,
    description,
    isSubmitting,
    error,
    success,
    cameras: camerasQuery.data ?? [],
    isLoadingCameras: camerasQuery.isPending,
    setName,
    setLatitude,
    setLongitude,
    setDescription,
    clearSelectedLocationInputs,
    getCurrentLocation,
    handleSubmit,
  };
};
