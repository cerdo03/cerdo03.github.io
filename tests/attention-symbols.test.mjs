import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { glossary, symbolKey, tensorKey, tensorRoles } from '../labs/attention/glossary.js';

const fakeVar = (text, sub) => ({
  textContent: text,
  nextSibling: sub === undefined ? null : { nodeType: 1, tagName: 'SUB', textContent: sub },
});

test('symbol keys join subscripts and ignore context-dependent letters', () => {
  assert.equal(symbolKey(fakeVar('H', 'KV')), 'H_KV');
  assert.equal(symbolKey(fakeVar('d', 'model')), 'd_model');
  assert.equal(symbolKey(fakeVar('T')), 'T');
  assert.equal(symbolKey(fakeVar('i')), null);
  assert.equal(symbolKey(fakeVar('q', '3')), null);
  assert.equal(tensorKey({ classList: ['tensor-tag', 't-w'] }), 'A');
  for (const key of Object.values(tensorRoles)) assert.ok(glossary[key]);
});

test('notation table symbols all have a shared definition', () => {
  const html = readFileSync('labs/attention/index.html', 'utf8');
  const symbols = [...html.matchAll(/<var>([^<]+)<\/var>(?:<sub>([^<]+)<\/sub>)?/g)].map(([, base, sub]) => (sub ? `${base}_${sub}` : base));
  for (const key of ['T', 'd_model', 'd_k', 'd_v', 'H', 'H_KV', 'D', 'L', 'B']) assert.ok(symbols.includes(key) && glossary[key], key);
  assert.equal(glossary.B, 'Bytes per stored element (2 for BF16/FP16)');
});

test('every Module 2 page loads the shared symbol explanations', () => {
  assert.match(readFileSync('labs/attention/site.js', 'utf8'), /import '\.\/symbols\.js'/);
  for (const page of ['index', 'lesson-1', 'lesson-2', 'lesson-3', 'lesson-4', 'lesson-5']) {
    assert.match(readFileSync(`labs/attention/${page}.html`, 'utf8'), /src="site\.js"/, page);
  }
});
