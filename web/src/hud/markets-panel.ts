/**
 * Markets Panel — live indices, crypto, commodities, Fear & Greed.
 * Polls /api/layers/markets every 5 min; auto-refreshes.
 */

interface MarketEntry {
  type: 'index' | 'commodity' | 'crypto' | 'fear-greed';
  symbol: string;
  name: string;
  price: number | null;
  change: number | null;
  changePct: number | null;
  currency: string;
}

interface MarketsSnapshot {
  fetchedAt: number;
  indices: MarketEntry[];
  crypto: MarketEntry[];
  fearGreed: MarketEntry | null;
}

import { DataBus } from '../bus/data-bus.js';

// Country → primary index + currency mapping
const COUNTRY_FINANCE: Record<string, { index: string; indexName: string; currency: string }> = {
  'United States': { index: '^GSPC', indexName: 'S&P 500', currency: 'USD' },
  'United Kingdom': { index: '^FTSE', indexName: 'FTSE 100', currency: 'GBP' },
  'Germany': { index: '^GDAXI', indexName: 'DAX', currency: 'EUR' },
  'France': { index: '^FCHI', indexName: 'CAC 40', currency: 'EUR' },
  'Japan': { index: '^N225', indexName: 'Nikkei 225', currency: 'JPY' },
  'China': { index: '000001.SS', indexName: 'SSE Composite', currency: 'CNY' },
  'Hong Kong': { index: '^HSI', indexName: 'Hang Seng', currency: 'HKD' },
  'India': { index: '^BSESN', indexName: 'BSE Sensex', currency: 'INR' },
  'Australia': { index: '^AXJO', indexName: 'ASX 200', currency: 'AUD' },
  'Canada': { index: '^GSPTSE', indexName: 'TSX', currency: 'CAD' },
  'Brazil': { index: '^BVSP', indexName: 'Bovespa', currency: 'BRL' },
  'South Korea': { index: '^KS11', indexName: 'KOSPI', currency: 'KRW' },
  'Saudi Arabia': { index: '^TASI.SR', indexName: 'Tadawul', currency: 'SAR' },
  'United Arab Emirates': { index: '^DFMGI', indexName: 'DFM General', currency: 'AED' },
  'Egypt': { index: '^CASE30', indexName: 'EGX 30', currency: 'EGP' },
  'Turkey': { index: '^XU100', indexName: 'BIST 100', currency: 'TRY' },
  'Russia': { index: 'IMOEX.ME', indexName: 'MOEX Russia', currency: 'RUB' },
  'Singapore': { index: '^STI', indexName: 'STI', currency: 'SGD' },
  'Switzerland': { index: '^SSMI', indexName: 'SMI', currency: 'CHF' },
  'Spain': { index: '^IBEX', indexName: 'IBEX 35', currency: 'EUR' },
  'Italy': { index: 'FTSEMIB.MI', indexName: 'FTSE MIB', currency: 'EUR' },
  'Netherlands': { index: '^AEX', indexName: 'AEX', currency: 'EUR' },
  'Sweden': { index: '^OMX', indexName: 'OMX Stockholm', currency: 'SEK' },
  'Mexico': { index: '^MXX', indexName: 'IPC', currency: 'MXN' },
  'South Africa': { index: '^JNB', indexName: 'JSE All Share', currency: 'ZAR' },
  'Israel': { index: '^TA125.TA', indexName: 'TA-125', currency: 'ILS' },
  'Pakistan': { index: '^KSE100', indexName: 'KSE 100', currency: 'PKR' },
  'Indonesia': { index: '^JKSE', indexName: 'IDX Composite', currency: 'IDR' },
  'Malaysia': { index: '^KLSE', indexName: 'FTSE Bursa', currency: 'MYR' },
  'Qatar': { index: '^QSI', indexName: 'Qatar Exchange', currency: 'QAR' },
  'Kuwait': { index: '^KWSE', indexName: 'Kuwait SE', currency: 'KWD' },
};

let panelEl: HTMLElement | null = null;
let refreshTimer: ReturnType<typeof setInterval> | null = null;

const REFRESH_MS = 5 * 60 * 1_000;

