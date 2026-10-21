import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { createKvSim, toyCacheValue } from '../labs/attention/kv-sim.js';
import {
  CHECK_CONFIG, comparisonRows, decodeView, fullRunPasses, parseCount, projectionTotals, sliceView,
} from '../labs/attention/lesson-4.js';
import { evaluateChoice } from '../labs/attention/ui.js';

test('hierarchy slice indexes [L, T, H_KV, D] down to [H_KV, D] toy values', () => {
  const view = sliceView({ kind: 'v', layer: 2, position: 3 });
  assert.deepEqual(view.shape, [2, 4]);
  assert.deepEqual(view.fullShape, [4, 4, 2, 4]);
  assert.equal(view.elements, 8);
  assert.equal(view.bytes, 16);
  assert.equal(view.fullElements, 128);
  assert.equal(view.values[1][3], toyCacheValue('v', 2, 3, 1, 3));
  assert.match(view.path, /V_cache\[ℓ=2, t=3, :, :\]/);
  assert.throws(() => sliceView({ kind: 'q', layer: 0, position: 0 }), /kind/);
  assert.throws(() => sliceView({ kind: 'k', layer: 4, position: 0 }), /layer/);
});

test('decode view after prefill: cache = prompt, pending token not cached, no stages', () => {
  const snap = createKvSim().prefill();
  const view = decodeView(snap);
  assert.equal(view.cacheLength, 4);
  assert.equal(view.rows.length, snap.cacheLength);
  assert.ok(view.rows.every((r) => r.status === 'prefill'));
  assert.deepEqual(view.pending, { token: 'and', position: 4, cached: false });
  assert.ok(!view.rows.some((r) => r.position === view.pending.position));
  assert.equal(view.stages.length, 0);
  assert.match(view.summary, /cache length 4/);
});

test('decode view mirrors every kv-sim snapshot step by step', () => {
  const sim = createKvSim();
  let snap = sim.prefill();
  let steps = 0;
  while (snap.canStep) {
    snap = sim.step();
    steps += 1;
    const view = decodeView(snap);
    const pass = snap.lastPass;
    const p = pass.positions[0];
    assert.equal(view.cacheLength, snap.cacheLength);
    assert.equal(view.cacheLength, snap.prompt.length + steps, 'cache length = positions processed');
    assert.equal(view.rows.length, snap.cache.length);
    view.rows.forEach((row, i) => {
      assert.equal(row.position, snap.cache[i].position);
      assert.deepEqual(row.k, snap.cache[i].k);
      assert.deepEqual(row.v, snap.cache[i].v);
    });
    assert.deepEqual(view.rows.filter((r) => r.status === 'new').map((r) => r.position), [p]);
    assert.equal(view.rows.filter((r) => r.status === 'reused').length, pass.cacheReads);
    if (snap.pending) {
      assert.equal(view.pending.token, snap.pending.token);
      assert.equal(view.pending.cached, false);
      assert.ok(!snap.cache.some((e) => e.position === snap.pending.position), 'pending token has no cache entry');
      assert.equal(snap.pending.position, snap.cacheLength);
    } else {
      assert.equal(view.pending, null);
      assert.equal(view.done, true);
    }
    assert.deepEqual(view.stages.map((s) => s.id), ['input', 'query', 'new-kv', 'read', 'attend', 'append', 'predict']);
    const attend = view.stages.find((s) => s.id === 'attend');
    assert.equal(attend.weights.length, pass.keysAttended);
    assert.equal(attend.weights.filter((w) => w.source === 'new').length, 1);
    assert.equal(attend.weights.at(-1).position, p);
    assert.deepEqual(attend.weights.map((w) => w.weight), [...pass.attention.weights]);
  }
  assert.equal(steps, 5);
  assert.equal(snap.phase, 'done');
  assert.match(decodeView(snap).summary, /End of the toy continuation/);
});

test('comparison rows match kv-sim pass counters and closed-form totals', () => {
  const rows = comparisonRows(fullRunPasses());
  assert.deepEqual(rows.map((r) => r.projectedWith), [4, 1, 1, 1, 1, 1]);
  assert.deepEqual(rows.map((r) => r.projectedWithout), [4, 5, 6, 7, 8, 9]);
  assert.deepEqual(rows.map((r) => r.cacheReads), [0, 4, 5, 6, 7, 8]);
  assert.deepEqual(rows.map((r) => r.keysAttended), [10, 5, 6, 7, 8, 9]);
  assert.deepEqual(rows.map((r) => r.cacheEntriesAfter), [4, 5, 6, 7, 8, 9]);
  const last = rows.at(-1);
  const totals = projectionTotals({ promptLength: 4, steps: 5 });
  assert.equal(totals.withCache, last.cumWith);
  assert.equal(totals.withoutCache, last.cumWithout);
  assert.equal(totals.cacheReads, rows.reduce((s, r) => s + r.cacheReads, 0));
  assert.equal(totals.decodeKeysAttended + totals.prefillKeysAttended, rows.reduce((s, r) => s + r.keysAttended, 0));
  assert.equal(totals.cacheEntries, last.cacheEntriesAfter);
});

test('closed-form totals: linear with cache, quadratic without; inputs validated', () => {
  const a = projectionTotals({ promptLength: 100, steps: 1000 });
  const b = projectionTotals({ promptLength: 100, steps: 2000 });
  assert.equal(b.withCache - 100, 2 * (a.withCache - 100));
  assert.ok(b.withoutCache > 3 * a.withoutCache);
  assert.throws(() => projectionTotals({ promptLength: 0, steps: 1 }));
  assert.deepEqual(parseCount('1,000', 'n'), { value: 1000 });
  assert.match(parseCount('2.5', 'n').error, /whole number/);
  assert.match(parseCount('0', 'n').error, /whole number/);
});

test('knowledge check rewards the new-query reasoning and explains misconceptions', () => {
  assert.equal(evaluateChoice({ selected: 'new-query', correct: CHECK_CONFIG.correct }).status, 'correct');
  for (const id of ['outputs', 'eliminates', 'stale', 'queries']) {
    const result = evaluateChoice({ selected: id, correct: CHECK_CONFIG.correct, misconceptions: CHECK_CONFIG.misconceptions });
    assert.equal(result.status, 'incorrect');
    assert.ok(result.message.length > 20);
  }
  assert.match(CHECK_CONFIG.options[0].label, /new query/);
});

test('lesson page wires every widget container and states counter definitions', () => {
  const html = readFileSync('labs/attention/lesson-4.html', 'utf8');
  for (const id of ['hier-keys', 'hier-values', 'hier-slice', 'prefill-mask', 'prefill-cache', 'decode-step', 'decode-reset', 'decode-cache', 'decode-stages', 'decode-output', 'compare-table', 'ext-prompt', 'ext-steps', 'kv-check']) {
    assert.match(html, new RegExp(`id="${id}"`), id);
  }
  assert.match(html, /token positions whose K\/V projections are computed in that forward pass/);
  assert.match(html, /not a universal memory layout/);
  assert.doesNotMatch(html, /LESSON CONTENT/);
});
