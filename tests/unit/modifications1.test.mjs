// Club services and projects, district campaigns, event registration and the weekly bulletin (modifications1).
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { core, plain, sampleOptions } from '../../lib/core.mjs';
import { derive } from '../../lib/derive.mjs';

const sample = JSON.parse(readFileSync(new URL('../../sample/sample-data.json', import.meta.url), 'utf8'));
const build = (tabs = sample.main) => plain(core.Core_buildPublicData(tabs, '2026-10-13T00:00:00Z', sampleOptions(sample)));
const media = { images: {}, pdfs: {} };

/* ---------- one ID, two rows ---------- */

test('two rows with one ID: the real row is kept, the sample one is left out and listed; the build does not stop', () => {
  const tabs = structuredClone(sample.main);
  const sampleEvent = tabs.events.find((e) => e.id === 'EVT-2026-0011' && e.status === 'approved');
  tabs.events.push({ ...sampleEvent, title: 'Real test event', is_sample: false });
  const twice = tabs.activities.find((a) => a.status === 'approved');
  tabs.activities.push({ ...twice, title: 'Second copy' });
  const d = build(tabs);
  assert.deepEqual(d.events.filter((e) => e.id === 'EVT-2026-0011').map((e) => e.title), ['Real test event']);
  assert.deepEqual(d.activities.filter((a) => a.id === twice.id).map((a) => a.title), [twice.title], 'otherwise the first row wins');
  assert.deepEqual(d.duplicate_ids.sort(), [twice.id, 'EVT-2026-0011'].sort());
  assert.deepEqual(build().duplicate_ids, []);
});

/* ---------- club services and projects ---------- */

test('services and projects: one per line; blank lines go; a line with a phone number or email is left out; 160 characters; 12 lines', () => {
  const skipped = [];
  const many = Array.from({ length: 15 }, (_, i) => `Service ${i + 1}`).join('\n');
  const lines = plain(core.Core_cleanLines(`A – b – c\n\n   B   \nRoti bank – call 98765 43210\nWrite to us at help@example.org\n${'x'.repeat(200)}\n${many}`, 'club S-1', skipped));
  assert.equal(lines[0], 'A – b – c');
  assert.equal(lines[1], 'B');
  assert.equal(lines[2].length, 160, 'long line cut to 160 characters');
  assert.equal(lines.length, 12, 'at most 12 lines');
  assert.deepEqual(skipped, ['club S-1 line', 'club S-1 line']);
  assert.equal(plain(core.Core_cleanLines('', 'club S-1', [])).length, 0);
});

test('a line splits on a spaced dash into its parts; times like "11 am–1 pm" stay whole', () => {
  const keys = ['what', 'when', 'where'];
  assert.deepEqual(plain(core.Core_lineParts('Free eye check-up – every Thursday, 11 am–1 pm – Roshni Centre', keys)),
    { what: 'Free eye check-up', when: 'every Thursday, 11 am–1 pm', where: 'Roshni Centre' });
  assert.deepEqual(plain(core.Core_lineParts('Sari bank - 2nd and 4th Saturday', keys)), { what: 'Sari bank', when: '2nd and 4th Saturday', where: '' });
  assert.deepEqual(plain(core.Core_lineParts('Roti bank', keys)), { what: 'Roti bank', when: '', where: '' });
  assert.deepEqual(plain(core.Core_lineParts('A – B – C – D', keys)), { what: 'A', when: 'B', where: 'C – D' });
});

test('public data: club lists cleaned, the phone line listed in skipped_items, and the build still passes the privacy check', () => {
  const d = build();
  const jhansi = d.clubs.find((c) => c.name === 'RC Jhansi');
  assert.equal(jhansi.services.length, 2);
  assert.equal(jhansi.services[0].what, 'Free eye check-up');
  assert.equal(jhansi.projects[0].name, 'Rotary Dental Clinic');
  assert.ok(d.skipped_items.includes('club S-036 line'));
  assert.ok(!JSON.stringify(d).includes('60000 00000'));
  assert.deepEqual(plain(core.Core_validatePublic(d)), []);
  assert.ok(d.clubs.filter((c) => c.services.length || c.projects.length).length >= 3, 'sample: services and projects for at least 3 clubs');
});

/* ---------- campaigns ---------- */

const campaignRow = { campaign_id: 'BLOOD-2026-27', rotary_year: '2026-27', name: 'Blood Donation Drive', unit: 'blood units', start_date: '2026-07-01', end_date: '2026-09-30' };

