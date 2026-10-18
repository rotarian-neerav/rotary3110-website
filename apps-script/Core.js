/**
 * Core rules shared by the Google Apps Script and the website build.
 *
 * Everything here is plain JavaScript with no Google or Node APIs, so the exact
 * same file runs inside the Sheet's script and in the website's automatic tests.
 * It decides what may become public: nothing pending, nothing without consent,
 * never a birth or marriage year, never a phone number or email outside a
 * consented contact link.
 */

var CORE_THEMES = [
  'Promoting peace',
  'Fighting disease',
  'Providing clean water',
  'Saving mothers and children',
  'Supporting education',
  'Growing local economies',
  'Protecting the environment',
  'Club service / Other',
];

var CORE_EVENT_TYPES = [
  'District event',
  'Club event open to all',
  'Vocational visit',
  'Business networking evening',
  'Training or seminar',
];

var IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

// Event registration states a moderator may set by hand (blank = worked out from the closing date)
var CORE_REG_STATUSES = ['Seats full', 'Extended', 'Postponed', 'Cancelled'];
// First choice of the activity form's campaign question
var CORE_NO_CAMPAIGN = 'Not part of a district campaign';
// Club services and projects: one item per line, each line cut to this length, at most this many lines
var CORE_LINE_MAX = 160;
var CORE_LIST_MAX = 12;
// Payment details are never shown with an event's fee
var CORE_PAYMENT_RE = /\b(upi|ifsc)\b|\ba\/c\b/i;
var MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// Rotary's five Avenues of Service (asked on the activity form, alongside the area of focus)
var CORE_AVENUES = ['Club Service', 'Vocational Service', 'Community Service', 'International Service', 'Youth Service'];
// Kinds of lasting facility the public can use (the public service form)
var CORE_SERVICE_TYPES = ['Blood bank', 'Eye care', 'Dialysis', 'Clinic / health centre', 'Library', 'Skill / vocational centre', 'Ambulance', 'Other'];
var CORE_WEEKDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
// The contact form: at most this many messages are emailed on, per day, unless the setting says otherwise
var CORE_CONTACT_DAILY_LIMIT = 20;

// Types of moderator (the moderators tab). What each receives is in Core_moderatorEmails' callers; Members and
// Administrator also get the private members Sheet.
var CORE_MODERATOR_TYPES = ['Content', 'Members', 'Club engagement', 'District office', 'Administrator'];
var CORE_PRIVATE_SHEET_TYPES = ['Members', 'Administrator'];
// Placeholder rows written once into an empty moderators tab; a row without an email is ignored
var CORE_MODERATOR_PLACEHOLDERS = [
  ['Content', 'Moderator A'], ['Content', 'Moderator B'], ['Members', 'Moderator C'], ['Club engagement', 'Moderator D'],
  ['District office', 'District office'], ['Administrator', 'Website administrator'],
];

function Core_isTrue(v) {
  if (v === true) return true;
  if (v === false || v == null) return false;
  var s = String(v).trim().toLowerCase();
  return s === 'true' || s === 'yes' || s === 'y' || s === '1';
}

function Core_str(v) {
  if (v == null) return '';
  return String(v).trim();
}

function Core_pad(n) {
  return n < 10 ? '0' + n : String(n);
}

/** A Sheet date (Date object) or text, as YYYY-MM-DD in India time. */
function Core_isoDate(v) {
  if (v == null || v === '') return '';
  if (Object.prototype.toString.call(v) === '[object Date]') {
    if (isNaN(v.getTime())) return '';
    var d = new Date(v.getTime() + IST_OFFSET_MS);
    return d.getUTCFullYear() + '-' + Core_pad(d.getUTCMonth() + 1) + '-' + Core_pad(d.getUTCDate());
  }
  var s = Core_str(v);
  var m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return m[1] + '-' + Core_pad(+m[2]) + '-' + Core_pad(+m[3]);
  m = s.match(/^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{4})$/); // DD/MM/YYYY
  if (m) return m[3] + '-' + Core_pad(+m[2]) + '-' + Core_pad(+m[1]);
  return '';
}

/** A time cell or text as HH:MM. */
function Core_time(v) {
  if (v == null || v === '') return '';
  if (Object.prototype.toString.call(v) === '[object Date]') {
    var d = new Date(v.getTime() + IST_OFFSET_MS);
    return Core_pad(d.getUTCHours()) + ':' + Core_pad(d.getUTCMinutes());
  }
  var m = Core_str(v).match(/^(\d{1,2}):(\d{2})/);
  return m ? Core_pad(+m[1]) + ':' + m[2] : '';
}

/** Day and month only ("MM-DD") from a full date, "DD-MM" text or "MM-DD" text. Never keeps a year. */
function Core_dayMonth(v) {
  if (v == null || v === '') return '';
  var iso = Core_isoDate(v);
  if (iso) return iso.slice(5);
  var s = Core_str(v);
  var m = s.match(/^(\d{1,2})[\/.-](\d{1,2})$/); // DD-MM as typed by people in India
  if (m) {
    var day = +m[1];
    var month = +m[2];
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) return Core_pad(month) + '-' + Core_pad(day);
  }
  return '';
}

function Core_isoTimestamp(v) {
  if (v == null || v === '') return '';
  if (Object.prototype.toString.call(v) === '[object Date]') return isNaN(v.getTime()) ? '' : v.toISOString();
  return Core_str(v);
}

/** Converts a 2D array (first row = headers) into objects. */
function Core_rows(values) {
  if (!values || values.length < 1) return [];
  var headers = values[0].map(function (h) { return Core_str(h); });
  var out = [];
  for (var r = 1; r < values.length; r++) {
    var row = values[r];
    var empty = true;
    var obj = {};
    for (var c = 0; c < headers.length; c++) {
      if (!headers[c]) continue;
      obj[headers[c]] = row[c];
      if (row[c] !== '' && row[c] != null) empty = false;
    }
    if (!empty) out.push(obj);
  }
  return out;
}

function Core_list(v) {
  return Core_str(v).split(/\s*[,;\n]\s*/).filter(function (x) { return x; });
}

