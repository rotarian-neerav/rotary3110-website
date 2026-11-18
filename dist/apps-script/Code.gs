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
  // The private members spreadsheet and the magazine folder (anyone with the link can view) are named in the
  // script's properties, not here, because this code is public: see privateSheetId_ and magazineFolderId_ below.
  // Private folder for member photos the district already holds, files named <member ID>.jpg
  MEMBER_PHOTOS_FOLDER_NAME: 'MemberPhotos',
  // Where "Load sample data" reads the sample from (the public website repository)
  SAMPLE_URL: 'https://raw.githubusercontent.com/rotarian-neerav/rotary3110-website/main/sample/sample-data.json',
  REMINDER_HOURS: 48,
  // a consent form not sent from the member's own email waits this long, so the member can object to the email they get
  CONSENT_HOLD_DAYS: 3,
};

/** Titles of the photo questions that must be added to the forms by hand (Google does not let scripts add them). */
var PHOTO_QUESTIONS = {
  activity: 'Photos (up to 3, each under 1 MB)',
  memberPhoto: 'My photo (one photo of me alone, under 1 MB)',
  couplePhoto: 'Couple photo (optional, under 1 MB)',
};

// Approvals, hides, removals and member changes reach the website at the next of four daily builds (owner, 18 Nov 2026)
var NEXT_UPDATE = 'at the next website update (9 am, 1 pm, 6 pm or 10 pm)';

var PRIVATE_TABS = ['members_master', 'club_history', 'couples', 'consent_requests', 'removal_requests', 'club_change_requests', 'change_log'];

function props_() {
  return PropertiesService.getScriptProperties();
}

/** An id kept in Apps Script → Project Settings → Script properties; a clear message when it is missing. */
function idProperty_(key, what) {
  var id = Core_str(props_().getProperty(key));
  if (!id) throw new Error(what + ' is not set: add the script property ' + key + ' (Apps Script → Project Settings → Script properties)');
  return id;
}

function privateSheetId_() {
  return idProperty_('PRIVATE_SHEET_ID', 'The private members Sheet');
}

function magazineFolderId_() {
  return idProperty_('MAGAZINE_FOLDER_ID', 'The magazine folder');
}

function mainSs_() {
  return SpreadsheetApp.getActiveSpreadsheet() || retry_(function () { return SpreadsheetApp.openById(props_().getProperty('MAIN_SHEET_ID')); });
}

function privateSs_() {
  return retry_(function () { return SpreadsheetApp.openById(privateSheetId_()); });
}

// Google's own words when it is only briefly slow or busy ("Service Drive timed out while accessing document…")
var RETRY_RE = /timed out|try again|temporarily|unavailable|internal error|backend error|service error/i;

/**
 * Runs fn, and runs it again (up to 3 tries, with a short pause) when Google is only briefly slow. Used only for
 * steps that are safe to repeat: opening a Sheet, reading, writing a cell, giving or removing access. Never for
 * adding a row or sending an email, which a slow answer may already have done.
 */
function retry_(fn) {
  for (var i = 1; ; i++) {
    try {
      return fn();
    } catch (e) {
      if (i >= 3 || !RETRY_RE.test(String(e && e.message))) throw e;
      Utilities.sleep(2000 * i);
    }
  }
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
  var values = retry_(function () { return sh.getDataRange().getValues(); });
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
  return retry_(function () { return sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0]; });
}

/**
 * A value as it must be written. Google reads text a script writes as if someone typed it, so an answer from a public
 * form starting with = (or + - @) would become a formula, able to read other cells and send them out. The leading
 * apostrophe tells Sheets it is text; it is not stored, and reading the cell gives the text exactly as sent.
 */
function cellValue_(v) {
  return typeof v === 'string' && /^[=+\-@]/.test(v) ? "'" + v : v;
}

/** Writes some fields of one row (by sheet row number), leaving the other cells alone. */
function updateRow_(ss, name, rowNumber, fields) {
  var sh = ss.getSheetByName(name);
  var headers = headers_(ss, name);
  Object.keys(fields).forEach(function (key) {
    var col = headers.indexOf(key);
    if (col < 0) throw new Error('Column "' + key + '" not found in ' + name);
    retry_(function () { sh.getRange(rowNumber, col + 1).setValue(cellValue_(fields[key])); });
  });
}

/** Appends one row given as an object; missing columns stay blank. */
function appendRow_(ss, name, obj) {
  var sh = ss.getSheetByName(name);
  var headers = headers_(ss, name);
  sh.appendRow(headers.map(function (h) { return obj[h] == null ? '' : cellValue_(obj[h]); }));
  return sh.getLastRow();
}

/** Replaces every data row of a tab (keeps the header row). */
function replaceRows_(ss, name, rows) {
  var sh = ss.getSheetByName(name);
  var headers = headers_(ss, name);
  if (sh.getLastRow() > 1) sh.getRange(2, 1, sh.getLastRow() - 1, sh.getMaxColumns()).clearContent();
  if (!rows.length) return;
  var values = rows.map(function (o) { return headers.map(function (h) { return o[h] == null ? '' : cellValue_(o[h]); }); });
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
    'meeting_day_place', 'website', 'facebook', 'instagram', 'youtube', 'x', 'linkedin', 'profile_updated_at', 'is_sample',
    'permanent_projects', 'regular_services',
    // added in Release A (17 October 2026); new columns always go at the end
    'meeting_day', 'activity_form_link',
    // added in Release 1 (18 November 2026): a new club is not nudged in its first 60 days; a closed club may name
    // the club its members moved to
    'charter_date', 'merged_into'],
  // ended_on (Release 1): a moderator ended the role on the desk; the row stays, the website no longer shows it
  officers: ['rotary_year', 'club_id', 'member_id', 'name', 'role', 'contact_ok', 'contact_link', 'is_sample', 'ended_on'],
  functionaries: ['rotary_year', 'page', 'section', 'committee', 'member_id', 'name', 'role', 'zone', 'club_id', 'term',
    'sort_order', 'contact_ok', 'contact_link', 'is_sample', 'ag_clubs', 'ended_on'],
  activities: ['id', 'submitted_at', 'submitter_email', 'submitter_name', 'submitter_role', 'submitter_mobile', 'club_id',
    'club_name', 'title', 'date', 'theme', 'description', 'photo_files', 'post_link', 'people_helped', 'amount_spent', 'partner_clubs',
    'photo_consent', 'status', 'source', 'approved_by', 'approved_at', 'moderator_note', 'story_of_month', 'event_id',
    'notified', 'is_sample', 'campaign_id', 'campaign_count', 'bulletin_exclude',
    'avenue', 'video_link', 'press_paper', 'press_date', 'press_link',
    // added 17 November 2026: the sender marked it as district work (the moderator checks it)
    'district_level',
    // added 17 November 2026: one photo before and one after the work (shown side by side only when both are there)
    'before_photo', 'after_photo',
    // added in Release 1 (18 November 2026): a published activity a moderator took off the website (status hidden)
    'hidden_by', 'hidden_at'],
  events: ['id', 'submitted_at', 'submitter_email', 'submitter_name', 'submitter_role', 'submitter_mobile', 'title',
    'event_type', 'start_date', 'start_time', 'end_date', 'venue', 'city', 'organiser', 'description', 'map_link',
    'details_link', 'photo_files', 'status', 'source', 'approved_by', 'approved_at', 'moderator_note', 'report_activity_id', 'notified',
    'is_sample', 'registration_close_date', 'fee', 'registration_status', 'bulletin_exclude', 'open_to_all'],
  club_profile_requests: ['id', 'submitted_at', 'submitter_email', 'submitter_name', 'submitter_role', 'submitter_mobile',
    'club_id', 'club_name', 'website', 'facebook', 'instagram', 'youtube', 'x', 'linkedin', 'meeting_day_place', 'status',
    'approved_by', 'approved_at', 'moderator_note', 'is_sample', 'permanent_projects', 'regular_services', 'meeting_day'],
  campaigns: ['campaign_id', 'rotary_year', 'name', 'slug', 'unit', 'start_date', 'end_date', 'target', 'description', 'chair',
    'chair_member_id', 'sort_order', 'is_sample'],
  magazines: ['issue_month', 'title', 'pdf_file', 'pdf_url', 'cover_image', 'is_sample'],
  messages: ['id', 'name', 'position', 'photo', 'message', 'date', 'featured', 'is_sample'],
  spotlights: ['month', 'public_key', 'member_name', 'headline', 'story', 'is_sample'],
  members_public: ['public_key', 'member_id', 'name', 'club_id', 'directory_ok', 'profession', 'area', 'description',
    'website', 'contact_ok', 'contact_link', 'photo_ok', 'photo_file', 'birthday_ok', 'birthday', 'spotlight_ok', 'is_sample'],
  couples_public: ['couple_key', 'person_a_key', 'person_a_name', 'person_a_club_id', 'person_b_key', 'person_b_name',
    'person_b_club_id', 'anniversary', 'both_consented', 'couple_photo_file', 'is_sample'],
  // lasting facilities the public can use (blood banks, eye care, dialysis…), sent through the public service form
  public_services: ['id', 'submitted_at', 'submitter_email', 'submitter_name', 'submitter_role', 'submitter_mobile', 'club_id',
    'club_name', 'name', 'service_type', 'timings', 'phone', 'address', 'city', 'map_link', 'about', 'status', 'approved_by',
    'approved_at', 'moderator_note', 'notified', 'is_sample'],
  // Rotary Means Business (17 November 2026): a member's own business and the topics they can speak on, sent through
  // the business form. member_id and member_name are filled from the private members list; only an approved row of
  // an active member is published, and never the member ID, the sender's mobile or email
  businesses: ['id', 'submitted_at', 'submitter_email', 'submitter_name', 'submitter_mobile', 'club_id', 'club_name', 'member_id',
    'member_name', 'business_name', 'trade', 'city', 'about', 'offer', 'website', 'whatsapp', 'photo_files', 'speaker_topics', 'status',
    'approved_by', 'approved_at', 'moderator_note', 'notified', 'is_sample'],
  // the About page: the RI President and the District Governor (role, year, name, theme, short profile, photo)
  profiles: ['role', 'rotary_year', 'name', 'theme', 'profile', 'photo', 'link', 'sort_order', 'is_sample'],
  // every Past District Governor, including those no longer with us (member_id only links a card; never shown)
  past_governors: ['rotary_year', 'name', 'club', 'member_id', 'is_sample'],
  dashboard: ['club_id', 'club_name', 'zone', 'member_count', 'last_activity_date', 'activities_this_month',
    'activities_last_month', 'activities_this_rotary_year', 'months_posted_this_rotary_year', 'needs_nudge'],
  role_checks: ['checked_at', 'tab', 'row', 'rotary_year', 'name', 'member_id', 'problem'],
  // who moderates, by type: one row per person and type; edit a row when someone changes (never sent to the website)
  // zone (Release 1): a Content moderator's zones (Agra, Bareilly, Kanpur); blank means every zone
  moderators: ['type', 'name', 'email', 'active', 'from_date', 'notes', 'sheet_access', 'zone'],
  // what moderators did on the moderation desk (filled in by the script; never sent to the website)
  moderator_log: ['at', 'moderator', 'action', 'tab', 'item', 'details'],
};

