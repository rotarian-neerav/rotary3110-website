// Joins the Sheet script files into one Code.gs to paste into Extensions → Apps Script,
// and copies Sidebar.html and appsscript.json next to it. Output: dist/apps-script/
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = resolve(ROOT, 'apps-script');
const OUT = resolve(ROOT, 'dist/apps-script');
export const ORDER = ['Config.js', 'Schema.js', 'Core.js', 'Setup.js', 'Forms.js', 'Submissions.js', 'Moderation.js', 'Members.js', 'Endpoint.js', 'Jobs.js', 'Sample.js'];

mkdirSync(OUT, { recursive: true });
const parts = ORDER.map((f) => `// ===== ${f} =====\n` + readFileSync(resolve(SRC, f), 'utf8'));
const header = `// Rotary District 3110 – Sheet script. Generated from apps-script/*.js by tools/bundle-apps-script.mjs.\n// Paste this whole file into Code.gs. Do not edit here; edit the source files instead.\n\n`;
writeFileSync(resolve(OUT, 'Code.gs'), header + parts.join('\n\n'));
copyFileSync(resolve(SRC, 'Sidebar.html'), resolve(OUT, 'Sidebar.html'));
copyFileSync(resolve(SRC, 'appsscript.json'), resolve(OUT, 'appsscript.json'));
console.log(`Wrote dist/apps-script/Code.gs (${Math.round(parts.join('').length / 1024)} KB), Sidebar.html, appsscript.json`);
