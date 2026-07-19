/**
 * Globe layer renderer — listens to DataBus 'layer:render' events
 * and feeds merged point data to globe.gl's pointsData.
 */
import { DataBus } from '../bus/data-bus.js';
import type { GlobeExt } from '../globe/globe-ext.js';
import type { GodEyeEntity, EarthquakeEntity, FireEntity, AircraftEntity } from '@god-eye/shared';

// ─── Aircraft trail history (client-side, last 12 positions per ICAO24) ───
const TRAIL_MAX = 12;
const aircraftTrails = new Map<string, Array<{ lat: number; lng: number }>>();

interface ArcData {
  startLat: number;
  startLng: number;
  endLat: number;
  endLng: number;
  color: string;
}

interface RenderedPoint {
  lat: number;
  lng: number;
  alt: number;
  radius: number;
  color: string;
  label: string;
  entity: GodEyeEntity;
}

/** Color scheme per entity type */
const TYPE_COLORS: Record<string, string> = {
  earthquake: '#E0A82E',  // amber
  fire: '#FF4500',        // orange-red
  event: '#4FC3F7',       // teal-light
  aircraft: '#00E676',    // signal green
  vessel: '#42A5F5',      // blue
  conflict: '#FF1744',    // red
  volcano: '#FF6F00',     // deep orange
  weather: '#7C4DFF',     // deep purple
  satellite: '#80DEEA',   // cyan
  base: '#9E9E9E',        // grey
  port: '#78909C',        // blue-grey
};

const layerPoints = new Map<string, RenderedPoint[]>();
let globeInstance: GlobeExt | null = null;

function entityToPoint(entity: GodEyeEntity): RenderedPoint {
  let radius = 0.3;
  let alt = 0.01;

  if (entity.type === 'earthquake') {
    const eq = entity as EarthquakeEntity;
    radius = Math.max(0.2, eq.magnitude * 0.15);
    alt = 0.005 + eq.magnitude * 0.003;
  } else if (entity.type === 'fire') {
    const fire = entity as FireEntity;
    radius = Math.max(0.15, fire.brightness / 1000);
    alt = 0.005;
  } else if (entity.type === 'aircraft') {
    radius = 0.25;
    alt = 0.02;
  }

  return {
    lat: entity.lat,
    lng: entity.lng,
    alt,
    radius,
    color: TYPE_COLORS[entity.type] ?? '#E0A82E',
    label: entity.label ?? entity.id,
    entity,
  };
}

function buildAirTrails(): ArcData[] {
  const arcs: ArcData[] = [];
  for (const trail of aircraftTrails.values()) {
    if (trail.length < 2) continue;
    for (let i = 0; i < trail.length - 1; i++) {
      const opacity = Math.round(((i + 1) / trail.length) * 180).toString(16).padStart(2, '0');
      arcs.push({
        startLat: trail[i].lat,
        startLng: trail[i].lng,
        endLat: trail[i + 1].lat,
        endLng: trail[i + 1].lng,
        color: `#00E676${opacity}`,
      });
    }
  }
  return arcs;
}

function updateGlobe() {
  if (!globeInstance) return;
  const allPoints: RenderedPoint[] = [];
  for (const points of layerPoints.values()) {
    for (const p of points) allPoints.push(p);
  }

  const arcs = buildAirTrails();

  globeInstance
    .pointsData(allPoints)
    .pointLat((d) => (d as RenderedPoint).lat)
    .pointLng((d) => (d as RenderedPoint).lng)
    .pointAltitude((d) => (d as RenderedPoint).alt)
    .pointRadius((d) => (d as RenderedPoint).radius)
    .pointColor((d) => (d as RenderedPoint).color)
    .pointLabel((d) => (d as RenderedPoint).label)
    .pointsMerge(true)
    .pointsTransitionDuration(300)
    .onPointClick((point) => {
      const p = point as RenderedPoint;
      DataBus.emit('selection:change', p.entity);
    })
    .arcsData(arcs)
    .arcStartLat((d) => (d as ArcData).startLat)
    .arcStartLng((d) => (d as ArcData).startLng)
    .arcEndLat((d) => (d as ArcData).endLat)
    .arcEndLng((d) => (d as ArcData).endLng)
    .arcColor((d: object) => (d as ArcData).color)
    .arcAltitude(0.01)
    .arcStroke(0.4)
    .arcDashLength(0.6)
    .arcDashGap(0.4)
    .arcDashAnimateTime(2000);
}

export function initGlobeRenderer(globe: GlobeExt) {
  globeInstance = globe;

  DataBus.on('layer:render', (payload) => {
    const { layer, data } = payload as { layer: string; data: GodEyeEntity[] };
    if (data.length === 0) {
      layerPoints.delete(layer);
    } else {
      layerPoints.set(layer, data.map(entityToPoint));
      // Update aircraft trail history
      if (layer === 'aircraft') {
        for (const entity of data) {
          const ac = entity as AircraftEntity;
          const key = ac.icao24;
          const trail = aircraftTrails.get(key) ?? [];
          trail.push({ lat: ac.lat, lng: ac.lng });
          if (trail.length > TRAIL_MAX) trail.shift();
          aircraftTrails.set(key, trail);
        }
        // Prune trails for aircraft no longer in feed
        const activeIds = new Set(data.map((e) => (e as AircraftEntity).icao24));
        for (const id of aircraftTrails.keys()) {
          if (!activeIds.has(id)) aircraftTrails.delete(id);
        }
      }
    }
    updateGlobe();
  });
}
