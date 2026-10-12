import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import {
  DEFAULT_CONFIG, EXERCISE, EXERCISE_UNITS, EXERCISE_MISCONCEPTIONS, PRESETS, PRECISIONS, CHART_DEFAULTS,
  validateConfig, computeKvMemory, describeBytes, chartData, niceStep, blockRoundedTokens, fmtTokens, separateLabels, parseIntegerField,
} from '../labs/attention/lesson-5.js';
import { evaluateNumeric } from '../labs/attention/ui.js';

const html = readFileSync('labs/attention/lesson-5.html', 'utf8');

test('default worked example is exactly 536,870,912 bytes = 512 MiB', () => {
  const m = computeKvMemory(DEFAULT_CONFIG);
  assert.equal(m.perTokenLayer, 4096);
  assert.equal(m.perToken, 131072);
  assert.equal(m.perSequence, 536870912);
  assert.equal(m.keysPerSequence, 268435456);
  assert.equal(m.valuesPerSequence, 268435456);
  assert.equal(m.total, 536870912);
  const d = describeBytes(m.perSequence);
  assert.equal(d.bytes, '536,870,912 B');
  assert.equal(d.binary, '512 MiB');
  assert.equal(d.decimal, '536.87 MB');
});

test('the HTML form defaults match the worked example', () => {
  for (const [id, value] of [['calc-layers', 32], ['calc-kv-heads', 8], ['calc-head-dim', 128], ['calc-seq-len', 4096], ['calc-sequences', 1]]) {
    assert.match(html, new RegExp(`id="${id}"[^>]*value="${value}"`), id);
  }
  assert.match(html, /<option value="2" selected>/);
  const result = validateConfig({ layers: '32', kvHeads: '8', headDim: '128', seqLen: '4,096', bytesPerElem: '2', sequences: '1' });
  assert.equal(result.ok, true);
  assert.equal(computeKvMemory(result.config).total, 536870912);
});

test('exercise: 40/8/128/BF16, 50 × 8000 → 65,536,000,000 B ≈ 65.54 GB ≈ 61.04 GiB', () => {
  const m = computeKvMemory(EXERCISE);
  assert.equal(m.total, 65536000000);
  assert.equal(m.perSequence, 1310720000);
  assert.equal(describeBytes(m.total).decimal, '65.54 GB');
  assert.equal(describeBytes(m.total).binary, '61.04 GiB');
});

test('exercise grading accepts units within ~1% and diagnoses common mistakes', () => {
  const grade = (text, unitLabel) => evaluateNumeric({ text, unitLabel, correct: 65536000000, tolerance: 0.01, units: EXERCISE_UNITS, misconceptions: EXERCISE_MISCONCEPTIONS });
  assert.equal(grade('65.54', 'GB').status, 'correct');
  assert.equal(grade('61.04', 'GiB').status, 'correct');
  assert.equal(grade('65536', 'MB').status, 'correct');
  assert.equal(grade('62500', 'MiB').status, 'correct');
  assert.equal(grade('65,536,000,000', 'B').status, 'correct');
  assert.equal(grade('65.5', 'GB').status, 'correct');
  assert.match(grade('32.77', 'GB').message, /factor 2/);
  assert.match(grade('1.6384', 'GB').message, /L = 40/);
  assert.match(grade('1.31', 'GB').message, /N = 50/);
  assert.match(grade('131.07', 'GB').message, /FP32/);
  assert.match(grade('61.04', 'GB').message, /GiB figure but selected GB/);
  assert.match(grade('65.54', 'GiB').message, /GB figure but selected GiB/);
  assert.match(grade('62500', 'MB').message, /MiB figure but selected MB/);
  assert.match(grade('65536', 'MiB').message, /MB figure but selected MiB/);
  assert.equal(grade('abc', 'GB').status, 'invalid');
  assert.deepEqual(EXERCISE_UNITS.map((u) => u.label), ['B', 'MB', 'MiB', 'GB', 'GiB']);
});

test('aggregate scales with N and K/V halves stay equal', () => {
  const m = computeKvMemory({ ...DEFAULT_CONFIG, sequences: 32 });
  assert.equal(m.total, 32 * 536870912);
  assert.equal(describeBytes(m.total).binary, '16 GiB');
  assert.equal(m.keysTotal + m.valuesTotal, m.total);
  assert.equal(computeKvMemory({ ...DEFAULT_CONFIG, bytesPerElem: 4 }).perSequence, 2 * 536870912);
  assert.equal(computeKvMemory({ ...DEFAULT_CONFIG, bytesPerElem: 1 }).perSequence, 536870912 / 2);
});

