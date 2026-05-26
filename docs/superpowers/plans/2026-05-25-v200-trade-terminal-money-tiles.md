# v.200 — Trade-Terminal Money Tiles Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire the 7 "trade terminal" group Money tiles to live viewer pages inside `/reports.html`, completing the Money tab at 16 of 17 LIVE (the 17th is the Pending shortcut which intentionally links out to the Pending tab — no viewer).

**Architecture:** Pure frontend. Each viewer registers into `window.REPORT_VIEWERS[slug]` with `defaultFilters / fetch / renderSummary / renderBody`. All four `/portfolio/*` endpoints and the `/trade/reports` JSON listing already exist (verified in `app/features/trading/routes.js` at lines 371, 447, 548, 61). Zero new SQL, zero migrations, zero backend changes — same shape as v.198 and v.199. Trade terminal `/trade.html` stays frozen per the v.196 closure (memory `trade-terminal CLOSED`).

**Tech Stack:** Vanilla JS, existing `repFmt$ / repFmt$k / repSummaryCard / repCurrentYear` helpers in `app/public/reports.html`, existing `GH_DRILLDOWN / GH_FILTERS / GH_REPORT_STATES` shared components in `app/public/shared/`.

---

## File Structure

All changes are inside two files. No new files.

- **`app/public/reports.html`** — append 7 new `window.REPORT_VIEWERS[slug] = {…}` blocks after the existing v.199 `subs-renewals` block (current end-of-file area). One viewer per tile, grouped under banner comments matching the v.198/v.199 style.
- **`app/version.txt`** — bump `202605.199` → `202605.200`.
- **`STATE.md`** — prepend new `## ✅ v.200 …` section at the top, mirroring v.199's section template.
- **`REPORTS_REDESIGN_HANDOFF.md`** — update line 6 status string + the "v.200 wires the 7 trade-terminal Money tiles" note (now → "v.200 SHIPPED; Money tab COMPLETE at 16/17 LIVE; v.201 = Health").
- **`smoke-test.sh`** — optionally add an assertion that `/api/v1/trade/portfolio/live` and `/api/v1/trade/reports` return JSON (cheap parity check; no new endpoints).

## Endpoint reference (already shipped)

| Slug | Endpoint | Returns |
|---|---|---|
| portfolio-snap | `GET /api/v1/trade/portfolio/live` | `{accounts:[…holdings…], summary:{total_market_value,total_cost_basis,total_gain_loss,total_gain_loss_pct}, _as_of}` |
| portfolio-perf | `GET /api/v1/trade/portfolio/performance?months=12` | `{snapshots:[…], allocation:[{type,value,count}], top_gainers:[…], top_losers:[…]}` |
| concentration | `GET /api/v1/trade/portfolio/correlation` | (verify shape in Task 4; route at line 548) |
| tax-location | `GET /api/v1/trade/portfolio/live` (reused, computed client-side) | (heuristic per Task 5) |
| trade-research / trade-rebalance / trade-tax-opt | `GET /api/v1/trade/reports` then per-row `GET /api/v1/trade/reports/:filename` | `[{filename,date,type,title,ticker}]` |

Saved-AI report `type` values are locked at `app/public/trade.html:4913` as: `'AI Analysis'`, `'Portfolio Snapshot'`, `'AI Rebalancing Advice'`, `'AI Tax Optimization'`. We filter on the last three.

## Tax-location heuristic (decided 2026-05-25)

Flag-rule diagnostic with two amber rules — kept narrow so the tile gives a clear signal without giving advice:

- **bonds-in-taxable** — holding where `asset_type IN ('bond','bond_fund')` AND parent account `tax_treatment === 'taxable'` → amber flag
- **high-div-in-taxable** — holding where `dividend_yield >= 0.03` (3 %) AND parent account `tax_treatment === 'taxable'` → amber flag

Holdings in tax-deferred or Roth accounts never flag. Holdings without `asset_type` or `dividend_yield` data never flag (silent). Summary cards show counts; body table shows flagged holdings ranked by market value with the flag reason; second table below shows the full holdings list grouped by tax_treatment for context.

---

### Task 1: Branch + commit the plan

**Files:**
- Create: `docs/superpowers/plans/2026-05-25-v200-trade-terminal-money-tiles.md` (this file)

- [ ] **Step 1: Verify clean tree on `main`**

Run: `git status` then `git rev-parse --abbrev-ref HEAD`
Expected: `working tree clean`, branch `main`.

- [ ] **Step 2: Commit the plan on main (Ghrava convention — Al works on main directly)**

```bash
git add docs/superpowers/plans/2026-05-25-v200-trade-terminal-money-tiles.md
git commit -m "plan: v.200 trade-terminal Money tiles (7 viewers)"
```

---

### Task 2: `portfolio-snap` viewer — live holdings by account

**Files:**
- Modify: `app/public/reports.html` — append after the v.199 `subs-renewals` block (find with `grep -n "REPORT_VIEWERS\\['subs-renewals'\\]" app/public/reports.html` then insert after its closing `};`).

**What it shows:**
- 4 summary cards: total value · cost basis · total gain/loss (green/red) · gain %
- Body: accounts table (institution / nickname / tax_treatment / market value / cost / gain / gain %) → click row drills into per-account holdings detail
- Drilldown: holdings list for that account (symbol / name / shares / price / market value / gain $ / gain %)

- [ ] **Step 1: Append the viewer block to `app/public/reports.html`**

Insert immediately after the existing `subs-renewals` registration's closing `};`:

