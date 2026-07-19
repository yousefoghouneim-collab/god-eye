/**
 * Radio Intercept Panel — KiwiSDR shortwave receivers + OpenMHZ scanner feeds.
 * All API calls proxied server-side through the OSINT service.
 * Opt-in panel; audio playback is best-effort (HLS/MP3 from OpenMHZ CDN).
 */

import { DataBus } from '../bus/data-bus.js';

let panelEl: HTMLElement | null = null;
let activeSysName = '';
let countryFilter = '';

interface KiwiNode {
  id: string;
  name: string;
  lat: number;
  lon: number;
  url: string;
  users: number;
  users_max: number;
  snr: number | null;
}

interface OpenMhzSystem {
  sys_name: string;
  name: string;
  city: string;
  state: string;
  country: string;
  lat: number;
  lon: number;
  num_calls: number;
  distance_km?: number;
}

interface OpenMhzCall {
  id: string;
  time: string;
  talkgroup_description: string;
  call_length: number;
  audio_url: string;
  emergency: boolean;
}

// ── Build panel ───────────────────────────────────────────────────────────────

function buildPanel(): HTMLElement {
  const el = document.createElement('div');
  el.id = 'radio-panel';
  el.className = 'panel panel--bracketed radio-panel hidden';
  el.innerHTML = `
    <span class="panel__bracket-bl"></span>
    <span class="panel__bracket-br"></span>
    <div class="panel__title">
      RADIO INTERCEPT
      <button class="topbar__mode" id="radio-close-btn"
        style="margin-left:auto;font-size:var(--fs-10);padding:2px 8px">✕</button>
    </div>
    <div class="panel__body" style="overflow-y:auto;max-height:calc(100vh - 120px)">

      <!-- Tabs -->
      <div style="display:flex;gap:4px;margin-bottom:10px">
        <button id="radio-tab-kiwi" class="topbar__mode topbar__mode--active"
          style="flex:1;font-size:var(--fs-10);padding:3px">KIWISDR</button>
        <button id="radio-tab-scanner" class="topbar__mode"
          style="flex:1;font-size:var(--fs-10);padding:3px">SCANNER</button>
      </div>

      <!-- KiwiSDR tab -->
      <div id="radio-kiwi-tab">
        <div style="display:flex;gap:4px;margin-bottom:6px">
          <button id="radio-kiwi-load-btn" class="topbar__mode"
            style="flex:1;font-size:var(--fs-10);padding:3px">LOAD NODES</button>
          <button id="radio-kiwi-near-btn" class="topbar__mode"
            style="flex:1;font-size:var(--fs-10);padding:3px">NEAR CURSOR</button>
        </div>
        <div id="radio-kiwi-list" style="font-size:var(--fs-11)">
          <p style="color:var(--text-lo)">Click LOAD NODES to list public KiwiSDR receivers.</p>
        </div>
      </div>

      <!-- Scanner tab (hidden initially) -->
      <div id="radio-scanner-tab" style="display:none">
        <div style="display:flex;gap:4px;margin-bottom:6px">
          <button id="radio-scanner-load-btn" class="topbar__mode"
            style="flex:1;font-size:var(--fs-10);padding:3px">LOAD SYSTEMS</button>
          <button id="radio-scanner-near-btn" class="topbar__mode"
            style="flex:1;font-size:var(--fs-10);padding:3px">NEAR CURSOR</button>
        </div>
        <div id="radio-scanner-list" style="margin-bottom:10px;font-size:var(--fs-11)">
          <p style="color:var(--text-lo)">Click LOAD SYSTEMS to list scanner feeds.</p>
        </div>
        <div id="radio-calls-section" style="display:none">
          <div class="hud-label" style="margin-bottom:4px">RECENT CALLS — <span id="radio-sys-label"></span></div>
          <div id="radio-calls-list" style="font-size:var(--fs-11)"></div>
          <!-- Audio player -->
          <audio id="radio-audio-player" controls
            style="width:100%;height:32px;margin-top:6px;display:none;filter:invert(0.8) hue-rotate(160deg)">
          </audio>
        </div>
      </div>

    </div>
  `;
  return el;
}

// ── Render helpers ────────────────────────────────────────────────────────────

