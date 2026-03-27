# Ghrava — Household Management App

**Container:** `ghrava` | **Host:** 192.168.4.62:3001 | **NAS path:** `Z:\ghrava`
**Stack:** Node.js 20 + Express, SQLite (better-sqlite3), vanilla JS, Docker on QNAP TS-451

---

## Quick Start

```bash
# Deploy code changes (no package.json change)
docker restart ghrava

# Deploy with new npm packages
cd /share/Docker/ghrava && docker-compose up -d --build

# View logs
docker logs ghrava --tail 50

# Run smoke test (from Windows mapped drive)
bash Z:\ghrava\smoke-test.sh

# Run E2E tests (from Windows, requires Node + Playwright)
cd Z:\ghrava\tests && powershell -File run-tests.ps1
```

---

## URLs

| URL | Purpose |
|-----|---------|
| http://192.168.4.62:3001 | App home |
| http://192.168.4.62:3001/health | Health check |
| http://192.168.4.62:3001/data.html | Data export / import |
| http://192.168.4.62:3001/reports.html | Reports + Tools |
| http://192.168.4.62:3001/settings.html | Settings |

---

## Modules

| Module | Page | Routes prefix |
|--------|------|--------------|
| Dashboard | index.html | /api/v1/dashboard |
| Daily Log | daily-log.html | /api/v1/daily-log |
| Inventory | inventory.html | /api/v1/inventory |
| Medical | medical.html | /api/v1/medical |
| Finance + HSA | finance.html | /api/v1/finance, /api/v1/hsa, /api/v1/import |
| Todos | todos.html | /api/v1/todos |
| Books | books.html | /api/v1/books |
| Documents | documents.html | /api/v1/documents |
| Resources | resources.html | /api/v1/resources |
| Property | property.html | /api/v1/property |
| Career | career.html | /api/v1/career |
| Kids | kids.html | /api/v1/kids |
| Notifications | notifications.html | /api/v1/notifications |
| Reports | reports.html | (aggregates multiple APIs) |
| Settings | settings.html | /api/v1/settings |
| Data Manager | data.html | /api/v1/data |

---

## Key Architecture Rules

1. **requireAuth is a no-op** — `app/features/auth/middleware.js` calls `next()` unconditionally. Auth infrastructure preserved for future SSO.
2. **GET routes always before `router.use(requireAuth)`** in every route file.
3. **Tags** — always via `shared/tags.js` (`saveTagsByName`, `withTagNames`, `clearTags`). Never raw SQL.
4. **Family members** — always via `shared/familyMembers.js`.
5. **Dropdowns** — always `GH_SELECT` backed by `dropdown_options` table. No hardcoded `<option>` lists for growing data.
6. **Named entities** (person/place/contact) — always `GH_REFS` contact picker or `GH_SELECT`. Never freetext.
7. **One canonical form per record type** — if a record can be added from multiple screens, all screens call the same form (contact form lives in settings.html, surfaced via lt-refs.js iframe).
8. **No ON DELETE CASCADE** — ever.
9. **DB journal_mode=DELETE, synchronous=FULL** — never WAL.

---

## Deploy Pattern

```bash
# 1. Run smoke test first
bash Z:\ghrava\smoke-test.sh

# 2. Package (from Claude's container)
cd /home/claude/ghrava/ghrava
zip /home/claude/Ghrava_DEPLOY.zip [files] app/version.txt HANDOFF.md

# 3. Deploy to NAS
# Copy zip to Z:\ghrava, extract, then:
docker restart ghrava
```

---

## Data Export / Import

- **Export all data:** `GET /api/v1/data/export` → XLSX workbook, 20 module sheets
- **Import template:** `GET /api/v1/data/template` → blank workbook with headers + instructions
- **Import:** `POST /api/v1/data/import` → upload workbook, only present sheets processed
- **Restore key:** `id` column for most tables, `item_ref` for inventory items
- **Bank statements:** `POST /api/v1/import/preview` + `/confirm` → separate flow, supports CSV/XLSX/OFX/QFX

---

## Migrations

Migrations auto-apply on container start. Each file in `app/db/migrations/` runs once.
Adding a migration = creating a new numbered SQL file. `docker restart ghrava` applies it.

Current count: 047 migrations applied.

**Safe to apply (INSERT OR IGNORE / CREATE IF NOT EXISTS only):**
- 044: resource_category dropdown
- 045: finance_category, hsa_store dropdowns
- 046: import_category_rules table + 50 seed rules
- 047: vehicle_service_type, hsa_otc_category, financial_institution dropdowns

---

## Testing

- **Smoke test:** `bash smoke-test.sh` — 48 HTTP assertions against live container
- **E2E (Playwright):** `cd tests && powershell -File run-tests.ps1` — runs nightly at 2:30 AM
- **Test results:** visible in Reports → Testing tab in the app
