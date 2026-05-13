# HANDOFF — for the next chat

Read this first. The only doc the next chat needs to be productive
without Al re-explaining anything.

Last updated: v202604.165 staged 2026-05-13. **Not yet packaged or
deployed.** Awaiting Al's "package" + manual smoke on prod.

---

## 0. WHAT'S ON PROD RIGHT NOW

NAS is running **v202604.159 code + v202604.164 templates**. If
`cat /share/Docker/home-core/ghrava/app/version.txt` shows `.164`,
prod is current with what was last shipped.

**v202604.165 is staged in sandbox only** — it ships the work the
previous `HANDOFF.md` queued as Task A + Task B.

---

## 1. WHAT v.165 SHIPS

Three files + version bump. The two Task A/B items from the previous
handoff are done; everything else from the v.164 handoff queue is
unchanged.

### Task A (done): v.150 finance tiles wired into `finance.html`

- **Backend `/api/v1/finance/landing` rewritten** to the v.150
  payload shape. New fields:
  - `net_worth.total_assets / .total_liabilities / .sparkline[]`
    (last value per month from `net_worth_snapshots`, trailing 12).
  - `cash_flow.mtd_net / mtd_in / mtd_out / prior_month_net /
    ytd_net` — full prior-month net, not same-day MTD.
  - `credit_cards.top[]` (3 by owed), per-card `util` (whole percent),
    aggregate `util_pct`, `next_due: {days, min_payment}`,
    `others_count / others_owed`.
  - `bank_accounts.liquid_total / checking_total / savings_total /
    stale_count / stale_label / stale_oldest_days` (stale =
    `balance_as_of` older than 14 days).
  - `holdings.top[]` (3 by market_value) + `others_count /
    others_value`, total `cost_basis` + `gain_pct`.
  - `hsa_lpfsa` semantics: **unreimbursed receipt pool**, not HSA
    account balance. Counts & sums `hsa_payments` and `fsa_payments`
    where `reimbursed = 0`. `lpfsa_deadline_days` from current-year
    `fsa_plan_info.deadline_date`.
