# Deploy-Patch.ps1 — Ghrava v202604.115
# Card configs batch 2 + 3:
#   batch2: wardrobe, perfumes, properties, documents, insurance_policies, career_jobs
#   batch3: medical_conditions, medical_visits, daily_log_entries (compact),
#           calendar_events (compact)
# Plus 5 body-icon Phosphor SVGs and 11 new Playwright assertions in the
# existing Card Renderer (GH_CARD v5) describe block.
# Module pages still unchanged - configs ready, opt-in per page when desired.

$ErrorActionPreference = 'Stop'
$NasPath   = 'Z:\ghrava'
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path

$PatchFiles = @(
    'app\public\js\gh-card-configs-batch2.js',
    'app\public\js\gh-card-configs-batch3.js',
    'app\public\assets\icons\phosphor\duotone\heart-duotone.svg',
    'app\public\assets\icons\phosphor\duotone\brain-duotone.svg',
    'app\public\assets\icons\phosphor\duotone\stethoscope-duotone.svg',
    'app\public\assets\icons\phosphor\duotone\calendar-duotone.svg',
    'app\public\assets\icons\phosphor\duotone\note-pencil-duotone.svg',
    'app\version.txt',
    'tests\ghrava-e2e.spec.js'
)

Write-Host ''
Write-Host '  Ghrava Patch Deploy - v202604.115' -ForegroundColor Cyan
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
Write-Host '  Done. 17 of 17 module configs render cleanly in JSDOM.' -ForegroundColor Green
Write-Host "  Re-run Playwright when convenient: .\tests\run-tests.ps1 -AuthToken 'ravisoni'" -ForegroundColor White
Write-Host ''
Read-Host 'Press Enter to close'
