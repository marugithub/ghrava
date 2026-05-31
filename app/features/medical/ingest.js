'use strict';
// ─────────────────────────────────────────────────────────────────────
// features/medical/ingest.js  —  Raw health record → structured sections
//
// Front-end for POST /api/v1/medical/ingest. Takes an uploaded file
// buffer, extracts text, detects the source health system, parses it
// into the SAME section shape that bulk-seed consumes
// ({conditions, medications, labs, vitals, diagnostics, allergies}),
// and normalizes field names onto the seed-routes.js importers.
//
// Parser logic adapted from the medical-input-processor package
// (Z:\ghrava\medical-input-processor.zip). Differences from that package:
//   • Text extraction uses Node `pdf-parse` (like eob-parser.js) — NOT
//     Python pdfplumber. No container deps, no shelling out.
//   • The package's `UpsertAll` + parallel `health_*` schema are DROPPED.
//     Parsed sections feed the existing med_* importers instead.
//
// NOTE: parsers are heuristic + source-specific (Samsung Health export
// from Ascension, imaging reports, Rx labels, generic-lab fallback).
// Always dry-run a new document type before trusting the write.
// ─────────────────────────────────────────────────────────────────────

// ═══════════════════════════════════════════════════════════════════
// EXTRACTORS  (file buffer → plain text)
// ═══════════════════════════════════════════════════════════════════
async function extractText(buffer, filename) {
  const ext = String(filename || '').split('.').pop().toLowerCase();
  if (ext === 'pdf') {
    let pdfParse;
    try { pdfParse = require('pdf-parse'); }
    catch (e) { throw new Error('pdf-parse not installed. Run: docker compose up --build -d'); }
    const data = await pdfParse(buffer);
    return { fileType: 'pdf', text: data.text || '' };
  }
  if (ext === 'html' || ext === 'htm') {
    return { fileType: ext, text: stripHtml(buffer.toString('utf8')) };
  }
  if (ext === 'txt' || ext === 'csv') {
    return { fileType: ext, text: buffer.toString('utf8') };
  }
  // Images / zips need OCR / archive expansion (Python in the original
  // package). Out of scope for Slice 1 — surface a clear error.
  throw new Error(`Unsupported file type for ingest: .${ext} (supported: pdf, html, txt, csv)`);
}

function stripHtml(raw) {
  return raw
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ').replace(/&#\d+;/g, ' ')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n\s*\n+/g, '\n')
    .trim();
}

// ═══════════════════════════════════════════════════════════════════
// SOURCE DETECTION
// ═══════════════════════════════════════════════════════════════════
function detectSource(text) {
  if (!text || text.length < 10) return 'unknown';
  const t = text.toLowerCase();

  if (t.includes('samsung health') && t.includes('health records')) return 'samsung-health';

  if (t.includes('continuityofcaredocument') ||
      (t.includes('ascension') && t.includes('ccd')) ||
      t.includes('patient demographics')) return 'athena-ccd';

  if (t.includes('impression:') || t.includes('findings:') ||
      t.includes('lvef') || t.includes('calcium score') ||
      t.includes('ejection fraction') || t.includes('myocardial') ||
      t.includes('normal sinus rhythm')) return 'imaging';

  if ((t.includes('mg') || t.includes('tablet') || t.includes('capsule')) &&
      (t.includes('take') && t.includes('by mouth'))) return 'prescription';

  if (t.includes('chief complaint') || t.includes('assessment:') ||
      t.includes('plan:') || t.includes('subjective:') ||
      t.includes('objective:')) return 'visit-note';

  if (t.includes('athenahealth') || t.includes('ascension alabama') ||
      t.includes('test results')) return 'ascension';

  return 'unknown';
}

