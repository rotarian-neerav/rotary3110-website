// Team lists (B13, owner 23–24 Nov 2026, decision 144): a separate Google Sheet for a coming year's district team and
// club office bearers. Each tab is checked and imported on its own; a list goes in only with no errors, never in part;
// further lists can follow; Withdraw this list only before its year starts. Check: Members moderators and
// Administrators; Import and Withdraw: Administrators.
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
const later = (n) => (n ? core.Core_nextRotaryYear(later(n - 1)) : YEAR);
let env;

const tab = (ss, t) => env.run('readTab_', ss, t);
const lists = () => env.made.get(env.props.get('TEAM_LISTS_ID'));
const district = () => lists().getSheetByName('District team');
const clubSheet = () => lists().getSheetByName('Club office bearers');
const add = (sheet, row) => { const h = sheet.data[0]; sheet.appendRow(h.map((k) => row[k] ?? '')); };
const statuses = (sheet) => lists().rows(sheet.name).map((r) => r.status);
const signIn = (email) => {
  env.post({ fn: 'code', email });
  const code = env.mails.filter((m) => m.to === email).at(-1).body.match(/\b(\d{6})\b/)[1];
  const r = env.post({ fn: 'signin', email, code });
  assert.ok(r.ok, r.error);
  return r.session;
};
const members = () => env.priv.rows('members_master').filter((m) => m.status === 'active' && m.is_rotarian === true);
const clubOf = (id) => env.main.rows('clubs').find((c) => c.club_id === id).club_name;
let admin;
let mem;

beforeEach(() => { if (env) env.quota.left = 100; });

before(() => {
  env = createGoogleEnv({ sampleJson: readFileSync(resolve(ROOT, 'sample/sample-data.json'), 'utf8') });
  env.load(bundleCode());
  env.run('setup');
  const sh = env.main.getSheetByName('moderators');
  const types = env.main.rows('moderators').map((r) => r.type);
  [['Members', 'Meera Members', 'meera@example.com'], ['Administrator', 'Anil Admin', 'anil@example.com']].forEach(([type, name, email]) => {
    const row = types.indexOf(type) + 2;
    sh.set(row, 2, name); sh.set(row, 3, email); sh.set(row, 4, 'TRUE');
  });
  admin = signIn('anil@example.com');
  mem = signIn('meera@example.com');
});

/* ---------- The rule (Core.js) ---------- */

