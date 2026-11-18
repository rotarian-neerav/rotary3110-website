/**
 * Release 1 (owner, 18 Nov 2026): moderators keep the data up to date on the moderation desk, so nobody edits the
 * Sheets by hand and no one-off scripts are needed. Members moderators correct members; Content and Members
 * moderators correct club office bearers; Members moderators correct district roles; Administrators add, rename and
 * close clubs and name the moderators. Content moderators approve clean activities in one go and hide published ones.
 *
 * Every change is written to the private change_log tab (who, when, old and new value, why), one row per field;
 * the rows of one save share an id, and Undo puts the old values back while the fields still hold the new ones.
 * The moderator_log tab in the main Sheet gets only the action and the row, never members' details.
 */

var DESK_MEMBER_FIELDS = ['member_id', 'name', 'club_id', 'status', 'mobile', 'email'];
var DESK_MEMBER_STATUSES = ['active', 'left', 'deceased'];
var DESK_CLEAN_MAX = 50; // activities approved in one tap at most (well inside Apps Script's 6 minutes)
// An addition is taken back another way (end the role, close the club, set the moderator inactive), not by Undo
var DESK_NO_UNDO = { 'add role': 'end the role instead', 'add club': 'close the club instead', 'add moderator': 'set the moderator to inactive instead' };

function deskReason_(reason) {
  var why = Core_str(reason).slice(0, 500);
  if (why.length < 3) throw deskError_('Please write a reason. It is kept in the change log.');
  return why;
}

function deskAllow_(me, tab) {
  var ok = tab === 'members_master' ? me.views.members
    : tab === 'officers' ? me.views.members || me.views.content
    : tab === 'functionaries' ? me.views.members
    : me.views.admin; // clubs, moderators
  if (!ok) {
    throw deskError_(tab === 'officers' ? 'Only Content or Members moderators can do this.' : tab === 'functionaries' || tab === 'members_master'
      ? 'Only Members moderators can do this.' : 'Only Administrators can do this.');
  }
}

/* ---------- The change log ---------- */

function changeLogId_() {
  return 'CL-' + Utilities.getUuid().replace(/-/g, '').slice(0, 10);
}

function changeLog_(id, me, action, tab, key, changes, reason) {
  var ps = privateSs_();
  var at = nowIso_();
  Object.keys(changes).forEach(function (field) {
    appendRow_(ps, 'change_log', { id: id, at: at, moderator: me.email, action: action, tab: tab, key: Core_str(key), field: field,
      old_value: Core_str(changes[field][0]), new_value: Core_str(changes[field][1]), reason: reason });
  });
}

/** The last changes this moderator may see and undo, newest first, one entry per save. */
function deskChanges_(me) {
  var tabs = [];
  if (me.views.members) tabs.push('members_master', 'functionaries');
  if (me.views.members || me.views.content) tabs.push('officers');
  if (me.views.admin) tabs.push('clubs', 'moderators');
  var groups = {};
  var order = [];
  readTab_(privateSs_(), 'change_log').forEach(function (r) {
    if (tabs.indexOf(Core_str(r.tab)) < 0) return;
    var id = Core_str(r.id);
    if (!groups[id]) {
      groups[id] = { id: id, at: Core_isoTimestamp(r.at), by: deskName_(r.moderator), action: Core_str(r.action), tab: Core_str(r.tab), key: Core_str(r.key),
        reason: Core_str(r.reason), undone: !!Core_str(r.undone_at), can_undo: !DESK_NO_UNDO[Core_str(r.action)], lines: [] };
      order.push(id);
    }
    groups[id].lines.push(Core_str(r.field) + ': ' + (Core_str(r.old_value) || '–') + ' → ' + (Core_str(r.new_value) || '–'));
  });
  return { changes: order.reverse().slice(0, 40).map(function (id) { return groups[id]; }) };
}

