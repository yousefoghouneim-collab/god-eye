/**
 * SAR Ground-Change Watch Areas Panel.
 * Operator-defined AOIs → Sentinel-1 scene catalog via ASF Search (free, no key).
 * Mode B (NASA OPERA deformation) activates when EARTHDATA_TOKEN is set in .env.
 */

let panelEl: HTMLElement | null = null;
let sarStatus: SarStatus | null = null;

interface SarAoi {
  id: string;
  name: string;
  description: string;
  center_lat: number;
  center_lon: number;
  radius_km: number;
  category: string;
}

interface SarScene {
  scene_id: string;
  date: string;
  lat: number;
  lon: number;
  orbit_direction: string;
  browse_url: string;
  distance_km?: number;
}

interface SarStatus {
  mode_a: { enabled: boolean };
  mode_b: { enabled: boolean; signup_url: string };
  copernicus: { enabled: boolean };
  aoi_count: number;
  help: string[] | null;
}

// ── Build panel ───────────────────────────────────────────────────────────────

function buildPanel(): HTMLElement {
  const el = document.createElement('div');
  el.id = 'sar-panel';
  el.className = 'panel panel--bracketed sar-panel hidden';
  el.innerHTML = `
    <span class="panel__bracket-bl"></span>
    <span class="panel__bracket-br"></span>
    <div class="panel__title">
      SAR WATCH AREAS
      <button class="topbar__mode" id="sar-close-btn"
        style="margin-left:auto;font-size:var(--fs-10);padding:2px 8px">✕</button>
    </div>
    <div class="panel__body" style="overflow-y:auto;max-height:calc(100vh - 120px)">

      <!-- Status bar -->
      <div id="sar-status-bar" style="margin-bottom:10px;padding:6px 8px;background:var(--bg-panel-hi);border:1px solid var(--line-hair)">
        <span class="hud-label">Loading SAR status...</span>
      </div>

      <!-- AOI Editor -->
      <div style="margin-bottom:10px">
        <div class="hud-label" style="margin-bottom:6px">ADD WATCH AREA</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:4px;margin-bottom:4px">
          <input id="sar-aoi-name" class="cmd-palette__input"
            style="font-size:var(--fs-11);padding:3px 6px;height:26px"
            placeholder="Name (e.g. Strait of Hormuz)" type="text">
          <input id="sar-aoi-id" class="cmd-palette__input"
            style="font-size:var(--fs-11);padding:3px 6px;height:26px"
            placeholder="ID (e.g. hormuz)" type="text">
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:4px;margin-bottom:4px">
          <input id="sar-aoi-lat" class="cmd-palette__input"
            style="font-size:var(--fs-11);padding:3px 6px;height:26px"
            placeholder="Center lat" type="number" step="0.0001">
          <input id="sar-aoi-lon" class="cmd-palette__input"
            style="font-size:var(--fs-11);padding:3px 6px;height:26px"
            placeholder="Center lon" type="number" step="0.0001">
          <input id="sar-aoi-radius" class="cmd-palette__input"
            style="font-size:var(--fs-11);padding:3px 6px;height:26px"
            placeholder="Radius km" type="number" value="50" min="1" max="500">
        </div>
        <button id="sar-aoi-add-btn" class="topbar__mode"
          style="width:100%;padding:4px;font-size:var(--fs-10)">ADD AOI</button>
      </div>

      <!-- AOI List -->
      <div class="hud-label" style="margin-bottom:4px">WATCH AREAS</div>
      <div id="sar-aoi-list" style="margin-bottom:12px;font-size:var(--fs-11)">
        <p style="color:var(--text-lo)">No watch areas defined.</p>
      </div>

      <!-- Scene Query -->
      <div style="display:flex;gap:4px;margin-bottom:8px">
        <button id="sar-scenes-btn" class="topbar__mode"
          style="flex:1;padding:4px;font-size:var(--fs-10)">QUERY SCENES</button>
        <button id="sar-near-btn" class="topbar__mode"
          style="flex:1;padding:4px;font-size:var(--fs-10)">NEAR CURSOR</button>
      </div>

      <!-- Scene Results -->
      <div class="hud-label" style="margin-bottom:4px">SENTINEL-1 SCENES</div>
      <div id="sar-scenes-list" style="font-size:var(--fs-11)">
        <p style="color:var(--text-lo)">Click QUERY SCENES to load catalog.</p>
      </div>
    </div>
  `;
  return el;
}

