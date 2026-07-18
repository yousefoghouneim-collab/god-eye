import { render } from 'preact';
import { App } from './hud/App';
import { createGlobeView } from './globe/GlobeView';
import type { GlobeApi } from './globe/GlobeView';
import type { VisualMode } from '@god-eye/shared';

// Visual mode persistence (apply before render to avoid flash)
const savedStyle = (localStorage.getItem('god-eye-style') ?? 'DEFAULT') as VisualMode;
document.documentElement.setAttribute('data-style', savedStyle);

const root = document.getElementById('app');
if (root) {
  render(App(), root);
}

// ─── Globe initialization ───
let globeApi: GlobeApi | null = null;

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

  globeApi = createGlobeView(globeContainer);

  // Apply saved visual mode
  if (savedStyle !== 'DEFAULT') {
    globeApi.setVisualMode(savedStyle);
  }

  // Right-click → location dossier
  globeApi.on('contextmenu', (data) => {
    const { lat, lng } = data as { lat: number; lng: number };
    console.log(`[GOD-EYE] Context menu at ${lat.toFixed(4)}°, ${lng.toFixed(4)}°`);
    // Location dossier will be wired in Phase 2
  });

  // Update status
  const statusEl = document.querySelector('.topbar__dot');
  if (statusEl) statusEl.classList.add('topbar__dot--fresh');

  console.log('[GOD-EYE] Globe initialized. Access via window.globeApi');
}

// Init after DOM settles
requestAnimationFrame(() => requestAnimationFrame(initGlobe));

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
const VISUAL_MODES: VisualMode[] = ['DEFAULT', 'SATELLITE', 'FLIR', 'NVG', 'CRT'];

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