/** Puts back the old values of one save, while every field still holds the value that save gave it. */
function deskUndo_(me, id) {
  var ps = privateSs_();
  var rows = readTab_(ps, 'change_log').filter(function (r) { return Core_str(r.id) === Core_str(id); });
  if (!rows.length) throw deskError_('This change is not in the change log.');
  if (rows.some(function (r) { return Core_str(r.undone_at); })) throw deskError_('This change was already undone.');
  var tab = Core_str(rows[0].tab);
  deskAllow_(me, tab);
  if (DESK_NO_UNDO[Core_str(rows[0].action)]) throw deskError_('An addition cannot be undone here: ' + DESK_NO_UNDO[Core_str(rows[0].action)] + '.');
  var back = {};
  rows.forEach(function (r) { back[Core_str(r.field)] = [Core_str(r.new_value), Core_str(r.old_value)]; });
  var why = 'Undo of ' + id + (Core_str(rows[0].reason) ? ' (' + Core_str(rows[0].reason) + ')' : '');
  var current;
  if (tab === 'members_master') {
    current = readTab_(ps, 'members_master').filter(function (m) { return Core_str(m.member_id) === Core_str(rows[0].key); })[0];
  } else {
    var all = readTab_(mainSs_(), tab);
    current = tab === 'clubs' ? all.filter(function (c) { return Core_str(c.club_id) === Core_str(rows[0].key); })[0]
      : all.filter(function (r) { return String(r._row) === Core_str(rows[0].key); })[0];
  }
  if (!current) throw deskError_('The row this change was made to is no longer there.');
  Object.keys(back).forEach(function (f) {
    var now = f === 'status' && tab === 'members_master' ? Core_str(current[f] || 'active') : Core_str(current[f]);
    if (now !== back[f][0]) throw deskError_('Not undone: ' + f + ' has been changed again since (it is now "' + (now || 'blank') + '").');
  });
  var fields = {};
  Object.keys(back).forEach(function (f) { fields[f] = back[f][1]; });
  var out;
  if (tab === 'members_master') out = deskMemberSave_(me, rows[0].key, fields, why);
  else out = deskRowRevert_(me, tab, current, fields, why);
  rows.forEach(function (r) { updateRow_(ps, 'change_log', r._row, { undone_at: nowIso_(), undone_by: me.email }); });
  out.message = 'Undone. ' + out.message;
  return out;
}

/** Undo for a role, club or moderator row: the old values go straight back. */
function deskRowRevert_(me, tab, row, fields, why) {
  var changes = {};
  Object.keys(fields).forEach(function (f) { changes[f] = [Core_str(row[f]), fields[f]]; });
  updateRow_(mainSs_(), tab, row._row, fields);
  changeLog_(changeLogId_(), me, 'undo', tab, tab === 'clubs' ? row.club_id : row._row, changes, why);
  deskLog_(me, 'undo', tab, tab === 'clubs' ? row.club_id : row._row, Object.keys(fields).join(', '));
  if (tab === 'clubs') { try { updateFormLists(true); } catch (e) { Logger.log('Form lists not updated: ' + e.message); } }
  if (tab === 'officers' || tab === 'functionaries') { try { checkRoles(true); } catch (e) { Logger.log('Role check not run: ' + e.message); } }
  contentChanged_();
  return { message: tab === 'clubs' && changes.status ? 'The club is open again; members who were moved or marked as left stay so.' : 'The old values are back.' };
}

/* ---------- Members (Members moderators) ---------- */

/** One member as the desk shows it to a Members moderator (the private Sheet's details stay on the desk). */
function deskPerson_(m) {
  return { member_id: Core_str(m.member_id), name: Core_str(m.name), club_id: Core_str(m.club_id), club: deskClubName_(m.club_id) || '–',
    status: Core_str(m.status || 'active'), mobile: Core_str(m.mobile), email: Core_str(m.email), rotarian: Core_isTrue(m.is_rotarian) };
}

/** A name (3 letters or more), or exactly an RI member ID, an email or a mobile number. */
function deskSearch_(me, q) {
  if (!me.views.members) throw deskError_('Only Members moderators can do this.');
  var text = Core_str(q).trim();
  var master = readTab_(privateSs_(), 'members_master').filter(function (m) { return Core_str(m.member_id); });
  var mobile = Core_mobile(text);
  var email = text.toLowerCase();
  var exact = master.filter(function (m) {
    return Core_str(m.member_id) === text || (/@/.test(email) && Core_str(m.email).toLowerCase() === email) || (mobile && Core_mobile(m.mobile) === mobile);
  });
  if (exact.length) return { people: exact.slice(0, 10).map(deskPerson_) };
  var want = Core_plainName(text);
  if (want.length < 3) throw deskError_('Type at least three letters of the name, or an RI member ID, email or mobile number.');
  return { people: master.filter(function (m) { return Core_plainName(m.name).indexOf(want) >= 0; }).slice(0, 15).map(deskPerson_) };
}

/**
 * A Members moderator corrects a member: name, RI member ID, club, status (active, left, deceased: also the way back
 * from a mistaken "left" or "deceased"), mobile and email. The club history follows the club and status.
 */
