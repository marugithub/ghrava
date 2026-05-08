# TOUCHED — v202604.149

Files modified or added in this drop. **Every entry is suspect until
Al confirms "tested, works."** Replaced on each drop; the running
record across drops is in STATE.md "✋ DON'T TRUST WITHOUT RETEST."

---

## NEW: app/db/migrations/125_med_visit_conditions.js

Creates `med_visit_conditions(visit_id, condition_id)` junction
table with composite PK and two indexes (one each direction).
Idempotent, additive only, no FKs.

---

## app/features/medical/routes.js

**GET /notes** — added joins:
- `family_member_name` from family_members (was MISSING; primary
  cause of SE/Self bug for visits)
- `attachment_count` (paperclip badge)
- `linked_conditions: [{id, name}]` per visit (from new junction)

**POST /notes** — also writes `linked_condition_ids` array body
field into the junction (insert-only on POST, replace-set on PUT).

**PUT /notes** — replace-set on `linked_condition_ids`. Sending an
empty array wipes all links; omitting the field leaves them alone.

**DELETE /notes/:id** — clears junction rows for that visit
(no CASCADE).

**DELETE /conditions/:id** — clears junction rows pointing at that
condition (no CASCADE).

**GET /medications, /conditions, /eob** — added `attachment_count`
subselect (entity_type strings: med_medication, med_condition,
med_eob_statement; visit uses `med_visit`).

**GET /eob** — added `family_member_ids` array per statement
(DISTINCT non-null from claims) so the All-tab person filter can
narrow EOBs by member-id directly.

---

## app/public/medical.html

### SE/Self bug fix
- New helper `_currentMemberId()` resolves the active patient strip
  selection (a display_name string) to a family member id.
- Three drawer-open paths (`openMedDrawer`, `openCondDrawer`,
  `openNoteDrawer`) pre-fill `GH_FAMILY.init` with that member id
  when adding new (no record id).
- Three save handlers (`saveMedication`, `saveCondition`, `saveNote`)
  no longer write the literal string `'Self'` — they write `null`.
- Three card renderers (`renderMedCard`, `renderConditionCard`,
  `renderVisitCard`) compute `memberName` only from real family
  links. Stale `patient = 'Self'` rows render avatar-less.

### Default tab + structural
- `currentView = 'all_medical'` (was `'medications'`).
- All tab moved to first position in the tab row, marked active.
- `_medBoot` calls `renderCurrentView()` instead of forcing
  `renderMedications()`.
- `renderAllMedical()` rewritten:
  - One flat sortable list (no per-domain sections).
  - Sort newest first by per-domain date (visit_date,
    statement_date, latest_metric.recorded_at | start_date,
    start_date | created_at).
  - EOB person filter uses new `family_member_ids` rollup;
    substring fallback retained for old API shape.
  - Renders into `.medv5-grid.medv5-grid--all`.

### Mobile swipe-snap
- New CSS class `.medv5-grid--all` (desktop unchanged from
  `.medv5-grid`).
- @media ≤700px: flex row, x-overflow auto, scroll-snap-type
  x mandatory, hidden scrollbar. Cards sized to viewport width
  minus 28px, snap-align center, snap-stop always.

### Visit form: linked-conditions chip picker
- New `<div id="nLinkedConditions">` field after Reason.
- New helpers `_renderLinkedCondsPicker` (loads conditions for the
  active patient, renders chips, wires click toggles) and
  `_readLinkedCondIds` (reads back into a number array at save time).
- `openNoteDrawer` calls `_renderLinkedCondsPicker` with initial ids
  from `r.linked_conditions` (when editing) or `[]` (when adding).
- `saveNote` body includes `linked_condition_ids: _readLinkedCondIds()`.

### Visit card: linked-condition tag chips
- `renderVisitCard` builds `condChips` from `v.linked_conditions`
  array, displays them as purple tag chips alongside the
  visit-type chip.
- Tag-row visibility now triggered by either `typeChip` OR
  `condChips` (was: only typeChip).

---

## app/version.txt

Bumped 202604.148 → 202604.149.

---

## NOT MODIFIED (carried over from v.148)

- `app/shared/autoTodos.js` — rule 7b for upcoming visits still ships.
- `app/public/js/lens-config.js` — `medical_all` module still ships.

These two are in the zip because robocopy `/E` only writes what's in
the source — anything not in the zip is implicitly "use whatever's
already on disk." But since v.148 added these and you haven't deployed
v.148 to a fresh container, including them keeps the zip
self-sufficient.

---

## TEST PLAN (for Al)

**P0 — does the page load at all?**
1. Visit `/medical.html`. Should land on the All tab automatically.
2. Cards should appear (your existing condition + anything else),
   sorted newest first, no section labels.

**P1 — SE/Self bug**
3. Click your name in the patient strip (or pick a person via the
   nav scope pill). Click "Add condition." The family widget at the
   top of the drawer should already have your name as a pill — you
   should NOT have to pick it again.
4. Fill the form, save. New condition card should show your name in
   the avatar label, NOT "SE."
5. Edit an OLD condition that previously showed "SE." It will still
   show "SE" because the old DB row has `patient='Self'` —
   re-pick yourself in the family widget and save to fix.

**P2 — Visit ↔ condition links**
6. Open Visits tab. Add a visit with date today. In the new "For
   which conditions?" field, click your hypertension chip (or
   whatever condition you have).
7. Save. Visit card should show that condition as a purple chip.
8. Edit the visit, unclick the chip, save. Chip should disappear.

**P3 — Mobile**
9. On a phone, the All tab should be a horizontal swipe, one card
   per screen, snapping to the next card. Don't use devtools mobile
   mode for this — actual phone.

**P4 — Auto-todo (carried from v.148)**
10. Upcoming visit dated tomorrow should appear in /todos.html as
    "{visit_type} — {provider}" due tomorrow, category Medical.

**P5 — Counts on cards**
11. Cards with attachments should show a paperclip badge and count.
    Cards without should show no badge.

If any test fails, the relevant function is named in TOUCHED.md
above; STATE.md file map says which file owns it.
