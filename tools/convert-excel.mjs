// Converts the district team Excel into clubs and functionaries rows.
// Phone numbers and emails in the Excel are never read into the output.
//
// Usage: node tools/convert-excel.mjs [path-to-xlsx]
// Writes tools/out/excel-converted.json and docs/3110-Website-Excel-Data-Conversion-Report.md

import ExcelJS from 'exceljs';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { cityAndZone } from './club-zones.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const XLSX = process.argv[2] || resolve(ROOT, '..', 'District Team Structure - Dummy.xlsx');
const ROTARY_YEAR = '2024-25';

// Top-level headings in the Excel and where each one goes on the site
const SECTIONS = {
  'College of Governors': { page: 'leadership' },
  'District Counsellors': { page: 'leadership', role: 'District Counsellor' },
  'Assistant Governors': { page: 'leadership', role: 'Assistant Governor', zoneFromClub: true },
  "Governor's Office Team": { page: 'leadership' },
  'District Learning Facilitation Team': { page: 'teams' },
  'District Rotary Foundation Team': { page: 'teams' },
  'District Membership Team': { page: 'teams' },
};

const GOVERNOR_TITLES = {
  DG: ['Governor line', 'District Governor'],
  DGE: ['Governor line', 'District Governor Elect'],
  DGN: ['Governor line', 'District Governor Nominee'],
  PDG: ['College of Governors', 'Past District Governor'],
};

const KEEP_UPPER = new Set(['CA', 'PDG', 'DG', 'DGE', 'DGN', 'SPS', 'DK', 'RK', 'SB', 'MM', 'PN', 'OP', 'SC', 'KD', 'DP', 'SV']);
const spellingLog = [];

function cellText(cell) {
  const v = cell?.value;
  if (v == null) return '';
  if (typeof v === 'object') {
    if (v.richText) return v.richText.map((r) => r.text).join('').trim();
    if (v.text) return String(v.text).trim();
    if (v.result != null) return String(v.result).trim();
  }
  return String(v).trim();
}

// Fixes words typed in capitals or with stray capitals, e.g. "MUKESH" -> "Mukesh", "jADON" -> "Jadon"
function fixName(raw, where) {
  const fixed = raw
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .map((word) => {
      const letters = word.replace(/[^A-Za-z]/g, '');
      if (KEEP_UPPER.has(letters) || letters.length <= 2) return word;
      const allUpper = letters === letters.toUpperCase();
      const oddCaps = /^[a-z]/.test(letters) || /[a-z][A-Z]/.test(letters);
      if (allUpper || oddCaps) return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
      return word;
    })
    .join(' ');
  if (fixed !== raw) spellingLog.push({ where, from: raw, to: fixed });
  return fixed;
}

function fixText(raw, where) {
  const fixed = raw.replace(/Barielly/g, 'Bareilly').replace(/\s+/g, ' ').trim();
  if (fixed !== raw.trim()) spellingLog.push({ where, from: raw, to: fixed });
  return fixed;
}

function personKey(name, club) {
  const bare = name.replace(/^(Rtn|PDG|DGE|DGN|DG)\s+/i, '').toLowerCase().replace(/[^a-z]/g, '');
  return `${bare}|${club.toLowerCase()}`;
}