function deskMemberSave_(me, memberId, fields, reason) {
  deskAllow_(me, 'members_master');
  var why = deskReason_(reason);
  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    var ps = privateSs_();
    var master = readTab_(ps, 'members_master');
    var m = master.filter(function (x) { return Core_str(x.member_id) === Core_str(memberId); })[0];
    if (!m) throw deskError_('No one with this ID in the members list.');
    var changes = {};
    DESK_MEMBER_FIELDS.forEach(function (k) {
      if (!(k in fields)) return;
      var v = Core_str(fields[k]).trim();
      var was = k === 'status' ? Core_str(m.status || 'active') : Core_str(m[k]);
      if (v !== was) changes[k] = [was, v];
    });
    if (!Object.keys(changes).length) return { message: 'Nothing changed.', person: deskPerson_(m) };
    if (changes.name && !changes.name[1]) throw deskError_('The name cannot be blank.');
    if (changes.member_id) {
      var nid = changes.member_id[1];
      if (!/^[A-Za-z0-9-]{3,20}$/.test(nid)) throw deskError_('An RI member ID has only digits (and letters for internal IDs).');
      if (master.some(function (x) { return Core_str(x.member_id) === nid; })) throw deskError_('Member ID ' + nid + ' is already in the members list (another card).');
    }
    if (changes.club_id && !clubNameById_(changes.club_id[1])) throw deskError_('Choose a club from the list.');
    var endStatus = changes.status ? changes.status[1] : Core_str(m.status || 'active');
    var endClub = clubs_().filter(function (c) { return Core_str(c.club_id) === (changes.club_id ? changes.club_id[1] : Core_str(m.club_id)); })[0];
    if (endStatus === 'active' && endClub && Core_str(endClub.status || 'active') !== 'active' && (changes.status || changes.club_id)) {
      throw deskError_(endClub.club_name + ' has closed: choose the club the member is in now.');
    }
    if (changes.status && DESK_MEMBER_STATUSES.indexOf(changes.status[1]) < 0) throw deskError_('Status is active, left or deceased.');
    if (changes.mobile && changes.mobile[1] && !Core_mobile(changes.mobile[1])) throw deskError_('The mobile number is not a 10-digit Indian mobile.');
    if (changes.email && changes.email[1] && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(changes.email[1])) throw deskError_('The email address is not complete.');

    var id = changes.member_id ? changes.member_id[1] : Core_str(m.member_id);
    if (changes.member_id) renameMemberId_(ps, changes.member_id[0], id);
    var simple = {};
    ['name', 'mobile', 'email'].forEach(function (k) { if (changes[k]) simple[k] = changes[k][1]; });
    if (Object.keys(simple).length) updateRow_(ps, 'members_master', m._row, simple);
    var fresh = function () { return readTab_(ps, 'members_master').filter(function (x) { return Core_str(x.member_id) === id; })[0]; };
    var st0 = Core_str(m.status || 'active');
    var st1 = changes.status ? changes.status[1] : st0;
    var club1 = changes.club_id ? changes.club_id[1] : Core_str(m.club_id);
    var day = today_();
    var note = 'changed on the desk by ' + me.name;
    if (st1 === 'deceased' && st0 !== 'deceased') {
      if (changes.club_id) updateRow_(ps, 'members_master', m._row, { club_id: club1 });
      markDeceased_(fresh(), me.email);
    } else if (st1 === 'left' && st0 !== 'left') {
      updateRow_(ps, 'members_master', m._row, { status: 'left', club_id: club1 });
      clubChangeEndHistory_(ps, id, day, 'left (' + note + ')');
    } else if (st1 === 'active' && st0 !== 'active') {
      updateRow_(ps, 'members_master', m._row, { status: 'active', club_id: club1 });
      appendRow_(ps, 'club_history', { member_id: id, club_id: club1, from_date: day, reason: 'active again (' + note + ')' });
    } else if (changes.club_id) {
      if (st1 === 'active') clubChangeMove_(ps, fresh(), club1, day, 'moved (' + note + ')', {});
      else updateRow_(ps, 'members_master', m._row, { club_id: club1 });
    }
    changeLog_(changeLogId_(), me, 'member', 'members_master', id, changes, why);
    deskLog_(me, 'member change', 'members_master', id, Object.keys(changes).join(', '));
    refreshPublicMembers(true);
    refreshMemberCounts_();
    try { checkRoles(true); } catch (e) { Logger.log('Role check not run: ' + e.message); }
    contentChanged_();
    var roles = changes.member_id ? ' Roles under the old ID ' + changes.member_id[0] + ' are unchanged: correct them on the Roles tab if they belong to this person.' : '';
    return { message: 'Saved: ' + Object.keys(changes).join(', ') + '. The website shows it ' + NEXT_UPDATE + '.' + roles, person: deskPerson_(fresh()) };
  } finally {
    lock.releaseLock();
  }
}

/** A corrected RI member ID follows the member into the club history, couples and spouse links. */
function renameMemberId_(ps, from, to) {
  readTab_(ps, 'members_master').forEach(function (x) {
    if (Core_str(x.member_id) === from) updateRow_(ps, 'members_master', x._row, { member_id: to });
    if (Core_str(x.spouse_id) === from) updateRow_(ps, 'members_master', x._row, { spouse_id: to });
  });
  readTab_(ps, 'club_history').forEach(function (h) { if (Core_str(h.member_id) === from) updateRow_(ps, 'club_history', h._row, { member_id: to }); });
  readTab_(ps, 'couples').forEach(function (c) {
    if (Core_str(c.person_a_id) === from) updateRow_(ps, 'couples', c._row, { person_a_id: to });
    if (Core_str(c.person_b_id) === from) updateRow_(ps, 'couples', c._row, { person_b_id: to });
  });
}

/* ---------- Roles: club office bearers (Content or Members) and district roles (Members) ---------- */

