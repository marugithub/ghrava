# ghrava_git_setup.ps1
# Run this ONCE to initialise the git repo on the NAS and push to GitHub.
# After this, use ghrava_deploy.ps1 for all future deploys.
# Safe to re-run — detects existing repo and branch.

$NasRoot  = "Z:\ghrava"
$RepoUrl  = "https://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@github.com/marugithub/ghrava.git"
$Branch   = "main"

Set-Location $NasRoot

Write-Host "`n  GHRAVA — One-time GitHub setup`n" -ForegroundColor Blue

# Init only if not already a git repo
if (-not (Test-Path (Join-Path $NasRoot ".git"))) {
    git init
    Write-Host "    . Initialised new git repo" -ForegroundColor Gray
} else {
    Write-Host "    . Git repo already exists — skipping init" -ForegroundColor Gray
}

# Create branch only if it doesn't exist yet
$existingBranch = git branch --list $Branch
if (-not $existingBranch) {
    git checkout -b $Branch
} else {
    git checkout $Branch
    Write-Host "    . Branch '$Branch' already exists — checked out" -ForegroundColor Gray
}

# Config
git config user.email "ghrava@local"
git config user.name  "Ghrava"
git config http.sslVerify false
git config core.autocrlf false
git config credential.helper store

# Remote
git remote remove origin 2>$null
git remote add origin $RepoUrl

# Stage everything (respects .gitignore)
git add -A

# Commit — skip if nothing to commit
$status = git status --porcelain
if ($status) {
    $ver = (Get-Content app\version.txt).Trim()
    git commit -m "Initial commit — v$ver"
} else {
    Write-Host "    . Nothing to commit — working tree clean" -ForegroundColor Gray
}

# Push
git push -u origin $Branch --force

Write-Host "`n  Done. Future deploys: just run .\ghrava_deploy.ps1`n" -ForegroundColor Green
