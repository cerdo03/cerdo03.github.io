import test from 'node:test';
import assert from 'node:assert/strict';
import { merkleDiff, handoff, repairVersions } from '../labs/dynamo/repair.js';
test('Merkle comparison descends differing branches and detects missing keys', () => {
  assert.deepEqual(merkleDiff({a:'1',b:'2',c:'3',d:'4'}, {a:'1',b:'9',c:'3'}).keys, ['b','d']);
  assert.equal(merkleDiff({a:'1'}, {a:'1'}).comparisons, 1);
});
test('handoff retains hint until recipient confirms', () => {
  const hint = { home: 'A', value: 'book' };
  assert.deepEqual(handoff(hint, false), { hint, delivered: null });
  assert.deepEqual(handoff(hint, true), { hint: null, delivered: 'book' });
});
test('repair retains concurrent siblings and removes stale ancestor', () => {
  const versions = [{clock:{A:1}}, {clock:{A:2,B:1}}, {clock:{A:2,C:1}}];
  assert.deepEqual(repairVersions(versions), versions.slice(1));
});
