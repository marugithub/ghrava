// 143_family_members_gender.js
// v.178 — add family_members.gender (TEXT, nullable).
//
// Backs the new Gender field in the Settings family-member editor, which
// the Kids page avatar pencil deep-links into. Free-form short text
// (e.g. "Male", "Female", "Nonbinary", "") — no enum constraint so the
// existing GH_SELECT ref pattern stays optional and nothing breaks if a
// value outside a fixed list is entered.
//
// On installs where the column somehow already exists the ALTER fails
// inside the try/catch and is a no-op.
//
// schema: family_members.gender TEXT (mig 143)

module.exports = function(db) {
  try {
    db.exec(`ALTER TABLE family_members ADD COLUMN gender TEXT`);
  } catch (e) {
    // Column already exists, or table doesn't exist on this install
  }
};
