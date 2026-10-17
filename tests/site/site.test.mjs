// Checks on the built website in _site/ (run after `npm run build`).
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

function walk(dir) {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
}
const files = walk(SITE);
const htmlFiles = files.filter((f) => f.endsWith('.html'));
const textFiles = files.filter((f) => /\.(html|json|xml|txt|ics)$/.test(f));
const read = (f) => readFileSync(f, 'utf8');
const page = (url) => read(join(SITE, url, 'index.html'));

test('one page per club, activity and event, plus a calendar file per event', () => {
  for (const c of data.clubs) assert.ok(existsSync(join(SITE, 'clubs', c.slug, 'index.html')), `club page ${c.slug}`);
  for (const a of data.activities) assert.ok(existsSync(join(SITE, 'activities', a.id.toLowerCase(), 'index.html')), `activity ${a.id}`);
  for (const e of data.events) {
    assert.ok(existsSync(join(SITE, 'events', e.id.toLowerCase(), 'index.html')), `event ${e.id}`);
    assert.ok(existsSync(join(SITE, 'events', e.id.toLowerCase() + '.ics')), `ics ${e.id}`);
  }
  for (const p of ['activities', 'events', 'clubs', 'magazine', 'messages', 'leadership', 'teams', 'directory', 'celebrations', 'recognition', 'spotlight', 'privacy', 'submit', 'club-profile', 'consent', 'remove', 'qr']) {
    assert.ok(existsSync(join(SITE, p, 'index.html')), `/${p}/`);
  }
});

test('nothing pending, rejected or without photo/link appears anywhere', () => {
  for (const f of textFiles) {
    const s = read(f);
    for (const marker of ['PENDING-SAMPLE', 'REJECTED-SAMPLE', 'NOPHOTO-SAMPLE']) {
      assert.ok(!s.includes(marker), `${marker} found in ${relative(SITE, f)}`);
    }
  }
});

test('no phone numbers or email addresses, except consented WhatsApp links and the district contact', () => {
  // digits inside a word (e.g. a photo file's hash) are not phone numbers
  const phone = /(?<![\w/=.-])(?:\+?91[\s-]?)?[6-9]\d{4}[\s-]?\d{5}(?!\w)/g;
  const email = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;
  for (const f of textFiles) {
    const s = read(f).replace(/https:\/\/wa\.me\/91\d{10}/g, '').replace(/tel:\+91\d{10}/g, '');
    const emails = (s.match(email) || []).filter((e) => e !== 'rotarian.neerav@gmail.com');
    assert.deepEqual(emails, [], `email in ${relative(SITE, f)}`);
    assert.deepEqual(s.match(phone) || [], [], `phone number in ${relative(SITE, f)}`);
  }
});

test('WhatsApp links appear only for members who agreed', () => {
  const dir = JSON.parse(read(join(SITE, 'data/directory.json')));
  const consented = new Set(data.members.filter((m) => m.contact_ok).map((m) => m.contact_link));
  for (const m of dir) if (m.wa) assert.ok(consented.has(m.wa), `unconsented link for ${m.name}`);
  if (data.source === 'sample') {
    assert.ok(dir.some((m) => m.sampleContact), 'sample data should include members who agreed to a contact button');
    assert.ok(!dir.some((m) => m.wa), 'sample members never get a real WhatsApp link');
  }
});

test('celebrations and directory data carry no years', () => {
  for (const f of ['data/celebrations.json', 'data/directory.json']) {
    const s = read(join(SITE, f));
    assert.ok(!/\b(19[2-9]\d|20[0-3]\d)\b/.test(s), `a year appears in ${f}`);
  }
  const c = JSON.parse(read(join(SITE, 'data/celebrations.json')));
  for (const b of c.birthdays) assert.match(b.md, /^\d{2}-\d{2}$/);
  for (const a of c.anniversaries) assert.match(a.md, /^\d{2}-\d{2}$/);
});

