/**
 * Keyboard shortcuts reference overlay.
 * Triggered by Shift+? or clicking a ? button.
 * Styled as a centered panel; dismissible with Escape or clicking outside.
 */

let overlayEl: HTMLElement | null = null;

const SHORTCUTS: { key: string; description: string; category: string }[] = [
  // Navigation
  { category: 'NAVIGATION', key: 'Drag', description: 'Rotate globe' },
  { category: 'NAVIGATION', key: 'Scroll', description: 'Zoom in / out' },
  { category: 'NAVIGATION', key: 'Right-click', description: 'Location dossier at point' },
  { category: 'NAVIGATION', key: 'Double-click', description: 'Fly to point' },

  // Global
  { category: 'GLOBAL', key: 'Cmd/Ctrl + K', description: 'Open command palette' },
  { category: 'GLOBAL', key: 'Shift + ?', description: 'Show this shortcuts overlay' },
  { category: 'GLOBAL', key: 'Escape', description: 'Close active overlay / palette' },

  // View modes
  { category: 'VIEW MODES', key: 'V', description: 'Cycle visual mode (DEFAULT → SATELLITE → FLIR → NVG → CRT → DOSSIER)' },
  { category: 'VIEW MODES', key: 'M', description: 'Toggle 3D globe / 2D flat map' },

  // Panels (topbar)
  { category: 'PANELS', key: 'Shift + R', description: 'RECON toolkit panel' },
  { category: 'PANELS', key: 'Shift + E', description: 'ENTITY graph panel' },
  { category: 'PANELS', key: 'Shift + M', description: 'MARKETS panel' },
  { category: 'PANELS', key: 'Shift + S', description: 'SIGINT panel' },
  { category: 'PANELS', key: 'Shift + W', description: 'WATCH officer panel' },
  { category: 'PANELS', key: 'Shift + P', description: 'PRESETS panel' },
  { category: 'PANELS', key: 'Shift + H', description: 'HEALTH / freshness dashboard' },

  // Time machine
  { category: 'TIME MACHINE', key: 'Space', description: 'Play / pause timeline (when time bar focused)' },
  { category: 'TIME MACHINE', key: 'L', description: 'Jump to LIVE mode' },

  // Brief & export
  { category: 'BRIEF & EXPORT', key: 'Shift + B', description: 'Generate AI brief' },
  { category: 'BRIEF & EXPORT', key: 'Shift + X', description: 'Export situation brief (.txt + clipboard)' },
];

