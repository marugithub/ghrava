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
