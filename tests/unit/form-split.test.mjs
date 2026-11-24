// My details split (owner, 23 Nov 2026): Show my details (List / Do not list) and Update my details (the details).
// A member's own form is found only by the Google account it comes from, their email or second email; one filled in by
// the club's President, Secretary or Executive Secretary only by the Rotary member ID. A Rotary ID never changes, no form
// makes a member, every email is one member's, a move is the old club's "left" and the new club's "joined", and an
// office bearer counts only for the club they are in now.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { before, beforeEach, test } from 'node:test';
import { createGoogleEnv } from '../helpers/google-mock.mjs';
import { bundleCode } from '../../tools/bundle-apps-script.mjs';
import { core } from '../../lib/core.mjs';

const ROOT = resolve(import.meta.dirname, '../..');
let env;
let token;
let Q;
const MEMBER = 'The member';
const CLUB = 'Club President, Secretary or Executive Secretary for the member';

beforeEach(() => { if (env) env.quota.left = 100; });

before(() => {
  env = createGoogleEnv({ sampleJson: readFileSync(resolve(ROOT, 'sample/sample-data.json'), 'utf8') });
  env.load(bundleCode());
  Q = env.context.Q;
  env.run('setup');
  token = env.props.get('DATA_TOKEN');
  const sh = env.main.getSheetByName('moderators');
  const head = env.run('headers_', env.main, 'moderators');
  sh.set(4, head.indexOf('email') + 1, 'meera@example.com');
});

const data = () => { const r = env.doGet({ mode: 'data', token }); assert.ok(r.ok, r.error); return r.data; };
const add = (id, extra = {}) => {
  env.run('appendRow_', env.priv, 'members_master', { member_id: id, name: 'Rtn Member ' + id, club_id: 'S-004', is_rotarian: true, status: 'active', ...extra });
  return env.priv.rows('members_master').find((m) => m.member_id === id);
};
const member = (id) => env.priv.rows('members_master').find((m) => m.member_id === id);
const grid = (listed) => Object.keys(env.context.SHOW_ITEMS).map((k) => (listed.includes(k) ? 'List' : 'Do not list'));
const show = (listed, over = {}) => ({ [Q.cFilledBy]: MEMBER, [Q.showGrid]: grid(listed), [Q.cDeclaration]: ['yes'], ...over });
const update = (over = {}) => ({ [Q.cFilledBy]: MEMBER, [Q.uBusiness]: env.context.BUSINESS_CHOICES.none, [Q.cDeclaration]: ['yes'], ...over });
const lastRequest = () => env.priv.rows('consent_requests').at(-1);
const send = (key, answers, email) => env.submit(key, answers, email, new Date());

test('Core: a member\'s own form by their email or second email, only when exactly one member has it; the club\'s by Rotary ID only', () => {
  const master = [{ member_id: '1', name: 'Rtn Asha Verma', email: 'Asha@x.com' }, { member_id: '2', name: 'Rtn Ravi Gupta', email: 'ravi@x.com', email2: 'ravi.new@x.com' },
    { member_id: '3', name: 'Rtn Couple One', email: 'home@x.com' }, { member_id: '4', name: 'Rtn Couple Two', email: 'other@x.com', email2: 'HOME@x.com' }];
  const own = (email, extra = {}) => core.Core_matchMember({ form: 'show', filled_by: MEMBER, submitter_email: email, ...extra }, master);
  assert.equal(own('asha@x.com'), 0);
  assert.equal(own('RAVI.NEW@x.com'), 1, 'the second email finds the member too');
  assert.equal(own('ravi@x.com', { member_id: '1', name: 'Rtn Asha Verma' }), 1, 'a typed ID or name never decides a member\'s own form');
  assert.equal(own('home@x.com'), -1, 'an email on two members finds nobody');
  assert.equal(core.Core_findByEmail('home@x.com', master).count, 2);
  assert.equal(own('nobody@x.com'), -1);
  const club = (id, email = 'asha@x.com') => core.Core_matchMember({ form: 'update', filled_by: CLUB, member_id: id, submitter_email: email }, master);
  assert.equal(club('2'), 1);
  assert.equal(club(''), -1, 'the club gives the Rotary ID, or nobody is found');
  assert.equal(club('9'), -1);
  assert.deepEqual(core.Core_emailOwners('ravi.new@x.com', master, '1').map((m) => m.member_id), ['2']);
  assert.deepEqual(core.Core_emailOwners('ravi.new@x.com', master, '2'), [], "a member's own email is not someone else's");
  assert.deepEqual([...core.Core_memberEmails(master[1])], ['ravi@x.com', 'ravi.new@x.com']);
  assert.ok(core.Core_filledByClub(CLUB) && core.Core_filledByClub('Club secretary for the member') && !core.Core_filledByClub(MEMBER));
});

