// "Celebrations this week": works out today's date in India time, in the visitor's browser,
// so the list stays right between the weekly website updates. Day and month only, never a year.
(function () {
  var lists = document.querySelectorAll('[data-celebrations]');
  if (!lists.length && !document.querySelector('[data-anniversary-banner]')) return;
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

  // Rotarian couples' anniversaries today, on the home page (owner, 26 Nov 2026). Up to three tiles; the order
  // changes each year, so no couple is always first; more than three link to the Celebrations page.
  function order(key) {
    var h = 0x811c9dc5;
    for (var i = 0; i < key.length; i++) { h ^= key.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
    return h;
  }
  function banner(data) {
    var box = document.querySelector('[data-anniversary-banner]');
    if (!box) return;
    var key = md(today);
    var year = String(today.getUTCFullYear());
    var todays = (data.rotarianCouples || []).filter(function (c) { return c.md === key; })
      .sort(function (x, y) { return order(year + x.k) - order(year + y.k); });
    if (!todays.length) return;
    var person = function (p) { return p.u ? '<a href="' + escapeHtml(siteUrl(p.u)) + '">' + escapeHtml(p.name) + '</a>' : escapeHtml(p.name); };
    var wish = function (p) {
      return p.wa ? '<a class="btn-small wa" href="' + escapeHtml(p.wa + '?text=' + encodeURIComponent('Happy wedding anniversary! Warm wishes from a fellow Rotarian of District 3110.')) +
        '" target="_blank" rel="noopener">Wish ' + escapeHtml(String(p.name).replace(/^((Rtn|PDG|PP|Dr|CA)\.?\s+)+/, '').split(' ')[0]) + '</a>' : '';
    };
    box.querySelector('[data-anniv-list]').innerHTML = todays.slice(0, 3).map(function (c) {
      var photos = c.couplePhoto
        ? '<img class="couple-photo" src="' + escapeHtml(siteUrl(c.couplePhoto)) + '" alt="Photo of ' + escapeHtml(c.a.name + ' and ' + c.b.name) + '" width="96" height="64" loading="lazy">'
        : '<span class="cel-photos">' + avatarHtml(c.a.name, c.a.photo, 56) + avatarHtml(c.b.name, c.b.photo, 56) + '</span>';
      var clubs = c.a.club === c.b.club ? escapeHtml(c.a.club) : escapeHtml(c.a.club) + ' and ' + escapeHtml(c.b.club);
      var buttons = wish(c.a) + wish(c.b);
      return '<li class="anniv-tile">' + photos + '<div><strong>' + person(c.a) + ' &amp; ' + person(c.b) + '</strong><p class="small">' + clubs + '</p>' +
        (buttons ? '<p class="dir-actions">' + buttons + '</p>' : '') + '</div></li>';
    }).join('');
    if (todays.length > 3) {
      var more = todays.length - 3;
      box.querySelector('[data-anniv-more-link]').textContent = 'and ' + more + ' more ' + (more === 1 ? 'couple celebrates' : 'couples celebrate') + ' today →';
      box.querySelector('[data-anniv-more]').hidden = false;
    }
    box.hidden = false;
  }

  loadJson('/data/celebrations.json').then(function (data) { render(data); banner(data); });
})();
