'use client';

import React from 'react';
import { AlertCircle, Camera, Loader2, Play, Square, WifiOff } from 'lucide-react';
import { UploadLocationSelector } from '@/features/upload-footage/ui/UploadLocationSelector';
import { useWebcamStream } from '@/features/live-stream/model/useWebcamStream';

interface WebcamStreamPanelProps {
  onDetection?: () => void;
}

const stateLabel: Record<string, string> = {
  idle: '待機中',
  starting: '起動中',
  active: '配信中',
  reconnecting: '再接続中',
  stopping: '停止中',
  error: 'エラー',
};

export const WebcamStreamPanel: React.FC<WebcamStreamPanelProps> = ({ onDetection }) => {
  const {
    videoRef,
    cameras,
    selectedCameraId,
    manualLocation,
    useManualLocation,
    frameInterval,
    connectionState,
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
  } = useWebcamStream(onDetection);

  const isRunning = connectionState === 'active' || connectionState === 'reconnecting';
  const isBusy = connectionState === 'starting' || connectionState === 'stopping';

  return (
    <div className="bg-white/95 backdrop-blur rounded-xl border border-slate-200/70 shadow-sm p-4 space-y-4">
      <h2 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
        <Camera className="w-5 h-5" />
        ライブストリーム
      </h2>

      <UploadLocationSelector
        cameras={cameras}
        selectedCameraId={selectedCameraId}
        useManualLocation={useManualLocation}
        manualLocation={manualLocation}
        onSelectedCameraIdChange={setSelectedCameraId}
        onUseManualLocationChange={setUseManualLocation}
        onManualLocationChange={setManualLocation}
      />

      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">フレーム送信間隔（秒）</label>
        <input
          type="number"
          min="1"
          max="60"
          value={frameInterval}
          onChange={(event) => setFrameInterval(parseInt(event.target.value, 10) || 5)}
          className="w-24 px-3 py-2 border border-slate-200 rounded-md text-sm bg-slate-50/60 focus:ring-2 focus:ring-amber-400 focus:border-amber-400"
          disabled={isBusy}
        />
      </div>

      <div className="rounded-xl border border-slate-200 overflow-hidden bg-slate-900/95">
        <video ref={videoRef} autoPlay muted playsInline className="w-full h-56 object-cover" />
      </div>

      <div className="flex items-center gap-3 text-sm">
        <span className="px-2 py-1 rounded bg-slate-100 text-slate-700">状態: {stateLabel[connectionState]}</span>
        <span className="text-slate-600">送信フレーム: {framesSent}</span>
        {lastAck && <span className="text-slate-600">最新検出: {lastAck.detections_count}</span>}
        {connectionState === 'reconnecting' && (
          <span className="inline-flex items-center gap-1 text-amber-700">
            <WifiOff className="w-4 h-4" />
            再接続試行: {reconnectAttempts}
          </span>
        )}
      </div>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => void startStream()}
          disabled={isRunning || isBusy}
          className="inline-flex items-center gap-2 px-3 py-2 rounded-md bg-emerald-600 text-white text-sm disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {connectionState === 'starting' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
          開始
        </button>
        <button
          type="button"
          onClick={() => void stopStream()}
          disabled={!isRunning && connectionState !== 'error'}
          className="inline-flex items-center gap-2 px-3 py-2 rounded-md bg-slate-700 text-white text-sm disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {connectionState === 'stopping' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Square className="w-4 h-4" />}
          停止
        </button>
      </div>

      {error && (
        <div className="p-3 bg-red-500/10 text-red-700 rounded-md text-sm border border-red-200/80 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
};
