// The rules shared with the Google Sheet script (apps-script/Core.js).
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { core, plain } from '../../lib/core.mjs';

const sample = JSON.parse(readFileSync(new URL('../../sample/sample-data.json', import.meta.url), 'utf8'));
const build = () => plain(core.Core_buildPublicData(sample.main, '2026-10-13T00:00:00Z'));

function member(over = {}) {
  return {
    member_id: '1234567', name: 'Rtn Test Person', club_id: 'S-001', is_rotarian: true, status: 'active', mobile: '98765 43210',
    email: 'test@example.com', dob: '1975-10-14', marriage_date: '2001-02-03', directory_ok: true, contact_ok: false,
    photo_ok: false, birthday_ok: true, profession: 'Lawyer', area: 'Agra', description: 'Helps people.', website: '',
    spotlight_ok: false, photo_file: '', photo_approved: false, listing_approved: true, public_key: 'kabc', ...over,
  };
}
const makeKey = (() => { let n = 0; return () => 'knew' + n++; })();

test('dates: day and month never carry a year', () => {
  assert.equal(core.Core_dayMonth('1975-10-14'), '10-14');
  assert.equal(core.Core_dayMonth('14-10'), '10-14'); // typed in India as DD-MM
  assert.equal(core.Core_dayMonth(new Date('1980-03-05T00:00:00+05:30')), '03-05');
  assert.equal(core.Core_dayMonth('31-13'), '');
  assert.equal(core.Core_isoDate('05/09/2026'), '2026-09-05');
});

test('mobile numbers are normalised to Indian WhatsApp format', () => {
  assert.equal(core.Core_mobile('98765 43210'), '919876543210');
  assert.equal(core.Core_mobile('+91-98765-43210'), '919876543210');
  assert.equal(core.Core_mobile('09876543210'), '919876543210');
  assert.equal(core.Core_mobile('12345'), '');
});

test('public members: only approved, active, opted-in Rotarians, only ticked fields, no year', () => {
  const r = plain(core.Core_buildMembersPublic([
    member(),
    member({ member_id: '2', listing_approved: false }), // not yet approved by a moderator
    member({ member_id: '3', status: 'deceased', public_key: 'kdead' }),
    member({ member_id: '4', is_rotarian: false }), // a spouse who is not a member
    member({ member_id: '5', directory_ok: false, birthday_ok: false, photo_ok: false }), // opted in to nothing
    member({ member_id: '6', directory_ok: false, birthday_ok: true }), // birthday only
  ], [], makeKey));
  assert.deepEqual(r.members.map((m) => m.member_id), ['1234567', '6']);
  const [a, b] = r.members;
  assert.equal(a.birthday, '10-14');
  assert.equal(a.contact_link, '', 'contact link needs its own tick');
  assert.equal(b.profession, '', 'no directory details without directory consent');
  assert.equal(b.birthday, '10-14');
  assert.ok(!JSON.stringify(r.members).includes('1975'), 'birth year must not leak');
  assert.ok(!JSON.stringify(r.members).includes('@'), 'email must not leak');
  assert.deepEqual(r.inactiveKeys, ['kdead']);
});

test('contact link and photo only with their own consent', () => {
  const r = plain(core.Core_buildMembersPublic([
    member({ contact_ok: true, photo_ok: true, photo_file: 'drive:abc', photo_approved: false }),
  ], [], makeKey));
  assert.equal(r.members[0].contact_link, 'https://wa.me/919876543210');
  assert.equal(r.members[0].photo_file, '', 'photo needs moderator approval too');
});

test('anniversaries need both spouses; non-member spouse shown by first name; deceased stops greetings', () => {
  const a = member({ member_id: 'A' });
  const spouse = member({ member_id: 'T-1', is_rotarian: false, name: 'Meera Sharma' });
  const b = member({ member_id: 'B', club_id: 'S-002', name: 'Rtn Anil Sharma' });
  const gone = member({ member_id: 'T-2', is_rotarian: false, status: 'deceased' });
  const couples = [
    { couple_id: 'C1', person_a_id: 'A', person_b_id: 'T-1', anniversary: '16-10', a_consent: true, b_consent: true, status: 'active' },
    { couple_id: 'C2', person_a_id: 'A', person_b_id: 'B', anniversary: '16-10', a_consent: true, b_consent: false, status: 'awaiting_spouse' },
    { couple_id: 'C3', person_a_id: 'A', person_b_id: 'B', anniversary: '16-10', a_consent: true, b_consent: false, status: 'active' },
    { couple_id: 'C4', person_a_id: 'A', person_b_id: 'T-2', anniversary: '16-10', a_consent: true, b_consent: true, status: 'active' },
    { couple_id: 'C5', person_a_id: 'B', person_b_id: 'A', anniversary: '20-10', a_consent: true, b_consent: true, status: 'active', couple_photo_file: 'drive:x', couple_photo_ok_a: true, couple_photo_ok_b: false, couple_photo_approved: true },
  ];
  const r = plain(core.Core_buildMembersPublic([a, spouse, b, gone], couples, makeKey));
  assert.deepEqual(r.couples.map((c) => c.couple_key), ['C1', 'C5']);
  assert.equal(r.couples[0].person_b_name, 'Meera', 'non-member spouse: first name only');
  assert.equal(r.couples[0].person_b_club_id, '');
  assert.equal(r.couples[0].anniversary, '10-16');
  assert.equal(r.couples[1].person_a_club_id, 'S-002', 'couples in different clubs keep both clubs');
  assert.equal(r.couples[1].person_b_club_id, 'S-001');
  assert.equal(r.couples[1].couple_photo_file, '', 'couple photo needs both spouses');
});