var SCHEMA_PRIVATE = {
  members_master: ['member_id', 'name', 'club_id', 'is_rotarian', 'status', 'mobile', 'email', 'dob', 'marriage_date',
    'spouse_id', 'directory_ok', 'contact_ok', 'photo_ok', 'birthday_ok', 'anniversary_ok', 'profession', 'area',
    'description', 'website', 'spotlight_ok', 'photo_file', 'photo_approved', 'listing_approved', 'listing_approved_by',
    'listing_approved_at', 'public_key', 'consent_source', 'consent_updated_at', 'notes', 'is_sample',
    // added 29 October 2026 with the real member list; private, never sent to the website
    'gender',
    // added 16 November 2026: when this year's July check email went to the member
    'member_check_sent_at'],
  club_history: ['member_id', 'club_id', 'from_date', 'to_date', 'reason', 'is_sample'],
  couples: ['couple_id', 'person_a_id', 'person_b_id', 'anniversary', 'a_consent', 'b_consent', 'couple_photo_ok_a',
    'couple_photo_ok_b', 'couple_photo_file', 'couple_photo_approved', 'status', 'notes', 'is_sample'],
  consent_requests: ['id', 'submitted_at', 'submitter_email', 'filled_by', 'club_id', 'name', 'member_id', 'mobile',
    'directory_ok', 'profession', 'area', 'description', 'website', 'spotlight_ok', 'contact_ok', 'photo_ok', 'photo_file',
    'birthday_ok', 'birthday', 'anniversary_ok', 'spouse_is_rotarian', 'spouse_name', 'spouse_club_id', 'spouse_member_id',
    'spouse_agrees', 'anniversary', 'couple_photo_file', 'couple_photo_spouse_agrees', 'declaration', 'status',
    'matched_member_id', 'approved_by', 'approved_at', 'moderator_note', 'is_sample',
    // added 1 November 2026: whether the member was told at their email on file
    'member_notice'],
  // messages from the website's contact form; the reply details stay here and are never published
  contact_messages: ['id', 'submitted_at', 'name', 'reply_to', 'topic', 'city', 'message', 'status', 'forwarded_to', 'note', 'is_sample', 'replies'],
  removal_requests: ['id', 'submitted_at', 'submitter_email', 'club_id', 'name', 'member_id', 'mobile', 'remove_items',
    'reason', 'status', 'matched_member_id', 'approved_by', 'approved_at', 'moderator_note', 'is_sample',
    // added in Release 2 (18 November 2026): the My details form asks who is filling it
    'filled_by'],
  // club changes sent by anyone through the club changes form (17 November 2026): a member joined, left, moved or passed
  // away, or a club or district role. Nothing changes until a Members moderator approves; change is one of
  // joined, left, moved, deceased, club_role, district_role
  club_change_requests: ['id', 'submitted_at', 'submitter_email', 'club_id', 'change', 'member_id', 'name', 'date', 'new_club_id',
    'rotary_year', 'role', 'section', 'committee', 'note', 'status', 'approved_by', 'approved_at', 'moderator_note', 'is_sample',
    // added in Release 2 (18 November 2026): a new member's own mobile and email, for the members list only
    'mobile', 'email'],
  // every change a moderator makes on the desk to a member, a role, a club or a moderator (Release 1, 18 November 2026):
  // one row per field, rows of one save share an id; Undo puts old_value back while the field still holds new_value
  change_log: ['id', 'at', 'moderator', 'action', 'tab', 'key', 'field', 'old_value', 'new_value', 'reason', 'undone_at', 'undone_by'],
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
// Trades for Rotary Means Business listings (the business form); Other last
var CORE_TRADES = ['Accountant / CA', 'Advocate / legal', 'Agriculture / dairy', 'Architect / interior design', 'Automobile / dealership',
  'Bank / finance / insurance', 'Builder / real estate', 'Chemist / pharmacy', 'Clothing / textiles', 'Coaching / tuition',
  'Computers / IT / software', 'Construction material / hardware', 'Consultant', 'Dentist', 'Doctor / clinic', 'Electricals / electronics',
  'Engineering / manufacturing', 'Event management', 'Food / sweets / bakery', 'Furniture', 'Hospital / nursing home', 'Hotel / restaurant',
  'Jewellery', 'Laboratory / diagnostics', 'Media / photography', 'Printing / advertising', 'School / college', 'Shop / retail',
  'Tours / travel', 'Transport / logistics', 'Wholesale / trading', 'Other'];
var CORE_WEEKDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
// The contact form: at most this many messages are emailed on, per day, unless the setting says otherwise
var CORE_CONTACT_DAILY_LIMIT = 20;
// A club is quiet with no activity (approved or waiting) dated in this many days: the same rule for the desk's
// Quiet clubs, the dashboard's needs_nudge and the monthly email
var CORE_QUIET_DAYS = 30;
// A club chartered in the last this many days is not counted as quiet yet (Release 1, 18 Nov 2026)
var CORE_NEW_CLUB_DAYS = 60;
// The club roles a moderator may add on the desk (Executive Secretary added 18 Nov 2026)
var CORE_CLUB_ROLES = ['President', 'Secretary', 'Executive Secretary'];

// Types of moderator (the moderators tab). What each receives is in Core_moderatorEmails' callers. A row with
// sheet_access TRUE also edits the main Sheet, and Members and Administrator rows the private members Sheet too.
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

/** A practice-round item (ID PRAC-…): seen only on the moderation desk, never published or counted. */
function Core_isPractice(r) {
  return /^PRAC-/i.test(Core_str(r && r.id));
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
    if (!Core_moderatorActive(r) || !Core_isTrue(r.sheet_access)) return; // the desk needs no Sheet access
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
  return { content: has('Content'), members: has('Members'), clubs: has('Club engagement'), office: has('District office'),
    admin: (types || []).indexOf('Administrator') >= 0 };
}

/** The zones (Agra, Bareilly, Kanpur) one email's active Content rows name; empty means every zone. */
function Core_moderatorZones(rows, email) {
  var e = Core_str(email).toLowerCase();
  var out = [];
  (rows || []).forEach(function (r) {
    if (Core_str(r.email).toLowerCase() !== e || Core_str(r.type) !== 'Content' || !Core_moderatorActive(r)) return;
    var zones = Core_list(r.zone);
    if (!zones.length) out.push('*');
    zones.forEach(function (z) { if (out.indexOf(z) < 0) out.push(z); });
  });
  return out.indexOf('*') >= 0 ? [] : out;
}

/**
 * Why a waiting activity needs a moderator's full look; none means "clean", ready for Approve all clean (Release 1).
 * The checks made when it arrived (its notes) count, and so do a District mark, a campaign, an unknown club and
 * photos without the consent tick, which always need a person.
 */
function Core_activityChecks(r) {
  var out = Core_str(r.moderator_note).split(/;\s*/).filter(String);
  var add = function (why) { if (out.indexOf(why) < 0) out.push(why); };
  if (Core_isTrue(r.district_level)) add('Marked as district level');
  if (Core_str(r.campaign_id) || Core_str(r.campaign_count) !== '') add('Campaign count: it goes into the totals');
  if (!Core_str(r.club_id)) add('Club not recognised');
  if ((Core_str(r.photo_files) || Core_str(r.before_photo) || Core_str(r.after_photo)) && !Core_isTrue(r.photo_consent)) add('Photo consent not ticked');
  if (!Core_str(r.photo_files) && !Core_url(r.post_link)) add('No photo or link');
  return out;
}

/** Active Rotarians per club in the private members list: the club's member count (sample rows left out). */
function Core_memberCounts(master) {
  var out = {};
  (master || []).forEach(function (m) {
    var id = Core_str(m.club_id);
    if (!id || Core_isTrue(m.is_sample) || Core_str(m.status || 'active').toLowerCase() !== 'active') return;
    if (m.is_rotarian === false || Core_str(m.is_rotarian).toUpperCase() === 'FALSE') return;
    out[id] = (out[id] || 0) + 1;
  });
  return out;
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
    if ((s !== 'approved' && s !== 'pending') || !d || d > today || Core_isPractice(a)) return;
    var id = Core_str(a.club_id);
    if (!last[id] || d > last[id]) last[id] = d;
  });
  var newSince = Core_addDays(today, -CORE_NEW_CLUB_DAYS);
  return (clubs || []).filter(function (c) {
    var chartered = Core_isoDate(c.charter_date);
    if (chartered && chartered > newSince) return false; // a new club gets time to settle before it is nudged
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

/** How many rows of the given tabs are marked is_sample (settings and lists have no such rows). */
function Core_sampleRows(tabs) {
  var n = 0;
  Object.keys(tabs || {}).forEach(function (k) {
    if (Array.isArray(tabs[k])) tabs[k].forEach(function (r) { if (r && Core_isTrue(r.is_sample)) n++; });
  });
  return n;
}

/** The Rotary year after the given one: "2024-25" -> "2025-26", "2099-00" -> "2100-01". Empty if not a Rotary year. */
function Core_nextRotaryYear(year) {
  var m = /^(\d{4})-(\d{2})$/.exec(Core_str(year));
  if (!m) return '';
  var start = Number(m[1]) + 1;
  return start + '-' + String(start + 1).slice(-2);
}

/**
 * What the website shows about one members_master row once its listing is approved: the directory card, the
 * WhatsApp button, the photo, the birthday greeting. Sample members never get a real WhatsApp link (the site shows
 * their buttons as switched off), so a sample row needs no mobile.
 */
function Core_memberShows(m) {
  var directory = Core_isTrue(m.directory_ok);
  return {
    directory: directory,
    contact: directory && Core_isTrue(m.contact_ok) && (Core_isTrue(m.is_sample) || !!Core_mobile(m.mobile)),
    photo: Core_isTrue(m.photo_ok) && Core_isTrue(m.photo_approved) && !!Core_str(m.photo_file),
    birthday: Core_isTrue(m.birthday_ok) && !!Core_dayMonth(m.dob),
  };
}

/* The yearly check with listed members (July and August): "this is what the website shows about you". */
var CORE_MEMBER_CHECK_PER_DAY = 80; // Google allows about 100 emails a day; the rest is kept for moderators and replies

/**
 * Listed members who should get this year's check email, by member ID. Only in July and August (a late start
 * catches up in August), only active Rotarians whose listing shows something and who have an email, and not those
 * who already had it this year or gave or renewed their consent since 1 July. anyTime: ignore the season and what
 * was sent (for the owner's sample email).
 */
function Core_memberCheckDue(master, today, anyTime) {
  var month = Core_str(today).slice(5, 7);
  if (!anyTime && month !== '07' && month !== '08') return [];
  var july = Core_str(today).slice(0, 4) + '-07-01';
  return (master || []).filter(function (m) {
    if (!Core_isTrue(m.is_rotarian) || Core_str(m.status || 'active').toLowerCase() !== 'active') return false;
    if (!Core_isTrue(m.listing_approved) || Core_isTrue(m.is_sample)) return false;
    if (!CORE_EMAIL_RE.test(Core_str(m.email))) return false;
    var s = Core_memberShows(m);
    if (!s.directory && !s.photo && !s.birthday) return false;
    if (anyTime) return true;
    return [m.member_check_sent_at, m.consent_updated_at, m.listing_approved_at].every(function (v) {
      var d = Core_isoDate(v);
      return !d || d < july;
    });
  }).sort(function (a, b) { return Core_str(a.member_id).localeCompare(Core_str(b.member_id)); });
}

/** The check email for one member: { subject, body }. forms: { consent, removal } form addresses. */
function Core_memberCheckEmail(m, clubName, siteUrl, forms) {
  var s = Core_memberShows(m);
  var yes = function (v) { return v ? 'yes' : 'no'; };
  var birthday = function (mmdd) { // "03-12" -> "12 March"
    var months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    return Number(mmdd.slice(3, 5)) + ' ' + months[Number(mmdd.slice(0, 2)) - 1];
  };
  var lines = ['• Club: ' + (Core_str(clubName) || Core_str(m.club_id))];
  if (s.directory) {
    lines.push('• In the member directory: yes');
    [['Profession', m.profession], ['Area', m.area], ['About you', m.description], ['Website', m.website]].forEach(function (f) {
      if (Core_str(f[1])) lines.push('    ' + f[0] + ': ' + Core_str(f[1]));
    });
  } else {
    lines.push('• In the member directory: no');
  }
  lines.push('• Your photo: ' + yes(s.photo));
  lines.push('• A WhatsApp button, so people can message you: ' + yes(s.contact));
  lines.push('• A birthday greeting on the Celebrations page: ' + (s.birthday ? 'yes (' + birthday(Core_dayMonth(m.dob)) + ', without the year)' : 'no'));
  var site = Core_str(siteUrl).replace(/\/?$/, '/');
  var body = 'Dear ' + Core_str(m.name) + ',\n\n' +
    'Once a year, in July, we check with every member listed on the Rotary District 3110 website (' + site + ') ' +
    'that it still shows what you want. This is what it shows about you:\n\n' + lines.join('\n') + '\n\n' +
    'Nothing to do if this is right.\n\n' +
    'To change any of it, fill in the member consent form again' + (forms && forms.consent ? ':\n' + forms.consent : ' (linked from the website\'s Privacy page).') + '\n\n' +
    'To remove any of it, or your whole listing' + (forms && forms.removal ? ':\n' + forms.removal : ', use the removal form (linked from the website\'s Privacy page).') + '\n\n' +
    'Your mobile number and email address are never shown on the website.\n\nRotary District 3110';
  return { subject: 'Your listing on the Rotary District 3110 website: still right?', body: body };
}

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
    var shows = Core_memberShows(m);
    var directory = shows.directory;
    var sample = Core_isTrue(m.is_sample);
    var contact = shows.contact;
    var photo = shows.photo;
    var birthday = shows.birthday;
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
    var link = Core_str(r.contact_link);
    // only a WhatsApp link to an Indian mobile: anything else typed in the Sheet is left out, not published
    if (link && !CORE_WA_LINK_RE.test(link)) {
      skippedItems.push('role ' + Core_str(r.role) + ' ' + Core_str(r.club_id) + ' contact link');
      link = '';
    }
    var contact = !inactive && Core_isTrue(r.contact_ok) && link ? link : '';
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
  // A role a moderator ended on the desk (ended_on) is no longer shown; its row stays in the Sheet
  function current(r) {
    return Core_str(r.name) && !Core_str(r.ended_on) && !(inactiveIds[Core_str(r.member_id)] && Core_str(r.rotary_year) === rotaryYear);
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
    return Core_str(a.status).toLowerCase() === 'approved' && !Core_isPractice(a);
  }), duplicates).map(function (a) {
    var avenue = '';
    CORE_AVENUES.forEach(function (v) { if (v.toLowerCase() === Core_str(a.avenue).toLowerCase()) avenue = v; });
    var paper = Core_safeText(a.press_paper, 'activity ' + Core_str(a.id) + ' press', skippedItems);
    var before = Core_photoRefs(a.before_photo)[0] || '';
    var after = Core_photoRefs(a.after_photo)[0] || '';
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
      // a place before and after the club's work (a school toilet, a classroom), side by side: both or neither
      before_after: before && after && before !== after ? { before: before, after: after } : null,
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
      // the sender marked it as district work (a grant inauguration, a district seminar); the moderator checks it
      district_level: Core_isTrue(a.district_level),
    };
  }).filter(function (a) {
    var ok = a.id && a.title && a.date && clubIds[a.club_id] && (a.photos.length || a.post_link);
    if (!ok) skipped.push(a.id || '(no id)');
    return ok;
  });

  var activityIds = {};
  activities.forEach(function (a) { activityIds[a.id] = a; });

  var events = Core_uniqueRows((tabs.events || []).filter(function (e) {
    return Core_str(e.status).toLowerCase() === 'approved' && !Core_isPractice(e);
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
    return Core_str(s.status).toLowerCase() === 'approved' && !Core_isPractice(s);
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

  // Rotary Means Business: members' own businesses and the topics they can speak on. Members only: a row shows
  // only while its member is active (deceased or departed members drop out), with the WhatsApp number as a button.
  var businesses = Core_uniqueRows((tabs.businesses || []).filter(function (b) {
    return Core_str(b.status).toLowerCase() === 'approved' && !Core_isPractice(b);
  }), duplicates).map(function (b) {
    var where = 'business ' + Core_str(b.id);
    var id = Core_str(b.member_id);
    var trade = 'Other';
    CORE_TRADES.forEach(function (t) { if (t.toLowerCase() === Core_str(b.trade).toLowerCase()) trade = t; });
    var mobile = Core_mobile(b.whatsapp);
    if (Core_str(b.whatsapp) && !mobile) skippedItems.push(where + ' WhatsApp number');
    var sample = Core_isTrue(b.is_sample);
    var name = Core_safeText(b.business_name, where + ' name', skippedItems);
    return {
      id: Core_str(b.id),
      _member: id,
      club_id: Core_str(b.club_id),
      owner: Core_safeText(b.member_name, where + ' owner', skippedItems),
      person_ref: id && !inactiveIds[id] ? personRef(id) : '',
      name: name,
      trade: name ? trade : '',
      city: name ? Core_str(b.city) : '',
      about: name ? Core_safeText(b.about, where + ' about', skippedItems) : '',
      offer: name ? Core_safeText(b.offer, where + ' offer', skippedItems) : '',
      website: name ? Core_url(b.website) : '',
      contact_ok: !!(name && mobile),
      // sample rows never get a working WhatsApp link
      contact_link: name && mobile && !sample ? 'https://wa.me/' + mobile : '',
      logo: name ? Core_photoRefs(b.photo_files)[0] || '' : '',
      speaker_topics: Core_safeText(b.speaker_topics, where + ' speaker topics', skippedItems),
      sample: sample,
    };
  }).filter(function (b) {
    var ok = b.id && b._member && b.person_ref && b.owner && clubIds[b.club_id] && (b.name || b.speaker_topics);
    delete b._member; // the member ID never leaves this function
    return ok;
  });

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
      business: Core_url(settings.form_business_url),
    },
    lists: {
      themes: CORE_THEMES.slice(),
      avenues: CORE_AVENUES.slice(),
      service_types: CORE_SERVICE_TYPES.slice(),
      trades: CORE_TRADES.slice(),
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
    businesses: businesses,
    profiles: profiles,
    past_governors: pastGovernors,
    skipped_activities: skipped,
    skipped_items: skippedItems,
    duplicate_ids: duplicates,
    // rows marked is_sample that reached the data link: a public build stops if there are any (Release B, 16 Nov)
    sample_rows: Core_sampleRows(tabs),
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

// Mobiles as people write them (98765 43210, 987-654-3210, 9876.543.210, with +91 or a leading 0) and landlines
// with an area code (0522 2234567). Digits inside a word are not phone numbers.
var CORE_PHONE_RE = /(?:^|[^\w])(?:(?:\+?91[\s.-]?|0)?(?:[6-9]\d{4}[\s.-]?\d{5}|[6-9]\d{2}[\s.-]?\d{3}[\s.-]?\d{4}|[6-9]\d{3}[\s.-]?\d{3}[\s.-]?\d{3})|0\d{2,4}[\s.-]?\d{6,8})(?!\w)/;
var CORE_EMAIL_RE = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/;
var CORE_WA_LINK_RE = /^https:\/\/wa\.me\/91[6-9]\d{9}$/;
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
    if (m.contact_link && !CORE_WA_LINK_RE.test(m.contact_link)) err(w, 'contact link is not a WhatsApp link');
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
    if (p.contact_link && !CORE_WA_LINK_RE.test(p.contact_link)) err('roles[' + i + '] ' + p.name, 'contact link is not a WhatsApp link');
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
  // A business's WhatsApp button: only a WhatsApp link, and only with the member's own business details
  (data.businesses || []).forEach(function (b, i) {
    var w = 'businesses[' + i + '] ' + (b.name || b.owner || '');
    if ('member_id' in b) err(w, 'member ID must never be published');
    if (b.contact_link && !(b.contact_ok && b.name)) err(w, 'contact link without a business');
    if (b.contact_link && !CORE_WA_LINK_RE.test(b.contact_link)) err(w, 'contact link is not a WhatsApp link');
    if (b.person_ref && !/^P[0-9a-f]{12}$/.test(b.person_ref)) err(w, 'person reference is not a scrambled reference');
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
  (scan.businesses || []).forEach(function (b) { if (b.contact_ok) delete b.contact_link; });
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
  // a typed mobile number no longer finds anyone: anyone can type another member's number (owner, 18 Nov 2026)
  // Release 2: then by email: the sender's own Google account, unless a club secretary filled it in for the member,
  // and only when the name on the form shares a word with that member's name (someone writing for another member
  // from their own account is not mistaken for them)
  var email = Core_str(request.email || (/secretary/i.test(Core_str(request.filled_by)) ? '' : request.submitter_email)).toLowerCase();
  if (/@/.test(email)) {
    var words = function (n) { return Core_plainName(n).split(' ').filter(function (w) { return w.length > 2; }); };
    var said = words(request.name);
    for (i = 0; i < master.length; i++) {
      if (Core_str(master[i].email).toLowerCase() !== email) continue;
      if (!said.length || words(master[i].name).some(function (w) { return said.indexOf(w) >= 0; })) return i;
    }
  }
  return -1;
}

/**
 * Who sent a consent form, judged by the sender's Google account: 'member' when it is the member's own email on file,
 * 'officer' when it is the email on file of one of the club's office bearers (officers: this year's rows), otherwise
 * 'other'. Also the warnings for the moderator, and any removal request the member sent after this form.
 */
function Core_consentSender(request, master, officers, removals) {
  var lower = function (v) { return Core_str(v).toLowerCase(); };
  var i = Core_matchMember(request, master);
  var member = i >= 0 ? master[i] : null;
  var sender = lower(request.submitter_email);
  var memberEmail = member ? lower(member.email) : '';
  var clubs = [Core_str(request.club_id), member ? Core_str(member.club_id) : ''].filter(String);
  var byId = {};
  master.forEach(function (m) { byId[Core_str(m.member_id)] = m; });
  var officer = !!sender && (officers || []).some(function (o) {
    var m = byId[Core_str(o.member_id)];
    return m && clubs.indexOf(Core_str(o.club_id)) >= 0 && lower(m.email) === sender;
  });
  var who = sender && sender === memberEmail ? 'member' : officer ? 'officer' : 'other';
  var saysSecretary = /secretary/i.test(Core_str(request.filled_by));
  var warnings = [];
  if (!saysSecretary && who !== 'member' && memberEmail) {
    warnings.push("Says the member filled it, but it was sent from " + (sender || 'no Google account') + ", not the member's email on file");
  }
  if (saysSecretary && who === 'other') warnings.push('Says the club secretary filled it, but ' + (sender || 'the sender') + ' is not an office bearer of the club on file');
  if (member && Core_str(request.member_id) && Core_str(request.member_id) === Core_str(member.member_id)) {
    var words = function (n) { return Core_plainName(n).split(' ').filter(function (w) { return w.length > 2; }); };
    var known = words(member.name);
    if (!words(request.name).some(function (w) { return known.indexOf(w) >= 0; })) {
      warnings.push('Matched by member ID, but the name on the form differs from the member list (' + Core_str(member.name) + ')');
    }
  }
  if (who !== 'member' && !memberEmail) {
    warnings.push((member ? 'No email on file for the member' : 'Not in the member list') + ', so nobody could tell them: confirm with the member or their club first');
  }
  var removal = '';
  if (member) {
    var sent = new Date(request.submitted_at).getTime() || 0;
    (removals || []).forEach(function (r) {
      if (Core_str(r.status).toLowerCase() === 'rejected' || removal) return;
      if (Core_matchMember(r, master) === i && (new Date(r.submitted_at).getTime() || 0) >= sent) removal = Core_str(r.id) || 'a removal request';
    });
  }
  if (removal) warnings.unshift('The member asked to remove their details after this form was sent (' + removal + '): reject this form');
  return { who: who, memberEmail: memberEmail, memberName: member ? Core_str(member.name) : '', warnings: warnings, removal: removal };
}

/** An error as callers of the web app see it: the first line, without long IDs (Drive files, Sheets), at most 300 characters. */
function Core_safeError(err) {
  return String((err && err.message) || err).split(/\r?\n/)[0].replace(/[A-Za-z0-9_-]{25,}/g, '…').slice(0, 300);
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
    if (Core_str(r.status).toLowerCase() !== 'pending' || Core_isPractice(r)) return false;
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
  (officers || []).forEach(function (r) { if (!Core_str(r.ended_on)) rows.push({ tab: 'officers', r: r }); });
  (functionaries || []).forEach(function (r) { if (!Core_str(r.ended_on)) rows.push({ tab: 'functionaries', r: r }); });

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
    Core_memberShows: Core_memberShows, Core_sampleRows: Core_sampleRows, Core_nextRotaryYear: Core_nextRotaryYear, Core_memberCheckDue: Core_memberCheckDue, Core_memberCheckEmail: Core_memberCheckEmail,
    Core_buildPublicData: Core_buildPublicData, Core_validatePublic: Core_validatePublic,
    Core_matchMember: Core_matchMember, Core_consentSender: Core_consentSender, Core_safeError: Core_safeError, Core_findDuplicate: Core_findDuplicate, Core_overdue: Core_overdue,
    Core_hash: Core_hash, Core_time: Core_time, CORE_THEMES: CORE_THEMES, CORE_EVENT_TYPES: CORE_EVENT_TYPES,
    Core_checkRoles: Core_checkRoles, Core_plainName: Core_plainName, Core_unsafeText: Core_unsafeText,
    Core_uniqueRows: Core_uniqueRows, Core_cleanLines: Core_cleanLines, Core_lineParts: Core_lineParts, Core_isDistrictEvent: Core_isDistrictEvent,
    Core_registrationLine: Core_registrationLine, Core_campaignLabel: Core_campaignLabel, Core_campaignIdForLabel: Core_campaignIdForLabel,
    Core_openCampaigns: Core_openCampaigns, Core_campaignTotals: Core_campaignTotals, Core_inCampaign: Core_inCampaign,
    Core_bulletin: Core_bulletin, Core_bulletinMessage: Core_bulletinMessage, Core_sundayOf: Core_sundayOf, Core_addDays: Core_addDays,
    Core_dateLabel: Core_dateLabel, Core_rotaryYearOf: Core_rotaryYearOf, Core_formatNumber: Core_formatNumber,
    CORE_REG_STATUSES: CORE_REG_STATUSES, CORE_NO_CAMPAIGN: CORE_NO_CAMPAIGN,
    Core_meetingDay: Core_meetingDay, Core_servicePhone: Core_servicePhone, Core_videoLink: Core_videoLink, Core_clubRef: Core_clubRef,
    Core_contactCheck: Core_contactCheck, CORE_QUIET_DAYS: CORE_QUIET_DAYS,
    CORE_AVENUES: CORE_AVENUES, CORE_SERVICE_TYPES: CORE_SERVICE_TYPES, CORE_TRADES: CORE_TRADES, CORE_WEEKDAYS: CORE_WEEKDAYS,
    CORE_MODERATOR_TYPES: CORE_MODERATOR_TYPES, Core_moderatorEmails: Core_moderatorEmails, Core_moderatorAccess: Core_moderatorAccess,
    Core_moderatorTypesOf: Core_moderatorTypesOf, Core_deskViews: Core_deskViews, Core_quietClubs: Core_quietClubs, Core_looksLikeUrl: Core_looksLikeUrl, Core_isPractice: Core_isPractice,
    Core_moderatorZones: Core_moderatorZones, Core_activityChecks: Core_activityChecks, Core_memberCounts: Core_memberCounts,
    CORE_NEW_CLUB_DAYS: CORE_NEW_CLUB_DAYS, CORE_CLUB_ROLES: CORE_CLUB_ROLES,
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
  tidyBlankRows_(main, report);
  tidyBlankRows_(priv, report);
  ensureSettings_(report);
  ensureModerators_(report);
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
  ensureLists_(report);
  createForms_(report);
  addLaterQuestions_(report);
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

/**
 * Administrator → Upgrade Sheet: brings a Sheet set up earlier up to date with the current script (new tabs and
 * columns, settings, dropdowns, form questions and timed jobs), without touching existing data or recreating the
 * forms. Safe to run more than once; a new install gets the same through setup().
 */
function upgradeSheet() {
  var started = Date.now();
  var main = mainSs_();
  var report = [];
  ensureTabs_(main, SCHEMA_MAIN, report);
  ensureTabs_(privateSs_(), SCHEMA_PRIVATE, report);
  ensureSettings_(report);
  ensureModerators_(report);
  addValidation_(main, privateSs_());
  ensureLists_(report);
  createForms_(report); // new forms only; existing forms are kept
  addLaterQuestions_(report);
  installTriggers_(report);
  // Apps Script stops a run after 6 minutes (18 Nov 2026: the first Release 1 upgrade did); making new forms is slow,
  // so the form lists wait for the next run, or for the menu, when time is short
  if (Date.now() - started < 3 * 60000) updateFormLists(true);
  else report.push('Form lists not refreshed this time (the upgrade took long): run Rotary → Update form lists');
  var msg = 'Upgrade finished.\n\n' + (report.join('\n') || 'Everything was already up to date.');
  Logger.log(msg);
  try { SpreadsheetApp.getUi().alert(msg); } catch (e) { /* run from the editor */ }
  return report;
}

/** Values for the dropdowns kept in the lists tab. */
function ensureLists_(report) {
  var ss = mainSs_();
  var have = readTab_(ss, 'lists').filter(function (r) { return r.list === 'registration_status'; }).map(function (r) { return Core_str(r.value); });
  CORE_REG_STATUSES.forEach(function (v) {
    if (have.indexOf(v) < 0) appendRow_(ss, 'lists', { list: 'registration_status', value: v });
  });
  if (have.length < CORE_REG_STATUSES.length) report.push('Added the registration status list');
}

var TEXT_COLUMNS = ['from_date', 'member_id', 'chair_member_id', 'mobile', 'submitter_mobile', 'start_time', 'birthday', 'anniversary', 'value', 'person_a_id',
  'person_b_id', 'spouse_id', 'spouse_member_id', 'matched_member_id', 'public_key', 'club_id', 'rotary_year', 'term', 'issue_month', 'month',
  'phone', 'reply_to', 'whatsapp', 'new_club_id', 'key', 'old_value', 'new_value'];

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
      // New columns copy the dropdown of the column to their left (e.g. TRUE/FALSE); their own rules come from addValidation_
      if (sh.getMaxRows() > 1) sh.getRange(2, start, sh.getMaxRows() - 1, missing.length).clearDataValidations();
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
  ['members_public', 'couples_public', 'dashboard', 'role_checks', 'moderator_log', 'change_log'].forEach(function (n) {
    var sh = ss.getSheetByName(n);
    if (sh && !sh.getProtections(SpreadsheetApp.ProtectionType.SHEET).length) {
      sh.protect().setDescription('Filled in by the script – do not edit by hand').setWarningOnly(true);
    }
  });
}

var DEFAULT_SETTINGS = [
  ['district_name', 'Rotary District 3110', 'Shown in the header and footer'],
  ['current_rotary_year', '2024-25', 'Rotary year shown for office bearers, teams and committees'],
  ['zones', 'Agra, Bareilly, Kanpur', 'District zones: for the district\'s own use only, never shown on the website'],
  ['professions', '', 'Comma-separated list for the directory; placeholder until the real list is agreed'],
  ['moderator_emails', '', 'Older setting: used only while the moderators tab names no Content moderator'],
  ['site_url', 'https://rotary3110.org/', 'Used in emails to people who send activities'],
  ['form_activity_url', '', 'Filled in by setup'],
  ['form_club_updates_url', '', 'Filled in by setup (Club updates: club details, members and roles, a public service)'],
  ['form_my_details_url', '', 'Filled in by setup (My details on the website: show, remove, business listing)'],
  ['form_club_profile_url', '', 'Filled in by setup: the Club updates form, opening at the club details section'],
  ['form_consent_url', '', 'Filled in by setup: the My details form, opening at "show my details"'],
  ['form_removal_url', '', 'Filled in by setup: the My details form, opening at "remove my details"'],
  ['rebuild_requested_at', '', 'Set by "Rebuild site now": the website updates within about 30 minutes'],
  ['content_changed_at', '', 'Set by every approval, hide, removal and member change: the website takes them at its next update (9 am, 1 pm, 6 pm, 10 pm)'],
  ['inactive_keys', '', 'Filled in by "Refresh public members"; never edit by hand'],
  ['campaign_check_above', '1000', 'A campaign count above this gets a note for the moderator'],
  ['bulletin_start_date', '', 'A Sunday (YYYY-MM-DD): the weekly bulletin archive starts here. Blank: only this week\'s bulletin'],
  ['bulletin_emails', '', 'Older setting: used only while the moderators tab names no District office moderator'],
  ['form_public_service_url', '', 'Filled in by setup: the Club updates form, opening at the public service section'],
  ['form_business_url', '', 'Filled in by setup: the My details form, opening at the business listing (Rotary Means Business)'],
  ['form_club_change_url', '', 'Filled in by setup: the Club updates form, opening at the members and roles section'],
  ['form_contact_url', '', 'Filled in by setup; shown inside the website\'s Contact page'],
  ['contact_email', '', 'Older setting: used only while the moderators tab names no District office moderator'],
  ['contact_daily_limit', String(CORE_CONTACT_DAILY_LIMIT), 'At most this many contact messages are emailed per day; the rest wait in the private Sheet'],
  ['last_backup_at', '', 'Filled in by the weekly backup (Sunday 3 am); copies are in the private Backups folder next to the Sheets'],
  ['summary_emails', '', 'The weekly summary (Monday 8 am) goes here. Blank: the district account that owns the Sheet'],
  ['not_posting_emails', 'not-posting@example.com', 'Older setting (a dummy address): used only while the moderators tab names no Club engagement moderator'],
];

function ensureSettings_(report) {
  var ss = mainSs_();
  var rows = readTab_(ss, 'settings');
  var have = rows.map(function (r) { return r.key; });
  DEFAULT_SETTINGS.forEach(function (s) {
    var i = have.indexOf(s[0]);
    if (i < 0) {
      appendRow_(ss, 'settings', { key: s[0], value: s[1], notes: s[2] });
      report.push('Added setting ' + s[0]);
    } else if (Core_str(rows[i].notes) !== s[2]) {
      updateRow_(ss, 'settings', rows[i]._row, { notes: s[2] }); // the notes explain the setting; values are never touched
    }
  });
}

/** An empty moderators tab gets one placeholder row per type, to be filled in with real names and Google emails. */
function ensureModerators_(report) {
  var ss = mainSs_();
  if (readTab_(ss, 'moderators').length) return;
  CORE_MODERATOR_PLACEHOLDERS.forEach(function (p) {
    appendRow_(ss, 'moderators', { type: p[0], name: p[1], email: '', active: 'TRUE', notes: 'Placeholder: put the real name and Google email here',
      sheet_access: p[0] === 'Administrator' ? 'TRUE' : 'FALSE' });
  });
  report.push('Added placeholder moderators (fill in names and emails, then Administrator → Apply moderators)');
}

function listRule_(values) {
  return SpreadsheetApp.newDataValidation().requireValueInList(values, true).setAllowInvalid(false).build();
}

function addValidation_(main, priv) {
  // Start clean, so a dropdown copied onto the wrong column (see ensureTabs_) is removed; the rules below are put back
  [[main, MODERATED_TABS.concat(['clubs', 'moderators'])],
    [priv, ['consent_requests', 'removal_requests', 'club_change_requests', 'members_master', 'contact_messages', 'couples']]].forEach(function (pair) {
    pair[1].forEach(function (tab) {
      var sh = pair[0].getSheetByName(tab);
      if (sh && sh.getMaxRows() > 1) sh.getRange(2, 1, sh.getMaxRows() - 1, sh.getMaxColumns()).clearDataValidations();
    });
  });
  function apply(ss, tab, col, rule) {
    var sh = ss.getSheetByName(tab);
    var idx = headers_(ss, tab).indexOf(col);
    if (idx >= 0) sh.getRange(2, idx + 1, sh.getMaxRows() - 1, 1).setDataValidation(rule);
  }
  ['events', 'club_profile_requests', 'public_services'].forEach(function (t) {
    apply(main, t, 'status', listRule_(['pending', 'approved', 'rejected']));
  });
  // hidden: taken off the website by a moderator after it was published (Release 1)
  apply(main, 'activities', 'status', listRule_(['pending', 'approved', 'rejected', 'hidden']));
  // a business listing is replaced when the member sends a newer one, removed when they ask through the removal form
  apply(main, 'businesses', 'status', listRule_(['pending', 'approved', 'rejected', 'replaced', 'removed']));
  apply(main, 'businesses', 'trade', listRule_(CORE_TRADES));
  apply(main, 'activities', 'district_level', listRule_(['TRUE', 'FALSE']));
  apply(main, 'activities', 'theme', listRule_(CORE_THEMES));
  apply(main, 'activities', 'avenue', listRule_(CORE_AVENUES));
  apply(main, 'public_services', 'service_type', listRule_(CORE_SERVICE_TYPES));
  apply(main, 'events', 'open_to_all', listRule_(['TRUE', 'FALSE']));
  apply(main, 'clubs', 'meeting_day', listRule_(CORE_WEEKDAYS));
  apply(main, 'club_profile_requests', 'meeting_day', listRule_(CORE_WEEKDAYS));
  apply(main, 'events', 'event_type', listRule_(CORE_EVENT_TYPES));
  apply(main, 'clubs', 'status', listRule_(['active', 'inactive']));
  apply(main, 'moderators', 'type', listRule_(CORE_MODERATOR_TYPES));
  apply(main, 'moderators', 'active', listRule_(['TRUE', 'FALSE']));
  apply(main, 'moderators', 'sheet_access', listRule_(['TRUE', 'FALSE']));
  // A tick-box column would fill every empty row with FALSE, so new rows would land far down the tab.
  // A TRUE/FALSE dropdown leaves empty rows empty.
  apply(main, 'activities', 'story_of_month', listRule_(['TRUE', 'FALSE']));
  apply(main, 'activities', 'bulletin_exclude', listRule_(['TRUE', 'FALSE']));
  apply(main, 'events', 'bulletin_exclude', listRule_(['TRUE', 'FALSE']));
  apply(main, 'events', 'registration_status', listRule_(CORE_REG_STATUSES));
  ['consent_requests', 'removal_requests', 'club_change_requests'].forEach(function (t) {
    apply(priv, t, 'status', listRule_(['pending', 'approved', 'rejected']));
  });
  apply(priv, 'members_master', 'status', listRule_(['active', 'deceased', 'left']));
  apply(priv, 'contact_messages', 'status', listRule_(['new', 'answered', 'spam']));
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
  [main.getId(), privateSheetId_()].forEach(function (id) {
    var f = DriveApp.getFileById(id);
    var access = f.getSharingAccess();
    if (access !== DriveApp.Access.PRIVATE) {
      f.setSharing(DriveApp.Access.PRIVATE, DriveApp.Permission.NONE);
      report.push('Restricted sharing of ' + f.getName());
    }
  });
  var mag = DriveApp.getFolderById(magazineFolderId_());
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
  if (!existing.some(function (e) { return e.indexOf('bulletinPreview|') === 0; })) {
    ScriptApp.newTrigger('bulletinPreview').timeBased().onWeekDay(ScriptApp.WeekDay.SATURDAY).atHour(18).inTimezone('Asia/Kolkata').create();
    report.push('Scheduled the bulletin preview email (Saturday 6 pm)');
  }
  if (!existing.some(function (e) { return e.indexOf('bulletinMessage|') === 0; })) {
    ScriptApp.newTrigger('bulletinMessage').timeBased().onWeekDay(ScriptApp.WeekDay.SUNDAY).atHour(8).inTimezone('Asia/Kolkata').create();
    report.push('Scheduled the bulletin message email (Sunday 8 am)');
  }
  if (!existing.some(function (e) { return e.indexOf('notPostingReport|') === 0; })) {
    ScriptApp.newTrigger('notPostingReport').timeBased().onMonthDay(1).atHour(9).inTimezone('Asia/Kolkata').create();
    report.push('Scheduled the monthly clubs-not-posting email (1st of the month, 9 am)');
  }
  if (!existing.some(function (e) { return e.indexOf('weeklyBackup|') === 0; })) {
    ScriptApp.newTrigger('weeklyBackup').timeBased().onWeekDay(ScriptApp.WeekDay.SUNDAY).atHour(3).inTimezone('Asia/Kolkata').create();
    report.push('Scheduled the weekly backup of both Sheets (Sunday 3 am)');
  }
  if (!existing.some(function (e) { return e.indexOf('checkRebuild|') === 0; })) {
    ScriptApp.newTrigger('checkRebuild').timeBased().everyHours(2).create();
    report.push('Scheduled the check for a rebuild that did not happen (every 2 hours)');
  }
  if (!existing.some(function (e) { return e.indexOf('weeklySummary|') === 0; })) {
    ScriptApp.newTrigger('weeklySummary').timeBased().onWeekDay(ScriptApp.WeekDay.MONDAY).atHour(8).inTimezone('Asia/Kolkata').create();
    report.push('Scheduled the weekly summary email (Monday 8 am)');
  }
}

/**
 * Removes "rows" that hold nothing but FALSE or blanks (left behind by tick-boxes), so that new
 * rows are added straight after the real data. Real rows keep their order.
 */
function tidyBlankRows_(ss, report) {
  ss.getSheets().forEach(function (sh) {
    if (/^raw_/.test(sh.getName()) || sh.getLastRow() < 2) return;
    var range = sh.getDataRange();
    var values = range.getValues();
    var keep = values.filter(function (row, i) {
      return i === 0 || row.some(function (v) { return v !== '' && v !== false && v != null; });
    });
    if (keep.length === values.length) return;
    range.clearContent();
    sh.getRange(2, 1, sh.getMaxRows() - 1, sh.getMaxColumns()).clearDataValidations();
    sh.getRange(1, 1, keep.length, keep[0].length).setValues(keep);
    report.push('Tidied ' + sh.getName() + ': removed ' + (values.length - keep.length) + ' empty rows');
  });
}


// ===== Forms.js =====
/**
 * The four Google Forms (Release 2, 18 Nov 2026; there were eight): the activity form, the Club updates form (club
 * details, members and roles, a public service, as sections), the My details on the website form (show my details,
 * remove them, my business, as sections) and the website's contact form. Questions are found again by their titles,
 * so keep titles in Q unchanged. The activity form sends answers to the main Sheet; the other three to the private
 * Sheet. Each form's raw answers stay untouched in a "raw_…" tab; the script copies them into the working tabs.
 *
 * The six older forms (club profile, public service, club changes, consent, removal, business) still file their
 * answers while they exist; Upgrade Sheet closes them, and Administrator → Delete the old forms removes them.
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
  // added in October 2026 (club services and projects, district campaigns, event registration)
  pProjects: 'Permanent projects (optional)',
  pServices: 'Regular services (optional)',
  aCampaign: 'District campaign (optional)',
  aCampaignCount: 'Campaign count (optional)',
  eRegClose: 'Registration closes on (optional)',
  eFee: 'Fee (optional)',
  // added in Release A (17 October 2026)
  aAvenue: 'Avenue of Service',
  aVideo: 'Video link (optional)',
  aPressPaper: 'Covered in the press: newspaper or news website (optional)',
  aPressDate: 'Covered in the press: date it appeared (optional)',
  aPressLink: 'Covered in the press: link to the news item (optional)',
  eOpen: 'Open to everyone?',
  pMeetingDay: 'Meeting day (optional)',
  sName: 'Name of the service or facility',
  sType: 'Type of service',
  sTimings: 'Days and times it is open',
  sPhone: "The facility's own phone number",
  sAddress: 'Address',
  sCity: 'City or town',
  sMap: 'Google Maps link (optional)',
  sAbout: 'What it offers, in one or two lines (optional)',
  sConfirm: 'Confirmation',
  kName: 'Your name',
  kReply: 'Your email or mobile number, so we can reply',
  kTopic: 'What is it about?',
  kCity: 'Your city or town (optional)',
  kMessage: 'Your message',
  // added 17 November 2026: district work on the activity form; the Rotary Means Business form
  aDistrict: 'District level?',
  bMemberId: 'Your Rotary member ID (optional)',
  bMobile: 'Your mobile number',
  bName: 'Business name',
  bTrade: 'Trade',
  bCity: 'City or town of the business',
  bAbout: 'What your business offers',
  bOffer: 'Offer for Rotarians (optional)',
  bWebsite: 'Business website (optional)',
  bWhatsapp: 'Business WhatsApp number (optional)',
  bTopics: 'Topics I can speak on at club meetings (optional)',
  bConfirm: 'Confirmation',
  // added 17 November 2026: the club changes form (members joining, leaving, moving; club and district roles)
  gMemberId: "Member's Rotary member ID",
  gChange: 'What has changed?',
  gJoined: 'Date joined',
  gLeft: 'Date left',
  gNewClub: 'The new club',
  gMoved: 'Date of the move',
  gDied: 'Date of passing (if known)',
  gClubYear: 'Rotary year of the club role',
  gClubRole: 'Club role',
  gDistYear: 'Rotary year of the district role',
  gTeam: 'District team',
  gCommittee: 'Committee (if any)',
  gRole: 'Role in the team',
  gNote: 'Anything else the moderator should know? (optional)',
  // Release 2 (18 November 2026): the two forms with sections; a new member's own mobile and email
  uKind: 'What do you want to tell the district?',
  mKind: 'What would you like to do?',
  gMobile: "New member's mobile number (optional)",
  gEmail: "New member's email (optional)",
};

// The first choice on each of the two forms with sections leads to its section
var CLUB_UPDATE_KINDS = {
  profile: "Our club's details: website, social pages, meeting day and place, projects and services",
  member: 'A member or a role: joined, left, moved, passed away, President, Secretary, Executive Secretary or a district role',
  service: 'A public service the club runs: blood bank, eye care, dialysis, ambulance…',
};
var MY_DETAILS_KINDS = {
  consent: 'Show my details on the website: directory, photo, birthday, anniversary',
  removal: 'Remove some or all of my details',
  business: 'List my business, or the topics I can speak on (Rotary Means Business)',
};
// The six forms Release 2 replaced, with their answer tabs, and the new form and section each one's link now opens
var OLD_FORMS = {
  club_profile: { raw: 'raw_club_profile_form', sheet: 'main', now: 'club_updates', kind: 'profile' },
  public_service: { raw: 'raw_public_service_form', sheet: 'main', now: 'club_updates', kind: 'service' },
  club_change: { raw: 'raw_club_change_form', sheet: 'private', now: 'club_updates', kind: 'member' },
  consent: { raw: 'raw_consent_form', sheet: 'private', now: 'my_details', kind: 'consent' },
  removal: { raw: 'raw_removal_form', sheet: 'private', now: 'my_details', kind: 'removal' },
  business: { raw: 'raw_business_form', sheet: 'main', now: 'my_details', kind: 'business' },
};
// The member's RI ID is required on the My details form: with the sender's own email, it is how the member is found (owner, 18 Nov 2026)
var MY_DETAILS_ID_HELP = "Your Rotary member ID, from My Rotary or your club's records. It is how we find your record. Never published.";
var CLUB_UPDATES_DESCRIPTION = 'Tell the district about your club: its details (website, social pages, meeting, projects and services), ' +
  'a member who joined, left, moved or passed away, a club or district role, or a public service the club runs. ' +
  "A district moderator checks everything before the website or the district's members list changes, and you get an email when it is decided.";
var MY_DETAILS_DESCRIPTION = 'Your details on the district website: choose what may be shown about you, ask for something to be removed, ' +
  'or list your business. Birthdays and anniversaries are shown as day and month only, never the year.\n\n' +
  'Sent from your own email (the one the district has for you), it is applied at the next website update. ' +
  'If someone else fills it in for you (for example your club secretary), we email you with what was asked, and a district moderator checks it first.';

// The club changes form's choices, by the change kept in club_change_requests
var CLUB_CHANGES = {
  joined: 'A member joined the club', left: 'A member left Rotary or the club', moved: 'A member moved to another club',
  deceased: 'A member passed away', club_role: 'A club role: President, Secretary or Executive Secretary', district_role: 'A district role',
};
var CLUB_OUTSIDE = 'A club outside District 3110';
var REMOVAL_ITEMS = ['Everything', 'Directory listing', 'WhatsApp / call button', 'My photo', 'Birthday', 'Anniversary', 'Couple photo',
  'Business listing (Rotary Means Business)'];
var BUSINESS_DESCRIPTION = 'Rotary Means Business: list your own business on the district website, so Rotarians and the public can find it. ' +
  'For members of Rotary District 3110 only. Fill in your business, or only the speaker question, or both. Send one form per business; ' +
  'send it again any time to update it. A moderator checks every listing before it appears.\n\n' +
  'Shown on the website: your name and club, and the business details below. Your mobile number and email are never shown. ' +
  'No phone numbers in the text, please: the business WhatsApp number, if you give one, is shown only as a WhatsApp button.';

var CONTACT_TOPICS = ['I need help from Rotary', 'I want to volunteer', 'Partnership or CSR', 'Media', 'Something else'];

/** The activity form's description, with the link to the posting guide. */
function activityDescription_() {
  var site = Core_str(settings_().site_url).replace(/\/?$/, '/');
  return 'Share what your club did, or an upcoming event. A moderator checks every entry before it appears on the district website.\n' +
    'Please do not write the names of children.\nTips for a good entry: ' + site + 'how-to-post/';
}

var CLUB_PROFILE_DESCRIPTION = "For club office bearers: your club's website, social media pages, meeting details, permanent projects and " +
  "regular services, shown on your club's page. Send it again any time to update.";

/**
 * Questions added after the forms were first created. setup() and "Upgrade Sheet" add any that are missing to the
 * existing forms, in place (after or before the named question), without recreating the forms.
 */
var LATER_QUESTIONS = [
  { form: 'club_profile', title: Q.pProjects, type: 'paragraph', before: Q.pConfirm,
    help: 'One per line: name – what it is – where. For lasting facilities such as a hospital, clinic, school, library, old-age home, ' +
      'skill centre or dialysis unit. No phone numbers. Type "none" to clear your club\'s list.' },
  { form: 'club_profile', title: Q.pServices, type: 'paragraph', before: Q.pConfirm,
    help: 'One per line: what – when – where. For services that repeat, such as "Free eye check-up – every Thursday, 11 am–1 pm – ' +
      'Roshni Centre". No phone numbers. Type "none" to clear your club\'s list.' },
  { form: 'activity', title: Q.aCampaign, type: 'campaign', after: Q.aHelped,
    help: 'Choose a campaign only if this activity was part of a district drive. The report still needs a photo or a link to your club\'s post.' },
  { form: 'activity', title: Q.aCampaignCount, type: 'number', after: Q.aCampaign,
    help: 'The number in the campaign\'s unit, shown in brackets in the campaign name, e.g. blood units collected. Count only what your own club did.' },
  { form: 'activity', title: Q.eRegClose, type: 'date', after: Q.eEnd, help: 'Leave blank if no registration is needed.' },
  { form: 'activity', title: Q.eFee, type: 'text', after: Q.eRegClose, help: 'For example: Free, or ₹500 per person. Please do not add bank or UPI details.' },
  // Release A
  { form: 'activity', title: Q.aAvenue, type: 'avenue', after: Q.aTheme, required: true,
    help: "Rotary's five Avenues of Service. Club Service: within the club (fellowship, meetings, training). Vocational: through members' " +
      'professions. Community: for the local community. International: with clubs or people abroad. Youth: for young people (Interact, Rotaract, RYLA).' },
  { form: 'activity', title: Q.aVideo, type: 'url', after: Q.aLink,
    help: 'A YouTube, Instagram or Facebook video of this activity, if your club posted one. YouTube videos play on the website.' },
  { form: 'activity', title: Q.aPressPaper, type: 'text', after: Q.aVideo, help: 'For example: Dainik Jagran, Agra edition. Only if a newspaper or news website reported it.' },
  { form: 'activity', title: Q.aPressDate, type: 'date', after: Q.aPressPaper, help: 'The day the news item appeared.' },
  { form: 'activity', title: Q.aPressLink, type: 'url', after: Q.aPressDate,
    help: "A link to the news item on the paper's website or e-paper. Please do not upload photos of the clipping." },
  { form: 'activity', title: Q.eOpen, type: 'yesno', after: Q.eType, help: 'Yes if anyone, not only Rotarians, may come. The website marks it "Open to everyone".' },
  { form: 'club_profile', title: Q.pMeetingDay, type: 'weekday', after: Q.pMeeting + ' (optional)',
    help: 'The weekday your club usually meets, so visitors can find a club meeting on a day that suits them.' },
  // 17 November 2026
  { form: 'activity', title: Q.aDistrict, type: 'yesno', after: Q.aAvenue,
    help: 'Yes only if the district organised it or it was a district occasion, for example a grant inauguration or a district seminar. ' +
      'The Governor need not have been there. The website marks it "District". A moderator checks this.' },
];

function laterQuestion_(title) {
  return LATER_QUESTIONS.filter(function (q) { return q.title === title; })[0];
}

function addLaterQuestion_(form, title, L) {
  var q = laterQuestion_(title);
  var item;
  if (q.type === 'paragraph') item = form.addParagraphTextItem().setTitle(q.title).setHelpText(q.help);
  else if (q.type === 'campaign') item = form.addListItem().setTitle(q.title).setHelpText(q.help).setChoiceValues(L.campaigns);
  else if (q.type === 'avenue') item = form.addListItem().setTitle(q.title).setHelpText(q.help).setChoiceValues(CORE_AVENUES);
  else if (q.type === 'weekday') item = form.addListItem().setTitle(q.title).setHelpText(q.help).setChoiceValues(CORE_WEEKDAYS);
  else if (q.type === 'yesno') item = form.addMultipleChoiceItem().setTitle(q.title).setHelpText(q.help).setChoiceValues(YES_NO);
  else if (q.type === 'number') item = form.addTextItem().setTitle(q.title).setHelpText(q.help).setValidation(numberRule_());
  else if (q.type === 'date') item = form.addDateItem().setTitle(q.title).setHelpText(q.help);
  else if (q.type === 'url') item = form.addTextItem().setTitle(q.title).setHelpText(q.help).setValidation(urlRule_());
  else {
    item = form.addTextItem().setTitle(q.title).setHelpText(q.help)
      .setValidation(FormApp.createTextValidation().requireTextLengthLessThanOrEqualTo(60).setHelpText('Up to 60 characters').build());
  }
  if (q.required) item.setRequired(true);
  return item;
}

/** Adds any missing later question to the existing forms, in its place. Safe to run more than once. */
function addLaterQuestions_(report) {
  var ids = JSON.parse(props_().getProperty('FORM_IDS') || '{}');
  var L = formLists_();
  LATER_QUESTIONS.forEach(function (q) {
    if (!ids[q.form]) return;
    var form = FormApp.openById(ids[q.form]);
    var titles = function () { return form.getItems().map(function (it) { return it.getTitle(); }); };
    if (titles().indexOf(q.title) >= 0) return;
    var item = addLaterQuestion_(form, q.title, L);
    var anchor = titles().indexOf(q.after || q.before);
    if (anchor >= 0) form.moveItem(item.getIndex(), q.after ? anchor + 1 : anchor);
    report.push('Added the question "' + q.title + '" to the ' + q.form.replace('_', ' ') + ' form' + (anchor < 0 ? ' (at the end: please move it)' : ''));
  });
  if (ids.club_profile) FormApp.openById(ids.club_profile).setDescription(CLUB_PROFILE_DESCRIPTION);
  if (ids.my_details) {
    // the RI member ID became required on the My details form (owner, 18 Nov 2026)
    FormApp.openById(ids.my_details).getItems().forEach(function (it) {
      if (it.getTitle() !== Q.cMemberId) return;
      var text = it.asTextItem();
      if (text.isRequired()) return;
      text.setRequired(true).setHelpText(MY_DETAILS_ID_HELP);
      report.push('The RI member ID is now required on the My details form');
    });
  }
  ['removal', 'my_details'].forEach(function (key) {
    if (!ids[key]) return;
    // the removal form offers each thing that can be shown, the business listing included (17 Nov 2026)
    FormApp.openById(ids[key]).getItems().forEach(function (it) {
      if (it.getTitle() !== Q.rItems) return;
      var box = it.asCheckboxItem();
      var now = box.getChoices().map(function (c) { return c.getValue(); });
      if (now.join('|') !== REMOVAL_ITEMS.join('|')) {
        box.setChoiceValues(REMOVAL_ITEMS);
        report.push('Updated the choices on the removal form (business listing added)');
      }
    });
  });
  if (ids.consent) {
    var consentForm = FormApp.openById(ids.consent);
    if (consentForm.getDescription() !== CONSENT_DESCRIPTION) {
      consentForm.setDescription(CONSENT_DESCRIPTION);
      report.push('Updated the consent form wording (the member is emailed when someone else fills it in)');
    }
  }
  if (ids.activity) {
    var activity = FormApp.openById(ids.activity);
    activity.setDescription(activityDescription_());
    activity.getItems().forEach(function (it) {
      if (it.getTitle() !== Q.aConsent) return;
      var box = it.asCheckboxItem();
      var now = box.getChoices().map(function (c) { return c.getValue(); });
      if (now.length !== 1 || now[0] !== PHOTO_CONSENT_TEXT) {
        box.setChoiceValues([PHOTO_CONSENT_TEXT]);
        report.push('Updated the photo consent wording on the activity form');
      }
    });
  }
}

var YES_NO = ['Yes', 'No'];
// Senders are told the member hears about the form (consent safeguards, 1 Nov 2026)
var CONSENT_DESCRIPTION = 'Choose what the district website may show about you. Each item is a separate choice, and you can change your mind at any time ' +
  'using the removal form. Birthdays and anniversaries are shown as day and month only, never the year.\n\n' +
  'If you fill this in for another member (for example as club secretary), we email the member at the address the district has for them, ' +
  'with your email address and what you asked to show, and wait a few days before anything is shown.';
// Photos arrive with consent (decided 18 Oct): moderators reject photos sent without this tick
var PHOTO_CONSENT_TEXT = 'Everyone identifiable in these photos agreed to them being published, and for children, a parent or guardian agreed.';
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
  // role years follow today's date, not the year the website shows, so a club can report this year's and next year's
  // office bearers (Release 1, 18 Nov 2026)
  var year = Core_rotaryYearOf(today_());
  return {
    clubs: activeClubs.length ? activeClubs : ['(clubs not loaded yet)'],
    areas: areas.length ? areas : ['(areas not loaded yet)'],
    professions: professions.length ? professions.concat(['Other']) : ['Other'],
    organisers: activeClubs.concat(teams.length ? teams : ["Governor's Office Team"]),
    roles: ['President', 'Secretary', 'Public Image Chair', 'Other office bearer', 'Member'],
    serviceTypes: CORE_SERVICE_TYPES.slice(),
    trades: CORE_TRADES.slice(),
    campaigns: [CORE_NO_CAMPAIGN].concat(Core_openCampaigns(readTab_(mainSs_(), 'campaigns'), today_()).map(Core_campaignLabel)),
    newClubs: (activeClubs.length ? activeClubs : ['(clubs not loaded yet)']).concat([CLUB_OUTSIDE]),
    teams: teams.length ? teams.slice().sort() : ["Governor's Office Team"],
    years: [year, Core_nextRotaryYear(year)],
  };
}

function createForms_(report) {
  var ids = JSON.parse(props_().getProperty('FORM_IDS') || '{}');
  var L = formLists_();
  var makers = { activity: makeActivityForm_, contact: makeContactForm_, club_updates: makeClubUpdatesForm_, my_details: makeMyDetailsForm_ };
  var destinations = { activity: mainSs_().getId(), contact: privateSheetId_(), club_updates: privateSheetId_(), my_details: privateSheetId_() };
  var rawNames = { activity: 'raw_activity_form', contact: 'raw_contact_form', club_updates: 'raw_club_updates_form', my_details: 'raw_my_details_form' };

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
    keepInSheetFolder_(form.getId(), 'the ' + key.replace('_', ' ') + ' form', report);
    setSetting_('form_' + key + '_url', form.getPublishedUrl());
  });
  // the older forms' links (on the website and in emails) now open the new form at the right section
  Object.keys(OLD_FORMS).forEach(function (key) {
    var o = OLD_FORMS[key];
    var url = sectionLink_(o.now, o.kind);
    if (url) setSetting_('form_' + key + '_url', url);
  });
  closeOldForms_(ids, report);
}

/** A link to the Club updates or My details form with the first question already answered, so it opens at that section. */
function sectionLink_(formKey, kind) {
  var ids = JSON.parse(props_().getProperty('FORM_IDS') || '{}');
  if (!ids[formKey]) return '';
  var form = FormApp.openById(ids[formKey]);
  var title = formKey === 'club_updates' ? Q.uKind : Q.mKind;
  var text = (formKey === 'club_updates' ? CLUB_UPDATE_KINDS : MY_DETAILS_KINDS)[kind];
  var item = form.getItems().filter(function (it) { return it.getTitle() === title; })[0];
  if (!item) return form.getPublishedUrl();
  try {
    return form.createResponse().withItemResponse(item.asMultipleChoiceItem().createResponse(text)).toPrefilledUrl();
  } catch (e) {
    return form.getPublishedUrl();
  }
}

/** The six older forms stop taking answers once the two new ones exist, and say where to go instead. Nothing is deleted. */
function closeOldForms_(ids, report) {
  if (!ids.club_updates || !ids.my_details) return;
  Object.keys(OLD_FORMS).forEach(function (key) {
    if (!ids[key]) return;
    var form;
    try { form = FormApp.openById(ids[key]); } catch (e) { return; }
    var now = OLD_FORMS[key].now === 'club_updates' ? 'Club updates' : 'My details on the website';
    var name = key.replace('_', ' ');
    // Google refused this message with the new form's prefilled link in it ("Invalid data updating form", 18 Nov 2026),
    // so it names the form and the website instead; the website's links already open the new form at the right section
    var message = 'This form has moved. Please use the "' + now + '" form, linked on the district website.';
    if (form.isAcceptingResponses()) {
      try {
        form.setAcceptingResponses(false);
      } catch (e) {
        report.push('Could not close the old ' + name + ' form (Google said: ' + e.message + '). Close it by hand: open the form, Responses, turn off Accepting responses');
        return;
      }
      report.push('Closed the old ' + name + ' form (it points to the ' + now + ' form)');
    }
    try {
      if (form.getCustomClosedFormMessage() !== message) form.setCustomClosedFormMessage(message);
    } catch (e) {
      report.push('The old ' + name + ' form is closed, but Google refused its "has moved" message (' + e.message + '); it shows Google\'s own closed message');
    }
  });
}

/**
 * Administrator → Delete the old forms and their answer tabs…: once the two new forms work, the six older forms go to
 * Google Drive's Bin (deleted for good after 30 days) and their raw answer tabs are deleted (owner, 18 Nov 2026).
 * What they filed stays in the working tabs (consent_requests, club_change_requests and so on).
 */
function deleteOldForms() {
  var ui = SpreadsheetApp.getUi();
  var out = deleteOldForms_(function (list) {
    return ui.alert('Delete the old forms', 'These forms go to the Bin and their answer tabs are deleted:\n\n' + list.join('\n') +
      '\n\nWhat they sent stays in the working tabs. Go ahead?', ui.ButtonSet.YES_NO) === ui.Button.YES;
  });
  ui.alert(out);
  return out;
}

function deleteOldForms_(confirm) {
  var ids = JSON.parse(props_().getProperty('FORM_IDS') || '{}');
  if (!ids.club_updates || !ids.my_details) return 'The two new forms are not set up yet: run Upgrade Sheet first.';
  var old = Object.keys(OLD_FORMS).filter(function (k) { return ids[k]; });
  if (!old.length) return 'The old forms are already gone.';
  if (!confirm(old.map(function (k) { return '• ' + k.replace('_', ' ') + ' form, tab ' + OLD_FORMS[k].raw; }))) return 'Nothing deleted.';
  var done = [];
  old.forEach(function (key) {
    var o = OLD_FORMS[key];
    try { FormApp.openById(ids[key]).removeDestination(); } catch (e) { /* already unlinked */ }
    ScriptApp.getProjectTriggers().forEach(function (t) { if (t.getTriggerSourceId && t.getTriggerSourceId() === ids[key]) ScriptApp.deleteTrigger(t); });
    try { DriveApp.getFileById(ids[key]).setTrashed(true); } catch (e) { Logger.log('Form ' + key + ' not moved to the Bin: ' + e.message); }
    var ss = o.sheet === 'main' ? mainSs_() : privateSs_();
    var tab = ss.getSheetByName(o.raw);
    if (tab) ss.deleteSheet(tab);
    delete ids[key];
    props_().setProperty('FORM_IDS', JSON.stringify(ids));
    done.push(key.replace('_', ' '));
  });
  return 'Deleted: the ' + done.join(', ') + ' forms (in the Bin for 30 days) and their answer tabs.';
}

/** Google creates new forms in My Drive; move one into the folder that holds the main Sheet (testing or production). */
function keepInSheetFolder_(fileId, label, report) {
  try {
    var parents = DriveApp.getFileById(mainSs_().getId()).getParents();
    if (!parents.hasNext()) return;
    var folder = parents.next();
    var file = DriveApp.getFileById(fileId);
    var own = file.getParents();
    while (own.hasNext()) if (own.next().getId() === folder.getId()) return;
    file.moveTo(folder);
    report.push('Moved ' + label + ' into the folder "' + folder.getName() + '"');
  } catch (e) {
    report.push('Could not move ' + label + ' next to the Sheet (' + e.message + '); move it by hand');
  }
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
  var form = baseForm_('Club activity or event – Rotary District 3110', activityDescription_());
  addSender_(form, L);
  var kind = form.addMultipleChoiceItem().setTitle(Q.kind).setRequired(true);

  var activityPage = form.addPageBreakItem().setTitle('About the activity');
  form.addTextItem().setTitle(Q.aTitle).setRequired(true)
    .setValidation(FormApp.createTextValidation().requireTextLengthLessThanOrEqualTo(80).setHelpText('Up to 80 characters').build());
  form.addDateItem().setTitle(Q.aDate).setRequired(true);
  form.addListItem().setTitle(Q.aTheme).setChoiceValues(CORE_THEMES).setRequired(true)
    .setHelpText("Rotary's seven Areas of Focus, or Club service / Other for installations, fellowship, training and similar.");
  addLaterQuestion_(form, Q.aAvenue, L);
  addLaterQuestion_(form, Q.aDistrict, L);
  form.addParagraphTextItem().setTitle(Q.aDesc).setRequired(true)
    .setHelpText('Two to five lines. Please do not write the names of children.')
    .setValidation(FormApp.createParagraphTextValidation().requireTextMatchesPattern('^[\\s\\S]{100,600}$')
      .setHelpText('Please write between 100 and 600 characters (about 2–5 lines)').build());
  // The photo question is added here by hand (Google does not allow scripts to add file uploads), and after it the
  // optional "Before photo" and "After photo" questions (17 Nov 2026; see the Google setup guide)
  form.addTextItem().setTitle(Q.aLink).setHelpText('If your club already posted this on its website or social page, paste the link instead of photos.')
    .setValidation(urlRule_());
  addLaterQuestion_(form, Q.aVideo, L);
  addLaterQuestion_(form, Q.aPressPaper, L);
  addLaterQuestion_(form, Q.aPressDate, L);
  addLaterQuestion_(form, Q.aPressLink, L);
  form.addTextItem().setTitle(Q.aHelped).setValidation(numberRule_());
  addLaterQuestion_(form, Q.aCampaign, L);
  addLaterQuestion_(form, Q.aCampaignCount, L);
  form.addTextItem().setTitle(Q.aSpent).setValidation(numberRule_());
  form.addCheckboxItem().setTitle(Q.aPartners).setChoiceValues(L.clubs);
  form.addCheckboxItem().setTitle(Q.aConsent).setRequired(true).setChoiceValues([PHOTO_CONSENT_TEXT]);

  var eventPage = form.addPageBreakItem().setTitle('About the event');
  form.addTextItem().setTitle(Q.eTitle).setRequired(true)
    .setValidation(FormApp.createTextValidation().requireTextLengthLessThanOrEqualTo(80).setHelpText('Up to 80 characters').build());
  form.addListItem().setTitle(Q.eType).setChoiceValues(CORE_EVENT_TYPES).setRequired(true);
  addLaterQuestion_(form, Q.eOpen, L);
  form.addDateItem().setTitle(Q.eStart).setRequired(true);
  form.addTimeItem().setTitle(Q.eTime);
  form.addDateItem().setTitle(Q.eEnd);
  addLaterQuestion_(form, Q.eRegClose, L);
  addLaterQuestion_(form, Q.eFee, L);
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

/**
 * Club updates (Release 2): the club profile, club changes and public service forms in one, with a section each.
 * Page 1 asks who is sending and what about; the answer leads to the section, and each section ends the form.
 * The question titles are the old forms' own, so the same filing code reads them.
 */
function makeClubUpdatesForm_(L) {
  var form = baseForm_('Club updates – Rotary District 3110', CLUB_UPDATES_DESCRIPTION);
  addSender_(form, L);
  var kind = form.addMultipleChoiceItem().setTitle(Q.uKind).setRequired(true);

  var profile = form.addPageBreakItem().setTitle("Our club's details").setHelpText(CLUB_PROFILE_DESCRIPTION);
  [Q.pWebsite, Q.pFacebook, Q.pInstagram, Q.pYoutube, Q.pX, Q.pLinkedin].forEach(function (t) {
    form.addTextItem().setTitle(t + ' (optional)').setValidation(urlRule_());
  });
  form.addTextItem().setTitle(Q.pMeeting + ' (optional)').setHelpText('For example: Every Tuesday, 7:30 pm, Hotel Grand, Agra');
  addLaterQuestion_(form, Q.pMeetingDay, L);
  addLaterQuestion_(form, Q.pProjects, L);
  addLaterQuestion_(form, Q.pServices, L);
  form.addCheckboxItem().setTitle(Q.pConfirm).setRequired(true)
    .setChoiceValues(['I am an office bearer of this club and these links belong to the club.']);

  var member = form.addPageBreakItem().setTitle('A member or a role')
    .setHelpText("Give the member's Rotary member ID (from My Rotary or the club's records). A Members moderator checks every change.");
  form.addTextItem().setTitle(Q.gMemberId).setRequired(true)
    .setValidation(FormApp.createTextValidation().requireWholeNumber().setHelpText('Numbers only').build())
    .setHelpText("From My Rotary or the club's records. Never published.");
  form.addTextItem().setTitle(Q.rName).setRequired(true);
  var change = form.addMultipleChoiceItem().setTitle(Q.gChange).setRequired(true);
  var pages = clubChangePages_(form, L);

  var service = form.addPageBreakItem().setTitle('A public service the club runs')
    .setHelpText('A lasting facility the public can use, such as a blood bank, eye hospital, dialysis unit, clinic, library, skill centre or ambulance. ' +
      'Send one per facility.');
  addServiceQuestions_(form, L);

  kind.setChoices([kind.createChoice(CLUB_UPDATE_KINDS.profile, profile), kind.createChoice(CLUB_UPDATE_KINDS.member, member),
    kind.createChoice(CLUB_UPDATE_KINDS.service, service)]);
  member.setGoToPage(FormApp.PageNavigationType.SUBMIT); // the club details section ends the form
  change.setChoices(['joined', 'left', 'moved', 'deceased', 'club_role', 'district_role'].map(function (k) { return change.createChoice(CLUB_CHANGES[k], pages[k]); }));
  service.setGoToPage(FormApp.PageNavigationType.SUBMIT); // the member section ends with its note
  form.setConfirmationMessage('Thank you! A district moderator will check this within 48 hours. You will get an email when it is decided.');
  return form;
}

/** The club changes form's pages, one per kind of change, each going on to the note (shared by both forms). */
function clubChangePages_(form, L) {
  var p = {};
  p.joined = form.addPageBreakItem().setTitle(CLUB_CHANGES.joined);
  form.addDateItem().setTitle(Q.gJoined).setRequired(true);
  form.addTextItem().setTitle(Q.gMobile).setHelpText('Only the district sees this, to send the member the website\'s yearly check. Never published.')
    .setValidation(textRule_(MOBILE_PATTERN, 'Please give a 10-digit mobile number'));
  form.addTextItem().setTitle(Q.gEmail).setHelpText('Only the district sees this. Never published.')
    .setValidation(FormApp.createTextValidation().requireTextIsEmail().setHelpText('Please give an email address').build());
  p.left = form.addPageBreakItem().setTitle(CLUB_CHANGES.left);
  form.addDateItem().setTitle(Q.gLeft).setRequired(true);
  p.moved = form.addPageBreakItem().setTitle(CLUB_CHANGES.moved).setHelpText('The club chosen on the first page is the club the member left.');
  form.addListItem().setTitle(Q.gNewClub).setChoiceValues(L.newClubs).setRequired(true);
  form.addDateItem().setTitle(Q.gMoved).setRequired(true);
  p.deceased = form.addPageBreakItem().setTitle(CLUB_CHANGES.deceased);
  form.addDateItem().setTitle(Q.gDied);
  p.club_role = form.addPageBreakItem().setTitle(CLUB_CHANGES.club_role);
  form.addListItem().setTitle(Q.gClubYear).setChoiceValues(L.years).setRequired(true);
  form.addListItem().setTitle(Q.gClubRole).setChoiceValues(CORE_CLUB_ROLES.slice()).setRequired(true);
  p.district_role = form.addPageBreakItem().setTitle(CLUB_CHANGES.district_role)
    .setHelpText('The member may be from another club. Please say in the note who decided it, for example the Governor\'s letter.');
  form.addListItem().setTitle(Q.gDistYear).setChoiceValues(L.years).setRequired(true);
  form.addListItem().setTitle(Q.gTeam).setChoiceValues(L.teams).setRequired(true);
  form.addTextItem().setTitle(Q.gCommittee).setHelpText('As the district names it, for example District Social Media Management Committee');
  form.addTextItem().setTitle(Q.gRole).setRequired(true).setHelpText('For example: Chairman, Co-chairman, Member, Assistant Governor')
    .setValidation(FormApp.createTextValidation().requireTextLengthLessThanOrEqualTo(60).setHelpText('Up to 60 characters').build());
  var note = form.addPageBreakItem().setTitle('Anything else');
  form.addParagraphTextItem().setTitle(Q.gNote)
    .setValidation(FormApp.createParagraphTextValidation().requireTextLengthLessThanOrEqualTo(500).setHelpText('Up to 500 characters').build());
  // each kind's page goes on to the note (a page break's "go to" applies at the end of the page before it)
  [p.left, p.moved, p.deceased, p.club_role, p.district_role].forEach(function (x) { x.setGoToPage(note); });
  p.note = note;
  return p;
}

function addServiceQuestions_(form, L) {
  form.addTextItem().setTitle(Q.sName).setRequired(true).setHelpText('For example: Rotary Blood Bank, Civil Lines')
    .setValidation(FormApp.createTextValidation().requireTextLengthLessThanOrEqualTo(80).setHelpText('Up to 80 characters').build());
  form.addListItem().setTitle(Q.sType).setChoiceValues(L.serviceTypes).setRequired(true);
  form.addTextItem().setTitle(Q.sTimings).setRequired(true).setHelpText('For example: Every day, 9 am–8 pm; or Open 24 hours')
    .setValidation(FormApp.createTextValidation().requireTextLengthLessThanOrEqualTo(80).setHelpText('Up to 80 characters').build());
  form.addTextItem().setTitle(Q.sPhone).setRequired(true)
    .setHelpText("The facility's public number (reception or helpline), never a member's personal mobile. It will be shown on the website.")
    .setValidation(textRule_('^[0-9 +()-]{3,24}$', 'Digits only, with spaces or dashes if you like, e.g. 0562 222 3344'));
  form.addTextItem().setTitle(Q.sAddress).setRequired(true)
    .setValidation(FormApp.createTextValidation().requireTextLengthLessThanOrEqualTo(150).setHelpText('Up to 150 characters').build());
  form.addListItem().setTitle(Q.sCity).setChoiceValues(L.areas).setRequired(true);
  form.addTextItem().setTitle(Q.sMap).setHelpText('Open the place in Google Maps, tap Share and paste the link here.').setValidation(urlRule_());
  form.addTextItem().setTitle(Q.sAbout).setHelpText('For example: Free dialysis for patients below the poverty line; nominal charge for others.')
    .setValidation(FormApp.createTextValidation().requireTextLengthLessThanOrEqualTo(200).setHelpText('Up to 200 characters').build());
  form.addCheckboxItem().setTitle(Q.sConfirm).setRequired(true)
    .setChoiceValues(["I am an office bearer of this club, the club runs or supports this facility, and the phone number is the facility's own public number."]);
}

/**
 * My details on the website (Release 2): the consent, removal and business forms in one. Page 1 finds the member
 * (club, name, member ID, mobile, who is filling it) and asks what they want; each section ends the form. The
 * "My photo", "Couple photo" and "Logo or shop photo (optional)" upload questions are added by hand (Google does not
 * let scripts add uploads), in the Photo, Celebrations and Your business sections.
 */
function makeMyDetailsForm_(L) {
  var form = baseForm_('My details on the website – Rotary District 3110', MY_DETAILS_DESCRIPTION);
  form.addListItem().setTitle(Q.cClub).setChoiceValues(L.clubs).setRequired(true);
  form.addTextItem().setTitle(Q.cName).setRequired(true);
  form.addTextItem().setTitle(Q.cMemberId).setRequired(true).setHelpText(MY_DETAILS_ID_HELP)
    .setValidation(FormApp.createTextValidation().requireWholeNumber().setHelpText('Numbers only').build());
  form.addTextItem().setTitle(Q.cMobile).setRequired(true)
    .setHelpText('Shown only as a WhatsApp/call button, and only if you say Yes to it. Never shown otherwise.')
    .setValidation(textRule_(MOBILE_PATTERN, 'Please give a 10-digit mobile number'));
  form.addMultipleChoiceItem().setTitle(Q.cFilledBy).setChoiceValues(['The member', 'Club secretary for the member']).setRequired(true);
  var kind = form.addMultipleChoiceItem().setTitle(Q.mKind).setRequired(true);

  var directory = form.addPageBreakItem().setTitle('Professional directory');
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

  var removal = form.addPageBreakItem().setTitle('Remove my details');
  form.addCheckboxItem().setTitle(Q.rItems).setRequired(true).setChoiceValues(REMOVAL_ITEMS);
  form.addParagraphTextItem().setTitle(Q.rReason);

  var business = form.addPageBreakItem().setTitle('Your business').setHelpText(BUSINESS_DESCRIPTION + '\n\nLeave this page blank if you only want to be listed as a speaker.');
  form.addTextItem().setTitle(Q.bName).setHelpText('For example: Gupta Opticals')
    .setValidation(FormApp.createTextValidation().requireTextLengthLessThanOrEqualTo(80).setHelpText('Up to 80 characters').build());
  form.addListItem().setTitle(Q.bTrade).setChoiceValues(L.trades);
  form.addListItem().setTitle(Q.bCity).setChoiceValues(L.areas);
  form.addParagraphTextItem().setTitle(Q.bAbout).setHelpText('One or two lines. No phone numbers or email addresses.')
    .setValidation(FormApp.createParagraphTextValidation().requireTextLengthLessThanOrEqualTo(300).setHelpText('Up to 300 characters').build());
  form.addTextItem().setTitle(Q.bOffer).setHelpText('For example: 10% off for Rotarians and their families')
    .setValidation(FormApp.createTextValidation().requireTextLengthLessThanOrEqualTo(100).setHelpText('Up to 100 characters').build());
  form.addTextItem().setTitle(Q.bWebsite).setValidation(urlRule_());
  form.addTextItem().setTitle(Q.bWhatsapp).setHelpText('Shown only as a WhatsApp button on your listing, never as a number.')
    .setValidation(textRule_(MOBILE_PATTERN, 'Please give a 10-digit mobile number'));
  // "Logo or shop photo (optional)" upload question is added here by hand
  form.addPageBreakItem().setTitle('Speaking at clubs');
  form.addParagraphTextItem().setTitle(Q.bTopics)
    .setHelpText('Clubs look for speakers for their meetings. For example: Income tax for families; First aid at home. Leave blank if not.')
    .setValidation(FormApp.createParagraphTextValidation().requireTextLengthLessThanOrEqualTo(300).setHelpText('Up to 300 characters').build());
  form.addPageBreakItem().setTitle('Confirmation');
  form.addCheckboxItem().setTitle(Q.bConfirm).setRequired(true)
    .setChoiceValues(['I am a member of this club, this is my own business (or one I am a partner in), and I agree to my name, club and these details being shown on the district website.']);

  kind.setChoices([kind.createChoice(MY_DETAILS_KINDS.consent, directory), kind.createChoice(MY_DETAILS_KINDS.removal, removal),
    kind.createChoice(MY_DETAILS_KINDS.business, business)]);
  removal.setGoToPage(FormApp.PageNavigationType.SUBMIT); // the consent section ends the form
  business.setGoToPage(FormApp.PageNavigationType.SUBMIT); // the removal section ends the form
  form.setConfirmationMessage('Thank you! Sent from your own email, it is applied at the next website update and you get an email. ' +
    'Otherwise a district moderator checks it first.');
  return form;
}

/**
 * The website's contact form, shown inside the Contact page. No Google sign-in, so anyone can write.
 * Messages go to the private Sheet and are emailed on to the district; the reply details are never published.
 */
function makeContactForm_() {
  var form = FormApp.create('Contact Rotary District 3110');
  form.setDescription('Write to Rotary District 3110. The district office reads every message. Your details are used only to reply to you.');
  form.setCollectEmail(false);
  form.setAllowResponseEdits(false);
  form.setConfirmationMessage('Thank you. Your message has reached the district office. Someone will reply to you.');
  form.addTextItem().setTitle(Q.kName).setRequired(true)
    .setValidation(FormApp.createTextValidation().requireTextLengthLessThanOrEqualTo(80).setHelpText('Up to 80 characters').build());
  form.addTextItem().setTitle(Q.kReply).setRequired(true).setHelpText('Only the district office sees this. It is never shown on the website.')
    .setValidation(FormApp.createTextValidation().requireTextLengthLessThanOrEqualTo(100).setHelpText('Up to 100 characters').build());
  form.addListItem().setTitle(Q.kTopic).setChoiceValues(CONTACT_TOPICS).setRequired(true);
  form.addTextItem().setTitle(Q.kCity)
    .setValidation(FormApp.createTextValidation().requireTextLengthLessThanOrEqualTo(60).setHelpText('Up to 60 characters').build());
  form.addParagraphTextItem().setTitle(Q.kMessage).setRequired(true)
    // Google Forms patterns count to 1000 at most ({20,1500} is refused with "Invalid data updating form")
    .setValidation(FormApp.createParagraphTextValidation().requireTextMatchesPattern('^[\\s\\S]{20,1000}$')
      .setHelpText('Please write between 20 and 1,000 characters').build());
  return form;
}

/**
 * Each club's own link to the activity form with the club already chosen, kept in the clubs tab
 * (activity_form_link) for the district to send to club secretaries. Never published.
 */
function makeClubFormLinks_() {
  var ids = JSON.parse(props_().getProperty('FORM_IDS') || '{}');
  if (!ids.activity) return 0;
  var form = FormApp.openById(ids.activity);
  var clubItem = form.getItems().filter(function (it) { return it.getTitle() === Q.club; })[0];
  if (!clubItem) return 0;
  var ss = mainSs_();
  var sh = ss.getSheetByName('clubs');
  var headers = headers_(ss, 'clubs');
  var col = headers.indexOf('activity_form_link');
  if (col < 0 || sh.getLastRow() < 2) return 0;
  var rows = readTab_(ss, 'clubs');
  var values = [];
  for (var r = 2; r <= sh.getLastRow(); r++) values.push(['']);
  var made = 0;
  rows.forEach(function (c) {
    if (!Core_str(c.club_name) || Core_str(c.status || 'active') !== 'active') return;
    try {
      values[c._row - 2] = [form.createResponse().withItemResponse(clubItem.asListItem().createResponse(Core_str(c.club_name))).toPrefilledUrl()];
      made++;
    } catch (e) { /* a club name the form does not list yet: refreshed with the form lists */ }
  });
  sh.getRange(2, col + 1, values.length, 1).setValues(values);
  return made;
}

/**
 * Menu: refresh the club, area, profession and campaign lists in the forms after the clubs, lists or campaigns tabs
 * change. Also runs every morning, so campaigns drop off the form 30 days after they end.
 */
function updateFormLists(silent) {
  var ids = JSON.parse(props_().getProperty('FORM_IDS') || '{}');
  var L = formLists_();
  var lists = {};
  lists[Q.club] = L.clubs; lists[Q.cClub] = L.clubs; lists[Q.aPartners] = L.clubs; lists[Q.cSpouseClub] = L.clubs;
  lists[Q.eCity] = L.areas; lists[Q.cArea] = L.areas; lists[Q.cProfession] = L.professions; lists[Q.eOrganiser] = L.organisers;
  lists[Q.aCampaign] = L.campaigns; lists[Q.sCity] = L.areas; lists[Q.bCity] = L.areas; lists[Q.bTrade] = L.trades;
  lists[Q.gNewClub] = L.newClubs; lists[Q.gTeam] = L.teams; lists[Q.gClubYear] = L.years; lists[Q.gDistYear] = L.years;
  Object.keys(ids).forEach(function (k) {
    var form = FormApp.openById(ids[k]);
    if (OLD_FORMS[k] && !form.isAcceptingResponses()) return; // a closed old form needs no fresh lists
    form.getItems().forEach(function (item) {
      var values = lists[item.getTitle()];
      if (!values) return;
      if (item.getType() === FormApp.ItemType.LIST) item.asListItem().setChoiceValues(values);
      if (item.getType() === FormApp.ItemType.CHECKBOX) item.asCheckboxItem().setChoiceValues(values);
    });
  });
  try { makeClubFormLinks_(); } catch (e) { Logger.log('Club form links not made: ' + e.message); }
  if (silent === true) return;
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
  AFTER_FILING = [];
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
    else if (formId === ids.public_service) filePublicService_(answers, meta);
    else if (formId === ids.contact) fileContact_(answers, meta);
    else if (formId === ids.business) fileBusiness_(answers, meta);
    else if (formId === ids.club_change) fileClubChange_(answers, meta);
    // Release 2: the two forms with sections
    else if (formId === ids.club_updates) fileClubUpdates_(answers, meta);
    else if (formId === ids.my_details) fileMyDetails_(answers, meta);
  } finally {
    lock.releaseLock();
  }
  // a member's own update is applied once the answer is filed and the lock is free (the approvals take it themselves)
  var jobs = AFTER_FILING;
  AFTER_FILING = [];
  jobs.forEach(function (job) { job(); });
}

var AFTER_FILING = [];

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

/** "aol.com/post" -> "https://aol.com/post", so links people type without https:// still work. */
function link_(value) {
  var s = Core_str(value);
  if (!s) return '';
  return /^https?:\/\//i.test(s) ? s : 'https://' + s.replace(/^\/+/, '');
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

/** Moderator notes for free text that must not be published as it is. */
function textNotes_(values, notes) {
  if (values.some(function (v) { return Core_unsafeText(Core_str(v)); })) notes.push('Contains a phone number or email: remove it before approving');
  if (values.some(function (v) { return Core_str(v).split(/\r?\n/).some(function (l) { return l.trim().length > CORE_LINE_MAX; }); })) {
    notes.push('A line is longer than ' + CORE_LINE_MAX + ' characters');
  }
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
    var fee = Core_str(a[Q.eFee]);
    var eventNotes = [];
    if (Core_unsafeText(fee) || CORE_PAYMENT_RE.test(fee)) eventNotes.push('Fee contains payment details: remove before approving');
    if (Core_str(a[Q.eType]) === 'District event') eventNotes.push(DISTRICT_CHECK);
    var ev = Object.assign(sender, {
      id: nextId_(events, 'EVT-' + new Date().getFullYear() + '-'),
      title: Core_str(a[Q.eTitle]), event_type: Core_str(a[Q.eType]), start_date: Core_str(a[Q.eStart]),
      start_time: Core_str(a[Q.eTime]), end_date: Core_str(a[Q.eEnd]), venue: Core_str(a[Q.eVenue]), city: Core_str(a[Q.eCity]),
      organiser: Core_str(a[Q.eOrganiser]) || clubName, description: Core_str(a[Q.eDesc]), map_link: link_(a[Q.eMap]),
      details_link: link_(a[Q.eDetails]),
      // the event page has its own photo question with the same title; only one of the two is ever answered
      photo_files: fileIds_(firstStartingWith_(a, 'Photos')),
      registration_close_date: Core_str(a[Q.eRegClose]), fee: fee, moderator_note: eventNotes.join('; '),
      open_to_all: Core_str(a[Q.eOpen]) ? yes_(a[Q.eOpen]) : '',
    });
    appendRow_(ss, 'events', ev);
    alertContent_('events', ev);
    return;
  }
  var activities = readTab_(ss, 'activities');
  var partners = (a[Q.aPartners] || []).map(clubIdByName_).filter(function (id) { return id; });
  var row = Object.assign(sender, {
    id: nextId_(activities, 'ACT-' + new Date().getFullYear() + '-'),
    club_id: clubIdByName_(clubName), club_name: clubName,
    title: Core_str(a[Q.aTitle]), date: Core_str(a[Q.aDate]), theme: Core_str(a[Q.aTheme]), description: Core_str(a[Q.aDesc]),
    photo_files: fileIds_(firstStartingWith_(a, 'Photos')), post_link: link_(a[Q.aLink]),
    people_helped: Core_str(a[Q.aHelped]), amount_spent: Core_str(a[Q.aSpent]), partner_clubs: partners.join(', '),
    photo_consent: checked_(a[Q.aConsent]),
    avenue: Core_str(a[Q.aAvenue]), video_link: link_(a[Q.aVideo]),
    press_paper: Core_str(a[Q.aPressPaper]), press_date: Core_str(a[Q.aPressDate]), press_link: link_(a[Q.aPressLink]),
    district_level: Core_str(a[Q.aDistrict]) ? yes_(a[Q.aDistrict]) : '',
    // the two upload questions are added by hand; only the first file of each is used
    before_photo: fileIds_(firstStartingWith_(a, 'Before photo')), after_photo: fileIds_(firstStartingWith_(a, 'After photo')),
  });
  var campaignRows = readTab_(ss, 'campaigns');
  var count = Core_str(a[Q.aCampaignCount]).replace(/[,\s]/g, '');
  row.campaign_id = Core_campaignIdForLabel(a[Q.aCampaign], campaignRows);
  row.campaign_count = /^\d+$/.test(count) ? Number(count) : '';
  var notes = [];
  campaignNotes_(row, activities, campaignRows, notes);
  var dup = Core_findDuplicate(row, activities);
  if (dup) notes.push('Possible duplicate of ' + dup);
  if (!row.photo_files && !row.post_link) notes.push('No photo or link: reject or ask the club for one');
  if (Core_isoDate(row.date) > today_()) notes.push('Date is in the future');
  if (row.district_level === true) notes.push(DISTRICT_CHECK);
  if (row.before_photo || row.after_photo) {
    notes.push(row.before_photo && row.after_photo ? 'Before and after photos: check they show the same place, not people'
      : 'Only one of the before and after photos: it is not shown (both are needed)');
  }
  if (Core_looksLikeUrl(row.press_paper)) {
    // a web address typed as the newspaper's name: keep it as the link, and ask for the name
    if (!row.press_link) row.press_link = link_(row.press_paper);
    row.press_paper = '';
    notes.push('The newspaper name was a web address: it is now the newspaper link; please add the newspaper\'s name');
  } else if (row.press_link && !row.press_paper) notes.push('Press link without the newspaper\'s name: add it in press_paper');
  if (row.video_link && !Core_videoLink(row.video_link)) notes.push('Video link is not a web address');
  if (!row.club_id) notes.push('Club not recognised: fill in club_id before approving');
  if ((row.photo_files || row.before_photo || row.after_photo) && !row.photo_consent) notes.push('Photo consent not ticked');
  textNotes_([row.press_paper], notes);
  row.moderator_note = notes.join('; ');
  appendRow_(ss, 'activities', row);
  alertContent_('activities', row);
}

// The "District" mark puts an item first on the home page and in the bulletin, so a moderator checks it (owner, 17 Nov 2026)
var DISTRICT_CHECK = 'Marked as district level: check the district organised it or it was a district occasion (the Governor need not have been there); ' +
  'if not, change it before approving';

/** Notes for a campaign report: a count without a campaign, a date outside it, a large count, another club the same day. */
function campaignNotes_(row, activities, campaignRows, notes) {
  if (row.campaign_count !== '' && !row.campaign_id) notes.push('Count given without a campaign');
  if (!row.campaign_id) return;
  var c = Core_openCampaigns(campaignRows, '0000-00-00').filter(function (x) { return x.campaign_id === row.campaign_id; })[0];
  var date = Core_isoDate(row.date);
  if (c && !Core_inCampaign(c, date)) notes.push('Date is outside the campaign period: it will not count');
  var limit = Number(settings_().campaign_check_above) || 1000;
  if (row.campaign_count !== '' && row.campaign_count > limit) notes.push('Check the campaign count');
  var other = activities.filter(function (x) {
    return Core_str(x.campaign_id) === row.campaign_id && Core_isoDate(x.date) === date && Core_str(x.club_id) !== row.club_id &&
      Core_str(x.status).toLowerCase() !== 'rejected';
  })[0];
  if (other) {
    notes.push('Another club reported this campaign on the same date (' + other.id + ', ' + Core_str(other.club_name) +
      '): check it is not one joint event counted twice');
  }
}

/** Club updates (Release 2): the first answer says which section was filled; the old forms' filing does the rest. */
function fileClubUpdates_(a, meta) {
  var kind = Core_str(a[Q.uKind]);
  if (kind === CLUB_UPDATE_KINDS.profile) return fileClubProfile_(a, meta);
  if (kind === CLUB_UPDATE_KINDS.service) return filePublicService_(a, meta);
  var b = Object.assign({}, a);
  b[Q.cClub] = a[Q.club]; // the club changes section takes the club from page 1
  return fileClubChange_(b, meta);
}

/** My details on the website (Release 2): consent, removal or a business listing, with page 1's member details. */
function fileMyDetails_(a, meta) {
  var kind = Core_str(a[Q.mKind]);
  var b = Object.assign({}, a);
  if (kind === MY_DETAILS_KINDS.removal) {
    b[Q.rName] = a[Q.cName];
    return fileRemoval_(b, meta);
  }
  if (kind === MY_DETAILS_KINDS.business) {
    b[Q.club] = a[Q.cClub]; b[Q.name] = a[Q.cName]; b[Q.bMemberId] = a[Q.cMemberId]; b[Q.bMobile] = a[Q.cMobile];
    return fileBusiness_(b, meta);
  }
  return fileConsent_(a, meta);
}

/**
 * Release 2 (owner, 18 Nov 2026): a member's own update goes live by itself when the form came from the member's own
 * Google account, the email the members list holds for them. Sent by anyone else (or matched only by a typed mobile
 * number, which anyone could type) it waits for a Members moderator, as before.
 */
var AUTO_BY = 'automatic: sent from the member\'s own email';

function fileClubProfile_(a, meta) {
  var ss = mainSs_();
  var clubName = Core_str(a[Q.club]);
  var ans = function (t) { return Core_str(a[t + ' (optional)']); };
  var url = function (t) { return link_(a[t + ' (optional)']); };
  var projects = Core_str(a[Q.pProjects]);
  var services = Core_str(a[Q.pServices]);
  var notes = [];
  textNotes_([projects, services], notes);
  var req = {
    id: nextId_(readTab_(ss, 'club_profile_requests'), 'CPR-'), submitted_at: meta.submitted_at, submitter_email: meta.submitter_email,
    submitter_name: Core_str(a[Q.name]), submitter_role: Core_str(a[Q.role]), submitter_mobile: Core_str(a[Q.mobile]),
    club_id: clubIdByName_(clubName), club_name: clubName, website: url(Q.pWebsite), facebook: url(Q.pFacebook),
    instagram: url(Q.pInstagram), youtube: url(Q.pYoutube), x: url(Q.pX), linkedin: url(Q.pLinkedin),
    meeting_day_place: ans(Q.pMeeting), permanent_projects: projects, regular_services: services, status: 'pending',
    meeting_day: Core_str(a[Q.pMeetingDay]), moderator_note: notes.join('; '),
  };
  appendRow_(ss, 'club_profile_requests', req);
  alertContent_('club_profile_requests', req);
}

/** A facility the public can use: filed as pending, with notes on anything the moderator should check. */
function filePublicService_(a, meta) {
  var ss = mainSs_();
  var clubName = Core_str(a[Q.club]);
  var phone = Core_str(a[Q.sPhone]);
  var notes = [];
  if (!Core_servicePhone(phone)) notes.push('The phone number is not a plain number: correct it before approving');
  else if (Core_mobile(phone)) notes.push('The phone number is a mobile: check it is the facility\'s own number, not a member\'s');
  textNotes_([a[Q.sName], a[Q.sTimings], a[Q.sAddress], a[Q.sAbout]], notes);
  var service = {
    id: nextId_(readTab_(ss, 'public_services'), 'SRV-'), submitted_at: meta.submitted_at, submitter_email: meta.submitter_email,
    submitter_name: Core_str(a[Q.name]), submitter_role: Core_str(a[Q.role]), submitter_mobile: Core_str(a[Q.mobile]),
    club_id: clubIdByName_(clubName), club_name: clubName, name: Core_str(a[Q.sName]), service_type: Core_str(a[Q.sType]),
    timings: Core_str(a[Q.sTimings]), phone: phone, address: Core_str(a[Q.sAddress]), city: Core_str(a[Q.sCity]),
    map_link: link_(a[Q.sMap]), about: Core_str(a[Q.sAbout]), status: 'pending', moderator_note: notes.join('; '),
  };
  appendRow_(ss, 'public_services', service);
  alertContent_('public_services', service);
}

/**
 * Rotary Means Business: a member's own business, the topics they can speak on, or both. The sender is looked up
 * in the private members list now, so the moderator sees who it is; approving needs an active member (members only).
 */
function fileBusiness_(a, meta) {
  var ss = mainSs_();
  var clubName = Core_str(a[Q.club]);
  var whatsapp = Core_str(a[Q.bWhatsapp]);
  var row = {
    id: nextId_(readTab_(ss, 'businesses'), 'BIZ-'), submitted_at: meta.submitted_at, submitter_email: meta.submitter_email,
    submitter_name: Core_str(a[Q.name]), submitter_mobile: Core_str(a[Q.bMobile]), club_id: clubIdByName_(clubName), club_name: clubName,
    member_id: '', member_name: '', business_name: Core_str(a[Q.bName]), trade: Core_str(a[Q.bTrade]), city: Core_str(a[Q.bCity]),
    about: Core_str(a[Q.bAbout]), offer: Core_str(a[Q.bOffer]), website: link_(a[Q.bWebsite]), whatsapp: whatsapp,
    photo_files: fileIds_(firstStartingWith_(a, 'Logo')), speaker_topics: Core_str(a[Q.bTopics]), status: 'pending',
  };
  var notes = [];
  var master = readTab_(privateSs_(), 'members_master');
  var i = Core_matchMember({ member_id: Core_str(a[Q.bMemberId]), mobile: row.submitter_mobile, club_id: row.club_id,
    filled_by: Core_str(a[Q.cFilledBy]), submitter_email: meta.submitter_email }, master);
  var m = i >= 0 ? master[i] : null;
  if (m && businessMemberActive_(m)) {
    row.member_id = Core_str(m.member_id);
    row.member_name = Core_str(m.name);
    row.club_id = Core_str(m.club_id) || row.club_id;
    if (Core_str(m.email) && Core_str(m.email).toLowerCase() !== Core_str(meta.submitter_email).toLowerCase()) {
      notes.push("Not sent from the member's own email: check with the member before approving");
    }
  } else {
    notes.push(m ? 'The member is not active in the members list: members only' :
      'Not found in the members list: fill in member_id (and member_name) before approving, or reject (members only)');
  }
  if (!row.business_name && !row.speaker_topics) notes.push('Neither a business nor speaker topics: reject');
  if (row.business_name && (!row.trade || !row.city)) notes.push('Business without a trade or city: add them before approving');
  if (whatsapp && !Core_mobile(whatsapp)) notes.push('The WhatsApp number is not a mobile number: correct or clear it');
  textNotes_([row.business_name, row.about, row.offer, row.speaker_topics], notes);
  var older = businessOlder_(readTab_(ss, 'businesses'), row);
  if (older) notes.push('Updates ' + older.id + ': approving replaces it');
  row.moderator_note = notes.join('; ');
  row._row = appendRow_(ss, 'businesses', row);
  // the member's own listing from their own email, with nothing to check, goes live by itself (Release 2)
  var own = m && Core_str(m.email) && Core_str(m.email).toLowerCase() === Core_str(meta.submitter_email).toLowerCase();
  var onlyReplaces = notes.every(function (n) { return /^Updates BIZ-/.test(n); });
  if (own && onlyReplaces && !businessBlock_(row)) {
    approveRow_('businesses', row, AUTO_BY);
    return;
  }
  alertContent_('businesses', row);
}

/** An active Rotarian in the members list. */
function businessMemberActive_(m) {
  return !!m && Core_isTrue(m.is_rotarian) && Core_str(m.status || 'active').toLowerCase() === 'active';
}

/** The member's approved listing this row updates: the same business name, or both speaker-only. */
function businessOlder_(rows, row) {
  var key = function (r) { return Core_str(r.business_name).toLowerCase().replace(/[^a-z0-9]/g, ''); };
  if (!Core_str(row.member_id)) return null;
  return rows.filter(function (r) {
    return r.id !== row.id && Core_str(r.status) === 'approved' && Core_str(r.member_id) === Core_str(row.member_id) && key(r) === key(row);
  })[0] || null;
}

/**
 * A message from the website's contact form: kept in the private Sheet and emailed on to the District office
 * moderators. Pressing Reply answers the person directly when they gave an email; a mobile number gets a
 * WhatsApp link. Messages that look like spam, and any beyond the daily limit, are kept but not emailed.
 */
function fileContact_(a, meta) {
  var ps = privateSs_();
  var s = settings_();
  var message = Core_str(a[Q.kMessage]);
  var spam = Core_contactCheck(message);
  var today = today_();
  var limit = Number(s.contact_daily_limit) || CORE_CONTACT_DAILY_LIMIT;
  var sentToday = readTab_(ps, 'contact_messages').filter(function (m) {
    return Core_str(m.forwarded_to) && Core_isoDate(new Date(m.submitted_at)) === today;
  }).length;
  var to = moderatorRecipients_('District office', 'contact_email');
  var row = {
    id: nextId_(readTab_(ps, 'contact_messages'), 'MSG-'), submitted_at: meta.submitted_at, name: Core_str(a[Q.kName]),
    reply_to: Core_str(a[Q.kReply]), topic: Core_str(a[Q.kTopic]), city: Core_str(a[Q.kCity]), message: message,
    status: spam ? 'spam' : 'new', forwarded_to: '', note: spam ? 'Not emailed: ' + spam : '',
  };
  if (!spam && sentToday >= limit) row.note = 'Not emailed: more than ' + limit + ' messages today';
  if (!spam && sentToday < limit) {
    try {
      contactAlert_(row, to);
      row.forwarded_to = to;
    } catch (e) {
      row.note = 'Email failed: ' + e.message;
    }
  }
  appendRow_(ps, 'contact_messages', row);
}

/** Tells the District office moderators about a contact message (also used by the practice round). */
function contactAlert_(row, to) {
  var email = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(row.reply_to) ? row.reply_to : '';
  var mobile = Core_mobile(row.reply_to);
  MailApp.sendEmail(to, 'Website message: ' + row.topic + ' – from ' + row.name,
    'A message from the contact form on the district website.\n\nFrom: ' + row.name + '\nReply to: ' + row.reply_to +
    (row.city ? '\nCity: ' + row.city : '') + '\nAbout: ' + row.topic + '\n\n' + row.message + '\n\n' +
    (email ? 'Please answer from the moderation desk (Messages → Reply), not by pressing Reply here: the desk sends your answer from the ' +
        'district account, signed Rotary District 3110, so your own name and email stay private.'
      : mobile ? 'They gave a mobile number: +' + mobile + '. Please call or WhatsApp from the district office phone, not your personal phone.'
      : 'They gave no email or mobile number we can use.') +
    ' All messages are kept in the contact_messages tab of the private Sheet' + (deskLink_({}) ? ' and on the moderation desk: ' + deskLink_({}) : '.'),
    { name: 'Rotary 3110 website' }); // never replyTo the sender: a reply would show the moderator's own email
}

function fileConsent_(a, meta) {
  var ps = privateSs_();
  var spouseRotarian = yes_(a[Q.cSpouseRotarian]);
  var req = {
    id: nextId_(readTab_(ps, 'consent_requests'), 'CON-'), submitted_at: meta.submitted_at, submitter_email: meta.submitter_email,
    filled_by: Core_str(a[Q.cFilledBy]), club_id: clubIdByName_(a[Q.cClub]), name: Core_str(a[Q.cName]),
    member_id: Core_str(a[Q.cMemberId]), mobile: Core_str(a[Q.cMobile]),
    directory_ok: yes_(a[Q.cDirectory]), profession: Core_str(a[Q.cProfession]), area: Core_str(a[Q.cArea]),
    description: Core_str(a[Q.cWhat]), website: link_(a[Q.cWebsite]), spotlight_ok: checked_(a[Q.cSpotlight]),
    contact_ok: yes_(a[Q.cContact]), photo_ok: yes_(a[Q.cPhoto]), photo_file: fileIds_(firstStartingWith_(a, 'My photo')),
    birthday_ok: yes_(a[Q.cBirthday]), birthday: dayMonthAnswer_(a[Q.cBirthdayDate]),
    anniversary_ok: yes_(a[Q.cAnniversary]), spouse_is_rotarian: spouseRotarian ? 'Yes' : (Core_str(a[Q.cSpouseRotarian]) ? 'No' : ''),
    spouse_name: Core_str(a[Q.cSpouseName]), spouse_club_id: spouseRotarian ? clubIdByName_(a[Q.cSpouseClub]) : '',
    spouse_member_id: Core_str(a[Q.cSpouseId]), spouse_agrees: checked_(a[Q.cSpouseAgrees]),
    anniversary: dayMonthAnswer_(a[Q.cAnniversaryDate]), couple_photo_file: fileIds_(firstStartingWith_(a, 'Couple photo')),
    couple_photo_spouse_agrees: checked_(a[Q.cCoupleAgree]), declaration: checked_(a[Q.cDeclaration]), status: 'pending',
  };
  var row = appendRow_(ps, 'consent_requests', req);
  var notice = noticeMember_(ps, req);
  if (headers_(ps, 'consent_requests').indexOf('member_notice') >= 0) updateRow_(ps, 'consent_requests', row, { member_notice: notice });
  // from the member's own email, with the declaration ticked and no removal since: applied at once (Release 2)
  var check = consentChecker_(ps)(req);
  if (check.who === 'member' && req.declaration && !check.removal) {
    AFTER_FILING.push(function () {
      try {
        approveConsent_(req.id, AUTO_BY, false);
      } catch (e) {
        updateRow_(ps, 'consent_requests', row, { moderator_note: 'Not applied by itself: ' + e.message });
        alertMembers_('consent', req);
      }
    });
    return;
  }
  alertMembers_('consent', req);
}

/**
 * When a consent form did not come from the member's own email, the member hears about it at the email on file,
 * with time to object before anything is shown (safeguard, 1 Nov 2026). Returns what happened, for the moderator.
 */
function noticeMember_(ps, req) {
  var check = consentChecker_(ps)(req);
  if (check.who === 'member') return "Not needed: sent from the member's own email";
  if (!check.memberEmail) return 'Not told: no email on file';
  if (!deskQuota_(1)) return 'Not told: the daily email limit was reached';
  var choices = [
    [req.directory_ok, 'a listing in the members directory'], [req.contact_ok, 'a WhatsApp button'], [req.photo_ok, 'your photo'],
    [req.birthday_ok, 'birthday greetings'], [req.anniversary_ok, 'anniversary greetings'],
  ].filter(function (c) { return c[0]; }).map(function (c) { return '- ' + c[1]; });
  var until = Core_dateLabel(Core_isoDate(new Date(consentHoldUntil_(req, check))));
  try {
    MailApp.sendEmail(check.memberEmail, 'Your details were sent to the Rotary District 3110 website',
      'Dear ' + (check.memberName || req.name) + ',\n\nA member consent form was sent for you to the district website by ' + req.submitter_email +
      (req.filled_by ? ' (as "' + req.filled_by + '")' : '') + '.\n\nIt asks to show:\n' + (choices.join('\n') || '- nothing') +
      '\n\nIf you or your club sent it, there is nothing to do. A district moderator checks every form, and nothing is shown before ' + until + '.' +
      '\n\nIf you did not agree to this, reply to this email or use the removal form, and nothing will be shown.' + removalLine_() +
      '\n\nRotary District 3110', { name: 'Rotary District 3110' });
    return 'Told by email ' + today_();
  } catch (e) {
    Logger.log('Notice to the member failed: ' + e.message);
    return 'Not told: the email failed';
  }
}

/**
 * A club change (17 Nov 2026): kept in the private Sheet as pending; nothing changes until a Members moderator approves.
 * Anyone may send it, so no check of the sender; the moderator sees what the members list holds for the ID.
 */
function fileClubChange_(a, meta) {
  var ps = privateSs_();
  var said = Core_str(a[Q.gChange]);
  if (said === 'A club role: President or Secretary') said = CLUB_CHANGES.club_role; // the old form's wording
  var change = Object.keys(CLUB_CHANGES).filter(function (k) { return CLUB_CHANGES[k] === said; })[0] || '';
  var date = { joined: Q.gJoined, left: Q.gLeft, moved: Q.gMoved, deceased: Q.gDied }[change];
  var newClub = Core_str(a[Q.gNewClub]);
  var req = {
    id: nextId_(readTab_(ps, 'club_change_requests'), 'CHG-'), submitted_at: meta.submitted_at, submitter_email: meta.submitter_email,
    club_id: clubIdByName_(a[Q.cClub]), change: change, member_id: Core_str(a[Q.gMemberId]).replace(/\D/g, ''), name: Core_str(a[Q.rName]),
    date: date ? Core_str(a[date]) : '', new_club_id: change !== 'moved' ? '' : newClub === CLUB_OUTSIDE ? 'outside' : clubIdByName_(newClub),
    rotary_year: Core_str(a[change === 'club_role' ? Q.gClubYear : Q.gDistYear]), role: Core_str(a[change === 'club_role' ? Q.gClubRole : Q.gRole]),
    section: change === 'district_role' ? Core_str(a[Q.gTeam]) : '', committee: change === 'district_role' ? Core_str(a[Q.gCommittee]) : '',
    note: Core_str(a[Q.gNote]), status: 'pending',
    mobile: change === 'joined' ? Core_str(a[Q.gMobile]) : '', email: change === 'joined' ? Core_str(a[Q.gEmail]).trim().toLowerCase() : '',
  };
  if (change !== 'club_role' && change !== 'district_role') { req.rotary_year = ''; req.role = ''; }
  var notes = [];
  if (req.mobile && !Core_mobile(req.mobile)) notes.push('The new member\'s mobile is not a 10-digit mobile: it will not be saved');
  if (!change) notes.push('The kind of change was not recognised: ' + said);
  if (!req.club_id) notes.push('Club not recognised: ' + Core_str(a[Q.cClub]));
  if (change === 'moved' && newClub === CLUB_OUTSIDE) notes.push('Moved to a club outside District 3110: approving marks the member as left');
  else if (change === 'moved' && !req.new_club_id) notes.push('New club not recognised: ' + newClub);
  textNotes_([req.note], notes);
  req.moderator_note = notes.join('; ');
  appendRow_(ps, 'club_change_requests', req);
  alertMembers_('change', req);
}

function fileRemoval_(a, meta) {
  var ps = privateSs_();
  var req = {
    id: nextId_(readTab_(ps, 'removal_requests'), 'REM-'), submitted_at: meta.submitted_at, submitter_email: meta.submitter_email,
    club_id: clubIdByName_(a[Q.rClub]), name: Core_str(a[Q.rName]), member_id: Core_str(a[Q.rMemberId]),
    mobile: Core_str(a[Q.rMobile]), remove_items: (a[Q.rItems] || []).join(', '), reason: Core_str(a[Q.rReason]), status: 'pending',
    filled_by: Core_str(a[Q.cFilledBy]),
  };
  appendRow_(ps, 'removal_requests', req);
  // the member's own request from their own email is done at once (Release 2)
  var master = readTab_(ps, 'members_master');
  var i = Core_matchMember(req, master);
  if (i >= 0 && Core_str(master[i].email) && Core_str(master[i].email).toLowerCase() === Core_str(meta.submitter_email).toLowerCase()) {
    AFTER_FILING.push(function () {
      try {
        approveRemoval_(req.id, AUTO_BY);
      } catch (e) {
        Logger.log('Removal ' + req.id + ' not done by itself: ' + e.message);
        alertMembers_('removal', req);
      }
    });
    return;
  }
  alertMembers_('removal', req);
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
    .addItem('Member requests (consent, removal, club changes)…', 'openMemberRequests')
    .addItem('Mark as deceased…', 'markDeceased')
    .addItem('Refresh public members', 'refreshPublicMembers')
    .addSeparator()
    .addItem('Rebuild site now', 'requestRebuild')
    .addItem('Refresh dashboard', 'refreshDashboard')
    .addItem('Check roles and member IDs', 'checkRoles')
    .addItem('Update form lists (clubs, areas, professions)', 'updateFormLists')
    .addSeparator()
    // Load sample data and Reset for production left the menu after launch (17 Nov 2026); both stay in the script
    // for a test Sheet, run from the script editor
    .addSubMenu(SpreadsheetApp.getUi().createMenu('Sample data')
      .addItem('Clear all sample data…', 'clearSampleData'))
    .addSubMenu(SpreadsheetApp.getUi().createMenu('Administrator')
      .addItem('Show data link details', 'showDataLink')
      .addItem('Upgrade Sheet (new tabs, columns, questions)', 'upgradeSheet')
      .addItem('Delete the old forms and their answer tabs…', 'deleteOldForms')
      .addItem('Apply moderators (Sheet access)…', 'applyModerators')
      .addItem('Sign everyone out of the desk…', 'deskSignOutAll')
      .addItem('Send bulletin preview now', 'bulletinPreview')
      .addItem('Send bulletin message now', 'sendBulletinMessageNow')
      .addItem('Send clubs-not-posting email now', 'sendNotPostingNow')
      .addItem('Send weekly summary now', 'sendWeeklySummaryNow')
      .addItem('Send me a sample July member email', 'sendMemberCheckSample')
      .addItem('Back up both Sheets now', 'backupNow')
      .addItem('Start new Rotary year…', 'startNewRotaryYear')
      .addItem('Practice round: start…', 'startPractice')
      .addItem('Practice round: report', 'practiceReport')
      .addItem('Practice round: remove practice items…', 'removePractice')
      .addItem('Run setup again', 'setup'))
    .addToUi();
}

var MODERATED_TABS = ['activities', 'events', 'club_profile_requests', 'public_services', 'businesses'];

function selectedRows_() {
  var sh = SpreadsheetApp.getActiveSheet();
  var name = sh.getName();
  if (MODERATED_TABS.indexOf(name) < 0) {
    throw new Error('Select one or more rows in the activities, events, club_profile_requests, public_services or businesses tab first.');
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
  var who = moderatorEmail_();
  var done = [];
  var refused = [];
  sel.rows.forEach(function (r) {
    if (Core_str(r.status) === 'approved') return;
    var block = approveBlock_(sel.tab, r);
    if (block) { refused.push(r.id + ' (' + block + ')'); return; }
    approveRow_(sel.tab, r, who);
    done.push(r.id);
  });
  ui.alert((done.length ? 'Approved: ' + done.join(', ') + '.\nIt will appear on the website ' + NEXT_UPDATE + '.' : 'Nothing approved.') +
    (refused.length ? '\n\nNot approved: ' + refused.join('; ') : ''));
}

function rejectSelected() {
  var ui = SpreadsheetApp.getUi();
  var sel;
  try { sel = selectedRows_(); } catch (e) { ui.alert(e.message); return; }
  var answer = ui.prompt('Reject ' + sel.rows.length + ' row(s)', 'Reason (sent to the person who submitted it):', ui.ButtonSet.OK_CANCEL);
  if (answer.getSelectedButton() !== ui.Button.OK) return;
  var reason = answer.getResponseText().trim() || 'Not suitable for the website';
  var who = moderatorEmail_();
  sel.rows.forEach(function (r) { rejectRow_(sel.tab, r, who, reason); });
  ui.alert('Rejected ' + sel.rows.length + ' row(s).');
}

/** Why a row cannot be approved yet, or '' if it can. Shared by the Rotary menu and the moderation desk. */
function approveBlock_(tab, r) {
  if (tab === 'activities' && !Core_str(r.photo_files) && !Core_url(r.post_link)) return 'needs a photo or a link to the club\'s post';
  if ((tab === 'activities' || tab === 'public_services') && !Core_str(r.club_id)) return 'club not recognised: fill in club_id';
  if (tab === 'public_services' && !Core_servicePhone(r.phone)) return 'the phone number is not a plain number: correct it first';
  if (tab === 'businesses') return businessBlock_(r);
  return '';
}

/** Members only: a business listing needs an active member from the members list, and a business or speaker topics. */
function businessBlock_(r) {
  if (Core_isPractice(r)) return '';
  if (!Core_str(r.business_name) && !Core_str(r.speaker_topics)) return 'neither a business nor speaker topics';
  if (Core_str(r.business_name) && (!Core_str(r.trade) || !Core_str(r.city))) return 'the business needs a trade and a city';
  if (Core_str(r.whatsapp) && !Core_mobile(r.whatsapp)) return 'the WhatsApp number is not a mobile number: correct or clear it';
  var m = businessMember_(r);
  if (!m) return 'not found in the members list: fill in member_id (members only)';
  if (!businessMemberActive_(m)) return 'the member is not active in the members list (members only)';
  return '';
}

/** The members_master row a business listing belongs to (few listings wait at a time, so it is read each time). */
function businessMember_(r) {
  var id = Core_str(r.member_id);
  if (!id) return null;
  return readTab_(privateSs_(), 'members_master').filter(function (m) { return Core_str(m.member_id) === id; })[0] || null;
}

/** Approves one row (already checked with approveBlock_) and tells the sender. */
function approveRow_(tab, r, who) {
  updateRow_(mainSs_(), tab, r._row, { status: 'approved', approved_by: who, approved_at: nowIso_() });
  if (tab === 'club_profile_requests' && !Core_isPractice(r)) applyClubProfile_(r);
  if (tab === 'businesses' && !Core_isPractice(r)) applyBusiness_(r);
  if (!Core_isPractice(r)) contentChanged_();
  notifySubmitter_(tab, r, true, '');
}

function rejectRow_(tab, r, who, reason) {
  updateRow_(mainSs_(), tab, r._row, { status: 'rejected', approved_by: who, approved_at: nowIso_(), moderator_note: reason });
  notifySubmitter_(tab, r, false, reason);
}

/** The name and club come from the members list; a member's newer listing of the same business replaces the older one. */
function applyBusiness_(r) {
  var ss = mainSs_();
  var m = businessMember_(r);
  if (m) updateRow_(ss, 'businesses', r._row, { member_name: Core_str(m.name), club_id: Core_str(m.club_id) || Core_str(r.club_id) });
  var older = businessOlder_(readTab_(ss, 'businesses'), r);
  while (older) {
    updateRow_(ss, 'businesses', older._row, { status: 'replaced', moderator_note: (Core_str(older.moderator_note) + '; Replaced by ' + r.id).replace(/^; /, '') });
    older = businessOlder_(readTab_(ss, 'businesses'), r);
  }
}

function applyClubProfile_(r) {
  var ss = mainSs_();
  var club = readTab_(ss, 'clubs').filter(function (c) { return Core_str(c.club_id) === Core_str(r.club_id); })[0];
  if (!club) return;
  var fields = { profile_updated_at: nowIso_() };
  ['website', 'facebook', 'instagram', 'youtube', 'x', 'linkedin', 'meeting_day_place', 'meeting_day'].forEach(function (k) {
    if (Core_str(r[k])) fields[k] = Core_str(r[k]);
  });
  // Projects and services: a blank answer keeps the club's list, "none" clears it, anything else replaces it
  ['permanent_projects', 'regular_services'].forEach(function (k) {
    var v = Core_str(r[k]);
    if (v) fields[k] = v.toLowerCase() === 'none' ? '' : v;
  });
  updateRow_(ss, 'clubs', club._row, fields);
}

function notifySubmitter_(tab, r, approved, reason) {
  var to = Core_str(r.submitter_email);
  if (!to || Core_isTrue(r.is_sample)) return;
  var site = Core_str(settings_().site_url);
  var what = tab === 'events' ? 'event "' + r.title + '"' : tab === 'activities' ? 'activity "' + r.title + '"'
    : tab === 'public_services' ? 'public service "' + r.name + '"'
    : tab === 'businesses' ? 'business listing' + (Core_str(r.business_name) ? ' "' + r.business_name + '"' : ' (speaker topics)') : 'club profile update';
  var link = tab === 'activities' ? site + 'activities/' + Core_str(r.id).toLowerCase() + '/'
    : tab === 'events' ? site + 'events/' + Core_str(r.id).toLowerCase() + '/' : tab === 'public_services' ? site + 'services/'
    : tab === 'businesses' ? site + 'rmb/' : site + 'clubs/';
  var body = approved
    ? 'Thank you! Your ' + what + ' has been approved by a district moderator.\n\nIt will appear on the district website ' + NEXT_UPDATE + ':\n' + link +
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

/**
 * Administrator → Apply moderators: gives every active moderator edit access to the main Sheet, and Members and
 * Administrator moderators the private members Sheet too; removes access from people the tab lists as inactive.
 * Shows the changes and asks first. Only the owner of the Sheet may run it. When Google is slow, each step is
 * tried again; anyone it still could not change is listed at the end, and running it again finishes the job.
 */
function applyModerators() {
  var ui = SpreadsheetApp.getUi();
  var main = mainSs_();
  var priv = privateSs_();
  // the Sheet itself knows its owner; asking Drive is slower and is what timed out on 19 Oct
  var owner = retry_(function () { var o = main.getOwner(); return o ? o.getEmail() : DriveApp.getFileById(main.getId()).getOwner().getEmail(); });
  if (Core_str(Session.getActiveUser().getEmail()).toLowerCase() !== Core_str(owner).toLowerCase()) {
    ui.alert('Only the owner of the Sheet can change who has access.');
    return;
  }
  var emails = function (ss) { return retry_(function () { return ss.getEditors(); }).map(function (u) { return u.getEmail(); }); };
  var plan = Core_moderatorAccess(readTab_(main, 'moderators'), owner, emails(main), emails(priv));
  var lines = [];
  if (plan.addMain.length) lines.push('Give access to this Sheet: ' + plan.addMain.join(', '));
  if (plan.removeMain.length) lines.push('Remove access to this Sheet: ' + plan.removeMain.join(', '));
  if (plan.addPrivate.length) lines.push('Give access to the private members Sheet: ' + plan.addPrivate.join(', '));
  if (plan.removePrivate.length) lines.push('Remove access to the private members Sheet: ' + plan.removePrivate.join(', '));
  if (!lines.length) { ui.alert('Access already matches the moderators tab.'); return; }
  if (ui.alert('Apply moderators', lines.join('\n\n') + '\n\nGo ahead?', ui.ButtonSet.YES_NO) !== ui.Button.YES) return;
  var failed = [];
  var step = function (list, what, fn) {
    list.forEach(function (e) {
      try { retry_(function () { fn(e); }); } catch (err) { failed.push(what + ' ' + e + ' (' + err.message + ')'); }
    });
  };
  step(plan.addMain, 'Give this Sheet to', function (e) { main.addEditor(e); });
  step(plan.removeMain, 'Remove this Sheet from', function (e) { main.removeEditor(e); });
  step(plan.addPrivate, 'Give the private members Sheet to', function (e) { priv.addEditor(e); });
  step(plan.removePrivate, 'Remove the private members Sheet from', function (e) { priv.removeEditor(e); });
  ui.alert(failed.length
    ? 'Done, except (Google did not answer in time; run Apply moderators again to finish):\n\n' + failed.join('\n')
    : 'Done. Google emails each new moderator a link to the Sheet.');
  plan.failed = failed;
  return plan;
}

/**
 * Something approved, hidden, removed or changed: the website takes it at its next scheduled update (9 am, 1 pm,
 * 6 pm, 10 pm India time), together with everything else changed since the last one (owner, 18 Nov 2026).
 */
function contentChanged_() {
  setSetting_('content_changed_at', nowIso_());
}

/** Rotary -> Rebuild site now: for an emergency, the website rebuilds within about 30 minutes instead of at the next update. */
function requestRebuild() {
  setSetting_('rebuild_requested_at', nowIso_());
  try {
    SpreadsheetApp.getUi().alert('Done. The website will update within about 30 minutes.');
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
  return memberRequests_(true);
}

/** The pending member requests; the sidebar gets the photos as pictures, the moderation desk only their references. */
function memberRequests_(withThumbs) {
  var ps = privateSs_();
  var master = readTab_(ps, 'members_master');
  var clubName = function (id) { return clubNameById_(id) || id || '–'; };
  var describe = function (r) {
    var i = Core_matchMember(r, master);
    return i >= 0 ? 'Matches ' + master[i].name + ' (' + master[i].member_id + ')' : 'No matching member – a new record will be created';
  };
  var thumb = function (ref) {
    if (!withThumbs) return '';
    var id = Core_str(ref).replace(/^drive:/, '').split(',')[0].trim();
    if (!id) return '';
    try {
      var blob = DriveApp.getFileById(id).getThumbnail();
      return blob ? 'data:image/png;base64,' + Utilities.base64Encode(blob.getBytes()) : '';
    } catch (e) { return ''; }
  };
  var sender = consentChecker_(ps, master);
  var consent = readTab_(ps, 'consent_requests').filter(function (r) { return Core_str(r.status) === 'pending'; }).map(function (r) {
    var check = Core_isPractice(r) ? { who: 'member', warnings: [] } : sender(r);
    var hold = consentHoldUntil_(r, check);
    return {
      id: r.id, name: r.name, club: clubName(r.club_id), filledBy: r.filled_by, match: describe(r), submitted: Core_isoTimestamp(r.submitted_at),
      sentFrom: Core_str(r.submitter_email), sender: CONSENT_SENDERS[check.who], memberNotice: Core_str(r.member_notice),
      holdUntil: hold > Date.now() ? new Date(hold).toISOString() : '', needsConfirm: check.who === 'other', blocked: !!check.removal,
      choices: [
        r.directory_ok ? 'Directory: ' + [r.profession, r.area].filter(String).join(', ') : '',
        r.contact_ok ? 'WhatsApp button' : '',
        r.photo_ok ? 'Photo' : '',
        r.birthday_ok ? 'Birthday ' + r.birthday : '',
        r.anniversary_ok ? 'Anniversary ' + r.anniversary + ' with ' + (r.spouse_name || '?') + (r.spouse_is_rotarian === 'Yes' ? ' (Rotarian, ' + clubName(r.spouse_club_id) + ')' : '') : '',
      ].filter(String),
      description: r.description, website: r.website, photo: thumb(r.photo_file), couplePhoto: thumb(r.couple_photo_file),
      photoRef: Core_str(r.photo_file).split(',')[0].trim(), couplePhotoRef: Core_str(r.couple_photo_file).split(',')[0].trim(),
      warnings: check.warnings.concat([
        r.declaration ? '' : 'Declaration not ticked',
        r.anniversary_ok && r.spouse_is_rotarian !== 'Yes' && !r.spouse_agrees ? 'Spouse agreement not ticked' : '',
        r.directory_ok && !r.profession ? 'No profession given' : '',
      ]).filter(String),
    };
  });
  var removal = readTab_(ps, 'removal_requests').filter(function (r) { return Core_str(r.status) === 'pending'; }).map(function (r) {
    return { id: r.id, name: r.name, club: clubName(r.club_id), items: r.remove_items, reason: r.reason, match: describe(r), submitted: Core_isoTimestamp(r.submitted_at) };
  });
  var waiting = readTab_(ps, 'couples').filter(function (c) { return ['awaiting_spouse', 'check_dates'].indexOf(Core_str(c.status)) >= 0; }).map(function (c) {
    var name = function (id) { var m = master.filter(function (x) { return Core_str(x.member_id) === Core_str(id); })[0]; return m ? m.name : id; };
    return { id: c.couple_id, names: name(c.person_a_id) + ' & ' + name(c.person_b_id), status: c.status, notes: c.notes };
  });
  var change = readTab_(ps, 'club_change_requests').filter(function (r) { return Core_str(r.status) === 'pending'; }).map(function (r) {
    return clubChangeCard_(r, master);
  });
  return { consent: consent, removal: removal, change: change, waiting: waiting };
}

/* ---------------- Club changes (17 Nov 2026) ---------------- */

/** What a moderator sees of one club change: the request, and beside it what the members list holds for that ID now. */
function clubChangeCard_(r, master) {
  var club = function (id) { return clubNameById_(id) || Core_str(id) || '–'; };
  var m = clubChangeMember_(r, master);
  var lines = [];
  var add = function (label, value) { if (Core_str(value)) lines.push([label, Core_str(value)]); };
  add('Rotary member ID', r.member_id);
  add('Date', Core_isoDate(r.date) || r.date);
  if (r.change === 'moved') add('New club', r.new_club_id === 'outside' ? CLUB_OUTSIDE : club(r.new_club_id));
  add('Rotary year', r.rotary_year);
  add('Role', r.role);
  add('Team', r.section);
  add('Committee', r.committee);
  return {
    id: Core_str(r.id), submitted: Core_isoTimestamp(r.submitted_at), name: Core_str(r.name), club: club(r.club_id), kind: Core_str(r.change),
    change: CLUB_CHANGES[r.change] || Core_str(r.change), lines: lines, note: Core_str(r.note), sentFrom: Core_str(r.submitter_email),
    now: m ? 'Members list: ' + Core_str(m.name) + ', ' + club(m.club_id) + ', ' + (Core_str(m.status) || 'active') : 'Not in the members list',
    warnings: Core_str(r.moderator_note) ? Core_str(r.moderator_note).split('; ') : [],
  };
}

function clubChangeMember_(r, master) {
  var id = Core_str(r.member_id);
  return id ? master.filter(function (m) { return Core_str(m.member_id) === id; })[0] || null : null;
}

/** Called by the sidebar: approve a club change. */
function approveClubChange(requestId, confirmed) {
  return approveClubChange_(requestId, moderatorEmail_(), confirmed === true);
}

/**
 * Makes the change a club sent: the members list and club history for a member who joined, left, moved or passed away
 * (passing away goes through markDeceased_), or a new officers or functionaries row for a role. Then the public members
 * list and the role check are refreshed, a rebuild is asked for, and the sender is told.
 */
function approveClubChange_(requestId, who, confirmed) {
  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    var ps = privateSs_();
    var req = readTab_(ps, 'club_change_requests').filter(function (r) { return r.id === requestId; })[0];
    if (!req || Core_str(req.status) !== 'pending') throw new Error('Request ' + requestId + ' is not pending.');
    var done = { status: 'approved', approved_by: who, approved_at: nowIso_() };
    if (Core_isPractice(req)) {
      updateRow_(ps, 'club_change_requests', req._row, done);
      return 'Practice: approved. Nothing was changed.';
    }
    var change = Core_str(req.change);
    // anyone can send the form, and the club cannot undo a passing away: the moderator confirms first (Release 1)
    if (change === 'deceased' && confirmed !== true) {
      throw new Error('Please confirm with the club that this member has passed away, tick "I have confirmed this with the club", then approve.');
    }
    var id = Core_str(req.member_id);
    if (!id) throw new Error('The request has no Rotary member ID: fill in member_id on the request, or reject it.');
    var m = clubChangeMember_(req, readTab_(ps, 'members_master'));
    var when = Core_isoDate(req.date) || today_();
    var note = 'Club change ' + requestId;
    var message;
    if (change === 'joined') {
      if (!Core_str(req.club_id)) throw new Error('The club was not recognised: fill in club_id on the request, or reject it.');
      if (m && Core_str(m.status) === 'deceased') throw new Error(m.name + ' is marked as deceased in the members list: check the member ID.');
      if (m) {
        if (Core_str(m.club_id) === Core_str(req.club_id) && Core_str(m.status || 'active') === 'active') {
          throw new Error(m.name + ' is already an active member of this club: reject this request.');
        }
        clubChangeMove_(ps, m, req.club_id, when, 'joined (' + note + ')', Object.assign({ status: 'active' }, joinedContact_(req)));
        message = m.name + ' is now recorded in ' + clubNameById_(req.club_id) + '.';
      } else {
        appendRow_(ps, 'members_master', Object.assign({ member_id: id, name: Core_str(req.name), club_id: Core_str(req.club_id), is_rotarian: true, status: 'active',
          notes: 'Added from ' + note + ' (' + today_() + ')' }, joinedContact_(req)));
        appendRow_(ps, 'club_history', { member_id: id, club_id: Core_str(req.club_id), from_date: when, reason: 'joined (' + note + ')' });
        message = Core_str(req.name) + ' is added to the members list.';
      }
    } else if (change === 'left' || change === 'moved' || change === 'deceased') {
      if (!m) throw new Error('No one with member ID ' + id + ' in the members list: check the ID, or reject this request.');
      if (Core_str(m.status) === 'deceased') throw new Error(m.name + ' is already marked as deceased.');
      if (change === 'deceased') {
        markDeceased_(m, who);
        message = m.name + ' is marked as deceased. Greetings stop at once.';
      } else if (change === 'moved' && Core_str(req.new_club_id) !== 'outside') {
        if (!clubNameById_(req.new_club_id)) throw new Error('The new club was not recognised: fill in new_club_id on the request, or reject it.');
        clubChangeMove_(ps, m, req.new_club_id, when, 'moved (' + note + ')', {});
        message = m.name + ' is now recorded in ' + clubNameById_(req.new_club_id) + '.';
      } else {
        var why = change === 'moved' ? 'moved out of District 3110' : 'left';
        updateRow_(ps, 'members_master', m._row, { status: 'left', notes: (Core_str(m.notes) + ' | Left ' + when + ' (' + note + ')').replace(/^ \| /, '') });
        clubChangeEndHistory_(ps, id, when, why + ' (' + note + ')');
        message = m.name + ' is marked as left.';
      }
    } else if (change === 'club_role' || change === 'district_role') {
      if (!Core_str(req.rotary_year) || !Core_str(req.role)) throw new Error('The request has no Rotary year or role: fill them in on the request, or reject it.');
      var name = m ? Core_str(m.name) : Core_str(req.name);
      if (change === 'club_role') {
        if (!Core_str(req.club_id)) throw new Error('The club was not recognised: fill in club_id on the request, or reject it.');
        appendRow_(mainSs_(), 'officers', { rotary_year: req.rotary_year, club_id: req.club_id, member_id: id, name: name, role: req.role, contact_ok: false });
      } else {
        if (!Core_str(req.section)) throw new Error('The request has no district team: fill in section on the request, or reject it.');
        appendRow_(mainSs_(), 'functionaries', clubChangeRoleRow_(req, m, name));
      }
      message = name + ' is added as ' + req.role + ' (' + req.rotary_year + ').' + (m ? '' : ' Not in the members list, so there is no member card until they are.');
    } else {
      throw new Error('This request does not say what changed: reject it.');
    }
    updateRow_(ps, 'club_change_requests', req._row, done);
    refreshPublicMembers(true);
    refreshMemberCounts_();
    try { checkRoles(true); } catch (e) { Logger.log('Role check not run: ' + e.message); }
    contentChanged_();
    notifyMember_(req, 'Approved: ' + (CLUB_CHANGES[change] || 'club change') + ' – ' + Core_str(req.name),
      'Thank you. The change you sent to the district (' + (CLUB_CHANGES[change] || change).toLowerCase() + ': ' + Core_str(req.name) +
      ') has been approved by a district moderator.\n\nThe website shows it ' + NEXT_UPDATE + '.');
    return 'Approved ' + requestId + '. ' + message + ' The website shows it ' + NEXT_UPDATE + '.';
  } finally {
    lock.releaseLock();
  }
}

/** A new member's mobile and email from the club changes form (Release 2), when given and valid. */
function joinedContact_(req) {
  var out = {};
  if (Core_mobile(req.mobile)) out.mobile = Core_str(req.mobile);
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(Core_str(req.email))) out.email = Core_str(req.email);
  return out;
}

/** A member recorded in another club from a date: the open club history row ends, a new one starts, and club_id changes. */
function clubChangeMove_(ps, m, clubId, from, reason, fields) {
  clubChangeEndHistory_(ps, m.member_id, from, reason);
  appendRow_(ps, 'club_history', { member_id: Core_str(m.member_id), club_id: Core_str(clubId), from_date: from, reason: reason });
  fields.club_id = Core_str(clubId);
  updateRow_(ps, 'members_master', m._row, fields);
}

function clubChangeEndHistory_(ps, memberId, to, reason) {
  readTab_(ps, 'club_history').forEach(function (h) {
    if (Core_str(h.member_id) === Core_str(memberId) && !Core_str(h.to_date)) updateRow_(ps, 'club_history', h._row, { to_date: to, reason: reason });
  });
}

/** A functionaries row for a district role: on the page its team is already shown on, after the team's other rows. */
function clubChangeRoleRow_(req, m, name) {
  var rows = readTab_(mainSs_(), 'functionaries');
  var same = rows.filter(function (f) { return Core_str(f.section) === Core_str(req.section); });
  var leadership = ['College of Governors', 'District Counsellors', 'Assistant Governors', "Governor's Office Team"];
  var page = same.length ? Core_str(same[0].page) : leadership.indexOf(Core_str(req.section)) >= 0 ? 'leadership' : 'teams';
  var order = same.filter(function (f) { return Core_str(f.rotary_year) === Core_str(req.rotary_year); })
    .reduce(function (max, f) { return Math.max(max, Number(f.sort_order) || 0); }, 0);
  return { rotary_year: req.rotary_year, page: page, section: req.section, committee: Core_str(req.committee), member_id: Core_str(req.member_id),
    name: name, role: req.role, club_id: m ? Core_str(m.club_id) : Core_str(req.club_id), sort_order: order + 1, contact_ok: false };
}

var CONSENT_SENDERS = { member: "The member's own email", officer: 'An office bearer of the club', other: 'Not the member or a club office bearer' };

/**
 * Safeguards against a consent form sent for someone without their agreement (1 Nov 2026): who sent it, judged
 * against the members list and this year's office bearers. Returns a function of one consent request.
 */
function consentChecker_(ps, master) {
  master = master || readTab_(ps, 'members_master');
  var year = Core_str(settings_().current_rotary_year);
  var officers = readTab_(mainSs_(), 'officers').filter(function (o) { return !year || Core_str(o.rotary_year) === year; });
  var removals = readTab_(ps, 'removal_requests');
  return function (req) { return Core_consentSender(req, master, officers, removals); };
}

/** Until when a request waits for the member to object (0 when it came from the member's own email). */
function consentHoldUntil_(req, check) {
  if (check.who === 'member') return 0;
  var sent = new Date(req.submitted_at).getTime();
  return isNaN(sent) ? 0 : sent + CONFIG.CONSENT_HOLD_DAYS * 86400000;
}

/** Called by the sidebar: approve a consent request (confirmed: the moderator checked with the member or their club). */
function approveConsent(requestId, confirmed) {
  return approveConsent_(requestId, moderatorEmail_(), confirmed);
}

function approveConsent_(requestId, who, confirmed) {
  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    var ps = privateSs_();
    var req = readTab_(ps, 'consent_requests').filter(function (r) { return r.id === requestId; })[0];
    if (!req || Core_str(req.status) !== 'pending') throw new Error('Request ' + requestId + ' is not pending.');
    if (!Core_isTrue(req.declaration)) throw new Error('The declaration was not ticked; reject and ask the member to send the form again.');
    if (Core_isPractice(req)) {
      updateRow_(ps, 'consent_requests', req._row, { status: 'approved', approved_by: who, approved_at: nowIso_() });
      return 'Practice: approved. Nothing was changed in the members list.';
    }
    var check = consentChecker_(ps)(req);
    if (check.removal) throw new Error('The member asked to remove their details after this form was sent (' + check.removal + '); reject this form.');
    if (check.who === 'other' && !confirmed) {
      throw new Error('This form did not come from the member or an office bearer of their club. Check with the member (or their club President ' +
        'or Secretary) first, then tick "I have confirmed this with the member" and approve.');
    }
    var hold = consentHoldUntil_(req, check);
    if (!confirmed && hold > Date.now()) {
      throw new Error('The member has until ' + Core_dateLabel(Core_isoDate(new Date(hold))) + ' to object to this form. Approve after that, ' +
        'or check with the member now and tick "I have confirmed this with the member".');
    }
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

    var done = { status: 'approved', matched_member_id: member.member_id, approved_by: who, approved_at: nowIso_() };
    if (confirmed) done.moderator_note = 'Confirmed with the member or their club by ' + who;
    updateRow_(ps, 'consent_requests', req._row, done);
    refreshPublicMembers(true);
    contentChanged_();
    notifyMember_(req, 'Listed: ' + member.name, 'Thank you. The listing for ' + member.name + ' on the Rotary District 3110 website has been approved, ' +
      'with only the details that were ticked on the form.\n\nIt will appear ' + NEXT_UPDATE + ':\n' + siteUrl_() + 'directory/' +
      removalLine_());
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
  return approveRemoval_(requestId, moderatorEmail_());
}

function approveRemoval_(requestId, who) {
  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    var ps = privateSs_();
    var req = readTab_(ps, 'removal_requests').filter(function (r) { return r.id === requestId; })[0];
    if (!req || Core_str(req.status) !== 'pending') throw new Error('Request ' + requestId + ' is not pending.');
    if (Core_isPractice(req)) {
      updateRow_(ps, 'removal_requests', req._row, { status: 'approved', approved_by: who, approved_at: nowIso_() });
      return 'Practice: done. Nothing was removed.';
    }
    var master = readTab_(ps, 'members_master');
    var i = Core_matchMember(req, master);
    if (i < 0) throw new Error('No member matches this request. Find the member on the desk (Find a member) and fill in their RI member ID (member_id) on the request.');
    var m = master[i];
    var items = Core_str(req.remove_items).toLowerCase();
    var all = items.indexOf('everything') >= 0;
    var f = {};
    if (all || items.indexOf('directory') >= 0) { f.directory_ok = false; f.contact_ok = false; f.profession = ''; f.description = ''; f.website = ''; f.spotlight_ok = false; }
    if (all || items.indexOf('whatsapp') >= 0) f.contact_ok = false;
    if (all || items.indexOf('my photo') >= 0) { f.photo_ok = false; if (Core_str(m.photo_file)) trashRef_(m.photo_file); f.photo_file = ''; f.photo_approved = false; }
    if (all || items.indexOf('birthday') >= 0) f.birthday_ok = false;
    if (all || items.indexOf('business') >= 0) removeBusinesses_(m.member_id, requestId);
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
    updateRow_(ps, 'removal_requests', req._row, { status: 'approved', matched_member_id: m.member_id, approved_by: who, approved_at: nowIso_() });
    refreshPublicMembers(true);
    contentChanged_(); // removals go in the next of the four daily updates (owner, 18 Nov 2026)
    notifyMember_(req, 'Removed: ' + m.name, 'The details you asked us to remove for ' + m.name + ' (' + Core_str(req.remove_items) + ') have been removed ' +
      'from the Rotary District 3110 website records.\n\nThe website drops them ' + NEXT_UPDATE + '. Search engines may take a few days ' +
      'longer to forget a page they had already seen.');
    return 'Removed for ' + m.name + '. The website drops them ' + NEXT_UPDATE + '.';
  } finally {
    lock.releaseLock();
  }
}

/** A member's Rotary Means Business listings come off the website (the rows stay, marked removed). */
function removeBusinesses_(memberId, requestId) {
  var ss = mainSs_();
  readTab_(ss, 'businesses').forEach(function (b) {
    if (Core_str(b.member_id) !== Core_str(memberId) || ['approved', 'pending'].indexOf(Core_str(b.status)) < 0) return;
    if (Core_str(b.photo_files)) trashRef_(b.photo_files);
    updateRow_(ss, 'businesses', b._row, { status: 'removed', photo_files: '',
      moderator_note: (Core_str(b.moderator_note) + '; Removed at the member\'s request (' + requestId + ')').replace(/^; /, '') });
  });
}

/** Called by the sidebar: reject a consent or removal request. */
function rejectRequest(kind, requestId, reason) {
  return rejectRequest_(kind, requestId, reason, moderatorEmail_());
}

function rejectRequest_(kind, requestId, reason, who) {
  var ps = privateSs_();
  var tab = kind === 'removal' ? 'removal_requests' : kind === 'change' ? 'club_change_requests' : 'consent_requests';
  var req = readTab_(ps, tab).filter(function (r) { return r.id === requestId; })[0];
  if (!req) throw new Error('Request not found');
  updateRow_(ps, tab, req._row, { status: 'rejected', moderator_note: reason || '', approved_by: who, approved_at: nowIso_() });
  var what = kind === 'removal' ? 'request to remove details for ' + req.name
    : kind === 'change' ? 'club change for ' + req.name : 'consent form for ' + req.name;
  notifyMember_(req, 'Not done yet: ' + what, 'Thank you for sending the ' + what + '. A district moderator could not act on it this time.' +
    (Core_str(reason) ? '\n\nReason: ' + reason : '') + '\n\nYou are welcome to send the form again with the changes.');
  return 'Rejected ' + requestId;
}

/** Confirmation email to whoever sent the consent or removal form (sample rows and forms without an email are skipped). */
function notifyMember_(req, subject, body) {
  var to = Core_str(req.submitter_email);
  if (!to || Core_isTrue(req.is_sample)) return;
  try {
    MailApp.sendEmail(to, subject, body + '\n\nRotary District 3110');
  } catch (e) {
    Logger.log('Email to ' + to + ' failed: ' + e.message);
  }
}

function siteUrl_() {
  return Core_str(settings_().site_url).replace(/\/?$/, '/');
}

function removalLine_() {
  var form = Core_str(settings_().form_removal_url);
  return '\n\nTo change or remove these details at any time, use this form' + (form ? ':\n' + form : ' (linked from the website\'s Privacy page).');
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
  markDeceased_(m, moderatorEmail_());
  ui.alert(m.name + ' is marked as deceased. Greetings stop at once; the website shows it ' + NEXT_UPDATE + '.');
}

/** Stops greetings for one members_master row at once; shared by the menu and the moderation desk. */
function markDeceased_(m, who) {
  var ps = privateSs_();
  var id = Core_str(m.member_id);
  updateRow_(ps, 'members_master', m._row, { status: 'deceased', notes: (Core_str(m.notes) + ' | Marked deceased ' + today_() + ' by ' + who).replace(/^ \| /, '') });
  readTab_(ps, 'club_history').forEach(function (h) {
    if (Core_str(h.member_id) === id && !Core_str(h.to_date)) updateRow_(ps, 'club_history', h._row, { to_date: today_(), reason: 'deceased' });
  });
  refreshPublicMembers(true);
  refreshMemberCounts_();
  contentChanged_();
}

/**
 * Each club's member count: the active Rotarians in the private members list (Release 1), so nobody types it. Clubs
 * with no one in the list keep the count they have. One write for the whole column.
 */
function refreshMemberCounts_() {
  var ss = mainSs_();
  var sh = ss.getSheetByName('clubs');
  var headers = headers_(ss, 'clubs');
  var col = headers.indexOf('member_count');
  var idCol = headers.indexOf('club_id');
  if (!sh || col < 0 || idCol < 0 || sh.getLastRow() < 2) return 0;
  var counts = Core_memberCounts(readTab_(privateSs_(), 'members_master'));
  var range = sh.getRange(2, col + 1, sh.getLastRow() - 1, 1);
  var ids = sh.getRange(2, idCol + 1, sh.getLastRow() - 1, 1).getValues();
  var values = range.getValues();
  var changed = 0;
  var next = values.map(function (v, i) {
    var n = counts[Core_str(ids[i][0])];
    if (n == null || Number(v[0]) === n) return [v[0]];
    changed++;
    return [n];
  });
  if (changed) range.setValues(next);
  return changed;
}


// ===== Endpoint.js =====
/**
 * The protected data link the website build reads (Deploy → Web app, execute as me, anyone can open).
 * Without the right token it returns nothing. It only ever returns approved rows and public fields,
 * and refuses to answer if the privacy check fails.
 *
 *   ?mode=status&token=…        when a rebuild was last requested, and when anything was last approved or changed
 *   ?mode=data&token=…          the public website data
 *   ?mode=file&id=…&token=…     one approved photo (base64)
 *   ?mode=thumb&id=…&token=…    the first-page picture of a magazine PDF
 *
 * POST requests come from the moderation desk (Desk.js).
 */

function doGet(e) {
  var p = (e && e.parameter) || {};
  try {
    var expected = props_().getProperty('DATA_TOKEN');
    if (!expected || p.token !== expected) return json_({ ok: false, error: 'not allowed' });
    rememberWebAppUrl_(); // the moderation desk's links need the /exec address
    if (p.mode === 'status') {
      var st = settings_();
      return json_({ ok: true, rebuild_requested_at: Core_isoTimestamp(st.rebuild_requested_at), content_changed_at: Core_isoTimestamp(st.content_changed_at) });
    }
    if (p.mode === 'data') {
      var data = publicData_();
      data.desk_api_fp = deskApiFingerprint_();
      return json_({ ok: true, data: data });
    }
    if (p.mode === 'file' || p.mode === 'thumb') return json_(fileFor_(p.mode, p.id));
    return json_({ ok: false, error: 'unknown mode' });
  } catch (err) {
    // the full message stays in the Apps Script log; the build gets a short one without long IDs, enough to diagnose
    Logger.log('Data link stopped: ' + (err && err.stack || err));
    return json_({ ok: false, error: Core_safeError(err) });
  }
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function publicData_() {
  scanMagazines_();
  var ss = mainSs_();
  var tabs = {};
  ['settings', 'clubs', 'officers', 'functionaries', 'activities', 'events', 'magazines', 'messages', 'spotlights', 'members_public', 'couples_public',
    'campaigns', 'public_services', 'businesses', 'profiles', 'past_governors']
    .forEach(function (name) { tabs[name] = readTab_(ss, name); });
  var data = Core_buildPublicData(tabs, nowIso_(), { personRef: personRefFn_(), inactiveIds: inactiveMemberIds_() });
  var problems = Core_validatePublic(data);
  if (problems.length) throw new Error('privacy check failed: ' + problems.slice(0, 5).join(' | '));
  // remember which Drive files may be handed out, for the file mode below
  var allowed = {};
  Core_walk(data, '', function (path, v) {
    if (typeof v === 'string' && /^(drive|thumb):/.test(v)) allowed[v] = true;
  });
  putAllowedFiles_(Object.keys(allowed));
  return data;
}

// The cache takes at most 100 KB per value, and a year of activity photos is more than that, so the list is kept in parts
function putAllowedFiles_(list) {
  var parts = {};
  var n = 0;
  for (var i = 0; i < list.length; i += 1500) parts['allowed_files_' + n++] = JSON.stringify(list.slice(i, i + 1500));
  parts.allowed_files_parts = String(n);
  CacheService.getScriptCache().putAll(parts, 21600);
}

function getAllowedFiles_() {
  var cache = CacheService.getScriptCache();
  var n = Number(cache.get('allowed_files_parts'));
  if (!n) return null;
  var keys = [];
  for (var i = 0; i < n; i++) keys.push('allowed_files_' + i);
  var got = cache.getAll(keys);
  var list = [];
  for (i = 0; i < n; i++) {
    if (!got[keys[i]]) return null; // a part has expired: build the list again
    list = list.concat(JSON.parse(got[keys[i]]));
  }
  return list;
}

/**
 * The scrambled reference that joins one person's roles and listing into a member card. A keyed hash
 * (HMAC-SHA256 with a secret kept in the script's properties), so the member ID cannot be worked back.
 * The secret is made once and never changes, so card addresses stay the same.
 */
function personRefFn_() {
  var secret = props_().getProperty('PERSON_SECRET');
  if (!secret) {
    secret = Utilities.getUuid() + Utilities.getUuid();
    props_().setProperty('PERSON_SECRET', secret);
  }
  return function (memberId) {
    var bytes = Utilities.computeHmacSha256Signature(String(memberId), secret);
    var hex = '';
    for (var i = 0; i < 6; i++) hex += ('0' + ((bytes[i] + 256) % 256).toString(16)).slice(-2);
    return 'P' + hex;
  };
}

/** Member IDs marked deceased or left in the private members list. */
function inactiveMemberIds_() {
  return readTab_(privateSs_(), 'members_master').filter(function (m) {
    return Core_str(m.member_id) && Core_str(m.status || 'active').toLowerCase() !== 'active';
  }).map(function (m) { return Core_str(m.member_id); });
}

function fileFor_(mode, id) {
  var ref = (mode === 'thumb' ? 'thumb:' : 'drive:') + id;
  var allowed = getAllowedFiles_();
  if (!allowed) { publicData_(); allowed = getAllowedFiles_() || []; }
  // the thumbnail of a published photo is allowed too: the build falls back to it for formats it cannot read (HEIC, BMP)
  if (allowed.indexOf(ref) < 0 && !(mode === 'thumb' && allowed.indexOf('drive:' + id) >= 0)) {
    return { ok: false, error: 'file is not part of the public data' };
  }
  var file = DriveApp.getFileById(id);
  var blob = mode === 'thumb' ? file.getThumbnail() : file.getBlob();
  if (!blob) return { ok: false, error: 'no picture available' };
  return { ok: true, mimeType: blob.getContentType(), base64: Utilities.base64Encode(blob.getBytes()) };
}

/** Adds any new PDF in the magazine folder (named like 2026-10.pdf) to the magazines tab. */
function scanMagazines_() {
  var ss = mainSs_();
  var known = readTab_(ss, 'magazines').map(function (m) { return Core_str(m.issue_month).slice(0, 7); });
  var folder = DriveApp.getFolderById(magazineFolderId_());
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


// ===== Desk.js =====
/**
 * The moderation desk: a page on the website (…/desk/) for moderators who do not work in Google Sheets.
 * The page is plain HTML on the website and talks only to doPost below, which answers in JSON. On purpose,
 * this web app never serves an HtmlService page: any page it served could call every public function of this
 * script as the owner.
 *
 * Signing in: a moderator types their email. If it is an active row of the moderators tab (or the district
 * account), a 6-digit code and a one-tap sign-in link are emailed. The session lasts 7 days. Every request
 * checks the moderators tab again, so setting active to FALSE locks someone out at once.
 *
 * Emails carry personal, signed links (approve or reject one item; leave one item out of the bulletin) that
 * expire after 7 days. They open the desk, where one more tap confirms, so email link scanners cannot act.
 * Member requests are never handled from an email link, only on the signed-in desk.
 *
 * Nothing sent to the public or to clubs names a moderator or carries their email: replies to contact messages
 * and club reminders go from the district account, signed "Rotary District 3110".
 */

var DESK_SESSION_HOURS = 7 * 24;
var DESK_LINK_DAYS = 7;
var DESK_SIGNIN_MINUTES = 15;
var DESK_CODE_ANSWER_MS = 2500;
var DESK_KINDS = { activities: 'Activity', events: 'Event', club_profile_requests: 'Club profile update', public_services: 'Public service',
  businesses: 'Business listing' };
// What a moderator may correct on the desk before approving (spelling, length, a phone number in the text)
var DESK_EDITABLE = {
  activities: ['title', 'description', 'press_paper'],
  events: ['title', 'description', 'venue', 'fee'],
  club_profile_requests: ['meeting_day_place', 'permanent_projects', 'regular_services'],
  public_services: ['name', 'timings', 'phone', 'address', 'about'],
  businesses: ['business_name', 'about', 'offer', 'speaker_topics', 'member_id'],
};

function doPost(e) {
  var req;
  try { req = JSON.parse((e && e.postData && e.postData.contents) || '{}'); } catch (err) { return json_({ ok: false, error: 'bad request' }); }
  try {
    var out = desk_(req || {});
    out.ok = true;
    return json_(out);
  } catch (err) {
    if (!err.desk) Logger.log('Desk request stopped: ' + (err && err.stack || err));
    return json_({ ok: false, error: Core_safeError(err), signedOut: !!err.signedOut });
  }
}

function desk_(req) {
  var fn = Core_str(req.fn);
  if (fn === 'code') return deskSendCode_(req.email);
  if (fn === 'signin') return deskSignIn_(req);
  if (fn === 'peek') return deskPeek_(req.token);
  if (fn === 'confirm') return deskConfirm_(req);
  if (fn === 'photo' && req.token) return deskPhoto_(null, req.ref, req.full, req.token);
  var me = deskUser_(req.session);
  if (fn === 'list') return deskList_(me);
  if (fn === 'photo') return deskPhoto_(me, req.ref, req.full);
  if (fn === 'approve' || fn === 'reject') return deskModerate_(me, fn, req.tab, req.id, req.reason);
  if (fn === 'edit') return deskEdit_(me, req.tab, req.id, req.fields || {});
  if (fn === 'flag') return deskFlag_(me, req.tab, req.id, req.field, req.value);
  if (fn === 'member') return deskMember_(me, req.kind, req.action, req.id, req.reason, req.confirmed === true);
  if (fn === 'search') return deskSearch_(me, req.q);
  if (fn === 'deceased') return deskDeceased_(me, req.member_id);
  if (fn === 'nudge') return deskNudge_(me, req.club_id, req.via);
  if (fn === 'answered') return deskAnswered_(me, req.id);
  if (fn === 'reply') return deskReply_(me, req.id, req.text);
  // Release 1 (18 Nov 2026): moderators keep the data up to date here (Admin.js)
  if (fn === 'approveclean') return deskApproveClean_(me, req.ids);
  if (fn === 'hide') return deskHide_(me, req.id, req.reason);
  if (fn === 'putback') return deskPutBack_(me, req.id);
  if (fn === 'membersave') return deskMemberSave_(me, req.member_id, req.fields || {}, req.reason);
  if (fn === 'changes') return deskChanges_(me);
  if (fn === 'undo') return deskUndo_(me, req.id);
  if (fn === 'roles') return deskRoles_(me, req.q);
  if (fn === 'rolesave') return deskRoleSave_(me, req.tab, req.row, req.fields || {}, req.reason);
  if (fn === 'roleend') return deskRoleEnd_(me, req.tab, req.row, req.reason);
  if (fn === 'roleadd') return deskRoleAdd_(me, req.fields || {}, req.reason);
  if (fn === 'clubadd') return deskClubAdd_(me, req.fields || {}, req.reason);
  if (fn === 'clubsave') return deskClubSave_(me, req.club_id, req.fields || {}, req.reason);
  if (fn === 'clubclose') return deskClubClose_(me, req.club_id, req.move_to, req.reason);
  if (fn === 'modsave') return deskModeratorSave_(me, req.row, req.fields || {}, req.reason);
  throw new Error('unknown request');
}

function deskError_(message, signedOut) {
  var e = new Error(message);
  e.signedOut = !!signedOut;
  e.desk = true; // a message written for moderators, not a fault
  return e;
}

/* ---------- Signed tokens: kind~tab~id~email~expiry~signature ---------- */

function deskSecret_() {
  var secret = props_().getProperty('DESK_SECRET');
  if (!secret) {
    secret = Utilities.getUuid() + Utilities.getUuid();
    props_().setProperty('DESK_SECRET', secret);
  }
  return secret;
}

function deskSign_(payload) {
  var bytes = Utilities.computeHmacSha256Signature(payload, deskSecret_());
  var hex = '';
  for (var i = 0; i < 16; i++) hex += ('0' + ((bytes[i] + 256) % 256).toString(16)).slice(-2);
  return hex;
}

function deskToken_(kind, tab, id, email, minutes) {
  var payload = [kind, tab || '', id || '', Core_str(email).toLowerCase(), Date.now() + minutes * 60000].join('~');
  return payload + '~' + deskSign_(payload);
}

function deskRead_(token, kinds) {
  var parts = Core_str(token).split('~');
  if (parts.length !== 6) throw deskError_('This link is not complete. Open it again from the email.');
  if (deskSign_(parts.slice(0, 5).join('~')) !== parts[5] || kinds.indexOf(parts[0]) < 0) throw deskError_('This link is not valid.');
  if (Date.now() > Number(parts[4])) throw deskError_('This link has expired. Open the moderation desk instead.');
  return { kind: parts[0], tab: parts[1], id: parts[2], email: parts[3], expires: Number(parts[4]) };
}

/* ---------- Who is asking ---------- */

function deskOwner_() {
  return Core_str(Session.getEffectiveUser().getEmail()).toLowerCase();
}

function deskModeratorRows_() {
  return mainSs_().getSheetByName('moderators') ? readTab_(mainSs_(), 'moderators') : [];
}

/** The types an email holds; the district account (the Sheet's owner) counts as Administrator. */
function deskTypes_(email) {
  var e = Core_str(email).toLowerCase();
  var types = Core_moderatorTypesOf(deskModeratorRows_(), e);
  if (e && e === deskOwner_() && types.indexOf('Administrator') < 0) types.push('Administrator');
  return types;
}

function deskName_(email) {
  var e = Core_str(email).toLowerCase();
  var row = deskModeratorRows_().filter(function (r) { return Core_str(r.email).toLowerCase() === e && Core_str(r.name); })[0];
  return row ? Core_str(row.name) : e;
}

function deskMe_(email, types) {
  return { email: email, name: deskName_(email), types: types, views: Core_deskViews(types), zones: Core_moderatorZones(deskModeratorRows_(), email) };
}

function deskUser_(session) {
  var t;
  try { t = deskRead_(session, ['ses']); } catch (e) { throw deskError_('Please sign in again.', true); }
  // sessions started before "Sign everyone out of the desk" no longer count
  var from = Number(PropertiesService.getScriptProperties().getProperty('DESK_SESSIONS_FROM') || 0);
  if (t.expires - DESK_SESSION_HOURS * 3600000 < from) throw deskError_('Please sign in again.', true);
  var types = deskTypes_(t.email);
  if (!types.length) throw deskError_('This email is no longer on the moderators list.', true);
  return deskMe_(t.email, types);
}

/* ---------- Signing in ---------- */

function deskSendCode_(email) {
  var started = Date.now();
  try {
    return deskSendCodeNow_(email);
  } finally {
    // every answer takes about as long as sending the email, so timing does not show who is a moderator either
    var wait = DESK_CODE_ANSWER_MS - (Date.now() - started);
    if (wait > 0) Utilities.sleep(wait);
  }
}

function deskSendCodeNow_(email) {
  email = Core_str(email).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw deskError_('Please type your email address.');
  var reply = { message: 'If ' + email + ' is on the moderators list, a code is on its way. Nothing after two minutes? Look in Spam, check the spelling, or ask the website administrator.' };
  if (!deskTypes_(email).length) return reply;
  var cache = CacheService.getScriptCache();
  var hour = Math.floor(Date.now() / 3600000);
  var mine = Number(cache.get('deskrate:' + email + ':' + hour) || 0);
  var all = Number(cache.get('deskrate:all:' + hour) || 0);
  // the same answer as for an unknown email, so the limit does not show who is a moderator
  if (mine >= 5 || all >= 40) return reply;
  cache.put('deskrate:' + email + ':' + hour, String(mine + 1), 3600);
  cache.put('deskrate:all:' + hour, String(all + 1), 3600);
  var code = ('00000' + (parseInt(Utilities.getUuid().replace(/-/g, '').slice(0, 8), 16) % 1000000)).slice(-6);
  cache.put('deskcode:' + email, JSON.stringify({ h: deskSign_('code~' + email + '~' + code), n: 0 }), DESK_SIGNIN_MINUTES * 60);
  var link = deskLink_({ s: deskToken_('in', '', '', email, DESK_SIGNIN_MINUTES) });
  var text = 'Your code for the Rotary 3110 moderation desk: ' + code + '\n\n' + (link ? 'Or tap this link to sign in: ' + link + '\n\n' : '') +
    'The code and link work for ' + DESK_SIGNIN_MINUTES + ' minutes. If you did not ask for this, you can ignore this email.\n\nRotary District 3110 website';
  var html = '<div style="font:15px/1.5 Arial,sans-serif;color:#1c2430">' +
    '<p>Your code for the Rotary 3110 moderation desk:</p><p style="font-size:28px;letter-spacing:6px;font-weight:bold;color:#17458F">' + code + '</p>' +
    (link ? '<p>' + deskButton_('Sign in', link, 'green') + '</p>' : '') +
    '<p style="color:#5b6573;font-size:13px">The code and button work for ' + DESK_SIGNIN_MINUTES + ' minutes. If you did not ask for this, you can ignore this email.</p></div>';
  MailApp.sendEmail(email, 'Moderation desk code: ' + code, text, { htmlBody: html, name: 'Rotary 3110 website' });
  return reply;
}

function deskSignIn_(req) {
  var email;
  if (req.token) {
    email = deskRead_(req.token, ['in']).email;
  } else {
    email = Core_str(req.email).toLowerCase();
    // one guess at a time, so many guesses sent together still count towards the five allowed
    var lock = LockService.getScriptLock();
    lock.waitLock(10000);
    try {
      var cache = CacheService.getScriptCache();
      var key = 'deskcode:' + email;
      var saved = JSON.parse(cache.get(key) || 'null');
      if (!saved) throw deskError_('The code has expired. Ask for a new one.');
      if (saved.h !== deskSign_('code~' + email + '~' + Core_str(req.code).replace(/\D/g, ''))) {
        saved.n += 1;
        if (saved.n >= 5) cache.remove(key); else cache.put(key, JSON.stringify(saved), DESK_SIGNIN_MINUTES * 60);
        throw deskError_(saved.n >= 5 ? 'Too many wrong codes. Ask for a new one.' : 'That code is not right. Use the code in the latest email.');
      }
      cache.remove(key);
    } finally {
      lock.releaseLock();
    }
  }
  var types = deskTypes_(email);
  if (!types.length) throw deskError_('This email is not on the moderators list.');
  var me = deskMe_(email, types);
  return { session: deskToken_('ses', '', '', email, DESK_SESSION_HOURS * 60), me: me };
}

/* ---------- Links in emails ---------- */

/** The web app's /exec address: remembered when the website build calls the data link (see doGet). */
function webAppUrl_() {
  var saved = props_().getProperty('WEB_APP_URL');
  if (saved) return saved;
  try {
    var u = ScriptApp.getService().getUrl();
    if (/\/exec$/.test(u)) return u;
  } catch (e) { /* not deployed */ }
  return '';
}

function rememberWebAppUrl_() {
  try {
    var u = ScriptApp.getService().getUrl();
    if (/\/exec$/.test(u) && props_().getProperty('WEB_APP_URL') !== u) props_().setProperty('WEB_APP_URL', u);
  } catch (e) { /* not deployed */ }
}

/**
 * A one-way fingerprint (SHA-256) of the script id the desk links carry. The build puts it on the desk page, which
 * then refuses a link naming any other script, so a moderator's session can never be sent elsewhere.
 */
function deskApiFingerprint_() {
  var m = webAppUrl_().match(/\/s\/([^/]+)\/exec/);
  if (!m) return '';
  return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, m[1], Utilities.Charset.UTF_8)
    .map(function (b) { return ('0' + ((b + 256) % 256).toString(16)).slice(-2); }).join('');
}

/** A link to the desk page; the web app's id travels after the # (never sent to the website's server). */
function deskLink_(params) {
  var m = webAppUrl_().match(/\/s\/([^/]+)\/exec/);
  if (!m) return '';
  var q = ['k=' + m[1]];
  Object.keys(params || {}).forEach(function (k) { q.push(k + '=' + encodeURIComponent(params[k])); });
  return siteUrl_() + 'desk/#' + q.join('&');
}

/* ---------- One item as the desk and the emails show it ---------- */

var DESK_CLUB_NAMES = null;
var DESK_CLUB_ZONES = null;
function deskClubName_(id) {
  if (!DESK_CLUB_NAMES) {
    DESK_CLUB_NAMES = {};
    DESK_CLUB_ZONES = {};
    clubs_().forEach(function (c) { DESK_CLUB_NAMES[Core_str(c.club_id)] = Core_str(c.club_name); DESK_CLUB_ZONES[Core_str(c.club_id)] = Core_str(c.zone); });
  }
  return DESK_CLUB_NAMES[Core_str(id)] || Core_str(id);
}

/** The zone of a club (Agra, Bareilly, Kanpur), for sharing the clubs out among Content moderators. */
function deskClubZone_(id) {
  deskClubName_(id);
  return (DESK_CLUB_ZONES || {})[Core_str(id)] || '';
}

function deskCard_(tab, r) {
  var lines = [];
  var links = [];
  var add = function (label, v) { if (Core_str(v) !== '') lines.push([label, Core_str(v)]); };
  var link = function (label, v) { if (/^https?:\/\//i.test(Core_str(v))) links.push([label, Core_str(v)]); };
  var card = {
    tab: tab, id: Core_str(r.id), kind: DESK_KINDS[tab], status: Core_str(r.status) || 'pending', title: '', club: '', date: '', text: '',
    lines: lines, links: links,
    photos: Core_str(r.photo_files).split(',').map(function (s) { return s.trim(); }).filter(function (s) { return /^drive:/.test(s); }),
    notes: Core_str(r.moderator_note).split(/;\s*/).filter(String),
    sender: [Core_str(r.submitter_name), Core_str(r.submitter_role)].filter(String).join(', '),
    sender_mobile: Core_mobile(r.submitter_mobile), submitted: Core_isoTimestamp(r.submitted_at),
    block: approveBlock_(tab, r), done_by: deskName_(r.approved_by), done_at: Core_isoTimestamp(r.approved_at),
    edit: {}, zone: deskClubZone_(r.club_id),
  };
  // an activity with nothing to check is "clean": Approve all clean takes it in one tap (Release 1)
  card.checks = tab === 'activities' ? Core_activityChecks(r) : card.notes.slice();
  card.clean = tab === 'activities' && !card.checks.length && !card.block;
  (DESK_EDITABLE[tab] || []).forEach(function (k) { card.edit[k] = Core_str(r[k]); });
  if (tab === 'activities') {
    card.title = Core_str(r.title); card.club = Core_str(r.club_name); card.date = Core_isoDate(r.date); card.text = Core_str(r.description);
    add('Theme', r.theme); add('Avenue', r.avenue); if (Core_isTrue(r.district_level)) add('District level', 'Yes: check the district organised it'); add('People helped', r.people_helped); add('Amount spent (₹)', r.amount_spent);
    add('Partner clubs', Core_str(r.partner_clubs).split(',').map(function (s) { return s.trim(); }).filter(String).map(deskClubName_).join(', '));
    if (Core_str(r.campaign_id)) add('Campaign', Core_str(r.campaign_id) + (Core_str(r.campaign_count) !== '' ? ': ' + r.campaign_count : ''));
    var ba = [r.before_photo, r.after_photo].map(function (v) { return Core_str(v).split(',')[0].trim(); });
    if (ba[0] || ba[1]) {
      add('Before and after', ba[0] && ba[1] ? 'The last two photos, shown side by side' : 'Only one given: not shown (both are needed)');
      ba.forEach(function (p) { if (/^drive:/.test(p)) card.photos.push(p); });
    }
    if (card.photos.length) add('Photo consent', Core_isTrue(r.photo_consent) ? 'Ticked' : 'NOT ticked: reject the photos');
    add('Newspaper', [Core_str(r.press_paper), Core_isoDate(r.press_date)].filter(String).join(', '));
    link('Club\'s post', r.post_link); link('Video', r.video_link); link('Newspaper report', r.press_link);
  } else if (tab === 'events') {
    card.title = Core_str(r.title); card.club = Core_str(r.organiser); card.date = Core_isoDate(r.start_date); card.text = Core_str(r.description);
    add('Type', r.event_type);
    add('When', [Core_isoDate(r.start_date), Core_time(r.start_time), Core_isoDate(r.end_date) && Core_isoDate(r.end_date) !== Core_isoDate(r.start_date) ? 'to ' + Core_isoDate(r.end_date) : ''].filter(String).join(' '));
    add('Venue', [Core_str(r.venue), Core_str(r.city)].filter(String).join(', ')); add('Fee', r.fee);
    add('Registration closes', Core_isoDate(r.registration_close_date)); add('Open to everyone', Core_str(r.open_to_all) === '' ? '' : Core_isTrue(r.open_to_all) ? 'Yes' : 'No');
    link('Map', r.map_link); link('Details', r.details_link);
  } else if (tab === 'club_profile_requests') {
    card.title = 'Club profile update'; card.club = Core_str(r.club_name);
    add('Meeting day', r.meeting_day); add('Meeting day and place', r.meeting_day_place);
    add('Permanent projects', r.permanent_projects); add('Regular services', r.regular_services);
    ['website', 'facebook', 'instagram', 'youtube', 'x', 'linkedin'].forEach(function (k) { link(k.charAt(0).toUpperCase() + k.slice(1), r[k]); });
  } else if (tab === 'public_services') {
    card.title = Core_str(r.name); card.club = Core_str(r.club_name); card.text = Core_str(r.about);
    add('Type', r.service_type); add('Timings', r.timings); add('Phone (shown on the website)', r.phone);
    add('Address', [Core_str(r.address), Core_str(r.city)].filter(String).join(', '));
    link('Map', r.map_link);
  } else if (tab === 'businesses') {
    var m = businessMember_(r);
    card.title = Core_str(r.business_name) || 'Speaker topics only'; card.club = Core_str(r.club_name); card.text = Core_str(r.about);
    add('Member', m ? Core_str(m.name) + ' (' + Core_str(m.member_id) + ')' + (businessMemberActive_(m) ? '' : ': NOT active') : 'Not found in the members list');
    add('Trade', r.trade); add('City', r.city); add('Offer for Rotarians', r.offer);
    add('WhatsApp button', Core_mobile(r.whatsapp) ? 'Yes' : Core_str(r.whatsapp) ? 'Not a mobile number' : '');
    add('Speaker topics', r.speaker_topics);
    link('Website', r.website);
  }
  return card;
}

function deskFind_(tab, id) {
  if (!DESK_KINDS[tab]) throw deskError_('Unknown list.');
  var want = Core_str(id).toLowerCase();
  var r = readTab_(mainSs_(), tab).filter(function (x) { return Core_str(x.id).toLowerCase() === want; })[0];
  if (!r) throw deskError_('This item is no longer in the Sheet.');
  return r;
}

function deskDoneBy_(r) {
  var s = Core_str(r.status);
  return 'Already ' + (s === 'approved' ? 'approved' : s === 'rejected' ? 'rejected' : s) +
    (Core_str(r.approved_by) ? ' by ' + deskName_(r.approved_by) : '') + (Core_isoDate(r.approved_at) ? ' on ' + Core_dateLabel(Core_isoDate(r.approved_at)) : '') + '.';
}

function deskLog_(me, action, tab, item, details) {
  if (!mainSs_().getSheetByName('moderator_log')) return;
  appendRow_(mainSs_(), 'moderator_log', { at: nowIso_(), moderator: me.email, action: action, tab: tab, item: item, details: Core_str(details).slice(0, 500) });
}

/* ---------- One-tap links from emails ---------- */

function deskLinkUser_(t) {
  var types = deskTypes_(t.email);
  if (!Core_deskViews(types).content) throw deskError_('This email is no longer a Content moderator.');
  return deskMe_(t.email, types);
}

function deskPeek_(token) {
  var t = deskRead_(token, ['it', 'bx']);
  var me = deskLinkUser_(t);
  var r = deskFind_(t.tab, t.id);
  return { kind: t.kind, me: { name: me.name, email: me.email }, item: deskCard_(t.tab, r), left_out: Core_isTrue(r.bulletin_exclude),
    message: t.kind === 'it' && Core_str(r.status) !== 'pending' ? deskDoneBy_(r) : '' };
}

function deskConfirm_(req) {
  var t = deskRead_(req.token, ['it', 'bx']);
  var me = deskLinkUser_(t);
  if (t.kind === 'bx') return deskFlag_(me, t.tab, t.id, 'bulletin_exclude', req.action === 'putback' ? 'FALSE' : 'TRUE');
  if (req.action !== 'approve' && req.action !== 'reject') throw deskError_('Choose Approve or Reject.');
  return deskModerate_(me, req.action, t.tab, t.id, req.reason);
}

/* ---------- Content ---------- */

function deskModerate_(me, action, tab, id, reason) {
  if (!me.views.content) throw deskError_('Only Content moderators can do this.');
  if (MODERATED_TABS.indexOf(tab) < 0) throw deskError_('Unknown list.');
  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    var r = deskFind_(tab, id);
    if (Core_str(r.status) !== 'pending') return { message: deskDoneBy_(r), item: deskCard_(tab, r) };
    var why = Core_str(reason).slice(0, 500);
    if (action === 'approve') {
      var block = approveBlock_(tab, r);
      if (block) throw deskError_('Not approved: ' + block + '. Reject it with a note, or ask the website administrator to correct it in the Sheet.');
      approveRow_(tab, r, me.email);
    } else {
      if (!why) throw deskError_('Please write a reason. It is sent to the person who sent it.');
      rejectRow_(tab, r, me.email, why);
    }
    deskLog_(me, action, tab, r.id, why);
    var title = Core_str(r.title || r.name || r.club_name);
    return { message: (action === 'approve' ? 'Approved: ' + title + '. It will be on the website ' + NEXT_UPDATE + '.' : 'Rejected: ' + title + '. The sender has been told why.'),
      item: deskCard_(tab, deskFind_(tab, id)) };
  } finally {
    lock.releaseLock();
  }
}

function deskEdit_(me, tab, id, fields) {
  if (!me.views.content) throw deskError_('Only Content moderators can do this.');
  var allowed = DESK_EDITABLE[tab] || [];
  var r = deskFind_(tab, id);
  if (Core_str(r.status) !== 'pending') throw deskError_(deskDoneBy_(r) + ' Only waiting items can be corrected here.');
  var change = {};
  var changed = [];
  Object.keys(fields).forEach(function (k) {
    if (allowed.indexOf(k) < 0) return;
    var v = Core_str(fields[k]).slice(0, 4000);
    if (v !== Core_str(r[k])) { change[k] = v; changed.push(k); }
  });
  if (!changed.length) return { message: 'Nothing changed.', item: deskCard_(tab, r) };
  var notes = [];
  textNotes_(changed.map(function (k) { return change[k]; }), notes);
  change.moderator_note = [Core_str(r.moderator_note), 'Corrected by ' + me.name + ' (' + changed.join(', ') + ')'].concat(notes).filter(String).join('; ');
  updateRow_(mainSs_(), tab, r._row, change);
  deskLog_(me, 'edit', tab, r.id, changed.join(', '));
  return { message: 'Saved.', item: deskCard_(tab, deskFind_(tab, id)) };
}

/** Story of the month (activities) and leave out of the bulletin (activities and events), on approved items. */
function deskFlag_(me, tab, id, field, value) {
  if (!me.views.content) throw deskError_('Only Content moderators can do this.');
  var ok = (tab === 'activities' && (field === 'story_of_month' || field === 'bulletin_exclude')) || (tab === 'events' && field === 'bulletin_exclude');
  if (!ok) throw deskError_('Unknown change.');
  var r = deskFind_(tab, id);
  if (Core_str(r.status) !== 'approved') throw deskError_('Only approved items can be changed here.');
  var on = value === true || Core_str(value).toUpperCase() === 'TRUE';
  var fields = {};
  fields[field] = on ? 'TRUE' : 'FALSE';
  updateRow_(mainSs_(), tab, r._row, fields);
  deskLog_(me, field + (on ? ' on' : ' off'), tab, r.id, '');
  var title = Core_str(r.title);
  var message = field === 'story_of_month' ? (on ? title + ' is now a Story of the month.' : title + ' is no longer a Story of the month.')
    : (on ? title + ' will be left out of the bulletin.' : title + ' is back in the bulletin.');
  return { message: message, value: on };
}

function deskContent_() {
  var ss = mainSs_();
  var today = today_();
  var pending = [];
  MODERATED_TABS.forEach(function (t) {
    readTab_(ss, t).forEach(function (r) { if (Core_str(r.status) === 'pending') pending.push(deskCard_(t, r)); });
  });
  pending.sort(function (a, b) { return a.submitted.localeCompare(b.submitted); });
  var from = Core_addDays(today, -30);
  var recent = readTab_(ss, 'activities').filter(function (a) {
    return ['approved', 'hidden'].indexOf(Core_str(a.status)) >= 0 && Core_isoDate(a.date) >= from && Core_isoDate(a.date) <= today;
  }).sort(function (a, b) { return Core_isoDate(b.date).localeCompare(Core_isoDate(a.date)); }).slice(0, 60).map(function (a) {
    return { tab: 'activities', id: Core_str(a.id), title: Core_str(a.title), club: Core_str(a.club_name), date: Core_isoDate(a.date),
      story: Core_isTrue(a.story_of_month), left_out: Core_isTrue(a.bulletin_exclude), hidden: Core_str(a.status) === 'hidden' };
  });
  var until = Core_addDays(today, 30);
  var upcoming = readTab_(ss, 'events').filter(function (e) {
    var start = Core_isoDate(e.start_date);
    return Core_str(e.status) === 'approved' && start && start <= until && (Core_isoDate(e.end_date) || start) >= today;
  }).sort(function (a, b) { return Core_isoDate(a.start_date).localeCompare(Core_isoDate(b.start_date)); }).map(function (e) {
    return { tab: 'events', id: Core_str(e.id), title: Core_str(e.title), club: Core_str(e.organiser), date: Core_isoDate(e.start_date), left_out: Core_isTrue(e.bulletin_exclude) };
  });
  return { pending: pending, recent: recent, upcoming: upcoming };
}

/** A photo of a waiting item, for a moderator who may see that item (or the holder of that item's email link). */
function deskPhoto_(me, ref, full, token) {
  ref = Core_str(ref);
  var allowed = [];
  var split = function (v) { Core_str(v).split(',').forEach(function (s) { if (s.trim()) allowed.push(s.trim()); }); };
  if (token) {
    var t = deskRead_(token, ['it', 'bx']);
    deskLinkUser_(t);
    var item = deskFind_(t.tab, t.id);
    split(item.photo_files); split(item.before_photo); split(item.after_photo);
  } else {
    if (me.views.content) {
      MODERATED_TABS.forEach(function (tab) {
        readTab_(mainSs_(), tab).forEach(function (r) {
          if (Core_str(r.status) === 'pending') { split(r.photo_files); split(r.before_photo); split(r.after_photo); }
        });
      });
    }
    if (me.views.members) {
      readTab_(privateSs_(), 'consent_requests').forEach(function (r) {
        if (Core_str(r.status) === 'pending') { split(r.photo_file); split(r.couple_photo_file); }
      });
    }
  }
  if (!/^drive:/.test(ref) || allowed.indexOf(ref) < 0) throw deskError_('This photo is not available.');
  var file = DriveApp.getFileById(ref.slice(6));
  var blob = full ? file.getBlob() : file.getThumbnail();
  if (full && blob.getBytes().length > 3000000) blob = file.getThumbnail();
  if (!blob) throw deskError_('No picture available.');
  return { mimeType: blob.getContentType(), base64: Utilities.base64Encode(blob.getBytes()) };
}

/* ---------- Members ---------- */

function deskMember_(me, kind, action, id, reason, confirmed) {
  if (!me.views.members) throw deskError_('Only Members moderators can do this.');
  if (kind !== 'consent' && kind !== 'removal' && kind !== 'change') throw deskError_('Unknown request.');
  var message;
  if (action === 'approve') {
    message = kind === 'consent' ? approveConsent_(id, me.email, confirmed)
      : kind === 'change' ? approveClubChange_(id, me.email, confirmed) : approveRemoval_(id, me.email);
  }
  else if (action === 'reject') {
    if (!Core_str(reason)) throw deskError_('Please write a reason. It is sent to the person who sent the form.');
    message = rejectRequest_(kind, id, Core_str(reason).slice(0, 500), me.email);
  } else throw deskError_('Unknown action.');
  deskLog_(me, action, kind === 'change' ? 'club_change_requests' : kind + '_requests', id, confirmed ? 'confirmed with the member or club' : reason);
  return { message: message };
}

function deskDeceased_(me, memberId) {
  if (!me.views.members) throw deskError_('Only Members moderators can do this.');
  var m = readTab_(privateSs_(), 'members_master').filter(function (x) { return Core_str(x.member_id) === Core_str(memberId); })[0];
  if (!m) throw deskError_('No one with this ID in the private members list.');
  if (Core_str(m.status) === 'deceased') return { message: m.name + ' was already marked as deceased.' };
  markDeceased_(m, me.email);
  deskLog_(me, 'deceased', 'members_master', m.member_id, '');
  return { message: m.name + ' is marked as deceased. Greetings stop at once; the website shows it ' + NEXT_UPDATE + '.' };
}

/* ---------- Club engagement ---------- */

/** Emails of each club's President and Secretary this Rotary year, from the private members list. */
function deskOfficerEmails_() {
  var year = Core_str(settings_().current_rotary_year);
  var email = {};
  readTab_(privateSs_(), 'members_master').forEach(function (m) {
    var e = Core_str(m.email);
    if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e) && Core_str(m.status || 'active') === 'active' && !Core_isTrue(m.is_sample)) email[Core_str(m.member_id)] = e;
  });
  var out = {};
  readTab_(mainSs_(), 'officers').forEach(function (o) {
    var e = email[Core_str(o.member_id)];
    if (!e || Core_str(o.rotary_year) !== year || !/^(president|secretary)$/i.test(Core_str(o.role))) return;
    var id = Core_str(o.club_id);
    out[id] = out[id] || [];
    if (out[id].indexOf(e) < 0) out[id].push(e);
  });
  return out;
}

function deskNudgeText_(club, lastDate) {
  var s = settings_();
  var form = Core_str(club.activity_form_link) || Core_str(s.form_activity_url) || siteUrl_() + 'submit/';
  return 'Dear friends at ' + (Core_str(club.display_name) || Core_str(club.club_name)) + ', the district website has ' +
    (lastDate ? 'had no activity from your club since ' + Core_dateLabel(lastDate) : 'no activity from your club yet') +
    '. Please send your latest service project; it takes two minutes: ' + form + '\nThank you!\nRotary District 3110 website team';
}

function deskReminders_() {
  var out = {};
  readTab_(mainSs_(), 'moderator_log').forEach(function (l) {
    if (!/^reminder/.test(Core_str(l.action))) return;
    var at = Core_isoTimestamp(l.at);
    if (!out[l.item] || at > out[l.item].at) out[l.item] = { at: at, by: deskName_(l.moderator), via: Core_str(l.action).replace('reminder ', '') };
  });
  return out;
}

function deskClubs_(me) {
  var today = today_();
  var all = clubs_();
  var byId = {};
  all.forEach(function (c) { byId[Core_str(c.club_id)] = c; });
  var emails = deskOfficerEmails_();
  var reminded = deskReminders_();
  return Core_quietClubs(all, readTab_(mainSs_(), 'activities'), today, CORE_QUIET_DAYS).map(function (c) {
    var r = reminded[c.club_id];
    c.reminded_at = r ? r.at : ''; c.reminded_by = r ? r.by : ''; c.reminded_via = r ? r.via : '';
    c.can_email = !!(emails[c.club_id] || []).length;
    c.whatsapp = deskNudgeText_(byId[c.club_id], c.last_activity_date);
    return c;
  });
}

function deskNudge_(me, clubId, via) {
  if (!me.views.clubs) throw deskError_('Only Club engagement moderators can do this.');
  var club = clubs_().filter(function (c) { return Core_str(c.club_id) === Core_str(clubId); })[0];
  if (!club) throw deskError_('Unknown club.');
  if (via === 'whatsapp') {
    deskLog_(me, 'reminder whatsapp', 'clubs', club.club_id, '');
    return { message: 'Noted: ' + club.club_name + ' reminded on WhatsApp.' };
  }
  var to = deskOfficerEmails_()[Core_str(club.club_id)] || [];
  if (!to.length) throw deskError_('No email for this club\'s President or Secretary in the members list. Use WhatsApp instead.');
  var last = deskReminders_()[Core_str(club.club_id)];
  if (last && last.via === 'email' && Date.now() - new Date(last.at).getTime() < 7 * 86400000) {
    throw deskError_('Already emailed by ' + last.by + ' on ' + Core_dateLabel(Core_isoDate(last.at)) + '. One email a week is enough.');
  }
  var lastDate = Core_quietClubs([club], readTab_(mainSs_(), 'activities'), today_(), -1)[0]; // -1: any club, with its last activity
  MailApp.sendEmail(to.join(','), 'Share your club\'s service on the district website', deskNudgeText_(club, lastDate ? lastDate.last_activity_date : ''),
    { bcc: me.email, name: 'Rotary District 3110' }); // replies go to the district account, not the moderator
  deskLog_(me, 'reminder email', 'clubs', club.club_id, to.length + ' recipient(s)');
  return { message: 'Sent to ' + club.club_name + '\'s President and Secretary from the district account, with a hidden copy to you.' };
}

/* ---------- District office ---------- */

function deskOffice_() {
  var from = Date.now() - 60 * 86400000;
  return readTab_(privateSs_(), 'contact_messages').filter(function (m) {
    return Core_str(m.status) !== 'spam' && new Date(m.submitted_at).getTime() >= from;
  }).sort(function (a, b) { return Core_isoTimestamp(b.submitted_at).localeCompare(Core_isoTimestamp(a.submitted_at)); }).slice(0, 50).map(function (m) {
    var reply = Core_str(m.reply_to);
    return { id: Core_str(m.id), submitted: Core_isoTimestamp(m.submitted_at), name: Core_str(m.name), topic: Core_str(m.topic), city: Core_str(m.city),
      message: Core_str(m.message), status: Core_str(m.status), note: Core_str(m.note), replies: Core_str(m.replies),
      reply_email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(reply) ? reply : '', reply_mobile: Core_mobile(reply), reply_to: reply };
  });
}

function deskAnswered_(me, id) {
  if (!me.views.office) throw deskError_('Only District office moderators can do this.');
  var ps = privateSs_();
  var m = readTab_(ps, 'contact_messages').filter(function (x) { return Core_str(x.id) === Core_str(id); })[0];
  if (!m) throw deskError_('Message not found.');
  updateRow_(ps, 'contact_messages', m._row, { status: 'answered', note: [Core_str(m.note), 'Answered: marked by ' + me.name + ' on ' + today_()].filter(String).join('; ') });
  deskLog_(me, 'answered', 'contact_messages', m.id, '');
  return { message: 'Marked as answered.' };
}

/**
 * Answers a contact message by email from the district account, signed "Rotary District 3110", so the person
 * never learns which moderator wrote. Their own reply comes back to the district account. The answer is kept in
 * the private Sheet (replies column) and the message is marked answered.
 */
function deskReply_(me, id, text) {
  if (!me.views.office) throw deskError_('Only District office moderators can do this.');
  text = Core_str(text);
  if (text.length < 2) throw deskError_('Please write the reply.');
  if (text.length > 3000) throw deskError_('Please keep the reply under 3,000 characters.');
  var ps = privateSs_();
  var m = readTab_(ps, 'contact_messages').filter(function (x) { return Core_str(x.id) === Core_str(id); })[0];
  if (!m) throw deskError_('Message not found.');
  var to = Core_str(m.reply_to);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) throw deskError_('This person gave a mobile number, not an email. Please call or WhatsApp from the district office phone.');
  if (!deskQuota_(1)) throw deskError_('The district account has sent all its emails for today. Please try again tomorrow.');
  var asked = Core_str(m.message);
  MailApp.sendEmail(to, 'Re: ' + Core_str(m.topic) + ' – Rotary District 3110',
    'Dear ' + (Core_str(m.name) || 'friend') + ',\n\n' + text + '\n\nWith regards,\nRotary District 3110\n\n' +
    '— You wrote to us on ' + Core_dateLabel(Core_isoDate(new Date(m.submitted_at))) + ':\n' + (asked.length > 600 ? asked.slice(0, 600) + '…' : asked) +
    '\n\nTo write to us again, use the contact page: ' + siteUrl_() + 'contact/',
    { name: 'Rotary District 3110' });
  var day = today_();
  updateRow_(ps, 'contact_messages', m._row, {
    status: 'answered',
    replies: [Core_str(m.replies), day + ': ' + text].filter(String).join('\n\n'),
    note: [Core_str(m.note), 'Replied by email from the desk by ' + me.name + ' on ' + day].filter(String).join('; '),
  });
  deskLog_(me, 'replied', 'contact_messages', m.id, ''); // the reply itself stays in the private Sheet
  return { message: 'Sent from the district account. ' + (Core_str(m.name) || 'They') + ' will not see your name or email.' };
}

