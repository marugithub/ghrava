// ═════════════════════════════════════════════════════════════════
// Migration 129 — Cross-module record_links junction table (v202604.157)
//
// Strictly additive. Creates one table for arbitrary record-to-record
// links across modules. The point is the "All" tab on finance: every
// transaction can be linked to a subscription, a medical visit, an
// HSA expense, an EOB, etc. so the row tells you what the money was
// for without forcing one ad-hoc FK column per relationship.
//
// Shape:
//   id INTEGER PRIMARY KEY
//   left_type   TEXT  — e.g. 'transaction', 'subscription'
//   left_id     INTEGER
//   right_type  TEXT
//   right_id    INTEGER
//   link_kind   TEXT  — semantic label, e.g. 'pays_for', 'reimburses',
//                       'attached_to', 'manual'
//   notes       TEXT
//   created_at  DATETIME
//
// Why no FK constraints to specific record tables:
//   The whole point of a polymorphic junction is that the same
//   table relates rows in (potentially) many parent tables. SQLite
//   doesn't support polymorphic FKs cleanly. We enforce referential
//   integrity in app code; orphan cleanup runs in the periodic
//   needs-review sweep.
//
// UNIQUE constraint on (left_type, left_id, right_type, right_id,
// link_kind) means re-running the auto-linker is idempotent — no
// duplicate link rows from a repeat import.
//
// "Canonical direction":
//   For symmetric pairs (manual user links), the app code stores
//   them as (alphabetically lower type) → (higher) so a single
//   query returns both directions. The GET endpoint will fan out
//   both directions explicitly so callers don't need to know the
//   canonicalization rule.
//
// Idempotent: marker table.
// ═════════════════════════════════════════════════════════════════

'use strict';

module.exports = function (db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS _migrations_record_links_done (
      done_at DATETIME DEFAULT CURRENT_TIMESTAMP, version TEXT
    );
  `);
  const already = db.prepare(
    `SELECT 1 FROM _migrations_record_links_done LIMIT 1`
  ).get();
  if (already) return;

  db.exec(`
    CREATE TABLE IF NOT EXISTS record_links (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      left_type   TEXT    NOT NULL,
      left_id     INTEGER NOT NULL,
      right_type  TEXT    NOT NULL,
      right_id    INTEGER NOT NULL,
      link_kind   TEXT    NOT NULL DEFAULT 'manual',
      notes       TEXT,
      created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE (left_type, left_id, right_type, right_id, link_kind)
    );
  `);

  // Lookup-by-record from either side. Two indexes because we never
  // know which side a query comes from.
  db.exec(`CREATE INDEX IF NOT EXISTS idx_record_links_left
           ON record_links(left_type, left_id);`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_record_links_right
           ON record_links(right_type, right_id);`);

  db.prepare(
    `INSERT INTO _migrations_record_links_done (version) VALUES ('202604.157')`
  ).run();
};
