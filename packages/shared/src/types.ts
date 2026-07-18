/** Freshness metadata attached to every cached dataset */
export interface FreshnessMeta {
  fetchedAt: number;
  source: string;
  ttl: number;
  status: 'fresh' | 'stale' | 'down' | 'unknown';
}

/** Base entity that every normalized record extends */
export interface BaseEntity {
  id: string;
  type: EntityType;
  lat: number;
  lng: number;
  label?: string;
  timestamp?: number;
  source: string;
}

export type EntityType =
  | 'aircraft'
  | 'vessel'
  | 'satellite'
  | 'earthquake'
  | 'fire'
  | 'event'
  | 'base'
  | 'port'
  | 'cable'
  | 'pipeline'
  | 'powerplant'
  | 'datacenter'
  | 'conflict'
  | 'weather'
  | 'volcano'
  | 'cyber'
  | 'marker'
  | 'custom';

export interface AircraftEntity extends BaseEntity {
  type: 'aircraft';
  callsign?: string;
  icao24: string;
  altitude?: number;
  velocity?: number;
  heading?: number;
  onGround?: boolean;
  category?: 'military' | 'commercial' | 'private' | 'vip' | 'unknown';
}

export interface VesselEntity extends BaseEntity {
  type: 'vessel';
  mmsi: string;
  imo?: string;
  name?: string;
  shipType?: string;
  speed?: number;
  course?: number;
  destination?: string;
}

export interface EarthquakeEntity extends BaseEntity {
  type: 'earthquake';
  magnitude: number;
  depth: number;
  place?: string;
  tsunamiWarning?: boolean;
}

export interface FireEntity extends BaseEntity {
  type: 'fire';
  brightness: number;
  confidence?: string;
  frp?: number;
  satellite?: string;
}

export interface ConflictEntity extends BaseEntity {
  type: 'conflict';
  eventType?: string;
  fatalities?: number;
  actors?: string[];
  notes?: string;
}

/** Union of all entity types */
export type GodEyeEntity =
  | AircraftEntity
  | VesselEntity
  | EarthquakeEntity
  | FireEntity
  | ConflictEntity
  | BaseEntity;

/** Layer category for the catalog */
export type LayerCategory =
  | 'geopolitical'
  | 'military'
  | 'infrastructure'
  | 'natural'
  | 'cyber'
  | 'markets'
  | 'tech'
  | 'osint'
  | 'sensors';

/** Layer definition in the registry */
export interface LayerDef {
  key: string;
  label: string;
  icon: string;
  category: LayerCategory;
  renderers: Array<'globe' | 'flat' | 'cesium'>;
  source: string;
  keyRequired?: boolean;
  optIn?: boolean;
  explanation?: {
    purpose: string;
    source: string;
    freshness: string;
    confidence: string;
    limitations: string;
  };
}

/** Visual mode identifiers */
export type VisualMode = 'DEFAULT' | 'SATELLITE' | 'FLIR' | 'NVG' | 'CRT' | 'DOSSIER';

/** Data bus event types */
export type BusEventType =
  | 'layer:data'
  | 'layer:toggle'
  | 'selection:change'
  | 'viewport:change'
  | 'mode:change'
  | 'style:change'
  | 'freshness:update'
  | 'ticker:event';
