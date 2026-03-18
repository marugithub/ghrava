-- Migration 008: Seed Resources from CSV
-- 54 student/free resources. Tags: access-type + method only. Max 3 tags each.
-- Run after 007_resources.sql

INSERT OR IGNORE INTO resources (name, description, url, link_type, category, access_note, is_favorite) VALUES ('GitHub Student Developer Pack', '100+ tools: Copilot, Pro account, cloud credits, domains, hosting | Regular: $200,000+/year → FREE (saves $200,000+/yr)', NULL, 'website', 'Development', '.edu email verification', 0);
INSERT OR IGNORE INTO resource_tags (resource_id, tag) SELECT id, 'free' FROM resources WHERE name = 'GitHub Student Developer Pack';
INSERT OR IGNORE INTO resource_tags (resource_id, tag) SELECT id, 'edu-email' FROM resources WHERE name = 'GitHub Student Developer Pack';

INSERT OR IGNORE INTO resources (name, description, url, link_type, category, access_note, is_favorite) VALUES ('JSTOR', '12+ million academic articles, books, primary sources | Regular: $19,500/year → FREE (saves $19,500/yr)', NULL, 'website', 'Academic Research', 'University library access', 0);
INSERT OR IGNORE INTO resource_tags (resource_id, tag) SELECT id, 'free' FROM resources WHERE name = 'JSTOR';
INSERT OR IGNORE INTO resource_tags (resource_id, tag) SELECT id, 'university-access' FROM resources WHERE name = 'JSTOR';

INSERT OR IGNORE INTO resources (name, description, url, link_type, category, access_note, is_favorite) VALUES ('Web of Science', 'Citation database, impact factor analysis | Regular: $15,000/year → FREE (saves $15,000/yr)', NULL, 'website', 'Research Database', 'University subscription', 0);
INSERT OR IGNORE INTO resource_tags (resource_id, tag) SELECT id, 'free' FROM resources WHERE name = 'Web of Science';
INSERT OR IGNORE INTO resource_tags (resource_id, tag) SELECT id, 'university-access' FROM resources WHERE name = 'Web of Science';

INSERT OR IGNORE INTO resources (name, description, url, link_type, category, access_note, is_favorite) VALUES ('Scopus', 'Abstract and citation database | Regular: $12,000/year → FREE (saves $12,000/yr)', NULL, 'website', 'Research Database', 'University access', 0);
INSERT OR IGNORE INTO resource_tags (resource_id, tag) SELECT id, 'free' FROM resources WHERE name = 'Scopus';
INSERT OR IGNORE INTO resource_tags (resource_id, tag) SELECT id, 'university-access' FROM resources WHERE name = 'Scopus';

INSERT OR IGNORE INTO resources (name, description, url, link_type, category, access_note, is_favorite) VALUES ('ProQuest Dissertations', 'Global dissertation and thesis database | Regular: $8,000/year → FREE (saves $8,000/yr)', NULL, 'website', 'Thesis Database', 'University library', 0);
INSERT OR IGNORE INTO resource_tags (resource_id, tag) SELECT id, 'free' FROM resources WHERE name = 'ProQuest Dissertations';
INSERT OR IGNORE INTO resource_tags (resource_id, tag) SELECT id, 'university-access' FROM resources WHERE name = 'ProQuest Dissertations';

INSERT OR IGNORE INTO resources (name, description, url, link_type, category, access_note, is_favorite) VALUES ('IEEE Xplore', 'Engineering and technology papers | Regular: $6,000/year → FREE (saves $6,000/yr)', NULL, 'website', 'Engineering Database', 'University subscription', 0);
INSERT OR IGNORE INTO resource_tags (resource_id, tag) SELECT id, 'free' FROM resources WHERE name = 'IEEE Xplore';
INSERT OR IGNORE INTO resource_tags (resource_id, tag) SELECT id, 'university-access' FROM resources WHERE name = 'IEEE Xplore';

