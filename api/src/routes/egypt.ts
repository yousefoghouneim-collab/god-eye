/**
 * Egypt layer routes.
 * - GET /api/egypt/cities  → curated Egyptian cities dataset
 * - GET /api/egypt/gouna-population → El Gouna running population counter (Redis-backed)
 * - POST /api/egypt/gouna-population/tick → internal tick (called by server poll)
 */
import type { FastifyInstance } from 'fastify';
import { getRedis } from '../cache/redis.js';

const GOUNA_POP_KEY = 'egypt:gouna:population';
const GOUNA_BASE = 43506;

// Curated Egyptian cities with dossier fields
export const EGYPT_CITIES = [
  { id: 'eg-cairo',       lat: 30.0444, lng: 31.2357, name: 'Cairo',       population: 21_000_000, description: 'Capital and largest city of Egypt.' },
  { id: 'eg-alexandria',  lat: 31.2001, lng: 29.9187, name: 'Alexandria',  population: 5_200_000,  description: 'Major Mediterranean port city, cultural hub.' },
  { id: 'eg-giza',        lat: 30.0131, lng: 31.2089, name: 'Giza',        population: 4_500_000,  description: 'Home of the Great Pyramids and Sphinx.' },
  { id: 'eg-sharm',       lat: 27.9158, lng: 34.3300, name: 'Sharm el-Sheikh', population: 73_000, description: 'Red Sea resort city and international conference hub.' },
  { id: 'eg-hurghada',    lat: 27.2579, lng: 33.8116, name: 'Hurghada',    population: 248_000,    description: 'Major Red Sea resort and diving destination.' },
  { id: 'eg-luxor',       lat: 25.6872, lng: 32.6396, name: 'Luxor',       population: 422_000,    description: 'Ancient Thebes — world\'s greatest open-air museum.' },
  { id: 'eg-aswan',       lat: 24.0889, lng: 32.8998, name: 'Aswan',       population: 290_000,    description: 'Southern gateway; Aswan High Dam controls the Nile.' },
  { id: 'eg-suez',        lat: 29.9668, lng: 32.5498, name: 'Suez',        population: 744_000,    description: 'Strategic city at the southern entrance of the Suez Canal.' },
  { id: 'eg-port-said',   lat: 31.2565, lng: 32.2841, name: 'Port Said',   population: 742_000,    description: 'Northern gateway of the Suez Canal.' },
  { id: 'eg-mansoura',    lat: 31.0364, lng: 31.3807, name: 'Mansoura',    population: 960_000,    description: 'Major Nile Delta city and university hub.' },
  { id: 'eg-tanta',       lat: 30.7865, lng: 31.0004, name: 'Tanta',       population: 659_000,    description: 'Largest city in the Nile Delta region.' },
  { id: 'eg-ismailia',    lat: 30.5965, lng: 32.2715, name: 'Ismailia',    population: 391_000,    description: 'Suez Canal Zone city known as "The City of Beauty".' },
  { id: 'eg-dahab',       lat: 28.4880, lng: 34.5140, name: 'Dahab',       population: 25_000,     description: 'Sinai diving and backpacker destination.' },
  { id: 'eg-gouna',       lat: 27.3850, lng: 33.6760, name: 'El Gouna',    population: GOUNA_BASE, description: 'Self-contained Red Sea resort town built by Orascom. Known for sustainable design, lagoons, and international events.', special: 'live-population' },
];

// ── Population counter logic ──────────────────────────────────────────────────

async function initGounaCounter() {
  const r = getRedis();
  try {
    const existing = await r.get(GOUNA_POP_KEY);
    if (!existing) {
      await r.set(GOUNA_POP_KEY, String(GOUNA_BASE));
    }
  } catch { /* Redis may not be ready yet */ }
}

// Slow, irregular increment — +1 every 20–90 seconds.
// Called once per server start; keeps running for the lifetime of the process.
export function startGounaCounter() {
  void initGounaCounter();
  function scheduleNext() {
    const delay = (20 + Math.random() * 70) * 1000;
    setTimeout(async () => {
      try {
        await getRedis().incr(GOUNA_POP_KEY);
      } catch { /* Redis may be down */ }
      scheduleNext();
    }, delay);
  }
  scheduleNext();
}

// ── Route registration ─────────────────────────────────────────────────────────

export async function registerEgyptRoutes(app: FastifyInstance) {
  // City dataset
  app.get('/api/egypt/cities', async () => ({
    data: EGYPT_CITIES.map(({ special: _s, ...city }) => ({
      ...city,
      type: 'egypt-city' as const,
      source: 'curated',
      label: city.name,
    })),
  }));

  // El Gouna live population
  app.get('/api/egypt/gouna-population', async () => {
    try {
      const val = await getRedis().get(GOUNA_POP_KEY);
      return { population: val ? parseInt(val, 10) : GOUNA_BASE };
    } catch {
      return { population: GOUNA_BASE };
    }
  });
}
