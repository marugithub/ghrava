-- Migration 009: Fix resource tags to use central tags+taggables
-- Drops resource_tags table (wrong design), migrates to tags+taggables.
-- entity_type = "resource" in taggables.

-- Remove old resource_tags table if it exists (wrong design from 007/008)
DROP TABLE IF EXISTS resource_tags;

-- Remove old taggable entries for resources (clean slate)
DELETE FROM taggables WHERE entity_type = 'resource';

-- Ensure seed tags exist in central tags table
INSERT OR IGNORE INTO tags (name, color_hex) VALUES ('discount-varies', '3b82f6');
INSERT OR IGNORE INTO tags (name, color_hex) VALUES ('edu-email', '3b82f6');
INSERT OR IGNORE INTO tags (name, color_hex) VALUES ('federal-employee', '3b82f6');
INSERT OR IGNORE INTO tags (name, color_hex) VALUES ('free', '3b82f6');
INSERT OR IGNORE INTO tags (name, color_hex) VALUES ('free-account', '3b82f6');
INSERT OR IGNORE INTO tags (name, color_hex) VALUES ('no-signup-required', '3b82f6');
INSERT OR IGNORE INTO tags (name, color_hex) VALUES ('paid-discount', '3b82f6');
INSERT OR IGNORE INTO tags (name, color_hex) VALUES ('reddit-find', '3b82f6');
INSERT OR IGNORE INTO tags (name, color_hex) VALUES ('student-verify', '3b82f6');
INSERT OR IGNORE INTO tags (name, color_hex) VALUES ('university-access', '3b82f6');

-- Attach tags to resources via taggables
INSERT OR IGNORE INTO taggables (tag_id, entity_type, entity_id) SELECT t.id, 'resource', r.id FROM tags t, resources r WHERE t.name = 'free' AND r.name = 'GitHub Student Developer Pack';
INSERT OR IGNORE INTO taggables (tag_id, entity_type, entity_id) SELECT t.id, 'resource', r.id FROM tags t, resources r WHERE t.name = 'edu-email' AND r.name = 'GitHub Student Developer Pack';

INSERT OR IGNORE INTO taggables (tag_id, entity_type, entity_id) SELECT t.id, 'resource', r.id FROM tags t, resources r WHERE t.name = 'free' AND r.name = 'JSTOR';
INSERT OR IGNORE INTO taggables (tag_id, entity_type, entity_id) SELECT t.id, 'resource', r.id FROM tags t, resources r WHERE t.name = 'university-access' AND r.name = 'JSTOR';

INSERT OR IGNORE INTO taggables (tag_id, entity_type, entity_id) SELECT t.id, 'resource', r.id FROM tags t, resources r WHERE t.name = 'free' AND r.name = 'Web of Science';
INSERT OR IGNORE INTO taggables (tag_id, entity_type, entity_id) SELECT t.id, 'resource', r.id FROM tags t, resources r WHERE t.name = 'university-access' AND r.name = 'Web of Science';

INSERT OR IGNORE INTO taggables (tag_id, entity_type, entity_id) SELECT t.id, 'resource', r.id FROM tags t, resources r WHERE t.name = 'free' AND r.name = 'Scopus';
INSERT OR IGNORE INTO taggables (tag_id, entity_type, entity_id) SELECT t.id, 'resource', r.id FROM tags t, resources r WHERE t.name = 'university-access' AND r.name = 'Scopus';

INSERT OR IGNORE INTO taggables (tag_id, entity_type, entity_id) SELECT t.id, 'resource', r.id FROM tags t, resources r WHERE t.name = 'free' AND r.name = 'ProQuest Dissertations';
INSERT OR IGNORE INTO taggables (tag_id, entity_type, entity_id) SELECT t.id, 'resource', r.id FROM tags t, resources r WHERE t.name = 'university-access' AND r.name = 'ProQuest Dissertations';

INSERT OR IGNORE INTO taggables (tag_id, entity_type, entity_id) SELECT t.id, 'resource', r.id FROM tags t, resources r WHERE t.name = 'free' AND r.name = 'IEEE Xplore';
INSERT OR IGNORE INTO taggables (tag_id, entity_type, entity_id) SELECT t.id, 'resource', r.id FROM tags t, resources r WHERE t.name = 'university-access' AND r.name = 'IEEE Xplore';

