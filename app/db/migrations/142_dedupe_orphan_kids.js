// 142_dedupe_orphan_kids.js
// v202604.177 — fix the Kids module showing a child twice.
//
// Background: `syncKidsFromFamilyMembers()` (features/kids/routes.js)
// inserts a `kids` row per family_member child only when no active row
// exists with that `family_member_id`. A legacy/seeded "Arnav" row with
// `family_member_id = NULL` (no family link → no photo) did not satisfy
// that check, so the sync inserted a SECOND, family-linked Arnav row
// (with photo). Result on prod: kids id 13 (Arnav, family_member_id
// NULL) AND id 14 (Arnav, family_member_id 2) both active → Arnav twice.
//
// This migration soft-deactivates any active, UNLINKED kids row whose
// display_name also has an active FAMILY-LINKED row — i.e. the orphan
// duplicate. The canonical (linked, pictured) row is kept. General +
// idempotent: re-running matches nothing (rows already is_active=0).
// Soft delete only (is_active=0), reversible, no cascade — consistent
// with DB-NO-CASCADE. Verified pre-deploy that the orphan (id 13) has
// 0 kid_activities / 0 kid_notes, so nothing is orphaned.
//
// The recurrence is closed separately in routes.js (the sync now
// backfills family_member_id onto an existing unlinked same-name row
// instead of inserting a duplicate).
//
// schema: kids.is_active (INTEGER, dflt 1), kids.family_member_id,
//         kids.display_name, kids.updated_at — all per SCHEMA.md.

module.exports = function(db) {
  db.prepare(`
    UPDATE kids
       SET is_active = 0,
           updated_at = CURRENT_TIMESTAMP
     WHERE family_member_id IS NULL
       AND is_active = 1
       AND display_name IN (
         SELECT display_name FROM kids
          WHERE family_member_id IS NOT NULL
            AND is_active = 1
       )
  `).run();
};
