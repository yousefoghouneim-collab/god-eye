import type { BaseEntity } from '@god-eye/shared';

// NWS active weather alerts (US-only, no key needed)
const NWS_URL = 'https://api.weather.gov/alerts/active?status=actual&severity=Extreme,Severe';

interface NWSFeature {
  id: string;
  properties: {
    event: string;
    headline: string;
    severity: string;
    areaDesc: string;
    effective: string;
    expires: string;
  };
  geometry: {
    type: string;
    coordinates: number[] | number[][] | number[][][];
  } | null;
}

interface NWSResponse {
  features: NWSFeature[];
}

function extractCentroid(geometry: NWSFeature['geometry']): { lat: number; lng: number } | null {
  if (!geometry) return null;
  const coords = geometry.coordinates;
  if (!coords || !Array.isArray(coords)) return null;

  // Flatten to find any numeric pair
  const flat: number[] = [];
  JSON.stringify(coords, (_k, v) => {
    if (typeof v === 'number') flat.push(v);
    return v;
  });

  if (flat.length >= 2) {
    // Compute centroid of all coordinate pairs
    let sumLng = 0, sumLat = 0, count = 0;
    for (let i = 0; i < flat.length - 1; i += 2) {
      sumLng += flat[i];
      sumLat += flat[i + 1];
      count++;
    }
    if (count > 0) return { lat: sumLat / count, lng: sumLng / count };
  }
  return null;
}

export async function fetchWeatherAlerts(): Promise<BaseEntity[]> {
  const res = await fetch(NWS_URL, {
    headers: { 'User-Agent': 'GOD-EYE/0.2 (private research)', Accept: 'application/geo+json' },
  });
  if (!res.ok) throw new Error(`NWS ${res.status}`);
  const data = (await res.json()) as NWSResponse;

  const results: BaseEntity[] = [];
  for (const f of data.features) {
    const centroid = extractCentroid(f.geometry);
    if (!centroid) continue;
    results.push({
      id: f.id,
      type: 'weather',
      lat: centroid.lat,
      lng: centroid.lng,
      label: `${f.properties.event}: ${f.properties.headline?.slice(0, 80) ?? f.properties.areaDesc}`,
      timestamp: new Date(f.properties.effective).getTime(),
      source: 'nws',
    });
  }
  return results;
}

export const WEATHER_KEY = 'weather:nws_active';
export const WEATHER_TTL = 10 * 60 * 1000; // 10 min
export const WEATHER_SOURCE = 'nws';