function deskRoleRow_(tab, r, acting) {
  var club = deskClubName_(r.club_id);
  var holder = tab === 'officers' && acting && (acting[Core_str(r.club_id)] || {})[Core_str(r.role)];
  // Release 3: which officer rows act now: this year's, or the last known until this year's is told
  var acts = holder && holder._row === r._row ? (holder.carried ? 'carried over' : 'this year') : '';
  return { acts: acts, tab: tab, row: r._row, rotary_year: Core_str(r.rotary_year), role: Core_str(r.role), name: Core_str(r.name), member_id: Core_str(r.member_id),
    club: club || '', section: Core_str(r.section), committee: Core_str(r.committee), ended_on: Core_isoDate(r.ended_on) || Core_str(r.ended_on),
    ag: tab === 'functionaries' && /assistant governor/i.test(Core_str(r.role)), ag_clubs: Core_str(r.ag_clubs), zone: Core_str(r.zone) };
}

/** Roles by name, RI member ID or club name; newest year first. */
function deskRoles_(me, q) {
  if (!me.views.members && !me.views.content) throw deskError_('Only Content or Members moderators can do this.');
  var text = Core_str(q).trim();
  var want = Core_plainName(text);
  if (want.length < 3 && !/^\d{3,}$/.test(text)) throw deskError_('Type at least three letters of a name or club, or an RI member ID.');
  var main = mainSs_();
  var tabs = me.views.members ? ['officers', 'functionaries'] : ['officers'];
  var acting = actingOfficers_();
  var out = [];
  tabs.forEach(function (tab) {
    readTab_(main, tab).forEach(function (r) {
      if (!Core_str(r.name) && !Core_str(r.member_id)) return;
      var hit = Core_str(r.member_id) === text || (want.length >= 3 && (Core_plainName(r.name).indexOf(want) >= 0 || Core_plainName(deskClubName_(r.club_id)).indexOf(want) >= 0));
      if (hit) out.push(deskRoleRow_(tab, r, acting));
    });
  });
  out.sort(function (a, b) { return b.rotary_year.localeCompare(a.rotary_year) || a.club.localeCompare(b.club) || a.role.localeCompare(b.role); });
  return { roles: out.slice(0, 40) };
}

function deskRoleFind_(tab, row) {
  if (tab !== 'officers' && tab !== 'functionaries') throw deskError_('Unknown list.');
  var r = readTab_(mainSs_(), tab).filter(function (x) { return x._row === Number(row); })[0];
  if (!r) throw deskError_('This role is no longer in the Sheet.');
  return r;
}

/** An active member of the members list, by RI member ID. */
function deskActiveMember_(id) {
  var m = readTab_(privateSs_(), 'members_master').filter(function (x) { return Core_str(x.member_id) === Core_str(id).trim(); })[0];
  if (!m) throw deskError_('No one with member ID ' + Core_str(id) + ' in the members list. Add them first (Club updates form), or check the ID.');
  if (Core_str(m.status || 'active') !== 'active') throw deskError_(m.name + ' is marked "' + m.status + '" in the members list.');
  return m;
}

/** Change who holds a role (the member ID; the name follows the members list), a club role's title, an AG's clubs and zone. */
function deskRoleSave_(me, tab, row, fields, reason) {
  deskAllow_(me, tab);
  var why = deskReason_(reason);
  var r = deskRoleFind_(tab, row);
  if (Core_str(r.ended_on)) throw deskError_('This role has ended. Add a new one instead.');
  var update = {};
  if ('member_id' in fields && Core_str(fields.member_id).trim() !== Core_str(r.member_id)) {
    var m = deskActiveMember_(fields.member_id);
    update.member_id = Core_str(m.member_id);
    if (Core_str(m.name) !== Core_str(r.name)) update.name = Core_str(m.name);
  }
  if (tab === 'officers' && 'role' in fields && Core_str(fields.role) !== Core_str(r.role)) {
    if (CORE_CLUB_ROLES.indexOf(Core_str(fields.role)) < 0) throw deskError_('Choose President, Secretary or Executive Secretary.');
    update.role = Core_str(fields.role);
  }
  if (tab === 'functionaries' && /assistant governor/i.test(Core_str(r.role))) {
    if ('ag_clubs' in fields) {
      var clubRows = clubs_();
      var names = [];
      var unknown = [];
      Core_list(fields.ag_clubs).forEach(function (v) {
        var cid = Core_clubRef(v, clubRows);
        if (!cid) unknown.push(v);
        else if (names.indexOf(clubNameById_(cid)) < 0) names.push(clubNameById_(cid));
      });
      if (unknown.length) throw deskError_('Not in the club list: ' + unknown.join(', ') + '. Use the club names as the list shows them.');
      if (names.join(', ') !== Core_str(r.ag_clubs)) update.ag_clubs = names.join(', ');
    }
    if ('zone' in fields && Core_str(fields.zone) !== Core_str(r.zone)) {
      if (Core_str(fields.zone) && Core_list(settings_().zones).indexOf(Core_str(fields.zone)) < 0) throw deskError_('Choose an area from the list.');
      update.zone = Core_str(fields.zone);
    }
  }
  if (!Object.keys(update).length) return { message: 'Nothing changed.', role: deskRoleRow_(tab, r) };
  var changes = {};
  Object.keys(update).forEach(function (k) { changes[k] = [Core_str(r[k]), update[k]]; });
  updateRow_(mainSs_(), tab, r._row, update);
  changeLog_(changeLogId_(), me, 'role', tab, r._row, changes, why);
  deskLog_(me, 'role change', tab, r._row, Object.keys(update).join(', '));
  try { checkRoles(true); } catch (e) { Logger.log('Role check not run: ' + e.message); }
  contentChanged_();
  return { message: 'Saved. The website shows it ' + NEXT_UPDATE + '.', role: deskRoleRow_(tab, deskRoleFind_(tab, row)) };
}

