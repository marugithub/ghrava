#!/usr/bin/env bash
# smoke-test.sh — Ghrava pre-deploy validation
# Tests HTTP status codes AND response body shape. Exits 1 on failure.
# Usage: ./smoke-test.sh [http://host:port]

BASE="${1:-http://localhost:3001}"
PASS=0; FAIL=0; ERRORS=()
green='\033[0;32m'; red='\033[0;31m'; yellow='\033[0;33m'; reset='\033[0m'

echo "Waiting for $BASE/health ..."
for i in $(seq 1 30); do
  code=$(curl -s -o /dev/null -w "%{http_code}" --max-time 2 "$BASE/health" 2>/dev/null)
  [ "$code" = "200" ] && { echo "Up (${i}s)"; break; }
  sleep 1
  [ "$i" = "30" ] && { echo "Server not up after 30s"; exit 1; }
done

pass() { echo -e "  ${green}PASS${reset}  $1"; ((PASS++)); }
fail() { echo -e "  ${red}FAIL${reset}  $1"; ((FAIL++)); ERRORS+=("$1"); }
warn() { echo -e "  ${yellow}WARN${reset}  $1"; ((PASS++)); }

# Assert 200 + JSON (array or object)
assert_json() {
  local label="$1" url="$2"
  local code body
  code=$(curl -s -o /tmp/gh_b -w "%{http_code}" --max-time 6 "$url")
  body=$(cat /tmp/gh_b)
  if [ "$code" != "200" ]; then fail "$label  (HTTP $code)"
  elif echo "$body" | grep -qE '^\[|^\{'; then pass "$label"
  else fail "$label  (200 but body not JSON: ${body:0:60})"; fi
}

# Assert 200
assert_200() {
  local code
  code=$(curl -s -o /dev/null -w "%{http_code}" --max-time 6 "$2")
  [ "$code" = "200" ] && pass "$1" || fail "$1  (HTTP $code)"
}

# Assert JSON array, show count
assert_array() {
  local label="$1" url="$2"
  local code body cnt
  code=$(curl -s -o /tmp/gh_b -w "%{http_code}" --max-time 6 "$url")
  body=$(cat /tmp/gh_b)
  if [ "$code" != "200" ]; then fail "$label  (HTTP $code)"
  elif echo "$body" | grep -qE '^\['; then
    cnt=$(echo "$body" | python3 -c "import sys,json; print(len(json.load(sys.stdin)))" 2>/dev/null || echo "?")
    pass "$label  ($cnt items)"
  else fail "$label  (200 but not array: ${body:0:60})"; fi
}

# Assert JSON object contains a specific key
assert_key() {
  local label="$1" url="$2" key="$3"
  local code body
  code=$(curl -s -o /tmp/gh_b -w "%{http_code}" --max-time 6 "$url")
  body=$(cat /tmp/gh_b)
  if [ "$code" != "200" ]; then fail "$label  (HTTP $code)"
  elif echo "$body" | python3 -c "import sys,json; d=json.load(sys.stdin); sys.exit(0 if '$key' in d else 1)" 2>/dev/null; then
    pass "$label  (has '$key')"
  else fail "$label  (missing '$key' in: ${body:0:80})"; fi
}

# Assert empty POST returns 400/422 (route exists + validates input)
assert_write() {
  local label="$1" url="$2"
  local code
  code=$(curl -s -o /dev/null -w "%{http_code}" --max-time 5 \
    -X POST -H "Content-Type: application/json" -d '{}' "$url")
  case "$code" in
    400|422) pass "$label  (${code} validation)" ;;
    201)     warn "$label  (201 — no required fields enforced)" ;;
    *)       fail "$label  (expected 400/422, got $code)" ;;
  esac
}

echo ""; echo "Ghrava Smoke Test  |  $BASE"
echo "══════════════════════════════════════════════"

echo ""; echo "── Pages ──"
for p in index finance medical inventory property kids career books todos documents resources daily-log reports settings data notifications; do
  assert_200 "GET /$p.html" "$BASE/$p.html"
done

echo ""; echo "── App ──"
assert_key  "GET /health"          "$BASE/health"                   "status"
assert_key  "GET /app/info"        "$BASE/api/v1/app/info"         "version"
assert_key  "GET /settings/config" "$BASE/api/v1/settings/config"  "app_name"

echo ""; echo "── Dashboard ──"
assert_key  "GET /dashboard"           "$BASE/api/v1/dashboard"           "stats"
assert_key  "GET /dashboard/attention" "$BASE/api/v1/dashboard/attention" "items"

echo ""; echo "── Finance ──"
assert_array "GET /finance/accounts"              "$BASE/api/v1/finance/accounts"
assert_key   "GET /finance/net-worth/current"     "$BASE/api/v1/finance/net-worth/current"  "total_assets"
assert_json  "GET /finance/transactions/unified"  "$BASE/api/v1/finance/transactions/unified"
assert_array "GET /finance/category-rules"        "$BASE/api/v1/finance/category-rules"
assert_array "GET /finance/gift-cards"            "$BASE/api/v1/finance/gift-cards"
assert_key   "GET /finance/budgets"               "$BASE/api/v1/finance/budgets"             "budgets"
assert_array "GET /import/accounts"               "$BASE/api/v1/import/accounts"
assert_array "GET /import/batches"                "$BASE/api/v1/import/batches"

