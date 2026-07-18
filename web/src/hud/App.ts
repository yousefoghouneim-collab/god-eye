import { h } from 'preact';

const LAYER_CATEGORIES = [
  {
    title: 'GEOPOLITICAL',
    layers: [
      { key: 'intel-hotspots', label: 'Intel Hotspots', active: false },
      { key: 'conflict-zones', label: 'Conflict Zones', active: false },
      { key: 'armed-conflict', label: 'Armed Conflict Events', active: false },
      { key: 'protests', label: 'Protests / Unrest', active: false },
    ],
  },
  {
    title: 'MILITARY',
    layers: [
      { key: 'mil-aircraft', label: 'Military Aircraft', active: false },
      { key: 'naval-vessels', label: 'Naval Vessels', active: false },
      { key: 'mil-bases', label: 'Military Bases', active: true },
      { key: 'nuclear-sites', label: 'Nuclear Sites', active: false },
      { key: 'satellites', label: 'Orbital Surveillance', active: false },
    ],
  },
  {
    title: 'INFRASTRUCTURE',
    layers: [
      { key: 'cables', label: 'Undersea Cables', active: true },
      { key: 'pipelines', label: 'Pipelines', active: false },
      { key: 'power-plants', label: 'Power Plants', active: false },
      { key: 'datacenters', label: 'AI Datacenters', active: false },
      { key: 'ports', label: 'Strategic Ports', active: true },
      { key: 'trade-routes', label: 'Trade Routes', active: false },
    ],
  },
  {
    title: 'NATURAL / CLIMATE',
    layers: [
      { key: 'earthquakes', label: 'Earthquakes', active: true },
      { key: 'fires', label: 'Active Fires', active: false },
      { key: 'natural-events', label: 'Natural Events', active: false },
      { key: 'weather', label: 'Weather Alerts', active: false },
    ],
  },
  {
    title: 'CYBER',
    layers: [
      { key: 'cyber-threats', label: 'Cyber Threats / IOCs', active: false },
      { key: 'gps-jamming', label: 'GPS/GNSS Jamming', active: false },
    ],
  },
];

function cycleMode() {
  const fn = (window as unknown as Record<string, unknown>).cycleVisualMode;
  if (typeof fn === 'function') fn();
}

export function App() {
  return h('div', { class: 'shell' },
    // Top bar
    h('header', { class: 'topbar' },
      h('span', { class: 'topbar__brand' }, 'GOD-EYE'),
      h('span', { class: 'topbar__clock', id: 'utc-clock' }, '----.--.-- --:--:--Z'),
      h('span', { class: 'topbar__spacer' }),
      h('div', { class: 'topbar__status' },
        h('span', { class: 'topbar__dot' }),
        h('span', { class: 'hud-label' }, 'SYSTEMS NOMINAL'),
      ),
      h('button', {
        class: 'topbar__mode topbar__mode--active',
        onclick: cycleMode,
        title: 'Cycle visual mode',
      }, 'DEFAULT'),
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
      ...LAYER_CATEGORIES.map(cat =>
        h('div', { class: 'left-rail__section' },
          h('div', { class: 'left-rail__section-title' }, cat.title),
          ...cat.layers.map(layer =>
            h('div', { class: `layer-row ${layer.active ? 'layer-row--active' : ''}` },
              h('span', { class: `layer-row__dot ${layer.active ? 'layer-row__dot--fresh' : ''}` }),
              h('span', { class: 'layer-row__label' }, layer.label),
              h('span', { class: 'layer-row__toggle' }),
            ),
          ),
        ),
      ),
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
      h('div', { class: 'panel panel--bracketed' },
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
        h('div', { class: 'panel__body' },
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
      // AI Intel panel placeholder
      h('div', { class: 'panel' },
        h('div', { class: 'panel__title' }, 'AI INTEL'),
        h('div', { class: 'panel__body' },
          h('p', { style: 'color: var(--text-lo); font-size: var(--fs-12)' },
            'Connect an AI provider to enable situational briefs and event classification.',
          ),
        ),
      ),
    ),

    // Bottom ticker
    h('footer', { class: 'ticker' },
      h('span', { class: 'ticker__label' }, 'FEED'),
      h('div', { class: 'ticker__track' },
        h('span', { class: 'ticker__content' },
          h('span', { class: 'ticker__dot ticker__dot--info' }),
          ' GOD-EYE v0.1.0 initialized ',
          h('span', { class: 'ticker__dot ticker__dot--info' }),
          ' Phase 0: Cockpit shell active ',
          h('span', { class: 'ticker__dot ticker__dot--warning' }),
          ' Globe engine pending initialization ',
          h('span', { class: 'ticker__dot ticker__dot--info' }),
          ' Awaiting live data connections ',
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
