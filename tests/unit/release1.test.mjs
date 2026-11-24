// Release 1 (owner, 18 Nov 2026): moderators keep the data up to date on the desk. Clean activities approved in one
// tap, hiding a published activity, zones for Content moderators, editing members with a change log and Undo, roles,
// clubs and moderators on the desk, member counts worked out, and the four daily website updates.
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
const Q = {};
// today in India, as the script has it (a UTC date is a day behind before 5:30 am)
const today = () => new Date(Date.now() + 5.5 * 3600 * 1000).toISOString().slice(0, 10);
const daysAgo = (n) => new Date(Date.now() - n * 86400000).toISOString().slice(0, 10);

beforeEach(() => { if (env) env.quota.left = 100; });

before(() => {
  env = createGoogleEnv({ sampleJson: readFileSync(resolve(ROOT, 'sample/sample-data.json'), 'utf8') });
  env.load(bundleCode());
  Object.assign(Q, env.context.Q);
  env.run('setup');
  token = env.props.get('DATA_TOKEN');
  // over the placeholders: two Content moderators with a zone each, a Members moderator, an Administrator
  const sh = env.main.getSheetByName('moderators');
  const head = env.run('headers_', env.main, 'moderators');
  const col = (k) => head.indexOf(k) + 1;
  [[2, 'Asha Agra', 'asha@example.com', 'Agra'], [3, 'Kiran Kanpur', 'kiran@example.com', 'Kanpur'], [4, 'Meera Members', 'meera@example.com', ''],
    [7, 'Ajay Admin', 'ajay@example.com', '']].forEach(([row, name, email, zone]) => {
    sh.set(row, col('name'), name); sh.set(row, col('email'), email); sh.set(row, col('active'), 'TRUE'); sh.set(row, col('zone'), zone);
  });
});

const data = () => { const r = env.doGet({ mode: 'data', token }); assert.ok(r.ok, r.error); return r.data; };
const tab = (ss, name) => env.run('readTab_', ss, name); // rows with their row number (_row)
const setting = (k) => env.main.rows('settings').find((x) => x.key === k)?.value || '';
const signIn = (email) => {
  for (const k of [...env.cache.keys()]) if (k.startsWith('deskrate:')) env.cache.delete(k);
  const n = env.mails.length;
  assert.ok(env.post({ fn: 'code', email }).ok);
  const code = env.mails.slice(n).filter((m) => m.to === email).at(-1).subject.match(/(\d{6})$/)[1];
  const r = env.post({ fn: 'signin', email, code });
  assert.ok(r.ok, r.error);
  return r.session;
};
const activity = (club, title, extra = {}) => {
  env.submit('activity', {
    [Q.club]: club, [Q.name]: 'Rtn Test Secretary', [Q.role]: 'Secretary', [Q.mobile]: '98765 43210', [Q.kind]: Q.kindActivity,
    [Q.aTitle]: title, [Q.aDate]: daysAgo(3), [Q.aTheme]: 'Club service / Other',
    [Q.aDesc]: 'Members planted saplings along the canal road with the school children.',
    'Photos (up to 3, each under 1 MB)': ['1R1PhotoAbCdEfGhIjKlMnOpQrStUv'], [Q.aConsent]: ['yes'], ...extra,
  });
  return env.main.rows('activities').at(-1);
};
const addMember = (id, extra = {}) => {
  env.run('appendRow_', env.priv, 'members_master', { member_id: id, name: 'Rtn Real ' + id, club_id: 'S-004', is_rotarian: true, status: 'active', ...extra });
  env.run('appendRow_', env.priv, 'club_history', { member_id: id, club_id: extra.club_id || 'S-004', from_date: '2020-07-01', reason: 'joined' });
};

