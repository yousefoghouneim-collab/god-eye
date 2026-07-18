import type { AircraftEntity } from '@god-eye/shared';

// adsb.lol free API — returns all aircraft in a bounding box or worldwide
const ADSB_URL = 'https://api.adsb.lol/v2/ladd'; // all non-LADD aircraft

interface ADSBResponse {
  ac?: Array<{
    hex: string;
    flight?: string;
    lat?: number;
    lon?: number;
    alt_baro?: number | string;
    gs?: number;
    track?: number;
    category?: string;
    t?: string;
  }>;
  total?: number;
}

export async function fetchAircraft(): Promise<AircraftEntity[]> {
  // Use the "all" endpoint for a global sample
  const res = await fetch('https://api.adsb.lol/v2/mil', {
    headers: { Accept: 'application/json' },
  });
  if (!res.ok) throw new Error(`adsb.lol ${res.status}`);
  const data = (await res.json()) as ADSBResponse;
  if (!data.ac) return [];

  return data.ac
    .filter((a) => a.lat != null && a.lon != null)
    .map((a) => ({
      id: a.hex,
      type: 'aircraft' as const,
      lat: a.lat!,
      lng: a.lon!,
      label: a.flight?.trim() || a.hex,
      timestamp: Date.now(),
      source: 'adsb.lol',
      callsign: a.flight?.trim(),
      icao24: a.hex,
      altitude: typeof a.alt_baro === 'number' ? a.alt_baro : undefined,
      velocity: a.gs,
      heading: a.track,
      onGround: a.alt_baro === 'ground',
      category: a.category === 'A1' ? 'military' as const : 'unknown' as const,
    }));
}

export const AIRCRAFT_KEY = 'aircraft:mil';
export const AIRCRAFT_TTL = 30 * 1000; // 30s — fast refresh
export const AIRCRAFT_SOURCE = 'adsb.lol';
