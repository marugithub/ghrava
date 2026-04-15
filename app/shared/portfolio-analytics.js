// @ts-check
'use strict';
/**
 * shared/portfolio-analytics.js
 * Investment portfolio performance utilities.
 */
const db = require('../db/db');

function takePortfolioSnapshot() {
  const today = new Date().toISOString().slice(0, 10);
  const totals = db.prepare(`
    SELECT COALESCE(SUM(market_value),0) as total_value,
           COALESCE(SUM(total_cost_basis),0) as total_cost,
           COALESCE(SUM(gain_loss_dollar),0) as total_gain
    FROM holdings WHERE market_value > 0
  `).get();
  const totalGainPct = totals.total_cost > 0 ? (totals.total_gain / totals.total_cost) * 100 : 0;
  db.prepare(`
    INSERT OR REPLACE INTO portfolio_snapshots (snapshot_date, total_value, total_cost, total_gain, total_gain_pct)
    VALUES (?,?,?,?,?)
  `).run(today, totals.total_value, totals.total_cost, totals.total_gain, totalGainPct);
  return totals;
}

function getPortfolioPerformance(months = 12) {
  return db.prepare(`
    SELECT snapshot_date, total_value, total_cost, total_gain, total_gain_pct
    FROM portfolio_snapshots
    WHERE snapshot_date >= date('now', '-' || ? || ' months')
    ORDER BY snapshot_date ASC
  `).all(months);
}

function getAssetAllocation() {
  return db.prepare(`
    SELECT COALESCE(asset_type,'Other') as type, SUM(market_value) as value, COUNT(*) as count
    FROM holdings WHERE market_value > 0
    GROUP BY asset_type ORDER BY value DESC
  `).all();
}

function getTopPerformers(limit = 5) {
  return db.prepare(`
    SELECT symbol, name, market_value, total_cost_basis, gain_loss_dollar, gain_loss_pct
    FROM holdings WHERE market_value > 0 AND gain_loss_pct IS NOT NULL
    ORDER BY gain_loss_pct DESC LIMIT ?
  `).all(limit);
}

module.exports = { takePortfolioSnapshot, getPortfolioPerformance, getAssetAllocation, getTopPerformers };
