// @ts-nocheck
'use strict';
// ─────────────────────────────────────────────────────────────────────
// shared/auto-link-hsa.js — v202604.167  (linker #27.1)
//
// When a transaction lands on an HSA account, auto-create an hsa_payment
// row and link txn↔hsa_payment via record_links.
//
// HIGH-confidence match (auto-link silently):
//   account.account_type = 'HSA' OR account.name LIKE '%HSA%'
//
// Triggers: on transaction import-confirm + on existing-transaction
// category change to 'medical'. Idempotent.
// ─────────────────────────────────────────────────────────────────────

const db = require('../db/db');
const { createLink, findLink } = require('./auto-link');

function isHsaAccount(account) {
  if (!account) return false;
  const t = String(account.account_type || '').toLowerCase();
  const n = String(account.name || account.nickname || '').toLowerCase();
  return t === 'hsa' || /\bhsa\b/.test(n);
}

const findTxnStmt = db.prepare(`
  SELECT t.*, a.name AS account_name, a.account_type
  FROM transactions t
  LEFT JOIN accounts a ON a.id = t.account_id
  WHERE t.id = ?
`);

const findExistingHsaStmt = db.prepare(`
  SELECT id FROM hsa_payments
  WHERE family_member_id IS ?
    AND payment_date = ?
    AND ABS(you_paid - ?) < 0.005
    AND vendor IS ?
  LIMIT 1
`);

const insertHsaStmt = db.prepare(`
  INSERT INTO hsa_payments (
    family_member_id, payment_date, vendor, you_paid, expense_type, notes,
    created_at, updated_at
  ) VALUES (?, ?, ?, ?, 'medical', ?, datetime('now'), datetime('now'))
`);

/**
 * Process a single transaction.
 * Returns: { skipped: true } | { linked: hsa_payment_id, confidence: 'high' }
 */
function processTransaction(txnId, opts = {}) {
  const txn = findTxnStmt.get(txnId);
  if (!txn) return { skipped: true, reason: 'txn not found' };
  if (!isHsaAccount(txn)) return { skipped: true, reason: 'not HSA account' };
  // Skip income / positive amounts unless explicitly category=medical
  const amt = Math.abs(Number(txn.amount || 0));
  if (amt < 0.01) return { skipped: true, reason: 'zero amount' };

  const fmId = txn.family_member_id || null;
  const vendor = txn.merchant || txn.description || null;

  // Already an hsa_payment for this txn? Find by exact match shape.
  let existing = findExistingHsaStmt.get(fmId, txn.date, amt, vendor);
  if (!existing) {
    const result = insertHsaStmt.run(
      fmId, txn.date, vendor, amt,
      `Auto-created from transaction ${txnId} (${vendor || 'unknown vendor'})`
    );
    existing = { id: result.lastInsertRowid };
  }

  // Create the record_link tying the two records together
  createLink({
    leftType:  'transaction',
    leftId:    txnId,
    rightType: 'hsa_payment',
    rightId:   existing.id,
    kind:      'auto_hsa',
    confidence: 'high',
    source:    'auto-link-hsa',
    notes:     `txn ${vendor || ''} $${amt} on ${txn.date}`,
  });

  return { linked: existing.id, confidence: 'high' };
}

module.exports = { processTransaction, isHsaAccount };
