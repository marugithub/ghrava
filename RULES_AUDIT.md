# Ghrava Rules Audit — Findings (April 25, 2026)

This audit reviews every module against the Ghrava system rules. Items are tagged
with status: **FIXED** in this deploy, **DEFERRED** for a later session, or **VERIFIED**.

---

## Critical issues fixed across this session

### 1. `LT.toast` is undefined in 7 modules (FIXED)
**Rule violated:** Frontend code that silently fails breaks user trust.

`LT.toast(...)` was called in 7 HTML files but `LT.toast` is never defined —
the actual function is `window.toast()`. Every call was throwing TypeError,
which means **Save, Delete, and error-handling toasts were silently broken**
across these modules.

| Module | Count | Status |
|---|---|---|
| wardrobe.html | 16 | FIXED |
| insurance.html | 9 | FIXED |
| perfume.html | 7 | FIXED |
| subscriptions.html | 6 | FIXED |
| kids.html | 1 | FIXED |
| documents.html | 1 | FIXED |
| calendar.html | 1 | FIXED |

### 2. Cross-module `api()` calls hitting wrong path (FIXED)
**Rule violated:** Every wired call must reach a real route.

| File | Bad call | Fixed call |
|---|---|---|
| career.html (line 700) | `api('GET', '/attachments/career_cert/...')` | `window.api(...)` |
| career.html (line 726) | `api('DELETE', '/attachments/...')` | `window.api(...)` |
| kids.html (line 548) | `api('GET', '/settings/family')` | `window.api(...)` |
| daily-log.html (line 660) | `api('GET', '/settings/tags/entity?entity_type=dailylog')` | `window.api('GET', '/settings/tags/distinct?entity_type=daily_log')` |

### 3. Search broken (FIXED)
**Rule violated:** All columns must be verified against live DB before query.

`features/search/routes.js` had three issues:
- Daily log query used `content` and `date` columns — actual schema is `entry_text` and `log_date`.
- Filtered with `is_active=1` and `is_archived=0` on items, books, documents, kids — hiding records.
- Missing 14 modules: perfume, wardrobe (separately from inventory), insurance, subscriptions, properties, vehicles, career sub-tables, financial accounts, finance accounts, finance transactions, family members, tags, kid activities, kid notes, outfits.

Search rewritten with verified columns, no `is_active` filtering, and 21 modules covered.

### 4. Inventory items POST/PUT broken (FIXED)
**Rule violated:** Schema column count must match parameter count.

INSERT had 46 columns but 45 values (`d.size||null` missing). UPDATE had `size=?` missing from SET clause AND from `.run()`. Note: any inventory items created between migration 074 (adding `size`) and this fix may have data shifted into the wrong columns — recommend spot-checking.

### 5. Daily Log tag filter endpoint missing (FIXED)
Frontend called `/settings/tags/entity?entity_type=dailylog` (wrong endpoint AND wrong entity_type — backend saves with `daily_log`). Added `GET /settings/tags/distinct?entity_type=X` endpoint. Frontend rewired.

### 6. Family Snapshot incomplete (FIXED)
`features/family-snapshot/routes.js` was querying `todos.family_member_id` which doesn't exist. Got swallowed and returned `[]`. Sections missing: memories, items owned, wardrobe, outfits, perfumes, properties, vehicles, insurance, subscriptions, books. Rewritten with verified schema and 14 sections.

### 7. Dashboard missing modules (FIXED)
Added: insurance policies expired/expiring (`coverage_end_date`), subscriptions billing in next 7 days (`next_billing_date`/`cost`), inventory warranty expiring/expired, records flagged `needs_review` across 20 tables.

### 8. Global search UI added (FIXED)
`/api/v1/search` existed but had no frontend. Added search button in header with **Ctrl/Cmd+K** shortcut, debounced input, stale-response handling, grouped results by module.

### 9. Scheduled daily backup (FIXED — feature added)
Added scheduler. Settings → Backup now has toggle + hour selector + retention selector (7/14/30/90 days). Auto-named files prune by retention; manual backups never prune. Background scheduler checks every 30 min and at startup.

### 10. Mobile capture (FIXED)
- Inputs go to 16px font on mobile (prevents iOS zoom-on-focus)
- Min tap target 44px on buttons and inputs
- Drawer body padding wider for fingers
- Form-row stacks vertically on mobile
- Sticky drawer footer with Save button (no scroll-to-save)
- Larger toggle switches
- All wrapped in `@media (max-width: 600px)` — desktop unchanged

### 11. Tag display polish (FIXED)
- `#` prefix removed from tag display in resources.html (other modules already correct)
- Tag input min-width 90→140px