/* ---------- Everything one moderator sees ---------- */

function deskList_(me) {
  var out = { me: me };
  if (me.views.content) out.content = deskContent_();
  if (me.views.members) out.members = memberRequests_(false);
  if (me.views.members || me.views.content) out.roles = { checks: me.views.members ? deskRoleChecks_() : [] };
  if (me.views.clubs) out.clubs = deskClubs_(me);
  if (me.views.office) out.office = deskOffice_();
  if (me.views.admin) out.admin = { clubs: clubs_().map(deskClubRow_), moderators: deskModerators_() };
  if (me.views.members || me.views.content || me.views.admin) out.lists = deskLists_();
  return out;
}

/* ---------- Alert emails ---------- */

function escHtml_(s) {
  return Core_str(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', '\'': '&#39;' }[c]; });
}

function deskButton_(label, href, style) {
  var colours = { green: 'background:#1e7d32;color:#ffffff;border:2px solid #1e7d32', red: 'background:#ffffff;color:#b3261e;border:2px solid #b3261e',
    plain: 'background:#ffffff;color:#17458F;border:2px solid #17458F' };
  return '<a href="' + escHtml_(href) + '" style="display:inline-block;padding:12px 22px;margin:6px 8px 6px 0;border-radius:24px;font-weight:bold;' +
    'text-decoration:none;font-size:16px;' + (colours[style] || colours.plain) + '">' + escHtml_(label) + '</a>';
}

