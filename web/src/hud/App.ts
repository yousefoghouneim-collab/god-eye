import { h } from 'preact';
import { LAYER_REGISTRY, LIVE_LAYER_KEYS } from '../layers/registry.js';
import { toggleLayer, isLayerEnabled } from '../layers/layer-state.js';
import type { LayerCategory } from '@god-eye/shared';

const CATEGORY_LABELS: Record<LayerCategory, string> = {
  geopolitical: 'GEOPOLITICAL',
  military: 'MILITARY',
  infrastructure: 'INFRASTRUCTURE',
  natural: 'NATURAL / CLIMATE',
  cyber: 'CYBER',
  markets: 'MARKETS',
  tech: 'TECH',
  osint: 'OSINT / SENSORS',
  sensors: 'SENSORS',
};

const CATEGORY_ORDER: LayerCategory[] = [
  'geopolitical', 'military', 'infrastructure', 'natural', 'cyber', 'markets', 'osint',
];

function cycleMode() {
  const fn = (window as unknown as Record<string, unknown>).cycleVisualMode;
  if (typeof fn === 'function') fn();
}

function handleLayerClick(key: string) {
  const newState = toggleLayer(key);
  // Update DOM directly — fast, no vdom re-render needed
  const row = document.querySelector(`[data-layer="${key}"]`);
  if (row) {
    row.classList.toggle('layer-row--active', newState);
    const dot = row.querySelector('.layer-row__dot');
    dot?.classList.toggle('layer-row__dot--fresh', newState);
  }
}

