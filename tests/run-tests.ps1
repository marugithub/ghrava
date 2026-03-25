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
    [string]$ReportDir = "Z:\Backups\XPS - My Documents\AllDocuments\_SaveForever\MyAppBackups\test-reports"
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
    Write-Host " FAILED — $GhUrl is not reachable" -ForegroundColor Red
    Write-Host "Is the container running? Run: docker start ghrava" -ForegroundColor Yellow
    exit 1
}

# ── Run Playwright ────────────────────────────────────────────
Write-Host ""
Write-Host "Running tests..." -ForegroundColor Cyan
$env:GHRAVA_URL = $GhUrl

$PwArgs = @(
    "test",
    "--config=$TestsDir\playwright.config.js",
    "--reporter=list,json,html"
)

$PwProcess = Start-Process -FilePath $PwPath -ArgumentList $PwArgs `
    -WorkingDirectory $TestsDir -Wait -PassThru -NoNewWindow

$ExitCode  = $PwProcess.ExitCode
$EndTime   = Get-Date
$DurationMs = [int]($EndTime - $StartTime).TotalMilliseconds

# ── Parse JSON results ────────────────────────────────────────
$ResultsJson = Join-Path $ResultsDir "results.json"
$RunData     = $null

if (Test-Path $ResultsJson) {
    try {
        $pw = Get-Content $ResultsJson -Raw | ConvertFrom-Json

        # Build structured run data for Ghrava API
        $suites = @()
        foreach ($suite in $pw.suites) {
            $tests = @()
            foreach ($spec in $suite.specs) {
                foreach ($t in $spec.tests) {
                    $result = $t.results | Select-Object -First 1
                    $tests += @{
                        title       = $spec.title
                        status      = if ($t.status -eq "expected") { "passed" } else { $t.status }
                        duration_ms = if ($result) { $result.duration } else { 0 }
                        error       = if ($result -and $result.error) { $result.error.message } else { $null }
                    }
                }
            }
            $suites += @{
                name  = $suite.title
                tests = $tests
            }
        }

        $passed = ($suites | ForEach-Object { $_.tests } | Where-Object { $_.status -eq "passed" }).Count
        $failed = ($suites | ForEach-Object { $_.tests } | Where-Object { $_.status -ne "passed" }).Count
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
        Write-Host "Warning: could not parse results.json — $_" -ForegroundColor Yellow
    }
}

# ── Copy HTML report to NAS backup dir ───────────────────────
if (Test-Path $ReportDir -PathType Container) {
    $HtmlReport  = Join-Path $ResultsDir "html\index.html"
    $ReportStamp = $StartTime.ToString("yyyy-MM-dd_HHmm")
    $DestFile    = Join-Path $ReportDir "ghrava_e2e_$ReportStamp.html"

    if (Test-Path $HtmlReport) {
        # Copy HTML report (single file — playwright html reporter generates multi-file,
        # so we grab the index and note the asset path)
        Copy-Item $HtmlReport $DestFile -ErrorAction SilentlyContinue
        Write-Host "Report saved: $DestFile" -ForegroundColor Cyan

        # Prune old reports — keep last 30
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
        Write-Host "Warning: could not post results to Ghrava — $_" -ForegroundColor Yellow
        Write-Host "         Results are still in $ResultsJson" -ForegroundColor Yellow
    }
}

# ── Summary ───────────────────────────────────────────────────
Write-Host ""
Write-Host "══════════════════════════════════════════════" -ForegroundColor Cyan
if ($ExitCode -eq 0) {
    Write-Host "  ALL TESTS PASSED" -ForegroundColor Green
} else {
    Write-Host "  TESTS FAILED — check Reports → Testing in Ghrava" -ForegroundColor Red
}
Write-Host "  Duration: $([math]::Round($DurationMs/1000,1))s" -ForegroundColor Cyan
Write-Host "══════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""

exit $ExitCode
