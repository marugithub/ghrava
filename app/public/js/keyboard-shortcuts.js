/**
 * public/js/keyboard-shortcuts.js
 * Global keyboard shortcuts with ? cheat sheet modal.
 * Loaded on all pages via nav.js or individual pages.
 */
(function() {
  'use strict';

  const SHORTCUTS = [
    { key: 'k',      ctrl: true,  label: 'Global Search',     action: 'globalSearch',  cat: 'Navigation' },
    { key: 'h',      ctrl: true,  label: 'Go Home',           action: 'goHome',        cat: 'Navigation' },
    { key: 't',      ctrl: true,  label: 'Todos',             action: 'goTodos',       cat: 'Navigation' },
    { key: 'i',      ctrl: true,  label: 'Inventory',         action: 'goInventory',   cat: 'Navigation' },
    { key: 'd',      ctrl: true,  label: 'Daily Log',         action: 'goDailyLog',    cat: 'Navigation' },
    { key: 'f',      ctrl: true,  label: 'Finance',           action: 'goFinance',     cat: 'Navigation' },
    { key: 'm',      ctrl: true,  label: 'Medical',           action: 'goMedical',     cat: 'Navigation' },
    { key: 's',      ctrl: true,  label: 'Settings',          action: 'goSettings',    cat: 'Navigation' },
    { key: '/',      ctrl: false, label: 'Focus Search',      action: 'focusSearch',   cat: 'Page' },
    { key: 'Escape', ctrl: false, label: 'Close Modal',       action: 'closeModal',    cat: 'General' },
    { key: '?',      ctrl: false, shift: true, label: 'Keyboard Shortcuts', action: 'showShortcuts', cat: 'Help' },
  ];

  const ACTIONS = {
    globalSearch:  () => { if (window.GH_Search) GH_Search.open(); },
    goHome:        () => { window.location.href = '/'; },
    goTodos:       () => { window.location.href = '/todos.html'; },
    goInventory:   () => { window.location.href = '/inventory.html'; },
    goDailyLog:    () => { window.location.href = '/daily-log.html'; },
    goFinance:     () => { window.location.href = '/finance.html'; },
    goMedical:     () => { window.location.href = '/medical.html'; },
    goSettings:    () => { window.location.href = '/settings.html'; },
    focusSearch:   () => {
      // After per-module search bars were removed, the / shortcut opens the
      // unified search modal pre-scoped to the current page (if any).
      if (window.GH_NAV && typeof GH_NAV.toggleSearch === 'function') {
        GH_NAV.toggleSearch();
      } else if (window.GH_Search) {
        GH_Search.open();
      }
    },
    closeModal:    () => {
      const open = document.querySelector('.drawer-overlay.open,.modal-overlay.open');
      if (open) open.classList.remove('open');
      if (window.GH_Search) GH_Search.close();
    },
    showShortcuts: () => showCheatSheet(),
  };

  document.addEventListener('keydown', (e) => {
    // Skip when typing — allow Escape and Ctrl+K through
    const inInput = e.target.matches('input,textarea,select,[contenteditable]');
    if (inInput && e.key !== 'Escape' && !(e.ctrlKey && e.key === 'k')) return;

    const sc = SHORTCUTS.find(s =>
      s.key === e.key &&
      !!s.ctrl  === (e.ctrlKey  || e.metaKey) &&
      !!s.shift === e.shiftKey
    );
    if (sc) { e.preventDefault(); ACTIONS[sc.action]?.(); }
  });

  // ── Cheat sheet modal ────────────────────────────────────────
  let _modal = null;

  function buildModal() {
    if (_modal) return;
    _modal = document.createElement('div');
    _modal.style.cssText = 'position:fixed;inset:0;z-index:10000;background:rgba(0,0,0,.55);display:flex;align-items:center;justify-content:center;padding:20px;display:none';
    _modal.innerHTML = `
      <div style="width:min(500px,100%);background:var(--bg2);border:1px solid var(--border2);border-radius:var(--r-xl,12px);overflow:hidden;box-shadow:0 20px 40px rgba(0,0,0,.3)">
        <div style="display:flex;align-items:center;justify-content:space-between;padding:16px 20px;border-bottom:1px solid var(--border)">
          <span style="font-size:16px;font-weight:700;color:var(--text)">⌨️ Keyboard Shortcuts</span>
          <button onclick="window._ghShortcutsClose()" style="background:none;border:none;color:var(--text3);font-size:20px;cursor:pointer;line-height:1">✕</button>
        </div>
        <div style="padding:16px 20px;max-height:60vh;overflow-y:auto">
          ${renderGroups()}
        </div>
        <div style="padding:12px 20px;border-top:1px solid var(--border);font-size:12px;color:var(--text3);display:flex;justify-content:space-between">
          <span>Press <kbd style="background:var(--bg3);border:1px solid var(--border2);border-radius:4px;padding:2px 6px;font-family:monospace">?</kbd> to show this</span>
          <span><kbd style="background:var(--bg3);border:1px solid var(--border2);border-radius:4px;padding:2px 6px;font-family:monospace">Esc</kbd> to close</span>
        </div>
      </div>`;
    _modal.addEventListener('click', (e) => { if (e.target === _modal) closeCheatSheet(); });
    document.body.appendChild(_modal);
  }

  function renderGroups() {
    const cats = {};
    SHORTCUTS.forEach(s => { if (!cats[s.cat]) cats[s.cat] = []; cats[s.cat].push(s); });
    return Object.entries(cats).map(([cat, shortcuts]) => `
      <div style="margin-bottom:16px">
        <div style="font-family:monospace;font-size:10px;text-transform:uppercase;letter-spacing:.06em;color:var(--text3);margin-bottom:8px">${cat}</div>
        ${shortcuts.map(s => `
          <div style="display:flex;align-items:center;justify-content:space-between;padding:6px 0;border-bottom:1px solid var(--border)">
            <span style="font-size:13px;color:var(--text2)">${s.label}</span>
            <span style="display:flex;gap:3px">
              ${s.ctrl  ? '<kbd style="background:var(--bg3);border:1px solid var(--border2);border-radius:4px;padding:2px 6px;font-family:monospace;font-size:11px">⌘</kbd>' : ''}
              ${s.shift ? '<kbd style="background:var(--bg3);border:1px solid var(--border2);border-radius:4px;padding:2px 6px;font-family:monospace;font-size:11px">⇧</kbd>' : ''}
              <kbd style="background:var(--bg3);border:1px solid var(--border2);border-radius:4px;padding:2px 6px;font-family:monospace;font-size:11px">${s.key === 'Escape' ? 'Esc' : s.key}</kbd>
            </span>
          </div>`).join('')}
      </div>`).join('');
  }

  function showCheatSheet() {
    buildModal();
    _modal.style.display = 'flex';
  }
  function closeCheatSheet() {
    if (_modal) _modal.style.display = 'none';
  }

  window.showShortcuts    = showCheatSheet;
  window._ghShortcutsClose = closeCheatSheet;
})();
