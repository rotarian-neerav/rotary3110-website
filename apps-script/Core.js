/**
 * Core rules shared by the Google Apps Script and the website build.
 *
 * Everything here is plain JavaScript with no Google or Node APIs, so the exact
 * same file runs inside the Sheet's script and in the website's automatic tests.
 * It decides what may become public: nothing pending, nothing without consent,
 * never a birth or marriage year, never a phone number or email outside a
 * consented contact link.
 */

var CORE_THEMES = [
  'Promoting peace',
  'Fighting disease',
  'Providing clean water',
  'Saving mothers and children',
  'Supporting education',
  'Growing local economies',
  'Protecting the environment',
  'Club service / Other',
];

var CORE_EVENT_TYPES = [
  'District event',
  'Club event open to all',
  'Vocational visit',
  'Business networking evening',
  'Training or seminar',
];

var IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

function Core_isTrue(v) {
  if (v === true) return true;
  if (v === false || v == null) return false;
  var s = String(v).trim().toLowerCase();
  return s === 'true' || s === 'yes' || s === 'y' || s === '1';
}

function Core_str(v) {
  if (v == null) return '';
  return String(v).trim();
}

function Core_pad(n) {
  return n < 10 ? '0' + n : String(n);
}

/** A Sheet date (Date object) or text, as YYYY-MM-DD in India time. */
function Core_isoDate(v) {
  if (v == null || v === '') return '';
  if (Object.prototype.toString.call(v) === '[object Date]') {
    if (isNaN(v.getTime())) return '';
    var d = new Date(v.getTime() + IST_OFFSET_MS);
    return d.getUTCFullYear() + '-' + Core_pad(d.getUTCMonth() + 1) + '-' + Core_pad(d.getUTCDate());
  }
  var s = Core_str(v);
  var m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return m[1] + '-' + Core_pad(+m[2]) + '-' + Core_pad(+m[3]);
  m = s.match(/^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{4})$/); // DD/MM/YYYY
  if (m) return m[3] + '-' + Core_pad(+m[2]) + '-' + Core_pad(+m[1]);
  return '';
}

/** A time cell or text as HH:MM. */
function Core_time(v) {
  if (v == null || v === '') return '';
  if (Object.prototype.toString.call(v) === '[object Date]') {
    var d = new Date(v.getTime() + IST_OFFSET_MS);
    return Core_pad(d.getUTCHours()) + ':' + Core_pad(d.getUTCMinutes());
  }
  var m = Core_str(v).match(/^(\d{1,2}):(\d{2})/);
  return m ? Core_pad(+m[1]) + ':' + m[2] : '';
}

/** Day and month only ("MM-DD") from a full date, "DD-MM" text or "MM-DD" text. Never keeps a year. */
function Core_dayMonth(v) {
  if (v == null || v === '') return '';
  var iso = Core_isoDate(v);
  if (iso) return iso.slice(5);
  var s = Core_str(v);
  var m = s.match(/^(\d{1,2})[\/.-](\d{1,2})$/); // DD-MM as typed by people in India
  if (m) {
    var day = +m[1];
    var month = +m[2];
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) return Core_pad(month) + '-' + Core_pad(day);
  }
  return '';
}

function Core_isoTimestamp(v) {
  if (v == null || v === '') return '';
  if (Object.prototype.toString.call(v) === '[object Date]') return isNaN(v.getTime()) ? '' : v.toISOString();
  return Core_str(v);
}

/** Converts a 2D array (first row = headers) into objects. */
function Core_rows(values) {
  if (!values || values.length < 1) return [];
  var headers = values[0].map(function (h) { return Core_str(h); });
  var out = [];
  for (var r = 1; r < values.length; r++) {
    var row = values[r];
    var empty = true;
    var obj = {};
    for (var c = 0; c < headers.length; c++) {
      if (!headers[c]) continue;
      obj[headers[c]] = row[c];
      if (row[c] !== '' && row[c] != null) empty = false;
    }
    if (!empty) out.push(obj);
  }
  return out;
}