function Core_slug(s) {
  return Core_str(s).toLowerCase().replace(/^rc\s+/, '').replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

/** Indian mobile number as 91XXXXXXXXXX, or '' if it is not a valid 10-digit mobile. */
function Core_mobile(v) {
  var digits = Core_str(v).replace(/\D/g, '');
  if (digits.length === 12 && digits.indexOf('91') === 0) digits = digits.slice(2);
  if (digits.length === 11 && digits.charAt(0) === '0') digits = digits.slice(1);
  return /^[6-9]\d{9}$/.test(digits) ? '91' + digits : '';
}

function Core_url(v) {
  var s = Core_str(v);
  return /^https?:\/\/[^\s]+$/i.test(s) ? s : '';
}

function Core_firstName(name) {
  return Core_str(name).replace(/^(Rtn|Dr|Mr|Mrs|Ms|Smt|Shri)\.?\s+/i, '').split(/\s+/)[0] || '';
}

/* ------------------------------------------------------------------ */
/* Dates                                                               */
/* ------------------------------------------------------------------ */

function Core_addDays(iso, n) {
  var d = new Date(iso + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** The Sunday on or before a date (YYYY-MM-DD). */
function Core_sundayOf(iso) {
  return Core_addDays(iso, -new Date(iso + 'T00:00:00Z').getUTCDay());
}

/** Midnight at the start of a date in India, as milliseconds. */
function Core_istMidnight(iso) {
  return Date.parse(iso + 'T00:00:00Z') - IST_OFFSET_MS;
}

/** "19 Oct 2026", or "19 Oct" when short. */
function Core_dateLabel(iso, short) {
  if (!iso) return '';
  var p = iso.split('-');
  return (+p[2]) + ' ' + MONTHS_SHORT[+p[1] - 1] + (short ? '' : ' ' + p[0]);
}

/** The Rotary year (1 July to 30 June) a date falls in, e.g. "2026-27". */
function Core_rotaryYearOf(iso) {
  var y = +iso.slice(0, 4);
  var start = +iso.slice(5, 7) >= 7 ? y : y - 1;
  return start + '-' + String(start + 1).slice(2);
}

/** 1226 -> "1,226"; 122600 -> "1,22,600" (Indian grouping). */
function Core_formatNumber(n) {
  var s = String(Math.round(Number(n) || 0));
  if (s.length <= 3) return s;
  var rest = s.slice(0, -3).replace(/\B(?=(\d{2})+(?!\d))/g, ',');
  return rest + ',' + s.slice(-3);
}

/* ------------------------------------------------------------------ */
/* Free text typed by clubs or moderators                              */
/* ------------------------------------------------------------------ */

function Core_unsafeText(s) {
  return CORE_PHONE_RE.test(s) || CORE_EMAIL_RE.test(s);
}

/**
 * A text field that may be published, or '' if it holds a phone number or email address. Such text is
 * left out (and listed in skipped) rather than stopping the whole build.
 */
function Core_safeText(v, where, skipped) {
  var s = Core_str(v);
  if (s && Core_unsafeText(s)) {
    skipped.push(where);
    return '';
  }
  return s;
}

/**
 * Rows whose ID was already used are left out, so two rows with one ID cannot stop the build.
 * A real row wins over a sample row; otherwise the first row wins. Left-out IDs go to `duplicates`.
 */
function Core_uniqueRows(rows, duplicates) {
  var real = {};
  rows.forEach(function (r) { if (!Core_isTrue(r.is_sample)) real[Core_str(r.id)] = true; });
  var seen = {};
  return rows.filter(function (r) {
    var id = Core_str(r.id);
    if (!id) return true;
    if (seen[id] || (real[id] && Core_isTrue(r.is_sample))) {
      duplicates.push(id);
      return false;
    }
    seen[id] = true;
    return true;
  });
}

/**
 * A club's list of projects or services: one item per line. Blank lines go; a line with a phone number
 * or email goes (listed in skipped); each line is cut to 160 characters; at most 12 lines.
 */
function Core_cleanLines(cell, where, skipped) {
  var out = [];
  Core_str(cell).split(/\r?\n/).forEach(function (line) {
    line = line.trim();
    if (!line) return;
    if (Core_unsafeText(line)) {
      skipped.push(where + ' line');
      return;
    }
    out.push(line.length > CORE_LINE_MAX ? line.slice(0, CORE_LINE_MAX).trim() : line);
  });
  return out.slice(0, CORE_LIST_MAX);
}

/**
 * "Free eye check-up – every Thursday – Roshni Centre" -> {what, when, where}. Parts are separated by a
 * dash with spaces round it, so "11 am–1 pm" stays whole. A line with no separator stays in the first part.
 */
function Core_lineParts(line, keys) {
  var parts = Core_str(line).split(/\s+[–—-]\s+/);
  if (parts.length > keys.length) parts = parts.slice(0, keys.length - 1).concat([parts.slice(keys.length - 1).join(' – ')]);
  var o = {};
  keys.forEach(function (k, i) { o[k] = Core_str(parts[i]); });
  return o;
}

/**
 * A club's meeting weekday: the answer to the weekday question, or, until the club answers it, the first
 * weekday named in its meeting text ("Every Thursday, 7:30 pm…" -> "Thursday"). '' if neither gives one.
 */
function Core_meetingDay(day, meetingText) {
  var d = Core_str(day).toLowerCase();
  for (var i = 0; i < CORE_WEEKDAYS.length; i++) if (CORE_WEEKDAYS[i].toLowerCase() === d) return CORE_WEEKDAYS[i];
  var m = Core_str(meetingText).match(/\b(mon|tue|wed|thu|fri|sat|sun)[a-z]*\b/i);
  if (!m) return '';
  var short = m[1].toLowerCase();
  for (var j = 0; j < CORE_WEEKDAYS.length; j++) if (CORE_WEEKDAYS[j].toLowerCase().indexOf(short) === 0) return CORE_WEEKDAYS[j];
  return '';
}

/**
 * A public service's own phone number (a blood bank's or hospital's, never a person's), for display and a
 * tap-to-call link. Digits, spaces, +, - and brackets only; 3 to 13 digits (108 and 1800 numbers too).
 * Returns { display, tel } or null.
 */
function Core_servicePhone(v) {
  var s = Core_str(v).replace(/\s+/g, ' ');
  if (!s || !/^[\d\s+()\-]{3,24}$/.test(s)) return null;
  var digits = s.replace(/\D/g, '');
  if (digits.length < 3 || digits.length > 13) return null;
  var tel = digits;
  if (s.charAt(0) === '+') tel = '+' + digits;
  else if (digits.length === 10 && /^[6-9]/.test(digits)) tel = '+91' + digits;
  else if (digits.length === 11 && digits.charAt(0) === '0') tel = '+91' + digits.slice(1);
  return { display: s, tel: tel };
}

/** A video link: YouTube gets its video id (played on the page); Instagram, Facebook and others stay links. */
function Core_videoLink(v) {
  var url = Core_url(v);
  if (!url) return null;
  var yt = url.match(/^https?:\/\/(?:www\.|m\.)?(?:youtube\.com\/(?:watch\?(?:[^#]*&)?v=|shorts\/|embed\/|live\/)|youtu\.be\/)([A-Za-z0-9_-]{11})(?![A-Za-z0-9_-])/i);
  if (yt) return { kind: 'youtube', id: yt[1], url: url };
  var host = (url.match(/^https?:\/\/([^/?#]+)/i) || [])[1] || '';
  host = host.toLowerCase().replace(/^www\.|^m\./, '');
  var kind = /(^|\.)instagram\.com$/.test(host) ? 'instagram' : /(^|\.)(facebook\.com|fb\.watch)$/.test(host) ? 'facebook' : 'other';
  return { kind: kind, id: '', url: url };
}

/** A club id from a club id or a club name ("RC Agra" or "Agra"); '' if it matches no club. */
function Core_clubRef(value, clubs) {
  var v = Core_str(value);
  if (!v) return '';
  var plain = function (s) { return Core_str(s).toLowerCase().replace(/^(rc|rotary club of)\s+/, '').replace(/\s+/g, ' '); };
  for (var i = 0; i < clubs.length; i++) {
    var c = clubs[i];
    if (Core_str(c.club_id) === v || plain(c.club_name || c.name) === plain(v)) return Core_str(c.club_id);
  }
  return '';
}

/**
 * The contact form: a message is held back (not emailed on) when it looks like spam: more than two links,
 * or hardly any words. Returns '' when it may be forwarded, or the reason it was held back.
 */
function Core_contactCheck(message) {
  var m = Core_str(message);
  var links = (m.match(/https?:\/\/|www\./gi) || []).length;
  if (links > 2) return 'more than two links';
  if ((m.match(/[A-Za-zऀ-ॿ]{2,}/g) || []).length < 3) return 'too short to be a real message';
  return '';
}

/**
 * Active clubs with no activity (approved or waiting for a moderator) dated in the given month ("YYYY-MM"),
 * with the date of their last activity: clubs that have never posted first, then the oldest last activity.
 * For the private monthly email to the district.
 */
/** A moderators-tab row counts unless active is FALSE; it needs a real email. */
function Core_moderatorActive(r) {
  return !(r.active === false || Core_str(r.active).toUpperCase() === 'FALSE') && CORE_EMAIL_RE.test(Core_str(r.email));
}

/** Emails of the active moderators of one type, each once, lower case. */
function Core_moderatorEmails(rows, type) {
  var out = [];
  (rows || []).forEach(function (r) {
    var e = Core_str(r.email).toLowerCase();
    if (Core_str(r.type) === type && Core_moderatorActive(r) && out.indexOf(e) < 0) out.push(e);
  });
  return out;
}

/**
 * Who should be added to or removed from the two Sheets so access matches the moderators tab. Every active
 * moderator edits the main Sheet; only Members and Administrator moderators get the private members Sheet.
 * Only people listed in the tab are ever removed (as inactive, or no longer of a private-Sheet type); the owner
 * and anyone not in the tab are left alone.
 */
function Core_moderatorAccess(rows, owner, mainEditors, privateEditors) {
  var low = function (list) { return (list || []).map(function (e) { return Core_str(e).toLowerCase(); }).filter(String); };
  var me = Core_str(owner).toLowerCase();
  var listed = low((rows || []).map(function (r) { return r.email; }));
  var wantMain = [];
  var wantPrivate = [];
  (rows || []).forEach(function (r) {
    if (!Core_moderatorActive(r)) return;
    var e = Core_str(r.email).toLowerCase();
    if (wantMain.indexOf(e) < 0) wantMain.push(e);
    if (CORE_PRIVATE_SHEET_TYPES.indexOf(Core_str(r.type)) >= 0 && wantPrivate.indexOf(e) < 0) wantPrivate.push(e);
  });
  var plan = function (want, have) {
    have = low(have);
    return {
      add: want.filter(function (e) { return e !== me && have.indexOf(e) < 0; }),
      remove: have.filter(function (e, i) { return e !== me && have.indexOf(e) === i && listed.indexOf(e) >= 0 && want.indexOf(e) < 0; }),
    };
  };
  var m = plan(wantMain, mainEditors);
  var p = plan(wantPrivate, privateEditors);
  return { addMain: m.add, removeMain: m.remove, addPrivate: p.add, removePrivate: p.remove };
}

/** The types one email holds in the moderators tab (active rows only), in the tab's type order. */
function Core_moderatorTypesOf(rows, email) {
  var e = Core_str(email).toLowerCase();
  return CORE_MODERATOR_TYPES.filter(function (t) { return e && Core_moderatorEmails(rows, t).indexOf(e) >= 0; });
}

/** What a moderator sees on the moderation desk. The Administrator sees everything. */
function Core_deskViews(types) {
  var has = function (t) { return (types || []).indexOf(t) >= 0 || (types || []).indexOf('Administrator') >= 0; };
  return { content: has('Content'), members: has('Members'), clubs: has('Club engagement'), office: has('District office') };
}

/**
 * Active clubs with no activity (approved or waiting) dated in the last `days` days up to today, for the Club
 * engagement moderators: clubs that have never posted first, then the oldest last activity.
 */
function Core_quietClubs(clubs, activities, today, days) {
  var from = Core_addDays(today, -days);
  var last = {};
  (activities || []).forEach(function (a) {
    var s = Core_str(a.status).toLowerCase();
    var d = Core_isoDate(a.date);
    if ((s !== 'approved' && s !== 'pending') || !d || d > today) return;
    var id = Core_str(a.club_id);
    if (!last[id] || d > last[id]) last[id] = d;
  });
  return (clubs || []).filter(function (c) {
    return Core_str(c.club_id) && Core_str(c.status || 'active').toLowerCase() === 'active' && !(last[Core_str(c.club_id)] >= from);
  }).map(function (c) {
    return { club_id: Core_str(c.club_id), club_name: Core_str(c.club_name), zone: Core_str(c.zone), last_activity_date: last[Core_str(c.club_id)] || '' };
  }).sort(function (a, b) { return a.last_activity_date.localeCompare(b.last_activity_date) || a.club_name.localeCompare(b.club_name); });
}

/** A newspaper name that is really a web address (sent in the press_paper answer by mistake). */
function Core_looksLikeUrl(v) {
  var s = Core_str(v);
  return !/\s/.test(s) && (/^(https?:\/\/|www\.)/i.test(s) || /^[a-z0-9-]+(\.[a-z0-9-]+)*\.(com|in|org|net|co|news|info)(\/|$)/i.test(s));
}

function Core_clubsNotPosting(clubs, activities, month) {
  var last = {};
  var posted = {};
  (activities || []).forEach(function (a) {
    var st = Core_str(a.status).toLowerCase();
    if (st !== 'approved' && st !== 'pending') return;
    var d = Core_isoDate(a.date);
    var id = Core_str(a.club_id);
    if (!d || !id || d.slice(0, 7) > month) return;
    if (d.slice(0, 7) === month) posted[id] = true;
    if (!last[id] || d > last[id]) last[id] = d;
  });
  return (clubs || []).filter(function (c) {
    return Core_str(c.club_id) && Core_str(c.status || 'active').toLowerCase() === 'active' && !posted[Core_str(c.club_id)];
  }).map(function (c) {
    return { club_id: Core_str(c.club_id), club_name: Core_str(c.club_name || c.name), last_activity_date: last[Core_str(c.club_id)] || '' };
  }).sort(function (a, b) {
    return (a.last_activity_date || '').localeCompare(b.last_activity_date || '') || a.club_name.localeCompare(b.club_name);
  });
}

/* ------------------------------------------------------------------ */
/* Events, campaigns and the weekly bulletin                           */
/* ------------------------------------------------------------------ */

/** clubNames: {lower-case club name: true}. A district event, or one organised by a district team rather than a club. */
function Core_isDistrictEvent(e, clubNames) {
  return e.event_type === 'District event' || !clubNames[Core_str(e.organiser).toLowerCase()];
}

/**
 * The registration line shown with an event, worked out on refDate (today on event pages; the bulletin's
 * own Sunday on a bulletin, so an archived bulletin keeps saying what it said that week).
 */
function Core_registrationLine(e, refDate) {
  var status = Core_str(e.registration_status);
  var close = Core_str(e.registration_close_date);
  var text = '';
  var state = '';
  if (status === 'Cancelled') { text = 'Cancelled'; state = 'cancelled'; }
  else if (status === 'Postponed') { text = 'Postponed – new date to be announced'; state = 'postponed'; }
  else if (status === 'Seats full') { text = 'Seats full'; state = 'full'; }
  else if (status === 'Extended') { text = close ? 'Registration extended till ' + Core_dateLabel(close, true) : 'Registration extended'; state = 'open'; }
  else if (close) {
    if (close >= refDate) { text = 'Registration open till ' + Core_dateLabel(close, true); state = 'open'; }
    else { text = 'Registration closed'; state = 'closed'; }
  }
  var fee = Core_str(e.fee);
  return { text: text, state: state, fee: fee, line: [text, fee ? 'Fee: ' + fee : ''].filter(function (x) { return x; }).join(' · ') };
}

/** The basic fields of a campaigns tab row, or null if it has no id, name or start date. */
function Core_campaignRow(c) {
  var row = {
    campaign_id: Core_str(c.campaign_id),
    rotary_year: Core_str(c.rotary_year),
    name: Core_str(c.name),
    unit: Core_str(c.unit),
    start_date: Core_isoDate(c.start_date),
    end_date: Core_isoDate(c.end_date),
  };
  if (!row.campaign_id || !row.name || !row.start_date) return null;
  row.slug = Core_str(c.slug) || Core_slug(row.name + '-' + row.rotary_year);
  return row;
}

/** The activity form's choice for a campaign, e.g. "Blood Donation Drive 2026-27 (blood units)". */
function Core_campaignLabel(c) {
  return Core_str(c.name) + (Core_str(c.rotary_year) ? ' ' + Core_str(c.rotary_year) : '') + (Core_str(c.unit) ? ' (' + Core_str(c.unit) + ')' : '');
}

/** Campaigns the activity form offers on a date: until 30 days after a campaign ends, for late reports. */
function Core_openCampaigns(rows, today) {
  return (rows || []).map(Core_campaignRow).filter(function (c) {
    return c && (!c.end_date || Core_addDays(c.end_date, 30) >= today);
  });
}

/** Maps a form answer back to a campaign id; '' for "Not part of a district campaign" or an unknown label. */
function Core_campaignIdForLabel(label, rows) {
  var l = Core_str(label);
  if (!l || l === CORE_NO_CAMPAIGN) return '';
  var list = (rows || []).map(Core_campaignRow).filter(function (c) { return c; });
  for (var i = 0; i < list.length; i++) if (Core_campaignLabel(list[i]) === l) return list[i].campaign_id;
  return '';
}

/** Only work done during the campaign counts (late reports of that work are fine). */
function Core_inCampaign(c, date) {
  return !!date && date >= c.start_date && (!c.end_date || date <= c.end_date);
}

/**
 * Running total of a campaign from approved activities. A joint activity counts only for the club that
 * sent it. An activity tagged without a count is a report that adds 0. With beforeMs, only activities
 * approved before that moment count (activities with no approval time are older and always count).
 */
function Core_campaignTotals(c, activities, beforeMs) {
  var byClub = {};
  var order = [];
  var total = 0;
  var ids = [];
  (activities || []).forEach(function (a) {
    if (!c.campaign_id || a.campaign_id !== c.campaign_id || !Core_inCampaign(c, a.date)) return;
    if (beforeMs != null && a.approved_at && Date.parse(a.approved_at) >= beforeMs) return;
    var n = Math.max(0, Math.floor(Number(a.campaign_count) || 0));
    total += n;
    ids.push(a.id);
    if (!byClub[a.club_id]) {
      byClub[a.club_id] = { club_id: a.club_id, entries: 0, count: 0 };
      order.push(a.club_id);
    }
    byClub[a.club_id].entries++;
    byClub[a.club_id].count += n;
  });
  var list = order.map(function (k) { return byClub[k]; }).sort(function (x, y) { return y.count - x.count || y.entries - x.entries; });
  return { total: total, entries: ids.length, clubs: list.length, by_club: list, activity_ids: ids };
}

/**
 * "This week in District 3110" for the bulletin dated `sunday`, from the public data (approved rows only).
 * Fixed rules, so the website and the Sheet's emails always pick the same items:
 *  - coming up: events starting in the 14 days from Sunday, or still running; district events first; at most 10
 *  - registration closing soon: other events whose registration closes in the 7 days from Sunday
 *  - done last week: activities approved in the 7 days before Sunday; story of the month first, then those
 *    with photos; one per club; ties go round the cities in turn, newest first; at most 6
 *  - campaign totals: campaigns running on Sunday, counting reports approved before Sunday
 */
function Core_bulletin(data, sunday) {
  var S = sunday;
  var clubById = {};
  var clubNames = {};
  (data.clubs || []).forEach(function (c) {
    clubById[c.club_id] = c;
    clubNames[Core_str(c.name).toLowerCase()] = true;
  });
  var weekEnd = Core_addDays(S, 6);
  var fortnightEnd = Core_addDays(S, 13);
  function eventItem(e) {
    return {
      id: e.id, title: e.title, start_date: e.start_date, end_date: e.end_date, start_time: e.start_time, city: e.city,
      organiser: e.organiser, is_district: Core_isDistrictEvent(e, clubNames), registration: Core_registrationLine(e, S),
    };
  }
  var allEvents = (data.events || []).filter(function (e) { return !e.bulletin_exclude; });
  var coming = allEvents.filter(function (e) {
    return (e.start_date >= S && e.start_date <= fortnightEnd) || (e.start_date < S && e.end_date && S <= e.end_date);
  }).map(eventItem).sort(function (a, b) {
    return (b.is_district - a.is_district) || a.start_date.localeCompare(b.start_date) ||
      (a.start_time || '').localeCompare(b.start_time || '') || a.id.localeCompare(b.id);
  }).slice(0, 10);
  var listed = {};
  coming.forEach(function (e) { listed[e.id] = true; });
  var closing = allEvents.filter(function (e) {
    var close = Core_str(e.registration_close_date);
    return !listed[e.id] && close >= S && close <= weekEnd && ['Cancelled', 'Postponed'].indexOf(e.registration_status) < 0;
  }).sort(function (a, b) {
    return a.registration_close_date.localeCompare(b.registration_close_date) || a.start_date.localeCompare(b.start_date);
  }).map(eventItem);

  var from = Core_istMidnight(Core_addDays(S, -7));
  var to = Core_istMidnight(S);
  var acts = (data.activities || []).filter(function (a) {
    if (a.bulletin_exclude || !a.approved_at) return false;
    var t = Date.parse(a.approved_at);
    return !isNaN(t) && t >= from && t < to;
  });
  var newestFirst = function (a, b) { return b.date.localeCompare(a.date) || b.id.localeCompare(a.id); };
  var tiers = [
    acts.filter(function (a) { return a.story_of_month; }),
    acts.filter(function (a) { return !a.story_of_month && a.photos && a.photos.length; }),
    acts.filter(function (a) { return !a.story_of_month && !(a.photos && a.photos.length); }),
  ];
  var picked = [];
  var usedClubs = {};
  tiers.forEach(function (tier) {
    // the newest activity of each club not yet picked, then round the cities in turn (the city with the newest first)
    var queues = [];
    var cityQueue = {};
    tier.slice().sort(newestFirst).forEach(function (a) {
      if (usedClubs[a.club_id]) return;
      usedClubs[a.club_id] = true;
      var city = clubById[a.club_id] ? Core_str(clubById[a.club_id].city) : '';
      if (!cityQueue[city]) queues.push((cityQueue[city] = []));
      cityQueue[city].push(a);
    });
    for (var more = true; more;) {
      more = false;
      for (var z = 0; z < queues.length; z++) {
        if (queues[z] && queues[z].length) {
          picked.push(queues[z].shift());
          more = true;
        }
      }
    }
  });
  picked = picked.slice(0, 6);
  var pickedIds = {};
  picked.forEach(function (a) { pickedIds[a.id] = true; });
  var countClubs = function (list) {
    var seen = {};
    list.forEach(function (a) { seen[a.club_id] = true; });
    return Object.keys(seen).length;
  };
  var rest = acts.filter(function (a) { return !pickedIds[a.id]; });

  var campaigns = (data.campaigns || []).filter(function (c) {
    return c.start_date <= S && (!c.end_date || S <= c.end_date);
  }).sort(function (a, b) { return a.sort_order - b.sort_order || a.name.localeCompare(b.name); }).map(function (c) {
    var t = Core_campaignTotals(c, data.activities, to);
    return { campaign_id: c.campaign_id, slug: c.slug, name: c.name, unit: c.unit, total: t.total, entries: t.entries, clubs: t.clubs };
  });

  return {
    sunday: S,
    district: (data.site && data.site.district) || 'Rotary District 3110',
    events: coming,
    closing: closing,
    done: {
      items: picked.map(function (a) {
        return { id: a.id, title: a.title, club_id: a.club_id, club_name: clubById[a.club_id] ? clubById[a.club_id].name : '', date: a.date };
      }),
      total: acts.length,
      clubs: countClubs(acts),
      more: rest.length,
      more_clubs: countClubs(rest),
    },
    campaigns: campaigns,
    empty: !coming.length && !closing.length && !acts.length && !campaigns.length,
  };
}

/** The bulletin as a plain-text WhatsApp message of at most 1,000 characters. */
function Core_bulletinMessage(b, siteUrl) {
  var link = Core_str(siteUrl).replace(/\/?$/, '/') + 'bulletin/' + b.sunday + '/';
  var plural = function (n, one, many) { return Core_formatNumber(n) + ' ' + (n === 1 ? one : many); };
  function build(eventCount, titleMax) {
    var cut = function (s) { return s.length > titleMax ? s.slice(0, titleMax - 1).trim() + '…' : s; };
    var lines = ['*This week in ' + b.district + '* – ' + Core_dateLabel(b.sunday)];
    if (b.empty) lines.push('A quiet week – no new activities or events.');
    var events = b.events.slice(0, eventCount);
    if (events.length) {
      lines.push('*Coming up*');
      events.forEach(function (e) {
        lines.push('• ' + Core_dateLabel(e.start_date, true) + ' – ' + cut(e.title) + (e.city ? ', ' + e.city : '') +
          (e.registration.text ? ' – ' + e.registration.text : ''));
      });
    }
    if (b.done.total) {
      var titles = b.done.items.slice(0, 2).map(function (a) { return cut(a.title); });
      lines.push('*Done last week:* ' + plural(b.done.total, 'activity', 'activities') + ' from ' + plural(b.done.clubs, 'club', 'clubs') +
        (titles.length ? ', including ' + titles.join(', ') : '') + '.');
    }
    b.campaigns.forEach(function (c) {
      lines.push('*' + c.name + ':* ' + Core_formatNumber(c.total) + (c.unit ? ' ' + c.unit : '') + ' so far (' + plural(c.clubs, 'club', 'clubs') + ')');
    });
    lines.push('Full bulletin: ' + link);
    return lines.join('\n');
  }
  var eventCount = Math.min(5, b.events.length);
  var text = build(eventCount, 80);
  while (text.length > 1000 && eventCount > 1) text = build(--eventCount, 80);
  if (text.length > 1000) text = build(eventCount, 30);
  if (text.length > 1000) text = text.slice(0, 1000 - link.length - 17).trim() + '…\nFull bulletin: ' + link;
  return text;
}

/* ------------------------------------------------------------------ */
/* Members and couples: private master -> public tabs                  */
/* ------------------------------------------------------------------ */

/**
 * Builds the rows of the public members and couples tabs from the private sheet.
 * Only active Rotarians whose listing a moderator approved, only the fields they ticked,
 * birthdays and anniversaries as day and month only.
 *
 * master:  rows of members_master
 * couples: rows of couples
 * makeKey: function returning a new random public key (used when a member has none yet)
 * Returns { members, couples, newKeys: {member_id: key}, inactiveKeys: [keys of deceased or departed people] }
 */
function Core_buildMembersPublic(master, couples, makeKey) {
  var byId = {};
  var newKeys = {};
  var members = [];

  master.forEach(function (m) {
    var id = Core_str(m.member_id);
    if (id) byId[id] = m;
  });

  function keyFor(m) {
    var key = Core_str(m.public_key);
    if (!key) {
      key = newKeys[m.member_id] || makeKey();
      newKeys[m.member_id] = key;
    }
    return key;
  }

  function isActiveRotarian(m) {
    return m && Core_isTrue(m.is_rotarian) && Core_str(m.status || 'active').toLowerCase() === 'active';
  }

  master.forEach(function (m) {
    if (!isActiveRotarian(m)) return;
    if (!Core_isTrue(m.listing_approved)) return;
    var directory = Core_isTrue(m.directory_ok);
    var sample = Core_isTrue(m.is_sample);
    // sample members never get a real WhatsApp link; the site shows their buttons as switched off
    var contact = directory && Core_isTrue(m.contact_ok) && (sample || !!Core_mobile(m.mobile));
    var photo = Core_isTrue(m.photo_ok) && Core_isTrue(m.photo_approved) && !!Core_str(m.photo_file);
    var birthday = Core_isTrue(m.birthday_ok) && !!Core_dayMonth(m.dob);
    if (!directory && !photo && !birthday) return;

    members.push({
      public_key: keyFor(m),
      member_id: Core_str(m.member_id), // internal only: used to attach photos to roles, never published
      name: Core_str(m.name),
      club_id: Core_str(m.club_id),
      directory_ok: directory,
      profession: directory ? Core_str(m.profession) : '',
      area: directory ? Core_str(m.area) : '',
      description: directory ? Core_str(m.description) : '',
      website: directory ? Core_url(m.website) : '',
      contact_ok: contact,
      contact_link: contact && !sample ? 'https://wa.me/' + Core_mobile(m.mobile) : '',
      photo_ok: photo,
      photo_file: photo ? Core_str(m.photo_file) : '',
      birthday_ok: birthday,
      birthday: birthday ? Core_dayMonth(m.dob) : '',
      spotlight_ok: directory && Core_isTrue(m.spotlight_ok),
      is_sample: Core_isTrue(m.is_sample),
    });
  });

  var publicCouples = [];
  couples.forEach(function (c) {
    if (Core_str(c.status).toLowerCase() !== 'active') return;
    var a = byId[Core_str(c.person_a_id)];
    var b = byId[Core_str(c.person_b_id)];
    if (!a || !b) return;
    if (!isActiveRotarian(a)) return; // person A is always the member who asked
    var bStatus = Core_str(b.status || 'active').toLowerCase();
    if (bStatus !== 'active') return; // deceased or left: no anniversary greetings
    if (!Core_isTrue(c.a_consent) || !Core_isTrue(c.b_consent)) return;
    var anniversary = Core_dayMonth(c.anniversary);
    if (!anniversary) return;
    var bIsRotarian = Core_isTrue(b.is_rotarian);
    var couplePhoto = Core_isTrue(c.couple_photo_ok_a) && Core_isTrue(c.couple_photo_ok_b) &&
      Core_isTrue(c.couple_photo_approved) && !!Core_str(c.couple_photo_file);

    publicCouples.push({
      couple_key: Core_str(c.couple_id),
      person_a_key: keyFor(a),
      person_a_name: Core_str(a.name),
      person_a_club_id: Core_str(a.club_id),
      person_b_key: bIsRotarian ? keyFor(b) : '',
      // a spouse who is not a member is shown by first name only, never alone in a photo
      person_b_name: bIsRotarian ? Core_str(b.name) : Core_firstName(b.name),
      person_b_club_id: bIsRotarian ? Core_str(b.club_id) : '',
      anniversary: anniversary,
      both_consented: true,
      couple_photo_file: couplePhoto ? Core_str(c.couple_photo_file) : '',
      is_sample: Core_isTrue(c.is_sample),
    });
  });

  var inactiveKeys = master.filter(function (m) {
    return Core_str(m.public_key) && Core_str(m.status || 'active').toLowerCase() !== 'active';
  }).map(function (m) { return Core_str(m.public_key); });

  return { members: members, couples: publicCouples, newKeys: newKeys, inactiveKeys: inactiveKeys };
}

/* ------------------------------------------------------------------ */
/* Main sheet -> public website data                                   */
/* ------------------------------------------------------------------ */

function Core_settings(rows) {
  var s = {};
  rows.forEach(function (r) {
    var k = Core_str(r.key);
    if (k) s[k] = r.value;
  });
  return s;
}

function Core_photoRefs(v) {
  return Core_list(v).map(function (ref) {
    // Google Form uploads arrive as Drive links; keep just the file id
    var m = ref.match(/[-\w]{25,}/);
    if (ref.indexOf('sample:') === 0 || ref.indexOf('thumb:') === 0) return ref;
    return m ? 'drive:' + m[0] : '';
  }).filter(function (x) { return x; });
}

/**
 * Turns the main sheet's tabs into the data the website is built from.
 * tabs: { settings, clubs, officers, functionaries, activities, events, magazines,
 *         messages, spotlights, members_public, couples_public, campaigns, public_services,
 *         profiles, past_governors }
 * Each is an array of row objects (see Core_rows).
 * options.personRef(memberId): the scrambled reference that links one person's roles and listing
 *   (the Sheet uses a keyed hash, so the member ID cannot be worked back from it).
 * options.inactiveIds: member IDs marked deceased or left in the private members list. Their
 *   current-year roles are left out; past roles keep the name only, with no link, photo or contact.
 */
function Core_buildPublicData(tabs, nowIso, options) {
  var opts = options || {};
  var personRef = opts.personRef || function (id) { return 'P' + Core_hash(id) + Core_hash('#' + id).slice(0, 4); };
  var inactiveIds = {};
  (opts.inactiveIds || []).forEach(function (id) { if (Core_str(id)) inactiveIds[Core_str(id)] = true; });
  var settings = Core_settings(tabs.settings || []);
  var rotaryYear = Core_str(settings.current_rotary_year);
  // free text left out because it held a phone number or email (one careless entry must not stop the build)
  var skippedItems = [];

  var clubs = (tabs.clubs || []).filter(function (c) { return Core_str(c.club_id); }).map(function (c) {
    var where = 'club ' + Core_str(c.club_id);
    return {
      club_id: Core_str(c.club_id),
      slug: Core_str(c.slug) || Core_slug(c.club_name),
      name: Core_str(c.club_name),
      display_name: Core_str(c.display_name) || Core_str(c.club_name).replace(/^RC\s+/, 'Rotary Club of '),
      former_names: Core_list(c.former_names),
      // zones are the district's internal grouping and may change, so they never reach the website
      city: Core_str(c.city),
      status: Core_str(c.status || 'active').toLowerCase(),
      member_count: Number(c.member_count) || 0,
      meeting: Core_safeText(c.meeting_day_place, where + ' meeting', skippedItems),
      meeting_day: Core_meetingDay(c.meeting_day, c.meeting_day_place),
      links: {
        website: Core_url(c.website),
        facebook: Core_url(c.facebook),
        instagram: Core_url(c.instagram),
        youtube: Core_url(c.youtube),
        x: Core_url(c.x),
        linkedin: Core_url(c.linkedin),
      },
      projects: Core_cleanLines(c.permanent_projects, where, skippedItems).map(function (l) { return Core_lineParts(l, ['name', 'what', 'where']); }),
      services: Core_cleanLines(c.regular_services, where, skippedItems).map(function (l) { return Core_lineParts(l, ['what', 'when', 'where']); }),
    };
  });
  var clubIds = {};
  clubs.forEach(function (c) { clubIds[c.club_id] = true; });

  var members = (tabs.members_public || []).map(function (m) {
    return {
      public_key: Core_str(m.public_key),
      member_id: Core_str(m.member_id),
      name: Core_str(m.name),
      club_id: Core_str(m.club_id),
      directory_ok: Core_isTrue(m.directory_ok),
      profession: Core_str(m.profession),
      area: Core_str(m.area),
      description: Core_str(m.description),
      website: Core_url(m.website),
      contact_ok: Core_isTrue(m.contact_ok),
      contact_link: Core_str(m.contact_link),
      photo_ok: Core_isTrue(m.photo_ok),
      photo: Core_photoRefs(m.photo_file)[0] || '',
      birthday_ok: Core_isTrue(m.birthday_ok),
      birthday: Core_str(m.birthday),
      spotlight_ok: Core_isTrue(m.spotlight_ok),
      sample: Core_isTrue(m.is_sample), // sample contact buttons are shown disabled on the site
    };
  });
  var photoByMemberId = {};
  members.forEach(function (m) {
    m.person_ref = m.member_id ? personRef(m.member_id) : '';
    if (m.photo_ok && m.photo && m.member_id) photoByMemberId[m.member_id] = { photo: m.photo, key: m.public_key };
  });

  function roleRow(r) {
    var id = Core_str(r.member_id);
    var inactive = !!(id && inactiveIds[id]);
    var p = inactive ? null : photoByMemberId[id];
    var contact = !inactive && Core_isTrue(r.contact_ok) && Core_str(r.contact_link) ? Core_str(r.contact_link) : '';
    return {
      rotary_year: Core_str(r.rotary_year),
      person_key: p ? p.key : '',
      // no reference for someone deceased or departed: their past roles show the name only, with no card
      person_ref: id && !inactive ? personRef(id) : '',
      name: Core_str(r.name),
      role: Core_str(r.role),
      club_id: Core_str(r.club_id),
      photo: p ? p.photo : '',
      contact_ok: !!contact,
      contact_link: contact,
    };
  }

  // Current-year roles of people who have died or left are not shown at all
  function current(r) {
    return Core_str(r.name) && !(inactiveIds[Core_str(r.member_id)] && Core_str(r.rotary_year) === rotaryYear);
  }

  var officers = (tabs.officers || []).filter(current).map(roleRow);

  var clubRows = tabs.clubs || [];
  var functionaries = (tabs.functionaries || []).filter(current).map(function (f) {
    var row = roleRow(f);
    row.page = Core_str(f.page);
    row.section = Core_str(f.section);
    row.committee = Core_str(f.committee);
    row.term = Core_str(f.term);
    // an Assistant Governor's clubs, given by club name or club id
    row.clubs = Core_list(f.ag_clubs).map(function (v) { return Core_clubRef(v, clubRows); })
      .filter(function (id, i, a) { return id && clubIds[id] && a.indexOf(id) === i; });
    row.sort_order = Number(f.sort_order) || 0;
    return row;
  }).sort(function (a, b) { return a.sort_order - b.sort_order; });

  var campaignIds = {};
  var campaigns = [];
  (tabs.campaigns || []).forEach(function (row) {
    var c = Core_campaignRow(row);
    if (!c || campaignIds[c.campaign_id]) return;
    var chairId = Core_str(row.chair_member_id);
    c.target = Math.max(0, Math.floor(Number(row.target) || 0));
    c.description = Core_safeText(row.description, 'campaign ' + c.campaign_id + ' description', skippedItems);
    c.chair = Core_safeText(row.chair, 'campaign ' + c.campaign_id + ' chair', skippedItems);
    c.chair_ref = chairId && !inactiveIds[chairId] ? personRef(chairId) : '';
    c.sort_order = Number(row.sort_order) || 0;
    campaignIds[c.campaign_id] = true;
    campaigns.push(c);
  });

  var skipped = [];
  var duplicates = [];
  var activities = Core_uniqueRows((tabs.activities || []).filter(function (a) {
    return Core_str(a.status).toLowerCase() === 'approved';
  }), duplicates).map(function (a) {
    var avenue = '';
    CORE_AVENUES.forEach(function (v) { if (v.toLowerCase() === Core_str(a.avenue).toLowerCase()) avenue = v; });
    var paper = Core_safeText(a.press_paper, 'activity ' + Core_str(a.id) + ' press', skippedItems);
    return {
      id: Core_str(a.id),
      club_id: Core_str(a.club_id),
      title: Core_str(a.title),
      date: Core_isoDate(a.date),
      theme: Core_str(a.theme),
      avenue: avenue,
      // press coverage: the paper's name, the date and a link only (never a picture of the clipping)
      press: paper ? { paper: paper, date: Core_isoDate(a.press_date), link: Core_url(a.press_link) } : null,
      video: Core_videoLink(a.video_link),
      description: Core_str(a.description),
      photos: Core_photoRefs(a.photo_files).slice(0, 3),
      post_link: Core_url(a.post_link),
      people_helped: Number(a.people_helped) || 0,
      amount_spent: Number(a.amount_spent) || 0,
      partner_clubs: Core_list(a.partner_clubs).filter(function (id) { return clubIds[id]; }),
      story_of_month: Core_isTrue(a.story_of_month),
      event_id: Core_str(a.event_id),
      approved_at: Core_isoTimestamp(a.approved_at),
      campaign_id: campaignIds[Core_str(a.campaign_id)] ? Core_str(a.campaign_id) : '',
      campaign_count: Math.max(0, Math.floor(Number(a.campaign_count) || 0)),
      bulletin_exclude: Core_isTrue(a.bulletin_exclude),
    };
  }).filter(function (a) {
    var ok = a.id && a.title && a.date && clubIds[a.club_id] && (a.photos.length || a.post_link);
    if (!ok) skipped.push(a.id || '(no id)');
    return ok;
  });

  var activityIds = {};
  activities.forEach(function (a) { activityIds[a.id] = a; });

  var events = Core_uniqueRows((tabs.events || []).filter(function (e) {
    return Core_str(e.status).toLowerCase() === 'approved';
  }), duplicates).map(function (e) {
    var report = Core_str(e.report_activity_id);
    var fee = Core_safeText(e.fee, 'event ' + Core_str(e.id) + ' fee', skippedItems);
    if (CORE_PAYMENT_RE.test(fee)) {
      skippedItems.push('event ' + Core_str(e.id) + ' fee');
      fee = '';
    }
    var status = '';
    CORE_REG_STATUSES.forEach(function (st) { if (st.toLowerCase() === Core_str(e.registration_status).toLowerCase()) status = st; });
    if (!report) {
      activities.forEach(function (a) { if (a.event_id && a.event_id === Core_str(e.id)) report = a.id; });
    }
    return {
      id: Core_str(e.id),
      title: Core_str(e.title),
      event_type: Core_str(e.event_type),
      start_date: Core_isoDate(e.start_date),
      start_time: Core_time(e.start_time),
      end_date: Core_isoDate(e.end_date),
      venue: Core_str(e.venue),
      city: Core_str(e.city),
      organiser: Core_str(e.organiser),
      description: Core_str(e.description),
      map_link: Core_url(e.map_link),
      details_link: Core_url(e.details_link),
      photos: Core_photoRefs(e.photo_files).slice(0, 3),
      report_activity_id: activityIds[report] ? report : '',
      registration_close_date: Core_isoDate(e.registration_close_date),
      fee: fee,
      registration_status: status,
      bulletin_exclude: Core_isTrue(e.bulletin_exclude),
      // anyone may come: the organiser said so, or it is a club event open to all
      open_to_all: Core_isTrue(e.open_to_all) || Core_str(e.event_type) === 'Club event open to all',
    };
  }).filter(function (e) { return e.id && e.title && e.start_date; });

  // Lasting facilities the public can use, with the institution's own phone number, address and map link
  var publicServices = Core_uniqueRows((tabs.public_services || []).filter(function (s) {
    return Core_str(s.status).toLowerCase() === 'approved';
  }), duplicates).map(function (s) {
    var where = 'public service ' + Core_str(s.id);
    var phone = Core_servicePhone(s.phone);
    if (Core_str(s.phone) && !phone) skippedItems.push(where + ' phone');
    var type = 'Other';
    CORE_SERVICE_TYPES.forEach(function (t) { if (t.toLowerCase() === Core_str(s.service_type).toLowerCase()) type = t; });
    return {
      id: Core_str(s.id),
      club_id: Core_str(s.club_id),
      name: Core_safeText(s.name, where + ' name', skippedItems),
      type: type,
      timings: Core_safeText(s.timings, where + ' timings', skippedItems),
      phone: phone ? phone.display : '',
      tel: phone ? phone.tel : '',
      address: Core_safeText(s.address, where + ' address', skippedItems),
      city: Core_str(s.city),
      map_link: Core_url(s.map_link),
      about: Core_safeText(s.about, where + ' about', skippedItems),
    };
  }).filter(function (s) { return s.id && s.name && clubIds[s.club_id]; });

  // The About page: the RI President and the District Governor (the latest row of each)
  var profileByRole = {};
  (tabs.profiles || []).forEach(function (p) {
    var role = Core_str(p.role);
    if (!role || !Core_str(p.name)) return;
    var year = Core_str(p.rotary_year);
    if (profileByRole[role] && profileByRole[role].rotary_year >= year) return;
    profileByRole[role] = {
      role: role,
      rotary_year: year,
      name: Core_str(p.name),
      theme: Core_safeText(p.theme, 'profile ' + role + ' theme', skippedItems),
      profile: Core_safeText(p.profile, 'profile ' + role, skippedItems),
      photo: Core_photoRefs(p.photo)[0] || '',
      link: Core_url(p.link),
      sort_order: Number(p.sort_order) || 0,
    };
  });
  var profiles = Object.keys(profileByRole).map(function (k) { return profileByRole[k]; })
    .sort(function (a, b) { return a.sort_order - b.sort_order || a.role.localeCompare(b.role); });

  // Past District Governors, newest first; a card link only for someone still with us
  var pastGovernors = (tabs.past_governors || []).filter(function (g) { return Core_str(g.name) && Core_str(g.rotary_year); }).map(function (g) {
    var id = Core_str(g.member_id);
    return {
      term: Core_str(g.rotary_year),
      name: Core_str(g.name),
      club_id: Core_clubRef(g.club, clubRows),
      person_ref: id && !inactiveIds[id] ? personRef(id) : '',
    };
  }).sort(function (a, b) { return a.term.localeCompare(b.term) || a.name.localeCompare(b.name); }); // newest last

  var magazines = (tabs.magazines || []).map(function (m) {
    return {
      issue_month: Core_str(m.issue_month).slice(0, 7),
      title: Core_str(m.title),
      pdf_url: Core_url(m.pdf_url),
      file: Core_str(m.pdf_file),
      cover: Core_str(m.cover_image),
    };
  }).filter(function (m) { return /^\d{4}-\d{2}$/.test(m.issue_month) && (m.pdf_url || m.file); });

  var messages = (tabs.messages || []).filter(function (m) { return Core_str(m.name) && Core_str(m.message); }).map(function (m) {
    return {
      id: Core_str(m.id),
      name: Core_str(m.name),
      position: Core_str(m.position),
      photo: Core_photoRefs(m.photo)[0] || '',
      message: Core_str(m.message),
      date: Core_isoDate(m.date),
      featured: Core_isTrue(m.featured),
    };
  });

  var memberKeys = {};
  members.forEach(function (m) { memberKeys[m.public_key] = m; });
  var inactiveKeys = {};
  Core_list(settings.inactive_keys).forEach(function (k) { inactiveKeys[k] = true; });
  var spotlights = (tabs.spotlights || []).map(function (s) {
    var key = Core_str(s.public_key);
    var gone = !memberKeys[key] && inactiveKeys[key];
    return {
      month: Core_str(s.month).slice(0, 7),
      // a past story about someone who has since died or left keeps their name only
      public_key: gone ? '' : key,
      member_name: gone ? Core_str(s.member_name) : '',
      headline: Core_str(s.headline),
      story: Core_str(s.story),
      _ok: gone ? !!Core_str(s.member_name) : !!(memberKeys[key] && memberKeys[key].spotlight_ok),
    };
  }).filter(function (s) {
    var ok = s._ok;
    delete s._ok;
    return /^\d{4}-\d{2}$/.test(s.month) && ok && s.story;
  });

  var couples = (tabs.couples_public || []).map(function (c) {
    return {
      couple_key: Core_str(c.couple_key),
      person_a_key: Core_str(c.person_a_key),
      person_a_name: Core_str(c.person_a_name),
      person_a_club_id: Core_str(c.person_a_club_id),
      person_b_key: Core_str(c.person_b_key),
      person_b_name: Core_str(c.person_b_name),
      person_b_club_id: Core_str(c.person_b_club_id),
      anniversary: Core_str(c.anniversary),
      both_consented: Core_isTrue(c.both_consented),
      couple_photo: Core_photoRefs(c.couple_photo_file)[0] || '',
    };
  });

  // member_id is used above only to join photos; it never leaves this function
  members.forEach(function (m) { delete m.member_id; });

  return {
    generated_at: nowIso || new Date().toISOString(),
    rebuild_requested_at: Core_isoTimestamp(settings.rebuild_requested_at),
    inactive_keys: Core_list(settings.inactive_keys),
    site: {
      rotary_year: rotaryYear,
      district: Core_str(settings.district_name) || 'Rotary District 3110',
      bulletin_start_date: Core_isoDate(settings.bulletin_start_date),
    },
    forms: {
      activity: Core_url(settings.form_activity_url),
      club_profile: Core_url(settings.form_club_profile_url),
      consent: Core_url(settings.form_consent_url),
      removal: Core_url(settings.form_removal_url),
      public_service: Core_url(settings.form_public_service_url),
      contact: Core_url(settings.form_contact_url),
    },
    lists: {
      themes: CORE_THEMES.slice(),
      avenues: CORE_AVENUES.slice(),
      service_types: CORE_SERVICE_TYPES.slice(),
      event_types: CORE_EVENT_TYPES.slice(),
      professions: Core_list(settings.professions),
    },
    clubs: clubs,
    officers: officers,
    functionaries: functionaries,
    activities: activities,
    events: events,
    magazines: magazines,
    messages: messages,
    spotlights: spotlights,
    members: members,
    couples: couples,
    campaigns: campaigns,
    public_services: publicServices,
    profiles: profiles,
    past_governors: pastGovernors,
    skipped_activities: skipped,
    skipped_items: skippedItems,
    duplicate_ids: duplicates,
  };
}

/** Short, stable, non-reversible-looking reference for grouping one person's roles (FNV-1a). */
function Core_hash(s) {
  var h = 0x811c9dc5;
  for (var i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
  }
  return ('0000000' + h.toString(16)).slice(-8);
}

/* ------------------------------------------------------------------ */
/* Safety checks: the build (and the data link) refuse unsafe data     */
/* ------------------------------------------------------------------ */

var CORE_PHONE_RE = /(?:^|[^\w])(?:\+?91[\s-]?)?[6-9]\d{4}[\s-]?\d{5}(?!\w)/; // digits inside a word are not phone numbers
var CORE_EMAIL_RE = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/;
var CORE_YEAR_RE = /\b(19|20)\d{2}\b/;

/** Returns a list of problems. An empty list means the data is safe to publish. */
function Core_validatePublic(data) {
  var errors = [];
  function err(where, msg) { errors.push(where + ': ' + msg); }

  (data.members || []).forEach(function (m, i) {
    var w = 'members[' + i + '] ' + (m.name || '');
    if (!m.directory_ok && !m.photo_ok && !m.birthday_ok) err(w, 'member has not opted in to anything');
    if (!m.directory_ok && (m.profession || m.area || m.description || m.website)) err(w, 'directory details without directory consent');
    if (m.contact_link && !(m.contact_ok && m.directory_ok)) err(w, 'contact link without consent');
    if (m.contact_link && !/^https:\/\/wa\.me\/91[6-9]\d{9}$/.test(m.contact_link)) err(w, 'contact link is not a WhatsApp link');
    if (m.photo && !m.photo_ok) err(w, 'photo without photo consent');
    if (m.birthday && !m.birthday_ok) err(w, 'birthday without consent');
    if (m.birthday && !/^\d{2}-\d{2}$/.test(m.birthday)) err(w, 'birthday must be day and month only, got "' + m.birthday + '"');
    if ('member_id' in m) err(w, 'member ID must never be published');
    ['name', 'profession', 'area', 'description', 'birthday'].forEach(function (f) {
      if (CORE_YEAR_RE.test(Core_str(m[f]))) err(w, f + ' contains a year');
    });
  });

  (data.couples || []).forEach(function (c, i) {
    var w = 'couples[' + i + '] ' + (c.person_a_name || '');
    if (!c.both_consented) err(w, 'anniversary without both spouses\' consent');
    if (!/^\d{2}-\d{2}$/.test(c.anniversary || '')) err(w, 'anniversary must be day and month only, got "' + c.anniversary + '"');
    ['person_a_name', 'person_b_name', 'anniversary'].forEach(function (f) {
      if (CORE_YEAR_RE.test(Core_str(c[f]))) err(w, f + ' contains a year');
    });
  });

  // People marked deceased (or who left) must never get greetings or listings
  var inactive = {};
  (data.inactive_keys || []).forEach(function (k) { if (k) inactive[k] = true; });
  (data.members || []).forEach(function (m, i) {
    if (inactive[m.public_key]) err('members[' + i + '] ' + m.name, 'member is marked deceased or inactive');
  });
  (data.couples || []).forEach(function (c, i) {
    if (inactive[c.person_a_key] || inactive[c.person_b_key]) err('couples[' + i + '] ' + c.person_a_name, 'anniversary for someone marked deceased or inactive');
  });

  (data.officers || []).concat(data.functionaries || []).forEach(function (p, i) {
    if (p.contact_link && !p.contact_ok) err('roles[' + i + '] ' + p.name, 'contact link without consent');
    if (p.person_ref && !/^P[0-9a-f]{12}$/.test(p.person_ref)) err('roles[' + i + '] ' + p.name, 'person reference is not a scrambled reference');
  });
  (data.members || []).forEach(function (m, i) {
    if (m.person_ref && !/^P[0-9a-f]{12}$/.test(m.person_ref)) err('members[' + i + '] ' + m.name, 'person reference is not a scrambled reference');
  });
  (data.campaigns || []).forEach(function (c, i) {
    if (c.chair_ref && !/^P[0-9a-f]{12}$/.test(c.chair_ref)) err('campaigns[' + i + '] ' + c.name, 'chair reference is not a scrambled reference');
  });
  (data.events || []).forEach(function (e, i) {
    if (CORE_PAYMENT_RE.test(Core_str(e.fee))) err('events[' + i + '] ' + e.title, 'fee contains payment details (UPI, IFSC or A/c)');
  });
  (data.past_governors || []).forEach(function (g, i) {
    if (g.person_ref && !/^P[0-9a-f]{12}$/.test(g.person_ref)) err('past_governors[' + i + '] ' + g.name, 'person reference is not a scrambled reference');
  });
  // A public service's phone is the institution's own number, approved by a moderator, in its own field only
  (data.public_services || []).forEach(function (s, i) {
    var w = 'public_services[' + i + '] ' + (s.name || '');
    if (!s.phone && !s.tel) return;
    var ok = Core_servicePhone(s.phone);
    if (!ok || ok.tel !== s.tel) err(w, 'phone is not a plain phone number');
  });
  // Zones are internal and may change: never on the website
  (data.clubs || []).concat(data.functionaries || []).forEach(function (r, i) {
    if (r && 'zone' in r) err('clubs/roles[' + i + '] ' + (r.name || ''), 'zone must not be published');
  });

  // No phone numbers or emails anywhere, except consented WhatsApp links and public services' own numbers
  var scan = JSON.parse(JSON.stringify(data));
  delete scan.forms; // form links are Google addresses, not personal data
  (scan.members || []).forEach(function (m) { if (m.contact_ok) delete m.contact_link; });
  (scan.officers || []).concat(scan.functionaries || []).forEach(function (p) { if (p.contact_ok) delete p.contact_link; });
  (scan.public_services || []).forEach(function (s) {
    if (Core_servicePhone(s.phone)) { delete s.phone; delete s.tel; }
  });
  Core_walk(scan, '', function (path, value) {
    if (typeof value !== 'string') return;
    if (/^(drive|sample|thumb):/.test(value) || /^https?:\/\//.test(value)) {
      if (CORE_EMAIL_RE.test(value.replace(/^https?:\/\/[^/]*@/, ''))) err(path, 'link contains an email address');
      return;
    }
    if (CORE_PHONE_RE.test(value)) err(path, 'looks like a phone number');
    if (CORE_EMAIL_RE.test(value)) err(path, 'looks like an email address');
  });

  return errors;
}

function Core_walk(node, path, fn) {
  if (Array.isArray(node)) {
    node.forEach(function (v, i) { Core_walk(v, path + '[' + i + ']', fn); });
  } else if (node && typeof node === 'object') {
    Object.keys(node).forEach(function (k) { Core_walk(node[k], path ? path + '.' + k : k, fn); });
  } else {
    fn(path, node);
  }
}

/* ------------------------------------------------------------------ */
/* Helpers used by the Sheet script                                    */
/* ------------------------------------------------------------------ */

/** Finds the member a consent or removal request refers to: member ID first, then mobile + club. */
function Core_matchMember(request, master) {
  var id = Core_str(request.member_id);
  var i;
  if (id) {
    for (i = 0; i < master.length; i++) if (Core_str(master[i].member_id) === id) return i;
  }
  var mobile = Core_mobile(request.mobile);
  if (mobile) {
    for (i = 0; i < master.length; i++) {
      if (Core_mobile(master[i].mobile) === mobile && Core_str(master[i].club_id) === Core_str(request.club_id)) return i;
    }
  }
  return -1;
}

/** Flags a likely duplicate: same club, dates within a day, similar titles. Returns the other id or ''. */
function Core_findDuplicate(row, existing) {
  var date = Core_isoDate(row.date);
  if (!date) return '';
  var t = new Date(date + 'T00:00:00Z').getTime();
  var words = Core_titleWords(row.title);
  for (var i = 0; i < existing.length; i++) {
    var e = existing[i];
    if (Core_str(e.id) === Core_str(row.id)) continue;
    if (Core_str(e.club_id) !== Core_str(row.club_id)) continue;
    if (Core_str(e.status).toLowerCase() === 'rejected') continue;
    var ed = Core_isoDate(e.date);
    if (!ed || Math.abs(new Date(ed + 'T00:00:00Z').getTime() - t) > 86400000) continue;
    var other = Core_titleWords(e.title);
    var common = words.filter(function (w) { return other.indexOf(w) >= 0; }).length;
    if (common / Math.max(1, Math.min(words.length, other.length)) >= 0.5) return Core_str(e.id);
  }
  return '';
}

function Core_titleWords(title) {
  var stop = ['the', 'a', 'an', 'of', 'at', 'in', 'for', 'and', 'on', 'to', 'by', 'with'];
  return Core_str(title).toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(function (w) {
    return w.length > 1 && stop.indexOf(w) < 0;
  });
}

/** Rows still pending after the given number of hours. */
function Core_overdue(rows, nowMs, hours) {
  return rows.filter(function (r) {
    if (Core_str(r.status).toLowerCase() !== 'pending') return false;
    var t = new Date(r.submitted_at).getTime();
    return !isNaN(t) && nowMs - t > hours * 3600000;
  });
}

/** A name without titles, dots and extra spaces, for comparing the same person across tabs. */
function Core_plainName(name) {
  var s = Core_str(name).toLowerCase().replace(/\./g, ' ');
  var titles = /^(rtn|pdg|ipdg|dg|dge|dgn|dgnd|pag|ag|pp|ipp|dr|ca|cs|er|adv|mr|mrs|ms|smt|shri|late)\s+/;
  while (titles.test(s)) s = s.replace(titles, '');
  return s.replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, ' ').trim();
}

/**
 * Checks the officers and functionaries tabs against the private members list, so that every
 * person's roles join up on one member card. Returns [{ tab, row, rotary_year, name, member_id, problem }],
 * the most urgent first.
 */
function Core_checkRoles(officers, functionaries, master, rotaryYear) {
  var byId = {};
  (master || []).forEach(function (m) { if (Core_str(m.member_id)) byId[Core_str(m.member_id)] = m; });
  var rows = [];
  (officers || []).forEach(function (r) { rows.push({ tab: 'officers', r: r }); });
  (functionaries || []).forEach(function (r) { rows.push({ tab: 'functionaries', r: r }); });

  var namesById = {};
  var idsByName = {};
  rows.forEach(function (x) {
    var id = Core_str(x.r.member_id);
    var n = Core_plainName(x.r.name);
    if (!id || !n) return;
    (namesById[id] = namesById[id] || {})[n] = Core_str(x.r.name);
    var nk = n + '|' + Core_str(x.r.club_id);
    (idsByName[nk] = idsByName[nk] || {})[id] = true;
  });

  var out = [];
  function add(x, order, problem) {
    out.push({ order: order, tab: x.tab, row: x.r._row || '', rotary_year: Core_str(x.r.rotary_year), name: Core_str(x.r.name),
      member_id: Core_str(x.r.member_id), problem: problem });
  }
  rows.forEach(function (x) {
    var r = x.r;
    if (!Core_str(r.name)) return;
    var id = Core_str(r.member_id);
    var m = byId[id];
    var status = m ? Core_str(m.status || 'active').toLowerCase() : 'active';
    if (m && status !== 'active' && Core_str(r.rotary_year) === rotaryYear) {
      add(x, 1, 'Holds a role this year but is marked "' + status + '" in the members list: not shown on the website; enter who holds the role now');
    }
    if (!id) { add(x, 2, 'No member ID: this role cannot be linked to a member card'); return; }
    var names = Object.keys(namesById[id] || {});
    if (names.length > 1) add(x, 3, 'The same member ID is used with different names: ' + names.map(function (n) { return namesById[id][n]; }).join(' / '));
    var others = Object.keys(idsByName[Core_plainName(r.name) + '|' + Core_str(r.club_id)] || {});
    if (others.length > 1) add(x, 3, 'Same name and club with different member IDs (' + others.join(', ') + '): the person would get two cards');
    if (!m) {
      // sample rows use made-up IDs, so only real rows are checked against the members list
      if (!Core_isTrue(r.is_sample)) add(x, 4, 'Member ID not found in the private members list');
      return;
    }
    if (Core_plainName(m.name) && Core_plainName(m.name) !== Core_plainName(r.name)) {
      add(x, 5, 'Name differs from the members list ("' + Core_str(m.name) + '"): check the member ID');
    }
  });
  out.sort(function (a, b) { return a.order - b.order || a.tab.localeCompare(b.tab) || (a.row || 0) - (b.row || 0); });
  out.forEach(function (o) { delete o.order; });
  return out;
}

// Lets the website's Node.js tests load this file; ignored by Google Apps Script.
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    Core_isTrue: Core_isTrue, Core_isoDate: Core_isoDate, Core_dayMonth: Core_dayMonth, Core_rows: Core_rows,
    Core_mobile: Core_mobile, Core_slug: Core_slug, Core_buildMembersPublic: Core_buildMembersPublic,
    Core_buildPublicData: Core_buildPublicData, Core_validatePublic: Core_validatePublic,
    Core_matchMember: Core_matchMember, Core_findDuplicate: Core_findDuplicate, Core_overdue: Core_overdue,
    Core_hash: Core_hash, Core_time: Core_time, CORE_THEMES: CORE_THEMES, CORE_EVENT_TYPES: CORE_EVENT_TYPES,
    Core_checkRoles: Core_checkRoles, Core_plainName: Core_plainName,
    Core_uniqueRows: Core_uniqueRows, Core_cleanLines: Core_cleanLines, Core_lineParts: Core_lineParts, Core_isDistrictEvent: Core_isDistrictEvent,
    Core_registrationLine: Core_registrationLine, Core_campaignLabel: Core_campaignLabel, Core_campaignIdForLabel: Core_campaignIdForLabel,
    Core_openCampaigns: Core_openCampaigns, Core_campaignTotals: Core_campaignTotals, Core_inCampaign: Core_inCampaign,
    Core_bulletin: Core_bulletin, Core_bulletinMessage: Core_bulletinMessage, Core_sundayOf: Core_sundayOf, Core_addDays: Core_addDays,
    Core_dateLabel: Core_dateLabel, Core_rotaryYearOf: Core_rotaryYearOf, Core_formatNumber: Core_formatNumber,
    CORE_REG_STATUSES: CORE_REG_STATUSES, CORE_NO_CAMPAIGN: CORE_NO_CAMPAIGN,
    Core_meetingDay: Core_meetingDay, Core_servicePhone: Core_servicePhone, Core_videoLink: Core_videoLink, Core_clubRef: Core_clubRef,
    Core_contactCheck: Core_contactCheck, Core_clubsNotPosting: Core_clubsNotPosting,
    CORE_AVENUES: CORE_AVENUES, CORE_SERVICE_TYPES: CORE_SERVICE_TYPES, CORE_WEEKDAYS: CORE_WEEKDAYS,
    CORE_MODERATOR_TYPES: CORE_MODERATOR_TYPES, Core_moderatorEmails: Core_moderatorEmails, Core_moderatorAccess: Core_moderatorAccess,
    Core_moderatorTypesOf: Core_moderatorTypesOf, Core_deskViews: Core_deskViews, Core_quietClubs: Core_quietClubs, Core_looksLikeUrl: Core_looksLikeUrl,
  };
}
