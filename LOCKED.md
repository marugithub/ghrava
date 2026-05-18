# LOCKED.md — single source of truth for finalized designs

Every locked visual design, schema rule, or architectural pattern that
chats must NOT re-derive. Each entry has a canonical source location.
The `check-locked` gate verifies that what this file claims exists
actually exists in `_templates.html` (for visual sections).

**Format:** `<id> | <type> | <canonical_source> | <locked_in> | <one-line>`

**Rule:** if a chat says "use the agreed X design", the correct response
is "which row in LOCKED.md?" If the row doesn't exist, the design
isn't locked — it's prose, and prose is drift.

## Visual designs (anchor = `id` attribute in `_templates.html`)

| ID    | Type     | Source                                            | Locked | What it is                                                |
|-------|----------|---------------------------------------------------|--------|-----------------------------------------------------------|
| #1    | tile     | `app/public/_templates.html#medication`           | v.130  | Medication card                                           |
| #2    | tile     | `app/public/_templates.html#inventory`            | v.130  | Inventory card                                            |
| #3    | tile     | `app/public/_templates.html#todo`                 | v.130  | Todo card                                                 |
| #4    | tile     | `app/public/_templates.html#subscription`         | v.130  | Subscription card                                         |
| #5    | tile     | `app/public/_templates.html#certification`        | v.130  | Certification card                                        |
| #6    | tile     | `app/public/_templates.html#condition`            | v.130  | Condition card                                            |
| #17   | primitive| `app/public/_templates.html#summary-tile`         | v.150  | Summary tile primitive — 5-zone (eyebrow/hero/pill/rows/strip) |
| #18   | tile-grid| `app/public/_templates.html#finance-tiles`        | v.150  | Finance Overview tiles — 6 tiles. Sub-tiles #18.1–.6 live inside this section. |
| #25   | tile-grid| `app/public/_templates.html#medical-tiles`        | v.166  | Medical Overview tiles — M1–M6 live inside this section. |
| #26   | reports  | `app/public/_templates.html#reports-design`       | v.167  | Reports design — 13 charts, 3 groups, drill-down mandatory. |
| #27   | pattern  | `app/public/_templates.html#auto-linkers`         | v.167  | Auto-linkers pattern — sub-rules #27.1–4 live here. |
| #28   | pattern  | `app/public/_templates.html#universal-attach`     | v.167  | Universal Attachments — one file, many record_links, refcount lifecycle. |
| #29   | report   | `app/public/_templates.html#pending-items-report` | v.171  | Pending Items Report — transaction-linking subsystem. List + grid views, three actions per row. |

