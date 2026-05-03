# Ghrava Handoff — Session 14 (Lens v202604.124, SHIPPED)

**Last updated:** May 2026
**Status:** Lens shipped to all 9 lens-eligible pages. Packaged. Ready to deploy.

---

## What this session built

**The Lens** is now wired on all 9 pages it was scoped to. Last session got 8 done in sandbox; this session finished `todos.html` and packaged the deploy.

### Pages wired (9)
- subscriptions
- books
- insurance
- documents
- perfume
- wardrobe (items tab only)
- property (tab-aware re-init)
- medical (subview-aware re-init; `?cards=v2` flag dropped)
- **todos** ← finished this session; `?cards=v2` flag dropped, cards always on, GH_VIEW filter drawer replaced

### Files in the v124 deploy zip
```
app/public/js/lens-config.js     (new — verb table per module)
app/public/js/gh-lens.js         (new — lens component)
app/public/shared.css            (lens styles appended)
app/public/subscriptions.html
app/public/books.html
app/public/insurance.html
app/public/documents.html
app/public/perfume.html
app/public/wardrobe.html
app/public/property.html
app/public/medical.html
app/public/todos.html
app/version.txt                  (-> 202604.124)
HANDOFF.md                       (this file)
Deploy-Patch.ps1                 (v124 file list)
```

### Sandbox checks (this session)
- 9/9 inline-script syntax check on every wired HTML page
- Both lens JS files node-check clean
- No stale `GH_VIEW.init` calls left on any wired page (only doc-comment refs)

---

## Known scope gaps (carry forward)

### 1. Lens "time" pill is decorative on all 9 pages
Every adapter captures the time value (`out.renewing`, `out.expiring`, `out.started`, `out.last_worn`, `out.time` for todos), but **none of the pages actually filter the result set by date**. The pill displays, the count doesn't change.

This was inherited from session 13 — fixing it on todos alone would have made todos' lens behave differently from the other 8 pages, so todos was kept consistent. **Plan: an across-the-board time-filter pass on all 9 modules in one go**, with date helpers shared in `gh-lens.js` or `lt-core.js`.

### 2. Todos lost priority/category filter dimensions
The lens config for `todos` only includes `person/status/time/tag` — `priority` and `category` are gone. The page still groups visually by priority, but you can no longer filter the list to "only urgent" via a dropdown.

**Decision deferred to next chat:** add `priority` (and maybe `category`) as lens dimensions in `lens-config.js`? If yes, I just edit lens-config.js + the todos adapter — no other changes needed because the lens auto-renders any dimension you add.

### 3. e2e tests not updated
HANDOFF v123 said "Add lens behavior tests in `tests/ghrava-e2e.spec.js`." Sandbox-side lens tests pass (30/30) but the Playwright e2e suite isn't covering the lens yet. Deferred — would prefer to write these alongside the time-filter pass when behavior is final.

---

## Lens design — LOCKED decisions (unchanged)

- **Empty hint:** *"narrow by family member, status, time…"*
- **Persistence:** sessionStorage only.
- **Pills:** blue dotted underline (Notion-style). Click to edit. No per-pill ✕ by default; hover reveals it.
- **Clearing:** italic "reset" + backspace eats last pill.
- **Cross-module:** filters persist across module switches within session. Filters not applicable to new module dropped silently.
- **Keyboard:** `/` focuses lens; ↑↓ navigate; Enter accepts top; Esc dismisses.
- **Verb table:** `lens-config.js` only. Edit there to change verbs.

---

## Today page — DESIGNED, NOT BUILT

(Carrying forward from last session — locked design, build next.)

- Move `app/public/index.html` → `app/public/dashboard.html`
- Build new `index.html` as Today
- Add "Stats" nav link → dashboard.html
- Two sections: **Now** (red, due ≤ 0 days) + **Soon** (amber, 1–7 days)
- 30-day pipeline as footer: *"12 more items in next month"*
- Endpoint: `GET /api/v1/today?lookahead=30` aggregating subscriptions/documents/insurance/todos
- Each item: `{ severity, title, subtitle, module, record_id, due_date, action_label }`
- Dense vertical rows (NOT cards), color-coded left dot, Open + Snooze buttons
- Snooze table `today_snoozes (record_kind, record_id, snoozed_until)`; default +7d
- Header: *"Saturday, May 2 — 3 things today, 5 this week"*
- Empty state: *"Nothing needs your attention. N items in the pipeline."*

---

## Open item Al raised twice (do this next)

**Center-of-page modals/drawers across all modules.** Al asked for this twice in past chats and past Claude punted both times into backlog. This is a real correction, not a feature request.

Approach: all 25 module drawers → center modals. Restyle `.gh-drawer` in `shared.css`. **Discuss approach before coding** per Al's working style.

---

## Backlog (priority order, unchanged)

1. **Per-device family filter** — first-time prompt "who is this device for?", localStorage, scope indicator near nav avatar. NO DB changes.
2. **Photo-first wardrobe entry** — drag/drop or camera capture creates draft item.
3. **Amazon orders → inventory via Gmail** — verify email content first; regex parsing, no AI cost.
4. **Calendar sync** — Google Calendar → read-only birthdays/appointments inbox.
5. **Browser extension** — defer indefinitely.

### REJECTED
- Email receipt tracking (duplicates bank data)
- User profile switching / multi-tenancy

---

## Working style for next chat

- Discuss design BEFORE code, prototype FIRST (visualize widget)
- ALWAYS check existing infrastructure before building new
- Verify DB schema before treating as field gap
- Centralized/shared code preferred
- Continue without check-ins until natural pause
- HANDOFF on major changes only, not every drop

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
