/**
 * Smoke test for GH_CARD renderer + batch1 module configs.
 *
 * Runs in Node via JSDOM. Loads the renderer + shared helpers + configs,
 * feeds each config a synthetic record, asserts that the resulting DOM
 * contains the expected zones (status, identity, optionally cross-module,
 * optionally alert, entities, drill).
 *
 * Run from ghrava root:  node tests/smoke-cards.js
 */

const fs = require('fs');
const path = require('path');
const Module = require('module');
// Allow JSDOM resolution from /tmp/test-deps (test-only dependency, not in app deps)
const ALT = '/tmp/test-deps/node_modules';
if (fs.existsSync(ALT)) Module.globalPaths.push(ALT);
const { JSDOM } = require(path.join(ALT, 'jsdom'));

const HEAD = path.join(__dirname, '..', 'app', 'public');

function load(file) {
  return fs.readFileSync(path.join(HEAD, file), 'utf8');
}

const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>', {
  runScripts: 'outside-only',
  pretendToBeVisual: true,
});

// Stub fetch + tools used by configs but not relevant for render
dom.window.fetch = () => Promise.resolve({ json: () => Promise.resolve([]) });
dom.window.familyMembers = [
  { id: 1, display_name: 'Al', first_name: 'Al', avatar_attachment_id: null },
  { id: 2, display_name: 'Sarah', first_name: 'Sarah', avatar_attachment_id: null },
];

// Inject scripts in order
function inject(src) {
  dom.window.eval(src);
}
inject(load('js/gh-card.js'));
inject(load('js/gh-card-shared.js'));
inject(load('js/gh-card-configs-batch1.js'));

const { GH_CARD } = dom.window;
if (!GH_CARD) {
  console.error('FAIL: GH_CARD not registered on window');
  process.exit(1);
}

