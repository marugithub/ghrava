// @ts-nocheck
'use strict';
// ─────────────────────────────────────────────────────────────────────
// shared/auto-link-medical-visit.js — v202604.167  (linker #27.2)
//
// Link a transaction to a medical_visit when the vendor matches a
// care-team contact and the dates align.
//
// HIGH-confidence (auto-link silently):
//   transactions.description exact-match (case-insensitive trim) on
//   contacts.name WHERE contact_type='Medical'  (v.181 doc fix:
//   prior comment said type='medical_provider' which was never the
//   value either producer or consumer used. Both seed-routes.js:69
//   and the query on line 33 below use contact_type='Medical'.)
//   AND a med_visit_notes exists with visit_date within ±7d of txn.date
//   for the same family member (when known).
//
// MEDIUM-confidence (auto-link + needs_review=1):
//   Same contact match, but no visit within ±7d (still link to most
//   recent visit with that provider). Useful for catching mis-typed
//   visit dates.
// ─────────────────────────────────────────────────────────────────────

const db = require('../db/db');
const { createLink } = require('./auto-link');

const norm = (s) => String(s || '').trim().toLowerCase();

const findTxnStmt = db.prepare(`
  SELECT t.* FROM transactions t WHERE t.id = ?
`);

const findContactStmt = db.prepare(`
  SELECT id, name FROM contacts
  WHERE LOWER(TRIM(name)) = ?
    AND contact_type = 'Medical'
  LIMIT 1
`);

// Find visits matching this contact (via physician_contact_id) — no
// family_member filter since transactions don't carry one. Returns
// candidate visits ordered newest-first; we pick the closest by date.
const findVisitsStmt = db.prepare(`
  SELECT v.id, v.visit_date, v.family_member_id, v.physician_contact_id
  FROM med_visit_notes v
  WHERE v.physician_contact_id = ?
  ORDER BY v.visit_date DESC
  LIMIT 50
`);

function daysBetween(a, b) {
  if (!a || !b) return Infinity;
  const ms = Math.abs(new Date(a) - new Date(b));
  return ms / 86400000;
}

function processTransaction(txnId) {
  const txn = findTxnStmt.get(txnId);
  if (!txn) return { skipped: true, reason: 'txn not found' };
  // transactions.description is the vendor (no merchant column).
  const vendor = norm(txn.description);
  if (!vendor) return { skipped: true, reason: 'no vendor' };

  const contact = findContactStmt.get(vendor);
  if (!contact) return { skipped: true, reason: 'no care-team match' };

  const visits = findVisitsStmt.all(contact.id);
  if (visits.length === 0) return { skipped: true, reason: 'no visits with this provider' };

  // Find closest visit by date
  let best = null;
  for (const v of visits) {
    const d = daysBetween(txn.date, v.visit_date);
    if (best == null || d < best.distance) best = { visit: v, distance: d };
  }

  const confidence = best.distance <= 7 ? 'high' : 'medium';
  createLink({
    leftType:  'transaction',
    leftId:    txnId,
    rightType: 'medical_visit',
    rightId:   best.visit.id,
    kind:      'auto_visit',
    confidence,
    source:    'auto-link-medical-visit',
    notes:     `txn ${txn.date} vs visit ${best.visit.visit_date} (Δ ${Math.round(best.distance)}d, provider ${contact.name})`,
  });

  return { linked: best.visit.id, confidence, distance_days: Math.round(best.distance) };
}

module.exports = { processTransaction };
