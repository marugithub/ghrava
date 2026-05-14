#!/usr/bin/env python3
"""
validate-schema.py — predeploy schema gate

Builds a prod-mirror DB from app/db/migrations/, walks every
db.prepare(`SQL`) call in app/, and runs EXPLAIN against the mirror.
Exits non-zero if any prepared statement references a missing column
or table.

This is THE structural gate. The packaging script refuses to build a
zip if this fails. Bug class: container crashes at require()-time
because SQL referenced a column that doesn't exist on prod.

Usage:
    python3 .claude/skills/ghrava-schema-safety/scripts/validate-schema.py

    # Only validate files changed in the last N hours (faster):
    python3 .../validate-schema.py --recent 1

    # Validate a single file:
    python3 .../validate-schema.py app/shared/auto-link-hsa.js

Exit code:
    0 = all clean
    1 = schema failures found (does not block — pre-existing or known)
    2 = NEW schema failures in files modified recently (blocks package)
"""

import os
import re
import sqlite3
import sys
import time
import argparse

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
# Skill scripts live at <repo>/app/.claude/skills/ghrava-schema-safety/scripts/
# so REPO_ROOT is 5 levels up (scripts → ghrava-schema-safety → skills → .claude → app → repo).
REPO_ROOT = os.path.abspath(os.path.join(SCRIPT_DIR, '..', '..', '..', '..', '..'))
MIG_DIR = os.path.join(REPO_ROOT, 'app', 'db', 'migrations')
APP_DIR = os.path.join(REPO_ROOT, 'app')


def strip_sql_comments(sql):
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
    content = open(path).read()

    # Special handling for mig 130 (rescue migration) — it does dynamic
    # renames via a runtime loop over an array literal. The validator's
    # regex skips ${...} template substitutions, so the renames never
    # execute in replay. Apply them here manually based on knowledge of
    # what mig 130 does on prod.
    if '130_rescue_126' in path:
        legacy_renames = [
            'finance_accounts', 'financial_accounts',
            'finance_transactions', 'imported_transactions',
            'import_batches', 'holdings', 'fin_import_batches',
        ]
        for src in legacy_renames:
            try:
                db.execute(f'ALTER TABLE {src} RENAME TO _legacy_{src}')
            except Exception:
                pass

    for m in re.finditer(r"db\.exec\(\s*`([^`]+)`\s*\)", content, re.DOTALL):
        sql = m.group(1).strip()
        if '${' in sql:
            continue
        try:
            db.executescript(sql)
        except Exception:
            pass

    # Also catch standalone single-line db.exec("ALTER TABLE ...") and db.prepare("ALTER...").run()
    for m in re.finditer(r"""db\.(?:exec|prepare)\(\s*(['"])((?:ALTER\s+TABLE|CREATE\s+TABLE)[^'"]+)\1\s*\)""", content, re.IGNORECASE):
        sql = m.group(2).strip()
        try:
            db.executescript(sql)
        except Exception:
            pass

    # CREATE TABLE inside template literal followed by RENAME — replay any
    # ALTER TABLE x RENAME TO y patterns found loose in the file.
    for m in re.finditer(r"ALTER\s+TABLE\s+(\w+)\s+RENAME\s+TO\s+(\w+)", content, re.IGNORECASE):
        old, new = m.group(1), m.group(2)
        try:
            db.execute(f'ALTER TABLE {old} RENAME TO {new}')
        except Exception:
            pass

    # ALTER TABLE x ADD COLUMN c TYPE — standalone occurrences (defensive ALTERs)
    for m in re.finditer(r"ALTER\s+TABLE\s+(\w+)\s+ADD\s+COLUMN\s+(\w+)\s+([A-Za-z]+)", content, re.IGNORECASE):
        try:
            db.execute(f'ALTER TABLE {m.group(1)} ADD COLUMN {m.group(2)} {m.group(3)}')
        except Exception:
            pass

    pat2 = (r"addCol\(\s*(['\"])((?:\\.|(?!\1).)*)\1"
            r"\s*,\s*(['\"])((?:\\.|(?!\3).)*)\3\s*\)")
    for m in re.finditer(pat2, content):
        try:
            db.execute(f'ALTER TABLE {unquote(m.group(2))} ADD COLUMN {unquote(m.group(4))}')
        except Exception:
            pass

    pat3 = (r"addCol\(\s*(['\"])((?:\\.|(?!\1).)*)\1"
            r"\s*,\s*(['\"])((?:\\.|(?!\3).)*)\3"
            r"\s*,\s*(['\"])((?:\\.|(?!\5).)*)\5\s*\)")
    for m in re.finditer(pat3, content):
        try:
            db.execute(f'ALTER TABLE {unquote(m.group(2))} ADD COLUMN {unquote(m.group(4))} {unquote(m.group(6))}')
        except Exception:
            pass


