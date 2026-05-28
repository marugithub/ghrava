#!/usr/bin/env python3
"""
gen-schema-doc.py — generates SCHEMA.md from app/db/migrations/

Replays every migration in order against an in-memory SQLite DB,
then writes SCHEMA.md at the repo root with every table and its
canonical columns. This is the ground truth any AI session should
consult before writing SQL.

Usage:
    python3 .claude/skills/ghrava-schema-safety/scripts/gen-schema-doc.py
    python3 .claude/skills/ghrava-schema-safety/scripts/gen-schema-doc.py --prod

Exit code 0 on success. Writes:
    SCHEMA.md    — human-readable table reference
"""

import argparse
import json
import os
import re
import sqlite3
import subprocess
import sys
from datetime import datetime

# Find repo root by walking up from this script
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
# app/.claude/skills/ghrava-schema-safety/scripts → up 5 levels to repo root
REPO_ROOT = os.path.abspath(os.path.join(SCRIPT_DIR, '..', '..', '..', '..', '..'))
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


def parse_args():
    """Parse CLI arguments."""
    parser = argparse.ArgumentParser(
        description='Generate SCHEMA.md from migration replay, optionally grounded in prod.'
    )
    parser.add_argument('--prod', action='store_true',
                        help='Query the live NAS container for prod schema; use prod as canonical')
    parser.add_argument('--ssh-host', default='192.168.4.62',
                        help='SSH host for NAS (default: 192.168.4.62)')
    parser.add_argument('--ssh-key', default=os.path.expanduser('~/.ssh/ghrava_nas_rsa'),
                        help='Path to SSH private key (default: ~/.ssh/ghrava_nas_rsa)')
    parser.add_argument('--docker-path',
                        default='/share/CACHEDEV4_DATA/.qpkg/container-station/bin/docker',
                        help='Path to docker binary on the NAS')
    parser.add_argument('--container', default='ghrava',
                        help='Docker container name (default: ghrava)')
    parser.add_argument('--nas-app-mount', default=r'Z:\ghrava\app',
                        help=r'Local path to the NAS app mount (default: Z:\ghrava\app)')
    return parser.parse_args()


def replay_migrations():
    """Replay all migrations and return a schema dict in the same shape as query_prod_schema().

    Returns:
        dict with keys:
            table_count (int)
            tables (list of dicts with name, type, row_count, columns)
            applied (dict of table -> {col -> migration filename})
            mig_count (int)
    """
    db, applied, mig_count = build_mirror()
    raw_tables = sorted([
        r[0] for r in db.execute(
            "SELECT name FROM sqlite_master WHERE type='table' "
            "AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '\\_%' ESCAPE '\\'"
        ).fetchall()
    ])
    tables = []
    for t in raw_tables:
        cols_raw = db.execute(f"PRAGMA table_info({t})").fetchall()
        columns = []
        for c in cols_raw:
            cid, name, ctype, notnull, dflt_value, pk = c
            columns.append({
                'name': name,
                'type': ctype or '',
                'notnull': notnull,
                'dflt_value': dflt_value,
                'pk': pk,
            })
        tables.append({
            'name': t,
            'type': 'table',
            'row_count': None,
            'columns': columns,
        })
    return {
        'table_count': len(tables),
        'tables': tables,
        'applied': applied,
        'mig_count': mig_count,
    }


_JS_DUMP = """\
const Database = require('better-sqlite3');
const db = new Database('/app/data/lifetracker.db', { readonly: true });
const tables = db.prepare(`SELECT name, type, sql FROM sqlite_master WHERE type IN ('table','view') AND name NOT LIKE 'sqlite_%' ORDER BY name`).all();
const out = { table_count: tables.length, tables: [] };
for (const t of tables) {
  const cols = db.prepare(`PRAGMA table_info("${t.name}")`).all();
  let row_count = null;
  try { row_count = db.prepare(`SELECT COUNT(*) AS n FROM "${t.name}"`).get().n; } catch (e) { row_count = '(err)'; }
  out.tables.push({ name: t.name, type: t.type, row_count, columns: cols.map(c => ({ name: c.name, type: c.type, notnull: c.notnull, dflt_value: c.dflt_value, pk: c.pk })) });
}
console.log(JSON.stringify(out, null, 2));
db.close();
"""


