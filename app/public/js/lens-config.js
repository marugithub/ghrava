/**
 * lens-config.js — Lens verb/dimension table for every module
 *
 * EDIT THIS FILE to change how the Lens reads on any module.
 *
 * Each module entry has:
 *   label         — module name in the sentence ("Subscriptions")
 *   plural        — count word ("subscriptions")
 *   personPrimary — (optional) true if the per-device family scope
 *                   should auto-apply a person pill on this module.
 *                   Defaults to false. Set true only when person is
 *                   the primary axis (kids, medical records, todos).
 *   dimensions    — keyed object of filter dimensions
 *
 * Built-in dimension keys (the lens has dedicated handling for these):
 *   person  — picks from /settings/family (avatars + names)
 *   status  — fixed list under `values: [...]`
 *   time    — date range presets (this week / month / etc.)
 *   tag     — picks from /api/v1/tags
 *
 * Pluggable dimension types (use any custom dim name):
 *   { type: 'select', verb, field, values: [...] }
 *     — single-select with a hardcoded values list
 *
 *   { type: 'api', verb, field, source: '/api/v1/…',
 *     labelField?: 'name', valueField?: 'id' }
 *     — single-select with values fetched from an API endpoint at
 *       lens init. Use for category, location, room, etc. — anything
 *       backed by a DB-loaded dropdown.
 *
 *   { type: 'text', verb, field }
 *     — free-text input. Whatever the user types becomes the filter
 *       value. Renderer applies it however it wants (substring match,
 *       exact match, etc.).
 *
 * If you add a NEW module: add an entry below. The Lens auto-renders
 * it. If you change a VERB: just edit the string. Reload page, see it.
 *
 * If you DON'T want a dimension on a module: omit it. Picker hides it.
 */

