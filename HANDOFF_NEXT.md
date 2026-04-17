# Ghrava — Session 12 Handoff
**Last updated:** April 17, 2026

---

## Deploy Status
**Current deploy zip:** 35 files — `docker restart ghrava` only, no `--build`
**Working dir:** `/home/claude/ghrava_work/`

### Migrations in this deploy (run automatically on restart):
- 103 — kids_activity_season dropdown
- 104 — hsa_reimbursement_method dropdown
- 105 — container_subtype dropdown
- 106 — weather_config (lat/lon/city/units keys in app_config)

---

## Tomorrow's Priority List
1. **Deploy the zip** — 35 files, `docker restart ghrava`
2. **DuckDNS + Caddy + Tailscale HTTPS** → Google OAuth proper fix
3. **Test Google OAuth** after fix
4. **EOB import test** — Medical → EOB tab, drag a PDF
5. **PWA Launcher build** — standalone HTML, see spec below
6. **Install Tailscale on Windows PC**

---

## Infrastructure — Current State

### Network Setup
- NAS IP: `192.168.4.62`
- Ghrava: `http://192.168.4.62:3001` (direct) or `https://ghrava.home` (via Caddy)
- Caddy: running, reverse proxies all `.home` and `.local` services
- Tailscale: running on NAS as container `tailscale`, hostname `qnap-nas-36`, tailnet `tail73fb11.ts.net`
- Tailscale remote access confirmed working — use `http://[NAS-tailscale-ip]:3001`

### Caddy Fix Applied This Session
Ghrava's docker-compose was missing `home-core-net` network — was isolated from Caddy.
**Fixed:** Added `home-core-net` to Ghrava's compose and changed Caddyfile from IP to container name:
```
ghrava.local, ghrava.home {
    tls internal
    reverse_proxy http://ghrava:3001
}
```
`ghrava.home` confirmed working on PC (hosts file entry added).

### DNS Resolution Per Device
- **PC:** hosts file `C:\Windows\System32\drivers\etc\hosts` — `192.168.4.62 ghrava.home` (and other .home names)
- **Phone (WiFi):** AdGuard user rules — `||*.home^$dns=192.168.4.62` covers all `.home` names
- **Phone (mobile/away):** Tailscale enabled, use Tailscale IP directly. AdGuard and Tailscale cannot run simultaneously on Android (no root).

### Google OAuth — Still Broken
- Credentials saved correctly in `app_config` (confirmed via debug endpoint)
- Both UI bugs fixed: `auth_url` → `url` key, callback now redirects to `/settings.html?google_connected=1`
- **Blocker:** Google rejects private IPs and `.home`/`.local` domains as redirect URIs
- **Fix tomorrow:** DuckDNS free domain + Caddy HTTPS cert OR Tailscale `.ts.net` hostname with HTTPS cert
- Debug endpoint: `http://192.168.4.62:3001/api/v1/google/debug/connection`

### Tailscale Setup Notes
- Docker compose at `/share/Docker/home-core/tailscale/`
- Auth key in `.env` file alongside compose
- Start: `docker compose up -d` from that directory
- Verify: `docker exec tailscale tailscale status`
- NAS shows as `qnap-nas-36` in Tailscale admin at `https://login.tailscale.com/admin/machines`
- Remote access confirmed: Tailscale IP + port 3001 works from phone on mobile data

---

## Code Changes This Session

### Auth
- `middleware.js` — `requireAuth` now passes GET/HEAD always (design intent: reads never require password). Only POST/PUT/PATCH/DELETE check session. Also passes all methods when no password is configured (open mode).

### Navigation
- `nav.js` — Section chevrons now use chevron-down: `>` when collapsed, `v` when open. New modules added: wardrobe, perfume, insurance, subscriptions — all with proper icons and colors. SIDEBAR_SECTIONS restructured per MODULES_DESIGN.md (Daily, Finance, Household, Family, Personal, Reports, Admin).
- `shared.css` — Section label formatting: smaller/dimmer labels (9px, text3), separator lines between sections, clear visual hierarchy between labels and items.

### Selects → GH_SELECT (centralized dropdowns)
All previously hardcoded `<select>` elements now use `GH_SELECT.init()`:
- `career.html` — employment type → `career_job_type`
- `inventory.html` — location type, maintenance type, purchase method, item condition, container subtype
- `kids.html` — activity season → `kids_activity_season`
- `settings.html` — family relationship → `family_relationship`
- `finance.html` — HSA reimbursement method → `hsa_reimbursement_method`

