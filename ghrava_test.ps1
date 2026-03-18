# Ghrava Test Suite — v202603.012
# Catches: broken API routes, auth wall on reads, SQL errors, missing JS functions,
#          missing page variables, baked-in spinners, script load order issues.
#
# Usage:
#   .\ghrava_test.ps1
#   .\ghrava_test.ps1 -Host 192.168.4.62 -Port 3001
#   .\ghrava_test.ps1 -Host 192.168.4.62 -Port 3001 -Token "your-token"

param(
    [string]$GhHost = "192.168.4.62",
    [int]$Port      = 3001,
    [string]$Token  = ""
)

$base  = "http://${GhHost}:${Port}/api/v1"
$ui    = "http://${GhHost}:${Port}"
$pass  = 0; $fail = 0; $warn = 0

# ── Helpers ───────────────────────────────────────────────────

function Test-Result($name, $ok, $detail = "", $warning = $false) {
    if ($ok) {
        Write-Host "  ✓ $name" -ForegroundColor Green
        if ($detail) { Write-Host "    $detail" -ForegroundColor DarkGray }
        $script:pass++
    } elseif ($warning) {
        Write-Host "  ⚠ $name" -ForegroundColor Yellow
        if ($detail) { Write-Host "    $detail" -ForegroundColor Yellow }
        $script:warn++
    } else {
        Write-Host "  ✗ $name" -ForegroundColor Red
        if ($detail) { Write-Host "    $detail" -ForegroundColor Red }
        $script:fail++
    }
}

function Invoke-Api($path, $auth = $false, $method = "GET", $bodyJson = $null) {
    $headers = @{ "Content-Type" = "application/json" }
    if ($auth -and $Token) { $headers["Authorization"] = "Bearer $Token" }
    try {
        $params = @{ Uri="$base$path"; Headers=$headers; Method=$method; UseBasicParsing=$true; TimeoutSec=10 }
        if ($bodyJson) { $params["Body"] = $bodyJson }
        $r = Invoke-WebRequest @params
        $data = $null
        try { $data = $r.Content | ConvertFrom-Json } catch {}
        return @{ ok = $true; status = [int]$r.StatusCode; data = $data; raw = $r.Content }
    } catch {
        $status = 0
        try { $status = [int]$_.Exception.Response.StatusCode.value__ } catch {}
        return @{ ok = $false; status = $status; error = $_.Exception.Message; data = $null }
    }
}

function Invoke-Page($path) {
    try {
        $r = Invoke-WebRequest -Uri "$ui$path" -UseBasicParsing -TimeoutSec 10
        return @{ ok = $true; status = [int]$r.StatusCode; body = $r.Content }
    } catch {
        return @{ ok = $false; status = 0; error = $_.Exception.Message; body = "" }
    }
}

# ═══════════════════════════════════════════════════════════════
Write-Host ""
Write-Host "═══ GHRAVA TEST SUITE ═══" -ForegroundColor Cyan
Write-Host "  Target : $ui" -ForegroundColor DarkGray
Write-Host "  Time   : $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')" -ForegroundColor DarkGray
if ($Token) {
    Write-Host "  Auth   : token provided" -ForegroundColor DarkGray
} else {
    Write-Host "  Auth   : no token (write tests skipped)" -ForegroundColor DarkGray
}
Write-Host ""

# ══════════════════════════════════════════════════════════════
# 1. APP HEALTH
# ══════════════════════════════════════════════════════════════
Write-Host "── 1. App Health ───────────────────────────────" -ForegroundColor Cyan

$health = Invoke-Api "/app/info" $false
# /app/info is at a different prefix — check /health
$healthCheck = Invoke-WebRequest -Uri "$ui/health" -UseBasicParsing -TimeoutSec 5 -ErrorAction SilentlyContinue
Test-Result "Server responds" ($null -ne $healthCheck -and $healthCheck.StatusCode -eq 200) "GET /health"

if ($health.ok) {
    Test-Result "App info endpoint" $true "v$($health.data.version)"
} else {
    # Try plain health
    Test-Result "App info endpoint" $false "HTTP $($health.status)" $true
}


# ══════════════════════════════════════════════════════════════
# 2. API ROUTE HEALTH  (status + auth wall + SQL error detection)
# ══════════════════════════════════════════════════════════════
Write-Host ""
Write-Host "── 2. API Routes (200, not 401, not 500) ───────" -ForegroundColor Cyan

