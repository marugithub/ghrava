/**
 * gh-card-configs-batch1.js — Card configs for new modules in v202604.113.
 *
 * Each config is a declarative description of how its module's records
 * become cards. The shared GH_CARD renderer reads these configs and does
 * all the actual rendering work. Module pages just need to:
 *   <script src="/js/gh-card.js"></script>
 *   <script src="/js/gh-card-shared.js"></script>
 *   <script src="/js/gh-card-configs-batch1.js"></script>
 *   ... then call GH_CARD.renderGrouped('module_id', records, opts).
 *
 * Field-presence safe: every config tolerates missing fields and returns
 * a sensible empty/default rather than throwing. When a field doesn't
 * exist yet on the underlying record, the row simply doesn't appear.
 *
 * Spec: CARDS_FINAL.md
 */
(function() {
  'use strict';
  if (!window.GH_CARD) {
    console.warn('[GH_CARD configs] GH_CARD not loaded — skipping batch1 configs');
    return;
  }
  const S = window.GH_CARD_SHARED || {};
  const safe = (fn, fallback) => { try { return fn(); } catch { return fallback; } };

  // ════════════════════════════════════════════════════════════════
  // VEHICLES
  // ════════════════════════════════════════════════════════════════
  GH_CARD.register('vehicles', {
    mode: 'full',

    statusDot: (r) => {
      if (!r) return 'neutral';
      if (r.registration_expires_at) {
        const d = S.daysFromToday(r.registration_expires_at);
        if (d != null && d < 0) return 'bad';
        if (d != null && d <= 30) return 'warn';
      }
      if (r.next_service_miles && r.odometer_current && r.last_service_odometer) {
        const interval = r.next_service_miles - r.last_service_odometer;
        const used = r.odometer_current - r.last_service_odometer;
        if (interval > 0 && used / interval >= 0.95) return 'warn';
      }
      return 'good';
    },

    statusRowChips: (r) => {
      const chips = [];
      if (r.usage_type) {
        chips.push({ label: r.usage_type, icon: 'check', tint: 'blue' });
      }
      if (r.is_insured !== false) {
        chips.push({ label: 'Insured', icon: 'shield-check', tint: 'green' });
      }
      return chips;
    },

    categoryTag: (r) => r.body_type || r.type || '',

    hero: (r) => {
      const div = document.createElement('div');
      div.style.cssText = 'width:100%;height:100%;display:flex;align-items:center;justify-content:center;background:linear-gradient(135deg,#1e293b,#475569);color:#fff;border-radius:12px;';
      if (r.photo_attachment_id) {
        div.style.background = `url(/api/v1/attachments/${r.photo_attachment_id}/thumb) center/cover`;
      } else {
        // Generic car silhouette SVG
        div.innerHTML = `<svg width="80%" height="80%" viewBox="0 0 200 90" fill="currentColor" style="opacity:.92"><path d="M30 60 L40 30 Q45 22 55 22 L145 22 Q155 22 162 30 L175 60 L180 60 Q190 60 190 70 L190 75 L165 75 Q165 65 155 65 Q145 65 145 75 L65 75 Q65 65 55 65 Q45 65 45 75 L20 75 L20 70 Q20 60 30 60 Z"/><circle cx="55" cy="75" r="9" fill="#1e293b" stroke="white" stroke-width="2"/><circle cx="155" cy="75" r="9" fill="#1e293b" stroke="white" stroke-width="2"/></svg>`;
      }
      return div;
    },

    title: (r) => r.make || r.name || 'Vehicle',
    subtitle: (r) => [r.model, r.year && ('· ' + r.year)].filter(Boolean).join(' '),

    metaLine: (r) => [r.body_type, r.fuel_type, r.color].filter(Boolean).join(' · '),

    scheduleLine: (r) => r.location ? `📍 ${r.location}` : null,

    progressBar: (r) => {
      if (!r.next_service_miles || !r.odometer_current || !r.last_service_odometer) return null;
      const interval = r.next_service_miles - r.last_service_odometer;
      const used = r.odometer_current - r.last_service_odometer;
      if (interval <= 0) return null;
      const pct = Math.max(0, Math.min(100, Math.round((used / interval) * 100)));
      const tone = pct >= 95 ? 'bad' : pct >= 80 ? 'warn' : 'good';
      return {
        label: 'Next service',
        fillPct: pct,
        valueText: `${used.toLocaleString()} / ${interval.toLocaleString()} mi`,
        tone,
        tooltip: `${interval - used} miles until next service`,
      };
    },

    crossModule: (r) => {
      const rows = [];
      if (r.ytd_fuel != null) {
        rows.push(S.crossRow('YTD fuel', S.money(r.ytd_fuel), {
          asterisk: r.ytd_fuel_asterisk,
          asteriskTooltip: r.ytd_fuel_asterisk
            ? 'This figure may be incomplete — some fuel transactions are not yet linked to this vehicle. Tap to review.'
            : null,
          onClick: () => S.openModuleFiltered('reports', { type: 'pending_items', module: 'vehicle', id: r.id }),
        }));
      }
      if (r.service_ytd != null) {
        rows.push(S.crossRow('Service YTD', S.money(r.service_ytd)));
      }
      if (r.odometer_current != null) {
        rows.push(S.crossRow('Odometer', r.odometer_current.toLocaleString() + ' mi'));
      }
      return rows;
    },

    alert: (r) => {
      const alerts = [];
      // Primary: oil change / service due if at threshold
      if (r.next_service_miles && r.odometer_current) {
        const left = r.next_service_miles - r.odometer_current;
        if (left <= 250) {
          alerts.push({
            text: left <= 0
              ? `Service overdue by ${Math.abs(left)} mi`
              : `Service due in ${left} mi`,
            metaText: r.last_service_at ? `Last service ${S.fmtDateShort(r.last_service_at)}` : null,
            actionLabel: 'Schedule service',
            tone: left <= 0 ? 'bad' : 'warn',
          });
        }
      }
      // Secondary: registration, insurance
      const secondaries = [];
      if (r.registration_expires_at) {
        const d = S.daysFromToday(r.registration_expires_at);
        if (d != null && d <= 90) {
          secondaries.push({
            icon: 'circle',
            text: `Registration expires ${S.fmtDateShort(r.registration_expires_at)}`,
            label: d < 0 ? `${Math.abs(d)}d overdue` : `${d} days`,
          });
        }
      }
      if (r.insurance_renewal_at) {
        const d = S.daysFromToday(r.insurance_renewal_at);
        if (d != null && d <= 90) {
          secondaries.push({
            icon: 'circle',
            text: `Insurance renewal ${S.fmtDateShort(r.insurance_renewal_at)}`,
            label: d < 0 ? `${Math.abs(d)}d overdue` : `${d} days`,
          });
        }
      }
      if (!alerts.length && !secondaries.length) return null;

      const primary = alerts[0] || {
        text: 'Multiple items due',
        actionLabel: 'Review',
        tone: 'warn',
      };
      primary.secondaries = secondaries;
      primary.subText = r.last_service_at
        ? `Last service ${S.fmtDateShort(r.last_service_at)}`
        : null;
      primary.subTextMono = r.plate_number ? `Plate ${r.plate_number}` : null;
      return primary;
    },

    linkedEntities: (r) => {
      const ents = [];
      if (r.owner_family_member_id) {
        const fm = S.familyMemberEntity(r.owner_family_member_id);
        if (fm) ents.push(fm);
      }
      if (r.insurer_brand) {
        ents.push(S.brandEntity(r.insurer_brand,
          r.insurer_brand_color || '#d50000',
          r.insurer_brand_initials || r.insurer_brand.slice(0, 2)));
      }
      if (r.shop_brand) {
        ents.push(S.brandEntity(r.shop_brand,
          r.shop_brand_color || '#ed1c24',
          r.shop_brand_initials || r.shop_brand.slice(0, 2)));
      }
      return ents;
    },

    drillDown: (r) => ({
      label: 'Service log',
      onClick: () => S.openModuleFiltered('vehicles', { id: r.id, view: 'service_log' }),
    }),

    metaSuffix: (r) => r.attachment_count ? `📎 ${r.attachment_count}` : null,
  });

  // ════════════════════════════════════════════════════════════════
  // SUBSCRIPTIONS
  // ════════════════════════════════════════════════════════════════
  GH_CARD.register('subscriptions', {
    mode: 'full',

    statusDot: (r) => {
      if (r.status === 'cancelled') return 'neutral';
      if (r.price_increased_recently) return 'warn';
      return 'good';
    },

    statusRowChips: (r) => {
      const chips = [];
      if (r.category) chips.push({ label: r.category, icon: 'check', tint: 'purple' });
      if (r.shared_with_family) chips.push({ label: `Family · ${r.shared_count || ''}`, icon: 'users', tint: 'pink' });
      return chips;
    },

    categoryTag: (r) => r.subcategory || '',

    hero: (r) => {
      const div = document.createElement('div');
      div.style.cssText = `width:100%;height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;background:${r.brand_color || '#475569'};color:#fff;border-radius:12px;`;
      const wm = document.createElement('div');
      wm.textContent = r.brand_wordmark || r.service_name || 'Service';
      wm.style.cssText = 'font-size:20px;font-weight:700;letter-spacing:-.02em;';
      div.appendChild(wm);
      if (r.plan_name) {
        const plan = document.createElement('div');
        plan.textContent = r.plan_name;
        plan.style.cssText = 'font-size:9px;letter-spacing:.1em;text-transform:uppercase;margin-top:4px;opacity:.85;';
        div.appendChild(plan);
      }
      return div;
    },

    title: (r) => r.service_name || r.name || 'Subscription',
    subtitle: (r) => [r.plan_name, r.cycle && ('· ' + r.cycle)].filter(Boolean).join(' '),

    metaLine: (r) => [r.category, r.cycle].filter(Boolean).join(' · '),

    scheduleLine: (r) => {
      if (!r.next_charge_at) return null;
      const d = S.daysFromToday(r.next_charge_at);
      if (d == null) return null;
      return `🔄 Renews ${S.fmtDateShort(r.next_charge_at)} · ${d} days`;
    },

    crossModule: (r) => {
      const rows = [];
      if (r.annual_cost != null) {
        rows.push(S.crossRow('Annual', S.money(r.annual_cost), {
          asterisk: r.annual_cost_asterisk,
          asteriskTooltip: 'May span price changes — total approximate.',
        }));
      }
      if (r.last_3_charges_total != null) {
        rows.push(S.crossRow('Last 3', S.money(r.last_3_charges_total)));
      }
      if (r.active_since) {
        rows.push(S.crossRow('Active since', S.fmtDateShort(r.active_since)));
      }
      return rows;
    },

    alert: (r) => {
      if (r.price_increased_recently && r.price_delta) {
        return {
          text: `Price increased ${S.money(r.price_delta)}/mo on ${S.fmtDateShort(r.price_change_at)}`,
          metaText: `${S.money(r.previous_price)} → ${S.money(r.current_price)} · ${S.money(r.price_delta * 12)}/year going forward`,
          actionLabel: 'Review plan',
          tone: 'warn',
          subText: 'Tracked from imported transactions',
          subTextMono: r.account_id ? `Acct# ${r.account_id}` : null,
        };
      }
      return null;
    },

    linkedEntities: (r) => {
      const ents = [];
      if (r.owner_family_member_id) {
        const fm = S.familyMemberEntity(r.owner_family_member_id);
        if (fm) ents.push(fm);
      }
      if (r.brand_color) {
        ents.push(S.brandEntity(r.service_name, r.brand_color,
          (r.service_name || '?').slice(0, 2).toUpperCase()));
      }
      if (r.paying_account_brand) {
        ents.push(S.brandEntity(r.paying_account_brand, r.paying_account_color || '#0a4abf',
          (r.paying_account_brand || '?').slice(0, 3).toUpperCase()));
      }
      return ents;
    },

    drillDown: (r) => ({
      label: 'Charges',
      onClick: () => S.openModuleFiltered('subscriptions', { id: r.id, view: 'charges' }),
    }),

    metaSuffix: (r) => r.attachment_count ? `📎 ${r.attachment_count}` : null,
  });

  // ════════════════════════════════════════════════════════════════
  // FINANCE ACCOUNTS (banking)
  // ════════════════════════════════════════════════════════════════
  GH_CARD.register('finance_accounts', {
    mode: 'full',

    statusDot: (r) => {
      if (r.balance_current == null) return 'neutral';
      if (r.balance_current < 0) return 'bad';
      if (r.low_balance_threshold && r.balance_current < r.low_balance_threshold) return 'warn';
      return 'good';
    },

    statusRowChips: (r) => {
      const chips = [];
      const t = r.account_type || '';
      const tInfo = {
        checking:    { label: 'Checking',    tint: 'blue' },
        savings:     { label: 'Savings',     tint: 'green' },
        credit_card: { label: 'Credit Card', tint: 'red' },
        brokerage:   { label: 'Brokerage',   tint: 'purple' },
      }[t] || { label: t || 'Account', tint: 'blue' };
      chips.push({ label: tInfo.label, icon: 'check', tint: tInfo.tint });
      if (r.is_joint) chips.push({ label: 'Joint', icon: 'users', tint: 'pink' });
      return chips;
    },

    hero: (r) => {
      const div = document.createElement('div');
      div.style.cssText = `width:100%;height:100%;display:flex;align-items:center;justify-content:center;background:${r.bank_brand_color || '#0a4abf'};color:#fff;border-radius:12px;font-size:18px;font-weight:700;letter-spacing:-.02em;text-align:center;padding:8px;`;
      div.textContent = r.bank_brand || r.institution || 'Bank';
      return div;
    },

    title: (r) => r.nickname || r.name || 'Account',
    subtitle: (r) => r.last_four ? `····${r.last_four}` : '',

    metaLine: (r) => r.last_import_at ? `Last import ${S.fmtDateShort(r.last_import_at)}` : 'No imports yet',

    scheduleLine: (r) => {
      if (r.balance_current == null) return null;
      const big = S.money(r.balance_current);
      const delta = r.balance_change_30d;
      if (delta == null) return `Balance ${big}`;
      const arrow = delta > 0 ? '↑' : delta < 0 ? '↓' : '·';
      return `Balance ${big} · ${arrow} ${S.money(Math.abs(delta))} 30d`;
    },

    crossModule: (r) => {
      const rows = [];
      if (r.ytd_activity_count != null) {
        rows.push(S.crossRow('YTD activity', r.ytd_activity_count + ' tx', {
          asterisk: r.statement_gap_detected ? 'amber' : null,
          asteriskTooltip: 'Statement gap detected — some transactions may be missing.',
        }));
      }
      if (r.balance_change_30d != null) {
        const sign = r.balance_change_30d > 0 ? '+' : '';
        rows.push(S.crossRow('Last 30d', sign + S.money(r.balance_change_30d)));
      }
      if (r.linked_subs_count != null) {
        rows.push(S.crossRow('Linked subs', r.linked_subs_count));
      }
      return rows;
    },

    alert: (r) => {
      if (r.balance_current != null && r.low_balance_threshold && r.balance_current < r.low_balance_threshold) {
        return {
          text: `Balance below threshold (${S.money(r.low_balance_threshold)})`,
          metaText: `Current ${S.money(r.balance_current)}`,
          actionLabel: 'Transfer in',
          tone: 'warn',
        };
      }
      if (r.statement_gap_detected) {
        return {
          text: 'Statement gap detected',
          metaText: r.last_statement_month ? `Last imported month: ${r.last_statement_month}` : null,
          actionLabel: 'Import statement',
          tone: 'warn',
        };
      }
      return null;
    },

    linkedEntities: (r) => {
      const ents = [];
      if (r.owner_family_member_id) {
        const fm = S.familyMemberEntity(r.owner_family_member_id);
        if (fm) ents.push(fm);
      }
      if (r.bank_brand) {
        ents.push(S.brandEntity(r.bank_brand,
          r.bank_brand_color || '#0a4abf',
          r.bank_brand_initials || r.bank_brand.slice(0, 3)));
      }
      return ents;
    },

    drillDown: (r) => ({
      label: 'Activity',
      onClick: () => S.openModuleFiltered('finance', { id: r.id, view: 'transactions' }),
    }),
  });

  // ════════════════════════════════════════════════════════════════
  // HSA
  // ════════════════════════════════════════════════════════════════
  GH_CARD.register('hsa_accounts', {
    mode: 'full',

    statusDot: (r) => {
      if (r.receipts_pending_count > 0) return 'warn';
      return 'good';
    },

    statusRowChips: (r) => [
      { label: r.tax_year ? String(r.tax_year) : '', icon: 'calendar', tint: 'blue' },
      r.plan_type
        ? { label: r.plan_type === 'family' ? `Family ${S.money(r.contribution_limit)}` : `Self-only ${S.money(r.contribution_limit)}`, icon: 'check', tint: 'green' }
        : null,
    ].filter(Boolean),

    hero: (r) => {
      const div = document.createElement('div');
      div.style.cssText = `width:100%;height:100%;display:flex;align-items:center;justify-content:center;background:${r.provider_brand_color || '#16a34a'};color:#fff;border-radius:12px;font-size:16px;font-weight:700;text-align:center;padding:8px;`;
      div.textContent = r.provider_brand || r.provider || 'HSA';
      return div;
    },

    title: (r) => r.nickname || `HSA · ${r.tax_year || ''}`,
    subtitle: (r) => r.plan_type === 'family' ? 'Family' : 'Self-only',

    progressBar: (r) => {
      if (!r.contribution_limit || r.contribution_ytd == null) return null;
      const pct = Math.round((r.contribution_ytd / r.contribution_limit) * 100);
      return {
        label: 'Contribution',
        fillPct: pct,
        valueText: `${S.money(r.contribution_ytd)} / ${S.money(r.contribution_limit)}`,
        tone: 'good',
      };
    },

    metaLine: (r) => {
      if (r.contribution_limit && r.contribution_ytd != null) {
        const remaining = r.contribution_limit - r.contribution_ytd;
        const monthsLeft = 12 - (new Date().getMonth() + 1);
        if (monthsLeft > 0 && remaining > 0) {
          return `${S.money(remaining)} room left, ${S.money(remaining / monthsLeft)}/mo to max by Dec`;
        }
        return `${S.money(remaining)} room remaining`;
      }
      return null;
    },

    crossModule: (r) => {
      const rows = [];
      if (r.spent_ytd != null) {
        rows.push(S.crossRow('Spent YTD', S.money(r.spent_ytd), {
          asterisk: r.spent_asterisk,
          asteriskTooltip: 'Some receipts not yet matched. Tap to review.',
        }));
      }
      if (r.receipts_pending_count != null) {
        rows.push(S.crossRow('Receipts pending', r.receipts_pending_count, {
          onClick: () => S.openModuleFiltered('reports', { type: 'pending_items', module: 'hsa' }),
        }));
      }
      if (r.eligible_matches_count != null) {
        rows.push(S.crossRow('Eligible matches', r.eligible_matches_count));
      }
      return rows;
    },

    alert: (r) => {
      if (r.receipts_pending_count > 0) {
        return {
          text: `${r.receipts_pending_count} receipt${r.receipts_pending_count > 1 ? 's' : ''} pending review`,
          metaText: 'Match transactions to medical expenses',
          actionLabel: 'Review',
          tone: 'warn',
        };
      }
      return null;
    },

    linkedEntities: (r) => {
      const ents = [];
      if (r.owner_family_member_id) {
        const fm = S.familyMemberEntity(r.owner_family_member_id);
        if (fm) ents.push(fm);
      }
      if (r.provider_brand) {
        ents.push(S.brandEntity(r.provider_brand,
          r.provider_brand_color || '#16a34a',
          (r.provider_brand || '?').slice(0, 3)));
      }
      return ents;
    },

    drillDown: (r) => ({
      label: 'Activity',
      onClick: () => S.openModuleFiltered('hsa', { id: r.id }),
    }),
  });

  // ════════════════════════════════════════════════════════════════
  // MAINTENANCE
  // ════════════════════════════════════════════════════════════════
  GH_CARD.register('maintenance', {
    mode: 'full',

    statusDot: (r) => {
      if (!r.next_due_at) return 'neutral';
      const d = S.daysFromToday(r.next_due_at);
      if (d == null) return 'neutral';
      if (d < 0) return 'bad';
      if (d <= 14) return 'warn';
      return 'good';
    },

    statusRowChips: (r) => [
      r.frequency_days ? { label: `Every ${r.frequency_days}d`, icon: 'arrows-clockwise', tint: 'amber' } : null,
      r.system ? { label: r.system, icon: 'check', tint: 'blue' } : null,
    ].filter(Boolean),

    hero: (r) => {
      const div = document.createElement('div');
      div.style.cssText = 'width:100%;height:100%;display:flex;align-items:center;justify-content:center;background:linear-gradient(135deg,#fef3c7,#fbbf24);border-radius:12px;color:#92400e;';
      // Generic wrench icon as fallback
      div.innerHTML = `<svg width="50%" height="50%" viewBox="0 0 256 256" fill="currentColor"><path d="M226.34,123.6l-21.5-12.41a78,78,0,0,0,0-22.38l21.5-12.41a8,8,0,0,0,2.93-10.93l-23.5-40.69a8,8,0,0,0-10.93-2.93L173.34,34.27a78,78,0,0,0-19.4-11.21L150.4,9.13A8,8,0,0,0,142.6,3.13H105.4a8,8,0,0,0-7.8,6L94.06,23a78,78,0,0,0-19.4,11.21L53.16,21.85a8,8,0,0,0-10.93,2.93l-23.5,40.69A8,8,0,0,0,21.66,76.4L43.16,88.81a78,78,0,0,0,0,22.38L21.66,123.6a8,8,0,0,0-2.93,10.93l23.5,40.69a8,8,0,0,0,10.93,2.93l21.5-12.41a78,78,0,0,0,19.4,11.21l3.54,13.85a8,8,0,0,0,7.8,6h37.2a8,8,0,0,0,7.8-6L153.94,177a78,78,0,0,0,19.4-11.21l21.5,12.41a8,8,0,0,0,10.93-2.93l23.5-40.69A8,8,0,0,0,226.34,123.6ZM128,168a40,40,0,1,1,40-40A40,40,0,0,1,128,168Z"/></svg>`;
      return div;
    },

    title: (r) => r.name || 'Maintenance task',
    subtitle: (r) => r.system || '',

    metaLine: (r) => r.last_done_at ? `Last done ${S.fmtDateShort(r.last_done_at)}` : 'Never done',

    scheduleLine: (r) => r.next_due_at ? `🔔 Due ${S.fmtDateShort(r.next_due_at)} · ${S.dueLabel(r.next_due_at)}` : null,

    progressBar: (r) => {
      if (!r.last_done_at || !r.frequency_days) return null;
      const elapsed = S.daysFromToday(r.last_done_at);
      if (elapsed == null) return null;
      const used = -elapsed; // days since last done
      const pct = Math.max(0, Math.min(100, Math.round((used / r.frequency_days) * 100)));
      return {
        label: 'Cycle',
        fillPct: pct,
        valueText: `${used} / ${r.frequency_days}d`,
        tone: pct >= 100 ? 'bad' : pct >= 85 ? 'warn' : 'good',
      };
    },

    crossModule: (r) => {
      const rows = [];
      if (r.last_cost != null) {
        rows.push(S.crossRow('Last cost', S.money(r.last_cost)));
      }
      if (r.avg_cost != null) {
        rows.push(S.crossRow('Avg cost', S.money(r.avg_cost)));
      }
      if (r.actual_avg_interval && r.frequency_days) {
        const drift = r.actual_avg_interval - r.frequency_days;
        const driftStr = drift === 0 ? 'on schedule'
          : drift > 0 ? `+${drift}d drift` : `${drift}d drift`;
        rows.push(S.crossRow('Avg interval', driftStr));
      }
      return rows;
    },

    alert: (r) => {
      if (!r.next_due_at) return null;
      const d = S.daysFromToday(r.next_due_at);
      if (d == null || d > 14) return null;
      return {
        text: d < 0 ? `Overdue by ${Math.abs(d)} days` : (d === 0 ? 'Due today' : `Due in ${d} days`),
        metaText: r.last_done_at ? `Last done ${S.fmtDateShort(r.last_done_at)}` : null,
        actionLabel: r.vendor_contact_id ? 'Schedule vendor' : 'Mark done',
        tone: d < 0 ? 'bad' : 'warn',
      };
    },

    linkedEntities: (r) => {
      const ents = [];
      if (r.assignee_family_member_id) {
        const fm = S.familyMemberEntity(r.assignee_family_member_id);
        if (fm) ents.push(fm);
      }
      if (r.vendor_brand) {
        ents.push(S.brandEntity(r.vendor_brand,
          r.vendor_brand_color || '#475569',
          r.vendor_brand_initials || r.vendor_brand.slice(0, 2)));
      }
      return ents;
    },

    drillDown: (r) => ({
      label: 'History',
      onClick: () => S.openModuleFiltered('maintenance', { id: r.id, view: 'history' }),
    }),

    metaSuffix: (r) => r.attachment_count ? `📎 ${r.attachment_count}` : null,
  });

  // ════════════════════════════════════════════════════════════════
  // BOOKS — reading dashboard, not shelf row
  // ════════════════════════════════════════════════════════════════
  GH_CARD.register('books', {
    mode: 'full',

    statusDot: (r) => {
      if (r.status === 'reading') return 'good';
      if (r.status === 'want_to_read') return 'warn';
      if (r.status === 'finished') return 'neutral';
      if (r.status === 'abandoned') return 'neutral';
      return 'neutral';
    },

    statusRowChips: (r) => {
      const chips = [];
      const stChip = {
        reading: { label: 'Reading', tint: 'green' },
        want_to_read: { label: 'Want to read', tint: 'amber' },
        finished: { label: 'Finished', tint: 'blue' },
        abandoned: { label: 'Abandoned', tint: 'red' },
      }[r.status];
      if (stChip) chips.push({ label: stChip.label, icon: 'book-open', tint: stChip.tint });
      if (r.genre) chips.push({ label: r.genre, icon: 'check', tint: 'purple' });
      if (r.format) chips.push({ label: r.format, icon: 'check', tint: 'blue' });
      return chips;
    },

    hero: (r) => {
      const div = document.createElement('div');
      div.style.cssText = 'width:100%;height:100%;display:flex;align-items:center;justify-content:center;border-radius:12px;background:linear-gradient(135deg,#9333ea,#3730a3);color:white;font-size:14px;font-weight:600;text-align:center;padding:12px;line-height:1.2;';
      if (r.cover_attachment_id) {
        div.style.background = `url(/api/v1/attachments/${r.cover_attachment_id}/thumb) center/cover`;
        div.textContent = '';
      } else {
        div.textContent = r.title || 'Book';
      }
      return div;
    },

    title: (r) => r.title || 'Untitled',
    subtitle: (r) => r.author || '',

    progressBar: (r) => {
      if (!r.total_pages || r.current_page == null) return null;
      const pct = Math.round((r.current_page / r.total_pages) * 100);
      return {
        label: 'Progress',
        fillPct: pct,
        valueText: `${r.current_page} / ${r.total_pages}`,
        tone: 'good',
      };
    },

    metaLine: (r) => {
      if (r.target_finish_at && r.pages_per_day_needed != null) {
        return `Target finish ${S.fmtDateShort(r.target_finish_at)} · ${r.pages_per_day_needed}/day to make it`;
      }
      return null;
    },

    crossModule: (r) => {
      const rows = [];
      if (r.pages_today != null) rows.push(S.crossRow('Pages today', r.pages_today));
      if (r.streak_days != null) rows.push(S.crossRow('Streak', `${r.streak_days}d`));
      if (r.pace_status) rows.push(S.crossRow('Pace', r.pace_status));
      return rows;
    },

    alert: (r) => {
      if (r.status === 'reading' && r.pace_status === 'behind' && r.pages_to_catch_up) {
        return {
          text: `Read ${r.pages_to_catch_up} pages today to catch up`,
          metaText: r.target_finish_at ? `Target ${S.fmtDateShort(r.target_finish_at)}` : null,
          actionLabel: 'Log progress',
          tone: 'warn',
        };
      }
      if (r.status === 'finished' && !r.recommendation_logged) {
        return {
          text: `Finished — ${r.rating || ''} stars`,
          metaText: 'Add to recommendations?',
          actionLabel: 'Recommend to family',
          tone: 'good',
        };
      }
      return null;
    },

    linkedEntities: (r) => {
      const ents = [];
      if (r.reader_family_member_id) {
        const fm = S.familyMemberEntity(r.reader_family_member_id);
        if (fm) ents.push(fm);
      }
      if (r.source_brand) {
        ents.push(S.brandEntity(r.source_brand,
          r.source_brand_color || '#475569',
          r.source_brand.slice(0, 2)));
      }
      return ents;
    },

    drillDown: (r) => ({
      label: 'Sessions',
      onClick: () => S.openModuleFiltered('books', { id: r.id, view: 'sessions' }),
    }),
  });

  // ════════════════════════════════════════════════════════════════
  // TRADE POSITIONS
  // ════════════════════════════════════════════════════════════════
  GH_CARD.register('trade_positions', {
    mode: 'full',

    statusDot: (r) => {
      if (r.unrealized_pl == null) return 'neutral';
      if (r.unrealized_pl > 0) return 'good';
      if (r.unrealized_pl < 0) return 'bad';
      return 'neutral';
    },

    statusRowChips: (r) => {
      const chips = [];
      if (r.position_type) {
        const pt = {
          long: { label: 'Long', tint: 'green' },
          short: { label: 'Short', tint: 'red' },
          watching: { label: 'Watching', tint: 'amber' },
        }[r.position_type] || { label: r.position_type, tint: 'blue' };
        chips.push({ label: pt.label, icon: 'check', tint: pt.tint });
      }
      if (r.sector) chips.push({ label: r.sector, icon: 'check', tint: 'purple' });
      return chips;
    },

    hero: (r) => {
      const div = document.createElement('div');
      div.style.cssText = `width:100%;height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;background:${r.brand_color || 'linear-gradient(135deg,#1e293b,#475569)'};color:#fff;border-radius:12px;`;
      const sym = document.createElement('div');
      sym.textContent = r.symbol || '?';
      sym.style.cssText = 'font-size:22px;font-weight:700;letter-spacing:-.02em;';
      div.appendChild(sym);
      return div;
    },

    title: (r) => r.symbol || '?',
    subtitle: (r) => r.company_name || '',

    metaLine: (r) => {
      if (r.current_price == null) return null;
      const change = r.day_change_pct;
      const arrow = change > 0 ? '↑' : change < 0 ? '↓' : '·';
      const changeText = change != null ? `${arrow} ${Math.abs(change).toFixed(2)}%` : '';
      return `${S.money(r.current_price)} · ${changeText}`;
    },

    crossModule: (r) => {
      const rows = [];
      if (r.cost_basis != null) rows.push(S.crossRow('Cost basis', S.money(r.cost_basis)));
      if (r.current_value != null) rows.push(S.crossRow('Value', S.money(r.current_value)));
      if (r.realized_ytd != null) {
        const sign = r.realized_ytd > 0 ? '+' : '';
        rows.push(S.crossRow('Realized YTD', sign + S.money(r.realized_ytd)));
      }
      return rows;
    },

    alert: (r) => {
      if (r.alert_triggered && r.alert_text) {
        return {
          text: r.alert_text,
          metaText: r.alert_meta || null,
          actionLabel: 'Review position',
          tone: 'warn',
        };
      }
      return null;
    },

    linkedEntities: (r) => {
      const ents = [];
      if (r.account_id) {
        ents.push(S.brandEntity(r.account_brand || 'Account',
          r.account_brand_color || '#0a4abf',
          (r.account_brand || 'AC').slice(0, 3)));
      }
      return ents;
    },

    drillDown: (r) => ({
      label: 'Trades',
      onClick: () => S.openModuleFiltered('trade', { id: r.id, view: 'history' }),
    }),
  });

  console.log('[GH_CARD] batch1 configs registered: vehicles, subscriptions, finance_accounts, hsa_accounts, maintenance, books, trade_positions');
})();
