// Release 2 (owner, 18 Nov 2026): eight forms become four. Club updates (club details, members and roles, a public
// service) and My details on the website (show, remove, business listing) have sections chosen on page 1; a member's
// own update from their own email goes live by itself; a new member's mobile and email come with "joined"; the old
// forms are closed by Upgrade Sheet and deleted, with their answer tabs, by Administrator → Delete the old forms.
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
let U;
let M;
const AUTO = "automatic: sent from the member's own email";

beforeEach(() => { if (env) env.quota.left = 100; });

before(() => {
  env = createGoogleEnv({ sampleJson: readFileSync(resolve(ROOT, 'sample/sample-data.json'), 'utf8') });
  env.load(bundleCode());
  ({ Q, CLUB_UPDATE_KINDS: U, MY_DETAILS_KINDS: M } = env.context);
  env.run('setup');
  token = env.props.get('DATA_TOKEN');
  const sh = env.main.getSheetByName('moderators');
  const head = env.run('headers_', env.main, 'moderators');
  sh.set(4, head.indexOf('email') + 1, 'meera@example.com');
});

const ids = () => JSON.parse(env.props.get('FORM_IDS'));
const form = (key) => env.forms[ids()[key]];
const titles = (f) => f.items.map((i) => i.title);
const item = (f, title) => f.items.find((i) => i.title === title);
const setting = (k) => env.main.rows('settings').find((x) => x.key === k)?.value || '';
const data = () => { const r = env.doGet({ mode: 'data', token }); assert.ok(r.ok, r.error); return r.data; };
const addMember = (id, extra = {}) => env.run('appendRow_', env.priv, 'members_master', { member_id: id, name: 'Rtn Asha Verma', club_id: 'S-004', is_rotarian: true, status: 'active', ...extra });
const mine = (key, answers, email) => env.submit(key, answers, email, new Date());
const page1 = (extra = {}) => ({ [Q.cClub]: 'RC Agra North', [Q.cName]: 'Rtn Asha Verma', [Q.cMobile]: '9811100001', [Q.cFilledBy]: 'The member', ...extra });
const consent = { [Q.cDirectory]: 'No', [Q.cContact]: 'No', [Q.cPhoto]: 'No', [Q.cBirthday]: 'Yes', [Q.cBirthdayDate]: '03-14', [Q.cAnniversary]: 'No', [Q.cDeclaration]: ['yes'] };

test('four forms: activity, Club updates, My details on the website, contact; the old links open the new forms at the right section', () => {
  assert.deepEqual(Object.keys(ids()).sort(), ['activity', 'club_updates', 'contact', 'my_details']);
  for (const k of ['club_updates', 'my_details', 'contact']) assert.equal(form(k).destination, 'PRIVATE', k + ' answers go to the private Sheet');
  const links = { club_profile: ['club_updates', U.profile], public_service: ['club_updates', U.service], club_change: ['club_updates', U.member],
    consent: ['my_details', M.consent], removal: ['my_details', M.removal], business: ['my_details', M.business] };
  for (const [k, [f, kind]] of Object.entries(links)) {
    const url = setting('form_' + k + '_url');
    assert.ok(url.includes(ids()[f]) && url.endsWith('=' + encodeURIComponent(kind)), k);
  }
  assert.equal(data().forms.consent, setting('form_consent_url'), 'the website links to the new form');
  // the old forms were closed and deleted on 18 Nov 2026; what closed and deleted them went with them
  for (const fn of ['closeOldForms_', 'deleteOldForms', 'deleteOldForms_']) assert.equal(typeof env.context[fn], 'undefined', fn);
});

test('Club updates: page 1 says who and what; each answer leads to its own section, and each section ends the form', () => {
  const f = form('club_updates');
  const t = titles(f);
  assert.deepEqual(t.slice(0, 5), [Q.club, Q.name, Q.role, Q.mobile, Q.uKind]);
  const kind = item(f, Q.uKind);
  assert.deepEqual([...kind.choices], [U.profile, U.member, U.service]);
  assert.deepEqual([...kind.goTo].map((p) => p.title), ["Our club's details", 'A member or a role', 'A public service the club runs']);
  const page = (title) => f.items.find((i) => i.type === 'PAGE_BREAK' && i.title === title);
  assert.equal(page('A member or a role').goToPage, 'SUBMIT', 'the club details section ends the form');
  assert.equal(page('A public service the club runs').goToPage, 'SUBMIT', 'the members section ends with its note');
  assert.equal(item(f, Q.gChange).goTo.length, 6, 'one page per kind of change');
  for (const q of [Q.pWebsite + ' (optional)', Q.pProjects, Q.sName, Q.sPhone, Q.gMemberId, Q.gNote]) assert.ok(t.includes(q), q);
});

