import { useCallback, useEffect, useState } from 'react';
import { getCameras, getUpload, uploadFootage, uploadFramesZip } from '@/shared/api';
import type { Camera, UploadResponse, UploadStatus } from '@/shared/types';
import { createFramesZipFromVideo } from '@/features/upload-footage/lib/videoFramesZip';

type ManualLocationInput = {
  latitude: string;
  longitude: string;
};

type UploadOptions = {
  camera_id?: number;
  latitude?: number;
  longitude?: number;
  frame_interval?: number;
};

interface UseUploadWorkflowResult {
  cameras: Camera[];
  selectedCameraId: number | null;
  manualLocation: ManualLocationInput;
  useManualLocation: boolean;
  frameInterval: number;
  uploading: boolean;
  clientProcessing: boolean;
  uploadResult: UploadResponse | null;
  uploadStatus: UploadStatus | null;
  error: string | null;
  setSelectedCameraId: (cameraId: number | null) => void;
  setManualLocation: (location: ManualLocationInput) => void;
  setUseManualLocation: (enabled: boolean) => void;
  setFrameInterval: (interval: number) => void;
  setError: (message: string | null) => void;
  handleDrop: (acceptedFiles: File[]) => Promise<void>;
  resetUpload: () => void;
}

const getUploadErrorMessage = (error: unknown): string => {
  const maybeAxiosError = error as { response?: { data?: { detail?: string } } };
  return maybeAxiosError.response?.data?.detail || 'アップロードに失敗しました';
};

export const useUploadWorkflow = (onUploadComplete?: () => void): UseUploadWorkflowResult => {
  const [cameras, setCameras] = useState<Camera[]>([]);
  const [selectedCameraId, setSelectedCameraId] = useState<number | null>(null);
  const [manualLocation, setManualLocation] = useState<ManualLocationInput>({
    latitude: '',
    longitude: '',
  });
  const [useManualLocation, setUseManualLocation] = useState(false);
  const [frameInterval, setFrameInterval] = useState(5);

  const [uploading, setUploading] = useState(false);
  const [clientProcessing, setClientProcessing] = useState(false);
  const [uploadResult, setUploadResult] = useState<UploadResponse | null>(null);
  const [uploadStatus, setUploadStatus] = useState<UploadStatus | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchCameras = async () => {
      try {
        const response = await getCameras(true);
        setCameras(response.cameras);
      } catch (requestError) {
        console.error('Failed to fetch cameras:', requestError);
      }
    };

    void fetchCameras();
  }, []);

  useEffect(() => {
    if (!uploadResult || uploadStatus === 'completed' || uploadStatus === 'failed') {
      return;
    }

    const pollStatus = async () => {
      try {
        const detail = await getUpload(uploadResult.upload_id);
        setUploadStatus(detail.status);

        if (detail.status === 'completed') {
          onUploadComplete?.();
        }
      } catch (requestError) {
        console.error('Failed to poll status:', requestError);
      }
    };

    const interval = setInterval(pollStatus, 2000);

    return () => {
      clearInterval(interval);
    };
  }, [uploadResult, uploadStatus, onUploadComplete]);

  const buildUploadOptions = useCallback((): UploadOptions | null => {
    if (!selectedCameraId && !useManualLocation) {
      setError('カメラを選択するか、位置情報を入力してください');
      return null;
    }

    const options: UploadOptions = {
      frame_interval: frameInterval,
    };

    if (selectedCameraId) {
      options.camera_id = selectedCameraId;
      return options;
    }

    const lat = parseFloat(manualLocation.latitude);
    const lng = parseFloat(manualLocation.longitude);

    if (Number.isNaN(lat) || Number.isNaN(lng)) {
      setError('有効な緯度・経度を入力してください');
      return null;
    }

    options.latitude = lat;
    options.longitude = lng;

    return options;
  }, [selectedCameraId, useManualLocation, frameInterval, manualLocation]);

  const handleDrop = useCallback(
    async (acceptedFiles: File[]) => {
      if (acceptedFiles.length === 0) return;

      const file = acceptedFiles[0];
      const options = buildUploadOptions();
      if (!options) return;

      setError(null);
      setUploadResult(null);
      setUploadStatus(null);

      try {
        if (file.type.startsWith('video/')) {
          setClientProcessing(true);
          const zipFile = await createFramesZipFromVideo(file, frameInterval);
          setClientProcessing(false);

          setUploading(true);
          const result = await uploadFramesZip(zipFile, options);
          setUploadResult(result);
          setUploadStatus('processing');
          return;
        }

        setUploading(true);
        const result = await uploadFootage(file, options);
        setUploadResult(result);
        setUploadStatus('processing');
      } catch (requestError) {
        setError(getUploadErrorMessage(requestError));
      } finally {
        setUploading(false);
        setClientProcessing(false);
      }
    },
    [buildUploadOptions, frameInterval]
  );

  const resetUpload = useCallback(() => {
    setUploadResult(null);
    setUploadStatus(null);
    setError(null);
  }, []);

  return {
    cameras,
    selectedCameraId,
    manualLocation,
    useManualLocation,
    frameInterval,
    uploading,
    clientProcessing,
    uploadResult,
    uploadStatus,
    error,
    setSelectedCameraId,
    setManualLocation,
    setUseManualLocation,
    setFrameInterval,
    setError,
    handleDrop,
    resetUpload,
  };
};
