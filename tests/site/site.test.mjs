// Checks on the built website in _site/ (run after `npm run build`).
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { test } from 'node:test';
import ICAL from 'ical.js';
import { parse } from 'node-html-parser';

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

test('directory, celebrations and form pages are kept out of search engines', () => {
  for (const p of ['directory', 'celebrations', 'submit', 'consent', 'remove', 'qr']) {
    assert.match(page(p), /<meta name="robots" content="noindex/, p);
  }
  for (const p of ['', 'activities', 'clubs', 'teams', 'leadership']) {
    assert.doesNotMatch(page(p), /name="robots"/, `${p || 'home'} should be indexable`);
  }
  const sitemap = read(join(SITE, 'sitemap.xml'));
  assert.ok(!sitemap.includes('/directory/') && !sitemap.includes('/celebrations/'));
  assert.ok(sitemap.includes('/activities/'));
});

test('robots.txt blocks AI crawlers and image search of member photos, not normal search', () => {
  const robots = read(join(SITE, 'robots.txt'));
  for (const bot of ['GPTBot', 'CCBot', 'Google-Extended', 'ClaudeBot']) assert.ok(robots.includes(`User-agent: ${bot}`), bot);
  assert.match(robots, /User-agent: Googlebot-Image\nDisallow: \S*media\/person-/);
  assert.doesNotMatch(robots, /User-agent: \*\nDisallow: \/\n/);
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
  for (const f of data.functionaries) assert.ok(html.includes(f.name.replace(/&/g, '&amp;').replace(/'/g, '&#39;')) || html.includes(f.name), `missing ${f.name}`);
});
