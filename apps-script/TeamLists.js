/**
 * Team lists (B13, owner 23–24 Nov 2026, decision 144): a separate Google Sheet where the district prepares a coming
 * year's district team and club office bearers, so next year's team can be on the website before July. Upgrade Sheet
 * makes it next to the main Sheet; the owner shares it with the people who prepare the lists.
 * - Each tab is checked and imported on its own (Google stops a run after 6 minutes).
 * - A list goes in only when it has no errors, never in part; rows added later go in as a further list.
 * - Check: Members moderators and Administrators. Import and Withdraw this list: Administrators only.
 * - Withdraw this list takes one imported list off again, only before its year starts.
 * The Sheet holds names and Rotary IDs only, never phones or emails.
 */

var TEAM_LISTS_NAME = '3110Website – Team lists';
var TEAM_LIST_REFS = { roles: 'Roles used', clubs: 'Clubs', help: 'Instructions' };
var TEAM_LIST_HELP = [
  'Team lists: next year\'s (or a later year\'s) district team and club office bearers, for the website.',
  '',
  'Fill in one row per person and role. Names and Rotary member IDs only: never phone numbers or emails.',
  'District team: rotary_year (e.g. 2027-28), team (e.g. District Membership Team, Assistant Governors, Governor line), committee (if any), role (e.g. Chairman, Co-chairman, Assistant Governor), member_id (the Rotary member ID), name, order (optional: 1 first), ag_clubs (an Assistant Governor\'s clubs, separated by commas).',
  'Club office bearers: rotary_year, club (choose from the list), role (President, Secretary or Executive Secretary), member_id, name.',
  'Team, committee and role offer the names used before (from the Roles used tab); a new name can be typed, and the check notes it.',
  'The year: this Rotary year up to three years ahead for the district team; this year or next for club office bearers.',
  'Write "Elect" or "Nominee" nowhere: the website adds them from the year.',
  '',
  'Then a Members moderator or an Administrator opens the moderation desk → Roles → Team lists → Check. The status column says Ready, Ready with a note, or Error for each row.',
  'Correct every Error and check again. An Administrator then presses Import: the whole list goes in at once, or nothing does.',
  'Rows added later are checked and imported as a further list. The status and list columns are filled in by the script: do not type in them.',
  'A row changed after it was imported is not applied: change that person on the desk (Roles), or an Administrator withdraws that whole list (only before its year starts) and imports it again.',
];

/** The Team lists Sheet; with `create`, made (or found again) by Upgrade Sheet. */
function teamListsSs_() {
  var id = props_().getProperty('TEAM_LISTS_ID');
  if (!id) throw deskError_('The Team lists Sheet is not made yet: run Rotary → Administrator → Upgrade Sheet.');
  return retry_(function () { return SpreadsheetApp.openById(id); });
}

/** Upgrade Sheet: makes the Team lists Sheet next to the main Sheet, or brings an existing one up to date. */
function ensureTeamLists_(report) {
  var ss = null;
  var id = props_().getProperty('TEAM_LISTS_ID');
  if (id) {
    try { ss = retry_(function () { return SpreadsheetApp.openById(id); }); } catch (e) { report.push('The Team lists Sheet could not be opened (' + e.message + '), so a new one was made'); }
  }
  if (!ss) {
    ss = SpreadsheetApp.create(TEAM_LISTS_NAME);
    props_().setProperty('TEAM_LISTS_ID', ss.getId());
    keepInSheetFolder_(ss.getId(), 'the Team lists Sheet', report);
    report.push('Made the Team lists Sheet ("' + TEAM_LISTS_NAME + '"; its link is in settings → team_lists_url). Share it, as an editor, only with the people who prepare the lists.');
  }
  setSetting_('team_lists_url', ss.getUrl());
  var schema = {};
  schema[TEAM_LIST_REFS.help] = ['How to fill in the Team lists'];
  Object.keys(CORE_TEAM_LISTS).forEach(function (k) { schema[CORE_TEAM_LISTS[k].tab] = CORE_TEAM_LISTS[k].input.concat(['status', 'list']); });
  schema[TEAM_LIST_REFS.roles] = ['team', 'committee', 'role'];
  schema[TEAM_LIST_REFS.clubs] = ['club', 'club_id'];
  ensureTabs_(ss, schema, report);
  replaceRows_(ss, TEAM_LIST_REFS.help, TEAM_LIST_HELP.map(function (l) { return { 'How to fill in the Team lists': l }; }));
  [TEAM_LIST_REFS.help, TEAM_LIST_REFS.roles, TEAM_LIST_REFS.clubs].forEach(function (n) {
    var sh = ss.getSheetByName(n);
    if (!sh.getProtections(SpreadsheetApp.ProtectionType.SHEET).length) sh.protect().setDescription('Filled in by the script – do not edit by hand').setWarningOnly(true);
  });
  refreshTeamListRefs_(ss);
}

