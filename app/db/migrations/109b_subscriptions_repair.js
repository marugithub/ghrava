// Migration 109b: Subscriptions module — idempotent repair version.
// 
// Replaces failed migration 109. Creates the subscriptions and subscription_members
// tables if missing, adds any columns missing from older partial installs, then
// ensures dropdowns + indexes exist.

module.exports = function repairSubscriptions(db) {
  function addCol(table, column, type) {
    try {
      db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${type};`);
    } catch (e) {
      if (!e.message.includes('duplicate column')) throw e;
    }
  }

  // Create core tables if missing
  db.exec(`
    CREATE TABLE IF NOT EXISTS subscriptions (
      id                  INTEGER PRIMARY KEY AUTOINCREMENT,
      name                TEXT NOT NULL,
      category            TEXT,
      cost                REAL,
      billing_cycle       TEXT DEFAULT 'monthly',
      next_billing_date   TEXT,
      auto_renew          INTEGER DEFAULT 1,
      finance_account_id  INTEGER REFERENCES finance_accounts(id),
      provider_contact_id INTEGER REFERENCES contacts(id),
      status              TEXT DEFAULT 'active',
      notes               TEXT,
      created_at          TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at          TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS subscription_members (
      id                INTEGER PRIMARY KEY AUTOINCREMENT,
      subscription_id   INTEGER NOT NULL REFERENCES subscriptions(id),
      family_member_id  INTEGER NOT NULL REFERENCES family_members(id)
    );
  `);

  // Patch any missing columns on the EXISTING subscriptions table
  // (this handles partial installs where the table was created but with fewer cols)
  addCol('subscriptions', 'name',                'TEXT');
  addCol('subscriptions', 'category',            'TEXT');
  addCol('subscriptions', 'cost',                'REAL');
  addCol('subscriptions', 'billing_cycle',       "TEXT DEFAULT 'monthly'");
  addCol('subscriptions', 'next_billing_date',   'TEXT');
  addCol('subscriptions', 'auto_renew',          'INTEGER DEFAULT 1');
  addCol('subscriptions', 'finance_account_id',  'INTEGER');
  addCol('subscriptions', 'provider_contact_id', 'INTEGER');
  addCol('subscriptions', 'status',              "TEXT DEFAULT 'active'");
  addCol('subscriptions', 'notes',               'TEXT');
  addCol('subscriptions', 'created_at',          'TEXT DEFAULT CURRENT_TIMESTAMP');
  addCol('subscriptions', 'updated_at',          'TEXT DEFAULT CURRENT_TIMESTAMP');

  // Indexes (now safe — all referenced columns exist)
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_subscriptions_status  ON subscriptions(status);
    CREATE INDEX IF NOT EXISTS idx_subscriptions_billing ON subscriptions(next_billing_date);
  `);

  // Dropdown seeds (column name is list_key, NOT key)
  const seed = db.prepare(
    'INSERT OR IGNORE INTO dropdown_options (list_key, label, value, sort_order, is_system, is_active) VALUES (?,?,?,?,?,?)'
  );
  const seeds = [
    ['subscription_category', 'Streaming',  'Streaming',  10, 1, 1],
    ['subscription_category', 'Music',      'Music',      20, 1, 1],
    ['subscription_category', 'Software',   'Software',   30, 1, 1],
    ['subscription_category', 'Fitness',    'Fitness',    40, 1, 1],
    ['subscription_category', 'News',       'News',       50, 1, 1],
    ['subscription_category', 'Gaming',     'Gaming',     60, 1, 1],
    ['subscription_category', 'Utilities',  'Utilities',  70, 1, 1],
    ['subscription_category', 'Other',      'Other',      80, 1, 1],
    ['subscription_status',   'Active',     'active',     10, 1, 1],
    ['subscription_status',   'Paused',     'paused',     20, 1, 1],
    ['subscription_status',   'Cancelled',  'cancelled',  30, 1, 1],
    ['billing_cycle',         'Monthly',    'monthly',    10, 1, 1],
    ['billing_cycle',         'Annual',     'annual',     20, 1, 1],
    ['billing_cycle',         'Weekly',     'weekly',     30, 1, 1],
    ['billing_cycle',         'Quarterly',  'quarterly',  40, 1, 1],
  ];
  const tx = db.transaction(() => { for (const s of seeds) seed.run(...s); });
  tx();
};