INSERT OR IGNORE INTO taggables (tag_id, entity_type, entity_id) SELECT t.id, 'resource', r.id FROM tags t, resources r WHERE t.name = 'free' AND r.name = 'Nuke Non-Commercial';
INSERT OR IGNORE INTO taggables (tag_id, entity_type, entity_id) SELECT t.id, 'resource', r.id FROM tags t, resources r WHERE t.name = 'student-verify' AND r.name = 'Nuke Non-Commercial';
INSERT OR IGNORE INTO taggables (tag_id, entity_type, entity_id) SELECT t.id, 'resource', r.id FROM tags t, resources r WHERE t.name = 'reddit-find' AND r.name = 'Nuke Non-Commercial';

INSERT OR IGNORE INTO taggables (tag_id, entity_type, entity_id) SELECT t.id, 'resource', r.id FROM tags t, resources r WHERE t.name = 'free' AND r.name = 'PubMed Central';
INSERT OR IGNORE INTO taggables (tag_id, entity_type, entity_id) SELECT t.id, 'resource', r.id FROM tags t, resources r WHERE t.name = 'university-access' AND r.name = 'PubMed Central';

INSERT OR IGNORE INTO taggables (tag_id, entity_type, entity_id) SELECT t.id, 'resource', r.id FROM tags t, resources r WHERE t.name = 'free' AND r.name = 'LexisNexis Academic';
INSERT OR IGNORE INTO taggables (tag_id, entity_type, entity_id) SELECT t.id, 'resource', r.id FROM tags t, resources r WHERE t.name = 'university-access' AND r.name = 'LexisNexis Academic';

INSERT OR IGNORE INTO taggables (tag_id, entity_type, entity_id) SELECT t.id, 'resource', r.id FROM tags t, resources r WHERE t.name = 'free' AND r.name = 'Autodesk Education Suite';
INSERT OR IGNORE INTO taggables (tag_id, entity_type, entity_id) SELECT t.id, 'resource', r.id FROM tags t, resources r WHERE t.name = 'student-verify' AND r.name = 'Autodesk Education Suite';

INSERT OR IGNORE INTO taggables (tag_id, entity_type, entity_id) SELECT t.id, 'resource', r.id FROM tags t, resources r WHERE t.name = 'discount-varies' AND r.name = 'Federal Employee Discounts';
INSERT OR IGNORE INTO taggables (tag_id, entity_type, entity_id) SELECT t.id, 'resource', r.id FROM tags t, resources r WHERE t.name = 'federal-employee' AND r.name = 'Federal Employee Discounts';

INSERT OR IGNORE INTO taggables (tag_id, entity_type, entity_id) SELECT t.id, 'resource', r.id FROM tags t, resources r WHERE t.name = 'free' AND r.name = 'Government Training Resources';
INSERT OR IGNORE INTO taggables (tag_id, entity_type, entity_id) SELECT t.id, 'resource', r.id FROM tags t, resources r WHERE t.name = 'federal-employee' AND r.name = 'Government Training Resources';

INSERT OR IGNORE INTO taggables (tag_id, entity_type, entity_id) SELECT t.id, 'resource', r.id FROM tags t, resources r WHERE t.name = 'free' AND r.name = 'Bloomberg Terminal';
INSERT OR IGNORE INTO taggables (tag_id, entity_type, entity_id) SELECT t.id, 'resource', r.id FROM tags t, resources r WHERE t.name = 'university-access' AND r.name = 'Bloomberg Terminal';
INSERT OR IGNORE INTO taggables (tag_id, entity_type, entity_id) SELECT t.id, 'resource', r.id FROM tags t, resources r WHERE t.name = 'reddit-find' AND r.name = 'Bloomberg Terminal';

INSERT OR IGNORE INTO taggables (tag_id, entity_type, entity_id) SELECT t.id, 'resource', r.id FROM tags t, resources r WHERE t.name = 'free' AND r.name = 'Unity Pro';
INSERT OR IGNORE INTO taggables (tag_id, entity_type, entity_id) SELECT t.id, 'resource', r.id FROM tags t, resources r WHERE t.name = 'student-verify' AND r.name = 'Unity Pro';

