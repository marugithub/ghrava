/**
 * gh-card-config-medical.js — Card config for the medical module.
 *
 * Wired to the shared GH_CARD renderer (gh-card.js).
 * Activated only when ?cards=v2 query param is set, until the flag is flipped.
 *
 * Three record kinds: medications, conditions, visit notes. Each registers
 * under a distinct moduleId.
 *
 * See spec/CARD_SPEC.md for the design rationale.
 */
(function() {
  'use strict';
  if (!window.GH_CARD) {
    console.warn('[medical config] GH_CARD not loaded — skipping registration');
    return;
  }

  // ── Helpers ────────────────────────────────────────────────────
  function fmtDate(s) {
    if (!s) return '';
    try {
      const d = new Date(s);
      if (isNaN(d.getTime())) return s;
      return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    } catch { return s; }
  }

  function statusFor(r) {
    if (r.status === 'Active') return 'good';
    if (r.status === 'Paused' || r.status === 'On Hold') return 'warn';
    if (r.status === 'Discontinued' || r.status === 'Resolved') return 'neutral';
    return 'neutral';
  }

  function patientEntity(patientName) {
    if (!patientName) return null;
    const fm = (window.familyMembers || []).find(m => m.display_name === patientName);
    if (!fm) {
      // Show as plain initials chip if not found in family
      return {
        id: 'patient:' + patientName,
        type: 'patient',
        name: patientName,
        photoUrl: null,
      };
    }
    return {
      id: 'fm:' + fm.id,
      type: 'family_member',
      name: fm.display_name || ((fm.first_name || '') + ' ' + (fm.last_name || '')).trim(),
      photoUrl: fm.avatar_attachment_id ? `/api/v1/attachments/${fm.avatar_attachment_id}/thumb` : null,
    };
  }

  // ── Medications ────────────────────────────────────────────────
  GH_CARD.register('medical_medications', {
    mode: 'compact',

    isDone: (r) => r.status === 'Discontinued',

    title: (r) => r.name || '(unnamed medication)',

    compactMeta: (r) => {
      const items = [];
      if (r.dosage) items.push(r.dosage);
      if (r.frequency) items.push(r.frequency);
      if (r.refills_remaining === 0) {
        items.push({
          icon: 'warning',
          iconColor: '#dc2626',
          text: 'No refills',
          urgent: true,
        });
      } else if (r.refills_remaining === 1) {
        items.push({
          icon: 'warning',
          iconColor: '#d97706',
          text: '1 refill left',
        });
      }
      if (r.physician) items.push('Dr. ' + r.physician);
      if (r.purpose) items.push(r.purpose);
      return items;
    },

    statusFor,

    linkedEntities: (r) => {
      const patient = patientEntity(r.patient);
      return patient ? [patient] : [];
    },

    tags: (r) => r.tags || [],

    onClick: (r) => {
      const fn = window.editMedication;
      if (fn) fn(r.id);
    },

    onMenu: (r) => {
      const fn = window.editMedication;
      if (fn) fn(r.id);
    },

    // Group by patient (matches the legacy section grouping)
    groupBy: (r) => ({
      key: 'pat:' + (r.patient || 'unknown'),
      label: r.patient || 'Unassigned',
      color: 'var(--gh-brand)',
    }),
  });

  // ── Conditions ─────────────────────────────────────────────────
  GH_CARD.register('medical_conditions', {
    mode: 'compact',

    isDone: (r) => r.status === 'Resolved',

    title: (r) => r.condition_name || '(unnamed condition)',

    compactMeta: (r) => {
      const items = [];
      if (r.status && r.status !== 'Active') items.push(r.status);
      if (r.physician) items.push(r.physician);
      if (r.start_date) items.push('Since ' + fmtDate(r.start_date));
      if (r.end_date) items.push('Resolved ' + fmtDate(r.end_date));
      return items;
    },

    statusFor,

    linkedEntities: (r) => {
      const patient = patientEntity(r.patient);
      return patient ? [patient] : [];
    },

    tags: (r) => r.tags || [],

    onClick: (r) => {
      const fn = window.editCondition;
      if (fn) fn(r.id);
    },

    onMenu: (r) => {
      const fn = window.editCondition;
      if (fn) fn(r.id);
    },

    groupBy: (r) => ({
      key: 'pat:' + (r.patient || 'unknown'),
      label: r.patient || 'Unassigned',
      color: 'var(--gh-brand)',
    }),
  });

  // ── Visit Notes ────────────────────────────────────────────────
  GH_CARD.register('medical_notes', {
    mode: 'compact',

    title: (r) => r.physician_name || 'Visit Note',

    compactMeta: (r) => {
      const items = [];
      if (r.visit_date) items.push(fmtDate(r.visit_date));
      if (r.specialty) items.push(r.specialty);
      if (r.follow_up_needed && r.follow_up_date) {
        items.push({
          icon: 'clock',
          iconColor: '#d97706',
          text: 'Follow-up ' + fmtDate(r.follow_up_date),
        });
      } else if (r.follow_up_needed) {
        items.push({
          icon: 'clock',
          iconColor: '#d97706',
          text: 'Follow-up needed',
        });
      }
      return items;
    },

    statusFor: (r) => r.follow_up_needed ? 'warn' : 'neutral',

    linkedEntities: (r) => {
      const patient = patientEntity(r.patient);
      return patient ? [patient] : [];
    },

    tags: (r) => r.tags || [],

    onClick: (r) => {
      const fn = window.editNote;
      if (fn) fn(r.id);
    },

    onMenu: (r) => {
      const fn = window.editNote;
      if (fn) fn(r.id);
    },

    groupBy: (r) => ({
      key: 'pat:' + (r.patient || 'unknown'),
      label: r.patient || 'Unassigned',
      color: 'var(--gh-brand)',
    }),
  });

  console.log('[GH_CARD] medical configs registered (medications, conditions, notes)');
})();
