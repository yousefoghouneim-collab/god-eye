/**
 * Time Machine — global timeline scrubber above the ticker.
 *
 * Broadcasts DataBus 'timeline:range' events.
 * When live=true → all layers show current data.
 * When live=false → time-aware layers filter entities by timestamp ∈ [from, to].
 *
 * Time-aware layers: earthquakes, fires, eonet, conflicts, weather.
 */
import { DataBus } from '../bus/data-bus.js';

export interface TimeRange {
  from: number;
  to: number;
  live: boolean;
}

// Default window: last 24 hours
const WINDOW_MS = 24 * 60 * 60 * 1_000;
const SPEEDS = [1, 2, 5, 10, 30] as const;
type Speed = typeof SPEEDS[number];

let live = true;
let windowFrom = Date.now() - WINDOW_MS;
let windowTo = Date.now();
let playSpeed: Speed = 1;
let playTimer: ReturnType<typeof setInterval> | null = null;
let barEl: HTMLElement | null = null;

function emitRange() {
  DataBus.emit('timeline:range', { from: windowFrom, to: windowTo, live } satisfies TimeRange);
}

function fmt(ts: number): string {
  return new Date(ts).toISOString().replace('T', ' ').slice(0, 16) + 'Z';
}

function buildBar(): HTMLElement {
  const el = document.createElement('div');
  el.id = 'time-machine-bar';
  el.className = 'time-machine-bar';
  el.innerHTML = `
    <div class="tm-inner">
      <button id="tm-live-btn" class="topbar__mode tm-btn topbar__mode--active"
        title="Return to live">LIVE</button>

      <button id="tm-play-btn" class="topbar__mode tm-btn" title="Play timeline">▶</button>

      <select id="tm-speed" class="cmd-palette__input tm-select" title="Playback speed">
        ${SPEEDS.map(s => `<option value="${s}"${s===1?' selected':''}>${s}x</option>`).join('')}
      </select>

      <span class="hud-label tm-label" id="tm-from-label" style="min-width:140px"></span>
      <div class="tm-track-wrap">
        <input type="range" id="tm-scrubber" class="tm-scrubber"
          min="0" max="1000" value="1000" step="1">
      </div>
      <span class="hud-label tm-label" id="tm-to-label" style="min-width:140px;text-align:right"></span>

      <select id="tm-window" class="cmd-palette__input tm-select" title="Window size">
        <option value="${1*3600000}">1 h</option>
        <option value="${6*3600000}">6 h</option>
        <option value="${12*3600000}">12 h</option>
        <option value="${24*3600000}" selected>24 h</option>
        <option value="${48*3600000}">48 h</option>
        <option value="${7*24*3600000}">7 d</option>
      </select>
    </div>
  `;
  return el;
}

function updateUI() {
  const liveBtn = document.getElementById('tm-live-btn');
  const fromLbl = document.getElementById('tm-from-label');
  const toLbl = document.getElementById('tm-to-label');
  const scrubber = document.getElementById('tm-scrubber') as HTMLInputElement | null;
  const playBtn = document.getElementById('tm-play-btn');

  liveBtn?.classList.toggle('topbar__mode--active', live);
  if (fromLbl) fromLbl.textContent = fmt(windowFrom);
  if (toLbl) toLbl.textContent = live ? 'NOW' : fmt(windowTo);
  if (playBtn) playBtn.textContent = playTimer ? '⏸' : '▶';

  // Scrubber position represents windowTo relative to now-WINDOW_MS…now
  if (scrubber && !live) {
    const now = Date.now();
    const earliest = now - WINDOW_MS;
    const pct = Math.max(0, Math.min(1, (windowTo - earliest) / WINDOW_MS));
    scrubber.value = String(Math.round(pct * 1000));
  }
}

function goLive() {
  live = true;
  stopPlay();
  windowTo = Date.now();
  windowFrom = windowTo - currentWindowMs();
  updateUI();
  emitRange();
}

function currentWindowMs(): number {
  const sel = document.getElementById('tm-window') as HTMLSelectElement | null;
  return parseInt(sel?.value ?? String(WINDOW_MS), 10);
}

function scrubTo(pct: number) {
  // pct 0..1 → windowTo between (now - WINDOW_MS) and now
  live = false;
  stopPlay();
  const now = Date.now();
  const win = currentWindowMs();
  const earliest = now - win;
  windowTo = earliest + pct * win;
  windowFrom = windowTo - win;
  updateUI();
  emitRange();
}

function startPlay() {
  if (playTimer) return;
  if (live) { live = false; windowTo = windowFrom + currentWindowMs(); }
  const tickMs = 500;
  playTimer = setInterval(() => {
    const step = (currentWindowMs() / 60) * playSpeed;
    windowTo += step;
    windowFrom += step;
    if (windowTo >= Date.now()) { goLive(); return; }
    updateUI();
    emitRange();
  }, tickMs);
  updateUI();
}

function stopPlay() {
  if (playTimer) { clearInterval(playTimer); playTimer = null; }
}

export function initTimeMachine() {
  if (!document.getElementById('tm-style')) {
    const s = document.createElement('style');
    s.id = 'tm-style';
    s.textContent = `
      .time-machine-bar {
        position:fixed; bottom:36px; left:0; right:0; height:32px;
        background:var(--bg-panel,#0d1117);
        border-top:1px solid var(--line-hair,#2a2e36);
        z-index:100; display:flex; align-items:center; padding:0 8px;
      }
      .tm-inner {
        display:flex; align-items:center; gap:6px; width:100%; overflow:hidden;
      }
      .tm-btn { font-size:var(--fs-10)!important; padding:2px 8px!important; }
      .tm-label { font-size:var(--fs-10); color:var(--text-lo); white-space:nowrap; }
      .tm-select {
        font-size:var(--fs-10); padding:2px 4px; height:22px;
        background:var(--bg-base); border:1px solid var(--line-hair);
        color:var(--text-hi); width:60px;
      }
      .tm-track-wrap { flex:1; min-width:80px; }
      .tm-scrubber {
        width:100%; height:3px; cursor:pointer;
        accent-color:var(--accent,#e5a100);
      }
      .ticker { bottom:0; }
    `;
    document.head.appendChild(s);
  }

  barEl = buildBar();
  document.body.appendChild(barEl);

  // Wire controls
  document.getElementById('tm-live-btn')?.addEventListener('click', goLive);

  document.getElementById('tm-play-btn')?.addEventListener('click', () => {
    if (playTimer) stopPlay();
    else startPlay();
    updateUI();
  });

  document.getElementById('tm-scrubber')?.addEventListener('input', (e) => {
    const pct = parseInt((e.target as HTMLInputElement).value) / 1000;
    scrubTo(pct);
  });

  document.getElementById('tm-speed')?.addEventListener('change', (e) => {
    const v = parseInt((e.target as HTMLSelectElement).value) as Speed;
    playSpeed = v;
  });

  document.getElementById('tm-window')?.addEventListener('change', () => {
    if (live) goLive();
    else scrubTo(1);
  });

  // Keep live mode updated every 30s
  setInterval(() => { if (live) goLive(); }, 30_000);

  // Initial emit
  goLive();
}

export function getTimeRange(): TimeRange {
  return { from: windowFrom, to: windowTo, live };
}