INSERT OR IGNORE INTO resources (name, description, url, link_type, category, access_note, is_favorite) VALUES ('Nuke Non-Commercial', 'Industry-standard compositing software | Regular: $5,000+/year → FREE (saves $5,000+/yr)', NULL, 'website', 'VFX/Compositing', 'Student verification', 0);
INSERT OR IGNORE INTO resource_tags (resource_id, tag) SELECT id, 'free' FROM resources WHERE name = 'Nuke Non-Commercial';
INSERT OR IGNORE INTO resource_tags (resource_id, tag) SELECT id, 'student-verify' FROM resources WHERE name = 'Nuke Non-Commercial';
INSERT OR IGNORE INTO resource_tags (resource_id, tag) SELECT id, 'reddit-find' FROM resources WHERE name = 'Nuke Non-Commercial';

INSERT OR IGNORE INTO resources (name, description, url, link_type, category, access_note, is_favorite) VALUES ('PubMed Central', 'Biomedical and life sciences literature | Regular: $5,000/year → FREE (saves $5,000/yr)', NULL, 'website', 'Medical Research', 'University access', 0);
INSERT OR IGNORE INTO resource_tags (resource_id, tag) SELECT id, 'free' FROM resources WHERE name = 'PubMed Central';
INSERT OR IGNORE INTO resource_tags (resource_id, tag) SELECT id, 'university-access' FROM resources WHERE name = 'PubMed Central';

INSERT OR IGNORE INTO resources (name, description, url, link_type, category, access_note, is_favorite) VALUES ('LexisNexis Academic', 'Legal documents, news, business information | Regular: $4,500/year → FREE (saves $4,500/yr)', NULL, 'website', 'Legal/News Database', 'University subscription', 0);
INSERT OR IGNORE INTO resource_tags (resource_id, tag) SELECT id, 'free' FROM resources WHERE name = 'LexisNexis Academic';
INSERT OR IGNORE INTO resource_tags (resource_id, tag) SELECT id, 'university-access' FROM resources WHERE name = 'LexisNexis Academic';

INSERT OR IGNORE INTO resources (name, description, url, link_type, category, access_note, is_favorite) VALUES ('Autodesk Education Suite', 'AutoCAD, Maya, 3ds Max, Fusion 360 | Regular: $4,000+/year → FREE (saves $4,000+/yr)', NULL, 'website', 'Design/Engineering', 'Student verification', 0);
INSERT OR IGNORE INTO resource_tags (resource_id, tag) SELECT id, 'free' FROM resources WHERE name = 'Autodesk Education Suite';
INSERT OR IGNORE INTO resource_tags (resource_id, tag) SELECT id, 'student-verify' FROM resources WHERE name = 'Autodesk Education Suite';

INSERT OR IGNORE INTO resources (name, description, url, link_type, category, access_note, is_favorite) VALUES ('Federal Employee Discounts', 'Software, travel, entertainment discounts | Regular: $5,000+/year → Varies (saves $2,000+/yr)', NULL, 'website', 'Various', 'Federal ID verification', 0);
INSERT OR IGNORE INTO resource_tags (resource_id, tag) SELECT id, 'discount-varies' FROM resources WHERE name = 'Federal Employee Discounts';
INSERT OR IGNORE INTO resource_tags (resource_id, tag) SELECT id, 'federal-employee' FROM resources WHERE name = 'Federal Employee Discounts';

INSERT OR IGNORE INTO resources (name, description, url, link_type, category, access_note, is_favorite) VALUES ('Government Training Resources', 'Professional development and certification | Regular: $3,000+/year → FREE (saves $3,000+/yr)', NULL, 'website', 'Professional Development', 'Federal employee access', 0);
INSERT OR IGNORE INTO resource_tags (resource_id, tag) SELECT id, 'free' FROM resources WHERE name = 'Government Training Resources';
INSERT OR IGNORE INTO resource_tags (resource_id, tag) SELECT id, 'federal-employee' FROM resources WHERE name = 'Government Training Resources';

INSERT OR IGNORE INTO resources (name, description, url, link_type, category, access_note, is_favorite) VALUES ('Bloomberg Terminal', 'Professional financial data and analytics | Regular: $24,000/year → FREE (saves $24,000/yr)', NULL, 'website', 'Financial Data', 'University business programs', 0);
INSERT OR IGNORE INTO resource_tags (resource_id, tag) SELECT id, 'free' FROM resources WHERE name = 'Bloomberg Terminal';
INSERT OR IGNORE INTO resource_tags (resource_id, tag) SELECT id, 'university-access' FROM resources WHERE name = 'Bloomberg Terminal';
INSERT OR IGNORE INTO resource_tags (resource_id, tag) SELECT id, 'reddit-find' FROM resources WHERE name = 'Bloomberg Terminal';

