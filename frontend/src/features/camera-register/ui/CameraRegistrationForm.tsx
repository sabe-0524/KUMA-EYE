import React from 'react';
import { AlertCircle, Camera, Check, Loader2, MapPin } from 'lucide-react';
import type { LatLng } from '@/shared/types';

interface CameraRegistrationFormProps {
  placementMode: boolean;
  selectedLocation: LatLng | null;
  name: string;
  latitude: string;
  longitude: string;
  description: string;
  isSubmitting: boolean;
  error: string | null;
  success: boolean;
  onPlacementModeChange: (enabled: boolean) => void;
  onGetCurrentLocation: () => void;
  onNameChange: (value: string) => void;
  onLatitudeChange: (value: string) => void;
  onLongitudeChange: (value: string) => void;
  onDescriptionChange: (value: string) => void;
  onClearSelectedLocationInputs: () => void;
  onSubmit: (event: React.FormEvent) => void;
}

export const CameraRegistrationForm: React.FC<CameraRegistrationFormProps> = ({
  placementMode,
  selectedLocation,
  name,
  latitude,
  longitude,
  description,
  isSubmitting,
  error,
  success,
  onPlacementModeChange,
  onGetCurrentLocation,
  onNameChange,
  onLatitudeChange,
  onLongitudeChange,
  onDescriptionChange,
  onClearSelectedLocationInputs,
  onSubmit,
}) => {
  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <h3 className="font-semibold text-slate-800 flex items-center gap-2">
        <Camera className="w-5 h-5" />
        新規カメラ登録
      </h3>

      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">
          カメラ名 <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          value={name}
          onChange={(event) => onNameChange(event.target.value)}
          placeholder="例: 山間部監視カメラA"
          className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-slate-50/60 focus:ring-2 focus:ring-amber-400 focus:border-amber-400"
          disabled={isSubmitting}
        />
      </div>

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
              onClick={onGetCurrentLocation}
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
              onClick={onClearSelectedLocationInputs}
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
              onChange={(event) => onLatitudeChange(event.target.value)}
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
              onChange={(event) => onLongitudeChange(event.target.value)}
              placeholder="139.7671"
              className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-slate-50/60 focus:ring-2 focus:ring-amber-400 focus:border-amber-400"
              disabled={isSubmitting}
            />
          </div>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">説明（任意）</label>
        <textarea
          value={description}
          onChange={(event) => onDescriptionChange(event.target.value)}
          placeholder="例: 北アルプス山麓の監視カメラ"
          rows={2}
          className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-slate-50/60 focus:ring-2 focus:ring-amber-400 focus:border-amber-400 resize-none"
          disabled={isSubmitting}
        />
      </div>

      {error && (
        <div className="flex items-center gap-2 text-red-600 text-sm bg-red-500/10 p-3 rounded-lg border border-red-200/80">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          {error}
        </div>
      )}

      {success && (
        <div className="flex items-center gap-2 text-green-600 text-sm bg-green-500/10 p-3 rounded-lg border border-green-200/80">
          <Check className="w-4 h-4 flex-shrink-0" />
          カメラを登録しました
        </div>
      )}

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
  );
};