INSERT OR IGNORE INTO taggables (tag_id, entity_type, entity_id) SELECT t.id, 'resource', r.id FROM tags t, resources r WHERE t.name = 'free' AND r.name = 'AWS Educate';
INSERT OR IGNORE INTO taggables (tag_id, entity_type, entity_id) SELECT t.id, 'resource', r.id FROM tags t, resources r WHERE t.name = 'student-verify' AND r.name = 'AWS Educate';

INSERT OR IGNORE INTO taggables (tag_id, entity_type, entity_id) SELECT t.id, 'resource', r.id FROM tags t, resources r WHERE t.name = 'paid-discount' AND r.name = 'Microsoft Azure';

INSERT OR IGNORE INTO taggables (tag_id, entity_type, entity_id) SELECT t.id, 'resource', r.id FROM tags t, resources r WHERE t.name = 'paid-discount' AND r.name = 'Google Cloud Platform';
INSERT OR IGNORE INTO taggables (tag_id, entity_type, entity_id) SELECT t.id, 'resource', r.id FROM tags t, resources r WHERE t.name = 'student-verify' AND r.name = 'Google Cloud Platform';
INSERT OR IGNORE INTO taggables (tag_id, entity_type, entity_id) SELECT t.id, 'resource', r.id FROM tags t, resources r WHERE t.name = 'reddit-find' AND r.name = 'Google Cloud Platform';

INSERT OR IGNORE INTO taggables (tag_id, entity_type, entity_id) SELECT t.id, 'resource', r.id FROM tags t, resources r WHERE t.name = 'free' AND r.name = 'Microsoft 365 Education';
INSERT OR IGNORE INTO taggables (tag_id, entity_type, entity_id) SELECT t.id, 'resource', r.id FROM tags t, resources r WHERE t.name = 'edu-email' AND r.name = 'Microsoft 365 Education';

INSERT OR IGNORE INTO taggables (tag_id, entity_type, entity_id) SELECT t.id, 'resource', r.id FROM tags t, resources r WHERE t.name = 'paid-discount' AND r.name = 'Adobe Creative Cloud All Apps';
INSERT OR IGNORE INTO taggables (tag_id, entity_type, entity_id) SELECT t.id, 'resource', r.id FROM tags t, resources r WHERE t.name = 'student-verify' AND r.name = 'Adobe Creative Cloud All Apps';

INSERT OR IGNORE INTO taggables (tag_id, entity_type, entity_id) SELECT t.id, 'resource', r.id FROM tags t, resources r WHERE t.name = 'free' AND r.name = 'Perplexity Pro';
INSERT OR IGNORE INTO taggables (tag_id, entity_type, entity_id) SELECT t.id, 'resource', r.id FROM tags t, resources r WHERE t.name = 'student-verify' AND r.name = 'Perplexity Pro';

INSERT OR IGNORE INTO taggables (tag_id, entity_type, entity_id) SELECT t.id, 'resource', r.id FROM tags t, resources r WHERE t.name = 'free' AND r.name = 'JetBrains All Products Pack';
INSERT OR IGNORE INTO taggables (tag_id, entity_type, entity_id) SELECT t.id, 'resource', r.id FROM tags t, resources r WHERE t.name = 'student-verify' AND r.name = 'JetBrains All Products Pack';

INSERT OR IGNORE INTO taggables (tag_id, entity_type, entity_id) SELECT t.id, 'resource', r.id FROM tags t, resources r WHERE t.name = 'free' AND r.name = 'MongoDB Atlas';
INSERT OR IGNORE INTO taggables (tag_id, entity_type, entity_id) SELECT t.id, 'resource', r.id FROM tags t, resources r WHERE t.name = 'student-verify' AND r.name = 'MongoDB Atlas';

INSERT OR IGNORE INTO taggables (tag_id, entity_type, entity_id) SELECT t.id, 'resource', r.id FROM tags t, resources r WHERE t.name = 'free' AND r.name = 'DigitalOcean';
INSERT OR IGNORE INTO taggables (tag_id, entity_type, entity_id) SELECT t.id, 'resource', r.id FROM tags t, resources r WHERE t.name = 'student-verify' AND r.name = 'DigitalOcean';

INSERT OR IGNORE INTO taggables (tag_id, entity_type, entity_id) SELECT t.id, 'resource', r.id FROM tags t, resources r WHERE t.name = 'free' AND r.name = 'Heroku';
INSERT OR IGNORE INTO taggables (tag_id, entity_type, entity_id) SELECT t.id, 'resource', r.id FROM tags t, resources r WHERE t.name = 'free-account' AND r.name = 'Heroku';