test('presets are labelled as styles and MHA-style needs 4× the GQA-style example', () => {
  const a = PRESETS.find((p) => p.id === 'a');
  const c = PRESETS.find((p) => p.id === 'c');
  const mem = (p) => computeKvMemory({ ...DEFAULT_CONFIG, layers: p.layers, kvHeads: p.kvHeads, headDim: p.headDim }).total;
  assert.equal(mem(c) / mem(a), 4);
  for (const p of PRESETS) assert.match(p.label, /-style/);
  assert.deepEqual(PRECISIONS.map((p) => p.bytes), [4, 2, 1]);
});

test('validation rejects bad inputs with clear messages', () => {
  const bad = validateConfig({ layers: '0', kvHeads: '8.5', headDim: '', seqLen: '-3', bytesPerElem: '3', sequences: '1' });
  assert.equal(bad.ok, false);
  assert.ok(bad.errors.some((e) => e.startsWith('Layers (L): must be between 1')));
  assert.ok(bad.errors.some((e) => e.includes('KV heads (H_KV)') && e.includes('not a whole number')));
  assert.ok(bad.errors.some((e) => e.startsWith('Head dimension (D): enter a whole number')));
  assert.ok(bad.errors.some((e) => e.startsWith('Cached tokens per sequence (T)')));
  const precision = validateConfig({ ...DEFAULT_CONFIG, bytesPerElem: 3 });
  assert.equal(precision.ok, false);
  assert.match(precision.errors[0], /FP32/);
  const huge = validateConfig({ layers: 1024, kvHeads: 1024, headDim: 4096, seqLen: 10000000, bytesPerElem: 4, sequences: 100000 });
  assert.equal(huge.ok, false);
  assert.match(huge.errors[0], /too large/);
  assert.equal(parseIntegerField(' 4 096 ', 'seqLen').value, 4096);
});

test('chart data is linear from zero and compares against the reference', () => {
  const data = chartData({ ...CHART_DEFAULTS });
  const [cur, ref] = data.series;
  assert.deepEqual(data.xTicks, [0, 8192, 16384, 24576, 32768]);
  assert.equal(cur.points[0].bytes, 0);
  assert.equal(cur.points[4].bytes, 32768 * 131072); // 4 GiB
  assert.equal(ref.points[4].bytes, 4 * cur.points[4].bytes);
  assert.equal(data.unit, 'GiB');
  assert.equal(ref.points[4].value, 16);
  assert.equal(cur.points[2].bytes * 2, cur.points[4].bytes);
  assert.ok(data.yMax >= 16 && data.yMax % data.yStep === 0);
  const withN = chartData({ ...CHART_DEFAULTS, sequences: 8, maxContext: 4096 });
  assert.equal(withN.series[0].points.at(-1).bytes, 8 * 536870912);
});

test('helpers: nice steps, block rounding, labels', () => {
  assert.equal(niceStep(16, 4), 5);
  assert.equal(niceStep(4, 4), 1);
  assert.equal(niceStep(0.5, 4), 0.2);
  assert.equal(blockRoundedTokens(4097, 16), 4112);
  assert.equal(blockRoundedTokens(4096, 16), 4096);
  assert.equal(fmtTokens(32768), '32K');
  assert.equal(fmtTokens(0), '0');
  assert.deepEqual(separateLabels(100, 200), [100, 200]);
  const [a, b] = separateLabels(100, 110, 30);
  assert.ok(Math.abs(a - b) >= 30 && a < b);
});

test('lesson page states exclusions and avoids total-GPU-memory claims', () => {
  for (const term of ['model weights', 'activations', 'fragmentation', 'padding', 'allocator metadata', '2205.14135', 'docs.vllm.ai', 'not total GPU memory']) {
    assert.ok(html.includes(term), term);
  }
  assert.match(html, /536,870,912 bytes/);
  assert.doesNotMatch(html, /(?<!not )always bandwidth-bound/);
  assert.match(html, /not always bandwidth-bound/);
});

test('chart geometry follows container width within bounds', async () => {
  const { chartGeometry } = await import('../labs/attention/lesson-5.js');
  assert.equal(chartGeometry(1000).width, 640);
  assert.equal(chartGeometry(200).width, 340);
  assert.equal(chartGeometry(300).right, 118);
  assert.equal(chartGeometry(undefined).width, 640);
});
