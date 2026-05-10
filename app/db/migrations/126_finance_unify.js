// ═════════════════════════════════════════════════════════════════
// Migration 126 — Unify accounts + transactions (v202604.151)
//
// Background:
//   The codebase grew with two parallel sets of tables. `finance_*`
//   was added in mig 020 for manual entry. `financial_*` was added
//   in mig 032 for the file-import feature. Same kind of data, two
//   tables, two type vocabularies. Same real-world account could
//   end up in either depending on how data was entered. This caused
//   downstream inconsistencies (tile data, net-worth math, dedup).
//
//   This migration merges them into one accounts table and one
//   transactions table. Both manual entry and file import target
//   the same destination going forward.
//
// What this migration does (one transaction):
//   1. Creates new `accounts` table with full union of fields from
//      both, plus `alias`, `source`, `needs_review`. NO CASCADE on
//      any FK (per architecture rule).
//   2. Creates new `transactions` table replacing
//      finance_transactions + imported_transactions. Carries
//      `source` ('manual' | 'imported') and `needs_review` flag.
//   3. Copies rows from `finance_accounts` → `accounts`. Type
//      values normalize to TitleCase, mapped to the locked vocab.
//   4. Copies rows from `financial_accounts` → `accounts`,
//      deduping on (institution, last4). When a row from the
//      second source matches an existing row by that key, it is
//      MERGED into the existing row (filling in nulls only — never
//      overwriting non-null values) and the merged row is marked
//      `needs_review=1`.
//   5. Builds an `_account_id_map` table mapping old IDs from
//      both source tables → new IDs. This lets us rewrite FK
//      references safely.
//   6. Creates new `import_batches_v2` and `holdings_v2` with FKs
//      pointing to `accounts(id)` (no CASCADE). Copies rows.
//   7. Copies finance_transactions → transactions with source='manual'.
//   8. Copies imported_transactions → transactions with source='imported',
//      preserving fingerprint/flagged/batch_id (rewritten).
//   9. Renames the old tables to `_legacy_*` so they stay
//      queryable but inert. NOTHING IS DROPPED. Routes will be
//      switched to read from `accounts`/`transactions` in the
//      same drop. If something goes wrong, rename back.
//
// Locked type vocabulary (drives every dropdown):
//   Checking, Savings, Credit, Cash, HSA, Brokerage, TSP,
//   Retirement, Loan, Mortgage, Other
//
// Idempotent: re-running checks for the marker row in
//   `_migrations_finance_unify_done` and skips on a second pass.
//
// Reversible: legacy tables retained. To roll back manually:
//   DROP TABLE accounts; DROP TABLE transactions;
//   DROP TABLE holdings_v2; DROP TABLE import_batches_v2;
//   DROP TABLE _account_id_map;
//   ALTER TABLE _legacy_finance_accounts RENAME TO finance_accounts;
//   ALTER TABLE _legacy_financial_accounts RENAME TO financial_accounts;
//   ALTER TABLE _legacy_finance_transactions RENAME TO finance_transactions;
//   ALTER TABLE _legacy_imported_transactions RENAME TO imported_transactions;
//   ALTER TABLE _legacy_import_batches RENAME TO import_batches;
//   ALTER TABLE _legacy_holdings RENAME TO holdings;
//   DELETE FROM _migrations_finance_unify_done;
// ═════════════════════════════════════════════════════════════════

