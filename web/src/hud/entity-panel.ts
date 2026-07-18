/**
 * Entity Graph Panel — Wikidata knowledge base + OFAC sanctions screening.
 * Calls the Python OSINT service via Vite proxy (/osint/entity/*).
 */

const ENTITY_BASE = '/osint/entity';

type EntityTab = 'wikidata-search' | 'wikidata-detail' | 'ofac';

interface TabConfig {
  label: string;
  placeholder: string;
  hint: string;
}

const TABS: Record<EntityTab, TabConfig> = {
  'wikidata-search': { label: 'Entity Search',    placeholder: 'Vladimir Putin',   hint: 'Name search via Wikidata' },
  'wikidata-detail': { label: 'Entity Detail',     placeholder: 'Q7747',            hint: 'Wikidata QID (e.g. Q7747)' },
  'ofac':            { label: 'OFAC Screen',       placeholder: 'Rosneft',          hint: 'Name check vs OFAC SDN list' },
};

let activeTab: EntityTab = 'wikidata-search';
let panelEl: HTMLElement | null = null;

function buildPanel(): HTMLElement {
  const el = document.createElement('div');
  el.id = 'entity-panel';
  el.className = 'panel panel--bracketed entity-panel hidden';
  el.innerHTML = `
    <span class="panel__bracket-bl"></span>
    <span class="panel__bracket-br"></span>
    <div class="panel__title">
      ENTITY GRAPH
      <button class="topbar__mode" id="entity-close-btn" style="margin-left:auto;font-size:var(--fs-10);padding:2px 8px">✕</button>
    </div>
    <div class="panel__body">
      <div id="entity-tabs" style="display:flex;gap:4px;margin-bottom:8px;flex-wrap:wrap"></div>
      <div id="entity-hint" style="color:var(--text-lo);font-size:var(--fs-10);margin-bottom:6px"></div>
      <div style="display:flex;gap:6px;margin-bottom:8px">
        <input id="entity-input" class="cmd-palette__input"
          style="flex:1;font-size:var(--fs-11);padding:4px 8px;height:28px"
          type="text" placeholder="" spellcheck="false" />
        <button id="entity-submit-btn" class="topbar__mode"
          style="padding:4px 12px;font-size:var(--fs-10)">QUERY</button>
      </div>
      <div id="entity-results" style="font-size:var(--fs-11);color:var(--text-lo);
        min-height:40px;overflow-y:auto;max-height:360px;white-space:pre-wrap;word-break:break-all"></div>
    </div>
  `;
  return el;
}