test('the check: Ready, Ready with a note, or an Error per row; imported rows kept unless changed', () => {
  const master = [
    { member_id: '1', name: 'Rtn Asha Gupta', club_id: 'A', status: 'active' },
    { member_id: '2', name: 'Rtn Vivek Rao', club_id: 'B', status: 'active' },
    { member_id: '3', name: 'Rtn Gone', club_id: 'A', status: 'deceased' },
  ];
  const clubs = [{ club_id: 'A', club_name: 'RC Alpha', status: 'active' }, { club_id: 'B', club_name: 'RC Beta', status: 'active' }, { club_id: 'C', club_name: 'RC Closed', status: 'inactive' }];
  const functionaries = [{ rotary_year: '2024-25', page: 'teams', section: 'District Membership Team', committee: 'New Clubs', role: 'Chairman', member_id: '9' }];
  const officers = [{ rotary_year: '2027-28', club_id: 'A', role: 'Secretary', member_id: '2', name: 'Rtn Vivek Rao' }];
  const ctx = { year: '2026-27', master, clubs, functionaries, officers };
  const club = (rows) => plain(core.Core_teamListCheck('club', rows.map((r, i) => ({ _row: i + 2, ...r })), ctx));
  let c = club([
    { rotary_year: '2027-28', club: 'RC Alpha', role: 'President', member_id: '1', name: 'Asha Gupta' },
    { rotary_year: '2028-29', club: 'RC Alpha', role: 'President', member_id: '1' },
    { rotary_year: '2027-28', club: 'RC Nowhere', role: 'President', member_id: '1' },
    { rotary_year: '2027-28', club: 'RC Closed', role: 'President', member_id: '1' },
    { rotary_year: '2027-28', club: 'Alpha', role: 'Secretary', member_id: '1' },
    { rotary_year: '2027-28', club: 'RC Beta', role: 'President', member_id: '3' },
    { rotary_year: '2027-28', club: 'RC Beta', role: 'Treasurer', member_id: '99' },
    { rotary_year: '2027-28', club: 'RC Alpha', role: 'President', member_id: '2', name: 'Rtn Vivek Rao' },
  ]);
  const st = c.rows.map((r) => r.status);
  assert.equal(st[0], 'Error: two rows for RC Alpha President 2027-28 (rows 2 and 9)', 'the same club, role and year twice');
  assert.match(st[1], /^Error: Rotary year must be 2026-27 or 2027-28/, 'club office bearers: this year or next');
  assert.match(st[2], /^Error: Club "RC Nowhere" not recognised/);
  assert.match(st[3], /RC Closed is closed/);
  assert.match(st[4], /^Ready\. Note: replaces Rtn Vivek Rao, on record for this role/, 'a club named without "RC" is found');
  assert.match(st[5], /^Error: Rtn Gone is marked "deceased"/);
  assert.match(st[6], /^Error: Rotary member ID 99 is not in the members list\. Note: not President, Secretary or Executive Secretary/);
  assert.match(st[7], /the members list has Rtn Vivek Rao in RC Beta/);
  assert.equal(c.counts.errors, 7, 'both rows of the same club role are errors');
  // ready rows carry what will be written; the name comes from the members list
  c = club([{ rotary_year: '2027-28', club: 'RC Alpha', role: 'President', member_id: '1', name: 'Asha G.' }]);
  assert.equal(c.rows[0].state, 'note');
  assert.match(c.rows[0].status, /the members list has the name as Rtn Asha Gupta \(that is used\)/);
  assert.deepEqual(c.rows[0].write, { rotary_year: '2027-28', club_id: 'A', member_id: '1', name: 'Rtn Asha Gupta', role: 'President', contact_ok: false });
  // already on record: skipped, not an error
  c = club([{ rotary_year: '2027-28', club: 'RC Alpha', role: 'Secretary', member_id: '2' }]);
  assert.equal(c.rows[0].skip, true);

  const team = (rows) => plain(core.Core_teamListCheck('district', rows.map((r, i) => ({ _row: i + 2, ...r })), ctx));
  c = team([
    { rotary_year: '2029-30', team: 'Governor line', role: 'District Governor', member_id: '1' },
    { rotary_year: '2030-31', team: 'Governor line', role: 'District Governor', member_id: '2' },
    { rotary_year: '2027-28', team: 'District Membership Team', committee: 'New Clubs', role: 'Co-chairman', member_id: '2', order: 'first' },
    { rotary_year: '2027-28', team: 'Assistant Governors', role: 'Assistant Governor', member_id: '2', ag_clubs: 'RC Alpha, Beta, RC Gamma' },
    { rotary_year: '2027-28', team: 'District Membershp Team', role: 'Chairman', member_id: '1' },
    { rotary_year: '2027-28', team: 'District Membership Team', committee: 'New Clubs', role: 'Chairman', member_id: '1', order: '2' },
  ]);
  assert.equal(c.rows[0].state, 'note', 'a Governor up to three years ahead');
  assert.match(c.rows[0].status, /a team not used before.*a role not used before/);
  assert.equal(c.rows[0].write.page, 'leadership');
  assert.match(c.rows[1].status, /^Error: Rotary year must be 2026-27 to 2029-30/);
  assert.match(c.rows[2].status, /Order must be a number/);
  assert.match(c.rows[3].status, /club\(s\) not recognised: RC Gamma/);
  assert.match(c.rows[4].status, /a team not used before: check the spelling/);
  assert.equal(c.rows[5].state, 'ready');
  assert.deepEqual([c.rows[5].write.page, c.rows[5].write.sort_order, c.rows[5].write.club_id], ['teams', 2, 'A'], 'the team keeps its page');
  // imported rows stay as they are; one changed since is reported and never applied
  const row = { _row: 2, rotary_year: '2027-28', team: 'District Membership Team', committee: 'New Clubs', role: 'Chairman', member_id: '1' };
  const key = core.Core_teamRowKey('district', row);
  c = team([{ ...row, status: 'Imported', list: 'D1 ' + key }, { ...row, member_id: '2', status: 'Imported', list: 'D1 ' + key }]);
  assert.deepEqual(c.rows.map((r) => r.state), ['imported', 'changed']);
  assert.match(c.rows[1].status, /^Changed after import: not applied.*withdraw list D1/);
  assert.deepEqual([c.counts.imported, c.counts.changed, c.counts.ready], [1, 1, 0]);
  // the fingerprint follows the rows not yet imported
  const a = team([row]).fingerprint;
  assert.notEqual(team([{ ...row, role: 'Co-chairman' }]).fingerprint, a);
  assert.equal(team([row]).fingerprint, a);
});