INSERT OR IGNORE INTO taggables (tag_id, entity_type, entity_id) SELECT t.id, 'resource', r.id FROM tags t, resources r WHERE t.name = 'paid-discount' AND r.name = 'Typeform Pro';
INSERT OR IGNORE INTO taggables (tag_id, entity_type, entity_id) SELECT t.id, 'resource', r.id FROM tags t, resources r WHERE t.name = 'student-verify' AND r.name = 'Typeform Pro';

INSERT OR IGNORE INTO taggables (tag_id, entity_type, entity_id) SELECT t.id, 'resource', r.id FROM tags t, resources r WHERE t.name = 'paid-discount' AND r.name = 'Mailchimp Pro';
INSERT OR IGNORE INTO taggables (tag_id, entity_type, entity_id) SELECT t.id, 'resource', r.id FROM tags t, resources r WHERE t.name = 'student-verify' AND r.name = 'Mailchimp Pro';

INSERT OR IGNORE INTO taggables (tag_id, entity_type, entity_id) SELECT t.id, 'resource', r.id FROM tags t, resources r WHERE t.name = 'paid-discount' AND r.name = 'DataCamp Premium';
INSERT OR IGNORE INTO taggables (tag_id, entity_type, entity_id) SELECT t.id, 'resource', r.id FROM tags t, resources r WHERE t.name = 'student-verify' AND r.name = 'DataCamp Premium';

INSERT OR IGNORE INTO taggables (tag_id, entity_type, entity_id) SELECT t.id, 'resource', r.id FROM tags t, resources r WHERE t.name = 'free' AND r.name = 'DaVinci Resolve Studio';
INSERT OR IGNORE INTO taggables (tag_id, entity_type, entity_id) SELECT t.id, 'resource', r.id FROM tags t, resources r WHERE t.name = 'no-signup-required' AND r.name = 'DaVinci Resolve Studio';
INSERT OR IGNORE INTO taggables (tag_id, entity_type, entity_id) SELECT t.id, 'resource', r.id FROM tags t, resources r WHERE t.name = 'reddit-find' AND r.name = 'DaVinci Resolve Studio';

INSERT OR IGNORE INTO taggables (tag_id, entity_type, entity_id) SELECT t.id, 'resource', r.id FROM tags t, resources r WHERE t.name = 'paid-discount' AND r.name = 'Airtable Pro';
INSERT OR IGNORE INTO taggables (tag_id, entity_type, entity_id) SELECT t.id, 'resource', r.id FROM tags t, resources r WHERE t.name = 'student-verify' AND r.name = 'Airtable Pro';

INSERT OR IGNORE INTO taggables (tag_id, entity_type, entity_id) SELECT t.id, 'resource', r.id FROM tags t, resources r WHERE t.name = 'free' AND r.name = 'Google One AI Premium';
INSERT OR IGNORE INTO taggables (tag_id, entity_type, entity_id) SELECT t.id, 'resource', r.id FROM tags t, resources r WHERE t.name = 'edu-email' AND r.name = 'Google One AI Premium';

INSERT OR IGNORE INTO taggables (tag_id, entity_type, entity_id) SELECT t.id, 'resource', r.id FROM tags t, resources r WHERE t.name = 'free' AND r.name = 'Substance Painter/Designer';
INSERT OR IGNORE INTO taggables (tag_id, entity_type, entity_id) SELECT t.id, 'resource', r.id FROM tags t, resources r WHERE t.name = 'student-verify' AND r.name = 'Substance Painter/Designer';
INSERT OR IGNORE INTO taggables (tag_id, entity_type, entity_id) SELECT t.id, 'resource', r.id FROM tags t, resources r WHERE t.name = 'reddit-find' AND r.name = 'Substance Painter/Designer';

INSERT OR IGNORE INTO taggables (tag_id, entity_type, entity_id) SELECT t.id, 'resource', r.id FROM tags t, resources r WHERE t.name = 'free' AND r.name = 'Cloudflare';
INSERT OR IGNORE INTO taggables (tag_id, entity_type, entity_id) SELECT t.id, 'resource', r.id FROM tags t, resources r WHERE t.name = 'free-account' AND r.name = 'Cloudflare';

