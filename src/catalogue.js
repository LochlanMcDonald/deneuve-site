'use strict';

const config = require('./config');

/**
 * Catalogue access with an in-memory cache.
 *
 * The browser never talks to the upstream service directly any more, which
 * removes the CORS dependency and means one slow upstream call is shared by
 * every visitor instead of repeated per page view. If upstream fails we fall
 * back to the last good response (up to `staleTtlMs`), and only then to an
 * empty catalogue — the storefront always renders.
 */

let cache = { items: null, fetchedAt: 0 };
let inFlight = null;

/** Coerce whatever shape upstream returns into one the front end can trust. */
function normalise(raw, index) {
  const pick = (...keys) => {
    for (const k of keys) {
      const v = raw?.[k];
      if (v !== undefined && v !== null && v !== '') return v;
    }
    return undefined;
  };

  const price = Number(pick('price', 'amount', 'cost'));
  const id = String(pick('id', 'itemId', '_id', 'sku') ?? `item-${index}`);

  return {
    id,
    title: String(pick('title', 'name', 'itemName') ?? 'Untitled piece'),
    description: String(pick('description', 'details', 'summary') ?? ''),
    price: Number.isFinite(price) && price >= 0 ? price : null,
    imageUrl: String(pick('imageUrl', 'image', 'imageURL', 'photo', 'thumbnail') ?? ''),
    category: String(pick('category', 'type', 'collection') ?? 'Atelier'),
    sizes: Array.isArray(raw?.sizes) ? raw.sizes.map(String) : [],
    // Anything explicitly marked unavailable stays visible but unbuyable.
    available: raw?.available !== false && raw?.inStock !== false,
  };
}

function extractList(payload) {
  if (Array.isArray(payload)) return payload;
  for (const key of ['items', 'data', 'results', 'products', 'value']) {
    if (Array.isArray(payload?.[key])) return payload[key];
  }
  return [];
}

async function fetchUpstream() {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), config.api.timeoutMs);
  try {
    const res = await fetch(config.api.itemsUrl, {
      signal: controller.signal,
      headers: { accept: 'application/json' },
    });
    if (!res.ok) throw new Error(`upstream responded ${res.status}`);
    const payload = await res.json();
    return extractList(payload).map(normalise).filter((it) => it.title);
  } finally {
    clearTimeout(timer);
  }
}

/**
 * @returns {Promise<{items: Array, source: 'cache'|'live'|'stale'|'empty', fetchedAt: number}>}
 */
async function getItems({ force = false } = {}) {
  const age = Date.now() - cache.fetchedAt;
  if (!force && cache.items && age < config.api.cacheTtlMs) {
    return { items: cache.items, source: 'cache', fetchedAt: cache.fetchedAt };
  }

  // Collapse concurrent misses into a single upstream request.
  if (!inFlight) {
    inFlight = fetchUpstream()
      .then((items) => {
        cache = { items, fetchedAt: Date.now() };
        return { items, source: 'live', fetchedAt: cache.fetchedAt };
      })
      .catch((err) => {
        if (cache.items && Date.now() - cache.fetchedAt < config.api.staleTtlMs) {
          console.warn(`[catalogue] upstream failed (${err.message}); serving stale cache`);
          return { items: cache.items, source: 'stale', fetchedAt: cache.fetchedAt };
        }
        console.error(`[catalogue] upstream failed (${err.message}); no cache available`);
        return { items: [], source: 'empty', fetchedAt: 0, error: err.message };
      })
      .finally(() => {
        inFlight = null;
      });
  }
  return inFlight;
}

module.exports = { getItems, normalise, extractList };
