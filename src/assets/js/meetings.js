// Club meetings page: today's day (in India) comes first and is marked "Today".
(function () {
  var box = document.querySelector('[data-meeting-days]');
  if (!box) return;
  var today;
  try {
    today = new Intl.DateTimeFormat('en-GB', { weekday: 'long', timeZone: 'Asia/Kolkata' }).format(new Date());
  } catch (e) {
    return;
  }
  var days = Array.prototype.slice.call(box.querySelectorAll('[data-day]'));
  var names = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  var start = names.indexOf(today);
  if (start < 0) return;
  // today first, then the rest of the week in order
  days.sort(function (a, b) {
    var da = (names.indexOf(a.getAttribute('data-day')) - start + 7) % 7;
    var db = (names.indexOf(b.getAttribute('data-day')) - start + 7) % 7;
    return da - db;
  }).forEach(function (s) { box.appendChild(s); });
  var mine = box.querySelector('[data-day="' + today + '"] [data-today]');
  if (mine) mine.hidden = false;
})();
