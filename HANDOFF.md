# HANDOFF — Ghrava development handoff to next chat

**Last updated:** 2026-05-14 (end of v.168.2 session)
**Most recent packaged version on prod:** **v202604.168.2** — deployed by Al, HSA plan info merged, working

Read this top-to-bottom before doing anything. Everything material from the last few sessions is captured here.

---

## 📚 Required reading order at start of every chat

1. **`STATE.md`** — current state, version log, locked decisions
2. **`HANDOFF.md`** (this file) — next-chat tasks, deploy process, gotchas
3. **`BACKLOG.md`** — every deferred idea, schema bug audit, locked rules
4. **`app/public/_templates.html`** — numbered visual design specs
5. **`SCHEMA.md`** at repo root — auto-generated, every table + column. **Read this BEFORE writing any SQL.**

---

## 🚨 Most important thing in this doc

Three sessions in a row, Claude (me) shipped code with SQL referencing columns that don't exist on the live DB. Container crash-looped each time. Pattern: write SQL from memory of column names, fail to verify against actual schema, container fails to bind at startup. Specific bugs that crashed:

- `accounts.account_type` — real column is `accounts.type`
- `transactions.merchant` — real is `transactions.description`
- `hsa_payments.payment_date / vendor / expense_type / amount` — real are `date / provider / category / you_paid`
- `contacts.type` — real is `contacts.contact_type`
- `'medical_provider'` value — real is `'Medical'` (capitalized)
- `family_members.is_active` — column doesn't exist
- `subscriptions.monthly_amount` — real is `cost`

**A Schema Safety Skill was deployed to prevent this.** It auto-loads when keywords like "package", "deploy", "SQL", "migration", "fix bug", "schema" appear in conversation. **Use the 5-step gate. Don't shortcut it.**

Beyond schema bugs, second class of failure: **changing data location without verifying downstream readers**. Locked rule as of v.168.1.

---

## 🛠 Current state (prod = v.168.2)

### Running on prod
- v202604.168.2 — up and serving traffic
- HSA plan info **merged into `fsa_plan_info`** (v.168 work)
- Old `hsa_plan_info` table renamed to `hsa_plan_info_DEPRECATED_v167` — data preserved as backup, name gone
- Auto-linker scaffolding (v.167) wired and triggered on import
- Schema safety skill installed at `app/.claude/skills/ghrava-schema-safety/`
- `ghrava_deploy.ps1` runs validator gate before robocopy (fail-closed on new schema bugs)
- `Ghrava_Share.ps1` has `-Force` flag so it includes `.claude/`