export function App() {
  // Group layers by category
  const grouped = new Map<LayerCategory, typeof LAYER_REGISTRY>();
  for (const layer of LAYER_REGISTRY) {
    const list = grouped.get(layer.category) ?? [];
    list.push(layer);
    grouped.set(layer.category, list);
  }

  return h('div', { class: 'shell' },
    // Top bar
    h('header', { class: 'topbar' },
      h('span', { class: 'topbar__brand' },
        h('img', { src: '/logo.png', alt: 'Ghouneim Eye', class: 'topbar__logo' }),
      ),
      h('span', { class: 'topbar__clock', id: 'utc-clock' }, '----.--.-- --:--:--Z'),
      h('span', { class: 'topbar__spacer' }),
      h('div', { class: 'topbar__status' },
        h('span', { class: 'topbar__dot' }),
        h('span', { class: 'hud-label' }, 'SYSTEMS NOMINAL'),
      ),
      h('button', {
        class: 'topbar__mode',
        id: 'renderer-toggle',
        onclick: () => {
          const fn = (window as unknown as Record<string, unknown>).toggleRendererMode;
          if (typeof fn === 'function') fn();
        },
        title: 'Toggle globe/flat map',
      }, '3D'),
      h('button', {
        class: 'topbar__mode',
        onclick: () => {
          const fn = (window as unknown as Record<string, unknown>).toggleReconPanel;
          if (typeof fn === 'function') fn();
        },
        title: 'OSINT Recon Toolkit',
      }, 'RECON'),
      h('button', {
        class: 'topbar__mode',
        onclick: () => {
          const fn = (window as unknown as Record<string, unknown>).toggleEntityPanel;
          if (typeof fn === 'function') fn();
        },
        title: 'Entity Graph / OFAC Screen',
      }, 'ENTITY'),
      h('button', {
        class: 'topbar__mode',
        onclick: () => {
          const fn = (window as unknown as Record<string, unknown>).toggleMarketsPanel;
          if (typeof fn === 'function') fn();
        },
        title: 'Markets: indices, crypto, Fear & Greed',
      }, 'MKTS'),
      h('button', {
        class: 'topbar__mode',
        onclick: () => {
          const fn = (window as unknown as Record<string, unknown>).toggleIntelPanel;
          if (typeof fn === 'function') fn();
        },
        title: 'SIGINT: Telegram preview + Shodan host intel',
      }, 'SIGINT'),
      h('button', {
        class: 'topbar__mode',
        onclick: () => {
          const fn = (window as unknown as Record<string, unknown>).toggleWatchOfficer;
          if (typeof fn === 'function') fn();
        },
        title: 'AI Watch-Officer + AOI Watch Areas',
      }, 'WATCH'),
      h('button', {
        class: 'topbar__mode',
        onclick: () => {
          const fn = (window as unknown as Record<string, unknown>).togglePluginPanel;
          if (typeof fn === 'function') fn();
        },
        title: 'Plugin Manager',
      }, 'PLUGINS'),
      h('button', {
        class: 'topbar__mode',
        onclick: () => {
          const fn = (window as unknown as Record<string, unknown>).togglePresetsPanel;
          if (typeof fn === 'function') fn();
        },
        title: 'Saved view presets',
      }, 'PRESETS'),
      h('button', {
        class: 'topbar__mode',
        onclick: () => {
          const fn = (window as unknown as Record<string, unknown>).toggleSarPanel;
          if (typeof fn === 'function') fn();
        },
        title: 'SAR ground-change watch areas (Sentinel-1)',
      }, 'SAR'),
      h('button', {
        class: 'topbar__mode',
        onclick: () => {
          const fn = (window as unknown as Record<string, unknown>).toggleRadioPanel;
          if (typeof fn === 'function') fn();
        },
        title: 'Radio intercept: KiwiSDR + OpenMHZ scanners',
      }, 'RADIO'),
      h('button', {
        class: 'topbar__mode',
        onclick: () => {
          const fn = (window as unknown as Record<string, unknown>).toggleCctvPanel;
          if (typeof fn === 'function') fn();
        },
        title: 'CCTV: public traffic authority cameras (opt-in)',
      }, 'CCTV'),
      h('button', {
        class: 'topbar__mode',
        id: 'cesium-toggle-btn',
        onclick: () => {
          const fn = (window as unknown as Record<string, unknown>).toggleCesiumMode;
          if (typeof fn === 'function') fn();
        },
        title: 'Cesium photoreal 3D mode (requires GOOGLE_MAPS_API_KEY)',
      }, '3D+'),
      h('button', {
        class: 'topbar__mode',
        onclick: () => {
          const fn = (window as unknown as Record<string, unknown>).toggleHealthPanel;
          if (typeof fn === 'function') fn();
        },
        title: 'Data source health / freshness dashboard',
      }, 'HEALTH'),
      h('button', {
        class: 'topbar__mode topbar__mode--active',
        onclick: cycleMode,
        title: 'Cycle visual mode',
      }, 'DEFAULT'),
      h('button', {
        class: 'topbar__mode',
        onclick: () => {
          const fn = (window as unknown as Record<string, unknown>).toggleShortcuts;
          if (typeof fn === 'function') fn();
        },
        title: 'Keyboard shortcuts (Shift+?)',
        style: 'padding:2px 8px;',
      }, '?'),
    ),

    // Left rail
    h('aside', { class: 'left-rail' },
      h('div', { class: 'left-rail__header' },
        h('input', {
          class: 'left-rail__search',
          type: 'text',
          placeholder: 'Search layers, places...',
          spellcheck: false,
        }),
      ),
      ...CATEGORY_ORDER
        .filter(cat => grouped.has(cat))
        .map(cat => {
          const layers = grouped.get(cat)!;
          return h('div', { class: 'left-rail__section' },
            h('div', { class: 'left-rail__section-title' }, CATEGORY_LABELS[cat]),
            ...layers.map(layer => {
              const active = isLayerEnabled(layer.key);
              const isLive = LIVE_LAYER_KEYS.has(layer.key);
              return h('div', {
                class: `layer-row ${active ? 'layer-row--active' : ''}`,
                'data-layer': layer.key,
                onclick: () => handleLayerClick(layer.key),
                style: 'cursor: pointer',
              },
                h('span', {
                  class: `layer-row__dot ${active ? 'layer-row__dot--fresh' : ''}`,
                  title: isLive ? 'Live data' : 'Coming soon',
                }),
                h('span', { class: 'layer-row__label' }, layer.label),
                h('span', { class: 'layer-row__toggle' }),
              );
            }),
          );
        }),
    ),

    // Canvas area (globe placeholder)
    h('main', { class: 'canvas-area' },
      h('div', { class: 'canvas-area__placeholder' },
        h('div', { class: 'canvas-area__reticle' }),
        h('span', { class: 'hud-label', style: 'margin-top: 20px' }, 'GLOBE ENGINE'),
        h('span', { class: 'telemetry' }, 'AWAITING INITIALIZATION'),
      ),
    ),

    // Right rail
    h('aside', { class: 'right-rail' },
      // Selection dossier panel
      h('div', { class: 'panel panel--bracketed', id: 'selection-dossier' },
        h('span', { class: 'panel__bracket-bl' }),
        h('span', { class: 'panel__bracket-br' }),
        h('div', { class: 'panel__title' }, 'SELECTION DOSSIER'),
        h('div', { class: 'panel__body' },
          h('p', { class: 'hud-label', style: 'margin-bottom: 8px' }, 'NO ENTITY SELECTED'),
          h('p', { style: 'color: var(--text-lo); font-size: var(--fs-12)' },
            'Click any entity on the globe to view its dossier. Right-click empty space for a location briefing.',
          ),
        ),
      ),
      // Status panel
      h('div', { class: 'panel panel--bracketed' },
        h('span', { class: 'panel__bracket-bl' }),
        h('span', { class: 'panel__bracket-br' }),
        h('div', { class: 'panel__title' }, 'SYSTEM STATUS'),
        h('div', { class: 'panel__body', id: 'system-status' },
          ...[
            ['NODE API', 'STANDBY'],
            ['OSINT SVC', 'STANDBY'],
            ['REDIS', 'STANDBY'],
            ['AI ENGINE', 'OFFLINE'],
            ['LIVE FEEDS', '0 ACTIVE'],
          ].map(([label, value]) =>
            h('div', { style: 'display:flex; justify-content:space-between; padding: 3px 0; border-bottom: 1px solid var(--line-hair)' },
              h('span', { class: 'hud-label' }, label),
              h('span', { class: 'telemetry' }, value),
            ),
          ),
        ),
      ),
      // CII Summary
      h('div', { class: 'panel' },
        h('div', { class: 'panel__title' }, 'INSTABILITY INDEX'),
        h('div', { class: 'panel__body', id: 'cii-summary' },
          h('p', { style: 'color: var(--text-lo); font-size: var(--fs-11)' }, 'Loading CII data...'),
        ),
      ),
      // Correlation Alerts
      h('div', { class: 'panel' },
        h('div', { class: 'panel__title' }, 'CONVERGENCE ALERTS'),
        h('div', { class: 'panel__body', id: 'correlation-summary' },
          h('p', { style: 'color: var(--text-lo); font-size: var(--fs-11)' }, 'Scanning streams...'),
        ),
      ),
      // AI Intel panel
      h('div', { class: 'panel panel--bracketed' },
        h('span', { class: 'panel__bracket-bl' }),
        h('span', { class: 'panel__bracket-br' }),
        h('div', { class: 'panel__title' },
          'AI INTEL',
          h('button', {
            class: 'topbar__mode',
            id: 'ai-brief-btn',
            style: 'margin-left: auto; font-size: var(--fs-10); padding: 2px 8px',
          }, 'BRIEF'),
        ),
        h('div', { class: 'panel__body', id: 'ai-intel-body' },
          h('p', { style: 'color: var(--text-lo); font-size: var(--fs-11)' },
            'Click BRIEF to generate a situational intelligence summary. Requires Ollama or an AI API key.',
          ),
        ),
      ),
    ),

    // Bottom ticker
    h('footer', { class: 'ticker' },
      h('span', { class: 'ticker__label' }, 'FEED'),
      h('div', { class: 'ticker__track' },
        h('span', { class: 'ticker__content', id: 'ticker-content' },
          h('span', { class: 'ticker__dot ticker__dot--info' }),
          ' Ghouneim Eye v1.0 — Global Intelligence Platform ',
          h('span', { class: 'ticker__dot ticker__dot--info' }),
          ' 4 live layers: Earthquakes, Fires, EONET, Aircraft ',
          h('span', { class: 'ticker__dot ticker__dot--warning' }),
          ' WebSocket relay connected ',
          h('span', { class: 'ticker__dot ticker__dot--info' }),
          ' Press Cmd+K for command palette ',
        ),
      ),
    ),

    // Command palette overlay
    h('div', { class: 'cmd-palette-overlay', id: 'cmd-palette-overlay' },
      h('div', { class: 'cmd-palette' },
        h('input', {
          class: 'cmd-palette__input',
          type: 'text',
          placeholder: 'Search layers, places, commands...',
          spellcheck: false,
        }),
        h('div', { class: 'cmd-palette__results' },
          h('div', { class: 'cmd-palette__empty' }, 'Type to search'),
        ),
      ),
    ),
  );
}
