# Deploy-Patch.ps1 — Ghrava v202604.113
# Card v5 rollout: shared renderer extensions, shared helpers module,
# configs for vehicles/subs/finance/HSA/maintenance/books/trade.
# 10 new Playwright tests added to the existing nightly E2E suite.
# Module pages remain unchanged - cards still gated behind ?cards=v2.
# Run: right-click -> Run with PowerShell

$ErrorActionPreference = 'Stop'
$NasPath   = 'Z:\ghrava'
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path

$PatchFiles = @(
    'app\public\shared.css',
    'app\public\js\gh-card.js',
    'app\public\js\gh-card-shared.js',
    'app\public\js\gh-card-configs-batch1.js',
    'app\version.txt',
    'CARDS_FINAL.md',
    'TRANSACTION_LINKING_SPEC.md',
    'tests\ghrava-e2e.spec.js'
)

Write-Host ''
Write-Host '  Ghrava Patch Deploy - v202604.113' -ForegroundColor Cyan
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
Write-Host '  Done. Run the existing E2E suite to verify card tests:' -ForegroundColor Green
Write-Host '    .\tests\run-tests.ps1' -ForegroundColor White
Write-Host '  (10 new Card Renderer tests included in the nightly suite.)' -ForegroundColor White
Write-Host ''
Read-Host 'Press Enter to close'
