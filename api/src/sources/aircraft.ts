import type { AircraftEntity } from '@god-eye/shared';

// ─── AviationStack (primary, requires AVIATIONSTACK_API_KEY) ───
interface AVSFlight {
  flight?: { icao?: string; iata?: string };
  airline?: { name?: string };
  departure?: { airport?: string; iata?: string };
  arrival?: { airport?: string; iata?: string };
  live?: {
    latitude?: number;
    longitude?: number;
    altitude?: number;
    speed_horizontal?: number;
    heading?: number;
    is_ground?: boolean;
    updated?: string;
  };
}

async function fetchAviationStack(key: string): Promise<AircraftEntity[]> {
  const url = `http://api.aviationstack.com/v1/flights?access_key=${key}&limit=100&flight_status=active`;
  const res = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!res.ok) throw new Error(`aviationstack ${res.status}`);
  const data = (await res.json()) as { data?: AVSFlight[] };
  if (!Array.isArray(data.data)) return [];

  return data.data
    .filter((f) => f.live?.latitude != null && f.live?.longitude != null)
    .map((f) => {
      const id = f.flight?.icao ?? f.flight?.iata ?? `avs-${Math.random().toString(36).slice(2)}`;
      const label = f.flight?.iata ?? f.flight?.icao ?? id;
      return {
        id,
        type: 'aircraft' as const,
        lat: f.live!.latitude!,
        lng: f.live!.longitude!,
        label,
        timestamp: Date.now(),
        source: 'aviationstack',
        callsign: f.flight?.iata ?? f.flight?.icao,
        icao24: f.flight?.icao ?? id,
        altitude: f.live?.altitude,
        velocity: f.live?.speed_horizontal,
        heading: f.live?.heading,
        onGround: f.live?.is_ground ?? false,
        category: 'unknown' as const,
      };
    });
}

// ─── OpenSky Network (fallback, free, no key needed) ───
// states columns: 0=icao24, 1=callsign, 5=longitude, 6=latitude,
//                 7=baro_alt, 8=on_ground, 9=velocity, 10=true_track
type OSkyState = [
  string, string | null, string, number | null, number,
  number | null, number | null, number | null, boolean,
  number | null, number | null, number | null, null,
  number | null, string | null, boolean, number
];

async function fetchOpenSky(): Promise<AircraftEntity[]> {
  const res = await fetch('https://opensky-network.org/api/states/all', {
    headers: { Accept: 'application/json' },
  });
  if (!res.ok) throw new Error(`opensky ${res.status}`);
  const data = (await res.json()) as { states?: OSkyState[] };
  if (!Array.isArray(data.states)) return [];

  return data.states
    .filter((s) => s[5] != null && s[6] != null)
    .slice(0, 500) // cap at 500 to keep render fast
    .map((s) => ({
      id: s[0],
      type: 'aircraft' as const,
      lat: s[6]!,
      lng: s[5]!,
      label: s[1]?.trim() || s[0],
      timestamp: Date.now(),
      source: 'opensky',
      callsign: s[1]?.trim() || undefined,
      icao24: s[0],
      altitude: s[7] ?? undefined,
      velocity: s[9] ?? undefined,
      heading: s[10] ?? undefined,
      onGround: s[8],
      category: 'unknown' as const,
    }));
}

// ─── adsb.lol (last resort) ───
async function fetchAdsbLol(): Promise<AircraftEntity[]> {
  const res = await fetch('https://api.adsb.lol/v2/all', {
    headers: { Accept: 'application/json' },
  });
  if (!res.ok) throw new Error(`adsb.lol ${res.status}`);
  const data = (await res.json()) as { ac?: Array<{
    hex: string; flight?: string; lat?: number; lon?: number;
    alt_baro?: number | string; gs?: number; track?: number; category?: string;
  }> };
  if (!data.ac) return [];

  return data.ac
    .filter((a) => a.lat != null && a.lon != null)
    .slice(0, 500)
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
      category: 'unknown' as const,
    }));
}

export async function fetchAircraft(): Promise<AircraftEntity[]> {
  const avsKey = process.env['AVIATIONSTACK_API_KEY'];

  if (avsKey) {
    try {
      const results = await fetchAviationStack(avsKey);
      if (results.length > 0) return results;
    } catch (e) {
      console.warn('[aircraft] AviationStack failed, trying OpenSky:', e);
    }
  }

  try {
    const results = await fetchOpenSky();
    if (results.length > 0) return results;
  } catch (e) {
    console.warn('[aircraft] OpenSky failed, trying adsb.lol:', e);
  }

  return fetchAdsbLol();
}

export const AIRCRAFT_KEY = 'aircraft:live';
export const AIRCRAFT_TTL = 30 * 1000; // 30s
export const AIRCRAFT_SOURCE = 'aviationstack/opensky/adsb.lol';
