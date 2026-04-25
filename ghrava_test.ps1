# Ghrava_Test.ps1
# Interactive test launcher for Ghrava.
# Every run writes a timestamped report to ~/Downloads.
#
# Usage:
#   .\Ghrava_Test.ps1                                     # interactive menu
#   .\Ghrava_Test.ps1 -Choice 9                           # non-interactive run-all
#   .\Ghrava_Test.ps1 -BaseUrl http://192.168.4.62:3001 -Choice 1

param(
    [string]$BaseUrl   = 'http://192.168.4.62:3001',
    [string]$Container = 'ghrava',
    [string]$Choice    = ''
)

$ErrorActionPreference = 'Continue'

# ── Test suite metadata ───────────────────────────────────────
$SuiteVersion = '1.1.0'
$SuiteDate    = '2026-04-25'

# ── Output collection (every run writes a report) ─────────────
$script:CapturedOutput = New-Object System.Text.StringBuilder
$script:TotalPass      = 0
$script:TotalFail      = 0
$script:TotalWarn      = 0

function Write-Out {
    param([string]$Text, [string]$Color = 'White')
    Write-Host $Text -ForegroundColor $Color
    [void]$script:CapturedOutput.AppendLine($Text)
}

function Section {
    param([string]$Title)
    Write-Out ""
    Write-Out ("-" * 60) Cyan
    Write-Out "  $Title" Cyan
    Write-Out ("-" * 60) Cyan
}

function Pass { param([string]$M); Write-Out "  PASS  $M" Green;  $script:TotalPass++ }
function Fail { param([string]$M); Write-Out "  FAIL  $M" Red;    $script:TotalFail++ }
function Warn { param([string]$M); Write-Out "  WARN  $M" Yellow; $script:TotalWarn++ }

# ── HTTP helper ───────────────────────────────────────────────
function Get-Json {
    param([string]$Path, [string]$Method = 'GET', [object]$Body = $null)
    try {
        $params = @{
            Uri             = "$BaseUrl$Path"
            Method          = $Method
            UseBasicParsing = $true
            TimeoutSec      = 10
            ErrorAction     = 'Stop'
        }
        if ($Body) {
            $params.Body        = ($Body | ConvertTo-Json -Compress -Depth 8)
            $params.ContentType = 'application/json'
        }
        $r = Invoke-WebRequest @params
        return @{ Code = [int]$r.StatusCode; Body = $r.Content }
    } catch {
        $code = 0
        if ($_.Exception.Response) { $code = [int]$_.Exception.Response.StatusCode }
        return @{ Code = $code; Body = $_.Exception.Message }
    }
}

function Test-Up {
    $r = Get-Json '/health'
    if ($r.Code -eq 200) { return $true }
    Fail "Container not reachable at $BaseUrl (HTTP $($r.Code))"
    return $false
}

function Get-AppVersion {
    $r = Get-Json '/api/v1/app/info'
    if ($r.Code -eq 200) {
        try {
            $obj = $r.Body | ConvertFrom-Json
            return $obj.version
        } catch { return 'unknown' }
    }
    return 'unreachable'
}

# ══════════════════════════════════════════════════════════════
# Test descriptions — included in every report header
# ══════════════════════════════════════════════════════════════
$TestDescriptions = @{
    '1' = 'Smoke Test: GET probes against ~36 routes + 18 HTML pages. Verifies the server is up, responds 200, and JSON shape contains expected keys.'
    '2' = 'Schema Check: lists pending migrations vs live _migrations table, runs each inside a SAVEPOINT and rolls back. Catches column-name typos / syntax errors before deploy.'
    '3' = 'Frontend: loads each HTML page and checks for missing script includes (lt-core.js, lt-refs.js), known-broken patterns (LT.toast undefined, cross-module api() with wrong prefix), and that static assets resolve.'
    '4' = 'Deep CRUD: creates, reads, updates, archives, and deletes test records in inventory + medical (priority modules). Verifies persistence and cleans up.'
    '5' = 'Backup: counts existing backups, calls POST /backup/now, confirms the count increased and the new .db file is non-empty.'
    '9' = 'Runs all of 1 through 5 in order.'
}

