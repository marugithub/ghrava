# -----------------------------------------------------------------------------
# ghrava_deploy.ps1  -  One-Enter Ghrava deploy.
#
# Does the whole loop in one command:
#   1. Find latest Ghrava_DEPLOY.zip in Downloads (or path you pass)
#   2. Extract → robocopy onto NAS at Z:\ghrava
#   3. Delete the zip
#   4. Commit + push to GitHub (skips if no git remote)
#   5. SSH to NAS → docker restart ghrava
#   6. Tail last 30 lines of container logs so you see startup
#   7. Run the ~20s smoke test against the live NAS URL (hard gate:
#      a failing endpoint stops the script)
#   8. Run the full Playwright E2E suite (~3 min, soft gate: prints
#      the failure summary but does NOT roll back — manual decision)
#
# Usage:
#   .\ghrava_deploy.ps1                  # latest zip in Downloads
#   .\ghrava_deploy.ps1 -ZipPath C:\foo  # specific zip
#   .\ghrava_deploy.ps1 -SkipGit         # deploy without pushing
#   .\ghrava_deploy.ps1 -SkipRestart     # copy + push only, no docker
#   .\ghrava_deploy.ps1 -SkipTests       # skip steps 7 + 8 (smoke + E2E)
#
# Version bumps use plain restart (~2s). If package.json changed, the script
# detects it and tells you to run `docker compose up --build -d` instead.
# -----------------------------------------------------------------------------

param(
    [string]$ZipPath     = "",
    [string]$NasRoot     = "Z:\ghrava",
    [string]$LogDir      = "Z:\ghrava\logs",
    [string]$NasHost     = "192.168.4.62",
    [string]$NasUser     = "admin",
    [string]$SshKey      = "$env:USERPROFILE\.ssh\ghrava_nas_rsa",
    [string]$DockerPath  = "/share/CACHEDEV4_DATA/.qpkg/container-station/bin/docker",
    [string]$Container   = "ghrava",
    [string]$GhUrl       = "",
    [string]$AuthToken   = "",
    [switch]$SkipGit,
    [switch]$SkipRestart,
    [switch]$SkipTests,
    [switch]$SkipE2E       # v.197 — run smoke (HARD) but skip Playwright E2E (per the
                           #         every-other-deploy rule from 2026-05-23). Use on
                           #         alternate deploys to save ~5min when no contract
                           #         changes are expected to surface in E2E.
)

# Live app URL the smoke + E2E suites hit. Defaults from $NasHost.
if ($GhUrl -eq "") { $GhUrl = "http://${NasHost}:3001" }

# ── App password for the E2E gate ────────────────────────────────────────────
# The full E2E suite exercises write endpoints, which require a session. The
# suite's beforeAll exchanges this password for a token (POST /auth/login).
# Without it, ~21 CRUD tests 401 every deploy and the soft gate is meaningless.
# Resolution order (no secret is ever committed):
#   1. -AuthToken arg   2. $env:GHRAVA_TOKEN   3. tests\.ghrava-auth file (gitignored)
if ($AuthToken -eq "") {
    if     ($env:GHRAVA_TOKEN)                     { $AuthToken = $env:GHRAVA_TOKEN }
    elseif (Test-Path "$PSScriptRoot\tests\.ghrava-auth") {
        $AuthToken = (Get-Content "$PSScriptRoot\tests\.ghrava-auth" -Raw).Trim()
    }
}

$ErrorActionPreference = "Continue"

function Step($n, $msg) { Write-Host "`n[$n] $msg" -ForegroundColor Cyan }
function OK($msg)       { Write-Host "    v $msg" -ForegroundColor Green }
function Fail($msg)     { Write-Host "    x $msg" -ForegroundColor Red }
function Info($msg)     { Write-Host "    . $msg" -ForegroundColor Gray }
function Warn($msg)     { Write-Host "    ! $msg" -ForegroundColor Yellow }

$timestamp = Get-Date -Format "yyyy-MM-ddTHH-mm"
$log       = [System.Collections.Generic.List[string]]::new()
function L($m) { $log.Add("$(Get-Date -Format 'HH:mm:ss')  $m") | Out-Null }
function SaveLog {
    if (-not (Test-Path $LogDir)) { New-Item -ItemType Directory -Path $LogDir -Force | Out-Null }
    $log | Out-File -FilePath (Join-Path $LogDir "deploy_${timestamp}.log") -Encoding UTF8
    Write-Host "  Log: $LogDir\deploy_${timestamp}.log" -ForegroundColor DarkGray
}

