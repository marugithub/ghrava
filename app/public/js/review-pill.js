// @ts-nocheck
// ─────────────────────────────────────────────────────────────────────
// review-pill.js  —  v202604.167
//
// Tiny global widget that surfaces auto-linker outputs flagged with
// needs_review=1. Loads on any page; renders a floating pill in the
// nav header with a count; click → opens drawer listing every link
// with Confirm / Unlink buttons.
//
// Backend:  GET    /api/v1/links/needs-review
//           POST   /api/v1/links/:id/confirm
//           DELETE /api/v1/links/:id
//
// Auto-installs ~3 seconds after page load so it doesn't compete with
// page-critical XHRs. Refreshes every 60s while drawer is open.
// Drop a `<script src="/js/review-pill.js" defer></script>` on any
// page that wants the surface.
// ─────────────────────────────────────────────────────────────────────

(function () {
  'use strict';
  if (window.__reviewPillLoaded) return;
  window.__reviewPillLoaded = true;

  const TYPE_LABEL = {
    transaction:   'Transaction',
    subscription:  'Subscription',
    medical_visit: 'Medical visit',
    hsa_payment:   'HSA payment',
    eob:           'EOB claim',
    document:      'Document',
  };
  const KIND_LABEL = {
    auto_hsa:       'Auto-linked to HSA payment',
    auto_visit:     'Auto-linked to medical visit',
    auto_eob_hsa:   'Auto-matched EOB ↔ HSA payment',
    auto_sub:       'Auto-linked to subscription',
    legacy_migrated:'Migrated from legacy attachment',
    manual:         'Manually linked',
    auto:           'Auto-linked',
  };

  function esc(s) {
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function ensureStyles() {
    if (document.getElementById('rp-styles')) return;
    const s = document.createElement('style');
    s.id = 'rp-styles';
    s.textContent = `
      .rp-pill { position: fixed; bottom: 18px; right: 18px; z-index: 9000;
        background: rgba(180,83,9,0.95); color: #fff; padding: 8px 14px;
        border-radius: 20px; font: 600 12px var(--mono, monospace);
        cursor: pointer; box-shadow: 0 4px 14px rgba(0,0,0,.18);
        display: flex; align-items: center; gap: 8px;
        transition: transform .15s ease, background .15s ease; }
      .rp-pill:hover { transform: translateY(-1px); background: rgba(180,83,9,1); }
      .rp-pill.hidden { display: none; }
      .rp-pill-icon { font-size: 14px; line-height: 1; }
      .rp-pill-count { background: rgba(255,255,255,.22); padding: 1px 7px; border-radius: 10px; font-size: 11px; }
      .rp-overlay { position: fixed; inset: 0; background: rgba(0,0,0,.4); z-index: 9100;
        display: flex; justify-content: flex-end; opacity: 0; transition: opacity .15s; }
      .rp-overlay.open { opacity: 1; }
      .rp-drawer { width: min(420px, 92vw); height: 100vh; background: var(--bg, #fff);
        overflow-y: auto; padding: 16px 18px 80px; transform: translateX(100%);
        transition: transform .18s ease; }
      .rp-overlay.open .rp-drawer { transform: translateX(0); }
      .rp-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px; }
      .rp-head-title { font-weight: 700; font-size: 16px; color: var(--text, #1a1a1a); }
      .rp-head-close { background: none; border: none; font-size: 22px; cursor: pointer; color: var(--text3, #888); padding: 0 6px; }
      .rp-empty { text-align: center; color: var(--text3, #888); font-size: 13px; padding: 30px 10px; line-height: 1.5; }
      .rp-row { background: var(--bg2, #fafafa); border: 1px solid var(--border, #eee);
        border-radius: 8px; padding: 12px 13px; margin-bottom: 10px; }
      .rp-row-kind { font-family: var(--mono, monospace); font-size: 11px; color: var(--amber, #b45309); margin-bottom: 4px; letter-spacing: .04em; }
      .rp-row-sides { font-size: 13px; color: var(--text, #1a1a1a); margin-bottom: 4px; line-height: 1.4; }
      .rp-row-arrow { color: var(--text3, #888); margin: 0 6px; }
      .rp-row-note { font-family: var(--mono, monospace); font-size: 11px; color: var(--text3, #888); margin: 4px 0 8px; line-height: 1.4; white-space: pre-wrap; }
      .rp-row-actions { display: flex; gap: 6px; }
      .rp-btn { padding: 5px 10px; border-radius: 6px; border: 1px solid var(--border, #ddd); background: var(--bg, #fff); cursor: pointer; font: 500 12px sans-serif; }
      .rp-btn-confirm { background: var(--green, #15803d); color: #fff; border-color: var(--green, #15803d); }
      .rp-btn-unlink { color: var(--red, #b91c1c); border-color: var(--red, #b91c1c); background: transparent; }
      .rp-btn:hover { filter: brightness(0.95); }
    `;
    document.head.appendChild(s);
  }

  let overlayEl = null;
  let pillEl = null;
  let pollTimer = null;

  async function fetchCount() {
    try {
      const r = await fetch('/api/v1/links/needs-review?limit=1');
      const j = await r.json();
      return j.count || (j.links && j.links.length) || 0;
    } catch (e) { return 0; }
  }

  async function fetchAll() {
    try {
      const r = await fetch('/api/v1/links/needs-review?limit=200');
      const j = await r.json();
      return j.links || [];
    } catch (e) { return []; }
  }

  function renderRow(link) {
    const leftLabel  = TYPE_LABEL[link.left_type]  || link.left_type;
    const rightLabel = TYPE_LABEL[link.right_type] || link.right_type;
    const kindLabel  = KIND_LABEL[link.link_kind]  || link.link_kind;
    return `
      <div class="rp-row" data-link-id="${link.id}">
        <div class="rp-row-kind">${esc(kindLabel)} · ${esc(link.confidence || 'medium')}</div>
        <div class="rp-row-sides">
          ${esc(leftLabel)} #${link.left_id}
          <span class="rp-row-arrow">↔</span>
          ${esc(rightLabel)} #${link.right_id}
        </div>
        ${link.notes ? `<div class="rp-row-note">${esc(link.notes)}</div>` : ''}
        <div class="rp-row-actions">
          <button class="rp-btn rp-btn-confirm" data-act="confirm" data-id="${link.id}">Confirm</button>
          <button class="rp-btn rp-btn-unlink"  data-act="unlink"  data-id="${link.id}">Unlink</button>
        </div>
      </div>`;
  }

  async function openDrawer() {
    ensureStyles();
    if (!overlayEl) {
      overlayEl = document.createElement('div');
      overlayEl.className = 'rp-overlay';
      overlayEl.innerHTML = `
        <div class="rp-drawer">
          <div class="rp-head">
            <div class="rp-head-title">Needs review</div>
            <button class="rp-head-close" data-close>×</button>
          </div>
          <div id="rp-list"><div class="rp-empty">Loading…</div></div>
        </div>`;
      document.body.appendChild(overlayEl);

      overlayEl.addEventListener('click', async (e) => {
        if (e.target === overlayEl || e.target.dataset.close != null) {
          closeDrawer();
          return;
        }
        const id = e.target.dataset.id;
        const act = e.target.dataset.act;
        if (!id || !act) return;
        try {
          if (act === 'confirm') {
            await fetch(`/api/v1/links/${id}/confirm`, { method: 'POST' });
          } else if (act === 'unlink') {
            if (!confirm('Remove this link? The two records will no longer be associated.')) return;
            await fetch(`/api/v1/links/${id}`,        { method: 'DELETE' });
          }
          const row = overlayEl.querySelector(`.rp-row[data-link-id="${id}"]`);
          if (row) row.remove();
          refreshPill();
        } catch (err) {
          alert('Action failed: ' + (err.message || err));
        }
      });
    }
    overlayEl.classList.add('open');
    document.body.style.overflow = 'hidden';
    const list = overlayEl.querySelector('#rp-list');
    list.innerHTML = '<div class="rp-empty">Loading…</div>';
    const links = await fetchAll();
    if (!links.length) {
      list.innerHTML = `<div class="rp-empty">Nothing to review.<br>Auto-linkers create entries here when they make a medium-confidence guess.</div>`;
    } else {
      list.innerHTML = links.map(renderRow).join('');
    }
  }

  function closeDrawer() {
    if (!overlayEl) return;
    overlayEl.classList.remove('open');
    document.body.style.overflow = '';
  }

  async function refreshPill() {
    const n = await fetchCount();
    if (!pillEl) return;
    if (n > 0) {
      pillEl.classList.remove('hidden');
      pillEl.querySelector('.rp-pill-count').textContent = String(n);
    } else {
      pillEl.classList.add('hidden');
    }
  }

  function install() {
    ensureStyles();
    pillEl = document.createElement('div');
    pillEl.className = 'rp-pill hidden';
    pillEl.title = 'Auto-links flagged for review';
    pillEl.innerHTML = `<span class="rp-pill-icon">🔍</span><span>Needs review</span><span class="rp-pill-count">0</span>`;
    pillEl.addEventListener('click', openDrawer);
    document.body.appendChild(pillEl);
    refreshPill();
    // Refresh every 60s
    pollTimer = setInterval(refreshPill, 60000);
  }

  // Defer install ~2s so page-critical XHRs go first
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => setTimeout(install, 2000));
  } else {
    setTimeout(install, 2000);
  }
})();
