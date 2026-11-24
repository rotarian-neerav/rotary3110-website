// B10 (decision 140, 23 Nov 2026): the alert when the website does not catch up goes to the Administrators and
// summary_emails, and again once a day while the site has not caught up.
// B11 (decision 141, 23 Nov 2026): the club forms no longer ask the sender's name, role and mobile; the name comes
// from the members list by the Verified email, the role from the club's office bearers, and the desk shows the
// mobile the members list holds (option 2a). Rows already sent keep what they gave.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { before, beforeEach, test } from 'node:test';
import { createGoogleEnv } from '../helpers/google-mock.mjs';
import { bundleCode } from '../../tools/bundle-apps-script.mjs';
import { core, plain } from '../../lib/core.mjs';

const ROOT = resolve(import.meta.dirname, '../..');
const YEAR = core.Core_rotaryYearOf(new Date(Date.now() + 5.5 * 3600 * 1000).toISOString().slice(0, 10)); // India time, as the script
const NEXT = core.Core_nextRotaryYear(YEAR);
let env;
let Q;

const tab = (ss, t) => env.run('readTab_', ss, t);
const ids = () => JSON.parse(env.props.get('FORM_IDS'));
const form = (key) => env.forms[ids()[key]];
const titles = (f) => f.items.map((i) => i.title);
const member = (id, name, club, email, mobile) => env.run('appendRow_', env.priv, 'members_master', { member_id: id, name, club_id: club, is_rotarian: true, status: 'active', email, mobile });
const officer = (year, club, id, name, role) => env.run('appendRow_', env.main, 'officers', { rotary_year: year, club_id: club, member_id: id, name, role, contact_ok: false });
const clubName = (id) => env.main.rows('clubs').find((c) => c.club_id === id).club_name;
const signIn = (email) => {
  env.post({ fn: 'code', email });
  const code = env.mails.filter((m) => m.to === email).at(-1).body.match(/\b(\d{6})\b/)[1];
  const r = env.post({ fn: 'signin', email, code });
  assert.ok(r.ok, r.error);
  return r.session;
};
const activity = (title, email, extra = {}) => {
  env.submit('activity', {
    [Q.club]: clubName('S-004'), [Q.kind]: Q.kindActivity, [Q.aTitle]: title, [Q.aDate]: '2026-10-10', [Q.aTheme]: 'Club service / Other',
    [Q.aDesc]: 'Members planted saplings along the canal road.', [Q.aConsent]: ['yes'], ...extra,
  }, email, new Date());
  return env.main.rows('activities').at(-1);
};
let content;

beforeEach(() => { if (env) env.quota.left = 100; });

before(() => {
  env = createGoogleEnv({ sampleJson: readFileSync(resolve(ROOT, 'sample/sample-data.json'), 'utf8') });
  env.load(bundleCode());
  ({ Q } = env.context);
  env.run('setup');
  const sh = env.main.getSheetByName('moderators');
  const types = env.main.rows('moderators').map((r) => r.type);
  [['Content', 'Asha Content', 'asha@example.com'], ['Administrator', 'Anil Admin', 'Anil@Example.com']].forEach(([type, name, email]) => {
    const row = types.indexOf(type) + 2;
    sh.set(row, 2, name); sh.set(row, 3, email); sh.set(row, 4, 'TRUE');
  });
  member('8200001', 'Rtn Priya Sharma', 'S-004', 'priya@example.com', '9811122233');
  member('8200002', 'Rtn Ravi Kumar', 'S-004', 'ravi@example.com', '9822233344');
  member('8200003', 'Rtn Plain Member', 'S-004', 'plain@example.com', '9833344455');
  officer(YEAR, 'S-004', '8200001', 'Rtn Priya Sharma', 'Secretary');
  officer(NEXT, 'S-004', '8200002', 'Rtn Ravi Kumar', 'President');
  content = signIn('asha@example.com');
});

/* ---------- B11: the rule ---------- */

