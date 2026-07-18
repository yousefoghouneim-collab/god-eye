/**
 * Country Instability Index (CII)
 * Simplified multi-factor scoring using available live data streams.
 * Factors: conflict events, earthquakes, fires, weather alerts near country.
 * Produces a 0-100 score per country with level classification.
 */
import { readCache } from '../cache/redis.js';
import { EARTHQUAKE_KEY } from '../sources/earthquakes.js';
import { FIRE_KEY } from '../sources/fires.js';
import { CONFLICT_KEY } from '../sources/conflicts.js';
import { WEATHER_KEY } from '../sources/weather.js';
import type { BaseEntity, EarthquakeEntity, ConflictEntity } from '@god-eye/shared';

export interface CountryScore {
  code: string;
  name: string;
  score: number;
  level: 'low' | 'normal' | 'elevated' | 'high' | 'critical';
  components: {
    conflict: number;
    seismic: number;
    fire: number;
    weather: number;
  };
}

// ISO-3166 country bounding boxes (simplified — major countries)
const COUNTRY_BOUNDS: Record<string, { name: string; minLat: number; maxLat: number; minLng: number; maxLng: number }> = {
  US: { name: 'United States', minLat: 24, maxLat: 50, minLng: -125, maxLng: -66 },
  RU: { name: 'Russia', minLat: 41, maxLat: 82, minLng: 19, maxLng: 180 },
  CN: { name: 'China', minLat: 18, maxLat: 54, minLng: 73, maxLng: 135 },
  IN: { name: 'India', minLat: 6, maxLat: 36, minLng: 68, maxLng: 97 },
  BR: { name: 'Brazil', minLat: -34, maxLat: 5, minLng: -74, maxLng: -35 },
  UA: { name: 'Ukraine', minLat: 44, maxLat: 53, minLng: 22, maxLng: 40 },
  SY: { name: 'Syria', minLat: 32, maxLat: 37, minLng: 35, maxLng: 42 },
  IQ: { name: 'Iraq', minLat: 29, maxLat: 37, minLng: 39, maxLng: 49 },
  AF: { name: 'Afghanistan', minLat: 29, maxLat: 39, minLng: 60, maxLng: 75 },
  YE: { name: 'Yemen', minLat: 12, maxLat: 19, minLng: 42, maxLng: 54 },
  SO: { name: 'Somalia', minLat: -2, maxLat: 12, minLng: 41, maxLng: 51 },
  SD: { name: 'Sudan', minLat: 3, maxLat: 22, minLng: 22, maxLng: 38 },
  LY: { name: 'Libya', minLat: 19, maxLat: 33, minLng: 9, maxLng: 25 },
  MM: { name: 'Myanmar', minLat: 10, maxLat: 28, minLng: 92, maxLng: 101 },
  CD: { name: 'DR Congo', minLat: -14, maxLat: 5, minLng: 12, maxLng: 31 },
  NG: { name: 'Nigeria', minLat: 4, maxLat: 14, minLng: 3, maxLng: 15 },
  ET: { name: 'Ethiopia', minLat: 3, maxLat: 15, minLng: 33, maxLng: 48 },
  PK: { name: 'Pakistan', minLat: 24, maxLat: 37, minLng: 61, maxLng: 77 },
  MX: { name: 'Mexico', minLat: 14, maxLat: 33, minLng: -118, maxLng: -87 },
  CO: { name: 'Colombia', minLat: -4, maxLat: 13, minLng: -79, maxLng: -67 },
  IR: { name: 'Iran', minLat: 25, maxLat: 40, minLng: 44, maxLng: 64 },
  TR: { name: 'Turkey', minLat: 36, maxLat: 42, minLng: 26, maxLng: 45 },
  IL: { name: 'Israel', minLat: 29, maxLat: 33, minLng: 34, maxLng: 36 },
  PS: { name: 'Palestine', minLat: 31, maxLat: 32.5, minLng: 34, maxLng: 35.5 },
  LB: { name: 'Lebanon', minLat: 33, maxLat: 34.7, minLng: 35, maxLng: 36.6 },
  JP: { name: 'Japan', minLat: 24, maxLat: 46, minLng: 123, maxLng: 146 },
  DE: { name: 'Germany', minLat: 47, maxLat: 55, minLng: 6, maxLng: 15 },
  GB: { name: 'United Kingdom', minLat: 50, maxLat: 59, minLng: -8, maxLng: 2 },
  FR: { name: 'France', minLat: 41, maxLat: 51, minLng: -5, maxLng: 10 },
  AU: { name: 'Australia', minLat: -44, maxLat: -10, minLng: 113, maxLng: 154 },
  EG: { name: 'Egypt', minLat: 22, maxLat: 32, minLng: 25, maxLng: 37 },
  SA: { name: 'Saudi Arabia', minLat: 16, maxLat: 32, minLng: 35, maxLng: 56 },
  AE: { name: 'UAE', minLat: 22, maxLat: 26.5, minLng: 51, maxLng: 56.5 },
  HT: { name: 'Haiti', minLat: 18, maxLat: 20, minLng: -74.5, maxLng: -71.6 },
  ML: { name: 'Mali', minLat: 10, maxLat: 25, minLng: -12, maxLng: 4 },
  BF: { name: 'Burkina Faso', minLat: 9, maxLat: 15, minLng: -5.5, maxLng: 2.4 },
  NE: { name: 'Niger', minLat: 12, maxLat: 24, minLng: 0, maxLng: 16 },
};