def build_mirror_db():
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


def find_prepared_statements(filter_files=None, recent_hours=None):
    """Yield (rel_path, line_no, sql, mtime) for every db.prepare(`...`)."""
    cutoff = time.time() - (recent_hours * 3600) if recent_hours else None
    for root, dirs, files in os.walk(APP_DIR):
        if 'node_modules' in root or '/migrations' in root or '/data' in root:
            continue
        for f in files:
            if not f.endswith('.js'):
                continue
            path = os.path.join(root, f)
            rel = os.path.relpath(path, REPO_ROOT)
            if filter_files and rel not in filter_files:
                continue
            mtime = os.path.getmtime(path)
            if cutoff and mtime < cutoff:
                continue
            try:
                content = open(path).read()
            except Exception:
                continue
            for m in re.finditer(r"db\.prepare\(\s*`([^`]+)`\s*\)", content, re.DOTALL):
                sql = m.group(1).strip()
                if '${' in sql:
                    continue
                line_no = content[:m.start()].count('\n') + 1
                yield rel, line_no, sql, mtime


def main():
    p = argparse.ArgumentParser()
    p.add_argument('files', nargs='*', help='Specific files to validate (relative to repo root)')
    p.add_argument('--recent', type=float, default=None,
                   help='Block on failures in files modified in the last N hours')
    p.add_argument('--strict', action='store_true',
                   help='Block on ANY failure (use after auditing pre-existing bugs)')
    p.add_argument('--quiet', action='store_true', help='Suppress success messages')
    args = p.parse_args()

    filter_files = set(args.files) if args.files else None

    if not args.quiet:
        print('Building prod-mirror schema from migrations…', file=sys.stderr)
    db = build_mirror_db()

    fails = []
    checked = 0
    for fp, ln, sql, mtime in find_prepared_statements(filter_files, args.recent):
        checked += 1
        try:
            db.execute('EXPLAIN ' + sql)
        except Exception as e:
            es = str(e)
            if any(s in es for s in ('no such column', 'has no column', 'no such table')):
                fails.append((fp, ln, sql[:120], es, mtime))

    if fails:
        # Categorize: did the user pass --strict to treat all as blocking,
        # or --recent to use mtime-based heuristic, or neither (default:
        # report but don't block, since mtime is unreliable after a
        # fresh checkout/copy/share-zip extract).
        if args.strict:
            print(f'\n🚨 BLOCKING (--strict): {len(fails)} schema failure(s):\n',
                  file=sys.stderr)
            for fp, ln, sql, err, _ in fails:
                print(f'  {fp}:{ln}', file=sys.stderr)
                print(f'    SQL: {sql}{"..." if len(sql) >= 120 else ""}', file=sys.stderr)
                print(f'    ERR: {err}\n', file=sys.stderr)
            return 2

        if args.recent is not None:
            recent_cutoff = time.time() - (args.recent * 3600)
            recent_fails = [f for f in fails if f[4] > recent_cutoff]
            old_fails = [f for f in fails if f[4] <= recent_cutoff]

            if recent_fails:
                print(f'\n🚨 BLOCKING: {len(recent_fails)} schema failure(s) in files modified in last {args.recent}h:\n',
                      file=sys.stderr)
                for fp, ln, sql, err, _ in recent_fails:
                    print(f'  {fp}:{ln}', file=sys.stderr)
                    print(f'    SQL: {sql}{"..." if len(sql) >= 120 else ""}', file=sys.stderr)
                    print(f'    ERR: {err}\n', file=sys.stderr)

            if old_fails and not args.quiet:
                print(f'⚠️  {len(old_fails)} schema failure(s) in older code (not blocking).',
                      file=sys.stderr)

            return 2 if recent_fails else 1

        # Default mode: report all, return 1 (warning, non-blocking)
        if not args.quiet:
            print(f'\n⚠️  {len(fails)} schema failure(s) found (use --strict or --recent to block):\n',
                  file=sys.stderr)
            for fp, ln, sql, err, _ in fails[:15]:
                print(f'  {fp}:{ln} — {err}', file=sys.stderr)
            if len(fails) > 15:
                print(f'  ...and {len(fails) - 15} more', file=sys.stderr)
        return 1

    if not args.quiet:
        print(f'✅ {checked} prepared statements validated against prod-mirror schema',
              file=sys.stderr)
    return 0


if __name__ == '__main__':
    sys.exit(main())
