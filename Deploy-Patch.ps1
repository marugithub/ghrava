# Deploy-Patch.ps1 — Ghrava v202604.123
# Iteration since v122 baseline.
#
# CONFIG NAMING CLEANUP
#   - Renamed batch3 medical configs to medical_conditions_rich /
#     medical_visits_rich to avoid registration clash with the existing
#     compact-mode configs in gh-card-config-medical.js. Both coexist now,
#     for different use cases (compact for medical.html dense lists, rich
#     for future cross-module dashboards).
#
# SUBSCRIPTIONS — RENEWAL-DUE ALERT
#   - Cards now fire a "Charges in N days" alert when next_charge_at is
#     within 3 days. Lets users cancel before next billing.
#   - "Charges today" / "Charges tomorrow" / "Charges in 3 days" with
#     red urgency on day-0 and day-1.
#   - Existing "price increased" alert still takes priority when both apply.
#
# SUBSCRIPTIONS — BETTER BRAND INITIALS
#   - linkedEntities now uses GH_CARD_SHARED.brandInitialsFor for cleaner
#     fallbacks (NF/SP for Netflix/Spotify) instead of raw .slice(0,2).
#
# TESTS
#   - Added renewal-tomorrow alert test
#   - Added localStorage persistence test (view choice survives reload)
#   - Fixed flaky healthy-subscription test (was hardcoded date)
#
# All sandbox checks green: 17/17 configs, 8/8 mount, 17/17 brands,
# 10/10 resilience.

$ErrorActionPreference = 'Stop'
$NasPath   = 'Z:\ghrava'
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path

$PatchFiles = @(
    'app\public\js\gh-card.js',
    'app\public\js\gh-card-shared.js',
    'app\public\js\gh-card-brands.js',
    'app\public\js\gh-card-mount.js',
    'app\public\js\gh-card-configs-batch1.js',
    'app\public\js\gh-card-configs-batch2.js',
    'app\public\js\gh-card-configs-batch3.js',
    'app\public\js\lt-core.js',
    'app\public\shared.css',
    'app\public\assets\icons\phosphor\duotone\heart-duotone.svg',
    'app\public\assets\icons\phosphor\duotone\brain-duotone.svg',
    'app\public\assets\icons\phosphor\duotone\stethoscope-duotone.svg',
    'app\public\assets\icons\phosphor\duotone\calendar-duotone.svg',
    'app\public\assets\icons\phosphor\duotone\note-pencil-duotone.svg',
    'app\public\subscriptions.html',
    'app\public\books.html',
    'app\public\perfume.html',
    'app\public\insurance.html',
    'app\public\documents.html',
    'app\public\wardrobe.html',
    'app\public\property.html',
    'app\public\finance.html',
    'app\public\career.html',
    'app\features\finance\routes.js',
    'app\features\medical\routes.js',
    'app\features\perfume\routes.js',
    'app\features\documents\routes.js',
    'app\features\property\routes.js',
    'app\server.js',
    'tests\ghrava-e2e.spec.js',
    'tests\run-tests.ps1',
    'CARDS_FINAL.md',
    'TRANSACTION_LINKING_SPEC.md',
    'CARD_FIELD_GAPS.md',
    'SCHEMA_CLEANUP_TODO.md',
    'app\version.txt'
)

Write-Host ''
Write-Host '  Ghrava Patch Deploy - v202604.123' -ForegroundColor Cyan
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
Write-Host '  v123 deployed.' -ForegroundColor Green
Write-Host ''
Write-Host '  New: subscriptions card fires renewal alert when' -ForegroundColor White
Write-Host '       charge is within 3 days. Lets you cancel before billing.' -ForegroundColor White
Write-Host ''
Read-Host 'Press Enter to close'