// ═══════════════════════════════════════════════════════════════════
// PARSERS  (text → { section: [rows] })
// ═══════════════════════════════════════════════════════════════════
const SamsungHealthParser = {
  parse(text, opts = {}) {
    const result = { labs: [], vitals: [], conditions: [], medications: [], visits: [], allergies: [] };
    const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
    let section = null, currentDate = null, currentFacility = null;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (/^1\.\s+Allergies/i.test(line))   { section = 'allergies';   continue; }
      if (/^2\.\s+Conditions/i.test(line))  { section = 'conditions';  continue; }
      if (/^3\.\s+Lab results/i.test(line)) { section = 'labs';        continue; }
      if (/^4\.\s+Medications/i.test(line)) { section = 'medications'; continue; }
      if (/^5\.\s+Visits/i.test(line))      { section = 'visits';      continue; }
      if (/^6\.\s+Vitals/i.test(line))      { section = 'vitals';      continue; }
      if (/^Date\s+(Name|Medication|Title)/i.test(line)) continue;

      const dateMatch = line.match(/^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{1,2}(,\s+\d{4})?/i);
      if (dateMatch) {
        currentDate = parseHealthDate(line);
        const facLine = lines[i + 1] || '';
        if (facLine.includes('(') && facLine.includes(')')) { currentFacility = facLine.trim(); i++; }
        continue;
      }
      if (!section || !currentDate) continue;

      if (section === 'labs') {
        const m = line.match(/^(.+?)\s+([\d\.><]+)\s*([a-zA-Z\/\%\.]+)?$/);
        if (m && !['NP','Date','Value','Reference','Remarks'].includes(m[2])) {
          const numeric = parseFloat(m[2].trim());
          result.labs.push({
            panel_name: detectPanel(m[1].trim()), test_name: m[1].trim(),
            value: m[2].trim(), value_numeric: isNaN(numeric) ? null : numeric,
            unit: m[3] ? m[3].trim() : '', flag: detectFlag(m[1].trim(), numeric),
            test_date: currentDate, facility: currentFacility,
            source_system: 'Samsung Health / Ascension',
          });
        }
      } else if (section === 'conditions') {
        if (['Active','Completed','Stopped'].includes(line)) continue;
        if (line.length > 3 && !/^(Date|Status|Severity|Practitioner)$/.test(line)) {
          const status = (lines[i + 1] || '').trim();
          result.conditions.push({
            name: line,
            status: ['Active','Resolved','Historical'].includes(status) ? status : 'Active',
            first_noted: currentDate, source_system: 'Samsung Health / Ascension',
          });
          if (['Active','Resolved','Historical'].includes(status)) i++;
        }
      } else if (section === 'medications') {
        if (/^(Date|Medication|Status|Prescribed)/.test(line)) continue;
        const status = (lines[i + 1] || '').trim();
        const isStatus = ['Active','Completed','Unknown','Stopped','Draft'].includes(status);
        result.medications.push({
          name: line, status: isStatus ? status.toLowerCase() : 'unknown',
          rx_date: currentDate, source_system: 'Samsung Health / Ascension',
        });
        if (isStatus) i++;
      } else if (section === 'vitals') {
        const v = parseVitalLine(line, currentDate, currentFacility);
        if (v) result.vitals.push(v);
      } else if (section === 'visits') {
        if (line.length > 3 && !/^(Date|Title|Practitioner)$/.test(line)) {
          result.visits.push({
            visit_date: currentDate,
            visit_type: line.includes('ambulatory') ? 'ambulatory' : 'virtual',
            visit_subtype: line, facility: currentFacility,
            notes: '[Imported from Samsung Health export]',
            source_system: 'Samsung Health / Ascension',
          });
        }
      }
    }
    return result;
  },
};