test('the sender from the members list: name by email or second email, role from the office bearers, Elect, Member, or nothing', () => {
  const master = [
    { member_id: '1', name: 'Rtn A', club_id: 'C1', status: 'active', email: 'a@x.in', mobile: '9811111111' },
    { member_id: '2', name: 'Rtn B', club_id: 'C1', status: 'active', email: 'b@x.in', email2: 'B.Home@X.in' },
    { member_id: '3', name: 'Rtn C', club_id: 'C2', status: 'active', email: 'c@x.in' },
    { member_id: '4', name: 'Rtn Gone', club_id: 'C1', status: 'left', email: 'gone@x.in' },
    { member_id: '5', name: 'Rtn Shared C2', club_id: 'C2', status: 'active', email: 'shared@x.in' },
    { member_id: '6', name: 'Rtn Shared C1', club_id: 'C1', status: 'active', email: 'shared@x.in' },
  ];
  const acting = { C1: { Secretary: { member_id: '1' }, President: { member_id: '1' } } };
  const coming = { C1: { President: { member_id: '2' } } };
  const who = (e, club = 'C1') => core.Core_formSender(e, club, master, acting, coming);
  assert.deepEqual(plain(who(' A@X.in ')), { name: 'Rtn A', role: 'President, Secretary', member_id: '1', mobile: '919811111111' });
  assert.deepEqual([who('b.home@x.in').name, who('b.home@x.in').role], ['Rtn B', 'President Elect'], 'the second email counts; next year\'s role');
  assert.equal(who('c@x.in').role, '', 'a member of another club: the name, no role');
  assert.equal(who('c@x.in').name, 'Rtn C');
  assert.equal(who('c@x.in', 'C2').role, 'Member');
  assert.equal(who('gone@x.in').name, '', 'only active members');
  assert.equal(who('stranger@x.in').name, '');
  assert.equal(who('').name, '');
  assert.equal(who('shared@x.in').name, 'Rtn Shared C1', 'an email two members share: the one in that club');
});

/* ---------- B11: the forms ---------- */

test('the activity and Club updates forms ask only the club; Upgrade Sheet takes the three questions off live forms', () => {
  for (const key of ['activity', 'club_updates']) {
    const t = titles(form(key));
    for (const q of [Q.name, Q.role, Q.mobile]) assert.ok(!t.includes(q), `${key}: ${q}`);
    assert.equal(t[0], Q.club);
  }
  // a live form made before B11 still has them
  const f = form('activity');
  for (const q of [Q.mobile, Q.role, Q.name]) { f.add('TEXT').setTitle(q); f.items.splice(1, 0, f.items.pop()); }
  assert.deepEqual(titles(f).slice(0, 4), [Q.club, Q.name, Q.role, Q.mobile]);
  env.run('upgradeSheet');
  assert.deepEqual(titles(f).slice(0, 2), [Q.club, Q.kind]);
  // Google refuses: the rest of the upgrade goes on and the owner is told
  f.add('TEXT').setTitle(Q.name);
  f.refuse = 'delete';
  const r = [];
  env.run('dropSenderQuestions_', r);
  assert.match(r.join('\n'), /could not remove .*delete them by hand/);
  f.refuse = null;
  env.run('dropSenderQuestions_', []);
  assert.ok(!titles(f).includes(Q.name));
});

/* ---------- B11: filing and the desk ---------- */

test('a form is filed with the sender from the members list; the desk shows their name, role and the list\'s mobile', () => {
  const row = activity('Saplings on the canal road', 'Priya@Example.com');
  assert.deepEqual([row.submitter_name, row.submitter_role, String(row.submitter_mobile)], ['Rtn Priya Sharma', 'Secretary', ''],
    'the mobile is not copied into the main Sheet');
  const card = env.post({ fn: 'list', session: content }).content.pending.find((c) => c.id === row.id);
  assert.equal(card.sender, 'Rtn Priya Sharma, Secretary');
  assert.equal(card.sender_mobile, '919811122233', 'the members list\'s mobile, shown only on the desk');

  const elect = activity('Blood donation camp', 'ravi@example.com');
  assert.equal(elect.submitter_role, 'President Elect');
  assert.equal(activity('Tree plantation', 'plain@example.com').submitter_role, 'Member');

  const stranger = activity('Eye camp', 'stranger@example.com');
  assert.equal(stranger.submitter_name, '');
  const c2 = env.post({ fn: 'list', session: content }).content.pending.find((c) => c.id === stranger.id);
  assert.equal(c2.sender, 'stranger@example.com', 'not in the members list: the desk shows the email');
  assert.equal(c2.sender_mobile, '');
});

