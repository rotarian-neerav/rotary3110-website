// Rotary District 3110 – Sheet script. Generated from apps-script/*.js by tools/bundle-apps-script.mjs.
// Paste this whole file into Code.gs. Do not edit here; edit the source files instead.

// ===== Config.js =====
/**
 * Rotary District 3110 – Google Sheet script.
 *
 * Runs inside the main spreadsheet "3110Website". It creates the tabs and forms, files form
 * submissions as "pending", gives moderators a Rotary menu to approve or reject, keeps the private
 * members list separate, and offers a protected data link that the website build reads.
 */

var CONFIG = {
  // The private members spreadsheet (never published)
  PRIVATE_SHEET_ID: '1WA3KHpFQ1Bvh0eZun1_Rlile1gXUN0u9FOkItjScoxI',
  // Google Drive folder with the magazine PDFs (anyone with the link can view)
  MAGAZINE_FOLDER_ID: '1ULN-pi2vpWasTad4bG5j4e6SKPR9inBj',
  // Private folder for member photos the district already holds, files named <member ID>.jpg
  MEMBER_PHOTOS_FOLDER_NAME: 'MemberPhotos',
  // Where "Load sample data" reads the sample from (the public website repository)
  SAMPLE_URL: 'https://raw.githubusercontent.com/rotarian-neerav/rotary3110-website/main/sample/sample-data.json',
  REMINDER_HOURS: 48,
};

/** Titles of the photo questions that must be added to the forms by hand (Google does not let scripts add them). */
var PHOTO_QUESTIONS = {
  activity: 'Photos (up to 3, each under 1 MB)',
  memberPhoto: 'My photo (one photo of me alone, under 1 MB)',
  couplePhoto: 'Couple photo (optional, under 1 MB)',
};

var PRIVATE_TABS = ['members_master', 'club_history', 'couples', 'consent_requests', 'removal_requests'];

function props_() {
  return PropertiesService.getScriptProperties();
}

function mainSs_() {
  return SpreadsheetApp.getActiveSpreadsheet() || SpreadsheetApp.openById(props_().getProperty('MAIN_SHEET_ID'));
}

function privateSs_() {
  return SpreadsheetApp.openById(CONFIG.PRIVATE_SHEET_ID);
}

function nowIso_() {
  return new Date().toISOString();
}

function today_() {
  return Core_isoDate(new Date());
}

/** Reads a tab as row objects, remembering each row's sheet row number in _row. */
function readTab_(ss, name) {
  var sh = ss.getSheetByName(name);
  if (!sh || sh.getLastRow() < 1) return [];
  var values = sh.getDataRange().getValues();
  var headers = values[0];
  var out = [];
  for (var r = 1; r < values.length; r++) {
    var obj = { _row: r + 1 };
    var empty = true;
    for (var c = 0; c < headers.length; c++) {
      if (!headers[c]) continue;
      obj[headers[c]] = values[r][c];
      if (values[r][c] !== '' && values[r][c] != null) empty = false;
    }
    if (!empty) out.push(obj);
  }
  return out;
}

function headers_(ss, name) {
  var sh = ss.getSheetByName(name);
  return sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
}

/** Writes some fields of one row (by sheet row number), leaving the other cells alone. */
function updateRow_(ss, name, rowNumber, fields) {
  var sh = ss.getSheetByName(name);
  var headers = headers_(ss, name);
  Object.keys(fields).forEach(function (key) {
    var col = headers.indexOf(key);
    if (col < 0) throw new Error('Column "' + key + '" not found in ' + name);
    sh.getRange(rowNumber, col + 1).setValue(fields[key]);
  });
}

/** Appends one row given as an object; missing columns stay blank. */
function appendRow_(ss, name, obj) {
  var sh = ss.getSheetByName(name);
  var headers = headers_(ss, name);
  sh.appendRow(headers.map(function (h) { return obj[h] == null ? '' : obj[h]; }));
  return sh.getLastRow();
}

/** Replaces every data row of a tab (keeps the header row). */
function replaceRows_(ss, name, rows) {
  var sh = ss.getSheetByName(name);
  var headers = headers_(ss, name);
  if (sh.getLastRow() > 1) sh.getRange(2, 1, sh.getLastRow() - 1, sh.getMaxColumns()).clearContent();
  if (!rows.length) return;
  var values = rows.map(function (o) { return headers.map(function (h) { return o[h] == null ? '' : o[h]; }); });
  sh.getRange(2, 1, values.length, headers.length).setValues(values);
}

function settings_() {
  return Core_settings(readTab_(mainSs_(), 'settings'));
}

function setSetting_(key, value) {
  var ss = mainSs_();
  var rows = readTab_(ss, 'settings');
  for (var i = 0; i < rows.length; i++) {
    if (rows[i].key === key) {
      updateRow_(ss, 'settings', rows[i]._row, { value: value });
      return;
    }
  }
  appendRow_(ss, 'settings', { key: key, value: value });
}

function clubs_() {
  return readTab_(mainSs_(), 'clubs').filter(function (c) { return Core_str(c.club_id); });
}

function clubIdByName_(name) {
  var n = Core_str(name);
  var list = clubs_();
  for (var i = 0; i < list.length; i++) if (Core_str(list[i].club_name) === n) return Core_str(list[i].club_id);
  return '';
}

function clubNameById_(id) {
  var list = clubs_();
  for (var i = 0; i < list.length; i++) if (Core_str(list[i].club_id) === Core_str(id)) return Core_str(list[i].club_name);
  return '';
}

function moderatorEmail_() {
  return Session.getActiveUser().getEmail() || Session.getEffectiveUser().getEmail() || 'unknown moderator';
}

function nextId_(rows, prefix) {
  var max = 0;
  var re = new RegExp('^' + prefix.replace(/[-]/g, '\\-') + '(\\d+)$');
  rows.forEach(function (r) {
    var m = Core_str(r.id || r.member_id || r.couple_id).match(re);
    if (m) max = Math.max(max, +m[1]);
  });
  return prefix + ('0000' + (max + 1)).slice(-4);
}


// ===== Schema.js =====
/**
 * Tabs and columns of the two spreadsheets. Shared by the Sheet script and the
 * website's sample-data generator, so both always agree on the layout.
 */

var SCHEMA_MAIN = {
  settings: ['key', 'value', 'notes'],
  lists: ['list', 'value'],
  clubs: ['club_id', 'club_name', 'display_name', 'slug', 'former_names', 'city', 'zone', 'status', 'member_count',
    'meeting_day_place', 'website', 'facebook', 'instagram', 'youtube', 'x', 'linkedin', 'profile_updated_at', 'is_sample'],
  officers: ['rotary_year', 'club_id', 'member_id', 'name', 'role', 'contact_ok', 'contact_link', 'is_sample'],
  functionaries: ['rotary_year', 'page', 'section', 'committee', 'member_id', 'name', 'role', 'zone', 'club_id', 'term',
    'sort_order', 'contact_ok', 'contact_link', 'is_sample'],
  activities: ['id', 'submitted_at', 'submitter_email', 'submitter_name', 'submitter_role', 'submitter_mobile', 'club_id',
    'club_name', 'title', 'date', 'theme', 'description', 'photo_files', 'post_link', 'people_helped', 'amount_spent', 'partner_clubs',
    'photo_consent', 'status', 'source', 'approved_by', 'approved_at', 'moderator_note', 'story_of_month', 'event_id',
    'notified', 'is_sample'],
  events: ['id', 'submitted_at', 'submitter_email', 'submitter_name', 'submitter_role', 'submitter_mobile', 'title',
    'event_type', 'start_date', 'start_time', 'end_date', 'venue', 'city', 'organiser', 'description', 'map_link',
    'details_link', 'status', 'source', 'approved_by', 'approved_at', 'moderator_note', 'report_activity_id', 'notified',
    'is_sample'],
  club_profile_requests: ['id', 'submitted_at', 'submitter_email', 'submitter_name', 'submitter_role', 'submitter_mobile',
    'club_id', 'club_name', 'website', 'facebook', 'instagram', 'youtube', 'x', 'linkedin', 'meeting_day_place', 'status',
    'approved_by', 'approved_at', 'moderator_note', 'is_sample'],
  magazines: ['issue_month', 'title', 'pdf_file', 'pdf_url', 'cover_image', 'is_sample'],
  messages: ['id', 'name', 'position', 'photo', 'message', 'date', 'featured', 'is_sample'],
  spotlights: ['month', 'public_key', 'member_name', 'headline', 'story', 'is_sample'],
  members_public: ['public_key', 'member_id', 'name', 'club_id', 'directory_ok', 'profession', 'area', 'description',
    'website', 'contact_ok', 'contact_link', 'photo_ok', 'photo_file', 'birthday_ok', 'birthday', 'spotlight_ok', 'is_sample'],
  couples_public: ['couple_key', 'person_a_key', 'person_a_name', 'person_a_club_id', 'person_b_key', 'person_b_name',
    'person_b_club_id', 'anniversary', 'both_consented', 'couple_photo_file', 'is_sample'],
  dashboard: ['club_id', 'club_name', 'zone', 'member_count', 'last_activity_date', 'activities_this_month',
    'activities_last_month', 'activities_this_rotary_year', 'months_posted_this_rotary_year', 'needs_nudge'],
};

var SCHEMA_PRIVATE = {
  members_master: ['member_id', 'name', 'club_id', 'is_rotarian', 'status', 'mobile', 'email', 'dob', 'marriage_date',
    'spouse_id', 'directory_ok', 'contact_ok', 'photo_ok', 'birthday_ok', 'anniversary_ok', 'profession', 'area',
    'description', 'website', 'spotlight_ok', 'photo_file', 'photo_approved', 'listing_approved', 'listing_approved_by',
    'listing_approved_at', 'public_key', 'consent_source', 'consent_updated_at', 'notes', 'is_sample'],
  club_history: ['member_id', 'club_id', 'from_date', 'to_date', 'reason', 'is_sample'],
  couples: ['couple_id', 'person_a_id', 'person_b_id', 'anniversary', 'a_consent', 'b_consent', 'couple_photo_ok_a',
    'couple_photo_ok_b', 'couple_photo_file', 'couple_photo_approved', 'status', 'notes', 'is_sample'],
  consent_requests: ['id', 'submitted_at', 'submitter_email', 'filled_by', 'club_id', 'name', 'member_id', 'mobile',
    'directory_ok', 'profession', 'area', 'description', 'website', 'spotlight_ok', 'contact_ok', 'photo_ok', 'photo_file',
    'birthday_ok', 'birthday', 'anniversary_ok', 'spouse_is_rotarian', 'spouse_name', 'spouse_club_id', 'spouse_member_id',
    'spouse_agrees', 'anniversary', 'couple_photo_file', 'couple_photo_spouse_agrees', 'declaration', 'status',
    'matched_member_id', 'approved_by', 'approved_at', 'moderator_note', 'is_sample'],
  removal_requests: ['id', 'submitted_at', 'submitter_email', 'club_id', 'name', 'member_id', 'mobile', 'remove_items',
    'reason', 'status', 'matched_member_id', 'approved_by', 'approved_at', 'moderator_note', 'is_sample'],
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { SCHEMA_MAIN: SCHEMA_MAIN, SCHEMA_PRIVATE: SCHEMA_PRIVATE };
}


// ===== Core.js =====
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
 *         messages, spotlights, members_public, couples_public, lists }
 * Each is an array of row objects (see Core_rows).
 */