# ══════════════════════════════════════════════════════════════
# 1) SMOKE
# ══════════════════════════════════════════════════════════════
function Run-Smoke {
    Section "1) Smoke Test - HTTP routes"
    if (-not (Test-Up)) { return }

    $routes = @(
        @{ M='GET'; P='/health';                                 N='health' }
        @{ M='GET'; P='/api/v1/app/info';                        N='app/info';                K='version' }
        @{ M='GET'; P='/api/v1/dashboard';                       N='dashboard';               K='stats' }
        @{ M='GET'; P='/api/v1/dashboard/attention';             N='dashboard/attention';     K='items' }
        @{ M='GET'; P='/api/v1/settings/family';                 N='settings/family' }
        @{ M='GET'; P='/api/v1/settings/tags';                   N='settings/tags' }
        @{ M='GET'; P='/api/v1/settings/contacts';               N='settings/contacts' }
        @{ M='GET'; P='/api/v1/inventory/items';                 N='inventory/items' }
        @{ M='GET'; P='/api/v1/inventory/locations';             N='inventory/locations' }
        @{ M='GET'; P='/api/v1/inventory/containers';            N='inventory/containers' }
        @{ M='GET'; P='/api/v1/medical/medications';             N='medical/medications' }
        @{ M='GET'; P='/api/v1/medical/conditions';              N='medical/conditions' }
        @{ M='GET'; P='/api/v1/medical/notes';                   N='medical/notes' }
        @{ M='GET'; P='/api/v1/medical/eob';                     N='medical/eob' }
        @{ M='GET'; P='/api/v1/hsa/payments';                    N='hsa/payments' }
        @{ M='GET'; P='/api/v1/hsa/summary';                     N='hsa/summary' }
        @{ M='GET'; P='/api/v1/finance/accounts';                N='finance/accounts' }
        @{ M='GET'; P='/api/v1/finance/net-worth/current';       N='finance/net-worth/current' }
        @{ M='GET'; P='/api/v1/books';                           N='books' }
        @{ M='GET'; P='/api/v1/career/jobs';                     N='career/jobs' }
        @{ M='GET'; P='/api/v1/career/certifications';           N='career/certifications' }
        @{ M='GET'; P='/api/v1/property/properties';             N='property/properties' }
        @{ M='GET'; P='/api/v1/property/vehicles';               N='property/vehicles' }
        @{ M='GET'; P='/api/v1/todos';                           N='todos' }
        @{ M='GET'; P='/api/v1/kids';                            N='kids' }
        @{ M='GET'; P='/api/v1/daily-log';                       N='daily-log' }
        @{ M='GET'; P='/api/v1/daily-log/memories';              N='daily-log/memories' }
        @{ M='GET'; P='/api/v1/documents';                       N='documents' }
        @{ M='GET'; P='/api/v1/resources';                       N='resources' }
        @{ M='GET'; P='/api/v1/wardrobe/items';                  N='wardrobe/items' }
        @{ M='GET'; P='/api/v1/perfume/';                        N='perfume' }
        @{ M='GET'; P='/api/v1/insurance/';                      N='insurance' }
        @{ M='GET'; P='/api/v1/subscriptions/';                  N='subscriptions' }
        @{ M='GET'; P='/api/v1/notifications/unread-count';      N='notifications/unread-count' }
        @{ M='GET'; P='/api/v1/search?q=test';                   N='search'; K='groups' }
        @{ M='GET'; P='/api/v1/backup/list';                     N='backup/list' }
        @{ M='GET'; P='/api/v1/backup/schedule';                 N='backup/schedule'; K='enabled' }
    )
    foreach ($r in $routes) {
        $resp = Get-Json $r.P $r.M
        if ($resp.Code -ne 200) { Fail "$($r.M) $($r.P) - HTTP $($resp.Code)"; continue }
        if ($r.K) {
            try {
                $obj = $resp.Body | ConvertFrom-Json
                if ($obj.PSObject.Properties.Name -contains $r.K) { Pass "$($r.M) $($r.P) (has '$($r.K)')" }
                else { Fail "$($r.M) $($r.P) - missing key '$($r.K)'" }
            } catch { Fail "$($r.M) $($r.P) - invalid JSON" }
        } else { Pass "$($r.M) $($r.P)" }
    }

    Section "1b) HTML Pages"
    foreach ($p in 'index','inventory','medical','finance','property','kids','career','books','todos','documents','resources','daily-log','reports','settings','wardrobe','perfume','insurance','subscriptions') {
        $resp = Get-Json "/$p.html"
        if ($resp.Code -eq 200) { Pass "GET /$p.html" }
        else                    { Fail "GET /$p.html - HTTP $($resp.Code)" }
    }
}

