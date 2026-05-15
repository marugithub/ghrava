# Ghrava — Session 12 Handoff
**Last updated:** April 17-18, 2026 (overnight build session)

---

## Deploy Status
**Current deploy zip:** 49 files — `docker restart ghrava` only, no `--build`
**Working dir:** `/home/claude/ghrava_work/`

### Migrations in this deploy (run automatically on restart):
- 103 — kids_activity_season dropdown
- 104 — hsa_reimbursement_method dropdown
- 105 — container_subtype dropdown
- 106 — weather_config (lat/lon/city/units in app_config)
- 107 — wardrobe (12 new columns on items + 4 new tables + dropdowns)
- 108 — perfume (5 new tables + dropdowns)
- 109 — subscriptions (2 new tables + dropdowns)
- 110 — insurance (3 new tables + dropdowns)
- 111 — warranty expansion (4 new columns on items + warranty_claims table)

---

## Tomorrow's Priority List
1. **Deploy the zip** — 49 files, `docker restart ghrava`
2. **Tailscale HTTPS cert** → Google OAuth fix:
   ```bash
   docker exec tailscale tailscale cert qnap-nas-36.tail73fb11.ts.net
   ```
   Then add Caddy block for `qnap-nas-36.tail73fb11.ts.net` → `http://ghrava:3001`
   Then add `https://qnap-nas-36.tail73fb11.ts.net/api/v1/google/oauth/callback` to Google Console
3. **Test Google OAuth** after fix
4. **EOB import test** — Medical → EOB tab, drag a PDF
5. **Install Tailscale on Windows PC**
6. **Set weather location** — Settings → Infrastructure → Weather Location (lat/lon for wardrobe)

---

## Infrastructure — Current State

### Network Setup
- NAS IP: `192.168.4.62`
- Ghrava: `http://192.168.4.62:3001` or `https://ghrava.home` (via Caddy)
- Caddy: running, `ghrava.home` confirmed working on PC
- Tailscale: running on NAS as `qnap-nas-36`, tailnet `tail73fb11.ts.net`
- Remote access confirmed: Tailscale IP + port 3001 works from phone on mobile data
- **No DuckDNS** — ruled out permanently due to public internet exposure risk

### DNS Per Device
- **PC:** hosts file `192.168.4.62 ghrava.home` (working)
- **Phone WiFi:** AdGuard user rule `||*.home^$dns=192.168.4.62` (working)
- **Phone mobile:** Tailscale only — use Tailscale IP directly. AdGuard + Tailscale cannot run simultaneously on Android without root.

### Google OAuth — Still Blocked
- Credentials saved correctly in app_config (confirmed via debug endpoint)
- Two code bugs fixed: `auth_url`→`url` key, callback now redirects to `?google_connected=1`
- **Blocker:** needs Tailscale HTTPS cert for `qnap-nas-36.tail73fb11.ts.net`
- Debug endpoint: `http://192.168.4.62:3001/api/v1/google/debug/connection`

---

## What Was Built This Session

### Auth
- `middleware.js` — `requireAuth` passes GET/HEAD always. Only POST/PUT/PATCH/DELETE check session. Open mode passes everything.

### Hardcoded Selects → GH_SELECT (all centralized)
- `career.html` — employment type → `career_job_type`
- `inventory.html` — location type, maintenance type, purchase method, item condition, container subtype
- `kids.html` — activity season → `kids_activity_season`
- `settings.html` — family relationship → `family_relationship`
- `finance.html` — HSA reimbursement method → `hsa_reimbursement_method`

### Navigation
- `nav.js` — chevrons fixed (`>` collapsed, `v` open), sections restructured per MODULES_DESIGN.md
- New modules added to MODULES registry: wardrobe, perfume, insurance, subscriptions (with SVGs, colors)
- Help `?` icon moved from Admin sidebar to page header (next to bell and gear) — on every page
- Alerts sidebar item now shows red unread badge count

