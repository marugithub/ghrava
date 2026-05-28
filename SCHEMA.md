# SCHEMA.md — Ghrava database reference

> **Auto-generated** by `.claude/skills/ghrava-schema-safety/scripts/gen-schema-doc.py`
> Last generated: `2026-05-28T02:43:43.881187Z`
> Sources: migration replay (145 files in `app/db/migrations/`) + prod query (ghrava container)
>
> When sources disagree, **prod is canonical**. See DRIFT section below.
>
> **DO NOT EDIT BY HAND.** This file is regenerated before every package.

## Summary

- **prod tables: 165**
- **migration-replay tables: 124**
- **drift: 51 (46 prod-only, 5 migration-only)**
- **prod columns total: 2010**

## DRIFT — tables exist on prod but NOT in migrations

| Table | Row count |
|---|---|
| `_account_id_map` | 3 |
| `_batch_id_map` | 0 |
| `_legacy_fin_import_batches` | 0 |
| `_legacy_finance_accounts` | 2 |
| `_legacy_finance_transactions` | 76 |
| `_legacy_financial_accounts` | 1 |
| `_legacy_holdings` | 0 |
| `_legacy_import_batches` | 0 |
| `_legacy_imported_transactions` | 0 |
| `_migrations` | 145 |
| `_migrations_autolinker_done` | 1 |
| `_migrations_cc_columns_done` | 1 |
| `_migrations_finance_unify_done` | 1 |
| `_migrations_fingerprint_v2_done` | 1 |
| `_migrations_fsa_plan_extension_done` | 1 |
| `_migrations_hsa_plan_renamed_done` | 1 |
| `_migrations_hsa_to_fsa_copy_done` | 1 |
| `_migrations_hsa_to_fsa_retry_done` | 1 |
| `_migrations_med_immunizations_done` | 1 |
| `_migrations_med_procedures_done` | 1 |
| `_migrations_medical_expansion_done` | 1 |
| `_migrations_record_links_done` | 1 |
| `_migrations_rescue_126_done` | 1 |
| `_sessions` | 124 |
| `annual_checklist_items` | 35 |
| `annual_checklist_status` | 0 |
| `beneficiaries` | 0 |
| `ce_hours` | 0 |
| `certifications` | 0 |
| `credit_cards` | 0 |
| `doctor_visit_notes` | 0 |
| `estate_documents` | 0 |
| `federal_benefits` | 0 |
| `fers_inputs` | 0 |
| `gift_log` | 0 |
| `important_dates` | 0 |
| `insurance` | 0 |
| `loans_debt` | 0 |
| `medical_conditions` | 0 |
| `medications` | 0 |
| `qnap_share_paths` | 0 |
| `retirement_contributions` | 0 |
| `stock_price_history` | 0 |
| `stock_transactions` | 0 |
| `tax_documents` | 0 |
| `tsp_allocation` | 0 |

## DRIFT — tables in migrations but NOT on prod

| Migration-replay name |
|---|
| `annual_checklist` |
| `checklist_completions` |
| `holdings_v2` |
| `hsa_payments_new` |
| `import_batches_v2` |

## DRIFT — column-level differences (tables present in both)

### Columns on prod but NOT in migrations

| Table | Column |
|---|---|
| `accounts_beneficiaries` | `account_type` |
| `accounts_beneficiaries` | `acct_last4` |
| `accounts_beneficiaries` | `annual_fee` |
| `accounts_beneficiaries` | `annual_fee_renewal_date` |
| `accounts_beneficiaries` | `apr` |
| `accounts_beneficiaries` | `beneficiary_contingent` |
| `accounts_beneficiaries` | `beneficiary_last_reviewed` |
| `accounts_beneficiaries` | `beneficiary_primary` |
| `accounts_beneficiaries` | `credit_limit` |
| `accounts_beneficiaries` | `current_titling` |
| `accounts_beneficiaries` | `institution_id` |
| `accounts_beneficiaries` | `intended_titling` |
| `accounts_beneficiaries` | `login_reference` |
| `accounts_beneficiaries` | `minimum_payment` |
| `accounts_beneficiaries` | `nickname` |
| `accounts_beneficiaries` | `owner_id` |
| `accounts_beneficiaries` | `payment_due_date` |
| `accounts_beneficiaries` | `promo_apr` |
| `accounts_beneficiaries` | `promo_end_date` |
| `accounts_beneficiaries` | `rewards_balance` |
| `accounts_beneficiaries` | `statement_balance` |
| `accounts_beneficiaries` | `status` |
| `accounts_beneficiaries` | `tod_pod` |
| `books` | `review_category` |
| `career_certifications` | `review_category` |
| `career_goals` | `review_category` |
| `career_jobs` | `review_category` |
| `career_skills` | `review_category` |
| `contacts` | `last_contacted` |
| `contacts` | `review_category` |
| `containers` | `photo_path` |
| `daily_log` | `review_category` |
| `documents` | `review_category` |
| `family_members` | `photo_path` |
| `family_members` | `review_category` |
| `fin_import_batches` | `error_message` |
| `fin_import_batches` | `notes` |
| `fin_import_batches` | `rows_flagged` |
| `fin_import_batches` | `rows_skipped` |
| `fin_import_batches` | `statement_date` |
| `fin_import_batches` | `status` |
| `financial_accounts` | `tax_treatment` |
| `hsa_payments` | `review_category` |
| `hsa_plan_info_DEPRECATED_v167` | `carrier_id` |
| `import_batches` | `notes` |
| `items` | `disposed_reason` |
| `items` | `review_category` |
| `kids` | `review_category` |
| `locations` | `photo_path` |
| `med_conditions` | `review_category` |
| `med_medications` | `review_category` |
| `net_worth_snapshots` | `asset_brokerage` |
| `net_worth_snapshots` | `asset_car_value` |
| `net_worth_snapshots` | `asset_checking` |
| `net_worth_snapshots` | `asset_home_value` |
| `net_worth_snapshots` | `asset_hsa` |
| `net_worth_snapshots` | `asset_ibonds` |
| `net_worth_snapshots` | `asset_other` |
| `net_worth_snapshots` | `asset_roth_a` |
| `net_worth_snapshots` | `asset_roth_z` |
| `net_worth_snapshots` | `asset_savings` |
| `net_worth_snapshots` | `asset_trad_ira` |
| `net_worth_snapshots` | `asset_tsp` |
| `net_worth_snapshots` | `liability_auto` |
| `net_worth_snapshots` | `liability_cc` |
| `net_worth_snapshots` | `liability_mortgage` |
| `net_worth_snapshots` | `liability_other` |
| `net_worth_snapshots` | `snapshot_year` |
| `properties` | `review_category` |
| `resources` | `review_category` |
| `vehicles` | `insurance_contact_id` |
| `vehicles` | `review_category` |

### Columns in migrations but NOT on prod

| Table | Column |
|---|---|
| `accounts_beneficiaries` | `alias` |
| `accounts_beneficiaries` | `balance_as_of` |
| `accounts_beneficiaries` | `currency` |
| `accounts_beneficiaries` | `current_balance` |
| `accounts_beneficiaries` | `include_net_worth` |
| `accounts_beneficiaries` | `institution` |
| `accounts_beneficiaries` | `is_active` |
| `accounts_beneficiaries` | `last4` |
| `accounts_beneficiaries` | `name` |
| `accounts_beneficiaries` | `needs_review` |
| `accounts_beneficiaries` | `owner` |
| `accounts_beneficiaries` | `sort_order` |
| `accounts_beneficiaries` | `source` |
| `accounts_beneficiaries` | `track_statements` |
| `accounts_beneficiaries` | `type` |
| `app_config` | `updated_at` |
| `finance_accounts` | `alias` |
| `finance_accounts` | `annual_fee` |
| `finance_accounts` | `annual_fee_renewal_date` |
| `finance_accounts` | `apr` |
| `finance_accounts` | `contact_id` |
| `finance_accounts` | `credit_limit` |
| `finance_accounts` | `institution_contact_id` |
| `finance_accounts` | `minimum_payment` |
| `finance_accounts` | `payment_due_date` |
| `finance_accounts` | `promo_apr` |
| `finance_accounts` | `promo_end_date` |
| `finance_accounts` | `rewards_balance` |
| `finance_accounts` | `rewards_program` |
| `finance_accounts` | `statement_balance` |
| `finance_accounts` | `statement_date` |
| `financial_accounts` | `account_number` |
| `financial_accounts` | `alias` |
| `financial_accounts` | `annual_fee` |
| `financial_accounts` | `annual_fee_renewal_date` |
| `financial_accounts` | `apr` |
| `financial_accounts` | `credit_limit` |
| `financial_accounts` | `institution_contact_id` |
| `financial_accounts` | `minimum_payment` |
| `financial_accounts` | `payment_due_date` |
| `financial_accounts` | `promo_apr` |
| `financial_accounts` | `promo_end_date` |
| `financial_accounts` | `rewards_balance` |
| `financial_accounts` | `rewards_program` |
| `financial_accounts` | `statement_balance` |
| `financial_accounts` | `statement_date` |
| `fsa_payments` | `raw_payload` |
| `fsa_payments` | `source_filename` |
| `fsa_payments` | `source_format` |
| `holdings` | `raw_payload` |
| `holdings` | `source_filename` |
| `holdings` | `source_format` |
| `hsa_otc` | `receipt_location` |
| `hsa_payments` | `raw_payload` |
| `hsa_payments` | `source_filename` |
| `hsa_payments` | `source_format` |
| `hsa_plan_info_DEPRECATED_v167` | `created_at` |
| `import_batches` | `error_message` |
| `import_batches` | `raw_headers` |
| `import_batches` | `rows_flagged` |
| `import_batches` | `rows_inserted` |
| `import_batches` | `rows_skipped` |
| `import_batches` | `source_format` |
| `import_batches` | `status` |
| `imported_transactions` | `fx_amount` |
| `imported_transactions` | `fx_currency` |
| `imported_transactions` | `fx_rate` |
| `imported_transactions` | `normalized_description` |
| `imported_transactions` | `pending_or_posted` |
| `imported_transactions` | `price_per_share` |
| `imported_transactions` | `raw_headers` |
| `imported_transactions` | `raw_payload` |
| `imported_transactions` | `shares` |
| `imported_transactions` | `source_filename` |
| `imported_transactions` | `source_format` |
| `imported_transactions` | `symbol` |
| `items_fts` | `manufacturer` |
| `items_fts` | `store_name` |
| `items_fts` | `upc_barcode` |
| `med_eob_balances` | `raw_payload` |
| `med_eob_claims` | `raw_payload` |
| `med_eob_services` | `raw_payload` |
| `med_eob_statements` | `raw_payload` |
| `med_eob_statements` | `source_format` |
| `record_links` | `created_by` |

## Tables (prod-true)

### `_account_id_map`  [in:prod-only]

_Origin: not found in any migration (prod-only table)._

| Column | Type | NN | Default | PK |
|---|---|---|---|---|
| `old_table` | TEXT | ✓ |  | ✓ |
| `old_id` | INTEGER | ✓ |  | ✓ |
| `new_id` | INTEGER | ✓ |  |  |

  _(rows: 3)_

### `_batch_id_map`  [in:prod-only]

_Origin: not found in any migration (prod-only table)._

| Column | Type | NN | Default | PK |
|---|---|---|---|---|
| `old_id` | INTEGER |  |  | ✓ |
| `new_id` | INTEGER | ✓ |  |  |

  _(rows: 0)_

### `_legacy_fin_import_batches`  [in:prod-only]

_Origin: not found in any migration (prod-only table)._

| Column | Type | NN | Default | PK |
|---|---|---|---|---|
| `id` | INTEGER |  |  | ✓ |
| `account_id` | INTEGER | ✓ |  |  |
| `account_type` | TEXT | ✓ | `'banking'` |  |
| `filename` | TEXT |  |  |  |
| `format` | TEXT |  |  |  |
| `rows_total` | INTEGER | ✓ | `0` |  |
| `rows_imported` | INTEGER | ✓ | `0` |  |
| `imported_at` | DATETIME |  | `CURRENT_TIMESTAMP` |  |

  _(rows: 0)_

### `_legacy_finance_accounts`  [in:prod-only]

_Origin: not found in any migration (prod-only table)._

| Column | Type | NN | Default | PK |
|---|---|---|---|---|
| `id` | INTEGER |  |  | ✓ |
| `name` | TEXT | ✓ |  |  |
| `type` | TEXT | ✓ | `'Checking'` |  |
| `institution` | TEXT |  |  |  |
| `account_last4` | TEXT |  |  |  |
| `current_balance` | REAL | ✓ | `0` |  |
| `balance_as_of` | DATE |  |  |  |
| `is_active` | INTEGER | ✓ | `1` |  |
| `include_net_worth` | INTEGER | ✓ | `1` |  |
| `notes` | TEXT |  |  |  |
| `sort_order` | INTEGER | ✓ | `0` |  |
| `created_at` | DATETIME |  | `CURRENT_TIMESTAMP` |  |
| `updated_at` | DATETIME |  | `CURRENT_TIMESTAMP` |  |
| `contact_id` | INTEGER |  |  |  |
| `institution_contact_id` | INTEGER |  |  |  |

  _(rows: 2)_

### `_legacy_finance_transactions`  [in:prod-only]

_Origin: not found in any migration (prod-only table)._

| Column | Type | NN | Default | PK |
|---|---|---|---|---|
| `id` | INTEGER |  |  | ✓ |
| `account_id` | INTEGER | ✓ |  |  |
| `date` | DATE | ✓ |  |  |
| `description` | TEXT | ✓ |  |  |
| `amount` | REAL | ✓ |  |  |
| `category` | TEXT |  |  |  |
| `notes` | TEXT |  |  |  |
| `is_reconciled` | INTEGER | ✓ | `0` |  |
| `created_at` | DATETIME |  | `CURRENT_TIMESTAMP` |  |
| `batch_id` | INTEGER |  |  |  |

  _(rows: 76)_

### `_legacy_financial_accounts`  [in:prod-only]

_Origin: not found in any migration (prod-only table)._

| Column | Type | NN | Default | PK |
|---|---|---|---|---|
| `id` | INTEGER |  |  | ✓ |
| `nickname` | TEXT | ✓ |  |  |
| `institution` | TEXT | ✓ |  |  |
| `account_type` | TEXT | ✓ |  |  |
| `owner` | TEXT |  |  |  |
| `last_four` | TEXT |  |  |  |
| `currency` | TEXT | ✓ | `'USD'` |  |
| `is_active` | INTEGER | ✓ | `1` |  |
| `track_statements` | INTEGER | ✓ | `1` |  |
| `notes` | TEXT |  |  |  |
| `created_at` | DATETIME |  | `CURRENT_TIMESTAMP` |  |
| `updated_at` | DATETIME |  | `CURRENT_TIMESTAMP` |  |
| `account_number` | TEXT |  |  |  |
| `institution_contact_id` | INTEGER |  |  |  |

  _(rows: 1)_

### `_legacy_holdings`  [in:prod-only]

_Origin: not found in any migration (prod-only table)._

| Column | Type | NN | Default | PK |
|---|---|---|---|---|
| `id` | INTEGER |  |  | ✓ |
| `account_id` | INTEGER | ✓ |  |  |
| `symbol` | TEXT | ✓ |  |  |
| `name` | TEXT |  |  |  |
| `asset_type` | TEXT |  | `'stock'` |  |
| `shares` | REAL | ✓ | `0` |  |
| `cost_basis` | REAL |  |  |  |
| `price` | REAL |  |  |  |
| `price_date` | DATE |  |  |  |
| `market_value` | REAL |  |  |  |
| `created_at` | DATETIME |  | `CURRENT_TIMESTAMP` |  |
| `updated_at` | DATETIME |  | `CURRENT_TIMESTAMP` |  |
| `total_cost_basis` | REAL |  |  |  |
| `gain_loss_dollar` | REAL |  |  |  |
| `gain_loss_pct` | REAL |  |  |  |
| `day_change_dollar` | REAL |  |  |  |
| `day_change_pct` | REAL |  |  |  |
| `week52_low` | REAL |  |  |  |
| `week52_high` | REAL |  |  |  |
| `reinvest_dividends` | INTEGER |  |  |  |
| `dividend_yield` | REAL |  |  |  |
| `last_dividend_date` | DATE |  |  |  |
| `annual_dividend` | REAL |  |  |  |

  _(rows: 0)_

### `_legacy_import_batches`  [in:prod-only]

_Origin: not found in any migration (prod-only table)._

| Column | Type | NN | Default | PK |
|---|---|---|---|---|
| `id` | INTEGER |  |  | ✓ |
| `account_id` | INTEGER | ✓ |  |  |
| `filename` | TEXT | ✓ |  |  |
| `statement_date` | DATE |  |  |  |
| `statement_month` | TEXT |  |  |  |
| `format` | TEXT |  |  |  |
| `rows_total` | INTEGER |  | `0` |  |
| `rows_inserted` | INTEGER |  | `0` |  |
| `rows_skipped` | INTEGER |  | `0` |  |
| `rows_flagged` | INTEGER |  | `0` |  |
| `status` | TEXT |  | `'pending'` |  |
| `error_message` | TEXT |  |  |  |
| `imported_at` | DATETIME |  | `CURRENT_TIMESTAMP` |  |

  _(rows: 0)_

### `_legacy_imported_transactions`  [in:prod-only]

_Origin: not found in any migration (prod-only table)._

| Column | Type | NN | Default | PK |
|---|---|---|---|---|
| `id` | INTEGER |  |  | ✓ |
| `account_id` | INTEGER | ✓ |  |  |
| `batch_id` | INTEGER | ✓ |  |  |
| `txn_date` | DATE | ✓ |  |  |
| `post_date` | DATE |  |  |  |
| `description` | TEXT | ✓ |  |  |
| `amount` | REAL | ✓ |  |  |
| `balance` | REAL |  |  |  |
| `category` | TEXT |  |  |  |
| `txn_type` | TEXT |  | `'transaction'` |  |
| `is_transfer` | INTEGER | ✓ | `0` |  |
| `memo` | TEXT |  |  |  |
| `fingerprint` | TEXT | ✓ |  |  |
| `flagged` | INTEGER | ✓ | `0` |  |
| `created_at` | DATETIME |  | `CURRENT_TIMESTAMP` |  |
| `symbol` | TEXT |  |  |  |
| `shares` | REAL |  |  |  |
| `price_per_share` | REAL |  |  |  |

  _(rows: 0)_

### `_migrations`  [in:prod-only]

_Origin: not found in any migration (prod-only table)._

| Column | Type | NN | Default | PK |
|---|---|---|---|---|
| `id` | INTEGER |  |  | ✓ |
| `filename` | TEXT | ✓ |  |  |
| `applied_at` | DATETIME |  | `CURRENT_TIMESTAMP` |  |

  _(rows: 145)_

### `_migrations_autolinker_done`  [in:prod-only]

_Origin: not found in any migration (prod-only table)._

| Column | Type | NN | Default | PK |
|---|---|---|---|---|
| `id` | INTEGER |  |  | ✓ |
| `applied_at` | DATETIME |  | `CURRENT_TIMESTAMP` |  |
| `notes` | TEXT |  |  |  |

  _(rows: 1)_

### `_migrations_cc_columns_done`  [in:prod-only]

_Origin: not found in any migration (prod-only table)._

| Column | Type | NN | Default | PK |
|---|---|---|---|---|
| `done_at` | DATETIME |  | `CURRENT_TIMESTAMP` |  |
| `version` | TEXT |  |  |  |

  _(rows: 1)_

### `_migrations_finance_unify_done`  [in:prod-only]

_Origin: not found in any migration (prod-only table)._

| Column | Type | NN | Default | PK |
|---|---|---|---|---|
| `done_at` | DATETIME |  | `CURRENT_TIMESTAMP` |  |
| `version` | TEXT |  |  |  |

  _(rows: 1)_

### `_migrations_fingerprint_v2_done`  [in:prod-only]

_Origin: not found in any migration (prod-only table)._

| Column | Type | NN | Default | PK |
|---|---|---|---|---|
| `done_at` | DATETIME |  | `CURRENT_TIMESTAMP` |  |
| `version` | TEXT |  |  |  |
| `rows_recomputed` | INTEGER |  |  |  |
| `dups_flagged` | INTEGER |  |  |  |

  _(rows: 1)_

### `_migrations_fsa_plan_extension_done`  [in:prod-only]

_Origin: not found in any migration (prod-only table)._

| Column | Type | NN | Default | PK |
|---|---|---|---|---|
| `id` | INTEGER |  |  | ✓ |
| `applied_at` | DATETIME |  | `CURRENT_TIMESTAMP` |  |
| `notes` | TEXT |  |  |  |

  _(rows: 1)_

### `_migrations_hsa_plan_renamed_done`  [in:prod-only]

_Origin: not found in any migration (prod-only table)._

| Column | Type | NN | Default | PK |
|---|---|---|---|---|
| `id` | INTEGER |  |  | ✓ |
| `applied_at` | DATETIME |  | `CURRENT_TIMESTAMP` |  |
| `notes` | TEXT |  |  |  |

  _(rows: 1)_

### `_migrations_hsa_to_fsa_copy_done`  [in:prod-only]

_Origin: not found in any migration (prod-only table)._

| Column | Type | NN | Default | PK |
|---|---|---|---|---|
| `id` | INTEGER |  |  | ✓ |
| `applied_at` | DATETIME |  | `CURRENT_TIMESTAMP` |  |
| `notes` | TEXT |  |  |  |

  _(rows: 1)_

### `_migrations_hsa_to_fsa_retry_done`  [in:prod-only]

_Origin: not found in any migration (prod-only table)._

| Column | Type | NN | Default | PK |
|---|---|---|---|---|
| `id` | INTEGER |  |  | ✓ |
| `applied_at` | DATETIME |  | `CURRENT_TIMESTAMP` |  |
| `rows_copied` | INTEGER |  |  |  |
| `notes` | TEXT |  |  |  |

  _(rows: 1)_

### `_migrations_med_immunizations_done`  [in:prod-only]

_Origin: not found in any migration (prod-only table)._

| Column | Type | NN | Default | PK |
|---|---|---|---|---|
| `id` | INTEGER |  |  | ✓ |
| `applied_at` | DATETIME |  | `CURRENT_TIMESTAMP` |  |
| `notes` | TEXT |  |  |  |

  _(rows: 1)_

