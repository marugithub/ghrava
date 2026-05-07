// Migration 123 — fill row enrichment + medication unit metadata
//
// Purpose:
//   Card needs a "Doses left" visual that depletes over time and
//   resets when a new fill is logged. To compute that we need:
//
//     med_medications.doses_per_day      — schedule × frequency
//     med_medications.qty_unit           — 'ct' | 'mL' | 'g' | 'puffs' | 'oz'
//
//     med_medication_fills.quantity      — how many units this fill contained
//     med_medication_fills.prescriber_contact_id — who wrote the Rx (history)
//     med_medication_fills.brand_dispensed       — name actually dispensed (when
//                                                   pharmacist substitutes)
//     med_medication_fills.you_paid_oop          — out-of-pocket portion (drives
//                                                   "Last cost" + "HSA YTD")
//     med_medication_fills.insurance_covered     — captured but not displayed yet
//     med_medication_fills.rx_number             — Rx# changes on renewal, latest
//                                                   shown on card
//     med_medication_fills.refill_seq            — 0=initial, 1+=refill (helps
//                                                   us decrement refills_remaining
//                                                   automatically per business rule)
//
// All additive. Idempotent. No data destruction. Old fills without
// quantity render as "—" with no meter; the moment a fill row has
// quantity + qty_unit, the meter renders.

module.exports = function (db) {
  const addCol = (table, sql) => {
    try { db.exec(`ALTER TABLE ${table} ADD COLUMN ${sql}`); }
    catch (e) {
      if (!/duplicate column/i.test(e.message)) throw e;
    }
  };

  const tx = db.transaction(() => {
    // Medication-level unit metadata
    addCol('med_medications', "qty_unit TEXT DEFAULT 'ct'");
    addCol('med_medications', 'doses_per_day REAL');

    // Per-fill enrichment
    addCol('med_medication_fills', 'quantity REAL');
    addCol('med_medication_fills', 'prescriber_contact_id INTEGER REFERENCES contacts(id)');
    addCol('med_medication_fills', 'brand_dispensed TEXT');
    addCol('med_medication_fills', 'you_paid_oop REAL');
    addCol('med_medication_fills', 'insurance_covered REAL');
    addCol('med_medication_fills', 'rx_number TEXT');
    addCol('med_medication_fills', 'refill_seq INTEGER');
  });

  tx();
};
