/**
 * Agent Client — executes agent:command messages from the WS relay.
 * Commands originate from the MCP server or Agent Bus and are broadcast
 * to all connected browsers; this module handles them on the client side.
 */
import { DataBus } from './data-bus.js';
import type { GlobeApi } from '../globe/GlobeView.js';
import { toggleLayer, isLayerEnabled } from '../layers/layer-state.js';

let globeApi: GlobeApi | null = null;

// Custom pins stored separately from live layer data
interface AgentPin {
  id: string;
  lat: number;
  lng: number;
  label: string;
  color: string;
}
const agentPins: AgentPin[] = [];
let pinRenderer: (() => void) | null = null;

export function setGlobeApiForAgent(api: GlobeApi) {
  globeApi = api;
}

export function setPinRenderer(fn: () => void) {
  pinRenderer = fn;
}

export function getAgentPins(): AgentPin[] {
  return agentPins;
}

// ── Command handlers ────────────────────────────────────────────────────────
function handleFlyTo(params: Record<string, unknown>) {
  if (!globeApi) return;
  const lat = Number(params['lat']);
  const lng = Number(params['lng']);
  if (isNaN(lat) || isNaN(lng)) return;
  const altitude = params['altitude'] ? Number(params['altitude']) : undefined;
  globeApi.flyTo({ lat, lng, altitude });

  // Show a brief toast
  if (params['label']) showToast(`↗ Flying to: ${params['label']}`);
}

function handleSetLayer(params: Record<string, unknown>) {
  const layer = String(params['layer'] ?? '');
  const enabled = String(params['enabled']) === 'true';
  if (!layer) return;
  const current = isLayerEnabled(layer);
  if (current !== enabled) toggleLayer(layer);

  // Sync the layer-row UI
  const row = document.querySelector(`[data-layer="${layer}"]`);
  if (row) {
    row.classList.toggle('layer-row--active', enabled);
    row.querySelector('.layer-row__dot')?.classList.toggle('layer-row__dot--fresh', enabled);
  }
  showToast(`Layer "${layer}" ${enabled ? 'ON' : 'OFF'}`);
}

function handlePlacePin(params: Record<string, unknown>) {
  const lat = Number(params['lat']);
  const lng = Number(params['lng']);
  if (isNaN(lat) || isNaN(lng)) return;
  const label = String(params['label'] ?? 'Pin');
  const color = String(params['color'] ?? '#e5a100');
  agentPins.push({ id: `pin-${Date.now()}`, lat, lng, label, color });
  pinRenderer?.();
  showToast(`📍 ${label}`);
}

function handleClearPins() {
  agentPins.length = 0;
  pinRenderer?.();
  showToast('Pins cleared');
}

function handleGetDossier(params: Record<string, unknown>) {
  const lat = Number(params['lat']);
  const lng = Number(params['lng']);
  if (isNaN(lat) || isNaN(lng)) return;
  // Trigger location dossier — fires the same path as right-click
  DataBus.emit('agent:show_dossier', { lat, lng, label: params['label'] });
}

function handleAoiAlert(params: Record<string, unknown>) {
  const label = params['watchLabel'] ?? 'AOI';
  const entity = params['label'] ?? params['entityId'];
  appendTicker(`⚠ AOI [${label}]: ${entity} entered watch area`, 'warning');
}

// ── Toast helper ─────────────────────────────────────────────────────────────
function showToast(msg: string, durationMs = 3000) {
  let container = document.getElementById('agent-toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'agent-toast-container';
    container.style.cssText = `
      position:fixed;bottom:56px;left:50%;transform:translateX(-50%);
      display:flex;flex-direction:column;align-items:center;gap:4px;z-index:500;
      pointer-events:none;`;
    document.body.appendChild(container);
  }
  const toast = document.createElement('div');
  toast.style.cssText = `
    background:var(--bg-panel,#0d1117);border:1px solid var(--accent,#e5a100);
    color:var(--text-hi,#e8e6e0);font-family:var(--font-mono,'IBM Plex Mono',monospace);
    font-size:var(--fs-11,11px);padding:5px 14px;letter-spacing:.04em;
    animation:fadeIn .15s ease;`;
  toast.textContent = msg;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), durationMs);
}

function appendTicker(msg: string, type: 'info' | 'warning' | 'critical' = 'info') {
  const ticker = document.getElementById('ticker-content');
  if (!ticker) return;
  const dot = document.createElement('span');
  dot.className = `ticker__dot ticker__dot--${type === 'critical' ? 'critical' : type === 'warning' ? 'warning' : 'info'}`;
  ticker.appendChild(dot);
  ticker.appendChild(document.createTextNode(` ${msg} `));
}

// ── DataBus listener ─────────────────────────────────────────────────────────
export function initAgentClient() {
  DataBus.on('agent:command', (payload: unknown) => {
    const { command, params } = payload as { command: string; params: Record<string, unknown> };
    switch (command) {
      case 'fly_to':     handleFlyTo(params); break;
      case 'set_layer':  handleSetLayer(params); break;
      case 'place_pin':  handlePlacePin(params); break;
      case 'clear_pins': handleClearPins(); break;
      case 'get_dossier': handleGetDossier(params); break;
      case 'aoi_alert':  handleAoiAlert(params); break;
    }
  });

  // Inject toast fade-in keyframe once
  if (!document.getElementById('agent-toast-style')) {
    const s = document.createElement('style');
    s.id = 'agent-toast-style';
    s.textContent = `@keyframes fadeIn { from { opacity:0; transform:translateY(6px); } to { opacity:1; transform:none; } }`;
    document.head.appendChild(s);
  }
}
