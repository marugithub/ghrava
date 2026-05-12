// @ts-check
'use strict';
// ═════════════════════════════════════════════════════════════════
// shared/auto-link-subscriptions.js  (v202604.157)
//
// On every successful transaction insert from an import batch, check
// whether the row plausibly matches an active subscription and, if
// so, create a `record_links` row of kind 'pays_for' between the
// transaction and the subscription.
//
// Match rule (deliberately conservative — false positives are
// annoying, false negatives just cost a manual click):
//   1. Subscription must be active (is_active=1).
//   2. Subscription.monthly_amount within ±5% of |transaction.amount|.
//      Daily/weekly/yearly billing periods skipped for now — those
//      need a heavier rules engine.
//   3. Subscription.name (or alias if present) appears as a
//      whitespace-bounded token in the normalized transaction
//      description (uppercased, leading bank prefixes stripped via
//      shared normalizer).
//   4. Transaction amount is negative (it's a debit) and
//      is_transfer = 0.
//
// If the link table doesn't exist (older install, mig 129 not run
// yet), the function returns 0 silently.
//
// Returns: number of new links created.
// ═════════════════════════════════════════════════════════════════

const db = require('../db/db');
const { normalizeDescription } = require('./tx-fingerprint');

let _subscriptionsCache = null;
let _cacheLoadedAt = 0;
const CACHE_TTL_MS = 60_000;

function loadActiveSubscriptions() {
  const now = Date.now();
  if (_subscriptionsCache && (now - _cacheLoadedAt) < CACHE_TTL_MS) {
    return _subscriptionsCache;
  }
  try {
    const rows = db.prepare(`
      SELECT id, name, monthly_amount, billing_frequency
      FROM subscriptions
      WHERE is_active = 1 AND monthly_amount IS NOT NULL AND monthly_amount > 0
    `).all();
    _subscriptionsCache = rows.map(r => ({
      id:    r.id,
      name:  r.name,
      // Tokens for matching: split on whitespace + non-alphanumeric.
      tokens: (r.name || '').toUpperCase().split(/[^A-Z0-9]+/).filter(t => t.length >= 3),
      amount: parseFloat(r.monthly_amount),
    }));
    _cacheLoadedAt = now;
    return _subscriptionsCache;
  } catch (e) {
    // Older install with no subscriptions table — return empty.
    _subscriptionsCache = [];
    _cacheLoadedAt = now;
    return _subscriptionsCache;
  }
}

function autoLinkTransaction(txnId, txn) {
  // Defensive: skip if record_links doesn't exist yet.
  try {
    const has = db.prepare(
      `SELECT 1 FROM sqlite_master WHERE type='table' AND name='record_links'`
    ).get();
    if (!has) return 0;
  } catch { return 0; }

  // Only auto-link debits that aren't transfers.
  if (txn.is_transfer) return 0;
  const amt = Math.abs(parseFloat(txn.amount));
  if (!isFinite(amt) || amt <= 0) return 0;
  if (parseFloat(txn.amount) > 0) return 0;  // credit, skip

  const subs = loadActiveSubscriptions();
  if (!subs.length) return 0;

  const desc = normalizeDescription(txn.description || '');
  if (!desc) return 0;

  const insertLink = db.prepare(`
    INSERT INTO record_links (left_type, left_id, right_type, right_id, link_kind, notes)
    VALUES ('subscription', ?, 'transaction', ?, 'pays_for', '[auto-linked]')
  `);

  let linked = 0;
  for (const s of subs) {
    if (!s.tokens.length) continue;
    // Amount within ±5%.
    const lo = s.amount * 0.95;
    const hi = s.amount * 1.05;
    if (amt < lo || amt > hi) continue;
    // Any token appears in the description.
    const hit = s.tokens.some(t => desc.includes(t));
    if (!hit) continue;

    try {
      // Canonical order: 'subscription' < 'transaction' alphabetically,
      // so subscription is always left side. Matches POST /links logic.
      insertLink.run(s.id, txnId);
      linked++;
    } catch (e) {
      // UNIQUE constraint → already linked; harmless.
      if (!/UNIQUE constraint/i.test(e.message)) {
        // Other errors are unusual; log and skip.
        console.error('[auto-link] insert failed:', e.message);
      }
    }
  }
  return linked;
}

// Invalidate cache when subscription data changes (callers can hook
// this manually; not auto-invalidated since subscription writes
// happen elsewhere). The 60s TTL is the safety net.
function invalidateCache() {
  _subscriptionsCache = null;
  _cacheLoadedAt = 0;
}

module.exports = { autoLinkTransaction, invalidateCache };