test('campaign label maps back to its id; the form offers a campaign until 30 days after it ends', () => {
  const label = core.Core_campaignLabel(campaignRow);
  assert.equal(label, 'Blood Donation Drive 2026-27 (blood units)');
  assert.equal(core.Core_campaignIdForLabel(label, [campaignRow]), 'BLOOD-2026-27');
  assert.equal(core.Core_campaignIdForLabel(core.CORE_NO_CAMPAIGN, [campaignRow]), '');
  assert.equal(core.Core_campaignIdForLabel('Something else', [campaignRow]), '');
  assert.equal(core.Core_openCampaigns([campaignRow], '2026-10-30').length, 1);
  assert.equal(core.Core_openCampaigns([campaignRow], '2026-10-31').length, 0);
  assert.equal(core.Core_openCampaigns([{ ...campaignRow, name: '' }], '2026-08-01').length, 0, 'a campaign without a name is ignored');
});

test('campaign totals: 204 + 22 + 65 = 291 from 3 reports; partners of a joint activity get no credit; pending, rejected and out-of-period work never count', () => {
  const tabs = structuredClone(sample.main);
  tabs.campaigns = [{ ...campaignRow, campaign_id: 'TEST-1', end_date: '2026-12-31', target: 1000 }];
  for (const a of tabs.activities) Object.assign(a, { campaign_id: '', campaign_count: '' });
  const approved = tabs.activities.filter((a) => a.status === 'approved' && a.photo_files && a.date >= '2026-07-01');
  const joint = approved.find((a) => a.partner_clubs);
  const others = approved.filter((a) => !a.partner_clubs && a.club_id !== joint.club_id);
  const [a1, a2] = [others[0], others.find((a) => a.club_id !== others[0].club_id)];
  Object.assign(joint, { campaign_id: 'TEST-1', campaign_count: 65 });
  Object.assign(a1, { campaign_id: 'TEST-1', campaign_count: 204 });
  Object.assign(a2, { campaign_id: 'TEST-1', campaign_count: 22 });
  Object.assign(tabs.activities.find((a) => a.status === 'pending'), { campaign_id: 'TEST-1', campaign_count: 500 });
  Object.assign(tabs.activities.find((a) => a.status === 'rejected'), { campaign_id: 'TEST-1', campaign_count: 500 });
  Object.assign(approved.find((a) => ![joint, a1, a2].includes(a)), { campaign_id: 'TEST-1', campaign_count: 900, date: '2026-06-30' });
  const d = build(tabs);
  const c = d.campaigns.find((x) => x.campaign_id === 'TEST-1');
  const t = plain(core.Core_campaignTotals(c, d.activities));
  assert.equal(t.total, 291);
  assert.equal(t.entries, 3);
  const credited = t.by_club.map((x) => x.club_id);
  for (const p of joint.partner_clubs.split(/,\s*/)) assert.ok(!credited.includes(p), `partner ${p} gets no credit`);
  assert.equal(t.by_club[0].count, 204, 'largest count first');

  const site = derive(d, media, '2026-10-13');
  const page = site.campaigns.find((x) => x.campaign_id === 'TEST-1');
  assert.equal(page.total, 291);
  assert.equal(page.percent, 29);
  assert.ok(page.isRunning);
  assert.ok(site.runningCampaigns.includes(page), 'shown on the home page while it runs');
  assert.equal(site.activities.find((a) => a.id === a1.id).campaign, page, 'activity carries its campaign tag');
  assert.equal(site.activities.find((a) => a.date === '2026-06-30' && a.campaign_id === 'TEST-1')?.campaign ?? null, null, 'no tag on work outside the campaign');
  assert.ok(!derive(d, media, '2027-01-02').runningCampaigns.some((x) => x.campaign_id === 'TEST-1'), 'no home band after it ends');
});

test('sample: a report tagged without a count is listed and adds 0; last year\'s campaign is grouped under its year', () => {
  const site = derive(build(), media, '2026-10-13');
  const blood = site.campaigns.find((c) => c.campaign_id === 'BLOOD-2026-27');
  assert.equal(blood.total, 339);
  assert.equal(blood.entries, 5);
  assert.equal(blood.clubs, 4);
  assert.deepEqual(site.campaignsByYear.map((g) => g.year), ['2026-27', '2025-26']);
  assert.equal(blood.chairCard ? true : false, true, 'the chair links to their member card');
  const jhansi = site.clubs.find((c) => c.name === 'RC Jhansi');
  assert.deepEqual(jhansi.campaigns.map((x) => [x.campaign.campaign_id, x.count]), [['BLOOD-2026-27', 226]]);
});

