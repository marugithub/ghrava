# Ghrava Handoff — Session 18 (Finance partial + per-device scope, v202604.128)

**Status:** Shipped. Gift cards lens. Per-device family scope across all pages.

---

## What this session built

### 1. Gift cards on the lens
Wired finance.html `panel-giftcards` with `gift_cards` lens config (status: active/expired/redeemed, time: expiring, tag). Reads filter state via new `_gcFilters` global; loadGiftCards applies status/tag/time filters to the list. Lens initializes lazily when the gift cards tab is first opened (initGcLens).

**Other finance tabs deliberately not wired this drop.** The accounts code already had a documented design note (line 1706-1710) deferring view-toggle work for finance tabs because they're a multi-tab dashboard, not single-list pages — slapping a lens on top of native account-and-year selectors competes with existing UX. Each remaining tab (transactions, accounts, budgets, networth, holdings, hsa, import) needs UX placement work, not a swap. Flagged as a follow-up that needs design discussion.

### 2. Per-device family scope (cross-cutting feature)
Brand-new feature in `nav.js` + `shared.css`. Three pieces:
- **First-time prompt** — modal pops on first visit asking "Who is this device for?" with a list of family members + "Everyone (no filter)". Choice persists in `localStorage` as `gh_device_family_scope = { id, name }`. Skipped on login/help/offline pages, and once dismissed without picking, won't ask again that session.
- **Scope pill in nav header** — small pill next to search/print/notif buttons showing current scope. Click → re-opens the picker. Hidden when no scope set.
- **Lens auto-applies the scope** — when any lens initializes on a module that has a `person` dim, it auto-pushes a person pill matching the device scope (unless the user already has a person filter set in their persisted state). Net effect: walk into wardrobe/medical/todos/etc. and your scoped person's items are pre-filtered everywhere uniformly.

No DB changes. Pure UI feature, localStorage only. Rejecting/clearing the scope removes the pill and stops the auto-filter.

**Implementation note:** `GH_NAV.getScope()` is the public API — module renderers can read it directly if they want to scope server-side queries (none do yet; lens-only for now).

### 3. Bonus on lens
Added `gift_cards` config to lens-config.js (alongside the v127 wardrobe_outfits + v126 career_certs/kids_activities/resources entries).

---

## Files in this drop

```
app/public/finance.html              (gift cards tab lens)
app/public/nav.js                    (scope pill + picker + first-time prompt)
app/public/shared.css                (scope pill + modal styles, appended)
app/public/js/gh-lens.js             (auto-apply scope as person pill on init)
app/public/js/lens-config.js         (gift_cards entry)
app/version.txt                      → 202604.128
HANDOFF.md
```

7 files. No migrations, no server changes.

---

## Lens rollout status (after this drop)

**16 of 25 modules** with a lens. New: gift_cards. Plus the 15 from v127.

**Effectively done.** The remaining unwired modules are:
- Other finance tabs (transactions, accounts, budgets, networth, holdings, hsa) — multi-tab dashboard, needs UX redesign not lens swap. **Next major drop after design discussion.**
- daily-log — has its own custom pill+tag filter UI; would mean redesign, not swap. Discuss first.
- snapshot, hsa.html standalone, calendar, notifications, dashboard/stats, search, settings, and other system pages — don't fit the pattern by nature.

---

## What to watch on first deploy

1. **First page load triggers the scope prompt** after ~1.2s if no scope is set. Pick yourself or "Everyone (no filter)". If you dismiss without picking it won't re-ask this session.
2. **Once you pick yourself**, every list with a person dim (wardrobe, medical, todos, kids, books, perfume, property, subscriptions, documents, gift cards) auto-filters to your records. Click the scope pill in the header to switch or clear.
3. **The auto-applied person pill counts toward the lens's persisted state** — it persists in sessionStorage just like manually-added pills. Clearing the scope from the pill picker removes it from the lens's state going forward but won't retroactively yank it from the current sentence (refresh to re-init).
4. **Gift cards filter** — try `that are expired` or `expiring this month` from the lens; status logic is interpreted client-side (active = is_active=1 AND not past expiry; expired = past expiry; redeemed = balance=0). Backend API doesn't filter by these — all client-side.

---

## Carrying forward (backlog, priority order)

1. **Finance tabs lens redesign** — UX placement work. Discuss before coding.
2. **Daily-log custom-UI → lens migration** — UX redesign. Discuss before coding.
3. **Photo-first wardrobe entry** — drag/drop draft creation.
4. **Amazon orders → inventory via Gmail** — regex parsing, no AI cost.
5. **Calendar sync** (read-only Google Calendar).
6. **Browser extension** — defer indefinitely.

### REJECTED
- Email receipt tracking (duplicates bank data)
- User profile switching / multi-tenancy

---

## Working style / Critical rules — unchanged

- Discuss design BEFORE code, prototype FIRST when needed
- Always check existing infrastructure before building new
- Centralized/shared code preferred
- HANDOFF on major changes only
- Fewer releases, bigger drops; only changed files in correct structure
- SQLite `journal_mode=DELETE` + `synchronous=FULL` — no WAL
- NO `ON DELETE CASCADE`
- `requireAuth` ONLY in `settings/routes.js`
- `finance_accounts` ≠ `financial_accounts`
- Backup ≠ export
- Migrations additive only
- Records not matching new patterns display as-is, never blanked
