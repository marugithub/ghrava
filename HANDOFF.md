# Ghrava Handoff — Session 16 (Lens rollout pt. 2, v202604.126)

**Last updated:** May 2026
**Status:** Shipped. 4 more pages on the lens.

---

## What this session built

Continuing the lens rollout with no deviation — uniform look across modules.

### Pages newly wired (4)
- `inventory.html` — replaces GH_VIEW with GH_LENS. Grid/list/gallery view toggle preserved. Person + tag dimensions. **Lost:** location, category, brand, has_photo filters (would need dynamic-values dim support — see "extending the lens" below).
- `career.html` (certifications tab) — replaces GH_VIEW. Status (Active/Expired/Expiring Soon/Pending) + time + tag. Grid/list view toggle. The existing `loadCerts()` already read `_careerFilters.{status,tags}` so no renderer changes.
- `kids.html` — replaces GH_VIEW (which was actually broken — it pointed at a non-existent `kidsViewToolbar` div). Person + status (category as Sports/Music/Arts/...) + tag. View toggle disabled (kids has its own kid-strip + sub-tab UX). Lens shows only when a kid is selected.
- `resources.html` — replaces GH_VIEW. Status (link_type as website/login/document/...) + tag. Grid/list view toggle. **Lost:** favorite toggle (would need a custom 'toggle' dim type).

### Lens config additions
`lens-config.js` gained 3 new module entries:
- `career_certs` (status: cert states, time: expiring, tag)
- `kids_activities` (person, status: category, tag)
- `resources` (status: link_type, tag)

Plus the existing `inventory` entry, unchanged.

### What "status repurposed" means
The lens has 4 fixed dimensions: person / status / time / tag. Some modules need single-select filters that aren't called "status" — category (kids), link_type (resources), cert state (career). Convention adopted this session: when a module needs a single-select dim that isn't a true status field, repurpose the `status` dimension with a custom verb ("of type", "in", etc) and the appropriate `field` and `values`. The adapter maps `f.dim === 'status'` to whatever flat-filter key the renderer wants (`category`, `link_type`, `status`).

This is deliberate scope discipline — adding a generic `select` dim type would require a non-trivial gh-lens.js rewrite. See backlog.

---

## Files in this drop

```
app/public/js/lens-config.js   (3 new module entries)
app/public/inventory.html      (lens wired)
app/public/career.html         (lens wired)
app/public/kids.html           (lens wired)
app/public/resources.html      (lens wired)
app/version.txt                → 202604.126
HANDOFF.md
```

7 files. No CSS, no migrations, no server-side. Pure HTML + lens config.

---

## Lens rollout status (after this drop)

**13 of 25 modules on the lens** (52%):
- subscriptions, books, insurance, documents, perfume, wardrobe (items tab), property, medical, todos — from previous sessions
- inventory, career, kids, resources — this session

**Modules still on old toolbars / no toolbar (12):**
- wardrobe outfits + insights tabs (items tab is lens'd, but outfits has season+occasion multi-select that needs gh-lens.js extension; insights is just a view toggle)
- finance — multi-tab, no GH_VIEW currently. Likely needs lens per tab.
- daily-log — chronological log, no GH_VIEW currently. Lens may not fit this UX.
- hsa — multi-tab, no GH_VIEW. Possibly fits.
- notifications — inbox-style, no GH_VIEW. Probably skip.
- calendar — date UI, doesn't fit.
- search — global search UI, doesn't fit.
- dashboard (now /stats) — aggregator, doesn't fit.
- family-snapshot — settings page, doesn't fit.
- a few smaller pages

So the realistic remaining target list is: **wardrobe outfits/insights, finance tabs, hsa tabs**. Three multi-tab pages, all of which need either gh-lens.js extension (multi-select dims) or per-tab discipline.

---

## Extending the lens — backlog item

To finish the rollout uniformly, gh-lens.js needs a generic `select` dimension type. Sketch:

```js
// lens-config.js entry
wardrobe_outfits: {
  label: 'Outfits', plural: 'outfits',
  dimensions: {
    person:   { verb: 'for', field: 'family_member_id' },
    season:   { type: 'select', verb: 'in', field: 'season',
                values: ['Spring','Summer','Fall','Winter'] },
    occasion: { type: 'select', verb: 'for', field: 'occasion',
                values: ['Casual','School','Work','Formal','Evening'] },
    tag:      { verb: 'tagged', field: 'tags' },
  },
}
```

Where `gh-lens.js` recognizes `dcfg.type === 'select'` and treats it the same as status (custom values list) but allows multiple per module. About a 30-line patch in `buildAllSuggestions`, the rendering switch, and the state filter logic.

Once that lands, finishing the rollout to wardrobe outfits/insights, finance tabs, and hsa tabs becomes mechanical.

---

## What's NOT in this drop (intentional)

- Wardrobe outfits/insights tabs — needs the dim extension above
- Finance, hsa, daily-log, calendar, notifications — either need extension or don't fit
- The "time pill is decorative" gap — still inherited
- The Today page snooze undo button — still TODO
- Center-modal niceties (Esc to close, focus trap) — most modules already wire Esc

---

## Carrying forward (backlog, priority order)

1. **Generic `select` dim type in gh-lens.js** — unblocks wardrobe outfits, finance, hsa
2. **Across-the-board time-filter pass** — make the time pill actually filter on all 13 wired pages
3. **Snooze undo on Today page** — toast with "Undo" button, calls DELETE /api/v1/today/snooze/...
4. **Per-device family filter** — first-time prompt, localStorage scope
5. **Photo-first wardrobe entry**
6. **Amazon orders → inventory via Gmail**
7. **Calendar sync** (read-only)
8. **Browser extension** — defer indefinitely

### REJECTED
- Email receipt tracking (duplicates bank data)
- User profile switching / multi-tenancy

---

## Working style for next chat

- Discuss design BEFORE code, prototype FIRST when needed
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
