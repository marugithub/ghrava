// Migration 113: Replace ON DELETE CASCADE with safer RESTRICT/SET NULL
// for tables that hold IRREPLACEABLE history/log data.
//
// SQLite cannot ALTER FK constraints, so each affected table must be:
//   1. Renamed to *_old
//   2. Recreated with the new FK policy
//   3. Data copied over
//   4. Indexes recreated
//   5. Old table dropped
//
// All work happens inside a transaction — if any step fails, nothing changes.
//
// Policy summary (per locked plan):
//   items                 → RESTRICT  (item_events, item_maintenance_log, item_hw_details)
//   vehicles              → RESTRICT  (vehicle_service)
//   finance_accounts      → RESTRICT  (finance_transactions)
//   financial_accounts    → RESTRICT  (imported_transactions, holdings, account_snapshots)
//   kids                  → SET NULL  (kid_activities, kid_notes)
//
// Junction/extension tables KEEP CASCADE (handled by their own migrations):
//   contacts → contacts_employer/medical/school/home_service/contractor/financial
//   tags → taggables
//   custom_field_defs → custom_fields
//   med_eob_statements → med_eob_claims/balances
//   med_eob_claims → med_eob_services
//   hsa_reimbursements → hsa_reimbursement_items
//   import_batches → imported_transactions (junction-like)

