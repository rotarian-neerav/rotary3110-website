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
  ['consent_requests', 'removal_requests'].forEach(function (t) {
    Core_overdue(readTab_(ps, t), now, CONFIG.REMINDER_HOURS).forEach(function (r) { members.push(t + ': ' + r.id + ' – ' + r.name); });
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
 * 1st of each month: a private email listing the active clubs with no activity dated in the month just ended,
 * with each club's last activity, so the district team can follow up. Never shown on the website.
 * Goes to the Club engagement moderators (until they are named: not_posting_emails, a dummy address).
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
  var to = moderatorRecipients_('Club engagement', 'not_posting_emails');
  var body = list.length
    ? list.length + ' club(s) posted no activity dated in ' + label + ':\n\n' + list.map(function (c) {
      return '• ' + c.club_name + (c.last_activity_date ? ' (last activity ' + Core_dateLabel(c.last_activity_date) + ')' : ' (no activity yet)');
    }).join('\n') + '\n\nThis list is private and is not shown on the website.'
    : 'Every active club posted at least one activity dated in ' + label + '.';
  var desk = deskLink_({});
  MailApp.sendEmail(to, 'Clubs that did not post in ' + label, body + (desk && list.length ? '\n\nTo send a club a reminder by email or WhatsApp, open the moderation desk: ' + desk : '') +
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
