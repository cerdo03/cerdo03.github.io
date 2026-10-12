import assert from 'node:assert/strict';
import test from 'node:test';
import {
  applyMask, attention, bestUnit, bytesToUnit, causalMask, concatHeads, convertBytes, dot,
  elementwiseProducts, formatBytes, gqaMapping, hadamard, kvBytes, kvBytesBreakdown, kvBytesPerToken,
  kvBytesPerTokenLayer, kvBytesTotal, matmul, mhaShapes, project, rawScores, scaledScores,
  softmaxRows, splitHeads, stableSoftmax, transpose, unitToBytes, validateGqa,
  weightedValueContributions, withinTolerance,
} from '../labs/attention/attention-math.js';

const close = (a, b, eps = 1e-9) => assert.ok(Math.abs(a - b) <= eps, `${a} !≈ ${b}`);
const closeRows = (A, B, eps = 1e-9) => A.forEach((row, i) => row.forEach((x, j) => close(x, B[i][j], eps)));

test('matmul computes a known product and rejects mismatched shapes', () => {
  assert.deepEqual(matmul([[1, 2], [3, 4]], [[5, 6], [7, 8]]), [[19, 22], [43, 50]]);
  assert.deepEqual(matmul([[1, 2, 3]], [[1], [0], [-1]]), [[-2]]);
  assert.throws(() => matmul([[1, 2]], [[1, 2]]), /inner dimensions 2 and 1 differ/);
  assert.throws(() => matmul([[1, 2], [3]], [[1], [2]]), /not rectangular/);
  assert.throws(() => matmul([], [[1]]), /non-empty/);
  assert.throws(() => matmul([[NaN]], [[1]]), /must be a number/);
});

test('transpose, project and elementwise helpers', () => {
  assert.deepEqual(transpose([[1, 2, 3], [4, 5, 6]]), [[1, 4], [2, 5], [3, 6]]);
  assert.deepEqual(project([[1, 0], [0, 1]], [[2, 3], [4, 5]]), [[2, 3], [4, 5]]);
  assert.throws(() => project([[1, 2]], [[1, 2, 3]], { nameX: 'X', nameW: 'W_Q' }), /W_Q/);
  assert.deepEqual(elementwiseProducts([1, 2], [2, 1]), [2, 2]);
  assert.deepEqual(hadamard([[1, 2]], [[3, 4]]), [[3, 8]]);
  assert.throws(() => elementwiseProducts([1], [1, 2]), /equal lengths/);
  assert.throws(() => hadamard([[1]], [[1, 2]]), /equal shapes/);
});

test('dot product example: q=[1,2] with k1=[2,1], k2=[-1,2] gives 4 and 3', () => {
  assert.equal(dot([1, 2], [2, 1]), 4);
  assert.equal(dot([1, 2], [-1, 2]), 3);
  assert.deepEqual(rawScores([[1, 2]], [[2, 1], [-1, 2]]), [[4, 3]]);
  assert.throws(() => dot([1, 2], [1]), /equal lengths/);
});

test('scaled scores default to 1/sqrt(d_k) and accept an explicit scale', () => {
  const S = scaledScores([[1, 2]], [[2, 1], [-1, 2]]);
  close(S[0][0], 4 / Math.SQRT2);
  close(S[0][1], 3 / Math.SQRT2);
  assert.deepEqual(scaledScores([[1, 2]], [[2, 1]], { scale: 1 }), [[4]]);
  assert.throws(() => scaledScores([[1, 2]], [[2, 1]], { scale: 0 }), /positive/);
  assert.throws(() => scaledScores([[1, 2]], [[1, 2, 3]]), /share d_k/);
});

test('stable softmax handles large inputs, sums to 1, and treats -Infinity as exact 0', () => {
  const p = stableSoftmax([1000, 1001]);
  assert.ok(p.every(Number.isFinite));
  close(p[0], 1 / (1 + Math.E));
  close(p[1], Math.E / (1 + Math.E));
  close(p.reduce((a, b) => a + b, 0), 1);
  const big = stableSoftmax([-5000, 0, 5000]);
  close(big[2], 1);
  const masked = stableSoftmax([1, -Infinity, 2]);
  assert.equal(masked[1], 0);
  close(masked[0] + masked[2], 1);
  assert.throws(() => stableSoftmax([-Infinity, -Infinity]), /every entry is -Infinity/);
  assert.throws(() => stableSoftmax([Infinity, 1]), /finite/);
  softmaxRows([[1, 2, 3], [0, 0, 0]]).forEach((row) => close(row.reduce((a, b) => a + b, 0), 1));
});

