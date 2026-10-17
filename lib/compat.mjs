// Public data from a Sheet still running an older script, brought up to the current shape, so the website
// keeps building until the new script is installed. Changes nothing in data that is already current.
import { core, plain } from './core.mjs';

export function upgradeOldData(data) {
  data.duplicate_ids ??= [];
  // an ID used twice keeps its first row only (the script does this since October 2026)
  for (const list of ['activities', 'events']) {
    const seen = new Set();
    data[list] = (data[list] || []).filter((row) => {
      if (!seen.has(row.id)) return seen.add(row.id);
      data.duplicate_ids.push(row.id);
      return false;
    });
  }
  // Release A: zones are never published; meeting days and "open to everyone" are worked out
  if (data.site) delete data.site.zones;
  for (const c of data.clubs || []) {
    delete c.zone;
    c.meeting_day ??= core.Core_meetingDay('', c.meeting);
  }
  for (const f of data.functionaries || []) {
    delete f.zone;
    f.clubs ??= [];
  }
  for (const e of data.events || []) e.open_to_all ??= e.event_type === 'Club event open to all';
  for (const a of data.activities || []) {
    a.avenue ??= '';
    a.press ??= null;
    a.video ??= null;
  }
  data.public_services ??= [];
  data.profiles ??= [];
  data.past_governors ??= [];
  data.lists ??= {};
  data.lists.avenues ??= plain(core.CORE_AVENUES);
  data.lists.service_types ??= plain(core.CORE_SERVICE_TYPES);
  data.forms ??= {};
  return data;
}
