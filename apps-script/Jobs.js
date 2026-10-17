/**
 * Daily at 7 am (India): 48-hour reminders to moderators, the monthly-nudge dashboard, the role check, new magazines,
 * and the forms' lists (so a campaign drops off the activity form 30 days after it ends).
 */

function dailyJobs() {
  scanMagazines_();
  refreshDashboard();
  checkRoles(true);
  try { updateFormLists(true); } catch (e) { Logger.log('Form lists not updated: ' + e.message); }
  sendReminders_();
}

/* ---------- Weekly bulletin emails ---------- */

/** Moderators, or the district account until moderators are named. */
function moderatorRecipients_(s) {
  return Core_list(s.moderator_emails).join(',') || Session.getEffectiveUser().getEmail();
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
  var ids = [];
  b.events.forEach(function (e) { ids.push('Coming up: ' + e.id + ' – ' + e.title); });
  b.closing.forEach(function (e) { ids.push('Registration closing: ' + e.id + ' – ' + e.title); });
  b.done.items.forEach(function (a) { ids.push('Done last week: ' + a.id + ' – ' + a.title + ' (' + a.club_name + ')'); });
  b.campaigns.forEach(function (c) { ids.push('Campaign: ' + c.campaign_id + ' – ' + c.name); });
  var skipped = data.skipped_items || [];
  var body = Core_bulletinMessage(b, s.site_url) +
    '\n\n----------\nChosen items (row ids):\n' + (ids.join('\n') || '(none: a quiet week)') +
    (b.done.more ? '\n…and ' + b.done.more + ' more activities, counted but not listed.' : '') +
    '\n\nNothing to do if this looks right. To leave something out, set bulletin_exclude to TRUE on that row in the ' +
    'activities or events tab before Sunday 6 am.' +
    (skipped.length ? '\n\nLeft out of the website because they contain a phone number, email or payment details: ' + skipped.join('; ') : '');
  var subject = new Date(today + 'T00:00:00Z').getUTCDay() === 6 ? "Tomorrow's bulletin – no action needed"
    : 'Bulletin for Sunday ' + Core_dateLabel(sunday) + ' – no action needed';
  MailApp.sendEmail(moderatorRecipients_(s), subject, body);
  try { SpreadsheetApp.getUi().alert('Bulletin preview sent to ' + moderatorRecipients_(s) + '.'); } catch (e) { /* timed run */ }
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
  var to = Core_list(s.bulletin_emails).join(',') || moderatorRecipients_(s);
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
  var s = settings_();
  try { SpreadsheetApp.getUi().alert("This week's bulletin message was sent to " + (Core_list(s.bulletin_emails).join(',') || moderatorRecipients_(s)) + '.'); } catch (e) { /* editor */ }
}

function sendReminders_() {
  var now = Date.now();
  var main = mainSs_();
  var ps = privateSs_();
  var overdue = [];
  ['activities', 'events', 'club_profile_requests', 'public_services'].forEach(function (t) {
    Core_overdue(readTab_(main, t), now, CONFIG.REMINDER_HOURS).forEach(function (r) { overdue.push(t + ': ' + r.id + ' – ' + (r.title || r.name || r.club_name || '')); });
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

/**
 * 1st of each month: a private email listing the active clubs with no activity dated in the month just ended,
 * with each club's last activity, so the district team can follow up. Never shown on the website.
 * Goes to not_posting_emails (a dummy address until the district names someone).
 */
function notPostingReport() {
  var s = settings_();
  var today = today_();
  var y = +today.slice(0, 4);
  var mo = +today.slice(5, 7);
  var month = mo === 1 ? (y - 1) + '-12' : y + '-' + ('0' + (mo - 1)).slice(-2);
  var list = Core_clubsNotPosting(clubs_(), readTab_(mainSs_(), 'activities'), month);
  var names = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  var label = names[+month.slice(5) - 1] + ' ' + month.slice(0, 4);
  var to = Core_list(s.not_posting_emails).join(',') || moderatorRecipients_(s);
  var body = list.length
    ? list.length + ' club(s) posted no activity dated in ' + label + ':\n\n' + list.map(function (c) {
      return '• ' + c.club_name + (c.last_activity_date ? ' (last activity ' + Core_dateLabel(c.last_activity_date) + ')' : ' (no activity yet)');
    }).join('\n') + '\n\nThis list is private and is not shown on the website.'
    : 'Every active club posted at least one activity dated in ' + label + '.';
  MailApp.sendEmail(to, 'Clubs that did not post in ' + label, body + '\n\nRotary District 3110 website');
  return list.length;
}

function sendNotPostingNow() {
  var n = notPostingReport();
  var s = settings_();
  try { SpreadsheetApp.getUi().alert('Sent to ' + (Core_list(s.not_posting_emails).join(',') || moderatorRecipients_(s)) + ': ' + n + ' club(s) listed.'); } catch (e) { /* editor */ }
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
