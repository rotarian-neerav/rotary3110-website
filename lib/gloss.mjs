// Explains Rotary abbreviations (DG, PDG, TRF…) where they first appear on a page: the first use of each
// inside <main> becomes <abbr class="gloss" title="District Governor" tabindex="0">DG</abbr>. Tap, focus or
// hover shows the meaning (site.js). Text inside tags, scripts, form controls, code, existing <abbr> and any
// element marked data-nogloss is left alone.

const VOID = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'source', 'track', 'wbr']);
const SKIP = new Set(['script', 'style', 'abbr', 'textarea', 'select', 'option', 'button', 'code', 'pre', 'svg', 'title', 'iframe']);
const escapeAttr = (s) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');

export function glossHtml(html, terms) {
  const start = html.indexOf('<main');
  const end = html.lastIndexOf('</main>');
  if (start < 0 || end < start || !terms.length) return html;
  const byTerm = Object.fromEntries(terms.map((t) => [t.term, t.full]));
  // longest first, so "PDG" is not read as "DG"; whole words only, exact case
  const re = new RegExp(`(?<![\\w&#;-])(${terms.map((t) => t.term).sort((a, b) => b.length - a.length).join('|')})(?![\\w-])`, 'g');
  const done = new Set();
  const stack = []; // open elements: { name, skip }
  let skipDepth = 0;
  const parts = html.slice(start, end).split(/(<[^>]*>)/);
  const out = parts.map((part) => {
    if (part.startsWith('<')) {
      const m = part.match(/^<(\/?)([a-zA-Z][\w-]*)/);
      if (!m) return part; // comments
      const name = m[2].toLowerCase();
      if (m[1]) {
        let i = stack.length - 1;
        while (i >= 0 && stack[i].name !== name) i--;
        if (i >= 0) {
          for (let k = stack.length - 1; k >= i; k--) if (stack[k].skip) skipDepth--;
          stack.length = i;
        }
      } else if (!VOID.has(name) && !part.endsWith('/>')) {
        const skip = SKIP.has(name) || /\sdata-nogloss\b/.test(part);
        stack.push({ name, skip });
        if (skip) skipDepth++;
      }
      return part;
    }
    if (skipDepth > 0 || !part.trim()) return part;
    return part.replace(re, (word) => {
      if (done.has(word)) return word;
      done.add(word);
      return `<abbr class="gloss" title="${escapeAttr(byTerm[word])}" tabindex="0">${word}</abbr>`;
    });
  });
  return html.slice(0, start) + out.join('') + html.slice(end);
}