def query_prod_schema(host, key, docker, container, nas_app_mount):
    """Query the running Ghrava NAS container for the live prod schema.

    Drops a tiny JS script onto the NAS-mounted app directory via the local
    Z: drive path, then executes it inside the container via SSH+docker exec.
    The script returns JSON matching the v206-prod-schema.json shape.

    Args:
        host: SSH host (e.g. '192.168.4.62')
        key:  Path to SSH private key
        docker: Path to docker binary on NAS
        container: Docker container name
        nas_app_mount: Local filesystem path to the NAS app mount (e.g. Z:\\ghrava\\app)

    Returns:
        dict with table_count, tables list.  Does NOT include 'applied' or
        'mig_count' (those come from replay_migrations).

    Raises:
        Exception with a descriptive message on any failure.
    """
    # Where the JS lands on the local (Windows) mount and inside the container
    local_script = os.path.join(nas_app_mount, '.tmp-schema-dump.js')
    container_script = '/app/.tmp-schema-dump.js'

    try:
        # Step 1: write the JS dump script via the local mount
        try:
            with open(local_script, 'w', encoding='utf-8') as f:
                f.write(_JS_DUMP)
        except OSError as e:
            raise Exception(
                f"Could not write tmp script to {local_script}: {e}\n"
                f"Is the NAS mount at {nas_app_mount} accessible?"
            )

        # Step 2: execute via SSH → docker exec → node
        ssh_cmd = [
            'ssh',
            '-i', key,
            '-o', 'StrictHostKeyChecking=no',
            '-o', 'BatchMode=yes',
            f'admin@{host}',
            f'{docker} exec {container} node {container_script}',
        ]
        try:
            result = subprocess.run(
                ssh_cmd,
                capture_output=True,
                text=True,
                timeout=30,
            )
        except subprocess.TimeoutExpired:
            raise Exception(f"SSH command timed out after 30 s (host={host})")
        except FileNotFoundError:
            raise Exception("'ssh' binary not found — is OpenSSH installed and on PATH?")

        if result.returncode != 0:
            stderr_snippet = result.stderr.strip()[:400]
            raise Exception(
                f"SSH/docker exec failed (exit {result.returncode}): {stderr_snippet}"
            )

        # Step 3: parse JSON
        try:
            schema = json.loads(result.stdout)
        except json.JSONDecodeError as e:
            snippet = result.stdout[:200]
            raise Exception(f"Failed to parse prod schema JSON: {e}\nOutput start: {snippet}")

        if 'table_count' not in schema or 'tables' not in schema:
            raise Exception(f"Unexpected schema shape — missing 'table_count' or 'tables' keys")

        return schema

    finally:
        # Step 4: cleanup — always remove the tmp script from the mount
        try:
            if os.path.exists(local_script):
                os.remove(local_script)
        except OSError:
            pass  # best-effort


def diff_schemas(mig_schema, prod_schema):
    """Compare migration-replay schema against prod schema.

    Args:
        mig_schema:  dict returned by replay_migrations()
        prod_schema: dict returned by query_prod_schema()

    Returns:
        dict with:
            tables_only_in_prod         list of table-name strings
            tables_only_in_migrations   list of table-name strings
            columns_only_in_prod        list of (table, col_name) tuples
            columns_only_in_migrations  list of (table, col_name) tuples
    """
    mig_tables = {t['name']: t for t in mig_schema['tables']}
    prod_tables = {t['name']: t for t in prod_schema['tables']}

    tables_only_in_prod = sorted([n for n in prod_tables if n not in mig_tables])
    tables_only_in_migrations = sorted([n for n in mig_tables if n not in prod_tables])

    columns_only_in_prod = []
    columns_only_in_migrations = []

    for tname in prod_tables:
        if tname not in mig_tables:
            continue  # already covered by tables_only_in_prod
        prod_cols = {c['name'] for c in prod_tables[tname]['columns']}
        mig_cols = {c['name'] for c in mig_tables[tname]['columns']}
        for col in sorted(prod_cols - mig_cols):
            columns_only_in_prod.append((tname, col))
        for col in sorted(mig_cols - prod_cols):
            columns_only_in_migrations.append((tname, col))

    return {
        'tables_only_in_prod': tables_only_in_prod,
        'tables_only_in_migrations': tables_only_in_migrations,
        'columns_only_in_prod': columns_only_in_prod,
        'columns_only_in_migrations': columns_only_in_migrations,
    }


