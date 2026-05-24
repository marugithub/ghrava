/**
 * gh-tile.js — Small shortcut tile for Reports landing tabs (v.197)
 *
 * Used on /reports.html to render each report's entry point in the
 * tile grid per the locked Variant A grouping design (tiny lowercase
 * eyebrows above tile rows, no other chrome). Each tile is a "menu
 * entry" pointing at its viewer page; the viewer pages themselves
 * live elsewhere (built in v.198+).
 *
 * Usage:
 *   GH_TILE.render({
 *     container,                  // DOM element to append into
 *     slug,                       // report slug (data-slug + pinned-tracking key)
 *     title,                      // short title — e.g. "Spending by category"
 *     meta,                       // one-line metadata — e.g. "last run today"
 *     icon,                       // single emoji — e.g. "💰"
 *     eyebrow,                    // short uppercase chip — e.g. "MONEY · TAX"
 *     color,                      // accent colour for icon/eyebrow row
 *     onClick                     // function(slug) — fires on tile click
 *   })
 *
 * Returns the DOM element it created so callers can re-find it
 * for later updates (e.g. pinned-state highlight).
 */
(function() {
  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function render({ container, slug, title, meta, icon, eyebrow, color, onClick }) {
    if (!container) return null;
    const tile = document.createElement('div');
    tile.className = 'gh-tile';
    tile.dataset.slug = slug || '';
    tile.style.cssText = [
      'background: var(--bg2)',
      'border: 0.5px solid var(--border)',
      'border-radius: var(--r-lg, 12px)',
      'padding: 12px',
      'cursor: pointer',
      'transition: border-color .12s ease, transform .12s ease',
      'min-height: 78px',
      'display: flex',
      'flex-direction: column',
      'gap: 4px',
    ].join(';');
    const accent = color || 'var(--text3)';
    tile.innerHTML = ''
      + '<div style="display:flex;align-items:center;gap:6px;margin-bottom:4px">'
      +   '<span style="font-size:14px">' + esc(icon || '📊') + '</span>'
      +   '<span style="font-size:11px;color:' + accent + ';text-transform:uppercase;letter-spacing:.04em;font-weight:500">'
      +     esc(eyebrow || '') + '</span>'
      + '</div>'
      + '<div style="font-size:13px;font-weight:500;color:var(--text);line-height:1.3">'
      +   esc(title || '') + '</div>'
      + '<div style="font-size:11px;color:var(--text3);margin-top:auto">'
      +   esc(meta || '') + '</div>';
    tile.addEventListener('click', () => onClick && onClick(slug));
    tile.addEventListener('mouseenter', () => {
      tile.style.borderColor = color || 'var(--accent)';
      tile.style.transform = 'translateY(-1px)';
    });
    tile.addEventListener('mouseleave', () => {
      tile.style.borderColor = '';
      tile.style.transform = '';
    });
    // Keyboard activation for accessibility
    tile.tabIndex = 0;
    tile.setAttribute('role', 'button');
    tile.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick && onClick(slug); }
    });
    container.appendChild(tile);
    return tile;
  }

  window.GH_TILE = { render };
})();
