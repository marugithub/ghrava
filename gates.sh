#!/bin/bash
# gates.sh — Ghrava predeploy gates
#
# Run before claiming any drop is "done". Paste the output.
# Zero failures required to package.
#
# Usage:
#   bash gates.sh           # full run, exits 0 if all pass
#   bash gates.sh --quick   # skip slow checks (smoke, full schema)
#   bash gates.sh <gate>    # run a single gate by name

set +e
cd "$(dirname "$0")"

QUICK=0
SINGLE=""
for arg in "$@"; do
  case "$arg" in
    --quick) QUICK=1 ;;
    schema|syntax|locked|lens|commands|prose|shared|smoke) SINGLE="$arg" ;;
  esac
done

FAIL_COUNT=0
PASS_COUNT=0

run_gate() {
  local name="$1"
  local cmd="$2"
  local skip_in_quick="${3:-0}"

  if [ -n "$SINGLE" ] && [ "$SINGLE" != "$name" ]; then return; fi
  if [ "$QUICK" = "1" ] && [ "$skip_in_quick" = "1" ]; then
    printf "  \033[33m⊘\033[0m  %-15s (skipped in --quick)\n" "$name"
    return
  fi

  printf "  \033[2m·\033[0m  %-15s " "$name"
  local out
  out="$(eval "$cmd" 2>&1)"
  local code=$?
  if [ $code -eq 0 ]; then
    printf "\r  \033[32m✓\033[0m  %-15s pass\n" "$name"
    PASS_COUNT=$((PASS_COUNT + 1))
  else
    printf "\r  \033[31m✗\033[0m  %-15s FAIL\n" "$name"
    echo "$out" | sed 's/^/       /'
    FAIL_COUNT=$((FAIL_COUNT + 1))
  fi
}

echo ""
echo "  === Ghrava gates ==="
echo ""

run_gate "syntax"   "bash app/scripts/check-syntax.sh"
run_gate "schema"   "bash app/scripts/check-schema.sh"           1
run_gate "locked"   "bash app/scripts/check-locked.sh"
run_gate "lens"     "bash app/scripts/check-lens.sh"
run_gate "commands" "bash app/scripts/check-commands.sh"
run_gate "prose"    "bash app/scripts/check-no-design-prose.sh"
run_gate "shared"   "bash app/scripts/check-shared-tables.sh"
run_gate "smoke"    "bash app/scripts/smoke.sh"                  1

echo ""
if [ $FAIL_COUNT -eq 0 ]; then
  printf "  \033[32m✓ %d gates passed\033[0m\n\n" "$PASS_COUNT"
  exit 0
else
  printf "  \033[31m✗ %d failed, %d passed — drop is NOT ready\033[0m\n\n" "$FAIL_COUNT" "$PASS_COUNT"
  exit 1
fi
