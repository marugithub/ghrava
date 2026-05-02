# Deploy-Patch.ps1 — Ghrava v202604.122
# Cumulative cards-system iteration since v118 baseline.
#
# What's new since v118:
#
# RENDERER + INFRASTRUCTURE
#   - Per-record render error catching: bad records show "tap to open"
#     placeholder, the rest of the list keeps rendering
#   - Defensive null guards on every config callback (crossModule,
#     statusRowChips, linkedEntities, compactMeta, instructionIcons)
#   - Photo fallback: img with onerror falls back to brand-color block
#     when attachment 404s — every card always shows *something*
#   - Container className/style reset before card mount so leftover
#     legacy grid styles don't conflict with .gh-card-grid
#
# KEYBOARD ACCESSIBILITY
#   - tabindex="0", role="button", aria-label on clickable cards
#   - Enter/Space activate the click handler
#   - :focus-visible teal outline ring
#
# SAVED-VIEW BUG FIX
#   - 5 pages were hardcoding initial view to grid/list, ignoring
#     localStorage. After picking card last session, the page rendered
#     legacy on next load until user clicked another button.
#   - Fixed: subscriptions, perfume, insurance, wardrobe, property
#     now read from localStorage at module-init time, matching what
#     inventory/books/documents already did.
#
# MOUNT HELPER SMARTER
#   - Lazy-fetches /settings/family on first card mount and caches as
#     window.familyMembers — was finding helper returning null because
#     no page actually populated that global. Avatars now appear.
#   - Re-renders once when family data lands (no avatars-flicker for
#     subsequent loads in same session).
#
# BACKEND CROSS-MODULE DATA
#   - finance/accounts: linked_subs_count + balance_change_30d (v117)
#   - medical/conditions: active_meds_count + related_visits_count via
#     patient/family_member matching
#   - perfume/: primary_photo_id + first_photo_id subqueries
#   - documents/: attachment_count subquery
#   - vehicle cards: surface last_service / upcoming_service from existing
#     API objects (no schema change)
#   - books cards: progress bar lights up using existing pages_total /
#     pages_read columns (migration 049, no new migration needed)
#   - wardrobe cards: cost_per_wear computed from purchase_price / times_worn,
#     stale-item alert (180+ days) fires correctly with last_worn data
#
# CSS POLISH
#   - Long titles clamped to 2 lines (-webkit-line-clamp)
#   - Subtitle/meta single-line ellipsis
#   - Card grid capped at minmax(280px, 360px) so wide screens don't
#     stretch cards too thin
#   - Error placeholder card has its own minimal styling
#
# TESTS
#   - 10 new resilience tests added to E2E suite (per-record errors,
#     keyboard activation, accessibility attributes, photo fallback,
#     className reset, null-tolerance)
#   - Page-wiring tests now also verify the card button is in the toolbar
#
# DOCS
#   - SCHEMA_CLEANUP_TODO.md: catalogs CASCADE rule violations across
#     existing schema for future cleanup discussion
#   - CARD_FIELD_GAPS.md updated to reflect what's now solved vs what
#     remains schema-blocked

$ErrorActionPreference = 'Stop'
$NasPath   = 'Z:\ghrava'
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path

$PatchFiles = @(
    # Renderer + shared infra
    'app\public\js\gh-card.js',
    'app\public\js\gh-card-shared.js',
    'app\public\js\gh-card-brands.js',
    'app\public\js\gh-card-mount.js',
    # Module configs (unchanged from v118 but bundled for completeness)
    'app\public\js\gh-card-configs-batch1.js',
    'app\public\js\gh-card-configs-batch2.js',
    'app\public\js\gh-card-configs-batch3.js',
    # GH_VIEW now renders 3rd "card" button when views: includes 'card'
    'app\public\js\lt-core.js',
    # CSS additions: title clamping, focus ring, error placeholder, grid cap
    'app\public\shared.css',
    # Body-icon SVGs for medical conditions + visit cards
    'app\public\assets\icons\phosphor\duotone\heart-duotone.svg',
    'app\public\assets\icons\phosphor\duotone\brain-duotone.svg',
    'app\public\assets\icons\phosphor\duotone\stethoscope-duotone.svg',
    'app\public\assets\icons\phosphor\duotone\calendar-duotone.svg',
    'app\public\assets\icons\phosphor\duotone\note-pencil-duotone.svg',
    # Pages wired with 3-view toggle (saved-view bug fixed)
    'app\public\subscriptions.html',
    'app\public\books.html',
    'app\public\perfume.html',
    'app\public\insurance.html',
    'app\public\documents.html',
    'app\public\wardrobe.html',
    'app\public\property.html',
    # Pages with v2 references cleaned up (toolbar deferred)
    'app\public\finance.html',
    'app\public\career.html',
    # Backend
    'app\features\finance\routes.js',
    'app\features\medical\routes.js',
    'app\features\perfume\routes.js',
    'app\features\documents\routes.js',
    'app\features\property\routes.js',
    'app\server.js',
    # Test infra
    'tests\ghrava-e2e.spec.js',
    'tests\run-tests.ps1',
    # Specs
    'CARDS_FINAL.md',
    'TRANSACTION_LINKING_SPEC.md',
    'CARD_FIELD_GAPS.md',
    'SCHEMA_CLEANUP_TODO.md',
    # Version
    'app\version.txt'
)

Write-Host ''
Write-Host '  Ghrava Patch Deploy - v202604.122' -ForegroundColor Cyan
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
Write-Host '  v122 deployed.' -ForegroundColor Green
Write-Host ''
Write-Host '  Pages with 3-view toolbar (grid / list / card):' -ForegroundColor Cyan
Write-Host '    /subscriptions.html  /books.html  /perfume.html'  -ForegroundColor White
Write-Host '    /insurance.html  /documents.html  /wardrobe.html  /property.html' -ForegroundColor White
Write-Host ''
Write-Host '  Cards remember your last view choice per module via localStorage.' -ForegroundColor White
Write-Host '  Card view now: keyboard accessible, photo-fallback resilient,' -ForegroundColor White
Write-Host '  per-record error tolerant, family-data lazy-loaded.' -ForegroundColor White
Write-Host ''
Read-Host 'Press Enter to close'
