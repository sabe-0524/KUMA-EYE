'use client';

import React, { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Bell, CheckCircle, AlertTriangle } from 'lucide-react';
import { getUnacknowledgedAlerts, acknowledgeAlert, getAlertCount, getFullImageUrl } from '@/shared/api';
import { queryKeys } from '@/shared/lib/queryKeys';
import type { Alert, AlertCount, AlertListResponse, DisplayMode } from '@/shared/types';
import { alertLevelLabels, alertLevelEmojis, alertLevelColors } from '@/shared/types';
import { getRelativeTime } from '@/shared/lib/utils';
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
  const queryClient = useQueryClient();
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  const alertsQuery = useQuery({
    queryKey: queryKeys.alerts.unacknowledged(20),
    queryFn: () => getUnacknowledgedAlerts(20),
    refetchInterval: refreshInterval,
  });

  const alertCountQuery = useQuery({
    queryKey: queryKeys.alerts.count,
    queryFn: getAlertCount,
    refetchInterval: refreshInterval,
  });

  const acknowledgeMutation = useMutation({
    mutationFn: (alertId: number) => acknowledgeAlert(alertId),
    onMutate: async (alertId: number) => {
      await Promise.all([
        queryClient.cancelQueries({ queryKey: queryKeys.alerts.unacknowledged(20) }),
        queryClient.cancelQueries({ queryKey: queryKeys.alerts.count }),
      ]);

      const previousAlerts = queryClient.getQueryData<AlertListResponse>(queryKeys.alerts.unacknowledged(20));
      const previousCount = queryClient.getQueryData<AlertCount>(queryKeys.alerts.count);

      if (previousAlerts) {
        queryClient.setQueryData<AlertListResponse>(queryKeys.alerts.unacknowledged(20), {
          ...previousAlerts,
          alerts: previousAlerts.alerts.filter((alert) => alert.id !== alertId),
        });
      }

      if (previousCount) {
        queryClient.setQueryData<AlertCount>(queryKeys.alerts.count, {
          ...previousCount,
          unacknowledged: Math.max(0, previousCount.unacknowledged - 1),
        });
      }

      return { previousAlerts, previousCount };
    },
    onError: (_error, _alertId, context) => {
      if (!context) return;

      if (context.previousAlerts) {
        queryClient.setQueryData(queryKeys.alerts.unacknowledged(20), context.previousAlerts);
      }
      if (context.previousCount) {
        queryClient.setQueryData(queryKeys.alerts.count, context.previousCount);
      }
    },
    onSettled: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.alerts.all });
    },
  });

  const isWithinBounds = (lat: number, lng: number, bounds: string): boolean => {
    const [swLat, swLng, neLat, neLng] = bounds.split(',').map(Number);
    if ([swLat, swLng, neLat, neLng].some(Number.isNaN)) {
      return false;
    }
    return lat >= swLat && lat <= neLat && lng >= swLng && lng <= neLng;
  };

  const alerts = useMemo(() => {
    return (alertsQuery.data?.alerts ?? []).filter((alert) => alert.alert_level !== 'low');
  }, [alertsQuery.data?.alerts]);

  const filteredAlerts = useMemo(() => {
    return alerts.filter((alert) => {
      if (displayMode !== 'nearby') return true;
      if (!nearbyBounds || !alert.sighting) return false;
      return isWithinBounds(alert.sighting.latitude, alert.sighting.longitude, nearbyBounds);
    });
  }, [alerts, displayMode, nearbyBounds]);

  const displayedCount = useMemo(() => {
    if (displayMode === 'nearby') {
      return {
        unacknowledged: filteredAlerts.length,
        critical: filteredAlerts.filter((alert) => alert.alert_level === 'critical').length,
      };
    }

    return alertCountQuery.data ?? { unacknowledged: 0, critical: 0 };
  }, [alertCountQuery.data, displayMode, filteredAlerts]);

  const loading = alertsQuery.isPending || alertCountQuery.isPending;

  const handleAcknowledge = async (alertId: number, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await acknowledgeMutation.mutateAsync(alertId);
    } catch (err) {
      console.error('Failed to acknowledge alert:', err);
    }
  };

  return (
    <div className="bg-white/95 backdrop-blur rounded-xl border border-slate-200/70 shadow-sm h-full flex flex-col">
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

      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="p-4 text-center text-slate-500">読み込み中...</div>
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
                  <div
                    className="w-2 h-2 rounded-full mt-2 flex-shrink-0"
                    style={{ backgroundColor: alertLevelColors[alert.alert_level] }}
                  />

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-medium text-sm">
                        {alertLevelEmojis[alert.alert_level]} {alertLevelLabels[alert.alert_level]}
                      </span>
                      <span className="text-xs text-slate-500">{getRelativeTime(alert.notified_at)}</span>
                    </div>

                    <p className="text-sm text-slate-700 line-clamp-2">{alert.message}</p>

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

                    {alert.sighting?.camera && (
                      <p className="text-xs text-slate-500 mt-1">📹 {alert.sighting.camera.name}</p>
                    )}
                  </div>

                  <button
                    onClick={(e) => {
                      void handleAcknowledge(alert.id, e);
                    }}
                    disabled={acknowledgeMutation.isPending}
                    className="p-1 text-slate-400 hover:text-green-600 hover:bg-green-50 rounded transition-colors disabled:opacity-60"
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

      {selectedImage && <ImageModal imageUrl={selectedImage} onClose={() => setSelectedImage(null)} />}
    </div>
  );
};

export default AlertPanel;