### `_migrations_med_procedures_done`  [in:prod-only]

_Origin: not found in any migration (prod-only table)._

| Column | Type | NN | Default | PK |
|---|---|---|---|---|
| `id` | INTEGER |  |  | ✓ |
| `applied_at` | DATETIME |  | `CURRENT_TIMESTAMP` |  |
| `notes` | TEXT |  |  |  |

  _(rows: 1)_

### `_migrations_medical_expansion_done`  [in:prod-only]

_Origin: not found in any migration (prod-only table)._

| Column | Type | NN | Default | PK |
|---|---|---|---|---|
| `id` | INTEGER |  |  | ✓ |
| `applied_at` | DATETIME |  | `CURRENT_TIMESTAMP` |  |
| `notes` | TEXT |  |  |  |

  _(rows: 1)_

### `_migrations_record_links_done`  [in:prod-only]

_Origin: not found in any migration (prod-only table)._

| Column | Type | NN | Default | PK |
|---|---|---|---|---|
| `done_at` | DATETIME |  | `CURRENT_TIMESTAMP` |  |
| `version` | TEXT |  |  |  |

  _(rows: 1)_

### `_migrations_rescue_126_done`  [in:prod-only]

_Origin: not found in any migration (prod-only table)._

| Column | Type | NN | Default | PK |
|---|---|---|---|---|
| `done_at` | DATETIME |  | `CURRENT_TIMESTAMP` |  |
| `version` | TEXT |  |  |  |
| `notes` | TEXT |  |  |  |

  _(rows: 1)_

### `_sessions`  [in:prod-only]

_Origin: not found in any migration (prod-only table)._

| Column | Type | NN | Default | PK |
|---|---|---|---|---|
| `token` | TEXT |  |  | ✓ |
| `created_at` | INTEGER | ✓ |  |  |
| `last_active` | INTEGER | ✓ |  |  |

  _(rows: 124)_

### `account_snapshots`  [in:both]

_Created in: `032_import_finance.sql`_

| Column | Type | NN | Default | PK | In migrations |
|---|---|---|---|---|---|
| `id` | INTEGER |  |  | ✓ | ✓ |
| `account_id` | INTEGER | ✓ |  |  | ✓ |
| `snapshot_date` | DATE | ✓ |  |  | ✓ |
| `balance` | REAL | ✓ |  |  | ✓ |
| `batch_id` | INTEGER |  |  |  | ✓ |
| `created_at` | DATETIME |  | `CURRENT_TIMESTAMP` |  | ✓ |

  _(rows: 0)_

### `accounts`  [in:both]

_Created in: `126_finance_unify.js`_

| Column | Type | NN | Default | PK | In migrations |
|---|---|---|---|---|---|
| `id` | INTEGER |  |  | ✓ | ✓ |
| `name` | TEXT | ✓ |  |  | ✓ |
| `alias` | TEXT |  |  |  | ✓ |
| `type` | TEXT | ✓ | `'Other'` |  | ✓ |
| `institution` | TEXT |  |  |  | ✓ |
| `last4` | TEXT |  |  |  | ✓ |
| `owner` | TEXT |  |  |  | ✓ |
| `currency` | TEXT | ✓ | `'USD'` |  | ✓ |
| `current_balance` | REAL | ✓ | `0` |  | ✓ |
| `balance_as_of` | DATE |  |  |  | ✓ |
| `include_net_worth` | INTEGER | ✓ | `1` |  | ✓ |
| `is_active` | INTEGER | ✓ | `1` |  | ✓ |
| `track_statements` | INTEGER | ✓ | `0` |  | ✓ |
| `notes` | TEXT |  |  |  | ✓ |
| `sort_order` | INTEGER | ✓ | `0` |  | ✓ |
| `source` | TEXT | ✓ | `'manual'` |  | ✓ |
| `needs_review` | INTEGER | ✓ | `0` |  | ✓ |
| `credit_limit` | REAL |  |  |  | ✓ |
| `statement_balance` | REAL |  |  |  | ✓ |
| `minimum_payment` | REAL |  |  |  | ✓ |
| `payment_due_date` | DATE |  |  |  | ✓ |
| `apr` | REAL |  |  |  | ✓ |
| `promo_apr` | REAL |  |  |  | ✓ |
| `promo_end_date` | DATE |  |  |  | ✓ |
| `annual_fee` | REAL |  |  |  | ✓ |
| `annual_fee_renewal_date` | DATE |  |  |  | ✓ |
| `rewards_balance` | REAL |  |  |  | ✓ |
| `created_at` | DATETIME |  | `CURRENT_TIMESTAMP` |  | ✓ |
| `updated_at` | DATETIME |  | `CURRENT_TIMESTAMP` |  | ✓ |
| `tax_treatment` | TEXT | ✓ | `'taxable'` |  | ✓ |

  _(rows: 3)_

### `accounts_beneficiaries`  [in:both]

_Created in: `unknown`_

| Column | Type | NN | Default | PK | In migrations |
|---|---|---|---|---|---|
| `id` | INTEGER |  |  | ✓ | ✓ |
| `institution_id` | INTEGER |  |  |  | ✗ |
| `account_type` | TEXT |  |  |  | ✗ |
| `nickname` | TEXT |  |  |  | ✗ |
| `owner_id` | INTEGER |  |  |  | ✗ |
| `acct_last4` | TEXT |  |  |  | ✗ |
| `current_titling` | TEXT |  |  |  | ✗ |
| `intended_titling` | TEXT |  |  |  | ✗ |
| `beneficiary_primary` | TEXT |  |  |  | ✗ |
| `beneficiary_contingent` | TEXT |  |  |  | ✗ |
| `beneficiary_last_reviewed` | DATE |  |  |  | ✗ |
| `tod_pod` | INTEGER |  | `0` |  | ✗ |
| `login_reference` | TEXT |  |  |  | ✗ |
| `status` | TEXT |  | `'Active'` |  | ✗ |
| `notes` | TEXT |  |  |  | ✓ |
| `created_at` | DATETIME |  | `CURRENT_TIMESTAMP` |  | ✓ |
| `updated_at` | DATETIME |  | `CURRENT_TIMESTAMP` |  | ✓ |
| `credit_limit` | REAL |  |  |  | ✗ |
| `statement_balance` | REAL |  |  |  | ✗ |
| `minimum_payment` | REAL |  |  |  | ✗ |
| `payment_due_date` | DATE |  |  |  | ✗ |
| `apr` | REAL |  |  |  | ✗ |
| `promo_apr` | REAL |  |  |  | ✗ |
| `promo_end_date` | DATE |  |  |  | ✗ |
| `annual_fee` | REAL |  |  |  | ✗ |
| `annual_fee_renewal_date` | DATE |  |  |  | ✗ |
| `rewards_balance` | REAL |  |  |  | ✗ |

  _(rows: 0)_

### `annual_checklist_items`  [in:prod-only]

_Origin: not found in any migration (prod-only table)._

| Column | Type | NN | Default | PK |
|---|---|---|---|---|
| `id` | INTEGER |  |  | ✓ |
| `category` | TEXT |  |  |  |
| `task` | TEXT | ✓ |  |  |
| `sort_order` | INTEGER |  | `0` |  |

  _(rows: 35)_

### `annual_checklist_status`  [in:prod-only]

_Origin: not found in any migration (prod-only table)._

| Column | Type | NN | Default | PK |
|---|---|---|---|---|
| `id` | INTEGER |  |  | ✓ |
| `item_id` | INTEGER | ✓ |  |  |
| `year` | INTEGER | ✓ |  |  |
| `status` | TEXT |  | `'Not Started'` |  |
| `completed_at` | DATE |  |  |  |
| `notes` | TEXT |  |  |  |

  _(rows: 0)_

### `app_config`  [in:both]

_Created in: `001_initial.sql`_

| Column | Type | NN | Default | PK | In migrations |
|---|---|---|---|---|---|
| `key` | TEXT |  |  | ✓ | ✓ |
| `value` | TEXT | ✓ |  |  | ✓ |

  _(rows: 50)_

### `attachments`  [in:both]

_Created in: `001_initial.sql`_

| Column | Type | NN | Default | PK | In migrations |
|---|---|---|---|---|---|
| `id` | INTEGER |  |  | ✓ | ✓ |
| `entity_type` | TEXT | ✓ |  |  | ✓ |
| `entity_id` | INTEGER | ✓ |  |  | ✓ |
| `module` | TEXT | ✓ |  |  | ✓ |
| `label` | TEXT |  |  |  | ✓ |
| `original_filename` | TEXT | ✓ |  |  | ✓ |
| `stored_filename` | TEXT | ✓ |  |  | ✓ |
| `stored_path` | TEXT | ✓ |  |  | ✓ |
| `unc_path` | TEXT |  |  |  | ✓ |
| `file_size` | INTEGER |  |  |  | ✓ |
| `mime_type` | TEXT |  |  |  | ✓ |
| `is_image` | INTEGER |  | `0` |  | ✓ |
| `is_primary_photo` | INTEGER |  | `0` |  | ✓ |
| `thumb_path` | TEXT |  |  |  | ✓ |
| `sort_order` | INTEGER |  | `0` |  | ✓ |
| `notes` | TEXT |  |  |  | ✓ |
| `created_at` | DATETIME |  | `CURRENT_TIMESTAMP` |  | ✓ |

  _(rows: 41)_

### `beneficiaries`  [in:prod-only]

_Origin: not found in any migration (prod-only table)._

| Column | Type | NN | Default | PK |
|---|---|---|---|---|
| `id` | INTEGER |  |  | ✓ |
| `account_id` | INTEGER |  |  |  |
| `beneficiary_type` | TEXT |  |  |  |
| `beneficiary_name` | TEXT |  |  |  |
| `relationship` | TEXT |  |  |  |
| `percentage` | REAL |  |  |  |
| `last_verified_date` | DATE |  |  |  |
| `notes` | TEXT |  |  |  |
| `updated_at` | DATETIME |  | `CURRENT_TIMESTAMP` |  |

  _(rows: 0)_

### `books`  [in:both]

_Created in: `022_books.sql`_

| Column | Type | NN | Default | PK | In migrations |
|---|---|---|---|---|---|
| `id` | INTEGER |  |  | ✓ | ✓ |
| `title` | TEXT | ✓ |  |  | ✓ |
| `author` | TEXT |  |  |  | ✓ |
| `genre` | TEXT |  |  |  | ✓ |
| `status` | TEXT | ✓ | `'Want to Read'` |  | ✓ |
| `rating` | INTEGER |  |  |  | ✓ |
| `format` | TEXT |  | `'Physical'` |  | ✓ |
| `date_started` | DATE |  |  |  | ✓ |
| `date_finished` | DATE |  |  |  | ✓ |
| `notes` | TEXT |  |  |  | ✓ |
| `isbn` | TEXT |  |  |  | ✓ |
| `cover_url` | TEXT |  |  |  | ✓ |
| `is_active` | INTEGER | ✓ | `1` |  | ✓ |
| `created_at` | DATETIME |  | `CURRENT_TIMESTAMP` |  | ✓ |
| `updated_at` | DATETIME |  | `CURRENT_TIMESTAMP` |  | ✓ |
| `needs_review` | INTEGER | ✓ | `0` |  | ✓ |
| `review_flagged_at` | DATETIME |  |  |  | ✓ |
| `review_reason` | TEXT |  |  |  | ✓ |
| `pages_total` | INTEGER |  |  |  | ✓ |
| `pages_read` | INTEGER |  |  |  | ✓ |
| `publisher` | TEXT |  |  |  | ✓ |
| `publish_year` | INTEGER |  |  |  | ✓ |
| `language` | TEXT |  |  |  | ✓ |
| `review_category` | TEXT |  |  |  | ✗ |
| `physical_status` | TEXT |  | `'owned'` |  | ✓ |
| `physical_status_notes` | TEXT |  |  |  | ✓ |
| `physical_status_date` | TEXT |  |  |  | ✓ |

  _(rows: 0)_

### `budgets`  [in:both]

_Created in: `023_budgets.sql`_

| Column | Type | NN | Default | PK | In migrations |
|---|---|---|---|---|---|
| `id` | INTEGER |  |  | ✓ | ✓ |
| `category` | TEXT | ✓ |  |  | ✓ |
| `monthly_limit` | REAL | ✓ | `0` |  | ✓ |
| `year` | INTEGER | ✓ | `strftime('%Y', 'now')` |  | ✓ |
| `month` | INTEGER |  |  |  | ✓ |
| `notes` | TEXT |  |  |  | ✓ |
| `is_active` | INTEGER | ✓ | `1` |  | ✓ |
| `created_at` | DATETIME |  | `CURRENT_TIMESTAMP` |  | ✓ |
| `updated_at` | DATETIME |  | `CURRENT_TIMESTAMP` |  | ✓ |

  _(rows: 0)_

### `calendar_events`  [in:both]

_Created in: `027_google_calendar.sql`_

| Column | Type | NN | Default | PK | In migrations |
|---|---|---|---|---|---|
| `id` | TEXT |  |  | ✓ | ✓ |
| `calendar_id` | TEXT |  | `'primary'` |  | ✓ |
| `title` | TEXT | ✓ |  |  | ✓ |
| `description` | TEXT |  |  |  | ✓ |
| `location` | TEXT |  |  |  | ✓ |
| `start_datetime` | TEXT | ✓ |  |  | ✓ |
| `end_datetime` | TEXT |  |  |  | ✓ |
| `all_day` | INTEGER | ✓ | `0` |  | ✓ |
| `status` | TEXT |  | `'confirmed'` |  | ✓ |
| `recurring` | INTEGER | ✓ | `0` |  | ✓ |
| `source` | TEXT | ✓ | `'local'` |  | ✓ |
| `family_member` | TEXT |  |  |  | ✓ |
| `color_id` | TEXT |  |  |  | ✓ |
| `html_link` | TEXT |  |  |  | ✓ |
| `organizer_email` | TEXT |  |  |  | ✓ |
| `synced_at` | DATETIME |  | `CURRENT_TIMESTAMP` |  | ✓ |
| `created_at` | DATETIME |  | `CURRENT_TIMESTAMP` |  | ✓ |
| `updated_at` | DATETIME |  | `CURRENT_TIMESTAMP` |  | ✓ |

  _(rows: 0)_

### `career_certifications`  [in:both]

_Created in: `021_career.sql`_

| Column | Type | NN | Default | PK | In migrations |
|---|---|---|---|---|---|
| `id` | INTEGER |  |  | ✓ | ✓ |
| `name` | TEXT | ✓ |  |  | ✓ |
| `issuing_body` | TEXT |  |  |  | ✓ |
| `credential_id` | TEXT |  |  |  | ✓ |
| `issue_date` | DATE |  |  |  | ✓ |
| `expiry_date` | DATE |  |  |  | ✓ |
| `status` | TEXT | ✓ | `'Active'` |  | ✓ |
| `notes` | TEXT |  |  |  | ✓ |
| `todo_id` | INTEGER |  |  |  | ✓ |
| `created_at` | DATETIME |  | `CURRENT_TIMESTAMP` |  | ✓ |
| `updated_at` | DATETIME |  | `CURRENT_TIMESTAMP` |  | ✓ |
| `needs_review` | INTEGER | ✓ | `0` |  | ✓ |
| `review_flagged_at` | DATETIME |  |  |  | ✓ |
| `review_reason` | TEXT |  |  |  | ✓ |
| `review_category` | TEXT |  |  |  | ✗ |
| `cert_number` | TEXT |  |  |  | ✓ |
| `ce_hours_required` | REAL |  |  |  | ✓ |
| `renewal_period_months` | INTEGER |  |  |  | ✓ |
| `current_cycle_start` | DATE |  |  |  | ✓ |
| `current_cycle_end` | DATE |  |  |  | ✓ |
| `ce_category_rules` | TEXT |  |  |  | ✓ |
| `renewal_fee` | REAL |  |  |  | ✓ |

  _(rows: 6)_

### `career_goals`  [in:both]

_Created in: `035_property_maintenance.sql`_

| Column | Type | NN | Default | PK | In migrations |
|---|---|---|---|---|---|
| `id` | INTEGER |  |  | ✓ | ✓ |
| `title` | TEXT | ✓ |  |  | ✓ |
| `category` | TEXT |  | `'General'` |  | ✓ |
| `target_date` | DATE |  |  |  | ✓ |
| `status` | TEXT |  | `'active'` |  | ✓ |
| `notes` | TEXT |  |  |  | ✓ |
| `created_at` | DATETIME |  | `CURRENT_TIMESTAMP` |  | ✓ |
| `updated_at` | DATETIME |  | `CURRENT_TIMESTAMP` |  | ✓ |
| `needs_review` | INTEGER | ✓ | `0` |  | ✓ |
| `review_flagged_at` | DATETIME |  |  |  | ✓ |
| `review_reason` | TEXT |  |  |  | ✓ |
| `review_category` | TEXT |  |  |  | ✗ |

  _(rows: 0)_

### `career_jobs`  [in:both]

_Created in: `021_career.sql`_

| Column | Type | NN | Default | PK | In migrations |
|---|---|---|---|---|---|
| `id` | INTEGER |  |  | ✓ | ✓ |
| `company` | TEXT | ✓ |  |  | ✓ |
| `title` | TEXT | ✓ |  |  | ✓ |
| `employment_type` | TEXT |  | `'Full-time'` |  | ✓ |
| `start_date` | DATE |  |  |  | ✓ |
| `end_date` | DATE |  |  |  | ✓ |
| `location` | TEXT |  |  |  | ✓ |
| `description` | TEXT |  |  |  | ✓ |
| `is_current` | INTEGER | ✓ | `0` |  | ✓ |
| `created_at` | DATETIME |  | `CURRENT_TIMESTAMP` |  | ✓ |
| `needs_review` | INTEGER | ✓ | `0` |  | ✓ |
| `review_flagged_at` | DATETIME |  |  |  | ✓ |
| `review_reason` | TEXT |  |  |  | ✓ |
| `company_contact_id` | INTEGER |  |  |  | ✓ |
| `review_category` | TEXT |  |  |  | ✗ |

  _(rows: 0)_

### `career_learning`  [in:both]

_Created in: `078_career_learning.sql`_

| Column | Type | NN | Default | PK | In migrations |
|---|---|---|---|---|---|
| `id` | INTEGER |  |  | ✓ | ✓ |
| `title` | TEXT | ✓ |  |  | ✓ |
| `learning_type` | TEXT | ✓ | `'Course'` |  | ✓ |
| `provider` | TEXT |  |  |  | ✓ |
| `start_date` | DATE |  |  |  | ✓ |
| `end_date` | DATE |  |  |  | ✓ |
| `hours_total` | REAL |  |  |  | ✓ |
| `location` | TEXT |  |  |  | ✓ |
| `url` | TEXT |  |  |  | ✓ |
| `cost` | REAL |  |  |  | ✓ |
| `description` | TEXT |  |  |  | ✓ |
| `notes` | TEXT |  |  |  | ✓ |
| `needs_review` | INTEGER | ✓ | `0` |  | ✓ |
| `review_flagged_at` | DATETIME |  |  |  | ✓ |
| `review_reason` | TEXT |  |  |  | ✓ |
| `created_at` | DATETIME |  | `CURRENT_TIMESTAMP` |  | ✓ |
| `updated_at` | DATETIME |  | `CURRENT_TIMESTAMP` |  | ✓ |
| `instructor_contact_id` | INTEGER |  |  |  | ✓ |

  _(rows: 1)_

### `career_learning_certs`  [in:both]

_Created in: `078_career_learning.sql`_

| Column | Type | NN | Default | PK | In migrations |
|---|---|---|---|---|---|
| `id` | INTEGER |  |  | ✓ | ✓ |
| `learning_id` | INTEGER | ✓ |  |  | ✓ |
| `certification_id` | INTEGER | ✓ |  |  | ✓ |
| `hours_applied` | REAL |  |  |  | ✓ |
| `ce_category` | TEXT |  |  |  | ✓ |
| `notes` | TEXT |  |  |  | ✓ |
| `created_at` | DATETIME |  | `CURRENT_TIMESTAMP` |  | ✓ |

  _(rows: 0)_

### `career_skills`  [in:both]

_Created in: `021_career.sql`_

| Column | Type | NN | Default | PK | In migrations |
|---|---|---|---|---|---|
| `id` | INTEGER |  |  | ✓ | ✓ |
| `name` | TEXT | ✓ |  |  | ✓ |
| `category` | TEXT |  |  |  | ✓ |
| `proficiency` | TEXT |  | `'Intermediate'` |  | ✓ |
| `years_experience` | REAL |  |  |  | ✓ |
| `last_used_year` | INTEGER |  |  |  | ✓ |
| `notes` | TEXT |  |  |  | ✓ |
| `created_at` | DATETIME |  | `CURRENT_TIMESTAMP` |  | ✓ |
| `needs_review` | INTEGER | ✓ | `0` |  | ✓ |
| `review_flagged_at` | DATETIME |  |  |  | ✓ |
| `review_reason` | TEXT |  |  |  | ✓ |
| `review_category` | TEXT |  |  |  | ✗ |

  _(rows: 0)_

### `ce_hours`  [in:prod-only]

_Origin: not found in any migration (prod-only table)._

| Column | Type | NN | Default | PK |
|---|---|---|---|---|
| `id` | INTEGER |  |  | ✓ |
| `cert_id` | INTEGER |  |  |  |
| `course_title` | TEXT |  |  |  |
| `provider` | TEXT |  |  |  |
| `course_number` | TEXT |  |  |  |
| `website` | TEXT |  |  |  |
| `start_date` | DATE |  |  |  |
| `end_date` | DATE |  |  |  |
| `credits` | REAL |  |  |  |
| `credit_type` | TEXT |  |  |  |
| `location` | TEXT |  |  |  |
| `logged` | INTEGER |  | `0` |  |
| `notes` | TEXT |  |  |  |
| `created_at` | DATETIME |  | `CURRENT_TIMESTAMP` |  |

  _(rows: 0)_

### `certifications`  [in:prod-only]

_Origin: not found in any migration (prod-only table)._

