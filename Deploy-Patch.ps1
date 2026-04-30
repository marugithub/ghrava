# Deploy-Patch.ps1 — Ghrava v202604.107
# Copies only the changed files from this patch to Z:\ghrava, then restarts the container.
# Usage: Right-click → "Run with PowerShell"  (or: .\Deploy-Patch.ps1)

$ErrorActionPreference = 'Stop'

$NasPath   = 'Z:\ghrava'
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path

# ── Files in this patch (v202604.107) ─────────────────────────
# 1. Card grid fix on todos v2 (multi-column instead of full-width)
# 2. Mobile-responsive drawers (full-screen iPhone-style on phone)
# 3. Cards v2 propagation to medical (gated behind ?cards=v2)
$PatchFiles = @(
    'app\public\shared.css',
    'app\public\todos.html',
    'app\public\medical.html',
    'app\public\js\gh-card-config-medical.js',
    'app\version.txt'
)

Write-Host ''
Write-Host '  Ghrava Patch Deploy - v202604.107' -ForegroundColor Cyan
Write-Host '  -----------------------------------------' -ForegroundColor DarkGray
Write-Host "  Source : $ScriptDir" -ForegroundColor DarkGray
Write-Host "  Target : $NasPath"   -ForegroundColor DarkGray
Write-Host ''

# ── Verify NAS is accessible ──────────────────────────────────
if (-not (Test-Path $NasPath)) {
    Write-Host "  ERROR: $NasPath is not accessible. Is Z: mapped?" -ForegroundColor Red
    Read-Host 'Press Enter to exit'
    exit 1
}

# ── Copy files ────────────────────────────────────────────────
$ok = 0; $fail = 0
foreach ($rel in $PatchFiles) {
    $src  = Join-Path $ScriptDir $rel
    $dest = Join-Path $NasPath   $rel

    if (-not (Test-Path $src)) {
        Write-Host "  MISSING  $rel" -ForegroundColor Yellow
        $fail++
        continue
    }

    $destDir = Split-Path $dest -Parent
    if (-not (Test-Path $destDir)) { New-Item -ItemType Directory -Path $destDir -Force | Out-Null }

    Copy-Item -Path $src -Destination $dest -Force
    Write-Host "  OK  $rel" -ForegroundColor Green
    $ok++
}

Write-Host ''
Write-Host "  Copied $ok file(s)" -ForegroundColor Cyan
if ($fail -gt 0) { Write-Host "  $fail file(s) missing - check zip contents" -ForegroundColor Yellow }
Write-Host ''

# ── Restart container ─────────────────────────────────────────
Write-Host '  Restarting ghrava container...' -ForegroundColor Cyan
try {
    $result = docker restart ghrava 2>&1
    Write-Host "  Container restarted: $result" -ForegroundColor Green
} catch {
    Write-Host "  docker restart failed: $_" -ForegroundColor Red
    Write-Host "  Restart manually: docker restart ghrava" -ForegroundColor Yellow
}

Write-Host ''
Write-Host '  Done. Test URLs:' -ForegroundColor Green
Write-Host '    http://192.168.4.62:3001/todos.html?cards=v2'   -ForegroundColor White
Write-Host '    http://192.168.4.62:3001/medical.html?cards=v2' -ForegroundColor White
Write-Host ''
Read-Host 'Press Enter to close'
