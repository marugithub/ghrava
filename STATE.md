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
existing rows with `UPDATE imported_transactions SET fingerprint =
new_hash` in a migration.

### 2. Pending → posted window for dedup

Pending and posted versions of the same charge often have different
dates. Add second-layer check: same account + same amount (within
$0.01) + within 5 days + similar normalized description → flag, not
silent skip. Already partially wired (the `flagged=1` field exists);
extend the SQL window from "same date" to "5-day window" and add
description-similarity check.

### 3. Sign-convention spec tests (finance parsers)

No automated test today proves the sign convention is right per
bank. A future parser change could flip a sign silently and corrupt
every Chase or Schwab transaction. Add fixture CSV + expected
output JSON per parser (one file per bank), assert on import. Lives
in `app/test/parser-fixtures/`. Run via `npm test` or `node test/run-parser-tests.js`.

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

### 9. EOB parsing — multi-carrier expansion

Currently MHBP only. Each carrier has different PDF layouts:
- MHBP (✅ wired)
- BCBS (❌ — Al will upload sample)
- Aetna, Cigna, UHC, Kaiser (❌ — only as needed)

Plan: keep `eob-parser.js` as the dispatcher (already reads
`app_config.eob_parser` to pick which carrier's parser to run).
Add one parser file per carrier (`eob-parser-bcbs.js`, etc.).
Settings UI to auto-detect or pick parser per file. Each carrier
parser exports the same shape: `{statement_date, member_id,
plan_name, claims: [{patient, provider, claim_id, services: [...]}]}`.

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
> Al will upload an EOB folder for parser work.

### What exists today

- **`features/medical/eob-parser.js`** — single parser, MHBP-only.
  Returns array of statements with claims and services nested.
- **`app_config.eob_parser`** — config row that picks which parser
  to run. Default `'mhbp'`. Other values currently throw "not
  implemented."
- **`/eob/preview` and `/eob/import` endpoints** — call
  `getEobParser()` then dispatch to the named parser.
- **Watcher** — calls same `parseEobPdf` for files dropped in
  `_inbox/eob/`.
- **Per-claim `family_member_id`** — populated by `resolvePatient()`
  during import. Names that don't match a family member exactly
  get flagged into `med_pending_review`.

### Gaps Al needs to know about (in plain English)

1. **Only MHBP works.** Drop a BCBS, Aetna, Cigna, UHC, or Kaiser
   PDF and the parser will say "no statements detected" and reject
   the file. Each carrier has a different PDF layout, so each
   needs its own parser file.

2. **No way to pick a parser per file.** Today it reads
   `app_config.eob_parser` globally. If you have MHBP for one
   family member and BCBS for another, you'd have to flip the
   global setting between uploads. Needs a per-file selector or
   auto-detect from PDF text patterns.

3. **EOB → HSA receipt matching** is *designed* (chat-7), not
   *built*. The design: when a new HSA receipt is saved, look for
   matching claims (same patient + service date + amount) and link
   them. When a new EOB is imported, do the reverse. Status of
   actual code: **uncertain — needs verification** before promising
   users it works.

4. **Amount mismatch UX missing.** When EOB says "you owe $142.18"
   but receipt has $145, neither one is "wrong." The two should
   show side-by-side with the delta highlighted, user picks which
   to trust. Designed, not built.

5. **EOB-arrives-before-receipt** case has a "retry hook" design —
   on every new receipt save, check for pending EOB matches —
   uncertain if wired.

6. **No EOB cards on the medical "All" tab cross-domain link.**
   Today EOB cards show on their own tab and on All, but they
   don't visually link to which medication or visit they covered.
   Should an EOB card show pills like "Lisinopril · Annual visit"
   when it covers those? Designed loosely, not built.

7. **EOB folder-drop persistence.** Watcher's `importEob` counts
   imports but supposedly "doesn't save." Status uncertain — past
   STATE.md said this was a v140 loose end. Verify before
   promising.

### Plan when Al uploads the EOB sample folder

1. Identify each file's carrier (probably mix — MHBP + maybe BCBS
   and others).
2. For non-MHBP carriers, write `eob-parser-<carrier>.js`. Each
   exports `parseEobPdf(buffer, filename)` returning the same
   shape MHBP does.
3. Replace the single-parser dispatch in
   `features/medical/routes.js` with a multi-parser dispatcher
   that auto-detects from the first page (regex on insurer name,
   member ID format, etc.).
4. Test against Al's folder, verify field extraction is right,
   verify dedup works across carriers (insurer + member_id +
   statement_date is the natural key — should be globally unique).
5. Add the carrier picker to the `/eob/preview` upload UI as a
   fallback when auto-detect fails.

This is a multi-session piece of work. Don't rush it.

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
