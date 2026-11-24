// Release A (17 October 2026): meeting days, Avenue of Service, press and videos, open events, public services
// with their own phone numbers, About page profiles and Past District Governors, Assistant Governors' clubs,
// zones kept off the website, city pages, "more like this", year summaries and explained abbreviations.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { core, plain, sampleOptions } from '../../lib/core.mjs';
import { derive, pdgName } from '../../lib/derive.mjs';
import { glossHtml } from '../../lib/gloss.mjs';
import glossary from '../../src/_data/glossary.js';

const sample = JSON.parse(readFileSync(new URL('../../sample/sample-data.json', import.meta.url), 'utf8'));
const build = (tabs = sample.main) => plain(core.Core_buildPublicData(tabs, '2026-10-13T00:00:00Z', sampleOptions(sample)));
const media = { images: {}, pdfs: {} };
const site = (d = build()) => derive(d, media, '2026-10-13');
// the sample's district team list is of 2024-25, as on the live site; on the sample's day the website's year is 2026-27
const LIST_YEAR = '2024-25';

/* ---------- small rules ---------- */

test('meeting day: the weekday answer first; otherwise the first weekday in the meeting text; otherwise none', () => {
  assert.equal(core.Core_meetingDay('Thursday', 'Every Monday, 7 pm'), 'Thursday');
  assert.equal(core.Core_meetingDay('thursday', ''), 'Thursday');
  assert.equal(core.Core_meetingDay('', 'Every Tuesday, 7:30 pm, Hotel Grand, Agra'), 'Tuesday');
  assert.equal(core.Core_meetingDay('', '1st and 3rd Sat, 7 pm'), 'Saturday');
  assert.equal(core.Core_meetingDay('Someday', 'Fortnightly at the club house'), '');
  assert.equal(core.Core_meetingDay('', ''), '');
});

test("a public service's phone: landlines, mobiles, toll-free and short numbers become tap-to-call; anything else is refused", () => {
  assert.deepEqual(plain(core.Core_servicePhone('0562 222 3344')), { display: '0562 222 3344', tel: '+915622223344' });
  assert.deepEqual(plain(core.Core_servicePhone('98765 43210')), { display: '98765 43210', tel: '+919876543210' });
  assert.deepEqual(plain(core.Core_servicePhone('+91 98765 43210')), { display: '+91 98765 43210', tel: '+919876543210' });
  assert.deepEqual(plain(core.Core_servicePhone('1800-180-1234')), { display: '1800-180-1234', tel: '18001801234' });
  assert.deepEqual(plain(core.Core_servicePhone('108')), { display: '108', tel: '108' });
  for (const bad of ['', 'ask at the gate', 'call 0562 222 3344', 'help@example.org', '12', '1234567890123456']) assert.equal(core.Core_servicePhone(bad), null, bad);
});

test('video links: YouTube (watch, youtu.be, shorts, embed, live) plays on the page; Instagram and Facebook stay links', () => {
  for (const url of ['https://www.youtube.com/watch?v=dQw4w9WgXcQ', 'https://youtu.be/dQw4w9WgXcQ', 'https://youtube.com/shorts/dQw4w9WgXcQ?si=x',
    'https://www.youtube.com/embed/dQw4w9WgXcQ', 'https://m.youtube.com/watch?feature=share&v=dQw4w9WgXcQ', 'https://www.youtube.com/live/dQw4w9WgXcQ']) {
    assert.deepEqual(plain(core.Core_videoLink(url)), { kind: 'youtube', id: 'dQw4w9WgXcQ', url }, url);
  }
  assert.equal(core.Core_videoLink('https://www.instagram.com/reel/abc/').kind, 'instagram');
  assert.equal(core.Core_videoLink('https://fb.watch/xyz/').kind, 'facebook');
  assert.equal(core.Core_videoLink('https://vimeo.com/123').kind, 'other');
  assert.equal(core.Core_videoLink('not a link'), null);
  assert.equal(core.Core_videoLink('https://www.youtube.com/watch?v=short').kind, 'other', 'an id that is not 11 characters is just a link');
});