```javascript
// ═══════════════════════════════════════════════════════════════
// MONEY · Portfolio snapshot (v.200 — trade-terminal tile)
// ═══════════════════════════════════════════════════════════════
window.REPORT_VIEWERS['portfolio-snap'] = {
  defaultFilters() { return []; },
  async fetch() {
    const r = await fetch('/api/v1/trade/portfolio/live');
    if (!r.ok) throw new Error('HTTP ' + r.status);
    return r.json();
  },
  renderSummary(container, data) {
    const s = data.summary || {};
    const gainColor = (s.total_gain_loss || 0) >= 0 ? 'var(--green,#22c55e)' : 'var(--red,#dc2626)';
    container.innerHTML = ''
      + '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:12px">'
      +   repSummaryCard('Total value',   repFmt$(s.total_market_value))
      +   repSummaryCard('Cost basis',    repFmt$(s.total_cost_basis))
      +   repSummaryCard('Gain / loss',   repFmt$(s.total_gain_loss), gainColor)
      +   repSummaryCard('Return',        ((s.total_gain_loss_pct||0)).toFixed(2) + '%', gainColor)
      + '</div>'
      + '<div style="margin-top:8px;font-size:11px;color:var(--text3)">As of ' + escapeHtml(data._as_of || '—') + ' · source: ' + escapeHtml(data._source || '—') + '</div>';
  },
  renderBody(container, data, _filters, onDrill) {
    const accts = data.accounts || [];
    if (!accts.length) {
      window.GH_REPORT_STATES.empty(container, { title: 'No investment accounts', subtitle: 'Add a financial account in the Money module to populate this report.' });
      return;
    }
    const rows = accts.map(a => {
      const gainColor = (a.gain_loss||0) >= 0 ? 'var(--green,#22c55e)' : 'var(--red,#dc2626)';
      const gainPct   = a.cost_basis > 0 ? ((a.gain_loss/a.cost_basis)*100).toFixed(2) + '%' : '—';
      return '<tr data-id="' + a.id + '" style="cursor:pointer">'
        + '<td>' + escapeHtml(a.institution || '—') + '</td>'
        + '<td>' + escapeHtml(a.nickname || '—') + '</td>'
        + '<td>' + escapeHtml(a.tax_treatment || 'taxable') + '</td>'
        + '<td style="text-align:right">' + repFmt$(a.market_value) + '</td>'
        + '<td style="text-align:right">' + repFmt$(a.cost_basis) + '</td>'
        + '<td style="text-align:right;color:' + gainColor + '">' + repFmt$(a.gain_loss) + '</td>'
        + '<td style="text-align:right;color:' + gainColor + '">' + gainPct + '</td>'
        + '</tr>';
    }).join('');
    container.innerHTML = ''
      + '<table style="width:100%;border-collapse:collapse" class="rep-table">'
      +   '<thead><tr style="text-align:left;color:var(--text3);font-size:11px;text-transform:uppercase">'
      +     '<th>Institution</th><th>Nickname</th><th>Tax</th>'
      +     '<th style="text-align:right">Value</th><th style="text-align:right">Cost</th>'
      +     '<th style="text-align:right">Gain</th><th style="text-align:right">%</th>'
      +   '</tr></thead>'
      +   '<tbody>' + rows + '</tbody>'
      + '</table>';
    container.querySelectorAll('tbody tr').forEach(tr => {
      tr.onclick = () => {
        const id = parseInt(tr.dataset.id, 10);
        const acct = (data.accounts||[]).find(x => x.id === id);
        if (!acct) return;
        const hRows = (acct.holdings || []).map(h => {
          const gainColor = (h.gain_loss_dollar||0) >= 0 ? 'var(--green,#22c55e)' : 'var(--red,#dc2626)';
          return '<tr>'
            + '<td><strong>' + escapeHtml(h.symbol || '—') + '</strong></td>'
            + '<td>' + escapeHtml(h.name || '—') + '</td>'
            + '<td style="text-align:right">' + (h.shares != null ? h.shares.toLocaleString() : '—') + '</td>'
            + '<td style="text-align:right">' + repFmt$(h.price) + '</td>'
            + '<td style="text-align:right">' + repFmt$(h.market_value) + '</td>'
            + '<td style="text-align:right;color:' + gainColor + '">' + repFmt$(h.gain_loss_dollar) + '</td>'
            + '<td style="text-align:right;color:' + gainColor + '">' + (h.gain_loss_pct != null ? h.gain_loss_pct.toFixed(2) + '%' : '—') + '</td>'
            + '</tr>';
        }).join('');
        onDrill({
          title: acct.institution + ' · ' + acct.nickname,
          html: ''
            + '<div style="font-size:12px;color:var(--text3);margin-bottom:8px">' + escapeHtml(acct.account_type || '') + ' · ' + escapeHtml(acct.tax_treatment || 'taxable') + ' · ' + repFmt$(acct.market_value) + ' market value</div>'
            + (hRows
              ? '<table style="width:100%;border-collapse:collapse"><thead><tr style="text-align:left;color:var(--text3);font-size:11px;text-transform:uppercase"><th>Symbol</th><th>Name</th><th style="text-align:right">Shares</th><th style="text-align:right">Price</th><th style="text-align:right">Value</th><th style="text-align:right">Gain</th><th style="text-align:right">%</th></tr></thead><tbody>' + hRows + '</tbody></table>'
              : '<div style="color:var(--text3)">No holdings in this account.</div>'),
        });
      };
    });
  },
};
```

- [ ] **Step 2: Smoke-check in browser**

Start NAS or local dev (`docker compose up` or against prod). Navigate `/reports.html?run=portfolio-snap`. Confirm: summary renders, table renders, clicking a row opens the drilldown with holdings.

- [ ] **Step 3: Commit**

```bash
git add app/public/reports.html
git commit -m "v.200 task 2: wire portfolio-snap viewer (live holdings by account)"
```

---

### Task 3: `portfolio-perf` viewer — 12-month value + allocation + leaders

**Files:**
- Modify: `app/public/reports.html` — append after the Task 2 viewer block.

**What it shows:**
- 4 summary cards: current value · 12-month change $ · 12-month change % · snapshot count
- Body sections: (a) inline SVG line chart of `snapshots[].total_value` over 12 months (mirror the v.199 net-worth chart pattern — 800×220, 3 y-ticks, 3 x-date labels, no Chart.js); (b) allocation table (asset_type / value / % of total / count); (c) top gainers table (5 rows); (d) top losers table (5 rows)
- No drilldown (snapshots are aggregates).

- [ ] **Step 1: Locate the v.199 net-worth SVG chart helper to mirror**

