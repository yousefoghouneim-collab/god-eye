/**
 * Freshness / Health Dashboard Panel.
 * Shows live status of all data sources, OSINT service, and AI provider.
 * Fetches from /api/freshness and /api/config.
 */

let panelEl: HTMLElement | null = null;

interface FreshnessEntry {
  status: 'fresh' | 'stale' | 'down';
  fetchedAt: number;
  source: string;
  ttl: number;
}

interface AppConfig {
  cesium?: { enabled: boolean };
  shodan?: { enabled: boolean };
  earthdata?: { enabled: boolean };
  copernicus?: { enabled: boolean };
  ai?: { enabled: boolean; provider: string };
}

const SOURCE_LABELS: Record<string, string> = {
  earthquakes: 'Earthquakes (USGS)',
  fires:       'Active Fires (FIRMS)',
  eonet:       'Natural Events (EONET)',
  aircraft:    'Aircraft (adsb.lol)',
  volcanoes:   'Volcanoes (GVP)',
  conflicts:   'Conflicts (GDELT)',
  weather:     'Weather Alerts (NWS)',
  satellites:  'Satellites (CelesTrak)',
  markets:     'Markets (Yahoo/CoinGecko)',
};

function statusColor(status: string): string {
  switch (status) {
    case 'fresh': return 'var(--sig-green)';
    case 'stale': return 'var(--sig-orange)';
    default: return 'var(--sig-red)';
  }
}

function ageStr(fetchedAt: number): string {
  if (!fetchedAt) return '—';
  const secs = Math.floor((Date.now() - fetchedAt) / 1000);
  if (secs < 60) return `${secs}s ago`;
  if (secs < 3600) return `${Math.floor(secs / 60)}m ago`;
  return `${Math.floor(secs / 3600)}h ago`;
}

function buildPanel(): HTMLElement {
  const el = document.createElement('div');
  el.id = 'health-panel';
  el.className = 'panel panel--bracketed health-panel hidden';
  el.innerHTML = `
    <span class="panel__bracket-bl"></span>
    <span class="panel__bracket-br"></span>
    <div class="panel__title">
      DATA SOURCE HEALTH
      <button class="topbar__mode" id="health-refresh-btn"
        style="margin-left:auto;font-size:var(--fs-10);padding:2px 8px">⟳</button>
      <button class="topbar__mode" id="health-close-btn"
        style="margin-left:4px;font-size:var(--fs-10);padding:2px 8px">✕</button>
    </div>
    <div class="panel__body" style="overflow-y:auto;max-height:calc(100vh - 120px)">

      <!-- Live Sources -->
      <div class="hud-label" style="margin-bottom:6px">LIVE DATA SOURCES</div>
      <div id="health-sources-list" style="margin-bottom:14px;font-size:var(--fs-11)">
        <p style="color:var(--text-lo)">Loading...</p>
      </div>

      <!-- Services -->
      <div class="hud-label" style="margin-bottom:6px">SERVICES</div>
      <div id="health-services-list" style="margin-bottom:14px;font-size:var(--fs-11)">
        <p style="color:var(--text-lo)">Loading...</p>
      </div>

      <!-- Feature flags -->
      <div class="hud-label" style="margin-bottom:6px">OPTIONAL FEATURES</div>
      <div id="health-features-list" style="font-size:var(--fs-11)">
        <p style="color:var(--text-lo)">Loading...</p>
      </div>

      <!-- Last updated -->
      <div id="health-updated-at"
        style="margin-top:12px;color:var(--text-lo);font-size:var(--fs-10);text-align:right"></div>
    </div>
  `;
  return el;
}

function renderSourceRow(key: string, entry: FreshnessEntry): string {
  const label = SOURCE_LABELS[key] ?? key;
  const color = statusColor(entry.status);
  return `
    <div style="display:flex;justify-content:space-between;padding:3px 0;border-bottom:1px solid var(--line-hair)">
      <span style="color:var(--text-hi)">${label}</span>
      <span style="display:flex;align-items:center;gap:8px">
        <span style="color:var(--text-lo);font-size:var(--fs-10)">${ageStr(entry.fetchedAt)}</span>
        <span class="telemetry" style="color:${color};font-size:var(--fs-10)">${entry.status.toUpperCase()}</span>
      </span>
    </div>`;
}

function renderServiceRow(name: string, status: string, detail = ''): string {
  const color = status === 'ok' ? 'var(--sig-green)'
    : status === 'warn' ? 'var(--sig-orange)'
    : 'var(--sig-red)';
  return `
    <div style="display:flex;justify-content:space-between;padding:3px 0;border-bottom:1px solid var(--line-hair)">
      <span style="color:var(--text-hi)">${name}</span>
      <span style="display:flex;align-items:center;gap:8px">
        ${detail ? `<span style="color:var(--text-lo);font-size:var(--fs-10)">${detail}</span>` : ''}
        <span class="telemetry" style="color:${color};font-size:var(--fs-10)">${status.toUpperCase()}</span>
      </span>
    </div>`;
}

