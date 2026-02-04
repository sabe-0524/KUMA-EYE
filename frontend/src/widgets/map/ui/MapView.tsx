'use client';

import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  MapContainer,
  TileLayer,
  CircleMarker,
  Popup,
  ZoomControl,
  useMap,
  useMapEvents,
} from 'react-leaflet';
import type { LatLngBoundsExpression } from 'leaflet';
import { getSightings, getFullImageUrl } from '@/shared/api';
import type { Sighting, TimeRange } from '@/shared/types';
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
const NEARBY_ZOOM = 12;
const NEARBY_RADIUS_KM = 20;

type DisplayMode = 'national' | 'nearby';
type LocationStatus = 'idle' | 'requesting' | 'granted' | 'manual';
type LatLng = { lat: number; lng: number };

interface MapViewProps {
  onSightingSelect?: (sighting: Sighting) => void;
  refreshInterval?: number;
  refreshTrigger?: number;
  timeRange?: TimeRange;
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
      {(['critical', 'warning', 'caution'] as const).map((level) => (
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

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

const getBoundsFromCenter = (center: LatLng, radiusKm: number): string => {
  const deltaLat = radiusKm / 111;
  const cosLat = Math.cos((center.lat * Math.PI) / 180);
  const safeCosLat = Math.max(Math.abs(cosLat), 0.000001);
  const deltaLng = radiusKm / (111 * safeCosLat);
  const swLat = clamp(center.lat - deltaLat, -90, 90);
  const swLng = clamp(center.lng - deltaLng, -180, 180);
  const neLat = clamp(center.lat + deltaLat, -90, 90);
  const neLng = clamp(center.lng + deltaLng, -180, 180);
  return `${swLat},${swLng},${neLat},${neLng}`;
};

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

const LocationMarker: React.FC<{
  currentLocation: LatLng | null;
  manualLocation: LatLng | null;
}> = ({ currentLocation, manualLocation }) => {
  const location = currentLocation ?? manualLocation;
  if (!location) return null;

  const isCurrent = Boolean(currentLocation);
  const color = isCurrent ? '#2563eb' : '#0f766e';
  const label = isCurrent ? '現在地' : '指定地点';

  return (
    <CircleMarker
      center={[location.lat, location.lng]}
      radius={8}
      pathOptions={{
        color,
        fillColor: color,
        fillOpacity: 0.95,
        weight: 2,
      }}
    >
      <Popup>
        <div className="text-sm font-semibold">{label}</div>
      </Popup>
    </CircleMarker>
  );
};

const MapController: React.FC<{
  displayMode: DisplayMode;
  locationStatus: LocationStatus;
  currentLocation: LatLng | null;
  manualLocation: LatLng | null;
  onManualLocationSelect: (location: LatLng) => void;
}> = ({
  displayMode,
  locationStatus,
  currentLocation,
  manualLocation,
  onManualLocationSelect,
}) => {
  const map = useMap();

  useEffect(() => {
    if (displayMode !== 'nearby') return;
    const target = currentLocation ?? manualLocation;
    if (!target) return;
    map.setView([target.lat, target.lng], NEARBY_ZOOM);
  }, [displayMode, currentLocation, manualLocation, map]);

  useMapEvents({
    click: (event) => {
      if (locationStatus !== 'manual' || displayMode !== 'nearby') return;
      const location = { lat: event.latlng.lat, lng: event.latlng.lng };
      onManualLocationSelect(location);
      map.setView([location.lat, location.lng], NEARBY_ZOOM);
    },
  });

  return null;
};

export const MapView: React.FC<MapViewProps> = ({ 
  onSightingSelect,
  refreshInterval = 30000,
  refreshTrigger = 0,
  timeRange
}) => {
  const [sightings, setSightings] = useState<Sighting[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [displayMode, setDisplayMode] = useState<DisplayMode>('national');
  const [locationStatus, setLocationStatus] = useState<LocationStatus>('idle');
  const [currentLocation, setCurrentLocation] = useState<LatLng | null>(null);
  const [manualLocation, setManualLocation] = useState<LatLng | null>(null);

  const fetchSightings = useCallback(async () => {
    try {
      const now = new Date();
      let startDate: Date | null = null;

      if (timeRange === 'day') {
        startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      } else if (timeRange === 'week') {
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      } else if (timeRange === 'month') {
        startDate = new Date(now);
        startDate.setMonth(startDate.getMonth() - 1);
      }

      const bounds =
        displayMode === 'nearby'
          ? (() => {
              const center = currentLocation ?? manualLocation;
              if (!center) return null;
              return getBoundsFromCenter(center, NEARBY_RADIUS_KM);
            })()
          : null;

      if (displayMode === 'nearby' && !bounds) {
        setLoading(false);
        return;
      }

      const response = await getSightings({
        limit: 500,
        start_date: startDate ? startDate.toISOString() : undefined,
        end_date: startDate ? now.toISOString() : undefined,
        ...(bounds ? { bounds } : {}),
      });
      setSightings(response.sightings.filter((sighting) => sighting.alert_level !== 'low'));
      setError(null);
    } catch (err) {
      console.error('Failed to fetch sightings:', err);
      setError('目撃情報の取得に失敗しました');
    } finally {
      setLoading(false);
    }
  }, [displayMode, currentLocation, manualLocation, timeRange]);

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

  useEffect(() => {
    if (displayMode !== 'nearby') {
      setLocationStatus('idle');
      setCurrentLocation(null);
      setManualLocation(null);
      return;
    }
    if (!navigator.geolocation) {
      setLocationStatus('manual');
      return;
    }
    setLocationStatus('requesting');
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setCurrentLocation({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        });
        setLocationStatus('granted');
      },
      () => {
        setLocationStatus('manual');
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 30000,
      }
    );
  }, [displayMode]);

  const selectedCenter = useMemo(
    () => currentLocation ?? manualLocation,
    [currentLocation, manualLocation]
  );

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
      <div className="absolute top-4 left-4 z-[1000] flex items-center gap-2 bg-white/90 backdrop-blur border border-slate-200/70 shadow-lg rounded-xl px-3 py-2">
        <div className="text-sm text-slate-700">表示:</div>
        <button
          onClick={() => setDisplayMode('national')}
          className={`px-3 py-1 rounded-full text-sm transition-colors ${
            displayMode === 'national'
              ? 'bg-amber-600 text-white'
              : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
          }`}
        >
          全国
        </button>
        <button
          onClick={() => setDisplayMode('nearby')}
          className={`px-3 py-1 rounded-full text-sm transition-colors ${
            displayMode === 'nearby'
              ? 'bg-emerald-600 text-white'
              : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
          }`}
        >
          現在地付近
        </button>
      </div>

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
        <LocationMarker
          currentLocation={currentLocation}
          manualLocation={manualLocation}
        />
        <MapController
          displayMode={displayMode}
          locationStatus={locationStatus}
          currentLocation={currentLocation}
          manualLocation={manualLocation}
          onManualLocationSelect={setManualLocation}
        />
      </MapContainer>

      <Legend />

      {displayMode === 'nearby' && locationStatus === 'manual' && !selectedCenter && (
        <div className="absolute top-16 left-1/2 transform -translate-x-1/2 bg-amber-500/10 text-amber-800 px-4 py-2 rounded-lg border border-amber-200/80 shadow z-[1000] text-sm">
          位置情報が取得できません。地図をクリックして地点を指定してください。
        </div>
      )}

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