function renderKiwiNodes(nodes: KiwiNode[], filter?: string) {
  const el = document.getElementById('radio-kiwi-list');
  if (!el) return;
  const filtered = filter
    ? nodes.filter(n => (n.name || '').toLowerCase().includes(filter.toLowerCase()))
    : nodes;
  if (!filtered.length) {
    el.innerHTML = `<p style="color:var(--text-lo)">${filter ? `No radio stations available for ${filter}.` : 'No KiwiSDR nodes found.'}</p>`;
    return;
  }
  const nodes2 = filtered;
  el.innerHTML = nodes2.slice(0, 50).map(n => {
    const load = n.users_max > 0 ? Math.round((n.users / n.users_max) * 100) : 0;
    const loadColor = load > 80 ? 'var(--signal-red)' : load > 50 ? 'var(--signal-amber)' : 'var(--signal-green)';
    const url = n.url.startsWith('http') ? n.url : `http://${n.url}`;
    return `
      <div style="padding:3px 0;border-bottom:1px solid var(--line-hair)">
        <div style="display:flex;justify-content:space-between;align-items:center">
          <span style="color:var(--text-hi)">${n.name || n.id || '—'}</span>
          <span class="telemetry" style="color:${loadColor};font-size:var(--fs-10)">${n.users}/${n.users_max}</span>
        </div>
        <div style="color:var(--text-lo);font-size:var(--fs-10)">
          ${n.lat.toFixed(2)}, ${n.lon.toFixed(2)}
          ${n.snr != null ? ` · SNR ${n.snr}dB` : ''}
          <a href="${url}" target="_blank" rel="noopener noreferrer"
            style="color:var(--signal-amber);margin-left:6px">OPEN</a>
        </div>
      </div>`;
  }).join('');
}

function renderScannerSystems(systems: OpenMhzSystem[]) {
  const el = document.getElementById('radio-scanner-list');
  if (!el) return;
  if (!systems.length) {
    el.innerHTML = '<p style="color:var(--text-lo)">No scanner systems found.</p>';
    return;
  }
  el.innerHTML = systems.slice(0, 30).map(s => {
    const dist = s.distance_km != null ? ` · ${s.distance_km}km` : '';
    return `
      <div style="padding:3px 0;border-bottom:1px solid var(--line-hair)">
        <div style="display:flex;justify-content:space-between;align-items:center">
          <span style="color:var(--text-hi);cursor:pointer" class="scanner-sys-link"
            data-sys="${s.sys_name}">${s.name || s.sys_name}</span>
          <span class="telemetry" style="color:var(--signal-green);font-size:var(--fs-10)">${s.num_calls} calls</span>
        </div>
        <div style="color:var(--text-lo);font-size:var(--fs-10)">
          ${s.city ? s.city + ', ' : ''}${s.state || s.country}${dist}
        </div>
      </div>`;
  }).join('');

  el.querySelectorAll<HTMLElement>('.scanner-sys-link').forEach(link => {
    link.addEventListener('click', () => {
      activeSysName = link.dataset['sys'] ?? '';
      loadCalls(activeSysName);
    });
  });
}

function renderCalls(calls: OpenMhzCall[]) {
  const el = document.getElementById('radio-calls-list');
  const section = document.getElementById('radio-calls-section');
  if (!el || !section) return;
  section.style.display = 'block';
  const sysLabel = document.getElementById('radio-sys-label');
  if (sysLabel) sysLabel.textContent = activeSysName.toUpperCase();

  if (!calls.length) {
    el.innerHTML = '<p style="color:var(--text-lo)">No recent calls.</p>';
    return;
  }
  el.innerHTML = calls.map(c => {
    const t = c.time ? new Date(c.time).toISOString().slice(11, 19) + 'Z' : '—';
    const emColor = c.emergency ? 'var(--signal-red)' : 'var(--text-hi)';
    return `
      <div style="padding:3px 0;border-bottom:1px solid var(--line-hair);display:flex;justify-content:space-between;align-items:center">
        <div>
          <span style="color:${emColor};font-size:var(--fs-11)">${c.talkgroup_description || c.id || '—'}</span>
          ${c.emergency ? ' <span style="color:var(--signal-red);font-size:var(--fs-10)">EMERG</span>' : ''}
          <div style="color:var(--text-lo);font-size:var(--fs-10)">${t} · ${c.call_length}s</div>
        </div>
        ${c.audio_url ? `<button class="topbar__mode play-call-btn" data-url="${c.audio_url}"
          style="font-size:var(--fs-10);padding:1px 6px">▶</button>` : ''}
      </div>`;
  }).join('');

  el.querySelectorAll<HTMLButtonElement>('.play-call-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const player = document.getElementById('radio-audio-player') as HTMLAudioElement | null;
      if (!player) return;
      player.src = `/osint/radio/openmhz/audio?url=${encodeURIComponent(btn.dataset['url'] ?? '')}`;
      player.style.display = 'block';
      player.play().catch(() => { /* user gesture required in some browsers */ });
    });
  });
}

// ── Data loaders ──────────────────────────────────────────────────────────────

async function loadKiwiNodes(nearLat?: number, nearLon?: number, country?: string) {
  const btn = document.getElementById('radio-kiwi-load-btn');
  if (btn) btn.textContent = '...';
  try {
    const res = await fetch('/osint/radio/kiwisdr');
    if (res.ok) {
      const data = await res.json() as { nodes: KiwiNode[] };
      let nodes = data.nodes;
      // If near coords provided, sort by distance
      if (nearLat != null && nearLon != null) {
        nodes = nodes
          .map(n => ({ ...n, _d: Math.hypot(n.lat - nearLat, n.lon - nearLon) }))
          .sort((a, b) => a._d - b._d);
      }
      renderKiwiNodes(nodes, country ?? (countryFilter || undefined));
    }
  } catch {
    const el = document.getElementById('radio-kiwi-list');
    if (el) el.innerHTML = '<p style="color:var(--signal-red)">OSINT service offline.</p>';
  } finally {
    if (btn) btn.textContent = 'LOAD NODES';
  }
}