test('a club named by id or by name, with or without "RC"', () => {
  const clubs = [{ club_id: 'S-1', club_name: 'RC Agra' }, { club_id: 'S-2', club_name: 'RC Agra Heritage' }];
  assert.equal(core.Core_clubRef('S-2', clubs), 'S-2');
  assert.equal(core.Core_clubRef('RC Agra', clubs), 'S-1');
  assert.equal(core.Core_clubRef('agra heritage', clubs), 'S-2');
  assert.equal(core.Core_clubRef('Rotary Club of Agra', clubs), 'S-1');
  assert.equal(core.Core_clubRef('RC Mathura', clubs), '');
});

test('contact form: a real message is forwarded; one with many links or hardly any words is held back', () => {
  assert.equal(core.Core_contactCheck('I would like to volunteer at the next blood donation camp in Agra.'), '');
  assert.equal(core.Core_contactCheck('मैं अगले रक्तदान शिविर में मदद करना चाहता हूँ'), '');
  assert.equal(core.Core_contactCheck('buy http://a.com http://b.com http://c.com now'), 'more than two links');
  assert.equal(core.Core_contactCheck('hi !!!'), 'too short to be a real message');
});

test('quiet clubs: one 30-day rule; active clubs with nothing (approved or waiting) dated in the last 30 days; never posted first, then the oldest last activity', () => {
  assert.equal(core.CORE_QUIET_DAYS, 30);
  const clubs = [{ club_id: 'A', club_name: 'RC A' }, { club_id: 'B', club_name: 'RC B' }, { club_id: 'C', club_name: 'RC C' }, { club_id: 'D', club_name: 'RC D', status: 'inactive' }];
  const acts = [
    { club_id: 'A', date: '2026-09-19', status: 'approved' },
    { club_id: 'B', date: '2026-09-18', status: 'pending' },
    { club_id: 'B', date: '2026-08-01', status: 'approved' },
    { club_id: 'C', date: '2026-10-15', status: 'rejected' },
    { club_id: 'C', date: '2026-07-04', status: 'approved' },
    { club_id: 'A', date: '2026-10-25', status: 'approved' },
  ];
  // 19 Oct: A posted on 19 Sep (exactly 30 days, counts); B's last is 18 Sep (31 days); C's rejected report does not count; a future date does not count
  assert.deepEqual(plain(core.Core_quietClubs(clubs, acts, '2026-10-19', core.CORE_QUIET_DAYS)).map((c) => [c.club_id, c.last_activity_date]),
    [['C', '2026-07-04'], ['B', '2026-09-18']]);
  assert.deepEqual(plain(core.Core_quietClubs([...clubs, { club_id: 'E', club_name: 'RC E' }], acts, '2026-10-19', 30)).map((c) => c.club_id), ['E', 'C', 'B'],
    'a club that has never posted comes first');
});

/* ---------- the public data ---------- */

test('zones never reach the website: not on clubs, roles or the site settings; the privacy check refuses them', () => {
  const d = build();
  assert.ok(d.clubs.every((c) => !('zone' in c)));
  assert.ok(d.functionaries.every((f) => !('zone' in f)));
  assert.ok(!('zones' in d.site));
  assert.ok(!/"zone"/.test(JSON.stringify(d)));
  const bad = structuredClone(d);
  bad.clubs[0].zone = 'Agra';
  assert.ok(plain(core.Core_validatePublic(bad)).some((e) => /zone must not be published/.test(e)));
});

test("clubs: the meeting day from the question or the meeting text; an Assistant Governor's clubs from names or ids", () => {
  const d = build();
  const by = (name) => d.clubs.find((c) => c.name === name);
  assert.equal(by('RC Jhansi').meeting_day, 'Thursday', 'from the weekday question');
  assert.equal(by('RC Kanpur').meeting_day, 'Saturday');
  const fromText = d.clubs.find((c) => c.meeting && !sample.main.clubs.find((s) => s.club_id === c.club_id).meeting_day);
  assert.match(fromText.meeting, new RegExp(fromText.meeting_day), 'read from the meeting text');
  const ags = d.functionaries.filter((f) => f.section === 'Assistant Governors' && f.rotary_year === LIST_YEAR);
  assert.ok(ags.length > 20 && ags.every((f) => f.clubs.length >= 1), 'every Assistant Governor has their clubs');
  const ids = new Set(d.clubs.map((c) => c.club_id));
  assert.ok(ags.every((f) => f.clubs.every((id) => ids.has(id))));
  const tabs = structuredClone(sample.main);
  const first = tabs.functionaries.find((f) => f.section === 'Assistant Governors');
  first.ag_clubs = 'RC Agra, S-002, No Such Club, RC Agra';
  const ag = build(tabs).functionaries.find((f) => f.section === 'Assistant Governors' && f.name === first.name);
  assert.deepEqual(ag.clubs, ['S-001', 'S-002'], 'unknown names dropped, no repeats');
});

