#!/bin/bash
# check-lens.sh — every table in SCHEMA.md whose name appears as a
# Lens-eligible module should have a corresponding lens-config entry.
#
# Soft check: we list tables whose names map to lens module keys, and
# verify the lens-config has a section for them. This isn't perfect
# (some tables aren't lens-able by design) but it catches the common
# miss: adding a new table for a user-facing module without wiring it
# into the lens.
set -e
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"

LENS="app/public/js/lens-config.js"
[ -f "$LENS" ] || { echo "lens-config.js missing"; exit 1; }

python3 - "$LENS" <<'PYEOF'
import sys, re
lens_path = sys.argv[1]
with open(lens_path, encoding='utf-8') as f: lens = f.read()

# Lens-eligible tables = user-facing list pages. This is an explicit
# allowlist — not every table needs a lens (junction tables, system
# tables, audit logs don't). Add to this list when you add a new
# user-facing module.
required = {
    'subscriptions', 'books', 'perfumes', 'insurance_policies',
    'documents', 'wardrobe', 'properties', 'vehicles',
    'medical_medications', 'medical_conditions', 'medical_notes',
    'medical_eob', 'medical_labs', 'medical_diagnostics',
    'medical_allergies', 'medical_vitals',
    'todos', 'inventory', 'budgets',
}

# Extract top-level keys from LENS_CONFIG
section_keys = set(re.findall(r'^\s{4}(\w+):\s*\{', lens, flags=re.MULTILINE))

missing = sorted(required - section_keys)
if missing:
    print(f"lens-config.js is missing entries for {len(missing)} module(s):")
    for m in missing:
        print(f"  - {m}")
    sys.exit(1)

print(f"  lens-config.js: {len(section_keys & required)} required modules present")
PYEOF
