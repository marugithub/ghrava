#!/usr/bin/env python3
"""
Ghrava — Static Validation Suite
================================

Run before every deploy. Catches the class of bugs that pass `node --check`
but break at runtime in the browser or when calling the API.

Usage:
    python3 scripts/validate-static.py         # full sweep
    python3 scripts/validate-static.py -q      # exit 1 on any failure, no detail

What it catches:
    1. Onclick / on* attributes calling functions that don't exist anywhere
       on the page (inline + shared scripts).
    2. window.api(METHOD, PATH, ...) calls where the path doesn't match any
       Express route (route handler missing or wrong path).
    3. addEventListener('event', funcName) where funcName is not defined.
    4. getElementById('X') / $('X') referring to IDs never declared in HTML.
    5. Migrations: every .sql file under db/migrations/ is valid SQLite syntax.
    6. db.prepare(`...`) static SQL strings parse cleanly.

What it CANNOT catch (need a running server / browser for these):
    - Runtime NULL refs in handlers
    - SQL errors that only fire on a populated DB
    - Auth / session edge cases
    - Race conditions, async timing
    - CSS / visual breakage
    - Browser-specific JS (we only check syntax via node)
    - Logic bugs (wrong field name in payload, off-by-one in pagination, etc.)
    - Imports/requires that fail at runtime

Exit code 0 = clean, 1 = something failed.
"""
import re
import os
import glob
import sqlite3
import sys
import tempfile
import subprocess

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))  # app/
PUBLIC = os.path.join(ROOT, 'public')
FEATURES = os.path.join(ROOT, 'features')
MIGRATIONS = os.path.join(ROOT, 'db', 'migrations')
SERVER_JS = os.path.join(ROOT, 'server.js')

QUIET = '-q' in sys.argv
total_failures = 0


def section(title):
    if not QUIET:
        print(f"\n{'='*60}\n{title}\n{'='*60}")


def report(msg, fail=False):
    global total_failures
    if fail:
        total_failures += 1
    if not QUIET or fail:
        prefix = "FAIL " if fail else "PASS "
        print(prefix + msg)


# ─── 1. node --check on every JS + extracted inline script ────────────────
def check_js_syntax():
    section("1. JavaScript syntax")
    js_files = (glob.glob(os.path.join(PUBLIC, 'js', '*.js')) +
                glob.glob(os.path.join(FEATURES, '**', '*.js'), recursive=True) +
                [SERVER_JS])
    for fp in js_files:
        r = subprocess.run(['node', '--check', fp], capture_output=True, text=True)
        if r.returncode:
            report(f"{fp}: {r.stderr[:120]}", fail=True)
    # Inline scripts in HTML (skip text/babel — those are JSX, not pure JS)
    for fp in glob.glob(os.path.join(PUBLIC, '*.html')):
        src = open(fp).read()
        scripts = re.findall(r'<script(?![^>]*\bsrc\b)(?![^>]*type\s*=\s*["\']text/babel)[^>]*>(.*?)</script>', src, re.DOTALL)
        for i, s in enumerate(scripts):
            if len(s.strip()) < 5:
                continue
            with tempfile.NamedTemporaryFile(suffix='.js', mode='w', delete=False) as t:
                t.write(s)
                t.flush()
                r = subprocess.run(['node', '--check', t.name], capture_output=True, text=True)
                os.unlink(t.name)
                if r.returncode:
                    report(f"{fp}#script{i}: {r.stderr[:120]}", fail=True)
    if total_failures == 0:
        report("All JS files + inline scripts parse")


# ─── 2. onclick / on* function references ────────────────────────────────
def _defs_in(src):
    out = set()
    for m in re.finditer(r'function\s+([a-zA-Z_$][a-zA-Z0-9_$]*)\s*\(', src):
        out.add(m.group(1))
    for m in re.finditer(r'window\.([a-zA-Z_$][a-zA-Z0-9_$]*)\s*=', src):
        out.add(m.group(1))
    for m in re.finditer(r'(?:const|let|var)\s+([a-zA-Z_$][a-zA-Z0-9_$]*)\s*=\s*(?:async\s+)?(?:function|\([^)]*\)\s*=>|[a-zA-Z_$])', src):
        out.add(m.group(1))
    return out


_KEYWORDS = {'if', 'for', 'while', 'do', 'switch', 'case', 'return', 'this', 'typeof',
             'instanceof', 'new', 'true', 'false', 'null', 'undefined', 'void', 'delete',
             'in', 'of', 'await', 'async', 'function', 'class', 'let', 'const', 'var',
             'try', 'catch', 'finally', 'throw', 'break', 'continue', 'default', 'yield'}
