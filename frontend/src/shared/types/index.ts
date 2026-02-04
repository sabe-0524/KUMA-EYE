// バックエンドAPIレスポンスに対応する型定義

export type AlertLevel = 'critical' | 'warning' | 'caution' | 'low';
export type UploadStatus = 'pending' | 'processing' | 'completed' | 'failed';
export type FileType = 'video' | 'image';
export type TimeRange = 'day' | 'week' | 'month' | 'all';

// カメラ
export interface Camera {
  id: number;
  name: string;
  latitude: number;
  longitude: number;
  description?: string;
  is_active: boolean;
  created_at: string;
  updated_at?: string;
}

export interface CameraListResponse {
  total: number;
  cameras: Camera[];
}

// 目撃情報
export interface CameraSummary {
  id: number;
  name: string;
}

export interface Sighting {
  id: number;
  latitude: number;
  longitude: number;
  detected_at: string;
  confidence: number;
  bear_count: number;
  alert_level: AlertLevel;
  image_url?: string;
  camera?: CameraSummary;
  created_at: string;
}

export interface SightingListResponse {
  total: number;
  sightings: Sighting[];
}

export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Detection {
  id: number;
  class_name: string;
  confidence: number;
  bbox: BoundingBox;
}

export interface SightingDetail extends Sighting {
  detections: Detection[];
  upload_id: number;
  frame_number?: number;
}

// アップロード
export interface UploadResponse {
  upload_id: number;
  status: UploadStatus;
  message: string;
  estimated_time_seconds?: number;
}

export interface UploadDetail {
  id: number;
  camera_id?: number;
  file_path: string;
  file_type: FileType;
  file_size?: number;
  duration_seconds?: number;
  uploaded_at: string;
  recorded_at?: string;
  processed_at?: string;
  status: UploadStatus;
  frame_count?: number;
  error_message?: string;
  latitude?: number;
  longitude?: number;
  sighting_count: number;
}

// 警報
export interface Alert {
  id: number;
  sighting_id: number;
  alert_level: AlertLevel;
  message: string;
  notified_at: string;
  acknowledged: boolean;
  acknowledged_at?: string;
  acknowledged_by?: string;
  sighting?: Sighting;
}

export interface AlertListResponse {
  total: number;
  alerts: Alert[];
}

export interface AlertCount {
  unacknowledged: number;
  critical: number;
}

// 統計
export interface SightingStatistics {
  total_sightings: number;
  sightings_by_level: Record<string, number>;
  sightings_today: number;
  sightings_this_week: number;
  average_confidence: number;
}

// 警報レベルの色定義
export const alertLevelColors: Record<AlertLevel, string> = {
  critical: '#dc2626', // red-600
  warning: '#ea580c',  // orange-600
  caution: '#ca8a04',  // yellow-600
  low: '#2563eb',      // blue-600
};

// 警報レベルのラベル
export const alertLevelLabels: Record<AlertLevel, string> = {
  critical: '危険',
  warning: '警戒',
  caution: '注意',
  low: '低',
};

// 警報レベルの絵文字
export const alertLevelEmojis: Record<AlertLevel, string> = {
  critical: '🔴',
  warning: '🟠',
  caution: '🟡',
  low: '🔵',
};
