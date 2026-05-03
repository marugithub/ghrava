/**
 * gh-lens.js — The Lens
 *
 * The new universal filter UI for Ghrava modules. Replaces the GH_VIEW
 * toolbar's filter drawer + chip system with a sentence-shaped bar:
 *
 *     Subscriptions  12  for Jamie renewing this month   reset
 *
 * — where everything after the count is a composable phrase. Each blue
 * dotted word is a pill — click to edit, value updates, count updates,
 * sentence stays grammatical.
 *
 * Empty state:
 *     Subscriptions  23  narrow by family member, status, time…
 *                                                              |
 *                                            (blinking cursor)
 *
 * Click the bar (or press / from anywhere) → focus, suggestions panel
 * pops below. Type "ja" → fuzzy match across people, statuses, times.
 * Enter accepts the top suggestion → becomes a pill.
 *
 * Persistence: sessionStorage. Filters survive across page navigation
 * within the same browser session, gone on tab close.
 *
 * Dependencies:
 *   LENS_CONFIG (lens-config.js) — the verb table per module
 *   window.api (lt-core.js)      — for fetching family members, tags
 *
 * Public API:
 *   GH_LENS.init(opts)   — mount the lens onto a container
 *     opts.container       — DOM element or id where the lens renders
 *     opts.moduleId        — which module config to use
 *     opts.viewToolbar     — optional, true to render grid/list/card toggle
 *     opts.views           — view options (passed through to GH_VIEW init style)
 *     opts.sortFields      — sort options
 *     opts.onChange        — callback({ filters, view, sort })
 *     opts.totalCount      — initial total (rendered next to module name)
 *
 *   GH_LENS.setCount(n)  — update the count display after a filter applies
 *   GH_LENS.getState()   — read current filters/view/sort
 *   GH_LENS.applyFilter(dim, value) — programmatic filter add (rarely needed)
 *   GH_LENS.clear()      — clear all filters
 */

