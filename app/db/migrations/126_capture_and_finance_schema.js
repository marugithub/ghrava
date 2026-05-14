// Migration 126 — capture-everything pipeline + finance round 2/3 schema
//
// Locked decisions from the v.151 design conversations are turned into
// schema. Every change is additive, idempotent, and free of CASCADE
// per the project arch rule. Three thematic groups:
//
// ─── A. Universal capture-everything pipeline ─────────────────
// EOB taught us: every imported field must be retrievable later, even
// if the parser doesn't surface it today. The same rule applies to
// finance imports, future PDF/HTML parsers, and anything else that
// turns an external file into a row. Three columns get added across
// every table that currently swallows external rows:
//   raw_payload     — JSON of the original row/field-set (TEXT, NULLABLE)
//   source_filename — the file the row came from (TEXT, NULLABLE)
//   source_format   — parser identifier (TEXT, NULLABLE)
// imported_transactions also gets:
//   normalized_description — for dedup separate from display
//   pending_or_posted      — explicit lifecycle flag
//   raw_headers            — JSON column-header order from the file
//
// ─── B. Universal cross-module link table ─────────────────────
// New table `record_links` connects any record in any module to any
// other record. Replaces planned `tx_record_links` (finance-only) with
// a system-wide design. Used cases:
//   - finance txn → vehicle (fuel charge)
//   - finance txn → prescription (CVS charge)
//   - finance txn → EOB (medical bill payment)
//   - HSA receipt → EOB claim
//   - inventory item → maintenance event
//   - document → any record (receipt vault is the obvious case)
//   - many more once we wire it
// Junction-style: (left_type, left_id, right_type, right_id, link_kind).
// No FK constraints (per arch rule); orphans are tolerated.
//
// ─── C. Finance round-2/3 schema ──────────────────────────────
// Credit-card-specific columns on finance_accounts (alias is universal,
// the rest are credit-card-only but harmless on other rows). Plus an
// FX/currency stamp on transactions that the parsers already surface
// but had nowhere to land.
//
// All additive. Idempotent. Safe to re-run. No CASCADE anywhere.

