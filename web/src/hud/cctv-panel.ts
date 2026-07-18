/**
 * CCTV Panel — public traffic authority cameras only.
 * Images proxied server-side through allowlisted OSINT service endpoint.
 * Opt-in. Sources: TfL London, NYC DOT, Singapore LTA, Austin TX, others.
 */

let panelEl: HTMLElement | null = null;
let cameras: CctvCamera[] = [];
let selectedId: string | null = null;
let refreshTimer: ReturnType<typeof setInterval> | null = null;

interface CctvCamera {
  id: string;
  name: string;
  city: string;
  country: string;
  lat: number;
  lon: number;
  url: string;
  source: string;
}

// ── Build panel ───────────────────────────────────────────────────────────────

function buildPanel(): HTMLElement {
  const el = document.createElement('div');
  el.id = 'cctv-panel';
  el.className = 'panel panel--bracketed cctv-panel hidden';
  el.innerHTML = `
    <span class="panel__bracket-bl"></span>
    <span class="panel__bracket-br"></span>
    <div class="panel__title">
      CCTV MONITOR
      <span class="hud-label" style="font-size:var(--fs-10);margin-left:6px;color:var(--signal-amber)">OPT-IN</span>
      <button class="topbar__mode" id="cctv-close-btn"
        style="margin-left:auto;font-size:var(--fs-10);padding:2px 8px">✕</button>
    </div>
    <div class="panel__body">

      <!-- Disclaimer -->
      <div style="margin-bottom:8px;padding:4px 6px;background:var(--bg-panel-hi);border:1px solid var(--line-hair);font-size:var(--fs-10);color:var(--text-lo)">
        Public traffic-authority cameras only. Images proxied via OSINT service.
      </div>

      <!-- Live view -->
      <div id="cctv-viewer" style="margin-bottom:10px;display:none">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">
          <span id="cctv-cam-name" class="hud-label"></span>
          <div style="display:flex;gap:4px">
            <button id="cctv-refresh-btn" class="topbar__mode"
              style="font-size:var(--fs-10);padding:1px 6px">⟳</button>
            <button id="cctv-auto-btn" class="topbar__mode"
              style="font-size:var(--fs-10);padding:1px 6px">AUTO</button>
          </div>
        </div>
        <img id="cctv-img" src="" alt="CCTV"
          style="width:100%;border:1px solid var(--line-hair);display:block;min-height:80px;background:var(--bg-panel-hi)" />
        <div id="cctv-source" style="color:var(--text-lo);font-size:var(--fs-10);margin-top:2px"></div>
      </div>

      <!-- Camera list -->
      <div class="hud-label" style="margin-bottom:4px">CAMERAS</div>
      <div id="cctv-camera-list" style="font-size:var(--fs-11)">
        <p style="color:var(--text-lo)">Loading...</p>
      </div>

    </div>
  `;
  return el;
}

// ── Render helpers ────────────────────────────────────────────────────────────

function renderCameraList() {
  const el = document.getElementById('cctv-camera-list');
  if (!el) return;
  if (!cameras.length) {
    el.innerHTML = '<p style="color:var(--text-lo)">No cameras available.</p>';
    return;
  }
  el.innerHTML = cameras.map(c => {
    const active = c.id === selectedId;
    return `
      <div style="padding:3px 0;border-bottom:1px solid var(--line-hair);display:flex;justify-content:space-between;align-items:center">
        <div>
          <span style="color:${active ? 'var(--signal-green)' : 'var(--text-hi)'}">
            ${active ? '● ' : ''}${c.name}
          </span>
          <div style="color:var(--text-lo);font-size:var(--fs-10)">${c.city} · ${c.source}</div>
        </div>
        <button class="topbar__mode cctv-view-btn" data-id="${c.id}"
          style="font-size:var(--fs-10);padding:1px 8px">${active ? 'LIVE' : 'VIEW'}</button>
      </div>`;
  }).join('');

  el.querySelectorAll<HTMLButtonElement>('.cctv-view-btn').forEach(btn => {
    btn.addEventListener('click', () => selectCamera(btn.dataset['id'] ?? ''));
  });
}

function selectCamera(id: string) {
  const cam = cameras.find(c => c.id === id);
  if (!cam) return;
  selectedId = id;
  renderCameraList();

  const viewer = document.getElementById('cctv-viewer');
  const nameEl = document.getElementById('cctv-cam-name');
  const srcEl = document.getElementById('cctv-source');
  if (viewer) viewer.style.display = 'block';
  if (nameEl) nameEl.textContent = cam.name;
  if (srcEl) srcEl.textContent = cam.source;

  loadImage(cam);
}

function loadImage(cam: CctvCamera) {
  const img = document.getElementById('cctv-img') as HTMLImageElement | null;
  if (!img) return;
  // Cache-bust so the browser fetches a fresh frame each time
  const proxyUrl = `/osint/cctv/media?url=${encodeURIComponent(cam.url)}&_t=${Date.now()}`;
  img.src = proxyUrl;
}

function startAutoRefresh() {
  const btn = document.getElementById('cctv-auto-btn');
  if (refreshTimer) {
    clearInterval(refreshTimer);
    refreshTimer = null;
    if (btn) btn.textContent = 'AUTO';
    return;
  }
  if (btn) btn.textContent = '■ STOP';
  refreshTimer = setInterval(() => {
    const cam = cameras.find(c => c.id === selectedId);
    if (cam) loadImage(cam);
  }, 5000); // refresh every 5s
}

// ── Data loader ───────────────────────────────────────────────────────────────

async function loadCameras() {
  try {
    const res = await fetch('/osint/cctv/cameras');
    if (res.ok) {
      const data = await res.json() as { cameras: CctvCamera[] };
      cameras = data.cameras;
      renderCameraList();
    }
  } catch {
    const el = document.getElementById('cctv-camera-list');
    if (el) el.innerHTML = '<p style="color:var(--signal-red)">OSINT service offline.</p>';
  }
}

// ── Init ──────────────────────────────────────────────────────────────────────

export function initCctvPanel() {
  if (!document.getElementById('cctv-panel-style')) {
    const s = document.createElement('style');
    s.id = 'cctv-panel-style';
    s.textContent = `
      .cctv-panel {
        position:fixed; left:50%; transform:translateX(-50%);
        bottom:48px; width:380px; z-index:200;
      }
      .cctv-panel.hidden { display:none; }
    `;
    document.head.appendChild(s);
  }

  panelEl = buildPanel();
  document.body.appendChild(panelEl);

  document.getElementById('cctv-close-btn')?.addEventListener('click', hideCctvPanel);
  document.getElementById('cctv-refresh-btn')?.addEventListener('click', () => {
    const cam = cameras.find(c => c.id === selectedId);
    if (cam) loadImage(cam);
  });
  document.getElementById('cctv-auto-btn')?.addEventListener('click', startAutoRefresh);
}

export function showCctvPanel() {
  panelEl?.classList.remove('hidden');
  loadCameras();
}

export function hideCctvPanel() {
  panelEl?.classList.add('hidden');
  if (refreshTimer) {
    clearInterval(refreshTimer);
    refreshTimer = null;
  }
}

export function toggleCctvPanel() {
  if (panelEl?.classList.contains('hidden')) showCctvPanel();
  else hideCctvPanel();
}
