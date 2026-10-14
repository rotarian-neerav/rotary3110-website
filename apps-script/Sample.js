/**
 * Sample (dummy) data. Every sample row has is_sample = TRUE.
 * "Clear all sample data" is the single clean-up command before real data is loaded.
 */

function loadSampleData(silent) {
  var res = UrlFetchApp.fetch(CONFIG.SAMPLE_URL, { muteHttpExceptions: true });
  if (res.getResponseCode() !== 200) throw new Error('Could not download the sample data (' + res.getResponseCode() + ') from ' + CONFIG.SAMPLE_URL);
  var sample = JSON.parse(res.getContentText());
  var main = mainSs_();
  var ps = privateSs_();
  var counts = [];
  loadTabs_(main, sample.main, counts);
  loadTabs_(ps, sample.private, counts);
  refreshPublicMembers(true);
  refreshDashboard();
  if (silent !== true) {
    try { SpreadsheetApp.getUi().alert('Sample data loaded:\n' + counts.join('\n')); } catch (e) { /* editor */ }
  }
  return counts;
}

var SAMPLE_ID_KEYS = {
  clubs: 'club_id', activities: 'id', events: 'id', club_profile_requests: 'id', campaigns: 'campaign_id',
  messages: 'id', members_master: 'member_id', couples: 'couple_id', consent_requests: 'id', removal_requests: 'id',
};

function loadTabs_(ss, tabs, counts) {
  Object.keys(tabs).forEach(function (name) {
    var rows = tabs[name];
    var sh = ss.getSheetByName(name);
    if (!sh || !rows.length) return;
    if (name === 'settings') {
      // only fill settings that are still empty; never overwrite form links or real values
      var current = Core_settings(readTab_(ss, 'settings'));
      rows.forEach(function (r) { if (!Core_str(current[r.key]) && Core_str(r.value)) setSetting_(r.key, r.value); });
      return;
    }
    if (name === 'members_public' || name === 'couples_public') return; // rebuilt by refreshPublicMembers
    if (name === 'lists' && readTab_(ss, 'lists').length) return; // keep lists that are already there
    var headers = headers_(ss, name);
    // a sample row whose ID a real row already has is not loaded (the real row keeps its ID)
    var key = SAMPLE_ID_KEYS[name];
    if (key) {
      var taken = {};
      readTab_(ss, name).forEach(function (r) { if (Core_str(r[key])) taken[Core_str(r[key])] = true; });
      var before = rows.length;
      rows = rows.filter(function (r) { return !taken[Core_str(r[key])]; });
      if (rows.length < before) counts.push(name + ': ' + (before - rows.length) + ' sample row(s) not loaded because the ID is already used');
      if (!rows.length) return;
    }
    var values = rows.map(function (r) {
      return headers.map(function (h) {
        var v = r[h];
        if (v === true) return true;
        if (v === false) return false;
        return v == null ? '' : v;
      });
    });
    sh.getRange(sh.getLastRow() + 1, 1, values.length, headers.length).setValues(values);
    counts.push(name + ': ' + values.length);
  });
}

function clearSampleData() {
  var ui = SpreadsheetApp.getUi();
  if (ui.alert('Clear all sample data?', 'Every row marked is_sample = TRUE will be deleted from both spreadsheets. Real rows are kept.', ui.ButtonSet.YES_NO) !== ui.Button.YES) return;
  var removed = [];
  [mainSs_(), privateSs_()].forEach(function (ss) {
    ss.getSheets().forEach(function (sh) {
      if (sh.getLastRow() < 2) return;
      var values = sh.getDataRange().getValues();
      var col = values[0].indexOf('is_sample');
      if (col < 0) return;
      var keep = [values[0]];
      var gone = 0;
      for (var r = 1; r < values.length; r++) {
        if (Core_isTrue(values[r][col])) gone++; else keep.push(values[r]);
      }
      if (!gone) return;
      sh.getRange(1, 1, values.length, values[0].length).clearContent();
      sh.getRange(1, 1, keep.length, keep[0].length).setValues(keep);
      removed.push(sh.getName() + ': ' + gone);
    });
  });
  // settings that only made sense for the sample
  setSetting_('inactive_keys', '');
  refreshPublicMembers(true);
  refreshDashboard();
  requestRebuild();
  ui.alert('Sample data cleared.\n' + (removed.join('\n') || 'Nothing to clear.'));
}