function Core_buildPublicData(tabs, nowIso) {
  var settings = Core_settings(tabs.settings || []);
  var rotaryYear = Core_str(settings.current_rotary_year);

  var clubs = (tabs.clubs || []).filter(function (c) { return Core_str(c.club_id); }).map(function (c) {
    return {
      club_id: Core_str(c.club_id),
      slug: Core_str(c.slug) || Core_slug(c.club_name),
      name: Core_str(c.club_name),
      display_name: Core_str(c.display_name) || Core_str(c.club_name).replace(/^RC\s+/, 'Rotary Club of '),
      former_names: Core_list(c.former_names),
      city: Core_str(c.city),
      zone: Core_str(c.zone),
      status: Core_str(c.status || 'active').toLowerCase(),
      member_count: Number(c.member_count) || 0,
      meeting: Core_str(c.meeting_day_place),
      links: {
        website: Core_url(c.website),
        facebook: Core_url(c.facebook),
        instagram: Core_url(c.instagram),
        youtube: Core_url(c.youtube),
        x: Core_url(c.x),
        linkedin: Core_url(c.linkedin),
      },
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
    if (m.photo_ok && m.photo && m.member_id) photoByMemberId[m.member_id] = { photo: m.photo, key: m.public_key };
  });

  function roleRow(r) {
    var p = photoByMemberId[Core_str(r.member_id)];
    var contact = Core_isTrue(r.contact_ok) && Core_str(r.contact_link) ? Core_str(r.contact_link) : '';
    return {
      rotary_year: Core_str(r.rotary_year),
      person_key: p ? p.key : '',
      person_ref: Core_str(r.member_id) ? 'P' + Core_hash(Core_str(r.member_id)) : '',
      name: Core_str(r.name),
      role: Core_str(r.role),
      club_id: Core_str(r.club_id),
      photo: p ? p.photo : '',
      contact_ok: !!contact,
      contact_link: contact,
    };
  }

  var officers = (tabs.officers || []).filter(function (o) { return Core_str(o.name); }).map(roleRow);

  var functionaries = (tabs.functionaries || []).filter(function (f) { return Core_str(f.name); }).map(function (f) {
    var row = roleRow(f);
    row.page = Core_str(f.page);
    row.section = Core_str(f.section);
    row.committee = Core_str(f.committee);
    row.zone = Core_str(f.zone);
    row.term = Core_str(f.term);
    row.sort_order = Number(f.sort_order) || 0;
    return row;
  }).sort(function (a, b) { return a.sort_order - b.sort_order; });

  var skipped = [];
  var activities = (tabs.activities || []).filter(function (a) {
    return Core_str(a.status).toLowerCase() === 'approved';
  }).map(function (a) {
    return {
      id: Core_str(a.id),
      club_id: Core_str(a.club_id),
      title: Core_str(a.title),
      date: Core_isoDate(a.date),
      theme: Core_str(a.theme),
      description: Core_str(a.description),
      photos: Core_photoRefs(a.photo_files).slice(0, 3),
      post_link: Core_url(a.post_link),
      people_helped: Number(a.people_helped) || 0,
      amount_spent: Number(a.amount_spent) || 0,
      partner_clubs: Core_list(a.partner_clubs).filter(function (id) { return clubIds[id]; }),
      story_of_month: Core_isTrue(a.story_of_month),
      event_id: Core_str(a.event_id),
      approved_at: Core_isoTimestamp(a.approved_at),
    };
  }).filter(function (a) {
    var ok = a.id && a.title && a.date && clubIds[a.club_id] && (a.photos.length || a.post_link);
    if (!ok) skipped.push(a.id || '(no id)');
    return ok;
  });

  var activityIds = {};
  activities.forEach(function (a) { activityIds[a.id] = a; });

  var events = (tabs.events || []).filter(function (e) {
    return Core_str(e.status).toLowerCase() === 'approved';
  }).map(function (e) {
    var report = Core_str(e.report_activity_id);
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
      report_activity_id: activityIds[report] ? report : '',
    };
  }).filter(function (e) { return e.id && e.title && e.start_date; });

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
  var spotlights = (tabs.spotlights || []).map(function (s) {
    return {
      month: Core_str(s.month).slice(0, 7),
      public_key: Core_str(s.public_key),
      headline: Core_str(s.headline),
      story: Core_str(s.story),
    };
  }).filter(function (s) {
    var m = memberKeys[s.public_key];
    return /^\d{4}-\d{2}$/.test(s.month) && m && m.spotlight_ok && s.story;
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
      zones: Core_list(settings.zones),
    },
    forms: {
      activity: Core_url(settings.form_activity_url),
      club_profile: Core_url(settings.form_club_profile_url),
      consent: Core_url(settings.form_consent_url),
      removal: Core_url(settings.form_removal_url),
    },
    lists: {
      themes: CORE_THEMES.slice(),
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
    skipped_activities: skipped,
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
  });

  // No phone numbers or emails anywhere, except consented WhatsApp links
  var scan = JSON.parse(JSON.stringify(data));
  delete scan.forms; // form links are Google addresses, not personal data
  (scan.members || []).forEach(function (m) { if (m.contact_ok) delete m.contact_link; });
  (scan.officers || []).concat(scan.functionaries || []).forEach(function (p) { if (p.contact_ok) delete p.contact_link; });
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

// Lets the website's Node.js tests load this file; ignored by Google Apps Script.
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    Core_isTrue: Core_isTrue, Core_isoDate: Core_isoDate, Core_dayMonth: Core_dayMonth, Core_rows: Core_rows,
    Core_mobile: Core_mobile, Core_slug: Core_slug, Core_buildMembersPublic: Core_buildMembersPublic,
    Core_buildPublicData: Core_buildPublicData, Core_validatePublic: Core_validatePublic,
    Core_matchMember: Core_matchMember, Core_findDuplicate: Core_findDuplicate, Core_overdue: Core_overdue,
    Core_hash: Core_hash, Core_time: Core_time, CORE_THEMES: CORE_THEMES, CORE_EVENT_TYPES: CORE_EVENT_TYPES,
  };
}


// ===== Setup.js =====
/**
 * One-time setup. Run "setup" once from the script editor, signed in as the district account.
 * Safe to run again: it adds anything missing and never deletes data or duplicates forms.
 */

function setup() {
  var main = SpreadsheetApp.getActiveSpreadsheet();
  props_().setProperty('MAIN_SHEET_ID', main.getId());
  var priv = privateSs_();
  var report = [];

  ensureTabs_(main, SCHEMA_MAIN, report);
  ensureTabs_(priv, SCHEMA_PRIVATE, report);
  ensureSettings_(report);
  addValidation_(main, priv);

  var token = props_().getProperty('DATA_TOKEN');
  if (!token) {
    token = Utilities.getUuid().replace(/-/g, '') + Utilities.getUuid().replace(/-/g, '').slice(0, 8);
    props_().setProperty('DATA_TOKEN', token);
    report.push('Created the data link token');
  }

  if (!clubs_().length) {
    loadSampleData(true); // forms need the club list; sample rows can be cleared later in one step
    report.push('Loaded the sample data (clubs, teams, dummy activities and members)');
  }
  createForms_(report);
  ensureMemberPhotosFolder_(report);
  checkSharing_(main, report);
  installTriggers_(report);
  refreshDashboard();

  var msg = 'Setup finished.\n\n' + report.join('\n') +
    '\n\nNext: add the photo questions to the forms by hand (see the instructions), then publish the data link ' +
    '(Deploy → New deployment → Web app).';
  Logger.log(msg);
  try { SpreadsheetApp.getUi().alert(msg); } catch (e) { /* run from the editor */ }
}

var TEXT_COLUMNS = ['member_id', 'mobile', 'submitter_mobile', 'start_time', 'birthday', 'anniversary', 'value', 'person_a_id',
  'person_b_id', 'spouse_id', 'spouse_member_id', 'matched_member_id', 'public_key', 'club_id', 'rotary_year', 'term', 'issue_month', 'month'];

function ensureTabs_(ss, schema, report) {
  Object.keys(schema).forEach(function (name) {
    var cols = schema[name];
    var sh = ss.getSheetByName(name);
    if (!sh) {
      sh = ss.insertSheet(name);
      report.push('Created tab ' + name + ' in ' + ss.getName());
    }
    var existing = sh.getLastColumn() ? sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0].map(String) : [];
    var missing = cols.filter(function (c) { return existing.indexOf(c) < 0; });
    if (missing.length) {
      var start = existing.filter(function (h) { return h; }).length + 1;
      if (sh.getMaxColumns() < start + missing.length - 1) sh.insertColumnsAfter(sh.getMaxColumns(), start + missing.length - 1 - sh.getMaxColumns());
      sh.getRange(1, start, 1, missing.length).setValues([missing]);
      if (existing.length) report.push('Added columns to ' + name + ': ' + missing.join(', '));
    }
    // Keep IDs, phone numbers, times and day-month values as plain text, so Sheets does not turn them into numbers or dates
    sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0].forEach(function (h, i) {
      if (TEXT_COLUMNS.indexOf(h) >= 0) sh.getRange(2, i + 1, sh.getMaxRows() - 1, 1).setNumberFormat('@');
    });
    sh.setFrozenRows(1);
    sh.getRange(1, 1, 1, sh.getLastColumn()).setFontWeight('bold').setBackground('#17458F').setFontColor('#ffffff');
  });
  // Remove the empty default tab, if there is one
  var blank = ss.getSheetByName('Sheet1');
  if (blank && blank.getLastRow() === 0 && ss.getSheets().length > 1) ss.deleteSheet(blank);
  // Generated tabs: warn anyone who tries to type in them
  ['members_public', 'couples_public', 'dashboard'].forEach(function (n) {
    var sh = ss.getSheetByName(n);
    if (sh && !sh.getProtections(SpreadsheetApp.ProtectionType.SHEET).length) {
      sh.protect().setDescription('Filled in by the script – do not edit by hand').setWarningOnly(true);
    }
  });
}

var DEFAULT_SETTINGS = [
  ['district_name', 'Rotary District 3110', 'Shown in the header and footer'],
  ['current_rotary_year', '2024-25', 'Rotary year shown for office bearers, teams and committees'],
  ['zones', 'Agra, Bareilly, Kanpur', 'District zones'],
  ['professions', '', 'Comma-separated list for the directory; placeholder until the real list is agreed'],
  ['moderator_emails', '', 'Comma-separated; they receive the 48-hour reminders'],
  ['site_url', 'https://rotarian-neerav.github.io/rotary3110-website/', 'Used in emails to people who send activities'],
  ['form_activity_url', '', 'Filled in by setup'],
  ['form_club_profile_url', '', 'Filled in by setup'],
  ['form_consent_url', '', 'Filled in by setup'],
  ['form_removal_url', '', 'Filled in by setup'],
  ['rebuild_requested_at', '', 'Set by "Rebuild site now" and "Mark as deceased"'],
  ['inactive_keys', '', 'Filled in by "Refresh public members"; never edit by hand'],
];

function ensureSettings_(report) {
  var ss = mainSs_();
  var have = readTab_(ss, 'settings').map(function (r) { return r.key; });
  DEFAULT_SETTINGS.forEach(function (s) {
    if (have.indexOf(s[0]) < 0) {
      appendRow_(ss, 'settings', { key: s[0], value: s[1], notes: s[2] });
      report.push('Added setting ' + s[0]);
    }
  });
}

function listRule_(values) {
  return SpreadsheetApp.newDataValidation().requireValueInList(values, true).setAllowInvalid(false).build();
}

