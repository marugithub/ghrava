// ═════════════════════════════════════════════════════════════════
// Migration 130 — Rescue mig 126 v2 (v202604.159)
//
// REWRITTEN from v.158's first attempt, which itself failed because:
//   1. It called mig 126 in-process. Mig 126's
//      `CREATE INDEX ON accounts(is_active)` fails because a
//      pre-existing `accounts` table (beneficiaries schema) holds
//      the name, so `CREATE TABLE IF NOT EXISTS accounts` is a
//      no-op and the index runs against the wrong table.
//   2. Mig 126's compat-view DDL uses `DROP VIEW IF EXISTS
//      fin_import_batches`, but `fin_import_batches` is a TABLE on
//      this DB — DROP VIEW can't touch tables.
//
// THIS MIGRATION is fully self-contained. It does not call mig 126;
// it replicates the unification logic inline with the fixes above.
// All wrapped in ONE transaction — failure rolls back, broken state
// is preserved.
//
// Idempotent: marker row blocks re-runs. Also detects "already
// unified" state and no-ops.
// ═════════════════════════════════════════════════════════════════

'use strict';
const crypto = require('crypto');

const TYPE_MAP = {
  'checking':'Checking','savings':'Savings','credit':'Credit',
  'credit_card':'Credit','creditcard':'Credit','cash':'Cash','hsa':'HSA',
  'brokerage':'Brokerage','investment':'Brokerage','tsp':'TSP',
  'retirement':'Retirement','ira':'Retirement','401k':'Retirement','roth':'Retirement',
  'loan':'Loan','mortgage':'Mortgage','other':'Other',
};
function normalizeType(t) {
  if (!t) return { type: 'Other', review: 1 };
  const k = String(t).toLowerCase().trim();
  const found = TYPE_MAP[k];
  return found ? { type: found, review: 0 } : { type: 'Other', review: 1 };
}

const LEADING_PREFIXES = [
  /^PURCHASE AUTHORIZED ON \d{2}\/\d{2}\s+/,
  /^DEBIT CARD PURCHASE\s+/, /^CREDIT CARD PURCHASE\s+/,
  /^POS WITHDRAWAL\s+/, /^POS PURCHASE\s+/, /^POS DEBIT\s+/,
  /^CHECK CARD\s+/, /^ATM WITHDRAWAL\s+/,
  /^ACH DEBIT\s+/, /^ACH CREDIT\s+/,
  /^EXTERNAL DEPOSIT\s+/, /^EXTERNAL WITHDRAWAL\s+/,
];
const TRAILING_REFS = [
  /\*[A-Z0-9]{4,}\s*$/, /#\d+\s*$/,
  /\sREF:\s*\S+\s*$/i, /\sID:\s*\S+\s*$/i,
  /\sXX\/\d+\s*$/, /\s\d{6,}\s*$/, /\s+$/,
];
function normDesc(s) {
  if (s == null) return '';
  let out = String(s).trim().toUpperCase().replace(/\s+/g, ' ');
  for (const re of LEADING_PREFIXES) if (re.test(out)) { out = out.replace(re, ''); break; }
  for (let i = 0; i < 8; i++) {
    let changed = false;
    for (const re of TRAILING_REFS) if (re.test(out)) { out = out.replace(re, ''); changed = true; }
    if (!changed) break;
  }
  return out.trim();
}
function fingerprint(acctId, date, amount, desc) {
  const amt = Number.isFinite(parseFloat(amount)) ? parseFloat(amount).toFixed(2) : '0.00';
  return crypto.createHash('md5')
    .update(`${acctId}|${date}|${amt}|${normDesc(desc)}`)
    .digest('hex');
}

