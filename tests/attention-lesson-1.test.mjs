import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import * as math from '../labs/attention/attention-math.js';
import {
  TOY, SENTENCE, SCALING, CHECK_CONFIG, contextFor, projections, projectionSteps, parseQueryComponent,
  scoreBreakdown, softmaxBreakdown, scalingExample, maskExample, outputRow, proseNumbers,
} from '../labs/attention/lesson-1.js';

const html = readFileSync('labs/attention/lesson-1.html', 'utf8');
const close = (a, b, eps = 1e-12) => assert.ok(Math.abs(a - b) <= eps, `${a} ≈ ${b}`);

test('every number written into the lesson prose matches the math module', () => {
  const numbers = proseNumbers();
  const spans = [...html.matchAll(/<span class="num" data-num="([^"]+)">([^<]*)<\/span>/g)];
  assert.ok(spans.length >= 40, `expected many computed prose numbers, found ${spans.length}`);
  for (const [, key, text] of spans) {
    assert.ok(key in numbers, `unknown data-num key ${key}`);
    assert.equal(text, numbers[key], `prose number ${key}`);
  }
  const used = new Set(spans.map((m) => m[1]));
  for (const key of Object.keys(numbers)) assert.ok(used.has(key), `computed number ${key} is never shown`);
  assert.doesNotMatch(html, /data-num="[^"]+"(?! *>)/, 'data-num only on plain spans');
});

test('toy projections are consistent with X·W and the spec dot-product example', () => {
  const { Q, K, V } = projections();
  assert.deepEqual(Q, [[1, 0], [0, 2], [1, 2]]);
  assert.deepEqual(K, [[2, 1], [-1, 2], [1, 3]]);
  assert.deepEqual(V, [[1, -1], [0, 2], [1, 1]]);
  // Linear: x3 = x1 + x2, so every projection of row 3 is the sum of rows 1 and 2.
  for (const M of [Q, K, V]) assert.deepEqual(M[2], M[0].map((x, c) => x + M[1][c]));
  const steps = projectionSteps(TOY.X[2], TOY.WK);
  assert.deepEqual(steps.map((s) => s.value), K[2]);
  assert.deepEqual(steps[0].terms, [[1, 2], [1, -1]]);
  const br = scoreBreakdown([1, 2], [[2, 1], [-1, 2]]);
  assert.deepEqual(br.rows.map((r) => r.score), [4, 3]);
  assert.deepEqual(br.rows[0].products, [2, 2]);
  assert.deepEqual(br.rows[1].products, [-1, 4]);
  // q = [2, 1]: k1 aligned (cosine 1) ties with longer, less aligned k3 — used in the "Try" text.
  const tie = scoreBreakdown([2, 1], K);
  assert.equal(tie.rows[0].score, tie.rows[2].score);
  close(tie.rows[0].cosine, 1);
  assert.ok(tie.rows[2].cosine < 0.75);
  assert.equal(scoreBreakdown([0, 0], K).rows[0].cosine, null);
});

test('softmax breakdown is the stable softmax, shown step by step', () => {
  const { Q, K } = projections();
  const scores = math.rawScores(Q, K)[2];
  const sm = softmaxBreakdown(scores, math.defaultScale(2));
  assert.deepEqual(sm.weights, math.attention(Q, K, [[1], [1], [1]]).weights[2]);
  assert.equal(Math.max(...sm.shifted), 0);
  close(sm.weights.reduce((a, b) => a + b, 0), 1);
  sm.exps.forEach((e, j) => close(e / sm.sum, sm.weights[j]));
  // Large scores stay finite thanks to the max shift.
  const big = softmaxBreakdown([1000, 999], 1);
  assert.ok(big.weights.every(Number.isFinite));
});

test('scaling example: q·k = 16 − 2f and scaling flattens a saturated softmax', () => {
  const ex = scalingExample();
  assert.equal(ex.q.length, SCALING.dk);
  assert.deepEqual(ex.raw, SCALING.flips.map((f) => 16 - 2 * f));
  assert.equal(ex.scale, 0.25);
  assert.deepEqual(ex.scaled.scaled, [2, 1, 0, -1]);
  assert.ok(ex.unscaled.weights[0] > 0.98);
  assert.ok(ex.scaled.weights[0] < 0.65);
  assert.ok(ex.unscaled.weights.every((w) => w > 0), 'unscaled weights are tiny but not zero');
  close(ex.slopeUnscaled, ex.unscaled.weights[0] * (1 - ex.unscaled.weights[0]));
  close(ex.slopeScaled, 0.25 * ex.scaled.weights[0] * (1 - ex.scaled.weights[0]));
  assert.ok(ex.slopeScaled > ex.slopeUnscaled);
});

