/**
 * db/db.js — Database connection singleton
 * Only this file imports better-sqlite3.
 * Every feature imports this module.
 */
require('dotenv').config({ path: '/app/.env' });

const Database = require('better-sqlite3');
const path     = require('path');
const fs       = require('fs');

const dbPath = process.env.DB_PATH || path.join(__dirname, '../../data/lifetracker.db');

// Ensure directory exists
const dbDir = path.dirname(dbPath);
if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true });

const db = new Database(dbPath);

db.pragma('journal_mode = DELETE');  // immediate commit, no WAL buffer
db.pragma('synchronous = FULL');      // wait for OS to confirm write to disk
db.pragma('foreign_keys = ON');

module.exports = db;
