/**
 * lt-shared-data.js — Ghrava shared data cache
 * Include after lt-core.js on pages that use family/contacts/dropdowns.
 *
 * Provides:
 *   LT.data.familyMembers       cached array
 *   LT.data.contacts            cached array (all)
 *   LT.data.invCategories       cached dropdown options
 *   LT.data.load()              fetch all shared data in parallel
 *   LT.data.populateFamilySelect(selectEl, currentVal)
 *   LT.data.populateContactDatalist(datalistEl, type?)
 *   LT.data.populateCategoryDropdown(selectEl, currentVal)
 */

LT.data = (function() {
  let familyMembers  = [];
  let contacts       = [];
  let invCategories  = [];
  let _loaded        = false;

  async function load(opts = {}) {
    const paths = {
      family:     '/settings/family',
      contacts:   '/settings/contacts',
      categories: '/settings/dropdowns/inventory_category',
    };

    const skip = opts.skip || [];

    const [fam, con, cats] = await Promise.all([
      skip.includes('family')     ? Promise.resolve(familyMembers)  : silentGet(paths.family),
      skip.includes('contacts')   ? Promise.resolve(contacts)        : silentGet(paths.contacts),
      skip.includes('categories') ? Promise.resolve(invCategories)   : silentGet(paths.categories),
    ]);

    familyMembers = fam;
    contacts      = con;
    invCategories = cats;
    _loaded       = true;
  }

  function populateFamilySelect(selectEl, currentVal) {
    if (!selectEl) return;
    selectEl.innerHTML = '';
    const members = familyMembers.length ? familyMembers : [{ display_name: 'Self' }];
    members.forEach(m => {
      const opt = document.createElement('option');
      opt.value       = m.display_name;
      opt.textContent = m.display_name;
      if (m.display_name === (currentVal || 'Self')) opt.selected = true;
      selectEl.appendChild(opt);
    });
  }

  function populateContactDatalist(datalistEl, type = null) {
    if (!datalistEl) return;
    datalistEl.innerHTML = '';
    const filtered = type
      ? contacts.filter(c => c.contact_type === type)
      : contacts;
    filtered.forEach(c => {
      const opt = document.createElement('option');
      opt.value = c.name;
      datalistEl.appendChild(opt);
    });
  }

  // CAT_CONFIG fallback if dropdown_options is empty
  const CAT_FALLBACK = [
    'Electronics','Appliances','Furniture','Tools','Clothing','Sports',
    'Toys','Kitchen','Outdoor','Documents','Health & Wellness','Holiday','Books','Other'
  ].map(k => ({ label: k, value: k }));

  function populateCategoryDropdown(selectEl, currentVal) {
    if (!selectEl) return;
    const current = currentVal ?? selectEl.value;
    selectEl.innerHTML = '<option value="">— none —</option>';
    const cats = invCategories.length ? invCategories : CAT_FALLBACK;
    cats.forEach(c => {
      const o = document.createElement('option');
      o.value       = c.value;
      o.textContent = c.label;
      if (c.value === current) o.selected = true;
      selectEl.appendChild(o);
    });
  }

  // Public read-only getters
  return {
    get familyMembers()  { return familyMembers;  },
    get contacts()       { return contacts;        },
    get invCategories()  { return invCategories;   },
    get loaded()         { return _loaded;          },
    load,
    populateFamilySelect,
    populateContactDatalist,
    populateCategoryDropdown,
  };
})();
