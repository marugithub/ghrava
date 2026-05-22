# NEXT_CHAT_HANDOFF.md

**Created end of 2026-05-22 session.** Hand this to the next chat on turn 1.

---

## What happened in this session

1. **SSH passwordless auth set up.** Windows PC → NAS using
   `~/.ssh/ghrava_nas_rsa`. Fixed three QNAP gotchas (StrictModes home
   permissions, RSA algorithm allowlist, `/etc/config/ssh/authorized_keys`
   symlinked to `/dev/null`). Permanent. Works.

2. **Combined `ghrava_deploy.ps1` shipped.** One Enter does extract → robocopy
   → git push → SSH restart → log tail → smoke + Playwright. Saved to
   `C:\Users\algir\Downloads\ghrava_deploy.ps1`. Already version-controlled in
   repo as of v.176 era.

3. **Claude Code installed and working.** Local clone at `C:\dev\ghrava`. Used
   for v.171 through v.185 builds.

4. **Five drops shipped via Claude Code in 24 hours:** v.180 (Medical:
   immunizations + procedures + auto-link triggers), v.181-v.185 (Reports
   Group 1 Money charts went live, schema cleanup, drill-down framework, plus
   numerous smaller fixes). All passed smoke + E2E. Current prod: **v.185**.

5. **Reports page redesign — fully designed, NOT yet built.** This is the
   primary handoff item. See below.

6. **Migration plan exists for moving Docker from NAS to mini PC.** See
   `MIGRATION_TO_MICROPC.md` in repo root. No action yet — hardware not
   selected.

---

## REPORTS REDESIGN — THE BIG ONE

**Full spec:** `REPORTS_REDESIGN_HANDOFF.md` in repo root.

**Three visual mockups, already in the repo as templates:**
- **#30a** — Reports landing page (5 tabs, Lens search, Pinned strip, category
  cards). File: `app/public/_templates/reports-redesign-landing.html`.
- **#30b** — Lens search active state on Reports page. File:
  `app/public/_templates/reports-redesign-lens-active.html`.
- **#30c** — Report viewer page with drill-down slideout + empty + error
  states. File: `app/public/_templates/reports-redesign-viewer.html`.

All three are indexed in `app/public/_templates.html` under "Visual mockups
(chat-designed, locked, awaiting build)".

**Locked decisions** (don't relitigate, see REPORTS_REDESIGN_HANDOFF.md for
the full list):
- Tabs: `Money | Health | Household | Family | Pending`. Five only.
- No Overview, no Recent tab.
- Lens search = report titles + visible descriptions only.
- Pinned strip max 4, persists via new `user_preferences` table.
- Auto-refresh on load, no cache, manual refresh button.
- Drill-down via slideout from right; uses same partial as source module
  renders (no duplication).
- Print can ship functional immediately; other exports display-only for now.
- Reports = view layer. No data movement. Cross-module via `record_links`.

**Still NEEDS design conversation before building** (do this in next chat):
- **Household tab contents** — list of reports, drill targets
- **Family tab contents** — Emergency info, Family snapshot, per-member,
  Kids activity, Care team contacts (rough candidates)
- **Mobile layout approval**
- **Column picker modal** — pattern exists in GH_VIEW, just need default-
  visible columns per report

**Build sequence (locked):**
- **v.186** — Foundation. user_preferences table + endpoints. New tab
  structure. Lens wiring. Placeholder cards under each tab. NO per-tab content
  yet.
- **v.187** — Money tab + report viewer page shell. Wire spending-by-cat,
  cash-flow, hsa-fsa-irs, top-vendors, category-trends to live queries.
- **v.188** — Health tab + Health-specific reports (some blocked on
  metric_index design).
- **v.189** — Household tab (after design conversation completes).
- **v.190** — Family tab (after design conversation completes).

---

## Open product decisions parked across sessions

1. **Medication HSA-YTD on the card.** Yes/no/something else.
   Currently medication cards don't show HSA YTD (lost in v.165 compact mode
   redesign). Blocks any medication-card asterisk work. Small build either
   way once decided.

2. **Reports Group 2 (Health) — metric_index design.** Needs canonical metric
   vocabulary, cross-module join model, default time windows per metric type.
   ~30 min design conversation. Blocks the Lab Trends and BP Trends charts.
   Path X (build metric_index abstraction) was rejected this session in favor
   of Path Y (each report queries its own sources, refactor to abstraction
   when 3+ consumers exist).

3. **Mini-PC migration target OS.** Debian 12 recommended in
   MIGRATION_TO_MICROPC.md. Final call when hardware shows up.

---

## Rules carried forward (don't lose these)

- Plain English everywhere user-facing. No internal jargon on screen.
- Plain English in chat too. Al is non-technical.
- Every dataset gets grid + list views via `GH_VIEW.init()`.
- No ON DELETE CASCADE.
- Every `db.prepare` raw SQL gets a `// schema:` comment.
- Bundle 3-5 tasks per drop. No single-task drops except critical bugs.
- Show Al the plan before code in every drop.
- Default rule: ambiguous → least code + matches existing pattern, document
  in commit, don't pause to ask.
- Gates won't run on Windows — that's normal, mention in commit messages.
- Do NOT package a zip — Al says "package" when ready.

---

## How to start the next session

If the next session is **in chat** (more design conversation):

> "Hi. Read REPORTS_REDESIGN_HANDOFF.md and NEXT_CHAT_HANDOFF.md from
> https://github.com/marugithub/ghrava. Look at templates #30a, #30b, #30c
> at /app/public/_templates/reports-redesign-*.html. We're picking up the
> Reports redesign. Today we drill down on [Household | Family | mobile |
> column picker]."

If the next session is **Claude Code** (start building):

> "Read REPORTS_REDESIGN_HANDOFF.md (repo root) for the full spec. The visual
> reference is in app/public/_templates/reports-redesign-landing.html
> (#30a), reports-redesign-lens-active.html (#30b), and
> reports-redesign-viewer.html (#30c). Build the v.186 plan per the handoff's
> 'v.186 — Foundation' section. Stop after the plan."

---

**End of handoff.** Save this in repo root. Commit it. Reference it.