/** Someone no longer holds a role (resigned, replaced): the row stays, marked ended, and the website stops showing it. */
function deskRoleEnd_(me, tab, row, reason) {
  deskAllow_(me, tab);
  var why = deskReason_(reason);
  var r = deskRoleFind_(tab, row);
  if (Core_str(r.ended_on)) return { message: 'This role had already ended.', role: deskRoleRow_(tab, r) };
  var day = today_();
  updateRow_(mainSs_(), tab, r._row, { ended_on: day });
  changeLog_(changeLogId_(), me, 'end role', tab, r._row, { ended_on: ['', day] }, why);
  deskLog_(me, 'end role', tab, r._row, '');
  try { checkRoles(true); } catch (e) { Logger.log('Role check not run: ' + e.message); }
  contentChanged_();
  return { message: Core_str(r.name) + ' no longer shows as ' + Core_str(r.role) + ' (' + Core_str(r.rotary_year) + ') ' + NEXT_UPDATE + '.', role: deskRoleRow_(tab, deskRoleFind_(tab, row)) };
}

/** A club's President, Secretary or Executive Secretary for this or next Rotary year (one holder of each at a time). */
function deskRoleAdd_(me, f, reason) {
  deskAllow_(me, 'officers');
  var why = deskReason_(reason);
  var clubId = Core_str(f.club_id);
  if (!clubNameById_(clubId)) throw deskError_('Choose a club from the list.');
  var year = Core_str(f.rotary_year);
  var thisYear = Core_rotaryYearOf(today_());
  if ([thisYear, Core_nextRotaryYear(thisYear)].indexOf(year) < 0) throw deskError_('Choose ' + thisYear + ' or ' + Core_nextRotaryYear(thisYear) + '.');
  var role = Core_str(f.role);
  if (CORE_CLUB_ROLES.indexOf(role) < 0) throw deskError_('Choose President, Secretary or Executive Secretary.');
  var m = deskActiveMember_(f.member_id);
  var held = readTab_(mainSs_(), 'officers').filter(function (o) {
    return Core_str(o.club_id) === clubId && Core_str(o.rotary_year) === year && Core_str(o.role) === role && !Core_str(o.ended_on);
  })[0];
  if (held) throw deskError_(Core_str(held.name) + ' is already ' + role + ' of ' + clubNameById_(clubId) + ' for ' + year + '. End that role first, or change who holds it.');
  var row = appendRow_(mainSs_(), 'officers', { rotary_year: year, club_id: clubId, member_id: Core_str(m.member_id), name: Core_str(m.name), role: role, contact_ok: false });
  changeLog_(changeLogId_(), me, 'add role', 'officers', row, { role: ['', role + ', ' + clubNameById_(clubId) + ', ' + year + ': ' + Core_str(m.name) + ' (' + m.member_id + ')'] }, why);
  deskLog_(me, 'add role', 'officers', row, '');
  try { checkRoles(true); } catch (e) { Logger.log('Role check not run: ' + e.message); }
  contentChanged_();
  var other = Core_str(m.club_id) && Core_str(m.club_id) !== clubId ? ' Note: the members list has ' + m.name + ' in ' + clubNameById_(m.club_id) + '.' : '';
  return { message: Core_str(m.name) + ' is added as ' + role + ' of ' + clubNameById_(clubId) + ' (' + year + ').' + other };
}

/** The daily role check's findings, for Members moderators to fix on the desk. */
function deskRoleChecks_() {
  var main = mainSs_();
  if (!main.getSheetByName('role_checks')) return [];
  return readTab_(main, 'role_checks').slice(0, 100).map(function (p) {
    return { tab: Core_str(p.tab), row: Number(p.row) || '', rotary_year: Core_str(p.rotary_year), name: Core_str(p.name), member_id: Core_str(p.member_id), problem: Core_str(p.problem) };
  });
}

/* ---------- Clubs (Administrators) ---------- */