(function() {
  'use strict';

  const LENS_CONFIG = {

    subscriptions: {
      label: 'Subscriptions',
      plural: 'subscriptions',
      dimensions: {
        person:        { verb: 'for', field: 'owner_family_member_id' },
        status:        { verb: 'that are', field: 'status',
          values: ['active', 'paused', 'cancelled'] },
        billing_cycle: { type: 'select', verb: 'billed', field: 'billing_cycle',
          values: ['monthly', 'annual', 'quarterly', 'weekly'] },
        category:      { type: 'api', verb: 'in', field: 'category',
          source: '/settings/dropdowns/subscription_category',
          labelField: 'label', valueField: 'value' },
        time:          { verb: 'renewing', field: 'next_billing_date' },
        tag:           { verb: 'tagged', field: 'tags' },
      },
    },

    books: {
      label: 'Books',
      plural: 'books',
      dimensions: {
        person:  { verb: 'belonging to', field: 'family_member_id' },
        status:  { verb: 'that are', field: 'status',
          values: ['Currently Reading', 'Want to Read', 'Read', 'Abandoned'] },
        format:  { type: 'select', verb: 'in', field: 'format',
          values: ['Hardcover', 'Paperback', 'eBook', 'Audiobook'] },
        rating:  { type: 'select', verb: 'rated at least', field: 'rating',
          values: ['5', '4', '3', '2', '1'] },
        genre:   { type: 'text', verb: 'in genre', field: 'genre' },
        time:    { verb: 'started', field: 'date_started' },
        tag:     { verb: 'tagged', field: 'tags' },
      },
    },

    perfumes: {
      label: 'Perfumes',
      plural: 'perfumes',
      dimensions: {
        person:    { verb: 'belonging to', field: 'owner_family_member_id' },
        status:    { verb: 'that are', field: 'status',
          values: ['active', 'empty', 'given_away', 'lost'] },
        brand:     { type: 'text', verb: 'made by', field: 'brand' },
        season:    { type: 'select', verb: 'for', field: 'season',
          values: ['Spring', 'Summer', 'Fall', 'Winter', 'All Year'] },
        tag:       { verb: 'tagged', field: 'tags' },
      },
    },

    insurance_policies: {
      label: 'Insurance',
      plural: 'policies',
      dimensions: {
        policy_type: { type: 'select', verb: 'of type', field: 'policy_type',
          values: ['Auto', 'Home', 'Life', 'Health', 'Umbrella', 'Dental', 'Vision', 'Other'] },
        status:      { verb: 'that are', field: 'status',
          values: ['active', 'expired', 'cancelled'] },
        time:        { verb: 'renewing', field: 'coverage_end_date' },
        tag:         { verb: 'tagged', field: 'tags' },
      },
    },

    documents: {
      label: 'Documents',
      plural: 'documents',
      dimensions: {
        person:   { verb: 'for', field: 'family_member' },
        category: { type: 'api', verb: 'in', field: 'category',
          source: '/settings/dropdowns/document_category',
          labelField: 'label', valueField: 'value' },
        issuer:   { type: 'text', verb: 'issued by', field: 'issuer' },
        time:     { verb: 'expiring', field: 'expiry_date' },
        tag:      { verb: 'tagged', field: 'tags' },
      },
    },

    wardrobe: {
      label: 'Wardrobe',
      plural: 'items',
      dimensions: {
        person:   { verb: 'belonging to', field: 'wardrobe_owner_id' },
        status:   { verb: 'that are', field: 'wardrobe_status',
          values: ['active', 'archived', 'donated', 'discarded'] },
        category: { type: 'api', verb: 'in', field: 'category',
          source: '/settings/dropdowns/wardrobe_category',
          labelField: 'label', valueField: 'value' },
        brand:    { type: 'text', verb: 'made by', field: 'brand' },
        time:     { verb: 'last worn', field: 'last_worn',
          preset: 'past' },
        tag:      { verb: 'tagged', field: 'tags' },
      },
    },

    properties: {
      label: 'Properties',
      plural: 'properties',
      dimensions: {
        person: { verb: 'owned by', field: 'family_member_id' },
        type:   { type: 'select', verb: 'of type', field: 'property_type',
          values: ['House', 'Condo', 'Apartment', 'Land', 'Other'] },
        tag:    { verb: 'tagged', field: 'tags' },
      },
    },

    vehicles: {
      label: 'Vehicles',
      plural: 'vehicles',
      dimensions: {
        person: { verb: 'owned by', field: 'family_member_id' },
        type:   { type: 'select', verb: 'of type', field: 'vehicle_type',
          values: ['Car', 'Truck', 'Motorcycle', 'RV', 'Boat', 'Other'] },
        time:   { verb: 'serviced', field: 'last_service_date',
          preset: 'past' },
        tag:    { verb: 'tagged', field: 'tags' },
      },
    },

    medical_medications: {
      label: 'Medications',
      plural: 'medications',
      personPrimary: true,
      dimensions: {
        person:   { verb: 'for', field: 'family_member_id' },
        status:   { verb: 'that are', field: 'status',
          values: ['Active', 'Discontinued', 'As Needed', 'Completed'] },
        form:     { type: 'select', verb: 'in form', field: 'form',
          values: ['Tablet', 'Capsule', 'Liquid', 'Injection', 'Topical', 'Other'] },
        time:     { verb: 'started', field: 'start_date' },
        tag:      { verb: 'tagged', field: 'tags' },
      },
    },

    medical_conditions: {
      label: 'Conditions',
      plural: 'conditions',
      personPrimary: true,
      dimensions: {
        person: { verb: 'for', field: 'family_member_id' },
        status: { verb: 'that are', field: 'status',
          values: ['Active', 'Resolved', 'Monitoring', 'Chronic'] },
        time:   { verb: 'diagnosed', field: 'start_date' },
        tag:    { verb: 'tagged', field: 'tags' },
      },
    },

    medical_notes: {
      label: 'Visit notes',
      plural: 'visits',
      personPrimary: true,
      dimensions: {
        person: { verb: 'for', field: 'family_member_id' },
        time:   { verb: 'on', field: 'visit_date' },
        tag:    { verb: 'tagged', field: 'tags' },
      },
    },

    todos: {
      label: 'Todos',
      plural: 'todos',
      personPrimary: true,
      dimensions: {
        person:   { verb: 'for', field: 'family_member_id' },
        status:   { verb: 'that are', field: 'status',
          values: ['open', 'in_progress', 'done', 'dismissed'] },
        priority: { type: 'select', verb: 'with priority', field: 'priority',
          values: ['urgent', 'high', 'medium', 'low'] },
        category: { type: 'api', verb: 'in', field: 'category',
          source: '/settings/dropdowns/todo_category',
          labelField: 'label', valueField: 'value' },
        time:     { verb: 'due', field: 'due_date' },
        tag:      { verb: 'tagged', field: 'tags' },
      },
    },

    inventory: {
      label: 'Items',
      plural: 'items',
      // Person is OPTIONAL on inventory (most items have no owner) so do
      // NOT auto-apply device scope here. Person dim removed entirely;
      // family-member queries on inventory aren't really useful — most
      // items belong to the household, not an individual.
      dimensions: {
        category:    { type: 'api', verb: 'in category', field: 'category',
          source: '/settings/dropdowns/inventory_category',
          labelField: 'label', valueField: 'value' },
        location:    { type: 'api', verb: 'in', field: 'location_id',
          source: '/inventory/locations',
          labelField: 'name', valueField: 'id' },
        brand:       { type: 'text', verb: 'made by', field: 'brand' },
        is_business: { type: 'select', verb: 'that are', field: 'is_business',
          values: ['home items', 'business items'] },
        has_photo:   { type: 'select', verb: 'with', field: 'has_photo',
          values: ['photo', 'no photo'] },
        tag:         { verb: 'tagged', field: 'tags' },
      },
    },

    career_certs: {
      label: 'Certifications',
      plural: 'certifications',
      dimensions: {
        status:        { verb: 'that are', field: 'status',
          values: ['Active', 'Expired', 'Expiring Soon', 'Pending'] },
        issuing_body:  { type: 'text', verb: 'issued by', field: 'issuing_body' },
        time:          { verb: 'expiring', field: 'expiry_date' },
        tag:           { verb: 'tagged', field: 'tags' },
      },
    },

    kids_activities: {
      label: 'Activities',
      plural: 'activities',
      personPrimary: true,
      dimensions: {
        person:   { verb: 'for', field: 'family_member_id' },
        category: { type: 'select', verb: 'in', field: 'category',
          values: ['Sports', 'Music', 'Arts', 'Academic', 'Social', 'Other'] },
        tag:      { verb: 'tagged', field: 'tags' },
      },
    },

    resources: {
      label: 'Resources',
      plural: 'resources',
      dimensions: {
        link_type: { type: 'select', verb: 'of type', field: 'link_type',
          values: ['website', 'login', 'document', 'contact', 'other'] },
        tag:       { verb: 'tagged', field: 'tags' },
      },
    },

    wardrobe_outfits: {
      label: 'Outfits',
      plural: 'outfits',
      dimensions: {
        person:   { verb: 'for', field: 'family_member_id' },
        season:   { type: 'select', verb: 'in', field: 'season',
          values: ['Spring', 'Summer', 'Fall', 'Winter'] },
        occasion: { type: 'select', verb: 'for', field: 'occasion',
          values: ['Casual', 'School', 'Work', 'Formal', 'Evening'] },
        tag:      { verb: 'tagged', field: 'tags' },
      },
    },

    gift_cards: {
      label: 'Gift cards',
      plural: 'gift cards',
      dimensions: {
        status:   { verb: 'that are', field: 'status',
          values: ['active', 'expired', 'redeemed'] },
        retailer: { type: 'text', verb: 'from', field: 'retailer' },
        time:     { verb: 'expiring', field: 'expiry_date' },
        tag:      { verb: 'tagged', field: 'tags' },
      },
    },

  };

  // Time presets — shared across all modules. The `preset` hint on a
  // dimension can flip this to past-leaning ("never", "this year",
  // "over a year ago") for things like "last worn".
  const TIME_PRESETS_FUTURE = [
    { label: 'today',          days: 0,    cmp: 'on'      },
    { label: 'tomorrow',       days: 1,    cmp: 'on'      },
    { label: 'this week',      days: 7,    cmp: 'within'  },
    { label: 'this month',     days: 30,   cmp: 'within'  },
    { label: 'this quarter',   days: 90,   cmp: 'within'  },
    { label: 'this year',      days: 365,  cmp: 'within'  },
    { label: 'overdue',        days: -1,   cmp: 'before-today' },
  ];

  const TIME_PRESETS_PAST = [
    { label: 'today',          days: 0,    cmp: 'on'      },
    { label: 'this week',      days: -7,   cmp: 'within-past'  },
    { label: 'this month',     days: -30,  cmp: 'within-past'  },
    { label: 'this year',      days: -365, cmp: 'within-past'  },
    { label: 'over a year ago',days: -366, cmp: 'before'  },
    { label: 'never',          days: null, cmp: 'is-null' },
  ];

  // Helper to read a module config by id, with safe fallback
  function getModuleConfig(moduleId) {
    return LENS_CONFIG[moduleId] || null;
  }

  function getTimePresets(presetHint) {
    return presetHint === 'past' ? TIME_PRESETS_PAST : TIME_PRESETS_FUTURE;
  }

  // Shared time-match helper. Adapters call this with a record's date
  // string and the lens time-pill value to decide whether the record
  // passes the time filter. Returns true if no filter active.
  //
  //   LENS_CONFIG.timeMatch(record.due_date, '_todoFilters.time', 'future')
  //
  // dateStr      — ISO date 'YYYY-MM-DD' or null
  // presetLabel  — the label of a time preset (e.g. 'this week') or falsy
  // presetHint   — 'past' or 'future' (matches the dim's preset hint)
  function timeMatch(dateStr, presetLabel, presetHint) {
    if (!presetLabel) return true;
    const presets = getTimePresets(presetHint);
    const p = presets.find(x => x.label === presetLabel);
    if (!p) return true;

    // 'never' — no date set
    if (p.cmp === 'is-null') return !dateStr;
    if (!dateStr) return false;

    // Normalize to a Date at midnight
    const d = new Date(dateStr.length === 10 ? dateStr + 'T00:00:00' : dateStr);
    if (isNaN(d.getTime())) return false;
    const today = new Date(); today.setHours(0,0,0,0);
    const diffDays = Math.round((d - today) / 86400000);

    switch (p.cmp) {
      case 'on':            return diffDays === p.days;
      case 'within':        return diffDays >= 0 && diffDays <= p.days;
      case 'before-today':  return diffDays < 0;
      case 'within-past':   return diffDays <= 0 && diffDays >= p.days;
      case 'before':        return diffDays < p.days;
      default: return true;
    }
  }

  function listAllModules() {
    return Object.keys(LENS_CONFIG);
  }

  // Public API
  window.LENS_CONFIG = {
    get: getModuleConfig,
    timePresets: getTimePresets,
    timeMatch,
    modules: listAllModules,
    // Raw access for debugging / settings UI someday
    _raw: LENS_CONFIG,
  };
})();
