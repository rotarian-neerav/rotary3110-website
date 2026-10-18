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
var DESK_KINDS = { activities: 'Activity', events: 'Event', club_profile_requests: 'Club profile update', public_services: 'Public service' };
// What a moderator may correct on the desk before approving (spelling, length, a phone number in the text)
var DESK_EDITABLE = {
  activities: ['title', 'description', 'press_paper'],
  events: ['title', 'description', 'venue', 'fee'],
  club_profile_requests: ['meeting_day_place', 'permanent_projects', 'regular_services'],
  public_services: ['name', 'timings', 'phone', 'address', 'about'],
};

function doPost(e) {
  var req;
  try { req = JSON.parse((e && e.postData && e.postData.contents) || '{}'); } catch (err) { return json_({ ok: false, error: 'bad request' }); }
  try {
    var out = desk_(req || {});
    out.ok = true;
    return json_(out);
  } catch (err) {
    return json_({ ok: false, error: String(err.message || err), signedOut: !!err.signedOut });
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
  if (fn === 'member') return deskMember_(me, req.kind, req.action, req.id, req.reason);
  if (fn === 'search') return deskSearch_(me, req.q);
  if (fn === 'deceased') return deskDeceased_(me, req.member_id);
  if (fn === 'nudge') return deskNudge_(me, req.club_id, req.via);
  if (fn === 'answered') return deskAnswered_(me, req.id);
  if (fn === 'reply') return deskReply_(me, req.id, req.text);
  throw new Error('unknown request');
}

function deskError_(message, signedOut) {
  var e = new Error(message);
  e.signedOut = !!signedOut;
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
  return { kind: parts[0], tab: parts[1], id: parts[2], email: parts[3] };
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
  return { email: email, name: deskName_(email), types: types, views: Core_deskViews(types) };
}

function deskUser_(session) {
  var t;
  try { t = deskRead_(session, ['ses']); } catch (e) { throw deskError_('Please sign in again.', true); }
  var types = deskTypes_(t.email);
  if (!types.length) throw deskError_('This email is no longer on the moderators list.', true);
  return deskMe_(t.email, types);
}

/* ---------- Signing in ---------- */

function deskSendCode_(email) {
  email = Core_str(email).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw deskError_('Please type your email address.');
  var reply = { message: 'If ' + email + ' is on the moderators list, a code is on its way. Nothing after two minutes? Look in Spam, check the spelling, or ask the website administrator.' };
  if (!deskTypes_(email).length) return reply;
  var cache = CacheService.getScriptCache();
  var hour = Math.floor(Date.now() / 3600000);
  var mine = Number(cache.get('deskrate:' + email + ':' + hour) || 0);
  var all = Number(cache.get('deskrate:all:' + hour) || 0);
  if (mine >= 5 || all >= 40) throw deskError_('Too many codes were asked for. Please try again in an hour.');
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
function deskClubName_(id) {
  if (!DESK_CLUB_NAMES) {
    DESK_CLUB_NAMES = {};
    clubs_().forEach(function (c) { DESK_CLUB_NAMES[Core_str(c.club_id)] = Core_str(c.club_name); });
  }
  return DESK_CLUB_NAMES[Core_str(id)] || Core_str(id);
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
    edit: {},
  };
  (DESK_EDITABLE[tab] || []).forEach(function (k) { card.edit[k] = Core_str(r[k]); });
  if (tab === 'activities') {
    card.title = Core_str(r.title); card.club = Core_str(r.club_name); card.date = Core_isoDate(r.date); card.text = Core_str(r.description);
    add('Theme', r.theme); add('Avenue', r.avenue); add('People helped', r.people_helped); add('Amount spent (₹)', r.amount_spent);
    add('Partner clubs', Core_str(r.partner_clubs).split(',').map(function (s) { return s.trim(); }).filter(String).map(deskClubName_).join(', '));
    if (Core_str(r.campaign_id)) add('Campaign', Core_str(r.campaign_id) + (Core_str(r.campaign_count) !== '' ? ': ' + r.campaign_count : ''));
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
    return { message: (action === 'approve' ? 'Approved: ' + title + '. It will be on the website at the next update (Sunday).' : 'Rejected: ' + title + '. The sender has been told why.'),
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
    return Core_str(a.status) === 'approved' && Core_isoDate(a.date) >= from && Core_isoDate(a.date) <= today;
  }).sort(function (a, b) { return Core_isoDate(b.date).localeCompare(Core_isoDate(a.date)); }).slice(0, 40).map(function (a) {
    return { tab: 'activities', id: Core_str(a.id), title: Core_str(a.title), club: Core_str(a.club_name), date: Core_isoDate(a.date),
      story: Core_isTrue(a.story_of_month), left_out: Core_isTrue(a.bulletin_exclude) };
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
    split(deskFind_(t.tab, t.id).photo_files);
  } else {
    if (me.views.content) {
      MODERATED_TABS.forEach(function (tab) {
        readTab_(mainSs_(), tab).forEach(function (r) { if (Core_str(r.status) === 'pending') split(r.photo_files); });
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

function deskMember_(me, kind, action, id, reason) {
  if (!me.views.members) throw deskError_('Only Members moderators can do this.');
  if (kind !== 'consent' && kind !== 'removal') throw deskError_('Unknown request.');
  var message;
  if (action === 'approve') message = kind === 'consent' ? approveConsent_(id, me.email) : approveRemoval_(id, me.email);
  else if (action === 'reject') {
    if (!Core_str(reason)) throw deskError_('Please write a reason. It is sent to the person who sent the form.');
    message = rejectRequest_(kind, id, Core_str(reason).slice(0, 500), me.email);
  } else throw deskError_('Unknown action.');
  deskLog_(me, action, kind + '_requests', id, reason);
  return { message: message };
}

function deskSearch_(me, q) {
  if (!me.views.members) throw deskError_('Only Members moderators can do this.');
  var want = Core_plainName(q);
  if (want.length < 3) throw deskError_('Type at least three letters of the name.');
  return {
    people: readTab_(privateSs_(), 'members_master').filter(function (m) {
      return Core_str(m.status || 'active') === 'active' && Core_plainName(m.name).indexOf(want) >= 0;
    }).slice(0, 10).map(function (m) {
      return { member_id: Core_str(m.member_id), name: Core_str(m.name), club: deskClubName_(m.club_id) || '–', rotarian: Core_isTrue(m.is_rotarian) };
    }),
  };
}

function deskDeceased_(me, memberId) {
  if (!me.views.members) throw deskError_('Only Members moderators can do this.');
  var m = readTab_(privateSs_(), 'members_master').filter(function (x) { return Core_str(x.member_id) === Core_str(memberId); })[0];
  if (!m) throw deskError_('No one with this ID in the private members list.');
  if (Core_str(m.status) === 'deceased') return { message: m.name + ' was already marked as deceased.' };
  markDeceased_(m, me.email);
  deskLog_(me, 'deceased', 'members_master', m.member_id, '');
  return { message: m.name + ' is marked as deceased. Greetings stop at once; the website updates within about 30 minutes.' };
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
  return Core_quietClubs(all, readTab_(mainSs_(), 'activities'), today, 30).map(function (c) {
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
  if (me.views.clubs) out.clubs = deskClubs_(me);
  if (me.views.office) out.office = deskOffice_();
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

/** A new activity, event, club profile update or public service: one email to each Content moderator, with personal Approve and Reject links. */
function alertContent_(tab, row) {
  try {
    var to = moderatorRecipients_('Content').split(',').filter(String);
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

/** A new consent or removal form: the Members moderators are told to open the desk (no details in the email beyond the name). */
function alertMembers_(kind, row) {
  try {
    var to = moderatorRecipients_('Members').split(',').filter(String);
    if (!deskQuota_(to.length)) return;
    var club = deskClubName_(row.club_id);
    var what = kind === 'removal' ? 'Removal request' : 'Consent form';
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