INSERT OR IGNORE INTO resources (name, description, url, link_type, category, access_note, is_favorite) VALUES ('Unity Pro', 'Professional game development platform | Regular: $2,040/year → FREE (saves $2,040/yr)', NULL, 'website', 'Game Development', 'Student verification', 0);
INSERT OR IGNORE INTO resource_tags (resource_id, tag) SELECT id, 'free' FROM resources WHERE name = 'Unity Pro';
INSERT OR IGNORE INTO resource_tags (resource_id, tag) SELECT id, 'student-verify' FROM resources WHERE name = 'Unity Pro';

INSERT OR IGNORE INTO resources (name, description, url, link_type, category, access_note, is_favorite) VALUES ('AWS Educate', 'Cloud services + hands-on labs | Regular: $1,200+/year → FREE credits (saves $1,200+/yr)', NULL, 'website', 'Cloud Computing', 'Student verification', 0);
INSERT OR IGNORE INTO resource_tags (resource_id, tag) SELECT id, 'free' FROM resources WHERE name = 'AWS Educate';
INSERT OR IGNORE INTO resource_tags (resource_id, tag) SELECT id, 'student-verify' FROM resources WHERE name = 'AWS Educate';

INSERT OR IGNORE INTO resources (name, description, url, link_type, category, access_note, is_favorite) VALUES ('Microsoft Azure', 'Cloud computing and AI services | Regular: $1,200/year → $100 credits (saves $100+/yr)', NULL, 'website', 'Cloud Computing', '18+ with school email', 0);
INSERT OR IGNORE INTO resource_tags (resource_id, tag) SELECT id, 'paid-discount' FROM resources WHERE name = 'Microsoft Azure';

INSERT OR IGNORE INTO resources (name, description, url, link_type, category, access_note, is_favorite) VALUES ('Google Cloud Platform', 'Cloud services and AI/ML tools | Regular: $1,200/year → $300 credits (saves $300+/yr)', NULL, 'website', 'Cloud Computing', 'Student verification', 0);
INSERT OR IGNORE INTO resource_tags (resource_id, tag) SELECT id, 'paid-discount' FROM resources WHERE name = 'Google Cloud Platform';
INSERT OR IGNORE INTO resource_tags (resource_id, tag) SELECT id, 'student-verify' FROM resources WHERE name = 'Google Cloud Platform';
INSERT OR IGNORE INTO resource_tags (resource_id, tag) SELECT id, 'reddit-find' FROM resources WHERE name = 'Google Cloud Platform';

INSERT OR IGNORE INTO resources (name, description, url, link_type, category, access_note, is_favorite) VALUES ('Microsoft 365 Education', 'Full Office suite + Teams + OneDrive + Copilot features | Regular: $720/year → FREE (saves $720/yr)', NULL, 'website', 'Productivity', '.edu email', 0);
INSERT OR IGNORE INTO resource_tags (resource_id, tag) SELECT id, 'free' FROM resources WHERE name = 'Microsoft 365 Education';
INSERT OR IGNORE INTO resource_tags (resource_id, tag) SELECT id, 'edu-email' FROM resources WHERE name = 'Microsoft 365 Education';

INSERT OR IGNORE INTO resources (name, description, url, link_type, category, access_note, is_favorite) VALUES ('Adobe Creative Cloud All Apps', 'Photoshop, Illustrator, Premiere Pro + AI features | Regular: $720/year → $240/year (saves $480/yr)', NULL, 'website', 'Creative', 'Student verification', 0);
INSERT OR IGNORE INTO resource_tags (resource_id, tag) SELECT id, 'paid-discount' FROM resources WHERE name = 'Adobe Creative Cloud All Apps';
INSERT OR IGNORE INTO resource_tags (resource_id, tag) SELECT id, 'student-verify' FROM resources WHERE name = 'Adobe Creative Cloud All Apps';

