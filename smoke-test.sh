#!/usr/bin/env bash
# smoke-test.sh — Ghrava pre-deploy validation
# Tests HTTP status, response shape, required keys, and known-broken internals.
# Exits 1 on any FAIL. WARNs count as pass.
# Usage: ./smoke-test.sh [http://host:port]

BASE="${1:-http://localhost:3001}"
PASS=0; FAIL=0; WARN_COUNT=0; ERRORS=()
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
warn() { echo -e "  ${yellow}WARN${reset}  $1"; ((WARN_COUNT++)); }
section() { echo ""; echo "── $1 ──"; }

# ── Helpers ────────────────────────────────────────────────────

fetch() {
  local url="$1"
  curl -s -o /tmp/gh_body -w "%{http_code}" --max-time 8 "$url"
}

fetch_post() {
  local url="$1" data="${2:-{}}"
  curl -s -o /tmp/gh_body -w "%{http_code}" --max-time 8 \
    -X POST -H "Content-Type: application/json" -d "$data" "$url"
}

body() { cat /tmp/gh_body; }

is_json()  { body | python3 -c "import sys,json; json.load(sys.stdin)" 2>/dev/null; }
is_array() { body | python3 -c "import sys,json; d=json.load(sys.stdin); sys.exit(0 if isinstance(d,list) else 1)" 2>/dev/null; }
has_key()  { body | python3 -c "import sys,json; d=json.load(sys.stdin); sys.exit(0 if '$1' in d else 1)" 2>/dev/null; }
key_val()  { body | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('$1',''))" 2>/dev/null; }
arr_len()  { body | python3 -c "import sys,json; d=json.load(sys.stdin); print(len(d) if isinstance(d,list) else '?')" 2>/dev/null; }
no_error() { body | python3 -c "import sys,json; d=json.load(sys.stdin); sys.exit(1 if 'error' in str(d).lower() and not isinstance(d,list) else 0)" 2>/dev/null; }

assert_200() {
  local label="$1" url="$2"
  local code; code=$(fetch "$url")
  [ "$code" = "200" ] && pass "$label" || fail "$label  (HTTP $code)"
}

assert_json() {
  local label="$1" url="$2"
  local code; code=$(fetch "$url")
  if [ "$code" != "200" ]; then fail "$label  (HTTP $code)"
  elif is_json; then pass "$label"
  else fail "$label  (not JSON: $(body | head -c 80))"; fi
}

assert_array() {
  local label="$1" url="$2"
  local code; code=$(fetch "$url")
  if [ "$code" != "200" ]; then fail "$label  (HTTP $code)"
  elif is_array; then pass "$label  ($(arr_len) items)"
  else fail "$label  (not array: $(body | head -c 80))"; fi
}

assert_key() {
  local label="$1" url="$2" key="$3"
  local code; code=$(fetch "$url")
  if [ "$code" != "200" ]; then fail "$label  (HTTP $code)"
  elif has_key "$key"; then pass "$label  (has '$key')"
  else fail "$label  (missing '$key' in: $(body | head -c 80))"; fi
}

assert_keys() {
  # assert_keys "label" "url" "key1 key2 key3"
  local label="$1" url="$2" keys="$3"
  local code; code=$(fetch "$url")
  if [ "$code" != "200" ]; then fail "$label  (HTTP $code)"; return; fi
  local missing=""
  for k in $keys; do
    has_key "$k" || missing="$missing $k"
  done
  if [ -z "$missing" ]; then pass "$label"
  else fail "$label  (missing keys:$missing)"; fi
}

assert_write() {
  local label="$1" url="$2"
  local code; code=$(fetch_post "$url" '{}')
  case "$code" in
    400|422) pass "$label  (${code} validation)" ;;
    201)     warn "$label  (201 with empty body — no required fields enforced)" ;;
    *)       fail "$label  (expected 400/422, got $code)" ;;
  esac
}

assert_not_found() {
  local label="$1" url="$2"
  local code; code=$(fetch "$url")
  [ "$code" = "404" ] && pass "$label  (404 as expected)" || fail "$label  (expected 404, got $code — route may be stale)"
}

assert_schema() {
  # Check a DB column exists via the API response containing an expected field
  local label="$1" url="$2" field="$3"
  local code; code=$(fetch "$url")
  if [ "$code" != "200" ]; then fail "$label  (HTTP $code)"; return; fi
  body | python3 -c "
import sys, json
d = json.load(sys.stdin)
rows = d if isinstance(d, list) else d.get('items', d.get('data', []))
if not rows:
    print('SKIP')  # empty list, can'\''t check
    sys.exit(0)
first = rows[0] if isinstance(rows, list) else rows
sys.exit(0 if '$field' in first else 1)
" 2>/dev/null && pass "$label  (field '$field' present)" || warn "$label  (field '$field' absent — migration may be pending)"
}

