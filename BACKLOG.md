## 🔝 NEXT UP — review first (top of BACKLOG on purpose)

### ✅ CLEARED in v.176 — the cross-cutting cleanup bundle
The TOP-PRIORITY `daysFromToday()` day-off bug **and** the small orphan
security/hygiene items were all fixed in v202604.176 (one bundled drop):
- ✅ `daysFromToday()` + `fmtDateShort()` now parse bare `YYYY-MM-DD` as
  **local** midnight (`gh-card-shared.js parseLocalDate()`); datetime/Z
  strings unchanged. Regression test pins it (`ghrava-e2e.spec.js`
  GH_CARD v5 block). See Known bugs §3a (now resolved).
- ✅ `/api/v1/app/test-results` POST requires a session; `run-tests.ps1`
  authenticates (reuses the v.174 password plumbing).
- ✅ CORS restricted to a LAN/Tailscale allowlist (was wide open).
- ✅ `global-search.js` uses shared `window.esc` + event listeners
  (closed the interpolated-onclick XSS path).
- ✅ `migrate.js` comment-parser — **was already fixed in v202604.142**
  (`stripSqlComments()` runs before the `;` split); audit row was stale.
  No work needed; marked resolved (Security/code audit table below).

Nothing outstanding here now — next session: pick from the
carried-forward items or the main backlog sections below.

