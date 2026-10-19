// The moderation desk (Desk.js) and the alert emails, against a simulated Google: signing in with an emailed code,
// personal one-tap links from emails, what each type of moderator may see and do, and that nothing leaks.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { before, test } from 'node:test';
import { createGoogleEnv } from '../helpers/google-mock.mjs';
import { core } from '../../lib/core.mjs';

const ROOT = resolve(import.meta.dirname, '../..');
let env;
let token;
const Q = {};
const OWNER = 'rotarian.neerav@gmail.com';

before(() => {
  execFileSync(process.execPath, [resolve(ROOT, 'tools/bundle-apps-script.mjs')]);
  env = createGoogleEnv({ sampleJson: readFileSync(resolve(ROOT, 'sample/sample-data.json'), 'utf8') });
  env.load(readFileSync(resolve(ROOT, 'dist/apps-script/Code.gs'), 'utf8'));
  Object.assign(Q, env.context.Q);
  env.run('setup');
  token = env.props.get('DATA_TOKEN');
  // name the moderators over the placeholders: Content, Content (inactive), Members, Club engagement, District office
  const sh = env.main.getSheetByName('moderators');
  [['Asha Content', 'asha@example.com', 'TRUE'], ['Old Content', 'old@example.com', 'FALSE'], ['Meera Members', 'meera@example.com', 'TRUE'],
    ['Kabir Clubs', 'kabir@example.com', 'TRUE'], ['Dina Office', 'dina@example.com', 'TRUE']].forEach(([name, email, active], i) => {
    sh.set(i + 2, 2, name); sh.set(i + 2, 3, email); sh.set(i + 2, 4, active);
  });
});

