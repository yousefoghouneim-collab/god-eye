/**
 * Watch-Officer panel — controls for AI watch-officer mode and AOI watches.
 * Communicates with /api/agent/watch-officer and /api/agent/watches.
 */
import { DataBus } from '../bus/data-bus.js';

interface WOConfig {
  enabled: boolean;
  intervalMs: number;
  minSeverity: string;
  aiEnabled: boolean;
}

interface WatchArea {
  id: string;
  label: string;
  lat1: number; lng1: number;
  lat2: number; lng2: number;
  hitCount: number;
}

let panelEl: HTMLElement | null = null;

function buildPanel(): HTMLElement {
  const el = document.createElement('div');
  el.id = 'watch-officer-panel';
  el.className = 'panel panel--bracketed watch-officer-panel hidden';
  el.innerHTML = `
    <span class="panel__bracket-bl"></span>
    <span class="panel__bracket-br"></span>
    <div class="panel__title">
      WATCH OFFICER
      <button class="topbar__mode" id="wo-close-btn"
        style="margin-left:auto;font-size:var(--fs-10);padding:2px 8px">✕</button>
    </div>
    <div class="panel__body" style="overflow-y:auto;max-height:500px">

      <div class="left-rail__section-title" style="margin-bottom:6px">AUTONOMOUS WATCH</div>
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">
        <label style="color:var(--text-lo);font-size:var(--fs-11)">
          <input type="checkbox" id="wo-enabled" style="margin-right:4px">
          Enable watch-officer
        </label>
        <label style="color:var(--text-lo);font-size:var(--fs-11)">
          <input type="checkbox" id="wo-ai" style="margin-right:4px" checked>
          AI brief
        </label>
      </div>
      <div style="display:flex;gap:6px;margin-bottom:8px;flex-wrap:wrap">
        <select id="wo-severity" class="cmd-palette__input" style="width:120px;font-size:var(--fs-10);padding:3px 6px;height:26px">
          <option value="low">Min: LOW</option>
          <option value="medium">Min: MEDIUM</option>
          <option value="high" selected>Min: HIGH</option>
          <option value="critical">Min: CRITICAL</option>
        </select>
        <select id="wo-interval" class="cmd-palette__input" style="width:130px;font-size:var(--fs-10);padding:3px 6px;height:26px">
          <option value="60000">Every 1 min</option>
          <option value="300000" selected>Every 5 min</option>
          <option value="600000">Every 10 min</option>
          <option value="1800000">Every 30 min</option>
        </select>
        <button id="wo-save-btn" class="topbar__mode" style="font-size:var(--fs-10);padding:3px 10px">APPLY</button>
      </div>
      <div id="wo-status" style="color:var(--text-lo);font-size:var(--fs-10);margin-bottom:10px"></div>

      <div class="left-rail__section-title" style="margin-bottom:6px">AOI WATCHES</div>
      <div style="font-size:var(--fs-10);color:var(--text-lo);margin-bottom:6px">
        Define bounding-box watch areas. Alerts fire when entities enter.
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:4px;margin-bottom:4px">
        <input id="wo-aoi-lat1" class="cmd-palette__input" placeholder="Lat1 (SW)" style="font-size:var(--fs-10);padding:3px 6px;height:24px">
        <input id="wo-aoi-lng1" class="cmd-palette__input" placeholder="Lng1 (SW)" style="font-size:var(--fs-10);padding:3px 6px;height:24px">
        <input id="wo-aoi-lat2" class="cmd-palette__input" placeholder="Lat2 (NE)" style="font-size:var(--fs-10);padding:3px 6px;height:24px">
        <input id="wo-aoi-lng2" class="cmd-palette__input" placeholder="Lng2 (NE)" style="font-size:var(--fs-10);padding:3px 6px;height:24px">
      </div>
      <div style="display:flex;gap:6px;margin-bottom:8px">
        <input id="wo-aoi-label" class="cmd-palette__input" placeholder="Watch area label"
          style="flex:1;font-size:var(--fs-10);padding:3px 6px;height:24px">
        <button id="wo-aoi-add-btn" class="topbar__mode" style="font-size:var(--fs-10);padding:3px 10px">ADD</button>
      </div>
      <div id="wo-aoi-list" style="font-size:var(--fs-11)"></div>

      <div class="left-rail__section-title" style="margin:10px 0 6px">RECENT ALERTS</div>
      <div id="wo-alert-log" style="font-size:var(--fs-10);color:var(--text-lo);max-height:120px;overflow-y:auto"></div>
    </div>
  `;
  return el;
}

async function loadConfig() {
  try {
    const res = await fetch('/api/agent/watch-officer');
    if (!res.ok) return;
    const cfg = await res.json() as WOConfig;
    const cb = document.getElementById('wo-enabled') as HTMLInputElement | null;
    const ai = document.getElementById('wo-ai') as HTMLInputElement | null;
    const sev = document.getElementById('wo-severity') as HTMLSelectElement | null;
    const ivl = document.getElementById('wo-interval') as HTMLSelectElement | null;
    if (cb) cb.checked = cfg.enabled;
    if (ai) ai.checked = cfg.aiEnabled;
    if (sev) sev.value = cfg.minSeverity;
    if (ivl) ivl.value = String(cfg.intervalMs);
    updateStatus(cfg);
  } catch { /* silent */ }
}

