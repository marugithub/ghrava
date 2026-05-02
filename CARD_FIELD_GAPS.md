# Card Field Gaps — What Cards Promise vs What Backend Delivers

**Status:** Audit complete, fixes pending
**Last updated:** 2026-05-01
**Scope:** Pages wired in v202604.118. Lists exact fields each card config reads,
whether they exist in the API response today, what they need to come alive.

This is the input list for the *next* session of backend work — once these
fields exist on API responses, cards will light up across the board with no
further frontend changes (configs already read from these names).

---

## Rollout model (as of v202604.118)

Cards are not a global flag. Each module's list page now offers **three views**
via the `GH_VIEW` toolbar:

- **Grid** (existing visual grid, e.g. wardrobe item thumbnails)
- **List** (existing dense rows, fast scan)
- **Card** (the v5 rich card from this design)

User toggle persists per module via localStorage. List/grid are the legacy
renderers, untouched. Card view calls into `GH_MOUNT.intoContainer` which
runs the page's data through field-mapping + derive into the registered card
config and renders via `GH_CARD.renderGrouped`.

**Wired pages with the 3-view toggle:** subscriptions, books, perfume,
insurance, documents, wardrobe, property (properties + vehicles share the
property toolbar).

**Deferred (need UX placement work for the toolbar):** finance.html (multi-tab
dashboard — accounts is one tab; where does the toolbar go?), career.html
(multi-section page — only certs has a toolbar today, jobs section needs one
of its own).

---

## Cross-cutting needs

These three subsystems block multiple cards. Implementing once unblocks many.

### 1. Transaction → Record linking
Owns: `tx_record_links`, `tx_link_rules` tables (see `TRANSACTION_LINKING_SPEC.md`).
Unblocks:
- Vehicle YTD fuel (per-vehicle, not household)
- Subscription `last_3_charges_total`, price-change detection
- Inventory `paid` linking to receipts
- Career cert renewal-fee tx
- HSA spent → eligible-match detection

### 2. Wear/use logging denormalization
Owns: `last_worn_at`, `times_worn`, `cost_per_wear` columns on `items` (wardrobe)
and `perfumes`. Today these live in `wardrobe_wear_log` / not at all.
Could be a derived view. Not a schema change for the source of truth — just a
denormalized read column updated by trigger when a wear entry is added.
Unblocks:
- Wardrobe stale-item alert ("not worn in 180+ days")
- Perfume `wears_ytd`, `last_worn_at`
- Outfit-of-the-day card (backlog)

### 3. Cross-module count joins
Owns: simple counts the API doesn't compute today. Some are easy (FKs already
exist), some need a schema migration first.

**Easy (FKs exist, just add subqueries):**
- `linked_subs_count` on `finance_accounts` — FK exists (`subscriptions.finance_account_id`) ✅ DONE in v202604.116
- `balance_change_30d` on `finance_accounts` — sum from `finance_transactions` ✅ DONE in v202604.116
- `attachment_count` on most modules — FK exists (`attachments.entity_type/entity_id`) — already done in many routes

**Schema gap (no FK between source and target):**
- `linked_certs_count`, `linked_ce_count` on `career_jobs` — no FK between `career_jobs` and `career_certifications` / `career_learning`. Needs `career_jobs_certs` junction table + UI to associate.
- `active_meds_count`, `related_visits_count` on `medical_conditions` — no FK between `med_conditions` and `med_medications` / `med_visits`. Both use plain-text `patient` field, no `condition_id` link. Needs `med_medications.condition_id` (and `med_visits.condition_id`) FK additions or junction table.
- `open_todos_count` on any module — no `source_module/source_record_id` FK on todos table.

Each schema gap is a real product decision: do users want to associate
medications to conditions explicitly (one-to-many or many-to-many)? Same
for jobs/certs. Until those decisions, the cards just don't render those
rows — the rest of the card still works.

---

## Per-module gap analysis

### Subscriptions ✅ wired, ⚠️ partial data
Card needs:
| Field | Status | Notes |
|---|---|---|
| service_name, plan_name | ✅ via fieldMap | name → service_name, plan → plan_name |
| brand_color, brand_wordmark | ✅ derived in page | category → color heuristic |
| next_charge_at | ✅ via fieldMap | next_billing_date |
| annual_cost | ✅ derived (cost × cycle multiplier) | |
| active_since | ✅ derived (from created_at) | |
| **last_3_charges_total** | ⚠️ provisional (cost × 3, amber asterisk) | Needs tx linking |
| **price_increased_recently, price_delta** | ❌ missing | Needs tx history scan |
| paying_account_brand, paying_account_color | ⚠️ via fieldMap (account_name) | Need brand color lookup |
| owner_family_member_id | ✅ via fieldMap | |
| shared_with_family, shared_count | ✅ derived (members.length) | |

### Finance accounts ✅ wired, ⚠️ partial data
| Field | Status | Notes |
|---|---|---|
| nickname, last_four, balance_current | ✅ via fieldMap | name, account_last4, current_balance |
| account_type | ✅ via fieldMap | type |
| bank_brand, bank_brand_color | ⚠️ derived (institution name → color lookup) | 9 banks mapped, others fall back |
| **balance_change_30d** | ❌ missing | Needs server-side tx-window query |
| **ytd_activity_count** | ⚠️ all-time count shown w/ amber asterisk | API has tx_count (lifetime), not YTD |
| **linked_subs_count** | ❌ missing | Easy join: SELECT COUNT(*) FROM subscriptions WHERE finance_account_id = ? |
| statement_gap_detected | ❌ missing | Needs gap-detection on imported_transactions |

