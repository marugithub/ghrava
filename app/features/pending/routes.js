// @ts-nocheck
'use strict';
/**
 * features/pending/routes.js — v.171
 *
 * The Pending Items Report — one report listing every bank
 * transaction that's been imported but doesn't yet have a link to
 * the right record in another module. Detectors run as UNION ALL
 * across the modules they touch, returning a uniform shape so the
 * frontend treats every pending row identically.
 *
 * Public surface (mounted at /api/v1/pending):
 *
 *   GET  /                    list all pending items (filters: module, limit)
 *   GET  /counts              per-module counts (for filter chips)
 *   POST /link                link a transaction to a record
 *                             body: { transaction_id, right_type, right_id,
 *                                     remember_rule, merchant_pattern }
 *   POST /dismiss             "not a [module] expense" — stop asking
 *                             body: { transaction_id, hint }
 *   POST /skip                "skip for now" — snooze N days (default 30)
 *                             body: { transaction_id, days }
 *   GET  /rules               list active merchant→record rules
 *   DELETE /rules/:id         deactivate a merchant rule
 *   GET  /asterisk            derived-number gap probe for any card:
 *                             ?card=vehicle_fuel&record_id=N
 *                             → { color: 'amber'|'red'|null, count, hint }
 *
 * Architectural notes:
 *   - Per-tx ↔ record links go in shared record_links table
 *     (left_type='transaction', left_id=tx.id, right_type=module,
 *     right_id=record_id). SHARED-LNK lock.
 *   - tx_link_rules holds the merchant→record auto-apply rules.
 *   - pending_dismissals tracks user "skip" / "not relevant" so the
 *     same rows don't keep coming back.
 *
 * Schema (verified against SCHEMA.md):
 *   transactions:        id, account_id, date, description, amount,
 *                        category, is_transfer, source, ...
 *   record_links:        left_type, left_id, right_type, right_id,
 *                        link_kind, source, confidence, notes
 *   tx_link_rules:       id, merchant_pattern, category, right_type,
 *                        right_id, auto_apply, is_active, match_count,
 *                        last_matched_at
 *   pending_dismissals:  id, transaction_id, reason, hint,
 *                        snooze_until, dismissed_at
 *   vehicles:            id, nickname, year, make, model, is_active
 *   medications:         id, name, status, patient_id
 *   subscriptions:       id, service_name, name, cost, monthly_cost,
 *                        status
 *   items:               id, name, brand, purchase_price, purchase_date
 *   hsa_payments:        id, date, you_paid, receipt_saved, receipt_location
 *   certifications:      id, cert_name, renewal_fee
 */

const express = require('express');
const router  = express.Router();
const db      = require('../../db/db');
const { requireAuth } = require('../auth/middleware');
const { badRequest, notFound, serverError } = require('../../shared/errors');

// ─── shared helpers ────────────────────────────────────────────────

// Returns the SQL fragment that excludes a transaction if it already
// has any record_links row OR a non-expired dismissal. Used by every
// detector below so each query is self-contained and consistent.
//
// schema: record_links.{left_type, left_id}, pending_dismissals.{transaction_id, reason, snooze_until}
function notYetHandledClause() {
  return `
    AND NOT EXISTS (
      SELECT 1 FROM record_links rl
      WHERE rl.left_type = 'transaction' AND rl.left_id = t.id
    )
    AND NOT EXISTS (
      SELECT 1 FROM pending_dismissals pd
      WHERE pd.transaction_id = t.id
        AND (
          pd.reason IN ('dismissed','not_relevant')
          OR (pd.reason = 'snoozed' AND (pd.snooze_until IS NULL OR pd.snooze_until > date('now')))
        )
    )
  `;
}

// ─── detector queries — each returns the same row shape ───────────
//
// Shape: { source_module, prompt, transaction_id, tx_description,
//          tx_amount, tx_date, suggested_record_id, suggested_label }

