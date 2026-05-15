# Ghrava_Share.ps1
# Builds the share zip for handing off to a new Claude chat.
#
# Flow:
#   1. Print the exact NAS commands you need to run (refresh SCHEMA.md from live DB)
#   2. Wait for you to confirm you've done it (SSH menu blocks non-interactive,
#      so we do this manually instead of fighting QNAP)
#   3. Build the zip

$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem

$SourceDir   = 'Z:\ghrava'
$dateStamp   = Get-Date -Format 'yyyyMMdd'
$zipName     = "Ghrava_Share_$dateStamp.zip"
$destination = Join-Path ([Environment]::GetFolderPath('UserProfile')) "Downloads\$zipName"

Write-Host ""
Write-Host "  GHRAVA SHARE BUILDER" -ForegroundColor Blue
Write-Host "  Source : $SourceDir"
Write-Host "  Output : $destination"
Write-Host ""

# ── Step 1: prompt user to refresh schema on NAS ─────────────
Write-Host "[1/3] Refresh prod SCHEMA.md on NAS" -ForegroundColor Cyan
Write-Host ""
Write-Host "  SSH to NAS (admin@192.168.4.62), drop to shell from the menu," -ForegroundColor Yellow
Write-Host "  then paste this block:" -ForegroundColor Yellow
Write-Host ""
Write-Host "  ___________________________________________________________" -ForegroundColor DarkGray
Write-Host "  docker exec ghrava node /app/.claude/skills/ghrava-schema-safety/scripts/gen-schema-doc.js" -ForegroundColor White
Write-Host "  docker cp ghrava:/app/SCHEMA.md /share/Docker/home-core/ghrava/app/SCHEMA.md" -ForegroundColor White
Write-Host "  cp /share/Docker/home-core/ghrava/app/SCHEMA.md /share/Docker/home-core/ghrava/SCHEMA.md" -ForegroundColor White
Write-Host "  exit" -ForegroundColor White
Write-Host "  ___________________________________________________________" -ForegroundColor DarkGray
Write-Host ""

$response = Read-Host "  Done? (y to continue / s to skip schema refresh / anything else to abort)"

if ($response -eq 's' -or $response -eq 'S') {
    Write-Host "      Skipping schema refresh. Zip will use existing SCHEMA.md (may be stale)." -ForegroundColor Yellow
} elseif ($response -eq 'y' -or $response -eq 'Y') {
    $schemaFile = Join-Path $SourceDir 'app\SCHEMA.md'
    if (Test-Path $schemaFile) {
        $ageMin = ((Get-Date) - (Get-Item $schemaFile).LastWriteTime).TotalMinutes
        if ($ageMin -gt 10) {
            Write-Host ("      ! Warning: SCHEMA.md is {0:N1} min old. Did the refresh actually run?" -f $ageMin) -ForegroundColor Yellow
            $confirm = Read-Host "      Continue anyway? (y/N)"
            if ($confirm -ne 'y' -and $confirm -ne 'Y') {
                Write-Host "      Aborted." -ForegroundColor Red
                exit 1
            }
        } else {
            Write-Host ("      v SCHEMA.md is fresh ({0:N1} min old)" -f $ageMin) -ForegroundColor Green
        }
    }
} else {
    Write-Host "      Aborted." -ForegroundColor Red
    exit 1
}
Write-Host ""

# ── Step 2: snapshot current state ───────────────────────────
Write-Host "[2/3] Snapshotting current state" -ForegroundColor Cyan

$verFile = Join-Path $SourceDir 'app\version.txt'
$version = if (Test-Path $verFile) { (Get-Content $verFile).Trim() } else { 'unknown' }
Write-Host "      Version: $version" -ForegroundColor Gray

$schemaFile = Join-Path $SourceDir 'app\SCHEMA.md'
if (Test-Path $schemaFile) {
    $tableCount = (Select-String -Path $schemaFile -Pattern '^### `' -AllMatches).Count
    Write-Host "      SCHEMA tables: $tableCount" -ForegroundColor Gray
}
Write-Host ""

# ── Step 3: build the zip ─────────────────────────────────────
Write-Host "[3/3] Building zip" -ForegroundColor Cyan

if (Test-Path $destination) {
    Remove-Item $destination -Force
    Write-Host "      Removed existing zip" -ForegroundColor Gray
}

$excludeDirs = @('node_modules','.git','backups','__pycache__','delete_later')
$excludePatterns = @(
    '*.db','*.db-wal','*.db-shm',
    '*.env','*.env.*','.env*',
    '*.secrets','*.secrets.*',
    '*.log','npm-debug.log*'
)
$excludePathPatterns = @(
    'data/*','app/data/*',
    'attachments/files/*','app/attachments/files/*',
    'public/uploads/*','app/public/uploads/*',
    'logs/*','app/logs/*'
)

$included = Get-ChildItem -Path $SourceDir -Recurse -File | Where-Object {
    $rel        = $_.FullName.Substring($SourceDir.Length).TrimStart('\','/')
    $relForward = $rel -replace '\\','/'
    $parts      = $rel -split '[/\\]'

    foreach ($p in $parts[0..($parts.Length-2)]) {
        if ($excludeDirs -contains $p) { return $false }
    }
    foreach ($pat in $excludePatterns) {
        if ($_.Name -like $pat) { return $false }
    }
    foreach ($pat in $excludePathPatterns) {
        if ($relForward -like $pat) { return $false }
    }
    return $true
}

Write-Host "      Files to include: $($included.Count)" -ForegroundColor Gray

$fs  = [System.IO.File]::Open($destination, [System.IO.FileMode]::Create, [System.IO.FileAccess]::ReadWrite)
$zip = New-Object System.IO.Compression.ZipArchive($fs, [System.IO.Compression.ZipArchiveMode]::Create)

$added = 0
$skipped = 0
foreach ($file in $included) {
    $rel       = $file.FullName.Substring($SourceDir.Length).TrimStart('\','/')
    $entryName = "ghrava/$($rel -replace '\\','/')"
    try {
        $entry       = $zip.CreateEntry($entryName, [System.IO.Compression.CompressionLevel]::Optimal)
        $entryStream = $entry.Open()
        $fileStream  = [System.IO.File]::OpenRead($file.FullName)
        $fileStream.CopyTo($entryStream)
        $fileStream.Dispose()
        $entryStream.Dispose()
        $added++
    } catch {
        $skipped++
    }
}

$zip.Dispose()
$fs.Dispose()

$sizeMB = [math]::Round((Get-Item $destination).Length / 1MB, 2)
Write-Host ""
Write-Host "  Done." -ForegroundColor Green
Write-Host "  Version : $version"
Write-Host "  Added   : $added files"
if ($skipped -gt 0) { Write-Host "  Skipped : $skipped" -ForegroundColor Yellow }
Write-Host "  Size    : $sizeMB MB"
Write-Host "  Saved   : $destination" -ForegroundColor Cyan
Write-Host ""
Write-Host "  Hand this zip to the next Claude chat with this message:" -ForegroundColor Yellow
Write-Host ""
Write-Host "    Read START_HERE.md in this zip first." -ForegroundColor White
Write-Host "    Then run bash bootstrap.sh and paste the output." -ForegroundColor White
Write-Host "    Then ask me what to build." -ForegroundColor White
Write-Host ""
