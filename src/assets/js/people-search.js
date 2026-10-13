// District Leadership and Teams pages: one search over name, team, committee, role, club and zone,
// club office bearers included. Each person appears once, with all their roles and a link to their card.
(function () {
  var form = document.querySelector('[data-people-search]');
  if (!form) return;
  var input = form.querySelector('input');
  var box = document.querySelector('[data-people-results]');
  var listEl = box.querySelector('ul');
  var countEl = box.querySelector('[data-people-count]');
  var year = form.getAttribute('data-year');
  var people = null;

  function norm(s) { return String(s || '').toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim(); }

  function haystack(p) {
    return norm([p.name, p.club].concat(p.roles.map(function (r) {
      return [r.role, r.section, r.committee, r.zone ? r.zone + ' zone' : '', r.term].join(' ');
    })).join(' '));
  }

  function roleText(r) {
    var where = r.committee || r.section;
    var role = r.role + (r.zone ? ' – ' + r.zone + ' Zone' : '') + (r.term ? ' (' + r.term + ')' : '');
    // "Assistant Governor · Assistant Governors" says the same thing twice
    var repeat = !where || where.toLowerCase().indexOf(r.role.toLowerCase()) === 0;
    return escapeHtml(role) + (repeat ? '' : ' · <span class="muted">' + escapeHtml(where) + '</span>');
  }

  function render() {
    var words = norm(input.value).split(' ').filter(Boolean);
    if (!words.length) { box.hidden = true; return; }
    var found = people.filter(function (p) {
      var h = p._h || (p._h = haystack(p));
      return words.every(function (w) { return h.indexOf(w) >= 0; });
    });
    box.hidden = false;
    countEl.textContent = found.length ? found.length + ' ' + (found.length === 1 ? 'person' : 'people') + ' found' : 'Nobody matches that search.';
    listEl.innerHTML = found.slice(0, 60).map(function (p) {
      var name = p.u ? '<a href="' + escapeHtml(siteUrl(p.u)) + '">' + escapeHtml(p.name) + '</a>' : escapeHtml(p.name);
      return '<li class="person">' + avatarHtml(p.name, p.photo, 48) + '<div><strong>' + name + '</strong>' +
        p.roles.map(function (r) { return '<span class="role">' + roleText(r) + '</span>'; }).join('') +
        (p.club ? '<span class="club"><a href="' + escapeHtml(siteUrl(p.clubUrl)) + '">' + escapeHtml(p.club) + '</a></span>' : '') +
        '</div></li>';
    }).join('');
  }

  input.addEventListener('input', function () {
    if (people) return render();
    loadJson('/data/people.json').then(function (all) {
      people = all.filter(function (p) { return p.year === year; });
      render();
    });
  });
})();