function isInBounds(lat: number, lng: number, b: typeof COUNTRY_BOUNDS[string]): boolean {
  return lat >= b.minLat && lat <= b.maxLat && lng >= b.minLng && lng <= b.maxLng;
}

function countInCountry(entities: BaseEntity[], bounds: typeof COUNTRY_BOUNDS[string]): number {
  return entities.filter((e) => isInBounds(e.lat, e.lng, bounds)).length;
}

function scoreLevel(score: number): CountryScore['level'] {
  if (score >= 80) return 'critical';
  if (score >= 60) return 'high';
  if (score >= 40) return 'elevated';
  if (score >= 20) return 'normal';
  return 'low';
}

export async function computeCII(): Promise<CountryScore[]> {
  // Load all available data
  const [eqCache, fireCache, conflictCache, weatherCache] = await Promise.all([
    readCache<EarthquakeEntity[]>(EARTHQUAKE_KEY),
    readCache<BaseEntity[]>(FIRE_KEY),
    readCache<ConflictEntity[]>(CONFLICT_KEY),
    readCache<BaseEntity[]>(WEATHER_KEY),
  ]);

  const earthquakes = eqCache?.data ?? [];
  const fires = fireCache?.data ?? [];
  const conflicts = conflictCache?.data ?? [];
  const weather = weatherCache?.data ?? [];

  const scores: CountryScore[] = [];

  for (const [code, bounds] of Object.entries(COUNTRY_BOUNDS)) {
    const conflictCount = countInCountry(conflicts, bounds);
    const eqCount = countInCountry(earthquakes, bounds);
    const fireCount = countInCountry(fires, bounds);
    const weatherCount = countInCountry(weather, bounds);

    // Weighted scoring (conflict heavy, natural lighter)
    const conflictScore = Math.min(40, conflictCount * 8);
    const seismicScore = Math.min(20, eqCount * 5);
    const fireScore = Math.min(20, Math.sqrt(fireCount) * 3);
    const weatherScore = Math.min(20, weatherCount * 4);

    const total = Math.min(100, conflictScore + seismicScore + fireScore + weatherScore);

    if (total > 0) {
      scores.push({
        code,
        name: bounds.name,
        score: Math.round(total),
        level: scoreLevel(total),
        components: {
          conflict: Math.round(conflictScore),
          seismic: Math.round(seismicScore),
          fire: Math.round(fireScore),
          weather: Math.round(weatherScore),
        },
      });
    }
  }

  // Sort by score descending
  scores.sort((a, b) => b.score - a.score);
  return scores;
}
