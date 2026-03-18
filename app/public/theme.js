/**
 * theme.js — Ghrava theme system
 * Themes: pure-light-teal (default), pure-light-indigo, dark
 */
(function () {
  'use strict';

  const THEMES = {
    'pure-light-teal': {
      label: 'Pure Light — Teal',
      desc:  'Clean light · teal accent',
      dark:  false,
      metaColor: '#f0f4f8',
    },
    'pure-light-indigo': {
      label: 'Pure Light — Indigo Blue',
      desc:  'Clean light · indigo accent',
      dark:  false,
      metaColor: '#f0f4f8',
    },
    'dark': {
      label: 'Dark',
      desc:  'Deep navy · electric blue',
      dark:  true,
      metaColor: '#080c14',
    },
  };

  const DEFAULT_THEME = 'pure-light-teal';
  const STORAGE_KEY   = 'lt_theme';

  function applyTheme(id) {
    const safe = THEMES[id] ? id : DEFAULT_THEME;
    document.documentElement.setAttribute('data-theme', safe);
    const metaTheme = document.querySelector('meta[name="theme-color"]');
    if (metaTheme) metaTheme.content = THEMES[safe].metaColor;
    localStorage.setItem(STORAGE_KEY, safe);
    document.documentElement.classList.toggle('theme-dark',  !!THEMES[safe].dark);
    document.documentElement.classList.toggle('theme-light', !THEMES[safe].dark);
    return safe;
  }

  // Apply instantly — no flash
  const stored = localStorage.getItem(STORAGE_KEY) || DEFAULT_THEME;
  applyTheme(stored);

  function syncFromServer() {
    const token = localStorage.getItem('lt_token');
    if (!token) return;
    fetch('/api/v1/settings/config', { headers: { 'Authorization': 'Bearer '+token } })
      .then(r => r.ok ? r.json() : null)
      .then(cfg => {
        if (cfg && cfg.ui_theme && THEMES[cfg.ui_theme] &&
            cfg.ui_theme !== localStorage.getItem(STORAGE_KEY)) {
          applyTheme(cfg.ui_theme);
        }
      }).catch(() => {});
  }

  function saveToServer(themeId) {
    const token = localStorage.getItem('lt_token');
    if (!token) return;
    fetch('/api/v1/settings/config/ui_theme', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer '+token },
      body: JSON.stringify({ value: themeId }),
    }).catch(() => {});
  }

  window.LTTheme = {
    themes: THEMES,
    current() { return document.documentElement.getAttribute('data-theme') || DEFAULT_THEME; },
    set(id) { const a = applyTheme(id); saveToServer(a); return a; },
    isDark() { return !!THEMES[this.current()]?.dark; },
    syncFromServer,
    switcherHTML() {
      const cur = this.current();
      const dotColor = { 'pure-light-teal':'#4bb9ae', 'pure-light-indigo':'#4f46e5', 'dark':'#5c72fa' };
      return Object.entries(THEMES).map(([id, t]) =>
        `<button class="theme-opt-btn${id===cur?' active':''}" onclick="LTTheme.set('${id}');document.querySelectorAll('.theme-opt-btn').forEach(b=>b.classList.remove('active'));this.classList.add('active')">
          <span style="width:10px;height:10px;border-radius:50%;background:${dotColor[id]||'#888'};flex-shrink:0;display:inline-block"></span>
          ${t.label}
        </button>`
      ).join('');
    },
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', syncFromServer);
  } else { syncFromServer(); }
})();
