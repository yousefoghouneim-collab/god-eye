import type { LayerDef } from '@god-eye/shared';

/** Full layer registry — Phase 2 ships with 4 live layers, rest are stubs */
export const LAYER_REGISTRY: LayerDef[] = [
  // ─── Geopolitical / Conflict ───
  {
    key: 'conflicts',
    label: 'Conflict Zones',
    icon: '⚔',
    category: 'geopolitical',
    renderers: ['globe', 'flat'],
    source: 'acled',
    explanation: {
      purpose: 'Active conflict zones with escalation tracking',
      source: 'UCDP + ACLED',
      freshness: '6h polling',
      confidence: 'Curated academic dataset',
      limitations: 'Reporting lag 1-7 days',
    },
  },
  {
    key: 'protests',
    label: 'Protests / Unrest',
    icon: '📢',
    category: 'geopolitical',
    renderers: ['globe', 'flat'],
    source: 'acled',
  },

  // ─── Military / Strategic ───
  {
    key: 'aircraft',
    label: 'Military Aircraft',
    icon: '✈',
    category: 'military',
    renderers: ['globe', 'flat'],
    source: 'adsb.lol',
    explanation: {
      purpose: 'Real-time military aircraft positions from ADS-B receivers',
      source: 'adsb.lol /v2/mil endpoint',
      freshness: '30s polling',
      confidence: 'High for ADS-B equipped aircraft',
      limitations: 'Aircraft can disable transponders; no coverage over oceans without satellite ADS-B',
    },
  },
  {
    key: 'vessels',
    label: 'Naval Vessels',
    icon: '🚢',
    category: 'military',
    renderers: ['globe', 'flat'],
    source: 'AISHub / curated',
    explanation: {
      purpose: 'Live vessel positions: curated notable ships always shown; full AIS feed with AISHUB_USERNAME/PASSWORD in .env',
      source: 'AISHub community feed + curated notable vessels',
      freshness: '3 min polling',
      confidence: 'AIS transponder data; curated positions approximate',
      limitations: 'Full live feed requires free AISHub account; vessels can disable AIS',
    },
  },
  {
    key: 'bases',
    label: 'Military Bases',
    icon: '🏛',
    category: 'military',
    renderers: ['globe', 'flat'],
    source: 'curated',
  },
  {
    key: 'nuclear',
    label: 'Nuclear Sites',
    icon: '☢',
    category: 'military',
    renderers: ['globe', 'flat'],
    source: 'curated',
  },
  {
    key: 'satellites',
    label: 'Orbital Surveillance',
    icon: '🛰',
    category: 'military',
    renderers: ['globe'],
    source: 'celestrak',
    explanation: {
      purpose: 'Real-time satellite positions via SGP4 orbit propagation',
      source: 'CelesTrak TLE data (NORAD)',
      freshness: '2 min polling + SGP4 propagation',
      confidence: 'High for LEO; GEO orbital elements may drift',
      limitations: 'Classified objects not in catalog; limited to ~700 tracked objects',
    },
  },

  // ─── Infrastructure / Energy ───
  {
    key: 'cables',
    label: 'Undersea Cables',
    icon: '🔌',
    category: 'infrastructure',
    renderers: ['globe', 'flat'],
    source: 'telegeography',
  },
  {
    key: 'pipelines',
    label: 'Pipelines',
    icon: '🛢',
    category: 'infrastructure',
    renderers: ['globe', 'flat'],
    source: 'curated',
  },
  {
    key: 'powerplants',
    label: 'Power Plants',
    icon: '⚡',
    category: 'infrastructure',
    renderers: ['globe', 'flat'],
    source: 'wri',
  },
  {
    key: 'datacenters',
    label: 'AI Datacenters',
    icon: '🖥',
    category: 'infrastructure',
    renderers: ['globe', 'flat'],
    source: 'epoch-ai',
  },
  {
    key: 'ports',
    label: 'Strategic Ports',
    icon: '⚓',
    category: 'infrastructure',
    renderers: ['globe', 'flat'],
    source: 'curated',
  },

  // ─── Natural / Climate ───
  {
    key: 'earthquakes',
    label: 'Earthquakes',
    icon: '🌍',
    category: 'natural',
    renderers: ['globe', 'flat'],
    source: 'usgs',
    explanation: {
      purpose: 'M2.5+ earthquakes in last 24 hours',
      source: 'USGS GeoJSON feed',
      freshness: '5 min polling',
      confidence: 'Authoritative government seismic network',
      limitations: 'Small events <M2.5 excluded; deep ocean events may have location uncertainty',
    },
  },
  {
    key: 'fires',
    label: 'Active Fires',
    icon: '🔥',
    category: 'natural',
    renderers: ['globe', 'flat'],
    source: 'firms',
    explanation: {
      purpose: 'Satellite-detected thermal hotspots (active fires)',
      source: 'NASA FIRMS VIIRS/MODIS',
      freshness: '15 min polling',
      confidence: 'Satellite thermal detection — some false positives from industrial heat',
      limitations: 'Cloud cover blocks detection; 375m resolution',
    },
  },
  {
    key: 'eonet',
    label: 'Natural Events',
    icon: '🌀',
    category: 'natural',
    renderers: ['globe', 'flat'],
    source: 'eonet',
    explanation: {
      purpose: 'Curated natural events: storms, floods, eruptions, ice',
      source: 'NASA EONET v3',
      freshness: '30 min polling',
      confidence: 'Curated by NASA — high quality, lower volume',
      limitations: 'Only significant events; may lag hours behind onset',
    },
  },
  {
    key: 'volcanoes',
    label: 'Volcanoes',
    icon: '🌋',
    category: 'natural',
    renderers: ['globe', 'flat'],
    source: 'gvp',
  },
  {
    key: 'weather',
    label: 'Weather Alerts',
    icon: '⛈',
    category: 'natural',
    renderers: ['flat'],
    source: 'nws',
  },

  // ─── Cyber ───
  {
    key: 'cyber-threats',
    label: 'Cyber Threats',
    icon: '🛡',
    category: 'cyber',
    renderers: ['globe', 'flat'],
    source: 'abuse.ch',
    optIn: true,
  },
  {
    key: 'gps-jamming',
    label: 'GPS Jamming',
    icon: '📡',
    category: 'cyber',
    renderers: ['globe', 'flat'],
    source: 'gpsjam',
  },

  // ─── Markets ───
  {
    key: 'exchanges',
    label: 'Stock Exchanges',
    icon: '📈',
    category: 'markets',
    renderers: ['globe', 'flat'],
    source: 'curated',
  },

  // ─── OSINT / Sensors ───
  {
    key: 'telegram-osint',
    label: 'Telegram OSINT',
    icon: '💬',
    category: 'osint',
    renderers: ['flat'],
    source: 'telegram',
    optIn: true,
  },
];

/** Layers grouped by category */
export function getLayersByCategory(): Map<string, LayerDef[]> {
  const map = new Map<string, LayerDef[]>();
  for (const layer of LAYER_REGISTRY) {
    const list = map.get(layer.category) ?? [];
    list.push(layer);
    map.set(layer.category, list);
  }
  return map;
}

/** Get a layer def by key */
export function getLayerDef(key: string): LayerDef | undefined {
  return LAYER_REGISTRY.find((l) => l.key === key);
}

/** Currently live (have API data source wired) */
export const LIVE_LAYER_KEYS = new Set([
  'earthquakes', 'fires', 'eonet', 'aircraft',
  'volcanoes', 'conflicts', 'weather', 'satellites', 'vessels',
]);
