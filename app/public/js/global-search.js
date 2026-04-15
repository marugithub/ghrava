/**
 * public/js/global-search.js
 * Global search modal — Cmd+K / Ctrl+K
 */
(function() {
  'use strict';

  let _modal = null, _input = null, _results = null;
  let _debounce = null, _selected = -1, _items = [];

  function build() {
    if (_modal) return;
    _modal = document.createElement('div');
    _modal.style.cssText = 'position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,.55);display:none;align-items:flex-start;justify-content:center;padding-top:80px';
    _modal.innerHTML = `
      <div style="width:min(560px,calc(100% - 32px));background:var(--bg2);border:1px solid var(--border2);border-radius:var(--r-xl,14px);overflow:hidden;box-shadow:0 20px 60px rgba(0,0,0,.3)">
        <div style="display:flex;align-items:center;padding:14px 16px;border-bottom:1px solid var(--border);gap:10px">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--text3)" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>
          <input id="ghSearchInput" placeholder="Search everything…" autocomplete="off" style="flex:1;background:none;border:none;outline:none;font-size:15px;color:var(--text)">
          <kbd style="background:var(--bg3);border:1px solid var(--border2);border-radius:4px;padding:2px 7px;font-size:11px;color:var(--text3);font-family:monospace">Esc</kbd>
        </div>
        <div id="ghSearchResults" style="max-height:400px;overflow-y:auto"></div>
        <div style="padding:8px 16px;border-top:1px solid var(--border);font-size:11px;color:var(--text3);display:flex;gap:16px">
          <span>↑↓ navigate</span><span>↵ open</span><span>Esc close</span>
        </div>
      </div>`;
    _modal.addEventListener('mousedown', e => { if (e.target === _modal) close(); });
    document.body.appendChild(_modal);
    _input   = document.getElementById('ghSearchInput');
    _results = document.getElementById('ghSearchResults');
    _input.addEventListener('input', () => { clearTimeout(_debounce); _debounce = setTimeout(doSearch, 200); });
    _input.addEventListener('keydown', onKey);
  }

  function onKey(e) {
    if (e.key === 'ArrowDown') { e.preventDefault(); move(1); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); move(-1); }
    else if (e.key === 'Enter') { e.preventDefault(); activate(); }
    else if (e.key === 'Escape') { close(); }
  }

  document.addEventListener('keydown', e => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'k') { e.preventDefault(); open(); }
  });

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

  let _lastData = null;

  async function doSearch() {
    const q = _input?.value.trim() || '';
    if (q.length < 2) {
      if (_results) _results.innerHTML = '<div style="padding:24px;text-align:center;color:var(--text3);font-size:13px">Type at least 2 characters…</div>';
      _items = []; _selected = -1; return;
    }
    if (_results) _results.innerHTML = '<div style="padding:16px;text-align:center;color:var(--text3);font-size:13px">Searching…</div>';
    try {
      const data = await window.api('GET', `/search?q=${encodeURIComponent(q)}`);
      _lastData = data;
      _items = Object.values(data.groups).flat();
      _selected = _items.length ? 0 : -1;
      render(data);
    } catch(e) {
      if (_results) _results.innerHTML = `<div style="padding:16px;color:var(--red);font-size:13px">Search error: ${e.message}</div>`;
    }
  }

  function esc(s) { return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

  function render(data) {
    if (!_results || !data) return;
    const groups = data.groups || {};
    if (!Object.keys(groups).length) {
      _results.innerHTML = '<div style="padding:24px;text-align:center;color:var(--text3);font-size:13px">No results found</div>';
      return;
    }
    let html = '', idx = 0;
    for (const [mod, items] of Object.entries(groups)) {
      html += `<div style="padding:6px 16px 2px;font-size:10px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:var(--text3)">${esc(mod)}</div>`;
      for (const item of items) {
        const active = idx === _selected;
        html += `<div data-idx="${idx}" data-href="${esc(item.href)}"
          style="display:flex;align-items:center;gap:10px;padding:9px 16px;cursor:pointer;background:${active?'var(--accent-bg)':'transparent'};border-left:2px solid ${active?'var(--accent)':'transparent'}"
          onclick="window.location.href='${esc(item.href)}';window.GH_Search.close()"
          onmouseover="this.dataset.hover='1';document.getElementById('ghSearchResults').querySelectorAll('[data-idx]').forEach(el=>el.style.background='transparent');this.style.background='var(--accent-bg)'">
          <span style="font-size:18px;flex-shrink:0">${esc(item.icon)}</span>
          <div style="flex:1;min-width:0">
            <div style="font-size:14px;color:var(--text);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(item.label)}</div>
            ${item.sub ? `<div style="font-size:11px;color:var(--text3)">${esc(item.sub)}</div>` : ''}
          </div>
        </div>`;
        idx++;
      }
    }
    _results.innerHTML = html;
  }

  function open() {
    build();
    _modal.style.display = 'flex';
    setTimeout(() => _input?.focus(), 50);
    _input.value = '';
    _results.innerHTML = '<div style="padding:24px;text-align:center;color:var(--text3);font-size:13px">Type to search…</div>';
    _items = []; _selected = -1;
  }

  function close() {
    if (_modal) _modal.style.display = 'none';
    if (_input) _input.value = '';
  }

  window.GH_Search = { open, close };
})();
