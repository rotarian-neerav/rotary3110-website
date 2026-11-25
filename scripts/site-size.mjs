// The last step of the build: how big the website is. GitHub Pages publishes at most 1 GB, so the build says so from
// 900 MB on (and the Monday summary shows the size, read from build-info.json). Photos are nearly all of it.
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const SITE = resolve(dirname(fileURLToPath(import.meta.url)), '../_site');
const WARN_MB = 900;

const size = (dir) => readdirSync(dir, { withFileTypes: true })
  .reduce((s, e) => s + (e.isDirectory() ? size(join(dir, e.name)) : statSync(join(dir, e.name)).size), 0);
const mb = (b) => Math.round(b / 1048576);

const total = mb(size(SITE));
const media = mb(size(join(SITE, 'media')));
const info = join(SITE, 'build-info.json');
writeFileSync(info, JSON.stringify({ ...JSON.parse(readFileSync(info, 'utf8')), site_mb: total, media_mb: media }));
console.log(`Website size: ${total} MB (photos ${media} MB) of GitHub Pages' 1,024 MB.`);
if (total >= WARN_MB) console.log(`::warning::The website is ${total} MB; GitHub Pages publishes at most 1 GB. Time to make older years' photos smaller.`);