test('activities: avenue (only the five), press coverage (paper, date, link), video; events: open to everyone', () => {
  const d = build();
  const by = (title) => d.activities.find((a) => a.title === title);
  assert.equal(by('RO plant for a village of 600 families').avenue, 'International Service');
  assert.deepEqual(by('Safe delivery kits for 120 mothers').press, { paper: 'Sample Daily News, Kanpur edition', date: '2026-09-19', link: 'https://example.com/news/safe-delivery-kits' });
  assert.equal(by('Gandhi Jayanti clean-up of the Ganga ghat').press.link, '');
  assert.equal(by('RO plant for a village of 600 families').video.kind, 'youtube');
  assert.equal(by('Second blood donation camp of the drive').video.kind, 'instagram');
  assert.ok(d.activities.some((a) => !a.avenue), 'older activities keep no avenue');
  const tabs = structuredClone(sample.main);
  const row = tabs.activities.find((a) => a.status === 'approved');
  Object.assign(row, { avenue: 'community service', press_paper: 'Call 98765 43210 for copies' });
  const a = build(tabs).activities.find((x) => x.id === row.id);
  assert.equal(a.avenue, 'Community Service');
  assert.equal(a.press, null, 'a press line with a phone number is left out');
  const ev = (title) => d.events.find((e) => e.title === title);
  assert.equal(ev('Career guidance day for Class 12 students').open_to_all, true, 'said so on the form');
  assert.equal(ev('Free eye camp').open_to_all, true, 'a club event open to all');
  assert.equal(ev('District Conference 2026').open_to_all, false);
});

test('public services: approved only, with the facility\'s own number as a tap-to-call link; bad numbers and text with an email are left out', () => {
  const d = build();
  const names = d.public_services.map((x) => x.name);
  assert.equal(d.public_services.length, 7);
  assert.ok(!names.some((n) => /PENDING|REJECTED/.test(n)));
  const blood = d.public_services.find((x) => x.name === 'Rotary Blood Bank');
  assert.deepEqual([blood.phone, blood.tel, blood.type], ['+91 60000 00001', '+916000000001', 'Blood bank']);
  const skill = d.public_services.find((x) => x.name === 'Rotary Skill Centre');
  assert.deepEqual([skill.phone, skill.tel, skill.about], ['', '', ''], 'no valid number; the line with an email is dropped');
  assert.ok(d.skipped_items.includes('public service SRV-S007 phone') && d.skipped_items.includes('public service SRV-S007 about'));
  assert.deepEqual(plain(core.Core_validatePublic(d)), [], 'the privacy check passes with the services\' numbers');
  // the exception is only for a service's own phone field
  const bad = structuredClone(d);
  bad.public_services[0].address = 'Near the clock tower, call 98765 43210';
  assert.ok(plain(core.Core_validatePublic(bad)).some((e) => /public_services\[0\]\.address: looks like a phone number/.test(e)));
  const bad2 = structuredClone(d);
  bad2.public_services[0].tel = '+919999999999';
  assert.ok(plain(core.Core_validatePublic(bad2)).some((e) => /phone is not a plain phone number/.test(e)));
});

test('About page: the latest profile of each role; Past District Governors newest last, a card only for those with a member ID', () => {
  const d = build();
  assert.deepEqual(d.profiles.map((p) => p.role), ['President of Rotary International', 'District Governor']);
  const tabs = structuredClone(sample.main);
  tabs.profiles.push({ ...tabs.profiles[1], rotary_year: '2023-24', name: 'Older DG' });
  assert.equal(build(tabs).profiles.find((p) => p.role === 'District Governor').name, 'Sample: District Governor', 'the newest year wins');
  assert.equal(d.past_governors.length, 28);
  assert.ok(d.past_governors.every((g, i) => i === 0 || d.past_governors[i - 1].term <= g.term), 'newest last');
  const late = d.past_governors.filter((g) => /Late PDG/.test(g.name));
  assert.equal(late.length, 2);
  assert.ok(late.every((g) => !g.person_ref));
  assert.ok(d.past_governors.filter((g) => !/Late PDG/.test(g.name)).every((g) => /^P[0-9a-f]{12}$/.test(g.person_ref)));
  assert.ok(!JSON.stringify(d.past_governors).includes('member_id'));
});