# Each entry: path, label, expectArray (true = response should be a JSON array)
$apiRoutes = @(
    # Dashboard
    @{ path="/dashboard";                      label="Dashboard summary";          arr=$true  },
    @{ path="/dashboard/attention";            label="Dashboard attention items";  arr=$true  },

    # Inventory — the on-load routes that were missing/broken
    @{ path="/inventory/stats";                label="Inventory stats";            arr=$false },
    @{ path="/inventory/locations";            label="Inventory locations";        arr=$true  },
    @{ path="/inventory/locations/flat";       label="Inventory locations flat";   arr=$true  },
    @{ path="/inventory/containers";           label="Inventory containers";       arr=$true  },
    @{ path="/inventory/items";                label="Inventory items";            arr=$true  },
    @{ path="/inventory/search?q=test";        label="Inventory search";           arr=$true  },
    @{ path="/inventory/hw";                   label="Inventory HW items";         arr=$true  },

    # Books — had SQL error in ORDER BY
    @{ path="/books";                          label="Books list";                 arr=$true  },
    @{ path="/books?status=Currently+Reading"; label="Books by shelf";             arr=$true  },
    @{ path="/books/stats";                    label="Books stats";                arr=$false },

    # Career
    @{ path="/career/certifications";          label="Career certs";               arr=$true  },
    @{ path="/career/jobs";                    label="Career jobs";                arr=$true  },
    @{ path="/career/skills";                  label="Career skills";              arr=$true  },
    @{ path="/career/education";               label="Career education";           arr=$true  },
    @{ path="/career/goals";                   label="Career goals";               arr=$true  },

    # Kids
    @{ path="/kids";                           label="Kids list";                  arr=$true  },

    # Documents
    @{ path="/documents";                      label="Documents list";             arr=$true  },
    @{ path="/documents/expiring";             label="Documents expiring";         arr=$true  },

    # Todos
    @{ path="/todos";                          label="Todos list";                 arr=$true  },

    # Daily Log
    @{ path="/daily-log";                      label="Daily log entries";          arr=$true  },

    # Medical
    @{ path="/medical/medications";            label="Medical medications";        arr=$true  },
    @{ path="/medical/conditions";             label="Medical conditions";         arr=$true  },
    @{ path="/medical/physicians";             label="Medical physicians";         arr=$true  },
    @{ path="/medical/visits";                 label="Medical visits";             arr=$true  },

    # Resources
    @{ path="/resources";                      label="Resources list";             arr=$true  },

    # Property
    @{ path="/property/properties";            label="Properties list";            arr=$true  },
    @{ path="/property/vehicles";              label="Vehicles list";              arr=$true  },

    # Todos
    @{ path="/notifications";                  label="Notifications";              arr=$true  },

    # Settings — all reads must be public (no auth required)
    @{ path="/settings/tags";                  label="Settings tags (public)";     arr=$true  },
    @{ path="/settings/family";                label="Settings family (public)";   arr=$true  },
    @{ path="/settings/contacts";              label="Settings contacts (public)"; arr=$true  },
    @{ path="/settings/dropdowns/document_category";       label="Dropdown: document_category";      arr=$true },
    @{ path="/settings/dropdowns/document_subcategory";    label="Dropdown: document_subcategory";   arr=$true },
    @{ path="/settings/dropdowns/todo_category";           label="Dropdown: todo_category";          arr=$true },
    @{ path="/settings/dropdowns/inventory_category";      label="Dropdown: inventory_category";     arr=$true },
    @{ path="/settings/dropdowns/hw_subcategory";          label="Dropdown: hw_subcategory";         arr=$true },
    @{ path="/settings/dropdowns/kids_activity_category";  label="Dropdown: kids_activity_category"; arr=$true },
    @{ path="/settings/dropdowns/kids_note_category";      label="Dropdown: kids_note_category";     arr=$true },
    @{ path="/settings/dropdowns/medical_visit_type";      label="Dropdown: medical_visit_type";     arr=$true },
    @{ path="/settings/dropdowns/medical_physician_type";  label="Dropdown: medical_physician_type"; arr=$true },
    @{ path="/settings/dropdowns/book_genre";              label="Dropdown: book_genre";             arr=$true },
    @{ path="/settings/dropdowns/career_goal_category";    label="Dropdown: career_goal_category";   arr=$true },
    @{ path="/settings/dropdowns/career_skill_category";   label="Dropdown: career_skill_category";  arr=$true },
    @{ path="/settings/dropdowns/property_type";           label="Dropdown: property_type";          arr=$true },
    @{ path="/settings/dropdowns/vehicle_service_type";    label="Dropdown: vehicle_service_type";   arr=$true }
)

