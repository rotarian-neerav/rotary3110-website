// Shapes the public data into what the pages need: clubs with their activities, events split
// into upcoming and past, teams as a tree, recognitions, search indexes, city pages, public
// services, year summaries, and so on.

import { core, plain } from './core.mjs';
import { monthlyRecognition, previousMonth } from './recognition.mjs';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const MONTHS_SHORT = MONTHS.map((m) => m.slice(0, 3));

export const themeSlug = (t) => t.toLowerCase().replace(/[^a-z]+/g, '-').replace(/^-|-$/g, '');
export const citySlug = (c) => c.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

// "More like this" at the end of activity and event pages
const MORE = 3;

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

// Most events shown on the home page; district events come first
export const HOME_EVENTS = 8;

const TITLES = /^(Rtn|PDG|IPDG|DGE|DGN|DGND|DG|PAG|AG|IPP|PP|Dr|CA)\.?\s+/;
/** A name without Rotary and professional titles ("PDG Sharat Chandra" -> "Sharat Chandra"). */
export function plainName(name = '') {
  let s = name.trim();
  while (TITLES.test(s)) s = s.replace(TITLES, '');
  return s;
}
const nameSlug = (name) => plainName(name).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'member';
const byPlainName = (a, b) => plainName(a.name).localeCompare(plainName(b.name));

/** District events first, then club events, each in date order; at most `max`. */
export function homeEvents(upcoming, max = HOME_EVENTS) {
  const district = upcoming.filter((e) => e.isDistrict);
  const club = upcoming.filter((e) => !e.isDistrict);
  return district.slice(0, max).concat(club.slice(0, Math.max(0, max - district.length)));
}