# Helper that runs ssh and returns stdout. Always passes -i and the right host.
function Invoke-Nas {
    param([string]$Command)
    $args = @("-i", $SshKey, "$NasUser@$NasHost", $Command)
    & ssh @args
}

Write-Host "`n  GHRAVA DEPLOY  $(Get-Date -Format 'yyyy-MM-dd HH:mm')" -ForegroundColor Blue
L "=== Deploy start ==="

# ── 1: Find zip ──────────────────────────────────────────────────────────────
Step "1/8" "Finding Ghrava_DEPLOY.zip"
if ($ZipPath -eq "") {
    $downloads = "$env:USERPROFILE\Downloads"
    $found = Get-ChildItem -Path $downloads -Filter "Ghrava_DEPLOY.zip" -ErrorAction SilentlyContinue |
             Sort-Object LastWriteTime -Descending | Select-Object -First 1
    if (-not $found) {
        Fail "Ghrava_DEPLOY.zip not found in $downloads"
        L "ERROR: zip not found"; SaveLog; exit 1
    }
    $ZipPath = $found.FullName
}
if (-not (Test-Path $ZipPath)) {
    Fail "Zip not found: $ZipPath"; L "ERROR: zip path"; SaveLog; exit 1
}
OK "Found: $ZipPath"
L "Zip: $ZipPath"

# ── 2: Check NAS path ────────────────────────────────────────────────────────
Step "2/8" "Checking NAS at $NasRoot"
if (-not (Test-Path $NasRoot)) {
    Fail "NAS path not accessible: $NasRoot (is Z: mapped?)"
    L "ERROR: NAS not reachable"; SaveLog; exit 1
}
OK "NAS reachable"

# Snapshot package.json hash BEFORE copy (to detect rebuild need)
$pkgPath    = Join-Path $NasRoot "app\package.json"
$oldPkgHash = ""
if (Test-Path $pkgPath) { $oldPkgHash = (Get-FileHash $pkgPath -Algorithm MD5).Hash }

# ── 3: Extract and robocopy ──────────────────────────────────────────────────
Step "3/8" "Extracting and copying to NAS"
$tempDir = Join-Path $env:TEMP "ghrava_deploy_$timestamp"
try {
    New-Item -ItemType Directory -Path $tempDir -Force | Out-Null
    Expand-Archive -Path $ZipPath -DestinationPath $tempDir -Force

    $roboOut = robocopy $tempDir $NasRoot /E /NJH /NJS /NFL /NDL 2>&1
    if ($LASTEXITCODE -gt 7) {
        Fail "robocopy failed (exit $LASTEXITCODE)"
        L "ERROR: robocopy exit $LASTEXITCODE"; SaveLog; exit 1
    }
    OK "Files copied to NAS"
    L "robocopy exit: $LASTEXITCODE"
} catch {
    Fail "Extract/copy failed: $_"
    L "ERROR: $_"; SaveLog; exit 1
} finally {
    Remove-Item -Path $tempDir -Recurse -Force -ErrorAction SilentlyContinue
}

Remove-Item -Path $ZipPath -Force -ErrorAction SilentlyContinue
Info "Zip deleted from Downloads"

$verFile = Join-Path $NasRoot "app\version.txt"
$ver = ""
if (Test-Path $verFile) {
    $ver = (Get-Content $verFile).Trim()
    Info "Deployed version: $ver"
    L "Version: $ver"
}

# Detect package.json change
$needsRebuild = $false
if ($oldPkgHash -ne "" -and (Test-Path $pkgPath)) {
    $newPkgHash = (Get-FileHash $pkgPath -Algorithm MD5).Hash
    if ($newPkgHash -ne $oldPkgHash) {
        $needsRebuild = $true
        Warn "package.json changed - full rebuild required"
        L "package.json changed"
    }
}