### New Modules Built (full stack — migration + routes + UI)
| Module | Routes | Page | GH_VIEW | Notes |
|---|---|---|---|---|
| Wardrobe | `features/wardrobe/routes.js` | `wardrobe.html` | ✅ Items + Outfits tabs | Planner tab custom (intentional) |
| Perfume | `features/perfume/routes.js` | `perfume.html` | ✅ with filterFields | Fragella lookup wired |
| Subscriptions | `features/subscriptions/routes.js` | `subscriptions.html` | ✅ | gh-card, stats-row |
| Insurance | `features/insurance/routes.js` | `insurance.html` | ✅ | Renewal chain, gh-card |

### Notifications Enhanced
- Insurance policy expiry alerts (30d/60d)
- Wardrobe items not worn 30+ days
- Subscription annual renewal alerts (7 days)
- Warranty expiry alerts (30 days) from new warranty_expiry column
- Alerts sidebar badge now shows unread count

### Reports Enhanced
- Subscription Spending report panel (monthly/annual totals, by category, upcoming renewals)
- Insurance Summary report panel (active count, expiring 60d, annual premium, by type)

### Warranty Expansion
- 4 new columns on `items`: `warranty_expiry`, `warranty_provider_contact_id`, `warranty_details`, `warranty_registration_no`
- New `warranty_claims` table with full CRUD routes
- Inventory drawer has new warranty fields

### Finance Reports Registered
- `finance/reports.js` was never registered in server.js — all 5 endpoints were 404. Fixed.

### Weather Route
- `/api/v1/app/weather` — reads `OPENWEATHERMAP_API_KEY` from env, lat/lon from app_config, 30-min cache
- Settings → Infrastructure → Weather Location panel to set lat/lon/city

### UI Standards Compliance
- All 4 new modules use `gh-card` + `gh-s-*` — no custom card CSS
- All 4 new modules have `GH_VIEW.init()` with filterFields
- `UI_STANDARDS.md` created — read this before any frontend work

---

## New Files This Session
- `app/features/wardrobe/routes.js`
- `app/features/perfume/routes.js`
- `app/features/subscriptions/routes.js`
- `app/features/insurance/routes.js`
- `UI_STANDARDS.md` — **read before writing any HTML/CSS**
- `public/launcher/MyAppLauncher.html` — standalone PWA launcher (in outputs, not in app)

---

## API Keys — .env.secrets Template Updated
New entries in `.env.secrets.copy.txt`:
- `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` — still in app_config, migrate after OAuth confirmed
- `OPENWEATHERMAP_API_KEY` — weather
- `FRAGELLA_API_KEY` — perfume lookup, free 20/month, cached in DB
- `GEMINI_API_KEY` — optional AI, free 250/day
- `GROQ_API_KEY` — optional AI, free 1000/day

---

## Backlog — Updated

### Ready to build next
- Wardrobe Insights tab — already has backend `/wardrobe/insights`, needs gh-card style pass
- Document expiry auto-todo scheduler — nightly job creating todos from all expiry dates (fully designed in MODULES_DESIGN.md)
- Step-up auth for exports and sensitive actions (designed, not built)
- APK (WebView shell) — after Tailscale cert confirmed working

### Deferred
- Google credentials migration from app_config to .env.secrets — after OAuth confirmed
- Playwright UX testing
- AdGuard Home on NAS (permanent DNS fix)
- "Everything About a Family Member" report page
- AI perfume suggestions (rule-based first, Gemini optional)

### PWA Launcher — Built, not deployed in app
- Standalone `MyAppLauncher.html` — Home/Away toggle, PWA install, full CRUD
- Lives outside Ghrava — save to phone/PC directly
- No server dependency

---

## Architecture Rules (unchanged)
1. `window.api(method, path)` prepends `/api/v1` — never pass full path
2. `finance_accounts` (banking) ≠ `financial_accounts` (investment)
3. No `ON DELETE CASCADE`
4. No WAL journal mode — `journal_mode = DELETE`, `synchronous = FULL`
5. Always verify column names against live DB before writing route code
6. Migration simulation must run against actual live DB
7. `requireAuth` passes GET/HEAD always — only writes check session
8. Attachment routes never behind auth wall
9. Deploy zip from inside `ghrava/` directory
10. **Read `UI_STANDARDS.md` before any frontend work**
