/**
 * Members, spouses and couples. Everything personal lives in the private Sheet; only the result of
 * Core_buildMembersPublic (opted-in people, ticked fields, day and month only) is copied to the main Sheet.
 */

/** Menu: rebuilds members_public and couples_public from the private Sheet. */
function refreshPublicMembers(silent) {
  var ps = privateSs_();
  attachFolderPhotos_(ps);
  var master = readTab_(ps, 'members_master');
  var couples = readTab_(ps, 'couples');
  var result = Core_buildMembersPublic(master, couples, function () { return 'k' + Utilities.getUuid().replace(/-/g, '').slice(0, 10); });

  // Save any new public keys back to the private Sheet
  Object.keys(result.newKeys).forEach(function (memberId) {
    var row = master.filter(function (m) { return Core_str(m.member_id) === memberId; })[0];
    if (row) updateRow_(ps, 'members_master', row._row, { public_key: result.newKeys[memberId] });
  });

  var problems = Core_validatePublic({ members: stripIds_(result.members), couples: result.couples, inactive_keys: result.inactiveKeys });
  if (problems.length) throw new Error('Public members not refreshed – privacy check failed:\n' + problems.slice(0, 10).join('\n'));

  var main = mainSs_();
  replaceRows_(main, 'members_public', result.members);
  replaceRows_(main, 'couples_public', result.couples);
  setSetting_('inactive_keys', result.inactiveKeys.join(', '));
  if (silent !== true) {
    try {
      SpreadsheetApp.getUi().alert('Public members refreshed: ' + result.members.length + ' members, ' + result.couples.length + ' anniversaries.');
    } catch (e) { /* called from code */ }
  }
  return result;
}

function stripIds_(members) {
  return members.map(function (m) {
    var copy = {};
    Object.keys(m).forEach(function (k) { if (k !== 'member_id') copy[k] = m[k]; });
    return copy;
  });
}

/** Photos the district already holds: <member ID>.jpg in MemberPhotos, used only where the member ticked photo consent. */
function attachFolderPhotos_(ps) {
  var folder = memberPhotosFolder_();
  if (!folder) return;
  var byName = {};
  var files = folder.getFiles();
  while (files.hasNext()) {
    var f = files.next();
    byName[f.getName().replace(/\.(jpe?g|png|webp)$/i, '')] = f.getId();
  }
  readTab_(ps, 'members_master').forEach(function (m) {
    var id = Core_str(m.member_id);
    if (Core_isTrue(m.photo_ok) && !Core_str(m.photo_file) && byName[id]) {
      // placed in the folder by a moderator, so it counts as approved
      updateRow_(ps, 'members_master', m._row, { photo_file: 'drive:' + byName[id], photo_approved: true });
    }
  });
}

/* ---------------- Member requests sidebar ---------------- */

function openMemberRequests() {
  var html = HtmlService.createTemplateFromFile('Sidebar').evaluate().setTitle('Member requests');
  SpreadsheetApp.getUi().showSidebar(html);
}

/** Called by the sidebar. */
function getMemberRequests() {
  return memberRequests_(true);
}

