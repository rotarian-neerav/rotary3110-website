// Member cards, club member lists, people who have died or left, the role check, and the home page events.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { core, plain, sampleOptions } from '../../lib/core.mjs';
import { derive, homeEvents } from '../../lib/derive.mjs';

const sample = JSON.parse(readFileSync(new URL('../../sample/sample-data.json', import.meta.url), 'utf8'));
const media = { images: {}, pdfs: {} };
const build = (opts = sampleOptions(sample)) => plain(core.Core_buildPublicData(sample.main, '2026-10-13T00:00:00Z', opts));
const site = () => derive(build(), media, '2026-10-13');
const master = sample.private.members_master;
const deceased = master.find((m) => m.status === 'deceased' && m.is_rotarian);
const left = master.find((m) => m.status === 'left');
const year = sample.main.settings.find((s) => s.key === 'current_rotary_year').value;

test('one scrambled reference joins a person\'s roles and listing; the member ID never appears', () => {
  const d = build();
  const sharat = d.functionaries.filter((f) => f.name === 'PDG Sharat Chandra');
  assert.ok(sharat.length >= 5);
  assert.equal(new Set(sharat.map((f) => f.person_ref)).size, 1, 'same reference for every role');
  assert.match(sharat[0].person_ref, /^P[0-9a-f]{12}$/);
  const json = JSON.stringify(d);
  assert.ok(!json.includes('"T-0020"'), 'member ID not published');
  // a consenting member who is also an office bearer: same reference on both
  const listedOfficer = d.officers.find((o) => d.members.some((m) => m.person_ref === o.person_ref && m.directory_ok));
  assert.ok(listedOfficer, 'sample has an office bearer who is also listed in the directory');
  // the Sheet's keyed reference differs from the plain fallback, so it cannot be worked out from the ID
  assert.notEqual(build({ ...sampleOptions(sample), personRef: undefined }).functionaries[0].person_ref, d.functionaries[0].person_ref);
});

test('someone marked deceased or left: no role this year, past roles keep the name only', () => {
  const d = build();
  const now = d.officers.concat(d.functionaries).filter((r) => r.rotary_year === year);
  assert.ok(!now.some((r) => r.name === deceased.name), 'this year\'s role of a deceased member is left out');
  const past = d.officers.concat(d.functionaries).filter((r) => r.name === deceased.name);
  assert.ok(past.length >= 2, 'past roles kept');
  for (const r of past) {
    assert.equal(r.person_ref, '', 'no card link');
    assert.equal(r.photo, '');
    assert.equal(r.contact_link, '');
  }
  const s = site();
  assert.ok(!s.cards.some((c) => c.name === deceased.name || c.name === left.name), 'no member card');
  assert.ok(!s.directory.some((m) => m.name === deceased.name));
  assert.ok(!s.clubs.some((c) => c.members.some((p) => p.name === deceased.name)));
  assert.ok(!s.clubs.some((c) => c.officers.some((o) => o.name === deceased.name)));
  const pastYear = s.rolesByYear.find((y) => !y.current);
  const secretary = pastYear.leadership.flatMap((sec) => sec.groups.flatMap((g) => g.people)).find((p) => p.name === deceased.name);
  assert.ok(secretary, 'still listed in last year\'s leadership');
  assert.equal(secretary.card, '', 'as plain text');
});

test('a past spotlight story about someone no longer listed keeps the name only', () => {
  const tabs = structuredClone(sample.main);
  const key = tabs.spotlights[0].public_key;
  tabs.members_public = tabs.members_public.filter((m) => m.public_key !== key);
  tabs.settings.find((s) => s.key === 'inactive_keys').value += ', ' + key;
  const d = plain(core.Core_buildPublicData(tabs, '2026-10-13T00:00:00Z', sampleOptions(sample)));
  const story = d.spotlights.find((s) => s.month === tabs.spotlights[0].month);
  assert.equal(story.public_key, '');
  assert.equal(story.member_name, tabs.spotlights[0].member_name);
  // withdrawn consent (not deceased or left): the story goes
  const tabs2 = structuredClone(sample.main);
  tabs2.members_public = tabs2.members_public.filter((m) => m.public_key !== key);
  const d2 = plain(core.Core_buildPublicData(tabs2, '2026-10-13T00:00:00Z', sampleOptions(sample)));
  assert.ok(!d2.spotlights.some((s) => s.month === tabs.spotlights[0].month));
});

test('member card: every role, newest year first; only what the person agreed to show', () => {
  const s = site();
  const sharat = s.cards.find((c) => c.name === 'PDG Sharat Chandra');
  assert.deepEqual(sharat.years.map((y) => y.year), [year, '2023-24']);
  assert.equal(sharat.years[0].roles.length, 4, 'holds four roles this year');
  assert.equal(sharat.currentRoles.length, 4);
  assert.equal(sharat.listed, false, 'not in the directory');
  for (const k of ['profession', 'area', 'description', 'website', 'wa']) assert.equal(sharat[k], '', k);
  assert.match(sharat.url, /^\/members\/sharat-chandra-[0-9a-f]{6}\/$/);
  for (const c of s.cards) {
    assert.ok(!('birthday' in c) && !('anniversary' in c), 'no birthday or anniversary on cards');
    if (!c.listed) for (const k of ['profession', 'area', 'description', 'website', 'wa']) assert.equal(c[k], '', `${c.name}: ${k}`);
    for (let i = 1; i < c.years.length; i++) assert.ok(c.years[i - 1].year > c.years[i].year, 'newest year first');
  }
  assert.equal(new Set(s.cards.map((c) => c.url)).size, s.cards.length, 'card addresses are unique');
  const listed = s.cards.filter((c) => c.listed);
  assert.ok(listed.length && listed.every((c) => s.directory.some((d) => d.u === c.url)), 'directory entries link to their cards');
});