### Books ✅ wired, ⚠️ thin data (schema gap)
| Field | Status | Notes |
|---|---|---|
| title, author, status, genre, format | ✅ direct | |
| cover_attachment_id | ✅ via fieldMap (primary_photo_id) | |
| **current_page, total_pages** | ❌ schema gap | books table has no page-tracking columns |
| **target_finish_at, pages_per_day_needed** | ❌ schema gap | Reading-session model needed |
| **pages_today, streak_days, pace_status** | ❌ schema gap | Same |
| reader_family_member_id | ✅ via fieldMap | |

**Schema work needed:** Add `total_pages, current_page, target_finish_date`
to `books`. Add `book_reading_sessions` table for per-day pages.

### Perfume ✅ wired, ⚠️ wear data missing
| Field | Status | Notes |
|---|---|---|
| name, brand, concentration, gender, size_ml | ✅ direct | |
| amount_level, status, rating, purchase_price | ✅ direct | |
| scent_family, season_tags | ✅ direct (already arrays) | |
| owner_family_member_id | ✅ direct | |
| photo_attachment_id | ⚠️ derived (primary_photo_id fallback) | |
| **last_worn_at, wears_ytd** | ❌ schema gap | Needs `perfume_wear_log` table or denormalized columns |

### Wardrobe ✅ wired, ⚠️ wear data missing
| Field | Status | Notes |
|---|---|---|
| Most fields | ✅ direct (wardrobe_* columns on items) | |
| photo_attachment_id | ⚠️ derived (primary_photo.id fallback) | |
| **last_worn_at, times_worn, cost_per_wear** | ❌ needs denormalization | Source: wardrobe_wear_log |

### Documents ✅ wired
| Field | Status | Notes |
|---|---|---|
| Most fields | ✅ direct | |
| **file_size, last_viewed_at, linked_records_count** | ❌ partial | file_size is in attachments table, not documents row. Last viewed/linked counts need new tracking. |

### Insurance ✅ wired
| Field | Status | Notes |
|---|---|---|
| provider_name, policy_type, policy_number | ✅ direct | |
| premium_amount, premium_frequency, deductible | ✅ direct | |
| coverage_end_date | ✅ direct | |
| provider_brand, provider_brand_color | ⚠️ derived (provider_name lookup) | |
| **claims_ytd** | ❌ missing | Needs claims tracking table — none exists yet |

### Properties ✅ wired
| Field | Status | Notes |
|---|---|---|
| nickname, property_type, address_* | ✅ direct | |
| current_est_value, mortgage_balance | ✅ direct | |
| **maintenance_ytd** | ❌ missing | Server-side join with maintenance records (none exist yet on properties) |
| **next_tax_due_at** | ❌ missing | Schema has property_tax_annual but no due-date tracking |

### Career — Jobs ✅ wired
| Field | Status | Notes |
|---|---|---|
| company, title, employment_type, location | ✅ direct | |
| start_date, end_date, is_current | ✅ direct (drives tenure progress bar) | |
| **linked_certs_count, linked_ce_count** | ❌ schema gap | No FK between career_jobs ↔ certifications/learning. Needs `career_jobs_certs` junction table + UI to associate certs with jobs (not implemented). Card cross-module strip stays empty for now. |
| **review_due_at** | ❌ missing | No schema for performance reviews yet |
| company_brand_color | ❌ missing | Could use brand-color lookup table |

### Vehicles ✅ wired (in property.html)
| Field | Status | Notes |
|---|---|---|
| make, model, year, body_type, color | ✅ direct | |
| odometer_current | ✅ via fieldMap (odometer) | |
| registration_expires_at | ✅ via fieldMap | |
| insurance_renewal_at | ✅ via fieldMap | |
| **ytd_fuel** | ❌ blocked on tx linking | See cross-cutting #1 |
| **service_ytd** | ❌ blocked on service_log → cost rollup | |
| **last_service_odometer, next_service_miles, service_interval_miles** | ⚠️ partial | Some installs have these, some don't. Needs schema standardization. |
| insurer_brand, insurer_brand_color | ⚠️ derived (insurance_carrier fallback) | |
| photo_attachment_id | ⚠️ direct or null | Vehicle photos optional |

---

## Recommended implementation order (next session)

Sorted by value × ease. Start at top, stop when out of time.

1. **Cross-module count joins** (cheap, unblocks 5 cards) — add subqueries to existing list routes for: `linked_subs_count` on finance_accounts, `linked_certs_count`+`linked_ce_count` on career_jobs, `active_meds_count`+`open_todos_count`+`related_visits_count` on medical_conditions.
2. **Wear log denormalization** — add `last_worn_at`+`times_worn` columns on `items` (wardrobe) and `perfumes`. Trigger or post-write update from wear log inserts.
3. **30-day balance delta** on finance_accounts — single query, light. `SELECT SUM(amount) FROM finance_transactions WHERE account_id=? AND date > date('now','-30 days')`.
4. **Brand-color lookup table** — small `brand_assets` table with `name, primary_color, fallback_initials`. Populate ~50 common brands. Used by every config that does brand-color heuristics today.
5. **Books schema expansion** — `total_pages`, `current_page`, `target_finish_date` columns. Optional: `book_reading_sessions` table for streak/pace.
6. **Transaction linking subsystem** (see `TRANSACTION_LINKING_SPEC.md`) — biggest item but unblocks the whole "where did my money go" story across vehicle, subscription, inventory, HSA, career.

Items 1-4 are 1-2 hours each. Item 5 is half a day. Item 6 is its own multi-session subsystem.
