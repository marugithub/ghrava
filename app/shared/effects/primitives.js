// @ts-nocheck
'use strict';
// ─────────────────────────────────────────────────────────────────────
// shared/effects/primitives.js  (effect dispatcher — the primitive alphabet)
//
// A SMALL, FINITE set of operations — the ONLY code that mutates state for
// a verb. Verbs (data, in verbs.js) compose these. Each primitive exposes:
//
//   apply({ db, targetType, targetId, args, ctx }) -> { before, after, out }
//   reverse({ db, targetType, targetId, before })  -> void
//
//   • before / after : JSON-able snapshots stored on the action_effect row.
//                      Reverse restores `before`.
//   • out            : optional values merged into the dispatcher ctx so a
//                      later effect's `when` can react (e.g. resulting_qty).
//
// See docs/superpowers/plans/2026-05-29-effect-dispatcher-design.md §1.
// ─────────────────────────────────────────────────────────────────────

// entity_type → physical table. Extend as verbs reach new subjects.
const TABLE = {
  item:    'items',
  perfume: 'perfumes',
  book:    'books',
};

// Columns a `set_field` effect is permitted to write, per table. Guards
// against arbitrary-column writes; keep this tight and intentional.
const SETTABLE = {
  items: new Set([
    'donated_fmv', 'donated_org_contact_id',
    'discarded_reason',
    'wardrobe_status', 'wardrobe_status_notes',
  ]),
};

function tableFor(targetType) {
  const t = TABLE[targetType];
  if (!t) throw new Error(`effects: unknown target_type '${targetType}'`);
  return t;
}

const primitives = {

  // ── decrement_qty ───────────────────────────────────────────────────
  // Subtract n (default 1) from quantity, floored at 0. Emits resulting_qty
  // into ctx so a conditional archive can fire when stock hits zero.
  decrement_qty: {
    apply({ db, targetType, targetId, args }) {
      const table = tableFor(targetType);
      const n = Number(args.n != null ? args.n : 1);
      if (!Number.isFinite(n) || n <= 0) throw new Error('decrement_qty: n must be > 0');
      const row = db.prepare(`SELECT quantity FROM ${table} WHERE id=?`).get(targetId);
      if (!row) throw new Error(`decrement_qty: ${targetType} ${targetId} not found`);
      const current = Number(row.quantity != null ? row.quantity : 1);
      const next = Math.max(0, current - n);
      db.prepare(`UPDATE ${table} SET quantity=?, updated_at=CURRENT_TIMESTAMP WHERE id=?`).run(next, targetId);
      return { before: { quantity: current }, after: { quantity: next }, out: { resulting_qty: next } };
    },
    reverse({ db, targetType, targetId, before }) {
      const table = tableFor(targetType);
      db.prepare(`UPDATE ${table} SET quantity=?, updated_at=CURRENT_TIMESTAMP WHERE id=?`).run(before.quantity, targetId);
    },
  },

  // ── archive ─────────────────────────────────────────────────────────
  archive: {
    apply({ db, targetType, targetId, args }) {
      const table = tableFor(targetType);
      const before = db.prepare(`SELECT is_archived, archived_at, archived_reason FROM ${table} WHERE id=?`).get(targetId);
      if (!before) throw new Error(`archive: ${targetType} ${targetId} not found`);
      db.prepare(`UPDATE ${table} SET is_archived=1, archived_at=CURRENT_TIMESTAMP, archived_reason=?, updated_at=CURRENT_TIMESTAMP WHERE id=?`)
        .run(args.reason || 'archived', targetId);
      const after = db.prepare(`SELECT is_archived, archived_at, archived_reason FROM ${table} WHERE id=?`).get(targetId);
      return { before, after };
    },
    reverse({ db, targetType, targetId, before }) {
      const table = tableFor(targetType);
      db.prepare(`UPDATE ${table} SET is_archived=?, archived_at=?, archived_reason=?, updated_at=CURRENT_TIMESTAMP WHERE id=?`)
        .run(before.is_archived, before.archived_at, before.archived_reason, targetId);
    },
  },

  // ── set_field ───────────────────────────────────────────────────────
  // Write ONE allow-listed field. Skips silently when value is null/undefined
  // (so optional payload fields don't clobber existing data with null).
  set_field: {
    apply({ db, targetType, targetId, args }) {
      const table = tableFor(targetType);
      const { field, value } = args;
      if (value === null || value === undefined) return { before: null, after: null, skipped: true };
      const allow = SETTABLE[table];
      if (!allow || !allow.has(field)) throw new Error(`set_field: '${field}' not settable on ${table}`);
      const before = db.prepare(`SELECT ${field} AS v FROM ${table} WHERE id=?`).get(targetId);
      if (!before) throw new Error(`set_field: ${targetType} ${targetId} not found`);
      db.prepare(`UPDATE ${table} SET ${field}=?, updated_at=CURRENT_TIMESTAMP WHERE id=?`).run(value, targetId);
      return { before: { field, value: before.v }, after: { field, value } };
    },
    reverse({ db, targetType, targetId, before }) {
      if (!before) return;
      const table = tableFor(targetType);
      db.prepare(`UPDATE ${table} SET ${before.field}=?, updated_at=CURRENT_TIMESTAMP WHERE id=?`).run(before.value, targetId);
    },
  },

  // ── log_event ───────────────────────────────────────────────────────
  // Append to the entity's event log (the per-record memory layer). Today
  // only `item` has an event table (item_events); other types record the
  // fact in the action ledger alone (no-op here). Reverse deletes the row.
  log_event: {
    apply({ db, targetType, targetId, args }) {
      if (targetType !== 'item') return { before: null, after: null, skipped: true };
      const info = db.prepare(`
        INSERT INTO item_events (item_id, event_type, new_value, notes, created_by)
        VALUES (?, ?, ?, ?, ?)
      `).run(targetId, args.event || 'event', args.value != null ? String(args.value) : null, args.note || null, 'effect-dispatcher');
      return { before: null, after: { event_id: info.lastInsertRowid } };
    },
    reverse({ db, after }) {
      if (after && after.event_id) db.prepare(`DELETE FROM item_events WHERE id=?`).run(after.event_id);
    },
  },
};

module.exports = { primitives, TABLE, SETTABLE };