INSERT OR IGNORE INTO taggables (tag_id, entity_type, entity_id) SELECT t.id, 'resource', r.id FROM tags t, resources r WHERE t.name = 'free' AND r.name = 'Figma Professional';

INSERT OR IGNORE INTO taggables (tag_id, entity_type, entity_id) SELECT t.id, 'resource', r.id FROM tags t, resources r WHERE t.name = 'free' AND r.name = 'Zoom Pro';

INSERT OR IGNORE INTO taggables (tag_id, entity_type, entity_id) SELECT t.id, 'resource', r.id FROM tags t, resources r WHERE t.name = 'free' AND r.name = 'Framer';
INSERT OR IGNORE INTO taggables (tag_id, entity_type, entity_id) SELECT t.id, 'resource', r.id FROM tags t, resources r WHERE t.name = 'student-verify' AND r.name = 'Framer';

INSERT OR IGNORE INTO taggables (tag_id, entity_type, entity_id) SELECT t.id, 'resource', r.id FROM tags t, resources r WHERE t.name = 'free' AND r.name = 'InVision';
INSERT OR IGNORE INTO taggables (tag_id, entity_type, entity_id) SELECT t.id, 'resource', r.id FROM tags t, resources r WHERE t.name = 'student-verify' AND r.name = 'InVision';

INSERT OR IGNORE INTO taggables (tag_id, entity_type, entity_id) SELECT t.id, 'resource', r.id FROM tags t, resources r WHERE t.name = 'discount-varies' AND r.name = 'Grammarly Premium';

INSERT OR IGNORE INTO taggables (tag_id, entity_type, entity_id) SELECT t.id, 'resource', r.id FROM tags t, resources r WHERE t.name = 'free' AND r.name = 'Amazon Prime Student';
INSERT OR IGNORE INTO taggables (tag_id, entity_type, entity_id) SELECT t.id, 'resource', r.id FROM tags t, resources r WHERE t.name = 'edu-email' AND r.name = 'Amazon Prime Student';

INSERT OR IGNORE INTO taggables (tag_id, entity_type, entity_id) SELECT t.id, 'resource', r.id FROM tags t, resources r WHERE t.name = 'paid-discount' AND r.name = 'Sketch';
INSERT OR IGNORE INTO taggables (tag_id, entity_type, entity_id) SELECT t.id, 'resource', r.id FROM tags t, resources r WHERE t.name = 'student-verify' AND r.name = 'Sketch';

INSERT OR IGNORE INTO taggables (tag_id, entity_type, entity_id) SELECT t.id, 'resource', r.id FROM tags t, resources r WHERE t.name = 'paid-discount' AND r.name = 'Spotify Premium';
INSERT OR IGNORE INTO taggables (tag_id, entity_type, entity_id) SELECT t.id, 'resource', r.id FROM tags t, resources r WHERE t.name = 'student-verify' AND r.name = 'Spotify Premium';

INSERT OR IGNORE INTO taggables (tag_id, entity_type, entity_id) SELECT t.id, 'resource', r.id FROM tags t, resources r WHERE t.name = 'free' AND r.name = 'Notion AI';
INSERT OR IGNORE INTO taggables (tag_id, entity_type, entity_id) SELECT t.id, 'resource', r.id FROM tags t, resources r WHERE t.name = 'student-verify' AND r.name = 'Notion AI';

INSERT OR IGNORE INTO taggables (tag_id, entity_type, entity_id) SELECT t.id, 'resource', r.id FROM tags t, resources r WHERE t.name = 'free' AND r.name = 'Canva Pro';
INSERT OR IGNORE INTO taggables (tag_id, entity_type, entity_id) SELECT t.id, 'resource', r.id FROM tags t, resources r WHERE t.name = 'university-access' AND r.name = 'Canva Pro';

INSERT OR IGNORE INTO taggables (tag_id, entity_type, entity_id) SELECT t.id, 'resource', r.id FROM tags t, resources r WHERE t.name = 'free' AND r.name = 'Miro Team';
INSERT OR IGNORE INTO taggables (tag_id, entity_type, entity_id) SELECT t.id, 'resource', r.id FROM tags t, resources r WHERE t.name = 'student-verify' AND r.name = 'Miro Team';

INSERT OR IGNORE INTO taggables (tag_id, entity_type, entity_id) SELECT t.id, 'resource', r.id FROM tags t, resources r WHERE t.name = 'free' AND r.name = 'Lucidchart Education';