function addValidation_(main, priv) {
  var checkbox = SpreadsheetApp.newDataValidation().requireCheckbox().build();
  function apply(ss, tab, col, rule) {
    var sh = ss.getSheetByName(tab);
    var idx = headers_(ss, tab).indexOf(col);
    if (idx >= 0) sh.getRange(2, idx + 1, sh.getMaxRows() - 1, 1).setDataValidation(rule);
  }
  ['activities', 'events', 'club_profile_requests'].forEach(function (t) {
    apply(main, t, 'status', listRule_(['pending', 'approved', 'rejected']));
  });
  apply(main, 'activities', 'theme', listRule_(CORE_THEMES));
  apply(main, 'events', 'event_type', listRule_(CORE_EVENT_TYPES));
  apply(main, 'clubs', 'status', listRule_(['active', 'inactive']));
  apply(main, 'activities', 'story_of_month', checkbox);
  ['consent_requests', 'removal_requests'].forEach(function (t) {
    apply(priv, t, 'status', listRule_(['pending', 'approved', 'rejected']));
  });
  apply(priv, 'members_master', 'status', listRule_(['active', 'deceased', 'left']));
  apply(priv, 'couples', 'status', listRule_(['active', 'awaiting_spouse', 'check_dates', 'withdrawn']));
}

function ensureMemberPhotosFolder_(report) {
  var parents = DriveApp.getFileById(mainSs_().getId()).getParents();
  if (!parents.hasNext()) return;
  var parent = parents.next();
  var it = parent.getFoldersByName(CONFIG.MEMBER_PHOTOS_FOLDER_NAME);
  if (it.hasNext()) return;
  parent.createFolder(CONFIG.MEMBER_PHOTOS_FOLDER_NAME); // inherits the parent folder's (private) sharing
  report.push('Created the private ' + CONFIG.MEMBER_PHOTOS_FOLDER_NAME + ' folder');
}

function memberPhotosFolder_() {
  var parents = DriveApp.getFileById(mainSs_().getId()).getParents();
  if (!parents.hasNext()) return null;
  var it = parents.next().getFoldersByName(CONFIG.MEMBER_PHOTOS_FOLDER_NAME);
  return it.hasNext() ? it.next() : null;
}

/** Main and private Sheets must be restricted; the magazine folder must be open to anyone with the link. */
function checkSharing_(main, report) {
  [main.getId(), CONFIG.PRIVATE_SHEET_ID].forEach(function (id) {
    var f = DriveApp.getFileById(id);
    var access = f.getSharingAccess();
    if (access !== DriveApp.Access.PRIVATE) {
      f.setSharing(DriveApp.Access.PRIVATE, DriveApp.Permission.NONE);
      report.push('Restricted sharing of ' + f.getName());
    }
  });
  var mag = DriveApp.getFolderById(CONFIG.MAGAZINE_FOLDER_ID);
  if (mag.getSharingAccess() !== DriveApp.Access.ANYONE_WITH_LINK) {
    mag.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    report.push('Opened the magazine folder to anyone with the link');
  }
  var photos = memberPhotosFolder_();
  if (photos && photos.getSharingAccess() !== DriveApp.Access.PRIVATE) {
    photos.setSharing(DriveApp.Access.PRIVATE, DriveApp.Permission.NONE);
    report.push('Restricted the MemberPhotos folder');
  }
  report.push('Sharing checked: Sheets restricted, magazine folder viewable by link, member photos private');
}

function installTriggers_(report) {
  var existing = ScriptApp.getProjectTriggers().map(function (t) { return t.getHandlerFunction() + '|' + (t.getTriggerSourceId() || ''); });
  var forms = JSON.parse(props_().getProperty('FORM_IDS') || '{}');
  Object.keys(forms).forEach(function (key) {
    if (existing.indexOf('onAnyFormSubmit|' + forms[key]) < 0) {
      ScriptApp.newTrigger('onAnyFormSubmit').forForm(forms[key]).onFormSubmit().create();
      report.push('Connected the ' + key + ' form');
    }
  });
  if (!existing.some(function (e) { return e.indexOf('dailyJobs|') === 0; })) {
    ScriptApp.newTrigger('dailyJobs').timeBased().everyDays(1).atHour(7).inTimezone('Asia/Kolkata').create();
    report.push('Scheduled the daily reminders and dashboard (7 am)');
  }
}


// ===== Forms.js =====
/**
 * The four Google Forms. Questions are found again by their titles, so keep titles in Q unchanged.
 * Forms 1–2 send answers to the main Sheet; forms 3–4 (members' personal details) to the private Sheet.
 * Each form's raw answers stay untouched in a "raw_…" tab; the script copies them into the working tabs.
 */

var Q = {
  club: 'Your club',
  name: 'Your name',
  role: 'Your role in the club',
  mobile: 'Your mobile number',
  kind: 'What are you sending?',
  kindActivity: 'An activity we did',
  kindEvent: 'An upcoming event',
  aTitle: 'Activity title',
  aDate: 'Date of activity',
  aTheme: 'Theme',
  aDesc: 'Description',
  aLink: 'Link to your own post (if you posted it already)',
  aHelped: 'People helped (optional)',
  aSpent: 'Amount spent in ₹ (optional)',
  aPartners: 'Other clubs that took part (optional)',
  aConsent: 'Photo consent',
  eTitle: 'Event title',
  eType: 'Event type',
  eStart: 'Start date',
  eTime: 'Start time (optional)',
  eEnd: 'End date (if more than one day)',
  eVenue: 'Venue',
  eCity: 'City or town',
  eOrganiser: 'Organiser',
  eDesc: 'Short description (optional)',
  eMap: 'Map link (optional)',
  eDetails: 'Link for details or registration (optional)',
  pWebsite: 'Club website',
  pFacebook: 'Facebook page',
  pInstagram: 'Instagram',
  pYoutube: 'YouTube',
  pX: 'X (Twitter)',
  pLinkedin: 'LinkedIn',
  pMeeting: 'Meeting day and place',
  pConfirm: 'Confirmation',
  cClub: 'Club',
  cName: "Member's full name (as on club records)",
  cMemberId: 'Rotary member ID (optional)',
  cMobile: "Member's mobile number",
  cFilledBy: 'Who is filling this form?',
  cDirectory: 'List me in the professional directory',
  cProfession: 'Profession',
  cArea: 'Area (city or town)',
  cWhat: 'What I do, in about 20 words',
  cWebsite: 'My website (optional)',
  cSpotlight: 'Member spotlight',
  cContact: 'Show a WhatsApp / call button on my listing',
  cPhoto: 'Show my photo next to my name',
  cBirthday: 'Show my birthday (day and month only)',
  cBirthdayDate: 'My birthday',
  cAnniversary: 'Show our wedding anniversary (day and month only)',
  cSpouseRotarian: 'Is your spouse also a Rotarian?',
  cSpouseName: "Spouse's name",
  cSpouseClub: "Spouse's club (if a Rotarian)",
  cSpouseId: "Spouse's Rotary member ID (if known)",
  cSpouseAgrees: "Spouse's agreement",
  cAnniversaryDate: 'Our wedding anniversary',
  cCoupleAgree: 'Couple photo agreement',
  cDeclaration: 'Declaration',
  rClub: 'Club',
  rName: "Member's full name",
  rMemberId: 'Rotary member ID (optional)',
  rMobile: "Member's mobile number",
  rItems: 'What should be removed?',
  rReason: 'Reason (optional)',
};

var YES_NO = ['Yes', 'No'];
var MOBILE_PATTERN = '^(\\+?91[ -]?)?0?[6-9][0-9]{4}[ -]?[0-9]{5}$';

function textRule_(pattern, help) {
  return FormApp.createTextValidation().requireTextMatchesPattern(pattern).setHelpText(help).build();
}
function urlRule_() {
  return FormApp.createTextValidation().requireTextIsUrl().setHelpText('Please paste a full web address starting with https://').build();
}
function numberRule_() {
  return FormApp.createTextValidation().requireWholeNumber().setHelpText('Numbers only, no commas').build();
}

function formLists_() {
  var s = settings_();
  var activeClubs = clubs_().filter(function (c) { return Core_str(c.status || 'active') === 'active'; })
    .map(function (c) { return Core_str(c.club_name); }).sort();
  var lists = readTab_(mainSs_(), 'lists');
  var pick = function (list) { return lists.filter(function (r) { return r.list === list; }).map(function (r) { return Core_str(r.value); }); };
  var areas = pick('area');
  if (!areas.length) areas = clubs_().map(function (c) { return Core_str(c.city); }).filter(function (x, i, a) { return x && a.indexOf(x) === i; }).sort();
  var professions = pick('profession');
  if (!professions.length) professions = Core_list(s.professions);
  var teams = readTab_(mainSs_(), 'functionaries').map(function (f) { return Core_str(f.section); })
    .filter(function (x, i, a) { return x && a.indexOf(x) === i; });
  return {
    clubs: activeClubs.length ? activeClubs : ['(clubs not loaded yet)'],
    areas: areas.length ? areas : ['(areas not loaded yet)'],
    professions: professions.length ? professions.concat(['Other']) : ['Other'],
    organisers: activeClubs.concat(teams.length ? teams : ["Governor's Office Team"]),
    roles: ['President', 'Secretary', 'Public Image Chair', 'Other office bearer', 'Member'],
  };
}

function createForms_(report) {
  var ids = JSON.parse(props_().getProperty('FORM_IDS') || '{}');
  var L = formLists_();
  var makers = { activity: makeActivityForm_, club_profile: makeClubProfileForm_, consent: makeConsentForm_, removal: makeRemovalForm_ };
  var destinations = { activity: mainSs_().getId(), club_profile: mainSs_().getId(), consent: CONFIG.PRIVATE_SHEET_ID, removal: CONFIG.PRIVATE_SHEET_ID };
  var rawNames = { activity: 'raw_activity_form', club_profile: 'raw_club_profile_form', consent: 'raw_consent_form', removal: 'raw_removal_form' };

  Object.keys(makers).forEach(function (key) {
    var form = null;
    if (ids[key]) {
      try { form = FormApp.openById(ids[key]); } catch (e) { form = null; }
    }
    if (!form) {
      form = makers[key](L);
      form.setDestination(FormApp.DestinationType.SPREADSHEET, destinations[key]);
      ids[key] = form.getId();
      props_().setProperty('FORM_IDS', JSON.stringify(ids));
      SpreadsheetApp.flush();
      renameResponseSheet_(destinations[key], form, rawNames[key]);
      report.push('Created the ' + key.replace('_', ' ') + ' form');
    }
    setSetting_('form_' + key + '_url', form.getPublishedUrl());
  });
}

function renameResponseSheet_(ssId, form, name) {
  var ss = SpreadsheetApp.openById(ssId);
  var formId = form.getId();
  ss.getSheets().forEach(function (sh) {
    var url = sh.getFormUrl();
    if (url && url.indexOf(formId) >= 0 && !ss.getSheetByName(name)) {
      sh.setName(name);
      sh.protect().setDescription('Original form answers – kept unchanged').setWarningOnly(true);
    }
  });
}

function baseForm_(title, description) {
  var form = FormApp.create(title);
  form.setDescription(description);
  form.setCollectEmail(true);
  form.setAllowResponseEdits(false);
  form.setProgressBar(true);
  form.setConfirmationMessage('Thank you! A district moderator will check this within 48 hours. You will get an email when it is decided.');
  return form;
}

