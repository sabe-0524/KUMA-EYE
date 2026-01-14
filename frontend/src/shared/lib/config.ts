// API設定
export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1';

export const API_ENDPOINTS = {
  cameras: `${API_BASE_URL}/cameras`,
  uploads: `${API_BASE_URL}/uploads`,
  sightings: `${API_BASE_URL}/sightings`,
  alerts: `${API_BASE_URL}/alerts`,
  images: `${API_BASE_URL}/images`,
} as const;