/* ---------- The Sheet ---------- */

test('Upgrade Sheet makes the Team lists Sheet next to the main Sheet, once, with its tabs and drop-downs', () => {
  assert.equal(env.made.size, 1, 'made by setup');
  const ss = lists();
  assert.equal(ss.getName(), '3110Website – Team lists');
  assert.equal(env.moved.get(ss.getId()), 'PARENT', 'moved from My Drive into the folder that holds the Sheet');
  assert.deepEqual(ss.getSheets().map((s) => s.name), ['Instructions', 'District team', 'Club office bearers', 'Roles used', 'Clubs']);
  assert.deepEqual(ss.rows('District team').length, 0);
  assert.deepEqual(district().data[0], ['rotary_year', 'team', 'committee', 'role', 'member_id', 'name', 'order', 'ag_clubs', 'status', 'list']);
  assert.deepEqual(clubSheet().data[0], ['rotary_year', 'club', 'role', 'member_id', 'name', 'status', 'list']);
  assert.ok(ss.rows('Roles used').some((r) => r.team === 'Assistant Governors'));
  assert.ok(ss.rows('Roles used').some((r) => r.role === 'District Governor'), 'roles without Elect or Nominee');
  assert.ok(!ss.rows('Roles used').some((r) => / (Elect|Nominee)$/.test(r.role)));
  assert.equal(ss.rows('Clubs').length, env.main.rows('clubs').filter((c) => c.status === 'active').length);
  assert.match(ss.rows('Instructions').map((r) => r['How to fill in the Team lists']).join(' '), /never phone numbers or emails/);
  const s = Object.fromEntries(env.main.rows('settings').map((r) => [r.key, r.value]));
  assert.equal(s.team_lists_url, ss.getUrl());
  // the drop-downs: a new team or role name is kept (the check notes it); a club must be a real one
  district().set(5, 2, 'A Brand New Team');
  assert.throws(() => clubSheet().set(5, 2, 'RC Nowhere'), /violates the data validation rules/);
  clubSheet().set(5, 2, 'RC Agra');
  district().data.splice(1);
  clubSheet().data.splice(1);
  // Upgrade Sheet again: the same Sheet, brought up to date
  env.run('upgradeSheet');
  assert.equal(env.made.size, 1);
});

/* ---------- The desk ---------- */

