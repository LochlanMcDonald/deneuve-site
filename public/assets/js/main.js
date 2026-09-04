/**
 * Entry point. Wires the independent modules together and nothing else, so any
 * one of them can be changed or removed without touching the others.
 */

import { initTheme, initHeader, initReveal, initDates } from './ui.js';
import { initCart } from './cart.js';
import { initShop } from './shop.js';
import { initForm } from './forms.js';

function boot() {
  initTheme();
  initHeader();
  initReveal();
  initDates();
  initCart();
  initShop();
  initForm();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot, { once: true });
} else {
  boot();
}
