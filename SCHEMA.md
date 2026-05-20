# SCHEMA.md — Ghrava database reference

> **Auto-generated** by `.claude/skills/ghrava-schema-safety/scripts/gen-schema-doc.py`
> Last generated: `2026-05-20T21:47:37.756085Z`
> Source: 143 migration files in `app/db/migrations/`
>
> **DO NOT EDIT BY HAND.** This file is regenerated before every package.
> If a column is missing here, it does not exist on prod.

## Summary

- **123 tables**
- **1692 columns total**

## Tables

### `account_snapshots`

_Created in: `032_import_finance.sql`_

| Column | Type | NN | Default | PK | Added |
|---|---|---|---|---|---|
| `id` | INTEGER |  |  | ✓ | `032_import_finance.sql` |
| `account_id` | INTEGER | ✓ |  |  | `—` |
| `snapshot_date` | DATE | ✓ |  |  | `—` |
| `balance` | REAL | ✓ |  |  | `—` |
| `batch_id` | INTEGER |  |  |  | `—` |
| `created_at` | DATETIME |  | `CURRENT_TIMESTAMP` |  | `—` |

### `accounts`

_Created in: `126_finance_unify.js`_

| Column | Type | NN | Default | PK | Added |
|---|---|---|---|---|---|
| `id` | INTEGER |  |  | ✓ | `126_finance_unify.js` |
| `name` | TEXT | ✓ |  |  | `—` |
| `alias` | TEXT |  |  |  | `—` |
| `type` | TEXT | ✓ | `'Other'` |  | `—` |
| `institution` | TEXT |  |  |  | `—` |
| `last4` | TEXT |  |  |  | `—` |
| `owner` | TEXT |  |  |  | `—` |
| `currency` | TEXT | ✓ | `'USD'` |  | `—` |
| `current_balance` | REAL | ✓ | `0` |  | `—` |
| `balance_as_of` | DATE |  |  |  | `—` |
| `include_net_worth` | INTEGER | ✓ | `1` |  | `—` |
| `is_active` | INTEGER | ✓ | `1` |  | `—` |
| `track_statements` | INTEGER | ✓ | `0` |  | `—` |
| `notes` | TEXT |  |  |  | `—` |
| `sort_order` | INTEGER | ✓ | `0` |  | `—` |
| `source` | TEXT | ✓ | `'manual'` |  | `—` |
| `needs_review` | INTEGER | ✓ | `0` |  | `—` |
| `credit_limit` | REAL |  |  |  | `—` |
| `statement_balance` | REAL |  |  |  | `—` |
| `minimum_payment` | REAL |  |  |  | `—` |
| `payment_due_date` | DATE |  |  |  | `—` |
| `apr` | REAL |  |  |  | `—` |
| `promo_apr` | REAL |  |  |  | `—` |
| `promo_end_date` | DATE |  |  |  | `—` |
| `annual_fee` | REAL |  |  |  | `—` |
| `annual_fee_renewal_date` | DATE |  |  |  | `—` |
| `rewards_balance` | REAL |  |  |  | `—` |
| `created_at` | DATETIME |  | `CURRENT_TIMESTAMP` |  | `—` |
| `updated_at` | DATETIME |  | `CURRENT_TIMESTAMP` |  | `—` |

### `accounts_beneficiaries`

_Created in: `unknown`_

| Column | Type | NN | Default | PK | Added |
|---|---|---|---|---|---|
| `id` | INTEGER |  |  | ✓ | `unknown` |
| `name` | TEXT | ✓ |  |  | `—` |
| `alias` | TEXT |  |  |  | `—` |
| `type` | TEXT | ✓ | `'Other'` |  | `—` |
| `institution` | TEXT |  |  |  | `—` |
| `last4` | TEXT |  |  |  | `—` |
| `owner` | TEXT |  |  |  | `—` |
| `currency` | TEXT | ✓ | `'USD'` |  | `—` |
| `current_balance` | REAL | ✓ | `0` |  | `—` |
| `balance_as_of` | DATE |  |  |  | `—` |
| `include_net_worth` | INTEGER | ✓ | `1` |  | `—` |
| `is_active` | INTEGER | ✓ | `1` |  | `—` |
| `track_statements` | INTEGER | ✓ | `0` |  | `—` |
| `notes` | TEXT |  |  |  | `—` |
| `sort_order` | INTEGER | ✓ | `0` |  | `—` |
| `source` | TEXT | ✓ | `'manual'` |  | `—` |
| `needs_review` | INTEGER | ✓ | `0` |  | `—` |
| `created_at` | DATETIME |  | `CURRENT_TIMESTAMP` |  | `—` |
| `updated_at` | DATETIME |  | `CURRENT_TIMESTAMP` |  | `—` |

### `annual_checklist`

_Created in: `001_initial.sql`_

| Column | Type | NN | Default | PK | Added |
|---|---|---|---|---|---|
| `id` | INTEGER |  |  | ✓ | `001_initial.sql` |
| `title` | TEXT | ✓ |  |  | `—` |
| `category` | TEXT |  |  |  | `—` |
| `description` | TEXT |  |  |  | `—` |
| `due_month` | INTEGER |  |  |  | `—` |
| `recurrence` | TEXT |  | `'annual'` |  | `—` |
| `is_active` | INTEGER |  | `1` |  | `—` |
| `sort_order` | INTEGER |  | `0` |  | `—` |

### `app_config`

_Created in: `001_initial.sql`_

| Column | Type | NN | Default | PK | Added |
|---|---|---|---|---|---|
| `key` | TEXT |  |  | ✓ | `—` |
| `value` | TEXT |  |  |  | `—` |
| `updated_at` | DATETIME |  | `CURRENT_TIMESTAMP` |  | `—` |

### `attachments`

_Created in: `001_initial.sql`_

| Column | Type | NN | Default | PK | Added |
|---|---|---|---|---|---|
| `id` | INTEGER |  |  | ✓ | `001_initial.sql` |
| `entity_type` | TEXT | ✓ |  |  | `—` |
| `entity_id` | INTEGER | ✓ |  |  | `—` |
| `module` | TEXT | ✓ |  |  | `—` |
| `label` | TEXT |  |  |  | `—` |
| `original_filename` | TEXT | ✓ |  |  | `—` |
| `stored_filename` | TEXT | ✓ |  |  | `—` |
| `stored_path` | TEXT | ✓ |  |  | `—` |
| `unc_path` | TEXT |  |  |  | `—` |
| `file_size` | INTEGER |  |  |  | `—` |
| `mime_type` | TEXT |  |  |  | `—` |
| `is_image` | INTEGER |  | `0` |  | `—` |
| `is_primary_photo` | INTEGER |  | `0` |  | `—` |
| `thumb_path` | TEXT |  |  |  | `—` |
| `sort_order` | INTEGER |  | `0` |  | `—` |
| `notes` | TEXT |  |  |  | `—` |
| `created_at` | DATETIME |  | `CURRENT_TIMESTAMP` |  | `—` |

### `books`

_Created in: `022_books.sql`_

| Column | Type | NN | Default | PK | Added |
|---|---|---|---|---|---|
| `id` | INTEGER |  |  | ✓ | `022_books.sql` |
| `title` | TEXT | ✓ |  |  | `—` |
| `author` | TEXT |  |  |  | `—` |
| `genre` | TEXT |  |  |  | `—` |
| `status` | TEXT | ✓ | `'Want to Read'` |  | `—` |
| `rating` | INTEGER |  |  |  | `—` |
| `format` | TEXT |  | `'Physical'` |  | `—` |
| `date_started` | DATE |  |  |  | `—` |
| `date_finished` | DATE |  |  |  | `—` |
| `notes` | TEXT |  |  |  | `—` |
| `isbn` | TEXT |  |  |  | `—` |
| `cover_url` | TEXT |  |  |  | `—` |
| `is_active` | INTEGER | ✓ | `1` |  | `—` |
| `created_at` | DATETIME |  | `CURRENT_TIMESTAMP` |  | `—` |
| `updated_at` | DATETIME |  | `CURRENT_TIMESTAMP` |  | `—` |
| `needs_review` | INTEGER | ✓ | `0` |  | `039_needs_review.sql` |
| `review_flagged_at` | DATETIME |  |  |  | `039_needs_review.sql` |
| `review_reason` | TEXT |  |  |  | `039_needs_review.sql` |
| `pages_total` | INTEGER |  |  |  | `049_books_progress.sql` |
| `pages_read` | INTEGER |  |  |  | `049_books_progress.sql` |
| `publisher` | TEXT |  |  |  | `075_books_publisher_fields.sql` |
| `publish_year` | INTEGER |  |  |  | `075_books_publisher_fields.sql` |
| `language` | TEXT |  |  |  | `075_books_publisher_fields.sql` |
| `physical_status` | TEXT |  | `'owned'` |  | `113_archive_dispose.sql` |
| `physical_status_notes` | TEXT |  |  |  | `113_archive_dispose.sql` |
| `physical_status_date` | TEXT |  |  |  | `113_archive_dispose.sql` |

### `budgets`

_Created in: `023_budgets.sql`_

| Column | Type | NN | Default | PK | Added |
|---|---|---|---|---|---|
| `id` | INTEGER |  |  | ✓ | `023_budgets.sql` |
| `category` | TEXT | ✓ |  |  | `—` |
| `monthly_limit` | REAL | ✓ | `0` |  | `—` |
| `year` | INTEGER | ✓ | `strftime('%Y', 'now')` |  | `—` |
| `month` | INTEGER |  |  |  | `—` |
| `notes` | TEXT |  |  |  | `—` |
| `is_active` | INTEGER | ✓ | `1` |  | `—` |
| `created_at` | DATETIME |  | `CURRENT_TIMESTAMP` |  | `—` |
| `updated_at` | DATETIME |  | `CURRENT_TIMESTAMP` |  | `—` |

### `calendar_events`

_Created in: `027_google_calendar.sql`_

| Column | Type | NN | Default | PK | Added |
|---|---|---|---|---|---|
| `id` | TEXT |  |  | ✓ | `027_google_calendar.sql` |
| `calendar_id` | TEXT |  | `'primary'` |  | `—` |
| `title` | TEXT | ✓ |  |  | `—` |
| `description` | TEXT |  |  |  | `—` |
| `location` | TEXT |  |  |  | `—` |
| `start_datetime` | TEXT | ✓ |  |  | `—` |
| `end_datetime` | TEXT |  |  |  | `—` |
| `all_day` | INTEGER | ✓ | `0` |  | `—` |
| `status` | TEXT |  | `'confirmed'` |  | `—` |
| `recurring` | INTEGER | ✓ | `0` |  | `—` |
| `source` | TEXT | ✓ | `'local'` |  | `—` |
| `family_member` | TEXT |  |  |  | `—` |
| `color_id` | TEXT |  |  |  | `—` |
| `html_link` | TEXT |  |  |  | `—` |
| `organizer_email` | TEXT |  |  |  | `—` |
| `synced_at` | DATETIME |  | `CURRENT_TIMESTAMP` |  | `—` |
| `created_at` | DATETIME |  | `CURRENT_TIMESTAMP` |  | `—` |
| `updated_at` | DATETIME |  | `CURRENT_TIMESTAMP` |  | `—` |

### `career_certifications`

_Created in: `021_career.sql`_

| Column | Type | NN | Default | PK | Added |
|---|---|---|---|---|---|
| `id` | INTEGER |  |  | ✓ | `021_career.sql` |
| `name` | TEXT | ✓ |  |  | `—` |
| `issuing_body` | TEXT |  |  |  | `—` |
| `credential_id` | TEXT |  |  |  | `—` |
| `issue_date` | DATE |  |  |  | `—` |
| `expiry_date` | DATE |  |  |  | `—` |
| `status` | TEXT | ✓ | `'Active'` |  | `—` |
| `notes` | TEXT |  |  |  | `—` |
| `todo_id` | INTEGER |  |  |  | `—` |
| `created_at` | DATETIME |  | `CURRENT_TIMESTAMP` |  | `—` |
| `updated_at` | DATETIME |  | `CURRENT_TIMESTAMP` |  | `—` |
| `needs_review` | INTEGER | ✓ | `0` |  | `039_needs_review.sql` |
| `review_flagged_at` | DATETIME |  |  |  | `039_needs_review.sql` |
| `review_reason` | TEXT |  |  |  | `039_needs_review.sql` |
| `cert_number` | TEXT |  |  |  | `078_career_learning.sql` |
| `ce_hours_required` | REAL |  |  |  | `078_career_learning.sql` |
| `renewal_period_months` | INTEGER |  |  |  | `078_career_learning.sql` |
| `current_cycle_start` | DATE |  |  |  | `078_career_learning.sql` |
| `current_cycle_end` | DATE |  |  |  | `078_career_learning.sql` |
| `ce_category_rules` | TEXT |  |  |  | `078_career_learning.sql` |
| `renewal_fee` | REAL |  |  |  | `090_cert_renewal_fee.sql` |

### `career_goals`

_Created in: `035_property_maintenance.sql`_

| Column | Type | NN | Default | PK | Added |
|---|---|---|---|---|---|
| `id` | INTEGER |  |  | ✓ | `035_property_maintenance.sql` |
| `title` | TEXT | ✓ |  |  | `—` |
| `category` | TEXT |  | `'General'` |  | `—` |
| `target_date` | DATE |  |  |  | `—` |
| `status` | TEXT |  | `'active'` |  | `—` |
| `notes` | TEXT |  |  |  | `—` |
| `created_at` | DATETIME |  | `CURRENT_TIMESTAMP` |  | `—` |
| `updated_at` | DATETIME |  | `CURRENT_TIMESTAMP` |  | `—` |
| `needs_review` | INTEGER | ✓ | `0` |  | `039_needs_review.sql` |
| `review_flagged_at` | DATETIME |  |  |  | `039_needs_review.sql` |
| `review_reason` | TEXT |  |  |  | `039_needs_review.sql` |

### `career_jobs`

_Created in: `021_career.sql`_

| Column | Type | NN | Default | PK | Added |
|---|---|---|---|---|---|
| `id` | INTEGER |  |  | ✓ | `021_career.sql` |
| `company` | TEXT | ✓ |  |  | `—` |
| `title` | TEXT | ✓ |  |  | `—` |
| `employment_type` | TEXT |  | `'Full-time'` |  | `—` |
| `start_date` | DATE |  |  |  | `—` |
| `end_date` | DATE |  |  |  | `—` |
| `location` | TEXT |  |  |  | `—` |
| `description` | TEXT |  |  |  | `—` |
| `is_current` | INTEGER | ✓ | `0` |  | `—` |
| `created_at` | DATETIME |  | `CURRENT_TIMESTAMP` |  | `—` |
| `needs_review` | INTEGER | ✓ | `0` |  | `039_needs_review.sql` |
| `review_flagged_at` | DATETIME |  |  |  | `039_needs_review.sql` |
| `review_reason` | TEXT |  |  |  | `039_needs_review.sql` |
| `company_contact_id` | INTEGER |  |  |  | `068_career_contact_refs.sql` |

### `career_learning`

_Created in: `078_career_learning.sql`_

| Column | Type | NN | Default | PK | Added |
|---|---|---|---|---|---|
| `id` | INTEGER |  |  | ✓ | `078_career_learning.sql` |
| `title` | TEXT | ✓ |  |  | `—` |
| `learning_type` | TEXT | ✓ | `'Course'` |  | `—` |
| `provider` | TEXT |  |  |  | `—` |
| `start_date` | DATE |  |  |  | `—` |
| `end_date` | DATE |  |  |  | `—` |
| `hours_total` | REAL |  |  |  | `—` |
| `location` | TEXT |  |  |  | `—` |
| `url` | TEXT |  |  |  | `—` |
| `cost` | REAL |  |  |  | `—` |
| `description` | TEXT |  |  |  | `—` |
| `notes` | TEXT |  |  |  | `—` |
| `needs_review` | INTEGER | ✓ | `0` |  | `—` |
| `review_flagged_at` | DATETIME |  |  |  | `—` |
| `review_reason` | TEXT |  |  |  | `—` |
| `created_at` | DATETIME |  | `CURRENT_TIMESTAMP` |  | `—` |
| `updated_at` | DATETIME |  | `CURRENT_TIMESTAMP` |  | `—` |
| `instructor_contact_id` | INTEGER |  |  |  | `089_learning_instructor.sql` |

### `career_learning_certs`

_Created in: `078_career_learning.sql`_

| Column | Type | NN | Default | PK | Added |
|---|---|---|---|---|---|
| `id` | INTEGER |  |  | ✓ | `078_career_learning.sql` |
| `learning_id` | INTEGER | ✓ |  |  | `—` |
| `certification_id` | INTEGER | ✓ |  |  | `—` |
| `hours_applied` | REAL |  |  |  | `—` |
| `ce_category` | TEXT |  |  |  | `—` |
| `notes` | TEXT |  |  |  | `—` |
| `created_at` | DATETIME |  | `CURRENT_TIMESTAMP` |  | `—` |

### `career_skills`

_Created in: `021_career.sql`_

| Column | Type | NN | Default | PK | Added |
|---|---|---|---|---|---|
| `id` | INTEGER |  |  | ✓ | `021_career.sql` |
| `name` | TEXT | ✓ |  |  | `—` |
| `category` | TEXT |  |  |  | `—` |
| `proficiency` | TEXT |  | `'Intermediate'` |  | `—` |
| `years_experience` | REAL |  |  |  | `—` |
| `last_used_year` | INTEGER |  |  |  | `—` |
| `notes` | TEXT |  |  |  | `—` |
| `created_at` | DATETIME |  | `CURRENT_TIMESTAMP` |  | `—` |
| `needs_review` | INTEGER | ✓ | `0` |  | `039_needs_review.sql` |
| `review_flagged_at` | DATETIME |  |  |  | `039_needs_review.sql` |
| `review_reason` | TEXT |  |  |  | `039_needs_review.sql` |

