'use client';

import React, { useState, useEffect } from 'react';
import { MapPin, Camera, Check, AlertCircle, Loader2 } from 'lucide-react';
import { createCamera, getCameras } from '@/shared/api';
import type { Camera as CameraType } from '@/shared/types';

type CameraPlacementLocation = { lat: number; lng: number };

interface CameraRegisterPanelProps {
  onRegisterComplete?: () => void;
  placementMode: boolean;
  selectedLocation: CameraPlacementLocation | null;
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
  const [name, setName] = useState('');
  const [latitude, setLatitude] = useState('');
  const [longitude, setLongitude] = useState('');
  const [description, setDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [cameras, setCameras] = useState<CameraType[]>([]);
  const [isLoadingCameras, setIsLoadingCameras] = useState(true);

  // カメラ一覧を取得
  useEffect(() => {
    const fetchCameras = async () => {
      try {
        const response = await getCameras();
        setCameras(response.cameras);
      } catch (err) {
        console.error('Failed to fetch cameras:', err);
      } finally {
        setIsLoadingCameras(false);
      }
    };
    fetchCameras();
  }, [success]);

  useEffect(() => {
    if (!selectedLocation) return;
    setLatitude(selectedLocation.lat.toFixed(6));
    setLongitude(selectedLocation.lng.toFixed(6));
    setError(null);
  }, [selectedLocation]);

  // 現在地を取得
  const getCurrentLocation = () => {
    if (!navigator.geolocation) {
      setError('位置情報がサポートされていません');
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLatitude(position.coords.latitude.toFixed(6));
        setLongitude(position.coords.longitude.toFixed(6));
        setError(null);
      },
      (err) => {
        setError('位置情報の取得に失敗しました');
        console.error('Geolocation error:', err);
      }
    );
  };

  // フォーム送信
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(false);

    // バリデーション
    if (!name.trim()) {
      setError('カメラ名を入力してください');
      return;
    }

    const lat = parseFloat(latitude);
    const lng = parseFloat(longitude);

    if (isNaN(lat) || lat < -90 || lat > 90) {
      setError('緯度は -90 から 90 の範囲で入力してください');
      return;
    }

    if (isNaN(lng) || lng < -180 || lng > 180) {
      setError('経度は -180 から 180 の範囲で入力してください');
      return;
    }

    setIsSubmitting(true);

