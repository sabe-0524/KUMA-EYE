interface Coordinates {
  latitude: number;
  longitude: number;
}

const toRadians = (value: number): number => {
  return (value * Math.PI) / 180;
};

export const calculateDistanceMeters = (from: Coordinates, to: Coordinates): number => {
  const earthRadius = 6_371_000;
  const dLat = toRadians(to.latitude - from.latitude);
  const dLng = toRadians(to.longitude - from.longitude);
  const lat1 = toRadians(from.latitude);
  const lat2 = toRadians(to.latitude);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return earthRadius * c;
};