### What's working
- Settings → HSA & LP-FSA plans: shows Al's 2026 MHBP plan with $2,400 employer contrib
- HSA tile + plan drawer in finance.html (API contract preserved via column aliases)
- Reports → Charts preview (2 mockups + 11 stubs)
- Auto-linker review-pill widget (floating bottom-right)
- Medical Overview tab (M1–M6 tiles)
- Templates page (#25–#28 locked)
- Help → ⌘ Commands documented

### NOT done (deferred)
- **31 pre-existing schema bugs** (BACKLOG → "Schema audit"). On edge paths, not crashing today.
- **Universal Attachments** (#28): designed, queued for v.169
- **Reports Group 1 live data wiring**: charts are mockups
- **Medical schema gaps**: med_immunizations, med_procedures, med_family_history, med_referrals
- **Other family medical seeds** (Zarna, Arnav, Risha JSONs)

---

## 🔒 Locked rules — non-negotiable

### Build mode default
No explanations, summaries, recaps, or test plans unless Al asks. Confirm decisions in one line, ask blocking questions only, then build.

### Packaging discipline
Never package after a single fix. Wait for Al to say "package" OR collect multiple fixes into one drop.

### Required per-drop updates
- New CLI / docker exec → `app/public/help.html` → `COMMANDS` array
- New schema column or table → `app/public/js/lens-config.js`
- New visual tile / card / page → numbered section in `app/public/_templates.html`
- New deferred decision → bullet in `BACKLOG.md`

### Schema safety (5-step gate before any SQL)
**MANDATORY.** See "Schema Safety Skill" section below.

### Downstream wiring audit (NEW v.168.1)
When migration moves/renames data:
1. `grep -rn "<old_table>\|<old_column>" app/features/ app/shared/ app/public/`
2. Update every reader (routes, tiles, reports, settings, frontend)
3. After deploy: open each affected page in browser, confirm data renders
4. Document audit in BACKLOG + STATE

Past failure: v.168 moved HSA plan data, Settings panel worked but I forgot to verify finance.html HSA tile. Al had to flag it.

### Data safety
- `journal_mode = DELETE` + `synchronous = FULL`
- **No `ON DELETE CASCADE` anywhere, ever**
- Ask Al for manual DB backup before any migration that drops tables
- Migrations additive only; field mappings in UPGRADE_NOTES.md before schema change
- Records not matching new pattern display as-is, never blanked

### Auth policy
- `requireAuth` only in `settings/routes.js` + `watcher/routes.js`
- All GETs are public
- App runs open; password protects Settings changes only

### Process rules
- Always ask for `docker logs ghrava --tail 50` before theorizing about issues
- Verify column names against live DB schema before writing route code
- Discuss design before coding
- Never fix one module knowing others have the same bug — fix all in one session

---

## 🧠 Schema Safety Skill

Located at `app/.claude/skills/ghrava-schema-safety/`. Auto-loads on keywords: package, deploy, ship, build zip, Ghrava_DEPLOY, fix bug, schema, SQL, migration, db.prepare, route, feature, container crash, "no such column", "no such table", SqliteError, startup failure.

### The 5-step gate (run before any zip ships)

**Step 1 — Regenerate SCHEMA.md**
```bash
docker exec ghrava node /app/.claude/skills/ghrava-schema-safety/scripts/gen-schema-doc.js
```
Writes SCHEMA.md from LIVE prod DB. Ground truth. Not memory, not sibling files.

**Step 2 — Read SCHEMA.md** for every table you'll touch. Identify canonical column names.

**Step 3 — Write code** with comments citing migrations:
```js
// schema: accounts.type (mig 130), accounts.alias (mig 130)
```

**Step 4 — Validate**:
```bash
docker exec ghrava node /app/.claude/skills/ghrava-schema-safety/scripts/validate-schema.js --strict
```
Builds prod-mirror, walks every `db.prepare()`, runs EXPLAIN. Block on failure.

**Step 5 — Downstream wiring audit** (see "Locked rules" above).

### Gate enforcement today
- **`ghrava_deploy.ps1`**: runs validator with `--recent 24` before robocopy. New code blocks; old code warns. Tightens to `--strict` after 31-bug cleanup.
- **`package.sh`** (in skill folder): zip builder gate.

### What validator misses (BACKLOG)
- INSERT...SELECT where source column doesn't exist on source table (v.168 bug class — `created_at` selected from `hsa_plan_info` which lacks it)
- Wiring drift (Step 5 catches manually, no automation)

---

## 📦 Deploy process

1. Sandbox at `/home/claude/work/ghrava_drop/` in chat
2. Run 5-step gate
3. Bump `app/version.txt`
4. Build zip → `/mnt/user-data/outputs/Ghrava_DEPLOY.zip`
5. `present_files` the zip → Al downloads
6. Al runs `ghrava_deploy.ps1` → validator gate fires + robocopies to `Z:\ghrava\`
7. Al SSH NAS → `docker restart ghrava` (~2s)
8. Smoke-test in browser
9. If broken: send `docker logs ghrava --tail 50`

### Zip layout
Top-level, no `ghrava/` wrapper:
```
app/version.txt
app/db/migrations/NNN_xxx.js (new only)
app/features/.../routes.js (modified)
app/public/.../page.html (modified)
STATE.md
HANDOFF.md
BACKLOG.md
```
Include only what changed. Always include version.txt + STATE + HANDOFF + BACKLOG.

### Docker rules
- `docker restart ghrava` for code changes (~2s)
- `docker compose up --build -d` ONLY when `package.json` changes (~90s)
- Migrations auto-run on startup via `app/db/migrate.js`

---

## 🏗 Architecture facts

### Stack
Node.js/Express + SQLite (better-sqlite3) + vanilla JS + Docker on QNAP NAS at `192.168.4.62:3001`.

### Docker volume mount (trips people up)
`./app:/app` — **only `app/` reaches the container.** `.claude/`, `STATE.md`, `BACKLOG.md` at repo root are siblings of `app/` and NEVER reach the container.

That's why skill lives at `app/.claude/skills/...` — accessible inside container at `/app/.claude/skills/...`.

### Database
- File: `/app/data/lifetracker.db` (NOT ghrava.db)
- 141 tables, 1845 columns as of v.168.2

### Family
Algir (id=1), Zarna (spouse), Arnav (son), Risha (daughter). All in `family_members`. `kids` table auto-syncs (v.166).

### Common schema gotchas
| Wrong | Right |
|---|---|
| `accounts.account_type` | `accounts.type` |
| `transactions.merchant` | `transactions.description` |
| `transactions.family_member_id` | (doesn't exist) |
| `hsa_payments.payment_date` | `hsa_payments.date` |
| `hsa_payments.vendor` | `hsa_payments.provider` |
| `hsa_payments.amount` | `hsa_payments.you_paid` |
| `contacts.type` | `contacts.contact_type` |
| `contacts.practice_name` | `contacts.company` |
| `contacts.phone` | `contacts.phone_primary` |
| `family_members.is_active` | (doesn't exist) |
| `subscriptions.monthly_amount` | `subscriptions.cost` |
| `contact_type = 'medical_provider'` | `contact_type = 'Medical'` |

### Two-table traps
- `hsa_plan_info_DEPRECATED_v167` (backup) vs `fsa_plan_info` (current) — always read `fsa_plan_info WHERE plan_type='hsa'`
- `finance_accounts` (VIEW) vs `financial_accounts` (VIEW) — both wrap unified `accounts` (mig 130)
- `kids` vs `family_members` — kids has `family_member_id` FK

---

## 🎯 Top tasks for next chat

Discuss with Al before starting — don't assume.

### Task A — Cleanup 31 pre-existing schema bugs (v.168.1 plumbing drop)
Listed in BACKLOG.md → "Schema audit". Group by table:
- `attachments` table (6 bugs)
- `subscriptions.monthly_amount` → `cost` (2 bugs)
- `hsa_payments.amount` → `you_paid` (2 bugs)
- Google sync columns (4 bugs)
- Per-family-member columns on perfumes/books (2 bugs)
- Misc (daily_log, dashboard, finance routes, holdings, kids.school_name)

After cleanup: tighten `ghrava_deploy.ps1` to `--strict`.

### Task B — Universal Attachments (v.169)
Design locked in `_templates.html #28`. ~14 modules.
- Mig: `record_links` gains attachment_id + link_kind. `attachments` gains refcount + soft_deleted_at.
- Backfill script
- New endpoints: links/match-suggestions
- HIGH/MEDIUM threshold matcher per module
- Shared upload dialog
- Migrate Inventory + HSA + Medical first, then 11 more
- Confirm-with-holder-list unlink
- Settings "Shared attachments" viewer

### Task C — Reports Group 1 live data wiring
After Al picks visual direction from the 2 SVG mockups (Sankey, BP line):
- #26.1.1 Sankey: txns by month + category
- #26.1.2 Calendar heatmap: txns by day
- #26.1.3 Vendor treemap
- #26.1.4 Small-multiples per category
- #26.1.5 Forecast — needs `/finance/forecast?days=90` endpoint

### Task D — Medical schema gaps
Al asked but deferred:
- `med_immunizations` (HIGH — Algir's cardiac follow-up)
- `med_procedures` (HIGH)
- `med_family_history`
- `med_referrals`
- `med_care_plans`
- `med_discussion_topics`

### Task E — Other family medical seeds (Zarna, Arnav, Risha)
Generate JSONs from PDFs via medical-conversion chat. Then bulk-seed via existing endpoint.

### Task F — Validator improvements
- INSERT...SELECT source-column validation
- `--blocking-files` explicit list
- Replace mtime heuristic with git-based diff detection

---

## 🧭 Where things live

### Sandbox session
```
/home/claude/work/ghrava_drop/    # editing
/home/claude/ghrava_live/ghrava/  # read-only Al share zip
/home/claude/work/skill/          # SKILL.md + scripts
```

### Repo root (Z:\ghrava\)
```
app/                              # container-accessible
  .claude/skills/ghrava-schema-safety/
  data/lifetracker.db            # excluded from share
  db/migrations/                  # 130+ migrations
  features/                       # per-module routes
  shared/                         # cross-module helpers
  public/                         # frontend
  scripts/                        # CLIs
  seeds/                          # JSON seeds
  version.txt
docker-compose.yml
ghrava_deploy.ps1
Ghrava_Share.ps1
STATE.md HANDOFF.md BACKLOG.md
SCHEMA.md                         # auto-gen
```

### Inside container
```
/app/data/lifetracker.db
/app/server.js
/app/features/...
/app/.claude/skills/ghrava-schema-safety/scripts/{gen-schema-doc.js, validate-schema.js, package.sh}
/app/version.txt
```

### External APIs
- Fragella (perfume, 20/mo free, cached)
- Finnhub (earnings, free)
- Yahoo Finance / Alpha Vantage (fallback chain)
- Google OAuth (pending Tailscale HTTPS)

### Frontend libs
- Chart.js (price charts)
- Lucide SVGs (icons)
- React via Babel CDN (trading terminal only)

---

## 🩺 Recent session arc

### v.165
Finance landing tiles (F1-F6).

### v.166
Drafts → Templates rename, Medical Overview (M1-M6), mig 131 (4 med tables + 25 cols), bulk-seed, kids auto-sync, BACKLOG.md created.

### v.167 (crashed twice + hotfixed)
Auto-linker scaffolding (4 linkers), LP-FSA Settings UI, Reports preview, review-pill. Schema bugs caused crash loops. Hotfixed.

### v.167.1
Auto-trigger wiring for EOB import + HSA POST.

### v.168 (silent fail)
HSA plan_info merge attempted. Mig 134 silently failed: SELECTed `created_at` from a table that doesn't have it. Reported "0 rows copied".

### v.168.1
Mig 136 redid the copy correctly. Al's 2026 MHBP + $2,400 employer now in fsa_plan_info.

### v.168.2 (this drop)
SKILL.md gained Step 5 (downstream wiring audit). BACKLOG locked the rule. Documentation-only.

---

## 🔌 Useful commands

### Check status
```bash
docker exec ghrava cat /app/version.txt
docker logs ghrava --tail 50
```

### Run gate manually
```bash
docker exec ghrava node /app/.claude/skills/ghrava-schema-safety/scripts/gen-schema-doc.js
docker exec ghrava node /app/.claude/skills/ghrava-schema-safety/scripts/validate-schema.js --strict
```

### Inspect a table
```bash
docker exec ghrava node -e "const db=require('/app/db/db');console.log(db.prepare('PRAGMA table_info(TABLENAME)').all().map(r=>r.name).join(', '));"
```

### EOB↔HSA backfill (one-time)
```bash
curl -X POST http://192.168.4.62:3001/api/v1/links/run/eob-hsa-matcher
```

### Retroactive subscription category copy
```bash
curl -X POST "http://192.168.4.62:3001/api/v1/links/run/subscription-categories?days=90"
```

---

## ⚠️ Honest disclosures (failure modes to compensate for)

1. **I skim long docs** even when they say "read first." Skill exists because "remember to" doesn't work — running a script does.

2. **I pattern-match from memory.** Will auto-fill column names that "feel right." Five crashes traced to this. ONLY trust SCHEMA.md.

3. **I claim done before verifying.** v.168 reported success in simulation but failed in production. After every migration that moves data: query prod, don't just simulate.

4. **I get optimistic.** Will stack drops. Al has had to slow me down. Prefer small contained drops while trust rebuilds.

5. **Context limits.** Write next handoff before space runs out, don't promise it for later.

---

## 📨 If Al asks "what's the latest"

> Prod is on v.168.2. HSA plan info migrated to unified `fsa_plan_info`; old table preserved as backup. Settings → HSA plans + finance.html HSA tile both render Al's 2026 MHBP plan with $2,400 employer contrib. Schema safety skill installed and travelling in share zip + uploaded to Projects. Deploy script enforces validator gate. 31 dormant pre-existing schema bugs logged for cleanup. Next priorities: 31-bug cleanup, then Universal Attachments (v.169), then Reports live wiring.

End of handoff.
