# Ghrava — Build State (Handoff)

> **Read this first.** Updated on every drop. Source of truth for what's
> shipped, what's in flight, what's blocked, and what to do next.
>
> If you're a new Claude chat reading this: scan all sections, then ask
> Al "ready?" before building. Do not re-litigate locked decisions.

---

## Current version

**v202604.147** — packaged and shipped to live. Multiple sub-drops within .147:

| Sub-drop | Contents |
|---|---|
| .147a (schema) | Migration 124, dedup helper, routes dedup gate, reactivate endpoint, pending-review CRUD, condition metrics CRUD, watcher dedup wiring, lens extension, lt-core error.body |
| .147b (forms + cards) | Visit form regrouped, Condition form regrouped + inline metric panel, fill INSERT column-aware, GET /medications enriches `last_dose_change_at`, GET /conditions prefers new metrics table, PUT /conditions recomputes hash, EOB import surfaces queued/identical_file, click-through modals (family quick-view, contact quick-view) |
| .147c (real-data renderers) | renderConditionCard / renderVisitCard / renderEobCard using the .cardv5__* chrome, replaced static preview block, tabs render real data |

Earlier .145 and .146 are folded into .147 deploys.

---

## ✅ SHIPPED THIS CONVERSATION

### Schema (migrations 122 → 124)

```
122_med_generic_of.js              additive: med_medications.generic_of
123_med_fill_enrichment.js         additive: qty_unit, doses_per_day on
                                   med_medications; quantity, prescriber_contact_id,
                                   brand_dispensed, you_paid_oop, insurance_covered,
                                   rx_number, refill_seq on med_medication_fills
124_card_schema_expansion.js       additive: visit fields (start_time, duration_min,
                                   visit_location, visit_type, physician_contact_id,
                                   bp_systolic, bp_diastolic, weight_lb, temperature_f,
                                   heart_rate_bpm, visit_cost_oop, reason);
                                   dedup_hash on med/cond/visit/eob_statement/eob_claim;
                                   file_hash + auto_imported on eob_statement;
                                   NEW tables: med_medication_dose_changes,
                                   med_condition_metrics (UNIQUE on cond_id+metric+date),
                                   med_pending_review;
                                   indexes on every dedup_hash + file_hash
```

All migrations: additive only, idempotent, no CASCADE, no destructive ops.
Simulated against live-shape schema before shipping.

### Routes (`app/features/medical/routes.js` ~78 KB)

- POST /medications — dedup gate, returns 409 with `_dedup` signal on
  reactivate_match / dose_change; persists hash on insert
- PUT /medications/:id — logs dose change before update if dosage changed,
  recomputes hash
- POST /conditions — dedup gate (silent skip identical), persists hash
- PUT /conditions/:id — recomputes hash
- POST /notes — dedup gate, accepts all visit fields
- PUT /notes/:id — accepts all visit fields, recomputes hash
- POST /eob/import — file_hash gate, then record-level gate, returns
  imported/skipped/queued counts; persists file_hash + dedup_hash + auto_imported
- POST /medications/:id/reactivate — handles reactivate prompt resolution
- POST /medications/:id/fills — column-aware INSERT, auto-decrements
  refills_remaining, optionally updates rx_number on Rx renewal
- GET/POST/DELETE /conditions/:id/metrics — UPSERT on (cond_id, metric, date)
- GET /pending-review, POST /pending-review/:id/resolve, GET /pending-review-count
- GET /medications/:id/dose-changes
- POST /dedup/backfill — one-shot to populate dedup_hash on existing rows
- GET /medications enriches: last_filled, last_fill_cost, last_fill_quantity,
  last_fill_days_supply, hsa_ytd, last_dose_change_at, conditions[]
- GET /conditions enriches: latest_metric, metric_series (12 points),
  active_meds_count, related_visits_count, hsa_ytd, medications[]

### Dedup (`app/features/medical/dedup.js`)

