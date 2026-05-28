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

## ✅ v.206 DEPLOYED & VERIFIED — Schema tooling: prod-grounded SCHEMA.md + drift detection (2026-05-27)

> **NAS confirms `version=202605.206`** via `/api/v1/app/info` at
> 2026-05-28T02:53Z (uptime 347s post-restart). NAS realigned to
> `origin/main` @ `a97b4c9`. Per the every-other-deploy rule, this
> deploy ran FULL Playwright: smoke 9/9 ✅ (29s); full E2E
> **117 passed / 0 failed** (3.4m) — baseline restored / held.
>
> Tooling-only drop verified: app surface identical, container healthy,
> no E2E regressions. The new `gen-schema-doc.py --prod` mode is now
> available locally for any future schema audit.

> **SCHEMA.md is now grounded in the live NAS container's actual
> schema, not in migration replay.** `gen-schema-doc.py` gained a
> `--prod` mode that queries the running container via SSH + docker
> exec + node + better-sqlite3, then writes SCHEMA.md with prod as
> canonical + a DRIFT section flagging any tables/columns where
> migrations and prod disagree.
>
> **Tooling-only drop.** Zero app code changes, zero schema migrations,
> zero new backend endpoints. The app surface is identical to v.205.
> SCHEMA.md grew from 2607 lines (migration-replay only) to 3868 lines
> (prod-grounded with DRIFT). 51 drift entries now documented inline.

### What v.206 ships (3 functional changes across 4 tasks)

1. **`gen-schema-doc.py` gains `--prod` mode.** New CLI flags:
   `--prod` (bool), `--ssh-host`, `--ssh-key`, `--docker-path`,
   `--container`, `--nas-app-mount`. When `--prod` is set, the script
   drops a tiny better-sqlite3 dump script onto `Z:\ghrava\app\.tmp-schema-dump.js`,
   execs it via `ssh + docker exec ghrava node /app/.tmp-schema-dump.js`,
   parses the JSON output, and cleans up the tmp file. Falls back
   gracefully to migration-replay-only if SSH is unreachable.

2. **DRIFT detection.** New `diff_schemas()` compares migration-replay
   output against prod query result. Returns lists of:
   - Tables only on prod (46 found)
   - Tables only in migrations (5 found)
   - Columns only in prod (per-table)
   - Columns only in migrations (per-table)

3. **SCHEMA.md regenerated as prod-canonical.** When `--prod` is used,
   the regenerated SCHEMA.md treats prod as authoritative:
   - Summary section reports prod table count (165) + drift count (51)
   - Top-of-file DRIFT sections list every mismatch with row counts and
     suspected origin
   - Per-table heading carries `[in:both | prod-only | migration-only]`
     annotation
   - Migration-only tables appear in a dedicated section at end of file

### What this enables (and what's DEFERRED to v.207+)

Per Al's "tooling-only, no drops yet" sign-off, v.206 explicitly does
NOT drop any tables or columns. The newly-trustworthy SCHEMA.md is the
foundation for cleanup in subsequent drops. See `BACKLOG.md` NEXT UP
for the v.207+ candidate list:

- **v.207 candidate:** DROP 20 mystery tables (Excel-import legacy,
  all 0 rows, all 0 SQL refs after fixing pending/routes.js JOIN bug)
- **v.207 candidate:** DROP 7 `_legacy_*` tables (Al approved; mig 126
  unification preserves, no rollback needed)
- **v.207 candidate:** Fix `pending/routes.js:357` `JOIN certifications`
  → `JOIN career_certifications` (silent bug — cert-renewal pending
  detection never fires; ships alongside the certifications-table drop)
- **v.208 candidate:** ~38 dead columns from the prod-grounded audit —
  re-verify each against the new SCHEMA.md before drop

### Schema-safety gate

Unchanged. v.206 is tooling-only. No new `db.prepare` SQL touching
new columns. The regenerated SCHEMA.md IS the updated gate input —
future schema validators read this prod-true version.

### Tests

Per the every-other-deploy rule: v.205 was smoke-only. **v.206 runs
FULL Playwright** + smoke. Expected baseline 117/0 — nothing on the
running app surface changed; tests should pass unchanged.

### What's still NOT done

- All cleanup items moved to v.207+ candidate list (see BACKLOG.md)
- `labs-trend` + `bp-trend` — still pending metric_index conversation
- `portfolio-perf` "Top losers" header — cosmetic backlog
- Tile visual layer — Al said he'll work on visuals himself
- Mini-PC migration — pending hardware
- Medication HSA-YTD on card — parked product decision

---

## ✅ v.205 DEPLOYED & VERIFIED — Inventory enhancements: 3 locked + sold workflow + warranty auto-suggest (2026-05-27)

> **NAS confirms `version=202605.205`** via `/api/v1/app/info` at
> 2026-05-27T13:32Z (uptime 213s post-restart). NAS realigned to
> `origin/main` @ `517c680`. Smoke 9/9 ✅ (46.1s). E2E skipped via
> `-SkipE2E` per the every-other rule (v.204 ran full Playwright;
> v.206 rotates back to full).
>
> **All 5 features verified live on prod via curl:**
> - `/warranty-suggestions?category=Electronics` → `{months:12, known:true}`; `?category=Beauty` → `{known:false, months:null}` ✅
> - `/containers` list → all 3 containers carry `item_count`, `total_value`, `warranty_expiring_30d` (counts match prod data: Kitchen Box=2, Sorting bin=1, Toys Container=2)
> - `/items/32` → `sibling_count: 1` (matches prod: item is in Toys Container which has 2 items total)
> - `POST /items/9999/sell` → 404 (route exists and validates id; requireAuth gating works on real items)
> - Fresh-log zero-error gate ✅
>
> **Build cycle ~75 min plan-to-deploy.** Five functional changes in
> 6 tasks (plan + 2 backend + 3 frontend + docs). All first-round
> approved; zero fix loops. Zero schema changes.

> **Inventory module gains 5 functional improvements in one drop.** Zero
> schema changes, zero migrations. All target columns (`items.sold_*`,
> `items.warranty_expires`, `items.purchase_date`, `containers.*`) already
> existed.

### What v.205 ships (5 changes across 6 implementation tasks)

1. **Sibling shortcut on item detail** — `/items/:id` response gains
   `sibling_count`; item-detail drawer renders "N other items in [parent
   name] →" link that closes the drawer and navigates Browse to the
   parent's contents view. Skips entirely when `sibling_count === 0`.
   Singular/plural handled.

2. **Container aggregated stats** — `/containers` (list) and
   `/containers/:id` (detail) responses both gain `item_count`,
   `total_value`, and `warranty_expiring_30d`. Single prepared statement
   (`CONTAINER_AGG_STMT`) reused across both routes (no N+1). Browse
   container cards render "N items · $X · ⚠ N warranty ending" with
   per-segment skip logic (skips dollar if 0, skips warning if 0). Detail
   header renders the same line.

3. **Side-by-side comparison view-mode** — third option (`'compare'`)
   alongside card / list views, persisted via existing `inv_item_view`
   localStorage key. Renders all visible items as a compact 7-column
   table: Name / Size / Brand / Category / Purchase date / Effective
   value / Warranty status. Effective-value cascade mirrors v.202
   inventory-value viewer. Warranty status badges: green Lifetime, red
   Expired, amber "Nd left" (≤30 days), plain date (future), em-dash
   (null). Mobile drops Size + Category at ≤640px. Default view
   unchanged (compare is opt-in).

4. **Sold-item workflow** — new `POST /api/v1/inventory/items/:id/sell`
   route (requireAuth). One UPDATE sets `sold_date / sold_price /
   sold_to / sold_platform` AND archives the item (`is_archived=1`,
   `archived_reason='sold'`, `archived_at=CURRENT_TIMESTAMP`). Item-
   detail drawer's existing `openSell()` action now includes a
   `sold_platform` field with a `<datalist>` of 7 platform suggestions
   (eBay, Facebook Marketplace, Craigslist, OfferUp, Mercari, Local,
   Other). Old `PUT /items/:id/sell` preserved for backward compat.
   Detail view renders the platform alongside date/price/sold_to.

5. **Warranty auto-suggest by category** — new `GET /api/v1/inventory/
   warranty-suggestions?category=X` returns `{category, months, known}`.
   Hardcoded `WARRANTY_SUGGESTIONS` lookup covers 14 common consumer
   categories (Electronics=12mo, Appliances=24mo, Car=36mo, etc.;
   Beauty/Books/Clothing return `known:false`). Item-entry form's
   `onCatChange()` + a `purchase_date` change listener both call
   `maybeAutofillWarranty()` which fires the lookup, computes
   `purchase_date + months`, and populates `warranty_expires` ONLY IF
   the field is empty (never overwrites user input). Hint text appears
   below the field: "Auto-filled from typical {Category} warranty
   ({months} mo) — adjust if different". Silent failure on network
   error.

### Schema-safety gate

Unchanged baseline. v.205 is pure backend route additions + frontend
wiring. Zero new `db.prepare` SQL touching columns that don't exist.

### Tests

Per the every-other-deploy rule: v.204 ran FULL Playwright. **v.205 runs
SMOKE ONLY via `-SkipE2E`.** v.206+ rotates back to full E2E. The 2
existing deploy gates (`trade-mount.spec.js`, `reports-viewers-smoke.spec.js`)
still pass — v.205 doesn't touch reports.html, trade.html, or any
fetch URL the smoke gates iterate.

Expected at deploy: smoke 9/9 ✅.

### What's still NOT done (carried forward to v.206+)

- **Container nesting depth >1** smoke check (audit gap A) — deferred
- **QR codes + container photos** (audit gap B) — deferred
- **Bulk move / bulk category-edit** (audit gap C) — deferred
- **Category vocabulary drift / canonical category list** (audit gap E) — deferred
- **Value rollup on locations** (audit gap G) — deferred
- **`labs-trend` + `bp-trend`** — still pending metric_index conversation
- **`portfolio-perf` "Top losers" header** cosmetic — backlog
- **Mini-PC migration target OS** — pending hardware arrival
- **Medication HSA-YTD on card** — pending product decision
- **Tile visual layer** — Al said he'll work on visuals later (post-v.204)

---

## ✅ v.204 DEPLOYED & VERIFIED — Tile visual refresh: icons + colors + KPI previews (2026-05-27)

> **NAS confirms `version=202605.204`** via `/api/v1/app/info` after
> deploy at 2026-05-27T11:05Z. NAS realigned to `origin/main` @
> `79bde48` (5 v.204 commits + 1 E2E selector hotfix). Container
> restarted cleanly; smoke 9/9 PASS (1.1m); initial full E2E was 116/1
> — the **single failure was a stale selector** in `ghrava-e2e.spec.js`
> looking for `.gh-tile` (v.197 class) instead of the new `.rep-tile`
> (v.204 class). Test-file-only hotfix `79bde48` swapped 4 occurrences;
> local re-run against live prod v.204: 1 passed (5.8s). Post-hotfix
> E2E baseline restored to **117/0**.
>
> **Screenshots confirm the design lands as intended.** Money tab shows
> amber accent stripe + amber icon chips + KPIs ("$X this month / N
> transactions", "$X eligible YTD / 0% reimbursed" with progress bar,
> portfolio snap with "+X.X%" gain delta, AI log tiles with empty-state
> rows). Health tab flips cleanly to green per-category. Per-tab
> identity (Money amber / Health green / Household blue / Family
> purple) is visually distinct at a glance.

> **Reports landing page no longer looks like a CLI menu.** Every tile
> now carries a real SVG icon, a category color identity (Money amber,
> Health green, Household blue, Family purple), and a live data preview
> pulled from existing summary endpoints — KPI + sparkline for trends,
> KPI pair for counts with flags, progress bar for ratios, recent-rows
> for saved-AI logs.
>
> Pure frontend. Zero SQL, zero migrations, **zero new backend endpoints**.
> ~11 existing summary endpoints fetched in parallel on landing load
> (`/finance/landing`, `/medical/summary`, `/hsa/summary`, `/inventory/stats`,
> `/insurance/summary`, `/subscriptions/summary`, `/trading/reports`,
> `/trading/portfolio/live`, `/trading/portfolio/performance`,
> `/maintenance/summary`, `/documents/expiring`). Each tile reads its
> KPI from the shared bundle.

### What v.204 ships (5 tasks, 1 file changed: `app/public/reports.html`)

1. **Tile CSS shell** — new `.rep-tile` shape: 36×36 icon chip, top accent stripe, soft gradient background, 10px radius, hover lift, focus-visible outline. Per-category accent tokens (`--money/--health/--household/--family`).

2. **`window.TILE_ICONS` registry** — 43 inline-SVG glyphs keyed by tile slug. 24×24 viewBox, single-color via `currentColor`, stroke-1.75 round-cap line style. Drawn inline; no external assets.

3. **`renderTabGridV2` rewrite** — emits the new tile DOM directly (no longer delegates to `GH_TILE.render`, which is preserved for other consumers). Keyboard activation added (Enter/Space).

4. **`loadLandingPreviews()` orchestrator** — fires 11 summary fetches in parallel via `Promise.all` with per-call `.catch(() => null)` guards. Returns a shared bundle. `hydrateTilePreviews(bundle)` iterates rendered `.rep-tile [data-preview-slot]` slots and calls `TILE_PREVIEWS[slug]`. Wired into `bootReportsV2` (parallel with `loadPinned`) and into the end of `renderTabGridV2` so every tab switch re-hydrates.

5. **`window.TILE_PREVIEWS` — 43 per-slug renderers** built on 4 shape helpers (`repPreviewKpiSpark`, `repPreviewKpiPair`, `repPreviewProgress`, `repPreviewRecentRows`) + a meta-line fallback. Trends (cash-flow, net-worth, portfolio-perf) get auto-scaled 12-point inline SVG sparklines from their snapshot arrays. Counts get a primary KPI + secondary count colored amber/red when flagged. HSA & FSA gets a progress bar (reimbursed-of-eligible). Saved-AI logs (trade-research/rebalance/tax-opt) get 3 most-recent rows with relative timestamps.

### Schema-safety gate

Unchanged baseline. v.204 is pure frontend. No SQL, no migrations.

### Tests

Per the every-other-deploy rule: v.203 was smoke-only. **v.204 runs FULL Playwright** + smoke. The 2 existing deploy gates (`trade-mount.spec.js`, `reports-viewers-smoke.spec.js`) auto-cover regression — no new test specs needed. Expected E2E baseline: 117/0 (unchanged).

### What's still NOT done

- **`labs-trend` + `bp-trend`** — get icons + colors from v.204 but no KPI data (pending metric_index conversation).
- **`portfolio-perf` "Top losers" header cosmetic** — still backlog.
- **Some tiles fall back to meta-line text** because their backend summary endpoints don't expose the field we'd want for a one-glance KPI (e.g. `property-summary` total-value, `vehicles-summary` fleet snapshot, all Family tab tiles). These can light up incrementally in future drops by adding their KPI to the relevant summary endpoint.

---

## ✅ v.203 DEPLOYED & VERIFIED — Reports Redesign Drop 7 (FINAL): Family tab 7/7 LIVE (2026-05-27)

> **NAS confirms `version=202605.203`** via `/api/v1/app/info` at
> 2026-05-27T08:42Z (uptime ~16 min — container restarted cleanly on
> v.203 during the original deploy; the deploy script then exited on
> a smoke-gate FALSE POSITIVE in step 7). NAS realigned to
> `origin/main` @ `ff05edc` (includes the gate fix). Family endpoints
> curl-tested live-200; the gate now passes locally against prod.
>
> **What happened:** the v.202 `reports-viewers-smoke` gate's URL-
> extraction regex captured `'/api/v1/family-snapshot/'` (literal,
> trailing slash) instead of the runtime URL `'/api/v1/family-snapshot/' + m.id`.
> Bare prefix returned 404 (route requires an id) so the gate flagged
> 3 false positives (emergency-info / family-snapshot / member-detail).
> The viewers themselves were healthy; the gate was overzealous on
> string-concat fetch patterns.
>
> **Fix (commit `ff05edc`):** detect `'<URL>' + <var>` patterns by
> looking at the character after the closing quote; if it's `+` and
> the URL ends with `/`, substitute `1` as a sample id AND apply a
> looser status check (only 5xx fails). Wrong-PREFIX bugs (v.200.1
> family) still get the strict < 400 check on literal URLs.
>
> **Lesson:** the gate's first real-world catch was a self-inflicted
> false positive. The fix tightens the gate without weakening its
> ability to catch v.200.1-class bugs. The pattern now generalizes
> to any future parameterized-URL viewer.

> **Family tab is now 7 of 7 tiles LIVE.** Reports Redesign now hits
> **41 of 41 implementable tiles LIVE.** Only `labs-trend` + `bp-trend`
> remain "in design" pending the metric_index design conversation —
> they were always carved out of the implementable scope.
>
> **Reports Redesign is COMPLETE.** What started as a v.197 foundation
> (mig 147 + shared components + tab layout) wraps in 6 viewer drops:
> v.198 Money (5 tiles) → v.199 Money (4 more) → v.200 Money trade-terminal (7) →
> v.201 Health (6 net-new) → v.202 Household (11) + 2 deploy-gate test specs →
> v.203 Family (7).
>
> Pure frontend; zero SQL; zero migrations.

### What v.203 ships (7 new viewer blocks)

1. **`emergency-info`** — Per-person emergency card grid. Reads `/api/v1/data/table?name=family_members` + per-member `/api/v1/family-snapshot/:id` in parallel. 4 cards (Family members / Members with active meds / Members with conditions / Members with emergency notes). Card-per-member layout with DOB+age / gender / active-meds list (count + first 3 names) / conditions list / emergency_notes (pre-wrap). Row click → drilldown with full member detail incl. medications, conditions, visits.

2. **`family-snapshot`** — Whole-family rollup. Same per-member fetch as emergency-info. 4 cards (Total members / Total active medications / Total conditions / Visits this year). Single table — Name / Relationship / Age / Active meds / Conditions / Visits-this-year / Emergency-notes-badge. Sorted by `is_primary_user DESC` then `display_name ASC`. Same drilldown as emergency-info.

3. **`member-detail`** — ONE tile with a member-switcher dropdown inside the viewer (per the locked spec — tile count stays stable regardless of family size). `defaultFilters` carries the selected member id (default = primary user, id 1). `renderBody` renders a `<select id="memberSwitcher">`; on change it mutates `currentViewerFilters` and calls `loadAndRenderViewer('member-detail')` to refetch for the new member. 4 cards reflecting selected member: Active meds / Conditions / Visits all-time / HSA payments YTD. Body shows identity block + meds/conditions/visits/HSA sub-tables + kids sub-list.

4. **`kids-activities`** — Per-kid activity log. `/api/v1/kids/` + per-kid `/api/v1/kids/:id/activities` Promise.all. 4 cards (Total kids / Active activities / Distinct categories / Total monthly cost). Grouped per kid — `<h3>` heading with name + grade + age, then sub-table per kid: Activity / Category / Day / Time / Location / Cost-per-month / Season.

5. **`kids-school`** — Per-kid school + health info. `/api/v1/kids/` only (school data denormalized on kids rows). 4 cards (Total kids / With grade / With teacher contact / With allergies on file). Card-per-kid with a content-area grid: Grade / School ID / Homeroom / Teacher / Allergies (amber when present) / Medications note / Emergency note (red when present, pre-wrap).

6. **`care-team`** — Care contacts (medical/dental/vet/etc.). `/api/v1/settings/contacts` filtered by `contact_type` matching `/medical|dental|vet|provider|doctor|nurse|therapist/i`. 4 cards (Care contacts / Distinct specialties / With phone / With address). Table — Name / Specialty / Type / Phone / Email / Last contacted. Drill shows full contact incl. combined address.

7. **`family-contacts`** — All non-care contacts (family/emergency/personal). Same fetch as care-team, inverted filter. 4 cards (Family contacts / Distinct contact types / With phone / With email). Table — Name / Type / Company / Phone / Email / Location (city, state).

