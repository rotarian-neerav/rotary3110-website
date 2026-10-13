// Step 2 of the build: the privacy safety check. The build stops here if the public data contains
// a birth or marriage year, a member who has not opted in, a contact link or photo without consent,
// an anniversary without both spouses' consent, a greeting for someone marked deceased, or any
// phone number or email address.
//
// Usage: node scripts/validate-public.mjs [path-to-public-data.json]

import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { core } from '../lib/core.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const file = process.argv[2] ? resolve(process.argv[2]) : resolve(ROOT, '.cache/public-data.json');
const data = JSON.parse(readFileSync(file, 'utf8'));
const errors = [...core.Core_validatePublic(data)];

if (errors.length) {
  console.error(`PRIVACY CHECK FAILED – the website was not built. ${errors.length} problem(s):`);
  errors.slice(0, 50).forEach((e) => console.error('  - ' + e));
  process.exit(1);
}
console.log('Privacy check passed.');
