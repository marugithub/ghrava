# Transaction Linking & Data Completeness — Design Note

**Status:** Approved patterns, awaiting implementation
**Last updated:** 2026-05-01
**Scope:** Cross-cutting subsystem — applies to every card with a cross-module strip

---

## Why this exists

Cards across modules show derived numbers (vehicle YTD fuel, medical HSA YTD,
inventory total paid, subscription annual cost). The underlying transaction
data already exists — `imported_transactions` populated by the bank-statement
import pipeline. What's missing is the per-record linking layer:
which Shell transaction goes to which vehicle, which CVS transaction belongs
to which prescription.

This note defines the patterns for (a) linking transactions to records,
(b) handling partial/missing data, and (c) surfacing pending work without
cluttering cards.

---

## Pattern 1 — The Pending Items Report

A single unified report — one page, rolled-up across all modules. Each row is
one piece of work needing user attention to close a data gap.

### Row shape

| Column | Purpose |
|---|---|
| Source | Module + record icon (e.g. ⛽ Vehicle, 💊 Medical) |
| Why it's pending | Generic prompt in plain English |
| Date | When the underlying record landed |
| Quick action | One-tap resolution where possible (assign vehicle dropdown, "enter cost" button) |
| Open | Link to full record |

### Generic prompts (locked language)

| Module · Trigger | Prompt |
|---|---|
| Vehicle · uncategorized fuel tx | "Categorize this fuel charge — which vehicle?" |
| Medical · Rx pickup, no cost | "Lisinopril picked up at CVS on May 1 — cost not entered" |
| Inventory · matching purchase tx | "$348 at Best Buy on Nov 14 — link to inventory item?" |
| Subscriptions · recurring tx | "$15.99 NETFLIX seen 3 months in a row — track as subscription?" |
| HSA · receipt missing | "$87 medical expense on May 1 — receipt not attached" |
| Career · cert renewal fee tx | "$369 to CompTIA on Aug 12 — link to cert renewal?" |
| Property · maintenance tx | "Home Depot $214 on Apr 3 — link to property project?" |

### Why one report, not per-module

- One workflow regardless of which module the gap lives in
- Cards stay clean — no badge clutter, no "you have unfinished business" anywhere
- Reviewing pending items is a deliberate, scheduled activity (e.g. weekly review), not a constant nag
- Future automation candidates are visible in one place (e.g. "Shell #4127 always goes to the 4Runner — auto-assign next time?")

### Where it lives

`/reports.html` — the existing reports page already planned for this kind of work.

---

## Pattern 2 — Three-layer Rx record (medical)

Pharmacy transactions are bag-totals, not per-Rx breakdowns. Three layers,
each a separate row, linked by a settlement group.

| Layer | Source | Confidence |
|---|---|---|
| 1. Bank tx | `imported_transactions` row, auto-imported | High on $, zero on attribution |
| 2. Manual entry | User enters per-Rx cost on pickup | High on attribution, manual entry risk |
| 3. EOB (backlog) | EOB upload + parse | Authoritative on insurance settlement |

For now (v1), only **layer 1 (auto)** and **layer 2 (manual)** are in scope.
Layer 3 (EOB ingestion) is deferred to backlog.

The Lisinopril card's "HSA YTD" reads from layer 2 (manual entries) and uses
the asterisk pattern below if any pickups have layer 1 (bank tx exists) but
no layer 2 (cost not entered).

---

## Pattern 3 — Asterisk for incomplete derived data

**The rule:** any derived number on any card gets a colored `*` when its
underlying records have known gaps. The number itself still renders — never
blank, never zero-by-default — because partial data is still valuable signal.

### Color semantics

| Marker | Meaning | Example |
|---|---|---|
| (none) | All underlying records complete and confirmed | "$642 YTD fuel" |
| <span style="color:#d97706;">*</span> (amber) | All records present but at least one is provisional / auto-categorized / unverified | "$642 *" — all 14 fuel transactions captured, 2 still need vehicle assignment |
| <span style="color:#dc2626;">*</span> (red) | At least one record in the rollup is missing a required field (cost, date, link) | "$123 *" — Lisinopril picked up 6 times, cost entered for only 4 |

### Interaction

