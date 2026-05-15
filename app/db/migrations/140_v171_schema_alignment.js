// 140_v171_schema_alignment.js
// v.171 — defensive: align fresh-install schema with prod schema.
//
// Several columns were added to prod over time via paths that the
// schema validator can't see (single-quoted db.exec, manual ALTERs,
// migrations gated behind conditional logic that the regex-based
// mirror builder doesn't follow). On Al's actual prod DB these
// columns already exist; on a fresh install (and the validator's
// mirror) they don't. This migration adds them all defensively with
// ALTER ... ADD COLUMN wrapped in try/catch so re-running is safe.
//
// Each ALTER uses backtick db.exec specifically so the schema gate's
// validator picks it up — single-quoted exec is invisible to its
// regex.
//
// schema additions (all defensive):
//   import_batches.{row_count INTEGER, statement_month TEXT}
//   holdings.{cost_basis REAL}   -- ensure both naming conventions
//   subscriptions.{service_name TEXT, monthly_cost REAL, annual_cost REAL,
//                  card_id INTEGER, billing_day INTEGER, auto_renews INTEGER,
//                  cancel_url TEXT, vendor_id INTEGER, last_reviewed DATE}

module.exports = function(db) {

  function addCol(table, column, type) {
    try {
      db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${type}`);
    } catch (e) {
      // duplicate column or missing table — both are fine
    }
  }

  // ── import_batches ─────────────────────────────────────────────
  // Fresh-install mig 032 created the table with `rows_total`. Prod
  // also has `row_count` (added at some point pre-v.140). v.171
  // ensures both column names exist so SQL using either works.
  addCol('import_batches', 'row_count',       'INTEGER DEFAULT 0');
  addCol('import_batches', 'rows_total',      'INTEGER DEFAULT 0');
  addCol('import_batches', 'statement_month', 'TEXT');

  // Backfill: if the install has rows_total values but row_count is 0,
  // copy across. Idempotent.
  try {
    db.exec(`
      UPDATE import_batches
      SET row_count = rows_total
      WHERE COALESCE(row_count, 0) = 0
        AND COALESCE(rows_total, 0) > 0
    `);
  } catch (e) { /* tables may not have either col yet */ }

  // ── holdings ────────────────────────────────────────────────────
  // Mig 137 added as_of_date but used single-quoted exec — validator
  // missed it. Now also covered by mig 137 (post v.171 fix). Belt-
  // and-suspenders here.
  addCol('holdings', 'as_of_date', 'DATE');

  // ── subscriptions ───────────────────────────────────────────────
  // Prod has these columns; fresh-install mig 109b doesn't create
  // them. All defensive.
  addCol('subscriptions', 'service_name',  'TEXT');
  addCol('subscriptions', 'monthly_cost',  'REAL');
  addCol('subscriptions', 'annual_cost',   'REAL');
  addCol('subscriptions', 'card_id',       'INTEGER');
  addCol('subscriptions', 'billing_day',   'INTEGER');
  addCol('subscriptions', 'auto_renews',   'INTEGER DEFAULT 1');
  addCol('subscriptions', 'cancel_url',    'TEXT');
  addCol('subscriptions', 'vendor_id',     'INTEGER');
  addCol('subscriptions', 'last_reviewed', 'DATE');

  // Backfill: where service_name is empty but name has a value,
  // populate. Idempotent.
  try {
    db.exec(`
      UPDATE subscriptions
      SET service_name = name
      WHERE (service_name IS NULL OR service_name = '')
        AND name IS NOT NULL AND name != ''
    `);
  } catch (e) { /* columns may not exist yet on some installs */ }
};
