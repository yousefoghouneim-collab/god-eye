/**
 * Correlation Engine — detects spatial/temporal convergence across data streams.
 * Produces ranked hotspot alerts when multiple layer events cluster geographically.
 */
import { readCache } from '../cache/redis.js';
import { EARTHQUAKE_KEY } from '../sources/earthquakes.js';
import { FIRE_KEY } from '../sources/fires.js';
import { CONFLICT_KEY } from '../sources/conflicts.js';
import { AIRCRAFT_KEY } from '../sources/aircraft.js';
import type { BaseEntity } from '@god-eye/shared';

export interface CorrelationAlert {
  id: string;
  lat: number;
  lng: number;
  radius: number; // km
  severity: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  description: string;
  layers: string[];
  entityCount: number;
  timestamp: number;
}

const CLUSTER_RADIUS_KM = 300;

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

interface TaggedEntity extends BaseEntity {
  layer: string;
}

function clusterEntities(entities: TaggedEntity[]): Array<{ center: { lat: number; lng: number }; entities: TaggedEntity[] }> {
  const used = new Set<number>();
  const clusters: Array<{ center: { lat: number; lng: number }; entities: TaggedEntity[] }> = [];

  for (let i = 0; i < entities.length; i++) {
    if (used.has(i)) continue;
    const cluster: TaggedEntity[] = [entities[i]];
    used.add(i);

    for (let j = i + 1; j < entities.length; j++) {
      if (used.has(j)) continue;
      if (haversineKm(entities[i].lat, entities[i].lng, entities[j].lat, entities[j].lng) < CLUSTER_RADIUS_KM) {
        cluster.push(entities[j]);
        used.add(j);
      }
    }

    if (cluster.length >= 2) {
      const avgLat = cluster.reduce((s, e) => s + e.lat, 0) / cluster.length;
      const avgLng = cluster.reduce((s, e) => s + e.lng, 0) / cluster.length;
      clusters.push({ center: { lat: avgLat, lng: avgLng }, entities: cluster });
    }
  }

  return clusters;
}

function getSeverity(layerCount: number, entityCount: number): CorrelationAlert['severity'] {
  if (layerCount >= 4 || entityCount >= 15) return 'critical';
  if (layerCount >= 3 || entityCount >= 8) return 'high';
  if (layerCount >= 2 || entityCount >= 4) return 'medium';
  return 'low';
}

export async function computeCorrelations(): Promise<CorrelationAlert[]> {
  const [eqCache, fireCache, conflictCache, aircraftCache] = await Promise.all([
    readCache<BaseEntity[]>(EARTHQUAKE_KEY),
    readCache<BaseEntity[]>(FIRE_KEY),
    readCache<BaseEntity[]>(CONFLICT_KEY),
    readCache<BaseEntity[]>(AIRCRAFT_KEY),
  ]);

  // Tag entities with their layer source
  const tagged: TaggedEntity[] = [];
  for (const e of eqCache?.data ?? []) tagged.push({ ...e, layer: 'earthquake' });
  // Sample fires (too many for clustering)
  const fires = fireCache?.data ?? [];
  for (let i = 0; i < Math.min(fires.length, 500); i++) tagged.push({ ...fires[i], layer: 'fire' });
  for (const e of conflictCache?.data ?? []) tagged.push({ ...e, layer: 'conflict' });
  for (const e of aircraftCache?.data ?? []) tagged.push({ ...e, layer: 'aircraft' });

  if (tagged.length < 2) return [];

  const clusters = clusterEntities(tagged);

  const alerts: CorrelationAlert[] = [];
  for (const cluster of clusters) {
    const layers = new Set(cluster.entities.map((e) => e.layer));
    // Only alert on multi-layer convergence
    if (layers.size < 2) continue;

    const layerList = [...layers];
    const severity = getSeverity(layers.size, cluster.entities.length);

    alerts.push({
      id: `corr-${cluster.center.lat.toFixed(1)}-${cluster.center.lng.toFixed(1)}`,
      lat: cluster.center.lat,
      lng: cluster.center.lng,
      radius: CLUSTER_RADIUS_KM,
      severity,
      title: `${layerList.join(' + ')} convergence`,
      description: `${cluster.entities.length} events from ${layers.size} streams within ${CLUSTER_RADIUS_KM}km`,
      layers: layerList,
      entityCount: cluster.entities.length,
      timestamp: Date.now(),
    });
  }

  // Sort by severity then entity count
  const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
  alerts.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity] || b.entityCount - a.entityCount);

  return alerts.slice(0, 20); // Top 20 hotspots
}