const ImagingParser = {
  parse(text) {
    const t = text.toLowerCase();
    let testName = 'Unknown Imaging Study', testType = 'imaging', keyValues = {};

    if (t.includes('calcium score') || t.includes('coronary calcium')) {
      testName = 'CT Coronary Calcium Score'; testType = 'cardiac';
      const score = text.match(/TOTAL[^:]*SCORE[:\s]*([\d\.]+)/i) || text.match(/calcium score[:\s]*([\d\.]+)/i);
      const pct = text.match(/percentile[^:]*:\s*([\d\-]+)/i);
      keyValues = { total_score: score ? parseFloat(score[1]) : null, percentile: pct ? pct[1] : null };
    } else if (t.includes('nuclear') || t.includes('myocardial perfusion') || t.includes('spect')) {
      testName = 'Nuclear Stress Test'; testType = 'cardiac';
      const lvef = text.match(/ejection fraction[^%]*?([\d]+)\s*%/i) || text.match(/LVEF[:\s]*([\d]+)/i);
      keyValues = { lvef: lvef ? parseInt(lvef[1]) : null, ischemia: t.includes('negative for ischemia') ? 'negative' : 'see report' };
    } else if (t.includes('echocardiogram') || t.includes('transthoracic') || t.includes('ejection fraction')) {
      testName = 'Echocardiogram'; testType = 'cardiac';
      const ef = text.match(/ejection fraction[^\d]*([\d]+)\s*[-–]\s*([\d]+)\s*%/i) || text.match(/EF[:\s]*([\d]+)\s*%/i);
      keyValues = { ef_low: ef ? parseInt(ef[1]) : null, ef_high: ef && ef[2] ? parseInt(ef[2]) : null };
    } else if (t.includes('mri') && t.includes('brain')) {
      testName = 'MRI Brain'; testType = 'neurological';
      keyValues = { normal: t.includes('normal') || t.includes('within normal limits') };
    } else if (t.includes('carotid') || t.includes('duplex')) {
      testName = 'Carotid Artery Duplex Ultrasound'; testType = 'vascular';
    } else if (t.includes('holter')) {
      testName = 'Holter Monitor'; testType = 'cardiac';
    } else if (t.includes('nsr') || t.includes('normal sinus rhythm') || t.includes('qrs')) {
      testName = 'EKG / Electrocardiogram'; testType = 'cardiac';
      const hr = text.match(/heart rate[:\s]*([\d]+)\s*bpm/i);
      keyValues = { heart_rate: hr ? parseInt(hr[1]) : null };
    }

    const impression = extractSection(text, 'IMPRESSION') || extractSection(text, 'Study Conclusions') ||
                       extractSection(text, 'Imaging Interpretation') || '';
    const dm = text.match(/(\d{1,2}\/\d{1,2}\/\d{4})/);
    const order = text.match(/(?:Ordered by|Ordering Physician)[:\s]+([A-Za-z\s\.,]+?)(?:\n|MD|DO)/i);

    return { diagnostics: [{
      test_name: testName, test_type: testType,
      test_date: dm ? parseSlashDate(dm[1]) : null, status: 'final',
      result: impression.slice(0, 500), interpretation: impression,
      ordered_by: order ? order[1].trim() : null,
      notes: JSON.stringify(keyValues), source_system: 'Imaging / Ascension',
    }]};
  },
};

const LabResultParser = {
  parse(text) {
    const labs = [];
    const lines = text.split('\n');
    let currentDate = null;
    const LAB = /^([A-Za-z][A-Za-z\s\(\)\/,\-]+?)\s+([\d\.><]+)\s*([a-zA-Z\/\%\.]{1,10})?/;
    const DATE = /(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{1,2}(,\s+\d{4})?/i;
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      if (trimmed.match(DATE)) { currentDate = parseHealthDate(trimmed); continue; }
      const lm = trimmed.match(LAB);
      if (lm) {
        const testName = lm[1].trim(), value = lm[2].trim();
        const numeric = parseFloat(value);
        if (testName.length < 3 || testName.length > 80) continue;
        if (['Date','Name','Value','Reference','Remarks','Test'].includes(testName)) continue;
        labs.push({
          panel_name: detectPanel(testName), test_name: testName, value,
          value_numeric: isNaN(numeric) ? null : numeric, unit: lm[3] ? lm[3].trim() : '',
          flag: detectFlag(testName, numeric),
          test_date: currentDate || todayYmd(), source_system: 'Imported',
        });
      }
    }
    return { labs };
  },
};