function deskClubRow_(c) {
  return { club_id: Core_str(c.club_id), club_name: Core_str(c.club_name), city: Core_str(c.city), zone: Core_str(c.zone), status: Core_str(c.status || 'active'),
    charter_date: Core_isoDate(c.charter_date), member_count: Number(c.member_count) || 0, merged_into: deskClubName_(c.merged_into) || '' };
}

function deskClubCheck_(f, except) {
  var name = Core_str(f.club_name).trim();
  if (name.length < 4) throw deskError_('Please write the club\'s name, for example RC Agra Heritage.');
  var clash = clubs_().filter(function (c) { return Core_str(c.club_id) !== except && Core_plainName(c.club_name) === Core_plainName(name); })[0];
  if (clash) throw deskError_(name + ' is already in the club list (club ID ' + clash.club_id + ').');
  if (Core_str(f.zone) && Core_list(settings_().zones).indexOf(Core_str(f.zone)) < 0) throw deskError_('Choose an area from the list.');
  if (Core_str(f.charter_date) && !Core_isoDate(f.charter_date)) throw deskError_('The charter date is not a date.');
  return name;
}

/** A new club: its RI club ID, name, city, zone and charter date. The forms list it at once. */
function deskClubAdd_(me, f, reason) {
  deskAllow_(me, 'clubs');
  var why = deskReason_(reason);
  var id = Core_str(f.club_id).trim();
  if (!/^\d{3,10}$/.test(id)) throw deskError_('The RI club ID has only digits.');
  if (clubs_().some(function (c) { return Core_str(c.club_id) === id; })) throw deskError_('Club ID ' + id + ' is already in the club list.');
  var name = deskClubCheck_(f, '');
  if (!Core_str(f.city).trim()) throw deskError_('Please write the club\'s city.');
  var slug = Core_slug(name);
  var slugs = clubs_().map(function (c) { return Core_str(c.slug) || Core_slug(c.club_name); });
  while (slugs.indexOf(slug) >= 0) slug += '-' + id.slice(-2);
  var row = { club_id: id, club_name: name, slug: slug, city: Core_str(f.city).trim(), zone: Core_str(f.zone), status: 'active', member_count: 0,
    charter_date: Core_isoDate(f.charter_date) || '' };
  appendRow_(mainSs_(), 'clubs', row);
  changeLog_(changeLogId_(), me, 'add club', 'clubs', id, { club_name: ['', name], city: ['', row.city], zone: ['', row.zone], charter_date: ['', row.charter_date] }, why);
  deskLog_(me, 'add club', 'clubs', id, name);
  DESK_CLUB_NAMES = null;
  try { updateFormLists(true); } catch (e) { Logger.log('Form lists not updated: ' + e.message); }
  contentChanged_();
  return { message: name + ' is added. The forms list it now; the website shows it ' + NEXT_UPDATE + '.', club: deskClubRow_(row) };
}

/** Rename a club or correct its city, zone or charter date. A new name keeps the old one as a former name and the same web address. */
function deskClubSave_(me, clubId, f, reason) {
  deskAllow_(me, 'clubs');
  var why = deskReason_(reason);
  var c = clubs_().filter(function (x) { return Core_str(x.club_id) === Core_str(clubId); })[0];
  if (!c) throw deskError_('Unknown club.');
  var update = {};
  if ('club_name' in f && Core_str(f.club_name).trim() !== Core_str(c.club_name)) {
    update.club_name = deskClubCheck_(f, Core_str(c.club_id));
    var former = Core_list(c.former_names);
    if (former.indexOf(Core_str(c.club_name)) < 0) former.push(Core_str(c.club_name));
    update.former_names = former.join(', ');
    if (Core_str(c.display_name)) update.display_name = '';
  } else if ('zone' in f || 'charter_date' in f) {
    deskClubCheck_({ club_name: c.club_name, zone: f.zone, charter_date: f.charter_date }, Core_str(c.club_id));
  }
  if ('city' in f && Core_str(f.city).trim() && Core_str(f.city).trim() !== Core_str(c.city)) update.city = Core_str(f.city).trim();
  if ('zone' in f && Core_str(f.zone) !== Core_str(c.zone)) update.zone = Core_str(f.zone);
  if ('charter_date' in f && (Core_isoDate(f.charter_date) || '') !== (Core_isoDate(c.charter_date) || '')) update.charter_date = Core_isoDate(f.charter_date) || '';
  if (!Object.keys(update).length) return { message: 'Nothing changed.', club: deskClubRow_(c) };
  var changes = {};
  Object.keys(update).forEach(function (k) { changes[k] = [k === 'charter_date' ? Core_isoDate(c[k]) || '' : Core_str(c[k]), update[k]]; });
  updateRow_(mainSs_(), 'clubs', c._row, update);
  changeLog_(changeLogId_(), me, 'club', 'clubs', c.club_id, changes, why);
  deskLog_(me, 'club change', 'clubs', c.club_id, Object.keys(update).join(', '));
  DESK_CLUB_NAMES = null;
  if (update.club_name) { try { updateFormLists(true); } catch (e) { Logger.log('Form lists not updated: ' + e.message); } }
  contentChanged_();
  return { message: 'Saved. The website shows it ' + NEXT_UPDATE + '.', club: deskClubRow_(clubs_().filter(function (x) { return x._row === c._row; })[0]) };
}

