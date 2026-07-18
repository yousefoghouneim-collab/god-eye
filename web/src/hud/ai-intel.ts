/**
 * AI Intel Panel — fetches briefs and correlation alerts from the API.
 * Populates right-rail AI Intel panel and system status.
 */

export function initAIIntel() {
  const briefBtn = document.getElementById('ai-brief-btn');
  const intelBody = document.getElementById('ai-intel-body');

  if (briefBtn && intelBody) {
    briefBtn.addEventListener('click', () => requestBrief(intelBody));
  }

  // Inject EXPORT button into AI INTEL panel title
  const aiPanel = briefBtn?.closest('.panel');
  if (aiPanel) {
    const exportBtn = document.createElement('button');
    exportBtn.className = 'topbar__mode';
    exportBtn.id = 'ai-export-btn';
    exportBtn.style.cssText = 'margin-left:4px;font-size:var(--fs-10);padding:2px 8px';
    exportBtn.textContent = 'EXPORT';
    exportBtn.title = 'Export situation brief to clipboard / file';
    briefBtn?.insertAdjacentElement('afterend', exportBtn);
    exportBtn.addEventListener('click', exportBrief);
  }

  // Auto-fetch CII + correlations for status
  fetchAnalysisSummary();
  setInterval(fetchAnalysisSummary, 5 * 60 * 1000); // every 5 min
}

async function requestBrief(container: HTMLElement) {
  container.innerHTML = '<p class="telemetry" style="color:var(--signal-amber)">Generating brief...</p>';

  try {
    const res = await fetch('/api/ai/brief');
    if (!res.ok) throw new Error(`${res.status}`);
    const data = await res.json() as { brief: string };
    container.innerHTML = `<pre class="ai-brief">${escHtml(data.brief)}</pre>`;
  } catch (err) {
    container.innerHTML = `<p class="telemetry" style="color:var(--signal-red)">AI offline: ${(err as Error).message}</p>
      <p style="color:var(--text-lo);font-size:var(--fs-11);margin-top:8px">
        Set AI_PROVIDER in .env or start Ollama locally.
      </p>`;
  }
}

async function fetchAnalysisSummary() {
  try {
    // CII
    const ciiRes = await fetch('/api/analysis/cii');
    if (ciiRes.ok) {
      const cii = await ciiRes.json() as { data: Array<{ code: string; name: string; score: number; level: string }> };
      const topPanel = document.getElementById('cii-summary');
      if (topPanel && cii.data.length > 0) {
        topPanel.innerHTML = cii.data.slice(0, 5).map((c) =>
          `<div style="display:flex;justify-content:space-between;padding:2px 0;border-bottom:1px solid var(--line-hair)">
            <span class="hud-label">${c.name}</span>
            <span class="telemetry" style="color:${levelColor(c.level)}">${c.score} ${c.level.toUpperCase()}</span>
          </div>`
        ).join('');
      }
    }

    // Correlations
    const corrRes = await fetch('/api/analysis/correlations');
    if (corrRes.ok) {
      const corr = await corrRes.json() as { data: Array<{ severity: string; title: string; entityCount: number }> };
      const corrPanel = document.getElementById('correlation-summary');
      if (corrPanel && corr.data.length > 0) {
        corrPanel.innerHTML = corr.data.slice(0, 5).map((a) =>
          `<div style="display:flex;justify-content:space-between;padding:2px 0;border-bottom:1px solid var(--line-hair)">
            <span class="hud-label" style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${a.title}</span>
            <span class="telemetry" style="color:${levelColor(a.severity)};margin-left:8px">${a.severity.toUpperCase()}</span>
          </div>`
        ).join('');
      }
    }

    // Update live feeds count in status
    const freshRes = await fetch('/api/freshness');
    if (freshRes.ok) {
      const fresh = await freshRes.json() as Record<string, { status: string }>;
      const activeCount = Object.values(fresh).filter((f) => f.status === 'fresh').length;
      const feedEl = document.querySelector('#system-status .telemetry:last-child');
      if (feedEl) feedEl.textContent = `${activeCount} ACTIVE`;
    }
  } catch {
    // API may not be up
  }
}

function levelColor(level: string): string {
  switch (level) {
    case 'critical': return 'var(--signal-red)';
    case 'high': return 'var(--signal-orange)';
    case 'elevated': case 'medium': return 'var(--signal-amber)';
    default: return 'var(--signal-green)';
  }
}

function escHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// ── One-key situation brief export ──────────────────────────────────────────
async function exportBrief() {
  const exportBtn = document.getElementById('ai-export-btn');
  if (exportBtn) exportBtn.textContent = '…';

  const lines: string[] = [
    '═══════════════════════════════════════════════════════',
    '  GOD-EYE  SITUATION BRIEF',
    `  ${new Date().toISOString().replace('T', ' ').slice(0, 19)}Z`,
    '═══════════════════════════════════════════════════════',
    '',
  ];

  try {
    // CII top risks
    const ciiRes = await fetch('/api/analysis/cii');
    if (ciiRes.ok) {
      const cii = await ciiRes.json() as { data: Array<{ name: string; score: number; level: string }> };
      lines.push('── COUNTRY INSTABILITY INDEX (top 5) ──────────────────');
      cii.data.slice(0, 5).forEach(c => {
        lines.push(`  ${c.name.padEnd(28)} ${c.score.toFixed(1).padStart(5)}  [${c.level.toUpperCase()}]`);
      });
      lines.push('');
    }
  } catch { /* skip */ }

  try {
    // Convergence alerts
    const corrRes = await fetch('/api/analysis/correlations');
    if (corrRes.ok) {
      const corr = await corrRes.json() as { data: Array<{ severity: string; title: string; entityCount: number; lat: number; lng: number }> };
      lines.push('── ACTIVE CONVERGENCE ALERTS ──────────────────────────');
      if (corr.data.length === 0) {
        lines.push('  No active alerts.');
      } else {
        corr.data.slice(0, 8).forEach(a => {
          lines.push(`  [${a.severity.toUpperCase().padEnd(8)}] ${a.title}`);
          lines.push(`             ${a.entityCount} events  @ ${a.lat.toFixed(2)}, ${a.lng.toFixed(2)}`);
        });
      }
      lines.push('');
    }
  } catch { /* skip */ }

  // Layer status
  try {
    const freshRes = await fetch('/api/freshness');
    if (freshRes.ok) {
      const fresh = await freshRes.json() as Record<string, { status: string; source: string }>;
      lines.push('── DATA FEED STATUS ───────────────────────────────────');
      for (const [layer, f] of Object.entries(fresh)) {
        lines.push(`  ${layer.padEnd(16)} ${f.status.toUpperCase().padEnd(8)}  ${f.source}`);
      }
      lines.push('');
    }
  } catch { /* skip */ }

  // AI brief (if present in panel)
  const aiBody = document.getElementById('ai-intel-body');
  const briefText = aiBody?.querySelector('.ai-brief')?.textContent;
  if (briefText) {
    lines.push('── AI ANALYSIS ────────────────────────────────────────');
    lines.push(briefText.trim());
    lines.push('');
  }

  // Visual mode + time context
  const mode = document.documentElement.getAttribute('data-style') ?? 'DEFAULT';
  lines.push('── SESSION CONTEXT ────────────────────────────────────');
  lines.push(`  Visual mode:  ${mode}`);
  const timeMachine = (window as unknown as Record<string, { getTimeRange?: () => { live: boolean; from: number; to: number } }>)['__timeMachine'];
  const tr = timeMachine?.getTimeRange?.();
  if (tr) {
    lines.push(`  Time window:  ${tr.live ? 'LIVE' : `${new Date(tr.from).toISOString().slice(0,16)}Z → ${new Date(tr.to).toISOString().slice(0,16)}Z`}`);
  }
  lines.push('');
  lines.push('═══════════════════════════════════════════════════════');
  lines.push('  Generated by GOD-EYE  —  For authorized use only');
  lines.push('═══════════════════════════════════════════════════════');

  const text = lines.join('\n');

  // Copy to clipboard
  try {
    await navigator.clipboard.writeText(text);
  } catch { /* may fail without focus */ }

  // Also trigger download
  const blob = new Blob([text], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `god-eye-brief-${new Date().toISOString().slice(0, 10)}.txt`;
  a.click();
  URL.revokeObjectURL(url);

  if (exportBtn) {
    exportBtn.textContent = 'COPIED';
    setTimeout(() => { exportBtn.textContent = 'EXPORT'; }, 2000);
  }
}