test('an email two members share finds nobody: the form is not applied and the sender is told why', () => {
  add('7810001', { email: 'family@example.com' });
  add('7810002', { email: 'family@example.com' });
  const n = env.mails.length;
  send('show_details', show(['directory']), 'family@example.com');
  assert.deepEqual([lastRequest().status, lastRequest().moderator_note], ['not_matched', 'This email belongs to more than one member: not applied']);
  const told = env.mails.slice(n);
  assert.deepEqual(told.map((m) => m.to), ['family@example.com']);
  assert.match(told[0].body, /belongs to more than one member/);
  assert.equal(member('7810001').listing_approved, '', 'nothing applied');
});

test('the second email: the club gives it, a moderator approves, and the member can then use the forms from it; one in use is not saved', () => {
  add('7820001', { name: 'Rtn Old Email', email: 'old.address@example.com' });
  add('7820002', { name: 'Rtn Someone', email: 'taken@example.com' });
  send('show_details', show(['directory']), 'new.address@example.com');
  assert.equal(lastRequest().status, 'not_matched', 'not yet known');

  send('update_details', update({ [Q.cFilledBy]: CLUB, [Q.gMemberId]: '7820001', [Q.rName]: 'Rtn Old Email', [Q.uEmail2]: 'New.Address@example.com' }), 'secretary@example.com');
  const req = lastRequest();
  assert.equal(req.status, 'pending');
  const n = env.mails.length;
  assert.match(env.run('approveConsent', req.id, true), /^Approved/);
  assert.equal(member('7820001').email2, 'new.address@example.com');
  assert.deepEqual(env.mails.slice(n).map((m) => m.to).sort(), ['new.address@example.com', 'old.address@example.com', 'secretary@example.com']);

  send('show_details', show(['directory']), 'new.address@example.com');
  assert.deepEqual([lastRequest().status, lastRequest().matched_member_id], ['approved', '7820001'], 'found by the second email');

  // the member changes the second email themselves: the old second email hears too
  const m = env.mails.length;
  send('update_details', update({ [Q.uEmail2]: 'newer@example.com' }), 'old.address@example.com');
  assert.equal(member('7820001').email2, 'newer@example.com');
  assert.deepEqual(env.mails.slice(m).map((x) => x.to).sort(), ['new.address@example.com', 'newer@example.com', 'old.address@example.com']);

  // an email another member uses is never saved
  send('update_details', update({ [Q.uEmail2]: 'taken@example.com', [Q.cProfession]: 'Lawyer' }), 'old.address@example.com');
  assert.equal(member('7820001').email2, 'newer@example.com');
  assert.equal(member('7820001').profession, 'Lawyer', 'the rest is applied');
  assert.match(lastRequest().moderator_note, /Second email not saved: taken@example\.com is already used by member 7820002/);
});

