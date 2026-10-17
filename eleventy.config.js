import { HtmlBasePlugin } from '@11ty/eleventy';
import { core } from './lib/core.mjs';
import { formatDate, formatDayMonth, formatMonth } from './lib/derive.mjs';
import { glossHtml } from './lib/gloss.mjs';
import glossary from './src/_data/glossary.js';
import shortLinks from './src/_data/shortLinks.js';

// The site lives at /rotary3110-website/ on GitHub's free address until the domain is bought.
const PATH_PREFIX = process.env.PATH_PREFIX || '/';
const SITE_URL = (process.env.SITE_URL || 'http://localhost:8080').replace(/\/$/, '');

const icsEscape = (s = '') => String(s).replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
const compact = (d, t) => d.replace(/-/g, '') + (t ? 'T' + t.replace(':', '') + '00' : '');
const nextDay = (iso) => {
  const d = new Date(iso + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
};
const plusHours = (iso, time, hours) => {
  const d = new Date(`${iso}T${time}:00Z`);
  d.setUTCHours(d.getUTCHours() + hours);
  return d.toISOString().slice(0, 16).replace(/[-:]/g, '') + '00';
};

const ICS_HEAD = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Rotary District 3110//Events//EN', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH'];
const ICS_TZ = ['BEGIN:VTIMEZONE', 'TZID:Asia/Kolkata', 'BEGIN:STANDARD', 'DTSTART:19700101T000000', 'TZOFFSETFROM:+0530', 'TZOFFSETTO:+0530', 'TZNAME:IST', 'END:STANDARD', 'END:VTIMEZONE'];
// Long lines are folded at 75 characters, as the calendar standard asks
const fold = (line) => (line.length <= 74 ? line : line.match(/.{1,74}/g).join('\r\n '));

/** One event as calendar lines (India time); a cancelled event updates the calendars of people who saved it. */
function icsEvent(e, stamp, url) {
  const lines = ['BEGIN:VEVENT', `UID:${e.id}@rotary3110`, `DTSTAMP:${stamp}`];
  if (e.start_time) {
    lines.push(`DTSTART;TZID=Asia/Kolkata:${compact(e.start_date, e.start_time)}`);
    lines.push(`DTEND;TZID=Asia/Kolkata:${e.end_date && e.end_date !== e.start_date ? compact(e.end_date, '18:00') : plusHours(e.start_date, e.start_time, 3)}`);
  } else {
    lines.push(`DTSTART;VALUE=DATE:${compact(e.start_date)}`, `DTEND;VALUE=DATE:${compact(nextDay(e.end_date || e.start_date))}`);
  }
  if (e.registration_status === 'Cancelled') lines.push('STATUS:CANCELLED');
  lines.push(`SUMMARY:${icsEscape((e.registration_status === 'Postponed' ? 'Postponed: ' : '') + e.title)}`, `LOCATION:${icsEscape([e.venue, e.city].filter(Boolean).join(', '))}`,
    `DESCRIPTION:${icsEscape([e.description, 'Organiser: ' + e.organiser].filter(Boolean).join('\n'))}`);
  if (url) lines.push(`URL:${url}`);
  lines.push('END:VEVENT');
  return lines.map(fold);
}

export default function (eleventyConfig) {
  eleventyConfig.addPlugin(HtmlBasePlugin);

  // Links to the forms (…/submit/, …/consent/ etc.) open in a new tab, so the website stays open behind the form
  const formLink = new RegExp(String.raw`<a\b(?![^>]*\btarget=)([^>]*\bhref="[^"]*/(?:${shortLinks.map((l) => l.slug).join('|')})/")`, 'g');
  eleventyConfig.addTransform('form-links-new-tab', function (content) {
    if (!(this.page.outputPath || '').endsWith('.html')) return content;
    return content.replace(formLink, '<a target="_blank" rel="noopener"$1');
  });

  // Rotary abbreviations are explained where they first appear on each page
  const abbreviations = glossary.filter((g) => g.abbr);
  eleventyConfig.addTransform('explain-abbreviations', function (content) {
    if (!(this.page.outputPath || '').endsWith('.html')) return content;
    return glossHtml(content, abbreviations);
  });

  eleventyConfig.addPassthroughCopy({ 'src/assets/img': 'assets/img' });
  eleventyConfig.addPassthroughCopy({ 'src/assets/js': 'assets/js' });
  eleventyConfig.addPassthroughCopy({ 'src/assets/css': 'assets/css' });
  eleventyConfig.addPassthroughCopy({ '.cache/media': 'media' });
  for (const w of [400, 600, 700]) {
    eleventyConfig.addPassthroughCopy({ [`node_modules/@fontsource/open-sans/files/open-sans-latin-${w}-normal.woff2`]: `assets/fonts/open-sans-latin-${w}-normal.woff2` });
  }

  eleventyConfig.addGlobalData('siteUrl', SITE_URL + PATH_PREFIX.replace(/\/$/, ''));
  eleventyConfig.addGlobalData('pathPrefix', PATH_PREFIX);
  eleventyConfig.addGlobalData('hideFromSearch', process.env.HIDE_FROM_SEARCH === 'true');
  eleventyConfig.addGlobalData('analyticsToken', process.env.CF_BEACON_TOKEN || '');

  eleventyConfig.addFilter('date', formatDate);
  eleventyConfig.addFilter('month', formatMonth);
  eleventyConfig.addFilter('dayMonth', formatDayMonth);
  eleventyConfig.addFilter('json', (v) => JSON.stringify(v));
  eleventyConfig.addFilter('number', (n) => Number(n || 0).toLocaleString('en-IN'));
  eleventyConfig.addFilter('initials', (name = '') =>
    name.replace(/^(Rtn|PDG|DGE|DGN|DG|Dr|CA)\.?\s+/g, '').replace(/^(Rtn|PDG|DGE|DGN|DG|Dr|CA)\.?\s+/g, '').split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join(''));
  eleventyConfig.addFilter('truncate', (s = '', n = 160) => (s.length > n ? s.slice(0, n - 1).replace(/\s+\S*$/, '') + '…' : s));
  eleventyConfig.addFilter('absolute', (path = '/') => SITE_URL + (PATH_PREFIX.replace(/\/$/, '') + path).replace(/\/{2,}/g, '/'));
  eleventyConfig.addFilter('waShare', (text, path) =>
    'https://wa.me/?text=' + encodeURIComponent(`${text}\n${SITE_URL}${(PATH_PREFIX.replace(/\/$/, '') + path).replace(/\/{2,}/g, '/')}`));
  // WhatsApp share of a ready-made text (the bulletin message already carries its link)
  eleventyConfig.addFilter('waText', (text) => 'https://wa.me/?text=' + encodeURIComponent(text));
  eleventyConfig.addFilter('bulletinMessage', (raw) => core.Core_bulletinMessage(raw, SITE_URL + PATH_PREFIX));
  eleventyConfig.addFilter('tel', (wa = '') => 'tel:+' + wa.replace(/\D/g, ''));
  eleventyConfig.addFilter('xml', (s = '') => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'));
  // "14 Oct 2026, 6:05 am" in India time
  eleventyConfig.addFilter('dateTime', (iso) => {
    if (!iso) return '';
    const d = new Date(new Date(iso).getTime() + 5.5 * 3600 * 1000);
    const h = d.getUTCHours();
    return `${formatDate(d.toISOString().slice(0, 10))}, ${h % 12 || 12}:${String(d.getUTCMinutes()).padStart(2, '0')} ${h < 12 ? 'am' : 'pm'}`;
  });
  eleventyConfig.addFilter('isoDateTime', (d) => (d ? new Date(d).toUTCString() : new Date().toUTCString()));

  // Google Calendar "add event" link (India time)
  eleventyConfig.addFilter('gcal', (e) => {
    const dates = e.start_time
      ? `${compact(e.start_date, e.start_time)}/${e.end_date && e.end_date !== e.start_date ? compact(e.end_date, '18:00') : plusHours(e.start_date, e.start_time, 3)}`
      : `${compact(e.start_date)}/${compact(nextDay(e.end_date || e.start_date))}`;
    const p = new URLSearchParams({ action: 'TEMPLATE', text: e.title, dates, ctz: 'Asia/Kolkata', details: e.description || '', location: [e.venue, e.city].filter(Boolean).join(', ') });
    return 'https://calendar.google.com/calendar/render?' + p.toString();
  });

  // .ics file content for phone calendars: one event
  const icsStamp = () => new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '');
  const eventUrl = (e) => SITE_URL + (PATH_PREFIX.replace(/\/$/, '') + e.url).replace(/\/{2,}/g, '/');
  eleventyConfig.addFilter('ics', (e) => [...ICS_HEAD, ...ICS_TZ, ...icsEvent(e, icsStamp(), eventUrl(e)), 'END:VCALENDAR'].join('\r\n') + '\r\n');
  // The whole district calendar, to subscribe to once: upcoming events and those of the last 90 days
  eleventyConfig.addFilter('icsCalendar', (events, today) => {
    const from = new Date(Date.parse(today + 'T00:00:00Z') - 90 * 86400000).toISOString().slice(0, 10);
    const stamp = icsStamp();
    const body = events.filter((e) => (e.end_date || e.start_date) >= from).flatMap((e) => icsEvent(e, stamp, eventUrl(e)));
    const head = [...ICS_HEAD, 'X-WR-CALNAME:Rotary District 3110', 'X-WR-TIMEZONE:Asia/Kolkata', 'X-WR-CALDESC:Events of Rotary District 3110',
      'REFRESH-INTERVAL;VALUE=DURATION:PT12H', 'X-PUBLISHED-TTL:PT12H'];
    return [...head, ...ICS_TZ, ...body, 'END:VCALENDAR'].join('\r\n') + '\r\n';
  });
  // webcal:// address of the calendar, which phones open as "subscribe"
  eleventyConfig.addFilter('webcal', (path) => (SITE_URL + (PATH_PREFIX.replace(/\/$/, '') + path).replace(/\/{2,}/g, '/')).replace(/^https?:/, 'webcal:'));
  // YouTube video id -> the privacy-enhanced (no-cookie) player address
  eleventyConfig.addFilter('ytEmbed', (id) => `https://www.youtube-nocookie.com/embed/${encodeURIComponent(id)}?autoplay=1&rel=0`);

  return {
    dir: { input: 'src', includes: '_includes', data: '_data', output: '_site' },
    pathPrefix: PATH_PREFIX,
    templateFormats: ['njk', 'md'],
    htmlTemplateEngine: 'njk',
    markdownTemplateEngine: 'njk',
  };
}
