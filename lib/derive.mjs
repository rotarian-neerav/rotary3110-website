// Shapes the public data into what the pages need: clubs with their activities, events split
// into upcoming and past, teams as a tree, recognitions, search indexes, and so on.

import { monthlyRecognition, previousMonth } from './recognition.mjs';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const MONTHS_SHORT = MONTHS.map((m) => m.slice(0, 3));

export const themeSlug = (t) => t.toLowerCase().replace(/[^a-z]+/g, '-').replace(/^-|-$/g, '');

/** Today's date in India, as YYYY-MM-DD. SITE_TODAY can fix it for tests. */
export function todayIST(override) {
  if (override) return override;
  const d = new Date(Date.now() + 5.5 * 3600 * 1000);
  return d.toISOString().slice(0, 10);
}

export function formatDate(iso) {
  if (!iso) return '';
  const [y, m, d] = iso.split('-').map(Number);
  return `${d} ${MONTHS_SHORT[m - 1]} ${y}`;
}

export function formatMonth(ym) {
  const [y, m] = ym.split('-').map(Number);
  return `${MONTHS[m - 1]} ${y}`;
}

export function formatDayMonth(md) {
  const [m, d] = md.split('-').map(Number);
  return `${d} ${MONTHS_SHORT[m - 1]}`;
}

function img(media, ref) {
  return (ref && media.images[ref]) || null;
}

// Order of sections on the District Leadership page
const LEADERSHIP_ORDER = ['Governor line', "Governor's Office Team", 'Assistant Governors', 'District Counsellors', 'College of Governors'];