| Column | Type | NN | Default | PK |
|---|---|---|---|---|
| `id` | INTEGER |  |  | ✓ |
| `cert_name` | TEXT | ✓ |  |  |
| `issuing_body` | TEXT |  |  |  |
| `date_obtained` | DATE |  |  |  |
| `expiration_date` | DATE |  |  |  |
| `renewal_fee` | REAL |  |  |  |
| `pdus_required` | INTEGER |  | `0` |  |
| `pdus_earned` | INTEGER |  | `0` |  |
| `status` | TEXT |  | `'Active'` |  |
| `notes` | TEXT |  |  |  |
| `created_at` | DATETIME |  | `CURRENT_TIMESTAMP` |  |
| `updated_at` | DATETIME |  | `CURRENT_TIMESTAMP` |  |

  _(rows: 0)_

### `contacts`  [in:both]

_Created in: `001_initial.sql`_

| Column | Type | NN | Default | PK | In migrations |
|---|---|---|---|---|---|
| `id` | INTEGER |  |  | ✓ | ✓ |
| `contact_type` | TEXT | ✓ |  |  | ✓ |
| `name` | TEXT | ✓ |  |  | ✓ |
| `company` | TEXT |  |  |  | ✓ |
| `phone_primary` | TEXT |  |  |  | ✓ |
| `phone_secondary` | TEXT |  |  |  | ✓ |
| `email` | TEXT |  |  |  | ✓ |
| `address` | TEXT |  |  |  | ✓ |
| `website` | TEXT |  |  |  | ✓ |
| `notes` | TEXT |  |  |  | ✓ |
| `last_contacted` | DATE |  |  |  | ✗ |
| `created_at` | DATETIME |  | `CURRENT_TIMESTAMP` |  | ✓ |
| `updated_at` | DATETIME |  | `CURRENT_TIMESTAMP` |  | ✓ |
| `address_street` | TEXT |  |  |  | ✓ |
| `address_city` | TEXT |  |  |  | ✓ |
| `address_state` | TEXT |  |  |  | ✓ |
| `address_zip` | TEXT |  |  |  | ✓ |
| `needs_review` | INTEGER | ✓ | `0` |  | ✓ |
| `review_flagged_at` | DATETIME |  |  |  | ✓ |
| `review_reason` | TEXT |  |  |  | ✓ |
| `specialty` | TEXT |  |  |  | ✓ |
| `google_contact_id` | TEXT |  |  |  | ✓ |
| `patients_seen` | TEXT |  |  |  | ✓ |
| `accepts_insurance` | TEXT |  |  |  | ✓ |
| `license_number` | TEXT |  |  |  | ✓ |
| `insurance_verified` | INTEGER |  | `0` |  | ✓ |
| `bonded` | INTEGER |  | `0` |  | ✓ |
| `last_used_date` | DATE |  |  |  | ✓ |
| `quality_rating` | INTEGER |  |  |  | ✓ |
| `hr_contact_name` | TEXT |  |  |  | ✓ |
| `hr_phone` | TEXT |  |  |  | ✓ |
| `ein` | TEXT |  |  |  | ✓ |
| `employee_family_member_id` | INTEGER |  |  |  | ✓ |
| `principal_name` | TEXT |  |  |  | ✓ |
| `grade_range` | TEXT |  |  |  | ✓ |
| `enrolled_kids` | TEXT |  |  |  | ✓ |
| `institution_type` | TEXT |  |  |  | ✓ |
| `rep_name` | TEXT |  |  |  | ✓ |
| `account_types_served` | TEXT |  |  |  | ✓ |
| `review_category` | TEXT |  |  |  | ✗ |
| `google_updated_at` | TEXT |  |  |  | ✓ |
| `is_emergency_contact` | INTEGER | ✓ | `0` |  | ✓ |
| `credentials` | TEXT |  |  |  | ✓ |
| `manages` | TEXT |  |  |  | ✓ |
| `is_primary_pcp` | INTEGER |  | `0` |  | ✓ |
| `portal_url` | TEXT |  |  |  | ✓ |
| `fax` | TEXT |  |  |  | ✓ |
| `npi` | TEXT |  |  |  | ✓ |

  _(rows: 1)_

### `containers`  [in:both]

_Created in: `001_initial.sql`_

| Column | Type | NN | Default | PK | In migrations |
|---|---|---|---|---|---|
| `id` | INTEGER |  |  | ✓ | ✓ |
| `container_ref` | TEXT |  |  |  | ✓ |
| `name` | TEXT | ✓ |  |  | ✓ |
| `description` | TEXT |  |  |  | ✓ |
| `subtype` | TEXT |  | `'movable'` |  | ✓ |
| `parent_type` | TEXT | ✓ |  |  | ✓ |
| `parent_id` | INTEGER | ✓ |  |  | ✓ |
| `photo_path` | TEXT |  |  |  | ✗ |
| `qr_code_path` | TEXT |  |  |  | ✓ |
| `notes` | TEXT |  |  |  | ✓ |
| `last_moved_at` | DATETIME |  |  |  | ✓ |
| `created_at` | DATETIME |  | `CURRENT_TIMESTAMP` |  | ✓ |
| `updated_at` | DATETIME |  | `CURRENT_TIMESTAMP` |  | ✓ |
| `is_business` | INTEGER |  | `0` |  | ✓ |

  _(rows: 3)_

### `credit_cards`  [in:prod-only]

_Origin: not found in any migration (prod-only table)._

| Column | Type | NN | Default | PK |
|---|---|---|---|---|
| `id` | INTEGER |  |  | ✓ |
| `card_name` | TEXT | ✓ |  |  |
| `bank_id` | INTEGER |  |  |  |
| `owner_id` | INTEGER |  |  |  |
| `acct_last4` | TEXT |  |  |  |
| `autopay` | INTEGER |  | `0` |  |
| `paid_from_acct_id` | INTEGER |  |  |  |
| `annual_fee` | REAL |  |  |  |
| `fee_due_month` | INTEGER |  |  |  |
| `credit_limit` | REAL |  |  |  |
| `login_reference` | TEXT |  |  |  |
| `status` | TEXT |  | `'Active'` |  |
| `notes` | TEXT |  |  |  |
| `created_at` | DATETIME |  | `CURRENT_TIMESTAMP` |  |
| `updated_at` | DATETIME |  | `CURRENT_TIMESTAMP` |  |

  _(rows: 0)_

### `custom_field_defs`  [in:both]

_Created in: `001_initial.sql`_

| Column | Type | NN | Default | PK | In migrations |
|---|---|---|---|---|---|
| `id` | INTEGER |  |  | ✓ | ✓ |
| `name` | TEXT | ✓ |  |  | ✓ |
| `field_type` | TEXT | ✓ |  |  | ✓ |
| `scope_module` | TEXT |  |  |  | ✓ |
| `scope_category` | TEXT |  |  |  | ✓ |
| `required` | INTEGER |  | `0` |  | ✓ |
| `default_value` | TEXT |  |  |  | ✓ |
| `options` | TEXT |  |  |  | ✓ |
| `sort_order` | INTEGER |  | `0` |  | ✓ |
| `created_at` | DATETIME |  | `CURRENT_TIMESTAMP` |  | ✓ |

  _(rows: 0)_

### `custom_field_values`  [in:both]

_Created in: `001_initial.sql`_

| Column | Type | NN | Default | PK | In migrations |
|---|---|---|---|---|---|
| `field_def_id` | INTEGER | ✓ |  | ✓ | ✓ |
| `entity_type` | TEXT | ✓ |  | ✓ | ✓ |
| `entity_id` | INTEGER | ✓ |  | ✓ | ✓ |
| `value` | TEXT |  |  |  | ✓ |

  _(rows: 0)_

### `daily_log`  [in:both]

_Created in: `001_initial.sql`_

| Column | Type | NN | Default | PK | In migrations |
|---|---|---|---|---|---|
| `id` | INTEGER |  |  | ✓ | ✓ |
| `log_date` | DATE | ✓ |  |  | ✓ |
| `category` | TEXT |  |  |  | ✓ |
| `entry_text` | TEXT | ✓ |  |  | ✓ |
| `follow_up_needed` | INTEGER |  | `0` |  | ✓ |
| `follow_up_date` | DATE |  |  |  | ✓ |
| `created_at` | DATETIME |  | `CURRENT_TIMESTAMP` |  | ✓ |
| `updated_at` | DATETIME |  | `CURRENT_TIMESTAMP` |  | ✓ |
| `needs_review` | INTEGER | ✓ | `0` |  | ✓ |
| `review_flagged_at` | DATETIME |  |  |  | ✓ |
| `review_reason` | TEXT |  |  |  | ✓ |
| `review_category` | TEXT |  |  |  | ✗ |
| `is_memory` | INTEGER | ✓ | `0` |  | ✓ |
| `memory_category` | TEXT |  |  |  | ✓ |
| `promoted_to_type` | TEXT |  |  |  | ✓ |
| `promoted_to_id` | INTEGER |  |  |  | ✓ |

  _(rows: 6)_

### `db_maintenance_log`  [in:both]

_Created in: `101_system_ux.sql`_

| Column | Type | NN | Default | PK | In migrations |
|---|---|---|---|---|---|
| `id` | INTEGER |  |  | ✓ | ✓ |
| `operation` | TEXT | ✓ |  |  | ✓ |
| `started_at` | DATETIME |  | `CURRENT_TIMESTAMP` |  | ✓ |
| `completed_at` | DATETIME |  |  |  | ✓ |
| `duration_ms` | INTEGER |  |  |  | ✓ |
| `result` | TEXT |  |  |  | ✓ |
| `details` | TEXT |  |  |  | ✓ |

  _(rows: 3)_

### `deleted_items`  [in:both]

_Created in: `098_undo_expiry_rules.sql`_

| Column | Type | NN | Default | PK | In migrations |
|---|---|---|---|---|---|
| `id` | INTEGER |  |  | ✓ | ✓ |
| `entity_type` | TEXT | ✓ |  |  | ✓ |
| `entity_id` | INTEGER | ✓ |  |  | ✓ |
| `entity_name` | TEXT | ✓ |  |  | ✓ |
| `deleted_at` | DATETIME |  | `CURRENT_TIMESTAMP` |  | ✓ |
| `deleted_data` | TEXT |  |  |  | ✓ |

  _(rows: 0)_

### `doctor_visit_notes`  [in:prod-only]

_Origin: not found in any migration (prod-only table)._

| Column | Type | NN | Default | PK |
|---|---|---|---|---|
| `id` | INTEGER |  |  | ✓ |
| `patient_id` | INTEGER |  |  |  |
| `provider_id` | INTEGER |  |  |  |
| `visit_date` | DATE |  |  |  |
| `questions` | TEXT |  |  |  |
| `doctors_response` | TEXT |  |  |  |
| `follow_up_needed` | INTEGER |  | `0` |  |
| `follow_up_date` | DATE |  |  |  |
| `notes` | TEXT |  |  |  |
| `created_at` | DATETIME |  | `CURRENT_TIMESTAMP` |  |
| `updated_at` | DATETIME |  | `CURRENT_TIMESTAMP` |  |

  _(rows: 0)_

### `document_item_links`  [in:both]

_Created in: `092_document_item_links.sql`_

| Column | Type | NN | Default | PK | In migrations |
|---|---|---|---|---|---|
| `id` | INTEGER |  |  | ✓ | ✓ |
| `document_id` | INTEGER | ✓ |  |  | ✓ |
| `item_id` | INTEGER | ✓ |  |  | ✓ |
| `link_type` | TEXT |  | `'manual'` |  | ✓ |
| `created_at` | DATETIME |  | `CURRENT_TIMESTAMP` |  | ✓ |

  _(rows: 0)_

### `documents`  [in:both]

_Created in: `025_documents.sql`_

| Column | Type | NN | Default | PK | In migrations |
|---|---|---|---|---|---|
| `id` | INTEGER |  |  | ✓ | ✓ |
| `title` | TEXT | ✓ |  |  | ✓ |
| `category` | TEXT | ✓ | `'Other'` |  | ✓ |
| `subcategory` | TEXT |  |  |  | ✓ |
| `description` | TEXT |  |  |  | ✓ |
| `file_name` | TEXT |  |  |  | ✓ |
| `file_path` | TEXT |  |  |  | ✓ |
| `attachment_id` | INTEGER |  |  |  | ✓ |
| `issuer` | TEXT |  |  |  | ✓ |
| `issue_date` | DATE |  |  |  | ✓ |
| `expiry_date` | DATE |  |  |  | ✓ |
| `tags` | TEXT |  |  |  | ✓ |
| `family_member` | TEXT |  |  |  | ✓ |
| `is_active` | INTEGER | ✓ | `1` |  | ✓ |
| `created_at` | DATETIME |  | `CURRENT_TIMESTAMP` |  | ✓ |
| `updated_at` | DATETIME |  | `CURRENT_TIMESTAMP` |  | ✓ |
| `needs_review` | INTEGER | ✓ | `0` |  | ✓ |
| `review_flagged_at` | DATETIME |  |  |  | ✓ |
| `review_reason` | TEXT |  |  |  | ✓ |
| `review_category` | TEXT |  |  |  | ✗ |
| `url_link` | TEXT |  |  |  | ✓ |
| `expiry_notified` | INTEGER |  | `0` |  | ✓ |
| `renewal_reminder_days` | INTEGER |  | `60` |  | ✓ |
| `archive_reason` | TEXT |  |  |  | ✓ |

  _(rows: 1)_

### `dropdown_options`  [in:both]

_Created in: `006_dropdown_options.sql`_

| Column | Type | NN | Default | PK | In migrations |
|---|---|---|---|---|---|
| `id` | INTEGER |  |  | ✓ | ✓ |
| `list_key` | TEXT | ✓ |  |  | ✓ |
| `label` | TEXT | ✓ |  |  | ✓ |
| `value` | TEXT | ✓ |  |  | ✓ |
| `sort_order` | INTEGER |  | `0` |  | ✓ |
| `is_active` | INTEGER |  | `1` |  | ✓ |
| `is_system` | INTEGER |  | `0` |  | ✓ |
| `created_at` | DATETIME |  | `CURRENT_TIMESTAMP` |  | ✓ |

  _(rows: 545)_

### `estate_documents`  [in:prod-only]

_Origin: not found in any migration (prod-only table)._

| Column | Type | NN | Default | PK |
|---|---|---|---|---|
| `id` | INTEGER |  |  | ✓ |
| `document_type` | TEXT |  |  |  |
| `exists_flag` | INTEGER |  | `0` |  |
| `location_physical` | TEXT |  |  |  |
| `location_digital` | TEXT |  |  |  |
| `attorney_id` | INTEGER |  |  |  |
| `last_reviewed` | DATE |  |  |  |
| `notes` | TEXT |  |  |  |
| `updated_at` | DATETIME |  | `CURRENT_TIMESTAMP` |  |

  _(rows: 0)_

### `family_members`  [in:both]

_Created in: `001_initial.sql`_

| Column | Type | NN | Default | PK | In migrations |
|---|---|---|---|---|---|
| `id` | INTEGER |  |  | ✓ | ✓ |
| `display_name` | TEXT | ✓ |  |  | ✓ |
| `full_legal_name` | TEXT |  |  |  | ✓ |
| `relationship` | TEXT |  |  |  | ✓ |
| `date_of_birth` | DATE |  |  |  | ✓ |
| `ssn_last4` | TEXT |  |  |  | ✓ |
| `is_primary_user` | INTEGER |  | `0` |  | ✓ |
| `photo_path` | TEXT |  |  |  | ✗ |
| `notes` | TEXT |  |  |  | ✓ |
| `created_at` | DATETIME |  | `CURRENT_TIMESTAMP` |  | ✓ |
| `updated_at` | DATETIME |  | `CURRENT_TIMESTAMP` |  | ✓ |
| `needs_review` | INTEGER | ✓ | `0` |  | ✓ |
| `review_flagged_at` | DATETIME |  |  |  | ✓ |
| `review_reason` | TEXT |  |  |  | ✓ |
| `review_category` | TEXT |  |  |  | ✗ |
| `emergency_notes` | TEXT |  |  |  | ✓ |
| `avatar_attachment_id` | INTEGER |  |  |  | ✓ |
| `gender` | TEXT |  |  |  | ✓ |

  _(rows: 4)_

### `federal_benefits`  [in:prod-only]

_Origin: not found in any migration (prod-only table)._

| Column | Type | NN | Default | PK |
|---|---|---|---|---|
| `id` | INTEGER |  |  | ✓ |
| `record_type` | TEXT | ✓ |  |  |
| `value` | TEXT |  |  |  |
| `effective_date` | DATE |  |  |  |
| `notes` | TEXT |  |  |  |
| `updated_at` | DATETIME |  | `CURRENT_TIMESTAMP` |  |

  _(rows: 0)_

### `fers_inputs`  [in:prod-only]

_Origin: not found in any migration (prod-only table)._

| Column | Type | NN | Default | PK |
|---|---|---|---|---|
| `id` | INTEGER |  |  | ✓ |
| `person_id` | INTEGER |  |  |  |
| `fers_start_date` | DATE |  |  |  |
| `date_of_birth` | DATE |  |  |  |
| `current_salary` | REAL |  |  |  |
| `salary_growth_rate` | REAL |  | `0.02` |  |
| `high3_avg_salary` | REAL |  |  |  |
| `tsp_balance` | REAL |  | `0` |  |
| `tsp_annual_contribution` | REAL |  | `0` |  |
| `tsp_return_rate` | REAL |  | `0.07` |  |
| `social_security_monthly` | REAL |  | `0` |  |
| `survivor_election` | TEXT |  | `'Full 50%'` |  |
| `updated_at` | DATETIME |  | `CURRENT_TIMESTAMP` |  |

  _(rows: 0)_

### `field_templates`  [in:both]

_Created in: `100_field_templates.sql`_

| Column | Type | NN | Default | PK | In migrations |
|---|---|---|---|---|---|
| `id` | INTEGER |  |  | ✓ | ✓ |
| `entity_type` | TEXT | ✓ |  |  | ✓ |
| `field_name` | TEXT | ✓ |  |  | ✓ |
| `template_name` | TEXT | ✓ |  |  | ✓ |
| `template_value` | TEXT | ✓ |  |  | ✓ |
| `usage_count` | INTEGER |  | `0` |  | ✓ |
| `created_at` | DATETIME |  | `CURRENT_TIMESTAMP` |  | ✓ |

  _(rows: 12)_

### `fin_import_batches`  [in:both]

_Created in: `062_finance_tx_batch.sql`_

| Column | Type | NN | Default | PK | In migrations |
|---|---|---|---|---|---|
| `id` | INTEGER |  |  |  | ✓ |
| `account_id` | INTEGER |  |  |  | ✓ |
| `filename` | TEXT |  |  |  | ✓ |
| `format` | TEXT |  |  |  | ✓ |
| `rows_total` | INTEGER |  |  |  | ✓ |
| `rows_imported` | INTEGER |  |  |  | ✓ |
| `rows_skipped` | — |  |  |  | ✗ |
| `rows_flagged` | — |  |  |  | ✗ |
| `account_type` | — |  |  |  | ✓ |
| `status` | — |  |  |  | ✗ |
| `error_message` | — |  |  |  | ✗ |
| `imported_at` | DATETIME |  |  |  | ✓ |
| `statement_date` | DATE |  |  |  | ✗ |
| `notes` | TEXT |  |  |  | ✗ |

  _(rows: 0)_

### `finance_accounts`  [in:both]

_Created in: `020_finance_accounts.sql`_

| Column | Type | NN | Default | PK | In migrations |
|---|---|---|---|---|---|
| `id` | INTEGER |  |  |  | ✓ |
| `name` | TEXT |  |  |  | ✓ |
| `type` | TEXT |  |  |  | ✓ |
| `institution` | TEXT |  |  |  | ✓ |
| `account_last4` | TEXT |  |  |  | ✓ |
| `current_balance` | REAL |  |  |  | ✓ |
| `balance_as_of` | DATE |  |  |  | ✓ |
| `is_active` | INTEGER |  |  |  | ✓ |
| `include_net_worth` | INTEGER |  |  |  | ✓ |
| `notes` | TEXT |  |  |  | ✓ |
| `sort_order` | INTEGER |  |  |  | ✓ |
| `created_at` | DATETIME |  |  |  | ✓ |
| `updated_at` | DATETIME |  |  |  | ✓ |

  _(rows: 3)_

### `finance_transactions`  [in:both]

_Created in: `020_finance_accounts.sql`_

| Column | Type | NN | Default | PK | In migrations |
|---|---|---|---|---|---|
| `id` | INTEGER |  |  |  | ✓ |
| `account_id` | INTEGER |  |  |  | ✓ |
| `date` | DATE |  |  |  | ✓ |
| `description` | TEXT |  |  |  | ✓ |
| `amount` | REAL |  |  |  | ✓ |
| `category` | TEXT |  |  |  | ✓ |
| `notes` | TEXT |  |  |  | ✓ |
| `is_reconciled` | INTEGER |  |  |  | ✓ |
| `batch_id` | INTEGER |  |  |  | ✓ |
| `created_at` | DATETIME |  |  |  | ✓ |

  _(rows: 76)_

### `financial_accounts`  [in:both]

_Created in: `032_import_finance.sql`_

| Column | Type | NN | Default | PK | In migrations |
|---|---|---|---|---|---|
| `id` | INTEGER |  |  |  | ✓ |
| `nickname` | TEXT |  |  |  | ✓ |
| `institution` | TEXT |  |  |  | ✓ |
| `account_type` | TEXT |  |  |  | ✓ |
| `owner` | TEXT |  |  |  | ✓ |
| `last_four` | TEXT |  |  |  | ✓ |
| `currency` | TEXT |  |  |  | ✓ |
| `is_active` | INTEGER |  |  |  | ✓ |
| `track_statements` | INTEGER |  |  |  | ✓ |
| `notes` | TEXT |  |  |  | ✓ |
| `tax_treatment` | TEXT |  |  |  | ✗ |
| `created_at` | DATETIME |  |  |  | ✓ |
| `updated_at` | DATETIME |  |  |  | ✓ |

  _(rows: 3)_

### `fsa_payments`  [in:both]

_Created in: `118_hsa_inbox_lp_fsa.sql`_

