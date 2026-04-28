/**
 * lt-core.js — Ghrava shared core
 * Include on every page BEFORE page-specific scripts.
 *
 * Provides:
 *   $()           getElementById shorthand
 *   esc()         HTML-escape a string
 *   formatDate()  "Jan 5, 2025" from "2025-01-05"
 *   toast()       show/hide toast notification
 *   confirm()     shared confirm-delete overlay
 *   api()         authenticated fetch wrapper (redirects on 401)
 *   silentGet()   authenticated GET, returns [] on any error
 *   onDrawerBg()  close drawer when clicking its backdrop
 *   spinner()     returns spinner HTML string
 *   LT.authToken  the current auth token (read/write)
 */

// ── DOM helper ────────────────────────────────────────────────
window.$ = id => document.getElementById(id);

// ── HTML escape ───────────────────────────────────────────────
window.esc = s => String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');

// ── Date formatting ───────────────────────────────────────────
window.formatDate = function(d) {
  if (!d) return '';
  const [y, m, day] = d.split('-');
  const mo = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${mo[parseInt(m)-1]} ${parseInt(day)}, ${y}`;
};

window.formatDateRelative = function(iso) {
  if (!iso) return '';
  const todayStr = new Date().toISOString().slice(0, 10);
  const yesterdayStr = (() => { const d = new Date(); d.setDate(d.getDate()-1); return d.toISOString().slice(0,10); })();
  if (iso === todayStr) return 'Today';
  if (iso === yesterdayStr) return 'Yesterday';
  return new Date(iso + 'T12:00:00').toLocaleDateString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric', year: 'numeric'
  });
};

window.today = () => new Date().toISOString().slice(0, 10);

// ── Currency & date helpers (shared across all pages) ─────────
/**
 * fmt$(n) — compact dollar amount, no cents, absolute value
 *   fmt$(1234.56) → "$1,235"
 *   fmt$(-500)    → "$500"  (shows absolute — caller decides sign)
 */
window.fmt$ = n => '$' + (Math.abs(Number(n) || 0))
  .toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });

/**
 * fmtDate(iso) — short date without year  "Jan 5"
 * For dates with year use window.formatDate() → "Jan 5, 2025"
 */
window.fmtDate = function(iso) {
  if (!iso) return '';
  const [, m, d] = iso.split('-');
  const mo = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${mo[+m - 1]} ${+d}`;
};

// ── Spinner HTML ──────────────────────────────────────────────
window.spinner = (msg = 'Loading…') =>
  `<div class="spinner"><div class="spin"></div>${msg ? ` ${esc(msg)}` : ''}</div>`;

// ── Auth token ────────────────────────────────────────────────
window.LT = window.LT || {};
LT.authToken = localStorage.getItem('lt_token') || '';

// ── Authenticated fetch ───────────────────────────────────────
// ══════════════════════════════════════════════════════════════
// GH_LOG — Client-side circular log buffer
// Captures API calls, errors, and auth events.
// View in Settings → Diagnostics → Client Log, or download via GH_LOG.download()
// ══════════════════════════════════════════════════════════════
window.GH_LOG = (function () {
  const MAX   = 200;
  const _buf  = [];

  function _push(level, msg, data) {
    const entry = {
      ts:    new Date().toISOString(),
      level, // 'info' | 'warn' | 'error'
      msg,
      data:  data ? JSON.stringify(data) : undefined,
      page:  location.pathname.split('/').pop() || 'index'
    };
    _buf.push(entry);
    if (_buf.length > MAX) _buf.shift();
  }

  return {
    info:    (msg, data) => _push('info',  msg, data),
    warn:    (msg, data) => _push('warn',  msg, data),
    error:   (msg, data) => _push('error', msg, data),
    entries: ()          => [..._buf],
    clear:   ()          => { _buf.length = 0; },
    download: () => {
      const txt = _buf.map(e =>
        `[${e.ts}] [${e.level.toUpperCase()}] [${e.page}] ${e.msg}${e.data ? ' | ' + e.data : ''}`
      ).join('\n');
      const a = document.createElement('a');
      a.href = 'data:text/plain;charset=utf-8,' + encodeURIComponent(txt);
      a.download = `ghrava-client-log-${new Date().toISOString().slice(0,10)}.txt`;
      a.click();
    }
  };
})();

// Capture global JS errors into GH_LOG
window.addEventListener('error', e => {
  GH_LOG.error(`Uncaught: ${e.message}`, { file: e.filename, line: e.lineno });
});
window.addEventListener('unhandledrejection', e => {
  GH_LOG.error(`Unhandled promise: ${e.reason?.message || e.reason}`);
});

// ══════════════════════════════════════════════════════════════
// ghErrorMsg — extract friendly message from an API error
// Usage: toast(ghErrorMsg(e), 'err')
// ══════════════════════════════════════════════════════════════
window.ghErrorMsg = function(err) {
  if (!err) return 'Something went wrong';
  const msg = err.message || String(err);
  // Map common patterns to plain English
  if (msg === 'Not authenticated' || msg.includes('401')) return 'Session expired — please log in again';
  if (msg.includes('403'))        return 'You don\'t have permission to do this';
  if (msg.includes('404'))        return 'Record not found';
  if (msg.includes('500'))        return 'Server error — check Settings → Logs for details';
  if (msg.includes('NetworkError') || msg.includes('Failed to fetch'))
    return 'Can\'t reach Ghrava — is the server running?';
  // If it's already a plain readable message from the server, use it
  if (msg.length < 120) return msg;
  return 'Something went wrong — check Settings → Logs for details';
};

// ══════════════════════════════════════════════════════════════
// window.api — authenticated fetch with 401 intercept + retry
//
// On 401: shows inline password prompt (no page reload, no lost work).
//         After successful re-auth, retries the original request once.
// On other errors: throws with a friendly message via ghErrorMsg.
// ══════════════════════════════════════════════════════════════
window.api = async function(method, path, body, _isRetry) {
  const start = Date.now();
  const opts = {
    method,
    credentials: 'include',  // send HttpOnly cookie on every request
    headers: {
      'Content-Type':  'application/json',
      'Authorization': `Bearer ${LT.authToken}`
    }
  };
  if (body !== undefined) opts.body = JSON.stringify(body);

  let res;
  try {
    res = await fetch('/api/v1' + path, opts);
  } catch (netErr) {
    const msg = 'Can\'t reach Ghrava — is the server running?';
    GH_LOG.error(`Network error: ${method} ${path}`, { err: netErr.message });
    throw new Error(msg);
  }

  const ms = Date.now() - start;

  // ── 401: session expired — prompt for password, then retry ──
  if (res.status === 401 && !_isRetry) {
    GH_LOG.warn(`401 on ${method} ${path} — redirecting to login`);
    location.href = '/login.html?next=' + encodeURIComponent(location.pathname + location.search);
    throw new Error('Not authenticated');
  }

  if (!res.ok) {
    const errBody = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
    const msg = errBody.error || errBody.detail || `HTTP ${res.status}`;
    GH_LOG.error(`${method} ${path} → ${res.status} (${ms}ms)`, { msg });
    throw new Error(msg);
  }

  GH_LOG.info(`${method} ${path} → ${res.status} (${ms}ms)`);
  return res.json();
};

// ── Inline re-auth prompt ────────────────────────────────────
// Returns a Promise that resolves when re-auth succeeds, rejects if dismissed.
function _reAuthPrompt() {
  return new Promise((resolve, reject) => {
    // Remove any existing overlay
    document.getElementById('gh-reauth-overlay')?.remove();

    const overlay = document.createElement('div');
    overlay.id = 'gh-reauth-overlay';
    overlay.style.cssText = [
      'position:fixed;inset:0;z-index:10000',
      'background:rgba(0,0,0,0.6);backdrop-filter:blur(6px)',
      'display:flex;align-items:center;justify-content:center',
    ].join(';');

    overlay.innerHTML = `
      <div style="background:var(--bg2);border:1px solid var(--border);border-radius:20px;
        padding:28px 24px 20px;width:min(340px,90vw);
        box-shadow:0 24px 64px rgba(0,0,0,.35);">
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:16px">
          <div style="width:36px;height:36px;background:var(--accent-bg);border-radius:10px;
            display:flex;align-items:center;justify-content:center;flex-shrink:0">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
              stroke="var(--accent)" stroke-width="2">
              <rect x="3" y="11" width="18" height="11" rx="2"/>
              <path d="M7 11V7a5 5 0 0110 0v4"/>
            </svg>
          </div>
          <div>
            <div style="font-size:16px;font-weight:700;color:var(--text)">Session Expired</div>
            <div style="font-size:12px;color:var(--text3)">Enter your password to continue — your work is saved</div>
          </div>
        </div>
        <div id="gh-ra-err" style="font-size:12px;color:var(--red);min-height:16px;margin-bottom:8px;display:none"></div>
        <input id="gh-ra-pw" type="password" placeholder="Password" autocomplete="current-password"
          style="width:100%;padding:10px 12px;border-radius:var(--r);border:1px solid var(--border2);
          background:var(--field-bg,var(--bg3));color:var(--text);font-size:15px;font-family:var(--sans);
          margin-bottom:10px;outline:none;box-sizing:border-box">
        <div style="display:flex;gap:8px">
          <button id="gh-ra-cancel" style="flex:1;padding:10px;border-radius:var(--r);border:1px solid var(--border2);
            background:transparent;color:var(--text2);font-size:14px;cursor:pointer;font-family:var(--sans)">
            Cancel
          </button>
          <button id="gh-ra-btn" style="flex:2;padding:10px;border-radius:var(--r);border:none;
            background:var(--accent);color:#fff;font-size:14px;font-weight:600;cursor:pointer;font-family:var(--sans)">
            Unlock
          </button>
        </div>
      </div>`;

    document.body.appendChild(overlay);

    const pw     = overlay.querySelector('#gh-ra-pw');
    const btn    = overlay.querySelector('#gh-ra-btn');
    const cancel = overlay.querySelector('#gh-ra-cancel');
    const err    = overlay.querySelector('#gh-ra-err');

    setTimeout(() => pw.focus(), 80);

    function showErr(msg) {
      err.textContent = msg;
      err.style.display = 'block';
      pw.style.borderColor = 'var(--red)';
    }

    async function attempt() {
      const password = pw.value.trim();
      if (!password) { showErr('Enter your password'); return; }
      btn.textContent = 'Unlocking…';
      btn.disabled = true;
      try {
        const r = await fetch('/api/v1/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ password })
        });
        const d = await r.json();
        if (!r.ok) {
          showErr(d.error || 'Incorrect password');
          btn.textContent = 'Unlock';
          btn.disabled = false;
          pw.select();
          return;
        }
        LT.authToken = d.token;
        localStorage.setItem('lt_token', d.token);
        GH_LOG.info('Re-auth successful');
        overlay.remove();
        resolve();
      } catch(e) {
        showErr('Connection error');
        btn.textContent = 'Unlock';
        btn.disabled = false;
      }
    }

    btn.addEventListener('click', attempt);
    pw.addEventListener('keydown', e => { if (e.key === 'Enter') attempt(); });
    pw.addEventListener('input', () => { err.style.display = 'none'; pw.style.borderColor = ''; });
    cancel.addEventListener('click', () => { overlay.remove(); reject(new Error('cancelled')); });
    overlay.addEventListener('click', e => { if (e.target === overlay) { overlay.remove(); reject(new Error('dismissed')); } });
  });
}

// Convenience wrappers
window.apiGet    = (path)        => api('GET',    path);
window.apiPost   = (path, body)  => api('POST',   path, body);
window.apiPut    = (path, body)  => api('PUT',    path, body);
window.apiPatch  = (path, body)  => api('PATCH',  path, body);
window.apiDelete = (path)        => api('DELETE', path);