test('My details: page 1 finds the member; show, remove or business; the upload questions are left for the owner to add', () => {
  const f = form('my_details');
  assert.deepEqual(titles(f).slice(0, 6), [Q.cClub, Q.cName, Q.cMemberId, Q.cMobile, Q.cFilledBy, Q.mKind]);
  const kind = item(f, Q.mKind);
  assert.deepEqual([...kind.choices], [M.consent, M.removal, M.business]);
  assert.deepEqual([...kind.goTo].map((p) => p.title), ['Professional directory', 'Remove my details', 'Your business']);
  const page = (title) => f.items.find((i) => i.type === 'PAGE_BREAK' && i.title === title);
  assert.equal(page('Remove my details').goToPage, 'SUBMIT');
  assert.equal(page('Your business').goToPage, 'SUBMIT');
  assert.ok(item(f, Q.rItems).choices.includes('Business listing (Rotary Means Business)'));
  assert.match(f.description, /Sent from your own email .* applied at the next website update/);
  const id = item(f, Q.cMemberId);
  assert.equal(id.required, true, 'the RI member ID is required (owner, 18 Nov 2026)');
  // a My details form made before that: Upgrade Sheet makes it required, once
  id.required = false;
  assert.ok(env.run('upgradeSheet').some((l) => /RI member ID is now required/.test(l)));
  assert.equal(id.required, true);
  assert.ok(!env.run('upgradeSheet').some((l) => /RI member ID is now required/.test(l)));
});

test("Club updates files each section where the old forms did; a new member's mobile and email reach the members list", () => {
  const sender = { [Q.club]: 'RC Agra North', [Q.name]: 'Rtn Sec', [Q.role]: 'Secretary', [Q.mobile]: '9811100009' };
  env.submit('club_updates', { ...sender, [Q.uKind]: U.profile, [Q.pWebsite + ' (optional)']: 'https://agranorth.example.org', [Q.pConfirm]: ['yes'] });
  assert.equal(env.main.rows('club_profile_requests').at(-1).website, 'https://agranorth.example.org');
  env.submit('club_updates', { ...sender, [Q.uKind]: U.service, [Q.sName]: 'Rotary Eye Centre', [Q.sType]: 'Eye care', [Q.sTimings]: 'Mon–Sat 10–4',
    [Q.sPhone]: '0562 222 3344', [Q.sAddress]: 'Civil Lines', [Q.sCity]: 'Agra', [Q.sConfirm]: ['yes'] });
  assert.equal(env.main.rows('public_services').at(-1).name, 'Rotary Eye Centre');
  env.submit('club_updates', { ...sender, [Q.uKind]: U.member, [Q.gMemberId]: '7400001', [Q.rName]: 'Rtn New Member', [Q.gChange]: env.context.CLUB_CHANGES.joined,
    [Q.gJoined]: '2026-11-01', [Q.gMobile]: '98111 22233', [Q.gEmail]: 'New.Member@Example.com' });
  const req = env.priv.rows('club_change_requests').at(-1);
  assert.deepEqual([req.change, req.club_id, req.mobile, req.email], ['joined', 'S-004', '98111 22233', 'new.member@example.com']);
  env.run('approveClubChange', req.id);
  const m = env.priv.rows('members_master').find((x) => x.member_id === '7400001');
  assert.deepEqual([m.mobile, m.email, m.club_id], ['98111 22233', 'new.member@example.com', 'S-004']);
  env.submit('club_updates', { ...sender, [Q.uKind]: U.member, [Q.gMemberId]: '7400002', [Q.rName]: 'Rtn Other', [Q.gChange]: env.context.CLUB_CHANGES.joined,
    [Q.gJoined]: '2026-11-01', [Q.gMobile]: '12345' });
  assert.match(env.priv.rows('club_change_requests').at(-1).moderator_note, /not a 10-digit mobile/);
  // a club role says Executive Secretary now; the old form's wording is still understood
  env.submit('club_updates', { ...sender, [Q.uKind]: U.member, [Q.gMemberId]: '7400001', [Q.rName]: 'Rtn New Member', [Q.gChange]: 'A club role: President or Secretary',
    [Q.gClubYear]: '2026-27', [Q.gClubRole]: 'Secretary' });
  assert.equal(env.priv.rows('club_change_requests').at(-1).change, 'club_role');
});

