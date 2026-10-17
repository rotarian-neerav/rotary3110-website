// Professional directory: search by profession, area and free text, e.g. "chartered accountant agra".
(function () {
  var form = document.querySelector('[data-directory]');
  if (!form) return;
  var listEl = document.querySelector('[data-directory-results]');
  var countEl = document.querySelector('[data-directory-count]');
  var members = [];

  function norm(s) { return String(s || '').toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim(); }

  function card(m) {
    var buttons = '';
    if (m.sampleContact) buttons = '<span class="small muted">Sample entry – WhatsApp and call buttons are switched off</span>';
    if (m.wa) {
      buttons = '<a class="btn-small wa" href="' + escapeHtml(m.wa) + '" target="_blank" rel="noopener">WhatsApp</a>' +
        '<a class="btn-small" href="tel:+' + escapeHtml(m.wa.replace(/\D/g, '')) + '">Call</a>';
    }
    if (m.website) buttons += '<a class="btn-small" href="' + escapeHtml(m.website) + '" target="_blank" rel="noopener">Website ↗</a>';
    return '<li class="dir-card">' + avatarHtml(m.name, m.photo, 64) +
      '<div><h3>' + (m.u ? '<a href="' + escapeHtml(siteUrl(m.u)) + '">' + escapeHtml(m.name) + '</a>' : escapeHtml(m.name)) + '</h3>' +
      '<p class="role">' + escapeHtml(m.profession) + ' · ' + escapeHtml(m.area) + '</p>' +
      '<p class="club"><a href="' + escapeHtml(siteUrl(m.clubUrl)) + '">' + escapeHtml(m.club) + '</a></p>' +
      (m.text ? '<p>' + escapeHtml(m.text) + '</p>' : '') +
      (buttons ? '<p class="dir-actions">' + buttons + '</p>' : '') + '</div></li>';
  }

  function render() {
    var prof = form.profession.value;
    var area = form.area.value;
    var words = norm(form.q.value).split(' ').filter(Boolean);
    var found = members.filter(function (m) {
      if (prof && m.profession !== prof) return false;
      if (area && m.area !== area) return false;
      var h = m._h || (m._h = norm([m.name, m.profession, m.area, m.club, m.text].join(' ')));
      return words.every(function (w) { return h.indexOf(w) >= 0; });
    });
    countEl.textContent = found.length ? found.length + (found.length === 1 ? ' member found' : ' members found') : 'No members match. Try a wider search.';
    listEl.innerHTML = found.slice(0, 100).map(card).join('');
  }

  ['input', 'change'].forEach(function (ev) { form.addEventListener(ev, render); });
  loadJson('/data/directory.json').then(function (all) { members = all; render(); });
})();
