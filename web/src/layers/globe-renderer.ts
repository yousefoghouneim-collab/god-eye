/**
 * Globe layer renderer — listens to DataBus 'layer:render' events
 * and feeds merged point data to globe.gl's pointsData.
 */
import { DataBus } from '../bus/data-bus.js';
import type { GlobeExt } from '../globe/globe-ext.js';
import type { GodEyeEntity, EarthquakeEntity, FireEntity } from '@god-eye/shared';

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

function updateGlobe() {
  if (!globeInstance) return;
  // Merge all layer points into one array
  const allPoints: RenderedPoint[] = [];
  for (const points of layerPoints.values()) {
    for (const p of points) allPoints.push(p);
  }

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
    });
}

export function initGlobeRenderer(globe: GlobeExt) {
  globeInstance = globe;

  DataBus.on('layer:render', (payload) => {
    const { layer, data } = payload as { layer: string; data: GodEyeEntity[] };
    if (data.length === 0) {
      layerPoints.delete(layer);
    } else {
      layerPoints.set(layer, data.map(entityToPoint));
    }
    updateGlobe();
  });
}
