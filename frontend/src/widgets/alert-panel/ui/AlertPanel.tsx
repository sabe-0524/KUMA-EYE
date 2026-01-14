'use client';

import React, { useEffect, useState } from 'react';
import { Bell, CheckCircle, AlertTriangle, X } from 'lucide-react';
import { getUnacknowledgedAlerts, acknowledgeAlert, getAlertCount, getFullImageUrl } from '@/shared/api';
import type { Alert, AlertCount } from '@/shared/types';
import { alertLevelLabels, alertLevelEmojis, alertLevelColors } from '@/shared/types';
import { formatDateTime, getRelativeTime } from '@/shared/lib/utils';
import { ImageModal } from '@/shared/ui';

interface AlertPanelProps {
  refreshInterval?: number;
  onAlertClick?: (alert: Alert) => void;
}

export const AlertPanel: React.FC<AlertPanelProps> = ({
  refreshInterval = 10000,
  onAlertClick,
}) => {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [alertCount, setAlertCount] = useState<AlertCount>({ unacknowledged: 0, critical: 0 });
  const [loading, setLoading] = useState(true);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  const fetchAlerts = async () => {
    try {
      const [alertsResponse, countResponse] = await Promise.all([
        getUnacknowledgedAlerts(20),
        getAlertCount(),
      ]);
      setAlerts(alertsResponse.alerts);
      setAlertCount(countResponse);
    } catch (err) {
      console.error('Failed to fetch alerts:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAlerts();
    const interval = setInterval(fetchAlerts, refreshInterval);
    return () => clearInterval(interval);
  }, [refreshInterval]);

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
    <div className="bg-white rounded-lg shadow h-full flex flex-col">
      {/* ヘッダー */}
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <Bell className="w-5 h-5" />
            警報
          </h2>
          {alertCount.unacknowledged > 0 && (
            <span className="px-2 py-1 bg-red-100 text-red-700 text-sm font-medium rounded-full">
              {alertCount.unacknowledged}件
            </span>
          )}
        </div>
        {alertCount.critical > 0 && (
          <div className="mt-2 text-sm text-red-600 flex items-center gap-1">
            <AlertTriangle className="w-4 h-4" />
            危険レベル: {alertCount.critical}件
          </div>
        )}
      </div>

      {/* 警報リスト */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="p-4 text-center text-gray-500">
            読み込み中...
          </div>
        ) : alerts.length === 0 ? (
          <div className="p-8 text-center">
            <CheckCircle className="w-12 h-12 mx-auto text-green-500 mb-2" />
            <p className="text-gray-600">未確認の警報はありません</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {alerts.map((alert) => (
              <div
                key={alert.id}
                className="p-3 hover:bg-gray-50 cursor-pointer transition-colors"
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
                      <span className="text-xs text-gray-500">
                        {getRelativeTime(alert.notified_at)}
                      </span>
                    </div>
                    
                    {/* メッセージ */}
                    <p className="text-sm text-gray-700 line-clamp-2">
                      {alert.message}
                    </p>
                    
                    {/* 目撃情報サムネイル */}
                    {alert.sighting?.image_url && (
                      <img
                        src={getFullImageUrl(alert.sighting.image_url)}
                        alt="検出画像"
                        className="mt-2 w-full h-20 object-cover rounded cursor-pointer hover:opacity-80"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedImage(alert.sighting!.image_url!);
                        }}
                      />
                    )}
                    
                    {/* カメラ名 */}
                    {alert.sighting?.camera && (
                      <p className="text-xs text-gray-500 mt-1">
                        📹 {alert.sighting.camera.name}
                      </p>
                    )}
                  </div>
                  
                  {/* 確認ボタン */}
                  <button
                    onClick={(e) => handleAcknowledge(alert.id, e)}
                    className="p-1 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded transition-colors"
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