### `checklist_completions`

_Created in: `001_initial.sql`_

| Column | Type | NN | Default | PK | Added |
|---|---|---|---|---|---|
| `id` | INTEGER |  |  | ✓ | `001_initial.sql` |
| `checklist_id` | INTEGER | ✓ |  |  | `—` |
| `year` | INTEGER | ✓ |  |  | `—` |
| `completed` | INTEGER |  | `0` |  | `—` |
| `completed_at` | DATETIME |  |  |  | `—` |
| `notes` | TEXT |  |  |  | `—` |

### `contacts`

_Created in: `001_initial.sql`_

| Column | Type | NN | Default | PK | Added |
|---|---|---|---|---|---|
| `id` | INTEGER |  |  | ✓ | `001_initial.sql` |
| `contact_type` | TEXT | ✓ |  |  | `—` |
| `name` | TEXT | ✓ |  |  | `—` |
| `company` | TEXT |  |  |  | `—` |
| `phone_primary` | TEXT |  |  |  | `—` |
| `phone_secondary` | TEXT |  |  |  | `—` |
| `email` | TEXT |  |  |  | `—` |
| `address` | TEXT |  |  |  | `—` |
| `website` | TEXT |  |  |  | `—` |
| `notes` | TEXT |  |  |  | `—` |
| `created_at` | DATETIME |  | `CURRENT_TIMESTAMP` |  | `—` |
| `updated_at` | DATETIME |  | `CURRENT_TIMESTAMP` |  | `—` |
| `address_street` | TEXT |  |  |  | `010_address_fields.sql` |
| `address_city` | TEXT |  |  |  | `010_address_fields.sql` |
| `address_state` | TEXT |  |  |  | `010_address_fields.sql` |
| `address_zip` | TEXT |  |  |  | `010_address_fields.sql` |
| `needs_review` | INTEGER | ✓ | `0` |  | `039_needs_review.sql` |
| `review_flagged_at` | DATETIME |  |  |  | `039_needs_review.sql` |
| `review_reason` | TEXT |  |  |  | `039_needs_review.sql` |
| `specialty` | TEXT |  |  |  | `041_flatten_contacts.sql` |
| `google_contact_id` | TEXT |  |  |  | `041_flatten_contacts.sql` |
| `patients_seen` | TEXT |  |  |  | `041_flatten_contacts.sql` |
| `accepts_insurance` | TEXT |  |  |  | `041_flatten_contacts.sql` |
| `license_number` | TEXT |  |  |  | `041_flatten_contacts.sql` |
| `insurance_verified` | INTEGER |  | `0` |  | `041_flatten_contacts.sql` |
| `bonded` | INTEGER |  | `0` |  | `041_flatten_contacts.sql` |
| `last_used_date` | DATE |  |  |  | `041_flatten_contacts.sql` |
| `quality_rating` | INTEGER |  |  |  | `041_flatten_contacts.sql` |
| `hr_contact_name` | TEXT |  |  |  | `041_flatten_contacts.sql` |
| `hr_phone` | TEXT |  |  |  | `041_flatten_contacts.sql` |
| `ein` | TEXT |  |  |  | `041_flatten_contacts.sql` |
| `employee_family_member_id` | INTEGER |  |  |  | `041_flatten_contacts.sql` |
| `principal_name` | TEXT |  |  |  | `041_flatten_contacts.sql` |
| `grade_range` | TEXT |  |  |  | `041_flatten_contacts.sql` |
| `enrolled_kids` | TEXT |  |  |  | `041_flatten_contacts.sql` |
| `institution_type` | TEXT |  |  |  | `041_flatten_contacts.sql` |
| `rep_name` | TEXT |  |  |  | `041_flatten_contacts.sql` |
| `account_types_served` | TEXT |  |  |  | `041_flatten_contacts.sql` |
| `google_updated_at` | TEXT |  |  |  | `091_contacts_google_updated_at.sql` |
| `is_emergency_contact` | INTEGER | ✓ | `0` |  | `097_emergency_contact.sql` |
| `credentials` | TEXT |  |  |  | `131_medical_expansion.js` |
| `manages` | TEXT |  |  |  | `131_medical_expansion.js` |
| `is_primary_pcp` | INTEGER |  | `0` |  | `131_medical_expansion.js` |
| `portal_url` | TEXT |  |  |  | `131_medical_expansion.js` |
| `fax` | TEXT |  |  |  | `131_medical_expansion.js` |
| `npi` | TEXT |  |  |  | `131_medical_expansion.js` |

### `containers`

_Created in: `001_initial.sql`_

| Column | Type | NN | Default | PK | Added |
|---|---|---|---|---|---|
| `id` | INTEGER |  |  | ✓ | `001_initial.sql` |
| `container_ref` | TEXT |  |  |  | `—` |
| `name` | TEXT | ✓ |  |  | `—` |
| `description` | TEXT |  |  |  | `—` |
| `subtype` | TEXT |  | `'movable'` |  | `—` |
| `parent_type` | TEXT | ✓ |  |  | `—` |
| `parent_id` | INTEGER | ✓ |  |  | `—` |
| `qr_code_path` | TEXT |  |  |  | `—` |
| `last_moved_at` | DATETIME |  |  |  | `—` |
| `notes` | TEXT |  |  |  | `—` |
| `created_at` | DATETIME |  | `CURRENT_TIMESTAMP` |  | `—` |
| `updated_at` | DATETIME |  | `CURRENT_TIMESTAMP` |  | `—` |
| `is_business` | INTEGER |  | `0` |  | `005_health_wellness.sql` |

### `custom_field_defs`

_Created in: `001_initial.sql`_

| Column | Type | NN | Default | PK | Added |
|---|---|---|---|---|---|
| `id` | INTEGER |  |  | ✓ | `001_initial.sql` |
| `name` | TEXT | ✓ |  |  | `—` |
| `field_type` | TEXT | ✓ |  |  | `—` |
| `scope_module` | TEXT |  |  |  | `—` |
| `scope_category` | TEXT |  |  |  | `—` |
| `required` | INTEGER |  | `0` |  | `—` |
| `default_value` | TEXT |  |  |  | `—` |
| `options` | TEXT |  |  |  | `—` |
| `sort_order` | INTEGER |  | `0` |  | `—` |
| `created_at` | DATETIME |  | `CURRENT_TIMESTAMP` |  | `—` |

### `custom_field_values`

_Created in: `001_initial.sql`_

| Column | Type | NN | Default | PK | Added |
|---|---|---|---|---|---|
| `field_def_id` | INTEGER | ✓ |  | ✓ | `—` |
| `entity_type` | TEXT | ✓ |  | ✓ | `—` |
| `entity_id` | INTEGER | ✓ |  | ✓ | `—` |
| `value` | TEXT |  |  |  | `—` |

### `daily_log`

_Created in: `001_initial.sql`_

| Column | Type | NN | Default | PK | Added |
|---|---|---|---|---|---|
| `id` | INTEGER |  |  | ✓ | `001_initial.sql` |
| `log_date` | DATE | ✓ |  |  | `—` |
| `category` | TEXT |  | `'General'` |  | `—` |
| `entry_text` | TEXT | ✓ |  |  | `—` |
| `follow_up_needed` | INTEGER |  | `0` |  | `—` |
| `follow_up_date` | DATE |  |  |  | `—` |
| `created_at` | DATETIME |  | `CURRENT_TIMESTAMP` |  | `—` |
| `updated_at` | DATETIME |  | `CURRENT_TIMESTAMP` |  | `—` |
| `needs_review` | INTEGER | ✓ | `0` |  | `039_needs_review.sql` |
| `review_flagged_at` | DATETIME |  |  |  | `039_needs_review.sql` |
| `review_reason` | TEXT |  |  |  | `039_needs_review.sql` |
| `is_memory` | INTEGER | ✓ | `0` |  | `112_memories.sql` |
| `memory_category` | TEXT |  |  |  | `112_memories.sql` |
| `promoted_to_type` | TEXT |  |  |  | `117_daily_log_promote.sql` |
| `promoted_to_id` | INTEGER |  |  |  | `117_daily_log_promote.sql` |

### `db_maintenance_log`

_Created in: `101_system_ux.sql`_

| Column | Type | NN | Default | PK | Added |
|---|---|---|---|---|---|
| `id` | INTEGER |  |  | ✓ | `101_system_ux.sql` |
| `operation` | TEXT | ✓ |  |  | `—` |
| `started_at` | DATETIME |  | `CURRENT_TIMESTAMP` |  | `—` |
| `completed_at` | DATETIME |  |  |  | `—` |
| `duration_ms` | INTEGER |  |  |  | `—` |
| `result` | TEXT |  |  |  | `—` |
| `details` | TEXT |  |  |  | `—` |

### `deleted_items`

_Created in: `098_undo_expiry_rules.sql`_

| Column | Type | NN | Default | PK | Added |
|---|---|---|---|---|---|
| `id` | INTEGER |  |  | ✓ | `098_undo_expiry_rules.sql` |
| `entity_type` | TEXT | ✓ |  |  | `—` |
| `entity_id` | INTEGER | ✓ |  |  | `—` |
| `entity_name` | TEXT | ✓ |  |  | `—` |
| `deleted_at` | DATETIME |  | `CURRENT_TIMESTAMP` |  | `—` |
| `deleted_data` | TEXT |  |  |  | `—` |

### `document_item_links`

_Created in: `092_document_item_links.sql`_

| Column | Type | NN | Default | PK | Added |
|---|---|---|---|---|---|
| `id` | INTEGER |  |  | ✓ | `092_document_item_links.sql` |
| `document_id` | INTEGER | ✓ |  |  | `—` |
| `item_id` | INTEGER | ✓ |  |  | `—` |
| `link_type` | TEXT |  | `'manual'` |  | `—` |
| `created_at` | DATETIME |  | `CURRENT_TIMESTAMP` |  | `—` |

### `documents`

_Created in: `025_documents.sql`_

| Column | Type | NN | Default | PK | Added |
|---|---|---|---|---|---|
| `id` | INTEGER |  |  | ✓ | `025_documents.sql` |
| `title` | TEXT | ✓ |  |  | `—` |
| `category` | TEXT | ✓ | `'Other'` |  | `—` |
| `subcategory` | TEXT |  |  |  | `—` |
| `description` | TEXT |  |  |  | `—` |
| `file_name` | TEXT |  |  |  | `—` |
| `file_path` | TEXT |  |  |  | `—` |
| `attachment_id` | INTEGER |  |  |  | `—` |
| `issuer` | TEXT |  |  |  | `—` |
| `issue_date` | DATE |  |  |  | `—` |
| `expiry_date` | DATE |  |  |  | `—` |
| `tags` | TEXT |  |  |  | `—` |
| `family_member` | TEXT |  |  |  | `—` |
| `is_active` | INTEGER | ✓ | `1` |  | `—` |
| `created_at` | DATETIME |  | `CURRENT_TIMESTAMP` |  | `—` |
| `updated_at` | DATETIME |  | `CURRENT_TIMESTAMP` |  | `—` |
| `needs_review` | INTEGER | ✓ | `0` |  | `039_needs_review.sql` |
| `review_flagged_at` | DATETIME |  |  |  | `039_needs_review.sql` |
| `review_reason` | TEXT |  |  |  | `039_needs_review.sql` |
| `url_link` | TEXT |  |  |  | `084_documents_url.sql` |
| `expiry_notified` | INTEGER |  | `0` |  | `098_undo_expiry_rules.sql` |
| `renewal_reminder_days` | INTEGER |  | `60` |  | `098_undo_expiry_rules.sql` |
| `archive_reason` | TEXT |  |  |  | `113_archive_dispose.sql` |

### `dropdown_options`

_Created in: `006_dropdown_options.sql`_

| Column | Type | NN | Default | PK | Added |
|---|---|---|---|---|---|
| `id` | INTEGER |  |  | ✓ | `006_dropdown_options.sql` |
| `list_key` | TEXT | ✓ |  |  | `—` |
| `label` | TEXT | ✓ |  |  | `—` |
| `value` | TEXT | ✓ |  |  | `—` |
| `sort_order` | INTEGER |  | `0` |  | `—` |
| `is_active` | INTEGER |  | `1` |  | `—` |
| `is_system` | INTEGER |  | `0` |  | `—` |
| `created_at` | DATETIME |  | `CURRENT_TIMESTAMP` |  | `—` |

### `family_members`

_Created in: `001_initial.sql`_

| Column | Type | NN | Default | PK | Added |
|---|---|---|---|---|---|
| `id` | INTEGER |  |  | ✓ | `001_initial.sql` |
| `display_name` | TEXT | ✓ |  |  | `—` |
| `full_legal_name` | TEXT |  |  |  | `—` |
| `relationship` | TEXT |  |  |  | `—` |
| `date_of_birth` | DATE |  |  |  | `—` |
| `ssn_last4` | TEXT |  |  |  | `—` |
| `is_primary_user` | INTEGER |  | `0` |  | `—` |
| `notes` | TEXT |  |  |  | `—` |
| `created_at` | DATETIME |  | `CURRENT_TIMESTAMP` |  | `—` |
| `updated_at` | DATETIME |  | `CURRENT_TIMESTAMP` |  | `—` |
| `needs_review` | INTEGER | ✓ | `0` |  | `039_needs_review.sql` |
| `review_flagged_at` | DATETIME |  |  |  | `039_needs_review.sql` |
| `review_reason` | TEXT |  |  |  | `039_needs_review.sql` |
| `emergency_notes` | TEXT |  |  |  | `097_emergency_contact.sql` |
| `avatar_attachment_id` | INTEGER |  |  |  | `115_family_member_avatar.sql` |
| `gender` | TEXT |  |  |  | `—` |

### `field_templates`

_Created in: `100_field_templates.sql`_

| Column | Type | NN | Default | PK | Added |
|---|---|---|---|---|---|
| `id` | INTEGER |  |  | ✓ | `100_field_templates.sql` |
| `entity_type` | TEXT | ✓ |  |  | `—` |
| `field_name` | TEXT | ✓ |  |  | `—` |
| `template_name` | TEXT | ✓ |  |  | `—` |
| `template_value` | TEXT | ✓ |  |  | `—` |
| `usage_count` | INTEGER |  | `0` |  | `—` |
| `created_at` | DATETIME |  | `CURRENT_TIMESTAMP` |  | `—` |

### `fin_import_batches`

_Created in: `062_finance_tx_batch.sql`_

| Column | Type | NN | Default | PK | Added |
|---|---|---|---|---|---|
| `id` | INTEGER |  |  | ✓ | `062_finance_tx_batch.sql` |
| `account_id` | INTEGER | ✓ |  |  | `—` |
| `account_type` | TEXT | ✓ | `'banking'` |  | `—` |
| `filename` | TEXT |  |  |  | `—` |
| `format` | TEXT |  |  |  | `—` |
| `rows_total` | INTEGER | ✓ | `0` |  | `—` |
| `rows_imported` | INTEGER | ✓ | `0` |  | `—` |
| `imported_at` | DATETIME |  | `CURRENT_TIMESTAMP` |  | `—` |

### `finance_accounts`

_Created in: `020_finance_accounts.sql`_

| Column | Type | NN | Default | PK | Added |
|---|---|---|---|---|---|
| `id` | INTEGER |  |  | ✓ | `020_finance_accounts.sql` |
| `name` | TEXT | ✓ |  |  | `—` |
| `type` | TEXT | ✓ | `'Checking'` |  | `—` |
| `institution` | TEXT |  |  |  | `—` |
| `account_last4` | TEXT |  |  |  | `—` |
| `current_balance` | REAL | ✓ | `0` |  | `—` |
| `balance_as_of` | DATE |  |  |  | `—` |
| `is_active` | INTEGER | ✓ | `1` |  | `—` |
| `include_net_worth` | INTEGER | ✓ | `1` |  | `—` |
| `notes` | TEXT |  |  |  | `—` |
| `sort_order` | INTEGER | ✓ | `0` |  | `—` |
| `created_at` | DATETIME |  | `CURRENT_TIMESTAMP` |  | `—` |
| `updated_at` | DATETIME |  | `CURRENT_TIMESTAMP` |  | `—` |
| `contact_id` | INTEGER |  |  |  | `083_small_gaps.sql` |
| `institution_contact_id` | INTEGER |  |  |  | `102_repair_schema.js` |
| `alias` | TEXT |  |  |  | `126_capture_and_finance_schema.js` |
| `credit_limit` | REAL |  |  |  | `126_capture_and_finance_schema.js` |
| `payment_due_date` | DATE |  |  |  | `126_capture_and_finance_schema.js` |
| `minimum_payment` | REAL |  |  |  | `126_capture_and_finance_schema.js` |
| `statement_balance` | REAL |  |  |  | `126_capture_and_finance_schema.js` |
| `statement_date` | DATE |  |  |  | `126_capture_and_finance_schema.js` |
| `apr` | REAL |  |  |  | `126_capture_and_finance_schema.js` |
| `promo_apr` | REAL |  |  |  | `126_capture_and_finance_schema.js` |
| `promo_end_date` | DATE |  |  |  | `126_capture_and_finance_schema.js` |
| `annual_fee` | REAL |  |  |  | `126_capture_and_finance_schema.js` |
| `annual_fee_renewal_date` | DATE |  |  |  | `126_capture_and_finance_schema.js` |
| `rewards_balance` | REAL |  |  |  | `126_capture_and_finance_schema.js` |
| `rewards_program` | TEXT |  |  |  | `126_capture_and_finance_schema.js` |

