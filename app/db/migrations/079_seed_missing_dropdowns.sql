-- Migration 079: Seed missing dropdown_options keys
-- These were previously hardcoded in HTML <select> elements

BEGIN;

-- book_format
INSERT OR IGNORE INTO dropdown_options (list_key, label, value, is_system, is_active, sort_order)
VALUES
  ('book_format','Physical','Physical',1,1,1),
  ('book_format','Kindle','Kindle',1,1,2),
  ('book_format','Audible','Audible',1,1,3),
  ('book_format','eBook','eBook',1,1,4),
  ('book_format','PDF','PDF',1,1,5),
  ('book_format','Other','Other',1,1,6);

-- book_status
INSERT OR IGNORE INTO dropdown_options (list_key, label, value, is_system, is_active, sort_order)
VALUES
  ('book_status','Want to Read','Want to Read',1,1,1),
  ('book_status','Currently Reading','Currently Reading',1,1,2),
  ('book_status','Read','Read',1,1,3),
  ('book_status','Did Not Finish','Did Not Finish',1,1,4);

-- career_cert_status
INSERT OR IGNORE INTO dropdown_options (list_key, label, value, is_system, is_active, sort_order)
VALUES
  ('career_cert_status','Active','Active',1,1,1),
  ('career_cert_status','In Progress','In Progress',1,1,2),
  ('career_cert_status','Expired','Expired',1,1,3),
  ('career_cert_status','Suspended','Suspended',1,1,4);

-- skill_proficiency
INSERT OR IGNORE INTO dropdown_options (list_key, label, value, is_system, is_active, sort_order)
VALUES
  ('skill_proficiency','Beginner','Beginner',1,1,1),
  ('skill_proficiency','Intermediate','Intermediate',1,1,2),
  ('skill_proficiency','Advanced','Advanced',1,1,3),
  ('skill_proficiency','Expert','Expert',1,1,4);

-- learning_type
INSERT OR IGNORE INTO dropdown_options (list_key, label, value, is_system, is_active, sort_order)
VALUES
  ('learning_type','Course','Course',1,1,1),
  ('learning_type','Seminar','Seminar',1,1,2),
  ('learning_type','Conference','Conference',1,1,3),
  ('learning_type','Webinar','Webinar',1,1,4),
  ('learning_type','Reading','Reading',1,1,5),
  ('learning_type','On-the-Job','On-the-Job',1,1,6),
  ('learning_type','Volunteering','Volunteering',1,1,7),
  ('learning_type','Presenting/Teaching','Presenting/Teaching',1,1,8),
  ('learning_type','Self-Study','Self-Study',1,1,9),
  ('learning_type','Other','Other',1,1,10);

-- career_goal_status (career_goal_category already seeded)
INSERT OR IGNORE INTO dropdown_options (list_key, label, value, is_system, is_active, sort_order)
VALUES
  ('career_goal_status','Active','active',1,1,1),
  ('career_goal_status','Achieved','achieved',1,1,2),
  ('career_goal_status','Dropped','dropped',1,1,3);

-- med_medication_status
INSERT OR IGNORE INTO dropdown_options (list_key, label, value, is_system, is_active, sort_order)
VALUES
  ('med_medication_status','Active','Active',1,1,1),
  ('med_medication_status','As Needed','As Needed',1,1,2),
  ('med_medication_status','Discontinued','Discontinued',1,1,3),
  ('med_medication_status','Paused','Paused',1,1,4);

-- med_condition_status
INSERT OR IGNORE INTO dropdown_options (list_key, label, value, is_system, is_active, sort_order)
VALUES
  ('med_condition_status','Active','Active',1,1,1),
  ('med_condition_status','Chronic','Chronic',1,1,2),
  ('med_condition_status','Monitoring','Monitoring',1,1,3),
  ('med_condition_status','Resolved','Resolved',1,1,4),
  ('med_condition_status','In Remission','In Remission',1,1,5);

-- gift_card_location
INSERT OR IGNORE INTO dropdown_options (list_key, label, value, is_system, is_active, sort_order)
VALUES
  ('gift_card_location','Wallet','Wallet',1,1,1),
  ('gift_card_location','Email','Email',1,1,2),
  ('gift_card_location','App','App',1,1,3),
  ('gift_card_location','Physical Card','Physical Card',1,1,4),
  ('gift_card_location','Other','Other',1,1,5);


-- hsa_payment_type (was hardcoded in finance.html HSA section)
INSERT OR IGNORE INTO dropdown_options (list_key, label, value, is_system, is_active, sort_order)
VALUES
  ('hsa_payment_type','Out of Pocket','Out of Pocket',1,1,1),
  ('hsa_payment_type','Insurance Paid','Insurance Paid',1,1,2),
  ('hsa_payment_type','HSA Card','HSA Card',1,1,3),
  ('hsa_payment_type','Other','Other',1,1,4);

-- resource_link_type (was hardcoded in resources.html)
INSERT OR IGNORE INTO dropdown_options (list_key, label, value, is_system, is_active, sort_order)
VALUES
  ('resource_link_type','Website','🌐 Website',1,1,1),
  ('resource_link_type','Folder','📁 Folder',1,1,2),
  ('resource_link_type','File','📄 File',1,1,3),
  ('resource_link_type','App','📱 App',1,1,4),
  ('resource_link_type','Other','📎 Other',1,1,5);

COMMIT;