- Natural-key SHA-256 hashes (16-char hex):
  - **Med:** family_member_id|name|dosage
  - **Condition:** family_member_id|condition_name
  - **Visit:** family_member_id|provider|date|start_time|visit_type
  - **EOB stmt:** insurer|member_id|statement_date
  - **EOB claim:** patient|claim_id|send_date
- File hash: full SHA-256 of buffer
- `queueReview(db, item)` auto-creates a Todo when source !== 'manual'
- Outcomes: identical (silent skip) / strong_match (queue) / weak_match
  (insert + auto_imported flag) / new

### Watcher (`app/shared/folder-watcher.js`)

- `importEob` actually persists now (was a stub that just counted)
- File-hash silent skip
- Record-level dedup → queues to pending_review with auto-todo
- Marks rows `auto_imported=1` when source='watcher'

### Frontend (`app/public/medical_v2.html` ~211 KB)

**Cards (Vellum design system):**
- `.cardv5__*` chrome shared by all 4 card types
- `renderMedCard` — name as hero
- `renderConditionCard` — number as hero (BP/A1C/etc.) with sparkline; falls
  back to name as hero when no metric tracked
- `renderVisitCard` — date as hero with relative-day suffix (in 4d / 11d ago)
- `renderEobCard` — money as hero (you-share), red/green by settled status

**Forms:**
- Visit drawer — 4 grouped panels: When/where (with split date+time, duration
  quick-picks), Vitals (collapsible), Notes, Follow-up
- Condition drawer — 5 grouped panels: Identity, Goal & metric, Status,
  Notes, Recent readings (only on edit, with inline add)
- Medication form — generic_of field added; reactivate-prompt-aware save
  (handles 409 _dedup signals)

**Banner:**
- `#ghPendingBanner` — visible when /pending-review-count > 0
- Click opens modal with Merge/Insert/Discard buttons per item
- Refreshes on page load via requestIdleCallback, after every EOB import

**Click-throughs:**
- Patient avatar → `openFamilyQuickView(family_member_id)` — modal with
  cross-domain summary (meds/conditions/visits counts)
- Doctor avatar → `openContactQuickView(contact_id)` — phone/email/website/
  address modal, with "Open website ↗" button when website is set
- Pharmacy avatar → `openContactQuickView(contact_id)` — same modal,
  pharmacy URL surfaces as primary action

**Layout:**
- 2-column locked grid (`repeat(2, minmax(0, 1fr))`)
- Mobile (<700px): single column
- `overflow-x: hidden` + `min-width: 0` on body to guarantee no horizontal scroll
- Card grid centered with max-width 1320px

**Lens (`app/public/js/lens-config.js`):**
- Extended dimensions for medical_medications (refill, controlled, generic),
  medical_conditions (system, state), medical_notes (visit_type, when, location)