/** Enough daily email allowance left for n more, keeping some for confirmations and contact messages. */
function deskQuota_(n) {
  try { return MailApp.getRemainingDailyQuota() >= n + 10; } catch (e) { return true; }
}

function deskInlineImages_(refs) {
  var out = {};
  (refs || []).slice(0, 3).forEach(function (ref, i) {
    try {
      var blob = DriveApp.getFileById(ref.slice(6)).getThumbnail();
      if (blob) out['p' + i] = blob;
    } catch (e) { /* no picture */ }
  });
  return out;
}

function deskEmailText_(card, intro, buttons, how) {
  var out = [intro, '', card.title, [card.kind, card.club, card.date ? Core_dateLabel(card.date) : ''].filter(String).join(' · ')];
  if (card.text) out.push('', card.text);
  if (card.lines.length) out.push('');
  card.lines.forEach(function (l) { out.push(l[0] + ': ' + l[1]); });
  card.links.forEach(function (l) { out.push(l[0] + ': ' + l[1]); });
  if (card.photos.length) out.push('Photos: ' + card.photos.length);
  if (card.notes.length) out.push('', 'Please check: ' + card.notes.join('; '));
  if (card.block) out.push('', 'Cannot be approved yet: ' + card.block);
  if (card.sender) out.push('', 'Sent by ' + card.sender + (card.sender_mobile ? ' (+' + card.sender_mobile + ')' : ''));
  out.push('');
  buttons.forEach(function (b) { out.push(b[0] + ': ' + b[1]); });
  if (how) out.push(how);
  out.push('', 'Rotary District 3110 website');
  return out.join('\n');
}

