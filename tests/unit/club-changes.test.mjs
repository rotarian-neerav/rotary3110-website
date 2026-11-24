// The club changes form (C29, C30; 17 Nov 2026): anyone tells the district that a member joined, left, moved or passed
// away, or holds a club or district role. Nothing changes until a Members moderator approves on the desk (or the
// Sheet's sidebar); approving updates the members list, club history or role tabs, and tells the sender.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { before, beforeEach, test } from 'node:test';
import { createGoogleEnv } from '../helpers/google-mock.mjs';
import { core } from '../../lib/core.mjs';
import { routeOldForms } from '../helpers/forms.mjs';
import { bundleCode } from '../../tools/bundle-apps-script.mjs';

const ROOT = resolve(import.meta.dirname, '../..');
let env;
const Q = {};
let C = {};

beforeEach(() => { if (env) env.quota.left = 100; });

before(() => {
  env = createGoogleEnv({ sampleJson: readFileSync(resolve(ROOT, 'sample/sample-data.json'), 'utf8') });
  env.load(bundleCode());
  routeOldForms(env); // the old forms' submissions go through the two forms with sections (Release 2)
  Object.assign(Q, env.context.Q);
  C = env.context.CLUB_CHANGES;
  env.run('setup');
  // a Members moderator and a Content moderator over the placeholders
  const sh = env.main.getSheetByName('moderators');
  const types = env.main.rows('moderators').map((r) => r.type);
  [['Members', 'Meera Members', 'meera@example.com'], ['Content', 'Asha Content', 'asha@example.com']].forEach(([type, name, email]) => {
    const row = types.indexOf(type) + 2;
    sh.set(row, 2, name); sh.set(row, 3, email); sh.set(row, 4, 'TRUE');
  });
});

const signIn = (email) => {
  env.post({ fn: 'code', email });
  const code = env.mails.filter((m) => m.to === email).at(-1).body.match(/\b(\d{6})\b/)[1];
  const r = env.post({ fn: 'signin', email, code });
  assert.ok(r.ok, r.error);
  return r.session;
};
const clubs = () => env.main.rows('clubs').filter((c) => c.status !== 'inactive');
const member = (id) => env.priv.rows('members_master').find((m) => String(m.member_id) === String(id));
const history = (id) => env.priv.rows('club_history').filter((h) => String(h.member_id) === String(id));
const last = () => env.priv.rows('club_change_requests').at(-1);
const send = (change, extra = {}, email = 'secretary@example.com') => {
  env.submit('club_change', { [Q.cClub]: clubs()[0].club_name, [Q.gChange]: C[change], ...extra }, email);
  return last();
};
const approve = (s, id) => env.post({ fn: 'member', session: s, kind: 'change', action: 'approve', id });

test("the form: the Club updates form's members section (Release 2): the member and the change, one page per kind of change; answers go to the private Sheet", () => {
  const ids = JSON.parse(env.props.get('FORM_IDS'));
  const form = env.forms[ids.club_updates];
  assert.equal(form.title, 'Club updates – Rotary District 3110');
  const titles = form.items.map((i) => i.title);
  const at = titles.indexOf(Q.gMemberId);
  assert.deepEqual(titles.slice(at, at + 3), [Q.gMemberId, Q.rName, Q.gChange]);
  for (const k of ['joined', 'left', 'deceased', 'club_role', 'district_role']) assert.ok(titles.includes(C[k]), C[k] + ' page');
  // a move is the old club's "left" and the new club's "joined" (owner, 23 Nov 2026)
  assert.ok(!titles.includes(C.moved) && !titles.includes(Q.gNewClub) && !titles.includes(Q.gMoved), 'no "moved" page');
  assert.equal(titles[titles.indexOf(Q.gNote) - 1], 'Anything else');
  // a new member's own mobile and email, asked only on the "joined" page (Release 2)
  assert.deepEqual(titles.slice(titles.indexOf(Q.gJoined), titles.indexOf(Q.gJoined) + 3), [Q.gJoined, Q.gMobile, Q.gEmail]);
  assert.ok(env.priv.getSheetByName('raw_club_updates_form'));
  const years = form.items.find((i) => i.title === Q.gClubYear).choices;
  // the years around today's date, not the year the website shows (Release 1)
  const year = env.run('Core_rotaryYearOf', new Date(Date.now() + 5.5 * 3600 * 1000).toISOString().slice(0, 10)); // India time, as the script
  assert.deepEqual([...years], [year, env.run('Core_nextRotaryYear', year)]);
  assert.deepEqual([...form.items.find((i) => i.title === Q.gClubRole).choices], ['President', 'Secretary', 'Executive Secretary']);
  assert.ok(form.items.find((i) => i.title === Q.gTeam).choices.length > 3, 'the district teams from the functionaries tab');
});