test('bulletin: "done last week" goes round the cities, the city with the newest activity first', () => {
  const clubs = [{ club_id: 'A1', name: 'RC A1', city: 'Agra' }, { club_id: 'A2', name: 'RC A2', city: 'Agra' }, { club_id: 'K1', name: 'RC K1', city: 'Kanpur' }];
  const act = (id, club, at) => ({ id, club_id: club, title: id, date: at.slice(0, 10), photos: ['sample:x.jpg'], post_link: '', story_of_month: false,
    bulletin_exclude: false, approved_at: at, campaign_id: '', campaign_count: 0 });
  const b = plain(core.Core_bulletin({ site: {}, clubs, events: [], campaigns: [], activities: [
    act('A1', 'A1', '2026-10-16T06:00:00Z'), act('A2', 'A2', '2026-10-15T06:00:00Z'), act('K1', 'K1', '2026-10-17T06:00:00Z'),
  ] }, '2026-10-18'));
  assert.deepEqual(b.done.items.map((a) => a.id), ['K1', 'A1', 'A2']);
});

/* ---------- the website ---------- */

test('city pages: every active club in exactly one city; each city has its events, recent activities and services', () => {
  const s = site();
  const listed = s.cities.flatMap((c) => c.clubs);
  assert.equal(listed.length, s.activeClubs.length);
  assert.equal(new Set(listed).size, listed.length);
  const agra = s.cities.find((c) => c.name === 'Agra');
  assert.equal(agra.url, '/cities/agra/');
  assert.ok(agra.events.every((e) => e.city === 'Agra' && !e.isPast));
  assert.ok(agra.activities.length <= 9);
  assert.ok(agra.services.some((x) => x.name === 'Rotary Blood Bank'));
  assert.ok(s.cities.some((c) => c.clubs.length === 1), 'one-club towns get a page too');
});

test('"more like this": the club\'s other work (never the activity itself), similar work by other clubs, the club\'s next event', () => {
  const s = site();
  for (const a of s.activities) {
    assert.ok(!a.more.clubRecent.includes(a) && !a.more.similar.includes(a));
    assert.ok(a.more.clubRecent.length <= 3 && a.more.similar.length <= 3);
    assert.ok(a.more.similar.every((x) => x.theme === a.theme && x.club_id !== a.club_id));
    if (a.more.nextEvent) assert.ok(a.more.nextEvent.club === a.club && !a.more.nextEvent.isPast);
  }
  assert.ok(s.activities.some((a) => a.more.nextEvent), 'sample: some club has an upcoming event');
  for (const e of s.events) assert.ok(!e.more.events.includes(e) && e.more.events.every((x) => !x.isPast));
});

test('year summaries: totals match the activities of that Rotary year; areas and avenues add up', () => {
  const s = site();
  assert.deepEqual(s.years.map((y) => y.year), ['2026-27', '2025-26']);
  for (const y of s.years) {
    const acts = s.activities.filter((a) => a.year === y.year);
    assert.equal(y.activities, acts.length);
    assert.equal(y.themes.reduce((n, t) => n + t.count, 0), acts.length);
    assert.equal(y.avenues.reduce((n, t) => n + t.count, 0) + y.noAvenue, acts.length);
    assert.equal(y.clubs.reduce((n, c) => n + c.count, 0), acts.filter((a) => a.club).length);
  }
  assert.equal(s.years[0].current, true);
});

