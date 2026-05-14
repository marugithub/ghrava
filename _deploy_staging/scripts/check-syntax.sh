#!/bin/bash
# check-syntax.sh — node --check on every JS, inline-script extraction on HTML.
# Skips text/babel, text/template, and other non-JS script types.
set -e
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"

FAIL=0

# Walk all JS under app/, exclude node_modules and _legacy
while IFS= read -r f; do
  out="$(node --check "$f" 2>&1)" || { echo "  JS  $f"; echo "$out" | head -3 | sed 's/^/      /'; FAIL=1; }
done < <(find app -name '*.js' -not -path '*/node_modules/*' -not -path '*/_legacy/*')

# Inline scripts in HTML — only check vanilla JS
python3 - <<'PYEOF'
import re, subprocess, tempfile, os, sys, glob

SCRIPT_OPEN_RE = re.compile(r'<script\b([^>]*)>', re.IGNORECASE)
fails = 0
for page in sorted(glob.glob('app/public/*.html')):
    try:
        with open(page, encoding='utf-8') as f: html = f.read()
    except: continue
    pos, block_i = 0, 0
    while True:
        m = SCRIPT_OPEN_RE.search(html, pos)
        if not m: break
        attrs = m.group(1)
        body_start = m.end()
        close = html.find('</script>', body_start)
        if close < 0: break
        body = html[body_start:close]
        pos = close + len('</script>')
        # Skip external scripts
        if re.search(r'\bsrc\s*=', attrs):
            block_i += 1; continue
        # Skip non-JS types (babel, template, x-template, etc.)
        tm = re.search(r'\btype\s*=\s*["\']([^"\']+)["\']', attrs)
        if tm:
            t = tm.group(1).lower()
            if t not in ('text/javascript', 'application/javascript', 'module'):
                block_i += 1; continue
        if not body.strip():
            block_i += 1; continue
        with tempfile.NamedTemporaryFile('w', suffix='.js', delete=False) as tf:
            tf.write(body); tp = tf.name
        try:
            r = subprocess.run(['node','--check',tp], capture_output=True, text=True)
            if r.returncode != 0:
                print(f"  HTML {page} block {block_i}")
                print('      ' + r.stderr.strip().split('\n')[0][:200])
                fails += 1
        finally:
            os.unlink(tp)
        block_i += 1
sys.exit(1 if fails else 0)
PYEOF
HTML_FAIL=$?

if [ $FAIL -ne 0 ] || [ $HTML_FAIL -ne 0 ]; then exit 1; fi
exit 0
