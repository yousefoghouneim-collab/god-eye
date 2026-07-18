/**
 * OSINT Recon Panel — wires the right-rail recon overlay and query forms.
 * Talks directly to the Python OSINT service via Vite proxy (/osint/recon/*).
 */

const OSINT_BASE = '/osint/recon';

type ReconMode = 'ip-geo' | 'dns' | 'rdap' | 'certs' | 'bgp' | 'cve' | 'reverse-dns';

interface ReconConfig {
  label: string;
  endpoint: string;
  field: 'ip' | 'domain' | 'keyword';
  placeholder: string;
}

const RECON_MODES: Record<ReconMode, ReconConfig> = {
  'ip-geo':       { label: 'IP Geolocation',  endpoint: '/ip-geo',       field: 'ip',      placeholder: '8.8.8.8' },
  'dns':          { label: 'DNS Lookup',       endpoint: '/dns',          field: 'domain',  placeholder: 'example.com' },
  'rdap':         { label: 'RDAP / WHOIS',     endpoint: '/rdap',         field: 'domain',  placeholder: 'example.com' },
  'certs':        { label: 'Cert Transparency',endpoint: '/certs',        field: 'domain',  placeholder: 'example.com' },
  'bgp':          { label: 'BGP / ASN',        endpoint: '/bgp',          field: 'ip',      placeholder: '8.8.8.8' },
  'cve':          { label: 'CVE Search',       endpoint: '/cve',          field: 'keyword', placeholder: 'Apache Log4j' },
  'reverse-dns':  { label: 'Reverse DNS',      endpoint: '/reverse-dns',  field: 'ip',      placeholder: '8.8.8.8' },
};

let activeMode: ReconMode = 'ip-geo';
let panelEl: HTMLElement | null = null;

function buildPanel(): HTMLElement {
  const el = document.createElement('div');
  el.id = 'recon-panel';
  el.className = 'panel panel--bracketed recon-panel';
  el.innerHTML = `
    <span class="panel__bracket-bl"></span>
    <span class="panel__bracket-br"></span>
    <div class="panel__title">
      OSINT RECON
      <button class="topbar__mode" id="recon-close-btn" style="margin-left:auto;font-size:var(--fs-10);padding:2px 8px">✕</button>
    </div>
    <div class="panel__body">
      <div id="recon-tabs" style="display:flex;flex-wrap:wrap;gap:4px;margin-bottom:8px"></div>
      <div id="recon-input-row" style="display:flex;gap:6px;margin-bottom:8px">
        <input id="recon-input" class="cmd-palette__input"
          style="flex:1;font-size:var(--fs-11);padding:4px 8px;height:28px"
          type="text" placeholder="8.8.8.8" spellcheck="false" />
        <button id="recon-submit-btn" class="topbar__mode"
          style="padding:4px 12px;font-size:var(--fs-10)">RUN</button>
      </div>
      <div id="recon-results" style="font-size:var(--fs-11);color:var(--text-lo);min-height:40px;
        overflow-y:auto;max-height:320px;white-space:pre-wrap;word-break:break-all"></div>
    </div>
  `;
  return el;
}

function renderTabs() {
  const tabsEl = document.getElementById('recon-tabs');
  if (!tabsEl) return;
  tabsEl.innerHTML = '';
  for (const [key, cfg] of Object.entries(RECON_MODES) as [ReconMode, ReconConfig][]) {
    const btn = document.createElement('button');
    btn.className = `topbar__mode${key === activeMode ? ' topbar__mode--active' : ''}`;
    btn.style.cssText = 'font-size:var(--fs-10);padding:2px 7px';
    btn.textContent = cfg.label;
    btn.addEventListener('click', () => {
      activeMode = key;
      renderTabs();
      const input = document.getElementById('recon-input') as HTMLInputElement | null;
      if (input) input.placeholder = RECON_MODES[key].placeholder;
      clearResults();
    });
    tabsEl.appendChild(btn);
  }
}

function clearResults() {
  const el = document.getElementById('recon-results');
  if (el) { el.textContent = ''; el.style.color = 'var(--text-lo)'; }
}

function setResults(text: string, isError = false) {
  const el = document.getElementById('recon-results');
  if (!el) return;
  el.style.color = isError ? 'var(--signal-red, #f55)' : 'var(--text-hi)';
  el.textContent = text;
}

function formatResult(data: unknown): string {
  return JSON.stringify(data, null, 2);
}

async function runRecon() {
  const input = document.getElementById('recon-input') as HTMLInputElement | null;
  const value = input?.value.trim();
  if (!value) return;

  const cfg = RECON_MODES[activeMode];
  setResults('Querying…');

  try {
    const body: Record<string, string> = { [cfg.field]: value };
    const res = await fetch(`${OSINT_BASE}${cfg.endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: res.statusText }));
      setResults(`Error ${res.status}: ${JSON.stringify(err)}`, true);
      return;
    }
    const data = await res.json();
    setResults(formatResult(data));
  } catch (e) {
    setResults(`Network error: ${e instanceof Error ? e.message : String(e)}`, true);
  }
}

export function initReconPanel() {
  // Inject CSS if not already present
  if (!document.getElementById('recon-panel-style')) {
    const style = document.createElement('style');
    style.id = 'recon-panel-style';
    style.textContent = `
      .recon-panel { position:fixed; bottom:48px; right:16px; width:420px; z-index:200; }
      .recon-panel.hidden { display:none; }
    `;
    document.head.appendChild(style);
  }

  panelEl = buildPanel();
  panelEl.classList.add('hidden');
  document.body.appendChild(panelEl);

  renderTabs();

  document.getElementById('recon-close-btn')?.addEventListener('click', hideReconPanel);
  document.getElementById('recon-submit-btn')?.addEventListener('click', runRecon);
  document.getElementById('recon-input')?.addEventListener('keydown', (e) => {
    if ((e as KeyboardEvent).key === 'Enter') runRecon();
  });
}

export function showReconPanel() {
  panelEl?.classList.remove('hidden');
  renderTabs();
  (document.getElementById('recon-input') as HTMLInputElement | null)?.focus();
}

export function hideReconPanel() {
  panelEl?.classList.add('hidden');
}

export function toggleReconPanel() {
  if (panelEl?.classList.contains('hidden')) showReconPanel();
  else hideReconPanel();
}
