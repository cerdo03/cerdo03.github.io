import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { evaluateChoice, evaluateNumeric } from '../labs/attention/ui.js';
import {
  CHECKS, DEFAULT_CONFIG, FIXED, PRESETS, Q_HEAD_OPTIONS,
  compareLayouts, describeChange, describeQueryHead, fmtPercent, kvShapes,
  nearestValidKv, reductionPercent, validKvHeads, validateConfig,
} from '../labs/attention/lesson-3.js';

test('fixed constants are L = 32 and BF16', () => {
  assert.equal(FIXED.layers, 32);
  assert.equal(FIXED.bytesPerElem, 2);
});

test('only divisors are offered as KV head counts', () => {
  assert.deepEqual(validKvHeads(16), [1, 2, 4, 8, 16]);
  assert.deepEqual(validKvHeads(12), [1, 2, 3, 4, 6, 12]);
  for (const q of Q_HEAD_OPTIONS) for (const k of validKvHeads(q)) assert.equal(q % k, 0);
  assert.equal(nearestValidKv(12, 8), 6);
  assert.equal(nearestValidKv(40, 16), 10);
  assert.equal(nearestValidKv(8, 16), 8);
});

test('invalid configurations are rejected with clear messages', () => {
  assert.match(validateConfig({ ...DEFAULT_CONFIG, kvHeads: 3 }).reason, /divisible/);
  assert.match(validateConfig({ ...DEFAULT_CONFIG, kvHeads: 32 }).reason, /cannot exceed/);
  assert.match(validateConfig({ ...DEFAULT_CONFIG, seqLen: 0 }).reason, /Sequence length/);
  assert.match(validateConfig({ ...DEFAULT_CONFIG, seqLen: 2.5 }).reason, /whole number/);
  assert.match(validateConfig({ ...DEFAULT_CONFIG, seqLen: Number.NaN }).reason, /Sequence length/);
  assert.equal(validateConfig(DEFAULT_CONFIG).valid, true);
  assert.throws(() => compareLayouts({ ...DEFAULT_CONFIG, kvHeads: 5 }), /divisible/);
});

test('query-to-KV mapping follows floor(i / G)', () => {
  assert.equal(describeQueryHead(16, 4, 5), 'Q5 → KV1 (group 1, shared with Q4–Q7)');
  assert.equal(describeQueryHead(16, 4, 15), 'Q15 → KV3 (group 3, shared with Q12–Q15)');
  assert.equal(describeQueryHead(16, 1, 9), 'Q9 → KV0 (group 0, shared with Q0–Q15)');
  assert.match(describeQueryHead(16, 16, 5), /^Q5 → KV5 \(group 5, not shared/);
  assert.equal(describeQueryHead(32, 8, 31), 'Q31 → KV7 (group 7, shared with Q28–Q31)');
  assert.throws(() => describeQueryHead(16, 4, 16), /Query head index/);
});

test('presets are MHA 16/16, GQA 16/4 and MQA 16/1', () => {
  assert.deepEqual([PRESETS.mha, PRESETS.gqa, PRESETS.mqa].map((p) => [p.qHeads, p.kvHeads]), [[16, 16], [16, 4], [16, 1]]);
});

test('comparison table reproduces M_KV = 2·L·T·H_KV·D·B', () => {
  const [mha, cur, mqa] = compareLayouts(DEFAULT_CONFIG);
  assert.equal(mha.total, 2 * 32 * 4096 * 16 * 128 * 2);
  assert.equal(mha.total, 1073741824);
  assert.equal(cur.total, 268435456);
  assert.equal(mqa.total, 67108864);
  assert.equal(cur.kind, 'GQA');
  assert.equal(cur.groupSize, 4);
  assert.equal(cur.perToken, 2 * 32 * 4 * 128 * 2);
  assert.equal(cur.reductionVsMha, 75);
  assert.equal(mqa.reductionVsMha, 93.75);
  assert.equal(mha.reductionVsMha, 0);
  assert.equal(cur.readPerDecodeStep, cur.total);
  assert.equal(fmtPercent(reductionPercent(12, 1)), '91.67%');
});

test('query heads alone do not change the current layout memory', () => {
  const a = compareLayouts({ qHeads: 16, kvHeads: 8, headDim: 128, seqLen: 4096 });
  const b = compareLayouts({ qHeads: 32, kvHeads: 8, headDim: 128, seqLen: 4096 });
  assert.equal(a[1].total, b[1].total);
  assert.equal(b[0].total / b[1].total, 4);
  assert.match(describeChange({ qHeads: 16, kvHeads: 8, headDim: 128, seqLen: 4096 }, { qHeads: 32, kvHeads: 8, headDim: 128, seqLen: 4096 }, 'qHeads'), /unchanged/);
  assert.match(describeChange(DEFAULT_CONFIG, { ...DEFAULT_CONFIG, kvHeads: 1 }, 'kvHeads'), /256 MiB → 64 MiB \(÷4\)/);
  assert.match(describeChange(DEFAULT_CONFIG, { ...DEFAULT_CONFIG, seqLen: 8192 }, 'seqLen'), /×2/);
  assert.match(describeChange({ ...DEFAULT_CONFIG, qHeads: 16, kvHeads: 8 }, { ...DEFAULT_CONFIG, qHeads: 12, kvHeads: 6 }, 'qHeads', { adjustedKvFrom: 8 }), /8 does not divide 12/);
});

test('tensor shapes keep the cache at H_KV heads', () => {
  const s = kvShapes(DEFAULT_CONFIG);
  assert.deepEqual(s.q, [4096, 16, 128]);
  assert.deepEqual(s.kvCached, [4096, 4, 128]);
  assert.deepEqual(s.kvRepeated, [4096, 16, 128]);
});

test('knowledge checks accept the right answers and flag misconceptions', () => {
  const [groups, storage, conclusion] = CHECKS;
  assert.equal(evaluateNumeric({ text: '4', ...groups }).status, 'correct');
  assert.match(evaluateNumeric({ text: '8', ...groups }).message, /number of KV heads/);
  assert.equal(evaluateNumeric({ text: '4', ...storage }).status, 'correct');
  assert.match(evaluateNumeric({ text: '1', ...storage }).message, /H_KV/);
  assert.equal(evaluateChoice({ selected: 'a', correct: conclusion.correct }).status, 'correct');
  assert.match(evaluateChoice({ selected: 'b', correct: conclusion.correct, misconceptions: conclusion.misconceptions }).message, /proportional/);
});

test('lesson page has the tool, checks and both papers', () => {
  const html = readFileSync('labs/attention/lesson-3.html', 'utf8');
  for (const id of ['gqa-q', 'gqa-kv', 'gqa-d', 'gqa-t', 'gqa-diagram', 'gqa-table-body', 'gqa-check-1', 'gqa-check-2', 'gqa-check-3']) assert.match(html, new RegExp(`id="${id}"`));
  assert.match(html, /arxiv\.org\/abs\/1911\.02150/);
  assert.match(html, /arxiv\.org\/abs\/2305\.13245/);
  assert.match(html, /not total GPU memory/);
  assert.doesNotMatch(html, /LESSON CONTENT/);
});