const PrescriptionParser = {
  parse(text) {
    const med = text.match(/^([A-Z][A-Z\s]+)\s+([\d\.]+\s*MG)/m) || text.match(/^([A-Z][A-Za-z\s]+)\s+([\d\.]+\s*mg)/m);
    if (!med) return { medications: [] };
    const dir = text.match(/Take\s+.+?(?:\.|$)/im);
    const brand = text.match(/Common brand[^\:]*:\s*(.+)/i);
    return { medications: [{
      name: med[1].trim(), dose: med[2].replace(/\s*mg/i, '').trim(), dose_unit: 'mg',
      brand_name: brand ? brand[1].trim() : null,
      directions: dir ? dir[0].trim() : null, status: 'active',
      source_system: 'Prescription label',
    }]};
  },
};

const PARSERS = {
  'samsung-health': SamsungHealthParser,
  'athena-ccd':     LabResultParser,
  'ascension':      LabResultParser,
  'imaging':        ImagingParser,
  'prescription':   PrescriptionParser,
  'visit-note':     LabResultParser,
  'unknown':        LabResultParser,   // best-effort fallback
};

// ═══════════════════════════════════════════════════════════════════
// NORMALIZE  (parser field names → seed-routes.js importer field names)
// Most fields already match; only a couple need remapping. Sections the
// importers don't read (e.g. `visits`) are passed through untouched for
// the caller to count/report but are not imported.
// ═══════════════════════════════════════════════════════════════════
function normalizeForImporters(parsed) {
  const out = { ...parsed };
  if (Array.isArray(parsed.medications)) {
    out.medications = parsed.medications.map(m => ({
      ...m,
      // importer reads `frequency`; the Rx parser produces `directions`
      frequency: m.frequency || m.directions || null,
    }));
  }
  if (Array.isArray(parsed.diagnostics)) {
    out.diagnostics = parsed.diagnostics.map(d => ({
      ...d,
      // importer column is `impression`; imaging parser emits result/interpretation
      impression: d.impression || d.interpretation || d.result || null,
    }));
  }
  return out;
}

// ═══════════════════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════════════════
async function process(buffer, filename) {
  const { fileType, text } = await extractText(buffer, filename);
  const source = detectSource(text);
  const parser = PARSERS[source] || PARSERS.unknown;
  let parsed = {};
  try { parsed = parser.parse(text); }
  catch (e) { parsed = { _parse_error: e.message }; }
  const sections = normalizeForImporters(parsed);
  return { fileType, source, chars: text.length, sections };
}

// ═══════════════════════════════════════════════════════════════════
// SHARED UTILITIES  (verbatim from the package)
// ═══════════════════════════════════════════════════════════════════
const MONTHS = { jan:1,feb:2,mar:3,apr:4,may:5,jun:6,jul:7,aug:8,sep:9,oct:10,nov:11,dec:12 };
function pad(n) { return String(n).padStart(2, '0'); }
function todayYmd() { return new Date().toISOString().split('T')[0]; }

function parseHealthDate(str) {
  const slash = str.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (slash) return `${slash[3]}-${pad(slash[1])}-${pad(slash[2])}`;
  const long = str.match(/(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{1,2}),?\s+(\d{4})/i);
  if (long) return `${long[3]}-${pad(MONTHS[long[1].toLowerCase()])}-${pad(long[2])}`;
  const short = str.match(/(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{1,2})/i);
  if (short) return `${new Date().getFullYear()}-${pad(MONTHS[short[1].toLowerCase()])}-${pad(short[2])}`;
  return null;
}
function parseSlashDate(str) {
  const m = str.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  return m ? `${m[3]}-${pad(m[1])}-${pad(m[2])}` : null;
}

