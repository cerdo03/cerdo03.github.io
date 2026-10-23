import test from 'node:test';
import assert from 'node:assert/strict';
import { compareClocks, joinClocks, preferenceList } from '../labs/dynamo/model.js';

test('Figure 3 preserves branches until the reconciled D5 clock', () => {
  const d2 = { Sx: 2 };
  const d3 = { Sx: 2, Sy: 1 };
  const d4 = { Sx: 2, Sz: 1 };
  assert.equal(compareClocks(d2, d3), 'ancestor');
  assert.equal(compareClocks(d3, d4), 'concurrent');
  const context = joinClocks(d3, d4);
  assert.deepEqual(context, { Sx: 2, Sy: 1, Sz: 1 });
  const d5 = { ...context, Sx: 3 };
  assert.equal(compareClocks(d3, d5), 'ancestor');
  assert.equal(compareClocks(d4, d5), 'ancestor');
  assert.equal(compareClocks(d5, d5), 'equal');
  assert.equal(compareClocks(d5, d3), 'descendant');
});

test('replica selection wraps around and counts distinct physical owners', () => {
  const tokens = [{ position: 10, node: 'A' }, { position: 20, node: 'A' },
    { position: 40, node: 'B' }, { position: 70, node: 'C' }];
  assert.deepEqual(preferenceList(tokens, 10), ['A', 'B', 'C']);
  assert.deepEqual(preferenceList(tokens, 90), ['A', 'B', 'C']);
  assert.deepEqual(preferenceList(tokens, 41), ['C', 'A', 'B']);
  assert.deepEqual(preferenceList(tokens, 40), ['B', 'C', 'A']);
});
