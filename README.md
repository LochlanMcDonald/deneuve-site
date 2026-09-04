# Deneuve

Storefront for Deneuve — a tailoring atelier that styles, alters and repairs.

A small Express server and a hand-built, no-framework front end. The visual
language is 1970s screenprint: flat colour, chunky ink outlines, hard offset
shadows, halftone fields, paper grain and deliberately misregistered display
type. Every colour is sampled from the original logo artwork, so the page and
the illustration share one ink set.

## Running it

```sh
npm install
npm start          # http://localhost:3000
npm run dev        # same, with reload on change
npm test           # unit + HTTP tests
```

## Configuration

All settings are environment variables with working defaults (`src/config.js`):

| Variable | Default | Purpose |
| --- | --- | --- |
| `PORT` | `3000` | Listen port. Azure App Service sets this. |
| `NODE_ENV` | `development` | `production` also enables HSTS. |
| `ITEMS_API_URL` | the Azure catalogue service | Upstream product feed. |
| `ITEMS_API_TIMEOUT_MS` | `8000` | Upstream request timeout. |
| `ITEMS_CACHE_TTL_MS` | `300000` | How long a good response is served from memory. |
| `ITEMS_STALE_TTL_MS` | `86400000` | How long a stale response may cover an outage. |

To develop against the bundled sample catalogue instead of the live one:

```sh
npx --yes http-server test/fixtures -p 3200 &
ITEMS_API_URL=http://127.0.0.1:3200/items.json npm start
```

## Layout

```
app.js                  Entry point: listen and shut down cleanly
src/
  app.js                Builds the Express app (separate so tests can mount it)
  config.js             Environment-driven settings
  catalogue.js          Upstream fetch, normalisation, in-memory cache
  middleware.js         Security headers, request log, static cache policy
public/
  index.html            The page
  404.html 500.html     Error pages
  assets/css/           styles.css (design system) + fonts.css (self-hosted faces)
  assets/js/            theme.js (pre-paint) + ES modules: util, ui, cart, shop, forms
  assets/fonts/         Fraunces, Jost, Alfa Slab One — woff2, latin + latin-ext
  assets/img/           Derived web images. Generated; do not edit by hand.
artwork/                Full-resolution masters. Not served.
tools/build-assets.py   Regenerates public/assets/img/ from artwork/
test/                   node:test suites and a sample catalogue fixture
```

## The catalogue

The browser talks to `/api/items` on this server, never to the upstream
service directly. That removes the CORS dependency, lets one upstream call
serve every visitor, and gives the page somewhere to fall back to:

1. A fresh response is cached in memory for `ITEMS_CACHE_TTL_MS`.
2. If upstream fails, the last good response is served for up to
   `ITEMS_STALE_TTL_MS`, with `X-Catalogue-Source: stale`.
3. If there is no cache either, the endpoint returns `503` and an empty list,
   and the page shows a "we could not reach the catalogue" panel with a retry
   button. The rest of the shop still works.

Upstream field names vary, so `src/catalogue.js` normalises them
(`title`/`name`/`itemName`, `price`/`amount`/`cost`, and so on) and nulls any
price it cannot parse rather than rendering `$NaN`.

## Front-end notes

- **No build step.** Plain ES modules, served as written.
- **Theme.** Light and dark, following the OS by default, with a manual
  override in `localStorage`. `theme.js` is deliberately render-blocking so
  the page never flashes the wrong palette.
- **Progressive enhancement.** Content is all in the HTML. Scroll-reveal
  animation only hides content when scripting is confirmed available
  (`html.js`), so a blocked or failed script still leaves a readable page —
  and printing shows every section.
- **Untrusted data.** Product fields come from a service we do not control, so
  cards are built with `createElement`/`textContent`, and image URLs are
  restricted to `http(s)` and non-SVG `data:image` before reaching an `<img>`.
- **Accessibility.** Zero `axe-core` violations (WCAG 2.1 AA + best practice)
  in both themes, including the open cart drawer and quick-view dialog. Both
  dialogs trap focus and restore it on close. `prefers-reduced-motion` stops
  every animation.

## Assets

`public/assets/img/` is generated. Re-run the pipeline after changing anything
in `artwork/`:

```sh
python3 -m pip install Pillow fonttools brotli
python3 tools/build-assets.py
```

It de-mattes the cut-outs (the originals have a dark fringe that haloes on
light backgrounds), trims, resizes, quantises, and writes PNG and WebP plus
favicons and the social card. This took the two logo files from 4.9 MB to
56 kB. The script prints which format won for each image; reference that one.

## Placeholder copy

The design is finished; the words are not. These are invented and should be
replaced before the site goes live:

- "Est. 1974", "50 years at the bench", and the ticker claims
- The address, phone number and email (`128 Rue Sainte-Catherine`,
  `+1 (514) 555-0142`, `bench@deneuve.example`) — in `index.html`, the
  JSON-LD block, and `public/404.html`
- Opening hours, service descriptions and prices
- `canonical` / `og:url` / `sitemap.xml` point at
  `deneuve-shop.azurewebsites.net`; update if the site gets a real domain

`/api/enquiry` validates and logs form submissions but does not send mail —
swap the `console.log` in `src/app.js` for a mailer or CRM call.

## Deployment

`.github/workflows/main_deneuve-shop.yml` builds on every push to `main`,
runs the test suite, and deploys to the `deneuve-shop` Azure Web App.