function renderTabs() {
  const tabsEl = document.getElementById('entity-tabs');
  const hintEl = document.getElementById('entity-hint');
  const input = document.getElementById('entity-input') as HTMLInputElement | null;
  if (!tabsEl) return;

  tabsEl.innerHTML = '';
  for (const [key, cfg] of Object.entries(TABS) as [EntityTab, TabConfig][]) {
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

  const current = TABS[activeTab];
  if (hintEl) hintEl.textContent = current.hint;
  if (input) input.placeholder = current.placeholder;
}

function clearResults() {
  const el = document.getElementById('entity-results');
  if (el) { el.textContent = ''; el.style.color = 'var(--text-lo)'; }
}

function setResults(text: string, isError = false) {
  const el = document.getElementById('entity-results');
  if (!el) return;
  el.style.color = isError ? 'var(--signal-red, #f55)' : 'var(--text-hi)';
  el.textContent = text;
}

function renderWikidataSearchResults(data: unknown[]): string {
  if (!data.length) return '(no results)';
  return data
    .map((e) => {
      const item = e as Record<string, unknown>;
      return [
        `▸ [${item['id']}] ${item['label'] ?? '—'}`,
        item['description'] ? `  ${item['description']}` : null,
        item['aliases'] && (item['aliases'] as string[]).length
          ? `  aka: ${(item['aliases'] as string[]).slice(0, 3).join(', ')}`
          : null,
      ]
        .filter(Boolean)
        .join('\n');
    })
    .join('\n\n');
}

function renderWikidataDetail(data: Record<string, unknown>): string {
  const claims = data['claims'] as Record<string, string[]> | undefined;
  const lines: string[] = [
    `[${data['id']}] ${data['label'] ?? '—'}`,
    data['description'] ? `  ${data['description']}` : '',
    (data['aliases'] as string[] | undefined)?.length
      ? `  Aliases: ${(data['aliases'] as string[]).join(', ')}`
      : '',
    '',
  ];
  if (claims) {
    for (const [prop, values] of Object.entries(claims)) {
      lines.push(`  ${prop}: ${values.join(', ')}`);
    }
  }
  lines.push('', `  → ${data['wikidata_url']}`);
  return lines.filter((l) => l !== undefined).join('\n');
}

function renderOfacResult(res: Record<string, unknown>): string {
  const status = res['status'] as string;
  const matches = res['data'] as Record<string, string>[] | undefined;
  const lines: string[] = [
    `STATUS: ${status}`,
    `Screened: ${res['total_screened']} SDN entries`,
    `Matches: ${res['hit_count']}`,
  ];
  if (matches?.length) {
    lines.push('');
    for (const m of matches.slice(0, 10)) {
      lines.push(`  [#${m['ent_num']}] ${m['name']} — ${m['type'] ?? '?'} / ${m['program'] ?? '?'}`);
    }
    if ((res['hit_count'] as number) > 10) {
      lines.push(`  … and ${(res['hit_count'] as number) - 10} more`);
    }
  }
  return lines.join('\n');
}

async function runEntityQuery() {
  const input = document.getElementById('entity-input') as HTMLInputElement | null;
  const value = input?.value.trim();
  if (!value) return;

  setResults('Querying…');

  const endpointMap: Record<EntityTab, string> = {
    'wikidata-search': '/wikidata/search',
    'wikidata-detail': '/wikidata/detail',
    'ofac':            '/ofac/screen',
  };
  const fieldMap: Record<EntityTab, string> = {
    'wikidata-search': 'query',
    'wikidata-detail': 'entity_id',
    'ofac':            'query',
  };

  try {
    const res = await fetch(`${ENTITY_BASE}${endpointMap[activeTab]}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ [fieldMap[activeTab]]: value }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: res.statusText }));
      setResults(`Error ${res.status}: ${JSON.stringify(err)}`, true);
      return;
    }
    const data = (await res.json()) as Record<string, unknown>;
    let text = '';
    if (activeTab === 'wikidata-search') {
      text = renderWikidataSearchResults(data['data'] as unknown[]);
    } else if (activeTab === 'wikidata-detail') {
      text = renderWikidataDetail(data['data'] as Record<string, unknown>);
    } else {
      text = renderOfacResult(data);
    }
    setResults(text);
  } catch (e) {
    setResults(`Network error: ${e instanceof Error ? e.message : String(e)}`, true);
  }
}

export function initEntityPanel() {
  if (!document.getElementById('entity-panel-style')) {
    const style = document.createElement('style');
    style.id = 'entity-panel-style';
    style.textContent = `
      .entity-panel { position:fixed; bottom:48px; left:16px; width:440px; z-index:200; }
      .entity-panel.hidden { display:none; }
    `;
    document.head.appendChild(style);
  }

  panelEl = buildPanel();
  document.body.appendChild(panelEl);

  renderTabs();

  document.getElementById('entity-close-btn')?.addEventListener('click', hideEntityPanel);
  document.getElementById('entity-submit-btn')?.addEventListener('click', runEntityQuery);
  document.getElementById('entity-input')?.addEventListener('keydown', (e) => {
    if ((e as KeyboardEvent).key === 'Enter') runEntityQuery();
  });
}

export function showEntityPanel() {
  panelEl?.classList.remove('hidden');
  renderTabs();
  (document.getElementById('entity-input') as HTMLInputElement | null)?.focus();
}

export function hideEntityPanel() {
  panelEl?.classList.add('hidden');
}

export function toggleEntityPanel() {
  if (panelEl?.classList.contains('hidden')) showEntityPanel();
  else hideEntityPanel();
}