### 12. is_active filtering on display routes (PARTIALLY FIXED)
**Rule:** "Records not matching a new data pattern must display as-is and never be rejected or blanked."

Removed `is_active=1` from these display routes:
- `books/routes.js GET /` (list)
- `documents/routes.js GET /` (list) and `GET /:id` (single)
- `property/routes.js GET /properties` (list)
- `property/routes.js GET /vehicles` (list)
- `kids/routes.js GET /summary/dashboard`

Intentionally kept `is_active=1` in these places (different intent — these are summary stats or rule toggles, not display):
- `books/stats` — count summary, "active book count" is meaningful
- `dashboard /` — summary metrics for inventory value
- `finance net-worth` — closed accounts shouldn't count toward current net worth
- `finance import_category_rules` — rules toggle on/off is the design
- `dropdown_options` — admin can deactivate dropdown values; hidden ones must stay hidden
- `kids activity_count` subquery — count of currently active activities

---

## Deferred — needs your decision before action

### A. `ON DELETE CASCADE` is enforced
**Rule violated:** "All data is interconnected. CASCADE is never used anywhere."

The rule is followed in spirit but **violated in the schema** — `ON DELETE CASCADE` appears 30+ times in old migrations, and `db.js` sets `PRAGMA foreign_keys = ON` which means **CASCADE is actively enforced**.

Concretely:
- Deleting a contact silently deletes the matching `contacts_employer`, `contacts_medical`, `contacts_school`, `contacts_home_service`, `contacts_contractor`, `contacts_financial` rows
- Deleting an item deletes all `item_events` and `item_maintenance_log`
- Deleting a kid deletes all `kid_activities` and `kid_notes`
- Deleting a vehicle deletes all `vehicle_service`
- Deleting a finance_account deletes all related rows
- Deleting an HSA reimbursement deletes all `hsa_reimbursement_items`
- Deleting an item with H&W details deletes the `item_hw_details` row

If the rule is "never lose data on delete," the fix is one of:
1. Switch `foreign_keys = OFF` in db.js (silent CASCADE no-op, but loses other FK guarantees)
2. Migrate every CASCADE clause to `ON DELETE SET NULL` or `RESTRICT` (large additive migration)
3. Add app-level safeguards: every DELETE route does soft-delete instead of hard-delete

This is a major architectural decision and should be discussed before any change.

### B. Files I cannot see (excluded from share zip)
- `features/attachments/routes.js`
- `features/data/routes.js`

`Ghrava_Share.ps1` blocks the entire `attachments/` and `data/` directories. Suggest narrowing the exclude pattern from whole directories to file-level (`attachments/files/*` and `data/*.db*`) so the route code is auditable.

### C. Wardrobe routes pending separate AI work (HOLD)
Held this session to avoid conflicts.

---

## Verified — these rules are followed correctly

- ✅ **WAL mode disabled.** `db.js` sets `journal_mode = DELETE` and `synchronous = FULL`.
- ✅ **Migrations additive only.** Last applied is 112 (memories). No DROP COLUMN statements anywhere.
- ✅ **Column verification before query.** All new queries this session verified column names against schema.
- ✅ **`finance_accounts` ≠ `financial_accounts`.** Search treats them as separate result groups.
- ✅ **GH_REFS pages include `lt-refs.js`.** No active issues.
- ✅ **`requireAuth` in `settings/routes.js` only.** Other modules' read GETs are public.
- ✅ **Tab bars filter as designed.** Career/property/wardrobe tabs are section toggles (show/hide div), not data filters. Working correctly.
- ✅ **Inventory thumbnails wired correctly.** `primary_photo_id` returned from list query, frontend builds `/api/v1/attachments/thumb/{id}` URL.

---

## Files changed this session (cumulative)

**Backend routes (10):**
- search, family-snapshot, dashboard, dailylog, settings, wardrobe, inventory, backup, books, documents, property, kids, finance

**Migrations (1):** 112_memories.sql

**Frontend (15):**
- nav.js (search panel + Ctrl+K)
- shared.css (search panel + mobile improvements)
- index.html (dashboard module labels)
- settings.html (scheduled backup UI)
- resources.html (tag display # removed)
- daily-log.html (memories + tag filter rewire)
- reports.html (memory timeline)
- career.html (window.api fix)
- kids.html (window.api + LT.toast fix)
- wardrobe.html (LT.toast + photos flow)
- inventory.html (drawers)
- insurance, perfume, subscriptions, documents, calendar (LT.toast)

**Documentation (1):** RULES_AUDIT.md (this file)
