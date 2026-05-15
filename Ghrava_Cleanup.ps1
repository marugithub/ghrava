# Ghrava_Cleanup.ps1
# Move stale files and folders to Z:\ghrava\delete_later\<timestamp>\
# preserving original structure. Dry-run by default.
#
# Usage:
#   .\Ghrava_Cleanup.ps1            # dry-run, shows what would move
#   .\Ghrava_Cleanup.ps1 -Execute   # actually move
#
# Nothing is deleted. Everything goes into delete_later\ so you can review
# and drag back if needed.

param(
    [switch]$Execute,
    [string]$NasRoot = 'Z:\ghrava'
)

$ErrorActionPreference = 'Stop'

if (-not (Test-Path $NasRoot)) {
    Write-Host "  NAS path not accessible: $NasRoot" -ForegroundColor Red
    exit 1
}

$timestamp = Get-Date -Format 'yyyy-MM-ddTHH-mm'
$trashDir  = Join-Path $NasRoot "delete_later\$timestamp"
$mode      = if ($Execute) { 'EXECUTE' } else { 'DRY-RUN' }

Write-Host ""
Write-Host "  GHRAVA CLEANUP  ($mode)" -ForegroundColor Blue
Write-Host "  Source : $NasRoot"
Write-Host "  Trash  : $trashDir"
Write-Host ""

# What to move. Each entry: relative path + reason.
$moves = @(
    @{ path='_deploy_staging';            reason='Leftover staging dir from old deploy; canonical files now in app/' },
    @{ path='BACKLOG_OLD_apr2026.md';     reason='Old backlog (April 2026), superseded by BACKLOG.md' },
    @{ path='HANDOFF_NEXT.md';            reason='Apr 17 handoff, superseded by HANDOFF.md (v.170)' },
    @{ path='CARDS_FINAL.md';             reason='Card design now in _templates.html + LOCKED.md' },
    @{ path='CARD_FIELD_GAPS.md';         reason='Audit complete; gaps tracked in BACKLOG.md going forward' },
    @{ path='MODULES_DESIGN.md';          reason='April pre-build design doc; modules now built and documented in code' },
    @{ path='RULES_AUDIT.md';             reason='April audit; gates.sh now enforces rules mechanically' },
    @{ path='SCHEMA_CLEANUP_TODO.md';     reason='Schema now validated by gates' },
    @{ path='TOUCHED.md';                 reason='v.150 era working file; not used post-gates' },
    @{ path='WIRING.md';                  reason='v.115 era doc; superseded by code structure' },
    @{ path='VALIDATION.md';              reason='Pre-gates validator doc; useful sections merged into app/scripts/README.md' },
    @{ path='Deploy-Patch.ps1';           reason='v.122 era deploy script; superseded by ghrava_deploy.ps1' },
    @{ path='_v166_cleanup.ps1';          reason='One-shot v.166 cleanup script; no longer relevant' },
    @{ path='scripts\validate-schema.py'; reason='Duplicate of app\.claude\skills\ghrava-schema-safety\scripts\validate-schema.py' }
)

# Print plan
Write-Host "  Items to move:" -ForegroundColor Cyan
Write-Host ""
$total = 0
$missing = 0
foreach ($m in $moves) {
    $src = Join-Path $NasRoot $m.path
    if (Test-Path $src) {
        $kind = if ((Get-Item $src).PSIsContainer) { 'dir ' } else { 'file' }
        Write-Host ("    [{0}] {1,-40}  {2}" -f $kind, $m.path, $m.reason) -ForegroundColor White
        $total++
    } else {
        Write-Host ("    [---] {0,-40}  (not present)" -f $m.path) -ForegroundColor DarkGray
        $missing++
    }
}

# Detect empty scripts\ dir
$scriptsDir = Join-Path $NasRoot 'scripts'
$scriptsDirEmpty = $false
if (Test-Path $scriptsDir) {
    $contents = Get-ChildItem $scriptsDir -Force
    if ($contents.Count -le 1) { $scriptsDirEmpty = $true }
}
if ($scriptsDirEmpty) {
    Write-Host ""
    Write-Host "  Empty scripts\ dir will also be removed after move." -ForegroundColor Gray
}

Write-Host ""
Write-Host "  Plan: $total to move, $missing already absent" -ForegroundColor Yellow

if (-not $Execute) {
    Write-Host ""
    Write-Host "  DRY-RUN -- nothing changed. Re-run with -Execute to actually move." -ForegroundColor Yellow
    Write-Host ""
    exit 0
}

# Execute the moves
Write-Host ""
Write-Host "  Executing moves..." -ForegroundColor Cyan
New-Item -ItemType Directory -Path $trashDir -Force | Out-Null

$manifest = [System.Collections.Generic.List[string]]::new()
$manifest.Add("# Ghrava cleanup manifest -- $timestamp")
$manifest.Add("# Files moved from $NasRoot to delete_later/$timestamp/")
$manifest.Add("")

$moved = 0
$failed = 0
foreach ($m in $moves) {
    $src = Join-Path $NasRoot $m.path
    if (-not (Test-Path $src)) { continue }
    $dst = Join-Path $trashDir $m.path
    $dstParent = Split-Path $dst -Parent
    try {
        if ($dstParent -and -not (Test-Path $dstParent)) {
            New-Item -ItemType Directory -Path $dstParent -Force | Out-Null
        }
        Move-Item -Path $src -Destination $dst -Force
        Write-Host "    v moved: $($m.path)" -ForegroundColor Green
        $manifest.Add("MOVED  $($m.path)")
        $manifest.Add("       reason: $($m.reason)")
        $manifest.Add("")
        $moved++
    } catch {
        $errMsg = $_.Exception.Message
        Write-Host "    x failed: $($m.path) -- $errMsg" -ForegroundColor Red
        $manifest.Add("FAILED $($m.path) -- $errMsg")
        $failed++
    }
}

# Tidy up now-empty scripts\ dir
if ((Test-Path $scriptsDir) -and ((Get-ChildItem $scriptsDir -Force | Measure-Object).Count -eq 0)) {
    try {
        Remove-Item $scriptsDir -Force
        Write-Host "    v removed empty dir: scripts\" -ForegroundColor Green
        $manifest.Add("REMOVED scripts\  (empty)")
    } catch {
        $errMsg = $_.Exception.Message
        Write-Host "    x couldn't remove scripts\ -- $errMsg" -ForegroundColor Yellow
    }
}

# Write manifest
$manifestPath = Join-Path $trashDir 'manifest.txt'
$manifest | Out-File -FilePath $manifestPath -Encoding UTF8
Write-Host ""
Write-Host "  Manifest: $manifestPath" -ForegroundColor Gray

# Summary
Write-Host ""
Write-Host "  Done." -ForegroundColor Green
Write-Host "  Moved  : $moved items"
if ($failed -gt 0) { Write-Host "  Failed : $failed" -ForegroundColor Yellow }
Write-Host "  Trash  : $trashDir" -ForegroundColor Cyan
Write-Host ""
Write-Host "  Review delete_later\ in a few days. If nothing's missing," -ForegroundColor Yellow
Write-Host "  delete the timestamped folder:" -ForegroundColor Yellow
Write-Host "    Remove-Item -Recurse -Force '$trashDir'" -ForegroundColor White
Write-Host ""