### `finance_transactions`

_Created in: `020_finance_accounts.sql`_

| Column | Type | NN | Default | PK | Added |
|---|---|---|---|---|---|
| `id` | INTEGER |  |  | ✓ | `020_finance_accounts.sql` |
| `account_id` | INTEGER | ✓ |  |  | `—` |
| `date` | DATE | ✓ |  |  | `—` |
| `description` | TEXT | ✓ |  |  | `—` |
| `amount` | REAL | ✓ |  |  | `—` |
| `category` | TEXT |  |  |  | `—` |
| `notes` | TEXT |  |  |  | `—` |
| `is_reconciled` | INTEGER | ✓ | `0` |  | `—` |
| `created_at` | DATETIME |  | `CURRENT_TIMESTAMP` |  | `—` |
| `batch_id` | INTEGER |  |  |  | `062_finance_tx_batch.sql` |

### `financial_accounts`

_Created in: `032_import_finance.sql`_

| Column | Type | NN | Default | PK | Added |
|---|---|---|---|---|---|
| `id` | INTEGER |  |  | ✓ | `032_import_finance.sql` |
| `nickname` | TEXT | ✓ |  |  | `—` |
| `institution` | TEXT | ✓ |  |  | `—` |
| `account_type` | TEXT | ✓ |  |  | `—` |
| `owner` | TEXT |  |  |  | `—` |
| `last_four` | TEXT |  |  |  | `—` |
| `currency` | TEXT | ✓ | `'USD'` |  | `—` |
| `is_active` | INTEGER | ✓ | `1` |  | `—` |
| `track_statements` | INTEGER | ✓ | `1` |  | `—` |
| `notes` | TEXT |  |  |  | `—` |
| `created_at` | DATETIME |  | `CURRENT_TIMESTAMP` |  | `—` |
| `updated_at` | DATETIME |  | `CURRENT_TIMESTAMP` |  | `—` |
| `account_number` | TEXT |  |  |  | `096_watcher_tables.sql` |
| `institution_contact_id` | INTEGER |  |  |  | `102_repair_schema.js` |
| `alias` | TEXT |  |  |  | `126_capture_and_finance_schema.js` |
| `credit_limit` | REAL |  |  |  | `126_capture_and_finance_schema.js` |
| `payment_due_date` | DATE |  |  |  | `126_capture_and_finance_schema.js` |
| `minimum_payment` | REAL |  |  |  | `126_capture_and_finance_schema.js` |
| `statement_balance` | REAL |  |  |  | `126_capture_and_finance_schema.js` |
| `statement_date` | DATE |  |  |  | `126_capture_and_finance_schema.js` |
| `apr` | REAL |  |  |  | `126_capture_and_finance_schema.js` |
| `promo_apr` | REAL |  |  |  | `126_capture_and_finance_schema.js` |
| `promo_end_date` | DATE |  |  |  | `126_capture_and_finance_schema.js` |
| `annual_fee` | REAL |  |  |  | `126_capture_and_finance_schema.js` |
| `annual_fee_renewal_date` | DATE |  |  |  | `126_capture_and_finance_schema.js` |
| `rewards_balance` | REAL |  |  |  | `126_capture_and_finance_schema.js` |
| `rewards_program` | TEXT |  |  |  | `126_capture_and_finance_schema.js` |

### `fsa_payments`

_Created in: `118_hsa_inbox_lp_fsa.sql`_

| Column | Type | NN | Default | PK | Added |
|---|---|---|---|---|---|
| `id` | INTEGER |  |  | ✓ | `118_hsa_inbox_lp_fsa.sql` |
| `date` | TEXT | ✓ |  |  | `—` |
| `vendor_contact_id` | INTEGER |  |  |  | `—` |
| `amount` | REAL | ✓ |  |  | `—` |
| `patient` | TEXT |  |  |  | `—` |
| `category` | TEXT |  |  |  | `—` |
| `fsa_eligible` | INTEGER |  | `0` |  | `—` |
| `reimbursed` | INTEGER |  | `0` |  | `—` |
| `reimbursement_date` | TEXT |  |  |  | `—` |
| `reimbursement_id` | INTEGER |  |  |  | `—` |
| `eob_claim_id` | INTEGER |  |  |  | `—` |
| `status` | TEXT |  | `'final'` |  | `—` |
| `inbox_attachment_id` | INTEGER |  |  |  | `—` |
| `notes` | TEXT |  |  |  | `—` |
| `created_at` | TEXT |  | `CURRENT_TIMESTAMP` |  | `—` |
| `raw_payload` | TEXT |  |  |  | `126_capture_and_finance_schema.js` |
| `source_filename` | TEXT |  |  |  | `126_capture_and_finance_schema.js` |
| `source_format` | TEXT |  |  |  | `126_capture_and_finance_schema.js` |

### `fsa_plan_info`

_Created in: `118_hsa_inbox_lp_fsa.sql`_

| Column | Type | NN | Default | PK | Added |
|---|---|---|---|---|---|
| `id` | INTEGER |  |  | ✓ | `118_hsa_inbox_lp_fsa.sql` |
| `year` | INTEGER | ✓ |  |  | `—` |
| `plan_type` | TEXT | ✓ | `'limited_purpose'` |  | `—` |
| `plan_name` | TEXT |  |  |  | `—` |
| `custodian` | TEXT |  |  |  | `—` |
| `annual_limit` | REAL |  |  |  | `—` |
| `contributions` | REAL |  | `0` |  | `—` |
| `employer_contribution` | REAL |  | `0` |  | `—` |
| `deadline_date` | TEXT |  |  |  | `—` |
| `carryover_amount` | REAL |  | `0` |  | `—` |
| `active` | INTEGER |  | `1` |  | `—` |
| `notes` | TEXT |  |  |  | `—` |
| `created_at` | TEXT |  | `CURRENT_TIMESTAMP` |  | `—` |
| `insurance_carrier` | TEXT |  |  |  | `133_fsa_plan_extend.js` |
| `individual_deductible` | REAL |  | `0` |  | `133_fsa_plan_extend.js` |
| `family_deductible` | REAL |  | `0` |  | `133_fsa_plan_extend.js` |
| `individual_oop_max` | REAL |  | `0` |  | `133_fsa_plan_extend.js` |
| `family_oop_max` | REAL |  | `0` |  | `133_fsa_plan_extend.js` |
| `irs_limit_self_only` | REAL |  | `0` |  | `133_fsa_plan_extend.js` |
| `irs_limit_family` | REAL |  | `0` |  | `133_fsa_plan_extend.js` |
| `plan_effective_date` | DATE |  |  |  | `133_fsa_plan_extend.js` |

### `fsa_reimbursement_items`

_Created in: `118_hsa_inbox_lp_fsa.sql`_

| Column | Type | NN | Default | PK | Added |
|---|---|---|---|---|---|
| `id` | INTEGER |  |  | ✓ | `118_hsa_inbox_lp_fsa.sql` |
| `reimbursement_id` | INTEGER | ✓ |  |  | `—` |
| `payment_id` | INTEGER | ✓ |  |  | `—` |
| `amount` | REAL | ✓ |  |  | `—` |

### `fsa_reimbursements`

_Created in: `118_hsa_inbox_lp_fsa.sql`_

| Column | Type | NN | Default | PK | Added |
|---|---|---|---|---|---|
| `id` | INTEGER |  |  | ✓ | `118_hsa_inbox_lp_fsa.sql` |
| `date` | TEXT | ✓ |  |  | `—` |
| `amount` | REAL | ✓ |  |  | `—` |
| `method` | TEXT |  |  |  | `—` |
| `notes` | TEXT |  |  |  | `—` |
| `created_at` | TEXT |  | `CURRENT_TIMESTAMP` |  | `—` |

### `gift_cards`

_Created in: `019_gift_cards.sql`_

| Column | Type | NN | Default | PK | Added |
|---|---|---|---|---|---|
| `id` | INTEGER |  |  | ✓ | `019_gift_cards.sql` |
| `retailer` | TEXT | ✓ |  |  | `—` |
| `initial_balance` | REAL | ✓ | `0` |  | `—` |
| `current_balance` | REAL | ✓ | `0` |  | `—` |
| `expiry_date` | DATE |  |  |  | `—` |
| `where_stored` | TEXT |  | `'Wallet'` |  | `—` |
| `notes` | TEXT |  |  |  | `—` |
| `is_active` | INTEGER | ✓ | `1` |  | `—` |
| `todo_id` | INTEGER |  |  |  | `—` |
| `created_at` | DATETIME |  | `CURRENT_TIMESTAMP` |  | `—` |
| `updated_at` | DATETIME |  | `CURRENT_TIMESTAMP` |  | `—` |
| `card_number` | TEXT |  |  |  | `033_gift_card_number.sql` |
| `card_pin` | TEXT |  |  |  | `033_gift_card_number.sql` |
| `in_google_pay` | INTEGER | ✓ | `0` |  | `034_gift_card_wallets.sql` |
| `in_samsung_pay` | INTEGER | ✓ | `0` |  | `034_gift_card_wallets.sql` |
| `in_apple_pay` | INTEGER | ✓ | `0` |  | `034_gift_card_wallets.sql` |

### `google_calendars`

_Created in: `027_google_calendar.sql`_

| Column | Type | NN | Default | PK | Added |
|---|---|---|---|---|---|
| `id` | TEXT |  |  | ✓ | `027_google_calendar.sql` |
| `summary` | TEXT |  |  |  | `—` |
| `description` | TEXT |  |  |  | `—` |
| `color_hex` | TEXT |  |  |  | `—` |
| `is_enabled` | INTEGER |  | `1` |  | `—` |
| `is_primary` | INTEGER |  | `0` |  | `—` |
| `synced_at` | DATETIME |  | `CURRENT_TIMESTAMP` |  | `—` |

### `holdings`

_Created in: `032_import_finance.sql`_

| Column | Type | NN | Default | PK | Added |
|---|---|---|---|---|---|
| `id` | INTEGER |  |  | ✓ | `032_import_finance.sql` |
| `account_id` | INTEGER | ✓ |  |  | `—` |
| `symbol` | TEXT | ✓ |  |  | `—` |
| `name` | TEXT |  |  |  | `—` |
| `asset_type` | TEXT |  | `'stock'` |  | `—` |
| `shares` | REAL | ✓ | `0` |  | `—` |
| `cost_basis` | REAL |  |  |  | `—` |
| `price` | REAL |  |  |  | `—` |
| `price_date` | DATE |  |  |  | `—` |
| `market_value` | REAL |  |  |  | `—` |
| `created_at` | DATETIME |  | `CURRENT_TIMESTAMP` |  | `—` |
| `updated_at` | DATETIME |  | `CURRENT_TIMESTAMP` |  | `—` |
| `total_cost_basis` | REAL |  |  |  | `061_holdings_expanded.sql` |
| `gain_loss_dollar` | REAL |  |  |  | `061_holdings_expanded.sql` |
| `gain_loss_pct` | REAL |  |  |  | `061_holdings_expanded.sql` |
| `day_change_dollar` | REAL |  |  |  | `061_holdings_expanded.sql` |
| `day_change_pct` | REAL |  |  |  | `061_holdings_expanded.sql` |
| `week52_low` | REAL |  |  |  | `061_holdings_expanded.sql` |
| `week52_high` | REAL |  |  |  | `061_holdings_expanded.sql` |
| `reinvest_dividends` | INTEGER |  |  |  | `061_holdings_expanded.sql` |
| `dividend_yield` | REAL |  |  |  | `099_recurring_investment.sql` |
| `last_dividend_date` | DATE |  |  |  | `099_recurring_investment.sql` |
| `annual_dividend` | REAL |  |  |  | `099_recurring_investment.sql` |
| `raw_payload` | TEXT |  |  |  | `126_capture_and_finance_schema.js` |
| `source_filename` | TEXT |  |  |  | `126_capture_and_finance_schema.js` |
| `source_format` | TEXT |  |  |  | `126_capture_and_finance_schema.js` |
| `as_of_date` | DATE |  |  |  | `—` |

### `holdings_v2`

_Created in: `126_finance_unify.js`_

| Column | Type | NN | Default | PK | Added |
|---|---|---|---|---|---|
| `id` | INTEGER |  |  | ✓ | `126_finance_unify.js` |
| `account_id` | INTEGER | ✓ |  |  | `—` |
| `symbol` | TEXT | ✓ |  |  | `—` |
| `name` | TEXT |  |  |  | `—` |
| `asset_type` | TEXT |  |  |  | `—` |
| `shares` | REAL |  |  |  | `—` |
| `price` | REAL |  |  |  | `—` |
| `market_value` | REAL |  |  |  | `—` |
| `total_cost_basis` | REAL |  |  |  | `—` |
| `gain_loss_dollar` | REAL |  |  |  | `—` |
| `gain_loss_pct` | REAL |  |  |  | `—` |
| `day_change_dollar` | REAL |  |  |  | `—` |
| `day_change_pct` | REAL |  |  |  | `—` |
| `week52_low` | REAL |  |  |  | `—` |
| `week52_high` | REAL |  |  |  | `—` |
| `reinvest_dividends` | INTEGER | ✓ | `0` |  | `—` |
| `as_of_date` | DATE |  |  |  | `—` |
| `updated_at` | DATETIME |  | `CURRENT_TIMESTAMP` |  | `—` |

### `hsa_otc`

_Created in: `002_hsa_medical.sql`_

| Column | Type | NN | Default | PK | Added |
|---|---|---|---|---|---|
| `id` | INTEGER |  |  | ✓ | `002_hsa_medical.sql` |
| `date` | DATE | ✓ |  |  | `—` |
| `item_name` | TEXT | ✓ |  |  | `—` |
| `otc_category` | TEXT |  | `'OTC Medicine'` |  | `—` |
| `store` | TEXT |  |  |  | `—` |
| `amount` | REAL |  | `0` |  | `—` |
| `quantity` | INTEGER |  | `1` |  | `—` |
| `hsa_eligible` | INTEGER |  | `1` |  | `—` |
| `receipt_saved` | INTEGER |  | `0` |  | `—` |
| `receipt_location` | TEXT |  |  |  | `—` |
| `reimbursed` | INTEGER |  | `0` |  | `—` |
| `reimbursement_date` | DATE |  |  |  | `—` |
| `notes` | TEXT |  |  |  | `—` |
| `created_at` | DATETIME |  | `CURRENT_TIMESTAMP` |  | `—` |
| `updated_at` | DATETIME |  | `CURRENT_TIMESTAMP` |  | `—` |
| `family_member_id` | INTEGER |  |  |  | `071_hsa_otc_family_member.sql` |
| `reimbursement_id` | INTEGER |  |  |  | `072_hsa_reimbursement_link.sql` |
| `store_contact_id` | INTEGER |  |  |  | `102_repair_schema.js` |

### `hsa_payment_links`

_Created in: `119_medications_slice1.js`_

| Column | Type | NN | Default | PK | Added |
|---|---|---|---|---|---|
| `id` | INTEGER |  |  | ✓ | `119_medications_slice1.js` |
| `hsa_payment_id` | INTEGER | ✓ |  |  | `—` |
| `entity_type` | TEXT | ✓ |  |  | `—` |
| `entity_id` | INTEGER | ✓ |  |  | `—` |
| `created_at` | DATETIME |  | `CURRENT_TIMESTAMP` |  | `—` |

### `hsa_payments`

_Created in: `002_hsa_medical.sql`_

| Column | Type | NN | Default | PK | Added |
|---|---|---|---|---|---|
| `id` | INTEGER |  |  | ✓ | `002_hsa_medical.sql` |
| `date` | DATE | ✓ |  |  | `—` |
| `patient` | TEXT | ✓ | `'Self'` |  | `—` |
| `provider` | TEXT |  |  |  | `—` |
| `category` | TEXT |  |  |  | `—` |
| `payment_type` | TEXT |  |  |  | `—` |
| `total_bill` | REAL |  | `0` |  | `—` |
| `insurance_paid` | REAL |  | `0` |  | `—` |
| `you_paid` | REAL |  | `0` |  | `—` |
| `hsa_eligible` | INTEGER |  | `1` |  | `—` |
| `receipt_saved` | INTEGER |  | `0` |  | `—` |
| `receipt_location` | TEXT |  |  |  | `—` |
| `reimbursed` | INTEGER |  | `0` |  | `—` |
| `reimbursement_date` | DATE |  |  |  | `—` |
| `notes` | TEXT |  |  |  | `—` |
| `created_at` | DATETIME |  | `CURRENT_TIMESTAMP` |  | `—` |
| `updated_at` | DATETIME |  | `CURRENT_TIMESTAMP` |  | `—` |
| `needs_review` | INTEGER | ✓ | `0` |  | `039_needs_review.sql` |
| `review_flagged_at` | DATETIME |  |  |  | `039_needs_review.sql` |
| `review_reason` | TEXT |  |  |  | `039_needs_review.sql` |
| `reimbursement_id` | INTEGER |  |  |  | `072_hsa_reimbursement_link.sql` |
| `family_member_id` | INTEGER |  |  |  | `083_small_gaps.sql` |
| `provider_contact_id` | INTEGER |  |  |  | `102_repair_schema.js` |
| `eob_claim_id` | INTEGER |  |  |  | `118_hsa_inbox_lp_fsa.sql` |
| `vendor_contact_id` | INTEGER |  |  |  | `118_hsa_inbox_lp_fsa.sql` |
| `mileage_miles` | REAL |  |  |  | `118_hsa_inbox_lp_fsa.sql` |
| `parent_payment_id` | INTEGER |  |  |  | `118_hsa_inbox_lp_fsa.sql` |
| `status` | TEXT |  | `'final'` |  | `118_hsa_inbox_lp_fsa.sql` |
| `inbox_attachment_id` | INTEGER |  |  |  | `118_hsa_inbox_lp_fsa.sql` |
| `raw_payload` | TEXT |  |  |  | `126_capture_and_finance_schema.js` |
| `source_filename` | TEXT |  |  |  | `126_capture_and_finance_schema.js` |
| `source_format` | TEXT |  |  |  | `126_capture_and_finance_schema.js` |

