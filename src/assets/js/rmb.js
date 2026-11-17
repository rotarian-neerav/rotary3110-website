// Rotary Means Business pages: narrow the businesses by words, trade and city. Without JavaScript every business shows.
(function () {
  var form = document.querySelector('[data-rmb-filter]');
  if (!form) return;
  form.hidden = false;
  var cards = Array.prototype.slice.call(document.querySelectorAll('.business-card'));
  var groups = Array.prototype.slice.call(document.querySelectorAll('[data-rmb-group]'));
  var count = document.querySelector('[data-rmb-count]');
  var none = document.querySelector('[data-rmb-none]');
  var params = new URLSearchParams(location.search);
  ['q', 'trade', 'city'].forEach(function (k) {
    var field = form.elements[k];
    var v = params.get(k);
    if (!field || !v) return;
    if (field.tagName === 'SELECT' && !field.querySelector('option[value="' + v.replace(/"/g, '') + '"]')) return;
    field.value = v;
  });
  function value(k) { return form.elements[k] ? form.elements[k].value : ''; }
  function apply() {
    var words = value('q').toLowerCase().split(/\s+/).filter(Boolean);
    var trade = value('trade');
    var city = value('city');
    var shown = 0;
    cards.forEach(function (c) {
      var text = c.getAttribute('data-text') || '';
      var ok = (!trade || c.getAttribute('data-trade') === trade) && (!city || c.getAttribute('data-city') === city) &&
        words.every(function (w) { return text.indexOf(w) >= 0; });
      c.hidden = !ok;
      if (ok) shown++;
    });
    groups.forEach(function (g) { g.hidden = !g.querySelector('.business-card:not([hidden])'); });
    if (count) count.textContent = shown + (shown === 1 ? ' business' : ' businesses');
    if (none) none.hidden = shown > 0;
    var q = [];
    ['q', 'trade', 'city'].forEach(function (k) { if (value(k)) q.push(k + '=' + encodeURIComponent(value(k))); });
    history.replaceState(null, '', q.length ? '?' + q.join('&') : location.pathname);
  }
  form.addEventListener('input', apply);
  form.addEventListener('change', apply);
  apply();
})();
