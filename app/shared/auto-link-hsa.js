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
  // accounts.type is the column name (not account_type). v.130 unified
  // accounts table. Values: 'banking' | 'investment' | 'HSA' | 'Other' etc.
  const t = String(account.type || '').toLowerCase();
  const n = String(account.name || account.alias || '').toLowerCase();
  return t === 'hsa' || /\bhsa\b/.test(n);
}

const findTxnStmt = db.prepare(`
  SELECT t.*, a.name AS account_name, a.type AS type, a.alias AS account_alias
  FROM transactions t
  LEFT JOIN accounts a ON a.id = t.account_id
  WHERE t.id = ?
`);

const findExistingHsaStmt = db.prepare(`
  SELECT id FROM hsa_payments
  WHERE family_member_id IS ?
    AND date = ?
    AND ABS(you_paid - ?) < 0.005
    AND provider IS ?
  LIMIT 1
`);

const insertHsaStmt = db.prepare(`
  INSERT INTO hsa_payments (
    family_member_id, date, patient, provider, you_paid, category, notes,
    created_at, updated_at
  ) VALUES (?, ?, 'Self', ?, ?, 'Medical Care', ?, datetime('now'), datetime('now'))
`);

/**
 * Process a single transaction.
 * Returns: { skipped: true } | { linked: hsa_payment_id, confidence: 'high' }
 */
function processTransaction(txnId, opts = {}) {
  const txn = findTxnStmt.get(txnId);
  if (!txn) return { skipped: true, reason: 'txn not found' };
  if (!isHsaAccount(txn)) return { skipped: true, reason: 'not HSA account' };
  // Skip income / positive amounts
  const amt = Math.abs(Number(txn.amount || 0));
  if (amt < 0.01) return { skipped: true, reason: 'zero amount' };

  // transactions has no family_member_id column — leave null. EOB-HSA
  // matcher (#27.3) still works via patient + amount + date.
  const fmId = null;
  // transactions.description is the vendor (no merchant column).
  const provider = txn.description || null;

  // Already an hsa_payment for this txn? Find by exact match shape.
  let existing = findExistingHsaStmt.get(fmId, txn.date, amt, provider);
  if (!existing) {
    const result = insertHsaStmt.run(
      fmId, txn.date, provider, amt,
      `Auto-created from transaction ${txnId} (${provider || 'unknown vendor'})`
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
    notes:     `txn ${provider || ''} $${amt} on ${txn.date}`,
  });

  return { linked: existing.id, confidence: 'high' };
}

module.exports = { processTransaction, isHsaAccount };