function deskEmailHtml_(card, intro, buttons, how, imageIds) {
  var e = escHtml_;
  var h = '<div style="font:15px/1.5 Arial,sans-serif;color:#1c2430;max-width:600px">' +
    '<p style="color:#5b6573;margin:0 0 6px">' + e(intro) + '</p>' +
    '<h2 style="color:#17458F;font-size:20px;margin:0 0 2px">' + e(card.title) + '</h2>' +
    '<p style="color:#5b6573;margin:0 0 12px">' + e([card.kind, card.club, card.date ? Core_dateLabel(card.date) : ''].filter(String).join(' · ')) + '</p>';
  if (card.block) h += '<p style="background:#fde8e6;color:#8c1d18;padding:8px 10px;border-radius:6px">Cannot be approved yet: ' + e(card.block) + '</p>';
  if (card.notes.length) h += '<p style="background:#fff4dc;padding:8px 10px;border-radius:6px"><strong>Please check:</strong> ' + e(card.notes.join('; ')) + '</p>';
  if (card.text) h += '<p style="white-space:pre-wrap">' + e(card.text) + '</p>';
  (imageIds || []).forEach(function (id) { h += '<img src="cid:' + id + '" alt="Photo" style="max-width:180px;max-height:180px;border-radius:6px;margin:0 6px 6px 0">'; });
  if (card.lines.length || card.links.length) {
    h += '<table style="border-collapse:collapse;margin:8px 0">';
    card.lines.forEach(function (l) { h += '<tr><td style="padding:2px 12px 2px 0;color:#5b6573;vertical-align:top">' + e(l[0]) + '</td><td style="padding:2px 0">' + e(l[1]) + '</td></tr>'; });
    card.links.forEach(function (l) { h += '<tr><td style="padding:2px 12px 2px 0;color:#5b6573">' + e(l[0]) + '</td><td><a href="' + e(l[1]) + '">' + e(l[1].slice(0, 60)) + '</a></td></tr>'; });
    h += '</table>';
  }
  if (card.sender) h += '<p style="color:#5b6573;font-size:13px">Sent by ' + e(card.sender) + (card.sender_mobile ? ' · <a href="tel:+' + card.sender_mobile + '">+' + card.sender_mobile + '</a>' : '') + '</p>';
  h += '<p>' + buttons.map(function (b) { return deskButton_(b[0], b[1], b[2]); }).join('') + '</p>';
  if (buttons.length) h += '<p style="color:#5b6573;font-size:13px">Approve and Reject open the moderation desk, where one more tap confirms. These links are personal to you and work for ' + DESK_LINK_DAYS + ' days.</p>';
  if (how) h += '<p>' + e(how) + '</p>';
  return h + '</div>';
}

