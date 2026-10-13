// All page data, built from .cache/public-data.json (made by `npm run fetch`).
import { readFileSync } from 'node:fs';
import { derive } from '../../lib/derive.mjs';

export default function () {
  const data = JSON.parse(readFileSync('.cache/public-data.json', 'utf8'));
  const media = JSON.parse(readFileSync('.cache/media-map.json', 'utf8'));
  return derive(data, media, process.env.SITE_TODAY);
}
