# Ghrava_Share.ps1
# Creates a clean shareable zip of the Ghrava codebase.
# Excludes: data, backups, attachments, node_modules, .git, env files, DB files.
# Output: ~/Downloads/Ghrava_Share_YYYYMMDD.zip
# Extracts cleanly to ghrava/ folder.

$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem

# ── Paths ─────────────────────────────────────────────────────
$scriptDir   = Split-Path -Parent $MyInvocation.MyCommand.Path
$sourceDir   = $scriptDir.TrimEnd('\')
$dateStamp   = Get-Date -Format 'yyyyMMdd'
$zipName     = "Ghrava_Share_$dateStamp.zip"
$destination = Join-Path ([Environment]::GetFolderPath('UserProfile')) "Downloads\$zipName"

# ── Exclusion rules ───────────────────────────────────────────
$excludeDirs = @('node_modules','.git','data','backups','attachments','uploads')

$excludePatterns = @('*.db','*.db-wal','*.db-shm','*.env','*.env.*','.env*','*.secrets','*.secrets.*','*.txt')

Write-Host "Ghrava Share Packager" -ForegroundColor Cyan
Write-Host "Source : $sourceDir"
Write-Host "Output : $destination"
Write-Host ""

if (Test-Path $destination) { Remove-Item $destination -Force; Write-Host "Removed existing zip." -ForegroundColor Yellow }

# ── Collect files ─────────────────────────────────────────────
$included = Get-ChildItem -Path $sourceDir -Recurse -File | Where-Object {
    $rel   = $_.FullName.Substring($sourceDir.Length).TrimStart('\','/')
    $parts = $rel -split '[/\\]'
    # exclude if inside a banned dir
    foreach ($p in $parts[0..($parts.Length-2)]) { if ($excludeDirs -contains $p) { return $false } }
    # exclude by filename pattern
    foreach ($pat in $excludePatterns) { if ($_.Name -like $pat) { return $false } }
    return $true
}

Write-Host "Files to include: $($included.Count)" -ForegroundColor Green

# ── Build zip ─────────────────────────────────────────────────
$fs  = [System.IO.File]::Open($destination, [System.IO.FileMode]::Create, [System.IO.FileAccess]::ReadWrite)
$zip = New-Object System.IO.Compression.ZipArchive($fs, [System.IO.Compression.ZipArchiveMode]::Create)

$added = 0; $skipped = 0

foreach ($file in $included) {
    $rel       = $file.FullName.Substring($sourceDir.Length).TrimStart('\','/')
    $entryName = "ghrava/$($rel -replace '\\','/')"
    try {
        $entry     = $zip.CreateEntry($entryName, [System.IO.Compression.CompressionLevel]::Optimal)
        $entryStream = $entry.Open()
        $fileStream  = [System.IO.File]::OpenRead($file.FullName)
        $fileStream.CopyTo($entryStream)
        $fileStream.Dispose()
        $entryStream.Dispose()
        $added++
    } catch {
        Write-Host "  Skipped: $rel" -ForegroundColor Yellow
        $skipped++
    }
}

$zip.Dispose()
$fs.Dispose()

# ── Summary ───────────────────────────────────────────────────
$sizeMB = [math]::Round((Get-Item $destination).Length / 1MB, 2)
Write-Host ""
Write-Host "Done." -ForegroundColor Green
Write-Host "  Added   : $added files"
if ($skipped -gt 0) { Write-Host "  Skipped : $skipped" -ForegroundColor Yellow }
Write-Host "  Size    : $sizeMB MB"
Write-Host "  Saved   : $destination" -ForegroundColor Cyan