INSERT OR IGNORE INTO resources (name, description, url, link_type, category, access_note, is_favorite) VALUES ('Perplexity Pro', 'AI research assistant with citations | Regular: $240/year → FREE (up to 24 months) (saves $480/yr)', NULL, 'website', 'AI Search', 'Student verification via SheerID', 0);
INSERT OR IGNORE INTO resource_tags (resource_id, tag) SELECT id, 'free' FROM resources WHERE name = 'Perplexity Pro';
INSERT OR IGNORE INTO resource_tags (resource_id, tag) SELECT id, 'student-verify' FROM resources WHERE name = 'Perplexity Pro';

INSERT OR IGNORE INTO resources (name, description, url, link_type, category, access_note, is_favorite) VALUES ('JetBrains All Products Pack', 'All professional IDEs: IntelliJ, PyCharm, WebStorm, etc. | Regular: $649/year → FREE (saves $649/yr)', NULL, 'website', 'Development', 'Student verification', 0);
INSERT OR IGNORE INTO resource_tags (resource_id, tag) SELECT id, 'free' FROM resources WHERE name = 'JetBrains All Products Pack';
INSERT OR IGNORE INTO resource_tags (resource_id, tag) SELECT id, 'student-verify' FROM resources WHERE name = 'JetBrains All Products Pack';

INSERT OR IGNORE INTO resources (name, description, url, link_type, category, access_note, is_favorite) VALUES ('MongoDB Atlas', 'Cloud database service | Regular: $600/year → FREE tier + credits (saves $200+/yr)', NULL, 'website', 'Database', 'Student verification', 0);
INSERT OR IGNORE INTO resource_tags (resource_id, tag) SELECT id, 'free' FROM resources WHERE name = 'MongoDB Atlas';
INSERT OR IGNORE INTO resource_tags (resource_id, tag) SELECT id, 'student-verify' FROM resources WHERE name = 'MongoDB Atlas';

INSERT OR IGNORE INTO resources (name, description, url, link_type, category, access_note, is_favorite) VALUES ('DigitalOcean', 'Simple cloud hosting and deployment | Regular: $600/year → FREE credits (saves $200+/yr)', NULL, 'website', 'Cloud Hosting', 'GitHub Student Pack', 0);
INSERT OR IGNORE INTO resource_tags (resource_id, tag) SELECT id, 'free' FROM resources WHERE name = 'DigitalOcean';
INSERT OR IGNORE INTO resource_tags (resource_id, tag) SELECT id, 'student-verify' FROM resources WHERE name = 'DigitalOcean';

INSERT OR IGNORE INTO resources (name, description, url, link_type, category, access_note, is_favorite) VALUES ('Heroku', 'App deployment and hosting | Regular: $300/year → FREE tier (saves $300/yr)', NULL, 'website', 'App Deployment', 'Account creation', 0);
INSERT OR IGNORE INTO resource_tags (resource_id, tag) SELECT id, 'free' FROM resources WHERE name = 'Heroku';
INSERT OR IGNORE INTO resource_tags (resource_id, tag) SELECT id, 'free-account' FROM resources WHERE name = 'Heroku';

INSERT OR IGNORE INTO resources (name, description, url, link_type, category, access_note, is_favorite) VALUES ('Typeform Pro', 'Professional form builder and surveys | Regular: $300/year → Student discounts (saves $100+/yr)', NULL, 'website', 'Forms/Surveys', 'Student verification', 0);
INSERT OR IGNORE INTO resource_tags (resource_id, tag) SELECT id, 'paid-discount' FROM resources WHERE name = 'Typeform Pro';
INSERT OR IGNORE INTO resource_tags (resource_id, tag) SELECT id, 'student-verify' FROM resources WHERE name = 'Typeform Pro';

INSERT OR IGNORE INTO resources (name, description, url, link_type, category, access_note, is_favorite) VALUES ('Mailchimp Pro', 'Email marketing and automation | Regular: $300/year → Student discounts (saves $100+/yr)', NULL, 'website', 'Email Marketing', 'Student verification', 0);
INSERT OR IGNORE INTO resource_tags (resource_id, tag) SELECT id, 'paid-discount' FROM resources WHERE name = 'Mailchimp Pro';
INSERT OR IGNORE INTO resource_tags (resource_id, tag) SELECT id, 'student-verify' FROM resources WHERE name = 'Mailchimp Pro';

