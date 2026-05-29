# Module Functionality Reference (live-code-derived)

**Purpose:** canonical, append-only map of what each module actually does, read
from **live code** (never stale docs/SCHEMA.md). Check here BEFORE re-reading a
module's code so we don't burn tokens twice. Each section notes the date verified
and the source file(s).

> Convention: when a module's code is read for any task, capture its functionality
> here. If behavior changes in a later version, update the section + bump the
> "verified" date.

---

## inventory  —  `app/features/inventory/routes.js`
*(full feature map already maintained in memory: `ghrava-inventory-module`. Key facts
relevant to cross-module work below; see memory file for the exhaustive route list.)*
- Backing table: **`items`** (shared with wardrobe).
- `quantity` column exists; edits to it auto-log a `quantity_changed` event via `logEvent`.
- Per-item **event log** (`logEvent`) = inventory's memory layer; event types incl.
  `moved`, `condition_changed`, `quantity_changed`, `field_updated`, `archived`.
- **Sell** disposition built: `/items/:id/sell` sets `sold_*` + archives.
- Photo/doc upload routes added v.210 (`POST /items/:id/photos`, `/documents`).
- Containers, locations, categories, business tagging; import/export; comparison view.

## wardrobe  —  `app/features/wardrobe/routes.js`  *(verified 2026-05-28)*
**It is a typed VIEW over the `items` table** — NOT a separate table. Scoped by
`WARDROBE_CATEGORIES = ['Clothing','Shoes','Accessories','Jewelry','Hats','Bags']`.
- **Items** (`GET/PUT/DELETE /items`, `/items/:id`): reads `items` filtered to wardrobe
  categories + `wardrobe_*` columns. Rejects category drift outside wardrobe scope.
  Surfaces `times_worn`, `last_worn`, `primary_photo`, owner (`family_members`).
- **Wardrobe-specific columns on `items`**: `wardrobe_owner_id`, `wardrobe_sequence`,
  `wardrobe_nickname`, `wardrobe_color`, `season_tags`(JSON), `occasion_tags`(JSON),
  `wardrobe_status`(active/…), `wardrobe_status_date/notes`.
- **Disposition columns already present on `items`**: `sold_price/date/platform`,
  `donated_org_contact_id`, `donated_fmv` (fair-market value for tax!),
  `discarded_reason`. ← these are STORED but no effect propagates (no tax accrual).
- **Archive/unarchive**: `PATCH /items/:id/archive` (sets is_archived + wardrobe_status),
  `PUT /items/:id/unarchive`.
- **Outfits** (`wardrobe_outfits` + `wardrobe_outfit_items`): CRUD; photo derived from
  constituent items.
- **Planner** (`wardrobe_planner`): plan an outfit for a date/member.
- **Wear log** (`wardrobe_wear_log`): `POST /wear`, `GET /wear/:item_id`.
- **Insights** (`GET /insights`): total count/value, never-worn, not-worn-30d,
  most-worn + **cost-per-wear**, spend-by-member.

## perfume  —  `app/features/perfume/routes.js`  *(verified 2026-05-28)*
**Standalone `perfumes` table** — NOT `items`. Split for fragrance-specific schema.
- **Perfumes** (`GET / , /:id`, `POST /`, `PUT /:id`, `DELETE /:id`): brand,
  concentration, top/middle/base notes, `scent_family`(JSON), season/occasion tags,
  gender, `size_ml`, **`amount_level`** (Full/… = depletion concept), purchase price/date/from,
  owner (`family_members`), rating, **`status`** (active/…), barcode, Fragella cache fields.
- **Fragella lookup** (`GET /lookup/fragella?q=`): external fragrance API (needs
  `FRAGELLA_API_KEY`), DB-cached.
- **Layers** (`perfume_layers` + `perfume_layer_items`): layering sets w/ application order.
- Also: `perfume_outfit_pairs` (referenced on delete).
- Attachments use `entity_type='perfume'`.
- NO sell/donate disposition columns (has `status` + `amount_level` only).