test('every internal link and image points to a real file', () => {
  const missing = [];
  for (const f of htmlFiles) {
    const root = parse(read(f));
    const refs = [...root.querySelectorAll('a[href]').map((a) => a.getAttribute('href')), ...root.querySelectorAll('img[src]').map((i) => i.getAttribute('src')),
      ...root.querySelectorAll('link[href]').map((l) => l.getAttribute('href')), ...root.querySelectorAll('script[src]').map((s) => s.getAttribute('src'))];
    for (const ref of refs) {
      if (!ref || !ref.startsWith('/') || ref.startsWith('//')) continue;
      let path = decodeURIComponent(ref.split('#')[0].split('?')[0]);
      if (PREFIX && path.startsWith(PREFIX)) path = path.slice(PREFIX.length) || '/';
      const target = path.endsWith('/') ? join(SITE, path, 'index.html') : join(SITE, path);
      if (!existsSync(target)) missing.push(`${relative(SITE, f)} -> ${ref}`);
    }
  }
  assert.deepEqual([...new Set(missing)].slice(0, 20), []);
});

test('calendar files are valid and in India time', () => {
  for (const f of files.filter((x) => x.endsWith('.ics'))) {
    const comp = new ICAL.Component(ICAL.parse(read(f)));
    const ev = comp.getFirstSubcomponent('vevent');
    assert.ok(ev, `no event in ${f}`);
    assert.ok(ev.getFirstPropertyValue('summary'));
    const start = ev.getFirstProperty('dtstart');
    if (start.getParameter('tzid')) assert.equal(start.getParameter('tzid'), 'Asia/Kolkata');
    assert.ok(comp.getFirstSubcomponent('vtimezone') || !start.getParameter('tzid'), 'timezone definition present');
  }
});

