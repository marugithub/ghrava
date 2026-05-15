# Ghrava — Validation Procedure

This is the truth about what's checked before each deploy and — equally important
— what is NOT checked. Run before every package.

## How to run

```bash
cd app
python3 scripts/validate-static.py
```

Exit code 0 = clean, 1 = something failed. Add `-q` for terse output.

---

## What it catches (5 checks)

### 1. JavaScript syntax (`node --check`)
- Every `.js` file under `features/`, `public/js/`, plus `server.js`
- Every inline `<script>` block in `public/*.html` (excluding `type="text/babel"` JSX)
- Catches: typos, unclosed braces, missing commas, bad regex literals.
- Does NOT catch: any runtime issue.

### 2. Onclick → function resolution
- For every `on*="funcName(...)"` HTML attribute, verifies `funcName` is defined
  somewhere reachable on the page (inline script + shared scripts: lt-core.js,
  lt-refs.js, lt-messages.js, lt-attachments.js, nav.js, theme.js).
- Filters known browser globals, DOM methods, and keywords.
- This check **caught**: `autoFillZip` undefined in settings.html / property.html
  (was throwing on every keystroke in ZIP fields).

### 3. `window.api()` URL → route handler
- Builds a registry of every Express route from `server.js` (both `app.use()`
  feature mounts and direct `app.METHOD()` calls).
- For every `window.api('METHOD', '/path', ...)` in HTML, verifies a matching
  route exists. Handles `:param` expansion, trailing string concatenation
  (`'/foo/' + id`), and template literals (`` `/foo/${id}` ``).
- This check **caught**: `DELETE /api/v1/notifications/:id` (UI called it,
  no route existed) and `GET /api/v1/inventory/containers/:id/move-preview`
  (ditto — container move dialog was crashing on open).

### 4. Migrations parse as valid SQLite
- Loads every `.sql` file in `db/migrations/` into a sandbox SQLite DB
  cumulatively. Catches syntax errors, missing keywords, unbalanced parens.
- Filters known noise: stub schema doesn't have every column, so
  "no such column" / "has no column named" are ignored.
- This check **validated**: migration 114 (wardrobe_color) when added.

### 5. `db.prepare()` static SQL parses
- Extracts every `db.prepare(\`...\`)` template literal that has no `${}`
  interpolation. Tries to parse against a sandbox DB.
- Filters "no such column" / "has no column named" since stub schema is minimal.
- Catches: typos in keywords, unclosed parens, missing FROM, etc.

---

## What it CANNOT catch

These need a running server, real DB, and/or browser. None are testable in
the static-analysis sandbox we have today:

| Bug class | Why static check can't see it |
|---|---|
| Runtime null refs (`a.b.c` where `b` is undefined) | Needs execution |
| SQL errors on populated DB (e.g. unique violation on real data) | Needs DB state |
| Auth / session edge cases | Needs request context |
| Race conditions, async timing | Needs event loop |
| CSS / visual breakage | Needs browser render |
| Browser-specific JS (Safari quirks, etc.) | Only node --check happens |
| Logic bugs (wrong field name in payload, off-by-one in pagination) | Needs runtime data |
| `require('./broken')` paths | Needs module loading |
| Cross-origin / CORS issues | Needs network |
| Migration interactions with real existing data | Needs prod-like DB |

**Honest assessment:** static analysis catches roughly the bottom 40-60% of
"breaks the page" bugs. The rest only show up when you actually load the page.
There is no substitute for opening it and clicking around.

---

## What WOULD be the "best possible" testing

Things that would close the runtime gap, if/when worth the setup cost:

1. **Playwright headless browser tests** — actually load every page, check
   no JS console errors, click each button, verify HTTP responses are 2xx.
   Would catch most of the "not testable above" list.

2. **Live server smoke test** — boot the actual app with the live DB
   backup, hit every GET route, verify 200 + valid JSON shape. Catches
   handler-level bugs, SQL errors, missing columns.

3. **`req.body` shape audit** — for each `POST/PUT` handler, list the
   `req.body.X` references. For each client call site, list the keys
   being sent. Diff. Catches client/server payload drift.

4. **TypeScript pass on JS files** — `tsc --checkJs` flags more issues
   than `node --check` (unused vars, possibly-undefined, etc).

5. **End-to-end migration replay** — apply all 108 migrations in order
   to a blank DB and verify we end up with the same schema as the live DB.
   Catches migration ordering bugs.

The current `validate-static.py` covers #1-#5 of the "what it catches" list.
None of the items above are in scope yet.

---

## Real bugs caught so far via this suite

| When | What | How |
|---|---|---|
| v086 | `autoFillZip` undefined in settings.html + property.html | Onclick→function check |
| v087 | `DELETE /api/v1/notifications/:id` route missing | Endpoint cross-check |
| v087 | `GET /api/v1/inventory/containers/:id/move-preview` missing | Endpoint cross-check |

---

## Adding new checks

The script is plain Python, no deps beyond `sqlite3` (stdlib). Add a function,
call it from `__main__`. Keep checks fast — full sweep should run < 5 seconds.
