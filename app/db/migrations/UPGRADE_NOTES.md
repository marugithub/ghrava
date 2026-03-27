# Ghrava Upgrade Notes
**Purpose:** When a schema or data pattern changes, record the mapping here so
data can be manually updated or re-imported if needed.

---

## v202603.008 — Documents module rewrite

### What changed
The `documents` table previously stored tags as comma-separated text in a `tags TEXT` column.
Tags are now stored in the shared `tags + taggables` system (entity_type = `'document'`).

### Field mapping
| Old location | New location | Notes |
|---|---|---|
| `documents.tags` (TEXT, e.g. `"signed,important"`) | `taggables` (entity_type='document') | Migration 037 auto-migrates existing data |
| `documents.category` (TEXT, hardcoded options) | `documents.category` (TEXT, backed by `dropdown_options/document_category`) | No change to stored values |
| `documents.subcategory` (TEXT, free-form) | `documents.subcategory` (TEXT, backed by `dropdown_options/document_subcategory`) | No change to stored values — old free-form values still display correctly |

### Auto-migration
Migration 037 (`037_migrate_document_tags.sql`) runs on startup and moves any existing
comma-separated tags into the taggables table. The original `tags TEXT` column is kept
as a backup — it is no longer read by the application but the data remains.

### Manual review needed if
- You had custom tags on documents before v202603.008. Run this query to verify:
  ```sql
  SELECT d.title, d.tags as old_tags,
         GROUP_CONCAT(t.name) as new_tags
  FROM documents d
  LEFT JOIN taggables tb ON tb.entity_type='document' AND tb.entity_id=d.id
  LEFT JOIN tags t ON t.id=tb.tag_id
  WHERE d.tags IS NOT NULL
  GROUP BY d.id;
  ```
- If `old_tags` and `new_tags` match (allowing for order differences), migration succeeded.

---

## Template for future changes

```
## vYYYYMM.NNN — [Module] [what changed]

### What changed
[Plain English description]

### Field mapping
| Old field | New field | Notes |
|---|---|---|
| old.column | new.table/column | migration auto-handles / manual review needed |

### Auto-migration
[Migration number and what it does]

### Manual review needed if
[Conditions where user should verify data]
```

---

## v202603.097–101 — GH_SELECT standardization + unified data export/import

### What changed
Multiple modules converted from freetext inputs and hardcoded `<option>` lists
to `GH_SELECT` backed by `dropdown_options`. New unified export/import system.

### Migrations applied (all INSERT OR IGNORE — zero risk to existing data)

| Migration | What it adds |
|-----------|-------------|
| 044 | `resource_category` dropdown — 18 categories for Resources module |
| 045 | `finance_category` (22 values), `hsa_store` (10 values) |
| 046 | `import_category_rules` table + 50 keyword→category rules for bank import auto-categorization |
| 047 | `vehicle_service_type` (14 values), `hsa_otc_category` (9 values), `financial_institution` (14 values) |

### Fields converted to GH_SELECT

| Module | Field | Old | New list_key |
|--------|-------|-----|-------------|
| Finance transactions | category | freetext input | `finance_category` |
| HSA expense | category | hardcoded options | `hsa_category` |
| HSA OTC | store | freetext input | `hsa_store` |
| HSA OTC | otc_category | hardcoded options | `hsa_otc_category` |
| Resources | category | datalist freetext | `resource_category` |
| Property | vehicle service type | datalist freetext | `vehicle_service_type` |

### Existing data impact
None. GH_SELECT reads the field value on edit and pre-selects it. If an existing value
doesn't match any dropdown option, it still displays correctly but won't be pre-selected
on next edit (user must re-select). Values are stored as plain TEXT — no foreign key.

### New: Unified data export/import
- `GET /api/v1/data/export` — 20-sheet XLSX workbook covering all modules
- `GET /api/v1/data/template` — blank template with headers + Instructions sheet
- `POST /api/v1/data/import` — upload workbook, upserts by id/item_ref per sheet
- UI: `/data.html` — drag-drop import, per-sheet result counts, sheet reference grid

### New: Finance import auto-categorization
- `import_category_rules` table with 50+ seeded keyword patterns
- Rules apply on every `/import/confirm` — imported transactions get categories automatically
- Manual apply: `POST /api/v1/finance/category-rules/apply` — categorizes all uncategorized rows
- Inline category editing: click dotted category label on imported transaction row

---

## Template for future changes

```
## vYYYYMM.NNN — [Module] [what changed]

### What changed
[Plain English]

### Migrations
| Number | What it does | Data risk |

### Field mapping
| Old | New | Notes |

### Existing data impact
[None / describe what user should verify]
```
