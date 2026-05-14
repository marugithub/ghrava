#!/usr/bin/env node
// scripts/seed-medical.js  —  v202604.166
//
// Pipes a health seed JSON file into POST /api/v1/medical/bulk-seed.
//
// Usage (inside container):
//   docker exec -it ghrava node /app/scripts/seed-medical.js \
//     --file /app/seeds/medical_algir.json
//
//   # Dry run first to confirm mapping + counts:
//   docker exec -it ghrava node /app/scripts/seed-medical.js \
//     --file /app/seeds/medical_algir.json --dry-run
//
// Idempotent — re-running skips any record whose dedup_hash already
// exists. Safe to run many times. Per-section counts printed at end.

'use strict';

const fs   = require('fs');
const path = require('path');
const http = require('http');

function arg(name, def) {
  const i = process.argv.indexOf(name);
  if (i === -1) return def;
  return process.argv[i + 1];
}

const FILE    = arg('--file', null);
const HOST    = arg('--host', '127.0.0.1');
const PORT    = parseInt(arg('--port', '3001'), 10);
const TOKEN   = process.env.GHRAVA_AUTH_TOKEN || arg('--token', '');
const DRY_RUN = process.argv.includes('--dry-run');

if (!FILE) {
  console.error('Usage: node scripts/seed-medical.js --file <path> [--dry-run] [--host h] [--port p] [--token t]');
  process.exit(2);
}

const seed = JSON.parse(fs.readFileSync(FILE, 'utf8'));
const body = JSON.stringify(seed);

const opts = {
  host:    HOST,
  port:    PORT,
  path:    '/api/v1/medical/bulk-seed' + (DRY_RUN ? '?dry_run=1' : ''),
  method:  'POST',
  headers: {
    'Content-Type':   'application/json',
    'Content-Length': Buffer.byteLength(body),
    ...(TOKEN ? { 'Authorization': `Bearer ${TOKEN}` } : {}),
  },
};

const req = http.request(opts, (res) => {
  let out = '';
  res.on('data', (c) => out += c);
  res.on('end', () => {
    if (res.statusCode >= 400) {
      console.error(`HTTP ${res.statusCode}\n${out}`);
      process.exit(1);
    }
    try {
      const r = JSON.parse(out);
      if (r.dry_run) {
        console.log(`DRY RUN — would map seed → family_member id=${r.mapped_family_id} (${r.mapped_family_name})`);
        console.log(`Section counts (input):`);
        Object.entries(r.counts).forEach(([k, v]) => console.log(`  ${k.padEnd(14)} ${v}`));
        console.log(`\nNo data written. Re-run without --dry-run to import.`);
      } else {
        console.log(`Mapped seed → family_member id=${r.mapped_family_id} (${r.mapped_family_name})`);
        console.log(`Per-section results:`);
        Object.entries(r.results).forEach(([k, v]) => {
          console.log(`  ${k.padEnd(14)} inserted=${String(v.inserted).padStart(4)}  skipped=${String(v.skipped).padStart(4)}`);
        });
        console.log(`\nTotal inserted: ${r.total_inserted}    Total skipped: ${r.total_skipped}`);
      }
    } catch (e) {
      console.log(out);
    }
  });
});
req.on('error', (e) => { console.error(`Request failed: ${e.message}`); process.exit(1); });
req.write(body);
req.end();