INSERT OR IGNORE INTO resources (name, description, url, link_type, category, access_note, is_favorite) VALUES ('DataCamp Premium', 'Data science and programming courses | Regular: $300/year → $150/year (saves $150/yr)', NULL, 'website', 'Learning', 'Student verification', 0);
INSERT OR IGNORE INTO resource_tags (resource_id, tag) SELECT id, 'paid-discount' FROM resources WHERE name = 'DataCamp Premium';
INSERT OR IGNORE INTO resource_tags (resource_id, tag) SELECT id, 'student-verify' FROM resources WHERE name = 'DataCamp Premium';

INSERT OR IGNORE INTO resources (name, description, url, link_type, category, access_note, is_favorite) VALUES ('DaVinci Resolve Studio', 'Professional video editing and color grading | Regular: $295 → FREE (saves $295/yr)', NULL, 'website', 'Video Editing', 'No verification needed', 0);
INSERT OR IGNORE INTO resource_tags (resource_id, tag) SELECT id, 'free' FROM resources WHERE name = 'DaVinci Resolve Studio';
INSERT OR IGNORE INTO resource_tags (resource_id, tag) SELECT id, 'no-signup-required' FROM resources WHERE name = 'DaVinci Resolve Studio';
INSERT OR IGNORE INTO resource_tags (resource_id, tag) SELECT id, 'reddit-find' FROM resources WHERE name = 'DaVinci Resolve Studio';

INSERT OR IGNORE INTO resources (name, description, url, link_type, category, access_note, is_favorite) VALUES ('Airtable Pro', 'Advanced database and project management | Regular: $240/year → $120/year (saves $120/yr)', NULL, 'website', 'Database', 'Student verification', 0);
INSERT OR IGNORE INTO resource_tags (resource_id, tag) SELECT id, 'paid-discount' FROM resources WHERE name = 'Airtable Pro';
INSERT OR IGNORE INTO resource_tags (resource_id, tag) SELECT id, 'student-verify' FROM resources WHERE name = 'Airtable Pro';

INSERT OR IGNORE INTO resources (name, description, url, link_type, category, access_note, is_favorite) VALUES ('Google One AI Premium', 'Gemini Advanced + 2TB storage + NotebookLM | Regular: $240/year → FREE (1 year) (saves $240/yr)', NULL, 'website', 'AI Tools', 'US college students with .edu', 0);
INSERT OR IGNORE INTO resource_tags (resource_id, tag) SELECT id, 'free' FROM resources WHERE name = 'Google One AI Premium';
INSERT OR IGNORE INTO resource_tags (resource_id, tag) SELECT id, 'edu-email' FROM resources WHERE name = 'Google One AI Premium';

INSERT OR IGNORE INTO resources (name, description, url, link_type, category, access_note, is_favorite) VALUES ('Substance Painter/Designer', 'Industry-standard 3D texturing tools | Regular: $240/year → FREE (1 year) (saves $240/yr)', NULL, 'website', '3D Design', 'Student verification', 0);
INSERT OR IGNORE INTO resource_tags (resource_id, tag) SELECT id, 'free' FROM resources WHERE name = 'Substance Painter/Designer';
INSERT OR IGNORE INTO resource_tags (resource_id, tag) SELECT id, 'student-verify' FROM resources WHERE name = 'Substance Painter/Designer';
INSERT OR IGNORE INTO resource_tags (resource_id, tag) SELECT id, 'reddit-find' FROM resources WHERE name = 'Substance Painter/Designer';

INSERT OR IGNORE INTO resources (name, description, url, link_type, category, access_note, is_favorite) VALUES ('Cloudflare', 'CDN, security, DNS services | Regular: $240/year → FREE tier (saves $240/yr)', NULL, 'website', 'Web Services', 'Account creation', 0);
INSERT OR IGNORE INTO resource_tags (resource_id, tag) SELECT id, 'free' FROM resources WHERE name = 'Cloudflare';
INSERT OR IGNORE INTO resource_tags (resource_id, tag) SELECT id, 'free-account' FROM resources WHERE name = 'Cloudflare';

