# Deploy-Patch.ps1 — Ghrava v202604.118
# Cards now offered as a third view alongside grid + list.
#
# Major change vs v117:
#   - Removed ?cards=v2 query param gate entirely (was rollout artifact)
#   - Extended GH_VIEW (lt-core.js) to render a third "Card" button when
#     the page passes views: ['grid','list','card'] in its init options
#   - Each wired page now branches on its existing view-state variable
#     (_subView/_bkView/_perfumeView/etc.) === 'card' to call GH_MOUNT
#   - List + grid views fall through to the existing legacy renderers
#   - Per-module persistence of view choice via localStorage (already how
#     GH_VIEW worked — no new storage)
#
# Pages with full 3-view toggle: subscriptions, books, perfume, insurance,
#   documents, wardrobe, property (properties + vehicles)
#
# Deferred (need toolbar UX placement work): finance, career
#
# Untouched: medical, todos — already use their own legacy ?cards=v2
# flag from earlier iterations, do NOT call GH_MOUNT, keep working as before
#
# All paths additive, no schema migrations.

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
    # GH_VIEW now renders a 3rd "card" button when views: ['grid','list','card']
    'app\public\js\lt-core.js',
    # CSS additions for v5 (cross-module strip, progress bar, asterisk, alert stack)
    'app\public\shared.css',
    # Body-icon SVGs for medical conditions + visit cards
    'app\public\assets\icons\phosphor\duotone\heart-duotone.svg',
    'app\public\assets\icons\phosphor\duotone\brain-duotone.svg',
    'app\public\assets\icons\phosphor\duotone\stethoscope-duotone.svg',
    'app\public\assets\icons\phosphor\duotone\calendar-duotone.svg',
    'app\public\assets\icons\phosphor\duotone\note-pencil-duotone.svg',
    # Pages wired with 3-view toggle
    'app\public\subscriptions.html',
    'app\public\books.html',
    'app\public\perfume.html',
    'app\public\insurance.html',
    'app\public\documents.html',
    'app\public\wardrobe.html',
    'app\public\property.html',
    # Pages with v2 references removed (deferred but cleaned up)
    'app\public\finance.html',
    'app\public\career.html',
    # Backend
    'app\features\finance\routes.js',
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
Write-Host '  Ghrava Patch Deploy - v202604.118' -ForegroundColor Cyan
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
Write-Host '  v118 deployed.' -ForegroundColor Green
Write-Host '  Cards now a 3rd view in the toolbar (grid / list / card).' -ForegroundColor White
Write-Host '  No query param needed. Toggle persists per module.' -ForegroundColor White
Write-Host ''
Write-Host '  Wired pages (try the 3rd toolbar button):' -ForegroundColor Cyan
Write-Host '    /subscriptions.html  /books.html  /perfume.html'  -ForegroundColor White
Write-Host '    /insurance.html  /documents.html  /wardrobe.html  /property.html' -ForegroundColor White
Write-Host ''
Read-Host 'Press Enter to close'