function buildOverlay(): HTMLElement {
  const backdrop = document.createElement('div');
  backdrop.id = 'shortcuts-overlay';
  backdrop.style.cssText = `
    position:fixed; inset:0; z-index:10000;
    background:rgba(6,9,13,0.80);
    display:flex; align-items:center; justify-content:center;
  `;

  const card = document.createElement('div');
  card.style.cssText = `
    background:var(--ink-150); border:1px solid var(--line-soft);
    border-radius:var(--r-md); box-shadow:var(--shadow-panel);
    width:640px; max-width:96vw; max-height:80vh;
    overflow-y:auto; padding:0;
  `;

  // Header
  const header = document.createElement('div');
  header.style.cssText = `
    padding:10px 16px; border-bottom:1px solid var(--line-hair);
    display:flex; justify-content:space-between; align-items:center;
  `;
  header.innerHTML = `
    <span class="hud-label" style="font-size:var(--fs-13)">KEYBOARD SHORTCUTS</span>
    <button id="shortcuts-close-btn" class="topbar__mode"
      style="font-size:var(--fs-10);padding:2px 8px">✕  ESC</button>
  `;
  card.appendChild(header);

  // Body — group by category
  const body = document.createElement('div');
  body.style.cssText = 'padding:12px 16px;';

  const categories = [...new Set(SHORTCUTS.map(s => s.category))];
  for (const cat of categories) {
    const catItems = SHORTCUTS.filter(s => s.category === cat);
    const section = document.createElement('div');
    section.style.cssText = 'margin-bottom:14px;';
    section.innerHTML = `
      <div class="hud-label" style="margin-bottom:6px;color:var(--sig-amber)">${cat}</div>
      ${catItems.map(item => `
        <div style="display:flex;justify-content:space-between;align-items:baseline;
          padding:3px 0;border-bottom:1px solid var(--line-hair)">
          <kbd style="
            font:400 11px/1.4 'IBM Plex Mono',monospace;
            color:var(--text-hi);
            background:var(--ink-200);
            border:1px solid var(--line-soft);
            border-radius:var(--r-xs);
            padding:1px 6px;
            white-space:nowrap;
          ">${item.key}</kbd>
          <span style="color:var(--text-mid);font-size:var(--fs-11);
            margin-left:16px;text-align:right;flex:1">${item.description}</span>
        </div>
      `).join('')}
    `;
    body.appendChild(section);
  }

  // Footer
  const footer = document.createElement('div');
  footer.style.cssText = `
    padding:8px 16px; border-top:1px solid var(--line-hair);
    color:var(--text-lo); font-size:var(--fs-10); text-align:center;
  `;
  footer.textContent = 'GOD-EYE — Shift+? to toggle this overlay';
  body.appendChild(footer);

  card.appendChild(body);
  backdrop.appendChild(card);

  // Close on backdrop click (outside card)
  backdrop.addEventListener('click', (e) => {
    if (e.target === backdrop) hideShortcuts();
  });

  return backdrop;
}

export function initShortcuts() {
  overlayEl = buildOverlay();
  document.body.appendChild(overlayEl);
  overlayEl.style.display = 'none';

  document.getElementById('shortcuts-close-btn')?.addEventListener('click', hideShortcuts);

  // Register global hotkeys
  document.addEventListener('keydown', (e) => {
    // Shift+? shows shortcuts
    if (e.shiftKey && e.key === '?') {
      e.preventDefault();
      toggleShortcuts();
      return;
    }

    // Skip if focus is in an input
    const tag = (document.activeElement?.tagName ?? '').toLowerCase();
    if (tag === 'input' || tag === 'textarea') return;

    switch (e.key) {
      case 'v': case 'V': {
        const fn = (window as unknown as Record<string, unknown>).cycleVisualMode;
        if (typeof fn === 'function') fn();
        break;
      }
      case 'm': case 'M': {
        if (!e.shiftKey) {
          const fn = (window as unknown as Record<string, unknown>).toggleRendererMode;
          if (typeof fn === 'function') fn();
        }
        break;
      }
      case 'l': case 'L': {
        // Jump to LIVE (emit timeline:range live)
        import('../bus/data-bus.js').then(({ DataBus }) => {
          DataBus.emit('timeline:range', { from: 0, to: Infinity, live: true });
        }).catch(() => { /* ignore */ });
        break;
      }
    }

    // Shift+<key> panel toggles
    if (e.shiftKey) {
      const toggleMap: Record<string, string> = {
        R: 'toggleReconPanel',
        E: 'toggleEntityPanel',
        M: 'toggleMarketsPanel',
        S: 'toggleIntelPanel',
        W: 'toggleWatchOfficer',
        P: 'togglePresetsPanel',
        H: 'toggleHealthPanel',
        B: 'requestAIBrief',
        X: 'exportBrief',
      };
      const fn = toggleMap[e.key.toUpperCase()];
      if (fn) {
        e.preventDefault();
        const handler = (window as unknown as Record<string, unknown>)[fn];
        if (typeof handler === 'function') (handler as () => void)();
      }
    }
  });
}

export function showShortcuts() {
  if (overlayEl) overlayEl.style.display = 'flex';
}

export function hideShortcuts() {
  if (overlayEl) overlayEl.style.display = 'none';
}

export function toggleShortcuts() {
  if (overlayEl?.style.display === 'none') showShortcuts();
  else hideShortcuts();
}