/** The Roles used and Clubs tabs, and the drop-downs that read them: a new name warns but is kept; a club must be a real one. */
function refreshTeamListRefs_(ss) {
  var uniq = function (list) {
    return list.map(Core_str).map(function (v) { return v.trim(); }).filter(function (v, i, a) { return v && a.indexOf(v) === i; }).sort(function (a, b) { return a.localeCompare(b); });
  };
  var team = readTab_(mainSs_(), 'functionaries');
  var cols = { team: uniq(team.map(function (f) { return f.section; })), committee: uniq(team.map(function (f) { return f.committee; })),
    role: uniq(team.map(function (f) { return Core_baseRole(f.role); }).concat(CORE_CLUB_ROLES)) };
  var n = Math.max(cols.team.length, cols.committee.length, cols.role.length);
  var rows = [];
  for (var i = 0; i < n; i++) rows.push({ team: cols.team[i] || '', committee: cols.committee[i] || '', role: cols.role[i] || '' });
  replaceRows_(ss, TEAM_LIST_REFS.roles, rows);
  var clubs = clubs_().filter(function (c) { return Core_str(c.status || 'active').toLowerCase() === 'active'; })
    .sort(function (a, b) { return Core_str(a.club_name).localeCompare(Core_str(b.club_name)); });
  replaceRows_(ss, TEAM_LIST_REFS.clubs, clubs.map(function (c) { return { club: Core_str(c.club_name), club_id: Core_str(c.club_id) }; }));

  var ref = function (tab, col, allowInvalid) {
    return SpreadsheetApp.newDataValidation().requireValueInRange(ss.getSheetByName(tab).getRange(2, col, 999, 1), true).setAllowInvalid(allowInvalid).build();
  };
  var put = function (tab, col, rule) {
    var idx = headers_(ss, tab).indexOf(col);
    var sh = ss.getSheetByName(tab);
    if (idx >= 0) sh.getRange(2, idx + 1, sh.getMaxRows() - 1, 1).setDataValidation(rule);
  };
  var district = CORE_TEAM_LISTS.district.tab;
  put(district, 'team', ref(TEAM_LIST_REFS.roles, 1, true));
  put(district, 'committee', ref(TEAM_LIST_REFS.roles, 2, true));
  put(district, 'role', ref(TEAM_LIST_REFS.roles, 3, true));
  put(CORE_TEAM_LISTS.club.tab, 'club', ref(TEAM_LIST_REFS.clubs, 1, false));
  put(CORE_TEAM_LISTS.club.tab, 'role', SpreadsheetApp.newDataValidation().requireValueInList(CORE_CLUB_ROLES, true).setAllowInvalid(true).build());
}

/** Checks one list against the members list, the clubs and what is already on record. */
function teamListCheck_(kind) {
  var spec = CORE_TEAM_LISTS[kind];
  if (!spec) throw deskError_('Unknown list.');
  var ss = teamListsSs_();
  var main = mainSs_();
  var ctx = { year: Core_rotaryYearOf(today_()), master: readTab_(privateSs_(), 'members_master'), clubs: clubs_(),
    functionaries: readTab_(main, 'functionaries'), officers: readTab_(main, 'officers') };
  return { ss: ss, spec: spec, result: Core_teamListCheck(kind, readTab_(ss, spec.tab), ctx), year: ctx.year };
}

