# Cross-Module Verb & Link Tracker

**Purpose:** the single place to track how modules connect — each module's **verbs**
(its API contract) and the **effects** those verbs fan out to other modules. Built to
answer the architecture question: *what should the centralized effect dispatcher support?*

**Companion docs:** per-module functionality detail = `docs/MODULE-FUNCTIONALITY.md`;
the grammar model + design = `docs/superpowers/plans/2026-05-28-action-grammar-cross-module-links.md`.

**Swept from live code 2026-05-29.** 19 modules total (15 domain + inventory/wardrobe/perfume/books).

---

## 1. HEADLINE: the moat is far more built than we thought

The "links/effects" layer is NOT greenfield. Already wired in live code:

| Existing mechanism | What it already does | Pattern it implements |
|---|---|---|
| **`shared/autoTodos.js`** (todos) | scans **9 modules** every GET, upserts/resolves auto-todos (refills, expiring warranties, missing HSA receipts, overdue follow-ups) w/ back-pointers + recurrence | **recurring obligation → surface** ✅ |
| **`maintenance /upcoming` + /summary** | aggregates property + vehicle + item due-dates into one "next 90 days" + overdue rollup | **recurring obligation** (assets) ✅ partial |
| **finance import auto-linkers** | on every import fires `auto-link-hsa`, `auto-link-medical-visit`, `auto-link-subscriptions`, `auto-link-subscription-category` → write `record_links` | **event → cross-domain link** ✅ |
| **`eob-hsa-matcher`** (medical/hsa) | EOB claim → HSA payment match (patient+date±30d+amount±$2), confidence tiers → record_links | **event → effect** ✅ |
| **dailylog `promoted_to_type/id`** | a log entry can be promoted into a todo/visit/note | **memory → action** ✅ |
| **documents `document_item_links`** | a document backs an item | **proof spine** ✅ partial (items only) |
| **`record_links`** + review queue | generic typed graph, idempotent, needs_review surface | **link substrate** ✅ |

**Implication for the build:** we are NOT building the links layer from scratch. We are
(a) closing the gap from *link recorded* → *effect propagated* (qty/balance/value actually
change), and (b) generalizing the existing piecemeal auto-linkers into ONE verb registry +
dispatcher. Several patterns (obligation surfacing, memory promotion) are essentially done.

---

## 2. The four 360° patterns — where each stands

| Pattern | Status | Lives in |
|---|---|---|
| event → cross-domain **effect** | **PARTIAL — links recorded, effects not propagated** (the real frontier) | finance/medical/hsa auto-linkers |
| accumulator → deadline | PARTIAL | career CE→renewal; finance recurring |
| recurring obligation → surface | **MOSTLY BUILT** | `autoTodos.js`, `maintenance/upcoming` |
| shared spine (people/docs/contacts) | BUILT | family_members, contacts FKs, document_item_links |

---

## 3. Per-module verb matrix (the API contracts)

Legend — Effect status: ✅ wired · ◑ link-only (no effect propagation) · ○ proposed/none

### Money cluster
| Module | Key verbs | Cross-module effect | Status |
|---|---|---|---|
| finance | reconcile, categorize, void, import, snapshot-net-worth | fires 4 auto-linkers; writes todos (gift-card expiry) | ✅ links / ◑ effects |
| hsa | reimburse, link-to-visit/eob, record-mileage, mark-eligible | eob-hsa-matcher → record_links | ✅ links / ◑ effects |
| subscriptions | pause, resume, renew, cancel(prop) | auto-link → txn (pays_for) + category copy | ✅ |
| insurance | renew, cancel | none (FK lookups only) | ○ |
| trading | save-report, archive-analysis | writes documents row | ✅ (one-way) |

### Asset / household cluster
| Module | Key verbs | Cross-module effect | Status |
|---|---|---|---|
| inventory (`items`) | **sell ✅ / donate / consume / discard** (CORE), acquire, move | sell→archive; consume→qty↓ (target of maintenance) | ◑ donate/consume effects MISSING |
| wardrobe (view over `items`) | inherits item disposition verbs; wear-log, outfit, plan | donated_fmv column exists (no tax effect) | ◑ |
| property (+vehicles) | acquire-asset, service-asset, retire-asset | contacts FK; feeds maintenance/upcoming | ◑ |
| maintenance | complete-maintenance, schedule-next-service | **should** consume inventory parts + set next-due | ○ THE oil-change gap |
| perfume (own table) | create/update; layers | none | ○ (has amount_level depletion) |
| books (own table) | shelf-status, archive | none | ○ |

