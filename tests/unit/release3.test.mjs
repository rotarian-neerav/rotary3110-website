// Release 3 (owner, 18 Nov 2026): a club's President, Secretary and Executive Secretary speak for the club. Until this
// year's holder of a role is told, the previous known holder carries on. club_senders_only (off / watch / on) accepts
// the activity and Club updates forms only from those office bearers' own email; refused forms wait on the desk's
// "Not accepted" tab until a moderator lets one through. weekly_club_email (off / test / on) sends each club's office
// bearers one email a week, on the club's own weekday, with what was approved for the club.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { before, beforeEach, test } from 'node:test';
import { createGoogleEnv } from '../helpers/google-mock.mjs';
import { bundleCode } from '../../tools/bundle-apps-script.mjs';
import { core } from '../../lib/core.mjs';

const ROOT = resolve(import.meta.dirname, '../..');
const YEAR = core.Core_rotaryYearOf(new Date().toISOString().slice(0, 10));
const LAST = '2024-25';
let env;
let Q;
let U;

const tab = (ss, t) => env.run('readTab_', ss, t);
const realClub = (id) => { const c = tab(env.main, 'clubs').find((x) => x.club_id === id); env.run('updateRow_', env.main, 'clubs', c._row, { is_sample: false }); };
const label = (id) => { const c = env.main.rows('clubs').find((x) => x.club_id === id); return c.display_name || c.club_name; };
const clubName = (id) => env.main.rows('clubs').find((c) => c.club_id === id).club_name;
const member = (id, name, club, email) => env.run('appendRow_', env.priv, 'members_master', { member_id: id, name, club_id: club, is_rotarian: true, status: 'active', email });
const officer = (year, club, id, name, role) => env.run('appendRow_', env.main, 'officers', { rotary_year: year, club_id: club, member_id: id, name, role, contact_ok: false });
const set = (k, v) => env.run('setSetting_', k, v);
const signIn = (email) => {
  env.post({ fn: 'code', email });
  const code = env.mails.filter((m) => m.to === email).at(-1).body.match(/\b(\d{6})\b/)[1];
  const r = env.post({ fn: 'signin', email, code });
  assert.ok(r.ok, r.error);
  return r.session;
};
const activity = (club, title, email) => {
  env.submit('activity', {
    [Q.club]: club, [Q.name]: 'Rtn Sender', [Q.role]: 'Member', [Q.mobile]: '98765 43210', [Q.kind]: Q.kindActivity,
    [Q.aTitle]: title, [Q.aDate]: '2026-10-10', [Q.aTheme]: 'Club service / Other', [Q.aDesc]: 'Members planted saplings along the canal road.',
    'Photos (up to 3, each under 1 MB)': ['1R1PhotoAbCdEfGhIjKlMnOpQrStUv'], [Q.aConsent]: ['yes'],
  }, email, new Date());
  return env.main.rows('activities').at(-1);
};

beforeEach(() => { if (env) env.quota.left = 100; });

before(() => {
  env = createGoogleEnv({ sampleJson: readFileSync(resolve(ROOT, 'sample/sample-data.json'), 'utf8') });
  env.load(bundleCode());
  ({ Q, CLUB_UPDATE_KINDS: U } = env.context);
  env.run('setup');
  const sh = env.main.getSheetByName('moderators');
  const types = env.main.rows('moderators').map((r) => r.type);
  [['Members', 'Meera Members', 'meera@example.com'], ['Content', 'Asha Content', 'asha@example.com']].forEach(([type, name, email]) => {
    const row = types.indexOf(type) + 2;
    sh.set(row, 2, name); sh.set(row, 3, email); sh.set(row, 4, 'TRUE');
  });
  // one real club (the sample's rows are left out of office bearers and club emails), with its 2024-25 office bearers
  realClub('S-004');
  member('8100001', 'Rtn Old President', 'S-004', 'old.president@example.com');
  member('8100002', 'Rtn Old Secretary', 'S-004', 'Old.Secretary@Example.com');
  officer(LAST, 'S-004', '8100001', 'Rtn Old President', 'President');
  officer(LAST, 'S-004', '8100002', 'Rtn Old Secretary', 'Secretary');
});

/* ---------- The rule (Core.js) ---------- */

