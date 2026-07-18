/**
 * Satellite tracking via CelesTrak TLE data + satellite.js SGP4 propagation.
 * Fetches TLE sets for key categories, propagates to current lat/lng/alt.
 */
import {
  twoline2satrec,
  propagate,
  gstime,
  eciToGeodetic,
  degreesLat,
  degreesLong,
} from 'satellite.js';
import type { BaseEntity } from '@god-eye/shared';

// CelesTrak GP data categories (no key needed)
const TLE_URLS: Record<string, string> = {
  stations: 'https://celestrak.org/NORAD/elements/gp.php?GROUP=stations&FORMAT=tle',
  active: 'https://celestrak.org/NORAD/elements/gp.php?GROUP=active&FORMAT=tle',
  starlink: 'https://celestrak.org/NORAD/elements/gp.php?GROUP=starlink&FORMAT=tle',
};

interface SatEntry {
  name: string;
  tle1: string;
  tle2: string;
}

function parseTLE(text: string): SatEntry[] {
  const lines = text.trim().split('\n').map((l) => l.trim());
  const entries: SatEntry[] = [];
  for (let i = 0; i < lines.length - 2; i += 3) {
    if (lines[i + 1]?.startsWith('1 ') && lines[i + 2]?.startsWith('2 ')) {
      entries.push({ name: lines[i], tle1: lines[i + 1], tle2: lines[i + 2] });
    }
  }
  return entries;
}

function propagateToNow(entry: SatEntry): BaseEntity | null {
  try {
    const satrec = twoline2satrec(entry.tle1, entry.tle2);
    const now = new Date();
    const result = propagate(satrec, now);
    if (!result || !result.position || typeof result.position === 'boolean') return null;
    const pos = result.position;

    const gmst = gstime(now);
    const geo = eciToGeodetic(pos, gmst);
    const lat = degreesLat(geo.latitude);
    const lng = degreesLong(geo.longitude);
    const altKm = geo.height;

    if (isNaN(lat) || isNaN(lng)) return null;

    return {
      id: `sat-${satrec.satnum}`,
      type: 'satellite',
      lat,
      lng,
      label: `${entry.name} (${altKm.toFixed(0)} km)`,
      timestamp: now.getTime(),
      source: 'celestrak',
    };
  } catch {
    return null;
  }
}

export async function fetchSatellites(): Promise<BaseEntity[]> {
  // Fetch ISS + active sats (limit to manageable count)
  const results: BaseEntity[] = [];

  for (const [group, url] of Object.entries(TLE_URLS)) {
    try {
      const res = await fetch(url, {
        headers: { 'User-Agent': 'GOD-EYE/0.2 (private research)' },
      });
      if (!res.ok) continue;
      const text = await res.text();
      const entries = parseTLE(text);

      // For starlink, limit to first 200 to avoid overwhelming
      const limit = group === 'starlink' ? 200 : group === 'active' ? 500 : entries.length;
      for (let i = 0; i < Math.min(entries.length, limit); i++) {
        const entity = propagateToNow(entries[i]);
        if (entity) results.push(entity);
      }
    } catch {
      // CelesTrak may rate-limit
    }
  }

  return results;
}

export const SATELLITE_KEY = 'satellites:tracked';
export const SATELLITE_TTL = 2 * 60 * 1000; // 2 min (positions drift)
export const SATELLITE_SOURCE = 'celestrak';