test('Core: what makes an activity clean, member counts, zones, a new club is not quiet yet', () => {
  const clean = { club_id: 'S-1', photo_files: 'drive:x', photo_consent: true };
  assert.deepEqual([...core.Core_activityChecks(clean)], []);
  assert.deepEqual([...core.Core_activityChecks({ ...clean, district_level: true })], ['Marked as district level']);
  assert.deepEqual([...core.Core_activityChecks({ ...clean, campaign_id: 'C1', campaign_count: 40 })], ['Campaign count: it goes into the totals']);
  assert.deepEqual([...core.Core_activityChecks({ ...clean, photo_consent: false })], ['Photo consent not ticked']);
  assert.deepEqual([...core.Core_activityChecks({ ...clean, club_id: '' })], ['Club not recognised']);
  assert.deepEqual([...core.Core_activityChecks({ ...clean, moderator_note: 'Possible duplicate of ACT-1; Date is in the future' })], ['Possible duplicate of ACT-1', 'Date is in the future']);
  const counts = core.Core_memberCounts([{ club_id: 'A' }, { club_id: 'A', status: 'left' }, { club_id: 'A', is_rotarian: 'FALSE' }, { club_id: 'B', status: 'active' },
    { club_id: 'B', is_sample: true }]);
  assert.deepEqual({ ...counts }, { A: 1, B: 1 });
  const rows = [{ type: 'Content', email: 'a@x.com', zone: 'Agra, Kanpur' }, { type: 'Members', email: 'a@x.com', zone: 'Bareilly' }, { type: 'Content', email: 'b@x.com' }];
  assert.deepEqual([...core.Core_moderatorZones(rows, 'A@x.com')], ['Agra', 'Kanpur']);
  assert.deepEqual([...core.Core_moderatorZones(rows, 'b@x.com')], [], 'no zone: every zone');
  const clubs = [{ club_id: 'N', club_name: 'RC New', charter_date: '2026-10-01' }, { club_id: 'O', club_name: 'RC Old', charter_date: '2020-10-01' }];
  assert.deepEqual(core.Core_quietClubs(clubs, [], '2026-11-18', 30).map((c) => c.club_id), ['O'], 'chartered 48 days ago: not nudged yet');
  assert.deepEqual(core.Core_quietClubs(clubs, [], '2026-12-15', 30).map((c) => c.club_id), ['N', 'O'], 'after 60 days it counts');
});

