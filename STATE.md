# Ghrava — Build State (Handoff)

> **Read this first.** Updated on every drop. Source of truth for what's
> shipped, what's in flight, what's blocked, and what to do next.
>
> If you're a new Claude chat reading this: scan all sections, then ask
> Al "ready?" before building. Do not re-litigate locked decisions.

---

## Current version

**v202604.148** — packaged. Bundled drop covering 3 of 4 IN-FLIGHT items:
EOB drill-down modal (#3), auto-todo for upcoming visits (#5), cross-card
lens (#1), and family-scope wiring (#2). Item #4 (dedicated /family.html
and /contacts.html pages) remains blocked — those pages don't exist yet.

| Sub-drop | Contents |
|---|---|
| .147a (schema) | Migration 124, dedup helper, routes dedup gate, reactivate endpoint, pending-review CRUD, condition metrics CRUD, watcher dedup wiring, lens extension, lt-core error.body |
| .147b (forms + cards) | Visit form regrouped, Condition form regrouped + inline metric panel, fill INSERT column-aware, GET /medications enriches `last_dose_change_at`, GET /conditions prefers new metrics table, PUT /conditions recomputes hash, EOB import surfaces queued/identical_file, click-through modals (family quick-view, contact quick-view) |
| .147c (real-data renderers) | renderConditionCard / renderVisitCard / renderEobCard using the .cardv5__* chrome, replaced static preview block, tabs render real data |
| **.148 (this drop)** | EOB drill-down modal, med_visit_upcoming auto-todo rule, "All" cross-card tab + renderer, medical_all lens module, device family scope wiring on medical page |

---

## ✋ DON'T TRUST WITHOUT RETEST (v202604.148)

**Critical: this list survives across chats.** Anything below has been
*touched* this drop but NOT confirmed working by Al. The next Claude
chat MUST treat these as suspect until Al explicitly says "tested,
works." Clear an entry only on Al's confirmation, never on assumption.

| File | Change | Risk |
|---|---|---|
| `app/public/medical_v2.html` | Replaced `_eobShowDetail` (was alert()) with Vellum-styled modal that fetches GET /medical/eob/:id and renders claims + services + balances | Medium — modal is new code; alert() was effectively dead so risk of regression is low, but the modal layout has not been seen with real data |
| `app/public/medical_v2.html` | Two `#eob-{id}` hash links on EOB card replaced with `_eobShowDetail(${s.id})` calls | Low — direct swap |
| `app/public/medical_v2.html` | New "All" tab in segmented v2-tabs row (between EOB and Summary), with switchView('all_medical', ...) handler | Low — additive tab |
| `app/public/medical_v2.html` | switchView() now hides patientStrip on 'all_medical' too, and calls window.initMedLensForView(view) before renderCurrentView | Low — additive guards, initMedLensForView is null-checked |
| `app/public/medical_v2.html` | initMedLens() inside _medBoot now also resolves moduleId for 'all_medical' (medical_all) and 'eob' (medical_eob), and is exposed as window.initMedLensForView | Low — pure addition |
| `app/public/medical_v2.html` | New `renderAllMedical()` function — fetches meds + conditions + visits + EOBs in parallel, applies person/tag/name/time filters, renders sections | Medium — new render path; EOB person filter falls back to substring match on `patients` field since EOBs lack family_member_id |
| `app/public/medical_v2.html` | New `_wireMedicalScope` IIFE — listens for 'gh-scope-changed' and applies scope.id as window._medFilters.person, plus boot-time apply if scope already set | Medium — race condition possible if user has scope set AND has manually narrowed lens before bootApply fires (250ms defer). Defensive: bootApply skips if person already set. |
| `app/public/js/lens-config.js` | Added `medical_all` module with person/name/time/tag dimensions | Low — additive |
| `app/shared/autoTodos.js` | Added rule 7b `med_visit_upcoming` — creates auto-todo for any med_visit_notes row with visit_date > today, due_date = visit_date, priority=medium, category=Medical | Medium — joins to contacts table for provider name; if contacts row missing, falls back to "Visit for {patient}". Resolves automatically when visit_date passes (or row is deleted). |
| `app/version.txt` | Bumped to 202604.148 | — |

**Untouched but still listed in earlier "✓ SHIPPED" sections — assume
those are stable from prior testing.** Do not re-clear them in this list.

---

## ✅ SHIPPED THIS DROP (v202604.148)

### Item #3 — EOB drill-down modal (real data)

`_eobShowDetail(id)` in medical_v2.html now opens a centered Vellum
modal with three sections:
- Header: hero $youShare with "paid" or "you owe" badge, statement_date,
  patient names (from claims aggregate), insurer + member_id + plan name
- Body: per-claim cards with patient/provider, claim_id, plan_paid +
  your_share + fund_paid (right-aligned mono), and per-service rows
  underneath showing description + date + billed amount
- Footer: balances rows (or deductible_used / healthfund_remaining
  legacy fallback) + claim count + total billed/covered + Close button

Both card click-targets (whole-card + ⋯ icon) call _eobShowDetail
directly instead of the dead `#eob-{id}` hash navigation. Esc key closes;
backdrop click closes; explicit Close button.

### Item #5 — Auto-todo for upcoming visits

New rule in `shared/autoTodos.js` (slot 7b, between med_discontinued and
vehicle_service_due). Fires on every GET /api/v1/todos call:

- Selects med_visit_notes rows with visit_date > today
- For each: upserts a todo with title "{visit_type} — {provider_name}"
  (or "{visit_type} for {patient}" if no provider), due_date = visit_date,
  priority=medium, category=Medical, auto_type=med_visit_upcoming,
  auto_source_type=med_visit, auto_source_id=visit_id
- Auto-resolves todos for visits whose date has passed or were deleted
- Fully idempotent (existing upsert/resolve helper pattern)

### Item #1 — Cross-card "All" lens

New "All" tab in the segmented v2-tabs row (positioned between EOB and
Summary). Selecting it:

- Switches `currentView` to 'all_medical'
- Re-inits the lens with moduleId 'medical_all' (new lens module
  exposing person + name + time + tag dimensions)
- Calls `renderAllMedical()`, which fetches meds + conditions + visits +
  EOBs in parallel, applies the lens filters across all four, and
  renders sections (Visits → Meds → Conditions → EOBs) using the
  existing renderMedCard/renderConditionCard/renderVisitCard/renderEobCard
- Total record count flows into the lens's setCount() like the per-tab
  views do

EOB person filtering uses substring match on the aggregated `patients`
field since EOBs lack family_member_id at the statement level. This is
documented in code; if/when EOBs gain family_member_id, the renderer
should switch to direct ID match.

### Item #2 — Device family scope wiring on medical page

nav.js already owns the scope pill, picker modal, and localStorage
key (`gh_device_family_scope`). The medical page now:

- Listens for `gh-scope-changed` events and maps scope.id →
  `window._medFilters.person`, then calls renderCurrentView()
- On boot, if a scope is already set AND no person filter is yet
  active, applies the scope as a default person filter (deferred 500ms
  so _medBoot's lens mount has time to settle)
- Clearing the scope (setScope(null)) deletes the person filter and
  re-renders

No new UI was added on the medical page — the scope pill in the
nav.js-rendered page header remains the single source of truth.

---

## ⏳ IN FLIGHT — NEXT DROP

### 1. Card click-throughs to dedicated pages (was item #4 in v.147)

Still blocked: `/family.html` and `/contacts.html` don't exist yet.
Avatar click-through currently opens openFamilyQuickView /
openContactQuickView modals — fine for now. Swap to navigation when
those pages land.

### 2. Receipt vault polish (carryover from v140 loose ends)

- EOB folder-drop persistence: importEob counts but doesn't save when
  uploaded via the watcher folder. Verify after .148 ships.
- LP-FSA plan info Settings UI (only API exists)
- Mileage UI on medical visit form (`round_trip_miles` field not
  exposed in frontend)
- attach-lifecycle adoption for documents/insurance/subscriptions

### 3. Backlog items

Per userMemories (15+ modules). After medical settles:

**High priority:**
- Photo-first wardrobe — drag/drop creates draft, fill rest later
- Today page (LOCKED design): Now (red) + Soon (amber). Endpoint
  /api/v1/today aggregates subscriptions/documents/insurance/todos.
  New `today_snoozes` table.

**Medium:**
- Drafts/status pages (`/_drafts.html` exists, build `/_drafts/status.html`)
- Reports module rollups (cross-medication spend, monthly Rx,
  pharmacy distribution, missed-refill streaks)
- Amazon orders → inventory via Gmail (regex parser, no AI cost)

**Low:** Calendar sync, browser extension. (Email receipt parsing was
REJECTED earlier — duplicates bank data.)

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
- Drop into `~/Downloads`, run `ghrava_deploy.ps1` on Windows machine
  (auto-finds zip in Downloads, robocopies to `Z:\ghrava`, deletes zip,
  prints docker restart command)
- `docker restart ghrava` for code changes
- `--build` ONLY when package.json changes
- **NEVER package after a single fix.** Bundle multiple changes per drop.
  (Al has corrected this twice — check before zipping.)

---

## 📝 RUNNING LIST OF SMALL THINGS NOT YET FIXED

Carried over from v.147:
- Card eyebrow's "↻ Dose updated" pill is wired but cosmetically untested
- `last_fill_quantity` enriched but meter shows `—` for old fills without
  quantity — should show a hint ("log a fill with quantity to see…")
- EOB tab still uses old upload-driven preview shape on initial parse —
  the renderEobCard path runs only on history list. (Detail modal in
  v.148 covers the post-import drill-down, but pre-import preview is
  unchanged.)
- Per-device family scope is now wired on the medical page (v.148) but
  NOT yet on insurance / documents / subscriptions / kids etc. Apply
  the same pattern (`gh-scope-changed` listener + bootApply) when those
  modules need it.

---

## 🛠 FILE MAP — where things live

```
app/
├── version.txt                                  202604.148
├── db/
│   ├── db.js                                    (not in deploy; live)
│   └── migrations/                              (none new in .148)
├── features/
│   └── medical/
│       ├── routes.js                            (not modified in .148)
│       ├── dedup.js                             (not modified in .148)
│       └── eob-parser.js                        (not modified)
├── shared/
│   ├── autoTodos.js                             .148 adds rule 7b (med_visit_upcoming)
│   └── folder-watcher.js                        (not modified in .148)
└── public/
    ├── medical_v2.html                          .148: EOB modal, All tab,
    │                                             renderAllMedical, scope wiring
    └── js/
        ├── lt-core.js                           (not modified in .148)
        └── lens-config.js                       .148 adds medical_all module
```

NOT in this zip but related (unchanged):
- `app/features/settings/routes.js` — owns /contacts/:id used by quick-view
- `app/public/nav.js` — owns family scope localStorage + pill + picker
- `app/public/shared.css` — global styles
- `app/features/todos/routes.js` — calls syncAutoTodos() on each GET
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
- Catches mistakes well — trust the corrections.
- **Tests at milestones, not per-feature.** This means: any change in the
  "✋ DON'T TRUST WITHOUT RETEST" section is suspect until Al confirms.

---

## ▶️ TO RESUME WORK

1. Read this file end-to-end.
2. Look at `app/version.txt` for current version.
3. Check the "✋ DON'T TRUST WITHOUT RETEST" section first — anything
   listed there should be verified with Al before assuming it works.
4. Pick from "IN FLIGHT — NEXT DROP" priority order.
5. Confirm with Al before writing code.
6. Build, validate (5 gates), zip, present_files.

End of state.
