// @ts-nocheck
// ─────────────────────────────────────────────────────────────────────
// Migration 132 — auto-linker schema (v202604.167)
//
// Adds the confidence + needs_review columns to `record_links` so the
// auto-linker pattern from `_templates.html #27` can distinguish
// silent HIGH-confidence matches from MEDIUM matches that need Al's
// review.
//
// Per locked rule: additive only, idempotent, transaction-wrapped.
// ─────────────────────────────────────────────────────────────────────

'use strict';

module.exports = function migrate132(db) {
  const addCol = (table, sql) => {
    try { db.exec(`ALTER TABLE ${table} ADD COLUMN ${sql};`); }
    catch (e) {
      if (!/duplicate column/i.test(e.message)) throw e;
    }
  };
  const tx = db.transaction(() => {
    // confidence tier: high (auto-link silently) | medium (needs_review=1) | low (not created)
    addCol('record_links', "confidence TEXT NOT NULL DEFAULT 'high'");
    // 1 = flagged for Al to review the auto-link; 0 = confirmed or manually created
    addCol('record_links', 'needs_review INTEGER NOT NULL DEFAULT 0');
    // metadata so we know which linker created the row and when
    addCol('record_links', 'source TEXT');
    addCol('record_links', 'reviewed_at DATETIME');

    db.exec(`CREATE INDEX IF NOT EXISTS idx_record_links_review
             ON record_links(needs_review, created_at DESC)
             WHERE needs_review = 1`);

    db.exec(`
      CREATE TABLE IF NOT EXISTS _migrations_autolinker_done (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        applied_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
        notes       TEXT
      )
    `);
    db.exec(`INSERT INTO _migrations_autolinker_done (notes) VALUES ('v202604.167 — record_links +4 cols (confidence, needs_review, source, reviewed_at) + needs_review index')`);
  });
  tx();
};