> Sub-IDs (#18.1, M1, #26.1.5, #27.1, etc.) are NOT separate anchors —
> they're labeled blocks inside the parent section. Reference the parent
> anchor; chats grep within for the sub-ID.

## Schema rules (no anchor — source is migration file)

| ID         | Type    | Source                                            | Locked | Rule                                                                                              |
|------------|---------|---------------------------------------------------|--------|---------------------------------------------------------------------------------------------------|
| SHARED-FAM | table   | `app/db/migrations/001_initial*` (family_members) | v.001  | `family_members` is THE household-people table. No parallel tables. Kids/owners/patients reference this. |
| SHARED-CON | table   | `app/db/migrations/*contacts*`                    | v.130  | `contacts` is THE flat 8-type table. ALL external people (providers, vendors, emergency). `contact_type` distinguishes. NO `med_physicians`, NO `subscription_vendors`. |
| SHARED-LNK | table   | `app/db/migrations/129_record_links.js`           | v.157  | `record_links` is THE universal cross-module link table. Symmetric junction. No per-module link tables. |
| SHARED-ATT | table   | `app/db/migrations/*attachments*`                 | v.130  | `attachments` is THE universal file table. Polymorphic via `entity_type`/`entity_id`. v.169+: `record_links` integration per #28. |
| FIN-UNIFY  | table   | `app/db/migrations/130_rescue_126.js`             | v.159  | `accounts` + `transactions` are unified (banking + investment). `finance_accounts`/`financial_accounts`/`finance_transactions` are now VIEWS. Don't write to views. |
| FIN-FORECAST| route  | `app/features/finance/forecast.js`                | v.169  | `/api/v1/finance/forecast?days=N` is THE cash-flow projection endpoint. Reports #26.1.5 chart reads from this. |
| TX-RULES    | table   | `app/db/migrations/139_pending_items_subsystem.js` | v.171  | `tx_link_rules` is THE merchant→record auto-apply table. Per-tx ↔ record links go in shared `record_links` (left_type='transaction'). No `tx_record_links` table. |
| PEND-DISMISS| table   | `app/db/migrations/139_pending_items_subsystem.js` | v.171  | `pending_dismissals` records user "skip 30d" + "not a [module] expense" markers so the Pending Items Report doesn't keep resurfacing the same rows. |

## Architectural decisions (no anchor — source is the file enforcing)

| ID            | Source                                            | Locked | Rule                                                                    |
|---------------|---------------------------------------------------|--------|-------------------------------------------------------------------------|
| AUTH-OPEN-GET | `app/features/auth/middleware.js`                | v.166  | `requireAuth` passes GET/HEAD always. Only writes check session. `requireAuth` mounted only in `settings/` and `watcher/`. v.174 clarification: **prod has an app password set** (not "open mode" — that doc claim was stale). Writes need a session; the E2E gate must log in (`-AuthToken`). No step-up auth — one 365-day session only. |
| DB-NO-WAL     | `app/db/db.js`                                   | v.140  | `journal_mode=DELETE`, `synchronous=FULL`. Never WAL.                  |
| DB-NO-CASCADE | (migrations)                                     | v.140  | No new `ON DELETE CASCADE`. All data is interconnected; deletes are explicit. |
| MIG-ADDITIVE  | `app/db/migrations/UPGRADE_NOTES.md`             | v.140  | Migrations are additive only. Renames documented in UPGRADE_NOTES first. |
| BUILD-MODE    | `README_FOR_CHAT.md`                             | v.166  | Build mode default: confirm in 1 line, ask blocking Qs only, build, no recap, no package without "package". |
| CARDS-TILES   | `README_FOR_CHAT.md`                             | v.150  | "Card" and "tile" are interchangeable in Al's vocabulary. Same rendered component. |
| MULTI-VIEW    | `app/public/js/lt-core.js` (GH_VIEW)             | v.171  | Every listing page wires `GH_VIEW.init()` with at minimum grid+list. Some add a third (`gallery`, `card`). No single-view pages. |
| PLAIN-ENGLISH | `STATE.md` (Core Principles)                     | v.171  | All user-facing copy AND chat replies in plain English. No internal jargon on screen. Al is non-technical. |
| DATA-VERBS    | `STATE.md` (Core Principles)                     | v.171  | Ghrava exists to make personal data easy to (1) understand, (2) link together, (3) display. Every feature serves one of these three verbs. |
| EMPTY-STATE   | (multiple)                                       | v.166  | Tile structure ALWAYS renders. Values go to 0 / — / mute pill. Rows preserved. |
| ASTERISK-MATH | `app/features/pending/routes.js`                 | v.173  | Per-record asterisk math via `record_id` query param on `/api/v1/pending/asterisk`. THE canonical pending-state probe (+ `GhAsterisk.scan()` DOM helper). Card-config asterisk path (`gh-card-shared.js asteriskState`) is inert until the v.174 decision. Omitting `record_id` preserves the v.171 global probe. |

## How to add a new lock

1. Add the design/rule to its canonical source FIRST (`_templates.html` for visuals with a unique `id="..."`, migration file for schema, etc.).
2. Add a row here pointing at the canonical source.
3. Verify with `bash app/scripts/check-locked.sh` — it greps `_templates.html` for every visual row's anchor.
4. Bump version, ship in the same drop.

A row in LOCKED.md without the corresponding artifact = the gate fails the drop.