test('the desk: Members moderators check, only Administrators import; a list goes in whole, only as checked, with no errors', () => {
  const m = members();
  assert.deepEqual(plain(env.post({ fn: 'teamlists', session: mem })).made, true);
  assert.equal(env.post({ fn: 'teamlists', session: mem }).canImport, false);
  assert.equal(env.post({ fn: 'teamlists', session: admin }).canImport, true);
  add(district(), { rotary_year: NEXT, team: 'Assistant Governors', role: 'Assistant Governor', member_id: m[10].member_id, name: m[10].name, ag_clubs: clubOf(m[10].club_id) });
  add(district(), { rotary_year: NEXT, team: 'District Membership Team', role: 'Chairman', committee: 'New Club Development', member_id: m[11].member_id, name: m[11].name });
  add(district(), { rotary_year: later(3), team: 'Governor line', role: 'District Governor', member_id: m[12].member_id, name: m[12].name });
  add(district(), { rotary_year: NEXT, team: 'District Membership Team', role: 'Co-chairman', committee: 'New Club Development', member_id: '1234', name: 'Rtn Nobody' });

  assert.match(env.post({ fn: 'teamimport', session: admin, list: 'district' }).error, /changed since it was checked/, 'not checked yet');
  let r = env.post({ fn: 'teamcheck', session: mem, list: 'district' });
  assert.ok(r.ok, r.error);
  assert.match(r.message, /^District team: 3 ready.*1 with an error\. Correct the errors/);
  assert.deepEqual(statuses(district()).map((s) => s.split(/[.:]/)[0]), ['Ready', 'Ready', 'Ready', 'Error']);
  assert.match(env.post({ fn: 'teamimport', session: mem, list: 'district' }).error, /Only Administrators/);
  assert.match(env.post({ fn: 'teamimport', session: admin, list: 'district' }).error, /1 row\(s\) with an error.*Nothing was imported/);
  const before = env.main.rows('functionaries').length;
  // corrected in the Sheet but not checked again: refused
  const bad = district().data.length;
  district().set(bad, 5, m[13].member_id);
  district().set(bad, 6, m[13].name);
  assert.match(env.post({ fn: 'teamimport', session: admin, list: 'district' }).error, /changed since it was checked/);
  assert.equal(env.main.rows('functionaries').length, before, 'nothing went in');
  assert.ok(env.post({ fn: 'teamcheck', session: mem, list: 'district' }).ok);
  assert.equal(env.post({ fn: 'teamlists', session: admin }).lists[0].checked, true);
  r = env.post({ fn: 'teamimport', session: admin, list: 'district' });
  assert.ok(r.ok, r.error);
  assert.match(r.message, /^Imported list D1: 4 row\(s\)/);
  const added = env.main.rows('functionaries').filter((f) => f.list_id === 'D1');
  assert.equal(added.length, 4);
  assert.deepEqual(added.map((f) => [f.rotary_year, f.section, f.page]).slice(0, 3),
    [[NEXT, 'Assistant Governors', 'leadership'], [NEXT, 'District Membership Team', 'teams'], [later(3), 'Governor line', 'leadership']]);
  assert.ok(statuses(district()).every((s) => /^Imported .* by Anil Admin \(list D1\)$/.test(s)));
  assert.ok(env.main.rows('moderator_log').some((l) => l.action === 'imported list' && l.item === 'D1'));
  // on the website as coming roles
  const d = env.run('publicData_');
  assert.ok(d.functionaries.some((f) => f.name === m[12].name && f.rotary_year === later(3)));

  // a further list: only the new rows go in; an imported row changed since is reported, not applied
  add(district(), { rotary_year: NEXT, team: 'District Membership Team', role: 'Co-chairman', committee: 'New Club Development', member_id: m[14].member_id, name: m[14].name });
  district().set(3, 4, 'Vice Chairman');
  r = env.post({ fn: 'teamcheck', session: mem, list: 'district' });
  assert.match(r.message, /1 ready.*0 with an error, 3 imported before, 1 changed after import \(not applied\)/);
  assert.match(statuses(district())[1], /^Changed after import: not applied/);
  r = env.post({ fn: 'teamimport', session: admin, list: 'district' });
  assert.match(r.message, /^Imported list D2: 1 row\(s\)/);
  assert.ok(!env.main.rows('functionaries').some((f) => f.role === 'Vice Chairman'), 'the changed row was not applied');
  assert.ok(env.post({ fn: 'teamcheck', session: mem, list: 'district' }).ok);
  assert.match(env.post({ fn: 'teamimport', session: admin, list: 'district' }).error, /Nothing new to import/);
});

