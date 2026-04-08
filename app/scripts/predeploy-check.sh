#!/bin/bash
set -e
APP_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$APP_DIR"

echo "=== Ghrava Pre-Deploy Checks ==="
FAIL=0

# ── 1. Node syntax ────────────────────────────────────────────
echo ""
echo "1. Node syntax (all JS files)..."
while IFS= read -r f; do
  result=$(node --check "$f" 2>&1)
  if [ $? -ne 0 ]; then
    echo "   FAIL: $f"
    echo "         $result" | head -1
    FAIL=1
  fi
done < <(find features shared db -name "*.js" 2>/dev/null | grep -v node_modules)
[ $FAIL -eq 0 ] && echo "   OK"

# ── 2. TypeScript check ───────────────────────────────────────
echo ""
echo "2. TypeScript type check (shared/)..."
if command -v tsc &> /dev/null; then
  TSC_OUT=$(tsc --noEmit 2>&1 || true)
  # Exclude pre-existing errors in files we don't modify
  KNOWN_BAD="db/db.js|auth/middleware.js|shared/attachments.js|shared/data-cleanup.js|shared/needs-review.js"
  TSC_ERRORS=$(echo "$TSC_OUT" | grep "error TS" | grep -vE "$KNOWN_BAD" || true)
  ALL_ERRORS=$(echo "$TSC_OUT" | grep "error TS" || true)
  if [ -z "$ALL_ERRORS" ]; then
    echo "   OK"
  elif [ -z "$TSC_ERRORS" ]; then
    echo "   OK (pre-existing errors in unmanaged files ignored)"
  else
    echo "   FAIL:"
    echo "$TSC_ERRORS" | head -10
    FAIL=1
  fi
else
  echo "   SKIP (install: npm install -g typescript)"
fi

# ── 3. HTML inline script syntax ─────────────────────────────
echo ""
echo "3. HTML inline script syntax..."
python3 << 'PYEOF'
import re, subprocess, os, sys
base = 'public'
fail = False
for fname in sorted(os.listdir(base)):
    if not fname.endswith('.html') or fname == 'trade.html': continue
    content = open(os.path.join(base, fname)).read()
    scripts = re.findall(r'<script(?![^>]*src=)[^>]*>(.*?)</script>', content, re.DOTALL)
    if not ''.join(scripts).strip(): continue
    open('/tmp/pdc.js', 'w').write('\n'.join(scripts))
    r = subprocess.run(['node', '--check', '/tmp/pdc.js'], capture_output=True, text=True)
    if r.returncode:
        lines = '\n'.join(scripts).split('\n')
        errs = [int(m.group(1)) for m in re.finditer(r':(\d+)', r.stderr)]
        n = errs[0] if errs else 0
        print(f'   FAIL: {fname}' + (f': {lines[n-1].strip()[:70]}' if n else ''))
        fail = True
if not fail:
    print('   OK')
sys.exit(1 if fail else 0)
PYEOF
[ $? -ne 0 ] && FAIL=1

# ── 4. Script dependency check ────────────────────────────────
# Catches pages that use GH_REFS without loading lt-refs.js
echo ""
echo "4. Script dependency check..."
python3 << 'PYEOF'
import re, os, sys
base = 'public'
fail = False
# GH_REFS lives in lt-refs.js; GH_FAMILY and GH_SELECT live in lt-core.js
for fname in sorted(os.listdir(base)):
    if not fname.endswith('.html') or fname in ('trade.html', 'login.html'): continue
    content = open(os.path.join(base, fname)).read()
    # Skip redirect stubs (files that just do window.location.replace)
    if 'window.location.replace' in content and len(content) < 300:
        continue
    uses_refs   = 'GH_REFS.' in content
    has_refs_js = 'lt-refs.js' in content
    has_core_js = 'lt-core.js' in content
    if not has_core_js and ('window.api' in content or 'GH_FAMILY' in content or 'GH_SELECT' in content):
        print(f'   FAIL: {fname}: missing lt-core.js')
        fail = True
    if uses_refs and not has_refs_js:
        print(f'   FAIL: {fname}: uses GH_REFS but lt-refs.js not loaded')
        fail = True
if not fail:
    print('   OK')
sys.exit(1 if fail else 0)
PYEOF
[ $? -ne 0 ] && FAIL=1

# ── 5. Migration simulation ───────────────────────────────────
# Runs every pending migration against the live DB in a savepoint.
# Catches duplicate columns, syntax errors, missing tables before deploy.
echo ""
echo "5. Migration simulation against live DB..."
python3 << 'PYEOF'
import re, os, sys

# Find the live DB (data/lifetracker.db next to app/)
db_path = os.path.join(os.path.dirname(os.path.abspath('.')), 'data', 'lifetracker.db')
if not os.path.exists(db_path):
    db_path = 'data/lifetracker.db'
if not os.path.exists(db_path):
    print('   SKIP (live DB not found — run from app/ directory)')
    sys.exit(0)

import sqlite3
db = sqlite3.connect(db_path)

try:
    applied = set(r[0] for r in db.execute('SELECT filename FROM _migrations').fetchall())
except:
    applied = set()

mig_dir = 'db/migrations'
pending = sorted(f for f in os.listdir(mig_dir)
                 if f.endswith('.sql') and f not in applied)

if not pending:
    print('   OK (no pending migrations)')
    sys.exit(0)

fail = False
for fname in pending:
    with open(os.path.join(mig_dir, fname)) as f:
        sql = f.read()
    stmts = [s.strip() for s in re.sub(r'--[^\n]*', '', sql).split(';')
             if s.strip() and s.strip().upper() not in ('BEGIN', 'COMMIT', 'ROLLBACK')]
    try:
        db.execute('SAVEPOINT pdc')
        for stmt in stmts:
            db.execute(stmt)
        db.execute('ROLLBACK TO pdc')
        db.execute('RELEASE pdc')
        print(f'   OK  {fname}')
    except Exception as e:
        try:
            db.execute('ROLLBACK TO pdc')
        except:
            pass
        print(f'   FAIL {fname}: {e}')
        fail = True

sys.exit(1 if fail else 0)
PYEOF
[ $? -ne 0 ] && FAIL=1

# ── Result ────────────────────────────────────────────────────
echo ""
if [ $FAIL -eq 1 ]; then
  echo "=== PRE-DEPLOY FAILED — fix errors before zipping ==="
  exit 1
else
  echo "=== ALL CHECKS PASSED ==="
fi
