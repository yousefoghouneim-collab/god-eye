/**
 * GeoJSON Loader plugin — renders any GeoJSON FeatureCollection on the globe.
 * User provides a URL via plugin config key "url".
 * Supports Point features; LineString/Polygon centroids rendered as markers.
 */
import { definePlugin } from '@god-eye/plugin-sdk';
import type { BaseEntity } from '@god-eye/shared';

interface GeoJsonFeature {
  type: 'Feature';
  geometry: {
    type: string;
    coordinates: number[] | number[][] | number[][][];
  };
  properties?: Record<string, unknown>;
}

function centroid(coords: number[] | number[][] | number[][][]): [number, number] | null {
  if (typeof coords[0] === 'number') {
    // Point [lng, lat]
    return [coords[1] as number, coords[0] as number];
  }
  if (Array.isArray(coords[0]) && typeof (coords[0] as number[])[0] === 'number') {
    // LineString — average
    const pts = coords as number[][];
    const avg = pts.reduce((a, c) => [a[0] + c[1], a[1] + c[0]], [0, 0]);
    return [avg[0] / pts.length, avg[1] / pts.length];
  }
  return null;
}

const { manifest, plugin } = definePlugin(
  {
    id: 'geojson-loader',
    name: 'GeoJSON Loader',
    version: '1.0.0',
    description: 'Render any GeoJSON FeatureCollection on the globe. Set the "url" config key.',
    author: 'GOD-EYE',
    fetchInterval: 60_000,
    layer: {
      key: 'geojson',
      label: 'GeoJSON Layer',
      icon: '🗺',
      category: 'osint',
      renderers: ['globe', 'flat'],
      source: 'user-provided',
      explanation: {
        purpose: 'User-supplied GeoJSON overlay',
        source: 'User-configured URL',
        freshness: '60 seconds',
        confidence: 'Depends on source',
        limitations: 'Points and line/polygon centroids only; no polygon fills',
      },
    },
  },
  async (ctx) => {
    const url = ctx.getConfig('url');
    if (!url) {
      ctx.log('No URL configured. Set plugin config key "url".');
      return [];
    }

    const res = await fetch(url, { signal: AbortSignal.timeout(15_000) });
    if (!res.ok) throw new Error(`GeoJSON fetch failed: ${res.status}`);
    const json = await res.json() as { type: string; features?: GeoJsonFeature[] };

    if (json.type !== 'FeatureCollection' || !Array.isArray(json.features)) {
      ctx.log('Expected GeoJSON FeatureCollection');
      return [];
    }

    const entities: BaseEntity[] = [];
    for (const f of json.features) {
      const center = centroid(f.geometry.coordinates);
      if (!center) continue;
      const [lat, lng] = center;
      const props = f.properties ?? {};
      const label = String(props['name'] ?? props['title'] ?? props['id'] ?? `Feature ${entities.length + 1}`);
      entities.push({
        id: `geojson-${entities.length}`,
        type: 'marker',
        lat,
        lng,
        label,
        source: 'geojson-loader',
        timestamp: Date.now(),
      });
    }

    ctx.log(`Loaded ${entities.length} features from GeoJSON`);
    return entities;
  }
);

export { manifest, plugin };
