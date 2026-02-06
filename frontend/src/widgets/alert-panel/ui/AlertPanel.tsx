'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { Bell, CheckCircle, AlertTriangle, X } from 'lucide-react';
import { getUnacknowledgedAlerts, acknowledgeAlert, getAlertCount, getFullImageUrl } from '@/shared/api';
import type { Alert, AlertCount, DisplayMode } from '@/shared/types';
import { alertLevelLabels, alertLevelEmojis, alertLevelColors } from '@/shared/types';
import { formatDateTime, getRelativeTime } from '@/shared/lib/utils';
import { ImageModal } from '@/shared/ui';

interface AlertPanelProps {
  refreshInterval?: number;
  onAlertClick?: (alert: Alert) => void;
  displayMode?: DisplayMode;
  nearbyBounds?: string | null;
}

export const AlertPanel: React.FC<AlertPanelProps> = ({
  refreshInterval = 10000,
  onAlertClick,
  displayMode = 'national',
  nearbyBounds = null,
}) => {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [alertCount, setAlertCount] = useState<AlertCount>({ unacknowledged: 0, critical: 0 });
  const [loading, setLoading] = useState(true);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  const isWithinBounds = (lat: number, lng: number, bounds: string): boolean => {
    const [swLat, swLng, neLat, neLng] = bounds.split(',').map(Number);
    if ([swLat, swLng, neLat, neLng].some(Number.isNaN)) {
      return false;
    }
    return lat >= swLat && lat <= neLat && lng >= swLng && lng <= neLng;
  };

  const filteredAlerts = alerts.filter((alert) => {
    if (displayMode !== 'nearby') return true;
    if (!nearbyBounds || !alert.sighting) return false;
    return isWithinBounds(alert.sighting.latitude, alert.sighting.longitude, nearbyBounds);
  });

  const displayedCount = displayMode === 'nearby'
    ? {
        unacknowledged: filteredAlerts.length,
        critical: filteredAlerts.filter((alert) => alert.alert_level === 'critical').length,
      }
    : alertCount;

  const fetchAlerts = useCallback(async () => {
    try {
      const [alertsResponse, countResponse] = await Promise.all([
        getUnacknowledgedAlerts(20),
        getAlertCount(),
      ]);
      setAlerts(alertsResponse.alerts.filter((alert) => alert.alert_level !== 'low'));
      setAlertCount(countResponse);
    } catch (err) {
      console.error('Failed to fetch alerts:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAlerts();
    const interval = setInterval(fetchAlerts, refreshInterval);
    return () => clearInterval(interval);
  }, [fetchAlerts, refreshInterval]);

  const handleAcknowledge = async (alertId: number, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await acknowledgeAlert(alertId);
      setAlerts(alerts.filter(a => a.id !== alertId));
      setAlertCount(prev => ({
        ...prev,
        unacknowledged: Math.max(0, prev.unacknowledged - 1),
      }));
    } catch (err) {
      console.error('Failed to acknowledge alert:', err);
    }
  };

  return (
    <div className="bg-white/95 backdrop-blur rounded-xl border border-slate-200/70 shadow-sm h-full flex flex-col">
      {/* ヘッダー */}
      <div className="p-4 border-b border-slate-200/70 bg-slate-50/60">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
            <Bell className="w-5 h-5" />
            警報
          </h2>
          {displayedCount.unacknowledged > 0 && (
            <span className="px-2 py-1 bg-red-500/10 text-red-700 text-sm font-medium rounded-full border border-red-200/80">
              {displayedCount.unacknowledged}件
            </span>
          )}
        </div>
        {displayedCount.critical > 0 && (
          <div className="mt-2 text-sm text-red-600 flex items-center gap-1">
            <AlertTriangle className="w-4 h-4" />
            危険レベル: {displayedCount.critical}件
          </div>
        )}
      </div>

      {/* 警報リスト */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="p-4 text-center text-slate-500">
            読み込み中...
          </div>
        ) : filteredAlerts.length === 0 ? (
          <div className="p-8 text-center">
            <CheckCircle className="w-12 h-12 mx-auto text-green-500 mb-2" />
            <p className="text-slate-600">未確認の警報はありません</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {filteredAlerts.map((alert) => (
              <div
                key={alert.id}
                className="p-3 hover:bg-slate-50/80 cursor-pointer transition-colors"
                onClick={() => onAlertClick?.(alert)}
              >
                <div className="flex items-start gap-3">
                  {/* レベルインジケーター */}
                  <div
                    className="w-2 h-2 rounded-full mt-2 flex-shrink-0"
                    style={{ backgroundColor: alertLevelColors[alert.alert_level] }}
                  />
                  
                  <div className="flex-1 min-w-0">
                    {/* 警報レベルと時刻 */}
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-medium text-sm">
                        {alertLevelEmojis[alert.alert_level]} {alertLevelLabels[alert.alert_level]}
                      </span>
                      <span className="text-xs text-slate-500">
                        {getRelativeTime(alert.notified_at)}
                      </span>
                    </div>
                    
                    {/* メッセージ */}
                    <p className="text-sm text-slate-700 line-clamp-2">
                      {alert.message}
                    </p>
                    
                    {/* 目撃情報サムネイル */}
                    {alert.sighting?.image_url && (
                      <img
                        src={getFullImageUrl(alert.sighting.image_url)}
                        alt="検出画像"
                        className="mt-2 w-full h-20 object-cover rounded-md cursor-pointer hover:opacity-80"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedImage(alert.sighting!.image_url!);
                        }}
                      />
                    )}
                    
                    {/* カメラ名 */}
                    {alert.sighting?.camera && (
                      <p className="text-xs text-slate-500 mt-1">
                        📹 {alert.sighting.camera.name}
                      </p>
                    )}
                  </div>
                  
                  {/* 確認ボタン */}
                  <button
                    onClick={(e) => handleAcknowledge(alert.id, e)}
                    className="p-1 text-slate-400 hover:text-green-600 hover:bg-green-50 rounded transition-colors"
                    title="確認済みにする"
                  >
                    <CheckCircle className="w-5 h-5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 画像モーダル */}
      {selectedImage && (
        <ImageModal
          imageUrl={selectedImage}
          onClose={() => setSelectedImage(null)}
        />
      )}
    </div>
  );
};

export default AlertPanel;
