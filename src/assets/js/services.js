// Services page: show the services of one city. Types with nothing in that city are hidden.
(function () {
  var form = document.querySelector('[data-service-filter]');
  if (!form) return;
  form.hidden = false;
  var groups = Array.prototype.slice.call(document.querySelectorAll('[data-service-group]'));
  var initial = new URLSearchParams(location.search).get('city');
  if (initial && form.city.querySelector('option[value="' + initial.replace(/"/g, '') + '"]')) form.city.value = initial;
  function apply() {
    var city = form.city.value;
    groups.forEach(function (g) {
      var any = false;
      Array.prototype.forEach.call(g.querySelectorAll('.service-card'), function (c) {
        c.hidden = !!city && c.getAttribute('data-city') !== city;
        if (!c.hidden) any = true;
      });
      g.hidden = !any;
    });
    history.replaceState(null, '', city ? '?city=' + encodeURIComponent(city) : location.pathname);
  }
  form.addEventListener('change', apply);
  apply();
})();