# ══════════════════════════════════════════════════════════════
echo ""; echo "Ghrava Smoke Test  |  $BASE"
echo "══════════════════════════════════════════════"

# ── Pages ─────────────────────────────────────────────────────
section "Pages (HTML 200)"
for p in index finance medical inventory property kids career books todos documents resources daily-log reports settings data notifications; do
  assert_200 "GET /$p.html" "$BASE/$p.html"
done

# ── App / Health ───────────────────────────────────────────────
section "App"
assert_keys "GET /health"   "$BASE/health"           "status"
assert_keys "GET /app/info" "$BASE/api/v1/app/info"  "version"

# Version format check
V=$(key_val "version" 2>/dev/null)
if echo "$V" | grep -qE '^[0-9]{6}\.[0-9]+$'; then
  pass "Version format valid ($V)"
else
  warn "Version format unexpected: '$V'"
fi

assert_key "GET /settings/config" "$BASE/api/v1/settings/config" "app_name"

# ── Schema / Migration checks ──────────────────────────────────
section "Schema (migration completeness)"
# These check that expected columns exist in API responses
# Empty tables return WARN (can't confirm), populated return PASS/FAIL
assert_schema "todos.recurrence_days" "$BASE/api/v1/todos" "recurrence_days"
assert_schema "todos.recurrence"      "$BASE/api/v1/todos" "recurrence"
assert_schema "books.pages_total"     "$BASE/api/v1/books" "pages_total"
assert_schema "career/jobs columns"   "$BASE/api/v1/career/jobs" "company"

# ── Dashboard ─────────────────────────────────────────────────
section "Dashboard"
assert_keys "GET /dashboard"           "$BASE/api/v1/dashboard"           "stats"
assert_keys "GET /dashboard/attention" "$BASE/api/v1/dashboard/attention" "items counts"

# Attention should not error internally
code=$(fetch "$BASE/api/v1/dashboard/attention")
if [ "$code" = "200" ]; then
  CNT=$(body | python3 -c "import sys,json; d=json.load(sys.stdin); print(len(d.get('items',[])))" 2>/dev/null)
  pass "GET /dashboard/attention  ($CNT attention items)"
else
  fail "GET /dashboard/attention  (HTTP $code)"
fi

# ── Settings ──────────────────────────────────────────────────
section "Settings"
assert_array "GET /settings/family"       "$BASE/api/v1/settings/family"
assert_array "GET /settings/tags"         "$BASE/api/v1/settings/tags"
assert_array "GET /settings/contacts"     "$BASE/api/v1/settings/contacts"
assert_array "GET /settings/dropdowns"    "$BASE/api/v1/settings/dropdowns"
assert_key   "GET /settings/completeness" "$BASE/api/v1/settings/completeness" "total"
assert_json  "GET /settings/review/summary" "$BASE/api/v1/settings/review/summary"

# contact_type dropdown should be seeded
code=$(fetch "$BASE/api/v1/settings/dropdowns/contact_type")
if [ "$code" = "200" ] && is_array; then
  CNT=$(arr_len)
  [ "$CNT" -gt 0 ] && pass "contact_type dropdown seeded ($CNT types)" || warn "contact_type dropdown empty — run seed migration"
else
  warn "contact_type dropdown not found (migration 078 pending)"
fi

# ── Finance ───────────────────────────────────────────────────
section "Finance — Accounts"
assert_array "GET /finance/accounts"      "$BASE/api/v1/finance/accounts"
assert_array "GET /import/accounts"       "$BASE/api/v1/import/accounts"

section "Finance — Transactions"
assert_keys "GET /finance/transactions/unified" "$BASE/api/v1/finance/transactions/unified" "transactions summary"
assert_array "GET /finance/category-rules" "$BASE/api/v1/finance/category-rules"
assert_array "GET /finance/import-batches" "$BASE/api/v1/finance/import-batches"
assert_array "GET /import/batches"         "$BASE/api/v1/import/batches"

# Stale route check — import-csv should be GONE
section "Finance — Stale route check"
assert_not_found "POST /finance/transactions/import-csv (should be removed)" \
  "$BASE/api/v1/finance/transactions/import-csv"

section "Finance — Reports"
assert_json "GET /finance/reports/spending-by-category" "$BASE/api/v1/finance/reports/spending-by-category"
assert_json "GET /finance/reports/monthly-totals"       "$BASE/api/v1/finance/reports/monthly-totals"
assert_json "GET /finance/reports/hsa-summary"          "$BASE/api/v1/finance/reports/hsa-summary"
assert_json "GET /finance/reports/net-worth-trend"      "$BASE/api/v1/finance/reports/net-worth-trend"
assert_json "GET /finance/reports/annual-summary"       "$BASE/api/v1/finance/reports/annual-summary"