test('a member joined: kept as pending, the Members moderator is told the name only; approving on the desk adds them with their club history', () => {
  const before = env.mails.length;
  const req = send('joined', { [Q.gMemberId]: '7700001', [Q.rName]: 'Rtn New Joiner', [Q.gJoined]: '2026-11-01', [Q.gNote]: 'Inducted at the last meeting' });
  assert.equal(req.status, 'pending');
  assert.equal(req.change, 'joined');
  assert.equal(String(req.member_id), '7700001');
  assert.equal(String(req.club_id), String(clubs()[0].club_id));
  assert.equal(member('7700001'), undefined, 'nothing changes before approval');
  const alert = env.mails.slice(before).find((m) => m.to === 'meera@example.com');
  assert.equal(alert.subject, 'Club change to check: Rtn New Joiner – ' + clubs()[0].club_name);
  assert.ok(!alert.body.includes('7700001'), 'no member ID in the email');
  assert.ok(!env.mails.slice(before).some((m) => m.to === 'asha@example.com'), 'Content moderators are not told');

  const s = signIn('meera@example.com');
  const card = env.post({ fn: 'list', session: s }).members.change.find((c) => c.id === req.id);
  assert.equal(card.change, C.joined);
  assert.equal(card.now, 'Not in the members list');
  assert.deepEqual(card.lines[0], ['Rotary member ID', '7700001']);
  assert.equal(card.note, 'Inducted at the last meeting');

  const r = approve(s, req.id);
  assert.ok(r.ok, r.error);
  assert.match(r.message, /Rtn New Joiner is added to the members list/);
  const m = member('7700001');
  assert.equal(m.status, 'active');
  assert.equal(String(m.club_id), String(clubs()[0].club_id));
  assert.equal(history('7700001')[0].from_date, '2026-11-01');
  const done = env.priv.rows('club_change_requests').find((x) => x.id === req.id);
  assert.equal(done.status, 'approved');
  assert.equal(done.approved_by, 'meera@example.com');
  assert.equal(env.mails.at(-1).to, 'secretary@example.com');
  assert.match(env.mails.at(-1).subject, /^Approved: A member joined the club – Rtn New Joiner/);
  assert.ok(env.main.rows('settings').find((x) => x.key === 'content_changed_at').value, 'the next of the four daily updates takes it');
  assert.ok(env.main.rows('moderator_log').some((l) => l.item === req.id && l.tab === 'club_change_requests' && l.action === 'approve'));

  // the same person again for the same club: refused, and the request stays for a reason to be given
  const again = send('joined', { [Q.gMemberId]: '7700001', [Q.rName]: 'Rtn New Joiner', [Q.gJoined]: '2026-11-02' });
  assert.match(approve(s, again.id).error, /already an active member of this club/);
  assert.equal(last().status, 'pending');
  assert.match(env.post({ fn: 'member', session: s, kind: 'change', action: 'reject', id: again.id }).error, /Please write a reason/);
  const before2 = env.mails.length;
  assert.ok(env.post({ fn: 'member', session: s, kind: 'change', action: 'reject', id: again.id, reason: 'Already recorded' }).ok);
  assert.equal(last().status, 'rejected');
  assert.match(env.mails.slice(before2).at(-1).body, /Reason: Already recorded/);
});