test('Past District Governors: from the tab, then from the Governor line; until the tab is filled in, the College of Governors stands in', () => {
  const s = site();
  assert.equal(s.pastGovernors.length, 30, 'the 28 in the tab, and 2024-25 and 2025-26 from the Governor line');
  assert.deepEqual(s.pastGovernors.slice(-2).map((g) => [g.term, g.name]), [['2024-25', 'PDG Neerav N Agrawal'], ['2025-26', 'PDG Rajan Vidhyarthi']],
    'without the title typed in that year\'s list');
  assert.ok(s.pastGovernors.slice(-2).every((g) => g.card), 'with their member cards');
  for (const [typed, shown] of [['DGE Dr. A Rao', 'PDG Dr. A Rao'], ['PDG PDG Vivek GARG', 'PDG Vivek GARG'], ['Rtn. CA Mohan Lal', 'PDG CA Mohan Lal'], ['Neerav Agrawal', 'PDG Neerav Agrawal'], ['', '']]) {
    assert.equal(pdgName(typed), shown, 'Dr. and CA stay; a typed Rotary title is replaced');
  }
  assert.ok(!s.pastGovernors.some((g) => g.term >= '2026-27'), 'not this year\'s or a coming Governor');
  const d = build();
  d.past_governors = [];
  const fallback = site(d).pastGovernors;
  assert.ok(fallback.length >= 20 && fallback.every((g) => g.term && g.name));
  for (const list of [s.pastGovernors, fallback]) assert.ok(list.every((g, i) => i === 0 || list[i - 1].term <= g.term), 'newest last');
  // a Past Governor marked deceased stays on the list, without a card (owner, 24 Nov 2026)
  const tabs = structuredClone(sample.main);
  const pdg = tabs.past_governors.find((g) => g.member_id);
  const dead = derive(plain(core.Core_buildPublicData(tabs, '2026-10-13T00:00:00Z', { ...sampleOptions(sample), inactiveIds: [pdg.member_id] })), media, '2026-10-13');
  const listed = dead.pastGovernors.find((g) => g.name === pdgName(pdg.name));
  assert.ok(listed && !listed.card);
  const college = dead.rolesByYear.find((x) => x.current).leadership.find((x) => x.section === 'College of Governors').groups.flatMap((g) => g.people);
  assert.ok(!college.some((p) => p.name === pdgName(pdg.name)), 'but not in this year\'s College of Governors');
});

test('titles by year: Elect, Nominee and Nominee Designate ahead; Past only for the Governor and a club President', () => {
  const t = (role, held, from, club) => core.Core_roleTitle(role, held, from, club);
  assert.equal(t('District Governor', '2026-27', '2026-27'), 'District Governor');
  assert.equal(t('District Governor', '2027-28', '2026-27'), 'District Governor Elect');
  assert.equal(t('District Governor', '2028-29', '2026-27'), 'District Governor Nominee');
  assert.equal(t('District Governor', '2029-30', '2026-27'), 'District Governor Nominee Designate');
  assert.equal(t('District Governor', '2024-25', '2026-27'), 'Past District Governor');
  assert.equal(t('President', '2027-28', '2026-27', true), 'President Elect');
  assert.equal(t('President', '2024-25', '2026-27', true), 'Past President');
  assert.equal(t('Secretary', '2024-25', '2026-27', true), 'Secretary', 'no "Past" for a Secretary');
  assert.equal(t('Assistant Governor', '2024-25', '2026-27'), 'Assistant Governor', 'nor for a district team role');
  assert.equal(t('Chairman', '2027-28', '2026-27'), 'Chairman Elect');
  assert.equal(t('District Membership Chair (DMC)', '2027-28', '2026-27'), 'District Membership Chair Elect (DMC)');
  // a role typed with the word in it is read without it, its year from the term
  assert.equal(core.Core_baseRole('District Governor Nominee'), 'District Governor');
  assert.equal(core.Core_baseRole('District Governor-elect'), 'District Governor');
  assert.equal(core.Core_heldYear({ section: 'Governor line', rotary_year: '2024-25', term: '2026-27', role: 'District Governor Nominee' }), '2026-27');
  assert.equal(core.Core_heldYear({ section: 'College of Governors', rotary_year: '2024-25', term: '1983-84' }), '2024-25');
  assert.equal(t('District Governor Nominee', '2026-27', '2026-27'), 'District Governor');
});

