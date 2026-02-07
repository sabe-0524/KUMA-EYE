import type { LatLngBoundsExpression } from 'leaflet';
import type { LatLng } from '@/shared/types';

export const DEFAULT_CENTER: [number, number] = [35.6812, 139.7671];
export const DEFAULT_ZOOM = 10;
export const JAPAN_BOUNDS: LatLngBoundsExpression = [
  [24.0, 124.5],
  [45.5, 146.5],
];
export const MIN_ZOOM_JAPAN = 5;
export const NEARBY_ZOOM = 12;
export const NEARBY_RADIUS_KM = 20;

const clamp = (value: number, min: number, max: number): number => {
  return Math.min(Math.max(value, min), max);
};

export const getBoundsFromCenter = (center: LatLng, radiusKm: number): string => {
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
