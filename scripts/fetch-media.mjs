// Step 3 of the build: photos and magazine files.
//
// Every approved photo is fetched (from the Sheet's protected data link, or from sample/ when testing),
// turned upright, resized to web size and saved WITHOUT its hidden metadata (phone photos often carry
// the exact location where they were taken). Member photos are kept small on purpose.
//
// Writes processed files to .cache/media/ and the list of them to .cache/media-map.json

import { createHash } from 'node:crypto';
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const CACHE = resolve(ROOT, '.cache/media');
const data = JSON.parse(readFileSync(resolve(ROOT, '.cache/public-data.json'), 'utf8'));
const { DATA_URL, DATA_TOKEN } = process.env;
mkdirSync(CACHE, { recursive: true });

// What each kind of image becomes. Keys become fields in media-map.json.
const VARIANTS = {
  activity: { card: { w: 640, h: 427 }, full: { w: 1200 }, og: { w: 1200, h: 630, jpg: true } },
  person: { sq: { w: 300, h: 300 } },
  couple: { card: { w: 600, h: 400 } },
  cover: { card: { w: 400 }, og: { w: 1200, h: 630, jpg: true, contain: true } },
};

const hash = (s) => createHash('sha1').update(s).digest('hex').slice(0, 12);

async function sourceBytes(ref) {
  if (ref.startsWith('sample:')) {
    const name = ref.slice(7);
    const file = [resolve(ROOT, 'sample/media', name), resolve(ROOT, 'sample/magazines', name)].find(existsSync);
    if (!file) throw new Error(`Sample file not found: ${name}`);
    return readFileSync(file);
  }
  if (ref.startsWith('drive:') || ref.startsWith('thumb:')) {
    // thumb: is the first-page picture Google Drive makes of a magazine PDF, used when no cover image was uploaded
    if (!DATA_URL || !DATA_TOKEN) throw new Error(`Cannot fetch ${ref} without DATA_URL and DATA_TOKEN`);
    const mode = ref.startsWith('thumb:') ? 'thumb' : 'file';
    const url = `${DATA_URL}?mode=${mode}&id=${encodeURIComponent(ref.slice(6))}&token=${encodeURIComponent(DATA_TOKEN)}`;
    for (let attempt = 1; ; attempt++) {
      try {
        const body = await (await fetch(url, { redirect: 'follow' })).json();
        if (!body.ok) throw new Error(`Data link refused file ${ref}: ${body.error}`);
        return Buffer.from(body.base64, 'base64');
      } catch (err) {
        if (attempt >= 3 || /refused/.test(err.message)) throw err;
        await new Promise((r) => setTimeout(r, 3000 * attempt));
      }
    }
  }
  throw new Error(`Unknown photo reference: ${ref}`);
}

const map = {};
let made = 0;
let failed = 0;
let thumbs = 0;

async function processImage(ref, kind) {
  if (!ref || map[ref]) return;
  const variants = VARIANTS[kind];
  const base = `${kind}-${hash(ref)}`;
  const out = {};
  const wanted = Object.entries(variants).map(([name, v]) => [name, v, `${base}-${name}.${v.jpg ? 'jpg' : 'webp'}`]);
  const allCached = wanted.every(([, , file]) => existsSync(resolve(CACHE, file)));
  try {
    let bytes = allCached ? null : await sourceBytes(ref);
    if (bytes && ref.startsWith('drive:')) {
      // HEIC, BMP and broken uploads: use the picture Google Drive itself makes of the file instead
      try {
        await sharp(bytes, { failOn: 'none' }).resize(8).toBuffer(); // a real decode: reading the header alone passes for HEIC
      } catch {
        bytes = await sourceBytes('thumb:' + ref.slice(6));
        thumbs++;
      }
    }
    for (const [name, v, file] of wanted) {
      const target = resolve(CACHE, file);
      if (!existsSync(target)) {
        // .rotate() applies the phone's orientation; sharp drops EXIF/GPS metadata unless asked to keep it.
        // failOn 'none': phone JPEGs with small encoding faults still decode instead of being skipped
        let img = sharp(bytes, { failOn: 'none' }).rotate();
        img = v.h
          ? img.resize(v.w, v.h, v.contain ? { fit: 'contain', background: '#ffffff' } : { fit: 'cover', position: 'attention' })
          : img.resize({ width: v.w, withoutEnlargement: true });
        img = v.jpg ? img.flatten({ background: '#ffffff' }).jpeg({ quality: 72, mozjpeg: true }) : img.webp({ quality: kind === 'person' ? 70 : 72 });
        await img.toFile(target);
        made++;
      }
      const meta = await sharp(target).metadata();
      out[name] = { src: `/media/${file}`, width: meta.width, height: meta.height };
    }
    map[ref] = out;
  } catch (err) {
    failed++;
    console.warn(`  photo skipped (${ref}): ${err.message}`);
  }
}

const jobs = [];
for (const a of data.activities) for (const p of a.photos) jobs.push([p, 'activity']);
for (const e of data.events) for (const p of e.photos || []) jobs.push([p, 'activity']);
for (const m of data.members) if (m.photo) jobs.push([m.photo, 'person']);
for (const r of [...data.officers, ...data.functionaries]) if (r.photo) jobs.push([r.photo, 'person']);
for (const m of data.messages) if (m.photo) jobs.push([m.photo, 'person']);
for (const p of data.profiles || []) if (p.photo) jobs.push([p.photo, 'person']);
for (const c of data.couples) if (c.couple_photo) jobs.push([c.couple_photo, 'couple']);
for (const m of data.magazines) if (m.cover) jobs.push([m.cover, 'cover']);

// a few at a time, so the Sheet's data link is not overloaded
for (let i = 0; i < jobs.length; i += 4) {
  await Promise.all(jobs.slice(i, i + 4).map(([ref, kind]) => processImage(ref, kind)));
}

// Sample magazine PDFs are served from the site; real issues open from Google Drive
const pdfs = {};
for (const m of data.magazines) {
  if (m.file?.startsWith('sample:')) {
    const name = m.file.slice(7);
    copyFileSync(resolve(ROOT, 'sample/magazines', name), resolve(CACHE, name));
    pdfs[m.file] = `/media/${name}`;
  }
}

writeFileSync(resolve(ROOT, '.cache/media-map.json'), JSON.stringify({ images: map, pdfs }, null, 1));
console.log(`Media ready: ${Object.keys(map).length} images (${made} newly processed${thumbs ? `, ${thumbs} from Drive's own picture` : ''}${failed ? `, ${failed} skipped` : ''}).`);