test('Call and WhatsApp: separate choices and numbers; the RI mobile when no number was given; never a printed number', () => {
  add('7830001', { name: 'Rtn Buttons', email: 'buttons@example.com', mobile: '9811100031' });
  send('show_details', show(['directory', 'call']), 'buttons@example.com');
  let pub = data().members.find((m) => m.name === 'Rtn Buttons');
  assert.deepEqual([pub.call_ok, pub.call_link, pub.contact_link], [true, 'https://wa.me/919811100031', ''], 'Call only, on the RI mobile');
  send('update_details', update({ [Q.uCall]: '98111 00032', [Q.uWhatsapp]: '9811100033', [Q.cProfession]: 'Architect' }), 'buttons@example.com');
  send('show_details', show(['directory', 'call', 'whatsapp']), 'buttons@example.com');
  pub = data().members.find((m) => m.name === 'Rtn Buttons');
  assert.deepEqual([pub.call_link, pub.contact_link], ['https://wa.me/919811100032', 'https://wa.me/919811100033']);
  assert.equal(pub.profession, '', 'the profession lines are their own choice');
  assert.deepEqual([...core.Core_validatePublic(data())], []);
  // a member who chose before 23 Nov keeps both buttons from the one WhatsApp choice
  assert.ok(core.Core_memberShows({ directory_ok: true, contact_ok: true, mobile: '9811100034' }).call);
  assert.ok(core.Core_memberShows({ directory_ok: true, contact_ok: true, mobile: '9811100034' }).profession);
  assert.match(core.Core_validatePublic({ members: [{ name: 'X', directory_ok: true, call_link: 'https://wa.me/919811100034' }] })[0], /call link without consent/);
});

