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
