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
 *     — single-select with values fetched from an API endpoint at lens
 *       init. Use for category, location, room, etc. — anything backed
 *       by a DB-loaded dropdown.
 *
 *   { type: 'text', verb, field }
 *     — free-text input. Whatever the user types becomes the filter
 *       value. Renderer applies it however it wants (typically a
 *       case-insensitive substring match on `field`).
 *
 * Design principle (v202604.132):
 *   Each module gets dimensions for its KEY fields — the few axes a
 *   user would actually narrow by. The primary-name field always gets
 *   a `text` dim because "find Netflix" / "find Lisinopril" is the
 *   most common lookup pattern. Long-tail fields (notes, descriptions,
 *   addresses, free-form details) stay OUT of the lens — they're
 *   covered by the global search modal (Cmd+K).
 */

(function() {
  'use strict';

  const LENS_CONFIG = {

    subscriptions: {
      label: 'Subscriptions',
      plural: 'subscriptions',
      dimensions: {
        name:          { type: 'text', verb: 'named', field: 'name' },
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

    // v.169 — Budgets lens (Finance → Budgets tab)
    budgets: {
      label: 'Budgets',
      plural: 'budgets',
      dimensions: {
        category: { type: 'text', verb: 'for', field: 'category' },
        year:     { type: 'select', verb: 'in', field: 'year',
          values: ['2026','2025','2024','2023'] },
        status:   { type: 'select', verb: 'that are', field: 'is_active',
          values: ['1','0'] },
      },
    },

    // v.171 — Pending Items Report. Dimensions match the filter chips
    // on /reports.html?tab=pending plus a free-text merchant search.
    pending: {
      label: 'Pending items',
      plural: 'pending items',
      dimensions: {
        merchant: { type: 'text', verb: 'from', field: 'tx_description' },
        module:   { type: 'select', verb: 'in', field: 'source_module',
          values: ['vehicle','medication','subscription','inventory','hsa_payment','certification'] },
        time:     { verb: 'imported', field: 'tx_date' },
      },
    },

    books: {
      label: 'Books',
      plural: 'books',
      dimensions: {
        title:   { type: 'text', verb: 'titled', field: 'title' },
        author:  { type: 'text', verb: 'by', field: 'author' },
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
        name:          { type: 'text', verb: 'named', field: 'name' },
        brand:         { type: 'text', verb: 'made by', field: 'brand' },
        concentration: { type: 'select', verb: 'in', field: 'concentration',
          values: ['EDT', 'EDP', 'Parfum', 'Cologne', 'Other'] },
        person:        { verb: 'belonging to', field: 'owner_family_member_id' },
        status:        { verb: 'that are', field: 'status',
          values: ['active', 'empty', 'given_away', 'lost'] },
        season:        { type: 'select', verb: 'for', field: 'season',
          values: ['Spring', 'Summer', 'Fall', 'Winter', 'All Year'] },
        tag:           { verb: 'tagged', field: 'tags' },
      },
    },

    insurance_policies: {
      label: 'Insurance',
      plural: 'policies',
      dimensions: {
        provider:      { type: 'text', verb: 'with', field: 'provider_name' },
        policy_number: { type: 'text', verb: 'numbered', field: 'policy_number' },
        policy_type:   { type: 'select', verb: 'of type', field: 'policy_type',
          values: ['Auto', 'Home', 'Life', 'Health', 'Umbrella', 'Dental', 'Vision', 'Other'] },
        status:        { verb: 'that are', field: 'status',
          values: ['active', 'expired', 'cancelled'] },
        time:          { verb: 'renewing', field: 'coverage_end_date' },
        tag:           { verb: 'tagged', field: 'tags' },
      },
    },

    documents: {
      label: 'Documents',
      plural: 'documents',
      dimensions: {
        title:    { type: 'text', verb: 'titled', field: 'title' },
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
        name:     { type: 'text', verb: 'named', field: 'name' },
        person:   { verb: 'belonging to', field: 'wardrobe_owner_id' },
        category: { type: 'api', verb: 'in', field: 'category',
          source: '/settings/dropdowns/wardrobe_category',
          labelField: 'label', valueField: 'value' },
        brand:    { type: 'text', verb: 'made by', field: 'brand' },
        color:    { type: 'text', verb: 'in color', field: 'color' },
        status:   { verb: 'that are', field: 'wardrobe_status',
          values: ['active', 'archived', 'donated', 'discarded'] },
        time:     { verb: 'last worn', field: 'last_worn',
          preset: 'past' },
        tag:      { verb: 'tagged', field: 'tags' },
      },
    },

    properties: {
      label: 'Properties',
      plural: 'properties',
      dimensions: {
        name:   { type: 'text', verb: 'named', field: 'name' },
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
        nickname:   { type: 'text', verb: 'called', field: 'nickname' },
        make_model: { type: 'text', verb: 'matching', field: 'make' },
        person:     { verb: 'owned by', field: 'family_member_id' },
        type:       { type: 'select', verb: 'of type', field: 'vehicle_type',
          values: ['Car', 'Truck', 'Motorcycle', 'RV', 'Boat', 'Other'] },
        time:       { verb: 'serviced', field: 'last_service_date',
          preset: 'past' },
        tag:        { verb: 'tagged', field: 'tags' },
      },
    },

    medical_medications: {
      label: 'Medications',
      plural: 'medications',
      personPrimary: true,
      dimensions: {
        name:    { type: 'text', verb: 'named', field: 'name' },
        person:  { verb: 'for', field: 'family_member_id' },
        status:  { verb: 'that are', field: 'status',
          values: ['Active', 'Discontinued', 'As Needed', 'Completed'] },
        form:    { type: 'select', verb: 'in form', field: 'form',
          values: ['Tablet', 'Capsule', 'Liquid', 'Injection', 'Topical', 'Other'] },
        // v202604.147 — refill state, controlled, generic flag
        refill:  { type: 'select', verb: 'with refill', field: 'refill_state',
          values: ['due', 'overdue', 'ok'] },
        controlled: { type: 'select', verb: 'controlled', field: 'controlled_schedule',
          values: ['CII', 'CIII', 'CIV', 'CV'] },
        generic: { type: 'select', verb: 'is', field: 'is_generic',
          values: ['generic', 'brand'] },
        // v202604.166 — mig 131 additions
        route:   { type: 'select', verb: 'route', field: 'route',
          values: ['oral','topical','IM','IV','subQ','inhaled','nasal','ophthalmic','other'] },
        mail_order: { type: 'select', verb: 'fulfillment', field: 'mail_order',
          values: ['mail order','pickup'] },
        ndc:     { type: 'text', verb: 'NDC', field: 'ndc' },
        source:  { type: 'text', verb: 'from system', field: 'source_system' },
        time:    { verb: 'started', field: 'start_date' },
        tag:     { verb: 'tagged', field: 'tags' },
      },
    },

    medical_conditions: {
      label: 'Conditions',
      plural: 'conditions',
      personPrimary: true,
      dimensions: {
        name:   { type: 'text', verb: 'named', field: 'name' },
        person: { verb: 'for', field: 'family_member_id' },
        status: { verb: 'that are', field: 'status',
          values: ['Active', 'Resolved', 'Monitoring', 'Chronic'] },
        // v202604.147 — body system, control state
        system: { type: 'select', verb: 'in system', field: 'body_system',
          values: ['Cardiovascular','Endocrine','Respiratory','Musculoskeletal',
                   'Neurological','Digestive','Renal','Mental health','Other'] },
        state:  { type: 'select', verb: 'state', field: 'condition_state',
          values: ['controlled','monitoring','out_of_range','acute'] },
        // v202604.166 — mig 131 additions
        icd10:    { type: 'text', verb: 'ICD-10', field: 'icd10_code' },
        severity: { type: 'select', verb: 'severity', field: 'severity',
          values: ['Mild', 'Moderate', 'Severe'] },
        source:   { type: 'text', verb: 'from system', field: 'source_system' },
        time:   { verb: 'diagnosed', field: 'start_date' },
        tag:    { verb: 'tagged', field: 'tags' },
      },
    },

    medical_notes: {
      label: 'Visit notes',
      plural: 'visits',
      personPrimary: true,
      dimensions: {
        person:   { verb: 'for', field: 'family_member_id' },
        provider: { type: 'text', verb: 'with', field: 'provider' },
        // v202604.147 — visit type, upcoming/past, location
        visit_type: { type: 'select', verb: 'type', field: 'visit_type',
          values: ['annual', 'follow-up', 'lab', 'specialist', 'urgent', 'other'] },
        when:     { type: 'select', verb: 'when', field: 'visit_when',
          values: ['upcoming', 'past', 'today'] },
        location: { type: 'text', verb: 'at', field: 'visit_location' },
        time:     { verb: 'on', field: 'visit_date' },
        tag:      { verb: 'tagged', field: 'tags' },
      },
    },

    // v202604.147 — EOB lens (new)
    medical_eob: {
      label: 'EOBs',
      plural: 'EOBs',
      personPrimary: true,
      dimensions: {
        person:   { verb: 'for', field: 'family_member_id' },
        provider: { type: 'text', verb: 'from', field: 'provider' },
        claim:    { type: 'text', verb: 'claim#', field: 'claim_id' },
        status:   { type: 'select', verb: 'status', field: 'eob_status',
          values: ['paid', 'owed', 'processing', 'review'] },
        // v202604.166 — mig 131 additions for non-display matching/appeal use
        claim_status: { type: 'select', verb: 'claim state', field: 'claim_status',
          values: ['paid', 'denied', 'pending', 'appealed', 'partial'] },
        place:    { type: 'select', verb: 'POS', field: 'place_of_service',
          values: ['11 (office)', '22 (hospital)', '81 (lab)', '23 (ER)', 'other'] },
        diagnosis: { type: 'text', verb: 'ICD-10', field: 'diagnosis_codes' },
        npi:      { type: 'text', verb: 'provider NPI', field: 'provider_npi' },
        amount:   { type: 'select', verb: 'amount', field: 'your_share',
          values: ['> $100', '> $500', '< $50'] },
        time:     { verb: 'dated', field: 'statement_date' },
      },
    },

    // v202604.166 — Lab results (new — mig 131)
    medical_labs: {
      label: 'Lab results',
      plural: 'labs',
      personPrimary: true,
      dimensions: {
        person:   { verb: 'for', field: 'family_member_id' },
        test:     { type: 'text', verb: 'test', field: 'test_name' },
        panel:    { type: 'text', verb: 'panel', field: 'panel_name' },
        flag:     { type: 'select', verb: 'flag', field: 'flag',
          values: ['normal', 'low', 'high', 'critical', 'abnormal'] },
        unit:     { type: 'text', verb: 'unit', field: 'unit' },
        source:   { type: 'text', verb: 'from system', field: 'source_system' },
        time:     { verb: 'on', field: 'test_date' },
        tag:      { verb: 'tagged', field: 'tags' },
      },
    },

    // v202604.166 — Diagnostics (new — mig 131)
    medical_diagnostics: {
      label: 'Diagnostics',
      plural: 'diagnostics',
      personPrimary: true,
      dimensions: {
        person:    { verb: 'for', field: 'family_member_id' },
        test:      { type: 'text', verb: 'test', field: 'test_name' },
        test_type: { type: 'select', verb: 'type', field: 'test_type',
          values: ['cardiac', 'imaging', 'endoscopy', 'pulmonary', 'other'] },
        status:    { type: 'select', verb: 'status', field: 'status',
          values: ['pending', 'preliminary', 'final', 'amended'] },
        facility:  { type: 'text', verb: 'at', field: 'facility' },
        source:    { type: 'text', verb: 'from system', field: 'source_system' },
        time:      { verb: 'on', field: 'test_date' },
      },
    },

    // v202604.166 — Allergies (new — mig 131)
    medical_allergies: {
      label: 'Allergies',
      plural: 'allergies',
      personPrimary: true,
      dimensions: {
        person:        { verb: 'for', field: 'family_member_id' },
        allergen:      { type: 'text', verb: 'to', field: 'allergen' },
        allergen_type: { type: 'select', verb: 'kind', field: 'allergen_type',
          values: ['drug', 'food', 'environmental', 'other'] },
        severity:      { type: 'select', verb: 'severity', field: 'severity',
          values: ['mild', 'moderate', 'severe', 'life-threatening'] },
        status:        { type: 'select', verb: 'state', field: 'status',
          values: ['Active', 'Resolved', 'Historical'] },
        time:          { verb: 'noted', field: 'noted_date' },
      },
    },

    // v202604.166 — Vitals readings (new — mig 131)
    medical_vitals: {
      label: 'Vitals',
      plural: 'readings',
      personPrimary: true,
      dimensions: {
        person:        { verb: 'for', field: 'family_member_id' },
        source:        { type: 'text', verb: 'from system', field: 'source_system' },
        // Per-measure shortcuts so reports/lens can find "BP high" etc.
        bp:            { type: 'select', verb: 'BP', field: 'bp_state',
          values: ['normal', 'elevated', 'stage 1', 'stage 2', 'crisis'] },
        weight_state:  { type: 'select', verb: 'weight', field: 'weight_state',
          values: ['under', 'normal', 'over', 'obese'] },
        time:          { verb: 'on', field: 'measure_date' },
      },
    },

    // v202604.167 — Cross-module record_links (auto-linker outputs).
    // Lens lets Al filter the "Needs review" surface by confidence,
    // source linker, or kind.
    record_links: {
      label: 'Record links',
      plural: 'links',
      dimensions: {
        confidence:   { type: 'select', verb: 'confidence', field: 'confidence',
          values: ['high', 'medium', 'low'] },
        needs_review: { type: 'select', verb: 'state', field: 'needs_review',
          values: ['needs review', 'confirmed'] },
        source:       { type: 'text',   verb: 'from linker', field: 'source' },
        kind:         { type: 'select', verb: 'kind',     field: 'link_kind',
          values: ['auto_hsa', 'auto_visit', 'auto_eob_hsa', 'auto_sub', 'manual', 'legacy_migrated'] },
        left_type:    { type: 'select', verb: 'left side', field: 'left_type',
          values: ['transaction', 'subscription', 'medical_visit', 'hsa_payment', 'eob', 'document'] },
        right_type:   { type: 'select', verb: 'right side', field: 'right_type',
          values: ['transaction', 'subscription', 'medical_visit', 'hsa_payment', 'eob', 'document'] },
        time:         { verb: 'created', field: 'created_at' },
      },
    },

    // v202604.148 — cross-card "All" lens. Spans medications + conditions
    // + visits + EOBs. Only common dimensions are exposed; per-domain
    // niceties (form, refill, claim#) live on their dedicated tabs.
    medical_all: {
      label: 'All medical',
      plural: 'records',
      personPrimary: true,
      dimensions: {
        person: { verb: 'for', field: 'family_member_id' },
        name:   { type: 'text', verb: 'matching', field: 'name' },
        time:   { verb: 'within', field: 'date' },
        tag:    { verb: 'tagged', field: 'tags' },
      },
    },

    todos: {
      label: 'Todos',
      plural: 'todos',
      personPrimary: true,
      dimensions: {
        title:    { type: 'text', verb: 'titled', field: 'title' },
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
      // NOT auto-apply device scope here. Person dim removed entirely.
      dimensions: {
        // v202604.134 — All Items / Rooms toggle moved into the lens.
        // Adding "grouped by room" pill flips to room-tile mode; clearing
        // the pill (or never adding it) = flat items mode (default).
        view:        { type: 'select', verb: '', field: '_inv_view',
          values: ['grouped by room'] },
        name:        { type: 'text', verb: 'named', field: 'name' },
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
        name:          { type: 'text', verb: 'named', field: 'name' },
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
        name:     { type: 'text', verb: 'named', field: 'activity_name' },
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
        title:     { type: 'text', verb: 'titled', field: 'title' },
        link_type: { type: 'select', verb: 'of type', field: 'link_type',
          values: ['website', 'login', 'document', 'contact', 'other'] },
        tag:       { verb: 'tagged', field: 'tags' },
      },
    },

    wardrobe_outfits: {
      label: 'Outfits',
      plural: 'outfits',
      dimensions: {
        name:     { type: 'text', verb: 'named', field: 'name' },
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
        retailer: { type: 'text', verb: 'from', field: 'retailer' },
        status:   { verb: 'that are', field: 'status',
          values: ['active', 'expired', 'redeemed'] },
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
  function timeMatch(dateStr, presetLabel, presetHint) {
    if (!presetLabel) return true;
    const presets = getTimePresets(presetHint);
    const p = presets.find(x => x.label === presetLabel);
    if (!p) return true;
    if (p.cmp === 'is-null') return !dateStr;
    if (!dateStr) return false;
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
    _raw: LENS_CONFIG,
  };
})();
