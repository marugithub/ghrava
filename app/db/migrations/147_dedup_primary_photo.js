// @ts-nocheck
// ─────────────────────────────────────────────────────────────────────
// Migration 147 — dedupe duplicate primary photos (v202605.217)
//
// Some items ended up with TWO image attachments both flagged
// is_primary_photo=1 (a race between the UPC auto-fetch and a manual /
// staged photo upload). The inventory list query JOINed on
// is_primary_photo=1 and so emitted one row per primary → the item
// appeared twice on the list page (reported: ITM-0032).
//
// The query is now subquery-based (one row per item regardless), but the
// data is still dirty. This keeps the lowest-id primary per item and
// unsets the rest. Data-only, idempotent (0 rows affected on re-run).
// No schema change. No DROP.
// ─────────────────────────────────────────────────────────────────────

'use strict';

module.exports = function migrate147(db) {
  const tx = db.transaction(() => {
    db.exec(`
      UPDATE attachments
         SET is_primary_photo = 0
       WHERE entity_type = 'item'
         AND is_image = 1
         AND is_primary_photo = 1
         AND id NOT IN (
           SELECT MIN(id) FROM attachments
            WHERE entity_type = 'item' AND is_image = 1 AND is_primary_photo = 1
            GROUP BY entity_id
         )
    `);

    db.exec(`
      CREATE TABLE IF NOT EXISTS _migrations_dedup_primary_photo_done (
        id         INTEGER PRIMARY KEY AUTOINCREMENT,
        applied_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        notes      TEXT
      )
    `);
    db.exec(`INSERT INTO _migrations_dedup_primary_photo_done (notes) VALUES ('v202605.217 — unset duplicate is_primary_photo per item')`);
  });
  tx();
};