test('causal mask gives exact zeros above the diagonal; bidirectional has none', () => {
  const causal = maskExample({ causal: true });
  const bidir = maskExample({ causal: false });
  const T = TOY.tokens4.length;
  for (let i = 0; i < T; i += 1) {
    close(causal.weights[i].reduce((a, b) => a + b, 0), 1);
    for (let j = 0; j < T; j += 1) {
      if (j > i) {
        assert.ok(Object.is(causal.weights[i][j], 0), `A[${i}][${j}] must be exactly 0`);
        assert.equal(causal.masked[i][j], -Infinity);
      } else assert.ok(causal.weights[i][j] > 0);
      assert.ok(bidir.weights[i][j] > 0);
    }
  }
  assert.deepEqual(causal.weights[T - 1], bidir.weights[T - 1]);
  assert.deepEqual(causal.weights[0], [1, 0, 0, 0]);
});

test('O = AV rows equal the sum of weighted value contributions', () => {
  for (let i = 0; i < 4; i += 1) {
    const r = outputRow(i);
    r.output.forEach((x, c) => close(x, r.O[i][c]));
    r.output.forEach((x, c) => close(x, r.contributions.reduce((s, row) => s + row[c], 0)));
    r.rest.forEach((x, c) => close(x + r.contributions[r.top][c], r.output[c]));
  }
  const first = outputRow(0);
  assert.deepEqual(first.output, first.V[0]);
  const last = outputRow(3);
  assert.equal(TOY.tokens4[last.top], 'tired');
  assert.ok(last.rest.some((x) => Math.abs(x) > 0.01), 'other positions contribute too');
});

test('query inputs are validated and context visibility is causal', () => {
  assert.deepEqual(parseQueryComponent('2.5'), { ok: true, value: 2.5 });
  assert.deepEqual(parseQueryComponent('−1'), { ok: true, value: -1 });
  assert.equal(parseQueryComponent('').ok, false);
  assert.equal(parseQueryComponent('abc').ok, false);
  assert.equal(parseQueryComponent('4.5').ok, false);
  assert.equal(parseQueryComponent('1.25').ok, false);
  const ctx = contextFor(5);
  assert.equal(ctx[5].status, 'query');
  assert.equal(ctx.filter((c) => c.status === 'visible').length, 5);
  assert.equal(ctx.filter((c) => c.status === 'future').length, SENTENCE.length - 6);
  assert.ok(contextFor(5, { causal: false }).every((c) => c.status !== 'future'));
  assert.throws(() => contextFor(SENTENCE.length), /position/);
});

test('lesson page structure: guided labs, mounts, knowledge checks and citation', () => {
  for (const id of ['lab-context', 'lab-proj', 'lab-scores', 'lab-softmax', 'lab-scale', 'lab-mask', 'lab-output', 'l1-checks']) {
    assert.match(html, new RegExp(`id="${id}"`), id);
  }
  const labs = html.split('<div class="lab" ').slice(1);
  assert.equal(labs.length, 7);
  for (const lab of labs) {
    for (const dt of ['What this shows', 'Try', 'What to notice']) assert.ok(lab.includes(`<dt>${dt}</dt>`), dt);
    assert.match(lab, /class="lab-assumptions">Assumptions:/);
  }
  assert.match(html, /arxiv\.org\/abs\/1706\.03762/);
  assert.doesNotMatch(html, /LESSON CONTENT/);
  assert.equal(CHECK_CONFIG.length, 3);
  for (const check of CHECK_CONFIG) {
    assert.ok(check.options.some((o) => o.id === check.correct));
    assert.ok(check.explanationHtml.length > 100);
    for (const id of Object.keys(check.misconceptions)) assert.ok(check.options.some((o) => o.id === id));
  }
  assert.notEqual(new Set(CHECK_CONFIG.map((c) => c.options.findIndex((o) => o.id === c.correct))).size, 1, 'answers not all in the same position');
});