test('club members page: office bearers first, then district role holders, then others listed', () => {
  const s = site();
  for (const c of s.clubs) {
    const firstOther = c.members.findIndex((p) => !c.officers.some((o) => o.card === p.url));
    const officersOnPage = c.members.slice(0, firstOther < 0 ? c.members.length : firstOther);
    assert.equal(officersOnPage.length, c.officers.filter((o) => o.card).length, `${c.name}: office bearers first`);
    for (const o of c.officers) if (o.person_ref) assert.ok(o.card, `${c.name}: ${o.name} links to a card`);
  }
});

test('home page events: at most 8, district events first, each group in date order', () => {
  const ev = (id, date, isDistrict) => ({ id, start_date: date, isDistrict });
  const club = Array.from({ length: 10 }, (_, i) => ev('c' + i, `2026-11-${10 + i}`, false));
  const two = homeEvents([ev('d1', '2026-12-01', true), ...club, ev('d2', '2027-01-05', true)].sort((a, b) => a.start_date.localeCompare(b.start_date)));
  assert.deepEqual(two.map((e) => e.id), ['d1', 'd2', 'c0', 'c1', 'c2', 'c3', 'c4', 'c5']);
  const many = Array.from({ length: 11 }, (_, i) => ev('d' + i, `2026-11-${10 + i}`, true));
  assert.deepEqual(homeEvents([...many, ...club]).map((e) => e.id), many.slice(0, 8).map((e) => e.id), 'more than 8 district events: the next 8');
  const s = site();
  assert.ok(s.upcomingEvents.length > 8, 'sample has more events than the home page shows');
  assert.equal(s.homeEvents.length, 8);
  const firstClub = s.homeEvents.findIndex((e) => !e.isDistrict);
  assert.ok(s.homeEvents.slice(firstClub).every((e) => !e.isDistrict), 'district events first');
  assert.equal(s.homeEvents.filter((e) => e.isDistrict).length, s.upcomingEvents.filter((e) => e.isDistrict).length, 'all district events shown');
  assert.ok(s.homeEvents.find((e) => e.organiser === 'District Rotary Foundation Team').isDistrict, 'organised by a district team counts as district');
});

test('role check: lists roles that cannot join up on a card, most urgent first', () => {
  const people = [
    { member_id: '100', name: 'Rtn Asha Gupta', status: 'active' },
    { member_id: '200', name: 'Rtn Vivek Rao', status: 'deceased' },
    { member_id: '300', name: 'Rtn Meena Jain', status: 'active' },
  ];
  const rows = [
    { _row: 2, rotary_year: '2025-26', club_id: 'S-1', member_id: '100', name: 'PP Asha Gupta' }, // titles do not matter
    { _row: 3, rotary_year: '2025-26', club_id: 'S-1', member_id: '200', name: 'Rtn Vivek Rao' },
    { _row: 4, rotary_year: '2025-26', club_id: 'S-1', member_id: '', name: 'Rtn No Id' },
    { _row: 5, rotary_year: '2025-26', club_id: 'S-1', member_id: '999', name: 'Rtn Not Listed' },
    { _row: 6, rotary_year: '2025-26', club_id: 'S-1', member_id: '300', name: 'Rtn Meenakshi Jain' },
    { _row: 7, rotary_year: '2024-25', club_id: 'S-2', member_id: '400', name: 'Rtn Ravi Kumar', is_sample: true },
  ];
  const out = plain(core.Core_checkRoles(rows, [], people, '2025-26'));
  assert.deepEqual(out.map((o) => o.row), [3, 4, 5, 6]);
  assert.match(out[0].problem, /marked "deceased"/);
  assert.match(out[1].problem, /No member ID/);
  assert.match(out[2].problem, /not found/);
  assert.match(out[3].problem, /Name differs.*Meena Jain/);
  const dup = plain(core.Core_checkRoles([
    { _row: 2, rotary_year: '2025-26', club_id: 'S-1', member_id: '100', name: 'Rtn Asha Gupta' },
    { _row: 3, rotary_year: '2024-25', club_id: 'S-1', member_id: '101', name: 'Asha Gupta' },
  ], [], people, '2025-26'));
  assert.ok(dup.some((o) => /two cards/.test(o.problem)));
});

test('the privacy check refuses a person reference that is not scrambled', () => {
  const d = build();
  d.officers[0].person_ref = 'P9000001';
  assert.ok(core.Core_validatePublic(d).some((e) => /scrambled/.test(e)));
});
