import type { FireEntity } from '@god-eye/shared';

// FIRMS CSV endpoint — last 24h MODIS + VIIRS (no key needed for CSV)
const FIRMS_URL =
  'https://firms.modaps.eosdis.nasa.gov/api/area/csv/FIRMS_MAP_KEY/VIIRS_SNPP_NRT/world/1';

export async function fetchFires(): Promise<FireEntity[]> {
  const key = process.env.FIRMS_MAP_KEY ?? '';
  const url = key
    ? FIRMS_URL.replace('FIRMS_MAP_KEY', key)
    : 'https://firms.modaps.eosdis.nasa.gov/data/active_fire/modis-c6.1/csv/MODIS_C6_1_Global_24h.csv';

  const res = await fetch(url);
  if (!res.ok) throw new Error(`FIRMS ${res.status}`);
  const text = await res.text();
  const lines = text.trim().split('\n');
  if (lines.length < 2) return [];

  const header = lines[0].split(',');
  const latIdx = header.indexOf('latitude');
  const lngIdx = header.indexOf('longitude');
  const briIdx = header.indexOf('brightness');
  const confIdx = header.indexOf('confidence');
  const frpIdx = header.indexOf('frp');
  const satIdx = header.indexOf('satellite');
  const dateIdx = header.indexOf('acq_date');
  const timeIdx = header.indexOf('acq_time');

  const fires: FireEntity[] = [];
  // Cap at 5000 to keep payloads manageable
  const limit = Math.min(lines.length, 5001);
  for (let i = 1; i < limit; i++) {
    const cols = lines[i].split(',');
    const lat = parseFloat(cols[latIdx]);
    const lng = parseFloat(cols[lngIdx]);
    if (isNaN(lat) || isNaN(lng)) continue;

    const dateStr = cols[dateIdx] ?? '';
    const timeStr = (cols[timeIdx] ?? '').padStart(4, '0');
    const ts = dateStr
      ? new Date(`${dateStr}T${timeStr.slice(0, 2)}:${timeStr.slice(2)}:00Z`).getTime()
      : Date.now();

    fires.push({
      id: `fire-${i}-${lat}-${lng}`,
      type: 'fire',
      lat,
      lng,
      label: `Fire ${cols[briIdx] ?? ''}K`,
      timestamp: ts,
      source: 'firms',
      brightness: parseFloat(cols[briIdx]) || 0,
      confidence: cols[confIdx] ?? undefined,
      frp: parseFloat(cols[frpIdx]) || undefined,
      satellite: cols[satIdx] ?? undefined,
    });
  }
  return fires;
}

export const FIRE_KEY = 'fires:global_24h';
export const FIRE_TTL = 15 * 60 * 1000; // 15 min
export const FIRE_SOURCE = 'firms';
