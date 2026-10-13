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
  };
}
