/**
 * gh-report-states.js — Empty + error + "Coming soon" states for Reports (v.197)
 *
 * Three small helpers consumed by /reports.html and v.198+ viewer pages.
 *
 *   GH_REPORT_STATES.empty(container, { title, subtitle, actions })
 *     "No matches for these filters" with optional recovery actions
 *
 *   GH_REPORT_STATES.error(container, { title, subtitle, retry, reportIssue })
 *     "Couldn't load this report" with Try Again + Report Issue
 *
 *   GH_REPORT_STATES.comingSoon(slug?)
 *     Top-of-viewport toast for non-functional tiles in v.197.
 *     Shown when a user clicks a tile whose viewer page isn't wired yet.
 */
(function() {
  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function empty(container, opts) {
    if (!container) return;
    const { title, subtitle, actions = [] } = opts || {};
    container.innerHTML = ''
      + '<div style="background:var(--bg2);border:1px solid var(--border);border-radius:8px;'
      +   'padding:32px 16px;text-align:center">'
      +   '<div style="font-size:32px;opacity:.5;margin-bottom:10px">🔍</div>'
      +   '<div style="font-size:14px;color:var(--text);margin-bottom:4px">'
      +     esc(title || 'No matches for these filters') + '</div>'
      +   '<div style="font-size:12px;color:var(--text3);margin-bottom:12px">'
      +     esc(subtitle || '') + '</div>'
      +   '<div style="display:flex;gap:6px;justify-content:center;flex-wrap:wrap" data-ghrs-actions></div>'
      + '</div>';
    const actBox = container.querySelector('[data-ghrs-actions]');
    for (const a of actions) {
      const b = document.createElement('button');
      b.textContent = a.label || '';
      b.style.cssText = 'font-size:11px;padding:5px 10px;background:var(--bg2);'
        + 'border:0.5px solid var(--border);border-radius:8px;color:var(--accent);cursor:pointer;font-family:inherit';
      b.onclick = a.onClick;
      actBox.appendChild(b);
    }
  }

  function error(container, opts) {
    if (!container) return;
    const { title, subtitle, retry, reportIssue } = opts || {};
    container.innerHTML = ''
      + '<div style="background:var(--bg2);border:1px solid var(--border);border-radius:8px;'
      +   'padding:32px 16px;text-align:center">'
      +   '<div style="font-size:32px;opacity:.7;margin-bottom:10px;color:var(--red,#dc2626)">⚠</div>'
      +   '<div style="font-size:14px;color:var(--text);margin-bottom:4px">'
      +     esc(title || "Couldn't load this report") + '</div>'
      +   '<div style="font-size:12px;color:var(--text3);margin-bottom:12px">'
      +     esc(subtitle || '') + '</div>'
      +   '<div style="display:flex;gap:6px;justify-content:center" data-ghrs-err-actions></div>'
      + '</div>';
    const actBox = container.querySelector('[data-ghrs-err-actions]');
    if (retry) {
      const b = document.createElement('button');
      b.textContent = '↻ Try again';
      b.style.cssText = 'font-size:11px;padding:5px 10px;background:var(--bg2);'
        + 'border:0.5px solid var(--border);border-radius:8px;color:var(--accent);cursor:pointer;font-family:inherit';
      b.onclick = retry;
      actBox.appendChild(b);
    }
    if (reportIssue) {
      const b = document.createElement('button');
      b.textContent = 'Report issue';
      b.style.cssText = 'font-size:11px;padding:5px 10px;background:var(--bg2);'
        + 'border:0.5px solid var(--border);border-radius:8px;color:var(--red,#dc2626);cursor:pointer;font-family:inherit';
      b.onclick = reportIssue;
      actBox.appendChild(b);
    }
  }

  // Toast at top of viewport. Auto-dismisses after 2.4s.
  function comingSoon(slug) {
    const t = document.createElement('div');
    t.textContent = '🚧 Coming soon — this report ships in a future drop' + (slug ? ' (' + slug + ')' : '') + '.';
    t.style.cssText = ''
      + 'position:fixed;top:16px;left:50%;transform:translateX(-50%);'
      + 'background:var(--bg2);border:1px solid var(--border);border-radius:8px;padding:10px 16px;'
      + 'font-size:13px;color:var(--text);box-shadow:0 4px 12px rgba(0,0,0,.15);'
      + 'z-index:2000;opacity:0;transition:opacity .2s;font-family:inherit;'
      + 'max-width:90vw;text-align:center';
    document.body.appendChild(t);
    requestAnimationFrame(() => { t.style.opacity = '1'; });
    setTimeout(() => {
      t.style.opacity = '0';
      setTimeout(() => t.remove(), 300);
    }, 2400);
  }

  window.GH_REPORT_STATES = { empty, error, comingSoon };
})();