function addSender_(form, L) {
  form.addListItem().setTitle(Q.club).setChoiceValues(L.clubs).setRequired(true);
  form.addTextItem().setTitle(Q.name).setRequired(true);
  form.addListItem().setTitle(Q.role).setChoiceValues(L.roles).setRequired(true);
  form.addTextItem().setTitle(Q.mobile).setHelpText('Only moderators see this, to ask you a question. It is never published.')
    .setValidation(textRule_(MOBILE_PATTERN, 'Please give a 10-digit mobile number')).setRequired(true);
}

function makeActivityForm_(L) {
  var form = baseForm_('Club activity or event – Rotary District 3110',
    'Share what your club did, or an upcoming event. A moderator checks every entry before it appears on the district website.\n' +
    'Please do not write the names of children.');
  addSender_(form, L);
  var kind = form.addMultipleChoiceItem().setTitle(Q.kind).setRequired(true);

  var activityPage = form.addPageBreakItem().setTitle('About the activity');
  form.addTextItem().setTitle(Q.aTitle).setRequired(true)
    .setValidation(FormApp.createTextValidation().requireTextLengthLessThanOrEqualTo(80).setHelpText('Up to 80 characters').build());
  form.addDateItem().setTitle(Q.aDate).setRequired(true);
  form.addListItem().setTitle(Q.aTheme).setChoiceValues(CORE_THEMES).setRequired(true)
    .setHelpText("Rotary's seven Areas of Focus, or Club service / Other for installations, fellowship, training and similar.");
  form.addParagraphTextItem().setTitle(Q.aDesc).setRequired(true)
    .setHelpText('Two to five lines. Please do not write the names of children.')
    .setValidation(FormApp.createParagraphTextValidation().requireTextMatchesPattern('^[\\s\\S]{100,600}$')
      .setHelpText('Please write between 100 and 600 characters (about 2–5 lines)').build());
  // The photo question is added here by hand (Google does not allow scripts to add file uploads)
  form.addTextItem().setTitle(Q.aLink).setHelpText('If your club already posted this on its website or social page, paste the link instead of photos.')
    .setValidation(urlRule_());
  form.addTextItem().setTitle(Q.aHelped).setValidation(numberRule_());
  form.addTextItem().setTitle(Q.aSpent).setValidation(numberRule_());
  form.addCheckboxItem().setTitle(Q.aPartners).setChoiceValues(L.clubs);
  form.addCheckboxItem().setTitle(Q.aConsent).setRequired(true)
    .setChoiceValues(['Everyone in these photos (or their guardian) agreed to them being published.']);

  var eventPage = form.addPageBreakItem().setTitle('About the event');
  form.addTextItem().setTitle(Q.eTitle).setRequired(true)
    .setValidation(FormApp.createTextValidation().requireTextLengthLessThanOrEqualTo(80).setHelpText('Up to 80 characters').build());
  form.addListItem().setTitle(Q.eType).setChoiceValues(CORE_EVENT_TYPES).setRequired(true);
  form.addDateItem().setTitle(Q.eStart).setRequired(true);
  form.addTimeItem().setTitle(Q.eTime);
  form.addDateItem().setTitle(Q.eEnd);
  form.addTextItem().setTitle(Q.eVenue).setRequired(true);
  form.addListItem().setTitle(Q.eCity).setChoiceValues(L.areas).setRequired(true);
  form.addListItem().setTitle(Q.eOrganiser).setChoiceValues(L.organisers).setRequired(true);
  form.addParagraphTextItem().setTitle(Q.eDesc)
    .setValidation(FormApp.createParagraphTextValidation().requireTextLengthLessThanOrEqualTo(400).setHelpText('Up to 400 characters').build());
  form.addTextItem().setTitle(Q.eMap).setValidation(urlRule_());
  form.addTextItem().setTitle(Q.eDetails).setHelpText('No payment or ticket-price links, please.').setValidation(urlRule_());

  kind.setChoices([kind.createChoice(Q.kindActivity, activityPage), kind.createChoice(Q.kindEvent, eventPage)]);
  eventPage.setGoToPage(FormApp.PageNavigationType.SUBMIT); // after the activity page, submit (skip the event page)
  return form;
}

function makeClubProfileForm_(L) {
  var form = baseForm_("Club profile – Rotary District 3110",
    "For club office bearers: your club's website, social media pages and meeting details, shown on your club's page. Send it again any time to update.");
  addSender_(form, L);
  form.getItems()[2].asListItem().setChoiceValues(['President', 'Secretary', 'Other office bearer']);
  [Q.pWebsite, Q.pFacebook, Q.pInstagram, Q.pYoutube, Q.pX, Q.pLinkedin].forEach(function (t) {
    form.addTextItem().setTitle(t + ' (optional)').setValidation(urlRule_());
  });
  form.addTextItem().setTitle(Q.pMeeting + ' (optional)').setHelpText('For example: Every Tuesday, 7:30 pm, Hotel Grand, Agra');
  form.addCheckboxItem().setTitle(Q.pConfirm).setRequired(true)
    .setChoiceValues(['I am an office bearer of this club and these links belong to the club.']);
  return form;
}

function makeConsentForm_(L) {
  var form = baseForm_('Member consent – Rotary District 3110',
    'Choose what the district website may show about you. Each item is a separate choice, and you can change your mind at any time ' +
    'using the removal form. Birthdays and anniversaries are shown as day and month only, never the year.\n\n' +
    'DRAFT WORDING – to be checked by a lawyer before launch.');
  form.addListItem().setTitle(Q.cClub).setChoiceValues(L.clubs).setRequired(true);
  form.addTextItem().setTitle(Q.cName).setRequired(true);
  form.addTextItem().setTitle(Q.cMemberId).setHelpText('Helps us find your record. Never published.')
    .setValidation(FormApp.createTextValidation().requireWholeNumber().setHelpText('Numbers only').build());
  form.addTextItem().setTitle(Q.cMobile).setRequired(true)
    .setHelpText('Used to find your record. Shown only as a WhatsApp/call button, and only if you say Yes below.')
    .setValidation(textRule_(MOBILE_PATTERN, 'Please give a 10-digit mobile number'));
  form.addMultipleChoiceItem().setTitle(Q.cFilledBy).setChoiceValues(['The member', 'Club secretary for the member']).setRequired(true);

  form.addPageBreakItem().setTitle('Professional directory');
  form.addMultipleChoiceItem().setTitle(Q.cDirectory).setChoiceValues(YES_NO).setRequired(true);
  form.addListItem().setTitle(Q.cProfession).setChoiceValues(L.professions).setHelpText('Only if you said Yes above');
  form.addListItem().setTitle(Q.cArea).setChoiceValues(L.areas).setHelpText('Only if you said Yes above');
  form.addTextItem().setTitle(Q.cWhat).setHelpText('Only if you said Yes above. About 20 words.')
    .setValidation(FormApp.createTextValidation().requireTextLengthLessThanOrEqualTo(150).setHelpText('Up to 150 characters').build());
  form.addTextItem().setTitle(Q.cWebsite).setValidation(urlRule_());
  form.addCheckboxItem().setTitle(Q.cSpotlight).setChoiceValues(["I'm happy to be considered for the monthly member spotlight."]);
  form.addMultipleChoiceItem().setTitle(Q.cContact).setChoiceValues(YES_NO).setRequired(true);

  form.addPageBreakItem().setTitle('Photo');
  form.addMultipleChoiceItem().setTitle(Q.cPhoto).setChoiceValues(YES_NO).setRequired(true)
    .setHelpText('If Yes, upload a head-and-shoulders photo of you alone below, or the district may use one it already has.');
  // "My photo" upload question is added here by hand

  form.addPageBreakItem().setTitle('Celebrations');
  form.addMultipleChoiceItem().setTitle(Q.cBirthday).setChoiceValues(YES_NO).setRequired(true);
  form.addDateItem().setTitle(Q.cBirthdayDate).setIncludesYear(false).setHelpText('Day and month only. Only if you said Yes above.');
  form.addMultipleChoiceItem().setTitle(Q.cAnniversary).setChoiceValues(YES_NO).setRequired(true)
    .setHelpText('Shown only if both spouses agree. If your spouse is a Rotarian, they must also send their own form.');
  form.addMultipleChoiceItem().setTitle(Q.cSpouseRotarian).setChoiceValues(YES_NO);
  form.addTextItem().setTitle(Q.cSpouseName).setHelpText('If your spouse is not a Rotarian, only the first name is shown.');
  form.addListItem().setTitle(Q.cSpouseClub).setChoiceValues(L.clubs);
  form.addTextItem().setTitle(Q.cSpouseId).setValidation(FormApp.createTextValidation().requireWholeNumber().setHelpText('Numbers only').build());
  form.addCheckboxItem().setTitle(Q.cSpouseAgrees).setChoiceValues(['My spouse has also agreed to our anniversary being shown.']);
  form.addDateItem().setTitle(Q.cAnniversaryDate).setIncludesYear(false).setHelpText('Day and month only.');
  // "Couple photo" upload question is added here by hand
  form.addCheckboxItem().setTitle(Q.cCoupleAgree)
    .setChoiceValues(['I agree to the couple photo being shown on our anniversary card (and, if my spouse is not a Rotarian, my spouse agrees too).']);

  form.addPageBreakItem().setTitle('Declaration');
  form.addCheckboxItem().setTitle(Q.cDeclaration).setRequired(true)
    .setChoiceValues(['The member has agreed to every choice above. (If filled by the club secretary: the member agreed to each item.)']);
  return form;
}

function makeRemovalForm_(L) {
  var form = baseForm_('Remove my details – Rotary District 3110',
    'Ask for some or all of your details to be removed from the district website. A moderator acts within two days.');
  form.addListItem().setTitle(Q.rClub).setChoiceValues(L.clubs).setRequired(true);
  form.addTextItem().setTitle(Q.rName).setRequired(true);
  form.addTextItem().setTitle(Q.rMemberId).setValidation(FormApp.createTextValidation().requireWholeNumber().setHelpText('Numbers only').build());
  form.addTextItem().setTitle(Q.rMobile).setRequired(true).setValidation(textRule_(MOBILE_PATTERN, 'Please give a 10-digit mobile number'));
  form.addCheckboxItem().setTitle(Q.rItems).setRequired(true)
    .setChoiceValues(['Everything', 'Directory listing', 'WhatsApp / call button', 'My photo', 'Birthday', 'Anniversary', 'Couple photo']);
  form.addParagraphTextItem().setTitle(Q.rReason);
  return form;
}

/** Menu: refresh club, area and profession lists in the forms after the clubs or lists tabs change. */
function updateFormLists() {
  var ids = JSON.parse(props_().getProperty('FORM_IDS') || '{}');
  var L = formLists_();
  var lists = {};
  lists[Q.club] = L.clubs; lists[Q.cClub] = L.clubs; lists[Q.aPartners] = L.clubs; lists[Q.cSpouseClub] = L.clubs;
  lists[Q.eCity] = L.areas; lists[Q.cArea] = L.areas; lists[Q.cProfession] = L.professions; lists[Q.eOrganiser] = L.organisers;
  Object.keys(ids).forEach(function (k) {
    var form = FormApp.openById(ids[k]);
    form.getItems().forEach(function (item) {
      var values = lists[item.getTitle()];
      if (!values) return;
      if (item.getType() === FormApp.ItemType.LIST) item.asListItem().setChoiceValues(values);
      if (item.getType() === FormApp.ItemType.CHECKBOX) item.asCheckboxItem().setChoiceValues(values);
    });
  });
  try { SpreadsheetApp.getUi().alert('Form lists updated.'); } catch (e) { /* editor */ }
}


// ===== Submissions.js =====
/**
 * Form submissions: each answer is copied from the untouched raw tab into a working tab with
 * status "pending". Nothing goes live until a moderator approves it.
 */

