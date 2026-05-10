#!/usr/bin/env node
// ═════════════════════════════════════════════════════════════════
// test/run-parser-tests.js  (v202604.155)
//
// Sign-convention regression tests for bank statement parsers.
// Each fixture pair is `<bank>.csv` + `<bank>.json` in
// `test/parser-fixtures/`. The `.json` file declares:
//   - format          (expected detected format string)
//   - min_transactions (lower-bound row count after parse)
//   - first_transaction (optional spot-check on first row)
//   - amount_signs    (substring → "positive" | "negative")
//   - note            (free-form, ignored at runtime)
//
// Why this exists:
//   The biggest risk in the import path is a parser silently
//   flipping a sign on a future bank-format change. A debit becomes
//   a credit. Net worth is wrong. No exception fires. These tests
//   pin the contract on a representative row per bank so a future
//   parser change that breaks sign convention fails loudly.
//
// To run:
//   node test/run-parser-tests.js
//
// The script exits with code 0 on full pass, non-zero on any
// failure. Add to predeploy gate when ready.
// ═════════════════════════════════════════════════════════════════

'use strict';
const fs   = require('fs');
const path = require('path');

const fixturesDir = path.join(__dirname, 'parser-fixtures');
const parsersPath = path.resolve(__dirname, '..', 'app', 'features', 'import', 'parsers.js');
let parseFile;
try {
  ({ parseFile } = require(parsersPath));
} catch (e) {
  console.error('Could not load parsers.js:', e.message);
  process.exit(2);
}

function loadFixtures() {
  const files = fs.readdirSync(fixturesDir).filter(f => f.endsWith('.json'));
  return files.map(f => {
    const stem = f.replace(/\.json$/, '');
    const csvPath  = path.join(fixturesDir, stem + '.csv');
    const jsonPath = path.join(fixturesDir, f);
    if (!fs.existsSync(csvPath)) return null;
    return {
      bank: stem,
      csv:  fs.readFileSync(csvPath, 'utf8'),
      meta: JSON.parse(fs.readFileSync(jsonPath, 'utf8')),
    };
  }).filter(Boolean);
}

function run() {
  const fixtures = loadFixtures();
  if (!fixtures.length) {
    console.error('No fixtures found in', fixturesDir);
    process.exit(2);
  }

  let total = 0, pass = 0, fail = 0;
  const failures = [];

  for (const fx of fixtures) {
    total++;
    const result = parseFile(fx.csv, `${fx.bank}.csv`);

    const errors = [];

    // Check format detection. We allow the fixture to declare a
    // generic match like "default" to mean "we don't care, just
    // make sure it parsed."
    if (fx.meta.format && fx.meta.format !== 'default' && result.format !== fx.meta.format) {
      errors.push(`format: expected "${fx.meta.format}" got "${result.format}"`);
    }

    // Min transactions
    const txCount = (result.transactions || []).length;
    if (txCount < fx.meta.min_transactions) {
      errors.push(`only ${txCount} transactions parsed (expected ≥ ${fx.meta.min_transactions})`);
    }

    // First-row spot check
    if (fx.meta.first_transaction && result.transactions[0]) {
      const ft = fx.meta.first_transaction;
      const r0 = result.transactions[0];
      if (ft.date && r0.date !== ft.date) {
        errors.push(`first row date: expected "${ft.date}" got "${r0.date}"`);
      }
      if (ft.amount != null && Math.abs(r0.amount - ft.amount) > 0.001) {
        errors.push(`first row amount: expected ${ft.amount} got ${r0.amount}`);
      }
      if (ft.description_contains && !(r0.description || '').includes(ft.description_contains)) {
        errors.push(`first row description missing "${ft.description_contains}" (got "${r0.description}")`);
      }
    }

    // Sign-convention checks: find first row where description
    // includes the keyword and check sign of its amount.
    if (fx.meta.amount_signs) {
      for (const [needle, expectedSign] of Object.entries(fx.meta.amount_signs)) {
        const row = result.transactions.find(t =>
          (t.description || '').toUpperCase().includes(needle.toUpperCase())
        );
        if (!row) {
          errors.push(`sign check: no row matched "${needle}"`);
          continue;
        }
        const actualSign = row.amount > 0 ? 'positive' : (row.amount < 0 ? 'negative' : 'zero');
        if (actualSign !== expectedSign) {
          errors.push(`sign for "${needle}": expected ${expectedSign} got ${actualSign} (amount=${row.amount})`);
        }
      }
    }

    if (errors.length) {
      fail++;
      failures.push({ bank: fx.bank, errors });
      console.log(`✗ ${fx.bank}`);
      for (const e of errors) console.log(`    - ${e}`);
    } else {
      pass++;
      console.log(`✓ ${fx.bank}`);
    }
  }

  console.log(`\n${pass}/${total} passed${fail ? `, ${fail} failed` : ''}`);
  process.exit(fail ? 1 : 0);
}

run();
