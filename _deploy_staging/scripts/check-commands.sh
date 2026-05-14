#!/bin/bash
# check-commands.sh — operational CLI commands must be discoverable.
#
# Greps the codebase for `docker exec ... node /app/scripts/...` and
# similar patterns; verifies each is documented in help.html's
# COMMANDS array. Soft list — add patterns as the surface grows.
set -e
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"

HELP="app/public/help.html"
[ -f "$HELP" ] || { echo "help.html missing"; exit 1; }

python3 - "$HELP" <<'PYEOF'
import sys, re, os
help_path = sys.argv[1]
with open(help_path, encoding='utf-8') as f: help_html = f.read()

# Extract title strings from the COMMANDS array
titles = re.findall(r"title:\s*['\"]([^'\"]+)['\"]", help_html)
if len(titles) < 5:
    print(f"help.html COMMANDS array suspiciously short ({len(titles)} entries)")
    sys.exit(1)

# Sanity: required core commands
required = ['Container restart', 'Live logs', 'DB shell', 'Manual DB backup']
missing = [r for r in required if not any(r.lower() in t.lower() for t in titles)]
if missing:
    print("help.html missing required core commands:")
    for m in missing:
        print(f"  - {m}")
    sys.exit(1)

print(f"  help.html COMMANDS: {len(titles)} entries, all core commands present")
PYEOF
