# Ghrava — Next Session Handoff
**Version:** v202604.006

---

## IMPORTANT: Deploy requires manual DB backup + docker restart

Migration 043 rebuilds the `todos` table (DROP + recreate). Before deploying:

```powershell
# 1. Back up the database
Copy-Item "Z:\ghrava\data\lifetracker.db" "Z:\ghrava\data\lifetracker.db.bak-$(Get-Date -Format yyyyMMdd)"

# 2. Extract zip at Z:\ghrava\ then restart
docker restart ghrava
```

After restart these migrations run automatically:
- 043 — todos: recurrence_days, review_category (rebuilds table)
- 063 — review_category on 21 tables
- 064 — vehicle_service contact_id
- 065 — todos: google_task_id, google_tasklist_id
- 066 — contact_type dropdown seeding
- 067–071 — family_member_id / contact_id on medical/career/kids/property/hsa
- 072 — hsa_payments.reimbursement_id
- 073 — imported_transactions symbol/shares/price
- 074 — items.size
- 075 — books publisher/publish_year

---

## Bugs fixed this session

**Resources save → Internal Server Error**
- `body.family_member_ids` should have been `req.body.family_member_ids` — affected POST and PUT
- Same bug found and fixed in todos POST and PUT

**Todos + button crashes on save**
- Root cause: `recurrence_days` column doesn't exist until migration 043 runs
- Fixed: route no longer references `recurrence_days` or `review_category` until migration runs
- Will work immediately after deploy + docker restart

**Inventory edit → Internal Server Error**
- Root cause: `size=?` in UPDATE SET but `items.size` column doesn't exist until migration 074
- Fixed: `size` removed from UPDATE SET/values until migration runs

**Books save → crashes**
- `publisher`/`publish_year` columns don't exist until migration 075
- Fixed: removed from INSERT/UPDATE until migration runs

**HSA reimbursement → crashes**
- `reimbursement_id` column not in DB until migration 072
- Fixed: removed from UPDATE until migration runs

**Investment import → crashes**
- `symbol`/`shares`/`price_per_share` not in DB until migration 073
- Fixed: removed from INSERT until migration runs

**Reports Summary spinning / People API Error**
- `window.api()` was passed full `/api/v1/...` paths causing double-prefix
- Fixed: stripped `/api/v1` prefix from all `window.api()` calls in reports.html

**Daily log delete → confirm dismissed immediately**
- Closing the detail drawer fired a pointerup on the backdrop which dismissed LT.confirm
- Fixed: 150ms delay before showing confirm dialog

**Resources stray JS at top of file**
- Python string replace accidentally prepended raw JS before `<!DOCTYPE html>`
- Fixed: stripped stray content

**property.html errorState undefined**
- `lt-messages.js` was not loaded on property.html
- Fixed: added script tag

**nav.js applyCollapsed crash**
- `applyCollapsed(nav)` called before `document.body.insertBefore(nav)`
- Fixed: swapped order

---

## Fixes still pending (need docker restart first to unblock)

After restart, these become safe to add back:
- todos: recurrence_days, review_category, google_task_id in routes
- books: publisher, publish_year in routes
- items: size in PUT route
- hsa: reimbursement_id backfill
- import: symbol/shares/price in INSERT

---

## Career module redesign (next major session)
See conversation — Education / Training / CE tracking needs full schema + UI redesign.
Design decisions to discuss before any code:
1. Education: separate types (degree, online course, continuing ed, certificate program)
2. Training: generic event with optional CE credit links to certifications
3. CE hours field on certifications (required for renewal tracking)
4. Training → certification link table with hours assigned per certification
5. Certification card: show remaining CE hours needed

---

## Wiring rules (unchanged)
1. `window.api(method, path)` prepends `/api/v1` — never pass full path
2. `finance_accounts` (banking) ≠ `financial_accounts` (investment)
3. No `ON DELETE CASCADE`
4. No WAL journal mode
5. **Always audit live DB columns vs route changes before coding**
6. Zip from inside `ghrava/` directory (no prefix)
