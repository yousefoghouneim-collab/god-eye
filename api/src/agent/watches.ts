/**
 * AOI (Area of Interest) watch areas.
 * Entities entering a watch box trigger an alert via Agent Bus.
 */
import { randomUUID } from 'crypto';
import { emitAgentEvent } from './bus.js';
import { broadcastCommand } from '../relay/ws.js';

export interface WatchArea {
  id: string;
  label: string;
  lat1: number;
  lng1: number;
  lat2: number;
  lng2: number;
  createdAt: number;
  hitCount: number;
}

const watches = new Map<string, WatchArea>();

// Track which entity IDs have already fired to avoid duplicate alerts
const seenEntities = new Map<string, Set<string>>(); // watchId → Set<entityId>

export function addWatch(area: Omit<WatchArea, 'id' | 'createdAt' | 'hitCount'>): WatchArea {
  const watch: WatchArea = { ...area, id: randomUUID(), createdAt: Date.now(), hitCount: 0 };
  watches.set(watch.id, watch);
  seenEntities.set(watch.id, new Set());
  return watch;
}

export function removeWatch(id: string) {
  watches.delete(id);
  seenEntities.delete(id);
}

export function listWatches(): WatchArea[] {
  return [...watches.values()];
}

function inBox(lat: number, lng: number, w: WatchArea): boolean {
  const minLat = Math.min(w.lat1, w.lat2);
  const maxLat = Math.max(w.lat1, w.lat2);
  const minLng = Math.min(w.lng1, w.lng2);
  const maxLng = Math.max(w.lng1, w.lng2);
  return lat >= minLat && lat <= maxLat && lng >= minLng && lng <= maxLng;
}

/** Check a batch of entities against all watch areas, fire alerts for new entries. */
export function checkEntities(
  layer: string,
  entities: Array<{ id: string; lat?: number | null; lng?: number | null; label?: string }>
) {
  if (watches.size === 0) return;

  for (const watch of watches.values()) {
    const seen = seenEntities.get(watch.id) ?? new Set<string>();

    for (const entity of entities) {
      if (entity.lat == null || entity.lng == null) continue;
      if (seen.has(entity.id)) continue;
      if (!inBox(entity.lat, entity.lng, watch)) continue;

      // New entity entered the watch area
      seen.add(entity.id);
      watch.hitCount++;

      const alert = {
        type: 'aoi_alert',
        watchId: watch.id,
        watchLabel: watch.label,
        layer,
        entityId: entity.id,
        label: entity.label ?? entity.id,
        lat: entity.lat,
        lng: entity.lng,
        ts: Date.now(),
      };

      console.log(`[Watch] AOI hit: ${watch.label} — ${entity.label ?? entity.id} (${layer})`);
      emitAgentEvent('aoi_alert', alert);

      // Also broadcast to browser as a ticker event
      broadcastCommand('aoi_alert', alert);
    }

    seenEntities.set(watch.id, seen);
  }
}
