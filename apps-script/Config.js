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
