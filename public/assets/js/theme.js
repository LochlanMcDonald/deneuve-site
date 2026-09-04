/**
 * Applies the stored colour theme before first paint.
 *
 * This is a small blocking script on purpose: deferring it would let the page
 * paint in the light palette and then snap to dark, which is worse than the
 * few milliseconds it costs here.
 */
(function () {
  'use strict';

  // Scripting is available: styles that hide content until revealed are keyed
  // off this class, so a failed or blocked script leaves the page fully legible.
  document.documentElement.classList.add('js');

  try {
    var stored = localStorage.getItem('deneuve:theme');
    if (stored === 'dark' || stored === 'light') {
      document.documentElement.setAttribute('data-theme', stored);
    }
  } catch (err) {
    /* Private browsing or blocked storage — fall back to the media query. */
  }
})();