### `hsa_payments_new`

_Created in: `unknown`_

| Column | Type | NN | Default | PK | Added |
|---|---|---|---|---|---|
| `id` | INTEGER |  |  | ✓ | `unknown` |
| `date` | DATE | ✓ |  |  | `—` |
| `patient` | TEXT | ✓ | `'Self'` |  | `—` |
| `provider` | TEXT |  |  |  | `—` |
| `category` | TEXT |  |  |  | `—` |
| `payment_type` | TEXT |  |  |  | `—` |
| `total_bill` | REAL |  | `0` |  | `—` |
| `insurance_paid` | REAL |  | `0` |  | `—` |
| `you_paid` | REAL |  | `0` |  | `—` |
| `hsa_eligible` | INTEGER |  | `1` |  | `—` |
| `receipt_saved` | INTEGER |  | `0` |  | `—` |
| `receipt_location` | TEXT |  |  |  | `—` |
| `reimbursed` | INTEGER |  | `0` |  | `—` |
| `reimbursement_date` | DATE |  |  |  | `—` |
| `notes` | TEXT |  |  |  | `—` |
| `created_at` | DATETIME |  | `CURRENT_TIMESTAMP` |  | `—` |
| `updated_at` | DATETIME |  | `CURRENT_TIMESTAMP` |  | `—` |

### `hsa_plan_info_DEPRECATED_v167`

_Created in: `unknown`_

| Column | Type | NN | Default | PK | Added |
|---|---|---|---|---|---|
| `id` | INTEGER |  |  | ✓ | `unknown` |
| `plan_year` | INTEGER | ✓ |  |  | `—` |
| `plan_name` | TEXT |  |  |  | `—` |
| `insurance_carrier` | TEXT |  |  |  | `—` |
| `individual_deductible` | REAL |  | `0` |  | `—` |
| `family_deductible` | REAL |  | `0` |  | `—` |
| `individual_oop_max` | REAL |  | `0` |  | `—` |
| `family_oop_max` | REAL |  | `0` |  | `—` |
| `hsa_contribution_self` | REAL |  | `0` |  | `—` |
| `hsa_contribution_employer` | REAL |  | `0` |  | `—` |
| `irs_limit_self_only` | REAL |  | `0` |  | `—` |
| `irs_limit_family` | REAL |  | `0` |  | `—` |
| `plan_effective_date` | DATE |  |  |  | `—` |
| `notes` | TEXT |  |  |  | `—` |
| `created_at` | DATETIME |  | `CURRENT_TIMESTAMP` |  | `—` |
| `updated_at` | DATETIME |  | `CURRENT_TIMESTAMP` |  | `—` |
| `custodian` | TEXT |  |  |  | `—` |
| `active` | INTEGER |  | `1` |  | `—` |

### `hsa_reimbursement_items`

_Created in: `002_hsa_medical.sql`_

| Column | Type | NN | Default | PK | Added |
|---|---|---|---|---|---|
| `id` | INTEGER |  |  | ✓ | `002_hsa_medical.sql` |
| `reimbursement_id` | INTEGER | ✓ |  |  | `—` |
| `expense_type` | TEXT | ✓ |  |  | `—` |
| `expense_id` | INTEGER | ✓ |  |  | `—` |
| `amount` | REAL |  | `0` |  | `—` |

### `hsa_reimbursements`

_Created in: `002_hsa_medical.sql`_

| Column | Type | NN | Default | PK | Added |
|---|---|---|---|---|---|
| `id` | INTEGER |  |  | ✓ | `002_hsa_medical.sql` |
| `reimbursement_date` | DATE | ✓ |  |  | `—` |
| `total_amount` | REAL |  | `0` |  | `—` |
| `from_year` | INTEGER |  |  |  | `—` |
| `method` | TEXT |  | `'ACH'` |  | `—` |
| `notes` | TEXT |  |  |  | `—` |
| `created_at` | DATETIME |  | `CURRENT_TIMESTAMP` |  | `—` |

### `import_batches`

_Created in: `032_import_finance.sql`_

| Column | Type | NN | Default | PK | Added |
|---|---|---|---|---|---|
| `id` | INTEGER |  |  | ✓ | `032_import_finance.sql` |
| `account_id` | INTEGER | ✓ |  |  | `—` |
| `filename` | TEXT | ✓ |  |  | `—` |
| `statement_date` | DATE |  |  |  | `—` |
| `statement_month` | TEXT |  |  |  | `—` |
| `format` | TEXT |  |  |  | `—` |
| `rows_total` | INTEGER |  | `0` |  | `—` |
| `rows_inserted` | INTEGER |  | `0` |  | `—` |
| `rows_skipped` | INTEGER |  | `0` |  | `—` |
| `rows_flagged` | INTEGER |  | `0` |  | `—` |
| `status` | TEXT |  | `'pending'` |  | `—` |
| `error_message` | TEXT |  |  |  | `—` |
| `imported_at` | DATETIME |  | `CURRENT_TIMESTAMP` |  | `—` |
| `raw_headers` | TEXT |  |  |  | `126_capture_and_finance_schema.js` |
| `source_format` | TEXT |  |  |  | `126_capture_and_finance_schema.js` |
| `row_count` | INTEGER |  | `0` |  | `140_v171_schema_alignment.js` |

### `import_batches_v2`

_Created in: `126_finance_unify.js`_

| Column | Type | NN | Default | PK | Added |
|---|---|---|---|---|---|
| `id` | INTEGER |  |  | ✓ | `126_finance_unify.js` |
| `account_id` | INTEGER | ✓ |  |  | `—` |
| `filename` | TEXT | ✓ |  |  | `—` |
| `format` | TEXT |  |  |  | `—` |
| `row_count` | INTEGER | ✓ | `0` |  | `—` |
| `imported_at` | DATETIME |  | `CURRENT_TIMESTAMP` |  | `—` |
| `statement_date` | DATE |  |  |  | `—` |
| `notes` | TEXT |  |  |  | `—` |

### `import_category_rules`

_Created in: `046_import_category_rules.sql`_

| Column | Type | NN | Default | PK | Added |
|---|---|---|---|---|---|
| `id` | INTEGER |  |  | ✓ | `046_import_category_rules.sql` |
| `pattern` | TEXT | ✓ |  |  | `—` |
| `category` | TEXT | ✓ |  |  | `—` |
| `sort_order` | INTEGER | ✓ | `100` |  | `—` |
| `is_active` | INTEGER | ✓ | `1` |  | `—` |
| `created_at` | DATETIME |  | `CURRENT_TIMESTAMP` |  | `—` |
| `priority` | INTEGER |  | `100` |  | `098_undo_expiry_rules.sql` |
| `match_count` | INTEGER |  | `0` |  | `098_undo_expiry_rules.sql` |
| `last_matched` | DATETIME |  |  |  | `098_undo_expiry_rules.sql` |

### `imported_transactions`

_Created in: `032_import_finance.sql`_

| Column | Type | NN | Default | PK | Added |
|---|---|---|---|---|---|
| `id` | INTEGER |  |  | ✓ | `032_import_finance.sql` |
| `account_id` | INTEGER | ✓ |  |  | `—` |
| `batch_id` | INTEGER | ✓ |  |  | `—` |
| `txn_date` | DATE | ✓ |  |  | `—` |
| `post_date` | DATE |  |  |  | `—` |
| `description` | TEXT | ✓ |  |  | `—` |
| `amount` | REAL | ✓ |  |  | `—` |
| `balance` | REAL |  |  |  | `—` |
| `category` | TEXT |  |  |  | `—` |
| `txn_type` | TEXT |  | `'transaction'` |  | `—` |
| `is_transfer` | INTEGER | ✓ | `0` |  | `—` |
| `memo` | TEXT |  |  |  | `—` |
| `fingerprint` | TEXT | ✓ |  |  | `—` |
| `flagged` | INTEGER | ✓ | `0` |  | `—` |
| `created_at` | DATETIME |  | `CURRENT_TIMESTAMP` |  | `—` |
| `symbol` | TEXT |  |  |  | `073_imported_tx_trade_fields.sql` |
| `shares` | REAL |  |  |  | `073_imported_tx_trade_fields.sql` |
| `price_per_share` | REAL |  |  |  | `073_imported_tx_trade_fields.sql` |
| `raw_payload` | TEXT |  |  |  | `126_capture_and_finance_schema.js` |
| `raw_headers` | TEXT |  |  |  | `126_capture_and_finance_schema.js` |
| `source_filename` | TEXT |  |  |  | `126_capture_and_finance_schema.js` |
| `source_format` | TEXT |  |  |  | `126_capture_and_finance_schema.js` |
| `normalized_description` | TEXT |  |  |  | `126_capture_and_finance_schema.js` |
| `pending_or_posted` | TEXT |  |  |  | `126_capture_and_finance_schema.js` |
| `fx_currency` | TEXT |  |  |  | `126_capture_and_finance_schema.js` |
| `fx_amount` | REAL |  |  |  | `126_capture_and_finance_schema.js` |
| `fx_rate` | REAL |  |  |  | `126_capture_and_finance_schema.js` |

### `insurance_attachments`

_Created in: `110_insurance.sql`_

| Column | Type | NN | Default | PK | Added |
|---|---|---|---|---|---|
| `id` | INTEGER |  |  | ✓ | `110_insurance.sql` |
| `policy_id` | INTEGER | ✓ |  |  | `—` |
| `file_name` | TEXT | ✓ |  |  | `—` |
| `file_path` | TEXT | ✓ |  |  | `—` |
| `label` | TEXT |  |  |  | `—` |
| `uploaded_at` | TEXT |  | `CURRENT_TIMESTAMP` |  | `—` |

### `insurance_policies`

_Created in: `110_insurance.sql`_

| Column | Type | NN | Default | PK | Added |
|---|---|---|---|---|---|
| `id` | INTEGER |  |  | ✓ | `110_insurance.sql` |
| `policy_group_id` | INTEGER |  |  |  | `—` |
| `policy_type` | TEXT | ✓ |  |  | `—` |
| `provider_contact_id` | INTEGER |  |  |  | `—` |
| `agent_contact_id` | INTEGER |  |  |  | `—` |
| `policy_number` | TEXT |  |  |  | `—` |
| `coverage_start_date` | TEXT | ✓ |  |  | `—` |
| `coverage_end_date` | TEXT |  |  |  | `—` |
| `premium_amount` | REAL |  |  |  | `—` |
| `premium_frequency` | TEXT |  | `'annual'` |  | `—` |
| `deductible` | REAL |  |  |  | `—` |
| `coverage_limit` | REAL |  |  |  | `—` |
| `coverage_details` | TEXT |  |  |  | `—` |
| `vehicle_id` | INTEGER |  |  |  | `—` |
| `property_id` | INTEGER |  |  |  | `—` |
| `status` | TEXT |  | `'active'` |  | `—` |
| `alert_days_before` | INTEGER |  | `60` |  | `—` |
| `notes` | TEXT |  |  |  | `—` |
| `created_at` | TEXT |  | `CURRENT_TIMESTAMP` |  | `—` |
| `updated_at` | TEXT |  | `CURRENT_TIMESTAMP` |  | `—` |

### `insurance_policy_members`

_Created in: `110_insurance.sql`_

| Column | Type | NN | Default | PK | Added |
|---|---|---|---|---|---|
| `id` | INTEGER |  |  | ✓ | `110_insurance.sql` |
| `policy_id` | INTEGER | ✓ |  |  | `—` |
| `family_member_id` | INTEGER | ✓ |  |  | `—` |

### `irs_mileage_rates`

_Created in: `118_hsa_inbox_lp_fsa.sql`_

| Column | Type | NN | Default | PK | Added |
|---|---|---|---|---|---|
| `id` | INTEGER |  |  | ✓ | `118_hsa_inbox_lp_fsa.sql` |
| `year` | INTEGER | ✓ |  |  | `—` |
| `start_date` | TEXT | ✓ |  |  | `—` |
| `end_date` | TEXT |  |  |  | `—` |
| `rate_cents` | INTEGER | ✓ |  |  | `—` |
| `category` | TEXT | ✓ | `'medical'` |  | `—` |

### `item_events`

_Created in: `001_initial.sql`_

| Column | Type | NN | Default | PK | Added |
|---|---|---|---|---|---|
| `id` | INTEGER |  |  | ✓ | `001_initial.sql` |
| `item_id` | INTEGER | ✓ |  |  | `—` |
| `event_type` | TEXT | ✓ |  |  | `—` |
| `field_changed` | TEXT |  |  |  | `—` |
| `old_value` | TEXT |  |  |  | `—` |
| `new_value` | TEXT |  |  |  | `—` |
| `notes` | TEXT |  |  |  | `—` |
| `created_by` | TEXT |  |  |  | `—` |
| `created_at` | DATETIME |  | `CURRENT_TIMESTAMP` |  | `—` |

### `item_hw_details`

_Created in: `005_health_wellness.sql`_

| Column | Type | NN | Default | PK | Added |
|---|---|---|---|---|---|
| `id` | INTEGER |  |  | ✓ | `005_health_wellness.sql` |
| `item_id` | INTEGER | ✓ |  |  | `—` |
| `hw_subcategory` | TEXT | ✓ | `'OTC'` |  | `—` |
| `family_member_id` | INTEGER |  |  |  | `—` |
| `dosage_strength` | TEXT |  |  |  | `—` |
| `expiration_date` | DATE |  |  |  | `—` |
| `lot_number` | TEXT |  |  |  | `—` |
| `active_ingredients` | TEXT |  |  |  | `—` |
| `rx_number` | TEXT |  |  |  | `—` |
| `pharmacy_contact_id` | INTEGER |  |  |  | `—` |
| `prescribing_doctor_id` | INTEGER |  |  |  | `—` |
| `date_filled` | DATE |  |  |  | `—` |
| `refills_remaining` | INTEGER |  |  |  | `—` |
| `next_refill_date` | DATE |  |  |  | `—` |
| `created_at` | DATETIME |  | `CURRENT_TIMESTAMP` |  | `—` |
| `updated_at` | DATETIME |  | `CURRENT_TIMESTAMP` |  | `—` |

### `item_maintenance_log`

_Created in: `001_initial.sql`_

| Column | Type | NN | Default | PK | Added |
|---|---|---|---|---|---|
| `id` | INTEGER |  |  | ✓ | `001_initial.sql` |
| `item_id` | INTEGER | ✓ |  |  | `—` |
| `log_date` | DATE | ✓ |  |  | `—` |
| `maintenance_type` | TEXT | ✓ |  |  | `—` |
| `description` | TEXT | ✓ |  |  | `—` |
| `cost` | REAL |  |  |  | `—` |
| `provider` | TEXT |  |  |  | `—` |
| `next_due_date` | DATE |  |  |  | `—` |
| `notes` | TEXT |  |  |  | `—` |
| `created_at` | DATETIME |  | `CURRENT_TIMESTAMP` |  | `—` |
| `provider_contact_id` | INTEGER |  |  |  | `102_repair_schema.js` |

### `items`

_Created in: `001_initial.sql`_

