# tests/run-tests.ps1
# Ghrava Nightly E2E Test Runner
#
# Runs Playwright tests against the live Ghrava instance,
# saves an HTML report to Z:\backups\ghrava\test-reports\,
# and POSTs the structured results to Ghrava so they appear
# in Reports → Testing.
#
# Usage:
#   .\tests\run-tests.ps1                          # default URL and report dir
#   .\tests\run-tests.ps1 -GhUrl http://192.168.4.62:3001
#   .\tests\run-tests.ps1 -ReportDir "D:\MyReports"
#
# First run setup (once):
#   cd <ghrava-root>\tests
#   npm init -y
#   npm install @playwright/test
#   npx playwright install chromium
#
# Task Scheduler nightly:
#   Program: powershell.exe
#   Arguments: -NonInteractive -File "Z:\ghrava\tests\run-tests.ps1"
#   Start in: Z:\ghrava

param(
    [string]$GhUrl     = "http://192.168.4.62:3001",
    [string]$ReportDir = "Z:\ghrava\test-results",
    [string]$AuthToken = ""
)

$ErrorActionPreference = "Continue"
$StartTime = Get-Date

Write-Host ""
Write-Host "══════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "  Ghrava E2E Test Runner" -ForegroundColor Cyan
Write-Host "  Target: $GhUrl" -ForegroundColor Cyan
Write-Host "  Started: $($StartTime.ToString('yyyy-MM-dd HH:mm:ss'))" -ForegroundColor Cyan
Write-Host "══════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""

# ── Resolve paths ─────────────────────────────────────────────
$ScriptDir   = Split-Path -Parent $MyInvocation.MyCommand.Path
$TestsDir    = $ScriptDir
$ResultsDir  = Join-Path $TestsDir "test-results"
$ReportHtmlDir = Join-Path $TestsDir "playwright-report"

# Ensure test-results/ exists before Playwright tries to write into it.
# On Windows/NAS mapped drives this can fail with EPERM if the path doesn't
# pre-exist - creating it here prevents Playwright from crashing on scandir.
if (-not (Test-Path $ResultsDir)) {
    try {
        New-Item -ItemType Directory -Path $ResultsDir -Force | Out-Null
        Write-Host "Created test-results/ directory" -ForegroundColor DarkGray
    } catch {
        Write-Host "Warning: could not create test-results/ - $_" -ForegroundColor Yellow
    }
}

# ── Check Playwright is installed ────────────────────────────
$PwPath = Join-Path $TestsDir "node_modules\.bin\playwright.cmd"
if (-not (Test-Path $PwPath)) {
    Write-Host "Playwright not installed. Run from $TestsDir :" -ForegroundColor Yellow
    Write-Host "  npm init -y" -ForegroundColor Yellow
    Write-Host "  npm install @playwright/test" -ForegroundColor Yellow
    Write-Host "  npx playwright install chromium" -ForegroundColor Yellow
    exit 1
}

# ── Check Ghrava is up ────────────────────────────────────────
Write-Host "Checking Ghrava is reachable..." -NoNewline
try {
    $health = Invoke-RestMethod -Uri "$GhUrl/health" -TimeoutSec 10
    Write-Host " OK (v$($health.version))" -ForegroundColor Green
} catch {
    Write-Host " FAILED - $GhUrl is not reachable" -ForegroundColor Red
    Write-Host "Is the container running? Run: docker start ghrava" -ForegroundColor Yellow
    exit 1
}

# ── Run Playwright ────────────────────────────────────────────
Write-Host ""
Write-Host "Running tests..." -ForegroundColor Cyan
$env:GHRAVA_URL = $GhUrl
if ($AuthToken) {
    $env:GHRAVA_TOKEN = $AuthToken
    Write-Host "  Auth token provided - CRUD tests will run" -ForegroundColor Green
} else {
    Remove-Item Env:\GHRAVA_TOKEN -ErrorAction SilentlyContinue
    Write-Host "  No auth token - CRUD tests will fail with 401 (expected)" -ForegroundColor DarkYellow
}
$env:PW_TEST_HTML_REPORT_OPEN = 'never'
$env:PLAYWRIGHT_HTML_OPEN     = 'never'

# Use the call operator (&) — simple, streams output live, returns when
# Playwright exits. We tried .NET Process API for a hard timeout but the
# event-handler complexity wasn't worth it; this pipeline returns reliably
# now that the duplication bug is fixed (testDir: __dirname).
#
# IMPORTANT: cd into tests/ before invoking Playwright. Without this,
# Playwright scans from the parent CWD and runs every test TWICE.
# ALSO IMPORTANT: do NOT pass --reporter on the CLI — it overrides the
# config's reporter array, which is the only place 'open: never' lives.
Push-Location $TestsDir
try {
    & $PwPath test --config="$TestsDir\playwright.config.js" 2>&1
} finally {
    Pop-Location
}
$ExitCode = $LASTEXITCODE

# Kill any orphan playwright/chromium children that may still be holding
# file handles after the parent exits. Defensive — usually a no-op.
Get-Process -Name 'chrome', 'chromium', 'playwright', 'headless_shell' -ErrorAction SilentlyContinue |
    Where-Object { $_.Path -and $_.Path -like "*ms-playwright*" } |
    Stop-Process -Force -ErrorAction SilentlyContinue

$EndTime    = Get-Date
$DurationMs = [int]($EndTime - $StartTime).TotalMilliseconds

# ── Parse JSON results ────────────────────────────────────────
$ResultsJson = Join-Path $ResultsDir "results.json"
$RunData     = $null