/**
 * window.makeApi(prefix) — module-scoped api factory
 *
 * Returns a function with the same signature as window.api but with the
 * given prefix automatically prepended to every path.
 *
 * Usage in any page:
 *   const api = window.makeApi('/career');
 *   await api('GET', '/certifications');        // → GET /api/v1/career/certifications
 *   await api('POST', '/certifications', body); // → POST /api/v1/career/certifications
 *   await api('DELETE', `/certifications/${id}`);
 *
 * This is the ONLY api() factory. All pages must use this instead of
 * hand-rolling fetch() calls. Gives: auth header, JSON body, 401 retry,
 * error logging — all inherited from window.api.
 */
window.makeApi = function(prefix) {
  return (method, path, body) => window.api(method, prefix + path, body);
};

// Expose re-auth prompt so raw fetch() callers can also trigger it on 401
window.reAuthPrompt = _reAuthPrompt;

// ── Spinner HTML helper ────────────────────────────────────────
window.spinnerHtml = function(msg = 'Loading…') {
  return `<div class="spinner"><div class="spin"></div>${msg}</div>`;
};

// ── Silent GET (never redirects, returns fallback on error) ───
window.silentGet = async function(path, fallback = []) {
  try {
    const r = await fetch('/api/v1' + path, {
      headers: { 'Authorization': `Bearer ${LT.authToken}` }
    });
    if (!r.ok) return fallback;
    return await r.json();
  } catch {
    return fallback;
  }
};

// ── Toast ─────────────────────────────────────────────────────
(function initToast() {
  // Inject toast element if not already in page
  document.addEventListener('DOMContentLoaded', () => {
    if (!document.getElementById('toast')) {
      const el = document.createElement('div');
      el.id = 'toast';
      el.className = 'toast';
      document.body.appendChild(el);
    }
  });
})();

window.toast = function(msg, type = 'ok') {
  const el = document.getElementById('toast');
  if (!el) return;
  el.textContent = msg;
  el.className = `toast ${type} show`;
  clearTimeout(el._timer);
  el._timer = setTimeout(() => { el.className = 'toast'; }, 2600);
};

// ── Confirm overlay ───────────────────────────────────────────
// Injects a single confirm-overlay into the page on first use.
// Usage:
//   await LT.confirm({ title, msg, confirmLabel, danger }) → resolves true/false
//   LT.confirm({ ..., onConfirm: async () => { ... } })   → callback style
//   await LT.confirm('Quick message string')               → resolves true/false
(function initConfirm() {
  let _resolve = null;

  function inject() {
    if (document.getElementById('ltConfirmOverlay')) return;
    const el = document.createElement('div');
    el.id = 'ltConfirmOverlay';
    el.className = 'gh-modal-overlay';
    el.innerHTML = `
      <div class="gh-modal" style="width:min(360px,92vw)">
        <div class="gh-modal-title" id="ltConfirmTitle">Delete?</div>
        <div class="gh-modal-body">
          <p id="ltConfirmMsg" style="font-size:13px;color:var(--text2);margin:0;line-height:1.5">This cannot be undone.</p>
        </div>
        <div class="gh-modal-foot">
          <button class="btn btn-danger" id="ltConfirmYes">Delete</button>
          <button class="btn btn-ghost"  id="ltConfirmNo">Cancel</button>
        </div>
      </div>`;
    document.body.appendChild(el);

    document.getElementById('ltConfirmNo').addEventListener('click', () => {
      el.classList.remove('open');
      if (_resolve) { _resolve(false); _resolve = null; }
    });
    document.getElementById('ltConfirmYes').addEventListener('click', () => {
      el.classList.remove('open');
      if (_resolve) { _resolve(true); _resolve = null; }
    });
    el.addEventListener('pointerdown', e => {
      if (e.target === el) {
        el.classList.remove('open');
        if (_resolve) { _resolve(false); _resolve = null; }
      }
    });
  }

  LT.confirm = function(opts = {}) {
    // Accept a plain string as shorthand: LT.confirm('Are you sure?')
    if (typeof opts === 'string') opts = { msg: opts };

    inject();
    const { title = 'Delete?', msg = 'This cannot be undone.',
            confirmLabel = 'Delete', danger = true, onConfirm } = opts;

    document.getElementById('ltConfirmTitle').textContent = title;
    document.getElementById('ltConfirmMsg').textContent   = msg;
    const yesBtn = document.getElementById('ltConfirmYes');
    yesBtn.textContent = confirmLabel;
    yesBtn.className   = danger ? 'btn btn-danger' : 'btn btn-primary';
    document.getElementById('ltConfirmOverlay').classList.add('open');

    // Always return a Promise — onConfirm callback also supported
    return new Promise(resolve => {
      _resolve = (result) => {
        if (result && onConfirm) onConfirm();
        resolve(result);
      };
    });
  };
})();

// ── Drawer backdrop helper ────────────────────────────────────
// Closes drawer when user clicks the backdrop (outside the panel)
window.onDrawerBg = function(drawerId) {
  const el = document.getElementById(drawerId);
  if (!el) return;
  // Track where the press STARTED — only close if the pointer went down on the
  // backdrop itself, not on the drawer content. This prevents text-selection drags
  // (where mouseup lands on the backdrop) from accidentally closing the drawer.
  let downOnOverlay = false;
  el.addEventListener('pointerdown', e => { downOnOverlay = e.target === el; });
  el.addEventListener('pointerup',   e => { if (downOnOverlay && e.target === el) el.classList.remove('open'); });
};

LT.logout = function() {
  LT.authToken = null;
  localStorage.removeItem('lt_token');
  window.location = '/settings.html';
};

