// Loads the plain-JavaScript files shared with the Google Sheet script into Node.js:
// apps-script/Core.js (what may become public) and apps-script/Schema.js (tab layouts).
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
