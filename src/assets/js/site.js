// Small helpers used on every page.
(function () {
  var base = document.documentElement.getAttribute('data-base') || '/';
  // Paths inside JSON data start with "/"; add the site's base path (e.g. /rotary3110-website/)
  window.siteUrl = function (path) {
    if (!path || /^https?:/.test(path)) return path || '';
    return base.replace(/\/$/, '') + path;
  };
  window.escapeHtml = function (s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  };
  window.initials = function (name) {
    return String(name || '').replace(/^((Rtn|PDG|DGE|DGN|DG|Dr|CA)\.?\s+)+/, '').split(/\s+/).slice(0, 2).map(function (w) { return w.charAt(0).toUpperCase(); }).join('');
  };
  window.avatarHtml = function (name, src, size) {
    size = size || 48;
    if (src) return '<img class="avatar" src="' + escapeHtml(siteUrl(src)) + '" alt="Photo of ' + escapeHtml(name) + '" width="' + size + '" height="' + size + '" loading="lazy">';
    return '<span class="avatar avatar-initials" style="--s:' + size + 'px" aria-hidden="true">' + escapeHtml(initials(name)) + '</span>';
  };
  window.loadJson = function (path) {
    return fetch(siteUrl(path)).then(function (r) { return r.json(); });
  };

  // Short form links (…/submit/ etc.) forward to the Google Form after a moment
  var fwd = document.querySelector('[data-autoforward]');
  if (fwd) setTimeout(function () { window.location.href = fwd.href; }, 1200);

  // Menu: always open on wide screens; on phones it closes when tapping elsewhere
  document.documentElement.classList.add('js');
  var menu = document.querySelector('.nav-menu');
  if (menu) {
    var wide = window.matchMedia('(min-width: 960px)');
    var sync = function () { menu.open = wide.matches; };
    sync();
    if (wide.addEventListener) wide.addEventListener('change', sync);
    document.addEventListener('click', function (e) {
      if (!wide.matches && menu.open && !menu.contains(e.target)) menu.open = false;
    });
  }
})();
