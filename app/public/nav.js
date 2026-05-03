/**
 * nav.js — Ghrava navigation
 * Builds: left sidebar (collapsible to icon-only), shared sticky page header
 */
(function() {

  // Ensure the unified search modal script is loaded on every page that
  // includes nav.js. Pages used to need to <script src="...global-search.js">
  // individually; centralizing it here means the nav search button and Cmd+K
  // shortcut work everywhere with no per-page change.
  if (!document.querySelector('script[data-gh-search]') && !window.GH_Search) {
    const s = document.createElement('script');
    s.src = '/js/global-search.js';
    s.dataset.ghSearch = '1';
    s.async = false;
    document.head.appendChild(s);
  }

  // ── SVG icon library — thin-stroke outlined style ────────────
  const SVG = {
    home:      `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>`,
    dailylog: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>`,
    inventory: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>`,
    medical: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>`,
    finance: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>`,
    todos: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/></svg>`,
    calendar:  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>`,
    reports: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>`,
    property: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>`,
    kids: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg>`,
    documents: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>`,
    career: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v2"/><line x1="12" y1="12" x2="12" y2="12"/><path d="M2 12h20"/></svg>`,
    books: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M2 3h6a4 4 0 014 4v14a3 3 0 00-3-3H2z"/><path d="M22 3h-6a4 4 0 00-4 4v14a3 3 0 013-3h7z"/></svg>`,
    resources: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71"/></svg>`,
    maintenance: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.91 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94l-3.76 3.76z"/></svg>`,
    templates: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>`,
    tests: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M9 3H5a2 2 0 00-2 2v4m6-6h10a2 2 0 012 2v4M9 3v11m0 0H5a2 2 0 00-2 2v4m6-6h10m0 0a2 2 0 012 2v4"/></svg>`,
    help: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 015.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`,
    settings:  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/></svg>`,
    database:  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/></svg>`,
    bell:      `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 01-3.46 0"/></svg>`,
    chevleft:  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>`,
    chevdown:  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>`,
    menu:      `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>`,
    print:     `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>`,
    sidebar:   `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="9" y1="3" x2="9" y2="21"/></svg>`,
    wardrobe:  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M20.38 3.46L16 2a4 4 0 01-8 0L3.62 3.46a2 2 0 00-1.34 2.23l.58 3.57a1 1 0 00.99.84H7v10a1 1 0 001 1h8a1 1 0 001-1V10h3.15a1 1 0 00.99-.84l.58-3.57a2 2 0 00-1.34-2.23z"/></svg>`,
    perfume:   `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M9 3h6v2H9z"/><path d="M12 5v3"/><rect x="5" y="8" width="14" height="13" rx="3"/><path d="M12 11v4M10 13h4"/></svg>`,
    insurance: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>`,
    subscriptions: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z"/><path d="M12 22V12M3.27 6.96L12 12.01l8.73-5.05"/></svg>`,
  };

  function icon(key, size) {
    return `<span style="width:${size}px;height:${size}px;display:flex;align-items:center;justify-content:center;flex-shrink:0">${SVG[key]||''}</span>`;
  }

  // ── Module registry ──────────────────────────────────────────
  const MODULES = {
    home:      { href:'/index.html',      label:'Today',     color:'#5c72fa', bg:'rgba(92,114,250,.12)',   svgKey:'home' },
    stats:     { href:'/dashboard.html',  label:'Stats',     color:'#06b6d4', bg:'rgba(6,182,212,.12)',    svgKey:'reports' },
    dailylog:  { href:'/daily-log.html',  label:'Daily Log', color:'#0ea5e9', bg:'rgba(14,165,233,.12)',   svgKey:'dailylog' },
    inventory: { href:'/inventory.html',  label:'Inventory', color:'#f59e0b', bg:'rgba(245,158,11,.12)',   svgKey:'inventory' },
    medical:   { href:'/medical.html',    label:'Medical',   color:'#14b8a6', bg:'rgba(20,184,166,.12)',   svgKey:'medical' },
    finance:   { href:'/finance.html',    label:'Finance',   color:'#22c55e', bg:'rgba(34,197,94,.12)',    svgKey:'finance' },
    trading:   { href:'/trade.html',      label:'↗ Terminal', color:'#22c55e', bg:'rgba(34,197,94,.12)',    svgKey:'finance', newTab: true },
    resources: { href:'/resources.html',  label:'Resources', color:'#64748b', bg:'rgba(100,116,139,.12)', svgKey:'resources' },
    todos:     { href:'/todos.html',      label:'To Do',     color:'#a78bfa', bg:'rgba(167,139,250,.12)', svgKey:'todos' },
    maintenance: { href:'/reports.html?open=maint-rollup', label:'Maintenance', color:'#f97316', bg:'rgba(249,115,22,.1)', svgKey:'maintenance' },
    templates:   { href:'/todos.html#templates',   label:'Templates',   color:'#a78bfa', bg:'rgba(167,139,250,.1)', svgKey:'templates'   },
    tests:     { href:'/settings.html#diagnostics', label:'System Tests', color:'#22c55e', bg:'rgba(34,197,94,.1)',   svgKey:'tests' },
    help:      { href:'/help.html',       label:'Help',          color:'#64748b', bg:'rgba(100,116,139,.1)',   svgKey:'help' },
    settings:  { href:'/settings.html',   label:'Settings',  color:'#8fa3bf', bg:'rgba(143,163,191,.1)',   svgKey:'settings' },
    property:  { href:'/property.html',   label:'Property',  color:'#ef4444', bg:'rgba(239,68,68,.1)',     svgKey:'property' },
    kids:      { href:'/kids.html',       label:'Kids',      color:'#ec4899', bg:'rgba(236,72,153,.1)',    svgKey:'kids' },
    documents: { href:'/documents.html',  label:'Documents', color:'#6366f1', bg:'rgba(99,102,241,.1)',    svgKey:'documents' },
    career:    { href:'/career.html',     label:'Career',    color:'#f97316', bg:'rgba(249,115,22,.1)',    svgKey:'career' },
    books:     { href:'/books.html',      label:'Books',     color:'#8b5cf6', bg:'rgba(139,92,246,.1)',    svgKey:'books' },
    reports:   { href:'/reports.html',    label:'Reports',       color:'#06b6d4', bg:'rgba(6,182,212,.1)',     svgKey:'reports' },
    data:      { href:'/settings.html#imports', label:'Data',          color:'#64748b', bg:'rgba(100,116,139,.1)',   svgKey:'database' },
    notifications:  { href:'/notifications.html', label:'Alerts',        color:'#ef4444', bg:'rgba(239,68,68,.1)',    svgKey:'bell' },
    wardrobe:       { href:'/wardrobe.html',       label:'Wardrobe',      color:'#ec4899', bg:'rgba(236,72,153,.1)',   svgKey:'wardrobe' },
    perfume:        { href:'/perfume.html',         label:'Perfume',       color:'#a78bfa', bg:'rgba(167,139,250,.1)',  svgKey:'perfume' },
    insurance:      { href:'/insurance.html',       label:'Insurance',     color:'#0ea5e9', bg:'rgba(14,165,233,.1)',   svgKey:'insurance' },
    subscriptions:  { href:'/subscriptions.html',   label:'Subscriptions', color:'#f59e0b', bg:'rgba(245,158,11,.1)',   svgKey:'subscriptions' },
  };

  function moduleIcon(m, sizePx) {
    return icon(m.svgKey || 'home', sizePx);
  }

  // Sidebar groups places-to-go-do-work. Utility actions (Search, Print,
  // Notifications, Help, Settings) live in the always-visible top bar built
  // by buildPageHeader() — duplicating them in the sidebar adds noise.
  const SIDEBAR_SECTIONS = [
    { label: 'Daily',     keys: ['dailylog', 'todos', 'resources'] },
    { label: 'Finance',   keys: ['finance', 'trading', 'subscriptions'] },
    { label: 'Household', keys: ['inventory', 'property', 'documents', 'wardrobe', 'perfume'] },
    { label: 'Family',    keys: ['medical', 'kids', 'insurance'] },
    { label: 'Personal',  keys: ['career', 'books'] },
    { label: 'Reports',   keys: ['reports', 'stats'] },
  ];

  const currentPath = window.location.pathname;
  function isActive(href) {
    if (!href) return false;
    if (href === '/index.html') return currentPath === '/' || currentPath === '/index.html';
    return currentPath === href;
  }

  // ── Sidebar collapse state ───────────────────────────────────
  let _collapsed = localStorage.getItem('gh_nav_collapsed') !== '0'; // collapsed by default

  function applyCollapsed(nav) {
    nav.classList.toggle('collapsed', _collapsed);
    document.body.classList.toggle('nav-collapsed', _collapsed);
    // Clear the pre-paint helper class now that real layout is applied
    document.documentElement.classList.remove('nav-collapsed-init');
  }

  function toggleCollapse() {
    _collapsed = !_collapsed;
    localStorage.setItem('gh_nav_collapsed', _collapsed ? '1' : '0');
    const nav = document.querySelector('.side-nav');
    if (nav) applyCollapsed(nav);
    // Rotate collapse icon
    const icon = document.getElementById('collapseIcon');
    if (icon) icon.style.transform = _collapsed ? 'rotate(180deg)' : '';
  }

  // ── Per-section collapse state ──────────────────────────────
  function isSectionOpen(label) {
    const stored = localStorage.getItem('gh_sec_' + label);
    // Daily open by default, everything else closed by default
    if (stored === null) return label === 'Daily';
    return stored === '1';
  }

  function toggleSection(label) {
    const open = !isSectionOpen(label);
    localStorage.setItem('gh_sec_' + label, open ? '1' : '0');
    const sec = document.querySelector(`.side-nav-section[data-section="${label}"]`);
    if (!sec) return;
    sec.classList.toggle('sec-open', open);
    const chevron = sec.querySelector('.sec-chevron');
    if (chevron) chevron.style.transform = open ? 'rotate(0deg)' : 'rotate(-90deg)';
  }

  // ── Notifications badge ──────────────────────────────────────
  let _notifCount = 0;
  function loadNotifCount() {
    fetch('/api/v1/notifications/unread-count')
      .then(r => r.ok ? r.json() : { count:0 })
      .then(d => {
        _notifCount = d.count || 0;
        document.querySelectorAll('.gh-notif-badge').forEach(b => {
          b.textContent = _notifCount;
          b.style.display = _notifCount > 0 ? 'flex' : 'none';
        });
      }).catch(() => {});
  }

  function loadTodoCount() {
    fetch('/api/v1/todos/count')
      .then(r => r.ok ? r.json() : { count:0 })
      .then(d => {
        const n = d.count || 0;
        document.querySelectorAll('.gh-todo-badge').forEach(b => {
          b.textContent = n > 99 ? '99+' : n;
          b.style.display = n > 0 ? 'flex' : 'none';
        });
      }).catch(() => {});
  }

  // ── Sidebar ──────────────────────────────────────────────────
  function buildSidebar() {
    const nav = document.createElement('nav');
    nav.className = 'side-nav';

    const logoBlock = `
      <div class="side-nav-logo">
        <a href="/index.html" onclick="if(location.pathname==='/'||location.pathname==='/index.html'){event.preventDefault();window.scrollTo({top:0,behavior:'smooth'});}" style="display:flex;align-items:center;justify-content:center;text-decoration:none;gap:8px;width:100%;padding:2px 0">
          <span class="side-nav-logo-icon" style="display:none;width:36px;height:36px;flex-shrink:0">
            <img src="/icons/logo.png" style="width:36px;height:36px;object-fit:contain" alt="G">
          </span>
          <span class="side-nav-logo-text" style="display:flex;align-items:center">
            <img src="/icons/logo.png" style="height:88px;object-fit:contain" alt="Ghrava">
          </span>
        </a>
      </div>`;

    const sections = SIDEBAR_SECTIONS.map(s => {
      // Auto-open the section that contains the active page
      const hasActive = s.keys.some(k => MODULES[k] && isActive(MODULES[k].href));
      const open = hasActive || isSectionOpen(s.label);
      // Persist auto-open so it stays open across pages
      if (hasActive) localStorage.setItem('gh_sec_' + s.label, '1');
      return `
      <div class="side-nav-section${open ? ' sec-open' : ''}" data-section="${s.label}">
        <div class="side-nav-section-label" onclick="GH_NAV.toggleSection('${s.label}')">
          <span class="sec-label-text">${s.label}</span>
          <span class="sec-chevron" style="transform:${open ? 'rotate(0deg)' : 'rotate(-90deg)'}">${SVG.chevdown}</span>
        </div>
        <div class="side-nav-section-items">
          ${s.keys.map(k => {
            const m = MODULES[k];
            const active = isActive(m.href);
            const isTodos = k === 'todos';
            return `<a href="${m.href}"
              ${m.newTab ? 'target="_blank" rel="noopener"' : ''}
              class="side-nav-item${active ? ' active' : ''}"
              data-label="${m.label}"
              style="${active ? `color:${m.color}` : ''}">
              <span class="side-nav-icon" style="width:18px;height:18px;display:flex;align-items:center;justify-content:center;flex-shrink:0;color:${active ? m.color : 'currentColor'}">${SVG[m.svgKey]||''}</span>
              <span class="side-nav-item-label">${m.label}</span>
              ${isTodos ? `<span class="gh-todo-badge" style="display:none;margin-left:auto;background:var(--amber);color:#000;border-radius:10px;font-size:9px;font-weight:700;padding:1px 5px;font-family:var(--mono)">0</span>` : ''}
              ${k === 'notifications' ? `<span class="gh-notif-badge" style="display:none;margin-left:auto;background:var(--red);color:white;border-radius:10px;font-size:9px;font-weight:700;padding:1px 5px;font-family:var(--mono)">0</span>` : ''}
            </a>`;
          }).join('')}
        </div>
      </div>`;
    }).join('');

    const bottom = `
      <div class="side-nav-spacer"></div>
      <div class="side-nav-bottom">
        <button class="side-nav-item side-nav-collapse-btn-inline" onclick="GH_NAV.toggleCollapse()" data-label="Toggle sidebar" title="Toggle sidebar">
          <span class="side-nav-icon" style="width:18px;height:18px;display:flex;align-items:center;justify-content:center;flex-shrink:0" id="collapseIcon">${SVG.sidebar}</span>
          <span class="side-nav-item-label" style="font-size:12px">Collapse</span>
        </button>
      </div>`;

    nav.innerHTML = logoBlock + sections + bottom;
    document.body.insertBefore(nav, document.body.firstChild);
    applyCollapsed(nav);

    // Mobile overlay
    const overlay = document.createElement('div');
    overlay.id = 'ghSideNavOverlay';
    overlay.className = 'side-nav-overlay';
    overlay.onclick = () => window.GH_NAV && GH_NAV.closeSidebar();
    document.body.appendChild(overlay);
  }

  // ── Page header ──────────────────────────────────────────────
  function buildPageHeader() {
    const cfg = window.GH_PAGE || {};
    if (cfg.noHeader) return;

    const mod    = MODULES[cfg.module] || {};
    const title  = cfg.title  || mod.label || document.title.split('—')[0].trim();
    const color  = cfg.color  || mod.color || 'var(--accent)';
    const bg     = cfg.bg     || mod.bg    || 'rgba(92,114,250,.12)';
    const svgKey = mod.svgKey || 'home';
    const isHome = (currentPath === '/' || currentPath === '/index.html');
    const backHref = cfg.back || '/index.html';

    const hamburger = `
      <button class="gh-hamburger" aria-label="Menu" onclick="window.GH_NAV && GH_NAV.toggleSidebar()">
        ${SVG.menu}
      </button>`;

    const backBtn = '';

    const pageIcon = SVG[svgKey] ? `
      <span class="gh-header-icon" style="background:${bg};color:${color}">
        <span style="width:22px;height:22px;display:flex;align-items:center;justify-content:center;color:${color}">${SVG[svgKey]}</span>
      </span>` : '';

    const rightBtns = `
      <div class="gh-header-actions">
        ${cfg.rightExtra || ''}
        <button class="gh-scope-pill" id="ghScopePill" onclick="window.GH_NAV && GH_NAV.openScopePicker()" title="Device scope" style="display:none"></button>
        <button class="gh-icon-btn" id="ghSearchBtn" aria-label="Search" onclick="window.GH_NAV && GH_NAV.toggleSearch()" title="Search (Ctrl+K)">
          <span style="width:18px;height:18px;display:flex;align-items:center;justify-content:center">${SVG.search || '<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.75\" stroke-linecap=\"round\"><circle cx=\"11\" cy=\"11\" r=\"7\"/><line x1=\"16.5\" y1=\"16.5\" x2=\"21\" y2=\"21\"/></svg>'}</span>
        </button>
        <button class="gh-icon-btn" aria-label="Print" onclick="window.print()" title="Print">
          <span style="width:18px;height:18px;display:flex;align-items:center;justify-content:center">${SVG.print}</span>
        </button>
        <button class="gh-icon-btn" id="ghNotifBtn" aria-label="Notifications" onclick="window.GH_NAV && GH_NAV.toggleNotif()" title="Notifications">
          <span style="width:18px;height:18px;display:flex;align-items:center;justify-content:center">${SVG.bell}</span>
          <span class="gh-notif-badge" style="display:none">0</span>
        </button>
        <a href="/help.html" class="gh-icon-btn" aria-label="Help" title="Help">
          <span style="width:18px;height:18px;display:flex;align-items:center;justify-content:center">${SVG.help}</span>
        </a>
        <a href="/settings.html" class="gh-icon-btn" aria-label="Settings" title="Settings">
          <span style="width:18px;height:18px;display:flex;align-items:center;justify-content:center">${SVG.settings}</span>
        </a>
      </div>`;

    const header = document.createElement('header');
    header.className = 'gh-page-header';
    header.innerHTML = `
      <div class="gh-header-row">
        ${hamburger}
        ${backBtn}
        ${pageIcon}
        <div class="gh-header-title-wrap">
          <h1 class="gh-header-title">${title}</h1>
          ${cfg.subtitle ? `<div class="gh-header-sub">${cfg.subtitle}</div>` : ''}
        </div>
        ${rightBtns}
      </div>
      ${cfg.headerExtra || ''}`;

    const app = document.getElementById('app');
    if (app) app.insertBefore(header, app.firstChild);
    else document.body.insertBefore(header, document.body.firstChild);
  }

  // ── Notifications panel ──────────────────────────────────────
  function buildNotifPanel() {
    const panel = document.createElement('div');
    panel.id = 'ghNotifPanel';
    panel.className = 'gh-notif-panel';
    panel.innerHTML = `
      <div class="gh-notif-header">
        <span class="gh-notif-title">Notifications</span>
        <button class="gh-notif-mark-read" onclick="GH_NAV.markAllRead()">Mark all read</button>
      </div>
      <div id="ghNotifList" class="gh-notif-list">
        <div class="gh-notif-empty">Loading…</div>
      </div>
      <div style="padding:8px 12px;border-top:1px solid var(--border);text-align:center">
        <a href="/notifications.html" style="font-size:12px;color:var(--accent);text-decoration:none">View all notifications →</a>
      </div>`;
    document.body.appendChild(panel);
    document.addEventListener('click', e => {
      if (!panel.contains(e.target) && !e.target.closest('#ghNotifBtn'))
        panel.classList.remove('open');
    });
  }

  function buildSearchPanel() {
    const panel = document.createElement('div');
    panel.id = 'ghSearchPanel';
    panel.className = 'gh-search-panel';
    panel.innerHTML = `
      <div class="gh-search-backdrop" onclick="GH_NAV.closeSearch()"></div>
      <div class="gh-search-modal">
        <div class="gh-search-input-row">
          <span class="gh-search-input-icon">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><line x1="16.5" y1="16.5" x2="21" y2="21"/></svg>
          </span>
          <input type="text" id="ghSearchInput" class="gh-search-input"
                 placeholder="Search across all modules\u2026"
                 oninput="GH_NAV.runSearch(this.value)">
          <button class="gh-search-close" onclick="GH_NAV.closeSearch()" aria-label="Close">\u00d7</button>
        </div>
        <div id="ghSearchResults" class="gh-search-results">
          <div class="gh-search-hint">Type at least 2 characters to search</div>
        </div>
        <div class="gh-search-foot">
          <span><kbd>Ctrl</kbd>+<kbd>K</kbd> to open \u00b7 <kbd>Esc</kbd> to close</span>
        </div>
      </div>`;
    document.body.appendChild(panel);
  }

  // ── Public API ───────────────────────────────────────────────
  window.GH_NAV = {
    MODULES, SVG,
    toggleSidebar() {
      const nav = document.querySelector('.side-nav');
      const overlay = document.getElementById('ghSideNavOverlay');
      if (!nav) return;
      const opening = !nav.classList.contains('open');
      nav.classList.toggle('open', opening);
      if (overlay) overlay.classList.toggle('open', opening);
    },
    closeSidebar() {
      const nav = document.querySelector('.side-nav');
      const overlay = document.getElementById('ghSideNavOverlay');
      if (nav) nav.classList.remove('open');
      if (overlay) overlay.classList.remove('open');
    },
    toggleCollapse,
    toggleNotif() {
      const panel = document.getElementById('ghNotifPanel');
      if (!panel) return;
      const opening = !panel.classList.contains('open');
      panel.classList.toggle('open');
      if (opening) this.loadNotifs();
    },
    loadNotifs() {
      fetch('/api/v1/notifications')
        .then(r => r.ok ? r.json() : [])
        .then(list => {
          const el = document.getElementById('ghNotifList');
          if (!el) return;
          if (!list.length) { el.innerHTML = '<div class="gh-notif-empty">No notifications</div>'; return; }
          el.innerHTML = list.map(n => `
            <div class="gh-notif-item${n.is_read?'':' unread'}" data-id="${n.id}"
                 onclick="GH_NAV.openNotif(${n.id},'${n.entity_type||''}','${n.entity_id||''}')">
              <span class="gh-notif-dot" style="background:${n.severity==='overdue'?'#ef4444':n.severity==='pending'?'#f59e0b':'#5c72fa'}"></span>
              <div class="gh-notif-body">
                <div class="gh-notif-text">${n.title}</div>
                <div class="gh-notif-sub">${n.body||''}</div>
                <div class="gh-notif-time">${n.module||''} · ${n.time_ago||''}</div>
              </div>
            </div>`).join('');
        }).catch(() => {
          const el = document.getElementById('ghNotifList');
          if (el) el.innerHTML = '<div class="gh-notif-empty">Could not load notifications</div>';
        });
    },
    openNotif(id, entityType, entityId) {
      fetch(`/api/v1/notifications/${id}/read`, { method:'PATCH' }).catch(()=>{});
      const map = { inventory:'/inventory.html', daily_log:'/daily-log.html', medical:'/medical.html',
        todos:'/todos.html', finance:'/finance.html', hsa:'/finance.html', property:'/property.html',
        kids:'/kids.html', documents:'/documents.html', reports:'/reports.html', resources:'/resources.html' };
      if (entityType && map[entityType]) window.location.href = map[entityType];
      document.getElementById('ghNotifPanel')?.classList.remove('open');
    },
    markAllRead() {
      fetch('/api/v1/notifications/read-all', { method:'PATCH' })
        .then(() => {
          document.querySelectorAll('.gh-notif-badge').forEach(b => { b.textContent='0'; b.style.display='none'; });
          document.querySelectorAll('.gh-notif-item.unread').forEach(el => el.classList.remove('unread'));
        }).catch(()=>{});
    },
    toggleSearch() {
      // Delegate to the unified global search modal. Pre-scope to the current
      // module if the page declared one via window.GH_PAGE.module — that's a
      // hint, not a hard filter; the user can flip back to "All" with a click.
      const cfg = window.GH_PAGE || {};
      const pageModule = cfg.module || '';
      // Map nav module keys to GH_Search scope ids (which match server group names)
      const scopeMap = {
        inventory: 'Inventory', wardrobe: 'Wardrobe', medical: 'Medical',
        todos: 'Todos', documents: 'Documents', kids: 'Kids', books: 'Books',
        career: 'Career', property: 'Property,Vehicles', finance: 'Finance,Investments,Transactions',
        'daily-log': 'Daily Log', resources: 'Resources', perfume: 'Perfume',
      };
      const scope = scopeMap[pageModule] || '';
      if (window.GH_Search) {
        window.GH_Search.open({ scope });
      } else {
        // Fallback if the modal script didn't load (older cached pages)
        console.warn('GH_Search not available; nav search no-op');
      }
    },
    closeSearch() {
      if (window.GH_Search) window.GH_Search.close();
    },
    _searchTimer: null,
    _searchSeq: 0,
    runSearch(q) {
      // Legacy entry retained for backwards-compat with the old in-nav panel.
      // The unified modal owns search now; opening it pre-scopes appropriately.
      if (window.GH_Search) window.GH_Search.open({ query: q });
    },
    toggleSection,

    // ── Per-device family scope (v202604.128) ──────────────────
    // First-time prompt asks "Who is this device for?". Choice is saved
    // in localStorage and surfaced as a pill in the page header. Click
    // the pill to change/clear. The scope is INFORMATIONAL for now —
    // module renderers can read GH_NAV.getScope() to default-filter
    // their lists; lens auto-applies a person pill when scope is set.
    getScope() {
      try {
        const raw = localStorage.getItem('gh_device_family_scope');
        if (!raw) return null;
        const obj = JSON.parse(raw);
        if (!obj || obj.id == null) return null;
        return obj;  // { id, name }
      } catch(e) { return null; }
    },
    setScope(member) {
      try {
        if (!member || member.id == null) {
          localStorage.removeItem('gh_device_family_scope');
        } else {
          localStorage.setItem('gh_device_family_scope', JSON.stringify({
            id: member.id,
            name: member.display_name || member.first_name || `Person ${member.id}`,
          }));
        }
      } catch(e) {}
      this.refreshScopePill();
      // Notify the lens so it can apply the scope as a person pill
      window.dispatchEvent(new CustomEvent('gh-scope-changed', { detail: this.getScope() }));
    },
    refreshScopePill() {
      const pill = document.getElementById('ghScopePill');
      if (!pill) return;
      const scope = this.getScope();
      if (!scope) {
        pill.style.display = 'none';
        pill.textContent = '';
        return;
      }
      pill.style.display = '';
      pill.innerHTML = `<span class="gh-scope-pill__dot"></span><span>${scope.name}</span>`;
    },
    async openScopePicker() {
      const members = await fetchFamilyForScope();
      const current = this.getScope();
      const overlay = document.createElement('div');
      overlay.className = 'gh-scope-overlay';
      overlay.innerHTML = `
        <div class="gh-scope-modal">
          <h3 class="gh-scope-modal__title">Who is this device for?</h3>
          <p class="gh-scope-modal__sub">We'll default lists to this person across modules. You can change this anytime.</p>
          <div class="gh-scope-modal__list">
            <button class="gh-scope-modal__opt${!current ? ' active':''}" data-id="">
              <span class="gh-scope-modal__avatar gh-scope-modal__avatar--all">All</span>
              <span>Everyone (no filter)</span>
            </button>
            ${members.map(m => {
              const name = m.display_name || m.first_name || `Person ${m.id}`;
              const active = current && String(current.id) === String(m.id);
              return `<button class="gh-scope-modal__opt${active?' active':''}" data-id="${m.id}" data-name="${name.replace(/"/g,'&quot;')}">
                <span class="gh-scope-modal__avatar">${(name||'?').slice(0,1).toUpperCase()}</span>
                <span>${name}</span>
              </button>`;
            }).join('')}
          </div>
        </div>`;
      document.body.appendChild(overlay);
      overlay.addEventListener('click', e => {
        const opt = e.target.closest('.gh-scope-modal__opt');
        if (opt) {
          const id = opt.dataset.id;
          if (id) {
            this.setScope({ id: parseInt(id,10), display_name: opt.dataset.name });
          } else {
            this.setScope(null);
          }
          overlay.remove();
          return;
        }
        if (e.target === overlay) overlay.remove();
      });
    },
  };

  // Helper: fetch family list for the picker. Cached for the page life.
  let _navFamilyCache = null;
  async function fetchFamilyForScope() {
    if (Array.isArray(_navFamilyCache)) return _navFamilyCache;
    try {
      const r = await fetch('/api/v1/settings/family');
      const rows = await r.json();
      _navFamilyCache = Array.isArray(rows) ? rows : [];
    } catch(e) { _navFamilyCache = []; }
    return _navFamilyCache;
  }

  // First-time prompt: if no scope set AND we have family members, ask.
  // Also avoids prompting on login/help/offline pages.
  function maybePromptFirstTime() {
    try {
      if (localStorage.getItem('gh_device_family_scope')) return;
      if (localStorage.getItem('gh_device_family_scope_dismissed')) return;
      const path = window.location.pathname;
      if (/login|offline|help/.test(path)) return;
    } catch(e) { return; }
    // Defer slightly so the page renders first
    setTimeout(async () => {
      const members = await fetchFamilyForScope();
      if (!members.length) return;  // nothing to scope to
      window.GH_NAV.openScopePicker();
      // Even if user dismisses without picking, don't ask again this session
      try { localStorage.setItem('gh_device_family_scope_dismissed', '1'); } catch(e) {}
    }, 1200);
  }

  buildSidebar();
  // buildPageHeader needs #app to exist — defer if DOM not ready
  if (document.getElementById('app')) {
    buildPageHeader();
    window.GH_NAV.refreshScopePill();
  } else {
    document.addEventListener('DOMContentLoaded', () => {
      buildPageHeader();
      window.GH_NAV.refreshScopePill();
    });
  }
  buildNotifPanel();
  // First-time scope prompt — defer until after DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', maybePromptFirstTime);
  } else {
    maybePromptFirstTime();
  }
  // (Old nav search panel removed — toggleSearch() now opens GH_Search modal)

  // Keyboard shortcut: Ctrl/Cmd + K opens search
  document.addEventListener('keydown', e => {
    if ((e.ctrlKey || e.metaKey) && (e.key === 'k' || e.key === 'K')) {
      e.preventDefault();
      window.GH_NAV.toggleSearch();
    }
    if (e.key === 'Escape') {
      const sp = document.getElementById('ghSearchPanel');
      if (sp && sp.classList.contains('open')) {
        e.preventDefault();
        window.GH_NAV.closeSearch();
      }
    }
  });

  // ── Screen size awareness ─────────────────────────────────────
  // On very wide screens (≥1400px) always force expanded — 
  // on narrow desktop (900-1100px) respect the user's stored preference
  function handleResize() {
    const w = window.innerWidth;
    const nav = document.querySelector('.side-nav');
    if (!nav) return;
    if (w < 900) {
      // Mobile — sidebar is drawer, collapse state irrelevant
      nav.classList.remove('collapsed');
      document.body.classList.remove('nav-collapsed');
    } else if (w >= 1400) {
      // Very wide — always show full sidebar
      _collapsed = false;
      localStorage.setItem('gh_nav_collapsed', '0');
      applyCollapsed(nav);
    } else {
      // Mid-range desktop — respect stored preference
      applyCollapsed(nav);
    }
    // Sync icon
    const icon = document.getElementById('collapseIcon');
    if (icon) icon.style.transform = _collapsed ? 'rotate(180deg)' : '';
  }

  window.addEventListener('resize', handleResize);
  handleResize(); // run immediately on load

  setTimeout(loadNotifCount, 800);
  setTimeout(loadTodoCount,  1000);

})();
