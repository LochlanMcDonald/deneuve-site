'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { normalise, extractList } = require('../src/catalogue');

test('extractList accepts a bare array', () => {
  assert.deepEqual(extractList([{ a: 1 }]), [{ a: 1 }]);
});

test('extractList finds the list under the usual envelope keys', () => {
  for (const key of ['items', 'data', 'results', 'products', 'value']) {
    assert.deepEqual(extractList({ [key]: [{ id: 1 }] }), [{ id: 1 }], `key: ${key}`);
  }
});

test('extractList returns empty for unusable payloads', () => {
  for (const payload of [null, undefined, 42, 'nope', {}, { items: 'no' }]) {
    assert.deepEqual(extractList(payload), []);
  }
});

test('normalise maps the primary field names', () => {
  const item = normalise(
    {
      id: 'a1',
      title: 'Oxblood coat',
      description: 'Wool.',
      price: 380,
      imageUrl: 'https://example.test/a.jpg',
      category: 'Coats',
      sizes: ['S', 'M'],
    },
    0
  );
  assert.deepEqual(item, {
    id: 'a1',
    title: 'Oxblood coat',
    description: 'Wool.',
    price: 380,
    imageUrl: 'https://example.test/a.jpg',
    category: 'Coats',
    sizes: ['S', 'M'],
    available: true,
  });
});

test('normalise accepts the alternate field names upstream also uses', () => {
  const item = normalise(
    { itemId: 'b2', name: 'Button tin', details: 'Mixed horn.', amount: 22, type: 'Cloth', photo: 'x.jpg' },
    3
  );
  assert.equal(item.id, 'b2');
  assert.equal(item.title, 'Button tin');
  assert.equal(item.description, 'Mixed horn.');
  assert.equal(item.price, 22);
  assert.equal(item.category, 'Cloth');
  assert.equal(item.imageUrl, 'x.jpg');
});

test('normalise falls back to a positional id when none is supplied', () => {
  assert.equal(normalise({ title: 'No id' }, 7).id, 'item-7');
});

test('normalise nulls a price it cannot trust rather than showing $NaN', () => {
  for (const price of ['not a number', undefined, -5, null]) {
    assert.equal(normalise({ title: 'x', price }, 0).price, null, `price: ${price}`);
  }
  assert.equal(normalise({ title: 'x', price: '19.99' }, 0).price, 19.99);
  assert.equal(normalise({ title: 'x', price: 0 }, 0).price, 0);
});

test('normalise defaults the fields the card always renders', () => {
  const item = normalise({}, 0);
  assert.equal(item.title, 'Untitled piece');
  assert.equal(item.category, 'Atelier');
  assert.equal(item.description, '');
  assert.equal(item.imageUrl, '');
  assert.deepEqual(item.sizes, []);
});

test('normalise treats only an explicit flag as unavailable', () => {
  assert.equal(normalise({ title: 'x' }, 0).available, true);
  assert.equal(normalise({ title: 'x', available: false }, 0).available, false);
  assert.equal(normalise({ title: 'x', inStock: false }, 0).available, false);
  assert.equal(normalise({ title: 'x', available: true }, 0).available, true);
});

test('normalise ignores a non-array sizes value', () => {
  assert.deepEqual(normalise({ title: 'x', sizes: 'M' }, 0).sizes, []);
});