INSERT OR IGNORE INTO taggables (tag_id, entity_type, entity_id) SELECT t.id, 'resource', r.id FROM tags t, resources r WHERE t.name = 'free' AND r.name = 'Discord Nitro';

INSERT OR IGNORE INTO taggables (tag_id, entity_type, entity_id) SELECT t.id, 'resource', r.id FROM tags t, resources r WHERE t.name = 'paid-discount' AND r.name = 'Julius AI';

INSERT OR IGNORE INTO taggables (tag_id, entity_type, entity_id) SELECT t.id, 'resource', r.id FROM tags t, resources r WHERE t.name = 'free' AND r.name = 'Requestly';
INSERT OR IGNORE INTO taggables (tag_id, entity_type, entity_id) SELECT t.id, 'resource', r.id FROM tags t, resources r WHERE t.name = 'student-verify' AND r.name = 'Requestly';
INSERT OR IGNORE INTO taggables (tag_id, entity_type, entity_id) SELECT t.id, 'resource', r.id FROM tags t, resources r WHERE t.name = 'reddit-find' AND r.name = 'Requestly';

INSERT OR IGNORE INTO taggables (tag_id, entity_type, entity_id) SELECT t.id, 'resource', r.id FROM tags t, resources r WHERE t.name = 'paid-discount' AND r.name = 'Humata';
INSERT OR IGNORE INTO taggables (tag_id, entity_type, entity_id) SELECT t.id, 'resource', r.id FROM tags t, resources r WHERE t.name = 'student-verify' AND r.name = 'Humata';

INSERT OR IGNORE INTO taggables (tag_id, entity_type, entity_id) SELECT t.id, 'resource', r.id FROM tags t, resources r WHERE t.name = 'paid-discount' AND r.name = 'Otter.ai Pro';
INSERT OR IGNORE INTO taggables (tag_id, entity_type, entity_id) SELECT t.id, 'resource', r.id FROM tags t, resources r WHERE t.name = 'student-verify' AND r.name = 'Otter.ai Pro';

INSERT OR IGNORE INTO taggables (tag_id, entity_type, entity_id) SELECT t.id, 'resource', r.id FROM tags t, resources r WHERE t.name = 'free' AND r.name = 'Slack Standard';
INSERT OR IGNORE INTO taggables (tag_id, entity_type, entity_id) SELECT t.id, 'resource', r.id FROM tags t, resources r WHERE t.name = 'student-verify' AND r.name = 'Slack Standard';

INSERT OR IGNORE INTO taggables (tag_id, entity_type, entity_id) SELECT t.id, 'resource', r.id FROM tags t, resources r WHERE t.name = 'free' AND r.name = 'Wolfram Alpha Pro';
INSERT OR IGNORE INTO taggables (tag_id, entity_type, entity_id) SELECT t.id, 'resource', r.id FROM tags t, resources r WHERE t.name = 'reddit-find' AND r.name = 'Wolfram Alpha Pro';

INSERT OR IGNORE INTO taggables (tag_id, entity_type, entity_id) SELECT t.id, 'resource', r.id FROM tags t, resources r WHERE t.name = 'free' AND r.name = 'LinkedIn Premium';

INSERT OR IGNORE INTO taggables (tag_id, entity_type, entity_id) SELECT t.id, 'resource', r.id FROM tags t, resources r WHERE t.name = 'free' AND r.name = 'Krita';
INSERT OR IGNORE INTO taggables (tag_id, entity_type, entity_id) SELECT t.id, 'resource', r.id FROM tags t, resources r WHERE t.name = 'no-signup-required' AND r.name = 'Krita';
INSERT OR IGNORE INTO taggables (tag_id, entity_type, entity_id) SELECT t.id, 'resource', r.id FROM tags t, resources r WHERE t.name = 'reddit-find' AND r.name = 'Krita';

INSERT OR IGNORE INTO taggables (tag_id, entity_type, entity_id) SELECT t.id, 'resource', r.id FROM tags t, resources r WHERE t.name = 'free' AND r.name = 'Blender';
INSERT OR IGNORE INTO taggables (tag_id, entity_type, entity_id) SELECT t.id, 'resource', r.id FROM tags t, resources r WHERE t.name = 'no-signup-required' AND r.name = 'Blender';