echo ""; echo "── Recategorize ──"
recat_code=$(curl -s -o /tmp/gh_b -w "%{http_code}" --max-time 8 \
  -X POST -H "Content-Type: application/json" -d '{"overwrite":false}' \
  "$BASE/api/v1/finance/transactions/recategorize")
recat_resp=$(cat /tmp/gh_b)
if [ "$recat_code" = "200" ] && echo "$recat_resp" | python3 -c "import sys,json; d=json.load(sys.stdin); sys.exit(0 if d.get('ok') else 1)" 2>/dev/null; then
  pass "POST /finance/transactions/recategorize"
else fail "POST /finance/transactions/recategorize  (HTTP $recat_code: ${recat_resp:0:60})"; fi

echo ""; echo "── HSA ──"
assert_key  "GET /hsa/summary"  "$BASE/api/v1/hsa/summary"  "year"
assert_array "GET /hsa/payments" "$BASE/api/v1/hsa/payments"

echo ""; echo "── Inventory ──"
assert_array "GET /inventory/items"     "$BASE/api/v1/inventory/items"
assert_array "GET /inventory/locations" "$BASE/api/v1/inventory/locations"

echo ""; echo "── Medical ──"
assert_array "GET /medical/medications" "$BASE/api/v1/medical/medications"
assert_array "GET /medical/conditions"  "$BASE/api/v1/medical/conditions"
assert_array "GET /medical/notes"       "$BASE/api/v1/medical/notes"
assert_array "GET /medical/eob"         "$BASE/api/v1/medical/eob"

echo ""; echo "── Books ──"
assert_array "GET /books"       "$BASE/api/v1/books"
assert_key   "GET /books/stats" "$BASE/api/v1/books/stats" "total"

echo ""; echo "── Career ──"
assert_array "GET /career/jobs"           "$BASE/api/v1/career/jobs"
assert_array "GET /career/certifications" "$BASE/api/v1/career/certifications"
assert_array "GET /career/goals"          "$BASE/api/v1/career/goals"

echo ""; echo "── Property ──"
assert_array "GET /property/properties"  "$BASE/api/v1/property/properties"
assert_array "GET /property/vehicles"    "$BASE/api/v1/property/vehicles"

echo ""; echo "── Todos / Kids / Daily ──"
assert_json  "GET /todos"     "$BASE/api/v1/todos"
assert_array "GET /kids"      "$BASE/api/v1/kids"
assert_json  "GET /daily-log" "$BASE/api/v1/daily-log"

echo ""; echo "── Documents / Resources ──"
assert_array "GET /documents"           "$BASE/api/v1/documents"
assert_200   "GET /documents/expiring"  "$BASE/api/v1/documents/expiring"
assert_array "GET /resources"           "$BASE/api/v1/resources"

echo ""; echo "── Settings ──"
assert_array "GET /settings/family"      "$BASE/api/v1/settings/family"
assert_array "GET /settings/tags"        "$BASE/api/v1/settings/tags"
assert_array "GET /settings/contacts"    "$BASE/api/v1/settings/contacts"
assert_array "GET /settings/dropdowns"   "$BASE/api/v1/settings/dropdowns"
assert_key   "GET /settings/completeness" "$BASE/api/v1/settings/completeness" "total"

echo ""; echo "── CSV Exports ──"
assert_200 "GET /medical/conditions/export/csv"  "$BASE/api/v1/medical/conditions/export/csv"
assert_200 "GET /career/certifications/export"   "$BASE/api/v1/career/certifications/export/csv"
assert_200 "GET /property/vehicles/export/csv"   "$BASE/api/v1/property/vehicles/export/csv"
assert_200 "GET /daily-log/export/csv"           "$BASE/api/v1/daily-log/export/csv"
assert_200 "GET /documents/export/csv"           "$BASE/api/v1/documents/export/csv"

echo ""; echo "── Data / Backup ──"
assert_200 "GET /data/template (xlsx)"  "$BASE/api/v1/data/template"
assert_200 "GET /backup/list"           "$BASE/api/v1/backup/list"
TODAY=$(date +%Y%m%d)
if curl -s "$BASE/api/v1/backup/list" | grep -q "auto_${TODAY}"; then
  pass "Backup from today exists"
else warn "No backup from today yet (expected after first run)"; fi

echo ""; echo "── Write routes (empty POST → 400) ──"
assert_write "POST /books"               "$BASE/api/v1/books"
assert_write "POST /documents"           "$BASE/api/v1/documents"
assert_write "POST /settings/family"     "$BASE/api/v1/settings/family"
assert_write "POST /finance/accounts"    "$BASE/api/v1/finance/accounts"
assert_write "POST /medical/conditions"  "$BASE/api/v1/medical/conditions"
assert_write "POST /career/jobs"         "$BASE/api/v1/career/jobs"
assert_write "POST /kids"                "$BASE/api/v1/kids"
assert_write "POST /inventory/items"     "$BASE/api/v1/inventory/items"

TOTAL=$((PASS + FAIL))
echo ""; echo "══════════════════════════════════════════════"
echo "Results: ${PASS} passed, ${FAIL} failed (${TOTAL} total)"
if [ ${#ERRORS[@]} -gt 0 ]; then
  echo ""; echo "Failures:"
  for e in "${ERRORS[@]}"; do echo -e "  ${red}✗${reset} $e"; done
fi
echo ""
if [ "$FAIL" -gt 0 ]; then
  echo -e "${red}SMOKE TEST FAILED${reset}"; exit 1
else
  echo -e "${green}SMOKE TEST PASSED${reset}"; exit 0
fi
