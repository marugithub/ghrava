# ─────────────────────────────────────────────────────────────────────────────
# ghrava_deploy.ps1  —  Pull latest from GitHub, then restart or rebuild
#
# Usage:
#   .\ghrava_deploy.ps1                        # pull + smart restart
#   .\ghrava_deploy.ps1 -Branch main           # explicit branch
#
# Version bumps:              docker restart ghrava        (~2s)
# Dependency changes:         docker compose up --build -d (~90s)
# ─────────────────────────────────────────────────────────────────────────────

param(
    [string]$NasRoot = "Z:\ghrava",
    [string]$LogDir  = "Z:\ghrava\logs",
    [string]$Branch  = "main"
)

$ErrorActionPreference = "Stop"

function Write-Step($n, $msg) { Write-Host "`n[$n] $msg" -ForegroundColor Cyan }
function Write-OK($msg)       { Write-Host "    v $msg" -ForegroundColor Green }
function Write-Fail($msg)     { Write-Host "    x $msg" -ForegroundColor Red }
function Write-Info($msg)     { Write-Host "    . $msg" -ForegroundColor Gray }

$timestamp = Get-Date -Format "yyyy-MM-ddTHH-mm"
$log       = [System.Collections.Generic.List[string]]::new()
function L($msg) { $log.Add("$(Get-Date -Format 'HH:mm:ss')  $msg") }

function Save-Log {
    if (-not (Test-Path $LogDir)) { New-Item -ItemType Directory -Path $LogDir -Force | Out-Null }
    $log | Out-File -FilePath (Join-Path $LogDir "deploy_${timestamp}.log") -Encoding UTF8
    Write-Host "  Log: $LogDir\deploy_${timestamp}.log" -ForegroundColor DarkGray
}

Write-Host "`n  GHRAVA DEPLOY  $(Get-Date -Format 'yyyy-MM-dd HH:mm')`n" -ForegroundColor Blue
L "=== Ghrava Deploy Start ==="

# -- 1: Check NAS is accessible -----------------------------------------------

Write-Step "1/3" "Checking NAS at $NasRoot"

if (-not (Test-Path $NasRoot)) {
    Write-Fail "NAS path not accessible: $NasRoot  (is Z: mapped?)"
    L "ERROR: NAS not accessible"; Save-Log; exit 1
}
Write-OK "NAS reachable"

# -- 2: Git pull ---------------------------------------------------------------

Write-Step "2/3" "Pulling latest from GitHub"

try { git --version | Out-Null } catch {
    Write-Fail "git not found -- install Git for Windows: https://git-scm.com"
    L "ERROR: git not found"; Save-Log; exit 1
}

Set-Location $NasRoot

if (-not (Test-Path (Join-Path $NasRoot ".git"))) {
    Write-Fail "Not a git repo. Run the one-time setup first (see README)."
    L "ERROR: Not a git repo"; Save-Log; exit 1
}

$oldPkgHash = ""
$pkgPath = Join-Path $NasRoot "app\package.json"
if (Test-Path $pkgPath) {
    $oldPkgHash = (Get-FileHash $pkgPath -Algorithm MD5).Hash
}

# Ensure SSL verify is off (NAS git does not trust public CA certs)
git config http.sslVerify false

# Keep LF line endings -- prevents CRLF warnings on Windows
git config core.autocrlf false

$gitOut = git pull origin $Branch 2>&1
Write-Info $gitOut
L "git pull: $gitOut"

if ($LASTEXITCODE -ne 0) {
    Write-Fail "git pull failed"
    L "ERROR: git pull failed"; Save-Log; exit 1
}
Write-OK "Pull complete"

$verFile = Join-Path $NasRoot "app\version.txt"
if (Test-Path $verFile) {
    $ver = (Get-Content $verFile).Trim()
    Write-Info "Version: $ver"
    L "Version: $ver"
}

# -- 3: Restart or rebuild -----------------------------------------------------

Write-Step "3/3" "Restarting container"

$needsRebuild = $false
if ($oldPkgHash -ne "" -and (Test-Path $pkgPath)) {
    $newPkgHash = (Get-FileHash $pkgPath -Algorithm MD5).Hash
    if ($newPkgHash -ne $oldPkgHash) {
        $needsRebuild = $true
        Write-Info "package.json changed -- Docker rebuild required"
        L "package.json changed -- rebuild required"
    }
}

Write-Host ""
Write-Host "  -----------------------------------------------------" -ForegroundColor DarkGray

if ($needsRebuild) {
    Write-Host "  package.json changed -- full rebuild required (~90s):" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "  cd /share/Docker/home-core/ghrava && docker compose up --build -d" -ForegroundColor White
} else {
    Write-Host "  Code-only change -- restart takes ~2s:" -ForegroundColor Green
    Write-Host ""
    Write-Host "  docker restart ghrava" -ForegroundColor White
}

Write-Host ""
Write-Host "  Then run .\ghrava_test.ps1 to verify" -ForegroundColor DarkGray
Write-Host "  -----------------------------------------------------" -ForegroundColor DarkGray

L "Deploy complete -- rebuild needed: $needsRebuild"
Save-Log
Write-Host ""
