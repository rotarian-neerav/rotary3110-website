// Loads the plain-JavaScript files shared with the Google Sheet script into Node.js:
// apps-script/Core.js (what may become public) and apps-script/Schema.js (tab layouts).
import { createHmac } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const dir = resolve(dirname(fileURLToPath(import.meta.url)), '../apps-script');

function load(name) {
  const file = resolve(dir, name);
  const sandbox = { module: { exports: {} } };
  vm.createContext(sandbox);
  vm.runInContext(readFileSync(file, 'utf8'), sandbox, { filename: file });
  return sandbox.module.exports;
}

export const core = load('Core.js');
export const { SCHEMA_MAIN, SCHEMA_PRIVATE } = load('Schema.js');

/** Results from the shared code come from another JavaScript realm; this makes them plain objects. */
export const plain = (value) => JSON.parse(JSON.stringify(value));

/**
 * Options for Core_buildPublicData when building from the sample file: the same keyed person
 * reference as the Sheet (with a fixed sample secret), and the sample's deceased and departed members.
 */
export function sampleOptions(sample) {
  return {
    personRef: (id) => 'P' + createHmac('sha256', 'sample-secret').update(String(id)).digest('hex').slice(0, 12),
    inactiveIds: (sample.private?.members_master || []).filter((m) => m.member_id && (m.status || 'active') !== 'active').map((m) => m.member_id),
    master: sample.private?.members_master || [],
  };
}

/**
 * The sample's role years move on with the calendar, so it keeps the same shape (a two-year-old team list, this
 * year's and next year's office bearers, the coming Governors) in any year, and tests do not age each July.
 * Changes the sample in place and returns it.
 */
export function shiftSampleYears(sample, today) {
  const by = core.Core_yearsAhead(core.Core_rotaryYearOf(today), core.Core_rotaryYearOf(sample.generated_for));
  if (!by) return sample;
  const move = (y) => (/^\d{4}-\d{2}$/.test(y || '') ? `${+y.slice(0, 4) + by}-${String(+y.slice(0, 4) + by + 1).slice(2)}` : y);
  const tabs = sample.main;
  for (const r of tabs.officers || []) r.rotary_year = move(r.rotary_year);
  for (const r of tabs.functionaries || []) { r.rotary_year = move(r.rotary_year); r.term = move(r.term); }
  for (const r of tabs.past_governors || []) r.rotary_year = move(r.rotary_year);
  for (const r of tabs.profiles || []) r.rotary_year = move(r.rotary_year);
  return sample;
}
