// app/public/js/pending-report.js
// v.171 — Pending Items Report frontend.
//
// Renders the locked design #29 from _templates.html: list view (default)
// and grid view, both showing the same dataset of bank transactions
// awaiting a link to a record in another module. Picker varies by
// module type so the action is always one tap.
//
// API surface used:
//   GET  /api/v1/pending
//   GET  /api/v1/pending/counts
//   POST /api/v1/pending/link
//   POST /api/v1/pending/dismiss
//   POST /api/v1/pending/skip
//
// Companion record lookups (lightweight):
//   GET /api/v1/finance/accounts          (not used here)
//   GET /api/v1/vehicles                  → cars picker
//   GET /api/v1/medical/medications       → med picker
//   GET /api/v1/inventory/items           → item picker (suggested first)
//   GET /api/v1/subscriptions             → subscription picker
//   GET /api/v1/career/certifications     → cert picker
//
// All buttons use plain-English copy. Three actions per row:
//   primary  — assign / enter cost / track / link
//   skip     — soft-snooze for 30 days
//   dismiss  — "not a [module] expense — stop asking"

(function () {
  'use strict';

  // ─── module configuration ───────────────────────────────────────
  //
  // One entry per source_module the backend can emit. Tells the UI:
  //   icon          — Tabler icon name (no ti- prefix)
  //   label         — plain English filter chip label
  //   pickerLabel   — text in the picker for "what is this for?"
  //   primaryCta    — main action button text
  //   pickRecords   — async fn returning [{ id, label }] options
  //   buildLink     — what to send to POST /pending/link
  //   noPickerOnly  — true for modules that have no record selection
  //                   (e.g. Rx cost entry, HSA receipt upload — those
  //                   redirect the user to the module page)
  //   handler       — alternate handler when no pickRecords
  //
  const MODULES = {
    vehicle: {
      icon:        'gas-station',
      label:       'Vehicles',
      pickerLabel: 'Assign to',
      primaryCta:  'Pick a car',
      pickRecords: fetchVehicles,
      rightType:   'vehicle',
    },
    medication: {
      icon:        'pill',
      label:       'Medical',
      pickerLabel: 'Which prescription?',
      primaryCta:  'Enter cost',
      pickRecords: fetchMedications,
      rightType:   'medication',
    },
    subscription: {
      icon:        'refresh',
      label:       'Subscriptions',
      pickerLabel: 'Add as new or link to existing',
      primaryCta:  'Track it',
      pickRecords: fetchSubscriptions,
      rightType:   'subscription',
      allowAddNew: true,
    },
    inventory: {
      icon:        'package',
      label:       'Inventory',
      pickerLabel: 'Link to inventory item',
      primaryCta:  'Link to item',
      pickRecords: fetchItems,
      rightType:   'item',
    },
    hsa_payment: {
      icon:        'receipt',
      label:       'HSA receipts',
      pickerLabel: 'Add receipt detail',
      primaryCta:  'Upload receipt',
      noPickerOnly: true,
      redirectTo:  '/medical.html?tab=hsa',
      rightType:   'hsa_payment',
    },
    certification: {
      icon:        'certificate',
      label:       'Career',
      pickerLabel: 'Link to certification',
      primaryCta:  'Link to cert',
      pickRecords: fetchCertifications,
      rightType:   'certification',
    },
  };

  // ─── lightweight record fetchers (cached for the page session) ──
  const _cache = {};
  async function _cachedFetch(key, url, mapper) {
    if (_cache[key]) return _cache[key];
    try {
      const r = await fetch(url);
      if (!r.ok) return [];
      const j = await r.json();
      const list = mapper(j) || [];
      _cache[key] = list;
      return list;
    } catch (e) {
      console.warn('pending-report: fetch failed', url, e);
      return [];
    }
  }

  function fetchVehicles() {
    return _cachedFetch('vehicles', '/api/v1/data/table?name=vehicles', j => {
      const rows = (j && j.rows) || j || [];
      return rows
        .filter(v => v.is_active !== 0)
        .map(v => ({
          id: v.id,
          label: v.nickname || [v.year, v.make, v.model].filter(Boolean).join(' ') || `Vehicle #${v.id}`,
        }));
    });
  }

  function fetchMedications() {
    return _cachedFetch('meds', '/api/v1/data/table?name=medications', j => {
      const rows = (j && j.rows) || j || [];
      return rows
        .filter(m => (m.status || 'Active') === 'Active')
        .map(m => ({ id: m.id, label: m.name + (m.dosage ? ' · ' + m.dosage : '') }));
    });
  }

  function fetchSubscriptions() {
    return _cachedFetch('subs', '/api/v1/data/table?name=subscriptions', j => {
      const rows = (j && j.rows) || j || [];
      return rows.map(s => ({
        id: s.id,
        label: s.service_name || s.name || `Subscription #${s.id}`,
      }));
    });
  }

  function fetchItems() {
    return _cachedFetch('items', '/api/v1/data/table?name=items&limit=500', j => {
      const rows = (j && j.rows) || j || [];
      return rows
        .filter(i => i.is_active !== 0)
        .map(i => ({ id: i.id, label: i.name + (i.brand ? ' · ' + i.brand : '') }));
    });
  }

  function fetchCertifications() {
    return _cachedFetch('certs', '/api/v1/data/table?name=certifications', j => {
      const rows = (j && j.rows) || j || [];
      return rows.map(c => ({ id: c.id, label: c.cert_name }));
    });
  }

  // ─── styles ────────────────────────────────────────────────────
  function _injectStyles() {
    if (document.getElementById('pending-report-styles')) return;
    const s = document.createElement('style');
    s.id = 'pending-report-styles';
    s.textContent = `
.pr-shell{padding:4px 0 24px}
.pr-head{display:flex;align-items:baseline;justify-content:space-between;gap:12px;flex-wrap:wrap;margin-bottom:10px}
.pr-title{font-size:20px;font-weight:600;margin:0;color:var(--text)}
.pr-sub{font-size:13px;color:var(--text3)}
.pr-count{font-size:12px;padding:3px 10px;border-radius:999px;background:rgba(217,119,6,.12);color:#a8540a}
.pr-blurb{font-size:13px;color:var(--text2);line-height:1.5;margin:0 0 14px;max-width:760px}
.pr-toolbar-row{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:10px;flex-wrap:wrap}
.pr-chips{display:flex;gap:6px;flex-wrap:wrap}
.pr-chip{font-size:12px;padding:5px 11px;border-radius:999px;background:var(--bg2);border:1px solid var(--border);color:var(--text2);cursor:pointer;display:inline-flex;align-items:center;gap:4px;font-family:inherit}
.pr-chip:hover{border-color:var(--border2);color:var(--text)}
.pr-chip.active{background:var(--text);color:var(--bg);border-color:var(--text)}
.pr-chip .pr-chip-count{opacity:.7;font-size:11px;margin-left:2px}
.pr-empty{padding:60px 20px;text-align:center;color:var(--text3)}
.pr-empty-emoji{font-size:36px;margin-bottom:10px;opacity:.6}

/* ── List view (default) ───────────────────────────────────── */
.pr-list{background:var(--bg);border:1px solid var(--border);border-radius:var(--r-lg);overflow:hidden}
.pr-row{padding:14px 16px;border-top:1px solid var(--border);display:flex;align-items:center;gap:12px;cursor:pointer;transition:background .12s}
.pr-row:first-child{border-top:none}
.pr-row:hover{background:var(--bg2)}
.pr-row.expanded{background:rgba(55,138,221,.06);border-left:3px solid var(--accent);cursor:default}
.pr-icon-wrap{width:34px;height:34px;border-radius:10px;background:var(--bg2);display:flex;align-items:center;justify-content:center;flex-shrink:0}
.pr-icon-wrap svg,.pr-icon-wrap i{font-size:18px;color:var(--text3)}
.pr-row.expanded .pr-icon-wrap{background:var(--bg)}
.pr-body{flex:1;min-width:0}
.pr-prompt{font-size:14px;font-weight:500;color:var(--text);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.pr-meta{font-size:12px;color:var(--text3);margin-top:2px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.pr-chev{font-size:18px;color:var(--text3);transition:transform .15s;flex-shrink:0}
.pr-row.expanded .pr-chev{transform:rotate(180deg)}

/* ── Picker drawer (inline below row in list view) ─────────── */
.pr-picker{margin:12px 0 4px 46px;padding:14px;background:var(--bg);border:1px solid var(--border);border-radius:var(--r-md)}
.pr-picker-label{font-size:12px;color:var(--text3);margin-bottom:8px}
.pr-options{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px}
.pr-opt{font-size:13px;padding:7px 12px;border-radius:var(--r-md);background:var(--bg2);color:var(--text);border:1px solid var(--border);cursor:pointer;font-family:inherit;transition:all .12s}
.pr-opt:hover{border-color:var(--border2)}
.pr-opt.selected{background:var(--accent);color:#fff;border-color:var(--accent)}
.pr-opt.add{color:var(--text3);border-style:dashed}
.pr-remember{display:flex;align-items:center;gap:8px;font-size:13px;color:var(--text);cursor:pointer;margin-top:4px;padding:2px 0}
.pr-remember input{width:16px;height:16px}
.pr-actions{display:flex;gap:8px;margin-top:14px;flex-wrap:wrap}
.pr-btn-primary{flex:1;min-width:120px;font-size:13px;padding:9px 14px;background:var(--text);color:var(--bg);border:none;border-radius:var(--r-md);cursor:pointer;font-weight:600;font-family:inherit}
.pr-btn-primary:disabled{opacity:.5;cursor:not-allowed}
.pr-btn-secondary{font-size:13px;padding:9px 14px;background:transparent;color:var(--text2);border:1px solid var(--border);border-radius:var(--r-md);cursor:pointer;font-family:inherit}
.pr-btn-secondary:hover{background:var(--bg2)}

/* ── Grid view ─────────────────────────────────────────────── */
.pr-grid{display:grid;gap:10px}
.pr-grid[data-cols="2"]{grid-template-columns:repeat(2,1fr)}
.pr-grid[data-cols="3"]{grid-template-columns:repeat(3,1fr)}
.pr-grid[data-cols="4"]{grid-template-columns:repeat(4,1fr)}
.pr-grid[data-cols="5"]{grid-template-columns:repeat(5,1fr)}
@media (max-width:720px){.pr-grid{grid-template-columns:1fr !important}}
.pr-tile{background:var(--bg);border:1px solid var(--border);border-radius:var(--r-lg);padding:14px;display:flex;flex-direction:column;gap:8px;transition:border-color .15s}
.pr-tile:hover{border-color:var(--border2)}
.pr-tile-head{display:flex;align-items:center;gap:8px}
.pr-tile-eyebrow{font-size:11px;color:var(--text3);text-transform:uppercase;letter-spacing:.04em}
.pr-tile-date{font-size:11px;color:var(--text3);margin-left:auto}
.pr-tile-prompt{font-size:14px;font-weight:500;color:var(--text);line-height:1.3}
.pr-tile-meta{font-size:12px;color:var(--text3)}
.pr-tile-cta{width:100%;margin-top:6px;font-size:13px;padding:9px;background:var(--text);color:var(--bg);border:none;border-radius:var(--r-md);cursor:pointer;font-weight:600;font-family:inherit}

/* Modal that opens from grid tile tap */
.pr-modal-scrim{position:fixed;inset:0;background:rgba(0,0,0,.45);z-index:900;display:flex;align-items:center;justify-content:center;padding:20px}
.pr-modal{background:var(--bg);border-radius:var(--r-lg);max-width:480px;width:100%;max-height:88vh;overflow-y:auto;padding:20px}
.pr-modal-title{font-size:16px;font-weight:600;color:var(--text);margin:0 0 4px}
.pr-modal-sub{font-size:13px;color:var(--text3);margin-bottom:14px}

/* The asterisk that lights up gap-flags on cards across the app */
.gh-pending-ast{font-weight:600;cursor:pointer;margin-left:1px}
.gh-pending-ast.amber{color:#BA7517}
.gh-pending-ast.red{color:#A32D2D}
    `;
    document.head.appendChild(s);
  }

  // ─── state ──────────────────────────────────────────────────────
  let _state = {
    rootId:        null,
    container:     null,
    items:         [],
    counts:        {},
    moduleFilter:  'all',
    view:          localStorage.getItem('pending_view') || 'list',
    gridCols:      parseInt(localStorage.getItem('pending_cols')) || 2,
    expandedTxId:  null,
    pendingChoice: {}, // { txId: { right_id, label, remember } }
  };

  // ─── public API ─────────────────────────────────────────────────
  async function mount(rootId) {
    _injectStyles();
    _state.rootId = rootId;
    _state.container = document.getElementById(rootId);
    if (!_state.container) return;
    await reload();
  }

  async function reload() {
    try {
      const [itemsRes, countsRes] = await Promise.all([
        fetch('/api/v1/pending'),
        fetch('/api/v1/pending/counts'),
      ]);
      _state.items  = itemsRes.ok ? (await itemsRes.json()).items   : [];
      _state.counts = countsRes.ok ? (await countsRes.json())        : { total: 0, by_module: {} };
      render();
    } catch (e) {
      _state.container.innerHTML = `<div class="pr-empty"><div class="pr-empty-emoji">⚠️</div>Could not load pending items.<div style="margin-top:8px;font-size:12px">${esc(e.message || e)}</div></div>`;
    }
  }

  // ─── rendering ──────────────────────────────────────────────────
  function render() {
    const total = _state.counts.total || 0;
    const filtered = filterItems(_state.items);

    const html = `
      <div class="pr-shell">

        <div class="pr-head">
          <div style="display:flex;align-items:baseline;gap:10px;flex-wrap:wrap">
            <h2 class="pr-title">Pending items</h2>
            <span class="pr-sub">things needing a quick decision</span>
          </div>
          <span class="pr-count">${total} open</span>
        </div>

        <p class="pr-blurb">Every transaction below was imported from your bank, but the app couldn't tell what it was for. Pick a target once and the rule remembers — future charges from the same place auto-link.</p>

        <div class="pr-toolbar-row">
          <div class="pr-chips">
            ${renderChip('all', 'All', total)}
            ${renderChip('vehicle', 'Vehicles', _state.counts.by_module?.vehicle || 0, 'gas-station')}
            ${renderChip('medication', 'Medical', _state.counts.by_module?.medication || 0, 'pill')}
            ${renderChip('inventory', 'Inventory', _state.counts.by_module?.inventory || 0, 'package')}
            ${renderChip('subscription', 'Subscriptions', _state.counts.by_module?.subscription || 0, 'refresh')}
            ${renderChip('hsa_payment', 'HSA receipts', _state.counts.by_module?.hsa_payment || 0, 'receipt')}
            ${renderChip('certification', 'Career', _state.counts.by_module?.certification || 0, 'certificate')}
          </div>
          <div id="pendingViewToolbar"></div>
        </div>

        <div id="pendingBody"></div>
      </div>
    `;
    _state.container.innerHTML = html;

    // Wire GH_VIEW toolbar — grid + list, default list (best for processing).
    if (window.GH_VIEW && typeof window.GH_VIEW.init === 'function') {
      window.GH_VIEW.init('pendingViewToolbar', 'pending', state => {
        _state.view     = state.view;
        _state.gridCols = state.cols;
        renderBody(filterItems(_state.items));
      }, {
        views:           ['grid', 'list'],
        defaultView:     _state.view,
        defaultCols:     _state.gridCols,
        defaultColsList: 1,
      });
    }
    renderBody(filtered);
  }

  function renderChip(moduleKey, label, count, icon) {
    const active = (_state.moduleFilter === moduleKey);
    const iconHtml = icon ? `<i class="ti ti-${icon}" style="font-size:14px"></i>` : '';
    return `<button class="pr-chip${active ? ' active' : ''}" onclick="PendingReport.setFilter('${moduleKey}')">${iconHtml}${esc(label)}<span class="pr-chip-count">· ${count}</span></button>`;
  }

  function renderBody(items) {
    const body = document.getElementById('pendingBody');
    if (!body) return;

    if (!items.length) {
      body.innerHTML = `<div class="pr-empty">
        <div class="pr-empty-emoji">✨</div>
        <div style="font-size:15px;color:var(--text)">Nothing needs your attention right now.</div>
        <div style="margin-top:6px;font-size:13px;color:var(--text3)">New bank charges will appear here after the next import.</div>
      </div>`;
      return;
    }

    if (_state.view === 'list') body.innerHTML = renderListView(items);
    else                        body.innerHTML = renderGridView(items);
  }

  function renderListView(items) {
    return `<div class="pr-list">
      ${items.map(it => renderListRow(it)).join('')}
    </div>`;
  }

  function renderListRow(it) {
    const m   = MODULES[it.source_module] || {};
    const expanded = (_state.expandedTxId === it.transaction_id);
    const icon = m.icon ? `<i class="ti ti-${m.icon}"></i>` : '<i class="ti ti-help"></i>';
    return `
      <div class="pr-row${expanded ? ' expanded' : ''}" data-tx="${it.transaction_id}">
        <div class="pr-row-click" style="display:flex;align-items:center;gap:12px;flex:1" onclick="PendingReport.toggle(${it.transaction_id})">
          <div class="pr-icon-wrap">${icon}</div>
          <div class="pr-body">
            <div class="pr-prompt">${esc(it.prompt)}</div>
            <div class="pr-meta">${esc(it.tx_description)} · ${fmtMoney(it.tx_amount)} · ${fmtDate(it.tx_date)}${it.suggested_label ? ' · ' + esc(it.suggested_label) : ''}</div>
          </div>
          <div class="pr-chev">›</div>
        </div>
        ${expanded ? `<div style="width:100%">${renderPicker(it)}</div>` : ''}
      </div>
    `;
  }

  function renderGridView(items) {
    return `<div class="pr-grid" data-cols="${_state.gridCols}">
      ${items.map(it => renderGridTile(it)).join('')}
    </div>`;
  }

  function renderGridTile(it) {
    const m = MODULES[it.source_module] || {};
    return `
      <div class="pr-tile">
        <div class="pr-tile-head">
          <div class="pr-icon-wrap" style="width:28px;height:28px;border-radius:8px"><i class="ti ti-${m.icon || 'help'}"></i></div>
          <span class="pr-tile-eyebrow">${esc(m.label || it.source_module)}</span>
          <span class="pr-tile-date">${fmtDate(it.tx_date)}</span>
        </div>
        <div class="pr-tile-prompt">${esc(it.prompt)}</div>
        <div class="pr-tile-meta">${esc(it.tx_description)} · ${fmtMoney(it.tx_amount)}</div>
        <button class="pr-tile-cta" onclick="PendingReport.openModal(${it.transaction_id})">${esc(m.primaryCta || 'Resolve')}</button>
      </div>
    `;
  }

  function renderPicker(it) {
    const m = MODULES[it.source_module];
    if (!m) return '';

    // Modules that can't be picker-resolved (need to leave to the
    // module page) — show a clear "Open in module" button + skip + dismiss.
    if (m.noPickerOnly) {
      return `<div class="pr-picker">
        <div class="pr-picker-label">${esc(m.pickerLabel)}</div>
        <div class="pr-actions">
          <button class="pr-btn-primary" onclick="window.location='${m.redirectTo}'">${esc(m.primaryCta)} →</button>
          <button class="pr-btn-secondary" onclick="PendingReport.skip(${it.transaction_id})">Skip for now</button>
          <button class="pr-btn-secondary" onclick="PendingReport.dismiss(${it.transaction_id})">Not a ${esc(m.label.toLowerCase())} expense</button>
        </div>
      </div>`;
    }

    const choice  = _state.pendingChoice[it.transaction_id] || {};
    const optsId  = `pr-opts-${it.transaction_id}`;

    return `<div class="pr-picker">
      <div class="pr-picker-label">${esc(m.pickerLabel)}</div>
      <div class="pr-options" id="${optsId}">
        <span style="font-size:12px;color:var(--text3)">Loading…</span>
      </div>
      <label class="pr-remember">
        <input type="checkbox" id="pr-remember-${it.transaction_id}" checked />
        Always send <b>${esc(extractMerchantHint(it.tx_description))}</b> charges here
      </label>
      <div class="pr-actions">
        <button class="pr-btn-primary" id="pr-save-${it.transaction_id}" disabled onclick="PendingReport.saveLink(${it.transaction_id})">${esc(m.primaryCta)}</button>
        <button class="pr-btn-secondary" onclick="PendingReport.skip(${it.transaction_id})">Skip for now</button>
        <button class="pr-btn-secondary" onclick="PendingReport.dismiss(${it.transaction_id})">Not a ${esc(m.label.toLowerCase())} expense</button>
      </div>
    </div>`;
  }

  async function _loadPickerOptions(it) {
    const m = MODULES[it.source_module];
    if (!m || !m.pickRecords) return;
    const target = document.getElementById(`pr-opts-${it.transaction_id}`);
    if (!target) return;
    let opts = await m.pickRecords();
    // Move suggested record (if any) to front
    if (it.suggested_record_id) {
      const idx = opts.findIndex(o => o.id === it.suggested_record_id);
      if (idx > 0) opts = [opts[idx], ...opts.slice(0, idx), ...opts.slice(idx + 1)];
    }
    if (!opts.length) {
      target.innerHTML = `<span style="font-size:13px;color:var(--text3)">No ${esc(m.label.toLowerCase())} records yet. <a href="#" onclick="event.preventDefault();PendingReport.skip(${it.transaction_id})">Skip for now</a> and add one in the module.</span>`;
      return;
    }
    target.innerHTML = opts.map(o => `<button class="pr-opt" data-rid="${o.id}" onclick="PendingReport.pick(${it.transaction_id}, ${o.id}, '${esc(o.label).replace(/'/g, '&#39;')}')">${esc(o.label)}</button>`).join('') +
      (m.allowAddNew ? `<a href="${m.rightType === 'subscription' ? '/subscriptions.html' : '#'}" target="_blank" class="pr-opt add">+ Add new</a>` : '');
  }

  // ─── event handlers (exposed via window.PendingReport) ──────────
  function setFilter(moduleKey) {
    _state.moduleFilter = moduleKey;
    _state.expandedTxId = null;
    render();
  }

  function toggle(txId) {
    _state.expandedTxId = (_state.expandedTxId === txId) ? null : txId;
    renderBody(filterItems(_state.items));
    if (_state.expandedTxId === txId) {
      const it = _state.items.find(x => x.transaction_id === txId);
      if (it) _loadPickerOptions(it);
    }
  }

  function pick(txId, recordId, label) {
    _state.pendingChoice[txId] = { right_id: recordId, label };
    // toggle visual selection
    const container = document.getElementById(`pr-opts-${txId}`);
    if (container) {
      container.querySelectorAll('.pr-opt').forEach(b => b.classList.remove('selected'));
      const btn = container.querySelector(`.pr-opt[data-rid="${recordId}"]`);
      if (btn) btn.classList.add('selected');
    }
    const saveBtn = document.getElementById(`pr-save-${txId}`);
    if (saveBtn) saveBtn.disabled = false;
  }

  async function saveLink(txId) {
    const it = _state.items.find(x => x.transaction_id === txId);
    if (!it) return;
    const m = MODULES[it.source_module];
    if (!m || m.noPickerOnly) return;
    const choice = _state.pendingChoice[txId];
    if (!choice) return;
    const remember = !!document.getElementById(`pr-remember-${txId}`)?.checked;

    try {
      const r = await fetch('/api/v1/pending/link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transaction_id:  txId,
          right_type:      m.rightType,
          right_id:        choice.right_id,
          remember_rule:   remember,
          merchant_pattern: null,  // backend derives from tx description
        }),
      });
      if (!r.ok) { alert('Could not save the link.'); return; }
      // Optimistic: drop from local list
      _state.items = _state.items.filter(x => x.transaction_id !== txId);
      _state.counts.total = Math.max(0, (_state.counts.total || 1) - 1);
      if (_state.counts.by_module && _state.counts.by_module[it.source_module]) {
        _state.counts.by_module[it.source_module]--;
      }
      delete _state.pendingChoice[txId];
      _state.expandedTxId = null;
      render();
      _updateTabBadge();
    } catch (e) {
      alert('Could not save the link: ' + (e.message || e));
    }
  }

  async function dismiss(txId) {
    if (!confirm("Stop showing this transaction in the pending list?")) return;
    try {
      await fetch('/api/v1/pending/dismiss', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transaction_id: txId }),
      });
      _removeFromState(txId);
    } catch (e) { alert('Could not dismiss: ' + (e.message || e)); }
  }

  async function skip(txId) {
    try {
      await fetch('/api/v1/pending/skip', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transaction_id: txId, days: 30 }),
      });
      _removeFromState(txId);
    } catch (e) { alert('Could not skip: ' + (e.message || e)); }
  }

  function _removeFromState(txId) {
    const it = _state.items.find(x => x.transaction_id === txId);
    if (!it) return;
    _state.items = _state.items.filter(x => x.transaction_id !== txId);
    _state.counts.total = Math.max(0, (_state.counts.total || 1) - 1);
    if (_state.counts.by_module && _state.counts.by_module[it.source_module]) {
      _state.counts.by_module[it.source_module]--;
    }
    _state.expandedTxId = null;
    render();
    _updateTabBadge();
  }

  function _updateTabBadge() {
    const el = document.getElementById('pendingTabCount');
    if (el) el.textContent = _state.counts.total ? _state.counts.total : '';
  }

  // Grid tile → opens a modal with the same picker
  function openModal(txId) {
    const it = _state.items.find(x => x.transaction_id === txId);
    if (!it) return;
    const m = MODULES[it.source_module] || {};

    const scrim = document.createElement('div');
    scrim.className = 'pr-modal-scrim';
    scrim.onclick = e => { if (e.target === scrim) scrim.remove(); };
    scrim.innerHTML = `
      <div class="pr-modal" onclick="event.stopPropagation()">
        <h3 class="pr-modal-title">${esc(it.prompt)}</h3>
        <div class="pr-modal-sub">${esc(it.tx_description)} · ${fmtMoney(it.tx_amount)} · ${fmtDate(it.tx_date)}</div>
        <div id="pr-modal-picker-${txId}">${renderPicker(it)}</div>
      </div>`;
    document.body.appendChild(scrim);
    _loadPickerOptions(it);

    // Re-bind so picker save closes the modal too
    const origSave = saveLink;
    const closeFn = () => scrim.remove();
    window._pr_modal_close = closeFn;
    // Hook saveLink to close modal after success
    const interval = setInterval(() => {
      if (!_state.items.find(x => x.transaction_id === txId)) {
        closeFn();
        clearInterval(interval);
      }
    }, 250);
    setTimeout(() => clearInterval(interval), 60000);
  }

  // ─── helpers ────────────────────────────────────────────────────
  function filterItems(items) {
    if (_state.moduleFilter === 'all') return items;
    return items.filter(x => x.source_module === _state.moduleFilter);
  }

  function esc(s) {
    if (s == null) return '';
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function fmtMoney(amount) {
    if (amount == null) return '';
    const abs = Math.abs(Number(amount) || 0);
    return '$' + abs.toFixed(2);
  }

  function fmtDate(d) {
    if (!d) return '';
    try {
      const dt = new Date(d);
      return dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    } catch (e) { return d; }
  }

  // Pull a likely merchant name from the tx description for the
  // "remember rule" checkbox label. First token >= 3 chars, capped.
  function extractMerchantHint(desc) {
    if (!desc) return 'these';
    const t = desc.toUpperCase().split(/[\s\d]+/).find(p => p.length >= 3) || desc.split(/\s+/)[0] || 'these';
    return t.slice(0, 20);
  }

  // ─── public ─────────────────────────────────────────────────────
  window.PendingReport = {
    mount,
    reload,
    setFilter,
    toggle,
    pick,
    saveLink,
    dismiss,
    skip,
    openModal,
  };

  // ═══════════════════════════════════════════════════════════════
  // The asterisk helper — universal red/amber gap-indicator that
  // any card on any page can render next to a derived number.
  //
  // Usage in another page:
  //   <span class="gh-pending-target"
  //         data-card="vehicle_fuel" data-record-id="3">
  //     $642<span class="gh-pending-host"></span>
  //   </span>
  //   <script>GhAsterisk.scan();</script>
  //
  // Asks the backend `/api/v1/pending/asterisk?card=…&record_id=…`
  // for each target. If color !== null, fills the `.gh-pending-host`
  // span with an asterisk in the right color + a tooltip.
  // Clicking the asterisk opens the Pending tab with that module
  // pre-filtered.
  // ═══════════════════════════════════════════════════════════════
  async function scanAsterisks() {
    const nodes = document.querySelectorAll('.gh-pending-target');
    for (const node of nodes) {
      const card     = node.dataset.card;
      const recordId = node.dataset.recordId || '';
      try {
        const url = '/api/v1/pending/asterisk?card=' + encodeURIComponent(card) + (recordId ? '&record_id=' + recordId : '');
        const r = await fetch(url);
        if (!r.ok) continue;
        const j = await r.json();
        if (!j.color) continue;
        const host = node.querySelector('.gh-pending-host');
        if (!host) continue;
        host.innerHTML = `<span class="gh-pending-ast ${j.color}" title="${esc(j.hint)}" onclick="window.location='/reports.html?tab=pending'">*</span>`;
      } catch (e) { /* ignore */ }
    }
  }

  window.GhAsterisk = { scan: scanAsterisks };
})();
