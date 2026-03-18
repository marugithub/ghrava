/**
 * nav.js — Ghrava navigation
 * Builds: left sidebar (collapsible to icon-only), shared sticky page header
 */
(function() {

  // ── SVG icon library — thin-stroke outlined style ────────────
  const SVG = {
    home:      `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>`,
    dailylog:  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>`,
    inventory: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>`,
    medical:   `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>`,
    finance:   `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/></svg>`,
    todos:     `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/></svg>`,
    calendar:  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>`,
    reports:   `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>`,
    property:  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><rect x="9" y="14" width="6" height="7"/></svg>`,
    kids:      `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="7" r="4"/><path d="M6 21v-1a6 6 0 0112 0v1"/><path d="M8.5 10.5l-2 4h11l-2-4"/></svg>`,
    documents: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>`,
    career:    `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v2"/><line x1="12" y1="12" x2="12" y2="12.01"/></svg>`,
    books:     `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5A2.5 2.5 0 016.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z"/></svg>`,
    resources: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg>`,
    settings:  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/></svg>`,
    bell:      `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 01-3.46 0"/></svg>`,
    chevleft:  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>`,
    menu:      `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>`,
    sidebar:   `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="9" y1="3" x2="9" y2="21"/></svg>`,
  };

  function icon(key, size) {
    return `<span style="width:${size}px;height:${size}px;display:flex;align-items:center;justify-content:center;flex-shrink:0">${SVG[key]||''}</span>`;
  }

  // ── Module registry ──────────────────────────────────────────
  const MODULES = {
    home:      { href:'/index.html',      label:'Home',      color:'#5c72fa', bg:'rgba(92,114,250,.12)',   svgKey:'home' },
    dailylog:  { href:'/daily-log.html',  label:'Daily Log', color:'#0ea5e9', bg:'rgba(14,165,233,.12)',   svgKey:'dailylog' },
    inventory: { href:'/inventory.html',  label:'Inventory', color:'#f59e0b', bg:'rgba(245,158,11,.12)',   svgKey:'inventory' },
    medical:   { href:'/medical.html',    label:'Medical',   color:'#14b8a6', bg:'rgba(20,184,166,.12)',   svgKey:'medical' },
    finance:   { href:'/finance.html',    label:'Finance',   color:'#22c55e', bg:'rgba(34,197,94,.12)',    svgKey:'finance' },
    resources: { href:'/resources.html',  label:'Resources', color:'#64748b', bg:'rgba(100,116,139,.12)', svgKey:'resources' },
    todos:     { href:'/todos.html',      label:'To Do',     color:'#a78bfa', bg:'rgba(167,139,250,.12)', svgKey:'todos' },
    settings:  { href:'/settings.html',   label:'Settings',  color:'#8fa3bf', bg:'rgba(143,163,191,.1)',   svgKey:'settings' },
    property:  { href:'/property.html',   label:'Property',  color:'#ef4444', bg:'rgba(239,68,68,.1)',     svgKey:'property' },
    kids:      { href:'/kids.html',       label:'Kids',      color:'#ec4899', bg:'rgba(236,72,153,.1)',    svgKey:'kids' },
    documents: { href:'/documents.html',  label:'Documents', color:'#6366f1', bg:'rgba(99,102,241,.1)',    svgKey:'documents' },
    career:    { href:'/career.html',     label:'Career',    color:'#f97316', bg:'rgba(249,115,22,.1)',    svgKey:'career' },
    books:     { href:'/books.html',      label:'Books',     color:'#8b5cf6', bg:'rgba(139,92,246,.1)',    svgKey:'books' },
    calendar:  { href:'/calendar.html',   label:'Calendar',  color:'#06b6d4', bg:'rgba(6,182,212,.1)',     svgKey:'calendar' },
    reports:   { href:'/reports.html',    label:'Reports',   color:'#06b6d4', bg:'rgba(6,182,212,.1)',     svgKey:'reports' },
  };

  function moduleIcon(m, sizePx) {
    return icon(m.svgKey || 'home', sizePx);
  }

  const SIDEBAR_SECTIONS = [
    { label: 'Daily',     keys: ['dailylog', 'todos'] },
    { label: 'Finance',   keys: ['finance', 'reports'] },
    { label: 'Household', keys: ['inventory', 'medical', 'kids', 'property', 'documents'] },
    { label: 'Personal',  keys: ['career', 'books', 'resources'] },
  ];

  const currentPath = window.location.pathname;
  function isActive(href) {
    if (!href) return false;
    if (href === '/index.html') return currentPath === '/' || currentPath === '/index.html';
    return currentPath === href;
  }

  // ── Sidebar collapse state ───────────────────────────────────
  let _collapsed = localStorage.getItem('gh_nav_collapsed') === '1';

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
          <span class="side-nav-logo-icon" style="display:none;width:28px;height:28px;flex-shrink:0;color:var(--accent)">${icon('home',22)}</span>
          <span class="side-nav-logo-text" style="display:flex;align-items:center">
            <img src="/icons/logo.png" style="height:64px;object-fit:contain" alt="Ghrava">
          </span>
        </a>
      </div>`;

    const sections = SIDEBAR_SECTIONS.map(s => `
      <div class="side-nav-section">
        <div class="side-nav-section-label">${s.label}</div>
        ${s.keys.map(k => {
          const m = MODULES[k];
          const active = isActive(m.href);
          const isTodos = k === 'todos';
          return `<a href="${m.href}"
            class="side-nav-item${active ? ' active' : ''}"
            data-label="${m.label}"
            style="${active ? `color:${m.color}` : ''}">
            <span class="side-nav-icon" style="width:18px;height:18px;display:flex;align-items:center;justify-content:center;flex-shrink:0;color:${active ? m.color : 'currentColor'}">${SVG[m.svgKey]||''}</span>
            <span class="side-nav-item-label">${m.label}</span>
            ${isTodos ? `<span class="gh-todo-badge" style="display:none;margin-left:auto;background:var(--amber);color:#000;border-radius:10px;font-size:9px;font-weight:700;padding:1px 5px;font-family:var(--mono)">0</span>` : ''}
          </a>`;
        }).join('')}
      </div>`).join('');

    const bottom = `
      <div class="side-nav-spacer"></div>
      <div class="side-nav-bottom">
        <button class="side-nav-item side-nav-collapse-btn-inline" onclick="GH_NAV.toggleCollapse()" data-label="Toggle sidebar" title="Toggle sidebar">
          <span class="side-nav-icon" style="width:18px;height:18px;display:flex;align-items:center;justify-content:center;flex-shrink:0" id="collapseIcon">${SVG.sidebar}</span>
          <span class="side-nav-item-label" style="font-size:12px">Collapse</span>
        </button>
      </div>`;

    nav.innerHTML = logoBlock + sections + bottom;
    applyCollapsed(nav);
    document.body.insertBefore(nav, document.body.firstChild);

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

    const backBtn = (!isHome && !cfg.noBack) ? `
      <a href="${backHref}" class="gh-header-back gh-header-back--desktop" aria-label="Home">
        ${icon('home', 16)}
      </a>` : '';

    const pageIcon = SVG[svgKey] ? `
      <span class="gh-header-icon" style="background:${bg};color:${color}">
        <span style="width:18px;height:18px;display:flex;align-items:center;justify-content:center;color:${color}">${SVG[svgKey]}</span>
      </span>` : '';

    const rightBtns = `
      <div class="gh-header-actions">
        ${cfg.rightExtra || ''}
        <button class="gh-icon-btn" id="ghNotifBtn" aria-label="Notifications" onclick="window.GH_NAV && GH_NAV.toggleNotif()">
          <span style="width:16px;height:16px;display:flex;align-items:center;justify-content:center">${SVG.bell}</span>
          <span class="gh-notif-badge" style="display:none">0</span>
        </button>
        <a href="/settings.html" class="gh-icon-btn" aria-label="Settings">
          <span style="width:16px;height:16px;display:flex;align-items:center;justify-content:center">${SVG.settings}</span>
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
      </div>`;
    document.body.appendChild(panel);
    document.addEventListener('click', e => {
      if (!panel.contains(e.target) && !e.target.closest('#ghNotifBtn'))
        panel.classList.remove('open');
    });
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
  };

  buildSidebar();
  // buildPageHeader needs #app to exist — defer if DOM not ready
  if (document.getElementById('app')) {
    buildPageHeader();
  } else {
    document.addEventListener('DOMContentLoaded', buildPageHeader);
  }
  buildNotifPanel();

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
