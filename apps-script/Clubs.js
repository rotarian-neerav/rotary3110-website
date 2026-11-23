/**
 * Release 3 (owner, 18 Nov 2026): a club's President, Secretary and Executive Secretary speak for the club.
 * Until this year's holder of a role is told, the previous known holder carries on (Core_actingOfficers).
 * - club_senders_only (off / watch / on): the activity and Club updates forms are accepted only from those office
 *   bearers' own email; in watch nobody is refused and each row only says who sent it.
 * - weekly_club_email (off / test / on): one email a week to each club's office bearers, each club on its own weekday,
 *   with what the district approved for the club; in test every club's email goes, together, to one test address.
 */

var SENDER_CHECKS = {
  officer: 'An office bearer of the club',
  moderator: 'A district moderator',
  unknown: 'Not checked: no office bearer of the club has an email on file',
  noclub: 'Not checked: club not recognised',
  other: 'Not an office bearer of the club on file',
};
var NOT_ACCEPTED = 'not_accepted';
// tabs a refused form can land in, with what the refusal email and the desk call the item
var GATED = { activities: 'activity', events: 'event', club_profile_requests: 'club details update', public_services: 'public service',
  club_change_requests: 'members and roles update' };

/**
 * Each club's acting office bearers in the Rotary year of today's date (not the year the website shows); one who left
 * or moved to another club no longer counts for the old club (owner, 23 Nov 2026).
 */
function actingOfficers_(master) {
  return Core_actingOfficers(readTab_(mainSs_(), 'officers'), Core_rotaryYearOf(today_()), master || readTab_(privateSs_(), 'members_master'));
}

/** Who sent a form for a club, judged by the sender's Google account: the Core_clubSender result. */
function clubSender_(clubId, email, acting, master) {
  var owner = Core_str(email).toLowerCase() === deskOwner_();
  master = master || readTab_(privateSs_(), 'members_master');
  var check = Core_clubSender(email, clubId, acting || actingOfficers_(master), master, deskModeratorRows_());
  if (owner && check.who !== 'officer') check.who = 'moderator'; // the district account counts as an Administrator
  if (check.who === 'unknown' && !Core_str(clubId)) check.who = 'noclub';
  return check;
}

/**
 * Files a club's form row through the sender check. Off: as before. Watch: filed as before, with sender_check saying
 * who sent it. On: a sender who is not an office bearer (or a moderator) gets a polite email and the row waits as
 * not_accepted, out of the moderators' lists, until a moderator lets it through on the desk.
 */
function fileGated_(ss, tab, row, clubId, alert) {
  var mode = Core_settingMode(settings_().club_senders_only);
  var refused = false;
  if (mode !== 'off') {
    var check = clubSender_(clubId, row.submitter_email);
    row.sender_check = SENDER_CHECKS[check.who];
    if (check.who === 'other' && mode === 'on') {
      refused = true;
      row.status = NOT_ACCEPTED;
      row.moderator_note = ['Not accepted: sent from ' + (Core_str(row.submitter_email) || 'no Google account') +
        ', not an office bearer of the club on file. Let it through on the desk if it should be', Core_str(row.moderator_note)].filter(String).join('; ');
    } else if (check.who === 'other') {
      row.sender_check += ' (would not be accepted once club_senders_only is on)';
    }
  }
  appendRow_(ss, tab, row);
  if (refused) notAcceptedEmail_(tab, row, clubId, check);
  else alert();
}

function notAcceptedEmail_(tab, row, clubId, check) {
  var to = Core_str(row.submitter_email);
  if (!to || Core_isTrue(row.is_sample)) return;
  var club = clubNameById_(clubId) || Core_str(row.club_name) || 'your club';
  var s = settings_();
  var form = Core_str(s.form_club_change_url) || Core_str(s.form_club_updates_url) || Core_str(s.site_url);
  var roles = check.roles.length ? check.roles.join(', ').replace(/, ([^,]*)$/, ' and $1') : '';
  var body = 'Thank you for sending the ' + GATED[tab] + (Core_str(row.title || row.name) && tab !== 'club_change_requests' ? ' "' + Core_str(row.title || row.name) + '"' : '') +
    ' for ' + club + '.\n\nThe district accepts a club\'s activities and club updates from its President, Secretary or Executive Secretary, sent from the email ' +
    'the district has for them. This was sent from ' + to + ', which is not one of them, so it has not gone to the moderators.\n\n' +
    (roles ? 'The district has on record for ' + club + ': the ' + roles + '. Please ask one of them to send it. ' : '') +
    'If your club has new office bearers this year, one of them can tell the district through the Club updates form (members and roles):\n' + form +
    '\n\nIf you are an office bearer and this email is a mistake, reply to it: a district moderator can add your email and let this through.\n\nRotary District 3110';
  try {
    if (!deskQuota_(1)) { Logger.log('Not-accepted email to ' + to + ' not sent: daily email allowance nearly used'); return; }
    MailApp.sendEmail(to, 'Not accepted: only a club\'s office bearers can send this', body, { name: 'Rotary District 3110' });
  } catch (e) {
    Logger.log('Email to ' + to + ' failed: ' + e.message);
  }
}

