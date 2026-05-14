#!/usr/bin/env python3
"""
gen-schema-doc.py — generates SCHEMA.md from app/db/migrations/

Replays every migration in order against an in-memory SQLite DB,
then writes SCHEMA.md at the repo root with every table and its
canonical columns. This is the ground truth any AI session should
consult before writing SQL.

Usage:
    python3 .claude/skills/ghrava-schema-safety/scripts/gen-schema-doc.py

Exit code 0 on success. Writes:
    SCHEMA.md    — human-readable table reference
"""

import os
import re
import sqlite3
import sys
from datetime import datetime

# Find repo root by walking up from this script
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
# .claude/skills/ghrava-schema-safety/scripts → up 4 levels
REPO_ROOT = os.path.abspath(os.path.join(SCRIPT_DIR, '..', '..', '..', '..'))
MIG_DIR = os.path.join(REPO_ROOT, 'app', 'db', 'migrations')


def strip_sql_comments(sql):
    """SQL comment stripper that respects single-quoted strings."""
    out, i, n, in_str = '', 0, len(sql), False
    while i < n:
        c = sql[i]
        c2 = sql[i + 1] if i + 1 < n else ''
        if in_str:
            out += c
            if c == "'":
                if c2 == "'":
                    out += c2
                    i += 2
                    continue
                in_str = False
            i += 1
            continue
        if c == "'":
            in_str = True
            out += c
            i += 1
            continue
        if c == '-' and c2 == '-':
            while i < n and sql[i] != '\n':
                i += 1
            continue
        if c == '/' and c2 == '*':
            i += 2
            while i < n - 1 and not (sql[i] == '*' and sql[i + 1] == '/'):
                i += 1
            i += 2
            continue
        out += c
        i += 1
    return out


def unquote(s):
    return s.replace('\\"', '"').replace("\\'", "'")


def apply_js_migration(db, path, applied):
    """Extract every db.exec(`...`) and every addCol(...) call from a .js
    migration and apply it. Tracks which file each column came from."""
    content = open(path).read()
    fname = os.path.basename(path)

    # Track which migration adds which (table, column)
    # Plain CREATE TABLE / CREATE INDEX in backticks
    for m in re.finditer(r"db\.exec\(\s*`([^`]+)`\s*\)", content, re.DOTALL):
        sql = m.group(1).strip()
        if '${' in sql:
            continue
        try:
            db.executescript(sql)
            # Extract table name(s) from CREATE TABLE statements
            for tm in re.finditer(r"CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(\w+)",
                                  sql, re.IGNORECASE):
                applied.setdefault(tm.group(1), {}).setdefault('_origin', fname)
        except Exception:
            pass

    # 2-arg addCol('table', 'col definition')
    pat2 = (r"addCol\(\s*(['\"])((?:\\.|(?!\1).)*)\1"
            r"\s*,\s*(['\"])((?:\\.|(?!\3).)*)\3\s*\)")
    for m in re.finditer(pat2, content):
        table = unquote(m.group(2))
        col_def = unquote(m.group(4))
        try:
            db.execute(f'ALTER TABLE {table} ADD COLUMN {col_def}')
            col_name = col_def.split()[0]
            applied.setdefault(table, {})[col_name] = fname
        except Exception:
            pass

    # 3-arg addCol('table', 'col', 'TYPE')
    pat3 = (r"addCol\(\s*(['\"])((?:\\.|(?!\1).)*)\1"
            r"\s*,\s*(['\"])((?:\\.|(?!\3).)*)\3"
            r"\s*,\s*(['\"])((?:\\.|(?!\5).)*)\5\s*\)")
    for m in re.finditer(pat3, content):
        table = unquote(m.group(2))
        col_name = unquote(m.group(4))
        col_type = unquote(m.group(6))
        try:
            db.execute(f'ALTER TABLE {table} ADD COLUMN {col_name} {col_type}')
            applied.setdefault(table, {})[col_name] = fname
        except Exception:
            pass


def apply_sql_migration(db, path, applied):
    """Apply a .sql migration."""
    content = open(path).read()
    fname = os.path.basename(path)
    stripped = strip_sql_comments(content)
    try:
        db.executescript(stripped)
        for tm in re.finditer(r"CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(\w+)",
                              stripped, re.IGNORECASE):
            applied.setdefault(tm.group(1), {}).setdefault('_origin', fname)
        for am in re.finditer(r"ALTER\s+TABLE\s+(\w+)\s+ADD\s+COLUMN\s+(\w+)",
                              stripped, re.IGNORECASE):
            applied.setdefault(am.group(1), {})[am.group(2)] = fname
    except Exception:
        pass


def build_mirror():
    db = sqlite3.connect(':memory:')
    applied = {}  # table → {col → mig_filename}
    files = sorted([f for f in os.listdir(MIG_DIR)
                    if f.endswith('.sql') or f.endswith('.js')])
    for f in files:
        path = os.path.join(MIG_DIR, f)
        try:
            if f.endswith('.sql'):
                apply_sql_migration(db, path, applied)
            else:
                apply_js_migration(db, path, applied)
        except Exception:
            pass
    return db, applied, len(files)


