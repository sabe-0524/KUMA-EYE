import React from 'react';
import { CircleMarker, Popup, TileLayer, ZoomControl } from 'react-leaflet';
import { getFullImageUrl } from '@/shared/api';
import { alertLevelEmojis, alertLevelLabels } from '@/shared/types';
import { formatConfidence, formatDateTime, getAlertColor, getMarkerRadius } from '@/shared/lib/utils';
import type { Sighting } from '@/shared/types';

interface MapSightingsLayerProps {
  sightings: Sighting[];
  onSightingSelect?: (sighting: Sighting) => void;
  onImageClick: (url: string) => void;
}

export const MapSightingsLayer: React.FC<MapSightingsLayerProps> = ({
  sightings,
  onSightingSelect,
  onImageClick,
}) => {
  return (
    <>
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <ZoomControl position="topright" />
      {sightings.map((sighting) => (
        <CircleMarker
          key={sighting.id}
          center={[sighting.latitude, sighting.longitude]}
          radius={getMarkerRadius(sighting.bear_count)}
          pathOptions={{
            color: getAlertColor(sighting.alert_level),
            fillColor: getAlertColor(sighting.alert_level),
            fillOpacity: 0.7,
            weight: 2,
          }}
          eventHandlers={{
            click: () => onSightingSelect?.(sighting),
          }}
        >
          <Popup>
            <div className="min-w-[200px]">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-lg">{alertLevelEmojis[sighting.alert_level]}</span>
                <span className="font-bold">{alertLevelLabels[sighting.alert_level]}</span>
              </div>

              <div className="space-y-1 text-sm">
                <p>
                  <strong>検出日時:</strong> {formatDateTime(sighting.detected_at)}
                </p>
                <p>
                  <strong>信頼度:</strong> {formatConfidence(sighting.confidence)}
                </p>
                <p>
                  <strong>検出数:</strong> {sighting.bear_count}頭
                </p>
                {sighting.camera && (
                  <p>
                    <strong>カメラ:</strong> {sighting.camera.name}
                  </p>
                )}
              </div>

              {sighting.image_url && (
                <div className="mt-2">
                  <img
                    src={getFullImageUrl(sighting.image_url)}
                    alt="検出画像"
                    className="w-full h-32 object-cover rounded cursor-pointer hover:opacity-80"
                    onClick={(event) => {
                      event.stopPropagation();
                      onImageClick(sighting.image_url!);
                    }}
                  />
                </div>
              )}
            </div>
          </Popup>
        </CircleMarker>
      ))}
    </>
  );
};
