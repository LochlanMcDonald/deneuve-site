/**
 * The catalogue: fetching, filtering and rendering.
 *
 * Product data comes from an upstream service we do not control, so every
 * value is treated as untrusted: nodes are built with createElement and
 * textContent (never innerHTML), and image URLs are scheme-checked before use.
 */

import { $, $$, money, debounce, toast, trapFocus } from './util.js';
import { cart, openCart } from './cart.js';

const grid = $('#products');
const countEl = $('#shopCount');
const filtersEl = $('#shopFilters');
const searchEl = $('#shopSearch');
const sortEl = $('#shopSort');

let items = [];
let currency = 'CAD';
let releaseFocus = null;
const state = { query: '', category: 'all', sort: 'featured' };

/**
 * Only ever hand a vetted URL to an <img>: http(s), or a non-SVG data:image.
 * SVG is excluded because it is the one image format with a script surface.
 */
function safeImageUrl(value) {
  if (!value) return '';
  const raw = String(value).trim();

  if (/^data:image\//i.test(raw)) {
    return /^data:image\/svg\+xml/i.test(raw) ? '' : raw;
  }

  try {
    const url = new URL(raw, window.location.origin);
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.href : '';
  } catch {
    return '';
  }
}

/* -------------------------------------------------------------- fetching */

async function load() {
  setBusy(true);
  renderSkeletons(8);

  try {
    const res = await fetch('/api/items', { headers: { accept: 'application/json' } });
    const data = await res.json().catch(() => ({}));

    // A non-OK status means we could not reach the catalogue, which is a
    // different message from a catalogue that legitimately has nothing in it.
    if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);

    items = (Array.isArray(data.items) ? data.items : []).map((it, i) => ({
      ...it,
      id: String(it.id ?? i),
      imageUrl: safeImageUrl(it.imageUrl),
      price: Number.isFinite(it.price) ? it.price : null,
    }));
    currency = data.currency || 'CAD';

    renderFilters();
    apply();
  } catch (err) {
    console.error('[shop] catalogue unavailable:', err);
    renderError();
  } finally {
    setBusy(false);
  }
}

const setBusy = (busy) => grid?.setAttribute('aria-busy', String(busy));

/* ------------------------------------------------------------- filtering */

function visible() {
  const q = state.query.trim().toLowerCase();

  let out = items.filter((it) => {
    if (state.category !== 'all' && it.category !== state.category) return false;
    if (!q) return true;
    return [it.title, it.description, it.category, ...(it.sizes || [])]
      .join(' ')
      .toLowerCase()
      .includes(q);
  });

  const byPrice = (dir) => (a, b) => {
    // Items without a price always sort last, whichever direction is chosen.
    if (a.price === null) return 1;
    if (b.price === null) return -1;
    return dir * (a.price - b.price);
  };

  if (state.sort === 'price-asc') out = out.sort(byPrice(1));
  else if (state.sort === 'price-desc') out = out.sort(byPrice(-1));
  else if (state.sort === 'title') out = out.sort((a, b) => a.title.localeCompare(b.title));

  return out;
}

function apply() {
  const list = visible();

  if (countEl) {
    countEl.textContent = list.length
      ? `${list.length} piece${list.length === 1 ? '' : 's'}`
      : 'No matches';
  }

  if (!items.length) return renderEmpty('The rail is empty', 'New pieces go up most Fridays.');
  if (!list.length) {
    return renderEmpty('Nothing matches that', 'Try a different search or clear the filters.', true);
  }

  renderGrid(list);
}

function renderFilters() {
  if (!filtersEl) return;
  const categories = [...new Set(items.map((it) => it.category).filter(Boolean))].sort();
  filtersEl.replaceChildren();
  if (categories.length < 2) return;

  for (const [value, label] of [['all', 'Everything'], ...categories.map((c) => [c, c])]) {
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = 'chip';
    chip.textContent = label;
    chip.setAttribute('aria-pressed', String(state.category === value));
    chip.addEventListener('click', () => {
      state.category = value;
      $$('.chip', filtersEl).forEach((c) => c.setAttribute('aria-pressed', String(c === chip)));
      apply();
    });
    filtersEl.append(chip);
  }
}