def write_schema_doc(db, applied, mig_count):
    out_path = os.path.join(REPO_ROOT, 'SCHEMA.md')

    # Get all tables in alphabetical order, skip sqlite_* internals
    tables = sorted([
        r[0] for r in db.execute(
            "SELECT name FROM sqlite_master WHERE type='table' "
            "AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '\\_%' ESCAPE '\\'"
        ).fetchall()
    ])

    lines = []
    lines.append('# SCHEMA.md — Ghrava database reference')
    lines.append('')
    lines.append(f'> **Auto-generated** by `.claude/skills/ghrava-schema-safety/scripts/gen-schema-doc.py`')
    lines.append(f'> Last generated: `{datetime.utcnow().isoformat()}Z`')
    lines.append(f'> Source: {mig_count} migration files in `app/db/migrations/`')
    lines.append('>')
    lines.append('> **DO NOT EDIT BY HAND.** This file is regenerated before every package.')
    lines.append('> If a column is missing here, it does not exist on prod.')
    lines.append('')
    lines.append(f'## Summary')
    lines.append('')
    lines.append(f'- **{len(tables)} tables**')
    total_cols = sum(len(db.execute(f"PRAGMA table_info({t})").fetchall()) for t in tables)
    lines.append(f'- **{total_cols} columns total**')
    lines.append('')
    lines.append('## Tables')
    lines.append('')

    for t in tables:
        cols = db.execute(f"PRAGMA table_info({t})").fetchall()
        # cols: cid, name, type, notnull, dflt_value, pk
        origin = applied.get(t, {}).get('_origin', 'unknown')
        lines.append(f'### `{t}`')
        lines.append('')
        lines.append(f'_Created in: `{origin}`_')
        lines.append('')
        lines.append('| Column | Type | NN | Default | PK | Added |')
        lines.append('|---|---|---|---|---|---|')
        for c in cols:
            cid, name, ctype, nn, dflt, pk = c
            origin_col = applied.get(t, {}).get(name, origin if name in ('id',) else '—')
            dflt_s = '' if dflt is None else f'`{dflt}`'
            lines.append(f'| `{name}` | {ctype or "—"} | {"✓" if nn else ""} | {dflt_s} | {"✓" if pk else ""} | `{origin_col}` |')
        lines.append('')

    # Footer: known schema gotchas (hard-won lessons)
    lines.append('---')
    lines.append('')
    lines.append('## Schema gotchas — read before writing SQL')
    lines.append('')
    lines.append('These caused real prod crashes. Common mistakes from memory:')
    lines.append('')
    lines.append('| Wrong (DO NOT use) | Right |')
    lines.append('|---|---|')
    lines.append('| `accounts.account_type` | `accounts.type` |')
    lines.append('| `transactions.merchant` | `transactions.description` |')
    lines.append('| `transactions.family_member_id` | (column does not exist — use record_links or hsa_payments.family_member_id) |')
    lines.append('| `hsa_payments.payment_date` | `hsa_payments.date` |')
    lines.append('| `hsa_payments.vendor` | `hsa_payments.provider` |')
    lines.append('| `hsa_payments.expense_type` | `hsa_payments.category` |')
    lines.append('| `contacts.type` | `contacts.contact_type` |')
    lines.append('| `contacts.practice_name` | `contacts.company` |')
    lines.append('| `contacts.phone` | `contacts.phone_primary` |')
    lines.append('| `family_members.is_active` | (column does not exist — no soft delete on family members) |')
    lines.append('| `subscriptions.merchant` | `subscriptions.name` |')
    lines.append('| `contact_type = "medical_provider"` | `contact_type = "Medical"` (capitalized) |')
    lines.append('')
    lines.append('Two tables that look like one — never write code that assumes only one:')
    lines.append('')
    lines.append('- `hsa_plan_info` (older, HSA-only) **and** `fsa_plan_info` (newer, multi-plan via `plan_type`)')
    lines.append('- `finance_accounts` (VIEW) **and** `financial_accounts` (VIEW) — both wrap the unified `accounts` table (mig 130)')
    lines.append('- `kids` (per-kid extras) **and** `family_members` (canonical identity) — kids has `family_member_id` FK; family_members has no `is_active`')
    lines.append('')

    open(out_path, 'w').write('\n'.join(lines))
    return out_path, len(tables), total_cols


def main():
    if not os.path.isdir(MIG_DIR):
        print(f'ERROR: migrations dir not found: {MIG_DIR}', file=sys.stderr)
        return 1
    print(f'Reading migrations from {MIG_DIR}…', file=sys.stderr)
    db, applied, mig_count = build_mirror()
    out_path, n_tables, n_cols = write_schema_doc(db, applied, mig_count)
    print(f'✅ Wrote {out_path}', file=sys.stderr)
    print(f'   {n_tables} tables, {n_cols} columns, from {mig_count} migrations', file=sys.stderr)
    return 0


if __name__ == '__main__':
    sys.exit(main())