test('with no campaigns, nothing campaign-related appears', () => {
  const tabs = structuredClone(sample.main);
  tabs.campaigns = [];
  const site = derive(build(tabs), media, '2026-10-13');
  assert.equal(site.campaigns.length, 0);
  assert.equal(site.runningCampaigns.length, 0);
  assert.ok(site.activities.every((a) => !a.campaign));
  assert.ok(site.bulletin.campaigns.length === 0);
});

/* ---------- event registration ---------- */

test('registration line: every case', () => {
  const line = (e) => plain(core.Core_registrationLine(e, '2026-10-13'));
  assert.equal(line({ registration_status: 'Cancelled', registration_close_date: '2026-10-20' }).text, 'Cancelled');
  const postponed = line({ registration_status: 'Postponed', registration_close_date: '2026-10-20' });
  assert.equal(postponed.text, 'Postponed – new date to be announced');
  assert.doesNotMatch(postponed.line, /Registration open/);
  assert.equal(line({ registration_status: 'Seats full' }).text, 'Seats full');
  assert.equal(line({ registration_status: 'Extended', registration_close_date: '2026-12-10' }).text, 'Registration extended till 10 Dec');
  assert.equal(line({ registration_close_date: '2026-10-20' }).text, 'Registration open till 20 Oct');
  assert.equal(line({ registration_close_date: '2026-10-13' }).text, 'Registration open till 13 Oct', 'open on the closing day itself');
  assert.equal(line({ registration_close_date: '2026-10-12' }).text, 'Registration closed');
  assert.equal(line({}).line, '', 'neither set: no line');
  assert.equal(line({ registration_close_date: '2026-10-20', fee: '₹500' }).line, 'Registration open till 20 Oct · Fee: ₹500');
  assert.equal(line({ fee: 'Free' }).line, 'Fee: Free');
});

test('a fee with payment details or a phone number is left out; the privacy check refuses one that slips through', () => {
  const tabs = structuredClone(sample.main);
  const approved = tabs.events.filter((e) => e.status === 'approved');
  approved[0].fee = 'Pay by UPI to rotary@okbank';
  approved[1].fee = '₹500, call 98765 43210';
  approved[2].fee = '₹200 per person';
  const d = build(tabs);
  assert.equal(d.events.find((e) => e.id === approved[0].id).fee, '');
  assert.equal(d.events.find((e) => e.id === approved[1].id).fee, '');
  assert.equal(d.events.find((e) => e.id === approved[2].id).fee, '₹200 per person');
  assert.ok(d.skipped_items.includes(`event ${approved[0].id} fee`));
  assert.deepEqual(plain(core.Core_validatePublic(d)), []);
  d.events[0].fee = 'A/c 12345 IFSC ABCD0001';
  assert.ok(plain(core.Core_validatePublic(d)).some((e) => /payment details/.test(e)));
});

/* ---------- the weekly bulletin ---------- */

const CLUBS = [
  { club_id: 'A1', name: 'RC A One', zone: 'Agra' }, { club_id: 'A2', name: 'RC A Two', zone: 'Agra' },
  { club_id: 'B1', name: 'RC B One', zone: 'Bareilly' }, { club_id: 'K1', name: 'RC K One', zone: 'Kanpur' },
];
const S = '2026-10-18'; // a Sunday
const pub = (over = {}) => ({ site: { district: 'Rotary District 3110', zones: ['Agra', 'Bareilly', 'Kanpur'] }, clubs: CLUBS, events: [], activities: [], campaigns: [], ...over });
const act = (id, club, approvedAt, extra = {}) => ({ id, club_id: club, title: `Activity ${id}`, date: approvedAt.slice(0, 10), photos: ['sample:x.jpg'], post_link: '',
  story_of_month: false, bulletin_exclude: false, approved_at: approvedAt, campaign_id: '', campaign_count: 0, ...extra });
const evt = (id, start, extra = {}) => ({ id, title: `Event ${id}`, event_type: 'Club event open to all', start_date: start, end_date: '', start_time: '', city: 'Agra',
  organiser: 'RC A One', registration_close_date: '', fee: '', registration_status: '', bulletin_exclude: false, ...extra });
