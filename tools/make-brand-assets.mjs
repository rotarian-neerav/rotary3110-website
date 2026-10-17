// Makes the header logo, favicons and the default WhatsApp/Facebook preview card
// from the district logo file. Run once, or again if the logo changes.
// Usage: node tools/make-brand-assets.mjs [path-to-logo.png]

import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const LOGO = process.argv[2] || resolve(ROOT, '..', '2Claude', 'Rotary Logo_EN21_DynamicSize_FontUpdate.png');
const OUT = resolve(ROOT, 'src/assets/img');
mkdirSync(OUT, { recursive: true });

const logo = sharp(LOGO).trim(); // remove the empty margin around the artwork
const trimmed = await logo.png().toBuffer({ resolveWithObject: true });
const { width, height } = trimmed.info;

// Header logo at 2x for sharp phone screens (shown 48px tall)
await sharp(trimmed.data).resize({ height: 96 }).png({ compressionLevel: 9, palette: true }).toFile(resolve(OUT, 'logo.png'));
await sharp(trimmed.data).resize({ height: 96 }).webp({ quality: 90 }).toFile(resolve(OUT, 'logo.webp'));
const headerMeta = await sharp(resolve(OUT, 'logo.png')).metadata();

// The wheel is the right-hand square of the artwork
const wheel = await sharp(trimmed.data).extract({ left: width - height, top: 0, width: height, height }).png().toBuffer();
await sharp(wheel).resize(32, 32).png().toFile(resolve(OUT, 'favicon-32.png'));
await sharp(wheel).resize(180, 180, { fit: 'contain', background: '#ffffff' }).flatten({ background: '#ffffff' }).png().toFile(resolve(OUT, 'apple-touch-icon.png'));
// App icons for "Add to home screen"; the maskable one keeps the wheel inside the safe circle phones crop to
for (const size of [192, 512]) {
  await sharp(wheel).resize(size, size, { fit: 'contain', background: '#ffffff' }).flatten({ background: '#ffffff' }).png({ compressionLevel: 9 }).toFile(resolve(OUT, `icon-${size}.png`));
}
const inner = await sharp(wheel).resize(336, 336, { fit: 'contain', background: '#ffffff' }).flatten({ background: '#ffffff' }).png().toBuffer();
await sharp({ create: { width: 512, height: 512, channels: 3, background: '#ffffff' } }).composite([{ input: inner, left: 88, top: 88 }])
  .png({ compressionLevel: 9 }).toFile(resolve(OUT, 'icon-maskable-512.png'));

// Default preview card: white with the logo, a gold rule and the district's line
const cardLogo = await sharp(trimmed.data).resize({ width: 760 }).png().toBuffer();
const cardLogoMeta = await sharp(cardLogo).metadata();
const band = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630">
  <rect y="560" width="1200" height="70" fill="#17458F"/><rect y="552" width="1200" height="8" fill="#F7A81B"/>
  <text x="600" y="606" font-family="Arial, sans-serif" font-size="30" fill="#fff" text-anchor="middle">What our clubs achieve</text></svg>`);
await sharp({ create: { width: 1200, height: 630, channels: 3, background: '#ffffff' } })
  .composite([
    { input: cardLogo, left: Math.round((1200 - cardLogoMeta.width) / 2), top: Math.round((552 - cardLogoMeta.height) / 2) },
    { input: band, left: 0, top: 0 },
  ])
  .jpeg({ quality: 82, mozjpeg: true })
  .toFile(resolve(OUT, 'og-default.jpg'));

console.log(`Brand assets written to src/assets/img (header logo ${headerMeta.width}x${headerMeta.height}).`);
