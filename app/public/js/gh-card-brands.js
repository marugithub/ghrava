/**
 * gh-card-brands.js — Shared brand color + initials lookup.
 *
 * Eliminates duplicated brand maps from every page's derive() closure.
 * Used by GH_CARD_SHARED.brandColorFor() and brandInitialsFor().
 *
 * Sourced from public brand guidelines. Kept conservative — exact hex when
 * known, sensible neutrals otherwise. Add to this list as you encounter
 * brands; a future migration could move this to a `brand_assets` table
 * users can edit.
 *
 * Lookup is case-insensitive, matches whole name OR first significant word.
 *   "Chase Sapphire" → matches "chase"
 *   "Bank of America" → matches "bank of america"
 */
(function() {
  'use strict';

  const BRANDS = {
    // ── Streaming / Media ──
    'netflix':       { color: '#E50914', initials: 'NF' },
    'spotify':       { color: '#1DB954', initials: 'SP' },
    'disney+':       { color: '#0a3d92', initials: 'D+' },
    'hulu':          { color: '#1ce783', initials: 'HU' },
    'hbo':           { color: '#000000', initials: 'HBO' },
    'prime video':   { color: '#00a8e1', initials: 'PV' },
    'apple tv':      { color: '#000000', initials: 'TV' },
    'youtube':       { color: '#FF0000', initials: 'YT' },
    'paramount':     { color: '#0064ff', initials: 'PA' },
    'peacock':       { color: '#fa6400', initials: 'PE' },

    // ── Music ──
    'apple music':   { color: '#fa233b', initials: 'AM' },
    'tidal':         { color: '#000000', initials: 'TI' },
    'pandora':       { color: '#005483', initials: 'PA' },

    // ── Software / SaaS ──
    'adobe':         { color: '#FA0F00', initials: 'AD' },
    'microsoft':     { color: '#5e5e5e', initials: 'MS' },
    'google':        { color: '#4285f4', initials: 'GO' },
    'github':        { color: '#1f2937', initials: 'GH' },
    'dropbox':       { color: '#0061ff', initials: 'DB' },
    '1password':     { color: '#0572ec', initials: '1P' },
    'notion':        { color: '#1f2937', initials: 'NO' },
    'slack':         { color: '#4a154b', initials: 'SL' },

    // ── US Banks (cards + checking + brokerage) ──
    'chase':         { color: '#0a4abf', initials: 'CHA' },
    'jpmorgan':      { color: '#0a4abf', initials: 'JPM' },
    'bank of america': { color: '#e31837', initials: 'BoA' },
    'wells fargo':   { color: '#d71e28', initials: 'WF' },
    'citi':          { color: '#003b70', initials: 'CIT' },
    'citibank':      { color: '#003b70', initials: 'CIT' },
    'capital one':   { color: '#004977', initials: 'C1' },
    'discover':      { color: '#ff6000', initials: 'DI' },
    'usaa':          { color: '#001b3a', initials: 'USA' },
    'navy federal':  { color: '#003366', initials: 'NFC' },
    'navy fed':      { color: '#003366', initials: 'NFC' },
    'schwab':        { color: '#00a0df', initials: 'SCH' },
    'charles schwab':{ color: '#00a0df', initials: 'SCH' },
    'fidelity':      { color: '#3d8b40', initials: 'FID' },
    'vanguard':      { color: '#a00d11', initials: 'VAN' },
    'tsp':           { color: '#1f3864', initials: 'TSP' },
    'amex':          { color: '#006fcf', initials: 'AX' },
    'american express': { color: '#006fcf', initials: 'AX' },
    'ally':          { color: '#7421b9', initials: 'AL' },
    'sofi':          { color: '#1c1851', initials: 'SF' },

    // ── Insurance ──
    'state farm':    { color: '#d50000', initials: 'SF' },
    'geico':         { color: '#0a4abf', initials: 'GE' },
    'progressive':   { color: '#00a3e0', initials: 'PR' },
    'allstate':      { color: '#0033a0', initials: 'AS' },
    'liberty mutual':{ color: '#fdc82f', initials: 'LM' },
    'aaa':           { color: '#d51e25', initials: 'AAA' },

    // ── Pharmacies ──
    'cvs':           { color: '#cc0000', initials: 'CVS' },
    'walgreens':     { color: '#e21c2c', initials: 'WAG' },
    'rite aid':      { color: '#005bab', initials: 'RA' },
    'walmart':       { color: '#0071ce', initials: 'WM' },
    'kroger':        { color: '#004ba1', initials: 'KR' },

    // ── Retail / Vendors ──
    'amazon':        { color: '#ff9900', initials: 'AM' },
    'home depot':    { color: '#f96302', initials: 'HD' },
    'lowes':         { color: '#004990', initials: 'LO' },
    "lowe's":        { color: '#004990', initials: 'LO' },
    'best buy':      { color: '#0a4abf', initials: 'BBY' },
    'costco':        { color: '#005daa', initials: 'CO' },
    'target':        { color: '#cc0000', initials: 'TG' },
    'apple':         { color: '#1f2937', initials: 'AP' },
    'ebay':          { color: '#e53238', initials: 'EB' },

    // ── Auto ──
    'firestone':     { color: '#ed1c24', initials: 'FS' },
    'pep boys':      { color: '#0066b3', initials: 'PB' },
    'jiffy lube':    { color: '#fbb800', initials: 'JL' },
    'shell':         { color: '#fbcc05', initials: 'SH' },
    'exxon':         { color: '#ee1c25', initials: 'EX' },
    'chevron':       { color: '#0058a3', initials: 'CV' },

    // ── Cert issuers ──
    'comptia':       { color: '#C8102E', initials: 'CT' },
    'pmi':           { color: '#0a4abf', initials: 'PMI' },
    'aws':           { color: '#FF9900', initials: 'AWS' },
    'microsoft learn':{ color: '#5e5e5e', initials: 'MS' },
    'isaca':         { color: '#0066b3', initials: 'ISA' },
    'isc2':          { color: '#005a9c', initials: 'I2' },
  };

  function normalize(s) {
    return String(s || '').toLowerCase().trim();
  }

  function lookup(name) {
    if (!name) return null;
    const key = normalize(name);
    if (BRANDS[key]) return BRANDS[key];
    // Try matching first word
    const firstWord = key.split(/\s+/)[0];
    if (firstWord && BRANDS[firstWord]) return BRANDS[firstWord];
    // Try matching as a substring of any registered brand name
    for (const [k, v] of Object.entries(BRANDS)) {
      if (key.includes(k) || k.includes(key)) return v;
    }
    return null;
  }

  function brandColorFor(name) {
    const b = lookup(name);
    return b ? b.color : null;
  }

  function brandInitialsFor(name) {
    const b = lookup(name);
    if (b) return b.initials;
    // Generic fallback: first letters of up to 3 words
    const words = String(name || '').trim().split(/\s+/);
    if (!words.length || !words[0]) return '?';
    if (words.length === 1) return words[0].slice(0, 3).toUpperCase();
    return words.slice(0, 3).map(w => w[0]).join('').toUpperCase();
  }

  // Attach to GH_CARD_SHARED if available, else create namespace
  const target = window.GH_CARD_SHARED || (window.GH_CARD_SHARED = {});
  target.brandColorFor    = brandColorFor;
  target.brandInitialsFor = brandInitialsFor;
  target._BRANDS_DEBUG    = BRANDS;  // for tests / inspection
})();
