import React from 'react';
import type { LatLng } from '@/shared/types';
import type { LocationStatus } from '@/widgets/map/model/useMapSightings';

interface MapStatusBannersProps {
  displayMode: 'national' | 'nearby';
  locationStatus: LocationStatus;
  selectedCenter: LatLng | null;
  cameraPlacementMode: boolean;
  error: string | null;
}

export const MapStatusBanners: React.FC<MapStatusBannersProps> = ({
  displayMode,
  locationStatus,
  selectedCenter,
  cameraPlacementMode,
  error,
}) => {
  return (
    <>
      {displayMode === 'nearby' && locationStatus === 'manual' && !selectedCenter && (
        <div className="absolute top-16 left-1/2 transform -translate-x-1/2 bg-amber-500/10 text-amber-800 px-4 py-2 rounded-lg border border-amber-200/80 shadow z-[1000] text-sm">
          位置情報が取得できません。地図をクリックして地点を指定してください。
        </div>
      )}

      {cameraPlacementMode && (
        <div className="absolute top-16 right-4 bg-amber-500/10 text-amber-800 px-4 py-2 rounded-lg border border-amber-200/80 shadow z-[1000] text-sm">
          カメラ設置モード: 地図をクリックして設置地点を選択
        </div>
      )}

      {error && (
        <div className="absolute top-4 left-1/2 transform -translate-x-1/2 bg-red-500/10 text-red-700 px-4 py-2 rounded-lg border border-red-200/80 shadow z-[1000]">
          {error}
        </div>
      )}
    </>
  );
};
