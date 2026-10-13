// Runs the whole Sheet script (dist/apps-script/Code.gs) against a simulated Google environment:
// setup, form submissions, moderation, members and spouses, removals, deceased, clean-up and the data link.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { before, test } from 'node:test';
import { createGoogleEnv } from '../helpers/google-mock.mjs';
import { core, plain } from '../../lib/core.mjs';

const ROOT = resolve(import.meta.dirname, '../..');
let env;
let token;
const Q = {}; // question titles, read from the script itself

before(() => {
  execFileSync(process.execPath, [resolve(ROOT, 'tools/bundle-apps-script.mjs')]);
  env = createGoogleEnv({ sampleJson: readFileSync(resolve(ROOT, 'sample/sample-data.json'), 'utf8') });
  env.load(readFileSync(resolve(ROOT, 'dist/apps-script/Code.gs'), 'utf8'));
  Object.assign(Q, env.context.Q);
  env.run('setup');
  token = env.props.get('DATA_TOKEN');
});

const data = () => {
  const r = env.doGet({ mode: 'data', token });
  assert.ok(r.ok, r.error);
  return r.data;
};

test('setup creates every tab, loads the sample, makes four forms and fills their links', () => {
  for (const t of ['settings', 'clubs', 'activities', 'events', 'functionaries', 'members_public', 'couples_public', 'dashboard']) assert.ok(env.main.getSheetByName(t), t);
  for (const t of ['members_master', 'club_history', 'couples', 'consent_requests', 'removal_requests']) assert.ok(env.priv.getSheetByName(t), t);
  assert.equal(env.main.getSheetByName('Sheet1'), null, 'empty default tab removed');
  assert.equal(env.main.rows('clubs').length, 70);
  assert.equal(env.main.rows('functionaries').length, 176);
  const s = Object.fromEntries(env.main.rows('settings').map((r) => [r.key, r.value]));
  for (const k of ['form_activity_url', 'form_club_profile_url', 'form_consent_url', 'form_removal_url']) assert.match(s[k], /^https:\/\/docs\.google\.com\/forms/, k);
  assert.ok(env.main.getSheetByName('raw_activity_form'), 'raw answers tab for the activity form');
  assert.ok(env.priv.getSheetByName('raw_consent_form'), 'consent answers go to the private Sheet');
  assert.equal(env.triggers.filter((t) => t.getHandlerFunction() === 'onAnyFormSubmit').length, 4);
  assert.ok(env.triggers.some((t) => t.getHandlerFunction() === 'dailyJobs'));
  assert.ok(token && token.length >= 32);
  assert.equal(env.main.rows('dashboard').length, 69, 'one dashboard row per active club');
});

