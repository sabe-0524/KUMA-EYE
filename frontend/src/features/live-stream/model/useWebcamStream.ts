'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import { useQuery } from '@tanstack/react-query';
import { createStreamSession, getCameras, sendStreamFrame, stopStreamSession } from '@/shared/api';
import { queryKeys } from '@/shared/lib/queryKeys';
import type { Camera, StreamFrameAck, StreamSessionResponse } from '@/shared/types';

type StreamConnectionState = 'idle' | 'starting' | 'active' | 'reconnecting' | 'stopping' | 'error';

type ManualLocationInput = {
  latitude: string;
  longitude: string;
};

type StreamSessionPayload = {
  camera_id?: number;
  latitude?: number;
  longitude?: number;
  frame_interval: number;
};

interface UseWebcamStreamResult {
  videoRef: RefObject<HTMLVideoElement>;
  cameras: Camera[];
  selectedCameraId: number | null;
  manualLocation: ManualLocationInput;
  useManualLocation: boolean;
  frameInterval: number;
  connectionState: StreamConnectionState;
  session: StreamSessionResponse | null;
  lastAck: StreamFrameAck | null;
  framesSent: number;
  reconnectAttempts: number;
  error: string | null;
  setSelectedCameraId: (cameraId: number | null) => void;
  setManualLocation: (location: ManualLocationInput) => void;
  setUseManualLocation: (enabled: boolean) => void;
  setFrameInterval: (interval: number) => void;
  startStream: () => Promise<void>;
  stopStream: () => Promise<void>;
}

const CAPTURE_WIDTH = 1280;
const CAPTURE_HEIGHT = 720;
const JPEG_QUALITY = 0.85;
const RECONNECT_INTERVAL_MS = 5000;

const getErrorMessage = (error: unknown): string => {
  const maybeAxiosError = error as { response?: { data?: { detail?: string } } };
  return maybeAxiosError.response?.data?.detail || 'ストリーミング処理に失敗しました';
};

const getErrorStatus = (error: unknown): number | null => {
  const maybeAxiosError = error as { response?: { status?: number } };
  return maybeAxiosError.response?.status ?? null;
};

const toJpegBlob = async (videoElement: HTMLVideoElement, canvas: HTMLCanvasElement): Promise<Blob> =>
  new Promise((resolve, reject) => {
    const width = videoElement.videoWidth || CAPTURE_WIDTH;
    const height = videoElement.videoHeight || CAPTURE_HEIGHT;
    canvas.width = width;
    canvas.height = height;

    const context = canvas.getContext('2d');
    if (!context) {
      reject(new Error('Failed to create canvas context'));
      return;
    }

    context.drawImage(videoElement, 0, 0, width, height);
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error('Failed to encode frame'));
          return;
        }
        resolve(blob);
      },
      'image/jpeg',
      JPEG_QUALITY
    );
  });

