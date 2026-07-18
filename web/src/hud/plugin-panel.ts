/**
 * Plugin Panel — install, view, and remove GOD-EYE plugins.
 * Ships with ISS and GeoJSON example plugins pre-listed.
 */
import { DataBus } from '../bus/data-bus.js';
import {
  installPlugin, uninstallPlugin, listPlugins, getPluginLogs, isPluginInstalled,
} from '../plugins/loader.js';
import { manifest as issManifest, plugin as issPlugin } from '../plugins/examples/iss.js';
import { manifest as geojsonManifest, plugin as geojsonPlugin } from '../plugins/examples/geojson.js';
import type { PluginManifest, GodEyePlugin } from '@god-eye/plugin-sdk';

const BUILTIN: Array<{ manifest: PluginManifest; plugin: GodEyePlugin }> = [
  { manifest: issManifest, plugin: issPlugin },
  { manifest: geojsonManifest, plugin: geojsonPlugin },
];

let panelEl: HTMLElement | null = null;

function buildPanel(): HTMLElement {
  const el = document.createElement('div');
  el.id = 'plugin-panel';
  el.className = 'panel panel--bracketed plugin-panel hidden';
  el.innerHTML = `
    <span class="panel__bracket-bl"></span>
    <span class="panel__bracket-br"></span>
    <div class="panel__title">
      PLUGINS
      <button class="topbar__mode" id="plugin-close-btn"
        style="margin-left:auto;font-size:var(--fs-10);padding:2px 8px">✕</button>
    </div>
    <div class="panel__body" style="overflow-y:auto;max-height:480px">
      <div class="left-rail__section-title" style="margin-bottom:6px">AVAILABLE</div>
      <div id="plugin-available-list"></div>

      <div class="left-rail__section-title" style="margin:10px 0 6px">INSTALLED</div>
      <div id="plugin-installed-list"
        style="font-size:var(--fs-11);color:var(--text-lo)">None installed.</div>

      <div class="left-rail__section-title" style="margin:10px 0 6px">LOG</div>
      <div id="plugin-log" style="font-size:var(--fs-10);color:var(--text-lo);
        max-height:120px;overflow-y:auto;white-space:pre-wrap"></div>
    </div>
  `;
  return el;
}

function renderAvailable() {
  const el = document.getElementById('plugin-available-list');
  if (!el) return;
  el.innerHTML = BUILTIN.map(({ manifest: m }) => {
    const installed = isPluginInstalled(m.id);
    return `
      <div style="display:flex;justify-content:space-between;align-items:center;
        padding:4px 0;border-bottom:1px solid var(--line-hair)">
        <div>
          <span style="color:var(--text-hi);font-size:var(--fs-11)">${m.layer.icon} ${m.name}</span>
          <div style="color:var(--text-lo);font-size:var(--fs-10)">${m.description}</div>
        </div>
        <button data-plugin-id="${m.id}"
          class="plugin-install-btn topbar__mode${installed ? ' topbar__mode--active' : ''}"
          style="font-size:var(--fs-10);padding:2px 8px;margin-left:8px;white-space:nowrap">
          ${installed ? 'REMOVE' : 'INSTALL'}
        </button>
      </div>`;
  }).join('');

  el.querySelectorAll<HTMLButtonElement>('.plugin-install-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = btn.dataset['pluginId'] ?? '';
      if (isPluginInstalled(id)) {
        uninstallPlugin(id);
      } else {
        const entry = BUILTIN.find(b => b.manifest.id === id);
        if (entry) {
          await installPlugin(entry.manifest, entry.plugin);
        }
      }
      renderAvailable();
      renderInstalled();
    });
  });
}

function renderInstalled() {
  const el = document.getElementById('plugin-installed-list');
  if (!el) return;
  const installed = listPlugins();
  if (!installed.length) {
    el.innerHTML = '<div style="color:var(--text-lo);font-size:var(--fs-11)">None installed.</div>';
    return;
  }
  el.innerHTML = installed.map(p => {
    const statusColor = p.status === 'active'
      ? 'var(--signal-green,#4caf50)'
      : p.status === 'error'
      ? 'var(--signal-red,#f55)'
      : 'var(--text-lo)';
    const age = p.lastFetch
      ? `${Math.round((Date.now() - p.lastFetch) / 1000)}s ago`
      : 'pending';
    return `
      <div style="padding:4px 0;border-bottom:1px solid var(--line-hair)">
        <div style="display:flex;justify-content:space-between">
          <span style="color:var(--text-hi);font-size:var(--fs-11)">${p.manifest.layer.icon} ${p.manifest.name}</span>
          <span style="color:${statusColor};font-size:var(--fs-10)">${p.status.toUpperCase()}</span>
        </div>
        <div style="color:var(--text-lo);font-size:var(--fs-10)">
          ${p.entityCount} entities · last fetch: ${age}
          ${p.lastError ? ` · <span style="color:var(--signal-red,#f55)">${p.lastError.slice(0, 60)}</span>` : ''}
        </div>
        <button data-plugin-id="${p.manifest.id}" data-log="1"
          class="plugin-log-btn topbar__mode"
          style="font-size:var(--fs-10);padding:1px 6px;margin-top:3px">LOGS</button>
      </div>`;
  }).join('');

  el.querySelectorAll<HTMLButtonElement>('.plugin-log-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.dataset['pluginId'] ?? '';
      showLog(id);
    });
  });
}

function showLog(id: string) {
  const logEl = document.getElementById('plugin-log');
  if (!logEl) return;
  const lines = getPluginLogs(id);
  logEl.textContent = lines.length ? lines.join('\n') : '(no logs)';
}

export function initPluginPanel() {
  if (!document.getElementById('plugin-panel-style')) {
    const s = document.createElement('style');
    s.id = 'plugin-panel-style';
    s.textContent = `
      .plugin-panel {
        position:fixed; bottom:48px; right:16px; width:380px; z-index:200;
        max-height:calc(100vh - 96px); overflow:hidden;
      }
      .plugin-panel.hidden { display:none; }
    `;
    document.head.appendChild(s);
  }

  panelEl = buildPanel();
  document.body.appendChild(panelEl);

  document.getElementById('plugin-close-btn')?.addEventListener('click', hidePluginPanel);

  // Refresh panel on plugin events
  DataBus.on('plugin:installed', () => { renderAvailable(); renderInstalled(); });
  DataBus.on('plugin:uninstalled', () => { renderAvailable(); renderInstalled(); });
  DataBus.on('plugin:log', (p) => {
    const { msg } = p as { id: string; msg: string };
    const logEl = document.getElementById('plugin-log');
    if (logEl && !panelEl?.classList.contains('hidden')) {
      logEl.textContent = msg + '\n' + logEl.textContent;
    }
  });
}

export function showPluginPanel() {
  panelEl?.classList.remove('hidden');
  renderAvailable();
  renderInstalled();
}

export function hidePluginPanel() {
  panelEl?.classList.add('hidden');
}

export function togglePluginPanel() {
  if (panelEl?.classList.contains('hidden')) showPluginPanel();
  else hidePluginPanel();
}