function onAnyFormSubmit(e) {
  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    var ids = JSON.parse(props_().getProperty('FORM_IDS') || '{}');
    var formId = e.source.getId();
    var answers = answersOf_(e.response);
    var meta = {
      submitted_at: e.response.getTimestamp().toISOString(),
      submitter_email: e.response.getRespondentEmail() || '',
    };
    if (formId === ids.activity) fileActivityOrEvent_(answers, meta);
    else if (formId === ids.club_profile) fileClubProfile_(answers, meta);
    else if (formId === ids.consent) fileConsent_(answers, meta);
    else if (formId === ids.removal) fileRemoval_(answers, meta);
  } finally {
    lock.releaseLock();
  }
}

/** {question title: answer}. File uploads give an array of Drive file IDs. */
function answersOf_(response) {
  var out = {};
  response.getItemResponses().forEach(function (ir) {
    out[ir.getItem().getTitle()] = ir.getResponse();
  });
  return out;
}

function firstStartingWith_(answers, prefix) {
  var key = Object.keys(answers).filter(function (k) { return k.indexOf(prefix) === 0; })[0];
  return key ? answers[key] : '';
}

function fileIds_(value) {
  if (!value) return '';
  return (Array.isArray(value) ? value : [value]).map(function (id) { return 'drive:' + id; }).join(', ');
}

function checked_(value) {
  return Array.isArray(value) ? value.length > 0 : !!Core_str(value);
}

function yes_(value) {
  return Core_str(value).toLowerCase() === 'yes';
}

/** A no-year date answer comes as "MM-DD"; stored as "DD-MM", the way people in India write it. */
function dayMonthAnswer_(value) {
  var s = Core_str(value);
  var m = s.match(/^(?:\d{4}-)?(\d{2})-(\d{2})$/);
  return m ? m[2] + '-' + m[1] : '';
}

function fileActivityOrEvent_(a, meta) {
  var ss = mainSs_();
  var clubName = Core_str(a[Q.club]);
  var sender = {
    submitted_at: meta.submitted_at, submitter_email: meta.submitter_email, submitter_name: Core_str(a[Q.name]),
    submitter_role: Core_str(a[Q.role]), submitter_mobile: Core_str(a[Q.mobile]), status: 'pending', source: 'form',
  };
  if (Core_str(a[Q.kind]) === Q.kindEvent) {
    var events = readTab_(ss, 'events');
    appendRow_(ss, 'events', Object.assign(sender, {
      id: nextId_(events, 'EVT-' + new Date().getFullYear() + '-'),
      title: Core_str(a[Q.eTitle]), event_type: Core_str(a[Q.eType]), start_date: Core_str(a[Q.eStart]),
      start_time: Core_str(a[Q.eTime]), end_date: Core_str(a[Q.eEnd]), venue: Core_str(a[Q.eVenue]), city: Core_str(a[Q.eCity]),
      organiser: Core_str(a[Q.eOrganiser]) || clubName, description: Core_str(a[Q.eDesc]), map_link: Core_str(a[Q.eMap]),
      details_link: Core_str(a[Q.eDetails]),
    }));
    return;
  }
  var activities = readTab_(ss, 'activities');
  var partners = (a[Q.aPartners] || []).map(clubIdByName_).filter(function (id) { return id; });
  var row = Object.assign(sender, {
    id: nextId_(activities, 'ACT-' + new Date().getFullYear() + '-'),
    club_id: clubIdByName_(clubName), club_name: clubName,
    title: Core_str(a[Q.aTitle]), date: Core_str(a[Q.aDate]), theme: Core_str(a[Q.aTheme]), description: Core_str(a[Q.aDesc]),
    photo_files: fileIds_(firstStartingWith_(a, 'Photos')), post_link: Core_str(a[Q.aLink]),
    people_helped: Core_str(a[Q.aHelped]), amount_spent: Core_str(a[Q.aSpent]), partner_clubs: partners.join(', '),
    photo_consent: checked_(a[Q.aConsent]),
  });
  var notes = [];
  var dup = Core_findDuplicate(row, activities);
  if (dup) notes.push('Possible duplicate of ' + dup);
  if (!row.photo_files && !row.post_link) notes.push('No photo or link: reject or ask the club for one');
  if (Core_isoDate(row.date) > today_()) notes.push('Date is in the future');
  row.moderator_note = notes.join('; ');
  appendRow_(ss, 'activities', row);
}

function fileClubProfile_(a, meta) {
  var ss = mainSs_();
  var clubName = Core_str(a[Q.club]);
  var ans = function (t) { return Core_str(a[t + ' (optional)']); };
  appendRow_(ss, 'club_profile_requests', {
    id: nextId_(readTab_(ss, 'club_profile_requests'), 'CPR-'), submitted_at: meta.submitted_at, submitter_email: meta.submitter_email,
    submitter_name: Core_str(a[Q.name]), submitter_role: Core_str(a[Q.role]), submitter_mobile: Core_str(a[Q.mobile]),
    club_id: clubIdByName_(clubName), club_name: clubName, website: ans(Q.pWebsite), facebook: ans(Q.pFacebook),
    instagram: ans(Q.pInstagram), youtube: ans(Q.pYoutube), x: ans(Q.pX), linkedin: ans(Q.pLinkedin),
    meeting_day_place: ans(Q.pMeeting), status: 'pending',
  });
}

function fileConsent_(a, meta) {
  var ps = privateSs_();
  var spouseRotarian = yes_(a[Q.cSpouseRotarian]);
  appendRow_(ps, 'consent_requests', {
    id: nextId_(readTab_(ps, 'consent_requests'), 'CON-'), submitted_at: meta.submitted_at, submitter_email: meta.submitter_email,
    filled_by: Core_str(a[Q.cFilledBy]), club_id: clubIdByName_(a[Q.cClub]), name: Core_str(a[Q.cName]),
    member_id: Core_str(a[Q.cMemberId]), mobile: Core_str(a[Q.cMobile]),
    directory_ok: yes_(a[Q.cDirectory]), profession: Core_str(a[Q.cProfession]), area: Core_str(a[Q.cArea]),
    description: Core_str(a[Q.cWhat]), website: Core_str(a[Q.cWebsite]), spotlight_ok: checked_(a[Q.cSpotlight]),
    contact_ok: yes_(a[Q.cContact]), photo_ok: yes_(a[Q.cPhoto]), photo_file: fileIds_(firstStartingWith_(a, 'My photo')),
    birthday_ok: yes_(a[Q.cBirthday]), birthday: dayMonthAnswer_(a[Q.cBirthdayDate]),
    anniversary_ok: yes_(a[Q.cAnniversary]), spouse_is_rotarian: spouseRotarian ? 'Yes' : (Core_str(a[Q.cSpouseRotarian]) ? 'No' : ''),
    spouse_name: Core_str(a[Q.cSpouseName]), spouse_club_id: spouseRotarian ? clubIdByName_(a[Q.cSpouseClub]) : '',
    spouse_member_id: Core_str(a[Q.cSpouseId]), spouse_agrees: checked_(a[Q.cSpouseAgrees]),
    anniversary: dayMonthAnswer_(a[Q.cAnniversaryDate]), couple_photo_file: fileIds_(firstStartingWith_(a, 'Couple photo')),
    couple_photo_spouse_agrees: checked_(a[Q.cCoupleAgree]), declaration: checked_(a[Q.cDeclaration]), status: 'pending',
  });
}

function fileRemoval_(a, meta) {
  var ps = privateSs_();
  appendRow_(ps, 'removal_requests', {
    id: nextId_(readTab_(ps, 'removal_requests'), 'REM-'), submitted_at: meta.submitted_at, submitter_email: meta.submitter_email,
    club_id: clubIdByName_(a[Q.rClub]), name: Core_str(a[Q.rName]), member_id: Core_str(a[Q.rMemberId]),
    mobile: Core_str(a[Q.rMobile]), remove_items: (a[Q.rItems] || []).join(', '), reason: Core_str(a[Q.rReason]), status: 'pending',
  });
}


// ===== Moderation.js =====
/**
 * The "Rotary" menu for moderators.
 */

function onOpen() {
  SpreadsheetApp.getUi().createMenu('Rotary')
    .addItem('✔ Approve selected row(s)', 'approveSelected')
    .addItem('✖ Reject selected row(s)…', 'rejectSelected')
    .addSeparator()
    .addItem('Member requests (consent & removal)…', 'openMemberRequests')
    .addItem('Mark as deceased…', 'markDeceased')
    .addItem('Refresh public members', 'refreshPublicMembers')
    .addSeparator()
    .addItem('Rebuild site now', 'requestRebuild')
    .addItem('Refresh dashboard', 'refreshDashboard')
    .addItem('Update form lists (clubs, areas, professions)', 'updateFormLists')
    .addSeparator()
    .addSubMenu(SpreadsheetApp.getUi().createMenu('Sample data')
      .addItem('Load sample data', 'loadSampleData')
      .addItem('Clear all sample data…', 'clearSampleData'))
    .addSubMenu(SpreadsheetApp.getUi().createMenu('Administrator')
      .addItem('Show data link details', 'showDataLink')
      .addItem('Run setup again', 'setup'))
    .addToUi();
}

var MODERATED_TABS = ['activities', 'events', 'club_profile_requests'];

function selectedRows_() {
  var sh = SpreadsheetApp.getActiveSheet();
  var name = sh.getName();
  if (MODERATED_TABS.indexOf(name) < 0) {
    throw new Error('Select one or more rows in the activities, events or club_profile_requests tab first.');
  }
  var rows = [];
  sh.getActiveRangeList().getRanges().forEach(function (r) {
    for (var i = r.getRow(); i < r.getRow() + r.getNumRows(); i++) if (i > 1 && rows.indexOf(i) < 0) rows.push(i);
  });
  var all = readTab_(mainSs_(), name);
  return { tab: name, rows: all.filter(function (r) { return rows.indexOf(r._row) >= 0; }) };
}

function approveSelected() {
  var ui = SpreadsheetApp.getUi();
  var sel;
  try { sel = selectedRows_(); } catch (e) { ui.alert(e.message); return; }
  var ss = mainSs_();
  var who = moderatorEmail_();
  var done = [];
  var refused = [];
  sel.rows.forEach(function (r) {
    if (Core_str(r.status) === 'approved') return;
    if (sel.tab === 'activities' && !Core_str(r.photo_files) && !Core_url(r.post_link)) {
      refused.push(r.id + ' (needs a photo or a link to the club\'s post)');
      return;
    }
    if (sel.tab === 'activities' && !Core_str(r.club_id)) {
      refused.push(r.id + ' (club not recognised: fill in club_id)');
      return;
    }
    updateRow_(ss, sel.tab, r._row, { status: 'approved', approved_by: who, approved_at: nowIso_() });
    if (sel.tab === 'club_profile_requests') applyClubProfile_(r);
    notifySubmitter_(sel.tab, r, true, '');
    done.push(r.id);
  });
  ui.alert((done.length ? 'Approved: ' + done.join(', ') + '.\nIt will appear on the website at the next update (Sunday), or press "Rebuild site now".' : 'Nothing approved.') +
    (refused.length ? '\n\nNot approved: ' + refused.join('; ') : ''));
}