test('Withdraw this list: an Administrator takes a whole list off again, only before its year starts', () => {
  const imported = env.post({ fn: 'teamlists', session: admin }).imported;
  assert.deepEqual(imported.map((x) => [x.id, x.rows, x.withdrawable]), [['D1', 4, true], ['D2', 1, true]]);
  assert.match(env.post({ fn: 'teamwithdraw', session: mem, id: 'D2' }).error, /Only Administrators/);
  const r = env.post({ fn: 'teamwithdraw', session: admin, id: 'D2' });
  assert.ok(r.ok, r.error);
  assert.match(r.message, /^Withdrew list D2: 1 row\(s\) taken off/);
  assert.ok(!env.main.rows('functionaries').some((f) => f.list_id === 'D2'));
  assert.equal(env.main.rows('functionaries').filter((f) => f.list_id === 'D1').length, 4, 'the other list stays');
  assert.match(statuses(district()).at(-1), /^Withdrawn .* by Anil Admin \(list D2\): check and import again, or delete the row$/);
  // a withdrawn row is a new row again
  assert.match(env.post({ fn: 'teamcheck', session: mem, list: 'district' }).message, /^District team: 1 ready/);

  // a list for this year cannot be withdrawn: its year has started
  const m = members();
  const clubId = m[20].club_id;
  add(clubSheet(), { rotary_year: YEAR, club: clubOf(clubId), role: 'Executive Secretary', member_id: m[20].member_id, name: m[20].name });
  assert.ok(env.post({ fn: 'teamcheck', session: mem, list: 'club' }).ok);
  assert.match(env.post({ fn: 'teamimport', session: admin, list: 'club' }).message, /^Imported list C1: 1 row/);
  assert.equal(env.post({ fn: 'teamlists', session: admin }).imported.find((x) => x.id === 'C1').withdrawable, false);
  assert.match(env.post({ fn: 'teamwithdraw', session: admin, id: 'C1' }).error, /has started: change people one by one/);
  assert.match(env.post({ fn: 'teamwithdraw', session: admin, id: 'X9' }).error, /No imported list X9/);
});

test('club office bearers: next year\'s go in as Elects, may send for their club, and act from 1 July', () => {
  const m = members().filter((x) => x.club_id === members()[30].club_id);
  const clubId = m[0].club_id;
  add(clubSheet(), { rotary_year: NEXT, club: clubOf(clubId), role: 'President', member_id: m[0].member_id, name: m[0].name });
  add(clubSheet(), { rotary_year: NEXT, club: clubOf(clubId), role: 'Secretary', member_id: m[1].member_id, name: m[1].name });
  assert.match(env.post({ fn: 'teamcheck', session: admin, list: 'club' }).message, /^Club office bearers: 2 ready.*1 imported before/);
  assert.match(env.post({ fn: 'teamimport', session: admin, list: 'club' }).message, /^Imported list C2: 2 row/);
  const rows = env.main.rows('officers').filter((o) => o.list_id === 'C2');
  assert.deepEqual(rows.map((o) => [o.rotary_year, String(o.club_id), o.role]), [[NEXT, clubId, 'President'], [NEXT, clubId, 'Secretary']]);
  const officers = tab(env.main, 'officers');
  const coming = core.Core_comingOfficers(officers, YEAR, null, true);
  assert.equal(coming[clubId].President.name, m[0].name, 'accepted as a sender for the club from now on');
  assert.equal(core.Core_actingOfficers(officers, NEXT, null, true)[clubId].President.name, m[0].name, 'acts from 1 July');
});

test('one import at a time; a long list goes in with one write, adding rows to the tab when it is full', () => {
  env.lock.held = true;
  assert.match(env.post({ fn: 'teamimport', session: admin, list: 'club' }).error, /Another import is running/);
  assert.match(env.post({ fn: 'teamwithdraw', session: admin, id: 'D1' }).error, /Another import is running/);
  env.lock.held = false;
  const m = members();
  const clubs = [...new Set(m.map((x) => x.club_id))].slice(0, 40);
  for (const id of clubs) {
    const inClub = m.filter((x) => x.club_id === id);
    add(clubSheet(), { rotary_year: NEXT, club: clubOf(id), role: 'Executive Secretary', member_id: inClub[0].member_id, name: inClub[0].name });
  }
  const sh = env.main.getSheetByName('officers');
  sh.maxRowCount = sh.data.length; // the tab is full, like a Sheet with no empty rows left
  assert.ok(env.post({ fn: 'teamcheck', session: admin, list: 'club' }).ok);
  const r = env.post({ fn: 'teamimport', session: admin, list: 'club' });
  assert.ok(r.ok, r.error);
  assert.match(r.message, /^Imported list C3: \d+ row/);
  assert.ok(env.main.rows('officers').filter((o) => o.list_id === 'C3').length >= 30);
  assert.equal(env.lock.held, false, 'the lock is let go');
});