Run: `grep -n "net-worth\|net_worth" app/public/reports.html`
Read the rendering block. The viewer for `net-worth` builds an inline SVG path from snapshot points — copy the exact pattern (don't refactor into a shared helper yet; YAGNI until 3+ consumers per the Path Y rule).

- [ ] **Step 2: Append the viewer block**

```javascript
// ═══════════════════════════════════════════════════════════════
// MONEY · Portfolio performance (v.200 — trade-terminal tile)
// ═══════════════════════════════════════════════════════════════
window.REPORT_VIEWERS['portfolio-perf'] = {
  defaultFilters() { return [{ key:'months', label:'Months', value:'12' }]; },
  async fetch(filters) {
    const m = (filters.find(f => f.key === 'months') || {}).value || '12';
    const r = await fetch('/api/v1/trade/portfolio/performance?months=' + encodeURIComponent(m));
    if (!r.ok) throw new Error('HTTP ' + r.status);
    return r.json();
  },
  renderSummary(container, data) {
    const snaps = data.snapshots || [];
    const first = snaps[0], last = snaps[snaps.length-1];
    const cur   = last ? last.total_value : 0;
    const chg$  = (first && last) ? (last.total_value - first.total_value) : 0;
    const chgPc = (first && first.total_value > 0) ? ((chg$/first.total_value)*100) : 0;
    const color = chg$ >= 0 ? 'var(--green,#22c55e)' : 'var(--red,#dc2626)';
    container.innerHTML = ''
      + '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:12px">'
      +   repSummaryCard('Current value', repFmt$(cur))
      +   repSummaryCard('Change ($)',    repFmt$(chg$), color)
      +   repSummaryCard('Change (%)',    chgPc.toFixed(2) + '%', color)
      +   repSummaryCard('Snapshots',     String(snaps.length))
      + '</div>';
  },
  renderBody(container, data) {
    const snaps = data.snapshots || [];
    const alloc = data.allocation || [];
    const gainers = data.top_gainers || [];
    const losers  = data.top_losers || [];
    if (!snaps.length && !alloc.length) {
      window.GH_REPORT_STATES.empty(container, { title: 'No performance history yet', subtitle: 'Snapshots are written nightly by the portfolio-analytics scheduler. Check back tomorrow.' });
      return;
    }

    // Inline SVG line chart (same pattern as net-worth viewer)
    let chartHtml = '';
    if (snaps.length >= 2) {
      const W=800, H=220, padL=60, padR=20, padT=20, padB=30;
      const xs = snaps.map(s => s.total_value);
      const min = Math.min.apply(null, xs), max = Math.max.apply(null, xs);
      const range = (max-min) || 1;
      const pts = snaps.map((s,i) => {
        const x = padL + (i/(snaps.length-1)) * (W - padL - padR);
        const y = padT + (1 - (s.total_value-min)/range) * (H - padT - padB);
        return x.toFixed(1)+','+y.toFixed(1);
      }).join(' ');
      const yMid = (min+max)/2;
      const fmt = v => '$' + Math.round(v).toLocaleString();
      const xTicks = [0, Math.floor(snaps.length/2), snaps.length-1].map(i => {
        const x = padL + (i/(snaps.length-1)) * (W - padL - padR);
        return '<text x="'+x.toFixed(1)+'" y="'+(H-8)+'" fill="var(--text3)" font-size="10" text-anchor="middle">'+escapeHtml(snaps[i].snapshot_date)+'</text>';
      }).join('');
      chartHtml = '<svg viewBox="0 0 '+W+' '+H+'" style="width:100%;height:220px;background:var(--bg2);border:1px solid var(--border);border-radius:8px">'
        + '<text x="8" y="'+(padT+4)+'" fill="var(--text3)" font-size="10">'+fmt(max)+'</text>'
        + '<text x="8" y="'+(padT + (H-padT-padB)/2 + 4)+'" fill="var(--text3)" font-size="10">'+fmt(yMid)+'</text>'
        + '<text x="8" y="'+(H-padB+4)+'" fill="var(--text3)" font-size="10">'+fmt(min)+'</text>'
        + '<polyline fill="none" stroke="var(--accent,#3b82f6)" stroke-width="2" points="'+pts+'"/>'
        + xTicks
        + '</svg>';
    }

    const totalAlloc = alloc.reduce((s,a) => s + (a.value||0), 0);
    const allocRows = alloc.map(a => {
      const pct = totalAlloc > 0 ? ((a.value/totalAlloc)*100).toFixed(1) : '0.0';
      return '<tr><td>' + escapeHtml(a.type) + '</td>'
        + '<td style="text-align:right">' + repFmt$(a.value) + '</td>'
        + '<td style="text-align:right">' + pct + '%</td>'
        + '<td style="text-align:right">' + (a.count||0) + '</td></tr>';
    }).join('');

    const rowsFor = (arr) => arr.map(h => {
      const c = (h.gain_loss_pct||0) >= 0 ? 'var(--green,#22c55e)' : 'var(--red,#dc2626)';
      return '<tr><td><strong>' + escapeHtml(h.symbol) + '</strong></td>'
        + '<td>' + escapeHtml(h.name || '—') + '</td>'
        + '<td style="text-align:right">' + repFmt$(h.market_value) + '</td>'
        + '<td style="text-align:right;color:' + c + '">' + repFmt$(h.gain_loss_dollar) + '</td>'
        + '<td style="text-align:right;color:' + c + '">' + (h.gain_loss_pct != null ? h.gain_loss_pct.toFixed(2) + '%' : '—') + '</td></tr>';
    }).join('');

    container.innerHTML = ''
      + chartHtml
      + (alloc.length ? '<h3 style="margin:16px 0 8px;font-size:14px">Asset allocation</h3>'
          + '<table style="width:100%;border-collapse:collapse"><thead><tr style="text-align:left;color:var(--text3);font-size:11px;text-transform:uppercase"><th>Type</th><th style="text-align:right">Value</th><th style="text-align:right">% of total</th><th style="text-align:right">Holdings</th></tr></thead><tbody>'+allocRows+'</tbody></table>' : '')
      + (gainers.length ? '<h3 style="margin:16px 0 8px;font-size:14px">Top gainers</h3>'
          + '<table style="width:100%;border-collapse:collapse"><thead><tr style="text-align:left;color:var(--text3);font-size:11px;text-transform:uppercase"><th>Symbol</th><th>Name</th><th style="text-align:right">Value</th><th style="text-align:right">Gain $</th><th style="text-align:right">Gain %</th></tr></thead><tbody>'+rowsFor(gainers)+'</tbody></table>' : '')
      + (losers.length ? '<h3 style="margin:16px 0 8px;font-size:14px">Top losers</h3>'
          + '<table style="width:100%;border-collapse:collapse"><thead><tr style="text-align:left;color:var(--text3);font-size:11px;text-transform:uppercase"><th>Symbol</th><th>Name</th><th style="text-align:right">Value</th><th style="text-align:right">Gain $</th><th style="text-align:right">Gain %</th></tr></thead><tbody>'+rowsFor(losers)+'</tbody></table>' : '');
  },
};
```

- [ ] **Step 3: Smoke-check** `/reports.html?run=portfolio-perf` — confirm chart renders if ≥2 snapshots exist, empty state otherwise.

- [ ] **Step 4: Commit**

```bash
git add app/public/reports.html
git commit -m "v.200 task 3: wire portfolio-perf viewer (12-month value + alloc + leaders)"
```

---

### Task 4: `concentration` viewer — top holdings + sector spread + correlation

**Files:**
- Modify: `app/public/reports.html`

**Endpoint shape** (confirmed from `app/features/trading/routes.js:548-697`):
```js
{
  holdings:    [{ symbol, value, pct, sector }],           // top 10, sorted desc
  total_value: number,
  sectors:     [{ sector, value, pct }],                    // ALL holdings, sorted desc
  correlation_pairs: [{ sym1, sym2, correlation }],         // ranked by |correlation|
  _flags: {
    single_over_10pct: ['AAPL', …],
    sector_over_40pct: ['Technology', …],
    pairs_over_85:     ['AAPL ↔ MSFT (0.92)', …],
  },
  _as_of, _source,
}
```

**What it shows:**
- 4 summary cards: holdings count (top-10) · top-5 % of portfolio · sector count · largest single position % (amber when ≥10 %)
- Body: (a) flags banner if any `_flags` arrays non-empty; (b) top-10 holdings table with horizontal % bars; (c) sector spread table; (d) top-10 correlation pairs table (when present).
- Drill: click holding row → drilldown shows symbol / value / portfolio % / sector + the pairs that include it.

- [ ] **Step 1: Append the viewer block**

```javascript
// ═══════════════════════════════════════════════════════════════
// MONEY · Concentration & correlation (v.200 — trade-terminal tile)
// ═══════════════════════════════════════════════════════════════
window.REPORT_VIEWERS['concentration'] = {
  defaultFilters() { return []; },
  async fetch() {
    const r = await fetch('/api/v1/trade/portfolio/correlation');
    if (!r.ok) throw new Error('HTTP ' + r.status);
    return r.json();
  },
  renderSummary(container, data) {
    const top     = data.holdings || [];
    const sectors = data.sectors  || [];
    const top5pct = top.slice(0,5).reduce((s,h) => s + (h.pct || 0), 0);
    const largest = top[0] ? (top[0].pct || 0) : 0;
    container.innerHTML = ''
      + '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:12px">'
      +   repSummaryCard('Top holdings',     String(top.length))
      +   repSummaryCard('Top-5 % of port',  top5pct.toFixed(1) + '%')
      +   repSummaryCard('Sectors',          String(sectors.length))
      +   repSummaryCard('Largest position', largest.toFixed(1) + '%', largest >= 10 ? 'var(--amber,#f59e0b)' : undefined)
      + '</div>'
      + '<div style="margin-top:8px;font-size:11px;color:var(--text3)">As of ' + escapeHtml(data._as_of || '—') + ' · source: ' + escapeHtml(data._source || '—') + '</div>';
  },
  renderBody(container, data, _filters, onDrill) {
    const top     = data.holdings || [];
    const sectors = data.sectors  || [];
    const pairs   = data.correlation_pairs || [];
    const flags   = data._flags || {};
    if (!top.length) {
      window.GH_REPORT_STATES.empty(container, { title: 'No holdings to analyze', subtitle: 'Add holdings in the Money module first.' });
      return;
    }

    // Flag banner — only if anything tripped
    const flagBits = [];
    if ((flags.single_over_10pct||[]).length) flagBits.push('Single position >10%: ' + flags.single_over_10pct.map(escapeHtml).join(', '));
    if ((flags.sector_over_40pct||[]).length) flagBits.push('Sector >40%: ' + flags.sector_over_40pct.map(escapeHtml).join(', '));
    if ((flags.pairs_over_85||[]).length)     flagBits.push('Highly-correlated pairs (>0.85): ' + flags.pairs_over_85.map(escapeHtml).join(', '));
    const flagBanner = flagBits.length
      ? '<div style="padding:10px;background:var(--bg2);border:1px solid var(--amber,#f59e0b);border-radius:8px;color:var(--amber,#f59e0b);font-size:12px;margin-bottom:12px"><strong>⚠ Concentration flags:</strong><br>' + flagBits.join('<br>') + '</div>'
      : '';

    const maxPct = Math.max.apply(null, top.map(h => h.pct || 0));
    const topRows = top.map(h => {
      const pct = h.pct || 0;
      const barW = maxPct > 0 ? (pct/maxPct)*100 : 0;
      return '<tr data-symbol="' + escapeHtml(h.symbol||'') + '" style="cursor:pointer">'
        + '<td><strong>' + escapeHtml(h.symbol||'—') + '</strong></td>'
        + '<td>' + escapeHtml(h.sector || '—') + '</td>'
        + '<td style="text-align:right">' + repFmt$(h.value) + '</td>'
        + '<td style="text-align:right">' + pct.toFixed(2) + '%</td>'
        + '<td><div style="background:var(--bg);border-radius:3px;height:6px;width:120px"><div style="background:var(--accent,#3b82f6);height:6px;border-radius:3px;width:' + barW.toFixed(1) + '%"></div></div></td>'
        + '</tr>';
    }).join('');

    const sectorRows = sectors.map(s => '<tr>'
      + '<td>' + escapeHtml(s.sector || '—') + '</td>'
      + '<td style="text-align:right">' + repFmt$(s.value) + '</td>'
      + '<td style="text-align:right">' + (s.pct != null ? s.pct.toFixed(1) + '%' : '—') + '</td>'
      + '</tr>').join('');

    const pairRows = pairs.slice(0, 10).map(p => {
      const c = p.correlation || 0;
      const color = Math.abs(c) >= 0.85 ? 'var(--amber,#f59e0b)' : (Math.abs(c) >= 0.6 ? 'var(--text)' : 'var(--text3)');
      return '<tr>'
        + '<td><strong>' + escapeHtml(p.sym1) + '</strong> ↔ <strong>' + escapeHtml(p.sym2) + '</strong></td>'
        + '<td style="text-align:right;color:' + color + '">' + c.toFixed(3) + '</td>'
        + '</tr>';
    }).join('');

    container.innerHTML = ''
      + flagBanner
      + '<h3 style="margin:0 0 8px;font-size:14px">Top 10 holdings</h3>'
      + '<table style="width:100%;border-collapse:collapse"><thead><tr style="text-align:left;color:var(--text3);font-size:11px;text-transform:uppercase"><th>Symbol</th><th>Sector</th><th style="text-align:right">Value</th><th style="text-align:right">% of port</th><th></th></tr></thead><tbody>'+topRows+'</tbody></table>'
      + (sectors.length ? '<h3 style="margin:16px 0 8px;font-size:14px">Sector spread (all holdings)</h3>'
          + '<table style="width:100%;border-collapse:collapse"><thead><tr style="text-align:left;color:var(--text3);font-size:11px;text-transform:uppercase"><th>Sector</th><th style="text-align:right">Value</th><th style="text-align:right">%</th></tr></thead><tbody>'+sectorRows+'</tbody></table>' : '')
      + (pairs.length ? '<h3 style="margin:16px 0 8px;font-size:14px">Top correlated pairs (90-day daily returns)</h3>'
          + '<table style="width:100%;border-collapse:collapse"><thead><tr style="text-align:left;color:var(--text3);font-size:11px;text-transform:uppercase"><th>Pair</th><th style="text-align:right">Correlation</th></tr></thead><tbody>'+pairRows+'</tbody></table>'
          + '<div style="margin-top:6px;font-size:11px;color:var(--text3)">Pairs ≥ 0.85 move nearly together — reducing one of each pair lowers concentration risk.</div>'
          : '');

    container.querySelectorAll('tbody tr[data-symbol]').forEach(tr => {
      tr.onclick = () => {
        const sym = tr.dataset.symbol;
        const h = top.find(x => x.symbol === sym);
        if (!h) return;
        const relatedPairs = pairs.filter(p => p.sym1 === sym || p.sym2 === sym).slice(0, 5);
        const relatedHtml = relatedPairs.length
          ? '<div style="margin-top:8px"><strong>Top correlations involving ' + escapeHtml(sym) + ':</strong><ul style="margin:4px 0 0 16px;padding:0">'
            + relatedPairs.map(p => '<li>' + escapeHtml(p.sym1 === sym ? p.sym2 : p.sym1) + ' — ' + p.correlation.toFixed(3) + '</li>').join('')
            + '</ul></div>'
          : '';
        onDrill({
          title: h.symbol + (h.sector ? ' · ' + h.sector : ''),
          html: '<div style="font-size:13px;line-height:1.6">'
            + '<div>Market value: <strong>' + repFmt$(h.value) + '</strong></div>'
            + '<div>Portfolio weight: <strong>' + (h.pct || 0).toFixed(2) + '%</strong>' + ((h.pct||0) >= 10 ? ' <span style="color:var(--amber,#f59e0b)">(flagged: >10%)</span>' : '') + '</div>'
            + (h.sector ? '<div>Sector: ' + escapeHtml(h.sector) + '</div>' : '')
            + relatedHtml
            + '</div>',
        });
      };
    });
  },
};
```

- [ ] **Step 2: Smoke-check** `/reports.html?run=concentration`. Confirm: summary cards render, flag banner only appears if any `_flags` array is non-empty, holdings/sector/pairs tables render with real values.

- [ ] **Step 3: Commit**

```bash
git add app/public/reports.html
git commit -m "v.200 task 4: wire concentration viewer (top holdings + sectors)"
```

---

### Task 5: `tax-location` viewer — flag suboptimal placement

**Files:**
- Modify: `app/public/reports.html`

**What it shows:**
- 4 summary cards: holdings reviewed · flagged · % flagged · taxable account count
- Body: (a) flagged-holdings table (symbol / name / account / value / flag reason); (b) full holdings grouped by tax_treatment (taxable / tax-deferred / Roth — three sub-tables) for context.
- Drill: click flagged row → drilldown shows holding detail + the rule that fired + a one-liner suggesting which account type would be more efficient.

- [ ] **Step 1: Append the viewer block**

```javascript
// ═══════════════════════════════════════════════════════════════
// MONEY · Tax-location check (v.200 — trade-terminal tile)
// ═══════════════════════════════════════════════════════════════
window.REPORT_VIEWERS['tax-location'] = {
  defaultFilters() { return []; },
  async fetch() {
    const r = await fetch('/api/v1/trade/portfolio/live');
    if (!r.ok) throw new Error('HTTP ' + r.status);
    return r.json();
  },
  renderSummary(container, data) {
    const flat = [];
    (data.accounts||[]).forEach(a => {
      (a.holdings||[]).forEach(h => flat.push({...h, _acct: a}));
    });
    const flagged = flat.filter(h => taxLocFlags(h, h._acct).length > 0);
    const taxableAccts = (data.accounts||[]).filter(a => (a.tax_treatment||'taxable') === 'taxable').length;
    container.innerHTML = ''
      + '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:12px">'
      +   repSummaryCard('Holdings reviewed', String(flat.length))
      +   repSummaryCard('Flagged',           String(flagged.length), flagged.length > 0 ? 'var(--amber,#f59e0b)' : undefined)
      +   repSummaryCard('% flagged',         flat.length > 0 ? ((flagged.length/flat.length)*100).toFixed(1) + '%' : '0%')
      +   repSummaryCard('Taxable accounts',  String(taxableAccts))
      + '</div>';
  },
  renderBody(container, data, _filters, onDrill) {
    const flat = [];
    (data.accounts||[]).forEach(a => (a.holdings||[]).forEach(h => flat.push({...h, _acct: a})));
    const flagged = flat.filter(h => taxLocFlags(h, h._acct).length > 0);
    if (!flat.length) {
      window.GH_REPORT_STATES.empty(container, { title: 'No holdings to review', subtitle: 'Add holdings in the Money module first.' });
      return;
    }
    const flagRows = flagged.map(h => '<tr data-sym="' + escapeHtml(h.symbol) + '" data-acct="' + h._acct.id + '" style="cursor:pointer">'
      + '<td><strong>' + escapeHtml(h.symbol) + '</strong></td>'
      + '<td>' + escapeHtml(h.name||'—') + '</td>'
      + '<td>' + escapeHtml(h._acct.institution + ' · ' + h._acct.nickname) + '</td>'
      + '<td style="text-align:right">' + repFmt$(h.market_value) + '</td>'
      + '<td style="color:var(--amber,#f59e0b)">' + taxLocFlags(h, h._acct).join(', ') + '</td>'
      + '</tr>').join('');

    // Group all holdings by tax_treatment for context
    const buckets = { taxable: [], 'tax-deferred': [], roth: [] };
    flat.forEach(h => {
      const k = (h._acct.tax_treatment || 'taxable').toLowerCase();
      const bucket = buckets[k] ? k : 'taxable';
      buckets[bucket].push(h);
    });
    const ctxSection = (key, label) => {
      const arr = buckets[key];
      if (!arr.length) return '';
      const rows = arr.map(h => '<tr><td><strong>' + escapeHtml(h.symbol) + '</strong></td><td>' + escapeHtml(h.name||'—') + '</td><td>' + escapeHtml(h._acct.nickname) + '</td><td style="text-align:right">' + repFmt$(h.market_value) + '</td></tr>').join('');
      return '<h3 style="margin:16px 0 8px;font-size:14px">' + label + '</h3>'
        + '<table style="width:100%;border-collapse:collapse"><thead><tr style="text-align:left;color:var(--text3);font-size:11px;text-transform:uppercase"><th>Symbol</th><th>Name</th><th>Account</th><th style="text-align:right">Value</th></tr></thead><tbody>' + rows + '</tbody></table>';
    };

    container.innerHTML = ''
      + (flagged.length
          ? '<h3 style="margin:0 0 8px;font-size:14px;color:var(--amber,#f59e0b)">Flagged: ' + flagged.length + ' holding' + (flagged.length===1?'':'s') + '</h3>'
            + '<table style="width:100%;border-collapse:collapse"><thead><tr style="text-align:left;color:var(--text3);font-size:11px;text-transform:uppercase"><th>Symbol</th><th>Name</th><th>Account</th><th style="text-align:right">Value</th><th>Reason</th></tr></thead><tbody>' + flagRows + '</tbody></table>'
          : '<div style="padding:12px;background:var(--bg2);border:1px solid var(--border);border-radius:8px;color:var(--green,#22c55e)">✓ No flagged placements. Your bonds and high-dividend holdings are in tax-advantaged accounts.</div>')
      + ctxSection('taxable',       'Taxable accounts')
      + ctxSection('tax-deferred',  'Tax-deferred accounts (Traditional IRA / 401k)')
      + ctxSection('roth',          'Roth accounts');

    container.querySelectorAll('tbody tr[data-sym]').forEach(tr => {
      tr.onclick = () => {
        const sym = tr.dataset.sym;
        const aid = parseInt(tr.dataset.acct, 10);
        const h = flagged.find(x => x.symbol === sym && x._acct.id === aid);
        if (!h) return;
        const reasons = taxLocFlags(h, h._acct);
        const suggestion = reasons.includes('bonds-in-taxable')
          ? 'Bonds generate ordinary-income interest. Holding them in a Traditional IRA defers that tax until withdrawal.'
          : reasons.includes('high-div-in-taxable')
            ? 'High-dividend holdings generate taxable distributions each year. A Roth IRA shelters those dividends from tax.'
            : '';
        onDrill({
          title: h.symbol + ' · flagged in ' + h._acct.nickname,
          html: '<div style="font-size:13px;line-height:1.7">'
            + '<div><strong>Why flagged:</strong> ' + reasons.join(', ') + '</div>'
            + '<div style="margin-top:8px"><strong>Market value:</strong> ' + repFmt$(h.market_value) + '</div>'
            + '<div><strong>Asset type:</strong> ' + escapeHtml(h.asset_type || '—') + '</div>'
            + '<div><strong>Dividend yield:</strong> ' + (h.dividend_yield != null ? (h.dividend_yield*100).toFixed(2) + '%' : '—') + '</div>'
            + '<div><strong>Account:</strong> ' + escapeHtml(h._acct.institution + ' · ' + h._acct.nickname + ' (' + (h._acct.tax_treatment||'taxable') + ')') + '</div>'
            + (suggestion ? '<div style="margin-top:8px;color:var(--text3)"><em>' + escapeHtml(suggestion) + '</em></div>' : '')
            + '</div>',
        });
      };
    });
  },
};

// tax-location heuristic — only fires inside taxable accounts.
function taxLocFlags(h, acct) {
  const flags = [];
  const tax = (acct.tax_treatment || 'taxable').toLowerCase();
  if (tax !== 'taxable') return flags;
  const at = (h.asset_type || '').toLowerCase();
  if (at === 'bond' || at === 'bond_fund' || at.includes('bond')) flags.push('bonds-in-taxable');
  if (typeof h.dividend_yield === 'number' && h.dividend_yield >= 0.03) flags.push('high-div-in-taxable');
  return flags;
}
```

- [ ] **Step 2: Smoke-check** `/reports.html?run=tax-location`. Confirm: flagged holdings appear in the top table when present, full grouping renders in three sub-sections, drilldown opens with reason + suggestion.

- [ ] **Step 3: Commit**

```bash
git add app/public/reports.html
git commit -m "v.200 task 5: wire tax-location viewer (flag bonds/high-div in taxable)"
```

---

### Task 6: Three saved-AI log viewers — shared factory

**Files:**
- Modify: `app/public/reports.html`

**What each shows (identical except for `type` filter):**
- 4 summary cards: total reports · this year · most recent date · unique tickers
- Body: rows sorted desc by date — date / ticker / title (clickable). No drill (drilldown shows the full saved-report HTML via `/trade/reports/:filename`).
- Filter: `year` filter visible, default = current year. Empty year = all years.

The 3 tiles share one factory function; each registration passes its `type` string and tile slug.

- [ ] **Step 1: Append the factory + three registrations**

```javascript
// ═══════════════════════════════════════════════════════════════
// MONEY · Saved-AI log viewers (v.200 — trade-terminal tiles)
// Shared factory; three tiles differ only by report `type` filter.
// Saved report types are locked in app/public/trade.html:4913 as
// 'AI Analysis' / 'AI Rebalancing Advice' / 'AI Tax Optimization'.
// ═══════════════════════════════════════════════════════════════
function makeSavedAILogViewer(reportType, kindLabel) {
  return {
    defaultFilters() { return [{ key:'year', label:'Year', value: repCurrentYear() }]; },
    async fetch(filters) {
      const r = await fetch('/api/v1/trade/reports');
      if (!r.ok) throw new Error('HTTP ' + r.status);
      const all = await r.json();
      const year = (filters.find(f => f.key === 'year') || {}).value || '';
      return {
        kindLabel,
        rows: all.filter(x => x.type === reportType && (!year || (x.date && x.date.startsWith(year)))),
      };
    },
    renderSummary(container, data) {
      const rows = data.rows || [];
      const thisYr = rows.filter(x => x.date && x.date.startsWith(repCurrentYear())).length;
      const tickers = new Set(rows.map(x => x.ticker).filter(Boolean));
      const latest = rows[0] ? rows[0].date : '—';
      container.innerHTML = ''
        + '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:12px">'
        +   repSummaryCard('Total saved',   String(rows.length))
        +   repSummaryCard('This year',     String(thisYr))
        +   repSummaryCard('Latest',        escapeHtml(latest))
        +   repSummaryCard('Tickers',       String(tickers.size))
        + '</div>';
    },
    renderBody(container, data, _filters, onDrill) {
      const rows = data.rows || [];
      if (!rows.length) {
        window.GH_REPORT_STATES.empty(container, { title: 'No ' + data.kindLabel + ' reports', subtitle: 'Save reports from the trade terminal to populate this log.' });
        return;
      }
      const trs = rows.map(r => '<tr data-fn="' + escapeHtml(r.filename) + '" style="cursor:pointer">'
        + '<td>' + escapeHtml(r.date || '—') + '</td>'
        + '<td><strong>' + escapeHtml(r.ticker || '—') + '</strong></td>'
        + '<td>' + escapeHtml(r.title || '(untitled)') + '</td>'
        + '</tr>').join('');
      container.innerHTML = ''
        + '<table style="width:100%;border-collapse:collapse"><thead><tr style="text-align:left;color:var(--text3);font-size:11px;text-transform:uppercase"><th>Date</th><th>Ticker</th><th>Title</th></tr></thead><tbody>' + trs + '</tbody></table>';
      container.querySelectorAll('tbody tr[data-fn]').forEach(tr => {
        tr.onclick = async () => {
          const fn = tr.dataset.fn;
          try {
            const r2 = await fetch('/api/v1/trade/reports/' + encodeURIComponent(fn));
            if (!r2.ok) throw new Error('HTTP ' + r2.status);
            const full = await r2.json();
            onDrill({
              title: (full.ticker ? full.ticker + ' · ' : '') + (full.title || fn),
              html: '<div style="font-size:12px;color:var(--text3);margin-bottom:8px">' + escapeHtml(full.date || '') + ' · ' + escapeHtml(full.type || '') + '</div>'
                + '<div style="font-size:13px;line-height:1.6;white-space:pre-wrap">' + (full.html || full.body || full.content || escapeHtml(JSON.stringify(full, null, 2))) + '</div>',
            });
          } catch (e) {
            onDrill({ title: 'Error loading report', html: '<div style="color:var(--red,#dc2626)">' + escapeHtml(e.message) + '</div>' });
          }
        };
      });
    },
  };
}

window.REPORT_VIEWERS['trade-research']  = makeSavedAILogViewer('AI Analysis',           'research');
window.REPORT_VIEWERS['trade-rebalance'] = makeSavedAILogViewer('AI Rebalancing Advice', 'rebalancing');
window.REPORT_VIEWERS['trade-tax-opt']   = makeSavedAILogViewer('AI Tax Optimization',   'tax-optimization');
```

**Note on `html` field:** the saved-report file shape may store the body as `html`, `body`, or `content` — the renderer falls back through the three. If the actual shape uses a different field, the JSON pretty-print fallback still gives Al something usable. Adjust during smoke-check if needed.

- [ ] **Step 2: Smoke-check** `/reports.html?run=trade-research` then `?run=trade-rebalance` then `?run=trade-tax-opt`. Confirm each lists matching reports and drilldown opens the saved body.

- [ ] **Step 3: Commit**

```bash
git add app/public/reports.html
git commit -m "v.200 task 6: wire 3 saved-AI log viewers (shared factory)"
```

---

### Task 7: Docs + version bump

**Files:**
- Modify: `app/version.txt`
- Modify: `STATE.md` (prepend new section at top)
- Modify: `REPORTS_REDESIGN_HANDOFF.md` (line 6 status string + next-version note)
- Optional: `smoke-test.sh` (add 2 cheap parity assertions)

- [ ] **Step 1: Bump `app/version.txt`**

```bash
echo "202605.200" > app/version.txt
```

- [ ] **Step 2: Prepend the v.200 section to `STATE.md`**

Insert immediately after the "🔁 Required documentation updates…" block (currently at line ~69) — before the existing `## ✅ v.199 DEPLOYED…` block. Section content:

```markdown
## ✅ v.200 SHIPPED — Reports Redesign Drop 4: Money tab COMPLETE (2026-05-25)

> **Money tab is now 16 of 17 tiles LIVE.** The 17th (`pending-trans`) is the
> intentional shortcut link to the Pending tab — not a viewer.
>
> This drop wires the 7 trade-terminal Money tiles to live viewer pages
> inside `/reports.html`. Pure frontend; zero SQL; zero migrations. Trade
> terminal `/trade.html` stays frozen per the v.196 closure.

### What v.200 ships (6 new viewer blocks; 7 tile slugs)

1. **`portfolio-snap`** — live holdings by account. Reads `/api/v1/trade/portfolio/live`. 4 summary cards (total value / cost / gain / return %), accounts table; row click drills into per-account holdings.

2. **`portfolio-perf`** — 12-month value, allocation, top gainers/losers. Reads `/api/v1/trade/portfolio/performance?months=12`. Inline SVG line chart (same pattern as v.199 net-worth), allocation table, leaders tables. No drill.

3. **`concentration`** — top holdings + sector spread. Reads `/api/v1/trade/portfolio/correlation`. 4 summary cards (holdings / top-5 % / sectors / largest position — amber when ≥10%), top-10 table with horizontal % bars, sector table; row click drills into holding detail.

4. **`tax-location`** — flag bonds and high-dividend holdings in taxable accounts. Reads `/api/v1/trade/portfolio/live` (computed client-side; no new endpoint). Two flag rules: `bonds-in-taxable` and `high-div-in-taxable` (yield ≥ 3 %). Holdings in tax-deferred or Roth accounts never flag. Shows flagged at top + full holdings grouped by tax_treatment below; drilldown explains why + suggests a more efficient account type.

5–7. **`trade-research` / `trade-rebalance` / `trade-tax-opt`** — saved-AI log viewers. Shared factory (`makeSavedAILogViewer`); each tile differs only by the `type` filter applied to `/api/v1/trade/reports` (`'AI Analysis'` / `'AI Rebalancing Advice'` / `'AI Tax Optimization'`). 4 summary cards (total / this year / latest / tickers), sortable table; row click drills into the full saved report via `/trade/reports/:filename`.

### Schema-safety gate

Unchanged from v.199 baseline. v.200 is pure frontend — zero SQL, zero migrations, zero backend changes.

### Tests

v.199 ran SMOKE ONLY per the every-other rule. **This deploy runs FULL Playwright** + smoke. Expected: smoke 8/8 ✅; E2E baseline 115/0 with no new viewer regressions.

### What's still NOT done

- Money: tile #17 `pending-trans` stays as Pending-tab link (intentional)
- Health tab tiles (9) — v.201
- Household tab tiles (11) — v.202
- Family tab tiles (7) — v.203
- Inventory grouping enhancements — queued v.204+ per BACKLOG.md

---

```

- [ ] **Step 3: Update `REPORTS_REDESIGN_HANDOFF.md`**

Edit line 6 — change the status string from `9 of 17 Money tiles LIVE … v.200 wires the 7 trade-terminal Money tiles` to:

```
**Status:** Foundation BUILT in v.197 + Money 5 LIVE wired in v.198 + Money 4 more LIVE wired in v.199 + 7 trade-terminal Money LIVE wired in v.200. **Money tab COMPLETE: 16 of 17 tiles LIVE** (the 17th is the intentional Pending-tab shortcut). 28 tiles remain non-functional across Health/Household/Family ("Coming soon" toast). v.201 = Health (9 tiles). v.202 = Household (11 tiles). v.203 = Family (7 tiles). After Reports Redesign completes, v.204+ picks up Inventory grouping enhancements queued in BACKLOG.md.
```

Also update line 30: change `v.200+ — Household, Family` to `v.200 — Money trade-terminal tiles SHIPPED · v.201 — Health · v.202 — Household · v.203 — Family`.

- [ ] **Step 4: (Optional) Smoke-test parity**

If `smoke-test.sh` already asserts `/api/v1/trade/portfolio/live` and `/api/v1/trade/reports`, skip. Otherwise add cheap parity:

```bash
grep -n "portfolio/live\|trade/reports" smoke-test.sh || \
  echo "→ consider appending two curl-based parity assertions; not blocking"
```

- [ ] **Step 5: Commit**

```bash
git add app/version.txt STATE.md REPORTS_REDESIGN_HANDOFF.md smoke-test.sh
git commit -m "v.200 task 7: docs + version bump (Money tab COMPLETE 16/17 LIVE)"
```

- [ ] **Step 6: STOP — do not package/deploy**

Per the repo principle in NEXT_CHAT_HANDOFF.md ("Do NOT package a zip — Al says 'package' when ready"). After commits land on `main`, surface to Al:
- "v.200 ready. 7 viewers wired, 16/17 Money tiles LIVE. Say 'package' when ready to deploy."

---

## Verification before declaring v.200 done (per `verification-before-completion`)

Before claiming completion, run and paste output for:

1. `git log --oneline -10` — show the 6 task commits
2. `cat app/version.txt` — must be `202605.200`
3. `grep -c "window.REPORT_VIEWERS\\[" app/public/reports.html` — count was 9 after v.199; expect **16** after v.200 (4 standalone in Tasks 2-5 + 3 factory registrations in Task 6 = 7 new slugs)
4. Browser smoke for each of the 7 slugs at `/reports.html?run=<slug>` — confirm summary cards + body render and no console errors

Don't claim "done" until all four show green. Memory rule: gates are Linux-only and won't run on Windows — that's normal; mention in commit messages.
