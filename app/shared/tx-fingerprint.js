// ═════════════════════════════════════════════════════════════════
// app/shared/tx-fingerprint.js  (v202604.153)
//
// Description normalization + transaction fingerprint, shared by
// every code path that creates or compares transactions.
//
// Why:
//   The bank gives us "AMAZON.COM*1A2B3C" today and "AMAZON.COM*9X8Y7Z"
//   tomorrow for the same merchant. The trailing reference ID changes
//   per visit. If we hash the raw string, we never recognize the
//   pending → posted transition for the SAME charge as a duplicate
//   of itself.
//
//   normalizeDescription() canonicalizes the string for hashing:
//   uppercase, collapse whitespace, strip trailing reference IDs,
//   strip leading bank-specific transaction-type prefixes.
//
//   fingerprint() hashes (accountId | date | amount | normalized).
//
// Used by:
//   - app/db/migrations/127_fingerprint_v2.js  (backfill on every row)
//   - app/features/finance/routes.js           (transactions/import-file)
//   - app/features/import/routes.js            (preview, confirm)
//
// Algorithm details (locked v.153):
//
//   normalizeDescription(s):
//     1. trim, uppercase, collapse internal whitespace runs to one space
//     2. strip leading bank-style prefixes:
//          POS DEBIT, POS PURCHASE, POS WITHDRAWAL,
//          DEBIT CARD PURCHASE, CREDIT CARD PURCHASE,
//          CHECK CARD, ATM WITHDRAWAL, ACH DEBIT, ACH CREDIT,
//          PURCHASE AUTHORIZED ON \d{2}/\d{2}
//     3. strip trailing reference-ID-style suffixes (any of):
//          *[A-Z0-9]{4,}             — Amazon-style, e.g. *1A2B3C
//          #\d+                      — Starbucks-style, e.g. #4827
//          REF: .*                   — generic reference
//          ID: .*                    — generic id
//          XX\/\d+                   — split markers
//          \d{6,}                    — bare 6+ digit suffix
//     4. trim again
//
//   fingerprint(accountId, date, amount, description):
//     md5(`${accountId}|${date}|${amount.toFixed(2)}|${normalizeDescription(description)}`)
//
//   Notes:
//     - We pin amount to 2 decimal places before hashing so 5 vs 5.00
//       don't differ.
//     - We do NOT include `source`. The fingerprint is a property of
//       the underlying real-world charge, not how we ingested it.
//     - We do NOT lowercase the normalized form before hashing because
//       step 1 already uppercased — keeping it consistent.
//
// Exports (CommonJS): `normalizeDescription`, `fingerprint`.
// ═════════════════════════════════════════════════════════════════

'use strict';
const crypto = require('crypto');

// Leading prefixes are matched case-insensitively after uppercase.
// Order matters: longest first so "DEBIT CARD PURCHASE" doesn't get
// matched as just "DEBIT" by a shorter rule.
const LEADING_PREFIXES = [
  /^PURCHASE AUTHORIZED ON \d{2}\/\d{2}\s+/,
  /^DEBIT CARD PURCHASE\s+/,
  /^CREDIT CARD PURCHASE\s+/,
  /^POS WITHDRAWAL\s+/,
  /^POS PURCHASE\s+/,
  /^POS DEBIT\s+/,
  /^CHECK CARD\s+/,
  /^ATM WITHDRAWAL\s+/,
  /^ACH DEBIT\s+/,
  /^ACH CREDIT\s+/,
  /^EXTERNAL DEPOSIT\s+/,
  /^EXTERNAL WITHDRAWAL\s+/,
];

// Trailing reference-ID patterns. Applied repeatedly until stable so
// "AMAZON.COM*1A2B3C #ORDER:5544" → "AMAZON.COM*1A2B3C" → "AMAZON.COM".
const TRAILING_REFS = [
  /\*[A-Z0-9]{4,}\s*$/,    // Amazon-style *AB12CD
  /#\d+\s*$/,              // #4827
  /\sREF:\s*\S+\s*$/i,     //  REF: 12345
  /\sID:\s*\S+\s*$/i,      //  ID: ABC123
  /\sXX\/\d+\s*$/,         //  XX/55
  /\s\d{6,}\s*$/,          // trailing 6+ digit bare number
  /\s+$/,                  // any trailing whitespace
];

function normalizeDescription(s) {
  if (s == null) return '';
  let out = String(s).trim().toUpperCase().replace(/\s+/g, ' ');
  if (!out) return '';

  // Strip leading prefixes (one match max, longest-first wins)
  for (const re of LEADING_PREFIXES) {
    if (re.test(out)) { out = out.replace(re, ''); break; }
  }

  // Strip trailing refs repeatedly until no more match. Bounded loop
  // so a pathological input can't spin forever.
  for (let i = 0; i < 8; i++) {
    let changed = false;
    for (const re of TRAILING_REFS) {
      if (re.test(out)) {
        out = out.replace(re, '');
        changed = true;
      }
    }
    if (!changed) break;
  }

  return out.trim();
}

function fingerprint(accountId, date, amount, description) {
  // Coerce amount safely to 2dp string. NaN / undefined → "0.00" so
  // we still produce a stable hash rather than throwing.
  const amt = Number.isFinite(parseFloat(amount))
    ? parseFloat(amount).toFixed(2)
    : '0.00';
  const norm = normalizeDescription(description);
  const key = `${accountId}|${date}|${amt}|${norm}`;
  return crypto.createHash('md5').update(key).digest('hex');
}

module.exports = { normalizeDescription, fingerprint };