test('causal mask has 0 on and below the diagonal and -Infinity above', () => {
  assert.deepEqual(causalMask(3), [[0, -Infinity, -Infinity], [0, 0, -Infinity], [0, 0, 0]]);
  assert.throws(() => causalMask(0), /positive integer/);
  assert.throws(() => applyMask([[1, 2]], causalMask(2)), /must match/);
  assert.throws(() => applyMask([[1]], [[5]]), /0 or -Infinity/);
});

test('causal attention gives exactly zero probability to future positions', () => {
  const Q = [[1, 0], [0, 1], [1, 1], [0.5, -1]];
  const K = [[1, 1], [0, 2], [-1, 0], [2, 0.5]];
  const V = [[1, 0, 2], [0, 1, 0], [3, 1, 1], [0, 0, 5]];
  const result = attention(Q, K, V, { causal: true });
  result.weights.forEach((row, i) => {
    row.forEach((w, j) => { if (j > i) assert.equal(w, 0); });
    close(row.reduce((a, b) => a + b, 0), 1);
  });
  assert.deepEqual(result.weights[0], [1, 0, 0, 0]);
  assert.deepEqual(result.output[0], V[0]);
  assert.equal(result.output.length, 4);
  assert.equal(result.output[0].length, 3);
  const bidirectional = attention(Q, K, V);
  assert.ok(bidirectional.weights[0][3] > 0);
  assert.equal(bidirectional.mask, null);
});

test('attention returns every stage with consistent dimensions and validates shapes', () => {
  const Q = [[1, 2]];
  const K = [[2, 1], [-1, 2]];
  const V = [[1, 0], [0, 1]];
  const r = attention(Q, K, V);
  assert.deepEqual(r.scores, [[4, 3]]);
  close(r.scale, 1 / Math.SQRT2);
  closeRows(r.output, matmul(r.weights, V));
  assert.throws(() => attention(Q, K, [[1, 0]]), /same number of positions/);
  assert.throws(() => attention([[1, 2], [3, 4], [5, 6]], K, V, { causal: true }), /square/);
});

test('weighted value contributions sum to the output row', () => {
  const V = [[1, 0], [0, 2], [4, 4]];
  const { contributions, output } = weightedValueContributions([0.5, 0.25, 0.25], V);
  assert.deepEqual(contributions, [[0.5, 0], [0, 0.5], [1, 1]]);
  assert.deepEqual(output, [1.5, 1.5]);
  assert.throws(() => weightedValueContributions([1, 0], V), /2 entries but V has 3/);
  assert.throws(() => weightedValueContributions([-1, 1, 1], V), /non-negative/);
});

test('multi-head shapes follow d_head = d_model / H', () => {
  const s = mhaShapes({ T: 10, dModel: 512, heads: 8 });
  assert.equal(s.headDim, 64);
  assert.deepEqual(s.split, [10, 8, 64]);
  assert.deepEqual(s.perHead, [8, 10, 64]);
  assert.deepEqual(s.concat, [10, 512]);
  assert.deepEqual(s.output, [10, 512]);
  assert.equal(mhaShapes({ T: 1, dModel: 512, heads: 4 }).headDim, 128);
  assert.equal(mhaShapes({ T: 1, dModel: 512, heads: 16 }).headDim, 32);
  assert.throws(() => mhaShapes({ T: 1, dModel: 512, heads: 6 }), /divisible/);
  const custom = mhaShapes({ T: 2, dModel: 512, heads: 6, headDim: 128 });
  assert.equal(custom.conventional, false);
  assert.deepEqual(custom.wo, [768, 512]);
  assert.throws(() => mhaShapes({ T: 0, dModel: 512, heads: 8 }), /T must be a positive integer/);
});

test('splitHeads and concatHeads are inverses', () => {
  const M = [[1, 2, 3, 4], [5, 6, 7, 8]];
  const heads = splitHeads(M, 2);
  assert.deepEqual(heads, [[[1, 2], [5, 6]], [[3, 4], [7, 8]]]);
  assert.deepEqual(concatHeads(heads), M);
  assert.throws(() => splitHeads(M, 3), /equal heads/);
});

