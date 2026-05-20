# ROADMAP.md — Finance / Medical / Inventory / Reports finish-out

> **Temporary tracking file.** Created 2026-05-20 to track the v.180–v.184 multi-drop arc that closes out the four audited modules. **Delete this file** once every checkbox below is ticked and the corresponding work is DEPLOYED & VERIFIED on NAS.
>
> Sources behind this plan: the 2026-05-20 four-module audit (Finance / Medical / Inventory / Reports) and Al's roadmap message of the same date.
>
> Inventory module is intentionally absent from the build queue — the audit concluded it is single-module complete and gets no v.180–v.184 scope.

---

## Rules that apply to EVERY drop below

- Plain English in user-facing strings (Core Principle 2).
- Multi-view standard: any listing page wires `GH_VIEW.init` with grid+list minimum (Core Principle 6).
- **No `ON DELETE CASCADE`** ever.
- Every `db.prepare` gets a `// schema:` comment.
- Bundle **3–5 tasks per drop**, no single-task drops (Drop sizing locked 2026-05-17).
- Show Al the plan **before** code in every drop.
- Default for ambiguous design: least code + match existing pattern + document in commit message, don't pause.
- Gates won't run on Windows — that's normal, call it out in commit messages.
- **DO NOT** package a zip — Al will say "package".

---

## v.180 — Medical: closed-loop completion

> **Version note (2026-05-20):** This block shipped as **v.181**, not
> v.180 — v.180 was already taken by the Kids pencil speed drop on the
> same day. The 5 task boxes below are ticked for what landed as v.181.
> Subsequent block labels (v.181 / v.182 / v.183 / v.184) are therefore
> off-by-one. Read by theme, not by the version label, until Al decides
> to renumber. See STATE.md v.181 block for full detail.

**Theme:** Make Medical capture-complete and bridge with Finance automatically.

- [x] **Task 1 — `med_immunizations` table + routes**
  - Migration (additive, no CASCADE, schema comments).
  - Columns: `id, family_member_id, vaccine_name, date_given, dose_number, lot_number, administered_by_contact_id, location_text, next_due_date, notes, created_at`.
  - `POST` / `GET /api/v1/medical/immunizations`.
  - Lens config entry.
  - Add to medical landing summary endpoint if appropriate.
- [x] **Task 2 — `med_procedures` table + routes**
  - Migration (additive, no CASCADE, schema comments).
  - Columns: `id, family_member_id, procedure_name, procedure_date, provider_contact_id, facility_text, procedure_type (elective/scheduled/emergency), status (planned/completed/cancelled), outcome_notes, related_condition_id, created_at`.
  - `POST` / `GET /api/v1/medical/procedures`.
  - Lens config entry.
- [x] **Task 3 — Wire auto-link triggers on transactions**
  - Call `auto-link-medical-visit.js` on transactions import-confirm AND category-change-to-medical.
  - Call `auto-link-hsa.js` on transactions import-confirm where `account_type='HSA'`.
  - Verify the contact-type mismatch flag from the audit (auto-link-medical-visit search predicate vs canonical `contact_type='medical_provider'`). Fix if real.
  - **Investigation result:** Import-path triggers ALREADY wired in v.167 (`finance/routes.js:1245-1250`). Only the category-change path needed adding. Contact-type "mismatch" was a false alarm — both producer (`seed-routes.js:69`) and consumer (`auto-link-medical-visit.js:33`) use `'Medical'` (capital M). Only fixed the stale JSDoc header.
- [x] **Task 4 — Backfill CLI**
  - New script `app/scripts/relink-medical-historical.js`.
  - Walks all past transactions, runs the same auto-linkers.
  - Idempotent (skip if `record_links` row already exists for that pair).
  - Add to `help.html` COMMANDS.
- [x] **Task 5 — Docs + version bump** ✅ **DEPLOYED & VERIFIED 2026-05-20 ~13:15 (E2E 115/0, smoke 8/8, mig 144+145 applied clean)**
  - STATE.md v.181 block ✓
  - BACKLOG.md: medical-schema-gaps `immunizations` + `procedures` marked SHIPPED ✓
  - `app/version.txt` → `202604.181` ✓
  - SCHEMA.md regenerated (Task 5b commit `986d8e0`) ✓
  - Deploy + verify ✓

---

## v.181 — Finance: Pending Items list view + LP-FSA Settings UI

