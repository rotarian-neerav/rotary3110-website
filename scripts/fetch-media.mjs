// Step 3 of the build: photos and magazine files.
//
// Every approved photo is fetched (from the Sheet's protected data link, or from sample/ when testing),
// turned upright, resized to web size and saved WITHOUT its hidden metadata (phone photos often carry
// the exact location where they were taken). Member photos are kept small on purpose.
//
// Writes processed files to .cache/media/ and the list of them to .cache/media-map.json. Files no page uses (an older
// size, a removed activity, a replaced or withdrawn photo) are deleted, so only photos in use are published.

import { createHash } from 'node:crypto';
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const CACHE = resolve(ROOT, '.cache/media');
const data = JSON.parse(readFileSync(resolve(ROOT, '.cache/public-data.json'), 'utf8'));
const { DATA_URL, DATA_TOKEN } = process.env;
mkdirSync(CACHE, { recursive: true });

// What each kind of image becomes (q: quality). Keys become fields in media-map.json. Sized for phones, where most
// visitors are (owner, 25 Nov 2026: about 70% less space, so the site stays under GitHub Pages' 1 GB).
// A file's name carries a fingerprint of its size and quality, so changing them here makes the photos again.
const VARIANTS = {
  // one picture per activity photo, used everywhere; lists show it in a 3:2 frame around its most interesting part
  activity: { full: { w: 960, q: 60 } },
  // the WhatsApp and Facebook preview: only for the first photo of each activity and event
  share: { og: { w: 720, h: 378, jpg: true, q: 70 } },
  person: { sq: { w: 300, h: 300, q: 60 } },
  couple: { card: { w: 480, h: 320, q: 60 } },
  cover: { card: { w: 400, q: 72 }, og: { w: 1200, h: 630, jpg: true, contain: true, q: 72 } },
  // a business logo or shop photo: whole, on white, never cropped
  logo: { sq: { w: 300, h: 300, contain: true, q: 60 } },
};
// the 3:2 frame of an activity photo in lists (the size the old card photo had)
const FRAME = { w: 640, h: 427 };
const FOCUS = resolve(CACHE, '_focus.json');
const focus = existsSync(FOCUS) ? JSON.parse(readFileSync(FOCUS, 'utf8')) : {};

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

// Where the 3:2 frame sits on a photo, as a CSS object-position: the crop sharp's "attention" picks (as the old card did)
async function framing(file) {
  if (focus[file]) return focus[file];
  const target = resolve(CACHE, file);
  const { width, height } = await sharp(target).metadata();
  const { info } = await sharp(target).resize(FRAME.w, FRAME.h, { fit: 'cover', position: 'attention' }).toBuffer({ resolveWithObject: true });
  const scale = Math.max(FRAME.w / width, FRAME.h / height);
  const pct = (offset, size, box) => (Math.round(size * scale) - box > 1 ? Math.round((Math.abs(offset) / (Math.round(size * scale) - box)) * 100) : 50);
  focus[file] = `${pct(info.cropOffsetLeft, width, FRAME.w)}% ${pct(info.cropOffsetTop, height, FRAME.h)}%`;
  return focus[file];
}

const map = {};
let made = 0;
let failed = 0;
let thumbs = 0;

async function processImage(ref, kinds) {
  // a photo is fetched once for all it becomes (an activity's first photo is also its preview)
  const kind = kinds[0];
  const base = `${kind}-${hash(ref)}`;
  const out = {};
  const wanted = kinds.flatMap((k) => Object.entries(VARIANTS[k])).map(([name, v]) => [name, v, `${base}-${name}-${hash(JSON.stringify(v)).slice(0, 6)}.${v.jpg ? 'jpg' : 'webp'}`]);
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
        img = v.jpg ? img.flatten({ background: '#ffffff' }).jpeg({ quality: v.q, mozjpeg: true }) : img.webp({ quality: v.q });
        await img.toFile(target);
        made++;
      }
      const meta = await sharp(target).metadata();
      out[name] = { src: `/media/${file}`, width: meta.width, height: meta.height };
    }
    // lists use the same picture in a 3:2 frame (the pages read it as `card`)
    if (kind === 'activity') out.card = { ...out.full, width: FRAME.w, height: FRAME.h, pos: await framing(out.full.src.slice(7)) };
    map[ref] = out;
  } catch (err) {
    failed++;
    console.warn(`  photo skipped (${ref}): ${err.message}`);
  }
}

const jobs = [];
for (const a of data.activities) for (const p of a.photos) jobs.push([p, 'activity']);
for (const a of data.activities) if (a.before_after) jobs.push([a.before_after.before, 'activity'], [a.before_after.after, 'activity']);
for (const e of data.events) for (const p of e.photos || []) jobs.push([p, 'activity']);
for (const m of data.members) if (m.photo) jobs.push([m.photo, 'person']);
for (const r of [...data.officers, ...data.functionaries]) if (r.photo) jobs.push([r.photo, 'person']);
for (const m of data.messages) if (m.photo) jobs.push([m.photo, 'person']);
for (const p of data.profiles || []) if (p.photo) jobs.push([p.photo, 'person']);
for (const c of data.couples) if (c.couple_photo) jobs.push([c.couple_photo, 'couple']);
for (const m of data.magazines) if (m.cover) jobs.push([m.cover, 'cover']);
for (const b of data.businesses || []) if (b.logo) jobs.push([b.logo, 'logo']);

// each photo once, with all it becomes; the first photo of each activity and event also makes its preview
const kindsOf = new Map();
for (const [ref, kind] of jobs) if (ref && !kindsOf.has(ref)) kindsOf.set(ref, [kind]);
for (const x of [...data.activities, ...data.events]) if (x.photos?.length && kindsOf.get(x.photos[0])?.[0] === 'activity' && !kindsOf.get(x.photos[0]).includes('share')) kindsOf.get(x.photos[0]).push('share');
const work = [...kindsOf];

// a few at a time, so the Sheet's data link is not overloaded
for (let i = 0; i < work.length; i += 4) {
  await Promise.all(work.slice(i, i + 4).map(([ref, kinds]) => processImage(ref, kinds)));
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

// Only what the pages use stays (and is published): older sizes, removed activities, replaced or withdrawn photos go.
// Not when many photos failed (the data link having a bad moment): their earlier files are kept for the next build.
const used = new Set(['_focus.json', ...Object.values(pdfs).map((p) => p.slice(7))]);
for (const im of Object.values(map)) for (const v of Object.values(im)) used.add(v.src.slice(7));
let removed = 0;
if (failed <= Math.max(5, work.length * 0.05)) {
  for (const f of readdirSync(CACHE)) if (!used.has(f)) { rmSync(resolve(CACHE, f)); removed++; }
  for (const f of Object.keys(focus)) if (!used.has(f)) delete focus[f];
}
writeFileSync(FOCUS, JSON.stringify(focus));
const bytes = readdirSync(CACHE).reduce((s, f) => s + statSync(resolve(CACHE, f)).size, 0);

writeFileSync(resolve(ROOT, '.cache/media-map.json'), JSON.stringify({ images: map, pdfs }, null, 1));
console.log(`Media ready: ${Object.keys(map).length} images (${made} newly processed${thumbs ? `, ${thumbs} from Drive's own picture` : ''}${failed ? `, ${failed} skipped` : ''}${removed ? `, ${removed} old files removed` : ''}), ${Math.round(bytes / 1048576)} MB.`);
