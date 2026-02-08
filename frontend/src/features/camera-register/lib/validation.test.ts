import { describe, expect, it } from 'vitest';
import { validateCameraRegistrationInput } from './validation';

describe('validateCameraRegistrationInput', () => {
  it('カメラ名が空の場合はエラーを返す', () => {
    const result = validateCameraRegistrationInput({
      name: '   ',
      latitude: '35.0',
      longitude: '139.0',
    });

    expect(result).toBe('カメラ名を入力してください');
  });

  it('緯度と経度の境界値は許可される', () => {
    const minBoundary = validateCameraRegistrationInput({
      name: 'camera-a',
      latitude: '-90',
      longitude: '-180',
    });
    const maxBoundary = validateCameraRegistrationInput({
      name: 'camera-b',
      latitude: '90',
      longitude: '180',
    });

    expect(minBoundary).toBeNull();
    expect(maxBoundary).toBeNull();
  });

  it('範囲外またはNaNの緯度・経度はエラーを返す', () => {
    const invalidLat = validateCameraRegistrationInput({
      name: 'camera-a',
      latitude: 'invalid',
      longitude: '139.0',
    });
    const invalidLng = validateCameraRegistrationInput({
      name: 'camera-a',
      latitude: '35.0',
      longitude: '181',
    });

    expect(invalidLat).toBe('緯度は -90 から 90 の範囲で入力してください');
    expect(invalidLng).toBe('経度は -180 から 180 の範囲で入力してください');
  });
});