export const useWebcamStream = (onDetection?: () => void): UseWebcamStreamResult => {
  const [selectedCameraId, setSelectedCameraId] = useState<number | null>(null);
  const [manualLocation, setManualLocation] = useState<ManualLocationInput>({
    latitude: '',
    longitude: '',
  });
  const [useManualLocation, setUseManualLocation] = useState(false);
  const [frameInterval, setFrameInterval] = useState(5);
  const [connectionState, setConnectionState] = useState<StreamConnectionState>('idle');
  const [session, setSession] = useState<StreamSessionResponse | null>(null);
  const [lastAck, setLastAck] = useState<StreamFrameAck | null>(null);
  const [framesSent, setFramesSent] = useState(0);
  const [reconnectAttempts, setReconnectAttempts] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const intervalIdRef = useRef<number | null>(null);
  const reconnectTimeoutRef = useRef<number | null>(null);
  const frameNumberRef = useRef(0);
  const sessionRef = useRef<StreamSessionResponse | null>(null);
  const stoppedByUserRef = useRef(false);
  const isSendingRef = useRef(false);
  const scheduleReconnectRef = useRef<() => void>(() => undefined);

  const camerasQuery = useQuery({
    queryKey: queryKeys.cameras.list(true),
    queryFn: async () => {
      const response = await getCameras(true);
      return response.cameras;
    },
  });

  const stopMediaStream = useCallback(() => {
    const stream = mediaStreamRef.current;
    if (stream) {
      stream.getTracks().forEach((track) => {
        track.onended = null;
        track.stop();
      });
      mediaStreamRef.current = null;
    }

    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, []);

  const clearTimers = useCallback(() => {
    if (intervalIdRef.current !== null) {
      window.clearInterval(intervalIdRef.current);
      intervalIdRef.current = null;
    }
    if (reconnectTimeoutRef.current !== null) {
      window.clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
  }, []);

  const acquireCamera = useCallback(async (): Promise<boolean> => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setError('このブラウザはWebカメラに対応していません');
      return false;
    }

    try {
      stopMediaStream();
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: CAPTURE_WIDTH, height: CAPTURE_HEIGHT },
        audio: false,
      });
      mediaStreamRef.current = stream;

      const videoElement = videoRef.current;
      if (videoElement) {
        videoElement.srcObject = stream;
        await videoElement.play();
      }

      const [videoTrack] = stream.getVideoTracks();
      if (videoTrack) {
        videoTrack.onended = () => {
          if (stoppedByUserRef.current) return;
          setConnectionState('reconnecting');
          scheduleReconnectRef.current();
        };
      }

      return true;
    } catch (cameraError) {
      setError(getErrorMessage(cameraError));
      return false;
    }
  }, [stopMediaStream]);

  const scheduleReconnect = useCallback(() => {
    if (stoppedByUserRef.current || reconnectTimeoutRef.current !== null) {
      return;
    }

    setConnectionState('reconnecting');
    reconnectTimeoutRef.current = window.setTimeout(async () => {
      reconnectTimeoutRef.current = null;
      setReconnectAttempts((prev) => prev + 1);
      const reacquired = await acquireCamera();
      if (reacquired) {
        setConnectionState('active');
        setError(null);
        return;
      }
      scheduleReconnectRef.current();
    }, RECONNECT_INTERVAL_MS);
  }, [acquireCamera]);

  useEffect(() => {
    scheduleReconnectRef.current = scheduleReconnect;
  }, [scheduleReconnect]);

  const sendCurrentFrame = useCallback(async () => {
    if (isSendingRef.current) return;

    const currentSession = sessionRef.current;
    const videoElement = videoRef.current;
    if (!currentSession || !videoElement || videoElement.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) {
      return;
    }

    isSendingRef.current = true;
    try {
      const canvas = canvasRef.current ?? document.createElement('canvas');
      canvasRef.current = canvas;
      const frameBlob = await toJpegBlob(videoElement, canvas);
      const ack = await sendStreamFrame(
        currentSession.session_id,
        frameBlob,
        frameNumberRef.current,
        new Date().toISOString()
      );
      frameNumberRef.current += 1;
      setFramesSent((prev) => prev + 1);
      setLastAck(ack);
      setError(null);

      if (ack.detections_count > 0) {
        onDetection?.();
      }
    } catch (streamError) {
      if (stoppedByUserRef.current) {
        return;
      }
      const status = getErrorStatus(streamError);
      if (status === 404 || status === 409) {
        clearTimers();
        stopMediaStream();
        sessionRef.current = null;
        setSession(null);
        setConnectionState('idle');
        setError('ストリームセッションが終了しました。開始ボタンで再開してください。');
        return;
      }
      setError(getErrorMessage(streamError));
    } finally {
      isSendingRef.current = false;
    }
  }, [clearTimers, onDetection, stopMediaStream]);

  const startCaptureLoop = useCallback(() => {
    if (!sessionRef.current) return;
    if (intervalIdRef.current !== null) {
      window.clearInterval(intervalIdRef.current);
      intervalIdRef.current = null;
    }
    intervalIdRef.current = window.setInterval(() => {
      void sendCurrentFrame();
    }, frameInterval * 1000);
    void sendCurrentFrame();
  }, [frameInterval, sendCurrentFrame]);

  const buildSessionPayload = useCallback((): StreamSessionPayload | null => {
    const payload: StreamSessionPayload = { frame_interval: frameInterval };

    if (selectedCameraId) {
      payload.camera_id = selectedCameraId;
      return payload;
    }

    if (!useManualLocation) {
      setError('カメラを選択するか、位置情報を入力してください');
      return null;
    }

    const latitude = parseFloat(manualLocation.latitude);
    const longitude = parseFloat(manualLocation.longitude);
    if (Number.isNaN(latitude) || Number.isNaN(longitude)) {
      setError('有効な緯度・経度を入力してください');
      return null;
    }

    payload.latitude = latitude;
    payload.longitude = longitude;
    return payload;
  }, [frameInterval, manualLocation.latitude, manualLocation.longitude, selectedCameraId, useManualLocation]);

  const startStream = useCallback(async () => {
    if (connectionState === 'starting' || connectionState === 'active' || connectionState === 'reconnecting') {
      return;
    }

    const payload = buildSessionPayload();
    if (!payload) return;

    stoppedByUserRef.current = false;
    setConnectionState('starting');
    setError(null);
    setLastAck(null);
    setFramesSent(0);
    setReconnectAttempts(0);
    frameNumberRef.current = 0;

    const cameraReady = await acquireCamera();
    if (!cameraReady) {
      setConnectionState('error');
      return;
    }

    try {
      const nextSession = await createStreamSession(payload);
      sessionRef.current = nextSession;
      setSession(nextSession);
      setConnectionState('active');
      startCaptureLoop();
    } catch (sessionError) {
      stopMediaStream();
      setConnectionState('error');
      setError(getErrorMessage(sessionError));
    }
  }, [acquireCamera, buildSessionPayload, connectionState, startCaptureLoop, stopMediaStream]);

  const stopStream = useCallback(async () => {
    if (connectionState === 'idle' && !sessionRef.current) {
      return;
    }

    stoppedByUserRef.current = true;
    setConnectionState('stopping');
    clearTimers();
    stopMediaStream();

    const currentSession = sessionRef.current;
    sessionRef.current = null;
    setSession(null);

    try {
      if (currentSession) {
        await stopStreamSession(currentSession.session_id);
      }
      setConnectionState('idle');
    } catch (stopError) {
      const status = getErrorStatus(stopError);
      if (status === 404) {
        // Session may have disappeared (e.g. backend restart or worker mismatch).
        setConnectionState('idle');
        setError(null);
        return;
      }
      setConnectionState('error');
      setError(getErrorMessage(stopError));
    }
  }, [clearTimers, connectionState, stopMediaStream]);

  useEffect(() => {
    if (!sessionRef.current || connectionState === 'idle' || connectionState === 'stopping') {
      return;
    }
    startCaptureLoop();
  }, [connectionState, frameInterval, startCaptureLoop]);

  useEffect(() => {
    return () => {
      stoppedByUserRef.current = true;
      clearTimers();
      stopMediaStream();
    };
  }, [clearTimers, stopMediaStream]);

  const cameras = useMemo(() => camerasQuery.data ?? [], [camerasQuery.data]);

  return {
    videoRef,
    cameras,
    selectedCameraId,
    manualLocation,
    useManualLocation,
    frameInterval,
    connectionState,
    session,
    lastAck,
    framesSent,
    reconnectAttempts,
    error,
    setSelectedCameraId,
    setManualLocation,
    setUseManualLocation,
    setFrameInterval,
    startStream,
    stopStream,
  };
};
