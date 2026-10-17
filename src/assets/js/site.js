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

  // Abbreviations (DG, PDG, TRF…): tap or press Enter to see the meaning; tap elsewhere to close
  var tip = null;
  function closeTip() { if (tip) { tip.remove(); tip = null; } }
  function openTip(abbr) {
    closeTip();
    tip = document.createElement('span');
    tip.className = 'gloss-tip';
    tip.setAttribute('role', 'tooltip');
    tip.textContent = abbr.textContent + ': ' + abbr.getAttribute('title');
    abbr.insertAdjacentElement('afterend', tip);
  }
  document.addEventListener('click', function (e) {
    var abbr = e.target.closest && e.target.closest('abbr.gloss');
    if (abbr) {
      // inside a link, the first tap explains; a second tap follows the link
      if (tip && tip.previousElementSibling === abbr) { closeTip(); return; }
      if (abbr.closest('a')) e.preventDefault();
      openTip(abbr);
    } else closeTip();
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') closeTip();
    if (e.key === 'Enter' && e.target.matches && e.target.matches('abbr.gloss')) { e.preventDefault(); openTip(e.target); }
  });

  // Larger text, remembered on this phone (applied before the page shows, in the page head)
  var sizeBtn = document.querySelector('[data-text-size]');
  if (sizeBtn) {
    var root = document.documentElement;
    var label = sizeBtn.querySelector('.tool-label');
    var sync2 = function () {
      var large = root.classList.contains('text-large');
      sizeBtn.setAttribute('aria-pressed', large ? 'true' : 'false');
      label.textContent = sizeBtn.getAttribute(large ? 'data-label-normal' : 'data-label-large');
    };
    sizeBtn.hidden = false;
    sync2();
    sizeBtn.addEventListener('click', function () {
      var large = root.classList.toggle('text-large');
      try { localStorage.setItem('textSize', large ? 'large' : 'normal'); } catch (e) { /* private window */ }
      sync2();
    });
  }

  // YouTube videos load only when tapped, using YouTube's no-cookie player.
  // A video whose picture YouTube no longer has keeps the play button on a dark box.
  document.addEventListener('error', function (e) {
    if (e.target && e.target.closest && e.target.closest('.video-start')) e.target.style.visibility = 'hidden';
  }, true);
  document.addEventListener('click', function (e) {
    var start = e.target.closest && e.target.closest('.video-start');
    if (!start) return;
    var fig = start.closest('[data-video]');
    if (!fig) return;
    e.preventDefault();
    var frame = document.createElement('iframe');
    frame.src = fig.getAttribute('data-video');
    frame.title = fig.getAttribute('data-title') || 'Video';
    frame.allow = 'autoplay; encrypted-media; picture-in-picture; fullscreen';
    frame.allowFullscreen = true;
    frame.className = 'video-frame';
    start.replaceWith(frame);
  });

  // This month in Rotary: the visitor's own date picks the month
  var months = document.querySelector('[data-rotary-months]');
  if (months) {
    var now = new Date().getMonth() + 1;
    Array.prototype.forEach.call(months.querySelectorAll('[data-month]'), function (m) {
      m.hidden = Number(m.getAttribute('data-month')) !== now;
    });
  }

  // Pages read recently stay readable offline (and the site can be added to the home screen)
  if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
    window.addEventListener('load', function () {
      navigator.serviceWorker.register(siteUrl('/sw.js')).catch(function () { /* not supported here */ });
    });
  }
})();
