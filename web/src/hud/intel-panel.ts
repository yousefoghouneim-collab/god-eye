/**
 * Intel Panel — Telegram channel preview + Shodan host intelligence.
 * Opt-in: Shodan requires SHODAN_API_KEY on the OSINT service.
 */

const INTEL_BASE = '/osint/intel';

type IntelTab = 'telegram' | 'shodan';

interface TabConfig { label: string; placeholder: string; hint: string }

const TABS: Record<IntelTab, TabConfig> = {
  telegram: {
    label: 'Telegram',
    placeholder: 'durov (public channel handle)',
    hint: 'Public Telegram channel — no key required',
  },
  shodan: {
    label: 'Shodan',
    placeholder: '8.8.8.8',
    hint: 'Host intelligence — requires SHODAN_API_KEY on server',
  },
};

let activeTab: IntelTab = 'telegram';
let panelEl: HTMLElement | null = null;

function buildPanel(): HTMLElement {
  const el = document.createElement('div');
  el.id = 'intel-panel';
  el.className = 'panel panel--bracketed intel-panel hidden';
  el.innerHTML = `
    <span class="panel__bracket-bl"></span>
    <span class="panel__bracket-br"></span>
    <div class="panel__title">
      SIGINT
      <button class="topbar__mode" id="intel-close-btn"
        style="margin-left:auto;font-size:var(--fs-10);padding:2px 8px">✕</button>
    </div>
    <div class="panel__body">
      <div id="intel-tabs" style="display:flex;gap:4px;margin-bottom:6px"></div>
      <div id="intel-hint" style="color:var(--text-lo);font-size:var(--fs-10);margin-bottom:6px"></div>
      <div style="display:flex;gap:6px;margin-bottom:8px">
        <input id="intel-input" class="cmd-palette__input"
          style="flex:1;font-size:var(--fs-11);padding:4px 8px;height:28px"
          type="text" placeholder="" spellcheck="false" />
        <button id="intel-submit-btn" class="topbar__mode"
          style="padding:4px 12px;font-size:var(--fs-10)">RUN</button>
      </div>
      <div id="intel-results"
        style="font-size:var(--fs-11);color:var(--text-lo);min-height:40px;
          overflow-y:auto;max-height:400px;white-space:pre-wrap;word-break:break-all"></div>
    </div>
  `;
  return el;
}

function renderTabs() {
  const tabsEl = document.getElementById('intel-tabs');
  const hintEl = document.getElementById('intel-hint');
  const input = document.getElementById('intel-input') as HTMLInputElement | null;
  if (!tabsEl) return;
  tabsEl.innerHTML = '';
  for (const [key, cfg] of Object.entries(TABS) as [IntelTab, TabConfig][]) {
    const btn = document.createElement('button');
    btn.className = `topbar__mode${key === activeTab ? ' topbar__mode--active' : ''}`;
    btn.style.cssText = 'font-size:var(--fs-10);padding:2px 7px';
    btn.textContent = cfg.label;
    btn.addEventListener('click', () => {
      activeTab = key;
      renderTabs();
      clearResults();
    });
    tabsEl.appendChild(btn);
  }
  if (hintEl) hintEl.textContent = TABS[activeTab].hint;
  if (input) input.placeholder = TABS[activeTab].placeholder;
}

function clearResults() {
  const el = document.getElementById('intel-results');
  if (el) { el.textContent = ''; el.style.color = 'var(--text-lo)'; }
}

function setResults(text: string, isError = false) {
  const el = document.getElementById('intel-results');
  if (!el) return;
  el.style.color = isError ? 'var(--signal-red, #f55)' : 'var(--text-hi)';
  el.textContent = text;
}

interface TgMessage { id: string; date: string; text: string }
interface TgResult {
  channel: string; title: string; subscribers: string | null;
  message_count: number; data: TgMessage[];
}

function renderTelegram(r: TgResult): string {
  const lines: string[] = [
    `CHANNEL: @${r.channel} — ${r.title}`,
    r.subscribers ? `  ${r.subscribers}` : '',
    `  ${r.message_count} messages retrieved`,
    '',
  ];
  for (const msg of r.data) {
    lines.push(`[${msg.date ? msg.date.slice(0, 10) : '—'}] #${msg.id}`);
    if (msg.text) lines.push(`  ${msg.text.slice(0, 280)}`);
    lines.push('');
  }
  return lines.filter((l) => l !== undefined).join('\n').trim();
}

