// Owner's go, 26 Nov 2026 (B14–B18): the directory's order, the Story of the month shortlist and reminder, the daily
// member spotlight, and Rotarian couples (the Couples page, the anniversary banner, the ribbon on cards).
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import vm from 'node:vm';
import { before, test } from 'node:test';
import { createGoogleEnv } from '../helpers/google-mock.mjs';
import { routeOldForms } from '../helpers/forms.mjs';
import { bundleCode } from '../../tools/bundle-apps-script.mjs';
import { core, plain, sampleOptions } from '../../lib/core.mjs';
import { dailySpotlight, derive, spotlightDay, SPOTLIGHT_START } from '../../lib/derive.mjs';

const ROOT = resolve(import.meta.dirname, '../..');
const sample = JSON.parse(readFileSync(resolve(ROOT, 'sample/sample-data.json'), 'utf8'));
const media = { images: {}, pdfs: {} };
const build = () => plain(core.Core_buildPublicData(sample.main, '2026-10-13T00:00:00Z', sampleOptions(sample)));

/* ---------- Story of the month: shortlist (B16) ---------- */

const act = (id, club, date, extra = {}) => ({ id, club_id: club, club_name: 'RC ' + club, title: 'Activity ' + id, date, status: 'approved', ...extra });
const pic = (n) => 'drive:1PhotoForTheStoryTest' + String(n).padStart(6, '0'); // Drive ids are 25+ characters
const words = (n) => Array.from({ length: n }, () => 'word').join(' ');

test('story shortlist: last month\'s approved activities ranked by quality, not by how many a club sent', () => {
  const list = [
    act('A1', 'C1', '2026-10-05', { description: words(10) }),
    act('A2', 'C2', '2026-10-09', { description: words(130), photo_files: [pic(1), pic(2), pic(3)].join(', '), people_helped: '250', press_paper: 'Amar Ujala' }),
    act('A3', 'C3', '2026-10-20', { description: words(60), photo_files: pic(4) }),
    act('A4', 'C1', '2026-11-02', { description: words(200), photo_files: pic(5) }), // this month: not on last month's list
    act('A5', 'C4', '2026-10-11', { description: words(200), status: 'pending' }), // not approved
    act('A6', 'C5', '2026-10-12', { description: words(200), status: 'hidden' }),
    act('A7', 'C6', '2026-10-13', { description: words(200), title: 'Practice: test', is_sample: true }),
  ];
  const r = plain(core.Core_storyShortlist(list, '2026-10'));
  assert.deepEqual(r.items.map((x) => x.id), ['A2', 'A3', 'A1']);
  assert.match(r.items[0].why, /3 photos.*full description.*people helped stated.*press or video/);
  assert.deepEqual(r.picked, []);
});

test('story shortlist: a club that won in the last six months rests; a starred activity counts as picked', () => {
  const list = [
    act('W1', 'C1', '2026-03-10', { story_of_month: 'TRUE' }), // seven months before October: no longer resting
    act('W2', 'C2', '2026-08-10', { story_of_month: 'TRUE' }),
    act('B1', 'C1', '2026-10-05', { description: words(130) }),
    act('B2', 'C2', '2026-10-06', { description: words(130), photo_files: pic(6) }),
    act('B3', 'C3', '2026-10-07', { description: words(10) }),
  ];
  let r = plain(core.Core_storyShortlist(list, '2026-10'));
  assert.deepEqual(r.items.map((x) => x.id), ['B1', 'B3'], 'C2 won in August, so its better activity rests');
  assert.equal(r.resting, 1);
  list.push(act('B4', 'C4', '2026-10-30', { story_of_month: 'TRUE' }));
  r = plain(core.Core_storyShortlist(list, '2026-10'));
  assert.deepEqual(r.picked, ['B4']);
  assert.equal(core.Core_monthBefore('2026-01-15'), '2025-12');
  assert.equal(core.Core_monthBefore('2026-11'), '2026-10');
});

