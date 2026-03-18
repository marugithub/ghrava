# ghrava_git_setup.ps1
# Run this ONCE to initialise the git repo on the NAS and push to GitHub.
# After this, use ghrava_deploy.ps1 for all future deploys.

$NasRoot  = "Z:\ghrava"
$RepoUrl  = "https://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@github.com/marugithub/ghrava.git"
$Branch   = "main"

Set-Location $NasRoot

Write-Host "`n  GHRAVA — One-time GitHub setup`n" -ForegroundColor Blue

# Init
git init
git checkout -b $Branch

# Identity (required by git, cosmetic only)
git config user.email "ghrava@local"
git config user.name  "Ghrava"

# Disable SSL verification (NAS git does not trust public CA certs)
git config http.sslVerify false

# Keep LF line endings — prevents CRLF warnings on Windows
git config core.autocrlf false

# Store credentials so future pulls don't prompt
git config credential.helper store
git remote remove origin 2>$null
git remote add origin $RepoUrl

# Stage everything (respects .gitignore)
git add -A

# Initial commit
git commit -m "Initial commit — v$(Get-Content app\version.txt)"

# Push
git push -u origin $Branch --force

Write-Host "`n  Done. Future deploys: just run .\ghrava_deploy.ps1`n" -ForegroundColor Green
