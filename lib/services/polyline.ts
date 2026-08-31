/**
 * Google encoded polyline → array of [lat, lng] pairs.
 * Algorithm: https://developers.google.com/maps/documentation/utilities/polylinealgorithm
 */
export function decodePolyline(str: string, precision = 5): [number, number][] {
  if (!str) return [];
  const factor = Math.pow(10, precision);
  const coords: [number, number][] = [];
  let index = 0;
  let lat = 0;
  let lng = 0;

  while (index < str.length) {
    let result = 0;
    let shift = 0;
    let byte = 0;

    do {
      byte = str.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);
    const dlat = result & 1 ? ~(result >> 1) : result >> 1;
    lat += dlat;

    result = 0;
    shift = 0;
    do {
      byte = str.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);
    const dlng = result & 1 ? ~(result >> 1) : result >> 1;
    lng += dlng;

    coords.push([lat / factor, lng / factor]);
  }
  return coords;
}

/**
 * Bounding box of coordinates [minLat, minLng, maxLat, maxLng].
 */
export function bbox(coords: [number, number][]): [number, number, number, number] | null {
  if (coords.length === 0) return null;
  let minLat = coords[0][0];
  let maxLat = coords[0][0];
  let minLng = coords[0][1];
  let maxLng = coords[0][1];
  for (const [la, ln] of coords) {
    if (la < minLat) minLat = la;
    if (la > maxLat) maxLat = la;
    if (ln < minLng) minLng = ln;
    if (ln > maxLng) maxLng = ln;
  }
  return [minLat, minLng, maxLat, maxLng];
}

/**
 * Project lat/lng to SVG viewport coordinates [0..width, 0..height].
 * Uses simple equirectangular projection — fine for short routes (<100 km).
 */
export function projectToSvg(
  coords: [number, number][],
  width: number,
  height: number,
  padding = 8
): { points: { x: number; y: number }[]; viewBox: string } {
  const box = bbox(coords);
  if (!box) return { points: [], viewBox: `0 0 ${width} ${height}` };

  const [minLat, minLng, maxLat, maxLng] = box;
  const latRange = Math.max(1e-6, maxLat - minLat);
  const lngRange = Math.max(1e-6, maxLng - minLng);

  // Adjust longitude scale by cos(lat) to avoid stretch at high latitudes
  const meanLat = (minLat + maxLat) / 2;
  const lngScale = Math.cos((meanLat * Math.PI) / 180);
  const adjustedLngRange = lngRange * lngScale;

  // Fit while preserving aspect ratio
  const w = width - 2 * padding;
  const h = height - 2 * padding;
  const scale = Math.min(w / adjustedLngRange, h / latRange);
  const drawW = adjustedLngRange * scale;
  const drawH = latRange * scale;
  const offsetX = (width - drawW) / 2;
  const offsetY = (height - drawH) / 2;

  const points = coords.map(([la, ln]) => ({
    x: offsetX + (ln - minLng) * lngScale * scale,
    y: offsetY + (maxLat - la) * scale, // flip Y
  }));

  return { points, viewBox: `0 0 ${width} ${height}` };
}
