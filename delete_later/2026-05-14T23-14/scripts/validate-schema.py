#!/usr/bin/env python3
"""
scripts/validate-schema.py  —  v202604.167

PERMANENT PREDEPLOY GATE.

Builds a prod-mirror SQLite DB by running every migration in
app/db/migrations/ in order (both .sql and .js), then walks every
db.prepare(`SQL`) call in app/**/*.js and validates the SQL parses
against the mirror schema.

Catches the kind of bug that crashed v.167: SQL referencing columns
that don't exist on prod.

Exit code 0 if clean, 1 if any prepared statement references a missing
column or table.

Run before every package:
    python3 scripts/validate-schema.py

CI-friendly. No dependencies beyond standard library + sqlite3.
"""

import sqlite3
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MIG_DIR = os.path.join(ROOT, 'app', 'db', 'migrations')
APP_DIR = os.path.join(ROOT, 'app')


def strip_sql_comments(sql):
    """SQL comment stripper that respects single-quoted strings.
    Mirrors the runtime migrate.js behavior."""
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


def apply_js_migration(db, path):
    """Extract every db.exec(`...`) and every addCol(...) call from a .js
    migration, run them against the mirror DB. Best-effort — failures are
    silenced because some migrations depend on .js modules we don't load."""
    content = open(path).read()

    # Plain db.exec(`...`) blocks
    for m in re.finditer(r"db\.exec\(\s*`([^`]+)`\s*\)", content, re.DOTALL):
        sql = m.group(1).strip()
        if '${' in sql:
            continue
        try:
            db.executescript(sql)
        except Exception:
            pass

    # addCol('table', 'col definition') — 2-arg
    pat2 = (r"addCol\(\s*(['\"])((?:\\.|(?!\1).)*)\1"
            r"\s*,\s*(['\"])((?:\\.|(?!\3).)*)\3\s*\)")
    for m in re.finditer(pat2, content):
        table = unquote(m.group(2))
        col = unquote(m.group(4))
        try:
            db.execute(f'ALTER TABLE {table} ADD COLUMN {col}')
        except Exception:
            pass

    # addCol('table', 'col', 'TYPE') — 3-arg
    pat3 = (r"addCol\(\s*(['\"])((?:\\.|(?!\1).)*)\1"
            r"\s*,\s*(['\"])((?:\\.|(?!\3).)*)\3"
            r"\s*,\s*(['\"])((?:\\.|(?!\5).)*)\5\s*\)")
    for m in re.finditer(pat3, content):
        table = unquote(m.group(2))
        col = unquote(m.group(4))
        coltype = unquote(m.group(6))
        try:
            db.execute(f'ALTER TABLE {table} ADD COLUMN {col} {coltype}')
        except Exception:
            pass


def build_mirror_db():
    """Apply every migration in order — same order the container does."""
    db = sqlite3.connect(':memory:')
    files = sorted([f for f in os.listdir(MIG_DIR)
                    if f.endswith('.sql') or f.endswith('.js')])
    for f in files:
        path = os.path.join(MIG_DIR, f)
        try:
            if f.endswith('.sql'):
                db.executescript(strip_sql_comments(open(path).read()))
            elif f.endswith('.js'):
                apply_js_migration(db, path)
        except Exception:
            pass
    return db


def find_prepared_statements():
    """Walk app/**/*.js and yield (filepath, line_no, sql)."""
    for root, dirs, files in os.walk(APP_DIR):
        # Skip vendored and migration directories
        if 'node_modules' in root or '/migrations' in root or '/data' in root:
            continue
        for f in files:
            if not f.endswith('.js'):
                continue
            path = os.path.join(root, f)
            rel = os.path.relpath(path, ROOT)
            try:
                content = open(path).read()
            except Exception:
                continue
            for m in re.finditer(r"db\.prepare\(\s*`([^`]+)`\s*\)",
                                 content, re.DOTALL):
                sql = m.group(1).strip()
                if '${' in sql:
                    continue
                line_no = content[:m.start()].count('\n') + 1
                yield rel, line_no, sql


def main():
    print('Building prod-mirror schema from migrations…', file=sys.stderr)
    db = build_mirror_db()

    fails = []
    checked = 0
    for fp, ln, sql in find_prepared_statements():
        checked += 1
        try:
            db.execute('EXPLAIN ' + sql)
        except Exception as e:
            es = str(e)
            # Only flag real schema errors — binding-count errors are
            # noise from running EXPLAIN without params.
            if any(s in es for s in ('no such column', 'has no column',
                                      'no such table')):
                fails.append((fp, ln, sql[:100], es))

    if fails:
        print(f'\n❌ {len(fails)} SCHEMA FAILURE(S) in {checked} prepared statements:\n')
        for fp, ln, sql, err in fails:
            print(f'  {fp}:{ln}')
            print(f'    SQL: {sql}{"..." if len(sql) >= 100 else ""}')
            print(f'    ERR: {err}\n')
        return 1

    print(f'✅ {checked} prepared statements validated against prod-mirror schema')
    return 0


if __name__ == '__main__':
    sys.exit(main())