### People / time cluster
| Module | Key verbs | Cross-module effect | Status |
|---|---|---|---|
| medical | receive-care, log-fill, record-metric, import-eob | richest: EOB→HSA, txn→visit, auto-fund-hsa | ✅ links / ◑ effects |
| career | log-learning, accrue-CE-hours, complete-renewal-cycle | creates renewal todos | ✅ (accumulator→deadline) |
| kids | record-note, archive-kid, sync-family-roster | reads med visits; syncs family_members | ◑ (read-only) |
| family-snapshot | (read-only) | aggregates ~15 tables | n/a surface |

### Cross-cutting spine
| Module | Key verbs | Role | Status |
|---|---|---|---|
| todos | complete, dismiss, snooze, **auto-sync**, spawn-recurrence | **obligation surfacer** (reads 9 modules) | ✅ BUILT |
| dailylog | quick-capture, promote-to-{todo,visit,note} | **memory layer** | ✅ BUILT |
| documents | link-document-to-{entity} | **proof spine** | ◑ items only |
| receipts | save-template (MISNAMED — see below) | inventory-report util | ○ real ingest verb missing |

---

## 4. Core verbs registry — LOCKED (Al + Claude agreed 2026-05-28/29)

The four disposition verbs on `items` (serve inventory + wardrobe; dispatcher generic for perfume/books):

| # | Verb | Effect | Modules | Auto/review | Status |
|---|------|--------|---------|-------------|--------|
| 1 | `sell` | income/txn + archive | inventory → finance | — | ✅ built |
| 2 | `donate` | qty↓/archive + accrue FMV → tax | inventory/wardrobe → finance/tax | review | ◑ columns exist, no effect |
| 3 | `consume(n)` | qty↓ N + log event | inventory → (maintenance later) | auto | ○ proposed |
| 4 | `discard` | qty↓/archive + reason | inventory | auto | ○ proposed |

**Parked (real, not core yet):** acquire→expense, insurance scheduled-property manifest,
all read-only "surfacing" (handled by reports/autoTodos), maintenance→parts auto-fire
(needs the consume verb first, then maintenance calls it).

---

## 5. Bugs found during the sweep (for a hardening pass)

| Sev | Module | Issue |
|---|---|---|
| HIGH | property | `property_maintenance` routes defined AFTER `module.exports` (305-382) — verify they register |
| HIGH | documents | `routes.js:98` calls undefined `withTags(doc)`; `:120` stray arg to db.prepare |
| MED | hsa | `auto-link-hsa.js:37-38` SELECTs `hsa_payments.family_member_id` — column may not exist |
| MED | books | duplicate `fetch-cover`/`ensureBookDirs`/`downloadBuffer` defs; 2nd handler dead code |
| LOW | finance | reports.js UNIONs legacy txn tables; manual POST txn skips category-rules |
| LOW | kids | family-sync runs every GET; display_name string match fragile |
| LOW | trading | trading.json deep-merge drops non-apiKeys settings |
| NOTE | receipts | misnamed; no real receipt→item+txn ingest exists (gap) |

---

## 6. Architecture takeaway (for centralization)

1. **Build one generic effect dispatcher** keyed on `(entity_type, entity_id)` + a verb
   registry (JSON defs). It replaces the scattered `auto-link-*.js` files over time.
2. **Reuse, don't rebuild:** `record_links` (links), `autoTodos.js` (obligation surfacing),
   `dailylog` promotion (memory), review queue (confidence). The dispatcher writes through these.
3. **First verb to prove it:** `consume`/`donate` on `items` (pure inventory, no other module
   needed) — see open decision in the design doc.
4. **The gap everywhere is the same:** link recorded ≠ effect applied. Closing that, generically,
   is the whole game.