INSERT OR IGNORE INTO resources (name, description, url, link_type, category, access_note, is_favorite) VALUES ('Figma Professional', 'Professional UI/UX design and prototyping | Regular: $180/year → FREE (saves $180/yr)', NULL, 'website', 'Design', 'Education domain email', 0);
INSERT OR IGNORE INTO resource_tags (resource_id, tag) SELECT id, 'free' FROM resources WHERE name = 'Figma Professional';

INSERT OR IGNORE INTO resources (name, description, url, link_type, category, access_note, is_favorite) VALUES ('Zoom Pro', 'Professional video conferencing | Regular: $180/year → FREE (saves $180/yr)', NULL, 'website', 'Video Conferencing', 'Educational institution', 0);
INSERT OR IGNORE INTO resource_tags (resource_id, tag) SELECT id, 'free' FROM resources WHERE name = 'Zoom Pro';

INSERT OR IGNORE INTO resources (name, description, url, link_type, category, access_note, is_favorite) VALUES ('Framer', 'Advanced prototyping and design | Regular: $180/year → FREE (saves $180/yr)', NULL, 'website', 'Interactive Design', 'Student verification', 0);
INSERT OR IGNORE INTO resource_tags (resource_id, tag) SELECT id, 'free' FROM resources WHERE name = 'Framer';
INSERT OR IGNORE INTO resource_tags (resource_id, tag) SELECT id, 'student-verify' FROM resources WHERE name = 'Framer';

INSERT OR IGNORE INTO resources (name, description, url, link_type, category, access_note, is_favorite) VALUES ('InVision', 'Design workflow and collaboration | Regular: $180/year → FREE (saves $180/yr)', NULL, 'website', 'Design Collaboration', 'Student verification', 0);
INSERT OR IGNORE INTO resource_tags (resource_id, tag) SELECT id, 'free' FROM resources WHERE name = 'InVision';
INSERT OR IGNORE INTO resource_tags (resource_id, tag) SELECT id, 'student-verify' FROM resources WHERE name = 'InVision';

INSERT OR IGNORE INTO resources (name, description, url, link_type, category, access_note, is_favorite) VALUES ('Grammarly Premium', 'AI writing assistant and grammar checker | Regular: $144/year → Varies (saves $50+/yr)', NULL, 'website', 'Writing', 'Institutional partnerships', 0);
INSERT OR IGNORE INTO resource_tags (resource_id, tag) SELECT id, 'discount-varies' FROM resources WHERE name = 'Grammarly Premium';

INSERT OR IGNORE INTO resources (name, description, url, link_type, category, access_note, is_favorite) VALUES ('Amazon Prime Student', 'Free shipping, Prime Video, music | Regular: $139/year → FREE (6 months) (saves $70/yr)', NULL, 'website', 'Shopping/Entertainment', '.edu email', 0);
INSERT OR IGNORE INTO resource_tags (resource_id, tag) SELECT id, 'free' FROM resources WHERE name = 'Amazon Prime Student';
INSERT OR IGNORE INTO resource_tags (resource_id, tag) SELECT id, 'edu-email' FROM resources WHERE name = 'Amazon Prime Student';

INSERT OR IGNORE INTO resources (name, description, url, link_type, category, access_note, is_favorite) VALUES ('Sketch', 'UI/UX design tool for Mac | Regular: $120/year → $60/year (saves $60/yr)', NULL, 'website', 'Design (macOS)', 'Student verification', 0);
INSERT OR IGNORE INTO resource_tags (resource_id, tag) SELECT id, 'paid-discount' FROM resources WHERE name = 'Sketch';
INSERT OR IGNORE INTO resource_tags (resource_id, tag) SELECT id, 'student-verify' FROM resources WHERE name = 'Sketch';