// ── Test cases ─────────────────────────────────────────────────
const tests = [
  {
    moduleId: 'vehicles',
    record: {
      id: 1, make: 'Honda', model: 'Civic LX', year: 2022,
      body_type: 'Sedan', fuel_type: 'Hybrid', color: 'Lunar Silver',
      odometer_current: 34210, last_service_odometer: 31270, next_service_miles: 36270,
      registration_expires_at: '2027-07-31',  // far out — no alert
      ytd_fuel: 642, service_ytd: 0,
      owner_family_member_id: 1,
      insurer_brand: 'State Farm', insurer_brand_color: '#d50000',
      attachment_count: 3,
      plate_number: 'ABC-7392',
      location: 'Garage at home',
      usage_type: 'Daily driver',
    },
    expect: {
      hasStatusRow: true,
      hasIdentity: true,
      hasCrossModule: true,
      hasAlert: false,  // 2,940/5,000 = 58% — no alert, reg far out
      hasEntities: true,
    },
  },
  {
    moduleId: 'vehicles',
    record: {
      id: 2, make: 'Toyota', model: '4Runner SR5', year: 2018,
      odometer_current: 87940, last_service_odometer: 83120, next_service_miles: 88120,
      registration_expires_at: '2026-07-31',
      insurance_renewal_at: '2026-08-15',
      ytd_fuel: 1180, service_ytd: 420,
      owner_family_member_id: 1,
      plate_number: 'XYZ-9921',
    },
    expect: { hasAlert: true },  // 96% odometer + reg + ins all due
  },
  {
    moduleId: 'subscriptions',
    record: {
      id: 1, service_name: 'Netflix', plan_name: 'Premium · 4K · 4 screens',
      brand_color: '#E50914', brand_wordmark: 'NETFLIX',
      next_charge_at: '2026-06-22',
      annual_cost: 263.88, last_3_charges_total: 66.97, active_since: '2019-09-01',
      price_increased_recently: true,
      price_delta: 2, previous_price: 20.99, current_price: 22.99,
      price_change_at: '2026-05-14',
      annual_cost_asterisk: 'red',
      owner_family_member_id: 1,
      category: 'Entertainment',
      shared_with_family: true, shared_count: 4,
    },
    expect: { hasAlert: true, hasCrossModule: true },
  },
  {
    moduleId: 'subscriptions',
    record: {
      id: 2, service_name: 'Spotify', plan_name: 'Family · 6 accounts',
      brand_color: '#1DB954', brand_wordmark: 'Spotify',
      next_charge_at: '2026-06-14',
      annual_cost: 203.88, last_3_charges_total: 50.97, active_since: '2021-03-01',
      price_increased_recently: false,
      owner_family_member_id: 1,
    },
    expect: { hasAlert: false },  // healthy
  },
  {
    moduleId: 'finance_accounts',
    record: {
      id: 1, nickname: 'Al Checking', institution: 'Chase',
      account_type: 'checking', last_four: '4827',
      balance_current: 8420, balance_change_30d: 1240,
      ytd_activity_count: 312,
      bank_brand: 'Chase', bank_brand_color: '#0a4abf',
      owner_family_member_id: 1,
      last_import_at: '2026-04-30',
    },
    expect: { hasAlert: false },
  },
  {
    moduleId: 'finance_accounts',
    record: {
      id: 2, nickname: 'Joint Savings', institution: 'Navy Fed',
      account_type: 'savings',
      balance_current: 250, low_balance_threshold: 1000,
      bank_brand: 'Navy Fed',
      owner_family_member_id: 1,
      is_joint: true,
    },
    expect: { hasAlert: true },  // low balance
  },
  {
    moduleId: 'hsa_accounts',
    record: {
      id: 1, tax_year: 2026, plan_type: 'family',
      contribution_limit: 8300, contribution_ytd: 5460,
      provider_brand: 'Fidelity', provider_brand_color: '#3d8b40',
      spent_ytd: 2840, receipts_pending_count: 3, eligible_matches_count: 7,
      owner_family_member_id: 1,
    },
    expect: { hasAlert: true },  // 3 receipts pending
  },
  {
    moduleId: 'maintenance',
    record: {
      id: 1, name: 'HVAC Filter Replacement', system: 'HVAC',
      frequency_days: 90, last_done_at: '2026-01-15', next_due_at: '2026-04-15',
      last_cost: 18, avg_cost: 18,
      assignee_family_member_id: 1,
    },
    expect: { hasAlert: true },  // next_due_at in past = overdue
  },
  {
    moduleId: 'maintenance',
    record: {
      id: 2, name: 'Lawn fertilizer', system: 'Yard',
      frequency_days: 60, last_done_at: '2026-04-10', next_due_at: '2026-06-09',
      assignee_family_member_id: 1,
    },
    expect: { hasAlert: false },
  },
  {
    moduleId: 'books',
    record: {
      id: 1, title: 'The Pragmatic Programmer', author: 'Hunt & Thomas',
      status: 'reading', genre: 'Tech', format: 'Hardcover',
      total_pages: 320, current_page: 184,
      target_finish_at: '2026-06-14', pages_per_day_needed: 4,
      pages_today: 12, streak_days: 7, pace_status: 'on track',
      reader_family_member_id: 1,
    },
    expect: { hasAlert: false },
  },
  {
    moduleId: 'trade_positions',
    record: {
      id: 1, symbol: 'AAPL', company_name: 'Apple Inc.',
      position_type: 'long', sector: 'Technology',
      current_price: 178.42, day_change_pct: 1.24,
      cost_basis: 12500, current_value: 14820, realized_ytd: 0,
      account_id: 1, account_brand: 'Schwab',
    },
    expect: { hasAlert: false },
  },
];

let pass = 0, fail = 0;
const failures = [];

for (const t of tests) {
  try {
    const node = GH_CARD.render(t.moduleId, t.record);
    if (!node) throw new Error('render returned null');

    const html = node.outerHTML;

    const checks = [
      ['hasStatusRow', /<div class="gh-card__status-row/.test(html)],
      ['hasIdentity', /<div class="gh-card__identity/.test(html)],
      ['hasCrossModule', /<div class="gh-card__cross/.test(html)],
      ['hasAlert', /<div class="gh-card__alert(\s|"|\sgh-)/.test(html)],
      ['hasEntities', /<div class="gh-card__entities/.test(html)],
    ];

    let recordOk = true;
    const recordIssues = [];
    for (const [key, actual] of checks) {
      const expected = t.expect[key];
      if (expected != null && expected !== actual) {
        recordOk = false;
        recordIssues.push(`${key}: expected=${expected}, actual=${actual}`);
      }
    }

    if (recordOk) {
      pass++;
      console.log(`  PASS  ${t.moduleId} #${t.record.id}`);
    } else {
      fail++;
      failures.push({ test: `${t.moduleId} #${t.record.id}`, issues: recordIssues });
      console.log(`  FAIL  ${t.moduleId} #${t.record.id} — ${recordIssues.join('; ')}`);
    }
  } catch (e) {
    fail++;
    failures.push({ test: `${t.moduleId} #${t.record.id}`, issues: [e.message] });
    console.log(`  THREW ${t.moduleId} #${t.record.id}: ${e.message}`);
  }
}

console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) {
  console.log('\nFailures:');
  for (const f of failures) console.log(`  - ${f.test}: ${f.issues.join(' | ')}`);
  process.exit(1);
}
