// Member spotlight, one a day (owner, 26 Nov 2026). The website lists the members in a fixed order; this works out
// today's turn from the date in India time, in the visitor's browser, so it changes at midnight even on days the
// website is not rebuilt. The page already shows the turn for the day it was built, for browsers without scripts.
(function () {
  var today = document.querySelectorAll('[data-spotlight-today]');
  var recent = document.querySelector('[data-spotlight-recent]');
  if (!today.length && !recent) return;

  function day(start) {
    var now = new Date(Date.now() + 5.5 * 3600 * 1000); // India (UTC+5:30)
    var t = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
    return Math.round((t - Date.parse(start + 'T00:00:00Z')) / 86400000);
  }

  function person(p, full) {
    var text = String(p.text || '');
    if (!full && text.length > 180) text = text.slice(0, 170).replace(/\s+\S*$/, '') + '…';
    return '<div class="spotlight-person">' + avatarHtml(p.name, p.photo, full ? 72 : 80) + '<div>' +
      '<h3>' + (p.u ? '<a href="' + escapeHtml(siteUrl(p.u)) + '">' + escapeHtml(p.name) + '</a>' : escapeHtml(p.name)) + '</h3>' +
      '<p class="small">' + escapeHtml([p.profession, p.area].filter(Boolean).join(' · ')) + (p.profession || p.area ? ' · ' : '') +
      (p.clubUrl ? '<a href="' + escapeHtml(siteUrl(p.clubUrl)) + '">' + escapeHtml(p.club) + '</a>' : escapeHtml(p.club)) + '</p>' +
      (text ? '<p>' + escapeHtml(text) + '</p>' : '') +
      (full && p.website ? '<p><a href="' + escapeHtml(p.website) + '" target="_blank" rel="noopener">Website ↗</a></p>' : '') + '</div></div>';
  }

  function entry(e, full) {
    return (e.people.length > 1 ? '<p class="meta">♥ A Rotarian couple</p>' : '') + e.people.map(function (p) { return person(p, full); }).join('');
  }

  loadJson('/data/spotlight.json').then(function (d) {
    var n = d.items.length;
    if (!n) return;
    var i = ((day(d.start) % n) + n) % n;
    today.forEach(function (el) { el.innerHTML = entry(d.items[i], el.getAttribute('data-spotlight-today') === 'full'); });
    if (recent) {
      var html = '';
      for (var k = 1; k <= Math.min(6, n - 1); k++) html += '<li class="message-card">' + entry(d.items[(((i - k) % n) + n) % n], false) + '</li>';
      recent.innerHTML = html;
    }
  });
})();
