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
    var m = requestMember_(r, master);
    return m ? 'Matches ' + m.name + ' (' + m.member_id + '), ' + clubName(m.club_id) : 'No member matches: reject (no new record is made from a form)';
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
      form: r.form === 'show' ? 'Show my details' : r.form === 'update' ? 'Update my details' : '',
      sentFrom: Core_str(r.submitter_email), sender: CONSENT_SENDERS[check.who], memberNotice: Core_str(r.member_notice),
      holdUntil: hold > Date.now() ? new Date(hold).toISOString() : '', needsConfirm: check.who === 'other', blocked: !!check.removal,
      choices: r.form ? detailsLines_(r, requestMember_(r, master)) : [
        r.directory_ok ? 'Directory: ' + [r.profession, r.area].filter(String).join(', ') : '',
        r.contact_ok ? 'WhatsApp button' : '',
        r.photo_ok ? 'Photo' : '',
        r.birthday_ok ? 'Birthday ' + r.birthday : '',
        r.anniversary_ok ? 'Anniversary ' + r.anniversary + ' with ' + (r.spouse_name || '?') + (r.spouse_is_rotarian === 'Yes' ? ' (Rotarian, ' + clubName(r.spouse_club_id) + ')' : '') : '',
      ].filter(String),
      description: r.description, website: r.website, photo: thumb(r.photo_file), couplePhoto: thumb(r.couple_photo_file),
      photoRef: Core_str(r.photo_file).split(',')[0].trim(), couplePhotoRef: Core_str(r.couple_photo_file).split(',')[0].trim(),
      warnings: check.warnings.concat(Core_str(r.moderator_note) ? Core_str(r.moderator_note).split('; ') : []).concat([
        r.declaration ? '' : 'Declaration not ticked',
        r.anniversary_ok && r.spouse_is_rotarian !== 'Yes' && !r.spouse_agrees ? 'Spouse agreement not ticked' : '',
        r.directory_ok && !r.profession && !r.form ? 'No profession given' : '',
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
      var contact = joinedContact_(req, readTab_(ps, 'members_master'), id);
      if (m) {
        var active = Core_str(m.status || 'active') === 'active';
        if (Core_str(m.club_id) === Core_str(req.club_id) && active) {
          throw new Error(m.name + ' is already an active member of this club: reject this request.');
        }
        // still in another club: that club's "left" comes first (owner, 23 Nov 2026)
        if (active && Core_str(m.club_id)) {
          throw new Error(m.name + ' is still a member of ' + (clubNameById_(m.club_id) || m.club_id) + '. Approve this after that club\'s "left" for ' +
            'this member has been approved.');
        }
        clubChangeMove_(ps, m, req.club_id, when, 'joined (' + note + ')', Object.assign({ status: 'active' }, contact.fields));
        message = m.name + ' is now recorded in ' + clubNameById_(req.club_id) + '.';
      } else {
        appendRow_(ps, 'members_master', Object.assign({ member_id: id, name: Core_str(req.name), club_id: Core_str(req.club_id), is_rotarian: true, status: 'active',
          notes: 'Added from ' + note + ' (' + today_() + ')' }, contact.fields));
        appendRow_(ps, 'club_history', { member_id: id, club_id: Core_str(req.club_id), from_date: when, reason: 'joined (' + note + ')' });
        message = Core_str(req.name) + ' is added to the members list.';
      }
      if (contact.skipped) message += ' ' + contact.skipped;
    } else if (change === 'left' || change === 'moved' || change === 'deceased') {
      if (!m) throw new Error('No one with member ID ' + id + ' in the members list: check the ID, or reject this request.');
      if (Core_str(m.status) === 'deceased') throw new Error(m.name + ' is already marked as deceased.');
      // "left" only from the club the member is in now: after a move it would take them out of their new club (owner, 23 Nov 2026)
      if (change === 'left' && Core_str(m.club_id) !== Core_str(req.club_id)) {
        throw new Error(m.name + ' is recorded in ' + (clubNameById_(m.club_id) || m.club_id || 'no club') + ', not this club; nothing to do: reject this request.');
      }
      if (change === 'left' && Core_str(m.status || 'active') !== 'active') throw new Error(m.name + ' is already marked as ' + m.status + ': reject this request.');
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

/**
 * A new member's mobile and email from the club changes form (Release 2), when given and valid. An email another
 * member already uses is not saved (owner, 23 Nov 2026: every email is one member's): { fields, skipped }.
 */
function joinedContact_(req, master, memberId) {
  var out = {};
  var skipped = '';
  if (Core_mobile(req.mobile)) out.mobile = Core_str(req.mobile);
  var email = Core_str(req.email).trim().toLowerCase();
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    var owners = Core_emailOwners(email, master, memberId);
    if (owners.length) skipped = 'The email was not saved: member ' + owners[0].member_id + ' already uses it.';
    else out.email = email;
  }
  return { fields: out, skipped: skipped };
}

/** Notes for a moderator on a club change as it is filed: a "joined" for someone still in another club, a used email, a "left" from another club. */
function clubChangeNotes_(req, master) {
  var notes = [];
  var m = clubChangeMember_(req, master);
  var club = function (id) { return clubNameById_(id) || Core_str(id) || 'no club'; };
  var active = m && Core_str(m.status || 'active') === 'active';
  if (req.change === 'joined' && active && Core_str(m.club_id) !== Core_str(req.club_id)) {
    notes.push('Still a member of ' + club(m.club_id) + ': approve after that club\'s "left" for this member is approved');
  }
  if (req.change === 'joined' && Core_str(req.email)) {
    var owners = Core_emailOwners(req.email, master, req.member_id);
    if (owners.length) {
      var o = owners[0];
      notes.push('The email is already used by member ' + o.member_id + ' (' + club(o.club_id) + ', ' + (Core_str(o.status) || 'active') + '): it will not be saved');
    }
  }
  if (req.change === 'left' && m && Core_str(m.club_id) !== Core_str(req.club_id)) {
    notes.push('Recorded in ' + club(m.club_id) + ', not this club: reject');
  }
  return notes;
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
  var acting = actingOfficers_(master);
  var officers = [];
  Object.keys(acting).forEach(function (id) { Object.keys(acting[id]).forEach(function (r) { officers.push(acting[id][r]); }); });
  // a removal the member asked for, or their own Show my details choices (23 Nov 2026), sent after a form for them
  var removals = readTab_(ps, 'removal_requests').concat(readTab_(ps, 'consent_requests').filter(function (r) {
    return Core_str(r.form) === 'show' && !Core_filledByClub(r.filled_by) && Core_str(r.status) === 'approved';
  }));
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
    if (check.removal) throw new Error(Core_removalSince(check.removal) + '; reject this form.');
    if (check.who === 'other' && !confirmed) {
      throw new Error('This form did not come from the member or an office bearer of their club. Check with the member (or their club President ' +
        'or Secretary) first, then tick "I have confirmed this with the member" and approve.');
    }
    var hold = consentHoldUntil_(req, check);
    if (!confirmed && hold > Date.now()) {
      throw new Error('The member has until ' + Core_dateLabel(Core_isoDate(new Date(hold))) + ' to object to this form. Approve after that, ' +
        'or check with the member now and tick "I have confirmed this with the member".');
    }
    if (req.form) return approveDetails_(ps, req, who, confirmed, check);
    var member = findMember_(ps, req);
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

/**
 * The member a request is for. A form never makes a new member (owner, 23 Nov 2026): new members come from the club's
 * "A member joined" or the RI list; a request that finds nobody is rejected.
 */
function findMember_(ps, req) {
  var m = requestMember_(req, readTab_(ps, 'members_master'));
  if (!m) throw new Error('No member matches this request (a form never makes a new member): reject it, and ask the club to check the Rotary member ID.');
  return m;
}

/** The member a request was matched to when it was filed, else as it matches now. */
function requestMember_(req, master) {
  var id = Core_str(req.matched_member_id);
  if (id) return master.filter(function (m) { return Core_str(m.member_id) === id; })[0] || null;
  var i = Core_matchMember(req, master);
  return i >= 0 ? master[i] : null;
}

/** What a My details request asks, in plain lines (the desk card, the member's notice, the receipts). */
function detailsLines_(req, m) {
  var lines = [];
  if (req.form === 'show') {
    var said = { directory: req.directory_ok, profession: req.profession_ok, photo: req.photo_ok, birthday: req.birthday_ok,
      anniversary: req.anniversary_ok, couple_photo: req.couple_photo_ok, call: req.call_ok, whatsapp: req.contact_ok, spotlight: req.spotlight_ok };
    Object.keys(SHOW_ITEMS).forEach(function (k) { lines.push(SHOW_ITEMS[k] + ': ' + (Core_isTrue(said[k]) ? SHOW_COLUMNS[0] : SHOW_COLUMNS[1])); });
    return lines;
  }
  var was = function (k) { return m && Core_str(m[k]) ? ' (was ' + Core_str(m[k]) + ')' : ''; };
  [['Profession', 'profession'], ['Area', 'area'], ['What I do', 'description'], ['Website', 'website'], ['Call number', 'call_number'],
    ['WhatsApp number', 'whatsapp_number'], ['Second email', 'email2']].forEach(function (f) {
    if (Core_str(req[f[1]])) lines.push(f[0] + ': ' + Core_str(req[f[1]]) + was(f[1]));
  });
  if (Core_str(req.birthday)) lines.push('Birthday: ' + req.birthday + (m && Core_dayMonth(m.dob) ? ' (was ' + m.dob + ')' : ''));
  if (Core_str(req.photo_file)) lines.push('A new photo');
  if (Core_str(req.anniversary) || Core_str(req.spouse_name)) {
    lines.push('Anniversary ' + (Core_str(req.anniversary) || '?') + ' with ' + (Core_str(req.spouse_name) || '?') +
      (req.spouse_is_rotarian === 'Yes' ? ' (Rotarian, member ID ' + (Core_str(req.spouse_member_id) || '?') + ')' : ''));
  }
  if (Core_str(req.couple_photo_file)) lines.push('A couple photo');
  if (Core_isTrue(req.remove_business)) lines.push('Remove the business listing');
  return lines.length ? lines : ['Nothing to change'];
}

/** Approves one of the two My details requests (owner, 23 Nov 2026). The checks before it are approveConsent_'s. */
function approveDetails_(ps, req, who, confirmed, check) {
  var m = findMember_(ps, req);
  if (!Core_isTrue(m.is_rotarian) || Core_str(m.status || 'active').toLowerCase() !== 'active') {
    throw new Error(m.name + ' is not an active member in the members list: reject this request.');
  }
  var note = req.form === 'show' ? applyShow_(ps, m, req, who) : applyUpdate_(ps, m, req);
  var done = { status: 'approved', matched_member_id: m.member_id, approved_by: who, approved_at: nowIso_() };
  var notes = [confirmed ? 'Confirmed with the member or their club by ' + who : '', note].filter(String);
  if (notes.length) done.moderator_note = notes.join('; ');
  updateRow_(ps, 'consent_requests', req._row, done);
  refreshPublicMembers(true);
  contentChanged_();
  var what = req.form === 'show' ? 'What the website shows about ' + m.name : 'The details of ' + m.name;
  var body = 'Thank you. ' + what + ' on the Rotary District 3110 website ' + (who === AUTO_BY ? 'have been updated' : 'have been approved by a district moderator') +
    ':\n\n' + detailsLines_(req).map(function (l) { return '- ' + l; }).join('\n') + (note ? '\n\nNote: ' + note : '') +
    '\n\nThe website shows it ' + NEXT_UPDATE + '.' + removalLine_() + '\n\nRotary District 3110';
  if (Core_isTrue(req.is_sample)) return 'Approved ' + req.id + ' for ' + m.name + '.';
  // the sender, and the member at every email they have now (a changed second email: the old one too)
  var fresh = readTab_(ps, 'members_master').filter(function (x) { return x._row === m._row; })[0] || m;
  var to = [Core_str(req.submitter_email)].concat(Core_memberEmails(fresh), req._oldEmail2 ? [req._oldEmail2] : []);
  notifyEmails_(to, (req.form === 'show' ? 'Your choices: ' : 'Your details: ') + m.name, body);
  return 'Approved ' + req.id + ' for ' + m.name + '. The website shows it ' + NEXT_UPDATE + '.';
}

/** Show my details: each choice as answered; what is no longer shown is taken off (a photo also leaves Drive). */
function applyShow_(ps, m, req, who) {
  var on = function (k) { return Core_isTrue(req[k]); };
  var f = {
    directory_ok: on('directory_ok'), profession_ok: on('profession_ok'), contact_ok: on('contact_ok'), call_ok: on('call_ok'),
    photo_ok: on('photo_ok'), birthday_ok: on('birthday_ok'), anniversary_ok: on('anniversary_ok'), spotlight_ok: on('spotlight_ok'),
    listing_approved: true, listing_approved_by: who, listing_approved_at: nowIso_(), consent_source: Core_str(req.filled_by), consent_updated_at: nowIso_(),
  };
  updateRow_(ps, 'members_master', m._row, f);
  if (!f.anniversary_ok) {
    withdrawCouples_(ps, m.member_id, 'Anniversary: Do not list (' + req.id + ')');
    return '';
  }
  var photoOk = on('couple_photo_ok');
  var linked = 0;
  var master = readTab_(ps, 'members_master');
  var byId = function (id) { return master.filter(function (x) { return Core_str(x.member_id) === Core_str(id); })[0] || {}; };
  readTab_(ps, 'couples').forEach(function (c) {
    var isA = Core_str(c.person_a_id) === Core_str(m.member_id);
    if (!isA && Core_str(c.person_b_id) !== Core_str(m.member_id)) return;
    linked++;
    var u = {};
    u[isA ? 'a_consent' : 'b_consent'] = true;
    u[isA ? 'couple_photo_ok_a' : 'couple_photo_ok_b'] = photoOk;
    var other = Core_isTrue(isA ? c.b_consent : c.a_consent);
    // two Rotarian spouses who each gave a date: they must agree before the anniversary shows
    var dates = [byId(c.person_a_id), byId(c.person_b_id)].filter(function (p) { return Core_isTrue(p.is_rotarian) && Core_dayMonth(p.marriage_date); })
      .map(function (p) { return Core_dayMonth(p.marriage_date); });
    var differ = dates.length === 2 && dates[0] !== dates[1];
    u.status = !other ? 'awaiting_spouse' : differ ? 'check_dates' : 'active';
    u.notes = !other ? "Waiting for the spouse's agreement" : differ ? 'The two spouses gave different dates; please check' : '';
    updateRow_(ps, 'couples', c._row, u);
  });
  return linked ? '' : 'Anniversary listed, but the district has no anniversary for this member yet: send it on the Update my details form';
}

/** Update my details: what was given replaces what the district had; blanks change nothing. Returns a note, or ''. */
function applyUpdate_(ps, m, req) {
  var master = readTab_(ps, 'members_master');
  var f = {};
  var notes = [];
  ['profession', 'area', 'description', 'website'].forEach(function (k) { if (Core_str(req[k])) f[k] = Core_str(req[k]); });
  ['call_number', 'whatsapp_number'].forEach(function (k) { if (Core_mobile(req[k])) f[k] = Core_str(req[k]); });
  var email2 = Core_str(req.email2).trim().toLowerCase();
  if (email2) {
    var owners = Core_emailOwners(email2, master, m.member_id);
    if (owners.length) {
      notes.push('Second email not saved: ' + email2 + ' is already used by member ' + owners[0].member_id);
    } else if (email2 !== Core_str(m.email).toLowerCase() && email2 !== Core_str(m.email2).toLowerCase()) {
      if (Core_str(m.email2)) req._oldEmail2 = Core_str(m.email2).toLowerCase();
      f.email2 = email2;
    }
  }
  if (Core_dayMonth(req.birthday)) f.dob = req.birthday;
  if (Core_str(req.photo_file)) {
    if (Core_str(m.photo_file) && m.photo_file !== req.photo_file) trashRef_(m.photo_file); // a newer photo replaces the old
    f.photo_file = Core_str(req.photo_file).split(',')[0].trim();
    f.photo_approved = true;
  }
  if (Core_str(req.anniversary)) f.marriage_date = req.anniversary;
  if (Object.keys(f).length) updateRow_(ps, 'members_master', m._row, f);
  if (Core_str(req.anniversary) || Core_str(req.couple_photo_file)) {
    var fresh = readTab_(ps, 'members_master').filter(function (x) { return x._row === m._row; })[0];
    var n = linkCouple_(ps, fresh, req, Core_isTrue(fresh.anniversary_ok));
    if (n) notes.push(n);
  }
  if (Core_isTrue(req.remove_business)) removeBusinesses_(m.member_id, req.id);
  return notes.join('; ');
}

/** Emails to everyone given (blanks and repeats left out), within the daily allowance. */
function notifyEmails_(list, subject, body) {
  var seen = {};
  list.forEach(function (e) {
    var to = Core_str(e).trim().toLowerCase();
    if (!/@/.test(to) || seen[to]) return;
    seen[to] = true;
    if (!deskQuota_(1)) return;
    try { MailApp.sendEmail(to, subject, body, { name: 'Rotary District 3110' }); } catch (e2) { Logger.log('Email to ' + to + ' failed: ' + e2.message); }
  });
}

/** Creates or updates the couple record for an anniversary request. */
function linkCouple_(ps, member, req, consent) {
  var couples = readTab_(ps, 'couples');
  var master = readTab_(ps, 'members_master');
  var anniversary = req.anniversary;
  if (consent === undefined) consent = true; // forms before 23 Nov 2026 gave the anniversary and the choice together

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
      person_a_id: member.member_id, person_b_id: spouseId, anniversary: anniversary || (existing ? existing.anniversary : ''), a_consent: consent, b_consent: agrees,
      status: !consent ? 'withdrawn' : agrees ? 'active' : 'awaiting_spouse',
      notes: !consent ? 'Waiting for the member to list the anniversary on Show my details' : agrees ? '' : "Spouse's agreement not ticked",
    };
    if (Core_str(req.couple_photo_file)) {
      if (existing && Core_str(existing.couple_photo_file)) trashRef_(existing.couple_photo_file);
      fields.couple_photo_file = Core_str(req.couple_photo_file).split(',')[0].trim();
      fields.couple_photo_ok_a = photoAgreed; fields.couple_photo_ok_b = photoAgreed; fields.couple_photo_approved = true;
    }
    if (existing) updateRow_(ps, 'couples', existing._row, fields); else appendRow_(ps, 'couples', fields);
    return '';
  }

  // Spouse is a Rotarian: each must agree on their own form; found only by the member ID given (owner, 23 Nov 2026:
  // a form never makes a member record)
  var spouseId = Core_str(req.spouse_member_id);
  var spouse = spouseId ? master.filter(function (x) { return Core_str(x.member_id) === spouseId && Core_isTrue(x.is_rotarian); })[0] : null;
  if (!spouse) return "Anniversary not linked: no Rotarian with the spouse's member ID " + (spouseId || '(none given)');
  var couple = couples.filter(function (c) {
    var ids = [Core_str(c.person_a_id), Core_str(c.person_b_id)];
    return ids.indexOf(Core_str(member.member_id)) >= 0 && ids.indexOf(Core_str(spouse.member_id)) >= 0;
  })[0];
  var memberIsA = !couple || Core_str(couple.person_a_id) === Core_str(member.member_id);
  var update = {};
  update[memberIsA ? 'a_consent' : 'b_consent'] = consent;
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
    update.status = consent ? 'awaiting_spouse' : 'withdrawn';
    update.notes = "Waiting for the spouse's own consent form";
    appendRow_(ps, 'couples', update);
    return '';
  }
  var otherConsent = Core_isTrue(memberIsA ? couple.b_consent : couple.a_consent);
  var sameDate = !anniversary || Core_dayMonth(couple.anniversary) === Core_dayMonth(anniversary);
  update.status = !consent ? 'withdrawn' : !otherConsent ? 'awaiting_spouse' : sameDate ? 'active' : 'check_dates';
  update.notes = update.status === 'check_dates' ? 'The two forms give different dates (' + couple.anniversary + ' and ' + anniversary + '); please check' : '';
  updateRow_(ps, 'couples', couple._row, update);
  return '';
}

function withdrawCouples_(ps, memberId, note) {
  readTab_(ps, 'couples').forEach(function (c) {
    if ([Core_str(c.person_a_id), Core_str(c.person_b_id)].indexOf(Core_str(memberId)) >= 0 && Core_str(c.status) !== 'withdrawn') {
      updateRow_(ps, 'couples', c._row, { status: 'withdrawn', couple_photo_ok_a: false, couple_photo_ok_b: false, notes: note });
    }
  });
}

/**
 * A photo replaced by a newer one goes to Google Drive's bin (deleted for good after 30 days). A photo that is only
 * no longer listed stays in Drive, so listing it again needs no new upload (owner, 23 Nov 2026). Sample photos are left alone.
 */
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
    if (all || items.indexOf('my photo') >= 0) f.photo_ok = false; // the photo stays in Drive, not shown
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
          updateRow_(ps, 'couples', c._row, { couple_photo_ok_a: false, couple_photo_ok_b: false });
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
    updateRow_(ss, 'businesses', b._row, { status: 'removed',
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
