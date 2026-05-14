// @ts-nocheck
'use strict';
// ─────────────────────────────────────────────────────────────────────
// shared/auto-link-subscription-category.js — v202604.167  (#27.4)
//
// Extends the existing subscription auto-linker (v.157) to ALSO copy
// the subscription's category onto the matched transaction WHEN the
// transaction has no category set.
//
// Two modes:
//  - applyOne(txnId, subscriptionId)  — called by ongoing-link path
//  - runRetroactive(days=90)          — called by manual button in UI;
//                                       walks last N days of txns linked
//                                       to subscriptions and copies cat.
// ─────────────────────────────────────────────────────────────────────

const db = require('../db/db');

const findSubByLinkStmt = db.prepare(`
  SELECT s.id AS subscription_id, s.category, s.merchant
  FROM subscriptions s
  JOIN record_links rl
    ON rl.right_type = 'subscription' AND rl.right_id = s.id
  WHERE rl.left_type = 'transaction' AND rl.left_id = ?
  LIMIT 1
`);

const updateTxnCatStmt = db.prepare(`
  UPDATE transactions
  SET category = ?
  WHERE id = ?
    AND (category IS NULL OR category = '' OR category = 'Uncategorized')
`);

/**
 * For a single transaction, look up linked subscription, copy its
 * category onto the txn if the txn category is empty.
 */
function applyOne(txnId) {
  const sub = findSubByLinkStmt.get(txnId);
  if (!sub || !sub.category) return { skipped: true };
  const r = updateTxnCatStmt.run(sub.category, txnId);
  return { applied: r.changes > 0, category: sub.category, subscription_id: sub.subscription_id };
}

/**
 * Retroactive sweep — last N days of subscription-linked transactions
 * with no category get the subscription's category copied in.
 */
function runRetroactive(days = 90) {
  const cutoff = new Date(Date.now() - days * 86400000).toISOString().slice(0, 10);
  const rows = db.prepare(`
    SELECT t.id AS txn_id, s.category AS sub_category, s.merchant
    FROM transactions t
    JOIN record_links rl ON rl.left_type='transaction' AND rl.left_id=t.id AND rl.right_type='subscription'
    JOIN subscriptions s ON s.id = rl.right_id
    WHERE t.date >= ?
      AND (t.category IS NULL OR t.category = '' OR t.category = 'Uncategorized')
      AND s.category IS NOT NULL AND s.category != ''
  `).all(cutoff);

  let updated = 0;
  for (const r of rows) {
    const u = updateTxnCatStmt.run(r.sub_category, r.txn_id);
    if (u.changes > 0) updated++;
  }
  return { days, candidates: rows.length, updated };
}

module.exports = { applyOne, runRetroactive };
