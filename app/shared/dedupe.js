// @ts-check
'use strict';
/**
 * shared/dedupe.js
 *
 * v202604.140 — Smart duplicate detection for modules where duplicates
 * have real cost (financial integrity, IRS audit risk, clinical record
 * pollution).
 *
 * Each finder returns the matching record id (number) or null.
 *
 * Design rules:
 *   - Functions are pure reads — no INSERTs, no side effects
 *   - Return null on missing args rather than throwing — caller decides
 *   - Match on the smallest set of fields that constitute a "same record"
 *   - Date matches use a tolerance window (configurable per finder)
 *
 * Modules that DON'T use this (file-hash dedup at watcher level is
 * sufficient):
 *   inventory, wardrobe, perfume, kids, daily-log, todos, books, career,
 *   property, resources, documents
 *
 * Calling pattern:
 *   const dup = findReceiptDuplicate({ pot:'hsa', date, vendor_contact_id, amount, patient });
 *   if (dup) return res.status(409).json({ duplicate_of: dup, warning: '...' });
 *   // user can re-POST with `force_duplicate: true` to override
 */

const db = require('../db/db');

// ── Helpers ─────────────────────────────────────────────────────

/**
 * Returns true if both dates fall within `days` of each other.
 * Both dates expected as 'YYYY-MM-DD' strings.
 */
function _withinDays(d1, d2, days) {
  if (!d1 || !d2) return false;
  const t1 = new Date(d1).getTime();
  const t2 = new Date(d2).getTime();
  if (isNaN(t1) || isNaN(t2)) return false;
  return Math.abs(t1 - t2) <= days * 86400 * 1000;
}

/** Round to cents to avoid float-equality misses ($42.18 === 42.18). */
function _cents(n) {
  if (n == null) return null;
  return Math.round(Number(n) * 100);
}

// ── Finders ─────────────────────────────────────────────────────

/**
 * Receipt (HSA or LP-FSA payment).
 * Match window: ±1 day on date (handles timezone slip on uploads).
 *
 * @param {{pot:string, date:string, vendor_contact_id?:number|null, amount:number, patient?:string|null}} args
 * @returns {number|null}
 */
function findReceiptDuplicate(args) {
  if (!args || !args.date || args.amount == null) return null;
  const table = args.pot === 'fsa' ? 'fsa_payments' : 'hsa_payments';
  const cents = _cents(args.amount);

  // Pull a small candidate set and filter in JS — keeps the SQL simple
  // and lets us use _withinDays() consistently.
  const candidates = db.prepare(`
    SELECT id, date, vendor_contact_id, amount, patient
    FROM ${table}
    WHERE ABS(julianday(date) - julianday(?)) <= 1
      AND ROUND(amount * 100) = ?
      AND (status IS NULL OR status != 'draft')
  `).all(args.date, cents);

  for (const c of candidates) {
    if (args.vendor_contact_id != null && c.vendor_contact_id !== args.vendor_contact_id) continue;
    if (args.patient && c.patient && c.patient !== args.patient) continue;
    return c.id;
  }
  return null;
}

/**
 * EOB claim — match by external claim_id when available, else fall back
 * to (patient + service_date) joining claims to services.
 *
 * Note: claim_id on med_eob_claims is the EXTERNAL claim number from
 * the EOB document (not a foreign key). service_date lives on the
 * line-item table med_eob_services, not on the claim itself.
 *
 * @param {{patient:string, service_date?:string|null, claim_number?:string|null}} args
 * @returns {number|null}
 */
function findEobDuplicate(args) {
  if (!args || !args.patient) return null;

  if (args.claim_number) {
    const byClaim = db.prepare(`
      SELECT id FROM med_eob_claims WHERE claim_id = ? LIMIT 1
    `).get(args.claim_number);
    if (byClaim) return byClaim.id;
  }

  if (!args.service_date) return null;

  // Match a claim that has a service line on the given date for the same patient
  const candidate = db.prepare(`
    SELECT c.id
    FROM med_eob_claims c
    JOIN med_eob_services s ON s.claim_id = c.id
    WHERE c.patient = ? AND s.service_date = ?
    LIMIT 1
  `).get(args.patient, args.service_date);
  return candidate ? candidate.id : null;
}