# ── 4: Git push ──────────────────────────────────────────────────────────────
Step "4/8" "Pushing to GitHub"
if ($SkipGit) {
    Info "Skipped (--SkipGit)"
    L "Git push: skipped"
} else {
    try { git --version 2>&1 | Out-Null } catch {
        Warn "git not found on PATH - skipping push"
        L "Git: not installed"
        $SkipGit = $true
    }
}
if (-not $SkipGit) {
    if (-not (Test-Path (Join-Path $NasRoot ".git"))) {
        Warn "Not a git repo at $NasRoot - skipping push"
        L "Git: no .git folder"
    } else {
        Push-Location $NasRoot
        try {
            git config --global --add safe.directory $NasRoot 2>$null
            git config http.sslVerify false 2>$null
            git config core.autocrlf false 2>$null
            git add -A 2>&1 | Out-Null
            $status = git status --porcelain 2>&1
            if (-not $status) {
                Info "Nothing to commit - GitHub already in sync"
                L "Git: clean"
            } else {
                $msg = if ($ver) { "v$ver - $(Get-Date -Format 'yyyy-MM-dd HH:mm')" }
                       else      { "deploy $(Get-Date -Format 'yyyy-MM-dd HH:mm')" }
                git commit -m $msg 2>&1 | Out-Null
                if ($LASTEXITCODE -eq 0) {
                    $pushOut = git push origin main 2>&1
                    if ($LASTEXITCODE -eq 0) {
                        OK "Pushed: $msg"
                        L "Git push: ok ($msg)"
                    } else {
                        Warn "Push failed (commit was made locally)"
                        $pushOut | ForEach-Object { Info "  $_" }
                        L "Git push: FAILED"
                    }
                } else {
                    Warn "Commit failed"
                    L "Git commit: FAILED"
                }
            }
        } finally { Pop-Location }
    }
}

# ── 5: Docker restart ────────────────────────────────────────────────────────
Step "5/8" "Restarting container on NAS"
if ($SkipRestart) {
    Info "Skipped (--SkipRestart)"
    L "Restart: skipped"
} elseif ($needsRebuild) {
    Warn "package.json changed - cannot use plain restart"
    Write-Host ""
    Write-Host "  SSH to NAS and run:" -ForegroundColor Yellow
    Write-Host "    cd /share/Docker/home-core/ghrava" -ForegroundColor White
    Write-Host "    $DockerPath compose up --build -d" -ForegroundColor White
    Write-Host ""
    L "Restart: needs manual rebuild"
} else {
    $cmd = "$DockerPath restart $Container && $DockerPath ps --filter name=$Container --format '{{.Names}} {{.Status}}'"
    $out = Invoke-Nas $cmd 2>&1
    if ($LASTEXITCODE -eq 0) {
        OK "Container restarted"
        $out | ForEach-Object { Info "  $_" }
        L "Restart: ok"
    } else {
        Fail "Restart failed"
        $out | ForEach-Object { Info "  $_" }
        L "Restart: FAILED"
        SaveLog; exit 1
    }
}

# ── 6: Show fresh logs ───────────────────────────────────────────────────────
Step "6/8" "Tailing fresh container logs"
if ($SkipRestart) {
    Info "Skipped (--SkipRestart)"
} else {
    Start-Sleep -Seconds 2
    $logCmd = "$DockerPath logs --tail 30 $Container 2>&1"
    $logOut = Invoke-Nas $logCmd
    $logOut | ForEach-Object { Info "  $_" }

    # Quick health check: any line containing 'error' or 'crash' that
    # ISN'T a stack trace from a known-recovered startup?
    # Exclude benign stat counters like '[data-cleanup] ... errors=0' where
    # the substring 'errors' is a zero-valued counter, not an actual error.
    $errLines = $logOut |
        Select-String -Pattern 'error|crash|unhandled' -CaseSensitive:$false |
        Where-Object { $_.Line -notmatch '\berrors?=0\b' }
    $errCount = $errLines.Count
    if ($errCount -gt 0) {
        Warn "$errCount error-like line(s) in logs - eyeball above"
        L "Logs: $errCount error-like lines"
    } else {
        OK "No errors in fresh logs"
        L "Logs: clean"
    }
}

# ── 7: Smoke test (HARD gate) ────────────────────────────────────────────────
# ~20s. Hits the handful of aggregator/health endpoints against the live NAS.
# A failing endpoint means the deploy is broken — stop the script here.
$TestsDir = Join-Path $NasRoot "tests"
$Pw       = Join-Path $TestsDir "node_modules\.bin\playwright.cmd"