if (Test-Path $ResultsJson) {
    try {
        $pw = Get-Content $ResultsJson -Raw | ConvertFrom-Json

        # Playwright's results.json nests suites recursively:
        #   suites[].suites[].specs[].tests[].results[]
        # The previous flat parse missed everything because top-level suites
        # only have child suites, not specs. Walk recursively to flatten.
        $allTests = New-Object System.Collections.ArrayList
        $allSuiteNames = New-Object System.Collections.ArrayList

        function Walk-Suite {
            param($node, $parentName)
            $here = if ($node.title) { $node.title } else { $parentName }
            if ($node.specs) {
                foreach ($spec in $node.specs) {
                    foreach ($t in $spec.tests) {
                        $result = $t.results | Select-Object -First 1
                        $errMsg = $null
                        if ($result -and $result.error) {
                            $errMsg = $result.error.message
                            if (-not $errMsg) { $errMsg = $result.error.value }
                        }
                        $script:flatTest = @{
                            title       = $spec.title
                            suite       = $here
                            status      = if ($t.status -eq "expected") { "passed" } else { $t.status }
                            duration_ms = if ($result) { [int]$result.duration } else { 0 }
                            error       = $errMsg
                        }
                        [void]$script:allTests.Add($script:flatTest)
                    }
                }
            }
            if ($node.suites) {
                foreach ($child in $node.suites) {
                    Walk-Suite -node $child -parentName $here
                }
            }
        }

        foreach ($topSuite in $pw.suites) {
            Walk-Suite -node $topSuite -parentName $topSuite.title
            [void]$allSuiteNames.Add($topSuite.title)
        }

        # Group flat tests back into suites for the API payload
        $suiteMap = @{}
        foreach ($t in $allTests) {
            $sname = $t.suite
            if (-not $suiteMap.ContainsKey($sname)) { $suiteMap[$sname] = @() }
            $suiteMap[$sname] += @{
                title       = $t.title
                status      = $t.status
                duration_ms = $t.duration_ms
                error       = $t.error
            }
        }
        $suites = @()
        foreach ($sname in $suiteMap.Keys) {
            $suites += @{ name = $sname; tests = $suiteMap[$sname] }
        }

        $passed = @($allTests | Where-Object { $_.status -eq "passed" }).Count
        $failed = @($allTests | Where-Object { $_.status -ne "passed" }).Count
        $total  = $passed + $failed

        $RunData = @{
            started_at  = $StartTime.ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ssZ")
            duration_ms = $DurationMs
            passed      = $passed
            failed      = $failed
            total       = $total
            ghrava_url  = $GhUrl
            suites      = $suites
        }

        Write-Host ""
        Write-Host "Results: $passed passed, $failed failed ($total total)" -ForegroundColor $(if ($failed -eq 0) { "Green" } else { "Red" })
    } catch {
        Write-Host "Warning: could not parse results.json - $_" -ForegroundColor Yellow
    }
}

# ── Copy HTML report to NAS backup dir ───────────────────────
if (Test-Path $ReportDir -PathType Container) {
    $HtmlReport  = Join-Path $ReportHtmlDir "index.html"
    $ReportStamp = $StartTime.ToString("yyyy-MM-dd_HHmm")
    $DestFile    = Join-Path $ReportDir "ghrava_e2e_$ReportStamp.html"

    if (Test-Path $HtmlReport) {
        # Copy HTML report (single file - playwright html reporter generates multi-file,
        # so we grab the index and note the asset path)
        Copy-Item $HtmlReport $DestFile -ErrorAction SilentlyContinue
        Write-Host "Report saved: $DestFile" -ForegroundColor Cyan

        # Prune old reports - keep last 30
        $OldReports = Get-ChildItem $ReportDir -Filter "ghrava_e2e_*.html" |
            Sort-Object LastWriteTime | Select-Object -SkipLast 30
        foreach ($old in $OldReports) { Remove-Item $old.FullName -Force }
    }
} else {
    Write-Host "Note: Report dir not found: $ReportDir" -ForegroundColor Yellow
    Write-Host "      Create it or update -ReportDir parameter" -ForegroundColor Yellow
}

# ── POST results to Ghrava ────────────────────────────────────
if ($RunData) {
    try {
        $body = $RunData | ConvertTo-Json -Depth 10 -Compress
        $posted = Invoke-RestMethod -Uri "$GhUrl/api/v1/app/test-results" `
            -Method POST -Body $body -ContentType "application/json" -TimeoutSec 10
        Write-Host "Results posted to Ghrava: $($posted.filename)" -ForegroundColor Green
    } catch {
        Write-Host "Warning: could not post results to Ghrava - $_" -ForegroundColor Yellow
        Write-Host "         Results are still in $ResultsJson" -ForegroundColor Yellow
    }
}

# ── Summary ───────────────────────────────────────────────────
Write-Host ""
Write-Host "══════════════════════════════════════════════" -ForegroundColor Cyan
if ($ExitCode -eq 0) {
    Write-Host "  ALL TESTS PASSED" -ForegroundColor Green
} else {
    Write-Host "  TESTS FAILED - check Reports → Testing in Ghrava" -ForegroundColor Red
}
Write-Host "  Duration: $([math]::Round($DurationMs/1000,1))s" -ForegroundColor Cyan
Write-Host "══════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""

# ── Clean up test-results folder so deploy script doesn't hit EPERM ──
# Results are already saved to $ReportDir and posted to Ghrava above.
# The local test-results/ folder is a temp artifact - safe to remove.
$LocalResults = Join-Path $TestsDir "test-results"
if (Test-Path $LocalResults) {
    try {
        Remove-Item $LocalResults -Recurse -Force -ErrorAction SilentlyContinue
        Write-Host "Cleaned up local test-results folder" -ForegroundColor DarkGray
    } catch {
        Write-Host "Note: could not remove test-results/ - $_ (safe to ignore)" -ForegroundColor DarkGray
    }
}

exit $ExitCode
