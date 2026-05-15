# Medical Card — Final Design (v5)

**Status:** APPROVED — locked for implementation
**Last updated:** 2026-05-01
**Builds on:** CARD_SPEC.md (4-zone anatomy, design tokens)

---

## What this card is

The display unit for one medication record (`med_medications` row).
Shows the current state, the next action if any, the people/places linked,
and a thin row of cross-module derived numbers.

---

## Anatomy — Top to bottom

### Zone 1 — Status row
- **Status dot** (10px, soft halo) — clinical state (active / needs refill / discontinued)
- **Condition chips** — up to 2 visible, `+N` overflow if more (multi-condition support)
- **Drug class tag** — e.g. "Statin", small gray text, no click action (filtering deferred to backlog)
- Spacer
- **Pin button** (32×32)
- **Menu button** (32×32, opens Edit/Archive/Delete/Duplicate)

### Zone 2 — Identity
- **Hero (left, 132px):** procedural pill render (purple/pink capsule shape with imprint code letters/numbers). Standard render for every med — no FDA image lookup, no NDC dependency. Color tints by drug class or related condition.
- **Right column:**
  - Brand name (20px, weight 600) + dose (14px, weight 500) on the same line
  - **3 instruction icons** at the right of the title row — 36px chips, soft tint backgrounds (purple/amber/red). Examples: moon (evening), fork-knife (with food), warning (interaction). Icons are 20px inside the chip — not small.
  - Generic name + form below (e.g. "atorvastatin · oral tablet")
  - Schedule line below that ("Daily, with dinner")

### Cross-module strip (between Zone 2 and Zone 3)
Three numbers, dashed top border. Always visible regardless of action state.
- **HSA YTD** — sum of expenses linked to this med, current calendar year
- **Log mentions** — count of daily-log entries that mention this med
- **Last filled** — most recent refill date (short format: "May 2")

### Zone 3 — Action / alert (only when something needs doing)
Soft amber/red tinted panel with rounded corners, sits inside card padding.
- **Top row:** Bold message ("Refill in 3 days · 12 left") + supply meta in uppercase label style + **Order refill** primary button (teal, 36px tall)
- **Bottom row:** History meta ("Last refill 6d ago · CVS · $12.40") + **Rx#** in monospace (tap-to-copy)

When a med is in good standing, this zone collapses entirely. Card is shorter.

### Zone 4 — Linked entities + drill
Top border (1px divider). Splits left/right.
- **Left:** up to 3 entity circles at 36px
  - Patient (family member) — uses uploaded photo, falls back to initials gradient
  - Prescribing doctor — initials gradient (or uploaded photo if attached to contact)
  - Pharmacy — brand mark on brand-color square (e.g. red CVS box, blue Walgreens)
- **Right:** attachment count badge (paperclip icon + N, when N > 0) + Timeline link (text + chevron)

---

## Click contract — locked

| Element | Click behavior | Long-press / tooltip |
|---|---|---|
| Status dot | (no click) | "Active" / "Refill due" / "Discontinued" |
| Condition chip | Opens that condition record | Full condition name |
| `+N` overflow chip | Popover listing remaining conditions, each clickable | — |
| Drug class tag | (no click — backlog: filter list) | — |
| Pin button | Toggle pin | "Pin to top" |
| Menu (⋯) | Open action menu | — |
| Pill image (hero) | Open med detail drawer | "Lipitor 10mg, oval" |
| Title (Lipitor) | Open med detail drawer | — |
| Instruction icons | (no click — info only) | "Take in evening" / "Take with food" / "Avoid grapefruit" |
| HSA YTD number | Open HSA filtered to this med | "$47.50 spent on this med YTD" |
| Log mentions number | Open Daily Log filtered to this med | — |
| Last filled date | Open refill history | — |
| Order refill button | Open refill flow | — |
| Rx# | Tap to copy + toast | "Tap to copy" |
| Family member avatar | (backlog: "everything about this person" report) | name |
| Doctor avatar | Open contact detail | name |
| Pharmacy mark | Open contact detail | name |
| Attachment count | Open attachment drawer | "3 attachments" |
| Timeline link | Open treatment-line view | — |
| Empty card area | (no-op — let users click chips/links) | — |

