// The three monthly recognitions from the brief (section 6).
//
// 1. Most active per member: activities in the month divided by members; at least 3 activities to qualify.
//    A joint activity counts only for the club that submitted it.
// 2. Most consistent: the club that posted in the most months of the Rotary year so far
//    (ties broken by total activities).
// 3. Story of the month: the activity the moderators ticked, dated in that month.

export const MIN_ACTIVITIES = 3;

/** "2026-09" -> the Rotary year months up to and including it: ["2026-07", "2026-08", "2026-09"] */
export function rotaryYearMonthsUpTo(month) {
  const [y, m] = month.split('-').map(Number);
  const startYear = m >= 7 ? y : y - 1;
  const months = [];
  for (let yy = startYear, mm = 7; yy < y || (yy === y && mm <= m); mm === 12 ? ((mm = 1), yy++) : mm++) {
    months.push(`${yy}-${String(mm).padStart(2, '0')}`);
  }
  return months;
}

export function previousMonth(todayIso) {
  const [y, m] = todayIso.split('-').map(Number);
  return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, '0')}`;
}

export function monthlyRecognition(activities, clubs, month) {
  const clubById = Object.fromEntries(clubs.map((c) => [c.club_id, c]));
  const inMonth = activities.filter((a) => a.date.startsWith(month));

  const perClub = {};
  for (const a of inMonth) perClub[a.club_id] = (perClub[a.club_id] || 0) + 1;
  const active = Object.entries(perClub)
    .filter(([id, n]) => n >= MIN_ACTIVITIES && clubById[id]?.member_count > 0)
    .map(([id, n]) => ({ club: clubById[id], count: n, members: clubById[id].member_count, perMember: n / clubById[id].member_count }))
    .sort((a, b) => b.perMember - a.perMember || b.count - a.count);
  const mostActive = active.length ? active.filter((x) => x.perMember === active[0].perMember) : [];

  const months = rotaryYearMonthsUpTo(month);
  const posted = {};
  for (const a of activities) {
    const am = a.date.slice(0, 7);
    if (!months.includes(am)) continue;
    posted[a.club_id] ??= { months: new Set(), total: 0 };
    posted[a.club_id].months.add(am);
    posted[a.club_id].total++;
  }
  const consistent = Object.entries(posted)
    .filter(([id]) => clubById[id])
    .map(([id, p]) => ({ club: clubById[id], months: p.months.size, total: p.total }))
    .sort((a, b) => b.months - a.months || b.total - a.total);
  const mostConsistent = consistent.length
    ? consistent.filter((x) => x.months === consistent[0].months && x.total === consistent[0].total)
    : [];

  const story = inMonth.filter((a) => a.story_of_month).sort((a, b) => (b.approved_at || '').localeCompare(a.approved_at || ''));

  return { month, monthsCounted: months.length, mostActive, mostConsistent, story: story.slice(0, 1), runnersUp: active.slice(mostActive.length, mostActive.length + 3) };
}