test('MHA, MQA and GQA mappings', () => {
  const mha = gqaMapping(16, 16);
  assert.equal(mha.kind, 'MHA');
  assert.equal(mha.groupSize, 1);
  assert.equal(mha.kvHeadForQuery(7), 7);
  const mqa = gqaMapping(16, 1);
  assert.equal(mqa.kind, 'MQA');
  assert.ok(mqa.mapping.every((kv) => kv === 0));
  const gqa = gqaMapping(16, 4);
  assert.equal(gqa.kind, 'GQA');
  assert.equal(gqa.groupSize, 4);
  assert.deepEqual(gqa.groups[1], [4, 5, 6, 7]);
  assert.equal(gqa.kvHeadForQuery(15), 3);
  assert.equal(gqaMapping(32, 8).groupSize, 4);
  assert.throws(() => gqa.kvHeadForQuery(16), /\[0, 15\]/);
});

test('invalid grouped-query configurations are rejected with reasons', () => {
  assert.throws(() => gqaMapping(16, 3), /divisible/);
  assert.throws(() => gqaMapping(4, 8), /cannot exceed/);
  assert.throws(() => gqaMapping(0, 1), /positive integer/);
  assert.throws(() => gqaMapping(8, 2.5), /positive integer/);
  assert.throws(() => gqaMapping(8, -2), /positive integer/);
  assert.deepEqual(validateGqa(32, 8), { valid: true, reason: null });
  assert.equal(validateGqa(12, 5).valid, false);
});

test('KV memory: 32 layers, 8 KV heads, 128 dim, BF16, 4096 tokens = 512 MiB exactly', () => {
  const params = { layers: 32, kvHeads: 8, headDim: 128, bytesPerElem: 2, seqLen: 4096 };
  assert.equal(kvBytesPerTokenLayer(params), 4096);
  assert.equal(kvBytesPerToken(params), 131072);
  assert.equal(kvBytes(params), 536870912);
  assert.equal(bytesToUnit(kvBytes(params), 'MiB'), 512);
  const parts = kvBytesBreakdown(params);
  assert.equal(parts.keys, 268435456);
  assert.equal(parts.keys + parts.values, parts.total);
  // GQA vs MHA with 32 KV heads: 4x the storage.
  assert.equal(kvBytes({ ...params, kvHeads: 32 }) / kvBytes(params), 4);
  assert.throws(() => kvBytes({ ...params, seqLen: 0 }), /sequence length/);
  assert.throws(() => kvBytes({ ...params, bytesPerElem: 1.5 }), /bytes per element/);
});

test('exercise: 40 layers, 8 KV heads, 128 dim, BF16, 50 x 8000 tokens', () => {
  const params = { layers: 40, kvHeads: 8, headDim: 128, bytesPerElem: 2, seqLen: 8000, sequences: 50 };
  const total = kvBytesTotal(params);
  assert.equal(total, 65536000000);
  assert.equal(kvBytesTotal(params, new Array(50).fill(8000)), total);
  close(bytesToUnit(total, 'GB'), 65.536);
  assert.equal(bytesToUnit(total, 'GiB').toFixed(2), '61.04');
  assert.equal(formatBytes(total, { unit: 'GB' }), '65.54 GB');
  assert.equal(formatBytes(total, { unit: 'GiB' }), '61.04 GiB');
  assert.equal(kvBytesTotal({ layers: 1, kvHeads: 1, headDim: 1, bytesPerElem: 1 }, [3, 5]), 16);
  assert.throws(() => kvBytesTotal(params, []), /non-empty/);
  assert.throws(() => kvBytesTotal(params, [10, -1]), /sequence length \[1\]/);
});

test('unit conversions distinguish decimal and binary units', () => {
  assert.equal(bytesToUnit(1e6, 'MB'), 1);
  assert.equal(bytesToUnit(2 ** 20, 'MiB'), 1);
  assert.equal(unitToBytes(1, 'GiB'), 1073741824);
  assert.equal(unitToBytes(1, 'GB'), 1e9);
  close(convertBytes(1, 'GiB', 'GB'), 1.073741824);
  close(convertBytes(512, 'MiB', 'MB'), 536.870912);
  assert.equal(bestUnit(536870912, 'binary'), 'MiB');
  assert.equal(bestUnit(536870912, 'decimal'), 'MB');
  assert.equal(formatBytes(536870912), '512 MiB');
  assert.equal(formatBytes(536870912, { system: 'decimal' }), '536.87 MB');
  assert.throws(() => bytesToUnit(1, 'mb'), /Unknown byte unit/);
  assert.throws(() => bestUnit(1, 'metric'), /decimal" or "binary/);
  assert.ok(withinTolerance(65.5, 65.536, 0.01));
  assert.ok(!withinTolerance(61.04, 65.536, 0.01));
});
