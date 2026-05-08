# TOUCHED — v202604.148

Files modified or added in this drop. **Every entry is suspect until
Al confirms "tested, works."** This file replaces itself on each drop;
the running record across all drops lives in STATE.md under
"✋ DON'T TRUST WITHOUT RETEST."

---

## app/public/medical.html — REPLACED

Wholesale page replacement. The old `medical.html` (v1, 2505 lines)
is gone; this new `medical.html` is the former `medical_v2.html`
contents (4985 lines including v.148 features) renamed.

**Visible cleanup:** "v2 preview" pill in the header was removed —
this page is no longer a preview. CSS comment about token inheritance
updated from "medical_v2.html's plain-name tokens" to "medical.html's".

**Existing behavior preserved (not changed by this drop):** all v2
card renderers (renderMedCard / renderConditionCard / renderVisitCard
/ renderEobCard), all CRUD drawers (medication, condition, note),
attachment manager, EOB import + folder watcher integration, summary
view, family/contact quick-view modals, condition metric
add/edit/delete, dose-change tracking, dedup-resolution flow,
pending-review banner, drug FDA lookup, daily-log seed handling,
keyboard shortcuts, sched panel, status banner, refill UI buttons.

**v.148 changes within this file** (all from prior session work):
- `_eobShowDetail(id)` rewritten as Vellum modal hitting GET
  /medical/eob/:id (was: alert with stripped HTML).
- `renderEobCard()` — both `#eob-{id}` hash-link click handlers
  replaced with `_eobShowDetail(${s.id})` calls.
- New `<button>` for "All" tab in v2-tabs row, between EOB and Summary.
- `switchView(view, btn)` — added 'all_medical' to patient-strip-hide
  condition; calls `window.initMedLensForView(view)` before render.
- `renderCurrentView()` — added 'all_medical' dispatch to
  `renderAllMedical()`.
- `initMedLens(view)` (inside `_medBoot`) — added 'all_medical' →
  'medical_all' and 'eob' → 'medical_eob' branches; exposed as
  `window.initMedLensForView`.
- New top-level `renderAllMedical()` — fetches meds + conditions +
  visits + EOBs in parallel, applies `window._medFilters`
  (person/tag/name/time), renders sections.
- New IIFE `_wireMedicalScope` — listens for `gh-scope-changed`,
  applies scope.id as window._medFilters.person; on
  DOMContentLoaded with 500ms defer, applies any existing scope.

**Lost (deliberately, per Al):** v1's `openRefillModal` /
`saveRefill` / `openLinkReceiptModal` / `confirmLinkReceipt`. v2's
stub functions handle the calls (refill button → edit drawer; link
receipt → no-op).

---

## app/public/_card_previews.html

**Two reference updates:**
- Back-link `href="/medical_v2.html"` → `href="/medical.html"`
- CSS comment "Inherit medical_v2.html's plain-name tokens" → "Inherit
  medical.html's plain-name tokens"

No code or behavior change.

---

## app/public/js/lens-config.js

**One additive change:**
- New `medical_all` module under LENS_CONFIG with dimensions
  person/name/time/tag, `personPrimary: true`.

No existing module changed.

---

## app/shared/autoTodos.js

**One additive change:**
- New rule 7b (between med_discontinued and vehicle_service_due):
  `med_visit_upcoming`. Selects med_visit_notes WHERE visit_date >
  today, joins contacts via `physician_contact_id` or `contact_id`
  for provider name. Upserts a todo: title "{visit_type} — {provider}"
  or "{visit_type} for {patient}", due_date = visit_date,
  priority=medium, category=Medical. Auto-resolves on date pass or
  row delete.
- Doc comment block at top updated with the new auto-todo type.

No existing rule changed.

---

## app/version.txt

Bumped from 202604.147 to 202604.148.

---

## NOT IN THIS ZIP

- `medical_v2.html` is GONE from source. The live NAS will still have
  it from prior deploys — clean it up by hand if desired:
  `Remove-Item Z:\ghrava\app\public\medical_v2.html`
- All other unchanged files (nav.js, shared.css, all other modules,
  routes, migrations, etc.) — robocopy /E does NOT delete files, so
  everything else on the NAS stays exactly as it is.

---

## TEST PLAN (when Al is ready)

In rough priority order:

1. **`/medical.html` loads at all** — open the URL, page renders without
   errors. If you see a 404 or blank page, that's the canonical bug to
   debug first.

2. **All tabs render** — click through Meds, Conditions, Visits, H&W,
   EOB, All, Summary. Each should show data or an empty state.
   - Specifically the "All" tab should show every domain that has rows,
     with the section labels Visits/Medications/Conditions/EOBs.

3. **EOB modal** — go to EOB tab, click any imported statement card.
   Modal should show patient + claims + services + balances. Esc /
   backdrop / Close all dismiss.

4. **Med visit auto-todo** — add a med visit dated 7 days out. Visit
   /todos.html; should see auto-todo "{visit_type} — {provider}" due
   on that date, category Medical. Move the visit's date to yesterday
   → todo should disappear on next /todos.html load.

5. **Family scope** — click the scope pill in the page header (top
   right area, near search/notif icons). Pick a family member.
   Medical page should re-render with that person's records only.
   Clear scope → restore.

6. **CRUD smoke** — create a medication, edit it, delete it. Same for
   a condition and a visit note. Drawer-form-save flow.

7. **Drugs that v1 had but v2 lost:** the "Record Refill" button on
   med cards now opens the edit drawer (stub behavior), and "Link
   Receipt" does nothing. Both are documented in STATE.md as accepted
   losses.

If any of these fail, the relevant function lives in the file map
in STATE.md.