test('acting office bearers: this year\'s holder if told, else the last known one; next year\'s count from 1 July; an ended role has nobody', () => {
  const rows = [
    { rotary_year: '2023-24', club_id: 'A', member_id: '1', name: 'Older', role: 'President' },
    { rotary_year: '2024-25', club_id: 'A', member_id: '2', name: 'Last President', role: 'President' },
    { rotary_year: '2024-25', club_id: 'A', member_id: '3', name: 'Last Secretary', role: 'Secretary' },
    { rotary_year: '2026-27', club_id: 'A', member_id: '4', name: 'New President', role: 'President' },
    { rotary_year: '2027-28', club_id: 'A', member_id: '5', name: 'Next President', role: 'President' },
    { rotary_year: '2024-25', club_id: 'B', member_id: '6', name: 'First', role: 'President' },
    { rotary_year: '2024-25', club_id: 'B', member_id: '7', name: 'Second', role: 'President' }, // a later row of the same year holds it
    { rotary_year: '2026-27', club_id: 'C', member_id: '8', name: 'Ended', role: 'Secretary', ended_on: '2026-10-01' },
    { rotary_year: '2024-25', club_id: 'C', member_id: '9', name: 'Not brought back', role: 'Secretary' },
    { rotary_year: '2024-25', club_id: 'D', member_id: '10', name: 'Sample', role: 'President', is_sample: true },
    { rotary_year: '2024-25', club_id: 'D', member_id: '11', name: 'Treasurer', role: 'Treasurer' },
  ];
  const a = core.Core_actingOfficers(rows, '2026-27');
  assert.equal(a.A.President.name, 'New President');
  assert.equal(a.A.President.carried, false);
  assert.equal(a.A.Secretary.name, 'Last Secretary');
  assert.equal(a.A.Secretary.carried, true);
  assert.equal(a.A.Secretary.acting_year, '2024-25');
  assert.equal(a.A['Executive Secretary'], undefined, 'nobody ever held it, so nobody acts');
  assert.equal(a.B.President.name, 'Second');
  assert.equal(a.C, undefined, 'a role ended this year is not handed back to an older holder');
  assert.equal(a.D, undefined, 'sample rows and other roles are left out');
  assert.equal(core.Core_actingOfficers(rows, '2027-28').A.President.name, 'Next President', 'next year\'s holder takes over on 1 July');
});

test('who sent a club\'s form: an acting office bearer by their own email, a moderator, or not; unknown when the club has no email on file', () => {
  const acting = core.Core_actingOfficers([
    { rotary_year: '2024-25', club_id: 'A', member_id: '1', role: 'President' },
    { rotary_year: '2024-25', club_id: 'A', member_id: '2', role: 'Secretary' },
    { rotary_year: '2024-25', club_id: 'B', member_id: '3', role: 'President' },
  ], '2026-27');
  const master = [
    { member_id: '1', email: 'Pres@Example.com', status: 'active' },
    { member_id: '2', email: 'gone@example.com', status: 'left' },
    { member_id: '3', email: '', status: 'active' },
  ];
  const mods = [{ type: 'Content', email: 'mod@example.com', active: true }];
  const who = (email, club) => core.Core_clubSender(email, club, acting, master, mods);
  assert.equal(who(' pres@example.com', 'A').who, 'officer');
  assert.deepEqual([...who('pres@example.com', 'A').held], ['President']);
  assert.equal(who('gone@example.com', 'A').who, 'other', 'a member who left no longer speaks for the club');
  assert.equal(who('mod@example.com', 'A').who, 'moderator');
  assert.equal(who('someone@example.com', 'A').who, 'other');
  assert.deepEqual([...who('someone@example.com', 'A').roles], ['President', 'Secretary']);
  assert.equal(who('someone@example.com', 'B').who, 'unknown', 'nobody of club B has an email on file');
  assert.equal(who('someone@example.com', '').who, 'unknown');
  assert.equal(core.Core_settingMode(' Watch '), 'watch');
  assert.equal(core.Core_settingMode('yes'), 'on');
  assert.equal(core.Core_settingMode('maybe'), 'off');
  assert.equal(core.Core_settingMode('test', ['off', 'test', 'on']), 'test');
});