- **`app/public/finance.html`**:
  - 6 static `<div class="fin-tile" data-tile="…">` blocks replaced
    with single `<div id="finTilesGrid" class="fin-tiles-grid">`.
  - Sample-fallback machinery removed (`FIN_TILE_SAMPLE`,
    `applyTileSampleFallback`, `clearTileSampleState`, `FIN_TILE_FMT`,
    `setTilePart / setTilePill / setTileDot`, `daysUntil`, and the
    branching v.158 `loadLandingTiles`). ~14.5 kb dead code gone.
  - v.150 renderers copied **byte-identical** from `_templates.html`
    #18 (`_finK / _finM / _finC / _finPct / _finDot / _finPill /
    _finTileNetWorth / _finTileCashFlow / _finTileCreditCards /
    _finTileBankAccounts / _finTileHoldings / _finTileHsaLpfsa /
    _emptyTile`).
  - New 30-line `loadLandingTiles()` fetches `/finance/landing` and
    concatenates the 6 renderer outputs.
  - Onclick + `role="button"` + `tabindex="0"` + Enter/Space keyboard
    navigation attached post-render via
    `FIN_TILE_TAB_TARGETS = ['networth','transactions','accounts',
    'accounts','holdings','hsa']`.
  - Error path renders an inline red monospace message in the grid.
- **CSS additions:** `.fin-tile-pill--mute` and `.fin-tile-dot--mute`
  (used by `_emptyTile()` and the no-prior-snapshot pill).

### Task B (done): medical tiles 3/2/1 with phone scroll-snap

- **`app/public/medical.html`** `.medv5-grid` upgraded:
  - Desktop: `grid-template-columns: repeat(auto-fit, minmax(380px,
    1fr))` — 3-up wide / 2-up mid / 1-up narrow above the phone
    breakpoint.
  - Phone (≤700px): flex + `scroll-snap-type: x mandatory` for a
    one-card-per-viewport pager. Matches the existing
    `.medv5-grid--all` All-tab pattern.

### Version

- `app/version.txt` → `202604.165`.

---

## 2. v.165 VERIFICATION DONE IN SANDBOX

- **`node --check`** on `app/features/finance/routes.js` — clean.
- **Inline `<script>` syntax check** on every `<script>` block in
  `finance.html` (5 blocks) and `medical.html` (4 blocks) — clean.
- **Integration smoke**: spun up an express router against an in-
  memory SQLite DB matching the unified schema + a representative
  seed dataset (3 banks, 4 credit cards, 4 holdings, 6 transactions,
  11 monthly snapshots, 3 HSA receipts, 2 FSA receipts, current-year
  FSA plan). Hit `/api/v1/finance/landing`, asserted 22 shape
  predicates. All pass; numbers match `_templates.html` #18 sample
  numbers (e.g. cc.next_due.days = 7, holdings.others_count = 1,
  lpfsa_deadline_days = 47).
- **JSDOM smoke**: extracted the renderer block from `finance.html`,
  rendered against both the real-data payload AND an all-empty
  payload. Verified:
  - 6 `.fin-tile` elements in each mode
  - Net worth: 12 sparkline bars
  - Cash flow: `.fin-tile-cf-bar` present
  - Credit cards: 2 util mini-bars (3rd card has no `credit_limit`)
  - Holdings: 3 positive-gain spans
  - Empty: 4 `_emptyTile()` mute-dot tiles + net_worth/cash_flow
    show $0 hero through their own renderers

**Not yet verified:** behavior against Al's actual production DB.
Migration risk = none (no schema changes). Behavior risk = backend
shape change → frontend renderer expects the new shape. If anything
goes wrong, the tiles will render with `$0` / "empty" pills, not
crash.

---

## 3. DEPLOY PROCESS

### Al's flow (Windows PC → NAS → Docker)

1. Claude packages `Ghrava_DEPLOY.zip` (top-level layout — `app/`,
   `docker-compose.yml`, etc. — **no `ghrava/` wrapper**) and uses
   `present_files`.
2. Al downloads to `~/Downloads`.
3. Al runs `ghrava_deploy.ps1` in PowerShell — finds the zip,
   extracts, robocopies to `Z:\ghrava\`, detects whether
   `package.json` changed, prints the right next command.
4. Al SSHes to NAS:
   - `docker restart ghrava` (~2s) for normal code changes
   - `docker compose up --build -d` (~90s) only if `package.json`
     changed
5. **Static-only changes** (HTML/CSS/JS in `app/public/`) need no
   docker restart — just hard-refresh browser (Ctrl+Shift+R).

For v.165, code paths changed (`features/finance/routes.js`), so
`docker restart ghrava` is required.

### Paths

- **NAS path:** `/share/Docker/home-core/ghrava/`
- **From Al's PC:** `Z:\ghrava\` (mapped share)
- **Inside container:** `/app/`
- **DB filename:** `lifetracker.db` (NOT `ghrava.db` — common mistake).
  Lives at `data/lifetracker.db`.
- **URL:** `http://192.168.4.62:3001` local · Tailscale also configured.

### Diagnostics

QNAP has no `sqlite3` CLI. Use the container:

```sh
docker exec ghrava node -e "
const db = require('better-sqlite3')('/app/data/lifetracker.db');
console.log(db.prepare('SELECT COUNT(*) AS n FROM accounts').get());
"
```

Logs:
```sh
docker logs ghrava --tail 50
docker logs ghrava 2>&1 | grep -E 'FAILED|RESCUE|running on port' | tail -20
```

### v.165 smoke after deploy

1. Open `/finance.html`. Overview tab is default. Expect 6 tiles
   rendering real numbers from the live data (3 accounts unified +
   76 transactions from the v.159 rescue).
2. Click any tile — should switch to the corresponding tab.
3. Open `/medical.html` on a phone (or resize to ≤700px). Cards
   should pager-scroll horizontally one-at-a-time. Resize to ~900px
   → 2 columns. Resize to ~1300px → 3 columns.

If a tile shows "empty" with $0 / mute pill — the backend returned
no rows for that tile's category. That's expected behavior (e.g.
holdings tile may be empty if no positions yet).

If a tile crashes / shows the red error line — capture `docker logs
ghrava --tail 50` and the JSON from `curl http://localhost:3001/
api/v1/finance/landing` before theorizing.

---

## 4. NEXT-DROP PRIORITIES (after v.165 confirmed)

### Finance module cleanup capstone

- Drop the 7 `_legacy_*` tables from mig 130 rescue.
- Drop `accounts_beneficiaries` (empty, pre-existing table moved
  aside by mig 130).
- Single migration #131. Wait for explicit Al go.

### Finance module Tile-2 budget target

- Tile 2 (Cash Flow) currently shows "on track" / "overspending"
  based on `mtd_net` sign alone. The locked design idea was to add
  a monthly budget target — design discussion deferred.