**Intentionally left hardcoded (not user-configurable):**
- Medical controlled schedule (DEA federal classifications II–V)
- Watcher module picker (drives code routing logic)
- Settings module filter dropdowns
- Finance account type (drives banking vs investment routing)

### GH_PAGE key→module fixes
`wardrobe.html`, `subscriptions.html`, `insurance.html`, `notifications.html` — all fixed from `key:` to `module:` so page headers show correct icons and colors.

### Reports
- `reports.html` — Spending report now uses `/finance/reports/spending-by-category` (shows amounts + totals). Net worth render improved with large number display. Family snapshot now has member picker and loads real data.
- `server.js` — `finance/reports.js` registered at `/api/v1/finance/reports` (was missing — all 5 report endpoints were 404).

### Google OAuth
- `google/routes.js` — callback now redirects to `/settings.html?google_connected=1` on success (was sending plain HTML page). Errors redirect to `?google_error=...`.
- `settings.html` — `startGoogleOAuth()` checks `d.url` not `d.auth_url`. Client ID pre-filled from saved value on panel open. Secret field shows placeholder when already set.
- `google/routes.js` — status endpoint now returns `client_id` in response.

### Weather
- `server.js` — `/api/v1/app/weather` route added. Reads `OPENWEATHERMAP_API_KEY` from env, lat/lon from `app_config`, calls OpenWeatherMap 7-day forecast, 30-minute cache.
- `settings.html` — Infrastructure panel has Weather Location section (lat, lon, city). Loads saved values on open.

### Home Page
- `index.html` — Module grid updated to include wardrobe, perfume, insurance, subscriptions.

---

## PWA Launcher — Spec for Next Session
Standalone single HTML file, no server dependency.

**Requirements:**
- PWA — installs to home screen on Android and iOS (manifest.json + service worker inline)
- Add/edit/remove apps and categories
- Single URL per app
- 🏠 Home / 🌐 Away toggle — switches ALL app URLs at once (each app has two URL fields)
- localStorage for config persistence
- JSON export/import for backup
- Works fully offline once installed as PWA
- Based on existing `MyAppLauncher.html` (good foundation — keep the design)

**Do NOT host on Ghrava** — must be fully standalone so it works without any server

---

## API Keys — .env.secrets Template Updated
New entries added to `.env.secrets.copy.txt`:
- `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` — migrate out of app_config DB
- `OPENWEATHERMAP_API_KEY` — weather, free 1000/day
- `FRAGELLA_API_KEY` — perfume lookup, free 20/month, results cached in DB
- `GEMINI_API_KEY` — optional AI suggestions, free 250/day
- `GROQ_API_KEY` — optional AI suggestions, free 1000/day

**Note:** Google OAuth credentials are still in `app_config` DB. Moving to `.env.secrets` is planned but deferred until after OAuth is confirmed working.

---

## Backlog Items Confirmed This Session

### Ready to build
- Wardrobe/perfume module (design complete in MODULES_DESIGN.md)
  - `attributes` JSON column on `items` table
  - Fragella API lookup with DB cache (free tier 20 req/month — cache everything)
  - wardrobe_outfits, wardrobe_outfit_items, wardrobe_wear_log tables
  - Weather already wired in wardrobe.html, backend route now exists
- GET routes auth fix for Playwright/APK — move `requireAuth` off top-level in 8 modules (partially done — middleware now allows GETs through)
- Container subtype GH_SELECT — done this session ✓

### Deferred
- Google credentials migration from `app_config` to `.env.secrets` — after OAuth confirmed working
- DuckDNS setup for permanent Google OAuth + APK URL
- Playwright UX testing
- AdGuard Home on NAS (would fix all DNS issues permanently)
- "Everything About a Family Member" report page

---

## Architecture Rules (unchanged)
1. `window.api(method, path)` prepends `/api/v1` — never pass full path
2. `finance_accounts` (banking) ≠ `financial_accounts` (investment)
3. No `ON DELETE CASCADE`
4. No WAL journal mode — `journal_mode = DELETE`, `synchronous = FULL`
5. Always verify column names against live DB before writing route code
6. Migration simulation must run against actual live DB, not sandbox
7. `requireAuth` only in `settings/routes.js` and `watcher/routes.js` at router level — all other modules have it only on write routes (or rely on middleware GET exemption)
8. Attachment routes never behind auth wall — browsers can't send auth headers for `<img>` tags
9. Deploy zip packaged from inside `ghrava/` directory — `docker restart ghrava` only unless `package.json` changed
