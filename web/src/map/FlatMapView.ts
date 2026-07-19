/**
 * FlatMapView — deck.gl + MapLibre GL tactical flat map.
 * Shares layer state with GlobeView via DataBus.
 */
import { Map as MapLibreMap } from 'maplibre-gl';
import { MapboxOverlay } from '@deck.gl/mapbox';
import { ScatterplotLayer, PathLayer } from '@deck.gl/layers';
import { DataBus } from '../bus/data-bus.js';
import type { GodEyeEntity, EarthquakeEntity, FireEntity, AircraftEntity } from '@god-eye/shared';

// Aircraft trail history for 2D map (mirrors globe-renderer logic)
const TRAIL_MAX_2D = 12;
const aircraftTrails2D = new Map<string, Array<[number, number]>>();

interface TrailPath {
  id: string;
  path: Array<[number, number]>;
}

const TYPE_COLORS: Record<string, [number, number, number, number]> = {
  'egypt-city': [255, 215, 0, 220],   // gold
  earthquake: [224, 168, 46, 200],   // amber
  fire: [255, 69, 0, 200],           // orange-red
  event: [79, 195, 247, 200],        // teal-light
  aircraft: [0, 230, 118, 200],      // signal green
  vessel: [66, 165, 245, 200],       // blue
  conflict: [255, 23, 68, 200],      // red
  volcano: [255, 111, 0, 200],       // deep orange
  weather: [124, 77, 255, 200],      // deep purple
  satellite: [128, 222, 234, 200],   // cyan
  base: [158, 158, 158, 200],        // grey
  port: [120, 144, 156, 200],        // blue-grey
};

const DEFAULT_COLOR: [number, number, number, number] = [224, 168, 46, 160];

// Dark ops map style — free, no key required
const MAP_STYLE = 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json';

const layerData = new Map<string, GodEyeEntity[]>();

let map: MapLibreMap | null = null;
let overlay: MapboxOverlay | null = null;

function getRadius(entity: GodEyeEntity): number {
  if (entity.type === 'earthquake') {
    return Math.max(3, (entity as EarthquakeEntity).magnitude * 4);
  }
  if (entity.type === 'fire') {
    return Math.max(2, (entity as FireEntity).brightness / 100);
  }
  return 4;
}

function rebuildLayers() {
  if (!overlay) return;
  const allData: GodEyeEntity[] = [];
  for (const data of layerData.values()) {
    for (const d of data) allData.push(d);
  }

  const scatterLayer = new ScatterplotLayer({
    id: 'god-eye-entities',
    data: allData,
    getPosition: (d: GodEyeEntity) => [d.lng, d.lat],
    getRadius: (d: GodEyeEntity) => getRadius(d),
    getFillColor: (d: GodEyeEntity) => TYPE_COLORS[d.type] ?? DEFAULT_COLOR,
    radiusUnits: 'pixels' as const,
    radiusMinPixels: 2,
    radiusMaxPixels: 20,
    pickable: true,
    onClick: (info: { object?: GodEyeEntity }) => {
      if (info.object) DataBus.emit('selection:change', info.object);
    },
    updateTriggers: {
      getPosition: allData.length,
      getFillColor: allData.length,
    },
  });

  const trailData: TrailPath[] = [];
  for (const [id, trail] of aircraftTrails2D) {
    if (trail.length >= 2) trailData.push({ id, path: trail });
  }

  const trailLayer = new PathLayer({
    id: 'aircraft-trails',
    data: trailData,
    getPath: (d: TrailPath) => d.path,
    getColor: [0, 230, 118, 160],
    getWidth: 1.5,
    widthUnits: 'pixels' as const,
  });

  overlay.setProps({ layers: [trailLayer, scatterLayer] });
}

export function createFlatMapView(container: HTMLElement): { destroy: () => void } {
  map = new MapLibreMap({
    container,
    style: MAP_STYLE,
    center: [55, 25], // Dubai
    zoom: 2,
    attributionControl: false,
  });

  overlay = new MapboxOverlay({
    interleaved: false,
    layers: [],
  });

  map.addControl(overlay as unknown as maplibregl.IControl);

  // Right-click → same location dossier as 3D globe
  map.on('contextmenu', (e) => {
    const { lng, lat } = e.lngLat;
    DataBus.emit('map:contextmenu', { lat, lng });
  });

  // Listen for layer data
  const unsub = DataBus.on('layer:render', (payload) => {
    const { layer, data } = payload as { layer: string; data: GodEyeEntity[] };
    if (data.length === 0) {
      layerData.delete(layer);
    } else {
      layerData.set(layer, data);
      if (layer === 'aircraft') {
        for (const entity of data) {
          const ac = entity as AircraftEntity;
          const trail = aircraftTrails2D.get(ac.icao24) ?? [];
          trail.push([ac.lng, ac.lat]);
          if (trail.length > TRAIL_MAX_2D) trail.shift();
          aircraftTrails2D.set(ac.icao24, trail);
        }
        const activeIds = new Set(data.map((e) => (e as AircraftEntity).icao24));
        for (const id of aircraftTrails2D.keys()) {
          if (!activeIds.has(id)) aircraftTrails2D.delete(id);
        }
      }
    }
    rebuildLayers();
  });

  return {
    destroy() {
      unsub?.();
      overlay?.finalize();
      map?.remove();
      map = null;
      overlay = null;
    },
  };
}
