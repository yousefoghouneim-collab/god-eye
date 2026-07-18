/**
 * AI Watch-Officer mode.
 * Runs on a configurable interval, checks CII + correlations for material changes,
 * and generates AI brief snippets if new critical/high items appear.
 * Alerts are broadcast to the browser ticker via WS.
 */
import { readCache } from '../cache/redis.js';
import { broadcastCommand } from '../relay/ws.js';
import { emitAgentEvent } from './bus.js';
import { chat } from '../ai/gateway.js';

export interface WatchOfficerConfig {
  intervalMs: number;   // scan interval, default 5min
  enabled: boolean;
  minSeverity: 'low' | 'medium' | 'high' | 'critical'; // minimum correlation severity to alert
  aiEnabled: boolean;   // generate AI brief snippet for alerts
}

const DEFAULT_CONFIG: WatchOfficerConfig = {
  intervalMs: 5 * 60 * 1_000,
  enabled: false,  // opt-in: user must enable
  minSeverity: 'high',
  aiEnabled: true,
};

let config: WatchOfficerConfig = { ...DEFAULT_CONFIG };
let timer: ReturnType<typeof setInterval> | null = null;

// Snapshot of last scan to detect changes
interface LastScan {
  correlationIds: Set<string>;
  criticalCiiCountries: Set<string>;
  scannedAt: number;
}
let lastScan: LastScan | null = null;

const SEV_RANK: Record<string, number> = { low: 1, medium: 2, high: 3, critical: 4 };
const minRank = () => SEV_RANK[config.minSeverity] ?? 3;

async function runScan() {
  const now = Date.now();
  const newCorrelationIds = new Set<string>();
  const newCriticalCountries = new Set<string>();

  // --- Check correlations ---
  type CorrelationEntry = { id: string; severity: string; layers: string[]; lat: number; lng: number; count: number };
  const corrCache = await readCache<{ correlations: CorrelationEntry[] }>('correlations');
  const correlations = corrCache?.data?.correlations ?? [];

  const alertCorrelations: CorrelationEntry[] = [];
  for (const c of correlations) {
    newCorrelationIds.add(c.id);
    const rank = SEV_RANK[c.severity] ?? 1;
    if (rank >= minRank()) {
      // New alert not seen in previous scan
      if (!lastScan || !lastScan.correlationIds.has(c.id)) {
        alertCorrelations.push(c);
      }
    }
  }

  // --- Check CII ---
  type CiiEntry = { country: string; score: number; level: string };
  const ciiCache = await readCache<{ scores: CiiEntry[] }>('cii');
  const ciiScores = ciiCache?.data?.scores ?? [];

  const alertCii: CiiEntry[] = [];
  for (const s of ciiScores) {
    if (s.level === 'critical' || s.level === 'high') {
      newCriticalCountries.add(s.country);
      if (!lastScan || !lastScan.criticalCiiCountries.has(s.country)) {
        alertCii.push(s);
      }
    }
  }

  lastScan = {
    correlationIds: newCorrelationIds,
    criticalCiiCountries: newCriticalCountries,
    scannedAt: now,
  };

  const hasAlerts = alertCorrelations.length > 0 || alertCii.length > 0;
  if (!hasAlerts) {
    console.log('[WatchOfficer] Scan complete — no material changes');
    return;
  }

  console.log(`[WatchOfficer] ${alertCorrelations.length} new convergences, ${alertCii.length} new CII alerts`);

  // Build a brief summary
  const lines: string[] = [];
  if (alertCorrelations.length) {
    lines.push(`${alertCorrelations.length} new convergence alert(s):`);
    for (const c of alertCorrelations.slice(0, 3)) {
      lines.push(`  [${c.severity.toUpperCase()}] ${c.lat.toFixed(1)},${c.lng.toFixed(1)} — ${c.layers.join('/')}`);
    }
  }
  if (alertCii.length) {
    lines.push(`${alertCii.length} new high-risk country flag(s):`);
    for (const s of alertCii.slice(0, 3)) {
      lines.push(`  ${s.country}: ${s.score.toFixed(1)} [${s.level.toUpperCase()}]`);
    }
  }
  const summary = lines.join('\n');

  // AI brief snippet (if enabled and AI is reachable)
  let briefText = summary;
  if (config.aiEnabled) {
    try {
      const aiRes = await chat([
        {
          role: 'user',
          content: `You are a military intelligence watch officer. Summarize the following new alerts in ONE concise sentence (max 120 chars) suitable for a status ticker:\n\n${summary}`,
        },
      ]);
      if (aiRes.content && aiRes.content.length < 200) {
        briefText = aiRes.content.replace(/\n/g, ' ').trim();
      }
    } catch {
      // AI offline — use raw summary
    }
  }

  // Push to browser ticker + agent event stream
  broadcastCommand('watch_officer_alert', {
    summary: briefText,
    correlations: alertCorrelations.length,
    cii: alertCii.length,
    ts: now,
  });
  emitAgentEvent('watch_officer_alert', { summary: briefText, ts: now });
}

export function startWatchOfficer(overrides?: Partial<WatchOfficerConfig>) {
  if (overrides) config = { ...config, ...overrides };
  if (!config.enabled) return;
  if (timer) clearInterval(timer);
  timer = setInterval(() => { runScan().catch(console.warn); }, config.intervalMs);
  runScan().catch(console.warn);
  console.log(`[WatchOfficer] started (interval=${config.intervalMs}ms, minSeverity=${config.minSeverity})`);
}

export function stopWatchOfficer() {
  if (timer) { clearInterval(timer); timer = null; }
}

export function getWatchOfficerConfig(): WatchOfficerConfig {
  return { ...config };
}

export function updateWatchOfficerConfig(updates: Partial<WatchOfficerConfig>) {
  const wasEnabled = config.enabled;
  config = { ...config, ...updates };
  if (config.enabled && !wasEnabled) {
    startWatchOfficer();
  } else if (!config.enabled && wasEnabled) {
    stopWatchOfficer();
  } else if (config.enabled && updates.intervalMs) {
    // Restart with new interval
    stopWatchOfficer();
    startWatchOfficer();
  }
}
