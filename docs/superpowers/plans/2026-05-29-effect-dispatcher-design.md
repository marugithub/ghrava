# Effect Dispatcher — Design Draft

**Status:** DRAFT for Al's review (2026-05-29). Implements the action grammar from
`2026-05-28-action-grammar-cross-module-links.md`. Companion: `docs/CROSS-MODULE-VERBS.md`.

**One-line:** a single generic mechanism that takes a **verb** applied to a **subject**
and fires its **effects** across modules — recorded so it can be undone — replacing the
scattered `auto-link-*.js` files over time and closing the "link recorded ≠ effect
propagated" gap.

---

## 1. The key architectural split: primitives (code) vs verbs (data)

This is what makes "grow by data, not code" actually work:

- **Effect primitives** = a SMALL, FINITE set of operations written in code (~8). These are
  the only things that touch the database.
- **Verbs** = DATA (a registry) that *compose* primitives. Adding a new verb = adding a
  registry entry, NOT writing code.

So the system speaks an unbounded vocabulary of verbs, built from a fixed alphabet of primitives.

### The primitive alphabet (code — implement once)
| Primitive | What it does | Reversible by |
|---|---|---|
| `decrement_qty(type,id,n)` | subtract n from quantity | increment back |
| `archive(type,id,reason)` | soft-archive a record | unarchive |
| `set_field(type,id,field,val)` | write one field (captures old value) | restore old value |
| `log_event(type,id,event,data)` | append to the entity's event log (memory) | delete event row |
| `record_disposition(type,id,kind,value,meta)` | write a disposition row (sold/donated/etc. + value) | delete row |
| `create_link(left,right,kind,conf)` | **reuse `shared/auto-link.js`** | delete link |
| `create_todo(...)` | **reuse todos** (deadline/next-due) | delete todo |
| `adjust_balance(accountId,delta)` | stateful money move (HSA/account) — CAREFUL | reverse delta |

That's the whole alphabet. Everything else is composition.

## 2. Components

```
app/shared/effects/
  primitives.js   ← the 8 ops above (the only code that mutates)
  verbs.js        ← the verb registry (DATA: verb → effects[])
  dispatch.js     ← applyVerb() + reverseAction()
```
Plus ONE new migration: an **action ledger** (see §4).

## 3. A verb definition (data)

```js
// verbs.js
donate: {
  subjects: ['item'],            // items table → serves inventory AND wardrobe
  effects: [
    { op: 'decrement_qty',       args: { n: '$qty' },                 confidence: 'auto' },
    { op: 'archive',             args: { reason: 'donated' }, when: '$qty_reaches_zero', confidence: 'auto' },
    { op: 'record_disposition',  args: { kind: 'donated', value: '$fmv', meta: '$org' }, confidence: 'auto' },
    { op: 'log_event',           args: { event: 'donated' },          confidence: 'auto' },
  ],
  reversible: true,
}
consume: {
  subjects: ['item'],
  effects: [
    { op: 'decrement_qty', args: { n: '$qty' },        confidence: 'auto' },
    { op: 'log_event',     args: { event: 'consumed', data: '$reason' }, confidence: 'auto' },
  ],
  reversible: true,
}
```

**The donation→tax link is PULL, not PUSH** (important simplification): we do NOT maintain a
running "tax total" somewhere. The donation's value is recorded once (`record_disposition`),
and the tax/donations **report SUMs disposition rows** for the year. Pull = one source of
truth, nothing to keep in sync. We only PUSH (mutate another table) for genuinely stateful
things — qty, account balance.

## 4. The action ledger (reversibility + audit + idempotency)

One new pair of tables. Every verb application writes here.

```
actions
  id, verb, subject_type, subject_id, payload(JSON), actor,
  status('applied'|'reversed'|'needs_review'), created_at, reversed_at
action_effects
  id, action_id, op, target_type, target_id,
  before(JSON), after(JSON),        ← before/after = how we reverse
  confidence, needs_review
```

This single ledger gives us **all three** hard requirements at once:
- **Reversible:** undo = replay `action_effects` in reverse using `before` snapshots.
- **Idempotent:** the action id is the dedupe key; re-firing the same logical action is a no-op.
- **Audit/memory:** the ledger IS the history of everything that happened across modules.

## 5. The dispatcher (control flow)