    try {
      await createCamera({
        name: name.trim(),
        latitude: lat,
        longitude: lng,
        description: description.trim() || undefined,
      });

      setSuccess(true);
      setName('');
      setLatitude('');
      setLongitude('');
      setDescription('');
      onPlacementModeChange(false);
      onClearSelectedLocation();
      onRegisterComplete?.();

      // 3秒後に成功メッセージを消す
      setTimeout(() => setSuccess(false), 3000);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'カメラの登録に失敗しました');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* 登録フォーム */}
      <form onSubmit={handleSubmit} className="space-y-4">
        <h3 className="font-semibold text-slate-800 flex items-center gap-2">
          <Camera className="w-5 h-5" />
          新規カメラ登録
        </h3>

        {/* カメラ名 */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            カメラ名 <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="例: 山間部監視カメラA"
            className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-slate-50/60 focus:ring-2 focus:ring-amber-400 focus:border-amber-400"
            disabled={isSubmitting}
          />
        </div>

        {/* 位置情報 */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <label className="block text-sm font-medium text-slate-700">
              位置情報 <span className="text-red-500">*</span>
            </label>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => onPlacementModeChange(!placementMode)}
                className={`text-sm flex items-center gap-1 ${
                  placementMode
                    ? 'text-emerald-700 hover:text-emerald-800'
                    : 'text-slate-600 hover:text-slate-700'
                }`}
              >
                <MapPin className="w-4 h-4" />
                {placementMode ? '設置モード: ON' : '地図クリックで設置'}
              </button>
              <button
                type="button"
                onClick={getCurrentLocation}
                className="text-sm text-amber-700 hover:text-amber-800 flex items-center gap-1"
              >
                <MapPin className="w-4 h-4" />
                現在地を取得
              </button>
            </div>
          </div>

          {placementMode && (
            <div className="text-sm bg-emerald-500/10 text-emerald-800 px-3 py-2 rounded-lg border border-emerald-200/80">
              設置モード中です。メイン地図をクリックして設置地点を選択してください。
            </div>
          )}

          {selectedLocation && (
            <div className="flex items-center justify-between text-xs bg-slate-100/80 text-slate-700 px-3 py-2 rounded-lg border border-slate-200/80">
              <span>
                選択地点: {selectedLocation.lat.toFixed(6)}, {selectedLocation.lng.toFixed(6)}
              </span>
              <button
                type="button"
                onClick={onClearSelectedLocation}
                className="text-slate-600 hover:text-slate-800"
              >
                クリア
              </button>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-slate-500 mb-1">緯度</label>
              <input
                type="number"
                step="any"
                value={latitude}
                onChange={(e) => setLatitude(e.target.value)}
                placeholder="35.6812"
                className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-slate-50/60 focus:ring-2 focus:ring-amber-400 focus:border-amber-400"
                disabled={isSubmitting}
              />
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1">経度</label>
              <input
                type="number"
                step="any"
                value={longitude}
                onChange={(e) => setLongitude(e.target.value)}
                placeholder="139.7671"
                className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-slate-50/60 focus:ring-2 focus:ring-amber-400 focus:border-amber-400"
                disabled={isSubmitting}
              />
            </div>
          </div>
        </div>

        {/* 説明 */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            説明（任意）
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="例: 北アルプス山麓の監視カメラ"
            rows={2}
            className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-slate-50/60 focus:ring-2 focus:ring-amber-400 focus:border-amber-400 resize-none"
            disabled={isSubmitting}
          />
        </div>

        {/* エラーメッセージ */}
        {error && (
          <div className="flex items-center gap-2 text-red-600 text-sm bg-red-500/10 p-3 rounded-lg border border-red-200/80">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            {error}
          </div>
        )}

        {/* 成功メッセージ */}
        {success && (
          <div className="flex items-center gap-2 text-green-600 text-sm bg-green-500/10 p-3 rounded-lg border border-green-200/80">
            <Check className="w-4 h-4 flex-shrink-0" />
            カメラを登録しました
          </div>
        )}

        {/* 送信ボタン */}
        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full py-2 px-4 bg-amber-600 text-white rounded-lg hover:bg-amber-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm flex items-center justify-center gap-2"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              登録中...
            </>
          ) : (
            <>
              <Camera className="w-4 h-4" />
              カメラを登録
            </>
          )}
        </button>
      </form>

      {/* 登録済みカメラ一覧 */}
      <div>
        <h3 className="font-semibold text-slate-800 mb-3">登録済みカメラ</h3>
        {isLoadingCameras ? (
          <div className="text-center py-4 text-slate-500">
            <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2" />
            読み込み中...
          </div>
        ) : cameras.length === 0 ? (
          <p className="text-slate-500 text-sm text-center py-4">
            登録されたカメラはありません
          </p>
        ) : (
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {cameras.map((camera) => (
              <div
                key={camera.id}
                className="p-3 bg-slate-50/70 rounded-lg border border-slate-200/80"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-medium text-slate-800">{camera.name}</p>
                    <p className="text-xs text-slate-500 mt-1">
                      {camera.latitude.toFixed(4)}, {camera.longitude.toFixed(4)}
                    </p>
                    {camera.description && (
                      <p className="text-sm text-slate-600 mt-1">{camera.description}</p>
                    )}
                  </div>
                  <span
                    className={`text-xs px-2 py-1 rounded-full ${
                      camera.is_active
                        ? 'bg-green-500/10 text-green-700 border border-green-200/80'
                        : 'bg-slate-100 text-slate-500 border border-slate-200/80'
                    }`}
                  >
                    {camera.is_active ? '有効' : '無効'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
