# Action Grammar & Cross-Module Links

**Status:** design / north-star — NOT a build plan. Captured 2026-05-28.
**Owner of vision:** Al (D). **Structure/rigor:** Claude (C).
**Why this doc exists:** so the cross-module connection model is recorded where it
gets read (per the "document decisions, scaled" agreement) and we don't lose track
of the agreed core links while delivering core functionality.

---

## 1. The core idea: the system is a grammar

Model reality as sentences, not as hand-coded feature pairs:

> **subject — verb — object  →  effects**

- "a *person* *donates* *clothing*"  → decrement qty, archive item, accrue tax value
- "a *person* *receives care* from a *doctor*" → visit (medical) + expense (finance) + reimbursement candidate (HSA)
- "a *vehicle* *gets* an *oil change*" → decrement filter/oil qty (inventory) + set next-service-due

You define a **vocabulary of verbs once**. Every future scenario is then just a
sentence in a language the system already speaks — so connections stop depending
on Al remembering to submit a scenario.

## 2. The other framing: each module is an API

A module exposes a **contract of verbs** (like API endpoints). Other modules call
those verbs without knowing the internals. Inventory's contract might be:
`acquire`, `move`, `consume(n)`, `dispose(type, value)`, `sell`. Maintenance calls
`inventory.consume(filter, 1)` the same way code calls an API — decoupled.

## 3. Two different things, only one is built

| | What it is | Status |
|---|---|---|
| **Link** | "these two records relate" (`record_links` row) | ✅ engine built — generic, idempotent, reviewable |
| **Effect** | a value *actually changes* in another module (qty drops, balance adjusts, deadline set) | ❌ **mostly missing — one-way today** |

**The frontier is effect propagation, not link discovery.** Every scenario Al has
raised (use a part, donate, doctor visit, oil change) is the *same* missing piece:
a verb that fires effects. Build that once → each scenario becomes a verb
definition, not a custom feature.

## 4. Substrate that already exists (don't rebuild)

- **Nouns** = entity tables (`items`, people, `accounts`…) ✅
- **Sentence log** = `logEvent` (inventory already logs its own events) + daily log (memory layer) ✅
- **Relationships** = `record_links` — generic typed graph, `ON CONFLICT DO NOTHING` (idempotent), confidence + `needs_review` ✅
- **Review surface** = `features/links/routes.js` — needs-review queue, manual create, confirm, delete, "links for entity X" ✅
- **Live auto-linkers** = medical-visit, HSA, subscriptions, subscription-category, eob-hsa-matcher ✅
- **Missing** = the **verb registry** + the **effect dispatcher** that reads a verb and applies its effects.

## 5. Verb definition shape (JSON)

```jsonc
{
  "verb": "donate",
  "subject": ["inventory_item", "wardrobe_item"],
  "effects": [
    { "op": "decrement_qty",  "target": "self",        "by": "$qty" },
    { "op": "archive",        "target": "self",        "when": "$qty == 0" },
    { "op": "log_event",      "target": "self",        "event": "donated" },
    { "op": "accrue_value",   "target": "tax_report",  "amount": "$value", "confidence": "needs_review" }
  ],
  "reversible": true,
  "idempotent_key": "$item_id + $date"
}
```
```jsonc
{
  "verb": "receive_care",
  "subject": ["person"],
  "object":  ["provider"],
  "effects": [
    { "op": "create_record", "target": "medical_visit" },
    { "op": "create_expense","target": "finance",  "confidence": "needs_review" },
    { "op": "flag_candidate","target": "hsa",       "confidence": "needs_review" }
  ]
}
```

## 6. Non-negotiable properties for any effect

1. **Idempotent** — firing twice never double-applies (rails already enforce this for links).
2. **Reversible** — undo a donation restores qty; undo a visit removes the expense.
3. **Confidence / review** — value-bearing or uncertain effects go to the review queue, not silently auto-posted (e.g. donation tax value, reimbursement candidate).

## 7. Scope discipline (C-role guardrails)

- **Do NOT build "the universal grammar engine."** Build a *thin* registry + dispatcher,
  seed with 2–3 real verbs, prove it, then grow by **data (verb defs), not code**.
- Map connections as design first; **we are explicitly NOT building all of them.**
- New module-sized features under the "done" banner = park them.

---

## 8. Agreed core links registry  *(fill as we agree — this is the source of truth)*

> Rule: a link only goes here once Al + Claude agree it's core. Keeps us from
> losing track while shipping. Columns: trigger verb → effect → modules → status.

**→ Now lives in `docs/CROSS-MODULE-VERBS.md` §4 (full per-module verb matrix + bugs there).**
Locked 2026-05-28/29: the four `items` disposition verbs.

| # | Verb / trigger | Effect | Modules | Auto / review | Status |
|---|----------------|--------|---------|---------------|--------|
| 1 | `sell` | income/txn + archive | inventory → finance | — | ✅ built |
| 2 | `donate` | qty↓/archive + accrue FMV → tax | inventory/wardrobe → finance/tax | review | ◑ columns exist, no effect |
| 3 | `consume(n)` | qty↓ N + log event | inventory → (maintenance later) | auto | ○ proposed |
| 4 | `discard` | qty↓/archive + reason | inventory | auto | ○ proposed |

**Sweep finding (2026-05-29):** the links layer is far more built than memory recorded —
`autoTodos.js` (obligation surfacing), `record_links` + 4 auto-linkers (event→link),
dailylog promotion (memory) all exist. Frontier = link-recorded → effect-propagated, and
unifying the scattered `auto-link-*.js` into ONE verb registry + dispatcher.

---

## 9. Open decisions

- [ ] First verb to actually build: pure-inventory (donate/consume) vs doctor-visit fan-out. *(C-recommendation: pure-inventory, to prove the registry cheaply.)*
- [x] **RESOLVED 2026-05-28 (live code):** `wardrobe` = typed VIEW over the `items` table
  (clothing categories + `wardrobe_*` columns) → clothing-donation is an **`items` verb**,
  defined once, serves inventory + wardrobe. `perfume` (`perfumes` table) and `books`
  (`books` table) are **standalone** domains with their own status/disposition concepts.
  → Build the effect dispatcher **generic, keyed on `(entity_type, entity_id)`** so it
  serves items/perfumes/books uniformly. Full detail: `docs/MODULE-FUNCTIONALITY.md`.
- [ ] Definition of "done" per module for the Sunday push — still being set per-module with Al.
