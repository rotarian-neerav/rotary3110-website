// QR codes (as SVG) for the short form links, for printing at district meetings.
import QRCode from 'qrcode';
import shortLinks from './shortLinks.js';

export default async function () {
  const base = (process.env.SITE_URL || 'http://localhost:8080').replace(/\/$/, '') + (process.env.PATH_PREFIX || '/').replace(/\/$/, '');
  return Promise.all(
    shortLinks.map(async (l) => ({
      ...l,
      url: `${base}/${l.slug}/`,
      svg: await QRCode.toString(`${base}/${l.slug}/`, { type: 'svg', margin: 1, color: { dark: '#17458F', light: '#ffffff' } }),
    })),
  );
}
