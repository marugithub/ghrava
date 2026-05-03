/**
 * lens-config.js — Lens verb/dimension table for every module
 *
 * EDIT THIS FILE to change how the Lens reads on any module.
 *
 * Each module entry has:
 *   label      — what the module is called in the sentence ("Subscriptions")
 *   plural     — how the count word reads ("subscriptions")
 *   dimensions — which filter dimensions apply, with their verb and field name
 *
 * Dimension types (built-in, the lens knows how to render each):
 *   person  — picks from /settings/family (avatars + names)
 *   status  — picks from a fixed list of values
 *   time    — picks a date range (this week / month / quarter / year / overdue / etc)
 *   tag     — picks from /api/v1/tags
 *
 * Each dimension has:
 *   verb    — the connective phrase ("for", "renewing", "expiring")
 *   field   — the API field name to filter on
 *   values  — (status only) the allowed values
 *   preset  — (time only) override default time presets if needed
 *
 * If you add a NEW module: add an entry below. The Lens will work
 * automatically — no other code changes needed.
 *
 * If you change a VERB: just edit the string. Reload page, see the change.
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
        person: { verb: 'for', field: 'owner_family_member_id' },
        status: { verb: 'that are', field: 'status',
          values: ['active', 'paused', 'cancelled'] },
        time:   { verb: 'renewing', field: 'next_charge_at' },
        tag:    { verb: 'tagged', field: 'tags' },
      },
    },

    books: {
      label: 'Books',
      plural: 'books',
      dimensions: {
        person: { verb: 'belonging to', field: 'family_member_id' },
        status: { verb: 'that are', field: 'status',
          values: ['Currently Reading', 'Want to Read', 'Read', 'Abandoned'] },
        time:   { verb: 'started', field: 'date_started' },
        tag:    { verb: 'tagged', field: 'tags' },
      },
    },

    perfumes: {
      label: 'Perfumes',
      plural: 'perfumes',
      dimensions: {
        person: { verb: 'belonging to', field: 'owner_family_member_id' },
        status: { verb: 'that are', field: 'status',
          values: ['active', 'empty', 'given_away', 'lost'] },
        tag:    { verb: 'tagged', field: 'tags' },
      },
    },

    insurance_policies: {
      label: 'Insurance',
      plural: 'policies',
      dimensions: {
        status: { verb: 'that are', field: 'status',
          values: ['active', 'expired', 'cancelled'] },
        time:   { verb: 'renewing', field: 'coverage_end_date' },
        tag:    { verb: 'tagged', field: 'tags' },
      },
    },

    documents: {
      label: 'Documents',
      plural: 'documents',
      dimensions: {
        person: { verb: 'for', field: 'family_member' },
        time:   { verb: 'expiring', field: 'expiry_date' },
        tag:    { verb: 'tagged', field: 'tags' },
      },
    },

    wardrobe: {
      label: 'Wardrobe',
      plural: 'items',
      dimensions: {
        person: { verb: 'belonging to', field: 'wardrobe_owner_id' },
        status: { verb: 'that are', field: 'wardrobe_status',
          values: ['active', 'archived', 'donated', 'discarded'] },
        time:   { verb: 'last worn', field: 'last_worn',
          preset: 'past' },  // hint: presets should be past-leaning ("this week", "this year", "never")
        tag:    { verb: 'tagged', field: 'tags' },
      },
    },

    properties: {
      label: 'Properties',
      plural: 'properties',
      dimensions: {
        person: { verb: 'owned by', field: 'family_member_id' },
        tag:    { verb: 'tagged', field: 'tags' },
      },
    },

    vehicles: {
      label: 'Vehicles',
      plural: 'vehicles',
      dimensions: {
        person: { verb: 'owned by', field: 'family_member_id' },
        time:   { verb: 'serviced', field: 'last_service_date',
          preset: 'past' },
        tag:    { verb: 'tagged', field: 'tags' },
      },
    },

    medical_medications: {
      label: 'Medications',
      plural: 'medications',
      dimensions: {
        person: { verb: 'for', field: 'family_member_id' },
        status: { verb: 'that are', field: 'status',
          values: ['Active', 'Discontinued', 'As Needed', 'Completed'] },
        time:   { verb: 'started', field: 'start_date' },
        tag:    { verb: 'tagged', field: 'tags' },
      },
    },

    medical_conditions: {
      label: 'Conditions',
      plural: 'conditions',
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
      dimensions: {
        person: { verb: 'for', field: 'family_member_id' },
        time:   { verb: 'on', field: 'visit_date' },
        tag:    { verb: 'tagged', field: 'tags' },
      },
    },

    todos: {
      label: 'Todos',
      plural: 'todos',
      dimensions: {
        person: { verb: 'for', field: 'family_member_id' },
        status: { verb: 'that are', field: 'status',
          values: ['open', 'done'] },
        time:   { verb: 'due', field: 'due_date' },
        tag:    { verb: 'tagged', field: 'tags' },
      },
    },

    inventory: {
      label: 'Items',
      plural: 'items',
      dimensions: {
        person: { verb: 'owned by', field: 'family_member_id' },
        tag:    { verb: 'tagged', field: 'tags' },
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

  function listAllModules() {
    return Object.keys(LENS_CONFIG);
  }

  // Public API
  window.LENS_CONFIG = {
    get: getModuleConfig,
    timePresets: getTimePresets,
    modules: listAllModules,
    // Raw access for debugging / settings UI someday
    _raw: LENS_CONFIG,
  };
})();
