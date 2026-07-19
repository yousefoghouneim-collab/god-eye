/**
 * Vessel tracking — AISHub community feed (free, requires free account).
 * Falls back to empty array when credentials not set.
 * Sign up free at https://www.aishub.net/
 *
 * Also includes a small curated list of notable vessels that always shows.
 */
import type { VesselEntity } from '@god-eye/shared';

const AISHUB_USER = process.env['AISHUB_USERNAME'] ?? '';
const AISHUB_PASS = process.env['AISHUB_PASSWORD'] ?? '';

// Curated notable vessels (always visible, static positions updated infrequently)
const NOTABLE_VESSELS: VesselEntity[] = [
  { id: 'v-carrier-ike', type: 'vessel', mmsi: '369970040', name: 'USS IKE (CVN-69)', shipType: 'Aircraft Carrier', lat: 36.8, lng: -76.3, source: 'curated', label: 'USS IKE' },
  { id: 'v-nimitz',      type: 'vessel', mmsi: '369970018', name: 'USS NIMITZ (CVN-68)', shipType: 'Aircraft Carrier', lat: 47.6, lng: -122.3, source: 'curated', label: 'USS NIMITZ' },
  { id: 'v-queen-mary',  type: 'vessel', mmsi: '235009890', name: 'QUEEN MARY 2', shipType: 'Passenger', lat: 50.9, lng: -1.4, source: 'curated', label: 'QUEEN MARY 2' },
  { id: 'v-ever-given',  type: 'vessel', mmsi: '353136000', name: 'EVER GIVEN', shipType: 'Container Ship', lat: 31.2, lng: 32.5, source: 'curated', label: 'EVER GIVEN' },
];

interface AISHubRecord {
  MMSI?: string;
  NAME?: string;
  LATITUDE?: number;
  LONGITUDE?: number;
  SPEED?: number;
  COURSE?: number;
  DESTINATION?: string;
  TYPE?: string;
  IMO?: string;
}

export async function fetchVessels(): Promise<VesselEntity[]> {
  // Attempt live AISHub feed
  if (AISHUB_USER && AISHUB_PASS) {
    try {
      const url = `https://data.aishub.net/ws.php?username=${encodeURIComponent(AISHUB_USER)}&password=${encodeURIComponent(AISHUB_PASS)}&format=1&output=json&compress=0&latmin=-90&latmax=90&lonmin=-180&lonmax=180&mmsi=0`;
      const res = await fetch(url, {
        headers: { 'Accept': 'application/json' },
        signal: AbortSignal.timeout(12000),
      });
      if (res.ok) {
        const json = await res.json() as AISHubRecord[];
        const live = json
          .filter((v) => v.MMSI && v.LATITUDE != null && v.LONGITUDE != null)
          .slice(0, 500)
          .map((v): VesselEntity => ({
            id: `ais-${v.MMSI}`,
            type: 'vessel',
            mmsi: v.MMSI!,
            imo: v.IMO,
            name: v.NAME,
            lat: v.LATITUDE!,
            lng: v.LONGITUDE!,
            speed: v.SPEED,
            course: v.COURSE,
            destination: v.DESTINATION,
            shipType: v.TYPE,
            label: v.NAME || v.MMSI,
            timestamp: Date.now(),
            source: 'AISHub',
          }));
        return [...NOTABLE_VESSELS, ...live];
      }
    } catch (err) {
      console.warn('[vessels] AISHub fetch failed:', (err as Error).message);
    }
  }

  // No credentials — return curated notable vessels only
  return NOTABLE_VESSELS;
}

export const VESSEL_KEY = 'vessels:live';
export const VESSEL_TTL = 3 * 60 * 1000; // 3 min
export const VESSEL_SOURCE = 'AISHub / curated';