/** The pending member requests; the sidebar gets the photos as pictures, the moderation desk only their references. */
function memberRequests_(withThumbs) {
  var ps = privateSs_();
  var master = readTab_(ps, 'members_master');
  var clubName = function (id) { return clubNameById_(id) || id || '–'; };
  var describe = function (r) {
    var i = Core_matchMember(r, master);
    return i >= 0 ? 'Matches ' + master[i].name + ' (' + master[i].member_id + ')' : 'No matching member – a new record will be created';
  };
  var thumb = function (ref) {
    if (!withThumbs) return '';
    var id = Core_str(ref).replace(/^drive:/, '').split(',')[0].trim();
    if (!id) return '';
    try {
      var blob = DriveApp.getFileById(id).getThumbnail();
      return blob ? 'data:image/png;base64,' + Utilities.base64Encode(blob.getBytes()) : '';
    } catch (e) { return ''; }
  };
  var sender = consentChecker_(ps, master);
  var consent = readTab_(ps, 'consent_requests').filter(function (r) { return Core_str(r.status) === 'pending'; }).map(function (r) {
    var check = Core_isPractice(r) ? { who: 'member', warnings: [] } : sender(r);
    var hold = consentHoldUntil_(r, check);
    return {
      id: r.id, name: r.name, club: clubName(r.club_id), filledBy: r.filled_by, match: describe(r), submitted: Core_isoTimestamp(r.submitted_at),
      sentFrom: Core_str(r.submitter_email), sender: CONSENT_SENDERS[check.who], memberNotice: Core_str(r.member_notice),
      holdUntil: hold > Date.now() ? new Date(hold).toISOString() : '', needsConfirm: check.who === 'other', blocked: !!check.removal,
      choices: [
        r.directory_ok ? 'Directory: ' + [r.profession, r.area].filter(String).join(', ') : '',
        r.contact_ok ? 'WhatsApp button' : '',
        r.photo_ok ? 'Photo' : '',
        r.birthday_ok ? 'Birthday ' + r.birthday : '',
        r.anniversary_ok ? 'Anniversary ' + r.anniversary + ' with ' + (r.spouse_name || '?') + (r.spouse_is_rotarian === 'Yes' ? ' (Rotarian, ' + clubName(r.spouse_club_id) + ')' : '') : '',
      ].filter(String),
      description: r.description, website: r.website, photo: thumb(r.photo_file), couplePhoto: thumb(r.couple_photo_file),
      photoRef: Core_str(r.photo_file).split(',')[0].trim(), couplePhotoRef: Core_str(r.couple_photo_file).split(',')[0].trim(),
      warnings: check.warnings.concat([
        r.declaration ? '' : 'Declaration not ticked',
        r.anniversary_ok && r.spouse_is_rotarian !== 'Yes' && !r.spouse_agrees ? 'Spouse agreement not ticked' : '',
        r.directory_ok && !r.profession ? 'No profession given' : '',
      ]).filter(String),
    };
  });
  var removal = readTab_(ps, 'removal_requests').filter(function (r) { return Core_str(r.status) === 'pending'; }).map(function (r) {
    return { id: r.id, name: r.name, club: clubName(r.club_id), items: r.remove_items, reason: r.reason, match: describe(r), submitted: Core_isoTimestamp(r.submitted_at) };
  });
  var waiting = readTab_(ps, 'couples').filter(function (c) { return ['awaiting_spouse', 'check_dates'].indexOf(Core_str(c.status)) >= 0; }).map(function (c) {
    var name = function (id) { var m = master.filter(function (x) { return Core_str(x.member_id) === Core_str(id); })[0]; return m ? m.name : id; };
    return { id: c.couple_id, names: name(c.person_a_id) + ' & ' + name(c.person_b_id), status: c.status, notes: c.notes };
  });
  var change = readTab_(ps, 'club_change_requests').filter(function (r) { return Core_str(r.status) === 'pending'; }).map(function (r) {
    return clubChangeCard_(r, master);
  });
  return { consent: consent, removal: removal, change: change, waiting: waiting };
}

/* ---------------- Club changes (17 Nov 2026) ---------------- */

/** What a moderator sees of one club change: the request, and beside it what the members list holds for that ID now. */
function clubChangeCard_(r, master) {
  var club = function (id) { return clubNameById_(id) || Core_str(id) || '–'; };
  var m = clubChangeMember_(r, master);
  var lines = [];
  var add = function (label, value) { if (Core_str(value)) lines.push([label, Core_str(value)]); };
  add('Rotary member ID', r.member_id);
  add('Date', Core_isoDate(r.date) || r.date);
  if (r.change === 'moved') add('New club', r.new_club_id === 'outside' ? CLUB_OUTSIDE : club(r.new_club_id));
  add('Rotary year', r.rotary_year);
  add('Role', r.role);
  add('Team', r.section);
  add('Committee', r.committee);
  return {
    id: Core_str(r.id), submitted: Core_isoTimestamp(r.submitted_at), name: Core_str(r.name), club: club(r.club_id), kind: Core_str(r.change),
    change: CLUB_CHANGES[r.change] || Core_str(r.change), lines: lines, note: Core_str(r.note), sentFrom: Core_str(r.submitter_email),
    now: m ? 'Members list: ' + Core_str(m.name) + ', ' + club(m.club_id) + ', ' + (Core_str(m.status) || 'active') : 'Not in the members list',
    warnings: Core_str(r.moderator_note) ? Core_str(r.moderator_note).split('; ') : [],
  };
}

function clubChangeMember_(r, master) {
  var id = Core_str(r.member_id);
  return id ? master.filter(function (m) { return Core_str(m.member_id) === id; })[0] || null : null;
}

/** Called by the sidebar: approve a club change. */
function approveClubChange(requestId, confirmed) {
  return approveClubChange_(requestId, moderatorEmail_(), confirmed === true);
}

/**
 * Makes the change a club sent: the members list and club history for a member who joined, left, moved or passed away
 * (passing away goes through markDeceased_), or a new officers or functionaries row for a role. Then the public members
 * list and the role check are refreshed, a rebuild is asked for, and the sender is told.
 */
