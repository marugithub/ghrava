/**
 * gh-card-mount.js — One-call helper for rendering cards into a container.
 *
 * Pages call this from their existing render function when the GH_VIEW
 * toggle is set to 'card'. Replaces ~12 lines of boilerplate per page:
 *
 *   if (state.view === 'card') {
 *     GH_MOUNT.intoContainer({
 *       containerId: 'subList', moduleId: 'subscriptions',
 *       records, fieldMap, derive, onClick, onEmpty,
 *     });
 *     return;
 *   }
 *
 * The helper:
 *   - Verifies GH_CARD is loaded (warns + bails if not).
 *   - Lazily fetches /settings/family on first card render and caches it
 *     on window.familyMembers, so cards can show owner avatars without
 *     each page having to wire a family-data fetch.
 *   - Applies fieldMap and derive to normalize record shape.
 *   - Mounts the rendered DOM into containerId, replacing whatever was there.
 *
 * Spec: CARDS_FINAL.md
 */
(function() {
  'use strict';

  let _familyFetchPromise = null;

  function ensureFamilyMembers() {
    // If page has already populated window.familyMembers (e.g. wardrobe
    // mirrored its local cache before the mount call), skip the fetch.
    if (Array.isArray(window.familyMembers) && window.familyMembers.length) return Promise.resolve();
    // If LT.data has a populated cache, mirror it.
    if (window.LT && window.LT.data && Array.isArray(window.LT.data.familyMembers)
        && window.LT.data.familyMembers.length) {
      window.familyMembers = window.LT.data.familyMembers;
      return Promise.resolve();
    }
    if (_familyFetchPromise) return _familyFetchPromise;
    if (!window.api) return Promise.resolve();  // no API helper available
    _familyFetchPromise = window.api('GET', '/settings/family')
      .then(rows => { if (Array.isArray(rows)) window.familyMembers = rows; })
      .catch(e => { console.warn('[GH_MOUNT] family fetch failed:', e && e.message); });
    return _familyFetchPromise;
  }

  function applyFieldMap(record, map) {
    if (!map) return record;
    const out = { ...record };
    for (const [target, source] of Object.entries(map)) {
      if (out[target] == null && record[source] != null) {
        out[target] = record[source];
      }
    }
    return out;
  }

  function applyDerive(record, derive) {
    if (!derive) return record;
    try {
      const computed = derive(record) || {};
      return { ...record, ...computed };
    } catch (e) {
      console.warn('[GH_MOUNT] derive() threw:', e);
      return record;
    }
  }

  // Internal — actual mount, separated so we can run the family-fetch
  // first when needed.
  function _doMount(opts) {
    if (!window.GH_CARD) {
      console.warn(`[GH_MOUNT] GH_CARD not loaded; cannot mount ${opts.moduleId}`);
      return false;
    }

    const container = document.getElementById(opts.containerId);
    if (!container) {
      console.warn(`[GH_MOUNT] container #${opts.containerId} not found`);
      return false;
    }

    let records = Array.isArray(opts.records) ? opts.records : [];
    if (opts.fieldMap || opts.derive) {
      records = records.map(r => {
        let normalized = applyFieldMap(r, opts.fieldMap);
        normalized = applyDerive(normalized, opts.derive);
        return normalized;
      });
    }

    // Per-mount overrides (e.g. page-specific drawer functions).
    const overrides = {};
    if (opts.onClick) overrides.onClick = opts.onClick;

    if (!records.length) {
      const emptyHtml = opts.onEmpty ? opts.onEmpty() : '<div style="text-align:center;padding:32px;color:var(--text3,#94a3b8)">Nothing to show</div>';
      container.innerHTML = emptyHtml;
      return true;
    }

    container.innerHTML = '';
    // Reset className + inline grid styles set by the legacy grid/list path.
    // Pages share the same container element across views, and leftover
    // `grid.className = 'wrd-list-grid'` or `gridTemplateColumns: repeat(N,1fr)`
    // would conflict with .gh-card-grid's own auto-fill rules.
    container.className = '';
    container.style.gridTemplateColumns = '';
    container.style.padding = container.style.padding || '16px';

    const layout = opts.layout || 'grid';
    const node = window.GH_CARD.renderGrouped(opts.moduleId, records, { layout, overrides });
    container.appendChild(node);
    return true;
  }

  /**
   * Render cards into a container. Returns true on success, false if
   * GH_CARD or container is missing.
   *
   * Synchronous from the page's perspective — the family-data fetch runs
   * in the background. If it lands BEFORE render returns (cached), avatars
   * appear immediately. If it lands AFTER, we re-render once with the
   * fresh family data so avatars fill in. No cards-without-avatars flicker
   * for second + subsequent loads in the same session.
   */
  function intoContainer(opts) {
    const familyReady = (Array.isArray(window.familyMembers) && window.familyMembers.length)
                     || (window.LT && window.LT.data && window.LT.data.loaded);

    // Always render now so the user sees content immediately.
    const ok = _doMount(opts);
    if (!ok) return false;

    // If family data wasn't available, fetch + re-render once it lands.
    // Skip on subsequent calls — re-renders happen naturally on page reload.
    if (!familyReady) {
      ensureFamilyMembers().then(() => {
        // Only re-render if family data actually arrived.
        if (Array.isArray(window.familyMembers) && window.familyMembers.length) {
          _doMount(opts);
        }
      });
    }

    return true;
  }

  window.GH_MOUNT = { intoContainer };
})();