| Column | Type | NN | Default | PK | In migrations |
|---|---|---|---|---|---|
| `id` | INTEGER |  |  | ✓ | ✓ |
| `date` | TEXT | ✓ |  |  | ✓ |
| `vendor_contact_id` | INTEGER |  |  |  | ✓ |
| `amount` | REAL | ✓ |  |  | ✓ |
| `patient` | TEXT |  |  |  | ✓ |
| `category` | TEXT |  |  |  | ✓ |
| `fsa_eligible` | INTEGER |  | `0` |  | ✓ |
| `reimbursed` | INTEGER |  | `0` |  | ✓ |
| `reimbursement_date` | TEXT |  |  |  | ✓ |
| `reimbursement_id` | INTEGER |  |  |  | ✓ |
| `eob_claim_id` | INTEGER |  |  |  | ✓ |
| `status` | TEXT |  | `'final'` |  | ✓ |
| `inbox_attachment_id` | INTEGER |  |  |  | ✓ |
| `notes` | TEXT |  |  |  | ✓ |
| `created_at` | TEXT |  | `CURRENT_TIMESTAMP` |  | ✓ |

  _(rows: 0)_

### `fsa_plan_info`  [in:both]

_Created in: `118_hsa_inbox_lp_fsa.sql`_

| Column | Type | NN | Default | PK | In migrations |
|---|---|---|---|---|---|
| `id` | INTEGER |  |  | ✓ | ✓ |
| `year` | INTEGER | ✓ |  |  | ✓ |
| `plan_type` | TEXT | ✓ | `'limited_purpose'` |  | ✓ |
| `plan_name` | TEXT |  |  |  | ✓ |
| `custodian` | TEXT |  |  |  | ✓ |
| `annual_limit` | REAL |  |  |  | ✓ |
| `contributions` | REAL |  | `0` |  | ✓ |
| `employer_contribution` | REAL |  | `0` |  | ✓ |
| `deadline_date` | TEXT |  |  |  | ✓ |
| `carryover_amount` | REAL |  | `0` |  | ✓ |
| `active` | INTEGER |  | `1` |  | ✓ |
| `notes` | TEXT |  |  |  | ✓ |
| `created_at` | TEXT |  | `CURRENT_TIMESTAMP` |  | ✓ |
| `insurance_carrier` | TEXT |  |  |  | ✓ |
| `individual_deductible` | REAL |  | `0` |  | ✓ |
| `family_deductible` | REAL |  | `0` |  | ✓ |
| `individual_oop_max` | REAL |  | `0` |  | ✓ |
| `family_oop_max` | REAL |  | `0` |  | ✓ |
| `irs_limit_self_only` | REAL |  | `0` |  | ✓ |
| `irs_limit_family` | REAL |  | `0` |  | ✓ |
| `plan_effective_date` | DATE |  |  |  | ✓ |

  _(rows: 2)_

### `fsa_reimbursement_items`  [in:both]

_Created in: `118_hsa_inbox_lp_fsa.sql`_

| Column | Type | NN | Default | PK | In migrations |
|---|---|---|---|---|---|
| `id` | INTEGER |  |  | ✓ | ✓ |
| `reimbursement_id` | INTEGER | ✓ |  |  | ✓ |
| `payment_id` | INTEGER | ✓ |  |  | ✓ |
| `amount` | REAL | ✓ |  |  | ✓ |

  _(rows: 0)_

### `fsa_reimbursements`  [in:both]

_Created in: `118_hsa_inbox_lp_fsa.sql`_

| Column | Type | NN | Default | PK | In migrations |
|---|---|---|---|---|---|
| `id` | INTEGER |  |  | ✓ | ✓ |
| `date` | TEXT | ✓ |  |  | ✓ |
| `amount` | REAL | ✓ |  |  | ✓ |
| `method` | TEXT |  |  |  | ✓ |
| `notes` | TEXT |  |  |  | ✓ |
| `created_at` | TEXT |  | `CURRENT_TIMESTAMP` |  | ✓ |

  _(rows: 0)_

### `gift_cards`  [in:both]

_Created in: `019_gift_cards.sql`_

| Column | Type | NN | Default | PK | In migrations |
|---|---|---|---|---|---|
| `id` | INTEGER |  |  | ✓ | ✓ |
| `retailer` | TEXT | ✓ |  |  | ✓ |
| `initial_balance` | REAL | ✓ | `0` |  | ✓ |
| `current_balance` | REAL | ✓ | `0` |  | ✓ |
| `expiry_date` | DATE |  |  |  | ✓ |
| `where_stored` | TEXT |  | `'Wallet'` |  | ✓ |
| `notes` | TEXT |  |  |  | ✓ |
| `is_active` | INTEGER | ✓ | `1` |  | ✓ |
| `todo_id` | INTEGER |  |  |  | ✓ |
| `created_at` | DATETIME |  | `CURRENT_TIMESTAMP` |  | ✓ |
| `updated_at` | DATETIME |  | `CURRENT_TIMESTAMP` |  | ✓ |
| `card_number` | TEXT |  |  |  | ✓ |
| `card_pin` | TEXT |  |  |  | ✓ |
| `in_google_pay` | INTEGER | ✓ | `0` |  | ✓ |
| `in_samsung_pay` | INTEGER | ✓ | `0` |  | ✓ |
| `in_apple_pay` | INTEGER | ✓ | `0` |  | ✓ |

  _(rows: 0)_

### `gift_log`  [in:prod-only]

_Origin: not found in any migration (prod-only table)._

| Column | Type | NN | Default | PK |
|---|---|---|---|---|
| `id` | INTEGER |  |  | ✓ |
| `gift_date` | DATE |  |  |  |
| `recipient_id` | INTEGER |  |  |  |
| `recipient_name` | TEXT |  |  |  |
| `occasion` | TEXT |  |  |  |
| `description` | TEXT |  |  |  |
| `amount` | REAL |  |  |  |
| `vendor_id` | INTEGER |  |  |  |
| `card_id` | INTEGER |  |  |  |
| `notes` | TEXT |  |  |  |
| `created_at` | DATETIME |  | `CURRENT_TIMESTAMP` |  |

  _(rows: 0)_

### `google_calendars`  [in:both]

_Created in: `027_google_calendar.sql`_

| Column | Type | NN | Default | PK | In migrations |
|---|---|---|---|---|---|
| `id` | TEXT |  |  | ✓ | ✓ |
| `summary` | TEXT |  |  |  | ✓ |
| `description` | TEXT |  |  |  | ✓ |
| `color_hex` | TEXT |  |  |  | ✓ |
| `is_enabled` | INTEGER |  | `1` |  | ✓ |
| `is_primary` | INTEGER |  | `0` |  | ✓ |
| `synced_at` | DATETIME |  | `CURRENT_TIMESTAMP` |  | ✓ |

  _(rows: 0)_

### `holdings`  [in:both]

_Created in: `032_import_finance.sql`_

| Column | Type | NN | Default | PK | In migrations |
|---|---|---|---|---|---|
| `id` | INTEGER |  |  | ✓ | ✓ |
| `account_id` | INTEGER | ✓ |  |  | ✓ |
| `symbol` | TEXT | ✓ |  |  | ✓ |
| `name` | TEXT |  |  |  | ✓ |
| `asset_type` | TEXT |  |  |  | ✓ |
| `shares` | REAL |  |  |  | ✓ |
| `cost_basis` | REAL |  |  |  | ✓ |
| `price` | REAL |  |  |  | ✓ |
| `price_date` | DATE |  |  |  | ✓ |
| `market_value` | REAL |  |  |  | ✓ |
| `total_cost_basis` | REAL |  |  |  | ✓ |
| `gain_loss_dollar` | REAL |  |  |  | ✓ |
| `gain_loss_pct` | REAL |  |  |  | ✓ |
| `day_change_dollar` | REAL |  |  |  | ✓ |
| `day_change_pct` | REAL |  |  |  | ✓ |
| `week52_low` | REAL |  |  |  | ✓ |
| `week52_high` | REAL |  |  |  | ✓ |
| `reinvest_dividends` | INTEGER | ✓ | `0` |  | ✓ |
| `dividend_yield` | REAL |  |  |  | ✓ |
| `last_dividend_date` | DATE |  |  |  | ✓ |
| `annual_dividend` | REAL |  |  |  | ✓ |
| `created_at` | DATETIME |  | `CURRENT_TIMESTAMP` |  | ✓ |
| `updated_at` | DATETIME |  | `CURRENT_TIMESTAMP` |  | ✓ |
| `as_of_date` | DATE |  |  |  | ✓ |

  _(rows: 0)_

### `hsa_otc`  [in:both]

_Created in: `002_hsa_medical.sql`_

| Column | Type | NN | Default | PK | In migrations |
|---|---|---|---|---|---|
| `id` | INTEGER |  |  | ✓ | ✓ |
| `date` | DATE | ✓ |  |  | ✓ |
| `item_name` | TEXT | ✓ |  |  | ✓ |
| `otc_category` | TEXT |  | `'OTC Medicine'` |  | ✓ |
| `store` | TEXT |  |  |  | ✓ |
| `amount` | REAL |  | `0` |  | ✓ |
| `quantity` | INTEGER |  | `1` |  | ✓ |
| `hsa_eligible` | INTEGER |  | `1` |  | ✓ |
| `receipt_saved` | INTEGER |  | `0` |  | ✓ |
| `reimbursed` | INTEGER |  | `0` |  | ✓ |
| `reimbursement_date` | DATE |  |  |  | ✓ |
| `notes` | TEXT |  |  |  | ✓ |
| `created_at` | DATETIME |  | `CURRENT_TIMESTAMP` |  | ✓ |
| `updated_at` | DATETIME |  | `CURRENT_TIMESTAMP` |  | ✓ |
| `reimbursement_id` | INTEGER |  |  |  | ✓ |
| `family_member_id` | INTEGER |  |  |  | ✓ |
| `store_contact_id` | INTEGER |  |  |  | ✓ |

  _(rows: 0)_

### `hsa_payment_links`  [in:both]

_Created in: `119_medications_slice1.js`_

| Column | Type | NN | Default | PK | In migrations |
|---|---|---|---|---|---|
| `id` | INTEGER |  |  | ✓ | ✓ |
| `hsa_payment_id` | INTEGER | ✓ |  |  | ✓ |
| `entity_type` | TEXT | ✓ |  |  | ✓ |
| `entity_id` | INTEGER | ✓ |  |  | ✓ |
| `created_at` | DATETIME |  | `CURRENT_TIMESTAMP` |  | ✓ |

  _(rows: 0)_

### `hsa_payments`  [in:both]

_Created in: `002_hsa_medical.sql`_

| Column | Type | NN | Default | PK | In migrations |
|---|---|---|---|---|---|
| `id` | INTEGER |  |  | ✓ | ✓ |
| `date` | DATE | ✓ |  |  | ✓ |
| `patient` | TEXT | ✓ | `'Self'` |  | ✓ |
| `provider` | TEXT |  |  |  | ✓ |
| `category` | TEXT |  |  |  | ✓ |
| `payment_type` | TEXT |  |  |  | ✓ |
| `total_bill` | REAL |  | `0` |  | ✓ |
| `insurance_paid` | REAL |  | `0` |  | ✓ |
| `you_paid` | REAL |  | `0` |  | ✓ |
| `hsa_eligible` | INTEGER |  | `1` |  | ✓ |
| `receipt_saved` | INTEGER |  | `0` |  | ✓ |
| `receipt_location` | TEXT |  |  |  | ✓ |
| `reimbursed` | INTEGER |  | `0` |  | ✓ |
| `reimbursement_date` | DATE |  |  |  | ✓ |
| `notes` | TEXT |  |  |  | ✓ |
| `created_at` | DATETIME |  | `CURRENT_TIMESTAMP` |  | ✓ |
| `updated_at` | DATETIME |  | `CURRENT_TIMESTAMP` |  | ✓ |
| `needs_review` | INTEGER | ✓ | `0` |  | ✓ |
| `review_flagged_at` | DATETIME |  |  |  | ✓ |
| `review_reason` | TEXT |  |  |  | ✓ |
| `review_category` | TEXT |  |  |  | ✗ |
| `reimbursement_id` | INTEGER |  |  |  | ✓ |
| `family_member_id` | INTEGER |  |  |  | ✓ |
| `provider_contact_id` | INTEGER |  |  |  | ✓ |
| `eob_claim_id` | INTEGER |  |  |  | ✓ |
| `vendor_contact_id` | INTEGER |  |  |  | ✓ |
| `mileage_miles` | REAL |  |  |  | ✓ |
| `parent_payment_id` | INTEGER |  |  |  | ✓ |
| `status` | TEXT |  | `'final'` |  | ✓ |
| `inbox_attachment_id` | INTEGER |  |  |  | ✓ |

  _(rows: 0)_

### `hsa_plan_info_DEPRECATED_v167`  [in:both]

_Created in: `unknown`_

| Column | Type | NN | Default | PK | In migrations |
|---|---|---|---|---|---|
| `id` | INTEGER |  |  | ✓ | ✓ |
| `plan_year` | INTEGER |  |  |  | ✓ |
| `plan_name` | TEXT |  |  |  | ✓ |
| `carrier_id` | INTEGER |  |  |  | ✗ |
| `individual_deductible` | REAL |  |  |  | ✓ |
| `family_deductible` | REAL |  |  |  | ✓ |
| `individual_oop_max` | REAL |  |  |  | ✓ |
| `family_oop_max` | REAL |  |  |  | ✓ |
| `hsa_contribution_self` | REAL |  | `0` |  | ✓ |
| `hsa_contribution_employer` | REAL |  | `0` |  | ✓ |
| `irs_limit_family` | REAL |  |  |  | ✓ |
| `plan_effective_date` | DATE |  |  |  | ✓ |
| `notes` | TEXT |  |  |  | ✓ |
| `updated_at` | DATETIME |  | `CURRENT_TIMESTAMP` |  | ✓ |
| `insurance_carrier` | TEXT |  |  |  | ✓ |
| `irs_limit_self_only` | REAL |  | `0` |  | ✓ |
| `custodian` | TEXT |  |  |  | ✓ |
| `active` | INTEGER |  | `1` |  | ✓ |

  _(rows: 1)_

### `hsa_reimbursement_items`  [in:both]

_Created in: `002_hsa_medical.sql`_

| Column | Type | NN | Default | PK | In migrations |
|---|---|---|---|---|---|
| `id` | INTEGER |  |  | ✓ | ✓ |
| `reimbursement_id` | INTEGER | ✓ |  |  | ✓ |
| `expense_type` | TEXT | ✓ |  |  | ✓ |
| `expense_id` | INTEGER | ✓ |  |  | ✓ |
| `amount` | REAL |  |  |  | ✓ |

  _(rows: 0)_

### `hsa_reimbursements`  [in:both]

_Created in: `002_hsa_medical.sql`_

| Column | Type | NN | Default | PK | In migrations |
|---|---|---|---|---|---|
| `id` | INTEGER |  |  | ✓ | ✓ |
| `reimbursement_date` | DATE |  |  |  | ✓ |
| `total_amount` | REAL |  |  |  | ✓ |
| `from_year` | INTEGER |  |  |  | ✓ |
| `method` | TEXT |  |  |  | ✓ |
| `notes` | TEXT |  |  |  | ✓ |
| `created_at` | DATETIME |  | `CURRENT_TIMESTAMP` |  | ✓ |

  _(rows: 0)_

### `import_batches`  [in:both]

_Created in: `032_import_finance.sql`_

| Column | Type | NN | Default | PK | In migrations |
|---|---|---|---|---|---|
| `id` | INTEGER |  |  | ✓ | ✓ |
| `account_id` | INTEGER | ✓ |  |  | ✓ |
| `filename` | TEXT | ✓ |  |  | ✓ |
| `format` | TEXT |  |  |  | ✓ |
| `row_count` | INTEGER | ✓ | `0` |  | ✓ |
| `imported_at` | DATETIME |  | `CURRENT_TIMESTAMP` |  | ✓ |
| `statement_date` | DATE |  |  |  | ✓ |
| `notes` | TEXT |  |  |  | ✗ |
| `rows_total` | INTEGER |  | `0` |  | ✓ |
| `statement_month` | TEXT |  |  |  | ✓ |

  _(rows: 0)_

### `import_category_rules`  [in:both]

_Created in: `046_import_category_rules.sql`_

| Column | Type | NN | Default | PK | In migrations |
|---|---|---|---|---|---|
| `id` | INTEGER |  |  | ✓ | ✓ |
| `pattern` | TEXT | ✓ |  |  | ✓ |
| `category` | TEXT | ✓ |  |  | ✓ |
| `sort_order` | INTEGER | ✓ | `100` |  | ✓ |
| `is_active` | INTEGER | ✓ | `1` |  | ✓ |
| `created_at` | DATETIME |  | `CURRENT_TIMESTAMP` |  | ✓ |
| `priority` | INTEGER |  | `100` |  | ✓ |
| `match_count` | INTEGER |  | `0` |  | ✓ |
| `last_matched` | DATETIME |  |  |  | ✓ |

  _(rows: 167)_

### `important_dates`  [in:prod-only]

_Origin: not found in any migration (prod-only table)._

| Column | Type | NN | Default | PK |
|---|---|---|---|---|
| `id` | INTEGER |  |  | ✓ |
| `person_event` | TEXT | ✓ |  |  |
| `person_id` | INTEGER |  |  |  |
| `date_mmdd` | TEXT |  |  |  |
| `year_born` | INTEGER |  |  |  |
| `reminder_set` | INTEGER |  | `0` |  |
| `notes` | TEXT |  |  |  |
| `created_at` | DATETIME |  | `CURRENT_TIMESTAMP` |  |

  _(rows: 0)_

### `imported_transactions`  [in:both]

_Created in: `032_import_finance.sql`_

| Column | Type | NN | Default | PK | In migrations |
|---|---|---|---|---|---|
| `id` | INTEGER |  |  |  | ✓ |
| `account_id` | INTEGER |  |  |  | ✓ |
| `batch_id` | INTEGER |  |  |  | ✓ |
| `txn_date` | DATE |  |  |  | ✓ |
| `post_date` | DATE |  |  |  | ✓ |
| `description` | TEXT |  |  |  | ✓ |
| `amount` | REAL |  |  |  | ✓ |
| `balance` | REAL |  |  |  | ✓ |
| `category` | TEXT |  |  |  | ✓ |
| `txn_type` | TEXT |  |  |  | ✓ |
| `is_transfer` | INTEGER |  |  |  | ✓ |
| `memo` | TEXT |  |  |  | ✓ |
| `fingerprint` | TEXT |  |  |  | ✓ |
| `flagged` | INTEGER |  |  |  | ✓ |
| `created_at` | DATETIME |  |  |  | ✓ |

  _(rows: 0)_

### `insurance`  [in:prod-only]

_Origin: not found in any migration (prod-only table)._

| Column | Type | NN | Default | PK |
|---|---|---|---|---|
| `id` | INTEGER |  |  | ✓ |
| `policy_type` | TEXT |  |  |  |
| `carrier_id` | INTEGER |  |  |  |
| `policy_number` | TEXT |  |  |  |
| `owner_id` | INTEGER |  |  |  |
| `coverage_amount` | REAL |  |  |  |
| `annual_premium` | REAL |  |  |  |
| `renewal_date` | DATE |  |  |  |
| `auto_renew` | INTEGER |  | `0` |  |
| `agent_id` | INTEGER |  |  |  |
| `beneficiary` | TEXT |  |  |  |
| `notes` | TEXT |  |  |  |
| `created_at` | DATETIME |  | `CURRENT_TIMESTAMP` |  |
| `updated_at` | DATETIME |  | `CURRENT_TIMESTAMP` |  |

  _(rows: 0)_

### `insurance_attachments`  [in:both]

_Created in: `110_insurance.sql`_

| Column | Type | NN | Default | PK | In migrations |
|---|---|---|---|---|---|
| `id` | INTEGER |  |  | ✓ | ✓ |
| `policy_id` | INTEGER | ✓ |  |  | ✓ |
| `file_name` | TEXT | ✓ |  |  | ✓ |
| `file_path` | TEXT | ✓ |  |  | ✓ |
| `label` | TEXT |  |  |  | ✓ |
| `uploaded_at` | TEXT |  | `CURRENT_TIMESTAMP` |  | ✓ |

  _(rows: 0)_

### `insurance_policies`  [in:both]

_Created in: `110_insurance.sql`_

| Column | Type | NN | Default | PK | In migrations |
|---|---|---|---|---|---|
| `id` | INTEGER |  |  | ✓ | ✓ |
| `policy_group_id` | INTEGER |  |  |  | ✓ |
| `policy_type` | TEXT | ✓ |  |  | ✓ |
| `provider_contact_id` | INTEGER |  |  |  | ✓ |
| `agent_contact_id` | INTEGER |  |  |  | ✓ |
| `policy_number` | TEXT |  |  |  | ✓ |
| `coverage_start_date` | TEXT | ✓ |  |  | ✓ |
| `coverage_end_date` | TEXT |  |  |  | ✓ |
| `premium_amount` | REAL |  |  |  | ✓ |
| `premium_frequency` | TEXT |  | `'annual'` |  | ✓ |
| `deductible` | REAL |  |  |  | ✓ |
| `coverage_limit` | REAL |  |  |  | ✓ |
| `coverage_details` | TEXT |  |  |  | ✓ |
| `vehicle_id` | INTEGER |  |  |  | ✓ |
| `property_id` | INTEGER |  |  |  | ✓ |
| `status` | TEXT |  | `'active'` |  | ✓ |
| `alert_days_before` | INTEGER |  | `60` |  | ✓ |
| `notes` | TEXT |  |  |  | ✓ |
| `created_at` | TEXT |  | `CURRENT_TIMESTAMP` |  | ✓ |
| `updated_at` | TEXT |  | `CURRENT_TIMESTAMP` |  | ✓ |

  _(rows: 0)_

### `insurance_policy_members`  [in:both]

_Created in: `110_insurance.sql`_

| Column | Type | NN | Default | PK | In migrations |
|---|---|---|---|---|---|
| `id` | INTEGER |  |  | ✓ | ✓ |
| `policy_id` | INTEGER | ✓ |  |  | ✓ |
| `family_member_id` | INTEGER | ✓ |  |  | ✓ |

  _(rows: 0)_

### `irs_mileage_rates`  [in:both]

_Created in: `118_hsa_inbox_lp_fsa.sql`_

| Column | Type | NN | Default | PK | In migrations |
|---|---|---|---|---|---|
| `id` | INTEGER |  |  | ✓ | ✓ |
| `year` | INTEGER | ✓ |  |  | ✓ |
| `start_date` | TEXT | ✓ |  |  | ✓ |
| `end_date` | TEXT |  |  |  | ✓ |
| `rate_cents` | INTEGER | ✓ |  |  | ✓ |
| `category` | TEXT | ✓ | `'medical'` |  | ✓ |

  _(rows: 6)_

