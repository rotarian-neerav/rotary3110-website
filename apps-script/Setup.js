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
  ['club_senders_only', 'off', 'Release 3: off, watch or on. On: the activity and Club updates forms are accepted only from the club\'s President, Secretary or Executive Secretary (this year\'s, or the last known until this year\'s is told), sent from their email on file; watch: nobody is refused, each row says who sent it'],
  ['weekly_club_email', 'off', 'Release 3: off, test or on. On: each club\'s office bearers get one email a week, on the club\'s own weekday, with what was approved for the club (none when nothing happened); test: the day\'s club emails all go to weekly_club_email_test_to'],
  ['weekly_club_email_test_to', '', 'Where the weekly club emails go while weekly_club_email is test. Blank: the district account that owns the Sheet'],
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
    apply(main, t, 'status', listRule_(['pending', 'approved', 'rejected', 'not_accepted']));
  });
  // hidden: taken off the website by a moderator after it was published (Release 1)
  apply(main, 'activities', 'status', listRule_(['pending', 'approved', 'rejected', 'hidden', 'not_accepted']));
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
  ['consent_requests', 'removal_requests'].forEach(function (t) {
    apply(priv, t, 'status', listRule_(['pending', 'approved', 'rejected']));
  });
  // not_accepted (Release 3): sent by someone who is not an office bearer of the club, until a moderator lets it through
  apply(priv, 'club_change_requests', 'status', listRule_(['pending', 'approved', 'rejected', 'not_accepted']));
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
