// @ts-check
'use strict';
/**
 * shared/insurance-report.js
 * Generate insurance-ready inventory report from items table.
 */
const db = require('../db/db');

function generateInsuranceReport(options = {}) {
  const groupBy   = options.groupBy   || 'room';
  const minValue  = options.minValue  || 0;

  const items = db.prepare(`
    SELECT i.id, i.name, i.category, i.brand, i.model_number,
           i.serial_number, i.purchase_date, i.purchase_price, i.quantity,
           i.condition, i.notes,
           l.name as location_name,
           a.id as primary_photo_id
    FROM items i
    LEFT JOIN locations l ON i.parent_type = 'location' AND i.parent_id = l.id
    LEFT JOIN attachments a ON a.entity_type = 'item' AND a.entity_id = i.id AND a.is_primary_photo = 1
    WHERE i.is_active = 1 AND i.is_archived = 0
      AND (i.purchase_price IS NULL OR i.purchase_price >= ?)
    ORDER BY l.name, i.category, i.name
  `).all(minValue);

  const summary = {
    total_items: items.length,
    total_value: items.reduce((s,i) => s + (i.purchase_price||0) * (i.quantity||1), 0),
    by_category: {}, by_location: {}
  };
  items.forEach(item => {
    const v = (item.purchase_price||0) * (item.quantity||1);
    const cat = item.category || 'Uncategorized';
    const loc = item.location_name || 'Unknown Location';
    if (!summary.by_category[cat]) summary.by_category[cat] = { count: 0, value: 0 };
    summary.by_category[cat].count += item.quantity || 1;
    summary.by_category[cat].value += v;
    if (!summary.by_location[loc]) summary.by_location[loc] = { count: 0, value: 0 };
    summary.by_location[loc].count += item.quantity || 1;
    summary.by_location[loc].value += v;
  });

  const groups = {};
  items.forEach(item => {
    const key = groupBy === 'category' ? (item.category || 'Uncategorized') : (item.location_name || 'Unknown');
    if (!groups[key]) groups[key] = [];
    groups[key].push(item);
  });

  return { generated_at: new Date().toISOString(), config: options, summary, groups };
}

function esc(s) { return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
function fmtMoney(n) { if (!n) return '$0.00'; return '$' + Number(n).toLocaleString('en-US',{minimumFractionDigits:2}); }

function generateInsuranceHTML(data) {
  return `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><title>Insurance Report — Ghrava</title>
<style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:system-ui,sans-serif;background:#f8fafc;padding:20px}
.report{max-width:1100px;margin:0 auto;background:#fff;border-radius:12px;padding:24px}
h1{color:#1e293b;border-bottom:2px solid #3b82f6;padding-bottom:12px;margin-bottom:20px}
.summary{display:grid;grid-template-columns:repeat(3,1fr);gap:16px;margin-bottom:24px}
.sc{background:#f1f5f9;border-radius:8px;padding:16px;text-align:center}
.sv{font-size:22px;font-weight:700;color:#1e293b}.sl{font-size:11px;color:#64748b;text-transform:uppercase}
.group{margin-bottom:24px}.group-hdr{font-size:17px;font-weight:700;margin-bottom:12px;padding-bottom:6px;border-bottom:1px solid #e2e8f0}
.items{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:10px}
.item{background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:12px}
.iname{font-weight:600;color:#1e293b;margin-bottom:4px}.imeta{font-size:12px;color:#64748b}
.ival{font-weight:600;color:#059669;margin-top:4px}
.footer{margin-top:24px;padding-top:12px;border-top:1px solid #e2e8f0;text-align:center;font-size:11px;color:#94a3b8}
@media print{body{background:#fff;padding:0}.report{box-shadow:none}}</style>
</head><body><div class="report">
<h1>🏠 Insurance Report</h1>
<p style="color:#64748b;margin-bottom:20px">Generated: ${new Date(data.generated_at).toLocaleString()}</p>
<div class="summary">
  <div class="sc"><div class="sv">${data.summary.total_items}</div><div class="sl">Items</div></div>
  <div class="sc"><div class="sv">${fmtMoney(data.summary.total_value)}</div><div class="sl">Total Value</div></div>
  <div class="sc"><div class="sv">${Object.keys(data.groups).length}</div><div class="sl">Locations</div></div>
</div>
${Object.entries(data.groups).map(([gName, items]) => `
  <div class="group">
    <div class="group-hdr">📍 ${esc(gName)} <span style="font-weight:400;font-size:13px">(${items.length} items)</span></div>
    <div class="items">${items.map(item => `
      <div class="item">
        <div class="iname">${esc(item.name)}</div>
        <div class="imeta">${item.brand ? esc(item.brand)+' · ' : ''}Qty: ${item.quantity||1}</div>
        ${item.serial_number ? `<div class="imeta">S/N: ${esc(item.serial_number)}</div>` : ''}
        ${item.purchase_price ? `<div class="ival">${fmtMoney(item.purchase_price)}</div>` : ''}
      </div>`).join('')}
    </div>
  </div>`).join('')}
<div class="footer">Ghrava Insurance Report — For insurance purposes only</div>
</div></body></html>`;
}

module.exports = { generateInsuranceReport, generateInsuranceHTML };
