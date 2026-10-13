// Recognition maths, checked against answers worked out by hand.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { monthlyRecognition, previousMonth, rotaryYearMonthsUpTo } from '../../lib/recognition.mjs';

const clubs = [
  { club_id: 'A', name: 'Small club', member_count: 20 },
  { club_id: 'B', name: 'Big club', member_count: 64 },
  { club_id: 'C', name: 'Tiny club', member_count: 10 },
  { club_id: 'D', name: 'Steady club', member_count: 30 },
];
const act = (club_id, date, extra = {}) => ({ club_id, date, ...extra });

test('Rotary year months run July to the given month', () => {
  assert.deepEqual(rotaryYearMonthsUpTo('2026-09'), ['2026-07', '2026-08', '2026-09']);
  assert.deepEqual(rotaryYearMonthsUpTo('2027-01').length, 7);
  assert.equal(rotaryYearMonthsUpTo('2026-07').length, 1);
  assert.equal(previousMonth('2026-10-13'), '2026-09');
  assert.equal(previousMonth('2027-01-05'), '2026-12');
});

test('most active per member: needs 3 activities; highest activities ÷ members wins', () => {
  const activities = [
    act('A', '2026-09-01'), act('A', '2026-09-10'), act('A', '2026-09-20'), // 3 / 20 = 0.15
    act('B', '2026-09-02'), act('B', '2026-09-03'), act('B', '2026-09-04'), act('B', '2026-09-05'), // 4 / 64 = 0.0625
    act('C', '2026-09-06'), act('C', '2026-09-07'), // 2 / 10 = 0.2 but only 2 activities: does not qualify
  ];
  const r = monthlyRecognition(activities, clubs, '2026-09');
  assert.deepEqual(r.mostActive.map((w) => w.club.club_id), ['A']);
  assert.equal(r.mostActive[0].perMember, 0.15);
  assert.deepEqual(r.runnersUp.map((w) => w.club.club_id), ['B']);
});

test('most consistent: most months posted this Rotary year, ties broken by total', () => {
  const activities = [
    act('D', '2026-07-05'), act('D', '2026-08-05'), act('D', '2026-09-05'), // 3 months
    act('B', '2026-07-01'), act('B', '2026-09-01'), act('B', '2026-09-02'), act('B', '2026-09-03'), // 2 months
    act('A', '2026-06-30'), act('A', '2026-08-01'), // June is last Rotary year: only 1 month counts
  ];
  const r = monthlyRecognition(activities, clubs, '2026-09');
  assert.deepEqual(r.mostConsistent.map((w) => w.club.club_id), ['D']);
  assert.equal(r.mostConsistent[0].months, 3);
  assert.equal(r.monthsCounted, 3);
});

test("story of the month: the moderators' tick, dated in that month", () => {
  const activities = [
    act('A', '2026-08-30', { story_of_month: true, id: 'aug' }),
    act('B', '2026-09-15', { story_of_month: true, id: 'sep', approved_at: '2026-09-16' }),
    act('C', '2026-09-20', { id: 'other' }),
  ];
  const r = monthlyRecognition(activities, clubs, '2026-09');
  assert.deepEqual(r.story.map((s) => s.id), ['sep']);
});

test('a month with no activity gives empty results, not errors', () => {
  const r = monthlyRecognition([], clubs, '2026-09');
  assert.deepEqual([r.mostActive, r.mostConsistent, r.story], [[], [], []]);
});
