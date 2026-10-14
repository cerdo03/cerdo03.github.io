import test from 'node:test';
import assert from 'node:assert/strict';

let model = {};
try { model = await import('../labs/scion/model.js'); } catch { /* Missing implementation is asserted below. */ }

test('cache lookup stops at the closest copy and warms only the downstream path', () => {
  assert.equal(typeof model.fetchObject, 'function');
  const cold = model.fetchObject([false, false, true], false);
  assert.deepEqual(cold.visited, [0, 1, 2]);
  assert.deepEqual(cold.after, [true, true, true]);
  assert.deepEqual(model.fetchObject(cold.after, false).visited, [0]);
  assert.deepEqual(model.fetchObject([false, true, true], false).visited, [0, 1]);
});

test('failed regional tier blocks upstream fallback but local hits still work', () => {
  assert.equal(typeof model.fetchObject, 'function');
  const blocked = model.fetchObject([false, false, true], true);
  assert.equal(blocked.blocked, true);
  assert.deepEqual(blocked.visited, [0, 1]);
  assert.deepEqual(blocked.after, [false, false, true]);
  assert.equal(model.fetchObject([true, false, true], true).blocked, false);
});

test('publishing main requires the expected old value; losing update cannot overwrite it', () => {
  assert.equal(typeof model.moveMain, 'function');
  assert.deepEqual(model.moveMain('A', 'A', 'B'), { main: 'B', accepted: true });
  assert.deepEqual(model.moveMain('B', 'A', 'C'), { main: 'B', accepted: false });
});

test('only valid lesson positions can be restored', () => {
  assert.equal(typeof model.safePosition, 'function');
  for (const value of [-1, 90, NaN, 2.5, 'oops', null]) assert.equal(model.safePosition(value, 10), 0);
  assert.equal(model.safePosition(9, 10), 9);
});
