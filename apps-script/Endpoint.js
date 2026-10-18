/**
 * The protected data link the website build reads (Deploy → Web app, execute as me, anyone can open).
 * Without the right token it returns nothing. It only ever returns approved rows and public fields,
 * and refuses to answer if the privacy check fails.
 *
 *   ?mode=status&token=…        when a rebuild was last requested
 *   ?mode=data&token=…          the public website data
 *   ?mode=file&id=…&token=…     one approved photo (base64)
 *   ?mode=thumb&id=…&token=…    the first-page picture of a magazine PDF
 *
 * POST requests come from the moderation desk (Desk.js).
 */

function doGet(e) {
  var p = (e && e.parameter) || {};
  try {
    var expected = props_().getProperty('DATA_TOKEN');
    if (!expected || p.token !== expected) return json_({ ok: false, error: 'not allowed' });
    rememberWebAppUrl_(); // the moderation desk's links need the /exec address
    if (p.mode === 'status') return json_({ ok: true, rebuild_requested_at: Core_isoTimestamp(settings_().rebuild_requested_at) });
    if (p.mode === 'data') {
      var data = publicData_();
      return json_({ ok: true, data: data });
    }
    if (p.mode === 'file' || p.mode === 'thumb') return json_(fileFor_(p.mode, p.id));
    return json_({ ok: false, error: 'unknown mode' });
  } catch (err) {
    return json_({ ok: false, error: String(err.message || err) });
  }
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function publicData_() {
  scanMagazines_();
  var ss = mainSs_();
  var tabs = {};
  ['settings', 'clubs', 'officers', 'functionaries', 'activities', 'events', 'magazines', 'messages', 'spotlights', 'members_public', 'couples_public',
    'campaigns', 'public_services', 'profiles', 'past_governors']
    .forEach(function (name) { tabs[name] = readTab_(ss, name); });
  var data = Core_buildPublicData(tabs, nowIso_(), { personRef: personRefFn_(), inactiveIds: inactiveMemberIds_() });
  var problems = Core_validatePublic(data);
  if (problems.length) throw new Error('privacy check failed: ' + problems.slice(0, 5).join(' | '));
  // remember which Drive files may be handed out, for the file mode below
  var allowed = {};
  Core_walk(data, '', function (path, v) {
    if (typeof v === 'string' && /^(drive|thumb):/.test(v)) allowed[v] = true;
  });
  CacheService.getScriptCache().put('allowed_files', JSON.stringify(Object.keys(allowed)), 21600);
  return data;
}

/**
 * The scrambled reference that joins one person's roles and listing into a member card. A keyed hash
 * (HMAC-SHA256 with a secret kept in the script's properties), so the member ID cannot be worked back.
 * The secret is made once and never changes, so card addresses stay the same.
 */
function personRefFn_() {
  var secret = props_().getProperty('PERSON_SECRET');
  if (!secret) {
    secret = Utilities.getUuid() + Utilities.getUuid();
    props_().setProperty('PERSON_SECRET', secret);
  }
  return function (memberId) {
    var bytes = Utilities.computeHmacSha256Signature(String(memberId), secret);
    var hex = '';
    for (var i = 0; i < 6; i++) hex += ('0' + ((bytes[i] + 256) % 256).toString(16)).slice(-2);
    return 'P' + hex;
  };
}

/** Member IDs marked deceased or left in the private members list. */
function inactiveMemberIds_() {
  return readTab_(privateSs_(), 'members_master').filter(function (m) {
    return Core_str(m.member_id) && Core_str(m.status || 'active').toLowerCase() !== 'active';
  }).map(function (m) { return Core_str(m.member_id); });
}

function fileFor_(mode, id) {
  var ref = (mode === 'thumb' ? 'thumb:' : 'drive:') + id;
  var cached = CacheService.getScriptCache().get('allowed_files');
  if (!cached) { publicData_(); cached = CacheService.getScriptCache().get('allowed_files'); }
  if (JSON.parse(cached || '[]').indexOf(ref) < 0) return { ok: false, error: 'file is not part of the public data' };
  var file = DriveApp.getFileById(id);
  var blob = mode === 'thumb' ? file.getThumbnail() : file.getBlob();
  if (!blob) return { ok: false, error: 'no picture available' };
  return { ok: true, mimeType: blob.getContentType(), base64: Utilities.base64Encode(blob.getBytes()) };
}

/** Adds any new PDF in the magazine folder (named like 2026-10.pdf) to the magazines tab. */
function scanMagazines_() {
  var ss = mainSs_();
  var known = readTab_(ss, 'magazines').map(function (m) { return Core_str(m.issue_month).slice(0, 7); });
  var folder = DriveApp.getFolderById(CONFIG.MAGAZINE_FOLDER_ID);
  var covers = {};
  var pdfs = [];
  var files = folder.getFiles();
  while (files.hasNext()) {
    var f = files.next();
    var m = f.getName().match(/^(\d{4})-(\d{2})/);
    if (!m) continue;
    var month = m[1] + '-' + m[2];
    if (/\.pdf$/i.test(f.getName())) pdfs.push({ month: month, id: f.getId() });
    else if (/\.(jpe?g|png|webp)$/i.test(f.getName())) covers[month] = f.getId();
  }
  var names = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  pdfs.forEach(function (p) {
    if (known.indexOf(p.month) >= 0) return;
    appendRow_(ss, 'magazines', {
      issue_month: p.month,
      title: 'District 3110 News – ' + names[+p.month.slice(5) - 1] + ' ' + p.month.slice(0, 4),
      pdf_file: 'drive:' + p.id,
      pdf_url: 'https://drive.google.com/file/d/' + p.id + '/view',
      cover_image: covers[p.month] ? 'drive:' + covers[p.month] : 'thumb:' + p.id,
    });
    known.push(p.month);
  });
}
