import type { ConflictEntity } from '@god-eye/shared';

// ACLED requires a key — use GDELT as the keyless fallback
// GDELT Events API: last 24h geolocated events
const GDELT_URL = 'https://api.gdeltproject.org/api/v2/geo/geo?query=conflict%20OR%20attack%20OR%20protest&mode=pointdata&format=geojson&timespan=24h&maxpoints=500';

interface GDELTFeature {
  properties: {
    name: string;
    count: number;
    url: string;
    urlmobile: string;
    html: string;
  };
  geometry: {
    coordinates: [number, number];
  };
}

interface GDELTResponse {
  features?: GDELTFeature[];
}

export async function fetchConflicts(): Promise<ConflictEntity[]> {
  const res = await fetch(GDELT_URL);
  if (!res.ok) throw new Error(`GDELT ${res.status}`);
  const data = (await res.json()) as GDELTResponse;
  if (!data.features) return [];

  return data.features.map((f, i) => ({
    id: `gdelt-${i}-${f.geometry.coordinates[0]}-${f.geometry.coordinates[1]}`,
    type: 'conflict' as const,
    lat: f.geometry.coordinates[1],
    lng: f.geometry.coordinates[0],
    label: f.properties.name ?? 'Conflict event',
    timestamp: Date.now(),
    source: 'gdelt',
    eventType: 'conflict',
    notes: f.properties.url,
  }));
}

export const CONFLICT_KEY = 'conflicts:gdelt_24h';
export const CONFLICT_TTL = 30 * 60 * 1000; // 30 min
export const CONFLICT_SOURCE = 'gdelt';
