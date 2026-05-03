# Ghrava Handoff — Session 15 (Center modals + Today page, v202604.125)

**Last updated:** May 2026
**Status:** Shipped. Center modals + new Today page + dashboard relocated.

---

## What this session built

### 1. Center-of-page modals (CSS only)
`shared.css` rewrite — both drawer systems are now centered modals instead of right-anchored slide-ins. **All 25+ modules inherit automatically; no per-module HTML edits.**

- `.gh-drawer` (used by 2 modules: inventory, settings)
- `.drawer-overlay` + `.drawer` (used by 15 modules: subscriptions, books, perfume, insurance, documents, medical, todos, finance, career, kids, daily-log, calendar, property, wardrobe, resources)

**Sizing rationale (per Al's direction):**
- Width stays `min(540px, 92vw)` — same as before, so existing field/button layouts inside drawers don't get scaled up or wrapped weirdly
- Height `min(92vh, 920px)` with `max-height: 92vh` — close to the viewport so multi-field forms (medical, finance, etc.) remain usable without hiding submit buttons below the fold
- Top/bottom margin ~4vh, all-corners radius 14px
- Mobile (≤640px): goes full-screen as before, no border, no radius — unchanged behavior

**Removed:** the v110 desktop tri-pane layout that shrunk `#app` width when a drawer opened. Center modals don't displace content, so that media-query block is gone. Backdrop dimming kept.

### 2. Today page (`/index.html`)
Replaces the old dashboard at the home route. The old dashboard moves to `/dashboard.html` (linked as "Stats" in the sidebar Reports section).

**Layout:**
- Header: dynamic date + count summary ("3 things today, 5 this week")
- **Now** section (red dot, due ≤ 0 days)
- **Soon** section (amber dot, due 1–7 days)
- Pipeline footer: "12 more items in the next month"
- **Multi-column grid** on desktop via `repeat(auto-fill, minmax(320px, 1fr))` — auto-fits 1/2/3 columns by viewport width
- Single column on mobile (≤640px)

**Snooze:** click "Snooze" button → menu pops with 1d / 7d / 30d. Optimistic UI: row fades out, list refetches.

**Empty states:** "All clear ✓" if absolutely nothing pending, "Nothing needs your attention" if Now+Soon are empty but pipeline has items.

### 3. New endpoint + migration

**Migration 116** — `today_snoozes` table:
- `record_kind` ('subscription' / 'document' / 'insurance' / 'todo')
- `record_id` (id in source table)
- `snoozed_until` (ISO date)
- `UNIQUE(record_kind, record_id)` — re-snoozing replaces, doesn't dup
- No CASCADE FK (record_kind is dynamic, SQLite can't express that)

**`GET /api/v1/today?lookahead=30`** — single round-trip aggregator:
- Pulls open/active records from todos, subscriptions, insurance_policies, documents
- Filters by date columns: `due_date`, `next_billing_date`, `coverage_end_date`, `expiry_date`
- Excludes anything currently snoozed
- Returns `{ now: [...], soon: [...], pipeline_count: N, generated_at, lookahead }`
- Each item: `{ module, record_id, title, subtitle, due_date, action_label, href, severity }`

**`POST /api/v1/today/snooze`** — body `{ record_kind, record_id, days }` where days ∈ {1, 7, 30}. Upserts via `ON CONFLICT(record_kind, record_id) DO UPDATE`.

**`DELETE /api/v1/today/snooze/:kind/:id`** — un-snooze (not currently called from UI, but available).

### 4. Nav update
- `home` module renamed "Today" (was "Home"), still points to `/index.html`
- New `stats` module → `/dashboard.html`, added to "Reports" sidebar group next to "Reports"

---

## Files in this drop

```
app/db/migrations/116_today_snoozes.sql        (new)
app/features/today/routes.js                   (new)
app/server.js                                  (mounts /api/v1/today)
app/public/index.html                          (REWRITTEN — Today page)
app/public/dashboard.html                      (NEW — moved from old index)
app/public/nav.js                              (Today + Stats nav links)
app/public/shared.css                          (modals)
app/version.txt                                → 202604.125
HANDOFF.md
```

9 files. Old behavior: zip-extracted by `ghrava_deploy.ps1` then robocopy-mirrored to `Z:\ghrava\` then `docker restart ghrava`. Migration 116 runs on container restart.

---

## Sandbox checks (this session)

- Node syntax: server.js, today/routes.js, nav.js — all OK
- Inline scripts: index.html (3 blocks), dashboard.html (3 blocks) — all OK
- SQL migration: clean, additive only, no CASCADE, no BEGIN/COMMIT (matches runner expectations)

---

## Known scope gaps / things to watch on first deploy

1. **First page load after migration** — `today_snoozes` table is empty, so the snoozeMap query returns nothing. Today page should populate immediately from the 4 source tables. If something looks off, check `docker logs ghrava --tail 50`.

2. **Subscriptions column** — used `next_billing_date` (which is the actual schema column from migration 109b). The lens config in `lens-config.js` references a different name (`next_charge_at`) — unrelated, that was the lens issue from last session and doesn't break anything because nothing actually filters by lens time yet.

3. **Insurance "policy_type"** — used as the title prefix ("Auto renews"). If your policies have empty policy_type, it'll show "Insurance renews". Not a bug, just a fallback.

4. **Documents `is_active`** — filter uses `COALESCE(is_active,1) = 1`. If you have soft-deleted docs with `is_active=0`, they're excluded as expected.

5. **Drawer field layouts** — the move from right-side full-height to center 92vh shouldn't change any field widths (kept 540px), but if any specific drawer has custom CSS that assumed `height: 100vh`, it might overflow or under-fill at 92vh. Worst-case is internal scrolling kicking in (good) or content centering oddly (visible but cosmetic).

6. **Snooze undo** — there's no UI to un-snooze yet. The DELETE endpoint exists. If you snooze something by mistake, run:
   ```sql
   DELETE FROM today_snoozes WHERE record_kind='todo' AND record_id=42;
   ```
   Or wait for the snooze to expire. Add an undo affordance in a future drop.

---

## Carrying forward

### Still on the lens
- **Time pill is decorative** on all 9 lens-wired pages — captured by adapter, not applied. Across-the-board pass needed.
- **Todos lost priority/category filter dims** — add them back to lens-config.js? Or accept that priority is now group-only (visual)?

### Today page polish
- Snooze undo button (toast: "Snoozed for 7 days · Undo")
- Optimistic count update before the refetch lands
- Per-module color accents on rows (currently just severity dot)
- Header greeting variation by time of day ("Good morning, Al")
- Today page polling — 30s? 60s? Or just on focus?

### Dashboard / Stats
- The relocated dashboard.html still works as-is. Worth a pass to remove anything that was duplicated from "needs attention" since Today page handles that better now.

### Open correction
- ✓ Center modals — done this drop
- Still TODO: any modal-specific niceties (Esc to close, focus-trap, body scroll-lock) — most modules already wire Esc; no global pattern needed yet.

---

## Backlog (priority order, unchanged)

1. **Per-device family filter** — first-time prompt "who is this device for?", localStorage scope.
2. **Photo-first wardrobe entry** — drag/drop draft creation.
3. **Amazon orders → inventory via Gmail** — regex parsing, no AI cost.
4. **Calendar sync** — Google Calendar read-only.
5. **Browser extension** — defer indefinitely.

### REJECTED
- Email receipt tracking (duplicates bank data)
- User profile switching / multi-tenancy

---

## Working style for next chat

- Discuss design BEFORE code, prototype FIRST (visualize widget)
- Always check existing infrastructure before building new
- Verify DB schema before treating as field gap
- Centralized/shared code preferred
- Continue without check-ins until natural pause
- HANDOFF on major changes only
- Fewer releases, bigger drops; only changed files in correct structure
- Al doesn't test releases — be extra careful with sandbox checks before packaging

---

## Critical rules (unchanged)

- SQLite `journal_mode=DELETE` + `synchronous=FULL` — no WAL
- NO `ON DELETE CASCADE`
- `requireAuth` ONLY in `settings/routes.js`
- `finance_accounts` ≠ `financial_accounts`
- Backup ≠ export
- Verify column names against live DB
- Migrations additive only
- Records not matching new patterns display as-is, never blanked
