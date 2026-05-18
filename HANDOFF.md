# HANDOFF — for the next chat

Read `START_HERE.md` first (it's short). Then read this once, top to
bottom. After that, treat it as reference.

---

## Where things stand (updated 2026-05-17)

Ghrava is a self-hosted household management app Al runs on a QNAP NAS
at `192.168.4.62:3001`. It's Node.js/Express + SQLite + vanilla JS in
a Docker container. Al is both the only user and the only developer.
Claude (you, in past chats) writes all the code. Al directs every
feature.

**Live on the NAS: v202604.172** — verified 2026-05-17 (container `Up`
~11h, `app/version.txt` = `202604.172`, logs clean). The NAS jumped
from prod `170.1` straight to `172`, so **v.171 and v.172 are both
live**. The previous "sandbox 171 / prod 170.1" note was stale doc
drift and has been corrected here and in STATE.md.

**v.173 built + pushed, NOT yet packaged/deployed.** Asterisk
subsystem: per-record math on `/api/v1/pending/asterisk` (back-compat
preserved) + HSA Eligible-Expenses tile wired as the canonical
example. Full scope in **STATE.md → "✅ v.173 SHIPPED"**; deferred
work in **BACKLOG.md → "🔮 v.174 CANDIDATES"**. Against the live v.172
NAS the `asterisk-per-record` spec is intentionally red until Al
packages and deploys v.173.

### v.171 in two sentences
- Closes out the finance module per Al's PM direction. Built the
  transaction-linking subsystem (Pending Items Report at
  `/reports.html?tab=pending`), the red/amber asterisk pattern for
  derived numbers on any card, monthly budget target rollup on
  finance Tile-2, and "+ Set target" buttons on the Unbudgeted list.
- Also added six new Core Principles at the top of STATE.md (data
  verbs, plain English × 2, package safely, tile=card, multi-view
  standard) that govern every future drop.

### What's new in v.171 — file map
- `app/db/migrations/139_pending_items_subsystem.js` — `tx_link_rules`, `pending_dismissals`, budgets index. Additive only.
- `app/db/migrations/140_v171_schema_alignment.js` — defensive column alignment so fresh-install schema matches prod (closes 4 schema gate failures).
- `app/features/pending/routes.js` — full Pending Items Report API + `applyRulesToTransaction()` exposed for the import hook.
- `app/features/import/routes.js` — calls `applyRulesToTransaction()` after each new tx insert (Shell→Honda auto-link).
- `app/features/finance/routes.js` — Tile-2 cash_flow extended with `budget_target`, `budget_spent`, `budget_pct`.
- `app/features/data/routes.js` — added `GET /api/v1/data/table?name=<table>` with allowlist for picker dropdowns.
- `app/server.js` — mounts `/api/v1/pending`.
- `app/public/reports.html` — Pending tab added, tab badge wired.
- `app/public/finance.html` — Tile-2 budget target row, "+ Set target" buttons on Unbudgeted list, `openBudgetDrawer(id, prefillCategory)` accepts a prefill.
- `app/public/js/pending-report.js` — full UI: list + grid via GH_VIEW, per-module pickers, dismiss, skip, asterisk helper (`GhAsterisk.scan()`).
- `app/public/js/lens-config.js` — added `pending` module.
- `app/public/_templates.html` — new section `#29 Pending Items Report` locked.
- `app/public/help.html` — 4 new commands.
- `LOCKED.md` — added rows: `#29`, `TX-RULES`, `PEND-DISMISS`, `MULTI-VIEW`, `PLAIN-ENGLISH`, `DATA-VERBS`.
- `STATE.md` — Core Principles block (6 numbered) + v.171 scope section. Plain-English-in-chat rule is now binding.
- `BACKLOG.md` — Cash-flow forecast chart wiring requeued to v.172 (less urgent per Al). EOB folder-drop dropped (site upload only).
- `app/version.txt` — `202604.171`.
- `app/.claude/skills/ghrava-schema-safety/scripts/validate-schema.py` — added to repo (with REPO_ROOT depth fix). Now the schema gate actually runs on a fresh clone. Migrations 137 + 138 reformatted to use backtick `db.exec` so the validator can see their ALTERs.

### Gates (run at packaging time)
```
✓  syntax          pass
✓  schema          pass
✓  locked          pass
✓  lens            pass
✓  commands        pass
✓  prose           pass
✓  shared          pass
✓  smoke           pass
✓ 8 gates passed
```

### Next chat's task list (in order)
1. ~~Verify v.171 deployed cleanly.~~ **DONE 2026-05-17** — NAS is live on v.172 (which includes all of v.171), container stable ~11h, logs clean. No action needed; superseded by the v.172 backlog below.
2. **v.172 priority backlog (Al's direction "after finance we go across whole system; fast, functional, clean, user friendly"):**
   - ~~Wire `_templates.html #26.1.5 Cash-flow forecast` chart to live data.~~ **SHIPPED in v.172** (commits `3ee0ddc` + `2f184a8`, live on NAS).
   - ~~Audit cards for the asterisk pattern and wrap with `.gh-pending-target` / `GhAsterisk.scan()`.~~ **AUDITED 2026-05-17 — do NOT wire as originally written.** The audit found none of the three named cards (vehicle fuel YTD, medication HSA YTD, HSA spent-YTD tile) can be wired as-is, and that two asterisk mechanisms exist with no backend feeding either. Full findings, per-card blockers, and the ordered close-first list are in **`BACKLOG.md` → "📋 v.173 CANDIDATE — Asterisk audit findings"** (top of file). Treat that backlog entry as the spec for any future asterisk work; do not re-derive it.
   - Pick the next module to harden using the same plain-English/multi-view/link/display lens.

---

## Original handoff context (kept for reference)



The current production version is **v202604.170.1**. It went out
yesterday after a longer session where two things happened in one drop:

1. **Finance finalization** — six schema bugs in the finance routes
   were fixed, a real Budgets UI was wired up (it had been a stub),
   and a cash-flow forecast endpoint shipped with a 30/60/90-day
   chart. That work had been carried over from a previous chat that
   never packaged.

2. **Gates-over-docs** — the real reason the session got long. Past
   chats kept claiming to have "read STATE.md" and then writing code
   that ignored the rules in it. Twice, a chat said "saved tile design
   to templates" and didn't. The fix was to demote the docs from
   required reading to reference material, and put the rules into
   scripts that fail the drop if violated. There are now 8 gates
   (`bash gates.sh`) covering syntax, schema, locked-design integrity,
   lens-config completeness, command discoverability, prose drift,
   shared-table parallelism, and endpoint smoke. Definition of "done"
   is now "8 gates green, output pasted" — claims aren't accepted.

The combination shipped as v.170. A hotfix v.170.1 followed because
the validator's migration-replay disagreed with prod on two column
names (`import_batches.row_count` vs `rows_total`, and `todos`
missing two Google sync columns). Those were closed by reverting
the code in one case and adding a defensive migration in the other.
After the hotfix, prod's live validator returns **0 failures across
619 prepared statements**.

---

## What you're inheriting

A working app on v.170.1 with a clean schema and a contract that
mechanically prevents the failure modes that wasted time before.
Specifically:

**The schema-safety skill** (`app/.claude/skills/ghrava-schema-safety/`)
contains the validator that catches "no such column" bugs before
deploy. The 4-step workflow is in the skill's SKILL.md but the short
version is: read SCHEMA.md, write the SQL with a `// schema:` comment
naming the columns, run `bash gates.sh schema`. Skip any step and
you'll ship a container that won't start.

**LOCKED.md** is an enumerable list of every locked design — tile
layouts (#1 through #28), schema rules (SHARED-FAM, SHARED-CON, etc.),
and architectural locks (AUTH-OPEN-GET, DB-NO-WAL, etc.). When Al
says "use the agreed X design," your move is to ask "which row in
LOCKED.md?" If he can't point at one, the design isn't actually
locked yet — build it into `_templates.html` first, add a row, then
write code.

**STATE.md** is the running version log. It's long. Don't read it
top to bottom; `grep` for the version you care about. The most
recent version (v.171) is at the top.

**BACKLOG.md** lists every deferred idea with effort estimates and
why it was deferred. The "Next up" section there is your menu.

**`bootstrap.sh`** is what you run at the start of every chat. It
prints version, gate status, last 5 versions, top backlog, locks
count. Paste its output before doing anything else.

---

## What you'll probably build next

Al hasn't decided yet. The strongest candidates are:

**Today page** — the highest UX leverage item still pending. Locked
design exists but was never built. It would replace
`dashboard.html` as the landing page. Two sections: "Now" (due
today / overdue, red) and "Soon" (next 7 days, amber). Snooze
button per row. The endpoint shape is sketched as `/api/v1/today`
with aggregation from subscriptions, documents, insurance, and
todos. Estimate: medium drop, ~half a session.

**Universal Attachments (#28)** — a longstanding refactor where
every module's file-handling collapses into the shared `attachments`
table with `record_links` for cross-module references. The design
is locked in `_templates.html#universal-attach`. The right way to
ship it is in three sub-drops: schema migration first, then convert
Inventory + HSA + Medical (the most-used surfaces), then the
remaining 11 modules. Estimate: 3 sessions, one per sub-drop.

**Reports live wiring** — the forecast endpoint shipped in v.169
but the chart on the Reports tab is still a mockup. Wiring it is a
small frontend job; the data's already there. Estimate: small drop,
~hour. The Money group has 5 other charts in the same state.

**Security cleanup** — small but important. The `/file/:id` and
`/thumb/:id` routes lack path allowlists (a request with `..` in
it could escape the attachments dir). The attachments insert route
should allowlist `entityType` instead of accepting any string.
`window.esc` in the frontend doesn't escape `/` or `'`. None of
these are exploitable in practice given Ghrava is single-user
behind Tailscale, but they're sloppy. Estimate: small drop.

Pick whichever Al wants. They're all independent.

---

## Things that are subtle

A few traps worth knowing about before you hit them:

**Migration 126 logs `FAILED` on every restart.** It tries to add
a column to `finance_accounts`, which is now a view (per the
FIN-UNIFY lock — the unified `accounts` table is the real table,
`finance_accounts` is a compatibility view). The migration's
transaction rolls back cleanly; nothing's broken; subsequent
migrations apply fine. But it's noise that will eventually mask a
real failure. A small migration that records 126 as
applied-and-skipped would silence it. Not urgent. (Note: this
paragraph predates v.171 — migrations 139 and 140 are now taken
by the pending-items subsystem and the v.171 schema alignment, so
the next free number is **141**, not 139.)

**Tailscale HTTPS cert is blocking Google OAuth.** The Google
Tasks sync code path references `todos.google_task_id` and
`todos.google_tasklist_id`. Those columns now exist (v.170.1 mig
138 added them defensively), but the code path itself is dead
until OAuth comes back online. When that happens, expect a
session to test it end-to-end.

**`finance_accounts` is a VIEW, not a table.** Same for
`financial_accounts` and `finance_transactions`. Any SQL that
tries to INSERT/UPDATE these will fail. The real tables are
`accounts` and `transactions`. The validator catches direct
writes; if you find yourself wanting to write to the legacy
names, you're doing it wrong.

**`med_physicians` was historically a table.** It got dropped
during the contacts consolidation. The validator's shared-tables
gate allowlists `002_hsa_medical.sql` (where it was originally
created) because that's pre-existing history. Don't try to
re-create the table — use `contacts` with `contact_type='medical_provider'`.

**Mig 130's dynamic renames confused the validator.** Mig 130
renames legacy tables via a runtime loop over an array literal.
The validator's regex skipped that pattern. The v.170.1 patch
hardcodes mig 130's rename list into the validator's special-case
handler. If you write a new migration that uses runtime loops to
do DDL, the validator probably won't follow it — write the DDL
literally instead.

---

## How Al works

Al writes terse messages. "Continue" means "keep building, no recap
needed." "Package" means "now build the deploy zip." Anything else
is usually a new task or a question.

He doesn't want explanations of what you're about to do. He wants
you to do it. A reply that starts with "Building." and ends with
gates output is ideal. A reply that lists three options and asks
which one is a waste of his time unless the options have real
trade-offs.

He'll push back if you drift. The pushback is usually short and
direct ("not copying whole things but 7 failed - what's on line
12") and means "stop explaining, look at the actual problem." When
you see it, look at the actual problem.

He uses "card" and "tile" interchangeably. They're the same
rendered component.

He prefers bigger drops over many small ones. Bundle fixes.

He keeps the running terminal session open and pastes raw output
when something goes wrong. Read it carefully — it tells you what's
actually happening on prod, which is more reliable than what
SCHEMA.md says (though SCHEMA.md is now generated FROM prod, so
they should match).

---

## How not to waste his time

Things that ate hours in past chats:

- Asking him to explain what Ghrava is, or what a module does, or
  why a column is named what it's named. The docs and grep have
  the answer.

- Re-deriving locked decisions. If LOCKED.md says shared tables
  are universal, don't propose a med_physicians-style parallel
  table without `--explain`.

- Claiming work is done before running gates. The gates exist
  precisely so you don't have to make claims.

- Describing visual designs in prose. They go in the template,
  not in your reply. Reference by ID.

- Packaging on a single fix when more fixes are queued. Wait for
  "package."

- Treating memory as authoritative. The zip wins.

---

## Your first move, again

`bash bootstrap.sh`, paste output, ask "what would you like me to build?"
That's it.
