import Fastify from 'fastify';
import cors from '@fastify/cors';
import 'dotenv/config';
import { registerLayerRoutes } from './routes/layers.js';
import { registerAnalysisRoutes } from './routes/analysis.js';
import { registerAIRoutes } from './routes/ai.js';
import { registerWsRelay } from './relay/ws.js';
import { startAllPolls } from './polls.js';
import { registerMcpRoutes } from './mcp/index.js';
import { registerAgentRoutes } from './agent/bus.js';
import { registerNewsRoutes } from './routes/news.js';
import { startWatchOfficer, getWatchOfficerConfig, updateWatchOfficerConfig } from './agent/watch-officer.js';

const app = Fastify({ logger: true });

await app.register(cors, { origin: true });

// WebSocket relay
await registerWsRelay(app);

// REST routes
await registerLayerRoutes(app);
await registerAnalysisRoutes(app);
await registerAIRoutes(app);
await registerMcpRoutes(app);
await registerAgentRoutes(app);
await registerNewsRoutes(app);

app.get('/api/health', async () => ({
  status: 'ok',
  service: 'god-eye-api',
  timestamp: new Date().toISOString(),
}));

// Feature flags — expose which optional capabilities are configured
app.get('/api/config', async () => ({
  cesium: {
    enabled: Boolean(process.env['GOOGLE_MAPS_API_KEY']),
    googleMapsKeySet: Boolean(process.env['GOOGLE_MAPS_API_KEY']),
  },
  shodan: { enabled: Boolean(process.env['SHODAN_API_KEY']) },
  earthdata: { enabled: Boolean(process.env['EARTHDATA_TOKEN']) },
  copernicus: { enabled: Boolean(process.env['COPERNICUS_TOKEN']) },
  ai: {
    provider: process.env['AI_PROVIDER'] ?? 'none',
    enabled: Boolean(process.env['AI_PROVIDER'] || process.env['OLLAMA_URL']),
  },
}));

// Watch-officer config API
app.get('/api/agent/watch-officer', async () => getWatchOfficerConfig());
app.post<{ Body: { enabled?: boolean; intervalMs?: number; minSeverity?: string; aiEnabled?: boolean } }>(
  '/api/agent/watch-officer',
  async (req) => {
    const body = req.body;
    const minSev = body.minSeverity ?? 'high';
    updateWatchOfficerConfig({
      ...body,
      minSeverity: (['low', 'medium', 'high', 'critical'].includes(minSev)
        ? minSev : 'high') as 'low' | 'medium' | 'high' | 'critical',
    });
    return getWatchOfficerConfig();
  }
);

const port = parseInt(process.env.PORT ?? '3001', 10);

try {
  await app.listen({ port, host: '0.0.0.0' });
  console.log(`[GOD-EYE API] listening on :${port}`);
  // Start poll loops after server is ready
  startAllPolls();
  // Start watch officer if WATCH_OFFICER_ENABLED=true
  if (process.env['WATCH_OFFICER_ENABLED'] === 'true') {
    const minSev = process.env['WATCH_OFFICER_MIN_SEVERITY'] ?? 'high';
    startWatchOfficer({
      enabled: true,
      intervalMs: parseInt(process.env['WATCH_OFFICER_INTERVAL_MS'] ?? '300000', 10),
      minSeverity: (['low', 'medium', 'high', 'critical'].includes(minSev)
        ? minSev : 'high') as 'low' | 'medium' | 'high' | 'critical',
      aiEnabled: process.env['WATCH_OFFICER_AI'] !== 'false',
    });
  }
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
