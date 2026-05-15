# _v166_cleanup.ps1  —  one-shot cleanup of v.165→v.166 orphans
#
# The deploy script uses `robocopy /E` which COPIES new files but does NOT
# remove files that no longer exist in source. v.166 deletes the old
# `_drafts.html` redirect shim and the `_drafts/` directory (their content
# moved to `_templates/`). Run this AFTER ghrava_deploy.ps1 and BEFORE
# `docker restart ghrava` to remove the orphans on the NAS.
#
# Usage (PowerShell, run from the script directory after extracting zip):
#   .\_v166_cleanup.ps1
#
# Idempotent — safe to run multiple times.

$ErrorActionPreference = "Continue"

function Write-OK($msg)   { Write-Host "  v $msg" -ForegroundColor Green }
function Write-Info($msg) { Write-Host "  . $msg" -ForegroundColor Gray }
function Write-Warn($msg) { Write-Host "  ! $msg" -ForegroundColor Yellow }

$NasRoot = "Z:\ghrava"

Write-Host "`n  v.166 orphan cleanup`n" -ForegroundColor Blue

if (-not (Test-Path $NasRoot)) {
    Write-Warn "Z:\ghrava not reachable. Map the share and re-run."
    exit 1
}

# 1) Old redirect shim
$old_html = Join-Path $NasRoot "app\public\_drafts.html"
if (Test-Path $old_html) {
    Remove-Item -Path $old_html -Force
    Write-OK "Deleted _drafts.html"
} else {
    Write-Info "_drafts.html already gone"
}

# 2) Old subpages directory
$old_dir = Join-Path $NasRoot "app\public\_drafts"
if (Test-Path $old_dir) {
    Remove-Item -Path $old_dir -Recurse -Force
    Write-OK "Deleted _drafts\ directory and contents"
} else {
    Write-Info "_drafts\ already gone"
}

# 3) Old archived backlog (optional — keep for reference if you want)
#    Uncomment to also remove:
# $old_backlog = Join-Path $NasRoot "BACKLOG_OLD_apr2026.md"
# if (Test-Path $old_backlog) { Remove-Item $old_backlog -Force; Write-OK "Deleted old backlog" }

Write-Host ""
Write-Host "  Cleanup done. Now: ssh NAS and run 'docker restart ghrava'." -ForegroundColor Green
Write-Host ""