| Column | Type | NN | Default | PK | Added |
|---|---|---|---|---|---|
| `id` | INTEGER |  |  | ✓ | `001_initial.sql` |
| `item_ref` | TEXT |  |  |  | `—` |
| `name` | TEXT | ✓ |  |  | `—` |
| `description` | TEXT |  |  |  | `—` |
| `category` | TEXT |  |  |  | `—` |
| `parent_type` | TEXT | ✓ |  |  | `—` |
| `parent_id` | INTEGER | ✓ |  |  | `—` |
| `is_container` | INTEGER |  | `0` |  | `—` |
| `quantity` | INTEGER |  | `1` |  | `—` |
| `is_active` | INTEGER |  | `1` |  | `—` |
| `is_archived` | INTEGER |  | `0` |  | `—` |
| `archived_at` | DATETIME |  |  |  | `—` |
| `archived_reason` | TEXT |  |  |  | `—` |
| `brand` | TEXT |  |  |  | `—` |
| `model_number` | TEXT |  |  |  | `—` |
| `serial_number` | TEXT |  |  |  | `—` |
| `manufacturer` | TEXT |  |  |  | `—` |
| `upc_barcode` | TEXT |  |  |  | `—` |
| `manufacturer_country` | TEXT |  |  |  | `—` |
| `manufacturer_support_phone` | TEXT |  |  |  | `—` |
| `manufacturer_support_url` | TEXT |  |  |  | `—` |
| `purchase_date` | DATE |  |  |  | `—` |
| `purchase_price` | REAL |  |  |  | `—` |
| `purchased_from` | TEXT |  |  |  | `—` |
| `store_name` | TEXT |  |  |  | `—` |
| `purchase_method` | TEXT |  |  |  | `—` |
| `order_number` | TEXT |  |  |  | `—` |
| `replacement_value` | REAL |  |  |  | `—` |
| `appraised_value` | REAL |  |  |  | `—` |
| `appraised_date` | DATE |  |  |  | `—` |
| `condition` | TEXT |  |  |  | `—` |
| `insured` | INTEGER |  | `0` |  | `—` |
| `insurance_policy` | TEXT |  |  |  | `—` |
| `insured_value` | REAL |  |  |  | `—` |
| `warranty_expires` | DATE |  |  |  | `—` |
| `lifetime_warranty` | INTEGER |  | `0` |  | `—` |
| `warranty_vendor` | TEXT |  |  |  | `—` |
| `warranty_phone` | TEXT |  |  |  | `—` |
| `warranty_claim_url` | TEXT |  |  |  | `—` |
| `warranty_notes` | TEXT |  |  |  | `—` |
| `sold_date` | DATE |  |  |  | `—` |
| `sold_price` | REAL |  |  |  | `—` |
| `sold_to` | TEXT |  |  |  | `—` |
| `qr_code_path` | TEXT |  |  |  | `—` |
| `notes` | TEXT |  |  |  | `—` |
| `created_at` | DATETIME |  | `CURRENT_TIMESTAMP` |  | `—` |
| `updated_at` | DATETIME |  | `CURRENT_TIMESTAMP` |  | `—` |
| `is_business` | INTEGER |  | `0` |  | `005_health_wellness.sql` |
| `needs_review` | INTEGER | ✓ | `0` |  | `039_needs_review.sql` |
| `review_flagged_at` | DATETIME |  |  |  | `039_needs_review.sql` |
| `review_reason` | TEXT |  |  |  | `039_needs_review.sql` |
| `warranty_vendor_contact_id` | INTEGER |  |  |  | `041_flatten_contacts.sql` |
| `size` | TEXT |  |  |  | `074_items_size.sql` |
| `family_member_id` | INTEGER |  |  |  | `081_family_member_linking.sql` |
| `wardrobe_owner_id` | INTEGER |  |  |  | `107_wardrobe.sql` |
| `wardrobe_sequence` | INTEGER |  |  |  | `107_wardrobe.sql` |
| `wardrobe_nickname` | TEXT |  |  |  | `107_wardrobe.sql` |
| `season_tags` | TEXT |  |  |  | `107_wardrobe.sql` |
| `occasion_tags` | TEXT |  |  |  | `107_wardrobe.sql` |
| `wardrobe_status` | TEXT |  | `'active'` |  | `107_wardrobe.sql` |
| `wardrobe_status_date` | TEXT |  |  |  | `107_wardrobe.sql` |
| `wardrobe_status_notes` | TEXT |  |  |  | `107_wardrobe.sql` |
| `sold_platform` | TEXT |  |  |  | `107_wardrobe.sql` |
| `donated_org_contact_id` | INTEGER |  |  |  | `107_wardrobe.sql` |
| `donated_fmv` | REAL |  |  |  | `107_wardrobe.sql` |
| `discarded_reason` | TEXT |  |  |  | `107_wardrobe.sql` |
| `warranty_expiry` | TEXT |  |  |  | `111_warranty_expansion.sql` |
| `warranty_provider_contact_id` | INTEGER |  |  |  | `111_warranty_expansion.sql` |
| `warranty_details` | TEXT |  |  |  | `111_warranty_expansion.sql` |
| `warranty_registration_no` | TEXT |  |  |  | `111_warranty_expansion.sql` |
| `wardrobe_color` | TEXT |  |  |  | `114_wardrobe_color.sql` |

### `items_fts`

_Created in: `unknown`_

| Column | Type | NN | Default | PK | Added |
|---|---|---|---|---|---|
| `name` | — |  |  |  | `—` |
| `description` | — |  |  |  | `—` |
| `brand` | — |  |  |  | `—` |
| `model_number` | — |  |  |  | `—` |
| `serial_number` | — |  |  |  | `—` |
| `manufacturer` | — |  |  |  | `—` |
| `upc_barcode` | — |  |  |  | `—` |
| `store_name` | — |  |  |  | `—` |
| `notes` | — |  |  |  | `—` |

### `items_fts_config`

_Created in: `unknown`_

| Column | Type | NN | Default | PK | Added |
|---|---|---|---|---|---|
| `k` | — | ✓ |  | ✓ | `—` |
| `v` | — |  |  |  | `—` |

### `items_fts_data`

_Created in: `unknown`_

| Column | Type | NN | Default | PK | Added |
|---|---|---|---|---|---|
| `id` | INTEGER |  |  | ✓ | `unknown` |
| `block` | BLOB |  |  |  | `—` |

### `items_fts_docsize`

_Created in: `unknown`_

| Column | Type | NN | Default | PK | Added |
|---|---|---|---|---|---|
| `id` | INTEGER |  |  | ✓ | `unknown` |
| `sz` | BLOB |  |  |  | `—` |

### `items_fts_idx`

_Created in: `unknown`_

| Column | Type | NN | Default | PK | Added |
|---|---|---|---|---|---|
| `segid` | — | ✓ |  | ✓ | `—` |
| `term` | — | ✓ |  | ✓ | `—` |
| `pgno` | — |  |  |  | `—` |

### `kid_activities`

_Created in: `028_kids.sql`_

| Column | Type | NN | Default | PK | Added |
|---|---|---|---|---|---|
| `id` | INTEGER |  |  | ✓ | `028_kids.sql` |
| `kid_id` | INTEGER | ✓ |  |  | `—` |
| `name` | TEXT | ✓ |  |  | `—` |
| `category` | TEXT |  | `'Other'` |  | `—` |
| `day_of_week` | TEXT |  |  |  | `—` |
| `start_time` | TEXT |  |  |  | `—` |
| `end_time` | TEXT |  |  |  | `—` |
| `location` | TEXT |  |  |  | `—` |
| `contact_id` | INTEGER |  |  |  | `—` |
| `cost_per_month` | REAL |  |  |  | `—` |
| `season` | TEXT |  |  |  | `—` |
| `start_date` | DATE |  |  |  | `—` |
| `end_date` | DATE |  |  |  | `—` |
| `notes` | TEXT |  |  |  | `—` |
| `is_active` | INTEGER | ✓ | `1` |  | `—` |
| `created_at` | DATETIME |  | `CURRENT_TIMESTAMP` |  | `—` |
| `needs_review` | INTEGER | ✓ | `0` |  | `039_needs_review.sql` |
| `review_flagged_at` | DATETIME |  |  |  | `039_needs_review.sql` |
| `review_reason` | TEXT |  |  |  | `039_needs_review.sql` |

### `kid_notes`

_Created in: `028_kids.sql`_

| Column | Type | NN | Default | PK | Added |
|---|---|---|---|---|---|
| `id` | INTEGER |  |  | ✓ | `028_kids.sql` |
| `kid_id` | INTEGER | ✓ |  |  | `—` |
| `note_date` | DATE | ✓ | `DATE('now')` |  | `—` |
| `category` | TEXT |  | `'General'` |  | `—` |
| `title` | TEXT |  |  |  | `—` |
| `body` | TEXT | ✓ |  |  | `—` |
| `created_at` | DATETIME |  | `CURRENT_TIMESTAMP` |  | `—` |
| `needs_review` | INTEGER | ✓ | `0` |  | `039_needs_review.sql` |
| `review_flagged_at` | DATETIME |  |  |  | `039_needs_review.sql` |
| `review_reason` | TEXT |  |  |  | `039_needs_review.sql` |

### `kids`

_Created in: `028_kids.sql`_

| Column | Type | NN | Default | PK | Added |
|---|---|---|---|---|---|
| `id` | INTEGER |  |  | ✓ | `028_kids.sql` |
| `family_member_id` | INTEGER |  |  |  | `—` |
| `display_name` | TEXT | ✓ |  |  | `—` |
| `date_of_birth` | DATE |  |  |  | `—` |
| `grade` | TEXT |  |  |  | `—` |
| `school_id` | INTEGER |  |  |  | `—` |
| `teacher_name` | TEXT |  |  |  | `—` |
| `homeroom` | TEXT |  |  |  | `—` |
| `allergies` | TEXT |  |  |  | `—` |
| `medications_note` | TEXT |  |  |  | `—` |
| `emergency_note` | TEXT |  |  |  | `—` |
| `photo_url` | TEXT |  |  |  | `—` |
| `notes` | TEXT |  |  |  | `—` |
| `is_active` | INTEGER | ✓ | `1` |  | `—` |
| `created_at` | DATETIME |  | `CURRENT_TIMESTAMP` |  | `—` |
| `updated_at` | DATETIME |  | `CURRENT_TIMESTAMP` |  | `—` |
| `needs_review` | INTEGER | ✓ | `0` |  | `039_needs_review.sql` |
| `review_flagged_at` | DATETIME |  |  |  | `039_needs_review.sql` |
| `review_reason` | TEXT |  |  |  | `039_needs_review.sql` |
| `teacher_contact_id` | INTEGER |  |  |  | `069_kids_teacher_contact.sql` |

### `locations`

_Created in: `001_initial.sql`_

| Column | Type | NN | Default | PK | Added |
|---|---|---|---|---|---|
| `id` | INTEGER |  |  | ✓ | `001_initial.sql` |
| `name` | TEXT | ✓ |  |  | `—` |
| `description` | TEXT |  |  |  | `—` |
| `location_type` | TEXT |  | `'room'` |  | `—` |
| `parent_location_id` | INTEGER |  |  |  | `—` |
| `address` | TEXT |  |  |  | `—` |
| `notes` | TEXT |  |  |  | `—` |
| `created_at` | DATETIME |  | `CURRENT_TIMESTAMP` |  | `—` |
| `updated_at` | DATETIME |  | `CURRENT_TIMESTAMP` |  | `—` |
| `address_street` | TEXT |  |  |  | `010_address_fields.sql` |
| `address_city` | TEXT |  |  |  | `010_address_fields.sql` |
| `address_state` | TEXT |  |  |  | `010_address_fields.sql` |
| `address_zip` | TEXT |  |  |  | `010_address_fields.sql` |

### `med_allergies`

_Created in: `131_medical_expansion.js`_

| Column | Type | NN | Default | PK | Added |
|---|---|---|---|---|---|
| `id` | INTEGER |  |  | ✓ | `131_medical_expansion.js` |
| `family_member_id` | INTEGER |  |  |  | `—` |
| `patient` | TEXT |  |  |  | `—` |
| `allergen` | TEXT | ✓ |  |  | `—` |
| `allergen_type` | TEXT |  |  |  | `—` |
| `reaction` | TEXT |  |  |  | `—` |
| `severity` | TEXT |  |  |  | `—` |
| `status` | TEXT |  | `'Active'` |  | `—` |
| `noted_date` | DATE |  |  |  | `—` |
| `source_system` | TEXT |  |  |  | `—` |
| `notes` | TEXT |  |  |  | `—` |
| `dedup_hash` | TEXT |  |  |  | `—` |
| `created_at` | DATETIME |  | `CURRENT_TIMESTAMP` |  | `—` |
| `updated_at` | DATETIME |  | `CURRENT_TIMESTAMP` |  | `—` |

### `med_condition_metrics`

_Created in: `124_card_schema_expansion.js`_

| Column | Type | NN | Default | PK | Added |
|---|---|---|---|---|---|
| `id` | INTEGER |  |  | ✓ | `124_card_schema_expansion.js` |
| `condition_id` | INTEGER | ✓ |  |  | `—` |
| `metric_name` | TEXT | ✓ |  |  | `—` |
| `value_numeric` | REAL |  |  |  | `—` |
| `value_text` | TEXT |  |  |  | `—` |
| `unit` | TEXT |  |  |  | `—` |
| `measured_on` | DATE | ✓ |  |  | `—` |
| `measured_at` | DATETIME |  | `CURRENT_TIMESTAMP` |  | `—` |
| `source` | TEXT |  | `'manual'` |  | `—` |
| `source_visit_id` | INTEGER |  |  |  | `—` |
| `notes` | TEXT |  |  |  | `—` |

### `med_conditions`

_Created in: `002_hsa_medical.sql`_

| Column | Type | NN | Default | PK | Added |
|---|---|---|---|---|---|
| `id` | INTEGER |  |  | ✓ | `002_hsa_medical.sql` |
| `patient` | TEXT | ✓ | `'Self'` |  | `—` |
| `condition_name` | TEXT | ✓ |  |  | `—` |
| `start_date` | DATE |  |  |  | `—` |
| `end_date` | DATE |  |  |  | `—` |
| `physician` | TEXT |  |  |  | `—` |
| `treatment_notes` | TEXT |  |  |  | `—` |
| `status` | TEXT |  | `'Active'` |  | `—` |
| `notes` | TEXT |  |  |  | `—` |
| `created_at` | DATETIME |  | `CURRENT_TIMESTAMP` |  | `—` |
| `updated_at` | DATETIME |  | `CURRENT_TIMESTAMP` |  | `—` |
| `needs_review` | INTEGER | ✓ | `0` |  | `039_needs_review.sql` |
| `review_flagged_at` | DATETIME |  |  |  | `039_needs_review.sql` |
| `review_reason` | TEXT |  |  |  | `039_needs_review.sql` |
| `physician_contact_id` | INTEGER |  |  |  | `041_flatten_contacts.sql` |
| `family_member_id` | INTEGER |  |  |  | `067_medical_family_member_ids.sql` |
| `body_system` | TEXT |  |  |  | `120_conditions_slice2.js` |
| `goal` | TEXT |  |  |  | `120_conditions_slice2.js` |
| `tracked_metric` | TEXT |  |  |  | `120_conditions_slice2.js` |
| `condition_state` | TEXT |  |  |  | `120_conditions_slice2.js` |
| `dedup_hash` | TEXT |  |  |  | `124_card_schema_expansion.js` |
| `icd10_code` | TEXT |  |  |  | `131_medical_expansion.js` |
| `severity` | TEXT |  |  |  | `131_medical_expansion.js` |
| `source_system` | TEXT |  |  |  | `131_medical_expansion.js` |

### `med_diagnostics`

_Created in: `131_medical_expansion.js`_

| Column | Type | NN | Default | PK | Added |
|---|---|---|---|---|---|
| `id` | INTEGER |  |  | ✓ | `131_medical_expansion.js` |
| `family_member_id` | INTEGER |  |  |  | `—` |
| `patient` | TEXT |  |  |  | `—` |
| `test_name` | TEXT | ✓ |  |  | `—` |
| `test_type` | TEXT |  |  |  | `—` |
| `test_date` | DATE |  |  |  | `—` |
| `status` | TEXT |  | `'final'` |  | `—` |
| `impression` | TEXT |  |  |  | `—` |
| `ordering_contact_id` | INTEGER |  |  |  | `—` |
| `performing_contact_id` | INTEGER |  |  |  | `—` |
| `facility` | TEXT |  |  |  | `—` |
| `source_system` | TEXT |  |  |  | `—` |
| `source_visit_id` | INTEGER |  |  |  | `—` |
| `notes` | TEXT |  |  |  | `—` |
| `dedup_hash` | TEXT |  |  |  | `—` |
| `created_at` | DATETIME |  | `CURRENT_TIMESTAMP` |  | `—` |
| `updated_at` | DATETIME |  | `CURRENT_TIMESTAMP` |  | `—` |

### `med_eob_balances`

_Created in: `057_eob_balances.sql`_

| Column | Type | NN | Default | PK | Added |
|---|---|---|---|---|---|
| `id` | INTEGER |  |  | ✓ | `057_eob_balances.sql` |
| `eob_id` | INTEGER | ✓ |  |  | `—` |
| `person` | TEXT | ✓ |  |  | `—` |
| `balance_type` | TEXT | ✓ |  |  | `—` |
| `annual_limit` | REAL |  |  |  | `—` |
| `amount_used` | REAL |  |  |  | `—` |
| `amount_remaining` | REAL |  |  |  | `—` |
| `raw_payload` | TEXT |  |  |  | `126_capture_and_finance_schema.js` |

### `med_eob_claims`

_Created in: `055_eob_claims.sql`_

| Column | Type | NN | Default | PK | Added |
|---|---|---|---|---|---|
| `id` | INTEGER |  |  | ✓ | `055_eob_claims.sql` |
| `eob_id` | INTEGER | ✓ |  |  | `—` |
| `patient` | TEXT | ✓ |  |  | `—` |
| `claim_id` | TEXT |  |  |  | `—` |
| `received_date` | DATE |  |  |  | `—` |
| `provider` | TEXT |  |  |  | `—` |
| `network_status` | TEXT |  |  |  | `—` |
| `send_date` | DATE |  |  |  | `—` |
| `amount_billed` | REAL |  |  |  | `—` |
| `member_rate` | REAL |  |  |  | `—` |
| `pending_not_payable` | REAL |  |  |  | `—` |
| `applied_to_deductible` | REAL |  |  |  | `—` |
| `copay` | REAL |  |  |  | `—` |
| `plan_paid` | REAL |  |  |  | `—` |
| `fund_paid` | REAL |  |  |  | `—` |
| `coinsurance` | REAL |  |  |  | `—` |
| `your_share` | REAL |  |  |  | `—` |
| `family_member_id` | INTEGER |  |  |  | `102_repair_schema.js` |
| `provider_contact_id` | INTEGER |  |  |  | `102_repair_schema.js` |
| `dedup_hash` | TEXT |  |  |  | `124_card_schema_expansion.js` |
| `raw_payload` | TEXT |  |  |  | `126_capture_and_finance_schema.js` |
| `provider_npi` | TEXT |  |  |  | `131_medical_expansion.js` |
| `diagnosis_codes` | TEXT |  |  |  | `131_medical_expansion.js` |
| `place_of_service` | TEXT |  |  |  | `131_medical_expansion.js` |
| `claim_status` | TEXT |  |  |  | `131_medical_expansion.js` |
| `denial_reason_codes` | TEXT |  |  |  | `131_medical_expansion.js` |
| `prior_auth_ref` | TEXT |  |  |  | `131_medical_expansion.js` |
| `appeal_deadline` | DATE |  |  |  | `131_medical_expansion.js` |

