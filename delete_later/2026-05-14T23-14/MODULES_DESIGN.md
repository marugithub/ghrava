# Ghrava — Modules Design Document
**Status:** Design / Pre-build
**Last updated:** April 2026
**Covers:** Wardrobe, Perfume, Insurance, Subscriptions, Nav restructure, Security, Document alerts, Warranty expansion, Data quality

---

## Design principles (apply to every module)

- **Centralize, never duplicate.** People are family members. Places are contacts or properties. Items are inventory. New modules reference existing data, never re-enter it.
- **Minimal data entry.** Every field that can be a picker (contact, family member, property, inventory item) must be a picker. Free text only for fields with no existing reference.
- **Shell-first build.** Pages and navigation built with layout and lookups only. No save/delete/create functionality until design is confirmed.
- **Shared data model.** `family_member_id`, `contact_id`, `property_id`, `inventory_item_id` are foreign keys available across all modules.
- **Alerts are central.** Any expiry date in any module feeds the central alert/todo scheduler. No per-module reminder logic.
- **Step-up auth for sensitive actions.** Exports, reports with sensitive data, field unmasking, bulk deletes require password re-entry. Normal browsing never prompts.

---

## Navigation restructure

### Current state
16 modules across 6 flat sections. Adding Wardrobe, Perfume, Insurance, Subscriptions = 20 modules. Too crowded without grouping.

### Proposed groups (expandable sections in left nav)

| Section | Modules | Notes |
|---|---|---|
| **Focus** | Daily Log, To Do, Resources | Day-to-day capture and reference |
| **Finance** | Finance, Trading, Subscriptions | Money in, money out, recurring costs |
| **Home** | Inventory, Property, Documents, Wardrobe, Perfume | Physical possessions and household |
| **Family** | Medical, Kids, Insurance | People-centered health, care, protection |
| **Personal** | Career, Books | Self-development and professional |
| **Reports** | Reports | Cross-module reporting and exports |
| **Admin** | Alerts, Data, Settings | System management |

### Nav behavior
- Sections are expandable/collapsible — click section label to toggle
- Collapsed state persists to localStorage per section
- Active module's section auto-expands on page load
- Collapsed sidebar (icon-only mode) shows section icons, no labels
- Mobile: sections default collapsed except the active one

### New module pages needed
- `/wardrobe.html`
- `/perfume.html`
- `/insurance.html`
- `/subscriptions.html`

---

## Module 1 — Wardrobe

### Purpose
Digital wardrobe for all family members. Clothing, shoes, accessories, jewelry, hats, bags. Weather-based outfit suggestions. Weekly planner. Saved outfit pairs. Wear tracking. Donated/sold items with tax reporting.

### Data sources (existing modules)
- Items → Inventory (clothing category items)
- Family member → `family_members` table
- Weather → OpenWeatherMap API (already wired)
- Contacts → for dry cleaner, tailor etc.
- Documents → for receipts, warranty

### Key concepts

**Item identity**
- Items live in Inventory with `category = clothing/shoes/accessories/jewelry/hats/bags`
- Each item has: owner (family member), type, brand, color, size, season tags, occasion tags, purchase price, purchase date, condition, photos (multiple), status
- Identical items differentiated by sequence number per owner+type: "Navy Polo · Arnav #1", "Navy Polo · Arnav #2"
- Sequence number auto-assigned, user can override with a nickname

**Tags**
- Season tags: Spring, Summer, Fall, Winter, Rainy, All-season (multi-select, mixed allowed)
- Occasion tags: Casual, School, Sports, Formal, Work, Outdoor (multi-select)
- Items with no season tags are treated as all-season (permissive — never hidden from suggestions)
- Missing tags flagged in data quality report