export function derive(data, media, todayOverride) {
  const today = todayIST(todayOverride);
  const rotaryYear = data.site.rotary_year;
  const clubs = data.clubs.map((c) => ({ ...c, activities: [], officers: [], services: c.services || [], projects: c.projects || [],
    meeting_day: c.meeting_day || '', url: `/clubs/${c.slug}/`, cityUrl: c.city ? `/cities/${citySlug(c.city)}/` : '' }));
  const clubById = Object.fromEntries(clubs.map((c) => [c.club_id, c]));
  const clubName = (id) => clubById[id]?.name || '';
  const clubByName = Object.fromEntries(clubs.map((c) => [c.name.toLowerCase(), c]));

  const memberByKey = Object.fromEntries(data.members.map((m) => [m.public_key, m]));

  const activities = data.activities
    .map((a) => ({
      ...a,
      url: `/activities/${a.id.toLowerCase()}/`,
      club: clubById[a.club_id],
      partners: a.partner_clubs.map((id) => clubById[id]).filter(Boolean),
      themeSlug: themeSlug(a.theme),
      avenue: a.avenue || '',
      avenueSlug: a.avenue ? themeSlug(a.avenue) : '',
      year: core.Core_rotaryYearOf(a.date),
      dateLabel: formatDate(a.date),
      images: a.photos.map((p) => img(media, p)).filter(Boolean),
      press: a.press ? { ...a.press, dateLabel: formatDate(a.press.date) } : null,
      video: a.video || null,
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

  const clubNames = Object.fromEntries(clubs.map((c) => [c.name.toLowerCase(), true]));
  const events = data.events
    .map((e) => ({
      ...e,
      url: `/events/${e.id.toLowerCase()}/`,
      ics: `/events/${e.id.toLowerCase()}.ics`,
      dateLabel: formatDate(e.start_date) + (e.end_date && e.end_date !== e.start_date ? ` – ${formatDate(e.end_date)}` : ''),
      report: activityById[e.report_activity_id] || null,
      images: (e.photos || []).map((p) => img(media, p)).filter(Boolean),
      isPast: (e.end_date || e.start_date) < today,
      // organised by the district (or one of its teams) rather than by a club
      isDistrict: core.Core_isDistrictEvent(e, clubNames),
      registration: plain(core.Core_registrationLine(e, today)),
      openToAll: !!e.open_to_all,
      club: clubByName[(e.organiser || '').toLowerCase()] || null,
    }))
    .sort((a, b) => a.start_date.localeCompare(b.start_date));
  const upcomingEvents = events.filter((e) => !e.isPast);
  const pastEvents = events.filter((e) => e.isPast).reverse();
  const eventById = Object.fromEntries(events.map((e) => [e.id, e]));

  // "More like this": the club's other recent work and its next event, then similar work by other clubs
  for (const a of activities) {
    const clubRecent = (a.club?.activities || []).filter((x) => x !== a).slice(0, MORE);
    const seen = new Set([a, ...clubRecent]);
    const similar = activities.filter((x) => !seen.has(x) && x.theme === a.theme && x.club_id !== a.club_id).slice(0, MORE);
    const nextEvent = upcomingEvents.find((e) => e.club && e.club === a.club) || null;
    a.more = { clubRecent, similar, nextEvent };
  }
  for (const e of events) {
    const others = upcomingEvents.filter((x) => x !== e);
    const sameCity = others.filter((x) => x.city === e.city);
    const rest = others.filter((x) => x.city !== e.city && x.isDistrict);
    e.more = {
      events: [...sameCity, ...rest].slice(0, MORE),
      clubActivities: e.club ? e.club.activities.slice(0, MORE) : [],
    };
  }

  // District campaigns: running totals from approved activities (joint activities count for the club that sent them)
  const campaigns = (data.campaigns || [])
    .map((c) => {
      const t = plain(core.Core_campaignTotals(c, data.activities));
      const ids = new Set(t.activity_ids);
      return {
        ...c,
        url: `/campaigns/${c.slug}/`,
        total: t.total,
        entries: t.entries,
        clubs: t.clubs,
        byClub: t.by_club.map((x) => ({ club: clubById[x.club_id] || null, entries: x.entries, count: x.count })),
        activities: activities.filter((a) => ids.has(a.id)),
        percent: c.target ? Math.min(100, Math.round((100 * t.total) / c.target)) : null,
        isRunning: c.start_date <= today && (!c.end_date || today <= c.end_date),
        isPast: !!c.end_date && today > c.end_date,
        dateLabel: formatDate(c.start_date) + (c.end_date ? ` – ${formatDate(c.end_date)}` : ' onwards'),
      };
    })
    .sort((a, b) => b.rotary_year.localeCompare(a.rotary_year) || a.sort_order - b.sort_order || a.name.localeCompare(b.name));
  const campaignById = Object.fromEntries(campaigns.map((c) => [c.campaign_id, c]));
  for (const a of activities) {
    const c = campaignById[a.campaign_id];
    a.campaign = c && core.Core_inCampaign(c, a.date) ? c : null;
  }
  const campaignsByYear = [];
  for (const c of campaigns) {
    let g = campaignsByYear.find((x) => x.year === c.rotary_year);
    if (!g) campaignsByYear.push((g = { year: c.rotary_year, campaigns: [] }));
    g.campaigns.push(c);
  }
  // Each club's campaign reports in the Rotary year we are in
  const thisRotaryYear = core.Core_rotaryYearOf(today);
  for (const club of clubs) {
    club.campaigns = campaigns
      .filter((c) => c.rotary_year === thisRotaryYear)
      .map((c) => ({ campaign: c, count: c.byClub.find((x) => x.club === club)?.count ?? null }))
      .filter((x) => x.count !== null);
  }

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
  const roles = data.functionaries.map((f) => ({ ...f, club: clubById[f.club_id], image: img(media, f.photo),
    agClubs: (f.clubs || []).map((id) => clubById[id]).filter(Boolean) }));
  const years = [...new Set(roles.map((r) => r.rotary_year))].sort().reverse();

  function leadershipFor(year) {
    const rows = roles.filter((r) => r.page === 'leadership' && r.rotary_year === year);
    return LEADERSHIP_ORDER.map((section) => {
      let people = rows.filter((r) => r.section === section);
      if (!people.length) return null;
      if (section === 'College of Governors') people = [...people].sort((a, b) => b.term.localeCompare(a.term));
      // Assistant Governors are listed by name, each with the clubs they look after (zones are not shown)
      if (section === 'Assistant Governors') people = [...people].sort(byPlainName);
      const groups = [];
      for (const p of people) {
        const label = section === 'Assistant Governors' ? '' : p.committee || '';
        let g = groups.find((x) => x.label === label);
        if (!g) groups.push((g = { label, people: [] }));
        g.people.push(p);
      }
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

  // Member cards: one per person, joining their club and district roles of every year and, if they
  // agreed, their directory listing. People marked deceased or left have no reference, so no card.
  const officerRows = data.officers.map((o) => ({ ...o, page: 'club', club: clubById[o.club_id], image: img(media, o.photo) }));
  const persons = new Map();
  const personFor = (ref) => {
    if (!persons.has(ref)) persons.set(ref, { ref, roles: [], member: null });
    return persons.get(ref);
  };
  roles.forEach((r) => r.person_ref && personFor(r.person_ref).roles.push(r));
  officerRows.forEach((r) => r.person_ref && personFor(r.person_ref).roles.push(r));
  for (const m of data.members) {
    if (!m.person_ref) continue;
    if (m.directory_ok || persons.has(m.person_ref)) personFor(m.person_ref).member = m;
  }

  const PAGE_ORDER = { leadership: 0, teams: 1, club: 2 };
  const roleLink = (r) => {
    if (r.page === 'club') return r.club?.url || '';
    const id = themeSlug(r.page === 'teams' ? r.committee || r.section : r.section);
    return `/${r.page}/${r.rotary_year === rotaryYear ? '' : r.rotary_year + '/'}#${id}`;
  };
  const roleWhere = (r) => {
    if (r.page === 'club') return r.club?.name || '';
    const where = r.page === 'teams' ? [r.committee, r.section].filter(Boolean).join(', ') : r.section;
    // "Assistant Governor · Assistant Governors" says the same thing twice
    return where && where.toLowerCase().indexOf(r.role.toLowerCase()) !== 0 ? where : '';
  };

  const cards = [];
  const cardByRef = {};
  const usedUrls = new Set();
  for (const p of persons.values()) {
    const sorted = [...p.roles].sort((a, b) => b.rotary_year.localeCompare(a.rotary_year) || PAGE_ORDER[a.page] - PAGE_ORDER[b.page] || (a.sort_order || 0) - (b.sort_order || 0));
    const m = p.member;
    if (!sorted.length && !(m && m.directory_ok)) continue;
    const latest = sorted[0];
    const name = latest ? latest.name : m.name;
    const club = clubById[m ? m.club_id : sorted.find((r) => r.club_id)?.club_id] || null;
    let url = `/members/${nameSlug(name)}-${p.ref.slice(1, 7)}/`;
    if (usedUrls.has(url)) url = `/members/${nameSlug(name)}-${p.ref.slice(1).toLowerCase()}/`;
    usedUrls.add(url);
    const listed = !!(m && m.directory_ok);
    const photo = (m?.photo_ok && img(media, m.photo)) || sorted.map((r) => r.image).find(Boolean) || null;
    const official = sorted.find((r) => r.rotary_year === rotaryYear && r.contact_ok && r.contact_link);
    const years = [];
    for (const r of sorted) {
      let y = years.find((x) => x.year === r.rotary_year);
      if (!y) years.push((y = { year: r.rotary_year, current: r.rotary_year === rotaryYear, roles: [] }));
      y.roles.push({
        role: r.role + (r.page === 'leadership' && r.term && r.term !== r.rotary_year ? ` (${r.term})` : ''),
        where: roleWhere(r),
        link: roleLink(r),
        page: r.page,
      });
    }
    const card = {
      ref: p.ref,
      url,
      name,
      club,
      photo,
      listed, // agreed to be listed: the card may be found by search engines
      profession: listed ? m.profession : '',
      area: listed ? m.area : '',
      description: listed ? m.description : '',
      website: listed ? m.website : '',
      wa: listed && m.contact_ok && !m.sample ? m.contact_link : '',
      sampleContact: !!(listed && m.contact_ok && m.sample),
      officialContact: official ? official.contact_link : '',
      years,
      currentRoles: years.find((y) => y.current)?.roles || [],
      memberKey: m ? m.public_key : '',
    };
    cards.push(card);
    cardByRef[p.ref] = card;
  }
  cards.sort(byPlainName);
  const cardUrl = (ref) => (ref && cardByRef[ref]?.url) || '';
  for (const r of roles) r.card = cardUrl(r.person_ref);
  for (const c of clubs) for (const o of c.officers) o.card = cardUrl(o.person_ref);
  for (const c of campaigns) c.chairCard = cardUrl(c.chair_ref);

  // Each club's members page: this year's office bearers, then district role holders, then everyone else listed
  for (const c of clubs) {
    const officerOrder = c.officers.map((o) => o.person_ref);
    const rank = (p) => {
      const i = officerOrder.indexOf(p.ref);
      return i >= 0 ? i : p.currentRoles.length ? 1000 : 2000;
    };
    c.members = cards.filter((p) => p.club === c).sort((a, b) => rank(a) - rank(b) || byPlainName(a, b));
    c.membersUrl = `${c.url}members/`;
  }

  // Search index for the Leadership and Teams pages: one entry per person per year, club office bearers included
  const people = [];
  const peopleByKey = new Map();
  for (const r of [...roles, ...officerRows]) {
    const key = `${r.rotary_year}|${r.person_ref || r.name + '|' + r.club_id}`;
    let p = peopleByKey.get(key);
    if (!p) {
      const card = cardByRef[r.person_ref];
      p = { key, year: r.rotary_year, name: r.name, club: clubName(r.club_id), clubUrl: clubById[r.club_id]?.url || '', photo: (card?.photo || r.image)?.sq?.src || '', u: card?.url || '', roles: [] };
      people.push(p);
      peopleByKey.set(key, p);
    }
    p.roles.push(r.page === 'club'
      ? { role: r.role, section: '', committee: '', term: '', page: 'club' }
      : { role: r.role, section: r.section, committee: r.committee, term: r.term, page: r.page });
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
      text: m.description,
      website: m.website,
      wa: m.contact_ok && !m.sample ? m.contact_link : '',
      sampleContact: !!(m.sample && m.contact_ok),
      photo: img(media, m.photo)?.sq?.src || '',
      u: cardUrl(m.person_ref),
    }))
    .sort(byPlainName);

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
      // a story about someone who has since died or left keeps only their name
      const m = memberByKey[s.public_key] || { name: s.member_name, club_id: '', profession: '', website: '' };
      return { ...s, monthLabel: formatMonth(s.month), member: m, club: clubById[m.club_id] || null, image: img(media, m.photo), card: cardUrl(m.person_ref) };
    });

  for (const c of cards) c.spotlights = c.memberKey ? spotlights.filter((s) => s.public_key === c.memberKey) : [];

  const themes = data.lists.themes.map((t) => ({ name: t, slug: themeSlug(t), count: activities.filter((a) => a.theme === t).length }));
  const avenues = (data.lists.avenues || []).map((v) => ({ name: v, slug: themeSlug(v), count: activities.filter((a) => a.avenue === v).length }));
  const activityYears = [...new Set(activities.map((a) => a.year))].sort().reverse();

  // Facilities the public can use (blood banks, eye care…), with the institution's own number
  const publicServices = (data.public_services || [])
    .map((x) => ({ ...x, club: clubById[x.club_id] || null, typeSlug: themeSlug(x.type), cityUrl: x.city ? `/cities/${citySlug(x.city)}/` : '' }))
    .sort((a, b) => (data.lists.service_types || []).indexOf(a.type) - (data.lists.service_types || []).indexOf(b.type) || a.city.localeCompare(b.city) || a.name.localeCompare(b.name));
  const servicesByType = [];
  for (const x of publicServices) {
    let g = servicesByType.find((t) => t.type === x.type);
    if (!g) servicesByType.push((g = { type: x.type, slug: x.typeSlug, services: [] }));
    g.services.push(x);
  }
  for (const c of clubs) c.publicServices = publicServices.filter((x) => x.club === c);

  // City pages: the clubs of each city, its upcoming events, recent activities and public services
  const cityNames = [...new Set(clubs.filter((c) => c.status === 'active' && c.city).map((c) => c.city))].sort();
  const cities = cityNames.map((name) => {
    const cityClubs = clubs.filter((c) => c.city === name && c.status === 'active');
    const set = new Set(cityClubs);
    return {
      name,
      slug: citySlug(name),
      url: `/cities/${citySlug(name)}/`,
      clubs: cityClubs,
      events: upcomingEvents.filter((e) => e.city === name),
      activities: activities.filter((a) => set.has(a.club) || a.partners.some((pc) => set.has(pc))).slice(0, 9),
      activityCount: activities.filter((a) => set.has(a.club)).length,
      services: publicServices.filter((x) => x.city === name || set.has(x.club)),
    };
  });

  // In the news: activities a newspaper or news website reported, newest coverage first
  const news = activities.filter((a) => a.press).sort((a, b) => (b.press.date || b.date).localeCompare(a.press.date || a.date));

  // A summary page for each Rotary year with activities
  const yearSummaries = activityYears.map((year) => {
    const acts = activities.filter((a) => a.year === year);
    const count = (list, key) => list.map((v) => ({ ...v, count: acts.filter((a) => a[key] === v.name).length })).filter((v) => v.count);
    const byClub = new Map();
    for (const a of acts) {
      if (!a.club) continue;
      byClub.set(a.club, (byClub.get(a.club) || 0) + 1);
    }
    const startYear = +year.slice(0, 4);
    const inYear = (d) => d >= `${startYear}-07-01` && d <= `${startYear + 1}-06-30`;
    return {
      year,
      url: `/years/${year}/`,
      current: year === core.Core_rotaryYearOf(today),
      activities: acts.length,
      clubsPosting: byClub.size,
      peopleHelped: acts.reduce((s2, a) => s2 + (a.people_helped || 0), 0),
      amountSpent: acts.reduce((s2, a) => s2 + (a.amount_spent || 0), 0),
      themes: count(themes, 'theme'),
      avenues: count(avenues, 'avenue'),
      noAvenue: acts.filter((a) => !a.avenue).length,
      clubs: [...byClub.entries()].map(([club, n]) => ({ club, count: n })).sort((a, b) => b.count - a.count || a.club.name.localeCompare(b.club.name)),
      campaigns: campaigns.filter((c) => c.rotary_year === year),
      events: events.filter((e) => inYear(e.start_date)),
      districtEvents: events.filter((e) => inYear(e.start_date) && e.isDistrict),
      stories: acts.filter((a) => a.story_of_month),
      press: acts.filter((a) => a.press).length,
    };
  });

  // The About page: the RI President and the District Governor, and every Past District Governor.
  // Until the past_governors tab is filled in, the College of Governors of the current year stands in.
  const profiles = (data.profiles || []).map((x) => ({ ...x, image: img(media, x.photo) }));
  let pastGovernors = (data.past_governors || []).map((g) => ({ term: g.term, name: g.name, club: clubById[g.club_id] || null, card: cardUrl(g.person_ref) }));
  if (!pastGovernors.length) {
    pastGovernors = roles.filter((r) => r.section === 'College of Governors' && r.rotary_year === rotaryYear)
      .map((r) => ({ term: r.term, name: r.name, club: r.club || null, card: r.card }))
      .sort((a, b) => b.term.localeCompare(a.term));
  }

  // Weekly bulletins: this week's, and one for every Sunday since bulletin_start_date (rebuilt from the data each time)
  const thisSunday = core.Core_sundayOf(today);
  let firstSunday = thisSunday;
  const start = data.site.bulletin_start_date;
  if (start) {
    firstSunday = core.Core_sundayOf(start);
    if (firstSunday < start) firstSunday = core.Core_addDays(firstSunday, 7);
    if (firstSunday > thisSunday) firstSunday = thisSunday;
  }
  const bulletins = [];
  for (let s = firstSunday; s <= thisSunday && bulletins.length < 600; s = core.Core_addDays(s, 7)) {
    const raw = plain(core.Core_bulletin(data, s));
    // the registration line as it stood on that Sunday
    const withReg = (x) => (eventById[x.id] ? { ...eventById[x.id], registration: x.registration } : null);
    bulletins.unshift({
      sunday: s,
      url: `/bulletin/${s}/`,
      dateLabel: formatDate(s),
      raw,
      events: raw.events.map(withReg).filter(Boolean),
      closing: raw.closing.map(withReg).filter(Boolean),
      done: { ...raw.done, items: raw.done.items.map((x) => activityById[x.id]).filter(Boolean) },
      campaigns: raw.campaigns.map((x) => ({ ...campaignById[x.campaign_id], total: x.total, entries: x.entries, clubs: x.clubs })),
      empty: raw.empty,
      summary: [
        `${raw.events.length} ${raw.events.length === 1 ? 'event' : 'events'} coming up`,
        `${raw.done.total} ${raw.done.total === 1 ? 'activity' : 'activities'} from ${raw.done.clubs} ${raw.done.clubs === 1 ? 'club' : 'clubs'}`,
      ].join(' · '),
    });
  }

  return {
    today,
    rotaryYear,
    clubs: clubs.sort((a, b) => a.name.localeCompare(b.name)),
    activeClubs: clubs.filter((c) => c.status === 'active'),
    inactiveClubs: clubs.filter((c) => c.status !== 'active'),
    cities,
    clubById,
    weekdays: core.CORE_WEEKDAYS.slice(),
    activities,
    events,
    upcomingEvents,
    homeEvents: homeEvents(upcomingEvents),
    campaigns,
    campaignsByYear,
    runningCampaigns: campaigns.filter((c) => c.isRunning).sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name)),
    bulletins,
    bulletin: bulletins[0],
    pastEvents,
    magazines,
    magazinesByYear,
    messages,
    rolesByYear,
    currentRoles: rolesByYear.find((y) => y.current) || rolesByYear[0],
    people,
    cards,
    directory,
    professions: [...new Set(directory.map((d) => d.profession))].sort(),
    areas: [...new Set(directory.map((d) => d.area))].sort(),
    celebrations,
    recognition,
    recognitionHistory,
    spotlight: spotlights[0] || null,
    spotlights,
    themes,
    avenues,
    activityYears,
    years: yearSummaries,
    publicServices,
    servicesByType,
    news,
    profiles,
    pastGovernors,
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
