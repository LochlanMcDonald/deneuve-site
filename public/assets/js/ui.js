/** Chrome that is not the shop: theme switch, header, nav, scroll reveal. */

import { $, $$, prefersReducedMotion, store } from './util.js';

export function initTheme() {
  const btn = $('#themeToggle');
  if (!btn) return;

  const media = window.matchMedia('(prefers-color-scheme: dark)');
  const lightIcon = $('.theme-icon-light', btn);
  const darkIcon = $('.theme-icon-dark', btn);

  const isDark = () => {
    const explicit = document.documentElement.dataset.theme;
    return explicit ? explicit === 'dark' : media.matches;
  };

  function sync() {
    const dark = isDark();
    btn.setAttribute('aria-pressed', String(dark));
    btn.setAttribute('aria-label', dark ? 'Switch to light theme' : 'Switch to dark theme');
    if (lightIcon) lightIcon.hidden = dark;
    if (darkIcon) darkIcon.hidden = !dark;
  }

  btn.addEventListener('click', () => {
    const next = isDark() ? 'light' : 'dark';
    document.documentElement.dataset.theme = next;
    store.set('deneuve:theme', next);
    sync();
  });

  // Track the OS setting for as long as the visitor has not overridden it.
  media.addEventListener('change', () => {
    if (!document.documentElement.dataset.theme) sync();
  });

  sync();
}

export function initHeader() {
  const header = $('#siteHeader');
  if (!header) return;

  const setHeaderHeight = () =>
    document.documentElement.style.setProperty('--header-h', `${header.offsetHeight}px`);
  setHeaderHeight();
  window.addEventListener('resize', setHeaderHeight, { passive: true });

  // A zero-height sentinel above the header tells us when it has become sticky,
  // which is cheaper and steadier than listening to scroll.
  const sentinel = document.createElement('div');
  sentinel.setAttribute('aria-hidden', 'true');
  header.before(sentinel);
  new IntersectionObserver(([entry]) => {
    header.dataset.stuck = String(!entry.isIntersecting);
  }).observe(sentinel);

  initNavToggle();
  initScrollSpy();
}

function initNavToggle() {
  const nav = $('#primaryNav');
  const toggle = $('#navToggle');
  if (!nav || !toggle) return;

  const openIcon = $('.nav-icon-open', toggle);
  const closeIcon = $('.nav-icon-close', toggle);

  const setNav = (open) => {
    nav.dataset.open = String(open);
    toggle.setAttribute('aria-expanded', String(open));
    toggle.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
    if (openIcon) openIcon.hidden = open;
    if (closeIcon) closeIcon.hidden = !open;
  };

  toggle.addEventListener('click', () => setNav(nav.dataset.open !== 'true'));
  nav.addEventListener('click', (e) => { if (e.target.closest('a')) setNav(false); });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && nav.dataset.open === 'true') { setNav(false); toggle.focus(); }
  });

  setNav(false);
}

function initScrollSpy() {
  const links = $$('.nav__link');
  const sections = links.map((a) => $(a.getAttribute('href'))).filter(Boolean);
  if (!sections.length) return;

  const spy = new IntersectionObserver(
    (entries) => {
      const visible = entries
        .filter((e) => e.isIntersecting)
        .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
      if (!visible) return;
      links.forEach((a) => {
        if (a.getAttribute('href') === `#${visible.target.id}`) {
          a.setAttribute('aria-current', 'true');
        } else {
          a.removeAttribute('aria-current');
        }
      });
    },
    { rootMargin: '-45% 0px -45% 0px', threshold: [0, 0.25, 0.5] }
  );
  sections.forEach((s) => spy.observe(s));
}

export function initReveal() {
  const targets = $$('[data-reveal]');
  if (!targets.length) return;

  if (prefersReducedMotion.matches || !('IntersectionObserver' in window)) {
    targets.forEach((el) => el.classList.add('is-revealed'));
    return;
  }

  const io = new IntersectionObserver(
    (entries, obs) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        entry.target.classList.add('is-revealed');
        obs.unobserve(entry.target);
      }
    },
    { rootMargin: '0px 0px -8% 0px', threshold: 0.08 }
  );
  targets.forEach((el) => io.observe(el));
}

/** Marks today's opening hours and stamps the footer year. */
export function initDates() {
  const row = $(`#hours [data-day="${new Date().getDay()}"]`);
  if (row) row.dataset.today = 'true';

  const year = $('#year');
  if (year) year.textContent = String(new Date().getFullYear());
}
