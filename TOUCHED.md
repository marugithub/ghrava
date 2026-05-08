# TOUCHED — v202604.148

Files modified in this drop. **Every entry is suspect until Al confirms
"tested, works."** This file replaces itself on each drop; the
running record across all drops lives in STATE.md under "✋ DON'T
TRUST WITHOUT RETEST."

---

## app/public/medical_v2.html

Three feature additions (EOB drill-down modal, "All" cross-card tab,
device family scope wiring) plus minor structural changes to support
them. Only one existing function (`_eobShowDetail`) was rewritten;
everything else is purely additive.

**Existing function modified:**
- `_eobShowDetail(id)` — was alert(stripped HTML). Now opens a
  centered Vellum modal with header / claims+services / footer
  sections. Reads from GET /medical/eob/:id.
- `switchView(view, btn)` — added 'all_medical' to the
  patientStrip-hide condition; now calls
  `window.initMedLensForView(view)` before `renderCurrentView()`.
- `renderCurrentView()` — added 'all_medical' dispatch to
  `renderAllMedical()`.
- `initMedLens(view)` (inside `_medBoot`) — added 'all_medical' →
  'medical_all' and 'eob' → 'medical_eob' branches; exposed as
  `window.initMedLensForView`.
- `renderEobCard(s)` — both `#eob-{id}` hash links replaced with
  `_eobShowDetail(${s.id})`.

**HTML markup:**
- New `<button>` "All" added to v2-tabs row, calls
  `switchView('all_medical', this)`. Positioned between EOB and
  Summary.

**New top-level functions (appended near end of script):**
- `renderAllMedical()` — async; fetches meds + conditions + visits +
  EOBs in parallel, applies window._medFilters
  (person/tag/name/time), renders sections with renderMedCard /
  renderConditionCard / renderVisitCard / renderEobCard.
- IIFE `_wireMedicalScope()` — listens for `gh-scope-changed`
  events, applies scope.id as `window._medFilters.person`. On
  DOMContentLoaded (with 500ms defer), checks current scope and
  applies if no person filter is active.

---

## app/public/js/lens-config.js

**One additive change:**
- New `medical_all` module under LENS_CONFIG, with dimensions:
  person, name (text), time, tag. `personPrimary: true`.

No existing module changed.

---

## app/shared/autoTodos.js

**One additive change:**
- New rule 7b (between med_discontinued and vehicle_service_due):
  `med_visit_upcoming`. Selects med_visit_notes WHERE visit_date >
  today, joins contacts via `physician_contact_id` or `contact_id`
  for provider name. Upserts a todo with title containing visit_type
  + provider, due_date = visit_date, priority=medium,
  category=Medical. Auto-resolves when visit_date passes or row
  deleted.
- Doc comment block at top of file updated with the new auto-todo
  type.

No existing rule changed.

---

## app/version.txt

Bumped from 202604.147 to 202604.148.

---

## TEST PLAN (when Al is ready)

In rough priority order:

1. **EOB modal** — Open Medical → EOB tab → click an EOB card.
   Modal should show patient names, claims with services, balances.
   Esc / click backdrop / Close button all dismiss.
2. **Med visit upcoming todo** — Add a med visit dated 7 days out.
   Visit Todos page; should see auto-todo "Visit — {provider}" due
   on that date, category Medical. Move the visit's date to
   yesterday → todo should disappear (auto-resolved on next GET).
3. **All tab** — Open Medical → click "All" tab. Should see
   sections for Visits / Meds / Conditions / EOBs (any with rows).
   Lens shows medical_all dimensions: person, name, time, tag.
   Type a person pill → all four sections filter. Clear pill →
   restore.
4. **Family scope** — Set device scope via the nav.js scope pill.
   Reload medical page; person filter should auto-apply on first
   render. Change scope → page re-renders. Clear scope → filter
   removed.

If any of these fail, the relevant function lives in the file map
above.
