import { startPollLoop } from './cache/poll-loop.js';
import { broadcast } from './relay/ws.js';
import { checkEntities } from './agent/watches.js';
import { fetchEarthquakes, EARTHQUAKE_KEY, EARTHQUAKE_TTL, EARTHQUAKE_SOURCE } from './sources/earthquakes.js';
import { fetchFires, FIRE_KEY, FIRE_TTL, FIRE_SOURCE } from './sources/fires.js';
import { fetchEONET, EONET_KEY, EONET_TTL, EONET_SOURCE } from './sources/eonet.js';
import { fetchAircraft, AIRCRAFT_KEY, AIRCRAFT_TTL, AIRCRAFT_SOURCE } from './sources/aircraft.js';
import { fetchVolcanoes, VOLCANO_KEY, VOLCANO_TTL, VOLCANO_SOURCE } from './sources/volcanoes.js';
import { fetchConflicts, CONFLICT_KEY, CONFLICT_TTL, CONFLICT_SOURCE } from './sources/conflicts.js';
import { fetchWeatherAlerts, WEATHER_KEY, WEATHER_TTL, WEATHER_SOURCE } from './sources/weather.js';
import { fetchSatellites, SATELLITE_KEY, SATELLITE_TTL, SATELLITE_SOURCE } from './sources/satellites.js';
import { fetchMarkets, MARKETS_KEY, MARKETS_TTL, MARKETS_SOURCE } from './sources/markets.js';

export function startAllPolls() {
  startPollLoop({
    key: EARTHQUAKE_KEY,
    source: EARTHQUAKE_SOURCE,
    intervalMs: EARTHQUAKE_TTL,
    fetcher: fetchEarthquakes,
    onUpdate: (data) => { broadcast('earthquakes', data); checkEntities('earthquakes', data); },
  });

  startPollLoop({
    key: FIRE_KEY,
    source: FIRE_SOURCE,
    intervalMs: FIRE_TTL,
    fetcher: fetchFires,
    onUpdate: (data) => broadcast('fires', data),
  });

  startPollLoop({
    key: EONET_KEY,
    source: EONET_SOURCE,
    intervalMs: EONET_TTL,
    fetcher: fetchEONET,
    onUpdate: (data) => broadcast('eonet', data),
  });

  startPollLoop({
    key: AIRCRAFT_KEY,
    source: AIRCRAFT_SOURCE,
    intervalMs: AIRCRAFT_TTL,
    fetcher: fetchAircraft,
    onUpdate: (data) => { broadcast('aircraft', data); checkEntities('aircraft', data); },
  });

  startPollLoop({
    key: VOLCANO_KEY,
    source: VOLCANO_SOURCE,
    intervalMs: VOLCANO_TTL,
    fetcher: fetchVolcanoes,
    onUpdate: (data) => broadcast('volcanoes', data),
  });

  startPollLoop({
    key: CONFLICT_KEY,
    source: CONFLICT_SOURCE,
    intervalMs: CONFLICT_TTL,
    fetcher: fetchConflicts,
    onUpdate: (data) => broadcast('conflicts', data),
  });

  startPollLoop({
    key: WEATHER_KEY,
    source: WEATHER_SOURCE,
    intervalMs: WEATHER_TTL,
    fetcher: fetchWeatherAlerts,
    onUpdate: (data) => broadcast('weather', data),
  });

  startPollLoop({
    key: SATELLITE_KEY,
    source: SATELLITE_SOURCE,
    intervalMs: SATELLITE_TTL,
    fetcher: fetchSatellites,
    onUpdate: (data) => broadcast('satellites', data),
  });

  startPollLoop({
    key: MARKETS_KEY,
    source: MARKETS_SOURCE,
    intervalMs: MARKETS_TTL,
    fetcher: fetchMarkets,
    onUpdate: (data) => broadcast('markets', data),
  });

  console.log('[Ghouneim Eye] All poll loops started (9 sources)');
}
