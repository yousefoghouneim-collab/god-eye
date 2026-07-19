import { DataBus } from '../bus/data-bus.js';
import { LIVE_LAYER_KEYS } from './registry.js';
import type { GodEyeEntity } from '@god-eye/shared';
import type { TimeRange } from '../hud/time-machine.js';

// ── Time-aware layers (have entity.timestamp) ─────────────────────────────────
const TIME_AWARE_LAYERS = new Set(['earthquakes', 'fires', 'eonet', 'conflicts', 'weather']);
let activeTimeRange: TimeRange = { from: 0, to: Infinity, live: true };

/** Which layers are currently toggled on */
const enabledLayers = new Set<string>();

/** Latest data per layer */
const layerData = new Map<string, GodEyeEntity[]>();

function applyTimeFilter(layer: string, data: GodEyeEntity[]): GodEyeEntity[] {
  if (activeTimeRange.live || !TIME_AWARE_LAYERS.has(layer)) return data;
  const { from, to } = activeTimeRange;
  return data.filter(e => {
    const ts = e.timestamp;
    if (ts == null) return true; // no timestamp → always show
    return ts >= from && ts <= to;
  });
}

/** Initialize: enable live layers by default, listen for data */
export function initLayerState() {
  // Enable live layers by default
  for (const key of LIVE_LAYER_KEYS) {
    enabledLayers.add(key);
  }

  // Listen for incoming layer data from WS
  DataBus.on('layer:data', (payload) => {
    const { layer, data } = payload as { layer: string; data: GodEyeEntity[] };
    layerData.set(layer, data);
    if (enabledLayers.has(layer)) {
      DataBus.emit('layer:render', { layer, data: applyTimeFilter(layer, data) });
    }
  });

  // Timeline range changes → re-render all enabled time-aware layers
  DataBus.on('timeline:range', (payload) => {
    activeTimeRange = payload as TimeRange;
    for (const layer of TIME_AWARE_LAYERS) {
      if (!enabledLayers.has(layer)) continue;
      const data = layerData.get(layer);
      if (data) DataBus.emit('layer:render', { layer, data: applyTimeFilter(layer, data) });
    }
  });
}

export function toggleLayer(key: string): boolean {
  if (enabledLayers.has(key)) {
    enabledLayers.delete(key);
    DataBus.emit('layer:render', { layer: key, data: [] });
    DataBus.emit('layer:toggle', { layer: key, enabled: false });
    return false;
  } else {
    enabledLayers.add(key);
    // Re-emit cached data
    const cached = layerData.get(key);
    if (cached) DataBus.emit('layer:render', { layer: key, data: cached });
    DataBus.emit('layer:toggle', { layer: key, enabled: true });
    return true;
  }
}

export function isLayerEnabled(key: string): boolean {
  return enabledLayers.has(key);
}

export function getLayerData(key: string): GodEyeEntity[] {
  return layerData.get(key) ?? [];
}

/** Curated dataset → layer key mapping */
const CURATED_MAP: Record<string, string> = {
  bases: 'bases',
  ports: 'ports',
  chokepoints: 'ports', // renders as port type
  nuclear: 'nuclear',
};

/** Fetch initial data from REST API for all live layers + curated */
export async function fetchInitialData() {
  // Live layers
  for (const key of LIVE_LAYER_KEYS) {
    try {
      const res = await fetch(`/api/layers/${key}`);
      if (res.ok) {
        const json = await res.json();
        if (json.data) {
          layerData.set(key, json.data);
          if (enabledLayers.has(key)) {
            DataBus.emit('layer:render', { layer: key, data: json.data });
          }
        }
      }
    } catch {
      // API may not be up yet — WS will deliver data when ready
    }
  }

  // Egypt cities
  try {
    const res = await fetch('/api/egypt/cities');
    if (res.ok) {
      const json = await res.json() as { data: unknown[] };
      if (json.data) {
        layerData.set('egypt-cities', json.data as import('@god-eye/shared').GodEyeEntity[]);
        if (enabledLayers.has('egypt-cities')) {
          DataBus.emit('layer:render', { layer: 'egypt-cities', data: json.data });
        }
      }
    }
  } catch { /* API may not be ready */ }

  // Curated static datasets
  for (const [dataset, layerKey] of Object.entries(CURATED_MAP)) {
    try {
      const res = await fetch(`/api/curated/${dataset}`);
      if (res.ok) {
        const json = await res.json();
        if (json.data) {
          // Merge with existing data for same layer key
          const existing = layerData.get(layerKey) ?? [];
          const merged = [...existing, ...json.data];
          layerData.set(layerKey, merged);
          if (enabledLayers.has(layerKey)) {
            DataBus.emit('layer:render', { layer: layerKey, data: merged });
          }
        }
      }
    } catch {
      // curated API may not be up
    }
  }
}