// Vehicle fuel: any tx with category 'Fuel' or merchant containing
// known gas-station names that doesn't yet have a vehicle link.
// schema: transactions.{id, description, amount, date, category, is_transfer}
// v.173: optional vehicleId. When supplied, narrow to unhandled fuel
// charges whose description matches an active tx_link_rules row that
// points at THIS vehicle (linked txns are never pending, so the
// rule-match path is the only meaningful per-record signal — see
// TX-RULES lock). Omitting the id preserves the v.171 global behavior.
// schema: tx_link_rules.{merchant_pattern, right_type, right_id, is_active}
function detectVehicleFuel(vehicleId) {
  const params = [];
  let perRecord = '';
  if (vehicleId) {
    perRecord = `
      AND EXISTS (
        SELECT 1 FROM tx_link_rules r
        WHERE r.is_active = 1
          AND r.right_type = 'vehicle'
          AND r.right_id = ?
          AND UPPER(t.description) LIKE '%' || UPPER(REPLACE(r.merchant_pattern,'%','')) || '%'
      )`;
    params.push(vehicleId);
  }
  return db.prepare(`
    SELECT
      'vehicle'              AS source_module,
      'Which car was this fuel for?' AS prompt,
      t.id                   AS transaction_id,
      t.description          AS tx_description,
      t.amount               AS tx_amount,
      t.date                 AS tx_date,
      NULL                   AS suggested_record_id,
      NULL                   AS suggested_label
    FROM transactions t
    WHERE t.is_transfer = 0
      AND t.amount < 0
      AND (
        LOWER(COALESCE(t.category,'')) IN ('fuel','gas','gasoline','transportation')
        OR LOWER(t.description) LIKE '%shell%'
        OR LOWER(t.description) LIKE '%chevron%'
        OR LOWER(t.description) LIKE '%exxon%'
        OR LOWER(t.description) LIKE '%bp %'
        OR LOWER(t.description) LIKE '%mobil%'
        OR LOWER(t.description) LIKE '%marathon%'
        OR LOWER(t.description) LIKE '%speedway%'
        OR LOWER(t.description) LIKE '%circle k%'
        OR LOWER(t.description) LIKE '%7-eleven%'
        OR LOWER(t.description) LIKE '%racetrac%'
        OR LOWER(t.description) LIKE '%wawa%'
      )
      ${notYetHandledClause()}
      ${perRecord}
    ORDER BY t.date DESC
  `).all(...params);
}

// Pharmacy / Rx pickup with no per-Rx cost entered yet. We surface
// pharmacy charges that don't have a medication link.
// schema: transactions.{id,description,amount,date,category,is_transfer}
// v.173: optional medicationId — same per-record shape as fuel above
// (tx_link_rules match for right_type='medication'). Global when omitted.
// schema: tx_link_rules.{merchant_pattern, right_type, right_id, is_active}
function detectMedicalRx(medicationId) {
  const params = [];
  let perRecord = '';
  if (medicationId) {
    perRecord = `
      AND EXISTS (
        SELECT 1 FROM tx_link_rules r
        WHERE r.is_active = 1
          AND r.right_type = 'medication'
          AND r.right_id = ?
          AND UPPER(t.description) LIKE '%' || UPPER(REPLACE(r.merchant_pattern,'%','')) || '%'
      )`;
    params.push(medicationId);
  }
  return db.prepare(`
    SELECT
      'medication'           AS source_module,
      'What did this prescription cost?' AS prompt,
      t.id                   AS transaction_id,
      t.description          AS tx_description,
      t.amount               AS tx_amount,
      t.date                 AS tx_date,
      NULL                   AS suggested_record_id,
      NULL                   AS suggested_label
    FROM transactions t
    WHERE t.is_transfer = 0
      AND t.amount < 0
      AND (
        LOWER(t.description) LIKE '%cvs%'
        OR LOWER(t.description) LIKE '%walgreens%'
        OR LOWER(t.description) LIKE '%rite aid%'
        OR LOWER(t.description) LIKE '%pharmacy%'
        OR LOWER(COALESCE(t.category,'')) IN ('pharmacy','prescriptions','rx')
      )
      ${notYetHandledClause()}
      ${perRecord}
    ORDER BY t.date DESC
  `).all(...params);
}

