#!/usr/bin/env bash
# smoke-test.sh — Ghrava pre-deploy smoke test
#
# Fires real HTTP requests at the running container and asserts correct
# responses. Run this before packaging any Ghrava_DEPLOY.zip.
# Exits with code 1 if any assertion fails.
#
# Usage:
#   ./smoke-test.sh              # defaults to http://localhost:3001
#   ./smoke-test.sh http://192.168.4.62:3001

BASE="${1:-http://localhost:3001}"
PASS=0
FAIL=0
ERRORS=()

# ── Helpers ───────────────────────────────────────────────────
green='\033[0;32m'
red='\033[0;31m'
yellow='\033[0;33m'
reset='\033[0m'

assert_200() {
  local label="$1"
  local url="$2"
  local http_code
  http_code=$(curl -s -o /dev/null -w "%{http_code}" --max-time 5 "$url")
  if [ "$http_code" = "200" ]; then
    echo -e "  ${green}PASS${reset}  $label"
    ((PASS++))
  else
    echo -e "  ${red}FAIL${reset}  $label  (HTTP $http_code)"
    ((FAIL++))
    ERRORS+=("$label — HTTP $http_code")
  fi
}

assert_json_array() {
  local label="$1"
  local url="$2"
  local body
  local http_code
  http_code=$(curl -s -o /tmp/gh_smoke_body -w "%{http_code}" --max-time 5 "$url")
  body=$(cat /tmp/gh_smoke_body)
  if [ "$http_code" != "200" ]; then
    echo -e "  ${red}FAIL${reset}  $label  (HTTP $http_code)"
    ((FAIL++))
    ERRORS+=("$label — HTTP $http_code")
  elif echo "$body" | grep -qE '^\['; then
    echo -e "  ${green}PASS${reset}  $label  (array)"
    ((PASS++))
  else
    echo -e "  ${yellow}WARN${reset}  $label  (200 but not an array — may be empty DB)"
    ((PASS++))
  fi
}

assert_json_object() {
  local label="$1"
  local url="$2"
  local body
  local http_code
  http_code=$(curl -s -o /tmp/gh_smoke_body -w "%{http_code}" --max-time 5 "$url")
  body=$(cat /tmp/gh_smoke_body)
  if [ "$http_code" != "200" ]; then
    echo -e "  ${red}FAIL${reset}  $label  (HTTP $http_code)"
    ((FAIL++))
    ERRORS+=("$label — HTTP $http_code")
  elif echo "$body" | grep -qE '^\{'; then
    echo -e "  ${green}PASS${reset}  $label  (object)"
    ((PASS++))
  else
    echo -e "  ${red}FAIL${reset}  $label  (200 but not a JSON object)"
    ((FAIL++))
    ERRORS+=("$label — unexpected response body")
  fi
}

assert_401() {
  local label="$1"
  local url="$2"
  local method="${3:-POST}"
  local http_code
  http_code=$(curl -s -o /dev/null -w "%{http_code}" --max-time 5 \
    -X "$method" -H "Content-Type: application/json" -d '{}' "$url")
  if [ "$http_code" = "401" ]; then
    echo -e "  ${green}PASS${reset}  $label  (401 as expected)"
    ((PASS++))
  else
    echo -e "  ${red}FAIL${reset}  $label  (expected 401, got HTTP $http_code)"
    ((FAIL++))
    ERRORS+=("$label — expected 401 got $http_code")
  fi
}

# ── Start ─────────────────────────────────────────────────────
echo ""
echo "Ghrava Smoke Test"
echo "Target: $BASE"
echo "──────────────────────────────────────────────"

# ── Dashboard ─────────────────────────────────────────────────
echo ""
echo "Dashboard"
assert_json_object "GET /dashboard"           "$BASE/api/v1/dashboard"
assert_json_object "GET /dashboard/attention" "$BASE/api/v1/dashboard/attention"

# ── Inventory ─────────────────────────────────────────────────
echo ""
echo "Inventory"
assert_json_array  "GET /inventory/items"     "$BASE/api/v1/inventory/items"

# ── Documents ─────────────────────────────────────────────────
echo ""
echo "Documents"
assert_json_array  "GET /documents"           "$BASE/api/v1/documents"
assert_200         "GET /documents/expiring"  "$BASE/api/v1/documents/expiring"

