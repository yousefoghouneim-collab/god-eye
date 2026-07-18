import type { FastifyInstance } from 'fastify';
import { getAIConfig, setAIConfig, getOllamaTiers } from '../ai/gateway.js';
import { generateViewBrief, generateEntityBrief } from '../ai/briefs.js';

export async function registerAIRoutes(app: FastifyInstance) {
  // Get current AI config
  app.get('/api/ai/config', async () => {
    const config = getAIConfig();
    // Don't expose API keys
    return { ...config, apiKey: config.apiKey ? '***' : undefined };
  });

  // Update AI config
  app.post<{ Body: Record<string, unknown> }>('/api/ai/config', async (req) => {
    const updated = setAIConfig(req.body);
    return { ...updated, apiKey: updated.apiKey ? '***' : undefined };
  });

  // Ollama tier presets
  app.get('/api/ai/tiers', async () => getOllamaTiers());

  // Generate situational brief
  app.get('/api/ai/brief', async () => {
    const brief = await generateViewBrief();
    return { brief, timestamp: Date.now() };
  });

  // Generate entity-specific brief
  app.post<{ Body: { type: string; data: Record<string, unknown> } }>('/api/ai/brief/entity', async (req) => {
    const { type, data } = req.body;
    const brief = await generateEntityBrief(type, data);
    return { brief, timestamp: Date.now() };
  });
}
