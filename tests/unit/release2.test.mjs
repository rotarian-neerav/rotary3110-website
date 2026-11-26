// Release 2 (owner, 18 Nov 2026): eight forms become four. Club updates (club details, members and roles, a public
// service) and My details on the website (show, remove, business listing) have sections chosen on page 1; a member's
// own update from their own email goes live by itself; a new member's mobile and email come with "joined". The old
// forms were deleted on 18 Nov 2026, with their answer tabs, and the code that did it went with them.
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

test('five forms: activity, Club updates, Show my details, Update my details, contact; the old links open the form that does it now', () => {
  assert.deepEqual(Object.keys(ids()).sort(), ['activity', 'club_updates', 'contact', 'show_details', 'update_details']);
  for (const k of ['club_updates', 'show_details', 'update_details', 'contact']) assert.equal(form(k).destination, 'PRIVATE', k + ' answers go to the private Sheet');
  const sections = { club_profile: U.profile, public_service: U.service, club_change: U.member };
  for (const [k, kind] of Object.entries(sections)) {
    const url = setting('form_' + k + '_url');
    assert.ok(url.includes(ids().club_updates) && url.endsWith('=' + encodeURIComponent(kind)), k);
  }
  const plain = (key) => `https://docs.google.com/forms/d/e/${ids()[key]}/viewform`;
  for (const [k, f] of [['consent', 'show_details'], ['removal', 'show_details'], ['business', 'update_details'], ['update', 'update_details']]) {
    assert.equal(setting('form_' + k + '_url'), plain(f), k);
  }
  assert.equal(data().forms.consent, plain('show_details'), 'the website links to the new forms');
  assert.equal(data().forms.update, plain('update_details'));
  // the old forms were closed and deleted on 18 Nov 2026; what closed and deleted them went with them
  for (const fn of ['closeOldForms_', 'deleteOldForms', 'deleteOldForms_', 'makeMyDetailsForm_']) assert.equal(typeof env.context[fn], 'undefined', fn);
});

test('Club updates: page 1 says who and what; each answer leads to its own section, and each section ends the form', () => {
  const f = form('club_updates');
  const t = titles(f);
  assert.deepEqual(t.slice(0, 2), [Q.club, Q.uKind], 'the sender is known by their Verified email (B11)');
  const kind = item(f, Q.uKind);
  assert.deepEqual([...kind.choices], [U.profile, U.member, U.service]);
  assert.deepEqual([...kind.goTo].map((p) => p.title), ["Our club's details", 'A member or a role', 'A public service the club runs']);
  const page = (title) => f.items.find((i) => i.type === 'PAGE_BREAK' && i.title === title);
  assert.equal(page('A member or a role').goToPage, 'SUBMIT', 'the club details section ends the form');
  assert.equal(page('A public service the club runs').goToPage, 'SUBMIT', 'the members section ends with its note');
  assert.equal(item(f, Q.gChange).goTo.length, 5, 'one page per kind of change; a move is "left" and "joined" (23 Nov 2026)');
  assert.ok(!U.member.includes('moved'));
  for (const q of [Q.pWebsite + ' (optional)', Q.pProjects, Q.sName, Q.sPhone, Q.gMemberId, Q.gNote]) assert.ok(t.includes(q), q);
});

test('Show my details: who is filling it; the club gives the Rotary ID; List or Do not list for every item, never the email', () => {
  const f = form('show_details');
  assert.equal(f.title, 'Show my details on the website – Rotary District 3110');
  assert.equal(titles(f)[0], Q.cFilledBy);
  const who = item(f, Q.cFilledBy);
  assert.deepEqual([...who.choices], ['The member', 'Club President, Secretary or Executive Secretary for the member']);
  assert.deepEqual([...who.goTo].map((p) => p.title), ['What the website may show', 'The member'], 'the member goes straight to the choices');
  const t = titles(f);
  assert.deepEqual(t.slice(t.indexOf('The member') + 1, t.indexOf('The member') + 3), [Q.gMemberId, Q.rName]);
  assert.equal(item(f, Q.gMemberId).required, true);
  const grid = item(f, Q.showGrid);
  assert.equal(grid.type, 'GRID');
  assert.equal(grid.required, true, 'every row answered');
  assert.deepEqual([...grid.columns], ['List', 'Do not list']);
  assert.deepEqual([...grid.rows], Object.values(env.context.SHOW_ITEMS));
  for (const r of ['Directory listing: my name and club', 'Photo', 'Call button', 'WhatsApp button', 'Wedding anniversary (day and month only)']) assert.ok(grid.rows.includes(r), r);
  assert.ok(!grid.rows.some((r) => /email|mobile number|date of birth/i.test(r)), 'never the email or a number');
  assert.match(f.description, /Sent from your own email .* goes in at the next website update/);
});

