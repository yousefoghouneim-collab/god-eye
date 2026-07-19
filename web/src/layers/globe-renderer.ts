/**
 * Globe layer renderer — listens to DataBus 'layer:render' events
 * and feeds merged point data to globe.gl's pointsData.
 */
import { DataBus } from '../bus/data-bus.js';
import type { GlobeExt } from '../globe/globe-ext.js';
import type { GodEyeEntity, EarthquakeEntity, FireEntity, AircraftEntity } from '@god-eye/shared';

// ─── Country label centroids ───
interface CountryLabel { name: string; lat: number; lng: number; size: number }
const COUNTRY_LABELS: CountryLabel[] = [
  { name: 'RUSSIA',         lat: 61.5,   lng: 105.3,  size: 1.2 },
  { name: 'CANADA',         lat: 60.0,   lng: -96.8,  size: 1.0 },
  { name: 'USA',            lat: 37.1,   lng: -95.7,  size: 1.0 },
  { name: 'CHINA',          lat: 35.9,   lng: 104.2,  size: 1.0 },
  { name: 'BRAZIL',         lat: -10.3,  lng: -53.2,  size: 0.9 },
  { name: 'AUSTRALIA',      lat: -25.3,  lng: 133.8,  size: 0.9 },
  { name: 'INDIA',          lat: 20.6,   lng: 79.1,   size: 0.9 },
  { name: 'ARGENTINA',      lat: -34.0,  lng: -64.0,  size: 0.8 },
  { name: 'KAZAKHSTAN',     lat: 48.0,   lng: 68.0,   size: 0.7 },
  { name: 'ALGERIA',        lat: 28.0,   lng: 2.6,    size: 0.7 },
  { name: 'CONGO (DRC)',     lat: -4.0,   lng: 24.0,   size: 0.7 },
  { name: 'GREENLAND',      lat: 72.0,   lng: -42.0,  size: 0.7 },
  { name: 'SAUDI ARABIA',   lat: 23.9,   lng: 45.1,   size: 0.7 },
  { name: 'MEXICO',         lat: 23.6,   lng: -102.6, size: 0.7 },
  { name: 'INDONESIA',      lat: -0.8,   lng: 113.9,  size: 0.7 },
  { name: 'SUDAN',          lat: 15.6,   lng: 32.5,   size: 0.6 },
  { name: 'LIBYA',          lat: 26.3,   lng: 17.2,   size: 0.6 },
  { name: 'IRAN',           lat: 32.4,   lng: 53.7,   size: 0.6 },
  { name: 'MONGOLIA',       lat: 46.9,   lng: 103.8,  size: 0.6 },
  { name: 'PERU',           lat: -9.2,   lng: -75.0,  size: 0.6 },
  { name: 'CHAD',           lat: 15.5,   lng: 18.7,   size: 0.6 },
  { name: 'ANGOLA',         lat: -11.2,  lng: 17.9,   size: 0.6 },
  { name: 'MALI',           lat: 17.6,   lng: -2.0,   size: 0.6 },
  { name: 'SOUTH AFRICA',   lat: -29.0,  lng: 25.1,   size: 0.6 },
  { name: 'COLOMBIA',       lat: 4.6,    lng: -74.3,  size: 0.6 },
  { name: 'ETHIOPIA',       lat: 9.1,    lng: 40.5,   size: 0.6 },
  { name: 'NIGERIA',        lat: 9.1,    lng: 8.7,    size: 0.6 },
  { name: 'EGYPT',          lat: 26.8,   lng: 30.8,   size: 0.6 },
  { name: 'TURKEY',         lat: 38.9,   lng: 35.2,   size: 0.6 },
  { name: 'UKRAINE',        lat: 48.4,   lng: 31.2,   size: 0.55 },
  { name: 'FRANCE',         lat: 46.2,   lng: 2.2,    size: 0.55 },
  { name: 'GERMANY',        lat: 51.2,   lng: 10.5,   size: 0.55 },
  { name: 'PAKISTAN',       lat: 30.4,   lng: 69.3,   size: 0.55 },
  { name: 'MYANMAR',        lat: 19.2,   lng: 96.7,   size: 0.55 },
  { name: 'VENEZUELA',      lat: 6.4,    lng: -66.6,  size: 0.55 },
  { name: 'MOZAMBIQUE',     lat: -18.7,  lng: 35.5,   size: 0.55 },
  { name: 'TANZANIA',       lat: -6.4,   lng: 34.9,   size: 0.55 },
  { name: 'NAMIBIA',        lat: -22.0,  lng: 18.5,   size: 0.55 },
  { name: 'ZAMBIA',         lat: -13.1,  lng: 27.8,   size: 0.55 },
  { name: 'AFGHANISTAN',    lat: 33.9,   lng: 67.7,   size: 0.55 },
  { name: 'JAPAN',          lat: 36.2,   lng: 138.3,  size: 0.55 },
  { name: 'SPAIN',          lat: 40.5,   lng: -3.7,   size: 0.55 },
  { name: 'SWEDEN',         lat: 62.2,   lng: 17.6,   size: 0.55 },
  { name: 'NORWAY',         lat: 64.9,   lng: 13.8,   size: 0.55 },
  { name: 'FINLAND',        lat: 64.5,   lng: 26.3,   size: 0.55 },
  { name: 'BOLIVIA',        lat: -16.3,  lng: -63.6,  size: 0.55 },
  { name: 'IRAQ',           lat: 33.2,   lng: 43.7,   size: 0.55 },
  { name: 'KENYA',          lat: 0.0,    lng: 37.9,   size: 0.55 },
  { name: 'SOMALIA',        lat: 5.2,    lng: 46.2,   size: 0.55 },
  { name: 'MADAGASCAR',     lat: -18.8,  lng: 46.9,   size: 0.55 },
  { name: 'ZIMBABWE',       lat: -19.0,  lng: 29.2,   size: 0.5 },
  { name: 'CAMEROON',       lat: 3.9,    lng: 11.5,   size: 0.5 },
  { name: 'POLAND',         lat: 51.9,   lng: 19.1,   size: 0.5 },
  { name: 'THAILAND',       lat: 15.9,   lng: 100.9,  size: 0.5 },
  { name: 'PHILIPPINES',    lat: 12.9,   lng: 121.8,  size: 0.5 },
  { name: 'MALAYSIA',       lat: 4.2,    lng: 108.0,  size: 0.5 },
  { name: 'VIETNAM',        lat: 14.1,   lng: 108.3,  size: 0.5 },
  { name: 'SOUTH KOREA',    lat: 35.9,   lng: 127.8,  size: 0.5 },
  { name: 'NORTH KOREA',    lat: 40.3,   lng: 127.5,  size: 0.5 },
  { name: 'UK',             lat: 54.4,   lng: -2.5,   size: 0.5 },
  { name: 'ITALY',          lat: 41.9,   lng: 12.6,   size: 0.5 },
  { name: 'CHILE',          lat: -33.5,  lng: -70.7,  size: 0.5 },
  { name: 'UAE',            lat: 23.4,   lng: 53.8,   size: 0.5 },
  { name: 'ISRAEL',         lat: 31.5,   lng: 34.8,   size: 0.45 },
  { name: 'JORDAN',         lat: 31.0,   lng: 36.2,   size: 0.45 },
  { name: 'SYRIA',          lat: 34.8,   lng: 38.9,   size: 0.45 },
  { name: 'YEMEN',          lat: 15.6,   lng: 48.5,   size: 0.45 },
  { name: 'OMAN',           lat: 21.5,   lng: 55.9,   size: 0.45 },
  { name: 'QATAR',          lat: 25.3,   lng: 51.2,   size: 0.4 },
  { name: 'KUWAIT',         lat: 29.3,   lng: 47.5,   size: 0.4 },
];

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
  'egypt-city': '#FFD700',  // gold — Egyptian cities
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

  // ─── Country name labels ───
  globe
    .labelsData(COUNTRY_LABELS)
    .labelLat((d) => (d as CountryLabel).lat)
    .labelLng((d) => (d as CountryLabel).lng)
    .labelText((d) => (d as CountryLabel).name)
    .labelSize((d) => (d as CountryLabel).size)
    .labelColor(() => 'rgba(180, 200, 220, 0.65)')
    .labelAltitude(0.002)
    .labelResolution(2)
    .labelIncludeDot(false);

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