> **Version note (2026-05-20):** This block shipped as **v.182**, not
> v.181 — v.181 was the Medical drop. Per the v.181-roadmap-label slip,
> labels here continue to be off-by-one.
>
> **Audit-vs-reality finding (2026-05-20):** Tasks 1 and 2 below were
> ALREADY shipped earlier (v.171 and v.167 respectively) — the original
> ROADMAP entry was written from the audit's view, but a closer look
> showed the work was already on prod and verified by E2E. The actually-
> remaining gap was the **asterisk rollout** sub-item under Task 1 — the
> infrastructure (DOM probe + scanner + endpoint) shipped v.171/v.173,
> but only `hsa.html` consumed it. v.182 wired three more surfaces.

**Theme (as built):** Roll out the v.171 asterisk pattern beyond hsa.html.

- [x] **Task 1 — Pending Items Report list view at `/reports.html?tab=pending`** ✅ **ALREADY SHIPPED v.171** (`app/public/js/pending-report.js` 680 lines; all 8 backend endpoints in `pending/routes.js`; E2E `pending-tab.spec.js` passes). The original ROADMAP entry's "asterisks on derived numbers" sub-item is what v.182 actually closed (see new Task A below).
- [x] **Task 2 — LP-FSA plan info Settings UI** ✅ **ALREADY SHIPPED v.167** (`settings.html:1105-1206` HSA & LP-FSA Plans sub-panel, plan_type dropdown supports HSA / LP-FSA / Medical FSA / Dep-care FSA, backend writes to `fsa_plan_info` keyed by `(year, plan_type)` via `hsa/routes.js`). Note: the ROADMAP entry said "Backend lpfsa_plan_info table already exists" — that was slightly wrong (the table is `fsa_plan_info` with `plan_type='limited_purpose'`), but the UI was nonetheless shipped.
- [x] **Task A — Asterisk rollout (3 cards)** ✅ **SHIPPED v.182**
  - Finance F6 HSA + LP-FSA tile (`finance.html` `_finTileHsaLpfsa()`) — wrap `total_pool` hero in `.gh-pending-target data-card="hsa_payment"`.
  - Subscriptions Per-Year summary (`subscriptions.html` `#sumAnnual`) — wrap in `.gh-pending-target data-card="subscriptions"`.
  - Inventory Est. Value (`inventory.html` `#stValue`) — wrap in `.gh-pending-target data-card="inventory"`.
  - Each page now loads `/js/pending-report.js` and calls `GhAsterisk.scan()` after its values render.
  - Pattern matches the hsa.html canonical example (v.171); inner span keeps the id so existing `textContent` updates don't wipe the sibling `.gh-pending-host`.
- [x] **Task 3 — Docs + version bump** ✅ **DEPLOYED & VERIFIED 2026-05-20 ~15:22 (E2E 115/0, smoke 8/8, no boot errors)**

---

## v.182 — Reports: Group 1 (Money) charts live + CSS modal fix

> **Version note (2026-05-20):** This block shipped (partially) as
> **v.183**, not v.182 — v.182 was the Finance asterisk rollout.
> Off-by-one continues.
>
> **v.183 closed 4 of the 7 tasks** below (T1 CSS-stale + T3 heatmap +
> T4 treemap + T7 docs). T6 drill-down framework is *partially* shipped
> — generic right-pane handler is locked and reused by both T3 and T4,
> but Sankey and small-multiples will need their own `kind` branches
> when they're wired. The remaining 3 tasks (T2 Sankey, T5 small-
> multiples, plus T6 finishing) are deferred to a follow-up "Group 1
> Part B" drop.

**Theme:** Make Reports stop being a placeholder.

