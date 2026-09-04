/**
 * Basket state and the slide-over drawer.
 *
 * The basket is a local reservation list, not a payment flow — items are held
 * and paid for in the shop — so localStorage is the whole persistence story.
 */

import { $, money, store, toast, trapFocus } from './util.js';

const KEY = 'deneuve:cart';
const MAX_QTY = 10;

let lines = load();
let releaseFocus = null;

function load() {
  const raw = store.get(KEY, []);
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((l) => l && typeof l.id === 'string' && Number.isFinite(l.qty))
    .map((l) => ({
      id: l.id,
      title: String(l.title ?? 'Untitled piece'),
      price: Number.isFinite(l.price) ? l.price : null,
      imageUrl: String(l.imageUrl ?? ''),
      size: l.size ? String(l.size) : '',
      qty: Math.min(MAX_QTY, Math.max(1, Math.round(l.qty))),
    }));
}

const persist = () => store.set(KEY, lines);

const lineKey = (item) => `${item.id}::${item.size || ''}`;

export const cart = {
  get lines() { return lines; },
  get count() { return lines.reduce((n, l) => n + l.qty, 0); },
  get subtotal() { return lines.reduce((n, l) => n + (l.price ?? 0) * l.qty, 0); },

  add(item, { size = '', qty = 1 } = {}) {
    const key = lineKey({ ...item, size });
    const existing = lines.find((l) => lineKey(l) === key);

    if (existing) {
      if (existing.qty >= MAX_QTY) {
        toast(`That is as many ${item.title} as we can hold.`);
        return;
      }
      existing.qty = Math.min(MAX_QTY, existing.qty + qty);
    } else {
      lines.push({
        id: item.id,
        title: item.title,
        price: item.price,
        imageUrl: item.imageUrl || '',
        size,
        qty: Math.min(MAX_QTY, qty),
      });
    }

    persist();
    render();
    toast(`${item.title} added to your basket.`);
  },

  setQty(key, qty) {
    const line = lines.find((l) => lineKey(l) === key);
    if (!line) return;
    line.qty = Math.min(MAX_QTY, qty);
    if (line.qty < 1) lines = lines.filter((l) => l !== line);
    persist();
    render();
  },

  remove(key) {
    lines = lines.filter((l) => lineKey(l) !== key);
    persist();
    render();
  },

  clear() {
    lines = [];
    persist();
    render();
  },
};

/* ------------------------------------------------------------ rendering */

function render() {
  const body = $('#cartBody');
  const total = $('#cartTotal');
  const count = $('#cartCount');
  const checkout = $('#checkoutBtn');
  if (!body) return;

  if (count) {
    count.textContent = String(cart.count);
    count.hidden = cart.count === 0;
  }

  const toggle = $('#cartToggle');
  if (toggle) {
    toggle.setAttribute(
      'aria-label',
      cart.count ? `Open basket, ${cart.count} item${cart.count === 1 ? '' : 's'}` : 'Open basket'
    );
  }

  if (total) total.textContent = money(cart.subtotal);
  if (checkout) checkout.disabled = lines.length === 0;

  if (!lines.length) {
    body.innerHTML = `
      <div class="state" style="box-shadow:none">
        <img class="state__mark" src="/assets/img/mark-small.png" alt="" width="192" height="152">
        <h3 class="state__title">Nothing pinned yet</h3>
        <p>Pieces you reserve will gather here.</p>
      </div>`;
    return;
  }

  body.innerHTML = '';
  for (const line of lines) {
    const key = lineKey(line);
    const el = document.createElement('article');
    el.className = 'cart-line';

    const thumb = document.createElement('div');
    thumb.className = 'cart-line__thumb';
    if (line.imageUrl) {
      const img = document.createElement('img');
      img.src = line.imageUrl;
      img.alt = '';
      img.loading = 'lazy';
      thumb.append(img);
    } else {
      thumb.classList.add('halftone');
    }

    const info = document.createElement('div');
    const title = document.createElement('p');
    title.className = 'cart-line__title';
    title.textContent = line.title;

    const meta = document.createElement('p');
    meta.className = 'cart-line__meta';
    meta.textContent = [line.size && `Size ${line.size}`, money(line.price)]
      .filter(Boolean)
      .join(' · ');

    const qty = document.createElement('div');
    qty.className = 'qty';
    qty.innerHTML = `
      <button type="button" data-qty="down" aria-label="Reduce quantity of ${escapeAttr(line.title)}">−</button>
      <output aria-label="Quantity">${line.qty}</output>
      <button type="button" data-qty="up" aria-label="Increase quantity of ${escapeAttr(line.title)}">+</button>`;

    qty.addEventListener('click', (e) => {
      const dir = e.target.closest('[data-qty]')?.dataset.qty;
      if (!dir) return;
      cart.setQty(key, line.qty + (dir === 'up' ? 1 : -1));
    });

    const remove = document.createElement('button');
    remove.type = 'button';
    remove.className = 'btn btn--ghost btn--sm';
    remove.textContent = 'Remove';
    remove.style.marginTop = '0.4rem';
    remove.addEventListener('click', () => {
      cart.remove(key);
      toast(`${line.title} removed.`);
    });

    info.append(title, meta, remove);
    el.append(thumb, info, qty);
    body.append(el);
  }
}

function escapeAttr(value) {
  return String(value).replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]
  );
}

/* -------------------------------------------------------------- drawer */

export function openCart() {
  const drawer = $('#cartDrawer');
  const scrim = $('#scrim');
  const toggle = $('#cartToggle');
  if (!drawer) return;

  drawer.dataset.open = 'true';
  drawer.setAttribute('aria-hidden', 'false');
  if (scrim) { scrim.hidden = false; scrim.dataset.open = 'true'; }
  toggle?.setAttribute('aria-expanded', 'true');
  document.body.classList.add('is-locked');
  releaseFocus = trapFocus(drawer, { onEscape: closeCart });
}

export function closeCart() {
  const drawer = $('#cartDrawer');
  const scrim = $('#scrim');
  const toggle = $('#cartToggle');
  if (!drawer || drawer.dataset.open !== 'true') return;

  drawer.dataset.open = 'false';
  drawer.setAttribute('aria-hidden', 'true');
  if (scrim) {
    scrim.dataset.open = 'false';
    // Wait for the fade before removing it from the box model.
    setTimeout(() => { if (scrim.dataset.open !== 'true') scrim.hidden = true; }, 300);
  }
  toggle?.setAttribute('aria-expanded', 'false');
  document.body.classList.remove('is-locked');
  releaseFocus?.();
  releaseFocus = null;
}

export function initCart() {
  render();

  $('#cartToggle')?.addEventListener('click', () => {
    const open = $('#cartDrawer')?.dataset.open === 'true';
    open ? closeCart() : openCart();
  });

  $('[data-close-cart]')?.addEventListener('click', closeCart);
  $('#scrim')?.addEventListener('click', closeCart);

  $('#checkoutBtn')?.addEventListener('click', () => {
    if (!lines.length) return;
    const pieces = cart.count;
    cart.clear();
    closeCart();
    toast(`${pieces} piece${pieces === 1 ? '' : 's'} reserved. We will email you shortly.`);
  });
}
