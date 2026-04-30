/**
 * gh-card-config-todos.js — Card config for the todos module.
 *
 * Wired to the shared GH_CARD renderer (gh-card.js).
 * Activated only when ?cards=v2 query param is set, until the flag is flipped.
 *
 * See spec/CARD_SPEC.md for the design rationale.
 */
(function() {
  'use strict';
  if (!window.GH_CARD) {
    console.warn('[todos config] GH_CARD not loaded — skipping registration');
    return;
  }

  // ── Helpers ────────────────────────────────────────────────────
  function todayStr() {
    return new Date().toISOString().slice(0, 10);
  }
  function isOverdue(t) {
    return t.due_date && t.due_date < todayStr();
  }
  function dueLabel(d) {
    if (!d) return '';
    const today = todayStr();
    if (d === today) return 'Due today';
    const dt = new Date(d + 'T00:00');
    const days = Math.round((dt - new Date(today + 'T00:00')) / 86400000);
    if (days < 0) return `${Math.abs(days)}d overdue`;
    if (days === 1) return 'Due tomorrow';
    if (days <= 7) return `Due in ${days} days`;
    return 'Due ' + dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }
  function dueIsUrgent(t) {
    if (!t.due_date) return false;
    return isOverdue(t) || t.due_date === todayStr();
  }
  function statusFor(t) {
    if (t.status === 'done' || t.status === 'dismissed') return 'neutral';
    if (isOverdue(t)) return 'bad';
    if (t.priority === 'urgent') return 'bad';
    if (t.priority === 'high' || t.due_date === todayStr()) return 'warn';
    return 'good';
  }
  const PRIO_ORDER = { urgent: 0, high: 1, medium: 2, low: 3 };
  const PRIO_LABELS = { urgent: 'Urgent', high: 'High', medium: 'Medium', low: 'Low' };
  const PRIO_COLORS = {
    urgent: 'var(--gh-status-bad)',
    high:   'var(--gh-status-warn)',
    medium: 'var(--gh-brand)',
    low:    'var(--gh-status-neutral)',
  };

  // ── Config ─────────────────────────────────────────────────────
  GH_CARD.register('todos', {
    mode: 'compact',

    isDone: (t) => t.status === 'done' || t.status === 'dismissed',

    title: (t) => t.title || '(untitled)',

    compactMeta: (t) => {
      const items = [];
      if (t.due_date) {
        items.push({
          icon: 'clock',
          iconColor: dueIsUrgent(t) ? '#dc2626' : '#94a3b8',
          text: dueLabel(t.due_date),
          urgent: dueIsUrgent(t),
        });
      }
      if (t.priority && t.priority !== 'medium') {
        items.push(PRIO_LABELS[t.priority] || t.priority);
      }
      if (t.category) {
        items.push(t.category);
      }
      return items;
    },

    linkedEntities: (t) => {
      // Family member if assigned, else owner only
      if (t.assigned_family_member_id && window._familyMembersCache) {
        const fm = window._familyMembersCache.find(f => f.id === t.assigned_family_member_id);
        if (fm) {
          return [{
            id: 'fm:' + fm.id,
            type: 'family_member',
            name: ((fm.first_name || '') + ' ' + (fm.last_name || '')).trim() || fm.first_name || '?',
            photoUrl: fm.avatar_attachment_id ? `/api/v1/attachments/${fm.avatar_attachment_id}/thumb` : null,
            onClick: () => {
              // Backlog: family member detail report
              console.log('[todos] family member click — TBD report', fm);
            },
          }];
        }
      }
      return [];
    },

    onToggle: (t) => {
      // Defer to existing toggle handler in todos.html
      const fn = window.toggleDone;
      if (fn) {
        const isChecked = t.status === 'done' || t.status === 'dismissed';
        fn(t.id, isChecked ? 0 : 1);
      }
    },

    onClick: (t) => {
      const fn = window.openDetail || window.openEdit;
      if (fn) fn(t.id);
    },

    onMenu: (t, event) => {
      // Could open context menu — for now, just trigger edit
      const fn = window.openEdit;
      if (fn) fn(t.id);
    },

    // Group by priority — same grouping as the legacy view
    groupBy: (t) => {
      const isDone = t.status === 'done' || t.status === 'dismissed';
      if (isDone) {
        return { key: 'done', label: 'Recently Done', color: 'var(--gh-status-good)' };
      }
      const p = t.priority || 'medium';
      return {
        key: p,
        label: PRIO_LABELS[p] || p,
        color: PRIO_COLORS[p] || 'var(--gh-status-neutral)',
        order: PRIO_ORDER[p] ?? 99,
      };
    },
  });

  console.log('[GH_CARD] todos config registered');
})();