// Recurring-tx → subscription suggestion. Same description seen 3+
// times in the last 6 months at roughly the same amount, with no
// link to an existing subscription.
// schema: transactions.{id,description,amount,date,is_transfer}
// v.173: optional subscriptionId — restricts candidates to those whose
// sample description matches an active tx_link_rules row for that
// subscription. Not UI-wired this drop; endpoint-level correctness only.
// schema: tx_link_rules.{merchant_pattern, right_type, right_id, is_active}
function detectSubscriptions(subscriptionId) {
  const params = [];
  let perRecord = '';
  if (subscriptionId) {
    perRecord = `
      AND EXISTS (
        SELECT 1 FROM tx_link_rules r
        WHERE r.is_active = 1
          AND r.right_type = 'subscription'
          AND r.right_id = ?
          AND UPPER(c.sample_desc) LIKE '%' || UPPER(REPLACE(r.merchant_pattern,'%','')) || '%'
      )`;
    params.push(subscriptionId);
  }
  return db.prepare(`
    WITH candidates AS (
      SELECT
        LOWER(TRIM(t.description)) AS norm_desc,
        COUNT(*)                   AS hit_count,
        ROUND(AVG(ABS(t.amount)),2) AS avg_amount,
        MAX(t.id)                  AS latest_tx_id,
        MAX(t.date)                AS latest_date,
        MAX(t.description)         AS sample_desc,
        MAX(t.amount)              AS sample_amount
      FROM transactions t
      WHERE t.is_transfer = 0
        AND t.amount < 0
        AND t.date >= date('now','-180 days')
      GROUP BY LOWER(TRIM(t.description))
      HAVING hit_count >= 3
    )
    SELECT
      'subscription'                                        AS source_module,
      'Track this as a subscription?'                       AS prompt,
      c.latest_tx_id                                        AS transaction_id,
      c.sample_desc                                         AS tx_description,
      c.sample_amount                                       AS tx_amount,
      c.latest_date                                         AS tx_date,
      NULL                                                  AS suggested_record_id,
      ('Seen ' || c.hit_count || ' times, avg $' || c.avg_amount) AS suggested_label
    FROM candidates c
    WHERE NOT EXISTS (
        SELECT 1 FROM record_links rl
        WHERE rl.left_type = 'transaction' AND rl.left_id = c.latest_tx_id
      )
      AND NOT EXISTS (
        SELECT 1 FROM pending_dismissals pd
        WHERE pd.transaction_id = c.latest_tx_id
          AND (
            pd.reason IN ('dismissed','not_relevant')
            OR (pd.reason = 'snoozed' AND (pd.snooze_until IS NULL OR pd.snooze_until > date('now')))
          )
      )
      AND NOT EXISTS (
        SELECT 1 FROM subscriptions s
        WHERE LOWER(COALESCE(s.name, '')) LIKE '%' || c.norm_desc || '%'
      )
      ${perRecord}
    ORDER BY c.latest_date DESC
  `).all(...params);
}

