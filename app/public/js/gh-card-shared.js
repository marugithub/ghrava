/**
 * GH_CARD_SHARED — helpers used by every module's card config.
 *
 * Centralizes formatting, date math, asterisk-state computation, and
 * common entity builders so module configs stay declarative and don't
 * each reinvent these utilities.
 *
 * Loaded once per page that uses GH_CARD. All module configs call into
 * these helpers; nothing here is module-specific.
 *
 * Spec: CARDS_FINAL.md, TRANSACTION_LINKING_SPEC.md
 */
(function() {
  'use strict';

  // ── Date helpers ───────────────────────────────────────────────
  function daysFromToday(dateStr) {
    if (!dateStr) return null;
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return null;
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const target = new Date(d);
      target.setHours(0, 0, 0, 0);
      return Math.round((target - today) / 86400000);
    } catch { return null; }
  }

  function fmtDateShort(s) {
    if (!s) return '';
    try {
      const d = new Date(s);
      if (isNaN(d.getTime())) return s;
      return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    } catch { return s; }
  }

  function fmtDateMedium(s) {
    if (!s) return '';
    try {
      const d = new Date(s);
      if (isNaN(d.getTime())) return s;
      return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    } catch { return s; }
  }

  function dueLabel(dateStr) {
    const d = daysFromToday(dateStr);
    if (d == null) return '';
    if (d < 0) return Math.abs(d) + 'd overdue';
    if (d === 0) return 'Due today';
    if (d === 1) return 'Due tomorrow';
    if (d <= 7) return `Due in ${d} days`;
    return `Due ${fmtDateShort(dateStr)}`;
  }

  function urgencyFromDue(dateStr, opts = {}) {
    const d = daysFromToday(dateStr);
    if (d == null) return 'normal';
    if (d < 0) return 'overdue';
    if (d <= (opts.urgentDays || 3)) return 'urgent';
    if (d <= (opts.highDays || 7)) return 'high';
    return 'normal';
  }

  // ── Money ──────────────────────────────────────────────────────
  function money(n, opts = {}) {
    if (n == null || isNaN(n)) return opts.fallback || '—';
    const abs = Math.abs(n);
    const sign = n < 0 ? '-' : '';
    if (abs >= 1000) {
      return sign + '$' + Math.round(abs).toLocaleString();
    }
    return sign + '$' + abs.toFixed(2);
  }

  function moneyShort(n) {
    if (n == null || isNaN(n)) return '—';
    if (Math.abs(n) >= 1000) return '$' + (n / 1000).toFixed(1) + 'k';
    return '$' + Math.round(n);
  }

  // ── Asterisk computation ─────────────────────────────────────────
  // Returns 'red' | 'amber' | null based on completeness markers.
  // Pass an array of records that contribute to the displayed number.
  // missingFields: array of field names — if any record in the rollup is
  //   missing one of these required fields, returns 'red'.
  // provisionalFields: array of fields — if any record has values flagged as
  //   provisional/auto-categorized, returns 'amber' (only if not red).
  function asteriskState(records, opts = {}) {
    if (!Array.isArray(records) || !records.length) return null;
    const missing = opts.missingFields || [];
    const provisional = opts.provisionalFields || [];

    let red = false, amber = false;
    for (const r of records) {
      for (const f of missing) {
        if (r[f] == null || r[f] === '') { red = true; break; }
      }
      if (!red) {
        for (const f of provisional) {
          if (r[f] === true || r[f] === 1) { amber = true; break; }
        }
      }
      if (red) break;
    }
    return red ? 'red' : (amber ? 'amber' : null);
  }

  // ── Family member entity helper (used by every module) ────────
  // Looks up a family member by ID and returns a card-entity descriptor.
  // Falls back to initials gradient when no avatar is uploaded.
  function familyMemberEntity(id, onClick) {
    const list = window.familyMembers || [];
    const fm = list.find(m => String(m.id) === String(id));
    if (!fm) return null;
    const name = fm.display_name
              || ((fm.first_name || '') + ' ' + (fm.last_name || '')).trim()
              || 'Family member';
    return {
      id: 'fm:' + fm.id,
      type: 'family_member',
      name,
      photoUrl: fm.avatar_attachment_id ? `/api/v1/attachments/${fm.avatar_attachment_id}/thumb` : null,
      onClick: onClick || (() => {}),
    };
  }

  // ── Contact entity helper ────────────────────────────────────
  function contactEntity(contact, onClick) {
    if (!contact) return null;
    return {
      id: 'contact:' + contact.id,
      type: 'contact',
      name: contact.display_name || contact.name || '',
      photoUrl: contact.avatar_attachment_id ? `/api/v1/attachments/${contact.avatar_attachment_id}/thumb` : null,
      brandColor: contact.brand_color || null,
      brandInitials: contact.brand_initials || null,
      onClick: onClick || (() => {
        // Default: open contact detail
        if (window.openContactDetail) window.openContactDetail(contact.id);
      }),
    };
  }

  // ── Brand entity helper (vendors, pharmacies, banks, services) ────
  // For non-contact brand marks. Used when we know the brand but it isn't
  // a separate Contact record.
  function brandEntity(name, brandColor, brandInitials, onClick) {
    return {
      id: 'brand:' + (name || '?'),
      type: 'brand',
      name: name || '',
      brandColor: brandColor || '#475569',
      brandInitials: (brandInitials || (name || '?')).slice(0, 3).toUpperCase(),
      onClick: onClick || (() => {}),
    };
  }

  // ── Derive cross-module rows ────────────────────────────────────
  // Convenience builder: { label, value, asterisk, onClick, tooltip } shape.
  function crossRow(label, value, opts = {}) {
    return {
      label,
      value: value == null ? '—' : value,
      asterisk: opts.asterisk || null,
      asteriskTooltip: opts.asteriskTooltip || null,
      onClick: opts.onClick || null,
      tooltip: opts.tooltip || null,
    };
  }

  // ── Open module on filter ───────────────────────────────────────
  // Standard click handler for cross-module values that should drill into
  // another module's filtered list view.
  function openModuleFiltered(modulePath, params) {
    const qs = new URLSearchParams(params).toString();
    window.location.href = `/${modulePath}.html${qs ? '?' + qs : ''}`;
  }

  // ── Tap-to-copy ─────────────────────────────────────────────────
  function copyToClipboard(text, toastMsg) {
    if (!text) return;
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).catch(() => {});
    } else {
      // Fallback for older contexts (file://, http on some mobile)
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.left = '-9999px';
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand('copy'); } catch {}
      document.body.removeChild(ta);
    }
    if (window.showToast) window.showToast(toastMsg || `Copied: ${text}`);
  }

  window.GH_CARD_SHARED = {
    // dates
    daysFromToday,
    fmtDateShort,
    fmtDateMedium,
    dueLabel,
    urgencyFromDue,
    // money
    money,
    moneyShort,
    // asterisk
    asteriskState,
    // entities
    familyMemberEntity,
    contactEntity,
    brandEntity,
    // cross-module
    crossRow,
    openModuleFiltered,
    // utilities
    copyToClipboard,
  };
})();