test('the website\'s year comes from the date: 30 June is the old year, 1 July the new; no setting moves it', () => {
  const d = build();
  assert.equal(d.site.rotary_year, '2026-27');
  assert.equal(plain(core.Core_buildPublicData(sample.main, '2027-06-30T18:00:00Z', sampleOptions(sample))).site.rotary_year, '2026-27', '30 June, 11:30 pm in India');
  assert.equal(plain(core.Core_buildPublicData(sample.main, '2027-06-30T18:31:00Z', sampleOptions(sample))).site.rotary_year, '2027-28', '1 July, just after midnight in India');
  assert.equal(derive(d, media, '2027-06-30').rotaryYear, '2026-27');
  assert.equal(derive(d, media, '2027-07-01').rotaryYear, '2027-28');
  // data from a Sheet script still sending the old year setting does not move the website
  assert.equal(derive({ ...d, site: { ...d.site, rotary_year: '2024-25' } }, media, '2026-10-13').rotaryYear, '2026-27');
});

test('1 July: next year\'s team becomes this year\'s and the Governor a Past District Governor, with nothing done by hand', () => {
  const d = build();
  const before = derive(d, media, '2027-06-30');
  const after = derive(plain(core.Core_buildPublicData(sample.main, '2027-07-01T06:00:00Z', sampleOptions(sample))), media, '2027-07-01');
  const dg = (s) => s.rolesByYear.find((x) => x.current).leadership.find((x) => x.section === 'District Governor').groups[0].people[0];
  const nextDg = before.rolesByYear.find((x) => x.year === '2027-28').leadership.find((x) => x.section === 'District Governor').groups[0].people[0];
  assert.equal(nextDg.role, 'District Governor Elect');
  assert.equal(dg(after).name, nextDg.name);
  assert.equal(dg(after).role, 'District Governor');
  assert.ok(after.pastGovernors.some((g) => g.term === '2026-27' && g.name === `PDG ${dg(before).name}`), 'the outgoing Governor joins the Past District Governors');
  const club = (s) => s.clubs.find((c) => c.name === 'RC Agra');
  assert.ok(club(before).elects.length === 2 && club(before).officers.every((o) => o.since === '2024-25'));
  assert.deepEqual(club(after).officers.map((o) => [o.role, o.since]), [['President', ''], ['Secretary', '']], 'the Elects now hold office');
  assert.equal(club(after).elects.length, 0);
  const pastPresident = after.cards.find((c) => c.name === club(before).officers[0].name);
  assert.ok(pastPresident.titles.includes('Past President, RC Agra (2024-25)'));
});

test('club pages: the office bearers acting now, the last known with their year, then next year\'s as Elects', () => {
  const s = site();
  const agra = s.clubs.find((c) => c.name === 'RC Agra');
  assert.deepEqual(agra.officers.map((o) => [o.role, o.since]), [['President', '2024-25'], ['Secretary', '2024-25']]);
  assert.deepEqual(agra.elects.map((o) => o.role), ['President Elect', 'Secretary Elect']);
  assert.ok(agra.officers.concat(agra.elects).every((o) => o.card), 'each links to the member card');
  // a club that told this year's President: the 2024-25 one is a Past President, the Secretary carries on
  const told = s.clubs.find((c) => c.officers.some((o) => o.role === 'President' && !o.since));
  assert.deepEqual(told.officers.map((o) => [o.role, o.since]), [['President', ''], ['Secretary', '2024-25']]);
  const old = sample.main.officers.find((o) => o.club_id === told.club_id && o.role === 'President' && o.rotary_year === '2024-25');
  assert.ok(s.cards.find((c) => c.name === old.name).titles.includes(`Past President, ${told.name} (2024-25)`));
  const elect = s.cards.find((c) => c.name === agra.elects[0].name);
  assert.ok(elect.currentRoles.some((r) => r.role === 'President Elect'), 'the card says President Elect');
  assert.ok(s.directory.some((x) => x.u === elect.url && /President Elect/.test(x.roles)), 'and so does the directory');
  // data from a Sheet script deployed before 24 Nov 2026 has no acting mark: the website works it out
  const d = build();
  for (const o of d.officers) delete o.acting;
  const older = derive(d, media, '2026-10-13').clubs.find((c) => c.name === 'RC Agra');
  assert.deepEqual(older.officers.map((o) => [o.role, o.since]), [['President', '2024-25'], ['Secretary', '2024-25']]);
});