// Inventory match: a transaction with a price matching an existing
// item's purchase_price within $1 and within 7 days of purchase_date.
// schema: transactions.{id,description,amount,date,is_transfer}, items.{id,name,purchase_price,purchase_date}
// v.173: optional itemId — narrows the JOIN to a single inventory item.
// Not UI-wired this drop; endpoint-level correctness only.
function detectInventoryMatches(itemId) {
  const params = [];
  let perRecord = '';
  if (itemId) { perRecord = ` AND i.id = ?`; params.push(itemId); }
  return db.prepare(`
    SELECT
      'inventory'                                        AS source_module,
      ('$' || ROUND(ABS(t.amount),2) || ' — link to your ' || i.name || '?') AS prompt,
      t.id                                               AS transaction_id,
      t.description                                      AS tx_description,
      t.amount                                           AS tx_amount,
      t.date                                             AS tx_date,
      i.id                                               AS suggested_record_id,
      i.name                                             AS suggested_label
    FROM transactions t
    JOIN items i
      ON ABS(ABS(t.amount) - i.purchase_price) < 1.00
     AND ABS(julianday(t.date) - julianday(i.purchase_date)) <= 7
    WHERE t.is_transfer = 0
      AND t.amount < 0
      AND i.purchase_price IS NOT NULL
      AND i.purchase_price > 0
      ${notYetHandledClause()}
      ${perRecord}
    ORDER BY t.date DESC
  `).all(...params);
}

// HSA: a transaction marked as medical/HSA category with no link to
// an hsa_payment AND no receipt entry.
// v.173: optional hsaAccountId. Global (v.171) behavior is byte-for-byte
// preserved (exact-date receipt match). Per-record scopes to
// transactions.account_id and widens the receipt match to a ±14-day
// window. "Same patient" from the spec is dropped — neither
// transactions nor hsa_payments carries a patient column (not in schema).
// schema: transactions.{id,account_id,description,amount,date,category,is_transfer}, hsa_payments.{date, you_paid}
function detectHsaReceipts(hsaAccountId) {
  const params = [];
  let accountClause = '';
  let hpDateCond = 'hp.date = t.date';
  if (hsaAccountId) {
    accountClause = ` AND t.account_id = ?`;
    params.push(hsaAccountId);
    hpDateCond = 'ABS(julianday(hp.date) - julianday(t.date)) <= 14';
  }
  return db.prepare(`
    SELECT
      'hsa_payment'                                AS source_module,
      ('Add receipt for $' || ROUND(ABS(t.amount),2) || ' medical expense') AS prompt,
      t.id                                         AS transaction_id,
      t.description                                AS tx_description,
      t.amount                                     AS tx_amount,
      t.date                                       AS tx_date,
      NULL                                         AS suggested_record_id,
      NULL                                         AS suggested_label
    FROM transactions t
    WHERE t.is_transfer = 0
      AND t.amount < 0
      AND LOWER(COALESCE(t.category,'')) IN ('medical','health','healthcare','hsa','dental','vision')
      ${accountClause}
      AND NOT EXISTS (
        SELECT 1 FROM hsa_payments hp
        WHERE ${hpDateCond}
          AND ABS(hp.you_paid - ABS(t.amount)) < 0.50
      )
      ${notYetHandledClause()}
    ORDER BY t.date DESC
  `).all(...params);
}

// Career: cert renewal fee — tx amount matches a cert.renewal_fee.
// schema: transactions.{id,description,amount,date,is_transfer}, certifications.{id,cert_name,renewal_fee}
// v.173: optional certId — narrows the JOIN to a single certification.
// Not UI-wired this drop; endpoint-level correctness only.
function detectCertRenewals(certId) {
  const params = [];
  let perRecord = '';
  if (certId) { perRecord = ` AND c.id = ?`; params.push(certId); }
  return db.prepare(`
    SELECT
      'certification'                                       AS source_module,
      ('$' || ROUND(ABS(t.amount),2) || ' — renewal fee for ' || c.cert_name || '?') AS prompt,
      t.id                                                  AS transaction_id,
      t.description                                         AS tx_description,
      t.amount                                              AS tx_amount,
      t.date                                                AS tx_date,
      c.id                                                  AS suggested_record_id,
      c.cert_name                                           AS suggested_label
    FROM transactions t
    JOIN certifications c
      ON c.renewal_fee IS NOT NULL
     AND ABS(ABS(t.amount) - c.renewal_fee) < 1.00
    WHERE t.is_transfer = 0
      AND t.amount < 0
      ${notYetHandledClause()}
      ${perRecord}
    ORDER BY t.date DESC
  `).all(...params);
}

