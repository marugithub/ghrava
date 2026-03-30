-- Migration 052: starter tag library
-- Cross-cutting attributes only — nothing that duplicates existing categories,
-- statuses, or dropdown values. Tags describe HOW or WHY, not WHAT.
-- Colors cycle through the 10-color palette defined in GH_TAGS.

INSERT OR IGNORE INTO tags (name, color_hex) VALUES

-- ── Inventory ─────────────────────────────────────────────────
('high-value',        '#ef4444'),  -- worth tracking for insurance
('fragile',           '#f59e0b'),
('seasonal-use',      '#06b6d4'),
('needs-repair',      '#ef4444'),
('loaned-out',        '#8b5cf6'),
('in-storage',        '#64748b'),
('set-item',          '#3b82f6'),  -- part of a matching set
('collectible',       '#ec4899'),
('battery-powered',   '#f97316'),
('wifi-connected',    '#06b6d4'),
('gift-received',     '#ec4899'),
('duplicate',         '#64748b'),

-- ── Finance / Documents ───────────────────────────────────────
('receipt-saved',     '#10b981'),
('reimbursable',      '#3b82f6'),
('tax-deductible',    '#10b981'),
('under-review',      '#f59e0b'),
('recurring-charge',  '#8b5cf6'),
('disputed',          '#ef4444'),
('paid-off',          '#10b981'),
('hsa-eligible',      '#10b981'),
('needs-filing',      '#f59e0b'),

-- ── Medical ───────────────────────────────────────────────────
('chronic',           '#ef4444'),
('hereditary',        '#8b5cf6'),
('pediatric',         '#ec4899'),
('follow-up-needed',  '#f59e0b'),
('pre-existing',      '#64748b'),
('rx-required',       '#3b82f6'),
('covered-by-insurance', '#10b981'),
('out-of-pocket',     '#f59e0b'),

-- ── Property ──────────────────────────────────────────────────
('urgent-repair',     '#ef4444'),
('cosmetic-only',     '#64748b'),
('diy-ok',            '#10b981'),
('needs-contractor',  '#f97316'),
('under-warranty',    '#3b82f6'),
('permit-required',   '#f59e0b'),

-- ── Todos / Daily Log ─────────────────────────────────────────
('waiting-on-someone','#f59e0b'),
('blocked',           '#ef4444'),
('quick-win',         '#10b981'),
('research-needed',   '#3b82f6'),
('delegate',          '#8b5cf6'),

-- ── Career ────────────────────────────────────────────────────
('federal',           '#3b82f6'),
('renewal-required',  '#f59e0b'),
('continuing-ed',     '#06b6d4'),
('remote-ok',         '#10b981'),
('leadership-role',   '#8b5cf6'),

-- ── Kids ──────────────────────────────────────────────────────
('competition',       '#f97316'),
('school-required',   '#3b82f6'),
('summer-program',    '#f59e0b'),
('team-activity',     '#10b981'),
('individual-activity','#8b5cf6'),

-- ── Books ─────────────────────────────────────────────────────
('recommended',       '#10b981'),
('re-read',           '#8b5cf6'),
('work-reading',      '#3b82f6'),
('audiobook-preferred','#06b6d4'),

-- ── Resources ─────────────────────────────────────────────────
('requires-login',    '#f59e0b'),
('federal-benefit',   '#3b82f6'),
('student-benefit',   '#ec4899'),
('bookmark-later',    '#64748b'),
('free-resource',     '#10b981');