test('public data: no pending/rejected rows, no member IDs, activities need photo or link', () => {
  const d = build();
  const titles = d.activities.map((a) => a.title).join('|');
  assert.ok(!titles.includes('PENDING-SAMPLE'));
  assert.ok(!titles.includes('REJECTED-SAMPLE'));
  assert.ok(!titles.includes('NOPHOTO-SAMPLE'));
  assert.ok(d.skipped_activities.length === 1);
  assert.ok(!d.events.some((e) => e.title.includes('PENDING-SAMPLE')));
  assert.ok(d.members.every((m) => !('member_id' in m)));
  assert.ok(!JSON.stringify(d).includes('submitter'), 'submitter details never leave the Sheet');
  assert.ok(!JSON.stringify(d).includes('moderator.'), 'moderator emails never leave the Sheet');
});

test('the sample public data passes the privacy check', () => {
  assert.deepEqual(plain(core.Core_validatePublic(build())), []);
});

test('privacy check catches each kind of problem', () => {
  const cases = [
    ['birth year in a birthday', (d) => { d.members[0].birthday = '1975-10-14'; }, 'day and month only'],
    ['member not opted in', (d) => { Object.assign(d.members[0], { directory_ok: false, photo_ok: false, birthday_ok: false, profession: '', area: '', description: '', website: '', birthday: '', photo: '', contact_link: '' }); }, 'not opted in'],
    ['contact link without consent', (d) => { const m = d.members.find((x) => x.directory_ok); m.contact_ok = false; m.contact_link = 'https://wa.me/919876543210'; }, 'contact link without consent'],
    ['photo without consent', (d) => { const m = d.members[0]; m.photo_ok = false; m.photo = 'drive:abc'; }, 'photo without photo consent'],
    ['anniversary without both spouses', (d) => { d.couples[0].both_consented = false; }, 'both spouses'],
    ['greeting for someone deceased', (d) => { d.inactive_keys = [d.couples[0].person_a_key]; }, 'deceased'],
    ['phone number in a description', (d) => { d.activities[0].description += ' Call 98765 43210'; }, 'phone number'],
    ['email in a title', (d) => { d.events[0].title += ' (write to a.b@example.com)'; }, 'email address'],
    ['member ID published', (d) => { d.members[0].member_id = '1234567'; }, 'member ID'],
    ['marriage year in a couple', (d) => { d.couples[0].anniversary = '2001-10-16'; }, 'anniversary must be day and month only'],
  ];
  for (const [label, breakIt, expected] of cases) {
    const d = build();
    breakIt(d);
    const errors = plain(core.Core_validatePublic(d));
    assert.ok(errors.some((e) => e.includes(expected)), `${label}: expected an error mentioning "${expected}", got ${JSON.stringify(errors.slice(0, 3))}`);
  }
});

test('matching a request to a member: ID first, then mobile + club', () => {
  const master = [member({ member_id: '111', mobile: '9876543210', club_id: 'S-001' }), member({ member_id: '222', mobile: '9811111111', club_id: 'S-002' })];
  assert.equal(core.Core_matchMember({ member_id: '222' }, master), 1);
  assert.equal(core.Core_matchMember({ mobile: '+91 98765 43210', club_id: 'S-001' }, master), 0);
  assert.equal(core.Core_matchMember({ mobile: '9876543210', club_id: 'S-009' }, master), -1);
});

test('duplicate check: same club, within a day, similar title', () => {
  const existing = [{ id: 'A1', club_id: 'S-001', date: '2026-09-10', title: 'Free eye camp at Mathura', status: 'approved' }];
  assert.equal(core.Core_findDuplicate({ id: 'A2', club_id: 'S-001', date: '2026-09-11', title: 'Eye camp Mathura' }, existing), 'A1');
  assert.equal(core.Core_findDuplicate({ id: 'A2', club_id: 'S-002', date: '2026-09-11', title: 'Eye camp Mathura' }, existing), '');
  assert.equal(core.Core_findDuplicate({ id: 'A2', club_id: 'S-001', date: '2026-09-20', title: 'Eye camp Mathura' }, existing), '');
});

test('48-hour reminder finds only overdue pending rows', () => {
  const now = Date.parse('2026-10-13T12:00:00Z');
  const rows = [
    { status: 'pending', submitted_at: '2026-10-10T12:00:00Z' },
    { status: 'pending', submitted_at: '2026-10-12T12:00:00Z' },
    { status: 'approved', submitted_at: '2026-10-01T12:00:00Z' },
  ];
  assert.equal(core.Core_overdue(rows, now, 48).length, 1);
});