// ══════════════════════════════════════════════════════════════
// GH TAG SUGGESTIONS  — shared across all modules
// ══════════════════════════════════════════════════════════════
//
// Usage:
//   GH_TAGS.init({
//     inputId:    'tagInput',       // the text <input>
//     wrapId:     'tagsWrap',       // the chip container
//     module:     'resources',      // which hint set to use
//     getFormTags:  () => formTags, // fn returning current tags array
//     addTag:       (tag) => {...}, // fn to call when suggestion clicked
//   });
//
// init() attaches a focus listener on the input. On focus it:
//   1. Fetches all tags from DB (cached for 60s)
//   2. Merges with module-specific hints
//   3. Filters out already-selected tags
//   4. Renders a suggestion pill row below the wrap element
//
window.GH_TAGS = (function() {

  // ── Tag color palette — cycled for new tags ─────────────────
  const PALETTE = ['3b82f6','10b981','f59e0b','ef4444','8b5cf6',
                   'ec4899','06b6d4','f97316','84cc16','14b8a6'];
  let _paletteIdx = 0;
  function nextColor() { return PALETTE[_paletteIdx++ % PALETTE.length]; }

  // ── Cache ────────────────────────────────────────────────────
  let _cache    = null;   // [{name, color_hex, usage_count}]
  let _colorMap = {};     // name → color_hex
  let _cacheTime = 0;
  const CACHE_TTL = 60000;

  async function fetchAllTags() {
    if (_cache && (Date.now() - _cacheTime) < CACHE_TTL) return _cache;
    try {
      const r = await fetch('/api/v1/settings/tags',
        { headers: { 'Authorization': `Bearer ${window.LT?.authToken||''}` } });
      if (!r.ok) return _cache || [];
      const tags = await r.json();
      _cache = tags;
      _colorMap = {};
      tags.forEach(t => { _colorMap[t.name.toLowerCase()] = t.color_hex || '8b5cf6'; });
      _cacheTime = Date.now();
      return _cache;
    } catch { return _cache || []; }
  }

  function invalidateCache() { _cache = null; }

  function getColor(name) { return _colorMap[(name||'').toLowerCase()] || '8b5cf6'; }

  // ── Chip style from color_hex ────────────────────────────────
  function chipStyle(name) {
    const hex = getColor(name).replace('#','');
    const r = parseInt(hex.slice(0,2),16), g = parseInt(hex.slice(2,4),16), b = parseInt(hex.slice(4,6),16);
    return `color:#${hex};background:rgba(${r},${g},${b},0.13);border-color:rgba(${r},${g},${b},0.35);`;
  }

  // ── Create tag on server ─────────────────────────────────────
  async function createTag(name) {
    const clean = name.replace(/^#+/, '').trim().toLowerCase();
    if (!clean) return clean;
    const color_hex = '#' + nextColor();
    try {
      await fetch('/api/v1/settings/tags', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${window.LT?.authToken||''}`
        },
        body: JSON.stringify({ name: clean, color_hex })
      });
      invalidateCache();
    } catch(e) { console.warn('GH_TAGS: create failed', e); }
    return clean;
  }

  // ── Floating dropdown — fixed-position to escape overflow:hidden ──
  function positionDropdown(dd, anchor) {
    const r = anchor.getBoundingClientRect();
    const spaceBelow = window.innerHeight - r.bottom;
    const spaceAbove = r.top;
    const dropH = Math.min(200, dd.scrollHeight || 200);
    if (spaceBelow >= dropH || spaceBelow >= spaceAbove) {
      dd.style.top  = (r.bottom + 4) + 'px';
      dd.style.bottom = 'auto';
    } else {
      dd.style.bottom = (window.innerHeight - r.top + 4) + 'px';
      dd.style.top = 'auto';
    }
    dd.style.left  = r.left + 'px';
    dd.style.width = r.width + 'px';
  }

  function openDropdown(wrap, allTags, currentTags, typedVal, onPick, allowCreate) {
    closeDropdown();
    const q = typedVal.trim().toLowerCase();

    let visible = allTags.filter(t => {
      const n = t.name.toLowerCase();
      return !currentTags.includes(n) && (!q || n.includes(q));
    });

    const showCreate = allowCreate && q.length > 0
      && !allTags.find(t => t.name.toLowerCase() === q);

    const dd = document.createElement('div');
    dd.className = 'gh-tags-dropdown';
    dd.id = 'gh-tags-dd';

    const inner = document.createElement('div');
    inner.className = 'gh-tags-dropdown-inner';

    if (!visible.length && !showCreate) {
      const hint = allowCreate
        ? `<span class="gh-tags-dropdown-empty">Type a name to create a tag</span>`
        : `<span class="gh-tags-dropdown-empty">No tags available</span>`;
      inner.innerHTML = hint;
      dd.appendChild(inner);
      document.body.appendChild(dd);
      positionDropdown(dd, wrap);
      return;
    }

    visible.slice(0, 24).forEach(t => {
      const pill = document.createElement('span');
      pill.className = 'gh-tags-pill';
      pill.textContent = t.name;
      pill.style.cssText = chipStyle(t.name);
      pill.addEventListener('mousedown', e => {
        e.preventDefault();
        onPick(t.name);
      });
      inner.appendChild(pill);
    });

    if (showCreate) {
      const cp = document.createElement('span');
      cp.className = 'gh-tags-pill gh-tags-pill-create';
      cp.textContent = `+ Create "${q}"`;
      cp.addEventListener('mousedown', async e => {
        e.preventDefault();
        cp.textContent = '…';
        const clean = await createTag(q);
        onPick(clean);
      });
      inner.appendChild(cp);
    }

    dd.appendChild(inner);
    document.body.appendChild(dd);
    positionDropdown(dd, wrap);

    // Reposition on scroll or resize, close if anchor scrolled out of view
    const onScroll = () => {
      const el = document.getElementById('gh-tags-dd');
      if (!el) return;
      const r = wrap.getBoundingClientRect();
      if (r.bottom < 0 || r.top > window.innerHeight) { closeDropdown(); return; }
      positionDropdown(el, wrap);
    };
    window.addEventListener('scroll', onScroll, { passive: true, capture: true });
    window.addEventListener('resize', onScroll, { passive: true });
    dd._cleanupListeners = () => {
      window.removeEventListener('scroll', onScroll, { capture: true });
      window.removeEventListener('resize', onScroll);
    };
  }

  function closeDropdown() {
    const el = document.getElementById('gh-tags-dd');
    if (el) {
      if (el._cleanupListeners) el._cleanupListeners();
      el.remove();
    }
  }

  // ── Build confirmed chip element ─────────────────────────────
  function makeChip(name, onRemove) {
    const chip = document.createElement('span');
    chip.className = 'tag-chip';
    chip.style.cssText = chipStyle(name);
    chip.dataset.tag = name;
    const label = document.createElement('span');
    label.textContent = name;
    const x = document.createElement('span');
    x.className = 'tag-chip-remove';
    x.innerHTML = '&times;';
    x.addEventListener('mousedown', e => { e.preventDefault(); e.stopPropagation(); onRemove(name); });
    chip.appendChild(label);
    chip.appendChild(x);
    return chip;
  }

  // ── Build suggested chip element ─────────────────────────────
  function makeSuggestedChip(tag, onConfirm, onDismiss) {
    const chip = document.createElement('span');
    chip.className = 'tag-chip-suggested';
    const hex = tag.color_hex ? tag.color_hex.replace('#','') : '8b5cf6';
    const r = parseInt(hex.slice(0,2),16), g = parseInt(hex.slice(2,4),16), b = parseInt(hex.slice(4,6),16);
    chip.style.cssText = `color:#${hex};border-color:rgba(${r},${g},${b},0.4);`;
    chip.title = 'Click to add suggested tag';
    chip.dataset.tag = tag.name;

    const label = document.createElement('span');
    label.textContent = tag.name;
    const x = document.createElement('span');
    x.className = 'tag-chip-remove';
    x.innerHTML = '&times;';
    x.title = 'Dismiss suggestion';
    x.addEventListener('mousedown', e => { e.preventDefault(); e.stopPropagation(); onDismiss(tag.name); chip.remove(); });

    chip.addEventListener('mousedown', e => {
      if (e.target === x) return;
      e.preventDefault();
      onConfirm(tag.name);
      chip.remove();
    });

    chip.appendChild(label);
    chip.appendChild(x);
    return chip;
  }

  // ── Fetch smart suggestions from server ──────────────────────
  async function fetchSuggestions({ module, entityType, category, name, currentTags }) {
    try {
      const params = new URLSearchParams();
      if (module)     params.set('module', module);
      if (entityType) params.set('entity_type', entityType);
      if (category)   params.set('category', category);
      if (name)       params.set('name', name);
      if (currentTags?.length) params.set('current', currentTags.join(','));
      const r = await fetch(`/api/v1/settings/tags/suggest?${params}`,
        { headers: { 'Authorization': `Bearer ${window.LT?.authToken||''}` } });
      if (!r.ok) return [];
      return await r.json(); // [{name, color_hex}]
    } catch { return []; }
  }

  // ── main init ─────────────────────────────────────────────────
  // Usage:
  //   GH_TAGS.init({
  //     inputId, wrapId, module,
  //     getFormTags,          // () => string[]  — current confirmed tags
  //     addTag,               // (name) => void  — add to form state
  //     allowCreate,          // bool (default true)
  //     entityType,           // e.g. 'item' — for suggestion queries
  //     getContext,           // () => {category, name} — for smart suggestions
  //   })
  //
  //   GH_TAGS.suggest(wrapId, getFormTags, addTag, context)
  //     — call after category/name changes to refresh suggested chips
  //
  function init({ inputId, wrapId, module, getFormTags, addTag,
                  allowCreate = true, entityType, getContext }) {
    const input = document.getElementById(inputId);
    const wrap  = document.getElementById(wrapId);
    if (!input || !wrap) return;

    // Namespace a dismissed-suggestions set per wrapId
    wrap._dismissedSuggestions = wrap._dismissedSuggestions || new Set();

    async function refreshDropdown() {
      const allTags = await fetchAllTags();
      const current = getFormTags().map(t => t.toLowerCase());
      openDropdown(wrap, allTags, current, input.value, name => {
        addTag(name);
        input.value = '';
        // Remove from dropdown and reopen
        setTimeout(() => refreshDropdown(), 0);
      }, allowCreate);
    }

    input.addEventListener('focus', refreshDropdown);
    input.addEventListener('input', refreshDropdown);
    input.addEventListener('blur', () => setTimeout(closeDropdown, 150));
    input.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ',') {
        e.preventDefault();
        const val = input.value.trim().replace(/^#+/,'').toLowerCase();
        if (val) {
          addTag(val);
          input.value = '';
          setTimeout(refreshDropdown, 50);
        }
      } else if (e.key === 'Backspace' && !input.value) {
        // Remove last confirmed tag
        const chips = wrap.querySelectorAll('.tag-chip');
        if (chips.length) chips[chips.length - 1].querySelector('.tag-chip-remove').dispatchEvent(new MouseEvent('mousedown'));
      } else if (e.key === 'Escape') {
        closeDropdown();
        input.blur();
      }
    });

    // Store context fetcher for external suggest calls
    wrap._getContext  = getContext  || null;
    wrap._module      = module      || '';
    wrap._entityType  = entityType  || '';
    wrap._getFormTags = getFormTags;
    wrap._addTag      = addTag;
  }

  // ── External: call after context changes to show suggested chips ──
  // context = { category, name }
  async function suggest(wrapId, getFormTags, addTag, context = {}) {
    const wrap = document.getElementById(wrapId);
    if (!wrap) return;

    const module     = wrap._module     || '';
    const entityType = wrap._entityType || '';
    const current    = getFormTags().map(t => t.toLowerCase());
    const dismissed  = wrap._dismissedSuggestions || new Set();

    const suggs = await fetchSuggestions({
      module, entityType,
      category: context.category || '',
      name:     context.name     || '',
      currentTags: current,
    });

    // Remove old suggestion chips
    wrap.querySelectorAll('.tag-chip-suggested').forEach(c => c.remove());

    const input = wrap.querySelector('.tags-text-input');

    suggs
      .filter(s => !current.includes(s.name.toLowerCase()) && !dismissed.has(s.name.toLowerCase()))
      .forEach(s => {
        const chip = makeSuggestedChip(
          s,
          name => { addTag(name); },
          name => { dismissed.add(name.toLowerCase()); }
        );
        // Insert before the input
        if (input) wrap.insertBefore(chip, input);
        else wrap.appendChild(chip);
      });
  }

  // ── renderChips: rebuild confirmed chips inside a wrap ────────
  // Call this whenever form tag state changes (replaces per-page renderXxxTags)
  function renderChips(wrapId, tags, onRemove) {
    const wrap = document.getElementById(wrapId);
    if (!wrap) return;
    const input = wrap.querySelector('.tags-text-input');
    // Remove existing confirmed chips
    wrap.querySelectorAll('.tag-chip').forEach(c => c.remove());
    // Add fresh chips before the input
    tags.forEach(name => {
      const chip = makeChip(name, onRemove);
      if (input) wrap.insertBefore(chip, input);
      else wrap.appendChild(chip);
    });
  }

  return { init, suggest, renderChips, invalidateCache, fetchAllTags, getColor, chipStyle };

})();

// ══════════════════════════════════════════════════════════════
// VIEWPORT DETECTION — runs once on load, updates on resize
// Sets CSS vars and classes used by drawer sizing system
// ══════════════════════════════════════════════════════════════
(function initViewport() {
  function apply() {
    const h = window.innerHeight;
    const w = window.innerWidth;
    const root = document.documentElement;

    // --drawer-max-h: leave enough room for the sticky footer (~80px)
    // and the sticky page header (~54px), targeting ~85% on short screens
    let maxH;
    if (h <= 600)  maxH = '96vh';
    else if (h <= 700) maxH = '92vh';
    else if (h <= 800) maxH = '90vh';
    else maxH = '88vh';
    root.style.setProperty('--drawer-max-h', maxH);

    // Compact mode: small form fields on short screens
    root.classList.toggle('drawer-compact', h < 720);

    // Store for use by other components
    window.GH_VIEWPORT = { h, w, compact: h < 720, mobile: w < 900 };
  }

  apply();
  window.addEventListener('resize', apply);

  // Re-apply when a drawer opens (catches orientation changes mid-session)
  document.addEventListener('click', e => {
    if (e.target?.closest?.('.drawer-overlay')) return;
    const opened = e.target?.closest?.('[onclick*="classList.add(\'open\')"]');
    if (opened) setTimeout(apply, 50);
  }, true);
})();

// ══════════════════════════════════════════════════════════════
// DRAWER STICKY FOOTER — auto-applied to every drawer on open
// Finds the last .btn-row inside each .drawer and makes it sticky
// Works without any HTML changes to individual drawers
// ══════════════════════════════════════════════════════════════
(function initDrawerStructure() {
  // Restructure any .drawer into: .drawer-header / .drawer-body / .drawer-foot
  // Runs once per drawer when it first opens.
  // Safe to call multiple times — drawer.dataset.structured guards it.

  function isFooterEl(el) {
    // A footer element contains Save/Cancel/Delete buttons as direct or near-direct children
    // but does NOT contain form fields (form-group, form-input, textarea, select)
    if (el.nodeType !== 1) return false;
    const tag = el.tagName;
    if (tag !== 'DIV' && tag !== 'FOOTER') return false;
    // Must have at least one .btn child (direct or one level deep)
    const hasBtns = el.querySelector(':scope > .btn, :scope > button.btn, :scope > a.btn');
    if (!hasBtns) return false;
    // Must NOT have form fields (those belong in the body)
    const hasFormFields = el.querySelector('.form-group, .form-input, textarea, .form-select, .tags-input-wrap, .gh-select');
    if (hasFormFields) return false;
    return true;
  }

  function structureDrawer(overlay) {
    const drawer = overlay.querySelector(':scope > .drawer');
    if (!drawer || drawer.dataset.structured === '1') return;
    drawer.dataset.structured = '1';

    // Collect direct element children
    const children = [...drawer.children];

    // Find footer: last element that is a button row
    let footEl = null;
    for (let i = children.length - 1; i >= 0; i--) {
      if (isFooterEl(children[i])) { footEl = children[i]; break; }
    }
    // Also check for .btn-row, .drawer-footer class
    if (!footEl) {
      for (let i = children.length - 1; i >= 0; i--) {
        const el = children[i];
        if (el.classList.contains('btn-row') || el.classList.contains('drawer-footer') || el.classList.contains('drawer-foot')) {
          footEl = el; break;
        }
      }
    }

    // Separate handle/title (header) from body content
    const headerEls = children.filter(el =>
      el.classList.contains('drawer-handle') ||
      el.classList.contains('drawer-title') ||
      (el.tagName === 'DIV' && el.id && (el.id.endsWith('Title') || el.id.endsWith('DrawerTitle') || el.id === 'drawerTitle'))
    );

    const bodyEls = children.filter(el => el !== footEl && !headerEls.includes(el));

    // Build .drawer-header
    const header = document.createElement('div');
    header.className = 'drawer-header';
    headerEls.forEach(el => header.appendChild(el));

    // Build .drawer-body
    const body = document.createElement('div');
    body.className = 'drawer-body';
    bodyEls.forEach(el => body.appendChild(el));

    // Build .drawer-foot
    const foot = document.createElement('div');
    foot.className = 'drawer-foot';
    if (footEl) {
      // If footEl is already a flex div with buttons, move its children
      if (footEl.classList.contains('btn-row') || footEl.classList.contains('drawer-footer')) {
        // unwrap btn-row into foot directly
        [...footEl.children].forEach(btn => foot.appendChild(btn));
      } else {
        foot.appendChild(footEl);
      }
    }

    // Rebuild drawer
    drawer.innerHTML = '';
    drawer.appendChild(header);
    drawer.appendChild(body);
    if (foot.children.length > 0) drawer.appendChild(foot);
  }

  // MutationObserver watches for drawers opening
  const observer = new MutationObserver(mutations => {
    for (const m of mutations) {
      if (m.type === 'attributes' && m.attributeName === 'class') {
        const el = m.target;
        if (el.classList.contains('drawer-overlay') && el.classList.contains('open')) {
          structureDrawer(el);
        }
      }
    }
  });

  function observeDrawers() {
    document.querySelectorAll('.drawer-overlay').forEach(overlay => {
      observer.observe(overlay, { attributes: true });
      if (overlay.classList.contains('open')) structureDrawer(overlay);
    });
    // Also watch for dynamically added drawers
    new MutationObserver(muts => {
      muts.forEach(m => m.addedNodes.forEach(n => {
        if (n.nodeType === 1) {
          n.querySelectorAll('.drawer-overlay').forEach(o => observer.observe(o, { attributes: true }));
        }
      }));
    }).observe(document.body || document.documentElement, { childList: true, subtree: true });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', observeDrawers);
  else observeDrawers();

  // Expose for manual call if needed
  window.structureDrawer = structureDrawer;
})();

// Auth gate removed — pages load freely without any password prompt.
// All reads are public. Writes go through api() which shows _reAuthPrompt
// on 401 automatically. Session lifetime is 365 days so re-prompts are rare.
// To set or change the password, use Settings → Change Password.

// ══════════════════════════════════════════════════════════════
// GH_SELECT — dropdown backed by dropdown_options table
// Wraps any <select>, populates from API, appends "＋ Add new…"
// Usage: await GH_SELECT.init('selectId', 'list_key', currentVal);
// ══════════════════════════════════════════════════════════════
window.GH_SELECT = (function () {

  let _popup = null;
  let _currentSelectId = null;
  let _currentListKey = null;

  function _getOrCreatePopup() {
    if (_popup) return _popup;
    _popup = document.createElement('div');
    _popup.id = 'gh-select-popup';
    _popup.className = 'gh-modal-overlay';
    _popup.innerHTML = `
      <div class="gh-modal" style="width:min(340px,92vw)">
        <div class="gh-modal-title">Add new option</div>
        <div class="gh-modal-body">
          <input id="gh-select-input" class="form-input" placeholder="New value…"
            style="width:100%;box-sizing:border-box" autocomplete="off">
          <div id="gh-select-err" style="color:var(--red);font-size:12px;margin-top:6px;display:none"></div>
        </div>
        <div class="gh-modal-foot">
          <button id="gh-select-save" class="btn btn-primary">Save</button>
          <button id="gh-select-cancel" class="btn btn-ghost">Cancel</button>
        </div>
      </div>
    `;
    document.body.appendChild(_popup);
    _popup.querySelector('#gh-select-save').addEventListener('click', _doSave);
    _popup.querySelector('#gh-select-cancel').addEventListener('click', _closePopup);
    _popup.addEventListener('pointerdown', e => { if (e.target === _popup) _closePopup(); });
    _popup.querySelector('#gh-select-input').addEventListener('keydown', e => {
      if (e.key === 'Enter') { e.preventDefault(); _doSave(); }
      if (e.key === 'Escape') _closePopup();
    });
    return _popup;
  }

  function _openPopup(selectEl, listKey) {
    _currentSelectId = selectEl.id;
    _currentListKey  = listKey;
    const popup = _getOrCreatePopup();
    const input = popup.querySelector('#gh-select-input');
    popup.querySelector('#gh-select-err').style.display = 'none';
    input.value = '';
    popup.classList.add('open');
    setTimeout(() => input.focus(), 50);
  }

  function _closePopup() {
    if (!_popup) return;
    _popup.classList.remove('open');
    const sel = _currentSelectId ? document.getElementById(_currentSelectId) : null;
    if (sel && sel.value === '__add__') {
      const first = Array.from(sel.options).find(o => o.value !== '__add__');
      if (first) sel.value = first.value;
    }
    _currentSelectId = null;
    _currentListKey  = null;
  }

  async function _doSave() {
    const input = _popup.querySelector('#gh-select-input');
    const err   = _popup.querySelector('#gh-select-err');
    const btn   = _popup.querySelector('#gh-select-save');
    const label = input.value.trim();
    if (!label) { err.textContent = 'Please enter a value.'; err.style.display = 'block'; return; }
    btn.textContent = 'Saving…'; btn.disabled = true; err.style.display = 'none';
    try {
      const res = await fetch('/api/v1/settings/dropdowns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + (window.LT?.authToken || '') },
        body: JSON.stringify({ list_key: _currentListKey, label, value: label, is_active: 1 })
      });
      if (res.status === 401) { err.textContent = 'Log in via Settings to add options.'; err.style.display = 'block'; return; }
      if (!res.ok) { const e = await res.json().catch(()=>({})); err.textContent = e.error||'Save failed.'; err.style.display='block'; return; }
      const selId = _currentSelectId, listKey = _currentListKey;
      _closePopup();
      await GH_SELECT.refresh(selId, listKey, label);
      if (typeof window.toast === 'function') window.toast('Option added');
    } catch (e) {
      err.textContent = 'Network error. Try again.'; err.style.display = 'block';
    } finally { btn.textContent = 'Save'; btn.disabled = false; }
  }

  async function init(selectId, listKey, current, opts = {}) {
    const sel = document.getElementById(selectId);
    if (!sel) return;
    const allowAdd    = opts.allowAdd !== false;
    const placeholder = opts.placeholder || null;
    try {
      const rows = await fetch(`/api/v1/settings/dropdowns/${listKey}`).then(r => r.ok ? r.json() : []);
      sel.innerHTML = '';
      if (placeholder) {
        const blank = document.createElement('option');
        blank.value = ''; blank.textContent = placeholder;
        sel.appendChild(blank);
      }
      rows.forEach(row => {
        const opt = document.createElement('option');
        opt.value = row.value; opt.textContent = row.label;
        if (row.value === current) opt.selected = true;
        sel.appendChild(opt);
      });
      if (current && !rows.find(r => r.value === current)) {
        const opt = document.createElement('option');
        opt.value = current; opt.textContent = current; opt.selected = true;
        sel.appendChild(opt);
      }
      if (allowAdd) {
        const addOpt = document.createElement('option');
        addOpt.value = '__add__'; addOpt.textContent = '＋ Add new…';
        sel.appendChild(addOpt);
        sel.removeEventListener('change', sel._ghSelectHandler);
        sel._ghSelectHandler = () => { if (sel.value === '__add__') _openPopup(sel, listKey); };
        sel.addEventListener('change', sel._ghSelectHandler);
      }
    } catch (e) { console.warn('GH_SELECT.init failed for', listKey, e); }
  }

  async function refresh(selectId, listKey, value) { await init(selectId, listKey, value); }

  return { init, refresh };
})();

// ── GH_INFO — Info icon popover system ────────────────────────
// Usage: add class="gh-info-icon" data-info="key" to any element.
// GH_INFO auto-wires all matching elements on DOMContentLoaded.
// To wire dynamically added icons: GH_INFO.wire(parentEl)
//
// Standard appearance: blue filled circle ⓘ (universally recognised
// as an information control on both iOS and Android / Material Design).
//
// Example:
//   <label class="form-label">
//     Container <span class="gh-info-icon" data-info="container"></span>
//   </label>

window.GH_INFO = (function () {

  // ── Message registry ─────────────────────────────────────────
  const MESSAGES = {
    container: {
      title: 'Container',
      body:  'A container is anything that holds items inside it — boxes, bins, totes, baskets, drawers, shelves, cabinets, bags, or crates. If you can put things in it or on it, it\'s a container.',
    },
    location: {
      title: 'Room or Place',
      body:  'A location is any physical place in or around your home — a room, garage, shed, attic, basement, backyard, hallway, or vehicle. It\'s where a container or item ultimately lives.',
    },
  };

  // ── Inject CSS once ──────────────────────────────────────────
  const STYLE_ID = 'gh-info-styles';
  function injectStyles() {
    if (document.getElementById(STYLE_ID)) return;
    const s = document.createElement('style');
    s.id = STYLE_ID;
    s.textContent = `
      .gh-info-icon {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 13px;
        height: 13px;
        border-radius: 50%;
        background: #2563eb;
        color: #fff;
        font-size: 8px;
        font-weight: 700;
        font-style: normal;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        line-height: 1;
        cursor: pointer;
        vertical-align: middle;
        margin-left: 4px;
        position: relative;
        top: -1px;
        flex-shrink: 0;
        user-select: none;
        -webkit-user-select: none;
        transition: background 0.15s;
      }
      .gh-info-icon:hover { background: #1d4ed8; }
      .gh-info-icon::before { content: 'i'; }

      .gh-info-popover {
        position: fixed;
        z-index: 9999;
        background: var(--bg2, #1e293b);
        border: 1px solid var(--border2, #334155);
        border-radius: 10px;
        padding: 12px 14px;
        max-width: 280px;
        box-shadow: 0 8px 24px rgba(0,0,0,0.35);
        pointer-events: auto;
      }
      .gh-info-popover-title {
        font-size: 13px;
        font-weight: 600;
        color: var(--text, #f1f5f9);
        margin-bottom: 6px;
        display: flex;
        align-items: center;
        gap: 7px;
      }
      .gh-info-popover-title::before {
        content: '';
        display: inline-block;
        width: 14px;
        height: 14px;
        border-radius: 50%;
        background: #2563eb;
        flex-shrink: 0;
      }
      .gh-info-popover-body {
        font-size: 12px;
        color: var(--text2, #94a3b8);
        line-height: 1.5;
      }
    `;
    document.head.appendChild(s);
  }

  // ── Active popover tracking ───────────────────────────────────
  let _activePopover = null;
  let _activeIcon    = null;

  function closePopover() {
    if (_activePopover) { _activePopover.remove(); _activePopover = null; }
    _activeIcon = null;
  }

  function showPopover(icon, key) {
    // Toggle off if same icon clicked again
    if (_activeIcon === icon) { closePopover(); return; }
    closePopover();

    const msg = MESSAGES[key];
    if (!msg) return;

    const pop = document.createElement('div');
    pop.className = 'gh-info-popover';
    pop.innerHTML = `
      <div class="gh-info-popover-title">${msg.title}</div>
      <div class="gh-info-popover-body">${msg.body}</div>
    `;
    document.body.appendChild(pop);

    // Position near the icon
    const rect = icon.getBoundingClientRect();
    const pw = pop.offsetWidth || 280;
    const ph = pop.offsetHeight || 80;
    const vw = window.innerWidth, vh = window.innerHeight;

    let left = rect.left;
    let top  = rect.bottom + 8;

    // Flip left if would overflow right
    if (left + pw > vw - 12) left = Math.max(12, vw - pw - 12);
    // Flip above if would overflow bottom
    if (top + ph > vh - 12) top = rect.top - ph - 8;

    pop.style.left = left + 'px';
    pop.style.top  = top  + 'px';

    _activePopover = pop;
    _activeIcon    = icon;
  }

  // ── Wire icons in a given root element ───────────────────────
  function wire(root = document) {
    injectStyles();
    root.querySelectorAll('.gh-info-icon[data-info]').forEach(icon => {
      if (icon._ghInfoWired) return;
      icon._ghInfoWired = true;
      icon.addEventListener('click', e => {
        e.stopPropagation();
        showPopover(icon, icon.dataset.info);
      });
    });
  }

  // ── Global dismiss on outside click ─────────────────────────
  document.addEventListener('click', e => {
    if (_activePopover && !_activePopover.contains(e.target)) closePopover();
  });

  // ── Auto-wire on DOMContentLoaded ────────────────────────────
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => wire());
  } else {
    wire();
  }

  return { wire, messages: MESSAGES };
})();