**Outfit / Pairs**
- An outfit is a named collection of inventory items across any category (clothing + shoes + accessories + jewelry)
- Saved as reusable "Favorites" — not tied to a specific day until added to the planner
- Items in an outfit can be added, removed, swapped individually
- Outfit has: name, family member, occasion tags, season tags, notes
- Outfit pairs (Risha's concept) = same as outfit but focused on top+bottom+shoes combinations

**Weekly planner**
- 7-day horizontal scroll view
- Each day column shows: weather cell (aligned width), one or more outfit cards per day
- No limit on outfits per day — school, sports, classes, evening all separate
- Outfit cards show: item thumbnails (from inventory photos), tags, family member pill, Swap button
- Swap opens a filtered list: items matching weather tags, owned by same family member
- Filter removable — user can override and see all items
- Empty days show "Add outfit" button only
- Scroll arrows float on left/right edges of the scroll area

**Weather suggestions**
- Pull 7-day forecast from OpenWeatherMap on page load
- Tag matching: if forecast is cold/rainy → surface items tagged Winter/Rainy
- Permissive: untagged items always eligible
- Suggestions are proposals only — user confirms by adding to the day

**Wear tracking**
- Log when an outfit or individual item was worn (date, family member)
- Drives insights: times worn, last worn date, cost per wear
- No "not washed" cooldown logic — removed from scope

**Item status**
- Active (in wardrobe)
- Sold — capture: sale date, sale price, platform (eBay, Facebook Marketplace etc.)
- Donated — capture: donation date, organization (contact picker), fair market value, original purchase price
- Discarded — capture: date, reason

**Tax reporting for donations**
- Year-end report: all donated items for selected year
- Fields: item name, description, donation date, organization, original purchase price, fair market value
- Exportable as PDF and CSV
- Requires step-up auth on export
- Lives in Reports module as "Charitable donations — clothing"

### Insights (filter-aware — updates per selected family member)
- Total items in wardrobe
- Outfits saved
- Items not worn in 30+ days (candidates to donate)
- Total wardrobe value (sum of purchase prices)
- Most worn item (name, times worn, cost per wear)
- Never worn items (badge + list)

### UI layout (finalized — see mockup v2 in chat)
- Family member filter pills at top
- 7-day weather strip aligned with outfit columns
- Horizontal day scroll with floating arrows
- Day columns: weather cell + outfit cards + Add outfit button
- Insights section below
- Most worn / Never worn highlight cards

### Data model (new tables)

```sql
-- Wardrobe items are inventory items with category flags
-- New columns on existing items table:
ALTER TABLE items ADD COLUMN wardrobe_owner_id INTEGER REFERENCES family_members(id);
ALTER TABLE items ADD COLUMN wardrobe_sequence INTEGER;
ALTER TABLE items ADD COLUMN wardrobe_nickname TEXT;
ALTER TABLE items ADD COLUMN season_tags TEXT; -- JSON array
ALTER TABLE items ADD COLUMN occasion_tags TEXT; -- JSON array
ALTER TABLE items ADD COLUMN condition TEXT; -- New, Good, Fair, Poor
ALTER TABLE items ADD COLUMN status TEXT DEFAULT 'active'; -- active/sold/donated/discarded
ALTER TABLE items ADD COLUMN status_date TEXT;
ALTER TABLE items ADD COLUMN status_notes TEXT;
ALTER TABLE items ADD COLUMN sold_price REAL;
ALTER TABLE items ADD COLUMN sold_platform TEXT;
ALTER TABLE items ADD COLUMN donated_org_contact_id INTEGER REFERENCES contacts(id);
ALTER TABLE items ADD COLUMN donated_fmv REAL;
ALTER TABLE items ADD COLUMN discarded_reason TEXT;

-- Outfits / saved pairs
CREATE TABLE wardrobe_outfits (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  family_member_id INTEGER REFERENCES family_members(id),
  occasion_tags TEXT, -- JSON array
  season_tags TEXT,   -- JSON array
  notes TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE wardrobe_outfit_items (
  id INTEGER PRIMARY KEY,
  outfit_id INTEGER NOT NULL REFERENCES wardrobe_outfits(id),
  item_id INTEGER NOT NULL REFERENCES items(id),
  sort_order INTEGER DEFAULT 0
);

-- Weekly planner
CREATE TABLE wardrobe_planner (
  id INTEGER PRIMARY KEY,
  plan_date TEXT NOT NULL, -- YYYY-MM-DD
  outfit_id INTEGER REFERENCES wardrobe_outfits(id),
  family_member_id INTEGER REFERENCES family_members(id),
  occasion TEXT,
  notes TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Wear log
CREATE TABLE wardrobe_wear_log (
  id INTEGER PRIMARY KEY,
  item_id INTEGER NOT NULL REFERENCES items(id),
  outfit_id INTEGER REFERENCES wardrobe_outfits(id),
  worn_date TEXT NOT NULL,
  family_member_id INTEGER REFERENCES family_members(id),
  notes TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
```

### APIs
- OpenWeatherMap — 7-day forecast (already wired in app)
- No additional APIs needed for core functionality

---

## Module 2 — Perfume

### Purpose
Standalone fragrance inventory. Barcode/photo scan for lookup. Perfume-specific fields (notes pyramid, scent family, concentration). Saved layering sets. Outfit pairing. AI-optional suggestions.

### Data sources
- Owner → `family_members`
- Outfit pairing → `wardrobe_outfits`
- Photos → attachments system

### Key concepts

**Perfume-specific fields**
Standard inventory doesn't cover fragrance metadata. Perfume module adds:
- Name, brand, concentration (EDP/EDT/EDP/Parfum/Cologne)
- Top notes, middle/heart notes, base notes (comma-separated or tag-style)
- Scent family: Fresh, Citrus, Floral, Oriental, Woody, Gourmand, Aquatic, Spicy (multi-select)
- Season affinity: Spring, Summer, Fall, Winter, All-season
- Occasion: Casual, Work, Formal, Sport, Evening
- Gender classification: Masculine, Feminine, Unisex
- Size (ml), current amount (Full/75%/50%/25%/Nearly empty)
- Purchase price, purchase date, where purchased
- Owner (family member)
- Rating (1-5)
- Notes/review (personal)
- Status: Active, Empty, Given away, Lost

**Barcode/photo scan**
- Same pattern as books (ISBN scan) and inventory (barcode scan)
- Scan barcode → lookup fragrance database API → pre-fill fields
- Photo of bottle → AI image recognition → suggest match (optional, configurable)
- If no match found → manual entry with all fields

**Layering sets**
- Save combinations of 2-4 perfumes as a named set
- "Summer morning" = Perfume A (base) + Perfume B (light top)
- Set has: name, perfumes + application order, season/occasion tags, notes
- Same structure as wardrobe outfits — items in a collection

**Outfit pairing**
- A perfume or layering set can be associated with a wardrobe outfit
- On the wardrobe planner, suggested scent appears below the outfit card
- Suggestion logic: match season tags + occasion tags between perfume and outfit
- Override always available

**AI suggestion (optional, configurable)**
- Rule-based first: tag matching between perfume and outfit/weather
- AI layer (optional): configure Gemini Flash or GPT-4o mini API key in Settings
- When AI key is configured: AI receives outfit description + weather + available perfumes → returns ranked suggestions with reasoning
- When no AI key: rule-based tag matching only
- User preference stored in Settings: "Perfume suggestions: Rule-based / AI-assisted"

### Data model

```sql
CREATE TABLE perfumes (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  brand TEXT,
  concentration TEXT, -- EDP/EDT/Parfum/Cologne/EDC
  top_notes TEXT,
  middle_notes TEXT,
  base_notes TEXT,
  scent_family TEXT,   -- JSON array
  season_tags TEXT,    -- JSON array
  occasion_tags TEXT,  -- JSON array
  gender TEXT,         -- Masculine/Feminine/Unisex
  size_ml REAL,
  amount_level TEXT,   -- Full/75%/50%/25%/Low/Empty
  purchase_price REAL,
  purchase_date TEXT,
  purchased_from TEXT,
  owner_family_member_id INTEGER REFERENCES family_members(id),
  rating INTEGER,      -- 1-5
  notes TEXT,
  status TEXT DEFAULT 'active',
  barcode TEXT,
  google_id TEXT,      -- for barcode lookup cache
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE perfume_layers (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  owner_family_member_id INTEGER REFERENCES family_members(id),
  season_tags TEXT,
  occasion_tags TEXT,
  notes TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE perfume_layer_items (
  id INTEGER PRIMARY KEY,
  layer_id INTEGER NOT NULL REFERENCES perfume_layers(id),
  perfume_id INTEGER NOT NULL REFERENCES perfumes(id),
  application_order INTEGER DEFAULT 1, -- 1 = first applied
  amount_note TEXT -- "light spray", "2 sprays" etc.
);

CREATE TABLE perfume_outfit_pairs (
  id INTEGER PRIMARY KEY,
  outfit_id INTEGER REFERENCES wardrobe_outfits(id),
  perfume_id INTEGER REFERENCES perfumes(id),
  layer_id INTEGER REFERENCES perfume_layers(id),
  notes TEXT
  -- outfit_id pairs with either a single perfume OR a layer set, not both
);
```

### APIs
- Fragrance lookup API (TBD — research free fragrance databases)
- Gemini Flash or GPT-4o mini — optional, configured in Settings, key in `.env.secrets`

---

## Module 3 — Insurance

### Purpose
Track all insurance policies for the household. Historical policy chains. Renewal alerts. Links to related modules (vehicles, property, medical, contacts).

### Data sources
- Provider → `contacts` (insurance company, agent)
- Vehicle → `vehicles` table
- Property → `properties` table
- Family members → `family_members`
- Documents → attachments (declaration page, ID cards)

### Policy types
Auto, Home/Renters, Life, Health, Umbrella, Dental, Vision, Pet (future), Other

### Key concepts

**Policy chain**
Each physical policy (e.g. "State Farm Auto") has a chain of renewal records. When a policy renews, a new record is added to the chain — not a replacement. This preserves full history.

```
State Farm Auto Policy
  ├── 2022-01-01 to 2024-01-01 · $1,200/yr · $500 deductible
  ├── 2024-01-01 to 2026-01-01 · $1,350/yr · $500 deductible  ← active
  └── (renewal pending)
```

**Fields per policy record**
- Policy type
- Provider → contact picker
- Agent/POC → contact picker (separate from company)
- Policy number
- Coverage start date (exact)
- Coverage end date (exact)
- Premium amount + frequency (monthly/semi-annual/annual)
- Deductible
- Coverage limits (structured per type or free text)
- Coverage details / notes
- Linked vehicle (if auto)
- Linked property (if home/renters)
- Linked family members covered
- Status: Active, Expired, Cancelled
- Attachments (declaration page, ID cards, correspondence)

**Renewal alerts**
- Alert 60 days before end date (configurable per policy)
- Creates a Todo automatically
- Alert again 30 days before if not renewed

**Report: Insurance summary**
- All active policies with premium, coverage, expiry
- Policies expiring within 90 days
- Premium spend by year (total + by type)
- Coverage history per policy chain
- Requires step-up auth on export

### Data model

```sql
CREATE TABLE insurance_policies (
  id INTEGER PRIMARY KEY,
  policy_group_id INTEGER, -- links records in same chain (self-referencing group)
  policy_type TEXT NOT NULL, -- Auto/Home/Life/Health/Umbrella/Dental/Vision/Other
  provider_contact_id INTEGER REFERENCES contacts(id),
  agent_contact_id INTEGER REFERENCES contacts(id),
  policy_number TEXT,
  start_date TEXT NOT NULL,
  end_date TEXT,
  premium_amount REAL,
  premium_frequency TEXT, -- monthly/semi-annual/annual
  deductible REAL,
  coverage_limit REAL,
  coverage_details TEXT,
  vehicle_id INTEGER REFERENCES vehicles(id),
  property_id INTEGER REFERENCES properties(id),
  status TEXT DEFAULT 'active', -- active/expired/cancelled
  alert_days_before INTEGER DEFAULT 60,
  notes TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE insurance_policy_members (
  id INTEGER PRIMARY KEY,
  policy_id INTEGER NOT NULL REFERENCES insurance_policies(id),
  family_member_id INTEGER NOT NULL REFERENCES family_members(id)
);
```

---

## Module 4 — Subscriptions

### Purpose
Track recurring household costs. Monthly/annual view. Renewal alerts. Who uses it. Links to finance accounts for payment tracking.

### Data sources
- Payment method → `finance_accounts`
- Family members using it → `family_members`
- Provider → `contacts`

### Fields
- Service name
- Category: Streaming, Music, Software, Fitness, News, Utilities, Other
- Cost + billing cycle (monthly/annual/weekly)
- Next billing date
- Auto-renew flag
- Family members who use it
- Payment method → finance account picker
- Provider → contact picker
- Notes
- Status: Active, Cancelled, Paused

### Alerts
- Alert 7 days before renewal for annual subscriptions
- Creates Todo automatically

### Report: Subscription spending
- Monthly cost total
- Annual cost projection
- By category breakdown
- Cancelled subscriptions (cost saved)

### Data model

```sql
CREATE TABLE subscriptions (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT,
  cost REAL,
  billing_cycle TEXT, -- monthly/annual/weekly
  next_billing_date TEXT,
  auto_renew INTEGER DEFAULT 1,
  finance_account_id INTEGER REFERENCES finance_accounts(id),
  provider_contact_id INTEGER REFERENCES contacts(id),
  status TEXT DEFAULT 'active',
  notes TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE subscription_members (
  id INTEGER PRIMARY KEY,
  subscription_id INTEGER NOT NULL REFERENCES subscriptions(id),
  family_member_id INTEGER NOT NULL REFERENCES family_members(id)
);
```

---

## Cross-module feature — Document expiry alerts

### Purpose
Any module with an expiry date feeds the central alert scheduler. One system, not per-module logic.

### Sources across modules

| Module | Field | Alert lead time |
|---|---|---|
| Documents | expiry_date | Passport: 6 months, Driver's license: 60 days, Visa: 3 months |
| Career | expiry_date on certs | 60 days (already built) |
| Vehicles | registration_expiry | 30 days |
| Insurance | end_date | 60 days (configurable) |
| Subscriptions | next_billing_date | 7 days (annual only) |
| Medical | medication refill date | 14 days |
| Inventory | warranty_expiry | 30 days |

### Behavior
- Nightly scheduler checks all expiry dates across all modules
- Creates a Todo with: title "Renew [item]", due date = alert date, linked module + record ID, category "Renewal"
- Todo is not recreated if one already exists for the same record
- When item is renewed (expiry date updated), old todo is marked done automatically
- Document type determines default lead time — configurable per item in its module

### Document type → alert lead time defaults
Stored in `app_config` as configurable settings:
```
alert_passport_days = 180
alert_drivers_license_days = 60
alert_visa_days = 90
alert_vehicle_registration_days = 30
alert_insurance_days = 60
alert_warranty_days = 30
alert_subscription_annual_days = 7
```

---

## Cross-module feature — Warranty expansion

### Current state
Inventory has a boolean `warranty` flag. No expiry, no details.

### Expanded fields (additions to items table)
```sql
ALTER TABLE items ADD COLUMN warranty_expiry TEXT;
ALTER TABLE items ADD COLUMN warranty_provider_contact_id INTEGER REFERENCES contacts(id);
ALTER TABLE items ADD COLUMN warranty_details TEXT;
ALTER TABLE items ADD COLUMN warranty_registration_number TEXT;
```

### Warranty claim history
```sql
CREATE TABLE warranty_claims (
  id INTEGER PRIMARY KEY,
  item_id INTEGER NOT NULL REFERENCES items(id),
  claim_date TEXT NOT NULL,
  description TEXT,
  resolution TEXT,
  resolved_date TEXT,
  contact_id INTEGER REFERENCES contacts(id),
  notes TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
```

### Behavior
- Warranty expiry feeds the document expiry alert system (30 days default)
- Warranty details visible on inventory item record
- Claims log accessible from item record

---

## Cross-module feature — Security (step-up auth)

### Purpose
Sensitive actions require password re-entry without blocking normal app usage. No `requireAuth` on module routes.

### What triggers step-up
- Any data export (CSV, PDF, XLSX)
- Reports containing: SSN, medical data, financial account numbers, insurance policy numbers
- Viewing unmasked sensitive fields (SSN shows as XXX-XX-1234 by default)
- Bulk delete operations
- Backup/restore
- Password change
- Any Settings change

### How it works
1. User triggers sensitive action
2. Inline modal appears: "Enter your password to continue"
3. POST `/auth/step-up` with password → validates against stored hash → returns short-lived step-up token (10 minutes, memory only — not stored in DB)
4. Original action proceeds with step-up token in header
5. Sensitive routes check for valid step-up token
6. Token valid for 10 minutes — subsequent sensitive actions within window proceed without re-prompting
7. After 10 minutes, next sensitive action prompts again

### Session timeout
- Configured in Settings → Account → "Auto-lock after"
- Options: 15 min, 30 min, 1 hour, 4 hours, Never
- Default: Never (home network, single household)
- On timeout: cookie cleared, login page shown
- Implemented via last-activity timestamp checked on each page load in nav.js

---

## Cross-module feature — Data quality reports

### Purpose
Identify incomplete records across all modules. One report, cross-module visibility.

### Report sections
- Items missing season tags (Wardrobe/Inventory)
- Items missing photos (Inventory, Wardrobe, Perfume)
- Contacts missing phone or email
- Family members missing date of birth
- Insurance policies with no end date
- Vehicles with no registration expiry
- Documents with no expiry date (where applicable)
- Career certs with no cycle start (CE tracking incomplete)

### Behavior
- Read-only report, no editing from this view
- Each row links to the record in its native module
- Exportable (step-up auth required)
- Count badges on report nav item when data quality issues exist

---

## Shell build plan

### Pages to create (layout + nav only, no save/delete)
1. `/wardrobe.html` — family filter, weather strip, day scroll, outfit cards, insights
2. `/perfume.html` — grid of perfume cards, filter by owner/scent family/occasion
3. `/insurance.html` — policy list grouped by type, policy chain view
4. `/subscriptions.html` — list grouped by category, monthly/annual cost summary

### Existing lookups allowed in shell
- Family member picker (GH_FAMILY)
- Contact picker (GH_REFS)
- Inventory item lookup (read-only display)
- Weather API (read-only display)
- Finance accounts (read-only display for subscriptions payment method)

### Nav changes
- Update `nav.js` sections array with new groupings
- Add new module entries for wardrobe, perfume, insurance, subscriptions
- Add expand/collapse behavior per section

### No functionality in shell
- No form saves
- No deletes
- No API writes
- Static/mock data for layout validation
- Real lookups only where they demonstrate the UI pattern

---

## Open items / deferred

- **Encryption (SQLCipher):** Deferred. QNAP drive already encrypted at rest. Revisit when features stabilize.
- **AI perfume suggestions:** Deferred pending fragrance API research. Rule-based first.
- **Recipes/Meal planning:** Skipped — user has existing paid app (Mealie compatible).
- **Estate/Legal module:** No decision made — deferred.
- **Pets:** Not applicable.
- **Travel module:** Add as tab within Documents module when Documents is revisited.
- **Emergency contacts:** Filter within Contacts (type = Emergency), not a module.
- **Gift tracker:** Filter within Inventory (category = Gift) + notes on Contact records.
- **Google OAuth playground flow:** Pending user test. Refresh token paste method in Settings.
- **`.env.secrets` migration for Google credentials:** Deferred — document keys currently in app_config.
- **HSA items:** Deferred to next session.
- **Google sync (contacts/tasks):** Two-way sync built, pending OAuth test.