/**
 * A new activity, event, club profile update or public service: one email to each Content moderator, with personal
 * Approve and Reject links. A moderator given zones hears only of their zones' clubs (Release 1); when nobody covers
 * the club's zone, everyone does.
 */
function alertContent_(tab, row, only) {
  try {
    var to = only || alertZoneFilter_(moderatorRecipients_('Content').split(',').filter(String), deskClubZone_(row.club_id));
    if (!deskQuota_(to.length)) { Logger.log('Alert for ' + row.id + ' not sent: daily email allowance nearly used'); return; }
    var card = deskCard_(tab, row);
    var images = deskInlineImages_(card.photos);
    var intro = 'New ' + card.kind.toLowerCase() + ' waiting for a moderator';
    var subject = 'To check: ' + card.title + (card.club ? ' – ' + card.club : '');
    to.forEach(function (email) {
      var buttons = [];
      if (Core_deskViews(deskTypes_(email)).content) {
        var token = deskToken_('it', tab, card.id, email, DESK_LINK_DAYS * 1440);
        var yes = deskLink_({ a: token, 'do': 'approve' });
        if (yes) buttons = [['Approve', yes, 'green'], ['Reject', deskLink_({ a: token, 'do': 'reject' }), 'red'], ['Open the moderation desk', deskLink_({}), 'plain']];
      }
      var how = buttons.length ? '' : 'To approve or reject, open the Sheet and use the Rotary menu: ' + mainSs_().getUrl();
      MailApp.sendEmail(email, subject, deskEmailText_(card, intro, buttons, how),
        { htmlBody: deskEmailHtml_(card, intro, buttons, how, Object.keys(images)), inlineImages: images, name: 'Rotary 3110 website' });
    });
  } catch (e) {
    Logger.log('Alert not sent: ' + e.message);
  }
}

function alertZoneFilter_(emails, zone) {
  if (!zone) return emails;
  var rows = deskModeratorRows_();
  var mine = emails.filter(function (e) {
    var zones = Core_moderatorZones(rows, e);
    return !zones.length || zones.indexOf(zone) >= 0;
  });
  return mine.length ? mine : emails;
}

/** A new consent, removal or club change form: the Members moderators are told to open the desk (no details in the email beyond the name). */
function alertMembers_(kind, row, only) {
  try {
    var to = only || moderatorRecipients_('Members').split(',').filter(String);
    if (!deskQuota_(to.length)) return;
    var club = deskClubName_(row.club_id);
    var what = kind === 'removal' ? 'Removal request' : kind === 'change' ? 'Club change' : 'Consent form';
    to.forEach(function (email) {
      var desk = Core_deskViews(deskTypes_(email)).members ? deskLink_({}) : '';
      MailApp.sendEmail(email, what + ' to check: ' + row.name + (club ? ' – ' + club : ''),
        'A new ' + what.toLowerCase() + ' is waiting for a Members moderator.\n\nName: ' + row.name + (club ? '\nClub: ' + club : '') +
        (kind === 'removal' ? '\n\nRemoval requests should be handled within two days.' : '') + '\n\n' +
        (desk ? 'Open the moderation desk: ' + desk : 'Open the Sheet and use Rotary → Member requests: ' + mainSs_().getUrl()) + '\n\nRotary District 3110 website',
        { name: 'Rotary 3110 website' });
    });
  } catch (e) {
    Logger.log('Alert not sent: ' + e.message);
  }
}

/** Rotary → Administrator → Sign everyone out of the desk…: every desk session ends; moderators sign in again with a new code. */
function deskSignOutAll() {
  var ui = SpreadsheetApp.getUi();
  if (ui.alert('Sign everyone out of the desk', 'Every moderator is signed out of the moderation desk on every phone and computer, ' +
    'and signs in again with a new code. Use it if a phone is lost or a session may be in the wrong hands. Go ahead?', ui.ButtonSet.YES_NO) !== ui.Button.YES) return;
  PropertiesService.getScriptProperties().setProperty('DESK_SESSIONS_FROM', String(Date.now()));
  ui.alert('Everyone is signed out of the moderation desk.');
}


// ===== Admin.js =====
/**
 * Release 1 (owner, 18 Nov 2026): moderators keep the data up to date on the moderation desk, so nobody edits the
 * Sheets by hand and no one-off scripts are needed. Members moderators correct members; Content and Members
 * moderators correct club office bearers; Members moderators correct district roles; Administrators add, rename and
 * close clubs and name the moderators. Content moderators approve clean activities in one go and hide published ones.
 *
 * Every change is written to the private change_log tab (who, when, old and new value, why), one row per field;
 * the rows of one save share an id, and Undo puts the old values back while the fields still hold the new ones.
 * The moderator_log tab in the main Sheet gets only the action and the row, never members' details.
 */

var DESK_MEMBER_FIELDS = ['member_id', 'name', 'club_id', 'status', 'mobile', 'email'];
var DESK_MEMBER_STATUSES = ['active', 'left', 'deceased'];
var DESK_CLEAN_MAX = 50; // activities approved in one tap at most (well inside Apps Script's 6 minutes)
// An addition is taken back another way (end the role, close the club, set the moderator inactive), not by Undo
var DESK_NO_UNDO = { 'add role': 'end the role instead', 'add club': 'close the club instead', 'add moderator': 'set the moderator to inactive instead' };

function deskReason_(reason) {
  var why = Core_str(reason).slice(0, 500);
  if (why.length < 3) throw deskError_('Please write a reason. It is kept in the change log.');
  return why;
}

function deskAllow_(me, tab) {
  var ok = tab === 'members_master' ? me.views.members
    : tab === 'officers' ? me.views.members || me.views.content
    : tab === 'functionaries' ? me.views.members
    : me.views.admin; // clubs, moderators
  if (!ok) {
    throw deskError_(tab === 'officers' ? 'Only Content or Members moderators can do this.' : tab === 'functionaries' || tab === 'members_master'
      ? 'Only Members moderators can do this.' : 'Only Administrators can do this.');
  }
}

/* ---------- The change log ---------- */

function changeLogId_() {
  return 'CL-' + Utilities.getUuid().replace(/-/g, '').slice(0, 10);
}

function changeLog_(id, me, action, tab, key, changes, reason) {
  var ps = privateSs_();
  var at = nowIso_();
  Object.keys(changes).forEach(function (field) {
    appendRow_(ps, 'change_log', { id: id, at: at, moderator: me.email, action: action, tab: tab, key: Core_str(key), field: field,
      old_value: Core_str(changes[field][0]), new_value: Core_str(changes[field][1]), reason: reason });
  });
}

/** The last changes this moderator may see and undo, newest first, one entry per save. */
function deskChanges_(me) {
  var tabs = [];
  if (me.views.members) tabs.push('members_master', 'functionaries');
  if (me.views.members || me.views.content) tabs.push('officers');
  if (me.views.admin) tabs.push('clubs', 'moderators');
  var groups = {};
  var order = [];
  readTab_(privateSs_(), 'change_log').forEach(function (r) {
    if (tabs.indexOf(Core_str(r.tab)) < 0) return;
    var id = Core_str(r.id);
    if (!groups[id]) {
      groups[id] = { id: id, at: Core_isoTimestamp(r.at), by: deskName_(r.moderator), action: Core_str(r.action), tab: Core_str(r.tab), key: Core_str(r.key),
        reason: Core_str(r.reason), undone: !!Core_str(r.undone_at), can_undo: !DESK_NO_UNDO[Core_str(r.action)], lines: [] };
      order.push(id);
    }
    groups[id].lines.push(Core_str(r.field) + ': ' + (Core_str(r.old_value) || '–') + ' → ' + (Core_str(r.new_value) || '–'));
  });
  return { changes: order.reverse().slice(0, 40).map(function (id) { return groups[id]; }) };
}

/** Puts back the old values of one save, while every field still holds the value that save gave it. */
function deskUndo_(me, id) {
  var ps = privateSs_();
  var rows = readTab_(ps, 'change_log').filter(function (r) { return Core_str(r.id) === Core_str(id); });
  if (!rows.length) throw deskError_('This change is not in the change log.');
  if (rows.some(function (r) { return Core_str(r.undone_at); })) throw deskError_('This change was already undone.');
  var tab = Core_str(rows[0].tab);
  deskAllow_(me, tab);
  if (DESK_NO_UNDO[Core_str(rows[0].action)]) throw deskError_('An addition cannot be undone here: ' + DESK_NO_UNDO[Core_str(rows[0].action)] + '.');
  var back = {};
  rows.forEach(function (r) { back[Core_str(r.field)] = [Core_str(r.new_value), Core_str(r.old_value)]; });
  var why = 'Undo of ' + id + (Core_str(rows[0].reason) ? ' (' + Core_str(rows[0].reason) + ')' : '');
  var current;
  if (tab === 'members_master') {
    current = readTab_(ps, 'members_master').filter(function (m) { return Core_str(m.member_id) === Core_str(rows[0].key); })[0];
  } else {
    var all = readTab_(mainSs_(), tab);
    current = tab === 'clubs' ? all.filter(function (c) { return Core_str(c.club_id) === Core_str(rows[0].key); })[0]
      : all.filter(function (r) { return String(r._row) === Core_str(rows[0].key); })[0];
  }
  if (!current) throw deskError_('The row this change was made to is no longer there.');
  Object.keys(back).forEach(function (f) {
    var now = f === 'status' && tab === 'members_master' ? Core_str(current[f] || 'active') : Core_str(current[f]);
    if (now !== back[f][0]) throw deskError_('Not undone: ' + f + ' has been changed again since (it is now "' + (now || 'blank') + '").');
  });
  var fields = {};
  Object.keys(back).forEach(function (f) { fields[f] = back[f][1]; });
  var out;
  if (tab === 'members_master') out = deskMemberSave_(me, rows[0].key, fields, why);
  else out = deskRowRevert_(me, tab, current, fields, why);
  rows.forEach(function (r) { updateRow_(ps, 'change_log', r._row, { undone_at: nowIso_(), undone_by: me.email }); });
  out.message = 'Undone. ' + out.message;
  return out;
}

/** Undo for a role, club or moderator row: the old values go straight back. */
function deskRowRevert_(me, tab, row, fields, why) {
  var changes = {};
  Object.keys(fields).forEach(function (f) { changes[f] = [Core_str(row[f]), fields[f]]; });
  updateRow_(mainSs_(), tab, row._row, fields);
  changeLog_(changeLogId_(), me, 'undo', tab, tab === 'clubs' ? row.club_id : row._row, changes, why);
  deskLog_(me, 'undo', tab, tab === 'clubs' ? row.club_id : row._row, Object.keys(fields).join(', '));
  if (tab === 'clubs') { try { updateFormLists(true); } catch (e) { Logger.log('Form lists not updated: ' + e.message); } }
  if (tab === 'officers' || tab === 'functionaries') { try { checkRoles(true); } catch (e) { Logger.log('Role check not run: ' + e.message); } }
  contentChanged_();
  return { message: tab === 'clubs' && changes.status ? 'The club is open again; members who were moved or marked as left stay so.' : 'The old values are back.' };
}

/* ---------- Members (Members moderators) ---------- */

/** One member as the desk shows it to a Members moderator (the private Sheet's details stay on the desk). */
function deskPerson_(m) {
  return { member_id: Core_str(m.member_id), name: Core_str(m.name), club_id: Core_str(m.club_id), club: deskClubName_(m.club_id) || '–',
    status: Core_str(m.status || 'active'), mobile: Core_str(m.mobile), email: Core_str(m.email), rotarian: Core_isTrue(m.is_rotarian) };
}

/** A name (3 letters or more), or exactly an RI member ID, an email or a mobile number. */
function deskSearch_(me, q) {
  if (!me.views.members) throw deskError_('Only Members moderators can do this.');
  var text = Core_str(q).trim();
  var master = readTab_(privateSs_(), 'members_master').filter(function (m) { return Core_str(m.member_id); });
  var mobile = Core_mobile(text);
  var email = text.toLowerCase();
  var exact = master.filter(function (m) {
    return Core_str(m.member_id) === text || (/@/.test(email) && Core_str(m.email).toLowerCase() === email) || (mobile && Core_mobile(m.mobile) === mobile);
  });
  if (exact.length) return { people: exact.slice(0, 10).map(deskPerson_) };
  var want = Core_plainName(text);
  if (want.length < 3) throw deskError_('Type at least three letters of the name, or an RI member ID, email or mobile number.');
  return { people: master.filter(function (m) { return Core_plainName(m.name).indexOf(want) >= 0; }).slice(0, 15).map(deskPerson_) };
}

/**
 * A Members moderator corrects a member: name, RI member ID, club, status (active, left, deceased: also the way back
 * from a mistaken "left" or "deceased"), mobile and email. The club history follows the club and status.
 */
