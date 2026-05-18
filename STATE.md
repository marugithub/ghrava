# Ghrava — Build State (Handoff)

> **Read this first.** Updated on every drop. Source of truth for what's
> shipped, what's in flight, what's blocked, and what to do next.
>
> If you're a new Claude chat reading this: scan all sections, then ask
> Al "ready?" before building. Do not re-litigate locked decisions.

---

## 🧭 CORE PRINCIPLES (locked 2026-05-15, v.171)

These four sentences govern every design and code decision. When a chat
proposes something that conflicts with these, the chat is wrong, not the
principles.

1. **Ghrava exists to make personal data easy to understand, easy to link
   together, and easy to display.** Every feature serves one of those three
   verbs — *understand*, *link*, *display*. If a feature doesn't, it
   doesn't ship.

2. **Plain English everywhere user-facing.** Labels, buttons, tooltips,
   error messages, report titles, prompts — all written for a smart
   non-technical reader. "Categorize this fuel charge — which vehicle?"
   not "Assign tx_id 4821 to vehicle FK". Jargon belongs in code comments,
   never on screen.

3. **Plain English in chat too.** Al is non-technical. When the chat
   asks a question, presents an option, or describes a feature, it
   translates internal terminology to plain English first. The chat
   asks itself "would Al's neighbor understand this sentence?" before
   sending. Technical terms appear only when Al uses them first or
   when explicitly asked.

4. **Package less frequently but safely.** Bigger, fully-tested drops
   beat tiny frequent ones. No packaging without Al's explicit "package"
   word. Gates green before any zip is built.

5. **"Tile" and "card" mean the same thing.** Both refer to a bounded
   visual object that holds multiple data points about one record
   (status, name, key fields, cross-module strip, attachments, action
   menu). Reference visual: medication card in `_templates.html` #1.
   Use either word interchangeably in chat and prose.

6. **Every dataset gets multiple views, never just one.** Any page that
   lists records (inventory, medical meds, finance transactions, pending
   items, etc.) wires `GH_VIEW.init()` with at minimum **grid + list**
   toggles. Some pages add a third view appropriate to the data
   (`inventory` uses `gallery`, `finance` uses `card`). The grid renders
   tiles in 2–5 columns. The list renders dense one-line rows. State
   persists per page in `localStorage`. New listing pages MUST follow
   this pattern — no single-view pages.

---