test('team pages: every year from the first list to the furthest entered, with this year\'s Governor and the coming ones', () => {
  const s = site();
  assert.deepEqual(s.rolesByYear.map((y) => y.label), ['2029-30 (from 1 July 2029)', '2028-29 (from 1 July 2028)', '2027-28 (from 1 July 2027)',
    '2026-27 (this year)', '2025-26', '2024-25', '2023-24']);
  const people = (year, sec) => (s.rolesByYear.find((x) => x.year === year).leadership.find((x) => x.section === sec)?.groups || []).flatMap((g) => g.people);
  // this year: no list yet, so the Governor, the coming Governors and the College of Governors are worked out
  assert.deepEqual(people('2026-27', 'District Governor').map((p) => [p.name, p.role]), [['Jasbir Bhatia', 'District Governor']]);
  const college = people('2026-27', 'College of Governors');
  assert.deepEqual(college.slice(-3).map((p) => p.role), ['District Governor Elect', 'District Governor Nominee', 'District Governor Nominee Designate']);
  assert.ok(college.some((p) => p.name === 'PDG Neerav N Agrawal' && p.role === 'Past District Governor' && p.term === '2024-25'));
  assert.ok(college.some((p) => p.name === 'PDG Rajan Vidhyarthi' && p.term === '2025-26'));
  // every Past District Governor is "PDG …", whether worked out or typed with or without a title (owner, 24 Nov 2026)
  assert.ok(college.filter((p) => p.role === 'Past District Governor').every((p) => /^PDG (?!PDG )\S/.test(p.name)), college.map((p) => p.name).join(', '));
  assert.ok(people(LIST_YEAR, 'College of Governors').filter((p) => p.role === 'Past District Governor').every((p) => /^PDG (?!PDG )\S/.test(p.name)));
  assert.ok(s.pastGovernors.every((g) => /^PDG (?!PDG )\S/.test(g.name)), 'the About page too');
  // a coming year's page (owner, 24 Nov 2026, option A): all the Past Governors in the same order, then this year's
  // Governor with today's title, then the Governor line
  const pastOnes = college.filter((p) => p.role === 'Past District Governor').map((p) => p.name);
  const next = people('2027-28', 'College of Governors');
  assert.deepEqual(next.slice(0, pastOnes.length).map((p) => p.name), pastOnes);
  assert.deepEqual(next.slice(pastOnes.length).map((p) => [p.name, p.role, p.term]), [['Jasbir Bhatia', 'District Governor', '2026-27'],
    ...next.slice(pastOnes.length + 1).map((p) => [p.name, p.role, p.term])]);
  assert.deepEqual(next.slice(pastOnes.length + 1).map((p) => p.role), ['District Governor Nominee', 'District Governor Nominee Designate']);
  const later = people('2028-29', 'College of Governors');
  assert.deepEqual(later.slice(pastOnes.length, pastOnes.length + 2).map((p) => p.role), ['District Governor', 'District Governor Elect'],
    "the 2028-29 page: this year's Governor, then the 2027-28 Governor Elect");
  assert.ok(!s.rolesByYear.find((x) => x.year === '2026-27').leadership.some((x) => x.section === 'Assistant Governors'), 'the rest stays blank');
  assert.equal(s.rolesByYear.find((x) => x.year === '2026-27').teams.length, 0);
  // a coming year's list shows today's titles
  assert.deepEqual(people('2027-28', 'Assistant Governors').map((p) => p.role), ['Assistant Governor Elect']);
  const teams = s.rolesByYear.find((x) => x.year === '2027-28').teams;
  assert.equal(teams[0].leaders[0].role, 'District Membership Chair Elect (DMC)');
  assert.equal(teams[0].committees[0].chairs[0].role, 'Chairman Elect');
  // the people search finds the Governor worked out for this year
  assert.ok(s.people.some((p) => p.year === '2026-27' && p.name === 'Jasbir Bhatia'));
});