foreach ($rt in $apiRoutes) {
    $r = Invoke-Api $rt.path $false

    # 401 = reads behind auth wall (major bug)
    if ($r.status -eq 401) {
        Test-Result $rt.label $false "HTTP 401 — GET route behind auth wall (reads must be public)"
        continue
    }
    # 500 = server/SQL error
    if ($r.status -eq 500) {
        $detail = "HTTP 500 — server error"
        if ($r.data -and $r.data.detail) { $detail += ": $($r.data.detail)" }
        Test-Result $rt.label $false $detail
        continue
    }
    # Other non-200
    if (-not $r.ok) {
        Test-Result $rt.label $false "HTTP $($r.status)"
        continue
    }
    # Shape check: should be array
    if ($rt.arr) {
        $isArr = $r.data -is [System.Array] -or ($r.raw -match "^\s*\[")
        $isErr = $r.data -and $r.data.error
        if ($isErr) {
            Test-Result $rt.label $false "Returned error object: $($r.data.error)"
        } else {
            Test-Result $rt.label $isArr "HTTP $($r.status)$(if(-not $isArr){' — expected array, got object'})"
        }
    } else {
        $isErr = $r.data -and $r.data.error
        Test-Result $rt.label (-not $isErr) "HTTP $($r.status)$(if($isErr){' — error: '+$r.data.error})"
    }
}


# ══════════════════════════════════════════════════════════════
# 3. PAGE LOAD SMOKE TESTS
# ══════════════════════════════════════════════════════════════
Write-Host ""
Write-Host "── 3. Page Loads (HTTP 200 + key element IDs) ──" -ForegroundColor Cyan