### `item_events`  [in:both]

_Created in: `001_initial.sql`_

| Column | Type | NN | Default | PK | In migrations |
|---|---|---|---|---|---|
| `id` | INTEGER |  |  | ✓ | ✓ |
| `item_id` | INTEGER | ✓ |  |  | ✓ |
| `event_type` | TEXT | ✓ |  |  | ✓ |
| `field_changed` | TEXT |  |  |  | ✓ |
| `old_value` | TEXT |  |  |  | ✓ |
| `new_value` | TEXT |  |  |  | ✓ |
| `notes` | TEXT |  |  |  | ✓ |
| `created_by` | TEXT |  |  |  | ✓ |
| `created_at` | DATETIME |  | `CURRENT_TIMESTAMP` |  | ✓ |

  _(rows: 122)_

### `item_hw_details`  [in:both]

_Created in: `005_health_wellness.sql`_

| Column | Type | NN | Default | PK | In migrations |
|---|---|---|---|---|---|
| `id` | INTEGER |  |  | ✓ | ✓ |
| `item_id` | INTEGER | ✓ |  |  | ✓ |
| `hw_subcategory` | TEXT | ✓ | `'OTC'` |  | ✓ |
| `family_member_id` | INTEGER |  |  |  | ✓ |
| `dosage_strength` | TEXT |  |  |  | ✓ |
| `expiration_date` | DATE |  |  |  | ✓ |
| `lot_number` | TEXT |  |  |  | ✓ |
| `active_ingredients` | TEXT |  |  |  | ✓ |
| `rx_number` | TEXT |  |  |  | ✓ |
| `pharmacy_contact_id` | INTEGER |  |  |  | ✓ |
| `prescribing_doctor_id` | INTEGER |  |  |  | ✓ |
| `date_filled` | DATE |  |  |  | ✓ |
| `refills_remaining` | INTEGER |  |  |  | ✓ |
| `next_refill_date` | DATE |  |  |  | ✓ |
| `created_at` | DATETIME |  | `CURRENT_TIMESTAMP` |  | ✓ |
| `updated_at` | DATETIME |  | `CURRENT_TIMESTAMP` |  | ✓ |

  _(rows: 0)_

### `item_maintenance_log`  [in:both]

_Created in: `001_initial.sql`_

| Column | Type | NN | Default | PK | In migrations |
|---|---|---|---|---|---|
| `id` | INTEGER |  |  | ✓ | ✓ |
| `item_id` | INTEGER | ✓ |  |  | ✓ |
| `log_date` | DATE | ✓ |  |  | ✓ |
| `maintenance_type` | TEXT | ✓ | `'service'` |  | ✓ |
| `description` | TEXT |  |  |  | ✓ |
| `cost` | REAL |  |  |  | ✓ |
| `provider` | TEXT |  |  |  | ✓ |
| `next_due_date` | DATE |  |  |  | ✓ |
| `notes` | TEXT |  |  |  | ✓ |
| `created_at` | DATETIME |  | `CURRENT_TIMESTAMP` |  | ✓ |
| `provider_contact_id` | INTEGER |  |  |  | ✓ |

  _(rows: 0)_

### `items`  [in:both]

_Created in: `001_initial.sql`_

| Column | Type | NN | Default | PK | In migrations |
|---|---|---|---|---|---|
| `id` | INTEGER |  |  | ✓ | ✓ |
| `item_ref` | TEXT |  |  |  | ✓ |
| `name` | TEXT | ✓ |  |  | ✓ |
| `description` | TEXT |  |  |  | ✓ |
| `category` | TEXT |  |  |  | ✓ |
| `parent_type` | TEXT | ✓ |  |  | ✓ |
| `parent_id` | INTEGER | ✓ |  |  | ✓ |
| `is_container` | INTEGER |  | `0` |  | ✓ |
| `quantity` | INTEGER |  | `1` |  | ✓ |
| `brand` | TEXT |  |  |  | ✓ |
| `model_number` | TEXT |  |  |  | ✓ |
| `serial_number` | TEXT |  |  |  | ✓ |
| `manufacturer` | TEXT |  |  |  | ✓ |
| `upc_barcode` | TEXT |  |  |  | ✓ |
| `purchase_date` | DATE |  |  |  | ✓ |
| `purchase_price` | REAL |  |  |  | ✓ |
| `purchased_from` | TEXT |  |  |  | ✓ |
| `replacement_value` | REAL |  |  |  | ✓ |
| `appraised_value` | REAL |  |  |  | ✓ |
| `appraised_date` | DATE |  |  |  | ✓ |
| `condition` | TEXT |  |  |  | ✓ |
| `insured` | INTEGER |  | `0` |  | ✓ |
| `warranty_expires` | DATE |  |  |  | ✓ |
| `lifetime_warranty` | INTEGER |  | `0` |  | ✓ |
| `warranty_vendor` | TEXT |  |  |  | ✓ |
| `warranty_phone` | TEXT |  |  |  | ✓ |
| `warranty_claim_url` | TEXT |  |  |  | ✓ |
| `warranty_notes` | TEXT |  |  |  | ✓ |
| `manufacturer_support_phone` | TEXT |  |  |  | ✓ |
| `manufacturer_support_url` | TEXT |  |  |  | ✓ |
| `manufacturer_country` | TEXT |  |  |  | ✓ |
| `sold_date` | DATE |  |  |  | ✓ |
| `sold_price` | REAL |  |  |  | ✓ |
| `sold_to` | TEXT |  |  |  | ✓ |
| `disposed_reason` | TEXT |  |  |  | ✗ |
| `is_active` | INTEGER |  | `1` |  | ✓ |
| `qr_code_path` | TEXT |  |  |  | ✓ |
| `notes` | TEXT |  |  |  | ✓ |
| `created_at` | DATETIME |  | `CURRENT_TIMESTAMP` |  | ✓ |
| `updated_at` | DATETIME |  | `CURRENT_TIMESTAMP` |  | ✓ |
| `archived_at` | DATETIME |  |  |  | ✓ |
| `archived_reason` | TEXT |  |  |  | ✓ |
| `purchase_method` | TEXT |  |  |  | ✓ |
| `order_number` | TEXT |  |  |  | ✓ |
| `insurance_policy` | TEXT |  |  |  | ✓ |
| `insured_value` | REAL |  |  |  | ✓ |
| `is_archived` | INTEGER |  | `0` |  | ✓ |
| `store_name` | TEXT |  |  |  | ✓ |
| `is_business` | INTEGER |  | `0` |  | ✓ |
| `needs_review` | INTEGER | ✓ | `0` |  | ✓ |
| `review_flagged_at` | DATETIME |  |  |  | ✓ |
| `review_reason` | TEXT |  |  |  | ✓ |
| `warranty_vendor_contact_id` | INTEGER |  |  |  | ✓ |
| `size` | TEXT |  |  |  | ✓ |
| `review_category` | TEXT |  |  |  | ✗ |
| `family_member_id` | INTEGER |  |  |  | ✓ |
| `wardrobe_owner_id` | INTEGER |  |  |  | ✓ |
| `wardrobe_sequence` | INTEGER |  |  |  | ✓ |
| `wardrobe_nickname` | TEXT |  |  |  | ✓ |
| `season_tags` | TEXT |  |  |  | ✓ |
| `occasion_tags` | TEXT |  |  |  | ✓ |
| `wardrobe_status` | TEXT |  | `'active'` |  | ✓ |
| `wardrobe_status_date` | TEXT |  |  |  | ✓ |
| `wardrobe_status_notes` | TEXT |  |  |  | ✓ |
| `sold_platform` | TEXT |  |  |  | ✓ |
| `donated_org_contact_id` | INTEGER |  |  |  | ✓ |
| `donated_fmv` | REAL |  |  |  | ✓ |
| `discarded_reason` | TEXT |  |  |  | ✓ |
| `warranty_expiry` | TEXT |  |  |  | ✓ |
| `warranty_provider_contact_id` | INTEGER |  |  |  | ✓ |
| `warranty_details` | TEXT |  |  |  | ✓ |
| `warranty_registration_no` | TEXT |  |  |  | ✓ |
| `wardrobe_color` | TEXT |  |  |  | ✓ |

  _(rows: 27)_

### `items_fts`  [in:both]

_Created in: `unknown`_

| Column | Type | NN | Default | PK | In migrations |
|---|---|---|---|---|---|
| `name` | — |  |  |  | ✓ |
| `description` | — |  |  |  | ✓ |
| `brand` | — |  |  |  | ✓ |
| `model_number` | — |  |  |  | ✓ |
| `serial_number` | — |  |  |  | ✓ |
| `notes` | — |  |  |  | ✓ |

  _(rows: 27)_

### `items_fts_config`  [in:both]

_Created in: `unknown`_

| Column | Type | NN | Default | PK | In migrations |
|---|---|---|---|---|---|
| `k` | — | ✓ |  | ✓ | ✓ |
| `v` | — |  |  |  | ✓ |

  _(rows: 1)_

### `items_fts_data`  [in:both]

_Created in: `unknown`_

| Column | Type | NN | Default | PK | In migrations |
|---|---|---|---|---|---|
| `id` | INTEGER |  |  | ✓ | ✓ |
| `block` | BLOB |  |  |  | ✓ |

  _(rows: 16)_

### `items_fts_docsize`  [in:both]

_Created in: `unknown`_

| Column | Type | NN | Default | PK | In migrations |
|---|---|---|---|---|---|
| `id` | INTEGER |  |  | ✓ | ✓ |
| `sz` | BLOB |  |  |  | ✓ |

  _(rows: 27)_

### `items_fts_idx`  [in:both]

_Created in: `unknown`_

| Column | Type | NN | Default | PK | In migrations |
|---|---|---|---|---|---|
| `segid` | — | ✓ |  | ✓ | ✓ |
| `term` | — | ✓ |  | ✓ | ✓ |
| `pgno` | — |  |  |  | ✓ |

  _(rows: 13)_

### `kid_activities`  [in:both]

_Created in: `028_kids.sql`_

| Column | Type | NN | Default | PK | In migrations |
|---|---|---|---|---|---|
| `id` | INTEGER |  |  | ✓ | ✓ |
| `kid_id` | INTEGER |  |  |  | ✓ |
| `name` | TEXT | ✓ |  |  | ✓ |
| `category` | TEXT |  | `'Other'` |  | ✓ |
| `day_of_week` | TEXT |  |  |  | ✓ |
| `start_time` | TEXT |  |  |  | ✓ |
| `end_time` | TEXT |  |  |  | ✓ |
| `location` | TEXT |  |  |  | ✓ |
| `contact_id` | INTEGER |  |  |  | ✓ |
| `cost_per_month` | REAL |  |  |  | ✓ |
| `season` | TEXT |  |  |  | ✓ |
| `start_date` | DATE |  |  |  | ✓ |
| `end_date` | DATE |  |  |  | ✓ |
| `notes` | TEXT |  |  |  | ✓ |
| `is_active` | INTEGER | ✓ | `1` |  | ✓ |
| `created_at` | DATETIME |  | `CURRENT_TIMESTAMP` |  | ✓ |
| `needs_review` | INTEGER | ✓ | `0` |  | ✓ |
| `review_flagged_at` | DATETIME |  |  |  | ✓ |
| `review_reason` | TEXT |  |  |  | ✓ |

  _(rows: 0)_

### `kid_notes`  [in:both]

_Created in: `028_kids.sql`_

| Column | Type | NN | Default | PK | In migrations |
|---|---|---|---|---|---|
| `id` | INTEGER |  |  | ✓ | ✓ |
| `kid_id` | INTEGER |  |  |  | ✓ |
| `note_date` | DATE | ✓ | `DATE('now')` |  | ✓ |
| `category` | TEXT |  | `'General'` |  | ✓ |
| `title` | TEXT |  |  |  | ✓ |
| `body` | TEXT | ✓ |  |  | ✓ |
| `created_at` | DATETIME |  | `CURRENT_TIMESTAMP` |  | ✓ |
| `needs_review` | INTEGER | ✓ | `0` |  | ✓ |
| `review_flagged_at` | DATETIME |  |  |  | ✓ |
| `review_reason` | TEXT |  |  |  | ✓ |

  _(rows: 0)_

### `kids`  [in:both]

_Created in: `028_kids.sql`_

| Column | Type | NN | Default | PK | In migrations |
|---|---|---|---|---|---|
| `id` | INTEGER |  |  | ✓ | ✓ |
| `family_member_id` | INTEGER |  |  |  | ✓ |
| `display_name` | TEXT | ✓ |  |  | ✓ |
| `date_of_birth` | DATE |  |  |  | ✓ |
| `grade` | TEXT |  |  |  | ✓ |
| `school_id` | INTEGER |  |  |  | ✓ |
| `teacher_name` | TEXT |  |  |  | ✓ |
| `homeroom` | TEXT |  |  |  | ✓ |
| `allergies` | TEXT |  |  |  | ✓ |
| `medications_note` | TEXT |  |  |  | ✓ |
| `emergency_note` | TEXT |  |  |  | ✓ |
| `photo_url` | TEXT |  |  |  | ✓ |
| `notes` | TEXT |  |  |  | ✓ |
| `is_active` | INTEGER | ✓ | `1` |  | ✓ |
| `created_at` | DATETIME |  | `CURRENT_TIMESTAMP` |  | ✓ |
| `updated_at` | DATETIME |  | `CURRENT_TIMESTAMP` |  | ✓ |
| `needs_review` | INTEGER | ✓ | `0` |  | ✓ |
| `review_flagged_at` | DATETIME |  |  |  | ✓ |
| `review_reason` | TEXT |  |  |  | ✓ |
| `review_category` | TEXT |  |  |  | ✗ |
| `teacher_contact_id` | INTEGER |  |  |  | ✓ |

  _(rows: 3)_

### `loans_debt`  [in:prod-only]

_Origin: not found in any migration (prod-only table)._

| Column | Type | NN | Default | PK |
|---|---|---|---|---|
| `id` | INTEGER |  |  | ✓ |
| `loan_name` | TEXT | ✓ |  |  |
| `loan_type` | TEXT |  |  |  |
| `lender_id` | INTEGER |  |  |  |
| `original_amount` | REAL |  |  |  |
| `current_balance` | REAL |  |  |  |
| `interest_rate` | REAL |  |  |  |
| `monthly_payment` | REAL |  |  |  |
| `start_date` | DATE |  |  |  |
| `payoff_date` | DATE |  |  |  |
| `status` | TEXT |  | `'Active'` |  |
| `notes` | TEXT |  |  |  |
| `created_at` | DATETIME |  | `CURRENT_TIMESTAMP` |  |
| `updated_at` | DATETIME |  | `CURRENT_TIMESTAMP` |  |

  _(rows: 0)_

### `locations`  [in:both]

_Created in: `001_initial.sql`_

| Column | Type | NN | Default | PK | In migrations |
|---|---|---|---|---|---|
| `id` | INTEGER |  |  | ✓ | ✓ |
| `name` | TEXT | ✓ |  |  | ✓ |
| `description` | TEXT |  |  |  | ✓ |
| `location_type` | TEXT |  | `'room'` |  | ✓ |
| `parent_location_id` | INTEGER |  |  |  | ✓ |
| `address` | TEXT |  |  |  | ✓ |
| `photo_path` | TEXT |  |  |  | ✗ |
| `notes` | TEXT |  |  |  | ✓ |
| `created_at` | DATETIME |  | `CURRENT_TIMESTAMP` |  | ✓ |
| `updated_at` | DATETIME |  | `CURRENT_TIMESTAMP` |  | ✓ |
| `address_street` | TEXT |  |  |  | ✓ |
| `address_city` | TEXT |  |  |  | ✓ |
| `address_state` | TEXT |  |  |  | ✓ |
| `address_zip` | TEXT |  |  |  | ✓ |

  _(rows: 4)_

### `med_allergies`  [in:both]

_Created in: `131_medical_expansion.js`_

| Column | Type | NN | Default | PK | In migrations |
|---|---|---|---|---|---|
| `id` | INTEGER |  |  | ✓ | ✓ |
| `family_member_id` | INTEGER |  |  |  | ✓ |
| `patient` | TEXT |  |  |  | ✓ |
| `allergen` | TEXT | ✓ |  |  | ✓ |
| `allergen_type` | TEXT |  |  |  | ✓ |
| `reaction` | TEXT |  |  |  | ✓ |
| `severity` | TEXT |  |  |  | ✓ |
| `status` | TEXT |  | `'Active'` |  | ✓ |
| `noted_date` | DATE |  |  |  | ✓ |
| `source_system` | TEXT |  |  |  | ✓ |
| `notes` | TEXT |  |  |  | ✓ |
| `dedup_hash` | TEXT |  |  |  | ✓ |
| `created_at` | DATETIME |  | `CURRENT_TIMESTAMP` |  | ✓ |
| `updated_at` | DATETIME |  | `CURRENT_TIMESTAMP` |  | ✓ |

  _(rows: 0)_

### `med_condition_metrics`  [in:both]

_Created in: `124_card_schema_expansion.js`_

| Column | Type | NN | Default | PK | In migrations |
|---|---|---|---|---|---|
| `id` | INTEGER |  |  | ✓ | ✓ |
| `condition_id` | INTEGER | ✓ |  |  | ✓ |
| `metric_name` | TEXT | ✓ |  |  | ✓ |
| `value_numeric` | REAL |  |  |  | ✓ |
| `value_text` | TEXT |  |  |  | ✓ |
| `unit` | TEXT |  |  |  | ✓ |
| `measured_on` | DATE | ✓ |  |  | ✓ |
| `measured_at` | DATETIME |  | `CURRENT_TIMESTAMP` |  | ✓ |
| `source` | TEXT |  | `'manual'` |  | ✓ |
| `source_visit_id` | INTEGER |  |  |  | ✓ |
| `notes` | TEXT |  |  |  | ✓ |

  _(rows: 0)_

### `med_conditions`  [in:both]

_Created in: `002_hsa_medical.sql`_

| Column | Type | NN | Default | PK | In migrations |
|---|---|---|---|---|---|
| `id` | INTEGER |  |  | ✓ | ✓ |
| `patient` | TEXT | ✓ | `'Self'` |  | ✓ |
| `condition_name` | TEXT | ✓ |  |  | ✓ |
| `start_date` | DATE |  |  |  | ✓ |
| `end_date` | DATE |  |  |  | ✓ |
| `physician` | TEXT |  |  |  | ✓ |
| `treatment_notes` | TEXT |  |  |  | ✓ |
| `status` | TEXT |  | `'Active'` |  | ✓ |
| `notes` | TEXT |  |  |  | ✓ |
| `created_at` | DATETIME |  | `CURRENT_TIMESTAMP` |  | ✓ |
| `updated_at` | DATETIME |  | `CURRENT_TIMESTAMP` |  | ✓ |
| `needs_review` | INTEGER | ✓ | `0` |  | ✓ |
| `review_flagged_at` | DATETIME |  |  |  | ✓ |
| `review_reason` | TEXT |  |  |  | ✓ |
| `physician_contact_id` | INTEGER |  |  |  | ✓ |
| `review_category` | TEXT |  |  |  | ✗ |
| `family_member_id` | INTEGER |  |  |  | ✓ |
| `body_system` | TEXT |  |  |  | ✓ |
| `goal` | TEXT |  |  |  | ✓ |
| `tracked_metric` | TEXT |  |  |  | ✓ |
| `condition_state` | TEXT |  |  |  | ✓ |
| `dedup_hash` | TEXT |  |  |  | ✓ |
| `icd10_code` | TEXT |  |  |  | ✓ |
| `severity` | TEXT |  |  |  | ✓ |
| `source_system` | TEXT |  |  |  | ✓ |

  _(rows: 1)_

### `med_diagnostics`  [in:both]

_Created in: `131_medical_expansion.js`_

| Column | Type | NN | Default | PK | In migrations |
|---|---|---|---|---|---|
| `id` | INTEGER |  |  | ✓ | ✓ |
| `family_member_id` | INTEGER |  |  |  | ✓ |
| `patient` | TEXT |  |  |  | ✓ |
| `test_name` | TEXT | ✓ |  |  | ✓ |
| `test_type` | TEXT |  |  |  | ✓ |
| `test_date` | DATE |  |  |  | ✓ |
| `status` | TEXT |  | `'final'` |  | ✓ |
| `impression` | TEXT |  |  |  | ✓ |
| `ordering_contact_id` | INTEGER |  |  |  | ✓ |
| `performing_contact_id` | INTEGER |  |  |  | ✓ |
| `facility` | TEXT |  |  |  | ✓ |
| `source_system` | TEXT |  |  |  | ✓ |
| `source_visit_id` | INTEGER |  |  |  | ✓ |
| `notes` | TEXT |  |  |  | ✓ |
| `dedup_hash` | TEXT |  |  |  | ✓ |
| `created_at` | DATETIME |  | `CURRENT_TIMESTAMP` |  | ✓ |
| `updated_at` | DATETIME |  | `CURRENT_TIMESTAMP` |  | ✓ |

  _(rows: 0)_

### `med_eob_balances`  [in:both]

_Created in: `057_eob_balances.sql`_

| Column | Type | NN | Default | PK | In migrations |
|---|---|---|---|---|---|
| `id` | INTEGER |  |  | ✓ | ✓ |
| `eob_id` | INTEGER | ✓ |  |  | ✓ |
| `person` | TEXT | ✓ |  |  | ✓ |
| `balance_type` | TEXT | ✓ |  |  | ✓ |
| `annual_limit` | REAL |  |  |  | ✓ |
| `amount_used` | REAL |  |  |  | ✓ |
| `amount_remaining` | REAL |  |  |  | ✓ |

  _(rows: 0)_

### `med_eob_claims`  [in:both]

_Created in: `055_eob_claims.sql`_

