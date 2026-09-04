/** Shared helpers. Kept dependency-free and side-effect-free. */

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

export const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

const formatters = new Map();

/** Currency formatter, cached per currency code. */
export function money(value, currency = 'CAD') {
  if (!Number.isFinite(value)) return 'Price on request';
  if (!formatters.has(currency)) {
    formatters.set(
      currency,
      new Intl.NumberFormat('en-CA', { style: 'currency', currency, minimumFractionDigits: 2 })
    );
  }
  return formatters.get(currency).format(value);
}

/** localStorage that never throws — private mode and blocked storage are normal. */
export const store = {
  get(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw === null ? fallback : JSON.parse(raw);
    } catch {
      return fallback;
    }
  },
  set(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch {
      return false;
    }
  },
};

/** Trailing-edge debounce, used for the shop search box. */
export function debounce(fn, wait = 200) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), wait);
  };
}

const toastStack = $('#toasts');

export function toast(message) {
  if (!toastStack) return;
  const el = document.createElement('div');
  el.className = 'toast';
  el.textContent = message;
  toastStack.append(el);

  setTimeout(() => {
    el.dataset.leaving = 'true';
    el.addEventListener('animationend', () => el.remove(), { once: true });
    // Belt and braces: animationend does not fire in a background tab.
    setTimeout(() => el.remove(), 800);
  }, 2600);
}

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), ' +
  'textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Keeps Tab inside an open dialog and restores focus on close.
 * @returns {() => void} release function
 */
export function trapFocus(container, { onEscape } = {}) {
  const previous = document.activeElement;

  const onKeydown = (e) => {
    if (e.key === 'Escape') { onEscape?.(); return; }
    if (e.key !== 'Tab') return;

    const items = $$(FOCUSABLE, container).filter((el) => el.offsetParent !== null);
    if (!items.length) return;

    const first = items[0];
    const last = items[items.length - 1];

    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  };

  document.addEventListener('keydown', onKeydown);
  ($(FOCUSABLE, container) || container).focus?.();

  return () => {
    document.removeEventListener('keydown', onKeydown);
    previous?.focus?.();
  };
}