function approveClubChange_(requestId, who, confirmed) {
  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    var ps = privateSs_();
    var req = readTab_(ps, 'club_change_requests').filter(function (r) { return r.id === requestId; })[0];
    if (!req || Core_str(req.status) !== 'pending') throw new Error('Request ' + requestId + ' is not pending.');
    var done = { status: 'approved', approved_by: who, approved_at: nowIso_() };
    if (Core_isPractice(req)) {
      updateRow_(ps, 'club_change_requests', req._row, done);
      return 'Practice: approved. Nothing was changed.';
    }
    var change = Core_str(req.change);
    // anyone can send the form, and the club cannot undo a passing away: the moderator confirms first (Release 1)
    if (change === 'deceased' && confirmed !== true) {
      throw new Error('Please confirm with the club that this member has passed away, tick "I have confirmed this with the club", then approve.');
    }
    var id = Core_str(req.member_id);
    if (!id) throw new Error('The request has no Rotary member ID: fill in member_id on the request, or reject it.');
    var m = clubChangeMember_(req, readTab_(ps, 'members_master'));
    var when = Core_isoDate(req.date) || today_();
    var note = 'Club change ' + requestId;
    var message;
    if (change === 'joined') {
      if (!Core_str(req.club_id)) throw new Error('The club was not recognised: fill in club_id on the request, or reject it.');
      if (m && Core_str(m.status) === 'deceased') throw new Error(m.name + ' is marked as deceased in the members list: check the member ID.');
      if (m) {
        if (Core_str(m.club_id) === Core_str(req.club_id) && Core_str(m.status || 'active') === 'active') {
          throw new Error(m.name + ' is already an active member of this club: reject this request.');
        }
        clubChangeMove_(ps, m, req.club_id, when, 'joined (' + note + ')', Object.assign({ status: 'active' }, joinedContact_(req)));
        message = m.name + ' is now recorded in ' + clubNameById_(req.club_id) + '.';
      } else {
        appendRow_(ps, 'members_master', Object.assign({ member_id: id, name: Core_str(req.name), club_id: Core_str(req.club_id), is_rotarian: true, status: 'active',
          notes: 'Added from ' + note + ' (' + today_() + ')' }, joinedContact_(req)));
        appendRow_(ps, 'club_history', { member_id: id, club_id: Core_str(req.club_id), from_date: when, reason: 'joined (' + note + ')' });
        message = Core_str(req.name) + ' is added to the members list.';
      }
    } else if (change === 'left' || change === 'moved' || change === 'deceased') {
      if (!m) throw new Error('No one with member ID ' + id + ' in the members list: check the ID, or reject this request.');
      if (Core_str(m.status) === 'deceased') throw new Error(m.name + ' is already marked as deceased.');
      if (change === 'deceased') {
        markDeceased_(m, who);
        message = m.name + ' is marked as deceased. Greetings stop at once.';
      } else if (change === 'moved' && Core_str(req.new_club_id) !== 'outside') {
        if (!clubNameById_(req.new_club_id)) throw new Error('The new club was not recognised: fill in new_club_id on the request, or reject it.');
        clubChangeMove_(ps, m, req.new_club_id, when, 'moved (' + note + ')', {});
        message = m.name + ' is now recorded in ' + clubNameById_(req.new_club_id) + '.';
      } else {
        var why = change === 'moved' ? 'moved out of District 3110' : 'left';
        updateRow_(ps, 'members_master', m._row, { status: 'left', notes: (Core_str(m.notes) + ' | Left ' + when + ' (' + note + ')').replace(/^ \| /, '') });
        clubChangeEndHistory_(ps, id, when, why + ' (' + note + ')');
        message = m.name + ' is marked as left.';
      }
    } else if (change === 'club_role' || change === 'district_role') {
      if (!Core_str(req.rotary_year) || !Core_str(req.role)) throw new Error('The request has no Rotary year or role: fill them in on the request, or reject it.');
      var name = m ? Core_str(m.name) : Core_str(req.name);
      if (change === 'club_role') {
        if (!Core_str(req.club_id)) throw new Error('The club was not recognised: fill in club_id on the request, or reject it.');
        appendRow_(mainSs_(), 'officers', { rotary_year: req.rotary_year, club_id: req.club_id, member_id: id, name: name, role: req.role, contact_ok: false });
      } else {
        if (!Core_str(req.section)) throw new Error('The request has no district team: fill in section on the request, or reject it.');
        appendRow_(mainSs_(), 'functionaries', clubChangeRoleRow_(req, m, name));
      }
      message = name + ' is added as ' + req.role + ' (' + req.rotary_year + ').' + (m ? '' : ' Not in the members list, so there is no member card until they are.');
    } else {
      throw new Error('This request does not say what changed: reject it.');
    }
    updateRow_(ps, 'club_change_requests', req._row, done);
    refreshPublicMembers(true);
    refreshMemberCounts_();
    try { checkRoles(true); } catch (e) { Logger.log('Role check not run: ' + e.message); }
    contentChanged_();
    notifyMember_(req, 'Approved: ' + (CLUB_CHANGES[change] || 'club change') + ' – ' + Core_str(req.name),
      'Thank you. The change you sent to the district (' + (CLUB_CHANGES[change] || change).toLowerCase() + ': ' + Core_str(req.name) +
      ') has been approved by a district moderator.\n\nThe website shows it ' + NEXT_UPDATE + '.');
    return 'Approved ' + requestId + '. ' + message + ' The website shows it ' + NEXT_UPDATE + '.';
  } finally {
    lock.releaseLock();
  }
}