let env;
let token;
const Q = {};
before(() => {
  env = createGoogleEnv({ sampleJson: readFileSync(resolve(ROOT, 'sample/sample-data.json'), 'utf8') });
  env.load(bundleCode());
  routeOldForms(env);
  Object.assign(Q, env.context.Q);
  env.run('setup');
  token = env.props.get('DATA_TOKEN');
  const sh = env.main.getSheetByName('moderators');
  sh.set(2, 2, 'Asha Content'); sh.set(2, 3, 'asha@example.com'); sh.set(2, 4, 'TRUE');
});
const signIn = (email) => {
  for (const k of [...env.cache.keys()]) if (k.startsWith('deskrate:')) env.cache.delete(k);
  const before = env.mails.length;
  assert.ok(env.post({ fn: 'code', email }).ok);
  const code = env.mails.slice(before).filter((m) => m.to === email).at(-1).subject.match(/(\d{6})$/)[1];
  const r = env.post({ fn: 'signin', email, code });
  assert.ok(r.ok, r.error);
  return r.session;
};

test('the desk shows last month\'s shortlist; the Monday summary reminds until a moderator picks one; nothing is picked by itself', () => {
  const today = core.Core_isoDate(new Date());
  const last = core.Core_monthBefore(today);
  env.run('appendRow_', env.main, 'activities', { id: 'SOM-1', club_id: 'S-001', club_name: 'RC Story One', title: 'Eye camp for 300 villagers', date: last + '-08',
    description: words(140), photo_files: [pic(7), pic(8)].join(', '), people_helped: '300', status: 'approved', approved_at: new Date().toISOString() });
  env.run('appendRow_', env.main, 'activities', { id: 'SOM-2', club_id: 'S-002', club_name: 'RC Story Two', title: 'Club meeting', date: last + '-09',
    description: words(8), status: 'approved', approved_at: new Date().toISOString() });
  const session = signIn('asha@example.com');
  let c = env.post({ fn: 'list', session }).content;
  assert.equal(c.shortlist.month, last);
  assert.equal(c.shortlist.items[0].id, 'SOM-1', 'the fuller report comes first');
  assert.match(c.shortlist.label, /^[A-Z][a-z]{2} \d{4}$/);

  env.pages.buildInfo = { generated_at: new Date().toISOString() };
  env.run('weeklySummary');
  assert.match(env.mails.at(-1).body, /STORY OF THE MONTH\nNo Story of the month for [A-Z][a-z]{2} \d{4} yet\..*Eye camp for 300 villagers \(RC Story One\)/);

  const r = env.post({ fn: 'flag', session, tab: 'activities', id: 'SOM-1', field: 'story_of_month', value: true });
  assert.ok(r.ok, r.error);
  c = env.post({ fn: 'list', session }).content;
  assert.deepEqual(plain(c.shortlist.picked), ['SOM-1']);
  env.run('weeklySummary');
  assert.doesNotMatch(env.mails.at(-1).body, /STORY OF THE MONTH/, 'no reminder once a story is picked');
  const story = env.main.getSheetByName('activities');
  const col = story.data[0].indexOf('story_of_month');
  const idCol = story.data[0].indexOf('id');
  const starred = story.data.filter((row) => /^SOM-/.test(row[idCol]) && String(row[col]).toUpperCase() === 'TRUE').map((row) => row[idCol]);
  assert.deepEqual(starred, ['SOM-1'], 'only the moderator\'s pick is set');
});

/* ---------- Member spotlight, one a day (B17) ---------- */

const member = (key, club, extra = {}) => ({
  public_key: key, name: 'Rtn ' + key, club_id: club, directory_ok: true, spotlight_ok: true, photo: 'drive:' + key,
  description: 'What ' + key + ' does', profession: 'Doctor', area: 'Agra', ...extra,
});
const asPerson = (m) => ({ name: m.name, club: m.club_id });

test('daily spotlight: only members who chose it, are listed and have a photo and their own words; each once per round', () => {
  const members = [
    member('k1', 'A'), member('k2', 'A'), member('k3', 'A'), member('k4', 'B'), member('k5', 'B'), member('k6', 'C'),
    member('no-consent', 'C', { spotlight_ok: false }), member('not-listed', 'C', { directory_ok: false }),
    member('no-photo', 'C', { photo: '' }), member('no-words', 'C', { description: '  ' }),
  ];
  const d = dailySpotlight(members, [], asPerson);
  const names = d.items.map((e) => e.people[0].name);
  assert.equal(d.start, SPOTLIGHT_START);
  assert.deepEqual([...names].sort(), ['Rtn k1', 'Rtn k2', 'Rtn k3', 'Rtn k4', 'Rtn k5', 'Rtn k6'], 'everyone eligible, once');
  const clubs = d.items.map((e) => e.people[0].club);
  for (let i = 1; i < clubs.length; i++) assert.notEqual(clubs[i], clubs[i - 1], 'two members of one club never follow each other here: ' + clubs.join(','));
  assert.deepEqual(dailySpotlight([...members].reverse(), [], asPerson), d, 'the same order whatever order the Sheet has');
});

