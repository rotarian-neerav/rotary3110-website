// Before Eleventy writes the site: empties _site/, so pages that no longer exist (an activity removed,
// a member card whose person left the directory) and old search indexes are not left behind.
import { rmSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const SITE = resolve(dirname(fileURLToPath(import.meta.url)), '../_site');
rmSync(SITE, { recursive: true, force: true });
