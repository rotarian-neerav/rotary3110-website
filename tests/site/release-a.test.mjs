// Checks on the built website (run after `npm run build`) for Release A: About, cities, clubs by city and meeting day,
// activity filters, "more like this", press, videos, events open to everyone, the calendar subscription, public
// services, contact, year summaries, the posting guide, search, explained abbreviations, home screen and offline.
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { test } from 'node:test';
import ICAL from 'ical.js';
import { parse } from 'node-html-parser';
import { core } from '../../lib/core.mjs';

const SITE = resolve(import.meta.dirname, '../../_site');
const data = JSON.parse(readFileSync(resolve(import.meta.dirname, '../../.cache/public-data.json'), 'utf8'));
const PREFIX = (process.env.PATH_PREFIX || '/').replace(/\/$/, '');
const read = (f) => readFileSync(f, 'utf8');
const page = (url) => read(join(SITE, url, 'index.html'));
const dom = (url) => parse(page(url));
const sample = data.source === 'sample';
const citySlug = (c) => c.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
function walk(dir) {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
}
const htmlFiles = walk(SITE).filter((f) => f.endsWith('.html') && !f.includes(`${join('_site', 'pagefind')}`));

test('the new pages exist', () => {
  for (const p of ['about', 'cities', 'services', 'contact', 'news', 'years', 'how-to-post', 'search', 'offline', 'public-service']) {
    assert.ok(existsSync(join(SITE, p, 'index.html')), `/${p}/`);
  }
  const cities = [...new Set(data.clubs.filter((c) => c.status === 'active' && c.city).map((c) => c.city))];
  for (const c of cities) assert.ok(existsSync(join(SITE, 'cities', citySlug(c), 'index.html')), `city ${c}`);
  for (const y of [...new Set(data.activities.map((a) => core.Core_rotaryYearOf(a.date)))]) assert.ok(existsSync(join(SITE, 'years', y, 'index.html')), `year ${y}`);
  for (const f of ['manifest.webmanifest', 'sw.js', 'events/calendar.ics', 'pagefind/pagefind.js', 'pagefind/pagefind-ui.js']) assert.ok(existsSync(join(SITE, f)), f);
});

test('zones are nowhere on the website (except in what clubs write, or a role title the district itself gives, such as "CDS Bareilly Zone")', () => {
  const titles = [...data.events.flatMap((e) => [e.title, e.description]), ...data.activities.flatMap((a) => [a.title, a.description]),
    ...data.functionaries.map((f) => f.role)].filter((t) => t && /zone/i.test(t));
  for (const f of htmlFiles) {
    let text = parse(read(f)).querySelector('main')?.text || '';
    for (const t of titles) text = text.split(t).join('');
    assert.ok(!/\bzones?\b/i.test(text), `"zone" in ${relative(SITE, f)}`);
  }
  for (const f of ['data/people.json', 'data/directory.json']) assert.ok(!/"zones?"\s*:/.test(read(join(SITE, f))), `no zone field in ${f}`);
});

