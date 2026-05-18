/**
 * ghrava-e2e.spec.js — Ghrava Nightly E2E Test Suite
 *
 * Runs against the live Ghrava instance. Catches:
 *   - Pages that render raw HTML as visible text (the fileLink bug class)
 *   - JS errors on page load
 *   - Missing key UI elements
 *   - CRUD flows with automatic cleanup
 *   - Tag chip rendering (elements, not text)
 *   - Drawer open/close
 *
 * Usage:
 *   npx playwright test --config=tests/playwright.config.js
 *
 * Auto-cleanup: all test records use prefix _e2e_ and are deleted
 * within the same test. No purge endpoint needed.
 */

const { test, expect } = require('@playwright/test');

const BASE = process.env.GHRAVA_URL || 'http://192.168.4.62:3001';
const API  = BASE + '/api/v1';

// ── Auth ──────────────────────────────────────────────────────
// GHRAVA_TOKEN env var holds the user's PASSWORD (passed via -AuthToken in
// run-tests.ps1). Ghrava's auth system requires us to exchange the password
// for a session token via POST /auth/login. Tokens live in a DB table; the
// raw password sent as Bearer fails with "Session expired".
const AUTH_PASSWORD = process.env.GHRAVA_TOKEN || '';
let SESSION_TOKEN   = '';   // set by test.beforeAll, used by all writes
let AUTH_HEADERS    = {};   // populated after login