| Column | Type | NN | Default | PK | In migrations |
|---|---|---|---|---|---|
| `id` | INTEGER |  |  | ✓ | ✓ |
| `eob_id` | INTEGER | ✓ |  |  | ✓ |
| `patient` | TEXT | ✓ |  |  | ✓ |
| `claim_id` | TEXT |  |  |  | ✓ |
| `received_date` | DATE |  |  |  | ✓ |
| `provider` | TEXT |  |  |  | ✓ |
| `network_status` | TEXT |  |  |  | ✓ |
| `send_date` | DATE |  |  |  | ✓ |
| `amount_billed` | REAL |  |  |  | ✓ |
| `member_rate` | REAL |  |  |  | ✓ |
| `pending_not_payable` | REAL |  |  |  | ✓ |
| `applied_to_deductible` | REAL |  |  |  | ✓ |
| `copay` | REAL |  |  |  | ✓ |
| `plan_paid` | REAL |  |  |  | ✓ |
| `fund_paid` | REAL |  |  |  | ✓ |
| `coinsurance` | REAL |  |  |  | ✓ |
| `your_share` | REAL |  |  |  | ✓ |
| `family_member_id` | INTEGER |  |  |  | ✓ |
| `provider_contact_id` | INTEGER |  |  |  | ✓ |
| `dedup_hash` | TEXT |  |  |  | ✓ |
| `provider_npi` | TEXT |  |  |  | ✓ |
| `diagnosis_codes` | TEXT |  |  |  | ✓ |
| `place_of_service` | TEXT |  |  |  | ✓ |
| `claim_status` | TEXT |  |  |  | ✓ |
| `denial_reason_codes` | TEXT |  |  |  | ✓ |
| `prior_auth_ref` | TEXT |  |  |  | ✓ |
| `appeal_deadline` | DATE |  |  |  | ✓ |

  _(rows: 0)_

### `med_eob_services`  [in:both]

_Created in: `056_eob_services.sql`_

| Column | Type | NN | Default | PK | In migrations |
|---|---|---|---|---|---|
| `id` | INTEGER |  |  | ✓ | ✓ |
| `claim_id` | INTEGER | ✓ |  |  | ✓ |
| `service_description` | TEXT |  |  |  | ✓ |
| `service_code` | TEXT |  |  |  | ✓ |
| `service_date` | DATE |  |  |  | ✓ |
| `amount_billed` | REAL |  |  |  | ✓ |
| `member_rate` | REAL |  |  |  | ✓ |
| `pending_not_payable` | REAL |  |  |  | ✓ |
| `applied_to_deductible` | REAL |  |  |  | ✓ |
| `copay` | REAL |  |  |  | ✓ |
| `amount_remaining` | REAL |  |  |  | ✓ |
| `plan_share` | REAL |  |  |  | ✓ |
| `coinsurance` | REAL |  |  |  | ✓ |
| `your_share` | REAL |  |  |  | ✓ |
| `cpt_modifiers` | TEXT |  |  |  | ✓ |
| `hsa_eligible` | INTEGER |  | `1` |  | ✓ |

  _(rows: 0)_

### `med_eob_statements`  [in:both]

_Created in: `054_eob_statements.sql`_

| Column | Type | NN | Default | PK | In migrations |
|---|---|---|---|---|---|
| `id` | INTEGER |  |  | ✓ | ✓ |
| `insurer` | TEXT | ✓ | `'MHBP'` |  | ✓ |
| `plan_name` | TEXT |  |  |  | ✓ |
| `group_name` | TEXT |  |  |  | ✓ |
| `member_id` | TEXT |  |  |  | ✓ |
| `group_number` | TEXT |  |  |  | ✓ |
| `member_name` | TEXT |  |  |  | ✓ |
| `statement_date` | DATE | ✓ |  |  | ✓ |
| `period_start` | DATE |  |  |  | ✓ |
| `period_end` | DATE |  |  |  | ✓ |
| `amount_billed` | REAL |  |  |  | ✓ |
| `allowed_amount` | REAL |  |  |  | ✓ |
| `pending_not_payable` | REAL |  |  |  | ✓ |
| `deductible_applied` | REAL |  |  |  | ✓ |
| `copay_total` | REAL |  |  |  | ✓ |
| `coinsurance_total` | REAL |  |  |  | ✓ |
| `plan_paid_total` | REAL |  |  |  | ✓ |
| `your_share_total` | REAL |  |  |  | ✓ |
| `amount_saved` | REAL |  |  |  | ✓ |
| `healthfund_applied` | REAL |  |  |  | ✓ |
| `deductible_annual` | REAL |  |  |  | ✓ |
| `deductible_used` | REAL |  |  |  | ✓ |
| `deductible_remaining` | REAL |  |  |  | ✓ |
| `oop_max_annual` | REAL |  |  |  | ✓ |
| `oop_used` | REAL |  |  |  | ✓ |
| `oop_remaining` | REAL |  |  |  | ✓ |
| `healthfund_total` | REAL |  |  |  | ✓ |
| `healthfund_used` | REAL |  |  |  | ✓ |
| `healthfund_remaining` | REAL |  |  |  | ✓ |
| `source_filename` | TEXT |  |  |  | ✓ |
| `created_at` | DATETIME |  | `CURRENT_TIMESTAMP` |  | ✓ |
| `insurer_contact_id` | INTEGER |  |  |  | ✓ |
| `file_hash` | TEXT |  |  |  | ✓ |
| `dedup_hash` | TEXT |  |  |  | ✓ |
| `auto_imported` | INTEGER |  | `0` |  | ✓ |

  _(rows: 0)_

### `med_immunizations`  [in:both]

_Created in: `144_med_immunizations.js`_

| Column | Type | NN | Default | PK | In migrations |
|---|---|---|---|---|---|
| `id` | INTEGER |  |  | ✓ | ✓ |
| `family_member_id` | INTEGER | ✓ |  |  | ✓ |
| `vaccine_name` | TEXT | ✓ |  |  | ✓ |
| `date_given` | DATE | ✓ |  |  | ✓ |
| `dose_number` | INTEGER |  |  |  | ✓ |
| `lot_number` | TEXT |  |  |  | ✓ |
| `administered_by_contact_id` | INTEGER |  |  |  | ✓ |
| `location_text` | TEXT |  |  |  | ✓ |
| `next_due_date` | DATE |  |  |  | ✓ |
| `notes` | TEXT |  |  |  | ✓ |
| `created_at` | DATETIME |  | `CURRENT_TIMESTAMP` |  | ✓ |
| `updated_at` | DATETIME |  | `CURRENT_TIMESTAMP` |  | ✓ |

  _(rows: 0)_

### `med_lab_results`  [in:both]

_Created in: `131_medical_expansion.js`_

| Column | Type | NN | Default | PK | In migrations |
|---|---|---|---|---|---|
| `id` | INTEGER |  |  | ✓ | ✓ |
| `family_member_id` | INTEGER |  |  |  | ✓ |
| `patient` | TEXT |  |  |  | ✓ |
| `panel_name` | TEXT |  |  |  | ✓ |
| `test_name` | TEXT | ✓ |  |  | ✓ |
| `test_date` | DATE | ✓ |  |  | ✓ |
| `value_numeric` | REAL |  |  |  | ✓ |
| `value_text` | TEXT |  |  |  | ✓ |
| `unit` | TEXT |  |  |  | ✓ |
| `reference_low` | REAL |  |  |  | ✓ |
| `reference_high` | REAL |  |  |  | ✓ |
| `reference_text` | TEXT |  |  |  | ✓ |
| `flag` | TEXT |  |  |  | ✓ |
| `ordering_contact_id` | INTEGER |  |  |  | ✓ |
| `source_system` | TEXT |  |  |  | ✓ |
| `source_visit_id` | INTEGER |  |  |  | ✓ |
| `notes` | TEXT |  |  |  | ✓ |
| `dedup_hash` | TEXT |  |  |  | ✓ |
| `created_at` | DATETIME |  | `CURRENT_TIMESTAMP` |  | ✓ |
| `updated_at` | DATETIME |  | `CURRENT_TIMESTAMP` |  | ✓ |

  _(rows: 0)_

### `med_medication_conditions`  [in:both]

_Created in: `119_medications_slice1.js`_

| Column | Type | NN | Default | PK | In migrations |
|---|---|---|---|---|---|
| `id` | INTEGER |  |  | ✓ | ✓ |
| `medication_id` | INTEGER | ✓ |  |  | ✓ |
| `condition_id` | INTEGER | ✓ |  |  | ✓ |
| `created_at` | DATETIME |  | `CURRENT_TIMESTAMP` |  | ✓ |

  _(rows: 0)_

### `med_medication_dose_changes`  [in:both]

_Created in: `124_card_schema_expansion.js`_

| Column | Type | NN | Default | PK | In migrations |
|---|---|---|---|---|---|
| `id` | INTEGER |  |  | ✓ | ✓ |
| `medication_id` | INTEGER | ✓ |  |  | ✓ |
| `old_dosage` | TEXT |  |  |  | ✓ |
| `new_dosage` | TEXT |  |  |  | ✓ |
| `changed_at` | DATETIME |  | `CURRENT_TIMESTAMP` |  | ✓ |
| `changed_by` | TEXT |  | `'manual'` |  | ✓ |
| `notes` | TEXT |  |  |  | ✓ |

  _(rows: 0)_

### `med_medication_fills`  [in:both]

_Created in: `119_medications_slice1.js`_

| Column | Type | NN | Default | PK | In migrations |
|---|---|---|---|---|---|
| `id` | INTEGER |  |  | ✓ | ✓ |
| `medication_id` | INTEGER | ✓ |  |  | ✓ |
| `fill_date` | DATE | ✓ |  |  | ✓ |
| `days_supply` | INTEGER |  |  |  | ✓ |
| `pharmacy_contact_id` | INTEGER |  |  |  | ✓ |
| `cost` | REAL |  |  |  | ✓ |
| `hsa_payment_id` | INTEGER |  |  |  | ✓ |
| `notes` | TEXT |  |  |  | ✓ |
| `created_at` | DATETIME |  | `CURRENT_TIMESTAMP` |  | ✓ |
| `quantity` | REAL |  |  |  | ✓ |
| `prescriber_contact_id` | INTEGER |  |  |  | ✓ |
| `brand_dispensed` | TEXT |  |  |  | ✓ |
| `you_paid_oop` | REAL |  |  |  | ✓ |
| `insurance_covered` | REAL |  |  |  | ✓ |
| `rx_number` | TEXT |  |  |  | ✓ |
| `refill_seq` | INTEGER |  |  |  | ✓ |

  _(rows: 0)_

### `med_medications`  [in:both]

_Created in: `002_hsa_medical.sql`_

| Column | Type | NN | Default | PK | In migrations |
|---|---|---|---|---|---|
| `id` | INTEGER |  |  | ✓ | ✓ |
| `patient` | TEXT | ✓ | `'Self'` |  | ✓ |
| `name` | TEXT | ✓ |  |  | ✓ |
| `dosage` | TEXT |  |  |  | ✓ |
| `frequency` | TEXT |  |  |  | ✓ |
| `physician` | TEXT |  |  |  | ✓ |
| `start_date` | DATE |  |  |  | ✓ |
| `end_date` | DATE |  |  |  | ✓ |
| `status` | TEXT |  | `'Active'` |  | ✓ |
| `purpose` | TEXT |  |  |  | ✓ |
| `notes` | TEXT |  |  |  | ✓ |
| `created_at` | DATETIME |  | `CURRENT_TIMESTAMP` |  | ✓ |
| `updated_at` | DATETIME |  | `CURRENT_TIMESTAMP` |  | ✓ |
| `needs_review` | INTEGER | ✓ | `0` |  | ✓ |
| `review_flagged_at` | DATETIME |  |  |  | ✓ |
| `review_reason` | TEXT |  |  |  | ✓ |
| `physician_contact_id` | INTEGER |  |  |  | ✓ |
| `review_category` | TEXT |  |  |  | ✗ |
| `family_member_id` | INTEGER |  |  |  | ✓ |
| `pharmacy_contact_id` | INTEGER |  |  |  | ✓ |
| `condition_id` | INTEGER |  |  |  | ✓ |
| `rx_number` | TEXT |  |  |  | ✓ |
| `refills_remaining` | INTEGER |  |  |  | ✓ |
| `next_refill_date` | TEXT |  |  |  | ✓ |
| `controlled_schedule` | TEXT |  |  |  | ✓ |
| `brand_name` | TEXT |  |  |  | ✓ |
| `generic_name` | TEXT |  |  |  | ✓ |
| `form` | TEXT |  |  |  | ✓ |
| `drug_class` | TEXT |  |  |  | ✓ |
| `take_with_food` | INTEGER |  | `0` |  | ✓ |
| `time_of_day` | TEXT |  |  |  | ✓ |
| `interaction_warning` | TEXT |  |  |  | ✓ |
| `schedule_days` | TEXT |  |  |  | ✓ |
| `schedule_times` | TEXT |  |  |  | ✓ |
| `schedule_specific` | TEXT |  |  |  | ✓ |
| `cycle_days_on` | INTEGER |  |  |  | ✓ |
| `cycle_days_off` | INTEGER |  |  |  | ✓ |
| `prn_max_per_day` | INTEGER |  |  |  | ✓ |
| `generic_of` | TEXT |  |  |  | ✓ |
| `qty_unit` | TEXT |  | `'ct'` |  | ✓ |
| `doses_per_day` | REAL |  |  |  | ✓ |
| `dedup_hash` | TEXT |  |  |  | ✓ |
| `dose_unit` | TEXT |  |  |  | ✓ |
| `route` | TEXT |  |  |  | ✓ |
| `ndc` | TEXT |  |  |  | ✓ |
| `mail_order` | INTEGER |  | `0` |  | ✓ |
| `quantity_total_prescribed` | INTEGER |  |  |  | ✓ |
| `rx_date` | DATE |  |  |  | ✓ |
| `source_system` | TEXT |  |  |  | ✓ |

  _(rows: 1)_

### `med_pending_review`  [in:both]

_Created in: `124_card_schema_expansion.js`_

| Column | Type | NN | Default | PK | In migrations |
|---|---|---|---|---|---|
| `id` | INTEGER |  |  | ✓ | ✓ |
| `source` | TEXT | ✓ |  |  | ✓ |
| `entity_type` | TEXT | ✓ |  |  | ✓ |
| `proposed_action` | TEXT | ✓ |  |  | ✓ |
| `payload` | TEXT | ✓ |  |  | ✓ |
| `existing_id` | INTEGER |  |  |  | ✓ |
| `dedup_hash` | TEXT |  |  |  | ✓ |
| `file_hash` | TEXT |  |  |  | ✓ |
| `reason` | TEXT |  |  |  | ✓ |
| `status` | TEXT |  | `'open'` |  | ✓ |
| `created_at` | DATETIME |  | `CURRENT_TIMESTAMP` |  | ✓ |
| `resolved_at` | DATETIME |  |  |  | ✓ |
| `resolution` | TEXT |  |  |  | ✓ |
| `todo_id` | INTEGER |  |  |  | ✓ |

  _(rows: 0)_

### `med_procedures`  [in:both]

_Created in: `145_med_procedures.js`_

| Column | Type | NN | Default | PK | In migrations |
|---|---|---|---|---|---|
| `id` | INTEGER |  |  | ✓ | ✓ |
| `family_member_id` | INTEGER | ✓ |  |  | ✓ |
| `procedure_name` | TEXT | ✓ |  |  | ✓ |
| `procedure_date` | DATE |  |  |  | ✓ |
| `provider_contact_id` | INTEGER |  |  |  | ✓ |
| `facility_text` | TEXT |  |  |  | ✓ |
| `procedure_type` | TEXT |  |  |  | ✓ |
| `status` | TEXT |  | `'planned'` |  | ✓ |
| `outcome_notes` | TEXT |  |  |  | ✓ |
| `related_condition_id` | INTEGER |  |  |  | ✓ |
| `created_at` | DATETIME |  | `CURRENT_TIMESTAMP` |  | ✓ |
| `updated_at` | DATETIME |  | `CURRENT_TIMESTAMP` |  | ✓ |

  _(rows: 0)_

### `med_visit_conditions`  [in:both]

_Created in: `125_med_visit_conditions.js`_

| Column | Type | NN | Default | PK | In migrations |
|---|---|---|---|---|---|
| `visit_id` | INTEGER | ✓ |  | ✓ | ✓ |
| `condition_id` | INTEGER | ✓ |  | ✓ | ✓ |

  _(rows: 0)_

### `med_visit_notes`  [in:both]

_Created in: `002_hsa_medical.sql`_

| Column | Type | NN | Default | PK | In migrations |
|---|---|---|---|---|---|
| `id` | INTEGER |  |  | ✓ | ✓ |
| `patient` | TEXT | ✓ | `'Self'` |  | ✓ |
| `physician_id` | INTEGER |  |  |  | ✓ |
| `contact_id` | INTEGER |  |  |  | ✓ |
| `visit_date` | DATE | ✓ |  |  | ✓ |
| `questions` | TEXT |  |  |  | ✓ |
| `doctors_response` | TEXT |  |  |  | ✓ |
| `follow_up_needed` | INTEGER |  | `0` |  | ✓ |
| `follow_up_date` | DATE |  |  |  | ✓ |
| `notes` | TEXT |  |  |  | ✓ |
| `created_at` | DATETIME |  | `CURRENT_TIMESTAMP` |  | ✓ |
| `updated_at` | DATETIME |  | `CURRENT_TIMESTAMP` |  | ✓ |
| `review_category` | TEXT |  |  |  | ✓ |
| `family_member_id` | INTEGER |  |  |  | ✓ |
| `round_trip_miles` | REAL |  |  |  | ✓ |
| `start_time` | TEXT |  |  |  | ✓ |
| `duration_min` | INTEGER |  |  |  | ✓ |
| `visit_location` | TEXT |  |  |  | ✓ |
| `visit_type` | TEXT |  |  |  | ✓ |
| `physician_contact_id` | INTEGER |  |  |  | ✓ |
| `bp_systolic` | INTEGER |  |  |  | ✓ |
| `bp_diastolic` | INTEGER |  |  |  | ✓ |
| `weight_lb` | REAL |  |  |  | ✓ |
| `temperature_f` | REAL |  |  |  | ✓ |
| `heart_rate_bpm` | INTEGER |  |  |  | ✓ |
| `visit_cost_oop` | REAL |  |  |  | ✓ |
| `reason` | TEXT |  |  |  | ✓ |
| `dedup_hash` | TEXT |  |  |  | ✓ |

  _(rows: 0)_

### `med_vitals_readings`  [in:both]

_Created in: `131_medical_expansion.js`_

| Column | Type | NN | Default | PK | In migrations |
|---|---|---|---|---|---|
| `id` | INTEGER |  |  | ✓ | ✓ |
| `family_member_id` | INTEGER |  |  |  | ✓ |
| `patient` | TEXT |  |  |  | ✓ |
| `measure_date` | DATE | ✓ |  |  | ✓ |
| `measure_time` | TIME |  |  |  | ✓ |
| `systolic_bp` | INTEGER |  |  |  | ✓ |
| `diastolic_bp` | INTEGER |  |  |  | ✓ |
| `heart_rate` | INTEGER |  |  |  | ✓ |
| `weight_lbs` | REAL |  |  |  | ✓ |
| `height_in` | REAL |  |  |  | ✓ |
| `bmi` | REAL |  |  |  | ✓ |
| `temperature_f` | REAL |  |  |  | ✓ |
| `o2_sat` | INTEGER |  |  |  | ✓ |
| `respiratory_rate` | INTEGER |  |  |  | ✓ |
| `blood_glucose` | REAL |  |  |  | ✓ |
| `source_system` | TEXT |  |  |  | ✓ |
| `source_visit_id` | INTEGER |  |  |  | ✓ |
| `notes` | TEXT |  |  |  | ✓ |
| `dedup_hash` | TEXT |  |  |  | ✓ |
| `created_at` | DATETIME |  | `CURRENT_TIMESTAMP` |  | ✓ |
| `updated_at` | DATETIME |  | `CURRENT_TIMESTAMP` |  | ✓ |

  _(rows: 0)_

### `medical_conditions`  [in:prod-only]

_Origin: not found in any migration (prod-only table)._

| Column | Type | NN | Default | PK |
|---|---|---|---|---|
| `id` | INTEGER |  |  | ✓ |
| `patient_id` | INTEGER |  |  |  |
| `condition_name` | TEXT | ✓ |  |  |
| `start_date` | DATE |  |  |  |
| `end_date` | DATE |  |  |  |
| `physician_id` | INTEGER |  |  |  |
| `treatment_notes` | TEXT |  |  |  |
| `status` | TEXT |  | `'Active'` |  |
| `notes` | TEXT |  |  |  |
| `created_at` | DATETIME |  | `CURRENT_TIMESTAMP` |  |
| `updated_at` | DATETIME |  | `CURRENT_TIMESTAMP` |  |

  _(rows: 0)_

### `medications`  [in:prod-only]

_Origin: not found in any migration (prod-only table)._

| Column | Type | NN | Default | PK |
|---|---|---|---|---|
| `id` | INTEGER |  |  | ✓ |
| `patient_id` | INTEGER |  |  |  |
| `name` | TEXT | ✓ |  |  |
| `dosage` | TEXT |  |  |  |
| `frequency` | TEXT |  |  |  |
| `physician_id` | INTEGER |  |  |  |
| `pharmacy_id` | INTEGER |  |  |  |
| `start_date` | DATE |  |  |  |
| `end_date` | DATE |  |  |  |
| `status` | TEXT |  | `'Active'` |  |
| `purpose` | TEXT |  |  |  |
| `rx_number` | TEXT |  |  |  |
| `refills_remaining` | INTEGER |  |  |  |
| `notes` | TEXT |  |  |  |
| `created_at` | DATETIME |  | `CURRENT_TIMESTAMP` |  |
| `updated_at` | DATETIME |  | `CURRENT_TIMESTAMP` |  |

  _(rows: 0)_

### `memory_members`  [in:both]

_Created in: `112_memories.sql`_

| Column | Type | NN | Default | PK | In migrations |
|---|---|---|---|---|---|
| `id` | INTEGER |  |  | ✓ | ✓ |
| `log_id` | INTEGER | ✓ |  |  | ✓ |
| `family_member_id` | INTEGER | ✓ |  |  | ✓ |
| `created_at` | TEXT |  | `CURRENT_TIMESTAMP` |  | ✓ |

  _(rows: 2)_

### `net_worth_snapshots`  [in:both]

_Created in: `020_finance_accounts.sql`_