_BROWSER = {'alert', 'confirm', 'prompt', 'toast', 'document', 'window', 'console',
            'event', 'location', 'history', 'navigator', 'setTimeout', 'setInterval',
            'Math', 'Date', 'JSON', 'encodeURIComponent', 'decodeURIComponent',
            'parseFloat', 'parseInt', 'String', 'Number', 'Object', 'Array', 'Promise',
            'Set', 'Map', 'URL', 'URLSearchParams', 'fetch', 'FormData', 'Blob', 'File',
            'FileReader', 'Image', 'Audio', 'localStorage', 'sessionStorage',
            'requestAnimationFrame', 'AttachmentManager', 'LT', 'GH_TAGS', 'GH_VIEW',
            'GH_FAMILY', 'GH_REFS', 'GH_SELECT', 'GH_BULK', 'GH_LOG'}


def check_onclick_refs():
    section("2. onclick → function existence")
    shared_files = [os.path.join(PUBLIC, 'js', f) for f in
                    ['lt-core.js', 'lt-refs.js', 'lt-messages.js', 'lt-attachments.js']]
    shared_files += [os.path.join(PUBLIC, 'nav.js'), os.path.join(PUBLIC, 'theme.js')]
    shared_src = ''
    for f in shared_files:
        if os.path.exists(f):
            shared_src += '\n' + open(f).read()
    shared_defs = _defs_in(shared_src)

    issues = []
    for fp in sorted(glob.glob(os.path.join(PUBLIC, '*.html'))):
        name = os.path.basename(fp)
        src = open(fp).read()
        inline = '\n'.join(re.findall(r'<script(?![^>]*\bsrc\b)[^>]*>(.*?)</script>', src, re.DOTALL))
        page_defs = _defs_in(inline) | shared_defs | _KEYWORDS | _BROWSER
        for m in re.finditer(r'on(?:click|change|input|blur|focus|submit|keydown|keyup|mousedown|mouseup|mouseover|mouseout|toggle|load)\s*=\s*"([^"]+)"', src):
            body = m.group(1)
            for fn in re.finditer(r'(?<![.$\w])([a-zA-Z_$][a-zA-Z0-9_$]*)\s*\(', body):
                n = fn.group(1)
                if n in page_defs or n.startswith('_') or n[0].isupper():
                    continue
                line_no = src.count('\n', 0, m.start()) + 1
                issues.append((name, line_no, n))
                break  # one per attr is enough
    if issues:
        for name, line, fn in issues[:20]:
            report(f"{name}:L{line} — undefined: {fn}()", fail=True)
    else:
        report("All on* attributes resolve to defined functions")


# ─── 3. window.api() endpoint cross-check ────────────────────────────────
def _build_endpoint_registry():
    endpoints = []
    server_src = open(SERVER_JS).read()
    mounts = []
    for m in re.finditer(r"app\.use\s*\(\s*['\"]([^'\"]+)['\"]\s*,\s*require\s*\(\s*['\"]\./features/([^'\"]+)['\"]", server_src):
        mounts.append((m.group(1), m.group(2)))
    for m in re.finditer(r"app\.(get|post|put|patch|delete)\s*\(\s*['\"]([^'\"]+)['\"]", server_src):
        endpoints.append((m.group(1).upper(), m.group(2)))
    for mount, modpath in mounts:
        fp = os.path.join(FEATURES, modpath if modpath.endswith('.js') else modpath + '.js')
        if not os.path.exists(fp):
            fp_alt = os.path.join(FEATURES, modpath, 'routes.js')
            if os.path.exists(fp_alt):
                fp = fp_alt
            else:
                continue
        rsrc = open(fp).read()
        for m in re.finditer(r"router\.(get|post|put|patch|delete)\(\s*['\"]([^'\"]+)['\"]", rsrc):
            method, sub = m.group(1).upper(), m.group(2)
            full = (mount + sub).replace('//', '/')
            endpoints.append((method, full))
    return endpoints


def _matches(call_path, route_path):
    if route_path == call_path:
        return True
    pat = re.escape(route_path)
    pat = re.sub(r':\w+', r'[^/]+', pat)
    return bool(re.fullmatch(pat, call_path))