function rejectSelected() {
  var ui = SpreadsheetApp.getUi();
  var sel;
  try { sel = selectedRows_(); } catch (e) { ui.alert(e.message); return; }
  var answer = ui.prompt('Reject ' + sel.rows.length + ' row(s)', 'Reason (sent to the person who submitted it):', ui.ButtonSet.OK_CANCEL);
  if (answer.getSelectedButton() !== ui.Button.OK) return;
  var reason = answer.getResponseText().trim() || 'Not suitable for the website';
  var ss = mainSs_();
  var who = moderatorEmail_();
  sel.rows.forEach(function (r) {
    updateRow_(ss, sel.tab, r._row, { status: 'rejected', approved_by: who, approved_at: nowIso_(), moderator_note: reason });
    notifySubmitter_(sel.tab, r, false, reason);
  });
  ui.alert('Rejected ' + sel.rows.length + ' row(s).');
}

function applyClubProfile_(r) {
  var ss = mainSs_();
  var club = readTab_(ss, 'clubs').filter(function (c) { return Core_str(c.club_id) === Core_str(r.club_id); })[0];
  if (!club) return;
  var fields = { profile_updated_at: nowIso_() };
  ['website', 'facebook', 'instagram', 'youtube', 'x', 'linkedin', 'meeting_day_place'].forEach(function (k) {
    if (Core_str(r[k])) fields[k] = Core_str(r[k]);
  });
  updateRow_(ss, 'clubs', club._row, fields);
}

function notifySubmitter_(tab, r, approved, reason) {
  var to = Core_str(r.submitter_email);
  if (!to || Core_isTrue(r.is_sample)) return;
  var site = Core_str(settings_().site_url);
  var what = tab === 'events' ? 'event "' + r.title + '"' : tab === 'activities' ? 'activity "' + r.title + '"' : 'club profile update';
  var link = tab === 'activities' ? site + 'activities/' + Core_str(r.id).toLowerCase() + '/'
    : tab === 'events' ? site + 'events/' + Core_str(r.id).toLowerCase() + '/' : site + 'clubs/';
  var body = approved
    ? 'Thank you! Your ' + what + ' has been approved by a district moderator.\n\nIt will appear on the district website at the next update (every Sunday):\n' + link +
      '\n\nPlease share it in your club\'s WhatsApp group once it is live.\n\nRotary District 3110'
    : 'Thank you for sending your ' + what + '. A district moderator could not publish it this time.\n\nReason: ' + reason +
      '\n\nYou are welcome to send it again with the changes.\n\nRotary District 3110';
  try {
    MailApp.sendEmail(to, (approved ? 'Approved: ' : 'Not published: ') + what, body);
    if (tab !== 'club_profile_requests') updateRow_(mainSs_(), tab, r._row, { notified: true });
  } catch (e) {
    Logger.log('Email to ' + to + ' failed: ' + e.message);
  }
}

/** Asks the website to rebuild within about 15 minutes, instead of waiting for Sunday. */
function requestRebuild() {
  setSetting_('rebuild_requested_at', nowIso_());
  try {
    SpreadsheetApp.getUi().alert('Done. The website will update within about 15 minutes.');
  } catch (e) { /* called from code */ }
}

function showDataLink() {
  var ui = SpreadsheetApp.getUi();
  if (Session.getActiveUser().getEmail() !== Session.getEffectiveUser().getEmail()) {
    ui.alert('Only the owner of the Sheet can see the data link details.');
    return;
  }
  var url = '';
  try { url = ScriptApp.getService().getUrl(); } catch (e) { url = ''; }
  ui.alert('Data link details',
    'Web app address:\n' + (url || '(not deployed yet: Deploy → New deployment → Web app)') +
    '\n\nToken:\n' + props_().getProperty('DATA_TOKEN') +
    '\n\nGive these two to the person setting up the website build. Keep the token private.', ui.ButtonSet.OK);
}


// ===== Members.js =====
/**
 * Members, spouses and couples. Everything personal lives in the private Sheet; only the result of
 * Core_buildMembersPublic (opted-in people, ticked fields, day and month only) is copied to the main Sheet.
 */

/** Menu: rebuilds members_public and couples_public from the private Sheet. */
function refreshPublicMembers(silent) {
  var ps = privateSs_();
  attachFolderPhotos_(ps);
  var master = readTab_(ps, 'members_master');
  var couples = readTab_(ps, 'couples');
  var result = Core_buildMembersPublic(master, couples, function () { return 'k' + Utilities.getUuid().replace(/-/g, '').slice(0, 10); });

  // Save any new public keys back to the private Sheet
  Object.keys(result.newKeys).forEach(function (memberId) {
    var row = master.filter(function (m) { return Core_str(m.member_id) === memberId; })[0];
    if (row) updateRow_(ps, 'members_master', row._row, { public_key: result.newKeys[memberId] });
  });

  var problems = Core_validatePublic({ members: stripIds_(result.members), couples: result.couples, inactive_keys: result.inactiveKeys });
  if (problems.length) throw new Error('Public members not refreshed – privacy check failed:\n' + problems.slice(0, 10).join('\n'));

  var main = mainSs_();
  replaceRows_(main, 'members_public', result.members);
  replaceRows_(main, 'couples_public', result.couples);
  setSetting_('inactive_keys', result.inactiveKeys.join(', '));
  if (silent !== true) {
    try {
      SpreadsheetApp.getUi().alert('Public members refreshed: ' + result.members.length + ' members, ' + result.couples.length + ' anniversaries.');
    } catch (e) { /* called from code */ }
  }
  return result;
}

function stripIds_(members) {
  return members.map(function (m) {
    var copy = {};
    Object.keys(m).forEach(function (k) { if (k !== 'member_id') copy[k] = m[k]; });
    return copy;
  });
}

/** Photos the district already holds: <member ID>.jpg in MemberPhotos, used only where the member ticked photo consent. */
function attachFolderPhotos_(ps) {
  var folder = memberPhotosFolder_();
  if (!folder) return;
  var byName = {};
  var files = folder.getFiles();
  while (files.hasNext()) {
    var f = files.next();
    byName[f.getName().replace(/\.(jpe?g|png|webp)$/i, '')] = f.getId();
  }
  readTab_(ps, 'members_master').forEach(function (m) {
    var id = Core_str(m.member_id);
    if (Core_isTrue(m.photo_ok) && !Core_str(m.photo_file) && byName[id]) {
      // placed in the folder by a moderator, so it counts as approved
      updateRow_(ps, 'members_master', m._row, { photo_file: 'drive:' + byName[id], photo_approved: true });
    }
  });
}

/* ---------------- Member requests sidebar ---------------- */

function openMemberRequests() {
  var html = HtmlService.createTemplateFromFile('Sidebar').evaluate().setTitle('Member requests');
  SpreadsheetApp.getUi().showSidebar(html);
}

/** Called by the sidebar. */
function getMemberRequests() {
  var ps = privateSs_();
  var master = readTab_(ps, 'members_master');
  var clubName = function (id) { return clubNameById_(id) || id || '–'; };
  var describe = function (r) {
    var i = Core_matchMember(r, master);
    return i >= 0 ? 'Matches ' + master[i].name + ' (' + master[i].member_id + ')' : 'No matching member – a new record will be created';
  };
  var thumb = function (ref) {
    var id = Core_str(ref).replace(/^drive:/, '').split(',')[0].trim();
    if (!id) return '';
    try {
      var blob = DriveApp.getFileById(id).getThumbnail();
      return blob ? 'data:image/png;base64,' + Utilities.base64Encode(blob.getBytes()) : '';
    } catch (e) { return ''; }
  };
  var consent = readTab_(ps, 'consent_requests').filter(function (r) { return Core_str(r.status) === 'pending'; }).map(function (r) {
    return {
      id: r.id, name: r.name, club: clubName(r.club_id), filledBy: r.filled_by, match: describe(r), submitted: Core_isoTimestamp(r.submitted_at),
      choices: [
        r.directory_ok ? 'Directory: ' + [r.profession, r.area].filter(String).join(', ') : '',
        r.contact_ok ? 'WhatsApp button' : '',
        r.photo_ok ? 'Photo' : '',
        r.birthday_ok ? 'Birthday ' + r.birthday : '',
        r.anniversary_ok ? 'Anniversary ' + r.anniversary + ' with ' + (r.spouse_name || '?') + (r.spouse_is_rotarian === 'Yes' ? ' (Rotarian, ' + clubName(r.spouse_club_id) + ')' : '') : '',
      ].filter(String),
      description: r.description, website: r.website, photo: thumb(r.photo_file), couplePhoto: thumb(r.couple_photo_file),
      warnings: [
        r.declaration ? '' : 'Declaration not ticked',
        r.anniversary_ok && r.spouse_is_rotarian !== 'Yes' && !r.spouse_agrees ? 'Spouse agreement not ticked' : '',
        r.directory_ok && !r.profession ? 'No profession given' : '',
      ].filter(String),
    };
  });
  var removal = readTab_(ps, 'removal_requests').filter(function (r) { return Core_str(r.status) === 'pending'; }).map(function (r) {
    return { id: r.id, name: r.name, club: clubName(r.club_id), items: r.remove_items, reason: r.reason, match: describe(r), submitted: Core_isoTimestamp(r.submitted_at) };
  });
  var waiting = readTab_(ps, 'couples').filter(function (c) { return ['awaiting_spouse', 'check_dates'].indexOf(Core_str(c.status)) >= 0; }).map(function (c) {
    var name = function (id) { var m = master.filter(function (x) { return Core_str(x.member_id) === Core_str(id); })[0]; return m ? m.name : id; };
    return { id: c.couple_id, names: name(c.person_a_id) + ' & ' + name(c.person_b_id), status: c.status, notes: c.notes };
  });
  return { consent: consent, removal: removal, waiting: waiting };
}

/** Called by the sidebar: approve a consent request. */
function approveConsent(requestId) {
  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    var ps = privateSs_();
    var req = readTab_(ps, 'consent_requests').filter(function (r) { return r.id === requestId; })[0];
    if (!req || Core_str(req.status) !== 'pending') throw new Error('Request ' + requestId + ' is not pending.');
    if (!Core_isTrue(req.declaration)) throw new Error('The declaration was not ticked; reject and ask the member to send the form again.');
    var who = moderatorEmail_();
    var member = findOrCreateMember_(ps, req, 'Created from consent request ' + requestId);
    var fields = {
      directory_ok: Core_isTrue(req.directory_ok), contact_ok: Core_isTrue(req.contact_ok), photo_ok: Core_isTrue(req.photo_ok),
      birthday_ok: Core_isTrue(req.birthday_ok), anniversary_ok: Core_isTrue(req.anniversary_ok), spotlight_ok: Core_isTrue(req.spotlight_ok),
      listing_approved: true, listing_approved_by: who, listing_approved_at: nowIso_(),
      consent_source: req.filled_by, consent_updated_at: nowIso_(),
    };
    if (fields.directory_ok) {
      fields.profession = req.profession; fields.area = req.area; fields.description = req.description; fields.website = req.website;
    }
    if (Core_mobile(req.mobile)) fields.mobile = req.mobile;
    if (Core_str(req.photo_file)) {
      if (Core_str(member.photo_file) && member.photo_file !== req.photo_file) trashRef_(member.photo_file); // newer photo replaces the old
      fields.photo_file = Core_str(req.photo_file).split(',')[0].trim();
      fields.photo_approved = true; // the moderator has seen it in the request
    }
    if (fields.birthday_ok && req.birthday && !Core_dayMonth(member.dob)) fields.dob = req.birthday;
    updateRow_(ps, 'members_master', member._row, fields);

    if (fields.anniversary_ok) linkCouple_(ps, member, req);
    else withdrawCouples_(ps, member.member_id, 'Anniversary not ticked on consent request ' + requestId);

    updateRow_(ps, 'consent_requests', req._row, { status: 'approved', matched_member_id: member.member_id, approved_by: who, approved_at: nowIso_() });
    refreshPublicMembers(true);
    return 'Approved ' + requestId + ' for ' + member.name;
  } finally {
    lock.releaseLock();
  }
}

