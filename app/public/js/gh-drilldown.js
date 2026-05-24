/**
 * gh-drilldown.js — Slideout/overlay for record drill-down (v.197)
 *
 * Desktop: right-side slideout (400px wide).
 * Mobile (<640px): full-screen overlay (per locked mobile M4 — same
 * component, viewport-aware via CSS @media).
 *
 * Built minimally here for v.197 — Reports landing has no drill-down
 * yet. v.198+ (Money tab live wirings) consume this for clicking
 * into transaction / medication / vendor detail rows.
 *
 * Usage:
 *   GH_DRILLDOWN.open({
 *     title,                      // breadcrumb label — e.g. "Lisinopril"
 *     html,                       // raw HTML to inject into the body
 *     onClose,                    // optional fn called after close
 *   })
 *   GH_DRILLDOWN.close()          // close + clear callback
 *
 * Future extension (v.198+): back-stack for drill-into-drill, mounting
 * the source module's existing detail partial instead of caller-supplied
 * HTML so the drill-down content stays in sync with the canonical page.
 */
(function() {
  let panel = null;
  let onCloseCallback = null;

  function ensurePanel() {
    if (panel) return panel;
    panel = document.createElement('div');
    panel.id = 'gh-drilldown';
    document.body.appendChild(panel);
    const style = document.createElement('style');
    style.textContent = ''
      + '#gh-drilldown { position: fixed; right: -440px; top: 0; width: 400px; max-width: 90vw;'
      +   ' height: 100vh; background: var(--bg2); border-left: 1px solid var(--border);'
      +   ' transition: right .25s ease-out; z-index: 1000; overflow-y: auto;'
      +   ' box-shadow: -4px 0 20px rgba(0,0,0,.15); }'
      + '#gh-drilldown.open { right: 0; }'
      + '#gh-drilldown .ghd-head { padding: 12px 16px; border-bottom: 1px solid var(--border);'
      +   ' display: flex; align-items: center; gap: 8px; position: sticky; top: 0;'
      +   ' background: var(--bg2); z-index: 1; }'
      + '#gh-drilldown .ghd-back { background: var(--bg3); border: 1px solid var(--border);'
      +   ' padding: 4px 10px; border-radius: 6px; cursor: pointer; font-size: 11px;'
      +   ' color: var(--text2); font-family: inherit; }'
      + '#gh-drilldown .ghd-title { flex: 1; font-size: 14px; font-weight: 600; color: var(--text);'
      +   ' overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }'
      + '#gh-drilldown .ghd-close { background: none; border: none; cursor: pointer;'
      +   ' color: var(--text2); font-size: 18px; padding: 2px 8px; line-height: 1; }'
      + '#gh-drilldown .ghd-body { padding: 14px 16px; }'
      // Mobile M4 — full-screen overlay instead of slideout (no horizontal room on phones)
      + '@media (max-width: 640px) {'
      +   ' #gh-drilldown { width: 100vw; max-width: 100vw; right: -100vw;'
      +     ' box-shadow: none; border-left: none; }'
      +   ' #gh-drilldown.open { right: 0; }'
      + ' }';
    document.head.appendChild(style);
    return panel;
  }

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function open(opts) {
    const { title, html, onClose } = opts || {};
    const p = ensurePanel();
    onCloseCallback = onClose || null;
    p.innerHTML = ''
      + '<div class="ghd-head">'
      +   '<button class="ghd-back" onclick="GH_DRILLDOWN.close()">← Back</button>'
      +   '<span class="ghd-title">' + esc(title || '') + '</span>'
      +   '<button class="ghd-close" onclick="GH_DRILLDOWN.close()">✕</button>'
      + '</div>'
      + '<div class="ghd-body">' + (html || '') + '</div>';
    // Force layout flush then add .open so CSS transition fires
    requestAnimationFrame(() => p.classList.add('open'));
  }

  function close() {
    if (!panel) return;
    panel.classList.remove('open');
    if (onCloseCallback) {
      try { onCloseCallback(); } catch (e) { /* swallow */ }
      onCloseCallback = null;
    }
  }

  // Escape key closes when open.
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && panel && panel.classList.contains('open')) close();
  });

  window.GH_DRILLDOWN = { open, close };
})();
