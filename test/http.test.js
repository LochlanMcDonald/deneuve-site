'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { after, before } = require('node:test');

const { createApp } = require('../src/app');

let server;
let base;

before(async () => {
  server = createApp({ quiet: true }).listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  base = `http://127.0.0.1:${server.address().port}`;
});

after(() => server?.close());

test('GET /api/health reports ok', async () => {
  const res = await fetch(`${base}/api/health`);
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.status, 'ok');
  assert.equal(typeof body.uptime, 'number');
});

test('every response carries the security headers', async () => {
  const res = await fetch(`${base}/api/health`);
  const csp = res.headers.get('content-security-policy');
  assert.match(csp, /default-src 'self'/);
  assert.match(csp, /script-src 'self'/);
  assert.match(csp, /frame-ancestors 'none'/);
  assert.equal(res.headers.get('x-content-type-options'), 'nosniff');
  assert.equal(res.headers.get('x-frame-options'), 'DENY');
  assert.equal(res.headers.get('referrer-policy'), 'strict-origin-when-cross-origin');
  assert.equal(res.headers.get('x-powered-by'), null);
});

test('the shop page is served and is not cached by intermediaries', async () => {
  const res = await fetch(`${base}/`);
  assert.equal(res.status, 200);
  assert.match(res.headers.get('content-type'), /text\/html/);
  assert.equal(res.headers.get('cache-control'), 'no-cache');
  const html = await res.text();
  assert.match(html, /<title>Deneuve/);
  assert.match(html, /id="products"/);
});

test('fonts are served with a long immutable cache', async () => {
  const res = await fetch(`${base}/assets/fonts/jost-latin.woff2`);
  assert.equal(res.status, 200);
  assert.match(res.headers.get('cache-control'), /immutable/);
});

test('an unknown page returns the 404 document, not a stack trace', async () => {
  const res = await fetch(`${base}/no-such-page`);
  assert.equal(res.status, 404);
  const html = await res.text();
  assert.match(html, /does not exist/);
  assert.doesNotMatch(html, /at Object|node_modules/);
});

test('an unknown API route returns JSON, not HTML', async () => {
  const res = await fetch(`${base}/api/nope`);
  assert.equal(res.status, 404);
  assert.deepEqual(await res.json(), { error: 'Not found' });
});

test('POST /api/enquiry rejects an incomplete submission', async () => {
  const res = await post('/api/enquiry', { name: '', email: 'nope', message: '' });
  assert.equal(res.status, 400);
  const body = await res.json();
  assert.equal(body.ok, false);
  assert.deepEqual(Object.keys(body.errors).sort(), ['email', 'message', 'name']);
});

test('POST /api/enquiry rejects an over-long message', async () => {
  const res = await post('/api/enquiry', {
    name: 'Simone',
    email: 'simone@example.test',
    message: 'x'.repeat(4001),
  });
  assert.equal(res.status, 400);
  assert.ok((await res.json()).errors.message);
});

test('POST /api/enquiry accepts a complete submission', async () => {
  const res = await post('/api/enquiry', {
    name: 'Simone Aubert',
    email: 'simone@example.test',
    service: 'repair',
    message: 'A 1960s wool coat with a torn lining.',
  });
  assert.equal(res.status, 202);
  assert.equal((await res.json()).ok, true);
});

test('POST /api/enquiry survives a body that is not an object', async () => {
  const res = await fetch(`${base}/api/enquiry`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: 'null',
  });
  assert.equal(res.status, 400);
});

function post(path, payload) {
  return fetch(`${base}${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  });
}
