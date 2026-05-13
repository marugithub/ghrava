# HANDOFF — for the next chat

Read this first. The only doc the next chat needs to be productive
without Al re-explaining anything.

Last updated: v202604.164 packaged 2026-05-13.

---

## 0. WHAT'S ON PROD RIGHT NOW

NAS is running **v202604.159 code** + **v202604.164 templates** layered
on top. Specifically:

- v.159 code (rescue mig 130 v2 ran cleanly — 3 accounts unified, 76
  transactions migrated, 5 compat views, 7 `_legacy_*` backup tables,
  mig 126/127/128 logged as applied)
- v.164 templates (just `_templates.html` + `_drafts.html` redirect —
  non-code, hot-swappable, no docker restart needed)

If `cat /share/Docker/home-core/ghrava/app/version.txt` shows `.164`,
prod is current.

---

## 1. PENDING WORK — THE NEXT CHAT'S JOB

Two locked items. Both designed; ran out of bandwidth before clean
build. The visual design IS already in `_templates.html` #18 — that
page is the spec.

### Task A: Wire v.150 finance tile renderers into `finance.html`

**Why:** Overview tab on `/finance.html` currently renders basic tiles
(eyebrow + hero + pill + maybe rows + strip — no sparkline, no in/out
bar, no util mini-bars, no top-position rows). Must be upgraded to the
v.150 design that's already live in `/_templates.html#finance-tiles`.

**How:**

1. Open `app/public/_templates.html`. Find the section
   `<div class="section" id="finance-tiles">`. Inside it is a
   `<script>(function() { … })();</script>` block (~250 lines)
   containing 6 formatters (`_finK`, `_finM`, `_finC`, `_finPct`,
   `_finDot`, `_finPill`), 6 tile renderers (`_finTileNetWorth`,
   `_finTileCashFlow`, `_finTileCreditCards`, `_finTileBankAccounts`,
   `_finTileHoldings`, `_finTileHsaLpfsa`), and `_emptyTile(label, hint)`.

2. Copy those 13 functions verbatim into `app/public/finance.html`
   (existing script section near the top, alongside the other tile
   helpers).

3. Replace the existing tile code in `finance.html`:
   - Delete the `FIN_TILE_SAMPLE` map (~lines 2206–2248)
   - Delete `applyTileSampleFallback` and `clearTileSampleState`
     (~lines 2253–2296)
   - Replace `async function loadLandingTiles()` (~lines 2298–2461)
     with:
     ```js
     async function loadLandingTiles() {
       const slot = $('finTilesGrid');
       if (!slot) return;
       try {
         const d = await api('GET', '/finance/landing');
         slot.innerHTML =
           _finTileNetWorth(d.net_worth) +
           _finTileCashFlow(d.cash_flow) +
           _finTileCreditCards(d.credit_cards) +
           _finTileBankAccounts(d.bank_accounts) +
           _finTileHoldings(d.holdings) +
           _finTileHsaLpfsa(d.hsa_lpfsa);
       } catch (e) {
         slot.innerHTML = `<div style="text-align:center;padding:32px;
           color:#b91c1c;font-family:var(--mono);font-size:12px">
           Couldn't load overview: ${esc(e.message || String(e))}</div>`;
       }
     }
     ```

4. Replace the 6 static `<div class="fin-tile" data-tile="…">` blocks
   (lines ~310–420) with a single empty container:
   ```html
   <div id="finTilesGrid" class="fin-tiles-grid"></div>
   ```
   Renderers build full DOM dynamically — no static HTML needed.

5. Add missing CSS to `finance.html`:
   ```css
   .fin-tile-pill--mute { background:rgba(0,0,0,0.04); color:#888780 }
   ```

6. Verify `gotoFinTab()` accepts these tab names (the renderers call
   it): `networth`, `transactions`, `accounts`, `holdings`, `hsa`.
   Grep `finance.html` for `gotoFinTab` to confirm.

   **NOTE:** Wrapping the rendered tile div with `onclick=
   "gotoFinTab('xyz')"` is in the v.150 renderers — check the
   `_templates.html` version omits the onclick (it's a non-functional
   spec page). You'll need to add `onclick="gotoFinTab('networth')"`
   etc. on each tile in the `finance.html` copy. See the original
   v.150 zip (`/home/claude/v150_review/app/public/finance.html` lines
   1179, 1206, 1243, 1282, 1310, 1347) for the exact onclick wrapping.

7. Confirm `/finance/landing` backend returns the v.150 shape. Keys:
   `net_worth: { total, total_assets, total_liabilities, mom_delta,
   sparkline: [12 numbers] }`,
   `cash_flow: { mtd_net, mtd_in, mtd_out, prior_month_net, ytd_net }`,
   `credit_cards: { count, total_owed, util_pct, top: [{label, owed,
   util}], others_count, others_owed, next_due: {days, min_payment} }`,
   `bank_accounts: { count, liquid_total, checking_total, savings_total,
   stale_count, stale_label, stale_oldest_days }`,
   `holdings: { count, market_value, cost_basis, gain_pct, top:
   [{symbol, market_value, gain_pct}], others_count, others_value }`,
   `hsa_lpfsa: { total_pool, hsa_count, hsa_pool, lpfsa_count,
   lpfsa_pool, lpfsa_deadline_days }` — **note `hsa_lpfsa` not
   `hsa_lp_fsa`**.

   Inspect `app/features/finance/routes.js` route `/landing` and align
   if there's a mismatch. Don't change the renderers; align the
   backend.

8. **Locked rules:** empty data → `_emptyTile()` shows `$0` / "empty"
   pill / hint. NO SAMPLE badge. NO fake numbers. Tile structure stays
   stable; only values change.

### Task B: Resize medical tiles

**What:** Match the finance grid breakpoints — 3-across wide, 2-across
medium, 1-across with CSS scroll-snap on phone.

**How — CSS only:**

In `app/public/medical.html`, find the existing tile grid CSS (likely
`.med-tile-grid` or similar). Update to:

```css
.med-tile-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
  gap: 14px;
}

