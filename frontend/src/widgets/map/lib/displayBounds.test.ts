import { describe, expect, it } from 'vitest';
import { getBoundsFromCenter } from './displayBounds';

describe('getBoundsFromCenter', () => {
  it('通常座標で swLat,swLng,neLat,neLng 形式を返す', () => {
    const bounds = getBoundsFromCenter({ lat: 35.6812, lng: 139.7671 }, 20);
    const parts = bounds.split(',').map(Number);

    expect(parts).toHaveLength(4);
    expect(parts.every((value) => Number.isFinite(value))).toBe(true);
  });

  it('極端な緯度経度では clamp が適用される', () => {
    const bounds = getBoundsFromCenter({ lat: 89.9, lng: 179.9 }, 2000);
    const [swLat, swLng, neLat, neLng] = bounds.split(',').map(Number);

    expect(swLat).toBeGreaterThanOrEqual(-90);
    expect(swLng).toBeGreaterThanOrEqual(-180);
    expect(neLat).toBeLessThanOrEqual(90);
    expect(neLng).toBeLessThanOrEqual(180);
  });

  it('高緯度でも safeCosLat 分岐で破綻しない', () => {
    const bounds = getBoundsFromCenter({ lat: 90, lng: 0 }, 20);
    const parts = bounds.split(',').map(Number);

    expect(parts).toHaveLength(4);
    expect(parts.every((value) => Number.isFinite(value))).toBe(true);
  });
});
