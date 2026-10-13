// Activities page: filter by club and theme, and show the list a page at a time.
(function () {
  var form = document.querySelector('[data-filter-target]');
  if (!form) return;
  var list = document.querySelector(form.getAttribute('data-filter-target'));
  var cards = Array.prototype.slice.call(list.children);
  var pageSize = Number(list.getAttribute('data-page-size')) || 24;
  var countEl = document.querySelector('[data-filter-count]');
  var emptyEl = document.querySelector('[data-filter-empty]');
  var moreBtn = document.querySelector('[data-show-more]');
  var shown = pageSize;

  // Remember the choice in the address, so a filtered list can be shared
  var params = new URLSearchParams(location.search);
  if (params.get('club')) form.club.value = params.get('club');
  if (params.get('theme')) {
    var r = form.querySelector('input[name=theme][value="' + params.get('theme') + '"]');
    if (r) r.checked = true;
  }

  function apply(resetPage) {
    if (resetPage) shown = pageSize;
    var club = form.club.value;
    var theme = (form.querySelector('input[name=theme]:checked') || {}).value || '';
    var matches = 0;
    cards.forEach(function (card) {
      var ok = (!club || (' ' + card.getAttribute('data-club') + ' ').indexOf(' ' + club + ' ') >= 0) &&
        (!theme || card.getAttribute('data-theme') === theme);
      if (ok) matches++;
      card.hidden = !ok || matches > shown;
    });
    countEl.textContent = matches + (matches === 1 ? ' activity' : ' activities');
    emptyEl.hidden = matches > 0;
    moreBtn.hidden = matches <= shown;
    var q = new URLSearchParams();
    if (club) q.set('club', club);
    if (theme) q.set('theme', theme);
    history.replaceState(null, '', q.toString() ? '?' + q : location.pathname);
  }

  form.addEventListener('change', function () { apply(true); });
  moreBtn.addEventListener('click', function () { shown += pageSize; apply(false); });
  apply(true);
})();
