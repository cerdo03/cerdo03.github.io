import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createKvSim, DEFAULT_CONTINUATION, DEFAULT_PROMPT, toyCacheValue, toyProjections,
} from '../labs/attention/kv-sim.js';

test('starts empty and refuses to step before prefill', () => {
  const sim = createKvSim();
  const s = sim.snapshot();
  assert.equal(s.phase, 'empty');
  assert.equal(s.cacheLength, 0);
  assert.equal(s.canStep, false);
  assert.throws(() => sim.step(), /prefill/);
});

test('prefill caches every prompt position; the first sampled token is pending, not cached', () => {
  const sim = createKvSim();
  const s = sim.prefill(['A', 'B', 'C', 'D']);
  assert.equal(s.cacheLength, 4);
  assert.deepEqual(s.cache.map((e) => e.position), [0, 1, 2, 3]);
  assert.deepEqual(s.pending, { token: DEFAULT_CONTINUATION[0], position: 4 });
  assert.ok(!s.cache.some((e) => e.position === 4));
  assert.equal(s.lastPass.kind, 'prefill');
  assert.equal(s.lastPass.projectedWithCache, 4);
  assert.equal(s.lastPass.cacheReads, 0);
  assert.throws(() => sim.prefill(['X']), /reset/);
});

test('step appends exactly the processed pending token and samples the next', () => {
  const sim = createKvSim();
  sim.prefill(DEFAULT_PROMPT);
  const s = sim.step();
  assert.equal(s.cacheLength, 5);
  const appended = s.cache.at(-1);
  assert.equal(appended.position, 4);
  assert.equal(appended.token, DEFAULT_CONTINUATION[0]);
  const expected = toyProjections(DEFAULT_CONTINUATION[0], 4);
  assert.deepEqual(appended.k, expected.k);
  assert.deepEqual(appended.v, expected.v);
  assert.deepEqual(s.pending, { token: DEFAULT_CONTINUATION[1], position: 5 });
  assert.deepEqual(s.lastPass.readPositions, [0, 1, 2, 3]);
  assert.equal(s.lastPass.attention.weights.length, 5);
  const sum = s.lastPass.attention.weights.reduce((a, b) => a + b, 0);
  assert.ok(Math.abs(sum - 1) < 0.01);
});

test('previously cached entries never change and snapshots are immutable', () => {
  const sim = createKvSim();
  const before = sim.prefill(DEFAULT_PROMPT);
  const frozenCopy = JSON.stringify(before.cache);
  const after = sim.step();
  sim.step();
  const later = sim.snapshot();
  before.cache.forEach((entry, i) => {
    assert.equal(after.cache[i], entry);
    assert.equal(later.cache[i], entry);
  });
  assert.equal(JSON.stringify(later.cache.slice(0, 4)), frozenCopy);
  assert.equal(before.cacheLength, 4);
  assert.ok(Object.isFrozen(before.cache) && Object.isFrozen(before.cache[0]) && Object.isFrozen(before.cache[0].k));
  assert.throws(() => { before.cache[0].k[0] = 99; }, TypeError);
});

test('counters: with cache projects 1 position per decode step, without cache projects p + 1', () => {
  const sim = createKvSim();
  sim.prefill(DEFAULT_PROMPT);
  const steps = [sim.step(), sim.step(), sim.step()];
  steps.forEach((s, i) => {
    const p = 4 + i;
    assert.equal(s.lastPass.projectedWithCache, 1);
    assert.equal(s.lastPass.projectedWithoutCache, p + 1);
    assert.equal(s.lastPass.cacheReads, p);
    assert.equal(s.lastPass.keysAttended, p + 1);
  });
  const { totals } = steps.at(-1);
  assert.equal(totals.projectedWithCache, 4 + 3);
  assert.equal(totals.projectedWithoutCache, 4 + 5 + 6 + 7);
  assert.equal(totals.cacheReads, 4 + 5 + 6);
  assert.equal(totals.keysAttended, 10 + 5 + 6 + 7);
});

test('reset restores the empty state and replays deterministically', () => {
  const sim = createKvSim();
  const first = sim.prefill(DEFAULT_PROMPT);
  const firstStep = sim.step();
  const empty = sim.reset();
  assert.equal(empty.phase, 'empty');
  assert.equal(empty.cacheLength, 0);
  assert.equal(empty.pending, null);
  assert.deepEqual(empty.totals, { projectedWithCache: 0, projectedWithoutCache: 0, cacheReads: 0, keysAttended: 0 });
  assert.deepEqual(sim.prefill(DEFAULT_PROMPT), first);
  assert.deepEqual(sim.step(), firstStep);
});

test('the fixed continuation ends the run cleanly', () => {
  const sim = createKvSim({ continuation: ['x', 'y'] });
  sim.prefill(['a']);
  let s = sim.step();
  assert.equal(s.pending.token, 'y');
  s = sim.step();
  assert.equal(s.phase, 'done');
  assert.equal(s.pending, null);
  assert.equal(s.cacheLength, 3);
  assert.equal(s.canStep, false);
  assert.throws(() => sim.step(), /exhausted/);
  assert.throws(() => createKvSim({ continuation: [] }), /non-empty/);
});

test('toy cache values are deterministic and validated', () => {
  assert.equal(toyCacheValue('k', 1, 2, 0, 1), toyCacheValue('k', 1, 2, 0, 1));
  assert.notEqual(toyCacheValue('k', 0, 0, 0, 0), toyCacheValue('v', 0, 0, 0, 0));
  assert.throws(() => toyCacheValue('q', 0, 0, 0, 0), /kind/);
  assert.throws(() => toyCacheValue('k', -1, 0, 0, 0), /layer/);
});