const data = () => { const r = env.doGet({ mode: 'data', token }); assert.ok(r.ok, r.error); return r.data; };
const mailsTo = (email, since) => env.mails.slice(since).filter((m) => m.to === email);
/** The value after name= in the desk link that follows "label: " in an email body. */
const linkParam = (body, label, name) => {
  const url = body.split('\n').find((l) => l.startsWith(label + ': ')).slice(label.length + 2);
  assert.match(url, /\/desk\/#k=TEST&/);
  return decodeURIComponent(url.split('#')[1].split('&').find((p) => p.startsWith(name + '=')).slice(name.length + 1));
};
const signIn = (email) => {
  for (const k of [...env.cache.keys()]) if (k.startsWith('deskrate:')) env.cache.delete(k); // as if an hour had passed (the limit has its own test)
  const before = env.mails.length;
  assert.ok(env.post({ fn: 'code', email }).ok);
  const mail = mailsTo(email, before).at(-1);
  const code = mail.subject.match(/(\d{6})$/)[1];
  const r = env.post({ fn: 'signin', email, code });
  assert.ok(r.ok, r.error);
  return r.session;
};
const activity = (title, extra = {}) => {
  env.submit('activity', {
    [Q.club]: 'RC Agra North', [Q.name]: 'Rtn Test Secretary', [Q.role]: 'Secretary', [Q.mobile]: '98765 43210', [Q.kind]: Q.kindActivity,
    [Q.aTitle]: title, [Q.aDate]: '2026-10-11', [Q.aTheme]: 'Club service / Other',
    [Q.aDesc]: 'Members distributed blankets at three night shelters in the city before the cold wave.',
    'Photos (up to 3, each under 1 MB)': ['1DeskPhotoAbCdEfGhIjKlMnOpQrStUv'], [Q.aConsent]: ['yes'], ...extra,
  });
  return env.main.rows('activities').at(-1);
};

test('Core: types per email, what each type sees, quiet clubs, and a web address typed as a newspaper name', () => {
  const rows = [{ type: 'Content', email: 'A@x.com' }, { type: 'Members', email: 'a@x.com' }, { type: 'Content', email: 'b@x.com', active: 'FALSE' }];
  assert.deepEqual([...core.Core_moderatorTypesOf(rows, 'a@X.com')], ['Content', 'Members']);
  assert.deepEqual([...core.Core_moderatorTypesOf(rows, 'b@x.com')], []);
  assert.deepEqual({ ...core.Core_deskViews(['Content']) }, { content: true, members: false, clubs: false, office: false });
  assert.deepEqual({ ...core.Core_deskViews(['Administrator']) }, { content: true, members: true, clubs: true, office: true });
  const clubs = [{ club_id: 'A', club_name: 'RC A', status: 'active' }, { club_id: 'B', club_name: 'RC B' }, { club_id: 'C', club_name: 'RC C' }, { club_id: 'D', club_name: 'RC D', status: 'inactive' }];
  const acts = [{ club_id: 'A', date: '2026-10-10', status: 'approved' }, { club_id: 'B', date: '2026-08-01', status: 'approved' }, { club_id: 'C', date: '2026-10-12', status: 'rejected' }];
  assert.deepEqual(core.Core_quietClubs(clubs, acts, '2026-10-18', 30).map((c) => [c.club_id, c.last_activity_date]), [['C', ''], ['B', '2026-08-01']]);
  for (const v of ['https://www.amarujala.com/x', 'www.jagran.com', 'livehindustan.com/agra/news-1']) assert.ok(core.Core_looksLikeUrl(v), v);
  for (const v of ['Amar Ujala', 'Dainik Jagran', 'Hindustan Times']) assert.ok(!core.Core_looksLikeUrl(v), v);
});

test('the build remembers the web app address; emails link to the desk page with the script id after the #', () => {
  assert.equal(env.props.get('WEB_APP_URL'), undefined);
  data();
  assert.equal(env.props.get('WEB_APP_URL'), 'https://script.google.com/macros/s/TEST/exec');
  assert.match(env.run('deskLink_', {}), /^https:\/\/rotarian-neerav\.github\.io\/rotary3110-website\/desk\/#k=TEST$/);
});

test('signing in: a code only for active moderators, wrong codes refused, a 12-hour session; inactive people are locked out', () => {
  let before = env.mails.length;
  const generic = env.post({ fn: 'code', email: 'stranger@example.com' });
  assert.ok(generic.ok);
  assert.match(generic.message, /If stranger@example\.com is on the moderators list/);
  assert.equal(env.mails.length, before, 'nothing sent to someone not on the list');
  assert.equal(env.post({ fn: 'code', email: 'old@example.com' }).ok && env.mails.length, before, 'nor to an inactive moderator');

  before = env.mails.length;
  env.post({ fn: 'code', email: 'Asha@Example.com' });
  const mail = mailsTo('asha@example.com', before).at(-1);
  assert.match(mail.subject, /^Moderation desk code: \d{6}$/);
  assert.match(mail.options.htmlBody, /Sign in/);
  const signinToken = linkParam(mail.body, 'Or tap this link to sign in', 's');
  const wrong = env.post({ fn: 'signin', email: 'asha@example.com', code: '000000' === mail.subject.slice(-6) ? '111111' : '000000' });
  assert.deepEqual([wrong.ok, wrong.error], [false, 'That code is not right. Use the code in the latest email.']);
  const ok = env.post({ fn: 'signin', email: 'asha@example.com', code: mail.subject.slice(-6) });
  assert.ok(ok.ok);
  assert.deepEqual([ok.me.name, [...ok.me.types]], ['Asha Content', ['Content']]);
  assert.equal(env.post({ fn: 'signin', email: 'asha@example.com', code: mail.subject.slice(-6) }).error, 'The code has expired. Ask for a new one.', 'a code works once');
  const expiry = Number(ok.session.split('~')[4]);
  assert.ok(Math.abs(expiry - Date.now() - 7 * 86400000) < 60000, '7 days');
  // the sign-in link works too
  assert.equal(env.post({ fn: 'signin', token: signinToken }).me.email, 'asha@example.com');

  // a forged or altered session is refused
  const forged = ok.session.replace('asha@example.com', 'meera@example.com');
  assert.deepEqual([env.post({ fn: 'list', session: forged }).signedOut], [true]);
  assert.equal(env.post({ fn: 'list', session: 'ses~~~asha@example.com~99999999999999~abc' }).signedOut, true);
  // setting active to FALSE locks someone out at once
  const sh = env.main.getSheetByName('moderators');
  sh.set(2, 4, 'FALSE');
  const out = env.post({ fn: 'list', session: ok.session });
  assert.deepEqual([out.ok, out.signedOut, out.error], [false, true, 'This email is no longer on the moderators list.']);
  sh.set(2, 4, 'TRUE');
  // too many codes for one email in an hour
  for (let i = 0; i < 4; i++) env.post({ fn: 'code', email: 'kabir@example.com' });
  env.post({ fn: 'code', email: 'kabir@example.com' });
  assert.match(env.post({ fn: 'code', email: 'kabir@example.com' }).error, /Too many codes/);
});

test('each type sees only its part of the desk; the district account sees everything', () => {
  const views = (email) => {
    const r = env.post({ fn: 'list', session: signIn(email) });
    assert.ok(r.ok, r.error);
    return ['content', 'members', 'clubs', 'office'].filter((k) => r[k]);
  };
  assert.deepEqual(views('asha@example.com'), ['content']);
  assert.deepEqual(views('meera@example.com'), ['members']);
  assert.deepEqual(views('dina@example.com'), ['office']);
  assert.deepEqual(views(OWNER), ['content', 'members', 'clubs', 'office']);
  const content = env.post({ fn: 'list', session: signIn('asha@example.com') });
  assert.ok(!JSON.stringify(content).includes('9876501234'), 'no member mobile numbers on the Content view');
  const meera = signIn('meera@example.com');
  assert.match(env.post({ fn: 'approve', session: meera, tab: 'activities', id: 'x' }).error, /Only Content moderators/);
  assert.match(env.post({ fn: 'nudge', session: meera, club_id: 'S-001', via: 'email' }).error, /Only Club engagement/);
  assert.match(env.post({ fn: 'search', session: signIn('asha@example.com'), q: 'Aarav' }).error, /Only Members moderators/);
});

let alerted;
test('a new activity: each Content moderator gets their own email with Approve and Reject; one more tap on the desk approves it', () => {
  const before = env.mails.length;
  alerted = activity('Desk test blankets', { [Q.aPressPaper]: 'www.amarujala.com/agra/blankets' });
  // a web address typed as the newspaper name becomes the link, with a note
  assert.equal(alerted.press_paper, '');
  assert.equal(alerted.press_link, 'https://www.amarujala.com/agra/blankets');
  assert.match(alerted.moderator_note, /newspaper name was a web address/);
  const sent = env.mails.slice(before).filter((m) => /^To check: Desk test blankets – RC Agra North$/.test(m.subject));
  assert.deepEqual(sent.map((m) => m.to), ['asha@example.com'], 'only active Content moderators');
  const mail = sent[0];
  assert.match(mail.options.htmlBody, />Approve</);
  assert.match(mail.options.htmlBody, /src="cid:p0"/);
  assert.ok(mail.options.inlineImages.p0, 'the photo is in the email');
  assert.match(mail.body, /Please check: .*newspaper name was a web address/);
  const linkToken = linkParam(mail.body, 'Approve', 'a');
  assert.equal(linkParam(mail.body, 'Reject', 'a'), linkToken);

  const peek = env.post({ fn: 'peek', token: linkToken });
  assert.ok(peek.ok, peek.error);
  assert.deepEqual([peek.item.title, peek.item.status, peek.me.name], ['Desk test blankets', 'pending', 'Asha Content']);
  assert.equal(env.main.rows('activities').at(-1).status, 'pending', 'opening the link changes nothing');
  // the link shows this item's photo, and no other
  assert.ok(env.post({ fn: 'photo', token: linkToken, ref: 'drive:1DeskPhotoAbCdEfGhIjKlMnOpQrStUv' }).base64);
  assert.match(env.post({ fn: 'photo', token: linkToken, ref: 'drive:1SomeoneElsesFile' }).error, /not available/);
  // an altered link is refused
  const other = linkToken.replace(alerted.id, 'ACT-2026-0001');
  assert.equal(env.post({ fn: 'confirm', token: other, action: 'approve' }).error, 'This link is not valid.');

  const before2 = env.mails.length;
  const done = env.post({ fn: 'confirm', token: linkToken, action: 'approve' });
  assert.ok(done.ok, done.error);
  assert.match(done.message, /^Approved: Desk test blankets/);
  const row = env.main.rows('activities').find((r) => r.id === alerted.id);
  assert.deepEqual([row.status, row.approved_by], ['approved', 'asha@example.com']);
  assert.ok(env.mails.slice(before2).some((m) => m.to === 'secretary@example.com' && /^Approved:/.test(m.subject)), 'the club is told');
  assert.match(env.post({ fn: 'confirm', token: linkToken, action: 'reject', reason: 'x' }).message, /^Already approved by Asha Content on /, 'the link works once');
  const log = env.main.rows('moderator_log').at(-1);
  assert.deepEqual([log.moderator, log.action, log.item], ['asha@example.com', 'approve', alerted.id]);
  assert.ok(!JSON.stringify(data()).includes('asha@example.com'), 'moderators are never published');
});

test('expired links and links for someone no longer a Content moderator do nothing', () => {
  const t = env.run('deskToken_', 'it', 'activities', alerted.id, 'asha@example.com', -1);
  assert.match(env.post({ fn: 'peek', token: t }).error, /expired/);
  const kabir = env.run('deskToken_', 'it', 'activities', alerted.id, 'kabir@example.com', 60);
  assert.match(env.post({ fn: 'peek', token: kabir }).error, /no longer a Content moderator/);
  const ses = env.run('deskToken_', 'ses', '', '', 'asha@example.com', 60);
  assert.equal(env.post({ fn: 'confirm', token: ses, action: 'approve' }).error, 'This link is not valid.', 'a session is not an item link');
});

test('on the desk: reject needs a reason; Correct fixes the text and notes who; Story of the month and Leave out on approved items', () => {
  const s = signIn('asha@example.com');
  const a = activity('Desk test with a typo in it');
  let list = env.post({ fn: 'list', session: s });
  const card = list.content.pending.find((c) => c.id === a.id);
  assert.deepEqual([card.kind, card.club, card.sender, card.sender_mobile], ['Activity', 'RC Agra North', 'Rtn Test Secretary, Secretary', '919876543210']);
  assert.deepEqual([...card.photos], ['drive:1DeskPhotoAbCdEfGhIjKlMnOpQrStUv']);
  assert.ok(env.post({ fn: 'photo', session: s, ref: card.photos[0] }).base64);
  assert.match(env.post({ fn: 'photo', session: s, ref: 'drive:1NotPending' }).error, /not available/);

  const edited = env.post({ fn: 'edit', session: s, tab: 'activities', id: a.id, fields: { title: 'Desk test, typo fixed', approved_by: 'me', status: 'approved' } });
  assert.ok(edited.ok, edited.error);
  const row = env.main.rows('activities').find((r) => r.id === a.id);
  assert.deepEqual([row.title, row.status, row.approved_by], ['Desk test, typo fixed', 'pending', ''], 'only the allowed fields change');
  assert.match(row.moderator_note, /Corrected by Asha Content \(title\)/);
  const phone = env.post({ fn: 'edit', session: s, tab: 'activities', id: a.id, fields: { description: 'Call 9876543210 to join' } });
  assert.match(phone.item.notes.join(';'), /Contains a phone number or email/);

  assert.equal(env.post({ fn: 'reject', session: s, tab: 'activities', id: a.id, reason: '' }).error, 'Please write a reason. It is sent to the person who sent it.');
  const rej = env.post({ fn: 'reject', session: s, tab: 'activities', id: a.id, reason: 'Please send a clearer photo' });
  assert.match(rej.message, /^Rejected/);
  assert.equal(env.mails.at(-1).body.includes('Reason: Please send a clearer photo'), true);

  // an activity without a photo or link cannot be approved from the desk either
  const bare = activity('Desk test without photo', { 'Photos (up to 3, each under 1 MB)': undefined });
  assert.match(env.post({ fn: 'approve', session: s, tab: 'activities', id: bare.id }).error, /^Not approved: needs a photo/);

  list = env.post({ fn: 'list', session: s });
  const recent = list.content.recent.find((x) => x.id === alerted.id);
  assert.ok(recent, 'the approved activity is in Recent');
  assert.ok(env.post({ fn: 'flag', session: s, tab: 'activities', id: alerted.id, field: 'story_of_month', value: true }).value);
  assert.ok(env.post({ fn: 'flag', session: s, tab: 'activities', id: alerted.id, field: 'bulletin_exclude', value: true }).value);
  const flagged = env.main.rows('activities').find((r) => r.id === alerted.id);
  assert.deepEqual([flagged.story_of_month, flagged.bulletin_exclude], ['TRUE', 'TRUE']);
  assert.match(env.post({ fn: 'flag', session: s, tab: 'activities', id: alerted.id, field: 'status', value: true }).error, /Unknown change/);
  env.post({ fn: 'flag', session: s, tab: 'activities', id: alerted.id, field: 'bulletin_exclude', value: false });
});

test('Saturday preview: each Content moderator gets "Leave this out" links; one tap on the desk leaves the item out', () => {
  const before = env.mails.length;
  env.run('bulletinPreview');
  const mail = mailsTo('asha@example.com', before).find((m) => /no action needed/.test(m.subject));
  assert.ok(mail, 'sent to the Content moderator');
  assert.match(mail.options.htmlBody, /Leave this out/);
  const line = mail.body.split('\n').find((l) => l.trim().startsWith('Leave this out: '));
  assert.ok(line, 'at least one item has a link');
  const t = decodeURIComponent(line.split('#')[1].split('&').find((p) => p.startsWith('a=')).slice(2));
  const peek = env.post({ fn: 'peek', token: t });
  assert.equal(peek.kind, 'bx');
  const [, tab, id] = t.split('~');
  const r = env.post({ fn: 'confirm', token: t, action: 'leaveout' });
  assert.ok(r.ok, r.error);
  assert.equal(env.main.rows(tab).find((x) => x.id.toLowerCase() === id.toLowerCase()).bulletin_exclude, 'TRUE');
  env.post({ fn: 'confirm', token: t, action: 'putback' });
  assert.equal(env.main.rows(tab).find((x) => x.id.toLowerCase() === id.toLowerCase()).bulletin_exclude, 'FALSE');
});

test('member requests: the Members moderator is alerted with only the name; approves and rejects on the desk; marks a death after a search', () => {
  const consent = {
    [Q.cClub]: 'RC Agra North', [Q.cName]: 'Rtn Desk Member', [Q.cMemberId]: '7650001', [Q.cMobile]: '9876501299', [Q.cFilledBy]: 'The member',
    [Q.cDirectory]: 'Yes', [Q.cProfession]: 'Teacher', [Q.cArea]: 'Agra', [Q.cWhat]: 'Teaches maths.', [Q.cContact]: 'No', [Q.cPhoto]: 'Yes',
    'My photo (one photo of me alone, under 1 MB)': ['1DeskMemberPhoto0123456789abcd'], [Q.cBirthday]: 'No', [Q.cAnniversary]: 'No', [Q.cDeclaration]: ['yes'],
  };
  const before = env.mails.length;
  env.submit('consent', consent, 'desk.member@example.com');
  const alert = mailsTo('meera@example.com', before).at(-1);
  assert.equal(alert.subject, 'Consent form to check: Rtn Desk Member – RC Agra North');
  assert.match(alert.body, /Open the moderation desk: https:\/\/\S+\/desk\/#k=TEST$/m);
  assert.ok(!alert.body.includes('9876501299') && !alert.body.includes('Teacher'), 'no personal details in the email');
  assert.equal(mailsTo('asha@example.com', before).length, 0, 'Content moderators are not told');

  const s = signIn('meera@example.com');
  const list = env.post({ fn: 'list', session: s });
  const req = list.members.consent.find((r) => r.name === 'Rtn Desk Member');
  assert.equal(req.photoRef, 'drive:1DeskMemberPhoto0123456789abcd');
  assert.equal(req.photo, '', 'no pictures in the list itself');
  assert.ok(env.post({ fn: 'photo', session: s, ref: req.photoRef }).base64);
  assert.match(env.post({ fn: 'photo', session: signIn('asha@example.com'), ref: req.photoRef }).error, /not available/, 'not for Content moderators');
  const ok = env.post({ fn: 'member', session: s, kind: 'consent', action: 'approve', id: req.id });
  assert.ok(ok.ok, ok.error);
  assert.equal(env.priv.rows('consent_requests').find((r) => r.id === req.id).approved_by, 'meera@example.com');
  assert.equal(env.mails.at(-1).to, 'desk.member@example.com', 'the confirmation email still goes');

  env.submit('consent', { ...consent, [Q.cName]: 'Rtn Turned Away', [Q.cMemberId]: '7650002', [Q.cMobile]: '9876501298' });
  const second = env.priv.rows('consent_requests').at(-1).id;
  assert.match(env.post({ fn: 'member', session: s, kind: 'consent', action: 'reject', id: second }).error, /Please write a reason/);
  assert.ok(env.post({ fn: 'member', session: s, kind: 'consent', action: 'reject', id: second, reason: 'Two people in the photo' }).ok);

  assert.match(env.post({ fn: 'search', session: s, q: 'Rt' }).error, /three letters/);
  const found = env.post({ fn: 'search', session: s, q: 'Desk Member' }).people;
  assert.deepEqual(found.map((p) => p.name), ['Rtn Desk Member']);
  const dead = env.post({ fn: 'deceased', session: s, member_id: found[0].member_id });
  assert.match(dead.message, /is marked as deceased/);
  assert.equal(env.priv.rows('members_master').find((m) => m.member_id === found[0].member_id).status, 'deceased');
  assert.deepEqual(env.post({ fn: 'search', session: s, q: 'Desk Member' }).people, []);
});

test('quiet clubs: the Club engagement moderator emails the President and Secretary from the district account (hidden copy to themselves) once a week, or notes a WhatsApp reminder', () => {
  const s = signIn('kabir@example.com');
  const clubs = env.post({ fn: 'list', session: s }).clubs;
  assert.ok(clubs.length > 0);
  assert.ok(clubs.every((c) => !c.can_email), 'sample members are never emailed');
  const c = clubs[0];
  assert.match(c.whatsapp, /^Dear friends at .+ Please send your latest service project; it takes two minutes: https:\/\/docs\.google\.com\/forms\/\S+\nThank you!\nRotary District 3110 website team$/);
  assert.ok(!c.whatsapp.includes('Kabir'), 'the moderator is not named');
  assert.match(env.post({ fn: 'nudge', session: s, club_id: c.club_id, via: 'email' }).error, /No email for this club's President or Secretary/);
  assert.ok(env.post({ fn: 'nudge', session: s, club_id: c.club_id, via: 'whatsapp' }).ok);

  // a real (not sample) President with an email, this Rotary year
  const year = env.main.rows('settings').find((r) => r.key === 'current_rotary_year').value;
  env.main.getSheetByName('officers').appendRow([year, c.club_id, '7659999', 'Rtn Real President', 'President', false, '', '']);
  env.priv.getSheetByName('members_master').appendRow(['7659999', 'Rtn Real President', c.club_id, true, 'active', '', 'real.president@example.com']);
  const after = env.post({ fn: 'list', session: s }).clubs.find((x) => x.club_id === c.club_id);
  assert.deepEqual([after.can_email, after.reminded_by, after.reminded_via], [true, 'Kabir Clubs', 'whatsapp']);
  const r = env.post({ fn: 'nudge', session: s, club_id: c.club_id, via: 'email' });
  assert.ok(r.ok, r.error);
  const mail = env.mails.at(-1);
  assert.deepEqual([mail.to, mail.options.bcc, mail.options.replyTo, mail.options.name], ['real.president@example.com', 'kabir@example.com', undefined, 'Rotary District 3110']);
  assert.ok(!mail.body.includes('Kabir'), 'the club never sees the moderator\'s name or email');
  assert.match(env.post({ fn: 'nudge', session: s, club_id: c.club_id, via: 'email' }).error, /Already emailed by Kabir Clubs/);
});

test('contact messages: answered from the desk by the district account, never by Reply (the moderator stays private); phone-only messages are marked answered', () => {
  const before = env.mails.length;
  env.submit('contact', { [Q.kName]: 'Asha Verma', [Q.kReply]: 'asha.v@example.com', [Q.kTopic]: 'I want to volunteer', [Q.kCity]: 'Agra', [Q.kMessage]: 'I would like to help at the next blood camp.' });
  const mail = env.mails.at(-1);
  assert.deepEqual([env.mails.length - before, mail.to, mail.options.replyTo], [1, 'dina@example.com', undefined]);
  assert.match(mail.body, /Please answer from the moderation desk \(Messages → Reply\), not by pressing Reply here/);
  env.submit('contact', { [Q.kName]: 'Ravi', [Q.kReply]: '98765 11111', [Q.kTopic]: 'I want to volunteer', [Q.kCity]: 'Agra', [Q.kMessage]: 'Please call me about joining Rotary.' });
  assert.equal(env.mails.at(-1).options.replyTo, undefined);
  assert.match(env.mails.at(-1).body, /\+919876511111\. Please call or WhatsApp from the district office phone, not your personal phone/);
  assert.ok(!env.mails.at(-1).body.includes('wa.me'));

  const s = signIn('dina@example.com');
  let office = env.post({ fn: 'list', session: s }).office;
  const asha = office.find((m) => m.name === 'Asha Verma');
  assert.match(env.post({ fn: 'reply', session: s, id: asha.id, text: ' ' }).error, /Please write the reply/);
  assert.match(env.post({ fn: 'reply', session: signIn('kabir@example.com'), id: asha.id, text: 'Hello' }).error, /Only District office/);
  const sent = env.mails.length;
  const r = env.post({ fn: 'reply', session: s, id: asha.id, text: 'Thank you! The next camp is on 2 November at RC Agra.' });
  assert.ok(r.ok, r.error);
  const answer = env.mails.at(-1);
  assert.equal(env.mails.length - sent, 1);
  assert.deepEqual([answer.to, answer.options.name, answer.options.replyTo, answer.options.bcc], ['asha.v@example.com', 'Rotary District 3110', undefined, undefined]);
  assert.match(answer.subject, /^Re: I want to volunteer – Rotary District 3110$/);
  assert.match(answer.body, /^Dear Asha Verma,\n\nThank you! The next camp is on 2 November at RC Agra\.\n\nWith regards,\nRotary District 3110\n/);
  assert.match(answer.body, /I would like to help at the next blood camp\./);
  assert.ok(!/Dina|dina@/.test(answer.body + answer.subject), 'the moderator is never named');
  const saved = env.priv.rows('contact_messages').find((m) => m.id === asha.id);
  assert.equal(saved.status, 'answered');
  assert.match(saved.replies, /\d{4}-\d\d-\d\d: Thank you! The next camp/);
  assert.match(saved.note, /Replied by email from the desk by Dina Office/);
  const log = env.main.rows('moderator_log').at(-1);
  assert.deepEqual([log.action, log.item, log.details], ['replied', asha.id, ''], 'the reply text stays in the private Sheet');
  office = env.post({ fn: 'list', session: s }).office;
  assert.match(office.find((m) => m.id === asha.id).replies, /The next camp/);
  const ravi = office.find((m) => m.name === 'Ravi');
  assert.match(env.post({ fn: 'reply', session: s, id: ravi.id, text: 'Hello' }).error, /gave a mobile number/);
  assert.deepEqual([ravi.reply_mobile, ravi.reply_email, ravi.status], ['919876511111', '', 'new']);
  assert.ok(env.post({ fn: 'answered', session: s, id: ravi.id }).ok);
  const row = env.priv.rows('contact_messages').find((m) => m.id === ravi.id);
  assert.equal(row.status, 'answered');
  assert.match(row.note, /Answered: marked by Dina Office/);
});

test('the web app never serves a page (so no page can call the script\'s other functions); unknown requests are refused', () => {
  const code = readFileSync(resolve(ROOT, 'dist/apps-script/Code.gs'), 'utf8');
  const uses = code.match(/HtmlService\.\w+/g) || [];
  assert.deepEqual([...new Set(uses)], ['HtmlService.createTemplateFromFile'], 'only the Sheet sidebar');
  assert.match(code, /function openMemberRequests\(\) \{\s+var html = HtmlService\.createTemplateFromFile\('Sidebar'\)/);
  assert.equal(env.post({ fn: 'setup' }).error, 'Please sign in again.');
  assert.equal(env.post({ fn: 'setup', session: signIn('asha@example.com') }).error, 'unknown request');
  const bad = JSON.parse(env.context.doPost({ postData: { contents: 'not json' } }).content);
  assert.deepEqual(bad, { ok: false, error: 'bad request' });
});

test('practice round: each moderator gets their own practice items and emails; nothing is published or changed; the report shows who did what; removal clears them', () => {
  env.setUser(OWNER);
  const before = env.mails.length;
  const clubsBefore = JSON.stringify(env.main.rows('clubs'));
  const made = env.run('startPractice');
  assert.equal(made.length, 4 + 1 + 2, 'Content 4, Members 1, District office 2');
  assert.ok(made.every((r) => /^PRAC-\d{4}$/.test(r.id) && r.is_sample === true));
  const sent = env.mails.slice(before);
  const subjects = (email) => sent.filter((m) => m.to === email).map((m) => m.subject);
  assert.deepEqual(subjects('asha@example.com').filter((s) => /^To check: Practice:/.test(s)).length, 4);
  assert.equal(subjects('meera@example.com').filter((s) => /^Consent form to check: Practice: Rtn Asha Sharma/.test(s)).length, 1);
  assert.equal(subjects('dina@example.com').filter((s) => /^Website message: .* – from Practice:/.test(s)).length, 2);
  for (const e of ['asha@example.com', 'meera@example.com', 'kabir@example.com', 'dina@example.com']) {
    const intro = sent.find((m) => m.to === e && m.subject === 'Practice round on the moderation desk');
    assert.ok(intro, e);
    assert.match(intro.body, /\/desk\/guide\//);
  }
  assert.match(sent.find((m) => m.to === 'kabir@example.com' && /^Practice round/.test(m.subject)).body, /send the message to yourself, not to the club/);
  assert.equal(subjects('old@example.com').length, 0, 'inactive moderators are left out');
  assert.equal(subjects(OWNER).length, 0, 'every type has someone, so the district account gets nothing');
  assert.ok(sent.every((m) => /@example\.com$/.test(m.to)), 'only moderators are emailed');

  const report0 = env.run('practiceReport').join('\n');
  assert.match(report0, /Asha Content\n {2}✗ Tree plantation in the city park: not approved yet/);
  assert.match(report0, /Kabir Clubs\n {2}✗ Quiet clubs reminder: not tried yet/);

  // Content: approve, correct then approve, reject
  const s = signIn('asha@example.com');
  const items = env.post({ fn: 'list', session: s }).content.pending.filter((c) => /^Practice:/.test(c.title));
  const byTitle = (t) => items.find((c) => c.title.startsWith('Practice: ' + t));
  assert.equal(items.length, 4);
  assert.match(byTitle('Tree').notes.join(';'), /Practice for Asha Content/);
  assert.match(byTitle('Visit').block, /needs a photo or a link/);
  assert.ok(env.post({ fn: 'approve', session: s, tab: 'activities', id: byTitle('Tree').id }).ok);
  const blood = byTitle('Blood');
  assert.ok(env.post({ fn: 'edit', session: s, tab: 'activities', id: blood.id, fields: { description: blood.text.replace(/ For the next camp.*$/, '') } }).ok);
  assert.ok(env.post({ fn: 'approve', session: s, tab: 'activities', id: blood.id }).ok);
  const dinner = byTitle('Club assembly');
  assert.ok(env.post({ fn: 'edit', session: s, tab: 'events', id: dinner.id, fields: { fee: '₹300 per person' } }).ok);
  assert.ok(env.post({ fn: 'approve', session: s, tab: 'events', id: dinner.id }).ok);
  assert.ok(env.post({ fn: 'reject', session: s, tab: 'activities', id: byTitle('Visit').id, reason: 'Please send a photo or a link to your post.' }).ok);

  // Members: approving is refused (no declaration); reject
  const m = signIn('meera@example.com');
  const consent = env.post({ fn: 'list', session: m }).members.consent.find((c) => c.name === 'Practice: Rtn Asha Sharma');
  assert.match(env.post({ fn: 'member', session: m, kind: 'consent', action: 'approve', id: consent.id }).error, /declaration was not ticked/);
  assert.ok(env.post({ fn: 'member', session: m, kind: 'consent', action: 'reject', id: consent.id, reason: 'Please tick the declaration and send the form again.' }).ok);

  // District office: the reply reaches the moderator's own inbox from the district account; the phone-only one is marked answered
  const d = signIn('dina@example.com');
  const office = env.post({ fn: 'list', session: d }).office;
  const sentBefore = env.mails.length;
  assert.ok(env.post({ fn: 'reply', session: d, id: office.find((x) => x.name === 'Practice: Ramesh Gupta').id, text: 'Welcome! A club near you will call.' }).ok);
  assert.deepEqual([env.mails.at(-1).to, env.mails.at(-1).options.name, env.mails.length - sentBefore], ['dina@example.com', 'Rotary District 3110', 1]);
  assert.ok(env.post({ fn: 'answered', session: d, id: office.find((x) => x.name === 'Practice: Sunita').id }).ok);

  // Club engagement: WhatsApp to themselves
  const k = signIn('kabir@example.com');
  assert.ok(env.post({ fn: 'nudge', session: k, club_id: env.post({ fn: 'list', session: k }).clubs[0].club_id, via: 'whatsapp' }).ok);

  const report = env.run('practiceReport');
  assert.ok(report.join('\n').indexOf('✗') < 0, report.join('\n'));
  assert.equal(report.length, 4);
  assert.match(report.join('\n'), /Asha Content\n {2}✓ Tree plantation in the city park\n {2}✓ Blood donation camp\n {2}✓ Club assembly and fellowship dinner\n {2}✓ Visit to an old-age home/);

  // never published, never counted, nothing real changed, nobody outside the moderators emailed
  const pub = data();
  assert.ok(![...pub.activities, ...pub.events].some((x) => /^PRAC-/.test(x.id)));
  assert.equal(JSON.stringify(env.main.rows('clubs')), clubsBefore);
  assert.ok(env.mails.slice(before).every((x) => /@example\.com$/.test(x.to)));
  assert.ok(!core.Core_overdue([{ id: 'PRAC-0001', status: 'pending', submitted_at: '2020-01-01' }], Date.now(), 48).length, 'no 48-hour reminders for practice items');

  const removed = env.run('removePractice');
  assert.deepEqual([...removed].sort(), ['activities: 3', 'consent_requests: 1', 'contact_messages: 2', 'events: 1']);
  assert.equal(env.run('practiceReport').length, 0);
  assert.ok(env.main.rows('moderator_log').some((l) => l.action === 'replied'), 'the log keeps its record');
});