test('activities: each zone moderator is alerted for their clubs; Clean and Needs a look; Approve all clean; the four daily updates take it', () => {
  let n = env.mails.length;
  const agra = activity('RC Agra North', 'Saplings on the canal road');
  const alerts = env.mails.slice(n).filter((m) => /^To check:/.test(m.subject)).map((m) => m.to);
  assert.ok(alerts.includes('asha@example.com') && !alerts.includes('kiran@example.com'), 'Agra club: the Agra moderator only');
  n = env.mails.length;
  const kanpur = activity('RC Brahmavarta Kanpur', 'Blood donation camp at the ghat');
  const alerts2 = env.mails.slice(n).filter((m) => /^To check:/.test(m.subject)).map((m) => m.to);
  assert.ok(alerts2.includes('kiran@example.com') && !alerts2.includes('asha@example.com'), 'Kanpur club: the Kanpur moderator only');
  const district = activity('RC Agra North', 'District Rotaract assembly', { [Q.aDistrict]: 'Yes' });
  const noConsent = activity('RC Agra North', 'Eye camp photos without the tick', { [Q.aConsent]: [] });
  assert.match(noConsent.moderator_note, /Photo consent not ticked/);

  const s = signIn('asha@example.com');
  const list = env.post({ fn: 'list', session: s });
  assert.deepEqual([...list.me.zones], ['Agra']);
  const card = (id) => list.content.pending.find((c) => c.id === id);
  assert.equal(card(agra.id).clean, true);
  assert.equal(card(agra.id).zone, 'Agra');
  assert.equal(card(kanpur.id).zone, 'Kanpur');
  assert.equal(card(district.id).clean, false);
  assert.ok(card(district.id).checks.some((x) => /district level/.test(x)));
  assert.equal(card(noConsent.id).clean, false);

  env.run('setSetting_', 'content_changed_at', '');
  env.run('setSetting_', 'rebuild_requested_at', '');
  const r = env.post({ fn: 'approveclean', session: s, ids: [agra.id, district.id] });
  assert.ok(r.ok, r.error);
  assert.deepEqual([...r.approved], [agra.id]);
  assert.deepEqual([...r.left], [district.id], 'a District mark always needs a full look');
  assert.match(r.message, /next website update \(9 am, 1 pm, 6 pm or 10 pm\)/);
  const rows = env.main.rows('activities');
  assert.equal(rows.find((x) => x.id === agra.id).status, 'approved');
  assert.equal(rows.find((x) => x.id === agra.id).approved_by, 'asha@example.com');
  assert.equal(rows.find((x) => x.id === district.id).status, 'pending');
  assert.ok(setting('content_changed_at'), 'the next of the four daily updates takes it');
  assert.equal(setting('rebuild_requested_at'), '', 'no rebuild within 30 minutes for an approval');
  assert.match(env.post({ fn: 'approveclean', session: s, ids: [] }).error, /Tick at least one/);
  assert.match(env.post({ fn: 'approveclean', session: signIn('meera@example.com'), ids: [kanpur.id] }).error, /Only Content moderators/);
  // a single approval also waits for the next update, and says so
  assert.match(env.post({ fn: 'approve', session: s, tab: 'activities', id: kanpur.id }).message, /next website update/);
  assert.match(env.mails.filter((m) => m.to === 'secretary@example.com').at(-1).body, /next website update \(9 am, 1 pm, 6 pm or 10 pm\)/);
});

test('hide: a published activity comes off the website with a reason, and Put back returns it; the club is not emailed', () => {
  const s = signIn('asha@example.com');
  const a = activity('RC Agra North', 'Winter clothes for the night shelter');
  assert.ok(env.post({ fn: 'approve', session: s, tab: 'activities', id: a.id }).ok);
  assert.ok(data().activities.some((x) => x.id === a.id));
  assert.match(env.post({ fn: 'hide', session: s, id: a.id }).error, /write a reason/);
  const n = env.mails.length;
  env.run('setSetting_', 'content_changed_at', '');
  const r = env.post({ fn: 'hide', session: s, id: a.id, reason: 'A child is named in the text' });
  assert.ok(r.ok, r.error);
  assert.equal(env.mails.length, n, 'nobody emailed');
  const row = env.main.rows('activities').find((x) => x.id === a.id);
  assert.equal(row.status, 'hidden');
  assert.equal(row.hidden_by, 'asha@example.com');
  assert.match(row.moderator_note, /Hidden by Asha Agra on .*: A child is named/);
  assert.ok(setting('content_changed_at'));
  assert.ok(!data().activities.some((x) => x.id === a.id), 'not on the website');
  const recent = env.post({ fn: 'list', session: s }).content.recent.find((x) => x.id === a.id);
  assert.equal(recent.hidden, true);
  assert.match(env.post({ fn: 'hide', session: s, id: a.id, reason: 'again' }).error, /Only a published activity/);
  assert.ok(env.post({ fn: 'putback', session: s, id: a.id }).ok);
  assert.equal(env.main.rows('activities').find((x) => x.id === a.id).status, 'approved');
  assert.ok(data().activities.some((x) => x.id === a.id));
});