module.exports = function cascadeFixMigration(db) {
  // Helper: idempotent table recreation with new schema
  // Pre-check: only rebuild if the existing table actually has CASCADE.
  // This makes the migration safe to re-run if it partially succeeded.
  function needsRebuild(tableName, parentTable) {
    try {
      const fkList = db.prepare(`PRAGMA foreign_key_list(${tableName})`).all();
      const fk = fkList.find(f => f.table === parentTable);
      if (!fk) return false;  // table or FK doesn't exist — nothing to do
      return fk.on_delete === 'CASCADE';
    } catch (e) {
      // Table might not exist — skip
      return false;
    }
  }

  function rebuild(tableName, createSql, indexSqls, parentTable) {
    if (!needsRebuild(tableName, parentTable)) {
      console.log(`  113: ${tableName} already migrated or absent — skipping`);
      return;
    }
    console.log(`  113: rebuilding ${tableName}`);

    // Get existing column list (in DB order) so we can copy correctly even if
    // ALTER TABLE has added columns since the original CREATE
    const cols = db.prepare(`PRAGMA table_info(${tableName})`).all().map(r => r.name);
    const colList = cols.join(', ');

    db.exec(`ALTER TABLE ${tableName} RENAME TO ${tableName}_old_113;`);
    db.exec(createSql);

    // Copy data — only columns that exist in BOTH old and new tables (safety)
    const newCols = db.prepare(`PRAGMA table_info(${tableName})`).all().map(r => r.name);
    const sharedCols = cols.filter(c => newCols.includes(c)).join(', ');
    db.exec(`INSERT INTO ${tableName} (${sharedCols}) SELECT ${sharedCols} FROM ${tableName}_old_113;`);

    // Recreate indexes
    for (const idx of indexSqls) db.exec(idx);

    // Drop old
    db.exec(`DROP TABLE ${tableName}_old_113;`);
  }

  // ── items → RESTRICT (history is irreplaceable) ─────────────
  rebuild('item_events', `
    CREATE TABLE item_events (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      item_id       INTEGER NOT NULL REFERENCES items(id) ON DELETE RESTRICT,
      event_type    TEXT NOT NULL CHECK(event_type IN (
        'created','moved','field_updated','photo_added','photo_removed',
        'document_added','archived','unarchived','sold','quantity_changed',
        'maintenance_logged','tag_added','tag_removed','condition_changed'
      )),
      field_changed TEXT,
      old_value     TEXT,
      new_value     TEXT,
      notes         TEXT,
      created_by    TEXT,
      created_at    DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `, [
    `CREATE INDEX IF NOT EXISTS idx_item_events_item ON item_events(item_id, created_at DESC);`
  ], 'items');

  rebuild('item_maintenance_log', `
    CREATE TABLE item_maintenance_log (
      id                  INTEGER PRIMARY KEY AUTOINCREMENT,
      item_id             INTEGER NOT NULL REFERENCES items(id) ON DELETE RESTRICT,
      log_date            DATE NOT NULL,
      maintenance_type    TEXT NOT NULL CHECK(maintenance_type IN
        ('repair','service','inspection','cleaning','upgrade','replacement','other')),
      description         TEXT NOT NULL,
      cost                REAL,
      provider            TEXT,
      next_due_date       DATE,
      notes               TEXT,
      created_at          DATETIME DEFAULT CURRENT_TIMESTAMP,
      provider_contact_id INTEGER REFERENCES contacts(id) ON DELETE SET NULL
    );
  `, [
    `CREATE INDEX IF NOT EXISTS idx_maintenance_item ON item_maintenance_log(item_id);`
  ], 'items');

  rebuild('item_hw_details', `
    CREATE TABLE item_hw_details (
      id                    INTEGER PRIMARY KEY AUTOINCREMENT,
      item_id               INTEGER NOT NULL UNIQUE REFERENCES items(id) ON DELETE RESTRICT,
      hw_subcategory        TEXT NOT NULL DEFAULT 'OTC',
      family_member_id      INTEGER REFERENCES family_members(id) ON DELETE SET NULL,
      dosage_strength       TEXT,
      expiration_date       DATE,
      lot_number            TEXT,
      active_ingredients    TEXT,
      rx_number             TEXT,
      pharmacy_contact_id   INTEGER REFERENCES contacts(id) ON DELETE SET NULL,
      prescribing_doctor_id INTEGER REFERENCES contacts(id) ON DELETE SET NULL,
      date_filled           DATE,
      refills_remaining     INTEGER,
      next_refill_date      DATE,
      created_at            DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at            DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `, [
    `CREATE INDEX IF NOT EXISTS idx_hw_item        ON item_hw_details(item_id);`,
    `CREATE INDEX IF NOT EXISTS idx_hw_family      ON item_hw_details(family_member_id);`,
    `CREATE INDEX IF NOT EXISTS idx_hw_subcategory ON item_hw_details(hw_subcategory);`,
    `CREATE INDEX IF NOT EXISTS idx_hw_expiry      ON item_hw_details(expiration_date);`
  ], 'items');

  // ── vehicles → RESTRICT ─────────────────────────────────────
  rebuild('vehicle_service', `
    CREATE TABLE vehicle_service (
      id                INTEGER PRIMARY KEY AUTOINCREMENT,
      vehicle_id        INTEGER NOT NULL REFERENCES vehicles(id) ON DELETE RESTRICT,
      service_date      DATE    NOT NULL,
      service_type      TEXT    NOT NULL,
      mileage           INTEGER,
      cost              REAL,
      shop              TEXT,
      notes             TEXT,
      next_due_date     DATE,
      next_due_miles    INTEGER,
      created_at        DATETIME DEFAULT CURRENT_TIMESTAMP,
      contact_id        INTEGER REFERENCES contacts(id) ON DELETE SET NULL
    );
  `, [
    `CREATE INDEX IF NOT EXISTS idx_vehicle_service_vehicle ON vehicle_service(vehicle_id, service_date DESC);`,
    `CREATE INDEX IF NOT EXISTS idx_vehicle_service_next   ON vehicle_service(next_due_date);`
  ], 'vehicles');

  // ── finance_accounts → RESTRICT ─────────────────────────────
  rebuild('finance_transactions', `
    CREATE TABLE finance_transactions (
      id                INTEGER PRIMARY KEY AUTOINCREMENT,
      account_id        INTEGER NOT NULL REFERENCES finance_accounts(id) ON DELETE RESTRICT,
      date              DATE    NOT NULL,
      description       TEXT    NOT NULL,
      amount            REAL    NOT NULL,
      category          TEXT,
      notes             TEXT,
      is_reconciled     INTEGER NOT NULL DEFAULT 0,
      created_at        DATETIME DEFAULT CURRENT_TIMESTAMP,
      batch_id          INTEGER
    );
  `, [
    `CREATE INDEX IF NOT EXISTS idx_fin_tx_account ON finance_transactions(account_id, date DESC);`,
    `CREATE INDEX IF NOT EXISTS idx_fin_tx_date    ON finance_transactions(date DESC);`,
    `CREATE INDEX IF NOT EXISTS idx_fin_tx_cat     ON finance_transactions(category);`
  ], 'finance_accounts');

  // ── financial_accounts → RESTRICT ───────────────────────────
  rebuild('imported_transactions', `
    CREATE TABLE imported_transactions (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      account_id      INTEGER NOT NULL REFERENCES financial_accounts(id) ON DELETE RESTRICT,
      batch_id        INTEGER NOT NULL REFERENCES import_batches(id) ON DELETE CASCADE,
      txn_date        DATE    NOT NULL,
      post_date       DATE,
      description     TEXT    NOT NULL,
      amount          REAL    NOT NULL,
      balance         REAL,
      category        TEXT,
      txn_type        TEXT    DEFAULT 'transaction'
                      CHECK(txn_type IN ('transaction','transfer','payment','fee','interest','dividend','deposit','withdrawal')),
      is_transfer     INTEGER NOT NULL DEFAULT 0,
      memo            TEXT,
      fingerprint     TEXT    NOT NULL,
      flagged         INTEGER NOT NULL DEFAULT 0,
      created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
      symbol          TEXT,
      shares          REAL,
      price_per_share REAL
    );
  `, [
    `CREATE UNIQUE INDEX IF NOT EXISTS idx_imported_txn_fingerprint ON imported_transactions(fingerprint);`,
    `CREATE INDEX IF NOT EXISTS idx_imported_txn_account_date ON imported_transactions(account_id, txn_date DESC);`,
    `CREATE INDEX IF NOT EXISTS idx_imported_txn_batch ON imported_transactions(batch_id);`
  ], 'financial_accounts');

  rebuild('holdings', `
    CREATE TABLE holdings (
      id                 INTEGER PRIMARY KEY AUTOINCREMENT,
      account_id         INTEGER NOT NULL REFERENCES financial_accounts(id) ON DELETE RESTRICT,
      symbol             TEXT    NOT NULL,
      name               TEXT,
      asset_type         TEXT    DEFAULT 'stock'
                         CHECK(asset_type IN ('stock','etf','mutual_fund','tsp_fund','cash','other')),
      shares             REAL    NOT NULL DEFAULT 0,
      cost_basis         REAL,
      price              REAL,
      price_date         DATE,
      market_value       REAL,
      created_at         DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at         DATETIME DEFAULT CURRENT_TIMESTAMP,
      total_cost_basis   REAL,
      gain_loss_dollar   REAL,
      gain_loss_pct      REAL,
      day_change_dollar  REAL,
      day_change_pct     REAL,
      week52_low         REAL,
      week52_high        REAL,
      reinvest_dividends INTEGER,
      dividend_yield     REAL,
      last_dividend_date DATE,
      annual_dividend    REAL
    );
  `, [
    `CREATE UNIQUE INDEX IF NOT EXISTS idx_holdings_account_symbol ON holdings(account_id, symbol);`,
    `CREATE INDEX IF NOT EXISTS idx_holdings_account ON holdings(account_id);`
  ], 'financial_accounts');

  rebuild('account_snapshots', `
    CREATE TABLE account_snapshots (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      account_id      INTEGER NOT NULL REFERENCES financial_accounts(id) ON DELETE RESTRICT,
      snapshot_date   DATE    NOT NULL,
      balance         REAL    NOT NULL,
      batch_id        INTEGER REFERENCES import_batches(id),
      created_at      DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `, [
    `CREATE UNIQUE INDEX IF NOT EXISTS idx_account_snapshot_unique ON account_snapshots(account_id, snapshot_date);`,
    `CREATE INDEX IF NOT EXISTS idx_account_snapshot_date ON account_snapshots(account_id, snapshot_date DESC);`
  ], 'financial_accounts');

  // ── kids → SET NULL (records have historical value) ─────────
  rebuild('kid_activities', `
    CREATE TABLE kid_activities (
      id                INTEGER PRIMARY KEY AUTOINCREMENT,
      kid_id            INTEGER REFERENCES kids(id) ON DELETE SET NULL,
      name              TEXT NOT NULL,
      category          TEXT DEFAULT 'Other',
      day_of_week       TEXT,
      start_time        TEXT,
      end_time          TEXT,
      location          TEXT,
      contact_id        INTEGER REFERENCES contacts(id) ON DELETE SET NULL,
      cost_per_month    REAL,
      season            TEXT,
      start_date        DATE,
      end_date          DATE,
      notes             TEXT,
      is_active         INTEGER NOT NULL DEFAULT 1,
      created_at        DATETIME DEFAULT CURRENT_TIMESTAMP,
      needs_review      INTEGER NOT NULL DEFAULT 0,
      review_flagged_at DATETIME,
      review_reason     TEXT
    );
  `, [
    `CREATE INDEX IF NOT EXISTS idx_kact_kid ON kid_activities(kid_id);`
  ], 'kids');

  rebuild('kid_notes', `
    CREATE TABLE kid_notes (
      id                INTEGER PRIMARY KEY AUTOINCREMENT,
      kid_id            INTEGER REFERENCES kids(id) ON DELETE SET NULL,
      note_date         DATE NOT NULL DEFAULT (DATE('now')),
      category          TEXT DEFAULT 'General',
      title             TEXT,
      body              TEXT NOT NULL,
      created_at        DATETIME DEFAULT CURRENT_TIMESTAMP,
      needs_review      INTEGER NOT NULL DEFAULT 0,
      review_flagged_at DATETIME,
      review_reason     TEXT
    );
  `, [
    `CREATE INDEX IF NOT EXISTS idx_knotes_kid ON kid_notes(kid_id, note_date DESC);`
  ], 'kids');

  console.log('  113: CASCADE policy fix complete');
};