// ── Render helpers ────────────────────────────────────────────────────────────

function renderStatusBar(status: SarStatus) {
  const bar = document.getElementById('sar-status-bar');
  if (!bar) return;
  const modeColor = (on: boolean) => on ? 'var(--signal-green)' : 'var(--signal-amber)';
  bar.innerHTML = `
    <div style="display:flex;gap:12px;flex-wrap:wrap">
      <span class="telemetry" style="color:${modeColor(status.mode_a.enabled)}">
        MODE A ${status.mode_a.enabled ? '● ACTIVE' : '○ OFF'}
      </span>
      <span class="telemetry" style="color:${modeColor(status.mode_b.enabled)}">
        MODE B ${status.mode_b.enabled ? '● ACTIVE' : '○ OFF'}
      </span>
      <span class="hud-label">${status.aoi_count} AOI${status.aoi_count !== 1 ? 's' : ''}</span>
    </div>
    ${status.help ? `<div style="margin-top:6px;color:var(--text-lo);font-size:var(--fs-10)">
      Mode B: <a href="${status.mode_b.signup_url}" target="_blank"
        style="color:var(--signal-amber)">Get free Earthdata token</a>
      → set EARTHDATA_TOKEN in .env
    </div>` : ''}
  `;
}

function renderAoiList(aois: SarAoi[]) {
  const el = document.getElementById('sar-aoi-list');
  if (!el) return;
  if (!aois.length) {
    el.innerHTML = '<p style="color:var(--text-lo)">No watch areas defined.</p>';
    return;
  }
  el.innerHTML = aois.map(a => `
    <div style="padding:4px 0;border-bottom:1px solid var(--line-hair);display:flex;justify-content:space-between;align-items:flex-start">
      <div>
        <span style="color:var(--text-hi);font-weight:600">${a.name}</span>
        <span class="hud-label" style="margin-left:6px">${a.category.toUpperCase()}</span>
        <div style="color:var(--text-lo);font-size:var(--fs-10)">
          ${a.center_lat.toFixed(3)}, ${a.center_lon.toFixed(3)} · r=${a.radius_km}km
        </div>
      </div>
      <button class="topbar__mode sar-del-aoi" data-id="${a.id}"
        style="font-size:var(--fs-10);padding:1px 6px">✕</button>
    </div>
  `).join('');
  el.querySelectorAll<HTMLButtonElement>('.sar-del-aoi').forEach(btn => {
    btn.addEventListener('click', async () => {
      await fetch(`/osint/sar/aois/${btn.dataset['id']}`, { method: 'DELETE' });
      await refreshAois();
    });
  });
}

function renderScenes(scenes: SarScene[]) {
  const el = document.getElementById('sar-scenes-list');
  if (!el) return;
  if (!scenes.length) {
    el.innerHTML = '<p style="color:var(--text-lo)">No scenes found.</p>';
    return;
  }
  el.innerHTML = scenes.slice(0, 30).map(s => {
    const date = s.date ? s.date.slice(0, 10) : '—';
    const dist = s.distance_km != null ? ` · ${s.distance_km}km` : '';
    return `
      <div style="padding:3px 0;border-bottom:1px solid var(--line-hair)">
        <div style="display:flex;justify-content:space-between">
          <span class="telemetry" style="color:var(--signal-green);font-size:var(--fs-10)">${date}</span>
          <span style="color:var(--text-lo);font-size:var(--fs-10)">${s.orbit_direction}${dist}</span>
        </div>
        <div style="color:var(--text-lo);font-size:var(--fs-10);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">
          ${s.scene_id || '—'}
          ${s.browse_url ? `<a href="${s.browse_url}" target="_blank" style="color:var(--signal-amber);margin-left:6px">preview</a>` : ''}
        </div>
      </div>
    `;
  }).join('');
}

// ── Data fetchers ─────────────────────────────────────────────────────────────

async function refreshAois() {
  try {
    const res = await fetch('/osint/sar/aois');
    if (res.ok) {
      const data = await res.json() as { aois: SarAoi[] };
      renderAoiList(data.aois);
    }
  } catch { /* osint service may not be up */ }
}

