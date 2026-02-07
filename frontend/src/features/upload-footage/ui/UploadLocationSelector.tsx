import React from 'react';
import { Camera, MapPin } from 'lucide-react';
import type { Camera as CameraType } from '@/shared/types';

interface ManualLocationInput {
  latitude: string;
  longitude: string;
}

interface UploadLocationSelectorProps {
  cameras: CameraType[];
  selectedCameraId: number | null;
  useManualLocation: boolean;
  manualLocation: ManualLocationInput;
  onSelectedCameraIdChange: (cameraId: number | null) => void;
  onUseManualLocationChange: (enabled: boolean) => void;
  onManualLocationChange: (location: ManualLocationInput) => void;
}

export const UploadLocationSelector: React.FC<UploadLocationSelectorProps> = ({
  cameras,
  selectedCameraId,
  useManualLocation,
  manualLocation,
  onSelectedCameraIdChange,
  onUseManualLocationChange,
  onManualLocationChange,
}) => {
  return (
    <div className="mb-4">
      <label className="block text-sm font-medium text-slate-700 mb-2">位置情報</label>

      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <input
            type="radio"
            id="useCamera"
            checked={!useManualLocation}
            onChange={() => onUseManualLocationChange(false)}
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
            onChange={(event) =>
              onSelectedCameraIdChange(event.target.value ? parseInt(event.target.value, 10) : null)
            }
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

        <div className="flex items-center gap-2">
          <input
            type="radio"
            id="useManual"
            checked={useManualLocation}
            onChange={() => onUseManualLocationChange(true)}
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
              onChange={(event) =>
                onManualLocationChange({ ...manualLocation, latitude: event.target.value })
              }
              className="px-3 py-2 border border-slate-200 rounded-md text-sm bg-slate-50/60 focus:ring-2 focus:ring-amber-400 focus:border-amber-400"
            />
            <input
              type="text"
              placeholder="経度 (例: 139.7671)"
              value={manualLocation.longitude}
              onChange={(event) =>
                onManualLocationChange({ ...manualLocation, longitude: event.target.value })
              }
              className="px-3 py-2 border border-slate-200 rounded-md text-sm bg-slate-50/60 focus:ring-2 focus:ring-amber-400 focus:border-amber-400"
            />
          </div>
        )}
      </div>
    </div>
  );
};