## books  —  `app/features/books/routes.js`  *(verified 2026-05-28)*
**Standalone `books` table** — NOT `items`. Reading-list tracker.
- **Books** (`GET / , /stats`, `POST /`, `PUT /:id`, `DELETE /:id`): title, author,
  genre, **`status`** (Want to Read / Currently Reading / Read), rating, format
  (Physical/…), date_started/finished, ISBN, cover_url, pages_total/read.
- **Stats** (`GET /stats`): counts by status + avg rating.
- **Archive** (`PATCH /:id/archive`, `PUT /:id/unarchive`): uses `physical_status`,
  `physical_status_notes/date`, toggles `is_active`. ← books' disposition concept.
- **Cover fetch** (`POST /:id/fetch-cover`): downloads cover URL → sharp resize →
  `attachments` (`entity_type='book'`).
- Tags via central tags system (`entity_type='book'`); family-member links.
- ⚠️ **BUG (2026-05-28):** `fetch-cover`, `ensureBookDirs`, `downloadBuffer` are each
  declared TWICE (≈L186/273, L167/254, L171/258). Express uses the first `fetch-cover`
  route registered → the second handler (expects body `{url}`) is DEAD CODE; the live
  one expects `{cover_url}`. Duplicate `function` decls also shadow. Harmless today but
  should be de-duped.

---

## Cross-module takeaway (for the action-grammar work)
- **Disposition verbs (sell/donate/discard) belong on `items`** → automatically serve
  BOTH inventory and wardrobe (same rows). Wardrobe already has the columns.
- **perfume + books are separate tables but each have their own status/disposition
  concept** (perfume `status`+`amount_level`; books `physical_status`). A *generic*
  effect dispatcher keyed on `(entity_type, entity_id)` would unify all four —
  strongest argument for building the dispatcher generic, not per-module.

---
# Domain modules swept 2026-05-29 (live code)

## finance  —  `routes.js, budgets.js, forecast.js, reports.js`  *(verified 2026-05-29)*
- **Tables:** accounts, transactions, gift_cards, budgets, recurring_transactions,
  net_worth_snapshots, import_category_rules, holdings, hsa/fsa_payments, todos.
- **Verbs:** create/update/deactivate account, update-balance, create/update/void txn,
  import-transactions (CSV/XLSX, dedupe+autocat), clear-review, gift-card CRUD+balance,
  budget CRUD, save-net-worth-snapshot, category-rule add/delete/apply.
- **Cross-module effects (WIRED):** on import + on txn→medical category, fires
  `auto-link-hsa`, `auto-link-medical-visit`, `auto-link-subscriptions`,
  `auto-link-subscription-category`; writes `todos` on gift-card expiry; reads
  hsa/fsa/holdings for net-worth + cash-flow rollups.
- **Status:** accounts.is_active, gift_cards.is_active, txn.needs_review, txn.is_reconciled,
  budgets.is_active, hsa/otc.reimbursed.
- **Bugs:** reports.js still UNIONs legacy `finance_transactions`/`imported_transactions`
  vs unified `transactions`; manual POST txn skips category-rules (asymmetry w/ import).
- **Proposed verbs:** `reconcile`, `categorize`, `link-to-receipt`, `snapshot-net-worth`.

## hsa  —  `routes.js`  *(verified 2026-05-29)*
- **Tables:** hsa_payments, hsa_otc, hsa_reimbursements(+_items), hsa_payment_links,
  fsa_payments, fsa_plan_info, med_eob_claims, attachments, irs_mileage_rates.
- **Verbs:** plan CRUD, payment CRUD(+csv), otc CRUD(+csv), create/delete-reimbursement
  (txn marks all linked payments+otc reimbursed=1 / reverses), payment-link add/delete
  (polymorphic: medication/visit/condition/eob_claim), inbox promote-draft/reject,
  upload-receipts, link-eob, create-mileage-companion (IRS rates), fsa payment+plan CRUD.