test('clubs page: grouped by city, each active club once, with its meeting day for the filter', () => {
  const root = dom('clubs');
  const items = root.querySelectorAll('[data-club-item]');
  const active = data.clubs.filter((c) => c.status === 'active');
  assert.equal(items.length, active.length);
  assert.equal(new Set(items.map((li) => li.querySelector('a').getAttribute('href'))).size, active.length);
  for (const c of active) {
    const li = items.find((x) => x.querySelector('a').getAttribute('href').endsWith(`/clubs/${c.slug}/`));
    assert.equal(li.getAttribute('data-day'), c.meeting_day || 'none', c.name);
    assert.equal(li.closest('[data-city-group]').getAttribute('id'), citySlug(c.city));
  }
  const days = root.querySelectorAll('select[name=day] option').map((o) => o.getAttribute('value'));
  assert.deepEqual(days, ['', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday', 'none']);
  assert.ok(root.querySelector('script[src$="/assets/js/clubs.js"]'));
});

test('club pages link to their city; the meeting day shows; services the public can use are listed', () => {
  for (const c of data.clubs.filter((x) => x.status === 'active')) {
    const root = dom(`clubs/${c.slug}`);
    assert.ok(root.querySelector(`.meta a[href$="/cities/${citySlug(c.city)}/"]`), `${c.slug} city link`);
    if (c.meeting_day && !c.meeting) assert.match(root.text, new RegExp(`Meets on ${c.meeting_day}`));
    const mine = (data.public_services || []).filter((x) => x.club_id === c.club_id);
    assert.equal(root.querySelectorAll('#public-services .service-card').length, mine.length, `${c.slug} services`);
  }
});

test('Leadership: Assistant Governors listed with the clubs they look after, no zone headings', () => {
  const root = dom('leadership');
  const section = root.querySelector('#assistant-governors');
  assert.ok(section);
  assert.equal(section.querySelectorAll('h3').length, 0, 'no group headings');
  const ags = data.functionaries.filter((f) => f.section === 'Assistant Governors' && f.rotary_year === data.site.rotary_year);
  const lines = section.querySelectorAll('.ag-clubs');
  assert.equal(lines.length, ags.filter((f) => f.clubs?.length).length);
  for (const l of lines) assert.ok(l.querySelectorAll('a').every((a) => /\/clubs\/[a-z0-9-]+\/$/.test(a.getAttribute('href'))));
});

test('activities page: Rotary-year and avenue filters match the cards', () => {
  const root = dom('activities');
  const years = root.querySelectorAll('select[name=year] option').map((o) => o.getAttribute('value')).filter(Boolean);
  assert.deepEqual(years, [...new Set(data.activities.map((a) => core.Core_rotaryYearOf(a.date)))].sort().reverse());
  const avenues = root.querySelectorAll('select[name=avenue] option').map((o) => o.text.trim()).slice(1);
  assert.deepEqual(avenues, data.lists.avenues.filter((v) => data.activities.some((a) => a.avenue === v)));
  for (const card of root.querySelectorAll('#activity-list .activity')) {
    const a = data.activities.find((x) => card.querySelector('h3 a').getAttribute('href').endsWith(`/activities/${x.id.toLowerCase()}/`));
    assert.equal(card.getAttribute('data-year'), core.Core_rotaryYearOf(a.date));
    assert.equal(card.getAttribute('data-avenue'), a.avenue ? a.avenue.toLowerCase().replace(/[^a-z]+/g, '-').replace(/^-|-$/g, '') : '');
  }
});

test('activity pages: avenue, press line, video (no-cookie player on tap), news markup, and "more like this" without the activity itself', () => {
  for (const a of data.activities) {
    const html = page(`activities/${a.id.toLowerCase()}`);
    const root = parse(html);
    const ld = JSON.parse(root.querySelector('script[type="application/ld+json"]').text);
    assert.equal(ld['@type'], 'NewsArticle');
    assert.equal(ld.headline, a.title);
    assert.match(ld.image, /^https?:\/\//);
    if (a.avenue) assert.equal(root.querySelector('.chip-avenue').text.trim(), a.avenue);
    if (a.press) {
      const line = root.querySelector('.press-line');
      assert.ok(line.text.includes(a.press.paper));
      assert.equal(!!line.querySelector(`a[href="${a.press.link}"]`), !!a.press.link);
    }
    if (a.video?.kind === 'youtube') {
      const fig = root.querySelector('figure.video');
      assert.equal(fig.getAttribute('data-video'), `https://www.youtube-nocookie.com/embed/${a.video.id}?autoplay=1&rel=0`);
      assert.ok(!root.querySelector('iframe'), 'nothing loads from YouTube until tapped');
    } else if (a.video) assert.ok(root.querySelector(`a[href="${a.video.url}"]`));
    const more = root.querySelector('.more-like-this');
    if (more) assert.ok(!more.querySelectorAll('h3 a').some((l) => l.getAttribute('href').endsWith(`/activities/${a.id.toLowerCase()}/`)), `${a.id} not in its own "more"`);
  }
  if (sample) {
    assert.ok(data.activities.some((a) => a.press) && data.activities.some((a) => a.video?.kind === 'youtube'));
    assert.ok(dom(`activities/${data.activities[0].id.toLowerCase()}`).querySelector('.more-like-this'));
  }
});

test('events: "Open to everyone" marked and filterable; event pages list more events but never themselves', () => {
  const root = dom('events');
  for (const e of data.events.filter((x) => x.start_date >= (data.generated_at || '').slice(0, 10) || true)) {
    const item = root.querySelectorAll('.event').find((x) => x.querySelector('h3 a').getAttribute('href').endsWith(`/events/${e.id.toLowerCase()}/`));
    if (!item) continue;
    assert.equal(item.getAttribute('data-open'), e.open_to_all ? 'yes' : 'no', e.title);
    assert.equal(!!item.querySelector('.chip-open'), !!e.open_to_all);
  }
  assert.ok(root.querySelector('[data-open-filter] input[type=checkbox]'));
  for (const e of data.events) {
    const more = dom(`events/${e.id.toLowerCase()}`).querySelector('.more-like-this');
    if (more) assert.ok(!more.querySelectorAll('h3 a').some((l) => l.getAttribute('href').endsWith(`/events/${e.id.toLowerCase()}/`)));
  }
});

test('calendar subscription: one valid calendar with upcoming and recent events, cancellations marked; offered as webcal and to Google', () => {
  const comp = new ICAL.Component(ICAL.parse(read(join(SITE, 'events/calendar.ics'))));
  assert.equal(comp.getFirstPropertyValue('x-wr-calname'), 'Rotary District 3110');
  const events = comp.getAllSubcomponents('vevent');
  const today = new Date(Date.now() + 5.5 * 3600 * 1000).toISOString().slice(0, 10);
  const from = new Date(Date.parse(today + 'T00:00:00Z') - 90 * 86400000).toISOString().slice(0, 10);
  const expected = data.events.filter((e) => (e.end_date || e.start_date) >= from);
  assert.equal(events.length, expected.length);
  for (const e of expected) {
    const ev = events.find((x) => x.getFirstPropertyValue('uid') === `${e.id}@rotary3110`);
    assert.ok(ev, e.id);
    assert.equal(ev.getFirstPropertyValue('status') === 'CANCELLED', e.registration_status === 'Cancelled', `${e.id} status`);
    assert.match(ev.getFirstPropertyValue('url'), new RegExp(`/events/${e.id.toLowerCase()}/$`));
  }
  const box = dom('events').querySelector('#subscribe');
  assert.match(box.querySelector('a[href^="webcal://"]').getAttribute('href'), /^webcal:\/\/[^/]+.*\/events\/calendar\.ics$/);
  assert.match(box.querySelector('a[href^="https://calendar.google.com"]').getAttribute('href'), /cid=webcal%3A%2F%2F/);
});

test('services page: approved services only, grouped by type, each with timings, address, its own tap-to-call number and a map', () => {
  const root = dom('services');
  const cards = root.querySelectorAll('.service-card');
  assert.equal(cards.length, (data.public_services || []).length);
  for (const x of data.public_services || []) {
    const card = cards.find((c) => c.querySelector('h3').text.trim() === x.name);
    assert.ok(card, x.name);
    assert.equal(card.closest('[data-service-group]').querySelector('h2').text.trim(), x.type);
    if (x.phone) assert.equal(card.querySelector('a.service-phone').getAttribute('href'), `tel:${x.tel}`);
    else assert.equal(card.querySelector('a.service-phone'), null);
    if (x.map_link) assert.ok(card.querySelector(`a[href="${x.map_link}"]`));
  }
  if (sample) assert.equal(cards.length, 7);
});

test('city pages: their clubs, events in the city and services; a page for one-club towns too', () => {
  for (const c of [...new Set(data.clubs.filter((x) => x.status === 'active').map((x) => x.city))]) {
    const root = dom(`cities/${citySlug(c)}`);
    const clubs = data.clubs.filter((x) => x.status === 'active' && x.city === c);
    assert.equal(root.querySelectorAll('#clubs li').length, clubs.length, c);
    assert.match(root.querySelector('title').text, new RegExp(`^Rotary in ${c} ·`));
  }
  assert.ok(dom('cities').querySelectorAll('.city-index li').length >= 15);
});

test('About page: profiles, every Past District Governor (a card link only for those with one), the glossary', () => {
  const root = dom('about');
  assert.equal(root.querySelectorAll('.profile-card').length, (data.profiles || []).length);
  const rows = root.querySelectorAll('.past-dgs tbody tr');
  assert.equal(rows.length, (data.past_governors || []).length || rows.length);
  if (sample) {
    assert.equal(rows.length, 28);
    assert.equal(rows.filter((r) => r.querySelector('td:nth-child(2) a')).length, 26, 'the two late governors have no card');
  }
  assert.ok(root.querySelectorAll('.glossary dt').length >= 20);
  assert.equal(root.querySelectorAll('.glossary abbr').length, 0, 'the glossary itself is not marked up again');
  assert.ok(dom('').querySelector('nav[aria-label=Main] a[href$="/about/"]'), 'About is in the menu');
});

test('abbreviations are explained once per page, never in titles, scripts or data', () => {
  const html = page('leadership');
  const root = parse(html);
  const abbrs = root.querySelectorAll('main abbr.gloss');
  assert.ok(abbrs.some((a) => a.text === 'DG' && a.getAttribute('title') === 'District Governor'));
  assert.ok(abbrs.some((a) => a.text === 'PDG'));
  assert.equal(new Set(abbrs.map((a) => a.text)).size, abbrs.length, 'each at most once');
  for (const f of htmlFiles.slice(0, 400)) {
    const s = read(f);
    const head = s.slice(0, s.indexOf('<main'));
    assert.ok(!head.includes('class="gloss"'), `not outside <main>: ${relative(SITE, f)}`);
    for (const m of s.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)) assert.ok(!m[1].includes('class="gloss"'), `not in a script: ${relative(SITE, f)}`);
  }
});

test('home page: this month in Rotary (12 months, the build month showing); header search and larger text', () => {
  const root = dom('');
  const months = root.querySelectorAll('#rotary-month [data-month]');
  assert.equal(months.length, 12);
  const visible = months.filter((m) => !m.hasAttribute('hidden'));
  assert.equal(visible.length, 1);
  assert.match(root.querySelector('header .search-link').getAttribute('href'), /\/search\/$/);
  assert.ok(root.querySelector('header [data-text-size]'));
  assert.ok(root.querySelector('link[rel=manifest]'));
});

test('search: only pages search engines may list are indexed (never the directory, celebrations or unlisted cards)', () => {
  const noindex = (s) => /<meta name="robots" content="noindex/.test(s);
  const hideAll = process.env.HIDE_FROM_SEARCH === 'true';
  let indexed = 0;
  for (const f of htmlFiles) {
    const s = read(f);
    const body = /<main id="main" data-pagefind-body(="")?>/.test(s);
    if (body) indexed++;
    if (!hideAll && noindex(s)) assert.ok(!body, `noindex page indexed for search: ${relative(SITE, f)}`);
  }
  for (const p of ['directory', 'celebrations', 'submit', 'search', 'offline']) assert.doesNotMatch(page(p), /data-pagefind-body/, p);
  assert.ok(indexed > 100);
  assert.ok(existsSync(join(SITE, 'pagefind', 'pagefind-entry.json')));
});

test('home screen and offline: a valid manifest whose icons exist; the offline helper keeps the offline page', () => {
  const m = JSON.parse(read(join(SITE, 'manifest.webmanifest')));
  assert.equal(m.short_name, 'RID 3110');
  assert.equal(m.start_url, (process.env.PATH_PREFIX || '/'));
  for (const icon of m.icons) assert.ok(existsSync(join(SITE, icon.src.slice((process.env.PATH_PREFIX || '/').length - 1))), icon.src);
  assert.ok(m.icons.some((i) => i.purpose === 'maskable'));
  const sw = read(join(SITE, 'sw.js'));
  assert.match(sw, /OFFLINE = BASE \+ 'offline\/'/);
  assert.match(sw, /fetch\(req\)\.then/, 'network first');
  assert.doesNotMatch(read(join(SITE, 'sitemap.xml')), /\/offline\//);
});

test('contact page: the form inside the page when its link is set, otherwise "soon"; never an email address', () => {
  const root = dom('contact');
  if (data.forms?.contact) assert.match(root.querySelector('iframe').getAttribute('src'), /embedded=true/);
  else assert.ok(root.querySelector('.callout'));
  assert.doesNotMatch(page('contact') + page('privacy'), /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/);
});

test('In the news and the year summaries match the data', () => {
  const news = dom('news').querySelectorAll('.news-list li');
  assert.equal(news.length, data.activities.filter((a) => a.press).length);
  for (const y of [...new Set(data.activities.map((a) => core.Core_rotaryYearOf(a.date)))]) {
    const n = data.activities.filter((a) => core.Core_rotaryYearOf(a.date) === y).length;
    assert.match(dom(`years/${y}`).querySelector('.stats').text, new RegExp(`${n.toLocaleString('en-IN')}\\s*activities`));
  }
});

test('the footer links to the new pages; form short links open in a new tab', () => {
  const footer = dom('').querySelectorAll('.site-footer a').map((a) => a.getAttribute('href'));
  for (const p of ['/services/', '/cities/', '/news/', '/years/', '/about/', '/contact/', '/how-to-post/', '/public-service/', '/events/calendar.ics']) {
    assert.ok(footer.some((h) => h.endsWith(p)), p);
  }
  const ps = dom('').querySelector('.site-footer a[href$="/public-service/"]');
  assert.equal(ps.getAttribute('target'), '_blank');
});