- [x] **Task 1 — Fix Reports panels opening as center modals** (BACKLOG known-bug #4) ✅ **RESOLVED v.183 — STALE BUG.** Verified live: no reproduction path in current CSS. `shared.css` has no `.sub-panel` positioning rules; `reports.html` doesn't use the class. BACKLOG row updated with verification notes; no code change needed.
- [ ] **Task 2 — Wire `#26.1.1` Sankey income → categories** — DEFERRED to Group 1 Part B. Most complex chart of the 4; needs per-income-source → category flow query and custom ribbon renderer.
- [x] **Task 3 — Wire `#26.1.2` Calendar heatmap** ✅ **SHIPPED v.183**
  - NEW endpoint `/api/v1/finance/reports/daily-spend?year=`.
  - `renderCalendarHeatmap()` + `calendarHeatmapSvg()` in `reports.html`. GitHub-style 53×7 grid, 5-bucket red ramp, month + day labels, total + legend.
- [x] **Task 4 — Wire `#26.1.3` Vendor treemap** ✅ **SHIPPED v.183**
  - NEW endpoint `/api/v1/finance/reports/top-vendors?year=&limit=`.
  - `renderVendorTreemap()` + `vendorTreemapSvg()` in `reports.html`. Simplified squarify — 3 rows of decreasing height, 3/4/5 vendors per row, proportional widths, stable hash-based color per vendor, "(K more)" tail lump.
- [ ] **Task 5 — Wire `#26.1.4` Category small-multiples** — DEFERRED to Group 1 Part B. Needs a new `/spending-by-category-monthly` endpoint variant.
- [~] **Task 6 — Drill-down on each chart** — **PARTIALLY SHIPPED v.183.** Generic right-pane handler locked: `openDrillDown(kind, key)` + `closeDrillDown()` + `renderDrillDown(title, sub, txns)` in `reports.html`. Reuses existing `.rep-detail-*` CSS. T3 and T4 use it via `kind='calendar'` and `kind='vendor'`. T2 (Sankey) and T5 (small-multiples) will add their own `kind` branches when wired.
- [x] **Task 7 — Docs + version bump** ✅ **SHIPPED v.183** *(awaiting deploy + verify; flip to ✅ DEPLOYED when E2E lands clean on NAS)*

---

## v.183 — Pending Items polish: `tx_link_rules` editor + auto-apply

**Theme:** Make pending items self-healing over time. After Al teaches the system Shell→Honda once, it learns.

- [ ] **Task 1 — `tx_link_rules` editor UI**
  - Table from mig 139 exists, no UI.
  - Settings page or within Pending Items report.
  - CRUD on rules: pattern (merchant text), target (vehicle/subscription/etc), confidence threshold.
- [ ] **Task 2 — Auto-apply rules on import**
  - After import-confirm, run rules against new transactions.
  - If match: auto-create `record_links` row, optionally mark `needs_review=0`.
  - If no match: leave in pending detector.
- [ ] **Task 3 — Backfill button**
  - "Apply rules to historical transactions" button in editor.
  - Same logic as Task 2, walks all past tx.
- [ ] **Task 4 — Docs + version bump**

---

## v.184 — Decision-gated work (timing depends on Al)

Not auto-startable. Each blocks on a product decision from Al **before** the build.

- [ ] **Decision 1 — Medication HSA-YTD on the card**
  - If yes: add back the HSA-YTD `crossRow` to `medical_medications` config + wire the asterisk.
  - If no: retire the dead medv5 legacy renderer.
  - Either way is **small**. Just needs the call.
- [ ] **Decision 2 — Reports Group 2 (Health): `metric_index` design**
  - Needs the canonical metric vocabulary settled (lowercase snake_case list).
  - Needs cross-module join model decided (`record_links` vs separate `metric_links` table).
  - Needs default time windows per metric type.
  - ~30 min design conversation in chat (not in Claude Code), then 1–2 sessions of build.

---

## LATER (not v.180–184 scope)

- [ ] Today page (locked design, never built — separate drop after the above stabilize).
- [ ] Universal Attachments (#28 — cross-module, multi-session work, blocks Reports Group 3).
- [ ] Reports Group 3 (Household) — blocked on Universal Attachments.
- [ ] Build the Vehicles module (DRAFT #19) — enables vehicle fuel asterisk.
- [ ] Calendar sync (blocked on Tailscale HTTPS cert).
- [ ] Email receipt parsing → inventory.
- [ ] Mini PC migration (per `MIGRATION_TO_MICROPC.md`).

---

## Audit findings carried forward (context)

From the 2026-05-20 four-module audit, kept here so the next session doesn't re-derive:

- **Finance module** is functional baseline complete; only the Pending Items list view + asterisk rollup + merchant auto-apply rules remain (covered in v.181 + v.183).
- **Medical module** is display-read complete; closed-loop bridge to Finance and two HIGH-priority schema gaps remain (covered in v.180).
- **Inventory module** is single-module complete. Cross-module wiring to Medical/Finance depends on #28 Universal Attachments which is LATER scope.
- **Reports module** has 1 of 13 charts live (forecast #26.1.5). Group 1 unblocked, Group 2 needs `metric_index` decision, Group 3 needs #28.

---

## How to retire this file

When every checkbox in v.180 through v.184 is ticked AND deployed AND verified:
1. Confirm BACKLOG.md / STATE.md reflect each drop's outcomes (they should — every drop above ends with a "Docs + version bump" task).
2. `git rm ROADMAP.md` in the final cleanup drop with a one-line commit: `docs: retire ROADMAP.md (v.180–184 arc complete)`.
3. Update STATE.md briefly to note the arc closed.