# ══════════════════════════════════════════════════════════════
# 2) SCHEMA
# ══════════════════════════════════════════════════════════════
function Run-Schema {
    Section "2) Schema Check - pending migrations vs live DB"
    $cmd = @"
cd /app && python3 - <<'PY'
import re, os, sys, sqlite3
db_path = 'data/lifetracker.db'
if not os.path.exists(db_path):
    print('   FAIL: live DB not found at', db_path); sys.exit(1)
db = sqlite3.connect(db_path)
try:
    applied = set(r[0] for r in db.execute('SELECT filename FROM _migrations').fetchall())
except Exception as e:
    print('   WARN: _migrations table missing:', e); applied = set()
mig_dir = 'db/migrations'
pending = sorted(f for f in os.listdir(mig_dir) if f.endswith('.sql') and f not in applied)
if not pending:
    print('   OK (no pending migrations, all applied)')
    sys.exit(0)
fail = 0
for fname in pending:
    with open(os.path.join(mig_dir, fname)) as f: sql = f.read()
    stmts = [s.strip() for s in re.sub(r'--[^\n]*', '', sql).split(';')
             if s.strip() and s.strip().upper() not in ('BEGIN','COMMIT','ROLLBACK')]
    try:
        db.execute('SAVEPOINT pdc')
        for stmt in stmts: db.execute(stmt)
        db.execute('ROLLBACK TO pdc'); db.execute('RELEASE pdc')
        print(f'   OK   {fname}')
    except Exception as e:
        try: db.execute('ROLLBACK TO pdc')
        except: pass
        print(f'   FAIL {fname}: {e}'); fail += 1
sys.exit(1 if fail else 0)
PY
"@
    try {
        $output = docker exec $Container bash -lc $cmd 2>&1
        $output | ForEach-Object {
            $line = $_.ToString()
            if     ($line -match '^\s*OK')   { Pass $line.Trim() }
            elseif ($line -match '^\s*FAIL') { Fail $line.Trim() }
            elseif ($line -match '^\s*WARN') { Warn $line.Trim() }
            else                              { Write-Out "  $line" }
        }
    } catch {
        Fail "docker exec failed: $($_.Exception.Message). Is container '$Container' running?"
    }
}

# ══════════════════════════════════════════════════════════════
# 3) FRONTEND
# ══════════════════════════════════════════════════════════════
function Run-Frontend {
    Section "3) Frontend - pages, scripts, broken references"
    if (-not (Test-Up)) { return }

    $pages = 'index','inventory','medical','finance','property','kids','career','books','todos','documents','resources','daily-log','reports','settings','wardrobe','perfume','insurance','subscriptions','calendar','data','help','notifications'

    foreach ($p in $pages) {
        $resp = Get-Json "/$p.html"
        if ($resp.Code -ne 200) { Fail "GET /$p.html - HTTP $($resp.Code)"; continue }
        $html = $resp.Body
        $issues = @()
        if (($html -match 'GH_FAMILY|GH_SELECT|window\.api|GH_TAGS') -and ($html -notmatch 'lt-core\.js')) {
            $issues += 'missing lt-core.js'
        }
        if (($html -match 'GH_REFS\.') -and ($html -notmatch 'lt-refs\.js')) {
            $issues += 'uses GH_REFS but lt-refs.js not loaded'
        }
        if ($html -match 'LT\.toast\(') {
            $issues += 'LT.toast() - undefined (use toast())'
        }
        if ($html -match "[^.]\bapi\(\s*'(?:GET|POST|PUT|PATCH|DELETE)'\s*,\s*'/(settings|attachments|dashboard|notifications)/") {
            $issues += 'cross-module api() - should be window.api()'
        }
        if ($issues.Count -eq 0) { Pass "/$p.html" }
        else                     { Fail "/$p.html - $($issues -join '; ')" }
    }

    foreach ($asset in '/js/lt-core.js','/js/lt-refs.js','/shared.css','/nav.js') {
        $resp = Get-Json $asset
        if ($resp.Code -eq 200) { Pass "GET $asset" }
        else                    { Fail "GET $asset - HTTP $($resp.Code)" }
    }
}

