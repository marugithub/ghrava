# Deploy-Patch.ps1 — Ghrava v202604.117
# Cumulative since v112: card v5 system end-to-end.
#
# Includes:
#   - Shared renderer + helpers + brands lookup + mount helper
#   - 17 module configs (batch1, batch2, batch3)
#   - 9 module pages wired to opt-in via ?cards=v2
#   - 5 body-icon Phosphor SVGs
#   - Finance route improvement: linked_subs_count + balance_change_30d
#   - Reports test fix (uses .rep-row, not removed .report-card)
#   - Test runner: auto-creates ReportDir, captures POST diagnostics
#   - Server: POST /test-results returns diagnostic body on validation fail
#   - 25+ Playwright tests added to existing E2E suite
#   - 3 spec docs (CARDS_FINAL.md, TRANSACTION_LINKING_SPEC.md, CARD_FIELD_GAPS.md)
#
# All paths gated behind ?cards=v2 — legacy render is the default until each
# page is flipped. Backend changes are additive (no schema migrations).

$ErrorActionPreference = 'Stop'
$NasPath   = 'Z:\ghrava'
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path

$PatchFiles = @(
    # Renderer + shared infra
    'app\public\js\gh-card.js',
    'app\public\js\gh-card-shared.js',
    'app\public\js\gh-card-brands.js',
    'app\public\js\gh-card-mount.js',
    # Module configs
    'app\public\js\gh-card-configs-batch1.js',
    'app\public\js\gh-card-configs-batch2.js',
    'app\public\js\gh-card-configs-batch3.js',
    # CSS additions for v5 (cross-module strip, progress bar, asterisk, alert stack)
    'app\public\shared.css',
    # Body-icon SVGs for medical conditions + visit cards
    'app\public\assets\icons\phosphor\duotone\heart-duotone.svg',
    'app\public\assets\icons\phosphor\duotone\brain-duotone.svg',
    'app\public\assets\icons\phosphor\duotone\stethoscope-duotone.svg',
    'app\public\assets\icons\phosphor\duotone\calendar-duotone.svg',
    'app\public\assets\icons\phosphor\duotone\note-pencil-duotone.svg',
    # 9 module pages wired with ?cards=v2 short-circuit
    'app\public\subscriptions.html',
    'app\public\finance.html',
    'app\public\books.html',
    'app\public\perfume.html',
    'app\public\insurance.html',
    'app\public\documents.html',
    'app\public\wardrobe.html',
    'app\public\property.html',
    'app\public\career.html',
    # Backend: finance route now returns linked_subs_count + balance_change_30d
    'app\features\finance\routes.js',
    # Backend: test-results POST returns diagnostics on 400 (helps debug runner issues)
    'app\server.js',
    # Test infra
    'tests\ghrava-e2e.spec.js',
    'tests\run-tests.ps1',
    # Specs
    'CARDS_FINAL.md',
    'TRANSACTION_LINKING_SPEC.md',
    'CARD_FIELD_GAPS.md',
    # Version
    'app\version.txt'
)

Write-Host ''
Write-Host '  Ghrava Patch Deploy - v202604.117' -ForegroundColor Cyan
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
Write-Host '  v117 deployed. Cards still gated behind ?cards=v2.' -ForegroundColor Green
Write-Host '  Test by visiting any wired page with that param, e.g.' -ForegroundColor White
Write-Host '    http://192.168.4.62:3001/subscriptions.html?cards=v2' -ForegroundColor White
Write-Host '    http://192.168.4.62:3001/finance.html?cards=v2' -ForegroundColor White
Write-Host '  Legacy render is default at /subscriptions.html (no param).' -ForegroundColor White
Write-Host ''
Read-Host 'Press Enter to close'
