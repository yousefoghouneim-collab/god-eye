import { render } from 'preact';
import { App } from './hud/App';
import { createGlobeView } from './globe/GlobeView';
import type { GlobeApi } from './globe/GlobeView';
import type { VisualMode } from '@god-eye/shared';
import { initWsClient } from './bus/ws-client';
import { initLayerState, fetchInitialData } from './layers/layer-state';
import { initGlobeRenderer } from './layers/globe-renderer';
import { initDossier } from './hud/dossier';
import { initCommandPalette, setGlobeApiForPalette } from './hud/command-palette';
import { initAIIntel } from './hud/ai-intel';
import { initReconPanel, toggleReconPanel } from './hud/recon-panel';
import { initEntityPanel, toggleEntityPanel } from './hud/entity-panel';
import { initMarketsPanel, toggleMarketsPanel } from './hud/markets-panel';
import { initIntelPanel, toggleIntelPanel } from './hud/intel-panel';
import { initAgentClient, setGlobeApiForAgent } from './bus/agent-client';
import { DataBus } from './bus/data-bus';
import { initWatchOfficer, toggleWatchOfficer } from './hud/watch-officer';
import { initPluginPanel, togglePluginPanel } from './hud/plugin-panel';
import { initTimeMachine, getTimeRange } from './hud/time-machine';
import { initPresetsPanel, togglePresetsPanel } from './hud/presets';
import { initSarPanel, toggleSarPanel } from './hud/sar-panel';
import { initRadioPanel, toggleRadioPanel } from './hud/radio-panel';
import { initCctvPanel, toggleCctvPanel } from './hud/cctv-panel';
import { initCesiumView, toggleCesiumMode, cesiumFlyTo } from './cesium/CesiumView';
import { initShortcuts, toggleShortcuts } from './hud/shortcuts-overlay';
import { initHealthPanel, toggleHealthPanel } from './hud/health-panel';
import { createFlatMapView } from './map/FlatMapView';
import type { GlobeExt } from './globe/globe-ext';
import 'maplibre-gl/dist/maplibre-gl.css';

// Visual mode persistence (apply before render to avoid flash)
const savedStyle = (localStorage.getItem('god-eye-style') ?? 'DEFAULT') as VisualMode;
document.documentElement.setAttribute('data-style', savedStyle);

const root = document.getElementById('app');
if (root) {
  render(App(), root);
}

// ─── Renderer initialization ───
let globeApi: GlobeApi | null = null;
let currentRenderer: 'globe' | 'flat' = 'globe';

function initGlobe() {
  const canvasArea = document.querySelector('.canvas-area');
  if (!canvasArea) return;

  // Remove placeholder
  const placeholder = canvasArea.querySelector('.canvas-area__placeholder');
  placeholder?.remove();

  // Create globe container
  const globeContainer = document.createElement('div');
  globeContainer.id = 'globe-container';
  globeContainer.style.cssText = 'position:absolute;inset:0;';
  canvasArea.prepend(globeContainer);

  // Create flat map container (hidden initially)
  const flatContainer = document.createElement('div');
  flatContainer.id = 'flat-map-container';
  flatContainer.style.cssText = 'position:absolute;inset:0;display:none;';
  canvasArea.appendChild(flatContainer);

  globeApi = createGlobeView(globeContainer);

  // Wire globe renderer for live layers
  initGlobeRenderer(globeApi.getGlobeInstance() as GlobeExt);

  // Init flat map (lazy — created but hidden)
  createFlatMapView(flatContainer);

  // Apply saved visual mode
  if (savedStyle !== 'DEFAULT') {
    globeApi.setVisualMode(savedStyle);
  }

  // Right-click → location dossier
  globeApi.on('contextmenu', (data) => {
    const { lat, lng } = data as { lat: number; lng: number };
    showLocationDossier(lat, lng);
  });

  // Update status
  const statusEl = document.querySelector('.topbar__dot');
  if (statusEl) statusEl.classList.add('topbar__dot--fresh');

  // Wire command palette + agent client to globe
  setGlobeApiForPalette(globeApi);
  setGlobeApiForAgent(globeApi);

  console.log('[GOD-EYE] Globe initialized. Access via window.globeApi');
}

// Init after DOM settles
requestAnimationFrame(() => requestAnimationFrame(initGlobe));

// ─── Renderer mode toggle ───
function toggleRendererMode() {
  const globeEl = document.getElementById('globe-container');
  const flatEl = document.getElementById('flat-map-container');
  if (!globeEl || !flatEl) return;

  if (currentRenderer === 'globe') {
    globeEl.style.display = 'none';
    flatEl.style.display = 'block';
    currentRenderer = 'flat';
  } else {
    flatEl.style.display = 'none';
    globeEl.style.display = 'block';
    currentRenderer = 'globe';
  }
  // Update toggle button
  const btn = document.getElementById('renderer-toggle');
  if (btn) btn.textContent = currentRenderer === 'globe' ? '3D' : '2D';
}

