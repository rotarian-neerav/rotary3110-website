// "Celebrations this week": works out today's date in India time, in the visitor's browser,
// so the list stays right between the weekly website updates. Day and month only, never a year.
(function () {
  var lists = document.querySelectorAll('[data-celebrations]');
  if (!lists.length) return;
  var MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  var DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  // Today in India (UTC+5:30), as a UTC-midnight Date so day arithmetic is simple
  var now = new Date(Date.now() + 5.5 * 3600 * 1000);
  var today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  var monday = new Date(today.getTime() - ((today.getUTCDay() + 6) % 7) * 86400000);

  function md(d) { return ('0' + (d.getUTCMonth() + 1)).slice(-2) + '-' + ('0' + d.getUTCDate()).slice(-2); }
  function weekDays(offsetWeeks) {
    var days = [];
    for (var i = 0; i < 7; i++) days.push(new Date(monday.getTime() + (offsetWeeks * 7 + i) * 86400000));
    return days;
  }

  function item(date, kind, html, photos) {
    var isToday = date.getTime() === today.getTime();
    return '<li class="celebration' + (isToday ? ' is-today' : '') + '">' +
      '<span class="cel-date">' + (isToday ? 'Today' : DAYS[date.getUTCDay()] + ' ' + date.getUTCDate() + ' ' + MONTHS[date.getUTCMonth()]) + '</span>' +
      '<span class="cel-photos">' + photos + '</span>' +
      '<span class="cel-text"><span class="cel-kind">' + kind + '</span>' + html + '</span></li>';
  }

  function render(data) {
    var any = false;
    lists.forEach(function (ul) {
      var days = weekDays(ul.getAttribute('data-celebrations') === 'next' ? 1 : 0);
      var html = '';
      days.forEach(function (d) {
        var key = md(d);
        data.birthdays.forEach(function (b) {
          if (b.md !== key) return;
          html += item(d, '🎂 Birthday', '<strong>' + escapeHtml(b.name) + '</strong><span class="small">' + escapeHtml(b.club) + '</span>', avatarHtml(b.name, b.photo, 44));
        });
        data.anniversaries.forEach(function (a) {
          if (a.md !== key) return;
          var names = '<strong>' + escapeHtml(a.a.name) + (a.a.club && a.b.club && a.a.club !== a.b.club ? ' (' + escapeHtml(a.a.club) + ')' : '') +
            ' &amp; ' + escapeHtml(a.b.name) + (a.b.club && a.a.club !== a.b.club ? ' (' + escapeHtml(a.b.club) + ')' : '') + '</strong>';
          var clubLine = a.a.club === a.b.club || !a.b.club ? '<span class="small">' + escapeHtml(a.a.club) + '</span>' : '';
          var photos = a.couplePhoto
            ? '<img class="couple-photo" src="' + escapeHtml(siteUrl(a.couplePhoto)) + '" alt="Photo of ' + escapeHtml(a.a.name + ' and ' + a.b.name) + '" width="66" height="44" loading="lazy">'
            : avatarHtml(a.a.name, a.a.photo, 44) + (a.b.photo ? avatarHtml(a.b.name, a.b.photo, 44) : '');
          html += item(d, '💍 Wedding anniversary', names + clubLine, photos);
        });
      });
      if (html) any = true;
      ul.innerHTML = html || '<li class="small muted">No celebrations.</li>';
    });
    var strip = document.getElementById('celebrations');
    if (strip) strip.hidden = !any;
  }

  loadJson('/data/celebrations.json').then(render);
})();