export function derive(data, media, todayOverride) {
  const today = todayIST(todayOverride);
  const rotaryYear = data.site.rotary_year;
  const clubs = data.clubs.map((c) => ({ ...c, activities: [], officers: [], url: `/clubs/${c.slug}/` }));
  const clubById = Object.fromEntries(clubs.map((c) => [c.club_id, c]));
  const clubName = (id) => clubById[id]?.name || '';

  const memberByKey = Object.fromEntries(data.members.map((m) => [m.public_key, m]));

  const activities = data.activities
    .map((a) => ({
      ...a,
      url: `/activities/${a.id.toLowerCase()}/`,
      club: clubById[a.club_id],
      partners: a.partner_clubs.map((id) => clubById[id]).filter(Boolean),
      themeSlug: themeSlug(a.theme),
      dateLabel: formatDate(a.date),
      images: a.photos.map((p) => img(media, p)).filter(Boolean),
    }))
    .sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id));
  const activityById = Object.fromEntries(activities.map((a) => [a.id, a]));
  for (const a of activities) {
    a.club?.activities.push(a);
    for (const p of a.partners) p.activities.push(a);
  }

  for (const o of data.officers) {
    if (o.rotary_year !== rotaryYear) continue;
    clubById[o.club_id]?.officers.push({ ...o, image: img(media, o.photo) });
  }

  const events = data.events
    .map((e) => ({
      ...e,
      url: `/events/${e.id.toLowerCase()}/`,
      ics: `/events/${e.id.toLowerCase()}.ics`,
      dateLabel: formatDate(e.start_date) + (e.end_date && e.end_date !== e.start_date ? ` – ${formatDate(e.end_date)}` : ''),
      report: activityById[e.report_activity_id] || null,
      isPast: (e.end_date || e.start_date) < today,
    }))
    .sort((a, b) => a.start_date.localeCompare(b.start_date));
  const upcomingEvents = events.filter((e) => !e.isPast);
  const pastEvents = events.filter((e) => e.isPast).reverse();

  const magazines = data.magazines
    .map((m) => ({
      ...m,
      label: formatMonth(m.issue_month),
      href: media.pdfs[m.file] || m.pdf_url,
      external: !media.pdfs[m.file],
      image: img(media, m.cover),
    }))
    .sort((a, b) => b.issue_month.localeCompare(a.issue_month));
  const magazinesByYear = [];
  for (const m of magazines) {
    const y = m.issue_month.slice(0, 4);
    let group = magazinesByYear.find((g) => g.year === y);
    if (!group) magazinesByYear.push((group = { year: y, issues: [] }));
    group.issues.push(m);
  }

  const messages = data.messages
    .map((m) => ({ ...m, image: img(media, m.photo), dateLabel: formatDate(m.date) }))
    .sort((a, b) => Number(b.featured) - Number(a.featured) || b.date.localeCompare(a.date));

  // People with roles (leadership + teams), grouped so each person appears once with all roles
  const roles = data.functionaries.map((f) => ({ ...f, club: clubById[f.club_id], image: img(media, f.photo) }));
  const years = [...new Set(roles.map((r) => r.rotary_year))].sort().reverse();

  function leadershipFor(year) {
    const rows = roles.filter((r) => r.page === 'leadership' && r.rotary_year === year);
    return LEADERSHIP_ORDER.map((section) => {
      let people = rows.filter((r) => r.section === section);
      if (!people.length) return null;
      if (section === 'College of Governors') people = [...people].sort((a, b) => b.term.localeCompare(a.term));
      const groupKey = section === 'Assistant Governors' ? 'zone' : 'committee';
      const groups = [];
      for (const p of people) {
        const label = p[groupKey] || '';
        let g = groups.find((x) => x.label === label);
        if (!g) groups.push((g = { label, people: [] }));
        g.people.push(p);
      }
      if (section === 'Assistant Governors') groups.sort((a, b) => a.label.localeCompare(b.label));
      return { section, id: themeSlug(section), groups };
    }).filter(Boolean);
  }

  function teamsFor(year) {
    const rows = roles.filter((r) => r.page === 'teams' && r.rotary_year === year);
    const teams = [];
    for (const r of rows) {
      let t = teams.find((x) => x.name === r.section);
      if (!t) teams.push((t = { name: r.section, id: themeSlug(r.section), leaders: [], members: [], committees: [] }));
      if (!r.committee) {
        (t.leaders.length === 0 || r.role === t.leaders[0].role ? t.leaders : t.members).push(r);
        continue;
      }
      let c = t.committees.find((x) => x.name === r.committee);
      if (!c) t.committees.push((c = { name: r.committee, id: themeSlug(r.committee), chairs: [], coChairs: [] }));
      (r.role === 'Chairman' ? c.chairs : c.coChairs).push(r);
    }
    return teams;
  }

  const rolesByYear = years.map((year) => ({ year, leadership: leadershipFor(year), teams: teamsFor(year), current: year === rotaryYear }));

  // Search index for the Leadership and Teams pages: one entry per person per year
  const people = [];
  for (const r of roles) {
    const key = `${r.rotary_year}|${r.person_ref || r.name + '|' + r.club_id}`;
    let p = people.find((x) => x.key === key);
    if (!p) {
      people.push((p = { key, year: r.rotary_year, name: r.name, club: clubName(r.club_id), clubUrl: clubById[r.club_id]?.url || '', photo: r.image?.sq?.src || '', roles: [] }));
    }
    p.roles.push({ role: r.role, section: r.section, committee: r.committee, zone: r.zone, term: r.term, page: r.page });
  }

  const directory = data.members
    .filter((m) => m.directory_ok)
    .map((m) => ({
      k: m.public_key,
      name: m.name,
      club: clubName(m.club_id),
      clubUrl: clubById[m.club_id]?.url || '',
      profession: m.profession,
      area: m.area,
      zone: clubById[m.club_id]?.zone || '',
      text: m.description,
      website: m.website,
      wa: m.contact_ok && !m.sample ? m.contact_link : '',
      sampleContact: !!(m.sample && m.contact_ok),
      photo: img(media, m.photo)?.sq?.src || '',
    }))
    .sort((a, b) => a.name.replace(/^(Rtn|Dr)\.?\s+/g, '').localeCompare(b.name.replace(/^(Rtn|Dr)\.?\s+/g, '')));

  const celebrations = {
    birthdays: data.members
      .filter((m) => m.birthday_ok && m.birthday)
      .map((m) => ({ md: m.birthday, name: m.name, club: clubName(m.club_id), photo: img(media, m.photo)?.sq?.src || '' })),
    anniversaries: data.couples.map((c) => {
      const a = memberByKey[c.person_a_key];
      const b = memberByKey[c.person_b_key];
      return {
        md: c.anniversary,
        a: { name: c.person_a_name, club: clubName(c.person_a_club_id), photo: img(media, a?.photo)?.sq?.src || '' },
        b: { name: c.person_b_name, club: clubName(c.person_b_club_id), photo: b ? img(media, b.photo)?.sq?.src || '' : '' },
        couplePhoto: img(media, c.couple_photo)?.card?.src || '',
      };
    }),
  };

  // Recognitions: last calendar month on the home page; every month of the current Rotary year on its page
  const lastMonth = previousMonth(today);
  const recognition = monthlyRecognition(activities, clubs, lastMonth);
  const recognitionHistory = [];
  for (let m = lastMonth; ; ) {
    recognitionHistory.push(monthlyRecognition(activities, clubs, m));
    if (m.endsWith('-07') || recognitionHistory.length >= 12) break;
    m = previousMonth(m + '-01');
  }

  const thisMonth = today.slice(0, 7);
  const spotlights = data.spotlights
    .filter((s) => s.month <= thisMonth)
    .sort((a, b) => b.month.localeCompare(a.month))
    .map((s) => {
      const m = memberByKey[s.public_key];
      return { ...s, monthLabel: formatMonth(s.month), member: m, club: clubById[m.club_id], image: img(media, m.photo) };
    });

  const themes = data.lists.themes.map((t) => ({ name: t, slug: themeSlug(t), count: activities.filter((a) => a.theme === t).length }));

  return {
    today,
    rotaryYear,
    clubs: clubs.sort((a, b) => a.name.localeCompare(b.name)),
    activeClubs: clubs.filter((c) => c.status === 'active'),
    inactiveClubs: clubs.filter((c) => c.status !== 'active'),
    zones: data.site.zones,
    clubById,
    activities,
    events,
    upcomingEvents,
    pastEvents,
    magazines,
    magazinesByYear,
    messages,
    rolesByYear,
    currentRoles: rolesByYear.find((y) => y.current) || rolesByYear[0],
    people,
    directory,
    professions: [...new Set(directory.map((d) => d.profession))].sort(),
    areas: [...new Set(directory.map((d) => d.area))].sort(),
    celebrations,
    recognition,
    recognitionHistory,
    spotlight: spotlights[0] || null,
    spotlights,
    themes,
    forms: data.forms,
    generatedAt: data.generated_at,
    rebuildRequestedAt: data.rebuild_requested_at,
    source: data.source,
    stats: {
      clubsPosting: new Set(activities.map((a) => a.club_id)).size,
      peopleHelped: activities.reduce((s, a) => s + (a.people_helped || 0), 0),
    },
  };
}
