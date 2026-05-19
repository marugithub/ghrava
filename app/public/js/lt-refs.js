/**
 * lt-refs.js — Ghrava shared reference dropdown utility
 * Include on every page that needs family or contact selects.
 *
 * Provides:
 *   GH_REFS.populateFamily(selectId, currentVal)
 *     — fills a <select> with family members, optional blank first option
 *
 *   GH_REFS.populateContact(selectId, currentVal, opts)
 *     — fills a <select> with contacts, optional type filter
 *     — opts.type: 'Medical' | 'Contractor' | etc — filters list
 *     — opts.placeholder: string — first blank option label
 *     — opts.allowAdd: bool (default true) — show + Add new contact option
 *
 *   GH_REFS.openContactDrawer(opts)
 *     — opens Settings contact drawer in a modal overlay
 *     — opts.type: pre-select a contact type in the drawer
 *     — opts.onSave: callback(contact) called after save
 *
 *   GH_REFS.openFamilyDrawer(opts)
 *     — opens Settings family drawer in a modal overlay
 *     — opts.onSave: callback(member) called after save
 *
 * Cache: family and contacts are cached for 60s per type bucket.
 */

window.GH_REFS = (function () {

  // ── Cache ────────────────────────────────────────────────────
  const _cache = {};      // keyed by 'family' or 'contact:Type' or 'contact:all'
  const _cacheTime = {};
  const CACHE_TTL = 60000;

  function _cacheKey(type) {
    return type ? `contact:${type}` : 'contact:all';
  }

  function _isFresh(key) {
    return _cache[key] && (Date.now() - (_cacheTime[key] || 0)) < CACHE_TTL;
  }

  function _bust(key) {
    delete _cache[key];
    // Also bust 'contact:all' whenever any typed bucket is busted
    if (key !== 'contact:all') delete _cache['contact:all'];
    delete _cache['family'];
  }

  // ── Fetch helpers ────────────────────────────────────────────
  async function _fetchFamily() {
    if (_isFresh('family')) return _cache['family'];
    try {
      const r = await fetch('/api/v1/settings/family', {
        headers: { 'Authorization': 'Bearer ' + (window.LT?.authToken || '') }
      });
      const data = r.ok ? await r.json() : [];
      _cache['family'] = data;
      _cacheTime['family'] = Date.now();
      return data;
    } catch { return []; }
  }

  async function _fetchContacts(type) {
    const key = _cacheKey(type);
    if (_isFresh(key)) return _cache[key];
    try {
      const url = type
        ? `/api/v1/settings/contacts?type=${encodeURIComponent(type)}`
        : '/api/v1/settings/contacts';
      const r = await fetch(url, {
        headers: { 'Authorization': 'Bearer ' + (window.LT?.authToken || '') }
      });
      const data = r.ok ? await r.json() : [];
      _cache[key] = data;
      _cacheTime[key] = Date.now();
      return data;
    } catch { return []; }
  }

  // ── Display label for a contact in a dropdown ────────────────
  // Shows "Name — Specialty" when specialty exists to distinguish duplicates
  function _contactLabel(c) {
    return c.specialty ? `${c.name} — ${c.specialty}` : c.name;
  }

  // ── populateFamily ───────────────────────────────────────────
  async function populateFamily(selectId, currentVal, opts = {}) {
    const sel = document.getElementById(selectId);
    if (!sel) return;

    const placeholder = opts.placeholder !== undefined ? opts.placeholder : 'Self';
    const allowAdd    = opts.allowAdd !== false;

    const members = await _fetchFamily();

    sel.innerHTML = '';
    if (placeholder !== null) {
      const blank = document.createElement('option');
      blank.value = placeholder === 'Self' ? 'Self' : '';
      blank.textContent = placeholder;
      if (!currentVal || currentVal === blank.value) blank.selected = true;
      sel.appendChild(blank);
    }

    members.forEach(m => {
      const opt = document.createElement('option');
      opt.value = m.display_name;
      opt.textContent = m.display_name;
      if (currentVal === m.display_name) opt.selected = true;
      sel.appendChild(opt);
    });

    if (allowAdd) {
      const addOpt = document.createElement('option');
      addOpt.value = '__add_family__';
      addOpt.textContent = '＋ Add family member…';
      sel.appendChild(addOpt);

      sel.removeEventListener('change', sel._ghRefsFamily);
      sel._ghRefsFamily = () => {
        if (sel.value === '__add_family__') {
          // Revert to previous value while drawer opens
          sel.value = currentVal || (placeholder !== null ? (placeholder === 'Self' ? 'Self' : '') : '');
          openFamilyDrawer({
            onSave: async (member) => {
              _bust('family');
              await populateFamily(selectId, member.display_name, opts);
            }
          });
        }
      };
      sel.addEventListener('change', sel._ghRefsFamily);
    }
  }

  // ── populateContact ──────────────────────────────────────────
  async function populateContact(selectId, currentVal, opts = {}) {
    const sel = document.getElementById(selectId);
    if (!sel) return;

    const type        = opts.type        || null;
    const placeholder = opts.placeholder !== undefined ? opts.placeholder : '— select —';
    const allowAdd    = opts.allowAdd    !== false;

    const contacts = await _fetchContacts(type);

    sel.innerHTML = '';
    if (placeholder) {
      const blank = document.createElement('option');
      blank.value = '';
      blank.textContent = placeholder;
      if (!currentVal) blank.selected = true;
      sel.appendChild(blank);
    }

    contacts.forEach(c => {
      const opt = document.createElement('option');
      opt.value = String(c.id);
      opt.textContent = _contactLabel(c);
      if (currentVal && String(currentVal) === String(c.id)) opt.selected = true;
      sel.appendChild(opt);
    });

    // If saved value not in list (e.g. deleted contact), show placeholder
    if (currentVal && !contacts.find(c => String(c.id) === String(currentVal))) {
      const ghost = document.createElement('option');
      ghost.value = String(currentVal);
      ghost.textContent = `(ID ${currentVal} — not found)`;
      ghost.selected = true;
      sel.appendChild(ghost);
    }

    if (allowAdd) {
      const addOpt = document.createElement('option');
      addOpt.value = '__add_contact__';
      addOpt.textContent = '＋ Add new contact…';
      sel.appendChild(addOpt);

      sel.removeEventListener('change', sel._ghRefsContact);
      sel._ghRefsContact = () => {
        if (sel.value === '__add_contact__') {
          sel.value = currentVal ? String(currentVal) : '';
          openContactDrawer({
            type,
            onSave: async (contact) => {
              _bust(_cacheKey(type));
              await populateContact(selectId, contact.id, opts);
            }
          });
        }
      };
      sel.addEventListener('change', sel._ghRefsContact);
    }
  }

  // ── Shared iframe overlay for Settings drawers ────────────────
  // Settings.html is the canonical form for contacts and family members.
  // One form, maintained in one place. We load it in a hidden iframe
  // overlay so the user never navigates away. The settings page detects
  // ?drawer=contact and suppresses its main UI, showing only the drawer.
  // When the drawer saves, settings.html postMessages the record back.

  function _openSettingsDrawer(drawerType, presetType, onSave, presetName, editId) {
    document.getElementById('gh-refs-overlay')?.remove();

    const overlay = document.createElement('div');
    overlay.id = 'gh-refs-overlay';
    overlay.style.cssText = [
      'position:fixed', 'inset:0', 'z-index:8000',
      'background:rgba(0,0,0,0.55)', 'backdrop-filter:blur(4px)',
      'display:flex', 'align-items:flex-end', 'justify-content:center',
    ].join(';');

    const frame = document.createElement('iframe');
    frame.src = '/settings.html?drawer=' + drawerType +
      (presetType ? '&type=' + encodeURIComponent(presetType) : '') +
      (presetName ? '&name=' + encodeURIComponent(presetName) : '') +
      (editId   ? '&id='   + encodeURIComponent(editId)   : '');
    frame.style.cssText = [
      'width:min(560px,100vw)', 'height:92vh',
      'border:none', 'border-radius:20px 20px 0 0',
      'background:var(--bg)', 'display:block',
    ].join(';');

    overlay.appendChild(frame);
    document.body.appendChild(overlay);

    overlay.addEventListener('pointerdown', e => {
      if (e.target === overlay) overlay.remove();
    });

    function onMessage(e) {
      if (e.data?.ghravaSaved === drawerType) {
        window.removeEventListener('message', onMessage);
        overlay.remove();
        if (onSave) onSave(e.data.record);
      }
      if (e.data?.ghravaCancelled === drawerType) {
        window.removeEventListener('message', onMessage);
        overlay.remove();
      }
    }
    window.addEventListener('message', onMessage);
  }

  function openContactDrawer(opts = {}) {
    _openSettingsDrawer('contact', opts.type || '', opts.onSave, opts.name || '');
  }

  // opts.editId → opens the EDIT form for that family member; omit for Add.
  function openFamilyDrawer(opts = {}) {
    _openSettingsDrawer('family', '', opts.onSave, '', opts.editId);
  }

  // ── Bust cache externally ─────────────────────────────────────
  function bustFamily() { _bust('family'); }
  function bustContacts(type) { _bust(_cacheKey(type)); }

  return {
    populateFamily,
    populateContact,
    openContactDrawer,
    openFamilyDrawer,
    bustFamily,
    bustContacts,
  };

})();