function deskMemberSave_(me, memberId, fields, reason) {
  deskAllow_(me, 'members_master');
  var why = deskReason_(reason);
  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    var ps = privateSs_();
    var master = readTab_(ps, 'members_master');
    var m = master.filter(function (x) { return Core_str(x.member_id) === Core_str(memberId); })[0];
    if (!m) throw deskError_('No one with this ID in the members list.');
    var changes = {};
    DESK_MEMBER_FIELDS.forEach(function (k) {
      if (!(k in fields)) return;
      var v = Core_str(fields[k]).trim();
      var was = k === 'status' ? Core_str(m.status || 'active') : Core_str(m[k]);
      if (v !== was) changes[k] = [was, v];
    });
    if (!Object.keys(changes).length) return { message: 'Nothing changed.', person: deskPerson_(m) };
    if (changes.name && !changes.name[1]) throw deskError_('The name cannot be blank.');
    if (changes.member_id) {
      var nid = changes.member_id[1];
      if (!/^[A-Za-z0-9-]{3,20}$/.test(nid)) throw deskError_('An RI member ID has only digits (and letters for internal IDs).');
      if (master.some(function (x) { return Core_str(x.member_id) === nid; })) throw deskError_('Member ID ' + nid + ' is already in the members list (another card).');
    }
    if (changes.club_id && !clubNameById_(changes.club_id[1])) throw deskError_('Choose a club from the list.');
    var endStatus = changes.status ? changes.status[1] : Core_str(m.status || 'active');
    var endClub = clubs_().filter(function (c) { return Core_str(c.club_id) === (changes.club_id ? changes.club_id[1] : Core_str(m.club_id)); })[0];
    if (endStatus === 'active' && endClub && Core_str(endClub.status || 'active') !== 'active' && (changes.status || changes.club_id)) {
      throw deskError_(endClub.club_name + ' has closed: choose the club the member is in now.');
    }
    if (changes.status && DESK_MEMBER_STATUSES.indexOf(changes.status[1]) < 0) throw deskError_('Status is active, left or deceased.');
    if (changes.mobile && changes.mobile[1] && !Core_mobile(changes.mobile[1])) throw deskError_('The mobile number is not a 10-digit Indian mobile.');
    if (changes.email && changes.email[1] && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(changes.email[1])) throw deskError_('The email address is not complete.');

    var id = changes.member_id ? changes.member_id[1] : Core_str(m.member_id);
    if (changes.member_id) renameMemberId_(ps, changes.member_id[0], id);
    var simple = {};
    ['name', 'mobile', 'email'].forEach(function (k) { if (changes[k]) simple[k] = changes[k][1]; });
    if (Object.keys(simple).length) updateRow_(ps, 'members_master', m._row, simple);
    var fresh = function () { return readTab_(ps, 'members_master').filter(function (x) { return Core_str(x.member_id) === id; })[0]; };
    var st0 = Core_str(m.status || 'active');
    var st1 = changes.status ? changes.status[1] : st0;
    var club1 = changes.club_id ? changes.club_id[1] : Core_str(m.club_id);
    var day = today_();
    var note = 'changed on the desk by ' + me.name;
    if (st1 === 'deceased' && st0 !== 'deceased') {
      if (changes.club_id) updateRow_(ps, 'members_master', m._row, { club_id: club1 });
      markDeceased_(fresh(), me.email);
    } else if (st1 === 'left' && st0 !== 'left') {
      updateRow_(ps, 'members_master', m._row, { status: 'left', club_id: club1 });
      clubChangeEndHistory_(ps, id, day, 'left (' + note + ')');
    } else if (st1 === 'active' && st0 !== 'active') {
      updateRow_(ps, 'members_master', m._row, { status: 'active', club_id: club1 });
      appendRow_(ps, 'club_history', { member_id: id, club_id: club1, from_date: day, reason: 'active again (' + note + ')' });
    } else if (changes.club_id) {
      if (st1 === 'active') clubChangeMove_(ps, fresh(), club1, day, 'moved (' + note + ')', {});
      else updateRow_(ps, 'members_master', m._row, { club_id: club1 });
    }
    changeLog_(changeLogId_(), me, 'member', 'members_master', id, changes, why);
    deskLog_(me, 'member change', 'members_master', id, Object.keys(changes).join(', '));
    refreshPublicMembers(true);
    refreshMemberCounts_();
    try { checkRoles(true); } catch (e) { Logger.log('Role check not run: ' + e.message); }
    contentChanged_();
    var roles = changes.member_id ? ' Roles under the old ID ' + changes.member_id[0] + ' are unchanged: correct them on the Roles tab if they belong to this person.' : '';
    return { message: 'Saved: ' + Object.keys(changes).join(', ') + '. The website shows it ' + NEXT_UPDATE + '.' + roles, person: deskPerson_(fresh()) };
  } finally {
    lock.releaseLock();
  }
}

/** A corrected RI member ID follows the member into the club history, couples and spouse links. */
function renameMemberId_(ps, from, to) {
  readTab_(ps, 'members_master').forEach(function (x) {
    if (Core_str(x.member_id) === from) updateRow_(ps, 'members_master', x._row, { member_id: to });
    if (Core_str(x.spouse_id) === from) updateRow_(ps, 'members_master', x._row, { spouse_id: to });
  });
  readTab_(ps, 'club_history').forEach(function (h) { if (Core_str(h.member_id) === from) updateRow_(ps, 'club_history', h._row, { member_id: to }); });
  readTab_(ps, 'couples').forEach(function (c) {
    if (Core_str(c.person_a_id) === from) updateRow_(ps, 'couples', c._row, { person_a_id: to });
    if (Core_str(c.person_b_id) === from) updateRow_(ps, 'couples', c._row, { person_b_id: to });
  });
}

/* ---------- Roles: club office bearers (Content or Members) and district roles (Members) ---------- */

function deskRoleRow_(tab, r) {
  var club = deskClubName_(r.club_id);
  return { tab: tab, row: r._row, rotary_year: Core_str(r.rotary_year), role: Core_str(r.role), name: Core_str(r.name), member_id: Core_str(r.member_id),
    club: club || '', section: Core_str(r.section), committee: Core_str(r.committee), ended_on: Core_isoDate(r.ended_on) || Core_str(r.ended_on),
    ag: tab === 'functionaries' && /assistant governor/i.test(Core_str(r.role)), ag_clubs: Core_str(r.ag_clubs), zone: Core_str(r.zone) };
}

/** Roles by name, RI member ID or club name; newest year first. */
function deskRoles_(me, q) {
  if (!me.views.members && !me.views.content) throw deskError_('Only Content or Members moderators can do this.');
  var text = Core_str(q).trim();
  var want = Core_plainName(text);
  if (want.length < 3 && !/^\d{3,}$/.test(text)) throw deskError_('Type at least three letters of a name or club, or an RI member ID.');
  var main = mainSs_();
  var tabs = me.views.members ? ['officers', 'functionaries'] : ['officers'];
  var out = [];
  tabs.forEach(function (tab) {
    readTab_(main, tab).forEach(function (r) {
      if (!Core_str(r.name) && !Core_str(r.member_id)) return;
      var hit = Core_str(r.member_id) === text || (want.length >= 3 && (Core_plainName(r.name).indexOf(want) >= 0 || Core_plainName(deskClubName_(r.club_id)).indexOf(want) >= 0));
      if (hit) out.push(deskRoleRow_(tab, r));
    });
  });
  out.sort(function (a, b) { return b.rotary_year.localeCompare(a.rotary_year) || a.club.localeCompare(b.club) || a.role.localeCompare(b.role); });
  return { roles: out.slice(0, 40) };
}

function deskRoleFind_(tab, row) {
  if (tab !== 'officers' && tab !== 'functionaries') throw deskError_('Unknown list.');
  var r = readTab_(mainSs_(), tab).filter(function (x) { return x._row === Number(row); })[0];
  if (!r) throw deskError_('This role is no longer in the Sheet.');
  return r;
}

/** An active member of the members list, by RI member ID. */
function deskActiveMember_(id) {
  var m = readTab_(privateSs_(), 'members_master').filter(function (x) { return Core_str(x.member_id) === Core_str(id).trim(); })[0];
  if (!m) throw deskError_('No one with member ID ' + Core_str(id) + ' in the members list. Add them first (Club updates form), or check the ID.');
  if (Core_str(m.status || 'active') !== 'active') throw deskError_(m.name + ' is marked "' + m.status + '" in the members list.');
  return m;
}

/** Change who holds a role (the member ID; the name follows the members list), a club role's title, an AG's clubs and zone. */
function deskRoleSave_(me, tab, row, fields, reason) {
  deskAllow_(me, tab);
  var why = deskReason_(reason);
  var r = deskRoleFind_(tab, row);
  if (Core_str(r.ended_on)) throw deskError_('This role has ended. Add a new one instead.');
  var update = {};
  if ('member_id' in fields && Core_str(fields.member_id).trim() !== Core_str(r.member_id)) {
    var m = deskActiveMember_(fields.member_id);
    update.member_id = Core_str(m.member_id);
    if (Core_str(m.name) !== Core_str(r.name)) update.name = Core_str(m.name);
  }
  if (tab === 'officers' && 'role' in fields && Core_str(fields.role) !== Core_str(r.role)) {
    if (CORE_CLUB_ROLES.indexOf(Core_str(fields.role)) < 0) throw deskError_('Choose President, Secretary or Executive Secretary.');
    update.role = Core_str(fields.role);
  }
  if (tab === 'functionaries' && /assistant governor/i.test(Core_str(r.role))) {
    if ('ag_clubs' in fields) {
      var clubRows = clubs_();
      var names = [];
      var unknown = [];
      Core_list(fields.ag_clubs).forEach(function (v) {
        var cid = Core_clubRef(v, clubRows);
        if (!cid) unknown.push(v);
        else if (names.indexOf(clubNameById_(cid)) < 0) names.push(clubNameById_(cid));
      });
      if (unknown.length) throw deskError_('Not in the club list: ' + unknown.join(', ') + '. Use the club names as the list shows them.');
      if (names.join(', ') !== Core_str(r.ag_clubs)) update.ag_clubs = names.join(', ');
    }
    if ('zone' in fields && Core_str(fields.zone) !== Core_str(r.zone)) {
      if (Core_str(fields.zone) && Core_list(settings_().zones).indexOf(Core_str(fields.zone)) < 0) throw deskError_('Choose an area from the list.');
      update.zone = Core_str(fields.zone);
    }
  }
  if (!Object.keys(update).length) return { message: 'Nothing changed.', role: deskRoleRow_(tab, r) };
  var changes = {};
  Object.keys(update).forEach(function (k) { changes[k] = [Core_str(r[k]), update[k]]; });
  updateRow_(mainSs_(), tab, r._row, update);
  changeLog_(changeLogId_(), me, 'role', tab, r._row, changes, why);
  deskLog_(me, 'role change', tab, r._row, Object.keys(update).join(', '));
  try { checkRoles(true); } catch (e) { Logger.log('Role check not run: ' + e.message); }
  contentChanged_();
  return { message: 'Saved. The website shows it ' + NEXT_UPDATE + '.', role: deskRoleRow_(tab, deskRoleFind_(tab, row)) };
}

/** Someone no longer holds a role (resigned, replaced): the row stays, marked ended, and the website stops showing it. */
function deskRoleEnd_(me, tab, row, reason) {
  deskAllow_(me, tab);
  var why = deskReason_(reason);
  var r = deskRoleFind_(tab, row);
  if (Core_str(r.ended_on)) return { message: 'This role had already ended.', role: deskRoleRow_(tab, r) };
  var day = today_();
  updateRow_(mainSs_(), tab, r._row, { ended_on: day });
  changeLog_(changeLogId_(), me, 'end role', tab, r._row, { ended_on: ['', day] }, why);
  deskLog_(me, 'end role', tab, r._row, '');
  try { checkRoles(true); } catch (e) { Logger.log('Role check not run: ' + e.message); }
  contentChanged_();
  return { message: Core_str(r.name) + ' no longer shows as ' + Core_str(r.role) + ' (' + Core_str(r.rotary_year) + ') ' + NEXT_UPDATE + '.', role: deskRoleRow_(tab, deskRoleFind_(tab, row)) };
}

/** A club's President, Secretary or Executive Secretary for this or next Rotary year (one holder of each at a time). */
function deskRoleAdd_(me, f, reason) {
  deskAllow_(me, 'officers');
  var why = deskReason_(reason);
  var clubId = Core_str(f.club_id);
  if (!clubNameById_(clubId)) throw deskError_('Choose a club from the list.');
  var year = Core_str(f.rotary_year);
  var thisYear = Core_rotaryYearOf(today_());
  if ([thisYear, Core_nextRotaryYear(thisYear)].indexOf(year) < 0) throw deskError_('Choose ' + thisYear + ' or ' + Core_nextRotaryYear(thisYear) + '.');
  var role = Core_str(f.role);
  if (CORE_CLUB_ROLES.indexOf(role) < 0) throw deskError_('Choose President, Secretary or Executive Secretary.');
  var m = deskActiveMember_(f.member_id);
  var held = readTab_(mainSs_(), 'officers').filter(function (o) {
    return Core_str(o.club_id) === clubId && Core_str(o.rotary_year) === year && Core_str(o.role) === role && !Core_str(o.ended_on);
  })[0];
  if (held) throw deskError_(Core_str(held.name) + ' is already ' + role + ' of ' + clubNameById_(clubId) + ' for ' + year + '. End that role first, or change who holds it.');
  var row = appendRow_(mainSs_(), 'officers', { rotary_year: year, club_id: clubId, member_id: Core_str(m.member_id), name: Core_str(m.name), role: role, contact_ok: false });
  changeLog_(changeLogId_(), me, 'add role', 'officers', row, { role: ['', role + ', ' + clubNameById_(clubId) + ', ' + year + ': ' + Core_str(m.name) + ' (' + m.member_id + ')'] }, why);
  deskLog_(me, 'add role', 'officers', row, '');
  try { checkRoles(true); } catch (e) { Logger.log('Role check not run: ' + e.message); }
  contentChanged_();
  var other = Core_str(m.club_id) && Core_str(m.club_id) !== clubId ? ' Note: the members list has ' + m.name + ' in ' + clubNameById_(m.club_id) + '.' : '';
  return { message: Core_str(m.name) + ' is added as ' + role + ' of ' + clubNameById_(clubId) + ' (' + year + ').' + other };
}

/** The daily role check's findings, for Members moderators to fix on the desk. */
function deskRoleChecks_() {
  var main = mainSs_();
  if (!main.getSheetByName('role_checks')) return [];
  return readTab_(main, 'role_checks').slice(0, 100).map(function (p) {
    return { tab: Core_str(p.tab), row: Number(p.row) || '', rotary_year: Core_str(p.rotary_year), name: Core_str(p.name), member_id: Core_str(p.member_id), problem: Core_str(p.problem) };
  });
}

/* ---------- Clubs (Administrators) ---------- */

function deskClubRow_(c) {
  return { club_id: Core_str(c.club_id), club_name: Core_str(c.club_name), city: Core_str(c.city), zone: Core_str(c.zone), status: Core_str(c.status || 'active'),
    charter_date: Core_isoDate(c.charter_date), member_count: Number(c.member_count) || 0, merged_into: deskClubName_(c.merged_into) || '' };
}

function deskClubCheck_(f, except) {
  var name = Core_str(f.club_name).trim();
  if (name.length < 4) throw deskError_('Please write the club\'s name, for example RC Agra Heritage.');
  var clash = clubs_().filter(function (c) { return Core_str(c.club_id) !== except && Core_plainName(c.club_name) === Core_plainName(name); })[0];
  if (clash) throw deskError_(name + ' is already in the club list (club ID ' + clash.club_id + ').');
  if (Core_str(f.zone) && Core_list(settings_().zones).indexOf(Core_str(f.zone)) < 0) throw deskError_('Choose an area from the list.');
  if (Core_str(f.charter_date) && !Core_isoDate(f.charter_date)) throw deskError_('The charter date is not a date.');
  return name;
}

/** A new club: its RI club ID, name, city, zone and charter date. The forms list it at once. */
function deskClubAdd_(me, f, reason) {
  deskAllow_(me, 'clubs');
  var why = deskReason_(reason);
  var id = Core_str(f.club_id).trim();
  if (!/^\d{3,10}$/.test(id)) throw deskError_('The RI club ID has only digits.');
  if (clubs_().some(function (c) { return Core_str(c.club_id) === id; })) throw deskError_('Club ID ' + id + ' is already in the club list.');
  var name = deskClubCheck_(f, '');
  if (!Core_str(f.city).trim()) throw deskError_('Please write the club\'s city.');
  var slug = Core_slug(name);
  var slugs = clubs_().map(function (c) { return Core_str(c.slug) || Core_slug(c.club_name); });
  while (slugs.indexOf(slug) >= 0) slug += '-' + id.slice(-2);
  var row = { club_id: id, club_name: name, slug: slug, city: Core_str(f.city).trim(), zone: Core_str(f.zone), status: 'active', member_count: 0,
    charter_date: Core_isoDate(f.charter_date) || '' };
  appendRow_(mainSs_(), 'clubs', row);
  changeLog_(changeLogId_(), me, 'add club', 'clubs', id, { club_name: ['', name], city: ['', row.city], zone: ['', row.zone], charter_date: ['', row.charter_date] }, why);
  deskLog_(me, 'add club', 'clubs', id, name);
  DESK_CLUB_NAMES = null;
  try { updateFormLists(true); } catch (e) { Logger.log('Form lists not updated: ' + e.message); }
  contentChanged_();
  return { message: name + ' is added. The forms list it now; the website shows it ' + NEXT_UPDATE + '.', club: deskClubRow_(row) };
}

/** Rename a club or correct its city, zone or charter date. A new name keeps the old one as a former name and the same web address. */
function deskClubSave_(me, clubId, f, reason) {
  deskAllow_(me, 'clubs');
  var why = deskReason_(reason);
  var c = clubs_().filter(function (x) { return Core_str(x.club_id) === Core_str(clubId); })[0];
  if (!c) throw deskError_('Unknown club.');
  var update = {};
  if ('club_name' in f && Core_str(f.club_name).trim() !== Core_str(c.club_name)) {
    update.club_name = deskClubCheck_(f, Core_str(c.club_id));
    var former = Core_list(c.former_names);
    if (former.indexOf(Core_str(c.club_name)) < 0) former.push(Core_str(c.club_name));
    update.former_names = former.join(', ');
    if (Core_str(c.display_name)) update.display_name = '';
  } else if ('zone' in f || 'charter_date' in f) {
    deskClubCheck_({ club_name: c.club_name, zone: f.zone, charter_date: f.charter_date }, Core_str(c.club_id));
  }
  if ('city' in f && Core_str(f.city).trim() && Core_str(f.city).trim() !== Core_str(c.city)) update.city = Core_str(f.city).trim();
  if ('zone' in f && Core_str(f.zone) !== Core_str(c.zone)) update.zone = Core_str(f.zone);
  if ('charter_date' in f && (Core_isoDate(f.charter_date) || '') !== (Core_isoDate(c.charter_date) || '')) update.charter_date = Core_isoDate(f.charter_date) || '';
  if (!Object.keys(update).length) return { message: 'Nothing changed.', club: deskClubRow_(c) };
  var changes = {};
  Object.keys(update).forEach(function (k) { changes[k] = [k === 'charter_date' ? Core_isoDate(c[k]) || '' : Core_str(c[k]), update[k]]; });
  updateRow_(mainSs_(), 'clubs', c._row, update);
  changeLog_(changeLogId_(), me, 'club', 'clubs', c.club_id, changes, why);
  deskLog_(me, 'club change', 'clubs', c.club_id, Object.keys(update).join(', '));
  DESK_CLUB_NAMES = null;
  if (update.club_name) { try { updateFormLists(true); } catch (e) { Logger.log('Form lists not updated: ' + e.message); } }
  contentChanged_();
  return { message: 'Saved. The website shows it ' + NEXT_UPDATE + '.', club: deskClubRow_(clubs_().filter(function (x) { return x._row === c._row; })[0]) };
}

/**
 * A club closes: it leaves the forms and the website's club list, and its active members either move to the club it
 * merged into or are marked as left. Their club history records it.
 */
function deskClubClose_(me, clubId, moveTo, reason) {
  deskAllow_(me, 'clubs');
  var why = deskReason_(reason);
  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    var all = clubs_();
    var c = all.filter(function (x) { return Core_str(x.club_id) === Core_str(clubId); })[0];
    if (!c) throw deskError_('Unknown club.');
    if (Core_str(c.status || 'active') !== 'active') throw deskError_(c.club_name + ' is already closed.');
    var target = Core_str(moveTo);
    if (target) {
      var t = all.filter(function (x) { return Core_str(x.club_id) === target; })[0];
      if (!t || target === Core_str(c.club_id) || Core_str(t.status || 'active') !== 'active') throw deskError_('Choose an open club for the members to move to.');
    }
    var ps = privateSs_();
    var day = today_();
    var moved = 0;
    readTab_(ps, 'members_master').forEach(function (m) {
      if (Core_str(m.club_id) !== Core_str(c.club_id) || Core_str(m.status || 'active') !== 'active') return;
      if (target) clubChangeMove_(ps, m, target, day, 'club merged into ' + clubNameById_(target), {});
      else {
        updateRow_(ps, 'members_master', m._row, { status: 'left' });
        clubChangeEndHistory_(ps, m.member_id, day, 'club closed');
      }
      moved++;
    });
    updateRow_(mainSs_(), 'clubs', c._row, { status: 'inactive', merged_into: target });
    changeLog_(changeLogId_(), me, 'close club', 'clubs', c.club_id, { status: ['active', 'inactive'], merged_into: ['', target] }, why);
    deskLog_(me, 'close club', 'clubs', c.club_id, moved + ' member(s) ' + (target ? 'moved' : 'marked left'));
    refreshPublicMembers(true);
    refreshMemberCounts_();
    try { updateFormLists(true); } catch (e) { Logger.log('Form lists not updated: ' + e.message); }
    contentChanged_();
    return { message: c.club_name + ' is closed. ' + moved + ' member(s) ' + (target ? 'moved to ' + clubNameById_(target) : 'marked as left') + '. The website shows it ' + NEXT_UPDATE + '.' };
  } finally {
    lock.releaseLock();
  }
}

/* ---------- Moderators (Administrators) ---------- */

function deskModeratorRow_(r) {
  return { row: r._row, type: Core_str(r.type), name: Core_str(r.name), email: Core_str(r.email), active: Core_moderatorActive(r),
    zone: Core_str(r.zone), notes: Core_str(r.notes) };
}

function deskModerators_() {
  return deskModeratorRows_().filter(function (r) { return Core_str(r.email); }).map(deskModeratorRow_);
}

/** Adds a moderator (row blank) or changes one: type, name, email, zone, active. Desk only: Sheet access stays with the owner. */
function deskModeratorSave_(me, row, f, reason) {
  deskAllow_(me, 'moderators');
  var why = deskReason_(reason);
  var main = mainSs_();
  var current = row ? readTab_(main, 'moderators').filter(function (r) { return r._row === Number(row); })[0] : null;
  if (row && !current) throw deskError_('This moderator row is no longer in the Sheet.');
  var next = {
    type: 'type' in f ? Core_str(f.type) : Core_str(current && current.type),
    name: 'name' in f ? Core_str(f.name).trim() : Core_str(current && current.name),
    email: 'email' in f ? Core_str(f.email).trim().toLowerCase() : Core_str(current && current.email),
    zone: 'zone' in f ? Core_list(f.zone).join(', ') : Core_str(current && current.zone),
    active: 'active' in f ? (f.active === false || Core_str(f.active).toUpperCase() === 'FALSE' ? 'FALSE' : 'TRUE') : Core_str(current && current.active) || 'TRUE',
  };
  if (CORE_MODERATOR_TYPES.indexOf(next.type) < 0) throw deskError_('Choose a type of moderator.');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(next.email)) throw deskError_('Please write the moderator\'s Google email address.');
  if (!next.name) throw deskError_('Please write the moderator\'s name.');
  var zones = Core_list(settings_().zones);
  Core_list(next.zone).forEach(function (z) { if (zones.indexOf(z) < 0) throw deskError_('Choose areas from the list.'); });
  if (next.email === me.email && next.active === 'FALSE') throw deskError_('You cannot take yourself off the moderators list. Ask another Administrator.');
  var clash = readTab_(main, 'moderators').filter(function (r) {
    return r._row !== (current && current._row) && Core_str(r.email).toLowerCase() === next.email && Core_str(r.type) === next.type;
  })[0];
  if (clash) throw deskError_(next.email + ' is already a ' + next.type + ' moderator (change that row instead).');
  var changes = {};
  Object.keys(next).forEach(function (k) { if (!current || Core_str(current[k]) !== next[k]) changes[k] = [current ? Core_str(current[k]) : '', next[k]]; });
  if (!Object.keys(changes).length) return { message: 'Nothing changed.' };
  var at;
  if (current) {
    updateRow_(main, 'moderators', current._row, next);
    at = current._row;
  } else {
    next.from_date = today_();
    next.sheet_access = 'FALSE';
    next.notes = 'Added on the moderation desk by ' + me.name;
    at = appendRow_(main, 'moderators', next);
  }
  changeLog_(changeLogId_(), me, current ? 'moderator' : 'add moderator', 'moderators', at, changes, why);
  deskLog_(me, current ? 'moderator change' : 'add moderator', 'moderators', at, next.type);
  return { message: (current ? 'Saved.' : next.name + ' is added as a ' + next.type + ' moderator. They sign in to the desk with their email; no Sheet access is needed.'),
    moderators: deskModerators_() };
}

/* ---------- Content: approve all clean, hide a published activity (Content moderators) ---------- */

/** Approves the given waiting activities that are still clean (Core_activityChecks finds nothing); the rest stay for a full look. */
function deskApproveClean_(me, ids) {
  if (!me.views.content) throw deskError_('Only Content moderators can do this.');
  var want = (ids || []).map(function (x) { return Core_str(x).toLowerCase(); }).filter(String);
  if (!want.length) throw deskError_('Tick at least one activity.');
  if (want.length > DESK_CLEAN_MAX) throw deskError_('At most ' + DESK_CLEAN_MAX + ' at a time.');
  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    var done = [];
    var left = [];
    readTab_(mainSs_(), 'activities').forEach(function (r) {
      if (want.indexOf(Core_str(r.id).toLowerCase()) < 0) return;
      if (Core_str(r.status) !== 'pending') return;
      if (Core_activityChecks(r).length || approveBlock_('activities', r)) { left.push(Core_str(r.id)); return; }
      approveRow_('activities', r, me.email);
      deskLog_(me, 'approve (clean)', 'activities', r.id, '');
      done.push(Core_str(r.id));
    });
    return { approved: done, left: left, message: 'Approved ' + done.length + ' activit' + (done.length === 1 ? 'y' : 'ies') + '; the website shows them ' + NEXT_UPDATE + '.' +
      (left.length ? ' ' + left.length + ' need a full look first: ' + left.join(', ') + '.' : '') };
  } finally {
    lock.releaseLock();
  }
}

/** Takes a published activity off the website (status hidden) with a reason; Put back undoes it. The club is not emailed. */
function deskHide_(me, id, reason) {
  if (!me.views.content) throw deskError_('Only Content moderators can do this.');
  var why = deskReason_(reason);
  var r = deskFind_('activities', id);
  if (Core_str(r.status) !== 'approved') throw deskError_('Only a published activity can be hidden.');
  updateRow_(mainSs_(), 'activities', r._row, { status: 'hidden', hidden_by: me.email, hidden_at: nowIso_(),
    moderator_note: [Core_str(r.moderator_note), 'Hidden by ' + me.name + ' on ' + today_() + ': ' + why].filter(String).join('; ') });
  deskLog_(me, 'hide', 'activities', r.id, why);
  contentChanged_();
  return { message: Core_str(r.title) + ' comes off the website ' + NEXT_UPDATE + '.' };
}

function deskPutBack_(me, id) {
  if (!me.views.content) throw deskError_('Only Content moderators can do this.');
  var r = deskFind_('activities', id);
  if (Core_str(r.status) !== 'hidden') throw deskError_('This activity is not hidden.');
  updateRow_(mainSs_(), 'activities', r._row, { status: 'approved', hidden_by: '', hidden_at: '',
    moderator_note: [Core_str(r.moderator_note), 'Put back by ' + me.name + ' on ' + today_()].filter(String).join('; ') });
  deskLog_(me, 'put back', 'activities', r.id, '');
  contentChanged_();
  return { message: Core_str(r.title) + ' is back on the website ' + NEXT_UPDATE + '.' };
}

/* ---------- Lists the desk's forms choose from ---------- */

function deskLists_() {
  var year = Core_rotaryYearOf(today_());
  return {
    clubs: clubs_().filter(function (c) { return Core_str(c.status || 'active') === 'active'; })
      .map(function (c) { return { id: Core_str(c.club_id), name: Core_str(c.club_name) }; })
      .sort(function (a, b) { return a.name.localeCompare(b.name); }),
    zones: Core_list(settings_().zones),
    years: [year, Core_nextRotaryYear(year)],
    club_roles: CORE_CLUB_ROLES.slice(),
    moderator_types: CORE_MODERATOR_TYPES.slice(),
  };
}


// ===== Jobs.js =====
/**
 * Daily at 7 am (India): 48-hour reminders to moderators, the monthly-nudge dashboard, the role check, new magazines,
 * the forms' lists (so a campaign drops off the activity form 30 days after it ends), and in July and August the
 * yearly check email to listed members.
 */

function dailyJobs() {
  scanMagazines_();
  try { refreshMemberCounts_(); } catch (e) { Logger.log('Member counts not refreshed: ' + e.message); }
  refreshDashboard();
  checkRoles(true);
  try { updateFormLists(true); } catch (e) { Logger.log('Form lists not updated: ' + e.message); }
  sendReminders_();
  try { memberCheckEmails_(); } catch (e) { Logger.log('July member check not sent: ' + e.message); } // last: it uses what email allowance is left
}

/* ---------- Weekly bulletin emails ---------- */

/**
 * Who gets an email, by moderator type (the moderators tab). If no one of that type is named yet: the older
 * setting (legacyKey), then the Content moderators, then moderator_emails, then the district account.
 */
function moderatorRecipients_(type, legacyKey) {
  var s = settings_();
  var rows = mainSs_().getSheetByName('moderators') ? readTab_(mainSs_(), 'moderators') : [];
  var list = Core_moderatorEmails(rows, type || 'Content');
  if (!list.length && legacyKey) list = Core_list(s[legacyKey]);
  if (!list.length && type && type !== 'Content') list = Core_moderatorEmails(rows, 'Content');
  if (!list.length) list = Core_list(s.moderator_emails);
  return list.join(',') || Session.getEffectiveUser().getEmail();
}

/**
 * Saturday 6 pm: the coming Sunday's bulletin, so moderators can leave something out before it is published.
 * Nothing to do if it looks right.
 */
function bulletinPreview() {
  var today = today_();
  var sunday = Core_addDays(Core_sundayOf(today), 7);
  var data = publicData_();
  var b = Core_bulletin(data, sunday);
  var s = settings_();
  var items = []; // [label, tab, id]
  b.events.forEach(function (e) { items.push(['Coming up: ' + e.title, 'events', e.id]); });
  b.closing.forEach(function (e) { items.push(['Registration closing: ' + e.title, 'events', e.id]); });
  b.done.items.forEach(function (a) { items.push(['Done last week: ' + a.title + ' (' + a.club_name + ')', 'activities', a.id]); });
  b.campaigns.forEach(function (c) { items.push(['Campaign: ' + c.name, '', c.campaign_id]); });
  var skipped = data.skipped_items || [];
  var message = Core_bulletinMessage(b, s.site_url);
  var more = b.done.more ? '…and ' + b.done.more + ' more activities, counted but not listed.' : '';
  var skippedLine = skipped.length ? 'Left out of the website because they contain a phone number, email or payment details: ' + skipped.join('; ') : '';
  var subject = new Date(today + 'T00:00:00Z').getUTCDay() === 6 ? "Tomorrow's bulletin – no action needed"
    : 'Bulletin for Sunday ' + Core_dateLabel(sunday) + ' – no action needed';
  // one email per Content moderator, each with their own "Leave this out" links
  moderatorRecipients_('Content').split(',').filter(String).forEach(function (email) {
    var desk = Core_deskViews(deskTypes_(email)).content && deskLink_({});
    var leave = function (it) { return desk && it[1] ? deskLink_({ a: deskToken_('bx', it[1], it[2], email, 2 * 1440) }) : ''; };
    var text = message + '\n\n----------\nChosen items (row ids):\n' +
      (items.map(function (it) { return it[0] + ' – ' + it[2] + (leave(it) ? '\n   Leave this out: ' + leave(it) : ''); }).join('\n') || '(none: a quiet week)') +
      (more ? '\n' + more : '') + '\n\nNothing to do if this looks right. To leave something out, ' +
      (desk ? 'use its "Leave this out" link before Sunday 6 am.' : 'set bulletin_exclude to TRUE on that row in the activities or events tab before Sunday 6 am.') +
      (skippedLine ? '\n\n' + skippedLine : '');
    var html = '<div style="font:15px/1.5 Arial,sans-serif;color:#1c2430;max-width:600px"><p><strong>Nothing to do if this looks right.</strong> ' +
      'To leave something out, tap its button before Sunday 6 am.</p><table style="border-collapse:collapse">' +
      (items.map(function (it) {
        return '<tr><td style="padding:6px 10px 6px 0;border-bottom:1px solid #dde3ec">' + escHtml_(it[0]) + '</td><td style="border-bottom:1px solid #dde3ec">' +
          (leave(it) ? '<a href="' + escHtml_(leave(it)) + '" style="color:#b3261e;font-weight:bold;white-space:nowrap">Leave this out</a>' : '') + '</td></tr>';
      }).join('') || '<tr><td>(none: a quiet week)</td></tr>') + '</table>' + (more ? '<p>' + escHtml_(more) + '</p>' : '') +
      (skippedLine ? '<p style="background:#fff4dc;padding:8px 10px;border-radius:6px">' + escHtml_(skippedLine) + '</p>' : '') +
      '<p style="color:#5b6573">The WhatsApp message as it will be sent:</p><pre style="white-space:pre-wrap;font:14px/1.45 Arial,sans-serif;background:#f4f6fa;padding:10px;border-radius:6px">' +
      escHtml_(message) + '</pre></div>';
    MailApp.sendEmail(email, subject, text, desk ? { htmlBody: html, name: 'Rotary 3110 website' } : { name: 'Rotary 3110 website' });
  });
  try { SpreadsheetApp.getUi().alert('Bulletin preview sent to ' + moderatorRecipients_('Content') + '.'); } catch (e) { /* timed run */ }
}

/**
 * Sunday 8 am: the WhatsApp message for this week's bulletin, for someone to forward to the district groups.
 * The message links to this week's bulletin page, so it is sent only once that page is on the website. If the
 * Sunday build is late, it asks for a rebuild and tries again every hour (up to four times), then sends anyway.
 */
function bulletinMessage(force) {
  var props = props_();
  var sunday = Core_sundayOf(today_());
  if (force !== true && props.getProperty('BULLETIN_SENT') === sunday) return 'already sent';
  var s = settings_();
  var site = Core_str(s.site_url).replace(/\/?$/, '/');
  var live = false;
  try {
    live = UrlFetchApp.fetch(site + 'bulletin/' + sunday + '/', { muteHttpExceptions: true }).getResponseCode() === 200;
  } catch (e) { live = false; }
  var tries = (props.getProperty('BULLETIN_TRIES') || '').split(':');
  var count = tries[0] === sunday ? Number(tries[1]) || 0 : 0;
  if (!live && force !== true && count < 4) {
    props.setProperty('BULLETIN_TRIES', sunday + ':' + (count + 1));
    setSetting_('rebuild_requested_at', nowIso_());
    ScriptApp.newTrigger('bulletinMessageRetry').timeBased().after(60 * 60 * 1000).create();
    return 'waiting for the website';
  }
  var text = Core_bulletinMessage(Core_bulletin(publicData_(), sunday), site);
  var to = moderatorRecipients_('District office', 'bulletin_emails');
  MailApp.sendEmail(to, "This week's bulletin – please forward to the district groups", text +
    (live ? '' : '\n\n(The bulletin page was not on the website yet when this was sent. The link will work once the website has updated.)'));
  props.setProperty('BULLETIN_SENT', sunday);
  return 'sent';
}

function bulletinMessageRetry() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'bulletinMessageRetry') ScriptApp.deleteTrigger(t);
  });
  bulletinMessage();
}

/** Menu: send this week's message again now (for example to a new address). */
function sendBulletinMessageNow() {
  bulletinMessage(true);
  try { SpreadsheetApp.getUi().alert("This week's bulletin message was sent to " + moderatorRecipients_('District office', 'bulletin_emails') + '.'); } catch (e) { /* editor */ }
}

function sendReminders_() {
  var now = Date.now();
  var main = mainSs_();
  var ps = privateSs_();
  // Content moderators get the activities, events, club profiles and services; Members moderators the member requests
  var content = [];
  MODERATED_TABS.forEach(function (t) {
    Core_overdue(readTab_(main, t), now, CONFIG.REMINDER_HOURS).forEach(function (r) { content.push(t + ': ' + r.id + ' – ' + (r.title || r.name || r.business_name || r.club_name || '')); });
  });
  var members = [];
  var sender = consentChecker_(ps);
  ['consent_requests', 'removal_requests', 'club_change_requests'].forEach(function (t) {
    Core_overdue(readTab_(ps, t), now, CONFIG.REMINDER_HOURS).forEach(function (r) {
      if (t === 'consent_requests' && consentHoldUntil_(r, sender(r)) > now) return; // still waiting for the member to object
      members.push(t + ': ' + r.id + ' – ' + r.name);
    });
  });
  var desk = deskLink_({});
  [[content, 'Content', 'Open the Sheet and use the Rotary menu to approve or reject:'],
    [members, 'Members', 'Open the Sheet and use Rotary → Member requests. Removal requests should be handled within two days:']].forEach(function (job) {
    if (!job[0].length) return;
    MailApp.sendEmail(moderatorRecipients_(job[1]), 'Rotary 3110 website: ' + job[0].length + ' item(s) waiting more than 48 hours',
      'These are waiting for a moderator:\n\n' + job[0].join('\n') + '\n\n' +
      (desk ? 'Open the moderation desk: ' + desk + (job[1] === 'Members' ? '\nRemoval requests should be handled within two days.' : '') + '\n\nOr ' +
        job[2].charAt(0).toLowerCase() + job[2].slice(1) : job[2]) + '\n' + main.getUrl());
  });
}

/**
 * 1st of each month: a private email listing the quiet clubs (no activity dated in the last 30 days, the same rule
 * as the desk's Quiet clubs and the dashboard), with each club's last activity, so the district team can follow up.
 * Never shown on the website. Goes to the Club engagement moderators (until they are named: not_posting_emails, a dummy address).
 */