const bulletin = (data, sunday = S) => plain(core.Core_bulletin(data, sunday));

test('bulletin date: the Sunday on or before today', () => {
  assert.equal(core.Core_sundayOf('2026-10-18'), '2026-10-18');
  assert.equal(core.Core_sundayOf('2026-10-24'), '2026-10-18');
  assert.equal(core.Core_sundayOf('2026-10-13'), '2026-10-11');
});

test('done last week: approved Saturday 11 pm is in Sunday\'s bulletin; approved Sunday 9 am waits for the next one; no approval time, never', () => {
  const data = pub({ activities: [
    act('SAT', 'A1', '2026-10-17T17:30:00Z'), // Saturday 11 pm in India
    act('SUN', 'B1', '2026-10-18T03:30:00Z'), // Sunday 9 am in India
    act('OLD', 'K1', '2026-10-10T18:29:00Z'), // just before the week began
    act('NONE', 'A2', ''),
  ] });
  assert.deepEqual(bulletin(data).done.items.map((a) => a.id), ['SAT']);
  assert.deepEqual(bulletin(data, '2026-10-25').done.items.map((a) => a.id), ['SUN']);
});

test('done last week: at most one per club; 10 activities from 3 clubs show 3, "and 7 more"', () => {
  const acts = Array.from({ length: 10 }, (_, i) => act(`X${i}`, ['A1', 'B1', 'K1'][i % 3], `2026-10-1${2 + (i % 5)}T06:00:00Z`));
  const b = bulletin(pub({ activities: acts }));
  assert.equal(b.done.items.length, 3);
  assert.equal(new Set(b.done.items.map((a) => a.club_id)).size, 3);
  assert.equal(b.done.total, 10);
  assert.equal(b.done.more, 7);
  assert.equal(b.done.more_clubs, 3);
});

test('done last week: story of the month first, then photos before links; ties go round the zones, newest first; ticked rows left out', () => {
  const b = bulletin(pub({ activities: [
    act('A1-new', 'A1', '2026-10-16T06:00:00Z'),
    act('A2-newer', 'A2', '2026-10-17T06:00:00Z'),
    act('B1', 'B1', '2026-10-12T06:00:00Z'),
    act('K1-link', 'K1', '2026-10-15T06:00:00Z', { photos: [], post_link: 'https://example.com/p' }),
    act('K1-story', 'K1', '2026-10-13T06:00:00Z', { photos: [], post_link: 'https://example.com/q', story_of_month: true }),
    act('A1-hidden', 'A1', '2026-10-17T07:00:00Z', { bulletin_exclude: true }),
  ] }));
  assert.deepEqual(b.done.items.map((a) => a.id), ['K1-story', 'A2-newer', 'B1', 'A1-new']);
  assert.equal(b.done.total, 5, 'the excluded row is not counted');
});

test('coming up: the next 14 days and events still running; district events first; registration as it stood that Sunday', () => {
  const b = bulletin(pub({ events: [
    evt('CLUB', '2026-10-19', { registration_close_date: '2026-10-19' }),
    evt('DIST', '2026-10-30', { event_type: 'District event', organiser: "Governor's Office Team" }),
    evt('LAST', '2026-10-31'),
    evt('TOO-LATE', '2026-11-01'),
    evt('RUNNING', '2026-10-16', { end_date: '2026-10-20' }),
    evt('OVER', '2026-10-10', { end_date: '2026-10-17' }),
    evt('HIDDEN', '2026-10-20', { bulletin_exclude: true }),
    evt('POSTPONED', '2026-10-22', { registration_status: 'Postponed', registration_close_date: '2026-10-20' }),
    evt('CLOSING', '2026-12-05', { registration_close_date: '2026-10-24' }),
    evt('CLOSING-LATE', '2026-12-05', { registration_close_date: '2026-10-25' }),
    evt('CANCELLED', '2026-12-06', { registration_close_date: '2026-10-21', registration_status: 'Cancelled' }),
  ] }));
  assert.deepEqual(b.events.map((e) => e.id), ['DIST', 'RUNNING', 'CLUB', 'POSTPONED', 'LAST']);
  assert.equal(b.events.find((e) => e.id === 'POSTPONED').registration.text, 'Postponed – new date to be announced');
  assert.equal(b.events.find((e) => e.id === 'CLUB').registration.text, 'Registration open till 19 Oct');
  assert.deepEqual(b.closing.map((e) => e.id), ['CLOSING']);
  // the same bulletin built months later still says what it said that week
  assert.equal(bulletin(pub({ events: [evt('CLUB', '2026-10-19', { registration_close_date: '2026-10-19' })] })).events[0].registration.text, 'Registration open till 19 Oct');
});