/** A new member's mobile and email from the club changes form (Release 2), when given and valid. */
function joinedContact_(req) {
  var out = {};
  if (Core_mobile(req.mobile)) out.mobile = Core_str(req.mobile);
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(Core_str(req.email))) out.email = Core_str(req.email);
  return out;
}

/** A member recorded in another club from a date: the open club history row ends, a new one starts, and club_id changes. */
function clubChangeMove_(ps, m, clubId, from, reason, fields) {
  clubChangeEndHistory_(ps, m.member_id, from, reason);
  appendRow_(ps, 'club_history', { member_id: Core_str(m.member_id), club_id: Core_str(clubId), from_date: from, reason: reason });
  fields.club_id = Core_str(clubId);
  updateRow_(ps, 'members_master', m._row, fields);
}

function clubChangeEndHistory_(ps, memberId, to, reason) {
  readTab_(ps, 'club_history').forEach(function (h) {
    if (Core_str(h.member_id) === Core_str(memberId) && !Core_str(h.to_date)) updateRow_(ps, 'club_history', h._row, { to_date: to, reason: reason });
  });
}

/** A functionaries row for a district role: on the page its team is already shown on, after the team's other rows. */
function clubChangeRoleRow_(req, m, name) {
  var rows = readTab_(mainSs_(), 'functionaries');
  var same = rows.filter(function (f) { return Core_str(f.section) === Core_str(req.section); });
  var leadership = ['College of Governors', 'District Counsellors', 'Assistant Governors', "Governor's Office Team"];
  var page = same.length ? Core_str(same[0].page) : leadership.indexOf(Core_str(req.section)) >= 0 ? 'leadership' : 'teams';
  var order = same.filter(function (f) { return Core_str(f.rotary_year) === Core_str(req.rotary_year); })
    .reduce(function (max, f) { return Math.max(max, Number(f.sort_order) || 0); }, 0);
  return { rotary_year: req.rotary_year, page: page, section: req.section, committee: Core_str(req.committee), member_id: Core_str(req.member_id),
    name: name, role: req.role, club_id: m ? Core_str(m.club_id) : Core_str(req.club_id), sort_order: order + 1, contact_ok: false };
}

var CONSENT_SENDERS = { member: "The member's own email", officer: 'An office bearer of the club', other: 'Not the member or a club office bearer' };

/**
 * Safeguards against a consent form sent for someone without their agreement (1 Nov 2026): who sent it, judged
 * against the members list and the club's acting office bearers (Release 3: this year's, or the last known). Returns a
 * function of one consent request.
 */
function consentChecker_(ps, master) {
  master = master || readTab_(ps, 'members_master');
  var acting = actingOfficers_();
  var officers = [];
  Object.keys(acting).forEach(function (id) { Object.keys(acting[id]).forEach(function (r) { officers.push(acting[id][r]); }); });
  var removals = readTab_(ps, 'removal_requests');
  return function (req) { return Core_consentSender(req, master, officers, removals); };
}

/** Until when a request waits for the member to object (0 when it came from the member's own email). */
function consentHoldUntil_(req, check) {
  if (check.who === 'member') return 0;
  var sent = new Date(req.submitted_at).getTime();
  return isNaN(sent) ? 0 : sent + CONFIG.CONSENT_HOLD_DAYS * 86400000;
}

/** Called by the sidebar: approve a consent request (confirmed: the moderator checked with the member or their club). */
function approveConsent(requestId, confirmed) {
  return approveConsent_(requestId, moderatorEmail_(), confirmed);
}

