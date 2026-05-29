// @ts-nocheck
'use strict';
// ─────────────────────────────────────────────────────────────────────
// shared/effects/verbs.js  (effect dispatcher — the verb registry)
//
// DATA, not code. Each verb composes primitives from primitives.js. Adding
// a capability = adding an entry here, NOT writing new mutation code.
//
//   subjects   : entity types this verb accepts ('item' serves inventory
//                AND wardrobe — both are rows in `items`).
//   effects[]  : ordered primitive invocations.
//       op         primitive name
//       args       literal values or `$name` refs into the call payload
//       when       optional guard ('qty_reaches_zero')
//       confidence 'auto' (default) applies now | 'review' holds for confirm
//   reversible : whether reverseAction() may undo it (default true).
//
// Design: docs/superpowers/plans/2026-05-29-effect-dispatcher-design.md §3.
// Locked core verbs: docs/CROSS-MODULE-VERBS.md §4.
// ─────────────────────────────────────────────────────────────────────

module.exports = {

  // Donate n units. User-entered FMV is recorded on the item (the tax
  // report PULLs/sums it — we do not push a running total). When stock
  // reaches zero the item archives with reason 'donated'.
  donate: {
    subjects: ['item'],
    reversible: true,
    effects: [
      { op: 'decrement_qty', args: { n: '$qty' } },
      { op: 'set_field',     args: { field: 'donated_fmv',            value: '$fmv' } },
      { op: 'set_field',     args: { field: 'donated_org_contact_id', value: '$org_contact_id' } },
      { op: 'archive',       args: { reason: 'donated' }, when: 'qty_reaches_zero' },
      { op: 'log_event',     args: { event: 'donated', note: '$note' } },
    ],
  },

  // Consume n units (parts used, supplies depleted). Pure quantity move +
  // memory; archives when stock hits zero.
  consume: {
    subjects: ['item'],
    reversible: true,
    effects: [
      { op: 'decrement_qty', args: { n: '$qty' } },
      { op: 'archive',       args: { reason: 'consumed' }, when: 'qty_reaches_zero' },
      { op: 'log_event',     args: { event: 'consumed', note: '$reason' } },
    ],
  },

  // Discard / trash with a reason. GENERIC across entity types — the same
  // verb serves items (decrement → archive on zero), and books/perfumes
  // (no quantity → archive immediately via their own lifecycle column).
  // The archive primitive carries the reason per entity; log_event is a
  // no-op for non-item subjects. Proves the (entity_type, id) design.
  discard: {
    subjects: ['item', 'book', 'perfume'],
    reversible: true,
    effects: [
      { op: 'decrement_qty', args: { n: '$qty' } },                          // no-op for book/perfume
      { op: 'archive',       args: { reason: '$reason' }, when: 'zero_or_no_qty' },
      { op: 'log_event',     args: { event: 'discarded', note: '$reason' } },// no-op for book/perfume
    ],
  },
};
