// Step 1 of the build: get the public website data.
//
// With DATA_URL and DATA_TOKEN set (the weekly GitHub build), the data comes from the Sheet's
// protected data link, which returns approved rows and public fields only.
// Without them (local testing), it is made from sample/sample-data.json using the same
// rules the Sheet script uses (apps-script/Core.js).
//
// Writes .cache/public-data.json

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { core, plain, sampleOptions } from '../lib/core.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = resolve(ROOT, '.cache/public-data.json');

async function fromSheet(url, token) {
  // Google occasionally answers a slow first request with an error page; try up to three times
  let lastError;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      return await fetchOnce(url, token);
    } catch (err) {
      lastError = err;
      console.warn(`Data link attempt ${attempt} failed: ${err.message}`);
      await new Promise((r) => setTimeout(r, 5000 * attempt));
    }
  }
  throw lastError;
}

async function fetchOnce(url, token) {
  const res = await fetch(`${url}?mode=data&token=${encodeURIComponent(token)}`, { redirect: 'follow' });
  if (!res.ok) throw new Error(`Data link answered ${res.status} ${res.statusText}`);
  const body = await res.json().catch(() => {
    throw new Error('Data link did not return JSON. Is the web app deployed with access "Anyone"?');
  });
  if (!body.ok) throw new Error(`Data link refused: ${body.error}`);
  return body.data;
}

function fromSample() {
  const sample = JSON.parse(readFileSync(resolve(ROOT, 'sample/sample-data.json'), 'utf8'));
  return plain(core.Core_buildPublicData(sample.main, new Date().toISOString(), sampleOptions(sample)));
}

const { DATA_URL, DATA_TOKEN } = process.env;
// --file <path>: a saved copy of the Sheet's data (e.g. data-snapshots/public-data.json), for testing locally
const fileArg = process.argv.indexOf('--file');
const file = fileArg > 0 ? process.argv[fileArg + 1] : '';
const useSheet = DATA_URL && DATA_TOKEN && !process.argv.includes('--sample');
const data = file ? JSON.parse(readFileSync(resolve(file), 'utf8')) : useSheet ? await fromSheet(DATA_URL, DATA_TOKEN) : fromSample();
data.source = useSheet || file ? 'sheet' : 'sample';

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, JSON.stringify(data, null, 1));
console.log(
  `Fetched ${data.source} data: ${data.clubs.length} clubs, ${data.activities.length} activities, ${data.events.length} events, ` +
    `${data.members.length} members, ${data.couples.length} couples, ${data.functionaries.length} team roles` +
    (data.skipped_activities?.length ? `; skipped (no photo or link): ${data.skipped_activities.join(', ')}` : '') +
    (data.skipped_items?.length ? `; left out (phone number, email or payment details): ${data.skipped_items.join(', ')}` : '') +
    (data.duplicate_ids?.length ? `; left out (ID used twice, first or real row kept): ${data.duplicate_ids.join(', ')}` : ''),
);