interface ShodanService { port: number; transport: string; product: string; version: string; banner: string }
interface ShodanData {
  country: string; city: string; org: string; isp: string; asn: string;
  hostnames: string[]; domains: string[]; ports: number[];
  tags: string[]; vulns: string[]; services: ShodanService[];
  last_update: string;
}
interface ShodanResult { ip: string; data: ShodanData }

function renderShodan(r: ShodanResult): string {
  const d = r.data;
  const lines: string[] = [
    `IP: ${r.ip}`,
    `Location: ${[d.city, d.country].filter(Boolean).join(', ') || '—'}`,
    `Org: ${d.org ?? '—'} / ${d.isp ?? '—'}`,
    `ASN: ${d.asn ?? '—'}`,
    d.hostnames?.length ? `Hostnames: ${d.hostnames.join(', ')}` : '',
    d.tags?.length ? `Tags: ${d.tags.join(', ')}` : '',
    `Open ports: ${d.ports?.join(', ') || '—'}`,
    '',
  ];
  if (d.vulns?.length) {
    lines.push(`VULNERABILITIES (${d.vulns.length}):`);
    for (const v of d.vulns.slice(0, 10)) lines.push(`  ${v}`);
    lines.push('');
  }
  if (d.services?.length) {
    lines.push('SERVICES:');
    for (const s of d.services) {
      const desc = [s.product, s.version].filter(Boolean).join(' ');
      lines.push(`  :${s.port}/${s.transport ?? '?'}  ${desc || '—'}`);
      if (s.banner?.trim()) lines.push(`    ${s.banner.slice(0, 120).replace(/\n/g, ' ')}`);
    }
  }
  if (d.last_update) lines.push(`\nLast scan: ${d.last_update}`);
  return lines.filter((l) => l !== undefined).join('\n').trim();
}

async function runIntelQuery() {
  const input = document.getElementById('intel-input') as HTMLInputElement | null;
  const value = input?.value.trim();
  if (!value) return;

  setResults('Querying…');

  const fieldMap: Record<IntelTab, string> = { telegram: 'channel', shodan: 'ip' };
  const endpoint = `${INTEL_BASE}/${activeTab}`;

  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ [fieldMap[activeTab]]: value }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: res.statusText }));
      setResults(`Error ${res.status}: ${(err as Record<string, string>)['detail'] ?? JSON.stringify(err)}`, true);
      return;
    }
    const data = await res.json();
    let text = '';
    if (activeTab === 'telegram') {
      text = renderTelegram(data as TgResult);
    } else {
      text = renderShodan(data as ShodanResult);
    }
    setResults(text || '(empty response)');
  } catch (e) {
    setResults(`Network error: ${e instanceof Error ? e.message : String(e)}`, true);
  }
}

export function initIntelPanel() {
  if (!document.getElementById('intel-panel-style')) {
    const style = document.createElement('style');
    style.id = 'intel-panel-style';
    style.textContent = `
      .intel-panel { position:fixed; top:48px; left:16px; width:440px; z-index:200; }
      .intel-panel.hidden { display:none; }
    `;
    document.head.appendChild(style);
  }

  panelEl = buildPanel();
  document.body.appendChild(panelEl);

  renderTabs();
  document.getElementById('intel-close-btn')?.addEventListener('click', hideIntelPanel);
  document.getElementById('intel-submit-btn')?.addEventListener('click', runIntelQuery);
  document.getElementById('intel-input')?.addEventListener('keydown', (e) => {
    if ((e as KeyboardEvent).key === 'Enter') runIntelQuery();
  });
}

export function showIntelPanel() {
  panelEl?.classList.remove('hidden');
  renderTabs();
  (document.getElementById('intel-input') as HTMLInputElement | null)?.focus();
}

export function hideIntelPanel() {
  panelEl?.classList.add('hidden');
}

export function toggleIntelPanel() {
  if (panelEl?.classList.contains('hidden')) showIntelPanel();
  else hideIntelPanel();
}
