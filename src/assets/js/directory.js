// Professional directory: search by profession, area and free text, e.g. "chartered accountant agra".
(function () {
  var form = document.querySelector('[data-directory]');
  if (!form) return;
  var listEl = document.querySelector('[data-directory-results]');
  var countEl = document.querySelector('[data-directory-count]');
  var members = [];
  var hello = form.getAttribute('data-wa-hello') || '';

  function norm(s) { return String(s || '').toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim(); }

  function card(m) {
    var buttons = '';
    if (m.sampleContact) buttons = '<span class="small muted">Sample entry – WhatsApp and call buttons are switched off</span>';
    if (m.wa || m.call) buttons = '';
    if (m.wa) buttons += '<a class="btn-small wa" href="' + escapeHtml(m.wa + (hello ? '?text=' + encodeURIComponent(hello) : '')) + '" target="_blank" rel="noopener">WhatsApp</a>';
    if (m.call) buttons += '<a class="btn-small" href="tel:+' + escapeHtml(m.call.replace(/\D/g, '')) + '">Call</a>';
    if (m.website) buttons += '<a class="btn-small" href="' + escapeHtml(m.website) + '" target="_blank" rel="noopener">Website ↗</a>';
    return '<li class="dir-card">' + avatarHtml(m.name, m.photo, 64) +
      '<div><h3>' + (m.u ? '<a href="' + escapeHtml(siteUrl(m.u)) + '">' + escapeHtml(m.name) + '</a>' : escapeHtml(m.name)) + '</h3>' +
      (m.profession || m.area ? '<p class="role">' + escapeHtml([m.profession, m.area].filter(Boolean).join(' · ')) + '</p>' : '') +
      (m.roles ? '<p class="small">' + escapeHtml(m.roles) + '</p>' : '') +
      // a Rotarian couple, both listed (owner, 26 Nov 2026)
      (m.spouse ? '<p><span class="ribbon">♥ Rotarian couple with ' + (m.spouse.u ? '<a href="' + escapeHtml(siteUrl(m.spouse.u)) + '">' + escapeHtml(m.spouse.name) + '</a>' : escapeHtml(m.spouse.name)) +
        (m.spouse.club && m.spouse.club !== m.club ? ', ' + escapeHtml(m.spouse.club) : '') + '</span></p>' : '') +
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
      var h = m._h || (m._h = norm([m.name, m.profession, m.area, m.club, m.roles, m.text].join(' ')));
      return words.every(function (w) { return h.indexOf(w) >= 0; });
    });
    // only the first 100 show: a new order each visit, so it is not always the same members at the top;
    // once someone searches or filters, A to Z is easier to scan. Only here, never on the team pages (owner, 26 Nov 2026).
    if (prof || area || words.length) found.sort(function (a, b) { return String(a.name).localeCompare(String(b.name)); });
    countEl.textContent = found.length ? found.length + (found.length === 1 ? ' member found' : ' members found') : 'No members match. Try a wider search.';
    listEl.innerHTML = found.slice(0, 100).map(card).join('');
  }

  // shuffled once per visit, not on every key press
  function shuffle(list) {
    for (var i = list.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var x = list[i]; list[i] = list[j]; list[j] = x;
    }
    return list;
  }

  ['input', 'change'].forEach(function (ev) { form.addEventListener(ev, render); });
  loadJson('/data/directory.json').then(function (all) { members = shuffle(all.slice()); render(); });
})();