# ── Books ─────────────────────────────────────────────────────
echo ""
echo "Books"
assert_json_array  "GET /books"               "$BASE/api/v1/books"
assert_json_object "GET /books/stats"         "$BASE/api/v1/books/stats"

# ── Resources ─────────────────────────────────────────────────
echo ""
echo "Resources"
assert_json_array  "GET /resources"           "$BASE/api/v1/resources"

# ── Medical ───────────────────────────────────────────────────
echo ""
echo "Medical"
assert_json_array  "GET /medical/medications" "$BASE/api/v1/medical/medications"
assert_json_array  "GET /medical/conditions"  "$BASE/api/v1/medical/conditions"
assert_json_object "GET /medical/summary"     "$BASE/api/v1/medical/summary"

# ── Todos ─────────────────────────────────────────────────────
echo ""
echo "Todos"
assert_json_array  "GET /todos"               "$BASE/api/v1/todos"

# ── Finance ───────────────────────────────────────────────────
echo ""
echo "Finance"
assert_json_array  "GET /finance/accounts"    "$BASE/api/v1/finance/accounts"
assert_json_object "GET /finance/net-worth"   "$BASE/api/v1/finance/net-worth/current"

# ── HSA ───────────────────────────────────────────────────────
echo ""
echo "HSA"
assert_json_object "GET /hsa/summary"         "$BASE/api/v1/hsa/summary"
assert_json_array  "GET /hsa/payments"        "$BASE/api/v1/hsa/payments"

# ── Career ────────────────────────────────────────────────────
echo ""
echo "Career"
assert_json_array  "GET /career/jobs"         "$BASE/api/v1/career/jobs"
assert_json_array  "GET /career/goals"        "$BASE/api/v1/career/goals"

# ── Property ──────────────────────────────────────────────────
echo ""
echo "Property"
assert_json_array  "GET /property/properties" "$BASE/api/v1/property/properties"
assert_json_array  "GET /property/vehicles"   "$BASE/api/v1/property/vehicles"

# ── Kids ──────────────────────────────────────────────────────
echo ""
echo "Kids"
assert_json_array  "GET /kids"                "$BASE/api/v1/kids"

# ── Settings shared data ──────────────────────────────────────
echo ""
echo "Settings — shared data (must always be public)"
assert_json_array  "GET /settings/tags"       "$BASE/api/v1/settings/tags"
assert_json_array  "GET /settings/family"     "$BASE/api/v1/settings/family"
assert_json_array  "GET /settings/dropdowns"  "$BASE/api/v1/settings/dropdowns"
assert_json_array  "GET /settings/contacts"   "$BASE/api/v1/settings/contacts"

# ── Backup ────────────────────────────────────────────────────
echo ""
echo "Backup"
assert_401 "GET /backup/list (protected)" "$BASE/api/v1/backup/list" "GET"

# ── Daily log ─────────────────────────────────────────────────
echo ""
echo "Daily Log"
assert_json_array  "GET /daily-log"           "$BASE/api/v1/daily-log"

# ── Auth wall ─────────────────────────────────────────────────
echo ""
echo "Auth wall (no token — must return 401)"
assert_401 "POST /settings/family (protected)" "$BASE/api/v1/settings/family"
assert_401 "POST /books (protected)"           "$BASE/api/v1/books"
assert_401 "POST /documents (protected)"       "$BASE/api/v1/documents"

# ── Summary ───────────────────────────────────────────────────
TOTAL=$((PASS + FAIL))
echo ""
echo "──────────────────────────────────────────────"
echo "Results: $PASS passed, $FAIL failed (${TOTAL} total)"
if [ ${#ERRORS[@]} -gt 0 ]; then
  echo ""
  echo "Failures:"
  for e in "${ERRORS[@]}"; do
    echo -e "  ${red}✗${reset} $e"
  done
fi
echo ""

if [ "$FAIL" -gt 0 ]; then
  echo -e "${red}SMOKE TEST FAILED — do not ship this deploy.${reset}"
  exit 1
else
  echo -e "${green}SMOKE TEST PASSED — safe to package deploy zip.${reset}"
  exit 0
fi
