/**
 * public/js/global-search.js
 * Global search modal — Cmd+K / Ctrl+K
 *
 * Searches your DATA (records you create): inventory, todos, documents, medical,
 * finance transactions, contacts, family members, kids, books, etc.
 * Does NOT search settings/configuration. Tags are filtered out server-side.
 *
 * Module scoping: a row of pills under the input filters by module. Pages can
 * also pre-open the modal scoped to themselves via:
 *   GH_Search.open({ scope: 'Medical' })
 *
 * Backend: GET /api/v1/search?q=<query>&module=<comma-separated-names>
 */
(function() {
  'use strict';

  // Scope choices shown as pills. "All" passes no module filter (everything).
  // The labels MUST match the group names emitted by features/search/routes.js
  // since the backend filters by exact case-insensitive match on those names.
  const SCOPES = [
    { id: '',              label: 'All' },
    { id: 'Inventory',     label: 'Inventory' },
    { id: 'Wardrobe',      label: 'Wardrobe' },
    { id: 'Documents',     label: 'Documents' },
    { id: 'Medical',       label: 'Medical' },
    { id: 'Todos',         label: 'Todos' },
    { id: 'Finance,Investments,Transactions', label: 'Finance' },
    { id: 'Property,Vehicles', label: 'Property' },
    { id: 'Family,Contacts', label: 'People' },
    { id: 'Kids',          label: 'Kids' },
    { id: 'Books',         label: 'Books' },
    { id: 'Career',        label: 'Career' },
    { id: 'Daily Log',     label: 'Daily Log' },
  ];

  let _modal = null, _input = null, _results = null, _scopeRow = null;
  let _debounce = null, _selected = -1, _items = [];
  let _scope = '';   // current scope id (comma-separated allowed)
  let _lastData = null;

  function build() {
    if (_modal) return;
    _modal = document.createElement('div');
    _modal.style.cssText = 'position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,.55);display:none;align-items:flex-start;justify-content:center;padding-top:80px';
    _modal.innerHTML = `
      <div style="width:min(620px,calc(100% - 32px));background:var(--bg2);border:1px solid var(--border2);border-radius:var(--r-xl,14px);overflow:hidden;box-shadow:0 20px 60px rgba(0,0,0,.3)">
        <div style="display:flex;align-items:center;padding:14px 16px;border-bottom:1px solid var(--border);gap:10px">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--text3)" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>
          <input id="ghSearchInput" placeholder="Search your data…" autocomplete="off" style="flex:1;background:none;border:none;outline:none;font-size:15px;color:var(--text)">
          <kbd style="background:var(--bg3);border:1px solid var(--border2);border-radius:4px;padding:2px 7px;font-size:11px;color:var(--text3);font-family:monospace">Esc</kbd>
        </div>
        <div id="ghSearchScope" style="display:flex;gap:6px;padding:10px 16px;border-bottom:1px solid var(--border);overflow-x:auto;scrollbar-width:thin"></div>
        <div id="ghSearchResults" style="max-height:380px;overflow-y:auto;background:var(--bg)"></div>
        <div style="padding:8px 16px;border-top:1px solid var(--border);font-size:11px;color:var(--text3);display:flex;gap:16px">
          <span>↑↓ navigate</span><span>↵ open</span><span>Esc close</span>
        </div>
      </div>`;
    _modal.addEventListener('mousedown', e => { if (e.target === _modal) close(); });
    document.body.appendChild(_modal);
    _input    = document.getElementById('ghSearchInput');
    _results  = document.getElementById('ghSearchResults');
    _scopeRow = document.getElementById('ghSearchScope');
    _input.addEventListener('input', () => { clearTimeout(_debounce); _debounce = setTimeout(doSearch, 200); });
    _input.addEventListener('keydown', onKey);
    renderScopePills();
  }

  function renderScopePills() {
    if (!_scopeRow) return;
    _scopeRow.innerHTML = SCOPES.map(s => {
      const active = s.id === _scope;
      return `<button data-scope="${esc(s.id)}" type="button"
        style="flex-shrink:0;padding:5px 12px;border-radius:99px;border:1px solid ${active?'var(--accent)':'var(--border)'};background:${active?'var(--accent)':'var(--bg3)'};color:${active?'#fff':'var(--text2)'};font-size:12px;font-weight:600;cursor:pointer">${esc(s.label)}</button>`;
    }).join('');
    _scopeRow.querySelectorAll('button[data-scope]').forEach(btn => {
      btn.addEventListener('click', () => {
        _scope = btn.dataset.scope || '';
        renderScopePills();
        if (_input.value.trim().length >= 2) doSearch();
      });
    });
  }

  function onKey(e) {
    if (e.key === 'ArrowDown') { e.preventDefault(); move(1); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); move(-1); }
    else if (e.key === 'Enter') { e.preventDefault(); activate(); }
    else if (e.key === 'Escape') { close(); }
  }

  // Cmd+K / Ctrl+K is registered globally by keyboard-shortcuts.js — no
  // duplicate listener here.

  function move(dir) {
    _selected = Math.max(-1, Math.min(_items.length - 1, _selected + dir));
    render(_lastData);
    const el = _results?.querySelector(`[data-idx="${_selected}"]`);
    if (el) el.scrollIntoView({ block: 'nearest' });
  }

  function activate() {
    if (_selected >= 0 && _items[_selected]) {
      window.location.href = _items[_selected].href;
      close();
    }
  }

  async function doSearch() {
    const q = _input?.value.trim() || '';
    if (q.length < 2) {
      if (_results) _results.innerHTML = '<div style="padding:24px;text-align:center;color:var(--text3);font-size:13px">Type at least 2 characters…</div>';
      _items = []; _selected = -1; return;
    }
    if (_results) _results.innerHTML = '<div style="padding:16px;text-align:center;color:var(--text3);font-size:13px">Searching…</div>';
    try {
      const url = `/search?q=${encodeURIComponent(q)}` + (_scope ? `&module=${encodeURIComponent(_scope)}` : '');
      const data = await window.api('GET', url);
      _lastData = data;
      _items = Object.values(data.groups).flat();
      _selected = _items.length ? 0 : -1;
      render(data);
    } catch(e) {
      if (_results) _results.innerHTML = `<div style="padding:16px;color:var(--red);font-size:13px">Search error: ${esc(e.message)}</div>`;
    }
  }

  function esc(s) { return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

  function render(data) {
    if (!_results || !data) return;
    const groups = data.groups || {};
    if (!Object.keys(groups).length) {
      _results.innerHTML = '<div style="padding:24px;text-align:center;color:var(--text3);font-size:13px">No results' + (_scope ? ' in this section' : '') + '</div>';
      return;
    }
    let html = '', idx = 0;
    for (const [mod, items] of Object.entries(groups)) {
      html += `<div style="padding:8px 16px 4px;font-size:10px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:var(--text3);background:var(--bg2)">${esc(mod)}</div>`;
      for (const item of items) {
        const active = idx === _selected;
        html += `<div data-idx="${idx}"
          style="display:flex;align-items:center;gap:10px;padding:10px 16px;cursor:pointer;background:${active?'var(--accent-bg)':'transparent'};border-left:3px solid ${active?'var(--accent)':'transparent'}"
          onclick="window.location.href='${esc(item.href)}';window.GH_Search.close()">
          <span style="font-size:18px;flex-shrink:0">${esc(item.icon)}</span>
          <div style="flex:1;min-width:0">
            <div style="font-size:14px;color:var(--text);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(item.label)}</div>
            ${item.sub ? `<div style="font-size:11px;color:var(--text3);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(item.sub)}</div>` : ''}
          </div>
        </div>`;
        idx++;
      }
    }
    _results.innerHTML = html;
  }

  /**
   * Open the modal.
   * @param {Object} opts
   * @param {string} opts.scope    — pre-selected scope id (must match SCOPES.id)
   * @param {string} opts.query    — pre-fill the query
   */
  function open(opts) {
    build();
    _modal.style.display = 'flex';
    if (opts && typeof opts.scope === 'string') {
      // Match against known scopes; fall back to "all"
      const found = SCOPES.find(s => s.id === opts.scope || s.label.toLowerCase() === opts.scope.toLowerCase());
      _scope = found ? found.id : '';
      renderScopePills();
    }
    setTimeout(() => _input?.focus(), 50);
    if (opts && opts.query) {
      _input.value = opts.query;
      doSearch();
    } else {
      _input.value = '';
      _results.innerHTML = '<div style="padding:24px;text-align:center;color:var(--text3);font-size:13px">Type to search…</div>';
    }
    _items = []; _selected = -1;
  }

  function close() {
    if (_modal) _modal.style.display = 'none';
    if (_input) _input.value = '';
  }

  window.GH_Search = { open, close };
})();
