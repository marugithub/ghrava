# Ghrava Handoff
**Version:** v202604.035
**DB migrations applied through:** 087
**Working dir:** `/home/claude/ghrava_live/ghrava/` (from uploaded live folder backup)

---

## Stack
Node.js/Express · SQLite (better-sqlite3) · Vanilla JS frontend · Docker on QNAP NAS (192.168.4.62:3001)
Deploy: extract zip at `Z:\ghrava\`, `docker restart ghrava`

---

## Deploy process
```powershell
# Extract zip at Z:\ghrava\ then:
docker restart ghrava
docker logs ghrava --tail 30
```
Always run `bash scripts/predeploy-check.sh` before zipping. It has 5 gates:
1. Node syntax (all JS)
2. TypeScript (shared/ only, pre-existing errors in db.js/auth/attachments/data-cleanup excluded)
3. HTML inline script syntax
4. Script dependency check (catches missing lt-refs.js)
5. Migration simulation against live DB (catches duplicate columns, syntax errors)

---

## Critical rules (never break these)
- `window.api(method, path)` prepends `/api/v1` — never pass full path
- `finance_accounts` (banking) ≠ `financial_accounts` (investment) — never mix
- No `ON DELETE CASCADE` anywhere
- No WAL journal mode (use DELETE + synchronous=FULL)
- **Training records (`career_learning`) are NEVER deleted when a cert is deleted** — `career_learning_certs.certification_id` is nullified instead
- `GH_REFS` requires `lt-refs.js` — must be on every page that uses it
- `GH_FAMILY`, `GH_SELECT` are in `lt-core.js`
- Always simulate migrations against live DB before shipping

---

## Auth policy
`requireAuth` only in `settings/routes.js`. All other modules open. Read-only GET routes always before any auth wall.

---

## Shared utilities (lt-core.js)
- `GH_VIEW.init(containerId, storagePrefix, callback, options)` — grid/list toggle + column picker. Defaults: grid view, 3 cols ≥600px, 2 cols mobile. Persists to localStorage.
- `GH_SELECT.init(selectId, listKey, currentVal, options)` — dropdown backed by `dropdown_options` table
- `GH_FAMILY.init(wrapId, selectedIds)` — family member multi-picker
- `GH_REFS.populateContact(selectId, contactId, options)` — contact picker (requires lt-refs.js)

---

## GH_VIEW pattern (inventory is the reference implementation)
Toolbar goes **right-aligned in the panel header row** with a `flex:1` spacer on the left:
```html
<div style="display:flex;align-items:center;gap:8px;padding:10px 16px 0">
  <div style="flex:1"></div>
  <div id="myViewToolbar" style="display:flex;align-items:center"></div>
  <button class="btn btn-primary" onclick="openDrawer()">+ Add</button>
