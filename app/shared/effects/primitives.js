// @ts-nocheck
'use strict';
// ─────────────────────────────────────────────────────────────────────
// shared/effects/primitives.js  (effect dispatcher — the primitive alphabet)
//
// A SMALL, FINITE set of operations — the ONLY code that mutates state for
// a verb. Verbs (data, in verbs.js) compose these. Each primitive exposes:
//
//   apply({ db, targetType, targetId, args, ctx }) -> { before, after, out, skipped }
//   reverse({ db, targetType, targetId, before, after })  -> void
//
//   • before / after : JSON-able snapshots stored on the action_effect row.
//                      Reverse restores `before`.
//   • out            : optional values merged into the dispatcher ctx so a
//                      later effect's `when` can react (resulting_qty, no_qty).
//   • skipped        : effect was a no-op for this entity (recorded, not applied).
//
// GENERIC ACROSS ENTITY TYPES (v.214): each entity declares HOW it stores
// quantity / archival / events in ENTITY below. The primitives read that
// config, so the same verb (e.g. `discard`) works on items, books, perfumes
// without per-type code. See docs/.../2026-05-29-effect-dispatcher-design.md §1.
// ─────────────────────────────────────────────────────────────────────

// Per-entity lifecycle config. `archive` is an ordered list of column writes;
// value tokens: '@now'→CURRENT_TIMESTAMP, '@today'→CURRENT_DATE, '@reason'→
// args.reason, anything else = literal. Reverse restores the captured snapshot.
const ENTITY = {
  item: {
    table: 'items', qtyCol: 'quantity', hasEventLog: true,
    settable: new Set(['donated_fmv', 'donated_org_contact_id', 'discarded_reason',
                       'wardrobe_status', 'wardrobe_status_notes']),
    archive: [
      { col: 'is_archived',     value: 1 },
      { col: 'archived_at',     value: '@now' },
      { col: 'archived_reason', value: '@reason' },
    ],
  },
  book: {
    table: 'books', qtyCol: null, hasEventLog: false, settable: new Set(),
    archive: [
      { col: 'is_active',            value: 0 },
      { col: 'physical_status',      value: '@reason' },
      { col: 'physical_status_date', value: '@today' },
    ],
  },
  perfume: {
    table: 'perfumes', qtyCol: null, hasEventLog: false, settable: new Set(),
    archive: [
      { col: 'status', value: 'archived' },
    ],
  },
};

function entityFor(targetType) {
  const e = ENTITY[targetType];
  if (!e) throw new Error(`effects: unknown target_type '${targetType}'`);
  return e;
}

const primitives = {

  // ── decrement_qty ───────────────────────────────────────────────────
  // Subtract n (default 1), floored at 0. No-op for entities without a
  // quantity column (book/perfume) — emits {no_qty:true} so a conditional
  // archive can still fire. Emits resulting_qty for the same purpose.
  decrement_qty: {
    apply({ db, targetType, targetId, args }) {
      const e = entityFor(targetType);
      if (!e.qtyCol) return { before: null, after: null, skipped: true, out: { no_qty: true } };
      const n = Number(args.n != null ? args.n : 1);
      if (!Number.isFinite(n) || n <= 0) throw new Error('decrement_qty: n must be > 0');
      const row = db.prepare(`SELECT ${e.qtyCol} AS q FROM ${e.table} WHERE id=?`).get(targetId);
      if (!row) throw new Error(`decrement_qty: ${targetType} ${targetId} not found`);
      const current = Number(row.q != null ? row.q : 1);
      const next = Math.max(0, current - n);
      db.prepare(`UPDATE ${e.table} SET ${e.qtyCol}=?, updated_at=CURRENT_TIMESTAMP WHERE id=?`).run(next, targetId);
      return { before: { quantity: current }, after: { quantity: next }, out: { resulting_qty: next } };
    },
    reverse({ db, targetType, targetId, before }) {
      if (!before) return;
      const e = entityFor(targetType);
      db.prepare(`UPDATE ${e.table} SET ${e.qtyCol}=?, updated_at=CURRENT_TIMESTAMP WHERE id=?`).run(before.quantity, targetId);
    },
  },

  // ── archive ─────────────────────────────────────────────────────────
  // Per-entity archival (items: is_archived; books: is_active+physical_status;
  // perfumes: status). Snapshots the affected columns for clean reversal.
  archive: {
    apply({ db, targetType, targetId, args }) {
      const e = entityFor(targetType);
      const sel = e.archive.map(c => c.col).join(', ');
      const before = db.prepare(`SELECT ${sel} FROM ${e.table} WHERE id=?`).get(targetId);
      if (!before) throw new Error(`archive: ${targetType} ${targetId} not found`);
      const sets = [], params = [];
      for (const c of e.archive) {
        if (c.value === '@now')        { sets.push(`${c.col}=CURRENT_TIMESTAMP`); }
        else if (c.value === '@today') { sets.push(`${c.col}=CURRENT_DATE`); }
        else if (c.value === '@reason'){ sets.push(`${c.col}=?`); params.push(args.reason || 'discarded'); }
        else                           { sets.push(`${c.col}=?`); params.push(c.value); }
      }
      sets.push('updated_at=CURRENT_TIMESTAMP');
      params.push(targetId);
      db.prepare(`UPDATE ${e.table} SET ${sets.join(', ')} WHERE id=?`).run(...params);
      const after = db.prepare(`SELECT ${sel} FROM ${e.table} WHERE id=?`).get(targetId);
      return { before, after };
    },
    reverse({ db, targetType, targetId, before }) {
      if (!before) return;
      const e = entityFor(targetType);
      const cols = Object.keys(before);
      const sets = cols.map(c => `${c}=?`).concat('updated_at=CURRENT_TIMESTAMP');
      db.prepare(`UPDATE ${e.table} SET ${sets.join(', ')} WHERE id=?`).run(...cols.map(c => before[c]), targetId);
    },
  },

  // ── set_field ───────────────────────────────────────────────────────
  // Write ONE allow-listed field for the entity. Skips when value is
  // null/undefined (so optional payload fields don't clobber data with null).
  set_field: {
    apply({ db, targetType, targetId, args }) {
      const e = entityFor(targetType);
      const { field, value } = args;
      if (value === null || value === undefined) return { before: null, after: null, skipped: true };
      if (!e.settable.has(field)) throw new Error(`set_field: '${field}' not settable on ${e.table}`);
      const before = db.prepare(`SELECT ${field} AS v FROM ${e.table} WHERE id=?`).get(targetId);
      if (!before) throw new Error(`set_field: ${targetType} ${targetId} not found`);
      db.prepare(`UPDATE ${e.table} SET ${field}=?, updated_at=CURRENT_TIMESTAMP WHERE id=?`).run(value, targetId);
      return { before: { field, value: before.v }, after: { field, value } };
    },
    reverse({ db, targetType, targetId, before }) {
      if (!before) return;
      const e = entityFor(targetType);
      db.prepare(`UPDATE ${e.table} SET ${before.field}=?, updated_at=CURRENT_TIMESTAMP WHERE id=?`).run(before.value, targetId);
    },
  },

  // ── log_event ───────────────────────────────────────────────────────
  // Append to the entity's event log (the per-record memory layer). Only
  // `item` has an event table today; other types record the fact in the
  // action ledger alone (no-op here). Reverse deletes the row.
  log_event: {
    apply({ db, targetType, targetId, args }) {
      const e = entityFor(targetType);
      if (!e.hasEventLog) return { before: null, after: null, skipped: true };
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

module.exports = { primitives, ENTITY };
