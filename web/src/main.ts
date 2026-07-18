import { render } from 'preact';
import { App } from './hud/App';

const root = document.getElementById('app');
if (root) {
  render(App(), root);
}

// UTC clock tick
const clockEl = document.getElementById('utc-clock');
function updateClock() {
  if (clockEl) {
    const now = new Date();
    clockEl.textContent = now.toISOString().replace('T', ' ').slice(0, 19) + 'Z';
  }
  requestAnimationFrame(updateClock);
}
requestAnimationFrame(updateClock);

// Command palette toggle
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

// Visual mode persistence
const savedStyle = localStorage.getItem('god-eye-style') ?? 'DEFAULT';
document.documentElement.setAttribute('data-style', savedStyle);