(function() {
  'use strict';

  const SS_KEY = 'gh_lens_state_v1';

  // Cache for /settings/family — fetched once per session, lasts the
  // life of the page. Cards' GH_MOUNT also lazy-fetches this; we share.
  let _familyCache = null;
  let _familyFetchPromise = null;

  let _tagCache = null;
  let _tagFetchPromise = null;

  function fetchFamily() {
    if (Array.isArray(_familyCache)) return Promise.resolve(_familyCache);
    if (_familyFetchPromise) return _familyFetchPromise;
    if (Array.isArray(window.familyMembers) && window.familyMembers.length) {
      _familyCache = window.familyMembers;
      return Promise.resolve(_familyCache);
    }
    if (!window.api) return Promise.resolve([]);
    _familyFetchPromise = window.api('GET', '/settings/family')
      .then(rows => {
        _familyCache = Array.isArray(rows) ? rows : [];
        if (!window.familyMembers || !window.familyMembers.length) {
          window.familyMembers = _familyCache;
        }
        return _familyCache;
      })
      .catch(() => { _familyCache = []; return []; });
    return _familyFetchPromise;
  }

  function fetchTags() {
    if (Array.isArray(_tagCache)) return Promise.resolve(_tagCache);
    if (_tagFetchPromise) return _tagFetchPromise;
    if (!window.api) return Promise.resolve([]);
    _tagFetchPromise = window.api('GET', '/tags')
      .then(rows => { _tagCache = Array.isArray(rows) ? rows : []; return _tagCache; })
      .catch(() => { _tagCache = []; return []; });
    return _tagFetchPromise;
  }

  // v202604.131 — API value cache for `type: 'api'` dims.
  // Each unique source URL is fetched once per page life. Result is the
  // raw response (array). The dim config tells us how to read label/value.
  const _apiValueCache = new Map();      // url -> rows[]
  const _apiValuePromises = new Map();   // url -> in-flight Promise
  function fetchApiValues(source) {
    if (!source) return Promise.resolve([]);
    if (_apiValueCache.has(source)) return Promise.resolve(_apiValueCache.get(source));
    if (_apiValuePromises.has(source)) return _apiValuePromises.get(source);
    if (!window.api) return Promise.resolve([]);
    const p = window.api('GET', source)
      .then(rows => {
        const arr = Array.isArray(rows) ? rows : [];
        _apiValueCache.set(source, arr);
        return arr;
      })
      .catch(() => { _apiValueCache.set(source, []); return []; });
    _apiValuePromises.set(source, p);
    return p;
  }

  // Helper: extract a {label, value} pair from an API row using dim config.
  // Defaults: labelField = 'label' || 'name', valueField = 'value' || 'id'.
  // If row is a plain string, label === value === string.
  function readApiRow(row, dcfg) {
    if (typeof row === 'string' || typeof row === 'number') {
      return { label: String(row), value: row };
    }
    const lf = dcfg.labelField || (row.label != null ? 'label' : 'name');
    const vf = dcfg.valueField || (row.value != null ? 'value' : 'id');
    return { label: row[lf] != null ? String(row[lf]) : String(row[vf]),
             value: row[vf] != null ? row[vf] : row[lf] };
  }

  // ── Session storage ─────────────────────────────────────────────
  function loadState() {
    try {
      const raw = sessionStorage.getItem(SS_KEY);
      return raw ? JSON.parse(raw) : { filters: [] };
    } catch { return { filters: [] }; }
  }

  function saveState(state) {
    try { sessionStorage.setItem(SS_KEY, JSON.stringify(state)); } catch {}
  }

  function clearState() {
    try { sessionStorage.removeItem(SS_KEY); } catch {}
  }

  // ── DOM helpers ─────────────────────────────────────────────────
  function el(tag, attrs = {}, children = []) {
    const node = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (v == null || v === false) continue;
      if (k === 'class') node.className = v;
      else if (k === 'style' && typeof v === 'object') Object.assign(node.style, v);
      else if (k === 'dataset') Object.assign(node.dataset, v);
      else if (k.startsWith('on') && typeof v === 'function') node.addEventListener(k.slice(2), v);
      else if (k === 'html') node.innerHTML = v;
      else node.setAttribute(k, v);
    }
    for (const c of [].concat(children)) {
      if (c == null || c === false) continue;
      if (typeof c === 'string') node.appendChild(document.createTextNode(c));
      else node.appendChild(c);
    }
    return node;
  }

  // ── Suggestion building ─────────────────────────────────────────
  // Builds a flat list of all suggestions for a module — each tagged with
  // its dimension. Typing fuzzy-matches the LABEL of each.
  // apiValues: Map<dim, rows[]> — pre-fetched values for `type: 'api'` dims.
  function buildAllSuggestions(modCfg, family, tags, apiValues) {
    const out = [];
    apiValues = apiValues || new Map();
    for (const [dim, dcfg] of Object.entries(modCfg.dimensions)) {
      if (dim === 'person') {
        for (const fm of family) {
          const name = fm.display_name || fm.first_name || `Person ${fm.id}`;
          out.push({
            dim, verb: dcfg.verb, value: fm.id, label: name,
            avatar: fm.avatar_attachment_id
              ? `/api/v1/attachments/${fm.avatar_attachment_id}/thumb` : null,
            initials: (name || '?').slice(0, 1).toUpperCase(),
          });
        }
      } else if (dim === 'status') {
        for (const v of (dcfg.values || [])) {
          out.push({ dim, verb: dcfg.verb, value: v, label: v });
        }
      } else if (dim === 'time') {
        const presets = window.LENS_CONFIG.timePresets(dcfg.preset);
        for (const p of presets) {
          out.push({ dim, verb: dcfg.verb, value: p.label, label: p.label });
        }
      } else if (dim === 'tag') {
        for (const t of tags) {
          out.push({ dim, verb: dcfg.verb, value: t.name || t,
            label: t.name || t });
        }
      } else if (dcfg.type === 'select') {
        // v202604.127 — Generic single-select dim with custom values list.
        for (const v of (dcfg.values || [])) {
          out.push({ dim, verb: dcfg.verb, value: v, label: v });
        }
      } else if (dcfg.type === 'api') {
        // v202604.131 — Dynamic-values dim. Values fetched from API at init.
        const rows = apiValues.get(dim) || [];
        for (const row of rows) {
          const { label, value } = readApiRow(row, dcfg);
          if (label != null) out.push({ dim, verb: dcfg.verb, value, label });
        }
      }
      // type: 'text' is a special case — no pre-built suggestions; the
      // input field itself becomes the value source. Handled in the
      // suggestion popover renderer via a synthetic "use as filter" item.
    }
    return out;
  }

  function fuzzyMatch(query, suggestions) {
    if (!query) return suggestions;
    const q = query.toLowerCase().trim();
    return suggestions.filter(s => {
      const label = (s.label || '').toLowerCase();
      // Prefix match scores higher; substring match also OK
      return label.startsWith(q) || label.includes(q);
    }).sort((a, b) => {
      // Prefix matches first, then substring matches
      const ap = (a.label || '').toLowerCase().startsWith(q) ? 0 : 1;
      const bp = (b.label || '').toLowerCase().startsWith(q) ? 0 : 1;
      return ap - bp;
    });
  }

  // ── The main GH_LENS object ─────────────────────────────────────
  const GH_LENS = {

    _instance: null,

    init(opts) {
      const container = typeof opts.container === 'string'
        ? document.getElementById(opts.container) : opts.container;
      if (!container) {
        console.warn('[GH_LENS] container not found');
        return null;
      }
      const modCfg = window.LENS_CONFIG.get(opts.moduleId);
      if (!modCfg) {
        console.warn(`[GH_LENS] no config for module "${opts.moduleId}"`);
        return null;
      }

      // Load persisted state — but only the filters that apply to THIS module.
      // Cross-module filters (person, time, tag) carry over. Module-specific
      // ones (status values that don't exist here) are dropped.
      const persisted = loadState();
      const filters = (persisted.filters || []).filter(f => {
        const dcfg = modCfg.dimensions[f.dim];
        if (!dcfg) return false;
        if (f.dim === 'status') {
          return (dcfg.values || []).includes(f.value);
        }
        if (dcfg.type === 'select') {
          // v202604.127 — generic select dims validate against their values list
          return (dcfg.values || []).includes(f.value);
        }
        // v202604.131 — api / text dims accept any value; api dims will get
        // their label backfilled after the values fetch returns.
        return true;
      });

      // v202604.128 / v202604.131 — auto-apply per-device family scope
      // as a person pill, BUT only on modules where person is the primary
      // axis (kids, medical, todos). On modules where person is optional
      // or rarely set (inventory, books, perfume, subscriptions, etc.),
      // auto-applying scope returns mostly-empty lists which surprises the
      // user. Modules opt in via `personPrimary: true` in lens-config.
      try {
        const scope = window.GH_NAV?.getScope?.();
        if (scope && modCfg.personPrimary && modCfg.dimensions.person
            && !filters.some(f => f.dim === 'person')) {
          filters.push({
            dim:   'person',
            verb:  modCfg.dimensions.person.verb,
            value: scope.id,
            label: scope.name,
          });
        }
      } catch(e) {}

      const instance = {
        container,
        moduleId: opts.moduleId,
        modCfg,
        viewToolbar: opts.viewToolbar !== false,  // default on
        views: opts.views || ['grid', 'list', 'card'],
        defaultView: opts.defaultView || 'list',
        sortFields: opts.sortFields || [],
        onChange: opts.onChange || (() => {}),
        state: {
          filters,
          view: localStorage.getItem(`${opts.moduleId}_view`) || opts.defaultView || 'list',
          sort: opts.sortFields && opts.sortFields[0] ? opts.sortFields[0].key : '',
          totalCount: opts.totalCount || 0,
          query: '',
        },
        suggestions: [],
        suggestionIndex: 0,
        family: [],
        tags: [],
        editingPillIndex: null,  // when a pill is clicked to edit
        focused: false,
      };

      this._instance = instance;
      this._render(instance);

      // Lazy-fetch family + tags + any api-dim values, then re-render.
      const apiPromises = [];
      const apiDims = [];
      for (const [dim, dcfg] of Object.entries(modCfg.dimensions)) {
        if (dcfg.type === 'api' && dcfg.source) {
          apiDims.push(dim);
          apiPromises.push(fetchApiValues(dcfg.source));
        }
      }
      Promise.all([fetchFamily(), fetchTags(), ...apiPromises]).then((results) => {
        const fam = results[0];
        const tg  = results[1];
        const apiValues = new Map();
        apiDims.forEach((dim, i) => apiValues.set(dim, results[2 + i] || []));
        instance.family = fam;
        instance.tags = tg;
        instance.apiValues = apiValues;
        instance.suggestions = buildAllSuggestions(instance.modCfg, fam, tg, apiValues);
        // Backfill labels on persisted filters whose value is an id (api/person)
        // so pills don't render with "47" instead of "Living Room".
        for (const f of instance.state.filters) {
          if (f.label && typeof f.label === 'string' && f.label !== String(f.value)) continue;
          const sug = instance.suggestions.find(s => s.dim === f.dim && String(s.value) === String(f.value));
          if (sug) f.label = sug.label;
        }
        // Re-render only if no input is currently focused (avoid disrupting typing)
        const input = container.querySelector('.gh-lens__input');
        if (!input || document.activeElement !== input) {
          this._render(instance);
        }
      });

      // Global / shortcut: focus lens from anywhere on the page
      const slashHandler = (e) => {
        if (e.key !== '/') return;
        // Don't hijack when user is typing in another input
        const tag = (e.target.tagName || '').toLowerCase();
        if (tag === 'input' || tag === 'textarea' || e.target.isContentEditable) return;
        e.preventDefault();
        const input = container.querySelector('.gh-lens__input');
        if (input) input.focus();
      };
      document.addEventListener('keydown', slashHandler);
      instance._slashHandler = slashHandler;

      // Fire onChange once on init so the page renders with the current filters
      this._fireChange(instance);

      return instance;
    },

    _fireChange(instance) {
      try {
        instance.onChange({
          filters: instance.state.filters.slice(),
          view: instance.state.view,
          sort: instance.state.sort,
        });
      } catch (e) {
        console.error('[GH_LENS] onChange threw:', e);
      }
    },

    setCount(n) {
      if (!this._instance) return;
      this._instance.state.totalCount = n;
      const countEl = this._instance.container.querySelector('.gh-lens__count');
      if (countEl) countEl.textContent = String(n);
    },

    getState() {
      if (!this._instance) return null;
      return {
        filters: this._instance.state.filters.slice(),
        view: this._instance.state.view,
        sort: this._instance.state.sort,
      };
    },

    applyFilter(dim, value, label, verb) {
      if (!this._instance) return;
      const inst = this._instance;
      // Replace existing filter on same dim, or add
      const existing = inst.state.filters.findIndex(f => f.dim === dim);
      const filter = { dim, value, label: label || value,
        verb: verb || (inst.modCfg.dimensions[dim] && inst.modCfg.dimensions[dim].verb) || '' };
      if (existing >= 0) inst.state.filters[existing] = filter;
      else inst.state.filters.push(filter);
      saveState({ filters: inst.state.filters });
      this._render(inst);
      this._fireChange(inst);
    },

    clear() {
      if (!this._instance) return;
      const inst = this._instance;
      inst.state.filters = [];
      clearState();
      this._render(inst);
      this._fireChange(inst);
    },

    // ── Rendering ─────────────────────────────────────────────────
    _render(instance) {
      const c = instance.container;
      c.innerHTML = '';
      c.className = 'gh-lens';

      // ── Sentence row ──
      const sentenceRow = el('div', { class: 'gh-lens__sentence' });

      // Module name
      sentenceRow.appendChild(el('span', { class: 'gh-lens__module' }, instance.modCfg.label));

      // Count
      sentenceRow.appendChild(el('span', { class: 'gh-lens__count',
        title: 'Filtered count' }, String(instance.state.totalCount)));

      // Filter pills
      for (let i = 0; i < instance.state.filters.length; i++) {
        const f = instance.state.filters[i];
        sentenceRow.appendChild(el('span', { class: 'gh-lens__verb' }, f.verb || ''));
        const pill = this._renderPill(instance, f, i);
        sentenceRow.appendChild(pill);
      }

      // Input area — the typeable cursor zone
      const inputWrap = el('span', { class: 'gh-lens__input-wrap' });

      const input = el('input', {
        type: 'text',
        class: 'gh-lens__input',
        value: instance.state.query || '',
        placeholder: instance.state.filters.length
          ? 'narrow further…'
          : 'narrow by family member, status, time…',
        onfocus: () => {
          instance.focused = true;
          this._showSuggestions(instance);
        },
        onblur: () => {
          // Defer hide so click on suggestion lands first
          setTimeout(() => {
            instance.focused = false;
            this._hideSuggestions(instance);
          }, 150);
        },
        oninput: (e) => {
          instance.state.query = e.target.value;
          instance.suggestionIndex = 0;
          this._showSuggestions(instance);
        },
        onkeydown: (e) => this._onInputKey(instance, e),
      });
      inputWrap.appendChild(input);

      sentenceRow.appendChild(inputWrap);

      // Reset link (when filters present)
      if (instance.state.filters.length) {
        sentenceRow.appendChild(el('button', {
          class: 'gh-lens__reset',
          title: 'Clear all filters',
          onclick: () => this.clear(),
        }, 'reset'));
      }

      c.appendChild(sentenceRow);

      // ── Toolbar row (views + sort) ──
      if (instance.viewToolbar) {
        const toolbarRow = el('div', { class: 'gh-lens__toolbar' });
        toolbarRow.appendChild(this._renderViewToggle(instance));
        if (instance.sortFields && instance.sortFields.length) {
          toolbarRow.appendChild(this._renderSortButton(instance));
        }
        c.appendChild(toolbarRow);
      }

      // ── Suggestion panel (populated on focus) ──
      const suggBox = el('div', { class: 'gh-lens__suggestions',
        style: { display: 'none' } });
      c.appendChild(suggBox);

      // Re-show suggestions if focused (e.g. after re-render from accepting a pill)
      if (instance.focused) {
        const newInput = c.querySelector('.gh-lens__input');
        if (newInput) {
          newInput.focus();
          // Move cursor to end
          newInput.setSelectionRange(newInput.value.length, newInput.value.length);
        }
        this._showSuggestions(instance);
      }
    },

    _renderPill(instance, filter, index) {
      const dim = filter.dim;
      let avatar = null;
      if (dim === 'person') {
        const fm = instance.family.find(m => String(m.id) === String(filter.value));
        if (fm && fm.avatar_attachment_id) {
          avatar = el('img', {
            class: 'gh-lens__pill-avatar',
            src: `/api/v1/attachments/${fm.avatar_attachment_id}/thumb`,
            alt: '',
          });
        } else if (fm) {
          const initial = (fm.display_name || fm.first_name || '?').slice(0, 1).toUpperCase();
          avatar = el('span', { class: 'gh-lens__pill-avatar gh-lens__pill-avatar--initial' }, initial);
        }
      }
      const pill = el('button', {
        class: 'gh-lens__pill' + (instance.editingPillIndex === index ? ' gh-lens__pill--editing' : ''),
        title: 'Click to change',
        dataset: { pillIndex: String(index) },
        onclick: (e) => {
          e.stopPropagation();
          this._editPill(instance, index);
        },
      }, [
        avatar,
        el('span', { class: 'gh-lens__pill-label' }, filter.label || filter.value),
      ].filter(Boolean));
      return pill;
    },

    _renderViewToggle(instance) {
      const wrap = el('div', { class: 'gh-lens__views' });
      const make = (key, label, svg) => el('button', {
        class: 'gh-lens__view-btn' + (instance.state.view === key ? ' active' : ''),
        title: label,
        onclick: () => {
          instance.state.view = key;
          try { localStorage.setItem(`${instance.moduleId}_view`, key); } catch {}
          this._render(instance);
          this._fireChange(instance);
        },
        html: svg,
      });
      const SVG_GRID = '<svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="1" y="1" width="5" height="5" rx="1"/><rect x="8" y="1" width="5" height="5" rx="1"/><rect x="1" y="8" width="5" height="5" rx="1"/><rect x="8" y="8" width="5" height="5" rx="1"/></svg>';
      const SVG_LIST = '<svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="1" y="1" width="12" height="3" rx="1"/><rect x="1" y="5.5" width="12" height="3" rx="1"/><rect x="1" y="10" width="12" height="3" rx="1"/></svg>';
      const SVG_CARD = '<svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="1" y="2" width="12" height="10" rx="1.5"/><line x1="1" y1="6" x2="13" y2="6"/></svg>';
      const SVG_GALLERY = '<svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="1" y="1" width="8" height="12" rx="1"/><rect x="10" y="1" width="3" height="5.5" rx="1"/><rect x="10" y="7.5" width="3" height="5.5" rx="1"/></svg>';
      if (instance.views.includes('grid'))    wrap.appendChild(make('grid',    'Grid view',    SVG_GRID));
      if (instance.views.includes('list'))    wrap.appendChild(make('list',    'List view',    SVG_LIST));
      if (instance.views.includes('card'))    wrap.appendChild(make('card',    'Card view',    SVG_CARD));
      if (instance.views.includes('gallery')) wrap.appendChild(make('gallery', 'Gallery view', SVG_GALLERY));
      return wrap;
    },

    _renderSortButton(instance) {
      const cur = instance.sortFields.find(f => f.key === instance.state.sort);
      const label = cur ? cur.label : (instance.sortFields[0] && instance.sortFields[0].label);
      return el('button', {
        class: 'gh-lens__sort-btn',
        onclick: (e) => this._openSortMenu(instance, e.currentTarget),
      }, `Sort: ${label || ''}`);
    },

    _openSortMenu(instance, anchor) {
      // Simple inline menu — could be a popup later
      const existing = instance.container.querySelector('.gh-lens__sort-menu');
      if (existing) { existing.remove(); return; }
      const menu = el('div', { class: 'gh-lens__sort-menu' });
      for (const f of instance.sortFields) {
        menu.appendChild(el('button', {
          class: 'gh-lens__sort-item' + (instance.state.sort === f.key ? ' active' : ''),
          onclick: () => {
            instance.state.sort = f.key;
            menu.remove();
            this._render(instance);
            this._fireChange(instance);
          },
        }, f.label));
      }
      // Position relative to anchor
      const r = anchor.getBoundingClientRect();
      const cr = instance.container.getBoundingClientRect();
      menu.style.position = 'absolute';
      menu.style.top = `${r.bottom - cr.top + 6}px`;
      menu.style.right = `${cr.right - r.right}px`;
      menu.style.zIndex = '500';
      instance.container.appendChild(menu);
      // Click outside to close
      const closeFn = (ev) => {
        if (!menu.contains(ev.target) && ev.target !== anchor) {
          menu.remove();
          document.removeEventListener('click', closeFn);
        }
      };
      setTimeout(() => document.addEventListener('click', closeFn), 0);
    },

    // ── Suggestions panel ─────────────────────────────────────────
    _showSuggestions(instance) {
      const box = instance.container.querySelector('.gh-lens__suggestions');
      if (!box) return;
      const matched = instance.editingPillIndex != null
        // When editing a pill, restrict suggestions to that dimension
        ? instance.suggestions.filter(s => s.dim === instance.state.filters[instance.editingPillIndex].dim)
        : instance.suggestions;

      const filtered = fuzzyMatch(instance.state.query, matched);

      // v202604.131 — text-dim "use this as a filter" entries.
      // For every text-type dim in this module, if the user has typed
      // anything, offer a synthetic suggestion to apply that text as
      // the filter value for that dim.
      const textDims = [];
      const editingDim = instance.editingPillIndex != null
        ? instance.state.filters[instance.editingPillIndex].dim
        : null;
      for (const [dim, dcfg] of Object.entries(instance.modCfg.dimensions)) {
        if (dcfg.type !== 'text') continue;
        if (editingDim && editingDim !== dim) continue;
        if (instance.state.query) {
          textDims.push({
            dim, verb: dcfg.verb,
            value: instance.state.query,
            label: instance.state.query,
            _isText: true,
          });
        }
      }

      box.innerHTML = '';
      box.style.display = 'block';

      if (!filtered.length && !textDims.length) {
        box.appendChild(el('div', { class: 'gh-lens__sugg-empty' }, 'No matches'));
        if (instance.editingPillIndex != null) {
          box.appendChild(el('button', {
            class: 'gh-lens__sugg-remove',
            onclick: () => this._removePill(instance, instance.editingPillIndex),
          }, 'Remove this filter'));
        }
        return;
      }

      // Header
      box.appendChild(el('div', { class: 'gh-lens__sugg-head' },
        instance.state.query ? `Matches "${instance.state.query}"` : 'Suggestions'));

      // Items — preset suggestions first, then text-dim "use as" entries
      const allItems = [...filtered.slice(0, 8), ...textDims];
      for (let i = 0; i < allItems.length; i++) {
        const s = allItems[i];
        const item = el('button', {
          class: 'gh-lens__sugg-item' + (i === instance.suggestionIndex ? ' active' : ''),
          onmousedown: (e) => {
            // mousedown so it fires before input blur
            e.preventDefault();
            this._acceptSuggestion(instance, s);
          },
        }, [
          el('span', { class: 'gh-lens__sugg-verb' }, s.verb),
          el('span', { class: 'gh-lens__sugg-label' },
            s._isText ? `"${s.label}"` : s.label),
          el('span', { class: 'gh-lens__sugg-dim' }, s.dim),
        ]);
        box.appendChild(item);
      }

      // Edit-mode footer: option to remove the filter
      if (instance.editingPillIndex != null) {
        box.appendChild(el('div', { class: 'gh-lens__sugg-sep' }));
        box.appendChild(el('button', {
          class: 'gh-lens__sugg-remove',
          onmousedown: (e) => {
            e.preventDefault();
            this._removePill(instance, instance.editingPillIndex);
          },
        }, 'Remove this filter'));
      }
    },

    _hideSuggestions(instance) {
      const box = instance.container.querySelector('.gh-lens__suggestions');
      if (box) box.style.display = 'none';
      instance.editingPillIndex = null;
    },

    _onInputKey(instance, e) {
      const box = instance.container.querySelector('.gh-lens__suggestions');
      const visible = box && box.style.display !== 'none';
      const items = box ? box.querySelectorAll('.gh-lens__sugg-item') : [];
      if (e.key === 'ArrowDown' && visible) {
        e.preventDefault();
        instance.suggestionIndex = Math.min(items.length - 1, instance.suggestionIndex + 1);
        items.forEach((it, i) => it.classList.toggle('active', i === instance.suggestionIndex));
      } else if (e.key === 'ArrowUp' && visible) {
        e.preventDefault();
        instance.suggestionIndex = Math.max(0, instance.suggestionIndex - 1);
        items.forEach((it, i) => it.classList.toggle('active', i === instance.suggestionIndex));
      } else if (e.key === 'Enter' && visible) {
        e.preventDefault();
        const active = items[instance.suggestionIndex];
        if (active) active.dispatchEvent(new MouseEvent('mousedown'));
      } else if (e.key === 'Escape') {
        e.preventDefault();
        instance.editingPillIndex = null;
        e.target.blur();
      } else if (e.key === 'Backspace' && !instance.state.query
                 && instance.state.filters.length && instance.editingPillIndex == null) {
        // Backspace on empty input → eat last pill
        e.preventDefault();
        instance.state.filters.pop();
        saveState({ filters: instance.state.filters });
        this._render(instance);
        this._fireChange(instance);
      }
    },

    _acceptSuggestion(instance, s) {
      const newFilter = { dim: s.dim, verb: s.verb, value: s.value, label: s.label };
      if (instance.editingPillIndex != null) {
        // Replacing an existing pill
        instance.state.filters[instance.editingPillIndex] = newFilter;
        instance.editingPillIndex = null;
      } else {
        // Adding new — but if same dim already exists, replace
        const idx = instance.state.filters.findIndex(f => f.dim === s.dim);
        if (idx >= 0) instance.state.filters[idx] = newFilter;
        else instance.state.filters.push(newFilter);
      }
      instance.state.query = '';
      saveState({ filters: instance.state.filters });
      this._render(instance);
      this._fireChange(instance);
      // Refocus input for chained filtering
      setTimeout(() => {
        const newInput = instance.container.querySelector('.gh-lens__input');
        if (newInput) newInput.focus();
      }, 0);
    },

    _editPill(instance, index) {
      instance.editingPillIndex = index;
      instance.state.query = '';
      this._render(instance);
      // Force-show suggestions for that dim
      setTimeout(() => {
        const newInput = instance.container.querySelector('.gh-lens__input');
        if (newInput) {
          newInput.focus();
          this._showSuggestions(instance);
        }
      }, 0);
    },

    _removePill(instance, index) {
      instance.state.filters.splice(index, 1);
      instance.editingPillIndex = null;
      saveState({ filters: instance.state.filters });
      this._render(instance);
      this._fireChange(instance);
    },
  };

  window.GH_LENS = GH_LENS;
})();
