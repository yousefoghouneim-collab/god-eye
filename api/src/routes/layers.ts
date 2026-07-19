import type { FastifyInstance } from 'fastify';
import { readCache } from '../cache/redis.js';
import { EARTHQUAKE_KEY } from '../sources/earthquakes.js';
import { FIRE_KEY } from '../sources/fires.js';
import { EONET_KEY } from '../sources/eonet.js';
import { AIRCRAFT_KEY } from '../sources/aircraft.js';
import { VOLCANO_KEY } from '../sources/volcanoes.js';
import { CONFLICT_KEY } from '../sources/conflicts.js';
import { WEATHER_KEY } from '../sources/weather.js';
import { SATELLITE_KEY } from '../sources/satellites.js';
import { MARKETS_KEY } from '../sources/markets.js';
import { VESSEL_KEY } from '../sources/vessels.js';
import { CURATED_DATASETS } from '../sources/curated.js';
import type { FreshnessMeta } from '@god-eye/shared';

function toFreshness(cached: { fetchedAt: number; source: string; ttl: number } | null): FreshnessMeta {
  if (!cached) return { fetchedAt: 0, source: 'unknown', ttl: 0, status: 'down' };
  const age = Date.now() - cached.fetchedAt;
  const status = age < cached.ttl ? 'fresh' : age < cached.ttl * 2 ? 'stale' : 'down';
  return { fetchedAt: cached.fetchedAt, source: cached.source, ttl: cached.ttl, status };
}

export async function registerLayerRoutes(app: FastifyInstance) {
  const keyMap: Record<string, string> = {
    earthquakes: EARTHQUAKE_KEY,
    fires: FIRE_KEY,
    eonet: EONET_KEY,
    aircraft: AIRCRAFT_KEY,
    volcanoes: VOLCANO_KEY,
    conflicts: CONFLICT_KEY,
    weather: WEATHER_KEY,
    satellites: SATELLITE_KEY,
    markets: MARKETS_KEY,
    vessels: VESSEL_KEY,
  };

  // Static curated datasets (no cache needed)
  app.get<{ Params: { dataset: string } }>('/api/curated/:dataset', async (req, reply) => {
    const data = CURATED_DATASETS[req.params.dataset];
    if (!data) {
      reply.code(404);
      return { error: 'Unknown dataset' };
    }
    return { data, freshness: { fetchedAt: Date.now(), source: 'curated', ttl: 86400000, status: 'fresh' } };
  });

  // Generic layer data endpoint
  app.get<{ Params: { layer: string } }>('/api/layers/:layer', async (req, reply) => {
    const cacheKey = keyMap[req.params.layer];
    if (!cacheKey) {
      reply.code(404);
      return { error: 'Unknown layer' };
    }
    const cached = await readCache(cacheKey);
    if (!cached) {
      reply.code(503);
      return { error: 'Data not yet available', freshness: toFreshness(null) };
    }
    return { data: cached.data, freshness: toFreshness(cached) };
  });

  // Freshness status for all layers
  app.get('/api/freshness', async () => {
    const results: Record<string, FreshnessMeta> = {};
    for (const [name, key] of Object.entries(keyMap)) {
      const cached = await readCache(key);
      results[name] = toFreshness(cached);
    }
    return results;
  });
}
