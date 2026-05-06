// Migration 120 — Slice 2 (Conditions Card #6)
//
// Adds four columns to med_conditions to drive the Card #6 layout:
//   body_system     — text label for the system chip ("Cardiovascular", etc.)
//   goal            — free text target (e.g. "BP <130/80")
//   tracked_metric  — short label that drives the cross-module sparkline
//                     (BP, LDL, A1C, Weight, A1c, etc.)
//   condition_state — clinical control state (in_target / follow_up_due
//                     / out_of_range). Drives the status dot color.
//                     Distinct from the existing `status` column, which
//                     stays for lifecycle (Active / Chronic / Resolved).
//
// All four are nullable. Existing rows render fine — body_system absent
// just means no system chip; condition_state absent falls back to a
// neutral gray dot.
//
// Idempotent: try/catch around each ALTER (better-sqlite3 throws on
// "duplicate column" but we want to ignore that, not fail the migration).
// Safe to re-run.

module.exports = function (db) {
  const addCol = (table, sql) => {
    try { db.exec(`ALTER TABLE ${table} ADD COLUMN ${sql}`); }
    catch (e) {
      if (!/duplicate column/i.test(e.message)) throw e;
    }
  };

  const tx = db.transaction(() => {
    addCol('med_conditions', 'body_system     TEXT');
    addCol('med_conditions', 'goal            TEXT');
    addCol('med_conditions', 'tracked_metric  TEXT');
    addCol('med_conditions', 'condition_state TEXT');
    // No backfill — defaults are NULL and the UI handles that gracefully.
  });
  tx();
};