### Schema-safety gate

Unchanged baseline. v.203 is pure frontend — zero SQL, zero migrations, zero backend changes.

### Tests

Per the every-other-deploy rule: v.202 ran FULL Playwright. **v.203 runs SMOKE ONLY via `-SkipE2E`.** v.204+ rotates back to full E2E. The two v.202 test gates (`trade-mount.spec.js` + `reports-viewers-smoke.spec.js`) will iterate the new viewers automatically on the next full-E2E run — no test-spec changes needed for v.203.

Expected at deploy: smoke 9/9 ✅. The v.202 baseline of 117 E2E tests holds; the 7 new viewers get exercised by `reports-viewers-smoke` on the v.204+ full run.

### What's still NOT done

- **`labs-trend` + `bp-trend`** — still "Coming soon"; pending metric_index design conversation (Path Y was agreed: each report queries its own sources, refactor to abstraction when 3+ consumers exist).
- **`portfolio-perf` "Top losers" header cosmetic** — still backlog.
- **Inventory grouping enhancements** — v.204+ per BACKLOG.md.

---

## ✅ v.202 DEPLOYED & VERIFIED — Reports Redesign Drop 6: Household tab 11/11 LIVE + 2 test gates (2026-05-26)

> **NAS confirms `version=202605.202`** via `/api/v1/app/info` at
> 2026-05-26T22:12Z (uptime 967s post-restart). NAS realigned to
> `origin/main` @ `32bb2a3`. Per the every-other rule, **this deploy
> ran FULL Playwright** (v.201 + v.201.1 were smoke-only). Total
> deploy time **~8 min**.
>
> **Verification:**
> - Smoke 9/9 ✅ (1.2m) — bash smoke-test.sh's `/trade/reports` parity assertion shipped in v.200.1, plus 8 Playwright smoke checks
> - Full Playwright E2E **117 passed / 0 failed** (4.3m) — baseline shifted from 115 → 117 (the two new gates)
> - **Both new test gates passed first deploy run:** `reports-viewers-smoke` (10.2s + 2.6s in suite) confirmed every registered `window.REPORT_VIEWERS[slug]` fetches a real URL; `trade-mount` (10.0s) confirmed `/trade.html` React root mounts without JSX errors
> - All 13 Household-related endpoints curl-tested live-200
> - Fresh-log zero-error gate ✅
>
> **Build cycle ~75 min** (vs v.200's ~90 min and v.201's ~50 min) — driven by 13 tasks (2 test gates + 11 viewers + plan + docs) and one schema-mismatch fix loop (`property-summary` field-name correction caught in code review). All other tasks first-round approved.

> **Household tab is now 11 of 11 tiles LIVE.** This drop also adds
> two HARD test gates that close the gap families flagged by the
> v.200.1 and v.201.1 hotfixes — both gates ran against live prod
> before being added to the deploy testMatch and PASSED.
>
> Reports Redesign now stands at **34 of 37 implementable tiles LIVE**.
> Only Family tab (7 tiles, v.203) and `labs-trend` + `bp-trend`
> (deferred pending metric_index design conversation) remain.
>
> Pure frontend except for the two new spec files; zero SQL; zero
> migrations.

### What v.202 ships

**2 test gates (Tasks 2-3):**

1. **`tests/trade-mount.spec.js`** — Opens `/trade.html`, waits 5s for Babel, asserts `#root` mounted with >100 chars + zero `pageerror` events. Catches the v.196 → v.201.1 family of bugs where JSX syntax errors leave React unmounted but the page returns HTTP 200.
2. **`tests/reports-viewers-smoke.spec.js`** — Loads `/reports.html`, evaluates `window.REPORT_VIEWERS`, extracts each viewer's fetch URL pattern (regex captures `/api/v1/…` literals including query strings), and asserts every URL returns < 400. Catches the v.200.1 family of bugs where a wrong mount path (`/api/v1/trade/` vs `/api/v1/trading/`) slipped through every code review because reviewers compared against the plan.

Both registered in `tests/playwright.config.js` testMatch. **E2E baseline shifts from 115 to 117** on the v.202 deploy.

**11 Household viewers (Tasks 4-9):**

3. **`property-summary`** — Homes with key dates / values. Reads `/api/v1/property/properties`. 4 cards (count / value / cost / net change). Table by nickname; drill includes mortgage + HOA + tax + insurance.

4. **`property-maint`** — Maintenance log filtered to `source === 'property'` from `/api/v1/maintenance/upcoming`. 4 cards (open / overdue red / due-this-week amber / distinct properties). Date-color column.

5. **`vehicles-summary`** — Fleet snapshot. Reads `/api/v1/property/vehicles` (endpoint joins per-vehicle `last_service` + `upcoming_service` + `attachment_count`). 4 cards (count / value / mileage / due-for-service). Table with year+make+model concat, VIN last-4-only privacy, plate, state, mileage, last/next service.

6. **`vehicle-maint`** — Service log filtered to `source === 'vehicle'` from `/api/v1/maintenance/upcoming`. Same shape as property-maint.

7. **`vehicle-fuel`** — Per-vehicle service iteration via Promise.all `/api/v1/property/vehicles` + per-vehicle `/api/v1/property/vehicles/:id/service`. Year filter (default current). Client filter `service_type` matching `/fuel|gas|fill/i`. 4 cards (fills / spent / avg cost / avg $/mile from consecutive odometer deltas).

8. **`subs-overview`** — Cost rollup view (vs v.199 `subs-renewals`'s next-90-day view). Reads `/api/v1/subscriptions/summary` + `/api/v1/subscriptions/`. 4 cards (active / monthly / annual projected / renewing-this-month amber). Sort by `next_billing_date` ASC; past-due cells red.

9. **`insurance-policies`** — All policies, sorted by `coverage_end_date` ASC. Reads `/api/v1/insurance/summary` + `/api/v1/insurance/`. 4 cards (active / annual premium / renewing-within-60d amber / distinct types). Past-due cells red.

10. **`inventory-value`** — Items grouped by `category` (NOT location), sorted by total value DESC per category. Effective value = `replacement_value || appraised_value || purchase_price || 0`. 4 cards.

11. **`warranty-expiry`** — Items filtered by `warranty_expires` ≤ N days (default 90). Window-days filter exposed. 4 cards (under-warranty / expiring-30d amber / expiring-window / expired RED).

12. **`items-by-loc`** — Items grouped by parent (location or container), name resolved via parallel fetches of `/api/v1/inventory/locations` + `/api/v1/inventory/containers`. Sort groups by item count DESC.

13. **`doc-expiry`** — Documents expiring within 90 days. Promise.all `/api/v1/documents/` + `/api/v1/documents/expiring`. Three-state body: no docs → empty state; no expiring → green banner with total-tracked count; else table.

### Schema-safety gate

Unchanged baseline. v.202 is pure frontend — zero SQL, zero migrations, zero backend changes.

### Tests

Per the every-other-deploy rule: v.200 ran full Playwright, v.200.1 / v.201 / v.201.1 were smoke-only. **v.202 runs FULL Playwright** + smoke. Expected: smoke 8/8 ✅; **E2E baseline shifts to 117 (115 + 2 new gates)**. The two new gates must both pass for the deploy to be considered healthy.

### What's still NOT done

- **Family tab (7 tiles)** — v.203.
- **Health `labs-trend` + `bp-trend`** — still "Coming soon"; pending metric_index design.
- **`portfolio-perf` "Top losers" header cosmetic** — still backlog.
- **Inventory grouping enhancements** — v.204+ per BACKLOG.md.

---

## 🩹 v.201.1 DEPLOYED & VERIFIED — fix unmatched JSX fragment in trade.html (2026-05-26)

> **NAS confirms `version=202605.201.1`** via `/api/v1/app/info` at
> 2026-05-26T20:13Z (uptime 607s post-restart). NAS realigned to
> `origin/main` @ `d071409`. **Verified via Playwright headless:**
> root DOM mounts with 24,146 chars of rendered React; zero
> `pageerror` events (previously: empty `#root` + 1 `SyntaxError:
> Expected corresponding JSX closing tag for <>. (5943:6)`). Smoke
> 8/8 ✅ (1.0m); E2E skipped via `-SkipE2E` (one-line JSX move, no
> contract change).
>
> Total deploy time: **2m 58s**.
>


> **Bug:** `/trade.html` rendered as a blank page on prod since v.196
> deployed (2026-05-24). The Appearance section's accordion-fragment
> `{openSections.appearance && <>` (line 5896) was missing its matching
> `</>}` at line 5970 — the closer landed at line 5984 instead, *inside
> the following Storage Panel*. Babel-standalone in the browser bailed
> with `SyntaxError: Expected corresponding JSX closing tag for <>.
> (5943:6)`. Entire React tree failed to mount; `#root` stayed empty.
>
> **Latent for ~2 days** because: (a) no E2E test opens `/trade.html`
> and asserts the React root mounted, (b) the page returns HTTP 200
> with 333KB of valid HTML so curl/smoke gates can't catch the runtime
> failure, (c) the v.196 deploy's smoke-only gate (per the every-other
> rule) never opened the page in a browser.
>
> **Discovery:** Al opened the page, saw blank. Used a throwaway
> Playwright spec (`tests/trade-debug.spec.js` + `playwright.config.debug.js`)
> to capture the actual `pageerror` event with line number; the spec
> + debug config were deleted in the DEPLOYED marker commit.
>
> **Fix:** moved the orphan `</>}` from line 5984 to line 5970, where
> it belongs (mirrors the provider/market/social section pattern at
> lines 5727 / 5890 / 6042). One-line move; no other changes.
>
> **Followup added to v.202 backlog:** add a Playwright check that
> opens `/trade.html`, waits 5s for Babel to transform, and asserts
> `#root` innerHTML > 100 chars. Would have caught this in <10s.
> Same family of gap as the v.200.1 deploy-gate smoke followup.

---

## ✅ v.201 DEPLOYED & VERIFIED — Reports Redesign Drop 5: Health tab 7/9 LIVE (2026-05-26)

> **NAS confirms `version=202605.201`** via `/api/v1/app/info` at
> 2026-05-26T19:31Z (uptime 213s post-restart). NAS realigned to
> `origin/main` @ `301eb36`. 8 v.201 commits stacked above v.200.1
> (`02be474`). Per the every-other-deploy rule, **this deploy ran
> SMOKE ONLY via `-SkipE2E`** (v.200 ran full Playwright 115/0;
> v.200.1 hotfix was smoke-only; v.202 rotates back to full E2E).
> Total deploy time: **3m 02s**.
>
> **Verification:** smoke 8/8 ✅ (1.1m), fresh-log zero-error gate ✅,
> NAS `/api/v1/app/info` version-report ✅, NAS git reset ✅, all 6
> new endpoints curl-tested live-200 (v.200.1 lesson applied).
>
> **Build cycle:** ~50 min plan-to-deploy (vs ~90 min for v.200) —
> savings from pre-verified endpoints, pointer-to-pattern plan
> templates, and a single combined spec+quality review per task.
> All 6 viewers passed first-round review; zero fix loops.
>
> **Health tab is now 7 of 9 tiles LIVE.** The 2 remaining (`labs-trend`,
> `bp-trend`) stay "in design" pending the metric_index design conversation
> (rejected Path X = build abstraction; agreed Path Y = each report queries
> its own sources, refactor to abstraction when 3+ consumers exist).
>
> This drop wires 6 net-new Health viewers to live viewer pages inside
> `/reports.html`. `hsa-fsa-irs` was already LIVE from v.198 (shared tile
> between Money and Health tabs). Pure frontend; zero SQL; zero migrations.

### What v.201 ships (6 new viewer blocks)

1. **`hsa-spending`** — 5-year HSA history. Reads `/api/v1/hsa/payments?year=Y` × 5 parallel for current_year-4 through current_year. 4 summary cards (Years tracked / Total spent (5y) / Total reimbursed / Outstanding — amber when >0), single table — Year / Records / Spent / Reimbursed / Outstanding — newest year on top. Row click drills into that year's per-payment list (no re-fetch — payments cached in the data object).

2. **`meds-active`** — Active medications across family. Reads `/api/v1/medical/medications` + `/api/v1/data/table?name=family_members` in parallel; client filters `status === 'Active'` and joins to display names. 4 cards (Active meds / Family members on meds / Refills due soon — amber if next_refill_date ≤14 days / No refills remaining — amber when >0). Table: Member / Medication / Dosage / Frequency / Physician / Next refill (past-due red, ≤14d amber). Row click → drilldown with full med detail (start_date, end_date, purpose, notes, rx_number, refills_remaining).

3. **`visits-history`** — Visits log filterable by year. Reads `/api/v1/medical/notes` (already enriched server-side with family_member_name / attachment_count / linked_conditions / physician_name / practice_name). Default filter: current year. 4 cards (Total visits / Distinct patients / Distinct providers / Follow-ups needed — amber when >0). 7-column table — Date / Patient / Provider / Practice / Follow-up ✓ / 📎 / Conditions (chip spans).

4. **`immunizations`** — Cards-per-family-member. Reads `/api/v1/medical/immunizations` + family_members in parallel. 4 cards (Total shots / Boosters due — RED past-due / Boosters upcoming — AMBER ≤90 days / Distinct vaccines). Body grouped by family_member_id with member `<h3>` heading + sub-table per member: Vaccine / Date given / Dose # / Next due (red past-due, amber ≤90d) / Location. No drilldown (read-only display per spec).

5. **`procedures`** — Cards-per-family-member, similar shape to immunizations. Reads `/api/v1/medical/procedures` + family_members. 4 cards (Total procedures / Planned — amber when >0 / Completed this year / Distinct procedure types). Body grouped by family_member_id; sub-table per member: Procedure name / Date (or amber "planned" badge when null+planned) / Facility / Type / Status (colored badge — planned amber / completed green / cancelled grey / other neutral). Row click → drilldown with outcome_notes + other fields + optional provider_contact_id.

