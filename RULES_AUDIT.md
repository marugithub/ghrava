# Ghrava Rules Audit — Findings (April 25, 2026)

This audit reviews every module against the Ghrava system rules. Items are tagged
with status: **FIXED** in this deploy, **DEFERRED** for a later session, or **INFO**.

---

## Critical issues fixed this deploy

### 1. `LT.toast` is undefined in 7 modules (FIXED)
**Rule violated:** Frontend code that silently fails breaks user trust.

`LT.toast(...)` was called in 7 HTML files but `LT.toast` is never defined —
the actual function is `window.toast()`. Every call was throwing TypeError,
which means **Save, Delete, and error-handling toasts were silently broken**
across these modules.

| Module | Count | Status |
|---|---|---|
| wardrobe.html | 16 | FIXED (earlier deploy) |
| insurance.html | 9 | FIXED |
| perfume.html | 7 | FIXED |
| subscriptions.html | 6 | FIXED |
| kids.html | 1 | FIXED |
| documents.html | 1 | FIXED |
| calendar.html | 1 | FIXED |

### 2. Cross-module `api()` calls hitting wrong path (FIXED)
**Rule violated:** Every wired call must reach a real route.

Module-scoped `api()` calls (created by `window.makeApi('/career')` etc.)
prepend the module prefix. Calls to cross-module paths like `/settings/family`
were becoming `/career/settings/family` — 404.

| File | Bad call | Fixed call |
|---|---|---|
| career.html (line 700) | `api('GET', '/attachments/career_cert/...')` | `window.api(...)` |
| career.html (line 726) | `api('DELETE', '/attachments/...')` | `window.api(...)` |
| kids.html (line 548) | `api('GET', '/settings/family')` | `window.api(...)` |
| daily-log.html (line 660) | `api('GET', '/settings/tags/entity?entity_type=dailylog')` | `window.api('GET', '/settings/tags/distinct?entity_type=daily_log')` |

### 3. Search broken (FIXED)
**Rule violated:** All columns must be verified against live DB before query.

`features/search/routes.js` had three issues:
- Daily log query used `content` and `date` columns — actual schema is `entry_text` and `log_date` → query silently returned [].
- Filtered with `is_active=1` and `is_archived=0` on items, books, documents, kids — hiding records that should display.
- Missing modules: perfume, wardrobe (separately from inventory), insurance, subscriptions, properties, vehicles, career sub-tables, financial accounts, finance accounts, finance transactions, family members, tags, kid activities, kid notes, outfits.

Search was rewritten with verified columns, no `is_active` filtering, and 21 modules covered.

### 4. Inventory items POST/PUT broken (FIXED, prior deploy)
**Rule violated:** Schema column count must match parameter count.

`features/inventory/routes.js` INSERT had 46 columns but only 45 values
because `d.size||null` was missing. UPDATE had `size=?` missing from SET
clause AND from `.run()`. Both fixed in earlier deploy. Note: any inventory
items created between migration 074 (adding `size`) and the fix may have
data shifted into the wrong columns — recommend spot-checking.

### 5. Daily Log tag filter endpoint missing (FIXED)
**Rule violated:** Wired endpoints must exist.

Frontend called `/settings/tags/entity?entity_type=dailylog` (wrong endpoint
concept and wrong entity_type — backend saves with `daily_log`). Added a new
`GET /settings/tags/distinct?entity_type=X` endpoint that returns all unique
tags ever used on a given entity_type. Frontend rewired.

### 6. Family Snapshot incomplete (FIXED)
**Rule violated:** Reports should reflect all relevant data.

`features/family-snapshot/routes.js` was querying `todos.family_member_id`
which doesn't exist — the column wasn't there. Got swallowed silently and
returned `[]`. Sections missing: memories, items owned, wardrobe, outfits,
perfumes, properties, vehicles, insurance, subscriptions, books.

Rewritten with verified schema and 14 sections. Todos now match by
`title LIKE '%name%' OR notes LIKE '%name%'` as best-effort since the column
genuinely doesn't exist.

### 7. Dashboard missing modules (FIXED)
**Rule violated:** Dashboard "right now today" should cover everything time-sensitive.

Added: insurance policies expired/expiring (uses `coverage_end_date`,
verified against schema), subscriptions billing in next 7 days
(`next_billing_date`/`cost`), inventory warranty expiring/expired,
records flagged `needs_review` across 20 tables.