### `med_eob_services`

_Created in: `056_eob_services.sql`_

| Column | Type | NN | Default | PK | Added |
|---|---|---|---|---|---|
| `id` | INTEGER |  |  | ✓ | `056_eob_services.sql` |
| `claim_id` | INTEGER | ✓ |  |  | `—` |
| `service_description` | TEXT |  |  |  | `—` |
| `service_code` | TEXT |  |  |  | `—` |
| `service_date` | DATE |  |  |  | `—` |
| `amount_billed` | REAL |  |  |  | `—` |
| `member_rate` | REAL |  |  |  | `—` |
| `pending_not_payable` | REAL |  |  |  | `—` |
| `applied_to_deductible` | REAL |  |  |  | `—` |
| `copay` | REAL |  |  |  | `—` |
| `amount_remaining` | REAL |  |  |  | `—` |
| `plan_share` | REAL |  |  |  | `—` |
| `coinsurance` | REAL |  |  |  | `—` |
| `your_share` | REAL |  |  |  | `—` |
| `raw_payload` | TEXT |  |  |  | `126_capture_and_finance_schema.js` |
| `cpt_modifiers` | TEXT |  |  |  | `131_medical_expansion.js` |
| `hsa_eligible` | INTEGER |  | `1` |  | `131_medical_expansion.js` |

### `med_eob_statements`

_Created in: `054_eob_statements.sql`_

| Column | Type | NN | Default | PK | Added |
|---|---|---|---|---|---|
| `id` | INTEGER |  |  | ✓ | `054_eob_statements.sql` |
| `insurer` | TEXT | ✓ | `'MHBP'` |  | `—` |
| `plan_name` | TEXT |  |  |  | `—` |
| `group_name` | TEXT |  |  |  | `—` |
| `member_id` | TEXT |  |  |  | `—` |
| `group_number` | TEXT |  |  |  | `—` |
| `member_name` | TEXT |  |  |  | `—` |
| `statement_date` | DATE | ✓ |  |  | `—` |
| `period_start` | DATE |  |  |  | `—` |
| `period_end` | DATE |  |  |  | `—` |
| `amount_billed` | REAL |  |  |  | `—` |
| `allowed_amount` | REAL |  |  |  | `—` |
| `pending_not_payable` | REAL |  |  |  | `—` |
| `deductible_applied` | REAL |  |  |  | `—` |
| `copay_total` | REAL |  |  |  | `—` |
| `coinsurance_total` | REAL |  |  |  | `—` |
| `plan_paid_total` | REAL |  |  |  | `—` |
| `your_share_total` | REAL |  |  |  | `—` |
| `amount_saved` | REAL |  |  |  | `—` |
| `healthfund_applied` | REAL |  |  |  | `—` |
| `deductible_annual` | REAL |  |  |  | `—` |
| `deductible_used` | REAL |  |  |  | `—` |
| `deductible_remaining` | REAL |  |  |  | `—` |
| `oop_max_annual` | REAL |  |  |  | `—` |
| `oop_used` | REAL |  |  |  | `—` |
| `oop_remaining` | REAL |  |  |  | `—` |
| `healthfund_total` | REAL |  |  |  | `—` |
| `healthfund_used` | REAL |  |  |  | `—` |
| `healthfund_remaining` | REAL |  |  |  | `—` |
| `source_filename` | TEXT |  |  |  | `—` |
| `created_at` | DATETIME |  | `CURRENT_TIMESTAMP` |  | `—` |
| `insurer_contact_id` | INTEGER |  |  |  | `102_repair_schema.js` |
| `file_hash` | TEXT |  |  |  | `124_card_schema_expansion.js` |
| `dedup_hash` | TEXT |  |  |  | `124_card_schema_expansion.js` |
| `auto_imported` | INTEGER |  | `0` |  | `124_card_schema_expansion.js` |
| `raw_payload` | TEXT |  |  |  | `126_capture_and_finance_schema.js` |
| `source_format` | TEXT |  |  |  | `126_capture_and_finance_schema.js` |

### `med_immunizations`

_Created in: `144_med_immunizations.js`_

| Column | Type | NN | Default | PK | Added |
|---|---|---|---|---|---|
| `id` | INTEGER |  |  | ✓ | `144_med_immunizations.js` |
| `family_member_id` | INTEGER | ✓ |  |  | `—` |
| `vaccine_name` | TEXT | ✓ |  |  | `—` |
| `date_given` | DATE | ✓ |  |  | `—` |
| `dose_number` | INTEGER |  |  |  | `—` |
| `lot_number` | TEXT |  |  |  | `—` |
| `administered_by_contact_id` | INTEGER |  |  |  | `—` |
| `location_text` | TEXT |  |  |  | `—` |
| `next_due_date` | DATE |  |  |  | `—` |
| `notes` | TEXT |  |  |  | `—` |
| `created_at` | DATETIME |  | `CURRENT_TIMESTAMP` |  | `—` |
| `updated_at` | DATETIME |  | `CURRENT_TIMESTAMP` |  | `—` |

### `med_lab_results`

_Created in: `131_medical_expansion.js`_

| Column | Type | NN | Default | PK | Added |
|---|---|---|---|---|---|
| `id` | INTEGER |  |  | ✓ | `131_medical_expansion.js` |
| `family_member_id` | INTEGER |  |  |  | `—` |
| `patient` | TEXT |  |  |  | `—` |
| `panel_name` | TEXT |  |  |  | `—` |
| `test_name` | TEXT | ✓ |  |  | `—` |
| `test_date` | DATE | ✓ |  |  | `—` |
| `value_numeric` | REAL |  |  |  | `—` |
| `value_text` | TEXT |  |  |  | `—` |
| `unit` | TEXT |  |  |  | `—` |
| `reference_low` | REAL |  |  |  | `—` |
| `reference_high` | REAL |  |  |  | `—` |
| `reference_text` | TEXT |  |  |  | `—` |
| `flag` | TEXT |  |  |  | `—` |
| `ordering_contact_id` | INTEGER |  |  |  | `—` |
| `source_system` | TEXT |  |  |  | `—` |
| `source_visit_id` | INTEGER |  |  |  | `—` |
| `notes` | TEXT |  |  |  | `—` |
| `dedup_hash` | TEXT |  |  |  | `—` |
| `created_at` | DATETIME |  | `CURRENT_TIMESTAMP` |  | `—` |
| `updated_at` | DATETIME |  | `CURRENT_TIMESTAMP` |  | `—` |

### `med_medication_conditions`

_Created in: `119_medications_slice1.js`_

| Column | Type | NN | Default | PK | Added |
|---|---|---|---|---|---|
| `id` | INTEGER |  |  | ✓ | `119_medications_slice1.js` |
| `medication_id` | INTEGER | ✓ |  |  | `—` |
| `condition_id` | INTEGER | ✓ |  |  | `—` |
| `created_at` | DATETIME |  | `CURRENT_TIMESTAMP` |  | `—` |

### `med_medication_dose_changes`

_Created in: `124_card_schema_expansion.js`_

| Column | Type | NN | Default | PK | Added |
|---|---|---|---|---|---|
| `id` | INTEGER |  |  | ✓ | `124_card_schema_expansion.js` |
| `medication_id` | INTEGER | ✓ |  |  | `—` |
| `old_dosage` | TEXT |  |  |  | `—` |
| `new_dosage` | TEXT |  |  |  | `—` |
| `changed_at` | DATETIME |  | `CURRENT_TIMESTAMP` |  | `—` |
| `changed_by` | TEXT |  | `'manual'` |  | `—` |
| `notes` | TEXT |  |  |  | `—` |

### `med_medication_fills`

_Created in: `119_medications_slice1.js`_

| Column | Type | NN | Default | PK | Added |
|---|---|---|---|---|---|
| `id` | INTEGER |  |  | ✓ | `119_medications_slice1.js` |
| `medication_id` | INTEGER | ✓ |  |  | `—` |
| `fill_date` | DATE | ✓ |  |  | `—` |
| `days_supply` | INTEGER |  |  |  | `—` |
| `pharmacy_contact_id` | INTEGER |  |  |  | `—` |
| `cost` | REAL |  |  |  | `—` |
| `hsa_payment_id` | INTEGER |  |  |  | `—` |
| `notes` | TEXT |  |  |  | `—` |
| `created_at` | DATETIME |  | `CURRENT_TIMESTAMP` |  | `—` |
| `quantity` | REAL |  |  |  | `123_med_fill_enrichment.js` |
| `prescriber_contact_id` | INTEGER |  |  |  | `123_med_fill_enrichment.js` |
| `brand_dispensed` | TEXT |  |  |  | `123_med_fill_enrichment.js` |
| `you_paid_oop` | REAL |  |  |  | `123_med_fill_enrichment.js` |
| `insurance_covered` | REAL |  |  |  | `123_med_fill_enrichment.js` |
| `rx_number` | TEXT |  |  |  | `123_med_fill_enrichment.js` |
| `refill_seq` | INTEGER |  |  |  | `123_med_fill_enrichment.js` |

### `med_medications`

_Created in: `002_hsa_medical.sql`_

| Column | Type | NN | Default | PK | Added |
|---|---|---|---|---|---|
| `id` | INTEGER |  |  | ✓ | `002_hsa_medical.sql` |
| `patient` | TEXT | ✓ | `'Self'` |  | `—` |
| `name` | TEXT | ✓ |  |  | `—` |
| `dosage` | TEXT |  |  |  | `—` |
| `frequency` | TEXT |  |  |  | `—` |
| `physician` | TEXT |  |  |  | `—` |
| `start_date` | DATE |  |  |  | `—` |
| `end_date` | DATE |  |  |  | `—` |
| `status` | TEXT |  | `'Active'` |  | `—` |
| `purpose` | TEXT |  |  |  | `—` |
| `notes` | TEXT |  |  |  | `—` |
| `created_at` | DATETIME |  | `CURRENT_TIMESTAMP` |  | `—` |
| `updated_at` | DATETIME |  | `CURRENT_TIMESTAMP` |  | `—` |
| `needs_review` | INTEGER | ✓ | `0` |  | `039_needs_review.sql` |
| `review_flagged_at` | DATETIME |  |  |  | `039_needs_review.sql` |
| `review_reason` | TEXT |  |  |  | `039_needs_review.sql` |
| `physician_contact_id` | INTEGER |  |  |  | `041_flatten_contacts.sql` |
| `family_member_id` | INTEGER |  |  |  | `067_medical_family_member_ids.sql` |
| `pharmacy_contact_id` | INTEGER |  |  |  | `102_repair_schema.js` |
| `condition_id` | INTEGER |  |  |  | `102_repair_schema.js` |
| `rx_number` | TEXT |  |  |  | `102_repair_schema.js` |
| `refills_remaining` | INTEGER |  |  |  | `102_repair_schema.js` |
| `next_refill_date` | TEXT |  |  |  | `102_repair_schema.js` |
| `controlled_schedule` | TEXT |  |  |  | `102_repair_schema.js` |
| `brand_name` | TEXT |  |  |  | `119_medications_slice1.js` |
| `generic_name` | TEXT |  |  |  | `119_medications_slice1.js` |
| `form` | TEXT |  |  |  | `119_medications_slice1.js` |
| `drug_class` | TEXT |  |  |  | `119_medications_slice1.js` |
| `take_with_food` | INTEGER |  | `0` |  | `119_medications_slice1.js` |
| `time_of_day` | TEXT |  |  |  | `119_medications_slice1.js` |
| `interaction_warning` | TEXT |  |  |  | `119_medications_slice1.js` |
| `schedule_days` | TEXT |  |  |  | `121_medication_schedule.js` |
| `schedule_times` | TEXT |  |  |  | `121_medication_schedule.js` |
| `schedule_specific` | TEXT |  |  |  | `121_medication_schedule.js` |
| `cycle_days_on` | INTEGER |  |  |  | `121_medication_schedule.js` |
| `cycle_days_off` | INTEGER |  |  |  | `121_medication_schedule.js` |
| `prn_max_per_day` | INTEGER |  |  |  | `121_medication_schedule.js` |
| `generic_of` | TEXT |  |  |  | `122_med_generic_of.js` |
| `qty_unit` | TEXT |  | `'ct'` |  | `123_med_fill_enrichment.js` |
| `doses_per_day` | REAL |  |  |  | `123_med_fill_enrichment.js` |
| `dedup_hash` | TEXT |  |  |  | `124_card_schema_expansion.js` |
| `dose_unit` | TEXT |  |  |  | `131_medical_expansion.js` |
| `route` | TEXT |  |  |  | `131_medical_expansion.js` |
| `ndc` | TEXT |  |  |  | `131_medical_expansion.js` |
| `mail_order` | INTEGER |  | `0` |  | `131_medical_expansion.js` |
| `quantity_total_prescribed` | INTEGER |  |  |  | `131_medical_expansion.js` |
| `rx_date` | DATE |  |  |  | `131_medical_expansion.js` |
| `source_system` | TEXT |  |  |  | `131_medical_expansion.js` |

### `med_pending_review`

_Created in: `124_card_schema_expansion.js`_

| Column | Type | NN | Default | PK | Added |
|---|---|---|---|---|---|
| `id` | INTEGER |  |  | ✓ | `124_card_schema_expansion.js` |
| `source` | TEXT | ✓ |  |  | `—` |
| `entity_type` | TEXT | ✓ |  |  | `—` |
| `proposed_action` | TEXT | ✓ |  |  | `—` |
| `payload` | TEXT | ✓ |  |  | `—` |
| `existing_id` | INTEGER |  |  |  | `—` |
| `dedup_hash` | TEXT |  |  |  | `—` |
| `file_hash` | TEXT |  |  |  | `—` |
| `reason` | TEXT |  |  |  | `—` |
| `status` | TEXT |  | `'open'` |  | `—` |
| `created_at` | DATETIME |  | `CURRENT_TIMESTAMP` |  | `—` |
| `resolved_at` | DATETIME |  |  |  | `—` |
| `resolution` | TEXT |  |  |  | `—` |
| `todo_id` | INTEGER |  |  |  | `—` |

### `med_procedures`

_Created in: `145_med_procedures.js`_

| Column | Type | NN | Default | PK | Added |
|---|---|---|---|---|---|
| `id` | INTEGER |  |  | ✓ | `145_med_procedures.js` |
| `family_member_id` | INTEGER | ✓ |  |  | `—` |
| `procedure_name` | TEXT | ✓ |  |  | `—` |
| `procedure_date` | DATE |  |  |  | `—` |
| `provider_contact_id` | INTEGER |  |  |  | `—` |
| `facility_text` | TEXT |  |  |  | `—` |
| `procedure_type` | TEXT |  |  |  | `—` |
| `status` | TEXT |  | `'planned'` |  | `—` |
| `outcome_notes` | TEXT |  |  |  | `—` |
| `related_condition_id` | INTEGER |  |  |  | `—` |
| `created_at` | DATETIME |  | `CURRENT_TIMESTAMP` |  | `—` |
| `updated_at` | DATETIME |  | `CURRENT_TIMESTAMP` |  | `—` |

### `med_visit_conditions`

_Created in: `125_med_visit_conditions.js`_

| Column | Type | NN | Default | PK | Added |
|---|---|---|---|---|---|
| `visit_id` | INTEGER | ✓ |  | ✓ | `—` |
| `condition_id` | INTEGER | ✓ |  | ✓ | `—` |

### `med_visit_notes`

_Created in: `002_hsa_medical.sql`_

| Column | Type | NN | Default | PK | Added |
|---|---|---|---|---|---|
| `id` | INTEGER |  |  | ✓ | `002_hsa_medical.sql` |
| `patient` | TEXT | ✓ | `'Self'` |  | `—` |
| `physician_id` | INTEGER |  |  |  | `—` |
| `contact_id` | INTEGER |  |  |  | `—` |
| `visit_date` | DATE | ✓ |  |  | `—` |
| `questions` | TEXT |  |  |  | `—` |
| `doctors_response` | TEXT |  |  |  | `—` |
| `follow_up_needed` | INTEGER |  | `0` |  | `—` |
| `follow_up_date` | DATE |  |  |  | `—` |
| `notes` | TEXT |  |  |  | `—` |
| `created_at` | DATETIME |  | `CURRENT_TIMESTAMP` |  | `—` |
| `updated_at` | DATETIME |  | `CURRENT_TIMESTAMP` |  | `—` |
| `review_category` | TEXT |  |  |  | `063_review_category.sql` |
| `family_member_id` | INTEGER |  |  |  | `067_medical_family_member_ids.sql` |
| `round_trip_miles` | REAL |  |  |  | `118_hsa_inbox_lp_fsa.sql` |
| `start_time` | TEXT |  |  |  | `124_card_schema_expansion.js` |
| `duration_min` | INTEGER |  |  |  | `124_card_schema_expansion.js` |
| `visit_location` | TEXT |  |  |  | `124_card_schema_expansion.js` |
| `visit_type` | TEXT |  |  |  | `124_card_schema_expansion.js` |
| `physician_contact_id` | INTEGER |  |  |  | `124_card_schema_expansion.js` |
| `bp_systolic` | INTEGER |  |  |  | `124_card_schema_expansion.js` |
| `bp_diastolic` | INTEGER |  |  |  | `124_card_schema_expansion.js` |
| `weight_lb` | REAL |  |  |  | `124_card_schema_expansion.js` |
| `temperature_f` | REAL |  |  |  | `124_card_schema_expansion.js` |
| `heart_rate_bpm` | INTEGER |  |  |  | `124_card_schema_expansion.js` |
| `visit_cost_oop` | REAL |  |  |  | `124_card_schema_expansion.js` |
| `reason` | TEXT |  |  |  | `124_card_schema_expansion.js` |
| `dedup_hash` | TEXT |  |  |  | `124_card_schema_expansion.js` |