/* ------------------------------------------------------------- rendering */

function renderSkeletons(n) {
  if (!grid) return;
  grid.replaceChildren();
  for (let i = 0; i < n; i += 1) {
    const el = document.createElement('div');
    el.className = 'skeleton';
    el.innerHTML =
      '<div class="skeleton__media"></div>' +
      '<div class="skeleton__body">' +
      '<div class="skeleton__line skeleton__line--short"></div>' +
      '<div class="skeleton__line"></div>' +
      '<div class="skeleton__line skeleton__line--short"></div>' +
      '</div>';
    grid.append(el);
  }
}

function stateBlock(title, body, withReset = false) {
  const wrap = document.createElement('div');
  wrap.className = 'state';
  wrap.style.gridColumn = '1 / -1';

  const mark = document.createElement('img');
  mark.className = 'state__mark';
  mark.src = '/assets/img/mark-small.png';
  mark.alt = '';
  mark.width = 192;
  mark.height = 152;

  const h = document.createElement('h3');
  h.className = 'state__title';
  h.textContent = title;

  const p = document.createElement('p');
  p.textContent = body;

  wrap.append(mark, h, p);

  if (withReset) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'btn btn--ghost btn--sm';
    btn.textContent = 'Clear filters';
    btn.addEventListener('click', () => {
      state.query = '';
      state.category = 'all';
      if (searchEl) searchEl.value = '';
      $$('.chip', filtersEl).forEach((c, i) => c.setAttribute('aria-pressed', String(i === 0)));
      apply();
    });
    wrap.append(btn);
  }
  return wrap;
}

function renderEmpty(title, body, withReset) {
  grid?.replaceChildren(stateBlock(title, body, withReset));
}

function renderError() {
  if (!grid) return;
  const block = stateBlock(
    'The rail is jammed',
    'We could not reach the catalogue just now. The shop itself is open as usual.'
  );
  const retry = document.createElement('button');
  retry.type = 'button';
  retry.className = 'btn btn--sm';
  retry.textContent = 'Try again';
  retry.addEventListener('click', load);
  block.append(retry);
  grid.replaceChildren(block);
  if (countEl) countEl.textContent = '';
}

/** Fallback artwork: the piece's initial printed on a swatch. */
function swatch(title) {
  const el = document.createElement('div');
  el.className = 'card__swatch';
  const span = document.createElement('span');
  span.textContent = (title.trim()[0] || 'D').toUpperCase();
  el.append(span);
  return el;
}

function buildCard(item) {
  const card = document.createElement('article');
  card.className = 'card';

  /* -- media -- */
  const media = document.createElement('div');
  media.className = 'card__media';

  if (item.imageUrl) {
    const img = document.createElement('img');
    img.src = item.imageUrl;
    img.alt = item.title;
    img.loading = 'lazy';
    img.decoding = 'async';
    // A dead upstream image should look like a swatch, not a broken icon.
    img.addEventListener('error', () => img.replaceWith(swatch(item.title)), { once: true });
    media.append(img);
  } else {
    media.append(swatch(item.title));
  }

  if (!item.available) {
    const badge = document.createElement('span');
    badge.className = 'card__badge card__badge--sold';
    badge.textContent = 'Sold';
    media.append(badge);
  }

  /* -- body -- */
  const body = document.createElement('div');
  body.className = 'card__body';

  const cat = document.createElement('p');
  cat.className = 'card__cat';
  cat.textContent = item.category;

  const title = document.createElement('h3');
  title.className = 'card__title';
  const link = document.createElement('a');
  link.className = 'card__link';
  link.href = '#';
  link.textContent = item.title;
  link.addEventListener('click', (e) => { e.preventDefault(); openQuickview(item); });
  title.append(link);

  const foot = document.createElement('div');
  foot.className = 'card__foot';

  const price = document.createElement('p');
  price.className = 'card__price';
  price.textContent = money(item.price, currency);

  const add = document.createElement('button');
  add.type = 'button';
  add.className = 'btn btn--sm card__add';
  add.textContent = item.available ? 'Add' : 'Sold';
  add.disabled = !item.available;
  add.setAttribute('aria-label', `Add ${item.title} to basket`);
  add.addEventListener('click', () => cart.add(item));

  foot.append(price, add);
  body.append(cat, title);

  if (item.description) {
    const desc = document.createElement('p');
    desc.className = 'card__desc';
    desc.textContent = item.description;
    body.append(desc);
  }

  body.append(foot);
  card.append(media, body);
  return card;
}