- **Cross-module effects (WIRED):** on create-payment fires `eob-hsa-matcher` → matches
  `med_eob_claims` by patient+date±30d+amount±$2, writes `record_links`; reads record_links
  for linked entities; reads med_eob_claims.
- **Status:** reimbursed, status(draft/final), hsa_eligible, fsa_plan_info.active.
- **Bugs:** `auto-link-hsa.js:37-38` SELECTs `hsa_payments.family_member_id` that may not
  exist; payments hard-delete vs finance soft-delete (inconsistent).
- **Proposed verbs:** `reimburse`, `link-to-visit`, `link-to-eob`, `record-mileage`, `mark-eligible`.

## trading  —  `routes.js`  *(verified 2026-05-29)*
- **Tables:** holdings, financial_accounts, portfolio_snapshots (all READ-ONLY); documents (write).
- **Verbs:** save-trading-data (trading.json), save-analysis-report (file), delete-report,
  save-analysis-to-ghrava (→ documents row + tag).
- **Cross-module effects (WIRED):** read-only of holdings/financial_accounts/snapshots for
  live portfolio/correlation/earnings; writes `documents` on save-to-ghrava.
- **Status:** demoMode flag; report type field.
- **Bugs:** trading.json deep-merge only merges apiKeys (new settings fields lost);
  save-to-ghrava dedupe by title+timestamp ~never triggers.
- **Proposed verbs:** `save-report`, `archive-analysis`. (Mostly self-contained / external APIs.)

## medical  —  `routes.js, eob-hsa-matcher.js, dedup.js` + shared auto-linkers  *(verified 2026-05-29)*
- **Tables:** med_medications/conditions/visit_notes/(junctions)/fills/dose_changes/
  condition_metrics/lab_results/diagnostics/allergies/vitals/immunizations/procedures/
  eob_*; hsa_payments; med_pending_review; record_links.
- **Verbs:** medication CRUD + record-fill (auto-bumps next_refill, decrements refills) +
  reactivate + link/unlink-condition; condition CRUD + record/delete-metric; visit CRUD;
  immunization/procedure create; import-eob (parse PDF → auto-link claims→hsa_payments via
  record_links, queue re-issued for review). (labs/diagnostics/allergies/vitals are read-only.)
- **Cross-module effects (WIRED — richest):** EOB import → hsa_payments link (eob_claim_id +
  record_links, confidence tiers); `auto-link-hsa` creates hsa_payment from HSA txn + links;
  `auto-link-medical-visit` matches txn vendor→care contact→visit, links txn↔visit;
  EOB review queues auto-create todos.
- **Status:** medication.status(Active/AsNeeded/Monitoring/Discontinued/Resolved/Completed),
  visit.follow_up_needed, immunization.next_due_date, procedure.status, refill cycle,
  pending_review.status.
- **Bugs:** none in core (defensive table-existence guards throughout).
- **Proposed verbs:** `receive-care`, `log-medication-fill`, `match-eob-to-hsa`, `auto-fund-hsa-payment`.

## maintenance  —  `routes.js`  *(verified 2026-05-29)*
- **Tables:** property_maintenance, vehicle_service, item_maintenance_log (reads); writes via property module.
- **Verbs:** complete / reopen property-maintenance. (All create/update live in `property`.)
- **Cross-module effects (WIRED):** `/upcoming` aggregates property_maintenance +
  vehicle_service + item_maintenance_log into ONE "next 90 days" list; `/summary` rolls up
  overdue + due-30d across all three. **This is a partial recurring-obligation surface.**
