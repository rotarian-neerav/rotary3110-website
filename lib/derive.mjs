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

// The before and after pictures of an activity, only when both could be processed
function beforeAfter(media, ba) {
  const before = img(media, ba?.before);
  const after = img(media, ba?.after);
  return before && after ? { before, after } : null;
}

// Sections of the District Leadership page, in order. The Sheet keeps its own sections; on the page the Governor
// line shows only the sitting governor (the DGE, DGN and others join the end of the College of Governors), and the
// Governor's Aides are taken out of the Governor's Office Team into a section of their own.
const OFFICE = "Governor's Office Team";
const AIDE = "Governor's Aide";
// the Governor of the page's year: on a coming year's page the title reads District Governor Elect
const isGovernor = (r) => r.section === 'Governor line' && core.Core_baseRole(r.role) === 'District Governor' && (r.held || r.term || r.rotary_year) === r.rotary_year;
const LEADERSHIP_SECTIONS = [
  ['District Governor', isGovernor],
  ['College of Governors', (r) => r.section === 'College of Governors' || (r.section === 'Governor line' && !isGovernor(r))],
  ['District Counsellors', (r) => r.section === 'District Counsellors'],
  ['Assistant Governors', (r) => r.section === 'Assistant Governors'],
  ["Governor's Aides", (r) => r.section === OFFICE && r.committee === AIDE],
  ["Governor's Office", (r) => r.section === OFFICE && r.committee !== AIDE],
];
/** Past District Governors in date order, newest last. */
const byTermOldestFirst = (a, b) => (a.term || '').localeCompare(b.term || '') || plainName(a.name).localeCompare(plainName(b.name));

// Most events shown on the home page; district events come first
export const HOME_EVENTS = 8;
// Rotary Means Business joins the top menu by itself once this many businesses are listed (owner, 17 Nov 2026)
export const RMB_MENU_AT = 25;

const TITLES = /^(Rtn|PDG|IPDG|DGE|DGN|DGND|DG|PAG|AG|IPP|PP|Dr|CA)\.?\s+/;
/** A name without Rotary and professional titles ("PDG Sharat Chandra" -> "Sharat Chandra"). */
export function plainName(name = '') {
  let s = name.trim();
  while (TITLES.test(s)) s = s.replace(TITLES, '');
  return s;
}
// Rotary titles only: "Dr." and "CA" are part of how the person is known and stay
const ROTARY_TITLES = /^(Rtn|PDG|IPDG|DGE|DGN|DGND|DG|PAG|AG|IPP|PP)\.?\s+/;
/** A name without its typed Rotary title ("DGE Dr. A Rao" -> "Dr. A Rao"), for a title the website writes itself. */
export function untitledName(name = '') {
  let s = name.trim();
  while (ROTARY_TITLES.test(s)) s = s.replace(ROTARY_TITLES, '');
  return s;
}
/** A Past District Governor's name as the website shows it: always "PDG …", whatever was typed (owner, 24 Nov 2026). */
export const pdgName = (name = '') => (untitledName(name) ? `PDG ${untitledName(name)}` : '');
/** A member's WhatsApp link that opens the chat with a first line already typed; anything else is left as it is. */
export function waHello(link = '', text = '') {
  return /^https:\/\/wa\.me\/\d+$/.test(link) && text ? `${link}?text=${encodeURIComponent(text)}` : link;
}
const nameSlug = (name) => plainName(name).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'member';
const byPlainName = (a, b) => plainName(a.name).localeCompare(plainName(b.name));

/** District events first, then club events, each in date order; at most `max`. */
export function homeEvents(upcoming, max = HOME_EVENTS) {
  const district = upcoming.filter((e) => e.isDistrict);
  const club = upcoming.filter((e) => !e.isDistrict);
  return district.slice(0, max).concat(club.slice(0, Math.max(0, max - district.length)));
}

/**
 * A member's Call button link (23 Nov 2026: its own choice and number). Data from a Sheet script older than that has
 * no Call choice: there the WhatsApp choice gave both buttons, on the same number.
 */