INSERT OR IGNORE INTO resources (name, description, url, link_type, category, access_note, is_favorite) VALUES ('Spotify Premium', 'Music streaming with offline access | Regular: $120/year → $60/year (saves $60/yr)', NULL, 'website', 'Music Streaming', '18+ enrolled student', 0);
INSERT OR IGNORE INTO resource_tags (resource_id, tag) SELECT id, 'paid-discount' FROM resources WHERE name = 'Spotify Premium';
INSERT OR IGNORE INTO resource_tags (resource_id, tag) SELECT id, 'student-verify' FROM resources WHERE name = 'Spotify Premium';

INSERT OR IGNORE INTO resources (name, description, url, link_type, category, access_note, is_favorite) VALUES ('Notion AI', 'AI-powered note-taking and organization | Regular: $120/year → FREE (saves $120/yr)', NULL, 'website', 'Productivity', 'Student verification', 0);
INSERT OR IGNORE INTO resource_tags (resource_id, tag) SELECT id, 'free' FROM resources WHERE name = 'Notion AI';
INSERT OR IGNORE INTO resource_tags (resource_id, tag) SELECT id, 'student-verify' FROM resources WHERE name = 'Notion AI';

INSERT OR IGNORE INTO resources (name, description, url, link_type, category, access_note, is_favorite) VALUES ('Canva Pro', 'Professional design templates and AI features | Regular: $120/year → FREE (saves $120/yr)', NULL, 'website', 'Design', 'K-12 free, university partnerships', 0);
INSERT OR IGNORE INTO resource_tags (resource_id, tag) SELECT id, 'free' FROM resources WHERE name = 'Canva Pro';
INSERT OR IGNORE INTO resource_tags (resource_id, tag) SELECT id, 'university-access' FROM resources WHERE name = 'Canva Pro';

INSERT OR IGNORE INTO resources (name, description, url, link_type, category, access_note, is_favorite) VALUES ('Miro Team', 'Visual collaboration and whiteboarding | Regular: $120/year → FREE (saves $120/yr)', NULL, 'website', 'Visual Collaboration', 'Student verification', 0);
INSERT OR IGNORE INTO resource_tags (resource_id, tag) SELECT id, 'free' FROM resources WHERE name = 'Miro Team';
INSERT OR IGNORE INTO resource_tags (resource_id, tag) SELECT id, 'student-verify' FROM resources WHERE name = 'Miro Team';

INSERT OR IGNORE INTO resources (name, description, url, link_type, category, access_note, is_favorite) VALUES ('Lucidchart Education', 'Professional flowcharts and diagrams | Regular: $120/year → FREE (saves $120/yr)', NULL, 'website', 'Diagramming', 'Education email', 0);
INSERT OR IGNORE INTO resource_tags (resource_id, tag) SELECT id, 'free' FROM resources WHERE name = 'Lucidchart Education';

INSERT OR IGNORE INTO resources (name, description, url, link_type, category, access_note, is_favorite) VALUES ('Discord Nitro', 'Enhanced Discord features | Regular: $120/year → Occasional FREE (saves $120/yr)', NULL, 'website', 'Communication', 'Via partnerships (GitHub Pack)', 0);
INSERT OR IGNORE INTO resource_tags (resource_id, tag) SELECT id, 'free' FROM resources WHERE name = 'Discord Nitro';

INSERT OR IGNORE INTO resources (name, description, url, link_type, category, access_note, is_favorite) VALUES ('Julius AI', 'AI-powered data analysis assistant | Regular: $120/year → $60/year (saves $60/yr)', NULL, 'website', 'AI Data Analysis', 'Academic verification', 0);
INSERT OR IGNORE INTO resource_tags (resource_id, tag) SELECT id, 'paid-discount' FROM resources WHERE name = 'Julius AI';

INSERT OR IGNORE INTO resources (name, description, url, link_type, category, access_note, is_favorite) VALUES ('Requestly', 'API mocking and testing tool | Regular: $120/year → FREE (saves $120/yr)', NULL, 'website', 'API Testing', 'Student verification', 0);
INSERT OR IGNORE INTO resource_tags (resource_id, tag) SELECT id, 'free' FROM resources WHERE name = 'Requestly';
INSERT OR IGNORE INTO resource_tags (resource_id, tag) SELECT id, 'student-verify' FROM resources WHERE name = 'Requestly';
INSERT OR IGNORE INTO resource_tags (resource_id, tag) SELECT id, 'reddit-find' FROM resources WHERE name = 'Requestly';

