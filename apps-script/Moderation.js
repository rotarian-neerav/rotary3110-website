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
