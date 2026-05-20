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

**Theme:** Close the v.171 promise (Pending Items list visible+actionable). Bundle a small HSA-adjacent win.

- [ ] **Task 1 — Pending Items Report list view at `/reports.html?tab=pending`**
  - Locked design #29 in `_templates.html`.
  - Reads from existing pending detectors in `app/features/pending/routes.js`.
  - List + grid views via `GH_VIEW` (already standard pattern).
  - Three actions per row: assign / skip 30d / not a [module] expense.
  - Inline picker per module type (vehicle, subscription, medical visit, HSA, inventory, cert).
  - Asterisks on derived numbers (the v.173 per-record probe already exists; this is the rollup UI).
- [ ] **Task 2 — LP-FSA plan info Settings UI**
  - Backend `lpfsa_plan_info` table already exists.
  - Mirror the FSA form pattern (already shipped).
  - Fields: `annual_limit, plan_year, deadline_date, plan_name`.
  - Same drawer pattern as other Settings sub-forms.
- [ ] **Task 3 — Docs + version bump**

---

## v.182 — Reports: Group 1 (Money) charts live + CSS modal fix

**Theme:** Make Reports stop being a placeholder.

- [ ] **Task 1 — Fix Reports panels opening as center modals** (BACKLOG known-bug #4)
  - Sub-panel CSS leak from `settings.html`.
  - Scope the leak, fix the selector.
- [ ] **Task 2 — Wire `#26.1.1` Sankey income → categories**
  - Currently static SVG mockup.
  - New endpoint or extend existing `/finance/reports/monthly-totals` to return income-source → category flow data.
  - Render with a small Sankey library OR custom SVG (match existing chart style — Chart.js if that's what's used).
- [ ] **Task 3 — Wire `#26.1.2` Calendar heatmap**
  - One cell per day, color intensity = spending.
  - Reuse `/finance/reports/spending-by-category` data, aggregated daily.
- [ ] **Task 4 — Wire `#26.1.3` Vendor treemap**
  - New backend query: `SELECT vendor, SUM(amount) FROM transactions GROUP BY vendor ORDER BY total DESC LIMIT 50`.
  - Render as treemap (boxes sized by total spend).
- [ ] **Task 5 — Wire `#26.1.4` Category small-multiples**
  - Reuse spending-by-category.
  - Render a grid of mini line charts, one per top-10 categories.
- [ ] **Task 6 — Drill-down on each chart**
  - Per locked #26 spec: every chart has drill-down.
  - Click → opens a side drawer with the underlying transactions list.
- [ ] **Task 7 — Docs + version bump**

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