function updateStatus(cfg: WOConfig) {
  const el = document.getElementById('wo-status');
  if (!el) return;
  el.textContent = cfg.enabled
    ? `ACTIVE — scanning every ${cfg.intervalMs / 60000} min, severity ≥ ${cfg.minSeverity.toUpperCase()}`
    : 'INACTIVE';
  el.style.color = cfg.enabled ? 'var(--signal-green, #4caf50)' : 'var(--text-lo)';
}

async function saveConfig() {
  const enabled = (document.getElementById('wo-enabled') as HTMLInputElement | null)?.checked ?? false;
  const aiEnabled = (document.getElementById('wo-ai') as HTMLInputElement | null)?.checked ?? true;
  const minSeverity = (document.getElementById('wo-severity') as HTMLSelectElement | null)?.value ?? 'high';
  const intervalMs = parseInt((document.getElementById('wo-interval') as HTMLSelectElement | null)?.value ?? '300000', 10);
  try {
    const res = await fetch('/api/agent/watch-officer', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled, aiEnabled, minSeverity, intervalMs }),
    });
    if (res.ok) updateStatus(await res.json() as WOConfig);
  } catch { /* silent */ }
}

async function loadWatches() {
  const listEl = document.getElementById('wo-aoi-list');
  if (!listEl) return;
  try {
    const res = await fetch('/api/agent/watches');
    if (!res.ok) return;
    const { watches } = await res.json() as { watches: WatchArea[] };
    if (!watches.length) {
      listEl.innerHTML = '<div style="color:var(--text-lo);font-size:var(--fs-10)">No watch areas defined.</div>';
      return;
    }
    listEl.innerHTML = watches.map(w => `
      <div style="display:flex;justify-content:space-between;align-items:center;
        padding:3px 0;border-bottom:1px solid var(--line-hair)">
        <span style="color:var(--text-hi)">${w.label}</span>
        <span style="color:var(--text-lo);font-size:var(--fs-10)">${w.hitCount} hits</span>
        <button data-watch-id="${w.id}" class="wo-delete-btn topbar__mode"
          style="font-size:var(--fs-10);padding:1px 6px">✕</button>
      </div>`).join('');
    listEl.querySelectorAll('.wo-delete-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = (btn as HTMLElement).dataset['watchId'];
        await fetch(`/api/agent/watches/${id}`, { method: 'DELETE' });
        loadWatches();
      });
    });
  } catch { /* silent */ }
}

async function addWatch() {
  const lat1 = parseFloat((document.getElementById('wo-aoi-lat1') as HTMLInputElement).value);
  const lng1 = parseFloat((document.getElementById('wo-aoi-lng1') as HTMLInputElement).value);
  const lat2 = parseFloat((document.getElementById('wo-aoi-lat2') as HTMLInputElement).value);
  const lng2 = parseFloat((document.getElementById('wo-aoi-lng2') as HTMLInputElement).value);
  const label = (document.getElementById('wo-aoi-label') as HTMLInputElement).value.trim();
  if ([lat1, lng1, lat2, lng2].some(isNaN) || !label) return;

  try {
    await fetch('/api/agent/watches', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lat1, lng1, lat2, lng2, label }),
    });
    // Clear inputs
    ['wo-aoi-lat1','wo-aoi-lng1','wo-aoi-lat2','wo-aoi-lng2','wo-aoi-label'].forEach(id => {
      const el = document.getElementById(id) as HTMLInputElement | null;
      if (el) el.value = '';
    });
    loadWatches();
  } catch { /* silent */ }
}

function appendAlert(text: string) {
  const log = document.getElementById('wo-alert-log');
  if (!log) return;
  const line = document.createElement('div');
  line.style.cssText = 'padding:2px 0;border-bottom:1px solid var(--line-hair);color:var(--signal-yellow,#e5a100)';
  line.textContent = `[${new Date().toISOString().slice(11, 19)}Z] ${text}`;
  log.prepend(line);
  // Keep last 20
  while (log.children.length > 20) log.lastChild?.remove();
}

export function initWatchOfficer() {
  if (!document.getElementById('wo-style')) {
    const s = document.createElement('style');
    s.id = 'wo-style';
    s.textContent = `
      .watch-officer-panel {
        position:fixed; right:16px; top:48px; width:360px; z-index:200;
        max-height:calc(100vh - 96px); overflow:hidden;
      }
      .watch-officer-panel.hidden { display:none; }
    `;
    document.head.appendChild(s);
  }

  panelEl = buildPanel();
  document.body.appendChild(panelEl);

  document.getElementById('wo-close-btn')?.addEventListener('click', hideWatchOfficer);
  document.getElementById('wo-save-btn')?.addEventListener('click', saveConfig);
  document.getElementById('wo-aoi-add-btn')?.addEventListener('click', addWatch);

  // Listen for watch-officer alerts from agent-client
  DataBus.on('agent:command', (payload) => {
    const p = payload as { command: string; params: Record<string, unknown> };
    if (p.command === 'watch_officer_alert') {
      appendAlert(String(p.params['summary'] ?? ''));
    }
    if (p.command === 'aoi_alert') {
      appendAlert(`AOI [${p.params['watchLabel']}]: ${p.params['label']} (${p.params['layer']})`);
    }
  });
}

export function showWatchOfficer() {
  panelEl?.classList.remove('hidden');
  loadConfig();
  loadWatches();
}

export function hideWatchOfficer() {
  panelEl?.classList.add('hidden');
}

export function toggleWatchOfficer() {
  if (panelEl?.classList.contains('hidden')) showWatchOfficer();
  else hideWatchOfficer();
}