| Column | Type | NN | Default | PK | In migrations |
|---|---|---|---|---|---|
| `id` | INTEGER |  |  | ✓ | ✓ |
| `snapshot_year` | INTEGER |  |  |  | ✗ |
| `snapshot_date` | DATE |  |  |  | ✓ |
| `asset_checking` | REAL |  | `0` |  | ✗ |
| `asset_savings` | REAL |  | `0` |  | ✗ |
| `asset_brokerage` | REAL |  | `0` |  | ✗ |
| `asset_roth_a` | REAL |  | `0` |  | ✗ |
| `asset_roth_z` | REAL |  | `0` |  | ✗ |
| `asset_trad_ira` | REAL |  | `0` |  | ✗ |
| `asset_tsp` | REAL |  | `0` |  | ✗ |
| `asset_ibonds` | REAL |  | `0` |  | ✗ |
| `asset_hsa` | REAL |  | `0` |  | ✗ |
| `asset_home_value` | REAL |  | `0` |  | ✗ |
| `asset_car_value` | REAL |  | `0` |  | ✗ |
| `asset_other` | REAL |  | `0` |  | ✗ |
| `liability_mortgage` | REAL |  | `0` |  | ✗ |
| `liability_auto` | REAL |  | `0` |  | ✗ |
| `liability_cc` | REAL |  | `0` |  | ✗ |
| `liability_other` | REAL |  | `0` |  | ✗ |
| `notes` | TEXT |  |  |  | ✓ |
| `created_at` | DATETIME |  | `CURRENT_TIMESTAMP` |  | ✓ |
| `total_assets` | REAL |  |  |  | ✓ |
| `total_liabilities` | REAL |  |  |  | ✓ |
| `net_worth` | REAL |  |  |  | ✓ |

  _(rows: 17)_

### `notifications`  [in:both]

_Created in: `011_notifications.sql`_

| Column | Type | NN | Default | PK | In migrations |
|---|---|---|---|---|---|
| `id` | INTEGER |  |  | ✓ | ✓ |
| `type` | TEXT | ✓ |  |  | ✓ |
| `severity` | TEXT | ✓ | `'info'` |  | ✓ |
| `title` | TEXT | ✓ |  |  | ✓ |
| `body` | TEXT |  |  |  | ✓ |
| `module` | TEXT |  |  |  | ✓ |
| `entity_type` | TEXT |  |  |  | ✓ |
| `entity_id` | TEXT |  |  |  | ✓ |
| `is_read` | INTEGER | ✓ | `0` |  | ✓ |
| `created_at` | TEXT | ✓ | `datetime('now')` |  | ✓ |
| `expires_at` | TEXT |  |  |  | ✓ |

  _(rows: 3)_

### `pending_dismissals`  [in:both]

_Created in: `139_pending_items_subsystem.js`_

| Column | Type | NN | Default | PK | In migrations |
|---|---|---|---|---|---|
| `id` | INTEGER |  |  | ✓ | ✓ |
| `transaction_id` | INTEGER | ✓ |  |  | ✓ |
| `reason` | TEXT | ✓ |  |  | ✓ |
| `hint` | TEXT |  |  |  | ✓ |
| `snooze_until` | DATE |  |  |  | ✓ |
| `dismissed_at` | DATETIME |  | `CURRENT_TIMESTAMP` |  | ✓ |

  _(rows: 0)_

### `perfume_layer_items`  [in:both]

_Created in: `108_perfume.sql`_

| Column | Type | NN | Default | PK | In migrations |
|---|---|---|---|---|---|
| `id` | INTEGER |  |  | ✓ | ✓ |
| `layer_id` | INTEGER | ✓ |  |  | ✓ |
| `perfume_id` | INTEGER | ✓ |  |  | ✓ |
| `application_order` | INTEGER |  | `1` |  | ✓ |
| `amount_note` | TEXT |  |  |  | ✓ |

  _(rows: 0)_

### `perfume_layers`  [in:both]

_Created in: `108_perfume.sql`_

| Column | Type | NN | Default | PK | In migrations |
|---|---|---|---|---|---|
| `id` | INTEGER |  |  | ✓ | ✓ |
| `name` | TEXT | ✓ |  |  | ✓ |
| `owner_family_member_id` | INTEGER |  |  |  | ✓ |
| `season_tags` | TEXT |  |  |  | ✓ |
| `occasion_tags` | TEXT |  |  |  | ✓ |
| `notes` | TEXT |  |  |  | ✓ |
| `created_at` | TEXT |  | `CURRENT_TIMESTAMP` |  | ✓ |

  _(rows: 0)_

### `perfume_outfit_pairs`  [in:both]

_Created in: `108_perfume.sql`_

| Column | Type | NN | Default | PK | In migrations |
|---|---|---|---|---|---|
| `id` | INTEGER |  |  | ✓ | ✓ |
| `outfit_id` | INTEGER |  |  |  | ✓ |
| `perfume_id` | INTEGER |  |  |  | ✓ |
| `layer_id` | INTEGER |  |  |  | ✓ |
| `notes` | TEXT |  |  |  | ✓ |

  _(rows: 0)_

### `perfumes`  [in:both]

_Created in: `108_perfume.sql`_

| Column | Type | NN | Default | PK | In migrations |
|---|---|---|---|---|---|
| `id` | INTEGER |  |  | ✓ | ✓ |
| `name` | TEXT | ✓ |  |  | ✓ |
| `brand` | TEXT |  |  |  | ✓ |
| `concentration` | TEXT |  |  |  | ✓ |
| `top_notes` | TEXT |  |  |  | ✓ |
| `middle_notes` | TEXT |  |  |  | ✓ |
| `base_notes` | TEXT |  |  |  | ✓ |
| `scent_family` | TEXT |  |  |  | ✓ |
| `season_tags` | TEXT |  |  |  | ✓ |
| `occasion_tags` | TEXT |  |  |  | ✓ |
| `gender` | TEXT |  |  |  | ✓ |
| `size_ml` | REAL |  |  |  | ✓ |
| `amount_level` | TEXT |  | `'Full'` |  | ✓ |
| `purchase_price` | REAL |  |  |  | ✓ |
| `purchase_date` | TEXT |  |  |  | ✓ |
| `purchased_from` | TEXT |  |  |  | ✓ |
| `owner_family_member_id` | INTEGER |  |  |  | ✓ |
| `rating` | INTEGER |  |  |  | ✓ |
| `notes` | TEXT |  |  |  | ✓ |
| `status` | TEXT |  | `'active'` |  | ✓ |
| `barcode` | TEXT |  |  |  | ✓ |
| `fragella_id` | TEXT |  |  |  | ✓ |
| `fragella_data` | TEXT |  |  |  | ✓ |
| `fragella_cached_at` | TEXT |  |  |  | ✓ |
| `created_at` | TEXT |  | `CURRENT_TIMESTAMP` |  | ✓ |
| `updated_at` | TEXT |  | `CURRENT_TIMESTAMP` |  | ✓ |

  _(rows: 0)_

### `portfolio_snapshots`  [in:both]

_Created in: `099_recurring_investment.sql`_

| Column | Type | NN | Default | PK | In migrations |
|---|---|---|---|---|---|
| `id` | INTEGER |  |  | ✓ | ✓ |
| `snapshot_date` | DATE | ✓ |  |  | ✓ |
| `total_value` | REAL | ✓ |  |  | ✓ |
| `total_cost` | REAL | ✓ |  |  | ✓ |
| `total_gain` | REAL | ✓ |  |  | ✓ |
| `total_gain_pct` | REAL | ✓ |  |  | ✓ |
| `created_at` | DATETIME |  | `CURRENT_TIMESTAMP` |  | ✓ |

  _(rows: 0)_

### `properties`  [in:both]

_Created in: `024_property_vehicles.sql`_

| Column | Type | NN | Default | PK | In migrations |
|---|---|---|---|---|---|
| `id` | INTEGER |  |  | ✓ | ✓ |
| `nickname` | TEXT | ✓ |  |  | ✓ |
| `property_type` | TEXT | ✓ | `'Primary Residence'` |  | ✓ |
| `address_street` | TEXT |  |  |  | ✓ |
| `address_city` | TEXT |  |  |  | ✓ |
| `address_state` | TEXT |  |  |  | ✓ |
| `address_zip` | TEXT |  |  |  | ✓ |
| `purchase_date` | DATE |  |  |  | ✓ |
| `purchase_price` | REAL |  |  |  | ✓ |
| `current_est_value` | REAL |  |  |  | ✓ |
| `mortgage_balance` | REAL |  |  |  | ✓ |
| `mortgage_lender` | TEXT |  |  |  | ✓ |
| `mortgage_rate` | REAL |  |  |  | ✓ |
| `mortgage_monthly` | REAL |  |  |  | ✓ |
| `mortgage_end_date` | DATE |  |  |  | ✓ |
| `hoa_monthly` | REAL |  |  |  | ✓ |
| `property_tax_annual` | REAL |  |  |  | ✓ |
| `insurance_annual` | REAL |  |  |  | ✓ |
| `insurance_company` | TEXT |  |  |  | ✓ |
| `insurance_policy` | TEXT |  |  |  | ✓ |
| `notes` | TEXT |  |  |  | ✓ |
| `is_active` | INTEGER | ✓ | `1` |  | ✓ |
| `created_at` | DATETIME |  | `CURRENT_TIMESTAMP` |  | ✓ |
| `updated_at` | DATETIME |  | `CURRENT_TIMESTAMP` |  | ✓ |
| `needs_review` | INTEGER | ✓ | `0` |  | ✓ |
| `review_flagged_at` | DATETIME |  |  |  | ✓ |
| `review_reason` | TEXT |  |  |  | ✓ |
| `mortgage_lender_contact_id` | INTEGER |  |  |  | ✓ |
| `insurance_contact_id` | INTEGER |  |  |  | ✓ |
| `review_category` | TEXT |  |  |  | ✗ |
| `family_member_id` | INTEGER |  |  |  | ✓ |

  _(rows: 0)_

### `property_maintenance`  [in:both]

_Created in: `035_property_maintenance.sql`_

| Column | Type | NN | Default | PK | In migrations |
|---|---|---|---|---|---|
| `id` | INTEGER |  |  | ✓ | ✓ |
| `property_id` | INTEGER | ✓ |  |  | ✓ |
| `maint_date` | DATE | ✓ |  |  | ✓ |
| `category` | TEXT | ✓ |  |  | ✓ |
| `description` | TEXT | ✓ |  |  | ✓ |
| `cost` | REAL |  |  |  | ✓ |
| `vendor` | TEXT |  |  |  | ✓ |
| `warranty_expiry` | DATE |  |  |  | ✓ |
| `next_due_date` | DATE |  |  |  | ✓ |
| `notes` | TEXT |  |  |  | ✓ |
| `created_at` | DATETIME |  | `CURRENT_TIMESTAMP` |  | ✓ |
| `vendor_contact_id` | INTEGER |  |  |  | ✓ |
| `is_completed` | INTEGER | ✓ | `0` |  | ✓ |
| `completed_date` | DATE |  |  |  | ✓ |

  _(rows: 0)_

### `qnap_share_paths`  [in:prod-only]

_Origin: not found in any migration (prod-only table)._

| Column | Type | NN | Default | PK |
|---|---|---|---|---|
| `id` | INTEGER |  |  | ✓ |
| `label` | TEXT | ✓ |  |  |
| `absolute_path` | TEXT | ✓ |  |  |
| `enabled` | INTEGER |  | `1` |  |
| `last_indexed` | DATETIME |  |  |  |
| `created_at` | DATETIME |  | `CURRENT_TIMESTAMP` |  |

  _(rows: 0)_

### `record_family_members`  [in:both]

_Created in: `042_record_family_members.sql`_

| Column | Type | NN | Default | PK | In migrations |
|---|---|---|---|---|---|
| `id` | INTEGER |  |  | ✓ | ✓ |
| `entity_type` | TEXT | ✓ |  |  | ✓ |
| `entity_id` | INTEGER | ✓ |  |  | ✓ |
| `family_member_id` | INTEGER | ✓ |  |  | ✓ |
| `created_at` | DATETIME |  | `CURRENT_TIMESTAMP` |  | ✓ |

  _(rows: 2)_

### `record_links`  [in:both]

_Created in: `126_capture_and_finance_schema.js`_

| Column | Type | NN | Default | PK | In migrations |
|---|---|---|---|---|---|
| `id` | INTEGER |  |  | ✓ | ✓ |
| `left_type` | TEXT | ✓ |  |  | ✓ |
| `left_id` | INTEGER | ✓ |  |  | ✓ |
| `right_type` | TEXT | ✓ |  |  | ✓ |
| `right_id` | INTEGER | ✓ |  |  | ✓ |
| `link_kind` | TEXT | ✓ | `'manual'` |  | ✓ |
| `notes` | TEXT |  |  |  | ✓ |
| `created_at` | DATETIME |  | `CURRENT_TIMESTAMP` |  | ✓ |
| `confidence` | TEXT | ✓ | `'high'` |  | ✓ |
| `needs_review` | INTEGER | ✓ | `0` |  | ✓ |
| `source` | TEXT |  |  |  | ✓ |
| `reviewed_at` | DATETIME |  |  |  | ✓ |

  _(rows: 0)_

### `recurring_transactions`  [in:both]

_Created in: `099_recurring_investment.sql`_

| Column | Type | NN | Default | PK | In migrations |
|---|---|---|---|---|---|
| `id` | INTEGER |  |  | ✓ | ✓ |
| `account_id` | INTEGER | ✓ |  |  | ✓ |
| `description` | TEXT | ✓ |  |  | ✓ |
| `amount` | REAL | ✓ |  |  | ✓ |
| `category` | TEXT |  |  |  | ✓ |
| `frequency` | TEXT | ✓ |  |  | ✓ |
| `start_date` | DATE | ✓ |  |  | ✓ |
| `end_date` | DATE |  |  |  | ✓ |
| `next_date` | DATE | ✓ |  |  | ✓ |
| `last_generated` | DATE |  |  |  | ✓ |
| `notes` | TEXT |  |  |  | ✓ |
| `is_active` | INTEGER | ✓ | `1` |  | ✓ |
| `created_at` | DATETIME |  | `CURRENT_TIMESTAMP` |  | ✓ |
| `updated_at` | DATETIME |  | `CURRENT_TIMESTAMP` |  | ✓ |

  _(rows: 0)_

### `resources`  [in:both]

_Created in: `007_resources.sql`_

| Column | Type | NN | Default | PK | In migrations |
|---|---|---|---|---|---|
| `id` | INTEGER |  |  | ✓ | ✓ |
| `name` | TEXT | ✓ |  |  | ✓ |
| `description` | TEXT |  |  |  | ✓ |
| `url` | TEXT |  |  |  | ✓ |
| `link_type` | TEXT |  | `'website'` |  | ✓ |
| `category` | TEXT |  |  |  | ✓ |
| `access_note` | TEXT |  |  |  | ✓ |
| `is_favorite` | INTEGER |  | `0` |  | ✓ |
| `sort_order` | INTEGER |  | `0` |  | ✓ |
| `created_at` | DATETIME |  | `CURRENT_TIMESTAMP` |  | ✓ |
| `updated_at` | DATETIME |  | `CURRENT_TIMESTAMP` |  | ✓ |
| `needs_review` | INTEGER | ✓ | `0` |  | ✓ |
| `review_flagged_at` | DATETIME |  |  |  | ✓ |
| `review_reason` | TEXT |  |  |  | ✓ |
| `review_category` | TEXT |  |  |  | ✗ |

  _(rows: 56)_

### `retirement_contributions`  [in:prod-only]

_Origin: not found in any migration (prod-only table)._

| Column | Type | NN | Default | PK |
|---|---|---|---|---|
| `id` | INTEGER |  |  | ✓ |
| `year` | INTEGER |  |  |  |
| `account_type` | TEXT |  |  |  |
| `owner_id` | INTEGER |  |  |  |
| `contribution` | REAL |  |  |  |
| `irs_limit` | REAL |  |  |  |
| `year_end_balance` | REAL |  |  |  |
| `employer_match` | REAL |  | `0` |  |
| `notes` | TEXT |  |  |  |
| `created_at` | DATETIME |  | `CURRENT_TIMESTAMP` |  |
| `updated_at` | DATETIME |  | `CURRENT_TIMESTAMP` |  |

  _(rows: 0)_

### `stock_price_history`  [in:prod-only]

_Origin: not found in any migration (prod-only table)._

| Column | Type | NN | Default | PK |
|---|---|---|---|---|
| `id` | INTEGER |  |  | ✓ |
| `symbol` | TEXT | ✓ |  |  |
| `price` | REAL | ✓ |  |  |
| `price_date` | DATE | ✓ |  |  |
| `source` | TEXT |  | `'yahoo_finance'` |  |
| `fetched_at` | DATETIME |  | `CURRENT_TIMESTAMP` |  |

  _(rows: 0)_

### `stock_transactions`  [in:prod-only]

_Origin: not found in any migration (prod-only table)._

| Column | Type | NN | Default | PK |
|---|---|---|---|---|
| `id` | INTEGER |  |  | ✓ |
| `transaction_type` | TEXT | ✓ |  |  |
| `symbol` | TEXT | ✓ |  |  |
| `company_name` | TEXT |  |  |  |
| `account_type` | TEXT |  |  |  |
| `brokerage_id` | INTEGER |  |  |  |
| `transaction_date` | DATE |  |  |  |
| `shares` | REAL |  |  |  |
| `price_per_share` | REAL |  |  |  |
| `fees` | REAL |  | `0` |  |
| `total_amount` | REAL |  |  |  |
| `tax_lot_id` | INTEGER |  |  |  |
| `notes` | TEXT |  |  |  |
| `created_at` | DATETIME |  | `CURRENT_TIMESTAMP` |  |
| `updated_at` | DATETIME |  | `CURRENT_TIMESTAMP` |  |

  _(rows: 0)_

### `subscription_members`  [in:both]

_Created in: `109b_subscriptions_repair.js`_

| Column | Type | NN | Default | PK | In migrations |
|---|---|---|---|---|---|
| `id` | INTEGER |  |  | ✓ | ✓ |
| `subscription_id` | INTEGER | ✓ |  |  | ✓ |
| `family_member_id` | INTEGER | ✓ |  |  | ✓ |

  _(rows: 0)_

### `subscriptions`  [in:both]

_Created in: `109b_subscriptions_repair.js`_

| Column | Type | NN | Default | PK | In migrations |
|---|---|---|---|---|---|
| `id` | INTEGER |  |  | ✓ | ✓ |
| `service_name` | TEXT | ✓ |  |  | ✓ |
| `category` | TEXT |  |  |  | ✓ |
| `monthly_cost` | REAL |  |  |  | ✓ |
| `annual_cost` | REAL |  |  |  | ✓ |
| `billing_cycle` | TEXT |  |  |  | ✓ |
| `card_id` | INTEGER |  |  |  | ✓ |
| `billing_day` | INTEGER |  |  |  | ✓ |
| `auto_renews` | INTEGER |  | `1` |  | ✓ |
| `status` | TEXT |  | `'Active'` |  | ✓ |
| `cancel_url` | TEXT |  |  |  | ✓ |
| `vendor_id` | INTEGER |  |  |  | ✓ |
| `last_reviewed` | DATE |  |  |  | ✓ |
| `notes` | TEXT |  |  |  | ✓ |
| `created_at` | DATETIME |  | `CURRENT_TIMESTAMP` |  | ✓ |
| `updated_at` | DATETIME |  | `CURRENT_TIMESTAMP` |  | ✓ |
| `name` | TEXT |  |  |  | ✓ |
| `cost` | REAL |  |  |  | ✓ |
| `next_billing_date` | TEXT |  |  |  | ✓ |
| `auto_renew` | INTEGER |  | `1` |  | ✓ |
| `finance_account_id` | INTEGER |  |  |  | ✓ |
| `provider_contact_id` | INTEGER |  |  |  | ✓ |

  _(rows: 0)_

### `taggables`  [in:both]

_Created in: `001_initial.sql`_

| Column | Type | NN | Default | PK | In migrations |
|---|---|---|---|---|---|
| `tag_id` | INTEGER | ✓ |  | ✓ | ✓ |
| `entity_type` | TEXT | ✓ |  | ✓ | ✓ |
| `entity_id` | INTEGER | ✓ |  | ✓ | ✓ |

  _(rows: 3)_

### `tags`  [in:both]

_Created in: `001_initial.sql`_

| Column | Type | NN | Default | PK | In migrations |
|---|---|---|---|---|---|
| `id` | INTEGER |  |  | ✓ | ✓ |
| `name` | TEXT | ✓ |  |  | ✓ |
| `color_hex` | TEXT |  | `'2E75B6'` |  | ✓ |
| `icon` | TEXT |  |  |  | ✓ |
| `created_at` | DATETIME |  | `CURRENT_TIMESTAMP` |  | ✓ |

  _(rows: 59)_

### `task_template_items`  [in:both]

_Created in: `102_repair_schema.js`_

| Column | Type | NN | Default | PK | In migrations |
|---|---|---|---|---|---|
| `id` | INTEGER |  |  | ✓ | ✓ |
| `template_id` | INTEGER | ✓ |  |  | ✓ |
| `title` | TEXT | ✓ |  |  | ✓ |
| `notes` | TEXT |  |  |  | ✓ |
| `priority` | TEXT |  | `'medium'` |  | ✓ |
| `due_days_offset` | INTEGER |  | `0` |  | ✓ |
| `sort_order` | INTEGER |  | `0` |  | ✓ |

  _(rows: 17)_

### `task_templates`  [in:both]

_Created in: `102_repair_schema.js`_

| Column | Type | NN | Default | PK | In migrations |
|---|---|---|---|---|---|
| `id` | INTEGER |  |  | ✓ | ✓ |
| `name` | TEXT | ✓ |  |  | ✓ |
| `description` | TEXT |  |  |  | ✓ |
| `category` | TEXT |  |  |  | ✓ |
| `is_active` | INTEGER | ✓ | `1` |  | ✓ |
| `created_at` | DATETIME |  | `CURRENT_TIMESTAMP` |  | ✓ |
| `updated_at` | DATETIME |  | `CURRENT_TIMESTAMP` |  | ✓ |

  _(rows: 5)_

### `tax_documents`  [in:prod-only]

_Origin: not found in any migration (prod-only table)._

