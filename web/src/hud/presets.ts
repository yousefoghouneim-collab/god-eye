/**
 * Saved view presets — localStorage boards.
 * Each preset captures: enabled layers, camera position, visual mode, time range.
 */
import type { VisualMode } from '@god-eye/shared';
import type { TimeRange } from './time-machine.js';
import { isLayerEnabled, toggleLayer } from '../layers/layer-state.js';
import { LAYER_REGISTRY } from '../layers/registry.js';
import { DataBus } from '../bus/data-bus.js';

const STORAGE_KEY = 'god-eye-presets';

export interface ViewPreset {
  id: string;
  name: string;
  createdAt: number;
  layers: string[];
  camera: { lat: number; lng: number; altitude: number } | null;
  mode: VisualMode;
  timeRange: TimeRange | null;
}

// ── Storage ───────────────────────────────────────────────────────────────────
function loadAll(): ViewPreset[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]') as ViewPreset[];
  } catch { return []; }
}

function saveAll(presets: ViewPreset[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(presets));
}

export function listPresets(): ViewPreset[] { return loadAll(); }

export function savePreset(name: string): ViewPreset {
  const enabledLayers = LAYER_REGISTRY
    .map(l => l.key)
    .filter(k => isLayerEnabled(k));

  const mode = (document.documentElement.getAttribute('data-style') ?? 'DEFAULT') as VisualMode;

  // Grab time range from DataBus state if available
  let timeRange: TimeRange | null = null;
  try {
    const { getTimeRange } = (window as unknown as { __timeMachine?: { getTimeRange: () => TimeRange } }).__timeMachine ?? {};
    if (getTimeRange) timeRange = getTimeRange();
  } catch { /* no time machine */ }

  const preset: ViewPreset = {
    id: `preset-${Date.now()}`,
    name,
    createdAt: Date.now(),
    layers: enabledLayers,
    camera: null, // updated below if globe is available
    mode,
    timeRange,
  };

  // Try to capture camera position from the globe
  const globeApi = (window as unknown as Record<string, unknown>)['globeApi'] as
    { getCamera?: () => { lat: number; lng: number; altitude: number } } | undefined;
  if (globeApi?.getCamera) {
    preset.camera = globeApi.getCamera();
  }

  const all = loadAll();
  all.unshift(preset);
  if (all.length > 20) all.length = 20;
  saveAll(all);
  return preset;
}

export function loadPreset(id: string): boolean {
  const preset = loadAll().find(p => p.id === id);
  if (!preset) return false;

  // Restore layers: disable all, then enable preset layers
  const allKeys = LAYER_REGISTRY.map(l => l.key);
  for (const key of allKeys) {
    const currently = isLayerEnabled(key);
    const should = preset.layers.includes(key);
    if (currently !== should) toggleLayer(key);
    // Update DOM
    const row = document.querySelector(`[data-layer="${key}"]`);
    if (row) {
      row.classList.toggle('layer-row--active', should);
      row.querySelector('.layer-row__dot')?.classList.toggle('layer-row__dot--fresh', should);
    }
  }

  // Restore visual mode
  const cycleToMode = (window as unknown as Record<string, unknown>)['cycleVisualMode'];
  if (typeof cycleToMode === 'function') {
    // Cycle until we hit the target mode
    let tries = 0;
    while (document.documentElement.getAttribute('data-style') !== preset.mode && tries < 10) {
      cycleToMode();
      tries++;
    }
  }

  // Restore camera
  if (preset.camera) {
    const globeApi = (window as unknown as Record<string, unknown>)['globeApi'] as
      { flyTo?: (opts: { lat: number; lng: number; altitude: number }) => void } | undefined;
    globeApi?.flyTo?.(preset.camera);
  }

  // Restore time range
  if (preset.timeRange) {
    DataBus.emit('timeline:range', preset.timeRange);
  }

  return true;
}

export function deletePreset(id: string) {
  saveAll(loadAll().filter(p => p.id !== id));
}

// ── Panel ─────────────────────────────────────────────────────────────────────
let panelEl: HTMLElement | null = null;