function approveConsent_(requestId, who, confirmed) {
  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    var ps = privateSs_();
    var req = readTab_(ps, 'consent_requests').filter(function (r) { return r.id === requestId; })[0];
    if (!req || Core_str(req.status) !== 'pending') throw new Error('Request ' + requestId + ' is not pending.');
    if (!Core_isTrue(req.declaration)) throw new Error('The declaration was not ticked; reject and ask the member to send the form again.');
    if (Core_isPractice(req)) {
      updateRow_(ps, 'consent_requests', req._row, { status: 'approved', approved_by: who, approved_at: nowIso_() });
      return 'Practice: approved. Nothing was changed in the members list.';
    }
    var check = consentChecker_(ps)(req);
    if (check.removal) throw new Error('The member asked to remove their details after this form was sent (' + check.removal + '); reject this form.');
    if (check.who === 'other' && !confirmed) {
      throw new Error('This form did not come from the member or an office bearer of their club. Check with the member (or their club President ' +
        'or Secretary) first, then tick "I have confirmed this with the member" and approve.');
    }
    var hold = consentHoldUntil_(req, check);
    if (!confirmed && hold > Date.now()) {
      throw new Error('The member has until ' + Core_dateLabel(Core_isoDate(new Date(hold))) + ' to object to this form. Approve after that, ' +
        'or check with the member now and tick "I have confirmed this with the member".');
    }
    var member = findOrCreateMember_(ps, req, 'Created from consent request ' + requestId);
    var fields = {
      directory_ok: Core_isTrue(req.directory_ok), contact_ok: Core_isTrue(req.contact_ok), photo_ok: Core_isTrue(req.photo_ok),
      birthday_ok: Core_isTrue(req.birthday_ok), anniversary_ok: Core_isTrue(req.anniversary_ok), spotlight_ok: Core_isTrue(req.spotlight_ok),
      listing_approved: true, listing_approved_by: who, listing_approved_at: nowIso_(),
      consent_source: req.filled_by, consent_updated_at: nowIso_(),
    };
    if (fields.directory_ok) {
      fields.profession = req.profession; fields.area = req.area; fields.description = req.description; fields.website = req.website;
    }
    if (Core_mobile(req.mobile)) fields.mobile = req.mobile;
    if (Core_str(req.photo_file)) {
      if (Core_str(member.photo_file) && member.photo_file !== req.photo_file) trashRef_(member.photo_file); // newer photo replaces the old
      fields.photo_file = Core_str(req.photo_file).split(',')[0].trim();
      fields.photo_approved = true; // the moderator has seen it in the request
    }
    if (fields.birthday_ok && req.birthday && !Core_dayMonth(member.dob)) fields.dob = req.birthday;
    updateRow_(ps, 'members_master', member._row, fields);

    if (fields.anniversary_ok) linkCouple_(ps, member, req);
    else withdrawCouples_(ps, member.member_id, 'Anniversary not ticked on consent request ' + requestId);

    var done = { status: 'approved', matched_member_id: member.member_id, approved_by: who, approved_at: nowIso_() };
    if (confirmed) done.moderator_note = 'Confirmed with the member or their club by ' + who;
    updateRow_(ps, 'consent_requests', req._row, done);
    refreshPublicMembers(true);
    contentChanged_();
    notifyMember_(req, 'Listed: ' + member.name, 'Thank you. The listing for ' + member.name + ' on the Rotary District 3110 website has been approved, ' +
      'with only the details that were ticked on the form.\n\nIt will appear ' + NEXT_UPDATE + ':\n' + siteUrl_() + 'directory/' +
      removalLine_());
    return 'Approved ' + requestId + ' for ' + member.name;
  } finally {
    lock.releaseLock();
  }
}

function findOrCreateMember_(ps, req, note) {
  var master = readTab_(ps, 'members_master');
  var i = Core_matchMember(req, master);
  if (i >= 0) return master[i];
  var id = Core_str(req.member_id) || nextId_(master, 'TM-');
  var row = appendRow_(ps, 'members_master', {
    member_id: id, name: req.name, club_id: req.club_id, is_rotarian: true, status: 'active', mobile: req.mobile, notes: note,
  });
  appendRow_(ps, 'club_history', { member_id: id, club_id: req.club_id, from_date: today_(), reason: 'recorded from consent form' });
  return readTab_(ps, 'members_master').filter(function (m) { return m._row === row; })[0];
}