- **Status:** is_completed, completed_date, next_due_date(+next_due_miles for vehicles).
- **Bugs:** none (read+PATCH only by design).
- **Proposed verbs:** `complete-maintenance`, `schedule-next-service` (next_due not auto-calc'd today).
- **NOTE:** vehicles live under the `property` module, NOT a standalone module.

## property  —  `routes.js`  *(verified 2026-05-29)*
- **Tables:** properties, vehicles, vehicle_service, property_maintenance; contacts/family_members/tags/attachments.
- **Verbs:** property CRUD(soft-del), vehicle CRUD(soft-del), record/delete vehicle-service,
  property-maintenance create/update/complete/reopen/delete.
- **Cross-module effects (WIRED):** tags + family_members on properties/vehicles; contacts FKs
  (vendor/lender/insurance contact). No record_links.
- **Status:** is_active, vehicle reg/inspection expiry (stored not enforced), next_due_date,
  is_completed, warranty_expiry (stored not queried).
- **Bugs:** ⚠️ property_maintenance routes defined AFTER `module.exports` (lines 305-382) →
  potentially unreachable; verify they actually register.
- **Proposed verbs:** `acquire-asset`, `service-asset`, `retire-asset`, `track-ownership`.

## career  —  `routes.js, learning.js`  *(verified 2026-05-29)*
- **Tables:** career_certifications/jobs/skills/goals/learning/learning_certs; todos.
- **Verbs:** cert CRUD + renew (validate CE hours → advance cycle) + link-training; job CRUD
  (one is_current); skill CRUD; goal CRUD; learning CRUD(+cert links).
- **Cross-module effects (WIRED):** creates renewal `todos` 60d before cert expiry.
- **Status:** cert Active/InProgress/Expired (via expiry), job.is_current, goal.status,
  **CE accumulator:** learning_certs.hours_applied → cert.ce_hours_required within cycle window.
- **Bugs:** renewal todo fails silently if todos table missing.
- **Proposed verbs:** `log-learning`, `accrue-CE-hours`, `complete-renewal-cycle`. *(accumulator→deadline pattern lives here.)*

## kids  —  `routes.js`  *(verified 2026-05-29)*
- **Tables:** kids, kid_activities, kid_notes; family_members + med_visit_notes (read-only).
- **Verbs:** kid create/update/archive(soft); activity CRUD; note CRUD.
- **Cross-module effects (WIRED):** reads med_visit_notes WHERE patient=kid.display_name
  (fragile string match); syncs kids from family_members (relationship IN Son/Daughter/...) on every GET.
- **Status:** kid.is_active, activity.is_active+season, note category.
- **Bugs:** sync runs every GET (no debounce); display_name match fragile; kid soft-del but
  activities hard-del (inconsistent cascade).
- **Proposed verbs:** `record-note`, `archive-kid`, `sync-family-roster`.

## family-snapshot  —  `routes.js`  *(verified 2026-05-29)*
- **READ-ONLY aggregation surface** (no verbs). Aggregates medical, kids, items, wardrobe,
  insurance, subscriptions, memories, todos, books into `/:id/json` + `/:id/html` report.
- **Cross-module effects:** reads ~15 tables; every section wrapped in safe() try-catch so
  schema drift never crashes. Book links via record_links polymorphic (mostly empty today).
- **Bugs:** references nonexistent kids.school_name (silently omitted); todos matched by name LIKE.
- **Proposed verbs:** n/a (read surface). Could expose `export-family-snapshot`.

## insurance  —  `routes.js`  *(verified 2026-05-29)*
- **Tables:** insurance_policies, insurance_policy_members, insurance_attachments; contacts/vehicles/properties FKs.
- **Verbs:** create, update, **renew** (mark old expired, create new in same policy_group_id
  chain, copy members), delete.
- **Cross-module effects:** none found (FK lookups only — NOT linked to vehicles/property as effects).
- **Status:** status(active/expired/cancelled), alert_days_before, coverage_end_date.
- **Bugs:** none spotted.
- **Proposed verbs:** `renew` (built), add `cancel`.

## subscriptions  —  `routes.js`  *(verified 2026-05-29)*
- **Tables:** subscriptions, subscription_members; finance_accounts/contacts FKs.
- **Verbs:** create, update, delete.
- **Cross-module effects (WIRED):** `auto-link-subscriptions` writes record_links
  (subscription→transaction, kind='pays_for') on import match by name+amount;
  `auto-link-subscription-category` copies subscription.category onto the transaction.
- **Status:** status(active/paused/cancelled), auto_renew, next_billing_date.
- **Bugs:** none spotted.
- **Proposed verbs:** `pause`, `resume`, `renew`.

## receipts  —  `routes.js`  *(verified 2026-05-29)*
- **MISNAMED:** NOT a receipt tracker. It's an insurance-inventory-report + field-template
  utility. Reads items/locations/attachments; manages field_templates.
- **Verbs:** save-template, record-template-use.
- **Cross-module effects:** none (read-only inventory report).
- **Bugs:** module name misleading; receipt OCR explicitly omitted (comment routes.js:5-6).
- **Proposed verbs:** rename → `inventory-reports`/`templates`. *(The real "receipt→item+txn"
  ingest verb does NOT exist yet — it's a gap, not a built feature.)*

## documents  —  `routes.js`  *(verified 2026-05-29)*  ← PROOF SPINE
- **Tables:** documents, document_item_links, taggables, record_family_members, attachments.
- **Verbs:** create/update/archive/unarchive/delete document; add/remove document↔item link.
- **Cross-module effects (WIRED):** document_item_links joins `items` (a doc backs an item).
  Only items linking exists today — not yet certs/warranties/policies.
- **Status:** is_active (archive), archive_reason.
- **Bugs:** ⚠️ `routes.js:98` calls undefined `withTags(doc)` (should be withTagNames);
  `:120` passes a stray 'document' arg to db.prepare.
- **Proposed verbs:** `link-document-to-item` (generalize → back any entity = proof spine).

## dailylog  —  `routes.js`  *(verified 2026-05-29)*  ← MEMORY LAYER
- **Tables:** daily_log, memory_members, taggables, attachments.
- **Verbs:** create-entry, update-entry, patch-entry, delete-entry, quick-capture.
- **Cross-module effects (WIRED):** patch writes `promoted_to_type`/`promoted_to_id` —
  an entry can be PROMOTED into a todo/visit/note. memory_members joins family_members.
- **Status:** follow_up_needed, follow_up_date, is_memory, promoted_to_type/id.
- **Bugs:** none spotted.
- **Proposed verbs:** `promote-to-todo/visit/note`, `mark/clear-follow-up`. *(raw events land here → surface upstream.)*

## todos  —  `routes.js + shared/autoTodos.js`  *(verified 2026-05-29)*  ← OBLIGATION SURFACER
- **Tables:** todos, taggables, record_family_members, attachments; READS (no write) 9 modules:
  hsa_payments/otc, items/item_hw_details, daily_log, med_medications, med_visit_notes,
  vehicles/vehicle_service, properties/property_maintenance, import_batch.
- **Verbs:** create, update, set-status (spawns next recurrence if recurring+done), snooze,
  bulk-complete, delete; **auto-sync** on every GET.
- **Cross-module effects (WIRED — this is the moat's surfacing layer):** `syncAutoTodos()` +
  `syncMedRefillTodos()` scan 9 modules and upsert/resolve auto-todos
  (auto_type e.g. hsa_missing_receipt, inv_expiring, follow_up_overdue, med refills) with
  auto_source_type/id back-pointers; idempotent upsert/resolve.
- **Status:** status(open/in_progress/done/dismissed), is_auto, completed_at, auto_type,
  auto_source_type/id, recurrence/recurrence_days.
- **Bugs:** none spotted.
- **Proposed verbs:** `complete`, `dismiss`, `snooze`, `auto-sync`, `spawn-recurrence`.
  **→ The "recurring obligation → surface before it lapses" pattern is ALREADY BUILT here.**