(window as unknown as Record<string, unknown>).toggleRendererMode = toggleRendererMode;

// ─── Location dossier (right-click) ───
async function showLocationDossier(lat: number, lng: number) {
  const panel = document.querySelector('#selection-dossier .panel__body');
  if (!panel) return;
  panel.innerHTML = `
    <div class="dossier__type">LOCATION</div>
    <div class="dossier__grid">
      <span class="hud-label">COORDINATES</span><span class="telemetry">${lat.toFixed(4)}, ${lng.toFixed(4)}</span>
      <span class="hud-label">STATUS</span><span class="telemetry">Resolving...</span>
    </div>`;

  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&zoom=5`,
      { headers: { 'User-Agent': 'GOD-EYE/0.2 (private research)' } }
    );
    if (res.ok) {
      const data = await res.json() as { display_name?: string; address?: { country?: string; state?: string; city?: string } };
      const addr = data.address ?? {};
      panel.innerHTML = `
        <div class="dossier__type">LOCATION DOSSIER</div>
        <div class="dossier__grid">
          <span class="hud-label">COORDINATES</span><span class="telemetry">${lat.toFixed(4)}, ${lng.toFixed(4)}</span>
          <span class="hud-label">COUNTRY</span><span class="telemetry">${addr.country ?? '—'}</span>
          <span class="hud-label">REGION</span><span class="telemetry">${addr.state ?? '—'}</span>
          <span class="hud-label">CITY</span><span class="telemetry">${addr.city ?? '—'}</span>
          <span class="hud-label">FULL</span><span class="telemetry" title="${data.display_name ?? ''}">${(data.display_name ?? '—').slice(0, 50)}</span>
        </div>
        <div id="dossier-imagery" style="margin-top:8px;color:var(--text-lo);font-size:var(--fs-11)">
          Loading satellite imagery...
        </div>`;
    }
  } catch {
    // Nominatim may be rate-limited
  }

  // Fetch Sentinel-2 thumbnail (non-blocking, OSINT service)
  try {
    const imgRes = await fetch(`/osint/imagery/sentinel2?lat=${lat}&lng=${lng}`);
    const imgEl = document.getElementById('dossier-imagery');
    if (imgEl && imgRes.ok) {
      const imgData = await imgRes.json() as {
        ok: boolean;
        scene?: { thumbnail_url?: string; date?: string; cloud_cover?: number; tile_name?: string };
      };
      if (imgData.ok && imgData.scene?.thumbnail_url) {
        const s = imgData.scene;
        imgEl.innerHTML = `
          <div class="hud-label" style="margin-bottom:4px">SENTINEL-2 IMAGERY</div>
          <img src="${s.thumbnail_url}" alt="Sentinel-2 preview"
            style="width:100%;border:1px solid var(--line-hair);display:block"
            onerror="this.style.display='none'" />
          <div style="color:var(--text-lo);font-size:var(--fs-10);margin-top:2px">
            ${s.date ?? '—'} · Cloud: ${s.cloud_cover != null ? s.cloud_cover.toFixed(0) + '%' : '—'} · ${s.tile_name ?? ''}
          </div>`;
      } else {
        imgEl.innerHTML = '';
      }
    } else if (imgEl) {
      imgEl.innerHTML = '';
    }
  } catch {
    const imgEl = document.getElementById('dossier-imagery');
    if (imgEl) imgEl.innerHTML = '';
  }
}

// ─── Data layer state + dossier + command palette ───
initLayerState();
initDossier();
initCommandPalette();
initAIIntel();
initReconPanel();
(window as unknown as Record<string, unknown>).toggleReconPanel = toggleReconPanel;
initEntityPanel();
(window as unknown as Record<string, unknown>).toggleEntityPanel = toggleEntityPanel;
initMarketsPanel();
(window as unknown as Record<string, unknown>).toggleMarketsPanel = toggleMarketsPanel;
initIntelPanel();
(window as unknown as Record<string, unknown>).toggleIntelPanel = toggleIntelPanel;
initTimeMachine();
(window as unknown as Record<string, unknown>).__timeMachine = { getTimeRange };
initPresetsPanel();
(window as unknown as Record<string, unknown>).togglePresetsPanel = togglePresetsPanel;
initSarPanel();
(window as unknown as Record<string, unknown>).toggleSarPanel = toggleSarPanel;
initRadioPanel();
(window as unknown as Record<string, unknown>).toggleRadioPanel = toggleRadioPanel;
initCctvPanel();
(window as unknown as Record<string, unknown>).toggleCctvPanel = toggleCctvPanel;
initShortcuts();
(window as unknown as Record<string, unknown>).toggleShortcuts = toggleShortcuts;
initHealthPanel();
(window as unknown as Record<string, unknown>).toggleHealthPanel = toggleHealthPanel;

// Expose AI brief / export for Shift+B / Shift+X hotkeys
(window as unknown as Record<string, unknown>).requestAIBrief = () => {
  document.getElementById('ai-brief-btn')?.click();
};
(window as unknown as Record<string, unknown>).exportBrief = () => {
  document.getElementById('ai-export-btn')?.click();
};

// ─── Cesium photoreal 3D mode (feature-flagged) ───
(async () => {
  try {
    const cfgRes = await fetch('/api/config');
    if (cfgRes.ok) {
      const cfg = await cfgRes.json() as { cesium?: { enabled: boolean; googleMapsKeySet: boolean } };
      const cesiumBtn = document.getElementById('cesium-toggle-btn');
      if (cfg.cesium?.enabled) {
        // Key is present — initialize Cesium lazily (CDN script injected on first toggle)
        const ok = await initCesiumView('__server_proxied__');
        if (ok) {
          (window as unknown as Record<string, unknown>).toggleCesiumMode = toggleCesiumMode;
          (window as unknown as Record<string, unknown>).cesiumFlyTo = cesiumFlyTo;
        } else if (cesiumBtn) {
          cesiumBtn.style.opacity = '0.4';
          cesiumBtn.title = 'Cesium CDN unavailable';
        }
      } else {
        // Key not set — dim button, show setup hint on hover
        if (cesiumBtn) {
          cesiumBtn.style.opacity = '0.4';
          cesiumBtn.title = 'Set GOOGLE_MAPS_API_KEY in .env to enable photoreal 3D';
          cesiumBtn.onclick = () => {
            const tickerContent = document.getElementById('ticker-content');
            if (tickerContent) {
              const hint = document.createElement('span');
              hint.textContent = ' ⚠ Set GOOGLE_MAPS_API_KEY in .env to enable Cesium photoreal 3D ';
              hint.style.color = 'var(--signal-amber)';
              tickerContent.prepend(hint);
              setTimeout(() => hint.remove(), 5000);
            }
          };
        }
      }
    }
  } catch { /* API may not be up */ }
})();
initAgentClient();

// Handle agent dossier requests
initWatchOfficer();
(window as unknown as Record<string, unknown>).toggleWatchOfficer = toggleWatchOfficer;
initPluginPanel();
(window as unknown as Record<string, unknown>).togglePluginPanel = togglePluginPanel;

DataBus.on('agent:show_dossier', (payload) => {
  const { lat, lng } = payload as { lat: number; lng: number };
  showLocationDossier(lat, lng);
});

// ─── WebSocket client ───
initWsClient();

// ─── Fetch initial data from REST API ───
fetchInitialData();

// ─── UTC clock tick ───
const clockEl = document.getElementById('utc-clock');
function updateClock() {
  if (clockEl) {
    const now = new Date();
    clockEl.textContent = now.toISOString().replace('T', ' ').slice(0, 19) + 'Z';
  }
  requestAnimationFrame(updateClock);
}
requestAnimationFrame(updateClock);

// ─── Command palette toggle ───
document.addEventListener('keydown', (e) => {
  if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
    e.preventDefault();
    const overlay = document.getElementById('cmd-palette-overlay');
    overlay?.classList.toggle('cmd-palette-overlay--open');
    const input = overlay?.querySelector('input');
    if (overlay?.classList.contains('cmd-palette-overlay--open')) {
      input?.focus();
    }
  }
  if (e.key === 'Escape') {
    document.getElementById('cmd-palette-overlay')?.classList.remove('cmd-palette-overlay--open');
  }
});

// ─── Visual mode cycling (wire to topbar button) ───
const VISUAL_MODES: VisualMode[] = ['DEFAULT', 'SATELLITE', 'FLIR', 'NVG', 'CRT', 'DOSSIER'];

(window as unknown as Record<string, unknown>).cycleVisualMode = () => {
  const current = document.documentElement.getAttribute('data-style') as VisualMode;
  const idx = VISUAL_MODES.indexOf(current);
  const next = VISUAL_MODES[(idx + 1) % VISUAL_MODES.length];
  if (globeApi) {
    globeApi.setVisualMode(next);
  } else {
    document.documentElement.setAttribute('data-style', next);
    localStorage.setItem('god-eye-style', next);
  }
  // Update button text
  const modeBtn = document.querySelector('.topbar__mode');
  if (modeBtn) modeBtn.textContent = next;
};