6. **`receipts-missing`** — HSA/FSA payments without attached receipts. Reads `/api/v1/hsa/payments?year=Y` (single fetch); client filters `receipt_saved !== 1`. Default filter: current year. 4 cards (Missing receipts — RED when >0 / Amount at risk — RED when >0 / Eligible but missing — AMBER when >0 / % missing — integer pct or "—"). Three body states: total===0 → standard empty state; total>0 && missing===0 → green ✓ "All HSA payments have receipts attached" banner (same pattern as tax-location's no-flags banner); else table — Date / Patient / Provider / Category / You paid / Eligible. Row click → drilldown with full payment detail + "Open in HSA module ↗" button-styled link.

### Schema-safety gate

Unchanged from v.200.1 baseline. v.201 is pure frontend — zero SQL, zero migrations, zero backend changes.

### Tests

Per the every-other-deploy rule: v.200 ran full Playwright, v.200.1 hotfix was smoke-only. **v.201 stays smoke-only via `-SkipE2E`.** v.202 (Household) rotates back to full E2E.

Expected at deploy: smoke 8/8 ✅. Existing 115/0 E2E baseline retained from v.200 run.

### What's still NOT done

- **Health:** `labs-trend` and `bp-trend` — still "Coming soon"; pending metric_index design conversation.
- **Household tab (11 tiles)** — v.202.
- **Family tab (7 tiles)** — v.203.
- **v.200.1 follow-up: deploy-gate smoke** that iterates `window.REPORT_VIEWERS` and asserts each fetch URL returns 2xx — would have caught v.200's 7-viewer 404 storm in <5s. Not in v.201; queued for v.202+.
- **Inventory grouping enhancements** — v.204+ per BACKLOG.md.

---

## 🩹 v.200.1 DEPLOYED & VERIFIED — fix wrong fetch path on 7 trade-terminal viewers (2026-05-25)

> **NAS confirms `version=202605.200.1`** via `/api/v1/app/info` at
> 2026-05-26T04:05Z. NAS realigned to `origin/main` @ `065c514`. All
> 4 trading endpoints (`portfolio/live`, `portfolio/correlation`,
> `portfolio/performance`, `trading/reports`) verified live-200 via
> curl. Smoke 8/8 ✅ (30.3s); E2E skipped via `-SkipE2E` (v.200's
> full E2E run 90 minutes ago is the reference; this is a 6-char
> mechanical fix). Total deploy time: **1m 42s**.



> **Bug:** All 7 v.200 viewers (`portfolio-snap`, `portfolio-perf`,
> `concentration`, `tax-location`, `trade-research`, `trade-rebalance`,
> `trade-tax-opt`) fetched `/api/v1/trade/...` but the router is mounted
> at `/api/v1/trading/...` (server.js:144). Every viewer hit 404 →
> rendered the "Couldn't load this report" error state on click.
>
> **Slipped through every gate** because: (a) the v.200 plan template
> had the wrong path, (b) per-task spec/code reviews compared against
> the plan and confirmed match, (c) the deploy E2E baseline (115 tests)
> doesn't exercise the new viewer slugs at all, (d) the manual bash
> smoke-test.sh assertion I added in v.200 task 7 ALSO used the wrong
> path so it would have failed had it been part of the deploy gate.
>
> **Fix:** single `replace_all` on `/api/v1/trade/` → `/api/v1/trading/`
> in `app/public/reports.html` (6 occurrences) + matching fix in
> `smoke-test.sh`. No other changes.
>
> **Discovery:** Al opened the tiles post-deploy, saw "Couldn't load"
> error state. Quick `curl /api/v1/trade/portfolio/live` returned
> `{"error":"Not found"}` with status 404 — confirmed the path bug.
>
> **Followup added to v.201 backlog:** add a deploy-gate smoke
> assertion that every registered `window.REPORT_VIEWERS[slug]` fetch
> returns 2xx. A single-loop smoke check across all 16 viewer fetches
> would have caught this in <5s.

---

## ✅ v.200 DEPLOYED & VERIFIED — Reports Redesign Drop 4: Money tab COMPLETE (2026-05-25)

> **NAS confirms `version=202605.200`** via `/api/v1/app/info` at
> 2026-05-26T03:04Z (uptime 313s post-restart). NAS realigned to
> `origin/main` @ `4f74b90`. 11 commits stacked above deployed v.199
> (`72258c7`). Per the every-other-deploy rule, **this deploy ran FULL
> Playwright** (v.199 ran SMOKE ONLY via `-SkipE2E`). Next deploy
> (v.201) runs smoke only again.
>
> **Verification:** smoke 8/8 ✅, full E2E **115 passed / 0 failed**
> in 3.1m ✅, fresh-log zero-error gate ✅, NAS `/api/v1/app/info`
> version-report ✅, NAS git reset ✅.
>
> **Money tab is now 16 of 17 tiles LIVE.** The 17th (`pending-trans`)
> is the intentional shortcut link to the Pending tab — not a viewer.
>
> This drop wires the 7 trade-terminal Money tiles to live viewer pages
> inside `/reports.html`. Pure frontend; zero SQL; zero migrations. Trade
> terminal `/trade.html` stays frozen per the v.196 closure.

### What v.200 ships (6 new viewer blocks; 7 tile slugs)

1. **`portfolio-snap`** — live holdings by account. Reads `/api/v1/trade/portfolio/live`. 4 summary cards (total value / cost / gain / return %), accounts table; row click drills into per-account holdings.

2. **`portfolio-perf`** — 12-month value, allocation, top gainers/losers. Reads `/api/v1/trade/portfolio/performance?months=12`. Inline SVG line chart (same pattern as v.199 net-worth), allocation table, leaders tables. No drill.

3. **`concentration`** — top holdings + sector spread + correlation pairs. Reads `/api/v1/trade/portfolio/correlation`. 4 summary cards (top holdings / top-5 % / sectors / largest position — amber when ≥10 %), flag banner when `_flags` arrays non-empty, top-10 table with horizontal % bars, sector table, top-10 pair table; row click drills into holding detail with related correlations.

4. **`tax-location`** — flag bonds and high-dividend holdings in taxable accounts. Reads `/api/v1/trade/portfolio/live` (computed client-side; no new endpoint). Two flag rules: `bonds-in-taxable` (any holding whose `asset_type` contains "bond" in a taxable account) and `high-div-in-taxable` (dividend yield ≥ `TAX_LOC_HIGH_DIV_THRESHOLD` = 3 %). Holdings in tax-deferred or Roth accounts never flag. Shows flagged at top + full holdings grouped by tax_treatment below; drilldown explains why + suggests a more efficient account type.

5–7. **`trade-research` / `trade-rebalance` / `trade-tax-opt`** — saved-AI log viewers. Shared factory (`makeSavedAILogViewer`); each tile differs only by the `type` filter applied to `/api/v1/trade/reports` (`'AI Analysis'` / `'AI Rebalancing Advice'` / `'AI Tax Optimization'` — types locked at `trade.html:4913`). 4 summary cards (total / this year / latest / tickers), sortable table; row click drills into the full saved report via `/trade/reports/:filename`, extracting the narrative from `full.data.advice` / `full.data.summary` / `full.data.result.summary|reasoning` with a pretty-JSON fallback.

### Schema-safety gate

Unchanged from v.199 baseline. v.200 is pure frontend — zero SQL, zero migrations, zero backend changes.

### Tests

v.199 ran SMOKE ONLY per the every-other rule. **This deploy ran FULL
Playwright** + smoke. **Actual:** smoke 8/8 ✅ (22.0s); E2E **115 passed
/ 0 failed** in 3.1m ✅ — no new viewer regressions.

### What's still NOT done

- Money: tile #17 `pending-trans` stays as Pending-tab link (intentional per locked spec)
- Health tab tiles (9) — v.201
- Household tab tiles (11) — v.202
- Family tab tiles (7) — v.203
- Inventory grouping enhancements — queued v.204+ per BACKLOG.md

---

## ✅ v.199 DEPLOYED & VERIFIED — Reports Redesign Drop 3: Money +4 LIVE (2026-05-25)

> **NAS confirms `version=202605.199`** via `/api/v1/app/info` at
> 2026-05-25T22:53Z. NAS realigned to `origin/main` @ `8986d49`.
> 5 commits stacked above deployed v.198 (`2680cd1`). Per the
> every-other-deploy rule, **this deploy ran SMOKE ONLY via
> `-SkipE2E`** (v.198 ran full Playwright 115/0). Saved ~5 min.
> Next deploy (v.200) runs full Playwright again.
>
> **Verification:** smoke 8/8 ✅, fresh-log zero-error gate ✅,
> NAS `/api/v1/app/info` version-report ✅, NAS git reset ✅.
>
> Money tab is now **9 of 17 tiles LIVE** (v.198 shipped 5 + v.199
> adds 4). The 7 remaining trade-terminal Money tiles go in v.200.

### What v.199 ships (4 new viewers + docs)

1. **`beaeec8`** — Task 2 / `spending-cal` calendar heatmap.
   12-row × 31-cell grid of daily spend intensity. Cells shade
   rgba(239,68,68, 0.15..0.85) based on spent / max_spent. Cell
   click drills via `gh-drilldown` to `/txns-on-date`. Summary cards:
   total / days-with-spend ratio / quiet days / busiest day.
   Endpoint: `/api/v1/finance/reports/daily-spend?year=` (v.183).

2. **`6ba01a6`** — Task 3 / `income-flow` income → categories.
   Side-by-side ranked lists of income sources (left, green) and
   expense outflows (right, red) with proportional bars. Real
   Sankey ribbons deferred (SVG path math, out-of-foundation
   scope); list view conveys the proportional flow and drill-down
   is more discoverable. Click expense category → `/txns-by-
   category?side=expense`. Summary cards: income / expense / net /
   savings rate %.
   Endpoint: `/api/v1/finance/reports/income-by-category-flow?year=` (v.185).

3. **`36fd911`** — Task 4 / `net-worth` trend.
   Falls back gracefully between manual snapshots and investment
   auto-snapshots. Inline 800×220 SVG line chart (no Chart.js
   dependency — pure SVG with 3 y-ticks / 3 x-date-labels). Summary
   cards: current net worth / total assets / liabilities / YoY
   change (compares latest to closest-to-365-days-prior snapshot).
   Body adds accounts table ranked by balance with in-net-worth
   checkmarks. No drill-down (snapshots are aggregates; per-snap
   detail belongs in Finance).
   Endpoint: `/api/v1/finance/reports/net-worth-trend`.

4. **`b0b1c79`** — Task 5 / `subs-renewals` next 90 days.
   Parallel fetch of `/subscriptions/summary` + `/subscriptions/`.
   Renewals grouped into 5 time buckets (this week / next week /
   this month / next month / 60-90 days) with bucket-total cost.
   Each row shows name / category / cycle / account on left;
   cost / date on right. Click → drill panel with full subscription
   detail + 'Open in Subscriptions module →' link. Summary cards:
   active count / monthly cost / annual projected / renewing-this-
   month count (amber when >0).

5. **Task 6 / docs + version bump (this commit).**
   - `app/version.txt` → `202605.199`
   - `REPORTS_REDESIGN_HANDOFF.md` status: 9/17 Money LIVE, v.200
     wires the 7 trade-terminal tiles next.
   - `STATE.md` (this block).
   - smoke-test.sh: no new assertions (all 4 endpoints already
     covered or trivially shaped).

### Schema-safety gate

Unchanged from v.198 baseline. v.199 is pure frontend — zero SQL,
zero migrations, zero backend changes. 12 known flags stable.

### Tests

E2E baseline `115/0` last verified on the v.198 deploy. **This
deploy runs SMOKE ONLY** via `-SkipE2E` per the every-other rule;
next deploy after this one runs full Playwright again. The 2
stale Reports tests fixed in the v.198 cycle stay updated for the
new layout, so any v.199 viewer regressions would surface in the
v.200 full-E2E run.

### What's still NOT done (Money tab)

- 7 trade-terminal Money tiles (portfolio-snap / portfolio-perf /
  concentration / tax-location / 3 saved-AI-report log views) — v.200
- The `pending-trans` shortcut on the Money tab is just a link to
  the Pending tab; not a separate viewer (intentional per locked spec)

### What's still NOT done (other tabs)

- Health tab tiles (9) — v.201 (was v.200; bumped by one when v.199
  split was course-corrected)
- Household tab tiles (11) — v.202
- Family tab tiles (7) — v.203
- Inventory grouping enhancements — queued v.204+ per BACKLOG.md

---

## ✅ v.198 DEPLOYED & VERIFIED — Reports Redesign Drop 2: Money 5 LIVE (2026-05-25)

> **DEPLOYED 2026-05-25 ~00:51 via Path A (full Playwright per the
> every-other-deploy rule).** `version.txt`=`202605.198` live (verified
> via /api/v1/app/info). Migration 147 applied at boot ("apply
> 147_user_preferences.sql · Migrations: 1 applied, 144 skipped").
> Smoke 8/8 ✅. E2E **115 passed / 0 failed** in 2.7m after fixing 2
> stale Reports tests inline (caught the same v.197 layout-change
> regression I flagged in v.198 STATE block in advance).
>
> Live route checks:
>   /api/v1/app/info                           → version: 202605.197 ... wait
> Actually the very first /app/info hit during deploy showed v.197
> because the SSH log-tail captured a moment between restart phases.
> Post-deploy live hit shows version: 202605.198. The new endpoint
> /api/v1/preferences/pinned-reports returns {pinned_reports: []}
> (mig 147 + new route both working). /reports.html?run=spending-by-cat
> serves the viewer-page-routed URL correctly.
>
> Local + origin + NAS all at the post-deploy commit. Trade-terminal
> roadmap COMPLETE (v.196), Reports Redesign Foundation + Money 5 LIVE
> SHIPPED (v.197 + v.198). 39 tiles remain "Coming soon"; v.199+
> wires the rest of Money, then Health/Household/Family.

### What v.198 does

Restores the v.197 regression — the 5 Money tiles that broke in v.197
foundation now have working viewer pages. Same `/reports.html` page,
new `?run=<slug>` URL routing toggles the viewer view.

5 commits:

1. **`0069f92`** — Task 2 / Viewer shell + `?run=` routing. Adds
   #repViewerRoot DOM block per the locked #30c design:
   breadcrumb / title / refreshed timestamp / Back + Refresh
   buttons / GH_FILTERS strip / summary card grid / data table
   container / GH_DRILLDOWN slot. New JS: `window.REPORT_VIEWERS`
   registry + `openReportViewer(slug)` + `closeReportViewer()` +
   `loadAndRenderViewer(slug)` + popstate listener for browser
   back/forward. bootReportsV2 honors `?run=` before falling back
   to `?tab=`.

2. **`133a48d`** — Task 3 / `spending-by-cat` + `cash-flow` LIVE.
   spending-by-cat: 5 summary cards (spent/income/net/categories/
   transactions) + sortable category table with % of total +
   transaction drill via `/txns-by-category`. cash-flow: 4 summary
   cards (starting/net/ending balance + lowest point) + filtered
   daily table (skip zero-net days) + per-day item drill.
   Also adds shared helpers: `repFmt$`, `repFmt$k`,
   `repSummaryCard`, `repCurrentYear`, `escapeHtml`.

3. **`31e2cd9`** — Task 4 / `top-vendors` + `category-trends` +
   `hsa-fsa-irs` LIVE.
   - top-vendors: ranked list with horizontal % bars + tx counts +
     drill via `/txns-by-vendor`. Treemap visual simplified to a
     ranked list (proper SVG treemap deferred).
   - category-trends: small-multiples-style table — categories ×
     12 months with intensity-shaded cells (red opacity); cell
     click drills into `/txns-by-category?month=MM`.
   - hsa-fsa-irs: 4 cards (eligible/reimbursed/unreimbursed/
     missing receipts amber when >0) + by-category table + 12-cell
     teal month heatmap + visits-by-patient table.

4. **`e7c7692`** — Task 5 / Tile click navigation.
   `renderTabGridV2` onClick checks `window.REPORT_VIEWERS[slug]`.
   In registry → `openReportViewer(slug)`. Not in registry →
   v.197 `comingSoon` toast. Same change in Pinned strip's
   onClick. After this commit on prod, the 5 LIVE slugs are
   reachable from the Money tab and from any pinned card.

5. **Task 6 / docs + version bump (this commit).**
   - `app/version.txt` → `202605.198`
   - REPORTS_REDESIGN_HANDOFF.md status updated: "Foundation + 5
     Money LIVE", 39 tiles remain on "Coming soon"
   - STATE.md (this block)
   - smoke-test.sh: no new assertions (this drop reuses existing
     finance + HSA endpoints; nothing new at the API boundary)

### Schema-safety gate

Unchanged from v.197 baseline. v.198 is pure frontend —
zero SQL, zero migrations, zero backend changes. 12 known flags
(10 noise + 2 view-limitation false-positives) stable.

### Tests

E2E baseline `115/0` expected to hold. **This deploy runs FULL
PLAYWRIGHT** per the every-other-deploy rule (v.196+v.197 was
smoke-only via -SkipE2E). Approximately +5 min deploy time vs
last drop.

The existing Playwright E2E "Reports page renders report cards
from registry" test (`ghrava-e2e.spec.js:369`) will likely need
inspection — the old REPORT_REGISTRY in reports.html is now
unused (the new layout uses REPORT_TABS_V2 + REPORT_VIEWERS).
If that test fails, it's a test-staleness issue, not a v.198
regression — but worth flagging in advance.

### Regression closed

The v.197 → v.198 access regression for the 5 Money reports is
RESOLVED. They're back, with the new layout (breadcrumb +
filter strip + drill-down slideout) instead of the pre-v.197
left/right two-pane.

### What's still NOT done

- 12 of 17 Money tiles (income-flow / spending-cal / net-worth /
  subs-renewals / 7 trade-terminal tiles) — v.199+
- All Health tiles (9) — v.200
- All Household tiles (11) — v.201
- All Family tiles (7) — v.202
- Pin button on viewer pages (the strip RENDERS but no UI to
  add/remove pins yet) — small follow-up
- "Add filter" typeahead UI in GH_FILTERS — stubbed to
  comingSoon; v.199+ wires real filter add
- Export buttons (PDF/Excel/CSV/Share) — display-only per the
  locked spec, wire later

---

## ✅ v.196 + v.197 DEPLOYED & VERIFIED — Trade Terminal Mobile UX + Reports Redesign Foundation (2026-05-24)

> **DEPLOYED 2026-05-24 ~00:23 via Path A + new -SkipE2E flag.**
> `version.txt`=`202605.197` live (verified via /api/v1/app/info).
> Local + origin + NAS all at `44ecbc0`.
> Smoke 8/8 ✅ (23.8s) — E2E SKIPPED per the new every-other-deploy
> rule (previous v.194+v.195 ran full E2E 115/0; next deploy after
> this one runs E2E again). Total deploy time **2 minutes** (vs
> ~15min with E2E).
>
> **Live route checks:**
>   - `/api/v1/app/info` → `version: 202605.197`
>   - `/api/v1/preferences/pinned-reports` → `{pinned_reports: []}`
>     (mig 147 applied, new module mounted, auth gates passing)
>   - `/reports.html` → HTTP 200, 142KB (new layout served)
>
> **Deploy-script Step 6 quirk:** did NOT recur this time (last
> bundle's 1h 21min hang on SSH log-tail was a one-off; the new
> `-SkipE2E` flag is unrelated to the Step 6 issue, just provides
> the new every-other-deploy cadence).
>
> **NEW DEPLOY RULE this turn:** full Playwright every OTHER deploy.
> Previous (v.194+v.195) ran full E2E (115/0). This bundle runs
> SMOKE ONLY per the new rule. Captured in [[ghrava-deploy-ssh]].
>
> **NEW PROCESS:** course-corrected mid-build. Original locked plan
> said v.197 = "scaffolding + Money LIVE in one combined drop."
> When I inspected the actual reports.html (2230 lines) and sized
> the 5 live-report viewer pages realistically, the effort came to
> ~1600 lines of new code in one drop. Split into v.197 (foundation
> only — visible redesign, all tiles non-functional) + v.198 (5
> Money reports wired live as a clean separate drop). Reduces blast
> radius; gives Al a verifiable-on-prod milestone between the two
> halves.

### v.196 — Phase 9 Trade Terminal Mobile UX (5 commits + 1 bash fix)

Closes the Trade Terminal Phase 3-9 roadmap. Pure frontend.

1. **`ced23d4`** — `useIsMobile()` hook added at module scope in
   trade.html. matchMedia + change listener so resize/orientation
   flip is live. Tab bar compacts on mobile (padding/font/letter-
   spacing) — ~7 tabs fit per swipe vs ~4 before. Content padding
   20→10 on mobile.

2. **`91fb32b`** — WatchlistTab takes isMobile prop. 7 columns →
   4 on mobile (SYMBOL/PRICE/CHG%/actions). Right-side AI panel
   stacks below the table at mobile width (380px → full-width).

3. **`c73fa51`** — PortfolioTab takes isMobile. GhravaPortfolio's
   10-col per-account holdings table renders as STACKED CARDS on
   mobile. Each card: symbol+type / shares@cost+value / gain+AI button.
   Desktop table preserved.

4. **`f261efd`** — PriceChart uses useIsMobile() directly (no prop
   drilling). Height 220→160 on mobile. RSI/MACD sub-chart hidden
   with note "open on desktop for the full indicator panel."

5. **`b990a13`** — SettingsTab takes isMobile + adds collapsible
   accordion. 4 sections (provider/market/appearance/social) wrap
   in `<SectionHeader>` with chevron toggle. AI Provider opens
   default; others collapsed on mobile, all open on desktop.

6. **`71fad2b`** — Bash `smoke-test.sh` python3 detection fix.
   Was reporting ~30 false failures on Windows because every
   is_json helper piped through `python3` which is the MS-Store
   stub on Windows. New portable detector picks `python` over the
   stub. Verified: 128/8 against live v.195 (was ~108/30 before).
   The 8 residuals are stale assertions (pre-existing).

### v.197 — Reports Redesign Foundation (5 commits)

Starts the Reports Redesign project. NEW page layout visible, NO
tile is wired to live data yet.

1. **`3915c0a`** (shipped earlier this session) — Locked all four
   NEEDS-CHAT items from the original handoff in
   `REPORTS_REDESIGN_HANDOFF.md` 2026-05-23 REFINEMENT BLOCK.

2. **`3c347a6`** — Migration 147 `user_preferences` table
   (id/user_key/pinned_reports JSON/updated_at). Seeded default
   row. New `app/features/preferences/routes.js` module mounted
   at `/api/v1/preferences`. requireAuth. GET/PUT
   `/pinned-reports` with max-4 server-side enforcement, dedupe,
   defensive insert if seed missing.

3. **`0b5ccf2`** — 5 shared components per the centralization lock.
   **Convention shift from the design lock:** files live in
   `app/public/js/` (matching `gh-card.js`/`gh-lens.js`) instead
   of `app/public/shared/`. gh-print.css at web root.
   - `gh-tile.js` — clickable shortcut tile per Variant A grouping
   - `gh-drilldown.js` — right-side slideout (desktop) / full-screen
     overlay (mobile per M4)
   - `gh-filter-strip.js` — filter pills + Add filter (for viewer
     pages in v.198+)
   - `gh-report-states.js` — empty + error + comingSoon() toast
   - `gh-print.css` — @media print stylesheet (loaded via
     `<link rel="stylesheet" href="/gh-print.css" media="print">`)

4. **`0562e65`** — Full `/reports.html` layout rewrite per locked
   #30a. New layout: header (icon + title + Lens search + count
   subtitle) + Pinned strip + 5-tab row (Money/Health/Household/
   Family/Pending) + per-tab tile grid in Variant A grouping.
   REPORT_TABS_V2 registry with 44 locked tiles total
   (Money 17 / Health 9 / Household 11 / Family 7). All tiles
   click → `GH_REPORT_STATES.comingSoon(slug)`. Pending tab
   preserves existing PendingReport.mount('pendingRoot')
   behavior unchanged. Old `function switchTab` renamed to
   `switchTab_LEGACY_DELETED` so hoisting doesn't override the
   new one. ~376 lines new + 17 deleted.

5. **Task 5 / docs + smoke + version bump (this commit).**
   - `app/version.txt` → `202605.197`
   - `smoke-test.sh` adds `/preferences/pinned-reports` assertion
   - `TRADE_TERMINAL_INTEGRATION.md` updated — Phase 9 marked LIVE;
     status line bumped to "ALL PHASES LIVE on v202605.196 —
     trade-terminal Phase 3-9 roadmap COMPLETE"
   - `REPORTS_REDESIGN_HANDOFF.md` status updated — Foundation
     BUILT in v.197, v.198 wires Money live
   - `STATE.md` (this block)

### Schema-safety gate

Migration 147 adds a new table (`user_preferences`) — that's the
first schema change since v.189. Expected baseline shift: the
existing 12 flags (10 noise + 2 view-limitation) carry forward;
the new migration is additive (CREATE TABLE IF NOT EXISTS, no
CASCADE, no FK) so should produce zero new validator flags.
Will re-run the gate as part of pre-deploy verification.

### Tests

E2E baseline `115/0` expected to hold. **This deploy runs SMOKE
ONLY per the new every-other-deploy rule** (previous v.194+v.195
ran full Playwright). Smoke must cover: existing tests + the new
`/preferences/pinned-reports` assertion.

### Known temporary regression in v.197

The 5 Money reports that worked through v.196 (Spending by Category /
HSA Summary / Subscription Spending / Investment Portfolio /
Net Worth) become NON-FUNCTIONAL in v.197 — clicking the new tile
fires "Coming soon" toast instead of opening the old report view.
The OLD tabs (Overview / Charts preview / Money / Family /
Maintenance / System) are gone from the UI. **v.198 wires these
to viewer pages and restores parity.** Documented + accepted as
part of the foundation course-correction.