- **Tooltip / long-press:** standard language — "This figure may be incomplete. N entries need attention. Tap to review."
- **Tap:** opens the Pending Items Report, pre-filtered to that card's slice (this med, this vehicle, this item).
- **Position:** immediately after the number, no space (`$123*`).
- **Size:** same as the number's font size.
- **Color contract:** red and amber as above. No other colors used for this pattern — keep the vocabulary tight.

### Universal application

The asterisk applies everywhere a derived number sits on a card:
- Cross-module strip values (HSA YTD, Log mentions, Last filled, YTD fuel, Service YTD, etc.)
- Progress bars (CEU progress, odometer toward service) — bar gets a small `*` label
- Any roll-up count (attachments, linked records) — though these are usually exact

It does **not** apply to:
- Single-record fields (a med's dose, a vehicle's plate) — those are either present or empty, no derived ambiguity
- Hard counts that can't be incomplete (number of conditions linked, number of family members)

### Why this is the right pattern

- Honest — never hides a known gap
- Cheap visual cost — one character, no card growth
- Discoverable — hover/tap explains, doesn't require user to know the rule
- Self-extinguishing — asterisk goes away the moment the gap is closed
- Universal — same glyph, same color logic, every card, every module

---

## Pattern 4 — Vehicle/merchant assignment workflow

For gas (and any other "single tx → single record" pattern):

1. Statement imports a tx, category auto-applied via `import_category_rules`
2. If category is one that needs per-record linking (Transportation → vehicle,
   Subscriptions → subscription record, Medical → prescription, etc.) AND
   the merchant doesn't yet have a remembered link, the tx lands in the
   Pending Items Report
3. User assigns once via the report's quick-action dropdown
4. App writes a `tx_link_rules` row: merchant pattern + category → target record type + ID
5. Future txs from same merchant auto-link, never appear in the report
6. User can review/edit rules in `/settings/import-rules.html`

Same pattern for medical (CVS → user picks Rx the first time, but because
multiple Rx per bag the rule is "ask every time" rather than auto-link).
Config flag on the rule: `auto_apply` vs `prompt_each_time`.

---

## Schema additions (additive, low-risk)

```sql
-- Link a transaction to a specific record in another module
CREATE TABLE tx_record_links (
  id              INTEGER PRIMARY KEY,
  transaction_id  INTEGER NOT NULL REFERENCES imported_transactions(id),
  module          TEXT NOT NULL,        -- 'vehicle', 'medical_med', 'inventory', etc.
  record_id       INTEGER NOT NULL,
  amount_share    REAL,                 -- NULL = whole tx; partial when one tx splits across records
  source          TEXT NOT NULL,        -- 'manual', 'rule', 'auto'
  created_at      DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_txlink_tx     ON tx_record_links(transaction_id);
CREATE INDEX idx_txlink_record ON tx_record_links(module, record_id);

-- Remember merchant→record assignment for future auto-application
CREATE TABLE tx_link_rules (
  id              INTEGER PRIMARY KEY,
  merchant_pattern TEXT NOT NULL,       -- SQL LIKE
  category        TEXT,                 -- optional secondary filter
  module          TEXT NOT NULL,
  record_id       INTEGER NOT NULL,
  auto_apply      INTEGER NOT NULL DEFAULT 1,    -- 0 = always prompt
  is_active       INTEGER NOT NULL DEFAULT 1,
  created_at      DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

Both additive, no `ON DELETE CASCADE`, fits Ghrava's data-safety rules.

---

## What this unlocks per card

| Card | Today (without this) | With this subsystem |
|---|---|---|
| Vehicle | Household fuel total only | Per-vehicle YTD fuel, accurate |
| Medical med | Manual cost entry only | Auto-flag missing entries via red asterisk |
| Inventory | Manual paid-amount only | Auto-suggest links from purchase txs |
| Subscriptions | Manual entry | Auto-detect from recurring patterns |
| HSA | Manual entry | Cross-check txs against HSA eligible category |
| Career | Manual fee entry | Renewal-fee tx auto-linked to cert |

The cards stay exactly as designed. What changes is whether the numbers on
them are accurate by default, or require manual upkeep.

---

## Change log

- **v1 — 2026-05-01** — Initial. Pending Items Report, three-layer Rx pattern,
  red/amber asterisk for derived-number completeness, vehicle/merchant
  assignment workflow, schema additions.