function findOrCreateMember_(ps, req, note) {
  var master = readTab_(ps, 'members_master');
  var i = Core_matchMember(req, master);
  if (i >= 0) return master[i];
  var id = Core_str(req.member_id) || nextId_(master, 'TM-');
  var row = appendRow_(ps, 'members_master', {
    member_id: id, name: req.name, club_id: req.club_id, is_rotarian: true, status: 'active', mobile: req.mobile, notes: note,
  });
  appendRow_(ps, 'club_history', { member_id: id, club_id: req.club_id, from_date: today_(), reason: 'recorded from consent form' });
  return readTab_(ps, 'members_master').filter(function (m) { return m._row === row; })[0];
}

/** Creates or updates the couple record for an anniversary request. */
function linkCouple_(ps, member, req) {
  var couples = readTab_(ps, 'couples');
  var master = readTab_(ps, 'members_master');
  var anniversary = req.anniversary;

  if (Core_str(req.spouse_is_rotarian) !== 'Yes') {
    // Spouse is not a Rotarian: the member's tick records the spouse's agreement
    var existing = couples.filter(function (c) {
      if (Core_str(c.person_a_id) !== Core_str(member.member_id)) return false;
      var b = master.filter(function (m) { return Core_str(m.member_id) === Core_str(c.person_b_id); })[0];
      return b && !Core_isTrue(b.is_rotarian);
    })[0];
    var spouseId = existing ? existing.person_b_id : nextId_(master, 'TM-');
    if (!existing) {
      appendRow_(ps, 'members_master', { member_id: spouseId, name: req.spouse_name, is_rotarian: false, status: 'active', spouse_id: member.member_id, notes: 'Spouse (not a Rotarian) of ' + member.name });
    }
    var agrees = Core_isTrue(req.spouse_agrees);
    var photoAgreed = Core_isTrue(req.couple_photo_spouse_agrees) && !!Core_str(req.couple_photo_file);
    var fields = {
      couple_id: existing ? existing.couple_id : nextId_(couples.map(function (c) { return { id: c.couple_id }; }), 'C-'),
      person_a_id: member.member_id, person_b_id: spouseId, anniversary: anniversary, a_consent: true, b_consent: agrees,
      status: agrees ? 'active' : 'awaiting_spouse', notes: agrees ? '' : "Spouse's agreement not ticked",
    };
    if (Core_str(req.couple_photo_file)) {
      if (existing && Core_str(existing.couple_photo_file)) trashRef_(existing.couple_photo_file);
      fields.couple_photo_file = Core_str(req.couple_photo_file).split(',')[0].trim();
      fields.couple_photo_ok_a = photoAgreed; fields.couple_photo_ok_b = photoAgreed; fields.couple_photo_approved = true;
    }
    if (existing) updateRow_(ps, 'couples', existing._row, fields); else appendRow_(ps, 'couples', fields);
    return;
  }

  // Spouse is a Rotarian: each must agree on their own form
  var spouseReq = { member_id: req.spouse_member_id, club_id: req.spouse_club_id, mobile: '' };
  var si = Core_matchMember(spouseReq, master);
  if (si < 0) {
    var target = Core_str(req.spouse_name).toLowerCase().replace(/^(rtn|dr)\.?\s+/g, '').replace(/[^a-z]/g, '');
    master.forEach(function (m, idx) {
      if (si < 0 && Core_str(m.club_id) === Core_str(req.spouse_club_id) &&
        Core_str(m.name).toLowerCase().replace(/^(rtn|dr)\.?\s+/g, '').replace(/[^a-z]/g, '') === target) si = idx;
    });
  }
  var spouse = si >= 0 ? master[si] : null;
  if (!spouse) {
    var newId = Core_str(req.spouse_member_id) || nextId_(master, 'TM-');
    appendRow_(ps, 'members_master', { member_id: newId, name: req.spouse_name, club_id: req.spouse_club_id, is_rotarian: true, status: 'active', notes: 'Spouse of ' + member.name + ' – recorded from a consent form; please check' });
    spouse = { member_id: newId, name: req.spouse_name };
  }
  var couple = couples.filter(function (c) {
    var ids = [Core_str(c.person_a_id), Core_str(c.person_b_id)];
    return ids.indexOf(Core_str(member.member_id)) >= 0 && ids.indexOf(Core_str(spouse.member_id)) >= 0;
  })[0];
  var memberIsA = !couple || Core_str(couple.person_a_id) === Core_str(member.member_id);
  var update = {};
  update[memberIsA ? 'a_consent' : 'b_consent'] = true;
  update[memberIsA ? 'couple_photo_ok_a' : 'couple_photo_ok_b'] = Core_isTrue(req.couple_photo_spouse_agrees);
  if (Core_str(req.couple_photo_file)) {
    update.couple_photo_file = Core_str(req.couple_photo_file).split(',')[0].trim();
    update.couple_photo_approved = true;
  }
  if (!couple) {
    update.couple_id = nextId_(couples.map(function (c) { return { id: c.couple_id }; }), 'C-');
    update.person_a_id = member.member_id;
    update.person_b_id = spouse.member_id;
    update.anniversary = anniversary;
    update.b_consent = false;
    update.status = 'awaiting_spouse';
    update.notes = "Waiting for the spouse's own consent form";
    appendRow_(ps, 'couples', update);
    return;
  }
  var otherConsent = Core_isTrue(memberIsA ? couple.b_consent : couple.a_consent);
  var sameDate = Core_dayMonth(couple.anniversary) === Core_dayMonth(anniversary);
  update.status = !otherConsent ? 'awaiting_spouse' : sameDate ? 'active' : 'check_dates';
  update.notes = update.status === 'check_dates' ? 'The two forms give different dates (' + couple.anniversary + ' and ' + anniversary + '); please check' : '';
  updateRow_(ps, 'couples', couple._row, update);
}

function withdrawCouples_(ps, memberId, note) {
  readTab_(ps, 'couples').forEach(function (c) {
    if ([Core_str(c.person_a_id), Core_str(c.person_b_id)].indexOf(Core_str(memberId)) >= 0 && Core_str(c.status) !== 'withdrawn') {
      if (Core_str(c.couple_photo_file)) trashRef_(c.couple_photo_file);
      updateRow_(ps, 'couples', c._row, { status: 'withdrawn', couple_photo_file: '', couple_photo_ok_a: false, couple_photo_ok_b: false, notes: note });
    }
  });
}

/** Removed photos are moved to Google Drive's bin (deleted for good after 30 days). Sample photos are left alone. */
function trashRef_(ref) {
  var id = Core_str(ref).replace(/^drive:/, '').split(',')[0].trim();
  if (!id || Core_str(ref).indexOf('sample:') === 0) return;
  try { DriveApp.getFileById(id).setTrashed(true); } catch (e) { Logger.log('Could not delete photo ' + id + ': ' + e.message); }
}

/** Called by the sidebar: approve a removal request. Either spouse can withdraw shared items alone. */
function approveRemoval(requestId) {
  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    var ps = privateSs_();
    var req = readTab_(ps, 'removal_requests').filter(function (r) { return r.id === requestId; })[0];
    if (!req || Core_str(req.status) !== 'pending') throw new Error('Request ' + requestId + ' is not pending.');
    var master = readTab_(ps, 'members_master');
    var i = Core_matchMember(req, master);
    if (i < 0) throw new Error('No member matches this request. Check the name, club and mobile number, then fill in member_id on the request.');
    var m = master[i];
    var items = Core_str(req.remove_items).toLowerCase();
    var all = items.indexOf('everything') >= 0;
    var f = {};
    if (all || items.indexOf('directory') >= 0) { f.directory_ok = false; f.contact_ok = false; f.profession = ''; f.description = ''; f.website = ''; f.spotlight_ok = false; }
    if (all || items.indexOf('whatsapp') >= 0) f.contact_ok = false;
    if (all || items.indexOf('my photo') >= 0) { f.photo_ok = false; if (Core_str(m.photo_file)) trashRef_(m.photo_file); f.photo_file = ''; f.photo_approved = false; }
    if (all || items.indexOf('birthday') >= 0) f.birthday_ok = false;
    if (all) { f.listing_approved = false; f.anniversary_ok = false; }
    f.consent_updated_at = nowIso_();
    f.notes = (Core_str(m.notes) + ' | Removal ' + requestId + ': ' + req.remove_items).replace(/^ \| /, '');
    updateRow_(ps, 'members_master', m._row, f);
    if (all || items.indexOf('anniversary') >= 0) {
      updateRow_(ps, 'members_master', m._row, { anniversary_ok: false });
      withdrawCouples_(ps, m.member_id, 'Withdrawn by ' + m.name + ' (' + requestId + ')');
    } else if (items.indexOf('couple photo') >= 0) {
      readTab_(ps, 'couples').forEach(function (c) {
        if ([Core_str(c.person_a_id), Core_str(c.person_b_id)].indexOf(Core_str(m.member_id)) >= 0 && Core_str(c.couple_photo_file)) {
          trashRef_(c.couple_photo_file);
          updateRow_(ps, 'couples', c._row, { couple_photo_file: '', couple_photo_ok_a: false, couple_photo_ok_b: false });
        }
      });
    }
    updateRow_(ps, 'removal_requests', req._row, { status: 'approved', matched_member_id: m.member_id, approved_by: moderatorEmail_(), approved_at: nowIso_() });
    refreshPublicMembers(true);
    setSetting_('rebuild_requested_at', nowIso_()); // removals should not wait for Sunday
    return 'Removed for ' + m.name + '. The website updates within about 15 minutes.';
  } finally {
    lock.releaseLock();
  }
}

/** Called by the sidebar: reject a consent or removal request. */
function rejectRequest(kind, requestId, reason) {
  var ps = privateSs_();
  var tab = kind === 'removal' ? 'removal_requests' : 'consent_requests';
  var req = readTab_(ps, tab).filter(function (r) { return r.id === requestId; })[0];
  if (!req) throw new Error('Request not found');
  updateRow_(ps, tab, req._row, { status: 'rejected', moderator_note: reason || '', approved_by: moderatorEmail_(), approved_at: nowIso_() });
  return 'Rejected ' + requestId;
}

/** Menu: stops all greetings for a person who has passed away, immediately. Their roles stay on record. */
function markDeceased() {
  var ui = SpreadsheetApp.getUi();
  var answer = ui.prompt('Mark as deceased', 'Rotary member ID (or internal ID such as T-0012) of the member or spouse:', ui.ButtonSet.OK_CANCEL);
  if (answer.getSelectedButton() !== ui.Button.OK) return;
  var id = answer.getResponseText().trim();
  var ps = privateSs_();
  var m = readTab_(ps, 'members_master').filter(function (x) { return Core_str(x.member_id) === id; })[0];
  if (!m) { ui.alert('No one with ID ' + id + ' in the private members list.'); return; }
  if (ui.alert('Confirm', 'Mark ' + m.name + ' as deceased? Birthday and anniversary greetings for them stop at once.', ui.ButtonSet.YES_NO) !== ui.Button.YES) return;
  updateRow_(ps, 'members_master', m._row, { status: 'deceased', notes: (Core_str(m.notes) + ' | Marked deceased ' + today_() + ' by ' + moderatorEmail_()).replace(/^ \| /, '') });
  readTab_(ps, 'club_history').forEach(function (h) {
    if (Core_str(h.member_id) === id && !Core_str(h.to_date)) updateRow_(ps, 'club_history', h._row, { to_date: today_(), reason: 'deceased' });
  });
  refreshPublicMembers(true);
  requestRebuild();
}