function renderGrid(list) {
  if (!grid) return;
  const frag = document.createDocumentFragment();
  list.forEach((item) => frag.append(buildCard(item)));
  grid.replaceChildren(frag);
}

/* ------------------------------------------------------------ quickview */

function openQuickview(item) {
  const dialog = $('#quickview');
  const scrim = $('#scrim');
  if (!dialog) return;

  $('#qvCategory').textContent = item.category;
  $('#qvTitle').textContent = item.title;
  $('#qvPrice').textContent = money(item.price, currency);
  $('#qvDesc').textContent = item.description || 'Ask us at the bench — we know its history.';

  const media = $('#qvMedia');
  media.replaceChildren();
  if (item.imageUrl) {
    const img = document.createElement('img');
    img.src = item.imageUrl;
    img.alt = item.title;
    img.addEventListener('error', () => img.replaceWith(swatch(item.title)), { once: true });
    media.append(img);
  } else {
    media.append(swatch(item.title));
  }

  // Size selection, when the catalogue provides sizes.
  const sizes = $('#qvSizes');
  sizes.replaceChildren();
  let chosenSize = '';
  if (item.sizes?.length) {
    const label = document.createElement('span');
    label.className = 'eyebrow';
    label.textContent = 'Size';
    sizes.append(label);

    item.sizes.forEach((size, i) => {
      const chip = document.createElement('button');
      chip.type = 'button';
      chip.className = 'chip';
      chip.textContent = size;
      chip.setAttribute('aria-pressed', String(i === 0));
      if (i === 0) chosenSize = size;
      chip.addEventListener('click', () => {
        chosenSize = size;
        $$('.chip', sizes).forEach((c) => c.setAttribute('aria-pressed', String(c === chip)));
      });
      sizes.append(chip);
    });
  }

  const add = $('#qvAdd');
  add.disabled = !item.available;
  add.textContent = item.available ? 'Add to basket' : 'Already sold';
  add.onclick = () => {
    cart.add(item, { size: chosenSize });
    closeQuickview();
    openCart();
  };

  dialog.dataset.open = 'true';
  dialog.setAttribute('aria-hidden', 'false');
  if (scrim) { scrim.hidden = false; scrim.dataset.open = 'true'; }
  document.body.classList.add('is-locked');
  releaseFocus = trapFocus(dialog, { onEscape: closeQuickview });
}

function closeQuickview() {
  const dialog = $('#quickview');
  const scrim = $('#scrim');
  if (!dialog || dialog.dataset.open !== 'true') return;

  dialog.dataset.open = 'false';
  dialog.setAttribute('aria-hidden', 'true');
  if (scrim) {
    scrim.dataset.open = 'false';
    setTimeout(() => { if (scrim.dataset.open !== 'true') scrim.hidden = true; }, 300);
  }
  document.body.classList.remove('is-locked');
  releaseFocus?.();
  releaseFocus = null;
}

/* ------------------------------------------------------------------ init */

export function initShop() {
  if (!grid) return;

  searchEl?.addEventListener(
    'input',
    debounce((e) => { state.query = e.target.value; apply(); }, 180)
  );

  sortEl?.addEventListener('change', (e) => { state.sort = e.target.value; apply(); });

  $('[data-close-quickview]')?.addEventListener('click', closeQuickview);
  $('#quickview')?.addEventListener('click', (e) => {
    if (e.target === e.currentTarget) closeQuickview();
  });

  load();
}

export { closeQuickview };