test.beforeAll(async () => {
  if (!AUTH_PASSWORD) return;  // open mode — no password required
  const r = await fetch(`${API}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password: AUTH_PASSWORD }),
  });
  if (!r.ok) {
    console.error(`Login failed: ${r.status} ${await r.text()}`);
    return;
  }
  const data = await r.json();
  SESSION_TOKEN = data.token;
  AUTH_HEADERS  = { 'Authorization': `Bearer ${SESSION_TOKEN}` };
  console.log(`Logged in — session token acquired (expires in ${data.expires_in_hours}h)`);
});

// ── Helpers ───────────────────────────────────────────────────

/** Check a page for raw HTML text (the fileLink bug class).
 *
 * Only looks for the specific patterns that indicate a template literal
 * rendered its HTML as text instead of markup:
 *   - <button onclick=  or  <button class=  (inline JS/style leaking out)
 *   - style="font-size: appearing in body text (inline style strings rendered as text)
 *   - window.LT?.toast  (JS code visible as text — the original fileLink bug)
 *
 * Deliberately does NOT match <div or <span broadly — those appear in
 * code examples, SVG paths, and tooltip titles and produce false positives.
 *
 * Skips: <pre>, <code>, <script>, <style>, log viewer elements.
 */
async function checkNoRawHtml(page, url, description) {
  // Use 'load' instead of 'networkidle' — Ghrava polls /notifications/unread-count
  // on a 30s interval, so networkidle never resolves and we'd burn the full
  // navigation timeout per page (10s). 'load' returns the moment static
  // resources are done. We then briefly wait for the spinner to clear so
  // template literals have a chance to render before we scan.
  await page.goto(url, { waitUntil: 'load' });
  try {
    await page.waitForFunction(
      () => !document.querySelector('.spinner .spin'),
      { timeout: 800 }
    );
  } catch { /* proceed — page may not have a spinner */ }

  const rawHtml = await page.evaluate(() => {
    // Specific patterns for the "template literal rendered as text" bug class
    const badPatterns = [
      /window\.LT\??\.toast/,       // JS code visible — original fileLink bug
      /<button[^>]*onclick=/,         // onclick attribute leaked into text
      /<button[^>]*class="file-copy/, // file-copy-btn rendered as text
      /style="font-size:11px;color:var/, // inline style string leaked
      /navigator\.clipboard\.write/, // clipboard JS visible as text
    ];

    // Skip elements that legitimately show code/HTML
    const skipSelectors = [
      'pre', 'code', 'script', 'style',
      '#logViewer', '#rpt_logViewer', '#diagLog', '#rpt_diagLog',
      '.diag-test-det', '[style*="font-family:var(--mono)"]',
    ];

    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    const bad = [];
    let node;
    while ((node = walker.nextNode())) {
      // Skip if inside a code/log element
      let el = node.parentElement;
      let skip = false;
      while (el && el !== document.body) {
        if (skipSelectors.some(sel => { try { return el.matches(sel); } catch { return false; } })) {
          skip = true; break;
        }
        el = el.parentElement;
      }
      if (skip) continue;

      const text = node.textContent.trim();
      if (text.length > 5 && badPatterns.some(p => p.test(text))) {
        bad.push(text.slice(0, 120));
      }
    }
    return bad;
  });

  expect(rawHtml, `${description}: raw HTML/JS found in visible page text:\n  ${rawHtml.join('\n  ')}`).toHaveLength(0);
}

/** Collect JS errors during page load */
async function collectPageErrors(page, url) {
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()); });
  await page.goto(url, { waitUntil: 'load' });
  // Wait for initial render to complete
  try {
    await page.waitForFunction(
      () => !document.querySelector('.spinner .spin'),
      { timeout: 5000 }
    );
  } catch { /* proceed */ }
  return errors.filter(e =>
    !e.includes('favicon') &&
    !e.includes('404') &&
    !e.includes('google') &&
    !e.includes('calendar') &&
    !e.includes('NET::') &&
    !e.includes('Failed to load resource')
  );
}

/** POST to API, returns created record */
async function apiPost(path, body) {
  const r = await fetch(`${API}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...AUTH_HEADERS },
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(`POST ${path} → ${r.status}: ${await r.text()}`);
  return r.json();
}

/** DELETE from API */
async function apiDelete(path) {
  const r = await fetch(`${API}${path}`, { method: 'DELETE', headers: AUTH_HEADERS });
  if (!r.ok) throw new Error(`DELETE ${path} → ${r.status}`);
}

/** PATCH/PUT to API */
async function apiRequest(method, path, body) {
  const r = await fetch(`${API}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...AUTH_HEADERS },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!r.ok) throw new Error(`${method} ${path} → ${r.status}: ${await r.text()}`);
  return r.json();
}

/** Local-time date string the card layer treats unambiguously.
 *
 * GH_CARD's S.daysFromToday() does `new Date(dateStr)` then compares to
 * local midnight. A bare "YYYY-MM-DD" parses as UTC midnight, so in a
 * negative-UTC zone it shifts back a calendar day (e.g. "tomorrow" reads
 * as today). Emitting "YYYY-MM-DDT12:00:00" (no Z) from LOCAL components
 * forces local-noon parsing, so the day offset is exact regardless of TZ.
 * `offsetDays` shifts off today's LOCAL date.
 */
function localCardDate(offsetDays = 0) {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T12:00:00`;
}


// ══════════════════════════════════════════════════════════════
// SUITE 1 — Page Load & Render Integrity
// ══════════════════════════════════════════════════════════════

test.describe('Page Load & Render Integrity', () => {

  const pages = [
    ['/index.html',        'Dashboard'],
    ['/inventory.html',    'Inventory'],
    ['/documents.html',    'Documents'],
    ['/books.html',        'Books'],
    ['/medical.html',      'Medical'],
    ['/todos.html',        'Todos'],
    ['/finance.html',      'Finance'],
    ['/resources.html',    'Resources'],
    ['/career.html',       'Career'],
    ['/property.html',     'Property'],
    ['/kids.html',         'Kids'],
    ['/reports.html',      'Reports'],
    ['/settings.html',     'Settings'],
    ['/daily-log.html',    'Daily Log'],
  ];

  for (const [path, name] of pages) {
    // One navigation per page covers both HTTP 200 + raw HTML scan.
    // Previously these were two separate tests, doubling page-load time.
    test(`${name} loads cleanly`, async ({ page }) => {
      const response = await page.goto(BASE + path, { waitUntil: 'load' });
      expect(response.status(), `${name}: HTTP status`).toBe(200);
      try {
        await page.waitForFunction(
          () => !document.querySelector('.spinner .spin'),
          { timeout: 800 }
        );
      } catch { /* proceed */ }
      // Inline raw-HTML scan (avoids a second navigation that checkNoRawHtml would do)
      const rawHtml = await page.evaluate(() => {
        const badPatterns = [
          /window\.LT\??\.toast/,
          /<button[^>]*onclick=/,
          /<button[^>]*class="file-copy/,
          /style="font-size:11px;color:var/,
          /navigator\.clipboard\.write/,
        ];
        const skipSelectors = [
          'pre', 'code', 'script', 'style',
          '#logViewer', '#rpt_logViewer', '#diagLog', '#rpt_diagLog',
          '.diag-test-det', '[style*="font-family:var(--mono)"]',
        ];
        const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
        const bad = [];
        let node;
        while ((node = walker.nextNode())) {
          let el = node.parentElement;
          let skip = false;
          while (el && el !== document.body) {
            if (skipSelectors.some(sel => { try { return el.matches(sel); } catch { return false; } })) {
              skip = true; break;
            }
            el = el.parentElement;
          }
          if (skip) continue;
          const text = node.textContent.trim();
          if (text.length > 5 && badPatterns.some(p => p.test(text))) {
            bad.push(text.slice(0, 120));
          }
        }
        return bad;
      });
      expect(rawHtml, `${name}: raw HTML in text content: ${rawHtml.join(' | ')}`).toHaveLength(0);
    });
  }

  test('Dashboard has no JS errors on load', async ({ page }) => {
    const errors = await collectPageErrors(page, BASE + '/index.html');
    expect(errors, `Dashboard JS errors: ${errors.join('; ')}`).toHaveLength(0);
  });

  test('Documents has no JS errors on load', async ({ page }) => {
    const errors = await collectPageErrors(page, BASE + '/documents.html');
    expect(errors, `Documents JS errors: ${errors.join('; ')}`).toHaveLength(0);
  });

  test('Inventory has no JS errors on load', async ({ page }) => {
    const errors = await collectPageErrors(page, BASE + '/inventory.html');
    expect(errors, `Inventory JS errors: ${errors.join('; ')}`).toHaveLength(0);
  });

});


// ══════════════════════════════════════════════════════════════
// SUITE 2 — Key UI Elements Render Correctly
// ══════════════════════════════════════════════════════════════

test.describe('Key UI Elements', () => {

  test('Documents file-copy-btn renders as button, not text', async ({ page }) => {
    // Create a document with a UNC path
    const doc = await apiPost('/documents', {
      title: '_e2e_doc_filecopy_test',
      category: 'Other',
      file_name: '\\\\SoniNAS\\Backups\\test.pdf',
    });
    try {
      await page.goto(BASE + '/documents.html', { waitUntil: 'load' });
      await page.waitForSelector('.doc-card', { timeout: 5000 });

      // Verify the file link renders as a button element, not raw text
      const btn = page.locator('.file-copy-btn').first();
      await expect(btn).toBeVisible();

      // Verify no raw HTML visible in document cards
      const rawInCards = await page.evaluate(() => {
        return Array.from(document.querySelectorAll('.doc-card'))
          .some(card => /<button/.test(card.textContent));
      });
      expect(rawInCards, 'Raw <button> HTML found in document card text').toBe(false);
    } finally {
      await apiDelete(`/documents/${doc.id}`);
    }
  });

  test('Tag chips render as span elements with data-tag, not raw HTML', async ({ page }) => {
    // Create a book with a tag
    // v202604.175 — create on the DEFAULT shelf ("Currently Reading") so the
    // book is visible on initial load. The legacy shelf tabs are now
    // `legacy-hidden` (filtering moved to the Lens), so clicking
    // `text=Want to Read` hit an invisible button and timed out.
    const book = await apiPost('/books', {
      title: '_e2e_book_tag_test',
      status: 'Currently Reading',
      format: 'Physical',
      tags: ['e2etesttag'],
    });
    try {
      await page.goto(BASE + '/books.html', { waitUntil: 'load' });
      await page.waitForSelector('.book-card', { timeout: 5000 });

      // Verify tag chip is a span with data-tag
      const chip = page.locator('[data-tag="e2etesttag"]').first();
      await expect(chip).toBeVisible();

      // Confirm no raw HTML angle brackets in card text
      const rawInCards = await page.evaluate(() => {
        return Array.from(document.querySelectorAll('.book-card'))
          .some(card => /<button[^>]*onclick=/.test(card.textContent) ||
                        /window\.LT/.test(card.textContent));
      });
      expect(rawInCards, 'Raw HTML/JS found in book card text').toBe(false);
    } finally {
      await apiDelete(`/books/${book.id}`);
    }
  });

  test('Dashboard (Today page) renders content or empty state', async ({ page }) => {
    // v202604.175 — index.html is the Today page (#todayContent), not the old
    // ".module-tile" grid (that class no longer exists). It renders either
    // .today-section blocks or the .today-empty empty state once loaded.
    await page.goto(BASE + '/index.html', { waitUntil: 'load' });
    await page.waitForSelector('.today-section, .today-grid, .today-empty', { timeout: 6000 }).catch(() => {});
    const hasContent = await page.locator('.today-section, .today-grid').count() > 0;
    const hasEmpty   = await page.locator('.today-empty').count() > 0;
    expect(hasContent || hasEmpty, 'Today page: neither content nor empty state rendered').toBe(true);
  });

  test('Todos page renders todo cards or empty state', async ({ page }) => {
    // v202604.175 — todos render through the GH_CARD pipeline (.gh-card in
    // .gh-card-grid groups), NOT the old .todo-item; the empty state is
    // .todos-empty. Verified live: the page renders correctly — "known bug
    // #1" was test/contract drift, not an app bug. (.todo-item kept as a
    // fallback in case the legacy render path is ever hit.)
    await page.goto(BASE + '/todos.html', { waitUntil: 'load' });
    await page.waitForSelector('#todoList .gh-card, .todos-empty, #todoList .todo-item', { timeout: 6000 }).catch(() => {});
    const hasTodos = await page.locator('#todoList .gh-card, #todoList .todo-item').count() > 0;
    const hasEmpty = await page.locator('.todos-empty, .empty-state').count() > 0;
    expect(hasTodos || hasEmpty, 'Todos page: neither todo cards nor empty state found').toBe(true);
  });

  test('Reports page renders report cards from registry', async ({ page }) => {
    // reports.html is now a tabs/shell layout (Overview | Family | Money |
    // Maintenance | System) with a left rail of `.rep-row` items per tab and
    // a right `.rep-detail-*` pane. Test verifies the rail populates and a
    // click opens the detail pane without raw HTML/JS bleeding through.
    // Updated v202604.113 (was looking for the removed `.report-card` class).
    // v202604.175 — the default `overview` tab renders summary tiles by
    // design (locked Reports #26); `.rep-row` only exists on the
    // money/family/maintenance/system tabs. Land on a rows-bearing tab.
    await page.goto(BASE + '/reports.html?tab=money', { waitUntil: 'load' });
    await page.locator('.rep-row').first().waitFor({ state: 'attached', timeout: 5000 });
    const rowCount = await page.locator('.rep-row').count();
    expect(rowCount, 'No report rows rendered').toBeGreaterThan(3);
    // Click the first row and verify the detail pane opens
    await page.locator('.rep-row').first().click();
    await page.locator('.rep-detail-header').waitFor({ state: 'visible', timeout: 5000 });
    // Detail body should not contain raw HTML/JS as visible text
    const rawHtml = await page.locator('#repDetailBody').evaluate(el =>
      /<button[^>]*onclick=/.test(el.textContent) || /window\.LT/.test(el.textContent)
    );
    expect(rawHtml, 'Report detail pane contains raw HTML/JS').toBe(false);
  });

  test('Settings page loads key sections', async ({ page }) => {
    await page.goto(BASE + '/settings.html', { waitUntil: 'load' });
    await expect(page.locator('#app')).toBeVisible();
    // Settings v088+ rail layout. Wait for the FIRST label to appear (state:'attached'
    // not 'visible' — some labels live inside collapsed groups). Then assert
    // the labels we care about exist anywhere in the rail.
    await page.locator('.settings-rail-label').first().waitFor({ state: 'attached', timeout: 8000 });
    const labels = await page.locator('.settings-rail-label').allTextContents();
    expect(labels.length, 'No rail labels rendered').toBeGreaterThan(5);
    expect(labels.some(l => l.trim() === 'Family'), `Family not in rail. Found: ${labels.join(', ')}`).toBe(true);
    expect(labels.some(l => l.trim() === 'Tags'), `Tags not in rail. Found: ${labels.join(', ')}`).toBe(true);
  });

});


// ══════════════════════════════════════════════════════════════
// SUITE 3 — CRUD Flows (auto-cleanup)
// ══════════════════════════════════════════════════════════════

test.describe('CRUD Flows', () => {

  test('Todos — create, mark done, delete', async ({ page }) => {
    const todo = await apiPost('/todos', {
      title: '_e2e_todo_test',
      category: 'General',
      priority: 'medium',
    });
    expect(todo.id, 'Todo create: no id').toBeTruthy();
    try {
      // Mark done
      const patch = await fetch(`${API}/todos/${todo.id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...AUTH_HEADERS },
        body: JSON.stringify({ status: 'done' }),
      });
      expect(patch.ok, `Mark done: HTTP ${patch.status}`).toBe(true);

      // Verify todos page loads without crashing
      await page.goto(BASE + '/todos.html', { waitUntil: 'load' });
      await page.waitForSelector('.todo-item, .todos-empty, .todo-section-head', { timeout: 5000 }).catch(() => {});
      // Page rendered — that's enough (JS error check is in Suite 1 dedicated tests)
    } finally {
      await apiDelete(`/todos/${todo.id}`);
    }
  });

  test('Documents — create with UNC path, render, delete', async ({ page }) => {
    const doc = await apiPost('/documents', {
      title: '_e2e_doc_unc_test',
      category: 'Legal',
      file_name: '\\\\SoniNAS\\Backups\\XPS\\Documents\\test.pdf',
    });
    expect(doc.id, 'Document create: no id').toBeTruthy();
    try {
      await page.goto(BASE + '/documents.html', { waitUntil: 'load' });
      await page.waitForSelector('.doc-card', { timeout: 5000 });
      // The file link must NOT appear as raw HTML
      const allText = await page.locator('.doc-list, #docList').textContent();
      expect(allText).not.toContain('<button');
      expect(allText).not.toContain('onclick=');
    } finally {
      await apiDelete(`/documents/${doc.id}`);
    }
  });

  test('Books — create with tag, verify chip, delete', async ({ page }) => {
    // v202604.175 — create on the default "Currently Reading" shelf; the
    // legacy shelf tabs are `legacy-hidden` so the old click timed out.
    const book = await apiPost('/books', {
      title: '_e2e_book_test',
      author: 'E2E Author',
      status: 'Currently Reading',
      format: 'Physical',
      tags: ['_e2etag_'],
    });
    expect(book.id, 'Book create: no id').toBeTruthy();
    try {
      await page.goto(BASE + '/books.html', { waitUntil: 'load' });
      await page.waitForSelector('.book-card, .empty-state', { timeout: 5000 }).catch(() => {});
      // Verify tag chip is a proper element
      const chip = page.locator('[data-tag="_e2etag_"]');
      await expect(chip).toBeVisible();
      // Confirm it's a span/button element, not text
      const tagName = await chip.evaluate(el => el.tagName.toLowerCase());
      expect(['span', 'button'], `Tag chip tagName: ${tagName}`).toContain(tagName);
    } finally {
      await apiDelete(`/books/${book.id}`);
    }
  });

  test('Inventory — create item, verify in all-items, delete', async ({ page }) => {
    // Need a location first
    const locsResp = await fetch(`${API}/inventory/locations`);
    const locs = await locsResp.json();
    if (!locs.length) { test.skip(); return; }
    const locId = locs[0].id;

    const item = await apiPost('/inventory/items', {
      name: '_e2e_item_test',
      parent_type: 'location',
      parent_id: locId,
      quantity: 1,
      category: 'Other',
    });
    expect(item.id, 'Item create: no id').toBeTruthy();
    try {
      await page.goto(BASE + '/inventory.html', { waitUntil: 'load' });
      // v202604.175 — the "All Items / Rooms" toggle was folded into the Lens
      // (v.134); there is no clickable `text=All Items` control anymore and
      // the page auto-selects items mode. The old click hit an unstable
      // element and timed out. Just wait for the item cards to render.
      await page.waitForSelector('.ai-card, .ai-list-card, .empty-state', { timeout: 6000 }).catch(() => {});
      // No raw HTML/JS leaked into card text
      const rawInCards = await page.evaluate(() => {
        return Array.from(document.querySelectorAll('.ai-card, .ai-list-card'))
          .some(card => /<button[^>]*onclick=/.test(card.textContent) ||
                        /window\.LT/.test(card.textContent) ||
                        /navigator\.clipboard/.test(card.textContent));
      });
      expect(rawInCards, 'Raw HTML/JS found in inventory cards').toBe(false);
    } finally {
      // DELETE /inventory/items/:id requires the item to be archived first.
      // PUT /archive sets is_archived=1, then DELETE hard-deletes it.
      try {
        await fetch(`${API}/inventory/items/${item.id}/archive`, { method: 'PUT',
          headers: { 'Content-Type': 'application/json', ...AUTH_HEADERS }, body: '{}' });
      } catch {}
      await apiDelete(`/inventory/items/${item.id}`);
    }
  });

  test('Contacts — create, verify in settings, delete', async ({ page }) => {
    const contact = await apiPost('/settings/contacts', {
      contact_type: 'General',
      name: '_e2e_contact_test',
      phone_primary: '555-0000',
    });
    expect(contact.id, 'Contact create: no id').toBeTruthy();
    try {
      await page.goto(BASE + '/settings.html', { waitUntil: 'load' });
    await page.waitForSelector('.settings-nav, .nav-item, .section-label', { timeout: 5000 }).catch(() => {});
      // Settings page must not have JS errors
      const errors = [];
      page.on('pageerror', e => errors.push(e.message));
      expect(errors).toHaveLength(0);
    } finally {
      await apiDelete(`/settings/contacts/${contact.id}`);
    }
  });

});


// ══════════════════════════════════════════════════════════════
// SUITE 4 — API Contract
// ══════════════════════════════════════════════════════════════

test.describe('API Contract', () => {

  test('GET /dashboard returns all expected keys', async ({ request }) => {
    const r = await request.get(`${API}/dashboard`);
    expect(r.ok()).toBe(true);
    const d = await r.json();
    for (const key of ['inventory', 'hsa', 'todos', 'medical', 'family', 'books', 'property', 'backup', 'expiring_documents']) {
      expect(d, `Dashboard missing key: ${key}`).toHaveProperty(key);
    }
  });

  test('GET /app/info returns version and db_size_bytes', async ({ request }) => {
    const r = await request.get(`${API}/app/info`);
    expect(r.ok()).toBe(true);
    const d = await r.json();
    expect(d.version, 'app/info missing version').toBeTruthy();
    expect(typeof d.db_size_bytes, 'db_size_bytes not a number').toBe('number');
  });

  test('GET /settings/completeness returns issues array', async ({ request }) => {
    const r = await request.get(`${API}/settings/completeness`);
    expect(r.ok()).toBe(true);
    const d = await r.json();
    expect(Array.isArray(d.issues), 'completeness.issues not an array').toBe(true);
  });

  test('GET /settings/tags/search returns valid response shape', async ({ request }) => {
    // Create a book with a known tag so the search has something to find
    const book = await apiPost('/books', {
      title: '_e2e_tagsearch_test', status: 'Want to Read', format: 'Physical',
      tags: ['_e2e_searchable_tag_'],
    });
    try {
      const r = await request.get(`${API}/settings/tags/search?tag=_e2e_searchable_tag_`);
      expect(r.ok()).toBe(true);
      const d = await r.json();
      // When results exist, response has { tag, total, groups }
      expect(d).toHaveProperty('tag');
      expect(d).toHaveProperty('groups');
      expect(Array.isArray(d.groups)).toBe(true);
    } finally {
      await apiDelete(`/books/${book.id}`);
    }
  });

  test('GET /settings/family/1/report returns member object', async ({ request }) => {
    const r = await request.get(`${API}/settings/family/1/report`);
    // May 404 if family member 1 doesn't exist — that's fine
    if (r.status() === 404) return;
    expect(r.ok()).toBe(true);
    const d = await r.json();
    expect(d, 'family report missing member key').toHaveProperty('member');
    expect(d, 'family report missing summary key').toHaveProperty('summary');
  });

  test('POST to protected endpoint requires auth or hits validation', async ({ request }) => {
    // No-token path: server should return 401 (auth required).
    // With-token path: server should return 400 (validation — empty body invalid).
    // We test no-token explicitly to verify auth middleware is wired.
    const r = await request.post(`${API}/books`, {
      data: {}, headers: { 'Content-Type': 'application/json' }
    });
    if (AUTH_PASSWORD) {
      // Verify auth IS enforced — we sent no token, should be 401
      expect([400, 401]).toContain(r.status());
    } else {
      // Auth disabled (open mode) — empty body should hit validation
      expect(r.status(), 'POST /books with empty body should 400 not 401').toBe(400);
    }
  });

  // v202604.176 task 2 — the test-results POST now requires a session;
  // the GETs stay public (Reports → Testing reads them with no login).
  test('test-results POST requires auth; GETs stay public', async ({ request }) => {
    const validBody = { started_at: '2099-01-01T00:00:00Z', passed: 0, failed: 0, total: 0 };
    const noAuth = await request.post(`${API}/app/test-results`, {
      data: validBody, headers: { 'Content-Type': 'application/json' },
    });
    if (AUTH_PASSWORD) {
      expect(noAuth.status(), 'unauth POST must be blocked (401)').toBe(401);
      // Authed empty body → passes auth, fails validation (400). Proves
      // auth lets a session through, and writes no run file.
      const authed = await request.post(`${API}/app/test-results`, {
        data: {}, headers: { 'Content-Type': 'application/json', ...AUTH_HEADERS },
      });
      expect(authed.status(), 'authed empty body → 400 validation, not 401').toBe(400);
    } else {
      // Open mode (no password on instance) — write allowed.
      expect([201, 400]).toContain(noAuth.status());
    }
    const list = await request.get(`${API}/app/test-results`);
    expect(list.status(), 'GET list stays public').toBe(200);
  });

  // v202604.176 task 3 — CORS restricted to the LAN/Tailscale allowlist.
  test('CORS — allowed origin echoed, foreign origin denied', async ({ request }) => {
    const ok = await request.get(`${BASE}/health`, { headers: { Origin: BASE } });
    expect(ok.status()).toBe(200);
    expect(ok.headers()['access-control-allow-origin'], 'allowed origin echoed').toBe(BASE);
    const bad = await request.get(`${BASE}/health`, { headers: { Origin: 'http://evil.test' } });
    // Request is still served (no hard block) but carries no ACAO for the
    // foreign origin, so a browser would refuse the cross-origin read.
    expect(bad.headers()['access-control-allow-origin'] || '',
      'foreign origin must not get an ACAO header').not.toBe('http://evil.test');
  });

  // v202604.177 — Kids module showed a child twice (an unlinked legacy
  // row + the family-linked one). Migration 142 deactivates the orphan
  // and the sync now heals instead of duplicating. The active kids list
  // must have unique display_names.
  test('GET /kids returns no duplicate child names', async ({ request }) => {
    const r = await request.get(`${API}/kids`);
    expect(r.status()).toBe(200);
    const kids = await r.json();
    expect(Array.isArray(kids), '/kids returns an array').toBe(true);
    const names = kids.map(k => k.display_name);
    const dupes = names.filter((n, i) => names.indexOf(n) !== i);
    expect(dupes, `duplicate kid name(s): ${[...new Set(dupes)].join(', ')}`).toHaveLength(0);
  });

  test('GET /finance/transactions/unified returns transactions and summary', async ({ request }) => {
    const r = await request.get(`${API}/finance/transactions/unified`);
    expect(r.ok()).toBe(true);
    const d = await r.json();
    expect(d, 'unified transactions missing transactions key').toHaveProperty('transactions');
    expect(d, 'unified transactions missing summary key').toHaveProperty('summary');
    expect(Array.isArray(d.transactions)).toBe(true);
  });

  test('GET /finance/category-rules returns array of rules', async ({ request }) => {
    const r = await request.get(`${API}/finance/category-rules`);
    expect(r.ok()).toBe(true);
    const rules = await r.json();
    expect(Array.isArray(rules)).toBe(true);
    // Migration 046 seeds rules — should have at least some
    expect(rules.length, 'No category rules seeded').toBeGreaterThan(0);
  });

  test('Category rule CRUD — create, verify, delete', async ({ request }) => {
    const r = await request.post(`${API}/finance/category-rules`, {
      data: { pattern: '%_E2E_TEST_RULE%', category: 'Other', sort_order: 999 },
      headers: { 'Content-Type': 'application/json', ...AUTH_HEADERS },
    });
    expect(r.status(), 'Create rule: HTTP status').toBe(201);
    const rule = await r.json();
    expect(rule.id).toBeTruthy();
    // Delete it
    const del = await request.delete(`${API}/finance/category-rules/${rule.id}`, {
      headers: AUTH_HEADERS,
    });
    expect(del.ok()).toBe(true);
  });

  test('POST /finance/category-rules/apply returns updated count', async ({ request }) => {
    const r = await request.post(`${API}/finance/category-rules/apply`, {
      data: {}, headers: { 'Content-Type': 'application/json', ...AUTH_HEADERS },
    });
    expect(r.ok()).toBe(true);
    const d = await r.json();
    expect(d, 'apply-rules missing updated key').toHaveProperty('updated');
    expect(typeof d.updated).toBe('number');
  });

  test('GET /notifications returns array with time_ago field', async ({ request }) => {
    const r = await request.get(`${API}/notifications`);
    expect(r.ok()).toBe(true);
    const notifs = await r.json();
    expect(Array.isArray(notifs)).toBe(true);
    // If any exist, they should have time_ago
    if (notifs.length > 0) {
      expect(notifs[0], 'notification missing time_ago').toHaveProperty('time_ago');
    }
  });

  test('CSV export routes return 200', async ({ request }) => {
    const exports = [
      '/medical/medications/export/csv',
      '/medical/conditions/export/csv',
      '/career/certifications/export/csv',
      '/daily-log/export/csv',
      '/property/vehicles/export/csv',
    ];
    for (const path of exports) {
      const r = await request.get(`${API}${path}`);
      expect(r.status(), `${path} should return 200`).toBe(200);
    }
  });

  test('GET /data/export returns xlsx content-type', async ({ request }) => {
    const r = await request.get(`${API}/data/export`);
    expect(r.ok()).toBe(true);
    const ct = r.headers()['content-type'] || '';
    expect(ct, 'data export should be xlsx').toContain('spreadsheetml');
  });

  test('GET /data/template returns xlsx content-type', async ({ request }) => {
    const r = await request.get(`${API}/data/template`);
    expect(r.ok()).toBe(true);
    const ct = r.headers()['content-type'] || '';
    expect(ct, 'template should be xlsx').toContain('spreadsheetml');
  });

  test('POST /data/import with empty xlsx responds ok', async ({ request }) => {
    // Upload a minimal valid xlsx (just check the route accepts multipart)
    // Since we can't easily build xlsx here, just verify the route exists
    const r = await request.post(`${API}/data/import`, {
      multipart: { file: { name: 'test.xlsx', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', buffer: Buffer.from('') } },
      headers: AUTH_HEADERS,
    });
    // Should get 400 (no file) or 500 (invalid xlsx) — not 404
    expect(r.status(), 'import route should exist').not.toBe(404);
  });

  test('Dashboard returns doc_total and kids keys', async ({ request }) => {
    const r = await request.get(`${API}/dashboard`);
    expect(r.ok()).toBe(true);
    const d = await r.json();
    expect(d, 'dashboard missing doc_total').toHaveProperty('doc_total');
    expect(d, 'dashboard missing kids').toHaveProperty('kids');
    expect(d.kids, 'kids missing total').toHaveProperty('total');
    expect(d.kids, 'kids missing activities').toHaveProperty('activities');
  });

  test('GET /notifications page loads without JS errors', async ({ page }) => {
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.goto(`${BASE}/notifications.html`, { waitUntil: 'load' });
    await page.waitForSelector('#app', { timeout: 5000 });
    expect(errors.filter(e => !e.includes('favicon')), 'notifications page JS errors').toHaveLength(0);
  });

  test('GET /data redirect stub loads without JS errors', async ({ page }) => {
    // data.html is a redirect stub — content folded into settings.html#imports.
    // We test the stub loads clean (no JS errors) and the new location renders.
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.goto(`${BASE}/data.html`, { waitUntil: 'load' });
    expect(errors.filter(e => !e.includes('favicon')), 'data redirect stub JS errors').toHaveLength(0);

    // Now verify the new location loads without errors too
    const errors2 = [];
    page.on('pageerror', e => errors2.push(e.message));
    await page.goto(`${BASE}/settings.html#imports`, { waitUntil: 'load' });
    await page.waitForTimeout(1000); // settings panels load lazily
    expect(errors2.filter(e => !e.includes('favicon')), 'settings imports panel JS errors').toHaveLength(0);
  });

  test('Finance budget routes exist', async ({ request }) => {
    const r = await request.get(`${API}/finance/budgets`);
    expect(r.ok()).toBe(true);
    const d = await r.json();
    expect(d, 'budgets missing budgets array').toHaveProperty('budgets');
    expect(Array.isArray(d.budgets)).toBe(true);
  });

});

// ─────────────────────────────────────────────────────────────────
// Card Renderer (GH_CARD v5) — added v202604.113
//
// Loads gh-card.js + gh-card-shared.js + gh-card-configs-batch{1,2,3}.js into
// a real browser context, feeds each registered config a synthetic record,
// and asserts the rendered DOM contains the expected zones (status row,
// identity, optional cross-module strip, optional alert with optional
// stacked secondaries, entities). Failures here mean the card system
// won't render correctly when a user picks the "card" view on any page.
// ─────────────────────────────────────────────────────────────────
test.describe('Card Renderer (GH_CARD v5)', () => {

  // Single fixture: blank page, scripts loaded, a global helper installed
  // for asserting against rendered DOM strings.
  async function loadCardSystem(page) {
    await page.goto(`${BASE}/index.html`, { waitUntil: 'load' });
    // Stub familyMembers global before card scripts execute
    await page.evaluate(() => {
      window.familyMembers = [
        { id: 1, display_name: 'Al',    first_name: 'Al',    avatar_attachment_id: null },
        { id: 2, display_name: 'Sarah', first_name: 'Sarah', avatar_attachment_id: null },
      ];
    });
    // Add the card scripts. Index already has many scripts, but the card
    // renderer + configs aren't loaded by default on /index.html.
    await page.addScriptTag({ url: `${BASE}/js/gh-card.js` });
    await page.addScriptTag({ url: `${BASE}/js/gh-card-shared.js` });
    await page.addScriptTag({ url: `${BASE}/js/gh-card-brands.js` });
    await page.addScriptTag({ url: `${BASE}/js/gh-card-configs-batch1.js` });
    await page.addScriptTag({ url: `${BASE}/js/gh-card-configs-batch2.js` });
    await page.addScriptTag({ url: `${BASE}/js/gh-card-configs-batch3.js` });
    await page.addScriptTag({ url: `${BASE}/js/gh-card-mount.js` });
    await page.waitForFunction(() => window.GH_CARD && window.GH_CARD_SHARED && window.GH_MOUNT, { timeout: 4000 });
  }

  // Helper: render a record and check zone presence.
  async function renderAndCheck(page, moduleId, record, expect_) {
    const html = await page.evaluate(({ m, r }) => {
      const node = window.GH_CARD.render(m, r);
      return node ? node.outerHTML : null;
    }, { m: moduleId, r: record });
    expect(html, `${moduleId} render returned null`).not.toBeNull();

    if (expect_.hasStatusRow !== undefined) {
      expect(/<div class="gh-card__status-row/.test(html), `${moduleId} status row`).toBe(expect_.hasStatusRow);
    }
    if (expect_.hasIdentity !== undefined) {
      expect(/<div class="gh-card__identity/.test(html), `${moduleId} identity`).toBe(expect_.hasIdentity);
    }
    if (expect_.hasCrossModule !== undefined) {
      expect(/<div class="gh-card__cross/.test(html), `${moduleId} cross-module strip`).toBe(expect_.hasCrossModule);
    }
    if (expect_.hasAlert !== undefined) {
      // Match the alert *zone* class specifically, not alert-meta which is reused in zone 4
      expect(/<div class="gh-card__alert(\s|"|\sgh-)/.test(html), `${moduleId} alert zone`).toBe(expect_.hasAlert);
    }
    if (expect_.hasEntities !== undefined) {
      expect(/<div class="gh-card__entities/.test(html), `${moduleId} entities`).toBe(expect_.hasEntities);
    }
    if (expect_.hasProgress !== undefined) {
      expect(/<div class="gh-progress/.test(html), `${moduleId} progress bar`).toBe(expect_.hasProgress);
    }
    if (expect_.hasStackedAlerts !== undefined) {
      expect(/<div class="gh-card__alert-stack/.test(html), `${moduleId} stacked alerts`).toBe(expect_.hasStackedAlerts);
    }
    return html;
  }

  test('renderer + helpers + configs load without error', async ({ page }) => {
    await loadCardSystem(page);
    const registered = await page.evaluate(() => {
      // Probe each known config across all three batches
      const ids = [
        // batch1
        'vehicles', 'subscriptions', 'finance_accounts', 'hsa_accounts',
        'maintenance', 'books', 'trade_positions',
        // batch2
        'wardrobe', 'perfumes', 'properties', 'documents', 'insurance_policies', 'career_jobs',
        // batch3
        'medical_conditions_rich', 'medical_visits_rich', 'daily_log_entries', 'calendar_events',
      ];
      const results = {};
      for (const id of ids) {
        try {
          const node = window.GH_CARD.render(id, { id: 999 });
          results[id] = !!node && node.classList.contains('gh-card');
        } catch (e) { results[id] = `THREW: ${e.message}`; }
      }
      return results;
    });
    for (const [id, ok] of Object.entries(registered)) {
      expect(ok, `${id} failed minimal render`).toBe(true);
    }
  });

  test('vehicles — healthy daily driver renders no alert', async ({ page }) => {
    await loadCardSystem(page);
    await renderAndCheck(page, 'vehicles', {
      id: 1, make: 'Honda', model: 'Civic LX', year: 2022,
      odometer_current: 34210, last_service_odometer: 31270, next_service_miles: 36270,
      registration_expires_at: '2027-07-31',  // far out
      ytd_fuel: 642, service_ytd: 0,
      owner_family_member_id: 1,
      insurer_brand: 'State Farm', insurer_brand_color: '#d50000',
      attachment_count: 3, plate_number: 'ABC-7392',
      location: 'Garage at home', usage_type: 'Daily driver',
    }, {
      hasStatusRow: true, hasIdentity: true, hasCrossModule: true,
      hasAlert: false, hasEntities: true, hasProgress: true,
    });
  });

  test('vehicles — multi-alert with stacked secondaries', async ({ page }) => {
    await loadCardSystem(page);
    // Service threshold reached + reg + insurance all due → stacked alert
    await renderAndCheck(page, 'vehicles', {
      id: 2, make: 'Toyota', model: '4Runner SR5', year: 2018,
      odometer_current: 87940, last_service_odometer: 83120, next_service_miles: 88120,
      registration_expires_at: '2026-07-31',
      insurance_renewal_at: '2026-08-15',
      ytd_fuel: 1180, service_ytd: 420,
      owner_family_member_id: 1, plate_number: 'XYZ-9921',
    }, {
      hasAlert: true, hasStackedAlerts: true,
    });
  });

  test('subscriptions — price increase alert + asterisk on annual', async ({ page }) => {
    await loadCardSystem(page);
    const html = await renderAndCheck(page, 'subscriptions', {
      id: 1, service_name: 'Netflix', plan_name: 'Premium · 4K',
      brand_color: '#E50914', brand_wordmark: 'NETFLIX',
      next_charge_at: '2026-06-22',
      annual_cost: 263.88, last_3_charges_total: 66.97, active_since: '2019-09-01',
      price_increased_recently: true,
      price_delta: 2, previous_price: 20.99, current_price: 22.99,
      price_change_at: '2026-05-14',
      annual_cost_asterisk: 'red',
      owner_family_member_id: 1, category: 'Entertainment',
    }, { hasAlert: true, hasCrossModule: true });
    // Verify the asterisk actually rendered in the cross-module strip
    expect(/gh-cross__ast--red/.test(html), 'red asterisk should render for incomplete annual cost').toBe(true);
  });

  test('subscriptions — healthy stable price renders no alert', async ({ page }) => {
    await loadCardSystem(page);
    // Use a date 30+ days out so we don't trip the "renews soon" alert
    const farFuture = new Date(); farFuture.setDate(farFuture.getDate() + 45);
    await renderAndCheck(page, 'subscriptions', {
      id: 2, service_name: 'Spotify', plan_name: 'Family · 6 accounts',
      brand_color: '#1DB954', brand_wordmark: 'Spotify',
      next_charge_at: farFuture.toISOString().slice(0, 10),
      annual_cost: 203.88, last_3_charges_total: 50.97, active_since: '2021-03-01',
      price_increased_recently: false, owner_family_member_id: 1,
    }, { hasAlert: false });
  });

  test('subscriptions — renews tomorrow triggers cancel-now alert', async ({ page }) => {
    await loadCardSystem(page);
    // v202604.175 — local-noon date so daysFromToday() == 1 exactly (UTC
    // "YYYY-MM-DD" would shift to today in a negative-UTC zone).
    const html = await page.evaluate((nextCharge) => {
      const node = window.GH_CARD.render('subscriptions', {
        id: 99, service_name: 'Disney+', plan_name: 'Standard',
        brand_color: '#0a3d92', cost: 7.99, cycle: 'monthly',
        next_charge_at: nextCharge,
      });
      return node ? node.outerHTML : null;
    }, localCardDate(1));
    expect(html).not.toBeNull();
    expect(/Charges tomorrow/.test(html), 'should display "Charges tomorrow"').toBe(true);
    expect(/gh-card__alert/.test(html), 'should render alert zone').toBe(true);
  });

  test('finance_accounts — low balance triggers alert', async ({ page }) => {
    await loadCardSystem(page);
    await renderAndCheck(page, 'finance_accounts', {
      id: 1, nickname: 'Joint Savings', institution: 'Navy Fed',
      account_type: 'savings',
      balance_current: 250, low_balance_threshold: 1000,
      bank_brand: 'Navy Fed',
      owner_family_member_id: 1, is_joint: true,
    }, { hasAlert: true });
  });

  test('hsa_accounts — receipts pending triggers alert + progress bar', async ({ page }) => {
    await loadCardSystem(page);
    await renderAndCheck(page, 'hsa_accounts', {
      id: 1, tax_year: 2026, plan_type: 'family',
      contribution_limit: 8300, contribution_ytd: 5460,
      provider_brand: 'Fidelity',
      spent_ytd: 2840, receipts_pending_count: 3, eligible_matches_count: 7,
      owner_family_member_id: 1,
    }, { hasAlert: true, hasProgress: true });
  });

  test('maintenance — overdue task triggers alert', async ({ page }) => {
    await loadCardSystem(page);
    await renderAndCheck(page, 'maintenance', {
      id: 1, name: 'HVAC Filter', system: 'HVAC',
      frequency_days: 90,
      last_done_at: '2026-01-15',  // ~3.5 months ago — overdue
      next_due_at: '2026-04-15',
      last_cost: 18, avg_cost: 18,
      assignee_family_member_id: 1,
    }, { hasAlert: true });
  });

  test('books — reading dashboard renders progress + cross-module', async ({ page }) => {
    await loadCardSystem(page);
    await renderAndCheck(page, 'books', {
      id: 1, title: 'The Pragmatic Programmer', author: 'Hunt & Thomas',
      status: 'reading', genre: 'Tech', format: 'Hardcover',
      total_pages: 320, current_page: 184,
      target_finish_at: '2026-06-14', pages_per_day_needed: 4,
      pages_today: 12, streak_days: 7, pace_status: 'on track',
      reader_family_member_id: 1,
    }, { hasProgress: true, hasCrossModule: true, hasAlert: false });
  });

  test('trade_positions — long position with no alert', async ({ page }) => {
    await loadCardSystem(page);
    await renderAndCheck(page, 'trade_positions', {
      id: 1, symbol: 'AAPL', company_name: 'Apple Inc.',
      position_type: 'long', sector: 'Technology',
      current_price: 178.42, day_change_pct: 1.24,
      cost_basis: 12500, current_value: 14820, realized_ytd: 0,
      account_id: 1, account_brand: 'Schwab',
    }, { hasAlert: false, hasCrossModule: true });
  });

  // ── Batch 2 ────────────────────────────────────────────────────
  test('wardrobe — stale item triggers donation alert', async ({ page }) => {
    await loadCardSystem(page);
    // 200 days ago — beyond the 180-day stale threshold
    const stale = new Date(); stale.setDate(stale.getDate() - 200);
    await renderAndCheck(page, 'wardrobe', {
      id: 1, brand: 'Patagonia', wardrobe_nickname: 'Black puffer',
      color: 'Black', category: 'Outerwear', size: 'M',
      season_tags: '["Fall","Winter"]', occasion_tags: '["Casual","Outdoor"]',
      wardrobe_status: 'active',
      purchase_price: 220, times_worn: 4, cost_per_wear: 55,
      last_worn_at: stale.toISOString().slice(0, 10),
      wardrobe_owner_id: 1,
    }, { hasAlert: true });
  });

  test('perfumes — empty bottle triggers alert', async ({ page }) => {
    await loadCardSystem(page);
    await renderAndCheck(page, 'perfumes', {
      id: 1, name: 'Sauvage', brand: 'Dior', concentration: 'EDP',
      amount_level: 'Empty', size_ml: 100,
      season_tags: '["Spring","Summer"]',
      purchase_price: 145, rating: 4,
      owner_family_member_id: 1,
    }, { hasAlert: true });
  });

  test('properties — healthy primary residence renders no alert', async ({ page }) => {
    await loadCardSystem(page);
    await renderAndCheck(page, 'properties', {
      id: 1, nickname: 'Main Home', property_type: 'Primary Residence',
      address_street: '123 Oak Ln', address_city: 'Leeds', address_state: 'AL',
      current_est_value: 425000, mortgage_balance: 280000,
      property_tax_annual: 4200, insurance_annual: 1800,
      insurance_company: 'State Farm', mortgage_lender: 'Wells Fargo',
      is_active: 1,
    }, { hasAlert: false, hasCrossModule: true });
  });

  test('documents — passport expiring renders renewal alert', async ({ page }) => {
    await loadCardSystem(page);
    const soon = new Date(); soon.setDate(soon.getDate() + 45);
    await renderAndCheck(page, 'documents', {
      id: 1, title: 'Passport - Sarah', category: 'Identity',
      issuer: 'US State Dept',
      issue_date: '2016-05-12', expiry_date: soon.toISOString().slice(0, 10),
      family_member: 'Sarah',
    }, { hasAlert: true });
  });

  test('insurance — auto policy renewal in 45 days triggers alert', async ({ page }) => {
    await loadCardSystem(page);
    const soon = new Date(); soon.setDate(soon.getDate() + 45);
    await renderAndCheck(page, 'insurance_policies', {
      id: 1, policy_type: 'Auto',
      provider_name: 'State Farm', provider_brand: 'State Farm', provider_brand_color: '#d50000',
      policy_number: '1234567', coverage_start_date: '2025-08-15',
      coverage_end_date: soon.toISOString().slice(0, 10),
      premium_amount: 1240, premium_frequency: 'annual',
      deductible: 500, status: 'active',
      alert_days_before: 60,
    }, { hasAlert: true });
  });

  test('career_jobs — current job with tenure progress', async ({ page }) => {
    await loadCardSystem(page);
    await renderAndCheck(page, 'career_jobs', {
      id: 1, company: 'Acme Corp', title: 'Senior PM',
      employment_type: 'Full-time',
      start_date: '2023-03-15', end_date: null, is_current: 1,
      location: 'Remote',
    }, { hasProgress: true });
  });

  // ── Batch 3 ────────────────────────────────────────────────────
  test('medical_conditions_rich — checkup overdue triggers alert', async ({ page }) => {
    await loadCardSystem(page);
    const past = new Date(); past.setDate(past.getDate() - 20);
    await renderAndCheck(page, 'medical_conditions_rich', {
      id: 1, condition_name: 'Hypertension', status: 'Active',
      severity: 'Mild',
      start_date: '2022-06-01',
      physician: 'Dr. Patel',
      next_checkup_at: past.toISOString().slice(0, 10),
      active_meds_count: 1, open_todos_count: 0, related_visits_count: 4,
      family_member_id: 1,
    }, { hasAlert: true });
  });

  test('medical_visits_rich — follow-up needed triggers alert', async ({ page }) => {
    await loadCardSystem(page);
    const soon = new Date(); soon.setDate(soon.getDate() + 7);
    await renderAndCheck(page, 'medical_visits_rich', {
      id: 1, physician_name: 'Dr. Patel', specialty: 'Cardiology',
      visit_type: 'Follow-up', visit_date: '2026-04-15',
      follow_up_needed: true,
      follow_up_date: soon.toISOString().slice(0, 10),
      visit_cost: 280, hsa_paid: 280,
      family_member_id: 1, attachment_count: 2,
    }, { hasAlert: true });
  });

  test('daily_log_entries — compact entry with action item', async ({ page }) => {
    await loadCardSystem(page);
    const html = await page.evaluate(() => {
      const node = window.GH_CARD.render('daily_log_entries', {
        id: 1,
        entry_text: 'Check stock prices for Netflix tomorrow morning',
        entry_time: '7:14 AM',
        tags: ['finance'],
        has_action_item: true,
        author_family_member_id: 1,
      });
      return node ? node.outerHTML : null;
    });
    expect(html).not.toBeNull();
    expect(/gh-card--compact/.test(html), 'log entry should be compact mode').toBe(true);
    expect(/Action flagged/.test(html), 'action-flagged meta should render').toBe(true);
  });

  test('calendar_events — today event flags as urgent', async ({ page }) => {
    await loadCardSystem(page);
    // v202604.175 — local-noon today so daysFromToday() == 0 exactly.
    const html = await page.evaluate((t) => {
      const node = window.GH_CARD.render('calendar_events', {
        id: 1, title: 'Doctor appointment', start_at: t,
        start_time: '2:00 PM', location: 'Patel Clinic',
        attendee_count: 1, organizer_family_member_id: 1,
      });
      return node ? node.outerHTML : null;
    }, localCardDate(0));
    expect(html).not.toBeNull();
    expect(/gh-card--u-urgent/.test(html), 'today event should render urgent class').toBe(true);
    expect(/Today/.test(html), 'should display "Today" label').toBe(true);
  });

  // ─────────────────────────────────────────────────────────────
  // GH_MOUNT helper — opt-in mount infrastructure used by every page
  // ─────────────────────────────────────────────────────────────
  // Cards are now driven by each page's GH_VIEW toggle (3 views: list/grid/card)
  // not a query param. GH_MOUNT just renders into a container when the page
  // says "card view selected" — it doesn't gate anything itself.

  test('GH_MOUNT — intoContainer renders a gh-card into the target container', async ({ page }) => {
    await loadCardSystem(page);
    const html = await page.evaluate(() => {
      const div = document.createElement('div');
      div.id = 'mountTest1';
      document.body.appendChild(div);
      window.GH_MOUNT.intoContainer({
        containerId: 'mountTest1', moduleId: 'subscriptions',
        records: [{ id: 1, name: 'Netflix', category: 'Streaming' }],
      });
      return document.getElementById('mountTest1').innerHTML;
    });
    expect(html.includes('gh-card'), 'should render gh-card into container').toBe(true);
  });

  test('GH_MOUNT — fieldMap renames source field into target field', async ({ page }) => {
    await loadCardSystem(page);
    const html = await page.evaluate(() => {
      const div = document.createElement('div');
      div.id = 'mountTest2';
      document.body.appendChild(div);
      window.GH_MOUNT.intoContainer({
        containerId: 'mountTest2', moduleId: 'subscriptions',
        records: [{ id: 1, name: 'Netflix', plan: 'Premium', category: 'Entertainment' }],
        fieldMap: { service_name: 'name', plan_name: 'plan' },
      });
      return document.getElementById('mountTest2').innerHTML;
    });
    expect(html.includes('Netflix'), 'mapped service_name should appear').toBe(true);
    expect(html.includes('gh-card'), 'card should render').toBe(true);
  });

  test('GH_MOUNT — onEmpty called when records array is empty', async ({ page }) => {
    await loadCardSystem(page);
    const html = await page.evaluate(() => {
      const div = document.createElement('div');
      div.id = 'mountTest3';
      document.body.appendChild(div);
      window.GH_MOUNT.intoContainer({
        containerId: 'mountTest3', moduleId: 'subscriptions', records: [],
        onEmpty: () => '<div id="empty-marker">nothing here</div>',
      });
      return document.getElementById('mountTest3').innerHTML;
    });
    expect(html.includes('empty-marker'), 'onEmpty HTML should render').toBe(true);
  });

  test('GH_MOUNT — missing container returns false without throwing', async ({ page }) => {
    await loadCardSystem(page);
    const out = await page.evaluate(() => {
      return window.GH_MOUNT.intoContainer({
        containerId: 'doesnotexist', moduleId: 'subscriptions',
        records: [{ id: 1 }],
      });
    });
    expect(out, 'missing container should return false').toBe(false);
  });

  test('GH_MOUNT — per-mount onClick does not mutate the registered config', async ({ page }) => {
    // Regression: an earlier impl set config.onClick directly, which made
    // two mounts of different modules stomp each other's drawer functions.
    // The fix threads overrides through render() per-call. Verify here.
    await loadCardSystem(page);
    const result = await page.evaluate(() => {
      const div1 = document.createElement('div');
      div1.id = 'mountA';
      document.body.appendChild(div1);
      const div2 = document.createElement('div');
      div2.id = 'mountB';
      document.body.appendChild(div2);

      let called = 0;
      window.GH_MOUNT.intoContainer({
        containerId: 'mountA', moduleId: 'subscriptions',
        records: [{ id: 1, name: 'Test1' }],
        onClick: () => { called++; },
      });
      window.GH_MOUNT.intoContainer({
        containerId: 'mountB', moduleId: 'subscriptions',
        records: [{ id: 2, name: 'Test2' }],
        // No onClick on purpose. Click on B should NOT fire A's handler.
      });
      const cardB = div2.querySelector('.gh-card');
      cardB && cardB.click();
      return { calledFromBClick: called };
    });
    expect(result.calledFromBClick, 'mount B click leaked into mount A onClick').toBe(0);
  });

  // ─────────────────────────────────────────────────────────────
  // Brand lookup
  // ─────────────────────────────────────────────────────────────
  test('GH_CARD_SHARED.brandColorFor — known brand returns hex, unknown returns null', async ({ page }) => {
    await loadCardSystem(page);
    const result = await page.evaluate(() => ({
      netflix:    window.GH_CARD_SHARED.brandColorFor('Netflix'),
      chase:      window.GH_CARD_SHARED.brandColorFor('Chase'),
      sapphire:   window.GH_CARD_SHARED.brandColorFor('Chase Sapphire'),  // partial match
      stateFarm:  window.GH_CARD_SHARED.brandColorFor('State Farm'),
      unknown:    window.GH_CARD_SHARED.brandColorFor('Acme Bank Of Nowhere'),
      empty:      window.GH_CARD_SHARED.brandColorFor(''),
      nullCheck:  window.GH_CARD_SHARED.brandColorFor(null),
    }));
    expect(result.netflix, 'Netflix should resolve').toBe('#E50914');
    expect(result.chase, 'Chase should resolve').toBe('#0a4abf');
    expect(result.sapphire, 'Chase Sapphire should resolve via first-word match').toBe('#0a4abf');
    expect(result.stateFarm, 'State Farm should resolve').toBe('#d50000');
    expect(result.unknown, 'Unknown brand returns null').toBeNull();
    expect(result.empty, 'Empty string returns null').toBeNull();
    expect(result.nullCheck, 'null input returns null').toBeNull();
  });

  test('GH_CARD_SHARED.brandInitialsFor — known brand returns curated initials, unknown computes generic', async ({ page }) => {
    await loadCardSystem(page);
    const result = await page.evaluate(() => ({
      netflix:    window.GH_CARD_SHARED.brandInitialsFor('Netflix'),
      hd:         window.GH_CARD_SHARED.brandInitialsFor('Home Depot'),
      acme:       window.GH_CARD_SHARED.brandInitialsFor('Acme Bank'),
      single:     window.GH_CARD_SHARED.brandInitialsFor('Wesabe'),
      empty:      window.GH_CARD_SHARED.brandInitialsFor(''),
    }));
    expect(result.netflix, 'curated initials').toBe('NF');
    expect(result.hd, 'Home Depot curated initials').toBe('HD');
    expect(result.acme, 'unknown brand: first letters of words').toBe('AB');
    expect(result.single, 'unknown single word: first 3 chars').toBe('WES');
    expect(result.empty, 'empty returns ?').toBe('?');
  });

  // v202604.176 — regression pin for the UTC day-off bug. A bare
  // "YYYY-MM-DD" must be treated as LOCAL midnight (not UTC), so
  // today/tomorrow/yesterday resolve to 0/+1/-1 in ANY timezone. Before
  // the fix this failed in negative-UTC zones (bare date parsed as UTC,
  // shifted a calendar day → urgency/schedule lines one day early).
  test('GH_CARD_SHARED.daysFromToday/fmtDateShort — bare dates parse as LOCAL (no off-by-one)', async ({ page }) => {
    await loadCardSystem(page);
    const r = await page.evaluate(() => {
      const p = (n) => String(n).padStart(2, '0');
      const ymd = (off) => {
        const d = new Date();
        d.setDate(d.getDate() + off);
        return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
      };
      const S = window.GH_CARD_SHARED;
      const today = new Date();
      const expShort = today.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      return {
        today:    S.daysFromToday(ymd(0)),
        tomorrow: S.daysFromToday(ymd(1)),
        yest:     S.daysFromToday(ymd(-1)),
        far:      S.daysFromToday(ymd(7)),
        nul:      S.daysFromToday(null),
        garbage:  S.daysFromToday('not-a-date'),
        shortToday: S.fmtDateShort(ymd(0)),
        expShort,
      };
    });
    expect(r.today,    'bare today → 0').toBe(0);
    expect(r.tomorrow, 'bare tomorrow → +1 (was 0 pre-fix in -UTC)').toBe(1);
    expect(r.yest,     'bare yesterday → -1').toBe(-1);
    expect(r.far,      'bare +7 → 7').toBe(7);
    expect(r.nul,      'null → null').toBeNull();
    expect(r.garbage,  'garbage → null').toBeNull();
    expect(r.shortToday, 'fmtDateShort(today) matches local short date').toBe(r.expShort);
  });

  // ─────────────────────────────────────────────────────────────
  // GH_VIEW — 3-view toolbar (grid / list / card)
  // ─────────────────────────────────────────────────────────────
  test('GH_VIEW — renders only grid + list buttons by default (no card button)', async ({ page }) => {
    await page.goto(`${BASE}/index.html`, { waitUntil: 'load' });
    await page.waitForFunction(() => window.GH_VIEW, { timeout: 4000 });
    const result = await page.evaluate(() => {
      const div = document.createElement('div');
      div.id = 'viewToolbarDefault';
      document.body.appendChild(div);
      window.GH_VIEW.init('viewToolbarDefault', 'tdef', () => {});
      return {
        hasGrid: !!div.querySelector('#tdef-vgrid'),
        hasList: !!div.querySelector('#tdef-vlist'),
        hasCard: !!div.querySelector('#tdef-vcard'),
      };
    });
    expect(result.hasGrid, 'default toolbar should have grid button').toBe(true);
    expect(result.hasList, 'default toolbar should have list button').toBe(true);
    expect(result.hasCard, 'default toolbar should NOT have card button').toBe(false);
  });

  test('GH_VIEW — renders card button when views array includes "card"', async ({ page }) => {
    await page.goto(`${BASE}/index.html`, { waitUntil: 'load' });
    await page.waitForFunction(() => window.GH_VIEW, { timeout: 4000 });
    const result = await page.evaluate(() => {
      const div = document.createElement('div');
      div.id = 'viewToolbar3';
      document.body.appendChild(div);
      window.GH_VIEW.init('viewToolbar3', 't3', () => {}, {
        views: ['grid','list','card'],
      });
      return {
        hasGrid: !!div.querySelector('#t3-vgrid'),
        hasList: !!div.querySelector('#t3-vlist'),
        hasCard: !!div.querySelector('#t3-vcard'),
      };
    });
    expect(result.hasGrid, '3-view toolbar should have grid button').toBe(true);
    expect(result.hasList, '3-view toolbar should have list button').toBe(true);
    expect(result.hasCard, '3-view toolbar should have card button').toBe(true);
  });

  test('GH_VIEW — clicking card button updates state.view to "card" and fires callback', async ({ page }) => {
    await page.goto(`${BASE}/index.html`, { waitUntil: 'load' });
    await page.waitForFunction(() => window.GH_VIEW, { timeout: 4000 });
    const result = await page.evaluate(async () => {
      const div = document.createElement('div');
      div.id = 'viewToolbarClick';
      document.body.appendChild(div);
      // Use a unique storage prefix so we don't collide with localStorage
      // residue from prior test runs.
      const prefix = 'tclick' + Math.random().toString(36).slice(2, 7);
      const states = [];
      window.GH_VIEW.init(div.id, prefix, (s) => states.push(s.view), {
        views: ['grid','list','card'], defaultView: 'grid',
      });
      const btn = div.querySelector(`#${prefix}-vcard`);
      btn && btn.click();
      // Check button now has .active class
      return {
        cardActive: btn && btn.classList.contains('active'),
        gridActive: div.querySelector(`#${prefix}-vgrid`).classList.contains('active'),
        lastCallbackView: states[states.length - 1] || null,
      };
    });
    expect(result.lastCallbackView, 'callback fired with view=card').toBe('card');
    expect(result.cardActive, 'card button has active class').toBe(true);
    expect(result.gridActive, 'grid button no longer active').toBe(false);
  });

  test('GH_VIEW — view choice persists in localStorage and is read on next init', async ({ page }) => {
    await page.goto(`${BASE}/index.html`, { waitUntil: 'load' });
    await page.waitForFunction(() => window.GH_VIEW, { timeout: 4000 });
    // Use a randomized prefix so tests are independent. Tear down at end.
    const prefix = 'tpersist' + Math.random().toString(36).slice(2, 7);
    const result = await page.evaluate((pfx) => {
      const div = document.createElement('div');
      div.id = 'viewToolbarPersist1';
      document.body.appendChild(div);
      // First init — pick card
      window.GH_VIEW.init(div.id, pfx, () => {}, {
        views: ['grid','list','card'], defaultView: 'grid',
      });
      div.querySelector(`#${pfx}-vcard`).click();
      const savedView = localStorage.getItem(pfx + '_view');

      // Tear down + simulate page reload by re-initing into a new container
      div.remove();
      const div2 = document.createElement('div');
      div2.id = 'viewToolbarPersist2';
      document.body.appendChild(div2);
      window.GH_VIEW.init(div2.id, pfx, () => {}, {
        views: ['grid','list','card'], defaultView: 'grid',
      });
      const btnAfterReload = div2.querySelector(`#${pfx}-vcard`);
      const cardActiveAfter = btnAfterReload && btnAfterReload.classList.contains('active');

      // Cleanup
      localStorage.removeItem(pfx + '_view');
      div2.remove();

      return { savedView, cardActiveAfter };
    }, prefix);
    expect(result.savedView, 'card choice should persist to localStorage').toBe('card');
    expect(result.cardActiveAfter, 'card button should be pre-selected after re-init').toBe(true);
  });

  // ─────────────────────────────────────────────────────────────
  // Page wiring — pages with the 3-view toolbar load without errors
  // ─────────────────────────────────────────────────────────────
  // Confirms each wired page (a) loads without JS errors, (b) exposes the
  // GH_CARD + GH_MOUNT + GH_VIEW globals required by the card view.
  // We can't assert cards render without seeding records and toggling the
  // view button — that's a heavier integration test deferred for now.
  for (const wired of [
    { page: 'subscriptions.html' },
    { page: 'books.html' },
    { page: 'perfume.html' },
    { page: 'insurance.html' },
    { page: 'documents.html' },
    { page: 'wardrobe.html' },
    { page: 'property.html' },
  ]) {
    test(`page wiring — ${wired.page} loads cleanly with card view available`, async ({ page }) => {
      const errors = [];
      page.on('pageerror', e => errors.push(e.message));
      await page.goto(`${BASE}/${wired.page}`, { waitUntil: 'load' });
      // v202604.175 — these pages migrated from GH_VIEW.init() to GH_LENS,
      // which renders its OWN view toggle: `.gh-lens__views` containing
      // `.gh-lens__view-btn` buttons titled "Grid/List/Card view" (no ids).
      // The old `.gh-view-toolbar`/`[id$="-vcard"]` contract no longer
      // exists. GH_LENS renders after the async data load, so wait for the
      // toggle to attach (the .catch lets a genuine regression fail with a
      // clear assertion message rather than a bare timeout).
      await page.waitForSelector('.gh-lens__views button[title="Card view"]',
        { state: 'attached', timeout: 8000 }).catch(() => {});
      const globals = await page.evaluate(() => {
        const lensViews = document.querySelector('.gh-lens__views');
        return {
          ghCard:  !!window.GH_CARD,
          ghMount: !!window.GH_MOUNT,
          ghLens:  !!window.GH_LENS,
          // Card view is offered via the GH_LENS toggle
          cardBtnPresent: !!document.querySelector('.gh-lens__views button[title="Card view"]'),
          // grid + list + card buttons in the lens toggle
          toggleBtnCount: lensViews ? lensViews.querySelectorAll('button').length : 0,
        };
      });
      expect(globals.ghCard,  `${wired.page}: GH_CARD not loaded`).toBe(true);
      expect(globals.ghMount, `${wired.page}: GH_MOUNT not loaded`).toBe(true);
      expect(globals.ghLens,  `${wired.page}: GH_LENS not loaded`).toBe(true);
      expect(globals.cardBtnPresent,
        `${wired.page}: card-view button missing from the GH_LENS toggle — check views:['grid','list','card']`).toBe(true);
      expect(globals.toggleBtnCount,
        `${wired.page}: expected 3 view buttons in the lens toggle, found ${globals.toggleBtnCount}`).toBe(3);
      const real = errors.filter(e => !e.includes('favicon'));
      expect(real, `${wired.page}: page-load errors: ${real.join('; ')}`).toHaveLength(0);
    });
  }

  // ─────────────────────────────────────────────────────────────
  // Resilience features added in v120/121
  // ─────────────────────────────────────────────────────────────

  test('GH_CARD — single broken record renders error placeholder, others render normally', async ({ page }) => {
    await loadCardSystem(page);
    const result = await page.evaluate(() => {
      // Register a config that throws on a specific id
      window.GH_CARD.register('test_throw', {
        mode: 'full',
        title: (r) => {
          if (r.id === 99) throw new Error('intentional test throw');
          return r.name;
        },
        statusDot: () => 'good',
        hero: (r) => { const d = document.createElement('div'); d.textContent = r.name; return d; },
      });
      const div = document.createElement('div');
      div.id = 'errTest';
      document.body.appendChild(div);
      const wrap = window.GH_CARD.renderGrouped('test_throw', [
        { id: 1, name: 'Good A' },
        { id: 99, name: 'BROKEN' },
        { id: 2, name: 'Good B' },
      ]);
      div.appendChild(wrap);
      return {
        cardCount: div.querySelectorAll('.gh-card').length,
        errorCardCount: div.querySelectorAll('.gh-card--error').length,
        normalCount: div.querySelectorAll('.gh-card:not(.gh-card--error)').length,
      };
    });
    expect(result.cardCount, 'should render 3 cards total').toBe(3);
    expect(result.errorCardCount, 'should render 1 error placeholder').toBe(1);
    expect(result.normalCount, 'should render 2 normal cards').toBe(2);
  });

  test('GH_CARD — keyboard Enter on focused card activates onClick', async ({ page }) => {
    await loadCardSystem(page);
    const callCount = await page.evaluate(async () => {
      let calls = 0;
      const div = document.createElement('div');
      div.id = 'kbTest';
      document.body.appendChild(div);
      // Register override-able config
      const node = window.GH_CARD.render('subscriptions',
        { id: 1, name: 'Test', category: 'Streaming' },
        { onClick: () => { calls++; } }
      );
      div.appendChild(node);
      // Focus the card and press Enter
      node.focus();
      const event = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true });
      Object.defineProperty(event, 'target', { value: node });
      Object.defineProperty(event, 'currentTarget', { value: node });
      node.dispatchEvent(event);
      return calls;
    });
    expect(callCount, 'Enter on focused card should fire onClick').toBe(1);
  });

  test('GH_CARD — clickable card has tabindex=0 and role=button', async ({ page }) => {
    await loadCardSystem(page);
    const result = await page.evaluate(() => {
      const div = document.createElement('div');
      div.id = 'a11yTest';
      document.body.appendChild(div);
      const node = window.GH_CARD.render('subscriptions',
        { id: 1, name: 'Test', category: 'Streaming' },
        { onClick: () => {} }
      );
      div.appendChild(node);
      return {
        tabindex: node.getAttribute('tabindex'),
        role: node.getAttribute('role'),
        ariaLabel: node.getAttribute('aria-label'),
      };
    });
    expect(result.tabindex, 'tabindex should be "0"').toBe('0');
    expect(result.role, 'role should be "button"').toBe('button');
    expect(result.ariaLabel, 'aria-label should be present').toBeTruthy();
  });

  test('GH_CARD — non-clickable card has no tabindex (not in tab order)', async ({ page }) => {
    await loadCardSystem(page);
    const tabindex = await page.evaluate(() => {
      const div = document.createElement('div');
      div.id = 'a11yTest2';
      document.body.appendChild(div);
      const node = window.GH_CARD.render('subscriptions',
        { id: 1, name: 'Test', category: 'Streaming' }
        // no onClick override
      );
      div.appendChild(node);
      return node.getAttribute('tabindex');
    });
    expect(tabindex, 'card without onClick should not have tabindex').toBeNull();
  });

  test('GH_CARD — photoHero falls back to brand text when image 404s', async ({ page }) => {
    await loadCardSystem(page);
    const result = await page.evaluate(() => {
      const div = document.createElement('div');
      div.id = 'photoTest';
      document.body.appendChild(div);
      // Render a perfume card with a fake attachment id that will 404
      const node = window.GH_CARD.render('perfumes', {
        id: 1, name: 'Sauvage', brand: 'Dior',
        photo_attachment_id: 99999999,  // will 404
      });
      div.appendChild(node);
      const hero = node.querySelector('.gh-card__hero');
      const img = hero && hero.querySelector('img');
      return {
        heroHasFallbackText: hero && hero.textContent.includes('Sauvage'),
        heroHasImg: !!img,
        imgAlt: img && img.alt,
      };
    });
    expect(result.heroHasImg, 'should render an <img> for the photo').toBe(true);
    expect(result.heroHasFallbackText, 'fallback text should be in hero').toBe(true);
    expect(result.imgAlt, 'img should have meaningful alt text').toBeTruthy();
  });

  test('GH_MOUNT — defensive: container className reset before card mount', async ({ page }) => {
    await loadCardSystem(page);
    const result = await page.evaluate(() => {
      const div = document.createElement('div');
      div.id = 'classTest';
      div.className = 'wrd-list-grid lb-items-grid leftover-class';
      div.style.gridTemplateColumns = 'repeat(7, 1fr)';
      document.body.appendChild(div);
      window.GH_MOUNT.intoContainer({
        containerId: 'classTest', moduleId: 'subscriptions',
        records: [{ id: 1, name: 'Test', category: 'Streaming' }],
      });
      return {
        className: div.className,
        gridCols: div.style.gridTemplateColumns,
      };
    });
    expect(result.className.includes('wrd-list-grid'), 'leftover wrd-list-grid should be cleared').toBe(false);
    expect(result.className.includes('lb-items-grid'), 'leftover lb-items-grid should be cleared').toBe(false);
    expect(result.gridCols, 'leftover gridTemplateColumns should be cleared').toBe('');
  });

  test('GH_CARD — defensive: linkedEntities returning null does not throw', async ({ page }) => {
    await loadCardSystem(page);
    const ok = await page.evaluate(() => {
      window.GH_CARD.register('test_null_entities', {
        mode: 'full',
        title: (r) => r.name,
        statusDot: () => 'good',
        hero: (r) => { const d = document.createElement('div'); return d; },
        linkedEntities: () => null,  // should not crash
      });
      try {
        const node = window.GH_CARD.render('test_null_entities', { id: 1, name: 'Test' });
        return !!node && !node.classList.contains('gh-card--error');
      } catch { return false; }
    });
    expect(ok, 'config returning null from linkedEntities should not crash render').toBe(true);
  });

});
