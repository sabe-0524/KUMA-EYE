import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook } from '@testing-library/react';
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as api from '@/shared/api';
import { useWebcamStream } from './useWebcamStream';

vi.mock('@/shared/api', () => ({
  getCameras: vi.fn(async () => ({ total: 0, cameras: [] })),
  createStreamSession: vi.fn(async () => ({
    session_id: 'session-1',
    upload_id: 1,
    status: 'active',
    frame_interval: 5,
    started_at: '2026-01-01T00:00:00Z',
    reconnect_interval_seconds: 5,
  })),
  sendStreamFrame: vi.fn(async (_sessionId: string, _file: Blob, frameNumber: number) => ({
    session_id: 'session-1',
    upload_id: 1,
    frame_number: frameNumber,
    detections_count: 0,
    processed_at: '2026-01-01T00:00:00Z',
  })),
  stopStreamSession: vi.fn(async () => ({
    message: 'ok',
    session: {
      session_id: 'session-1',
      upload_id: 1,
      status: 'stopped',
      frame_interval: 5,
      started_at: '2026-01-01T00:00:00Z',
      frames_received: 0,
      frames_processed: 0,
      detections_count: 0,
      reconnect_attempts: 0,
    },
  })),
}));

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });

  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children);
};

const flushPromises = async () =>
  act(async () => {
    await Promise.resolve();
  });

describe('useWebcamStream', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();

    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
      drawImage: vi.fn(),
    } as unknown as CanvasRenderingContext2D);
    vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation(function toBlob(callback) {
      callback?.(new Blob(['frame'], { type: 'image/jpeg' }));
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('starts and stops stream session', async () => {
    const videoTrack = { stop: vi.fn(), onended: null } as unknown as MediaStreamTrack;
    const mediaStream = {
      getTracks: () => [videoTrack],
      getVideoTracks: () => [videoTrack],
    } as unknown as MediaStream;

    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: {
        getUserMedia: vi.fn(async () => mediaStream),
      },
    });

    const { result } = renderHook(() => useWebcamStream(), { wrapper: createWrapper() });
    const video = document.createElement('video');
    Object.defineProperty(video, 'play', { value: vi.fn(async () => undefined), configurable: true });
    Object.defineProperty(video, 'readyState', {
      value: HTMLMediaElement.HAVE_CURRENT_DATA,
      configurable: true,
    });
    Object.defineProperty(video, 'videoWidth', { value: 1280, configurable: true });
    Object.defineProperty(video, 'videoHeight', { value: 720, configurable: true });

    act(() => {
      (result.current.videoRef as React.MutableRefObject<HTMLVideoElement | null>).current = video;
      result.current.setUseManualLocation(true);
      result.current.setManualLocation({ latitude: '35.0', longitude: '139.0' });
    });

    await act(async () => {
      await result.current.startStream();
    });
    await flushPromises();

    expect(api.createStreamSession).toHaveBeenCalledTimes(1);
    expect(api.sendStreamFrame).toHaveBeenCalled();
    expect(result.current.connectionState).toBe('active');

    await act(async () => {
      await result.current.stopStream();
    });

    expect(api.stopStreamSession).toHaveBeenCalledTimes(1);
    expect(result.current.connectionState).toBe('idle');
  });

  it('sends frames by interval and reconnects on track end', async () => {
    const videoTrack = { stop: vi.fn(), onended: null as (() => void) | null } as unknown as MediaStreamTrack;
    const getUserMedia = vi.fn(async () => ({
      getTracks: () => [videoTrack],
      getVideoTracks: () => [videoTrack],
    })) as unknown as (constraints?: MediaStreamConstraints) => Promise<MediaStream>;

    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: { getUserMedia },
    });

    const { result } = renderHook(() => useWebcamStream(), { wrapper: createWrapper() });
    const video = document.createElement('video');
    Object.defineProperty(video, 'play', { value: vi.fn(async () => undefined), configurable: true });
    Object.defineProperty(video, 'readyState', {
      value: HTMLMediaElement.HAVE_CURRENT_DATA,
      configurable: true,
    });
    Object.defineProperty(video, 'videoWidth', { value: 1280, configurable: true });
    Object.defineProperty(video, 'videoHeight', { value: 720, configurable: true });

    act(() => {
      (result.current.videoRef as React.MutableRefObject<HTMLVideoElement | null>).current = video;
      result.current.setUseManualLocation(true);
      result.current.setManualLocation({ latitude: '35.0', longitude: '139.0' });
    });

    await act(async () => {
      await result.current.startStream();
    });
    await flushPromises();

    await act(async () => {
      vi.advanceTimersByTime(5000);
    });
    await flushPromises();

    expect(api.sendStreamFrame).toHaveBeenCalledTimes(2);

    act(() => {
      videoTrack.onended?.(new Event('ended'));
    });
    expect(result.current.connectionState).toBe('reconnecting');

    await act(async () => {
      vi.advanceTimersByTime(5000);
    });
    await flushPromises();

    expect(getUserMedia).toHaveBeenCalledTimes(2);
    expect(result.current.connectionState).toBe('active');
  });
});