// ─── aggregate ─────────────────────────────────────────────────────

function listAll() {
  return [
    ...detectVehicleFuel(),
    ...detectMedicalRx(),
    ...detectSubscriptions(),
    ...detectInventoryMatches(),
    ...detectHsaReceipts(),
    ...detectCertRenewals(),
  ].sort((a, b) => (b.tx_date || '').localeCompare(a.tx_date || ''));
}

// ─── routes ────────────────────────────────────────────────────────

// GET /api/v1/pending — all pending items
router.get('/', (req, res) => {
  try {
    const moduleFilter = req.query.module || null;
    const limit        = Math.min(500, parseInt(req.query.limit || '100', 10));
    let items = listAll();
    if (moduleFilter && moduleFilter !== 'all') {
      items = items.filter(r => r.source_module === moduleFilter);
    }
    res.json({ count: items.length, items: items.slice(0, limit) });
  } catch (e) { serverError(res, e); }
});

// GET /api/v1/pending/counts — per-module counts for filter chips
router.get('/counts', (req, res) => {
  try {
    const items = listAll();
    const counts = items.reduce((acc, r) => {
      acc[r.source_module] = (acc[r.source_module] || 0) + 1;
      return acc;
    }, {});
    res.json({ total: items.length, by_module: counts });
  } catch (e) { serverError(res, e); }
});

// POST /api/v1/pending/link — create the link and (optionally) remember the rule
// body: { transaction_id, right_type, right_id, remember_rule, merchant_pattern }
//
// schema: record_links.{left_type, left_id, right_type, right_id, link_kind, source, confidence}
// schema: tx_link_rules.{merchant_pattern, right_type, right_id, auto_apply, is_active}
router.post('/link', requireAuth, (req, res) => {
  try {
    const { transaction_id, right_type, right_id,
            remember_rule = false, merchant_pattern = null } = req.body || {};

    if (!transaction_id || !right_type || !right_id) {
      return badRequest(res, 'transaction_id, right_type, right_id required');
    }

    // schema: transactions.{id, description}
    const tx = db.prepare('SELECT id, description FROM transactions WHERE id = ?').get(transaction_id);
    if (!tx) return notFound(res, 'transaction');

    const linkResult = db.prepare(`
      INSERT INTO record_links (left_type, left_id, right_type, right_id,
                                link_kind, confidence, needs_review, source)
      VALUES ('transaction', ?, ?, ?, 'manual', 'high', 0, 'pending-report')
      ON CONFLICT (left_type, left_id, right_type, right_id, link_kind) DO NOTHING
    `).run(transaction_id, right_type, right_id);

    let ruleId = null;
    if (remember_rule) {
      // Build pattern from the first significant token of the description
      // unless the caller supplied one explicitly. Pattern is a SQL LIKE.
      let pattern = merchant_pattern;
      if (!pattern) {
        const desc = (tx.description || '').toUpperCase().trim();
        const token = desc.split(/\s+/).find(p => p.length >= 3) || desc.slice(0, 20);
        pattern = `%${token}%`;
      }
      const r = db.prepare(`
        INSERT INTO tx_link_rules (merchant_pattern, right_type, right_id, auto_apply, is_active)
        VALUES (?, ?, ?, 1, 1)
      `).run(pattern, right_type, right_id);
      ruleId = r.lastInsertRowid;
    }

    res.json({
      ok: true,
      linked: linkResult.changes > 0,
      link_id: linkResult.lastInsertRowid || null,
      rule_id: ruleId,
    });
  } catch (e) { serverError(res, e); }
});

// POST /api/v1/pending/dismiss — "not a [module] expense"
// body: { transaction_id, hint? }
// schema: pending_dismissals.{transaction_id, reason, hint}
router.post('/dismiss', requireAuth, (req, res) => {
  try {
    const { transaction_id, hint = null } = req.body || {};
    if (!transaction_id) return badRequest(res, 'transaction_id required');
    const r = db.prepare(`
      INSERT INTO pending_dismissals (transaction_id, reason, hint)
      VALUES (?, 'not_relevant', ?)
    `).run(transaction_id, hint);
    res.json({ ok: true, id: r.lastInsertRowid });
  } catch (e) { serverError(res, e); }
});