test('daily spotlight: not A to Z; a club with many members is spread through the round', () => {
  const members = [];
  for (let i = 0; i < 30; i++) members.push(member('big' + String(i).padStart(2, '0'), 'BIG'));
  for (let i = 0; i < 30; i++) members.push(member('s' + i, 'C' + i));
  const order = dailySpotlight(members, [], asPerson).items.map((e) => e.people[0]);
  assert.notDeepEqual(order.map((p) => p.name), [...order.map((p) => p.name)].sort(), 'not alphabetical');
  for (let i = 1; i < order.length; i++) assert.ok(!(order[i].club === 'BIG' && order[i - 1].club === 'BIG'), 'no two BIG members in a row');
});

test('daily spotlight: a Rotarian couple who both chose it share one day', () => {
  const members = [member('h', 'A'), member('w', 'B'), member('x', 'C')];
  const couples = [{ k: 'C-1', a: { key: 'h' }, b: { key: 'w' } }];
  const d = dailySpotlight(members, couples, asPerson);
  assert.equal(d.items.length, 2);
  assert.deepEqual(d.items.find((e) => e.people.length === 2).people.map((p) => p.name).sort(), ['Rtn h', 'Rtn w']);
  // only one of them chose the spotlight: that one has a day alone
  const one = dailySpotlight([member('h', 'A'), member('w', 'B', { spotlight_ok: false })], couples, asPerson);
  assert.deepEqual(one.items.map((e) => e.people.length), [1]);
});

test('the website: today\'s member is the turn for the build day; the next day is the next one; the last six days follow', () => {
  assert.equal(spotlightDay(SPOTLIGHT_START), 0);
  assert.equal(spotlightDay('2026-11-26') - spotlightDay('2026-11-25'), 1);
  const s = derive(build(), media, '2026-10-13');
  const n = s.spotlightDaily.items.length;
  assert.ok(n >= 2, 'the sample has members for the spotlight');
  assert.deepEqual(s.spotlightToday, s.spotlightDaily.items[spotlightDay('2026-10-13') % n]);
  const next = derive(build(), media, '2026-10-14');
  assert.deepEqual(next.spotlightToday, s.spotlightDaily.items[(spotlightDay('2026-10-13') + 1) % n]);
  assert.deepEqual(s.spotlightRecent[0], s.spotlightDaily.items[(spotlightDay('2026-10-13') - 1) % n]);
  assert.equal(s.spotlightRecent.length, Math.min(6, n - 1));
  assert.equal(s.has.spotlight, true);
  // what the browser gets: names, clubs, own words and photos only; never numbers or keys
  const json = JSON.stringify(s.spotlightDaily);
  assert.doesNotMatch(json, /wa\.me|public_key|member_id|"key"/);
});

/* ---------- Rotarian couples (B18) ---------- */

test('Rotarian couples: both Rotarians and both in the directory; ribbons on both cards and directory entries', () => {
  const d = build();
  const s = derive(d, media, '2026-10-13');
  assert.ok(s.rotarianCouples.length > 0, 'the sample has Rotarian couples');
  for (const c of s.rotarianCouples) {
    const a = d.members.find((m) => m.public_key === c.a.key);
    const b = d.members.find((m) => m.public_key === c.b.key);
    assert.ok(a.directory_ok && b.directory_ok);
    assert.equal(c.bridging, a.club_id !== b.club_id);
    assert.equal(s.directory.find((x) => x.k === c.a.key).spouse.name, c.b.name);
    assert.equal(s.directory.find((x) => x.k === c.b.key).spouse.name, c.a.name);
    assert.equal(s.cards.find((x) => x.memberKey === c.a.key).spouse.name, c.b.name);
  }
  // a couple where one spouse is not in the directory is not shown as a Rotarian couple anywhere
  const first = s.rotarianCouples[0];
  const hidden = derive({ ...d, members: d.members.map((m) => (m.public_key === first.b.key ? { ...m, directory_ok: false } : m)) }, media, '2026-10-13');
  assert.ok(!hidden.rotarianCouples.some((c) => c.k === first.k));
  assert.ok(!hidden.directory.find((x) => x.k === first.a.key)?.spouse);
  assert.ok(!hidden.celebrations.rotarianCouples.some((c) => c.k === first.k));
  // a spouse who is not a Rotarian never makes a Rotarian couple
  assert.ok(s.rotarianCouples.every((c) => d.couples.find((x) => x.couple_key === c.k).person_b_key));
});