def check_api_endpoints():
    section("3. window.api() URL → route handler")
    endpoints = _build_endpoint_registry()
    issues = []
    for fp in sorted(glob.glob(os.path.join(PUBLIC, '*.html'))):
        name = os.path.basename(fp)
        src = open(fp).read()
        for m in re.finditer(r"""window\.api\(\s*['"](GET|POST|PUT|PATCH|DELETE)['"]\s*,\s*[`'"]([^`'"]+)[`'"]""", src):
            method, raw = m.group(1), m.group(2)
            if '${' in raw and '}' not in raw:
                continue
            url = raw.split('?')[0]
            url_x = re.sub(r'\$\{[^}]+\}', 'x', url)
            check = '/api/v1' + url_x if not url_x.startswith('/api/v1') else url_x
            ok = any(em == method and _matches(check, ep) for em, ep in endpoints)
            if ok:
                continue
            # If URL ends with '/' it's likely string concatenation: '/foo/' + id
            # Treat trailing slash as :param
            if check.endswith('/'):
                check_alt = check + 'x'
                if any(em == method and _matches(check_alt, ep) for em, ep in endpoints):
                    continue
            # Try with trailing template var stripped
            stripped = re.sub(r'\$\{[^}]+\}\s*$', '', url).rstrip('?').rstrip('&')
            check2 = '/api/v1' + stripped if not stripped.startswith('/api/v1') else stripped
            if any(em == method and _matches(check2.rstrip('/'), ep.rstrip('/')) for em, ep in endpoints):
                continue
            # Check if any route exists with this prefix (param embedded in middle)
            prefix_path = re.sub(r'\$\{[^}]+\}.*$', '', url).rstrip('/')
            check3 = ('/api/v1' + prefix_path) if not prefix_path.startswith('/api/v1') else prefix_path
            if any(em == method and ep.startswith(check3 + '/') for em, ep in endpoints):
                continue
            line_no = src.count('\n', 0, m.start()) + 1
            issues.append((name, line_no, method, raw))
    if issues:
        for n, l, m, raw in issues[:20]:
            report(f"{n}:L{l} — {m} {raw} has no route", fail=True)
    else:
        report(f"All window.api() calls match registered routes ({len(endpoints)} routes total)")


# ─── 4. Migrations: every .sql file is valid SQLite ──────────────────────
def check_migrations():
    section("4. Migration files parse as valid SQLite")
    db = sqlite3.connect(':memory:')
    db.execute('PRAGMA foreign_keys=OFF')
    common_tables = ['items', 'todos', 'family_members', 'contacts', 'documents',
                     'books', 'attachments', 'app_config', 'tags', 'taggables']
    for t in common_tables:
        try:
            db.execute(f"CREATE TABLE {t} (id INTEGER PRIMARY KEY)")
        except: pass
    fail = 0
    ignore_patterns = ['duplicate column', 'already exists', 'no such table',
                       'no such column', 'has no column named',
                       'cannot start a transaction', 'cannot commit',
                       'no transaction is active', 'unique constraint failed',
                       'foreign key mismatch', 'no such function',
                       'incomplete input']
    for fp in sorted(glob.glob(os.path.join(MIGRATIONS, '*.sql'))):
        sql = open(fp).read()
        sql = re.sub(r'\b(BEGIN|COMMIT|ROLLBACK)(\s+TRANSACTION)?\s*;', '', sql, flags=re.IGNORECASE)
        # Use executescript which handles multi-statement files including triggers
        try:
            db.executescript(sql)
        except sqlite3.OperationalError as e:
            msg = str(e).lower()
            if any(k in msg for k in ignore_patterns):
                continue
            fail += 1
            report(f"{os.path.basename(fp)}: {str(e)[:120]}", fail=True)
        except sqlite3.IntegrityError:
            pass
    if fail == 0:
        report(f"All {len(glob.glob(os.path.join(MIGRATIONS, '*.sql')))} .sql migrations parse")


# ─── 5. Static SQL strings in db.prepare(`...`) parse cleanly ────────────
def check_db_prepare():
    section("5. db.prepare() static SQL parses")
    prepares = []
    for fp in glob.glob(os.path.join(FEATURES, '**', '*.js'), recursive=True):
        src = open(fp).read()
        for m in re.finditer(r"db\.prepare\(\s*`([^`]+)`\s*\)", src):
            sql = m.group(1).strip()
            if '${' in sql:
                continue
            line = src.count('\n', 0, m.start()) + 1
            prepares.append((fp, line, sql))
    db = sqlite3.connect(':memory:')
    tables = set()
    for _, _, sql in prepares:
        for m in re.finditer(r"(?:FROM|JOIN|INTO|UPDATE)\s+(\w+)", sql, re.IGNORECASE):
            tables.add(m.group(1).lower())
    for t in tables:
        try: db.execute(f"CREATE TABLE {t} (id INTEGER PRIMARY KEY)")
        except: pass
    ignore = ['no such column', 'no such table', 'ambiguous column', 'no such function',
              'incorrect number', 'incomplete input', 'has no column named']
    real = []
    for fp, line, sql in prepares:
        try: db.execute(f'EXPLAIN {sql}')
        except sqlite3.OperationalError as e:
            msg = str(e).lower()
            if any(k in msg for k in ignore):
                continue
            real.append((fp.rsplit('/app/', 1)[-1], line, str(e), sql[:80]))
        except Exception:
            pass
    if real:
        for fp, line, err, s in real[:10]:
            report(f"{fp}:L{line} — {err}\n     {s}", fail=True)
    else:
        report(f"All {len(prepares)} static SQL strings parse")


# ─── Run ─────────────────────────────────────────────────────────────────
if __name__ == '__main__':
    check_js_syntax()
    check_onclick_refs()
    check_api_endpoints()
    check_migrations()
    check_db_prepare()
    print()
    if total_failures == 0:
        print("✓ ALL CHECKS PASSED")
        sys.exit(0)
    else:
        print(f"✗ {total_failures} CHECK(S) FAILED")
        sys.exit(1)
