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
