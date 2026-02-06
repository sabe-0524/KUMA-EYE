import type { TimeRange } from '@/shared/types';

const RANGE_TO_MS: Record<TimeRange, number> = {
  '1d': 24 * 60 * 60 * 1000,
  '7d': 7 * 24 * 60 * 60 * 1000,
  '30d': 30 * 24 * 60 * 60 * 1000,
};

export const getRangeStartIso = (range: TimeRange, now: Date = new Date()): string => {
  const start = new Date(now.getTime() - RANGE_TO_MS[range]);
  return start.toISOString();
};
