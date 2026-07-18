/**
 * MCP tool definitions and implementations.
 * Tools that affect the globe broadcast a command via WS relay.
 * Tools that query data read from Redis cache directly.
 */
import { broadcastCommand } from '../relay/ws.js';
import { readCache } from '../cache/redis.js';
import { EARTHQUAKE_KEY } from '../sources/earthquakes.js';
import { AIRCRAFT_KEY } from '../sources/aircraft.js';
import { SATELLITE_KEY } from '../sources/satellites.js';
import { CONFLICT_KEY } from '../sources/conflicts.js';
import { WEATHER_KEY } from '../sources/weather.js';
import type { BaseEntity } from '@god-eye/shared';

// ── Tool Schema Types ───────────────────────────────────────────────────────
export interface MCPTool {
  name: string;
  description: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, { type: string; description: string; enum?: string[] }>;
    required?: string[];
  };
}

export interface MCPToolResult {
  content: Array<{ type: 'text'; text: string }>;
  isError?: boolean;
}

// ── Layer key map (mirrors layer registry names) ────────────────────────────
const LAYER_CACHE_KEYS: Record<string, string> = {
  earthquakes: EARTHQUAKE_KEY,
  aircraft: AIRCRAFT_KEY,
  satellites: SATELLITE_KEY,
  conflicts: CONFLICT_KEY,
  weather: WEATHER_KEY,
};

// ── Tool definitions ────────────────────────────────────────────────────────
export const TOOLS: MCPTool[] = [
  {
    name: 'fly_to',
    description: 'Fly the 3D globe camera to a latitude/longitude coordinate with optional zoom label.',
    inputSchema: {
      type: 'object',
      properties: {
        lat: { type: 'number', description: 'Latitude (-90 to 90)' },
        lng: { type: 'number', description: 'Longitude (-180 to 180)' },
        altitude: { type: 'number', description: 'Camera altitude in degrees (optional, default 2.5)' },
        label: { type: 'string', description: 'Optional label to display at the target' },
      },
      required: ['lat', 'lng'],
    },
  },
  {
    name: 'set_layer',
    description: 'Enable or disable a data layer on the globe.',
    inputSchema: {
      type: 'object',
      properties: {
        layer: { type: 'string', description: 'Layer key (e.g. earthquakes, aircraft, satellites, conflicts, fires, weather, volcanoes, military-bases, ports, chokepoints, nuclear)' },
        enabled: { type: 'string', description: 'true to enable, false to disable', enum: ['true', 'false'] },
      },
      required: ['layer', 'enabled'],
    },
  },
  {
    name: 'list_layers',
    description: 'List all available data layers and their descriptions.',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'place_pin',
    description: 'Drop a custom marker pin on the globe.',
    inputSchema: {
      type: 'object',
      properties: {
        lat: { type: 'number', description: 'Latitude' },
        lng: { type: 'number', description: 'Longitude' },
        label: { type: 'string', description: 'Pin label' },
        color: { type: 'string', description: 'Pin color (hex or CSS color name, optional)' },
      },
      required: ['lat', 'lng', 'label'],
    },
  },
  {
    name: 'clear_pins',
    description: 'Remove all custom marker pins from the globe.',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'get_dossier',
    description: 'Request the dossier panel to show information for a lat/lng location.',
    inputSchema: {
      type: 'object',
      properties: {
        lat: { type: 'number', description: 'Latitude' },
        lng: { type: 'number', description: 'Longitude' },
        label: { type: 'string', description: 'Location description (optional)' },
      },
      required: ['lat', 'lng'],
    },
  },
  {
    name: 'list_alerts',
    description: 'Return the current correlation / convergence alerts from the analysis engine.',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'get_cii',
    description: 'Return the Country Instability Index scores for all tracked countries.',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'search_telemetry',
    description: 'Search cached live layer data for matching entities.',
    inputSchema: {
      type: 'object',
      properties: {
        layer: { type: 'string', description: 'Layer to search: earthquakes | aircraft | satellites | conflicts | weather' },
        query: { type: 'string', description: 'Text to match against entity label/id (case-insensitive)' },
        limit: { type: 'number', description: 'Max results (default 10)' },
      },
      required: ['layer', 'query'],
    },
  },
  {
    name: 'osint_lookup',
    description: 'Perform a server-side OSINT lookup (IP geo, DNS, RDAP, BGP, CVE, or reverse-DNS).',
    inputSchema: {
      type: 'object',
      properties: {
        type: { type: 'string', description: 'Lookup type', enum: ['ip-geo', 'dns', 'rdap', 'bgp', 'cve', 'reverse-dns'] },
        value: { type: 'string', description: 'The IP address, domain, or CVE keyword to look up' },
      },
      required: ['type', 'value'],
    },
  },
];

