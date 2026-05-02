/**
 * gh-card-configs-batch2.js — Card configs for v202604.115.
 *
 * Six more modules using the established renderer:
 *   • wardrobe        — photo-hero, items table extension
 *   • perfumes        — photo-hero with concentration/notes meta
 *   • properties      — photo-hero, monetary cross-module
 *   • documents       — first-page thumbnail hero, expiry alerts
 *   • insurance       — carrier brand-block hero, premium/renewal
 *   • career_jobs     — company logo-block hero, tenure progress
 *
 * All configs read schema-correct field names (cross-checked against
 * the live migrations: 107_wardrobe.sql, 108_perfume.sql,
 * 024_property_vehicles.sql, 025_documents.sql, 110_insurance.sql,
 * 021_career.sql). Missing fields tolerated via the same pattern as
 * batch1 — derived rows that have no data simply don't render.
 *
 * Spec: CARDS_FINAL.md
 */
(function() {
  'use strict';
  if (!window.GH_CARD) {
    console.warn('[GH_CARD batch2] GH_CARD not loaded — skipping');
    return;
  }
  const S = window.GH_CARD_SHARED || {};

  // ════════════════════════════════════════════════════════════════
  // WARDROBE (extends items table)
  // ════════════════════════════════════════════════════════════════
  GH_CARD.register('wardrobe', {
    mode: 'full',

    statusDot: (r) => {
      if (r.wardrobe_status === 'sold' || r.wardrobe_status === 'donated' ||
          r.wardrobe_status === 'discarded') return 'neutral';
      // Stale = not worn in 90+ days
      if (r.last_worn_at) {
        const days = -S.daysFromToday(r.last_worn_at);
        if (days > 180) return 'warn';
      }
      return 'good';
    },

    statusRowChips: (r) => {
      const chips = [];
      // Season
      const seasons = parseJsonArr(r.season_tags);
      if (seasons.length) chips.push({ label: seasons.slice(0, 2).join('/'), icon: 'check', tint: 'blue' });
      // Status (if not active)
      if (r.wardrobe_status && r.wardrobe_status !== 'active') {
        chips.push({ label: cap(r.wardrobe_status), icon: 'check', tint: 'amber' });
      }
      return chips;
    },

    categoryTag: (r) => r.category || r.subcategory || '',

    hero: (r) => photoHero(r.photo_attachment_id || r.attachment_id, r.wardrobe_nickname || r.name || 'Garment', '#a78bfa'),

    title: (r) => r.brand || r.wardrobe_nickname || r.name || 'Garment',
    subtitle: (r) => [r.wardrobe_nickname && r.brand ? r.wardrobe_nickname : null, r.color]
                       .filter(Boolean).join(' · '),

    metaLine: (r) => {
      const occ = parseJsonArr(r.occasion_tags);
      return [r.size, occ.length ? occ.slice(0, 2).join(', ') : null]
        .filter(Boolean).join(' · ');
    },

    scheduleLine: (r) => r.last_worn_at
      ? `👕 Last worn ${S.fmtDateShort(r.last_worn_at)}`
      : 'Never worn',

    crossModule: (r) => {
      const rows = [];
      if (r.purchase_price != null) rows.push(S.crossRow('Paid', S.money(r.purchase_price)));
      if (r.times_worn != null)     rows.push(S.crossRow('Times worn', r.times_worn));
      if (r.cost_per_wear != null)  rows.push(S.crossRow('Cost/wear', S.money(r.cost_per_wear)));
      return rows;
    },

    alert: (r) => {
      if (!r.last_worn_at) return null;
      const days = -S.daysFromToday(r.last_worn_at);
      if (days >= 180) {
        return {
          text: `Not worn in ${days} days`,
          metaText: 'Consider donating or styling into a new look',
          actionLabel: 'Plan outfit',
          tone: 'warn',
        };
      }
      return null;
    },

    linkedEntities: (r) => {
      const ents = [];
      const fm = S.familyMemberEntity(r.wardrobe_owner_id);
      if (fm) ents.push(fm);
      if (r.brand) ents.push(S.brandEntity(r.brand, '#475569', r.brand.slice(0, 2)));
      return ents;
    },

    drillDown: (r) => ({
      label: 'Wear log',
      onClick: () => S.openModuleFiltered('wardrobe', { id: r.id, view: 'wear_log' }),
    }),

    metaSuffix: (r) => r.attachment_count ? `📎 ${r.attachment_count}` : null,
  });

  // ════════════════════════════════════════════════════════════════
  // PERFUMES
  // ════════════════════════════════════════════════════════════════
  GH_CARD.register('perfumes', {
    mode: 'full',

    statusDot: (r) => {
      if (r.status === 'empty' || r.status === 'given_away' || r.status === 'lost') return 'neutral';
      if (r.amount_level === 'Low' || r.amount_level === 'Empty') return 'warn';
      return 'good';
    },

    statusRowChips: (r) => {
      const chips = [];
      if (r.concentration) chips.push({ label: r.concentration, icon: 'check', tint: 'purple' });
      const seasons = parseJsonArr(r.season_tags);
      if (seasons.length) chips.push({ label: seasons.slice(0, 2).join('/'), icon: 'check', tint: 'blue' });
      return chips;
    },

    categoryTag: (r) => r.gender || '',

    hero: (r) => photoHero(r.photo_attachment_id, r.name || 'Perfume', '#f472b6'),

    title: (r) => r.brand || 'Perfume',
    subtitle: (r) => r.name || '',

    metaLine: (r) => {
      const family = parseJsonArr(r.scent_family);
      return [r.size_ml ? `${r.size_ml}ml` : null,
              r.amount_level,
              family.length ? family[0] : null].filter(Boolean).join(' · ');
    },

    scheduleLine: (r) => r.last_worn_at
      ? `🌸 Last worn ${S.fmtDateShort(r.last_worn_at)}`
      : null,

    crossModule: (r) => {
      const rows = [];
      if (r.purchase_price != null) rows.push(S.crossRow('Paid', S.money(r.purchase_price)));
      if (r.wears_ytd != null)      rows.push(S.crossRow('Wears YTD', r.wears_ytd));
      if (r.rating != null)         rows.push(S.crossRow('Rating', `${r.rating}/5`));
      return rows;
    },

    alert: (r) => {
      if (r.amount_level === 'Empty') {
        return { text: 'Empty bottle', metaText: 'Repurchase or archive',
                 actionLabel: 'Mark archived', tone: 'warn' };
      }
      if (r.amount_level === 'Low') {
        return { text: 'Low fill', metaText: 'Consider repurchase',
                 actionLabel: 'Add to wishlist', tone: 'warn' };
      }
      return null;
    },

    linkedEntities: (r) => {
      const ents = [];
      const fm = S.familyMemberEntity(r.owner_family_member_id);
      if (fm) ents.push(fm);
      if (r.brand) ents.push(S.brandEntity(r.brand, '#1e293b', r.brand.slice(0, 2)));
      return ents;
    },

    drillDown: (r) => ({
      label: 'Wear log',
      onClick: () => S.openModuleFiltered('perfume', { id: r.id, view: 'wear_log' }),
    }),
  });

  // ════════════════════════════════════════════════════════════════
  // PROPERTIES
  // ════════════════════════════════════════════════════════════════
  GH_CARD.register('properties', {
    mode: 'full',

    statusDot: (r) => {
      if (r.is_active === 0) return 'neutral';
      // Tax due alert
      if (r.next_tax_due_at) {
        const days = S.daysFromToday(r.next_tax_due_at);
        if (days != null && days <= 30) return 'warn';
      }
      return 'good';
    },

    statusRowChips: (r) => [
      r.property_type ? { label: r.property_type, icon: 'house', tint: 'blue' } : null,
      r.mortgage_balance > 0 ? { label: 'Mortgaged', icon: 'check', tint: 'amber' } : { label: 'Owned', icon: 'check', tint: 'green' },
    ].filter(Boolean),

    hero: (r) => photoHero(r.photo_attachment_id, r.nickname, '#0284c7'),

    title: (r) => r.nickname || 'Property',
    subtitle: (r) => [r.address_city, r.address_state].filter(Boolean).join(', '),

    metaLine: (r) => r.address_street || null,

    crossModule: (r) => {
      const rows = [];
      if (r.current_est_value != null) {
        rows.push(S.crossRow('Value', S.money(r.current_est_value)));
      }
      if (r.mortgage_balance != null && r.mortgage_balance > 0) {
        rows.push(S.crossRow('Mortgage', S.money(r.mortgage_balance)));
      }
      if (r.maintenance_ytd != null) {
        rows.push(S.crossRow('Maint YTD', S.money(r.maintenance_ytd)));
      }
      return rows;
    },

    alert: (r) => {
      if (r.next_tax_due_at) {
        const days = S.daysFromToday(r.next_tax_due_at);
        if (days != null && days <= 30) {
          return {
            text: days < 0 ? `Property tax overdue ${Math.abs(days)}d` : `Property tax due in ${days}d`,
            metaText: r.property_tax_annual ? `${S.money(r.property_tax_annual)} annual` : null,
            actionLabel: 'Mark paid',
            tone: days < 0 ? 'bad' : 'warn',
          };
        }
      }
      return null;
    },

    linkedEntities: (r) => {
      const ents = [];
      if (r.insurance_company) ents.push(S.brandEntity(r.insurance_company, '#0a4abf', r.insurance_company.slice(0, 3)));
      if (r.mortgage_lender)   ents.push(S.brandEntity(r.mortgage_lender, '#475569', r.mortgage_lender.slice(0, 3)));
      return ents;
    },

    drillDown: (r) => ({
      label: 'History',
      onClick: () => S.openModuleFiltered('property', { id: r.id, view: 'history' }),
    }),

    metaSuffix: (r) => r.attachment_count ? `📎 ${r.attachment_count}` : null,
  });

  // ════════════════════════════════════════════════════════════════
  // DOCUMENTS
  // ════════════════════════════════════════════════════════════════
  GH_CARD.register('documents', {
    mode: 'full',

    statusDot: (r) => {
      if (!r.expiry_date) return 'good';
      const days = S.daysFromToday(r.expiry_date);
      if (days == null) return 'good';
      if (days < 0) return 'bad';
      if (days <= 60) return 'warn';
      return 'good';
    },

    statusRowChips: (r) => [
      r.category ? { label: r.category, icon: 'check', tint: 'purple' } : null,
      r.subcategory ? { label: r.subcategory, icon: 'check', tint: 'blue' } : null,
    ].filter(Boolean),

    hero: (r) => {
      // First-page thumbnail when attachment is a PDF; else doc-icon gradient
      if (r.attachment_id) {
        return photoHero(r.attachment_id, r.title, '#475569');
      }
      const div = document.createElement('div');
      div.style.cssText = 'width:100%;height:100%;display:flex;align-items:center;justify-content:center;background:linear-gradient(135deg,#94a3b8,#475569);border-radius:12px;color:#fff;';
      div.innerHTML = '<svg width="40%" height="40%" viewBox="0 0 256 256" fill="currentColor"><path d="M213.66,82.34l-56-56A8,8,0,0,0,152,24H56A16,16,0,0,0,40,40V216a16,16,0,0,0,16,16H200a16,16,0,0,0,16-16V88A8,8,0,0,0,213.66,82.34ZM160,51.31,188.69,80H160ZM200,216H56V40h88V88a8,8,0,0,0,8,8h48V216Z"/></svg>';
      return div;
    },

    title: (r) => r.title || 'Document',
    subtitle: (r) => r.issuer || '',

    metaLine: (r) => {
      const parts = [];
      if (r.issue_date) parts.push(`Issued ${S.fmtDateShort(r.issue_date)}`);
      if (r.expiry_date) parts.push(`Expires ${S.fmtDateShort(r.expiry_date)}`);
      return parts.join(' · ');
    },

    scheduleLine: (r) => r.family_member ? `👤 ${r.family_member}` : null,

    crossModule: (r) => {
      const rows = [];
      if (r.file_size != null) rows.push(S.crossRow('Size', humanSize(r.file_size)));
      if (r.last_viewed_at) rows.push(S.crossRow('Last viewed', S.fmtDateShort(r.last_viewed_at)));
      if (r.linked_records_count != null) rows.push(S.crossRow('Linked', r.linked_records_count));
      return rows;
    },

    alert: (r) => {
      if (!r.expiry_date) return null;
      const days = S.daysFromToday(r.expiry_date);
      if (days == null || days > 60) return null;
      return {
        text: days < 0 ? `Expired ${Math.abs(days)}d ago` : `Expires in ${days}d`,
        metaText: r.category === 'Identity' || r.title?.toLowerCase().includes('passport')
          ? 'Renew before travel' : null,
        actionLabel: 'Renew',
        tone: days < 0 ? 'bad' : 'warn',
      };
    },

    linkedEntities: (r) => {
      const ents = [];
      if (r.issuer) ents.push(S.brandEntity(r.issuer, '#475569', r.issuer.slice(0, 2)));
      return ents;
    },

    drillDown: (r) => r.attachment_id ? ({
      label: 'View PDF',
      onClick: () => window.open(`/api/v1/attachments/${r.attachment_id}/file`, '_blank'),
    }) : null,
  });

  // ════════════════════════════════════════════════════════════════
  // INSURANCE POLICIES
  // ════════════════════════════════════════════════════════════════
  GH_CARD.register('insurance_policies', {
    mode: 'full',

    statusDot: (r) => {
      if (r.status === 'expired' || r.status === 'cancelled') return 'neutral';
      if (r.coverage_end_date) {
        const days = S.daysFromToday(r.coverage_end_date);
        const alertDays = r.alert_days_before || 60;
        if (days != null && days < 0) return 'bad';
        if (days != null && days <= alertDays) return 'warn';
      }
      return 'good';
    },

    statusRowChips: (r) => [
      r.policy_type ? { label: r.policy_type, icon: 'shield-check', tint: 'blue' } : null,
      r.status === 'active' ? { label: 'Active', icon: 'check', tint: 'green' } : null,
    ].filter(Boolean),

    hero: (r) => {
      const div = document.createElement('div');
      div.style.cssText = `width:100%;height:100%;display:flex;align-items:center;justify-content:center;background:${r.provider_brand_color || '#0a4abf'};color:#fff;border-radius:12px;font-size:14px;font-weight:700;text-align:center;padding:8px;`;
      div.textContent = r.provider_brand || r.provider_name || 'Insurer';
      return div;
    },

    title: (r) => r.provider_name || 'Insurance',
    subtitle: (r) => r.policy_type || '',

    metaLine: (r) => r.policy_number ? `Policy ${r.policy_number}` : null,

    scheduleLine: (r) => r.coverage_end_date
      ? `🛡️ Renews ${S.fmtDateShort(r.coverage_end_date)}`
      : null,

    crossModule: (r) => {
      const rows = [];
      if (r.premium_amount != null) {
        const freq = r.premium_frequency === 'annual' ? '/yr'
                   : r.premium_frequency === 'semi-annual' ? '/6mo'
                   : '/mo';
        rows.push(S.crossRow('Premium', S.money(r.premium_amount) + freq));
      }
      if (r.claims_ytd != null) rows.push(S.crossRow('Claims YTD', S.money(r.claims_ytd)));
      if (r.deductible != null) rows.push(S.crossRow('Deductible', S.money(r.deductible)));
      return rows;
    },

    alert: (r) => {
      if (!r.coverage_end_date) return null;
      const days = S.daysFromToday(r.coverage_end_date);
      const alertDays = r.alert_days_before || 60;
      if (days == null || days > alertDays) return null;
      return {
        text: days < 0 ? `Coverage lapsed ${Math.abs(days)}d ago` : `Renewal in ${days}d`,
        metaText: r.premium_amount ? `${S.money(r.premium_amount)} ${r.premium_frequency || 'annual'}` : null,
        actionLabel: 'Review renewal',
        tone: days < 0 ? 'bad' : 'warn',
      };
    },

    linkedEntities: (r) => {
      const ents = [];
      if (r.provider_brand) {
        ents.push(S.brandEntity(r.provider_brand, r.provider_brand_color || '#0a4abf',
          r.provider_brand.slice(0, 3)));
      }
      return ents;
    },

    drillDown: (r) => ({
      label: 'Policy details',
      onClick: () => S.openModuleFiltered('insurance', { id: r.id }),
    }),
  });

  // ════════════════════════════════════════════════════════════════
  // CAREER — JOBS
  // ════════════════════════════════════════════════════════════════
  GH_CARD.register('career_jobs', {
    mode: 'full',

    statusDot: (r) => {
      if (r.is_current || !r.end_date) return 'good';
      return 'neutral';
    },

    statusRowChips: (r) => [
      r.is_current ? { label: 'Current', icon: 'check', tint: 'green' } :
                     { label: 'Past', icon: 'check', tint: 'neutral' },
      r.employment_type ? { label: r.employment_type, icon: 'check', tint: 'blue' } : null,
    ].filter(Boolean),

    hero: (r) => {
      const div = document.createElement('div');
      div.style.cssText = `width:100%;height:100%;display:flex;align-items:center;justify-content:center;background:${r.company_brand_color || '#475569'};color:#fff;border-radius:12px;font-size:14px;font-weight:700;text-align:center;padding:8px;`;
      div.textContent = r.company || 'Employer';
      return div;
    },

    title: (r) => r.title || 'Position',
    subtitle: (r) => r.company || '',

    metaLine: (r) => {
      const parts = [];
      if (r.start_date) parts.push(`Started ${S.fmtDateShort(r.start_date)}`);
      if (r.end_date)   parts.push(`Ended ${S.fmtDateShort(r.end_date)}`);
      else if (r.is_current) parts.push('Current');
      return parts.join(' · ');
    },

    scheduleLine: (r) => r.location ? `📍 ${r.location}` : null,

    progressBar: (r) => {
      // Tenure bar — current position only, shows years in role
      if (!r.is_current || !r.start_date) return null;
      const days = -S.daysFromToday(r.start_date);
      if (days == null || days < 0) return null;
      const years = Math.floor(days / 365);
      const months = Math.floor((days % 365) / 30);
      // Treat 5y as a "milestone" — fill cap
      const pct = Math.min(100, Math.round((days / (5 * 365)) * 100));
      return {
        label: 'Tenure',
        fillPct: pct,
        valueText: years > 0 ? `${years}y ${months}mo` : `${months}mo`,
        tone: 'good',
      };
    },

    crossModule: (r) => {
      const rows = [];
      if (r.linked_certs_count != null) rows.push(S.crossRow('Linked certs', r.linked_certs_count));
      if (r.linked_ce_count != null) rows.push(S.crossRow('CE in role', r.linked_ce_count));
      if (r.review_due_at) rows.push(S.crossRow('Next review', S.fmtDateShort(r.review_due_at)));
      return rows;
    },

    alert: (r) => {
      if (r.is_current && r.review_due_at) {
        const days = S.daysFromToday(r.review_due_at);
        if (days != null && days <= 30) {
          return {
            text: days < 0 ? `Review overdue ${Math.abs(days)}d` : `Review in ${days}d`,
            metaText: 'Prepare talking points + update resume',
            actionLabel: 'Open prep notes',
            tone: days < 0 ? 'bad' : 'warn',
          };
        }
      }
      return null;
    },

    linkedEntities: (r) => {
      const ents = [];
      if (r.company) {
        ents.push(S.brandEntity(r.company, r.company_brand_color || '#475569', r.company.slice(0, 3)));
      }
      return ents;
    },

    drillDown: (r) => ({
      label: 'Notes',
      onClick: () => S.openModuleFiltered('career', { id: r.id, view: 'job_notes' }),
    }),
  });

  // ── Local helpers ───────────────────────────────────────────
  function parseJsonArr(s) {
    if (!s) return [];
    if (Array.isArray(s)) return s;
    try { const v = JSON.parse(s); return Array.isArray(v) ? v : []; } catch { return []; }
  }
  function cap(s) { return (s || '').replace(/^./, c => c.toUpperCase()); }
  function humanSize(b) {
    if (!b) return '0 B';
    const u = ['B','KB','MB','GB'];
    let i = 0;
    while (b >= 1024 && i < u.length - 1) { b /= 1024; i++; }
    return `${b.toFixed(b < 10 ? 1 : 0)} ${u[i]}`;
  }
  function photoHero(attId, fallbackText, fallbackColor) {
    const div = document.createElement('div');
    div.style.cssText = 'width:100%;height:100%;border-radius:12px;border:1px solid var(--gh-card-border,#e5e7eb);overflow:hidden;display:flex;align-items:center;justify-content:center;';
    if (attId) {
      div.style.background = `url(/api/v1/attachments/${attId}/thumb) center/cover`;
    } else {
      div.style.background = `linear-gradient(135deg, ${fallbackColor}, ${fallbackColor}99)`;
      div.style.color = '#fff';
      div.style.fontSize = '12px';
      div.style.fontWeight = '600';
      div.style.padding = '8px';
      div.style.textAlign = 'center';
      div.textContent = fallbackText || '';
    }
    return div;
  }

  console.log('[GH_CARD] batch2 configs registered: wardrobe, perfumes, properties, documents, insurance_policies, career_jobs');
})();