/** Writes the status and list columns of a list in one go (a long list stays well inside the 6-minute limit). */
function writeTeamStatuses_(ss, tab, rows) {
  var sh = ss.getSheetByName(tab);
  var headers = headers_(ss, tab);
  var s = headers.indexOf('status');
  var l = headers.indexOf('list');
  var last = sh.getLastRow();
  if (last < 2 || s < 0 || l < 0) return;
  var statuses = sh.getRange(2, s + 1, last - 1, 1).getValues();
  var lists = sh.getRange(2, l + 1, last - 1, 1).getValues();
  rows.forEach(function (r) {
    statuses[r._row - 2][0] = r.status;
    lists[r._row - 2][0] = r.list;
  });
  retry_(function () { sh.getRange(2, s + 1, last - 1, 1).setValues(statuses); });
  retry_(function () { sh.getRange(2, l + 1, last - 1, 1).setValues(lists); });
}

/** Imported lists by list id, from the officers and functionaries tabs. */
function teamListsImported_() {
  var main = mainSs_();
  var out = {};
  Object.keys(CORE_TEAM_LISTS).forEach(function (kind) {
    var spec = CORE_TEAM_LISTS[kind];
    readTab_(main, spec.target).forEach(function (r) {
      var id = Core_str(r.list_id);
      if (!id) return;
      var x = out[id] = out[id] || { id: id, kind: kind, tab: spec.tab, rows: 0, years: [] };
      x.rows++;
      if (x.years.indexOf(Core_str(r.rotary_year)) < 0) x.years.push(Core_str(r.rotary_year));
    });
  });
  var year = Core_rotaryYearOf(today_());
  return Object.keys(out).map(function (k) {
    var x = out[k];
    x.years.sort();
    x.withdrawable = x.years.every(function (y) { return y > year; }); // only before its year starts
    return x;
  }).sort(function (a, b) { return a.id.localeCompare(b.id); });
}

/* ---------- The desk (Roles → Team lists) ---------- */

/** What the desk shows: each list's counts, whether it was checked as it stands, and the lists imported so far. */
function deskTeamLists_(me) {
  if (!me.views.members) throw deskError_('Only Members moderators and Administrators can do this.');
  if (!props_().getProperty('TEAM_LISTS_ID')) return { made: false };
  var url = Core_str(settings_().team_lists_url);
  var lists = Object.keys(CORE_TEAM_LISTS).map(function (kind) {
    var c = teamListCheck_(kind);
    return { kind: kind, tab: c.spec.tab, counts: c.result.counts,
      checked: Core_str(props_().getProperty('TEAMLIST_CHECKED_' + kind)) === c.result.fingerprint };
  });
  return { made: true, url: /^https:\/\/docs\.google\.com\//.test(url) ? url : '', lists: lists, imported: teamListsImported_(), canImport: !!me.views.admin };
}

/** Check: fills the status column and remembers the list as checked. */
function deskTeamCheck_(me, kind) {
  if (!me.views.members) throw deskError_('Only Members moderators and Administrators can do this.');
  var c = teamListCheck_(kind);
  try { refreshTeamListRefs_(c.ss); } catch (e) { Logger.log('Team lists: reference tabs not refreshed: ' + e.message); }
  writeTeamStatuses_(c.ss, c.spec.tab, c.result.rows);
  props_().setProperty('TEAMLIST_CHECKED_' + kind, c.result.fingerprint);
  var n = c.result.counts;
  return { message: c.spec.tab + ': ' + n.ready + ' ready' + (n.notes ? ' (' + n.notes + ' with a note)' : '') + ', ' + n.errors + ' with an error' +
    (n.imported ? ', ' + n.imported + ' imported before' : '') + (n.changed ? ', ' + n.changed + ' changed after import (not applied)' : '') + '.' +
    (n.errors ? ' Correct the errors in the Sheet and check again.' : n.ready ? ' An Administrator can now import it.' : '') };
}

/**
 * Import: only an Administrator; only a list checked as it stands now (checked again here, so nothing changed in
 * between) and with no errors; all of it or nothing. One import at a time.
 */
function deskTeamImport_(me, kind) {
  if (!me.views.admin) throw deskError_('Only Administrators can import a list.');
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(5000)) throw deskError_('Another import is running: try again in a minute.');
  try {
    var c = teamListCheck_(kind);
    var res = c.result;
    if (Core_str(props_().getProperty('TEAMLIST_CHECKED_' + kind)) !== res.fingerprint) {
      throw deskError_('The list has changed since it was checked: press Check again first. Nothing was imported.');
    }
    if (res.counts.errors) throw deskError_('The list has ' + res.counts.errors + ' row(s) with an error: correct them and check again. Nothing was imported.');
    var take = res.rows.filter(function (r) { return (r.state === 'ready' || r.state === 'note') && !r.skip; });
    var skipped = res.rows.filter(function (r) { return (r.state === 'ready' || r.state === 'note') && r.skip; });
    if (!take.length && !skipped.length) throw deskError_('Nothing new to import in ' + c.spec.tab + '.');
    var seqKey = 'TEAMLIST_SEQ_' + kind;
    var listId = c.spec.prefix + (Number(props_().getProperty(seqKey) || 0) + 1);
    props_().setProperty(seqKey, listId.slice(1));
    var main = mainSs_();
    appendRows_(main, c.spec.target, take.map(function (r) { return Object.assign({}, r.write, { list_id: listId }); }));
    var who = deskName_(me.email) || me.email;
    var when = Core_dateLabel(today_());
    var rowsByRow = {};
    readTab_(c.ss, c.spec.tab).forEach(function (r) { rowsByRow[r._row] = Core_teamRowKey(kind, r); });
    take.forEach(function (r) { r.status = 'Imported ' + when + ' by ' + who + ' (list ' + listId + ')'; r.list = listId + ' ' + rowsByRow[r._row]; });
    skipped.forEach(function (r) { r.status = 'Already on record: not imported again (list ' + listId + ')'; r.list = listId + ' ' + rowsByRow[r._row]; });
    writeTeamStatuses_(c.ss, c.spec.tab, take.concat(skipped));
    props_().deleteProperty('TEAMLIST_CHECKED_' + kind);
    deskLog_(me, 'imported list', c.spec.target, listId, take.length + ' row(s) from ' + c.spec.tab);
    contentChanged_();
    try { checkRoles(true); } catch (e) { Logger.log('Role check not run: ' + e.message); }
    return { message: 'Imported list ' + listId + ': ' + take.length + ' row(s)' + (skipped.length ? '; ' + skipped.length + ' already on record' : '') +
      '. The website shows them ' + NEXT_UPDATE + '.' };
  } finally {
    lock.releaseLock();
  }
}