// ===== Endpoint.js =====
/**
 * The protected data link the website build reads (Deploy → Web app, execute as me, anyone can open).
 * Without the right token it returns nothing. It only ever returns approved rows and public fields,
 * and refuses to answer if the privacy check fails.
 *
 *   ?mode=status&token=…        when a rebuild was last requested
 *   ?mode=data&token=…          the public website data
 *   ?mode=file&id=…&token=…     one approved photo (base64)
 *   ?mode=thumb&id=…&token=…    the first-page picture of a magazine PDF
 */

function doGet(e) {
  var p = (e && e.parameter) || {};
  try {
    var expected = props_().getProperty('DATA_TOKEN');
    if (!expected || p.token !== expected) return json_({ ok: false, error: 'not allowed' });
    if (p.mode === 'status') return json_({ ok: true, rebuild_requested_at: Core_isoTimestamp(settings_().rebuild_requested_at) });
    if (p.mode === 'data') {
      var data = publicData_();
      return json_({ ok: true, data: data });
    }
    if (p.mode === 'file' || p.mode === 'thumb') return json_(fileFor_(p.mode, p.id));
    return json_({ ok: false, error: 'unknown mode' });
  } catch (err) {
    return json_({ ok: false, error: String(err.message || err) });
  }
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function publicData_() {
  scanMagazines_();
  var ss = mainSs_();
  var tabs = {};
  ['settings', 'clubs', 'officers', 'functionaries', 'activities', 'events', 'magazines', 'messages', 'spotlights', 'members_public', 'couples_public']
    .forEach(function (name) { tabs[name] = readTab_(ss, name); });
  var data = Core_buildPublicData(tabs, nowIso_());
  var problems = Core_validatePublic(data);
  if (problems.length) throw new Error('privacy check failed: ' + problems.slice(0, 5).join(' | '));
  // remember which Drive files may be handed out, for the file mode below
  var allowed = {};
  Core_walk(data, '', function (path, v) {
    if (typeof v === 'string' && /^(drive|thumb):/.test(v)) allowed[v] = true;
  });
  CacheService.getScriptCache().put('allowed_files', JSON.stringify(Object.keys(allowed)), 21600);
  return data;
}

function fileFor_(mode, id) {
  var ref = (mode === 'thumb' ? 'thumb:' : 'drive:') + id;
  var cached = CacheService.getScriptCache().get('allowed_files');
  if (!cached) { publicData_(); cached = CacheService.getScriptCache().get('allowed_files'); }
  if (JSON.parse(cached || '[]').indexOf(ref) < 0) return { ok: false, error: 'file is not part of the public data' };
  var file = DriveApp.getFileById(id);
  var blob = mode === 'thumb' ? file.getThumbnail() : file.getBlob();
  if (!blob) return { ok: false, error: 'no picture available' };
  return { ok: true, mimeType: blob.getContentType(), base64: Utilities.base64Encode(blob.getBytes()) };
}

/** Adds any new PDF in the magazine folder (named like 2026-10.pdf) to the magazines tab. */
function scanMagazines_() {
  var ss = mainSs_();
  var known = readTab_(ss, 'magazines').map(function (m) { return Core_str(m.issue_month).slice(0, 7); });
  var folder = DriveApp.getFolderById(CONFIG.MAGAZINE_FOLDER_ID);
  var covers = {};
  var pdfs = [];
  var files = folder.getFiles();
  while (files.hasNext()) {
    var f = files.next();
    var m = f.getName().match(/^(\d{4})-(\d{2})/);
    if (!m) continue;
    var month = m[1] + '-' + m[2];
    if (/\.pdf$/i.test(f.getName())) pdfs.push({ month: month, id: f.getId() });
    else if (/\.(jpe?g|png|webp)$/i.test(f.getName())) covers[month] = f.getId();
  }
  var names = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  pdfs.forEach(function (p) {
    if (known.indexOf(p.month) >= 0) return;
    appendRow_(ss, 'magazines', {
      issue_month: p.month,
      title: 'District 3110 News – ' + names[+p.month.slice(5) - 1] + ' ' + p.month.slice(0, 4),
      pdf_file: 'drive:' + p.id,
      pdf_url: 'https://drive.google.com/file/d/' + p.id + '/view',
      cover_image: covers[p.month] ? 'drive:' + covers[p.month] : 'thumb:' + p.id,
    });
    known.push(p.month);
  });
}


// ===== Jobs.js =====
/**
 * Daily at 7 am (India): 48-hour reminders to moderators, the monthly-nudge dashboard, new magazines.
 */

function dailyJobs() {
  scanMagazines_();
  refreshDashboard();
  sendReminders_();
}

function sendReminders_() {
  var now = Date.now();
  var main = mainSs_();
  var ps = privateSs_();
  var overdue = [];
  ['activities', 'events', 'club_profile_requests'].forEach(function (t) {
    Core_overdue(readTab_(main, t), now, CONFIG.REMINDER_HOURS).forEach(function (r) { overdue.push(t + ': ' + r.id + ' – ' + (r.title || r.club_name || '')); });
  });
  ['consent_requests', 'removal_requests'].forEach(function (t) {
    Core_overdue(readTab_(ps, t), now, CONFIG.REMINDER_HOURS).forEach(function (r) { overdue.push(t + ': ' + r.id + ' – ' + r.name); });
  });
  if (!overdue.length) return;
  var to = Core_list(settings_().moderator_emails).join(',') || Session.getEffectiveUser().getEmail();
  MailApp.sendEmail(to, 'Rotary 3110 website: ' + overdue.length + ' item(s) waiting more than 48 hours',
    'These are waiting for a moderator:\n\n' + overdue.join('\n') +
    '\n\nOpen the Sheet and use the Rotary menu to approve or reject:\n' + main.getUrl() +
    '\n\nRemoval requests should be handled within two days.');
}

/** Per-club activity counts for the monthly nudge and the "half of clubs posting" measure. */
function refreshDashboard() {
  var ss = mainSs_();
  var today = today_();
  var thisMonth = today.slice(0, 7);
  var y = +today.slice(0, 4);
  var mo = +today.slice(5, 7);
  var lastMonth = mo === 1 ? (y - 1) + '-12' : y + '-' + ('0' + (mo - 1)).slice(-2);
  var ryStart = (mo >= 7 ? y : y - 1) + '-07';
  var acts = readTab_(ss, 'activities').filter(function (a) { return ['approved', 'pending'].indexOf(Core_str(a.status)) >= 0; });
  var rows = clubs_().filter(function (c) { return Core_str(c.status || 'active') === 'active'; }).map(function (c) {
    var mine = acts.filter(function (a) { return Core_str(a.club_id) === Core_str(c.club_id); }).map(function (a) { return Core_isoDate(a.date); }).filter(String).sort();
    var ry = mine.filter(function (d) { return d.slice(0, 7) >= ryStart; });
    var months = ry.map(function (d) { return d.slice(0, 7); }).filter(function (m, i, arr) { return arr.indexOf(m) === i; });
    var thisCount = mine.filter(function (d) { return d.slice(0, 7) === thisMonth; }).length;
    return {
      club_id: c.club_id, club_name: c.club_name, zone: c.zone, member_count: c.member_count,
      last_activity_date: mine.length ? mine[mine.length - 1] : '',
      activities_this_month: thisCount,
      activities_last_month: mine.filter(function (d) { return d.slice(0, 7) === lastMonth; }).length,
      activities_this_rotary_year: ry.length,
      months_posted_this_rotary_year: months.length,
      needs_nudge: thisCount === 0,
    };
  }).sort(function (a, b) { return (a.last_activity_date || '').localeCompare(b.last_activity_date || ''); });
  replaceRows_(ss, 'dashboard', rows);
  var posting = rows.filter(function (r) { return r.activities_this_rotary_year > 0; }).length;
  setSetting_('clubs_posting_this_rotary_year', posting + ' of ' + rows.length + ' clubs (' + Math.round(100 * posting / Math.max(1, rows.length)) + '%)');
}


// ===== Sample.js =====
/**
 * Sample (dummy) data. Every sample row has is_sample = TRUE.
 * "Clear all sample data" is the single clean-up command before real data is loaded.
 */

function loadSampleData(silent) {
  var res = UrlFetchApp.fetch(CONFIG.SAMPLE_URL, { muteHttpExceptions: true });
  if (res.getResponseCode() !== 200) throw new Error('Could not download the sample data (' + res.getResponseCode() + ') from ' + CONFIG.SAMPLE_URL);
  var sample = JSON.parse(res.getContentText());
  var main = mainSs_();
  var ps = privateSs_();
  var counts = [];
  loadTabs_(main, sample.main, counts);
  loadTabs_(ps, sample.private, counts);
  refreshPublicMembers(true);
  refreshDashboard();
  if (silent !== true) {
    try { SpreadsheetApp.getUi().alert('Sample data loaded:\n' + counts.join('\n')); } catch (e) { /* editor */ }
  }
  return counts;
}

function loadTabs_(ss, tabs, counts) {
  Object.keys(tabs).forEach(function (name) {
    var rows = tabs[name];
    var sh = ss.getSheetByName(name);
    if (!sh || !rows.length) return;
    if (name === 'settings') {
      // only fill settings that are still empty; never overwrite form links or real values
      var current = Core_settings(readTab_(ss, 'settings'));
      rows.forEach(function (r) { if (!Core_str(current[r.key]) && Core_str(r.value)) setSetting_(r.key, r.value); });
      return;
    }
    if (name === 'members_public' || name === 'couples_public') return; // rebuilt by refreshPublicMembers
    if (name === 'lists' && readTab_(ss, 'lists').length) return; // keep lists that are already there
    var headers = headers_(ss, name);
    var values = rows.map(function (r) {
      return headers.map(function (h) {
        var v = r[h];
        if (v === true) return true;
        if (v === false) return false;
        return v == null ? '' : v;
      });
    });
    sh.getRange(sh.getLastRow() + 1, 1, values.length, headers.length).setValues(values);
    counts.push(name + ': ' + values.length);
  });
}

function clearSampleData() {
  var ui = SpreadsheetApp.getUi();
  if (ui.alert('Clear all sample data?', 'Every row marked is_sample = TRUE will be deleted from both spreadsheets. Real rows are kept.', ui.ButtonSet.YES_NO) !== ui.Button.YES) return;
  var removed = [];
  [mainSs_(), privateSs_()].forEach(function (ss) {
    ss.getSheets().forEach(function (sh) {
      if (sh.getLastRow() < 2) return;
      var values = sh.getDataRange().getValues();
      var col = values[0].indexOf('is_sample');
      if (col < 0) return;
      var keep = [values[0]];
      var gone = 0;
      for (var r = 1; r < values.length; r++) {
        if (Core_isTrue(values[r][col])) gone++; else keep.push(values[r]);
      }
      if (!gone) return;
      sh.getRange(1, 1, values.length, values[0].length).clearContent();
      sh.getRange(1, 1, keep.length, keep[0].length).setValues(keep);
      removed.push(sh.getName() + ': ' + gone);
    });
  });
  // settings that only made sense for the sample
  setSetting_('inactive_keys', '');
  refreshPublicMembers(true);
  refreshDashboard();
  requestRebuild();
  ui.alert('Sample data cleared.\n' + (removed.join('\n') || 'Nothing to clear.'));
}
