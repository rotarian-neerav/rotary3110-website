// Bulletin page: "Copy message" puts the ready-made WhatsApp message on the clipboard.
(function () {
  document.querySelectorAll('[data-copy]').forEach(function (btn) {
    var box = document.querySelector(btn.getAttribute('data-copy'));
    if (!box) return;
    var label = btn.textContent;
    btn.addEventListener('click', function () {
      var done = function () {
        btn.textContent = btn.getAttribute('data-copied') || 'Copied';
        setTimeout(function () { btn.textContent = label; }, 2000);
      };
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(box.value).then(done, function () { box.select(); document.execCommand('copy'); done(); });
      } else {
        box.select();
        document.execCommand('copy');
        done();
      }
    });
  });
})();