// ── Tool handler ────────────────────────────────────────────────────────────
export async function callTool(name: string, args: Record<string, unknown>): Promise<MCPToolResult> {
  const ok = (text: string): MCPToolResult => ({ content: [{ type: 'text', text }] });
  const err = (text: string): MCPToolResult => ({ content: [{ type: 'text', text }], isError: true });

  switch (name) {
    case 'fly_to': {
      const lat = Number(args['lat']);
      const lng = Number(args['lng']);
      if (isNaN(lat) || isNaN(lng)) return err('Invalid lat/lng');
      const altitude = args['altitude'] ? Number(args['altitude']) : undefined;
      const label = args['label'] ? String(args['label']) : undefined;
      broadcastCommand('fly_to', { lat, lng, altitude, label });
      return ok(`Flying globe camera to ${lat.toFixed(4)}, ${lng.toFixed(4)}${label ? ` (${label})` : ''}`);
    }

    case 'set_layer': {
      const layer = String(args['layer'] ?? '');
      const enabled = String(args['enabled']) === 'true';
      broadcastCommand('set_layer', { layer, enabled });
      return ok(`Layer "${layer}" ${enabled ? 'enabled' : 'disabled'}`);
    }

    case 'list_layers': {
      const layers = [
        'earthquakes', 'fires', 'eonet', 'aircraft', 'volcanoes',
        'conflicts', 'weather', 'satellites', 'markets',
        'military-bases', 'ports', 'chokepoints', 'nuclear',
      ];
      return ok(`Available layers:\n${layers.map(l => `  • ${l}`).join('\n')}`);
    }

    case 'place_pin': {
      const lat = Number(args['lat']);
      const lng = Number(args['lng']);
      if (isNaN(lat) || isNaN(lng)) return err('Invalid lat/lng');
      const label = String(args['label'] ?? 'Pin');
      const color = args['color'] ? String(args['color']) : undefined;
      broadcastCommand('place_pin', { lat, lng, label, color });
      return ok(`Pin "${label}" placed at ${lat.toFixed(4)}, ${lng.toFixed(4)}`);
    }

    case 'clear_pins': {
      broadcastCommand('clear_pins', {});
      return ok('All pins cleared');
    }

    case 'get_dossier': {
      const lat = Number(args['lat']);
      const lng = Number(args['lng']);
      if (isNaN(lat) || isNaN(lng)) return err('Invalid lat/lng');
      const label = args['label'] ? String(args['label']) : undefined;
      broadcastCommand('get_dossier', { lat, lng, label });
      return ok(`Dossier requested for ${lat.toFixed(4)}, ${lng.toFixed(4)}`);
    }

    case 'list_alerts': {
      try {
        const cached = await readCache<{ correlations: Array<{ id: string; severity: string; layers: string[]; lat: number; lng: number; count: number }> }>('correlations');
        if (!cached?.data?.correlations?.length) return ok('No active convergence alerts.');
        const lines = cached.data.correlations
          .sort((a, b) => {
            const rank: Record<string, number> = { critical: 4, high: 3, medium: 2, low: 1 };
            return (rank[b.severity] ?? 0) - (rank[a.severity] ?? 0);
          })
          .slice(0, 20)
          .map(c => `[${c.severity.toUpperCase()}] ${c.lat.toFixed(2)},${c.lng.toFixed(2)} — streams: ${c.layers.join(',')} (${c.count} events)`);
        return ok(`${lines.length} active alerts:\n${lines.join('\n')}`);
      } catch {
        return err('Failed to read correlation cache');
      }
    }

    case 'get_cii': {
      try {
        const cached = await readCache<{ scores: Array<{ country: string; score: number; level: string }> }>('cii');
        if (!cached?.data?.scores?.length) return ok('CII data not yet available.');
        const lines = cached.data.scores
          .sort((a, b) => b.score - a.score)
          .slice(0, 20)
          .map(s => `${s.country}: ${s.score.toFixed(1)} [${s.level}]`);
        return ok(`Country Instability Index (top 20):\n${lines.join('\n')}`);
      } catch {
        return err('Failed to read CII cache');
      }
    }

    case 'search_telemetry': {
      const layer = String(args['layer'] ?? '');
      const query = String(args['query'] ?? '').toLowerCase();
      const limit = Math.min(Number(args['limit'] ?? 10), 50);
      const cacheKey = LAYER_CACHE_KEYS[layer];
      if (!cacheKey) return err(`Unknown layer "${layer}". Valid: ${Object.keys(LAYER_CACHE_KEYS).join(', ')}`);
      try {
        const cached = await readCache<BaseEntity[]>(cacheKey);
        if (!cached?.data) return ok(`No data cached for layer "${layer}"`);
        const matches = cached.data
          .filter(e => {
            const id = (e.id ?? '').toLowerCase();
            const label = (e.label ?? '').toLowerCase();
            return id.includes(query) || label.includes(query);
          })
          .slice(0, limit);
        if (!matches.length) return ok(`No entities in "${layer}" match "${query}"`);
        const lines = matches.map(e => `  ${e.id}: ${e.label ?? '—'} @ ${e.lat?.toFixed(2)},${e.lng?.toFixed(2)}`);
        return ok(`${matches.length} match(es) in "${layer}" for "${query}":\n${lines.join('\n')}`);
      } catch {
        return err('Failed to read layer cache');
      }
    }

    case 'osint_lookup': {
      const type = String(args['type'] ?? '');
      const value = String(args['value'] ?? '');
      if (!type || !value) return err('type and value are required');
      const fieldMap: Record<string, string> = {
        'ip-geo': 'ip', dns: 'domain', rdap: 'domain',
        bgp: 'ip', cve: 'keyword', 'reverse-dns': 'ip',
      };
      const field = fieldMap[type];
      if (!field) return err(`Unknown OSINT type "${type}"`);
      try {
        const osintBase = process.env['OSINT_URL'] ?? 'http://localhost:8001';
        const res = await fetch(`${osintBase}/osint/recon/${type}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ [field]: value }),
          signal: AbortSignal.timeout(15_000),
        });
        if (!res.ok) return err(`OSINT service returned ${res.status}`);
        const data = await res.json();
        return ok(JSON.stringify(data, null, 2));
      } catch (e) {
        return err(`OSINT lookup failed: ${e instanceof Error ? e.message : String(e)}`);
      }
    }

    default:
      return err(`Unknown tool: ${name}`);
  }
}