# ══════════════════════════════════════════════════════════════
# 4) DEEP CRUD
# ══════════════════════════════════════════════════════════════
function Run-DeepCRUD {
    Section "4) Deep CRUD - inventory + medical round-trip"
    if (-not (Test-Up)) { return }

    $invName = "TEST_ITEM_$(Get-Date -Format 'HHmmss')"
    $created = Get-Json '/api/v1/inventory/items' 'POST' @{
        name = $invName; category = 'Electronics'; brand = 'TestBrand'; description = 'created by Ghrava_Test.ps1'
    }
    if ($created.Code -ne 201) {
        Fail "Inventory POST /items - HTTP $($created.Code) - $($created.Body.Substring(0,[Math]::Min(120,$created.Body.Length)))"
        return
    }
    $obj = $created.Body | ConvertFrom-Json
    $invId = $obj.id
    if (-not $invId) { Fail "Inventory POST returned no id"; return }
    Pass "Inventory POST -> id=$invId"

    $got = Get-Json "/api/v1/inventory/items/$invId"
    if ($got.Code -eq 200) {
        $g = $got.Body | ConvertFrom-Json
        if ($g.name -eq $invName) { Pass "Inventory GET id=$invId returns same name" }
        else                       { Fail "Inventory GET name mismatch: got '$($g.name)' want '$invName'" }
    } else { Fail "Inventory GET id=$invId - HTTP $($got.Code)" }

    $upd = Get-Json "/api/v1/inventory/items/$invId" 'PUT' @{
        name = $invName; category = 'Electronics'; brand = 'TestBrand_UPDATED'; description = 'updated'
    }
    if ($upd.Code -eq 200) { Pass "Inventory PUT id=$invId" }
    else                   { Fail "Inventory PUT - HTTP $($upd.Code)" }

    $verify = Get-Json "/api/v1/inventory/items/$invId"
    if ($verify.Code -eq 200) {
        $v = $verify.Body | ConvertFrom-Json
        if ($v.brand -eq 'TestBrand_UPDATED') { Pass "Inventory PUT persisted brand change" }
        else                                   { Fail "Inventory PUT did not persist - brand still '$($v.brand)'" }
    }

    $arch = Get-Json "/api/v1/inventory/items/$invId/archive" 'PATCH' @{ reason='test cleanup' }
    if ($arch.Code -in 200,204) { Pass "Inventory archive id=$invId" }
    else                        { Warn "Inventory archive - HTTP $($arch.Code) (may need different endpoint)" }

    $del = Get-Json "/api/v1/inventory/items/$invId" 'DELETE'
    if ($del.Code -eq 200) { Pass "Inventory DELETE id=$invId (post-archive)" }
    else                   { Warn "Inventory DELETE - HTTP $($del.Code) (test row may persist as archived)" }

    $condName = "TEST_COND_$(Get-Date -Format 'HHmmss')"
    $cCreated = Get-Json '/api/v1/medical/conditions' 'POST' @{
        condition_name = $condName; status = 'Active'; patient = 'Test'
    }
    if ($cCreated.Code -eq 201) {
        $co = $cCreated.Body | ConvertFrom-Json
        $cId = $co.id
        Pass "Medical condition POST -> id=$cId"

        $gC = Get-Json "/api/v1/medical/conditions/$cId"
        if ($gC.Code -eq 200) { Pass "Medical condition GET id=$cId" }
        else                  { Fail "Medical condition GET - HTTP $($gC.Code)" }

        $dC = Get-Json "/api/v1/medical/conditions/$cId" 'DELETE'
        if ($dC.Code -eq 200) { Pass "Medical condition DELETE id=$cId" }
        else                  { Warn "Medical condition DELETE - HTTP $($dC.Code)" }
    } else {
        Fail "Medical condition POST - HTTP $($cCreated.Code) - $($cCreated.Body.Substring(0,[Math]::Min(120,$cCreated.Body.Length)))"
    }

    $medName = "TEST_MED_$(Get-Date -Format 'HHmmss')"
    $mCreated = Get-Json '/api/v1/medical/medications' 'POST' @{
        name = $medName; dosage = '10mg'; status = 'Active'; patient = 'Test'
    }
    if ($mCreated.Code -eq 201) {
        $mo = $mCreated.Body | ConvertFrom-Json
        $mId = $mo.id
        Pass "Medical medication POST -> id=$mId"

        $dM = Get-Json "/api/v1/medical/medications/$mId" 'DELETE'
        if ($dM.Code -eq 200) { Pass "Medical medication DELETE id=$mId" }
        else                  { Warn "Medical medication DELETE - HTTP $($dM.Code)" }
    } else {
        Fail "Medical medication POST - HTTP $($mCreated.Code) - $($mCreated.Body.Substring(0,[Math]::Min(120,$mCreated.Body.Length)))"
    }
}

