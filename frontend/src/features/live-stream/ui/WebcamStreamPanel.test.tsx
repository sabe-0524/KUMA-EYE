import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { WebcamStreamPanel } from './WebcamStreamPanel';

const mockUseWebcamStream = vi.fn();

vi.mock('@/features/live-stream/model/useWebcamStream', () => ({
  useWebcamStream: (...args: unknown[]) => mockUseWebcamStream(...args),
}));

vi.mock('@/features/upload-footage/ui/UploadLocationSelector', () => ({
  UploadLocationSelector: () => <div data-testid="upload-location-selector" />,
}));

describe('WebcamStreamPanel', () => {
  it('renders idle state by default', () => {
    mockUseWebcamStream.mockReturnValue({
      videoRef: { current: null },
      cameras: [],
      selectedCameraId: null,
      manualLocation: { latitude: '', longitude: '' },
      useManualLocation: false,
      frameInterval: 5,
      connectionState: 'idle',
      session: null,
      lastAck: null,
      framesSent: 0,
      reconnectAttempts: 0,
      error: null,
      setSelectedCameraId: vi.fn(),
      setManualLocation: vi.fn(),
      setUseManualLocation: vi.fn(),
      setFrameInterval: vi.fn(),
      startStream: vi.fn(),
      stopStream: vi.fn(),
    });

    render(<WebcamStreamPanel />);

    expect(screen.getByText('ライブストリーム')).toBeInTheDocument();
    expect(screen.getByText('状態: 待機中')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '開始' })).toBeEnabled();
    expect(screen.getByRole('button', { name: '停止' })).toBeDisabled();
  });

  it('shows reconnecting state and retry count', () => {
    mockUseWebcamStream.mockReturnValue({
      videoRef: { current: null },
      cameras: [],
      selectedCameraId: null,
      manualLocation: { latitude: '', longitude: '' },
      useManualLocation: false,
      frameInterval: 5,
      connectionState: 'reconnecting',
      session: { session_id: 's1', upload_id: 1, status: 'active', frame_interval: 5, started_at: '', reconnect_interval_seconds: 5 },
      lastAck: { session_id: 's1', upload_id: 1, frame_number: 1, detections_count: 0, processed_at: '' },
      framesSent: 4,
      reconnectAttempts: 2,
      error: null,
      setSelectedCameraId: vi.fn(),
      setManualLocation: vi.fn(),
      setUseManualLocation: vi.fn(),
      setFrameInterval: vi.fn(),
      startStream: vi.fn(),
      stopStream: vi.fn(),
    });

    render(<WebcamStreamPanel />);

    expect(screen.getByText('状態: 再接続中')).toBeInTheDocument();
    expect(screen.getByText('再接続試行: 2')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '開始' })).toBeDisabled();
  });
});
