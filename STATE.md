# Ghrava — Build State (Handoff)

> **Read this first.** Updated on every drop. Source of truth for what's
> shipped, what's in flight, what's blocked, and what to do next.
>
> If you're a new Claude chat reading this: scan all sections, then ask
> Al "ready?" before building. Do not re-litigate locked decisions.

---

## Current version

**v202604.148** — packaged. Bundled drop covering 3 of 4 IN-FLIGHT items
plus a structural cleanup:

- **EOB drill-down modal** (#3)
- **Auto-todo for upcoming visits** (#5)
- **Cross-card "All" lens tab** (#1)
- **Family-scope wiring on medical** (#2)
- **Merge: medical_v2.html → medical.html** — v2 wins, v1 retired,
  cross-page links unchanged (everything was already pointing at
  /medical.html). Two refill/receipt-link modals from v1
  (openRefillModal, openLinkReceiptModal, saveRefill) deliberately
  dropped — accepted loss per Al. Stub functions in v2 still handle
  calls gracefully (edit drawer for refill, no-op for receipt link).

Item #4 (dedicated /family.html and /contacts.html pages) remains
blocked — those pages don't exist yet.

---

## ✋ DON'T TRUST WITHOUT RETEST (v202604.148)

**Critical: this list survives across chats.** Anything below has been
*touched* this drop but NOT confirmed working by Al. The next Claude
chat MUST treat these as suspect until Al explicitly says "tested,
works." Clear an entry only on Al's confirmation, never on assumption.

| File | Change | Risk |
|---|---|---|
| `app/public/medical.html` (NEW) | Replaces both medical.html (v1) and medical_v2.html. Contents are the v2 page with v.148 features merged in. v2 preview badge stripped. | **HIGH** — wholesale page replacement; entire medical experience is new at this URL. Test all tabs (Meds, Conditions, Visits, H&W, EOB, All, Summary), patient strip, lens, all CRUD drawers, attachments, EOB import flow. |
| `app/public/medical.html` | `_eobShowDetail` rewritten as Vellum modal hitting GET /medical/eob/:id | Medium |
| `app/public/medical.html` | New "All" tab + `renderAllMedical()` cross-card function | Medium |
| `app/public/medical.html` | New `_wireMedicalScope` listens for 'gh-scope-changed', maps to lens person filter; bootApply 500ms after DOMContentLoaded | Medium — race possible if user narrows lens before bootApply fires; defensive skip if person already set |
| `app/public/medical.html` | switchView / renderCurrentView / initMedLens dispatch 'all_medical' and 'eob' subviews; initMedLens exposed as window.initMedLensForView | Low — additive |
| `app/public/_card_previews.html` | Back-link href updated /medical_v2.html → /medical.html. CSS comment updated. | Low |
| `app/public/js/lens-config.js` | Added `medical_all` cross-card module (person/name/time/tag) | Low — additive |
| `app/shared/autoTodos.js` | Added rule 7b `med_visit_upcoming` — auto-todo for med_visit_notes rows with visit_date > today | Medium — joins contacts; falls back to "Visit for {patient}" if no provider |
| `app/version.txt` | Bumped 202604.147 → 202604.148 | — |

### Lost functionality (v1 → v2 merge accepted by Al)

- **Record Refill modal** (`openRefillModal`, `saveRefill`) — was a
  modal that POSTed to `/medical/medications/:id/fills`. v2 has a stub
  that opens the edit drawer instead. Real fill insertion no longer
  exposed in UI.
- **Link Receipt modal** (`openLinkReceiptModal`, `confirmLinkReceipt`) —
  let user attach a receipt to a med fill. v2 has a no-op stub.

If/when these matter again, restore from
`Ghrava_Share_20260508.zip` → `app/public/medical.html` lines ~1215–1340.

### Manual cleanup needed on NAS

robocopy `/E` does not delete files. The old `medical_v2.html` will
linger at `Z:\ghrava\app\public\medical_v2.html` until removed by hand:

  `Remove-Item Z:\ghrava\app\public\medical_v2.html`

Or leave it — nothing links to it anymore.

---

## ✅ SHIPPED THIS DROP (v202604.148)

### Merge: medical_v2.html → medical.html

The "v2 preview" page is now the canonical Medical page. Visiting
`/medical.html` shows what `/medical_v2.html` used to show, plus the
four v.148 features. v1 file: gone from source. v2 file: gone from
source. One file: `medical.html`.

Cross-page links across the app (daily-log, dashboard, notifications,
reports, todos, keyboard-shortcuts) all already pointed at
`/medical.html` — no other-file edits required. The single back-link
in `_card_previews.html` was updated.

### Item #3 — EOB drill-down modal (real data)

`_eobShowDetail(id)` opens a centered Vellum modal: hero $you-share,
statement metadata, per-claim cards (patient/provider +
plan_paid/your_share/fund_paid + per-service rows), balances section.
Esc / backdrop / Close all dismiss. Both EOB card click targets call
`_eobShowDetail()` instead of the dead `#eob-{id}` hash navigation.

### Item #5 — Auto-todo for upcoming visits

`shared/autoTodos.js` rule 7b. Selects `med_visit_notes` WHERE
`visit_date > today`, joins `contacts` via physician_contact_id /
contact_id for provider name. Upserts a todo with title "{visit_type}
— {provider}" (or "{visit_type} for {patient}"), due_date =
visit_date, priority=medium, category=Medical. Idempotent;
auto-resolves when date passes or row deleted.

### Item #1 — Cross-card "All" lens tab

New "All" tab between EOB and Summary. `renderAllMedical()` fetches
meds + conditions + visits + EOBs in parallel, applies lens filters
across all four (person + name + time + tag), renders sections
(Visits → Meds → Conditions → EOBs) using existing card renderers.
EOB person filter falls back to substring match on aggregated
`patients` field since EOBs lack `family_member_id`.

New `medical_all` module added to `lens-config.js`.

### Item #2 — Device family scope wiring on medical

Listens for `gh-scope-changed` events from nav.js's scope picker,
maps `scope.id` → `window._medFilters.person`, re-renders. Boot-time
apply (500ms post-DOMContentLoaded) honors any pre-existing scope as
default person filter when nothing else is active.

The scope pill in the page header (rendered by nav.js) remains the
single source of truth — no new UI on the medical page.

---

## ⏳ IN FLIGHT — NEXT DROP

### 1. Card click-throughs to dedicated pages (was item #4)

Still blocked: `/family.html` and `/contacts.html` don't exist yet.
Avatar click currently opens openFamilyQuickView /
openContactQuickView modals — fine until those pages land.

### 2. Receipt vault polish (carryover from v140)

- EOB folder-drop persistence (importEob counts but doesn't save
  via watcher folder)
- LP-FSA plan info Settings UI
- Mileage UI on medical visit form (`round_trip_miles` backend
  exists, not in form)
- attach-lifecycle adoption for documents/insurance/subscriptions

### 3. Restore Record Refill / Link Receipt? (if Al wants it back)

Lost in the v1→v2 merge. Source for both still exists in
`Ghrava_Share_20260508.zip` if needed.

### 4. Backlog (per userMemories — 15+ modules)

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
- 2 columns max desktop, 1 column mobile, no horizontal scroll

### Dedup
- Two layers: file_hash + record-level natural-key hash
- Outcomes: identical → skip; strong → queue; weak → insert
  auto_imported=1; new → insert
- Manual entry runs same gate as parser
- Reactivate: never silent
- Dose change: reactivate same record + log + new fill at new dose
- Condition metrics UPSERT on (cond_id, metric_name, measured_on)

### Architecture
- journal_mode=DELETE, synchronous=FULL (NEVER WAL)
- NEVER ON DELETE CASCADE
- Migrations additive-only
- requireAuth only on `/settings/*` and `/watcher/*`
- All read GETs public
- Auth NOT in deploy zip

### Code quality (5 gates)
1. Node syntax check on JS
2. Inline script syntax on HTML
3. Critical IDs preserved
4. Migration sim against live shape
5. No auth/middleware in deploy

---

## 🚦 DEPLOY WORKFLOW

- Zip: always `Ghrava_DEPLOY.zip`, no version suffix
- Always `present_files` in chat
- Drop into `~/Downloads`, run `ghrava_deploy.ps1`
- `docker restart ghrava` for code; `--build` only when
  package.json changed
- **NEVER package after a single fix.** Bundle multiple per drop.

---

## 📝 SMALL THINGS NOT YET FIXED

- "↻ Dose updated" pill cosmetically untested
- `last_fill_quantity` shows `—` for old fills with no quantity
- EOB pre-import preview path unchanged (only post-import detail
  modal got the v.148 treatment)
- Per-device family scope only wired on medical page in v.148. Apply
  same `gh-scope-changed` listener pattern to insurance / documents /
  subscriptions / kids when those modules need it.

---

## 🛠 FILE MAP

```
app/
├── version.txt                          202604.148
├── shared/
│   └── autoTodos.js                     .148 rule 7b
└── public/
    ├── medical.html                     .148 — v2 contents merged in,
    │                                       v1 retired, all features incl.
    │                                       EOB modal + All tab + scope wiring
    ├── _card_previews.html              .148 — back-link href fixed
    └── js/
        └── lens-config.js               .148 — medical_all module added
```

NOT in this zip but related:
- `app/features/medical/routes.js` — unchanged
- `app/features/todos/routes.js` — unchanged (calls syncAutoTodos)
- `app/features/settings/routes.js` — owns /contacts/:id used by quick-views
- `app/public/nav.js` — owns family scope (localStorage + pill + picker)
- `app/public/shared.css` — global styles

NO LONGER EXISTS:
- `app/public/medical_v2.html` — merged into medical.html, file removed
  from source. The live NAS still has the file; clean it up by hand if
  desired (`Remove-Item Z:\ghrava\app\public\medical_v2.html`).

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

---

## ▶️ TO RESUME WORK

1. Read this file end-to-end.
2. `app/version.txt` for current version.
3. Check ✋ section first — verify with Al before assuming anything works.
4. Pick from "IN FLIGHT — NEXT DROP" priority order.
5. Confirm with Al before writing code.
6. Build, validate (5 gates), zip, present_files.

End of state.