async function loadStatus() {
  try {
    const res = await fetch('/osint/sar/status');
    if (res.ok) {
      sarStatus = await res.json() as SarStatus;
      renderStatusBar(sarStatus);
    }
  } catch { /* osint service may not be up */ }
}

async function queryScenes(aoiId?: string) {
  const btn = document.getElementById('sar-scenes-btn');
  if (btn) btn.textContent = '...';
  try {
    const url = aoiId ? `/osint/sar/scenes?aoi_id=${encodeURIComponent(aoiId)}` : '/osint/sar/scenes';
    const res = await fetch(url);
    if (res.ok) {
      const data = await res.json() as { scenes: SarScene[] };
      renderScenes(data.scenes);
    }
  } catch {
    const el = document.getElementById('sar-scenes-list');
    if (el) el.innerHTML = '<p style="color:var(--signal-red)">OSINT service offline.</p>';
  } finally {
    if (btn) btn.textContent = 'QUERY SCENES';
  }
}

async function queryNear() {
  const btn = document.getElementById('sar-near-btn');
  if (btn) btn.textContent = '...';
  // Get last known cursor lat/lng from globe
  const globeApi = (window as unknown as Record<string, unknown>)['globeApi'] as
    { getCamera?: () => { lat: number; lng: number } } | undefined;
  const cam = globeApi?.getCamera?.();
  if (!cam) {
    const el = document.getElementById('sar-scenes-list');
    if (el) el.innerHTML = '<p style="color:var(--signal-amber)">No camera position available. Fly to a location first.</p>';
    if (btn) btn.textContent = 'NEAR CURSOR';
    return;
  }
  try {
    const res = await fetch(`/osint/sar/near?lat=${cam.lat}&lng=${cam.lng}&radius_km=200`);
    if (res.ok) {
      const data = await res.json() as { scenes: SarScene[] };
      renderScenes(data.scenes);
    }
  } catch { /* ignore */ } finally {
    if (btn) btn.textContent = 'NEAR CURSOR';
  }
}

// ── Init ──────────────────────────────────────────────────────────────────────

export function initSarPanel() {
  if (!document.getElementById('sar-panel-style')) {
    const s = document.createElement('style');
    s.id = 'sar-panel-style';
    s.textContent = `
      .sar-panel {
        position:fixed; right:16px; top:48px; width:360px; z-index:200;
        max-height:calc(100vh - 64px);
      }
      .sar-panel.hidden { display:none; }
    `;
    document.head.appendChild(s);
  }

  panelEl = buildPanel();
  document.body.appendChild(panelEl);

  document.getElementById('sar-close-btn')?.addEventListener('click', hideSarPanel);

  document.getElementById('sar-aoi-add-btn')?.addEventListener('click', async () => {
    const nameEl = document.getElementById('sar-aoi-name') as HTMLInputElement;
    const idEl = document.getElementById('sar-aoi-id') as HTMLInputElement;
    const latEl = document.getElementById('sar-aoi-lat') as HTMLInputElement;
    const lonEl = document.getElementById('sar-aoi-lon') as HTMLInputElement;
    const rEl = document.getElementById('sar-aoi-radius') as HTMLInputElement;

    const name = nameEl?.value.trim();
    const id = idEl?.value.trim() || name?.toLowerCase().replace(/\W+/g, '-') || `aoi-${Date.now()}`;
    const lat = parseFloat(latEl?.value || '0');
    const lon = parseFloat(lonEl?.value || '0');
    const radius = parseFloat(rEl?.value || '50');

    if (!name || isNaN(lat) || isNaN(lon)) return;

    try {
      await fetch('/osint/sar/aois', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, name, center_lat: lat, center_lon: lon, radius_km: radius }),
      });
      if (nameEl) nameEl.value = '';
      if (idEl) idEl.value = '';
      if (latEl) latEl.value = '';
      if (lonEl) lonEl.value = '';
      await refreshAois();
    } catch { /* osint offline */ }
  });

  document.getElementById('sar-scenes-btn')?.addEventListener('click', () => queryScenes());
  document.getElementById('sar-near-btn')?.addEventListener('click', () => queryNear());
}

export function showSarPanel() {
  panelEl?.classList.remove('hidden');
  loadStatus();
  refreshAois();
}

export function hideSarPanel() {
  panelEl?.classList.add('hidden');
}

export function toggleSarPanel() {
  if (panelEl?.classList.contains('hidden')) showSarPanel();
  else hideSarPanel();
}
