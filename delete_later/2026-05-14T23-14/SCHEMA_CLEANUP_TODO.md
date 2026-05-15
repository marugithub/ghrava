# Schema Cleanup TODOs

## CASCADE rule violations (project rule: no `ON DELETE CASCADE` anywhere)

Project rule per HANDOFF.md says cascading deletes should not exist — all
data is interconnected, accidental deletes should fail loudly rather than
silently destroy linked records. But the existing schema has many CASCADE
clauses, most of them pre-existing.

**Status as of v202604.121:** Audit complete. NO automated fix yet — each
needs a decision: is the cascade intentional (child can't exist without
parent) or accidental?

### Genuinely intentional (probably keep)
These are parent/child where the child genuinely makes no sense without parent:

- `taggables.tag_id REFERENCES tags(id) ON DELETE CASCADE` (001) — orphan
  taggables with deleted tag IDs serve no purpose; the TAG is the entity
- `custom_field_values.field_def_id ... ON DELETE CASCADE` (001) — same
- `med_eob_claim_lines.eob_id ... ON DELETE CASCADE` (055, 057) — claim lines
  ARE the EOB statement detail; no orphan rows wanted
- `wardrobe_outfit_items.outfit_id ... ON DELETE CASCADE` (107) — outfit
  composition rows; orphans = corruption

### Probably accidental (likely remove)
These delete real data the user might still want:

- `import_transactions.account_id REFERENCES financial_accounts(id) ON DELETE CASCADE` (032)
  — deleting an account would wipe all imported transaction history
- `import_batches.account_id ... ON DELETE CASCADE` (032)
  — same problem
- `vehicle_service.vehicle_id REFERENCES vehicles(id) ON DELETE CASCADE` (024)
  — selling a car shouldn't erase years of service records

### Decision needed
Each of the "probably accidental" cases needs:
1. Confirmation from user that the cascade is unwanted
2. A migration that recreates the table with `ON DELETE SET NULL` or
   `ON DELETE RESTRICT` instead
3. UI handling for the new behavior (show "deleted account" placeholder
   on transactions whose account is gone, etc.)

This is multi-session work — not safe to do unilaterally.

---

## Other schema concerns flagged during card rollout

- `med_conditions` ↔ `med_medications` has no FK — joining requires
  matching on text `patient` field or `family_member_id`. Documented in
  CARD_FIELD_GAPS.md.
- `career_jobs` ↔ `career_certifications` has no FK either.
- `perfume_wear_log` table doesn't exist — perfume cards can't show wear
  stats until it's added.
- `book_reading_sessions` table doesn't exist — books cards can't show
  streak/pace/pages-today.
