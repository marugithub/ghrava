// @ts-nocheck
'use strict';
/**
 * shared/exportQueries.js
 * 
 * Each module's export SELECT query lives here, not in data/routes.js.
 * data/routes.js imports these and uses them in the SHEETS definitions.
 *
 * Queries may JOIN within a module's own tables (e.g. items + item_hw_details)
 * or lookup display names from reference tables (contacts, family_members, etc.)
 * — these are read-only lookups, not business logic leakage.
 */

const EXPORT_QUERIES = {

  items: `
    SELECT i.item_ref, i.name, i.description, i.category, i.brand, i.model_number,
           i.serial_number, i.upc_barcode, i.size, i.quantity, i.condition,
           l.name AS location_name, c.name AS container_name,
           i.purchase_date, i.purchase_price, i.store_name, i.purchase_method,
           i.order_number, i.warranty_expires, i.lifetime_warranty,
           hw.expiration_date, hw.drug_ndc, hw.net_weight, hw.dimensions,
           i.insured, i.insurance_policy, i.insured_value,
           i.notes, i.is_business, i.is_active, i.is_archived
    FROM items i
    LEFT JOIN locations l ON l.id = i.location_id
    LEFT JOIN containers c ON c.id = i.container_id
    LEFT JOIN item_hw_details hw ON hw.item_id = i.id
    WHERE i.is_active = 1
    ORDER BY l.name, i.name
  `,

  med_visit_notes: `
    SELECT n.id, n.patient, n.visit_date,
           n.contact_id AS physician_contact_id,
           co.name AS physician_name,
           n.visit_type, n.reason, n.diagnosis, n.treatment_plan,
           n.follow_up_needed, n.follow_up_date, n.notes, n.created_at
    FROM med_visit_notes n
    LEFT JOIN contacts co ON co.id = n.contact_id
    ORDER BY n.visit_date DESC
  `,

  documents: `
    SELECT d.id, d.title, d.category, d.subcategory, d.issuer, d.issue_date,
           d.expiry_date, d.document_number, d.notes,
           fm.display_name AS family_member_name
    FROM documents d
    LEFT JOIN family_members fm ON fm.id = d.family_member_id
    ORDER BY d.category, d.title
  `,

  vehicle_service: `
    SELECT vs.id, v.nickname AS vehicle_name, vs.vehicle_id,
           vs.service_type, vs.service_date, vs.mileage, vs.cost,
           vs.provider, vs.notes, vs.next_due_date, vs.next_due_mileage
    FROM vehicle_service vs
    JOIN vehicles v ON v.id = vs.vehicle_id
    ORDER BY vs.service_date DESC
  `,

  // v202604.156: repointed off compat views (finance_transactions,
  // finance_accounts, fin_import_batches) onto unified tables. The
  // export now includes both manual and imported transactions
  // (matches what's on the Finance Transactions tab in the UI).
  // `merchant` column was on the old finance_transactions schema —
  // unified table doesn't carry it; falls back to NULL via SELECT.
  finance_transactions: `
    SELECT t.id,
           COALESCE(a.alias, a.name) AS account_name,
           t.account_id,
           t.date, t.description, t.amount, t.category,
           NULL AS merchant,
           t.notes, t.is_transfer, t.created_at
    FROM transactions t
    JOIN accounts a ON a.id = t.account_id
    ORDER BY t.date DESC
  `,

  kids: `
    SELECT k.id, k.display_name, k.date_of_birth, k.grade,
           c.name AS school_name, k.school_id,
           k.teacher_name, k.homeroom,
           k.allergies, k.medications_note, k.emergency_note, k.notes
    FROM kids k
    LEFT JOIN contacts c ON c.id = k.school_id
    WHERE k.is_active = 1
    ORDER BY k.display_name
  `,

  property_maintenance: `
    SELECT pm.id, p.nickname AS property_name, pm.property_id,
           pm.category, pm.description, pm.completed_date, pm.next_due_date,
           pm.cost, pm.contractor, pm.notes
    FROM property_maintenance pm
    JOIN properties p ON p.id = pm.property_id
    ORDER BY pm.next_due_date DESC NULLS LAST
  `,

  kid_activities: `
    SELECT ka.id, k.display_name AS kid_name, ka.kid_id,
           ka.name, ka.category, ka.day_of_week, ka.start_time, ka.end_time,
           ka.location, ka.season, ka.cost_per_month, ka.notes, ka.is_active
    FROM kid_activities ka
    JOIN kids k ON k.id = ka.kid_id
    ORDER BY k.display_name, ka.name
  `,

  kid_notes: `
    SELECT kn.id, k.display_name AS kid_name, kn.kid_id,
           kn.note_date, kn.category, kn.title, kn.body, kn.created_at
    FROM kid_notes kn
    JOIN kids k ON k.id = kn.kid_id
    ORDER BY kn.note_date DESC
  `,

  daily_log: `
    SELECT id, log_date, category, entry_text, mood, energy_level,
           follow_up_needed, follow_up_date, tags, created_at
    FROM daily_log
    ORDER BY log_date DESC
  `,

  // v.156: unified import_batches has no rows_imported/rows_skipped
  // columns — it has row_count. Compat view fin_import_batches
  // synthesized the old shape; here we just drop those columns
  // since exporters can compute from the actual row counts via
  // the transactions table if needed.
  import_batches: `
    SELECT ib.id,
           COALESCE(a.alias, a.name) AS account_name,
           ib.account_id,
           ib.filename, ib.imported_at,
           ib.row_count AS rows_imported,
           0 AS rows_skipped,
           ib.notes
    FROM import_batches ib
    LEFT JOIN accounts a ON a.id = ib.account_id
    ORDER BY ib.imported_at DESC
  `,

};

module.exports = { EXPORT_QUERIES };