/**
 * A club closes: it leaves the forms and the website's club list, and its active members either move to the club it
 * merged into or are marked as left. Their club history records it.
 */
function deskClubClose_(me, clubId, moveTo, reason) {
  deskAllow_(me, 'clubs');
  var why = deskReason_(reason);
  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    var all = clubs_();
    var c = all.filter(function (x) { return Core_str(x.club_id) === Core_str(clubId); })[0];
    if (!c) throw deskError_('Unknown club.');
    if (Core_str(c.status || 'active') !== 'active') throw deskError_(c.club_name + ' is already closed.');
    var target = Core_str(moveTo);
    if (target) {
      var t = all.filter(function (x) { return Core_str(x.club_id) === target; })[0];
      if (!t || target === Core_str(c.club_id) || Core_str(t.status || 'active') !== 'active') throw deskError_('Choose an open club for the members to move to.');
    }
    var ps = privateSs_();
    var day = today_();
    var moved = 0;
    readTab_(ps, 'members_master').forEach(function (m) {
      if (Core_str(m.club_id) !== Core_str(c.club_id) || Core_str(m.status || 'active') !== 'active') return;
      if (target) clubChangeMove_(ps, m, target, day, 'club merged into ' + clubNameById_(target), {});
      else {
        updateRow_(ps, 'members_master', m._row, { status: 'left' });
        clubChangeEndHistory_(ps, m.member_id, day, 'club closed');
      }
      moved++;
    });
    updateRow_(mainSs_(), 'clubs', c._row, { status: 'inactive', merged_into: target });
    changeLog_(changeLogId_(), me, 'close club', 'clubs', c.club_id, { status: ['active', 'inactive'], merged_into: ['', target] }, why);
    deskLog_(me, 'close club', 'clubs', c.club_id, moved + ' member(s) ' + (target ? 'moved' : 'marked left'));
    refreshPublicMembers(true);
    refreshMemberCounts_();
    try { updateFormLists(true); } catch (e) { Logger.log('Form lists not updated: ' + e.message); }
    contentChanged_();
    return { message: c.club_name + ' is closed. ' + moved + ' member(s) ' + (target ? 'moved to ' + clubNameById_(target) : 'marked as left') + '. The website shows it ' + NEXT_UPDATE + '.' };
  } finally {
    lock.releaseLock();
  }
}

/* ---------- Moderators (Administrators) ---------- */

function deskModeratorRow_(r) {
  return { row: r._row, type: Core_str(r.type), name: Core_str(r.name), email: Core_str(r.email), active: Core_moderatorActive(r),
    zone: Core_str(r.zone), notes: Core_str(r.notes) };
}

function deskModerators_() {
  return deskModeratorRows_().filter(function (r) { return Core_str(r.email); }).map(deskModeratorRow_);
}

/** Adds a moderator (row blank) or changes one: type, name, email, zone, active. Desk only: Sheet access stays with the owner. */
function deskModeratorSave_(me, row, f, reason) {
  deskAllow_(me, 'moderators');
  var why = deskReason_(reason);
  var main = mainSs_();
  var current = row ? readTab_(main, 'moderators').filter(function (r) { return r._row === Number(row); })[0] : null;
  if (row && !current) throw deskError_('This moderator row is no longer in the Sheet.');
  var next = {
    type: 'type' in f ? Core_str(f.type) : Core_str(current && current.type),
    name: 'name' in f ? Core_str(f.name).trim() : Core_str(current && current.name),
    email: 'email' in f ? Core_str(f.email).trim().toLowerCase() : Core_str(current && current.email),
    zone: 'zone' in f ? Core_list(f.zone).join(', ') : Core_str(current && current.zone),
    active: 'active' in f ? (f.active === false || Core_str(f.active).toUpperCase() === 'FALSE' ? 'FALSE' : 'TRUE') : Core_str(current && current.active) || 'TRUE',
  };
  if (CORE_MODERATOR_TYPES.indexOf(next.type) < 0) throw deskError_('Choose a type of moderator.');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(next.email)) throw deskError_('Please write the moderator\'s Google email address.');
  if (!next.name) throw deskError_('Please write the moderator\'s name.');
  var zones = Core_list(settings_().zones);
  Core_list(next.zone).forEach(function (z) { if (zones.indexOf(z) < 0) throw deskError_('Choose areas from the list.'); });
  if (next.email === me.email && next.active === 'FALSE') throw deskError_('You cannot take yourself off the moderators list. Ask another Administrator.');
  var clash = readTab_(main, 'moderators').filter(function (r) {
    return r._row !== (current && current._row) && Core_str(r.email).toLowerCase() === next.email && Core_str(r.type) === next.type;
  })[0];
  if (clash) throw deskError_(next.email + ' is already a ' + next.type + ' moderator (change that row instead).');
  var changes = {};
  Object.keys(next).forEach(function (k) { if (!current || Core_str(current[k]) !== next[k]) changes[k] = [current ? Core_str(current[k]) : '', next[k]]; });
  if (!Object.keys(changes).length) return { message: 'Nothing changed.' };
  var at;
  if (current) {
    updateRow_(main, 'moderators', current._row, next);
    at = current._row;
  } else {
    next.from_date = today_();
    next.sheet_access = 'FALSE';
    next.notes = 'Added on the moderation desk by ' + me.name;
    at = appendRow_(main, 'moderators', next);
  }
  changeLog_(changeLogId_(), me, current ? 'moderator' : 'add moderator', 'moderators', at, changes, why);
  deskLog_(me, current ? 'moderator change' : 'add moderator', 'moderators', at, next.type);
  return { message: (current ? 'Saved.' : next.name + ' is added as a ' + next.type + ' moderator. They sign in to the desk with their email; no Sheet access is needed.'),
    moderators: deskModerators_() };
}