/** Creates or updates the couple record for an anniversary request. */
function linkCouple_(ps, member, req) {
  var couples = readTab_(ps, 'couples');
  var master = readTab_(ps, 'members_master');
  var anniversary = req.anniversary;

  if (Core_str(req.spouse_is_rotarian) !== 'Yes') {
    // Spouse is not a Rotarian: the member's tick records the spouse's agreement
    var existing = couples.filter(function (c) {
      if (Core_str(c.person_a_id) !== Core_str(member.member_id)) return false;
      var b = master.filter(function (m) { return Core_str(m.member_id) === Core_str(c.person_b_id); })[0];
      return b && !Core_isTrue(b.is_rotarian);
    })[0];
    var spouseId = existing ? existing.person_b_id : nextId_(master, 'TM-');
    if (!existing) {
      appendRow_(ps, 'members_master', { member_id: spouseId, name: req.spouse_name, is_rotarian: false, status: 'active', spouse_id: member.member_id, notes: 'Spouse (not a Rotarian) of ' + member.name });
    }
    var agrees = Core_isTrue(req.spouse_agrees);
    var photoAgreed = Core_isTrue(req.couple_photo_spouse_agrees) && !!Core_str(req.couple_photo_file);
    var fields = {
      couple_id: existing ? existing.couple_id : nextId_(couples.map(function (c) { return { id: c.couple_id }; }), 'C-'),
      person_a_id: member.member_id, person_b_id: spouseId, anniversary: anniversary, a_consent: true, b_consent: agrees,
      status: agrees ? 'active' : 'awaiting_spouse', notes: agrees ? '' : "Spouse's agreement not ticked",
    };
    if (Core_str(req.couple_photo_file)) {
      if (existing && Core_str(existing.couple_photo_file)) trashRef_(existing.couple_photo_file);
      fields.couple_photo_file = Core_str(req.couple_photo_file).split(',')[0].trim();
      fields.couple_photo_ok_a = photoAgreed; fields.couple_photo_ok_b = photoAgreed; fields.couple_photo_approved = true;
    }
    if (existing) updateRow_(ps, 'couples', existing._row, fields); else appendRow_(ps, 'couples', fields);
    return;
  }

  // Spouse is a Rotarian: each must agree on their own form
  var spouseReq = { member_id: req.spouse_member_id, club_id: req.spouse_club_id, mobile: '' };
  var si = Core_matchMember(spouseReq, master);
  if (si < 0) {
    var target = Core_str(req.spouse_name).toLowerCase().replace(/^(rtn|dr)\.?\s+/g, '').replace(/[^a-z]/g, '');
    master.forEach(function (m, idx) {
      if (si < 0 && Core_str(m.club_id) === Core_str(req.spouse_club_id) &&
        Core_str(m.name).toLowerCase().replace(/^(rtn|dr)\.?\s+/g, '').replace(/[^a-z]/g, '') === target) si = idx;
    });
  }
  var spouse = si >= 0 ? master[si] : null;
  if (!spouse) {
    var newId = Core_str(req.spouse_member_id) || nextId_(master, 'TM-');
    appendRow_(ps, 'members_master', { member_id: newId, name: req.spouse_name, club_id: req.spouse_club_id, is_rotarian: true, status: 'active', notes: 'Spouse of ' + member.name + ' – recorded from a consent form; please check' });
    spouse = { member_id: newId, name: req.spouse_name };
  }
  var couple = couples.filter(function (c) {
    var ids = [Core_str(c.person_a_id), Core_str(c.person_b_id)];
    return ids.indexOf(Core_str(member.member_id)) >= 0 && ids.indexOf(Core_str(spouse.member_id)) >= 0;
  })[0];
  var memberIsA = !couple || Core_str(couple.person_a_id) === Core_str(member.member_id);
  var update = {};
  update[memberIsA ? 'a_consent' : 'b_consent'] = true;
  update[memberIsA ? 'couple_photo_ok_a' : 'couple_photo_ok_b'] = Core_isTrue(req.couple_photo_spouse_agrees);
  if (Core_str(req.couple_photo_file)) {
    update.couple_photo_file = Core_str(req.couple_photo_file).split(',')[0].trim();
    update.couple_photo_approved = true;
  }
  if (!couple) {
    update.couple_id = nextId_(couples.map(function (c) { return { id: c.couple_id }; }), 'C-');
    update.person_a_id = member.member_id;
    update.person_b_id = spouse.member_id;
    update.anniversary = anniversary;
    update.b_consent = false;
    update.status = 'awaiting_spouse';
    update.notes = "Waiting for the spouse's own consent form";
    appendRow_(ps, 'couples', update);
    return;
  }
  var otherConsent = Core_isTrue(memberIsA ? couple.b_consent : couple.a_consent);
  var sameDate = Core_dayMonth(couple.anniversary) === Core_dayMonth(anniversary);
  update.status = !otherConsent ? 'awaiting_spouse' : sameDate ? 'active' : 'check_dates';
  update.notes = update.status === 'check_dates' ? 'The two forms give different dates (' + couple.anniversary + ' and ' + anniversary + '); please check' : '';
  updateRow_(ps, 'couples', couple._row, update);
}

function withdrawCouples_(ps, memberId, note) {
  readTab_(ps, 'couples').forEach(function (c) {
    if ([Core_str(c.person_a_id), Core_str(c.person_b_id)].indexOf(Core_str(memberId)) >= 0 && Core_str(c.status) !== 'withdrawn') {
      if (Core_str(c.couple_photo_file)) trashRef_(c.couple_photo_file);
      updateRow_(ps, 'couples', c._row, { status: 'withdrawn', couple_photo_file: '', couple_photo_ok_a: false, couple_photo_ok_b: false, notes: note });
    }
  });
}