// POST /api/v1/pending/skip — snooze N days (default 30)
// body: { transaction_id, days? }
// schema: pending_dismissals.{transaction_id, reason, snooze_until}
router.post('/skip', requireAuth, (req, res) => {
  try {
    const { transaction_id, days = 30 } = req.body || {};
    if (!transaction_id) return badRequest(res, 'transaction_id required');
    const r = db.prepare(`
      INSERT INTO pending_dismissals (transaction_id, reason, snooze_until)
      VALUES (?, 'snoozed', date('now','+' || ? || ' days'))
    `).run(transaction_id, Math.max(1, parseInt(days, 10) || 30));
    res.json({ ok: true, id: r.lastInsertRowid });
  } catch (e) { serverError(res, e); }
});

// GET /api/v1/pending/rules — list active merchant rules
// schema: tx_link_rules.{id, merchant_pattern, right_type, right_id, auto_apply, is_active, match_count, last_matched_at, created_at}
router.get('/rules', (req, res) => {
  try {
    const rules = db.prepare(`
      SELECT id, merchant_pattern, category, right_type, right_id,
             auto_apply, is_active, match_count, last_matched_at, created_at
      FROM tx_link_rules
      WHERE is_active = 1
      ORDER BY match_count DESC, created_at DESC
    `).all();
    res.json({ count: rules.length, rules });
  } catch (e) { serverError(res, e); }
});

// DELETE /api/v1/pending/rules/:id — deactivate
router.delete('/rules/:id', requireAuth, (req, res) => {
  try {
    const r = db.prepare(`UPDATE tx_link_rules SET is_active = 0 WHERE id = ?`).run(req.params.id);
    if (r.changes === 0) return notFound(res, 'rule');
    res.json({ ok: true });
  } catch (e) { serverError(res, e); }
});

// v.184 — POST /api/v1/pending/rules — create a rule directly
//
// Used by the Settings → Transaction Link Rules editor "Add rule"
// form. Rules created via POST /link?remember_rule=true are tied to
// a specific transaction; this lets the user create rules ahead of
// time (e.g. "Always send SHELL charges to the 4Runner").
//
// schema: tx_link_rules.{merchant_pattern, right_type, right_id, auto_apply, category, is_active}
router.post('/rules', requireAuth, (req, res) => {
  try {
    const b = req.body || {};
    const merchant_pattern = String(b.merchant_pattern || '').trim();
    const right_type       = String(b.right_type || '').trim();
    const right_id         = parseInt(b.right_id, 10);
    const auto_apply       = b.auto_apply === false ? 0 : 1; // default ON
    const category         = b.category || null;

    if (!merchant_pattern) return badRequest(res, 'merchant_pattern required');
    if (!right_type)       return badRequest(res, 'right_type required');
    if (!right_id)         return badRequest(res, 'right_id required');

    const info = db.prepare(`
      INSERT INTO tx_link_rules (merchant_pattern, category, right_type, right_id,
                                 auto_apply, is_active)
      VALUES (?, ?, ?, ?, ?, 1)
    `).run(merchant_pattern, category, right_type, right_id, auto_apply);

    res.status(201).json(db.prepare(`SELECT * FROM tx_link_rules WHERE id = ?`).get(info.lastInsertRowid));
  } catch (e) { serverError(res, e); }
});