/** Forms that were not accepted, newest first, for the desk (Content: club items; Members: club changes too). */
function deskNotAccepted_(me) {
  var out = [];
  Object.keys(GATED).forEach(function (tab) {
    if (tab === 'club_change_requests' ? !me.views.members : !me.views.content) return;
    var ss = tab === 'club_change_requests' ? privateSs_() : mainSs_();
    if (!ss.getSheetByName(tab)) return;
    readTab_(ss, tab).forEach(function (r) {
      if (Core_str(r.status) !== NOT_ACCEPTED) return;
      out.push({ tab: tab, id: Core_str(r.id), kind: GATED[tab], club: deskClubName_(r.club_id) || Core_str(r.club_name || r.organiser),
        title: Core_str(r.title || r.name) || (CLUB_CHANGES[Core_str(r.change)] || ''), from: Core_str(r.submitter_email),
        sender: [Core_str(r.submitter_name), Core_str(r.submitter_role)].filter(String).join(', '), submitted: Core_isoTimestamp(r.submitted_at) });
    });
  });
  return out.sort(function (a, b) { return b.submitted.localeCompare(a.submitted); }).slice(0, 50);
}

/** Let through: a not-accepted form goes to the moderators as if an office bearer had sent it. */
function deskLetThrough_(me, tab, id) {
  if (!GATED[tab]) throw deskError_('Unknown list.');
  if (tab === 'club_change_requests' ? !me.views.members : !me.views.content) throw deskError_('Only ' + (tab === 'club_change_requests' ? 'Members' : 'Content') + ' moderators can do this.');
  var ss = tab === 'club_change_requests' ? privateSs_() : mainSs_();
  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    var r = readTab_(ss, tab).filter(function (x) { return Core_str(x.id) === Core_str(id); })[0];
    if (!r) throw deskError_('Not found: it may have been removed from the Sheet.');
    if (Core_str(r.status) !== NOT_ACCEPTED) return { message: 'Already let through or decided.' };
    var note = Core_str(r.moderator_note).split(/;\s*/).filter(function (n) { return n && n.indexOf('Not accepted:') !== 0; });
    var fields = { status: 'pending', moderator_note: note.join('; '), sender_check: SENDER_CHECKS.other + ' (let through by ' + (deskName_(me.email) || me.email) + ')' };
    updateRow_(ss, tab, r._row, fields);
    deskLog_(me, 'let through', tab, r.id, '');
    var row = Object.assign(r, fields);
    if (tab === 'club_change_requests') alertMembers_('change', row); else alertContent_(tab, row);
    return { message: 'Let through: it is now with the moderators' + (tab === 'club_change_requests' ? ' (Members tab).' : ' (To check).') };
  } finally {
    lock.releaseLock();
  }
}

/** For the desk's Roles tab: how many clubs have each role told for this year, carried over, or nobody. */
function deskOfficerYear_() {
  var year = Core_rotaryYearOf(today_());
  var acting = actingOfficers_();
  var carried = [];
  var current = 0;
  var none = 0;
  clubs_().forEach(function (c) {
    if (Core_str(c.status || 'active') !== 'active' || Core_isTrue(c.is_sample)) return;
    var roles = acting[Core_str(c.club_id)] || {};
    if (!roles.President && !roles.Secretary) { none++; return; }
    var old = ['President', 'Secretary'].filter(function (r) { return !roles[r] || roles[r].carried; });
    if (old.length) carried.push(Core_str(c.display_name) || Core_str(c.club_name)); else current++;
  });
  return { year: year, current: current, carried: carried.sort(), none: none };
}

/* ---------- The weekly club email (C66) ---------- */

/**
 * Daily (from dailyJobs): the clubs whose weekday it is get their week's email; a club missed for want of email
 * allowance goes the next day. Nothing is sent to a club where nothing happened.
 */
