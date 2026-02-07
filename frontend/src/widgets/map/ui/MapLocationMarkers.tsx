import React from 'react';
import { CircleMarker, Popup } from 'react-leaflet';
import type { LatLng } from '@/shared/types';

interface MapLocationMarkersProps {
  currentLocation: LatLng | null;
  manualLocation: LatLng | null;
  cameraPlacementLocation: LatLng | null;
}

export const MapLocationMarkers: React.FC<MapLocationMarkersProps> = ({
  currentLocation,
  manualLocation,
  cameraPlacementLocation,
}) => {
  return (
    <>
      {currentLocation && (
        <>
          <CircleMarker
            center={[currentLocation.lat, currentLocation.lng]}
            radius={10}
            pathOptions={{
              color: '#ffffff',
              fillColor: '#ffffff',
              fillOpacity: 1,
              weight: 1,
            }}
            interactive={false}
          />
          <CircleMarker
            center={[currentLocation.lat, currentLocation.lng]}
            radius={7}
            pathOptions={{
              color: '#ffffff',
              fillColor: '#2563eb',
              fillOpacity: 1,
              weight: 2,
            }}
          >
            <Popup>
              <div className="text-sm font-semibold">現在地</div>
            </Popup>
          </CircleMarker>
        </>
      )}

      {!currentLocation && manualLocation && (
        <CircleMarker
          center={[manualLocation.lat, manualLocation.lng]}
          radius={8}
          pathOptions={{
            color: '#0f766e',
            fillColor: '#0f766e',
            fillOpacity: 0.95,
            weight: 2,
          }}
        >
          <Popup>
            <div className="text-sm font-semibold">指定地点</div>
          </Popup>
        </CircleMarker>
      )}

      {cameraPlacementLocation && (
        <CircleMarker
          center={[cameraPlacementLocation.lat, cameraPlacementLocation.lng]}
          radius={8}
          pathOptions={{
            color: '#a16207',
            fillColor: '#f59e0b',
            fillOpacity: 0.95,
            weight: 2,
          }}
        >
          <Popup>
            <div className="text-sm font-semibold">カメラ設置候補地点</div>
          </Popup>
        </CircleMarker>
      )}
    </>
  );
};
