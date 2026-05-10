// ═════════════════════════════════════════════════════════════════
// Migration 127 — Fingerprint v2 + duplicate detection (v202604.153)
//
// What this does:
//
//   1. Recomputes the `fingerprint` column on every row in
//      `transactions` using the v.153 normalizer
//      (`app/shared/tx-fingerprint.js`).
//
//      The previous fingerprint was an md5 of
//        `${accountId}|${date}|${amount}|${desc.toLowerCase().slice(0,80)}`
//      which let "AMAZON.COM*1A2B3C" and "AMAZON.COM*9X8Y7Z" hash to
//      different fingerprints, so the import path silently inserted
//      both as separate transactions. After this mig, those collide.
//
//   2. After backfill, finds duplicate fingerprints (same fingerprint
//      on multiple rows). For each dup group:
//        - Keep the row with the lowest id as canonical (no change).
//        - Mark every other row with `flagged=1, needs_review=1` and
//          append "[fingerprint dup of #<canonical_id>]" to notes.
//      These rows surface in the v.152 needs-review queue so Al can
//      void or re-tag them.
//
//   3. Adds a new index on `fingerprint` if not already present.
//      The v.151 schema has one but defensive create.
//
// Why no UNIQUE constraint on fingerprint:
//   We could enforce uniqueness, but that would break import flows
//   that legitimately need to create another transaction with the
//   same fingerprint (e.g. user manually adds a second Starbucks
//   visit on the same day for the same amount). Instead, we flag and
//   let the human decide.
//
// Idempotent:
//   Marker row in `_migrations_fingerprint_v2_done` skips re-runs.
//
// Reversible:
//   The migration does NOT save old fingerprints. To roll back, you'd
//   re-run the original import-route fingerprint logic on every row.
//   In practice this isn't needed — the new fingerprint is strictly
//   better. The flag/review notes can be cleared via the UI.
// ═════════════════════════════════════════════════════════════════

'use strict';
const { fingerprint } = require('../../shared/tx-fingerprint');

module.exports = function (db) {
  // Idempotence guard
  db.exec(`
    CREATE TABLE IF NOT EXISTS _migrations_fingerprint_v2_done (
      done_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      version TEXT,
      rows_recomputed INTEGER,
      dups_flagged INTEGER
    );
  `);
  const already = db.prepare(
    `SELECT 1 AS x FROM _migrations_fingerprint_v2_done LIMIT 1`
  ).get();
  if (already) return;

  // Defensive: only run if v.151 mig 126 has shipped (the unified
  // `transactions` table has to exist first).
  const haveTxn = db.prepare(
    `SELECT 1 FROM sqlite_master WHERE type='table' AND name='transactions'`
  ).get();
  if (!haveTxn) {
    // Nothing to migrate yet (mig 126 hasn't run). Mark done so we
    // don't keep retrying on every restart.
    db.prepare(
      `INSERT INTO _migrations_fingerprint_v2_done (version, rows_recomputed, dups_flagged) VALUES (?, 0, 0)`
    ).run('202604.153 (skipped — no transactions table)');
    return;
  }

  let recomputed = 0;
  let dupsFlagged = 0;

  const tx = db.transaction(() => {
    // ── 1. Recompute fingerprints ─────────────────────────────
    const rows = db.prepare(
      `SELECT id, account_id, date, amount, description FROM transactions`
    ).all();

    const updFp = db.prepare(`UPDATE transactions SET fingerprint = ? WHERE id = ?`);
    for (const r of rows) {
      const fp = fingerprint(r.account_id, r.date, r.amount, r.description);
      updFp.run(fp, r.id);
      recomputed++;
    }

    // ── 2. Find duplicate fingerprints, flag all but oldest ────
    // GROUP BY fingerprint with HAVING COUNT > 1, then for each
    // group, find the min(id) (canonical) and flag the rest.
    const dupGroups = db.prepare(`
      SELECT fingerprint, MIN(id) AS canonical_id, COUNT(*) AS n
      FROM transactions
      WHERE fingerprint IS NOT NULL AND fingerprint != ''
      GROUP BY fingerprint
      HAVING COUNT(*) > 1
    `).all();

    const flag = db.prepare(`
      UPDATE transactions
         SET flagged = 1,
             needs_review = 1,
             notes = COALESCE(notes, '') ||
               CASE WHEN COALESCE(notes,'') = '' THEN '' ELSE ' ' END ||
               '[fingerprint dup of #' || ? || ']'
       WHERE fingerprint = ?
         AND id != ?
         AND (notes IS NULL OR notes NOT LIKE '%[fingerprint dup of #%')
    `);

    for (const g of dupGroups) {
      const r = flag.run(g.canonical_id, g.fingerprint, g.canonical_id);
      dupsFlagged += r.changes;
    }

    // ── 3. Defensive index on fingerprint ─────────────────────
    try {
      db.exec(`CREATE INDEX IF NOT EXISTS idx_tx_fp ON transactions(fingerprint);`);
    } catch (e) { /* already exists */ }

    // ── Mark done ─────────────────────────────────────────────
    db.prepare(`
      INSERT INTO _migrations_fingerprint_v2_done (version, rows_recomputed, dups_flagged)
      VALUES (?, ?, ?)
    `).run('202604.153', recomputed, dupsFlagged);
  });

  tx();
};