test('District Leadership: sitting governor only, then the College of Governors (oldest first, DGE and DGN last), counsellors, AGs, aides, office', () => {
  const s = site();
  const y = s.rolesByYear.find((x) => x.year === LIST_YEAR);
  assert.deepEqual(y.leadership.map((x) => x.section),
    ['District Governor', 'College of Governors', 'District Counsellors', 'Assistant Governors', "Governor's Aides", "Governor's Office"]);
  const people = (sec) => y.leadership.find((x) => x.section === sec).groups.flatMap((g) => g.people);
  assert.deepEqual(people('District Governor').map((p) => p.role), ['District Governor']);
  const college = people('College of Governors');
  assert.deepEqual(college.slice(-2).map((p) => p.role), ['District Governor Elect', 'District Governor Nominee']);
  const pdgs = college.slice(0, -2);
  assert.ok(pdgs.every((p, i) => p.role === 'Past District Governor' && (i === 0 || pdgs[i - 1].term <= p.term)), 'PDGs oldest first');
  assert.ok(people("Governor's Aides").length > 0 && people("Governor's Aides").every((p) => p.committee === "Governor's Aide"));
  assert.ok(people("Governor's Office").every((p) => p.committee !== "Governor's Aide"));
  // a past year without a sitting governor row still lists its DGE and DGN at the end of the College of Governors
  const past = s.rolesByYear.find((x) => x.year === '2023-24');
  assert.ok(!past.leadership.some((x) => x.section === 'District Governor'));
  assert.deepEqual(past.leadership.find((x) => x.section === 'College of Governors').groups[0].people.slice(-2).map((p) => p.role),
    ['District Governor Elect', 'District Governor Nominee']);
});

test('sample Assistant Governors given by the district look after the clubs they named', () => {
  const y = site().rolesByYear.find((x) => x.year === LIST_YEAR);
  const ags = y.leadership.find((x) => x.section === 'Assistant Governors').groups[0].people;
  const clubsOf = (name) => ags.find((p) => p.name === name).agClubs.map((c) => c.name).sort();
  assert.deepEqual(clubsOf('Rtn Amit Khatri'), ['RC Kanpur', 'RC Kanpur Global', 'RC Kanpur Green', 'RC Kanpur South']);
  assert.deepEqual(clubsOf('Rtn Nirendra Sharma'), ['RC Aligarh', 'RC Aligarh City', 'RC Aligarh Rudra']);
});

test('In the news: newest coverage first; public services grouped by type in the agreed order', () => {
  const s = site();
  assert.deepEqual(s.news.map((a) => a.press.date), ['2026-10-03', '2026-09-19', '2026-09-14']);
  const order = sample.main.lists.filter((l) => l.list === 'service_type').map((l) => l.value);
  const types = s.servicesByType.map((g) => g.type);
  assert.deepEqual(types, [...types].sort((a, b) => order.indexOf(a) - order.indexOf(b)));
});

/* ---------- explained abbreviations ---------- */

const terms = glossary.filter((g) => g.abbr);
const wrap = (body) => glossHtml(`<html><head><title>DG</title></head><body><header>DG</header><main>${body}</main><footer>PDG</footer></body></html>`, terms);

test('abbreviations: the first use of each on the page is explained; the longest match wins; whole words only', () => {
  const out = wrap('<p>PDG Sharat Chandra and DG Neerav; another PDG and DGs and ADGE.</p>');
  assert.match(out, /<abbr class="gloss" title="Past District Governor" tabindex="0">PDG<\/abbr> Sharat/);
  assert.match(out, /<abbr class="gloss" title="District Governor" tabindex="0">DG<\/abbr> Neerav/);
  assert.equal((out.match(/class="gloss"/g) || []).length, 2, 'once each; "DGs" and "ADGE" are not words in the list');
  assert.match(out, /<title>DG<\/title>/, 'outside <main> untouched');
  assert.match(out, /<footer>PDG<\/footer>/);
});

test('abbreviations: never inside tags, scripts, form controls, existing <abbr> or anything marked data-nogloss', () => {
  const out = wrap('<a href="/x" title="DG page" data-x="TRF">go</a><script>var t = "DG";</script><select><option>DG</option></select>' +
    '<dl data-nogloss><dt>DG</dt><dd>District <em>Governor</em> DG</dd></dl><abbr title="x">TRF</abbr><p>Then TRF.</p>');
  assert.match(out, /title="DG page" data-x="TRF"/);
  assert.match(out, /var t = "DG";/);
  assert.match(out, /<option>DG<\/option>/);
  assert.match(out, /<dt>DG<\/dt><dd>District <em>Governor<\/em> DG<\/dd>/);
  assert.match(out, /<p>Then <abbr class="gloss" title="The Rotary Foundation" tabindex="0">TRF<\/abbr>\.<\/p>/);
});
