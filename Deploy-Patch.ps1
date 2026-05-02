# Deploy-Patch.ps1 — Ghrava v202604.114
# Test infrastructure fixes:
#   1. Reports test updated to use .rep-row (was looking for removed .report-card)
#   2. POST /test-results endpoint now returns diagnostic body on 400/500
#   3. run-tests.ps1 auto-creates ReportDir + captures POST response body
#      on failure + saves payload locally for offline debugging
$ErrorActionPreference = 'Stop'
$NasPath   = 'Z:\ghrava'
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path

$PatchFiles = @(
    'app\server.js',
    'app\version.txt',
    'tests\ghrava-e2e.spec.js',
    'tests\run-tests.ps1'
)

Write-Host ''
Write-Host '  Ghrava Patch Deploy - v202604.114' -ForegroundColor Cyan
Write-Host '  -----------------------------------------' -ForegroundColor DarkGray
Write-Host "  Source : $ScriptDir" -ForegroundColor DarkGray
Write-Host "  Target : $NasPath"   -ForegroundColor DarkGray
Write-Host ''

if (-not (Test-Path $NasPath)) {
    Write-Host "  ERROR: $NasPath is not accessible. Is Z: mapped?" -ForegroundColor Red
    Read-Host 'Press Enter to exit'
    exit 1
}

$ok = 0; $fail = 0
foreach ($rel in $PatchFiles) {
    $src  = Join-Path $ScriptDir $rel
    $dest = Join-Path $NasPath   $rel
    if (-not (Test-Path $src)) {
        Write-Host "  MISSING  $rel" -ForegroundColor Yellow
        $fail++; continue
    }
    $destDir = Split-Path $dest -Parent
    if (-not (Test-Path $destDir)) { New-Item -ItemType Directory -Path $destDir -Force | Out-Null }
    Copy-Item -Path $src -Destination $dest -Force
    Write-Host "  OK  $rel" -ForegroundColor Green
    $ok++
}

Write-Host ''
Write-Host "  Copied $ok file(s)" -ForegroundColor Cyan
if ($fail -gt 0) { Write-Host "  $fail file(s) missing" -ForegroundColor Yellow }
Write-Host ''
Write-Host '  Restarting ghrava container...' -ForegroundColor Cyan
try {
    $result = docker restart ghrava 2>&1
    Write-Host "  Container restarted: $result" -ForegroundColor Green
} catch {
    Write-Host "  docker restart failed: $_" -ForegroundColor Red
}
Write-Host ''
Write-Host '  Done. Re-run the suite:' -ForegroundColor Green
Write-Host "    .\tests\run-tests.ps1 -AuthToken 'ravisoni'" -ForegroundColor White
Write-Host '  - Reports test should now pass (uses .rep-row)' -ForegroundColor White
Write-Host '  - POST failure (if any) will show server response body' -ForegroundColor White
Write-Host ''
Read-Host 'Press Enter to close'
