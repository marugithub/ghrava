#!/bin/bash
# check-schema.sh — wrap validate-schema.py
# Verifies every db.prepare(`SQL`) in app/ parses against the replayed
# migration schema. Catches "no such column" / "no such table" bugs
# that would crash the container at require()-time.
set -e
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"

SCRIPT="app/.claude/skills/ghrava-schema-safety/scripts/validate-schema.py"
if [ ! -f "$SCRIPT" ]; then
  echo "validate-schema.py not found at $SCRIPT — skill not bundled?"
  exit 1
fi

# --strict means ANY schema failure is a fail. Use this in gates.sh.
python3 "$SCRIPT" --strict 2>&1