function renderFeatureRow(name: string, enabled: boolean, hint = ''): string {
  const color = enabled ? 'var(--sig-green)' : 'var(--text-lo)';
  return `
    <div style="display:flex;justify-content:space-between;padding:3px 0;border-bottom:1px solid var(--line-hair)">
      <span style="color:${enabled ? 'var(--text-hi)' : 'var(--text-lo)'}">${name}</span>
      <span style="display:flex;align-items:center;gap:8px">
        ${hint ? `<span style="color:var(--text-lo);font-size:var(--fs-10)">${hint}</span>` : ''}
        <span class="telemetry" style="color:${color};font-size:var(--fs-10)">${enabled ? 'ENABLED' : 'DISABLED'}</span>
      </span>
    </div>`;
}

async function refresh() {
  const updatedEl = document.getElementById('health-updated-at');
  const sourcesEl = document.getElementById('health-sources-list');
  const servicesEl = document.getElementById('health-services-list');
  const featuresEl = document.getElementById('health-features-list');

  // Parallel fetches
  const [freshnessRes, configRes, apiHealthRes, osintHealthRes] = await Promise.allSettled([
    fetch('/api/freshness'),
    fetch('/api/config'),
    fetch('/api/health'),
    fetch('/osint/health'),
  ]);

  // Sources
  if (freshnessRes.status === 'fulfilled' && freshnessRes.value.ok && sourcesEl) {
    const data = await freshnessRes.value.json() as Record<string, FreshnessEntry>;
    const rows = Object.entries(data).map(([k, v]) => renderSourceRow(k, v));
    if (rows.length) {
      sourcesEl.innerHTML = rows.join('');
    } else {
      sourcesEl.innerHTML = '<p style="color:var(--text-lo)">No sources reporting yet.</p>';
    }
  } else if (sourcesEl) {
    sourcesEl.innerHTML = '<p style="color:var(--sig-red)">API unreachable.</p>';
  }

  // Services
  if (servicesEl) {
    const apiOk = apiHealthRes.status === 'fulfilled' && apiHealthRes.value.ok;
    const osintOk = osintHealthRes.status === 'fulfilled' && osintHealthRes.value.ok;
    servicesEl.innerHTML = [
      renderServiceRow('Node API', apiOk ? 'ok' : 'down'),
      renderServiceRow('Python OSINT', osintOk ? 'ok' : 'down'),
      renderServiceRow('Redis', apiOk ? 'ok' : 'unknown', 'via API'),
    ].join('');
  }

  // Feature flags
  if (configRes.status === 'fulfilled' && configRes.value.ok && featuresEl) {
    const cfg = await configRes.value.json() as AppConfig;
    featuresEl.innerHTML = [
      renderFeatureRow('AI Engine', Boolean(cfg.ai?.enabled), cfg.ai?.provider ?? '—'),
      renderFeatureRow('Cesium Photoreal 3D', Boolean(cfg.cesium?.enabled), 'GOOGLE_MAPS_API_KEY'),
      renderFeatureRow('Shodan Host Lookup', Boolean(cfg.shodan?.enabled), 'SHODAN_API_KEY'),
      renderFeatureRow('SAR Mode B (Earthdata)', Boolean(cfg.earthdata?.enabled), 'EARTHDATA_TOKEN'),
      renderFeatureRow('Copernicus CDSE', Boolean(cfg.copernicus?.enabled), 'COPERNICUS_TOKEN'),
    ].join('');
  } else if (featuresEl) {
    featuresEl.innerHTML = '<p style="color:var(--text-lo)">Config unavailable.</p>';
  }

  if (updatedEl) {
    updatedEl.textContent = `Updated ${new Date().toISOString().replace('T', ' ').slice(0, 19)}Z`;
  }
}

export function initHealthPanel() {
  if (!document.getElementById('health-panel-style')) {
    const s = document.createElement('style');
    s.id = 'health-panel-style';
    s.textContent = `
      .health-panel {
        position:fixed; left:50%; transform:translateX(-50%);
        top:48px; width:400px; z-index:200;
        max-height:calc(100vh - 64px);
      }
      .health-panel.hidden { display:none; }
    `;
    document.head.appendChild(s);
  }

  panelEl = buildPanel();
  document.body.appendChild(panelEl);

  document.getElementById('health-close-btn')?.addEventListener('click', hideHealthPanel);
  document.getElementById('health-refresh-btn')?.addEventListener('click', () => refresh().catch(console.warn));
}

export function showHealthPanel() {
  panelEl?.classList.remove('hidden');
  refresh().catch(console.warn);
}

export function hideHealthPanel() {
  panelEl?.classList.add('hidden');
}

export function toggleHealthPanel() {
  if (panelEl?.classList.contains('hidden')) showHealthPanel();
  else hideHealthPanel();
}
