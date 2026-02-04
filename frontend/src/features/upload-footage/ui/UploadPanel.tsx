'use client';

import React, { useState, useCallback, useEffect } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, Camera, MapPin, Loader2, CheckCircle, AlertCircle, X } from 'lucide-react';
import JSZip from 'jszip';
import { uploadFootage, uploadFramesZip, getCameras, getUpload } from '@/shared/api';
import type { Camera as CameraType, UploadResponse, UploadStatus } from '@/shared/types';

interface UploadPanelProps {
  onUploadComplete?: () => void;
}

export const UploadPanel: React.FC<UploadPanelProps> = ({ onUploadComplete }) => {
  const [cameras, setCameras] = useState<CameraType[]>([]);
  const [selectedCameraId, setSelectedCameraId] = useState<number | null>(null);
  const [manualLocation, setManualLocation] = useState({ latitude: '', longitude: '' });
  const [useManualLocation, setUseManualLocation] = useState(false);
  const [frameInterval, setFrameInterval] = useState(5);
  
  const [uploading, setUploading] = useState(false);
  const [clientProcessing, setClientProcessing] = useState(false);
  const [uploadResult, setUploadResult] = useState<UploadResponse | null>(null);
  const [uploadStatus, setUploadStatus] = useState<UploadStatus | null>(null);
  const [error, setError] = useState<string | null>(null);

  // カメラ一覧を取得
  useEffect(() => {
    const fetchCameras = async () => {
      try {
        const response = await getCameras(true);
        setCameras(response.cameras);
      } catch (err) {
        console.error('Failed to fetch cameras:', err);
      }
    };
    fetchCameras();
  }, []);

  // アップロード状態をポーリング
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
      } catch (err) {
        console.error('Failed to poll status:', err);
      }
    };

    const interval = setInterval(pollStatus, 2000);
    return () => clearInterval(interval);
  }, [uploadResult, uploadStatus, onUploadComplete]);

  const waitForEvent = (target: EventTarget, event: string) => {
    return new Promise<void>((resolve, reject) => {
      const onSuccess = () => {
        cleanup();
        resolve();
      };
      const onError = () => {
        cleanup();
        reject(new Error(`Failed to load video for ${event}`));
      };
      const cleanup = () => {
        target.removeEventListener(event, onSuccess);
        target.removeEventListener('error', onError);
      };
      target.addEventListener(event, onSuccess, { once: true });
      target.addEventListener('error', onError, { once: true });
    });
  };

  const createFramesZipFromVideo = async (file: File, intervalSeconds: number): Promise<File> => {
    const zip = new JSZip();
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.muted = true;
    video.playsInline = true;

    const objectUrl = URL.createObjectURL(file);
    video.src = objectUrl;

    try {
      await waitForEvent(video, 'loadedmetadata');
      await waitForEvent(video, 'loadeddata');

      const duration = Number.isFinite(video.duration) ? video.duration : 0;
      const width = video.videoWidth || 1280;
      const height = video.videoHeight || 720;
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext('2d');
      if (!context) {
        throw new Error('Canvas not supported');
      }

      const interval = Math.max(1, intervalSeconds || 5);
      const times: number[] = [];
      if (duration > 0) {
        for (let t = 0; t < duration; t += interval) {
          times.push(t);
        }
      }
      if (times.length === 0) {
        times.push(0);
      }

      let index = 0;
      let hasSeeked = false;
      for (const time of times) {
        const targetTime = Math.min(time, duration || 0);
        if (!hasSeeked || Math.abs(video.currentTime - targetTime) > 0.01) {
          video.currentTime = targetTime;
          await waitForEvent(video, 'seeked');
          hasSeeked = true;
        }
        context.drawImage(video, 0, 0, canvas.width, canvas.height);
        const blob = await new Promise<Blob>((resolve, reject) => {
          canvas.toBlob((result) => {
            if (!result) {
              reject(new Error('Failed to encode frame'));
              return;
            }
            resolve(result);
          }, 'image/jpeg', 0.9);
        });
        const name = `frame_${String(index).padStart(6, '0')}.jpg`;
        zip.file(name, blob);
        index += 1;
      }

      const zipBlob = await zip.generateAsync({ type: 'blob' });
      return new File([zipBlob], `${file.name.replace(/\.[^/.]+$/, '')}_frames.zip`, {
        type: 'application/zip',
      });
    } finally {
      URL.revokeObjectURL(objectUrl);
    }
  };

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    if (acceptedFiles.length === 0) return;
    
    const file = acceptedFiles[0];
    const isVideo = file.type.startsWith('video/');
    
    // 位置情報チェック
    if (!selectedCameraId && !useManualLocation) {
      setError('カメラを選択するか、位置情報を入力してください');
      return;
    }
    
    if (useManualLocation) {
      const lat = parseFloat(manualLocation.latitude);
      const lng = parseFloat(manualLocation.longitude);
      if (isNaN(lat) || isNaN(lng)) {
        setError('有効な緯度・経度を入力してください');
        return;
      }
    }

    setError(null);
    setUploadResult(null);
    setUploadStatus(null);

    try {
      const options: {
        camera_id?: number;
        latitude?: number;
        longitude?: number;
        frame_interval?: number;
      } = {
        frame_interval: frameInterval,
      };

      if (selectedCameraId) {
        options.camera_id = selectedCameraId;
      } else {
        options.latitude = parseFloat(manualLocation.latitude);
        options.longitude = parseFloat(manualLocation.longitude);
      }

      if (isVideo) {
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
    } catch (err: any) {
      setError(err.response?.data?.detail || 'アップロードに失敗しました');
    } finally {
      setUploading(false);
      setClientProcessing(false);
    }
  }, [selectedCameraId, useManualLocation, manualLocation, frameInterval, onUploadComplete]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'video/*': ['.mp4', '.mov', '.avi'],
      'image/*': ['.jpg', '.jpeg', '.png'],
    },
    maxFiles: 1,
    disabled: uploading || clientProcessing || uploadStatus === 'processing',
  });

  const resetUpload = () => {
    setUploadResult(null);
    setUploadStatus(null);
    setError(null);
  };

  return (
    <div className="bg-white/95 backdrop-blur rounded-xl border border-slate-200/70 shadow-sm p-4">
      <h2 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
        <Upload className="w-5 h-5" />
        映像アップロード
      </h2>

      {/* 位置情報選択 */}
      <div className="mb-4">
        <label className="block text-sm font-medium text-slate-700 mb-2">
          位置情報
        </label>
        
        <div className="space-y-2">
          {/* カメラ選択 */}
          <div className="flex items-center gap-2">
            <input
              type="radio"
              id="useCamera"
              checked={!useManualLocation}
              onChange={() => setUseManualLocation(false)}
              className="w-4 h-4"
            />
            <label htmlFor="useCamera" className="text-sm flex items-center gap-1 text-slate-700">
              <Camera className="w-4 h-4" />
              登録済みカメラ
            </label>
          </div>
          
          {!useManualLocation && (
            <select
              value={selectedCameraId || ''}
              onChange={(e) => setSelectedCameraId(e.target.value ? parseInt(e.target.value) : null)}
              className="w-full px-3 py-2 border border-slate-200 rounded-md text-sm bg-slate-50/60 focus:ring-2 focus:ring-amber-400 focus:border-amber-400"
            >
              <option value="">カメラを選択...</option>
              {cameras.map((camera) => (
                <option key={camera.id} value={camera.id}>
                  {camera.name}
                </option>
              ))}
            </select>
          )}

          {/* 手動入力 */}
          <div className="flex items-center gap-2">
            <input
              type="radio"
              id="useManual"
              checked={useManualLocation}
              onChange={() => setUseManualLocation(true)}
              className="w-4 h-4"
            />
            <label htmlFor="useManual" className="text-sm flex items-center gap-1 text-slate-700">
              <MapPin className="w-4 h-4" />
              位置を手動入力
            </label>
          </div>
          
          {useManualLocation && (
            <div className="grid grid-cols-2 gap-2">
              <input
                type="text"
                placeholder="緯度 (例: 35.6812)"
                value={manualLocation.latitude}
                onChange={(e) => setManualLocation({ ...manualLocation, latitude: e.target.value })}
                className="px-3 py-2 border border-slate-200 rounded-md text-sm bg-slate-50/60 focus:ring-2 focus:ring-amber-400 focus:border-amber-400"
              />
              <input
                type="text"
                placeholder="経度 (例: 139.7671)"
                value={manualLocation.longitude}
                onChange={(e) => setManualLocation({ ...manualLocation, longitude: e.target.value })}
                className="px-3 py-2 border border-slate-200 rounded-md text-sm bg-slate-50/60 focus:ring-2 focus:ring-amber-400 focus:border-amber-400"
              />
            </div>
          )}
        </div>
      </div>

      {/* フレーム間隔 */}
      <div className="mb-4">
        <label className="block text-sm font-medium text-slate-700 mb-1">
          フレーム抽出間隔（秒）
        </label>
        <input
          type="number"
          min="1"
          max="60"
          value={frameInterval}
          onChange={(e) => setFrameInterval(parseInt(e.target.value) || 5)}
          className="w-24 px-3 py-2 border border-slate-200 rounded-md text-sm bg-slate-50/60 focus:ring-2 focus:ring-amber-400 focus:border-amber-400"
        />
      </div>

      {/* ドロップゾーン */}
      <div
        {...getRootProps()}
        className={`
          border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-colors
          ${isDragActive ? 'border-amber-400 bg-amber-50/60' : 'border-slate-200 hover:border-slate-300 bg-slate-50/40'}
          ${uploading || uploadStatus === 'processing' ? 'opacity-50 cursor-not-allowed' : ''}
        `}
      >
        <input {...getInputProps()} />
        
        {clientProcessing ? (
          <div className="flex flex-col items-center gap-2">
            <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
            <p className="text-sm text-slate-600">動画をフレーム化中...</p>
          </div>
        ) : uploading ? (
          <div className="flex flex-col items-center gap-2">
            <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
            <p className="text-sm text-slate-600">アップロード中...</p>
          </div>
        ) : uploadStatus === 'processing' ? (
          <div className="flex flex-col items-center gap-2">
            <Loader2 className="w-8 h-8 animate-spin text-orange-600" />
            <p className="text-sm text-slate-600">熊を検出中...</p>
          </div>
        ) : uploadStatus === 'completed' ? (
          <div className="flex flex-col items-center gap-2">
            <CheckCircle className="w-8 h-8 text-green-600" />
            <p className="text-sm text-green-600">処理完了！</p>
            <button
              onClick={(e) => { e.stopPropagation(); resetUpload(); }}
              className="text-xs text-amber-700 hover:underline"
            >
              新しいファイルをアップロード
            </button>
          </div>
        ) : uploadStatus === 'failed' ? (
          <div className="flex flex-col items-center gap-2">
            <AlertCircle className="w-8 h-8 text-red-600" />
            <p className="text-sm text-red-600">処理に失敗しました</p>
            <button
              onClick={(e) => { e.stopPropagation(); resetUpload(); }}
              className="text-xs text-amber-700 hover:underline"
            >
              再試行
            </button>
          </div>
        ) : (
          <>
            <Upload className="w-8 h-8 mx-auto mb-2 text-slate-400" />
            <p className="text-sm text-slate-600">
              {isDragActive ? 'ドロップしてアップロード' : 'クリックまたはドラッグ＆ドロップ'}
            </p>
            <p className="text-xs text-slate-400 mt-1">
              動画はブラウザで画像化して送信します
            </p>
          </>
        )}
      </div>

      {/* エラー表示 */}
      {error && (
        <div className="mt-3 p-3 bg-red-500/10 text-red-700 rounded-md text-sm border border-red-200/80 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{error}</span>
          <button onClick={() => setError(null)} className="ml-auto">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
};

export default UploadPanel;