test('weekly club email: each club has a fixed weekday spread over the week; a missed week goes late; nothing when nothing happened', () => {
  const ids = env.main.rows('clubs').map((c) => c.club_id);
  const days = new Set(ids.map(core.Core_clubWeekday));
  assert.equal(days.size, 7, 'every weekday gets some clubs');
  const id = ids[0];
  const wd = core.Core_clubWeekday(id);
  const day = (n) => new Date(Date.UTC(2026, 10, 1 + n)).toISOString().slice(0, 10); // 1 Nov 2026 is a Sunday
  const its = day(wd);
  assert.equal(core.Core_clubWeeklyDue(id, its, ''), true);
  assert.equal(core.Core_clubWeeklyDue(id, day(wd + 1), ''), false, 'not on another day');
  assert.equal(core.Core_clubWeeklyDue(id, day(wd + 7), its + 'T07:00:00Z'), true, 'a week later');
  assert.equal(core.Core_clubWeeklyDue(id, its, core.Core_addDays(its, -2) + 'T07:00:00Z'), false, 'not twice in a week');
  assert.equal(core.Core_clubWeeklyDue(id, day(wd + 8), its + 'T07:00:00Z'), true, 'missed on its day: goes the day after');
  const club = { club_name: 'RC Test', slug: 'test' };
  assert.equal(core.Core_clubWeeklyEmail(club, { officers: {} }, 'https://rotary3110.org/'), null);
  const mail = core.Core_clubWeeklyEmail(club, {
    activities: [{ title: 'Tree planting', date: '2026-11-02' }], changes: [{ change: 'joined', name: 'Rtn New' }, { change: 'club_role', name: 'Rtn P', role: 'President', rotary_year: '2026-27' }],
    shown: [{ name: 'Rtn Shown' }], officers: { President: { name: 'Rtn Old', carried: true, acting_year: '2024-25' } }, formUrl: 'https://forms.example/x',
  }, 'https://rotary3110.org');
  assert.match(mail.subject, /RC Test/);
  assert.match(mail.text, /Tree planting \(2 Nov 2026\)/);
  assert.match(mail.text, /Rtn New joined/);
  assert.match(mail.text, /Rtn P: President \(2026-27\)/);
  assert.match(mail.text, /Rtn Shown/);
  assert.match(mail.text, /President: Rtn Old \(from 2024-25, until this year's is told\)/);
  assert.match(mail.text, /https:\/\/rotary3110\.org\/clubs\/test\//);
  assert.doesNotMatch(mail.text, /remov/i, 'a member\'s removal stays private');
});

/* ---------- The sender check (club_senders_only) ---------- */

test('setup adds the Release 3 settings, all off; off files every form as before', () => {
  const s = Object.fromEntries(env.main.rows('settings').map((r) => [r.key, r.value]));
  assert.equal(s.club_senders_only, 'off');
  assert.equal(s.weekly_club_email, 'off');
  assert.equal(s.weekly_club_email_test_to, '');
  const a = activity(clubName('S-004'), 'Off: filed as before', 'stranger@example.com');
  assert.equal(a.status, 'pending');
  assert.equal(a.sender_check, '');
});

test('watch: nobody is refused; each row says who sent it, and the weekly summary counts them', () => {
  set('club_senders_only', 'watch');
  const before = env.mails.length;
  const a = activity(clubName('S-004'), 'Watch: stranger', 'stranger@example.com');
  assert.equal(a.status, 'pending');
  assert.match(a.sender_check, /^Not an office bearer of the club on file \(would not be accepted/);
  assert.ok(env.mails.slice(before).some((m) => m.subject.startsWith('To check:')), 'the moderators are told as usual');
  assert.ok(!env.mails.slice(before).some((m) => m.to === 'stranger@example.com'), 'the sender is not told anything');
  const b = activity(clubName('S-004'), 'Watch: last year\'s secretary', 'old.secretary@example.com');
  assert.equal(b.sender_check, 'An office bearer of the club', 'the 2024-25 Secretary acts until this year\'s is told');
  const s = signIn('asha@example.com');
  const card = env.post({ fn: 'list', session: s }).content.pending.find((c) => c.id === a.id);
  assert.ok(card.lines.some(([k, v]) => k === 'Sender' && /would not be accepted/.test(v)));
  env.run('weeklySummary');
  const summary = env.mails.at(-1).body;
  assert.match(summary, /WHO SENT THE CLUB FORMS \(club_senders_only: watch\)/);
  assert.match(summary, /Not an office bearer of the club on file: 1/);
  assert.match(summary, /An office bearer of the club: 1/);
  set('club_senders_only', 'off');
});

test('on: a stranger is told politely and the form waits as not accepted; office bearers, moderators and unchecked clubs go through', () => {
  set('club_senders_only', 'on');
  let before = env.mails.length;
  const a = activity(clubName('S-004'), 'On: stranger', 'stranger@example.com');
  assert.equal(a.status, 'not_accepted');
  assert.match(a.moderator_note, /^Not accepted: sent from stranger@example.com/);
  const told = env.mails.slice(before);
  assert.equal(told.length, 1, 'only the sender is emailed; no moderator alert');
  assert.equal(told[0].to, 'stranger@example.com');
  assert.match(told[0].subject, /^Not accepted/);
  assert.match(told[0].body, /on record for RC .*: the President and Secretary/);
  assert.doesNotMatch(told[0].body, /Old President|old\.president/, 'office bearers are named by role only');
  assert.ok(!env.run('publicData_').activities.some((x) => x.title === 'On: stranger'));

  before = env.mails.length;
  assert.equal(activity(clubName('S-004'), 'On: president', 'OLD.PRESIDENT@example.com').status, 'pending');
  assert.equal(activity(clubName('S-004'), 'On: moderator', 'asha@example.com').status, 'pending');
  assert.equal(activity(clubName('S-004'), 'On: district account', 'rotarian.neerav@gmail.com').status, 'pending', 'the Sheet\'s owner counts as an Administrator');
  const unchecked = activity(clubName('S-005'), 'On: club with no office bearer email', 'stranger@example.com');
  assert.equal(unchecked.status, 'pending', 'a gap in the records refuses nobody');
  assert.match(unchecked.sender_check, /^Not checked/);

  // the Club updates form is checked the same way, members and roles included
  env.submit('club_updates', { [Q.club]: clubName('S-004'), [Q.name]: 'Rtn Sender', [Q.role]: 'Member', [Q.mobile]: '9876543210', [Q.uKind]: U.member,
    [Q.gChange]: env.context.CLUB_CHANGES.joined, [Q.gMemberId]: '8100009', [Q.rName]: 'Rtn Joiner', [Q.gJoined]: '2026-11-01' }, 'stranger@example.com');
  const change = env.priv.rows('club_change_requests').at(-1);
  assert.equal(change.status, 'not_accepted');
  set('club_senders_only', 'off');
});

test('the desk: Not accepted lists them for the right moderators; Let through sends one to the moderators as usual', () => {
  const asha = signIn('asha@example.com');
  const meera = signIn('meera@example.com');
  const held = env.post({ fn: 'list', session: asha }).held;
  const item = held.find((x) => x.title === 'On: stranger');
  assert.equal(item.from, 'stranger@example.com');
  assert.ok(!held.some((x) => x.tab === 'club_change_requests'), 'club changes are for Members moderators');
  const change = env.post({ fn: 'list', session: meera }).held.find((x) => x.tab === 'club_change_requests');
  assert.ok(change);
  assert.match(env.post({ fn: 'letthrough', session: meera, tab: 'activities', id: item.id }).error, /Only Content moderators/);
  const before = env.mails.length;
  const r = env.post({ fn: 'letthrough', session: asha, tab: 'activities', id: item.id });
  assert.ok(r.ok, r.error);
  const row = env.main.rows('activities').find((x) => x.id === item.id);
  assert.equal(row.status, 'pending');
  assert.doesNotMatch(row.moderator_note, /Not accepted/);
  assert.match(row.sender_check, /let through by Asha Content/);
  assert.ok(env.mails.slice(before).some((m) => m.subject.startsWith('To check:')));
  assert.match(env.post({ fn: 'letthrough', session: asha, tab: 'activities', id: item.id }).message, /Already/);
  assert.ok(env.post({ fn: 'letthrough', session: meera, tab: 'club_change_requests', id: change.id }).ok);
  assert.equal(env.priv.rows('club_change_requests').find((x) => x.id === change.id).status, 'pending');
});

test('the Roles tab shows which office bearers act now and how many clubs still have last year\'s', () => {
  const s = signIn('meera@example.com');
  const list = env.post({ fn: 'list', session: s });
  assert.equal(list.roles.officers.year, YEAR);
  assert.ok(list.roles.officers.carried.includes(label('S-004')));
  const roles = env.post({ fn: 'roles', session: s, q: '8100001' }).roles;
  assert.equal(roles[0].acts, 'carried over');
  officer(YEAR, 'S-004', '8100003', 'Rtn New President', 'President');
  member('8100003', 'Rtn New President', 'S-004', 'new.president@example.com');
  assert.equal(env.post({ fn: 'roles', session: s, q: '8100001' }).roles[0].acts, '', 'replaced once this year\'s is told');
  assert.equal(env.post({ fn: 'roles', session: s, q: '8100003' }).roles[0].acts, 'this year');
  // the new President now speaks for the club, the old one no longer does; the Secretary still carries on
  set('club_senders_only', 'on');
  assert.equal(activity(clubName('S-004'), 'New president', 'new.president@example.com').status, 'pending');
  assert.equal(activity(clubName('S-004'), 'Old president', 'old.president@example.com').status, 'not_accepted');
  assert.equal(activity(clubName('S-004'), 'Old secretary', 'old.secretary@example.com').status, 'pending');
  set('club_senders_only', 'off');
});

/* ---------- The weekly club email (weekly_club_email) ---------- */

test('weekly club email: off sends nothing; test sends the day\'s club emails together to the test address; on emails the office bearers once a week', () => {
  const today = new Date().toISOString().slice(0, 10);
  const wd = new Date(today + 'T00:00:00Z').getUTCDay();
  // a real club whose weekday is today, with an office bearer and an activity approved today
  const club = env.main.rows('clubs').find((c) => core.Core_clubWeekday(c.club_id) === wd && c.club_id !== 'S-004');
  realClub(club.club_id);
  member('8200001', 'Rtn Weekly President', club.club_id, 'weekly.president@example.com');
  officer(LAST, club.club_id, '8200001', 'Rtn Weekly President', 'President');
  const a = activity(club.club_name, 'Weekly: eye camp', 'weekly.president@example.com');
  env.run('approveRow_', 'activities', tab(env.main, 'activities').find((x) => x.id === a.id), 'asha@example.com');

  let before = env.mails.length;
  assert.match(env.run('weeklyClubEmails'), /off/);
  assert.equal(env.mails.length, before);

  set('weekly_club_email', 'test');
  set('weekly_club_email_test_to', 'tester@example.com');
  before = env.mails.length;
  env.run('weeklyClubEmails');
  const test1 = env.mails.slice(before);
  assert.equal(test1.length, 1);
  assert.equal(test1[0].to, 'tester@example.com');
  assert.match(test1[0].body, new RegExp((club.display_name || club.club_name) + ' \\(would go to 1 office bearer\\)'));
  assert.match(test1[0].body, /Weekly: eye camp/);
  assert.doesNotMatch(test1[0].body, /weekly\.president@/, 'the test email does not list the addresses');

  set('weekly_club_email', 'on');
  before = env.mails.length;
  env.run('weeklyClubEmails');
  const sent = env.mails.slice(before);
  assert.equal(sent.length, 1, 'test mode kept its own record, so the real email still goes');
  assert.equal(sent[0].to, 'weekly.president@example.com');
  assert.match(sent[0].subject, /^Your club this week on the district website/);
  assert.match(sent[0].body, /President: Rtn Weekly President \(from 2024-25, until this year's is told\)/);
  before = env.mails.length;
  env.run('weeklyClubEmails');
  assert.equal(env.mails.length, before, 'not twice in a week');

  // short of email allowance: the club waits for tomorrow
  const props = env.props;
  props.set('CLUB_WEEKLY_ON', '{}');
  env.quota.left = 15;
  assert.match(env.run('weeklyClubEmails'), /1 wait for tomorrow/);
  set('weekly_club_email', 'off');
});