test('Update my details: blanks change nothing; the Call and WhatsApp numbers, a second email; the business listing or its removal', () => {
  const f = form('update_details');
  assert.equal(f.title, 'Update my details – Rotary District 3110');
  const who = item(f, Q.cFilledBy);
  assert.deepEqual([...who.goTo].map((p) => p.title), ['The details', 'The member']);
  const t = titles(f);
  for (const q of [Q.cProfession, Q.cArea, Q.cWhat, Q.cWebsite, Q.uCall, Q.uWhatsapp, Q.uEmail2, Q.cBirthdayDate, Q.cAnniversaryDate, Q.cSpouseId, Q.bName, Q.bTopics]) assert.ok(t.includes(q), q);
  for (const q of [Q.cProfession, Q.uCall, Q.uEmail2, Q.cBirthdayDate]) assert.equal(item(f, q).required, false, q + ' optional');
  assert.ok(!t.includes(Q.cMemberId) && !t.includes(Q.cMobile), 'the member is found by email, or by the ID the club gives');
  const biz = item(f, Q.uBusiness);
  assert.deepEqual([...biz.choices], Object.values(env.context.BUSINESS_CHOICES));
  assert.deepEqual([...biz.goTo].map((p) => p.title || p), ['SUBMIT', 'Your business', 'SUBMIT']);
});

test('Upgrade Sheet: the old My details form stops taking answers; Club updates loses "moved", once; a refusal does not stop the upgrade', () => {
  const C = env.context.CLUB_CHANGES;
  const old = env.context.FormApp.create('My details on the website – Rotary District 3110');
  const all = ids();
  all.my_details = old.getId();
  env.props.set('FORM_IDS', JSON.stringify(all));
  // Club updates as it was before 23 Nov 2026: the "moved" page and the old first choice
  const f = form('club_updates');
  const kind = item(f, Q.uKind);
  kind.choices = [U.profile, env.context.CLUB_UPDATE_MEMBER_BEFORE, U.service];
  const moved = f.proxy.addPageBreakItem().setTitle(C.moved);
  f.proxy.addListItem().setTitle(Q.gNewClub);
  f.proxy.addDateItem().setTitle(Q.gMoved);
  const change = item(f, Q.gChange);
  change.choices = [...change.choices.slice(0, 2), C.moved, ...change.choices.slice(2)];
  change.goTo = [...change.goTo.slice(0, 2), moved, ...change.goTo.slice(2)];
  f.refuse = 'delete';
  let report = env.run('upgradeSheet');
  assert.ok(report.some((l) => /could not remove the "moved" section/.test(l)), report.join('\n'));
  assert.ok(report.some((l) => /Closed the old My details on the website form/.test(l)), 'the rest of the upgrade went on');
  assert.equal(env.forms[old.getId()].accepting, false);
  f.refuse = null;
  report = env.run('upgradeSheet');
  assert.ok(report.some((l) => /"A member moved to another club" removed/.test(l)), report.join('\n'));
  assert.ok(!titles(f).includes(C.moved) && !titles(f).includes(Q.gNewClub) && !titles(f).includes(Q.gMoved));
  assert.deepEqual([...item(f, Q.gChange).choices], ['joined', 'left', 'deceased', 'club_role', 'district_role'].map((k) => C[k]));
  assert.deepEqual([...item(f, Q.gChange).goTo].map((p) => p.title), ['joined', 'left', 'deceased', 'club_role', 'district_role'].map((k) => C[k]));
  assert.deepEqual([...item(f, Q.uKind).choices], [U.profile, U.member, U.service]);
  assert.doesNotMatch(f.description, /moved/);
  report = env.run('upgradeSheet');
  assert.ok(!report.some((l) => /moved|Closed the old/.test(l)), 'once');
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
});