test('every page has a title, description, share preview and a mobile viewport', () => {
  for (const f of htmlFiles) {
    const root = parse(read(f));
    const where = relative(SITE, f);
    assert.ok(root.querySelector('title')?.text.trim(), `title: ${where}`);
    assert.ok(root.querySelector('meta[name=viewport]'), `viewport: ${where}`);
    assert.ok(root.querySelector('meta[name=description]')?.getAttribute('content'), `description: ${where}`);
    const og = root.querySelector('meta[property="og:image"]')?.getAttribute('content') || '';
    assert.match(og, /^https?:\/\//, `og:image absolute: ${where}`);
    for (const img of root.querySelectorAll('img')) assert.ok(img.hasAttribute('alt'), `img alt in ${where}`);
  }
});

test('activity pages use their own photo for WhatsApp previews', () => {
  const a = data.activities.find((x) => x.photos.length);
  const og = parse(page(`activities/${a.id.toLowerCase()}`)).querySelector('meta[property="og:image"]').getAttribute('content');
  assert.match(og, /\/media\/activity-[0-9a-f]+-og\.jpg$/);
  const ogFile = join(SITE, 'media', og.split('/media/')[1]);
  assert.ok(statSync(ogFile).size < 300 * 1024, 'preview image under 300 KB so WhatsApp shows it');
});

test('event pages show their photos and use one for WhatsApp previews', () => {
  const e = data.events.find((x) => x.photos?.length);
  if (!e && data.source !== 'sample') return; // the live Sheet may not have any event photos yet
  assert.ok(e, 'sample has an event with photos');
  const html = page(`events/${e.id.toLowerCase()}`);
  assert.match(html, /class="photos photos-\d"/);
  assert.match(parse(html).querySelector('meta[property="og:image"]').getAttribute('content'), /-og\.jpg$/);
});

test('until launch (HIDE_FROM_SEARCH=true) every page and robots.txt keep search engines out', () => {
  if (process.env.HIDE_FROM_SEARCH !== 'true') return;
  for (const p of ['', 'activities', 'clubs', 'teams', 'leadership']) assert.match(page(p), /<meta name="robots" content="noindex/, p || 'home');
  assert.match(read(join(SITE, 'robots.txt')), /User-agent: \*\n# Test site[^\n]*\nDisallow: \/\n/);
});

test('directory, celebrations and form pages are kept out of search engines', () => {
  for (const p of ['directory', 'celebrations', 'submit', 'consent', 'remove', 'qr']) {
    assert.match(page(p), /<meta name="robots" content="noindex/, p);
  }
  if (process.env.HIDE_FROM_SEARCH !== 'true') for (const p of ['', 'activities', 'clubs', 'teams', 'leadership']) {
    assert.doesNotMatch(page(p), /name="robots"/, `${p || 'home'} should be indexable`);
  }
  const sitemap = read(join(SITE, 'sitemap.xml'));
  assert.ok(!sitemap.includes('/directory/') && !sitemap.includes('/celebrations/'));
  assert.ok(sitemap.includes('/activities/'));
  // every club, activity and event page, not only the first of each
  for (const c of data.clubs) assert.ok(sitemap.includes(`/clubs/${c.slug}/<`), `sitemap: club ${c.slug}`);
  for (const a of data.activities) assert.ok(sitemap.includes(`/activities/${a.id.toLowerCase()}/<`), `sitemap: ${a.id}`);
  for (const e of data.events) assert.ok(sitemap.includes(`/events/${e.id.toLowerCase()}/<`), `sitemap: ${e.id}`);
  assert.ok(!sitemap.includes('/members/<') && !/\/clubs\/[a-z0-9-]+\/members\//.test(sitemap), 'club member lists are not in the sitemap');
});

test('robots.txt blocks AI crawlers and image search of member photos, not normal search', () => {
  const robots = read(join(SITE, 'robots.txt'));
  for (const bot of ['GPTBot', 'CCBot', 'Google-Extended', 'ClaudeBot']) assert.ok(robots.includes(`User-agent: ${bot}`), bot);
  assert.match(robots, /User-agent: Googlebot-Image\nDisallow: \S*media\/person-/);
  if (process.env.HIDE_FROM_SEARCH !== 'true') assert.doesNotMatch(robots, /User-agent: \*\nDisallow: \/\n/);
});

test('pages stay light for slow connections', () => {
  const home = statSync(join(SITE, 'index.html')).size;
  const css = statSync(join(SITE, 'assets/css/site.css')).size;
  const js = files.filter((f) => f.includes(join('assets', 'js'))).reduce((s, f) => s + statSync(f).size, 0);
  assert.ok(home + css + js < 200 * 1024, `home page + css + js = ${Math.round((home + css + js) / 1024)} KB`);
  assert.ok(js < 30 * 1024, `all scripts = ${Math.round(js / 1024)} KB`);
  const people = files.filter((f) => /media[\\/]person-.*-sq\.webp$/.test(f));
  for (const f of people) assert.ok(statSync(f).size < 40 * 1024, `member photo too large: ${f}`);
});

test("home page recognition matches the hand-worked sample (September 2026)", () => {
  if ((process.env.SITE_TODAY || '').slice(0, 7) !== '2026-10' || data.source !== 'sample') return;
  const home = page('');
  assert.match(home, /Recognition · September 2026/);
  assert.match(home, /RC Kanpur Divinity/, 'smallest qualifying club wins most active per member');
  assert.match(home, /Safe delivery kits for 120 mothers/, "September's story of the month");
});

test('Teams and Leadership pages list every person from the Excel', () => {
  const html = page('teams') + page('leadership');
  for (const f of data.functionaries.filter((x) => x.rotary_year === data.site.rotary_year)) assert.ok(html.includes(f.name.replace(/&/g, '&amp;').replace(/'/g, '&#39;')) || html.includes(f.name), `missing ${f.name}`);
});

const sitemap = () => read(join(SITE, 'sitemap.xml'));
const cardPages = () => readdirSync(join(SITE, 'members')).map((d) => ({ url: `/members/${d}/`, html: page(`members/${d}`) }));
const isNoindex = (html) => /<meta name="robots" content="noindex/.test(html);

test('member cards: hidden from search engines unless the person agreed to be listed; nothing they did not agree to', () => {
  const cards = cardPages();
  assert.ok(cards.length > 50);
  const map = sitemap();
  let listed = 0;
  for (const c of cards) {
    const root = parse(c.html);
    const head = root.querySelector('.member-head');
    assert.ok(head, `card layout: ${c.url}`);
    assert.doesNotMatch(c.html, /birthday|anniversary|spouse/i, `no birthday, anniversary or spouse: ${c.url}`);
    // until launch every page carries noindex, so the sitemap tells which cards the person agreed to list
    const hideAll = process.env.HIDE_FROM_SEARCH === 'true';
    if (hideAll) assert.ok(isNoindex(c.html), `noindex until launch: ${c.url}`);
    if (hideAll ? !map.includes(c.url) : isNoindex(c.html)) {
      assert.ok(!map.includes(c.url), `hidden card not in sitemap: ${c.url}`);
      assert.equal(head.querySelectorAll('p.role').length, 0, `no profession without consent: ${c.url}`);
      assert.ok(!root.querySelector('main p.lead'), `no description without consent: ${c.url}`);
      assert.ok(!head.querySelector('a.wa[href*="wa.me"]'), `no WhatsApp without consent: ${c.url}`);
    } else {
      listed++;
      assert.ok(map.includes(c.url), `listed card in sitemap: ${c.url}`);
    }
  }
  if (data.source === 'sample') assert.ok(listed > 0 && listed < cards.length, 'sample has both kinds of card');
});

test("PDG Sharat Chandra's card shows his 4 roles this year, then last year's", () => {
  if (data.source !== 'sample') return;
  const card = cardPages().find((c) => c.url.startsWith('/members/sharat-chandra-'));
  assert.ok(card);
  const years = parse(card.html).querySelectorAll('.role-year');
  assert.match(years[0].querySelector('h3').text, new RegExp(data.site.rotary_year));
  assert.equal(years[0].querySelectorAll('li').length, 4);
  assert.match(years[1].querySelector('h3').text, /2023-24/);
});

test('every office bearer and team member with a member ID links to a working card; every club has a members page', () => {
  for (const c of data.clubs) {
    const root = parse(page(`clubs/${c.slug}`));
    assert.ok(root.querySelector(`a[href$="/clubs/${c.slug}/members/"]`), `members link on ${c.slug}`);
    assert.ok(existsSync(join(SITE, 'clubs', c.slug, 'members', 'index.html')), `members page ${c.slug}`);
    const officers = data.officers.filter((o) => o.club_id === c.club_id && o.rotary_year === data.site.rotary_year && o.person_ref);
    const links = root.querySelectorAll('.people-grid .person strong a').map((a) => a.getAttribute('href'));
    assert.equal(links.length, officers.length, `${c.slug}: office bearers link to cards`);
    for (const l of links) assert.match(l, /\/members\/[a-z0-9-]+\/$/);
  }
  const leaders = parse(page('leadership') + page('teams')).querySelectorAll('.person strong');
  assert.ok(leaders.length > 100 && leaders.every((s) => s.querySelector('a')), 'Leadership and Teams names link to cards');
});

test('someone marked deceased: no card, not on the club or directory pages, name kept as plain text in past years', () => {
  if (data.source !== 'sample') return;
  const sample = JSON.parse(read(resolve(import.meta.dirname, '../../sample/sample-data.json')));
  const dead = sample.private.members_master.find((m) => m.status === 'deceased' && m.is_rotarian);
  const club = data.clubs.find((c) => c.club_id === dead.club_id);
  assert.ok(!page(`clubs/${club.slug}`).includes(dead.name), "not among this year's office bearers");
  assert.ok(!page(`clubs/${club.slug}/members`).includes(dead.name));
  assert.ok(!read(join(SITE, 'data/directory.json')).includes(dead.name));
  assert.ok(!cardPages().some((c) => c.html.includes(dead.name)), 'no card mentions them');
  const past = parse(page('leadership/2023-24'));
  const entry = past.querySelectorAll('.person strong').find((s) => s.text.trim() === dead.name);
  assert.ok(entry, "still in last year's leadership");
  assert.equal(entry.querySelector('a'), null, 'as plain text, not a link');
});

test('home page: sections in the agreed order; at most 8 events, district events first', () => {
  const html = page('');
  const order = ['class="hero"', 'id="upcoming-events"', 'id="latest"', 'id="recognition"', 'id="spotlight"', 'id="celebrations"', 'id="magazine"', 'id="messages"', 'class="cta-band"'];
  const at = order.map((m) => html.indexOf(m));
  for (let i = 0; i < order.length; i++) assert.ok(at[i] >= 0, `${order[i]} present`);
  for (let i = 1; i < order.length; i++) assert.ok(at[i - 1] < at[i], `${order[i - 1]} before ${order[i]}`);
  const events = parse(html).querySelectorAll('#upcoming-events .event');
  assert.ok(events.length <= 8);
  const district = events.map((e) => !!e.querySelector('.chip-district'));
  assert.ok(district.indexOf(false) < 0 || district.slice(district.indexOf(false)).every((d) => !d), 'district events first');
  if (data.source === 'sample') assert.equal(events.length, 8);
});

test('form links open in a new tab', () => {
  let count = 0;
  for (const f of htmlFiles) {
    for (const a of parse(read(f)).querySelectorAll('a[href]')) {
      if (!/\/(submit|club-profile|consent|remove)\/$/.test(a.getAttribute('href'))) continue;
      count++;
      assert.equal(a.getAttribute('target'), '_blank', `${relative(SITE, f)}: ${a.getAttribute('href')}`);
      assert.equal(a.getAttribute('rel'), 'noopener');
    }
  }
  assert.ok(count > 100);
});

/* ---------- club services and projects, campaigns, event registration, weekly bulletin ---------- */

test('club pages show regular services and permanent projects; the clubs list counts them', () => {
  const withLists = data.clubs.filter((c) => c.services?.length || c.projects?.length);
  if (data.source === 'sample') assert.ok(withLists.length >= 3);
  for (const c of withLists) {
    const root = parse(page(`clubs/${c.slug}`));
    assert.equal(root.querySelectorAll('#services li').length, c.services.length, `${c.slug} services`);
    assert.equal(root.querySelectorAll('#projects li').length, c.projects.length, `${c.slug} projects`);
    assert.match(root.toString(), /club-profile\/"[^>]*>Is something missing\?/);
  }
  if (withLists.length) assert.match(page('clubs'), /\d+ (service|project)s?/);
});

test('campaign pages: one per campaign with the right total; the list groups them by Rotary year', () => {
  if (!data.campaigns?.length) {
    assert.ok(!existsSync(join(SITE, 'campaigns', 'index.html')) || !/class="campaign-list"/.test(page('campaigns')));
    return;
  }
  for (const c of data.campaigns) {
    const t = core.Core_campaignTotals(c, data.activities);
    const html = page(`campaigns/${c.slug}`);
    assert.match(html, new RegExp(`<strong>${Number(t.total).toLocaleString('en-IN')}</strong> ${c.unit}`), c.campaign_id);
    assert.doesNotMatch(html, /\blive\b/i, 'never claims to be live');
  }
  assert.ok(page('campaigns').includes(`Rotary year ${data.campaigns[0].rotary_year}`));
});

test('home page: campaign band while one runs, and the line to this week\'s bulletin', () => {
  const html = page('');
  assert.match(html, /id="this-week"[\s\S]*?href="[^"]*\/bulletin\/"/);
  const today = new Date(Date.now() + 5.5 * 3600 * 1000).toISOString().slice(0, 10);
  const running = (data.campaigns || []).filter((c) => c.start_date <= today && (!c.end_date || today <= c.end_date));
  assert.equal(parse(html).querySelectorAll('#campaigns .campaign-card').length, running.length);
  if (running.length) assert.ok(html.indexOf('id="campaigns"') < html.indexOf('id="upcoming-events"'), 'campaigns above upcoming events');
});

test('weekly bulletin: this week\'s page, a dated page for every Sunday, the archive; only dated pages in the sitemap', () => {
  const current = parse(page('bulletin'));
  const canonical = current.querySelector('link[rel=canonical]').getAttribute('href');
  assert.match(canonical, /\/bulletin\/\d{4}-\d{2}-\d{2}\/$/);
  const dated = canonical.match(/\/bulletin\/(\d{4}-\d{2}-\d{2})\/$/)[1];
  assert.equal(new Date(dated + 'T00:00:00Z').getUTCDay(), 0, 'dated by a Sunday');
  assert.ok(existsSync(join(SITE, 'bulletin', dated, 'index.html')));
  const archive = parse(page('bulletin/archive')).querySelectorAll('.bulletin-archive a').map((a) => a.getAttribute('href'));
  assert.ok(archive.length >= 1);
  for (const href of archive) assert.ok(existsSync(join(SITE, href.replace(PREFIX, ''), 'index.html')), href);
  if (data.source === 'sample') assert.ok(archive.length >= 5, 'sample: four weeks of archive plus this week');
  const msg = current.querySelector('.bulletin-message').rawText.replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, '&');
  assert.ok(msg.length <= 1000);
  assert.match(msg, new RegExp(`Full bulletin: \\S+/bulletin/${dated}/`));
  assert.match(current.querySelector('title').text, /^This week in Rotary District 3110 – /);
  const sitemap = read(join(SITE, 'sitemap.xml'));
  assert.ok(sitemap.includes(`/bulletin/${dated}/<`));
  assert.ok(!sitemap.includes('/bulletin/<'), 'the undated page points search engines to the dated one');
});

test('menu has no bulletin or campaigns entries; the footer links to them (campaigns only when there are any)', () => {
  const home = parse(page(''));
  const nav = home.querySelectorAll('nav[aria-label=Main] a').map((a) => a.getAttribute('href'));
  assert.ok(!nav.some((h) => /\/(bulletin|campaigns)\//.test(h)));
  const footer = home.querySelectorAll('.site-footer a').map((a) => a.getAttribute('href'));
  assert.ok(footer.some((h) => h.endsWith('/bulletin/')));
  assert.equal(footer.some((h) => h.endsWith('/campaigns/')), !!data.campaigns?.length);
});

test('event registration: cancelled events stay listed and say so, also in the calendar file; postponed never shows "Registration open"', () => {
  for (const e of data.events) {
    const html = page(`events/${e.id.toLowerCase()}`);
    if (e.registration_status === 'Cancelled') {
      assert.match(html, /class="reg-line reg-cancelled"/);
      assert.match(read(join(SITE, 'events', e.id.toLowerCase() + '.ics')), /STATUS:CANCELLED/);
    }
    if (e.registration_status === 'Postponed') assert.doesNotMatch(html, /Registration open/);
    if (e.fee) assert.ok(html.includes(e.fee));
  }
  if (data.source === 'sample') assert.ok(data.events.some((e) => e.registration_status === 'Cancelled'));
});

test('activities tagged to a campaign show the tag, linking to the campaign page', () => {
  const tagged = data.activities.filter((a) => a.campaign_id);
  if (data.source === 'sample') assert.ok(tagged.length >= 5);
  for (const a of tagged) {
    const c = data.campaigns.find((x) => x.campaign_id === a.campaign_id);
    if (!core.Core_inCampaign(c, a.date)) continue;
    assert.match(page(`activities/${a.id.toLowerCase()}`), new RegExp(`class="chip chip-campaign" href="[^"]*/campaigns/${c.slug}/"`), a.id);
  }
});