// ══════════════════════════════════════════════════════════════
// GH_VIEW — Shared grid/list view toggle + column picker
//
// Usage:
//   GH_VIEW.init('myContainerId', 'inv', callback);
//
// Renders into the given container:
//   [⊞ grid] [☰ list] | Cols 2 3 4 5 | Sort ↕ | Advanced Filters ⧉
//
// storagePrefix is used for localStorage keys:
//   {prefix}_view  — 'grid' or 'list'
//   {prefix}_cols  — 2, 3, 4, or 5
//
// callback(state) is called whenever view, cols, or filters change.
// state = { view, cols, filters }
// ══════════════════════════════════════════════════════════════
window.GH_VIEW = (function() {

  const _CSS_ID = 'gh-view-styles';

  function _injectStyles() {
    if (document.getElementById(_CSS_ID)) return;
    const s = document.createElement('style');
    s.id = _CSS_ID;
    s.textContent = `
.gh-view-toolbar{display:flex;align-items:center;gap:6px;flex-wrap:wrap}
.gh-view-btn{width:30px;height:28px;border-radius:6px;border:1px solid var(--border);background:var(--bg3);color:var(--text3);cursor:pointer;transition:all .15s;display:flex;align-items:center;justify-content:center;flex-shrink:0}
.gh-view-btn.active{background:var(--accent-bg);border-color:var(--accent-bd);color:var(--accent)}
.gh-view-btn:hover:not(.active){border-color:var(--border2);color:var(--text2)}
.gh-view-sep{width:1px;height:20px;background:var(--border2);flex-shrink:0;margin:0 2px}
.gh-col-btn{width:26px;height:24px;border-radius:6px;border:1px solid var(--border);background:var(--bg3);color:var(--text3);font-size:11px;font-weight:700;cursor:pointer;transition:all .15s;display:flex;align-items:center;justify-content:center}
.gh-col-btn.active{background:var(--accent-bg);border-color:var(--accent-bd);color:var(--accent)}
.gh-col-btn:hover:not(.active){border-color:var(--border2);color:var(--text2)}
.gh-view-text-btn{height:28px;padding:0 10px;border-radius:6px;border:1px solid var(--border);background:var(--bg3);color:var(--text3);font-size:12px;font-weight:600;cursor:pointer;transition:all .15s;display:flex;align-items:center;gap:5px;white-space:nowrap;font-family:var(--sans)}
.gh-view-text-btn:hover{border-color:var(--border2);color:var(--text2)}
.gh-view-text-btn.has-filters{border-color:var(--accent-bd);color:var(--accent);background:var(--accent-bg)}
.gh-filter-dot{width:7px;height:7px;border-radius:50%;background:var(--accent);display:none}
.gh-view-text-btn.has-filters .gh-filter-dot{display:block}
.gh-adv-drawer{position:fixed;inset:0;z-index:800;display:none}
.gh-more-btn.has-filters::after{content:'';position:absolute;top:4px;right:4px;width:6px;height:6px;border-radius:50%;background:var(--accent)}
.gh-more-menu{position:absolute;right:0;top:calc(100% + 6px);background:var(--bg2);border:1px solid var(--border2);border-radius:var(--r-lg);min-width:180px;box-shadow:0 8px 24px rgba(0,0,0,.12);z-index:500;padding:6px 0}
.gh-more-section-label{font-size:10px;font-weight:600;color:var(--text3);text-transform:uppercase;letter-spacing:.07em;padding:6px 12px 2px}
.gh-more-sep{height:1px;background:var(--border);margin:4px 0}
.gh-more-item{display:flex;align-items:center;gap:8px;width:100%;padding:8px 12px;background:transparent;border:none;font-size:13px;color:var(--text2);cursor:pointer;font-family:var(--sans);text-align:left}
.gh-more-item:hover{background:var(--bg3);color:var(--text)}
.gh-more-item.has-filters{color:var(--accent)}
.gh-adv-drawer.open{display:flex}
.gh-adv-scrim{position:absolute;inset:0;background:rgba(0,0,0,.45)}
.gh-adv-panel{position:absolute;bottom:0;left:0;right:0;background:var(--bg2);border-radius:var(--r-lg) var(--r-lg) 0 0;max-height:88vh;display:flex;flex-direction:column;animation:slideup .24s cubic-bezier(.32,.72,0,1)}
.gh-adv-handle{width:36px;height:4px;border-radius:2px;background:var(--border2);margin:10px auto 0}
.gh-adv-header{padding:12px 20px 8px;border-bottom:1px solid var(--border)}
.gh-adv-title{font-size:17px;font-weight:700;color:var(--text)}
.gh-adv-body{overflow-y:auto;padding:16px 20px;flex:1;display:flex;flex-direction:column;gap:18px}
.gh-adv-section-label{font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--text3);margin-bottom:6px}
.gh-adv-footer{padding:12px 20px 20px;border-top:1px solid var(--border);display:flex;gap:8px}
.gh-adv-reset{flex:1;padding:11px;border-radius:var(--r);border:1px solid var(--border);background:transparent;color:var(--text2);font-size:14px;font-weight:600;cursor:pointer;font-family:var(--sans);transition:all .15s}
.gh-adv-reset:hover{background:var(--bg3)}
.gh-adv-apply{flex:2;padding:11px;border-radius:var(--r);border:none;background:var(--accent);color:#fff;font-size:14px;font-weight:700;cursor:pointer;font-family:var(--sans);transition:opacity .15s}
.gh-adv-apply:hover{opacity:.9}
.gh-tag-pill{display:inline-flex;align-items:center;gap:4px;padding:3px 8px 3px 10px;border-radius:20px;background:var(--accent-bg);border:1px solid var(--accent-bd);color:var(--accent);font-size:12px;font-weight:600;cursor:pointer}
.gh-tag-pill svg{opacity:.7}
    `;
    document.head.appendChild(s);
  }

  // ── Instance registry (one per page) ─────────────────────────
  const _instances = {};

  function init(containerId, storagePrefix, callback, options = {}) {
    _injectStyles();

    const container = document.getElementById(containerId);
    if (!container) return;

    const view = localStorage.getItem(storagePrefix + '_view') || options.defaultView || 'grid';
    const savedGridCols = parseInt(localStorage.getItem(storagePrefix + '_cols'));
    const savedListCols = parseInt(localStorage.getItem(storagePrefix + '_list_cols'));
    const defaultGrid = options.defaultCols || (window.innerWidth >= 768 ? 4 : 2);
    const defaultList = options.defaultColsList || 1;
    const cols = view === 'list'
      ? (savedListCols || defaultList)
      : (savedGridCols || defaultGrid);

    const state = { view, cols, filters: {} };

    // ── Build toolbar HTML ────────────────────────────────────
    container.innerHTML = `
      <div class="gh-view-toolbar">
        <button class="gh-view-btn${view==='grid'?' active':''}" id="${storagePrefix}-vgrid" title="Grid view">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="1" y="1" width="5" height="5" rx="1"/><rect x="8" y="1" width="5" height="5" rx="1"/><rect x="1" y="8" width="5" height="5" rx="1"/><rect x="8" y="8" width="5" height="5" rx="1"/></svg>
        </button>
        <button class="gh-view-btn${view==='list'?' active':''}" id="${storagePrefix}-vlist" title="List view">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="1" y="1" width="12" height="3" rx="1"/><rect x="1" y="5.5" width="12" height="3" rx="1"/><rect x="1" y="10" width="12" height="3" rx="1"/></svg>
        </button>
        <div style="flex:1"></div>
        <div style="position:relative">
          <button class="gh-view-btn gh-more-btn${state._hasFilters?' has-filters':''}" id="${storagePrefix}-more" title="More options" style="width:auto;padding:0 10px;gap:4px;font-size:11px;font-weight:600;color:var(--text2)">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><circle cx="5" cy="12" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="19" cy="12" r="1.5"/></svg>
            More
          </button>
          <div class="gh-more-menu" id="${storagePrefix}-more-menu" style="display:none">
            <div class="gh-more-section-label">Columns</div>
            <div style="display:flex;gap:4px;padding:4px 10px 8px">
              ${[2,3,4,5].map(n=>`<button class="gh-col-btn${n===cols?' active':''}" data-cols="${n}">${n}</button>`).join('')}
            </div>
            <div class="gh-more-sep"></div>
            <button class="gh-more-item" id="${storagePrefix}-sort">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>
              Sort
            </button>
            <button class="gh-more-item gh-filter-item${state._hasFilters?' has-filters':''}" id="${storagePrefix}-filter">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/></svg>
              Advanced Filters
              <span class="gh-filter-dot"></span>
            </button>
          </div>
        </div>
      </div>
    `;

    // ── Wire toggle buttons ───────────────────────────────────
    container.querySelector(`#${storagePrefix}-vgrid`).addEventListener('click', () => _setView('grid'));
    container.querySelector(`#${storagePrefix}-vlist`).addEventListener('click', () => _setView('list'));
    // ⋮ More menu toggle
    const moreBtn = container.querySelector(`#${storagePrefix}-more`);
    const moreMenu = container.querySelector(`#${storagePrefix}-more-menu`);
    if (moreBtn && moreMenu) {
      moreBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const open = moreMenu.style.display === 'block';
        moreMenu.style.display = open ? 'none' : 'block';
      });
      document.addEventListener('click', () => { if(moreMenu) moreMenu.style.display = 'none'; });
    }
    container.querySelectorAll('.gh-col-btn').forEach(b => {
      b.addEventListener('click', () => _setCols(+b.dataset.cols));
    });

    // ── Filter button — opens drawer ──────────────────────────
    container.querySelector(`#${storagePrefix}-filter`)?.addEventListener('click', () => {
      if (moreMenu) moreMenu.style.display = 'none';
      _openFilterDrawer(storagePrefix, state, callback, options.filterFields);
    });

    // ── Sort button ───────────────────────────────────────────
    container.querySelector(`#${storagePrefix}-sort`)?.addEventListener('click', () => {
      if (moreMenu) moreMenu.style.display = 'none';
      _openSortDrawer(storagePrefix, state, callback, options.sortFields || []);
    });

    function _setView(v) {
      state.view = v;
      localStorage.setItem(storagePrefix + '_view', v);
      container.querySelectorAll('.gh-view-btn').forEach(b => b.classList.remove('active'));
      container.querySelector(`#${storagePrefix}-v${v}`)?.classList.add('active');
      // Restore cols for this view
      const savedCols = v === 'list'
        ? (parseInt(localStorage.getItem(storagePrefix + '_list_cols')) || options.defaultColsList || 1)
        : (parseInt(localStorage.getItem(storagePrefix + '_cols')) || options.defaultCols || (window.innerWidth >= 768 ? 4 : 2));
      state.cols = savedCols;
      container.querySelectorAll('.gh-col-btn').forEach(b => b.classList.toggle('active', +b.dataset.cols === savedCols));
      callback && callback({ ...state });
    }

    function _setCols(n) {
      state.cols = n;
      const colKey = state.view === 'list' ? storagePrefix + '_list_cols' : storagePrefix + '_cols';
      localStorage.setItem(colKey, n);
      container.querySelectorAll('.gh-col-btn').forEach(b => b.classList.toggle('active', +b.dataset.cols === n));
      callback && callback({ ...state });
    }

    _instances[storagePrefix] = { state, container, storagePrefix, callback, options };
    return { getState: () => ({ ...state }) };
  }

  // ── Advanced Filter Drawer ────────────────────────────────────
  function _openFilterDrawer(prefix, state, callback, fields = []) {
    document.getElementById('gh-adv-drawer')?.remove();

    const drawer = document.createElement('div');
    drawer.id = 'gh-adv-drawer';
    drawer.className = 'gh-adv-drawer open';

    // Build filter fields HTML
    const fieldsHtml = fields.map(f => _buildField(f, state.filters)).join('');

    drawer.innerHTML = `
      <div class="gh-adv-scrim"></div>
      <div class="gh-adv-panel">
        <div class="gh-adv-handle"></div>
        <div class="gh-adv-header">
          <div class="gh-adv-title">Advanced Filters</div>
        </div>
        <div class="gh-adv-body">${fieldsHtml}</div>
        <div class="gh-adv-footer">
          <button class="gh-adv-reset" id="gh-adv-reset">Reset All</button>
          <button class="gh-adv-apply" id="gh-adv-apply">Apply</button>
        </div>
      </div>
    `;

    document.body.appendChild(drawer);

    // Scrim close
    drawer.querySelector('.gh-adv-scrim').addEventListener('click', () => drawer.remove());

    // Reset
    drawer.querySelector('#gh-adv-reset').addEventListener('click', () => {
      state.filters = {};
      drawer.remove();
      _updateFilterBtn(prefix);
      callback && callback({ ...state });
    });

    // Apply
    drawer.querySelector('#gh-adv-apply').addEventListener('click', () => {
      state.filters = _readFilters(drawer, fields);
      drawer.remove();
      _updateFilterBtn(prefix);
      callback && callback({ ...state });
    });
  }

  function _buildField(field, currentFilters) {
    const val = currentFilters[field.key] || '';
    switch(field.type) {
      case 'select':
        return `<div>
          <div class="gh-adv-section-label">${field.label}</div>
          <select data-key="${field.key}" style="width:100%;padding:9px 12px;border-radius:var(--r);border:1px solid var(--border2);background:var(--bg3);color:var(--text);font-size:14px;font-family:var(--sans)">
            <option value="">— Any —</option>
            ${(field.options||[]).map(o=>`<option value="${o.value||o}"${val===String(o.value||o)?' selected':''}>${o.label||o}</option>`).join('')}
          </select>
        </div>`;
      case 'text':
        return `<div>
          <div class="gh-adv-section-label">${field.label}</div>
          <input data-key="${field.key}" type="text" value="${esc(val)}" placeholder="${field.placeholder||''}"
            style="width:100%;padding:9px 12px;border-radius:var(--r);border:1px solid var(--border2);background:var(--bg3);color:var(--text);font-size:14px;font-family:var(--sans);box-sizing:border-box">
        </div>`;
      case 'toggle':
        return `<div>
          <div class="gh-adv-section-label">${field.label}</div>
          <div style="display:flex;gap:6px">
            ${(field.options||[{label:'Any',value:''},{label:'Yes',value:'1'},{label:'No',value:'0'}]).map(o=>`
              <button data-key="${field.key}" data-val="${o.value}"
                class="gh-col-btn${val===String(o.value)?' active':''}"
                style="width:auto;padding:0 12px;font-size:12px"
                onclick="this.closest('[data-key]')?.querySelectorAll('[data-val]')?.forEach(b=>b.classList.remove('active'));this.classList.add('active')">
                ${o.label}
              </button>`).join('')}
          </div>
        </div>`;
      case 'tags':
        return `<div>
          <div class="gh-adv-section-label">${field.label}</div>
          <div id="gh-adv-tags-wrap" style="display:flex;flex-wrap:wrap;gap:6px;padding:8px;border-radius:var(--r);border:1px solid var(--border2);background:var(--bg3);min-height:38px">
            ${(val&&Array.isArray(val)?val:[]).map(t=>`<span class="gh-tag-pill" data-tag="${esc(t)}">${esc(t)}<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></span>`).join('')}
            <input id="gh-adv-tag-input" type="text" placeholder="Add tag…" style="border:none;background:transparent;outline:none;font-size:13px;color:var(--text);min-width:80px;font-family:var(--sans)">
          </div>
        </div>`;
      default: return '';
    }
  }

  function _readFilters(drawer, fields) {
    const out = {};
    fields.forEach(f => {
      if (f.type === 'tags') {
        const pills = [...drawer.querySelectorAll('.gh-tag-pill[data-tag]')].map(p=>p.dataset.tag);
        if (pills.length) out[f.key] = pills;
      } else if (f.type === 'toggle') {
        const active = drawer.querySelector(`button[data-key="${f.key}"].active`);
        if (active && active.dataset.val !== '') out[f.key] = active.dataset.val;
      } else {
        const el = drawer.querySelector(`[data-key="${f.key}"]`);
        if (el && el.value) out[f.key] = el.value;
      }
    });
    return out;
  }

  function _updateFilterBtn(prefix) {
    const inst = _instances[prefix];
    if (!inst) return;
    const btn = inst.container.querySelector(`#${prefix}-filter`);
    if (!btn) return;
    const hasFilters = Object.keys(inst.state.filters).length > 0;
    btn.classList.toggle('has-filters', hasFilters);
  }

  function _openSortDrawer(prefix, state, callback, fields) {
    if (!fields.length) return;
    document.getElementById('gh-sort-drawer')?.remove();
    const drawer = document.createElement('div');
    drawer.id = 'gh-sort-drawer';
    drawer.className = 'gh-adv-drawer open';
    const currentSort = state.sort || '';
    const currentDir  = state.sortDir || 'asc';
    drawer.innerHTML = `
      <div class="gh-adv-scrim"></div>
      <div class="gh-adv-panel">
        <div class="gh-adv-handle"></div>
        <div class="gh-adv-header"><div class="gh-adv-title">Sort</div></div>
        <div class="gh-adv-body">
          ${fields.map(f => `
            <button data-sort="${f.key}" class="gh-more-item${currentSort===f.key?' active':''}" style="border-radius:var(--r);border:1px solid ${currentSort===f.key?'var(--accent-bd)':'var(--border)'};background:${currentSort===f.key?'var(--accent-bg)':'transparent'};margin-bottom:4px;color:${currentSort===f.key?'var(--accent)':'var(--text2)'};font-weight:${currentSort===f.key?'600':'400'}">
              ${f.label}
              ${currentSort===f.key?`<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="margin-left:auto">${currentDir==='asc'?'<polyline points="18 15 12 9 6 15"/>':'<polyline points="6 9 12 15 18 9"/>'}</svg>`:''}
            </button>`).join('')}
        </div>
        <div class="gh-adv-footer">
          <button class="gh-adv-reset" id="gh-sort-clear">Clear</button>
          <button class="gh-adv-apply" id="gh-sort-close">Done</button>
        </div>
      </div>`;
    document.body.appendChild(drawer);
    drawer.querySelector('.gh-adv-scrim').addEventListener('click', () => drawer.remove());
    drawer.querySelector('#gh-sort-close').addEventListener('click', () => drawer.remove());
    drawer.querySelector('#gh-sort-clear').addEventListener('click', () => {
      state.sort = ''; state.sortDir = 'asc';
      callback && callback({...state});
      drawer.remove();
    });
    drawer.querySelectorAll('[data-sort]').forEach(btn => {
      btn.addEventListener('click', () => {
        const key = btn.dataset.sort;
        if (state.sort === key) {
          state.sortDir = state.sortDir === 'asc' ? 'desc' : 'asc';
        } else {
          state.sort = key; state.sortDir = 'asc';
        }
        callback && callback({...state});
        drawer.remove();
      });
    });
  }

  // Wire tag input — Enter/comma to add
  document.addEventListener('keydown', e => {
    if (e.target.id !== 'gh-adv-tag-input') return;
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      const val = e.target.value.trim().replace(/,$/, '');
      if (!val) return;
      const wrap = document.getElementById('gh-adv-tags-wrap');
      const pill = document.createElement('span');
      pill.className = 'gh-tag-pill';
      pill.dataset.tag = val;
      pill.innerHTML = `${esc(val)}<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`;
      pill.addEventListener('click', () => pill.remove());
      wrap.insertBefore(pill, e.target);
      e.target.value = '';
    }
  });

  document.addEventListener('click', e => {
    const pill = e.target.closest('.gh-tag-pill');
    if (pill && document.getElementById('gh-adv-tags-wrap')?.contains(pill)) pill.remove();
  });

  return { init };
})();
// ══════════════════════════════════════════════════════════════
// GH_FAMILY — Family member pill input for any form
//
// Usage:
//   <!-- In your form drawer HTML: -->
//   <div id="myFamilyWrap"></div>
//
//   // In your openDrawer function (after setting field values):
//   GH_FAMILY.init('myFamilyWrap', currentRecord?.family_members || []);
//
//   // In your save function (include in POST/PUT body):
//   family_member_ids: GH_FAMILY.getIds('myFamilyWrap')
//
// The container renders a label + pill list + autocomplete input.
// Existing pills are pre-populated from the passed family_members array.
// ══════════════════════════════════════════════════════════════
window.GH_FAMILY = (function() {

  const CSS_ID = 'gh-family-styles';

  function _injectStyles() {
    if (document.getElementById(CSS_ID)) return;
    const s = document.createElement('style');
    s.id = CSS_ID;
    s.textContent = `
.gh-fam-wrap { position: relative; }
.gh-fam-label { font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--text3);margin-bottom:6px;display:block; }
.gh-fam-field {
  display:flex;flex-wrap:wrap;gap:5px;align-items:center;
  padding:6px 8px;border-radius:var(--r);border:1px solid var(--border2);
  background:var(--bg3);min-height:36px;cursor:text;
}
.gh-fam-field:focus-within { border-color:var(--accent); }
.gh-fam-pill {
  display:inline-flex;align-items:center;gap:4px;
  padding:2px 8px 2px 10px;border-radius:20px;
  background:var(--accent-bg);border:1px solid var(--accent-bd);
  color:var(--accent);font-size:12px;font-weight:600;
  white-space:nowrap;
}
.gh-fam-pill-x {
  width:14px;height:14px;border-radius:50%;
  display:flex;align-items:center;justify-content:center;
  cursor:pointer;opacity:.6;background:none;border:none;color:inherit;
  padding:0;font-size:12px;line-height:1;
}
.gh-fam-pill-x:hover { opacity:1; }
.gh-fam-input {
  border:none;background:transparent;outline:none;
  font-size:13px;color:var(--text);font-family:var(--sans);
  min-width:80px;flex:1;
}
.gh-fam-dropdown {
  position:absolute;top:calc(100% + 4px);left:0;right:0;
  background:var(--bg2);border:1px solid var(--border2);
  border-radius:var(--r);box-shadow:0 8px 24px rgba(0,0,0,.15);
  z-index:9999;max-height:200px;overflow-y:auto;display:none;
}
.gh-fam-dropdown.open { display:block; }
.gh-fam-opt {
  padding:8px 12px;cursor:pointer;font-size:13px;color:var(--text2);
  display:flex;align-items:center;gap:8px;
}
.gh-fam-opt:hover,.gh-fam-opt.focused { background:var(--accent-bg);color:var(--accent); }
.gh-fam-opt-avatar {
  width:24px;height:24px;border-radius:50%;
  background:var(--accent-bg);border:1px solid var(--accent-bd);
  display:flex;align-items:center;justify-content:center;
  font-size:11px;font-weight:700;color:var(--accent);flex-shrink:0;
}
    `;
    document.head.appendChild(s);
  }

  let _allMembers = null;

  async function _loadMembers() {
    if (_allMembers) return _allMembers;
    try {
      _allMembers = await fetch('/api/v1/settings/family').then(r => r.ok ? r.json() : []);
    } catch(e) { _allMembers = []; }
    return _allMembers;
  }

  /**
   * init — render the family member pill input into a container.
   * @param {string} containerId  — ID of the wrapper element
   * @param {Array}  existing     — existing family_members from the record [{id, display_name}]
   */
  async function init(containerId, existing = [], options = {}) {
    _injectStyles();
    const container = document.getElementById(containerId);
    if (!container) return;

    const showLabel = options.showLabel !== false; // default true
    const members = await _loadMembers();
    const selected = new Map(); // id → display_name
    (existing || []).forEach(m => {
      if (m && m.id) selected.set(m.id, m.display_name || m.name || '');
    });

    function render() {
      const pills = [...selected.entries()].map(([id, name]) => `
        <span class="gh-fam-pill" data-fam-id="${id}">
          ${esc(name)}
          <button class="gh-fam-pill-x" data-remove="${id}" type="button">×</button>
        </span>`).join('');

      container.innerHTML = `
        <div class="gh-fam-wrap">
          ${showLabel ? '<span class="gh-fam-label">Family Members</span>' : ''}
          <div class="gh-fam-field" id="${containerId}-field">
            ${pills}
            <input class="gh-fam-input" id="${containerId}-input" type="text"
              placeholder="${selected.size ? '' : 'Add family member…'}" autocomplete="off">
          </div>
          <div class="gh-fam-dropdown" id="${containerId}-dropdown"></div>
        </div>`;

      // Wire pill removes
      container.querySelectorAll('.gh-fam-pill-x').forEach(btn => {
        btn.addEventListener('click', e => {
          e.stopPropagation();
          selected.delete(+btn.dataset.remove);
          render();
          document.getElementById(containerId + '-input')?.focus();
        });
      });

      // Wire input
      const input = document.getElementById(containerId + '-input');
      const dropdown = document.getElementById(containerId + '-dropdown');
      if (!input) return;

      input.addEventListener('input', () => {
        const q = input.value.trim().toLowerCase();
        const opts = members.filter(m => !selected.has(m.id) &&
          (m.display_name || '').toLowerCase().includes(q));
        if (!opts.length || !q) { dropdown.classList.remove('open'); return; }
        dropdown.innerHTML = opts.map(m => `
          <div class="gh-fam-opt" data-id="${m.id}" data-name="${esc(m.display_name)}">
            <div class="gh-fam-opt-avatar">${(m.display_name||'?')[0].toUpperCase()}</div>
            ${esc(m.display_name)}${m.relationship ? `<span style="font-size:11px;color:var(--text3);margin-left:4px">${esc(m.relationship)}</span>` : ''}
          </div>`).join('');
        dropdown.classList.add('open');
      });

      dropdown.addEventListener('click', e => {
        const opt = e.target.closest('.gh-fam-opt');
        if (!opt) return;
        selected.set(+opt.dataset.id, opt.dataset.name);
        input.value = '';
        dropdown.classList.remove('open');
        render();
        document.getElementById(containerId + '-input')?.focus();
      });

      // Close dropdown on outside click
      document.addEventListener('click', e => {
        if (!container.contains(e.target)) dropdown.classList.remove('open');
      }, { once: false });

      // Focus field when clicking wrapper
      document.getElementById(containerId + '-field')?.addEventListener('click', () => {
        document.getElementById(containerId + '-input')?.focus();
      });
    }

    render();
  }

  /**
   * getIds — return array of selected family member IDs.
   * @param {string} containerId
   * @returns {number[]}
   */
  function getIds(containerId) {
    return [...document.querySelectorAll(`#${containerId} .gh-fam-pill[data-fam-id]`)]
      .map(p => +p.dataset.famId)
      .filter(Boolean);
  }

  return { init, getIds };
})();