> ## 📚 Required reading per chat (locked v.166), in order:
> 1. **`STATE.md`** (this file) — current state
> 2. **`HANDOFF.md`** — next chat's task list + deploy process
> 3. **`BACKLOG.md`** — every deferred idea, gap, decision; cross-chat persistent memory
> 4. **`app/public/_templates.html`** — numbered visual design specs (#1, #18, M1–M6, etc.)
>
> ## 🔁 Required documentation updates per drop (locked v.166):
> Every drop that adds the following MUST also update the corresponding doc:
> - **New CLI / docker exec / one-time operational command** → append to `app/public/help.html` → `COMMANDS` array. User reaches it via Help → Commands.
> - **New schema column or table** → register in `app/public/js/lens-config.js` so the global lens/advanced-filter finds it.
> - **New visual tile / card / page** → add a numbered section in `app/public/_templates.html` (e.g. #25 Medical Tiles).
> - **New deferred decision or known gap** → add a bullet to `BACKLOG.md`.
> Each predeploy check should confirm these are in sync with the code shipping.

---

## ✅ v.173 SHIPPED — Asterisk subsystem: per-record math + HSA tile (2026-05-17)

> **Built, committed, pushed. NOT yet packaged/deployed** — awaiting
> Al's "package". Against the live v.172 NAS the new
> `asterisk-per-record` spec is intentionally red; it goes green once
> v.173 is deployed.

Canonical mechanism locked in: the v.171 `/api/v1/pending/asterisk`
probe + `GhAsterisk.scan()` DOM helper. The card-config asterisk path
(`gh-card-shared.js`) stays inert pending a v.174 decision.

### What shipped
1. **Per-record asterisk math** (`app/features/pending/routes.js`). All
   six detectors take an optional record id; omitting it preserves the
   v.171 global queries byte-for-byte. `/asterisk` threads `record_id`
   through. `hsa_payment` gained an amber tier (>5 red, 1-5 amber)
   mirroring `vehicle_fuel`. No tables, no migrations — read-only query
   edits. New `tests/asterisk-per-record.spec.js`.
2. **HSA tile wired** (`app/public/hsa.html`). The Eligible Expenses
   tile carries the asterisk via the v.171 `.gh-pending-target` pattern
   (global `hsa_payment` probe — the page is a pot-level dashboard with
   no per-account id). First real consumer of `GhAsterisk.scan()`.
3. **`LOCKED.md`** — new `ASTERISK-MATH` architectural row.

### Deferred (not in v.173)
- Vehicles page + its fuel asterisk — module is still DRAFT #19,
  unbuilt. v.174 candidate.
- Medication HSA-YTD return to the card — Al product decision. v.174.
- Card-config asterisk path: retire it, or build per-record into it as
  a second mechanism. v.174 decision.

### Verification note
`bash gates.sh` is Linux/container-only, not run on the Windows dev
host (normal — runs at packaging). Local: `node -c` on changed JS +
the new spec. Live-NAS run: smoke/pending/forecast green,
asterisk-per-record red (expected pre-deploy).

---

## ✅ v.172 SHIPPED — Test consolidation + deploy gates + forecast wiring (2026-05-17)

> **LIVE & VERIFIED 2026-05-17.** Confirmed running on the NAS
> (`192.168.4.62:3001`): container `Up`, in-container
> `app/version.txt` = `202604.172`, ~11h uptime, logs clean — no
> crashes, no `SqliteError`, no restart loop. The `401` log lines are
> normal AUTH-OPEN-GET behavior (unauthenticated POST attempts), not
> faults. The NAS went straight from prod `170.1` to `172`, so **v.171
> and v.172 are both live**. (The earlier "171 packaged, prod 170.1"
> notes were stale doc drift; corrected here and in HANDOFF.md.)

System-wide hardening drop, no schema changes, additive only.

### What shipped (5 tasks, one commit each)
1. **Test folders consolidated.** Root `test/` merged into `tests/parser/`
   (`run-parser-tests.js` + `parser-fixtures/`). Runner's `parsers.js`
   require path fixed for the new depth. Root `test/` removed. 5 stale
   `STATE.md` path references corrected.
2. **Smoke spec added** — `tests/smoke.spec.js`: one Playwright test per
   critical endpoint (`/health`, `/api/v1/pending/counts`,
   `/api/v1/finance/landing`, `/api/v1/finance/forecast?days=30`,
   `/api/v1/medical/summary`, `/api/v1/today`, `/api/v1/data/table` ×2)
   asserting 200 + non-empty JSON. `playwright.config.js` `testMatch`
   broadened to an array so new specs are discovered. `npm run smoke`.
3. **Pending-tab spec added** — `tests/pending-tab.spec.js`: asserts the
   v.171 Pending Items Report mounts (heading, filter chips, GH_VIEW
   grid+list toolbar) + conditional row→picker-drawer. `npm run pending`.
4. **Deploy script committed + gated** — Al's working `ghrava_deploy.ps1`
   brought into the repo (was never committed). Added Step 7 (hard-gate
   ~20s smoke against the live NAS — a dead endpoint stops the deploy)
   and Step 8 (soft-gate full Playwright — prints summary, exits 2, no
   rollback). Restart transport unchanged (SSH-to-NAS only).
5. **#26.1.5 forecast wired live.** Reports preview card `c115` flipped
   from mockup stub to live data from `/api/v1/finance/forecast?days=30`
   (endpoint shipped v.169, FIN-FORECAST lock). No design change — the
   locked #26 shape is unchanged; `_templates.html` untouched.

### Verification note
`bash gates.sh` is Linux/container-only and was **not** run on the
Windows dev host (normal — it runs at packaging). Local checks used:
`node -c` / VM-parse on all changed JS, PowerShell `ParseFile` on the
deploy script, JSON parse on `package.json`, and edge-case simulation
of the forecast SVG builder. Gate verification is the packaging path.

### Not in v.172
- No schema/migration changes. No new CLI (no `help.html` change).
  No new lens fields. No `LOCKED.md` change (no new locked design;
  #26 shape unchanged).

---

## ✅ v.171 SHIPPED — Finance module finish (live on NAS, verified 2026-05-17)

**Scope locked 2026-05-15.** Closes out the finance module per Al's PM
direction: "finish finance module."

### What's in this drop (in order)
1. **A. Transaction-linking subsystem + Pending Items Report** — the spec
   in `TRANSACTION_LINKING_SPEC.md` brought to life. One report at
   `/reports.html?tab=pending` listing every bank charge the app
   couldn't auto-categorize, with one-tap pickers to assign each charge
   to the right car, prescription, inventory item, subscription, HSA
   receipt, or cert renewal. Includes the red/amber asterisk pattern on
   any card showing a derived number, the merchant-rule auto-apply,
   and uses the shared `record_links` table (NOT a new `tx_record_links`
   table — that part of the spec is overridden by SHARED-LNK lock).
2. **D. Per-category monthly budget targets** — set "groceries: $600/mo"
   and see how you're tracking. Builds on existing budget UI shipped in
   v.169. Lands after A is signed off.

### What's deliberately deferred to v.172 (less urgent)
- **B. Wire the cash-flow forecast chart on Reports tab to live data.**
  Backend endpoint `/api/v1/finance/forecast` exists since v.169. The
  Reports chart at `_templates.html #26.1.5` is still a mockup. Important
  but not blocking — Al deprioritized 2026-05-15.

### What's dropped (no longer scoped)
- **C. EOB folder-drop persistence.** The watcher-folder path for
  importing EOB PDFs is dropped per Al 2026-05-15. The site upload at
  Medical → Receipts is the supported path. `importEob()` in the watcher
  remains as no-op or is removed. Any docs referencing the watch folder
  for EOBs are stale.

### Awaiting before code is written
- Al's sign-off on the Pending Items Report visual mockup shown in chat.
  Once signed off, the design lands in `_templates.html` as a new
  numbered section `#29 Pending Items Report` and a row in `LOCKED.md`,
  THEN the rendering code is built.

---

**Most recent packaged version:** v202604.171 (Finance module finish —
in progress, see "🚧 v.171 IN PROGRESS" above). `app/version.txt` =
`202604.171`. Git HEAD `1747515`, 2026-05-15.

> _Status reconciled with git on 2026-05-16._ The lines below were
> stale (said prod=v.168.2, v.170 unpackaged). Actual git history
> since v.168.2: **v.169** (Finance Finalization) and **v.170** (Gates
> + Schema Cleanup) packaged together → **v.170.1** hotfix (defensive
> mig 138 `todos` Google columns, finance/import route schema fixes,
> validator tweak) → **v.171** (current). All version-tagged commits
> are in `main`.

v.169 (Finance Finalization) and v.170 (Gates + Schema Cleanup) were
bundled because v.169 wasn't deployed yet. v.170 contains everything
from v.169 plus the new infrastructure below. Both shipped; v.170.1
followed as a hotfix; v.171 is the current drop.

### What's NEW in v.170 — Gates-over-docs + 28 schema bugs

This drop changes how chats work on Ghrava. The failure mode that
prompted this — "chat said it read the doc, then ignored the rule" —
becomes mechanically impossible because the docs are demoted to
reference material and the rules are enforced by scripts.

**1. `README_FOR_CHAT.md`** — single short ruleset, the ONLY required
reading per chat. 9 rules. STATE/HANDOFF/BACKLOG demoted to
searchable reference. No more "I read STATE.md" pretense.

**2. `LOCKED.md`** — enumerable list of every locked design (visual,
schema, architectural). Each row points at its canonical source.
Gate `check-locked` greps `_templates.html` for the claimed anchors —
fails the drop if any are missing. Solves the "chat said it saved
section #29 but didn't" failure.

**3. `gates.sh` + 8 sub-gates** in `app/scripts/`:
   - `check-syntax`     — node --check on all JS + inline HTML scripts (skips Babel/JSX)
   - `check-schema`     — validate-schema.py --strict
   - `check-locked`     — LOCKED.md ↔ _templates.html consistency
   - `check-lens`       — required modules present in lens-config.js
   - `check-commands`   — core ops commands present in help.html
   - `check-no-design-prose` — flags prose visual specs in STATE/HANDOFF/BACKLOG
   - `check-shared-tables` — strict-warn on parallel shared-table creation
   - `smoke`            — endpoint health check (auto-skips if no server)
   - Master `gates.sh` runs all 8. Pasting clean output is the new
     definition of "done" for any chat.

**4. Schema-safety skill bundled at `app/.claude/skills/ghrava-schema-safety/`** —
no more deploying gates + skills as separate steps. The four-step
schema gate (gen-schema-doc, read SCHEMA.md, write code with `schema:`
comments, validate-schema --strict) is the locked workflow. Path
walkthrough fixed (was 4-levels-up, now 5-levels-up after moving
into app/).

**5. 28 schema bug fixes** caught by the validator audit (BACKLOG
v.167.1):
   - **`attachments` table** (6) — `attachment_type→module`,
     `file_name→original_filename`, `file_path→stored_path` in:
     `app/shared/attachments.js`, `app/shared/folder-watcher.js`,
     `app/features/hsa/routes.js` (4 sites).
   - **`subscriptions.monthly_amount`→`cost`** in
     `app/shared/auto-link-subscriptions.js` (also dropped
     `billing_frequency`→`billing_cycle`, `is_active`→`status`).
   - **`hsa_payments.amount`→`you_paid`** in
     `app/shared/folder-watcher.js` and `app/features/dashboard/routes.js`.
   - **`hsa_payments.receipt_path`→`receipt_location`** in dashboard.
   - **`contacts.google_id`→`google_contact_id`** in
     `app/features/google/routes.js` (3 sites).
   - **`vehicles.insurance_contact_id`** removed in
     `app/features/property/routes.js` — column never existed;
     insurance company/policy stored as text fields.
   - **`kids.school_name`** removed in
     `app/features/family-snapshot/routes.js` — replaced with
     `school_id, teacher_name` (canonical columns).
   - **`perfumes.family_member_id`→`owner_family_member_id`** in
     family-snapshot.
   - **`books.family_member_id`** — column doesn't exist;
     family-snapshot now joins via `record_links` polymorphic.
   - **`daily_log.entry_date`→`log_date`** in
     `app/features/dailylog/routes.js`.
   - **`import_batches.row_count`→`rows_total`** in
     `app/features/import/routes.js` (the bonus bug from v.169 caught
     in another file too).
   - **`documents.doc_type`→`category`** in dashboard.
   - **`certifications` table→`career_certifications`** in dashboard (2 sites).
   - **`career_certifications.cert_name`→`name`** in dashboard.
   - **`holdings.as_of_date`** — defensive migration 137 added
     ensuring the column exists (mig 126's rename pattern was missed
     on some install paths; idempotent ALTER).

**6. Validator enhancement** — `validate-schema.py` now picks up
`ALTER TABLE x RENAME TO y` and standalone `ALTER TABLE x ADD
COLUMN c TYPE` patterns inside JS migrations (was only catching
backtick-templated `db.exec` blocks). The 28 fixes plus mig 137
plus this enhancement = strict validator clean.

### Migration in this drop

**Mig 137 — `holdings_as_of_date_ensure.js`** — idempotent ALTER
to add `as_of_date` to `holdings` if missing. On prod it's already
there (added via mig 126 rename), so no-op. Documented purpose:
defensive against install paths where the v_2 → rename failed.

### What v.170 deliberately does NOT do

- Universal Attachments (#28) — still queued for v.171.
- Today page (locked design, never built) — queued for v.172.
- Reports tab live wiring — forecast endpoint is ready, chart still mockup.
- Security audit items (path allowlist, entityType allowlist, etc.) —
  separate small drop.

### How v.170 was verified

- `bash gates.sh` — all 8 gates green (syntax, schema, locked, lens,
  commands, prose, shared, smoke).
- Schema validator `--strict`: was 28 failures, now 0.
- Smoke gate auto-skips locally (no server); will run on prod after
  deploy.
- Visual prose-spec scan: STATE.md/HANDOFF.md had 16 violations before
  this drop, fixed to 0 by rewriting 4 lines to use canonical
  phrasing (e.g., "Confirm avatar shows your name" instead of "Card
  should show your name in avatar").

### Updated working rules

The contract changed. From now on:

1. Every chat reads `README_FOR_CHAT.md` and emits the start-of-chat
   checklist before doing work.
2. "Done" = `bash gates.sh` shows zero failures. Pasted output
   required. No more "I'm done" without proof.
3. Visual designs ONLY in `_templates.html` + `LOCKED.md` row. Prose
   visual specs in STATE/HANDOFF/BACKLOG = drop fails the prose gate.
4. Verify-after-write: every claim of "saved" must be followed by
   the `view` of the changed lines.
5. Shared tables (`family_members`, `contacts`, `record_links`,
   `attachments`) are universal. The `shared` gate strict-warns on
   parallel-pattern migrations.

---

## ⏪ v.169 — superseded (bundled into v.170)

Finance Finalization. 5 finance schema bugs + Budget UI + cash-flow
forecast. Verified end-to-end. Now part of v.170 deploy.

---

## ⏪ v.168 — superseded by v.169 / v.170 (kept for reference)

### What's in v.169 — Finance Finalization (PM-led drop)

Single coordinated drop to close out the finance module. Three groups of work, all green through `node --check` + schema validator + JSDOM/integration smoke.

**1. Five schema bugs fixed in `finance/routes.js`** (from BACKLOG.md v.167.1 audit)
- L1340 — `import_category_rules.updated_at` removed (column doesn't exist)
- L1419 — `subscriptions.monthly_amount` → `cost` (canonical column per mig 109b)
- L1429 — `med_visit_notes.provider` → LEFT JOIN `contacts` ON `physician_contact_id`
- L1439 — `hsa_payments.amount` → `you_paid`
- L1449 — `eobs` table → `med_eob_statements` (with correct column list)

**Bonus 6th fix** (same module, found by validator): `import_batches.row_count` → `rows_total` at L1133 — was crashing every file-import in the path that used this branch. Same-module 1-line cleanup; left a `schema: ...` comment per skill convention.

**2. Budget UI — finalized**
- `features/finance/budgets.js` rewritten end-to-end:
  - Reads unified `transactions` table directly (no more `finance_transactions` / `imported_transactions` compat views in the spending query — cleaner, future-proof when compat views are dropped).
  - All SQL annotated with `schema:` comments per skill convention.
  - New `GET /summary?year=&month=` — lightweight totals + over/near counts.
  - New `GET /history?year=` — 12 months of total spent vs total limit, powers the trend strip.
- `finance.html` Budgets tab:
  - Existing list + drawer kept (already wired in v.165, just had a stale wireframe comment).
  - **New monthly trend strip** — 12 mini bars colored green/amber/red by pct used, current+past months at full opacity, future at 30%.
  - **New Cash-flow forecast section** below the unbudgeted list — full feature, see (3).

**3. Cash-flow forecast — new feature**
- `features/finance/forecast.js` — new sub-router mounted at `/api/v1/finance/forecast`.
- `GET /?days=30|60|90` — projects active rows from `recurring_transactions` forward across the window.
- Returns:
  - `summary.{starting_balance, ending_balance, total_income, total_expenses, net, projected_lowest, projected_lowest_date, count}`
  - `daily[]` of per-day `{date, income, expenses, net, running_balance, items:[{description, amount, account_name, category, frequency}]}`
- Starting balance = sum of liquid accounts (Checking/Savings/Cash/HSA only — Credit/Loan/Mortgage excluded since they're not cash).
- Override starting balance with `?starting_balance=N` for what-if scenarios.
- Hard cap of 365 days on the input window.
- Forecast renderer on the Budgets tab:
  - 30d/60d/90d chip selector.
  - 4-card summary strip (Starting / Income / Expenses / Ending).
  - Amber low-balance alert when `projected_lowest < starting AND < $1000`.
  - Running-balance bar chart (one bar per day, green if activity, red if negative, dim if no activity).
  - Event list grouped by date with per-item description / account / category / frequency / amount.
- Locked-design note: this satisfies `_templates.html #26.1.5` (Cash-flow forecast chart from the Reports group). Wired into Budgets first because forecast complements budgeting; the Reports tab will reuse the same endpoint.

### What v.169 does NOT do (explicitly out of scope)

- Universal Attachments (#28) — still queued for v.170
- 28 remaining pre-existing schema bugs from the v.167.1 audit (in dashboard/family-snapshot/google/hsa/import/shared paths) — separate plumbing drop
- Reports tab live wiring (forecast endpoint is here but the chart on /reports.html still uses the v.167 mockup)
- Tile-2 budget target (deferred per Al)

### Files touched (v.169)

| File | Change |
|---|---|
| `app/features/finance/routes.js` | 5 schema bugs in `resolveLinkLabel` + L1133 import_batches.row_count→rows_total + LINK_TYPES comment + mount `/forecast` |
| `app/features/finance/budgets.js` | Rewritten — unified `transactions`, +`/summary`, +`/history`, schema comments |
| `app/features/finance/forecast.js` | NEW — 235 lines, cash-flow projection endpoint |
| `app/public/finance.html` | Budgets tab: trend strip + forecast section + JS (`loadBudgetTrend`, `loadForecast`, `setForecastDays`) |
| `app/public/js/lens-config.js` | +`budgets` lens entry (category/year/status dimensions) |
| `app/public/help.html` | +4 commands (forecast 30d, forecast what-if, budget summary, budget history) |
| `app/version.txt` | `202604.169` |
| `STATE.md`, `HANDOFF.md`, `BACKLOG.md`, `SCHEMA.md`, `app/SCHEMA.md` | updated |

### Verification

- `node --check` on all 3 finance JS files + lens-config.js → clean.
- HTML inline-script syntax check on `finance.html` (5 blocks) → clean.
- Schema validator (`validate-schema.py --strict`) — **0 failures in finance/* after my changes**. 28 pre-existing failures elsewhere are documented in BACKLOG and out of scope.
- Integration smoke (in-memory SQLite + real express router):
  - 5 resolveLinkLabel paths return non-null with correct keys ✓
  - `GET /budgets`: 2 budgets, Groceries spent=$205 from 2 transactions, Dining pct=43% ✓
  - `GET /budgets/summary`: total_limit=$550, total_spent=$270, over_count=0 ✓
  - `GET /budgets/history`: 12 months, monthly_limit=$550 ✓
  - `GET /forecast?days=30`: 30 daily entries, starting=$17800 (Credit excluded), 3 event days from the seeded recurrences ✓
  - `?starting_balance=10000` override honored ✓
  - `?days=90` returns 90 entries ✓

---

## ⏪ v.168 — bundled into v.170 (kept for reference)

**Most recent packaged on prod:** v202604.167.1 (auto-linker triggers wired)
**v202604.168 staged, NOT yet packaged** — awaiting Al's "package" command.

### What's in v.168:
**HSA plan info merged into unified fsa_plan_info table.** Fixes the "where did my 2026 HSA plan with $2,400 employer contribution go?" problem from the Settings panel.

- Mig 133: extend `fsa_plan_info` with 8 HSA-specific columns
- Mig 134: copy `hsa_plan_info` rows → `fsa_plan_info` with `plan_type='hsa'`
- Mig 135: rename old `hsa_plan_info` → `hsa_plan_info_DEPRECATED_v167` (data preserved, name gone so nothing reads from it)
- `hsa/routes.js`: 5 endpoints rewritten to use `fsa_plan_info WHERE plan_type='hsa'` with column aliases. API contract unchanged so `finance.html` doesn't need updating.
- `reports/emergency.js`: insurance summary query updated.

**No new features.** Pure plumbing fix done via the new schema-safety skill gate. Every prepared statement validated against the post-migration schema before package.

---

## 🚨 v.167 — packaged + deployed



**Most recent packaged version on prod:** v202604.166 (drafts→templates, medical Overview, mig 131, bulk-seed endpoint, kids auto-sync, lens for new fields, BACKLOG.md, Help → Commands).

**v202604.167 staged in sandbox, NOT yet packaged** — awaiting "package" command.

### What's in the v.167 sandbox

1. **`_templates.html` — 3 new locked design sections**
   - **#26 Reports Design** — Settings-style grouped charts, plain-English titles, mandatory drill-down. 3 groups × 4-5 charts each = 13 charts spec'd. No data dump tables on landing.
   - **#27 Auto-Linkers Pattern** — 4-step shape (match → confidence → review → manual override). 4 linkers listed (#27.1-4). Shared infrastructure spec.
   - **#28 Universal Attachments** — one file + many record_links, build in v.168. ~14 modules affected. Refcount-based file lifecycle. Smart pre-check matcher with HIGH/MEDIUM thresholds locked per target module.

2. **Migration 132** — `record_links` +4 cols (`confidence`, `needs_review`, `source`, `reviewed_at`) + partial index on needs_review. Additive, idempotent.

3. **5 cross-module auto-linkers** (all in `app/shared/auto-link-*.js` + `app/features/medical/eob-hsa-matcher.js`):
   - `auto-link.js` — shared helper, writes to `record_links` with confidence + needs_review.
   - `auto-link-hsa.js` (#27.1) — txn on HSA account → creates hsa_payment row + links them.
   - `auto-link-medical-visit.js` (#27.2) — txn vendor matches care-team contact → links to nearest visit (HIGH if ±7d, MEDIUM if further).
   - `eob-hsa-matcher.js` (#27.3) — EOB claim ↔ existing hsa_payment match: same patient required, amount ±$0.50, date ±14d for HIGH; ±$2 or ±30d for MEDIUM. Provider/Dr match bonus, not required (per Al).
   - `auto-link-subscription-category.js` (#27.4) — copies linked subscription's category onto matched txn (only if txn category empty). Has `applyOne(txnId)` for ongoing + `runRetroactive(days=90)` for the manual button.

4. **Wired into finance import** — `finance/routes.js` import-confirm path now fires all 3 txn-side linkers (hsa, visit, sub-category) in best-effort try/catch blocks after each row insert.

5. **Review-link endpoints** — new `app/features/links/routes.js`:
   - `GET    /api/v1/links/needs-review` — list flagged auto-links
   - `POST   /api/v1/links` — manual link
   - `POST   /api/v1/links/:id/confirm` — clear needs_review
   - `DELETE /api/v1/links/:id` — manual unlink
   - `GET    /api/v1/links/for/:type/:id` — all links touching this entity
   - `POST   /api/v1/links/run/eob-hsa-matcher` — backfill button
   - `POST   /api/v1/links/run/subscription-categories?days=90` — retroactive button

6. **HSA & LP-FSA Plans Settings panel** — new rail item in Settings → Imports & rules (after Finance Category Rules). Full UI: plan year, plan type (HSA / LP-FSA / Medical FSA / Dep-Care FSA — all in one form), plan name, annual limit, contributions YTD, employer contribution, deadline date, custodian, carryover, active. Backend already supports all plan_types in `fsa_plan_info`. Edit existing rows inline. Active count appears as a pill on the rail.

7. **Reports Charts (preview) tab** — new tab `/reports.html?tab=charts`. Renders the #26 design lock: 3 groups (Money, Health, Household), 13 cards total. 2 cards have real SVG mockups (Sankey income→categories, BP line with healthy zone shaded) so Al picks visual direction. Rest are stubs with "Mockup pending" + version-target labels. No live data yet (that's v.167.1+).

8. **`review-pill.js`** — floating bottom-right pill on every page (loaded by `nav.js`). Shows count of `needs_review=1` links. Click → slide-over drawer listing each with Confirm / Unlink buttons. Polls every 60s. Hidden when count = 0.

9. **Lens config** — added `record_links` lens entry. Dimensions: confidence (high/medium/low), needs_review state, source linker, kind, left_type, right_type, time. All new auto-linker outputs are searchable via the global lens.

10. **Help → Commands** — added 3 v.167 commands: EOB→HSA matcher backfill (curl), subscription category retroactive (curl with days param), needs-review list (curl + python json.tool).

11. **BACKLOG.md** — added v.167 LOCKED SCOPE block (with build sequence + out-of-scope items) and v.168 QUEUED SCOPE block (Universal Attachments). Old items consolidated under labeled sections.

12. **EOB↔HSA matcher auto-triggers** (NEW in hotfix, v.167.1) — earlier I shipped the matcher as a one-shot CLI/curl. Now wired into the import paths so it runs automatically:
   - `medical/routes.js` EOB import loop: after each `med_eob_claims` insert, calls `eob-hsa-matcher.processEobClaim(claim)` — creates record_links rows for HIGH-confidence matches, flags MEDIUM matches with needs_review=1.
   - `hsa/routes.js` POST /payments: when a new HSA payment lands, scans existing unlinked claims for matches (same patient, ±30d, ±$2) and runs the matcher on each.
   - Manual one-shot backfill (`POST /api/v1/links/run/eob-hsa-matcher`) still available for the initial pass; after that, the triggers handle every new EOB and every new HSA payment automatically.

13. **Schema validator** (NEW in hotfix) — `scripts/validate-schema.py`. Builds a prod-mirror DB by replaying every migration, then validates every `db.prepare(\`SQL\`)` parses against the real schema. Catches the exact class of bug that crashed v.167 twice. Now mandatory predeploy gate. Documented in Help → Commands.

### What's deliberately NOT in v.167

- Universal Attachments code (designed in #28, built in v.168)
- Reports live data wiring (mockups only this drop)
- Budget UI
- EOB folder-drop persistence (manual upload works)
- Medical schema gaps (immunizations, procedures, etc.)
- Transaction attachments wiring (deferred since #28 supersedes it)
- Review-surface as inline pills on individual list rows (the floating pill widget is the v.167 surface; per-row pills can come in v.168 if you want)

### Deploy steps

1. Say "package" → zip built, top-level layout.
2. Download → `ghrava_deploy.ps1` → robocopy to `Z:\ghrava\`.
3. SSH NAS → `docker restart ghrava` (~2s). Mig 132 applies automatically.
4. After deploy:
   - Visit Settings → "HSA & LP-FSA plans" → add 2026 LP-FSA row to test.
   - Visit Reports → Charts (preview). See the 2 mockups + 11 stubs. Pick visual direction.
   - Optional one-shot: run the EOB→HSA matcher backfill (`curl -X POST http://localhost:3001/api/v1/links/run/eob-hsa-matcher`). See `Help → Commands` for the exact command.
   - Watch for the "Needs review" floating pill (bottom-right) if any medium-confidence auto-links are created.

---

## ⏪ v.166 — superseded by v.167 (kept for reference)

Al runs **Ghrava** — self-hosted household OS on QNAP NAS at `192.168.4.62:3001`.
Node.js/Express + SQLite (better-sqlite3) + vanilla JS + Docker.

**Most recent packaged version on prod:** v202604.165 (finance tiles wired).
**v202604.166 staged in sandbox, NOT yet packaged** — awaiting Al's "package" command.

### What's in the v.166 sandbox

1. **Drafts → Templates migration (DONE)**
   - `_drafts/*.html` (24 subpages + `_drafts.css`) → `app/public/_templates/*.html`
   - `_drafts.css` → `_templates.css`
   - `_drafts.html` redirect shim deleted; `_drafts/` directory removed
   - All `/_drafts/` refs + `← Drafts index` breadcrumbs updated to `_templates`
   - `nav.js` link renamed Drafts → Templates, href `/_templates.html`, `data-drafts-link` → `data-templates-link`

2. **Medical Overview tab restored (DONE)**
   - New "Overview" tab in `medical.html`, default landing (was "All")
   - 6 tiles M1–M6 with `.med-tile*` CSS namespace (locked design from #18 Finance tiles)
   - M1 Active conditions · M2 Active meds + refills due · M3 Upcoming visits · M4 EOB your-share · M5 Recent vitals · M6 Family snapshot
   - **Empty state rule** (Al locked v.166): tile structure ALWAYS renders. Values go to 0 / — / mute pill; rows preserved.
   - 3-up desktop grid `repeat(auto-fit, minmax(320px, 1fr))`, phone scroll-snap <700px

3. **Migration 131 — medical schema expansion (DONE, simulated PASS)**
   - `contacts` +6 cols: credentials, manages, is_primary_pcp, portal_url, fax, npi
   - `med_conditions` +3 cols: icd10_code, severity, source_system
   - `med_medications` +7 cols: dose_unit, route, ndc, mail_order, quantity_total_prescribed, rx_date, source_system
   - `med_eob_claims` +7 cols: provider_npi, diagnosis_codes (JSON), place_of_service, claim_status, denial_reason_codes, prior_auth_ref, appeal_deadline
   - `med_eob_services` +2 cols: cpt_modifiers (JSON), hsa_eligible
   - NEW TABLE `med_lab_results` (panel_name, test_name, test_date, value_numeric, value_text, unit, reference_low/high/text, flag, source_visit_id, dedup_hash)
   - NEW TABLE `med_diagnostics` (test_name, test_type, test_date NULL, status, impression, ordering_contact_id, performing_contact_id, facility, dedup_hash) — `test_date` nullable so `status='pending'` rows (recommended-but-not-yet-performed tests) are allowed
   - NEW TABLE `med_allergies` (allergen, allergen_type, reaction, severity, status, noted_date, dedup_hash)
   - NEW TABLE `med_vitals_readings` (measure_date, measure_time, systolic_bp, diastolic_bp, heart_rate, weight_lbs, height_in, bmi, temperature_f, o2_sat, respiratory_rate, blood_glucose, source_system, source_visit_id, dedup_hash)
   - Idempotent: re-runs are no-ops. Marker table `_migrations_medical_expansion_done`.

4. **Bulk seed endpoint (DONE)**
   - `POST /api/v1/medical/bulk-seed` in `app/features/medical/seed-routes.js`
   - Accepts the `health_seed.json` shape from the medical-conversion chat
   - Maps to existing `med_*` tables (NOT to spec's parallel `health_*` tables)
   - Resolves family member by explicit `family_member_id` OR `patient.name` match OR first-word match
   - Idempotent via dedup_hash per section
   - Supports `?dry_run=1` for safety preview
   - Mounted alongside `medical/routes.js` in server.js

5. **Seed CLI tool (DONE)** — `app/scripts/seed-medical.js`
   - Usage: `docker exec -it ghrava node /app/scripts/seed-medical.js --file /app/seeds/medical_algir.json [--dry-run]`
   - Reads JSON, POSTs to bulk-seed endpoint, prints per-section counts

6. **Algir's seed bundled (DONE)** — `app/seeds/medical_algir.json` (15 KB)
   - 1 patient · 6 care_team · 14 conditions · 14 medications · 26 labs · 8 vitals · 7 diagnostics · 1 allergy
   - Originated from `medical_module_-_ghrava_upload.zip` (Apr 2026)
   - **Simulation verified:** all 76 records insert cleanly against the mig-131 expanded schema

7. **Kids ↔ family_members auto-sync (DONE)** — fixes Risha-not-showing bug
   - `kids/routes.js` GET / now calls `syncKidsFromFamilyMembers()` first
   - For every `family_members` row with `relationship IN ('Son','Daughter','Child','Stepson','Stepdaughter','Stepchild') AND is_active=1` that has no matching `kids` row, INSERT one
   - Wrapped in try/catch so a sync error doesn't break the list endpoint

8. **Lens config for new fields (DONE)** — `app/public/js/lens-config.js`
   - Extended existing `medical_medications` lens with: route, mail_order, ndc, source
   - Extended `medical_conditions` with: icd10, severity, source
   - Extended `medical_eob` with: claim_status, place, diagnosis, npi
   - NEW lens entries: `medical_labs`, `medical_diagnostics`, `medical_allergies`, `medical_vitals`
   - All new fields searchable via the global lens (per Al's locked v.166 rule: every new field MUST be in lens-config.js)

9. **GET endpoints for new tables (DONE)** — appended to `medical/routes.js`
   - `GET /api/v1/medical/labs` (filter `?family_member_id`, `?limit`)
   - `GET /api/v1/medical/diagnostics`
   - `GET /api/v1/medical/allergies`
   - `GET /api/v1/medical/vitals`

10. **BACKLOG.md created (DONE)** — persistent cross-chat memory
    - Top open decisions, cross-module wiring TODO, schema gaps, reports engine design, known bugs, security audit, v140 loose ends, draft pages map, workflow rules
    - Old April-2026 backlog archived as `BACKLOG_OLD_apr2026.md`

### How v.166 was verified (predeploy)

- `node --check` on all 8 changed JS files → clean
- Inline `<script>` syntax check on medical.html (4 blocks) → clean
- Migration simulation against shape-mirror DB → 25 new columns + 4 new tables all present
- Idempotent re-run → OK
- End-to-end seed import against simulated schema → all 76 seed rows inserted cleanly

### Deploy steps for Al (when ready to package)

1. Say "package" → Claude builds `Ghrava_DEPLOY.zip` with top-level layout (no `ghrava/` wrapper)
2. Download to `~/Downloads`, run `ghrava_deploy.ps1` → extracts to `Z:\ghrava\`
3. SSH NAS: `docker restart ghrava` (~2s) — applies mig 131 automatically (additive, idempotent, transaction-wrapped)
4. Verify: visit `https://ghrava.home/medical.html` → Overview tab is default, 6 tiles render with current (mostly empty) data
5. **Run seed (optional but recommended):** `docker exec -it ghrava node /app/scripts/seed-medical.js --file /app/seeds/medical_algir.json --dry-run` then without `--dry-run` to import 76 records
6. Verify: visit Medical → Overview again. M1 shows 14 conditions, M2 shows 14 meds, M5 shows BP from latest vital
7. Verify: visit Kids → Risha appears (auto-synced from family_members)

### What's NEXT after deploy

See **`BACKLOG.md`** for the full prioritized list. Top items:

1. Reports engine design — `metric_index` view, canonical metric vocabulary, cross-module slicing
2. Medical "Receipts" tab (v140 deferred) — single-flow PDF upload routes file to Documents + creates medical record + auto-links
3. Auto-link transactions → medical_visit / hsa_payment (cross-module wiring)
4. EOB → HSA payment auto-match
5. Other family members' seed JSONs (Zarna, Arnav, Risha)
6. Immunizations / procedures / referrals tables (Medical schema gaps)

---

## 🚨 NEW CHAT? READ THIS BLOCK FIRST

You are picking up an in-progress project. The previous session ran out
of capacity; Al started a new chat to keep continuity. Everything you
need to know is in this file.

### 30-second context

Al runs **Ghrava** — a self-hosted household OS on a QNAP NAS, accessible
at `http://192.168.4.62:3001`. Stack: Node.js/Express + SQLite
(better-sqlite3) + vanilla JS. Single user, single developer. Most
recent **packaged** version on prod is **v202604.159 code + v202604.164
templates**. **v202604.165 is staged in sandbox, not yet packaged** —
awaiting Al's "package" command.

### What's in the v.165 sandbox

Three files changed; full diff in `## ✅ SHIPPED THIS DROP` below.

1. **`app/features/finance/routes.js`** — `/landing` rewritten to v.150
   payload shape (sparkline, top-3 cards/holdings, stale-days, prior-
   month/YTD cash flow, unreimbursed HSA/LP-FSA pool).
2. **`app/public/finance.html`** — sample-fallback machinery deleted;
   v.150 renderers from `_templates.html` #18 inserted byte-identical;
   `<div id="finTilesGrid">` replaces the 6 static tile divs; onclick
   wiring attached post-render.
3. **`app/public/medical.html`** — `.medv5-grid` upgraded to 3-up
   `auto-fit minmax(380px, 1fr)` with phone scroll-snap pager <700px.

Plus `app/version.txt` bumped to `202604.165`.

### How v.165 was verified

- `node --check` on `routes.js` → clean.
- Inline `<script>` syntax check on finance.html + medical.html → clean.
- Integration smoke: in-memory SQLite + seeded dataset hit through
  the actual express router. 22 shape assertions on `/landing`
  payload → all pass.
- JSDOM smoke: renderer block extracted from finance.html, rendered
  against real-data + all-empty payloads. 6 tiles each mode, 12
  sparkline bars, cash-flow bar, util mini-bars, positive-gain
  styling, `_emptyTile()` mute styling all verified.

### Next-drop work is queued

**After v.165 confirmed working on prod:**
- Drop `_legacy_*` tables — cleanup capstone (separate small drop).
- `accounts_beneficiaries` decision — drop or revive.
- Tile-2 budget target — design conversation pending.

**Outside finance:** Today page, drafts pages, todos/reports
render bugs, v140 loose ends, security audit.

**Don't pick a top item and start coding.** Al chats first, then builds.

### The most important rules to internalize

- **Chat first, code second.** Discuss before writing. Confirm before
  building. Short replies. Don't over-explain.
- **Don't package after one fix.** Bundle multiple changes. Al has
  corrected this multiple times.
- **Don't defend, look.** When Al says something is broken, check the
  code — don't argue from cache or assumptions.
- **Don't re-derive locked decisions.** This file has them. Read the
  whole thing.
- **Run the 5 predeploy gates** before every zip. Listed in
  `## 🎯 LOCKED DESIGN DECISIONS → Code quality (5 gates)`.

### How Al deploys

1. You build a zip → `present_files` it as `Ghrava_DEPLOY.zip`
2. Al downloads to `~/Downloads`
3. Al runs `ghrava_deploy.ps1` on Windows — it auto-finds the zip,
   robocopies to `Z:\ghrava` (NAS-mapped), deletes the zip, prints
   either "docker restart ghrava" or "docker compose up --build -d"
   depending on whether `package.json` changed.
4. Al SSHs to NAS and runs that command.
5. Al hits refresh on the page.

**Important:** the deploy zip must extract files at the top level
(`app/`, `docker-compose.yml`, etc.) — NOT inside a `ghrava/` wrapper.
`Ghrava_Share.ps1` (sandbox export) does add a `ghrava/` wrapper; the
deploy zip does not.

Full ps1 details: `## 🚦 DEPLOY WORKFLOW`.

### Where Al's actual code lives

- **NAS:** `/share/Docker/home-core/ghrava/` (Docker compose root) →
  `app/` is the code root inside container at `/app`
- **Windows:** `Z:\ghrava\` (mapped network drive to same path)
- **Sandbox (yours):** start fresh each chat. To get the live code,
  Al uploads `Ghrava_Share_<date>.zip` (full folder export). Don't ask
  unless you actually need to read source — STATE.md has most answers.

### Your sandbox staging directory

This session staged all v.165 changes in `/home/claude/work/ghrava_drop/`.
That directory is wiped at chat-end. To resume staging, recreate it
from Al's share zip if needed.

---

## Current version (HISTORICAL — superseded)

> ⚠️ **SUPERSEDED 2026-05-16.** This section reflects v.165 and is kept
> as archive only. The authoritative current version is at the top of
> this file: **v202604.171**. Do not treat the line below as current.

**v202604.165** — finance Overview wired to v.150 renderers + medical
tile grid resized 3/2/1 with phone scroll-snap. Sandboxed; **not yet
packaged**, awaiting Al's go.

**→ See HANDOFF.md for the next chat's task list and deploy process.**

### v.165 changes

- **Backend: `GET /api/v1/finance/landing` rewritten to the v.150
  payload shape** so the template renderers can consume it directly:
  - `net_worth.total_assets / .total_liabilities / .sparkline` (last
    value per month from `net_worth_snapshots`, trailing 12 months).
  - `cash_flow.mtd_net / mtd_in / mtd_out / prior_month_net / ytd_net`
    (full prior-month net, not same-day MTD).
  - `credit_cards.top[]` (3 by owed) + `others_count` / `others_owed`,
    per-card `util` (whole percent), aggregate `util_pct`, `next_due:
    {days, min_payment}`.
  - `bank_accounts.liquid_total / checking_total / savings_total /
    stale_count / stale_label / stale_oldest_days` (stale = `balance_
    as_of` older than 14 days).
  - `holdings.top[]` (3 by market_value) + `others_count` /
    `others_value`, total `cost_basis` + `gain_pct`.
  - `hsa_lpfsa` semantics flipped from "HSA account balance" to
    **unreimbursed receipt pool** (counts & sums on `hsa_payments`
    and `fsa_payments` where `reimbursed = 0`), plus `lpfsa_
    deadline_days` from current-year `fsa_plan_info.deadline_date`.
- **Frontend: `app/public/finance.html`**:
  - 6 static `<div class="fin-tile" data-tile="…">` blocks replaced
    with a single `<div id="finTilesGrid" class="fin-tiles-grid">`.
  - Sample-fallback machinery deleted: `FIN_TILE_SAMPLE` (~45 lines),
    `applyTileSampleFallback` (~60 lines), `clearTileSampleState`
    (~20 lines), `FIN_TILE_FMT` formatters (~25 lines), `setTilePart
    / setTilePill / setTileDot` helpers (~25 lines), `daysUntil`
    helper, and the 165-line `loadLandingTiles` that branched on
    per-tile "has real data?" predicates. Net delta: ~14.5kb of dead
    code removed.
  - v.150 renderers inserted **byte-identical to `_templates.html` #18**:
    `_finK / _finM / _finC / _finPct / _finDot / _finPill / _finTile-
    NetWorth / _finTileCashFlow / _finTileCreditCards / _finTile-
    BankAccounts / _finTileHoldings / _finTileHsaLpfsa / _emptyTile`.
  - New 30-line `loadLandingTiles()` calls `/finance/landing` and
    concatenates the 6 renderer outputs into `#finTilesGrid`. Onclick
    + `role="button"` + `tabindex="0"` + Enter/Space keyboard nav
    attached post-render via `FIN_TILE_TAB_TARGETS = ['networth',
    'transactions','accounts','accounts','holdings','hsa']`. Error
    path renders an inline red message in monospace.
  - CSS additions: `.fin-tile-pill--mute` and `.fin-tile-dot--mute`
    (used by `_emptyTile()` and net-worth's "no prior snapshot"
    pill).
- **Frontend: `app/public/medical.html`** — `.medv5-grid` upgraded
  from the v.147 hard-locked-2-columns layout to:
  - Desktop: `grid-template-columns: repeat(auto-fit, minmax(380px,
    1fr))` — 3-up on wide screens, 2-up on mid, 1-up on narrow above
    the phone breakpoint.
  - Phone (≤700px): flex + `scroll-snap-type: x mandatory` for a
    native one-card-per-viewport pager. Cards sized `flex: 0 0
    calc(100vw - 28px)`. Matches the existing `.medv5-grid--all` All-
    tab pattern.
- **Verified:**
  - `node --check` on `app/features/finance/routes.js` → clean.
  - Inline `<script>` syntax check on `finance.html` (5 blocks) and
    `medical.html` (4 blocks) → clean.
  - Integration smoke: spun up the express router against an in-
    memory SQLite DB matching the unified schema, seeded a
    representative dataset, hit `/api/v1/finance/landing`, asserted
    22 shape predicates. All pass.
  - JSDOM smoke: extracted the renderer block from `finance.html`,
    rendered against both the real-data payload and an all-empty
    payload, asserted DOM well-formedness:
    - 6 `.fin-tile` elements in both modes
    - 12 sparkline bars on net worth tile
    - cash-flow `.fin-tile-cf-bar` present
    - 2 credit-card util mini-bars (3rd card has no limit → null util)
    - 3 positive-gain spans on holdings
    - Empty payload: 4 `_emptyTile()` mute dots, all heroes show $0
- **Not done in this drop:** _legacy_* cleanup capstone (deferred),
  Tile-2 budget target (design discussion deferred), no other modules
  touched.

### v.164 changes (carryover)

- `_templates.html` #18 finance tiles (locked v.150 visual spec).
- `_drafts.html` → meta-refresh redirect to `_templates.html#drafts`.

### v.159 changes (still on prod, untouched)

- **Migration 130 rewritten as self-contained.** Does NOT call mig
  126 in-process. Replicates unification logic inline with two
  critical fixes:
  - `CREATE INDEX ... ON accounts(is_active)` no longer fires
    against the wrong pre-existing accounts table — we move that
    table out of the way before any DDL touches `accounts`.
  - Source tables (`finance_accounts`, `finance_transactions`,
    `fin_import_batches`, etc.) get renamed to `_legacy_*` BEFORE
    creating compat views of the same names — no more
    "DROP VIEW IF EXISTS" against a table.
- **Defensive: drops index name collisions** (`idx_accounts_*`,
  `idx_tx_*`, `idx_holdings_*`, `idx_import_batches_*`) before
  creating new ones, since the renamed beneficiaries table may
  have brought a colliding index with it.
- **Smoke-tested on Al's actual production DB:** 2 + 1 accounts
  unified (no dups), 76 transactions migrated with fingerprints
  recomputed, 5 compat views created, `accounts_beneficiaries`
  preserved (empty), 7 `_legacy_*` tables retained as backup.
  Idempotent on retry.
- **`detectMissingStatements()` defensive guard.** Checks `accounts`
  schema before querying. Returns `[]` if unified columns aren't
  present. Fixes the `[todos] missing_statement: no such column:
  name` log spam from v.158.

### v.158 changes (carryover)

- Sample-data tile fallback on Overview (renders illustrative
  values with "SAMPLE" badge when /finance/landing returns no data)

### v.157 changes (carryover)

- Net-worth auto-snapshot scheduler
- 5 more parser fixtures (12/12 banks)
- Mig 129 + record_links + All tab + auto-linker

### v.156 changes (carryover)

- `recurring-transactions.js` write-path bug fix
- 12 cross-module readers repointed off compat views

### v.155 changes (carryover)

- Parser sign-convention tests + runner
- Categorization rule editor in Settings
- Missing-statement → todos auto-feed

### v.154 changes (carryover)

- Migration 128 — additive credit-card columns
- `GET /finance/landing` aggregator
- Overview tiles wired to real data

### v.153 changes (carryover)

- `app/shared/tx-fingerprint.js` shared helper
- Migration 127 — fingerprint v2 + dup detection
- 5-day window dedup

### v.152 changes (carryover)

- Account form parity, single-fetch reads
- Needs-review queue + endpoints

### v.151 changes (carryover)

- Migration 126 — unified `accounts` + `transactions`

Carry-overs from v.150 / v.149 unchanged.

---

## ✋ DON'T TRUST WITHOUT RETEST (v202604.159)

**This list survives across chats.** Anything below is *touched* this
drop but NOT confirmed working by Al. Treat as suspect until Al says
"tested, works." Clear an entry only on Al's confirmation.

| File | Change | Risk |
|---|---|---|
| `app/db/migrations/130_rescue_126.js` | **REWRITTEN v.159.** v.158's first version failed with `no such column: is_active` and `use DROP TABLE`. v.159 is self-contained — does NOT call mig 126 in-process; replicates unification logic inline with both fixes. Smoke-tested against Al's actual broken DB: 2+1 accounts unified (no dups), 76 transactions migrated. | **CRITICAL** — runs on first restart, performs schema surgery. **MANDATORY backup of `data/ghrava.db` before restart.** After restart, expect: `SELECT * FROM _migrations_rescue_126_done` shows one row with detailed notes (NOT starting with "RESCUE FAILED"); `SELECT COUNT(*) FROM transactions` returns 76; `SELECT name FROM sqlite_master WHERE name LIKE '_legacy_%'` shows 7 backup tables; finance.html Overview tiles show real data without SAMPLE badges. |
| `app/features/import/routes.js` | v.159: `detectMissingStatements()` defensive guard — returns [] if `accounts` lacks unified columns. Stops the `[todos] missing_statement: no such column: name` log spam on broken state. v.157 auto-link hook. v.155 + v.153 + v.151 carryovers. | **HIGH** — every file-import path touched. |
| `app/public/finance.html` | v.158: sample-data tile fallback on Overview when /finance/landing returns zero data per tile. v.157 All tab + link picker. v.154 tiles + CC form. v.152 form rebuild + needs-review. | **HIGH** — Overview tile rendering changed. Test: open Overview before any imports → see sample numbers with SAMPLE badge in pill slot; after first import / account creation → tiles transition to real data without SAMPLE badge. |
| `app/db/migrations/129_record_links.js` | NEW (v.157). Polymorphic junction table for cross-module record links. Idempotent. Additive only. | Low — additive only. Test: open Finance → All tab → "+ link" button on any transaction → confirm picker opens. |
| `app/shared/networth-scheduler.js` | NEW (v.157). Daily auto-snapshot of net worth. Wired into server.js boot path. | Medium — runs 30s after first restart, then hourly. Test: 30s after deploy, check `net_worth_snapshots` for a today-dated row with `notes='[auto-snapshot]'`. Tile 1 MoM pill should populate after the next day's snapshot. |
| `app/shared/auto-link-subscriptions.js` | NEW (v.157). Auto-creates `pays_for` links between imported transactions and matching active subscriptions. | Medium — only runs at import time, only creates links (no other side-effects). Test: import a statement that includes a subscription charge → check All tab → that row should have the subscription badge inline. |
| `tests/parser/parser-fixtures/schwab_*, vanguard, tsp, wells_fargo` | NEW (v.157). 5 more banks added. **12/12 pass.** Path moved from `test/` → `tests/parser/` in v.172. | None at runtime. |
| `app/features/finance/routes.js` | v.157: link CRUD endpoints, `GET /all` aggregator, auto-link hooked into import-file path. v.154 + v.153 + v.152 + v.151 carryovers. | **HIGH** — every finance route added to or rewritten. Test the All tab end-to-end. |
| `app/server.js` | v.157: registers `networth-scheduler.startScheduler()`. v.156 health-check repointing. | Low — additive scheduler registration. |
| `app/shared/recurring-transactions.js` | v.156 bug fix carryover. | **HIGH** — will start producing rows on first restart. |
| `app/shared/dedupe.js` | v.156 carryover. | Medium. |
| `app/shared/exportQueries.js` | v.156 carryover. | Low. |
| `app/shared/folder-watcher.js` | v.156 carryover. | Medium. |
| `app/features/search/routes.js` | v.156 carryover. | Medium. |
| `app/features/subscriptions/routes.js` | v.156 carryover. | Low. |
| `app/features/dashboard/routes.js` | v.156 carryover. | Medium. |
| `app/features/data/routes.js` | v.156 carryover. | **HIGH**. |
| `app/features/backup/routes.js` | v.156 carryover. | Medium. |
| `app/features/settings/routes.js` | v.156 carryover. | Medium. |
| `app/features/system/routes.js` | v.156 carryover. | Low. |
| `tests/parser/run-parser-tests.js` | NEW (v.155). Moved from `test/` → `tests/parser/` in v.172. | None at runtime. |
| `app/shared/autoTodos.js` | v.155 carryover. | Medium. |
| `app/public/settings.html` | v.155 carryover. | Medium. |
| `app/db/migrations/128_cc_columns.js` | NEW (v.154). | Low. |
| `app/shared/tx-fingerprint.js` | NEW (v.153). | Low. |
| `app/db/migrations/127_fingerprint_v2.js` | NEW (v.153). | **HIGH**. |
| `app/db/migrations/126_finance_unify.js` | NEW (v.151). | **HIGH**. |
| `app/version.txt` | `202604.159` | None. |

### Carryover from v.150 — still untested

- Finance Overview tab as default landing on /finance.html
- gotoFinTab() helper, FAB/year-pill hidden on Overview

### Carryover from v.149 — still untested

- Medical /medical.html lands on All tab
- SE/Self avatar bug fix
- Visit ↔ condition junction (migration 125)

---

## ✅ SHIPPED THIS DROP (v202604.159)

### Rescue migration 130 — rewritten (v.159)

- **v.158 attempt failed in production** with two errors logged on
  restart:
  - `FAILED 126_finance_unify.js: no such column: is_active`
  - `FAILED 130_rescue_126.js: use DROP TABLE to delete table fin_import_batches`
- **Root causes:**
  - v.158's mig 130 called mig 126 in-process via `require()`. Mig
    126 starts with `CREATE TABLE IF NOT EXISTS accounts`, which is
    a no-op on an install where `accounts` already exists (the
    beneficiaries table). The next line, `CREATE INDEX ... ON
    accounts(is_active)`, then fires against the wrong table.
  - Even if step 1 were fixed, mig 126's compat-view DDL does
    `DROP VIEW IF EXISTS fin_import_batches` — but on this DB
    `fin_import_batches` is a TABLE. DROP VIEW can't touch tables.
- **v.159 mig 130 is fully self-contained.** Does not call mig 126.
  Replicates the unification logic inline with both fixes baked in:
  1. Detects schema state (already-unified / empty / broken).
  2. Renames pre-existing empty `accounts` → `accounts_beneficiaries`.
  3. Drops index name collisions defensively.
  4. Renames `finance_*`/`financial_*`/`fin_import_batches`/etc. to
     `_legacy_*` (using ALTER TABLE for tables, DROP for views).
  5. Creates unified `accounts`/`transactions`/`import_batches`/
     `holdings` tables fresh.
  6. Copies rows with type normalization + (institution, last4)
     dedup logic.
  7. Recomputes fingerprints with v.153 normalizer inline.
  8. Creates 5 compat views over the unified tables.
  9. Seeds `_migrations_finance_unify_done`,
     `_migrations_fingerprint_v2_done`, `_migrations_cc_columns_done`.
  10. `INSERT OR IGNORE` 126/127/128 into `_migrations` runner log
      so they stop being retried on every restart.
  11. Marks `_migrations_rescue_126_done`.
- **All in one transaction.** Failure → ROLLBACK, broken state
  preserved, and a `RESCUE FAILED: <message>` row written to
  `_migrations_rescue_126_done` for diagnosis.
- **Smoke-tested manually against Al's actual production DB** using
  Node 22's `node:sqlite`:
  - 2 accounts copied from `finance_accounts` → unified `accounts`.
  - 1 account copied from `financial_accounts` → no dups (different
    institution/last4), so it became a third row.
  - 76 transactions migrated with fingerprints recomputed.
  - 0 imported transactions / 0 batches / 0 holdings (none on this
    DB).
  - 5 compat views created.
  - 7 `_legacy_*` tables preserved.
  - Second run is a clean no-op (idempotent check passes).
  - `/finance/all` query simulated end-to-end — returns transactions
    joined to accounts correctly.

### `detectMissingStatements()` defensive guard (v.159)

- `app/features/import/routes.js` checks `accounts` schema before
  querying. If the unified columns (`name`, `alias`, `is_active`,
  `track_statements`, `institution`) aren't all present, returns
  `[]` instead of throwing.
- Fixes the `[todos] missing_statement: no such column: name` log
  spam observed on v.158's broken-state production install.

### Sample-data tile fallback (carried from v.158)

- Every Overview tile has explicit "has real data?" predicate:
  - net_worth: assets + liabilities + investment_total > 0
  - cash_flow: count of MTD transactions > 0
  - credit_cards: count > 0
  - bank_accounts: count > 0
  - holdings: positions > 0
  - hsa_lp_fsa: HSA count > 0 OR LP-FSA balance > 0
- Tiles without real data render hardcoded v.150-style sample
  numbers + a "SAMPLE" badge in the pill slot (monospace,
  letter-spaced, neutral background — visually distinct from
  status pills).
- Hero number gets 65% opacity in sample state so it reads as a
  preview.
- `clearTileSampleState()` runs on every re-render so transitions
  from sample → real (after first import) are clean.

### Net-worth auto-snapshot scheduler (carried from v.157)

- `app/shared/networth-scheduler.js` — daily snapshot of net worth.
  One per calendar date, idempotent (UPDATE-by-date). Tagged
  `notes='[auto-snapshot]'` so manual snapshots stay distinguishable.
- Wired into `app/server.js` next to the recurring-transactions
  scheduler. Boots 30s after server start, then hourly checks
  whether today's snapshot exists.
- Tile 1's MoM delta pill now populates organically.

### Five more parser test fixtures (v.157)

- Added Schwab Checking, Schwab Brokerage, Vanguard, TSP, Wells
  Fargo. Detector quirks worked out per bank:
  - Vanguard description = Transaction Description column (not
    Investment Name).
  - Wells Fargo needs 5+ column header without "description" or
    "post"; CSV-parse collapses duplicate `*` column names, so
    placeholders are `Col3`/`Col4`.
- **All 12/12 banks now pass.**

### tx_record_links cross-module link table + "All" tab (v.157)

- **Migration 129** — additive `record_links` polymorphic junction
  table. UNIQUE on `(left_type, left_id, right_type, right_id,
  link_kind)`. Two indexes for bidirectional lookup. No FK
  constraints (polymorphic by design).
- **Type vocab LOCKED:** `transaction`, `subscription`,
  `medical_visit`, `hsa_payment`, `eob`, `document`. Adding a new
  type is one line on backend (LINK_TYPES set) + one line on
  frontend (LINK_TYPE_ICON/LABEL maps).
- **Backend endpoints** in finance routes:
  - `GET /api/v1/finance/links?type=<t>&id=<id>` — bidirectional
    lookup, hydrates other-side `{label, sub, href}` so the UI
    doesn't need to know each module's display rules.
  - `POST /api/v1/finance/links` (auth) — canonicalizes by sorting
    (type, id) tuple so symmetric pairs never duplicate. Returns
    existing id if UNIQUE constraint hits (idempotent).
  - `DELETE /api/v1/finance/links/:id` (auth).
- **`GET /api/v1/finance/all`** — paginated unified feed. `?limit=N`
  (max 500), `?before=YYYY-MM-DD` cursor. Returns transactions
  with `link_count` and `links[]` (top 3 by recency) inline.
  Bulk link fetch = one query per page, then group-by JS.
- **Auto-linker** (`shared/auto-link-subscriptions.js`):
  - Match rule: active subscription, `|txn.amount|` within ±5% of
    `monthly_amount`, name token (≥3 chars) appears in normalized
    description, debit not transfer.
  - Creates `'pays_for'` links on insert, silently. 60s cache on
    active subscriptions.
  - Hooked into both import paths (`/api/v1/finance/transactions/
    import-file` and `/api/v1/import/confirm`). Failure is logged
    and skipped — never blocks the import.
- **"All" tab on /finance.html:**
  - New tab between Overview and HSA.
  - Date-grouped feed; each row shows description / account /
    category / review flag / transfer flag / amount.
  - Link badges with type icon + display label inline below
    description. "+N more" badge when link_count > 3.
  - "+ link" button per row opens a picker dialog: existing links
    (with remove buttons) + add-new form (type dropdown, record
    id input, link_kind dropdown).
  - "Load older transactions" button cursor-paginates via
    `next_before` from the previous response.

### Cross-module compat-view repoint (v.156)

12 files repointed off compat views (`finance_accounts`,
`financial_accounts`, `finance_transactions`, `imported_transactions`,
`fin_import_batches`) onto the unified `accounts`/`transactions`/
`import_batches` tables. Compat views remain in place as fallback
until a future drop removes them post-stability.

- **`app/shared/recurring-transactions.js`** (BUG FIX) — INSERT
  was hitting `finance_transactions` (a non-insertable view since
  v.151). The recurring-transaction generator has been silently
  failing for every active template since v.151 deployed. Now
  writes to unified `transactions` with `source='manual'`,
  `txn_type='recurring'`, fingerprint computed.
- **`app/shared/dedupe.js`** — single-row dedup query now reads
  both manual and imported (was filtering to manual implicitly
  via the compat view).
- **`app/shared/exportQueries.js`** — `finance_transactions`,
  `import_batches` queries repointed. Old `merchant` column dropped
  (didn't exist in unified schema). Export keys preserved.
- **`app/shared/folder-watcher.js`** — `account_type` lookup now
  uses unified `accounts.type` directly.
- **`app/features/search/routes.js`** — global search collapses
  former dual finance/investments account search into one query
  split by type vocab (Finance group: Checking/Savings/Credit/
  Cash/HSA/Loan/Mortgage/Other; Investments group: Brokerage/
  TSP/Retirement). Transactions search uses unified table.
- **`app/features/subscriptions/routes.js`** — JOIN onto unified
  `accounts` with `COALESCE(alias, name)` for display.
- **`app/features/dashboard/routes.js`** — net-worth aggregation
  reads `accounts`. Needs-review tables list updated.
- **`app/features/data/routes.js`** — three sheets repointed
  (Finance Accounts, Transactions, Import Batches). Writes from
  spreadsheet uploads now target unified tables. Column shape
  preserved where possible (`account_last4` aliased from `last4`,
  `merchant` dropped, etc.).
- **`app/features/backup/routes.js`** — JSON export + CSV export
  repointed. Export keys preserved for restore-format compat.
  Added `finance_import_batches` and `finance_holdings` keys for
  full unified-schema capture.
- **`app/features/settings/routes.js`** — four places: integrity
  check queries, tag-suggest MODULE_TABLE map, dropdown-rename
  CASCADE map, dropdown-usage CASCADE map. Type-vocab cascade
  writes to `accounts.type`; transaction-category cascade writes
  to `transactions.category`.
- **`app/features/system/routes.js`** — diagnostic test cleanup
  switched to `accounts.name` (was `financial_accounts.nickname`,
  a non-deletable view).
- **`app/server.js`** — health-check stats and module-counts page
  use unified table names. Response key `finance_transactions`
  preserved for back-compat.

### Parser sign-convention tests (v.155)

- **`tests/parser/run-parser-tests.js`** — fixture-driven test runner.
  Loads each `<bank>.csv` + `<bank>.json` pair, parses through the
  live `parsers.js`, and asserts:
  - format auto-detection matches expected
  - row count meets minimum
  - first-row spot check (date / amount / description substring)
  - sign convention: substrings → "positive" or "negative"
  Exit 0 on full pass, non-zero on failure.
- **Banks covered (7/7 pass):** Chase, BofA, Navy Fed, Capital One,
  Discover, Citi, USAA. Chosen because their CSV layouts are
  single-line clean and the parsers don't need text scaffolding.
- **Banks deferred:** Schwab Checking, Schwab Brokerage, Vanguard,
  TSP, Wells Fargo. These need richer fixtures (multi-line headers,
  positional columns, mixed transactions+positions). Tracked for
  next P2 drop.

### Categorization rule editor in Settings (v.155)

- **Rail item** under Apps & Integrations group: "Finance category
  rules" with rule-count badge. Searchable via the existing
  settings search.
- **Sub-panel `panel-finrules`** — three sections:
  1. "How rules work" — explainer (LIKE syntax, % wildcards,
     case-insensitive, sort-order tiebreak).
  2. "Add a rule" — pattern + category + sort-order inputs, plus
     "Apply to uncategorized" button that backfills existing rows.
  3. "Existing rules" — table with delete buttons per row.
- **Bare keywords auto-wrapped** in `%…%`. If user types `%` or `_`
  themselves, pass through unchanged.
- **Backend already exposed** these endpoints in v.151 carryover —
  this drop is UI-only.
- **Rail badge** seeded on settings page boot (read-only GET, no
  auth required).

### Missing-statement → todos auto-feed (v.155)

- **`detectMissingStatements(monthsBack)`** extracted from the
  existing `GET /api/v1/import/missing-statements` route into a
  reusable function. Now exported on the import router so
  `shared/autoTodos.js` can `require()` it without auth coupling.
- **`auto_type='missing_statement'`** added to `syncAutoTodos()` as
  item 11. For each missing month per tracked account → one auto
  todo. Auto-resolves when statement gets imported (i.e. when the
  account no longer appears in the missing list for that month).
- **`auto_source_id`** encodes `(accountId * 1_000_000 + YYYYMM)`
  so each (account, month) is uniquely keyed in INTEGER. Avoids
  needing a new column or a string-keyed source.
- **Title format:** "Missing statement — Chase Sapphire (Chase) —
  April 2026". Notes: "No import batch found for April 2026.
  Download the statement and import it via Finance → Import."
- **Due date:** end of the missing month (28th). Forces older gaps
  to sort urgently in the todo list.
- **Category:** "Finance".

### Credit-card schema + landing aggregator + real-data tiles (v.154)

- **Migration 128** — additive CC columns on `accounts`:
  `credit_limit`, `statement_balance`, `minimum_payment`,
  `payment_due_date`, `apr`, `promo_apr`, `promo_end_date`,
  `annual_fee`, `annual_fee_renewal_date`, `rewards_balance`. All
  NULL default. Idempotent guard via `_migrations_cc_columns_done`.
  Per-column ALTER wrapped in try/catch so partial reruns recover.
- **`GET /api/v1/finance/landing`** — single aggregator returning
  data for all 6 Overview tiles. Excludes inactive accounts.
  - Tile 1 net_worth: total + assets + liabilities + investment +
    MoM delta vs prior snapshot (≥25 days old).
  - Tile 2 cash_flow: MTD credits/debits/net + count + same-day
    last-month MTD net for the "vs last mo" pill.
  - Tile 3 credit_cards: count, total statement balance, total min
    payment, utilization, soonest due date + account label.
  - Tile 4 bank_accounts: count + total + per-type breakdown.
  - Tile 5 holdings: positions + market value.
  - Tile 6 hsa_lp_fsa: HSA total + LP-FSA remaining + combined.
- **POST/PUT `/accounts`** accept the new CC fields. Empty string
  clears the column.
- **Account form** — new "Credit card details" collapsible section
  shown only when type=Credit. 10 fields wired through
  openAccountDrawer / saveAccount.
- **Overview tiles wired.** Sample-data banner removed. Hardcoded
  sample numbers (`$487,300`, `$3,420`, etc.) all gone. Tiles
  render `—` placeholders until first fetch resolves. Fires on
  DOMContentLoaded and on every Overview tab activation.
- **Tile 2 pace heuristic** — compares MTD net to same-day-last-
  month MTD net. No formal "on track" target defined yet; revisit
  when categorization editor lands.

### Fingerprint v2 + 5-day window dedup (v.153)

- **Shared helper** `app/shared/tx-fingerprint.js`:
  - `normalizeDescription(s)` — uppercase, collapse whitespace,
    strip leading bank prefixes (POS DEBIT, DEBIT CARD PURCHASE,
    PURCHASE AUTHORIZED ON dd/dd, etc.), strip trailing reference
    IDs (`*[A-Z0-9]{4,}`, `#\d+`, `REF: …`, `ID: …`, `XX/dd`,
    bare 6+ digit suffix). Repeats trailing strip until stable.
  - `fingerprint(account, date, amount, desc)` — md5 of
    `${account}|${date}|${amount.toFixed(2)}|${normalize(desc)}`.
  - Smoke test: 10/10 normalization cases pass; 5/5 dedup cases
    pass.
- **Migration 127** recomputes every row's fingerprint, then
  flags duplicate fingerprints (`flagged=1, needs_review=1`,
  notes appended). Surfaces existing dups in v.152 needs-review
  queue.
- **Both import paths** (`/api/v1/finance/transactions/import-file`
  and `/api/v1/import/confirm`) use the shared helper. 5-day
  window dedup logic: same account, ±$0.01 amount, ±5 day window,
  same normalized desc, different fingerprint → flag.
- **Coarse SQL prefilter** (`julianday()` math for date window,
  amount range, account, fingerprint differs) followed by
  JS-side normalized-desc equality check. No need for a
  generated column.

### Finance frontend parity (form + list reads) — carried from v.152

- **Account form** — alias, owner, currency, track_statements always
  visible. Locked vocab dropdown (11 types). Inactive banner with
  Reactivate. Drawer no longer routes by type — single endpoint for
  every write.
- **Single-fetch reads** across the page. Type filter happens in JS,
  not via dual-endpoint joins. Fixes a v.151 regression that showed
  every account twice and broke the Import-tab account create/edit
  (frontend was sending `nickname`/`account_type`/`last_four`; backend
  expected unified shape).
- **Field-shape repair** — alias preferred over name; ⚠ review badges
  on flagged rows; unified-shape reads on holdings, missing-statement
  alerts, account list rows, batch history.
- **Delete → Deactivate** UI parity with v.151 backend (no DELETE
  endpoint exists).
- **Batch rollback uses POST** (was DELETE).

### Needs-review queue

- **Banner on Overview tab** showing total flagged count (accounts +
  transactions), hidden when count is zero.
- **Expandable panel** lists each flagged row with two actions: Edit
  (opens drawer) or Looks fine (one-tap clear). The panel
  auto-refreshes after either action.
- **Backend:** `GET /api/v1/finance/needs-review` returns
  `{accounts, transactions, counts}`; inactive accounts excluded from
  counts. `POST /accounts/:id/clear-review` and
  `POST /transactions/:id/clear-review` for one-tap clears.
- **Boot path** fires `loadNeedsReview()` on DOMContentLoaded so the
  banner shows on first paint, not just after tab switching.

### Bundled v.151 carryover (since v.151 was never deployed)

- **Migration 126** — merges `finance_*` + `financial_*` tables into
  unified `accounts` + `transactions`. Compat views keep the rest of
  the codebase working unchanged. Idempotent. Reversible (legacy
  tables renamed `_legacy_*`).
- **Type vocabulary locked**: Checking, Savings, Credit, Cash, HSA,
  Brokerage, TSP, Retirement, Loan, Mortgage, Other.
- **Dedup on (institution, last4)** during merge — pulls `nickname`
  over as `alias`, sets `source='merged'`, `needs_review=1`.
- **No CASCADE** anywhere; **no DELETE** on accounts or transactions
  (deactivate / void / rollback only).
- **Validation on manual tx POST** — account exists+active, amount
  finite, future-date → `needs_review=1`.
- **Net worth** includes holdings on assets side; snapshot history
  never auto-pruned.

### Finance landing — round 1 of 3 (design)

Plan locked with Al in chat 16 (this session, 2026-05-09):

- **Round 1 (DONE):** Tile-grid landing on /finance.html. Sample data
  hardcoded. Visual review only — no backend wiring.
- **Round 2 (next):** Drill-in card design for credit cards, accounts,
  holdings, transactions. Same Vellum 5-zone template as medical.
  Will need additive schema for credit-card-specific fields (see
  Round 2 schema gaps below).
- **Round 3 (after R2):** Backend `/api/v1/finance/landing` aggregator
  endpoint. New tables/columns where needed. Sample tile data
  replaced with real API results.

### Why tiles vs cards (locked language)

- A **tile** is a roll-up: one number summarizing many records
  (e.g. "Credit Cards · $3,420 owed across 4 active"). Click → drills
  into the section's detail page.
- A **card** is one record with detail (e.g. one specific transaction
  at Shell for $58.12). Used on detail pages, never on landing.
- Both use the same 5-zone template (eyebrow / hero / pill / strip /
  entities) and the Vellum theme.

### Tile composition (locked v.150)

The 6 tiles, in display order:

1. **Net Worth** — Total $ + MoM delta + 12-month sparkline + assets
   vs liabilities. Click → networth tab.
2. **Cash Flow MTD** — Net + on-track pill + in/out bar + vs-prior-month
   + YTD. Click → transactions tab.
3. **Credit Cards** — Total owed + utilization pill + top 2 cards by
   balance with mini bars + "+N more" rollup + earliest due date.
   Click → accounts tab.
4. **Bank Accounts** — Total liquid + stale-count pill + checking /
   savings split + last-reconciled callout. Click → accounts tab.
5. **Holdings** — Market value + YTD % pill + top 2 positions with
   gain% + "+N more" rollup + vs-S&P / today line. Click → holdings.
6. **HSA + LP-FSA** — Combined unreimbursed pool + LP-FSA deadline pill +
   per-pot mini rows + "manage in Medical → Receipts" hint. Click →
   hsa tab (will redirect to Medical Receipts when Path B ships).

**Subscriptions tile dropped from landing** — Subscriptions has its
own module page in nav already. Adding a tile here was duplicate
signal.

**Budgets tile not added** — Al said skip; can add later if he uses
budgets actively.

**Gift cards / trade terminal / property** — kept off the landing.
Low signal as tiles. Trade has its own page.

### Visual rules (locked v.150) — applies to every finance tile

- Status dot in eyebrow, semantic colors: green = healthy, amber =
  needs attention, red = problem.
- Status pill on right of hero, same color family as the dot.
- Hero number is `Newsreader/Fraunces` italic 40px on desktop, 36px on
  mobile.
- Mini list rows are DM Mono 12px. Each row has a `flex:1` label slot
  on the left, optional bar/badge in middle, right-aligned $ amount
  with `min-width:54px` for column alignment.
- Strip line at bottom (mono 11px) — most-actionable single line of
  text. Color shifts to red when it's an alert.
- Entities row at the very bottom — family avatars (NEVER overlap;
  see medical's universal avatar rules in `_templates.html` #17).
- Mobile: 1-column grid below 700px viewport.

### "Alias" field (locked, schema gap for round 2/3)

Account/card display names truncate at ~18 characters in mini rows.
Add `alias TEXT` to `finance_accounts` (additive, nullable). Render
rule: show alias if set, otherwise fall back to `name`. Examples:
"Apple" instead of "Apple Card", "Amex BCP" instead of "American
Express Blue Cash Preferred".

### Earliest-due-date rule (locked, round 3 logic)

The "next due in N days" line on the Credit Cards tile resolves
across all credit cards: minimum `payment_due_date` where balance
> 0. Tiebreak by larger `minimum_payment`.

### HSA + LP-FSA combined into one tile (locked)

Hero is the combined unreimbursed pool. Two mini rows split it by pot.
Click target opens HSA on /finance.html for now; once Path B (HSA
receipts in Medical) lands, the click target changes to /medical.html
on the Receipts tab.

### Round 2 schema gaps (logged for the round 2 drop, not yet built)

For credit-card detail cards to work, `finance_accounts` needs
additive columns (or a `finance_credit_card_details` sidecar table):

- `alias` TEXT (locked v.150 — applies to all finance accounts, not
  just credit cards)
- `credit_limit` REAL
- `payment_due_date` DATE
- `minimum_payment` REAL
- `statement_balance` REAL  (distinct from `current_balance`)
- `statement_date` DATE
- `apr` REAL
- `promo_apr` REAL
- `promo_end_date` DATE
- `annual_fee` REAL
- `annual_fee_renewal_date` DATE
- `rewards_balance` REAL
- `rewards_program` TEXT

CSV imports won't populate most of these — they're entered once per
card and updated when statements come in. Detail-card edit form
needs to capture them.

### Capture-everything rule (carry-over from EOB, applies to finance)

Per the EOB CAPTURE-EVERYTHING RULE locked earlier:

- Add `raw_row` JSON column to `imported_transactions` — preserves
  the original CSV/OFX row even if the parser drops a column.
- Add `original_headers` per import batch — so old imports can be
  re-parsed if a parser improves.
- Add `normalized_description` for dedup (separate from display
  description). See IN FLIGHT #1 (description normalization).
- Add `pending_or_posted` flag distinct from `flagged`.
- Add `linked_record_type` + `linked_record_id` for cross-module
  links (fuel → vehicle, CVS → prescription). This is the same
  as the `tx_record_links` design in TRANSACTION_LINKING_SPEC.md;
  decide before round 3 whether to use a sidecar table or add
  direct columns.

These are NOT yet wired. Logged here so round 3 doesn't forget.

---

- **SE/Self bug fixed** at the root. Form drawers (med, condition,
  visit) pre-fill the family widget from the active patient strip.
  Save handlers no longer write the literal string `"Self"` — they
  write `null` when no member is set. Card renderers no longer
  compute initials from the string `"Self"`, so the avatar simply
  doesn't render when there's no real family link.
- **All tab is the landing tab** on every page load. It's also the
  first tab in the row. No more grouping by domain — one flat grid,
  newest first.
- **Mobile = swipe one card at a time.** On screens ≤700px, the All
  grid becomes a horizontal swipe-snap carousel. Desktop unchanged
  (2-col grid, max 1320px wide).
- **Visit ↔ condition junction** (new migration 125). Visits can
  link to one or more conditions ("this visit was for hypertension
  and cholesterol"). Visit form has a chip picker; visit cards show
  linked-condition tags.
- **Data joins for the four card types are now consistent**:
  - `family_member_name` returned for visits (was missing — caused SE bug)
  - `attachment_count` returned for med, condition, visit, EOB
  - `family_member_ids` rolled up per EOB statement (from claims),
    so the All-tab person filter actually narrows EOBs by person
    instead of fuzzy substring match

Carry-over from v.148 (still shipped, unchanged in code):
- EOB drill-down modal (real data, Vellum styled)
- Auto-todo for upcoming visits (rule 7b in autoTodos.js)
- Device family scope wiring (`gh-scope-changed` listener)

---

## ✅ SHIPPED — RECENT DROPS (compressed)

### v202604.150 (finance landing) — see ✋ DON'T TRUST list above for items still untested

- /finance.html lands on a new "Overview" tab (first tab, default).
- 6-tile grid with sample data (Net Worth, Cash Flow MTD, Credit
  Cards, Bank Accounts, Holdings, HSA + LP-FSA), Vellum theme.
- Tiles clickable; `gotoFinTab(id)` drills into the existing tab.
- HSA + LP-FSA combined into one tile.
- FAB and year pill hidden initially (HSA-only chrome).

### v202604.149 (medical) — see ✋ DON'T TRUST list above for items still untested

- SE/Self avatar bug fixed at the root: form drawers pre-fill the
  family widget from the active patient strip; save handlers no longer
  write the literal string `'Self'` (they write `null`); card
  renderers no longer compute initials from `'Self'`.
- All tab as default landing on /medical.html (cross-card grid,
  newest-first sort).
- Mobile swipe-snap carousel on the All tab (≤700px).
- Visit ↔ condition junction (migration 125): chip picker on visit
  drawer, purple chips on visit cards. Replace-set on PUT, DELETE
  clears junction; no FK CASCADE per arch rule.
- Data joins audit: `family_member_name`, `attachment_count`,
  `family_member_ids` rollup added across med/cond/visit/EOB.

### v202604.148 (medical, prior) — already tested

- EOB drill-down modal (real data, Vellum styled)
- Auto-todo for upcoming visits (rule 7b in autoTodos.js)
- Device family scope wiring (`gh-scope-changed` listener)

---

## ⏳ IN FLIGHT — NEXT DROPS

> **Priority order locked 2026-05-08.** Items 1–5 are the finance
> hardening sequence Al approved ("go build, you're the PM").
> Items 6+ are independent.

### 1. Description normalization for dedup (finance, ALL)

Current `fingerprint = hash(account_id + date + amount + description)`
treats `"AMAZON.COM*1A2B3C"` and `"AMAZON.COM*9X8Y7Z"` as different
because of trailing reference IDs. Add a normalize step:
- uppercase
- collapse multiple spaces
- strip trailing `*ABC123` / `#REF` / `XX/YY` reference ID suffixes
- trim

Hash the normalized string, store original for display. Backfill
existing rows with `UPDATE transactions SET fingerprint = new_hash
WHERE source='imported'` in a migration. (After v.151 unification,
fingerprints are stored on the unified `transactions` table.)

### 2. Pending → posted window for dedup

Pending and posted versions of the same charge often have different
dates. Add second-layer check: same account + same amount (within
$0.01) + within 5 days + similar normalized description → flag, not
silent skip. Already partially wired (the `flagged=1` field exists on
the unified `transactions` table); extend the SQL window from "same
date" to "5-day window" and add description-similarity check. Both
the `/api/v1/finance/transactions/import-file` and `/api/v1/import/
confirm` paths need updating.

### 3. Sign-convention spec tests (finance parsers)

No automated test today proves the sign convention is right per
bank. A future parser change could flip a sign silently and corrupt
every Chase or Schwab transaction. Add fixture CSV + expected
output JSON per parser (one file per bank), assert on import. Lives
in `tests/parser/parser-fixtures/`. Run via `node tests/parser/run-parser-tests.js`.

Banks to start with: Chase, BofA, Navy Fed, Schwab Checking, Schwab
Brokerage, Vanguard, TSP, Capital One, Discover, Citi, USAA. (One
fixture per bank, 5–10 representative rows.)

### 4. Categorization rule editor in Settings

50+ rules seeded in migration 046 (`import_category_rules`),
editable only via SQL today. Build a Settings panel under
Settings → Imports → Category rules:
- List view: pattern · category · sort_order · active toggle
- Add / edit / delete (additive — never wipe seeded rules silently)
- Test pane: paste a transaction description, see which rule
  matches and what category it'd assign
- Import/export rules as CSV (so power users can bulk-edit)

### 5. Cross-module link table (`tx_record_links`, `tx_link_rules`)

Designed in chat-14, not built. Lets you link a transaction to a
specific record in another module — fuel transactions to the right
vehicle, CVS transactions to the right Rx, etc. Schema is additive,
two tables. Integration: each card with derived numbers (vehicle
YTD fuel, Rx YTD cost, HSA YTD) reads from `tx_record_links` to
compute its number. Not started.

### 6. Inventory bulk import — move from Settings to module page

Currently lives in Settings (`POST /api/v1/import` for CSV/upload).
Should match the principle: file imports live on the module page.
Move the upload widget to `inventory.html`, leave a Settings page
that just links to it.

### 7. Cross-module cards on FINANCE (mirror medical's "All" tab)

Medical has the cards-and-grid model with an "All" tab that
combines meds + conditions + visits + EOBs. Finance needs the same
treatment. Card types live there:
- **Account card** — one per banking/credit/brokerage account.
  Hero: current balance. Strip: this-month spend, last
  reconciled, account # last 4. Entities: institution avatar,
  primary owner.
- **Transaction card** — for review queue and "flagged"
  transactions. Hero: amount + merchant. Strip: date, category,
  account. Entities: merchant logo (future), linked record (if
  cross-module link exists).
- **Holding card** — one per stock/ETF/fund position. Hero: market
  value. Strip: shares, cost basis, gain/loss. Entities: symbol
  pill, account.
- **Budget card** — one per active budget. Hero: spent / limit
  with progress bar. Strip: days left in period, top category.
- **Net-worth card** — single card, monthly trend hero +
  asset/liability split.

All four card domains get a unified "All" tab that interleaves
recent transactions, flagged items, and account snapshots, sorted
newest first (same pattern as medical).

### 8. Cross-module cards on HSA

Same treatment:
- **Receipt card** — Hero: amount. Strip: vendor, date, category.
  Entities: patient avatar, linked EOB (if matched).
- **Reimbursement card** — Hero: claimed amount. Strip: status, date.
- **Vault card** — Hero: unreimbursed pool. Strip: # receipts, oldest
  date.

### 9. EOB parsing — verify Aetna MHBP parser is complete

**Single carrier: Aetna MHBP** (Mail Handlers Benefit Plan, the
federal insurance plan administered by Aetna). No other carriers
are planned. The existing parser at `features/medical/eob-parser.js`
handles this carrier; the parser-selector machinery in Settings
exists but currently only ever lists this one option.

When Al uploads sample EOBs:
- Verify every field the cards need is being extracted (statement
  date, member ID, plan name, per-claim patient/provider/claim ID,
  per-service date/code/amount, balances/deductible)
- Fill gaps if any
- Verify dedup keys (insurer + member_id + statement_date for
  statement; patient + claim_id + send_date for claim) are unique
  across Al's real history
- Verify `family_member_id` resolution works for every patient
  name format the EOB uses

### 10. Card click-throughs to dedicated /family.html and /contacts.html

Blocked: those pages don't exist yet. Quick-view modals are the
fallback.

### 11. Receipt vault polish (v140 carryover)

- EOB folder-drop persistence (importEob counts but doesn't save)
- LP-FSA plan info Settings UI
- Mileage UI on medical visit form (`round_trip_miles` backend ready)
- attach-lifecycle adoption for documents/insurance/subscriptions

### 12. Restore Record Refill / Link Receipt? (if Al wants it back)

Lost in v.148 v1→v2 merge. v2 stubs make buttons no-op gracefully.
Source preserved in `Ghrava_Share_20260508.zip` if needed.

### 13. Apply scope-wiring pattern to other modules

Insurance / documents / subscriptions / kids could honor the device
family scope same way medical does. One IIFE per page listening
for `gh-scope-changed`.

### 14. Backlog (per userMemories — 15+ modules)

- **High:** Photo-first wardrobe, Today page (Now/Soon,
  /api/v1/today, today_snoozes table)
- **Medium:** /_drafts/status.html, Reports rollups, Amazon→inventory
  via Gmail
- **Low:** Calendar sync, browser extension. Email receipt parsing
  REJECTED — duplicates bank data.

---

## 🎯 LOCKED DESIGN DECISIONS

### Cards
- 5 zones: A eyebrow / B hero+icons / A' tags+pill / C strip / E entities
- Vellum theme: `--bg-card #fbf6e9`, `--border #d8cba8`, `--accent #c0392b`
- Type ladder: Fraunces serif italic hero; Inter body; DM Mono labels
- 2-col desktop max, 1-card swipe mobile (v.149+)
- All-tab is the canonical landing experience for medical.html
- _card_previews.html shows the locked spec for condition / visit /
  EOB cards (medication card not on previews; renderMedCard is the
  reference)

### Dedup
- Two layers: file_hash + record-level natural-key hash
- Outcomes: identical → skip; strong → queue; weak → insert auto_imported=1
- Manual entry runs same gate as parser
- Reactivate: never silent
- Dose change: reactivate same record + log + new fill at new dose
- Condition metrics UPSERT on (cond_id, metric_name, measured_on)
- Visit↔condition junction (v.149): replace-set semantics on PUT;
  empty array clears all links

### Architecture
- journal_mode=DELETE, synchronous=FULL (NEVER WAL)
- NEVER ON DELETE CASCADE — explicit cleanup on delete handlers
- Migrations additive-only
- requireAuth only on `/settings/*` and `/watcher/*`
- All read GETs public
- Auth NOT in deploy zip

### Code quality (5 gates)
1. Node syntax check on JS
2. Inline script syntax on HTML
3. Critical IDs preserved (compared against UNION of v1+v2 medical.html)
4. Migration sim against live shape
5. No auth/middleware in deploy

---

## 📥 INGEST CONTRACTS — what's wired vs not

> **Stable rules** for how files (EOBs, receipts, statements) become
> records. Verified against live code on 2026-05-08. Update whenever
> the import path changes.

### EOB import — wired and locked

1. **File-level dedup.** Watcher computes SHA-256 of file bytes. If the
   same hash exists in `med_eob_statements.file_hash`, the file is
   silently skipped. Same logic on the manual `/eob/import` endpoint
   when invoked with the same buffer. *(`dedup.fileHash`)*

2. **Statement-level dedup.** After parse, hash =
   `insurer + member_id + statement_date`. If the key already exists
   but the file_hash is different (carrier re-issued a corrected EOB),
   the new statement goes into `med_pending_review` instead of being
   silently inserted. An auto-todo is created. *(`dedup.eobStatementHash`)*

3. **Multiple family members per statement.** EOB statements are
   shared (covering all dependents). Each `med_eob_claims` row carries
   its own `patient` text + `family_member_id`. `GET /eob` returns a
   `family_member_ids: [...]` array per statement (rolled up from
   claims, v.149) so the All-tab person filter works.

4. **Multiple visits per statement.** Each statement has many claim
   rows. The drill-down modal shows them grouped by patient with
   per-service expansion. *(`/eob/:id` returns nested
   claims → services + balances)*

5. **Per-claim dedup hash** on `med_eob_claims.dedup_hash` =
   `patient + claim_id + send_date`. Designed for cross-EOB joining
   (recognizing the same claim on a corrected statement).
   *(`dedup.eobClaimHash`)*

6. **Patient name resolution.** `resolvePatient(rawName)` returns
   `{id, display_name, confidence: exact|initial|ambiguous|none}`.
   Exact + initial → write `family_member_id`. Ambiguous + none →
   leave id null AND flag the claim into `med_pending_review` with
   category `name_unmatched` or `name_ambiguous`. The pending-review
   banner on medical.html surfaces these.

### EOB import — gaps (not wired or unverified)

7. **EOB → HSA receipt auto-match.** Discussed in design chats
   ("retry hook fires when a new HSA receipt is saved, looking for
   matching claim + amount"). **Status uncertain.** Look in
   `features/medical/eob-parser.js` and `features/hsa/routes.js` for
   any `eob_match` or `claim_link` references before assuming it
   works.

8. **Amount-mismatch UX** (EOB says you owe $X, HSA receipt has $Y).
   Designed, **not verified live.**

9. **Settings UI to pick the parser.** Only MHBP is implemented.
   Migration 094 added `app_config.eob_parser` and a Settings panel
   was designed; **not yet visible in current settings.html**
   (verify before promising users they can switch parsers).

### Bank/finance statement import via watcher — NOT WIRED

10. `importStatement(filePath, rule)` in `shared/folder-watcher.js`
    is a placeholder: it counts CSV rows (`lines - 1`) and returns
    that count. **No rows are inserted.** Real import still requires
    the user to use the Finance → Import tab manually.

11. The Finance Import tab (`finance.html`) still owns the live
    bank/brokerage CSV path. Routes:
    - `POST /api/v1/import/preview` (banking)
    - `POST /api/v1/finance/transactions/import-file` (banking confirm)
    - `POST /api/v1/import/confirm` (investment)

### Watcher actions that ARE wired

12. **`module: 'eob'`** — full pipeline (file hash → parse → statement
    hash → pending-review on conflict → claim insert → name
    resolution → flag).

13. **`module: 'attach'`** — generic "drop a receipt anywhere, it
    becomes a draft row" handler. Used today for HSA receipts. Hash
    dedup at file level, then moves the file into the target module
    folder using hash-prefix naming, inserts a draft `attachments`
    row + a draft target row (e.g. `hsa_payments` with status='draft').
    The user resolves drafts via the Inbox modal on `hsa.html`.

14. **`module: 'statement'`** — placeholder, see (10).

### Configuration shape

```jsonc
{
  "watch_paths": ["/data/_inbox/eob", "/data/_inbox/receipts"],
  "rules": [
    { "name": "MHBP EOBs", "watch_path": "...eob",      "module": "eob",       "parser": "mhbp" },
    { "name": "HSA receipts","watch_path":"...receipts","module": "attach",
      "target_module": "hsa", "target_table": "hsa_payments", "pot": "hsa" },
    { "name": "Chase ckg",   "watch_path": "...chase",   "module": "statement",
      "account_id": 7  /* PLACEHOLDER — won't actually import */ }
  ],
  "catch_all": { "enabled": true, "action": "queue" }
}
```

Stored in `app_config.folder_watcher_config` (JSON). Edited via
Settings → Watcher panel (`/settings.html#watcher`).

### Where files live — LOCKED (Al, 2026-05-08)

Docker compose mounts `/share/Backups/MyAppAttachments` →
`/app/attachments`. No new Docker mount needed. The watcher's inbox
lives **under that same mount** as a `_inbox/` subtree. Layout:

```
/share/Backups/MyAppAttachments/         ← existing NAS mount
├── _inbox/                              ← watcher reads here
│   ├── eob/                             (EOB PDFs — MHBP today)
│   ├── receipts/                        (HSA/FSA receipts → attach)
│   ├── chase-checking/                  (per-account bank CSV)
│   ├── schwab-brokerage/                (brokerage CSV)
│   ├── …                                (one folder per finance account)
│   └── _failed/                         (parse failures park here)
├── _orphans/                            (record deleted, file kept)
├── _rejected/                           (user rejected during review)
└── eob/, hsa/, medical/, …              ← existing per-module folders,
                                            untouched, holds final files
```

NAS bootstrap: create `_inbox/` and its subfolders by hand once.
Watcher creates `_failed`, `_orphans`, `_rejected` on startup if
absent. Watcher config (`app_config.folder_watcher_config`) holds
absolute paths like `/app/attachments/_inbox/eob`.

### Folder watcher vs Finance Import screen — LOCKED (revised 2026-05-08)

**Three entry points exist as a principle for every file-driven module:**
1. Folder watcher (bulk + ongoing — eventual)
2. Upload UI on the module page (one-off, mobile, no-NAS — primary)
3. Manual single-record entry (corrections, no-file cases — always)

**Build order is one entry point at a time, not all three at once.**
Starting with **upload-from-page**. Refine it until it handles every
bank/account/format reliably. Only then, wire the same parser into
the watcher and any settings-upload path. **No broken experience** —
finance-via-watcher is all-or-nothing when it ships, but it's not
shipping yet.

- **Upload from page** = the priority. Built, refined first.
- **Manual single-row entry** = no parser involved, just runs through
  the dedup gate. Stays as-is.
- **Folder watcher for finance** = **deferred**. The placeholder in
  `shared/folder-watcher.js` (`importStatement` returns line count,
  inserts nothing) stays in place but should NOT be relied on.
  Wire it later with the same parser the upload path uses.
- **Folder watcher for EOB and HSA receipts** = stays wired and
  working. No regression there.

### Parser reuse — LOCKED (Al, 2026-05-08)

> "Can we reuse the parser no matter what the input source is."

**Yes — and the parser ships as a standalone module from day one, even
though only one entry point will use it initially.** This is to avoid
the trap of "build it inline, refactor later" — refactor never happens.

Pattern that EOB already follows (`eob-parser.js` called from both
`/eob/import` and `importEob`) gets mirrored:

- New `shared/finance-parser.js` with `parseFile(buffer, filename,
  account_type)` and `insertTransactions(rows, account_id, source)`
- Dedup gate lives **inside** `insertTransactions` — neither caller
  can bypass
- Manual single-row entry calls `insertTransactions(...)` with one row
- Future watcher path calls `parseFile` then `insertTransactions`
- One parser per data type, multiple entry points. Same rule for any
  future structured input (new bank format, new EOB carrier).

### Finance scope — LOCKED (Al, 2026-05-08)

**Two halves stay separated** (per the existing schema rule:
`finance_accounts` for banking ≠ `financial_accounts` for investment;
never mix):

- **Bank statements** = checking, savings, credit cards
- **Trading** = taxable brokerage, retirement (TSP, IRA, 401k), HSA
  invested, FSA invested

Both halves get the three-entry-point principle. Both call the same
shared parser. Both gate through dedup.

### Bank + format coverage matrix (incomplete — fill in when building)

CSV-first. PDF deferred unless a specific account refuses to give CSV.
OFX/QFX as backup for accounts that lean on it.

| Institution | Account type | Format(s) | Notes |
|---|---|---|---|
| Chase | checking, credit | CSV ✓ OFX ✓ QFX ✓ | Single signed amount column |
| Schwab | checking | CSV ✓ OFX ✓ | Split debit/credit columns — merge on import |
| Schwab | brokerage | CSV ✓ | 2-row junk header to skip |
| Vanguard | brokerage | CSV ✓ | Wide format, most columns irrelevant — use Net Amount |
| Vanguard | checking | CSV ✓ | Simple 4-column |
| TSP | retirement | CSV ✓ | Government format, minimal columns |
| BofA | checking, credit | CSV ✓ OFX ✓ | Sometimes no header row |
| Navy Federal | checking, credit | CSV ✓ | Positive=credit, negative=debit |
| Fidelity | HSA invested | CSV ✓ | Standard format |
| Discover | credit | CSV (verify) | TBD |
| _other credit cards_ | _Al has more_ | TBD | Al will provide list when finance drop starts |

Format detection has to be **silent** — auto-detect bank from column
headers, no user input needed for the listed banks.

---

## 🛡️ SMART DEDUP RULES — domain-by-domain

> Locked across multiple past chats (chat-16 design + chat-7
> follow-up). Captured here so the next session doesn't have to
> grep history.

### Two-layer model

1. **File-hash dedup** (SHA-256 of file bytes). Catches literal
   duplicate files. Silent skip — no UI, no warning, no audit-log
   noise. Applies everywhere a file is uploaded (every module).

2. **Smart natural-key dedup.** Per-domain function checks if a
   semantic duplicate already exists. **Warns, does not block.**
   User can force-create with two-tap confirm. Applies to a
   specific list (next subsection).

### Domains where smart dedup applies (8)

| Domain | Natural key |
|---|---|
| HSA receipts | date + vendor + amount + person |
| FSA receipts | date + vendor + amount + person |
| EOBs (statement) | insurer + member_id + statement_date |
| EOB claims | patient + claim_id + send_date |
| Bank/credit transactions | date + amount + description (account-scoped) |
| Subscriptions | name (case-insensitive) |
| Insurance policies | policy_number |
| Medical visits | date + provider + patient |
| Prescriptions / med fills | medication_id + fill_date |

### Domains where smart dedup is NOT applied (file-hash only)

inventory, wardrobe, perfume / jewelry, kids, daily-log, todos,
books, career, property, resources, documents.

The line: **if duplicating it costs money, time-with-IRS, or
pollutes a clinical record → smart dedup. Otherwise → drop it
twice means drop it twice; user takes responsibility.**

### Behavior contract

- Dedup **warns, never blocks**. Modal copy: "This looks like a
  duplicate of #142 from Mar 12. Save anyway?" Two-tap to confirm.
- Force-creates leave an audit-log entry: "user-confirmed
  duplicate of #142."
- For watcher path (no human in the loop): suspected duplicates
  go to `med_pending_review` (or domain equivalent) instead of
  silently inserting. An auto-todo surfaces them in the Notifications
  banner.
- Manual entry path: dedup check is a synchronous API call returning
  `{ duplicate_of: id, warning: "..." }` if hit; UI shows confirm
  modal; user clicks Save Anyway → `?force=1` on the POST.

### Edge cases (the 11)

1. File dropped twice → file-hash dedup catches it, watcher logs
   "duplicate, skipped." No second draft.
2. User reviews receipt, deletes the HSA row later → file moves to
   `_orphans/`, never auto-purged. Audit log entry.
3. Upload interrupted → hash isn't recorded until file fully
   written. Half-files discarded on watcher restart.
4. User opens review modal, fills 2 of 4 fields, closes browser →
   draft preserved as-is. Re-opens to same state.
5. EOB parser fails → file lands in `_inbox/_failed/`, status 🔴 in
   pending review, fields blank, manual entry resolves.
6. EOB matches multiple receipts → status ⚠️ conflict, user picks
   one in review modal.
7. EOB arrives before receipt → sits as 🔵 awaiting-receipt, retries
   on every new receipt save (the "retry hook" in eob-parser.js;
   status uncertain — verify before assuming wired).
8. Receipt amount differs from EOB "your responsibility" → review
   screen shows both with delta highlighted.
9. Receipt rejected as not medical → file moves to `_rejected/`,
   draft deleted, audit log.
10. Same receipt via app + folder drop → first wins, hash dedup
    catches second.
11. File too big (>20MB) → friendly error, user retakes/accepts.

### Implementation status

| Piece | Status |
|---|---|
| File-hash dedup (file_hash on tables) | ✅ wired for med_eob_statements, med_visit_notes, med_medications, attachments |
| EOB statement+claim natural-key dedup | ✅ wired (`dedup.eobStatementHash`, `dedup.eobClaimHash`) |
| Visit + medication natural-key dedup | ✅ wired (`dedup.visitHash`, `dedup.medicationHash`) |
| Pending-review queue (`med_pending_review`) | ✅ wired |
| Bank transaction dedup (fingerprint) | ✅ wired in `/import/confirm` — but description-normalization gap and pending-window gap remain (see IN FLIGHT #1, #2) |
| Categorization rules | ✅ 50+ seeded rules in migration 046, applied on import; ❌ no editor UI (IN FLIGHT #4) |
| Auto-categorize on import | ✅ wired |
| `is_transfer` classifier (CC payments, brokerage deposits) | ✅ wired |
| Sign-convention spec tests | ❌ not wired (IN FLIGHT #3) |
| Force-create confirm modal (manual entry) | ⚠️ partial — exists for some domains, not all 8 |
| HSA receipt natural-key dedup | ⚠️ unverified — `shared/dedupe.js` referenced in design but verify it exists in code |
| Subscription / insurance dedup | ❌ design spec'd, code unverified |
| EOB→HSA retry hook | ❌ design spec'd, code unverified |
| Audit log for force-creates | ❌ design spec'd, code unverified |
| Cross-module link table (`tx_record_links`) | ❌ designed in chat-14, no migration, no code |

> Items in ⚠️ / ❌ should be verified by grepping for the named
> functions before any next chat assumes they work.

---

## 🎴 CARDS EVERYWHERE — design principle (LOCKED 2026-05-08)

> Medical's card system is the reference. Every module that has
> records of varying types gets the same treatment.

**Principle:** Each domain (medical, finance, HSA, future) has:
- Per-domain "tabs" for individual record types
- An **"All" tab as the landing tab** that mixes records, sorted
  newest first
- One card style per record type, with the locked Vellum design:
  5 zones (eyebrow / hero / tags / strip / entities)
- 2-col desktop, 1-card swipe mobile
- Lens-based filtering shared across the All tab

**Modules getting this treatment** (in priority order):

| Module | Status | Card types planned |
|---|---|---|
| Medical | ✅ shipped v.149 | Med, Condition, Visit, EOB |
| Finance | ❌ planned (IN FLIGHT #7) | Account, Transaction, Holding, Budget, Net-worth |
| HSA | ❌ planned (IN FLIGHT #8) | Receipt, Reimbursement, Vault |
| Insurance | ❌ later | Policy, Claim, Premium |
| Inventory | ❌ later | Item, Receipt, Warranty |
| Subscriptions | ❌ later | Subscription, Renewal, Cancellation |
| Property | ❌ later | Property, Maintenance, Tax |

**Card preview pages** like `/_card_previews.html` (medical) are the
reference spec. As each module gets cards, it should get its own
`_card_previews_<module>.html` showing the locked design before code
gets written.

---

## 📥 IMPORT/UPLOAD ENTRY POINTS — current state + locked plan

### Where things live TODAY (audited 2026-05-08)

| Module | Path | Status | Lives on |
|---|---|---|---|
| Finance (banking + brokerage) | `/finance.html` Import tab → POST `/api/v1/import/preview` then `/import/confirm` or `/finance/transactions/import-file` | ✅ wired | Module page |
| EOB | `/medical.html` upload + watcher folder `_inbox/eob/` | ✅ wired | Module page + watcher |
| HSA receipts | `/hsa.html` inbox modal + watcher folder `_inbox/receipts/` | ✅ wired | Module page + watcher |
| Inventory bulk import | `/settings.html` → POST `/api/v1/import` | ⚠️ wrong location | Settings (should be module) |
| Whole-DB backup/restore | `/settings.html` → `/api/v1/data/import` and `/data/export` | ✅ correct location | Settings (this is right) |
| Watcher rules editor | `/settings.html#watcher` | ✅ correct location | Settings (this is right) |

### Locked rule (Al, 2026-05-08)

**File imports for module data live on the module page.**
Settings is for app-wide things only:
- Whole-DB backup/restore
- Watcher folder rules
- Categorization rules editor (future, IN FLIGHT #4)
- Parser preferences (future)
- Account onboarding wizard (future)

### Inventory bulk import — needs to move

The inventory bulk import currently lives in Settings. It should
move to `/inventory.html` (the module page), with Settings keeping
nothing more than a link to it. **Logged as IN FLIGHT #6 — work
later.** Don't change today.

---

## 🩺 EOB PARSING — handoff for the next session

> Locking this in here so the next chat doesn't re-derive it.
> Al uploaded sample EOBs 2026-05-08; analysis below reflects what
> those PDFs actually contain.

### Carrier scope — LOCKED (Al, 2026-05-08)

**One carrier only: Aetna MHBP** (Mail Handlers Benefit Plan).
This is the federal insurance plan administered by Aetna; what the
existing parser calls "MHBP" is the same thing as "Aetna MHBP."
**No other carriers are planned.** Don't suggest BCBS, Cigna, UHC,
or Kaiser support — that's out of scope.

### What exists today

- **`features/medical/eob-parser.js`** — parser for Aetna MHBP PDFs.
  Returns array of statements with claims and services nested.
- **`app_config.eob_parser`** — config row defaulting to `'mhbp'`.
- **`/eob/preview` and `/eob/import` endpoints** — call
  `getEobParser()` then dispatch to the named parser. Any other
  value throws "not implemented" — by design.
- **Watcher** — calls same `parseEobPdf` for files dropped in
  `_inbox/eob/`.
- **Per-claim `family_member_id`** — populated by `resolvePatient()`
  during import. Names that don't match a family member exactly
  get flagged into `med_pending_review`.

### EOB PARSER FIELD CONTRACT — LOCKED (Al + analysis, 2026-05-08)

These rules are non-negotiable for the next parser-touching drop:

1. **A single PDF can contain multiple EOB statements.** Confirmed
   by Al's sample folder: one file had 2 statements glued together.
   Split on each `Statement date:` + `Group #:` reappearance. Each
   becomes one row in `med_eob_statements`.
2. **Dedup key for statement** = file_hash (silent skip identical
   files) + `(group_number, statement_date)` as natural key.
   **Group_number must be part of the key** because Al has two
   plans on the same member ID; two different statements can share
   a date.
3. **Patient name format** is `"Name (relation)"`. Known relations
   in Al's data: `(self)`, `(spouse)`, `(son)`. resolvePatient maps
   to family_member_id. Anything else → flag for review.
4. **Pending/not-payable amounts may have a `(N)` remark suffix**
   like `47.91(3)`. Strip `\(\d+\)$` before parsing the number.
5. **Header text varies** between "Pending or not payable" and
   "Not payable by plan". Match either.
6. **Capture `Sent to` + `Send date`** per claim row when plan
   paid the provider directly.
7. **Capture both Individual AND Family balance blocks** — they
   feed different cards (per-person OOP-max progress vs family
   deductible progress).
8. **Capture the balance-block date range** (e.g. `1/1/26 to
   12/31/26`). Used to associate balances with the correct plan
   period (see plan period rule below).
9. **Sub-cent service rows are kept**, not filtered. They carry
   CPT codes (`3079F`, `1036F`) that link to visit context.

### EOB CAPTURE-EVERYTHING RULE — LOCKED (Al, 2026-05-08)

**Capture every field on the PDF, even if no card displays it
today.** Storage is cheap; re-parsing is expensive; future reports
can't use data that was thrown away.

Concretely:
- Beyond the obvious fields (statement date, claim, service,
  amounts), also capture: "Amount you saved" / discount delta,
  "Track your health care costs" tile breakdown, "Amount remaining"
  per claim row, HealthFund balance (when present), appeals
  address, plan-name strings ("Aetna HealthFund® Aetna Choice®
  POS II"), any "Did you know?" health tip text.
- **Add a `raw_pdf_text` TEXT column to `med_eob_statements`** that
  stores the full extracted text from the PDF as belt-and-suspenders.
  Even if the structured parser misses a field today, the raw text
  is there to re-extract later. Additive migration. Same pattern
  applies to any future parsed-from-document table (bank statements,
  receipts).

### HEALTH PLAN PERIOD MODEL — LOCKED (Al, 2026-05-08)

**Federal employee plan years do NOT start on January 1.** Al's 2026
plan year began on **January 10 or 11, 2026**, not Jan 1. This is
true for FEHB/MHBP plans broadly (open season, plan effective dates
follow federal calendar). The system MUST track plan periods by
their actual effective dates, not by calendar year, or every
year-over-year report will be slightly wrong.

**Schema addition** (additive migration, no FK CASCADE per arch
rules):

```sql
CREATE TABLE health_plans (
  id                          INTEGER PRIMARY KEY,
  group_number                TEXT NOT NULL,    -- e.g. '0285642-10-003'
  plan_name                   TEXT,             -- 'MHBP HDHP' / 'MHBP Non-HDHP'
  is_hdhp                     INTEGER NOT NULL DEFAULT 0,
  effective_start             DATE NOT NULL,    -- e.g. 2026-01-11
  effective_end               DATE,             -- NULL = current
  annual_deductible_individual REAL,
  annual_deductible_family    REAL,
  oop_max_individual          REAL,
  oop_max_family              REAL,
  healthfund_amount           REAL DEFAULT 0,   -- $300 in 2025, $0 in 2026
  notes                       TEXT,
  created_at                  DATETIME DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE med_eob_statements ADD COLUMN health_plan_id INTEGER;
-- No FK constraint — manual maintenance per arch rule
```

Behavior:
- On EOB import, parser reads group_number from the PDF
- If a `health_plans` row exists with that group_number AND
  the statement_date falls within `effective_start..effective_end`,
  auto-link via `health_plan_id`
- If no matching row, queue into `med_pending_review` with category
  `unknown_plan` — Al confirms "this group_number belongs to plan
  X starting on date Y, ending Z, HDHP=true/false"
- Once Al confirms, all past + future statements with that
  group_number auto-link

Confirmed plan periods from Al's sample EOBs:
- `0285629-10-004` — 2025 plan year, non-HDHP, $700 family
  deductible, $300 HealthFund
- `0285642-10-003` — 2026 plan year (started ~Jan 10–11, 2026),
  HDHP, $4,000 family deductible, no HealthFund

**HSA / LP-FSA eligibility downstream:** the HSA module reads
`is_hdhp` to determine whether expenses in a given period are
eligible for HSA contribution/reimbursement. Non-HDHP-period
expenses are NOT HSA-eligible per IRS. (See "LP-FSA TRACKING"
below for the current-year picture.)

### LP-FSA + HSA COMBINED TRACKING (2026) — LOCKED

For 2026, Al has BOTH:
- **HSA** (because of HDHP plan)
- **Limited-Purpose FSA** (LP-FSA) — vision and dental ONLY

LP-FSA design was locked in chat-16 ("v140 design") as a two-pot
module: HSA + LP-FSA share the same `hsa_payments` table with a
`pot` discriminator (`'hsa'` or `'lpfsa'`). Use-it-or-lose-it
deadline tracked per LP-FSA plan year.

Implementation status (per prior STATE.md): "tables done, UI deferred"
— verify in `db/migrations/118_hsa_inbox_lp_fsa.sql` and
`features/hsa/routes.js` before promising the next chat anything
specific.

**Eligibility rules applied at receipt-save time:**
- HSA: any qualified medical expense in an HDHP-eligible period
- LP-FSA: dental + vision only, in the LP-FSA plan period
- A receipt for general medical (not dental/vision) routes to HSA
- A receipt for dental or vision in 2026 → user picks pot at save
  time (LP-FSA preferred, since it's use-it-or-lose-it)

### VISION + DENTAL INSURANCE EOBS — handoff TO-DO

**Al confirmed 2026-05-08:** he has separate vision and dental
insurance, with their own EOBs. Volume is low enough that **manual
entry is acceptable** instead of automated parsing.

**Action for the next session that touches medical:** ASK AL to
upload a sample vision EOB and a sample dental EOB. Once seen,
define:
- Whether they fit existing `med_eob_statements` schema or need a
  separate table (probably fit, with an `eob_type` discriminator
  column: `'medical' | 'vision' | 'dental'`)
- A manual-entry form on `medical.html` so Al can type these in
  without a parser
- Card design in `_card_previews.html` if different from medical EOBs

If schema turns out to be the same, just add `eob_type` column
defaulting to `'medical'` and add a Vision/Dental option to the
manual-entry drawer. **Do NOT build a vision/dental parser** —
volume doesn't justify it.

### EOB DELETE + ATTACHMENT LIFECYCLE — LOCKED (Al, 2026-05-08)

When user deletes an EOB:
1. `DELETE /api/v1/medical/eob/:id` removes the statement + claims +
   services rows (already wired today)
2. Attached PDF file moves to `/share/Backups/MyAppAttachments/_orphans/`
   with hash-prefix filename + audit-log entry. Never auto-purged.
   *(This is the v140 "EOB folder-drop persistence" gap — needs
   verification of `attach-lifecycle.js` integration.)*
3. **Permanent delete** (file gone from disk too, for HIPAA / privacy)
   = separate "Empty Orphans" action in Settings, manual only.
   Logged in audit log with timestamp + filename hash.

Until permanent delete is invoked, orphaned PDFs sit on the NAS but
are invisible in the app. This is the locked design — protects
against accidental "I shouldn't have deleted that" while keeping
real delete possible.

### Real gaps Al still needs to know about (in plain English)

1. **EOB → HSA receipt matching** is *designed* (chat-7), not
   *built*. When a new HSA receipt is saved, look for matching
   claims (same patient + service date + amount) and link them.
   When a new EOB is imported, do the reverse. Status of actual
   code: **uncertain — needs verification.**

2. **Amount mismatch UX missing.** When EOB says "you owe $142.18"
   but receipt has $145, neither one is "wrong." The two should
   show side-by-side with the delta highlighted, user picks which
   to trust. Designed, not built.

3. **EOB-arrives-before-receipt** case has a "retry hook" design —
   on every new receipt save, check for pending EOB matches —
   uncertain if wired.

4. **No EOB cards on the medical "All" tab cross-domain link.**
   Today EOB cards show on their own tab and on All, but they
   don't visually link to which medication or visit they covered.

5. **EOB folder-drop persistence.** Watcher's `importEob` counts
   imports but supposedly "doesn't save." Status uncertain — past
   STATE.md flagged this as a v140 loose end. Verify before
   promising.

6. **Field extraction completeness for cards.** The cross-card
   "All" tab and the EOB drill-down modal need every field that
   shows up on `_card_previews.html`'s EOB cards. Plan: parse Al's
   real EOBs, list which fields are missing or wrong, fix one by
   one.

### Plan when next session opens to do parser work

1. Verify the existing parser actually splits multi-statement PDFs.
   If not, fix that FIRST — half of Al's data is at risk.
2. Apply the FIELD CONTRACT (rules 1–9 above).
3. Implement `health_plans` table + migration. Backfill the two
   known plan rows with Al's confirmed dates.
4. Add `raw_pdf_text` column to `med_eob_statements`. Backfill
   from existing PDFs if Al wants (re-parse pass).
5. Wire EOB delete → orphans-folder move via attach-lifecycle.
6. Ask Al for vision + dental sample EOBs. Add `eob_type` column
   and manual-entry path.
7. Then circle back to the gaps in section above (HSA matching,
   amount mismatch, retry hook, cross-domain links).

This is multi-session work. Don't rush it.

---

## 🚦 DEPLOY WORKFLOW

### The deploy script (`ghrava_deploy.ps1`)

Al has a PowerShell script at `~/scripts/ghrava_deploy.ps1` (or wherever
he keeps it) that handles the Windows-side of every deploy. **You don't
need to write or modify this script — it's locked.** Just produce the
zip, present it, and Al runs the script.

**What the script does:**

1. **Finds the zip.** Default: scans `~\Downloads` for the most-recent
   `Ghrava_DEPLOY.zip`. Override via `-ZipPath C:\path\to\zip` if needed.
2. **Verifies NAS reachable** at `Z:\ghrava` (Z: must be mapped to
   `\\soninas\Docker\home-core\ghrava` or wherever Al has it).
3. **Snapshots `package.json` MD5 hash** before extract — used later to
   detect if a docker rebuild is needed.
4. **Extracts to a temp dir** (`%TEMP%\ghrava_deploy_<timestamp>`).
5. **Robocopies extracted files to `Z:\ghrava` with `/E`** — this is
   recursive and ADDITIVE. **Robocopy never deletes files that aren't in
   the source.** This is critical: if a file you want gone (like the
   old `medical_v2.html`) isn't in your zip, it stays on the NAS forever
   until manually removed.
6. **Deletes the zip** from Downloads after successful copy.
7. **Reads `app/version.txt`** and prints the deployed version.
8. **Compares package.json hash** before vs after. If changed, prompts
   for `docker compose up --build -d`. Otherwise, prompts for plain
   `docker restart ghrava`.
9. **Optionally runs `ghrava_git_push.ps1`** if it exists alongside (Al
   has this commented out for prompt; it currently auto-pushes).
10. **Logs to `Z:\ghrava\logs\deploy_<timestamp>.log`**.

**What this means for the zip you produce:**

- Filename MUST be exactly `Ghrava_DEPLOY.zip` — the script's auto-find
  matches this name.
- Zip root MUST contain the file tree as it should appear at `Z:\ghrava\`
  (so `app/version.txt` is at `Z:\ghrava\app\version.txt` after extract).
- Top-level files like `STATE.md` at the zip root land at `Z:\ghrava\STATE.md`.
- Only include files that NEED to change. Don't bundle the whole `app/`
  directory — it's slow and noisy.
- For deletions: robocopy can't help. Either:
  (a) Tell Al to manually `Remove-Item Z:\ghrava\path\to\file` after
      deploy, or
  (b) Add a one-liner cleanup section to the next ps1 update (don't do
      this without asking).

### Standard deploy mantras

- Zip name: **always `Ghrava_DEPLOY.zip`**, no version suffix
- Always present via `present_files` in chat
- `docker restart ghrava` for code-only changes (~2s)
- `docker compose up --build -d` only when `package.json` changes (~90s)
- **NEVER package after a single fix.** Bundle multiple per drop. (Al
  has corrected this twice.)
- After Al deploys, wait for him to test. Don't proactively build the
  next drop.

### When you'd want to update the ps1 script itself

- Adding a manual cleanup step (e.g. delete obsolete files post-extract)
- Adding a pre-deploy DB backup (Al asked for this informally)
- Adding a healthcheck after `docker restart` to verify the server came
  back up
- None of these are queued today — flag and ask before changing the
  script.

### NAS cleanup outstanding (manual one-time tasks)

robocopy `/E` does not delete files. These are still on the NAS until
removed by hand:

```powershell
# v.148 left this orphan; nothing references it anymore
Remove-Item Z:\ghrava\app\public\medical_v2.html -ErrorAction SilentlyContinue
```

If new orphans show up in future deploys, list them here.

---

## 📝 SMALL THINGS NOT YET FIXED

- "↻ Dose updated" pill cosmetically untested
- `last_fill_quantity` shows `—` for old fills with no quantity
- EOB pre-import preview path unchanged (only post-import detail
  modal got the v.148 treatment)
- Scope wiring only on medical page (apply to other modules in the
  next pass)
- Visit form chip picker shows ALL conditions if no patient is yet
  set in the widget when the drawer opens — once patient is picked,
  conditions don't auto-narrow until drawer is reopened. (Could be
  improved by listening for family-wrap changes and re-rendering;
  not done in this drop to keep scope tight.)

---

## 🛠 FILE MAP

### What's in the v.150 deploy zip (current)

Only the files actually changed in this drop. Per Al's standing rule:
"only necessary files to avoid redundant files."

```
Ghrava_DEPLOY.zip (4 files)
├── STATE.md                            this file
├── TOUCHED.md                          v.150 manifest
└── app/
    ├── version.txt                     "202604.150"
    └── public/
        └── finance.html                .150 — Overview tile-grid landing,
                                          Vellum theme, gotoFinTab helper,
                                          FAB + year-pill hidden initially
```

### What was in the v.149 deploy zip (historical)

```
Ghrava_DEPLOY.zip (~110 KB, 9 files)
├── STATE.md                            this file
├── TOUCHED.md                          per-drop manifest of v.149 changes
└── app/
    ├── version.txt                     "202604.149"
    ├── db/migrations/
    │   └── 125_med_visit_conditions.js NEW — visit↔condition junction table
    ├── features/medical/
    │   └── routes.js                   .149 — joins, attachment_count,
    │                                     linked_condition_ids, EOB rollup
    ├── shared/autoTodos.js             .148 (carried over)
    └── public/
        ├── medical.html                .149 — All landing, swipe, SE fix,
        │                                  linked-conditions chip picker
        ├── _card_previews.html         .148 — back-link href fixed
        └── js/lens-config.js           .148 (carried over)
```

### NOT in v.150 zip but related

These files exist on Al's live NAS, are referenced by changed files,
but were not modified in v.150:

- `app/features/finance/routes.js` — finance routes; will be touched in
  round 3 (aggregator endpoint)
- `app/features/import/parsers.js` — 13-bank parser; relevant for the
  finance dedup tightening drops (IN FLIGHT #1–3) but untouched here
- `app/features/import/routes.js` — `/import/preview`, `/import/confirm`

- `app/features/todos/routes.js` — calls `syncAutoTodos()` on each GET
- `app/features/medical/eob-parser.js` — Aetna MHBP parser; will be
  touched in next-drop EOB work
- `app/features/medical/dedup.js` — record-level natural-key hashes;
  will be referenced when finance dedup work begins
- `app/public/nav.js` — owns family scope picker + page header
  (changes propagate via `gh-scope-changed` event, no direct edit needed)
- `app/public/shared.css` — global CSS tokens (`--bg-card`, `--accent`,
  etc.); page-level CSS overrides go in the page's `<style>` block
- `app/public/js/lt-core.js` — `GH_VIEW`, `GH_SELECT`, `GH_FAMILY`,
  `GH_AVATAR` (the SE/Self bug source — initials computed from name
  string here)
- `app/public/js/lt-refs.js` — `GH_REFS` cross-module lookup widget
- `app/shared/folder-watcher.js` — watcher dispatch (eob, attach,
  statement actions); finance-watcher work touches this
- `app/features/import/parsers.js` — 11-bank finance parser (NOT
  touched in v.149 but is the heart of the next finance drop)
- `app/features/import/routes.js` — `/import/preview`, `/import/confirm`,
  etc.

### Where things live on Al's filesystem

```
NAS (QNAP, mounted as Z: on Windows):
  /share/Docker/home-core/ghrava/        Docker compose root
    ├── docker-compose.yml               (provided to me earlier)
    ├── .env                             environment vars (NEVER in zip)
    ├── data/                            SQLite database lives here
    │   └── lifetracker.db
    ├── app/                             code root (mounted as /app in container)
    │   ├── version.txt
    │   ├── server.js                    entry point
    │   ├── package.json                 deps — change triggers --build
    │   ├── db/
    │   │   ├── db.js                    DB init + migrations runner
    │   │   └── migrations/              numbered SQL/JS files (additive only)
    │   ├── features/                    one folder per module
    │   ├── shared/                      cross-module helpers
    │   └── public/                      HTML + JS + CSS (served as static)
    └── logs/                            deploy_*.log files

  /share/Backups/MyAppAttachments/       Mounted as /app/attachments
    ├── _inbox/                          Watcher reads here (per LOCKED layout)
    │   ├── eob/                         Aetna MHBP PDFs
    │   ├── receipts/                    HSA/FSA receipts → attach module
    │   ├── chase-checking/              (future: per-account bank CSVs)
    │   └── _failed/                     parse failures park here
    ├── _orphans/                        record deleted, file kept (audit log)
    ├── _rejected/                       user rejected during review
    ├── eob/                             final EOB PDFs after import
    ├── hsa/                             final HSA receipts after import
    ├── medical/                         medical attachments
    └── …                                one folder per module

  /share/Backups/XPS - My Documents/AllDocuments/_SaveForever/MyAppBackups/
                                         Mounted as /app/backups
                                         Manual DB backups land here
```

### Project memory files (live on NAS, not in deploy zip)

These are markdown docs Al maintains for design history. Don't edit
unless asked:

- `Z:\ghrava\HSA_INBOX_DESIGN.md` — v140 LP-FSA + receipt vault design
- `Z:\ghrava\TRANSACTION_LINKING_SPEC.md` — chat-14 cross-module
  link design (`tx_record_links`, `tx_link_rules`)
- `Z:\ghrava\BACKLOG.md` — running backlog (older format; STATE.md
  has superseded most of it)
- `Z:\ghrava\UI_STANDARDS.md` — frontend rules (gh-card, gh-s-* etc.)
- `Z:\ghrava\UPGRADE_NOTES.md` — schema migration notes

---

## 🧪 PENDING TESTS — manual, by Al, at next milestone

> Al tests at milestones, not per-feature. These accumulate until he's
> ready to verify a batch. Each entry: what to do, what should happen,
> and where to look if it's wrong.

### From v.149 (highest priority — never tested yet)

**T1. Medical page lands on All tab.**
- Visit `/medical.html` fresh (close tab, reopen)
- Expected: All tab is highlighted, cards show meds + conditions +
  visits + EOBs interleaved
- If wrong: `currentView` initialization in `medical.html` line ~2194,
  or `_medBoot()` calling `renderCurrentView()` instead of
  `renderMedications()`

**T2. SE/Self bug fixed.**
- Click your name in the patient strip (top of page)
- Open "Add condition" drawer
- Expected: family widget shows your name as a pill, already selected
- Save. Confirm avatar shows your name (not "SE") per locked design
- If wrong: `_currentMemberId()` helper in medical.html, or
  `GH_FAMILY.init()` call in `openCondDrawer()`

**T3. Old "Self" rows still show "SE".**
- This is by design — old DB rows have `patient='Self'` literal string
- Edit the old condition, re-pick yourself in the family widget, save
- Expected: card now shows your real name
- This is a one-time fix per old row, not a bug

**T4. Visit ↔ condition linking.**
- Add a visit dated today
- In "For which conditions?" field, click a condition chip (e.g.
  hypertension)
- Save
- Expected: visit card shows a purple chip with that condition name
- Edit the visit, unclick the chip, save
- Expected: chip disappears

**T5. Mobile swipe-snap on All tab.**
- Open Ghrava on actual phone (not devtools mobile mode)
- Should swipe one card at a time, snap to center
- DevTools mobile mode lies — don't trust it for this

**T6. Auto-todo for upcoming visits.**
- Add a visit dated 7 days out
- Open `/todos.html`
- Expected: see auto-todo "{visit_type} — {provider}" due on that date,
  category Medical
- Move visit's date to yesterday, reload todos
- Expected: todo disappears (auto-resolved)

**T7. Paperclip badges show on cards with attachments.**
- Cards with attachments show a count
- Cards without show no badge

**T8. EOB modal shows real data.**
- Click any EOB card
- Confirm modal lists patient names, claims, services, balances
- Esc / backdrop / Close all dismiss

### Smoke tests (always run after any deploy)

**S1. Page loads.** `/medical.html` renders without console errors.
**S2. CRUD works.** Add a med, edit it, delete it. Same for condition,
visit. No 500s.
**S3. Family scope.** Click scope pill in nav header, pick a member,
medical page narrows to that person.
**S4. Settings doesn't crash.** Just visit `/settings.html` and click
through tabs. (Past chats have broken Settings via auth changes — be
careful.)
**S5. Existing data still renders.** Especially conditions and visits
that existed before the v.149 deploy — they should still show, even if
some fields are empty.

### Carryover tests from v.148 (still uncleared)

(none — v.148 was Al-tested per his "finally you did the right thing"
acknowledgement on the merge, but EOB modal was untested as of
deploy)

---

## 🛠 SCRIPT / TOOLING UPDATES — queued, not done

> Things to update in the ps1 or other tooling, paired with the work
> that motivates them. Don't do these standalone; bundle with the
> related code drop.

### Pre-deploy DB backup (P1 — high value, low effort)

Before extracting the zip, ps1 should copy `Z:\ghrava\data\lifetracker.db`
to the backups folder with a timestamp. Al has been informally asking
for this. ~5 lines of PowerShell.

When: bundle with the next migration-touching drop (e.g. when
`125_med_visit_conditions.js` actually runs against live DB, or the
`health_plans` table is added).

### Healthcheck after docker restart (P2 — defensive)

Add an HTTP poll to `http://192.168.4.62:3001/health` (or `/`) after
the docker restart command. If 200 within 30s, OK. If timeout, surface
"server failed to start" error. Today the script tells Al to run
`docker restart` himself and walk away — failure mode is "Al refreshes
page and gets a hung connection."

When: bundle with any drop where the server might fail to start (i.e.
big migration drops or new dependency drops).

### Orphan-file cleanup (P3 — quality of life)

After successful copy, optionally check a known-orphan list in the zip
(e.g. `_DELETE_ON_NAS.txt` listing paths to remove). Run `Remove-Item`
on each. This solves the "robocopy doesn't delete" problem cleanly.

When: only when there are orphans to clean. Not urgent.

### Finance parser fixture tests (P4 — the gate that doesn't exist)

Add a `node tests/parser/run-parser-tests.js` invocation as a 6th predeploy
gate. Reads fixtures from `tests/parser/parser-fixtures/`, runs each
through `parsers.js`, asserts expected JSON output. Catches sign-flip
regressions silently.

When: bundle with the finance dedup tightening drop (IN FLIGHT #1–3).

### Fixture CSV creation (P5 — depends on Al)

Create one fixture CSV per supported bank (Chase, BofA, Navy Fed,
Schwab Checking, Schwab Brokerage, Vanguard, TSP, Capital One,
Discover, Citi, USAA). Each ~5–10 representative rows. Al provides
sanitized samples; you write the expected-output JSON.

When: same drop as P4.

---

## 💬 HOW AL WORKS (extended — read in full)

### Communication

- **Chat first, code second.** Discuss design before writing. Confirm
  approach before building. Don't reach for the keyboard on a vague ask.
- **Short replies preferred.** Tokens are limited. Don't over-explain.
  Don't pad. Don't repeat his question back unless clarifying.
- **One question at a time.** If you have three, pick the one that
  actually unblocks you and ask that one.
- **No emojis in prose** unless he uses them first. Section headers
  with emojis (📥 ✋ 🎯) are fine — they're navigational.
- **Don't apologize repeatedly.** Acknowledge once, fix it, move on.

### Building

- **Don't fix unless asked.** If you see a bug while doing other work,
  document it (TOUCHED.md or STATE.md "small things"), don't silently
  patch.
- **Group changes per drop.** NEVER package after one fix. He has
  corrected this multiple times. Bundle related changes; if you finish
  one thing and there's a follow-up, do the follow-up before zipping.
- **Apply patterns to all relevant modules in the same session.** If
  fixing a SE/Self bug in medical, check whether HSA, finance,
  insurance have the same pattern and fix all at once.
- **"Make it similar to X" = identical layout, not approximation.**
  Copy the working pattern verbatim. Don't reinvent.
- **Don't invent scope.** If asked for "Aetna MHBP only," don't add
  "and BCBS, Cigna, UHC for future" hedges. Past chats hallucinated
  scope this way and Al hated it.

### Quality

- **Run the 5 gates before every zip.** No exceptions:
  1. Node syntax check on every JS file (`node --check`)
  2. Inline `<script>` syntax check on every HTML file changed
  3. Critical IDs preserved (compare against UNION of v1+v2 sources)
  4. Migration sim against live DB shape
  5. No `requireAuth` outside `/settings/*` and `/watcher/*`
- **Tests at milestones, not per-feature.** The ✋ DON'T TRUST list
  in this file is gospel. Don't assume v.149 works until Al confirms.
- **Catches mistakes well — trust the corrections.** When Al pushes
  back, look at the code. Don't argue from cache. Don't defend.

### When you screw up

- **Acknowledge once, fix it, don't grovel.** Repeated apologies waste
  tokens.
- **Show you understood the correction.** Reflect back what was wrong
  in one sentence, then act on it.
- **Don't promise it won't happen again.** Just don't do it again.

### Things that have wasted his time before (avoid)

- Re-asking questions whose answers are in this file or memory
- Packaging after one fix
- "Let me check if X works" without actually checking
- Confidently claiming something is wired when it's a placeholder
- Hallucinating future scope ("we'll also support BCBS...")
- Touching files he didn't ask about
- Defending a mistake instead of looking at the evidence
- Ending a chat with "I'll do this in the next session" when he wanted
  it done now

---

## 🌐 ENVIRONMENT REFERENCE (don't search — answer is here)

### Container / Docker

```yaml
# docker-compose.yml (verified 2026-05-08)
services:
  ghrava:
    build: ./app
    container_name: ghrava
    ports:
      - "3001:3001"            # PORT env var, default 3001
    volumes:
      - ./app:/app             # code mounted live; restart picks up changes
      - /app/node_modules      # node_modules NOT shadowed by mount
      - ./data:/app/data       # SQLite lives here
      - ./.env:/app/.env:ro
      - /share/Backups/MyAppAttachments:/app/attachments
      - /share/Backups/XPS - My Documents/AllDocuments/_SaveForever/MyAppBackups:/app/backups
    networks:
      - home-core-net          # external network shared with Caddy etc.
```

### Database invariants (NEVER violate)

- **`journal_mode = DELETE`** (not WAL). Instant commits, no .db-wal files.
- **`synchronous = FULL`**. Every write fsynced.
- **NEVER `ON DELETE CASCADE`** on any FK. Cleanup is explicit in delete
  handlers — `DELETE FROM child_table WHERE parent_id=?` first, then
  `DELETE FROM parent_table WHERE id=?`.
- **Migrations are additive only.** Never `DROP COLUMN`, never
  `DROP TABLE` for active data. Mark deprecated, ignore in code.
- **`finance_accounts` (banking) ≠ `financial_accounts` (investment).**
  These are two different tables. Never JOIN them. Never refer to one
  when meaning the other.

### Auth invariants

- `requireAuth` middleware exists ONLY in `app/features/settings/routes.js`
  and `app/features/watcher/routes.js`.
- ALL read-only GETs are public. Reads never behind auth.
- The live container runs in **open (no-password) mode**. Adding auth
  enforcement to other routes would lock Al out.
- Browser `<img>` tags can't send auth headers — attachment thumbnail
  routes (`/file/:id`, `/thumb/:id`) MUST stay public.

### Family + members

```
Algir Soni  (self)         — Al, the user
Zarna       (spouse)
Arnav       (son)
```

Stored in `family_members` table with `display_name` matching exactly
("Algir", "Zarna", "Arnav" — no parentheses in display_name; the
"(self)" / "(spouse)" / "(son)" suffix is rendered by UI).

### Insurance plans (federal employee)

| Group # | Period | HDHP? | Family deductible | HealthFund |
|---|---|---|---|---|
| `0285629-10-004` | 2025 plan year | No | $700 | $300 |
| `0285642-10-003` | 2026 (started ~Jan 10–11, 2026) | Yes | $4,000 | $0 |

**Federal plan years do NOT start Jan 1.** Track by `effective_start` /
`effective_end` per plan, not calendar year.

Vision and dental are separate insurance carriers (low volume — manual
entry path). Al will upload sample EOBs when next medical session opens.

### Networking

- Local: `http://192.168.4.62:3001`
- Tailscale: `qnap-nas-36.tail73fb11.ts.net` (works remotely)
- Hosts file (Al's PC): `ghrava.home` → 192.168.4.62
- Caddy reverse proxy on `home-core-net` Docker network (don't touch)
- Google OAuth blocked pending Tailscale HTTPS cert for `.ts.net`
  hostname

### External APIs (free tiers, mostly)

- **Fragella API** — perfume lookup, 20 req/month, results cached
- **Finnhub** — earnings calendar
- **Yahoo Finance** + **Alpha Vantage** — market data fallback chain
- **StockTwits** — proxy for sentiment
- **Reddit public JSON** — for some scraping
- **House STOCK Act S3** — congressional trades

None of these require keys for the current free-tier usage.

### Frontend libraries (loaded via CDN, not npm)

- **Chart.js** — price charts on trade terminal
- **React via Babel CDN** — ONLY on trade terminal, no build step
- **Lucide SVGs** — inline icons (copy-paste from lucide.dev)
- **No bundler.** Vanilla JS everywhere except React on trade terminal.

---

## 🗂 INDEX — what's where in this file

(Use this to jump to a section without scrolling.)

| Section | What it covers |
|---|---|
| 🚨 NEW CHAT? READ THIS BLOCK FIRST | 30-second orientation for fresh context |
| Current version | v.149 summary |
| ✋ DON'T TRUST WITHOUT RETEST | Files touched in v.149, awaiting Al's manual test |
| ✅ SHIPPED THIS DROP | Detailed v.149 changelog with rationale |
| ⏳ IN FLIGHT — NEXT DROPS | Priority-ordered queue (#1–#14) |
| 🎯 LOCKED DESIGN DECISIONS | Cards / Dedup / Architecture / 5 gates |
| 📥 INGEST CONTRACTS | EOB rules + watcher status, wired vs not |
| 🛡️ SMART DEDUP RULES | The 8 domains + 11 edge cases |
| 🎴 CARDS EVERYWHERE | The principle, table of which modules get what |
| 📥 IMPORT/UPLOAD ENTRY POINTS | Where every import lives + locked rule |
| 🩺 EOB PARSING | Field contract, plan period model, vision/dental TODO |
| 🚦 DEPLOY WORKFLOW | Full ps1 documentation |
| 📝 SMALL THINGS NOT YET FIXED | Cosmetic / minor bugs to flag |
| 🛠 FILE MAP | What's in zip, what's on NAS, what's where |
| 🧪 PENDING TESTS | T1–T8 + smoke tests |
| 🛠 SCRIPT / TOOLING UPDATES | P1–P5 ps1 updates queued |
| 💬 HOW AL WORKS | Communication / building / quality / mistakes |
| 🌐 ENVIRONMENT REFERENCE | Docker / DB / auth / family / insurance / networking |
| 🗂 INDEX | This table |
| ▶️ TO RESUME WORK | Step-by-step for the next chat |

---

## ▶️ TO RESUME WORK (next chat checklist)

1. **Read this STATE.md end-to-end.** Yes, all of it. Al has paid for
   this context once already.
2. **Check `app/version.txt`** for current version (should be
   202604.150 unless Al has deployed since).
3. **Verify the ✋ DON'T TRUST WITHOUT RETEST list.** Ask Al what he
   tested and what he didn't. Update the list as he confirms each item.
4. **Ask Al "ready?" — let him pick from IN FLIGHT.** Don't assume #1
   is the next thing. He may want to test more first, or have a new
   pain point that jumped the queue.
5. **Discuss design BEFORE writing code.** Confirm scope. Confirm what
   touches what. Confirm "we are not in scope creep."
6. **Stage in `/home/claude/drop/`** if you need a working directory.
   Recreate from Al's share zip if he provides one.
7. **Run the 5 predeploy gates.** No exceptions.
8. **`present_files` final zip as `Ghrava_DEPLOY.zip`.**
9. **Update STATE.md and TOUCHED.md** to reflect what shipped, what's
   still suspect, what's now resolved. **Don't make Al ask.** He's
   tired of asking.

End of state.