function notPostingReport() {
  var list = Core_quietClubs(clubs_(), readTab_(mainSs_(), 'activities'), today_(), CORE_QUIET_DAYS);
  var label = 'the last ' + CORE_QUIET_DAYS + ' days';
  var to = moderatorRecipients_('Club engagement', 'not_posting_emails');
  var body = list.length
    ? list.length + ' club(s) posted no activity dated in ' + label + ':\n\n' + list.map(function (c) {
      return '• ' + c.club_name + (c.last_activity_date ? ' (last activity ' + Core_dateLabel(c.last_activity_date) + ')' : ' (no activity yet)');
    }).join('\n') + '\n\nThis list is private and is not shown on the website.'
    : 'Every active club posted at least one activity dated in ' + label + '.';
  var desk = deskLink_({});
  MailApp.sendEmail(to, 'Clubs with no activity in ' + label, body + (desk && list.length ? '\n\nTo send a club a reminder by email or WhatsApp, open the moderation desk: ' + desk : '') +
    '\n\nRotary District 3110 website');
  return list.length;
}

function sendNotPostingNow() {
  var n = notPostingReport();
  try { SpreadsheetApp.getUi().alert('Sent to ' + moderatorRecipients_('Club engagement', 'not_posting_emails') + ': ' + n + ' club(s) listed.'); } catch (e) { /* editor */ }
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
  var all = readTab_(ss, 'activities');
  var acts = all.filter(function (a) { return ['approved', 'pending'].indexOf(Core_str(a.status)) >= 0 && !Core_isPractice(a); });
  var quiet = {}; // the same rule as the desk's Quiet clubs and the monthly email
  Core_quietClubs(clubs_(), all, today, CORE_QUIET_DAYS).forEach(function (c) { quiet[c.club_id] = true; });
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
      needs_nudge: !!quiet[Core_str(c.club_id)],
    };
  }).sort(function (a, b) { return (a.last_activity_date || '').localeCompare(b.last_activity_date || ''); });
  replaceRows_(ss, 'dashboard', rows);
  var posting = rows.filter(function (r) { return r.activities_this_rotary_year > 0; }).length;
  setSetting_('clubs_posting_this_rotary_year', posting + ' of ' + rows.length + ' clubs (' + Math.round(100 * posting / Math.max(1, rows.length)) + '%)');
}

/**
 * Lists office bearers and team members whose member ID is missing or does not match the private
 * members list, and roles still held by someone marked deceased or left, in the role_checks tab.
 * Each person's roles join up on one member card only when the member ID is right.
 */
function checkRoles(silent) {
  var ss = mainSs_();
  var problems = Core_checkRoles(readTab_(ss, 'officers'), readTab_(ss, 'functionaries'), readTab_(privateSs_(), 'members_master'),
    Core_str(settings_().current_rotary_year));
  var at = nowIso_();
  replaceRows_(ss, 'role_checks', problems.map(function (p) { p.checked_at = at; return p; }));
  if (silent === true) return problems.length;
  try {
    SpreadsheetApp.getUi().alert(problems.length
      ? problems.length + ' thing(s) to check. They are listed in the role_checks tab, most urgent first.'
      : 'All roles have a member ID that matches the members list.');
  } catch (e) { /* called from code */ }
  return problems.length;
}

/* ---------- The yearly July check with listed members ---------- */

/**
 * July and August, from the daily jobs: each listed member is emailed once a year what the website shows about
 * them, with the forms to change or remove it. Up to 80 a day, so about 500 members take a week and the day's
 * allowance still has room for moderators and replies. today: for tests.
 */
function memberCheckEmails_(today) {
  var ps = privateSs_();
  var due = Core_memberCheckDue(readTab_(ps, 'members_master'), today || today_());
  var stamp = today ? today + 'T07:00:00Z' : nowIso_(); // a test's day also dates the record
  if (!due.length) return 0;
  var room = Math.min(CORE_MEMBER_CHECK_PER_DAY, MailApp.getRemainingDailyQuota() - 20);
  var s = settings_();
  var forms = { consent: Core_str(s.form_consent_url), removal: Core_str(s.form_removal_url) };
  var sent = 0;
  due.slice(0, Math.max(0, room)).forEach(function (m) {
    var mail = Core_memberCheckEmail(m, clubNameById_(m.club_id), s.site_url, forms);
    try {
      MailApp.sendEmail(Core_str(m.email), mail.subject, mail.body, { name: 'Rotary District 3110' });
    } catch (e) {
      Logger.log('Member check to ' + m.member_id + ' failed: ' + e.message);
      return;
    }
    updateRow_(ps, 'members_master', m._row, { member_check_sent_at: stamp });
    sent++;
  });
  return sent;
}

/** Menu: the July email for one listed member, sent to whoever asks, so the owner can read it before July. */
function sendMemberCheckSample() {
  var m = Core_memberCheckDue(readTab_(privateSs_(), 'members_master'), today_(), true)[0];
  var me = Session.getActiveUser().getEmail() || Session.getEffectiveUser().getEmail();
  var msg;
  if (!m) {
    msg = 'No listed member with an email to make a sample from.';
  } else {
    var s = settings_();
    var mail = Core_memberCheckEmail(m, clubNameById_(m.club_id), s.site_url, { consent: Core_str(s.form_consent_url), removal: Core_str(s.form_removal_url) });
    MailApp.sendEmail(me, 'SAMPLE – ' + mail.subject, 'This is a sample of the July email, made from member ' + m.member_id +
      '. It was sent only to you.\n\n----------\n\n' + mail.body, { name: 'Rotary District 3110' });
    msg = 'A sample of the July member email was sent to ' + me + '.';
  }
  try { SpreadsheetApp.getUi().alert(msg); } catch (e) { /* editor */ }
  return msg;
}

/* ---------- The weekly summary for the owner ---------- */

/**
 * Monday 8 am: one private email to the owner on how the website is doing: the last build, what went live in the
 * last 7 days, what is waiting for moderators, removals past their 2-day limit, contact messages not yet answered,
 * the quiet clubs and, in July and August, the member check. Goes to summary_emails, or the district account.
 */
function weeklySummary() {
  var now = Date.now();
  var today = today_();
  var weekAgo = now - 7 * 86400000;
  var main = mainSs_();
  var ps = privateSs_();
  var s = settings_();
  var site = Core_str(s.site_url).replace(/\/?$/, '/');
  var real = function (r) { return !Core_isPractice(r) && !Core_isTrue(r.is_sample); };
  var out = [];

  var built = '';
  try { built = Core_str(JSON.parse(UrlFetchApp.fetch(site + 'build-info.json', { muteHttpExceptions: true }).getContentText()).generated_at); } catch (e) { built = ''; }
  var asked = Core_str(s.rebuild_requested_at);
  out.push('THE WEBSITE\n' + (built ? 'Last built: ' + Core_dateLabel(Core_isoDate(new Date(built))) + ' (' + built.slice(11, 16) + ' UTC).' : 'Could not read when the website was last built.') +
    (asked && built && asked > built ? '\nA rebuild was asked for on ' + Core_dateLabel(Core_isoDate(new Date(asked))) + ' and has not run yet: check the Actions tab on GitHub.' : ''));

  var labels = { activities: 'activities', events: 'events', public_services: 'public services', club_profile_requests: 'club profile updates',
    businesses: 'business listings' };
  var live = [];
  var waiting = [];
  var titles = [];
  Object.keys(labels).forEach(function (t) {
    var rows = readTab_(main, t).filter(real);
    var went = rows.filter(function (r) { return Core_str(r.status) === 'approved' && new Date(r.approved_at).getTime() >= weekAgo; });
    var wait = rows.filter(function (r) { return Core_str(r.status) === 'pending'; }).length;
    if (went.length) live.push(went.length + ' ' + labels[t]);
    if (wait) waiting.push(wait + ' ' + labels[t]);
    if (t === 'activities') went.forEach(function (r) { titles.push(Core_str(r.title) + ' (' + (Core_str(r.club_name) || clubNameById_(r.club_id)) + ')'); });
  });
  out.push('WENT LIVE IN THE LAST 7 DAYS\n' + (live.length ? live.join(', ') + '.' + (titles.length ? '\n' + titles.slice(0, 10).map(function (x) { return '• ' + x; }).join('\n') +
    (titles.length > 10 ? '\n…and ' + (titles.length - 10) + ' more.' : '') : '') : 'Nothing new was approved.'));

  var consent = readTab_(ps, 'consent_requests').filter(real).filter(function (r) { return Core_str(r.status) === 'pending'; }).length;
  var removals = readTab_(ps, 'removal_requests').filter(real).filter(function (r) { return Core_str(r.status) === 'pending'; });
  if (consent) waiting.push(consent + ' member consent forms');
  if (removals.length) waiting.push(removals.length + ' removal requests');
  var changes = readTab_(ps, 'club_change_requests').filter(real).filter(function (r) { return Core_str(r.status) === 'pending'; }).length;
  if (changes) waiting.push(changes + ' club changes');
  var late = Core_overdue(removals, now, 48);
  out.push('WAITING FOR MODERATORS\n' + (waiting.length ? waiting.join(', ') + '.' : 'Nothing is waiting.') +
    (late.length ? '\nREMOVALS PAST THEIR 2-DAY LIMIT: ' + late.length + ' (' + late.map(function (r) { return r.id; }).join(', ') + '). Please see they are handled today.' : ''));

  var unanswered = readTab_(ps, 'contact_messages').filter(real).filter(function (r) { return Core_str(r.status) === 'new'; }).length;
  if (unanswered) out.push('CONTACT MESSAGES NOT YET ANSWERED\n' + unanswered + '. Use "Mark answered" or "Reply" on the moderation desk.');

  var quiet = Core_quietClubs(clubs_(), readTab_(main, 'activities'), today, CORE_QUIET_DAYS);
  out.push('QUIET CLUBS\n' + (quiet.length ? quiet.length + ' club(s) with no activity dated in the last ' + CORE_QUIET_DAYS + ' days, for example: ' +
    quiet.slice(0, 8).map(function (c) { return c.club_name; }).join(', ') + (quiet.length > 8 ? '…' : '') + '.' : 'Every active club posted in the last ' + CORE_QUIET_DAYS + ' days.'));

  var roleChecks = readTab_(main, 'role_checks').length;
  if (roleChecks) out.push('ROLES TO CHECK\n' + roleChecks + ' role(s) need a look (wrong or missing member ID, someone marked left or deceased). ' +
    'Members moderators fix them on the moderation desk, Roles tab.');

  var due = Core_memberCheckDue(readTab_(ps, 'members_master'), today);
  if (due.length) out.push('JULY MEMBER CHECK\n' + due.length + ' listed member(s) still to be emailed; up to ' + CORE_MEMBER_CHECK_PER_DAY + ' go each morning.');

  var desk = deskLink_({});
  var to = Core_list(s.summary_emails).join(',') || Session.getEffectiveUser().getEmail();
  MailApp.sendEmail(to, 'Rotary 3110 website: weekly summary, ' + Core_dateLabel(today), out.join('\n\n') +
    (desk ? '\n\nModeration desk: ' + desk : '') + '\nThe Sheet: ' + main.getUrl() + '\n\nThis summary is private and is not shown on the website.', { name: 'Rotary 3110 website' });
  return to;
}

function sendWeeklySummaryNow() {
  var to = weeklySummary();
  try { SpreadsheetApp.getUi().alert('The weekly summary was sent to ' + to + '.'); } catch (e) { /* editor */ }
}

/* ---------- Weekly backup of both Sheets (Release B) ---------- */

var BACKUP_FOLDER_NAME = 'Backups';
var BACKUP_WEEKS = 8;

/**
 * Sunday 3 am: a copy of the main Sheet and of the private members Sheet, in a private "Backups" folder next to the
 * Sheets; the last 8 weeks are kept. A copy of a Sheet does not take its sharing, so only the district account can
 * open the copies. To restore: open a copy and copy the rows back, or File → Make a copy of it.
 * Google also copies every form linked to a Sheet it copies ("Copy of Club profile …", next to the real forms);
 * those copies are moved to the Bin, so only the real forms stay in the folder.
 */
function weeklyBackup(today) {
  var day = today || today_();
  var parents = DriveApp.getFileById(mainSs_().getId()).getParents();
  if (!parents.hasNext()) throw new Error('The main Sheet is not in a folder');
  var parent = parents.next();
  var it = parent.getFoldersByName(BACKUP_FOLDER_NAME);
  var folder = it.hasNext() ? it.next() : parent.createFolder(BACKUP_FOLDER_NAME);
  folder.setSharing(DriveApp.Access.PRIVATE, DriveApp.Permission.NONE);
  var made = [];
  [mainSs_(), privateSs_()].forEach(function (ss) {
    var name = day + ' – ' + ss.getName();
    retry_(function () { DriveApp.getFileById(ss.getId()).makeCopy(name, folder); });
    made.push(name);
  });
  var formsRemoved = removeBackupFormCopies_(parent, folder);
  // keep the newest 8 weeks: names start with the date, so they sort oldest first
  var files = [];
  var list = folder.getFiles();
  while (list.hasNext()) files.push(list.next());
  files.sort(function (a, b) { return b.getName().localeCompare(a.getName()); });
  var removed = 0;
  files.slice(BACKUP_WEEKS * 2).forEach(function (f) { f.setTrashed(true); removed++; });
  setSetting_('last_backup_at', nowIso_());
  return { made: made, removed: removed, formsRemoved: formsRemoved };
}

/** Forms named "Copy of …" that send their answers to a Sheet in the Backups folder; never a live form. */
function removeBackupFormCopies_(parent, folder) {
  var backups = {};
  var list = folder.getFiles();
  while (list.hasNext()) backups[list.next().getId()] = true;
  var removed = 0;
  [parent, folder].forEach(function (where) {
    var forms = where.getFilesByType(MimeType.GOOGLE_FORMS);
    while (forms.hasNext()) {
      var f = forms.next();
      if (f.getName().indexOf('Copy of ') !== 0) continue;
      var dest = '';
      try { dest = FormApp.openById(f.getId()).getDestinationId(); } catch (e) { continue; } // no answers Sheet: leave it
      if (backups[dest]) { f.setTrashed(true); removed++; }
    }
  });
  return removed;
}

function backupNow() {
  var r = weeklyBackup();
  try {
    SpreadsheetApp.getUi().alert('Backed up to the private "' + BACKUP_FOLDER_NAME + '" folder next to the Sheets:\n' + r.made.join('\n') +
      (r.removed ? '\n\nRemoved ' + r.removed + ' copies older than ' + BACKUP_WEEKS + ' weeks.' : '') +
      (r.formsRemoved ? '\n\nMoved ' + r.formsRemoved + ' form copies that Google made with the Sheet to the Bin.' : ''));
  } catch (e) { /* editor */ }
}

/* ---------- A rebuild that did not happen (Release B) ---------- */

/**
 * Every 2 hours: if "Rebuild site now" was pressed more than 3 hours ago and the website has not been built since,
 * one email to the owner (summary_emails, or the district account), so a stuck build is noticed the same day.
 */
function checkRebuild() {
  var s = settings_();
  // "Rebuild site now" should be done within 3 hours; approvals wait for the next of the four daily updates, at most
  // 11 hours apart (10 pm to 9 am), so they get 13 hours
  var asked = Core_isoTimestamp(s.rebuild_requested_at);
  var changed = Core_isoTimestamp(s.content_changed_at);
  if (!asked || Date.now() - new Date(asked).getTime() < 3 * 3600000) asked = '';
  if (changed && Date.now() - new Date(changed).getTime() >= 13 * 3600000 && changed > asked) asked = changed;
  if (!asked) return 'nothing to check';
  var props = props_();
  if (props.getProperty('REBUILD_ALERTED') === asked) return 'already told';
  var built = '';
  try {
    built = Core_isoTimestamp(JSON.parse(UrlFetchApp.fetch(Core_str(s.site_url).replace(/\/?$/, '/') + 'build-info.json', { muteHttpExceptions: true }).getContentText()).generated_at);
  } catch (e) { built = ''; }
  if (built && built >= asked) return 'built';
  var to = Core_list(s.summary_emails).join(',') || Session.getEffectiveUser().getEmail();
  var what = asked === changed ? 'Something was approved or changed on ' + asked.slice(0, 16).replace('T', ' at ') + ' UTC, more than 13 hours ago (the website should have taken it at one of its four daily updates)'
    : '"Rebuild site now" was pressed on ' + asked.slice(0, 16).replace('T', ' at ') + ' UTC, more than 3 hours ago';
  MailApp.sendEmail(to, 'Rotary 3110 website: a rebuild has not happened', what + ', but the website ' + (built ?'was last built on ' + built.slice(0, 16).replace('T', ' at ') + ' UTC' : 'could not be checked') + '.\n\n' +
    'What to do: open the GitHub repository → Actions. If the latest run failed, its log says why. If nothing ran, press "Run workflow" there.\n\n' +
    'You get this email once for each rebuild request.', { name: 'Rotary 3110 website' });
  props.setProperty('REBUILD_ALERTED', asked);
  return 'told ' + to;
}

/* ---------- Start a new Rotary year (Release B) ---------- */

/**
 * Administrator → Start new Rotary year…: moves current_rotary_year on by one year once the new office bearers and
 * district team are in the officers and functionaries tabs. Last year's rows stay, so the website shows them under
 * past years. The outgoing District Governor is added to past_governors. Then the role check, the form lists and a
 * rebuild run, and the owner is told what is still to do by hand.
 */
function startNewRotaryYear() {
  var ui = SpreadsheetApp.getUi();
  var main = mainSs_();
  var cur = Core_str(settings_().current_rotary_year);
  var next = Core_nextRotaryYear(cur);
  if (!next) { ui.alert('The setting current_rotary_year ("' + cur + '") is not a Rotary year such as 2024-25. Correct it first.'); return ''; }
  var officers = readTab_(main, 'officers').filter(function (r) { return Core_str(r.rotary_year) === next; }).length;
  var team = readTab_(main, 'functionaries').filter(function (r) { return Core_str(r.rotary_year) === next; });
  if (!officers && !team.length) {
    ui.alert('Nothing for ' + next + ' yet', 'The officers and functionaries tabs have no rows for ' + next + '. Add the new office bearers and district team first ' +
      '(see "Every July" in the yearly update guide), then use this again.', ui.ButtonSet.OK);
    return '';
  }
  if (ui.alert('Start Rotary year ' + next + '?', 'Found for ' + next + ': ' + officers + ' club office bearer row(s) and ' + team.length + ' district team row(s).\n\n' +
    'The website will show ' + next + ' as the current year after the next build; ' + cur + ' stays on the site under past years.', ui.ButtonSet.YES_NO) !== ui.Button.YES) return '';
  setSetting_('current_rotary_year', next);
  var done = ['current_rotary_year set to ' + next];
  var dg = readTab_(main, 'functionaries').filter(function (r) { return Core_str(r.rotary_year) === cur && Core_str(r.role) === 'District Governor'; })[0];
  var past = readTab_(main, 'past_governors');
  if (dg && !past.some(function (p) { return Core_str(p.rotary_year) === cur; })) {
    appendRow_(main, 'past_governors', { rotary_year: cur, name: Core_str(dg.name), club: clubNameById_(dg.club_id), member_id: Core_str(dg.member_id) });
    done.push(Core_str(dg.name) + ' added to past_governors for ' + cur);
  }
  var problems = checkRoles(true);
  try { updateFormLists(true); } catch (e) { done.push('Form lists not updated: ' + e.message); }
  requestRebuild();
  ui.alert('Rotary year ' + next + ' started', done.join('\n') + '\n\nStill to do by hand:\n' +
    '• profiles: the new District Governor (and photo)\n• campaigns for ' + next + '\n• clubs: member counts; closed clubs set to inactive\n' +
    '• the new Assistant Governors\' clubs (ag_clubs)\n' + (problems ? '• ' + problems + ' role(s) to check in the role_checks tab\n' : '') +
    '\nThe website updates within about 30 minutes.', ui.ButtonSet.OK);
  return next;
}


// ===== Sample.js =====
/**
 * Sample (dummy) data. Every sample row has is_sample = TRUE.
 * "Clear all sample data" is the single clean-up command before real data is loaded.
 */

/**
 * The Sheet feeds the public website once it was reset for production or holds the real member list (a test Sheet
 * has only a handful of real rows). Sample rows loaded then would go public, so loading is refused.
 */
function holdsRealData_() {
  if (Core_str(props_().getProperty('PRODUCTION_RESET_AT'))) return 'it was reset for production';
  var real = readTab_(privateSs_(), 'members_master').filter(function (m) { return !Core_isTrue(m.is_sample); }).length;
  return real >= 50 ? 'it holds ' + real + ' real members' : '';
}

function loadSampleData(silent) {
  var real = holdsRealData_();
  if (real) {
    var msg = 'Sample data was not loaded: this Sheet feeds the public website (' + real + '), so dummy rows would appear there.';
    Logger.log(msg);
    if (silent !== true) { try { SpreadsheetApp.getUi().alert(msg); } catch (e) { /* editor */ } }
    return [];
  }
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

var SAMPLE_ID_KEYS = {
  clubs: 'club_id', activities: 'id', events: 'id', club_profile_requests: 'id', campaigns: 'campaign_id',
  messages: 'id', members_master: 'member_id', couples: 'couple_id', consent_requests: 'id', removal_requests: 'id',
  public_services: 'id', contact_messages: 'id', businesses: 'id', club_change_requests: 'id',
};

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
    // a sample row whose ID a real row already has is not loaded (the real row keeps its ID)
    var key = SAMPLE_ID_KEYS[name];
    if (key) {
      var taken = {};
      readTab_(ss, name).forEach(function (r) { if (Core_str(r[key])) taken[Core_str(r[key])] = true; });
      var before = rows.length;
      rows = rows.filter(function (r) { return !taken[Core_str(r[key])]; });
      if (rows.length < before) counts.push(name + ': ' + (before - rows.length) + ' sample row(s) not loaded because the ID is already used');
      if (!rows.length) return;
    }
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

/** Tabs that Reset for production leaves alone: settings and form links, lists, moderators, and clubs (so the forms keep a club list until the real one is imported). */
var RESET_KEEP_TABS = ['settings', 'lists', 'moderators', 'clubs'];

/**
 * Administrator → Reset for production (once): before the real data is imported, removes every data row, sample or
 * test, from both Sheets, the form-response tabs included. Headers, settings, lists, moderators and clubs stay.
 * Runs only once: afterwards the Sheet holds real data, so the command refuses.
 */
function resetForProduction() {
  var ui = SpreadsheetApp.getUi();
  var done = Core_str(props_().getProperty('PRODUCTION_RESET_AT'));
  if (done) { ui.alert('The Sheet was already reset for production on ' + done + '. It now holds real data, so this command does nothing.'); return []; }
  if (ui.alert('Reset for production?', 'Every data row in both Sheets will be deleted (sample and test rows, form responses, the moderator log). ' +
    'Kept: settings, lists, moderators and clubs.\n\nName a version first (File → Version history). This can only be done once.', ui.ButtonSet.YES_NO) !== ui.Button.YES) return [];
  var removed = [];
  [mainSs_(), privateSs_()].forEach(function (ss) {
    ss.getSheets().forEach(function (sh) {
      var name = sh.getName();
      var last = sh.getLastRow();
      if (RESET_KEEP_TABS.indexOf(name) >= 0 || last < 2) return;
      if (/^raw_/.test(name)) {
        // a form writes after its last row, so its rows are deleted rather than emptied (one blank row is added first: a tab keeps at least one)
        sh.insertRowsAfter(sh.getMaxRows(), 1);
        sh.deleteRows(2, last - 1);
      } else {
        sh.getRange(2, 1, last - 1, Math.max(1, sh.getLastColumn())).clearContent();
      }
      removed.push(ss.getName() + ' → ' + name + ': ' + (last - 1));
    });
  });
  setSetting_('inactive_keys', '');
  props_().setProperty('PRODUCTION_RESET_AT', today_());
  refreshPublicMembers(true);
  refreshDashboard();
  ui.alert('Reset for production done.\n' + (removed.join('\n') || 'Nothing to remove.') +
    '\n\nNext: import the real clubs, members_master and club_history, then Update form lists and Rebuild site now.');
  return removed;
}


// ===== Practice.js =====
/**
 * Practice round: before moderators start for real, each one gets practice items made for them on the moderation
 * desk, with the same emails a real item sends, and an email listing what to try. Practice items have IDs
 * starting PRAC- and is_sample = TRUE: they are never published or counted (Core_isPractice), approving one never
 * changes a club or the members list, and nobody outside the moderators is emailed. "Practice round: report"
 * shows who has done what; "remove practice items" (or Clear all sample data) deletes them.
 */

var PRACTICE_TYPES = ['Content', 'Members', 'District office', 'Club engagement'];

// What each practice item is, what to do with it, and how the report tells it was done
var PRACTICE_ITEMS = [
  { type: 'Content', tab: 'activities', title: 'Practice: Tree plantation in the city park',
    task: 'Check the club\'s link, then Approve. Try it from the Approve button in its email.',
    done: function (r) { return Core_str(r.status) === 'approved' ? '' : 'not approved yet'; } },
  { type: 'Content', tab: 'activities', title: 'Practice: Blood donation camp',
    task: 'The text has a member\'s personal mobile number. Tap Correct, remove the number, Save, then Approve.',
    done: function (r) {
      if (Core_str(r.status) !== 'approved') return 'not approved yet';
      return /\d{5}\s?\d{5}/.test(Core_str(r.description)) ? 'approved, but the mobile number is still in the text' : '';
    } },
  { type: 'Content', tab: 'events', title: 'Practice: Club assembly and fellowship dinner',
    task: 'The fee has UPI payment details. Tap Correct, change the fee to "₹300 per person", Save, then Approve.',
    done: function (r) {
      if (Core_str(r.status) !== 'approved') return 'not approved yet';
      return CORE_PAYMENT_RE.test(Core_str(r.fee)) ? 'approved, but the fee still has payment details' : '';
    } },
  { type: 'Content', tab: 'activities', title: 'Practice: Visit to an old-age home',
    task: 'It has no photo and no link, so it cannot be published. Reject it, with a reason the club will understand.',
    done: function (r) { return Core_str(r.status) === 'rejected' ? '' : 'not rejected yet'; } },
  { type: 'Members', tab: 'consent_requests', title: 'Practice: Rtn Asha Sharma',
    task: 'The declaration was not ticked. Reject it, with a reason the member will understand. Then try Mark as deceased: search for any name, look, and do not confirm.',
    done: function (r) { return Core_str(r.status) === 'rejected' ? '' : 'not rejected yet'; } },
  { type: 'District office', tab: 'contact_messages', title: 'Practice: Ramesh Gupta',
    task: 'Tap Reply, write a short answer and tap Send. It comes to your own inbox, exactly as the public would get it: from the district account, without your name.',
    done: function (r) { return Core_str(r.replies) ? '' : 'no reply sent yet'; } },
  { type: 'District office', tab: 'contact_messages', title: 'Practice: Sunita',
    task: 'She gave only a mobile number. Do not call it (it is not real); for a real message you would call from the district office phone. Tap Mark answered.',
    done: function (r) { return Core_str(r.status) === 'answered' ? '' : 'not marked answered yet'; } },
];

var PRACTICE_CLUB_TASK = 'Open Quiet clubs, choose any club and tap WhatsApp, then send the message to yourself, not to the club. ' +
  'Do not tap Email in the practice round: it really emails that club\'s President and Secretary.';

/** Who practises what: the active moderators of each type; a type with nobody yet goes to the district account. */
function practicePeople_() {
  var rows = deskModeratorRows_();
  var out = {};
  PRACTICE_TYPES.forEach(function (t) {
    var list = Core_moderatorEmails(rows, t);
    out[t] = list.length ? list : [deskOwner_()];
  });
  return out;
}

/** Rotary → Administrator → Practice round: start… */
function startPractice() {
  var ui = SpreadsheetApp.getUi();
  var people = practicePeople_();
  var lines = PRACTICE_TYPES.map(function (t) { return t + ': ' + people[t].map(deskName_).join(', '); });
  if (ui.alert('Start a practice round',
    'Each person gets practice items on the moderation desk, the emails that go with them, and an email saying what to try:\n\n' +
    lines.join('\n') + '\n\nPractice items are never published. Go ahead?', ui.ButtonSet.YES_NO) !== ui.Button.YES) return;
  var made = practiceAdd_(people);
  ui.alert('Practice round started: ' + made.length + ' practice items. Each person has an email saying what to try.\n\n' +
    'Rotary → Administrator → Practice round: report shows who has done what.');
  return made;
}

function practiceAdd_(people) {
  var main = mainSs_();
  var ps = privateSs_();
  var now = nowIso_();
  var today = today_();
  var club = clubs_().filter(function (c) { return Core_str(c.status || 'active').toLowerCase() === 'active'; })[0] || {};
  var city = Core_str(club.city) || 'Agra';
  var made = [];
  var add = function (ss, tab, row) {
    row.id = nextId_(readTab_(ss, tab), 'PRAC-');
    row.is_sample = true;
    appendRow_(ss, tab, row);
    made.push(row);
    return row;
  };
  var sent = function (email, name) {
    return { submitted_at: now, submitter_email: '', submitter_name: 'Practice (' + name + ')', submitter_role: 'Secretary',
      submitter_mobile: '', status: 'pending', source: 'practice', moderator_note: 'Practice for ' + name };
  };
  var forItem = function (title) { return PRACTICE_ITEMS.filter(function (i) { return i.title === title; })[0]; };
  setSetting_('practice_started_at', now);

  people.Content.forEach(function (email) {
    var name = deskName_(email);
    var act = function (title, more) {
      return Object.assign(sent(email, name), { club_id: Core_str(club.club_id), club_name: Core_str(club.club_name), title: title,
        date: Core_addDays(today, -3), theme: 'Protecting the environment', avenue: 'Community Service', photo_consent: false }, more);
    };
    var rows = [
      ['activities', act(PRACTICE_ITEMS[0].title, { description: 'Members planted 50 neem and peepal saplings along the park boundary and fixed tree guards. ' +
        'Students of the nearby school will water them through the summer.', post_link: siteUrl_() + 'how-to-post/', people_helped: 200 })],
      ['activities', act(PRACTICE_ITEMS[1].title, { theme: 'Fighting disease', description: '42 units of blood were collected at the club\'s camp with the district hospital. ' +
        'For the next camp call Rtn Mehta on 98765 43210.', post_link: siteUrl_() + 'how-to-post/' })],
      ['events', Object.assign(sent(email, name), { title: PRACTICE_ITEMS[2].title, event_type: 'Club event open to all',
        start_date: Core_addDays(today, 10), start_time: '19:00', venue: 'Hotel Grand', city: city, organiser: Core_str(club.club_name),
        description: 'Monthly club assembly followed by a fellowship dinner with families.', fee: '₹300 per person, pay by UPI 9876543210@upi',
        moderator_note: 'Practice for ' + name + '; Fee contains payment details: remove before approving' })],
      ['activities', act(PRACTICE_ITEMS[3].title, { theme: 'Club service / Other', description: 'Members spent the evening with the residents and gave them blankets.',
        moderator_note: 'Practice for ' + name + '; No photo or link: reject or ask the club for one' })],
    ];
    rows.forEach(function (x) { alertContent_(x[0], add(main, x[0], x[1]), [email]); });
  });

  people.Members.forEach(function (email) {
    var name = deskName_(email);
    var req = add(ps, 'consent_requests', { submitted_at: now, submitter_email: '', filled_by: 'The member', club_id: Core_str(club.club_id),
      name: forItem('Practice: Rtn Asha Sharma').title, directory_ok: true, profession: 'Teacher', area: city, contact_ok: false, photo_ok: false,
      declaration: false, status: 'pending', moderator_note: 'Practice for ' + name });
    alertMembers_('consent', req, [email]);
  });

  people['District office'].forEach(function (email) {
    var name = deskName_(email);
    [
      { name: forItem('Practice: Ramesh Gupta').title, reply_to: email, topic: 'I want to join Rotary', city: city,
        message: 'Namaste. I run a small business in ' + city + ' and would like to join a Rotary club near me. How do I start?' },
      { name: forItem('Practice: Sunita').title, reply_to: '90000 00000', topic: 'Blood needed', city: city,
        message: 'My father needs two units of B+ blood at the district hospital tomorrow. Can Rotary help?' },
    ].forEach(function (m) {
      var row = add(ps, 'contact_messages', Object.assign(m, { submitted_at: now, status: 'new', forwarded_to: email, note: 'Practice for ' + name }));
      try { contactAlert_(row, email); } catch (e) { Logger.log('Practice alert not sent: ' + e.message); }
    });
  });

  practiceEmails_(people);
  return made;
}

/** One email per person: what to try, for each of their types. */
function practiceEmails_(people) {
  var tasks = {};
  PRACTICE_TYPES.forEach(function (t) {
    people[t].forEach(function (email) {
      tasks[email] = tasks[email] || [];
      tasks[email].push('\n' + t.toUpperCase() + '\n' + (t === 'Club engagement' ? '• ' + PRACTICE_CLUB_TASK
        : PRACTICE_ITEMS.filter(function (i) { return i.type === t; }).map(function (i) { return '• "' + i.title + '": ' + i.task; }).join('\n')));
    });
  });
  var desk = deskLink_({});
  Object.keys(tasks).forEach(function (email) {
    if (!deskQuota_(1)) return;
    MailApp.sendEmail(email, 'Practice round on the moderation desk',
      'Dear ' + deskName_(email) + ',\n\nBefore the website opens, please try the moderation desk with a few practice items made just for you. ' +
      'They look real, but they are never published and nobody outside the moderators is emailed.\n\n' +
      'Open the desk' + (desk ? ': ' + desk : ' from any moderator email') + '\nSign in with this email address; a code comes by email.\n' +
      'The guide for each type of moderator: ' + siteUrl_() + 'desk/guide/\n' + tasks[email].join('\n') +
      '\n\nWhen you have finished, tell the website administrator. Thank you!\nRotary District 3110 website',
      { name: 'Rotary 3110 website' });
  });
}

/** Rotary → Administrator → Practice round: report. Who has done what, person by person. */
function practiceReport() {
  var lines = practiceReportLines_();
  try { SpreadsheetApp.getUi().alert('Practice round', lines.join('\n') || 'No practice items. Start a practice round first.', SpreadsheetApp.getUi().ButtonSet.OK); } catch (e) { /* called from code */ }
  return lines;
}

function practiceReportLines_() {
  var tabs = { activities: mainSs_(), events: mainSs_(), consent_requests: privateSs_(), contact_messages: privateSs_() };
  var byPerson = {};
  var put = function (who, line) { (byPerson[who] = byPerson[who] || []).push(line); };
  var cache = {};
  PRACTICE_ITEMS.forEach(function (item) {
    var rows = cache[item.tab] = cache[item.tab] || readTab_(tabs[item.tab], item.tab).filter(Core_isPractice);
    rows.filter(function (r) { return Core_str(r.title || r.name) === item.title; }).forEach(function (r) {
      var who = practiceFor_(r);
      var problem = item.done(r);
      put(who.trim(), (problem ? '✗ ' : '✓ ') + item.title.replace(/^Practice: /, '') + (problem ? ': ' + problem : ''));
    });
  });
  var since = Core_str(readTab_(mainSs_(), 'settings').filter(function (r) { return r.key === 'practice_started_at'; }).map(function (r) { return r.value; })[0]);
  if (since) {
    var log = readTab_(mainSs_(), 'moderator_log');
    practicePeople_()['Club engagement'].forEach(function (email) {
      var tried = log.some(function (l) { return Core_str(l.moderator).toLowerCase() === email && /^reminder /.test(Core_str(l.action)) && Core_isoTimestamp(l.at) >= Core_isoTimestamp(since); });
      put(deskName_(email), (tried ? '✓ ' : '✗ ') + 'Quiet clubs reminder' + (tried ? '' : ': not tried yet'));
    });
  }
  var out = [];
  Object.keys(byPerson).forEach(function (who) { out.push(who + '\n  ' + byPerson[who].join('\n  ')); });
  return out;
}

/** Whom a practice item was made for: the "Practice for …" mark, or (a rejection replaces the note) whoever acted on it. */
function practiceFor_(r) {
  var m = [r.submitter_name, r.moderator_note, r.note].map(Core_str).join('; ').match(/Practice (?:for |\()([^;:)]+)/);
  return Core_str(m ? m[1] : deskName_(r.approved_by)) || '?';
}

/** Rotary → Administrator → Practice round: remove practice items… (the moderator_log keeps its record). */
function removePractice() {
  var ui = SpreadsheetApp.getUi();
  if (ui.alert('Remove practice items?', 'Every practice item (ID starting PRAC-) is deleted from both Sheets. Nothing else changes.', ui.ButtonSet.YES_NO) !== ui.Button.YES) return;
  var removed = [];
  [mainSs_(), privateSs_()].forEach(function (ss) {
    ss.getSheets().forEach(function (sh) {
      if (sh.getLastRow() < 2) return;
      var values = retry_(function () { return sh.getDataRange().getValues(); });
      var col = values[0].indexOf('id');
      if (col < 0 || sh.getName() === 'moderator_log') return;
      var keep = values.filter(function (row, i) { return i === 0 || !Core_isPractice({ id: row[col] }); });
      if (keep.length === values.length) return;
      sh.getRange(1, 1, values.length, values[0].length).clearContent();
      sh.getRange(1, 1, keep.length, keep[0].length).setValues(keep);
      removed.push(sh.getName() + ': ' + (values.length - keep.length));
    });
  });
  setSetting_('practice_started_at', '');
  ui.alert('Practice items removed.\n' + (removed.join('\n') || 'There were none.'));
  return removed;
}
