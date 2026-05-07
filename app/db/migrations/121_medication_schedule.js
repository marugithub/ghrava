// Migration 121 — Slice 1C (Medication schedule fields)
//
// Adds six columns to med_medications to drive the new "Schedule" panel:
//   schedule_days       — comma-separated weekday tokens ("S,M,T,W,T,F,S" or "M,W,F")
//   schedule_times      — comma-separated time-of-day tokens ("AM", "AM,PM", "AM,NOON,PM,NIGHT")
//   schedule_specific   — free-text override for specific times ("8:00 AM, 8:00 PM")
//   cycle_days_on       — INT for cycling regimens (e.g., 21 days on)
//   cycle_days_off      — INT for cycling regimens (e.g., 7 days off)
//   prn_max_per_day     — INT max doses for as-needed scripts
//
// All nullable. Existing meds render fine with these unset — the card
// falls back to the v202604.142 instruction icons that read time_of_day
// and take_with_food directly. New saves prefer the new fields.
//
// Idempotent: try/catch around each ALTER (better-sqlite3 throws on
// duplicate column; we ignore that).

module.exports = function (db) {
  const addCol = (table, sql) => {
    try { db.exec(`ALTER TABLE ${table} ADD COLUMN ${sql}`); }
    catch (e) {
      if (!/duplicate column/i.test(e.message)) throw e;
    }
  };

  const tx = db.transaction(() => {
    addCol('med_medications', 'schedule_days     TEXT');
    addCol('med_medications', 'schedule_times    TEXT');
    addCol('med_medications', 'schedule_specific TEXT');
    addCol('med_medications', 'cycle_days_on     INTEGER');
    addCol('med_medications', 'cycle_days_off    INTEGER');
    addCol('med_medications', 'prn_max_per_day   INTEGER');
  });
  tx();
};