test('members: find by RI ID, email or mobile; correct a member with a reason; the change log and Undo; the RI ID never changes; an email is one member\'s', () => {
  addMember('7100001', { mobile: '9812345601', email: 'real.one@example.com' });
  addMember('7100002', { club_id: 'S-029' });
  const s = signIn('meera@example.com');
  const find = (q) => env.post({ fn: 'search', session: s, q }).people.map((p) => p.member_id);
  assert.deepEqual(find('7100001'), ['7100001']);
  assert.deepEqual(find('REAL.ONE@example.com'), ['7100001']);
  assert.deepEqual(find('+91 98123 45601'), ['7100001']);
  assert.ok(find('Real 71000').includes('7100002'));

  assert.match(env.post({ fn: 'membersave', session: s, member_id: '7100001', fields: { mobile: '9812345699' } }).error, /write a reason/);
  assert.match(env.post({ fn: 'membersave', session: s, member_id: '7100001', fields: { mobile: '12345' }, reason: 'new number' }).error, /10-digit/);
  assert.match(env.post({ fn: 'membersave', session: s, member_id: '7100001', fields: { club_id: 'S-999' }, reason: 'moved' }).error, /Choose a club/);
  assert.match(env.post({ fn: 'membersave', session: signIn('asha@example.com'), member_id: '7100001', fields: { name: 'X' }, reason: 'typo' }).error, /Only Members moderators/);

  // a move and a new mobile, in one save
  const r = env.post({ fn: 'membersave', session: s, member_id: '7100001', fields: { club_id: 'S-029', mobile: '9812345699', name: 'Rtn Real 7100001' }, reason: 'Moved to Kanpur in October' });
  assert.ok(r.ok, r.error);
  assert.match(r.message, /^Saved: club_id, mobile\./);
  const m = env.priv.rows('members_master').find((x) => x.member_id === '7100001');
  assert.equal(m.club_id, 'S-029');
  assert.equal(m.mobile, '9812345699');
  const hist = env.priv.rows('club_history').filter((h) => h.member_id === '7100001');
  assert.equal(hist.length, 2);
  assert.ok(hist[0].to_date && !hist[1].to_date && hist[1].club_id === 'S-029');
  const log = env.priv.rows('change_log').filter((l) => l.key === '7100001');
  assert.deepEqual(log.map((l) => l.field).sort(), ['club_id', 'mobile']);
  assert.ok(log.every((l) => l.moderator === 'meera@example.com' && l.reason === 'Moved to Kanpur in October' && l.id === log[0].id));
  // the main Sheet's log names the fields only, never the member's details
  const mainLog = env.main.rows('moderator_log').filter((l) => l.item === '7100001');
  assert.ok(mainLog.length && mainLog.every((l) => !/98123/.test(l.details)));
  // member counts follow the members list (real members only; the sample's stay as they were)
  assert.equal(env.main.rows('clubs').find((c) => c.club_id === 'S-029').member_count, 2);

  // marked as left by mistake, then undone
  assert.ok(env.post({ fn: 'membersave', session: s, member_id: '7100002', fields: { status: 'left' }, reason: 'Club said he left' }).ok);
  assert.equal(env.priv.rows('members_master').find((x) => x.member_id === '7100002').status, 'left');
  const changes = env.post({ fn: 'changes', session: s }).changes;
  const last = changes[0];
  assert.equal(last.key, '7100002');
  assert.deepEqual([...last.lines], ['status: active → left']);
  const u = env.post({ fn: 'undo', session: s, id: last.id });
  assert.ok(u.ok, u.error);
  assert.match(u.message, /^Undone\./);
  assert.equal(env.priv.rows('members_master').find((x) => x.member_id === '7100002').status, 'active');
  assert.ok(env.priv.rows('club_history').some((h) => h.member_id === '7100002' && /active again/.test(h.reason) && !h.to_date));
  assert.match(env.post({ fn: 'undo', session: s, id: last.id }).error, /already undone/);
  // an older change whose field has moved on since is not undone
  assert.ok(env.post({ fn: 'membersave', session: s, member_id: '7100001', fields: { mobile: '9812345688' }, reason: 'Another new number' }).ok);
  assert.match(env.post({ fn: 'undo', session: s, id: changes.find((c) => c.key === '7100001').id }).error, /Not undone: mobile has been changed again since/);

  // the RI member ID is never changed on the desk (owner, 23 Nov 2026): it is how a member is found
  const idr = env.post({ fn: 'membersave', session: s, member_id: '7100002', fields: { member_id: '7100022' }, reason: 'RI ID typed wrongly' });
  assert.equal(idr.message, 'Nothing changed.');
  assert.ok(env.priv.rows('members_master').some((x) => x.member_id === '7100002'));
  assert.ok(!env.priv.rows('members_master').some((x) => x.member_id === '7100022'));
  // every email is one member's: the email or second email of another member is refused; the second email and button numbers can be set
  assert.match(env.post({ fn: 'membersave', session: s, member_id: '7100002', fields: { email: 'Real.One@example.com' }, reason: 'typo' }).error, /already the email of member 7100001/);
  assert.match(env.post({ fn: 'membersave', session: s, member_id: '7100002', fields: { email2: 'real.one@example.com' }, reason: 'typo' }).error, /already the email of member 7100001/);
  assert.match(env.post({ fn: 'membersave', session: s, member_id: '7100002', fields: { call_number: '12345' }, reason: 'typo' }).error, /Call number is not a 10-digit/);
  const two = env.post({ fn: 'membersave', session: s, member_id: '7100002', fields: { email2: 'Two.Now@Example.com', whatsapp_number: '9812345602' }, reason: 'The club gave his new email' });
  assert.ok(two.ok, two.error);
  const m2 = env.priv.rows('members_master').find((x) => x.member_id === '7100002');
  assert.deepEqual([m2.email2, m2.whatsapp_number], ['two.now@example.com', '9812345602']);
  assert.deepEqual(find('two.now@example.com'), ['7100002'], 'found by the second email too');
  assert.match(env.post({ fn: 'membersave', session: s, member_id: '7100001', fields: { email: 'two.now@example.com' }, reason: 'typo' }).error, /already the email of member 7100002/);
});