test("Core: a member is found by RI ID, then by the sender's own email when the name agrees; never by a typed mobile", () => {
  const master = [{ member_id: '1', name: 'Rtn Asha Verma', club_id: 'A', mobile: '9811100001', email: 'asha@x.com' },
    { member_id: '2', name: 'Rtn Ravi Gupta', club_id: 'A', email: 'ravi@x.com' }];
  assert.equal(core.Core_matchMember({ member_id: '2' }, master), 1);
  assert.equal(core.Core_matchMember({ mobile: '+91 98111 00001', club_id: 'A' }, master), -1, 'anyone could type it');
  assert.equal(core.Core_matchMember({ name: 'Asha Verma', submitter_email: 'ASHA@x.com', filled_by: 'The member' }, master), 0);
  assert.equal(core.Core_matchMember({ name: 'Sita Devi', submitter_email: 'asha@x.com', filled_by: 'The member' }, master), -1, 'writing for someone else from one\'s own account');
  assert.equal(core.Core_matchMember({ name: 'Asha Verma', submitter_email: 'asha@x.com', filled_by: 'Club secretary for the member' }, master), -1, 'a secretary\'s own email is not the member\'s');
});

test("a member's own update from their own email goes live by itself; anyone else's waits for a Members moderator", () => {
  addMember('7500001', { email: 'asha.verma@example.com', mobile: '' });
  // found by the sender's email alone (no member ID, the mobile is not on file): applied at once
  const n = env.mails.length;
  mine('my_details', { ...page1(), [Q.mKind]: M.consent, ...consent }, 'asha.verma@example.com');
  const own = env.priv.rows('consent_requests').at(-1);
  assert.equal(own.status, 'approved');
  assert.equal(own.approved_by, AUTO);
  assert.ok(!env.mails.slice(n).some((x) => x.to === 'meera@example.com'), 'no moderator alerted');
  assert.equal(env.priv.rows('members_master').find((x) => x.member_id === '7500001').birthday_ok, true);
  assert.ok(setting('content_changed_at'), 'the next website update takes it');

  // the same details from the club secretary: the member is told and a moderator checks it
  mine('my_details', { ...page1({ [Q.cMemberId]: '7500001', [Q.cFilledBy]: 'Club secretary for the member' }), [Q.mKind]: M.consent, ...consent }, 'secretary@example.com');
  const other = env.priv.rows('consent_requests').at(-1);
  assert.equal(other.status, 'pending');
  assert.match(other.member_notice, /^Told by email/);

  // removal: someone else's waits; the member's own is done at once
  mine('my_details', { ...page1({ [Q.cMemberId]: '7500001' }), [Q.mKind]: M.removal, [Q.rItems]: ['Birthday'] }, 'someone@example.com');
  assert.equal(env.priv.rows('removal_requests').at(-1).status, 'pending');
  mine('my_details', { ...page1(), [Q.mKind]: M.removal, [Q.rItems]: ['Birthday'] }, 'asha.verma@example.com');
  const rem = env.priv.rows('removal_requests').at(-1);
  assert.equal(rem.status, 'approved');
  assert.equal(rem.filled_by, 'The member');
  assert.equal(env.priv.rows('members_master').find((x) => x.member_id === '7500001').birthday_ok, false);

  // business: the member's own listing goes live; one with a phone number in the text waits for a moderator
  const biz = { [Q.mKind]: M.business, [Q.bName]: 'Verma Sarees', [Q.bTrade]: 'Shop / retail', [Q.bCity]: 'Agra', [Q.bAbout]: 'Silk and cotton sarees.', [Q.bConfirm]: ['yes'] };
  mine('my_details', { ...page1(), ...biz }, 'asha.verma@example.com');
  let b = env.main.rows('businesses').at(-1);
  assert.deepEqual([b.status, b.member_id, b.approved_by], ['approved', '7500001', AUTO]);
  mine('my_details', { ...page1(), ...biz, [Q.bName]: 'Verma Silks', [Q.bAbout]: 'Call 9876543210 for orders.' }, 'asha.verma@example.com');
  b = env.main.rows('businesses').at(-1);
  assert.equal(b.status, 'pending');
  assert.match(b.moderator_note, /phone number or email/);
});

