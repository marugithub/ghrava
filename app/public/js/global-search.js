/**
 * public/js/global-search.js
 * Unified search modal — Cmd+K / Ctrl+K
 *
 * Searches DATA only (records you create). Tags and other configuration
 * are excluded server-side.
 *
 * Module scoping: NO scope pills. Section headers ARE the filter — click a
 * section header in the results to scope to that module. Click again or
 * click the × on the active header to clear. This keeps the chrome quiet
 * until you actually have results to act on.
 *
 * Pages can pre-open scoped via:  GH_Search.open({ scope: 'Medical' })
 *
 * Backend: GET /api/v1/search?q=<query>&module=<comma-separated-names>
 */
(function() {
  'use strict';

  // Map external short names → backend group names. Used by .open({scope})
  // when a module page wants to pre-scope. Not shown in the UI.
  const SCOPE_ALIAS = {
    inventory: 'Inventory',
    wardrobe:  'Wardrobe',
    documents: 'Documents',
    medical:   'Medical',
    todos:     'Todos',
    finance:   'Finance,Investments,Transactions',
    property:  'Property,Vehicles',
    family:    'Family,Contacts',
    kids:      'Kids',
    books:     'Books',
    career:    'Career',
    'daily-log': 'Daily Log',
    perfume:   'Perfume',
    resources: 'Resources',
  };

  let _modal = null, _input = null, _results = null, _empty = null;
  let _debounce = null, _selected = -1, _items = [];
  let _scope = '';     // current scope (comma-separated group names) — empty = all
  let _lastData = null;

  function build() {
    if (_modal) return;
    _modal = document.createElement('div');
    _modal.id = 'ghSearchModal';
    _modal.style.cssText = 'position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,.5);display:none;align-items:flex-start;justify-content:center;padding-top:96px;backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px)';
    _modal.innerHTML = `
      <div style="width:min(640px,calc(100% - 32px));background:var(--bg2);border-radius:16px;overflow:hidden;box-shadow:0 24px 80px rgba(0,0,0,.35);display:flex;flex-direction:column;max-height:calc(100vh - 160px)">
        <!-- Search field — generous padding, thin separator, no chunky border -->
        <div style="display:flex;align-items:center;padding:18px 20px 16px;gap:14px;border-bottom:1px solid var(--border)">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--text3)" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0;transition:opacity .15s,stroke .15s" id="ghSearchIcon">
            <circle cx="11" cy="11" r="7"/>
            <path d="M20 20l-3.5-3.5"/>
          </svg>
          <input id="ghSearchInput" placeholder="Search" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false"
            style="flex:1;background:none;border:none;outline:none;font-size:17px;color:var(--text);font-family:inherit;font-weight:400;letter-spacing:-0.01em;padding:0">
          <kbd style="background:var(--bg3);border:1px solid var(--border);border-radius:5px;padding:2px 7px;font-size:11px;color:var(--text3);font-family:var(--mono);font-weight:500">esc</kbd>
        </div>

        <!-- Active scope chip (only shown when scoped) -->
        <div id="ghSearchActiveScope" style="display:none;padding:10px 20px;border-bottom:1px solid var(--border);font-size:12px;color:var(--text2)">
          <span style="color:var(--text3)">In</span>
          <span id="ghSearchScopeName" style="color:var(--accent);font-weight:600;margin:0 6px"></span>
          <button onclick="window.GH_Search._clearScope()" type="button"
            style="border:none;background:none;color:var(--text3);cursor:pointer;font-size:13px;padding:0 4px;line-height:1">×</button>
        </div>

        <!-- Results scroll -->
        <div id="ghSearchResults" style="flex:1;overflow-y:auto;background:var(--bg)"></div>

        <!-- Quiet empty state -->
        <div id="ghSearchEmpty" style="display:none;flex-direction:column;align-items:center;justify-content:center;padding:48px 20px;color:var(--text3);gap:10px;flex:1">
          <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="opacity:0.4">
            <circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/>
          </svg>
          <div id="ghSearchEmptyMsg" style="font-size:14px">Type to search</div>
        </div>
      </div>`;
    _modal.addEventListener('mousedown', e => { if (e.target === _modal) close(); });
    document.body.appendChild(_modal);
    _input    = document.getElementById('ghSearchInput');
    _results  = document.getElementById('ghSearchResults');
    _empty    = document.getElementById('ghSearchEmpty');
    _input.addEventListener('input', () => { clearTimeout(_debounce); _debounce = setTimeout(doSearch, 180); });
    _input.addEventListener('keydown', onKey);
    _input.addEventListener('focus', () => {
      const ic = document.getElementById('ghSearchIcon');
      if (ic) { ic.setAttribute('stroke', 'var(--text2)'); ic.style.opacity = '1'; }
    });
    _input.addEventListener('blur', () => {
      const ic = document.getElementById('ghSearchIcon');
      if (ic) { ic.setAttribute('stroke', 'var(--text3)'); ic.style.opacity = '0.7'; }
    });
  }

  function onKey(e) {
    if (e.key === 'ArrowDown') { e.preventDefault(); move(1); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); move(-1); }
    else if (e.key === 'Enter') { e.preventDefault(); activate(); }
    else if (e.key === 'Escape') { close(); }
  }

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

  function _setScope(scope, displayName) {
    _scope = scope || '';
    const bar  = document.getElementById('ghSearchActiveScope');
    const name = document.getElementById('ghSearchScopeName');
    if (bar && name) {
      if (_scope) {
        bar.style.display = 'block';
        name.textContent = displayName || _scope;
      } else {
        bar.style.display = 'none';
      }
    }
    if (_input.value.trim().length >= 2) doSearch();
  }

  async function doSearch() {
    const q = _input?.value.trim() || '';
    showEmpty(q.length < 2 ? (_scope ? 'Type to search' : 'Type to search') : null);
    if (q.length < 2) { _items = []; _selected = -1; return; }
    try {
      const url = `/search?q=${encodeURIComponent(q)}` + (_scope ? `&module=${encodeURIComponent(_scope)}` : '');
      const data = await window.api('GET', url);
      _lastData = data;
      _items = Object.values(data.groups).flat();
      _selected = _items.length ? 0 : -1;
      render(data);
    } catch(e) {
      showEmpty(`Search error: ${e.message || e}`);
    }
  }

  function showEmpty(msg) {
    if (!_empty || !_results) return;
    if (msg == null) {
      _empty.style.display = 'none';
      _results.style.display = 'block';
    } else {
      _results.style.display = 'none';
      _empty.style.display = 'flex';
      const m = document.getElementById('ghSearchEmptyMsg');
      if (m) m.textContent = msg;
    }
  }

  function esc(s) { return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

  function render(data) {
    if (!_results || !data) return;
    const groups = data.groups || {};
    const totalKeys = Object.keys(groups);
    if (!totalKeys.length) {
      showEmpty(_scope ? 'No matches in this section' : 'No matches');
      return;
    }
    showEmpty(null);
    let html = '', idx = 0;
    for (const [mod, items] of Object.entries(groups)) {
      const count = items.length;
      // Section header is the filter affordance. Subtle — just slightly bolder
      // text + count badge; clickable. Hover hint via opacity.
      html += `<button type="button" data-scope-name="${esc(mod)}"
        onclick="window.GH_Search._scopeFromHeader('${esc(mod)}')"
        style="display:flex;align-items:center;gap:8px;width:100%;padding:14px 20px 6px;background:none;border:none;cursor:pointer;font-family:inherit;text-align:left;color:var(--text3);transition:color .15s"
        onmouseover="this.style.color='var(--text2)'" onmouseout="this.style.color='var(--text3)'">
        <span style="font-size:11px;font-weight:600;letter-spacing:0.06em;text-transform:uppercase">${esc(mod)}</span>
        <span style="font-size:11px;color:var(--text3);font-weight:500;letter-spacing:0;text-transform:none">${count}</span>
        <span style="margin-left:auto;font-size:11px;color:var(--text3);opacity:0.6">filter</span>
      </button>`;
      for (const item of items) {
        const active = idx === _selected;
        html += `<div data-idx="${idx}"
          style="display:flex;align-items:center;gap:14px;padding:12px 20px;cursor:pointer;background:${active?'var(--bg3)':'transparent'};transition:background .1s"
          onmouseover="this.style.background='var(--bg3)'"
          onmouseout="this.style.background='${active?'var(--bg3)':'transparent'}'"
          onclick="window.location.href='${esc(item.href)}';window.GH_Search.close()">
          <span style="font-size:20px;flex-shrink:0;width:24px;text-align:center">${esc(item.icon)}</span>
          <div style="flex:1;min-width:0">
            <div style="font-size:15px;color:var(--text);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;letter-spacing:-0.01em">${esc(item.label)}</div>
            ${item.sub ? `<div style="font-size:12px;color:var(--text3);margin-top:2px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(item.sub)}</div>` : ''}
          </div>
        </div>`;
        idx++;
      }
    }
    _results.innerHTML = html;
  }

  function open(opts) {
    build();
    _modal.style.display = 'flex';
    if (opts && typeof opts.scope === 'string' && opts.scope) {
      // Resolve alias if a short name was passed
      const resolved = SCOPE_ALIAS[opts.scope.toLowerCase()] || opts.scope;
      _setScope(resolved, opts.scope.charAt(0).toUpperCase() + opts.scope.slice(1).replace(/-/g,' '));
    } else {
      _setScope('', null);
    }
    setTimeout(() => _input?.focus(), 50);
    if (opts && opts.query) {
      _input.value = opts.query;
      doSearch();
    } else {
      _input.value = '';
      showEmpty('Type to search');
    }
    _items = []; _selected = -1;
  }

  function close() {
    if (_modal) _modal.style.display = 'none';
    if (_input) _input.value = '';
    _setScope('', null);
  }

  // Internal helpers exposed for inline onclicks
  window.GH_Search = {
    open, close,
    _scopeFromHeader(name) {
      // Toggle: if same scope already, clear. Otherwise set.
      if (_scope === name) _setScope('', null);
      else _setScope(name, name);
      _input?.focus();
    },
    _clearScope() { _setScope('', null); _input?.focus(); },
  };
})();