test('moved, moved out of the district, left and passed away', () => {
  const s = signIn('meera@example.com');
  const [a, b] = clubs();
  env.run('appendRow_', env.priv, 'members_master', { member_id: '7700010', name: 'Rtn Mover One', club_id: a.club_id, is_rotarian: true, status: 'active' });
  env.run('appendRow_', env.priv, 'club_history', { member_id: '7700010', club_id: a.club_id, from_date: '2020-07-01' });

  // within the district: the old club's history ends, the new one starts, the club changes
  let req = send('moved', { [Q.gMemberId]: '7700010', [Q.rName]: 'Rtn Mover One', [Q.gNewClub]: b.club_name, [Q.gMoved]: '2026-10-15' });
  assert.equal(String(req.new_club_id), String(b.club_id));
  const card = env.post({ fn: 'list', session: s }).members.change.find((c) => c.id === req.id);
  assert.equal(card.now, 'Members list: Rtn Mover One, ' + a.club_name + ', active');
  assert.ok(approve(s, req.id).ok);
  assert.equal(String(member('7700010').club_id), String(b.club_id));
  const h = history('7700010');
  assert.equal(h[0].to_date, '2026-10-15');
  assert.equal(String(h[1].club_id), String(b.club_id));
  assert.equal(h[1].from_date, '2026-10-15');

  // to a club outside the district: marked as left
  req = send('moved', { [Q.gMemberId]: '7700010', [Q.rName]: 'Rtn Mover One', [Q.gNewClub]: 'A club outside District 3110', [Q.gMoved]: '2026-11-10' });
  assert.equal(req.new_club_id, 'outside');
  assert.match(req.moderator_note, /outside District 3110: approving marks the member as left/);
  assert.ok(approve(s, req.id).ok);
  assert.equal(member('7700010').status, 'left');
  assert.equal(history('7700010')[1].to_date, '2026-11-10');

  // left
  env.run('appendRow_', env.priv, 'members_master', { member_id: '7700011', name: 'Rtn Leaver', club_id: a.club_id, is_rotarian: true, status: 'active' });
  req = send('left', { [Q.gMemberId]: '7700011', [Q.rName]: 'Rtn Leaver', [Q.gLeft]: '2026-09-30' });
  assert.ok(approve(s, req.id).ok);
  assert.equal(member('7700011').status, 'left');

  // passed away: through Mark as deceased
  env.run('appendRow_', env.priv, 'members_master', { member_id: '7700012', name: 'Rtn Remembered', club_id: a.club_id, is_rotarian: true, status: 'active' });
  req = send('deceased', { [Q.gMemberId]: '7700012', [Q.rName]: 'Rtn Remembered' });
  assert.match(approve(s, req.id).error, /confirm with the club/, 'the moderator confirms a death with the club first (Release 1)');
  assert.equal(member('7700012').status, 'active');
  assert.match(env.post({ fn: 'member', session: s, kind: 'change', action: 'approve', id: req.id, confirmed: true }).message, /is marked as deceased/);
  assert.equal(member('7700012').status, 'deceased');

  // someone not in the members list cannot be marked as left
  req = send('left', { [Q.gMemberId]: '7799999', [Q.rName]: 'Rtn Unknown', [Q.gLeft]: '2026-09-30' });
  assert.match(approve(s, req.id).error, /No one with member ID 7799999/);
  assert.equal(last().status, 'pending');
  env.post({ fn: 'member', session: s, kind: 'change', action: 'reject', id: req.id, reason: 'Wrong ID' });
});

test('roles: a club role adds an officers row, a district role a functionaries row on its team\'s page; the cards follow', () => {
  const s = signIn('meera@example.com');
  const club = clubs()[1];
  env.run('appendRow_', env.priv, 'members_master', { member_id: '7700020', name: 'Rtn Role Holder', club_id: club.club_id, is_rotarian: true, status: 'active' });
  const year = core.Core_rotaryYearOf(core.Core_isoDate(new Date()));

  let req = send('club_role', { [Q.cClub]: club.club_name, [Q.gMemberId]: '7700020', [Q.rName]: 'Role Holder', [Q.gClubYear]: year, [Q.gClubRole]: 'Secretary' });
  assert.equal(req.rotary_year, year);
  assert.equal(req.role, 'Secretary');
  assert.ok(approve(s, req.id).ok);
  const off = env.main.rows('officers').at(-1);
  assert.deepEqual([off.rotary_year, String(off.club_id), String(off.member_id), off.name, off.role], [year, String(club.club_id), '7700020', 'Rtn Role Holder', 'Secretary'],
    'the name as the members list has it');

  const team = env.main.rows('functionaries').find((f) => f.page === 'teams' && f.rotary_year === year) || env.main.rows('functionaries').find((f) => f.page === 'teams');
  const inTeam = env.main.rows('functionaries').filter((f) => f.section === team.section && f.rotary_year === year);
  req = send('district_role', { [Q.cClub]: clubs()[0].club_name, [Q.gMemberId]: '7700020', [Q.rName]: 'Rtn Role Holder', [Q.gDistYear]: year,
    [Q.gTeam]: team.section, [Q.gCommittee]: 'A Committee', [Q.gRole]: 'Co-chairman', [Q.gNote]: "Governor's letter of 10 Nov" });
  assert.equal(req.section, team.section);
  assert.ok(approve(s, req.id).ok);
  const f = env.main.rows('functionaries').at(-1);
  assert.equal(f.page, 'teams');
  assert.equal(f.section, team.section);
  assert.equal(f.committee, 'A Committee');
  assert.equal(f.role, 'Co-chairman');
  assert.equal(String(f.club_id), String(club.club_id), "the member's own club");
  assert.equal(Number(f.sort_order), Math.max(0, ...inTeam.map((x) => Number(x.sort_order) || 0)) + 1, 'after the team\'s other rows');
  assert.ok(!env.main.rows('role_checks').some((p) => String(p.member_id) === '7700020'), 'the role check finds nothing wrong with the new rows');

  // a district role for someone not in the members list is still added, by name, and the moderator is told
  req = send('district_role', { [Q.gMemberId]: '7700021', [Q.rName]: 'Rtn Not Listed', [Q.gDistYear]: year, [Q.gTeam]: team.section, [Q.gRole]: 'Member' });
  assert.match(approve(s, req.id).message, /Not in the members list, so there is no member card/);
  assert.equal(env.main.rows('functionaries').at(-1).name, 'Rtn Not Listed');
  assert.ok(env.main.rows('role_checks').some((p) => String(p.member_id) === '7700021'), 'and the role check lists it');
});

