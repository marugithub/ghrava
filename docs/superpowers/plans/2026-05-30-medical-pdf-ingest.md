# Medical PDF Ingest — reuse the parser, load into existing `med_*` tables

**Status:** PLANNED — paused 2026-05-30 EOD, resuming next session. Slice 1 not yet started.
**Owner context:** Al wants raw health records (PDF, etc.) to flow **directly into tables**, not via a hand-converted JSON step. v.218 already fixed the JSON loader (`bulk-seed`); this plan adds the conversion front-end that was dropped by a prior chat.

---

## Where the source code lives
- **`Z:\ghrava\medical-input-processor.zip`** (on the NAS, ~40 KB) — the original zip Al uploaded. This is the source of truth. Re-extract to inspect.
- Contents:
  | file | role |
  |---|---|
  | `ingest_index.js` | pipeline entry: `process(filepath, opts)` — detectFileType → extract → detectSource → parse → upsert |
  | `ingest_extractors_parsers.js` | extractors (pdf/html/image/zip), parsers (SamsungHealth / Imaging / LabResult / Prescription), `UpsertAll`, shared utils (date/panel/flag/vitals helpers) |
  | `extract.py` | Python pdfplumber/PIL extractor (we are NOT using this — see decision 1) |
  | `health_seed.json` | Al's already-converted data (this is what `bulk-seed` consumed) |
  | `HEALTH_*.md` | the prior chat's proposed module spec / integration guide (proposes a parallel `health_*` schema — we reject that) |

## Why the prior chat didn't wire it
The zip's `UpsertAll` writes into a **parallel `health_*` table set** (13 new tables: `health_patients`, `health_conditions`, …). That conflicts with Ghrava's "one set of tables" design (the moat is cross-domain links, not siloed dockers). So the prior chat kept only `health_seed.json` + wrote the JSON `bulk-seed` loader into the **existing `med_*` tables**, and discarded the parser. The conversion engine was never integrated.

## The key fit
Each parser returns sections — `{conditions, medications, labs, vitals, diagnostics, allergies, visits}` — that map **almost 1:1** onto the importers in `app/features/medical/seed-routes.js` (which already write into `med_*` with dedup, fixed in v.218). So:

> **Reuse the zip's `extract → detectSource → parse` front-end. Feed the parsed sections into the EXISTING `seed-routes.js` importers. Throw away the zip's `UpsertAll` + the `health_*` schema entirely.**

Parser output field names need a thin mapping layer onto the importer inputs (mostly identical: `name/status/first_noted`, `test_name/value_numeric/unit/test_date`, etc.). `visits` has no `med_*` importer yet (would map to medical notes) — defer or add later.

---

## Decisions locked
1. **PDF text via Node `pdf-parse`, NOT Python `pdfplumber`.** Rationale: `app/features/medical/eob-parser.js` already uses `pdf-parse` (pure Node, no API, already a dependency). The Python path needs `pip install pdfplumber --break-system-packages` baked into the container — extra ops, breaks on image rebuild. Swap the zip's `extractors/pdf.js` (which shells to `extract.py`) for a `pdf-parse` call. (Al: "use pdf parse if its better" — it is.)
2. **Inbox / folder autoload DEFERRED.** Al: the folder + its structure (per-member? naming?) needs to be defined later. Do NOT build a watcher or `health-inbox\` scan now.
3. **Parsers are heuristic + source-specific** (Samsung Health export from Ascension Alabama, specific imaging report formats, Rx bottle labels, generic-lab fallback for `unknown`). NOT a general "any PDF → perfect data" engine. Quality must be verified against a **real source PDF** before trusting writes. Dry-run first, always.

## Open / TODO for next session
- **Slice 1 — `POST /api/v1/medical/ingest`** (multer single-file upload, `requireAuth`):
  pdf-parse (or html/txt extractor) → `detectSource(text)` → parser → thin field-map → existing `seed-routes.js` importers → return `{source, inserted, skipped}` per section. Support `?dry_run=1` to extract+parse+preview WITHOUT writing.
  - Refactor `seed-routes.js`: export the per-section importers so both `bulk-seed` and the new `/ingest` route call them (don't duplicate).
  - Patient mapping: resolve family member same as `bulk-seed` (id or name); default workflow is Algir for now (only member with data).
- **Form field for folder path** (Al's explicit ask): add a "health records folder path" input on one of the medical/health-records forms. Just **save the value** for now (a `user_preferences` / config row) — wiring the actual folder scan comes when the folder structure is defined (decision 2).
- **Verification gate:** Al to drop a real source PDF; run Slice 1 in dry-run; confirm extraction is correct BEFORE enabling writes. Per [[validate-twice-before-code]].

## Build/deploy reminders
- Live-test any new write endpoint (login → multipart POST → confirm rows + cleanup) — E2E does NOT cover uploads (lesson from v.210).
- Schema gate: in-container Node validator, not the Windows Python one ([[ghrava-deploy-ssh]]).
- No new tables expected (writes go to existing `med_*`), so schema risk is low; but `/ingest` opens a transaction via the importers — keep it txn-clean.

## Baseline at pause
v.218 @ d936473, container 202605.218, smoke 9/9 + full E2E 117/0. `bulk-seed` (JSON loader) live-verified working. Working tree clean (this plan + memory are the only adds).