### Carried-forward open items (from the v.173 spin-out — still unresolved)
- **(a) Build the Vehicles module (DRAFT #19)** then wire its fuel
  asterisk. The `vehicles` GH_CARD config already declares the fuel
  asterisk; v.173 added per-record `vehicle_fuel` math. Both are inert
  until the module has a live page.
- **(b) Al's product decision: should the HSA-YTD number return to the
  medication card?** It was dropped when `medical_medications` went to
  compact mode. No asterisk has a home there until this is decided.
- **(c) Card-config asterisk path (`gh-card-shared.js asteriskState`):
  retire it, or build per-record into it as a deliberate second
  mechanism.** v.173 chose the v.171 DOM probe as canonical and left
  this one inert (see LOCKED.md `ASTERISK-MATH`). Decide its fate.

---

## ✅ v.173 SHIPPED — Asterisk subsystem: per-record math + HSA tile (2026-05-17)

Built, committed, pushed (not yet packaged). Per-record math threaded
through all six pending detectors + `/api/v1/pending/asterisk`
(back-compat preserved when `record_id` omitted); HSA Eligible Expenses
tile wired as the canonical example via the v.171 `.gh-pending-target`
pattern; `ASTERISK-MATH` lock added. Deferred items spun to v.174
above. **The audit findings below were the spec for this drop — kept
for context.**

### Two asterisk mechanisms exist (root of the confusion)
1. **v.171 DOM helper** — `GhAsterisk.scan()` in
   `app/public/js/pending-report.js:661-679`. Scans `.gh-pending-target`
   nodes, calls `GET /api/v1/pending/asterisk?card=…`
   (`app/features/pending/routes.js:448`). Supported cards:
   `vehicle_fuel, medication, hsa_payment, subscriptions, inventory,
   certification`. **Only loaded on reports.html / finance.html.** The
   endpoint returns a *global* count and ignores `record_id`, so it
   cannot drive a *per-record* card asterisk as-is.
2. **Card-config data-driven** — `S.crossRow(label,val,{asterisk:
   r.X_asterisk})` + `GH_CARD_SHARED.asteriskState()`
   (`app/public/js/gh-card-shared.js:91,177`). Module configs already
   declare it; relies on the row carrying a `*_asterisk` field.

**Core gap:** grep of `app/features/**` shows the word `asterisk` only
in `pending/routes.js`. **No module route populates any `*_asterisk`
field.** The card-config asterisks are declared but fed by data nothing
produces — dead wiring everywhere it appears.

### Each card: derived number today, and what blocks the asterisk
| Candidate | Derived number today | Blocker |
|---|---|---|
| **Vehicle fuel YTD** | `vehicles` config crossRow "YTD fuel" with `asterisk: r.ytd_fuel_asterisk` already declared (`gh-card-configs-batch1.js:98-105`) | Vehicles module is spec-only (`_templates/vehicles.html` DRAFT #19, never built). No live page renders GH_CARD `vehicles`. Nothing to attach to until the module is built. |
| **Medication HSA YTD** | None on the live card. Live medication cards use GH_CARD `medical_medications` in **compact mode, no crossModule** (`gh-card-config-medical.js:57-112`). HSA YTD survives only in the dead legacy medv5 renderer (`medical.html:2697,2923-2927`; condition strip `:3129`). | Must first re-add an HSA-YTD crossRow (or non-compact mode) to the `medical_medications` config before any asterisk has a home. |
| **HSA "Spent YTD" tile** | `hsa_accounts` config crossRow "Spent YTD" with `asterisk: r.spent_asterisk` already declared (`gh-card-configs-batch1.js:483-500`) | `hsa.html` does not use GH_CARD at all (custom/legacy page). The declared asterisk has no render path until hsa.html migrates to GH_CARD `hsa_accounts` (or gets the v.171 `.gh-pending-target` wrap). |

### What v.173 must decide / close first (in order)
1. **Pick the canonical mechanism.** Recommend the data-driven
   card-config path (modern, already declared in configs); retire or
   scope the v.171 DOM helper to legacy pages only.
2. **Backend (schema-safety skill applies — touches feature routes/SQL):**
   make the vehicles / hsa / medications list endpoints emit a
   per-row `*_asterisk` by reusing the existing detectors
   (`detectVehicleFuel`, `detectHsaReceipts`, `detectMedicalRx` in
   `pending/routes.js`) made **per-record** instead of global.
3. **Build the vehicles module** (DRAFT #19) before its fuel asterisk
   has a live home.
4. **Medication card:** decide whether the HSA-YTD number returns to
   the medication card config at all (Al's product call).
5. **hsa.html:** migrate to GH_CARD `hsa_accounts`, or accept the
   v.171 `.gh-pending-target` wrap as an interim.

**Effort:** medium. Step 2 is the keystone (~half a session, gated).
Steps 3-4 are independent product decisions. Until step 2 lands, every
card-config asterisk in the codebase is inert.

---

## ✅ v.170 SHIPPED — Gates-over-docs + 28 schema bugs (2026-05-14)

**Bundled with v.169 Finance Finalization.** Single drop because v.169 wasn't deployed yet.

### Gates infrastructure
- ✅ `README_FOR_CHAT.md` — 9-rule contract, only required reading
- ✅ `LOCKED.md` — enumerable lock registry
- ✅ `gates.sh` + 8 sub-gates in `app/scripts/`
- ✅ Schema-safety skill bundled at `app/.claude/skills/`
- ✅ Validator enhanced (RENAME + standalone ALTER patterns)
- ✅ Definition of "done" = `bash gates.sh` shows 8 passed, 0 failed

### 28 schema bugs (all FIXED — see crossed-out entries below)

### What v.170 does NOT do
- Universal Attachments (#28) — queued v.171
- Today page — queued
- Reports live wiring — endpoint ready, chart still mockup
- Security audit (path allowlists, esc fix) — small separate drop
- Pending Items Report / asterisk subsystem — see entry below

---

## 📋 Pending Items Report + transaction-linking subsystem (spec exists, unbuilt)

Cross-cutting subsystem. Surfaces all data gaps (uncategorized fuel tx → which vehicle, Rx pickup without cost, recurring tx that could be a subscription) in **one** report at `/reports.html`. Adds red/amber asterisk to derived numbers anywhere they roll up incomplete data. Defines vehicle/merchant assignment workflow with `tx_link_rules` for auto-application.

**Spec:** `TRANSACTION_LINKING_SPEC.md` (2026-05-01, "approved patterns, awaiting implementation"). Read in full before building.

**Schema note:** spec proposes a new `tx_record_links` table. This **violates** the SHARED-LNK lock (`record_links` is THE universal cross-module link table). When this gets built, the per-tx link rows must use `record_links` with `left_type='transaction'`. Only `tx_link_rules` (merchant→record auto-apply rules) is genuinely new and needs its own table.

**Effort:** medium-large. Pending Items report itself is ~half a session; asterisk-everywhere is another half (touches every card with a derived number); auto-apply rules engine is a third. Probably 2-3 sub-drops.

**Status:** in spec. Not lock-worthy yet (no rendered template). When it's about to be built, lock the report shape into `_templates.html` first, add a LOCKED.md row, then code.

---

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

### Cash-flow forecast (Finance) — ✅ SHIPPED v.169 (endpoint) · ✅ SHIPPED v.172 (chart)
- **What:** project next 30/60/90 days starting today using `recurring_transactions` (bills + income). Per-day running balance, low-balance alert, event list. Click any future date → which bills/income land that day.
- **Why:** Reports today are past-only. Forward visibility is the missing half.
- **Shipped in:** `app/features/finance/forecast.js` (new sub-router), `/api/v1/finance/forecast?days=N`. Surfaced in Budgets tab.
- **✅ v.172:** Reports `#26.1.5` card wired live to `/api/v1/finance/forecast?days=30` (was a mockup stub). `reports.html` `c115` now fetches + renders the projected running balance. No design change — locked #26 shape unchanged. Closes the v.171-deferred item.
- **Possible follow-up (not scoped):** future-date drill-down (click a day → bills/income that land then) is in the endpoint payload (`daily[].items`) but not surfaced on the Reports card. Endpoint already supports it if Al wants it later.

### Budget UI (Finance) — ✅ SHIPPED v.169
- **Shipped in:** `app/features/finance/budgets.js` rewritten with unified `transactions` table; new `/summary` + `/history` endpoints. `finance.html` Budgets tab adds monthly trend strip.
- **Still TODO:** Tile-2 budget target (deferred per Al).

### EOB folder-drop persistence (Finance/Medical) — ❌ DROPPED 2026-05-15
- **What:** `importEob` in watcher counts files but doesn't save records. Manual upload via Medical works fine.
- **Status:** **Dropped per Al 2026-05-15.** Folder-watcher path for EOB ingestion is no longer scoped. Supported path is site upload at Medical → Receipts. `importEob()` in `app/features/watcher/routes.js` is no-op for now; remove or stub in v.171 cleanup. Any STATE/HANDOFF/help.html references to the EOB watch folder are stale and should be removed when next touched.

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

## 🐛 Schema audit — all 31 pre-existing bugs FIXED (v.169 + v.170)

Found 2026-05-14 by `validate-schema.js`. v.169 closed the 6 finance ones; v.170 closed the remaining 25 + bundled the validator into the always-on `gates.sh`. After v.170, **schema validator returns 0 failures.**

### Daily Log
- ✅ **FIXED v.170** — `app/features/dailylog/routes.js:300` `entry_date` → `log_date`

### Dashboard
- ✅ **FIXED v.170** — `app/features/dashboard/routes.js:163` `documents.doc_type` → `category`
- ✅ **FIXED v.170** — `app/features/dashboard/routes.js:287` `hsa_payments.receipt_path` → `receipt_location` (also `amount` → `you_paid`)
- ✅ **FIXED v.170** — `app/features/dashboard/routes.js:301` `certifications` table → `career_certifications`
- ✅ **FIXED v.170** — `app/features/dashboard/routes.js:313` same `certifications` → `career_certifications` fix
- ✅ **FIXED v.170** — `app/features/dashboard/routes.js:518` `career_certifications.cert_name` → `name`

### Family snapshot
- ✅ **FIXED v.170** — `app/features/family-snapshot/routes.js:64` `kids.school_name` → `school_id, teacher_name`
- ✅ **FIXED v.170** — `app/features/family-snapshot/routes.js:92` `perfumes.family_member_id` → `owner_family_member_id`
- ✅ **FIXED v.170** — `app/features/family-snapshot/routes.js:121` `books.family_member_id` → `record_links` polymorphic join

### Finance
- ✅ **FIXED v.169** — `app/features/finance/routes.js:1340` `import_category_rules.updated_at` removed
- ✅ **FIXED v.169** — `app/features/finance/routes.js:1419` `subscriptions.monthly_amount` → `cost`
- ✅ **FIXED v.169** — `app/features/finance/routes.js:1429` `med_visit_notes.provider` → `physician_contact_id` JOIN `contacts`
- ✅ **FIXED v.169** — `app/features/finance/routes.js:1439` `hsa_payments.amount` → `you_paid`
- ✅ **FIXED v.169** — `app/features/finance/routes.js:1449` `eobs` table → `med_eob_statements`
- ✅ **FIXED v.169** (bonus) — `app/features/finance/routes.js:1133` `import_batches.row_count` → `rows_total`

### Google integration
- ✅ **FIXED v.170** — `app/features/google/routes.js:234` `contacts.google_id` → `google_contact_id`
- ✅ **FIXED v.170** — `app/features/google/routes.js:240` same `google_id` → `google_contact_id`
- ✅ **FIXED v.170** — `app/features/google/routes.js:280` same `google_id` → `google_contact_id` (3rd site found during fix)
- ⏳ Deferred — `app/features/google/routes.js:145/153` `todos.google_tasklist_id`/`google_task_id` — these are inside the calendar/tasks sync code path that is currently blocked on the Tailscale HTTPS cert. Will fix when that path comes back online.

### HSA
- ✅ **FIXED v.170** — `app/features/hsa/routes.js:788` `a.file_name` → `a.original_filename`
- ✅ **FIXED v.170** — `app/features/hsa/routes.js:809` same fix + `p.amount` is correct on `fsa_payments` (false positive)
- ✅ **FIXED v.170** — `app/features/hsa/routes.js:977` `attachments.file_path` → `stored_path`
- ✅ **FIXED v.170** — `app/features/hsa/routes.js:991` `attachment_type/file_name/file_path` → `module/original_filename/stored_path`
- ✅ **FIXED v.170** — `app/features/hsa/routes.js:1138` `a.file_path` → `a.stored_path`

### Import
- ✅ **FIXED v.170** — `app/features/import/routes.js:199` `row_count` → `rows_total`
- ✅ **FIXED v.170** — `app/features/import/routes.js:283/303` `holdings.as_of_date` — added defensive mig 137 to ensure column exists on all install paths

### Property
- ✅ **FIXED v.170** — `app/features/property/routes.js:152/181` `vehicles.insurance_contact_id` removed (column never existed; insurance stored as text fields)

### Shared
- ✅ **FIXED v.170** — `app/shared/attachments.js:21/33` `attachment_type/file_name/file_path` → `module/original_filename/stored_path`
- ✅ **FIXED v.170** — `app/shared/auto-link-subscriptions.js:43` `monthly_amount` → `cost` (+ `billing_frequency` → `billing_cycle`, `is_active` → `status`)
- ✅ **FIXED v.170** — `app/shared/folder-watcher.js:319/343` attachments columns
- ✅ **FIXED v.170** — `app/shared/folder-watcher.js:353` `hsa_payments.amount` → `you_paid`

### Lesson learned (locked into v.170 gates)

The bugs landed because chats wrote SQL from memory of "what the column was probably called." v.170 makes this mechanically harder: `bash gates.sh schema` runs validate-schema.py --strict in every drop. New SQL bugs get caught before the zip is built. **This category of bug should not recur.**

---

## 🐛 Known bugs (need `docker logs ghrava --tail 50` first — don't guess)

> **v.174 → v.175:** the v.174 auth fix surfaced 15 real failures
> (92/15 baseline). v.175 addressed all 15 (Al scope = everything).

1. ✅ **RESOLVED v.175 — NOT an app bug; was a stale test (misdiagnosed twice).** Verified live (Playwright vs NAS): the Todos page renders perfectly — `#todoList` is full of `.gh-card` (GH_CARD pipeline, zero JS errors). It simply no longer uses `.todo-item`/`.todos-empty`; the test asserted a dead DOM contract. Both prior diagnoses were wrong (this file's old "v128 family filter"; a sub-agent's "field-name mismatch + setCount abort"). Fixed test → assert `.gh-card`/`.todos-empty`. Separately, the real `family_member_ids`→`family_members` latent bug in `todos.html` (would empty the list under an active Lens person scope) WAS hardened + shipped — just not the failure cause.
2. ✅ **FIXED v.175 (was a MISDIAGNOSIS) — Reports `.rep-row` not found.** `REPORT_REGISTRY` is NOT empty (fully-populated static array). The landing `overview` tab renders summary tiles by design (locked Reports #26); `.rep-row` only exists on money/family/maintenance/system tabs. App is correct; the test was stale. Fixed test-side (`reports.html?tab=money`).
3. ✅ **FIXED v.175 — all 15 stale Playwright tests (final: 107 pass / 0 fail, verified live).** `:297`+`:430` (legacy-hidden shelf tabs → default shelf), `:327` (`.module-tile` gone; Today page → retargeted), `:344` (Reports `overview` shows tiles by design → `?tab=money`), `:356` (Todos → `.gh-card`), `:455` (All-Items toggle in Lens v.134 → dead click removed), `:886`+`:1079` (test TZ bug — see 3a), `:1379` ×7 (pages migrated GH_VIEW→GH_LENS → assert `.gh-lens__views button[title="Card view"]`). One file: `tests/ghrava-e2e.spec.js`. The app was correct throughout — every one of the 15 was test/contract drift, none an app regression.
3a. ✅ **FIXED v.176 — `S.daysFromToday()` (+ `fmtDateShort()`) UTC parse off-by-one.** `gh-card-shared.js` now has `parseLocalDate()`: bare `YYYY-MM-DD` → `new Date(y,m-1,d)` (local midnight); strings with a time/Z keep the native parse (v.175 `localCardDate()` fixtures unaffected). One function added, 28 call sites unchanged. TZ-independent regression test in `ghrava-e2e.spec.js` GH_CARD v5 block (today/tomorrow/yesterday = 0/+1/-1). Full card-renderer E2E re-run gated the drop.
4. **Reports panels open as center modals** — sub-panel CSS leak from `settings.html`. Wrong layer.
5. **Multi-kid bug** — partially fixed in v.166 (kids auto-sync). Verify Risha appears after deploy.
6. ⏳ **PRE-EXISTING (surfaced v.176, ~17 versions old, NOT a regression) — orphan migration fails every container boot.** `app/db/migrations/126_capture_and_finance_schema.js:45` does `ALTER TABLE finance_accounts/financial_accounts ADD COLUMN …`, but mig 130 turned those into **VIEWs** (FIN-UNIFY lock, ~v.159) → startup logs `FAILED 126_capture_and_finance_schema.js: Cannot add a column to a view / Nothing was committed`. It is **not** in `_migrations` (DB records `126_finance_unify.js` + `130_rescue_126.js`, not this one), so `migrate.js` retries & fails it on **every** restart. **Benign:** idempotent failure, nothing committed, all functionally-needed migs are recorded, app fully healthy (v.176 E2E 110/0). Its intent was superseded by `130_rescue_126.js` (the "rescue 126" file). The deploy script's "no errors in fresh logs" scanner doesn't flag it (not a crash/SqliteError/restart-loop). **Fix (own gated drop, NOT v.176 scope):** either record it applied (`INSERT INTO _migrations`) so it stops retrying, or make `migrate.js`/the migration skip an `ADD COLUMN` when the target is a view. Migration-runner change → must be its own schema-safety-gated drop.

---

## 🔐 Security / code audit — logged, not fixed

| Issue | Severity | Effort |
|---|---|---|
| ✅ **FIXED v.174** — `window.esc` doesn't escape `/\'` — XSS surface (now escapes `" ' /` too) | medium | trivial |
| Attach route should allowlist `entityType` (not arbitrary string) | medium | small |
| ✅ **FIXED v.174** — `/file/:id` + `/thumb/:id` path-allowlist wired via existing `isUnderAttachmentsRoot` (403 if path escapes `/app/attachments`) | high | small |
| ✅ **FIXED v.176** — `/api/v1/app/test-results` POST now requires a session (`requireAuth`); GETs stay public. `run-tests.ps1` authenticates via the v.174 password plumbing. | low | trivial |
| ✅ **FIXED v.176** — CORS restricted to a LAN/Tailscale origin allowlist (no-Origin requests still allowed so curl/APK/PWA can't be locked out). | low (intranet) | trivial |
| ⚠️ **PARTIAL v.174** — `fmtMoney`: canonical `window.fmtMoney` added to `lt-core.js`; medical/medical_v2 deduped. inventory (no `$`), reports (no cents, #26 locked), hsa (null→`$0.00`) keep their own *by design* — different contracts, merging would regress. Not "trivial dedup" as logged. | trivial | small |
| ✅ **FIXED v.174** — `formatDate` redefined: medical/medical_v2 dupes removed (use `window.formatDate`). dashboard.html keeps its own — different signature (`Date` obj → "Mon, Jan 5, 2025"), NOT a dupe. | trivial | small |
| ✅ **FIXED v.176** — `global-search.js` now uses shared `window.esc` + replaced the 2 interpolated `onclick` attrs with a delegated listener (closed the real XSS path, not just the dedup). | trivial | trivial |
| ✅ **RESOLVED (already fixed v202604.142)** — `migrate.js` `;`/`--` parser. `stripSqlComments()` strips comments (string-literal aware) **before** the `;` split. The audit row was stale; verified during v.176. No work done. | medium | small |

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

*Last updated: v202604.176 sandbox. Update this file at the end of every chat. Bundled in every deploy zip.*