- Needs: budget UI in Settings or Finance, schema for monthly
  budgets, comparison in tile renderer.

### Outside finance

Same backlog as v.164's handoff — none touched in v.165:

- Today page (Now/Soon/30-day pipeline) — locked design, not built.
- Drafts pages still need readability pass + status board.
- Reports `.rep-row` not found bug.
- Reports panels open as center modals (sub-panel CSS leak).
- Todos page renders neither `.todo-item` nor `.empty-state`.
- Multi-kid bug (kids table vs family_members not auto-syncing).
- 11 stale Playwright selectors.

### v140 loose ends

- EOB folder-drop persistence (`importEob` counts but doesn't save).
- LP-FSA plan info Settings UI (only API exists).
- Mileage UI on medical visit form (backend ready, frontend
  doesn't expose `round_trip_miles`).
- Medical "Receipts" tab to host v140 inbox/vault.
- Documents / insurance / subscriptions don't use `attach-lifecycle`.

### Security audit (separate small drop)

- `window.esc` doesn't escape `/\'`.
- Attach route should allowlist `entityType`.
- `/file/:id` and `/thumb/:id` missing path-allowlist.
- `/api/v1/app/test-results` unauthenticated.
- CORS wide open.
- `fmtMoney` / `formatDate` redefined across pages despite `lt-core`.
- `global-search.js` has own `esc()`.
- `migrate.js` parser splits on `;` before stripping `--` comments.

---

## 5. WORKING RULES (override all other instincts)

These came up explicitly in recent chats. Burn them in.

### Build mode default

- No explanations, summaries, recaps, or test plans unless asked.
- Confirm decisions in one line. Ask blocking questions only. Build.
- No recaps after work.
- One thing per drop. Don't bundle UI fix with destructive migration.

### Never invent design

- If Al says "the agreed design" — **find it yourself**. Search prior
  chats with `conversation_search`. Check `STATE.md`, `_templates.html`,
  uploaded zips. The design exists somewhere. Don't make Al find it.
- If Al gives an instruction, follow it. Don't reinterpret it as a
  feature spec to "improve."
- Invented numbers, copy, or tile structure = Claude failing.
  Em-dashes fine. Real data fine. `_emptyTile()` pattern ($0 /
  "empty" pill / hint) fine. **Invented numbers not fine.**
- Visual design lives in `_templates.html` as numbered patterns
  (#1, #18, #18.1). Drafts page is text-only.
- "Cards" and "tiles" are interchangeable in Al's vocabulary. Both
  refer to the rendered components.

### Don't package without "package"

- Even after a complete fix, wait for Al to say "package."
- Exception: explicit "package now" during a build.
- **Don't package for small things to save tokens.** Bundle multiple
  fixes into one drop where possible.
- Bigger builds preferred.

### DB safety

- `journal_mode=DELETE`, `synchronous=FULL`. **Never WAL.**
- **No `ON DELETE CASCADE` anywhere, ever.**
- Migrations: additive only. Renames go in `UPGRADE_NOTES.md` first.
- **Always ask for `docker logs ghrava --tail 50`** before
  theorizing. Never guess.
- Verify column names against live DB schema before writing route
  code.

### Predeploy gates (5)

Before any deploy zip:
1. Node syntax check all route files
2. HTML inline script syntax check
3. Script dependency check (pages using `GH_REFS` need `lt-refs.js`)
4. Migration simulation against live DB (savepoints, rollback) —
   skip if no migration in drop
5. Parser tests (12/12 banks pass) — skip if no parser change

### Files Claude consults before editing

- `STATE.md` — current state, version log, locked decisions
- `UI_STANDARDS.md` — read before any frontend change. Copy existing
  patterns; never invent CSS classes.
- `WIRING.md` — module interconnections
- `MODULES_DESIGN.md` — per-module data design
- `BACKLOG.md` — pending work
- `_templates.html` — visual design source of truth
- This file (`HANDOFF.md`) — what the prior chat figured out

---

## 6. KEY ARCHITECTURE FACTS (locked, do not re-litigate)

### Schema

- `finance_accounts` (banking, was a table, now a VIEW over unified
  `accounts`) ≠ `financial_accounts` (investment, was a table, now
  a VIEW). Mig 130 unified both.
- `accounts` is the unified table. Has columns from both old tables
  + 12 credit-card fields + an `alias` column.
- `transactions` is the unified transactions table.
  `source='manual'|'imported'`. Views `finance_transactions` (manual)
  and `imported_transactions` (imported) on top.
- Account type vocab LOCKED: `Checking`, `Savings`, `Credit`, `Cash`,
  `HSA`, `Brokerage`, `TSP`, `Retirement`, `Loan`, `Mortgage`,
  `Other`. Unknown → `Other` + `needs_review=1`.
- `med_physicians` dropped. Contacts are flat 8-type table.
- `record_links` is the universal cross-module link table (mig 129).
  Symmetric junction; application layer chooses left/right.

### Finance landing route shape (v.165)

`GET /api/v1/finance/landing` returns:

```
{
  generated_at,
  net_worth:     { total, total_assets, total_liabilities, mom_delta, sparkline[] },
  cash_flow:     { mtd_net, mtd_in, mtd_out, prior_month_net, ytd_net },
  credit_cards:  { count, total_owed, util_pct, top[], others_count, others_owed, next_due:{days,min_payment} },
  bank_accounts: { count, liquid_total, checking_total, savings_total, stale_count, stale_label, stale_oldest_days },
  holdings:      { count, market_value, cost_basis, gain_pct, top[], others_count, others_value },
  hsa_lpfsa:     { total_pool, hsa_count, hsa_pool, lpfsa_count, lpfsa_pool, lpfsa_deadline_days }
}
```

Renderers in `finance.html` mirror those in `_templates.html` #18
byte-identically. **Changing either side requires mirroring on the
other.**

### Migration runner

- `app/db/migrate.js` sorts by filename, runs each in own
  `db.transaction()`. Failure logged but doesn't abort the run.
- JS migrations require own idempotency check (marker table like
  `_migrations_<name>_done`).
- `_migrations` tracks runner-completed files. `_migrations_*_done`
  markers track which schema blocks actually committed.
- SQLite indexes are global. `CREATE INDEX` fails if name exists on
  ANY table. Defensive migs drop name first.

### Auth

- `requireAuth` only in `settings/routes.js` and `watcher/routes.js`.
  All other routes public — browser `<img>` tags can't send auth
  headers. Keep public reads public.
- Password protects Settings changes only.

### Shared utilities

- `app/public/js/lt-core.js` — `GH_VIEW`, `GH_FAMILY`, `GH_TAGS`,
  `GH_SELECT`, `window.api`, `window.esc`
- `app/public/js/lt-refs.js` — `GH_REFS` (contact pickers, must be
  loaded on every page using it)
- `app/shared/autoTodos.js` — `syncAutoTodos()`,
  `syncMedRefillTodos()`
- `app/shared/tx-fingerprint.js` — fingerprint v2 normalizer
- `app/shared/errors.js` — 500 error logging

---

## 7. `_templates.html` SECTIONS

Source of truth for visual design.

- **#1 Medication** (LOCKED)
- **#2 Inventory** (LOCKED)
- **#3 Todo** (LOCKED)
- **#4 Subscription** (LOCKED)
- **#5 Certification** (LOCKED)
- **#6 Condition** (LOCKED)
- **#17 Summary Tile** (DRAFT, piloted on Medical) — #17.1 Visits/EOBs,
  #17.2 Reimbursement vault
- **#18 Finance Overview Tiles** (LOCKED v.150, added v.164) — the 6
  finance tiles, real-data + empty state, both rendered live. THE SPEC.
  **Now byte-identical to `finance.html` renderers (v.165).**

Drafts list (text-only) below the templates. `/_drafts.html` is a
redirect to `/_templates.html#drafts`. One page going forward.

---

## 8. THE "I MESSED UP" PATTERN

If Al points out Claude invented something not in the agreed design:

1. Don't argue. Don't ask Al to find proof. **Search yourself** —
   `conversation_search`, prior chats, uploaded zips, the doc files.
2. If you genuinely can't find it, say so plainly and ask where.
3. Apologize once, briefly. No long mea-culpa paragraphs.
4. Revert to the agreed state. Don't try to "improve" it.

If the deploy zip you produced is wrong, package a corrected one.
Don't tell Al to re-deploy from the wrong zip.

---

## 9. ONE-LINE STATUS

**v.165 staged. Task A (finance tiles wired to v.150 spec) + Task B
(medical 3/2/1 scroll-snap) done. 22 shape assertions + JSDOM
renderer smoke pass. Not yet packaged — awaiting "package".**
