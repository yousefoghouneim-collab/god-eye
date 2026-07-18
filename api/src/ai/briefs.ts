/**
 * AI Intel Briefs — generates situational intelligence from current layer data.
 */
import { chat } from './gateway.js';
import { computeCII, type CountryScore } from '../analysis/country-instability.js';
import { computeCorrelations, type CorrelationAlert } from '../analysis/correlation.js';
import { readCache } from '../cache/redis.js';
import { EARTHQUAKE_KEY } from '../sources/earthquakes.js';
import { CONFLICT_KEY } from '../sources/conflicts.js';
import type { EarthquakeEntity, ConflictEntity } from '@god-eye/shared';

const SYSTEM_PROMPT = `You are GOD-EYE, an AI intelligence analyst embedded in a global situational awareness platform.
Your role is to produce concise, factual intelligence briefs from real-time data feeds.
Style: formal, direct, no speculation. Use military-style brevity codes where appropriate.
Structure briefs with: SITUATION, KEY INDICATORS, ASSESSMENT, WATCH ITEMS.
Cite data sources. Never fabricate events or statistics.`;

export async function generateViewBrief(): Promise<string> {
  const [cii, correlations, eqCache, conflictCache] = await Promise.all([
    computeCII(),
    computeCorrelations(),
    readCache<EarthquakeEntity[]>(EARTHQUAKE_KEY),
    readCache<ConflictEntity[]>(CONFLICT_KEY),
  ]);

  const topCountries = cii.slice(0, 5);
  const topAlerts = correlations.slice(0, 5);
  const eqCount = eqCache?.data?.length ?? 0;
  const conflictCount = conflictCache?.data?.length ?? 0;

  const dataContext = buildDataContext(topCountries, topAlerts, eqCount, conflictCount);

  try {
    const response = await chat([
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: `Generate a situational intelligence brief from the following live data:\n\n${dataContext}\n\nProduce a structured brief (max 300 words).` },
    ]);
    return response.content;
  } catch (err) {
    return `[AI OFFLINE] Unable to generate brief: ${(err as Error).message}\n\nRaw data summary:\n${dataContext}`;
  }
}

export async function generateEntityBrief(entityType: string, entityData: Record<string, unknown>): Promise<string> {
  const prompt = `Provide a 2-3 sentence intelligence assessment of this ${entityType}:\n${JSON.stringify(entityData, null, 2)}\n\nInclude strategic significance and any relevant context.`;

  try {
    const response = await chat([
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: prompt },
    ]);
    return response.content;
  } catch (err) {
    return `[AI OFFLINE] ${(err as Error).message}`;
  }
}

function buildDataContext(
  countries: CountryScore[],
  alerts: CorrelationAlert[],
  eqCount: number,
  conflictCount: number,
): string {
  let ctx = `TIMESTAMP: ${new Date().toISOString()}\n\n`;

  ctx += `GLOBAL ACTIVITY:\n`;
  ctx += `- Earthquakes (M2.5+ last 24h): ${eqCount}\n`;
  ctx += `- Conflict events (GDELT 24h): ${conflictCount}\n\n`;

  if (countries.length > 0) {
    ctx += `COUNTRY INSTABILITY INDEX (top ${countries.length}):\n`;
    for (const c of countries) {
      ctx += `- ${c.name} (${c.code}): ${c.score}/100 [${c.level.toUpperCase()}] — conflict:${c.components.conflict} seismic:${c.components.seismic} fire:${c.components.fire} weather:${c.components.weather}\n`;
    }
    ctx += '\n';
  }

  if (alerts.length > 0) {
    ctx += `CROSS-STREAM CONVERGENCE ALERTS (top ${alerts.length}):\n`;
    for (const a of alerts) {
      ctx += `- [${a.severity.toUpperCase()}] ${a.title} at ${a.lat.toFixed(1)}°,${a.lng.toFixed(1)}° — ${a.description}\n`;
    }
  }

  return ctx;
}