function fmt(n: number | null, decimals = 2): string {
  if (n === null) return '—';
  return n.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

function fmtPct(n: number | null): string {
  if (n === null) return '';
  const sign = n >= 0 ? '+' : '';
  return `${sign}${n.toFixed(2)}%`;
}

function changeColor(pct: number | null): string {
  if (pct === null) return 'var(--text-lo)';
  return pct >= 0 ? 'var(--signal-green, #4caf50)' : 'var(--signal-red, #f55)';
}

function fngColor(score: number | null): string {
  if (score === null) return 'var(--text-lo)';
  if (score < 25) return 'var(--signal-red, #f55)';
  if (score < 45) return 'var(--accent, #e5a100)';
  if (score < 55) return 'var(--text-hi)';
  if (score < 75) return 'var(--signal-green, #4caf50)';
  return '#00d084';
}

function renderRows(entries: MarketEntry[]): string {
  return entries.map((e) => {
    const pctStr = fmtPct(e.changePct);
    const color = changeColor(e.changePct);
    const priceStr = e.type === 'fear-greed'
      ? `<span style="color:${fngColor(e.price)};font-weight:bold">${e.price ?? '—'}/100</span>`
      : `<span>${e.currency === 'USD' ? '$' : ''}${fmt(e.price)}</span>`;
    return `
      <div style="display:flex;justify-content:space-between;align-items:center;
        padding:3px 0;border-bottom:1px solid var(--line-hair)">
        <span style="color:var(--text-lo);font-size:var(--fs-10);min-width:80px;
          overflow:hidden;text-overflow:ellipsis;white-space:nowrap"
          title="${e.name}">${e.symbol}</span>
        <span class="telemetry" style="font-size:var(--fs-11)">${priceStr}</span>
        ${pctStr ? `<span style="color:${color};font-size:var(--fs-10);min-width:60px;text-align:right">${pctStr}</span>` : ''}
      </div>`;
  }).join('');
}

function buildPanel(): HTMLElement {
  const el = document.createElement('div');
  el.id = 'markets-panel';
  el.className = 'panel panel--bracketed markets-panel hidden';
  el.innerHTML = `
    <span class="panel__bracket-bl"></span>
    <span class="panel__bracket-br"></span>
    <div class="panel__title">
      MARKETS
      <span id="markets-age" style="margin-left:auto;font-size:var(--fs-10);color:var(--text-lo)"></span>
      <button class="topbar__mode" id="markets-refresh-btn"
        style="margin-left:8px;font-size:var(--fs-10);padding:2px 6px">↻</button>
      <button class="topbar__mode" id="markets-close-btn"
        style="margin-left:4px;font-size:var(--fs-10);padding:2px 8px">✕</button>
    </div>
    <div class="panel__body" id="markets-body" style="overflow-y:auto;max-height:460px">
      <p style="color:var(--text-lo);font-size:var(--fs-11)">Loading market data…</p>
    </div>
  `;
  return el;
}

async function loadMarkets() {
  const body = document.getElementById('markets-body');
  const ageEl = document.getElementById('markets-age');
  if (!body) return;

  try {
    const res = await fetch('/api/layers/markets');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json() as { data: MarketsSnapshot };
    const snap = json.data;
    if (!snap) throw new Error('No data');

    const age = Math.round((Date.now() - snap.fetchedAt) / 1000);
    if (ageEl) ageEl.textContent = `${age}s ago`;

    let html = '';

    if (snap.fearGreed) {
      html += `<div class="left-rail__section-title" style="margin:4px 0 2px">SENTIMENT</div>`;
      html += renderRows([snap.fearGreed]);
    }

    if (snap.indices.length) {
      html += `<div class="left-rail__section-title" style="margin:8px 0 2px">INDICES & COMMODITIES</div>`;
      html += renderRows(snap.indices);
    }

    if (snap.crypto.length) {
      html += `<div class="left-rail__section-title" style="margin:8px 0 2px">CRYPTO</div>`;
      html += renderRows(snap.crypto);
    }

    if (!html) {
      html = '<p style="color:var(--text-lo);font-size:var(--fs-11)">No market data available.</p>';
    }

    body.innerHTML = html;
  } catch (e) {
    body.innerHTML = `<p style="color:var(--signal-red,#f55);font-size:var(--fs-11)">
      Error loading markets: ${e instanceof Error ? e.message : String(e)}</p>`;
  }
}

function showCountryMarkets(country: string) {
  const body = document.getElementById('markets-body');
  if (!body) return;
  showMarketsPanel();
  const info = COUNTRY_FINANCE[country];
  if (!info) {
    body.innerHTML = `
      <div class="left-rail__section-title" style="margin-bottom:6px">${country.toUpperCase()}</div>
      <p style="color:var(--text-lo);font-size:var(--fs-11)">No direct market data for this country. Showing global snapshot below.</p>`;
    loadMarkets();
    return;
  }
  body.innerHTML = `
    <div class="left-rail__section-title" style="margin-bottom:6px">${country.toUpperCase()}</div>
    <div style="display:flex;justify-content:space-between;padding:3px 0;border-bottom:1px solid var(--line-hair)">
      <span style="color:var(--text-lo);font-size:var(--fs-10)">${info.indexName}</span>
      <span class="telemetry" style="font-size:var(--fs-11);color:var(--text-mid)">see INDICES below</span>
    </div>
    <div style="display:flex;justify-content:space-between;padding:3px 0;border-bottom:1px solid var(--line-hair)">
      <span style="color:var(--text-lo);font-size:var(--fs-10)">CURRENCY</span>
      <span class="telemetry" style="font-size:var(--fs-11)">${info.currency}/USD</span>
    </div>
    <div style="margin-top:6px"></div>`;
  loadMarkets();
}

export function initMarketsPanel() {
  if (!document.getElementById('markets-panel-style')) {
    const style = document.createElement('style');
    style.id = 'markets-panel-style';
    style.textContent = `
      .markets-panel {
        position: fixed;
        top: 48px;
        right: 16px;
        width: 320px;
        z-index: 200;
        max-height: calc(100vh - 96px);
        overflow: hidden;
      }
      .markets-panel.hidden { display: none; }
    `;
    document.head.appendChild(style);
  }

  panelEl = buildPanel();
  document.body.appendChild(panelEl);

  document.getElementById('markets-close-btn')?.addEventListener('click', hideMarketsPanel);
  document.getElementById('markets-refresh-btn')?.addEventListener('click', loadMarkets);

  // Country context from globe right-click
  DataBus.on('markets:show-country', (payload) => {
    const { country } = payload as { country: string };
    showCountryMarkets(country);
  });
}

export function showMarketsPanel() {
  panelEl?.classList.remove('hidden');
  loadMarkets();
  if (!refreshTimer) {
    refreshTimer = setInterval(loadMarkets, REFRESH_MS);
  }
}

export function hideMarketsPanel() {
  panelEl?.classList.add('hidden');
  if (refreshTimer) { clearInterval(refreshTimer); refreshTimer = null; }
}

export function toggleMarketsPanel() {
  if (panelEl?.classList.contains('hidden')) showMarketsPanel();
  else hideMarketsPanel();
}