---

## Visual locks (don't change without redesign discussion)

- Refill button: teal (`--gh-brand`, #14b8a6)
- Cross-module strip: dashed top border, 3 numbers max, sits between Zone 2 and Zone 3
- Instruction icons: 36px chip, 20px icon inside, soft tint background
- Linked entity circles: 36px, real photos when available, brand mark fallback for pharmacies
- Status dot: soft halo (16% opacity ring)
- Condition chips: max 2 + `+N` overflow
- Cross-module strip stays visible even when Zone 3 is hidden

---

## Field requirements (audit deferred)

The card promises to display the following. A separate field audit will
identify which already exist on `med_medications` and which need to be
added before the card can render real data:

- name, dose, generic_name, form, schedule_text
- status (active/needs_refill/discontinued)
- drug_class
- conditions (many-to-many — multi-condition support)
- timing (am/pm/with_food/etc)
- has_warning, warning_text
- supply_remaining, days_supply, refills_remaining
- refill_due_date, last_refill_at, last_cost, pharmacy_contact_id, rx_number
- prescriber_contact_id, patient_id
- copay (last)
- hsa_ytd (computed from hsa_expenses)
- log_mention_count (computed from daily_log_entries)
- attachment_count (already wired across modules)

These fields also serve future Reports module (same data, different view).

---

## Rendering states

- **Healthy med, no action needed:** Zone 1 + Zone 2 + cross-module strip + Zone 4. No Zone 3.
- **Refill due in ≤14 days:** all four zones + strip.
- **Discontinued:** card opacity 0.55, gray status dot, no Zone 3.
- **No NDC / no fields populated:** procedural pill renders generic purple/pink capsule with placeholder imprint, card still renders as much as available.

---

## Change log
- **v5 — 2026-05-01** — Final lock. Adds cross-module strip (HSA YTD, log mentions, last filled), multi-condition chips with +N overflow, attachment badge in Zone 4, click contract locked.
- **v4 — 2026-04-30** — Multi-condition support, teal refill button, photo-first avatars, click behaviors approved.
- **v1–v3** — Iterations on layout, hero, instruction icons (history in CARD_SPEC.md).


---

# Inventory Card — Final Design (v1)

**Status:** APPROVED — locked for implementation
**Approved:** 2026-05-01

## Anatomy

### Zone 1 — Status row
- Status dot (good = working, warn = warranty/repair-due, bad = broken)
- Condition chip ("Working" green, "Needs repair" amber, "Broken" red)
- Category tag (gray text, no click — backlog: filter)
- Pin + ⋯ menu

### Zone 2 — Identity
- Hero (132px, square): real product photo OR category-icon fallback on gradient
- Right column:
  - Brand (20px, weight 600) + Model name on same row
  - Instruction icon: warranty clock (amber tint = expiring, green tint = active under warranty)
  - Sub-line: type/specs (e.g. "Power tool · 10 amp · Corded")
  - Location breadcrumb with map-pin icon: "Garage › Workbench › Drawer 3"

### Cross-module strip
Three numbers, dashed top border:
- **Paid** — original purchase price
- **Bought** — purchase date (short format: "Mar 2022")
- **Warranty** — time remaining or "Expired"

### Zone 3 — Action / alert (only when needed)
- Warranty expiring → "Renew warranty" (teal button)
- Needs repair → "Schedule repair"
- Receipt missing → "Upload receipt"
- Otherwise hidden
- Bottom row: original-purchase meta + SN# (monospace, tap-to-copy)

### Zone 4 — Linked entities + drill
- Owner avatar + vendor brand-mark (Home Depot orange box, Best Buy blue, etc.)
- Attachment count + "History →" drill

## Click contract
- Status dot: tooltip only
- Condition chip: backlog (filter)
- Category tag: no click — backlog
- Photo hero / Brand / Model: open item detail drawer
- Instruction icon (warranty): tooltip only
- Location chain: each segment clickable → filters list to that location
- Cross-module Paid: open HSA / receipt
- Cross-module Bought: tooltip with full date
- Cross-module Warranty: open warranty detail
- SN#: tap-to-copy
- Owner: backlog (full report)
- Vendor brand: open contact detail
- Attachment count: open attachment drawer
- History: open item history view

## Visual locks
Same as medical: teal button, dashed cross-module strip, 36px linked entities, soft halo on status dot, condition chips with `+N` overflow if more than 2.

## Field requirements (audit deferred)
brand, model, category, condition, location_path (hierarchical), photo_attachment_id,
purchase_price, purchase_date, warranty_end_date, serial_number, vendor_contact_id,
owner_family_member_id, attachment_count

## Change log
- **v1 — 2026-05-01** — Initial lock. Photo hero, location breadcrumb, warranty instruction icon, cross-module strip (Paid · Bought · Warranty).


---

# Certification Card — Final Design (v1)

**Status:** APPROVED — locked for implementation
**Approved:** 2026-05-01

## Anatomy

### Zone 1 — Status row
- Status dot (good = current, warn = renewal due ≤6mo, bad = expired)
- Domain chip (e.g. "IT Security" purple, "Project Management" blue) + employer-required chip (green check) — up to 2 + `+N`
- Tag (e.g. "Foundational", "Specialty") — no click, backlog
- Pin + ⋯ menu

### Zone 2 — Identity
- Hero (132px, square): issuer's branded color block with brand wordmark + cert mark (e.g. "CompTIA / SY+ / CERTIFIED" on red, "PMI / PMP / CERTIFIED" on blue). Falls back to award icon on gradient when no brand color exists.
- Right column:
  - Cert short name (20px, weight 600) + full name suffix (14px, weight 500) on same row
  - Instruction icon: clock (amber tint = renewal due, hidden when plenty of runway)
  - Sub-line: issuing body + cert family
  - Held-since/expires line: "Held since Aug 2023 · Expires Aug 12, 2026"
  - **CEU/PDU progress bar** — 6px height bar, green fill, label + count on either side ("CEU 38/50"). Unit (CEU/PDU/hours) is config-driven.

### Cross-module strip
- **Renewal fee** — what it'll cost to renew
- **CEU/PDU left** — units still needed before renewal cycle ends
- **Open todos** — count of CEU activity / renewal-related todos

### Zone 3 — Action / alert (only when needed)
- Renewal due ≤6mo → "Plan renewal" (teal)
- Renewal due ≤30d → same button, red urgency tint
- Lapsed → "Reinstate" (teal)
- CEU shortfall flagged → also surfaces here
- Otherwise hidden
- Bottom row: last activity meta (e.g. "Last activity 18d ago · Free Coursera CEU · 4 CEU") + Cert# (monospace, tap-to-copy)

### Zone 4 — Linked entities + drill
- Holder avatar + issuer brand-mark (CompTIA red square, PMI blue, AWS orange, etc.)
- Attachment count + "History →" drill (opens treatment-line of CEU activities, renewals, score history)

## Click contract
- Status dot: tooltip
- Domain chip: opens cert list filtered to that domain (or backlog filter)
- Employer-required chip: tooltip
- Tag: no click — backlog
- Hero / cert name: open cert detail drawer
- Renewal-clock icon: tooltip ("Renewal in N months")
- Held-since line: tooltip with full dates
- Progress bar: opens CEU log for this cert
- Cross-module Renewal fee: opens HSA / expenses linked
- Cross-module CEU left: opens CEU activity log
- Cross-module Open todos: opens Todos filtered to this cert
- Plan renewal button: opens renewal planning drawer
- Cert#: tap-to-copy
- Holder avatar: backlog (full report)
- Issuer brand: opens contact / issuer detail
- Attachment count: opens attachment drawer
- History link: opens treatment-line view

## Visual locks
Same vocabulary as medical/inventory: teal button, dashed cross-module strip, 36px linked entities, soft halo, +N overflow on chips. **Plus** progress bar pattern (6px green, label/count flanking).

## Field requirements (audit deferred)
short_name, full_name, issuer_contact_id, issuer_brand_color, issuer_brand_initials,
domain_tags[], cert_family_tag, employer_required (bool),
held_since, expires_at, cycle_years, cert_number,
renewal_fee, ceu_unit_label, ceu_required, ceu_completed (computed),
holder_family_member_id, attachment_count, open_todos_count (computed)

## Change log
- **v1 — 2026-05-01** — Initial lock. Branded color block hero, progress bar pattern, renewal cycle alert.


---

# Vehicle Card — Final Design (v1)

**Status:** APPROVED — locked for implementation
**Approved:** 2026-05-01

## Anatomy

### Zone 1 — Status row
- Status dot (good = current, warn = something due, bad = overdue/inoperable)
- Driver-type chip ("Daily driver", "Weekend driver", "Stored")
- Insurance chip (green check if insured, red X if lapsed)
- Tag (e.g. "Sedan", "SUV", "Truck") — no click, backlog
- Pin + ⋯ menu

### Zone 2 — Identity
- Hero (132px, square): vehicle photo OR vehicle-category icon on gradient fallback
- Right column:
  - Make (20px, weight 600) + model · year suffix on same row
  - Instruction icon: hazard triangle (multiple alerts) OR insurance shield (current)
  - Sub-line: type · drivetrain · color
  - Where it lives line: garage/driveway/storage location with map-pin icon
  - **Odometer progress bar** — same 6px pattern as cert CEU bar. Tracks miles toward next service threshold. Color shifts good → warn → bad as it approaches limit.

### Cross-module strip
- **YTD fuel** — sum of fuel txs linked to this vehicle, current year (red `*` when txs exist but unassigned)
- **Service YTD** — sum of service/repair txs linked to this vehicle, current year
- **Odometer** — current reading

### Zone 3 — Action / alert (only when needed)
- Primary alert (most urgent): bold message + supply meta + teal action button
- **Stacked secondary alerts** below dashed separator (registration, insurance renewal, inspection, multiple things due simultaneously)
- Each secondary row: icon + message + countdown label
- Bottom row: last service meta + plate # (monospace, tap-to-copy)

### Zone 4 — Linked entities + drill
- Driver avatar + insurer brand-mark + preferred shop brand-mark
- Attachment count + "Service log →" drill (opens treatment-line of all events)

## Click contract
- Status dot: tooltip
- Driver-type chip: filter list
- Insurance chip: open insurance card
- Tag: no click — backlog
- Photo / make / model: open vehicle detail drawer
- Instruction icon: tooltip (active alert summary)
- Where-it-lives line: backlog (filter by location)
- Odometer bar: opens service log
- Cross-module YTD fuel: opens linked transactions list
- Cross-module Service YTD: opens service log
- Cross-module Odometer: opens odometer history (drill into update events)
- Primary action button: opens schedule-service / renew-registration flow per alert
- Secondary alert rows: each tappable, opens that specific alert's flow
- Plate #: tap-to-copy
- Driver: backlog (full report)
- Insurer / shop: open contact detail
- Attachment count: open attachment drawer
- Service log: open treatment-line view

## Visual locks
Same vocabulary as medical/inventory/cert: teal button, dashed cross-module strip, 36px linked entities, soft halo, +N overflow on chips, progress bar pattern. **New for vehicle:** stacked secondary alerts inside Zone 3 (separated by dashed lines, smaller type, own countdowns).

## Field requirements (audit deferred)
make, model, year, type, drivetrain, color, photo_attachment_id,
plate_number, vin, owner_family_member_id,
insurance_contact_id, insurance_renewal_date, insurance_status,
preferred_shop_contact_id,
location_path,
odometer_current, odometer_last_service, service_interval_miles,
registration_expires_at, inspection_due_at,
attachment_count, ytd_fuel (computed via tx_record_links), service_ytd (computed)

## Change log
- **v1 — 2026-05-01** — Initial lock. Vehicle photo hero, odometer progress bar, multi-alert Zone 3 with primary + stacked secondary alerts.

---

## Cross-cutting reference

This card relies on `TRANSACTION_LINKING_SPEC.md` for:
- YTD fuel accuracy (per-vehicle linking from imported transactions)
- Asterisk pattern for incomplete/unassigned data
- Pending Items Report for unlinked fuel transactions


---

# Card Coverage Plan & Backlog

**Last updated:** 2026-05-01

## Modules getting cards (in priority order)

### Done (v1 locked)
1. Medical — Medications
2. Inventory
3. Career — Certifications
4. Vehicles
5. Subscriptions

### To prototype next (this rollout)
6. Todos (compact mode — blocks everything compact-shaped)
7. Maintenance (upcoming/overdue recurring task pattern)
8. Finance accounts (banking — combines balance, recent activity, linked subs)
9. HSA (contribution room + spent + receipts pending — heavy asterisk usage)
10. Books (reading dashboard, not a shelf row — make it interesting)
11. Trade positions (P/L + alerts)

### Photo-hero text-deltas (no new prototype, follows Inventory template)
12. Wardrobe — see backlog for outfit-of-the-day idea
13. Perfume — see backlog
14. Property
15. Documents
16. Insurance policies

### Compact-mode text-deltas (follows Todos template)
17. Daily log entries
18. Calendar events

### Other groups
19. Career — Jobs (logo-hero text-delta from Cert)
20. Medical — Conditions (body-icon hero)
21. Medical — Visit notes (doctor-avatar hero)

## Modules deferred to backlog (need design conversation before card)

### Kids — needs data model expansion
Current: thin record. Needed: school, activities, growth, vaccinations,
upcoming milestones, sibling relationships. Card design depends on what's
captured. **Block on:** kids data model design.

### Family members — needs "all about this person" report first
Linked-entity click on every other card lands here. Card needs to be a
mini-dashboard, not a profile row. **Block on:** family report spec.

### Wardrobe + Perfume — outfit-of-the-day card idea
Per-family-member card that pulls:
- Current weather + season for their location
- Calendar / upcoming occasions
- Their wardrobe items (with last-worn dates → rotates underused pieces)
- Their perfume collection (matched to season + occasion)
→ Suggests an outfit + scent pairing. Refresh button generates a new combo.
"Save look" button creates a record of the outfit + ties scent + occasion.

This makes wardrobe and perfume into something the user *uses* daily,
not just a closet inventory. Cards become recommenders, not catalogs.

**Block on:** outfit-recommendation logic, weather integration confirmation.

### Resources — no card. Reference list only.

## Modules with no card (intentional)
- Reports — dashboards, not records
- Settings — config screens
- Watcher inbox — review queue (list, not cards)
- Snapshot / Data / Templates / Help / Login / Index — system pages

## Books — design direction (for when we prototype it)

Boring version (avoid): title, author, status, rating.

Interesting version (build): card is a reading dashboard for that book.
- Hero: cover image
- Status row: reading-state chip ("In progress · ch 8 of 24"), genre tag
- Identity: title + author + a *progress bar* showing % read
- Cross-module strip: pages today · streak · pace toward yearly goal
- Action zone: when behind pace → "+15 pages today catches up", when finished → "Add to recommendations for [family member]"
- Linked entities: who else in the family read this, the library it came from, the recommender (where you heard about it)

Same vocabulary as other cards — but the card answers "should I read tonight?"
not "here's a book." That's the bar to hit for every "boring catalog" module.


---

# Todo Card (Compact Mode) — Final Design (v1)

**Status:** APPROVED — locked for implementation
**Approved:** 2026-05-01

Compact-mode card. Single row, ~52px tall. All four zones collapsed.

## Anatomy (left to right)

1. **Tap-circle** (28×28) — primary action: mark complete. Click toggles done.
2. **Body** (flex 1):
   - Title — single line, ellipsis if too long
   - Meta line — due-status (colored when urgent/overdue/high) · divider · secondary detail · divider · category
3. **Source chip** — pill, colored by source module (blue=Daily Log/Vehicle, pink=Medical, amber=Property/Maintenance, purple=Documents, gray-dashed=Manual). Click opens the source record in that module.
4. **Linked entity** (28×28) — assigned family member avatar.
5. **Menu** (⋯)

## Urgency vocabulary
- Overdue → red 3px left border, red bold meta text
- Urgent → red 3px left border, red meta text
- High → amber 3px left border, amber meta text
- Normal → 1px gray border (default card border)
- Done → opacity 0.55, strikethrough title, green-filled tap-circle

## Group headers
Sections in the list use a small dot + label + count:
- 🔴 Overdue · 2
- 🟠 Urgent · 1
- 🟠 This week · 3
- ⚪ Done today · 1

## Click contract
- Tap-circle → toggle done
- Title / body → open todo detail drawer
- Source chip → opens source record in source module
- Linked entity → backlog (full report)
- Menu → action menu
- Whole card click (outside controls) → opens detail

## Reuse for daily log + calendar
Daily log entries: same row shape, "ate dinner with Sarah · 7:30 PM · Restaurant" replaces title/meta. No tap-circle (entries don't get marked done). Source chip becomes Tag chip.
Calendar events: same shape, event start time replaces due-date, location replaces source chip when present.

## Field requirements
title, status (active/done/dismissed), priority (urgent/high/medium/low),
due_date, due_status (computed: overdue/today/this-week/later/none),
category, source_module (medical/vehicle/log/document/manual),
source_record_id (for chip click navigation),
assigned_family_member_id, attachment_count

## Change log
- **v1 — 2026-05-01** — Initial lock. Compact single-row layout, urgency-as-left-border, source-chip interconnectivity.


---

# Maintenance Card — Final Design (v1)

**Status:** APPROVED
**Approved:** 2026-05-01

Recurring household task card. Same 4-zone bones as Subscriptions but the
"recurring cycle" is action-required rather than passive billing.

## Anatomy
- Zone 1: status (good=on schedule, warn=coming due, bad=overdue) + frequency chip ("Every 90d", "Annual") + system chip ("HVAC", "Plumbing") + Pin/⋯
- Zone 2: hero = task icon (filter, lawn, paint, gutter — Phosphor) on tinted gradient. Title (e.g. "HVAC Filter Replacement") + system + last-done line + **due-progress bar** (similar to vehicle odometer pattern, but time-based: days since last vs cycle length).
- Cross-module: Last cost · Avg cost (all-time) · Avg interval (actual vs scheduled, drifts get flagged)
- Zone 3: when overdue/coming-due → "Mark done" or "Schedule vendor" teal button + supply meta. Hidden otherwise.
- Zone 4: assignee avatar + linked vendor brand + attachment count + "History →" drill (opens treatment-line of past completions)

## Reuse
Inherits progress bar from cert/vehicle. Inherits action zone from medical refill.
Vendor avatar pattern from inventory. Attachment + drill from all.

## Field requirements
name, system, frequency_days, last_done_at, next_due_at,
last_cost, vendor_contact_id, assignee_family_member_id, attachment_count,
notes, instructions_attachment_id (manual / how-to)

---

# Finance Account Card — Final Design (v1)

## Anatomy
- Zone 1: status (good=current, warn=low balance, bad=overdraft/past-due) + account-type chip ("Checking", "Credit Card") + ownership chip ("Joint", "Al only") + Pin/⋯
- Zone 2: hero = bank brand block (Chase blue, Schwab purple, Navy Fed yellow, etc.). Right column: nickname + "···{last4}" + last-import-date instruction icon + **balance line** prominent (large) + comparison to last month
- Cross-module: YTD activity (count) · last month delta (+$1,240 or -$420) · linked subs/recurring count
- Zone 3: when balance is concerning → "Transfer in" teal button. When statement gap detected → "Import statement" button.
- Zone 4: owner avatar + bank brand mark + linked credit-card/checking pair (if joint with another account) + attachment count + "Activity →" drill
- **Asterisk** on YTD activity if statement gap detected (data incomplete)

## Reuse
Logo-hero from Subscription. Asterisk from linking spec. Action zone teal pattern.

---

# HSA Card — Final Design (v1)

## Anatomy
- Zone 1: status + tax-year chip ("2026") + plan-type chip ("Self-only $4,150" or "Family $8,300") + Pin/⋯
- Zone 2: hero = HSA provider brand block (Fidelity, HealthEquity, Lively). Title + plan + **contribution progress bar** (contributed/limit) + remaining capacity line ("$2,840 room left, $526/mo to max by Dec")
- Cross-module: Spent YTD · Receipts pending · Eligible matches (auto-detected medical txs that may be HSA-reimbursable)
- Zone 3: when receipts pending → "Review N receipts" teal button. When close to deadline (April for prior year) → "Add contribution" with countdown.
- Zone 4: owner avatar + provider brand + linked-meds drill ("3 prescriptions linked") + attachment count + "Activity →" drill
- **Heavy asterisk usage** — partial cost data on linked meds shows up here

## Reuse
Progress bar from cert/maintenance. Contribution capacity = inverse of CEU progress.
Asterisk pattern central to this card.

---

# Trade Position Card — Final Design (v1)

## Anatomy
- Zone 1: status (good=in green, neutral=flat, bad=in red) + position-type chip ("Long", "Short", "Watching") + sector tag + Pin/⋯
- Zone 2: hero = ticker symbol on dark/branded block (e.g. AAPL on Apple-style gradient, generic dark for others). Right: company name + current price + **today's % change** with arrow + tiny sparkline (7d) below
- Cross-module: Cost basis · Current value · Realized YTD
- Zone 3: when alert hit (price target, stop loss, earnings tomorrow) → notification + "Review position" button. Hidden otherwise.
- Zone 4: account avatar + (optional) related news source icon + attachment count + "Trades →" drill (full trade history)

## Reuse
Logo-hero pattern from Subscription. Sparkline is new — small SVG, 7-day price.
Two-line meta supports the price + delta pairing.

---

# Book Card — Final Design (v1)

Reading-dashboard card, not a shelf row.

## Anatomy
- Zone 1: status ("Currently reading" green, "Finished" neutral, "Want to read" amber, "Abandoned" gray) + genre chip + format chip ("Hardcover", "Audio", "ebook") + Pin/⋯
- Zone 2: hero = book cover (real image when uploaded, fallback gradient with title initials). Right: title + author + **reading progress bar** (% read, page X of Y) + pace line ("On pace for Jun 14 finish · +15 pages today catches up")
- Cross-module: Pages today · Streak (days reading) · Pace (vs target finish date)
- Zone 3: when behind pace → "Read 15 pages now" gentle teal button. When finished → "Add to recommendations for Sarah" suggestion.
- Zone 4: reader avatar + library/source brand + family members who also read this (mini-stack of avatars) + "History →" drill (reading sessions, highlights)

## Reuse
Progress bar from cert/maintenance. Inventory photo-hero. Source chip from todo.
What's interesting: the family-stack in Zone 4 (multiple small avatars) — extension of single-avatar pattern.

---

## Photo-hero text-deltas

### Wardrobe
Inventory-card template. Hero = garment photo. Cross-module: Times worn · Cost per wear · Last worn. Zone 3: "Donate?" button when last-worn > 90 days. Outfit-of-the-day card is a SEPARATE design (deferred to backlog).

### Perfume
Inventory-card template. Hero = bottle photo. Cross-module: Wears YTD · Season fit · Last worn. Zone 3: empty bottle alert.

### Property
Inventory-card template. Hero = house photo. Cross-module: YTD maintenance · Mortgage paid · Open projects. Zone 3: tax due, inspection due. Linked: owner, insurer, contractors. Drill: maintenance log.

### Documents
Photo-hero template, hero = first-page thumbnail (PDF render or image). Cross-module: File size · Last viewed · Linked-to count. Zone 3: expiry alert (passport, license).

### Insurance policy
Logo-hero (carrier brand). Cross-module: Annual premium · YTD claims · Deductible used. Zone 3: renewal due.

### Career — Job
Logo-hero (company). Cross-module: Tenure · Linked CE · Open todos. Zone 3: review due.

### Medical — Condition
Body-icon hero (heart, lungs, brain). Cross-module: Active meds count · Open todos · Related visits. Zone 3: lab due, checkup overdue.

### Medical — Visit note
Doctor-avatar hero. Cross-module: Visit cost · HSA paid · Attachments. Zone 3: follow-up needed.

## Compact-mode text-deltas

### Daily log entry
Todo template. No tap-circle (entries can't be "completed"). Title = entry text first line. Meta = time · tag · linked module. Source chip becomes the tag. Linked entity = entry author (default to user).

### Calendar event
Todo template. Tap-circle becomes "RSVP/checked-in" affordance for events that need it. Title = event name. Meta = time · location · attendee count. Source chip = source calendar (Google, manual, etc.).