test("Core: a member is found by RI ID, then by the sender's own email when the name agrees; never by a typed mobile", () => {
  const master = [{ member_id: '1', name: 'Rtn Asha Verma', club_id: 'A', mobile: '9811100001', email: 'asha@x.com' },
    { member_id: '2', name: 'Rtn Ravi Gupta', club_id: 'A', email: 'ravi@x.com', email2: 'Ravi.Signin@x.com' }];
  assert.equal(core.Core_matchMember({ member_id: '2' }, master), 1);
  assert.equal(core.Core_matchMember({ name: 'Ravi Gupta', submitter_email: 'ravi.signin@x.com', filled_by: 'The member' }, master), 1, 'the second email kept by the district');
  assert.equal(core.Core_matchMember({ mobile: '+91 98111 00001', club_id: 'A' }, master), -1, 'anyone could type it');
  assert.equal(core.Core_matchMember({ name: 'Asha Verma', submitter_email: 'ASHA@x.com', filled_by: 'The member' }, master), 0);
  assert.equal(core.Core_matchMember({ name: 'Sita Devi', submitter_email: 'asha@x.com', filled_by: 'The member' }, master), -1, 'writing for someone else from one\'s own account');
  assert.equal(core.Core_matchMember({ name: 'Asha Verma', submitter_email: 'asha@x.com', filled_by: 'Club secretary for the member' }, master), -1, 'a secretary\'s own email is not the member\'s');
});

test("Update my details: the member's own goes live by itself, business listing included; the club's waits; a listing can be removed", () => {
  addMember('7500001', { email: 'asha.verma@example.com', mobile: '' });
  const n = env.mails.length;
  const upd = (extra = {}) => ({ [Q.cFilledBy]: 'The member', [Q.cDeclaration]: ['yes'], [Q.uBusiness]: env.context.BUSINESS_CHOICES.none, ...extra });
  // a member ID typed by the member is not how they are found: their email is
  mine('update_details', upd({ [Q.cProfession]: 'Teacher' }), 'asha.verma@example.com');
  const own = env.priv.rows('consent_requests').at(-1);
  assert.deepEqual([own.status, own.approved_by, own.matched_member_id], ['approved', AUTO, '7500001']);
  assert.ok(!env.mails.slice(n).some((x) => x.to === 'meera@example.com'), 'no moderator alerted');
  assert.equal(env.priv.rows('members_master').find((x) => x.member_id === '7500001').profession, 'Teacher');
  assert.ok(setting('content_changed_at'), 'the next website update takes it');

  // the same from the club: by Rotary ID; the member is told and a moderator checks it
  mine('update_details', upd({ [Q.cFilledBy]: 'Club President, Secretary or Executive Secretary for the member', [Q.gMemberId]: '7500001',
    [Q.rName]: 'Rtn Asha Verma', [Q.cProfession]: 'Doctor' }), 'secretary@example.com');
  const other = env.priv.rows('consent_requests').at(-1);
  assert.equal(other.status, 'pending');
  assert.match(other.member_notice, /^Told by email/);
  env.run('rejectRequest', 'consent', other.id, 'Test');

  // business: the member's own listing goes live; one with a phone number in the text waits for a moderator
  const biz = { [Q.uBusiness]: env.context.BUSINESS_CHOICES.list, [Q.bName]: 'Verma Sarees', [Q.bTrade]: 'Shop / retail', [Q.bCity]: 'Agra',
    [Q.bAbout]: 'Silk and cotton sarees.', [Q.bConfirm]: ['yes'] };
  const count = env.priv.rows('consent_requests').length;
  mine('update_details', upd(biz), 'asha.verma@example.com');
  assert.equal(env.priv.rows('consent_requests').length, count, 'a business alone files no details request');
  let b = env.main.rows('businesses').at(-1);
  assert.deepEqual([b.status, b.member_id, b.approved_by, b.club_id], ['approved', '7500001', AUTO, 'S-004']);
  mine('update_details', upd({ ...biz, [Q.bName]: 'Verma Silks', [Q.bAbout]: 'Call 9876543210 for orders.' }), 'asha.verma@example.com');
  b = env.main.rows('businesses').at(-1);
  assert.equal(b.status, 'pending');
  assert.match(b.moderator_note, /phone number or email/);
  env.setActive('businesses', env.main.rows('businesses').length + 1);
  env.run('rejectSelected', 'Phone number in the text');

  // "Remove my business listing" from the member's own email: off at the next update
  mine('update_details', upd({ [Q.uBusiness]: env.context.BUSINESS_CHOICES.remove }), 'asha.verma@example.com');
  assert.equal(env.main.rows('businesses').find((x) => x.business_name === 'Verma Sarees').status, 'removed');
  assert.ok(!data().businesses.some((x) => x.name === 'Verma Sarees'));

  // the member's own form from an email nobody has: not applied, business included
  const before = env.main.rows('businesses').length;
  mine('update_details', upd(biz), 'stranger@example.com');
  assert.equal(env.main.rows('businesses').length, before);
  assert.equal(env.priv.rows('consent_requests').at(-1).status, 'not_matched');
});