// v.184 — PUT /api/v1/pending/rules/:id — patch an existing rule
//
// PATCH-style semantics: only fields present in the body are updated.
// Used by the Settings → Transaction Link Rules editor's Edit action.
//
// schema: tx_link_rules.{merchant_pattern, right_type, right_id, auto_apply, category, is_active}
router.put('/rules/:id', requireAuth, (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (!id) return badRequest(res, 'invalid id');
    const existing = db.prepare(`SELECT * FROM tx_link_rules WHERE id = ?`).get(id);
    if (!existing) return notFound(res, 'rule');

    const b = req.body || {};
    const next = {
      merchant_pattern: b.merchant_pattern !== undefined ? String(b.merchant_pattern).trim() : existing.merchant_pattern,
      right_type:       b.right_type       !== undefined ? String(b.right_type).trim()       : existing.right_type,
      right_id:         b.right_id         !== undefined ? parseInt(b.right_id, 10)          : existing.right_id,
      auto_apply:       b.auto_apply       !== undefined ? (b.auto_apply ? 1 : 0)            : existing.auto_apply,
      category:         b.category         !== undefined ? (b.category || null)              : existing.category,
      is_active:        b.is_active        !== undefined ? (b.is_active ? 1 : 0)             : existing.is_active,
    };
    if (!next.merchant_pattern) return badRequest(res, 'merchant_pattern required');
    if (!next.right_type)       return badRequest(res, 'right_type required');
    if (!next.right_id)         return badRequest(res, 'right_id required');

    db.prepare(`
      UPDATE tx_link_rules
      SET merchant_pattern = ?, right_type = ?, right_id = ?,
          auto_apply = ?, category = ?, is_active = ?
      WHERE id = ?
    `).run(next.merchant_pattern, next.right_type, next.right_id,
           next.auto_apply, next.category, next.is_active, id);

    res.json(db.prepare(`SELECT * FROM tx_link_rules WHERE id = ?`).get(id));
  } catch (e) { serverError(res, e); }
});

// v.184 — POST /api/v1/pending/rules/backfill — apply rules retroactively
//
// Walks every transaction that doesn't yet have a record_link, runs
// applyRulesToTransaction() per row, and returns the count of new
// links created. Idempotent — re-running is safe (the helper uses
// ON CONFLICT DO NOTHING via record_links unique constraint).
//
// Body: { limit?: number } — caps the scan (default 1000, max 10000).
//
// schema: transactions.{id, description, category};
//         record_links.{left_type, left_id}
router.post('/rules/backfill', requireAuth, (req, res) => {
  try {
    const limit = Math.min(10000, Math.max(1, parseInt((req.body || {}).limit || 1000, 10)));
    const startedAt = Date.now();

    const candidates = db.prepare(`
      SELECT t.id, t.description, t.category
      FROM transactions t
      WHERE NOT EXISTS (
        SELECT 1 FROM record_links rl
        WHERE rl.left_type = 'transaction' AND rl.left_id = t.id
      )
      ORDER BY t.id DESC
      LIMIT ?
    `).all(limit);

    let linked = 0;
    for (const t of candidates) {
      try {
        if (applyRulesToTransaction(t.id, t.description, t.category)) linked++;
      } catch (e) {
        // best-effort; one bad row should not abort the run
      }
    }

    res.json({
      scanned: candidates.length,
      linked,
      elapsed_ms: Date.now() - startedAt,
    });
  } catch (e) { serverError(res, e); }
});

