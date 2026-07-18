import type { FastifyInstance } from 'fastify';
import { computeCII } from '../analysis/country-instability.js';
import { computeCorrelations } from '../analysis/correlation.js';

export async function registerAnalysisRoutes(app: FastifyInstance) {
  app.get('/api/analysis/cii', async () => {
    const scores = await computeCII();
    return { data: scores, timestamp: Date.now() };
  });

  app.get('/api/analysis/correlations', async () => {
    const alerts = await computeCorrelations();
    return { data: alerts, timestamp: Date.now() };
  });
}
