// Events page: show only events open to everyone, and copy the calendar subscription link.
(function () {
  var toggle = document.querySelector('[data-open-filter]');
  var list = document.querySelector('[data-event-list]');
  if (toggle && list) {
    toggle.hidden = false;
    var box = toggle.querySelector('input');
    var apply = function () {
      Array.prototype.forEach.call(list.querySelectorAll('.event'), function (e) {
        e.hidden = box.checked && e.getAttribute('data-open') !== 'yes';
      });
    };
    if (new URLSearchParams(location.search).get('open') === '1') box.checked = true;
    box.addEventListener('change', function () {
      apply();
      history.replaceState(null, '', box.checked ? '?open=1' : location.pathname);
    });
    apply();
  }
  var copy = document.querySelector('[data-copy]');
  if (copy && navigator.clipboard) {
    copy.hidden = false;
    copy.addEventListener('click', function () {
      navigator.clipboard.writeText(copy.getAttribute('data-copy')).then(function () {
        var label = copy.textContent;
        copy.textContent = copy.getAttribute('data-copied');
        setTimeout(function () { copy.textContent = label; }, 2000);
      });
    });
  }
})();