INSERT OR IGNORE INTO resources (name, description, url, link_type, category, access_note, is_favorite) VALUES ('Humata', 'PDF analysis and AI document processing | Regular: $120/year → $24/year (saves $96/yr)', NULL, 'website', 'AI Document Analysis', 'Student verification', 0);
INSERT OR IGNORE INTO resource_tags (resource_id, tag) SELECT id, 'paid-discount' FROM resources WHERE name = 'Humata';
INSERT OR IGNORE INTO resource_tags (resource_id, tag) SELECT id, 'student-verify' FROM resources WHERE name = 'Humata';

INSERT OR IGNORE INTO resources (name, description, url, link_type, category, access_note, is_favorite) VALUES ('Otter.ai Pro', 'AI meeting transcription and notes | Regular: $120/year → $100/year (saves $20/yr)', NULL, 'website', 'Transcription', 'Student verification', 0);
INSERT OR IGNORE INTO resource_tags (resource_id, tag) SELECT id, 'paid-discount' FROM resources WHERE name = 'Otter.ai Pro';
INSERT OR IGNORE INTO resource_tags (resource_id, tag) SELECT id, 'student-verify' FROM resources WHERE name = 'Otter.ai Pro';

INSERT OR IGNORE INTO resources (name, description, url, link_type, category, access_note, is_favorite) VALUES ('Slack Standard', 'Team communication and collaboration | Regular: $96/year → FREE (saves $96/yr)', NULL, 'website', 'Communication', 'Student team verification', 0);
INSERT OR IGNORE INTO resource_tags (resource_id, tag) SELECT id, 'free' FROM resources WHERE name = 'Slack Standard';
INSERT OR IGNORE INTO resource_tags (resource_id, tag) SELECT id, 'student-verify' FROM resources WHERE name = 'Slack Standard';

INSERT OR IGNORE INTO resources (name, description, url, link_type, category, access_note, is_favorite) VALUES ('Wolfram Alpha Pro', 'Advanced computational engine | Regular: $60/year → FREE (saves $60/yr)', NULL, 'website', 'Math/Science', 'Some universities provide access', 0);
INSERT OR IGNORE INTO resource_tags (resource_id, tag) SELECT id, 'free' FROM resources WHERE name = 'Wolfram Alpha Pro';
INSERT OR IGNORE INTO resource_tags (resource_id, tag) SELECT id, 'reddit-find' FROM resources WHERE name = 'Wolfram Alpha Pro';

INSERT OR IGNORE INTO resources (name, description, url, link_type, category, access_note, is_favorite) VALUES ('LinkedIn Premium', 'Professional networking and job search | Regular: $360/year → FREE (1 month) (saves $30/yr)', NULL, 'website', 'Professional', 'Any LinkedIn account', 0);
INSERT OR IGNORE INTO resource_tags (resource_id, tag) SELECT id, 'free' FROM resources WHERE name = 'LinkedIn Premium';

INSERT OR IGNORE INTO resources (name, description, url, link_type, category, access_note, is_favorite) VALUES ('Krita', 'Professional digital painting software', NULL, 'website', 'Digital Art', 'No verification', 0);
INSERT OR IGNORE INTO resource_tags (resource_id, tag) SELECT id, 'free' FROM resources WHERE name = 'Krita';
INSERT OR IGNORE INTO resource_tags (resource_id, tag) SELECT id, 'no-signup-required' FROM resources WHERE name = 'Krita';
INSERT OR IGNORE INTO resource_tags (resource_id, tag) SELECT id, 'reddit-find' FROM resources WHERE name = 'Krita';

INSERT OR IGNORE INTO resources (name, description, url, link_type, category, access_note, is_favorite) VALUES ('Blender', 'Professional 3D modeling and animation', NULL, 'website', '3D Modeling', 'No verification', 0);
INSERT OR IGNORE INTO resource_tags (resource_id, tag) SELECT id, 'free' FROM resources WHERE name = 'Blender';
INSERT OR IGNORE INTO resource_tags (resource_id, tag) SELECT id, 'no-signup-required' FROM resources WHERE name = 'Blender';