| Column | Type | NN | Default | PK |
|---|---|---|---|---|
| `id` | INTEGER |  |  | ✓ |
| `tax_year` | INTEGER |  |  |  |
| `form_type` | TEXT |  |  |  |
| `issuer` | TEXT |  |  |  |
| `expected_by_date` | DATE |  |  |  |
| `received` | INTEGER |  | `0` |  |
| `date_received` | DATE |  |  |  |
| `filed` | INTEGER |  | `0` |  |
| `amount_if_known` | REAL |  |  |  |
| `notes` | TEXT |  |  |  |
| `created_at` | DATETIME |  | `CURRENT_TIMESTAMP` |  |
| `updated_at` | DATETIME |  | `CURRENT_TIMESTAMP` |  |

  _(rows: 0)_

### `today_snoozes`  [in:both]

_Created in: `116_today_snoozes.sql`_

| Column | Type | NN | Default | PK | In migrations |
|---|---|---|---|---|---|
| `id` | INTEGER |  |  | ✓ | ✓ |
| `record_kind` | TEXT | ✓ |  |  | ✓ |
| `record_id` | INTEGER | ✓ |  |  | ✓ |
| `snoozed_until` | TEXT | ✓ |  |  | ✓ |
| `created_at` | DATETIME |  | `CURRENT_TIMESTAMP` |  | ✓ |

  _(rows: 0)_

### `todos`  [in:both]

_Created in: `014_todos.sql`_

| Column | Type | NN | Default | PK | In migrations |
|---|---|---|---|---|---|
| `id` | INTEGER |  |  | ✓ | ✓ |
| `title` | TEXT | ✓ |  |  | ✓ |
| `notes` | TEXT |  |  |  | ✓ |
| `due_date` | DATE |  |  |  | ✓ |
| `priority` | TEXT | ✓ | `'medium'` |  | ✓ |
| `category` | TEXT | ✓ | `'General'` |  | ✓ |
| `status` | TEXT | ✓ | `'open'` |  | ✓ |
| `completed_at` | DATETIME |  |  |  | ✓ |
| `is_auto` | INTEGER | ✓ | `0` |  | ✓ |
| `auto_type` | TEXT |  |  |  | ✓ |
| `auto_source_type` | TEXT |  |  |  | ✓ |
| `auto_source_id` | INTEGER |  |  |  | ✓ |
| `reminder_date` | DATE |  |  |  | ✓ |
| `reminder_sent` | INTEGER |  | `0` |  | ✓ |
| `recurrence` | TEXT |  |  |  | ✓ |
| `recurrence_days` | INTEGER |  |  |  | ✓ |
| `needs_review` | INTEGER | ✓ | `0` |  | ✓ |
| `review_flagged_at` | DATETIME |  |  |  | ✓ |
| `review_reason` | TEXT |  |  |  | ✓ |
| `review_category` | TEXT |  |  |  | ✓ |
| `created_at` | DATETIME |  | `CURRENT_TIMESTAMP` |  | ✓ |
| `updated_at` | DATETIME |  | `CURRENT_TIMESTAMP` |  | ✓ |
| `google_task_id` | TEXT |  |  |  | ✓ |
| `google_tasklist_id` | TEXT |  |  |  | ✓ |

  _(rows: 11)_

### `transactions`  [in:both]

_Created in: `126_finance_unify.js`_

| Column | Type | NN | Default | PK | In migrations |
|---|---|---|---|---|---|
| `id` | INTEGER |  |  | ✓ | ✓ |
| `account_id` | INTEGER | ✓ |  |  | ✓ |
| `date` | DATE | ✓ |  |  | ✓ |
| `post_date` | DATE |  |  |  | ✓ |
| `description` | TEXT | ✓ |  |  | ✓ |
| `amount` | REAL | ✓ |  |  | ✓ |
| `balance` | REAL |  |  |  | ✓ |
| `category` | TEXT |  |  |  | ✓ |
| `notes` | TEXT |  |  |  | ✓ |
| `memo` | TEXT |  |  |  | ✓ |
| `is_reconciled` | INTEGER | ✓ | `0` |  | ✓ |
| `is_transfer` | INTEGER | ✓ | `0` |  | ✓ |
| `source` | TEXT | ✓ | `'manual'` |  | ✓ |
| `needs_review` | INTEGER | ✓ | `0` |  | ✓ |
| `fingerprint` | TEXT |  |  |  | ✓ |
| `flagged` | INTEGER | ✓ | `0` |  | ✓ |
| `batch_id` | INTEGER |  |  |  | ✓ |
| `txn_type` | TEXT |  |  |  | ✓ |
| `created_at` | DATETIME |  | `CURRENT_TIMESTAMP` |  | ✓ |

  _(rows: 76)_

### `tsp_allocation`  [in:prod-only]

_Origin: not found in any migration (prod-only table)._

| Column | Type | NN | Default | PK |
|---|---|---|---|---|
| `id` | INTEGER |  |  | ✓ |
| `allocation_year` | INTEGER |  |  |  |
| `fund_code` | TEXT |  |  |  |
| `fund_name` | TEXT |  |  |  |
| `index_tracked` | TEXT |  |  |  |
| `pct_traditional` | REAL |  | `0` |  |
| `pct_roth` | REAL |  | `0` |  |
| `target_pct` | REAL |  | `0` |  |
| `notes` | TEXT |  |  |  |
| `updated_at` | DATETIME |  | `CURRENT_TIMESTAMP` |  |

  _(rows: 0)_

### `tx_link_rules`  [in:both]

_Created in: `139_pending_items_subsystem.js`_

| Column | Type | NN | Default | PK | In migrations |
|---|---|---|---|---|---|
| `id` | INTEGER |  |  | ✓ | ✓ |
| `merchant_pattern` | TEXT | ✓ |  |  | ✓ |
| `category` | TEXT |  |  |  | ✓ |
| `right_type` | TEXT | ✓ |  |  | ✓ |
| `right_id` | INTEGER | ✓ |  |  | ✓ |
| `auto_apply` | INTEGER | ✓ | `1` |  | ✓ |
| `is_active` | INTEGER | ✓ | `1` |  | ✓ |
| `match_count` | INTEGER | ✓ | `0` |  | ✓ |
| `last_matched_at` | DATETIME |  |  |  | ✓ |
| `created_at` | DATETIME |  | `CURRENT_TIMESTAMP` |  | ✓ |

  _(rows: 0)_

### `user_preferences`  [in:both]

_Created in: `147_user_preferences.sql`_

| Column | Type | NN | Default | PK | In migrations |
|---|---|---|---|---|---|
| `id` | INTEGER |  |  | ✓ | ✓ |
| `user_key` | TEXT | ✓ | `'default'` |  | ✓ |
| `pinned_reports` | TEXT | ✓ | `'[]'` |  | ✓ |
| `updated_at` | DATETIME |  | `CURRENT_TIMESTAMP` |  | ✓ |

  _(rows: 1)_

### `vehicle_service`  [in:both]

_Created in: `024_property_vehicles.sql`_

| Column | Type | NN | Default | PK | In migrations |
|---|---|---|---|---|---|
| `id` | INTEGER |  |  | ✓ | ✓ |
| `vehicle_id` | INTEGER | ✓ |  |  | ✓ |
| `service_date` | DATE | ✓ |  |  | ✓ |
| `service_type` | TEXT | ✓ |  |  | ✓ |
| `mileage` | INTEGER |  |  |  | ✓ |
| `cost` | REAL |  |  |  | ✓ |
| `shop` | TEXT |  |  |  | ✓ |
| `notes` | TEXT |  |  |  | ✓ |
| `next_due_date` | DATE |  |  |  | ✓ |
| `next_due_miles` | INTEGER |  |  |  | ✓ |
| `created_at` | DATETIME |  | `CURRENT_TIMESTAMP` |  | ✓ |
| `contact_id` | INTEGER |  |  |  | ✓ |

  _(rows: 0)_

### `vehicles`  [in:both]

_Created in: `024_property_vehicles.sql`_

| Column | Type | NN | Default | PK | In migrations |
|---|---|---|---|---|---|
| `id` | INTEGER |  |  | ✓ | ✓ |
| `nickname` | TEXT | ✓ |  |  | ✓ |
| `year` | INTEGER |  |  |  | ✓ |
| `make` | TEXT |  |  |  | ✓ |
| `model` | TEXT |  |  |  | ✓ |
| `trim` | TEXT |  |  |  | ✓ |
| `color` | TEXT |  |  |  | ✓ |
| `vin` | TEXT |  |  |  | ✓ |
| `license_plate` | TEXT |  |  |  | ✓ |
| `state` | TEXT |  |  |  | ✓ |
| `purchase_date` | DATE |  |  |  | ✓ |
| `purchase_price` | REAL |  |  |  | ✓ |
| `current_est_value` | REAL |  |  |  | ✓ |
| `odometer` | INTEGER |  |  |  | ✓ |
| `odometer_date` | DATE |  |  |  | ✓ |
| `loan_balance` | REAL |  |  |  | ✓ |
| `loan_lender` | TEXT |  |  |  | ✓ |
| `loan_rate` | REAL |  |  |  | ✓ |
| `loan_monthly` | REAL |  |  |  | ✓ |
| `loan_end_date` | DATE |  |  |  | ✓ |
| `insurance_company` | TEXT |  |  |  | ✓ |
| `insurance_policy` | TEXT |  |  |  | ✓ |
| `insurance_annual` | REAL |  |  |  | ✓ |
| `registration_expires` | DATE |  |  |  | ✓ |
| `inspection_expires` | DATE |  |  |  | ✓ |
| `notes` | TEXT |  |  |  | ✓ |
| `is_active` | INTEGER | ✓ | `1` |  | ✓ |
| `created_at` | DATETIME |  | `CURRENT_TIMESTAMP` |  | ✓ |
| `updated_at` | DATETIME |  | `CURRENT_TIMESTAMP` |  | ✓ |
| `needs_review` | INTEGER | ✓ | `0` |  | ✓ |
| `review_flagged_at` | DATETIME |  |  |  | ✓ |
| `review_reason` | TEXT |  |  |  | ✓ |
| `lender_contact_id` | INTEGER |  |  |  | ✓ |
| `insurance_contact_id` | INTEGER |  |  |  | ✗ |
| `review_category` | TEXT |  |  |  | ✗ |
| `family_member_id` | INTEGER |  |  |  | ✓ |

  _(rows: 12)_

### `wardrobe_outfit_items`  [in:both]

_Created in: `107_wardrobe.sql`_

| Column | Type | NN | Default | PK | In migrations |
|---|---|---|---|---|---|
| `id` | INTEGER |  |  | ✓ | ✓ |
| `outfit_id` | INTEGER | ✓ |  |  | ✓ |
| `item_id` | INTEGER | ✓ |  |  | ✓ |
| `sort_order` | INTEGER |  | `0` |  | ✓ |

  _(rows: 1)_

### `wardrobe_outfits`  [in:both]

_Created in: `107_wardrobe.sql`_

| Column | Type | NN | Default | PK | In migrations |
|---|---|---|---|---|---|
| `id` | INTEGER |  |  | ✓ | ✓ |
| `name` | TEXT | ✓ |  |  | ✓ |
| `family_member_id` | INTEGER |  |  |  | ✓ |
| `occasion_tags` | TEXT |  |  |  | ✓ |
| `season_tags` | TEXT |  |  |  | ✓ |
| `notes` | TEXT |  |  |  | ✓ |
| `created_at` | TEXT |  | `CURRENT_TIMESTAMP` |  | ✓ |
| `updated_at` | TEXT |  | `CURRENT_TIMESTAMP` |  | ✓ |

  _(rows: 1)_

### `wardrobe_planner`  [in:both]

_Created in: `107_wardrobe.sql`_

| Column | Type | NN | Default | PK | In migrations |
|---|---|---|---|---|---|
| `id` | INTEGER |  |  | ✓ | ✓ |
| `plan_date` | TEXT | ✓ |  |  | ✓ |
| `outfit_id` | INTEGER |  |  |  | ✓ |
| `family_member_id` | INTEGER |  |  |  | ✓ |
| `occasion` | TEXT |  |  |  | ✓ |
| `notes` | TEXT |  |  |  | ✓ |
| `created_at` | TEXT |  | `CURRENT_TIMESTAMP` |  | ✓ |

  _(rows: 2)_

### `wardrobe_wear_log`  [in:both]

_Created in: `107_wardrobe.sql`_

| Column | Type | NN | Default | PK | In migrations |
|---|---|---|---|---|---|
| `id` | INTEGER |  |  | ✓ | ✓ |
| `item_id` | INTEGER | ✓ |  |  | ✓ |
| `outfit_id` | INTEGER |  |  |  | ✓ |
| `worn_date` | TEXT | ✓ |  |  | ✓ |
| `family_member_id` | INTEGER |  |  |  | ✓ |
| `notes` | TEXT |  |  |  | ✓ |
| `created_at` | TEXT |  | `CURRENT_TIMESTAMP` |  | ✓ |

  _(rows: 0)_

### `warranty_claims`  [in:both]

_Created in: `111_warranty_expansion.sql`_

| Column | Type | NN | Default | PK | In migrations |
|---|---|---|---|---|---|
| `id` | INTEGER |  |  | ✓ | ✓ |
| `item_id` | INTEGER | ✓ |  |  | ✓ |
| `claim_date` | TEXT | ✓ |  |  | ✓ |
| `description` | TEXT |  |  |  | ✓ |
| `resolution` | TEXT |  |  |  | ✓ |
| `resolved_date` | TEXT |  |  |  | ✓ |
| `contact_id` | INTEGER |  |  |  | ✓ |
| `notes` | TEXT |  |  |  | ✓ |
| `created_at` | TEXT |  | `CURRENT_TIMESTAMP` |  | ✓ |

  _(rows: 0)_

### `watcher_file_registry`  [in:both]

_Created in: `096_watcher_tables.sql`_

| Column | Type | NN | Default | PK | In migrations |
|---|---|---|---|---|---|
| `id` | INTEGER |  |  | ✓ | ✓ |
| `file_path` | TEXT | ✓ |  |  | ✓ |
| `file_hash` | TEXT | ✓ |  |  | ✓ |
| `file_size` | INTEGER |  |  |  | ✓ |
| `file_modified` | DATETIME |  |  |  | ✓ |
| `last_scanned` | DATETIME |  | `CURRENT_TIMESTAMP` |  | ✓ |
| `import_status` | TEXT |  | `'pending'` |  | ✓ |
| `import_batch_id` | INTEGER |  |  |  | ✓ |
| `import_error` | TEXT |  |  |  | ✓ |
| `imported_at` | DATETIME |  |  |  | ✓ |

  _(rows: 0)_

### `watcher_import_history`  [in:both]

_Created in: `096_watcher_tables.sql`_

| Column | Type | NN | Default | PK | In migrations |
|---|---|---|---|---|---|
| `id` | INTEGER |  |  | ✓ | ✓ |
| `file_registry_id` | INTEGER |  |  |  | ✓ |
| `rule_id` | INTEGER |  |  |  | ✓ |
| `rule_name` | TEXT |  |  |  | ✓ |
| `module` | TEXT | ✓ |  |  | ✓ |
| `account_id` | INTEGER |  |  |  | ✓ |
| `batch_id` | INTEGER |  |  |  | ✓ |
| `transactions_imported` | INTEGER |  | `0` |  | ✓ |
| `started_at` | DATETIME |  |  |  | ✓ |
| `completed_at` | DATETIME |  |  |  | ✓ |
| `status` | TEXT |  | `'pending'` |  | ✓ |
| `error_message` | TEXT |  |  |  | ✓ |
| `created_at` | DATETIME |  | `CURRENT_TIMESTAMP` |  | ✓ |

  _(rows: 0)_

### `webhook_logs`  [in:both]

_Created in: `101_system_ux.sql`_

| Column | Type | NN | Default | PK | In migrations |
|---|---|---|---|---|---|
| `id` | INTEGER |  |  | ✓ | ✓ |
| `webhook_id` | INTEGER |  |  |  | ✓ |
| `event_type` | TEXT | ✓ |  |  | ✓ |
| `payload` | TEXT |  |  |  | ✓ |
| `response_code` | INTEGER |  |  |  | ✓ |
| `response_body` | TEXT |  |  |  | ✓ |
| `duration_ms` | INTEGER |  |  |  | ✓ |
| `created_at` | DATETIME |  | `CURRENT_TIMESTAMP` |  | ✓ |

  _(rows: 0)_

### `webhooks`  [in:both]

_Created in: `101_system_ux.sql`_

| Column | Type | NN | Default | PK | In migrations |
|---|---|---|---|---|---|
| `id` | INTEGER |  |  | ✓ | ✓ |
| `name` | TEXT | ✓ |  |  | ✓ |
| `url` | TEXT | ✓ |  |  | ✓ |
| `event_type` | TEXT | ✓ |  |  | ✓ |
| `enabled` | INTEGER |  | `1` |  | ✓ |
| `secret` | TEXT |  |  |  | ✓ |
| `last_triggered` | DATETIME |  |  |  | ✓ |
| `last_status` | INTEGER |  |  |  | ✓ |
| `failure_count` | INTEGER |  | `0` |  | ✓ |
| `created_at` | DATETIME |  | `CURRENT_TIMESTAMP` |  | ✓ |

  _(rows: 0)_

---

### Migration-only tables (not present on prod)

These tables appear in migration replays but do not exist on the running prod database.

### `annual_checklist`  [in:migration-only]

_Created in: `001_initial.sql`_

| Column | Type | NN | Default | PK |
|---|---|---|---|---|
| `id` | INTEGER |  |  | ✓ |
| `title` | TEXT | ✓ |  |  |
| `category` | TEXT |  |  |  |
| `description` | TEXT |  |  |  |
| `due_month` | INTEGER |  |  |  |
| `recurrence` | TEXT |  | `'annual'` |  |
| `is_active` | INTEGER |  | `1` |  |
| `sort_order` | INTEGER |  | `0` |  |

### `checklist_completions`  [in:migration-only]

_Created in: `001_initial.sql`_

| Column | Type | NN | Default | PK |
|---|---|---|---|---|
| `id` | INTEGER |  |  | ✓ |
| `checklist_id` | INTEGER | ✓ |  |  |
| `year` | INTEGER | ✓ |  |  |
| `completed` | INTEGER |  | `0` |  |
| `completed_at` | DATETIME |  |  |  |
| `notes` | TEXT |  |  |  |

### `holdings_v2`  [in:migration-only]

_Created in: `126_finance_unify.js`_

| Column | Type | NN | Default | PK |
|---|---|---|---|---|
| `id` | INTEGER |  |  | ✓ |
| `account_id` | INTEGER | ✓ |  |  |
| `symbol` | TEXT | ✓ |  |  |
| `name` | TEXT |  |  |  |
| `asset_type` | TEXT |  |  |  |
| `shares` | REAL |  |  |  |
| `price` | REAL |  |  |  |
| `market_value` | REAL |  |  |  |
| `total_cost_basis` | REAL |  |  |  |
| `gain_loss_dollar` | REAL |  |  |  |
| `gain_loss_pct` | REAL |  |  |  |
| `day_change_dollar` | REAL |  |  |  |
| `day_change_pct` | REAL |  |  |  |
| `week52_low` | REAL |  |  |  |
| `week52_high` | REAL |  |  |  |
| `reinvest_dividends` | INTEGER | ✓ | `0` |  |
| `as_of_date` | DATE |  |  |  |
| `updated_at` | DATETIME |  | `CURRENT_TIMESTAMP` |  |

### `hsa_payments_new`  [in:migration-only]

_Created in: `unknown`_

| Column | Type | NN | Default | PK |
|---|---|---|---|---|
| `id` | INTEGER |  |  | ✓ |
| `date` | DATE | ✓ |  |  |
| `patient` | TEXT | ✓ | `'Self'` |  |
| `provider` | TEXT |  |  |  |
| `category` | TEXT |  |  |  |
| `payment_type` | TEXT |  |  |  |
| `total_bill` | REAL |  | `0` |  |
| `insurance_paid` | REAL |  | `0` |  |
| `you_paid` | REAL |  | `0` |  |
| `hsa_eligible` | INTEGER |  | `1` |  |
| `receipt_saved` | INTEGER |  | `0` |  |
| `receipt_location` | TEXT |  |  |  |
| `reimbursed` | INTEGER |  | `0` |  |
| `reimbursement_date` | DATE |  |  |  |
| `notes` | TEXT |  |  |  |
| `created_at` | DATETIME |  | `CURRENT_TIMESTAMP` |  |
| `updated_at` | DATETIME |  | `CURRENT_TIMESTAMP` |  |

### `import_batches_v2`  [in:migration-only]

_Created in: `126_finance_unify.js`_

| Column | Type | NN | Default | PK |
|---|---|---|---|---|
| `id` | INTEGER |  |  | ✓ |
| `account_id` | INTEGER | ✓ |  |  |
| `filename` | TEXT | ✓ |  |  |
| `format` | TEXT |  |  |  |
| `row_count` | INTEGER | ✓ | `0` |  |
| `imported_at` | DATETIME |  | `CURRENT_TIMESTAMP` |  |
| `statement_date` | DATE |  |  |  |
| `notes` | TEXT |  |  |  |

---

## Schema gotchas — read before writing SQL

These caused real prod crashes. Common mistakes from memory:

| Wrong (DO NOT use) | Right |
|---|---|
| `accounts.account_type` | `accounts.type` |
| `transactions.merchant` | `transactions.description` |
| `transactions.family_member_id` | (column does not exist — use record_links or hsa_payments.family_member_id) |
| `hsa_payments.payment_date` | `hsa_payments.date` |
| `hsa_payments.vendor` | `hsa_payments.provider` |
| `hsa_payments.expense_type` | `hsa_payments.category` |
| `contacts.type` | `contacts.contact_type` |
| `contacts.practice_name` | `contacts.company` |
| `contacts.phone` | `contacts.phone_primary` |
| `family_members.is_active` | (column does not exist — no soft delete on family members) |
| `subscriptions.merchant` | `subscriptions.name` |
| `contact_type = "medical_provider"` | `contact_type = "Medical"` (capitalized) |

Two tables that look like one — never write code that assumes only one:

- `hsa_plan_info` (older, HSA-only) **and** `fsa_plan_info` (newer, multi-plan via `plan_type`)
- `finance_accounts` (VIEW) **and** `financial_accounts` (VIEW) — both wrap the unified `accounts` table (mig 130)
- `kids` (per-kid extras) **and** `family_members` (canonical identity) — kids has `family_member_id` FK; family_members has no `is_active`
