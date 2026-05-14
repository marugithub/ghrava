# HANDOFF — for the next chat

Read this first. The only doc the next chat needs to be productive
without Al re-explaining anything.

Last updated: v202604.169 staged 2026-05-14. **Not yet packaged or
deployed.** Awaiting Al's "package" + manual smoke on prod.

---

## 📚 Required reading per chat (locked v.166), in order:

1. **`STATE.md`** — current state, version log, locked decisions
2. **`HANDOFF.md`** (this file) — next chat's tasks + deploy process
3. **`BACKLOG.md`** — persistent backlog: every deferred idea with why/effort/deps. **The answer to memory loss across chats.** Updated at the END of every chat.
4. **`app/public/_templates.html`** — numbered visual design specs

## 🔁 Required documentation updates per drop (locked v.166):

Every drop that adds the following MUST also update the corresponding doc:
- **New CLI / docker exec / one-time operational command** → append to `app/public/help.html` → `COMMANDS` array. User reaches it via Help → Commands.
- **New schema column or table** → register in `app/public/js/lens-config.js` so the global lens/advanced-filter finds it.
- **New visual tile / card / page** → add a numbered section in `app/public/_templates.html` (e.g. #25 Medical Tiles).
- **New deferred decision or known gap** → add a bullet to `BACKLOG.md`.

Each predeploy check should confirm these are in sync with the code shipping.

---

## 0. WHAT'S ON PROD RIGHT NOW

NAS is running **v202604.168.2** (most likely; verify with `cat /share/Docker/home-core/ghrava/app/version.txt`).

**v202604.169 is staged in sandbox only** — awaiting "package" + deploy.

---

## 1. WHAT v.169 SHIPS — Finance Finalization

PM drop. Al said "you are PM and tasked to finish finance module." Three locked groups, no migrations, additive only, all green.

### A. Schema bugs in finance/routes.js (6 fixed)
The 5 from BACKLOG.md v.167.1 audit + one bonus found by the validator while I was in there:
- L1340 — `import_category_rules.updated_at` removed
- L1419 — `subscriptions.monthly_amount` → `cost`
- L1429 — `med_visit_notes.provider` → LEFT JOIN `contacts` ON `physician_contact_id`
- L1439 — `hsa_payments.amount` → `you_paid`
- L1449 — `eobs` table → `med_eob_statements`
- **L1133 (bonus)** — `import_batches.row_count` → `rows_total` (was crashing the import path)

All paths annotated with `// schema: ...` comments per skill convention.

### B. Budget UI finalized
- `budgets.js` rewritten to read unified `transactions` table directly.
- New endpoints: `GET /summary` (lightweight totals) and `GET /history?year=` (12-month trend).
- `finance.html` Budgets tab: new monthly trend strip (12 colored bars) above the budget list.

### C. Cash-flow forecast — new feature
- New file `features/finance/forecast.js`, mounted at `/api/v1/finance/forecast`.
- `GET /?days=30|60|90` projects from `recurring_transactions`.
- Returns `summary` + per-day `daily[]` with running balance + items.
- `?starting_balance=N` override for what-if.
- Liquid-only starting balance (Checking/Savings/Cash/HSA).
- Surfaced in the Budgets tab as a full section: chip selector, 4-card summary, low-balance alert, running-balance bar chart, event list.

### D. Doc updates (per locked drop rule)
- `lens-config.js` — added `budgets` lens entry (category/year/status dimensions).
- `help.html` COMMANDS — 4 v.169 commands (forecast 30d, forecast what-if, budgets summary, budgets history).
- `STATE.md` — v.169 progress block.
- `HANDOFF.md` (this) — v.169 task list.
- `BACKLOG.md` — marked the 5 schema bugs FIXED, marked Budget UI and Cash-flow forecast SHIPPED.
- `SCHEMA.md` (root + app/) — regenerated from migrations.

---

## 2. TASK FOR THE NEXT CHAT (after Al runs v.169)

### Task A — Smoke test v.169 on prod
- Finance → Budgets tab loads, monthly trend strip renders 12 bars.
- Forecast section shows starting/income/expenses/ending and a chart of daily running balance.
- 30d/60d/90d chips switch the window.
- Hit `/api/v1/finance/forecast?days=30` directly — verify summary numbers match.
- Open a record-link from the "All" tab on a transaction that links to a subscription / EOB / visit / HSA payment — confirm the right side renders (was returning null before v.169 due to the schema bugs).
- Try a file import on the Import tab — `row_count` → `rows_total` fix should make this succeed instead of crashing.

### Task B — Remaining schema-bug cleanup (v.169.1 plumbing drop)
The validator still flags 28 pre-existing bugs in non-finance paths. Group by table:
- `attachments` (attachment_type, file_path, file_name) — 6 bugs across shared/folder-watcher + features/hsa.
- `subscriptions.monthly_amount` in `auto-link-subscriptions.js:43` — same fix as v.169 finance, missed shared.
- `hsa_payments.amount` in `folder-watcher.js:353` — same fix as v.169 finance, missed shared.
- Google sync columns — 4 bugs, whole code path may be broken since launch.
- Per-family-member columns (`perfumes.family_member_id`, `books.family_member_id`) — 2 bugs.
- Misc: daily_log, dashboard certifications, vehicles.insurance_contact_id, holdings.as_of_date.

Walk SCHEMA.md, fix each query against real column names, validator with --strict. Effort: medium (~2 hours).

### Task C — Reports tab live wiring
Forecast endpoint exists now (v.169). Wire it into the Reports `#26.1.5 Cash-flow forecast` chart. Replace the v.167 mockup with the real data.

### Task D — Universal Attachments (#28) v.170
Locked design in `_templates.html #28`. Schema migration + shared upload component + module-by-module migration. See BACKLOG.

---

## 3. DEPLOY PROCESS (unchanged)

1. Sandbox at `/home/claude/work/ghrava_drop/` or `/home/claude/build/ghrava/`
2. Predeploy gates:
   - Node syntax check all route files
   - Inline `<script>` syntax check all HTML
   - Schema validator (`python3 .../validate-schema.py --strict`) — finance/* must be clean
3. Zip layout: top-level (no `ghrava/` wrapper) — `app/`, `STATE.md`, `HANDOFF.md`, `BACKLOG.md`
4. Always include `version.txt`, `STATE.md`, `HANDOFF.md`, `BACKLOG.md`, `SCHEMA.md`
5. Al downloads to `~/Downloads`, runs `ghrava_deploy.ps1` → robocopies into `Z:\ghrava\`
6. SSH NAS: `docker restart ghrava` (~2s)
7. `--build` only when `package.json` changes (it didn't in v.169)

---

## ⏪ v.167 / v.168 history (kept for reference below)

---

## 1. WHAT v.167 SHIPS

Big drop. PM-style: Al asked to finish Finance. v.167 lands the cross-module auto-linker scaffolding that everything else depends on, plus LP-FSA UI, plus Reports design lock + 2 mockups.

### A. Template design locks (`_templates.html` 3 new sections)
- **#26 Reports Design** — Settings-style grouping, plain-English titles, mandatory drill-down. 3 groups × 4-5 charts each = 13 charts spec'd.
- **#27 Auto-Linkers Pattern** — 4-step shape: match → confidence → review surface → manual override. Shared infrastructure spec.
- **#28 Universal Attachments** — design locked; BUILD in v.168. One file + many record_links, refcount-based file lifecycle, ~14 modules affected.

### B. Migration 132 — `record_links` +4 cols (confidence, needs_review, source, reviewed_at) + partial index on needs_review

### C. Auto-linkers (locked per #27)
- **#27.1 txn → hsa_payment** (`shared/auto-link-hsa.js`) — HIGH: account_type='HSA' OR account_name LIKE '%HSA%'
- **#27.2 txn → medical_visit** (`shared/auto-link-medical-visit.js`) — HIGH: vendor exact match contact AND visit ±7d; MEDIUM if further
- **#27.3 EOB → hsa_payment** (`features/medical/eob-hsa-matcher.js`) — HIGH: same patient (required) + amount ±$0.50 + date ±14d. Provider/Dr match is BONUS only. MEDIUM: ±$2 or ±30d
- **#27.4 subscription category copy** (`shared/auto-link-subscription-category.js`) — `applyOne(txnId)` ongoing + `runRetroactive(days=90)` for the manual button
- Shared helper: `shared/auto-link.js`

### D. Cross-module endpoints (`features/links/routes.js`)
- `GET /api/v1/links/needs-review`
- `POST /api/v1/links` (manual link)
- `POST /api/v1/links/:id/confirm`
- `DELETE /api/v1/links/:id`
- `GET /api/v1/links/for/:type/:id`
- `POST /api/v1/links/run/eob-hsa-matcher` (backfill button)
- `POST /api/v1/links/run/subscription-categories?days=90` (retroactive button)

### E. Finance import wiring
- `finance/routes.js` import-confirm fires all 3 txn-side linkers in best-effort try/catch after each row insert (subscription, hsa, visit, sub-category).

### F. HSA & LP-FSA Plans Settings panel
- New rail item in Settings → Imports & rules.
- Single form: year, plan_type (HSA / LP-FSA / Medical FSA / Dep-Care FSA), plan_name, annual_limit, contributions, employer_contribution, deadline_date, custodian, carryover_amount, active, notes.
- Backed by existing `fsa_plan_info` table (mig 118 — already supports all plan_types).
- Edit existing rows inline. Active count appears as rail pill.

### G. Reports Charts (preview) tab
- New `/reports.html?tab=charts` tab.
- Renders #26 design: 3 groups (Money, Health, Household) × 4-5 cards each.
- 2 cards have working SVG mockups: Sankey income→categories (Money group), BP line with healthy zone shaded (Health group).
- Remaining 11 are stubs with "Mockup pending" + target-version labels.

### H. Review surface — floating pill widget
- `app/public/js/review-pill.js` loaded by `nav.js` on every page.
- Bottom-right pill, hidden when count=0.
- Click → slide-over drawer listing each needs_review link with Confirm / Unlink buttons.
- Polls every 60s.

### I. Doc updates (per locked drop rule)
- `lens-config.js` — new `record_links` lens entry with confidence/needs_review/source/kind dimensions
- `help.html` COMMANDS — 3 v.167 commands (EOB→HSA matcher backfill, retroactive sub-category, needs-review list)
- `BACKLOG.md` — v.167 LOCKED SCOPE + v.168 QUEUED SCOPE blocks at top
- `STATE.md` — v.167 progress block
- `HANDOFF.md` (this) — v.167 task list

---

## 2. TASK FOR THE NEXT CHAT (after Al runs v.167)

Resolve in order:

### Task A — Smoke test v.167 on prod
- LP-FSA Settings panel renders + saves
- Reports → Charts (preview) tab loads, 2 SVG mocks render correctly
- Import a test transaction on HSA account → confirm hsa_payment created + linked
- Import a test transaction matching Dr. Goyal's name → confirm visit link or needs_review entry
- Run EOB→HSA matcher backfill (`curl -X POST .../links/run/eob-hsa-matcher`) → check needs-review pill count

### Task B — Al picks visual direction for charts
- Confirm or replace #26.1.1 Sankey style + #26.2.1 BP line style.
- Once locked, v.167.1 builds remaining 11 charts in Group 1 + 2 with real data.

### Task C — Build v.168: Universal Attachments
- Schema migration (record_links + attachments columns, backfill script)
- Smart pre-check matcher endpoint
- Shared upload dialog component `/js/universal-attach.js`
- Migrate Inventory + HSA + Medical first (highest-value path)
- Migrate remaining 11 modules
- Confirm-with-holder-list unlink dialog
- Settings "Shared attachments" viewer
- See `_templates.html #28` for full design spec

### Task D — Reports Group 1 live build (v.167.1 or v.168)
- Once Al picks visual direction (Task B), wire real data:
  - #26.1.1 Sankey: query `transactions` grouped by month + category
  - #26.1.2 Calendar heatmap: txns grouped by day
  - #26.1.3 Vendor treemap: txns grouped by merchant, sized by sum(amount)
  - #26.1.4 Small-multiples: per-category month-over-month line
  - #26.1.5 Forecast line: requires new `/finance/forecast?days=90` endpoint reading `finance_recurring`

### Task E — Medical schema gaps
- Add `med_immunizations`, `med_procedures`, `med_family_history`, `med_referrals` tables (per BACKLOG)
- High priority given Algir's cardiac arteriosclerosis → cardiac procedures coming

---

## 3. DEPLOY PROCESS (unchanged)

1. Sandbox at `/home/claude/work/ghrava_drop/`
2. Predeploy gates:
   - Node syntax check all route files
   - Inline `<script>` syntax check all HTML
   - Migration simulation against shape-mirror live DB
3. Zip layout: top-level (no `ghrava/` wrapper) — `app/`, `STATE.md`, `HANDOFF.md`, `BACKLOG.md`
4. Always include `version.txt`, `STATE.md`, `HANDOFF.md`, `BACKLOG.md`
5. Al downloads to `~/Downloads`, runs `ghrava_deploy.ps1` → extracts to `Z:\ghrava\`
6. SSH NAS: `docker restart ghrava` (~2s) — applies pending migrations automatically
7. `--build` only when `package.json` changes (it didn't in v.167)

---

## ⏪ v.166 history (kept for reference)

---



---

## 0. WHAT'S ON PROD RIGHT NOW

NAS is running **v202604.165** (most likely; verify with `cat /share/Docker/home-core/ghrava/app/version.txt`).

**v202604.166 is staged in sandbox only** — awaiting "package" + deploy.

---

## 1. WHAT v.166 SHIPS

A bigger drop than usual (Al said "bigger builds" is fine). Combines:

### A. Drafts → Templates migration
- `_drafts/*.html` (24 subpages + `_drafts.css`) moved to `app/public/_templates/*.html`
- All inner refs updated (`/_drafts/` → `/_templates/`, `_drafts.css` → `_templates.css`, breadcrumb "← Drafts index" → "← Templates index")
- `_drafts.html` redirect shim deleted; `_drafts/` directory removed
- `nav.js` link renamed Drafts → Templates, href `/_templates.html`, `data-drafts-link` → `data-templates-link`, version bump in comment

### B. Medical Overview tab (M1–M6 tiles)
- New tab `medical.html`, default landing (was "All")
- Pattern: same 5-zone tile primitive as Finance #18 (eyebrow + hero + pill + rows + strip)
- 6 tiles read existing endpoints (no new aggregator):
  - M1 Active conditions (count + top 3 + severity pill)
  - M2 Active medications (count + refill-due warning + top 3)
  - M3 Upcoming visits (next 30d count + next 3 scheduled)
  - M4 EOB your-share (total + latest 3 statements)
  - M5 Recent vitals (latest BP + HR + weight + O2 sat)
  - M6 Family snapshot (per-member condition + med counts)
- **Empty state rule locked (Al v.166):** tile structure ALWAYS renders. Values go to 0 / "—" / mute pill; rows preserved. NEVER a "no data" placeholder card.
- 3-up desktop `repeat(auto-fit, minmax(320px, 1fr))`, phone scroll-snap pager <700px
- Click → tab in MED_TILE_TAB_TARGETS routes to detailed view

### C. Migration 131 — medical schema expansion
- Additive only (no DROP, no CASCADE). Idempotent. Transaction-wrapped.
- 25 new columns across `contacts`, `med_conditions`, `med_medications`, `med_eob_claims`, `med_eob_services`
- 4 new tables: `med_lab_results`, `med_diagnostics`, `med_allergies`, `med_vitals_readings`
- `med_diagnostics.test_date` is NULLABLE — pending tests have no date
- Each new table has dedup_hash with UNIQUE index for idempotent re-import
- Marker table `_migrations_medical_expansion_done` for verification
- **Sim verified:** Python sqlite3 against shape-mirror DB — 25 cols + 4 tables present, idempotent re-run OK, 76 seed rows insert cleanly

### D. Bulk-seed endpoint
- `POST /api/v1/medical/bulk-seed` in `app/features/medical/seed-routes.js`
- Body: `health_seed.json` shape (patient, care_team, conditions, medications, labs, vitals, diagnostics, allergies)
- requireAuth (writes)
- Resolves family member by `family_member_id` OR `patient.name` exact OR first-word match
- Idempotent: dedup_hash per record (e.g. lab hash = sha256(fm|test_name|test_date|value))
- Supports `?dry_run=1` to preview counts without writing
- Maps to EXISTING `med_*` tables (per the architecture rule "use existing tables, never create parallel schemas")
- Mounted alongside `medical/routes.js` in `server.js`

### E. Seed CLI tool
- `app/scripts/seed-medical.js` — Node CLI for one-shot seed import
- Usage: `docker exec -it ghrava node /app/scripts/seed-medical.js --file /app/seeds/medical_algir.json [--dry-run]`
- Reads JSON, POSTs to bulk-seed, prints per-section results

### F. Algir's seed bundled
- `app/seeds/medical_algir.json` (15 KB) — from `medical_module_-_ghrava_upload.zip` (Apr 2026)
- Contains: 6 care team, 14 conditions, 14 medications, 26 labs, 8 vitals, 7 diagnostics, 1 allergy

### G. Kids ↔ family_members auto-sync
- `kids/routes.js` GET / now auto-creates `kids` rows for any `family_members` row with relationship in (Son, Daughter, Child, Stepson, Stepdaughter, Stepchild) AND is_active=1 that doesn't have one
- **Fixes the known Risha-not-showing bug**
- Wrapped in try/catch so sync failure doesn't break list endpoint

### H. Lens config for new fields
- `app/public/js/lens-config.js` extended:
  - `medical_medications` gains: route, mail_order, ndc, source
  - `medical_conditions` gains: icd10, severity, source
  - `medical_eob` gains: claim_status, place, diagnosis (ICD-10), npi
  - NEW: `medical_labs`, `medical_diagnostics`, `medical_allergies`, `medical_vitals`
- **Locked rule (Al v.166):** every schema column added MUST appear in lens-config.js so the global lens/advanced-filter can search on it. Al's words: "ensure that fields added to a module are available in lens search / advanced filter replacement."

### I. GET endpoints for new tables
- `GET /api/v1/medical/labs`, `/diagnostics`, `/allergies`, `/vitals` — all support `?family_member_id` filter and `?limit` (default 500, max 500)
- Public reads (no auth) — consistent with rest of medical module

### J. BACKLOG.md (NEW persistent memory file)
- Top open decisions, cross-module wiring not-yet-built, schema gaps, reports engine design, known bugs, security audit, v140 loose ends, draft pages map, workflow rules
- **Bundled in every deploy zip from v.166 forward**
- Old April-2026 backlog archived as `BACKLOG_OLD_apr2026.md`

---

## 2. TASK FOR THE NEXT CHAT (after Al runs v.166)

Resolve in order:

### Task A — Smoke test v.166 on prod
Al will need to confirm:
- Medical Overview tab loads, 6 tiles render (likely mostly empty pre-seed)
- Templates nav link works, points to `/_templates.html`, all `_templates/*.html` subpages load with breadcrumb "← Templates index"
- Kids page shows Risha (and Arnav)
- Run dry-run seed: `docker exec -it ghrava node /app/scripts/seed-medical.js --file /app/seeds/medical_algir.json --dry-run` → should show mapped family + counts, no errors
- Run real seed (drop --dry-run) → Medical Overview should populate

### Task B — IF seed worked: Build #25 Medical Overview Tiles template page
- Add to `_templates.html` as section #25 with the M1–M6 spec (parallel to #18 Finance)
- Same numbered breakdown: hero / pill / rows / strip, what each tile reads, click target
- This locks the design so future chats don't reinvent

### Task C — Reports engine design discussion (BLOCKING for #2 build)
- Al wants vertical slice (BP 2yr) + horizontal slice (all stats 6mo)
- See `BACKLOG.md → 🛠 Reports engine — design needed before code` for shape proposal
- Need from Al: canonical metric_name vocabulary, default time windows per metric, plot types per metric
- Once designed, build `metric_index` view in a new migration + reports page reads from it

### Task D — Medical "Receipts" tab (v140 deferred, design exists)
- Single-flow PDF upload: drop in Medical → file routed to Documents + medical record created + auto-linked via record_links
- Discussed extensively v.7 → v.20. Worth doing next.

### Task E — Other family members' seed JSONs
- Process: re-engage medical-conversion chat with Zarna/Arnav/Risha PDFs → receive their JSONs → drop into `app/seeds/` → run CLI tool
- Endpoint dedups by family_member_id + content hash so re-running is safe
- Risha is now in family_members + kids (after v.166 auto-sync) so her family_member_id is available

---

## 3. DEPLOY PROCESS (unchanged)

1. Sandbox at `/home/claude/work/ghrava_drop/`
2. Predeploy gates (5):
   - Node syntax check all route files
   - Inline `<script>` syntax check all HTML
   - Script dependency check (e.g. lt-refs.js included on pages using GH_REFS)
   - Migration simulation against shape-mirror live DB
   - HTML inline syntax extraction
3. Zip layout: top-level (no `ghrava/` wrapper) — `app/`, `STATE.md`, `HANDOFF.md`, `BACKLOG.md`
4. Always include `version.txt`, `STATE.md`, `HANDOFF.md`, `BACKLOG.md`
5. Al downloads to `~/Downloads`, runs `ghrava_deploy.ps1` → extracts to `Z:\ghrava\`
6. SSH NAS: `docker restart ghrava` (~2s) — applies pending migrations automatically
7. `--build` only when `package.json` changes (it didn't in v.166)

---

## 4. KEY ARCHITECTURE FACTS (carry forward)

- **DB:** `data/lifetracker.db` (NOT ghrava.db). `journal_mode = DELETE`, `synchronous = FULL`. No CASCADE going forward.
- **Auth:** `requireAuth` ONLY in `settings/routes.js` + `watcher/routes.js`. All GETs public.
- **Family members:** Algir (id=1, self), Zarna (spouse), Arnav (son), Risha (daughter). All in `family_members` table. Kids table auto-syncs from family_members starting v.166.
- **`finance_accounts` (banking VIEW) ≠ `financial_accounts` (investment VIEW)** — both unified into `accounts` in mig 130.
- **`med_physicians` dropped** — use `contacts` with `type='medical_provider'`.
- **`record_links`** (mig 129) — universal polymorphic junction. Vocab: `transaction | subscription | medical_visit | hsa_payment | eob | document`.
- **EOB:** Aetna MHBP only. Existing mig 054-057 + 124 + 131 schema captures every field needed for matching, audit, appeals — even non-display fields (NPI, diagnosis_codes, denial_reason_codes, etc.).

---

## (Below: v.165 history kept for reference)

---

## 0. WHAT'S ON PROD RIGHT NOW

NAS is running **v202604.159 code + v202604.164 templates**. If
`cat /share/Docker/home-core/ghrava/app/version.txt` shows `.164`,
prod is current with what was last shipped.

**v202604.165 is staged in sandbox only** — it ships the work the
previous `HANDOFF.md` queued as Task A + Task B.

---

## 1. WHAT v.165 SHIPS

Three files + version bump. The two Task A/B items from the previous
handoff are done; everything else from the v.164 handoff queue is
unchanged.

### Task A (done): v.150 finance tiles wired into `finance.html`

- **Backend `/api/v1/finance/landing` rewritten** to the v.150
  payload shape. New fields:
  - `net_worth.total_assets / .total_liabilities / .sparkline[]`
    (last value per month from `net_worth_snapshots`, trailing 12).
  - `cash_flow.mtd_net / mtd_in / mtd_out / prior_month_net /
    ytd_net` — full prior-month net, not same-day MTD.
  - `credit_cards.top[]` (3 by owed), per-card `util` (whole percent),
    aggregate `util_pct`, `next_due: {days, min_payment}`,
    `others_count / others_owed`.
  - `bank_accounts.liquid_total / checking_total / savings_total /
    stale_count / stale_label / stale_oldest_days` (stale =
    `balance_as_of` older than 14 days).
  - `holdings.top[]` (3 by market_value) + `others_count /
    others_value`, total `cost_basis` + `gain_pct`.
  - `hsa_lpfsa` semantics: **unreimbursed receipt pool**, not HSA
    account balance. Counts & sums `hsa_payments` and `fsa_payments`
    where `reimbursed = 0`. `lpfsa_deadline_days` from current-year
    `fsa_plan_info.deadline_date`.
- **`app/public/finance.html`**:
  - 6 static `<div class="fin-tile" data-tile="…">` blocks replaced
    with single `<div id="finTilesGrid" class="fin-tiles-grid">`.
  - Sample-fallback machinery removed (`FIN_TILE_SAMPLE`,
    `applyTileSampleFallback`, `clearTileSampleState`, `FIN_TILE_FMT`,
    `setTilePart / setTilePill / setTileDot`, `daysUntil`, and the
    branching v.158 `loadLandingTiles`). ~14.5 kb dead code gone.
  - v.150 renderers copied **byte-identical** from `_templates.html`
    #18 (`_finK / _finM / _finC / _finPct / _finDot / _finPill /
    _finTileNetWorth / _finTileCashFlow / _finTileCreditCards /
    _finTileBankAccounts / _finTileHoldings / _finTileHsaLpfsa /
    _emptyTile`).
  - New 30-line `loadLandingTiles()` fetches `/finance/landing` and
    concatenates the 6 renderer outputs.
  - Onclick + `role="button"` + `tabindex="0"` + Enter/Space keyboard
    navigation attached post-render via
    `FIN_TILE_TAB_TARGETS = ['networth','transactions','accounts',
    'accounts','holdings','hsa']`.
  - Error path renders an inline red monospace message in the grid.
- **CSS additions:** `.fin-tile-pill--mute` and `.fin-tile-dot--mute`
  (used by `_emptyTile()` and the no-prior-snapshot pill).

### Task B (done): medical tiles 3/2/1 with phone scroll-snap

- **`app/public/medical.html`** `.medv5-grid` upgraded:
  - Desktop: `grid-template-columns: repeat(auto-fit, minmax(380px,
    1fr))` — 3-up wide / 2-up mid / 1-up narrow above the phone
    breakpoint.
  - Phone (≤700px): flex + `scroll-snap-type: x mandatory` for a
    one-card-per-viewport pager. Matches the existing
    `.medv5-grid--all` All-tab pattern.

### Version

- `app/version.txt` → `202604.165`.

---

## 2. v.165 VERIFICATION DONE IN SANDBOX

- **`node --check`** on `app/features/finance/routes.js` — clean.
- **Inline `<script>` syntax check** on every `<script>` block in
  `finance.html` (5 blocks) and `medical.html` (4 blocks) — clean.
- **Integration smoke**: spun up an express router against an in-
  memory SQLite DB matching the unified schema + a representative
  seed dataset (3 banks, 4 credit cards, 4 holdings, 6 transactions,
  11 monthly snapshots, 3 HSA receipts, 2 FSA receipts, current-year
  FSA plan). Hit `/api/v1/finance/landing`, asserted 22 shape
  predicates. All pass; numbers match `_templates.html` #18 sample
  numbers (e.g. cc.next_due.days = 7, holdings.others_count = 1,
  lpfsa_deadline_days = 47).
- **JSDOM smoke**: extracted the renderer block from `finance.html`,
  rendered against both the real-data payload AND an all-empty
  payload. Verified:
  - 6 `.fin-tile` elements in each mode
  - Net worth: 12 sparkline bars
  - Cash flow: `.fin-tile-cf-bar` present
  - Credit cards: 2 util mini-bars (3rd card has no `credit_limit`)
  - Holdings: 3 positive-gain spans
  - Empty: 4 `_emptyTile()` mute-dot tiles + net_worth/cash_flow
    show $0 hero through their own renderers

**Not yet verified:** behavior against Al's actual production DB.
Migration risk = none (no schema changes). Behavior risk = backend
shape change → frontend renderer expects the new shape. If anything
goes wrong, the tiles will render with `$0` / "empty" pills, not
crash.

---

## 3. DEPLOY PROCESS

### Al's flow (Windows PC → NAS → Docker)

1. Claude packages `Ghrava_DEPLOY.zip` (top-level layout — `app/`,
   `docker-compose.yml`, etc. — **no `ghrava/` wrapper**) and uses
   `present_files`.
2. Al downloads to `~/Downloads`.
3. Al runs `ghrava_deploy.ps1` in PowerShell — finds the zip,
   extracts, robocopies to `Z:\ghrava\`, detects whether
   `package.json` changed, prints the right next command.
4. Al SSHes to NAS:
   - `docker restart ghrava` (~2s) for normal code changes
   - `docker compose up --build -d` (~90s) only if `package.json`
     changed
5. **Static-only changes** (HTML/CSS/JS in `app/public/`) need no
   docker restart — just hard-refresh browser (Ctrl+Shift+R).

For v.165, code paths changed (`features/finance/routes.js`), so
`docker restart ghrava` is required.

### Paths

- **NAS path:** `/share/Docker/home-core/ghrava/`
- **From Al's PC:** `Z:\ghrava\` (mapped share)
- **Inside container:** `/app/`
- **DB filename:** `lifetracker.db` (NOT `ghrava.db` — common mistake).
  Lives at `data/lifetracker.db`.
- **URL:** `http://192.168.4.62:3001` local · Tailscale also configured.

### Diagnostics

QNAP has no `sqlite3` CLI. Use the container:

```sh
docker exec ghrava node -e "
const db = require('better-sqlite3')('/app/data/lifetracker.db');
console.log(db.prepare('SELECT COUNT(*) AS n FROM accounts').get());
"
```

Logs:
```sh
docker logs ghrava --tail 50
docker logs ghrava 2>&1 | grep -E 'FAILED|RESCUE|running on port' | tail -20
```

### v.165 smoke after deploy

1. Open `/finance.html`. Overview tab is default. Expect 6 tiles
   rendering real numbers from the live data (3 accounts unified +
   76 transactions from the v.159 rescue).
2. Click any tile — should switch to the corresponding tab.
3. Open `/medical.html` on a phone (or resize to ≤700px). Cards
   should pager-scroll horizontally one-at-a-time. Resize to ~900px
   → 2 columns. Resize to ~1300px → 3 columns.

If a tile shows "empty" with $0 / mute pill — the backend returned
no rows for that tile's category. That's expected behavior (e.g.
holdings tile may be empty if no positions yet).

If a tile crashes / shows the red error line — capture `docker logs
ghrava --tail 50` and the JSON from `curl http://localhost:3001/
api/v1/finance/landing` before theorizing.

---

## 4. NEXT-DROP PRIORITIES (after v.165 confirmed)

### Finance module cleanup capstone

- Drop the 7 `_legacy_*` tables from mig 130 rescue.
- Drop `accounts_beneficiaries` (empty, pre-existing table moved
  aside by mig 130).
- Single migration #131. Wait for explicit Al go.

### Finance module Tile-2 budget target

- Tile 2 (Cash Flow) currently shows "on track" / "overspending"
  based on `mtd_net` sign alone. The locked design idea was to add
  a monthly budget target — design discussion deferred.
- Needs: budget UI in Settings or Finance, schema for monthly
  budgets, comparison in tile renderer.

### Outside finance

Same backlog as v.164's handoff — none touched in v.165:

- Today page (Now/Soon/30-day pipeline) — locked design, not built.
- Drafts pages still need readability pass + status board.
- Reports `.rep-row` not found bug.
- Reports panels open as center modals (sub-panel CSS leak).
- Todos page renders neither `.todo-item` nor `.empty-state`.
- Multi-kid bug (kids table vs family_members not auto-syncing).
- 11 stale Playwright selectors.

### v140 loose ends

- EOB folder-drop persistence (`importEob` counts but doesn't save).
- LP-FSA plan info Settings UI (only API exists).
- Mileage UI on medical visit form (backend ready, frontend
  doesn't expose `round_trip_miles`).
- Medical "Receipts" tab to host v140 inbox/vault.
- Documents / insurance / subscriptions don't use `attach-lifecycle`.

### Security audit (separate small drop)

- `window.esc` doesn't escape `/\'`.
- Attach route should allowlist `entityType`.
- `/file/:id` and `/thumb/:id` missing path-allowlist.
- `/api/v1/app/test-results` unauthenticated.
- CORS wide open.
- `fmtMoney` / `formatDate` redefined across pages despite `lt-core`.
- `global-search.js` has own `esc()`.
- `migrate.js` parser splits on `;` before stripping `--` comments.

---

## 5. WORKING RULES (override all other instincts)

These came up explicitly in recent chats. Burn them in.

### Build mode default

- No explanations, summaries, recaps, or test plans unless asked.
- Confirm decisions in one line. Ask blocking questions only. Build.
- No recaps after work.
- One thing per drop. Don't bundle UI fix with destructive migration.

### Never invent design

- If Al says "the agreed design" — **find it yourself**. Search prior
  chats with `conversation_search`. Check `STATE.md`, `_templates.html`,
  uploaded zips. The design exists somewhere. Don't make Al find it.
- If Al gives an instruction, follow it. Don't reinterpret it as a
  feature spec to "improve."
- Invented numbers, copy, or tile structure = Claude failing.
  Em-dashes fine. Real data fine. `_emptyTile()` pattern ($0 /
  "empty" pill / hint) fine. **Invented numbers not fine.**
- Visual design lives in `_templates.html` as numbered patterns
  (#1, #18, #18.1). Drafts page is text-only.
- "Cards" and "tiles" are interchangeable in Al's vocabulary. Both
  refer to the rendered components.

### Don't package without "package"

- Even after a complete fix, wait for Al to say "package."
- Exception: explicit "package now" during a build.
- **Don't package for small things to save tokens.** Bundle multiple
  fixes into one drop where possible.
- Bigger builds preferred.

### DB safety

- `journal_mode=DELETE`, `synchronous=FULL`. **Never WAL.**
- **No `ON DELETE CASCADE` anywhere, ever.**
- Migrations: additive only. Renames go in `UPGRADE_NOTES.md` first.
- **Always ask for `docker logs ghrava --tail 50`** before
  theorizing. Never guess.
- Verify column names against live DB schema before writing route
  code.

### Predeploy gates (5)

Before any deploy zip:
1. Node syntax check all route files
2. HTML inline script syntax check
3. Script dependency check (pages using `GH_REFS` need `lt-refs.js`)
4. Migration simulation against live DB (savepoints, rollback) —
   skip if no migration in drop
5. Parser tests (12/12 banks pass) — skip if no parser change

### Files Claude consults before editing

- `STATE.md` — current state, version log, locked decisions
- `UI_STANDARDS.md` — read before any frontend change. Copy existing
  patterns; never invent CSS classes.
- `WIRING.md` — module interconnections
- `MODULES_DESIGN.md` — per-module data design
- `BACKLOG.md` — pending work
- `_templates.html` — visual design source of truth
- This file (`HANDOFF.md`) — what the prior chat figured out

---

## 6. KEY ARCHITECTURE FACTS (locked, do not re-litigate)

### Schema

- `finance_accounts` (banking, was a table, now a VIEW over unified
  `accounts`) ≠ `financial_accounts` (investment, was a table, now
  a VIEW). Mig 130 unified both.
- `accounts` is the unified table. Has columns from both old tables
  + 12 credit-card fields + an `alias` column.
- `transactions` is the unified transactions table.
  `source='manual'|'imported'`. Views `finance_transactions` (manual)
  and `imported_transactions` (imported) on top.
- Account type vocab LOCKED: `Checking`, `Savings`, `Credit`, `Cash`,
  `HSA`, `Brokerage`, `TSP`, `Retirement`, `Loan`, `Mortgage`,
  `Other`. Unknown → `Other` + `needs_review=1`.
- `med_physicians` dropped. Contacts are flat 8-type table.
- `record_links` is the universal cross-module link table (mig 129).
  Symmetric junction; application layer chooses left/right.

### Finance landing route shape (v.165)

`GET /api/v1/finance/landing` returns:

```
{
  generated_at,
  net_worth:     { total, total_assets, total_liabilities, mom_delta, sparkline[] },
  cash_flow:     { mtd_net, mtd_in, mtd_out, prior_month_net, ytd_net },
  credit_cards:  { count, total_owed, util_pct, top[], others_count, others_owed, next_due:{days,min_payment} },
  bank_accounts: { count, liquid_total, checking_total, savings_total, stale_count, stale_label, stale_oldest_days },
  holdings:      { count, market_value, cost_basis, gain_pct, top[], others_count, others_value },
  hsa_lpfsa:     { total_pool, hsa_count, hsa_pool, lpfsa_count, lpfsa_pool, lpfsa_deadline_days }
}
```

Renderers in `finance.html` mirror those in `_templates.html` #18
byte-identically. **Changing either side requires mirroring on the
other.**

### Migration runner

- `app/db/migrate.js` sorts by filename, runs each in own
  `db.transaction()`. Failure logged but doesn't abort the run.
- JS migrations require own idempotency check (marker table like
  `_migrations_<name>_done`).
- `_migrations` tracks runner-completed files. `_migrations_*_done`
  markers track which schema blocks actually committed.
- SQLite indexes are global. `CREATE INDEX` fails if name exists on
  ANY table. Defensive migs drop name first.

### Auth

- `requireAuth` only in `settings/routes.js` and `watcher/routes.js`.
  All other routes public — browser `<img>` tags can't send auth
  headers. Keep public reads public.
- Password protects Settings changes only.

### Shared utilities

- `app/public/js/lt-core.js` — `GH_VIEW`, `GH_FAMILY`, `GH_TAGS`,
  `GH_SELECT`, `window.api`, `window.esc`
- `app/public/js/lt-refs.js` — `GH_REFS` (contact pickers, must be
  loaded on every page using it)
- `app/shared/autoTodos.js` — `syncAutoTodos()`,
  `syncMedRefillTodos()`
- `app/shared/tx-fingerprint.js` — fingerprint v2 normalizer
- `app/shared/errors.js` — 500 error logging

---

## 7. `_templates.html` SECTIONS

Source of truth for visual design.

- **#1 Medication** (LOCKED)
- **#2 Inventory** (LOCKED)
- **#3 Todo** (LOCKED)
- **#4 Subscription** (LOCKED)
- **#5 Certification** (LOCKED)
- **#6 Condition** (LOCKED)
- **#17 Summary Tile** (DRAFT, piloted on Medical) — #17.1 Visits/EOBs,
  #17.2 Reimbursement vault
- **#18 Finance Overview Tiles** (LOCKED v.150, added v.164) — the 6
  finance tiles, real-data + empty state, both rendered live. THE SPEC.
  **Now byte-identical to `finance.html` renderers (v.165).**

Drafts list (text-only) below the templates. `/_drafts.html` is a
redirect to `/_templates.html#drafts`. One page going forward.

---

## 8. THE "I MESSED UP" PATTERN

If Al points out Claude invented something not in the agreed design:

1. Don't argue. Don't ask Al to find proof. **Search yourself** —
   `conversation_search`, prior chats, uploaded zips, the doc files.
2. If you genuinely can't find it, say so plainly and ask where.
3. Apologize once, briefly. No long mea-culpa paragraphs.
4. Revert to the agreed state. Don't try to "improve" it.

If the deploy zip you produced is wrong, package a corrected one.
Don't tell Al to re-deploy from the wrong zip.

---

## 9. ONE-LINE STATUS

**v.165 staged. Task A (finance tiles wired to v.150 spec) + Task B
(medical 3/2/1 scroll-snap) done. 22 shape assertions + JSDOM
renderer smoke pass. Not yet packaged — awaiting "package".**
