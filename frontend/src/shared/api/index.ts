import axios from 'axios';
import { API_BASE_URL } from '@/shared/lib/config';
import { auth } from '@/shared/lib/firebase';
import type {
  Camera,
  CameraListResponse,
  Sighting,
  SightingListResponse,
  SightingDetail,
  SightingStatistics,
  Alert,
  AlertListResponse,
  AlertCount,
  UploadResponse,
  UploadDetail,
  UserProfile,
  UserSyncResponse,
} from '@/shared/types';

// Axiosインスタンス
const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

const USER_ENDPOINTS_WITHOUT_REDIRECT = ['/users/sync', '/users/me'] as const;

const shouldSkipAuthRedirect = (url: string): boolean =>
  USER_ENDPOINTS_WITHOUT_REDIRECT.some((endpoint) => url.includes(endpoint));

const withAuthHeader = (idToken?: string) =>
  idToken
    ? {
        headers: {
          Authorization: `Bearer ${idToken}`,
        },
      }
    : undefined;

// リクエストインターセプター: Firebase認証トークンを自動付与
apiClient.interceptors.request.use(
  async (config) => {
    const existingAuthHeader =
      (config.headers as Record<string, string | undefined> | undefined)?.Authorization;

    if (existingAuthHeader) {
      return config;
    }

    const user = auth.currentUser;
    if (user) {
      try {
        const token = await user.getIdToken();
        config.headers.Authorization = `Bearer ${token}`;
      } catch (error) {
        console.error('トークン取得エラー:', error);
      }
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// レスポンスインターセプター: 認証エラー時の処理
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error.response?.status;
    const requestUrl: string = error.config?.url || '';
    const isUserSyncRequest = shouldSkipAuthRedirect(requestUrl);

    if (status === 401 && !isUserSyncRequest) {
      // 認証エラーの場合、ログインページにリダイレクト
      if (typeof window !== 'undefined') {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

// =============================================================================
// カメラAPI
// =============================================================================

export const getCameras = async (isActive?: boolean): Promise<CameraListResponse> => {
  const params = isActive !== undefined ? { is_active: isActive } : {};
  const response = await apiClient.get<CameraListResponse>('/cameras', { params });
  return response.data;
};

export const getCamera = async (id: number): Promise<Camera> => {
  const response = await apiClient.get<Camera>(`/cameras/${id}`);
  return response.data;
};

export const createCamera = async (data: {
  name: string;
  latitude: number;
  longitude: number;
  description?: string;
}): Promise<Camera> => {
  const response = await apiClient.post<Camera>('/cameras', data);
  return response.data;
};

// =============================================================================
// アップロードAPI
// =============================================================================

export const uploadFootage = async (
  file: File,
  options: {
    camera_id?: number;
    latitude?: number;
    longitude?: number;
    frame_interval?: number;
  }
): Promise<UploadResponse> => {
  const formData = new FormData();
  formData.append('file', file);
  
  if (options.camera_id) {
    formData.append('camera_id', options.camera_id.toString());
  }
  if (options.latitude !== undefined) {
    formData.append('latitude', options.latitude.toString());
  }
  if (options.longitude !== undefined) {
    formData.append('longitude', options.longitude.toString());
  }
  if (options.frame_interval) {
    formData.append('frame_interval', options.frame_interval.toString());
  }
  
  const response = await apiClient.post<UploadResponse>('/uploads', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });
  return response.data;
};

export const uploadFramesZip = async (
  zipFile: File,
  options: {
    camera_id?: number;
    latitude?: number;
    longitude?: number;
    frame_interval?: number;
  }
): Promise<UploadResponse> => {
  const formData = new FormData();
  formData.append('zip_file', zipFile);

  if (options.camera_id) {
    formData.append('camera_id', options.camera_id.toString());
  }
  if (options.latitude !== undefined) {
    formData.append('latitude', options.latitude.toString());
  }
  if (options.longitude !== undefined) {
    formData.append('longitude', options.longitude.toString());
  }
  if (options.frame_interval) {
    formData.append('frame_interval', options.frame_interval.toString());
  }

  const response = await apiClient.post<UploadResponse>('/uploads/frames', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });
  return response.data;
};

export const getUpload = async (id: number): Promise<UploadDetail> => {
  const response = await apiClient.get<UploadDetail>(`/uploads/${id}`);
  return response.data;
};

export const getUploads = async (params?: {
  status?: string;
  camera_id?: number;
  limit?: number;
}): Promise<UploadDetail[]> => {
  const response = await apiClient.get<UploadDetail[]>('/uploads', { params });
  return response.data;
};

// =============================================================================
// 目撃情報API
// =============================================================================

export const getSightings = async (params?: {
  start_date?: string;
  end_date?: string;
  alert_level?: string;
  min_confidence?: number;
  camera_id?: number;
  bounds?: string;
  limit?: number;
  offset?: number;
}): Promise<SightingListResponse> => {
  const response = await apiClient.get<SightingListResponse>('/sightings', { params });
  return response.data;
};

export const getSighting = async (id: number): Promise<SightingDetail> => {
  const response = await apiClient.get<SightingDetail>(`/sightings/${id}`);
  return response.data;
};

export const getRecentSightings = async (hours: number = 24, limit: number = 10): Promise<Sighting[]> => {
  const response = await apiClient.get<Sighting[]>('/sightings/recent/', {
    params: { hours, limit },
  });
  return response.data;
};

export const getSightingStatistics = async (): Promise<SightingStatistics> => {
  const response = await apiClient.get<SightingStatistics>('/sightings/statistics');
  return response.data;
};

// =============================================================================
// 警報API
// =============================================================================

export const getAlerts = async (params?: {
  acknowledged?: boolean;
  alert_level?: string;
  start_date?: string;
  end_date?: string;
  limit?: number;
}): Promise<AlertListResponse> => {
  const response = await apiClient.get<AlertListResponse>('/alerts', { params });
  return response.data;
};

export const getUnacknowledgedAlerts = async (
  limit: number = 50,
  params?: {
    start_date?: string;
    end_date?: string;
  }
): Promise<AlertListResponse> => {
  const response = await apiClient.get<AlertListResponse>('/alerts/unacknowledged', {
    params: { limit, ...params },
  });
  return response.data;
};

export const getAlertCount = async (params?: {
  start_date?: string;
  end_date?: string;
}): Promise<AlertCount> => {
  const response = await apiClient.get<AlertCount>('/alerts/count', { params });
  return response.data;
};

export const acknowledgeAlert = async (id: number, acknowledgedBy?: string): Promise<Alert> => {
  const response = await apiClient.put<Alert>(`/alerts/${id}/acknowledge`, {
    acknowledged_by: acknowledgedBy,
  });
  return response.data;
};

export const acknowledgeAllAlerts = async (acknowledgedBy?: string): Promise<{ acknowledged_count: number }> => {
  const response = await apiClient.put<{ acknowledged_count: number }>('/alerts/acknowledge-all', {
    acknowledged_by: acknowledgedBy,
  });
  return response.data;
};

// =============================================================================
// ユーザーAPI
// =============================================================================

export const syncCurrentUser = async (idToken?: string): Promise<UserSyncResponse> => {
  const response = await apiClient.post<UserSyncResponse>(
    '/users/sync',
    undefined,
    withAuthHeader(idToken)
  );
  return response.data;
};

export const getMyProfile = async (idToken?: string): Promise<UserProfile> => {
  const response = await apiClient.get<UserProfile>(
    '/users/me',
    withAuthHeader(idToken)
  );
  return response.data;
};

// =============================================================================
// 画像URL
// =============================================================================

export const getImageUrl = (path: string): string => {
  if (path.startsWith('http')) {
    return path;
  }
  return `${API_BASE_URL}/images/${path}`;
};

export const getFullImageUrl = (imageUrl?: string): string | undefined => {
  if (!imageUrl) return undefined;
  if (imageUrl.startsWith('http')) return imageUrl;
  return `${API_BASE_URL.replace('/api/v1', '')}${imageUrl}`;
};