module.exports = function (db) {
  const addCol = (table, sql) => {
    try { db.exec(`ALTER TABLE ${table} ADD COLUMN ${sql}`); }
    catch (e) {
      if (!/duplicate column/i.test(e.message)) throw e;
    }
  };
  const tableExists = (name) =>
    !!db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name=?").get(name);
  const indexExists = (name) =>
    !!db.prepare("SELECT 1 FROM sqlite_master WHERE type='index' AND name=?").get(name);

  const tx = db.transaction(() => {

    // ─────────────────────────────────────────────────────────
    // A. UNIVERSAL CAPTURE-EVERYTHING
    // ─────────────────────────────────────────────────────────

    // A.1 — finance imports
    addCol('imported_transactions', 'raw_payload            TEXT');
    addCol('imported_transactions', 'raw_headers            TEXT');
    addCol('imported_transactions', 'source_filename        TEXT');
    addCol('imported_transactions', 'source_format          TEXT');
    addCol('imported_transactions', 'normalized_description TEXT');
    addCol('imported_transactions', 'pending_or_posted      TEXT'); // 'pending' | 'posted' | NULL
    addCol('imported_transactions', 'fx_currency            TEXT');
    addCol('imported_transactions', 'fx_amount              REAL');
    addCol('imported_transactions', 'fx_rate                REAL');

    // import_batches gets matching capture columns
    addCol('import_batches', 'raw_headers     TEXT');  // header row, JSON-encoded
    addCol('import_batches', 'source_format   TEXT');  // parser-id used (already had `format`,
                                                       // but `source_format` aligns with the
                                                       // universal column name across tables)

    // A.2 — EOBs already store the structured fields. Add the raw payload
    //       and provenance columns to mirror the universal pattern.
    addCol('med_eob_statements', 'raw_payload     TEXT');
    addCol('med_eob_statements', 'source_format   TEXT');
    // (file_hash, dedup_hash, source_filename, auto_imported already exist)

    addCol('med_eob_claims',    'raw_payload     TEXT');
    addCol('med_eob_services',  'raw_payload     TEXT');
    addCol('med_eob_balances',  'raw_payload     TEXT');

    // A.3 — Holdings (CSV import surfaces fields parsers don't always store)
    addCol('holdings', 'raw_payload     TEXT');
    addCol('holdings', 'source_filename TEXT');
    addCol('holdings', 'source_format   TEXT');

    // A.4 — HSA / FSA payments already track inbox attachments; mirror the
    //       capture columns for raw OCR / vendor-name JSON when wired.
    if (tableExists('hsa_payments')) {
      addCol('hsa_payments', 'raw_payload     TEXT');
      addCol('hsa_payments', 'source_filename TEXT');
      addCol('hsa_payments', 'source_format   TEXT');
    }
    if (tableExists('fsa_payments')) {
      addCol('fsa_payments', 'raw_payload     TEXT');
      addCol('fsa_payments', 'source_filename TEXT');
      addCol('fsa_payments', 'source_format   TEXT');
    }

    // A.5 — Indexes that pay off on the new lookup paths
    if (!indexExists('idx_imp_tx_norm_desc')) {
      db.exec(`CREATE INDEX idx_imp_tx_norm_desc
               ON imported_transactions(account_id, normalized_description)
               WHERE normalized_description IS NOT NULL`);
    }
    if (!indexExists('idx_imp_tx_pending')) {
      db.exec(`CREATE INDEX idx_imp_tx_pending
               ON imported_transactions(account_id, pending_or_posted, txn_date DESC)`);
    }


    // ─────────────────────────────────────────────────────────
    // B. UNIVERSAL CROSS-MODULE LINK TABLE
    // ─────────────────────────────────────────────────────────
    // Symmetric junction. Left and right are interchangeable; the
    // application layer chooses which is which by convention.
    //
    // link_kind values (suggested, not enforced):
    //   'evidence'      — left documents/proves right (txn → receipt)
    //   'paid_for'      — left paid for right (txn → EOB, txn → prescription)
    //   'related_to'    — generic association
    //   'reimburses'    — left reimburses right (FSA payment → HSA expense)
    //   'splits_with'   — left splits with right (one txn split across categories)
    //   'replaces'      — left replaces right (new policy → old policy)
    if (!tableExists('record_links')) {
      db.exec(`
        CREATE TABLE record_links (
          id          INTEGER PRIMARY KEY AUTOINCREMENT,
          left_type   TEXT NOT NULL,
          left_id     INTEGER NOT NULL,
          right_type  TEXT NOT NULL,
          right_id    INTEGER NOT NULL,
          link_kind   TEXT NOT NULL DEFAULT 'related_to',
          notes       TEXT,
          created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
          created_by  TEXT DEFAULT 'manual'
        )
      `);
    }
    if (!indexExists('idx_record_links_left')) {
      db.exec(`CREATE INDEX idx_record_links_left
               ON record_links(left_type, left_id)`);
    }
    if (!indexExists('idx_record_links_right')) {
      db.exec(`CREATE INDEX idx_record_links_right
               ON record_links(right_type, right_id)`);
    }
    if (!indexExists('idx_record_links_kind')) {
      db.exec(`CREATE INDEX idx_record_links_kind
               ON record_links(link_kind)`);
    }
    // Prevent exact-duplicate links. Different link_kind between the
    // same pair IS allowed (e.g. both 'paid_for' AND 'evidence').
    if (!indexExists('idx_record_links_unique')) {
      db.exec(`CREATE UNIQUE INDEX idx_record_links_unique
               ON record_links(left_type, left_id, right_type, right_id, link_kind)`);
    }


    // ─────────────────────────────────────────────────────────
    // C. FINANCE ROUND-2/3 SCHEMA — finance_accounts
    // ─────────────────────────────────────────────────────────
    // Note: the legacy `finance_accounts` (mig 020) and the import-side
    // `financial_accounts` (mig 032) are SEPARATE tables. Per project
    // rule they are never joined; banking lives in finance_accounts,
    // and import lives in financial_accounts. Round-2 cards display
    // from financial_accounts (the import side). Add columns to BOTH
    // so manual-entry bank rows and imported rows can share the card.
    //
    // alias is universal — applies to checking, savings, credit, brokerage.
    // The rest are credit-card-specific but additive (NULL on non-credit).

    addCol('finance_accounts',   'alias                       TEXT');
    addCol('finance_accounts',   'credit_limit                REAL');
    addCol('finance_accounts',   'payment_due_date            DATE');
    addCol('finance_accounts',   'minimum_payment             REAL');
    addCol('finance_accounts',   'statement_balance           REAL');
    addCol('finance_accounts',   'statement_date              DATE');
    addCol('finance_accounts',   'apr                         REAL');
    addCol('finance_accounts',   'promo_apr                   REAL');
    addCol('finance_accounts',   'promo_end_date              DATE');
    addCol('finance_accounts',   'annual_fee                  REAL');
    addCol('finance_accounts',   'annual_fee_renewal_date     DATE');
    addCol('finance_accounts',   'rewards_balance             REAL');
    addCol('finance_accounts',   'rewards_program             TEXT');

    addCol('financial_accounts', 'alias                       TEXT');
    addCol('financial_accounts', 'credit_limit                REAL');
    addCol('financial_accounts', 'payment_due_date            DATE');
    addCol('financial_accounts', 'minimum_payment             REAL');
    addCol('financial_accounts', 'statement_balance           REAL');
    addCol('financial_accounts', 'statement_date              DATE');
    addCol('financial_accounts', 'apr                         REAL');
    addCol('financial_accounts', 'promo_apr                   REAL');
    addCol('financial_accounts', 'promo_end_date              DATE');
    addCol('financial_accounts', 'annual_fee                  REAL');
    addCol('financial_accounts', 'annual_fee_renewal_date     DATE');
    addCol('financial_accounts', 'rewards_balance             REAL');
    addCol('financial_accounts', 'rewards_program             TEXT');

    if (!indexExists('idx_finance_accounts_due')) {
      db.exec(`CREATE INDEX idx_finance_accounts_due
               ON finance_accounts(payment_due_date)
               WHERE payment_due_date IS NOT NULL`);
    }
    if (!indexExists('idx_financial_accounts_due')) {
      db.exec(`CREATE INDEX idx_financial_accounts_due
               ON financial_accounts(payment_due_date)
               WHERE payment_due_date IS NOT NULL`);
    }

  });

  tx();
};