Step "7/8" "Smoke test against $GhUrl"
if ($SkipTests) {
    Info "Skipped (--SkipTests)"
    L "Smoke: skipped"
} elseif ($SkipRestart) {
    Info "Skipped (no restart this run)"
    L "Smoke: skipped (no restart)"
} elseif (-not (Test-Path $Pw)) {
    Warn "Playwright not installed at $TestsDir\node_modules — skipping smoke"
    Warn "  (cd $TestsDir; npm install; npx playwright install chromium)"
    L "Smoke: skipped (playwright missing)"
} else {
    $env:GHRAVA_URL = $GhUrl
    $env:PW_TEST_HTML_REPORT_OPEN = 'never'
    # cd into tests/ — Playwright run from a parent dir scans twice.
    Push-Location $TestsDir
    try {
        $smokeOut = & $Pw test smoke.spec.js --config="$TestsDir\playwright.config.js" 2>&1
    } finally { Pop-Location }
    $smokeExit = $LASTEXITCODE
    $smokeOut | ForEach-Object { Info "  $_" }

    if ($smokeExit -eq 0) {
        OK "Smoke passed — all endpoints answered"
        L "Smoke: pass"
    } else {
        Fail "Smoke FAILED — deploy is not healthy"
        # Surface exactly which endpoint(s) died. Smoke test titles are
        # 'GET <path> → 200 + non-empty JSON'; failing lines carry them.
        $dead = $smokeOut | Select-String -Pattern '(✘|×|✗|failed).*GET |GET .*(✘|×|✗| failed)|Error:' |
                ForEach-Object { $_.ToString().Trim() }
        if ($dead) {
            Write-Host ""
            Write-Host "  Dead endpoint(s):" -ForegroundColor Red
            $dead | ForEach-Object { Write-Host "    $_" -ForegroundColor Red }
        }
        L "Smoke: FAIL (exit $smokeExit)"
        SaveLog
        exit 1
    }
}

# ── 8: Full Playwright E2E (SOFT gate) ───────────────────────────────────────
# ~3 min. Prints the failure summary but does NOT roll back — Al decides.
$e2eFailed = $false
Step "8/8" "Full Playwright E2E suite"
if ($SkipTests -or $SkipE2E) {
    $reason = if ($SkipTests) { '--SkipTests' } else { '--SkipE2E (every-other-deploy rule)' }
    Info "Skipped ($reason)"
    L "E2E: skipped ($reason)"
} elseif ($SkipRestart) {
    Info "Skipped (no restart this run)"
    L "E2E: skipped (no restart)"
} elseif (-not (Test-Path $Pw)) {
    Warn "Playwright not installed — skipping E2E"
    L "E2E: skipped (playwright missing)"
} else {
    $env:GHRAVA_URL = $GhUrl
    $env:PW_TEST_HTML_REPORT_OPEN = 'never'
    # Hand the suite the app password so beforeAll logs in and the write
    # tests actually run. No password → CRUD tests 401 (the old silent bug).
    if ($AuthToken) {
        $env:GHRAVA_TOKEN = $AuthToken
        Info "Auth token resolved — CRUD write tests will run"
    } else {
        Remove-Item Env:\GHRAVA_TOKEN -ErrorAction SilentlyContinue
        Warn "No app password (-AuthToken / `$env:GHRAVA_TOKEN / tests\.ghrava-auth)"
        Warn "  → ~21 CRUD write tests will 401. E2E soft gate is not meaningful."
    }
    Push-Location $TestsDir
    try {
        $e2eOut = & $Pw test --config="$TestsDir\playwright.config.js" 2>&1
    } finally {
        Pop-Location
        # Don't leave the password in the shell session env after the run.
        Remove-Item Env:\GHRAVA_TOKEN -ErrorAction SilentlyContinue
    }
    $e2eExit = $LASTEXITCODE
    $e2eOut | ForEach-Object { Info "  $_" }

    if ($e2eExit -eq 0) {
        OK "Full E2E passed"
        L "E2E: pass"
    } else {
        $e2eFailed = $true
        Warn "E2E FAILED (exit $e2eExit) — NOT rolling back, your call"
        $summary = $e2eOut | Select-String -Pattern '\d+ (passed|failed|flaky|skipped)|✘|×|✗' |
                   ForEach-Object { $_.ToString().Trim() }
        if ($summary) {
            Write-Host ""
            Write-Host "  E2E failure summary:" -ForegroundColor Yellow
            $summary | ForEach-Object { Write-Host "    $_" -ForegroundColor Yellow }
        }
        L "E2E: FAIL (exit $e2eExit) — no rollback"
    }
}

SaveLog
Write-Host ""
Write-Host "  -----------------------------------------------------" -ForegroundColor DarkGray
if ($e2eFailed) {
    Write-Host "  DONE (deployed; E2E failed — review above)  $(Get-Date -Format 'HH:mm:ss')" -ForegroundColor Yellow
} else {
    Write-Host "  DONE  $(Get-Date -Format 'HH:mm:ss')" -ForegroundColor Green
}
Write-Host "  -----------------------------------------------------" -ForegroundColor DarkGray
Write-Host ""

# Soft gate: non-zero exit so automation notices, but the deploy stands
# and nothing was rolled back.
if ($e2eFailed) { exit 2 }