test('campaign totals in the bulletin: campaigns running on Sunday, counting reports approved before Sunday', () => {
  const campaign = { campaign_id: 'C1', slug: 'c1', name: 'Blood Donation Drive', unit: 'blood units', start_date: '2026-07-01', end_date: '2027-06-30', sort_order: 0 };
  const b = bulletin(pub({ campaigns: [campaign, { ...campaign, campaign_id: 'C0', start_date: '2025-07-01', end_date: '2026-06-30' }], activities: [
    act('R1', 'A1', '2026-10-12T06:00:00Z', { campaign_id: 'C1', campaign_count: 100 }),
    act('R2', 'B1', '2026-10-18T06:00:00Z', { campaign_id: 'C1', campaign_count: 50 }), // approved after Sunday began
  ] }));
  assert.deepEqual(b.campaigns.map((c) => [c.campaign_id, c.total, c.clubs]), [['C1', 100, 1]]);
});

test('a week with nothing to say is still published: "A quiet week"', () => {
  const b = bulletin(pub());
  assert.equal(b.empty, true);
  const msg = core.Core_bulletinMessage(b, 'https://example.org/site');
  assert.match(msg, /A quiet week – no new activities or events\./);
  assert.match(msg, /Full bulletin: https:\/\/example\.org\/site\/bulletin\/2026-10-18\/$/);
});

test('WhatsApp message: the agreed lines, at most 5 events, never over 1,000 characters', () => {
  const long = 'A very long event title that goes on and on about the district conference and its many sessions';
  const events = Array.from({ length: 10 }, (_, i) => evt(`E${i}`, `2026-10-2${i % 10}`, { title: `${long} ${i}`, registration_close_date: '2026-10-25' }));
  const acts = Array.from({ length: 23 }, (_, i) => act(`X${i}`, ['A1', 'A2', 'B1', 'K1'][i % 4], '2026-10-14T06:00:00Z', { title: `${long} ${i}` }));
  const campaigns = [{ campaign_id: 'C1', slug: 'c1', name: 'Blood Donation Drive', unit: 'blood units', start_date: '2026-07-01', end_date: '', sort_order: 0 }];
  acts[0].campaign_id = 'C1';
  acts[0].campaign_count = 1226;
  const msg = core.Core_bulletinMessage(bulletin(pub({ events, activities: acts, campaigns })), 'https://example.org/');
  assert.ok(msg.length <= 1000, `${msg.length} characters`);
  assert.match(msg, /^\*This week in Rotary District 3110\* – 18 Oct 2026\n\*Coming up\*\n• /);
  assert.ok((msg.match(/^• /gm) || []).length <= 5);
  assert.match(msg, /\*Done last week:\* 23 activities from 4 clubs, including /);
  assert.match(msg, /\*Blood Donation Drive:\* 1,226 blood units so far \(1 club\)/);
  assert.match(msg, /Full bulletin: https:\/\/example\.org\/bulletin\/2026-10-18\/$/);
});

test('website: a bulletin for every Sunday from the start date, newest first; only this week\'s when no start date is set', () => {
  const d = build();
  const site = derive(d, media, '2026-10-13');
  assert.deepEqual(site.bulletins.map((b) => b.sunday), ['2026-10-11', '2026-10-04', '2026-09-27', '2026-09-20', '2026-09-13']);
  assert.equal(site.bulletin.url, '/bulletin/2026-10-11/');
  const later = derive(d, media, '2026-10-18');
  assert.equal(later.bulletin.sunday, '2026-10-18');
  assert.deepEqual(later.bulletins.find((b) => b.sunday === '2026-10-11').raw, site.bulletin.raw, 'a past bulletin does not change once its week is over');
  const noStart = structuredClone(d);
  noStart.site.bulletin_start_date = '';
  assert.deepEqual(derive(noStart, media, '2026-10-13').bulletins.map((b) => b.sunday), ['2026-10-11']);
  const hidden = site.bulletins.flatMap((b) => b.done.items).find((a) => a.bulletin_exclude);
  assert.equal(hidden, undefined, 'a row ticked bulletin_exclude never appears');
});