test('roles: Content moderators correct club office bearers, Members moderators district roles; end a role; add one; AG clubs; role checks on the desk', () => {
  addMember('7200001');
  addMember('7200002');
  const content = signIn('asha@example.com');
  const members = signIn('meera@example.com');
  const officer = env.main.rows('officers').find((o) => o.club_id === 'S-004' && o.role === 'President');
  const found = env.post({ fn: 'roles', session: content, q: officer.member_id }).roles;
  assert.ok(found.length && found.every((r) => r.tab === 'officers'), 'Content moderators see club office bearers only');
  const row = found.find((r) => r.role === 'President' && r.rotary_year === officer.rotary_year).row;

  assert.match(env.post({ fn: 'rolesave', session: content, tab: 'officers', row, fields: { member_id: '9999999' }, reason: 'wrong person' }).error, /No one with member ID 9999999/);
  const r = env.post({ fn: 'rolesave', session: content, tab: 'officers', row, fields: { member_id: '7200001' }, reason: 'The club says 7200001 is President' });
  assert.ok(r.ok, r.error);
  const o = tab(env.main, 'officers').find((x) => x._row === row);
  assert.equal(o.member_id, '7200001');
  assert.equal(o.name, 'Rtn Real 7200001', 'the name follows the members list');
  assert.match(env.post({ fn: 'rolesave', session: content, tab: 'officers', row, fields: { role: 'Treasurer' }, reason: 'check' }).error, /President, Secretary or Executive Secretary/);

  // one President per club and year: end the old role first, then add
  const year = env.run('Core_rotaryYearOf', today());
  env.run('appendRow_', env.main, 'officers', { rotary_year: year, club_id: 'S-004', member_id: '7200001', name: 'Rtn Real 7200001', role: 'President' });
  const add = { club_id: 'S-004', rotary_year: year, role: 'President', member_id: '7200002' };
  assert.match(env.post({ fn: 'roleadd', session: content, fields: add, reason: 'new President' }).error, /already President/);
  const cur = env.post({ fn: 'roles', session: content, q: '7200001' }).roles.find((x) => x.rotary_year === year);
  assert.ok(env.post({ fn: 'roleend', session: content, tab: 'officers', row: cur.row, reason: 'Resigned in November' }).ok);
  assert.ok(env.main.rows('officers').find((x) => x.rotary_year === year && x.member_id === '7200001').ended_on);
  assert.ok(env.post({ fn: 'roleadd', session: content, fields: add, reason: 'Elected after the resignation' }).ok);
  assert.ok(env.post({ fn: 'roleadd', session: content, fields: { ...add, role: 'Executive Secretary', member_id: '7200001' }, reason: 'appointed' }).ok);
  assert.match(env.post({ fn: 'roleadd', session: content, fields: { ...add, rotary_year: '2019-20' }, reason: 'check' }).error, /Choose \d{4}-\d{2} or/);
  // an ended role is not published, and the role check no longer counts it
  const pub = data().officers.filter((x) => x.club_id === 'S-004' && x.rotary_year === year);
  assert.deepEqual(pub.filter((x) => x.role === 'President').map((x) => x.name), ['Rtn Real 7200002']);
  assert.ok(pub.some((x) => x.role === 'Executive Secretary'));

  // district roles: Members moderators only; an Assistant Governor's clubs and zone
  const ag = tab(env.main, 'functionaries').find((f) => /Assistant Governor/.test(f.role));
  assert.match(env.post({ fn: 'rolesave', session: content, tab: 'functionaries', row: ag._row, fields: { zone: 'Agra' }, reason: 'check' }).error, /Only Members moderators/);
  assert.match(env.post({ fn: 'rolesave', session: members, tab: 'functionaries', row: ag._row, fields: { ag_clubs: 'RC Agra North, RC Nowhere' }, reason: 'check' }).error, /Not in the club list: RC Nowhere/);
  const agr = env.post({ fn: 'rolesave', session: members, tab: 'functionaries', row: ag._row, fields: { ag_clubs: 'RC Agra North, S-029', zone: 'Kanpur' }, reason: 'New AG clubs for the year' });
  assert.ok(agr.ok, agr.error);
  const agRow = tab(env.main, 'functionaries').find((f) => f._row === ag._row);
  assert.equal(agRow.ag_clubs, 'RC Agra North, RC Brahmavarta Kanpur');
  assert.equal(agRow.zone, 'Kanpur');

  // role checks reach the desk for Members moderators
  env.run('checkRoles', true);
  const list = env.post({ fn: 'list', session: members });
  assert.equal(list.roles.checks.length, env.main.rows('role_checks').length);
  assert.deepEqual([...env.post({ fn: 'list', session: content }).roles.checks], []);
  assert.match(env.run('weeklySummary') ? env.mails.at(-1).body : '', /ROLES TO CHECK|WAITING/);
});

