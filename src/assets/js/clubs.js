// Clubs page: search by club or city, and filter by meeting day. Cities with no match are hidden.
(function () {
  var form = document.querySelector('[data-club-filter]');
  if (!form) return;
  form.hidden = false;
  var items = Array.prototype.slice.call(document.querySelectorAll('[data-club-item]'));
  var groups = Array.prototype.slice.call(document.querySelectorAll('[data-city-group]'));
  var countEl = document.querySelector('[data-club-count]');
  var emptyEl = document.querySelector('[data-club-empty]');
  var params = new URLSearchParams(location.search);
  if (params.get('q')) form.q.value = params.get('q');
  if (params.get('day')) form.day.value = params.get('day');

  function apply() {
    var q = form.q.value.trim().toLowerCase();
    var day = form.day.value;
    var shown = 0;
    items.forEach(function (li) {
      var text = li.getAttribute('data-name') + ' ' + li.getAttribute('data-city');
      var ok = (!q || q.split(/\s+/).every(function (w) { return text.indexOf(w) >= 0; })) && (!day || li.getAttribute('data-day') === day);
      li.hidden = !ok;
      if (ok) shown++;
    });
    groups.forEach(function (g) { g.hidden = !g.querySelector('[data-club-item]:not([hidden])'); });
    var filtered = q || day;
    countEl.textContent = filtered ? shown + (shown === 1 ? ' club found' : ' clubs found') : '';
    emptyEl.hidden = shown > 0;
    var p = new URLSearchParams();
    if (q) p.set('q', form.q.value.trim());
    if (day) p.set('day', day);
    history.replaceState(null, '', p.toString() ? '?' + p : location.pathname);
  }
  form.addEventListener('input', apply);
  form.addEventListener('change', apply);
  apply();
})();
