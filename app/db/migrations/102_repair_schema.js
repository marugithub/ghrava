// Migration 102: Repair schema gaps from failed migrations 086 and 093
//
// Migration 086 failed on installs where med_medications already had rx_number
// (from migration 005), causing the entire transaction to roll back — so none
// of the other columns in 086 were ever added.
//
// Migration 093 failed on installs with older SQLite (<3.37) that don't support
// the VALUES(...) AS alias(...) syntax used in the seed INSERTs.
//
// This migration uses try/catch per ALTER TABLE so one existing column
// never blocks the rest. task_templates uses CREATE TABLE IF NOT EXISTS
// with plain INSERTs that work on any SQLite version.

module.exports = function repair(db) {
  // Helper: safely add a column, ignore if it already exists
  function addCol(table, column, type) {
    try {
      db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${type};`);
    } catch (e) {
      if (!e.message.includes('duplicate column')) throw e;
    }
  }

  // ── Columns from migration 086 ───────────────────────────────
  addCol('med_medications', 'family_member_id',    'INTEGER');
  addCol('med_medications', 'pharmacy_contact_id', 'INTEGER');
  addCol('med_medications', 'condition_id',        'INTEGER');
  addCol('med_medications', 'rx_number',           'TEXT');
  addCol('med_medications', 'refills_remaining',   'INTEGER');
  addCol('med_medications', 'next_refill_date',    'TEXT');
  addCol('med_medications', 'controlled_schedule', 'TEXT');

  addCol('med_conditions',     'family_member_id',   'INTEGER');
  addCol('med_visit_notes',    'family_member_id',   'INTEGER');
  addCol('med_eob_claims',     'family_member_id',   'INTEGER');
  addCol('med_eob_claims',     'provider_contact_id','INTEGER');
  addCol('med_eob_statements', 'insurer_contact_id', 'INTEGER');

  addCol('hsa_payments',         'provider_contact_id', 'INTEGER');
  addCol('hsa_otc',              'store_contact_id',    'INTEGER');
  addCol('kids',                 'teacher_contact_id',  'INTEGER');
  addCol('finance_accounts',     'institution_contact_id', 'INTEGER');
  addCol('financial_accounts',   'institution_contact_id', 'INTEGER');
  addCol('item_maintenance_log', 'provider_contact_id', 'INTEGER');

  // ── Tables from migration 093 ────────────────────────────────
  db.exec(`
    CREATE TABLE IF NOT EXISTS task_templates (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      name        TEXT NOT NULL,
      description TEXT,
      category    TEXT,
      is_active   INTEGER NOT NULL DEFAULT 1,
      created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at  DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS task_template_items (
      id               INTEGER PRIMARY KEY AUTOINCREMENT,
      template_id      INTEGER NOT NULL REFERENCES task_templates(id),
      title            TEXT NOT NULL,
      notes            TEXT,
      priority         TEXT DEFAULT 'medium',
      due_days_offset  INTEGER DEFAULT 0,
      sort_order       INTEGER DEFAULT 0
    );

    CREATE INDEX IF NOT EXISTS idx_tti_template ON task_template_items(template_id);
  `);

  // Seed templates only if table is empty
  const count = db.prepare('SELECT COUNT(*) as n FROM task_templates').get().n;
  if (count === 0) {
    const insertTemplate = db.prepare(
      'INSERT OR IGNORE INTO task_templates (name, description, category) VALUES (?,?,?)'
    );
    const insertItem = db.prepare(
      'INSERT OR IGNORE INTO task_template_items (template_id, title, priority, sort_order) VALUES (?,?,?,?)'
    );

    const seed = db.transaction(() => {
      insertTemplate.run('Monthly Finance Review', 'Monthly financial check-in tasks', 'Finance');
      insertTemplate.run('Annual Home Maintenance', 'Yearly home maintenance checklist', 'Home');
      insertTemplate.run('Back to School', 'Tasks for back to school season', 'Kids');
      insertTemplate.run('Vehicle Oil Change', 'Tasks around vehicle maintenance', 'Vehicles');
      insertTemplate.run('Tax Preparation', 'Annual tax prep checklist', 'Finance');

      const t = db.prepare('SELECT id FROM task_templates WHERE name=?');

      const finId = t.get('Monthly Finance Review').id;
      insertItem.run(finId, 'Review bank statements',                 'high',   1);
      insertItem.run(finId, 'Categorize uncategorized transactions',  'medium', 2);
      insertItem.run(finId, 'Review HSA receipts',                    'medium', 3);
      insertItem.run(finId, 'Check investment balances',              'low',    4);

      const homeId = t.get('Annual Home Maintenance').id;
      insertItem.run(homeId, 'Test smoke and CO detectors',           'high',   1);
      insertItem.run(homeId, 'Replace HVAC filters',                  'medium', 2);
      insertItem.run(homeId, 'Check water heater',                    'medium', 3);

      const schoolId = t.get('Back to School').id;
      insertItem.run(schoolId, 'Buy school supplies',                 'high',   1);
      insertItem.run(schoolId, 'Schedule physicals',                  'high',   2);
      insertItem.run(schoolId, 'Update emergency contacts at school', 'medium', 3);

      const carId = t.get('Vehicle Oil Change').id;
      insertItem.run(carId, 'Schedule oil change appointment',        'high',   1);
      insertItem.run(carId, 'Check tire pressure',                    'medium', 2);
      insertItem.run(carId, 'Top off fluids',                         'low',    3);

      const taxId = t.get('Tax Preparation').id;
      insertItem.run(taxId, 'Gather W-2s and 1099s',                  'high',   1);
      insertItem.run(taxId, 'Compile HSA contribution records',       'high',   2);
      insertItem.run(taxId, 'Review charitable donation receipts',    'medium', 3);
      insertItem.run(taxId, 'Review investment statements',           'medium', 4);
    });

    seed();
  }
};
