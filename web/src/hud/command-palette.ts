/**
 * Command palette — search layers, places, commands.
 * Debounced geocode search via Nominatim.
 */
import { LAYER_REGISTRY } from '../layers/registry.js';
import { toggleLayer, isLayerEnabled } from '../layers/layer-state.js';
import type { GlobeApi } from '../globe/GlobeView.js';

interface SearchResult {
  type: 'layer' | 'place' | 'command';
  label: string;
  detail?: string;
  action: () => void;
}

let debounceTimer: ReturnType<typeof setTimeout> | null = null;
let globeApiRef: GlobeApi | null = null;

export function setGlobeApiForPalette(api: GlobeApi) {
  globeApiRef = api;
}

function closePalette() {
  document.getElementById('cmd-palette-overlay')?.classList.remove('cmd-palette-overlay--open');
}

function buildLayerResults(query: string): SearchResult[] {
  const q = query.toLowerCase();
  return LAYER_REGISTRY
    .filter((l) => l.label.toLowerCase().includes(q) || l.key.includes(q))
    .slice(0, 8)
    .map((l) => ({
      type: 'layer' as const,
      label: `${l.icon} ${l.label}`,
      detail: isLayerEnabled(l.key) ? 'ON' : 'OFF',
      action: () => {
        toggleLayer(l.key);
        // Update left-rail row
        const row = document.querySelector(`[data-layer="${l.key}"]`);
        if (row) {
          const on = isLayerEnabled(l.key);
          row.classList.toggle('layer-row--active', on);
          row.querySelector('.layer-row__dot')?.classList.toggle('layer-row__dot--fresh', on);
        }
        closePalette();
      },
    }));
}

function buildCommandResults(query: string): SearchResult[] {
  const q = query.toLowerCase();
  const commands: SearchResult[] = [
    { type: 'command', label: 'Toggle 3D/2D', action: () => { const fn = (window as unknown as Record<string, unknown>).toggleRendererMode; if (typeof fn === 'function') fn(); closePalette(); } },
    { type: 'command', label: 'Cycle Visual Mode', action: () => { const fn = (window as unknown as Record<string, unknown>).cycleVisualMode; if (typeof fn === 'function') fn(); closePalette(); } },
    { type: 'command', label: 'Fly to Dubai', action: () => { globeApiRef?.flyTo({ lat: 25.2, lng: 55.27, altitude: 1.5 }); closePalette(); } },
    { type: 'command', label: 'Fly to London', action: () => { globeApiRef?.flyTo({ lat: 51.5, lng: -0.12, altitude: 1.5 }); closePalette(); } },
    { type: 'command', label: 'Fly to Washington DC', action: () => { globeApiRef?.flyTo({ lat: 38.9, lng: -77.04, altitude: 1.5 }); closePalette(); } },
    { type: 'command', label: 'Fly to Beijing', action: () => { globeApiRef?.flyTo({ lat: 39.9, lng: 116.4, altitude: 1.5 }); closePalette(); } },
  ];
  return commands.filter((c) => c.label.toLowerCase().includes(q)).slice(0, 5);
}

async function geocodeSearch(query: string): Promise<SearchResult[]> {
  if (query.length < 3) return [];
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=5`,
      { headers: { 'User-Agent': 'GOD-EYE/0.2 (private research)' } }
    );
    if (!res.ok) return [];
    const data = await res.json() as Array<{ display_name: string; lat: string; lon: string }>;
    return data.map((d) => ({
      type: 'place' as const,
      label: d.display_name.slice(0, 60),
      detail: `${parseFloat(d.lat).toFixed(2)}, ${parseFloat(d.lon).toFixed(2)}`,
      action: () => {
        globeApiRef?.flyTo({ lat: parseFloat(d.lat), lng: parseFloat(d.lon), altitude: 1.5 });
        closePalette();
      },
    }));
  } catch {
    return [];
  }
}

function renderResults(container: HTMLElement, results: SearchResult[]) {
  if (results.length === 0) {
    container.innerHTML = '<div class="cmd-palette__empty">No results</div>';
    return;
  }
  container.innerHTML = results
    .map(
      (r, i) =>
        `<div class="cmd-palette__result" data-idx="${i}" tabindex="0">
          <span class="cmd-palette__result-type">${r.type.toUpperCase()}</span>
          <span class="cmd-palette__result-label">${r.label}</span>
          ${r.detail ? `<span class="cmd-palette__result-detail">${r.detail}</span>` : ''}
        </div>`
    )
    .join('');

  // Bind click handlers
  container.querySelectorAll('.cmd-palette__result').forEach((el, i) => {
    el.addEventListener('click', () => results[i].action());
  });
}

export function initCommandPalette() {
  const overlay = document.getElementById('cmd-palette-overlay');
  const input = overlay?.querySelector('.cmd-palette__input') as HTMLInputElement | null;
  const resultsContainer = overlay?.querySelector('.cmd-palette__results') as HTMLElement | null;
  if (!input || !resultsContainer) return;

  input.addEventListener('input', () => {
    const query = input.value.trim();
    if (!query) {
      resultsContainer.innerHTML = '<div class="cmd-palette__empty">Type to search</div>';
      return;
    }

    // Immediate: layers + commands
    const layers = buildLayerResults(query);
    const commands = buildCommandResults(query);
    renderResults(resultsContainer, [...layers, ...commands]);

    // Debounced geocode
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(async () => {
      const places = await geocodeSearch(query);
      if (input.value.trim() === query && places.length > 0) {
        const all = [...layers, ...commands, ...places];
        renderResults(resultsContainer, all);
      }
    }, 400);
  });

  // Keyboard navigation
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      const first = resultsContainer.querySelector('.cmd-palette__result') as HTMLElement | null;
      first?.click();
    }
  });
}