test('Rotarian couples: the page joins the footer at 5 couples; WhatsApp wishes only for a spouse who allowed WhatsApp', () => {
  const d = build();
  const pair = d.couples.find((c) => c.person_b_key && d.members.find((m) => m.public_key === c.person_a_key)?.directory_ok);
  const extra = [];
  const members = [...d.members];
  for (let i = 0; i < 4; i++) {
    const a = { ...member('ca' + i, d.clubs[i].club_id), contact_ok: i === 0, contact_link: i === 0 ? 'https://wa.me/919876500001' : '' };
    const b = { ...member('cb' + i, d.clubs[i + 1].club_id), contact_ok: false, contact_link: '' };
    members.push(a, b);
    extra.push({ ...pair, couple_key: 'C-T' + i, person_a_key: a.public_key, person_b_key: b.public_key, person_a_name: a.name, person_b_name: b.name });
  }
  const before = derive(d, media, '2026-10-13');
  const after = derive({ ...d, members, couples: [...d.couples, ...extra] }, media, '2026-10-13');
  assert.equal(before.has.couples, before.rotarianCouples.length >= 5);
  assert.ok(after.rotarianCouples.length >= 5);
  assert.equal(after.has.couples, true);
  const banner = after.celebrations.rotarianCouples.find((c) => c.k === 'C-T0');
  assert.equal(banner.a.wa, 'https://wa.me/919876500001');
  assert.equal(banner.b.wa, '');
  assert.ok(after.celebrations.rotarianCouples.filter((c) => c.k !== 'C-T0').every((c) => !c.a.wa || after.directory.find((x) => x.name === c.a.name)?.wa === c.a.wa));
});

/* ---------- The page scripts, in a small stand-in for the browser ---------- */

function page(file, elements, json, now) {
  const listeners = {};
  const document = {
    querySelector: (sel) => elements[sel] || null,
    querySelectorAll: (sel) => (elements[sel] ? [].concat(elements[sel]) : []),
    getElementById: (id) => elements['#' + id] || null,
  };
  const ctx = {
    document,
    Math, JSON, String, Number, Array, Object, encodeURIComponent,
    Date: class extends Date { constructor(...a) { super(...(a.length ? a : [now])); } static now() { return now; } },
    escapeHtml: (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])),
    siteUrl: (p) => p,
    avatarHtml: (name) => '<i>' + name + '</i>',
    loadJson: () => ({ then: (fn) => fn(json) }),
  };
  ctx.Date.UTC = Date.UTC;
  ctx.Date.parse = Date.parse;
  vm.createContext(ctx);
  vm.runInContext(readFileSync(resolve(ROOT, 'src/assets/js', file), 'utf8'), ctx);
  return listeners;
}
const el = (extra = {}) => ({ innerHTML: '', textContent: '', hidden: true, attrs: {}, getAttribute(n) { return this.attrs[n] ?? null; }, addEventListener(ev, fn) { (this.on ||= {})[ev] = fn; }, ...extra });

const shownNames = (html) => [...html.matchAll(/<h3>Member (\d\d)/g)].map((m) => m[1]); // one per card

test('directory page: a new order each visit when nothing is searched; A to Z once a search or filter is used', () => {
  const people = Array.from({ length: 40 }, (_, i) => ({ name: 'Member ' + String(i).padStart(2, '0'), club: 'RC X', clubUrl: '/x/', profession: i % 2 ? 'Doctor' : 'Lawyer', area: 'Agra' }));
  const firsts = new Set();
  let form;
  let list;
  for (let visit = 0; visit < 5; visit++) {
    form = el({ profession: { value: '' }, area: { value: '' }, q: { value: '' } });
    list = el();
    page('directory.js', { '[data-directory]': form, '[data-directory-results]': list, '[data-directory-count]': el() }, people, Date.now());
    const az = shownNames(list.innerHTML);
    firsts.add(az[0]);
    assert.notDeepEqual(az, [...az].sort(), 'not A to Z when opened');
  }
  assert.ok(firsts.size > 1, 'the first name changes between visits');
  form.profession.value = 'Doctor';
  form.on.change();
  const shown = shownNames(list.innerHTML);
  assert.equal(shown.length, 20);
  assert.deepEqual(shown, [...shown].sort(), 'A to Z once filtered');
  form.profession.value = '';
  form.q.value = 'member';
  form.on.input();
  const searched = shownNames(list.innerHTML);
  assert.deepEqual(searched, [...searched].sort(), 'A to Z once searched');
});

