## ✅ v.169 SHIPPED — Finance Finalization (PM drop, 2026-05-14)

**Single coordinated drop closing out the finance module.** No migrations. Additive only. Schema validator clean on finance/* paths.

### Fixed
- ✅ All 5 finance schema bugs from the v.167.1 audit (routes.js lines 1340/1419/1429/1439/1449 — see "Finance" subsection below; entries crossed out)
- ✅ Bonus: routes.js:1133 `import_batches.row_count` → `rows_total` (was crashing every file-import; same module, 1-line)

### Built
- ✅ **Budget UI** finalized — `budgets.js` rewritten using unified `transactions` table; new `/summary` + `/history` endpoints; monthly trend strip in `finance.html` Budgets tab.
- ✅ **Cash-flow forecast** new feature — `features/finance/forecast.js`, `GET /api/v1/finance/forecast?days=30|60|90`, with `?starting_balance=N` what-if. Surfaced in Budgets tab: chip selector, 4-card summary strip, low-balance alert, running-balance bar chart, event list. Satisfies `_templates.html #26.1.5` from a backend standpoint (Reports chart can now consume it).

### Doc updates
- ✅ `lens-config.js` — `budgets` lens entry added (category/year/status).
- ✅ `help.html` — 4 commands added (forecast 30d, forecast what-if, budgets summary, budgets history).
- ✅ `SCHEMA.md` regenerated.

### What v.169 deliberately does NOT do
- Universal Attachments (#28) — still queued for v.170.
- 28 remaining pre-existing schema bugs in non-finance paths (attachments, google, hsa, dashboard, family-snapshot) — queued for v.169.1 plumbing drop.
- Reports tab live data wiring — endpoint is ready, chart still mockup.
- Tile-2 budget target — deferred per Al.

---

# BACKLOG.md — Ghrava deferred work

> **Required reading per chat. STATE.md points here.**
>
> This file is the persistent record of every idea, gap, and deferred
> decision that came up during build but didn't ship in the current
> version. The point: a new chat reading this should understand the
> full shape of what's planned without having to re-derive it from
> conversation history. Update at the end of every chat — never
> delete an entry without Al's explicit OK, even if "complete."
>
> An older April 2026 backlog is archived as `BACKLOG_OLD_apr2026.md`
> in repo root — kept for historical reference but superseded by this
> file as of v.166.
>
> Sections in priority order. Most-important first.

---

## 📋 Top open decisions (need Al)

These block other work. Resolve first.

1. **Other family members' medical seed JSON** — Algir's `health_seed.json` is bundled at `app/seeds/medical_algir.json` (v.166). Zarna / Arnav / Risha need their own JSONs generated from medical records. **Process:** re-engage the medical-conversion chat (it has the binder script `health_binder.py` + PDF→JSON pipeline) and supply each member's PDFs; receive a `medical_<name>.json`; drop into `app/seeds/`; run `node scripts/seed-medical.js --file /app/seeds/medical_<name>.json`. Endpoint dedups by family_member_id + content hash so re-running is safe.

2. **Medical "Receipts" tab design** (v140 deferred) — superseded by **#28 Universal Attachments** (v.168 build). The Receipts tab becomes a special view of "all attachments linked to medical entities for this family member."

3. **Reports engine design** — LOCKED in `_templates.html #26`. Settings-style grouping, plain-English titles, every chart has drill-down, no data dump tables on landing page. Build sequence: v.167 (mockup 2 charts) → v.167.1/v.168 Group 1 (Money) → v.169 Group 2 (Health) → v.170 Group 3 (Household).

---

## 🚧 v.167 LOCKED SCOPE (in progress)

> Documented BEFORE coding per Al's locked workflow rule. Build sequence is captured here so a new chat can pick up exactly where work stopped.

**Builds:**

1. **Auto-link txn → hsa_payment** (#27.1) — `app/shared/auto-link-hsa.js`. HIGH: account_type='HSA' OR name LIKE '%HSA%'. Creates hsa_payment row. Runs on import-confirm + category-change-to-medical.
2. **Auto-link txn → medical_visit** (#27.2) — `app/shared/auto-link-medical-visit.js`. HIGH: vendor exact-match (case-insensitive trim) `contacts.name` WHERE type='medical_provider' AND visit ±7d.
3. **EOB → hsa_payment auto-match** (#27.3) — `app/features/medical/eob-hsa-matcher.js`. HIGH: same patient (required) + amount ±$0.50 + date ±14d. Provider match is bonus, not required. Otherwise → needs_review flag. **Auto-triggered (v.167.1):** runs in EOB import loop + on every new hsa_payment POST. Manual backfill endpoint still available for initial pass.
4. **Subscription auto-categorization** (#27.4) — extend `auto-link-subscriptions.js`: copy subscription's category to txn IF txn.category IS NULL. Retroactive button: last 90 days only.
5. **LP-FSA Settings UI** — mirror FSA form. Fields: `annual_limit`, `plan_year`, `deadline_date`, `plan_name`. Backend `lpfsa_plan_info` table already exists.
6. **Transaction attachments (simple)** — wire `attach-lifecycle.js` on the txn drawer. Does NOT use Universal Attachments yet (that's v.168). One-attachment-per-txn for now.
7. **Reports mockup** — static SVG mocks of 2 charts in `_templates.html #26` rendered so Al picks visual direction. NO live data wiring this drop.
8. **`record_links` schema additions** — ADD COLUMN `confidence TEXT DEFAULT 'high'` + `needs_review INTEGER DEFAULT 0`. Required for auto-linker pattern.
9. **Review surface** — "Needs review" pill on transactions, EOBs, hsa_payments. Click → side-by-side review drawer with Confirm / Unlink / Adjust buttons.
10. **New endpoints:** `GET /api/v1/links/needs-review`, `POST /api/v1/links/:id/confirm`, `DELETE /api/v1/links/:id`, `POST /api/v1/links` (manual link).

**Doc updates (mandatory per drop rule):**

- `app/public/_templates.html` — #26 Reports Design, #27 Auto-Linkers Pattern, #28 Universal Attachments — **already added in this drop**.
- `app/public/js/lens-config.js` — register `record_links.confidence` + `needs_review` as filterable fields.
- `app/public/help.html` COMMANDS — `node /app/scripts/relink-retroactive.js --module subscriptions --days 90` for the retroactive subscription-category button.
- `STATE.md` v.167 block.
- `HANDOFF.md` v.167 task list.
- This file — keep the BACKLOG section.

**Out of scope for v.167** (explicitly deferred):

- Universal Attachments build (locked as #28, code in v.168)
- Reports live charts (mockup only; live in v.167.1)
- Budget UI
- EOB folder-drop persistence
- Medical Receipts tab (becomes part of v.168 Universal Attach)
- Items 11-15 from "what's left for finance/medical" list (immunizations table, etc.) — addressed in later drops

---

## 🚧 v.168 IN PROGRESS — HSA plan info merge

> Documenting BEFORE shipping. Single drop, no feature work — just merges HSA plan_info into the unified fsa_plan_info table.

**Problem:** Two parallel plan-info tables (`hsa_plan_info` from mig 002, `fsa_plan_info` from mig 118). Settings panel I built in v.167 only read `fsa_plan_info`, hiding Al's existing HSA plan data. Single-source-of-truth violation.

**Solution:** Merge into `fsa_plan_info`, deprecate `hsa_plan_info` by renaming.

### Builds (v.168):

1. **Mig 133** — extend `fsa_plan_info` with 8 HSA-specific columns: `insurance_carrier, individual_deductible, family_deductible, individual_oop_max, family_oop_max, irs_limit_self_only, irs_limit_family, plan_effective_date`. Additive only.

2. **Mig 134** — `INSERT OR IGNORE INTO fsa_plan_info SELECT ... FROM hsa_plan_info`. Copies all existing HSA rows with `plan_type='hsa'`. Idempotent via `UNIQUE(year, plan_type)`.

3. **Mig 135** — `ALTER TABLE hsa_plan_info RENAME TO hsa_plan_info_DEPRECATED_v167`. Data preserved as untouched backup. Old name gone so no future code can accidentally read it.

4. **`hsa/routes.js` rewrite** — all 5 SQL touchpoints (`buildSummary`, `GET /plan`, `GET /plan/:year`, `POST /plan`, `PUT /plan/:id`) point to `fsa_plan_info WHERE plan_type='hsa'` with column aliases preserving the legacy API contract. Frontend (`finance.html`) unchanged.

5. **`reports/emergency.js`** — single query updated to read `fsa_plan_info WHERE plan_type='hsa'`.

6. **Schema validator gate** — every modified prepared statement passes against the post-migration prod schema. Verified end-to-end via Python sqlite3 simulation.

### Verified preserved (no data loss):

All 13 user fields kept:
- plan_year → year
- plan_name → plan_name
- insurance_carrier → insurance_carrier (new col)
- individual_deductible → individual_deductible (new col)
- family_deductible → family_deductible (new col)
- individual_oop_max → individual_oop_max (new col)
- family_oop_max → family_oop_max (new col)
- hsa_contribution_self → contributions
- hsa_contribution_employer → employer_contribution
- irs_limit_self_only → irs_limit_self_only (new col)
- irs_limit_family → irs_limit_family (new col)
- plan_effective_date → plan_effective_date (new col)
- notes → notes

### Caller audit (every code site touching hsa_plan_info — all updated):

- `hsa/routes.js:34` buildSummary ✓
- `hsa/routes.js:106` GET /plan ✓
- `hsa/routes.js:113` GET /plan/:year ✓
- `hsa/routes.js:125` POST /plan ✓
- `hsa/routes.js:148` PUT /plan/:id ✓
- `reports/emergency.js:85` insurance summary ✓
- `app/public/finance.html` (frontend) — no change needed, API contract preserved via column aliases

### Rollback safety:

Old `hsa_plan_info_DEPRECATED_v167` table preserved untouched. To drop manually after confidence:
```
docker exec ghrava node -e "require('/app/db/db').exec('DROP TABLE hsa_plan_info_DEPRECATED_v167')"
```

### What v.168 does NOT do (per locked scope):

- Universal Attachments build — still queued for v.169
- 31 pre-existing schema bugs — still queued for v.168.1
- Reports live data wiring — still queued

---



> Standalone build drop. Touches 14 modules. Locked design in `_templates.html #28`.

**Builds:**

1. Schema migration: `record_links` gains `attachment_id`, `link_kind`. `attachments` gains `refcount`, `soft_deleted_at`. Idempotent.
2. Backfill script — for existing `attachments(entity_type, entity_id)` rows, create matching `record_links` row. Idempotent. Manual run after deploy.
3. Endpoints: `GET /api/v1/attachments/:id/links`, `POST /api/v1/attachments/:id/links`, `DELETE /api/v1/attachments/:id/links/:linkId`, `POST /api/v1/attachments/match-suggestions`.
4. Smart pre-check matcher — thresholds per `_templates.html #28`.
5. Shared upload dialog component — `/js/universal-attach.js`. Used by all 14 modules.
6. Migrate Inventory + HSA + Medical first (highest-value path).
7. Migrate remaining 11 modules: Documents, FSA, Vehicles, Property, Career, Books, Wardrobe, Perfume, Subscriptions, Insurance, Daily Log.
8. Settings UI: "Shared attachments" viewer for orphaned-attachment cleanup.
9. Confirm-with-holder-list dialog on unlink.
10. Update help.html with backfill CLI command.

**Risks:**
- Touches every module's existing attachment UI. High regression surface.
- Refcount trigger needs careful migration (initial value = count of legacy attachment rows, going forward = COUNT of record_links).
- Module-specific link_kind labels (warranty vs receipt vs eob) need to be agreed before coding.

---



## 🔌 Cross-module wiring — NOT yet built

> Each item names: **what** + **why** + **estimated effort** + **dependencies**.

### Auto-link transaction → medical_visit
- **What:** when an imported transaction's account is HSA OR category=medical OR vendor matches a care_team contact name, auto-create a `record_links` row connecting `transaction` → `medical_visit` (or `medical_visit` → `hsa_payment`).
- **Why:** today HSA card swipes appear in Finance but don't show as visit-related in Medical. EOB matching loses the financial half. Reports can't trace cost-per-condition.
- **Effort:** medium (~200 lines). Logic in `auto-link-medical.js` parallel to `auto-link-subscriptions.js`. Run on import-confirm. Backfill script for existing transactions.
- **Depends on:** care_team contacts having reliable name spellings. Mig 131 added the columns; needs data.

### Auto-link transaction → hsa_payment
- **What:** HSA card swipe ($75 at CVS) → creates hsa_payment row automatically when imported transaction's account_type='HSA'.
- **Why:** today you have to manually log HSA expenses. The transaction is already there.
- **Effort:** small (~80 lines). Runs in same `auto-link-medical.js` pass.
- **Risk:** double-entry if Al also manually entered the HSA payment. Dedup by date + amount + vendor.

### EOB → HSA payment auto-match
- **What:** when EOB processes, if `your_share` (claim level) ≈ existing hsa_payment.you_paid (same patient, ±14 days), auto-link them.
- **Why:** closes the loop: insurer says "you owe $42" → HSA payment for $42 at CVS → linked, reimbursement complete.
- **Effort:** medium (~120 lines). New endpoint POST `/api/v1/medical/eob/:id/auto-match`. Run on EOB import.
- **Depends on:** hsa_payment_links table (already exists, mig 119).

### Care team contact → medical record reverse lookup
- **What:** open Dr. Goyal in contacts → see all visits, medications, conditions where he's the prescribing/treating provider.
- **Why:** today contacts are one-way (point at things, but things don't point back). Reverse lookup is read-only join, no schema change.
- **Effort:** small (~60 lines). New endpoint GET `/api/v1/contacts/:id/medical-records`. UI tab in contact drawer.

### Medical → Documents single-flow upload
- **What:** drop PDF in Medical → file goes to Documents storage + new med_visit_notes row + record_links auto-created.
- **Why:** today Al has to remember which module to use. v140 design exists, deferred.
- **Effort:** medium (~250 lines). New modal `_modal_medical_upload.html`. Per-section parsers (visit notes vs lab PDF vs EOB).

### Books "to read" tag → todos auto-creation
- **What:** tagging a book "to read" creates a todo in the Books category. Marking todo done → updates book status.
- **Why:** discussed in v.1 chat ("books to read is a tag in to do"). Never wired.
- **Effort:** trivial (~30 lines). `app/shared/autoTodos.js` already has the pattern.

### Inventory medication item → med_medications
- **What:** inventory H&W medication items link to the med_medications row (so Tylenol bottle in cabinet ↔ Tylenol prescription).
- **Why:** v.7 chat decision: "should be both type of information in one place." Never built.
- **Effort:** medium (~150 lines). Add `medication_id` column to `item_hw_details`. Two-way sync on save.

### Subscription auto-categorization
- **What:** importing transactions matches against active subscriptions (already done v.157 via `auto-link-subscriptions.js`). Extension: auto-assign category from subscription's category.
- **Effort:** small (~40 lines).
- **Status:** half-done.

### Calendar sync
- **What:** Google Calendar two-way sync — todos with due_date sync as calendar events, calendar events with `[ghrava]` tag sync as todos.
- **Why:** discussed multiple times; explicit "yes" deferred to "low priority."
- **Effort:** large (~600 lines). Needs Google OAuth (blocked on Tailscale HTTPS cert).
- **Depends on:** OAuth cert work.

### Email receipt parsing → inventory
- **What:** Gmail watcher reads Amazon order confirmation emails, extracts items, adds to inventory.
- **Why:** Al asked for this in v.7. Then rejected as "duplicates bank data" — but he reopened it later for ITEMS specifically (not money).
- **Effort:** large (~400 lines). Gmail API + regex parsers per merchant.
- **Status:** rejected once, recently reopened.

### Per-device family scope (mobile/desktop different defaults)
- **What:** first-time prompt "who is this?", localStorage only, scope indicator near nav avatar. Different devices can default to different family members.
- **Why:** mobile = Al only, desktop = whole household. Today scope is shared across all devices.
- **Effort:** medium (~150 lines). New `_templates/family-filter.html` design exists.

### Cash-flow forecast (Finance) — ✅ SHIPPED v.169
- **What:** project next 30/60/90 days starting today using `recurring_transactions` (bills + income). Per-day running balance, low-balance alert, event list. Click any future date → which bills/income land that day.
- **Why:** Reports today are past-only. Forward visibility is the missing half.
- **Shipped in:** `app/features/finance/forecast.js` (new sub-router), `/api/v1/finance/forecast?days=N`. Surfaced in Budgets tab.
- **Still TODO:** wire into `_templates.html #26.1.5 Cash-flow forecast` chart on the Reports tab (endpoint is ready, chart still mockup).

### Budget UI (Finance) — ✅ SHIPPED v.169
- **Shipped in:** `app/features/finance/budgets.js` rewritten with unified `transactions` table; new `/summary` + `/history` endpoints. `finance.html` Budgets tab adds monthly trend strip.
- **Still TODO:** Tile-2 budget target (deferred per Al).

### EOB folder-drop persistence (Finance/Medical)
- **What:** `importEob` in watcher counts files but doesn't save records. Manual upload via Medical works fine.
- **Effort:** small.
- **Status:** Al deferred — manual upload is the primary path; folder-drop is low priority.

### Medical → Documents flow REPLACED BY #28
- Universal Attachments (locked design v.167, build v.168) covers this use case.
- The single PDF that's an inventory item + HSA payment + transaction example was Al's driver for #28.

### Item-to-inventory + medication-to-medical (cross-module)
- **What:** when an Amazon order arrives → adds inventory item AND if it's a medication → also creates/updates `med_medications` row.
- **Why:** the receipt-shared-across-modules pattern is broader than just attachments — the data itself crosses modules. Currently only HSA/FSA receipts cross over.
- **Effort:** large. Touches: email-receipt-parsing rules, classifier (is it food / med / clothes / electronics), per-category dispatchers.
- **Depends on:** v.168 Universal Attachments + #11 Inventory medication item link.

### Medical schema gaps (immunizations, procedures, etc.)
- High-priority items per "what's left" review (v.167): **immunizations** + **procedures** tables. Algir's coronary arteriosclerosis means cardiac procedures coming.
- See "🩺 Medical schema — gaps not in v.166" section below for full list.
- **Status:** Al deferred to later drops, after v.167/v.168.

---

## 🩺 Medical schema — gaps not in v.166

These weren't in the seed JSON but Al needs them eventually.

| Gap | Why | Effort | Priority |
|---|---|---|---|
| `med_immunizations` table | Flu/COVID/tetanus boosters, childhood vaccines. Needed for travel, school, employer. Critical record. | small (~80 lines) | **high** |
| `med_procedures` table | Surgeries, colonoscopies, mammograms. Distinct from visits (one-time, often elective, scheduled in advance). | small | **high** |
| `med_family_history` table | Mom's heart disease, dad's diabetes. Affects risk assessment + screening recommendations. | small | medium |
| `med_referrals` table | Active/pending/completed referrals, auth #, expiry date. Drives "you still owe a specialist visit." | medium | medium |
| `med_care_plans` table | Per-condition care plans + goals (BP target <130/80, A1C target <7.0). Used in Today/Discussion views. | medium | medium |
| `med_implants` table | Pacemakers, IUDs, joints, ports. Low frequency, high stakes (MRI safety). | small | low |
| `med_discussion_topics` table | Items to discuss next visit, per-provider. Killer feature missing from CareZone. | small | medium |
| `med_visit_documents` link | Direct table for visit-to-document multi-link. (Currently via record_links — works but heavy.) | trivial | low |

---

## 🛠 Reports engine — design needed before code

Al wants to slice clinical + financial data both vertically (one metric over years) and horizontally (many metrics over a window).

### Proposed shape (NOT yet built)
- **`metric_index` view** — single SQL view UNION-ALL across:
  - `med_condition_metrics` (BP, A1C, weight already there)
  - `med_lab_results` (cholesterol, A1c, etc.)
  - `med_vitals_readings` (BP, weight, HR, O2 sat)
  - `med_visit_notes` (bp_systolic + bp_diastolic + weight_lb + heart_rate_bpm columns from mig 124)
  - `transactions` (with category='medical' filter)
- **Common shape:** `family_member_id, date, metric_name, value_numeric, value_text, unit, source_system, category`.
- **Vertical query:** `WHERE metric_name='bp_systolic' AND family_member_id=1 ORDER BY date`
- **Horizontal query:** `WHERE date BETWEEN ? AND ? AND family_member_id=1 GROUP BY metric_name`

### Open Qs
- Canonical metric_name vocabulary — needs an Al-blessed list (lowercase snake_case standard).
- Cross-module joins: through record_links? Or a separate `metric_links` table?
- Default time windows per metric type (BP = 30d, A1C = 1yr, cholesterol = 6mo).
- Plot types per metric type (line for BP, bar for spend, etc.).
- Export to PDF for doctor visits.

---

## 🐛 Schema audit — 31 pre-existing bugs caught by validator (v.167.1)

Found 2026-05-14 by `validate-schema.js` against live prod schema. These don't crash today because they're on edge paths (no one's hit them yet) but they will crash the moment that code runs. Tracked here so they get fixed in batches, not forgotten.

### Daily Log
- `app/features/dailylog/routes.js:300` — INSERT uses `entry_date` but column is something else. Check schema.

### Dashboard
- `app/features/dashboard/routes.js:163` — `documents.doc_type` doesn't exist
- `app/features/dashboard/routes.js:287` — `hsa_payments.receipt_path` doesn't exist
- `app/features/dashboard/routes.js:301` — `certifications.name` doesn't exist
- `app/features/dashboard/routes.js:313` — same `certifications.name` bug
- `app/features/dashboard/routes.js:518` — `career_certifications.cert_name` doesn't exist

### Family snapshot
- `app/features/family-snapshot/routes.js:64` — `kids.school_name` doesn't exist
- `app/features/family-snapshot/routes.js:92` — `perfumes.family_member_id` doesn't exist
- `app/features/family-snapshot/routes.js:121` — `books.family_member_id` doesn't exist

### Finance
- ✅ **FIXED v.169** — `app/features/finance/routes.js:1340` `import_category_rules.updated_at` removed
- ✅ **FIXED v.169** — `app/features/finance/routes.js:1419` `subscriptions.monthly_amount` → `cost`
- ✅ **FIXED v.169** — `app/features/finance/routes.js:1429` `med_visit_notes.provider` → `physician_contact_id` JOIN `contacts`
- ✅ **FIXED v.169** — `app/features/finance/routes.js:1439` `hsa_payments.amount` → `you_paid`
- ✅ **FIXED v.169** — `app/features/finance/routes.js:1449` `eobs` table → `med_eob_statements`
- ✅ **FIXED v.169** (bonus) — `app/features/finance/routes.js:1133` `import_batches.row_count` → `rows_total`

### Google integration
- `app/features/google/routes.js:145` — `todos.google_tasklist_id` doesn't exist
- `app/features/google/routes.js:153` — `todos.google_task_id` doesn't exist
- `app/features/google/routes.js:234` — `contacts.google_id` doesn't exist (column is `google_contact_id`)
- `app/features/google/routes.js:240` — same `contacts.google_id` bug

### HSA
- `app/features/hsa/routes.js:708` — JOIN references `a.file_name` but column doesn't exist
- `app/features/hsa/routes.js:729` — same `a.file_name` bug + `p.amount` bug
- `app/features/hsa/routes.js:897` — `attachments.file_path` doesn't exist
- `app/features/hsa/routes.js:911` — `attachments.attachment_type` doesn't exist
- `app/features/hsa/routes.js:1058` — same `a.file_path` bug

### Import
- `app/features/import/routes.js:283` — `holdings.as_of_date` doesn't exist
- `app/features/import/routes.js:303` — same `holdings.as_of_date` bug

### Shared
- `app/shared/attachments.js:21` — `attachments.attachment_type` doesn't exist
- `app/shared/attachments.js:33` — same bug
- `app/shared/auto-link-subscriptions.js:43` — `subscriptions.monthly_amount` doesn't exist
- `app/shared/folder-watcher.js:319` — `attachments.file_path` doesn't exist
- `app/shared/folder-watcher.js:343` — `attachments.attachment_type` doesn't exist
- `app/shared/folder-watcher.js:353` — `hsa_payments.amount` doesn't exist

### Cleanup plan
Group by table for efficient fixing:

1. **`attachments` table** — 6 bugs reference fictional columns (`attachment_type`, `file_path`, `file_name`). Either renamed in a missed migration, or writes have always been broken. Inspect SCHEMA.md → attachments and fix all 6 in one pass.
2. **`subscriptions.monthly_amount`** — 2 bugs. Column is `cost`.
3. **`hsa_payments.amount`** — 2 bugs. Column is `you_paid`.
4. **Google sync columns** — 4 bugs. Whole code path may be broken since launch.
5. **Per-family-member columns** (`perfumes.family_member_id`, `books.family_member_id`) — 2 bugs.
6. **Misc one-offs** — daily_log, dashboard certifications, finance routes 1340/1419/1429/1439/1449, holdings, kids.school_name.

**Suggested drop:** v.168.1 — single-purpose plumbing fix. Walk SCHEMA.md, fix each query against real column names, validator with --strict. No new features. Effort: medium (~2 hours focused).

---

## 🐛 Known bugs (need `docker logs ghrava --tail 50` first — don't guess)

1. **Todos page renders neither `.todo-item` nor `.empty-state`** — v128 family filter may hide everything. Suspected: filter regression.
2. **Reports `.rep-row` not found** — registry empty in renderer. `REPORT_REGISTRY` not being populated.
3. **11 stale Playwright selectors** — test runner needs refresh. List in HANDOFF.md if it exists.
4. **Reports panels open as center modals** — sub-panel CSS leak from `settings.html`. Wrong layer.
5. **Multi-kid bug** — partially fixed in v.166 (kids auto-sync). Verify Risha appears after deploy.

---

## 🔐 Security / code audit — logged, not fixed

| Issue | Severity | Effort |
|---|---|---|
| `window.esc` doesn't escape `/\'` — XSS surface | medium | trivial |
| Attach route should allowlist `entityType` (not arbitrary string) | medium | small |
| `/file/:id` and `/thumb/:id` missing path-allowlist — helper `isUnderAttachmentsRoot` exists in `attach-lifecycle.js`, not used | high | small |
| `/api/v1/app/test-results` unauthenticated — writes test runs to disk | low | trivial |
| CORS wide open | low (intranet) | trivial |
| `fmtMoney` redefined in 3 pages — should be in `lt-core.js` | trivial | small |
| `formatDate` redefined despite `lt-core` | trivial | small |
| `global-search.js` has own `esc()` — should use shared | trivial | trivial |
| `migrate.js` parser splits on `;` before stripping `--` comments — breaks multi-statement migs with comments containing `;` | medium | small |

---

## 📁 v140 EOB / receipt loose ends (~15% remaining)

- **EOB folder-drop persistence** — `importEob` counts files but doesn't save records to DB. Watcher works for HSA, broken for EOB.
- **LP-FSA plan info Settings UI** — API exists, no form.
- **Mileage UI on medical visit form** — backend has `round_trip_miles` column (mig 118), form doesn't expose it.
- **Medical "Receipts" tab** — full design exists, deferred.
- **Documents/insurance/subscriptions don't use `attach-lifecycle`** — should migrate to standard helper.

---

## 🎨 Draft pages → templates (moved v.166)

These were design drafts attached to `_templates.html` numbered items. The directory move from `_drafts/` → `_templates/` happened in v.166. Each is a small HTML file in `app/public/_templates/`.

| Template # | Subpage | Status | Locked? |
|---|---|---|---|
| #1 | center-modals.html | option B locked, awaiting Al go | yes |
| #2 | reports-split.html | drafted | partial |
| #3 | notifications.html | drafted | no |
| #4 | finance-dashboard.html | deferred | no |
| #5 | mobile-ux.html | skeleton | no |
| #6 | family-filter.html | skeleton (per-device family picker) | no |
| #7 | documents-redesign.html | skeleton | no |
| #8 | wardrobe-photos.html | skeleton (photo-first drag/drop) | no |
| #9 | tag-fixes.html | skeleton | no |
| #10 | data-quality.html | skeleton | no |
| #11 | card-orphans.html | skeleton (7 orphan triage) | no |
| #12 | today-page.html | LOCKED design, not built | yes |
| #13 | global-search.html | skeleton | no |
| #14 | tailscale.html | skeleton | no |
| #15 | gcal-sync.html | skeleton | no |
| #16 | email-to-inbox.html | skeleton | no |
| #17 | summary-tile-card.html | skeleton | no |
| #18 | finance-overview-tiles.html | locked + shipped v.165 | yes ✓ |
| #19 | env-secrets.html | skeleton | no |
| #20 | hsa-page-resolution.html | skeleton | no |
| #21 | vehicles.html | skeleton | no |
| #22 | insurance-pattern.html | skeleton | no |
| #23 | tailwind_migration_plan.html | skeleton | no |
| #24 | status.html | NEEDS BUILD next chat — backlog/risks board | — |
| #25 | medical-overview-tiles.html | NEW v.166 — TO ADD with M1-M6 detail | — |

---

## 🔄 Workflow / conventions decisions

These came up repeatedly and got locked but should not be relitigated:

- **Build mode default** (locked 2026-05-09) — no explanations/summaries/recaps unless asked. Confirm decisions in one line. Ask blocking questions only. Build.
- **Packaging discipline** — never package after a single fix. Wait for "package" OR collect multiple fixes into one drop.
- **Empty state rule** (Al, v.166) — "values should be lacking or 0 or something but keep other items there so I know how it will look." Tiles ALWAYS render structure; data fields just go to 0/—/empty.
- **Cards = tiles** in Al's vocabulary.
- **DB safety** — `journal_mode=DELETE`, `synchronous=FULL`. NO `ON DELETE CASCADE` going forward (some grandfathered). Migrations additive only.
- **Auth** — requireAuth only in `settings/routes.js` and `watcher/routes.js`. All GETs public.
- **`finance_accounts` (banking, now VIEW) ≠ `financial_accounts` (investment, now VIEW)** — never mix. Both unified to `accounts` table in mig 130.
- **`med_physicians` table dropped** — do not reference. Use `contacts` with type='medical_provider'.
- **Visual design lives in `_templates.html`** as numbered patterns (#1, #18, etc.). NEVER invent design.
- **Required reading per chat (locked v.166):** STATE.md → HANDOFF.md → BACKLOG.md → _templates.html.
- **Lens config is mandatory for new fields** (Al, v.166): every schema column added MUST appear in `app/public/js/lens-config.js` so the global lens/advanced filter can search on it.
- **Help → Commands is mandatory for new CLIs** (Al, v.166): every drop that adds a `docker exec` / CLI / one-time operational command MUST append an entry to `app/public/help.html → COMMANDS` array.
- **Downstream wiring is part of every DB change** (Al, v.168.1): when a migration changes table/column structure OR moves data between tables, the drop is NOT done until every consuming surface is verified. Required checks before package:
  1. `grep -rn "<old_table>\|<old_column>" app/features/ app/shared/ app/public/` — find every reader
  2. Update each one (routes, tiles, reports, settings panels, frontend pages)
  3. Open each affected page in the browser AFTER deploy — confirm numbers/data render
  4. Document the audit in BACKLOG + STATE under the version block

  Past failure (v.168): HSA data moved tables, Settings panel was new and worked, but I forgot to verify the existing HSA tile in finance.html still rendered. Al had to flag it.
- **Help → Commands is mandatory for new CLIs** (Al, v.166): every drop that adds a `docker exec` / CLI / one-time operational command MUST append an entry to `app/public/help.html → COMMANDS` array (title, cmd, desc, tags). User reaches it via Help → Commands quick card. Each entry is click-to-copy.

---

## 📦 Version log highlights (for context)

- **v.165** — finance landing tiles wired (F1–F6), HSA pool reads hsa_payments + fsa_payments.
- **v.166** (IN PROGRESS, this drop) — drafts→templates rename + dir move, medical Overview tab (M1–M6), mig 131 schema expansion (4 new tables + 23 new columns), bulk-seed endpoint + CLI, kids auto-sync, lens config for new fields, BACKLOG.md created, **Help → Commands section added** (operational CLI documentation with click-to-copy).

---

*Last updated: v202604.166 sandbox. Update this file at the end of every chat. Bundled in every deploy zip.*