</div>
```
Grid CSS uses `--cert-cols` CSS variable driven by `state.cols`:
```css
.my-grid-wrap { display:grid; grid-template-columns:repeat(var(--my-cols,3),1fr); gap:10px; }
```

---

## Career module — current state

### What's built and working
- **Certs tab**: CRUD, CE hours tracking, cycle tracking, preset lookup (PMP/FAC-PPM/Security+/CSM/ITIL etc), renewal Todo auto-create
- **Jobs tab**: CRUD with company contact picker (`company_contact_id`)
- **Skills, Goals tabs**: CRUD
- **Learning tab**: CRUD, cert links (many-to-many via `career_learning_certs`), hours per cert per record
- **GH_VIEW toolbar**: wired on certs tab — grid/list toggle + col picker, right-aligned

### CE hours data seeded (migration 087)
| Cert | Hours | Cycle | Cycle Start |
|------|-------|-------|-------------|
| PMP | 60 PDUs | 36mo | 2025-04-23 |
| FAC-PPM Entry | 40 hrs | 24mo | 2026-05-01 |
| FAC-PPM Mid | 40 hrs | 24mo | 2026-05-01 |
| CSM | 0 (no CE) | 24mo | 2025-06-01 |
| ITIL Foundation | 0 (no renewal) | — | — |
| Security+ | 50 hrs | 36mo | 2024-07-15 |

### ⚠️ KNOWN ISSUE — Cert cards need visual redesign
The cards work functionally but look completely different from the approved mockup. The approved design was:
- Clean bordered card, `border: 0.5px solid var(--color-border-tertiary)`, `border-radius: 12px`
- Name + badge on one tight row
- Issuer · expiry on one muted row below
- CE progress bar: 4px, single row with `X/Y PDUs · Nmo left` + percentage right-aligned
- "Log training hours" button: full-width, subtle ghost, at bottom — **visually distinct, not just unstyled text**
- Cards must have visual contrast/borders — user complained "will go blind looking for things"

**Do not skip this. The mockup approved by the user is in the conversation history. Match it exactly.**

### "Log training hours" button
- Appears on ALL cert cards regardless of CE requirement
- Pre-links the originating cert in the learning drawer (`logHoursFromCard(btn)` reads `data-cert-id`)
- User can add more certs and split hours independently — the learning drawer supports this
- Training records survive cert deletion (cert_id nullified, record kept)

---

## Pending design work: GH_VIEW on all modules
User asked for grid/list + column picker on ALL modules, same as inventory. Pattern is established. Apply to:
- Medical (medications, conditions, visits tabs)
- Property (vehicles, properties)
- HSA
- Kids
- Books
- Documents
- Contacts
- Resources (already partial)
- Career Learning tab (already has filter chips — integrate GH_VIEW)

---

## Pending: Delete button pattern (all modules)
User approved design: **trash icon (small, left-aligned) + Cancel/Save right-aligned, all on same row**. Delete only accessible from edit drawer, never on cards.
- Needs cascade audit first — some modules have data linked to other records
- Training → Certs: already protected (nullify not cascade)
- Need to audit: medical conditions → medications, properties → maintenance logs, vehicles → service records, etc.

---

## FK standardization — completed
All free-text person/org fields now have contact/family FK columns. Key column names on live DB:
- `vehicles.lender_contact_id` (NOT loan_lender_contact_id)
- `vehicles.insurance_contact_id`
- `career_jobs.company_contact_id` (NOT employer_contact_id)
- `properties.mortgage_lender_contact_id`
- `properties.insurance_contact_id`
- `med_medications.pharmacy_contact_id`, `family_member_id`, `condition_id`
- `hsa_payments.provider_contact_id`, `family_member_id`
- `kids.teacher_contact_id`
- `finance_accounts.institution_contact_id`
- `financial_accounts.institution_contact_id`

**Always verify column names against live DB before writing route code.**

---

## Pending features (priority order)

### Tier 1 — Standardization sprint (do together, one session)
1. **Dropdown audit + consolidation** — map every dropdown across all modules, identify duplicates, consolidate to single `dropdown_options` list per concept. Same real-world concept = one list, managed in Settings.
2. **Tag field standardization + dropdown clipping fix** — tag suggestion list gets clipped by overflow containers. Fix: render in `position:fixed` layer in `GH_TAGS` core. Also move tag input sizing to `.gh-tags` in `shared.css`.
3. **Inline add for all GH_SELECT dropdowns** — type + "+ Add" → saves and selects, without leaving the form. Applied globally to `GH_SELECT`.
4. **Shared form components audit** — confirm Contact picker, Family Member picker, Tag picker each have exactly one implementation used everywhere.

### Password reset — backend commands (emergency use)
If locked out and can't access Settings UI, SSH to NAS and run:

**Change password:**
```bash
docker exec ghrava node -e "
const db = require('/app/db/db');
const bcrypt = require('bcryptjs');
const hash = bcrypt.hashSync('yournewpassword', 10);
db.prepare("UPDATE app_config SET value=? WHERE key='app_password_hash'").run(hash);
console.log('Password updated');
"
```

**Clear password (open mode — no login required):**
```bash
docker exec ghrava node -e "
const db = require('/app/db/db');
db.prepare("DELETE FROM app_config WHERE key='app_password_hash'").run();
db.prepare("DELETE FROM _sessions").run();
console.log('Password cleared, all sessions ended');
"
```

No restart needed. Takes effect immediately.

### Auth — when ready to add password back
Single login page (`login.html`). One token, stored in DB (`_sessions` table already exists). **No localStorage, no sessionStorage** — cookie only so browser storage clears never lose the session.

Implementation:
- `login.html` — password form → POST `/auth/login` → server sets `HttpOnly` cookie → redirect to `?next=` param
- `nav.js` — check token once per page load via `GET /auth/status`. Invalid → redirect to `login.html?next=<current url>`
- `requireAuth` in `middleware.js` — re-enable, check cookie (primary) OR Authorization header (APK WebView fallback)
- Login route — add `Set-Cookie: lt_token=<token>; HttpOnly; Max-Age=31536000; Path=/` to response
- Remove `_reAuthPrompt` from `lt-core.js` — nav.js redirect handles everything
- Session duration: one constant in `middleware.js` (currently 365 days)
- APK WebView: cookies work natively, no change needed
- Form data loss on expiry: non-issue with 365-day cookie. During dev, password stays off

### Tier 1.5 — Icon & action standardization (do before Tier 2)
- **Attachment button** — paperclip icon everywhere, no text label. Cert cards already have it — use that as the pattern. Apply to all modules that have attachments. Show attachment count as a small badge overlaid top-right of the icon when count > 0; no badge when zero.
- **Delete button** — red trash icon, no word "Delete". 26×26 to match `gh-card-btn` and all other icon buttons. Stays in edit drawer footer only, never on cards.
- **Archive vs Delete** — design conversation required before any code. Key decisions:
  - Archive = primary soft-delete (hidden from default views, recoverable)
  - Hard delete = rare, only reachable from archived state (archive-first policy)
  - Which modules need archive (certs, jobs, vehicles, properties, medical records, books) vs completion (todos) vs neither (dropdown options → deactivate)
  - UI: "Show archived" toggle per module, or a global archived view in Reports?
  - Card-level archive action (icon in footer) or drawer-only?

### Tier 2 — UI completeness
5. **GH_VIEW on remaining modules** — Medical, Property, HSA, Kids, Books, Documents, Contacts, Resources, Career Learning. One pass, all at once.
6. **Delete button pattern** — trash icon left-aligned + Cancel/Save right-aligned, same row. Delete only from edit drawer. Requires cascade audit first.
7. **Card appearance customization** (Settings → Appearance → Cards) — border thickness, corner radius, density, background elevation. CSS variables on `<body>`, stored in settings DB.
8. **Tag appearance customization** (Settings → Appearance → Tags) — pill radius, size, global color toggle. CSS variables in `shared.css`.

### Tier 3 — New modules/features
9. **Family member report** (“Everything about a person”) — goes in Reports, new-tab + polling
10. **Notifications module** — design-first conversation before any code
11. **Scheduled backup**
12. **Global search** across all modules

---

## UI standardization principles (established v202604)
**Single Source of Truth** — every piece of data, UI, and behavior exists in exactly one place.
- **Data**: one dropdown list per real-world concept; one table per entity type
- **References**: person field = Contact FK; family member = `family_members` FK; no free-text name fields for lookups
- **UI components**: one HTML implementation per form/picker/component, wired everywhere via shared utility
- **Styles**: `.gh-card` in `shared.css` is canonical. `.gh-tags` will be canonical tag input. All customization via CSS variables.

## gh-card system (completed v202604)
Base class `.gh-card` + status modifiers in `shared.css`. Layout helpers: `.gh-card-head/title/meta/divider/body/row/footer/tags/actions/btn`. Value helpers: `.ghv/.ghv-ok/.ghv-warn/.ghv-err/.ghv-dim`. Badges: `.gh-badge` + `.gh-badge-green/amber/red/blue/gray/purple`.
Status colors: green=active/current, amber=expiring/pending, red=expired/overdue, blue=info/default, gray=neutral/former.
Modules updated: career, books, todos, property, medical, documents, resources, kids.

---

## Migration notes
- Live DB last applied: 087
- Pending migrations 067, 069, 071, 076, 077, 080 were failing due to BEGIN/COMMIT nesting and duplicate columns — all fixed
- `migrate.js` strips BEGIN/COMMIT/ROLLBACK before running in its own `db.transaction()` wrapper
- Always run migration simulation (predeploy-check gate 5) before shipping

---

## Key file locations
- `app/version.txt` — version string
- `app/db/migrate.js` — migration runner
- `app/db/migrations/` — all migrations (sequential numbers, additive only)
- `app/shared/autoTodos.js` — `syncAutoTodos()` + `syncMedRefillTodos(db)`
- `app/shared/namematch.js` — `resolvePatient()` for EOB import name matching
- `app/shared/needs-review.js` — data review flagging system
- `app/scripts/predeploy-check.sh` — 5-gate predeploy check
- `app/public/js/lt-core.js` — GH_VIEW, GH_SELECT, GH_FAMILY, window.api
- `app/public/js/lt-refs.js` — GH_REFS (contact pickers)