### `med_vitals_readings`

_Created in: `131_medical_expansion.js`_

| Column | Type | NN | Default | PK | Added |
|---|---|---|---|---|---|
| `id` | INTEGER |  |  | ✓ | `131_medical_expansion.js` |
| `family_member_id` | INTEGER |  |  |  | `—` |
| `patient` | TEXT |  |  |  | `—` |
| `measure_date` | DATE | ✓ |  |  | `—` |
| `measure_time` | TIME |  |  |  | `—` |
| `systolic_bp` | INTEGER |  |  |  | `—` |
| `diastolic_bp` | INTEGER |  |  |  | `—` |
| `heart_rate` | INTEGER |  |  |  | `—` |
| `weight_lbs` | REAL |  |  |  | `—` |
| `height_in` | REAL |  |  |  | `—` |
| `bmi` | REAL |  |  |  | `—` |
| `temperature_f` | REAL |  |  |  | `—` |
| `o2_sat` | INTEGER |  |  |  | `—` |
| `respiratory_rate` | INTEGER |  |  |  | `—` |
| `blood_glucose` | REAL |  |  |  | `—` |
| `source_system` | TEXT |  |  |  | `—` |
| `source_visit_id` | INTEGER |  |  |  | `—` |
| `notes` | TEXT |  |  |  | `—` |
| `dedup_hash` | TEXT |  |  |  | `—` |
| `created_at` | DATETIME |  | `CURRENT_TIMESTAMP` |  | `—` |
| `updated_at` | DATETIME |  | `CURRENT_TIMESTAMP` |  | `—` |

### `memory_members`

_Created in: `112_memories.sql`_

| Column | Type | NN | Default | PK | Added |
|---|---|---|---|---|---|
| `id` | INTEGER |  |  | ✓ | `112_memories.sql` |
| `log_id` | INTEGER | ✓ |  |  | `—` |
| `family_member_id` | INTEGER | ✓ |  |  | `—` |
| `created_at` | TEXT |  | `CURRENT_TIMESTAMP` |  | `—` |

### `net_worth_snapshots`

_Created in: `020_finance_accounts.sql`_

| Column | Type | NN | Default | PK | Added |
|---|---|---|---|---|---|
| `id` | INTEGER |  |  | ✓ | `020_finance_accounts.sql` |
| `snapshot_date` | DATE | ✓ |  |  | `—` |
| `total_assets` | REAL | ✓ | `0` |  | `—` |
| `total_liabilities` | REAL | ✓ | `0` |  | `—` |
| `net_worth` | REAL | ✓ | `0` |  | `—` |
| `notes` | TEXT |  |  |  | `—` |
| `created_at` | DATETIME |  | `CURRENT_TIMESTAMP` |  | `—` |

### `notifications`

_Created in: `011_notifications.sql`_

| Column | Type | NN | Default | PK | Added |
|---|---|---|---|---|---|
| `id` | INTEGER |  |  | ✓ | `011_notifications.sql` |
| `type` | TEXT | ✓ |  |  | `—` |
| `severity` | TEXT | ✓ | `'info'` |  | `—` |
| `title` | TEXT | ✓ |  |  | `—` |
| `body` | TEXT |  |  |  | `—` |
| `module` | TEXT |  |  |  | `—` |
| `entity_type` | TEXT |  |  |  | `—` |
| `entity_id` | TEXT |  |  |  | `—` |
| `is_read` | INTEGER | ✓ | `0` |  | `—` |
| `created_at` | TEXT | ✓ | `datetime('now')` |  | `—` |
| `expires_at` | TEXT |  |  |  | `—` |

### `pending_dismissals`

_Created in: `139_pending_items_subsystem.js`_

| Column | Type | NN | Default | PK | Added |
|---|---|---|---|---|---|
| `id` | INTEGER |  |  | ✓ | `139_pending_items_subsystem.js` |
| `transaction_id` | INTEGER | ✓ |  |  | `—` |
| `reason` | TEXT | ✓ |  |  | `—` |
| `hint` | TEXT |  |  |  | `—` |
| `snooze_until` | DATE |  |  |  | `—` |
| `dismissed_at` | DATETIME |  | `CURRENT_TIMESTAMP` |  | `—` |

### `perfume_layer_items`

_Created in: `108_perfume.sql`_

| Column | Type | NN | Default | PK | Added |
|---|---|---|---|---|---|
| `id` | INTEGER |  |  | ✓ | `108_perfume.sql` |
| `layer_id` | INTEGER | ✓ |  |  | `—` |
| `perfume_id` | INTEGER | ✓ |  |  | `—` |
| `application_order` | INTEGER |  | `1` |  | `—` |
| `amount_note` | TEXT |  |  |  | `—` |

### `perfume_layers`

_Created in: `108_perfume.sql`_

| Column | Type | NN | Default | PK | Added |
|---|---|---|---|---|---|
| `id` | INTEGER |  |  | ✓ | `108_perfume.sql` |
| `name` | TEXT | ✓ |  |  | `—` |
| `owner_family_member_id` | INTEGER |  |  |  | `—` |
| `season_tags` | TEXT |  |  |  | `—` |
| `occasion_tags` | TEXT |  |  |  | `—` |
| `notes` | TEXT |  |  |  | `—` |
| `created_at` | TEXT |  | `CURRENT_TIMESTAMP` |  | `—` |

### `perfume_outfit_pairs`

_Created in: `108_perfume.sql`_

| Column | Type | NN | Default | PK | Added |
|---|---|---|---|---|---|
| `id` | INTEGER |  |  | ✓ | `108_perfume.sql` |
| `outfit_id` | INTEGER |  |  |  | `—` |
| `perfume_id` | INTEGER |  |  |  | `—` |
| `layer_id` | INTEGER |  |  |  | `—` |
| `notes` | TEXT |  |  |  | `—` |

### `perfumes`

_Created in: `108_perfume.sql`_

| Column | Type | NN | Default | PK | Added |
|---|---|---|---|---|---|
| `id` | INTEGER |  |  | ✓ | `108_perfume.sql` |
| `name` | TEXT | ✓ |  |  | `—` |
| `brand` | TEXT |  |  |  | `—` |
| `concentration` | TEXT |  |  |  | `—` |
| `top_notes` | TEXT |  |  |  | `—` |
| `middle_notes` | TEXT |  |  |  | `—` |
| `base_notes` | TEXT |  |  |  | `—` |
| `scent_family` | TEXT |  |  |  | `—` |
| `season_tags` | TEXT |  |  |  | `—` |
| `occasion_tags` | TEXT |  |  |  | `—` |
| `gender` | TEXT |  |  |  | `—` |
| `size_ml` | REAL |  |  |  | `—` |
| `amount_level` | TEXT |  | `'Full'` |  | `—` |
| `purchase_price` | REAL |  |  |  | `—` |
| `purchase_date` | TEXT |  |  |  | `—` |
| `purchased_from` | TEXT |  |  |  | `—` |
| `owner_family_member_id` | INTEGER |  |  |  | `—` |
| `rating` | INTEGER |  |  |  | `—` |
| `notes` | TEXT |  |  |  | `—` |
| `status` | TEXT |  | `'active'` |  | `—` |
| `barcode` | TEXT |  |  |  | `—` |
| `fragella_id` | TEXT |  |  |  | `—` |
| `fragella_data` | TEXT |  |  |  | `—` |
| `fragella_cached_at` | TEXT |  |  |  | `—` |
| `created_at` | TEXT |  | `CURRENT_TIMESTAMP` |  | `—` |
| `updated_at` | TEXT |  | `CURRENT_TIMESTAMP` |  | `—` |

### `portfolio_snapshots`

_Created in: `099_recurring_investment.sql`_

| Column | Type | NN | Default | PK | Added |
|---|---|---|---|---|---|
| `id` | INTEGER |  |  | ✓ | `099_recurring_investment.sql` |
| `snapshot_date` | DATE | ✓ |  |  | `—` |
| `total_value` | REAL | ✓ |  |  | `—` |
| `total_cost` | REAL | ✓ |  |  | `—` |
| `total_gain` | REAL | ✓ |  |  | `—` |
| `total_gain_pct` | REAL | ✓ |  |  | `—` |
| `created_at` | DATETIME |  | `CURRENT_TIMESTAMP` |  | `—` |

### `properties`

_Created in: `024_property_vehicles.sql`_

| Column | Type | NN | Default | PK | Added |
|---|---|---|---|---|---|
| `id` | INTEGER |  |  | ✓ | `024_property_vehicles.sql` |
| `nickname` | TEXT | ✓ |  |  | `—` |
| `property_type` | TEXT | ✓ | `'Primary Residence'` |  | `—` |
| `address_street` | TEXT |  |  |  | `—` |
| `address_city` | TEXT |  |  |  | `—` |
| `address_state` | TEXT |  |  |  | `—` |
| `address_zip` | TEXT |  |  |  | `—` |
| `purchase_date` | DATE |  |  |  | `—` |
| `purchase_price` | REAL |  |  |  | `—` |
| `current_est_value` | REAL |  |  |  | `—` |
| `mortgage_balance` | REAL |  |  |  | `—` |
| `mortgage_lender` | TEXT |  |  |  | `—` |
| `mortgage_rate` | REAL |  |  |  | `—` |
| `mortgage_monthly` | REAL |  |  |  | `—` |
| `mortgage_end_date` | DATE |  |  |  | `—` |
| `hoa_monthly` | REAL |  |  |  | `—` |
| `property_tax_annual` | REAL |  |  |  | `—` |
| `insurance_annual` | REAL |  |  |  | `—` |
| `insurance_company` | TEXT |  |  |  | `—` |
| `insurance_policy` | TEXT |  |  |  | `—` |
| `notes` | TEXT |  |  |  | `—` |
| `is_active` | INTEGER | ✓ | `1` |  | `—` |
| `created_at` | DATETIME |  | `CURRENT_TIMESTAMP` |  | `—` |
| `updated_at` | DATETIME |  | `CURRENT_TIMESTAMP` |  | `—` |
| `needs_review` | INTEGER | ✓ | `0` |  | `039_needs_review.sql` |
| `review_flagged_at` | DATETIME |  |  |  | `039_needs_review.sql` |
| `review_reason` | TEXT |  |  |  | `039_needs_review.sql` |
| `mortgage_lender_contact_id` | INTEGER |  |  |  | `070_property_contact_refs.sql` |
| `insurance_contact_id` | INTEGER |  |  |  | `070_property_contact_refs.sql` |
| `family_member_id` | INTEGER |  |  |  | `081_family_member_linking.sql` |

### `property_maintenance`

_Created in: `035_property_maintenance.sql`_

| Column | Type | NN | Default | PK | Added |
|---|---|---|---|---|---|
| `id` | INTEGER |  |  | ✓ | `035_property_maintenance.sql` |
| `property_id` | INTEGER | ✓ |  |  | `—` |
| `maint_date` | DATE | ✓ |  |  | `—` |
| `category` | TEXT | ✓ |  |  | `—` |
| `description` | TEXT | ✓ |  |  | `—` |
| `cost` | REAL |  |  |  | `—` |
| `vendor` | TEXT |  |  |  | `—` |
| `warranty_expiry` | DATE |  |  |  | `—` |
| `next_due_date` | DATE |  |  |  | `—` |
| `notes` | TEXT |  |  |  | `—` |
| `created_at` | DATETIME |  | `CURRENT_TIMESTAMP` |  | `—` |
| `vendor_contact_id` | INTEGER |  |  |  | `041_flatten_contacts.sql` |
| `is_completed` | INTEGER | ✓ | `0` |  | `050_maintenance_completion.sql` |
| `completed_date` | DATE |  |  |  | `050_maintenance_completion.sql` |

### `record_family_members`

_Created in: `042_record_family_members.sql`_

| Column | Type | NN | Default | PK | Added |
|---|---|---|---|---|---|
| `id` | INTEGER |  |  | ✓ | `042_record_family_members.sql` |
| `entity_type` | TEXT | ✓ |  |  | `—` |
| `entity_id` | INTEGER | ✓ |  |  | `—` |
| `family_member_id` | INTEGER | ✓ |  |  | `—` |
| `created_at` | DATETIME |  | `CURRENT_TIMESTAMP` |  | `—` |

### `record_links`

_Created in: `126_capture_and_finance_schema.js`_

| Column | Type | NN | Default | PK | Added |
|---|---|---|---|---|---|
| `id` | INTEGER |  |  | ✓ | `126_capture_and_finance_schema.js` |
| `left_type` | TEXT | ✓ |  |  | `—` |
| `left_id` | INTEGER | ✓ |  |  | `—` |
| `right_type` | TEXT | ✓ |  |  | `—` |
| `right_id` | INTEGER | ✓ |  |  | `—` |
| `link_kind` | TEXT | ✓ | `'related_to'` |  | `—` |
| `notes` | TEXT |  |  |  | `—` |
| `created_at` | DATETIME |  | `CURRENT_TIMESTAMP` |  | `—` |
| `created_by` | TEXT |  | `'manual'` |  | `—` |
| `confidence` | TEXT | ✓ | `'high'` |  | `132_autolinker.js` |
| `needs_review` | INTEGER | ✓ | `0` |  | `132_autolinker.js` |
| `source` | TEXT |  |  |  | `132_autolinker.js` |
| `reviewed_at` | DATETIME |  |  |  | `132_autolinker.js` |

### `recurring_transactions`

_Created in: `099_recurring_investment.sql`_

| Column | Type | NN | Default | PK | Added |
|---|---|---|---|---|---|
| `id` | INTEGER |  |  | ✓ | `099_recurring_investment.sql` |
| `account_id` | INTEGER | ✓ |  |  | `—` |
| `description` | TEXT | ✓ |  |  | `—` |
| `amount` | REAL | ✓ |  |  | `—` |
| `category` | TEXT |  |  |  | `—` |
| `frequency` | TEXT | ✓ |  |  | `—` |
| `start_date` | DATE | ✓ |  |  | `—` |
| `end_date` | DATE |  |  |  | `—` |
| `next_date` | DATE | ✓ |  |  | `—` |
| `last_generated` | DATE |  |  |  | `—` |
| `notes` | TEXT |  |  |  | `—` |
| `is_active` | INTEGER | ✓ | `1` |  | `—` |
| `created_at` | DATETIME |  | `CURRENT_TIMESTAMP` |  | `—` |
| `updated_at` | DATETIME |  | `CURRENT_TIMESTAMP` |  | `—` |

### `resources`

_Created in: `007_resources.sql`_

| Column | Type | NN | Default | PK | Added |
|---|---|---|---|---|---|
| `id` | INTEGER |  |  | ✓ | `007_resources.sql` |
| `name` | TEXT | ✓ |  |  | `—` |
| `description` | TEXT |  |  |  | `—` |
| `url` | TEXT |  |  |  | `—` |
| `link_type` | TEXT |  | `'website'` |  | `—` |
| `category` | TEXT |  |  |  | `—` |
| `access_note` | TEXT |  |  |  | `—` |
| `is_favorite` | INTEGER |  | `0` |  | `—` |
| `sort_order` | INTEGER |  | `0` |  | `—` |
| `created_at` | DATETIME |  | `CURRENT_TIMESTAMP` |  | `—` |
| `updated_at` | DATETIME |  | `CURRENT_TIMESTAMP` |  | `—` |
| `needs_review` | INTEGER | ✓ | `0` |  | `039_needs_review.sql` |
| `review_flagged_at` | DATETIME |  |  |  | `039_needs_review.sql` |
| `review_reason` | TEXT |  |  |  | `039_needs_review.sql` |

### `subscription_members`

_Created in: `109b_subscriptions_repair.js`_

| Column | Type | NN | Default | PK | Added |
|---|---|---|---|---|---|
| `id` | INTEGER |  |  | ✓ | `109b_subscriptions_repair.js` |
| `subscription_id` | INTEGER | ✓ |  |  | `—` |
| `family_member_id` | INTEGER | ✓ |  |  | `—` |

### `subscriptions`

_Created in: `109b_subscriptions_repair.js`_

| Column | Type | NN | Default | PK | Added |
|---|---|---|---|---|---|
| `id` | INTEGER |  |  | ✓ | `109b_subscriptions_repair.js` |
| `name` | TEXT | ✓ |  |  | `—` |
| `category` | TEXT |  |  |  | `—` |
| `cost` | REAL |  |  |  | `—` |
| `billing_cycle` | TEXT |  | `'monthly'` |  | `—` |
| `next_billing_date` | TEXT |  |  |  | `—` |
| `auto_renew` | INTEGER |  | `1` |  | `—` |
| `finance_account_id` | INTEGER |  |  |  | `—` |
| `provider_contact_id` | INTEGER |  |  |  | `—` |
| `status` | TEXT |  | `'active'` |  | `—` |
| `notes` | TEXT |  |  |  | `—` |
| `created_at` | TEXT |  | `CURRENT_TIMESTAMP` |  | `—` |
| `updated_at` | TEXT |  | `CURRENT_TIMESTAMP` |  | `—` |
| `service_name` | TEXT |  |  |  | `140_v171_schema_alignment.js` |
| `monthly_cost` | REAL |  |  |  | `140_v171_schema_alignment.js` |
| `annual_cost` | REAL |  |  |  | `140_v171_schema_alignment.js` |
| `card_id` | INTEGER |  |  |  | `140_v171_schema_alignment.js` |
| `billing_day` | INTEGER |  |  |  | `140_v171_schema_alignment.js` |
| `auto_renews` | INTEGER |  | `1` |  | `140_v171_schema_alignment.js` |
| `cancel_url` | TEXT |  |  |  | `140_v171_schema_alignment.js` |
| `vendor_id` | INTEGER |  |  |  | `140_v171_schema_alignment.js` |
| `last_reviewed` | DATE |  |  |  | `140_v171_schema_alignment.js` |