/** Removed photos are moved to Google Drive's bin (deleted for good after 30 days). Sample photos are left alone. */
function trashRef_(ref) {
  var id = Core_str(ref).replace(/^drive:/, '').split(',')[0].trim();
  if (!id || Core_str(ref).indexOf('sample:') === 0) return;
  try { DriveApp.getFileById(id).setTrashed(true); } catch (e) { Logger.log('Could not delete photo ' + id + ': ' + e.message); }
}

/** Called by the sidebar: approve a removal request. Either spouse can withdraw shared items alone. */
function approveRemoval(requestId) {
  return approveRemoval_(requestId, moderatorEmail_());
}

function approveRemoval_(requestId, who) {
  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    var ps = privateSs_();
    var req = readTab_(ps, 'removal_requests').filter(function (r) { return r.id === requestId; })[0];
    if (!req || Core_str(req.status) !== 'pending') throw new Error('Request ' + requestId + ' is not pending.');
    if (Core_isPractice(req)) {
      updateRow_(ps, 'removal_requests', req._row, { status: 'approved', approved_by: who, approved_at: nowIso_() });
      return 'Practice: done. Nothing was removed.';
    }
    var master = readTab_(ps, 'members_master');
    var i = Core_matchMember(req, master);
    if (i < 0) throw new Error('No member matches this request. Find the member on the desk (Find a member) and fill in their RI member ID (member_id) on the request.');
    var m = master[i];
    var items = Core_str(req.remove_items).toLowerCase();
    var all = items.indexOf('everything') >= 0;
    var f = {};
    if (all || items.indexOf('directory') >= 0) { f.directory_ok = false; f.contact_ok = false; f.profession = ''; f.description = ''; f.website = ''; f.spotlight_ok = false; }
    if (all || items.indexOf('whatsapp') >= 0) f.contact_ok = false;
    if (all || items.indexOf('my photo') >= 0) { f.photo_ok = false; if (Core_str(m.photo_file)) trashRef_(m.photo_file); f.photo_file = ''; f.photo_approved = false; }
    if (all || items.indexOf('birthday') >= 0) f.birthday_ok = false;
    if (all || items.indexOf('business') >= 0) removeBusinesses_(m.member_id, requestId);
    if (all) { f.listing_approved = false; f.anniversary_ok = false; }
    f.consent_updated_at = nowIso_();
    f.notes = (Core_str(m.notes) + ' | Removal ' + requestId + ': ' + req.remove_items).replace(/^ \| /, '');
    updateRow_(ps, 'members_master', m._row, f);
    if (all || items.indexOf('anniversary') >= 0) {
      updateRow_(ps, 'members_master', m._row, { anniversary_ok: false });
      withdrawCouples_(ps, m.member_id, 'Withdrawn by ' + m.name + ' (' + requestId + ')');
    } else if (items.indexOf('couple photo') >= 0) {
      readTab_(ps, 'couples').forEach(function (c) {
        if ([Core_str(c.person_a_id), Core_str(c.person_b_id)].indexOf(Core_str(m.member_id)) >= 0 && Core_str(c.couple_photo_file)) {
          trashRef_(c.couple_photo_file);
          updateRow_(ps, 'couples', c._row, { couple_photo_file: '', couple_photo_ok_a: false, couple_photo_ok_b: false });
        }
      });
    }
    updateRow_(ps, 'removal_requests', req._row, { status: 'approved', matched_member_id: m.member_id, approved_by: who, approved_at: nowIso_() });
    refreshPublicMembers(true);
    contentChanged_(); // removals go in the next of the four daily updates (owner, 18 Nov 2026)
    notifyMember_(req, 'Removed: ' + m.name, 'The details you asked us to remove for ' + m.name + ' (' + Core_str(req.remove_items) + ') have been removed ' +
      'from the Rotary District 3110 website records.\n\nThe website drops them ' + NEXT_UPDATE + '. Search engines may take a few days ' +
      'longer to forget a page they had already seen.');
    return 'Removed for ' + m.name + '. The website drops them ' + NEXT_UPDATE + '.';
  } finally {
    lock.releaseLock();
  }
}

/** A member's Rotary Means Business listings come off the website (the rows stay, marked removed). */
function removeBusinesses_(memberId, requestId) {
  var ss = mainSs_();
  readTab_(ss, 'businesses').forEach(function (b) {
    if (Core_str(b.member_id) !== Core_str(memberId) || ['approved', 'pending'].indexOf(Core_str(b.status)) < 0) return;
    if (Core_str(b.photo_files)) trashRef_(b.photo_files);
    updateRow_(ss, 'businesses', b._row, { status: 'removed', photo_files: '',
      moderator_note: (Core_str(b.moderator_note) + '; Removed at the member\'s request (' + requestId + ')').replace(/^; /, '') });
  });
}

/** Called by the sidebar: reject a consent or removal request. */
function rejectRequest(kind, requestId, reason) {
  return rejectRequest_(kind, requestId, reason, moderatorEmail_());
}