const PANEL_MAP = {
  'hdl':'Lipid Panel','ldl':'Lipid Panel','triglycerides':'Lipid Panel','cholesterol':'Lipid Panel',
  'vldl':'Lipid Panel','lipoprotein':'Lipid Panel','hemoglobin a1c':'Diabetes','a1c':'Diabetes',
  'glucose':'CMP','bun':'CMP','creatinine':'CMP','egfr':'CMP','sodium':'CMP','potassium':'CMP',
  'calcium':'CMP','co2':'CMP','chloride':'CMP','carbon dioxide':'CMP','albumin':'LFT','alt':'LFT',
  'ast':'LFT','alkaline phosphatase':'LFT','bilirubin':'LFT','tsh':'Thyroid','free t4':'Thyroid',
  'free t3':'Thyroid','t4':'Thyroid','wbc':'CBC','rbc':'CBC','hemoglobin':'CBC','hematocrit':'CBC',
  'platelets':'CBC','mcv':'CBC','mch':'CBC','mchc':'CBC','testosterone':'Other','vitamin d':'Other',
  'vitamin b12':'Other','folate':'Other','b12':'Other',
};
function detectPanel(testName) {
  const key = testName.toLowerCase();
  for (const [k, v] of Object.entries(PANEL_MAP)) if (key.includes(k)) return v;
  return 'Other';
}

const REFERENCE_RANGES = {
  'hdl cholesterol':{low:40},'ldl chol calc':{high:100},'triglycerides':{high:150},
  'cholesterol, total':{high:200},'hemoglobin a1c':{high:5.7},'glucose':{high:100},
  'tsh':{low:0.4,high:4.0},'free t4':{low:0.8,high:1.8},'alt (sgpt)':{high:40},
  'ast (sgot)':{high:40},'vitamin d, 25-hydroxy':{low:40},'testosterone':{low:300,high:1000},
};
function detectFlag(testName, numeric) {
  if (isNaN(numeric)) return null;
  const key = testName.toLowerCase();
  for (const [k, ref] of Object.entries(REFERENCE_RANGES)) {
    if (key.includes(k.split(' ')[0])) {
      if (ref.high && numeric > ref.high) return 'H';
      if (ref.low && numeric < ref.low) return 'L';
      return 'normal';
    }
  }
  return null;
}

function parseVitalLine(line, date, facility) {
  const v = { measure_date: date, facility, source_system: 'Samsung Health' };
  const bp = line.match(/(\d{2,3})\s+millimeter.*?(\d{2,3})\s+millimeter/i);
  if (bp) { v.systolic_bp = parseInt(bp[1]); v.diastolic_bp = parseInt(bp[2]); }
  const hr = line.match(/(\d{2,3})\s+(?:beats|bpm)/i);
  if (hr) v.heart_rate = parseInt(hr[1]);
  const wt = line.match(/([\d\.]+)\s+(?:lbs|pounds)/i);
  if (wt) v.weight_lbs = parseFloat(wt[1]);
  const bmi = line.match(/([\d\.]+)\s+kilogram/i);
  if (bmi) v.bmi = parseFloat(bmi[1]);
  const o2 = line.match(/([\d\.]+)\s+percent/i);
  if (o2) v.o2_sat = parseFloat(o2[1]);
  const temp = line.match(/([\d\.]+)\s*[fF]\b/);
  if (temp) v.temperature_f = parseFloat(temp[1]);
  return (v.systolic_bp || v.heart_rate || v.weight_lbs || v.bmi) ? v : null;
}

function extractSection(text, heading) {
  const re = new RegExp(`${heading}[:\\s]*([\\s\\S]*?)(?=\\n[A-Z]{3,}[:\\s]|$)`, 'i');
  const m = text.match(re);
  return m ? m[1].trim().slice(0, 2000) : null;
}

module.exports = { process, extractText, detectSource };