test('clubs and moderators: Administrators add, rename and close clubs; the forms follow; a new club is not quiet; moderators added on the desk', () => {
  const admin = signIn('ajay@example.com');
  const fields = { club_id: '98765', club_name: 'RC Agra Heritage', city: 'Agra', zone: 'Agra', charter_date: daysAgo(10) };
  assert.match(env.post({ fn: 'clubadd', session: signIn('meera@example.com'), fields, reason: 'chartered' }).error, /Only Administrators/);
  assert.match(env.post({ fn: 'clubadd', session: admin, fields: { ...fields, club_id: 'S-004' }, reason: 'check' }).error, /only digits/);
  assert.match(env.post({ fn: 'clubadd', session: admin, fields: { ...fields, club_name: 'RC Agra North' }, reason: 'check' }).error, /already in the club list/);
  const r = env.post({ fn: 'clubadd', session: admin, fields, reason: 'Chartered this month' });
  assert.ok(r.ok, r.error);
  const club = env.main.rows('clubs').find((c) => c.club_id === '98765');
  assert.equal(club.slug, 'agra-heritage');
  assert.equal(club.status, 'active');
  const ids = JSON.parse(env.props.get('FORM_IDS'));
  const clubList = () => env.forms[ids.activity].items.find((i) => i.title === Q.club).choices;
  assert.ok(clubList().includes('RC Agra Heritage'), 'the forms list the new club at once');
  const kabir = env.post({ fn: 'list', session: admin }).clubs;
  assert.ok(!kabir.some((c) => c.club_id === '98765'), 'a new club is not in Quiet clubs');

  // rename: the old name is kept, the web address stays
  assert.ok(env.post({ fn: 'clubsave', session: admin, club_id: '98765', fields: { club_name: 'RC Agra Heritage City' }, reason: 'Renamed by RI' }).ok);
  let c = env.main.rows('clubs').find((x) => x.club_id === '98765');
  assert.equal(c.club_name, 'RC Agra Heritage City');
  assert.equal(c.former_names, 'RC Agra Heritage');
  assert.equal(c.slug, 'agra-heritage');
  const undo = env.post({ fn: 'changes', session: admin }).changes.find((x) => x.tab === 'clubs' && x.action === 'club');
  assert.ok(env.post({ fn: 'undo', session: admin, id: undo.id }).ok);
  assert.equal(env.main.rows('clubs').find((x) => x.club_id === '98765').club_name, 'RC Agra Heritage');
  const added = env.post({ fn: 'changes', session: admin }).changes.find((x) => x.action === 'add club');
  assert.equal(added.can_undo, false);
  assert.match(env.post({ fn: 'undo', session: admin, id: added.id }).error, /close the club instead/);

  // close and merge: the active members move, with their club history
  addMember('7300001', { club_id: '98765' });
  assert.match(env.post({ fn: 'clubclose', session: admin, club_id: '98765', move_to: '98765', reason: 'check' }).error, /open club/);
  const close = env.post({ fn: 'clubclose', session: admin, club_id: '98765', move_to: 'S-004', reason: 'Merged with RC Agra North' });
  assert.ok(close.ok, close.error);
  assert.match(close.message, /1 member\(s\) moved to RC Agra North/);
  assert.equal(env.priv.rows('members_master').find((m) => m.member_id === '7300001').club_id, 'S-004');
  c = env.main.rows('clubs').find((x) => x.club_id === '98765');
  assert.equal(c.status, 'inactive');
  assert.equal(c.merged_into, 'S-004');
  assert.ok(!clubList().includes('RC Agra Heritage'), 'a closed club leaves the forms');
  // nobody is made active in a closed club by mistake
  addMember('7300002', { club_id: '98765', status: 'left' });
  const meera = signIn('meera@example.com');
  assert.match(env.post({ fn: 'membersave', session: meera, member_id: '7300002', fields: { status: 'active' }, reason: 'Left by mistake' }).error, /has closed: choose the club/);
  assert.ok(env.post({ fn: 'membersave', session: meera, member_id: '7300002', fields: { status: 'active', club_id: 'S-004' }, reason: 'Left by mistake' }).ok);

  // moderators: added on the desk, with zones; they can sign in at once; nobody takes themselves off
  const add = env.post({ fn: 'modsave', session: admin, row: '', fields: { type: 'Content', name: 'Bela Bareilly', email: 'Bela@Example.com', zone: 'Bareilly', active: 'TRUE' }, reason: 'Bareilly zone moderator' });
  assert.ok(add.ok, add.error);
  const bela = tab(env.main, 'moderators').find((m) => m.email === 'bela@example.com');
  assert.equal(bela.zone, 'Bareilly');
  assert.equal(bela.sheet_access, 'FALSE', 'the desk needs no Sheet access');
  assert.deepEqual([...env.post({ fn: 'list', session: signIn('bela@example.com') }).me.zones], ['Bareilly']);
  assert.match(env.post({ fn: 'modsave', session: admin, row: '', fields: { type: 'Content', name: 'Bela', email: 'bela@example.com' }, reason: 'check' }).error, /already a Content moderator/);
  assert.match(env.post({ fn: 'modsave', session: admin, row: '', fields: { type: 'Content', name: 'Z', email: 'z@example.com', zone: 'Delhi' }, reason: 'check' }).error, /areas from the list/);
  const me = tab(env.main, 'moderators').find((m) => m.email === 'ajay@example.com');
  assert.match(env.post({ fn: 'modsave', session: admin, row: me._row, fields: { active: 'FALSE' }, reason: 'check' }).error, /cannot take yourself off/);
  assert.ok(env.post({ fn: 'modsave', session: admin, row: bela._row, fields: { active: 'FALSE' }, reason: 'Stepped down' }).ok);
  assert.match(env.post({ fn: 'list', session: signIn('ajay@example.com') }).admin.moderators.find((m) => m.email === 'bela@example.com').active ? 'yes' : 'no', /no/);
});

