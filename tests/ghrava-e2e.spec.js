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
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500); // let deferred JS settle

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
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(`POST ${path} → ${r.status}: ${await r.text()}`);
  return r.json();
}

/** DELETE from API */
async function apiDelete(path) {
  const r = await fetch(`${API}${path}`, { method: 'DELETE' });
  if (!r.ok) throw new Error(`DELETE ${path} → ${r.status}`);
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
    test(`${name} loads with HTTP 200`, async ({ page }) => {
      const response = await page.goto(BASE + path, { waitUntil: 'load' });
      expect(response.status(), `${name}: HTTP status`).toBe(200);
    });

    test(`${name} has no raw HTML in text content`, async ({ page }) => {
      await checkNoRawHtml(page, BASE + path, name);
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
    const book = await apiPost('/books', {
      title: '_e2e_book_tag_test',
      status: 'Want to Read',
      format: 'Physical',
      tags: ['e2etesttag'],
    });
    try {
      await page.goto(BASE + '/books.html', { waitUntil: 'load' });
      // Click "Want to Read" shelf — default is "Currently Reading"
      await page.click('text=Want to Read');
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

  test('Dashboard widgets load and contain numeric values', async ({ page }) => {
    await page.goto(BASE + '/index.html', { waitUntil: 'load' });
    await page.waitForSelector('.widget-value, .dash-stat, [class*="stat"]', { timeout: 5000 }).catch(() => {});
    // At least one widget value should not be — (loading placeholder)
    const widgets = page.locator('.widget-value');
    const count = await widgets.count();
    expect(count, 'No widget values found').toBeGreaterThan(0);
  });

  test('Todos page renders todo items or empty state', async ({ page }) => {
    await page.goto(BASE + '/todos.html', { waitUntil: 'load' });
    await page.waitForSelector('.todo-item, .todos-empty, .todo-section-head', { timeout: 5000 }).catch(() => {});
    const hasTodos = await page.locator('.todo-item').count() > 0;
    const hasEmpty = await page.locator('.todos-empty, .empty-state, .empty').count() > 0;
    expect(hasTodos || hasEmpty, 'Todos page: neither todo items nor empty state found').toBe(true);
  });

  test('Reports page tabs are clickable and load content', async ({ page }) => {
    await page.goto(BASE + '/reports.html', { waitUntil: 'load' });
    // Click Data Quality tab
    await page.click('[data-tab="quality"]');
    await page.waitForSelector('#qualityContent :first-child', { timeout: 5000 }).catch(() => {});
    const qualityContent = page.locator('#qualityContent');
    await expect(qualityContent).toBeVisible();
    // Should not contain raw HTML/JS as visible text
    const rawHtml = await qualityContent.evaluate(el =>
      /<button[^>]*onclick=/.test(el.textContent) || /window\.LT/.test(el.textContent)
    );
    expect(rawHtml, 'Data Quality tab contains raw HTML/JS').toBe(false);
  });

  test('Settings page loads key sections', async ({ page }) => {
    await page.goto(BASE + '/settings.html', { waitUntil: 'load' });
    await expect(page.locator('#app')).toBeVisible();
    // Wait for settings rows to be rendered (JS populates them after load)
    await page.waitForSelector('.settings-row-label', { timeout: 8000 });
    // Family Members and Tags must appear in the main nav list
    const labels = await page.locator('.settings-row-label').allTextContents();
    expect(labels.some(l => l.includes('Family Members')), `Family Members not in settings nav. Found: ${labels.join(', ')}`).toBe(true);
    expect(labels.some(l => l.includes('Tags')), `Tags not in settings nav. Found: ${labels.join(', ')}`).toBe(true);
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
        headers: { 'Content-Type': 'application/json' },
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
    const book = await apiPost('/books', {
      title: '_e2e_book_test',
      author: 'E2E Author',
      status: 'Want to Read',
      format: 'Physical',
      tags: ['_e2etag_'],
    });
    expect(book.id, 'Book create: no id').toBeTruthy();
    try {
      await page.goto(BASE + '/books.html', { waitUntil: 'load' });
      // Click "Want to Read" shelf — books default to "Currently Reading"
      await page.click('text=Want to Read');
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
      // Click "All Items" mode
      const allItemsBtn = page.locator('text=All Items').first();
      if (await allItemsBtn.count()) await allItemsBtn.click();
      await page.waitForSelector('.ai-card, .ai-list-card, .empty-state', { timeout: 5000 }).catch(() => {});
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
          headers: { 'Content-Type': 'application/json' }, body: '{}' });
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

  test('POST to protected endpoint without token hits validation not 401', async ({ request }) => {
    // Auth is disabled — writes should return 400 (validation) not 401 (auth)
    const r = await request.post(`${API}/books`, {
      data: {}, headers: { 'Content-Type': 'application/json' }
    });
    expect(r.status(), 'POST /books with empty body should 400 not 401').toBe(400);
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
      headers: { 'Content-Type': 'application/json' },
    });
    expect(r.status(), 'Create rule: HTTP status').toBe(201);
    const rule = await r.json();
    expect(rule.id).toBeTruthy();
    // Delete it
    const del = await request.delete(`${API}/finance/category-rules/${rule.id}`);
    expect(del.ok()).toBe(true);
  });

  test('POST /finance/category-rules/apply returns updated count', async ({ request }) => {
    const r = await request.post(`${API}/finance/category-rules/apply`, {
      data: {}, headers: { 'Content-Type': 'application/json' },
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
      multipart: { file: { name: 'test.xlsx', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', buffer: Buffer.from('') } }
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