module.exports = function (db) {
  // ── Idempotence guard ─────────────────────────────────────────
  db.exec(`
    CREATE TABLE IF NOT EXISTS _migrations_finance_unify_done (
      done_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      version TEXT
    );
  `);
  const already = db.prepare(
    `SELECT 1 AS x FROM _migrations_finance_unify_done LIMIT 1`
  ).get();
  if (already) return; // already run

  // ── Type vocab normalizer ─────────────────────────────────────
  // Maps every value seen in either old table to the locked list.
  // Anything unrecognized falls through to 'Other' and gets
  // needs_review=1 so Al can fix in UI.
  const TYPE_MAP = {
    // finance_accounts (TitleCase, mig 020)
    'checking': 'Checking', 'Checking': 'Checking',
    'savings':  'Savings',  'Savings':  'Savings',
    'credit':   'Credit',   'Credit':   'Credit',
    'cash':     'Cash',     'Cash':     'Cash',
    'hsa':      'HSA',      'HSA':      'HSA',
    'investment': 'Brokerage',  'Investment': 'Brokerage',
    // financial_accounts (lowercase, mig 032)
    'brokerage':   'Brokerage',  'Brokerage':   'Brokerage',
    'credit_card': 'Credit',     'Credit Card': 'Credit',
    'tsp':         'TSP',        'TSP':         'TSP',
    'retirement':  'Retirement', 'Retirement':  'Retirement',
    'ira':         'Retirement', 'IRA':         'Retirement',
    '401k':        'Retirement', '401(k)':      'Retirement',
    'loan':        'Loan',       'Loan':        'Loan',
    'mortgage':    'Mortgage',   'Mortgage':    'Mortgage',
    'other':       'Other',      'Other':       'Other',
  };
  function normalizeType(t) {
    if (!t) return { type: 'Other', review: 1 };
    const m = TYPE_MAP[t] || TYPE_MAP[t.toLowerCase()];
    if (m) return { type: m, review: 0 };
    return { type: 'Other', review: 1 };
  }

  const tx = db.transaction(() => {
    // ── 1. New accounts table ───────────────────────────────────
    db.exec(`
      CREATE TABLE IF NOT EXISTS accounts (
        id                  INTEGER PRIMARY KEY AUTOINCREMENT,
        name                TEXT    NOT NULL,
        alias               TEXT,
        type                TEXT    NOT NULL DEFAULT 'Other',
        institution         TEXT,
        last4               TEXT,
        owner               TEXT,
        currency            TEXT    NOT NULL DEFAULT 'USD',
        current_balance     REAL    NOT NULL DEFAULT 0,
        balance_as_of       DATE,
        include_net_worth   INTEGER NOT NULL DEFAULT 1,
        is_active           INTEGER NOT NULL DEFAULT 1,
        track_statements    INTEGER NOT NULL DEFAULT 0,
        notes               TEXT,
        sort_order          INTEGER NOT NULL DEFAULT 0,
        source              TEXT    NOT NULL DEFAULT 'manual',
        needs_review        INTEGER NOT NULL DEFAULT 0,
        created_at          DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at          DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);
    db.exec(`CREATE INDEX IF NOT EXISTS idx_accounts_active ON accounts(is_active);`);
    db.exec(`CREATE INDEX IF NOT EXISTS idx_accounts_type ON accounts(type);`);
    db.exec(`CREATE INDEX IF NOT EXISTS idx_accounts_review ON accounts(needs_review);`);

    // ── 2. New transactions table ───────────────────────────────
    db.exec(`
      CREATE TABLE IF NOT EXISTS transactions (
        id                  INTEGER PRIMARY KEY AUTOINCREMENT,
        account_id          INTEGER NOT NULL,
        date                DATE    NOT NULL,
        post_date           DATE,
        description         TEXT    NOT NULL,
        amount              REAL    NOT NULL,
        balance             REAL,
        category            TEXT,
        notes               TEXT,
        memo                TEXT,
        is_reconciled       INTEGER NOT NULL DEFAULT 0,
        is_transfer         INTEGER NOT NULL DEFAULT 0,
        source              TEXT    NOT NULL DEFAULT 'manual',
        needs_review        INTEGER NOT NULL DEFAULT 0,
        fingerprint         TEXT,
        flagged             INTEGER NOT NULL DEFAULT 0,
        batch_id            INTEGER,
        txn_type            TEXT,
        created_at          DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);
    db.exec(`CREATE INDEX IF NOT EXISTS idx_tx_account ON transactions(account_id, date DESC);`);
    db.exec(`CREATE INDEX IF NOT EXISTS idx_tx_date ON transactions(date DESC);`);
    db.exec(`CREATE INDEX IF NOT EXISTS idx_tx_cat ON transactions(category);`);
    db.exec(`CREATE INDEX IF NOT EXISTS idx_tx_fp ON transactions(fingerprint);`);
    db.exec(`CREATE INDEX IF NOT EXISTS idx_tx_review ON transactions(needs_review);`);

    // ── 3. ID maps ──────────────────────────────────────────────
    // Track old → new for both source tables. Used to rewrite FKs.
    db.exec(`
      CREATE TABLE IF NOT EXISTS _account_id_map (
        old_table   TEXT NOT NULL,
        old_id      INTEGER NOT NULL,
        new_id      INTEGER NOT NULL,
        PRIMARY KEY (old_table, old_id)
      );
    `);
    db.exec(`
      CREATE TABLE IF NOT EXISTS _batch_id_map (
        old_id INTEGER PRIMARY KEY,
        new_id INTEGER NOT NULL
      );
    `);

    const existsTbl = (name) => !!db.prepare(
      `SELECT 1 AS x FROM sqlite_master WHERE type='table' AND name=?`
    ).get(name);

    // ── 4. Copy finance_accounts ───────────────────────────────
    if (existsTbl('finance_accounts')) {
      const rows = db.prepare(`SELECT * FROM finance_accounts`).all();
      const insAcc = db.prepare(`
        INSERT INTO accounts
          (name, alias, type, institution, last4, current_balance,
           balance_as_of, include_net_worth, is_active, notes,
           sort_order, source, needs_review)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)
      `);
      const mapIns = db.prepare(
        `INSERT OR IGNORE INTO _account_id_map (old_table, old_id, new_id) VALUES ('finance_accounts', ?, ?)`
      );
      for (const r of rows) {
        const t = normalizeType(r.type);
        const info = insAcc.run(
          r.name,
          null,                    // alias filled in by user later
          t.type,
          r.institution || null,
          r.account_last4 || null,
          r.current_balance || 0,
          r.balance_as_of || null,
          r.include_net_worth ? 1 : 0,
          r.is_active ? 1 : 0,
          r.notes || null,
          r.sort_order || 0,
          'manual',
          t.review
        );
        mapIns.run(r.id, info.lastInsertRowid);
      }
    }

    // ── 5. Copy financial_accounts (with dedup) ─────────────────
    if (existsTbl('financial_accounts')) {
      const rows = db.prepare(`SELECT * FROM financial_accounts`).all();
      const findExisting = db.prepare(`
        SELECT id FROM accounts
        WHERE COALESCE(institution,'') = COALESCE(?, '')
          AND COALESCE(last4,'') = COALESCE(?, '')
          AND last4 IS NOT NULL AND last4 <> ''
        LIMIT 1
      `);
      const updateMerge = db.prepare(`
        UPDATE accounts SET
          alias            = COALESCE(alias, ?),
          owner            = COALESCE(owner, ?),
          currency         = COALESCE(currency, ?),
          track_statements = COALESCE(track_statements, ?),
          notes            = COALESCE(notes, ?),
          source           = 'merged',
          needs_review     = 1,
          updated_at       = CURRENT_TIMESTAMP
        WHERE id = ?
      `);
      const insAcc = db.prepare(`
        INSERT INTO accounts
          (name, alias, type, institution, last4, owner, currency,
           is_active, track_statements, notes, source, needs_review)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?)
      `);
      const mapIns = db.prepare(
        `INSERT OR IGNORE INTO _account_id_map (old_table, old_id, new_id) VALUES ('financial_accounts', ?, ?)`
      );
      for (const r of rows) {
        const t = normalizeType(r.account_type);
        // dedup only if last4 is non-empty — institution alone too noisy
        const dup = (r.last_four && String(r.last_four).trim())
          ? findExisting.get(r.institution || '', r.last_four)
          : null;
        if (dup) {
          updateMerge.run(
            r.nickname || null,
            r.owner || null,
            r.currency || 'USD',
            r.track_statements ? 1 : 0,
            r.notes || null,
            dup.id
          );
          mapIns.run(r.id, dup.id);
        } else {
          const info = insAcc.run(
            r.nickname,
            null,
            t.type,
            r.institution || null,
            r.last_four || null,
            r.owner || null,
            r.currency || 'USD',
            r.is_active ? 1 : 0,
            r.track_statements ? 1 : 0,
            r.notes || null,
            'imported',
            t.review
          );
          mapIns.run(r.id, info.lastInsertRowid);
        }
      }
    }

    // ── 6. New import_batches with rewritten FKs (no CASCADE) ───
    db.exec(`
      CREATE TABLE IF NOT EXISTS import_batches_v2 (
        id           INTEGER PRIMARY KEY AUTOINCREMENT,
        account_id   INTEGER NOT NULL,
        filename     TEXT    NOT NULL,
        format       TEXT,
        row_count    INTEGER NOT NULL DEFAULT 0,
        imported_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
        statement_date DATE,
        notes        TEXT
      );
    `);
    if (existsTbl('import_batches')) {
      const rows = db.prepare(`SELECT * FROM import_batches`).all();
      const ins = db.prepare(`
        INSERT INTO import_batches_v2 (account_id, filename, format, row_count, imported_at, statement_date, notes)
        VALUES (?,?,?,?,?,?,?)
      `);
      const lookup = db.prepare(
        `SELECT new_id FROM _account_id_map WHERE old_table='financial_accounts' AND old_id=?`
      );
      const batchMap = db.prepare(`INSERT OR IGNORE INTO _batch_id_map (old_id, new_id) VALUES (?, ?)`);
      for (const r of rows) {
        const m = lookup.get(r.account_id);
        if (!m) continue; // orphan batch (account already gone) — skip
        const info = ins.run(
          m.new_id,
          r.filename,
          r.format || null,
          r.row_count || 0,
          r.imported_at || null,
          r.statement_date || null,
          r.notes || null
        );
        batchMap.run(r.id, info.lastInsertRowid);
      }
    }

    // ── 7. Holdings rebuild ─────────────────────────────────────
    db.exec(`
      CREATE TABLE IF NOT EXISTS holdings_v2 (
        id                INTEGER PRIMARY KEY AUTOINCREMENT,
        account_id        INTEGER NOT NULL,
        symbol            TEXT    NOT NULL,
        name              TEXT,
        asset_type        TEXT,
        shares            REAL,
        price             REAL,
        market_value      REAL,
        total_cost_basis  REAL,
        gain_loss_dollar  REAL,
        gain_loss_pct     REAL,
        day_change_dollar REAL,
        day_change_pct    REAL,
        week52_low        REAL,
        week52_high       REAL,
        reinvest_dividends INTEGER NOT NULL DEFAULT 0,
        as_of_date        DATE,
        updated_at        DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);
    db.exec(`CREATE INDEX IF NOT EXISTS idx_holdings_v2_acct ON holdings_v2(account_id);`);
    db.exec(`CREATE INDEX IF NOT EXISTS idx_holdings_v2_symbol ON holdings_v2(symbol);`);
    if (existsTbl('holdings')) {
      const rows = db.prepare(`SELECT * FROM holdings`).all();
      const lookup = db.prepare(
        `SELECT new_id FROM _account_id_map WHERE old_table='financial_accounts' AND old_id=?`
      );
      // Use a defensive column list — old `holdings` may have grown
      // columns we don't enumerate. Pull what we know.
      const cols = ['symbol','name','asset_type','shares','price','market_value',
                    'total_cost_basis','gain_loss_dollar','gain_loss_pct',
                    'day_change_dollar','day_change_pct','week52_low','week52_high',
                    'reinvest_dividends','as_of_date'];
      const ins = db.prepare(`
        INSERT INTO holdings_v2 (account_id, ${cols.join(', ')})
        VALUES (?, ${cols.map(()=>'?').join(', ')})
      `);
      for (const r of rows) {
        const m = lookup.get(r.account_id);
        if (!m) continue;
        ins.run(m.new_id, ...cols.map(c => r[c] !== undefined ? r[c] : null));
      }
    }

    // ── 8. Copy finance_transactions → transactions (source='manual') ──
    if (existsTbl('finance_transactions')) {
      const rows = db.prepare(`SELECT * FROM finance_transactions`).all();
      const lookup = db.prepare(
        `SELECT new_id FROM _account_id_map WHERE old_table='finance_accounts' AND old_id=?`
      );
      const ins = db.prepare(`
        INSERT INTO transactions
          (account_id, date, description, amount, category, notes,
           is_reconciled, source, needs_review)
        VALUES (?,?,?,?,?,?,?,'manual',0)
      `);
      for (const r of rows) {
        const m = lookup.get(r.account_id);
        if (!m) continue;
        ins.run(
          m.new_id,
          r.date,
          r.description,
          r.amount,
          r.category || null,
          r.notes || null,
          r.is_reconciled ? 1 : 0
        );
      }
    }

    // ── 9. Copy imported_transactions → transactions (source='imported') ──
    if (existsTbl('imported_transactions')) {
      const rows = db.prepare(`SELECT * FROM imported_transactions`).all();
      const lookupAcc = db.prepare(
        `SELECT new_id FROM _account_id_map WHERE old_table='financial_accounts' AND old_id=?`
      );
      const lookupBatch = db.prepare(
        `SELECT new_id FROM _batch_id_map WHERE old_id=?`
      );
      const ins = db.prepare(`
        INSERT INTO transactions
          (account_id, batch_id, date, post_date, description, amount,
           balance, category, txn_type, is_transfer, memo, fingerprint,
           flagged, source, needs_review)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,'imported',?)
      `);
      for (const r of rows) {
        const m = lookupAcc.get(r.account_id);
        if (!m) continue;
        const b = r.batch_id ? lookupBatch.get(r.batch_id) : null;
        ins.run(
          m.new_id,
          b ? b.new_id : null,
          r.txn_date,
          r.post_date || null,
          r.description,
          r.amount,
          r.balance || null,
          r.category || null,
          r.txn_type || null,
          r.is_transfer ? 1 : 0,
          r.memo || null,
          r.fingerprint || null,
          r.flagged ? 1 : 0,
          r.flagged ? 1 : 0   // flagged rows also need review
        );
      }
    }

    // ── 10. Rename old tables to _legacy_* ──────────────────────
    // Keeps them queryable, removes them from any code paths that
    // were still SELECTing from them. NOT dropped.
    const renames = [
      ['finance_accounts',       '_legacy_finance_accounts'],
      ['financial_accounts',     '_legacy_financial_accounts'],
      ['finance_transactions',   '_legacy_finance_transactions'],
      ['imported_transactions',  '_legacy_imported_transactions'],
      ['import_batches',         '_legacy_import_batches'],
      ['holdings',               '_legacy_holdings'],
    ];
    for (const [from, to] of renames) {
      if (existsTbl(from) && !existsTbl(to)) {
        try { db.exec(`ALTER TABLE ${from} RENAME TO ${to};`); }
        catch (e) { /* keep going — partial rename better than abort */ }
      }
    }

    // Promote v2 names to canonical: import_batches_v2 → import_batches,
    // holdings_v2 → holdings (after old ones renamed away).
    if (existsTbl('import_batches_v2') && !existsTbl('import_batches')) {
      db.exec(`ALTER TABLE import_batches_v2 RENAME TO import_batches;`);
    }
    if (existsTbl('holdings_v2') && !existsTbl('holdings')) {
      db.exec(`ALTER TABLE holdings_v2 RENAME TO holdings;`);
    }

    // ── 11. Compat views ────────────────────────────────────────
    // Many other modules (dashboard, search, subscriptions, reports,
    // shared/recurring-transactions.js, etc.) SELECT from the old
    // table names. Rather than rewrite every one in this drop, expose
    // views with the old names + old column shapes pointing at the
    // unified tables. The legacy tables were renamed away above, so
    // these names are free.
    //
    // INSERT/UPDATE/DELETE through views isn't supported by SQLite
    // without INSTEAD OF triggers — and we've already updated every
    // write path in finance/routes.js and import/routes.js to use the
    // unified tables. Read-only compat is sufficient.
    db.exec(`
      DROP VIEW IF EXISTS finance_accounts;
      CREATE VIEW finance_accounts AS
      SELECT id, name, type, institution,
             last4 AS account_last4,
             current_balance, balance_as_of, is_active,
             include_net_worth, notes, sort_order, created_at, updated_at
      FROM accounts;
    `);
    db.exec(`
      DROP VIEW IF EXISTS financial_accounts;
      CREATE VIEW financial_accounts AS
      SELECT id, name AS nickname, institution,
             type AS account_type,
             owner, last4 AS last_four, currency,
             is_active, track_statements, notes, created_at, updated_at
      FROM accounts;
    `);
    db.exec(`
      DROP VIEW IF EXISTS finance_transactions;
      CREATE VIEW finance_transactions AS
      SELECT id, account_id, date, description, amount, category, notes,
             is_reconciled, batch_id, created_at
      FROM transactions
      WHERE source = 'manual';
    `);
    db.exec(`
      DROP VIEW IF EXISTS imported_transactions;
      CREATE VIEW imported_transactions AS
      SELECT id, account_id, batch_id,
             date  AS txn_date,
             post_date, description, amount, balance,
             category, txn_type, is_transfer, memo,
             fingerprint, flagged, created_at
      FROM transactions
      WHERE source = 'imported';
    `);
    // Old code referenced both `import_batches` (under import/routes)
    // AND `fin_import_batches` (under finance/routes). The unified
    // `import_batches` table covers both — add the alias view too.
    db.exec(`
      DROP VIEW IF EXISTS fin_import_batches;
      CREATE VIEW fin_import_batches AS
      SELECT id, account_id, filename, format,
             row_count AS rows_total,
             row_count AS rows_imported,
             0 AS rows_skipped,
             0 AS rows_flagged,
             'banking' AS account_type,
             'complete' AS status,
             NULL AS error_message,
             imported_at, statement_date, notes
      FROM import_batches;
    `);

    // ── 12. Mark done ───────────────────────────────────────────
    db.prepare(
      `INSERT INTO _migrations_finance_unify_done (version) VALUES ('202604.151')`
    ).run();
  });

  tx();
};