test('running setup again does not duplicate forms, tabs or sample rows', () => {
  env.run('setup');
  assert.equal(env.main.rows('clubs').length, 70);
  assert.equal(env.triggers.filter((t) => t.getHandlerFunction() === 'onAnyFormSubmit').length, 4);
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

const consent = (over) => ({
  [Q.cClub]: 'RC Agra North', [Q.cName]: 'Rtn Ravi Kumar', [Q.cMemberId]: '7654321', [Q.cMobile]: '9876501234', [Q.cFilledBy]: 'The member',
  [Q.cDirectory]: 'Yes', [Q.cProfession]: 'Chartered accountant', [Q.cArea]: 'Agra', [Q.cWhat]: 'Audit and tax for small businesses.',
  [Q.cContact]: 'Yes', [Q.cPhoto]: 'Yes', 'My photo (one photo of me alone, under 1 MB)': ['1PhotoOfRaviKumar0123456789abc'],
  [Q.cBirthday]: 'Yes', [Q.cBirthdayDate]: '10-21', [Q.cAnniversary]: 'No', [Q.cDeclaration]: ['yes'], ...over,
});
const pendingId = (tab) => env.priv.rows(tab).at(-1).id;

test('consent: a new member is recorded and listed with only what they ticked, day and month only', () => {
  env.submit('consent', consent({ [Q.cAnniversary]: 'Yes', [Q.cSpouseRotarian]: 'No', [Q.cSpouseName]: 'Sunita Kumar', [Q.cSpouseAgrees]: ['yes'], [Q.cAnniversaryDate]: '11-05' }), 'ravi@example.com');
  const req = env.priv.rows('consent_requests').at(-1);
  assert.equal(req.birthday, '21-10', 'stored as DD-MM');
  assert.equal(req.status, 'pending');
  env.run('approveConsent', req.id);
  const m = env.priv.rows('members_master').find((x) => x.member_id === '7654321');
  assert.ok(m && m.listing_approved === true && m.public_key);
  const d = data();
  const pub = d.members.find((x) => x.name === 'Rtn Ravi Kumar');
  assert.equal(pub.birthday, '10-21');
  assert.equal(pub.contact_link, 'https://wa.me/919876501234');
  assert.equal(pub.photo, 'drive:1PhotoOfRaviKumar0123456789abc');
  const c = d.couples.find((x) => x.person_a_name === 'Rtn Ravi Kumar');
  assert.ok(c, 'anniversary with a non-member spouse who agreed');
  assert.equal(c.person_b_name, 'Sunita');
  assert.equal(c.anniversary, '11-05');
  assert.ok(!JSON.stringify(d).includes('7654321'), 'member ID never public');
});

test('consent: Rotarian spouses in different clubs need both forms; anniversary then shows once with both clubs', () => {
  env.submit('consent', consent({ [Q.cClub]: 'RC Kanpur', [Q.cName]: 'Rtn Amit Sood', [Q.cMemberId]: '5550001', [Q.cMobile]: '9876500001', [Q.cPhoto]: 'No', 'My photo (one photo of me alone, under 1 MB)': undefined,
    [Q.cAnniversary]: 'Yes', [Q.cSpouseRotarian]: 'Yes', [Q.cSpouseName]: 'Rtn Neha Sood', [Q.cSpouseClub]: 'RC Kanpur Green', [Q.cSpouseId]: '5550002', [Q.cAnniversaryDate]: '12-09' }));
  env.run('approveConsent', pendingId('consent_requests'));
  const before = env.priv.rows('couples').find((c) => c.person_a_id === '5550001');
  assert.equal(before.status, 'awaiting_spouse');
  assert.ok(!data().couples.some((c) => c.person_a_name === 'Rtn Amit Sood'));

  env.submit('consent', consent({ [Q.cClub]: 'RC Kanpur Green', [Q.cName]: 'Rtn Neha Sood', [Q.cMemberId]: '5550002', [Q.cMobile]: '9876500002', [Q.cPhoto]: 'No', 'My photo (one photo of me alone, under 1 MB)': undefined,
    [Q.cAnniversary]: 'Yes', [Q.cSpouseRotarian]: 'Yes', [Q.cSpouseName]: 'Rtn Amit Sood', [Q.cSpouseClub]: 'RC Kanpur', [Q.cSpouseId]: '5550001', [Q.cAnniversaryDate]: '12-09' }));
  env.run('approveConsent', pendingId('consent_requests'));
  const couples = data().couples.filter((c) => [c.person_a_name, c.person_b_name].includes('Rtn Amit Sood'));
  assert.equal(couples.length, 1, 'shown once');
  assert.deepEqual([couples[0].person_a_club_id, couples[0].person_b_club_id].sort(), ['S-039', 'S-046']);
});

test('consent: different dates on the two forms are held for a moderator', () => {
  env.submit('consent', consent({ [Q.cClub]: 'RC Aligarh', [Q.cName]: 'Rtn P One', [Q.cMemberId]: '5560001', [Q.cMobile]: '9876500003', [Q.cAnniversary]: 'Yes', [Q.cSpouseRotarian]: 'Yes', [Q.cSpouseName]: 'Rtn P Two', [Q.cSpouseClub]: 'RC Aligarh', [Q.cSpouseId]: '5560002', [Q.cAnniversaryDate]: '01-15' }));
  env.run('approveConsent', pendingId('consent_requests'));
  env.submit('consent', consent({ [Q.cClub]: 'RC Aligarh', [Q.cName]: 'Rtn P Two', [Q.cMemberId]: '5560002', [Q.cMobile]: '9876500004', [Q.cAnniversary]: 'Yes', [Q.cSpouseRotarian]: 'Yes', [Q.cSpouseName]: 'Rtn P One', [Q.cSpouseClub]: 'RC Aligarh', [Q.cSpouseId]: '5560001', [Q.cAnniversaryDate]: '01-16' }));
  env.run('approveConsent', pendingId('consent_requests'));
  const c = env.priv.rows('couples').find((x) => x.person_a_id === '5560001');
  assert.equal(c.status, 'check_dates');
  assert.ok(!data().couples.some((x) => x.person_a_name === 'Rtn P One'));
});

test('removal: either spouse can withdraw the anniversary alone; "Everything" removes the listing and photo', () => {
  env.submit('removal', { [Q.rClub]: 'RC Kanpur Green', [Q.rName]: 'Rtn Neha Sood', [Q.rMemberId]: '5550002', [Q.rMobile]: '9876500002', [Q.rItems]: ['Anniversary'] });
  env.run('approveRemoval', pendingId('removal_requests'));
  assert.ok(!data().couples.some((c) => [c.person_a_name, c.person_b_name].includes('Rtn Neha Sood')));
  assert.ok(data().members.some((m) => m.name === 'Rtn Amit Sood'), "the other spouse's own listing stays");

  env.submit('removal', { [Q.rClub]: 'RC Agra North', [Q.rName]: 'Rtn Ravi Kumar', [Q.rMobile]: '9876501234', [Q.rItems]: ['Everything'] });
  env.run('approveRemoval', pendingId('removal_requests'));
  const d = data();
  assert.ok(!d.members.some((m) => m.name === 'Rtn Ravi Kumar'));
  assert.ok(!d.couples.some((c) => c.person_a_name === 'Rtn Ravi Kumar'));
  assert.ok(env.trashed.includes('1PhotoOfRaviKumar0123456789abc'), 'photo deleted from Drive');
  assert.ok(d.rebuild_requested_at, 'removals ask for a quick rebuild');
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

test('"Clear all sample data" leaves only real rows, and the site data is still valid', () => {
  env.run('clearSampleData');
  assert.equal(env.main.rows('clubs').length, 0, 'sample clubs removed');
  assert.equal(env.main.rows('functionaries').length, 0, 'Excel rows were marked sample, as agreed');
  assert.ok(env.main.rows('activities').some((a) => a.id === newActivityId), 'real (form) rows kept');
  assert.ok(env.priv.rows('members_master').some((m) => m.member_id === '7654321'), 'real member records kept');
  assert.ok(!env.priv.rows('members_master').some((m) => m.is_sample === true));
  const d = data();
  assert.deepEqual(plain(core.Core_validatePublic(d)), []);
  // "Load sample data" puts it back for testing
  env.run('loadSampleData', true);
  assert.equal(env.main.rows('clubs').length, 70);
});
