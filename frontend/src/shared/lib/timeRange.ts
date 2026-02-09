import type { DisplayTimeRange } from '@/shared/types';

const RANGE_TO_HOURS: Record<DisplayTimeRange, number> = {
  '1d': 24,
  '7d': 24 * 7,
  '30d': 24 * 30,
};

const parseValidDate = (dateString: string): Date | null => {
  const date = new Date(dateString);
  return Number.isNaN(date.getTime()) ? null : date;
};

export const getStartDateISO = (range: DisplayTimeRange, now: Date = new Date()): string => {
  const start = new Date(now.getTime() - RANGE_TO_HOURS[range] * 60 * 60 * 1000);
  return start.toISOString();
};

export const isWithinRange = (
  dateString: string,
  range: DisplayTimeRange,
  now: Date = new Date()
): boolean => {
  const target = parseValidDate(dateString);
  if (!target) {
    return false;
  }

  const nowMs = now.getTime();
  const targetMs = target.getTime();
  if (targetMs > nowMs) {
    return false;
  }

  const startMs = nowMs - RANGE_TO_HOURS[range] * 60 * 60 * 1000;
  return targetMs >= startMs;
};
