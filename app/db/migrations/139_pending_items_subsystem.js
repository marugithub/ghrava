// 139_pending_items_subsystem.js
// v.171 — Transaction-linking subsystem foundation.
//
// Two new tables, both additive, no CASCADE, no FK enforcement:
//
//   1) tx_link_rules
//      Remembers "merchant X → assign to record Y" so future bank
//      charges from the same merchant auto-link without a prompt.
//
//   2) pending_dismissals
//      Records when the user said "skip for now" or "this isn't
//      really a [module] expense — stop asking". Without this, every
//      run of the Pending Items Report would re-surface the same rows.
//
// The actual per-tx ↔ record link goes into the existing shared
// `record_links` table (left_type='transaction', left_id=tx.id,
// right_type=module, right_id=record_id). This honors the SHARED-LNK
// architectural lock — record_links is THE universal cross-module
// link table. The original spec proposed a new tx_record_links table
// for this; that part of the spec is overridden by SHARED-LNK.
//
// schema: tx_link_rules.{id, merchant_pattern, category, right_type,
//   right_id, auto_apply, is_active, match_count, last_matched_at,
//   created_at}
// schema: pending_dismissals.{id, transaction_id, reason, hint,
//   snooze_until, dismissed_at}

module.exports = function(db) {

  // ── tx_link_rules ─────────────────────────────────────────────
  db.exec(`
    CREATE TABLE IF NOT EXISTS tx_link_rules (
      id               INTEGER PRIMARY KEY AUTOINCREMENT,
      merchant_pattern TEXT    NOT NULL,
      category         TEXT,
      right_type       TEXT    NOT NULL,
      right_id         INTEGER NOT NULL,
      auto_apply       INTEGER NOT NULL DEFAULT 1,
      is_active        INTEGER NOT NULL DEFAULT 1,
      match_count      INTEGER NOT NULL DEFAULT 0,
      last_matched_at  DATETIME,
      created_at       DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_txrule_active   ON tx_link_rules(is_active, merchant_pattern)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_txrule_target   ON tx_link_rules(right_type, right_id)`);

  // ── pending_dismissals ────────────────────────────────────────
  db.exec(`
    CREATE TABLE IF NOT EXISTS pending_dismissals (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      transaction_id  INTEGER NOT NULL,
      reason          TEXT    NOT NULL,
      hint            TEXT,
      snooze_until    DATE,
      dismissed_at    DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_pend_dismiss_tx ON pending_dismissals(transaction_id)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_pend_dismiss_act ON pending_dismissals(transaction_id, reason, snooze_until)`);

  // ── budgets index helper for D (per-category targets) ─────────
  // budgets table already exists (mig 126). This adds a covering
  // index for the per-month per-category lookup the targets UI uses.
  // schema: budgets.{category, year, month, is_active}
  db.exec(`CREATE INDEX IF NOT EXISTS idx_budgets_lookup ON budgets(year, month, category, is_active)`);
};
