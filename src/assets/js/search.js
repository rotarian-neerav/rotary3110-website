// Search page: Pagefind's search box over the pages search engines may list (never the directory,
// celebrations or the cards of people who did not join the directory). Runs in the browser; no server.
window.addEventListener('DOMContentLoaded', function () {
  var el = document.querySelector('[data-search]');
  if (!el || !window.PagefindUI) return;
  var q = new URLSearchParams(location.search).get('q') || '';
  var ui = new window.PagefindUI({
    element: el,
    // results link under the site's own address (e.g. /rotary3110-website/ on the free address)
    baseUrl: document.documentElement.getAttribute('data-base') || '/',
    showSubResults: false,
    showImages: false,
    resetStyles: false,
    translations: { placeholder: 'Search activities, clubs, events, people…', zero_results: 'Nothing found for [SEARCH_TERM]' },
  });
  if (q) ui.triggerSearch(q);
  var input = el.querySelector('input');
  if (input) input.focus();
});