function buildPanel(): HTMLElement {
  const el = document.createElement('div');
  el.id = 'presets-panel';
  el.className = 'panel panel--bracketed presets-panel hidden';
  el.innerHTML = `
    <span class="panel__bracket-bl"></span>
    <span class="panel__bracket-br"></span>
    <div class="panel__title">
      VIEW PRESETS
      <button class="topbar__mode" id="presets-close-btn"
        style="margin-left:auto;font-size:var(--fs-10);padding:2px 8px">✕</button>
    </div>
    <div class="panel__body">
      <div style="display:flex;gap:6px;margin-bottom:10px">
        <input id="preset-name-input" class="cmd-palette__input"
          style="flex:1;font-size:var(--fs-11);padding:4px 8px;height:28px"
          type="text" placeholder="Preset name..." spellcheck="false">
        <button id="preset-save-btn" class="topbar__mode"
          style="padding:4px 12px;font-size:var(--fs-10)">SAVE</button>
      </div>
      <div id="presets-list" style="overflow-y:auto;max-height:360px;font-size:var(--fs-11)"></div>
    </div>
  `;
  return el;
}

function renderPresets() {
  const listEl = document.getElementById('presets-list');
  if (!listEl) return;
  const presets = listPresets();
  if (!presets.length) {
    listEl.innerHTML = '<p style="color:var(--text-lo);font-size:var(--fs-11)">No presets saved.</p>';
    return;
  }
  listEl.innerHTML = presets.map(p => {
    const date = new Date(p.createdAt).toISOString().slice(0, 16).replace('T', ' ');
    return `
      <div style="padding:5px 0;border-bottom:1px solid var(--line-hair)">
        <div style="display:flex;justify-content:space-between;align-items:center">
          <span style="color:var(--text-hi);font-weight:600">${p.name}</span>
          <div style="display:flex;gap:4px">
            <button data-preset-id="${p.id}" class="preset-load-btn topbar__mode"
              style="font-size:var(--fs-10);padding:2px 7px">LOAD</button>
            <button data-preset-id="${p.id}" class="preset-del-btn topbar__mode"
              style="font-size:var(--fs-10);padding:2px 7px">✕</button>
          </div>
        </div>
        <div style="color:var(--text-lo);font-size:var(--fs-10)">
          ${date}Z · ${p.layers.length} layers · ${p.mode}
          ${p.camera ? ` · ${p.camera.lat.toFixed(1)},${p.camera.lng.toFixed(1)}` : ''}
        </div>
      </div>`;
  }).join('');

  listEl.querySelectorAll<HTMLButtonElement>('.preset-load-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      loadPreset(btn.dataset['presetId'] ?? '');
      hidePresetsPanel();
    });
  });
  listEl.querySelectorAll<HTMLButtonElement>('.preset-del-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      deletePreset(btn.dataset['presetId'] ?? '');
      renderPresets();
    });
  });
}

export function initPresetsPanel() {
  if (!document.getElementById('presets-style')) {
    const s = document.createElement('style');
    s.id = 'presets-style';
    s.textContent = `
      .presets-panel {
        position:fixed; left:50%; transform:translateX(-50%);
        top:48px; width:380px; z-index:200;
      }
      .presets-panel.hidden { display:none; }
    `;
    document.head.appendChild(s);
  }

  panelEl = buildPanel();
  document.body.appendChild(panelEl);

  document.getElementById('presets-close-btn')?.addEventListener('click', hidePresetsPanel);
  document.getElementById('preset-save-btn')?.addEventListener('click', () => {
    const input = document.getElementById('preset-name-input') as HTMLInputElement | null;
    const name = input?.value.trim() || `Preset ${new Date().toISOString().slice(11, 19)}Z`;
    savePreset(name);
    if (input) input.value = '';
    renderPresets();
  });
}

export function showPresetsPanel() {
  panelEl?.classList.remove('hidden');
  renderPresets();
}

export function hidePresetsPanel() {
  panelEl?.classList.add('hidden');
}

export function togglePresetsPanel() {
  if (panelEl?.classList.contains('hidden')) showPresetsPanel();
  else hidePresetsPanel();
}