test('a move: "joined" waits while the member is still in another club; "left" only from the club they are in; a used email is not saved', () => {
  const C = env.context.CLUB_CHANGES;
  const s = (() => {
    const r = env.post({ fn: 'code', email: 'meera@example.com' });
    assert.ok(r.ok, r.error);
    const code = env.mails.at(-1).body.match(/\b(\d{6})\b/)[1];
    return env.post({ fn: 'signin', email: 'meera@example.com', code }).session;
  })();
  const approve = (id) => env.post({ fn: 'member', session: s, kind: 'change', action: 'approve', id });
  const change = (club, kind, extra) => {
    env.submit('club_updates', { [Q.club]: club, [Q.name]: 'Rtn Sec', [Q.role]: 'Secretary', [Q.mobile]: '9811100009', [Q.uKind]: env.context.CLUB_UPDATE_KINDS.member,
      [Q.gChange]: C[kind], ...extra }, 'secretary@example.com', new Date());
    return env.priv.rows('club_change_requests').at(-1);
  };
  add('7840001', { name: 'Rtn Mover', club_id: 'S-004', email: 'mover@example.com' });
  add('7840002', { name: 'Rtn Has Email', club_id: 'S-004', email: 'used@example.com' });
  const newClub = env.main.rows('clubs').find((c) => c.club_id === 'S-029').club_name;
  const oldClub = env.main.rows('clubs').find((c) => c.club_id === 'S-004').club_name;

  const joined = change(newClub, 'joined', { [Q.gMemberId]: '7840001', [Q.rName]: 'Rtn Mover', [Q.gJoined]: '2026-11-20' });
  assert.match(joined.moderator_note, new RegExp('Still a member of ' + oldClub + ': approve after that club\'s "left"'));
  assert.match(approve(joined.id).error, /is still a member of .*Approve this after that club's "left"/);
  const wrong = change(newClub, 'left', { [Q.gMemberId]: '7840001', [Q.rName]: 'Rtn Mover', [Q.gLeft]: '2026-11-19' });
  assert.match(wrong.moderator_note, /Recorded in .*, not this club: reject/);
  assert.match(approve(wrong.id).error, /not this club; nothing to do/);
  const left = change(oldClub, 'left', { [Q.gMemberId]: '7840001', [Q.rName]: 'Rtn Mover', [Q.gLeft]: '2026-11-19' });
  assert.ok(approve(left.id).ok);
  assert.ok(approve(joined.id).ok, 'after the old club\'s "left"');
  assert.deepEqual([member('7840001').club_id, member('7840001').status], ['S-029', 'active']);
  assert.match(approve(change(oldClub, 'left', { [Q.gMemberId]: '7840001', [Q.rName]: 'Rtn Mover', [Q.gLeft]: '2026-11-21' }).id).error, /not this club/,
    'a late "left" from the old club does not take them out of the new one');

  const fresh = change(newClub, 'joined', { [Q.gMemberId]: '7840003', [Q.rName]: 'Rtn New Joiner', [Q.gJoined]: '2026-11-20', [Q.gEmail]: 'USED@example.com' });
  assert.match(fresh.moderator_note, /The email is already used by member 7840002 .*: it will not be saved/);
  const ok = approve(fresh.id);
  assert.match(ok.message, /The email was not saved: member 7840002 already uses it/);
  assert.equal(member('7840003').email, '');
});

test('an office bearer counts only for the club they are in now: after a move, the old club has nobody acting in that role', () => {
  const year = env.run('Core_rotaryYearOf', new Date(Date.now() + 5.5 * 3600 * 1000).toISOString().slice(0, 10)); // India time, as the script
  add('7850001', { name: 'Rtn Secretary Moves', club_id: 'S-004', email: 'sec.moves@example.com' });
  env.run('appendRow_', env.main, 'officers', { rotary_year: year, club_id: 'S-004', member_id: '7850001', name: 'Rtn Secretary Moves', role: 'Secretary' });
  assert.equal(env.run('actingOfficers_')['S-004'].Secretary.member_id, '7850001');
  assert.equal(env.run('clubSender_', 'S-004', 'sec.moves@example.com').who, 'officer');
  const row = env.run('readTab_', env.priv, 'members_master').find((m) => m.member_id === '7850001')._row;
  env.run('updateRow_', env.priv, 'members_master', row, { club_id: 'S-029' });
  assert.equal((env.run('actingOfficers_')['S-004'] || {}).Secretary, undefined);
  assert.notEqual(env.run('clubSender_', 'S-004', 'sec.moves@example.com').who, 'officer');
  // the officer rows themselves stay, as history
  assert.ok(env.main.rows('officers').some((o) => o.member_id === '7850001'));
});

test('no form makes a member: an old My details form for someone not in the list is refused on approval', () => {
  const ids = JSON.parse(env.props.get('FORM_IDS'));
  const old = env.context.FormApp.create('My details on the website – Rotary District 3110');
  ids.my_details = old.getId();
  env.props.set('FORM_IDS', JSON.stringify(ids));
  const count = env.priv.rows('members_master').length;
  env.submit('my_details', { [Q.cClub]: 'RC Agra North', [Q.cName]: 'Rtn Not Listed', [Q.cMemberId]: '7860001', [Q.cMobile]: '9811100060',
    [Q.cFilledBy]: 'The member', [Q.mKind]: env.context.MY_DETAILS_KINDS.consent, [Q.cDirectory]: 'Yes', [Q.cContact]: 'No', [Q.cPhoto]: 'No',
    [Q.cBirthday]: 'No', [Q.cAnniversary]: 'No', [Q.cDeclaration]: ['yes'] }, 'not.listed@example.com', new Date());
  const req = lastRequest();
  assert.throws(() => env.run('approveConsent', req.id, true), /a form never makes a new member/);
  assert.equal(env.priv.rows('members_master').length, count);
  assert.ok(!env.priv.rows('members_master').some((m) => /^TM-/.test(m.member_id) && m.is_rotarian === true));
});

test('until the new script has refreshed the public list, a member with a WhatsApp button keeps the Call button too', () => {
  const pub = core.Core_buildPublicData({ members_public: [{ public_key: 'k1', name: 'Rtn Old Row', club_id: 'S-004', directory_ok: true, contact_ok: true,
    contact_link: 'https://wa.me/919811100070' }], settings: [] }, '2026-11-23T00:00:00Z');
  const m = pub.members.find((x) => x.name === 'Rtn Old Row');
  assert.deepEqual([m.call_ok, m.call_link], [true, 'https://wa.me/919811100070']);
});
