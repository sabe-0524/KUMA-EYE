'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { MapContainer, TileLayer, CircleMarker, Popup, ZoomControl } from 'react-leaflet';
import type { LatLngBoundsExpression } from 'leaflet';
import { getSightings, getFullImageUrl } from '@/shared/api';
import type { Sighting } from '@/shared/types';
import { alertLevelLabels, alertLevelEmojis } from '@/shared/types';
import { getAlertColor, getMarkerRadius, formatConfidence, formatDateTime } from '@/shared/lib/utils';
import { ImageModal } from '@/shared/ui';

// 東京周辺をデフォルト中心に
const DEFAULT_CENTER: [number, number] = [35.6812, 139.7671];
const DEFAULT_ZOOM = 10;
const JAPAN_BOUNDS: LatLngBoundsExpression = [
  [24.0, 124.5],
  [45.5, 146.5],
];
const MIN_ZOOM_JAPAN = 5;

interface MapViewProps {
  onSightingSelect?: (sighting: Sighting) => void;
  refreshInterval?: number;
  refreshTrigger?: number;
}

// マーカーを表示するサブコンポーネント
const SightingMarkers: React.FC<{
  sightings: Sighting[];
  onSightingSelect?: (sighting: Sighting) => void;
  onImageClick: (url: string) => void;
}> = ({ sightings, onSightingSelect, onImageClick }) => {
  return (
    <>
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
                <span className="font-bold">
                  {alertLevelLabels[sighting.alert_level]}
                </span>
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
                    onClick={(e) => {
                      e.stopPropagation();
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

// 凡例コンポーネント
const Legend: React.FC = () => (
  <div className="absolute bottom-4 left-4 bg-white/90 backdrop-blur rounded-xl border border-slate-200/70 shadow-lg p-3 z-[1000]">
    <h4 className="font-semibold text-sm text-slate-900 mb-2">警報レベル</h4>
    <div className="space-y-1">
      {(['critical', 'warning', 'caution', 'low'] as const).map((level) => (
        <div key={level} className="flex items-center gap-2 text-sm">
          <span
            className="w-3 h-3 rounded-full"
            style={{ backgroundColor: getAlertColor(level) }}
          />
          <span>{alertLevelEmojis[level]} {alertLevelLabels[level]}</span>
        </div>
      ))}
    </div>
  </div>
);

// メインの地図コンポーネント（内部用）
const MapContent: React.FC<{
  sightings: Sighting[];
  onSightingSelect?: (sighting: Sighting) => void;
  onImageClick: (url: string) => void;
}> = ({ sightings, onSightingSelect, onImageClick }) => {
  return (
    <>
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <ZoomControl position="topright" />
      <SightingMarkers
        sightings={sightings}
        onSightingSelect={onSightingSelect}
        onImageClick={onImageClick}
      />
    </>
  );
};

export const MapView: React.FC<MapViewProps> = ({ 
  onSightingSelect,
  refreshInterval = 30000,
  refreshTrigger = 0
}) => {
  const [sightings, setSightings] = useState<Sighting[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  const fetchSightings = useCallback(async () => {
    try {
      const response = await getSightings({ limit: 500 });
      setSightings(response.sightings);
      setError(null);
    } catch (err) {
      console.error('Failed to fetch sightings:', err);
      setError('目撃情報の取得に失敗しました');
    } finally {
      setLoading(false);
    }
  }, []);

  // 初回ロードと定期更新
  useEffect(() => {
    fetchSightings();
    const interval = setInterval(fetchSightings, refreshInterval);
    return () => clearInterval(interval);
  }, [fetchSightings, refreshInterval]);

  // 外部トリガーによる再フェッチ
  useEffect(() => {
    if (refreshTrigger > 0) {
      fetchSightings();
    }
  }, [refreshTrigger, fetchSightings]);

  const handleImageClick = useCallback((url: string) => {
    setSelectedImage(url);
  }, []);

  if (loading) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-slate-50 via-amber-50/60 to-emerald-50/40">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4" />
          <p className="text-slate-600">地図を読み込み中...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative w-full h-full">
      <MapContainer
        center={DEFAULT_CENTER}
        zoom={DEFAULT_ZOOM}
        minZoom={MIN_ZOOM_JAPAN}
        maxBounds={JAPAN_BOUNDS}
        maxBoundsViscosity={1.0}
        className="w-full h-full"
        zoomControl={false}
        scrollWheelZoom={true}
      >
        <MapContent
          sightings={sightings}
          onSightingSelect={onSightingSelect}
          onImageClick={handleImageClick}
        />
      </MapContainer>

      <Legend />

      {error && (
        <div className="absolute top-4 left-1/2 transform -translate-x-1/2 bg-red-500/10 text-red-700 px-4 py-2 rounded-lg border border-red-200/80 shadow z-[1000]">
          {error}
        </div>
      )}

      {selectedImage && (
        <ImageModal
          imageUrl={selectedImage}
          onClose={() => setSelectedImage(null)}
        />
      )}
    </div>
  );
};

export default MapView;
