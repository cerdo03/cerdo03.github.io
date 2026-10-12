import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import {
  D_MODEL, HEAD_OPTIONS, TOY, CHECK_CONFIG, headStats, shapeStages, headColumnRanges,
  describePartition, parseIntegerField, toyMultiHead, checkAnswers,
} from '../labs/attention/lesson-2.js';
import { mhaShapes } from '../labs/attention/attention-math.js';

const html = readFileSync('labs/attention/lesson-2.html', 'utf8');

test('head options are exactly the divisors of 512 from 1 to 64', () => {
  assert.deepEqual([...HEAD_OPTIONS], [1, 2, 4, 8, 16, 32, 64]);
  for (const h of HEAD_OPTIONS) assert.equal(D_MODEL % h, 0);
  for (const h of HEAD_OPTIONS) assert.match(html, new RegExp(`name="mha-heads" value="${h}"`));
});

test('d_head follows d_model / H and the projection parameter count is independent of H', () => {
  const expected = { 1: 512, 2: 256, 4: 128, 8: 64, 16: 32, 32: 16, 64: 8 };
  for (const h of HEAD_OPTIONS) {
    const s = headStats({ T: 1024, heads: h });
    assert.equal(s.headDim, expected[h]);
    assert.equal(s.projectionParams, 4 * 512 * 512);
    assert.equal(s.projectionParams, 1048576);
    assert.equal(s.scoreElements, h * 1024 * 1024);
    assert.equal(s.scoreMultiplyAdds, 1024 * 1024 * 512);
    assert.equal(s.conventional, true);
  }
  assert.equal(headStats({ T: 1024, heads: 8 }).scoreElements, 8388608);
  assert.equal(headStats({ T: 1024, heads: 64 }).scoreElements, 67108864);
  assert.equal(headStats({ T: 1024, heads: 8 }).scoreBytes, 16777216);
});

test('displayed shape stages for 512 / 8 / 64 match the lesson diagram', () => {
  const stages = shapeStages(mhaShapes({ T: 10, dModel: 512, heads: 8 }));
  const byId = Object.fromEntries(stages.map((s) => [s.id, s.shape]));
  assert.deepEqual(stages.map((s) => s.id), ['input', 'project', 'reshape', 'transpose', 'scores', 'heads', 'concat', 'output']);
  assert.deepEqual(byId.input, [10, 512]);
  assert.deepEqual(byId.project, [10, 512]);
  assert.deepEqual(byId.reshape, [10, 8, 64]);
  assert.deepEqual(byId.transpose, [8, 10, 64]);
  assert.deepEqual(byId.scores, [8, 10, 10]);
  assert.deepEqual(byId.heads, [8, 10, 64]);
  assert.deepEqual(byId.concat, [10, 512]);
  assert.deepEqual(byId.output, [10, 512]);
  assert.deepEqual(stages.find((s) => s.id === 'transpose').symbolic, ['H', 'T', 'd_head']);
});

test('independent d_head changes W_O and parameters but keeps the output width', () => {
  const s = headStats({ T: 10, heads: 8, headDim: 128 });
  assert.equal(s.conventional, false);
  assert.deepEqual(s.shapes.wq, [512, 1024]);
  assert.deepEqual(s.shapes.wo, [1024, 512]);
  assert.deepEqual(s.shapes.concat, [10, 1024]);
  assert.deepEqual(s.shapes.output, [10, 512]);
  assert.equal(s.projectionParams, 2097152);
  const stages = shapeStages(s.shapes);
  assert.deepEqual(stages.find((x) => x.id === 'project').symbolic, ['T', 'H·d_head']);
  assert.match(stages.find((x) => x.id === 'output').op, /\[1024, 512\]/);
});

test('column partition and its text equivalent', () => {
  assert.deepEqual(headColumnRanges(8, 64)[1], { head: 2, first: 64, last: 127 });
  assert.equal(headColumnRanges(8, 64)[7].last, 511);
  assert.match(describePartition(8, 64), /512 columns split into 8 contiguous slices of 64: head 1 owns columns 0–63; head 2 owns columns 64–127; … ; head 8 owns columns 448–511\./);
  assert.match(describePartition(1, 512), /single head/);
  assert.match(describePartition(2, 256), /head 2 owns columns 256–511/);
});

test('integer fields are validated with clear messages', () => {
  assert.deepEqual(parseIntegerField('1,024', { name: 'T', min: 1, max: 8192 }), { value: 1024 });
  assert.match(parseIntegerField('', { name: 'T', min: 1, max: 8192 }).error, /whole number/);
  assert.match(parseIntegerField('2.5', { name: 'T', min: 1, max: 8192 }).error, /whole number/);
  assert.match(parseIntegerField('0', { name: 'T', min: 1, max: 8192 }).error, /between 1 and 8,192/);
});

test('toy two-head example: same X, different weight rows, correct concat and output', () => {
  const r = toyMultiHead();
  assert.equal(r.perHead.length, 2);
  const [a1, a2] = r.perHead.map((h) => h.weights);
  // Causal: t0 attends only to itself in both heads; masked weights are exactly 0.
  assert.deepEqual(a1[0], [1, 0, 0]);
  assert.deepEqual(a2[0], [1, 0, 0]);
  assert.equal(a1[1][2], 0);
  // Query t2 differs between heads (head 1 favours t0 and t2, head 2 favours t1 and t2).
  assert.ok(Math.abs(a1[2][0] - 0.446) < 1e-3 && Math.abs(a1[2][1] - 0.108) < 1e-3);
  assert.ok(Math.abs(a2[2][0] - 0.108) < 1e-3 && Math.abs(a2[2][1] - 0.446) < 1e-3);
  for (const row of [...a1, ...a2]) assert.ok(Math.abs(row.reduce((x, y) => x + y, 0) - 1) < 1e-12);
  // Concat is [3, 4] with head 1 in columns 0–1 and head 2 in columns 2–3.
  assert.equal(r.concat.length, 3);
  r.concat.forEach((row, i) => assert.deepEqual(row, [...r.perHead[0].output[i], ...r.perHead[1].output[i]]));
  // Output = concat · W_O.
  r.output.forEach((row, i) => row.forEach((x, j) => {
    const expected = r.concat[i].reduce((sum, c, k) => sum + c * TOY.WO[k][j], 0);
    assert.ok(Math.abs(x - expected) < 1e-12);
  }));
});

test('knowledge-check answers for d_model 4096, H 32, T 10', () => {
  assert.deepEqual({ ...CHECK_CONFIG }, { dModel: 4096, heads: 32, T: 10 });
  const a = checkAnswers();
  assert.equal(a.headDim, 128);
  assert.deepEqual(a.perHeadQ, [10, 128]);
  assert.deepEqual(a.scores, [32, 10, 10]);
  assert.equal(a.scoreElements, 3200);
  assert.deepEqual(a.concat, [10, 4096]);
  assert.equal(a.projectionParams, 67108864);
});

test('page cites Vaswani et al., links back to lesson 2.1 and states the limits', () => {
  assert.match(html, /arxiv\.org\/abs\/1706\.03762/);
  assert.match(html, /href="lesson-1\.html#s2-1-8"/);
  assert.match(html, /More heads does not mean better quality/);
  assert.match(html, /lesson-2\.css/);
  assert.doesNotMatch(html, /style="/);
  for (const id of ['mha-explorer', 'mha-stages', 'mha-partition', 'mha-partition-text', 'toy-heads', 'check-dhead', 'check-scores', 'check-params', 'check-double']) {
    assert.match(html, new RegExp(`id="${id}"`));
  }
});