/* ---------- Content: approve all clean, hide a published activity (Content moderators) ---------- */

/** Approves the given waiting activities that are still clean (Core_activityChecks finds nothing); the rest stay for a full look. */
function deskApproveClean_(me, ids) {
  if (!me.views.content) throw deskError_('Only Content moderators can do this.');
  var want = (ids || []).map(function (x) { return Core_str(x).toLowerCase(); }).filter(String);
  if (!want.length) throw deskError_('Tick at least one activity.');
  if (want.length > DESK_CLEAN_MAX) throw deskError_('At most ' + DESK_CLEAN_MAX + ' at a time.');
  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    var done = [];
    var left = [];
    readTab_(mainSs_(), 'activities').forEach(function (r) {
      if (want.indexOf(Core_str(r.id).toLowerCase()) < 0) return;
      if (Core_str(r.status) !== 'pending') return;
      if (Core_activityChecks(r).length || approveBlock_('activities', r)) { left.push(Core_str(r.id)); return; }
      approveRow_('activities', r, me.email);
      deskLog_(me, 'approve (clean)', 'activities', r.id, '');
      done.push(Core_str(r.id));
    });
    return { approved: done, left: left, message: 'Approved ' + done.length + ' activit' + (done.length === 1 ? 'y' : 'ies') + '; the website shows them ' + NEXT_UPDATE + '.' +
      (left.length ? ' ' + left.length + ' need a full look first: ' + left.join(', ') + '.' : '') };
  } finally {
    lock.releaseLock();
  }
}

/** Takes a published activity off the website (status hidden) with a reason; Put back undoes it. The club is not emailed. */
function deskHide_(me, id, reason) {
  if (!me.views.content) throw deskError_('Only Content moderators can do this.');
  var why = deskReason_(reason);
  var r = deskFind_('activities', id);
  if (Core_str(r.status) !== 'approved') throw deskError_('Only a published activity can be hidden.');
  updateRow_(mainSs_(), 'activities', r._row, { status: 'hidden', hidden_by: me.email, hidden_at: nowIso_(),
    moderator_note: [Core_str(r.moderator_note), 'Hidden by ' + me.name + ' on ' + today_() + ': ' + why].filter(String).join('; ') });
  deskLog_(me, 'hide', 'activities', r.id, why);
  contentChanged_();
  return { message: Core_str(r.title) + ' comes off the website ' + NEXT_UPDATE + '.' };
}

function deskPutBack_(me, id) {
  if (!me.views.content) throw deskError_('Only Content moderators can do this.');
  var r = deskFind_('activities', id);
  if (Core_str(r.status) !== 'hidden') throw deskError_('This activity is not hidden.');
  updateRow_(mainSs_(), 'activities', r._row, { status: 'approved', hidden_by: '', hidden_at: '',
    moderator_note: [Core_str(r.moderator_note), 'Put back by ' + me.name + ' on ' + today_()].filter(String).join('; ') });
  deskLog_(me, 'put back', 'activities', r.id, '');
  contentChanged_();
  return { message: Core_str(r.title) + ' is back on the website ' + NEXT_UPDATE + '.' };
}

/* ---------- Lists the desk's forms choose from ---------- */

function deskLists_() {
  var year = Core_rotaryYearOf(today_());
  return {
    clubs: clubs_().filter(function (c) { return Core_str(c.status || 'active') === 'active'; })
      .map(function (c) { return { id: Core_str(c.club_id), name: Core_str(c.club_name) }; })
      .sort(function (a, b) { return a.name.localeCompare(b.name); }),
    zones: Core_list(settings_().zones),
    years: [year, Core_nextRotaryYear(year)],
    club_roles: CORE_CLUB_ROLES.slice(),
    moderator_types: CORE_MODERATOR_TYPES.slice(),
  };
}
