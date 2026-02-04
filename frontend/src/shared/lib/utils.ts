import type { AlertLevel, TimeRange } from '@/shared/types';
import { alertLevelColors } from '@/shared/types';

/**
 * 警報レベルに応じた色を取得
 */
export const getAlertColor = (alertLevel: AlertLevel): string => {
  return alertLevelColors[alertLevel] || '#6b7280';
};

/**
 * 検出頭数に応じたマーカー半径を取得
 */
export const getMarkerRadius = (bearCount: number): number => {
  // 1頭: 8px, 2頭: 12px, 3頭以上: 16px（最大20px）
  return Math.min(8 + (bearCount - 1) * 4, 20);
};

/**
 * 信頼度をパーセント表示に変換
 */
export const formatConfidence = (confidence: number): string => {
  return `${(confidence * 100).toFixed(1)}%`;
};

/**
 * 日時をフォーマット
 */
export const formatDateTime = (dateString: string): string => {
  const date = new Date(dateString);
  return date.toLocaleString('ja-JP', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
};

/**
 * 相対時間を取得
 */
export const getRelativeTime = (dateString: string): string => {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);
  
  if (diffMins < 1) return 'たった今';
  if (diffMins < 60) return `${diffMins}分前`;
  if (diffHours < 24) return `${diffHours}時間前`;
  if (diffDays < 7) return `${diffDays}日前`;
  
  return formatDateTime(dateString);
};

const TIME_RANGE_MS: Record<Exclude<TimeRange, 'all' | 'month'>, number> = {
  day: 24 * 60 * 60 * 1000,
  week: 7 * 24 * 60 * 60 * 1000,
};

export const getTimeRangeDates = (
  timeRange: TimeRange,
  now: Date = new Date()
): { startDate: Date | null; endDate: Date | null } => {
  if (timeRange === 'all') {
    return { startDate: null, endDate: null };
  }

  if (timeRange === 'month') {
    const startDate = new Date(now);
    startDate.setMonth(startDate.getMonth() - 1);
    return { startDate, endDate: now };
  }

  const startDate = new Date(now.getTime() - TIME_RANGE_MS[timeRange]);
  return { startDate, endDate: now };
};
