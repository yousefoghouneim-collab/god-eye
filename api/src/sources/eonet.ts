import type { BaseEntity } from '@god-eye/shared';

const EONET_URL = 'https://eonet.gsfc.nasa.gov/api/v3/events?status=open&limit=100';

interface EONETEvent {
  id: string;
  title: string;
  categories: Array<{ id: string; title: string }>;
  geometry: Array<{
    date: string;
    type: string;
    coordinates: [number, number];
  }>;
}

interface EONETResponse {
  events: EONETEvent[];
}

export async function fetchEONET(): Promise<BaseEntity[]> {
  const res = await fetch(EONET_URL);
  if (!res.ok) throw new Error(`EONET ${res.status}`);
  const data = (await res.json()) as EONETResponse;

  return data.events
    .filter((e) => e.geometry.length > 0)
    .map((e) => {
      const latest = e.geometry[e.geometry.length - 1];
      return {
        id: e.id,
        type: 'event' as const,
        lat: latest.coordinates[1],
        lng: latest.coordinates[0],
        label: e.title,
        timestamp: new Date(latest.date).getTime(),
        source: 'eonet',
      };
    });
}

export const EONET_KEY = 'eonet:open';
export const EONET_TTL = 30 * 60 * 1000; // 30 min
export const EONET_SOURCE = 'eonet';
