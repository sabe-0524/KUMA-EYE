interface ValidateCameraRegistrationInputArgs {
  name: string;
  latitude: string;
  longitude: string;
}

export const validateCameraRegistrationInput = ({
  name,
  latitude,
  longitude,
}: ValidateCameraRegistrationInputArgs): string | null => {
  if (!name.trim()) {
    return 'カメラ名を入力してください';
  }

  const lat = parseFloat(latitude);
  const lng = parseFloat(longitude);

  if (Number.isNaN(lat) || lat < -90 || lat > 90) {
    return '緯度は -90 から 90 の範囲で入力してください';
  }

  if (Number.isNaN(lng) || lng < -180 || lng > 180) {
    return '経度は -180 から 180 の範囲で入力してください';
  }

  return null;
};