```
applyVerb({ verb, subjectType, subjectId, payload, actor }):
  def = verbs[verb]                       // look up definition
  tx:                                     // one DB transaction
    action = insert actions row
    for each effect in def.effects:
      if effect.when not satisfied → skip
      before = snapshot(target)
      run primitive (or queue if confidence != 'auto')
      insert action_effects row (before, after, needs_review)
    action.status = anyNeedsReview ? 'needs_review' : 'applied'
  return { actionId, effects, needsReview }

reverseAction(actionId):
  for each effect in reverse order: apply inverse using `before`
  action.status = 'reversed'
```

Synchronous + transactional (matches better-sqlite3). All-or-nothing per action.

## 6. Reuse, don't rebuild

| Need | Existing piece reused |
|---|---|
| record links | `shared/auto-link.js` (createLink/findLink) |
| obligation surfacing | `shared/autoTodos.js` (create_todo feeds it) |
| memory/history | `logEvent` pattern + the new action ledger |
| confidence / review | `record_links.needs_review` + the links review UI pattern |
| disposition columns | wardrobe's existing `items.sold_*/donated_fmv/discarded_reason` |

Existing `auto-link-*.js` stay AS-IS for now (they work). Later they become auto-fired verbs.
**Nothing gets ripped out to build this.**

## 7. Build slices (incremental)

1. **Slice 1 — skeleton:** ✅ **SHIPPED v.211 (202605.211 @ bc46c8f, 2026-05-29).** migration 146
   (action ledger) + `primitives.js` (decrement_qty, archive, set_field, log_event) +
   `dispatch.js applyVerb/reverseAction` + verbs `donate`,`consume` + generic `/api/v1/actions`
   (history + reverse) + inventory `POST /items/:id/donate` via `applyVerb`. **Verified live:**
   validator 680 stmts exit 0; 15/15 HTTP live-tests (create → donate qty↓ + FMV + status →
   history → reverse restores → double-reverse 409 → donate-all archives-on-zero → reverse
   un-archives → cleanup); smoke 8/8. **Slice 1 COMPLETE — donate UI shipped v.212 (202605.212 @
   bfcefd8):** Donate button beside Mark-as-Sold → Donate drawer (qty/FMV/donated-to) → dispatcher
   endpoint; mirrors Sell per build standards. Verified: full E2E 117/0, served page carries the UI.
2. **Slice 2 — report pull:** a donations/disposition report that SUMs the ledger (proves PULL).
3. **Slice 3 — generalize:** add `discard`; make the dispatcher key on `(entity_type,id)` so
   perfume/books can use it.
4. **Slice 4 — migrate a linker:** reframe ONE existing auto-linker (e.g. subscriptions) as an
   auto-fired verb, proving the unification path. Only after 1-3 are solid.

## 8. DECISIONS — RESOLVED with Al 2026-05-29

- **D1 — Undo:** ✅ **YES.** Build the action ledger; every action reversible + fully audited.
- **D2 — Automation default:** ✅ **MIXED.** Same-item state changes (qty↓, archive) auto-apply;
  value/tax + cross-module money moves land in a **review queue** for confirmation first.
- **D3 — First verb (Slice 1):** ✅ **`donate`** (proves the full chain incl. tax PULL).

## 8a. BUILD STANDARDS (Al, 2026-05-29) — binding on every slice
Per [[al-owns-visual-design]]. Build to the EXISTING bar; do not invent or regress.
1. **Centralized / shared code** where applicable — no copy-paste; reuse `shared/*` (errors,
   auth, tags, familyMembers, auto-link, logEvent). The dispatcher/primitives ARE the
   centralization — use them, don't sidestep them.
2. **Match existing page patterns exactly:** the **lens search** on pages, and the
   **standardized button/nav row** (e.g. inventory's ✕ Cancel · ✓ OK/Add · 💾 Save row).
   Donate UI must mirror the existing **Sell** action's look & placement.
3. **Clean, well-documented code** — header comment block + inline context like the rest of
   the codebase. NOT a "random dump" / "1990s look." Modern standards, consistent naming.
4. **Visual changes are Al's lane:** Claude builds functionality + MATCHES current styles.
   Net-new visual design is requested by Al from claude.ai web (visual-only, no code changes).
   If unsure what to match → ASK, don't invent.
5. **Schema work follows the `ghrava-schema-safety` gate** before any deploy (the new migration
   for the action ledger triggers this).

## 9. Open/parked
- Source of truth for dispositions: ledger (truth) + denormalized item columns (cache for
  wardrobe UI). Keep columns populated for back-compat; report reads ledger. (Technical; not Al's call.)
- `adjust_balance` (HSA/account push) deferred until after inventory verbs prove the pattern.