async function loadScannerSystems(nearLat?: number, nearLon?: number) {
  const btn = document.getElementById('radio-scanner-load-btn');
  if (btn) btn.textContent = '...';
  try {
    const url = nearLat != null && nearLon != null
      ? `/osint/radio/nearest?lat=${nearLat}&lng=${nearLon}&limit=20`
      : '/osint/radio/openmhz/systems';
    const res = await fetch(url);
    if (res.ok) {
      const data = await res.json() as { systems: OpenMhzSystem[] };
      renderScannerSystems(data.systems);
    }
  } catch {
    const el = document.getElementById('radio-scanner-list');
    if (el) el.innerHTML = '<p style="color:var(--signal-red)">OSINT service offline.</p>';
  } finally {
    if (btn) btn.textContent = 'LOAD SYSTEMS';
  }
}

async function loadCalls(sysName: string) {
  const el = document.getElementById('radio-calls-list');
  if (el) el.innerHTML = '<p style="color:var(--signal-amber)">Loading...</p>';
  const section = document.getElementById('radio-calls-section');
  if (section) section.style.display = 'block';
  const sysLabel = document.getElementById('radio-sys-label');
  if (sysLabel) sysLabel.textContent = sysName.toUpperCase();
  try {
    const res = await fetch(`/osint/radio/openmhz/calls/${encodeURIComponent(sysName)}`);
    if (res.ok) {
      const data = await res.json() as { calls: OpenMhzCall[] };
      renderCalls(data.calls);
    }
  } catch { /* ignore */ }
}

function getCameraPosition() {
  const globeApi = (window as unknown as Record<string, unknown>)['globeApi'] as
    { getCamera?: () => { lat: number; lng: number } } | undefined;
  return globeApi?.getCamera?.();
}

// ── Tab switching ─────────────────────────────────────────────────────────────

function switchTab(tab: 'kiwi' | 'scanner') {
  const kiwiTab = document.getElementById('radio-kiwi-tab');
  const scannerTab = document.getElementById('radio-scanner-tab');
  const kiwiBtn = document.getElementById('radio-tab-kiwi');
  const scannerBtn = document.getElementById('radio-tab-scanner');
  if (tab === 'kiwi') {
    if (kiwiTab) kiwiTab.style.display = 'block';
    if (scannerTab) scannerTab.style.display = 'none';
    kiwiBtn?.classList.add('topbar__mode--active');
    scannerBtn?.classList.remove('topbar__mode--active');
  } else {
    if (kiwiTab) kiwiTab.style.display = 'none';
    if (scannerTab) scannerTab.style.display = 'block';
    kiwiBtn?.classList.remove('topbar__mode--active');
    scannerBtn?.classList.add('topbar__mode--active');
  }
}

// ── Init ──────────────────────────────────────────────────────────────────────

export function initRadioPanel() {
  if (!document.getElementById('radio-panel-style')) {
    const s = document.createElement('style');
    s.id = 'radio-panel-style';
    s.textContent = `
      .radio-panel {
        position:fixed; left:16px; bottom:48px; width:360px; z-index:200;
        max-height:calc(100vh - 100px);
      }
      .radio-panel.hidden { display:none; }
    `;
    document.head.appendChild(s);
  }

  panelEl = buildPanel();
  document.body.appendChild(panelEl);

  document.getElementById('radio-close-btn')?.addEventListener('click', hideRadioPanel);

  // Country filter from globe right-click
  DataBus.on('radio:filter-country', (payload) => {
    const { country } = payload as { country: string };
    countryFilter = country;
    showRadioPanel();
    switchTab('kiwi');
    loadKiwiNodes(undefined, undefined, country);
  });
  document.getElementById('radio-tab-kiwi')?.addEventListener('click', () => switchTab('kiwi'));
  document.getElementById('radio-tab-scanner')?.addEventListener('click', () => switchTab('scanner'));

  document.getElementById('radio-kiwi-load-btn')?.addEventListener('click', () => loadKiwiNodes());
  document.getElementById('radio-kiwi-near-btn')?.addEventListener('click', () => {
    const cam = getCameraPosition();
    if (cam) loadKiwiNodes(cam.lat, cam.lng);
  });

  document.getElementById('radio-scanner-load-btn')?.addEventListener('click', () => loadScannerSystems());
  document.getElementById('radio-scanner-near-btn')?.addEventListener('click', () => {
    const cam = getCameraPosition();
    if (cam) loadScannerSystems(cam.lat, cam.lng);
  });
}

export function showRadioPanel() { panelEl?.classList.remove('hidden'); }
export function hideRadioPanel() { panelEl?.classList.add('hidden'); }
export function toggleRadioPanel() {
  if (panelEl?.classList.contains('hidden')) showRadioPanel();
  else hideRadioPanel();
}
