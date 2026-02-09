import { describe, expect, it } from 'vitest';
import { getStartDateISO, isWithinRange } from './timeRange';

describe('getStartDateISO', () => {
  it('1dは24時間前を返す', () => {
    const now = new Date('2025-01-31T12:00:00.000Z');
    expect(getStartDateISO('1d', now)).toBe('2025-01-30T12:00:00.000Z');
  });

  it('7dは7日前を返す', () => {
    const now = new Date('2025-01-31T12:00:00.000Z');
    expect(getStartDateISO('7d', now)).toBe('2025-01-24T12:00:00.000Z');
  });

  it('30dは30日前を返す', () => {
    const now = new Date('2025-01-31T12:00:00.000Z');
    expect(getStartDateISO('30d', now)).toBe('2025-01-01T12:00:00.000Z');
  });
});

describe('isWithinRange', () => {
  const now = new Date('2025-01-31T12:00:00.000Z');

  it('境界値（ちょうど開始時刻）を含む', () => {
    expect(isWithinRange('2025-01-24T12:00:00.000Z', '7d', now)).toBe(true);
  });

  it('範囲外（開始時刻より古い）を除外する', () => {
    expect(isWithinRange('2025-01-24T11:59:59.000Z', '7d', now)).toBe(false);
  });

  it('未来時刻を除外する', () => {
    expect(isWithinRange('2025-01-31T12:00:01.000Z', '1d', now)).toBe(false);
  });

  it('無効な日時文字列を除外する', () => {
    expect(isWithinRange('invalid-date', '30d', now)).toBe(false);
  });
});
