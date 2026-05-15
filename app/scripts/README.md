# app/scripts/ — Ghrava operational scripts

## Gates (called by `gates.sh` at repo root)

| Script                       | Purpose                                                 | Fails on                                                        |
|------------------------------|---------------------------------------------------------|-----------------------------------------------------------------|
| `check-syntax.sh`            | `node --check` every JS + inline HTML script           | Any syntax error                                                |
| `check-schema.sh`            | `validate-schema.py --strict`                          | Any prepared statement referencing missing columns/tables       |
| `check-locked.sh`            | LOCKED.md ↔ `_templates.html` anchor consistency       | LOCKED.md claims an anchor that doesn't exist                   |
| `check-lens.sh`              | Required user-facing modules registered in lens-config | A required module missing                                       |
| `check-commands.sh`          | help.html COMMANDS array sanity                        | Core ops commands missing                                       |
| `check-no-design-prose.sh`   | Flag prose visual specs in STATE/HANDOFF/BACKLOG       | Tile/card layout described in prose instead of `_templates.html`|
| `check-shared-tables.sh`     | Catch parallel shared-table creation                   | New migration creating parallel-pattern tables (strict warn)    |
| `smoke.sh`                   | Hit every module endpoint, verify 200                  | Endpoint returns non-2xx (skipped if no server reachable)       |

## Running

```bash
# Full check (use this)
bash gates.sh

# Quick — skips slow gates (schema + smoke)
bash gates.sh --quick

# One gate by name
bash gates.sh schema
bash gates.sh locked
```

## Adding a gate

1. Drop a `check-<name>.sh` here. Exit 0 = pass, non-zero = fail.
2. Add a `run_gate "<name>" "bash app/scripts/check-<name>.sh"` line in `gates.sh`.
3. Document above.
4. Run `bash gates.sh <name>` to verify.

## When to override

`check-shared-tables.sh --explain="<reason>"` — only path with override.
Document the reason in STATE.md under the version block.

---

## What gates CANNOT catch

Static analysis catches roughly the bottom 40-60% of "breaks the page" bugs.
The rest only show up at runtime. Honest list:

| Bug class | Why gates can't see it |
|---|---|
| Runtime null refs (`a.b.c` where `b` is undefined) | Needs execution |
| SQL errors on populated DB (unique violation on real data) | Needs real DB state |
| Auth / session edge cases | Needs request context |
| Race conditions, async timing | Needs event loop |
| CSS / visual breakage | Needs browser render |
| Browser-specific JS (Safari quirks) | Only node --check happens |
| Logic bugs (wrong field name in payload, off-by-one in pagination) | Needs runtime data |
| Cross-origin / CORS issues | Needs network |
| Migration interactions with real existing data | Needs prod-like DB (mitigated: SCHEMA.md generated from live prod) |

There is no substitute for opening the page and clicking around. Gates make
the static layer trustworthy; the runtime layer needs human eyes.

## Future test layers (deferred)

Possible additions in priority order. None are in scope yet.

1. **Playwright headless tests** — load every page, check no JS console
   errors, click each button, verify 2xx responses. Closes most of the
   "cannot catch" list. (`tests/` already has a Playwright config; not wired.)
2. **Live server smoke** — boot app with live DB backup, hit every GET,
   verify 200 + JSON shape. The current `smoke.sh` is a stub of this.
3. **`req.body` shape audit** — for each POST/PUT handler, list `req.body.X`
   references; for each client call site, list keys sent; diff. Catches
   client/server payload drift.
4. **TypeScript pass on JS** — `tsc --checkJs` flags more than `node --check`.
5. **End-to-end migration replay** — apply all migrations to blank DB,
   compare schema to live DB. Catches migration ordering bugs.