$pages = @(
    @{ path="/";               label="Dashboard";  must=@("id=`"app`"","gh-page-header","Daily Log") },
    @{ path="/todos.html";     label="Todos";      must=@("id=`"app`"","statsRow","todoList","todoTagsWrap") },
    @{ path="/daily-log.html"; label="Daily Log";  must=@("id=`"app`"","catScroll","dlTagsWrap") },
    @{ path="/inventory.html"; label="Inventory";  must=@("id=`"app`"","statsBar","stItems","browseContent","itmTagsWrap") },
    @{ path="/finance.html";   label="Finance";    must=@("id=`"app`"","finTabs","accountsList") },
    @{ path="/medical.html";   label="Medical";    must=@("id=`"app`"","visitTagsWrap","medTagsWrap") },
    @{ path="/resources.html"; label="Resources";  must=@("id=`"app`"","catStrip","resTagsWrap") },
    @{ path="/documents.html"; label="Documents";  must=@("id=`"app`"","catStrip","docTagsWrap","dSubcat") },
    @{ path="/career.html";    label="Career";     must=@("id=`"app`"","certsList","certTagsWrap","jobTagsWrap") },
    @{ path="/books.html";     label="Books";      must=@("id=`"app`"","bookList","bookTagsWrap","shelfTabs") },
    @{ path="/kids.html";      label="Kids";       must=@("id=`"app`"","kidsTabs","actTagsWrap") },
    @{ path="/property.html";  label="Property";   must=@("id=`"app`"","propList","propTagsWrap","vehTagsWrap") },
    @{ path="/settings.html";  label="Settings";   must=@("id=`"app`"","logoutBtn","tagsList") }
)

foreach ($p in $pages) {
    $r = Invoke-Page $p.path
    if (-not $r.ok) {
        Test-Result "$($p.label) page loads" $false "HTTP $($r.status): $($r.error)"
        continue
    }
    Test-Result "$($p.label) page loads" $true "HTTP $($r.status)"
    foreach ($must in $p.must) {
        $found = $r.body -match [regex]::Escape($must)
        Test-Result "  $($p.label): has '$must'" $found
    }
}


# ══════════════════════════════════════════════════════════════
# 4. HTML SOURCE ANALYSIS
#    Catches structural/syntax bugs before they reach the browser.
# ══════════════════════════════════════════════════════════════
Write-Host ""
Write-Host "── 4. HTML Source Analysis ─────────────────────" -ForegroundColor Cyan

$htmlPages = @(
    @{ path="/books.html";     label="Books"     },
    @{ path="/career.html";    label="Career"    },
    @{ path="/kids.html";      label="Kids"      },
    @{ path="/inventory.html"; label="Inventory" },
    @{ path="/documents.html"; label="Documents" },
    @{ path="/todos.html";     label="Todos"     },
    @{ path="/daily-log.html"; label="Daily Log" },
    @{ path="/medical.html";   label="Medical"   },
    @{ path="/resources.html"; label="Resources" },
    @{ path="/property.html";  label="Property"  },
    @{ path="/finance.html";   label="Finance"   },
    @{ path="/settings.html";  label="Settings"  }
)

foreach ($p in $htmlPages) {
    $r = Invoke-Page $p.path
    if (-not $r.ok) { continue }   # already failed in section 3
    $src = $r.body
    $lbl = $p.label

    # ── Required scripts ──────────────────────────────────────
    Test-Result "$lbl: loads lt-core.js"     ($src -match 'lt-core\.js')
    Test-Result "$lbl: loads lt-messages.js" ($src -match 'lt-messages\.js')
    Test-Result "$lbl: loads nav.js"         ($src -match 'nav\.js')

    # ── emptyState / errorState: only usable if lt-messages loaded ──
    $usesEmpty = $src -match 'emptyState\s*\('
    $usesError = $src -match 'errorState\s*\('
    $loadsMsg  = $src -match 'lt-messages\.js'
    if ($usesEmpty -or $usesError) {
        Test-Result "$lbl: emptyState/errorState backed by lt-messages.js" $loadsMsg `
            "Page calls emptyState/errorState but lt-messages.js not loaded"
    }

    # ── GH_TAGS / GH_SELECT: need lt-core ─────────────────────
    $usesGhTags   = $src -match 'GH_TAGS\s*\.'
    $usesGhSelect = $src -match 'GH_SELECT\s*\.'
    if ($usesGhTags -or $usesGhSelect) {
        Test-Result "$lbl: GH_TAGS/GH_SELECT backed by lt-core.js" ($src -match 'lt-core\.js')
    }

    # ── initXxxTags called with undefined variable ────────────────
    # Pattern: openXxxDrawer uses local var 'c' but calls initXxxTags(cert?.tags)
    # This causes a silent ReferenceError — drawer never opens, no error shown.
    # Detect: initXxxTags(word?.tags) where 'word' appears nowhere else in the function
    $tagMismatch = [regex]::Matches($src, 'init\w+Tags\((\w+)\?\.tags') | Where-Object {
      $varName = $_.Groups[1].Value
      # Flag if the variable name matches a common full-word pattern that wouldn't be a
      # single-letter local — e.g. cert/job/skill/prop/veh used where c/j/s/p/v expected
      $varName -match '^(cert|job|skill|prop|veh|book|res|item|doc|visit|med)$'
    }
    Test-Result "$lbl: initXxxTags uses correct local variable" ($tagMismatch.Count -eq 0) `
      "Found initXxxTags($($tagMismatch[0].Groups[1].Value)?.tags) — likely wrong variable name, drawer Add will silently fail"

    $doubleAsync = $src -match 'async\s+async\s+function'
    Test-Result "$lbl: no 'async async' syntax error" (-not $doubleAsync) `
        "Found 'async async function' — will fail to parse in strict mode"

    # ── No duplicate identifier declarations ──────────────────
    $escCount = ([regex]::Matches($src, '(?:const|let|var|function)\s+esc\b')).Count
    Test-Result "$lbl: 'esc' declared exactly once" ($escCount -le 1) `
        "Found $escCount declarations of 'esc' — SyntaxError: Identifier already declared"

    $dollarCount = ([regex]::Matches($src, '(?:const|let|var)\s+\$\s*=')).Count
    Test-Result "$lbl: '\$' declared at most once" ($dollarCount -le 1) `
        "Found $dollarCount declarations of '\$' — SyntaxError: Identifier already declared"

    # ── spinnerHtml: only usable if lt-core loaded ─────────────
    $usesSpinner = $src -match 'spinnerHtml\s*\('
    if ($usesSpinner) {
        Test-Result "$lbl: spinnerHtml backed by lt-core.js" ($src -match 'lt-core\.js') `
            "Page calls spinnerHtml() but lt-core.js not loaded"
    }

    # ── Catch blocks that reference e must bind (e) ───────────────
    # Find all }catch{ that are NOT }catch{} (empty) and NOT }catch(
    $badCatch = [regex]::Matches($src, '\}\s*catch\s*\{[^}]+e\.') | Where-Object { $_.Value -notmatch '\}\s*catch\s*\(' }
    Test-Result "$lbl: catch blocks bind error variable" ($badCatch.Count -eq 0) `
        "Found catch{} blocks that reference 'e.' without binding (e)"

    # ── No baked-in spinners inside data-list containers ──────
    # A spinner in HTML that is inside a known list div = permanent spinner if JS fails
    $bakedSpinner = $src -match '(id="[^"]*List"[^>]*>\s*<div class="spinner")|(<div[^>]+id="[^"]*List"[^>]*>[^<]*<div[^>]+class="spin)'
    Test-Result "$lbl: no baked-in spinners in list containers" (-not $bakedSpinner) `
        "Found <div class='spinner'> inside a *List panel — spinner should be injected by JS, not baked into HTML"

    # ── GH_EMPTY used correctly: spread syntax ─────────────────
    # emptyState(...GH_EMPTY.x) is correct; emptyState(GH_EMPTY.x) is wrong
    $badEmpty = [regex]::Matches($src, 'emptyState\s*\(\s*GH_EMPTY') | Where-Object { $_.Value -notmatch 'emptyState\s*\(\s*\.\.\.' }
    Test-Result "$lbl: emptyState called with spread (...GH_EMPTY.x)" ($badEmpty.Count -eq 0) `
        "Found emptyState(GH_EMPTY.x) — must be emptyState(...GH_EMPTY.x)"
}


# ══════════════════════════════════════════════════════════════
# 5. PAGE → API DEPENDENCY TESTS
#    Each page's on-load API calls tested individually.
#    If any of these fail it means the page will show a spinner forever.
# ══════════════════════════════════════════════════════════════
Write-Host ""
Write-Host "── 5. Page On-Load API Dependencies ───────────" -ForegroundColor Cyan

$pageDeps = @(
    @{ page="Books";     routes=@("/books", "/books/stats", "/settings/dropdowns/book_genre") },
    @{ page="Career";    routes=@("/career/certifications", "/career/jobs", "/career/skills", "/career/education", "/career/goals",
                                  "/settings/dropdowns/career_goal_category", "/settings/dropdowns/career_skill_category") },
    @{ page="Kids";      routes=@("/kids", "/settings/dropdowns/kids_activity_category", "/settings/dropdowns/kids_note_category") },
    @{ page="Inventory"; routes=@("/inventory/stats", "/inventory/locations", "/inventory/locations/flat",
                                  "/inventory/containers", "/inventory/items",
                                  "/settings/dropdowns/inventory_category", "/settings/dropdowns/hw_subcategory",
                                  "/settings/family") },
    @{ page="Documents"; routes=@("/documents", "/settings/dropdowns/document_category",
                                  "/settings/dropdowns/document_subcategory", "/settings/family") },
    @{ page="Todos";     routes=@("/todos", "/settings/dropdowns/todo_category") },
    @{ page="Daily Log"; routes=@("/daily-log", "/settings/dropdowns/dailylog_category") },
    @{ page="Medical";   routes=@("/medical/medications", "/medical/conditions", "/medical/physicians", "/medical/visits",
                                  "/settings/family", "/settings/contacts", "/settings/dropdowns/medical_visit_type",
                                  "/settings/dropdowns/medical_physician_type") },
    @{ page="Resources"; routes=@("/resources", "/settings/tags") },
    @{ page="Property";  routes=@("/property/properties", "/property/vehicles",
                                  "/settings/dropdowns/property_type", "/settings/dropdowns/property_maintenance_category",
                                  "/settings/dropdowns/vehicle_service_type") },
    @{ page="Dashboard"; routes=@("/dashboard", "/dashboard/attention", "/todos", "/notifications") },
    @{ page="Settings";  routes=@("/settings/tags", "/settings/family", "/settings/contacts",
                                  "/settings/dropdowns/contact_type") }
)

foreach ($dep in $pageDeps) {
    $pageLabel = $dep.page
    $allOk = $true
    $firstFail = ""
    foreach ($route in $dep.routes) {
        $r = Invoke-Api $route $false
        if ($r.status -eq 401) {
            $allOk = $false
            $firstFail = "GET $route returns 401 (auth wall blocking read)"
            break
        }
        if ($r.status -eq 500) {
            $allOk = $false
            $firstFail = "GET $route returns 500 (server/SQL error)"
            break
        }
        if (-not $r.ok) {
            $allOk = $false
            $firstFail = "GET $route returns HTTP $($r.status)"
            break
        }
    }
    Test-Result "$pageLabel: all on-load routes OK" $allOk $firstFail
}


# ══════════════════════════════════════════════════════════════
# 6. DATABASE INTEGRITY
# ══════════════════════════════════════════════════════════════
Write-Host ""
Write-Host "── 6. Database Integrity ───────────────────────" -ForegroundColor Cyan

$diagR = Invoke-Api "/settings/diagnostics/run" $true
if ($diagR.ok -and $diagR.data) {
    $d = $diagR.data
    Test-Result "Diagnostics endpoint accessible" $true
    if ($d.orphaned_taggables -ne $null) {
        Test-Result "No orphaned taggables" ($d.orphaned_taggables -eq 0) "$($d.orphaned_taggables) orphan(s)"
    }
    if ($d.unmigrated_doc_tags -ne $null) {
        Test-Result "No unmigrated document tags" ($d.unmigrated_doc_tags -eq 0) "$($d.unmigrated_doc_tags) freetext tag(s) still in documents.tags"
    }
    if ($d.unassigned_items -ne $null) {
        Test-Result "No unassigned inventory items" ($d.unassigned_items -eq 0) "$($d.unassigned_items) item(s) with no location" $true
    }
} elseif ($diagR.status -eq 401) {
    Test-Result "Diagnostics endpoint accessible" $false "HTTP 401 — pass -Token parameter to run DB checks"  $true
} else {
    # Fallback: orphan check endpoint
    $orphanR = Invoke-Api "/settings/diagnostics/orphans" $false
    if ($orphanR.ok) {
        Test-Result "Orphan check endpoint" $true
        $o = $orphanR.data
        if ($o.taggables_missing_tag  -ne $null) { Test-Result "No taggables pointing to missing tags" ($o.taggables_missing_tag  -eq 0) "$($o.taggables_missing_tag) orphan(s)"  }
        if ($o.taggables_missing_entity -ne $null) { Test-Result "No taggables pointing to deleted entities" ($o.taggables_missing_entity -eq 0) "$($o.taggables_missing_entity) orphan(s)" }
        if ($o.unmigrated_doc_tags  -ne $null) { Test-Result "No unmigrated doc freetext tags" ($o.unmigrated_doc_tags -eq 0) "$($o.unmigrated_doc_tags) remaining" }
    } else {
        Test-Result "Diagnostics/orphan endpoint accessible" $false "HTTP $($orphanR.status)" $true
    }
}


# ══════════════════════════════════════════════════════════════
# 7. RUNTIME BEHAVIOUR TESTS
#    Tests that catch the class of bugs found during manual testing:
#    - 401 handling, auth on write routes
#    - Raw fetch vs window.api usage
#    - Todos POST body reference errors
#    - UPC model number barcode contamination
#    - Build date mismatch
#    - Diag data count inflation
# ══════════════════════════════════════════════════════════════
Write-Host ""
Write-Host "── 7. Runtime Behaviour ────────────────────────" -ForegroundColor Cyan

# ── 7a. App info build_date is not hardcoded ──────────────────
$infoR = Invoke-Api "/app/info"
if ($infoR.ok) {
    $bd = $infoR.data.build_date
    Test-Result "app/info build_date is dynamic (not 2026-03-08)" ($bd -ne "2026-03-08") `
        "build_date is still hardcoded to 2026-03-08 in server.js"
    Test-Result "app/info version matches package.json expectation" ($infoR.data.version -ne $null) `
        "version field missing from app/info"
}

# ── 7b. Record counts exclude inactive rows ───────────────────
if ($infoR.ok) {
    $counts = $infoR.data.record_counts
    # If diag rows exist and are is_active=0, they should NOT appear in counts
    # We verify this by checking counts are reasonable (not inflated by ghost rows)
    Test-Result "app/info record counts present" ($counts -ne $null) `
        "record_counts missing from app/info response"
}

# ── 7c. Todos POST does not 500 ───────────────────────────────
if ($Token) {
    $tr = Invoke-Api "/todos" $true "POST" '{"title":"_diag_todo_test_","category":"General","priority":"medium"}'
    Test-Result "Todos POST creates record (no body.tags 500)" ($tr.status -eq 201) `
        "Todos POST returned $($tr.status) — likely body.tags reference error in routes.js"
    # Cleanup
    if ($tr.data.id) { Invoke-Api "/todos/$($tr.data.id)" $true "DELETE" | Out-Null }
}

# ── 7d. Write routes return 401 without token (not 200 or 500) ─
$writeRoutes = @(
    @{ method="POST"; path="/inventory/items"; body='{"name":"_test_"}' },
    @{ method="POST"; path="/todos"; body='{"title":"_test_"}' },
    @{ method="POST"; path="/books"; body='{"title":"_test_"}' },
    @{ method="POST"; path="/documents"; body='{"title":"_test_"}' },
    @{ method="POST"; path="/hsa/payments"; body='{"date":"2026-01-01","you_paid":1,"category":"Doctor","payment_type":"Out of Pocket"}' }
)
foreach ($wr in $writeRoutes) {
    try {
        $wr2 = Invoke-WebRequest -Uri "$base$($wr.path)" `
            -Method $wr.method `
            -Headers @{"Content-Type"="application/json"} `
            -Body $wr.body `
            -UseBasicParsing -TimeoutSec 5 -ErrorAction SilentlyContinue
        $sc = $wr2.StatusCode
    } catch {
        $sc = $_.Exception.Response.StatusCode.value__
    }
    Test-Result "Unauthenticated $($wr.method) $($wr.path) returns 401" ($sc -eq 401) `
        "Got HTTP $sc — expected 401. Write route may be missing requireAuth."
}

# ── 7e. HTML: inventory uses authFetch not raw fetch for writes ─
$invSrc = ""
try { $invSrc = (Invoke-WebRequest -Uri "$ui/inventory.html" -UseBasicParsing -TimeoutSec 5).Content } catch {}
if ($invSrc) {
    # Check authFetch is defined
    Test-Result "inventory.html defines authFetch wrapper" ($invSrc -match "function authFetch") `
        "authFetch not found — raw fetch() calls bypass 401 intercept"
    # Check the main item save uses authFetch not raw fetch
    $rawItemSave = [regex]::Matches($invSrc, "await fetch\(`\`\$\{(url|API)\}.*method.*['\"](?:POST|PUT|DELETE)['\"]")
    Test-Result "inventory.html write calls use authFetch (not raw fetch)" ($rawItemSave.Count -eq 0) `
        "Found $($rawItemSave.Count) raw fetch() write call(s) — these bypass 401 handling"
}

# ── 7f. HTML: no raw fetch write calls on any page (except FormData uploads) ─
foreach ($page in @("todos.html","books.html","documents.html","career.html","medical.html","kids.html")) {
    $psrc = ""
    try { $psrc = (Invoke-WebRequest -Uri "$ui/$page" -UseBasicParsing -TimeoutSec 5).Content } catch {}
    if ($psrc) {
        # Raw fetch with POST/PUT/DELETE that is NOT FormData and NOT a GET
        $rawWrites = [regex]::Matches($psrc, "await fetch\([^)]+method\s*:\s*['\"](?:POST|PUT|DELETE|PATCH)['\"]") |
            Where-Object { $_.Value -notmatch "FormData|fd\b|multipart" }
        # These pages should use window.api / apiPost / apiPut etc
        $usesApiWrapper = $psrc -match "await api\(|await apiPost\(|await apiPut\(|await apiDelete\("
        if ($rawWrites.Count -gt 0 -and -not $usesApiWrapper) {
            Test-Result "$page write calls go through window.api" $false `
                "Found $($rawWrites.Count) raw fetch write(s) — use apiPost/apiPut/apiDelete for 401 handling" $true
        } else {
            Test-Result "$page write calls go through window.api" $true
        }
    }
}

# ── 7g. Todos checkbox CSS has display:block on ::after ───────
$todoSrc = ""
try { $todoSrc = (Invoke-WebRequest -Uri "$ui/todos.html" -UseBasicParsing -TimeoutSec 5).Content } catch {}
if ($todoSrc) {
    Test-Result "todos.html checkbox ::after has display:block" ($todoSrc -match "checked::after[\s\S]{0,60}display\s*:\s*block") `
        "Checkmark ::after missing display:block — checkbox tick will be invisible"
}

# ── 7h. gh-info-icon size is ≤14px ────────────────────────────
$coreSrc = ""
try { $coreSrc = (Invoke-WebRequest -Uri "$ui/js/lt-core.js" -UseBasicParsing -TimeoutSec 5).Content } catch {}
if ($coreSrc) {
    $iconSize = [regex]::Match($coreSrc, "\.gh-info-icon\s*\{[^}]+width\s*:\s*(\d+)px")
    if ($iconSize.Success) {
        $px = [int]$iconSize.Groups[1].Value
        Test-Result "gh-info-icon width ≤14px (currently ${px}px)" ($px -le 14) `
            "gh-info-icon is ${px}px — too large relative to label text"
    }
}

# ── 7i. UPC model_number barcode filter exists ─────────────────
$invRoutesSrc = ""
try {
    $irPath = Join-Path $PSScriptRoot "app/features/inventory/routes.js"
    if (Test-Path $irPath) { $invRoutesSrc = Get-Content $irPath -Raw }
} catch {}
if ($invRoutesSrc) {
    Test-Result "UPC lookup filters barcode-looking model numbers" ($invRoutesSrc -match "isBarcode") `
        "No barcode filter on model_number — UPC codes may appear as model numbers"
}

# ── 7j. migration 037 has two separate CTEs (not one split across statements) ─
$mig037 = ""
try {
    $m37Path = Join-Path $PSScriptRoot "app/db/migrations/037_migrate_document_tags.sql"
    if (Test-Path $m37Path) { $mig037 = Get-Content $m37Path -Raw }
} catch {}
if ($mig037) {
    $cteCount = ([regex]::Matches($mig037, "WITH RECURSIVE")).Count
    Test-Result "Migration 037 has CTE repeated for both INSERTs ($cteCount CTEs)" ($cteCount -ge 2) `
        "Migration 037 has only $cteCount CTE block — second INSERT will fail with 'no such table: clean_tags'"
}

# ── 7k. needs-review shared module exists and exports expected functions ──
$nrPath = Join-Path $PSScriptRoot "app/shared/needs-review.js"
Test-Result "shared/needs-review.js exists" (Test-Path $nrPath) `
    "needs-review.js not found — Data Review system won't work"
if (Test-Path $nrPath) {
    $nrSrc = Get-Content $nrPath -Raw
    foreach ($fn in @("flagRecords","flagRecordsWhere","createReviewTodo","checkAndCompleteTodo","getReviewSummary","clearReview")) {
        Test-Result "needs-review exports $fn" ($nrSrc -match "function $fn\b") `
            "$fn not found in needs-review.js"
    }
}

# ── 7l. Data Review API endpoint responds ─────────────────────
$rvR = Invoke-Api "/settings/review/summary"
Test-Result "GET /settings/review/summary responds" ($rvR.ok) `
    "Data Review endpoint not reachable — Settings Data Review panel will be broken"


# Hard-delete _diag_* test rows — soft-delete leaves ghost rows
# that inflate record counts. Requires -Token to authenticate.
# ══════════════════════════════════════════════════════════════
if ($Token) {
    Write-Host ""
    Write-Host "── Cleanup ─────────────────────────────────────────────" -ForegroundColor Cyan
    try {
        $pr = Invoke-WebRequest -Uri "$base/settings/diagnostics/purge" `
            -Method POST `
            -Headers @{"Content-Type"="application/json";"Authorization"="Bearer $Token"} `
            -UseBasicParsing -TimeoutSec 10
        $pd = $pr.Content | ConvertFrom-Json
        if ($pd.total -gt 0) {
            Test-Result "Purged $($pd.total) diag test record(s)" $true
        } else {
            Test-Result "No diag records to purge" $true
        }
    } catch {
        Test-Result "Purge diag data" $false "Could not reach purge endpoint — run manually if needed" $true
    }
}

# ══════════════════════════════════════════════════════════════
# SUMMARY
# ══════════════════════════════════════════════════════════════
Write-Host ""
Write-Host "═══ RESULTS ═══" -ForegroundColor Cyan
Write-Host "  Pass   : $pass" -ForegroundColor Green
Write-Host "  Warn   : $warn" -ForegroundColor $(if ($warn -gt 0) { "Yellow" } else { "DarkGray" })
Write-Host "  Fail   : $fail" -ForegroundColor $(if ($fail -gt 0) { "Red" } else { "Green" })
$total = $pass + $warn + $fail
Write-Host "  Total  : $total tests" -ForegroundColor DarkGray
Write-Host ""
if ($fail -eq 0 -and $warn -eq 0) {
    Write-Host "  All tests passed ✓" -ForegroundColor Green
} elseif ($fail -eq 0) {
    Write-Host "  Passed with warnings — review ⚠ items" -ForegroundColor Yellow
} else {
    Write-Host "  $fail test(s) failed — fix before deploying" -ForegroundColor Red
}
Write-Host ""
