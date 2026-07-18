import type { EarthquakeEntity, FreshnessMeta } from '@god-eye/shared';

const USGS_URL = 'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/2.5_day.geojson';

interface USGSFeature {
  id: string;
  properties: {
    mag: number;
    place: string;
    time: number;
    tsunami: number;
    title: string;
  };
  geometry: { coordinates: [number, number, number] };
}

interface USGSResponse {
  features: USGSFeature[];
}

export async function fetchEarthquakes(): Promise<EarthquakeEntity[]> {
  const res = await fetch(USGS_URL);
  if (!res.ok) throw new Error(`USGS ${res.status}`);
  const data = (await res.json()) as USGSResponse;
  return data.features.map((f) => ({
    id: f.id,
    type: 'earthquake' as const,
    lat: f.geometry.coordinates[1],
    lng: f.geometry.coordinates[0],
    label: f.properties.place ?? f.properties.title,
    timestamp: f.properties.time,
    source: 'usgs',
    magnitude: f.properties.mag,
    depth: f.geometry.coordinates[2],
    place: f.properties.place,
    tsunamiWarning: f.properties.tsunami === 1,
  }));
}

export const EARTHQUAKE_KEY = 'earthquakes:2.5_day';
export const EARTHQUAKE_TTL = 5 * 60 * 1000; // 5 min
export const EARTHQUAKE_SOURCE = 'usgs';