- New domain: medical_eob (claim#, status, amount range)

**lt-core.js:**
- Errors thrown by `api()` now carry `.status` and `.body` so callers can
  branch on `_dedup` signals (backward compatible)

---

## ⏳ IN FLIGHT — NEXT DROP

Locked decisions, just need to be built. Priority order:

### 1. Cross-card lens (highest user value)
Currently the lens is per-tab. Typing "Sarah" on the Meds tab doesn't show
her conditions, visits, or EOBs. Build a unified search mode that, when the
lens narrows by family member or by date range, shows results from all 4
domains stacked.

**Approach:**
- Lens currently keyed to a single domain (e.g. `medical_medications`)
- Add a "cross-card" mode that runs the same filters across med + cond +
  visit + eob endpoints in parallel and renders mixed-card grid
- Sort by relevance score: same-day visit first, then meds, then conditions,
  then EOBs
- Toggle between "All medical" and per-tab views

**No schema changes required.** Pure frontend + lens-config extension.

### 2. Family scope picker
Right now `currentPatient` is set globally. The agreed model: per-device
family scope stored in localStorage, with a first-time prompt "who is this?"
The nav already has scaffolding for this in the userMemories notes.

**Approach:**
- localStorage key: `gh_device_family_scope` (already exists in nav.js per
  earlier handoff)
- Surface a small avatar in the medical page header showing current scope
- Click → modal with "switch family member" picker
- All renderX() calls pass `?family_member_id=N` when scope is set

### 3. Real-data EOB drill-down
EOB card currently navigates to `#eob-{id}` hash which doesn't go anywhere.
Build a real detail modal showing claims, services, balances using the
existing GET /eob/:id endpoint (which already returns the nested structure).

### 4. Card click-throughs to dedicated pages (when they exist)
- `/family.html` — doesn't exist yet, click-through goes to quick-view modal
  for now. When the page lands, swap the modal for navigation.
- `/contacts.html` — same situation.

### 5. Auto-create todo for upcoming visits
When a visit is saved with `visit_date > today`, also create a calendar event
or todo. Confirmed in earlier session as desired but never wired.

---

## 📋 BACKLOG — beyond medical

Per the userMemories module list (15+ modules). After medical settles:

**High priority:**
- Per-device family filter — first-time prompt, localStorage only
- Photo-first wardrobe — drag/drop creates draft, fill rest later
- Today page (LOCKED design): Now (red, due today/overdue) + Soon (amber,
  next 7 days). Endpoint /api/v1/today aggregates subscriptions/documents/
  insurance/todos. New `today_snoozes` table.

**Medium:**
- Drafts/status pages (`/_drafts.html` exists, build `/_drafts/status.html`)
- Reports module rollups (cross-medication spend, monthly Rx, pharmacy
  distribution, missed-refill streaks)
- Amazon orders → inventory via Gmail (regex parser, no AI cost)

**Low:**
- Calendar sync, browser extension, email receipt parsing (REJECTED earlier)

---

## 🎯 LOCKED DESIGN DECISIONS

These are not up for re-litigation. Reference, don't re-debate:

### Cards
- **5 zones:** A eyebrow / B hero+icons / A' tags+pill / C strip / E entities
- **Vellum theme:** `--bg-card #fbf6e9`, `--border #d8cba8`, `--accent #c0392b`
- **Type ladder:** Fraunces serif italic for hero; Inter for body; DM Mono
  for eyebrows + labels
- **Hero strategy varies:**
  - Med → name (Atorvastatin)
  - Condition → number (128/82) when metric tracked, else name
  - Visit → date (Mar 12 · 11d ago)
  - EOB → money ($142.18 · you owe)
- **Strip groups:** [factual] [factual] | [money] [money] (vertical divider)
- **2 columns max desktop, 1 column mobile, no horizontal scroll** (LOCKED)

### Dedup
- **Two layers:** file_hash (silent skip identical PDFs) + record-level
  natural-key hash
- **Outcomes:** identical → skip; strong_match → queue; weak_match → insert
  with `auto_imported=1`; new → insert
- **Manual entry runs the same gate** as parser path
- **Reactivate flow:** never silent. Manual = synchronous prompt. Parser =
  queue + auto-todo with due_date = today.
- **Dose change** (10mg → 20mg → 10mg): reactivate same record, log change
  in `med_medication_dose_changes`, create new fill row at new dose
- **Condition metrics:** UPSERT on (cond_id, metric_name, measured_on) —
  same-day duplicate replaces

### Architecture
- `journal_mode = DELETE`, `synchronous = FULL` (NEVER WAL)
- **NEVER use ON DELETE CASCADE** anywhere
- Migrations are additive-only
- `requireAuth` only on `/settings/*` and `/watcher/*`
- All read GETs are public (browser `<img>` can't send auth headers)
- Auth not in deploy zip (would lock out Settings)

### Code quality gates (5-gate predeploy)
1. Node syntax check on all route files + migrations
2. Inline script syntax check on all HTML files
3. Critical IDs preserved
4. Migration simulation against live-shape schema
5. No auth/middleware.js in deploy

---

## 🚦 DEPLOY WORKFLOW

- Zip naming: **always `Ghrava_DEPLOY.zip`** (no version suffix)
- Always presented via `present_files` tool
- Drop into `~/Downloads`, run `Deploy-Patch.ps1` on Windows machine that
  maps NAS as Z:\ghrava
- `docker restart ghrava` for code changes
- `--build` ONLY when package.json changes
- **NEVER package after a single fix.** Bundle multiple changes per drop.
  (Al has corrected this twice — check before zipping.)

---

## 📝 RUNNING LIST OF SMALL THINGS NOT YET FIXED

These came up during the build but were deferred:

- Card eyebrow's "↻ Dose updated" pill is wired but cosmetically untested
  (need a real dose-change row to verify rendering)
- `last_fill_quantity` is enriched but the meter renderer assumes it. Old
  fills without quantity render `—` correctly, but should show a hint
  ("log a fill with quantity to see remaining doses")
- EOB tab still uses the upload-driven UI mostly intact; the new `renderEobCard`
  only renders the history list. Preview during upload uses the old shape.
- The `_eobShowDetail` modal is the old plain-HTML version, not the Vellum
  card style. Listed as "next drop #3" above.
- Per-device family scope isn't surfaced visually yet (handled by nav.js).
  Medical page should show current scope as a small avatar near the header.

---

## 🛠 FILE MAP — where things live

```
app/
├── version.txt                                  current version string
├── db/
│   ├── db.js                                    (not in deploy; live)
│   └── migrations/
│       ├── 122_med_generic_of.js                .145
│       ├── 123_med_fill_enrichment.js           .146
│       └── 124_card_schema_expansion.js         .147
├── features/
│   └── medical/
│       ├── routes.js                            ALL medical CRUD + dedup gate
│       ├── dedup.js                             natural-key hashes, queueReview
│       └── eob-parser.js                        (not modified)
├── shared/
│   └── folder-watcher.js                        importEob now persists
└── public/
    ├── medical_v2.html                          card chrome, renderers, forms,
    │                                             banner, quick-view modals
    └── js/
        ├── lt-core.js                           api() error has .body and .status
        └── lens-config.js                       extended medical lens
```

NOT in this zip but related (unchanged):
- `app/features/settings/routes.js` — owns /contacts/:id used by quick-view
- `app/public/nav.js` — owns family scope localStorage
- `app/public/shared.css` — global styles
- All other modules untouched

---

## 💬 HOW AL WORKS

- **Chat first.** Discuss design before writing code. Confirm before building.
- **Short replies preferred.**
- **Don't fix things unless asked.** Document, don't silently patch.
- **Group changes** into one drop, not per-fix.
- **Apply patterns to all relevant modules in the same session**, not one
  at a time.
- **"Make it similar to X"** = identical layout, not approximation.
- Says "go" when locked. Says "continue" when ready for the next item in
  the queued backlog.
- Catches mistakes well — e.g. spotted the "Self" grouping was useless,
  the static preview page was a detour, the dose-change-without-hash-match
  edge case I'd missed. Trust the corrections.

---

## ▶️ TO RESUME WORK

1. Read this file end-to-end.
2. Look at `app/version.txt` for current version.
3. Skim `app/features/medical/routes.js` end (everything past the
   `v202604.147 — REACTIVATE / DEDUP RESOLUTION / METRICS / PENDING` banner).
4. Skim the bottom of `app/public/medical_v2.html` (renderers,
   quick-view modals, banner refresh logic).
5. Pick from "IN FLIGHT — NEXT DROP" priority order.
6. Confirm with Al before writing code: "I'm picking up #1 (cross-card lens).
   Confirm scope, or do you want a different item?"
7. Build, validate (5 gates), zip, present_files.

End of state.
