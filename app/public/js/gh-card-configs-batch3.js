/**
 * gh-card-configs-batch3.js — Card configs for v202604.115.
 *
 * Four configs:
 *   • medical_conditions       — body-icon hero, treatment-line cross-module
 *   • medical_visits           — doctor-avatar hero, follow-up alerts
 *   • daily_log_entries        — compact mode, no tap-circle, tag chip
 *   • calendar_events          — compact mode, time-based, location chip
 *
 * Spec: CARDS_FINAL.md
 */
(function() {
  'use strict';
  if (!window.GH_CARD) {
    console.warn('[GH_CARD batch3] GH_CARD not loaded — skipping');
    return;
  }
  const S = window.GH_CARD_SHARED || {};

  // Map condition name → body-region icon. Falls back to 'heart' generically.
  // Add more mappings as the user's records grow; this is intentionally
  // small and string-pattern based (no body-icon library yet).
  const CONDITION_ICONS = {
    hypertension:        'heart',
    'high blood pressure':'heart',
    cholesterol:         'heart',
    cardiac:             'heart',
    heart:               'heart',
    diabetes:            'circle',
    asthma:              'circle',
    anxiety:             'brain',
    depression:          'brain',
    migraine:            'brain',
    headache:            'brain',
    arthritis:           'circle',
    back:                'circle',
    knee:                'circle',
    shoulder:            'circle',
  };

  function conditionIcon(name) {
    const lower = (name || '').toLowerCase();
    for (const key of Object.keys(CONDITION_ICONS)) {
      if (lower.includes(key)) return CONDITION_ICONS[key];
    }
    return 'heart';
  }

  function bodyIconHero(record) {
    const div = document.createElement('div');
    div.style.cssText = 'width:100%;height:100%;display:flex;align-items:center;justify-content:center;background:linear-gradient(135deg,#fbeaea,#f4c0c0);border-radius:12px;color:#9d2929;';
    const iconName = conditionIcon(record.condition_name || record.name);
    const icon = `<svg width="55%" height="55%" viewBox="0 0 256 256" fill="currentColor"><path d="M178,32c-20.65,0-38.73,8.88-50,23.89C116.73,40.88,98.65,32,78,32A62.07,62.07,0,0,0,16,94c0,70,103.79,126.66,108.21,129a8,8,0,0,0,7.58,0C136.21,220.66,240,164,240,94A62.07,62.07,0,0,0,178,32Z"/></svg>`;
    div.innerHTML = icon;
    return div;
  }

  function doctorAvatarHero(record) {
    const div = document.createElement('div');
    div.style.cssText = 'width:100%;height:100%;display:flex;align-items:center;justify-content:center;border-radius:12px;background:linear-gradient(135deg,#60a5fa,#2563eb);color:#fff;font-size:22px;font-weight:700;letter-spacing:-.02em;';
    if (record.doctor_avatar_attachment_id) {
      div.style.background = `url(/api/v1/attachments/${record.doctor_avatar_attachment_id}/thumb) center/cover`;
      div.textContent = '';
    } else {
      const name = record.physician_name || record.doctor_name || 'Dr';
      const parts = name.replace(/^Dr\.?\s*/i, '').trim().split(/\s+/);
      const initials = parts.length >= 2
        ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
        : (parts[0] || 'D').slice(0, 2).toUpperCase();
      div.textContent = initials;
    }
    return div;
  }

  // ════════════════════════════════════════════════════════════════
  // MEDICAL — CONDITIONS
  // ════════════════════════════════════════════════════════════════
  // NOTE: This is a "rich" full-mode card variant of medical conditions,
  // intended for dashboard or cross-module use. The medical.html page uses
  // a different compact-mode config in /js/gh-card-config-medical.js.
  // Distinct module IDs to prevent registration clash.
  GH_CARD.register('medical_conditions_rich', {
    mode: 'full',

    statusDot: (r) => {
      if (r.status === 'Resolved') return 'neutral';
      if (r.status === 'Active') return 'good';
      if (r.status === 'Worsening') return 'bad';
      return 'good';
    },

    statusRowChips: (r) => {
      const chips = [];
      if (r.status && r.status !== 'Active') {
        const tone = r.status === 'Resolved' ? 'green'
                  : r.status === 'Worsening' ? 'red' : 'amber';
        chips.push({ label: r.status, icon: 'check', tint: tone });
      }
      if (r.severity) chips.push({ label: r.severity, icon: 'check', tint: 'blue' });
      return chips;
    },

    categoryTag: (r) => r.body_system || '',

    hero: (r) => bodyIconHero(r),

    title: (r) => r.condition_name || r.name || 'Condition',
    subtitle: (r) => r.icd_code ? `ICD ${r.icd_code}` : '',

    metaLine: (r) => {
      const parts = [];
      if (r.start_date) parts.push(`Since ${S.fmtDateShort(r.start_date)}`);
      if (r.end_date)   parts.push(`Resolved ${S.fmtDateShort(r.end_date)}`);
      return parts.join(' · ');
    },

    scheduleLine: (r) => r.physician ? `🩺 ${r.physician}` : null,

    crossModule: (r) => {
      const rows = [];
      if (r.active_meds_count != null) rows.push(S.crossRow('Active meds', r.active_meds_count));
      if (r.open_todos_count != null)  rows.push(S.crossRow('Open todos', r.open_todos_count));
      if (r.related_visits_count != null) rows.push(S.crossRow('Visits', r.related_visits_count));
      return rows;
    },

    alert: (r) => {
      // Lab due / next checkup
      if (r.next_checkup_at) {
        const days = S.daysFromToday(r.next_checkup_at);
        if (days != null && days <= 30) {
          return {
            text: days < 0 ? `Checkup overdue ${Math.abs(days)}d` : `Checkup in ${days}d`,
            metaText: r.physician ? `${r.physician}` : null,
            actionLabel: 'Schedule',
            tone: days < 0 ? 'bad' : 'warn',
          };
        }
      }
      if (r.lab_due_at) {
        const days = S.daysFromToday(r.lab_due_at);
        if (days != null && days <= 30) {
          return {
            text: days < 0 ? `Lab overdue ${Math.abs(days)}d` : `Lab due in ${days}d`,
            actionLabel: 'Schedule lab',
            tone: days < 0 ? 'bad' : 'warn',
          };
        }
      }
      return null;
    },

    linkedEntities: (r) => {
      const ents = [];
      const fm = S.familyMemberEntity(r.family_member_id || r.patient_family_member_id);
      if (fm) ents.push(fm);
      if (r.physician) ents.push(S.brandEntity(r.physician, '#0284c7',
        r.physician.replace(/^Dr\.?\s*/i, '').slice(0, 2).toUpperCase()));
      return ents;
    },

    drillDown: (r) => ({
      label: 'Timeline',
      onClick: () => S.openModuleFiltered('medical', { condition_id: r.id, view: 'timeline' }),
    }),

    metaSuffix: (r) => r.attachment_count ? `📎 ${r.attachment_count}` : null,
  });

  // ════════════════════════════════════════════════════════════════
  // MEDICAL — VISIT NOTES
  // ════════════════════════════════════════════════════════════════
  // Same rationale as medical_conditions_rich — distinct ID from the
  // compact medical_notes config in gh-card-config-medical.js.
  GH_CARD.register('medical_visits_rich', {
    mode: 'full',

    statusDot: (r) => {
      if (r.follow_up_needed) {
        if (r.follow_up_date) {
          const days = S.daysFromToday(r.follow_up_date);
          if (days != null && days < 0) return 'bad';
          if (days != null && days <= 14) return 'warn';
        } else {
          return 'warn';
        }
      }
      return 'good';
    },

    statusRowChips: (r) => [
      r.specialty ? { label: r.specialty, icon: 'stethoscope', tint: 'blue' } : null,
      r.visit_type ? { label: r.visit_type, icon: 'check', tint: 'purple' } : null,
    ].filter(Boolean),

    hero: (r) => doctorAvatarHero(r),

    title: (r) => r.physician_name || r.doctor_name || 'Visit',
    subtitle: (r) => r.specialty || '',

    metaLine: (r) => r.visit_date ? `${S.fmtDateShort(r.visit_date)}` : null,

    scheduleLine: (r) => {
      if (r.follow_up_needed && r.follow_up_date) {
        return `🔔 Follow-up ${S.fmtDateShort(r.follow_up_date)}`;
      }
      if (r.follow_up_needed) return '🔔 Follow-up needed';
      return null;
    },

    crossModule: (r) => {
      const rows = [];
      if (r.visit_cost != null) rows.push(S.crossRow('Cost', S.money(r.visit_cost)));
      if (r.hsa_paid != null) rows.push(S.crossRow('HSA paid', S.money(r.hsa_paid)));
      if (r.attachment_count != null) rows.push(S.crossRow('Attachments', r.attachment_count));
      return rows;
    },

    alert: (r) => {
      if (!r.follow_up_needed) return null;
      if (r.follow_up_date) {
        const days = S.daysFromToday(r.follow_up_date);
        if (days != null && days <= 14) {
          return {
            text: days < 0 ? `Follow-up overdue ${Math.abs(days)}d` : `Follow-up in ${days}d`,
            metaText: r.physician_name ? `${r.physician_name}` : null,
            actionLabel: 'Schedule follow-up',
            tone: days < 0 ? 'bad' : 'warn',
          };
        }
      } else {
        return {
          text: 'Follow-up needed (date TBD)',
          metaText: r.physician_name ? `${r.physician_name}` : null,
          actionLabel: 'Schedule follow-up',
          tone: 'warn',
        };
      }
      return null;
    },

    linkedEntities: (r) => {
      const ents = [];
      const fm = S.familyMemberEntity(r.family_member_id || r.patient_family_member_id);
      if (fm) ents.push(fm);
      if (r.physician_name) ents.push(S.brandEntity(r.physician_name, '#0284c7',
        r.physician_name.replace(/^Dr\.?\s*/i, '').slice(0, 2).toUpperCase()));
      return ents;
    },

    drillDown: (r) => ({
      label: 'Visit notes',
      onClick: () => S.openModuleFiltered('medical', { visit_id: r.id, view: 'notes' }),
    }),

    metaSuffix: (r) => r.attachment_count ? `📎 ${r.attachment_count}` : null,
  });

  // ════════════════════════════════════════════════════════════════
  // DAILY LOG ENTRIES (compact)
  // ════════════════════════════════════════════════════════════════
  GH_CARD.register('daily_log_entries', {
    mode: 'compact',

    isDone: () => false,  // log entries can't be completed

    urgency: (r) => {
      if (r.has_action_item) return 'high';
      return 'normal';
    },

    title: (r) => {
      const text = r.entry_text || r.text || '';
      return text.length > 80 ? text.slice(0, 80) + '…' : text || 'Log entry';
    },

    compactMeta: (r) => {
      const items = [];
      if (r.entry_time) items.push(r.entry_time);
      else if (r.created_at) items.push(S.fmtDateShort(r.created_at));
      if (r.tags && r.tags.length) items.push(r.tags[0]);
      if (r.linked_module) items.push(`→ ${r.linked_module}`);
      if (r.has_action_item) items.push({ icon: 'circle', text: 'Action flagged', urgent: true, iconColor: '#d97706' });
      return items;
    },

    onClick: (r) => {
      if (window.openLogEntry) window.openLogEntry(r.id);
    },

    onEdit: (r) => {
      if (window.editLogEntry) window.editLogEntry(r.id);
    },

    onDelete: (r) => {
      if (window.deleteLogEntry) window.deleteLogEntry(r.id);
    },

    linkedEntities: (r) => {
      const fm = S.familyMemberEntity(r.author_family_member_id);
      return fm ? [fm] : [];
    },
  });

  // ════════════════════════════════════════════════════════════════
  // CALENDAR EVENTS (compact)
  // ════════════════════════════════════════════════════════════════
  GH_CARD.register('calendar_events', {
    mode: 'compact',

    isDone: (r) => r.status === 'completed' || r.status === 'attended',

    urgency: (r) => {
      if (!r.start_at) return 'normal';
      const days = S.daysFromToday(r.start_at);
      if (days == null) return 'normal';
      if (days < 0) return 'done';
      if (days === 0) return 'urgent';  // today
      if (days <= 3) return 'high';
      return 'normal';
    },

    title: (r) => r.title || r.summary || 'Event',

    compactMeta: (r) => {
      const items = [];
      if (r.start_at) {
        const days = S.daysFromToday(r.start_at);
        if (days === 0) items.push({ icon: 'circle', text: 'Today', urgent: true, iconColor: '#d97706' });
        else if (days === 1) items.push('Tomorrow');
        else if (days != null && days > 0 && days <= 7) items.push(`In ${days} days`);
        else items.push(S.fmtDateShort(r.start_at));
      }
      if (r.start_time) items.push(r.start_time);
      if (r.location) items.push(r.location);
      if (r.attendee_count) items.push(`${r.attendee_count} attending`);
      return items;
    },

    onClick: (r) => {
      if (window.openCalendarEvent) window.openCalendarEvent(r.id);
    },

    onEdit: (r) => {
      if (window.editCalendarEvent) window.editCalendarEvent(r.id);
    },

    onDelete: (r) => {
      if (window.deleteCalendarEvent) window.deleteCalendarEvent(r.id);
    },

    linkedEntities: (r) => {
      const ents = [];
      if (r.organizer_family_member_id) {
        const fm = S.familyMemberEntity(r.organizer_family_member_id);
        if (fm) ents.push(fm);
      }
      return ents;
    },
  });

  console.log('[GH_CARD] batch3 configs registered: medical_conditions_rich, medical_visits_rich, daily_log_entries, calendar_events');
})();