test('a row from an older form keeps what was typed where the members list has nothing; the list wins otherwise', () => {
  const typed = { [Q.name]: 'Rtn Typed Name', [Q.role]: 'Secretary', [Q.mobile]: '98765 43210' };
  const old = activity('Old form, stranger', 'someone@example.com', typed);
  assert.deepEqual([old.submitter_name, old.submitter_role, String(old.submitter_mobile)], ['Rtn Typed Name', 'Secretary', '98765 43210']);
  const known = activity('Old form, member', 'priya@example.com', typed);
  assert.equal(known.submitter_name, 'Rtn Priya Sharma');
});

test('the club change form carries the sender too, and the decision email says Dear with the members-list name', () => {
  assert.ok(env.run('headers_', env.priv, 'club_change_requests').includes('submitter_name'));
  const row = activity('Health check-up', 'priya@example.com');
  const n = env.mails.length;
  env.run('notifySubmitter_', 'activities', tab(env.main, 'activities').find((r) => r.id === row.id), true);
  assert.match(env.mails.at(-1).body, /^Dear Rtn Priya Sharma,\n\nThank you!/);
  assert.equal(env.mails.length, n + 1);
});

/* ---------- B10: the alert ---------- */

test('the website not catching up: the Administrators and summary_emails are told, again once a day until it catches up', () => {
  env.run('setSetting_', 'summary_emails', 'owner@example.com, anil@example.com');
  env.run('setSetting_', 'rebuild_requested_at', '');
  env.run('setSetting_', 'content_changed_at', new Date(Date.now() - 14 * 3600000).toISOString());
  env.pages.buildInfo = { generated_at: new Date(Date.now() - 20 * 3600000).toISOString() };
  env.props.delete('REBUILD_ALERTED');
  const n = env.mails.length;
  assert.match(env.run('checkRebuild'), /^told /);
  const mail = env.mails.at(-1);
  assert.deepEqual(mail.to.split(',').sort(), ['anil@example.com', 'owner@example.com'], 'Administrators and summary_emails, each once');
  assert.match(mail.body, /once a day until the website catches up/);
  assert.equal(env.run('checkRebuild'), 'already told');
  // a day later, still not built: told again
  const [asked, at, built] = env.props.get('REBUILD_ALERTED').split('|');
  env.props.set('REBUILD_ALERTED', [asked, Number(at) - 24 * 3600000, built].join('|'));
  assert.match(env.run('checkRebuild'), /^told /);
  assert.equal(env.mails.length, n + 2);
  // a build ran but missed a newer change: told at once, not a day later
  env.pages.buildInfo = { generated_at: new Date(Date.now() - 15 * 3600000).toISOString() };
  assert.match(env.run('checkRebuild'), /^told /);
  // caught up: quiet
  env.pages.buildInfo = { generated_at: new Date().toISOString() };
  assert.equal(env.run('checkRebuild'), 'built');
  assert.equal(env.mails.length, n + 3);
});

test('no Administrator named and no summary_emails: the district account is told', () => {
  const sh = env.main.getSheetByName('moderators');
  const row = env.main.rows('moderators').findIndex((r) => r.type === 'Administrator') + 2;
  sh.set(row, 4, 'FALSE');
  env.run('setSetting_', 'summary_emails', '');
  env.pages.buildInfo = { generated_at: new Date(Date.now() - 20 * 3600000).toISOString() };
  env.props.delete('REBUILD_ALERTED');
  assert.match(env.run('checkRebuild'), /^told /);
  assert.ok(!/anil@/.test(env.mails.at(-1).to), 'an inactive Administrator is not told');
  sh.set(row, 4, 'TRUE');
});