# ══════════════════════════════════════════════════════════════
# 5) BACKUP
# ══════════════════════════════════════════════════════════════
function Run-Backup {
    Section "5) Backup - create + verify"
    if (-not (Test-Up)) { return }

    $before = Get-Json '/api/v1/backup/list'
    if ($before.Code -ne 200) { Fail "GET /backup/list - HTTP $($before.Code)"; return }
    $beforeList = $before.Body | ConvertFrom-Json
    $beforeCount = if ($beforeList -is [array]) { $beforeList.Count } else { ($beforeList.backups).Count }

    $r = Get-Json '/api/v1/backup/now' 'POST'
    if ($r.Code -in 200,201) {
        $obj = $r.Body | ConvertFrom-Json
        Pass "POST /backup/now (label='$($obj.label)' file='$($obj.filename)')"
    } else {
        Fail "POST /backup/now - HTTP $($r.Code) - $($r.Body.Substring(0,[Math]::Min(120,$r.Body.Length)))"
        return
    }

    Start-Sleep -Seconds 1
    $after = Get-Json '/api/v1/backup/list'
    if ($after.Code -eq 200) {
        $afterList = $after.Body | ConvertFrom-Json
        $afterCount = if ($afterList -is [array]) { $afterList.Count } else { ($afterList.backups).Count }
        if ($afterCount -gt $beforeCount) { Pass "Backup count increased ($beforeCount -> $afterCount)" }
        else                              { Fail "Backup count unchanged ($beforeCount -> $afterCount)" }
    }

    try {
        $sizeOut = docker exec $Container bash -lc 'ls -la /app/backups/*.db 2>/dev/null | tail -1' 2>&1
        if ($sizeOut -match '\s(\d+)\s+\w+\s+\d+\s+\d+:\d+\s+(\S+)') {
            $size = [int]$Matches[1]
            $file = $Matches[2]
            if ($size -gt 1024) { Pass "Latest backup ($file) is $([math]::Round($size/1024,1)) KB" }
            else                { Fail "Latest backup ($file) is only $size bytes - empty?" }
        } else {
            Warn "Could not parse backup file size"
        }
    } catch {
        Warn "docker exec for size check failed: $($_.Exception.Message)"
    }
}

# ══════════════════════════════════════════════════════════════
# Menu / dispatch
# ══════════════════════════════════════════════════════════════
function Show-Menu {
    Clear-Host
    Write-Host ""
    Write-Host "===========================================================" -ForegroundColor Cyan
    Write-Host "  Ghrava Test Runner  (suite v$SuiteVersion, $SuiteDate)"     -ForegroundColor Cyan
    Write-Host "  Target: $BaseUrl"                                           -ForegroundColor Gray
    Write-Host "===========================================================" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "  1) Smoke test       - HTTP routes + page loads"
    Write-Host "  2) Schema check     - pending migrations vs live DB"
    Write-Host "  3) Frontend         - page loads + broken references"
    Write-Host "  4) Deep CRUD        - inventory + medical round-trip"
    Write-Host "  5) Backup           - create + verify file"
    Write-Host ""
    Write-Host "  9) ALL of the above"                                          -ForegroundColor Yellow
    Write-Host "  0) Exit"                                                       -ForegroundColor Gray
    Write-Host ""
    Write-Host "  Every run writes a report to ~/Downloads"                    -ForegroundColor DarkGray
    Write-Host ""
}