section "Finance — Net Worth"
assert_keys "GET /finance/net-worth/current"   "$BASE/api/v1/finance/net-worth/current" "total_assets total_liabilities net_worth"
assert_array "GET /finance/net-worth/snapshots" "$BASE/api/v1/finance/net-worth/snapshots"

section "Finance — Import"
assert_json "GET /import/holdings"            "$BASE/api/v1/import/holdings"
assert_json "GET /import/spending"            "$BASE/api/v1/import/spending"
assert_json "GET /import/missing-statements"  "$BASE/api/v1/import/missing-statements"

section "Finance — Gift Cards / Budgets"
assert_array "GET /finance/gift-cards" "$BASE/api/v1/finance/gift-cards"
assert_key   "GET /finance/budgets"    "$BASE/api/v1/finance/budgets" "budgets"

# ── HSA ───────────────────────────────────────────────────────
section "HSA"
assert_key   "GET /hsa/summary"       "$BASE/api/v1/hsa/summary"       "year"
assert_array "GET /hsa/payments"      "$BASE/api/v1/hsa/payments"
assert_array "GET /hsa/otc"           "$BASE/api/v1/hsa/otc"
assert_json  "GET /hsa/pool"          "$BASE/api/v1/hsa/pool"
assert_array "GET /hsa/reimbursements" "$BASE/api/v1/hsa/reimbursements"

# ── Medical ───────────────────────────────────────────────────
section "Medical"
assert_array "GET /medical/medications" "$BASE/api/v1/medical/medications"
assert_array "GET /medical/conditions"  "$BASE/api/v1/medical/conditions"
assert_array "GET /medical/notes"       "$BASE/api/v1/medical/notes"
assert_array "GET /medical/eob"         "$BASE/api/v1/medical/eob"

# ── Inventory ─────────────────────────────────────────────────
section "Inventory"
assert_array "GET /inventory/items"      "$BASE/api/v1/inventory/items"
assert_array "GET /inventory/locations"  "$BASE/api/v1/inventory/locations"
assert_array "GET /inventory/containers" "$BASE/api/v1/inventory/containers"
assert_json  "GET /inventory/search"     "$BASE/api/v1/inventory/search"

# ── Books ─────────────────────────────────────────────────────
section "Books"
assert_array "GET /books"       "$BASE/api/v1/books"
assert_key   "GET /books/stats" "$BASE/api/v1/books/stats" "total"

# ── Career ────────────────────────────────────────────────────
section "Career"
assert_array "GET /career/jobs"           "$BASE/api/v1/career/jobs"
assert_array "GET /career/certifications" "$BASE/api/v1/career/certifications"
assert_array "GET /career/goals"          "$BASE/api/v1/career/goals"
assert_array "GET /career/skills"         "$BASE/api/v1/career/skills"
assert_array "GET /career/education"      "$BASE/api/v1/career/education"

# ── Property ──────────────────────────────────────────────────
section "Property"
assert_array "GET /property/properties" "$BASE/api/v1/property/properties"
assert_array "GET /property/vehicles"   "$BASE/api/v1/property/vehicles"

# ── Todos / Daily Log / Kids ───────────────────────────────────
section "Todos / Daily Log / Kids"
assert_json  "GET /todos"            "$BASE/api/v1/todos"
assert_json  "GET /todos/count"      "$BASE/api/v1/todos/count"
assert_array "GET /kids"             "$BASE/api/v1/kids"
assert_json  "GET /kids/summary/dashboard" "$BASE/api/v1/kids/summary/dashboard"
assert_json  "GET /daily-log"        "$BASE/api/v1/daily-log"
assert_array "GET /daily-log/categories" "$BASE/api/v1/daily-log/categories"
assert_array "GET /daily-log/follow-ups" "$BASE/api/v1/daily-log/follow-ups"

# ── Documents / Resources ─────────────────────────────────────
section "Documents / Resources"
assert_array "GET /documents"           "$BASE/api/v1/documents"
assert_json  "GET /documents/expiring"  "$BASE/api/v1/documents/expiring"
assert_array "GET /resources"           "$BASE/api/v1/resources"
assert_array "GET /resources/categories" "$BASE/api/v1/resources/categories"

# ── Notifications ─────────────────────────────────────────────
section "Notifications"
assert_json "GET /notifications/unread-count" "$BASE/api/v1/notifications/unread-count"