test('directory page: a Rotarian couple\'s ribbon links to the spouse; the team pages never load the shuffling script', () => {
  const list = el();
  const form = el({ profession: { value: '' }, area: { value: '' }, q: { value: '' } });
  page('directory.js', { '[data-directory]': form, '[data-directory-results]': list, '[data-directory-count]': el() },
    [{ name: 'Rtn A', club: 'RC One', spouse: { name: 'Rtn B', club: 'RC Two', u: '/people/b/' } }], Date.now());
  assert.match(list.innerHTML, /♥ Rotarian couple with <a href="\/people\/b\/">Rtn B<\/a>, RC Two/);
  for (const f of ['leadership.njk', 'teams.njk', 'index.njk']) {
    const src = readFileSync(resolve(ROOT, 'src', f), 'utf8');
    assert.doesNotMatch(src, /directory\.js/, f + ' keeps its set order');
  }
});

test('home page anniversary banner: today\'s Rotarian couples, three at most, then "and n more"; the order changes by year', () => {
  const couple = (k, md, wa = '') => ({ k, md, couplePhoto: '', a: { name: 'Rtn ' + k + 'a', club: 'RC One', u: '/p/' + k + 'a/', wa }, b: { name: 'Rtn ' + k + 'b', club: 'RC Two', u: '', wa: '' } });
  const data = { birthdays: [], anniversaries: [], rotarianCouples: [couple('c1', '11-26', 'https://wa.me/919876500001'), couple('c2', '11-26'), couple('c3', '11-26'), couple('c4', '11-26'), couple('c5', '11-26'), couple('c6', '12-01')] };
  const run = (iso) => {
    const box = el();
    const ul = el();
    const more = el();
    const link = el();
    box.querySelector = (s) => ({ '[data-anniv-list]': ul, '[data-anniv-more]': more, '[data-anniv-more-link]': link }[s]);
    page('celebrations.js', { '[data-anniversary-banner]': box }, data, Date.parse(iso + 'T06:00:00Z'));
    return { box, ul, more, link };
  };
  const r = run('2026-11-26');
  assert.equal(r.box.hidden, false);
  assert.equal((r.ul.innerHTML.match(/anniv-tile/g) || []).length, 3);
  assert.equal(r.more.hidden, false);
  assert.equal(r.link.textContent, 'and 2 more couples celebrate today →');
  assert.doesNotMatch(r.ul.innerHTML, /c6/, 'another day\'s couple is not shown');
  if (/c1a/.test(r.ul.innerHTML)) assert.match(r.ul.innerHTML, /wa\.me\/919876500001\?text=Happy%20wedding%20anniversary/);
  const orders = new Set(['2026', '2027', '2028', '2029', '2030'].map((y) => [...run(y + '-11-26').ul.innerHTML.matchAll(/Rtn (c\d)a/g)].map((m) => m[1]).join()));
  assert.ok(orders.size > 1, 'the order is not the same every year');
  assert.equal(run('2026-11-27').box.hidden, true, 'no couple today: no banner');
});

test('spotlight page script: moves on one member each day in India time, without a rebuild', () => {
  const items = ['P0', 'P1', 'P2', 'P3'].map((n) => ({ people: [{ name: n, club: 'RC One', clubUrl: '/c/', text: 'Text ' + n }] }));
  const pick = (iso) => {
    const today = el({ attrs: { 'data-spotlight-today': '' } });
    page('spotlight.js', { '[data-spotlight-today]': today }, { start: SPOTLIGHT_START, items }, Date.parse(iso));
    return today.innerHTML.match(/P\d/)[0];
  };
  const day = spotlightDay('2026-11-26');
  assert.equal(pick('2026-11-26T06:00:00Z'), 'P' + (day % 4));
  assert.equal(pick('2026-11-27T06:00:00Z'), 'P' + ((day + 1) % 4));
  // 11:30 pm UTC on 25 Nov is already 26 Nov in India
  assert.equal(pick('2026-11-25T19:00:00Z'), 'P' + (day % 4));
});