test('the four daily updates: the status link gives when anything changed; the build runs at 9 am, 1 pm, 6 pm and 10 pm only then; Rebuild site now still within 30 minutes', () => {
  env.run('setSetting_', 'content_changed_at', '2026-11-18T05:00:00.000Z');
  const st = env.doGet({ mode: 'status', token });
  assert.equal(st.content_changed_at, '2026-11-18T05:00:00.000Z');
  assert.ok('rebuild_requested_at' in st);
  const yml = readFileSync(resolve(ROOT, '.github/workflows/build.yml'), 'utf8');
  assert.match(yml, /cron: "30 3,7,12,16 \* \* \*"/, '9 am, 1 pm, 6 pm and 10 pm India time');
  assert.match(yml, /\[ "\$CRON" = "30 3,7,12,16 \* \* \*" \] && \[ -n "\$changed" \]/);
  assert.match(yml, /cron: "\*\/15 \* \* \* \*"/, 'Rebuild site now is still checked every 15 minutes');
  // an approval not built 13 hours later: the owner is told once
  env.pages.buildInfo = { generated_at: '2026-11-17T00:00:00.000Z' };
  env.run('setSetting_', 'rebuild_requested_at', '');
  env.run('setSetting_', 'content_changed_at', new Date(Date.now() - 14 * 3600000).toISOString());
  const n = env.mails.length;
  assert.match(env.run('checkRebuild'), /^told/);
  assert.match(env.mails.at(-1).body, /four daily updates/);
  assert.equal(env.run('checkRebuild'), 'already told');
  assert.equal(env.mails.length, n + 1);
  env.run('setSetting_', 'content_changed_at', new Date(Date.now() - 2 * 3600000).toISOString());
  assert.equal(env.run('checkRebuild'), 'nothing to check', 'within 13 hours: still waiting for the next update');
});

test('the Sheet gets the new columns and the private change log; a death needs the club confirmed in the Sheet sidebar too', () => {
  const head = (ss, tab) => env.run('headers_', ss, tab);
  assert.ok(['charter_date', 'merged_into'].every((c) => head(env.main, 'clubs').includes(c)));
  assert.ok(head(env.main, 'officers').includes('ended_on') && head(env.main, 'functionaries').includes('ended_on'));
  assert.ok(['hidden_by', 'hidden_at'].every((c) => head(env.main, 'activities').includes(c)));
  assert.ok(head(env.main, 'moderators').includes('zone'));
  assert.ok(head(env.priv, 'change_log').includes('old_value'));
  assert.ok(!env.main.getSheetByName('change_log'), 'the change log holds members\' details: private Sheet only');
  assert.ok(env.main.rows('settings').some((x) => x.key === 'content_changed_at'));
  const sidebar = readFileSync(resolve(ROOT, 'apps-script/Sidebar.html'), 'utf8');
  assert.match(sidebar, /I have confirmed this with the club/);
});