/** Withdraw this list: takes every row of one imported list off again, only before its year starts. */
function deskTeamWithdraw_(me, listId) {
  if (!me.views.admin) throw deskError_('Only Administrators can withdraw a list.');
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(5000)) throw deskError_('Another import is running: try again in a minute.');
  try {
    var list = teamListsImported_().filter(function (x) { return x.id === Core_str(listId); })[0];
    if (!list) throw deskError_('No imported list ' + Core_str(listId) + '.');
    if (!list.withdrawable) throw deskError_('The year of list ' + list.id + ' has started: change people one by one on the desk (Roles) instead.');
    var spec = CORE_TEAM_LISTS[list.kind];
    var main = mainSs_();
    var sh = main.getSheetByName(spec.target);
    var rows = readTab_(main, spec.target).filter(function (r) { return Core_str(r.list_id) === list.id; }).map(function (r) { return r._row; });
    // from the bottom up, so the row numbers above stay right; neighbouring rows go in one call
    rows.sort(function (a, b) { return b - a; });
    for (var i = 0; i < rows.length;) {
      var j = i;
      while (j + 1 < rows.length && rows[j + 1] === rows[j] - 1) j++;
      sh.deleteRows(rows[j], i === j ? 1 : rows[i] - rows[j] + 1);
      i = j + 1;
    }
    var ss = teamListsSs_();
    var who = deskName_(me.email) || me.email;
    var back = readTab_(ss, spec.tab).filter(function (r) { return Core_str(r.list).indexOf(list.id + ' ') === 0; }).map(function (r) {
      return { _row: r._row, status: 'Withdrawn ' + Core_dateLabel(today_()) + ' by ' + who + ' (list ' + list.id + '): check and import again, or delete the row', list: '' };
    });
    writeTeamStatuses_(ss, spec.tab, back);
    deskLog_(me, 'withdrew list', spec.target, list.id, rows.length + ' row(s)');
    contentChanged_();
    try { checkRoles(true); } catch (e) { Logger.log('Role check not run: ' + e.message); }
    return { message: 'Withdrew list ' + list.id + ': ' + rows.length + ' row(s) taken off. The website follows ' + NEXT_UPDATE + '.' };
  } finally {
    lock.releaseLock();
  }
}