function rejectRequest_(kind, requestId, reason, who) {
  var ps = privateSs_();
  var tab = kind === 'removal' ? 'removal_requests' : kind === 'change' ? 'club_change_requests' : 'consent_requests';
  var req = readTab_(ps, tab).filter(function (r) { return r.id === requestId; })[0];
  if (!req) throw new Error('Request not found');
  updateRow_(ps, tab, req._row, { status: 'rejected', moderator_note: reason || '', approved_by: who, approved_at: nowIso_() });
  var what = kind === 'removal' ? 'request to remove details for ' + req.name
    : kind === 'change' ? 'club change for ' + req.name : 'request to show the details of ' + req.name;
  notifyMember_(req, 'Not done yet: ' + what, 'Thank you for sending the ' + what + '. A district moderator could not act on it this time.' +
    (Core_str(reason) ? '\n\nReason: ' + reason : '') + '\n\nYou are welcome to send the form again with the changes.');
  return 'Rejected ' + requestId;
}

/** Confirmation email to whoever sent the consent or removal form (sample rows and forms without an email are skipped). */
function notifyMember_(req, subject, body) {
  var to = Core_str(req.submitter_email);
  if (!to || Core_isTrue(req.is_sample)) return;
  try {
    MailApp.sendEmail(to, subject, body + '\n\nRotary District 3110');
  } catch (e) {
    Logger.log('Email to ' + to + ' failed: ' + e.message);
  }
}

function siteUrl_() {
  return Core_str(settings_().site_url).replace(/\/?$/, '/');
}

function removalLine_() {
  var form = Core_str(settings_().form_removal_url);
  return '\n\nTo change or remove these details at any time, use this form' + (form ? ':\n' + form : ' (linked from the website\'s Privacy page).');
}

/** Menu: stops all greetings for a person who has passed away, immediately. Their roles stay on record. */
function markDeceased() {
  var ui = SpreadsheetApp.getUi();
  var answer = ui.prompt('Mark as deceased', 'Rotary member ID (or internal ID such as T-0012) of the member or spouse:', ui.ButtonSet.OK_CANCEL);
  if (answer.getSelectedButton() !== ui.Button.OK) return;
  var id = answer.getResponseText().trim();
  var ps = privateSs_();
  var m = readTab_(ps, 'members_master').filter(function (x) { return Core_str(x.member_id) === id; })[0];
  if (!m) { ui.alert('No one with ID ' + id + ' in the private members list.'); return; }
  if (ui.alert('Confirm', 'Mark ' + m.name + ' as deceased? Birthday and anniversary greetings for them stop at once.', ui.ButtonSet.YES_NO) !== ui.Button.YES) return;
  markDeceased_(m, moderatorEmail_());
  ui.alert(m.name + ' is marked as deceased. Greetings stop at once; the website shows it ' + NEXT_UPDATE + '.');
}

/** Stops greetings for one members_master row at once; shared by the menu and the moderation desk. */
function markDeceased_(m, who) {
  var ps = privateSs_();
  var id = Core_str(m.member_id);
  updateRow_(ps, 'members_master', m._row, { status: 'deceased', notes: (Core_str(m.notes) + ' | Marked deceased ' + today_() + ' by ' + who).replace(/^ \| /, '') });
  readTab_(ps, 'club_history').forEach(function (h) {
    if (Core_str(h.member_id) === id && !Core_str(h.to_date)) updateRow_(ps, 'club_history', h._row, { to_date: today_(), reason: 'deceased' });
  });
  refreshPublicMembers(true);
  refreshMemberCounts_();
  contentChanged_();
}

/**
 * Each club's member count: the active Rotarians in the private members list (Release 1), so nobody types it. Clubs
 * with no one in the list keep the count they have. One write for the whole column.
 */
function refreshMemberCounts_() {
  var ss = mainSs_();
  var sh = ss.getSheetByName('clubs');
  var headers = headers_(ss, 'clubs');
  var col = headers.indexOf('member_count');
  var idCol = headers.indexOf('club_id');
  if (!sh || col < 0 || idCol < 0 || sh.getLastRow() < 2) return 0;
  var counts = Core_memberCounts(readTab_(privateSs_(), 'members_master'));
  var range = sh.getRange(2, col + 1, sh.getLastRow() - 1, 1);
  var ids = sh.getRange(2, idCol + 1, sh.getLastRow() - 1, 1).getValues();
  var values = range.getValues();
  var changed = 0;
  var next = values.map(function (v, i) {
    var n = counts[Core_str(ids[i][0])];
    if (n == null || Number(v[0]) === n) return [v[0]];
    changed++;
    return [n];
  });
  if (changed) range.setValues(next);
  return changed;
}