// GET /api/v1/pending/asterisk — gap probe for any card's derived number
//
// Asks "are there pending items related to this record that should
// make the derived number on this record's card display a red or
// amber asterisk?"
//
//   ?card=vehicle_fuel&record_id=N    → vehicle id N: red if there
//                                       are fuel charges unlinked
//                                       at all; amber if a few are
//                                       still tentative.
//   ?card=medication&record_id=N      → med N: red if any pickup tx
//                                       lacks a cost.
//   ?card=hsa_payment&record_id=N     → HSA account N: medical-cat tx
//                                       on that account with no logged
//                                       receipt (±14d). Omit record_id
//                                       for the global probe. red >5,
//                                       amber 1-5.
//
// v.173: record_id is honored for every card. Omitting it preserves
// the v.171 global count (back-compat). Response shape unchanged:
// { card, record_id, color, count, hint }.
//
// schema: see detector queries above
router.get('/asterisk', (req, res) => {
  try {
    const card = req.query.card;
    const recordId = req.query.record_id ? parseInt(req.query.record_id, 10) : null;

    let count = 0;
    let color = null;
    let hint  = '';

    // v.173: recordId is threaded into each detector. When null the
    // detector runs its v.171 global query unchanged (back-compat).
    if (card === 'vehicle_fuel') {
      count = detectVehicleFuel(recordId).length;
      hint  = count + ' fuel charge' + (count === 1 ? '' : 's') + ' still need a car assigned';
      if (count > 5) color = 'red';
      else if (count > 0) color = 'amber';
    } else if (card === 'medication') {
      count = detectMedicalRx(recordId).length;
      hint  = count + ' pharmacy charge' + (count === 1 ? '' : 's') + ' missing cost';
      if (count > 0) color = 'red';
    } else if (card === 'hsa_payment') {
      count = detectHsaReceipts(recordId).length;
      hint  = count + ' medical expense' + (count === 1 ? '' : 's') + ' missing receipt';
      // v.173: mirror the vehicle_fuel tiering — a large backlog is a
      // real gap (red); a handful is just catch-up (amber).
      if (count > 5) color = 'red';
      else if (count > 0) color = 'amber';
    } else if (card === 'subscriptions') {
      count = detectSubscriptions(recordId).length;
      hint  = count + ' recurring charge' + (count === 1 ? '' : 's') + ' might be a subscription';
      if (count > 0) color = 'amber';
    } else if (card === 'inventory') {
      count = detectInventoryMatches(recordId).length;
      hint  = count + ' purchase' + (count === 1 ? '' : 's') + ' could be linked to an inventory item';
      if (count > 0) color = 'amber';
    } else if (card === 'certification') {
      count = detectCertRenewals(recordId).length;
      hint  = count + ' renewal fee' + (count === 1 ? '' : 's') + ' could be linked to a cert';
      if (count > 0) color = 'amber';
    } else {
      return badRequest(res, "unknown card; expected one of: vehicle_fuel, medication, hsa_payment, subscriptions, inventory, certification");
    }

    res.json({ card, record_id: recordId, color, count, hint });
  } catch (e) { serverError(res, e); }
});

// ─── exposed helper for the import auto-apply hook ────────────────
//
// Given a freshly-imported transaction, finds the first active
// matching tx_link_rules row and creates the record_links row.
// Returns true if a rule fired and a link was created.
//
// schema: tx_link_rules.{merchant_pattern, right_type, right_id, is_active, auto_apply, match_count, last_matched_at}
// schema: record_links.{left_type, left_id, right_type, right_id, link_kind, source, confidence}
function applyRulesToTransaction(txId, description, category) {
  if (!txId || !description) return false;
  const rules = db.prepare(`
    SELECT id, merchant_pattern, category, right_type, right_id, auto_apply
    FROM tx_link_rules
    WHERE is_active = 1
      AND auto_apply = 1
  `).all();
  for (const r of rules) {
    const merchantOk = description.toUpperCase().includes(
      r.merchant_pattern.replace(/%/g, '').toUpperCase()
    );
    const catOk = !r.category || (category || '').toLowerCase() === r.category.toLowerCase();
    if (merchantOk && catOk) {
      db.prepare(`
        INSERT INTO record_links (left_type, left_id, right_type, right_id,
                                  link_kind, confidence, needs_review, source)
        VALUES ('transaction', ?, ?, ?, 'auto-rule', 'high', 0, 'tx_link_rules')
        ON CONFLICT (left_type, left_id, right_type, right_id, link_kind) DO NOTHING
      `).run(txId, r.right_type, r.right_id);
      db.prepare(`
        UPDATE tx_link_rules
        SET match_count = match_count + 1,
            last_matched_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(r.id);
      return true;
    }
  }
  return false;
}

module.exports = router;
module.exports.applyRulesToTransaction = applyRulesToTransaction;