### 8. Global search UI added (FIXED)
**Rule violated:** N/A — feature gap.

`/api/v1/search` existed but had no frontend. Added a search button to the
header (next to bell), search panel with Ctrl/Cmd+K shortcut, debounced
input with stale-response handling, grouped results by module with click-to-navigate.
Esc closes panel.

---

## Deferred — material findings to address in a future session

### A. `ON DELETE CASCADE` is enforced (DEFERRED, larger fix)
**Rule violated:** "All data is interconnected. CASCADE is never used anywhere."

The rule is followed in spirit but **violated in the schema** —
`ON DELETE CASCADE` appears 30+ times in old migrations, and `db.js` sets
`PRAGMA foreign_keys = ON` which means **CASCADE is actively enforced**.

Concretely this means:
- Deleting a contact silently deletes the matching `contacts_employer`,
  `contacts_medical`, `contacts_school`, `contacts_home_service`,
  `contacts_contractor`, `contacts_financial` rows
- Deleting an item deletes all `item_events` and `item_maintenance_log`
- Deleting a kid deletes all `kid_activities` and `kid_notes`
- Deleting a vehicle deletes all `vehicle_service`
- Deleting a finance_account deletes all related rows
- Deleting an HSA reimbursement deletes all `hsa_reimbursement_items`
- Deleting an item with H&W details deletes the `item_hw_details` row

If the rule is "never lose data on delete," the fix is one of:
1. Switch `foreign_keys = OFF` (silent CASCADE no-op, but loses other FK guarantees)
2. Migrate every CASCADE clause to `ON DELETE SET NULL` or `RESTRICT` (large additive migration)
3. Add app-level safeguards: every DELETE route does soft-delete instead of hard-delete

This is a major architectural decision and should be discussed before any change.

### B. `is_active=1` / `is_archived=0` filtering on display routes (DEFERRED, large)
**Rule violated:** "Records not matching a new data pattern must display as-is and never be rejected or blanked."

Found 50+ instances across `books`, `templates`, `backup`, `import`,
`settings`, `notifications` modules that filter out inactive/archived records.

This is widespread and many are in legitimate places (e.g., notifications that
ask "do you have any items needing X?" reasonably skip archived items).

Recommendation: review case-by-case rather than blanket-fix. Specifically
check: `books/routes.js GET /` (probably should show archived books with a
visual indicator, not hide them).

### C. Some routes not yet audited
**Files I cannot see** (excluded from share zip by `Ghrava_Share.ps1`):
- `features/attachments/routes.js`
- `features/data/routes.js`

These are excluded because the script blocks the entire `attachments/` and
`data/` directories rather than just the uploaded files inside them.
Suggestion: change `$excludeDirs = @('node_modules','.git','data','backups','attachments','uploads')`
to file-pattern exclusions like `attachments/files/*` and `data/*.db*` so
the route code is included while uploaded files and DBs are not.

### D. Wardrobe routes pending other AI's branch (HOLD)
User indicated another AI is iterating on `wardrobe/routes.js` (pre-check
gate, partial-update semantics, 400 on category drift). Held this session
to avoid conflicts.

---

## Verified — these rules are followed correctly

- ✅ **WAL mode disabled.** `db.js` sets `journal_mode = DELETE` and
  `synchronous = FULL`. No commits buffered.
- ✅ **Migrations additive only.** Last verified migration is 112 (memories).
  No DROP COLUMN statements in any migration.
- ✅ **Column verification before query.** This session verified column names
  against migration schema before writing every new query in search,
  family-snapshot, and dashboard extensions.
- ✅ **`finance_accounts` ≠ `financial_accounts`.** Search treats them as
  separate modules ("Finance" vs "Investments") with separate result groups.
- ✅ **GH_REFS pages include `lt-refs.js`.** Verified by earlier audit; no
  active issues.
- ✅ **`requireAuth` only in `settings/routes.js`.** Other modules' read GETs
  are public, write routes use specific auth as documented.

---

## Operational notes

**Total files changed this deploy:** 11 (search routes, family-snapshot routes,
dashboard routes, dashboard frontend, nav.js, shared.css, settings routes —
already shipped, daily-log.html and reports.html already shipped, plus the 6
LT.toast fixes for insurance/perfume/subscriptions/documents/kids/calendar)

**Migration count unchanged.** No new migrations added. Migration 112 (memories)
must already have applied successfully on prior deploy.