// ── GH_TAG_SEARCH — cross-module tag search modal ─────────────
// Usage: GH_TAG_SEARCH.open('tagname')
// Wired automatically to all .tag-chip elements via delegated click.
window.GH_TAG_SEARCH = (function() {

  function _injectStyles() {
    if (document.getElementById('gh-ts-styles')) return;
    const s = document.createElement('style');
    s.id = 'gh-ts-styles';
    s.textContent = `
      #gh-ts-overlay {
        position:fixed;inset:0;z-index:9500;
        background:rgba(0,0,0,.5);backdrop-filter:blur(4px);
        display:flex;align-items:flex-end;justify-content:center;
      }
      #gh-ts-sheet {
        background:var(--bg2);border-radius:20px 20px 0 0;
        width:100%;max-width:640px;max-height:80vh;
        display:flex;flex-direction:column;
        box-shadow:0 -8px 40px rgba(0,0,0,.25);
      }
      #gh-ts-header {
        display:flex;align-items:center;gap:10px;
        padding:16px 20px 12px;border-bottom:1px solid var(--border);
        flex-shrink:0;
      }
      #gh-ts-title {
        flex:1;font-size:16px;font-weight:700;color:var(--text);
      }
      #gh-ts-close {
        width:30px;height:30px;border-radius:50%;border:none;
        background:var(--bg3);color:var(--text2);font-size:18px;
        cursor:pointer;display:flex;align-items:center;justify-content:center;
        flex-shrink:0;
      }
      #gh-ts-body {
        overflow-y:auto;padding:12px 16px 24px;flex:1;
      }
      .gh-ts-group-label {
        font-size:10px;font-weight:700;text-transform:uppercase;
        letter-spacing:.07em;color:var(--text3);font-family:var(--mono);
        padding:10px 0 6px;
      }
      .gh-ts-item {
        display:flex;align-items:center;justify-content:space-between;
        padding:9px 12px;background:var(--bg3);border-radius:var(--r);
        margin-bottom:5px;cursor:pointer;text-decoration:none;color:var(--text);
        border:1px solid transparent;transition:border-color .1s;
      }
      .gh-ts-item:hover { border-color:var(--accent); }
      .gh-ts-item-title { font-size:13px;color:var(--text);flex:1;min-width:0;
        overflow:hidden;text-overflow:ellipsis;white-space:nowrap; }
      .gh-ts-item-arrow { color:var(--accent);font-size:14px;margin-left:8px;flex-shrink:0; }
      .gh-ts-empty { text-align:center;padding:32px 16px;color:var(--text3);font-size:14px; }
    `;
    document.head.appendChild(s);
  }

  function open(tagName) {
    _injectStyles();
    // Remove existing
    document.getElementById('gh-ts-overlay')?.remove();

    const overlay = document.createElement('div');
    overlay.id = 'gh-ts-overlay';
    overlay.innerHTML = `
      <div id="gh-ts-sheet">
        <div id="gh-ts-header">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" stroke-width="2">
            <path d="M20.59 13.41l-7.17 7.17a2 2 0 01-2.83 0L2 12V2h10l8.59 8.59a2 2 0 010 2.82z"/>
            <line x1="7" y1="7" x2="7.01" y2="7"/>
          </svg>
          <div id="gh-ts-title">Tag: <span style="color:var(--accent)">${_esc(tagName)}</span></div>
          <button id="gh-ts-close" title="Close">×</button>
        </div>
        <div id="gh-ts-body"><div class="spinner"><div class="spin"></div>Searching…</div></div>
      </div>`;

    document.body.appendChild(overlay);

    overlay.addEventListener('click', e => { if (e.target === overlay) close(); });
    overlay.querySelector('#gh-ts-close').addEventListener('click', close);

    _fetch(tagName);
  }

  function close() {
    document.getElementById('gh-ts-overlay')?.remove();
  }

  async function _fetch(tagName) {
    const body = document.getElementById('gh-ts-body');
    if (!body) return;
    try {
      const r = await fetch(`/api/v1/settings/tags/search?tag=${encodeURIComponent(tagName)}`);
      const d = await r.json();

      if (!d.total) {
        body.innerHTML = `<div class="gh-ts-empty">No records tagged <strong>${_esc(tagName)}</strong></div>`;
        return;
      }

      const totalLabel = `${d.total} record${d.total !== 1 ? 's' : ''} across ${d.groups.length} module${d.groups.length !== 1 ? 's' : ''}`;
      document.getElementById('gh-ts-title').innerHTML =
        `Tag: <span style="color:var(--accent)">${_esc(tagName)}</span> <span style="font-size:12px;font-weight:400;color:var(--text3)">(${totalLabel})</span>`;

      body.innerHTML = d.groups.map(g => `
        <div class="gh-ts-group-label">${_esc(g.label)} — ${g.items.length}</div>
        ${g.items.map(item => `
          <a href="${_esc(g.href)}" target="_blank" class="gh-ts-item">
            <span class="gh-ts-item-title">${item.title ? _esc(item.title) : '<em style="color:var(--text3)">Untitled</em>'}</span>
            <span class="gh-ts-item-arrow">↗</span>
          </a>`).join('')}
      `).join('');
    } catch(e) {
      if (body) body.innerHTML = `<div class="gh-ts-empty">Search failed: ${_esc(e.message)}</div>`;
    }
  }

  function _esc(s) {
    return s ? String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;') : '';
  }

  // ── Global delegated click handler ───────────────────────────
  // Any .tag-chip with data-tag attribute (or text content) triggers search.
  // Injected once on DOMContentLoaded.
  function _wireGlobal() {
    document.addEventListener('click', e => {
      const chip = e.target.closest('.tag-chip:not(.tag-chip-form)');
      if (!chip) return;
      // Don't intercept chips that have a remove button (form chips)
      if (chip.querySelector('.tag-chip-remove')) return;
      const tag = chip.dataset.tag || chip.textContent?.trim();
      if (!tag) return;
      e.preventDefault();
      e.stopPropagation();
      open(tag);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', _wireGlobal);
  } else {
    _wireGlobal();
  }

  return { open, close };
})();


// ──────────────────────────────────────────────────────────────
// GH_BULK — Bulk select & action widget
// ──────────────────────────────────────────────────────────────
//
// Adds a "Select" toggle to a module toolbar. When enabled, every card in
// the configured container shows a checkbox overlay. Clicking a card toggles
// its selection (drawer open is intercepted). A floating action bar at the
// bottom shows count + actions.
//
// Usage:
//   GH_BULK.init({
//     toolbarId:    'wrdViewToolbar',
//     containerId:  'wrdItemsGrid',
//     cardSelector: '.lb-item-card',
//     getId:        (cardEl) => cardEl.dataset.id,
//     isArchived:   (cardEl) => cardEl.classList.contains('is-archived'),
//     refresh:      () => loadItems(),
//     onArchive:    async (ids) => { for (const id of ids) await window.api('PATCH', `/wardrobe/items/${id}/archive`, { archive:true }); },
//     onUnarchive:  async (ids) => { for (const id of ids) await window.api('PUT', `/wardrobe/items/${id}/unarchive`, {}); },
//     onDelete:     async (ids) => { for (const id of ids) await window.api('DELETE', `/wardrobe/items/${id}`); },
//   });
//
// Modules must:
//   1. Render cards with data-id="${item.id}"
//   2. Optionally add an `.is-archived` class on archived cards
//   3. Provide a toolbar slot where the Select button can go
//
// Each call replaces any prior init for the same toolbarId.
window.GH_BULK = (function(){
  const _instances = new Map(); // toolbarId → instance state

  function _injectStylesOnce() {
    if (document.getElementById('gh-bulk-styles')) return;
    const style = document.createElement('style');
    style.id = 'gh-bulk-styles';
    style.textContent = `
      .gh-bulk-toggle {
        font-size: 12px; padding: 5px 10px; border-radius: 999px;
        border: 1px solid var(--border); background: var(--bg2);
        color: var(--text2); cursor: pointer; font-family: var(--sans);
        display: inline-flex; align-items: center; gap: 4px;
        transition: background .12s, color .12s, border-color .12s;
      }
      .gh-bulk-toggle:hover { border-color: var(--accent); color: var(--accent); }
      .gh-bulk-toggle.active { background: var(--accent); color: #fff; border-color: var(--accent); }
      .gh-bulk-mode .gh-bulk-card { position: relative; }
      .gh-bulk-mode .gh-bulk-card::before {
        content: ""; position: absolute; top: 6px; right: 6px;
        width: 22px; height: 22px; border-radius: 50%;
        border: 2px solid #fff; background: rgba(255,255,255,.8);
        box-shadow: 0 1px 4px rgba(0,0,0,.25);
        z-index: 50; pointer-events: none;
      }
      .gh-bulk-mode .gh-bulk-card.gh-bulk-selected::before {
        background: var(--accent);
        box-shadow: 0 0 0 2px var(--accent), 0 0 0 4px rgba(255,255,255,.6);
      }
      .gh-bulk-mode .gh-bulk-card.gh-bulk-selected::after {
        content: "✓"; position: absolute; top: 6px; right: 6px;
        width: 22px; height: 22px; line-height: 22px;
        text-align: center; color: #fff; font-weight: 700; font-size: 14px;
        z-index: 51; pointer-events: none;
      }
      .gh-bulk-mode .gh-bulk-card { cursor: pointer; }
      .gh-bulk-mode .gh-bulk-card.gh-bulk-selected {
        outline: 2px solid var(--accent); outline-offset: -2px;
      }
      .gh-bulk-bar {
        position: fixed; left: 50%; bottom: 76px; transform: translateX(-50%);
        background: var(--text); color: var(--bg);
        border-radius: 999px; padding: 8px 14px;
        display: flex; align-items: center; gap: 6px;
        box-shadow: 0 8px 24px rgba(0,0,0,.4);
        z-index: 200; font-size: 13px;
        max-width: calc(100vw - 32px);
      }
      .gh-bulk-bar-count { font-weight: 600; padding: 0 10px 0 4px; white-space: nowrap; }
      .gh-bulk-bar button {
        background: transparent; border: 1px solid rgba(255,255,255,.25);
        color: inherit; border-radius: 999px;
        padding: 5px 12px; font-size: 12px; font-weight: 500;
        cursor: pointer; white-space: nowrap;
        transition: background .12s;
      }
      .gh-bulk-bar button:hover:not(:disabled) { background: rgba(255,255,255,.12); }
      .gh-bulk-bar button:disabled { opacity: .4; cursor: not-allowed; }
      .gh-bulk-bar button.danger { border-color: rgba(239,68,68,.5); color: #fca5a5; }
      .gh-bulk-bar button.danger:hover:not(:disabled) { background: rgba(239,68,68,.18); }
    `;
    document.head.appendChild(style);
  }

  function _renderActionBar(inst) {
    const sel = inst.selected;
    const count = sel.size;
    if (!count) {
      if (inst.bar) { inst.bar.remove(); inst.bar = null; }
      return;
    }
    if (!inst.bar) {
      inst.bar = document.createElement('div');
      inst.bar.className = 'gh-bulk-bar';
      document.body.appendChild(inst.bar);
    }
    // Determine archive context: if every selected is archived → show Restore;
    // if every selected is active → show Archive; mixed → both disabled with hint.
    const cards = Array.from(inst.container.querySelectorAll(inst.cfg.cardSelector));
    const selectedCards = cards.filter(c => sel.has(inst.cfg.getId(c)));
    let allArchived = true, allActive = true;
    if (typeof inst.cfg.isArchived === 'function') {
      for (const c of selectedCards) {
        if (inst.cfg.isArchived(c)) allActive = false; else allArchived = false;
      }
    } else { allArchived = false; }
    const canArchive = allActive && typeof inst.cfg.onArchive === 'function';
    const canUnarchive = allArchived && typeof inst.cfg.onUnarchive === 'function';
    const canDelete = typeof inst.cfg.onDelete === 'function';

    inst.bar.innerHTML = '';
    const span = document.createElement('span');
    span.className = 'gh-bulk-bar-count';
    span.textContent = count + ' selected';
    inst.bar.appendChild(span);

    if (inst.cfg.onArchive) {
      const b = document.createElement('button');
      b.textContent = '🗄️ Archive';
      b.disabled = !canArchive;
      b.title = canArchive ? '' : 'All selected must be active to archive';
      b.onclick = () => _bulkAction(inst, 'archive');
      inst.bar.appendChild(b);
    }
    if (inst.cfg.onUnarchive) {
      const b = document.createElement('button');
      b.textContent = '↺ Restore';
      b.disabled = !canUnarchive;
      b.title = canUnarchive ? '' : 'All selected must be archived to restore';
      b.onclick = () => _bulkAction(inst, 'unarchive');
      inst.bar.appendChild(b);
    }
    if (canDelete) {
      const b = document.createElement('button');
      b.textContent = '🗑 Delete';
      b.className = 'danger';
      b.onclick = () => _bulkAction(inst, 'delete');
      inst.bar.appendChild(b);
    }
    const cancel = document.createElement('button');
    cancel.textContent = '✕';
    cancel.title = 'Cancel selection';
    cancel.onclick = () => { sel.clear(); _redraw(inst); };
    inst.bar.appendChild(cancel);
  }

  async function _bulkAction(inst, action) {
    const ids = Array.from(inst.selected);
    if (!ids.length) return;
    if (action === 'delete') {
      if (!confirm(`Permanently delete ${ids.length} item${ids.length===1?'':'s'}? This cannot be undone.`)) return;
    }
    try {
      if (action === 'archive')   await inst.cfg.onArchive(ids);
      if (action === 'unarchive') await inst.cfg.onUnarchive(ids);
      if (action === 'delete')    await inst.cfg.onDelete(ids);
      const verb = action === 'archive' ? 'archived' : action === 'unarchive' ? 'restored' : 'deleted';
      if (typeof toast === 'function') toast(`${ids.length} ${verb}`, 'ok');
      inst.selected.clear();
      _redraw(inst);
      if (typeof inst.cfg.refresh === 'function') inst.cfg.refresh();
    } catch(e) {
      if (typeof toast === 'function') toast(`Bulk ${action} failed: ${e.message||e}`, 'err');
    }
  }

  function _redraw(inst) {
    const cards = inst.container.querySelectorAll(inst.cfg.cardSelector);
    cards.forEach(c => {
      c.classList.add('gh-bulk-card');
      const id = inst.cfg.getId(c);
      c.classList.toggle('gh-bulk-selected', inst.selected.has(id));
    });
    _renderActionBar(inst);
  }

  function _onContainerClick(inst, e) {
    if (!inst.active) return;
    const card = e.target.closest(inst.cfg.cardSelector);
    if (!card || !inst.container.contains(card)) return;
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();
    const id = inst.cfg.getId(card);
    if (id == null) return;
    if (inst.selected.has(id)) inst.selected.delete(id);
    else inst.selected.add(id);
    _redraw(inst);
  }

  function _setActive(inst, on) {
    inst.active = !!on;
    inst.toggleBtn?.classList.toggle('active', inst.active);
    inst.container.classList.toggle('gh-bulk-mode', inst.active);
    if (!inst.active) {
      inst.selected.clear();
      _redraw(inst);
    } else {
      _redraw(inst);
    }
  }

  function init(cfg) {
    _injectStylesOnce();
    if (!cfg || !cfg.toolbarId || !cfg.containerId || !cfg.cardSelector || typeof cfg.getId !== 'function') {
      console.warn('GH_BULK.init: missing required config'); return;
    }
    const toolbar = document.getElementById(cfg.toolbarId);
    const container = document.getElementById(cfg.containerId);
    if (!toolbar || !container) {
      console.warn('GH_BULK.init: toolbar or container not found', cfg.toolbarId, cfg.containerId);
      return;
    }
    // Tear down any prior instance for same toolbar
    if (_instances.has(cfg.toolbarId)) {
      const old = _instances.get(cfg.toolbarId);
      old.toggleBtn?.remove();
      old.bar?.remove();
      container.removeEventListener('click', old._handler, true);
      container.classList.remove('gh-bulk-mode');
    }
    const inst = { cfg, toolbar, container, selected: new Set(), active: false, bar: null };
    // Build toggle button
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'gh-bulk-toggle';
    btn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg> Select';
    btn.title = 'Bulk select';
    btn.onclick = () => _setActive(inst, !inst.active);
    inst.toggleBtn = btn;
    // If the toolbar contains a .gh-view-toolbar (built by GH_VIEW), put the Select
    // button inside it so it shares the same flex row and stays right-aligned with
    // More. Otherwise append directly to the toolbar element.
    const innerToolbar = toolbar.querySelector('.gh-view-toolbar');
    if (innerToolbar) innerToolbar.appendChild(btn);
    else toolbar.appendChild(btn);
    // Capture-phase click handler
    inst._handler = (e) => _onContainerClick(inst, e);
    container.addEventListener('click', inst._handler, true);
    // Re-tag cards on every redraw call by external code: use MutationObserver
    inst._mo = new MutationObserver(() => { if (inst.active) _redraw(inst); });
    inst._mo.observe(container, { childList: true, subtree: true });
    _instances.set(cfg.toolbarId, inst);
    return inst;
  }

  // Global Escape handler — exits select mode for whichever instance is active
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    for (const inst of _instances.values()) {
      if (inst.active) { _setActive(inst, false); break; }
    }
  });

  // ── Escape closes any open .gh-drawer centered modal ─────────
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    document.querySelectorAll('.gh-drawer.open').forEach(d => d.classList.remove('open'));
  });

  function refresh(toolbarId) {
    const inst = _instances.get(toolbarId);
    if (inst) _redraw(inst);
  }

  return { init, refresh };
})();


// ──────────────────────────────────────────────────────────────
// autoFillZip — lightweight ZIP → city/state autofill
// ──────────────────────────────────────────────────────────────
// Used by contact/property forms on `oninput="autoFillZip(this.value,'cityId','stateId')"`.
// No-ops until 5 digits typed; doesn't overwrite values the user already typed.
// Uses zippopotam.us (free, no key, no rate limit).
window.autoFillZip = async function(zip, cityId, stateId) {
  if (!zip || zip.length !== 5 || !/^\d{5}$/.test(zip)) return;
  const cityEl  = document.getElementById(cityId);
  const stateEl = document.getElementById(stateId);
  if ((cityEl?.value || '').trim() && (stateEl?.value || '').trim()) return;
  try {
    const r = await fetch(`https://api.zippopotam.us/us/${zip}`);
    if (!r.ok) return;
    const d = await r.json();
    const place = d.places?.[0];
    if (!place) return;
    if (cityEl  && !cityEl.value.trim())  cityEl.value  = place['place name'] || '';
    if (stateEl && !stateEl.value.trim()) stateEl.value = (place['state abbreviation'] || '').toUpperCase();
  } catch(_) { /* offline — skip silently */ }
};