function Core_list(v) {
  return Core_str(v).split(/\s*[,;\n]\s*/).filter(function (x) { return x; });
}

function Core_slug(s) {
  return Core_str(s).toLowerCase().replace(/^rc\s+/, '').replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

/** Indian mobile number as 91XXXXXXXXXX, or '' if it is not a valid 10-digit mobile. */
function Core_mobile(v) {
  var digits = Core_str(v).replace(/\D/g, '');
  if (digits.length === 12 && digits.indexOf('91') === 0) digits = digits.slice(2);
  if (digits.length === 11 && digits.charAt(0) === '0') digits = digits.slice(1);
  return /^[6-9]\d{9}$/.test(digits) ? '91' + digits : '';
}

function Core_url(v) {
  var s = Core_str(v);
  return /^https?:\/\/[^\s]+$/i.test(s) ? s : '';
}

function Core_firstName(name) {
  return Core_str(name).replace(/^(Rtn|Dr|Mr|Mrs|Ms|Smt|Shri)\.?\s+/i, '').split(/\s+/)[0] || '';
}

/* ------------------------------------------------------------------ */
/* Members and couples: private master -> public tabs                  */
/* ------------------------------------------------------------------ */

/**
 * Builds the rows of the public members and couples tabs from the private sheet.
 * Only active Rotarians whose listing a moderator approved, only the fields they ticked,
 * birthdays and anniversaries as day and month only.
 *
 * master:  rows of members_master
 * couples: rows of couples
 * makeKey: function returning a new random public key (used when a member has none yet)
 * Returns { members, couples, newKeys: {member_id: key}, inactiveKeys: [keys of deceased or departed people] }
 */
function Core_buildMembersPublic(master, couples, makeKey) {
  var byId = {};
  var newKeys = {};
  var members = [];

  master.forEach(function (m) {
    var id = Core_str(m.member_id);
    if (id) byId[id] = m;
  });

  function keyFor(m) {
    var key = Core_str(m.public_key);
    if (!key) {
      key = newKeys[m.member_id] || makeKey();
      newKeys[m.member_id] = key;
    }
    return key;
  }

  function isActiveRotarian(m) {
    return m && Core_isTrue(m.is_rotarian) && Core_str(m.status || 'active').toLowerCase() === 'active';
  }

  master.forEach(function (m) {
    if (!isActiveRotarian(m)) return;
    if (!Core_isTrue(m.listing_approved)) return;
    var directory = Core_isTrue(m.directory_ok);
    var sample = Core_isTrue(m.is_sample);
    // sample members never get a real WhatsApp link; the site shows their buttons as switched off
    var contact = directory && Core_isTrue(m.contact_ok) && (sample || !!Core_mobile(m.mobile));
    var photo = Core_isTrue(m.photo_ok) && Core_isTrue(m.photo_approved) && !!Core_str(m.photo_file);
    var birthday = Core_isTrue(m.birthday_ok) && !!Core_dayMonth(m.dob);
    if (!directory && !photo && !birthday) return;

    members.push({
      public_key: keyFor(m),
      member_id: Core_str(m.member_id), // internal only: used to attach photos to roles, never published
      name: Core_str(m.name),
      club_id: Core_str(m.club_id),
      directory_ok: directory,
      profession: directory ? Core_str(m.profession) : '',
      area: directory ? Core_str(m.area) : '',
      description: directory ? Core_str(m.description) : '',
      website: directory ? Core_url(m.website) : '',
      contact_ok: contact,
      contact_link: contact && !sample ? 'https://wa.me/' + Core_mobile(m.mobile) : '',
      photo_ok: photo,
      photo_file: photo ? Core_str(m.photo_file) : '',
      birthday_ok: birthday,
      birthday: birthday ? Core_dayMonth(m.dob) : '',
      spotlight_ok: directory && Core_isTrue(m.spotlight_ok),
      is_sample: Core_isTrue(m.is_sample),
    });
  });

  var publicCouples = [];
  couples.forEach(function (c) {
    if (Core_str(c.status).toLowerCase() !== 'active') return;
    var a = byId[Core_str(c.person_a_id)];
    var b = byId[Core_str(c.person_b_id)];
    if (!a || !b) return;
    if (!isActiveRotarian(a)) return; // person A is always the member who asked
    var bStatus = Core_str(b.status || 'active').toLowerCase();
    if (bStatus !== 'active') return; // deceased or left: no anniversary greetings
    if (!Core_isTrue(c.a_consent) || !Core_isTrue(c.b_consent)) return;
    var anniversary = Core_dayMonth(c.anniversary);
    if (!anniversary) return;
    var bIsRotarian = Core_isTrue(b.is_rotarian);
    var couplePhoto = Core_isTrue(c.couple_photo_ok_a) && Core_isTrue(c.couple_photo_ok_b) &&
      Core_isTrue(c.couple_photo_approved) && !!Core_str(c.couple_photo_file);

    publicCouples.push({
      couple_key: Core_str(c.couple_id),
      person_a_key: keyFor(a),
      person_a_name: Core_str(a.name),
      person_a_club_id: Core_str(a.club_id),
      person_b_key: bIsRotarian ? keyFor(b) : '',
      // a spouse who is not a member is shown by first name only, never alone in a photo
      person_b_name: bIsRotarian ? Core_str(b.name) : Core_firstName(b.name),
      person_b_club_id: bIsRotarian ? Core_str(b.club_id) : '',
      anniversary: anniversary,
      both_consented: true,
      couple_photo_file: couplePhoto ? Core_str(c.couple_photo_file) : '',
      is_sample: Core_isTrue(c.is_sample),
    });
  });

  var inactiveKeys = master.filter(function (m) {
    return Core_str(m.public_key) && Core_str(m.status || 'active').toLowerCase() !== 'active';
  }).map(function (m) { return Core_str(m.public_key); });

  return { members: members, couples: publicCouples, newKeys: newKeys, inactiveKeys: inactiveKeys };
}

/* ------------------------------------------------------------------ */
/* Main sheet -> public website data                                   */
/* ------------------------------------------------------------------ */

function Core_settings(rows) {
  var s = {};
  rows.forEach(function (r) {
    var k = Core_str(r.key);
    if (k) s[k] = r.value;
  });
  return s;
}

function Core_photoRefs(v) {
  return Core_list(v).map(function (ref) {
    // Google Form uploads arrive as Drive links; keep just the file id
    var m = ref.match(/[-\w]{25,}/);
    if (ref.indexOf('sample:') === 0 || ref.indexOf('thumb:') === 0) return ref;
    return m ? 'drive:' + m[0] : '';
  }).filter(function (x) { return x; });
}

/**
 * Turns the main sheet's tabs into the data the website is built from.
 * tabs: { settings, clubs, officers, functionaries, activities, events, magazines,
 *         messages, spotlights, members_public, couples_public, lists }
 * Each is an array of row objects (see Core_rows).
 */
function Core_buildPublicData(tabs, nowIso) {
  var settings = Core_settings(tabs.settings || []);
  var rotaryYear = Core_str(settings.current_rotary_year);

  var clubs = (tabs.clubs || []).filter(function (c) { return Core_str(c.club_id); }).map(function (c) {
    return {
      club_id: Core_str(c.club_id),
      slug: Core_str(c.slug) || Core_slug(c.club_name),
      name: Core_str(c.club_name),
      display_name: Core_str(c.display_name) || Core_str(c.club_name).replace(/^RC\s+/, 'Rotary Club of '),
      former_names: Core_list(c.former_names),
      city: Core_str(c.city),
      zone: Core_str(c.zone),
      status: Core_str(c.status || 'active').toLowerCase(),
      member_count: Number(c.member_count) || 0,
      meeting: Core_str(c.meeting_day_place),
      links: {
        website: Core_url(c.website),
        facebook: Core_url(c.facebook),
        instagram: Core_url(c.instagram),
        youtube: Core_url(c.youtube),
        x: Core_url(c.x),
        linkedin: Core_url(c.linkedin),
      },
    };
  });
  var clubIds = {};
  clubs.forEach(function (c) { clubIds[c.club_id] = true; });

  var members = (tabs.members_public || []).map(function (m) {
    return {
      public_key: Core_str(m.public_key),
      member_id: Core_str(m.member_id),
      name: Core_str(m.name),
      club_id: Core_str(m.club_id),
      directory_ok: Core_isTrue(m.directory_ok),
      profession: Core_str(m.profession),
      area: Core_str(m.area),
      description: Core_str(m.description),
      website: Core_url(m.website),
      contact_ok: Core_isTrue(m.contact_ok),
      contact_link: Core_str(m.contact_link),
      photo_ok: Core_isTrue(m.photo_ok),
      photo: Core_photoRefs(m.photo_file)[0] || '',
      birthday_ok: Core_isTrue(m.birthday_ok),
      birthday: Core_str(m.birthday),
      spotlight_ok: Core_isTrue(m.spotlight_ok),
      sample: Core_isTrue(m.is_sample), // sample contact buttons are shown disabled on the site
    };
  });
  var photoByMemberId = {};
  members.forEach(function (m) {
    if (m.photo_ok && m.photo && m.member_id) photoByMemberId[m.member_id] = { photo: m.photo, key: m.public_key };
  });

  function roleRow(r) {
    var p = photoByMemberId[Core_str(r.member_id)];
    var contact = Core_isTrue(r.contact_ok) && Core_str(r.contact_link) ? Core_str(r.contact_link) : '';
    return {
      rotary_year: Core_str(r.rotary_year),
      person_key: p ? p.key : '',
      person_ref: Core_str(r.member_id) ? 'P' + Core_hash(Core_str(r.member_id)) : '',
      name: Core_str(r.name),
      role: Core_str(r.role),
      club_id: Core_str(r.club_id),
      photo: p ? p.photo : '',
      contact_ok: !!contact,
      contact_link: contact,
    };
  }

  var officers = (tabs.officers || []).filter(function (o) { return Core_str(o.name); }).map(roleRow);

  var functionaries = (tabs.functionaries || []).filter(function (f) { return Core_str(f.name); }).map(function (f) {
    var row = roleRow(f);
    row.page = Core_str(f.page);
    row.section = Core_str(f.section);
    row.committee = Core_str(f.committee);
    row.zone = Core_str(f.zone);
    row.term = Core_str(f.term);
    row.sort_order = Number(f.sort_order) || 0;
    return row;
  }).sort(function (a, b) { return a.sort_order - b.sort_order; });

  var skipped = [];
  var activities = (tabs.activities || []).filter(function (a) {
    return Core_str(a.status).toLowerCase() === 'approved';
  }).map(function (a) {
    return {
      id: Core_str(a.id),
      club_id: Core_str(a.club_id),
      title: Core_str(a.title),
      date: Core_isoDate(a.date),
      theme: Core_str(a.theme),
      description: Core_str(a.description),
      photos: Core_photoRefs(a.photo_files).slice(0, 3),
      post_link: Core_url(a.post_link),
      people_helped: Number(a.people_helped) || 0,
      amount_spent: Number(a.amount_spent) || 0,
      partner_clubs: Core_list(a.partner_clubs).filter(function (id) { return clubIds[id]; }),
      story_of_month: Core_isTrue(a.story_of_month),
      event_id: Core_str(a.event_id),
      approved_at: Core_isoTimestamp(a.approved_at),
    };
  }).filter(function (a) {
    var ok = a.id && a.title && a.date && clubIds[a.club_id] && (a.photos.length || a.post_link);
    if (!ok) skipped.push(a.id || '(no id)');
    return ok;
  });

  var activityIds = {};
  activities.forEach(function (a) { activityIds[a.id] = a; });

  var events = (tabs.events || []).filter(function (e) {
    return Core_str(e.status).toLowerCase() === 'approved';
  }).map(function (e) {
    var report = Core_str(e.report_activity_id);
    if (!report) {
      activities.forEach(function (a) { if (a.event_id && a.event_id === Core_str(e.id)) report = a.id; });
    }
    return {
      id: Core_str(e.id),
      title: Core_str(e.title),
      event_type: Core_str(e.event_type),
      start_date: Core_isoDate(e.start_date),
      start_time: Core_time(e.start_time),
      end_date: Core_isoDate(e.end_date),
      venue: Core_str(e.venue),
      city: Core_str(e.city),
      organiser: Core_str(e.organiser),
      description: Core_str(e.description),
      map_link: Core_url(e.map_link),
      details_link: Core_url(e.details_link),
      photos: Core_photoRefs(e.photo_files).slice(0, 3),
      report_activity_id: activityIds[report] ? report : '',
    };
  }).filter(function (e) { return e.id && e.title && e.start_date; });

  var magazines = (tabs.magazines || []).map(function (m) {
    return {
      issue_month: Core_str(m.issue_month).slice(0, 7),
      title: Core_str(m.title),
      pdf_url: Core_url(m.pdf_url),
      file: Core_str(m.pdf_file),
      cover: Core_str(m.cover_image),
    };
  }).filter(function (m) { return /^\d{4}-\d{2}$/.test(m.issue_month) && (m.pdf_url || m.file); });

  var messages = (tabs.messages || []).filter(function (m) { return Core_str(m.name) && Core_str(m.message); }).map(function (m) {
    return {
      id: Core_str(m.id),
      name: Core_str(m.name),
      position: Core_str(m.position),
      photo: Core_photoRefs(m.photo)[0] || '',
      message: Core_str(m.message),
      date: Core_isoDate(m.date),
      featured: Core_isTrue(m.featured),
    };
  });

  var memberKeys = {};
  members.forEach(function (m) { memberKeys[m.public_key] = m; });
  var spotlights = (tabs.spotlights || []).map(function (s) {
    return {
      month: Core_str(s.month).slice(0, 7),
      public_key: Core_str(s.public_key),
      headline: Core_str(s.headline),
      story: Core_str(s.story),
    };
  }).filter(function (s) {
    var m = memberKeys[s.public_key];
    return /^\d{4}-\d{2}$/.test(s.month) && m && m.spotlight_ok && s.story;
  });

  var couples = (tabs.couples_public || []).map(function (c) {
    return {
      couple_key: Core_str(c.couple_key),
      person_a_key: Core_str(c.person_a_key),
      person_a_name: Core_str(c.person_a_name),
      person_a_club_id: Core_str(c.person_a_club_id),
      person_b_key: Core_str(c.person_b_key),
      person_b_name: Core_str(c.person_b_name),
      person_b_club_id: Core_str(c.person_b_club_id),
      anniversary: Core_str(c.anniversary),
      both_consented: Core_isTrue(c.both_consented),
      couple_photo: Core_photoRefs(c.couple_photo_file)[0] || '',
    };
  });

  // member_id is used above only to join photos; it never leaves this function
  members.forEach(function (m) { delete m.member_id; });

  return {
    generated_at: nowIso || new Date().toISOString(),
    rebuild_requested_at: Core_isoTimestamp(settings.rebuild_requested_at),
    inactive_keys: Core_list(settings.inactive_keys),
    site: {
      rotary_year: rotaryYear,
      district: Core_str(settings.district_name) || 'Rotary District 3110',
      zones: Core_list(settings.zones),
    },
    forms: {
      activity: Core_url(settings.form_activity_url),
      club_profile: Core_url(settings.form_club_profile_url),
      consent: Core_url(settings.form_consent_url),
      removal: Core_url(settings.form_removal_url),
    },
    lists: {
      themes: CORE_THEMES.slice(),
      event_types: CORE_EVENT_TYPES.slice(),
      professions: Core_list(settings.professions),
    },
    clubs: clubs,
    officers: officers,
    functionaries: functionaries,
    activities: activities,
    events: events,
    magazines: magazines,
    messages: messages,
    spotlights: spotlights,
    members: members,
    couples: couples,
    skipped_activities: skipped,
  };
}

/** Short, stable, non-reversible-looking reference for grouping one person's roles (FNV-1a). */
function Core_hash(s) {
  var h = 0x811c9dc5;
  for (var i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
  }
  return ('0000000' + h.toString(16)).slice(-8);
}

/* ------------------------------------------------------------------ */
/* Safety checks: the build (and the data link) refuse unsafe data     */
/* ------------------------------------------------------------------ */

var CORE_PHONE_RE = /(?:^|[^\w])(?:\+?91[\s-]?)?[6-9]\d{4}[\s-]?\d{5}(?!\w)/; // digits inside a word are not phone numbers
var CORE_EMAIL_RE = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/;
var CORE_YEAR_RE = /\b(19|20)\d{2}\b/;

/** Returns a list of problems. An empty list means the data is safe to publish. */
function Core_validatePublic(data) {
  var errors = [];
  function err(where, msg) { errors.push(where + ': ' + msg); }

  (data.members || []).forEach(function (m, i) {
    var w = 'members[' + i + '] ' + (m.name || '');
    if (!m.directory_ok && !m.photo_ok && !m.birthday_ok) err(w, 'member has not opted in to anything');
    if (!m.directory_ok && (m.profession || m.area || m.description || m.website)) err(w, 'directory details without directory consent');
    if (m.contact_link && !(m.contact_ok && m.directory_ok)) err(w, 'contact link without consent');
    if (m.contact_link && !/^https:\/\/wa\.me\/91[6-9]\d{9}$/.test(m.contact_link)) err(w, 'contact link is not a WhatsApp link');
    if (m.photo && !m.photo_ok) err(w, 'photo without photo consent');
    if (m.birthday && !m.birthday_ok) err(w, 'birthday without consent');
    if (m.birthday && !/^\d{2}-\d{2}$/.test(m.birthday)) err(w, 'birthday must be day and month only, got "' + m.birthday + '"');
    if ('member_id' in m) err(w, 'member ID must never be published');
    ['name', 'profession', 'area', 'description', 'birthday'].forEach(function (f) {
      if (CORE_YEAR_RE.test(Core_str(m[f]))) err(w, f + ' contains a year');
    });
  });

  (data.couples || []).forEach(function (c, i) {
    var w = 'couples[' + i + '] ' + (c.person_a_name || '');
    if (!c.both_consented) err(w, 'anniversary without both spouses\' consent');
    if (!/^\d{2}-\d{2}$/.test(c.anniversary || '')) err(w, 'anniversary must be day and month only, got "' + c.anniversary + '"');
    ['person_a_name', 'person_b_name', 'anniversary'].forEach(function (f) {
      if (CORE_YEAR_RE.test(Core_str(c[f]))) err(w, f + ' contains a year');
    });
  });

  // People marked deceased (or who left) must never get greetings or listings
  var inactive = {};
  (data.inactive_keys || []).forEach(function (k) { if (k) inactive[k] = true; });
  (data.members || []).forEach(function (m, i) {
    if (inactive[m.public_key]) err('members[' + i + '] ' + m.name, 'member is marked deceased or inactive');
  });
  (data.couples || []).forEach(function (c, i) {
    if (inactive[c.person_a_key] || inactive[c.person_b_key]) err('couples[' + i + '] ' + c.person_a_name, 'anniversary for someone marked deceased or inactive');
  });

  (data.officers || []).concat(data.functionaries || []).forEach(function (p, i) {
    if (p.contact_link && !p.contact_ok) err('roles[' + i + '] ' + p.name, 'contact link without consent');
  });

  // No phone numbers or emails anywhere, except consented WhatsApp links
  var scan = JSON.parse(JSON.stringify(data));
  delete scan.forms; // form links are Google addresses, not personal data
  (scan.members || []).forEach(function (m) { if (m.contact_ok) delete m.contact_link; });
  (scan.officers || []).concat(scan.functionaries || []).forEach(function (p) { if (p.contact_ok) delete p.contact_link; });
  Core_walk(scan, '', function (path, value) {
    if (typeof value !== 'string') return;
    if (/^(drive|sample|thumb):/.test(value) || /^https?:\/\//.test(value)) {
      if (CORE_EMAIL_RE.test(value.replace(/^https?:\/\/[^/]*@/, ''))) err(path, 'link contains an email address');
      return;
    }
    if (CORE_PHONE_RE.test(value)) err(path, 'looks like a phone number');
    if (CORE_EMAIL_RE.test(value)) err(path, 'looks like an email address');
  });

  return errors;
}

function Core_walk(node, path, fn) {
  if (Array.isArray(node)) {
    node.forEach(function (v, i) { Core_walk(v, path + '[' + i + ']', fn); });
  } else if (node && typeof node === 'object') {
    Object.keys(node).forEach(function (k) { Core_walk(node[k], path ? path + '.' + k : k, fn); });
  } else {
    fn(path, node);
  }
}

/* ------------------------------------------------------------------ */
/* Helpers used by the Sheet script                                    */
/* ------------------------------------------------------------------ */

/** Finds the member a consent or removal request refers to: member ID first, then mobile + club. */
function Core_matchMember(request, master) {
  var id = Core_str(request.member_id);
  var i;
  if (id) {
    for (i = 0; i < master.length; i++) if (Core_str(master[i].member_id) === id) return i;
  }
  var mobile = Core_mobile(request.mobile);
  if (mobile) {
    for (i = 0; i < master.length; i++) {
      if (Core_mobile(master[i].mobile) === mobile && Core_str(master[i].club_id) === Core_str(request.club_id)) return i;
    }
  }
  return -1;
}

/** Flags a likely duplicate: same club, dates within a day, similar titles. Returns the other id or ''. */
function Core_findDuplicate(row, existing) {
  var date = Core_isoDate(row.date);
  if (!date) return '';
  var t = new Date(date + 'T00:00:00Z').getTime();
  var words = Core_titleWords(row.title);
  for (var i = 0; i < existing.length; i++) {
    var e = existing[i];
    if (Core_str(e.id) === Core_str(row.id)) continue;
    if (Core_str(e.club_id) !== Core_str(row.club_id)) continue;
    if (Core_str(e.status).toLowerCase() === 'rejected') continue;
    var ed = Core_isoDate(e.date);
    if (!ed || Math.abs(new Date(ed + 'T00:00:00Z').getTime() - t) > 86400000) continue;
    var other = Core_titleWords(e.title);
    var common = words.filter(function (w) { return other.indexOf(w) >= 0; }).length;
    if (common / Math.max(1, Math.min(words.length, other.length)) >= 0.5) return Core_str(e.id);
  }
  return '';
}

function Core_titleWords(title) {
  var stop = ['the', 'a', 'an', 'of', 'at', 'in', 'for', 'and', 'on', 'to', 'by', 'with'];
  return Core_str(title).toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(function (w) {
    return w.length > 1 && stop.indexOf(w) < 0;
  });
}

/** Rows still pending after the given number of hours. */
function Core_overdue(rows, nowMs, hours) {
  return rows.filter(function (r) {
    if (Core_str(r.status).toLowerCase() !== 'pending') return false;
    var t = new Date(r.submitted_at).getTime();
    return !isNaN(t) && nowMs - t > hours * 3600000;
  });
}

// Lets the website's Node.js tests load this file; ignored by Google Apps Script.
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    Core_isTrue: Core_isTrue, Core_isoDate: Core_isoDate, Core_dayMonth: Core_dayMonth, Core_rows: Core_rows,
    Core_mobile: Core_mobile, Core_slug: Core_slug, Core_buildMembersPublic: Core_buildMembersPublic,
    Core_buildPublicData: Core_buildPublicData, Core_validatePublic: Core_validatePublic,
    Core_matchMember: Core_matchMember, Core_findDuplicate: Core_findDuplicate, Core_overdue: Core_overdue,
    Core_hash: Core_hash, Core_time: Core_time, CORE_THEMES: CORE_THEMES, CORE_EVENT_TYPES: CORE_EVENT_TYPES,
  };
}