async function main() {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(XLSX);
  const ws = wb.getWorksheet('Structure') || wb.worksheets[0];

  const rows = [];
  const excelCounts = {};
  let section = null;
  let committee = '';
  let sortOrder = 0;
  const people = new Map(); // personKey -> T-id

  ws.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return; // header
    const a = cellText(row.getCell(1));
    const b = cellText(row.getCell(2));
    const c = cellText(row.getCell(3));
    const d = cellText(row.getCell(4));
    // Columns E (mobile) and F (email) are deliberately never read.

    // Headings may be merged across columns, so the other cells can repeat the heading
    if (a && (!b || b === a) && !/^\d+$/.test(a)) {
      if (SECTIONS[a]) {
        section = a;
        committee = '';
      } else if (/^[A-Z]\)\s*/.test(a)) {
        committee = a.replace(/^[A-Z]\)\s*/, '').trim();
      } else {
        throw new Error(`Row ${rowNumber}: unknown heading "${a}"`);
      }
      return;
    }
    if (!b) return;
    if (!section) throw new Error(`Row ${rowNumber}: person before any section heading`);

    excelCounts[section] = (excelCounts[section] || 0) + 1;
    const where = `Row ${rowNumber}`;
    const name = fixName(b, where);
    const club = fixText(d, where);
    const cfg = SECTIONS[section];
    const { zone: clubZone } = cityAndZone(club);

    let pageSection = section;
    let role = cfg.role || fixText(c, where);
    let zone = cfg.zoneFromClub ? clubZone : '';
    let term = '';
    let rowCommittee = committee;

    if (section === 'College of Governors') {
      const prefix = name.split(' ')[0].toUpperCase();
      const title = GOVERNOR_TITLES[prefix];
      if (!title) throw new Error(`${where}: unexpected governor title in "${name}"`);
      [pageSection, role] = title;
      term = c;
    } else if (cfg.page === 'teams' && committee) {
      const co = role.match(/^Co\s*-?\s*Chairman\s*-\s*(\w+)\s+Zone$/i);
      if (co) {
        role = 'Co-chairman';
        zone = co[1];
      } else if (/^Chairman$/i.test(role)) {
        role = 'Chairman';
      }
    }

    const key = personKey(name, club);
    if (!people.has(key)) people.set(key, `T-${String(people.size + 1).padStart(4, '0')}`);

    rows.push({
      rotary_year: ROTARY_YEAR,
      page: cfg.page,
      section: pageSection,
      committee: rowCommittee,
      member_id: people.get(key),
      name,
      role,
      zone,
      club_name: club,
      term,
      sort_order: ++sortOrder,
      contact_ok: 'no',
      contact_link: '',
      excel_row: rowNumber,
      excel_section: section,
    });
  });

  // Clubs: every club named anywhere in the Excel, with dummy IDs in alphabetical order
  const clubNames = [...new Set(rows.map((r) => r.club_name))].sort();
  const clubs = clubNames.map((name, i) => {
    const { city, zone } = cityAndZone(name);
    return {
      club_id: `S-${String(i + 1).padStart(3, '0')}`,
      club_name: name,
      display_name: name.replace(/^RC\s+/, 'Rotary Club of '),
      city,
      zone,
    };
  });
  const clubIdByName = Object.fromEntries(clubs.map((c) => [c.club_name, c.club_id]));
  for (const r of rows) r.club_id = clubIdByName[r.club_name];

  const out = { source: XLSX, rotary_year: ROTARY_YEAR, clubs, functionaries: rows, excel_counts: excelCounts, spelling_fixes: spellingLog };
  mkdirSync(resolve(ROOT, 'tools/out'), { recursive: true });
  writeFileSync(resolve(ROOT, 'tools/out/excel-converted.json'), JSON.stringify(out, null, 2));
  writeReport(out, people.size);
  console.log(`Converted ${rows.length} people rows (${people.size} distinct people), ${clubs.length} clubs, ${spellingLog.length} spelling fixes.`);
}

function writeReport(out, distinctPeople) {
  const outCounts = {};
  for (const r of out.functionaries) outCounts[r.excel_section] = (outCounts[r.excel_section] || 0) + 1;
  const lines = [
    '# Data conversion report',
    '',
    `Source: \`${out.source.split(/[\\/]/).pop()}\` · Rotary year ${out.rotary_year}`,
    '',
    'Phone numbers and email addresses in the Excel were not read.',
    '',
    '## Rows per section (Excel vs output)',
    '',
    '| Excel section | Excel rows | Output rows | Match |',
    '|---|---|---|---|',
    ...Object.keys(SECTIONS).map((s) => `| ${s} | ${out.excel_counts[s] || 0} | ${outCounts[s] || 0} | ${(out.excel_counts[s] || 0) === (outCounts[s] || 0) ? '✅' : '❌'} |`),
    `| **Total** | ${Object.values(out.excel_counts).reduce((a, b) => a + b, 0)} | ${out.functionaries.length} | |`,
    '',
    `${distinctPeople} distinct people (the same name in the same club is treated as one person with several roles).`,
    '',
    '## Spelling fixes',
    '',
    '| Where | Was | Now |',
    '|---|---|---|',
    ...out.spelling_fixes.map((f) => `| ${f.where} | ${f.from} | ${f.to} |`),
    '',
    '## Clubs, cities and zones (please check once)',
    '',
    'Club IDs are dummy (S-001 …) until the real Rotary club IDs are provided.',
    '',
    '| Club ID | Club | City | Zone |',
    '|---|---|---|---|',
    ...out.clubs.map((c) => `| ${c.club_id} | ${c.club_name} | ${c.city || '**?**'} | ${c.zone || '**?**'} |`),
    '',
  ];
  mkdirSync(resolve(ROOT, 'docs'), { recursive: true });
  writeFileSync(resolve(ROOT, 'docs/3110-Website-Excel-Data-Conversion-Report.md'), lines.join('\n'));
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
