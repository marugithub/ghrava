// 137_holdings_as_of_date_ensure.js
// v.170 — defensive: ensure holdings.as_of_date exists.
//
// Background: mig 126 created `holdings_v2` with `as_of_date` and renamed
// it to `holdings`, but on some install paths the rename failed silently
// because an older `holdings` table was already present, and `as_of_date`
// never got added. The schema validator (and any new install that replays
// migrations) sees `holdings` without the column.
//
// On installs where the column already exists, the ALTER fails inside the
// try/catch — no-op. On installs where it's missing, the column gets added.
// Either way, code in finance/forecast/import that references
// `holdings.as_of_date` keeps working.
//
// schema: holdings.as_of_date DATE (defensive)

module.exports = function(db) {
  try {
    db.exec('ALTER TABLE holdings ADD COLUMN as_of_date DATE');
  } catch (e) {
    // Column already exists, or table doesn't exist on this install
  }
};
