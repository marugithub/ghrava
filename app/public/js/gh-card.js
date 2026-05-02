/**
 * GH_CARD — shared card renderer.
 *
 * One render path for every module's cards. Takes a record + a module
 * config and returns DOM. Module configs live in their own files (e.g.
 * gh-card-config-todos.js) and register themselves with GH_CARD.
 *
 * See CARD_SPEC.md (in spec/) for full design rationale.
 *
 * Usage:
 *   GH_CARD.register('todos', { mode: 'compact', ... });
 *   const el = GH_CARD.render('todos', record);
 *   container.appendChild(el);
 *
 * Avatar fallback chain (per spec):
 *   1. If photo/logo uploaded → use it
 *   2. Else brand-color background + brand initials
 *   3. Else initials on a generated gradient (hashed by ID)
 */
(function() {
  'use strict';

  const PHOSPHOR_BASE = '/assets/icons/phosphor/duotone/';
  // Fallback to shared-resources mount once we wire that up
  // const PHOSPHOR_SHARED = '/shared-resources/icons/phosphor/duotone/';

  const TINT_NAMES = ['purple', 'amber', 'red', 'blue', 'green', 'pink', 'teal'];
  const STATUS_NAMES = ['good', 'warn', 'bad', 'neutral'];

  // Stable color generator for entity avatars without photos.
  // Takes any string (entity id), returns a {from, to} gradient.
  const AVATAR_GRADIENTS = [
    { from: '#f472b6', to: '#db2777' },  // pink
    { from: '#34d399', to: '#047857' },  // green
    { from: '#60a5fa', to: '#2563eb' },  // blue
    { from: '#fbbf24', to: '#d97706' },  // amber
    { from: '#a78bfa', to: '#7c3aed' },  // purple
    { from: '#fb7185', to: '#be123c' },  // rose
    { from: '#22d3ee', to: '#0891b2' },  // cyan
    { from: '#facc15', to: '#a16207' },  // yellow
  ];

  function hashStr(s) {
    let h = 0;
    for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0;
    return Math.abs(h);
  }

  function gradientFor(seed) {
    return AVATAR_GRADIENTS[hashStr(String(seed)) % AVATAR_GRADIENTS.length];
  }

  function initialsOf(text, count = 2) {
    if (!text) return '?';
    const parts = String(text).trim().split(/\s+/).filter(Boolean);
    if (!parts.length) return '?';
    if (parts.length === 1) return parts[0].slice(0, count).toUpperCase();
    return parts.slice(0, count).map(p => p[0]).join('').toUpperCase();
  }

  // ── DOM helpers ────────────────────────────────────────────────
  function el(tag, attrs = {}, children = []) {
    const node = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (v == null || v === false) continue;
      if (k === 'class') node.className = v;
      else if (k === 'style' && typeof v === 'object') Object.assign(node.style, v);
      else if (k === 'dataset') Object.assign(node.dataset, v);
      else if (k.startsWith('on') && typeof v === 'function') node.addEventListener(k.slice(2), v);
      else if (k === 'html') node.innerHTML = v;
      else node.setAttribute(k, v);
    }
    for (const child of [].concat(children)) {
      if (child == null || child === false) continue;
      if (typeof child === 'string') node.appendChild(document.createTextNode(child));
      else node.appendChild(child);
    }
    return node;
  }

  function phosphorIcon(name, size = 18) {
    const img = el('img', {
      src: PHOSPHOR_BASE + name + '-duotone.svg',
      alt: '',
      width: size,
      height: size,
      style: { width: '100%', height: '100%', display: 'block' },
    });
    img.addEventListener('error', () => {
      // Graceful fallback: render an empty span so layout doesn't collapse
      img.style.visibility = 'hidden';
    });
    return img;
  }

  // ── Public API ─────────────────────────────────────────────────
  const _configs = {};

  function register(moduleId, config) {
    _configs[moduleId] = config;
  }

  function render(moduleId, record, overrides) {
    const baseConfig = _configs[moduleId];
    if (!baseConfig) {
      console.warn(`[GH_CARD] No config registered for "${moduleId}"`);
      return el('div', { class: 'gh-card', style: { padding: '16px', color: 'red' } },
        `Missing card config: ${moduleId}`);
    }
    // Per-call overrides (e.g. per-page onClick from GH_MOUNT) merge in front
    // of the base config without mutating it. Pages that mount multiple
    // modules with different drawer functions don't stomp each other.
    const config = overrides ? { ...baseConfig, ...overrides } : baseConfig;
    const ctx = { record, config, moduleId };
    // A throw inside any one config function (bad date, missing FK, etc.)
    // should fail just that record, not break the whole list. Replace the
    // broken card with a minimal placeholder so the user can still see and
    // open the record. Real fix happens in the config or the data.
    try {
      return config.mode === 'compact' ? renderCompact(ctx) : renderFull(ctx);
    } catch (e) {
      console.error(`[GH_CARD] render failed for ${moduleId}#${record && record.id}:`, e);
      return el('div', {
        class: 'gh-card gh-card--error',
        dataset: { module: moduleId, recordId: record && record.id },
        style: { padding: '16px', cursor: config.onClick ? 'pointer' : 'default',
                 border: '1px dashed var(--gh-status-bad,#dc2626)' },
        onclick: config.onClick ? (e) => config.onClick(record, e) : null,
      }, [
        el('div', { style: { fontSize: '12px', color: 'var(--text3,#94a3b8)' } },
          `${moduleId} #${record && record.id || '?'}`),
        el('div', { style: { fontWeight: 600, marginTop: '4px' } },
          (record && (record.name || record.title || record.condition_name)) || 'Record'),
        el('div', { style: { fontSize: '11px', color: 'var(--gh-status-bad,#dc2626)', marginTop: '6px' } },
          'Card render error — tap to open record'),
      ]);
    }
  }

  // ── Compact-mode renderer (todos, dense lists) ─────────────────
  function renderCompact(ctx) {
    const { record, config } = ctx;
    const isDone = config.isDone ? config.isDone(record) : false;
    const urgency = config.urgency ? config.urgency(record) : (isDone ? 'done' : 'normal');

    const tapCircle = el('button', {
      class: 'gh-tap-circle' + (isDone ? ' gh-tap-circle--done' : ''),
      title: isDone ? 'Mark incomplete' : 'Mark complete',
      onclick: (e) => {
        e.stopPropagation();
        if (config.onToggle) config.onToggle(record);
      },
    }, el('span', { class: 'gh-tap-circle__svg' },
      phosphorIcon(isDone ? 'check-circle' : 'circle', 26)
    ));

    const title = el('div', {
      class: 'gh-compact-title' + (isDone ? ' gh-compact-title--done' : '')
    }, config.title ? config.title(record) : (record.title || record.name || ''));

    const metaItems = (config.compactMeta ? (config.compactMeta(record) || []) : []).filter(Boolean);
    const metaRow = el('div', { class: 'gh-compact-meta' }, metaItems.flatMap((m, i) => {
      const items = [];
      if (i > 0) items.push(el('span', { class: 'gh-compact-meta__divider' }, '·'));
      if (typeof m === 'string') {
        items.push(el('span', {}, m));
      } else if (m.icon) {
        const span = el('span', { class: m.urgent ? 'gh-compact-meta__urgent' : '' }, [
          el('span', { class: 'gh-compact-meta__icon', style: { color: m.iconColor || 'currentColor' } },
            phosphorIcon(m.icon, 12)),
          ' ',
          m.text,
        ]);
        items.push(span);
      } else {
        items.push(el('span', { class: m.urgent ? 'gh-compact-meta__urgent' : '' }, m.text));
      }
      return items;
    }));

    const middle = el('div', { class: 'gh-card__spacer' }, [title, metaRow]);

    const right = [];
    const entities = (config.linkedEntities ? (config.linkedEntities(record) || []) : []).filter(Boolean);
    if (entities.length) right.push(renderEntity(entities[0], 'sm'));

    const actions = renderActionCluster(record, config);
    if (actions) right.push(actions);

    return el('div', {
      class: `gh-card gh-card--compact gh-card--u-${urgency}`,
      dataset: { module: ctx.moduleId, recordId: record.id, state: isDone ? 'completed' : 'active' },
      tabindex: config.onClick ? '0' : null,
      role:     config.onClick ? 'button' : null,
      'aria-label': config.onClick
        ? ((config.title ? config.title(record) : (record.title || record.name || 'item')) + (isDone ? ' (completed)' : ''))
        : null,
      onclick: () => config.onClick && config.onClick(record),
      onkeydown: config.onClick ? (e) => {
        if ((e.key === 'Enter' || e.key === ' ') && e.target === e.currentTarget) {
          e.preventDefault();
          config.onClick(record);
        }
      } : null,
    }, el('div', { class: 'gh-card__row' }, [tapCircle, middle, ...right]));
  }

  // ── Action cluster — direct icons (edit / archive / delete) ──────
  // Replaces the overflow ⋯ menu when config provides handlers.
  // Hover-revealed on PC; subtly always-visible on mobile via CSS.
  function renderActionCluster(record, config) {
    const acts = [];
    if (config.onEdit) {
      acts.push({ icon: 'pencil-simple', title: 'Edit',
        onClick: (e) => { e.stopPropagation(); config.onEdit(record); } });
    }
    if (config.onArchive) {
      acts.push({ icon: 'archive-box', title: 'Archive',
        onClick: (e) => { e.stopPropagation(); config.onArchive(record); } });
    }
    if (config.onDelete) {
      acts.push({ icon: 'trash', title: 'Delete', danger: true,
        onClick: (e) => { e.stopPropagation(); config.onDelete(record); } });
    }
    if (!acts.length) {
      // Fallback to the legacy ⋯ menu so existing onMenu handlers keep working
      if (config.onMenu) return renderMenuButton(record, config);
      return null;
    }
    return el('div', { class: 'gh-card-actions' }, acts.map(a =>
      el('button', {
        class: 'gh-card-action' + (a.danger ? ' gh-card-action--danger' : ''),
        title: a.title,
        onclick: a.onClick,
      }, el('span', { class: 'gh-card-action__svg' }, phosphorIcon(a.icon, 16)))
    ));
  }

  // ── Full-mode renderer (medications, inventory, etc) ───────────
  function renderFull(ctx) {
    const { record, config } = ctx;
    const card = el('div', {
      class: 'gh-card',
      dataset: { module: ctx.moduleId, recordId: record.id },
      // Keyboard activation: when card has an onClick, make it focusable and
      // respond to Enter/Space. Mirrors the click handler — internal controls
      // already stopPropagation on click; for keyboard we only listen on the
      // outer card so inner buttons keep their native focus + activation.
      tabindex: config.onClick ? '0' : null,
      role:     config.onClick ? 'button' : null,
      'aria-label': config.onClick ? (config.title ? config.title(record) : 'Open record') : null,
      onclick: (e) => {
        if (config.onClick) config.onClick(record, e);
      },
      onkeydown: config.onClick ? (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          // Only fire when the card itself is focused (not a child button)
          if (e.target === e.currentTarget) {
            e.preventDefault();
            config.onClick(record, e);
          }
        }
      } : null,
    });
    if (config.onClick) card.style.cursor = 'pointer';

    card.appendChild(renderStatusRow(ctx));
    card.appendChild(renderIdentity(ctx));

    // v5: Cross-module strip — between identity and alert. 3 numbers, dashed top border.
    // Hidden when config.crossModule is missing or returns no rows.
    const cross = renderCrossModule(ctx);
    if (cross) card.appendChild(cross);

    const alert = renderAlert(ctx);
    if (alert) card.appendChild(alert);

    card.appendChild(renderEntities(ctx));
    return card;
  }

  // v5: Cross-module strip — declarative. config.crossModule(record) returns
  //   [{ label, value, asterisk: 'red'|'amber'|null, onClick, tooltip }, ...]
  // Hidden if returns falsy/empty. Asterisk pattern from TRANSACTION_LINKING_SPEC.md.
  function renderCrossModule(ctx) {
    const { record, config } = ctx;
    if (!config.crossModule) return null;
    const rows = (config.crossModule(record) || []).filter(Boolean);
    if (!rows.length) return null;

    const items = rows.map(r => {
      const inner = [
        el('span', { class: 'gh-cross__label' }, r.label || ''),
        document.createTextNode(' '),
        el('strong', {}, r.value == null ? '—' : String(r.value)),
      ];
      if (r.asterisk) {
        const aClass = r.asterisk === 'red' ? 'gh-cross__ast gh-cross__ast--red'
                     : r.asterisk === 'amber' ? 'gh-cross__ast gh-cross__ast--amber'
                     : 'gh-cross__ast';
        inner.push(el('span', {
          class: aClass,
          title: r.asteriskTooltip || 'This figure may be incomplete. Tap to review.',
        }, '*'));
      }
      const node = el('span', {
        class: r.onClick ? 'gh-cross__item gh-cross__item--clickable' : 'gh-cross__item',
        title: r.tooltip || '',
        onclick: r.onClick ? (e) => { e.stopPropagation(); r.onClick(record); } : null,
      }, inner);
      return node;
    });

    return el('div', { class: 'gh-card__cross' }, items);
  }

  // ── Zone 1 ─────────────────────────────────────────────────────
  function renderStatusRow(ctx) {
    const { record, config } = ctx;
    const status = config.statusDot ? config.statusDot(record) : 'neutral';
    const safeStatus = STATUS_NAMES.includes(status) ? status : 'neutral';

    const children = [el('div', { class: `gh-status-dot gh-status-dot--${safeStatus}` })];

    // v5: multiple chips supported via statusRowChips (returns array).
    // Falls back to single categoryChip for back-compat.
    if (config.statusRowChips) {
      const chips = (config.statusRowChips(record) || []).filter(Boolean);
      for (const chip of chips) children.push(renderCatChip(chip));
    } else if (config.categoryChip) {
      const chip = config.categoryChip(record);
      if (chip) children.push(renderCatChip(chip));
    }
    if (config.categoryTag) {
      const tag = config.categoryTag(record);
      if (tag) children.push(el('span', { class: 'gh-cat-tag' }, tag));
    }

    children.push(el('div', { class: 'gh-card__spacer' }));
    children.push(renderPinButton(record, config));
    children.push(renderMenuButton(record, config));

    return el('div', { class: 'gh-card__status-row' }, children);
  }

  function renderCatChip(chip) {
    const tint = TINT_NAMES.includes(chip.tint) ? chip.tint : 'blue';
    const inner = [];
    if (chip.icon) {
      inner.push(el('span', { class: 'gh-cat-chip__icon' }, phosphorIcon(chip.icon, 14)));
    }
    inner.push(el('span', {}, chip.label || ''));
    return el('button', {
      class: `gh-cat-chip gh-cat-chip--${tint}`,
      title: chip.tooltip || chip.label,
      onclick: chip.onClick ? (e) => { e.stopPropagation(); chip.onClick(); } : null,
    }, inner);
  }

  function renderPinButton(record, config) {
    const isPinned = config.isPinned ? config.isPinned(record) : false;
    return el('button', {
      class: 'gh-icon-tap',
      title: isPinned ? 'Unpin' : 'Pin',
      style: isPinned ? { color: '#f59e0b' } : null,
      onclick: (e) => {
        e.stopPropagation();
        if (config.onPin) config.onPin(record);
      },
    }, el('span', { class: 'gh-icon-tap__svg' },
      phosphorIcon(isPinned ? 'push-pin' : 'push-pin', 18)
    ));
  }

  function renderMenuButton(record, config) {
    return el('button', {
      class: 'gh-icon-tap',
      title: 'More',
      onclick: (e) => {
        e.stopPropagation();
        if (config.onMenu) config.onMenu(record, e);
      },
    }, el('span', { class: 'gh-icon-tap__svg' }, phosphorIcon('dots-three', 18)));
  }

  // ── Zone 2 ─────────────────────────────────────────────────────
  function renderIdentity(ctx) {
    const { record, config } = ctx;

    const hero = el('div', { class: 'gh-card__hero' });
    if (config.hero) {
      const h = config.hero(record);
      if (h instanceof Node) hero.appendChild(h);
      else if (typeof h === 'string') hero.innerHTML = h;
    }

    const titleRow = [];
    titleRow.push(el('div', { class: 'gh-card__title' },
      config.title ? config.title(record) : (record.name || record.title || '')));

    if (config.subtitle) {
      const sub = config.subtitle(record);
      if (sub) titleRow.push(el('div', { class: 'gh-card__subtitle' }, sub));
    }

    titleRow.push(el('div', { class: 'gh-card__spacer' }));

    if (config.badge) {
      const b = config.badge(record);
      if (b) {
        const tone = STATUS_NAMES.includes(b.tone) ? b.tone : 'good';
        titleRow.push(el('span', { class: `gh-badge gh-badge--${tone}` }, b.label));
      }
    }

    if (config.instructionIcons) {
      const icons = (config.instructionIcons(record) || []).filter(Boolean);
      for (const ic of icons) {
        const tint = TINT_NAMES.includes(ic.tint) ? ic.tint : 'blue';
        titleRow.push(el('button', {
          class: `gh-instr gh-instr--${tint}`,
          title: ic.tip || ic.icon,
          onclick: ic.onClick ? (e) => { e.stopPropagation(); ic.onClick(); } : null,
        }, el('span', { class: 'gh-instr__svg' }, phosphorIcon(ic.icon, 18))));
      }
    }

    const titleBlock = [el('div', { class: 'gh-card__title-row' }, titleRow)];

    if (config.metaLine) {
      const meta = config.metaLine(record);
      if (meta) titleBlock.push(el('div', { class: 'gh-card__meta' }, meta));
    }
    if (config.scheduleLine) {
      const sched = config.scheduleLine(record);
      if (sched) titleBlock.push(el('div', { class: 'gh-card__schedule' }, sched));
    }

    if (config.factChips) {
      const facts = config.factChips(record).filter(Boolean);
      if (facts.length) {
        const factRow = el('div', { class: 'gh-fact-row' });
        for (const f of facts) {
          const factEl = el('span', { class: 'gh-fact' });
          if (f.icon) {
            factEl.appendChild(el('span',
              { class: 'gh-fact__icon', style: { color: f.iconColor || 'inherit' } },
              phosphorIcon(f.icon, 12)));
          }
          factEl.appendChild(document.createTextNode(f.text));
          factRow.appendChild(factEl);
        }
        titleBlock.push(factRow);
      }
    }

    // v5: Progress bar (CEU/PDU, odometer, contribution capacity, reading progress).
    // config.progressBar(record) returns { label, fillPct (0-100), valueText, tone, tooltip }
    if (config.progressBar) {
      const p = config.progressBar(record);
      if (p && p.fillPct != null) {
        const tone = STATUS_NAMES.includes(p.tone) ? p.tone : 'good';
        const bar = el('div', { class: 'gh-progress', title: p.tooltip || '' }, [
          p.label ? el('span', { class: 'gh-progress__label' }, p.label) : null,
          el('div', { class: 'gh-progress__bar' },
            el('div', {
              class: `gh-progress__fill gh-progress__fill--${tone}`,
              style: { width: Math.max(0, Math.min(100, p.fillPct)) + '%' },
            })),
          p.valueText ? el('span', { class: 'gh-progress__value' }, p.valueText) : null,
        ].filter(Boolean));
        titleBlock.push(bar);
      }
    }

    return el('div', { class: 'gh-card__identity' }, [
      hero,
      el('div', { class: 'gh-card__title-block' }, titleBlock),
    ]);
  }

  // ── Zone 3 ─────────────────────────────────────────────────────
  function renderAlert(ctx) {
    const { record, config } = ctx;
    if (!config.alert) return null;
    const a = config.alert(record);
    if (!a || a.visible === false) return null;

    const tone = STATUS_NAMES.includes(a.tone) ? a.tone : 'warn';
    const toneClass = tone === 'good' ? 'gh-card__alert--good'
                    : tone === 'bad'  ? 'gh-card__alert--bad'
                    : '';

    const topRow = [
      el('div', { class: 'gh-card__alert-text' }, a.text || ''),
    ];
    if (a.metaText) topRow.push(el('div', { class: 'gh-card__alert-meta' }, a.metaText));
    topRow.push(el('div', { class: 'gh-card__spacer' }));
    if (a.actionLabel) {
      const btnClass = a.actionTone === 'amber' ? 'gh-btn gh-btn--amber'
                     : a.actionTone === 'red'   ? 'gh-btn gh-btn--red'
                     : 'gh-btn';
      topRow.push(el('button', {
        class: btnClass,
        onclick: (e) => {
          e.stopPropagation();
          if (a.onAction) a.onAction(record);
        },
      }, a.actionLabel));
    }

    const rows = [el('div', { class: 'gh-card__alert-row' }, topRow)];

    // v5: Stacked secondary alerts (vehicle: registration + insurance under primary).
    // a.secondaries: array of { icon, text, label } — each renders as a sub-row,
    // separated by dashed border within the alert panel.
    if (Array.isArray(a.secondaries) && a.secondaries.length) {
      const stack = el('div', { class: 'gh-card__alert-stack' });
      for (const s of a.secondaries) {
        const subRow = el('div', { class: 'gh-card__alert-substack-row' }, [
          s.icon ? el('span', { class: 'gh-card__alert-substack-icon' },
            phosphorIcon(s.icon, 14)) : null,
          el('span', {}, s.text || ''),
          el('div', { class: 'gh-card__spacer' }),
          s.label ? el('span', { class: 'gh-card__alert-meta' }, s.label) : null,
        ].filter(Boolean));
        stack.appendChild(subRow);
      }
      rows.push(stack);
    }

    if (a.subText || a.subTextMono) {
      const subRow = el('div', { class: 'gh-card__alert-row' });
      if (a.subText) subRow.appendChild(el('span', { class: 'gh-card__alert-meta' }, a.subText));
      if (a.subTextMono) {
        if (a.subText) subRow.appendChild(el('span', { class: 'gh-compact-meta__divider' }, '·'));
        subRow.appendChild(el('span', { class: 'gh-card__alert-meta gh-card__alert-meta--mono' }, a.subTextMono));
      }
      rows.push(subRow);
    }

    return el('div', { class: `gh-card__alert ${toneClass}` }, rows);
  }

  // ── Zone 4 ─────────────────────────────────────────────────────
  function renderEntities(ctx) {
    const { record, config } = ctx;
    const children = [];
    if (config.linkedEntities) {
      const raw = config.linkedEntities(record);
      const entities = Array.isArray(raw) ? raw.filter(Boolean) : [];
      for (const e of entities) children.push(renderEntity(e));
    }
    children.push(el('div', { class: 'gh-card__spacer' }));

    if (config.metaSuffix) {
      const m = config.metaSuffix(record);
      if (m) children.push(el('span', { class: 'gh-card__alert-meta' }, m));
    }

    if (config.drillDown) {
      const d = typeof config.drillDown === 'function' ? config.drillDown(record) : config.drillDown;
      if (d) {
        const link = el('button', {
          class: 'gh-drill-link',
          title: d.tooltip || d.label,
          onclick: (e) => { e.stopPropagation(); if (d.onClick) d.onClick(record); },
        }, [
          el('span', {}, d.label || 'Open'),
          el('span', { class: 'gh-drill-link__chev', html:
            '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" fill="currentColor"><path d="M184,128a8,8,0,0,1-2.34,5.66l-80,80a8,8,0,0,1-11.32-11.32L164.69,128,90.34,53.66A8,8,0,0,1,101.66,42.34l80,80A8,8,0,0,1,184,128Z"/></svg>'
          }),
        ]);
        children.push(link);
      }
    }

    return el('div', { class: 'gh-card__entities' }, children);
  }

  function renderEntity(entity, size = 'md') {
    // entity = { id, type, name, photoUrl, brandColor, brandInitials, onClick }
    const sizeClass = size === 'sm' ? ' gh-entity--sm' : '';
    const brandClass = entity.brandInitials && entity.brandInitials.length === 3 ? ' gh-entity--brand-3' : '';
    const node = el('button', {
      class: `gh-entity${sizeClass}${brandClass}`,
      title: entity.name || '',
      onclick: entity.onClick ? (e) => { e.stopPropagation(); entity.onClick(); } : null,
    });

    if (entity.photoUrl) {
      node.appendChild(el('img', { src: entity.photoUrl, alt: entity.name || '' }));
    } else if (entity.brandColor) {
      // Brand mark — solid color background, brand initials in white
      node.style.background = entity.brandColor;
      node.appendChild(document.createTextNode(entity.brandInitials || initialsOf(entity.name)));
    } else {
      // Fallback gradient on hashed seed
      const seed = entity.id || entity.name || '?';
      const g = gradientFor(seed);
      node.style.background = `linear-gradient(135deg, ${g.from}, ${g.to})`;
      node.appendChild(document.createTextNode(initialsOf(entity.name || '?')));
    }
    return node;
  }

  // ── Module-helper: render a card list with status groups ──────
  function renderGrouped(moduleId, records, opts = {}) {
    const config = _configs[moduleId];
    if (!config) return el('div', {}, 'No config');

    // Per-mount overrides (typically just onClick) — passed through to
    // render() without mutating the registered config.
    const overrides = opts.overrides || null;

    const wrap = el('div', { class: opts.layout === 'list' ? 'gh-card-list' : 'gh-card-grid' });

    if (config.groupBy) {
      const groups = {};
      const order = [];
      for (const r of records) {
        const g = config.groupBy(r);
        const key = (g && g.key) || 'other';
        if (!groups[key]) { groups[key] = { ...g, items: [] }; order.push(key); }
        groups[key].items.push(r);
      }
      const container = el('div', {});
      for (const k of order) {
        const g = groups[k];
        if (!g.items.length) continue;
        const header = el('div', { class: 'gh-group-header' }, [
          el('div', {
            class: `gh-group-header__dot`,
            style: { background: g.color || 'var(--gh-status-neutral)' }
          }),
          el('div', { class: 'gh-group-header__label' }, g.label || k),
          el('div', { class: 'gh-group-header__count' }, String(g.items.length)),
        ]);
        const groupGrid = el('div', { class: opts.layout === 'list' ? 'gh-card-list' : 'gh-card-grid' });
        for (const r of g.items) groupGrid.appendChild(render(moduleId, r, overrides));
        container.appendChild(header);
        container.appendChild(groupGrid);
      }
      return container;
    }

    for (const r of records) wrap.appendChild(render(moduleId, r, overrides));
    return wrap;
  }

  window.GH_CARD = {
    register,
    render,
    renderGrouped,
    // Expose helpers for module configs that want to compose
    renderEntity,
    phosphorIcon,
    initialsOf,
    gradientFor,
  };
})();
