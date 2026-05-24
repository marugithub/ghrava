/**
 * gh-filter-strip.js — Filter pill row for report viewer pages (v.197)
 *
 * Renders the filter strip shown above a report's data table per the
 * locked #30c mockup: small removable pills + "+ Add filter" trigger.
 *
 * Built for v.198+ consumption (Money tab live wirings). Foundation
 * drop ships the component so consumers don't have to invent it.
 *
 * Usage:
 *   GH_FILTERS.render({
 *     container,                  // DOM element to (re)populate
 *     filters,                    // [{ key, label, value }]
 *     onRemove,                   // function(key) — pill X clicked
 *     onAdd,                      // function() — "+ Add filter" clicked
 *   })
 *
 * Mobile (per locked M6): pills wrap inline naturally; "+ Add filter"
 * stays attached to the last pill rather than getting its own row.
 * No special mobile branch needed — wrap is the default behaviour.
 */
(function() {
  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function render(opts) {
    const { container, filters = [], onRemove, onAdd } = opts || {};
    if (!container) return;
    container.innerHTML = '';
    container.className = (container.className + ' gh-filters').trim();
    container.style.cssText = ''
      + 'background: var(--bg2);'
      + 'border: 1px solid var(--border);'
      + 'border-radius: 8px;'
      + 'padding: 10px 12px;'
      + 'display: flex;'
      + 'gap: 8px;'
      + 'align-items: center;'
      + 'flex-wrap: wrap;'
      + 'margin-bottom: 14px;';

    const label = document.createElement('span');
    label.style.cssText = 'font-size:11px;color:var(--text3);text-transform:uppercase;letter-spacing:.04em;font-weight:500';
    label.textContent = 'Filters';
    container.appendChild(label);

    for (const f of filters) {
      const pill = document.createElement('span');
      pill.style.cssText = ''
        + 'font-size:12px;padding:4px 10px;background:var(--bg3);color:var(--text);'
        + 'border-radius:999px;border:0.5px solid var(--border);'
        + 'display:inline-flex;align-items:center;gap:6px';
      pill.innerHTML = esc(f.label) + ': <strong style="font-weight:600">' + esc(String(f.value)) + '</strong>';
      const x = document.createElement('button');
      x.textContent = '×';
      x.title = 'Remove this filter';
      x.style.cssText = ''
        + 'background:none;border:none;cursor:pointer;color:var(--text3);'
        + 'font-size:14px;padding:0 2px;line-height:1';
      x.onclick = () => onRemove && onRemove(f.key);
      pill.appendChild(x);
      container.appendChild(pill);
    }

    const addBtn = document.createElement('button');
    addBtn.textContent = '+ Add filter';
    addBtn.style.cssText = ''
      + 'font-size:11px;padding:4px 10px;background:transparent;color:var(--accent);'
      + 'border:0.5px dashed var(--border);border-radius:999px;cursor:pointer;'
      + 'font-family:inherit';
    addBtn.onclick = () => onAdd && onAdd();
    container.appendChild(addBtn);
  }

  window.GH_FILTERS = { render };
})();