/* Phone: native horizontal scroll-snap, one tile per screen */
@media (max-width: 700px) {
  .med-tile-grid {
    display: flex;
    overflow-x: auto;
    scroll-snap-type: x mandatory;
    gap: 14px;
    -ms-overflow-style: none;
    scrollbar-width: none;
  }
  .med-tile-grid::-webkit-scrollbar { display: none; }
  .med-tile-grid > * {
    scroll-snap-align: start;
    flex: 0 0 calc(100vw - 32px);
  }
}
```

No JS. No carousel library. Resize browser 1200 → 700 → 400. Should
go 3 → 2 → 1-with-snap. On a real phone, swipe should feel like
native iOS/Android pager.

---

## 2. DEPLOY PROCESS

### Al's flow (Windows PC → NAS → Docker)

1. Claude packages `Ghrava_DEPLOY.zip` and uses `present_files`.
2. Al downloads the zip to Windows Downloads.
3. Al runs `ghrava_deploy.ps1` in PowerShell — finds the zip,
   extracts, robocopies to `Z:\ghrava\`, detects whether
   `package.json` changed, prints the right next command.
4. Al SSHes to NAS:
   - `docker restart ghrava` (~2s) for normal code changes
   - `docker compose up --build -d` (~90s) only if `package.json`
     changed
5. **Static-only changes** (HTML/CSS/JS in `app/public/`) need no
   docker restart — just hard-refresh browser (Ctrl+Shift+R).

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

### Backups before DB-touching deploys

Always before a zip containing a migration:
```sh
cp /share/Docker/home-core/ghrava/data/lifetracker.db \
   /share/Docker/home-core/ghrava/backups/manual_v<NEXT>.db
```
Auto-backup runs at startup and 02:00 America/Chicago daily.

---

## 3. WORKING RULES (override all other instincts)

These came up explicitly this chat. Burn them in.

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

### Don't package without "package"

- Even after a complete fix, wait for Al to say "package."
- Exception: explicit "package now" during a build.
- Bundle multiple fixes into one drop where possible.

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
4. Migration simulation against live DB (savepoints, rollback)
5. Parser tests (12/12 banks pass)

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

## 4. KEY ARCHITECTURE FACTS (locked, do not re-litigate)

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
  `GH_SELECT`, `window.api`
- `app/public/js/lt-refs.js` — `GH_REFS` (contact pickers, must be
  loaded on every page using it)
- `app/shared/autoTodos.js` — `syncAutoTodos()`,
  `syncMedRefillTodos()`
- `app/shared/tx-fingerprint.js` — fingerprint v2 normalizer
- `app/shared/errors.js` — 500 error logging

---

## 5. KNOWN BUGS (logged, not bundled with Task A/B)

### UI

- Todos page renders neither `.todo-item` nor `.empty-state` (v128
  family filter may hide everything). Need `docker logs` first.
- Reports page `.rep-row` not found (registry empty in renderer).
- Reports panels open as center modals (sub-panel CSS leak from
  `settings.html`).
- Multi-kid bug: kids list pulls from `kids` table; `family_members`
  not auto-syncing despite handoff claim.
- 11 stale Playwright selectors.

### v140 loose ends

- EOB folder-drop persistence (`importEob` counts but doesn't save).
- LP-FSA plan info Settings UI (only API exists).
- Mileage UI on medical visit form (backend ready, frontend doesn't
  expose `round_trip_miles`).
- Medical "Receipts" tab to host v140 inbox/vault — design discussion
  deferred.
- Documents / insurance / subscriptions don't use `attach-lifecycle`.

### Security audit (separate small drop, not bundled)

- `window.esc` doesn't escape `/\'`.
- Attach route should allowlist `entityType`.
- `/file/:id` and `/thumb/:id` missing path-allowlist.
- `/api/v1/app/test-results` unauthenticated.
- CORS wide open.
- `fmtMoney` redefined in 3 pages; `formatDate` redefined despite
  `lt-core`.
- `global-search.js` has own `esc()`.
- `migrate.js` parser splits on `;` before stripping `--` comments.

### Cleanup capstone (small drop after Task A/B)

- Drop `_legacy_*` tables (7 of them from mig 130 rescue).
- Drop `accounts_beneficiaries` (empty, pre-existing table moved
  aside by mig 130).
- Wait for explicit Al go.

---

## 6. `_templates.html` SECTIONS

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

Drafts list (text-only) below the templates. `/_drafts.html` is a
redirect to `/_templates.html#drafts`. One page going forward.

---

## 7. THE "I MESSED UP" PATTERN

If Al points out Claude invented something not in the agreed design:

1. Don't argue. Don't ask Al to find proof. **Search yourself** —
   `conversation_search`, prior chats, uploaded zips, the doc files.
2. If you genuinely can't find it, say so plainly and ask where.
3. Apologize once, briefly. No long mea-culpa paragraphs.
4. Revert to the agreed state. Don't try to "improve" it.

If the deploy zip you produced is wrong, package a corrected one.
Don't tell Al to re-deploy from the wrong zip.

---

## 8. ONE-LINE STATUS

**v.164 packaged. v.150 finance tiles rendered live in
`_templates.html` #18. Next: copy renderers into `finance.html`,
resize medical tiles 3/2/1 with phone scroll-snap. Build mode. No
invented design. Empty data → `_emptyTile()` placeholder.**