### `taggables`

_Created in: `001_initial.sql`_

| Column | Type | NN | Default | PK | Added |
|---|---|---|---|---|---|
| `tag_id` | INTEGER | ✓ |  | ✓ | `—` |
| `entity_type` | TEXT | ✓ |  | ✓ | `—` |
| `entity_id` | INTEGER | ✓ |  | ✓ | `—` |

### `tags`

_Created in: `001_initial.sql`_

| Column | Type | NN | Default | PK | Added |
|---|---|---|---|---|---|
| `id` | INTEGER |  |  | ✓ | `001_initial.sql` |
| `name` | TEXT | ✓ |  |  | `—` |
| `color_hex` | TEXT |  | `'3b82f6'` |  | `—` |
| `icon` | TEXT |  |  |  | `—` |
| `created_at` | DATETIME |  | `CURRENT_TIMESTAMP` |  | `—` |

### `task_template_items`

_Created in: `102_repair_schema.js`_

| Column | Type | NN | Default | PK | Added |
|---|---|---|---|---|---|
| `id` | INTEGER |  |  | ✓ | `102_repair_schema.js` |
| `template_id` | INTEGER | ✓ |  |  | `—` |
| `title` | TEXT | ✓ |  |  | `—` |
| `notes` | TEXT |  |  |  | `—` |
| `priority` | TEXT |  | `'medium'` |  | `—` |
| `due_days_offset` | INTEGER |  | `0` |  | `—` |
| `sort_order` | INTEGER |  | `0` |  | `—` |

### `task_templates`

_Created in: `102_repair_schema.js`_

| Column | Type | NN | Default | PK | Added |
|---|---|---|---|---|---|
| `id` | INTEGER |  |  | ✓ | `102_repair_schema.js` |
| `name` | TEXT | ✓ |  |  | `—` |
| `description` | TEXT |  |  |  | `—` |
| `category` | TEXT |  |  |  | `—` |
| `is_active` | INTEGER | ✓ | `1` |  | `—` |
| `created_at` | DATETIME |  | `CURRENT_TIMESTAMP` |  | `—` |
| `updated_at` | DATETIME |  | `CURRENT_TIMESTAMP` |  | `—` |

### `today_snoozes`

_Created in: `116_today_snoozes.sql`_

| Column | Type | NN | Default | PK | Added |
|---|---|---|---|---|---|
| `id` | INTEGER |  |  | ✓ | `116_today_snoozes.sql` |
| `record_kind` | TEXT | ✓ |  |  | `—` |
| `record_id` | INTEGER | ✓ |  |  | `—` |
| `snoozed_until` | TEXT | ✓ |  |  | `—` |
| `created_at` | DATETIME |  | `CURRENT_TIMESTAMP` |  | `—` |

### `todos`

_Created in: `014_todos.sql`_

| Column | Type | NN | Default | PK | Added |
|---|---|---|---|---|---|
| `id` | INTEGER |  |  | ✓ | `014_todos.sql` |
| `title` | TEXT | ✓ |  |  | `—` |
| `notes` | TEXT |  |  |  | `—` |
| `due_date` | DATE |  |  |  | `—` |
| `priority` | TEXT | ✓ | `'medium'` |  | `—` |
| `category` | TEXT | ✓ | `'General'` |  | `—` |
| `status` | TEXT | ✓ | `'open'` |  | `—` |
| `completed_at` | DATETIME |  |  |  | `—` |
| `is_auto` | INTEGER | ✓ | `0` |  | `—` |
| `auto_type` | TEXT |  |  |  | `—` |
| `auto_source_type` | TEXT |  |  |  | `—` |
| `auto_source_id` | INTEGER |  |  |  | `—` |
| `reminder_date` | DATE |  |  |  | `—` |
| `reminder_sent` | INTEGER |  | `0` |  | `—` |
| `recurrence` | TEXT |  |  |  | `—` |
| `recurrence_days` | INTEGER |  |  |  | `—` |
| `needs_review` | INTEGER | ✓ | `0` |  | `039_needs_review.sql` |
| `review_flagged_at` | DATETIME |  |  |  | `039_needs_review.sql` |
| `review_reason` | TEXT |  |  |  | `039_needs_review.sql` |
| `review_category` | TEXT |  |  |  | `—` |
| `created_at` | DATETIME |  | `CURRENT_TIMESTAMP` |  | `—` |
| `updated_at` | DATETIME |  | `CURRENT_TIMESTAMP` |  | `—` |
| `google_task_id` | TEXT |  |  |  | `065_todos_google_task.sql` |
| `google_tasklist_id` | TEXT |  |  |  | `065_todos_google_task.sql` |

### `transactions`

_Created in: `126_finance_unify.js`_

| Column | Type | NN | Default | PK | Added |
|---|---|---|---|---|---|
| `id` | INTEGER |  |  | ✓ | `126_finance_unify.js` |
| `account_id` | INTEGER | ✓ |  |  | `—` |
| `date` | DATE | ✓ |  |  | `—` |
| `post_date` | DATE |  |  |  | `—` |
| `description` | TEXT | ✓ |  |  | `—` |
| `amount` | REAL | ✓ |  |  | `—` |
| `balance` | REAL |  |  |  | `—` |
| `category` | TEXT |  |  |  | `—` |
| `notes` | TEXT |  |  |  | `—` |
| `memo` | TEXT |  |  |  | `—` |
| `is_reconciled` | INTEGER | ✓ | `0` |  | `—` |
| `is_transfer` | INTEGER | ✓ | `0` |  | `—` |
| `source` | TEXT | ✓ | `'manual'` |  | `—` |
| `needs_review` | INTEGER | ✓ | `0` |  | `—` |
| `fingerprint` | TEXT |  |  |  | `—` |
| `flagged` | INTEGER | ✓ | `0` |  | `—` |
| `batch_id` | INTEGER |  |  |  | `—` |
| `txn_type` | TEXT |  |  |  | `—` |
| `created_at` | DATETIME |  | `CURRENT_TIMESTAMP` |  | `—` |

### `tx_link_rules`

_Created in: `139_pending_items_subsystem.js`_

| Column | Type | NN | Default | PK | Added |
|---|---|---|---|---|---|
| `id` | INTEGER |  |  | ✓ | `139_pending_items_subsystem.js` |
| `merchant_pattern` | TEXT | ✓ |  |  | `—` |
| `category` | TEXT |  |  |  | `—` |
| `right_type` | TEXT | ✓ |  |  | `—` |
| `right_id` | INTEGER | ✓ |  |  | `—` |
| `auto_apply` | INTEGER | ✓ | `1` |  | `—` |
| `is_active` | INTEGER | ✓ | `1` |  | `—` |
| `match_count` | INTEGER | ✓ | `0` |  | `—` |
| `last_matched_at` | DATETIME |  |  |  | `—` |
| `created_at` | DATETIME |  | `CURRENT_TIMESTAMP` |  | `—` |

### `vehicle_service`

_Created in: `024_property_vehicles.sql`_

| Column | Type | NN | Default | PK | Added |
|---|---|---|---|---|---|
| `id` | INTEGER |  |  | ✓ | `024_property_vehicles.sql` |
| `vehicle_id` | INTEGER | ✓ |  |  | `—` |
| `service_date` | DATE | ✓ |  |  | `—` |
| `service_type` | TEXT | ✓ |  |  | `—` |
| `mileage` | INTEGER |  |  |  | `—` |
| `cost` | REAL |  |  |  | `—` |
| `shop` | TEXT |  |  |  | `—` |
| `notes` | TEXT |  |  |  | `—` |
| `next_due_date` | DATE |  |  |  | `—` |
| `next_due_miles` | INTEGER |  |  |  | `—` |
| `created_at` | DATETIME |  | `CURRENT_TIMESTAMP` |  | `—` |
| `contact_id` | INTEGER |  |  |  | `064_vehicle_service_contact.sql` |

### `vehicles`

_Created in: `024_property_vehicles.sql`_

| Column | Type | NN | Default | PK | Added |
|---|---|---|---|---|---|
| `id` | INTEGER |  |  | ✓ | `024_property_vehicles.sql` |
| `nickname` | TEXT | ✓ |  |  | `—` |
| `year` | INTEGER |  |  |  | `—` |
| `make` | TEXT |  |  |  | `—` |
| `model` | TEXT |  |  |  | `—` |
| `trim` | TEXT |  |  |  | `—` |
| `color` | TEXT |  |  |  | `—` |
| `vin` | TEXT |  |  |  | `—` |
| `license_plate` | TEXT |  |  |  | `—` |
| `state` | TEXT |  |  |  | `—` |
| `purchase_date` | DATE |  |  |  | `—` |
| `purchase_price` | REAL |  |  |  | `—` |
| `current_est_value` | REAL |  |  |  | `—` |
| `odometer` | INTEGER |  |  |  | `—` |
| `odometer_date` | DATE |  |  |  | `—` |
| `loan_balance` | REAL |  |  |  | `—` |
| `loan_lender` | TEXT |  |  |  | `—` |
| `loan_rate` | REAL |  |  |  | `—` |
| `loan_monthly` | REAL |  |  |  | `—` |
| `loan_end_date` | DATE |  |  |  | `—` |
| `insurance_company` | TEXT |  |  |  | `—` |
| `insurance_policy` | TEXT |  |  |  | `—` |
| `insurance_annual` | REAL |  |  |  | `—` |
| `registration_expires` | DATE |  |  |  | `—` |
| `inspection_expires` | DATE |  |  |  | `—` |
| `notes` | TEXT |  |  |  | `—` |
| `is_active` | INTEGER | ✓ | `1` |  | `—` |
| `created_at` | DATETIME |  | `CURRENT_TIMESTAMP` |  | `—` |
| `updated_at` | DATETIME |  | `CURRENT_TIMESTAMP` |  | `—` |
| `needs_review` | INTEGER | ✓ | `0` |  | `039_needs_review.sql` |
| `review_flagged_at` | DATETIME |  |  |  | `039_needs_review.sql` |
| `review_reason` | TEXT |  |  |  | `039_needs_review.sql` |
| `lender_contact_id` | INTEGER |  |  |  | `070_property_contact_refs.sql` |
| `family_member_id` | INTEGER |  |  |  | `081_family_member_linking.sql` |

### `wardrobe_outfit_items`

_Created in: `107_wardrobe.sql`_

| Column | Type | NN | Default | PK | Added |
|---|---|---|---|---|---|
| `id` | INTEGER |  |  | ✓ | `107_wardrobe.sql` |
| `outfit_id` | INTEGER | ✓ |  |  | `—` |
| `item_id` | INTEGER | ✓ |  |  | `—` |
| `sort_order` | INTEGER |  | `0` |  | `—` |

### `wardrobe_outfits`

_Created in: `107_wardrobe.sql`_

| Column | Type | NN | Default | PK | Added |
|---|---|---|---|---|---|
| `id` | INTEGER |  |  | ✓ | `107_wardrobe.sql` |
| `name` | TEXT | ✓ |  |  | `—` |
| `family_member_id` | INTEGER |  |  |  | `—` |
| `occasion_tags` | TEXT |  |  |  | `—` |
| `season_tags` | TEXT |  |  |  | `—` |
| `notes` | TEXT |  |  |  | `—` |
| `created_at` | TEXT |  | `CURRENT_TIMESTAMP` |  | `—` |
| `updated_at` | TEXT |  | `CURRENT_TIMESTAMP` |  | `—` |

### `wardrobe_planner`

_Created in: `107_wardrobe.sql`_

| Column | Type | NN | Default | PK | Added |
|---|---|---|---|---|---|
| `id` | INTEGER |  |  | ✓ | `107_wardrobe.sql` |
| `plan_date` | TEXT | ✓ |  |  | `—` |
| `outfit_id` | INTEGER |  |  |  | `—` |
| `family_member_id` | INTEGER |  |  |  | `—` |
| `occasion` | TEXT |  |  |  | `—` |
| `notes` | TEXT |  |  |  | `—` |
| `created_at` | TEXT |  | `CURRENT_TIMESTAMP` |  | `—` |

### `wardrobe_wear_log`

_Created in: `107_wardrobe.sql`_

| Column | Type | NN | Default | PK | Added |
|---|---|---|---|---|---|
| `id` | INTEGER |  |  | ✓ | `107_wardrobe.sql` |
| `item_id` | INTEGER | ✓ |  |  | `—` |
| `outfit_id` | INTEGER |  |  |  | `—` |
| `worn_date` | TEXT | ✓ |  |  | `—` |
| `family_member_id` | INTEGER |  |  |  | `—` |
| `notes` | TEXT |  |  |  | `—` |
| `created_at` | TEXT |  | `CURRENT_TIMESTAMP` |  | `—` |

### `warranty_claims`

_Created in: `111_warranty_expansion.sql`_

| Column | Type | NN | Default | PK | Added |
|---|---|---|---|---|---|
| `id` | INTEGER |  |  | ✓ | `111_warranty_expansion.sql` |
| `item_id` | INTEGER | ✓ |  |  | `—` |
| `claim_date` | TEXT | ✓ |  |  | `—` |
| `description` | TEXT |  |  |  | `—` |
| `resolution` | TEXT |  |  |  | `—` |
| `resolved_date` | TEXT |  |  |  | `—` |
| `contact_id` | INTEGER |  |  |  | `—` |
| `notes` | TEXT |  |  |  | `—` |
| `created_at` | TEXT |  | `CURRENT_TIMESTAMP` |  | `—` |

### `watcher_file_registry`

_Created in: `096_watcher_tables.sql`_

| Column | Type | NN | Default | PK | Added |
|---|---|---|---|---|---|
| `id` | INTEGER |  |  | ✓ | `096_watcher_tables.sql` |
| `file_path` | TEXT | ✓ |  |  | `—` |
| `file_hash` | TEXT | ✓ |  |  | `—` |
| `file_size` | INTEGER |  |  |  | `—` |
| `file_modified` | DATETIME |  |  |  | `—` |
| `last_scanned` | DATETIME |  | `CURRENT_TIMESTAMP` |  | `—` |
| `import_status` | TEXT |  | `'pending'` |  | `—` |
| `import_batch_id` | INTEGER |  |  |  | `—` |
| `import_error` | TEXT |  |  |  | `—` |
| `imported_at` | DATETIME |  |  |  | `—` |

### `watcher_import_history`

_Created in: `096_watcher_tables.sql`_

| Column | Type | NN | Default | PK | Added |
|---|---|---|---|---|---|
| `id` | INTEGER |  |  | ✓ | `096_watcher_tables.sql` |
| `file_registry_id` | INTEGER |  |  |  | `—` |
| `rule_id` | INTEGER |  |  |  | `—` |
| `rule_name` | TEXT |  |  |  | `—` |
| `module` | TEXT | ✓ |  |  | `—` |
| `account_id` | INTEGER |  |  |  | `—` |
| `batch_id` | INTEGER |  |  |  | `—` |
| `transactions_imported` | INTEGER |  | `0` |  | `—` |
| `started_at` | DATETIME |  |  |  | `—` |
| `completed_at` | DATETIME |  |  |  | `—` |
| `status` | TEXT |  | `'pending'` |  | `—` |
| `error_message` | TEXT |  |  |  | `—` |
| `created_at` | DATETIME |  | `CURRENT_TIMESTAMP` |  | `—` |

### `webhook_logs`

_Created in: `101_system_ux.sql`_

| Column | Type | NN | Default | PK | Added |
|---|---|---|---|---|---|
| `id` | INTEGER |  |  | ✓ | `101_system_ux.sql` |
| `webhook_id` | INTEGER |  |  |  | `—` |
| `event_type` | TEXT | ✓ |  |  | `—` |
| `payload` | TEXT |  |  |  | `—` |
| `response_code` | INTEGER |  |  |  | `—` |
| `response_body` | TEXT |  |  |  | `—` |
| `duration_ms` | INTEGER |  |  |  | `—` |
| `created_at` | DATETIME |  | `CURRENT_TIMESTAMP` |  | `—` |

### `webhooks`

_Created in: `101_system_ux.sql`_

| Column | Type | NN | Default | PK | Added |
|---|---|---|---|---|---|
| `id` | INTEGER |  |  | ✓ | `101_system_ux.sql` |
| `name` | TEXT | ✓ |  |  | `—` |
| `url` | TEXT | ✓ |  |  | `—` |
| `event_type` | TEXT | ✓ |  |  | `—` |
| `enabled` | INTEGER |  | `1` |  | `—` |
| `secret` | TEXT |  |  |  | `—` |
| `last_triggered` | DATETIME |  |  |  | `—` |
| `last_status` | INTEGER |  |  |  | `—` |
| `failure_count` | INTEGER |  | `0` |  | `—` |
| `created_at` | DATETIME |  | `CURRENT_TIMESTAMP` |  | `—` |

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
