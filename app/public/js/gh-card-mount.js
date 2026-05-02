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
 *   - Applies fieldMap and derive to normalize record shape into what the
 *     module's config expects.
 *   - Mounts the rendered DOM into containerId, replacing whatever was there.
 *   - Returns true on success, false if GH_CARD missing or container missing.
 *
 * No longer gated by ?cards=v2 — that was a rollout artifact. Cards are now
 * one of three views (list/grid/card) chosen by the user via GH_VIEW toolbar.
 *
 * Spec: CARDS_FINAL.md
 */
(function() {
  'use strict';

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
   * Render cards into a container. Safe to call repeatedly (replaces
   * container contents each time). Returns false if GH_CARD library or
   * container DOM element is missing.
   */
  function intoContainer(opts) {
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

  window.GH_MOUNT = { intoContainer };
})();