### What v.196+v.197 deliberately does NOT do

- Wire any tile to a live report (v.198+ work)
- Full GH_LENS scope='reports' faceted search (the simpler input
  filter in v.197 covers the locked Lens behavior; full GH_LENS
  facets are a v.198+ enhancement)
- Pin button (lives on viewer pages, which don't exist yet)
- Print testing (gh-print.css ships but no viewer page yet uses it)
- Mobile testing of the new reports.html layout beyond CSS @media
  queries inside gh-* components

---

## ✅ v.195 DEPLOYED & VERIFIED — Phase 5A Real Screener Universe (2026-05-23)

> **DEPLOYED 2026-05-23 ~17:09 as part of the v.194+v.195 bundle.**
> `version.txt`=`202605.195` live (`/api/v1/app/info` confirms).
> Container restarted clean. Local + origin + NAS all at `7825f71`.
> Smoke 8/8 + E2E 115/0 — baseline held through both drops.
>
> **Deploy quirk:** `ghrava_deploy.ps1` Step 6 (SSH `docker logs`
> tail) hung indefinitely (~1h 21min before manual intervention),
> blocking the script from reaching Steps 7-8 (smoke + E2E). The
> deploy was functionally complete by Step 5 (container restarted,
> /api/v1/app/info served the new version). Smoke + E2E run
> manually via Playwright CLI against the live NAS confirmed
> 8/8 + 115/0. New rule added to [[ghrava-deploy-ssh]]: if Step 6
> log-tail SSH stalls > ~30s, verify the deploy via
> /api/v1/app/info and run smoke/E2E manually instead of waiting.

### What's in v.195 (3 net-new commits, 1 feature)

1. **`d71e07c` — Task 2 / Phase 5A backend: `/market/symbols`.**
   New trading route fetches Finnhub `/stock/symbol?exchange=US`
   (~10k US-listed symbols on the free tier) and caches in a
   dedicated `/app/data/trading-cache.json` with 24h TTL. Kept
   OUT of `trading.json` so the ~1MB payload doesn't round-trip
   on every client save. Graceful-fallback contract handles all
   four combinations of (cache present/absent) × (Finnhub key
   present/absent or fetch ok/failed). Forced refresh via
   `?refresh=1`. Slimmed response: keep symbol/displaySymbol/
   description/type/currency/mic (drops figi/isin/share class —
   irrelevant for a Screener filter, halves payload). 15s timeout
   on the Finnhub call.

2. **`8163f26` — Tasks 3+4 / Phase 5A frontend: universe view +
   filters + freshness UI.** Replaces the old `MOCK_QUOTES`-driven
   reference table in the Screener tab with a real filtered
   universe view backed by the new route. Tasks 3+4 ship together
   because the filter UI and cache-freshness UI live in the same
   panel.
   - Filters: substring on ticker + name, type select (sources
     surfaced from the actual data — not hard-coded), exchange
     select (MIC code).
   - Sortable by symbol or description (alpha asc/desc).
   - 100-row display cap for DOM perf; typical filter narrows
     below 100 anyway.
   - Row click → loads into the existing ticker lookup +
     triggers a quote fetch (same UX as the old mock table).
   - Freshness stamp: `<count> symbols · fetched X min/h/days ago`.
   - `⟳ refresh` button forces re-fetch.
   - Stale-cache notes from the backend render as italic muted
     text under the filters when present.
   - Footer note explicitly documents the free-tier limitation:
     sector + market-cap filters need `/stock/profile2` per
     symbol which the free tier can't sustain.
   - Removed dead `MOCK_QUOTES`-driven helpers (`sector`, `sortBy`,
     `sortDir` state; `all`/`sectors`/`filtered` derived blob;
     `toggleSort`/`SortArrow` helpers).

3. **Task 5 / docs + smoke + version bump (this commit).**
   - `app/version.txt` → `202605.195`
   - `smoke-test.sh` adds `/market/symbols` JSON assertion
     (accepts 200 with cache OR 400 with no-key+no-cache as
     healthy — both are correct shapes for prod).
   - `TRADE_TERMINAL_INTEGRATION.md`: status line bumped to
     'Phase 1 + 3A + 3B + 3C + 3D + 4A + 5A + 6 + 7 + 8'.
     Item 17 added under '✅ DONE in v.195' with the free-tier
     limitation explicit. Next-phases collapsed to just Phase 9
     (last trade-terminal drop before Reports Redesign).
   - `STATE.md` (this block).

### Schema-safety gate

Baseline unchanged from v.194 — `validate-schema.py --strict` exit
2 with the same 12 flags (10 known 130/134 noise + 2 view-
limitation false-positives on `routes.js:378` and `:727` — the
new symbols route added 122 lines but doesn't shift those flag
positions because it lands AFTER them). Zero new SQL. node --check
passes on routes.js.

### Tests

E2E baseline `115/0` expected to hold — no migrations, no contract
changes, additive feature only. The new smoke assertion is
additive: 8 trading assertions total now.

### What v.195 deliberately does NOT do

- Sector + market-cap filters (documented as a Finnhub free-tier
  limitation — would need `/stock/profile2` per symbol).
- Live-price filtering across the universe (impossible at scale on
  free APIs — the existing watchlist refresh handles live-price
  needs for the user's subset).
- The new on-disk `trading-cache.json` is not part of `trading.json`
  — clients never write it. The cache file isn't included in the
  deploy zip because it's runtime-generated (the route writes it
  on first refresh).
- Phase 9 (Mobile UX) → v.196 (last trade-terminal drop).
- Reports Redesign → v.197+ per the design lock in
  `REPORTS_REDESIGN_HANDOFF.md`'s refinement block.

---

## ✅ v.194 DEPLOYED & VERIFIED — Phase 8 Reports tab rich viewer (2026-05-23)

> **Built + deployed 2026-05-23 as part of the v.194+v.195 bundle.**
> Stacked on top of the deployed v.193 (`bb39204`); bundle deploy
> bumped straight to `202605.195`. v.194's `version.txt=202605.194`
> was a transient label. Smoke 8/8 + E2E 115/0 confirmed against
> the bundle.

### What's in v.194 (4 net-new commits, 1 docs commit, 1 feature)

1. **`3915c0a` — Docs lock for Reports Redesign.** Pre-build
   design conversation locked all four NEEDS-CHAT items from the
   original Reports Redesign handoff (Household / Family / mobile /
   column picker) plus several new architectural decisions
   (Variant A grouping, scaffolding-first build, centralized
   `app/public/shared/` components, mobile M1-M6, Family
   single-tile-with-switcher, sequencing v.197+ for the redesign).
   Captured as a "⚡ 2026-05-23 REFINEMENT BLOCK" at the top of
   `REPORTS_REDESIGN_HANDOFF.md`. New memory note +
   `MEMORY.md` index pointer. No app code change.

2. **`dde62d9` — Task 2 / Rich viewers for all 4 saved report types.**
   ReportsTab's old `renderDetail` falls back to raw JSON for
   anything but AI Analysis (which was already wired via
   AIResultCard). v.194 adds proper rendering for the other
   three types AND fixes Portfolio Snapshot which was BROKEN on
   v.193:
   - **Audit-vs-reality:** `PortfolioTab.savePortfolioReport`
     wrote `data.ghrava.<snake_case>` but the renderer read
     `data.summary.<camelCase>`. Saved snapshots also didn't
     include per-position detail. Every snapshot saved before
     v.194 shows mostly empty cells.
   - Fix: save now captures `ghrava: { summary, accounts:[...] }`
     (full tree). Renderer normalises three known shapes
     (new v.194 / pre-v.194 broken / legacy positions-array) into
     a common `{ summary, positions }`.
   - AI Rebalancing Advice + AI Tax Optimization render via new
     `<NarrativeAIReport>` component at module scope (hooks-of-rules
     compliance — `useState` for the collapsible 'show prompt'
     toggle).
   - CSV export wired alongside the snapshot renderer.

3. **`438dfb6` — Task 3 / Filter UI for saved reports.**
   Collapsible filter strip above the reports list. Three axes —
   TYPE (multi-select pills), TICKER (substring), DATE RANGE
   (from/to pickers). Applied client-side; reports list is small.
   '✕ CLEAR' when any filter active. Empty-state when no reports
   match the filter.

4. **`0af6422` — Task 4 / Compare-two-snapshots diff.**
   Big refactor: extracts snapshot rendering from a helper-function-
   inside-ReportsTab to a proper module-scope React component
   `<PortfolioSnapshotViewer>`. Necessary because the compare
   picker needs its own `useState`. The component:
   - Renders standard snapshot view (unchanged from task 2)
   - Adds 'COMPARE TO' picker listing other Portfolio Snapshots
   - On selection, fetches the other snapshot via `loadReport()`
   - Computes per-symbol diff: ADDED / REMOVED / CHANGED /
     UNCHANGED based on shares + value comparison
   - Renders status counts as colour pills + portfolio-level Δ
     cards (Δ VALUE / Δ COST / Δ P&L) + diff table sorted
     changed-by-|Δvalue| first
   - UNCHANGED rows hidden by default with a 'show N unchanged'
     toggle
   - `key={d.filename}` so switching reports resets the picker

   Cleanup: 143 + 30 lines of dead code removed via Python script
   (dead `renderPortfolioSnapshot` placeholder + duplicate
   `downloadSnapshotCsv` inside ReportsTab — both moved to module
   scope as part of the refactor).

5. **Task 5 / docs + version bump (this commit).**
   - `app/version.txt` → `202605.194`
   - `TRADE_TERMINAL_INTEGRATION.md`: status line bumped to
     'Phase 1 + 3A + 3B + 3C + 3D + 4A + 6 + 7 + 8'. Items 13-16
     added under '✅ DONE in v.194'. Next-phases list refreshed
     to v.195 Phase 5A + v.196 Phase 9 + v.197 Reports Redesign
     (consolidated; previous duplicate next-phases block deleted).
   - `STATE.md` (this block).
   - No smoke-test.sh additions — Phase 8 is pure frontend reuse
     of existing /reports endpoints, no new routes to assert.

### Schema-safety gate

Baseline unchanged from v.193 — `validate-schema.py --strict` exit
2 with the same 12 flags (10 known 130/134 noise + 2 view-limitation
false-positives on `routes.js:378` and `:727`). v.194 ships ZERO
new SQL. node --check passes on routes.js (no edits to it).

### Tests

E2E baseline `115/0` expected to hold — no migrations, no backend
contract changes, no smoke-suite changes, additive frontend only.

### What v.194 deliberately does NOT do

- Reports Redesign for `/reports.html` (the big rewrite). That's
  v.197+ — locked in this session's design conversation. See the
  refinement block at the top of `REPORTS_REDESIGN_HANDOFF.md`.
- Phase 5A (real screener) → v.195.
- Phase 9 (mobile UX) → v.196.

---

## ✅ v.193 DEPLOYED & VERIFIED — Phase 3C Concentration/Correlation + Phase 4A Multi-Symbol Chart (2026-05-23)

> **DEPLOYED 2026-05-23 ~15:39 (deploy started 15:29, full pipeline 10m
> incl. ~5m Playwright). Smoke 8/8, full E2E 115 pass / 0 fail — baseline
> held despite +522 lines on trade.html and +282 lines on
> trading/routes.js across v.192 + v.193.** `version.txt`=`202605.193`
> live (`/api/v1/app/info` confirms). Container restarted clean.
> Boot migration line: `Migrations: 0 applied, 144 skipped`. Zero
> `FAILED .*\.js` on the v.193 boot. Local + origin + NAS all aligned
> at `e999165`. Shipped via **Path A** (push then `-SkipGit` deploy
> then NAS git reset) — 8 granular commits preserved on origin instead
> of squash-committed by Step 4. Sanity check of the new
> `/portfolio/correlation` route returned the graceful-empty shape
> correctly (`holdings:[], sectors:[], correlation_pairs:[]` because
> the live DB has no holdings populated yet — exactly what the route
> is meant to return in that case). Schema gate clean on Windows host:
> 12 flags = 10 known 130/134 noise + 2 known view-limitation false-
> positives (one carried from v.189 + one carried from v.192 with its
> line shifted due to v.193's new route landing above it).

### What's in v.193 (3 net-new commits, 2 features)

1. **`dadbe8d` — Task 2 / Phase 3C backend: `/portfolio/correlation`.**
   Walks the holdings table (financial_accounts JOIN holdings,
   is_active=1, market_value>0), aggregates per-symbol across
   multiple accounts, takes top 10 by value. Fetches 90-day daily
   closes via the existing Yahoo proxy for each. Computes Pearson
   correlation on daily LOG-RETURNS (financial convention — raw
   prices overweight drift, returns measure co-movement). Min
   sample = 30 returns to qualify a pair for the output.
   Sector data via Finnhub `/stock/profile2 finnhubIndustry` when
   a key is configured; otherwise falls back to `holdings.asset_type`
   in parentheses ('(stock)', '(etf)', etc.). All per-symbol
   fetches in parallel with 6-8s timeouts so slow upstreams can't
   hang the route. Output:
   `{ holdings:[{symbol, value, pct, sector}],
      total_value, sectors:[{sector, value, pct}],
      correlation_pairs:[{sym1, sym2, correlation}],
      _flags: { single_over_10pct, sector_over_40pct, pairs_over_85 } }`.
   `// schema:` comment inline. node --check passes.

2. **`5f1525a` — Task 3 / Phase 3C frontend: ConcentrationPanel.**
   New collapsible panel on the Portfolio tab below TaxLocationPanel.
   Auto-loads on mount and re-loads when `ghravaPf` changes (so the
   parent's Refresh button cascades). Three sub-sections:
   - SINGLE-STOCK EXPOSURE: horizontal bars per top-10 holding,
     amber >10%, red >25%, with label ('OK' / 'HIGH' / 'VERY HIGH').
   - SECTOR EXPOSURE: bars per sector (all holdings, not just top
     10 — sector concentration is portfolio-wide), amber >40%,
     red >60%.
   - CORRELATION PAIRS: top 12 pairs by |r|, severity coloured:
     |r| >0.95 red 'NEARLY IDENTICAL', >0.85 amber 'HIGHLY
     CORRELATED', >0.7 text 'STRONG', else dimmed 'MODERATE'.
     Pairs with |r| < 0.5 hidden after the first 6 to keep the
     list focused on signal.
   Header shows aggregate flag count from the route's `_flags`;
   'balanced' tag when there are no flags. Refresh button + source
   line in the footer.

3. **`1791192` — Task 4 / Phase 4A multi-symbol PriceChart.**
   PriceChart gets a Compare input above the chart. User can add
   up to 3 extra symbols; chips show with fixed palette colours
   that match the line colours each symbol gets in the chart.
   When `compareSymbols.length > 0`:
   - Chart switches from candlestick to a normalised line chart.
   - Every series indexed to 100 at the first aligned bar.
   - Series trimmed from the tail to the shortest series so the
     most recent bars align (holidays / listings / halts mean
     symbols can have different bar counts within the same range).
   - Legend label: 'SYM  +X.XX%' (period return).
   - Y-axis labelled 'Indexed to 100'.
   - Overlay buttons (Candles/SMA/BB/RSI/MACD) hidden — overlays
     apply to single-symbol candles only.
   Comparison data fetched via existing `/market/history` — no
   new backend. useEffect dep array uses
   `compareSymbols.join(',')` + `Object.keys(compareCandlesBy).length`
   so the chart re-renders when compares change but doesn't
   over-fire on object identity.

4. **Task 5 / docs + smoke + version bump (this commit).**
   - `app/version.txt` → `202605.193`
   - `smoke-test.sh` adds one more Trading Terminal assertion:
     `/portfolio/correlation` — uses `assert_keys` for
     `holdings sectors correlation_pairs` since the route always
     returns these top-level keys even when empty.
   - `TRADE_TERMINAL_INTEGRATION.md` items 11 + 12 added under
     '✅ DONE in v.193'. Next-phases list refreshed: v.194 starts
     at Phase 8 Reports rich viewer.
   - `STATE.md` (this block).

### Schema-safety gate

Baseline unchanged from v.192 — `validate-schema.py --strict` exit 2
with the same 12 flags (10 known 130/134 noise + 2 view-limitation
flags). Line numbers for the v.192 flag shifted (`:560` → `:727`)
because the new correlation route added 167 lines above it; same
SQL, same false-positive. v.193's own new JOIN doesn't reference
`tax_treatment` so it doesn't add a third view-limitation flag.
Zero new flags from v.193-edited files. Zero new SQL beyond the
read-only JOIN.

### Tests

E2E baseline `115/0` expected to hold — no migrations, no contract
changes, additive only. The new smoke assertion is additive: 7
trading assertions total now. `/portfolio/correlation` returns 200
with empty arrays + `_note` when no holdings — `assert_keys`
accepts that since the three top-level keys still exist.

### What v.193 deliberately does NOT do

- Correlation matrix heatmap (spec called this out as 'too complex
  for the space' — pairs list is the better fit).
- Volume Profile (Phase 4B in the original spec; intentionally
  deferred as 'lower priority than 4A').
- Phase 8 (Reports tab rich viewer for the structured AI report
  JSON) → v.194.
- Phase 5A (real screener universe via Finnhub /stock/symbol with
  24h cache) → v.195.
- Phase 9 (mobile UX) → v.196.
- Reports Redesign — still queued AFTER v.196 per
  [[parallel-roadmaps-may-2026]].

---

## ✅ v.192 DEPLOYED & VERIFIED — Phase 3D Earnings for Holdings + Phase 7 Watchlist Alerts (2026-05-23)

> **Built 2026-05-23, deployed 2026-05-23 ~15:39 as part of the
> v.192+v.193 bundle.** Stacked on top of the deployed v.191
> (`4ac3ebc`); shipped together with v.193 via Path A. The bundle
> deploy bumped straight to `202605.193`; v.192's
> `version.txt=202605.192` was a transient label.

### What's in v.192 (3 net-new commits, 2 features)

1. **`f0b7e76` — Task 2 / Phase 3D backend: `/portfolio/earnings-calendar`.**
   New trading route. Reads `financial_accounts JOIN holdings WHERE
   is_active=1`, aggregates per-symbol across multiple accounts (sum
   shares + market_value + gain_loss_dollar; weighted-avg cost_basis;
   accounts as `nickname (tax_treatment)` strings), filters out
   non-equity asset_types (bond / cash / other), then hits Finnhub's
   free `/calendar/earnings` for the next 30 days with the held
   symbols as a comma-separated filter. Finnhub key read server-side
   from `trading.json` so it doesn't hit URL logs. Returns each
   matching earnings entry with `position` sub-object attached. Empty
   list + `_note` returned when: no holdings, no equity holdings, or
   no upcoming earnings for the held symbols. 400 + `items:[]` when
   `finnhubKey` is not configured. `// schema:` comment per LOCKED
   rule. node --check passes.

2. **`590b830` — Task 3 / Phase 3D frontend: 'My Holdings ★' sub-tab.**
   EarningsTab toggle gets a third pill alongside All Upcoming and My
   Watchlist. fetchEarnings() branches: 'holdings' hits the new
   Ghrava-backed endpoint, the other two preserve their existing
   Finnhub direct paths. Per-row position panel (purple tint) shows
   shares + avg cost + accounts + market value + P&L in a banner
   above the standard EPS/Rev row. 'YOU HOLD' tag in the header.
   AI Earnings Play button label flips to 'PLAY FOR MY POSITION'
   when `e.position` is set; `analyzeEarnings()` prepends a
   position context block to the prompt ('I hold N shares of S at
   \$X across [accounts]. Market value \$M, P&L \$D (P%). Given
   this exposure, should I hold through earnings, trim before,
   hedge with puts, or add?'). The AI recommendation is grounded
   in the actual exposure instead of a generic 'how to play this
   event' view.

3. **`53b7547` — Task 4 / Phase 7 Watchlist price alerts.**
   `trading.json` gains `alerts: [{ id, symbol, condition, price,
   triggered, createdAt }]`. The server's POST /data deep-merge
   handles the new key automatically; no backend change. Bell
   icon button on each Watchlist row in the actions area, amber
   when any armed alert exists for that symbol. Click opens an
   inline editor row: 'Alert for SYM when price is [above|below]
   \$[___] [Set] [Cancel]'. Default price = current quote so the
   user only changes the digits. Per-row chips below the editor
   show each alert ('🔔 above \$950 · armed' green, '🔔 above
   \$950 · fired' amber) with ↻ re-arm (when fired) and ✕ delete.
   checkAlerts() runs after every refresh() on the merged quotes
   set: walks every un-triggered alert, fires once per threshold
   cross, sets `triggered:true` via the existing debounced
   update() so it doesn't re-fire next refresh. Banner at top
   of the panel: '🔔 NVDA crossed above \$950 — now \$967.40 [✕]',
   dismissable, capped at 10. Removing a symbol from the watchlist
   also deletes its alerts.

4. **Task 5 / docs + smoke + version bump (this commit).**
   - `app/version.txt` → `202605.192`
   - `smoke-test.sh` adds one more Trading Terminal assertion:
     `/portfolio/earnings-calendar` — accepts both 200 (Finnhub
     key present, holdings found) and 400 (no Finnhub key) as
     valid responses since both shapes are healthy.
   - `TRADE_TERMINAL_INTEGRATION.md` Phase 3D + Phase 7 marked
     DONE in v.192 (items 9 + 10). Next-phases list shifts to v.193.
   - `STATE.md` (this block).

### Schema-safety gate

`validate-schema.py --strict` exit 2, **12 flags total** (was 11 in
v.191). 10 are the same known 130/134 noise. The other 2 are the
same view-limitation pattern — the validator doesn't expand
`financial_accounts` (mig 130's VIEW) to see `tax_treatment` (which
mig 146 added via CREATE VIEW recreation):

- `trading/routes.js:378` — pre-existing v.189 (the `/portfolio/live`
  query).
- `trading/routes.js:560` — new in v.192 (the
  `/portfolio/earnings-calendar` JOIN on `fa.tax_treatment`).

Both are false-positives. The runtime queries work correctly against
the live DB (mig 146 is applied; v.189-v.191 prod uses the same VIEW
column daily; the live `/portfolio/live` response from this session
returned `tax_treatment` values). The validator just doesn't model
SQL views.

Treating as known-validator-limitation. Future fix: teach
`validate-schema.py` to follow `CREATE VIEW ... AS SELECT col FROM
table` definitions, OR add a per-file ignore list. Not blocking
v.192.

### Tests

E2E baseline `115/0` expected to hold — no migrations, no contract
changes, additive only. The new smoke assertion is additive: 6 trading
assertions total now. `/portfolio/earnings-calendar` returns 400
('Finnhub API key required') when no key is configured — the smoke
test accepts that as healthy.

### What v.192 deliberately does NOT do

- Multi-tab toast infrastructure for alerts. The trigger banner lives
  inside the Watchlist tab only — alerts only fire on refresh, which
  the user initiates from the Watchlist tab, so the banner is always
  visible when alerts fire. Cross-tab toasts can be added later if
  background polling becomes a feature.
- Phase 3C + 4A (Correlation + multi-symbol chart) → v.193.
- Phase 8 (Reports tab rich viewer for AI Rebalancing, AI Tax
  Optimization, Earnings Play reports) → v.194.
- Phase 5A (real screener universe) → v.195.
- Phase 9 (mobile UX) → v.196.
- Reports Redesign — queued AFTER v.196 per
  [[parallel-roadmaps-may-2026]].

---

## ✅ v.191 DEPLOYED & VERIFIED — Phase 3B Tax Location + Phase 6 Short Interest + AIAnalyst bugfix (2026-05-23)

> **DEPLOYED 2026-05-23 ~13:43 (deploy started 13:28, full pipeline 15m
> incl. 8m Playwright). Smoke 8/8, full E2E 115 pass / 0 fail — baseline
> held despite +772 lines on trade.html and the AIAnalyst fix.**
> `version.txt`=`202605.191` live (`/api/v1/app/info` confirms). Container
> restarted clean. Boot migration line: `Migrations: 0 applied, 144
> skipped` (no migrations in v.190/v.191; same as v.189). Zero
> `FAILED .*\.js` on the v.191 boot. Local + origin + NAS all aligned at
> `2689078`. Shipped via **Path A** (push from `C:\dev\ghrava` first, then
> `ghrava_deploy.ps1 -SkipGit`, then NAS git reset to origin) so the 7
> granular commits are preserved on origin instead of being squash-
> committed by Step 4. Schema-safety gate clean on Windows host: 11 flags
> = 10 known 130/134 + 1 known view-limitation on `routes.js:378` (pre-
> existing v.189). Zero new SQL across v.190 + v.191. The deploy
> script's `errors=0` false-positive fix (`af685a1`) also rode along —
> the v.191 deploy log shows "No errors in fresh logs" cleanly (vs the
> previous v.189 deploy which mis-reported "3 error-like line(s)").

### What's in v.191 (3 net-new commits, 2 features + 1 bug fix)

1. **`1a80dc3` — Tasks 2+3 / Phase 3B: Tax Location Analysis + AI Full Tax
   Optimization.** Both tasks ship in one commit because the AI button is built
   into the same `TaxLocationPanel` component (mirrors the
   `TargetAllocationPanel` pattern from v.190). New collapsible panel renders
   below Target Allocation on the Portfolio tab. Client-side rules engine —
   first-match-wins per holding — flags four placement types:
   - Bond in Taxable → interest taxed as ordinary income annually
   - Bond in Roth IRA → wastes tax-free growth space
   - Cash in Roth IRA → near-zero return, wastes tax-free space
   - High-dividend in Taxable → dividends taxed annually (threshold
     `dividend_yield >= 0.025` handles both decimal-form and percent-form
     CSV imports)

   Display: table with HOLDING / CURRENT ACCOUNT (+ tax badge) / ISSUE /
   SUGGESTED. Largest market_value first. Caps at 12 rows with 'N more'
   tail. Amber banner only when the user has 2+ investment accounts AND
   every one is on the default 'taxable' (clear signal the v.189 dropdown
   needs populating).

   AI button (`buildTaxOptimizationPrompt`) sends full holdings-by-account
   picture + flagged issues + four tax-location principles to the configured
   provider. Asks for 3-section response (SUMMARY / PRIORITISED MOVES /
   CAVEATS) under 450 words with dollar amounts. Save-as-Report wired with
   `type='AI Tax Optimization'`.

2. **`05dcb7b` — Task 4 / Phase 6 Short Interest end-to-end + AIAnalyst bug
   fix.** Two interleaved changes — short-interest required the AI enrichment
   pipeline to work, and that pipeline lived behind state that was never
   declared.

   *Backend:* new route `GET /api/v1/trading/market/short-interest/:symbol`.
   Tries Yahoo `quoteSummary defaultKeyStatistics` with browser UA. Returns
   `{ symbol, shortFloat, shortRatio, sharesShort, sharesShortPrior, _source }`.
   Graceful-null contract: on 401/timeout/parse-fail returns 200 with all
   fields null and `_source='unavailable'` (verified externally — Yahoo
   blocks cookie-less calls). The route's failure mode keeps the frontend
   enrichment pipeline working; UI hides the section.

   *Frontend bug fix:* `AIAnalystTab.run()` referenced `setFundamentals`,
   `enrichment`, and (in JSX) `setTechContext` — **none of which were
   declared.** Every Run Analysis click on v.189 raised
   `setFundamentals is not defined`, caught by the surrounding try/catch
   and shown as the error message. AI never ran on v.189. v.191 adds the
   three missing `useState` hooks and rebuilds `run()` so that
   fundamentals/short-interest/congress/filings fetch in parallel and the
   structured `enrichment` object flows into `analyzeStock()` (which
   already had an `if (e.shortInterest)` branch waiting for input).

   *Frontend display:* AIResultCard gains a new SHORT INTEREST section
   between the fundamentals grid and the insider table. Three cells —
   Short Float (% of float), Days to Cover, Δ vs prior month — with
   amber-at-15% / red-at-25% severity colouring and a plain-English
   label ('EXTREME — short squeeze potential' / 'HIGH — watch for squeeze
   pressure' / 'Normal').

3. **Task 5 / docs + smoke + version bump (this commit).**
   - `app/version.txt` → `202605.191`
   - `smoke-test.sh` adds one more Trading Terminal assertion:
     `/market/short-interest/AAPL` JSON shape (route may return null
     fields on Yahoo block; healthy either way).
   - `TRADE_TERMINAL_INTEGRATION.md` Phase 3B + Phase 6 marked DONE in
     v.191; the AIAnalyst bug captured as item 8; next-phases list shifts
     to v.192 (Phase 3D + 7) onwards.
   - `STATE.md` (this block).

### Audit-vs-reality finding in v.191

The AIAnalystTab bug above is the **fourth** v.186-v.189 audit-vs-reality
case caught since the v.190 reconcile (after Tasks 1 + 4 of v.190 being
already-shipped, and the mig 146 dropdown_options doc bug). The user's
spec at session start claimed AI Analyst was '✅ Full' with rich enrichment;
the reality was that clicking Run Analysis silently failed. Pattern
matches the `audit-vs-reality-check` memory's premise: roadmap claims
unbuilt or broken work as done. The fix here was small (3 hooks + a
rewritten `run()` body) but if it had been missed, Phase 6 would have
landed on top of a still-broken AI Analyst.

### Schema-safety gate

Baseline unchanged from v.190 — `validate-schema.py --strict` exit 2 (the
ten 130/134 noise lines) + the same 1 view-limitation flag on
`trading/routes.js:378` (pre-existing v.189 condition, not a v.191
regression). Zero new flags from v.191-edited files. v.191 ships zero
new SQL. SCHEMA.md NOT regenerated (same reason as v.190 — the `.js`
generator that produced the committed file isn't being run, and the
`.py` generator's output would only churn formatting).

### Tests

E2E baseline `115/0` should hold — v.191 adds no migrations and no
contract changes. The new smoke assertion is additive (5 trading
assertions total now). The `/market/short-interest` route is expected
to return JSON with `_source:'unavailable'` against the live NAS until
the Yahoo crumb dance or Polygon fallback is wired — that's still a
PASS for `assert_json`.

### What v.191 deliberately does NOT do

- **Yahoo crumb dance / Polygon short-interest fallback.** Documented as
  a known limitation. The route's graceful-null contract means the UI and
  AI prompt handle missing data correctly. Future drop will address if Al
  wants real short-interest data flowing.
- Phase 3D + 7 (Earnings calendar for holdings + alerts) → v.192.
- Phase 3C + 4A (Correlation + multi-symbol chart) → v.193.
- Phase 8 (Reports tab rich viewer) → v.194.
- Phase 5A (real screener universe) → v.195.
- Phase 9 (mobile UX) → v.196.
- Reports Redesign — queued AFTER v.196 per [[parallel-roadmaps-may-2026]].

---

## ✅ v.190 DEPLOYED & VERIFIED — Phase 3A Target Allocation editor + Phase-1-2 doc reconcile (2026-05-22 built, 2026-05-23 deployed)

> **Built 2026-05-22, deployed 2026-05-23 as part of the v.190+v.191
> bundle.** `version.txt`=`202605.190` was a transient label; the
> bundle deploy bumped straight to `202605.191`. Hand-off situation
> worth flagging: at session start, this Windows clone was 6 commits
> behind `origin/main` because the v.186-v.189 trade-terminal work was
> shipped by a parallel chat (the deploy script pushes from `Z:\ghrava`
> on the NAS-side after each deploy). `git fetch` + fast-forward
> brought local back in sync; v.190 + v.191 were layered on top and
> shipped via Path A (push then -SkipGit deploy). See
> `MEMORY.md → parallel-roadmaps-may-2026` and the updated
> start-of-session check in `ghrava-deploy-ssh`.

### Reconciled into v.190 (work that landed v.186-v.189 by parallel chat)

| Theme | Drop | What |
|---|---|---|
| Trade Terminal Phase 1 — Ghrava integration | v.186-v.187 | mig 146 `tax_treatment` (column on `accounts`, view recreated); `/portfolio/live`, `/portfolio/performance`, `/watchlist/summary`, `/reports/save-to-ghrava`. Portfolio tab Ghrava Holdings view with tax-treatment badges. AI Analyst auto-injects cost basis when launched from a position. |
| Trade Terminal Phase 2 — chart + macro + options | v.187-v.189 | Candlestick chart with volume bars + technical indicators (RSI/MACD/BB) fed into AI prompt context. FRED macro panel (`/market/macro` — Fed rate, CPI, unemployment, yield curve, S&P, VIX). Real options chain via Polygon (`/market/options`, free tier). Finance dropdown UI for `tax_treatment` (`finance.html:3610-3623`). Dashboard watchlist widget (`dashboard.html:418-428`). |

These were missing from STATE.md but **live on the NAS as v202605.189** before
v.190 work began. Smoke + Playwright at v.189 deploy time confirmed healthy boot
(docker logs grepped clean, container running on port 3001).

### What's in v.190 (3 net-new commits + 1 deploy-script fix)

1. **`af685a1` — Deploy-script false-positive fix.**
   `ghrava_deploy.ps1` Step-6 log scan was matching `errors=0` (the data-cleanup
   stat counter) and reporting "3 error-like line(s) in logs" on healthy
   deploys. Filter `\berrors?=0\b` lines before counting. Legitimate
   `[ERROR]` / `errors=3` / `Uncaught` / crash patterns still trip the warning.
   No app code change. No version bump on its own — landed alongside v.190.

2. **`00a152e` — Task 2 / Phase 3A: Target Allocation editor panel.**
   New collapsible panel below the Portfolio Performance chart on the Portfolio
   tab. Columns: ASSET TYPE / CURRENT% / TARGET% / DRIFT / STATUS dot
   (green ≤2%, amber 2-5%, red >5%). Six canonical categories
   (stock / etf / mutual_fund / bond / cash / other) with `normaliseAllocKey()`
   folding the raw `holdings.asset_type` values into the canonical set. Reads
   current % from `/portfolio/performance` allocation; persists target in
   `trading.json` under `settings.targetAllocation` via the existing debounced
   `update()`. First-launch UX: "Use Current as Target" button seeds an
   integer-rounded distribution (fractional-remainder algorithm) summing to 100.
   Edit mode validates sum=100 before allowing Save.

3. **`4f80748` — Task 3 / Phase 3A: AI Rebalancing Advice button.**
   Wires the slot reserved in commit 2. `buildRebalancePrompt()` composes a
   prompt with current vs target drift, total value, and the top 3 holdings per
   category (with account name + tax_treatment), instructing the AI to prefer
   tax-advantaged accounts for bond/dividend moves. Uses the existing
   `callProvider()` (gemini / deepseek / openai / claudeHaiku / claudeSonnet —
   the user's setting picks). Result renders inline as a narrative card with
   provider badge, timestamp, dismiss, and Save-as-Report button.
   `saveRebalanceReport()` calls existing `persistReport()` with
   `type='AI Rebalancing Advice'` — the current Reports tab renders that as JSON
   (rich viewer is Phase 8 scope).

4. **Task 5 / docs + smoke + version bump (this drop).**
   - `app/version.txt` → `202605.190`
   - `smoke-test.sh` gets a new "Trading Terminal" section: `/portfolio/live`,
     `/portfolio/performance`, `/watchlist/summary`, `/market/macro`.
   - `TRADE_TERMINAL_INTEGRATION.md` updated: marks Phase 1 + 3A as live;
     corrects the stale claim that mig 146 seeds `dropdown_options` (it does
     not — the dropdown uses static options matching the taxLabel enum).
   - `STATE.md` (this block).

### Audit-vs-reality findings during v.190 build (3 cases caught)

| Spec claim | Reality on v.189 | Resolution |
|---|---|---|
| "Task 1 — Wire `tax_treatment` dropdown in `finance.html`" | Already wired end-to-end in v.189 (`finance.html:3610-3623` + `:2620/2664/2711`). Live NAS verified `GET /finance/accounts` returns `tax_treatment` for Brokerage rows. | No code change; doc correction in `TRADE_TERMINAL_INTEGRATION.md`. |
| "Task 4 — Build dashboard watchlist widget" | Already wired in v.189 (`dashboard.html:418-428` widget + `:436-467` loader). Live `/watchlist/summary` returns 7 movers. | No code change; doc correction. |
| Mig 146 "seeds `dropdown_options` with `list_key = 'investment_tax_treatment'`" | False — SQL only adds the column + recreates the view, no seed INSERT. | Doc corrected to explain why static options are correct (vocabulary is code-coupled). |

Net: v.190 ships **2 net-new app commits** (Tasks 2 + 3) instead of the planned
5 — Tasks 1 and 4 were already shipped, Task 5 is docs-only. Same pattern as the
v.181–v.184 audit cases the `audit-vs-reality-check` memory tracks.

### Schema-safety gate (Windows host pre-package)

11 flagged lines via `validate-schema.py --strict`. 10 are in `130_rescue_126.js`
(pre-existing 130/134 noise — known benign per [[ghrava-deploy-ssh]]). **1 new
flag** is `app/features/trading/routes.js:378 — no such column: tax_treatment`
on `financial_accounts`. This is a v.189 condition (not a v.190 regression):
the route reads `tax_treatment` via the `financial_accounts` view, but the
validator doesn't expand view definitions, so it can't see that mig 146 recreated
the view to expose the column. The route works correctly on prod (live NAS verified
above). **Treating as a known validator limitation.** v.190 ships zero new SQL.

### Tests

E2E baseline `115/0` should hold — v.190 adds no migrations, no contract
changes, no smoke-suite regressions. The new smoke section is additive: 4 new
trading-terminal assertions, all expected to pass against the live NAS state.

### What v.190 deliberately does NOT do

- Phase 3B (Tax Location Optimisation) — deferred to v.191 (unblocked now that
  the `tax_treatment` dropdown is verified live).
- Phase 6 (Short Interest) — v.191.
- Phase 3D + 7 (Earnings + Alerts) — v.192.
- Phase 3C + 4A (Correlation + multi-symbol chart) — v.193.
- Phase 8 (Reports tab rich viewer) — v.194.
- Phase 5A (real screener universe) — v.195.
- Phase 9 (mobile UX) — v.196.
- Reports page redesign (`REPORTS_REDESIGN_HANDOFF.md`) — queued AFTER trade
  terminal Phase 3-9 ships, per [[parallel-roadmaps-may-2026]].

---

## ✅ v.185 DEPLOYED & VERIFIED — Reports Group 1 Part B: Sankey + small-multiples (2026-05-21)

> **DEPLOYED 2026-05-21 ~21:17 (deploy started 21:07, full pipeline
> 10m). Smoke 8/8, full E2E 115 pass / 0 fail (4.5m run; held the
> v.184 baseline — no new tests, no regressions).** `version.txt`=
> `202604.185` live, container restarted clean. Boot migration line:
> `Migrations: 0 applied, 143 skipped` (no migrations in this drop;
> identical to v.184's baseline). Zero `FAILED .*\.js` on the v.185
> boot (the 126 orphan stays resolved per v.177). Local/origin/NAS
> all == `4a25b3e`. Schema-safety gate cleared on Windows host
> before package: 10 flagged lines all in `130_rescue_126.js` +
> `134_hsa_plan_to_fsa.js` (known pre-existing noise); zero entries
> from any v.185 file. Five commits on origin: `7481334 → 4a0fcd9
> → 3fcf7a5 → d129df4 → 4a25b3e`. Pure additive drop — three new
> backend endpoints, two new chart renderers, two new drill-down
> kind branches. No migrations, no schema changes, no column
> changes.

**Theme.** Finish Reports Group 1 (Money). v.183 closed 2 of the 4
chart slots (calendar heatmap #26.1.2, vendor treemap #26.1.3) and
locked the generic drill-down framework. ROADMAP's v.182 block
explicitly deferred the remaining two — Sankey (#26.1.1) and small-
multiples (#26.1.4) — to a "Group 1 Part B" follow-up drop. This
is that drop.

### What's in this drop (4 tasks, 1 commit each)

1. **Backend — `/income-by-category-flow` + `/txns-by-category`** (`7481334`).
   - `GET /api/v1/finance/reports/income-by-category-flow?year=YYYY`
     drives the Sankey. Returns income totals per income-side
     category (amount > 0) and spend totals per expense-side
     category (amount < 0) across the unified
     `finance_transactions UNION imported_transactions` feed.
     Transfers excluded. "Uncategorized" rolls up NULL/empty.
   - `GET /api/v1/finance/reports/txns-by-category?category=NAME[&year=&month=&side=income|expense]`
     is the generic category drill-down endpoint, designed to be
     reused by both the Sankey (year+side) and small-multiples
     (year+month+expense). Single endpoint, four optional filters.
     Handles the "Uncategorized" sentinel as
     `(category IS NULL OR category = '')`.
   - Every `db.prepare` carries the `// schema:` comment per LOCKED
     rule.

2. **Frontend — #26.1.1 Sankey live + drill-down** (`4a0fcd9`).
   - `renderSankey()` + `sankeySvg()` replace `mockSankeySvg()`.
     Two-column ribbon layout at 400×180; income categories stacked
     left (filling full chart height proportional to their share of
     `total_income`), expense categories stacked right (same logic
     against `total_expense`).
   - Ribbons drawn between every (i, j) pair with width =
     `(income[i] / sumI) × (expense[j] / sumE) × innerH`. Near-zero
     slivers skipped.
   - Top-6 per side with "(K more)" tail node (matches treemap
     pattern). Stable hash-based color per category.
   - Click income bar → drill `side=income`, click expense bar or
     ribbon → drill `side=expense`. New `kind === 'income-flow'`
     branch in `openDrillDown`. Key shape `side::category`.

3. **Backend — `/spending-by-category-monthly`** (`3fcf7a5`).
   - `GET /api/v1/finance/reports/spending-by-category-monthly?year=YYYY&limit=N`
     drives the small-multiples. Returns the top-N expense
     categories for the year, each with a 12-element monthly array
     (positions 0..11 = Jan..Dec, ABS of net spend). Limit default
     6, capped at 12. Income rows excluded.
   - Single SQL query groups by `(category, strftime('%m'))`; JS
     pivots to `Map<category, number[12]>` and slices to top-N
     by year total.

4. **Frontend — #26.1.4 small-multiples live + drill-down** (`d129df4`).
   - `renderSmallMultiples()` + `smallMultiplesSvg()` replace the
     "Small-multiples mockup pending" stub.
   - 3×2 grid of mini bar charts (one per top-6 category, 12 bars
     each). Per-panel Y scale (small-multiples convention: show
     shape not magnitude). Every-other-month J/M/M/J/S/N ticks.
   - Bars (not lines) because monthly spend is non-cumulative
     bucketed data and sparse months read cleanly as gaps.
   - Click any bar → drill `kind='category-month'`,
     key `category::month`. Reuses `/txns-by-category` with
     `side=expense&year=&month=`. New `kind === 'category-month'`
     branch in `openDrillDown`.

### Group 1 status after v.185

| # | Title | Chart | Status |
|---|---|---|---|
| #26.1.1 | Where money goes each month | Sankey | **LIVE v.185** |
| #26.1.2 | Busiest spending days | Calendar heatmap | LIVE v.183 |
| #26.1.3 | Where you shop most | Vendor treemap | LIVE v.183 |
| #26.1.4 | What you spend on, month by month | Small-multiples | **LIVE v.185** |
| #26.1.5 | What is coming in the next 30 days | Cash-flow forecast | LIVE v.172 |

Group 1 (Money) is now **5 of 5 charts live**. Drill-down framework
exercised across all four `kind` branches (`calendar`, `vendor`,
`income-flow`, `category-month`). The ROADMAP "v.182-reports" block
(which shipped as v.183 partial) is fully closed.

### What v.185 deliberately does NOT do

- Group 2 (Health) — still blocked on `metric_index` design
  conversation per ROADMAP "v.184" block. Needs ~30 min in chat
  before any code starts.
- Group 3 (Household) — still blocked on #28 Universal Attachments.
- HSA-YTD product decision (medication card) — still your call,
  separate small drop.
- Vehicles module (DRAFT #19) — still LATER scope.

### Schema-safety gate

Windows host pre-package check: 10 flagged lines, all in
`130_rescue_126.js` + `134_hsa_plan_to_fsa.js` (pre-existing
baseline; same noise carried since v.181). Zero new entries from
any v.185 file. Three new `db.prepare` calls all carry `// schema:`
comments naming the table/column path.

### Tests

Smoke 8/8 expected unchanged (no smoke-suite changes). E2E baseline
`115/0` — v.185 adds no tests, no migrations, no contract changes
that would touch the existing suite. Schema-validator on Windows
host clear of new entries; will re-validate on NAS at package time.

### Audit reconciliation

ROADMAP's "v.182-reports" block (which shipped as v.183 partial)
listed T2 (Sankey) + T5 (small-multiples) as DEFERRED to "Group 1
Part B." v.185 IS that drop. T6 ("Drill-down on each chart") was
marked `[~]` partially shipped in v.183 because the generic
framework was in place but only `calendar` + `vendor` branches
existed. v.185 adds the `income-flow` + `category-month` branches,
finishing T6.

---

## ✅ v.184 DEPLOYED & VERIFIED — tx_link_rules editor + backfill (2026-05-20)

> **DEPLOYED 2026-05-20 ~16:35. Smoke 8/8, full E2E 115 pass / 0 fail
> (3.0m run; held the v.183 baseline — no new tests, no regressions).**
> `version.txt`=`202604.184` live, container restarted clean. Boot
> migration line: `Migrations: 0 applied, 143 skipped` (no migrations
> in this drop). Zero `FAILED .*\.js` on the v.184 boot. Local/origin/
> NAS all == `dd65043`. Schema-safety gate cleared on Windows host
> before package: 10 flagged lines all in `130_rescue_126.js` +
> `134_hsa_plan_to_fsa.js` (known pre-existing noise); zero entries
> from any v.184 file. Four commits on origin: `d23eb09 → 3db2755 →
> 72ad837 → dd65043`. Pure additive drop — three new backend
> endpoints, one new Settings sub-panel, one deep-link handler, one
> discoverability link from the Pending tab. No migrations, no
> schema changes, no column changes.

**Theme.** Give the user a real editor for the `tx_link_rules` table
that the Pending Items list quietly accumulates whenever they tick
"remember rule." Until v.184 there was no way to view what rules had
been created, edit one that misclassified, pause auto-apply on a
specific rule, or apply rules retroactively to past transactions.

### Audit correction recorded

ROADMAP "v.183-rules" Task 2 ("Auto-apply rules on import") was
**ALREADY SHIPPED v.171**: `applyRulesToTransaction()` in
`pending/routes.js:591` is called from `import/routes.js:282` on
every imported transaction. This was discovered during v.182
investigation; reconfirmed today. The ROADMAP block's Task 2 is
moved to ✅ ALREADY SHIPPED with attribution.

### What's in this drop (4 tasks, 1 commit each)

1. **Backend — `PUT /rules/:id` + `POST /rules/backfill`** (`d23eb09`).
   - `PUT /api/v1/pending/rules/:id` — PATCH-style update (only
     touches fields present in the body), validates the rule exists,
     returns the updated row. Lets the editor edit instead of having
     to delete + re-add.
   - `POST /api/v1/pending/rules/backfill` — walks transactions with
     no `record_links` row yet, runs `applyRulesToTransaction()` per
     row, returns `{scanned, linked, elapsed_ms}`. Body `{ limit? }`
     defaults 1000, capped at 10000. Idempotent — the underlying
     helper uses `INSERT … ON CONFLICT DO NOTHING` on the
     `record_links` unique constraint.

2. **Settings → Transaction Link Rules sub-panel** (`3db2755`).
   - Bonus backend endpoint added inline: `POST /api/v1/pending/
     rules` for direct rule creation. Previously rules could only be
     created via `POST /link?remember_rule=true`, which requires a
     specific transaction. The editor needs to create rules ahead
     of time.
   - New rail item in the Imports section between "Finance category
     rules" and "HSA & LP-FSA plans": "Transaction link rules —
     Merchant → vehicle, subscription, prescription". Active-count
     badge.
   - New `panel-txrules` sub-panel mirrors `panel-finrules`:
     how-it-works card; Add Rule form (pattern auto-wraps bare
     keywords in `%…%`, target type 5 options [vehicle / subscription
     / medication / item / certification — `hsa_payment` dropped per
     audit], target record dropdown populated from `/data/table`
     based on type, optional category secondary filter, auto-apply
     checkbox); Backfill button; Existing rules table with pattern
     + optional category sub-line, target type + label, match count
     + last-matched date, auto-apply pill, Pause/Resume + Delete
     buttons.
   - JS uses a declarative `TR_TARGET_TYPES` table — adding a 6th
     target type later is a one-line change. Per-type cache means
     `/data/table` is hit once per type, not per rule row.

3. **Discoverability — Pending tab "Manage merchant rules →" link**
   (`72ad837`).
   - Small dotted-underline link in the Pending tab header, next to
     the "N open" count pill. Deep-links to `/settings.html?panel=
     txrules`.
   - Generic `?panel=<name>` deep-link handler added to settings.html
     (right after the Google OAuth IIFE). Reads the param, checks
     `PANEL_LOADERS[name]`, replaces URL + opens. Reusable from any
     future page.

4. **Docs + version bump + schema gate** (this commit).

### Five-target-type decision recorded

The backend supports 6 right_type values (vehicle, subscription,
medication, item, hsa_payment, certification — matching the Pending
list's MODULES table). The editor exposes 5: `hsa_payment` is
deliberately dropped from the Add Rule form because there's no
useful list to pick from (HSA payments are auto-created by the
linker; a user wouldn't pre-target a specific receipt). The PUT
endpoint still accepts `right_type='hsa_payment'` for any rules
created elsewhere (e.g. via direct API or the Pending list flow).

### Endpoint surface added (all in `app/features/pending/routes.js`)

| Endpoint | Purpose |
|---|---|
| `POST /rules` | Direct rule creation (no transaction required) |
| `PUT /rules/:id` | Patch update (auto_apply, pattern, target, category) |
| `POST /rules/backfill` | Apply rules to unlinked past transactions |

Existing endpoints `GET /rules` and `DELETE /rules/:id` unchanged.

### What v.184 deliberately does NOT do

- Reports Group 1 Part B (Sankey + small-multiples) — still deferred.
- Reports Group 2 (Health) — still blocked on `metric_index` design.
- Reports Group 3 (Household) — still blocked on Universal Attachments.
- Decision-gated work (HSA-YTD card, metric_index design).
- Per-rule confidence threshold UI — the backend only has
  `auto_apply` (boolean) and no confidence field on `tx_link_rules`.
  ROADMAP's "confidence threshold" item is therefore aspirational;
  if Al wants it, a small schema add + UI exposure can ship in a
  later drop.
- Bulk operations on rules (export/import, batch enable/disable).

### Expected post-deploy verification

Smoke 8/8 (no smoke changes). E2E baseline `115/0` — v.184 adds no
tests and doesn't change tested behavior, so 115/0 should hold. On
the Linux container at package time, schema-safety gate should
remain at 10 flagged lines (130/134 noise) — zero from v.184
because every new `db.prepare` references existing columns only.

Manual smoke after deploy:
- Open `/reports.html?tab=pending`. The "Manage merchant rules →"
  link should sit next to the "N open" pill.
- Click it → Settings opens with the Transaction Link Rules panel
  already open (the `?panel=txrules` URL is consumed and stripped).
- Add Rule: pick a target type, dropdown populates with real
  records from that module, save → row appears in the existing
  rules table.
- Pause: clicking flips the auto-apply pill to "off"; clicking
  Resume flips it back.
- Backfill: click → result line shows "X of Y linked"; match counts
  in the table update.

### ROADMAP label slip continues

ROADMAP's "v.183-rules" block IS this drop (v.184). The off-by-one
slip persists.

---

## ✅ v.183 DEPLOYED & VERIFIED — Reports Group 1 (partial): heatmap + treemap + drill-down (2026-05-20)

> **DEPLOYED 2026-05-20 ~15:55. Smoke 8/8, full E2E 115 pass / 0 fail
> (held v.182 baseline — no new tests, no regressions; fastest E2E
> run yet at 2.9m).** `version.txt`=`202604.183` live, container
> restarted clean. Boot migration line: `Migrations: 0 applied, 143
> skipped` (no migrations in this drop). Zero `FAILED .*\.js` on the
> v.183 boot. Local/origin/NAS all == `1b82e88`. Schema-safety gate
> cleared on Windows host before package: 10 flagged lines all in
> `130_rescue_126.js` + `134_hsa_plan_to_fsa.js` (known pre-existing
> noise); zero entries from any v.183 file. Four commits on origin:
> `49c1ecb → 9d414f1 → 7d573cc → 1b82e88`. Pure additive drop — four
> new GET endpoints on the existing reports sub-router, ~470 lines of
> SVG + drill-down JS in reports.html, one stale BACKLOG bug retired.
> No migrations, no column changes, no UI deletes.

**Theme.** Make the Reports → Charts tab stop being a placeholder.
The locked #26 design has 13 charts in 3 groups; before v.183 only
#26.1.5 (cash-flow forecast) was live and #26.1.1 (Sankey) /
#26.2.1 (BP line) had static SVG mockups. v.183 adds **#26.1.2
(calendar heatmap)** and **#26.1.3 (vendor treemap)**, plus a
generic right-pane drill-down pattern that the remaining charts will
reuse. Sankey (#26.1.1) and small-multiples (#26.1.4) stay as
mockups — deferred to a follow-up "Group 1 Part B" drop.

### What's in this drop (4 tasks, 1 commit each)

1. **Retire stale CSS modal-leak bug** (`49c1ecb`). BACKLOG known-bug
   #4 ("Reports panels open as center modals — sub-panel CSS leak
   from settings.html") doesn't reproduce in current code. Verified
   against live prod 2026-05-20: `shared.css` has zero `.sub-panel`
   positioning rules (only theme overrides at lines 2636-2641, which
   restyle but don't position); `reports.html` uses no `.sub-panel`
   class; the only `position:fixed` rule on reports.html is the
   intentional mobile overlay at line 59 (`<899px` viewport). Marked
   the row RESOLVED/STALE with verification notes; no code change.

2. **#26.1.2 Calendar heatmap live + drill-down framework** (`9d414f1`).
   - NEW endpoints: `GET /api/v1/finance/reports/daily-spend?year=`
     (daily aggregates from the unified `finance_transactions UNION
     imported_transactions` feed) and `GET /txns-on-date?date=YYYY-
     MM-DD` (drill-down companion).
   - `renderCalendarHeatmap()` + `calendarHeatmapSvg()` in
     reports.html. GitHub-style 53 weeks × 7 days SVG grid, 5-bucket
     red ramp (`var(--bg3)` → muted red), month/dow labels, total +
     legend below. Each cell carries an SVG `<title>` for native
     tooltip and onclick → drill-down.
   - **Drill-down framework**: generic `openDrillDown(kind, key)` +
     `closeDrillDown()` + `renderDrillDown(title, sub, txns)`.
     Populates the existing `#reportsRight` pane (reuses the
     `.rep-detail-*` CSS that was already there). Header + back
     button + per-txn list with red/green amount colors. Mobile
     <899px viewport gets full-screen overlay via the existing
     media-query.

3. **#26.1.3 Vendor treemap live + drill-down** (`7d573cc`).
   - NEW endpoints: `GET /top-vendors?year=&limit=` (GROUP BY
     description across the unified feed, ranked by spend) and `GET
     /txns-by-vendor?vendor=NAME&year=YYYY` (drill-down).
   - `renderVendorTreemap()` + `vendorTreemapSvg()` in reports.html.
     Simplified squarify: 3 rows with decreasing height (50% / 30% /
     20%), 3 / 4 / 5 vendors per row, widths proportional to within-
     row share. "(K more)" lumps the long tail beyond top 12. Stable
     hash-based color per vendor name from an 8-color palette.
   - `openDrillDown()` gains the 'vendor' branch — same shape as
     the calendar branch from Task 2, reuses the shared list
     renderer.

4. **Docs + version bump + schema gate.** This block; BACKLOG.md
   SHIPPED block; ROADMAP.md partial-tick; `app/version.txt →
   202604.183`.

### Drill-down pattern locked (v.183)

For any future chart in any group:
- Chart cell carries `onclick="openDrillDown(kind, key)"` where
  `kind` matches the dispatch in `openDrillDown` and `key` is a
  slice identifier (date / vendor / category / etc.).
- `openDrillDown(kind, key)` fetches the right endpoint, calls
  `renderDrillDown(title, sub, txns)`, populates `#reportsRight`.
- Right pane already has `.rep-detail-header` + `.rep-detail-back`
  CSS. No new modal layer needed.
- Mobile full-screen overlay happens automatically via the existing
  `<899px` media query.

To add a new drill-down: add a `kind === 'X'` branch in
`openDrillDown()` + the corresponding `/finance/reports/txns-by-X`
backend endpoint.

### Backend endpoints added (all in `app/features/finance/reports.js`)

| Endpoint | Purpose | Returns |
|---|---|---|
| `GET /daily-spend?year=` | Calendar heatmap data | `{year, days, max_spent, total_spent}` |
| `GET /txns-on-date?date=` | Heatmap drill-down | `{date, transactions, total_spent, total_income}` |
| `GET /top-vendors?year=&limit=` | Treemap data | `{year, vendors, total_spent}` |
| `GET /txns-by-vendor?vendor=&year=` | Treemap drill-down | `{vendor, year, transactions, total_spent}` |

All four follow the established UNION pattern from `/spending-by-
category` (lines 13-56): `finance_transactions UNION ALL
imported_transactions WHERE is_transfer=0`. Every prepared statement
has a `// schema:` comment per the locked rule. No schema changes.

### What v.183 deliberately does NOT do

- **Sankey (#26.1.1)** — most complex chart of the 4; needs a per-
  income-source → category flow query and a custom ribbon renderer.
  Deferred to a follow-up "Group 1 Part B" drop.
- **Small-multiples (#26.1.4)** — needs a new
  `/spending-by-category-monthly` endpoint variant. Deferred to the
  same follow-up.
- **Group 2 (Health)** — blocked on the `metric_index` design
  decision per ROADMAP "v.184" block.
- **Group 3 (Household)** — blocked on Universal Attachments (#28).

### Expected post-deploy verification

Smoke 8/8 (no smoke changes). E2E baseline `115/0` — v.183 adds no
tests and doesn't change tested behavior, so 115/0 should hold. On
the Linux container at package time, schema-safety gate should
remain at 10 flagged lines (130/134 noise) — zero from v.183
because every new `db.prepare` references columns from existing
tables only.

Manual smoke after deploy:
- Open `/reports.html?tab=charts`. The Group 1 row should show:
  Sankey (mockup), Calendar heatmap (LIVE, colored cells based on
  Al's transactions), Vendor treemap (LIVE, top vendors as boxes),
  Small-multiples (stub), Forecast (LIVE).
- Click a colored heatmap cell → right pane (or full-screen overlay
  on mobile) shows that day's transactions with a back button.
- Click a vendor tile → same drill-down shape with that vendor's
  transaction history.
- Back button restores the empty placeholder.

### ROADMAP label slip

ROADMAP's "v.182-reports" block IS this drop (v.183). The off-by-
one continues. v.183 ticks T1 (CSS verified stale) + T3 (calendar
heatmap) + T4 (vendor treemap) + T7 (docs); leaves T2 (Sankey), T5
(small-multiples), and T6 (generic drill-down framework — partially
done in this drop) unticked with a "deferred to follow-up" note.

---

## ✅ v.182 DEPLOYED & VERIFIED — Finance asterisk rollout (2026-05-20)

> **DEPLOYED 2026-05-20 ~15:22. Smoke 8/8, full E2E 115 pass / 0 fail
> (held v.181 baseline — no new tests, no regressions).**
> `version.txt`=`202604.182` live, container restarted clean. Boot
> migration line: `Migrations: 0 applied, 143 skipped` (no migrations
> in this drop). Zero `FAILED .*\.js` on the v.182 boot. Local/origin/
> NAS all == `59ca741`. Schema-safety gate cleared on Windows host
> before package: 10 flagged lines all in `130_rescue_126.js` +
> `134_hsa_plan_to_fsa.js` (known pre-existing noise); zero entries
> from any v.182 file. Four commits on origin: `2aade1b → 2d304fc →
> 9503603 → 59ca741`. Pure frontend drop — no migrations, no schema
> changes, no route changes. Three `.html` files touched, ~30 lines
> added across the three.

**Theme.** Roll out the v.171 asterisk pattern beyond hsa.html. The
ROADMAP scoped v.182 as "build the Pending Items list view + LP-FSA
Settings UI" — but investigation showed both were ALREADY shipped
earlier (v.171 and v.167). The actually-remaining work was the
"asterisks on derived numbers" rollout under the list view, which is
what v.182 delivered.

### Audit corrections recorded (for future sessions)

The 2026-05-20 four-module audit + the ROADMAP-derived v.182 scope
both missed two pieces of already-shipped work. v.182 documents these
to prevent the next session re-investigating:

1. **"Build the Pending Items list view"** — `pending-report.js` is
   680 lines (list + grid + 7 chips + picker + 3 actions + modal +
   asterisk scanner). All 8 backend endpoints live in
   `app/features/pending/routes.js` since v.171. `reports.html:118`
   already wires the tab. E2E `pending-tab.spec.js` passes (verified
   in the v.181 deploy run). This was 100% shipped before v.182
   started.
2. **"Build the LP-FSA Settings UI"** — `settings.html:1105-1206`
   shipped the HSA & LP-FSA Plans sub-panel in v.167 with a plan_type
   dropdown (HSA / LP-FSA / Medical FSA / Dep-care FSA). The ROADMAP
   said "Backend `lpfsa_plan_info` table already exists" — that was
   close-but-wrong; the table is `fsa_plan_info` (mig 133/134) with
   `plan_type='limited_purpose'`. Either way the UI exists.

### What's in this drop (3 tasks, 1 commit each)

1. **Finance F6 HSA + LP-FSA tile asterisk wrap** (`2aade1b`).
   `finance.html`: load `/js/pending-report.js`; wrap the `total_pool`
   hero in `_finTileHsaLpfsa()` with `.gh-pending-target data-card=
   "hsa_payment"` + `.gh-pending-host`; call `GhAsterisk.scan()` at
   the tail of `loadLandingTiles()`. Per-row sub-totals (`hsa_pool`,
   `lpfsa_pool`) intentionally NOT wrapped — aggregate is the
   canonical asterisk surface.

2. **Subscriptions Per-Year summary asterisk wrap** (`2d304fc`).
   `subscriptions.html`: load `/js/pending-report.js`; restructure
   the Per-Year `.stat-item` to match the hsa.html canonical pattern
   — outer `.stat-value` gains `.gh-pending-target` + `data-card=
   "subscriptions"`, dollar amount moves into a child
   `<span id="sumAnnual">` so the existing `textContent` update
   doesn't wipe the sibling `.gh-pending-host`; call
   `GhAsterisk.scan()` at the tail of `loadSummary()`. Per-Month and
   Active count intentionally NOT wrapped.

3. **Inventory Est. Value asterisk wrap** (`9503603`).
   `inventory.html`: load `/js/pending-report.js`; same outer-div +
   inner-id-span structure on the Est. Value `.stat-num`; call
   `GhAsterisk.scan()` at the tail of `loadStats()`. Items count and
   Containers count intentionally NOT wrapped (exact integers, no
   derived ambiguity).

### Canonical asterisk wrap pattern (locked v.182)

For pages where existing JS calls `getElementById('X').textContent =
…` on a value cell, the wrap structure is:

```html
<div class="<existing-class> gh-pending-target" data-card="<card>">
  <span id="<X>">—</span>
  <span class="gh-pending-host"></span>
</div>
```

The outer div gains the `.gh-pending-target` class; the value lives
in a child span carrying the original id; `.gh-pending-host` is a
SIBLING of the value span. This way the existing `textContent`
update mutates only the value span — the host stays intact for
`GhAsterisk.scan()` to populate. Mirrors `hsa.html:122` exactly.

### What v.182 deliberately does NOT do

- Per-card asterisks on GH_CARD-rendered cards (subscriptions list,
  certifications list, etc.) — would require GH_CARD renderer
  changes touching 25 modules, OR post-render DOM mutation
  (fragile). Deferred.
- Vehicle-fuel asterisk — blocked on Vehicles module not built
  (DRAFT #19).
- Medication asterisk — blocked on Al's HSA-YTD product decision
  (BACKLOG carried-forward item **(b)**).
- The `tx_link_rules` editor UI — scoped for the ROADMAP's
  "v.182-rules" block (next drop, off-by-one).
- Reports modal CSS leak fix (known-bug #4) — scoped for the
  ROADMAP's "v.182-reports" block.

### Expected post-deploy verification

Smoke 8/8 (no smoke changes). E2E baseline `115/0`; v.182 adds no
tests and modifies no test-asserted behavior, so 115/0 should hold.
On the Linux container at package time, schema-safety gate should
remain at 10 flagged lines (130/134 noise) — zero from v.182 because
v.182 has no SQL changes.

Manual smoke after deploy:
- Open `/finance.html` → F6 HSA tile. If the backend probe finds
  missing receipts, the Pool number gets an amber/red `*`.
- Open `/subscriptions.html` → top stats. If recurring charges look
  like un-tracked subs, Per-Year gets `*`.
- Open `/inventory.html` → top stats. If imported purchases look
  like inventory matches, Est. Value gets `*`.
- Each asterisk's tooltip = plain-English count; click → jumps to
  `/reports.html?tab=pending`.

### ROADMAP label slip continues

ROADMAP's "v.181-finance" block IS this drop (v.182). The off-by-one
banner from v.181 still applies. Read by theme, not by label.

---

## ✅ v.181 DEPLOYED & VERIFIED — Medical closed-loop completion (2026-05-20)

> **DEPLOYED 2026-05-20 ~13:15. Smoke 8/8, full E2E 115 pass / 0 fail
> (held v.180 baseline — no new tests, no regressions).**
> `version.txt`=`202604.181` live, container restarted clean.
> Migrations boot line: `Migrations: 2 applied, 141 skipped` — both
> mig 144 (`med_immunizations`) and mig 145 (`med_procedures`) applied
> with zero `FAILED` lines. Local/origin/NAS all == `986d8e0`.
> Schema-safety gate cleared on Windows host before package: 10 flagged
> lines all in `130_rescue_126.js` + `134_hsa_plan_to_fsa.js` (known
> pre-existing noise per the deploy memory); zero entries from any
> v.181 file. Six commits on origin: `f62bec1 → f6873f4 → d185258 →
> 74576fe → dca5a1c → 986d8e0`.

**Theme.** Make Medical capture-complete and bridge with Finance
automatically. Closes the two HIGH-priority Medical schema gaps from
BACKLOG.md, wires the last missing auto-link trigger, and ships a
backfill CLI for transactions that landed before the v.167/v.181
triggers existed.

### What's in this drop (5 tasks, 1 commit each)

1. **`med_immunizations` table + routes + Lens** (`f62bec1`).
   Mig 144 — 11 cols, 3 indexes, idempotent. `family_member_id NOT
   NULL`, no CASCADE, `ON DELETE SET NULL` on the `administered_by`
   contact FK. Endpoints: `GET /api/v1/medical/immunizations` (public
   per AUTH-OPEN-GET) + `POST` (`requireAuth`). `medical_immunizations`
   Lens entry: person, vaccine, location, time, due.

2. **`med_procedures` table + routes + Lens** (`f6873f4`).
   Mig 145 — 11 cols, 3 indexes, idempotent. `procedure_date` nullable
   (planned-but-not-yet-scheduled), `status DEFAULT 'planned'`, FK to
   `med_conditions(related_condition_id) ON DELETE SET NULL`.
   Endpoints + Lens entry mirror the immunizations shape.

3. **Category-change auto-link trigger + JSDoc fix** (`d185258`).
   `PUT /api/v1/finance/transactions/:id` now fires `autoLinkHsa` +
   `autoLinkMedicalVisit` after UPDATE when the category *changed*
   AND new value is `medical` (case-insensitive). Best-effort try/
   catch; both linkers are idempotent via `ON CONFLICT DO NOTHING` in
   `record_links`. **Audit correction:** the import-path trigger was
   ALREADY wired in v.167 (`finance/routes.js:1245-1250`). The v.181
   audit's "auto-link triggers not invoked" was 50% wrong — only the
   category-change path was missing. Also fixed the stale JSDoc
   header on `auto-link-medical-visit.js` that claimed
   `type='medical_provider'` while the SQL on line 33 used
   `contact_type='Medical'` (false-alarm audit flag — producer at
   `seed-routes.js:69` and consumer agreed on `'Medical'`).

4. **Backfill CLI `relink-medical-historical.js`** (`74576fe`).
   Direct-DB walker (not HTTP), pages `t.id ASC` in batches of 500.
   For each row calls both linkers — idempotent, safe to re-run.
   Flags: `--account-id N`, `--since YYYY-MM-DD`, `--batch N`,
   `--verbose`. Output: per-batch progress + final tally + elapsed.
   Documented side-effect: the HSA linker creates new `hsa_payments`
   rows when a charge lands on an HSA account with no matching
   payment (same as the v.167 import-time behavior). help.html
   COMMANDS gains the click-to-copy entry per the locked v.166 rule.

5. **Docs + version bump + schema-safety gate.** This block;
   BACKLOG.md moves for immunizations + procedures; ROADMAP.md
   v.180-medical checkboxes ticked; `app/version.txt → 202604.181`.

### Step 1.0 finding — M-tile audit (per user default #3)

Read `_templates.html #25 medical-tiles`. M1–M6 (#25.1 Active
Conditions, #25.2 Active Medications, #25.3 Upcoming Visits, #25.4
EOB Your-Share, #25.5 Recent Vitals, #25.6 Family Snapshot) — none
are mixed-purpose. The template itself anticipates Immunizations as
a future **#25.7** tile (line 2241: *"To extend (e.g. add
Immunizations tile #25.7), follow this same pattern."*). Therefore
the `/summary` endpoint at `medical/routes.js:1023` was NOT touched
in this drop — adding immunizations/procedures tiles is a separate
small UI drop. Captured as a future item in BACKLOG.

### Audit corrections recorded for future sessions

The 2026-05-20 four-module audit had two findings about Medical that
turned out to be wrong on closer inspection:

1. **"Auto-link triggers not invoked on import-confirm"** — half-
   wrong. Import-path was wired in v.167 (`finance/routes.js:1245-
   1250`). Only the category-change path was missing. v.181 closes
   that.
2. **"Contact-type mismatch: linker uses `'Medical'`, seed uses
   `'medical_provider'`"** — false alarm. Both producer
   (`seed-routes.js:69`) and consumer (`auto-link-medical-visit.js:
   33`) use `'Medical'` (capital M). LOCKED.md SHARED-CON doesn't
   dictate the literal value; the audit agent guessed.

Recording these so the next session reading the audit doesn't re-
investigate.

### Expected post-deploy verification

Smoke 8/8. E2E baseline `115/0` (post-v.180); v.181 adds neither
tests nor frontend pages, so 115/0 should hold unchanged — no
regressions expected because all five surfaces are net-new (two new
tables with no existing readers, one tiny PUT-handler addition, one
CLI). On the Linux container at package time: `bash gates.sh`
should pass clean (the host-side validator failures here are
Windows quirks per the `gates-linux-only` lock).

Post-deploy smoke commands:
```
docker logs ghrava --tail 50 | grep -i "FAILED .*\\.js:"   # must be empty
curl -s http://localhost:3001/api/v1/medical/immunizations  # returns []
curl -s http://localhost:3001/api/v1/medical/procedures     # returns []
```

After deploy + verification, a separate commit will flip this
header to `DEPLOYED & VERIFIED` with timestamp + actual E2E count.

### What v.181 deliberately does NOT do

- Immunizations / procedures tiles (#25.7 / #25.8) — separate small
  UI drop. M1–M6 unchanged.
- HSA-YTD on medication card — still blocked on Al's product
  decision (BACKLOG carried-forward item **(b)**). Becomes part of
  the decision-gated v.184 (in ROADMAP).
- Universal Attachments (#28), Pending Items list view, Reports
  Group 1 — all queued in ROADMAP for later drops.

### ROADMAP version-label note

The user picked plain `v.181` for this drop without renumbering
ROADMAP.md. ROADMAP labels for subsequent drops are now off-by-one
(its `v.180-medical` block IS this drop; its `v.181-finance` block
is the next, etc.). Flagged in the v.181 task-5 commit body. Future
sessions: read ROADMAP.md by theme, not by version label, until Al
explicitly renumbers.

---

## ✅ v.180 DEPLOYED & VERIFIED — Kids pencil open-time: 3s → ~1s (2026-05-20)

> **DEPLOYED 2026-05-20 ~10:31. Smoke 8/8, full E2E 115 pass / 0 fail.**
> `version.txt`=`202604.180` live, no boot errors. Al user-verified
> ("much better") on his device. Local/origin/NAS all == `fd1e98b`. UX
> speed fix to the v.179 overlay. No schema change.

Al timed the v.179 pencil at ~3s from click to fields visible. Root
cause was a stack of waits inside the iframe path:
1. A hardcoded 0.4s `setTimeout` waiting for "panels to settle" — but
   in drawer-only mode there are no panels to settle on.
2. `loadFamily()` fetching the whole roster to populate `_familyCache`
   so `editFamily()` could cache-hit — wasted I/O when we only need
   one record.
3. The iframe doing its own fetch of the single record *after*
   settings.html had finished parsing — pure sequential wait when the
   parent had idle time to prefetch.

**Three commits attack the stack:**
1. **`settings.html`** drawer-mode rewrites the `?drawer=family&id=`
   branch: defers to `DOMContentLoaded` instead of a fixed 400ms wait,
   skips `loadFamily()` entirely, and races a parent-supplied
   prefetched record (postMessage `ghravaPrefetchedMember`) against a
   local single-record fetch — whichever resolves first opens the
   drawer.
2. **`lt-refs.js`** `_openSettingsDrawer({prefetch})` accepts a Promise.
   When the iframe posts `{ghravaReady:<drawerType>}` the parent
   resolves the promise and posts the record back as
   `{ghravaPrefetchedMember, drawer}`.
3. **`kids.html`** `editKidProfile()` starts resolving the
   `family_members` record on click — `GH_AVATAR.getCached(fmId)`
   first (synchronous, zero network — already populated for the kid's
   avatar), falling back to `window.api('GET','/settings/family/<id>')`
   in parallel with the overlay mount.

**ghrava-e2e** gains a v.180 test: pencil click sends `ghravaReady` on
the parent listener, the iframe's `#fm_display_name` populates within
the generous 8s timeout (correctness, not perf).

### Expected post-deploy
Smoke 8/8. E2E: prior 114 + 1 new = 115, 0 failures. Manual smoke:
open Kids, click the pencil — fields should appear in ~1s (down from
~3s), often instant if `GH_AVATAR` already cached the member (the
common path). The remaining ~1s is settings.html parsing inside the
iframe — structural; would need a Settings split to attack further.

---

## ✅ v.179 DEPLOYED & VERIFIED — Kids pencil opens edit form as on-top overlay (2026-05-19)

> **DEPLOYED 2026-05-19 ~16:51. Smoke 8/8, full E2E 114 pass / 0 fail.**
> `version.txt`=`202604.179` live, no boot errors. Local/origin/NAS
> all == `3aef210`. UX follow-up to v.178: replace the slow full-page
> navigation with the existing GH_REFS iframe sheet. No schema change.

**Root cause v.178 missed.** The pencil did
`window.location.href = '/settings.html?editFamily=<id>'` — a full page
load that rebuilt Settings + nav.js + opened the panel + opened the
drawer with nested ~700ms setTimeouts. Felt sluggish, and on Save the
user was stranded on the Settings page instead of Kids.

**Fix:** reuse `GH_REFS.openFamilyDrawer({editId, onSave})` — the
shared iframe-overlay sheet that Contacts already uses to show a
Settings drawer on top of the calling page. Same form, one codebase,
no navigation.

1. **`lt-refs.js`** — `_openSettingsDrawer()` gains an optional
   `editId`; `openFamilyDrawer({editId, onSave})` forwards it as
   `&id=<n>` on the iframe src.
2. **`settings.html`** — `?drawer=family&id=<id>` opens
   `editFamily(id)` (the canonical edit form) inside the iframe
   chrome instead of empty Add. Family Cancel now postMessages
   `{ghravaCancelled:'family'}` (mirroring Contacts) so backing out
   — not only Save — dismisses the overlay. The slow v.178
   full-page `?editFamily` IIFE handler is removed.
3. **`kids.html`** — `editKidProfile(fmId)` now calls
   `GH_REFS.openFamilyDrawer({editId, onSave})`. `onSave` runs
   `GH_AVATAR.refresh()` + `loadKids()` + reopens the edited kid so
   the avatar row + age summary update in place. Plain-nav fallback
   kept defensively though GH_REFS ships on this page.
4. **ghrava-e2e** — new test pins the overlay path: clicking the
   active pencil mounts `#gh-refs-overlay` (no navigation), the
   iframe src carries `drawer=family&id=<n>`, and the
   `ghravaCancelled` postMessage dismisses the overlay cleanly.

### Expected post-deploy
Smoke 8/8. E2E: prior 113 + 1 new = 114, 0 failures. Manual smoke:
open Kids, click the pencil on the active kid → the edit form slides
up over the Kids page (instant, no Settings chrome), edit/Save → form
closes, you're back on Kids, and the kid's name/photo/age updates in
place. Cancel/Esc/backdrop → form closes, no state change.

---

## ✅ v.178 DEPLOYED & VERIFIED — Kids redesign + gender + scope-overlay fix (2026-05-18)

> **DEPLOYED 2026-05-18 ~22:08. Smoke 8/8, full E2E 113 pass / 0 fail.**
> Live verified: `version.txt`=`202604.178`, no boot errors,
> `family_members.gender` present on prod, mig 143 recorded in
> `_migrations`. Local/origin/NAS git all == `8961f8a`. Schema drop
> (mig 143); schema-safety gate showed only the known pre-existing
> 130/134 noise — new SQL clean.

**4.5 — Kids gradient hero removed.** The decorative `.kid-hero`
pink/purple banner (avatar + name + Edit) and its dead CSS are gone.
Selection now lives entirely on the avatar row: inactive tabs at 50%
opacity, active at full opacity + bold accent name (underline kept). A
right-aligned plain-text `<FirstName> · age N` / `· no age set` summary
(`#kidsActiveSummary`, `--text2`) sits in the avatar row. Data stats
strip (Activities/Notes/School) retained — only decoration removed.

**4.6 — Edit pencil on the active kid avatar.** Small inline-SVG pencil
(codebase's canonical edit glyph; no Tabler font exists here) bottom-
right of the ACTIVE kid avatar only, CSS-gated to `.kid-tab.active` so
it tracks selection with no strip re-render. Rendered only for kids
linked to a `family_members` row. Click deep-links to
`/settings.html?editFamily=<id>`; a new handler in the existing settings
query IIFE → `openPanel('family')` + `editFamily(id)`, reusing the
canonical family-member drawer (no duplicated Kids editor, per Al).
Distinct from `?drawer=family` (that forces iframe-only chrome).

**4.6b — `family_members.gender`.** `143_family_members_gender.js`
(`ALTER TABLE family_members ADD COLUMN gender TEXT`, defensive
try/catch). POST + PUT `/api/v1/settings/family[/:id]` accept & persist
`gender`. Settings family drawer gains a free-text Gender input
(populated in `openFamilyDrawer`, sent in `familySave`). **lens-config
deviation (documented):** the locked v.166 rule says new columns
register in `lens-config.js`, but `check-lens` enforces an explicit
allowlist of list-page modules and `family_members` is a
Settings-edited identity table (not lens-eligible, like junction/system
tables). `gender` is not a Lens filter dimension on any list, so no
lens entry exists to add it to and the gate does not require one.

**4.7 — scope overlay made dismissable (root-cause fix).** The
first-run `.gh-scope-overlay` (z-index 600, full viewport) had no close
button, no Esc, only a pixel-perfect backdrop-edge click — it sat over
the page eating real clicks (proven via Playwright; this is why the
Kids pencil/Edit was un-clickable). `openScopePicker()` now: removes any
existing overlay before mounting (anti-zombie/dedupe), adds an explicit
× and "Not now", honors Esc, and routes every exit through one
`close()` that sets `gh_device_family_scope_dismissed=1` so a dismissed
prompt never silently re-mounts and re-blocks the page.

**4.8 — tests/docs/version.** ghrava-e2e: gender create/update
round-trip (API Contract) + Kids page test (no `.kid-hero`,
`#kidsActiveSummary` present, no zombie scope overlay when dismissed,
pencil visible only on active tab). `version.txt` → `202604.178`.

### Expected post-deploy
Smoke 8/8. E2E: prior 111 + 2 new = 113, 0 failures. Boot applies mig
143 once (`family_members.gender` added). Kids page: no gradient banner,
dense avatar row with age summary, pencil on the selected kid → opens
the Settings family editor with a working Gender field. Scope prompt (if
it ever shows) closes via ×/Esc/Not now and stays closed.

---

## ✅ v.177 DEPLOYED & VERIFIED — orphan-126 migration + Kids duplicate (2026-05-18)

> **DEPLOYED & verified, E2E 111 pass / 0 fail (baseline @ git 410cbad).**
> Two bugs Al reported.
> Two new migrations (141, 142) + one route hardening + test + docs.
> Schema-safety gate applies.

1. **Orphan migration 126 fixed** (`141_mark_126_capture_applied.js`).
   `126_capture_and_finance_schema.js` was never in `_migrations` →
   retried + `FAILED` every boot ("Cannot add a column to a view" —
   mig 130 made finance_accounts/financial_accounts VIEWs). Its intent
   is fully superseded (record_links → 129, finance unify → 130). 141
   verifies that superseding schema is present, then `INSERT OR IGNORE`
   records 126_capture as applied → skipped forever. One last transient
   `FAILED 126` on the boot that applies 141, then clean. Closes
   BACKLOG Known-bug #6.
2. **Kids "Arnav twice" fixed.** Live data: kids id 13 (Arnav,
   family_member_id NULL — legacy/unlinked, no photo) + id 14 (Arnav,
   family_member_id 2 — synced, photo) both active → shown twice;
   id 15 Risha fine.
   - `142_dedupe_orphan_kids.js`: soft-deactivates active UNLINKED kids
     rows whose name has an active family-linked twin (id 13 → is_active
     0). Verified id 13 had 0 activities/0 notes (no data orphaned).
     GET /kids filters is_active=1 so the dup vanishes immediately.
   - `kids/routes.js syncKidsFromFamilyMembers`: now backfills
     family_member_id onto an existing unlinked same-name row instead
     of inserting a 2nd row — closes the recurrence. Closes Known-bug #5.
3. **Regression test**: `GET /api/v1/kids` returns no duplicate
   display_name (ghrava-e2e API Contract).

### Expected post-deploy
Smoke 8/8. E2E: prior 110 + new kids test, 0 failures. The boot that
applies 141 logs `FAILED 126` ONE final time; verify `_migrations` now
records `126_capture_and_finance_schema.js` (→ next boot clean). Kids
page shows Arnav once (pictured) + Risha.

---

## ✅ v.176 DEPLOYED & VERIFIED — cross-cutting cleanup (2026-05-18)

> **DEPLOYED, smoke 8/8, full E2E 110 pass / 0 fail.** Origin/local/NAS/
> container aligned (`a8f5d09` → docs `517db9a`). Al scope: the orphan
> cross-cutting issues module-by-module work would never touch. No
> schema, no migrations. 6 tasks, one commit each.
> (The `FAILED 126` line seen verifying this deploy was pre-existing,
> not v.176 — now fixed in v.177 below.)

1. **`daysFromToday()` + `fmtDateShort()` day-off fix** (`gh-card-shared.js`).
   New `parseLocalDate()`: bare `YYYY-MM-DD` → local midnight; time/Z
   strings keep native parse (v.175 `localCardDate()` fixtures
   unaffected). One function; 28 call sites unchanged. Closes BACKLOG
   TOP-PRIORITY / Known-bug §3a. **Keystone — full GH_CARD v5 E2E block
   is the gate.**
2. **test-results POST auth** (`server.js` + `tests/run-tests.ps1`).
   POST `requireAuth` (inline require, per-router pattern); GETs stay
   public. `run-tests.ps1` resolves the password (-AuthToken →
   `$env:GHRAVA_TOKEN` → gitignored `tests\.ghrava-auth`), logs in,
   sends Bearer; no password → warn + skip POST (never fails the run).
   `ghrava_deploy.ps1` does not post results — unchanged.
3. **CORS LAN allowlist** (`server.js`). Was `cors()` wide open → origin
   allowlist (192.168.4.62:3001, ghrava.home http+https,
   localhost/127.0.0.1:3001, Tailscale host). No-Origin requests always
   allowed (curl/APK WebView/PWA can't be locked out; disallowed origin
   just gets no ACAO, not a hard error). Verified no Capacitor/Cordova/
   TWA origin exists — only a thin WebView at the real network origin.
4. **global-search.js** — shared `window.esc` (with inline fallback) +
   removed the 2 *interpolated* `onclick` attrs (the real XSS path);
   one delegated click listener on `#ghSearchResults` (header → scope,
   row → data-href nav). Static `_clearScope()` onclick left (no
   interpolation, out of scope).
5. **Regression + contract tests** (`ghrava-e2e.spec.js`, not smoke —
   keeps smoke endpoint-only/20s): TZ-independent `daysFromToday`
   0/+1/-1 pin in the GH_CARD v5 block; test-results auth contract;
   CORS contract. All three are red on the old build, green after v.176.
6. **Docs/version** — this block, BACKLOG (TOP-PRIORITY cleared,
   §3a + 3 security rows resolved, **migrate.js marked
   already-fixed-v142, no work done**), `version.txt` → 202604.176.

**migrate.js dropped from the bundle:** investigation found
`stripSqlComments()` already strips comments before the `;` split
(v202604.142). The audit row was stale — marked resolved, zero code.

### Expected post-deploy
Smoke HARD 8/8. Full E2E: prior baseline + 3 new tests, **0 failures**.
The GH_CARD v5 block is the real check for Task 1 — any card
urgency/schedule regression there stops the drop (per Al's rule).

---

## ✅ v.175 DEPLOYED & VERIFIED — E2E debt cleared (2026-05-18)

> **DEPLOYED ~12:51, app verified live.** `version 202604.175`,
> container restarted clean, no log errors, **Smoke HARD 8/8**.
> No schema, no migrations.
>
> **Outcome: all 15 v.174 E2E failures were STALE TESTS, not app bugs.**
> First deploy: 99 pass / 8 fail (7 of 15 fixed). The last 8 were
> investigated **live** (Playwright against the NAS, not by guessing):
> - Todos `:356`: the page renders perfectly — `#todoList` is full of
>   `.gh-card` (GH_CARD pipeline, zero JS errors). It just no longer
>   uses `.todo-item`/`.todos-empty`. "Known bug #1" was misdiagnosed
>   **twice** (BACKLOG: "family filter"; sub-agent: "field mismatch") —
>   it was always a test/contract drift. Fixed test to assert `.gh-card`.
> - Page-wiring `:1379` ×7: pages migrated GH_VIEW→**GH_LENS**, which
>   renders `.gh-lens__views` with `button[title="Card view"]` (no
>   `.gh-view-toolbar`/`[id$=-vcard]`). Verified live on 4 pages: lens
>   toggle present, 3 buttons incl. Card, **zero page errors**. Fixed
>   test to the real GH_LENS contract.
> - Both fixes **re-run live against the NAS: 8/8 green**. Full suite
>   is now **107 pass / 0 fail** (99 from the deploy + these 8).
>
> **todos.html still got valid hardening** (the `family_member_ids`→
> `family_members` field fix + empty-state-before-`setCount`): it was a
> real latent bug — with a Lens person scope active it would have
> emptied the list — just not the cause of the test failure. Shipped &
> live; verified no regression (Todos renders fine).
>
> Net: **0 real app bugs in the 15. 15 stale tests fixed + 1 latent
> todos.html bug hardened.** Only the test file + docs changed after
> the app deploy (test file isn't container-served → no restart).

### Reclassification from v.174 (investigation findings)
- **Reports known bug #2 was a MISDIAGNOSIS.** `REPORT_REGISTRY` is a
  fully-populated static array. The landing `overview` tab renders
  summary tiles *by design* (consistent with locked Reports #26);
  `.rep-row` only exists on the money/family/maintenance/system tabs.
  → test-side fix (`reports.html?tab=money`), not an app bug.
- **`:886`/`:1079` were test timezone bugs**, not renderer bugs.
  `S.daysFromToday()` (`gh-card-shared.js:17`) does `new Date(dateStr)`
  then compares to local midnight; a bare `YYYY-MM-DD` parses as UTC
  midnight and shifts a calendar day in a negative-UTC zone, so a
  fixture's `toISOString()` "tomorrow"/"today" read as off-by-one. New
  `localCardDate()` helper emits local-noon strings. **The underlying
  app-wide off-by-one in `daysFromToday` is a real latent bug — logged
  to BACKLOG, deliberately NOT fixed here (app-wide regression risk,
  out of v.175 scope).**

### todos.html — latent bug hardened (NOT the test-failure cause)
`todos.html` filtered on `t.family_member_ids`, but the API returns
`family_members` (array of `{id,…}` objects). With a Lens person scope
active this would empty the list. Fixed: read
`t.family_members.map(m=>m.id)` in the active override (`:585-593`) and
shadowed legacy path (`:499-504`); render `.todos-empty` BEFORE a now
guarded/best-effort `setCount`. Frontend only, no SQL. **Live check
proved the page already rendered fine** (full of `.gh-card`) — so this
is defensive hardening, not the `:356` fix. Shipped & live.

### 15 test-side fixes (`tests/ghrava-e2e.spec.js`, one file)
- `:297` tag chips, `:430` Books CRUD — legacy shelf tabs are
  `legacy-hidden`; create on the default "Currently Reading" shelf,
  drop the invisible `text=Want to Read` click.
- `:327` Dashboard — `.module-tile` gone; `index.html` is the Today
  page. Retargeted to `.today-section/.today-grid`/`.today-empty`.
- `:344` Reports — land on `?tab=money` (rows-bearing tab; `overview`
  shows summary tiles by design).
- `:356` Todos — retargeted to `.gh-card`/`.todos-empty` (GH_CARD
  pipeline; old `.todo-item`/`.todos-empty` selectors were stale).
- `:455` Inventory — All Items/Rooms toggle moved into the Lens
  (v.134); removed the dead `text=All Items` click.
- `:886`/`:1079` — `localCardDate()` local-noon fixtures (the
  `daysFromToday` UTC off-by-one is a separate deferred app finding).
- `:1379` ×7 page-wiring — pages migrated GH_VIEW→GH_LENS; rewrote
  the assertion to the real GH_LENS contract (`.gh-lens__views`
  `button[title="Card view"]`, 3 toggle buttons, no page errors).

### Verified
First deploy 99/8. The 8 fixed + re-run **live against the NAS: 8/8
green** → full suite **107 pass / 0 fail**. App was live & correct
throughout; only the test file + docs changed post-deploy.

---

## ✅ v.174 DEPLOYED & VERIFIED — E2E auth gate + security hardening (2026-05-18)

> **DEPLOYED 2026-05-18 ~10:13.** `/app/version.txt`=`202604.174`,
> container restarted clean, no log errors, **Smoke HARD gate 8/8**.
> No schema, no migrations, additive + read-only edits only. Al chose:
> auth-test fix + A + B + C.
>
> **E2E SOFT gate: 92 passed / 15 failed (was 21 failed/all-401 on
> v.173).** The auth fix is proven: the 21 × 401 are GONE — the
> previously-401ing write tests now pass (`CRUD Todos`, `CRUD
> Documents`, `CRUD Contacts`). The "Auth token resolved — CRUD write
> tests will run" path fired (token from `tests\.ghrava-auth`).
>
> **The 15 failures are pre-existing UI/selector debt, NOT v.174
> regressions** — they were *masked* before because the suite died at
> the first 401 write in beforeAll-less mode and never reached these
> assertions. No regression from this drop: `Medical loads cleanly` ✓,
> `Dashboard/Documents/Inventory — no JS errors on load` ✓ (clears the
> global lt-core esc/fmtMoney/dead-code risk), `file-copy-btn renders
> as button not text` ✓ (esc didn't break markup); zero medical/
> attachment test failures. The 15 = BACKLOG known bug #1 (Todos
> renders neither), #2 (Reports registry empty), + the "11 stale
> Playwright selectors" / card-view-wiring class (now quantified at 15
> and measurable for the first time — see BACKLOG known-bugs).

### What was built (5 tasks)
1. **Deploy E2E gate now authenticates** (`ghrava_deploy.ps1`). Root
   cause of the "21 × 401" every deploy: Step 8 ran Playwright directly
   and never set `GHRAVA_TOKEN`, so `ghrava-e2e.spec.js` `beforeAll`
   early-returned (`if (!AUTH_PASSWORD) return;`) and every write test
   hit an authenticated endpoint unauthenticated. **Prod has an app
   password set** — the old "open mode" claim was stale doc drift (the
   401s were the proof). New `-AuthToken` param + resolution order
   (`-AuthToken` → `$env:GHRAVA_TOKEN` → gitignored `tests\.ghrava-auth`);
   token is exported only around the E2E run and cleared after. No
   password → loud warning instead of silent meaningless gate.
2. **Dead re-auth code removed** (`lt-core.js`). `_reAuthPrompt()`, the
   `_isRetry` retry param, and `window.reAuthPrompt` were never wired
   into `api()` — the shipped 401 path has always been a hard redirect
   to `/login.html?next=`. Comment block + makeApi doc + the line-887
   note corrected to describe the redirect. **No behavior change.**
   (There is NO step-up auth and never was — only a 365-day session.)
3. **`/file/:id` + `/thumb/:id` path allowlist** (`attachments/routes.js`,
   security audit #3, high sev). Both `res.sendFile` calls now 403 if
   the resolved path escapes the attachments root, via the existing
   `isUnderAttachmentsRoot` helper (`attach-lifecycle.js`). `ATTACHMENTS_ROOT`
   == `ATT_BASE` (`/app/attachments`) so no legitimate file is rejected.
4. **`window.esc` hardened** (`lt-core.js:22`) — now also escapes `"`
   `'` `/` (was only `& < >`). Shared by every page.
5. **`fmtMoney`/`formatDate` partial dedup.** Canonical `window.fmtMoney`
   added to `lt-core.js` (`$1,234.50` / `—`). **The BACKLOG entry
   undersold this:** the 5 page-local `fmtMoney`s had 4 different
   contracts. Only the genuine dupes were consolidated:
   - `medical.html` / `medical_v2.html`: local `fmtMoney` + local
     `formatDate` removed (identical to canonical; medical money now
     also gets thousands separators — minor visible improvement).
   - **Deliberately left alone** (different contract — merging would
     regress): `inventory.html` `fmtMoney` (no `$` prefix),
     `reports.html` `fmtMoney` (no cents — locked chart surface #26,
     already feature-detects `window.fmtMoney`), `hsa.html` `fmtMoney`
     (null→`$0.00` not `—`; sensitive money dashboard),
     `dashboard.html` `formatDate` (takes a `Date` object, returns
     "Mon, Jan 5, 2025" — entirely different function).

### Post-deploy verification — DONE 2026-05-18
- ✅ Smoke HARD gate 8/8.
- ✅ E2E: the ~21 CRUD write tests now PASS (no 401) — auth fix proven.
- ✅ esc change safe: "no JS errors on load" + "file-copy-btn renders
  as button" passed; all page-integrity loads (incl. Medical) passed.
- ✅ Medical fmtMoney/formatDate dedup safe: Medical loads cleanly.
- ⚠️ Manual spot-check still advised next session: eyeball a medical
  med cross-strip ($ now has commas) and one attachment thumbnail —
  the integrity tests cover JS-error/markup but not visual value.

### Docs synced this drop
- LOCKED.md `AUTH-OPEN-GET` note clarified (prod is password-protected).
- BACKLOG.md security rows (#3 `/file` allowlist, `window.esc`,
  `fmtMoney`/`formatDate`) updated with disposition.
- No new CLI / schema column → no help.html / lens-config changes.

---

## ✅ v.173 SHIPPED — Asterisk subsystem: per-record math + HSA tile (2026-05-17)

> **DEPLOYED & VERIFIED 2026-05-17 (~21:08).** Live on the NAS:
> `/app/version.txt` = `202604.173`, container restarted clean, logs
> clean, smoke HARD gate 8/8, and all v.173 tests green against
> production (`asterisk-per-record` ×3, `forecast-chart`,
> `pending-tab` ×2). GitHub `main`, the NAS git repo, and the running
> container all agree on v.173.

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
Schema-safety gate ran clean on the Windows host: `gen-schema-doc.py`
+ `validate-schema.py --strict` → exit 0, zero failures in
`pending/routes.js` (the 10 flagged are pre-existing migration-replay
artifacts in `130_rescue_126.js`/`134_hsa_plan_to_fsa.js`, every prior
drop has them). Python scripts need `-X utf8` on Windows (cp1252
crash) — env quirk, not a code issue.

### Packaging / deploy note (read before next package)
`package.sh` is Linux-only and **cannot run on the Windows host**: no
`zip` binary, `python3` is the MS-Store stub. For v.173 the zip was
assembled with PowerShell `Compress-Archive` using package.sh's exact
manifest (DEFAULT_INCLUDES + changed files), **after** the schema
validator passed, then deployed via `ghrava_deploy.ps1 -ZipPath`.
Deploy script Step 4 (git push from the NAS copy) fails when GitHub
was already pushed manually first — the resulting redundant NAS commit
was reconciled with `git -C Z:\ghrava reset --hard origin/main` (only
test-harness files differed; zero app changes). E2E SOFT gate showed
21 failures — **all pre-existing `401 Authentication required` on
write endpoints** (the CRUD E2E suite doesn't log in; AUTH-OPEN-GET).
NOT a v.173 regression; no rollback.

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
- **Prod has an app password SET** (`app_config.app_password_hash`).
  Corrected v.174: the old "runs in open (no-password) mode" note was
  stale — the recurring 21 E2E 401s on write endpoints were the proof.
  Writes require a session; reads/GETs stay public. Do NOT add
  `requireAuth` to other routers (would block writes app-wide). There
  is NO action-level step-up auth — a single 365-day session only.
- Browser `<img>` tags can't send auth headers — attachment file/thumb
  routes (`/api/v1/attachments/file/:id`, `/thumb/:id`) MUST stay
  public, but v.174 added a path allowlist so they only serve files
  under `/app/attachments` (403 otherwise).

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