function Run-Choice {
    param([string]$C)

    [void]$script:CapturedOutput.Clear()
    $script:TotalPass = 0; $script:TotalFail = 0; $script:TotalWarn = 0

    $appVersion = Get-AppVersion
    $startTime  = Get-Date

    $label = switch ($C) {
        '1' { 'smoke' }
        '2' { 'schema' }
        '3' { 'frontend' }
        '4' { 'deepcrud' }
        '5' { 'backup' }
        '9' { 'all' }
        default { 'unknown' }
    }
    $tests = switch ($C) {
        '1' { '1 (Smoke)' }
        '2' { '2 (Schema)' }
        '3' { '3 (Frontend)' }
        '4' { '4 (Deep CRUD)' }
        '5' { '5 (Backup)' }
        '9' { '1, 2, 3, 4, 5 (all)' }
        default { 'unknown' }
    }
    $description = $TestDescriptions[$C]
    if (-not $description) { $description = '(no description)' }

    # Header — written into every report
    [void]$script:CapturedOutput.AppendLine("Ghrava Test Report")
    [void]$script:CapturedOutput.AppendLine(("=" * 60))
    [void]$script:CapturedOutput.AppendLine("Run started   : $($startTime.ToString('yyyy-MM-dd HH:mm:ss'))")
    [void]$script:CapturedOutput.AppendLine("Target        : $BaseUrl")
    [void]$script:CapturedOutput.AppendLine("App version   : $appVersion")
    [void]$script:CapturedOutput.AppendLine("Suite version : $SuiteVersion ($SuiteDate)")
    [void]$script:CapturedOutput.AppendLine("Tests run     : $tests")
    [void]$script:CapturedOutput.AppendLine("What it does  : $description")
    [void]$script:CapturedOutput.AppendLine(("=" * 60))
    [void]$script:CapturedOutput.AppendLine("")

    switch ($C) {
        '1' { Run-Smoke }
        '2' { Run-Schema }
        '3' { Run-Frontend }
        '4' { Run-DeepCRUD }
        '5' { Run-Backup }
        '9' {
            Run-Smoke
            Run-Schema
            Run-Frontend
            Run-DeepCRUD
            Run-Backup
        }
        '0' { return $false }
        default { Write-Host "Invalid choice." -ForegroundColor Red; return $true }
    }

    $endTime  = Get-Date
    $duration = [math]::Round(($endTime - $startTime).TotalSeconds, 1)

    $summary = @"

============================================================
 SUMMARY
============================================================
  PASS     : $script:TotalPass
  FAIL     : $script:TotalFail
  WARN     : $script:TotalWarn
  TOTAL    : $($script:TotalPass + $script:TotalFail + $script:TotalWarn)
  Duration : ${duration}s
  Run end  : $($endTime.ToString('yyyy-MM-dd HH:mm:ss'))
============================================================
"@
    $color = if ($script:TotalFail -gt 0) { 'Red' } else { 'Green' }
    Write-Host $summary -ForegroundColor $color
    [void]$script:CapturedOutput.AppendLine($summary)

    # Always write a report
    $stamp = Get-Date -Format 'yyyyMMdd_HHmm'
    $reportFile = Join-Path ([Environment]::GetFolderPath('UserProfile')) "Downloads\Ghrava_TestReport_${label}_$stamp.txt"
    $script:CapturedOutput.ToString() | Out-File -FilePath $reportFile -Encoding UTF8
    Write-Host ""
    Write-Host "Report saved: $reportFile" -ForegroundColor Cyan

    return $true
}

# ── Main ──────────────────────────────────────────────────────
if ($Choice -ne '') {
    [void](Run-Choice $Choice)
    if ($script:TotalFail -gt 0) { exit 1 } else { exit 0 }
}

while ($true) {
    Show-Menu
    $c = Read-Host "Choose"
    if ($c -eq '0') { break }
    [void](Run-Choice $c)
    Write-Host ""
    Read-Host "Press Enter to return to menu"
}
