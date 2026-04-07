#!/bin/bash
set -e
APP_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$APP_DIR"

echo "=== Ghrava Pre-Deploy Checks ==="
FAIL=0

# 1. Node syntax check
echo ""
echo "1. Node syntax (all JS files)..."
while IFS= read -r f; do
  result=$(node --check "$f" 2>&1)
  if [ $? -ne 0 ]; then
    echo "   FAIL: $f"
    echo "         $result" | head -1
    FAIL=1
  fi
done < <(find features shared -name "*.js" 2>/dev/null | grep -v node_modules)
[ $FAIL -eq 0 ] && echo "   OK"

# 2. TypeScript check (shared/ only — checked files)
echo ""
echo "2. TypeScript type check (shared/)..."
if command -v tsc &> /dev/null; then
  TSC_OUT=$(tsc --noEmit 2>&1 || true)
  TSC_ERRORS=$(echo "$TSC_OUT" | grep "error TS" || true)
  if [ -z "$TSC_ERRORS" ]; then
    echo "   OK"
  else
    echo "   FAIL:"
    echo "$TSC_ERRORS" | head -10
    FAIL=1
  fi
else
  echo "   SKIP (install: npm install -g typescript)"
fi

# 3. HTML inline script syntax
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

echo ""
if [ $FAIL -eq 1 ]; then
  echo "=== PRE-DEPLOY FAILED — fix errors before zipping ==="
  exit 1
else
  echo "=== ALL CHECKS PASSED ==="
fi