function weeklyClubEmails() {
  var s = settings_();
  var mode = Core_settingMode(s.weekly_club_email, ['off', 'test', 'on']);
  if (mode === 'off') return 'Weekly club email is off (setting weekly_club_email).';
  var today = today_();
  var key = 'CLUB_WEEKLY_' + mode.toUpperCase();
  var sent = JSON.parse(props_().getProperty(key) || '{}');
  var main = mainSs_();
  var ps = privateSs_();
  var master = readTab_(ps, 'members_master');
  var email = {};
  master.forEach(function (m) {
    if (Core_str(m.status || 'active') === 'active' && !Core_isTrue(m.is_sample) && CORE_EMAIL_RE.test(Core_str(m.email))) email[Core_str(m.member_id)] = Core_str(m.email).toLowerCase();
  });
  var acting = actingOfficers_();
  var real = function (r) { return !Core_isPractice(r) && !Core_isTrue(r.is_sample); };
  var decided = function (tab, ss) {
    return (ss.getSheetByName(tab) ? readTab_(ss, tab) : []).filter(function (r) { return real(r) && Core_str(r.status) === 'approved' && Core_isoTimestamp(r.approved_at); });
  };
  var all = { activities: decided('activities', main), events: decided('events', main), profiles: decided('club_profile_requests', main),
    services: decided('public_services', main), changes: decided('club_change_requests', ps), shown: decided('consent_requests', ps) };
  var formUrl = Core_str(s.form_club_change_url) || Core_str(s.form_club_updates_url);
  var test = [];
  var done = 0;
  var waiting = 0;
  clubs_().forEach(function (c) {
    var id = Core_str(c.club_id);
    if (!id || Core_str(c.status || 'active') !== 'active' || Core_isTrue(c.is_sample)) return;
    if (!Core_clubWeeklyDue(id, today, sent[id])) return;
    var from = sent[id] ? Core_isoTimestamp(sent[id]) : Core_addDays(today, -7) + 'T00:00:00';
    var mine = function (rows, field) {
      return rows.filter(function (r) {
        var at = Core_isoTimestamp(r.approved_at);
        return at > from && (field ? Core_plainName(r[field]) === Core_plainName(c.club_name) : Core_str(r.club_id) === id);
      });
    };
    var roles = acting[id] || {};
    var mail = Core_clubWeeklyEmail(c, { activities: mine(all.activities), events: mine(all.events, 'organiser'), profiles: mine(all.profiles),
      services: mine(all.services), changes: mine(all.changes), shown: mine(all.shown), officers: roles, formUrl: formUrl }, s.site_url);
    var to = [];
    CORE_CLUB_ROLES.forEach(function (r) { var e = roles[r] && email[Core_str(roles[r].member_id)]; if (e && to.indexOf(e) < 0) to.push(e); });
    if (!mail || !to.length) { sent[id] = nowIso_(); return; } // nothing to say, or nobody to say it to: its week starts again
    if (mode === 'test') {
      test.push('==== ' + (Core_str(c.display_name) || Core_str(c.club_name)) + ' (would go to ' + to.length + ' office bearer' + (to.length > 1 ? 's' : '') + ')\n' +
        'Subject: ' + mail.subject + '\n\n' + mail.text);
      sent[id] = nowIso_();
      return;
    }
    if (!deskQuota_(to.length + 20)) { waiting++; return; }
    try {
      MailApp.sendEmail(to.join(','), mail.subject, mail.text, { name: 'Rotary District 3110' });
      sent[id] = nowIso_();
      done++;
    } catch (e) {
      Logger.log('Weekly club email to ' + id + ' failed: ' + e.message);
      waiting++;
    }
  });
  if (mode === 'test' && test.length) {
    var testTo = Core_str(s.weekly_club_email_test_to) || Session.getEffectiveUser().getEmail();
    MailApp.sendEmail(testTo, 'Test: today\'s weekly club emails (' + test.length + ' club' + (test.length > 1 ? 's' : '') + ')',
      'weekly_club_email is set to test, so these were not sent to the clubs. Each would go to the club\'s office bearers.\n\n' + test.join('\n\n'),
      { name: 'Rotary 3110 website' });
  }
  props_().setProperty(key, JSON.stringify(sent));
  var line = mode === 'test' ? 'Weekly club email (test): ' + test.length + ' club email(s) sent to the test address.'
    : 'Weekly club email: sent to ' + done + ' club(s)' + (waiting ? '; ' + waiting + ' wait for tomorrow (email allowance)' : '') + '.';
  Logger.log(line);
  return line;
}

/** For the weekly summary: who sent the club forms this week, while the sender check is on or being watched. */
function senderCheckSummary_(since) {
  var counts = {};
  var tally = function (r) {
    var v = Core_str(r.sender_check);
    if (!v || Core_isoTimestamp(r.submitted_at) < since) return;
    var k = Core_str(r.status) === NOT_ACCEPTED ? 'Not accepted' : v.replace(/ \(.*$/, '');
    counts[k] = (counts[k] || 0) + 1;
  };
  Object.keys(GATED).forEach(function (tab) {
    var ss = tab === 'club_change_requests' ? privateSs_() : mainSs_();
    if (ss.getSheetByName(tab)) readTab_(ss, tab).forEach(tally);
  });
  return Object.keys(counts).map(function (k) { return k + ': ' + counts[k]; });
}