test('only Members moderators act on club changes; the sidebar works the same; practice rows change nothing', () => {
  const req = send('left', { [Q.gMemberId]: '7700030', [Q.rName]: 'Rtn Sidebar' });
  assert.match(approve(signIn('asha@example.com'), req.id).error, /Only Members moderators/);
  assert.ok(env.run('getMemberRequests').change.some((c) => c.id === req.id));
  env.run('rejectRequest', 'change', req.id, 'Not a member');
  assert.equal(last().status, 'rejected');

  env.run('appendRow_', env.priv, 'club_change_requests', { id: 'PRAC-CHG-1', change: 'joined', member_id: '7700031', name: 'Practice', club_id: clubs()[0].club_id, status: 'pending', is_sample: true });
  assert.match(env.run('approveClubChange', 'PRAC-CHG-1'), /Practice: approved. Nothing was changed/);
  assert.equal(member('7700031'), undefined);
});

test('reminders after 48 hours and the weekly summary count club changes; a phone number in the note is flagged', () => {
  env.submit('club_change', { [Q.cClub]: clubs()[0].club_name, [Q.gChange]: C.left, [Q.gMemberId]: '7700040', [Q.rName]: 'Rtn Waiting',
    [Q.gNote]: 'Call me on 9876543210' }, 'secretary@example.com', new Date(Date.now() - 50 * 3600000));
  const req = last();
  assert.match(req.moderator_note, /phone number or email/);
  const before = env.mails.length;
  env.run('sendReminders_');
  assert.ok(env.mails.slice(before).some((m) => m.to.includes('meera@example.com') && m.body.includes('club_change_requests: ' + req.id)));
  env.run('rejectRequest', 'change', req.id, 'Test over');
});

test('Update form lists keeps the team and year lists current', () => {
  const ids = JSON.parse(env.props.get('FORM_IDS'));
  const form = env.forms[ids.club_updates];
  form.items.find((i) => i.title === Q.gTeam).choices = ['old'];
  env.run('updateFormLists', true);
  assert.ok(form.items.find((i) => i.title === Q.gTeam).choices.length > 3);
  // a district role up to three years ahead (the Governor Nominee and Nominee Designate); a club role this year or next
  const year = core.Core_rotaryYearOf(core.Core_isoDate(new Date()));
  const ahead = (n) => (n ? core.Core_nextRotaryYear(ahead(n - 1)) : year);
  assert.deepEqual([...form.items.find((i) => i.title === Q.gDistYear).choices], [0, 1, 2, 3].map(ahead));
  assert.deepEqual([...form.items.find((i) => i.title === Q.gClubYear).choices], [0, 1].map(ahead));
});

test('a Governor three years ahead, added through Club updates, goes in as District Governor of that year', () => {
  const s = signIn('meera@example.com');
  env.run('appendRow_', env.priv, 'members_master', { member_id: '7700060', name: 'Rtn Coming Governor', club_id: clubs()[0].club_id, is_rotarian: true, status: 'active' });
  const year = core.Core_nextRotaryYear(core.Core_nextRotaryYear(core.Core_nextRotaryYear(core.Core_rotaryYearOf(core.Core_isoDate(new Date())))));
  const req = send('district_role', { [Q.cClub]: clubs()[0].club_name, [Q.gMemberId]: '7700060', [Q.rName]: 'Rtn Coming Governor', [Q.gDistYear]: year,
    [Q.gTeam]: 'Governor line', [Q.gRole]: 'District Governor', [Q.gNote]: 'Announced by RI' });
  assert.ok(approve(s, req.id).ok);
  const row = env.main.rows('functionaries').at(-1);
  assert.deepEqual([row.rotary_year, row.section, row.role, row.page], [year, 'Governor line', 'District Governor', 'leadership']);
  const d = env.run('publicData_');
  assert.ok(d.functionaries.some((f) => f.name === 'Rtn Coming Governor' && core.Core_heldYear(f) === year), 'on the website as the Nominee Designate');
});
