# Ghrava — Build State (Handoff)

> **Read this first.** Updated on every drop. Source of truth for what's
> shipped, what's in flight, what's blocked, and what to do next.
>
> If you're a new Claude chat reading this: scan all sections, then ask
> Al "ready?" before building. Do not re-litigate locked decisions.

---

## Current version

**v202604.149** — packaged. Cross-card "All" tab is now the default
landing on `/medical.html`. Contents:

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

## ✋ DON'T TRUST WITHOUT RETEST (v202604.149)

**This list survives across chats.** Anything below is *touched* this
drop but NOT confirmed working by Al. Treat as suspect until Al says
"tested, works." Clear an entry only on Al's confirmation.

| File | Change | Risk |
|---|---|---|
| `app/db/migrations/125_med_visit_conditions.js` (NEW) | Creates `med_visit_conditions` junction table with indexes; idempotent | Low — additive, simulated against in-memory shape, idempotent confirmed |
| `app/features/medical/routes.js` | GET /notes returns family_member_name + attachment_count + linked_conditions | Medium — new joins. Routes still parse OK; needs runtime test against real DB |
| `app/features/medical/routes.js` | POST/PUT /notes write linked_condition_ids junction (replace-set on PUT). DELETE /notes clears junction. | Medium |
| `app/features/medical/routes.js` | DELETE /conditions clears the visit junction first | Low |
| `app/features/medical/routes.js` | GET /medications, /conditions, /eob each return attachment_count | Low — additive subselect |
| `app/features/medical/routes.js` | GET /eob returns family_member_ids (DISTINCT from claims) | Low |
| `app/public/medical.html` | Default `currentView = 'all_medical'`; All tab moved to first position; tab marked `active` by default | Medium — every page load lands here. Verify deep-links from daily-log/dashboard still work (they don't pass a tab; they trigger drawer open via seed/visit query params). |
| `app/public/medical.html` | New helper `_currentMemberId()`. All three drawer-open paths use it to pre-fill the family wrap | Medium — relies on `currentPatient` matching `display_name` exactly. Was the existing convention already. |
| `app/public/medical.html` | Three `patient: ... 'Self'` save fallbacks → `null` instead | Low |
| `app/public/medical.html` | `memberName` in renderMedCard/Condition/Visit no longer falls through to `'Self'` string | Low |
| `app/public/medical.html` | New visit form field "For which conditions?" — chip picker. Loads conditions for the active patient | Medium — picker filters conditions by family_member_id; if patient hasn't been selected yet, shows all. |
| `app/public/medical.html` | New saveNote field `linked_condition_ids` | Low |
| `app/public/medical.html` | `renderAllMedical()` rewritten — flat grid sorted newest first; EOB filter uses new family_member_ids rollup | Medium — sort key per domain documented in code |
| `app/public/medical.html` | `.medv5-grid--all` CSS — mobile swipe-snap carousel | Medium — needs touch testing on a real phone, not just devtools mobile mode |
| `app/public/medical.html` | Visit card shows linked-condition chips when `linked_conditions` array is populated | Low |
| `app/version.txt` | Bumped 202604.148 → 202604.149 | — |

---

## ✅ SHIPPED THIS DROP (v202604.149)

### SE/Self bug — root cause fix

The display name "SE" was appearing because:
1. Form drawer opened with empty family widget
2. User selected nothing in widget; current patient strip had a
   selection but wasn't used
3. Save wrote `family_member_id: null, patient: "Self"` (literal string)
4. Render fell back to `"Self"` and GH_AVATAR computed initials → "SE"

Three-layer fix:
- **Forms** pre-fill the family widget with the active patient strip's
  member id when no record id is being edited. New helper
  `_currentMemberId()` resolves `currentPatient` (display_name string)
  to a member id from `familyMembers`.
- **Save handlers** stop substituting `'Self'` for missing patient.
  Body sends `null` so backend has clean signal.
- **Renderers** compute `memberName` only from real family data.
  Stale rows where `patient = 'Self'` and `family_member_id = NULL`
  render with no avatar, instead of "SE."

The backend `'Self'` defaults in routes.js were left in place as a
defensive last-resort — only the client-side path was changed. Old
rows with `patient = 'Self'` already in the DB will render
avatar-less from now on; if you want them attributed to a real
member, edit them and resave.

### Data-joins audit + fixes

**Visit list (`GET /medical/notes`)** — added joins/columns:
- `family_member_name` (was missing — primary cause of SE bug for visits)
- `attachment_count` (paperclip badge)
- `linked_conditions: [{id, name}, ...]` (new junction)

**Condition list (`GET /medical/conditions`)** — added:
- `attachment_count`

**Medication list (`GET /medical/medications`)** — added:
- `attachment_count`

**EOB list (`GET /medical/eob`)** — added:
- `attachment_count`
- `family_member_ids` — DISTINCT from claims, lets the All-tab
  person filter narrow EOBs by person directly. Substring fallback
  still in place for older clients.

### Visit ↔ condition junction (migration 125)

New table `med_visit_conditions(visit_id, condition_id)`. No FK
constraints (per architecture rule). Indexed both directions.

**Form**: new "For which conditions?" chip picker on the visit
drawer, between Reason and Vitals. Loads conditions filtered to the
active patient (or all conditions if no patient set yet). Click a
chip to toggle. Multi-select.

**API contract**: POST/PUT /notes accept `linked_condition_ids: [int...]`
in the body. PUT does **replace-set** (an empty array clears all
links). DELETE /notes clears the visit's links. DELETE /conditions
clears links pointing at that condition.

**Render**: visit cards show one purple chip per linked condition in
the tag row, alongside the visit-type chip.

### All-tab landing + flat grid + mobile swipe

- `currentView` initial value is now `'all_medical'`. Tab order
  reshuffled so All is first and starts with the `active` class.
- `_medBoot()` calls `renderCurrentView()` instead of forcing
  `renderMedications()`, so the initial render matches whatever
  `currentView` is.
- `renderAllMedical()` rewritten: builds one flat list `items` with
  a `_kind` discriminator and `_sortDate` per row, sorts by sortDate
  descending, dispatches to the correct render function. No section
  labels.
- Sort keys: visit_date, statement_date, latest_metric.recorded_at /
  start_date, start_date / created_at — newest first, empties to bottom.
- New CSS class `medv5-grid--all`. Desktop: inherits 2-col layout.
  Mobile (≤700px): becomes `display:flex; overflow-x:auto;
  scroll-snap-type:x mandatory`, with each card sized to viewport
  width minus 28px and `scroll-snap-align:center; scroll-snap-stop:always`.

---

## ⏳ IN FLIGHT — NEXT DROP

### 1. Card click-throughs to dedicated /family.html and /contacts.html

Still blocked: those pages don't exist yet. Avatar click currently
opens `openFamilyQuickView` / `openContactQuickView` modals.

### 2. Receipt vault polish (carryover from v140)

- EOB folder-drop persistence (importEob counts but doesn't save
  via watcher folder)
- LP-FSA plan info Settings UI
- Mileage UI on medical visit form (`round_trip_miles` backend ready)
- attach-lifecycle adoption for documents/insurance/subscriptions

### 3. Restore Record Refill / Link Receipt? (if Al wants it back)

Lost in the v1→v2 merge in v.148. v2 stubs make the buttons no-op
gracefully. Source of original modals preserved in
`Ghrava_Share_20260508.zip` if needed.

### 4. Apply scope-wiring pattern to other modules

Insurance / documents / subscriptions / kids could honor the device
family scope the same way medical does. One IIFE per page listening
for `gh-scope-changed`.

### 5. Backlog (per userMemories — 15+ modules)

- **High:** Photo-first wardrobe, Today page (Now/Soon, /api/v1/today,
  today_snoozes table)
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

### Folder watcher vs Finance Import screen — LOCKED

Both stay. Both do real work. Both call the **same parser** (see
"Parser reuse" below).
- **Finance Import screen** = manual UI for one-off imports,
  corrections, file picker on a phone with no NAS access.
- **Folder watcher** = drop CSVs into `_inbox/<account>/` from the
  bank's "auto-download to a folder" tool, get them imported on
  the watcher's next pass.
- Both gates pass through the dedup framework (see "Smart dedup
  scope" below). Neither can skip.
- Manual single-row transaction entry on the Transactions list also
  stays — that's a separate path, not redundant with these two.

### Parser reuse — LOCKED (Al, 2026-05-08)

> "Can we reuse the parser no matter what the input source is."

**Yes, and we will.** Pattern that EOB already uses (`eob-parser.js`
called from both `/eob/import` and watcher's `importEob`) gets
mirrored for finance:

- New `shared/finance-parser.js` with `parseFile(buffer, filename,
  account_type)` and `insertTransactions(rows, account_id, source)`
- Dedup gate lives **inside** `insertTransactions` — neither caller
  can bypass
- Finance Import screen's `/import/preview` + `/import/confirm` call
  it. `importStatement` in folder-watcher.js calls it.
- Same rule generalizes: **one parser per data type, multiple entry
  points.** EOB already follows this. Finance is next. Anything
  else with structured input (future bank formats, future EOB
  carriers) follows the same pattern.

This is **future work for the next finance-touching drop**, not
shipped yet. Logged here so the next chat doesn't re-decide.

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

- Dedup **warns, never blocks**. Modal: "This looks like a
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
| Force-create confirm modal (manual entry) | ⚠️ partial — exists for some domains, not all 8 |
| HSA receipt natural-key dedup | ⚠️ unverified — `shared/dedupe.js` referenced in design but verify it exists in code |
| Bank transaction natural-key dedup | ⚠️ assumed wired in finance import (per chat-16); verify in `/import/confirm` path |
| Subscription / insurance dedup | ❌ design spec'd, code unverified |
| EOB→HSA retry hook | ❌ design spec'd, code unverified |
| Audit log for force-creates | ❌ design spec'd, code unverified |

> Items in ⚠️ / ❌ should be verified by grepping for the named
> functions before any next chat assumes they work.

---

## 🚦 DEPLOY WORKFLOW

- Zip: always `Ghrava_DEPLOY.zip`, no version suffix
- Always `present_files` in chat
- Drop into `~/Downloads`, run `ghrava_deploy.ps1`
- `docker restart ghrava` for code; `--build` only when
  package.json changed
- **NEVER package after a single fix.** Bundle multiple per drop.

### NAS cleanup outstanding

robocopy `/E` does not delete files. Old `medical_v2.html` may still
linger on the NAS from pre-v.148 deploys. Remove by hand:

```
Remove-Item Z:\ghrava\app\public\medical_v2.html
```

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

```
app/
├── version.txt                                  202604.149
├── db/
│   └── migrations/
│       └── 125_med_visit_conditions.js          NEW — junction table
├── features/
│   └── medical/
│       └── routes.js                            .149 — joins, attachment_count,
│                                                  linked_condition_ids handling,
│                                                  EOB family_member_ids rollup
├── shared/
│   └── autoTodos.js                             .148 (carried over)
└── public/
    ├── medical.html                             .149 — All landing, flat grid,
    │                                              mobile swipe, SE/Self bug fix,
    │                                              linked-conditions form picker,
    │                                              visit card chips
    └── js/
        └── lens-config.js                       .148 (carried over)
```

NOT in this zip but related:
- `app/features/todos/routes.js` — calls syncAutoTodos()
- `app/public/nav.js` — owns family scope
- `app/public/shared.css` — global styles

---

## 💬 HOW AL WORKS

- Chat first. Discuss design before code. Confirm before building.
- Short replies preferred.
- Don't fix unless asked. Document, don't silently patch.
- Group changes per drop.
- Apply patterns to all relevant modules in the same session.
- "Make it similar to X" = identical layout, not approximation.
- Tests at milestones, not per-feature → ✋ retest list above is gospel.
- Catches mistakes well — trust the corrections. Don't defend.
- Tokens are limited — be brief, don't over-explain.

---

## ▶️ TO RESUME WORK

1. Read this file end-to-end.
2. `app/version.txt` for current version.
3. Check ✋ section first — verify with Al before assuming anything works.
4. Pick from "IN FLIGHT — NEXT DROP" priority order.
5. Confirm with Al before writing code.
6. Build, validate (5 gates), zip, present_files.

End of state.
