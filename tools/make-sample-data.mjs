// Builds the sample (dummy) data for both spreadsheets, plus placeholder images and PDFs.
// Every row is marked is_sample = TRUE so "Clear all sample data" removes it.
// Output: sample/sample-data.json, sample/media/*, sample/magazines/*, docs/sample-data-report.md
//
// The generator is seeded, so running it again gives the same data.

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { core, plain, SCHEMA_MAIN, SCHEMA_PRIVATE } from '../lib/core.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const converted = JSON.parse(readFileSync(resolve(ROOT, 'tools/out/excel-converted.json'), 'utf8'));

/* ---------- seeded random ---------- */
let seed = 3110;
const rand = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
const pick = (arr) => arr[Math.floor(rand() * arr.length)];
const between = (a, b) => a + Math.floor(rand() * (b - a + 1));
const pad = (n, w = 2) => String(n).padStart(w, '0');
const iso = (d) => d.toISOString().slice(0, 10);
const addDays = (dateStr, n) => {
  const d = new Date(dateStr + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return iso(d);
};

const TODAY = '2026-10-13';
const ROTARY_YEAR = converted.rotary_year;

/* ---------- name pools (dummy people) ---------- */
const MALE = ['Aarav', 'Rohit', 'Sanjay', 'Vikram', 'Amit', 'Rajesh', 'Manish', 'Deepak', 'Nitin', 'Alok', 'Pankaj', 'Sameer',
  'Gaurav', 'Anuj', 'Harsh', 'Kunal', 'Mohit', 'Naveen', 'Prakash', 'Rahul', 'Sachin', 'Tarun', 'Varun', 'Yogesh', 'Ashwin', 'Dinesh'];
const FEMALE = ['Anita', 'Priya', 'Neha', 'Sunita', 'Kavita', 'Meera', 'Pooja', 'Ritu', 'Shalini', 'Swati', 'Rekha', 'Nidhi',
  'Aarti', 'Divya', 'Geeta', 'Jyoti', 'Komal', 'Lata', 'Mamta', 'Nisha', 'Rashmi', 'Seema', 'Vandana', 'Usha'];
const SURNAMES = ['Agarwal', 'Gupta', 'Sharma', 'Verma', 'Saxena', 'Srivastava', 'Mehrotra', 'Bansal', 'Mittal', 'Jain', 'Goel',
  'Singhal', 'Khanna', 'Kapoor', 'Tandon', 'Rastogi', 'Varshney', 'Maheshwari', 'Chaturvedi', 'Pandey', 'Tiwari', 'Mishra', 'Bhatia', 'Arora'];

const PROFESSIONS = ['Chartered accountant', 'Doctor (general physician)', 'Dentist', 'Paediatrician', 'Eye surgeon', 'Lawyer',
  'Architect', 'Civil engineer', 'Software developer', 'Teacher', 'School principal', 'Pharmacist', 'Retailer', 'Manufacturer',
  'Exporter', 'Real estate developer', 'Insurance adviser', 'Banker', 'Hotelier', 'Interior designer', 'Journalist',
  'Agriculturist', 'Transporter', 'Jeweller', 'Textile trader'];
const PROFESSION_LINES = {
  'Chartered accountant': 'Helps small businesses with tax, audit and GST compliance, and runs free money-management talks for students.',
  'Doctor (general physician)': 'Family physician running a clinic for twenty years; regular volunteer at district health and diabetes camps.',
  Dentist: 'Runs a dental clinic and organises school dental check-ups with the club every year.',
  Paediatrician: 'Children\'s doctor with a special interest in newborn care and immunisation awareness.',
  'Eye surgeon': 'Cataract and retina surgeon; leads free eye camps in rural areas with the club.',
  Lawyer: 'Practises civil and family law and offers free legal aid sessions for women and senior citizens.',
  Architect: 'Designs homes and schools with a focus on daylight, water harvesting and low-energy buildings.',
  'Civil engineer': 'Builds roads and water projects; advises the club on borewell and toilet construction work.',
  'Software developer': 'Builds web and mobile apps for local businesses and teaches coding to school students.',
  Teacher: 'Teaches mathematics at senior secondary level and mentors students preparing for competitive exams.',
  'School principal': 'Leads a co-educational school and supports scholarship programmes for first-generation learners.',
  Pharmacist: 'Runs a pharmacy and helps organise medicine distribution at health camps.',
  Retailer: 'Runs a family-owned electronics store and supports skill training for young shop staff.',
  Manufacturer: 'Makes leather footwear for domestic and export markets, employing over two hundred people.',
  Exporter: 'Exports handicrafts made by local artisans and helps them reach new markets.',
  'Real estate developer': 'Develops affordable housing projects and supports tree plantation drives in new colonies.',
  'Insurance adviser': 'Advises families on health and life insurance and runs financial literacy workshops.',
  Banker: 'Branch manager helping self-help groups and small traders access credit.',
  Hotelier: 'Runs a hotel and restaurant; hosts club meetings and trains young people in hospitality.',
  'Interior designer': 'Designs homes and offices and volunteers to refurbish classrooms in government schools.',
  Journalist: 'Reports on city news and helps clubs share their service stories.',
  Agriculturist: 'Grows organic vegetables and advises farmers on drip irrigation and soil health.',
  Transporter: 'Runs a fleet of goods carriers and supports road safety awareness drives.',
  Jeweller: 'Third-generation jeweller known for traditional designs; supports girls\' education.',
  'Textile trader': 'Wholesale cloth merchant who donates uniforms for school children every year.',
};

/* ---------- activity templates per theme ---------- */
const ACTIVITY_TEMPLATES = {
  'Promoting peace': [
    ['Inter-school debate on peace and tolerance', 'Students from six schools debated how communities can resolve conflicts peacefully. Winners received certificates and books.'],
    ['Peace walk on International Day of Peace', 'Club members, students and local residents walked together carrying messages of harmony. The walk ended with a pledge.'],
  ],
  'Fighting disease': [
    ['Free diabetes and blood pressure screening camp', 'Doctors from the club screened residents for diabetes and high blood pressure. People needing follow-up were referred to the district hospital.'],
    ['Polio awareness drive', 'Members joined health workers to remind families about the polio vaccination round. Posters were put up in markets and schools.'],
    ['Blood donation camp', 'Members and their friends donated blood in partnership with the government blood bank. Every donor received a certificate.'],
  ],
  'Providing clean water': [
    ['Water purifier installed in a government school', 'The club installed a water purifier and cooler so students have safe drinking water through the summer.'],
    ['Hand-pump repair in village', 'Three broken hand-pumps were repaired, restoring clean water for about forty families.'],
  ],
  'Saving mothers and children': [
    ['Nutrition kits for expectant mothers', 'Nutrition kits and health booklets were given to expectant mothers registered at the primary health centre.'],
    ['Newborn care workshop', 'A paediatrician from the club trained new mothers on breastfeeding, hygiene and vaccination schedules.'],
  ],
  'Supporting education': [
    ['School bags and stationery for students', 'Students of a primary school received school bags, notebooks and stationery at the start of the term.'],
    ['Career guidance talk for Class 12', 'Chartered accountants and engineers from the club spoke to students about career choices after school.'],
    ['Smart classroom handed over', 'The club handed over a smart classroom with a projector and learning content to a government inter college.'],
  ],
  'Growing local economies': [
    ['Sewing machines for women self-help group', 'Ten sewing machines were given to a women\'s self-help group, along with a month of tailoring training.'],
    ['Skill training for young electricians', 'Young people completed a two-week course in basic electrical repair, run with a local training institute.'],
  ],
  'Protecting the environment': [
    ['Tree plantation along the ring road', 'Members planted saplings along the ring road and arranged tree guards and watering for the summer.'],
    ['Cloth bags distribution in vegetable market', 'Cloth bags were handed out to vendors and shoppers to reduce single-use plastic.'],
  ],
  'Club service / Other': [
    ['Club installation ceremony', 'The new board of directors was installed in the presence of the Assistant Governor and past presidents.'],
    ['Fellowship evening with families', 'Members and families came together for an evening of music and games to welcome new members.'],
  ],
};
const THEMES = Object.keys(ACTIVITY_TEMPLATES);
const THEME_COLOURS = {
  'Promoting peace': ['#0067C8', '#00A2E0'], 'Fighting disease': ['#E02927', '#F7A81B'],
  'Providing clean water': ['#00A2E0', '#17458F'], 'Saving mothers and children': ['#901F93', '#E02927'],
  'Supporting education': ['#17458F', '#F7A81B'], 'Growing local economies': ['#009739', '#F7A81B'],
  'Protecting the environment': ['#009739', '#00A2E0'], 'Club service / Other': ['#17458F', '#0067C8'],
};

/* ---------- main ---------- */
const clubs = converted.clubs.map((c, i) => ({
  club_id: c.club_id,
  club_name: c.club_name,
  display_name: c.display_name,
  slug: core.Core_slug(c.club_name),
  former_names: c.club_name === 'RC Bareilly Hi-Tech' ? 'RC Bareilly Hitech' : '',
  city: c.city,
  zone: c.zone,
  status: 'active',
  member_count: between(18, 64),
  meeting_day_place: i % 3 === 0 ? `Every ${pick(['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'])}, 7:30 pm, ${pick(['Hotel Grand', 'Club House', 'Community Hall', 'Rotary Bhawan'])}, ${c.city}` : '',
  website: i % 5 === 0 ? `https://example.com/${core.Core_slug(c.club_name)}` : '',
  facebook: i % 4 === 0 ? `https://www.facebook.com/example-${core.Core_slug(c.club_name)}` : '',
  instagram: i % 6 === 0 ? `https://www.instagram.com/example_${core.Core_slug(c.club_name).replace(/-/g, '_')}` : '',
  youtube: '',
  x: '',
  linkedin: '',
  profile_updated_at: '',
  is_sample: true,
}));
// One club closed, to show inactive clubs keep their record
clubs.find((c) => c.club_name === 'RC Bareilly Eight PM').status = 'inactive';
const activeClubs = clubs.filter((c) => c.status === 'active');
const clubById = Object.fromEntries(clubs.map((c) => [c.club_id, c]));

/* ---------- private members ---------- */
const master = [];
const usedNames = new Set();
let memberSeq = 1;
function newPerson(clubId, { female = rand() < 0.4, rotarian = true, surname } = {}) {
  let name;
  do {
    name = `${female ? pick(FEMALE) : pick(MALE)} ${surname || pick(SURNAMES)}`;
  } while (usedNames.has(name + clubId));
  usedNames.add(name + clubId);
  const id = rotarian ? `9${pad(memberSeq++, 6)}` : `T-S${pad(memberSeq++, 4)}`;
  const year = between(1958, 1992);
  const p = {
    member_id: id,
    name: rotarian ? `Rtn ${name}` : name,
    club_id: rotarian ? clubId : '',
    is_rotarian: rotarian,
    status: 'active',
    // dummy mobiles in a block reserved for this sample; sample contact buttons are disabled on the site
    mobile: `9999${pad(between(0, 999999), 6)}`,
    email: rotarian ? `${name.toLowerCase().replace(/\s+/g, '.')}@example.com` : '',
    dob: `${year}-${pad(between(1, 12))}-${pad(between(1, 28))}`,
    marriage_date: '',
    spouse_id: '',
    directory_ok: false, contact_ok: false, photo_ok: false, birthday_ok: false, anniversary_ok: false,
    profession: '', area: '', description: '', website: '', spotlight_ok: false,
    photo_file: '', photo_approved: false,
    listing_approved: false, listing_approved_by: '', listing_approved_at: '',
    public_key: '',
    consent_source: '', consent_updated_at: '', notes: '',
    is_sample: true,
    _female: female,
  };
  master.push(p);
  return p;
}

// About 2–3 members per club
for (const c of activeClubs) {
  const n = between(2, 3);
  for (let i = 0; i < n; i++) newPerson(c.club_id);
}

// Consent patterns
let photoSeq = 1;
const rotarians = master.filter((m) => m.is_rotarian);
rotarians.forEach((m, i) => {
  if (i % 7 === 6) return; // some members never opted in
  const dir = i % 3 !== 2;
  m.directory_ok = dir;
  m.birthday_ok = i % 2 === 0 || i % 5 === 0;
  m.contact_ok = dir && i % 4 === 0;
  if (dir) {
    m.profession = pick(PROFESSIONS);
    m.area = clubById[m.club_id].city;
    m.description = PROFESSION_LINES[m.profession];
    if (i % 6 === 0) m.website = `https://example.com/${m.name.replace(/^Rtn /, '').toLowerCase().replace(/\s+/g, '-')}`;
    m.spotlight_ok = i % 5 === 0;
  }
  if (i % 4 === 1 && photoSeq <= 30) {
    m.photo_ok = true;
    m.photo_file = `sample:member-${pad(photoSeq++)}.jpg`;
    m.photo_approved = true;
  }
  if (!m.directory_ok && !m.birthday_ok && !m.photo_ok) return;
  m.listing_approved = i % 23 !== 0; // a few still waiting for a moderator
  if (m.listing_approved) {
    m.listing_approved_by = pick(['moderator.a@example.com', 'moderator.b@example.com', 'moderator.c@example.com', 'moderator.d@example.com']);
    m.listing_approved_at = `2026-${pad(between(7, 9))}-${pad(between(1, 28))}T10:00:00Z`;
  }
  m.consent_source = i % 2 ? 'member' : 'club secretary';
  m.consent_updated_at = m.listing_approved_at;
});

// Birthdays this week, so the celebrations strip has something to show around launch
const weekDays = ['10-12', '10-13', '10-14', '10-15', '10-17', '10-19', '10-20', '10-22', '10-25', '10-28', '11-02', '11-05'];
rotarians.filter((m) => m.birthday_ok && m.listing_approved).slice(0, weekDays.length).forEach((m, i) => {
  m.dob = `${m.dob.slice(0, 4)}-${weekDays[i]}`;
});

// Couples
const couples = [];
let coupleSeq = 1;
function addCouple(a, b, anniversaryMD, opts = {}) {
  const year = between(1985, 2015);
  const c = {
    couple_id: `C-S${pad(coupleSeq++, 3)}`,
    person_a_id: a.member_id,
    person_b_id: b.member_id,
    anniversary: `${pad(+anniversaryMD.slice(3))}-${anniversaryMD.slice(0, 2)}`, // as typed on the form: DD-MM
    a_consent: true,
    b_consent: opts.bConsent ?? true,
    couple_photo_ok_a: !!opts.photo,
    couple_photo_ok_b: !!opts.photo,
    couple_photo_file: opts.photo || '',
    couple_photo_approved: !!opts.photo,
    status: opts.status || 'active',
    notes: opts.notes || '',
    is_sample: true,
  };
  a.anniversary_ok = true;
  a.marriage_date = `${year}-${anniversaryMD}`;
  a.spouse_id = b.member_id;
  if (b.is_rotarian) {
    b.anniversary_ok = c.b_consent;
    b.marriage_date = a.marriage_date;
    b.spouse_id = a.member_id;
  }
  couples.push(c);
  return c;
}
const surnameOf = (m) => m.name.split(' ').pop();
const approved = rotarians.filter((m) => m.listing_approved);
const anniversaryDays = ['10-14', '10-16', '10-18', '10-21', '10-26', '11-01', '11-08', '11-15', '12-01', '12-12', '01-10', '02-14'];
// 12 members with spouses who are not Rotarians (the member's tick records the spouse's agreement)
approved.slice(0, 12).forEach((m, i) => {
  const spouse = newPerson('', { rotarian: false, female: !m._female, surname: surnameOf(m) });
  addCouple(m, spouse, anniversaryDays[i], { photo: i < 2 ? `sample:couple-${i + 1}.jpg` : '' });
});
// Rotarian couples: same club, and in different clubs
const crossPairs = [
  [approved[20], 'S-004'], [approved[24], 'S-046'], [approved[28], 'S-026'], [approved[32], approved[32].club_id],
];
crossPairs.forEach(([a, clubId], i) => {
  const b = newPerson(clubId, { female: !a._female, surname: surnameOf(a) });
  Object.assign(b, {
    directory_ok: true, profession: pick(PROFESSIONS), area: clubById[clubId].city, birthday_ok: true,
    listing_approved: true, listing_approved_by: 'moderator.b@example.com', listing_approved_at: '2026-09-02T09:00:00Z',
    consent_source: 'member', consent_updated_at: '2026-09-02T09:00:00Z',
  });
  b.description = PROFESSION_LINES[b.profession];
  addCouple(a, b, ['10-15', '10-23', '11-11', '12-20'][i]);
});
// One Rotarian couple where the spouse has not sent their own form yet
const waiting = newPerson('S-010', { female: true, surname: surnameOf(approved[36]) });
addCouple(approved[36], waiting, '10-16', { bConsent: false, status: 'awaiting_spouse', notes: 'Waiting for the spouse\'s own consent form' });
// One couple whose two forms gave different dates
const mismatch = newPerson('S-039', { female: true, surname: surnameOf(approved[40]) });
mismatch.listing_approved = true;
mismatch.birthday_ok = true;
addCouple(approved[40], mismatch, '10-17', { status: 'check_dates', notes: 'Spouse gave 18-10; please check' });
// One couple withdrawn by a spouse
addCouple(approved[44], newPerson('', { rotarian: false, female: !approved[44]._female, surname: surnameOf(approved[44]) }), '10-19', { status: 'withdrawn', notes: 'Withdrawn by spouse' });

// Deceased: one member, one non-member spouse (greetings must stop for them and their couples)
const deceasedMember = approved[8];
deceasedMember.status = 'deceased';
deceasedMember.notes = 'Marked deceased by a moderator (sample)';
const deceasedSpouse = master.find((m) => m.member_id === couples[3].person_b_id);
deceasedSpouse.status = 'deceased';
// A member who left Rotary
approved[50].status = 'left';

// Public keys for everyone who might appear publicly
let keySeq = 1;
const makeKey = () => `k${core.Core_hash('sample-' + keySeq++)}`;
master.forEach((m) => {
  if (m.listing_approved || m.anniversary_ok || m.status !== 'active') m.public_key = makeKey();
});

// Club history, including three transfers
const clubHistory = master.filter((m) => m.is_rotarian).map((m) => ({
  member_id: m.member_id, club_id: m.club_id, from_date: `${between(2008, 2023)}-07-01`, to_date: '', reason: 'joined', is_sample: true,
}));
[approved[5], approved[15], approved[25]].forEach((m) => {
  const current = clubHistory.find((h) => h.member_id === m.member_id && !h.to_date);
  const previous = activeClubs.find((c) => c.club_id !== m.club_id && c.zone === clubById[m.club_id].zone);
  const moveDate = '2025-07-01';
  clubHistory.push({ member_id: m.member_id, club_id: previous.club_id, from_date: current.from_date, to_date: '2025-06-30', reason: 'transferred out', is_sample: true });
  current.from_date = moveDate;
  current.reason = 'transferred in';
  m.notes = `Moved from ${previous.club_name} in July 2025`;
});
if (deceasedMember) {
  const h = clubHistory.find((x) => x.member_id === deceasedMember.member_id && !x.to_date);
  h.to_date = '2026-09-20';
  h.reason = 'deceased';
}

/* ---------- officers (dummy, from the members above) ---------- */
const officers = [];
for (const c of activeClubs) {
  const inClub = master.filter((m) => m.club_id === c.club_id && m.is_rotarian && m.status === 'active');
  ['President', 'Secretary'].forEach((role, i) => {
    const m = inClub[i] || newPerson(c.club_id);
    officers.push({ rotary_year: ROTARY_YEAR, club_id: c.club_id, member_id: m.member_id, name: m.name, role, contact_ok: false, contact_link: '', is_sample: true });
  });
}

/* ---------- functionaries (real names, roles and clubs from the Excel; marked sample as agreed) ---------- */
const functionaries = converted.functionaries.map((f) => ({
  rotary_year: f.rotary_year, page: f.page, section: f.section, committee: f.committee, member_id: f.member_id,
  name: f.name, role: f.role, zone: f.zone, club_id: f.club_id, term: f.term, sort_order: f.sort_order,
  contact_ok: false, contact_link: '', is_sample: true,
}));

/* ---------- activities ---------- */
const MODERATORS = ['moderator.a@example.com', 'moderator.b@example.com', 'moderator.c@example.com', 'moderator.d@example.com'];
const activities = [];
let actSeq = 1;
function addActivity({ clubId, date, theme, status = 'approved', photos = 1, link = false, partners = [], story = false, eventId = '', template, helped, spent }) {
  const [title, description] = template || pick(ACTIVITY_TEMPLATES[theme]);
  const id = `ACT-2026-${pad(actSeq++, 4)}`;
  const submitter = master.find((m) => m.club_id === clubId && m.is_rotarian) || { name: 'Rtn Sample Member', mobile: '9999000000', email: 'sample@example.com' };
  const submitted = `${addDays(date, between(0, 2))}T${pad(between(8, 20))}:${pad(between(0, 59))}:00+05:30`;
  activities.push({
    id, submitted_at: submitted, submitter_email: submitter.email || 'sample@example.com', submitter_name: submitter.name,
    submitter_role: pick(['President', 'Secretary', 'Public Image Chair']), submitter_mobile: submitter.mobile,
    club_id: clubId, title, date, theme, description,
    photo_files: Array.from({ length: photos }, () => `sample:activity-${pad(THEMES.indexOf(theme) * 2 + between(1, 2))}.jpg`).filter((v, i, a) => a.indexOf(v) === i).join(', '),
    post_link: link ? `https://www.facebook.com/example-${clubById[clubId].slug}/posts/${between(1000, 9999)}` : '',
    people_helped: helped ?? (rand() < 0.7 ? between(20, 400) : ''),
    amount_spent: spent ?? (rand() < 0.5 ? between(5, 120) * 1000 : ''),
    partner_clubs: partners.join(', '),
    photo_consent: true, status, source: 'form',
    approved_by: status === 'approved' ? pick(MODERATORS) : status === 'rejected' ? pick(MODERATORS) : '',
    approved_at: status !== 'pending' ? `${addDays(date, between(1, 2))}T11:00:00+05:30` : '',
    moderator_note: status === 'rejected' ? 'Duplicate of an earlier entry' : '',
    story_of_month: story, event_id: eventId, notified: status !== 'pending', is_sample: true,
  });
  return id;
}

// Spread across July–October 2026
const dates = [];
for (let d = '2026-07-02'; d <= '2026-10-12'; d = addDays(d, 3)) dates.push(d);
dates.forEach((date, i) => {
  const club = activeClubs[(i * 7) % activeClubs.length];
  const theme = THEMES[i % THEMES.length];
  addActivity({ clubId: club.club_id, date, theme, photos: between(1, 3), link: i % 5 === 0, partners: i % 9 === 0 ? [activeClubs[(i * 7 + 1) % activeClubs.length].club_id] : [] });
});
// Recognition cases for September 2026:
// RC Kanpur Divinity: 3 activities with a small membership -> qualifies, best per member
const small = clubs.find((c) => c.club_name === 'RC Kanpur Divinity');
small.member_count = 20;
['2026-09-05', '2026-09-14', '2026-09-26'].forEach((d, i) => addActivity({ clubId: small.club_id, date: d, theme: THEMES[i + 1] }));
// RC Agra Greater: 4 activities but a large club -> qualifies, lower per member
const big = clubs.find((c) => c.club_name === 'RC Agra Greater');
big.member_count = 64;
['2026-09-03', '2026-09-11', '2026-09-19', '2026-09-27'].forEach((d, i) => addActivity({ clubId: big.club_id, date: d, theme: THEMES[i + 3] }));
// RC Unnao: only 2 activities, tiny club -> does not qualify (minimum is 3)
const tiny = clubs.find((c) => c.club_name === 'RC Unnao');
tiny.member_count = 12;
['2026-09-08', '2026-09-22'].forEach((d) => addActivity({ clubId: tiny.club_id, date: d, theme: 'Supporting education' }));
// Story of the month picks
addActivity({ clubId: 'S-006', date: '2026-08-20', theme: 'Providing clean water', photos: 3, story: true, helped: 650,
  template: ['RO plant for a village of 600 families', 'The club installed a reverse-osmosis water plant in the village. A local committee will run it, and the water costs families one rupee a can.'] });
addActivity({ clubId: 'S-046', date: '2026-09-17', theme: 'Saving mothers and children', photos: 2, story: true, helped: 120,
  template: ['Safe delivery kits for 120 mothers', 'Volunteers packed safe-delivery kits with the primary health centre and trained ASHA workers on newborn warning signs.'] });
// A joint activity with partner clubs
addActivity({ clubId: 'S-039', date: '2026-10-02', theme: 'Protecting the environment', photos: 2, partners: ['S-040', 'S-048'],
  template: ['Gandhi Jayanti clean-up of the Ganga ghat', 'Three Kanpur clubs cleaned the ghat together and placed dustbins with the municipal corporation.'] });
// Link-only activity (club already posted on its own page)
addActivity({ clubId: 'S-059', date: '2026-10-05', theme: 'Supporting education', photos: 0, link: true });
// Pending and rejected entries must never appear on the site
['2026-10-10', '2026-10-11', '2026-10-12', '2026-10-12'].forEach((d, i) => addActivity({ clubId: activeClubs[i * 5].club_id, date: d, theme: THEMES[i], status: 'pending' }));
// Sample pending entry with an easy-to-search title, used by the site tests
addActivity({ clubId: 'S-020', date: '2026-10-11', theme: 'Fighting disease', status: 'pending',
  template: ['PENDING-SAMPLE health camp awaiting approval', 'This entry is still pending and must not appear on the website.'] });
addActivity({ clubId: 'S-020', date: '2026-09-30', theme: 'Fighting disease', status: 'rejected',
  template: ['REJECTED-SAMPLE duplicate camp entry', 'This entry was rejected and must not appear on the website.'] });
// Approved but with neither photo nor link: must be skipped by the build
addActivity({ clubId: 'S-021', date: '2026-09-29', theme: 'Supporting education', photos: 0, link: false,
  template: ['NOPHOTO-SAMPLE entry without photo or link', 'Approved by mistake without a photo or link; the build skips it.'] });

/* ---------- events ---------- */
const events = [];
let evtSeq = 1;
function addEvent(e) {
  const id = `EVT-2026-${pad(evtSeq++, 4)}`;
  events.push({
    id, submitted_at: `${addDays(e.start_date, -20)}T10:00:00+05:30`, submitter_email: 'sample@example.com', submitter_name: 'Rtn Sample Secretary',
    submitter_role: 'Secretary', submitter_mobile: '9999000000', title: e.title, event_type: e.event_type, start_date: e.start_date,
    start_time: e.start_time || '', end_date: e.end_date || '', venue: e.venue, city: e.city, organiser: e.organiser,
    description: e.description || '', map_link: e.map_link || '', details_link: '', status: e.status || 'approved', source: 'form',
    approved_by: e.status === 'pending' ? '' : pick(MODERATORS), approved_at: e.status === 'pending' ? '' : `${addDays(e.start_date, -18)}T12:00:00+05:30`,
    moderator_note: '', report_activity_id: e.report || '', notified: true, is_sample: true,
  });
  return id;
}
const pastReportA = addActivity({ clubId: 'S-059', date: '2026-08-24', theme: 'Club service / Other', photos: 2,
  template: ['District Membership Seminar held in Mathura', 'Over 200 Rotarians attended sessions on attracting and keeping members. Clubs shared ideas that worked for them.'] });
const pastReportB = addActivity({ clubId: 'S-017', date: '2026-09-13', theme: 'Fighting disease', photos: 3, helped: 1450,
  template: ['Mega health camp served 1,450 patients', 'Specialist doctors from across the zone examined patients; 60 were referred for free cataract surgery.'] });
addEvent({ title: 'District Membership Seminar', event_type: 'District event', start_date: '2026-08-24', start_time: '10:00', venue: 'Hotel Brijwasi Royal', city: 'Mathura', organiser: 'District Membership Team', description: 'Sessions on attracting and keeping members, for club presidents and membership chairs.', report: pastReportA });
addEvent({ title: 'Bareilly Zone mega health camp', event_type: 'Club event open to all', start_date: '2026-09-13', start_time: '09:00', venue: 'Rotary Bhawan', city: 'Bareilly', organiser: 'RC Bareilly Central', description: 'Free consultations with specialist doctors; medicines provided free.', report: pastReportB });
addEvent({ title: 'Vocational visit to a leather footwear unit', event_type: 'Vocational visit', start_date: '2026-09-20', start_time: '16:00', venue: 'Foundry Nagar industrial area', city: 'Agra', organiser: 'RC Agra North', description: 'Members saw how footwear is made for export and discussed skill training for workers.' });
addEvent({ title: 'Rotary Foundation Seminar', event_type: 'Training or seminar', start_date: '2026-10-25', start_time: '10:00', venue: 'Hotel Landmark', city: 'Kanpur', organiser: 'District Rotary Foundation Team', description: 'Global grants, district grants and stewardship for club Foundation chairs.', map_link: 'https://maps.google.com/?q=Kanpur' });
addEvent({ title: 'Business networking evening – Agra Zone', event_type: 'Business networking evening', start_date: '2026-11-07', start_time: '18:30', venue: 'Hotel Clarks Shiraz', city: 'Agra', organiser: 'RC Agra Greater', description: 'Members introduce their professions and businesses to each other. No sales pitches.' });
addEvent({ title: 'District Learning Assembly', event_type: 'District event', start_date: '2026-11-15', end_date: '2026-11-16', start_time: '09:30', venue: 'Convention Centre', city: 'Bareilly', organiser: 'District Learning Facilitation Team', description: 'Two-day training for incoming club officers.' });
addEvent({ title: 'Free eye camp', event_type: 'Club event open to all', start_date: '2026-11-22', start_time: '09:00', venue: 'Government Inter College', city: 'Aligarh', organiser: 'RC Aligarh', description: 'Eye check-ups and free spectacles; cataract patients referred for surgery.' });
addEvent({ title: 'Career guidance day for Class 12 students', event_type: 'Vocational visit', start_date: '2026-12-05', start_time: '11:00', venue: 'City Montessori School', city: 'Kanpur', organiser: 'RC Kanpur South' });
addEvent({ title: 'District Conference 2026', event_type: 'District event', start_date: '2026-12-19', end_date: '2026-12-20', start_time: '10:00', venue: 'Hotel Radisson', city: 'Agra', organiser: 'Governor\'s Office Team', description: 'Annual district conference with awards for clubs.' });
addEvent({ title: 'PENDING-SAMPLE event awaiting approval', event_type: 'Club event open to all', start_date: '2026-11-30', venue: 'Town Hall', city: 'Jhansi', organiser: 'RC Jhansi', status: 'pending' });
// link report activities back to their events
activities.find((a) => a.id === pastReportA).event_id = events[0].id;
activities.find((a) => a.id === pastReportB).event_id = events[1].id;

/* ---------- magazines, messages, spotlights ---------- */
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const magazines = ['2026-07', '2026-08', '2026-09'].map((m) => ({
  issue_month: m, title: `District 3110 News – ${MONTHS[+m.slice(5) - 1]} ${m.slice(0, 4)} (sample)`, pdf_file: `sample:magazine-${m}.pdf`,
  pdf_url: '', cover_image: `sample:magazine-${m}.jpg`, is_sample: true,
}));

const messages = [
  ['District Governor', 'District Governor 2024-25 (sample message)', true, '2026-07-01'],
  ['District Governor Elect', 'District Governor Elect (sample message)', false, '2026-08-01'],
  ['District Governor Nominee', 'District Governor Nominee (sample message)', false, '2026-08-15'],
  ['District Secretary', 'District Secretary (sample message)', false, '2026-09-01'],
  ['District Rotary Foundation Chair', 'District Rotary Foundation Chair (sample message)', false, '2026-09-15'],
].map(([who, position, featured, date], i) => ({
  id: `MSG-S${pad(i + 1, 3)}`,
  name: `Sample: ${who}`,
  position,
  photo: `sample:message-${i + 1}.jpg`,
  message: 'This is a sample message used while the website is being tested. It will be replaced by the real message when the district provides it. ' +
    'Dear fellow Rotarians, every service project you complete changes lives in our communities. Please keep sharing your club\'s work so the whole district can celebrate it.',
  date, featured, is_sample: true,
}));

/* ---------- consent and removal requests (to show the moderator screens) ---------- */
const consentRequests = [
  {
    id: 'CON-S001', submitted_at: '2026-10-12T19:20:00+05:30', submitter_email: 'secretary.sample@example.com', filled_by: 'Club secretary for the member',
    club_id: 'S-004', name: rotarians[2].name, member_id: rotarians[2].member_id, mobile: rotarians[2].mobile, directory_ok: true,
    profession: 'Architect', area: 'Agra', description: PROFESSION_LINES.Architect, website: '', spotlight_ok: true, contact_ok: false,
    photo_ok: false, photo_file: '', birthday_ok: true, birthday: '14-10', anniversary_ok: false, spouse_is_rotarian: '', spouse_name: '',
    spouse_club_id: '', spouse_member_id: '', spouse_agrees: false, anniversary: '', couple_photo_file: '', couple_photo_spouse_agrees: false,
    declaration: true, status: 'pending', matched_member_id: '', approved_by: '', approved_at: '', moderator_note: '', is_sample: true,
  },
  {
    id: 'CON-S002', submitted_at: '2026-10-13T08:05:00+05:30', submitter_email: 'new.member@example.com', filled_by: 'The member',
    club_id: 'S-046', name: 'Rtn Kavita Rastogi', member_id: '', mobile: '9999123456', directory_ok: true, profession: 'Teacher',
    area: 'Kanpur', description: PROFESSION_LINES.Teacher, website: '', spotlight_ok: false, contact_ok: true, photo_ok: false, photo_file: '',
    birthday_ok: false, birthday: '', anniversary_ok: true, spouse_is_rotarian: 'Yes', spouse_name: 'Rtn Manish Rastogi',
    spouse_club_id: 'S-047', spouse_member_id: '', spouse_agrees: false, anniversary: '30-10', couple_photo_file: '',
    couple_photo_spouse_agrees: false, declaration: true, status: 'pending', matched_member_id: '', approved_by: '', approved_at: '',
    moderator_note: 'No matching member found: check the name and club', is_sample: true,
  },
];
const removalRequests = [
  {
    id: 'REM-S001', submitted_at: '2026-10-13T09:15:00+05:30', submitter_email: 'member.sample@example.com', club_id: rotarians[4].club_id,
    name: rotarians[4].name, member_id: rotarians[4].member_id, mobile: rotarians[4].mobile, remove_items: 'Birthday',
    reason: 'Prefer not to show it', status: 'pending', matched_member_id: '', approved_by: '', approved_at: '', moderator_note: '', is_sample: true,
  },
];
const clubProfileRequests = [
  {
    id: 'CPR-S001', submitted_at: '2026-10-12T17:40:00+05:30', submitter_email: 'president.sample@example.com', submitter_name: 'Rtn Sample President',
    submitter_role: 'President', submitter_mobile: '9999000001', club_id: 'S-036', website: 'https://example.com/rc-jhansi',
    facebook: 'https://www.facebook.com/example-rc-jhansi', instagram: '', youtube: '', x: '', linkedin: '',
    meeting_day_place: 'Every Thursday, 7:30 pm, Hotel Sita, Jhansi', status: 'pending', approved_by: '', approved_at: '', moderator_note: '', is_sample: true,
  },
];

/* ---------- generated public tabs (same code as the Sheet's "Refresh public members") ---------- */
const pub = plain(core.Core_buildMembersPublic(plain(master), plain(couples), makeKey));
const membersPublic = pub.members.map((m) => ({ ...m, is_sample: true }));
const couplesPublic = pub.couples.map((c) => ({ ...c, is_sample: true }));

const spotlightMembers = membersPublic.filter((m) => m.spotlight_ok).slice(0, 2);
const spotlights = spotlightMembers.map((m, i) => ({
  month: ['2026-09', '2026-10'][i], public_key: m.public_key, member_name: m.name,
  headline: `${m.profession} who serves through ${m.profession === 'Teacher' ? 'teaching' : 'their profession'} (sample)`,
  story: `${m.name.replace(/^Rtn /, '')} is a ${m.profession.toLowerCase()} from ${m.area}. ${m.description} ` +
    'This is a sample spotlight story; the moderators will choose and write the real one each month.',
  is_sample: true,
}));

/* ---------- settings and lists ---------- */
const settings = [
  ['district_name', 'Rotary District 3110', 'Shown in the header and footer'],
  ['current_rotary_year', ROTARY_YEAR, 'Rotary year shown for office bearers, teams and committees'],
  ['zones', 'Agra, Bareilly, Kanpur', 'District zones'],
  ['professions', PROFESSIONS.join(', '), 'Placeholder list; replace with the real list'],
  ['moderator_emails', '', 'Comma-separated; receive the 48-hour reminders'],
  ['site_url', 'https://rotarian-neerav.github.io/rotary3110-website/', 'Used in emails to submitters'],
  ['form_activity_url', '', 'Filled in by the setup script'],
  ['form_club_profile_url', '', 'Filled in by the setup script'],
  ['form_consent_url', '', 'Filled in by the setup script'],
  ['form_removal_url', '', 'Filled in by the setup script'],
  ['rebuild_requested_at', '', 'Set by "Rebuild site now" and "Mark as deceased"'],
  ['inactive_keys', pub.inactiveKeys.join(', '), 'Filled in by "Refresh public members"; never edit by hand'],
].map(([key, value, notes]) => ({ key, value, notes }));

const areas = [...new Set(clubs.map((c) => c.city))].sort();
const lists = [
  ...PROFESSIONS.map((v) => ({ list: 'profession', value: v })),
  ...areas.map((v) => ({ list: 'area', value: v })),
  ...core.CORE_THEMES.map((v) => ({ list: 'theme', value: v })),
  ...core.CORE_EVENT_TYPES.map((v) => ({ list: 'event_type', value: v })),
  ...['President', 'Secretary', 'Treasurer', 'Public Image Chair', 'Other office bearer', 'Member'].map((v) => ({ list: 'submitter_role', value: v })),
];

/* ---------- write ---------- */
function toTab(schema, rows) {
  return rows.map((r) => {
    const out = {};
    for (const h of schema) out[h] = r[h] ?? '';
    return out;
  });
}
const strip = (rows) => rows.map(({ _female, ...rest }) => rest);

const data = {
  generated_for: TODAY,
  note: 'Sample (dummy) data for testing. Every row is marked is_sample. Real names, roles and clubs in functionaries come from the district Excel (2024-25).',
  main: {
    settings: toTab(SCHEMA_MAIN.settings, settings),
    lists: toTab(SCHEMA_MAIN.lists, lists),
    clubs: toTab(SCHEMA_MAIN.clubs, clubs),
    officers: toTab(SCHEMA_MAIN.officers, officers),
    functionaries: toTab(SCHEMA_MAIN.functionaries, functionaries),
    activities: toTab(SCHEMA_MAIN.activities, activities),
    events: toTab(SCHEMA_MAIN.events, events),
    club_profile_requests: toTab(SCHEMA_MAIN.club_profile_requests, clubProfileRequests),
    magazines: toTab(SCHEMA_MAIN.magazines, magazines),
    messages: toTab(SCHEMA_MAIN.messages, messages),
    spotlights: toTab(SCHEMA_MAIN.spotlights, spotlights),
    members_public: toTab(SCHEMA_MAIN.members_public, membersPublic),
    couples_public: toTab(SCHEMA_MAIN.couples_public, couplesPublic),
  },
  private: {
    members_master: toTab(SCHEMA_PRIVATE.members_master, strip(master)),
    club_history: toTab(SCHEMA_PRIVATE.club_history, clubHistory),
    couples: toTab(SCHEMA_PRIVATE.couples, couples),
    consent_requests: toTab(SCHEMA_PRIVATE.consent_requests, consentRequests),
    removal_requests: toTab(SCHEMA_PRIVATE.removal_requests, removalRequests),
  },
};

mkdirSync(resolve(ROOT, 'sample/media'), { recursive: true });
mkdirSync(resolve(ROOT, 'sample/magazines'), { recursive: true });
writeFileSync(resolve(ROOT, 'sample/sample-data.json'), JSON.stringify(data, null, 1));

await makeImages();
writeReport();
console.log('Sample data written:', Object.entries({ ...data.main, ...data.private }).map(([k, v]) => `${k}=${v.length}`).join(' '));

/* ---------- placeholder images and PDFs ---------- */
async function makeImages() {
  const jpg = (svg, file, q = 70) => sharp(Buffer.from(svg)).jpeg({ quality: q, mozjpeg: true }).toFile(resolve(ROOT, 'sample/media', file));
  const jobs = [];
  THEMES.forEach((theme, t) => {
    const [c1, c2] = THEME_COLOURS[theme];
    [1, 2].forEach((v) => {
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="800">
        <defs><linearGradient id="g" x1="0" y1="0" x2="${v === 1 ? 1 : 0}" y2="1"><stop offset="0" stop-color="${c1}"/><stop offset="1" stop-color="${c2}"/></linearGradient></defs>
        <rect width="1200" height="800" fill="url(#g)"/>
        <circle cx="${v === 1 ? 900 : 300}" cy="260" r="180" fill="#fff" opacity=".12"/>
        <circle cx="${v === 1 ? 250 : 950}" cy="620" r="240" fill="#fff" opacity=".08"/>
        <text x="600" y="380" font-family="Arial, sans-serif" font-size="58" font-weight="700" fill="#fff" text-anchor="middle">${theme.replace('&', 'and')}</text>
        <text x="600" y="460" font-family="Arial, sans-serif" font-size="36" fill="#fff" opacity=".85" text-anchor="middle">Sample photo ${v}</text>
      </svg>`;
      jobs.push(jpg(svg, `activity-${pad(t * 2 + v)}.jpg`));
    });
  });
  const palette = ['#17458F', '#0067C8', '#00A2E0', '#901F93', '#009739', '#E02927', '#F7A81B', '#404040'];
  for (let i = 1; i <= 30; i++) {
    const bg = palette[i % palette.length];
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="600">
      <rect width="600" height="600" fill="${bg}"/>
      <circle cx="300" cy="235" r="115" fill="#fff" opacity=".9"/>
      <path d="M90 600c0-130 95-215 210-215s210 85 210 215z" fill="#fff" opacity=".9"/>
      <text x="300" y="575" font-family="Arial, sans-serif" font-size="34" fill="${bg}" text-anchor="middle">Sample ${i}</text>
    </svg>`;
    jobs.push(jpg(svg, `member-${pad(i)}.jpg`));
  }
  for (let i = 1; i <= 2; i++) {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600">
      <rect width="800" height="600" fill="${i === 1 ? '#17458F' : '#901F93'}"/>
      <circle cx="300" cy="230" r="95" fill="#fff" opacity=".9"/><path d="M130 600c0-120 75-200 170-200s170 80 170 200z" fill="#fff" opacity=".9"/>
      <circle cx="500" cy="250" r="90" fill="#F7A81B"/><path d="M340 600c0-110 72-185 160-185s160 75 160 185z" fill="#F7A81B"/>
      <text x="400" y="60" font-family="Arial, sans-serif" font-size="34" fill="#fff" text-anchor="middle">Sample couple photo</text>
    </svg>`;
    jobs.push(jpg(svg, `couple-${i}.jpg`));
  }
  for (let i = 1; i <= 5; i++) {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="600">
      <rect width="600" height="600" fill="#17458F"/><circle cx="300" cy="235" r="115" fill="#F7A81B"/>
      <path d="M90 600c0-130 95-215 210-215s210 85 210 215z" fill="#F7A81B"/>
      <text x="300" y="80" font-family="Arial, sans-serif" font-size="34" fill="#fff" text-anchor="middle">Sample photo</text></svg>`;
    jobs.push(jpg(svg, `message-${i}.jpg`));
  }
  for (const m of magazines) {
    const label = m.title.replace(' (sample)', '');
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="848">
      <rect width="600" height="848" fill="#fff"/><rect width="600" height="210" fill="#17458F"/>
      <text x="40" y="110" font-family="Arial, sans-serif" font-size="56" font-weight="700" fill="#fff">District 3110</text>
      <text x="40" y="170" font-family="Arial, sans-serif" font-size="34" fill="#F7A81B">${MONTHS[+m.issue_month.slice(5) - 1]} ${m.issue_month.slice(0, 4)}</text>
      <rect x="40" y="250" width="520" height="340" fill="#00A2E0" opacity=".25"/>
      <text x="300" y="440" font-family="Arial, sans-serif" font-size="40" fill="#17458F" text-anchor="middle">Sample issue</text>
      <text x="40" y="660" font-family="Arial, sans-serif" font-size="28" fill="#404040">Club news · Events · Recognition</text>
      <rect y="790" width="600" height="58" fill="#F7A81B"/></svg>`;
    jobs.push(jpg(svg, `magazine-${m.issue_month}.jpg`, 75));
    writeFileSync(resolve(ROOT, 'sample/magazines', `magazine-${m.issue_month}.pdf`), simplePdf([label, '', 'This is a sample magazine issue used for testing the website.', 'It will be replaced by the real issue.']));
  }
  await Promise.all(jobs);
}

function simplePdf(lines) {
  const text = lines.map((l, i) => `BT /F1 ${i === 0 ? 20 : 12} Tf 60 ${760 - i * 28} Td (${l.replace(/[()\\]/g, '\\$&').replace(/[^\x20-\x7E]/g, '-')}) Tj ET`).join('\n');
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    `<< /Length ${text.length} >>\nstream\n${text}\nendstream`,
  ];
  let pdf = '%PDF-1.4\n';
  const offsets = [];
  objects.forEach((o, i) => {
    offsets.push(pdf.length);
    pdf += `${i + 1} 0 obj\n${o}\nendobj\n`;
  });
  const xref = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.map((o) => `${String(o).padStart(10, '0')} 00000 n \n`).join('')}`;
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(pdf, 'latin1');
}

/* ---------- coverage report: every awkward case must be present ---------- */
function writeReport() {
  const acts = data.main.activities;
  const sept = acts.filter((a) => a.status === 'approved' && a.date.startsWith('2026-09'));
  const count = (clubId) => sept.filter((a) => a.club_id === clubId).length;
  const cases = [
    ['Pending activities', acts.filter((a) => a.status === 'pending').length],
    ['Rejected activities', acts.filter((a) => a.status === 'rejected').length],
    ['Approved activity with neither photo nor link (build must skip)', acts.filter((a) => a.status === 'approved' && !a.photo_files && !a.post_link).length],
    ['Link-only activities', acts.filter((a) => a.status === 'approved' && !a.photo_files && a.post_link).length],
    ['Joint activities (partner clubs)', acts.filter((a) => a.partner_clubs).length],
    ['Story of the month picks', acts.filter((a) => a.story_of_month).length],
    ['Club with exactly 3 activities in Sep 2026 (qualifies)', count(small.club_id) === 3 ? 1 : 0],
    ['Club with 2 activities in Sep 2026 (does not qualify)', count(tiny.club_id) === 2 ? 1 : 0],
    ['Pending events', data.main.events.filter((e) => e.status === 'pending').length],
    ['Past events with a report linked', data.main.events.filter((e) => e.report_activity_id).length],
    ['Upcoming events', data.main.events.filter((e) => e.start_date > TODAY).length],
    ['Members who never opted in', master.filter((m) => m.is_rotarian && !m.directory_ok && !m.birthday_ok && !m.photo_ok).length],
    ['Members waiting for a moderator', master.filter((m) => !m.listing_approved && (m.directory_ok || m.birthday_ok || m.photo_ok)).length],
    ['Contact allowed = yes', master.filter((m) => m.contact_ok).length],
    ['Directory listed, contact = no', master.filter((m) => m.directory_ok && !m.contact_ok).length],
    ['Members with an approved photo', master.filter((m) => m.photo_ok && m.photo_approved).length],
    ['Birthdays in the week of 12–18 Oct', master.filter((m) => m.birthday_ok && m.listing_approved && /-10-1[2-8]$/.test(m.dob)).length],
    ['Couples with a spouse who is not a Rotarian', couples.filter((c) => c.person_b_id.startsWith('T-')).length],
    ['Rotarian couples in different clubs', couples.filter((c) => { const b = master.find((m) => m.member_id === c.person_b_id); const a = master.find((m) => m.member_id === c.person_a_id); return b.is_rotarian && a.club_id !== b.club_id; }).length],
    ['Couple awaiting the spouse\'s consent', couples.filter((c) => c.status === 'awaiting_spouse').length],
    ['Couple with mismatched dates', couples.filter((c) => c.status === 'check_dates').length],
    ['Couple withdrawn by a spouse', couples.filter((c) => c.status === 'withdrawn').length],
    ['Couple photos', couples.filter((c) => c.couple_photo_file).length],
    ['People marked deceased', master.filter((m) => m.status === 'deceased').length],
    ['Members who changed clubs (club history)', clubHistory.filter((h) => h.reason === 'transferred out').length],
    ['Inactive club kept on record', clubs.filter((c) => c.status === 'inactive').length],
    ['Pending consent requests', consentRequests.length],
    ['Pending removal requests', removalRequests.length],
    ['Pending club profile updates', clubProfileRequests.length],
  ];
  const missing = cases.filter(([, n]) => !n);
  const lines = [
    '# Sample data coverage',
    '',
    'Every awkward case the site must handle, and how many sample rows cover it. Generated by `npm run make-sample`.',
    '',
    '| Case | Rows |',
    '|---|---|',
    ...cases.map(([label, n]) => `| ${label} | ${n || '❌ 0'} |`),
    '',
  ];
  writeFileSync(resolve(ROOT, 'docs/sample-data-report.md'), lines.join('\n'));
  if (missing.length) {
    console.error('Missing sample cases:', missing.map(([l]) => l).join('; '));
    process.exit(1);
  }
}
