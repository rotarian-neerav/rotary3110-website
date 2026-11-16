/**
 * Daily at 7 am (India): 48-hour reminders to moderators, the monthly-nudge dashboard, the role check, new magazines,
 * the forms' lists (so a campaign drops off the activity form 30 days after it ends), and in July and August the
 * yearly check email to listed members.
 */

function dailyJobs() {
  scanMagazines_();
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
  ['activities', 'events', 'club_profile_requests', 'public_services'].forEach(function (t) {
    Core_overdue(readTab_(main, t), now, CONFIG.REMINDER_HOURS).forEach(function (r) { content.push(t + ': ' + r.id + ' – ' + (r.title || r.name || r.club_name || '')); });
  });
  var members = [];
  var sender = consentChecker_(ps);
  ['consent_requests', 'removal_requests'].forEach(function (t) {
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

  var labels = { activities: 'activities', events: 'events', public_services: 'public services', club_profile_requests: 'club profile updates' };
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
  var late = Core_overdue(removals, now, 48);
  out.push('WAITING FOR MODERATORS\n' + (waiting.length ? waiting.join(', ') + '.' : 'Nothing is waiting.') +
    (late.length ? '\nREMOVALS PAST THEIR 2-DAY LIMIT: ' + late.length + ' (' + late.map(function (r) { return r.id; }).join(', ') + '). Please see they are handled today.' : ''));

  var unanswered = readTab_(ps, 'contact_messages').filter(real).filter(function (r) { return Core_str(r.status) === 'new'; }).length;
  if (unanswered) out.push('CONTACT MESSAGES NOT YET ANSWERED\n' + unanswered + '. Use "Mark answered" or "Reply" on the moderation desk.');

  var quiet = Core_quietClubs(clubs_(), readTab_(main, 'activities'), today, CORE_QUIET_DAYS);
  out.push('QUIET CLUBS\n' + (quiet.length ? quiet.length + ' club(s) with no activity dated in the last ' + CORE_QUIET_DAYS + ' days, for example: ' +
    quiet.slice(0, 8).map(function (c) { return c.club_name; }).join(', ') + (quiet.length > 8 ? '…' : '') + '.' : 'Every active club posted in the last ' + CORE_QUIET_DAYS + ' days.'));

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
  // keep the newest 8 weeks: names start with the date, so they sort oldest first
  var files = [];
  var list = folder.getFiles();
  while (list.hasNext()) files.push(list.next());
  files.sort(function (a, b) { return b.getName().localeCompare(a.getName()); });
  var removed = 0;
  files.slice(BACKUP_WEEKS * 2).forEach(function (f) { f.setTrashed(true); removed++; });
  setSetting_('last_backup_at', nowIso_());
  return { made: made, removed: removed };
}

function backupNow() {
  var r = weeklyBackup();
  try {
    SpreadsheetApp.getUi().alert('Backed up to the private "' + BACKUP_FOLDER_NAME + '" folder next to the Sheets:\n' + r.made.join('\n') +
      (r.removed ? '\n\nRemoved ' + r.removed + ' copies older than ' + BACKUP_WEEKS + ' weeks.' : ''));
  } catch (e) { /* editor */ }
}

/* ---------- A rebuild that did not happen (Release B) ---------- */

/**
 * Every 2 hours: if "Rebuild site now" was pressed more than 3 hours ago and the website has not been built since,
 * one email to the owner (summary_emails, or the district account), so a stuck build is noticed the same day.
 */
function checkRebuild() {
  var s = settings_();
  var asked = Core_isoTimestamp(s.rebuild_requested_at);
  if (!asked || Date.now() - new Date(asked).getTime() < 3 * 3600000) return 'nothing to check';
  var props = props_();
  if (props.getProperty('REBUILD_ALERTED') === asked) return 'already told';
  var built = '';
  try {
    built = Core_isoTimestamp(JSON.parse(UrlFetchApp.fetch(Core_str(s.site_url).replace(/\/?$/, '/') + 'build-info.json', { muteHttpExceptions: true }).getContentText()).generated_at);
  } catch (e) { built = ''; }
  if (built && built >= asked) return 'built';
  var to = Core_list(s.summary_emails).join(',') || Session.getEffectiveUser().getEmail();
  MailApp.sendEmail(to, 'Rotary 3110 website: a rebuild has not happened', '"Rebuild site now" was pressed on ' + asked.slice(0, 16).replace('T', ' at ') +
    ' UTC, more than 3 hours ago, but the website ' + (built ? 'was last built on ' + built.slice(0, 16).replace('T', ' at ') + ' UTC' : 'could not be checked') + '.\n\n' +
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