module.exports = function (db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS _migrations_rescue_126_done (
      done_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
      version  TEXT,
      notes    TEXT
    );
  `);
  if (db.prepare(`SELECT 1 FROM _migrations_rescue_126_done WHERE notes NOT LIKE 'RESCUE FAILED:%' LIMIT 1`).get()) return;

  const tableType = (name) => {
    const r = db.prepare(
      `SELECT type FROM sqlite_master WHERE name=? AND type IN ('table','view')`
    ).get(name);
    return r ? r.type : null;
  };
  const exists = (name) => tableType(name) !== null;
  const hasCol = (table, col) => {
    if (!exists(table)) return false;
    return db.prepare(`PRAGMA table_info(${table})`).all().some(c => c.name === col);
  };
  const rowCount = (table) => {
    if (!exists(table)) return 0;
    try { return db.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get().n || 0; }
    catch { return 0; }
  };

  const accountsHasAlias = hasCol('accounts', 'alias');
  const txnTableExists   = tableType('transactions') === 'table';
  const unifyMarker      = exists('_migrations_finance_unify_done') &&
                           !!db.prepare(`SELECT 1 FROM _migrations_finance_unify_done LIMIT 1`).get();

  // Case A: already unified successfully.
  if (txnTableExists && accountsHasAlias && unifyMarker) {
    db.prepare(`INSERT INTO _migrations_rescue_126_done (version, notes) VALUES (?, ?)`)
      .run('202604.159', 'no-op: schema already unified');
    return;
  }

  const totalFinanceData =
    rowCount('finance_accounts') + rowCount('financial_accounts') +
    rowCount('finance_transactions') + rowCount('imported_transactions');

  // Case B: no finance data anywhere. Clear bad pre-existing accounts
  // table if present so mig 126 can run cleanly next time, then no-op.
  if (totalFinanceData === 0 && !accountsHasAlias) {
    if (exists('accounts') && !accountsHasAlias && rowCount('accounts') === 0) {
      db.exec(`ALTER TABLE accounts RENAME TO accounts_beneficiaries;`);
    }
    db.prepare(`INSERT INTO _migrations_rescue_126_done (version, notes) VALUES (?, ?)`)
      .run('202604.159', 'no-op: empty install');
    return;
  }

  // Case C: rescue path.
  const notes = [];
  const rescue = db.transaction(() => {
    // 1. Move pre-existing `accounts` if it's the beneficiaries shape.
    if (exists('accounts') && !accountsHasAlias) {
      const preCount = rowCount('accounts');
      if (preCount > 0) {
        throw new Error(
          `Pre-existing 'accounts' table has ${preCount} rows and is not the unified schema. Manual intervention required.`
        );
      }
      db.exec(`ALTER TABLE accounts RENAME TO accounts_beneficiaries;`);
      notes.push('renamed pre-existing empty accounts → accounts_beneficiaries');
    }

    // 2. Rename source tables/views out of the way. Tables get ALTER
    // TABLE RENAME; views must be dropped (can't be renamed).
    const sourceNames = [
      'finance_accounts','financial_accounts',
      'finance_transactions','imported_transactions',
      'import_batches','holdings','fin_import_batches',
    ];
    for (const src of sourceNames) {
      const tt = tableType(src);
      if (!tt) continue;
      const legacy = '_legacy_' + src;
      if (exists(legacy)) {
        const ltype = tableType(legacy);
        db.exec(`DROP ${ltype === 'view' ? 'VIEW' : 'TABLE'} ${legacy};`);
      }
      if (tt === 'view') {
        db.exec(`DROP VIEW ${src};`);
        notes.push(`dropped pre-existing view ${src}`);
      } else {
        db.exec(`ALTER TABLE ${src} RENAME TO ${legacy};`);
        notes.push(`renamed ${src} → ${legacy}`);
      }
    }

    // 3. Create unified accounts table.
    // Defensive: drop any indexes whose names collide with the ones
    // we're about to create. These may exist on accounts_beneficiaries
    // (just renamed) — index names are global in SQLite, not scoped
    // to their table.
    for (const idx of ['idx_accounts_active','idx_accounts_type',
                       'idx_accounts_review','idx_accounts_payment_due']) {
      db.exec(`DROP INDEX IF EXISTS ${idx};`);
    }
    db.exec(`
      CREATE TABLE accounts (
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
        credit_limit            REAL,
        statement_balance       REAL,
        minimum_payment         REAL,
        payment_due_date        DATE,
        apr                     REAL,
        promo_apr               REAL,
        promo_end_date          DATE,
        annual_fee              REAL,
        annual_fee_renewal_date DATE,
        rewards_balance         REAL,
        created_at          DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at          DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);
    db.exec(`CREATE INDEX idx_accounts_active ON accounts(is_active);`);
    db.exec(`CREATE INDEX idx_accounts_type ON accounts(type);`);
    db.exec(`CREATE INDEX idx_accounts_review ON accounts(needs_review);`);
    db.exec(`CREATE INDEX idx_accounts_payment_due ON accounts(payment_due_date) WHERE payment_due_date IS NOT NULL;`);

    // 4. Unified transactions table.
    for (const idx of ['idx_tx_account','idx_tx_date','idx_tx_cat',
                       'idx_tx_fp','idx_tx_review']) {
      db.exec(`DROP INDEX IF EXISTS ${idx};`);
    }
    db.exec(`
      CREATE TABLE transactions (
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
    db.exec(`CREATE INDEX idx_tx_account ON transactions(account_id, date DESC);`);
    db.exec(`CREATE INDEX idx_tx_date ON transactions(date DESC);`);
    db.exec(`CREATE INDEX idx_tx_cat ON transactions(category);`);
    db.exec(`CREATE INDEX idx_tx_fp ON transactions(fingerprint);`);
    db.exec(`CREATE INDEX idx_tx_review ON transactions(needs_review);`);

    // 5. Unified import_batches + holdings.
    for (const idx of ['idx_import_batches_acct','idx_holdings_acct',
                       'idx_holdings_symbol']) {
      db.exec(`DROP INDEX IF EXISTS ${idx};`);
    }
    db.exec(`
      CREATE TABLE import_batches (
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
    db.exec(`CREATE INDEX idx_import_batches_acct ON import_batches(account_id);`);
    db.exec(`
      CREATE TABLE holdings (
        id                INTEGER PRIMARY KEY AUTOINCREMENT,
        account_id        INTEGER NOT NULL,
        symbol            TEXT    NOT NULL,
        name              TEXT,
        asset_type        TEXT,
        shares            REAL,
        cost_basis        REAL,
        price             REAL,
        price_date        DATE,
        market_value      REAL,
        total_cost_basis  REAL,
        gain_loss_dollar  REAL,
        gain_loss_pct     REAL,
        day_change_dollar REAL,
        day_change_pct    REAL,
        week52_low        REAL,
        week52_high       REAL,
        reinvest_dividends INTEGER NOT NULL DEFAULT 0,
        dividend_yield    REAL,
        last_dividend_date DATE,
        annual_dividend   REAL,
        created_at        DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at        DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);
    db.exec(`CREATE INDEX idx_holdings_acct ON holdings(account_id);`);
    db.exec(`CREATE INDEX idx_holdings_symbol ON holdings(symbol);`);

    // 6. ID map tables.
    db.exec(`
      CREATE TABLE IF NOT EXISTS _account_id_map (
        old_table TEXT NOT NULL, old_id INTEGER NOT NULL,
        new_id INTEGER NOT NULL,
        PRIMARY KEY (old_table, old_id)
      );
    `);
    db.exec(`
      CREATE TABLE IF NOT EXISTS _batch_id_map (
        old_id INTEGER PRIMARY KEY, new_id INTEGER NOT NULL
      );
    `);

    // 7. Copy _legacy_finance_accounts → accounts.
    let copiedFA = 0;
    if (exists('_legacy_finance_accounts')) {
      const rows = db.prepare(`SELECT * FROM _legacy_finance_accounts`).all();
      const ins = db.prepare(`
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
        const info = ins.run(
          r.name, null, t.type,
          r.institution || null, r.account_last4 || null,
          r.current_balance || 0, r.balance_as_of || null,
          r.include_net_worth ? 1 : 0,
          r.is_active != null ? (r.is_active ? 1 : 0) : 1,
          r.notes || null, r.sort_order || 0,
          'manual', t.review
        );
        mapIns.run(r.id, info.lastInsertRowid);
        copiedFA++;
      }
    }
    notes.push(`copied ${copiedFA} finance_accounts → accounts`);

    // 8. Copy _legacy_financial_accounts → accounts (with dedup).
    let copiedINV = 0, mergedINV = 0;
    if (exists('_legacy_financial_accounts')) {
      const rows = db.prepare(`SELECT * FROM _legacy_financial_accounts`).all();
      const findDup = db.prepare(`
        SELECT id FROM accounts
        WHERE COALESCE(institution,'') = COALESCE(?, '')
          AND COALESCE(last4,'') = COALESCE(?, '')
          AND last4 IS NOT NULL AND last4 <> ''
        LIMIT 1
      `);
      const updMerge = db.prepare(`
        UPDATE accounts SET
          alias = COALESCE(alias, ?), owner = COALESCE(owner, ?),
          currency = COALESCE(currency, ?),
          track_statements = COALESCE(track_statements, ?),
          notes = COALESCE(notes, ?),
          source = 'merged', needs_review = 1,
          updated_at = CURRENT_TIMESTAMP
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
        const dup = (r.last_four && String(r.last_four).trim())
          ? findDup.get(r.institution || '', r.last_four) : null;
        if (dup) {
          updMerge.run(
            r.nickname || null, r.owner || null,
            r.currency || 'USD',
            r.track_statements ? 1 : 0,
            r.notes || null, dup.id
          );
          mapIns.run(r.id, dup.id);
          mergedINV++;
        } else {
          const info = insAcc.run(
            r.nickname, null, t.type,
            r.institution || null, r.last_four || null,
            r.owner || null, r.currency || 'USD',
            r.is_active != null ? (r.is_active ? 1 : 0) : 1,
            r.track_statements ? 1 : 0,
            r.notes || null, 'imported', t.review
          );
          mapIns.run(r.id, info.lastInsertRowid);
          copiedINV++;
        }
      }
    }
    notes.push(`copied ${copiedINV} financial_accounts, merged ${mergedINV}`);

    // 9. Copy _legacy_import_batches → import_batches.
    let copiedIB = 0;
    if (exists('_legacy_import_batches')) {
      const rows = db.prepare(`SELECT * FROM _legacy_import_batches`).all();
      const ins = db.prepare(`
        INSERT INTO import_batches
          (account_id, filename, format, row_count, imported_at, statement_date, notes)
        VALUES (?,?,?,?,?,?,?)
      `);
      const lookup = db.prepare(
        `SELECT new_id FROM _account_id_map WHERE old_table='financial_accounts' AND old_id=?`
      );
      const bMap = db.prepare(`INSERT OR IGNORE INTO _batch_id_map (old_id, new_id) VALUES (?, ?)`);
      for (const r of rows) {
        const m = lookup.get(r.account_id);
        if (!m) continue;
        const info = ins.run(
          m.new_id, r.filename, r.format || null,
          r.rows_total || r.row_count || 0,
          r.imported_at || null, r.statement_date || null,
          r.notes || null
        );
        bMap.run(r.id, info.lastInsertRowid);
        copiedIB++;
      }
    }
    notes.push(`copied ${copiedIB} import_batches`);

    // 10. Copy _legacy_holdings → holdings.
    let copiedH = 0;
    if (exists('_legacy_holdings')) {
      const rows = db.prepare(`SELECT * FROM _legacy_holdings`).all();
      const lookup = db.prepare(
        `SELECT new_id FROM _account_id_map WHERE old_table='financial_accounts' AND old_id=?`
      );
      const ins = db.prepare(`
        INSERT INTO holdings
          (account_id, symbol, name, asset_type, shares, cost_basis, price,
           price_date, market_value, total_cost_basis, gain_loss_dollar,
           gain_loss_pct, day_change_dollar, day_change_pct, week52_low,
           week52_high, reinvest_dividends, dividend_yield,
           last_dividend_date, annual_dividend)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
      `);
      for (const r of rows) {
        const m = lookup.get(r.account_id);
        if (!m) continue;
        ins.run(
          m.new_id, r.symbol, r.name || null, r.asset_type || null,
          r.shares || 0, r.cost_basis || null, r.price || null,
          r.price_date || null, r.market_value || null,
          r.total_cost_basis || null, r.gain_loss_dollar || null,
          r.gain_loss_pct || null, r.day_change_dollar || null,
          r.day_change_pct || null, r.week52_low || null,
          r.week52_high || null, r.reinvest_dividends ? 1 : 0,
          r.dividend_yield || null, r.last_dividend_date || null,
          r.annual_dividend || null
        );
        copiedH++;
      }
    }
    notes.push(`copied ${copiedH} holdings`);

    // 11. Copy _legacy_finance_transactions → transactions (manual).
    let copiedFT = 0;
    if (exists('_legacy_finance_transactions')) {
      const rows = db.prepare(`SELECT * FROM _legacy_finance_transactions`).all();
      const lookup = db.prepare(
        `SELECT new_id FROM _account_id_map WHERE old_table='finance_accounts' AND old_id=?`
      );
      const ins = db.prepare(`
        INSERT INTO transactions
          (account_id, date, description, amount, category, notes,
           is_reconciled, batch_id, fingerprint, source, needs_review,
           txn_type, created_at)
        VALUES (?,?,?,?,?,?,?,?,?, 'manual', 0, 'transaction', ?)
      `);
      for (const r of rows) {
        const m = lookup.get(r.account_id);
        if (!m) continue;
        const fp = fingerprint(m.new_id, r.date, r.amount, r.description);
        ins.run(
          m.new_id, r.date, r.description, r.amount,
          r.category || null, r.notes || null,
          r.is_reconciled ? 1 : 0,
          r.batch_id || null, fp,
          r.created_at || null
        );
        copiedFT++;
      }
    }
    notes.push(`copied ${copiedFT} finance_transactions`);

    // 12. Copy _legacy_imported_transactions → transactions (imported).
    let copiedIT = 0;
    if (exists('_legacy_imported_transactions')) {
      const rows = db.prepare(`SELECT * FROM _legacy_imported_transactions`).all();
      const lookupAcct = db.prepare(
        `SELECT new_id FROM _account_id_map WHERE old_table='financial_accounts' AND old_id=?`
      );
      const lookupBatch = db.prepare(`SELECT new_id FROM _batch_id_map WHERE old_id=?`);
      const ins = db.prepare(`
        INSERT INTO transactions
          (account_id, batch_id, date, post_date, description, amount, balance,
           category, txn_type, is_transfer, memo, fingerprint, flagged,
           source, needs_review, created_at)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?, 'imported', ?, ?)
      `);
      for (const r of rows) {
        const m = lookupAcct.get(r.account_id);
        if (!m) continue;
        const newBatch = r.batch_id ? lookupBatch.get(r.batch_id)?.new_id || null : null;
        const date = r.txn_date || r.date;
        const fp = fingerprint(m.new_id, date, r.amount, r.description);
        ins.run(
          m.new_id, newBatch, date, r.post_date || null,
          r.description, r.amount, r.balance || null,
          r.category || null, r.txn_type || 'transaction',
          r.is_transfer ? 1 : 0,
          r.memo || null, fp, r.flagged ? 1 : 0,
          r.flagged ? 1 : 0, r.created_at || null
        );
        copiedIT++;
      }
    }
    notes.push(`copied ${copiedIT} imported_transactions`);

    // 13. Compat views.
    db.exec(`
      CREATE VIEW finance_accounts AS
      SELECT id, name, type, institution, last4 AS account_last4,
             current_balance, balance_as_of, is_active,
             include_net_worth, notes, sort_order, created_at, updated_at
      FROM accounts;
    `);
    db.exec(`
      CREATE VIEW financial_accounts AS
      SELECT id, name AS nickname, institution, type AS account_type,
             owner, last4 AS last_four, currency,
             is_active, track_statements, notes, created_at, updated_at
      FROM accounts;
    `);
    db.exec(`
      CREATE VIEW finance_transactions AS
      SELECT id, account_id, date, description, amount, category, notes,
             is_reconciled, batch_id, created_at
      FROM transactions WHERE source = 'manual';
    `);
    db.exec(`
      CREATE VIEW imported_transactions AS
      SELECT id, account_id, batch_id, date AS txn_date, post_date,
             description, amount, balance, category, txn_type,
             is_transfer, memo, fingerprint, flagged, created_at
      FROM transactions WHERE source = 'imported';
    `);
    db.exec(`
      CREATE VIEW fin_import_batches AS
      SELECT id, account_id, filename, format,
             row_count AS rows_total, row_count AS rows_imported,
             0 AS rows_skipped, 0 AS rows_flagged,
             'banking' AS account_type, 'complete' AS status,
             NULL AS error_message,
             imported_at, statement_date, notes
      FROM import_batches;
    `);
    notes.push('created 5 compat views');

    // 14. Marker tables — clear any bogus rows, seed correct ones.
    db.exec(`CREATE TABLE IF NOT EXISTS _migrations_finance_unify_done
             (done_at DATETIME DEFAULT CURRENT_TIMESTAMP, version TEXT);`);
    db.exec(`CREATE TABLE IF NOT EXISTS _migrations_fingerprint_v2_done
             (done_at DATETIME DEFAULT CURRENT_TIMESTAMP, version TEXT,
              rows_recomputed INTEGER, dups_flagged INTEGER);`);
    db.exec(`CREATE TABLE IF NOT EXISTS _migrations_cc_columns_done
             (done_at DATETIME DEFAULT CURRENT_TIMESTAMP, version TEXT);`);
    db.prepare(`DELETE FROM _migrations_finance_unify_done`).run();
    db.prepare(`DELETE FROM _migrations_fingerprint_v2_done`).run();
    db.prepare(`DELETE FROM _migrations_cc_columns_done`).run();
    db.prepare(`INSERT INTO _migrations_finance_unify_done (version) VALUES ('202604.159-rescue')`).run();
    db.prepare(`INSERT INTO _migrations_fingerprint_v2_done (version, rows_recomputed, dups_flagged) VALUES ('202604.159-rescue', ?, 0)`)
      .run(copiedFT + copiedIT);
    db.prepare(`INSERT INTO _migrations_cc_columns_done (version) VALUES ('202604.159-rescue')`).run();

    // 15. Log mig 126/127/128 in the runner's _migrations.
    if (exists('_migrations')) {
      const ins = db.prepare(`INSERT OR IGNORE INTO _migrations (filename) VALUES (?)`);
      for (const f of ['126_finance_unify.js','127_fingerprint_v2.js','128_cc_columns.js']) {
        ins.run(f);
      }
    }

    // Clear any prior failed rescue row before marking success.
    db.prepare(`DELETE FROM _migrations_rescue_126_done`).run();
    db.prepare(`INSERT INTO _migrations_rescue_126_done (version, notes) VALUES (?, ?)`)
      .run('202604.159', notes.join('; '));
  });

  try {
    rescue();
  } catch (e) {
    try {
      db.prepare(`INSERT INTO _migrations_rescue_126_done (version, notes) VALUES (?, ?)`)
        .run('202604.159', 'RESCUE FAILED: ' + e.message + ' | partial: ' + notes.join('; '));
    } catch { /* ignore */ }
    throw e;
  }
};
