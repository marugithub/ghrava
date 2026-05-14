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

2. **Medical "Receipts" tab design** (v140 deferred) — single-flow upload: drop a PDF in Medical → app stores file in Documents + creates med_visit_notes row + auto-links via record_links. Decision needed: drawer UI vs full-page; auto-extract clinical data via parser vs manual entry on second screen. See v.140 chat for the design that got pushed.

3. **Reports engine design** — Al wants vertical slice (BP over 2yr) AND horizontal slice (all health stats over 6mo). Requires `metric_index` view UNION-ALLing all clinical + financial time-series. Discussion needed before code: which canonical metric names (e.g. `bp_systolic` vs `BP systolic`), how cross-module reports join (record_links?), what default time windows. Reports page currently empty (registry empty in renderer — known bug).

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
- **Help → Commands is mandatory for new CLIs** (Al, v.166): every drop that adds a `docker exec` / CLI / one-time operational command MUST append an entry to `app/public/help.html → COMMANDS` array (title, cmd, desc, tags). User reaches it via Help → Commands quick card. Each entry is click-to-copy.

---

## 📦 Version log highlights (for context)

- **v.165** — finance landing tiles wired (F1–F6), HSA pool reads hsa_payments + fsa_payments.
- **v.166** (IN PROGRESS, this drop) — drafts→templates rename + dir move, medical Overview tab (M1–M6), mig 131 schema expansion (4 new tables + 23 new columns), bulk-seed endpoint + CLI, kids auto-sync, lens config for new fields, BACKLOG.md created, **Help → Commands section added** (operational CLI documentation with click-to-copy).

---

*Last updated: v202604.166 sandbox. Update this file at the end of every chat. Bundled in every deploy zip.*
