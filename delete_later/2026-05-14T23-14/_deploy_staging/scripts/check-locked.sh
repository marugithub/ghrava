#!/bin/bash
# check-locked.sh — verify LOCKED.md ↔ _templates.html consistency
#
# Catches the failure mode: chat says "saved section #29 to templates"
# but didn't. LOCKED.md says #29 exists; grep _templates.html, fail
# if anchor missing.
set -e
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"

LOCKED="LOCKED.md"
TEMPLATES="app/public/_templates.html"

if [ ! -f "$LOCKED" ]; then
  echo "LOCKED.md missing"
  exit 1
fi
if [ ! -f "$TEMPLATES" ]; then
  echo "_templates.html missing"
  exit 1
fi

FAIL=0

# Extract anchors from rows whose source is _templates.html
# Format: "| <id> | tile/tile-grid/reports/etc | `app/public/_templates.html#section-X` | ... |"
python3 - "$LOCKED" "$TEMPLATES" <<'PYEOF'
import sys, re
locked_path, tmpl_path = sys.argv[1], sys.argv[2]
with open(locked_path, encoding='utf-8') as f: locked = f.read()
with open(tmpl_path, encoding='utf-8') as f: tmpl = f.read()

# Find table rows referencing _templates.html#<anchor>
# (`app/public/_templates.html#section-X`)
pattern = re.compile(r'`app/public/_templates\.html#([\w-]+)`')
anchors_claimed = set(pattern.findall(locked))

# Anchors actually in _templates.html: look for id="..." or "#section-..."
# Accept any id-style anchor in the file.
ids_in_tmpl = set(re.findall(r'id="([\w-]+)"', tmpl))

missing = sorted(a for a in anchors_claimed if a not in ids_in_tmpl)
if missing:
    print(f"LOCKED.md references {len(missing)} anchor(s) missing from _templates.html:")
    for m in missing:
        print(f"  - #{m}")
    print("")
    print("Either add id=\"" + missing[0] + "\" to _templates.html,")
    print("or remove the row from LOCKED.md.")
    sys.exit(1)

print(f"  LOCKED.md: {len(anchors_claimed)} visual locks, all anchors present in _templates.html")
PYEOF