/**
 * Bank/credit transaction — match by account + date + amount + description.
 * Description match is exact (the bank's own export wording is stable).
 *
 * @param {{account_id:number, date:string, amount:number, description?:string|null}} args
 * @returns {number|null}
 */
function findTransactionDuplicate(args) {
  if (!args || !args.account_id || !args.date || args.amount == null) return null;
  const cents = _cents(args.amount);
  const candidate = db.prepare(`
    SELECT id FROM finance_transactions
    WHERE account_id = ?
      AND date = ?
      AND ROUND(amount * 100) = ?
      AND (? IS NULL OR description = ?)
    LIMIT 1
  `).get(args.account_id, args.date, cents, args.description || null, args.description || null);
  return candidate ? candidate.id : null;
}

/**
 * Medical visit (note) — match by patient + date + provider.
 *
 * @param {{patient:string, date:string, provider_contact_id?:number|null}} args
 * @returns {number|null}
 */
function findVisitDuplicate(args) {
  if (!args || !args.patient || !args.date) return null;
  const candidates = db.prepare(`
    SELECT id, contact_id
    FROM med_visit_notes
    WHERE patient = ? AND visit_date = ?
  `).all(args.patient, args.date);

  for (const c of candidates) {
    if (args.provider_contact_id != null && c.contact_id !== args.provider_contact_id) continue;
    return c.id;
  }
  return null;
}

/**
 * Prescription — match by patient + name + fill_date (or start_date).
 *
 * @param {{patient:string, name:string, fill_date?:string|null}} args
 * @returns {number|null}
 */
function findRxDuplicate(args) {
  if (!args || !args.patient || !args.name) return null;
  // med_medications uses start_date (no separate fill_date field today)
  const candidate = db.prepare(`
    SELECT id FROM med_medications
    WHERE patient = ? AND name = ?
      AND (? IS NULL OR start_date = ?)
    LIMIT 1
  `).get(args.patient, args.name, args.fill_date || null, args.fill_date || null);
  return candidate ? candidate.id : null;
}

/**
 * Subscription — match by name (case-insensitive).
 *
 * @param {{name:string}} args
 * @returns {number|null}
 */
function findSubscriptionDuplicate(args) {
  if (!args || !args.name) return null;
  const candidate = db.prepare(`
    SELECT id FROM subscriptions
    WHERE LOWER(TRIM(name)) = LOWER(TRIM(?))
    LIMIT 1
  `).get(args.name);
  return candidate ? candidate.id : null;
}

/**
 * Insurance policy — match by policy_number (case-insensitive, trimmed).
 *
 * @param {{policy_number:string}} args
 * @returns {number|null}
 */
function findInsuranceDuplicate(args) {
  if (!args || !args.policy_number) return null;
  const candidate = db.prepare(`
    SELECT id FROM insurance_policies
    WHERE LOWER(TRIM(policy_number)) = LOWER(TRIM(?))
    LIMIT 1
  `).get(args.policy_number);
  return candidate ? candidate.id : null;
}

// ── Build a friendly warning message from a hit ─────────────────

/**
 * Generates a user-facing warning for any duplicate-finder result.
 * Frontend shows this in a confirm dialog. User can save anyway.
 *
 * @param {string} kind  e.g. 'receipt', 'eob', 'transaction'
 * @param {number} id    matching record id
 * @param {string} [extra]
 */
function warningFor(kind, id, extra) {
  const noun = {
    receipt: 'receipt',
    eob: 'EOB claim',
    transaction: 'transaction',
    visit: 'medical visit',
    rx: 'prescription',
    subscription: 'subscription',
    insurance: 'insurance policy',
  }[kind] || 'record';
  let msg = `This looks like a duplicate of ${noun} #${id}.`;
  if (extra) msg += ` ${extra}`;
  msg += ' Save anyway?';
  return msg;
}

module.exports = {
  findReceiptDuplicate,
  findEobDuplicate,
  findTransactionDuplicate,
  findVisitDuplicate,
  findRxDuplicate,
  findSubscriptionDuplicate,
  findInsuranceDuplicate,
  warningFor,
  _withinDays,  // exported for tests
  _cents,
};
