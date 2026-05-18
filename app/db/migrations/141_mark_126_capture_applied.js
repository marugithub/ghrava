// 141_mark_126_capture_applied.js
// v202604.177 — stop the orphan migration that fails on every boot.
//
// Background: `126_capture_and_finance_schema.js` was never recorded in
// `_migrations`, so migrate.js retries it every container start. Its
// `addCol()` helper does `ALTER TABLE finance_accounts/financial_accounts
// ADD COLUMN …`, but mig 130 turned those into VIEWs (FIN-UNIFY lock,
// v.159) → "Cannot add a column to a view" is re-thrown (the helper only
// swallows "duplicate column"), the migration throws, and the deploy log
// shows `FAILED 126_capture_and_finance_schema.js / Nothing was committed`
// on EVERY restart. Benign (idempotent fail, nothing committed) but noisy
// and it masks real migration failures.
//
// 126_capture's intent is fully superseded:
//   • its `record_links` table  → created canonically by 129_record_links.js
//   • its finance unification    → redone inline by 130_rescue_126.js
//     (header literally: "Rescue mig 126 v2")
// So we record 126_capture as applied (no-op its DDL) — but ONLY after
// verifying the superseding schema is actually present, so this can never
// hide a genuinely-unmigrated DB.
//
// Idempotent: INSERT OR IGNORE; safe to replay. After the boot that
// applies THIS migration, 126_capture is skipped forever.
//
// schema: _migrations.filename (PK/UNIQUE — same column migrate.js writes)

module.exports = function(db) {
  try {
    const recordLinksExists = !!db.prepare(
      "SELECT 1 FROM sqlite_master WHERE type='table' AND name='record_links'"
    ).get();
    const financeAccountsIsView = !!db.prepare(
      "SELECT 1 FROM sqlite_master WHERE type='view' AND name='finance_accounts'"
    ).get();

    if (recordLinksExists && financeAccountsIsView) {
      db.prepare(
        "INSERT OR IGNORE INTO _migrations (filename) VALUES ('126_capture_and_finance_schema.js')"
      ).run();
    }
    // If the superseding schema is NOT present (a fresh/odd install where
    // 129/130 haven't run), do nothing — let 126_capture run normally.
  } catch (e) {
    // Defensive no-op: never let this bookkeeping migration break startup.
  }
};