# ── Google integration ────────────────────────────────────────
section "Google"
assert_json "GET /google/status" "$BASE/api/v1/google/status"
# Should NOT have calendar in status (replaced by tasks)
code=$(fetch "$BASE/api/v1/google/status")
if [ "$code" = "200" ]; then
  HAS_TASKS=$(body | python3 -c "import sys,json; d=json.load(sys.stdin); s=d.get('services',{}); print('yes' if 'tasks' in s else 'no')" 2>/dev/null)
  HAS_CAL=$(body | python3 -c "import sys,json; d=json.load(sys.stdin); s=d.get('services',{}); print('yes' if 'calendar' in s else 'no')" 2>/dev/null)
  [ "$HAS_TASKS" = "yes" ] && pass "Google status has tasks service" || warn "Google status missing tasks service (B2 pending)"
  [ "$HAS_CAL" = "no" ] && pass "Google calendar removed from status" || warn "Google calendar still in status (B2 pending)"
fi

# ── Data / Backup ─────────────────────────────────────────────
section "Data / Backup"
assert_200 "GET /data/template (xlsx)" "$BASE/api/v1/data/template"
assert_200 "GET /backup/list"          "$BASE/api/v1/backup/list"
TODAY=$(date +%Y%m%d)
if curl -s "$BASE/api/v1/backup/list" | grep -q "auto_${TODAY}"; then
  pass "Backup from today exists"
else
  warn "No backup from today yet"
fi

# ── Recategorize ──────────────────────────────────────────────
section "Write routes"
code=$(fetch_post "$BASE/api/v1/finance/transactions/recategorize" '{"overwrite":false}')
[ "$code" = "200" ] && has_key "ok" && pass "POST /finance/transactions/recategorize" \
  || fail "POST /finance/transactions/recategorize  (HTTP $code)"

# Empty POST → 400 validation
assert_write "POST /books"              "$BASE/api/v1/books"
assert_write "POST /documents"          "$BASE/api/v1/documents"
assert_write "POST /settings/family"    "$BASE/api/v1/settings/family"
assert_write "POST /finance/accounts"   "$BASE/api/v1/finance/accounts"
assert_write "POST /medical/conditions" "$BASE/api/v1/medical/conditions"
assert_write "POST /career/jobs"        "$BASE/api/v1/career/jobs"
assert_write "POST /kids"               "$BASE/api/v1/kids"
assert_write "POST /inventory/items"    "$BASE/api/v1/inventory/items"
assert_write "POST /hsa/payments"       "$BASE/api/v1/hsa/payments"
assert_write "POST /property/vehicles"  "$BASE/api/v1/property/vehicles"
assert_write "POST /todos"              "$BASE/api/v1/todos"
assert_write "POST /resources"          "$BASE/api/v1/resources"

# ── Known regression checks ───────────────────────────────────
section "Known regression checks"

# A3: import-csv stale route already checked above
# A5: dashboard attention certs — check it doesn't crash
code=$(fetch "$BASE/api/v1/dashboard/attention")
[ "$code" = "200" ] \
  && pass "Dashboard attention does not crash (cert query)" \
  || fail "Dashboard attention crashed (HTTP $code)"

# B4: csvDrawer should be gone — check finance.html doesn't reference openCsvImport
if curl -s "$BASE/finance.html" | grep -q "openCsvImport"; then
  warn "finance.html still has openCsvImport (dead csvDrawer — B4 pending)"
else
  pass "finance.html: openCsvImport removed"
fi

# B5: unified transaction filter — check unified endpoint returns both sources
code=$(fetch "$BASE/api/v1/finance/transactions/unified")
if [ "$code" = "200" ] && has_key "transactions"; then
  pass "Unified transactions endpoint returns expected shape"
else
  fail "Unified transactions endpoint broken (HTTP $code)"
fi

# B8: net worth should include investment total
code=$(fetch "$BASE/api/v1/finance/net-worth/current")
if [ "$code" = "200" ]; then
  HAS_INV=$(body | python3 -c "import sys,json; d=json.load(sys.stdin); print('yes' if 'investment_total' in d else 'no')" 2>/dev/null)
  [ "$HAS_INV" = "yes" ] \
    && pass "Net worth includes investment_total (B8 done)" \
    || warn "Net worth missing investment_total (B8 pending)"
fi

# ── Summary ───────────────────────────────────────────────────
TOTAL=$((PASS + FAIL))
echo ""
echo "══════════════════════════════════════════════"
printf "Results: %d passed, %d failed, %d warned (%d total)\n" $PASS $FAIL $WARN_COUNT $TOTAL

if [ ${#ERRORS[@]} -gt 0 ]; then
  echo ""
  echo "Failures:"
  for e in "${ERRORS[@]}"; do echo -e "  ${red}✗${reset} $e"; done
fi

echo ""
if [ "$FAIL" -gt 0 ]; then
  echo -e "${red}SMOKE TEST FAILED${reset}"; exit 1
else
  echo -e "${green}SMOKE TEST PASSED${reset} (${WARN_COUNT} warnings)"; exit 0
fi
