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
    .addItem('Check roles and member IDs', 'checkRoles')
    .addItem('Update form lists (clubs, areas, professions)', 'updateFormLists')
    .addSeparator()
    .addSubMenu(SpreadsheetApp.getUi().createMenu('Sample data')
      .addItem('Load sample data', 'loadSampleData')
      .addItem('Clear all sample data…', 'clearSampleData'))
    .addSubMenu(SpreadsheetApp.getUi().createMenu('Administrator')
      .addItem('Show data link details', 'showDataLink')
      .addItem('Upgrade Sheet (new tabs, columns, questions)', 'upgradeSheet')
      .addItem('Apply moderators (Sheet access)…', 'applyModerators')
      .addItem('Send bulletin preview now', 'bulletinPreview')
      .addItem('Send bulletin message now', 'sendBulletinMessageNow')
      .addItem('Send clubs-not-posting email now', 'sendNotPostingNow')
      .addItem('Practice round: start…', 'startPractice')
      .addItem('Practice round: report', 'practiceReport')
      .addItem('Practice round: remove practice items…', 'removePractice')
      .addItem('Reset for production (once)…', 'resetForProduction')
      .addItem('Run setup again', 'setup'))
    .addToUi();
}

var MODERATED_TABS = ['activities', 'events', 'club_profile_requests', 'public_services'];

function selectedRows_() {
  var sh = SpreadsheetApp.getActiveSheet();
  var name = sh.getName();
  if (MODERATED_TABS.indexOf(name) < 0) {
    throw new Error('Select one or more rows in the activities, events, club_profile_requests or public_services tab first.');
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
  var who = moderatorEmail_();
  sel.rows.forEach(function (r) { rejectRow_(sel.tab, r, who, reason); });
  ui.alert('Rejected ' + sel.rows.length + ' row(s).');
}

/** Why a row cannot be approved yet, or '' if it can. Shared by the Rotary menu and the moderation desk. */
function approveBlock_(tab, r) {
  if (tab === 'activities' && !Core_str(r.photo_files) && !Core_url(r.post_link)) return 'needs a photo or a link to the club\'s post';
  if ((tab === 'activities' || tab === 'public_services') && !Core_str(r.club_id)) return 'club not recognised: fill in club_id';
  if (tab === 'public_services' && !Core_servicePhone(r.phone)) return 'the phone number is not a plain number: correct it first';
  return '';
}

/** Approves one row (already checked with approveBlock_) and tells the sender. */
function approveRow_(tab, r, who) {
  updateRow_(mainSs_(), tab, r._row, { status: 'approved', approved_by: who, approved_at: nowIso_() });
  if (tab === 'club_profile_requests' && !Core_isPractice(r)) applyClubProfile_(r);
  notifySubmitter_(tab, r, true, '');
}

function rejectRow_(tab, r, who, reason) {
  updateRow_(mainSs_(), tab, r._row, { status: 'rejected', approved_by: who, approved_at: nowIso_(), moderator_note: reason });
  notifySubmitter_(tab, r, false, reason);
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
    : tab === 'public_services' ? 'public service "' + r.name + '"' : 'club profile update';
  var link = tab === 'activities' ? site + 'activities/' + Core_str(r.id).toLowerCase() + '/'
    : tab === 'events' ? site + 'events/' + Core_str(r.id).toLowerCase() + '/' : tab === 'public_services' ? site + 'services/' : site + 'clubs/';
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

/** Asks the website to rebuild within about 30 minutes, instead of waiting for Sunday. */
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
