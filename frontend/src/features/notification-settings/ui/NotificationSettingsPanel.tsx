'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BellRing, MapPin, ShieldCheck, AlertCircle, Loader2 } from 'lucide-react';
import {
  getMyNotificationSettings,
  updateMyNotificationSettings,
  updateMyLocation,
} from '@/shared/api';
import type { NotificationSettings } from '@/shared/types';

const UPDATE_INTERVAL_MS = 30000;
const MIN_DISTANCE_METERS = 50;

const toRadians = (value: number) => (value * Math.PI) / 180;

const distanceMeters = (a: { lat: number; lng: number }, b: { lat: number; lng: number }) => {
  const R = 6371000;
  const dLat = toRadians(b.lat - a.lat);
  const dLng = toRadians(b.lng - a.lng);
  const lat1 = toRadians(a.lat);
  const lat2 = toRadians(b.lat);

  const h =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.sin(dLng / 2) * Math.sin(dLng / 2) * Math.cos(lat1) * Math.cos(lat2);
  return 2 * R * Math.asin(Math.sqrt(h));
};

interface NotificationSettingsPanelProps {
  onSettingsUpdated?: () => void;
}

export const NotificationSettingsPanel: React.FC<NotificationSettingsPanelProps> = ({
  onSettingsUpdated,
}) => {
  const [settings, setSettings] = useState<NotificationSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [locationStatus, setLocationStatus] = useState<string>('未共有');
  const [permissionDenied, setPermissionDenied] = useState(false);

  const watchIdRef = useRef<number | null>(null);
  const lastSentAtRef = useRef<number>(0);
  const lastSentCoordsRef = useRef<{ lat: number; lng: number } | null>(null);

  const emailLabel = useMemo(() => {
    if (!settings?.email) return '未登録';
    return settings.display_name
      ? `${settings.display_name} (${settings.email})`
      : settings.email;
  }, [settings]);

  const stopTracking = useCallback(() => {
    if (watchIdRef.current !== null && navigator.geolocation) {
      navigator.geolocation.clearWatch(watchIdRef.current);
    }
    watchIdRef.current = null;
    setLocationStatus('未共有');
  }, []);

  const sendLocation = useCallback(
    async (latitude: number, longitude: number) => {
      try {
        const updated = await updateMyLocation(latitude, longitude);
        setSettings(updated);
        setLocationStatus('共有中');
        onSettingsUpdated?.();
      } catch (err) {
        console.error('位置情報の更新に失敗しました:', err);
        setLocationStatus('共有エラー');
      }
    },
    [onSettingsUpdated]
  );

  const startTracking = useCallback(() => {
    if (!navigator.geolocation) {
      setLocationStatus('位置情報が未対応');
      return;
    }

    if (watchIdRef.current !== null) {
      return;
    }

    setPermissionDenied(false);
    setLocationStatus('取得中...');

    watchIdRef.current = navigator.geolocation.watchPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        const now = Date.now();
        const lastCoords = lastSentCoordsRef.current;
        const hasMoved =
          !lastCoords ||
          distanceMeters(lastCoords, { lat: latitude, lng: longitude }) >= MIN_DISTANCE_METERS;
        const timePassed = now - lastSentAtRef.current >= UPDATE_INTERVAL_MS;

        if (timePassed || hasMoved) {
          lastSentAtRef.current = now;
          lastSentCoordsRef.current = { lat: latitude, lng: longitude };
          void sendLocation(latitude, longitude);
        }
      },
      (geoError) => {
        console.error('Geolocation error:', geoError);
        if (geoError.code === 1) {
          setPermissionDenied(true);
          setLocationStatus('権限拒否');
        } else {
          setLocationStatus('取得失敗');
        }
      },
      {
        enableHighAccuracy: false,
        maximumAge: 10000,
        timeout: 10000,
      }
    );
  }, [sendLocation]);

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const response = await getMyNotificationSettings();
        setSettings(response);
      } catch (err) {
        console.error('通知設定の取得に失敗しました:', err);
        setError('通知設定の取得に失敗しました');
      } finally {
        setLoading(false);
      }
    };
    fetchSettings();
  }, []);

  useEffect(() => {
    if (settings?.email_opt_in) {
      startTracking();
    } else {
      stopTracking();
    }
  }, [settings?.email_opt_in, startTracking, stopTracking]);

  useEffect(() => {
    return () => stopTracking();
  }, [stopTracking]);

  const handleToggle = async () => {
    if (!settings) return;
    setSaving(true);
    setError(null);

    try {
      const updated = await updateMyNotificationSettings(!settings.email_opt_in);
      setSettings(updated);
      if (!updated.email_opt_in) {
        stopTracking();
      }
    } catch (err) {
      console.error('通知設定の更新に失敗しました:', err);
      setError('通知設定の更新に失敗しました');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="text-center py-6 text-slate-500">
        <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2" />
        読み込み中...
      </div>
    );
  }

  if (!settings) {
    return (
      <div className="text-center py-6 text-slate-500">
        通知設定を取得できませんでした
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h3 className="font-semibold text-slate-800 flex items-center gap-2">
          <BellRing className="w-5 h-5" />
          メール通知設定
        </h3>
        <p className="text-sm text-slate-600">
          熊の検出地点から半径5km以内で、位置情報を共有中のユーザーにメール通知します。
        </p>
      </div>

      <div className="p-4 bg-slate-50/70 rounded-lg border border-slate-200/80 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-slate-600">通知先</p>
            <p className="font-medium text-slate-900">{emailLabel}</p>
          </div>
          <div className="flex items-center gap-2 text-sm text-slate-600">
            <ShieldCheck className="w-4 h-4" />
            Firebase認証
          </div>
        </div>

        <button
          type="button"
          onClick={handleToggle}
          disabled={saving}
          className={`w-full py-2 px-4 rounded-lg text-sm font-medium transition-colors ${
            settings.email_opt_in
              ? 'bg-emerald-600 text-white hover:bg-emerald-700'
              : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
          }`}
        >
          {saving ? '更新中...' : settings.email_opt_in ? '通知を受け取る（ON）' : '通知を受け取る（OFF）'}
        </button>
      </div>

      <div className="p-4 bg-white rounded-lg border border-slate-200/80 space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm text-slate-600">
            <MapPin className="w-4 h-4" />
            位置情報共有
          </div>
          <span className="text-xs px-2 py-1 rounded-full bg-slate-100 text-slate-600">
            {locationStatus}
          </span>
        </div>
        <p className="text-xs text-slate-500">
          アプリ起動中のみ位置情報を更新します。位置共有がオフの場合は通知対象外です。
        </p>
        {permissionDenied && (
          <div className="flex items-start gap-2 text-xs text-amber-700 bg-amber-500/10 p-2 rounded">
            <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
            位置情報の権限が拒否されています。ブラウザ設定で許可すると通知対象になります。
          </div>
        )}
      </div>

      {error && (
        <div className="flex items-center gap-2 text-red-600 text-sm bg-red-500/10 p-3 rounded-lg border border-red-200/80">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          {error}
        </div>
      )}
    </div>
  );
};