function callLink(m) {
  if (!m) return '';
  if (!('call_ok' in m)) return m.contact_ok ? m.contact_link || '' : '';
  return m.call_ok ? m.call_link || '' : '';
}

export function derive(data, media, todayOverride) {
  const today = todayIST(todayOverride);
  // The Rotary year comes from today's date in India (owner, 24 Nov 2026), not from the data: the website moves on by
  // itself on 1 July, and the year setting of a Sheet script deployed before then no longer matters
  const rotaryYear = core.Core_rotaryYearOf(today);
  const nextYear = core.Core_nextRotaryYear(rotaryYear);
  const clubs = data.clubs.map((c) => ({ ...c, activities: [], officers: [], elects: [], services: c.services || [], projects: c.projects || [],
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
      beforeAfter: beforeAfter(media, a.before_after),
      press: a.press ? { ...a.press, dateLabel: formatDate(a.press.date) } : null,
      video: a.video || null,
      // marked by the sender as district work, or the report of a district event (set below)
      isDistrict: !!a.district_level,
    }))
    .sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id));
  const activityById = Object.fromEntries(activities.map((a) => [a.id, a]));
  for (const a of activities) {
    a.club?.activities.push(a);
    for (const p of a.partners) p.activities.push(a);
  }

  // Club office bearers (24 Nov 2026): the President, Secretary and Executive Secretary acting now, this year's or the
  // last known with their year until the club tells the new one (decision 134); other roles of this year; and next
  // year's, as Elects. The Sheet marks who acts (the sender check's rule); data from an older Sheet script is worked
  // out here, without knowing who moved club.
  const clubRoles = core.CORE_CLUB_ROLES;
  let actingIndex = null;
  if (!data.officers.some((o) => 'acting' in o)) {
    const acting = core.Core_actingOfficers(data.officers.map((o, i) => ({ ...o, _i: i })), rotaryYear, null, true);
    actingIndex = new Set(Object.values(acting).flatMap((roles) => Object.values(roles).map((o) => o._i)));
  }
  const roleOrder = (o) => (clubRoles.includes(o.role) ? clubRoles.indexOf(o.role) : clubRoles.length);
  data.officers.forEach((o, i) => {
    const c = clubById[o.club_id];
    if (!c) return;
    const row = { ...o, image: img(media, o.photo) };
    const acts = clubRoles.includes(o.role) ? (actingIndex ? actingIndex.has(i) : o.acting) : o.rotary_year === rotaryYear;
    if (o.rotary_year === nextYear) c.elects.push({ ...row, role: core.Core_roleTitle(o.role, o.rotary_year, rotaryYear, true) });
    else if (acts) c.officers.push({ ...row, since: o.rotary_year === rotaryYear ? '' : o.rotary_year });
  });
  for (const c of clubs) for (const list of [c.officers, c.elects]) list.sort((a, b) => roleOrder(a) - roleOrder(b));

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
  // newest first, district events before club events (owner, 17 Nov 2026)
  const pastEvents = events.filter((e) => e.isPast).reverse().sort((a, b) => Number(b.isDistrict) - Number(a.isDistrict));
  const eventById = Object.fromEntries(events.map((e) => [e.id, e]));
  // An activity that reports a district event, such as a grant inauguration, still reads as district work
  for (const e of events) if (e.isDistrict && e.report) e.report.isDistrict = true;
  for (const a of activities) if (a.event_id && eventById[a.event_id]?.isDistrict) a.isDistrict = true;

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

  // People with roles (leadership + teams), grouped so each person appears once with all roles. `held` is the year a
  // role is held (a Governor line row's term), `base` the role without Elect or Nominee typed into it.
  const roles = data.functionaries.map((f) => ({ ...f, club: clubById[f.club_id], image: img(media, f.photo),
    agClubs: (f.clubs || []).map((id) => clubById[id]).filter(Boolean), held: core.Core_heldYear(f), base: core.Core_baseRole(f.role) }));

  // Every Governor the data knows, by the year they hold office: from the Governor line, as typed in a year's list
  // (District Governor Elect with its term) or added through Club updates for their own year; the newest list wins
  const governorsByYear = new Map();
  for (const r of [...roles].sort((a, b) => b.rotary_year.localeCompare(a.rotary_year))) {
    if (r.section === 'Governor line' && r.base === 'District Governor' && r.held && !governorsByYear.has(r.held)) governorsByYear.set(r.held, r);
  }
  // Past District Governors: the past_governors tab (until it is filled in, the newest College of Governors list
  // stands in), and from the Governor line every year it does not have
  let pastGovernorRows = (data.past_governors || []).map((g) => ({ term: g.term, name: g.name, club: clubById[g.club_id] || null, person_ref: g.person_ref, active: g.active !== false }));
  if (!pastGovernorRows.length) {
    const latest = roles.filter((r) => r.section === 'College of Governors').map((r) => r.rotary_year).sort().pop();
    pastGovernorRows = roles.filter((r) => r.section === 'College of Governors' && r.rotary_year === latest && /^\d{4}-\d{2}$/.test(r.term || ''))
      .map((r) => ({ term: r.term, name: r.name, club: r.club || null, person_ref: r.person_ref, active: r.active !== false }));
  }
  for (const [year, g] of governorsByYear) {
    if (year < rotaryYear && !pastGovernorRows.some((x) => x.term === year)) {
      pastGovernorRows.push({ term: year, name: untitledName(g.name), club: g.club || null, person_ref: g.person_ref, active: g.active !== false });
    }
  }

  // The team pages' years (24 Nov 2026, a drop-down on both pages): every year from the first team list to the
  // furthest year entered, this year always among them, so no year in between is skipped
  const listYears = roles.map((r) => r.rotary_year).concat([...governorsByYear.keys()]).filter((y) => /^\d{4}-\d{2}$/.test(y));
  const firstYear = [...listYears, rotaryYear].sort()[0];
  const lastYear = [...listYears, rotaryYear].sort().reverse()[0];
  const years = [];
  for (let y = lastYear; y && y >= firstYear; y = `${+y.slice(0, 4) - 1}-${y.slice(2, 4)}`) years.push(y);

  // A year's page shows titles as they were in that year; a coming year's page, as they are today (Elect, Nominee)
  const titleOn = (year) => (year > rotaryYear ? rotaryYear : year);
  const titled = (r, year) => ({ ...r, role: core.Core_roleTitle(r.role, r.held, titleOn(year)) });
  // A Governor or Past Governor worked out from the data, for a year whose list does not name them
  const governorEntry = (g, year, role, term) => ({
    // a name typed with the title of that list ("DGN …") would be wrong on another year's page
    ...g, name: role === 'Past District Governor' ? pdgName(g.name) : g.section === 'Governor line' ? untitledName(g.name) : g.name, role, term, page: 'leadership', computed: true, rotary_year: year,
    card: cardUrl(g.person_ref), image: g.image || cardByRef[g.person_ref]?.photo || null,
  });

  function leadershipFor(year) {
    const rows = roles.filter((r) => r.page === 'leadership' && r.rotary_year === year);
    const has = (section) => rows.some((r) => r.section === section);
    const extra = [];
    // The Governor, the coming Governors and the College of Governors of a year whose list does not name them
    if (!rows.some(isGovernor) && governorsByYear.has(year)) {
      extra.push(governorEntry(governorsByYear.get(year), year, core.Core_roleTitle('District Governor', year, titleOn(year)), year));
    }
    if (!rows.some((r) => r.section === 'Governor line' && !isGovernor(r))) {
      for (const [held, g] of governorsByYear) {
        if (core.Core_yearsAhead(held, year) > 0 && core.Core_yearsAhead(held, year) <= 3) {
          extra.push({ ...governorEntry(g, year, core.Core_roleTitle('District Governor', held, titleOn(year)), held), section: 'Governor line', role_base: 'District Governor' });
        }
      }
    }
    if (!has('College of Governors')) {
      for (const g of pastGovernorRows) {
        if (g.term < year && g.active) extra.push({ ...governorEntry(g, year, 'Past District Governor', g.term), section: 'College of Governors' });
      }
      // A coming year's page (owner, 24 Nov 2026, option A): this year's Governor and any coming one whose year is
      // before the page's join the College with today's title ("District Governor (2026-27)"); PDG from their 1 July
      for (const [held, g] of governorsByYear) {
        if (held >= rotaryYear && held < year) {
          extra.push({ ...governorEntry(g, year, core.Core_roleTitle('District Governor', held, rotaryYear), held), section: 'College of Governors' });
        }
      }
    }
    // Every Past District Governor is "PDG …", in a typed list too
    const pdg = (r) => (r.role === 'Past District Governor' ? { ...r, name: pdgName(r.name) } : r);
    const all = rows.map((r) => pdg(titled(r, year))).concat(extra.map((e) => ({ ...e, section: e.section || 'Governor line' })));
    return LEADERSHIP_SECTIONS.map(([section, belongs]) => {
      let people = all.filter(belongs);
      if (!people.length) return null;
      // Past governors oldest first, then the governor line (DGE, DGN …) at the end
      if (section === 'College of Governors') {
        const line = (r) => (r.section === 'Governor line' ? 1 : 0);
        people = [...people].sort((a, b) => line(a) - line(b) || byTermOldestFirst(a, b));
      }
      // Assistant Governors are listed by name, each with the clubs they look after (zones are not shown)
      if (section === 'Assistant Governors') people = [...people].sort(byPlainName);
      const groups = [];
      for (const p of people) {
        const label = section === "Governor's Office" ? p.committee || '' : '';
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
        (t.leaders.length === 0 || r.base === t.leaders[0].base ? t.leaders : t.members).push(titled(r, year));
        continue;
      }
      let c = t.committees.find((x) => x.name === r.committee);
      if (!c) t.committees.push((c = { name: r.committee, id: themeSlug(r.committee), chairs: [], coChairs: [] }));
      (r.base === 'Chairman' ? c.chairs : c.coChairs).push(titled(r, year));
    }
    return teams;
  }

  // Member cards: one per person, joining their club and district roles of every year and, if they
  // agreed, their directory listing. People marked deceased or left have no reference, so no card.
  const officerRows = data.officers.map((o, i) => ({ ...o, page: 'club', club: clubById[o.club_id], image: img(media, o.photo),
    acting: actingIndex ? actingIndex.has(i) : !!o.acting }));
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
    // Held now: this year's roles, and a club role carried from an earlier year until the club tells the new holder
    const heldYear = (r) => (r.page === 'club' ? r.rotary_year : r.held);
    const now = (r) => heldYear(r) === rotaryYear || (r.page === 'club' && r.acting);
    const official = sorted.find((r) => now(r) && r.contact_ok && r.contact_link);
    const years = [];
    for (const r of sorted) {
      let y = years.find((x) => x.year === r.rotary_year);
      if (!y) years.push((y = { year: r.rotary_year, current: r.rotary_year === rotaryYear, coming: r.rotary_year > rotaryYear, roles: [] }));
      // a coming year's roles carry today's title (President Elect); past years keep the role as it was then
      const role = r.rotary_year > rotaryYear ? core.Core_roleTitle(r.role, heldYear(r), rotaryYear, r.page === 'club') : r.role;
      y.roles.push({
        role: role + (r.page === 'leadership' && r.term && r.term !== r.rotary_year ? ` (${r.term})` : ''),
        where: roleWhere(r),
        link: roleLink(r),
        page: r.page,
      });
    }
    // Roles now and to come, with today's titles (on the card's head, the directory and the club's members page)
    const currentRoles = [];
    for (const r of sorted) {
      const held = heldYear(r);
      if (!(now(r) || held > rotaryYear)) continue;
      // a club role carried from an earlier year keeps its name, with that year: "President (2024-25)"
      const role = held < rotaryYear ? `${r.role} (${held})` : core.Core_roleTitle(r.role, held, rotaryYear, r.page === 'club');
      currentRoles.push({ role, where: roleWhere(r), link: roleLink(r), page: r.page });
    }
    // "Past" only for the District Governor and a club President (owner, 24 Nov 2026), with the years served
    const pastTitles = [];
    const pastTitle = (title, where, year) => {
      const t = pastTitles.find((x) => x.title === title && x.where === where);
      if (!t) pastTitles.push({ title, where, years: [year] });
      else if (!t.years.includes(year)) t.years.push(year);
    };
    for (const r of sorted) {
      if (r.page === 'club' && r.role === 'President' && r.rotary_year < rotaryYear && !r.acting) pastTitle('Past President', r.club?.name || '', r.rotary_year);
      if (r.page === 'leadership' && r.base === 'District Governor' && r.section === 'Governor line' && r.held < rotaryYear) pastTitle('Past District Governor', '', r.held);
      if (r.page === 'leadership' && r.section === 'College of Governors' && /^\d{4}-\d{2}$/.test(r.term || '')) pastTitle('Past District Governor', '', r.term);
    }
    for (const g of pastGovernorRows) if (g.person_ref === p.ref) pastTitle('Past District Governor', '', g.term);
    const titles = currentRoles.map((r) => r.role + (r.where && r.page === 'club' ? `, ${r.where}` : ''))
      .concat(pastTitles.map((t) => `${t.title}${t.where ? `, ${t.where}` : ''} (${t.years.sort().join(', ')})`));
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
      // the Call button has its own choice and number since 23 Nov 2026 (a wa.me link; the page makes the tel: link)
      call: listed && !m.sample ? callLink(m) : '',
      sampleContact: !!(listed && (m.contact_ok || m.call_ok) && m.sample),
      officialContact: official ? official.contact_link : '',
      years,
      currentRoles,
      titles,
      memberKey: m ? m.public_key : '',
    };
    cards.push(card);
    cardByRef[p.ref] = card;
  }
  cards.sort(byPlainName);
  const cardUrl = (ref) => (ref && cardByRef[ref]?.url) || '';
  for (const r of roles) r.card = cardUrl(r.person_ref);
  for (const c of clubs) for (const o of [...c.officers, ...c.elects]) o.card = cardUrl(o.person_ref);
  for (const c of campaigns) c.chairCard = cardUrl(c.chair_ref);

  const rolesByYear = years.map((year) => ({
    year, leadership: leadershipFor(year), teams: teamsFor(year), current: year === rotaryYear, coming: year > rotaryYear,
    // the label in the year drop-down
    label: year === rotaryYear ? `${year} (this year)` : year > rotaryYear ? `${year} (from 1 July ${year.slice(0, 4)})` : year,
  }));

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

  for (const y of rolesByYear) {
    for (const s of y.leadership) {
      for (const g of s.groups) {
        for (const r of g.people) {
          if (!r.computed) continue;
          const key = `${y.year}|${r.person_ref || r.name}`;
          let p = peopleByKey.get(key);
          if (!p) {
            const card = cardByRef[r.person_ref];
            p = { key, year: y.year, name: r.name, club: r.club?.name || '', clubUrl: r.club?.url || '', photo: (card?.photo || r.image)?.sq?.src || '', u: card?.url || '', roles: [] };
            people.push(p);
            peopleByKey.set(key, p);
          }
          p.roles.push({ role: r.role, section: s.section, committee: '', term: r.term, page: 'leadership' });
        }
      }
    }
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
      call: !m.sample ? callLink(m) : '',
      sampleContact: !!(m.sample && (m.contact_ok || m.call_ok)),
      photo: img(media, m.photo)?.sq?.src || '',
      u: cardUrl(m.person_ref),
    }));
  // This year's office bearers and district team are listed too, by their roles (public already on the club,
  // leadership and team pages). Profession, area and contact buttons come only with their own consent form.
  // without a governor's term such as "(2018-19)": the directory carries no years at all
  const roleText = (c) => c.currentRoles.map((r) => r.role.replace(/\s*\(\d{4}-\d{2,4}\)$/, '')).map((role, i) => {
    const where = c.currentRoles[i].where;
    return where && where !== c.club?.name ? `${role}, ${where}` : role; // the club is shown on its own line
  }).join(' · ');
  const byCard = new Map(directory.filter((d) => d.u).map((d) => [d.u, d]));
  for (const c of cards) {
    if (!c.currentRoles.length) continue;
    const listed = byCard.get(c.url);
    if (listed) { listed.roles = roleText(c); continue; }
    directory.push({
      k: c.memberKey || c.ref, name: c.name, club: c.club?.name || '', clubUrl: c.club?.url || '',
      profession: '', area: '', text: '', website: '', wa: '', sampleContact: false,
      roles: roleText(c), photo: c.photo?.sq?.src || '', u: c.url,
    });
  }
  directory.sort(byPlainName);

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

  // Recognitions: last calendar month on the home page; every month of its Rotary year on its page. When no
  // activity is that recent (a past year shown as a showcase), they start from the newest month with activities.
  const newestMonth = activities.reduce((m, a) => (a.date > m ? a.date : m), '').slice(0, 7);
  const lastMonth = newestMonth && newestMonth < previousMonth(today) ? newestMonth : previousMonth(today);
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

  // Rotary Means Business (17 Nov 2026): members' own businesses, by trade and city, and the topics members can speak
  // on. Only active members' listings reach the website; each links to the member's card when they have one.
  const businessUrls = new Set();
  const businesses = (data.businesses || []).filter((b) => b.name).map((b) => {
    const tradeSlug = themeSlug(b.trade);
    const slug = citySlug(b.name) || 'business';
    let url = `/rmb/${tradeSlug}/${slug}/`;
    if (businessUrls.has(url)) url = `/rmb/${tradeSlug}/${slug}-${b.id.toLowerCase()}/`;
    businessUrls.add(url);
    return {
      ...b, url, tradeSlug, tradeUrl: `/rmb/${tradeSlug}/`, club: clubById[b.club_id] || null, card: cardUrl(b.person_ref),
      cityUrl: b.city ? `/cities/${citySlug(b.city)}/` : '', image: img(media, b.logo),
      wa: b.contact_ok && !b.sample ? b.contact_link : '', sampleContact: !!(b.contact_ok && b.sample),
    };
  }).sort((a, b) => a.name.localeCompare(b.name));
  const byCity = (list) => {
    const groups = [];
    for (const b of [...list].sort((x, y) => x.city.localeCompare(y.city) || x.name.localeCompare(y.name))) {
      let g = groups.find((x) => x.city === b.city);
      if (!g) groups.push((g = { city: b.city, slug: citySlug(b.city), businesses: [] }));
      g.businesses.push(b);
    }
    return groups;
  };
  const trades = (data.lists.trades || [])
    .map((trade) => {
      const list = businesses.filter((b) => b.trade === trade);
      return { trade, slug: themeSlug(trade), url: `/rmb/${themeSlug(trade)}/`, count: list.length, businesses: list, cities: byCity(list) };
    })
    .filter((t) => t.count);
  const speakers = [];
  for (const b of data.businesses || []) {
    if (!b.speaker_topics) continue;
    let sp = speakers.find((x) => x.ref === b.person_ref);
    if (!sp) speakers.push((sp = { ref: b.person_ref, name: b.owner, club: clubById[b.club_id] || null, card: cardUrl(b.person_ref), topics: [] }));
    for (const t of b.speaker_topics.split(/\s*(?:;|\n)\s*/)) if (t && !sp.topics.includes(t)) sp.topics.push(t);
  }
  speakers.sort(byPlainName);
  const rmb = {
    businesses,
    trades,
    cities: byCity(businesses).map((g) => ({ name: g.city, slug: g.slug, count: g.businesses.length })),
    speakers,
    networking: upcomingEvents.filter((e) => e.event_type === 'Business networking evening'),
    form: data.forms?.business || '',
  };
  for (const c of cards) {
    c.businesses = businesses.filter((b) => b.person_ref === c.ref);
    c.speakerTopics = speakers.find((sp) => sp.ref === c.ref)?.topics || [];
  }

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
      businesses: businesses.filter((b) => b.city === name),
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
  // Only the District Governor's profile is shown (the district decided against the RI President's, 11 Nov 2026)
  // Only this year's: last year's Governor is among the Past District Governors
  const profiles = (data.profiles || []).filter((x) => x.role === 'District Governor' && x.rotary_year === rotaryYear).map((x) => ({ ...x, image: img(media, x.photo) }));
  // The home page banner: this year's District Governor, from the About page profile or else the leadership
  // list (photo from their member card). Shown only with a photo; never a past year's governor.
  const govProfile = profiles.find((p) => p.role === 'District Governor' && p.rotary_year === rotaryYear);
  const govRole = governorsByYear.get(rotaryYear);
  const govImage = govProfile?.image || govRole?.image || cardByRef[govRole?.person_ref]?.photo || null;
  const governor = govImage ? {
    name: plainName(govProfile?.name || govRole.name),
    year: rotaryYear,
    theme: govProfile?.theme || '',
    image: govImage,
    url: govProfile ? '/about/#district-governor' : cardUrl(govRole.person_ref),
  } : null;
  // Every Past District Governor, deceased ones too (owner, 24 Nov 2026: listed as now, without a card link)
  const pastGovernors = pastGovernorRows.map((g) => ({ term: g.term, name: pdgName(g.name), club: g.club, card: cardUrl(g.person_ref) })).sort(byTermOldestFirst);

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

  // Club meetings by weekday, then town: for visiting Rotarians, members making up a missed meeting and guests
  const meetings = core.CORE_WEEKDAYS.map((day) => {
    const list = clubs.filter((c) => c.status === 'active' && c.meeting_day === day);
    const towns = [...new Set(list.map((c) => c.city))].sort((a, b) => a.localeCompare(b))
      .map((city) => ({ name: city, url: city ? `/cities/${citySlug(city)}/` : '',
        clubs: list.filter((c) => c.city === city).sort((a, b) => a.name.localeCompare(b.name)) }));
    return { day, slug: day.toLowerCase(), count: list.length, towns };
  });

  return {
    today,
    rotaryYear,
    nextYear,
    meetings,
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
    // the last few district events that have taken place, for the home page (owner, 17 Nov 2026)
    recentDistrictEvents: events.filter((e) => e.isPast && e.isDistrict).reverse().slice(0, 3),
    rmb,
    magazines,
    magazinesByYear,
    messages,
    rolesByYear,
    currentRoles: rolesByYear.find((y) => y.current) || rolesByYear[0],
    people,
    cards,
    directory,
    professions: [...new Set(directory.map((d) => d.profession).filter(Boolean))].sort(),
    areas: [...new Set(directory.map((d) => d.area).filter(Boolean))].sort(),
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
    // Pages with nothing on them yet stay out of the menu and footer until they have content
    has: {
      events: events.length > 0, services: publicServices.length > 0, news: news.length > 0,
      magazine: magazines.length > 0, spotlight: spotlights.length > 0, messages: messages.length > 0,
      // shown once the business form exists, so members can find where to list
      rmb: businesses.length > 0 || speakers.length > 0 || !!rmb.form,
      rmbMenu: businesses.length >= RMB_MENU_AT,
      meetings: meetings.some((d) => d.count > 0),
    },
    governor,
    pastGovernors,
    forms: data.forms,
    generatedAt: data.generated_at,
    rebuildRequestedAt: data.rebuild_requested_at,
    source: data.source,
    deskApiFp: /^[0-9a-f]{64}$/.test(data.desk_api_fp || '') ? data.desk_api_fp : '',
    stats: {
      clubsPosting: new Set(activities.map((a) => a.club_id)).size,
      peopleHelped: activities.reduce((s, a) => s + (a.people_helped || 0), 0),
    },
  };
}