def write_schema_md(mig_schema, prod_schema=None, drift=None):
    """Write SCHEMA.md.

    When prod_schema is None: migration-replay-only output (existing behaviour).
    When prod_schema is provided: prod is canonical; drift section added.
    """
    out_path = os.path.join(REPO_ROOT, 'SCHEMA.md')
    lines = []

    if prod_schema is None:
        # ── Backward-compatible migration-replay-only path ──────────────────
        db, applied, mig_count = build_mirror()
        tables_raw = sorted([
            r[0] for r in db.execute(
                "SELECT name FROM sqlite_master WHERE type='table' "
                "AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '\\_%' ESCAPE '\\'"
            ).fetchall()
        ])
        lines.append('# SCHEMA.md — Ghrava database reference')
        lines.append('')
        lines.append('> **Auto-generated** by `.claude/skills/ghrava-schema-safety/scripts/gen-schema-doc.py`')
        lines.append(f'> Last generated: `{datetime.utcnow().isoformat()}Z`')
        lines.append(f'> Source: {mig_count} migration files in `app/db/migrations/`')
        lines.append('>')
        lines.append('> **DO NOT EDIT BY HAND.** This file is regenerated before every package.')
        lines.append('> If a column is missing here, it does not exist on prod.')
        lines.append('')
        lines.append('## Summary')
        lines.append('')
        lines.append(f'- **{len(tables_raw)} tables**')
        total_cols = sum(len(db.execute(f"PRAGMA table_info({t})").fetchall()) for t in tables_raw)
        lines.append(f'- **{total_cols} columns total**')
        lines.append('')
        lines.append('## Tables')
        lines.append('')
        for t in tables_raw:
            cols = db.execute(f"PRAGMA table_info({t})").fetchall()
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
    else:
        # ── Prod-canonical path ───────────────────────────────────────────────
        applied = mig_schema.get('applied', {})
        mig_count = mig_schema.get('mig_count', 0)
        mig_tables_dict = {t['name']: t for t in mig_schema['tables']}
        prod_tables_list = prod_schema['tables']
        prod_n = prod_schema['table_count']
        mig_n = mig_schema['table_count']

        # Counts
        n_prod_only = len(drift['tables_only_in_prod']) if drift else 0
        n_mig_only = len(drift['tables_only_in_migrations']) if drift else 0
        n_drift_tables = n_prod_only + n_mig_only

        prod_col_total = sum(len(t['columns']) for t in prod_tables_list)

        # Header
        lines.append('# SCHEMA.md — Ghrava database reference')
        lines.append('')
        lines.append('> **Auto-generated** by `.claude/skills/ghrava-schema-safety/scripts/gen-schema-doc.py`')
        lines.append(f'> Last generated: `{datetime.utcnow().isoformat()}Z`')
        lines.append(f'> Sources: migration replay ({mig_count} files in `app/db/migrations/`) + prod query (ghrava container)')
        lines.append('>')
        lines.append('> When sources disagree, **prod is canonical**. See DRIFT section below.')
        lines.append('>')
        lines.append('> **DO NOT EDIT BY HAND.** This file is regenerated before every package.')
        lines.append('')
        lines.append('## Summary')
        lines.append('')
        lines.append(f'- **prod tables: {prod_n}**')
        lines.append(f'- **migration-replay tables: {mig_n}**')
        lines.append(f'- **drift: {n_drift_tables} ({n_prod_only} prod-only, {n_mig_only} migration-only)**')
        lines.append(f'- **prod columns total: {prod_col_total}**')
        lines.append('')

        # DRIFT section — tables on prod but NOT in migrations
        lines.append('## DRIFT — tables exist on prod but NOT in migrations')
        lines.append('')
        if drift and drift['tables_only_in_prod']:
            lines.append('| Table | Row count |')
            lines.append('|---|---|')
            for tname in drift['tables_only_in_prod']:
                pt = next((t for t in prod_tables_list if t['name'] == tname), None)
                rc = pt['row_count'] if pt else '?'
                lines.append(f'| `{tname}` | {rc} |')
        else:
            lines.append('_None._')
        lines.append('')

        # DRIFT section — tables in migrations but NOT on prod
        lines.append('## DRIFT — tables in migrations but NOT on prod')
        lines.append('')
        if drift and drift['tables_only_in_migrations']:
            lines.append('| Migration-replay name |')
            lines.append('|---|')
            for tname in drift['tables_only_in_migrations']:
                lines.append(f'| `{tname}` |')
        else:
            lines.append('_None._')
        lines.append('')

        # DRIFT — column-level drift (if any)
        col_prod_only = drift['columns_only_in_prod'] if drift else []
        col_mig_only = drift['columns_only_in_migrations'] if drift else []
        if col_prod_only or col_mig_only:
            lines.append('## DRIFT — column-level differences (tables present in both)')
            lines.append('')
            if col_prod_only:
                lines.append('### Columns on prod but NOT in migrations')
                lines.append('')
                lines.append('| Table | Column |')
                lines.append('|---|---|')
                for tname, col in col_prod_only:
                    lines.append(f'| `{tname}` | `{col}` |')
                lines.append('')
            if col_mig_only:
                lines.append('### Columns in migrations but NOT on prod')
                lines.append('')
                lines.append('| Table | Column |')
                lines.append('|---|---|')
                for tname, col in col_mig_only:
                    lines.append(f'| `{tname}` | `{col}` |')
                lines.append('')

        # Tables (prod-true)
        lines.append('## Tables (prod-true)')
        lines.append('')

        mig_only_tables = []  # defer to end

        for pt in prod_tables_list:
            tname = pt['name']
            in_mig = tname in mig_tables_dict
            tag = '[in:both]' if in_mig else '[in:prod-only]'
            lines.append(f'### `{tname}`  {tag}')
            lines.append('')
            if in_mig:
                origin = applied.get(tname, {}).get('_origin', 'unknown')
                lines.append(f'_Created in: `{origin}`_')
            else:
                lines.append('_Origin: not found in any migration (prod-only table)._')
            lines.append('')
            prod_col_names = {c['name'] for c in pt['columns']}
            mig_col_names = ({c['name'] for c in mig_tables_dict[tname]['columns']}
                             if in_mig else set())
            rc = pt['row_count']
            rc_str = f'  _(rows: {rc})_' if rc is not None else ''
            if in_mig:
                lines.append(f'| Column | Type | NN | Default | PK | In migrations |')
                lines.append('|---|---|---|---|---|---|')
                for c in pt['columns']:
                    dflt_s = '' if c['dflt_value'] is None else f'`{c["dflt_value"]}`'
                    in_m = '✓' if c['name'] in mig_col_names else '✗'
                    lines.append(
                        f'| `{c["name"]}` | {c["type"] or "—"} | {"✓" if c["notnull"] else ""} '
                        f'| {dflt_s} | {"✓" if c["pk"] else ""} | {in_m} |'
                    )
            else:
                lines.append(f'| Column | Type | NN | Default | PK |')
                lines.append('|---|---|---|---|---|')
                for c in pt['columns']:
                    dflt_s = '' if c['dflt_value'] is None else f'`{c["dflt_value"]}`'
                    lines.append(
                        f'| `{c["name"]}` | {c["type"] or "—"} | {"✓" if c["notnull"] else ""} '
                        f'| {dflt_s} | {"✓" if c["pk"] else ""} |'
                    )
            if rc_str:
                lines.append('')
                lines.append(rc_str)
            lines.append('')

            # Collect migration-only tables for the deferred section
        for tname in (drift['tables_only_in_migrations'] if drift else []):
            mt = mig_tables_dict.get(tname)
            if mt:
                mig_only_tables.append(mt)

        # Migration-only tables at the END
        if mig_only_tables:
            lines.append('---')
            lines.append('')
            lines.append('### Migration-only tables (not present on prod)')
            lines.append('')
            lines.append('These tables appear in migration replays but do not exist on the running prod database.')
            lines.append('')
            for mt in mig_only_tables:
                tname = mt['name']
                lines.append(f'### `{tname}`  [in:migration-only]')
                lines.append('')
                origin = applied.get(tname, {}).get('_origin', 'unknown')
                lines.append(f'_Created in: `{origin}`_')
                lines.append('')
                lines.append('| Column | Type | NN | Default | PK |')
                lines.append('|---|---|---|---|---|')
                for c in mt['columns']:
                    dflt_s = '' if c['dflt_value'] is None else f'`{c["dflt_value"]}`'
                    lines.append(
                        f'| `{c["name"]}` | {c["type"] or "—"} | {"✓" if c["notnull"] else ""} '
                        f'| {dflt_s} | {"✓" if c["pk"] else ""} |'
                    )
                lines.append('')

    # Footer (common to both paths)
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

    with open(out_path, 'w', encoding='utf-8') as fh:
        fh.write('\n'.join(lines))
    return out_path


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
    args = parse_args()

    if not os.path.isdir(MIG_DIR):
        print(f'ERROR: migrations dir not found: {MIG_DIR}', file=sys.stderr)
        return 1

    print(f'Reading migrations from {MIG_DIR}…', file=sys.stderr)
    mig_schema = replay_migrations()
    print(f'[mig-replay] {mig_schema["table_count"]} tables from {mig_schema["mig_count"]} migrations', file=sys.stderr)

    prod_schema = None
    if args.prod:
        try:
            prod_schema = query_prod_schema(
                args.ssh_host,
                args.ssh_key,
                args.docker_path,
                args.container,
                args.nas_app_mount,
            )
            print(f'[prod-query] OK: {prod_schema["table_count"]} tables', file=sys.stderr)
        except Exception as e:
            print(f'[prod-query] FAILED, falling back to migration-replay only: {e}', file=sys.stderr)

    drift = diff_schemas(mig_schema, prod_schema) if prod_schema else None

    out_path = write_schema_md(mig_schema, prod_schema=prod_schema, drift=drift)
    print(f'Wrote {out_path}', file=sys.stderr)
    if prod_schema:
        print(f'   prod canonical: {prod_schema["table_count"]} tables', file=sys.stderr)
        if drift:
            print(f'   drift: {len(drift["tables_only_in_prod"])} prod-only, '
                  f'{len(drift["tables_only_in_migrations"])} mig-only tables', file=sys.stderr)
    else:
        print(f'   mig-replay: {mig_schema["table_count"]} tables', file=sys.stderr)
    return 0


if __name__ == '__main__':
    sys.exit(main())
