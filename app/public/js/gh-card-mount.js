/**
 * gh-card-mount.js — One-call opt-in for module pages.
 *
 * Pages that want to use cards add ONE line:
 *
 *   GH_MOUNT.intoContainer({
 *     containerId: 'subList',
 *     moduleId:    'subscriptions',
 *     records:     rowsFromApi,
 *     fieldMap:    { cost: 'price' },          // optional renaming
 *     derive:      (r) => ({ ytd: r.cost*12 }),// optional computed fields
 *     onEmpty:     () => '<div>No subs</div>', // optional empty state HTML
 *     layout:      'grid',                     // 'grid' (default) | 'list'
 *   });
 *
 * The helper:
 *   - Returns immediately (does nothing) if `?cards=v2` query param isn't set,
 *     so the legacy render path stays the default until a page is flipped.
 *   - Verifies GH_CARD is loaded (warns + bails if not).
 *   - Applies fieldMap and derive to normalize record shape into what the
 *     module's config expects. This is the bridge between an existing page's
 *     API response shape and the card config's field expectations.
 *   - Mounts the rendered DOM into containerId, replacing whatever was there.
 *
 * Why this matters: previously each page had to repeat the same ~12 lines
 * of (param check + GH_CARD existence check + render call + mount). Pages
 * call this once and we keep the "how to wire cards" knowledge in one place.
 *
 * Spec: CARDS_FINAL.md
 */
(function() {
  'use strict';

  function v2Active() {
    try {
      return new URL(location.href).searchParams.get('cards') === 'v2';
    } catch { return false; }
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

  /**
   * Wire one container to the card renderer. Safe to call even when v2 is
   * off — silently returns. Safe to call repeatedly (replaces container
   * contents each time).
   */
  function intoContainer(opts) {
    if (!v2Active()) return false;
    if (!window.GH_CARD) {
      console.warn(`[GH_MOUNT] cards=v2 set but GH_CARD not loaded for ${opts.moduleId}`);
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

    // Per-mount overrides (e.g. page-specific drawer functions). Threaded
    // through render() without mutating the registered config — pages that
    // mount different modules with different drawer functions don't stomp
    // each other.
    const overrides = {};
    if (opts.onClick) overrides.onClick = opts.onClick;

    if (!records.length) {
      const emptyHtml = opts.onEmpty ? opts.onEmpty() : '<div style="text-align:center;padding:32px;color:var(--text3,#94a3b8)">Nothing to show</div>';
      container.innerHTML = emptyHtml;
      return true;
    }

    container.innerHTML = '';
    container.style.padding = container.style.padding || '16px';

    const layout = opts.layout || 'grid';
    const node = window.GH_CARD.renderGrouped(opts.moduleId, records, { layout, overrides });
    container.appendChild(node);
    return true;
  }

  /**
   * Test helper: returns true if v2 is currently active. Pages that need to
   * skip their legacy render path entirely when v2 is on can branch on this.
   */
  function isV2() { return v2Active(); }

  window.GH_MOUNT = { intoContainer, isV2 };

  if (v2Active()) console.log('[GH_MOUNT] cards=v2 active — pages will use GH_CARD pipeline if wired');
})();
