// Pure, dependency-free attention and KV-cache math for Module 2.
//
// Conventions (state these in lesson prose too):
// - Row-vector convention: a sequence is a matrix X with shape [T, d_model];
//   each row is one token position. Projections are X · W.
// - Matrices are plain arrays of equal-length rows of numbers.
// - Biases omitted, no batch dimension, contiguous logical tensors.
// - Every function validates its inputs and throws an Error with a clear
//   message rather than returning a silently wrong result.

const describe = (name) => (name ? `${name} ` : '');

function assertFiniteNumber(value, name, { allowNegInfinity = false } = {}) {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    throw new Error(`${name} must be a number (got ${String(value)}).`);
  }
  if (!Number.isFinite(value) && !(allowNegInfinity && value === -Infinity)) {
    throw new Error(`${name} must be finite (got ${String(value)}).`);
  }
}

export function assertPositiveInteger(value, name) {
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`${name} must be a positive integer (got ${String(value)}).`);
  }
}

/** Validate a non-empty numeric vector. Returns its length. */
export function assertVector(v, name = 'vector', options = {}) {
  if (!Array.isArray(v) || v.length === 0) {
    throw new Error(`${describe(name)}must be a non-empty array of numbers.`);
  }
  v.forEach((x, i) => assertFiniteNumber(x, `${name}[${i}]`, options));
  return v.length;
}

/** Validate a non-empty rectangular numeric matrix. Returns [rows, cols]. */
export function assertMatrix(M, name = 'matrix', options = {}) {
  if (!Array.isArray(M) || M.length === 0) {
    throw new Error(`${describe(name)}must be a non-empty array of rows.`);
  }
  const cols = Array.isArray(M[0]) ? M[0].length : -1;
  if (cols <= 0) throw new Error(`${describe(name)}rows must be non-empty arrays.`);
  M.forEach((row, i) => {
    if (!Array.isArray(row) || row.length !== cols) {
      throw new Error(`${describe(name)}is not rectangular: row ${i} has ${Array.isArray(row) ? row.length : 'no'} columns, expected ${cols}.`);
    }
    row.forEach((x, j) => assertFiniteNumber(x, `${name}[${i}][${j}]`, options));
  });
  return [M.length, cols];
}

/** Shape of a validated matrix as [rows, cols]. */
export function shape(M, name = 'matrix') {
  return assertMatrix(M, name, { allowNegInfinity: true });
}

export function transpose(M, name = 'matrix') {
  const [rows, cols] = assertMatrix(M, name, { allowNegInfinity: true });
  return Array.from({ length: cols }, (_, j) => Array.from({ length: rows }, (_, i) => M[i][j]));
}

export function dot(a, b, { nameA = 'a', nameB = 'b' } = {}) {
  const n = assertVector(a, nameA);
  const m = assertVector(b, nameB);
  if (n !== m) throw new Error(`Dot product needs equal lengths: ${nameA} has ${n}, ${nameB} has ${m}.`);
  let sum = 0;
  for (let i = 0; i < n; i += 1) sum += a[i] * b[i];
  return sum;
}

/** Elementwise products a_i * b_i of two equal-length vectors (the terms of a dot product). */
export function elementwiseProducts(a, b, { nameA = 'a', nameB = 'b' } = {}) {
  const n = assertVector(a, nameA);
  const m = assertVector(b, nameB);
  if (n !== m) throw new Error(`Elementwise product needs equal lengths: ${nameA} has ${n}, ${nameB} has ${m}.`);
  return a.map((x, i) => x * b[i]);
}

/** Elementwise (Hadamard) product of two equal-shape matrices. */
export function hadamard(A, B) {
  const [ra, ca] = assertMatrix(A, 'A');
  const [rb, cb] = assertMatrix(B, 'B');
  if (ra !== rb || ca !== cb) throw new Error(`Hadamard product needs equal shapes: A is [${ra}, ${ca}], B is [${rb}, ${cb}].`);
  return A.map((row, i) => row.map((x, j) => x * B[i][j]));
}

export function matmul(A, B, { nameA = 'A', nameB = 'B' } = {}) {
  const [n, k] = assertMatrix(A, nameA);
  const [k2, m] = assertMatrix(B, nameB);
  if (k !== k2) {
    throw new Error(`Cannot multiply ${nameA} [${n}, ${k}] by ${nameB} [${k2}, ${m}]: inner dimensions ${k} and ${k2} differ.`);
  }
  const out = Array.from({ length: n }, () => new Array(m).fill(0));
  for (let i = 0; i < n; i += 1) {
    for (let j = 0; j < m; j += 1) {
      let sum = 0;
      for (let p = 0; p < k; p += 1) sum += A[i][p] * B[p][j];
      out[i][j] = sum;
    }
  }
  return out;
}

/** Multiply every entry by a finite scalar. -Infinity entries stay -Infinity for positive s. */
export function scaleMatrix(M, s) {
  assertFiniteNumber(s, 'scale');
  if (s <= 0) throw new Error(`scale must be positive (got ${s}).`);
  assertMatrix(M, 'matrix', { allowNegInfinity: true });
  return M.map((row) => row.map((x) => x * s));
}

/** Learned linear projection X · W with shape checks (biases omitted). */
export function project(X, W, { nameX = 'X', nameW = 'W' } = {}) {
  return matmul(X, W, { nameA: nameX, nameB: nameW });
}

/** Raw scores S = Q K^T (unscaled dot products). */
export function rawScores(Q, K) {
  const [, dq] = assertMatrix(Q, 'Q');
  const [, dk] = assertMatrix(K, 'K');
  if (dq !== dk) throw new Error(`Q and K must share d_k: Q has ${dq} columns, K has ${dk}.`);
  return matmul(Q, transpose(K), { nameA: 'Q', nameB: 'K^T' });
}

/** Default attention scale 1/sqrt(d_k). */
export function defaultScale(dk) {
  assertPositiveInteger(dk, 'd_k');
  return 1 / Math.sqrt(dk);
}

function resolveScale(scale, dk) {
  if (scale === undefined) return defaultScale(dk);
  assertFiniteNumber(scale, 'scale');
  if (scale <= 0) throw new Error(`scale must be positive (got ${scale}).`);
  return scale;
}

/** Scaled scores Q K^T · scale. Default scale = 1/sqrt(d_k); pass {scale: 1} for unscaled. */
export function scaledScores(Q, K, { scale } = {}) {
  const S = rawScores(Q, K);
  return scaleMatrix(S, resolveScale(scale, Q[0].length));
}

/**
 * Numerically stable softmax of one vector: subtract m = max(z) before exp.
 * -Infinity entries become exactly 0. A row of only -Infinity throws.
 */
export function stableSoftmax(z, name = 'scores') {
  assertVector(z, name, { allowNegInfinity: true });
  const m = Math.max(...z);
  if (m === -Infinity) throw new Error(`softmax of ${name} is undefined: every entry is -Infinity (fully masked row).`);
  const exps = z.map((x) => (x === -Infinity ? 0 : Math.exp(x - m)));
  const total = exps.reduce((a, b) => a + b, 0);
  return exps.map((e) => e / total);
}

/** Row-wise stable softmax of a matrix. */
export function softmaxRows(M, name = 'scores') {
  assertMatrix(M, name, { allowNegInfinity: true });
  return M.map((row, i) => stableSoftmax(row, `${name} row ${i}`));
}

/** Causal mask M with M[i][j] = 0 if j <= i, -Infinity if j > i. */
export function causalMask(T) {
  assertPositiveInteger(T, 'T');
  return Array.from({ length: T }, (_, i) => Array.from({ length: T }, (_, j) => (j <= i ? 0 : -Infinity)));
}

/** Add an additive mask (0 or -Infinity entries) to a score matrix of the same shape. */
export function applyMask(S, mask) {
  const [r, c] = assertMatrix(S, 'scores', { allowNegInfinity: true });
  const [mr, mc] = assertMatrix(mask, 'mask', { allowNegInfinity: true });
  if (r !== mr || c !== mc) throw new Error(`Mask shape [${mr}, ${mc}] must match scores shape [${r}, ${c}].`);
  mask.forEach((row, i) => row.forEach((x, j) => {
    if (x !== 0 && x !== -Infinity) throw new Error(`mask[${i}][${j}] must be 0 or -Infinity (got ${x}).`);
  }));
  return S.map((row, i) => row.map((x, j) => x + mask[i][j]));
}

/**
 * Full scaled dot-product attention:
 *   Attention(Q, K, V) = softmax(Q K^T * scale + M) V
 * Q: [T_q, d_k], K: [T_k, d_k], V: [T_k, d_v]. Causal requires T_q === T_k.
 * Returns every intermediate so lessons can render each stage.
 */
export function attention(Q, K, V, { causal = false, scale } = {}) {
  const [tq, dq] = assertMatrix(Q, 'Q');
  const [tk, dk] = assertMatrix(K, 'K');
  const [tv] = assertMatrix(V, 'V');
  if (dq !== dk) throw new Error(`Q and K must share d_k: Q has ${dq} columns, K has ${dk}.`);
  if (tk !== tv) throw new Error(`K and V must have the same number of positions: K has ${tk}, V has ${tv}.`);
  if (causal && tq !== tk) throw new Error(`Causal mask needs square scores: Q has ${tq} positions, K has ${tk}.`);
  const usedScale = resolveScale(scale, dk);
  const scores = rawScores(Q, K);
  const scaled = scaleMatrix(scores, usedScale);
  const mask = causal ? causalMask(tq) : null;
  const masked = mask ? applyMask(scaled, mask) : scaled.map((row) => row.slice());
  const weights = softmaxRows(masked, 'masked scores');
  const output = matmul(weights, V, { nameA: 'A', nameB: 'V' });
  return { scale: usedScale, scores, scaled, mask, masked, weights, output };
}

/**
 * Per-position contributions to one output row: contribution_j = w_j * v_j.
 * output = sum_j contribution_j. Every non-zero weight contributes.
 */
export function weightedValueContributions(weightsRow, V) {
  const n = assertVector(weightsRow, 'weights row');
  const [tv, dv] = assertMatrix(V, 'V');
  if (n !== tv) throw new Error(`Weights row has ${n} entries but V has ${tv} rows.`);
  weightsRow.forEach((w, i) => {
    if (w < 0) throw new Error(`weights row[${i}] must be non-negative (got ${w}).`);
  });
  const contributions = V.map((row, j) => row.map((x) => weightsRow[j] * x));
  const output = Array.from({ length: dv }, (_, c) => contributions.reduce((sum, row) => sum + row[c], 0));
  return { contributions, output };
}

// ---------------------------------------------------------------- Multi-head

/**
 * Tensor shapes for multi-head attention (no batch dimension).
 * headDim defaults to dModel / heads and then requires divisibility.
 * Passing headDim explicitly models architectures that choose it independently.
 */
export function mhaShapes({ T, dModel, heads, headDim } = {}) {
  assertPositiveInteger(T, 'T');
  assertPositiveInteger(dModel, 'd_model');
  assertPositiveInteger(heads, 'heads');
  let d = headDim;
  if (d === undefined) {
    if (dModel % heads !== 0) {
      throw new Error(`d_model (${dModel}) must be divisible by heads (${heads}) when head dim is derived as d_model / heads.`);
    }
    d = dModel / heads;
  } else {
    assertPositiveInteger(d, 'head dim');
  }
  const inner = heads * d;
  return Object.freeze({
    T, dModel, heads, headDim: d, inner,
    conventional: inner === dModel,
    input: [T, dModel],
    wq: [dModel, inner],
    wk: [dModel, inner],
    wv: [dModel, inner],
    projected: [T, inner],
    split: [T, heads, d],
    perHead: [heads, T, d],
    scoresPerHead: [heads, T, T],
    headOutput: [heads, T, d],
    concat: [T, inner],
    wo: [inner, dModel],
    output: [T, dModel],
  });
}

/** Split [T, H*d] into H matrices of [T, d] (head h takes columns h*d..(h+1)*d-1). */
export function splitHeads(M, heads) {
  const [, cols] = assertMatrix(M, 'projected matrix');
  assertPositiveInteger(heads, 'heads');
  if (cols % heads !== 0) throw new Error(`Cannot split ${cols} columns into ${heads} equal heads.`);
  const d = cols / heads;
  return Array.from({ length: heads }, (_, h) => M.map((row) => row.slice(h * d, (h + 1) * d)));
}

/** Concatenate H matrices of [T, d] back into [T, H*d]. */
export function concatHeads(headMatrices) {
  if (!Array.isArray(headMatrices) || headMatrices.length === 0) throw new Error('concatHeads needs a non-empty array of head matrices.');
  const [t, d] = assertMatrix(headMatrices[0], 'head 0');
  headMatrices.forEach((H, i) => {
    const [ti, di] = assertMatrix(H, `head ${i}`);
    if (ti !== t || di !== d) throw new Error(`head ${i} has shape [${ti}, ${di}], expected [${t}, ${d}].`);
  });
  return Array.from({ length: t }, (_, r) => headMatrices.flatMap((H) => H[r]));
}

/** Validate a query-head / KV-head configuration without throwing. */
export function validateGqa(qHeads, kvHeads) {
  if (!Number.isInteger(qHeads) || qHeads <= 0) return { valid: false, reason: `Query heads must be a positive integer (got ${String(qHeads)}).` };
  if (!Number.isInteger(kvHeads) || kvHeads <= 0) return { valid: false, reason: `KV heads must be a positive integer (got ${String(kvHeads)}).` };
  if (kvHeads > qHeads) return { valid: false, reason: `KV heads (${kvHeads}) cannot exceed query heads (${qHeads}).` };
  if (qHeads % kvHeads !== 0) return { valid: false, reason: `Query heads (${qHeads}) must be divisible by KV heads (${kvHeads}) so every group has the same size.` };
  return { valid: true, reason: null };
}

/**
 * Grouped-query mapping. MHA: kvHeads === qHeads. MQA: kvHeads === 1. GQA: in between.
 * Query head i uses KV head floor(i / groupSize).
 */
export function gqaMapping(qHeads, kvHeads) {
  const check = validateGqa(qHeads, kvHeads);
  if (!check.valid) throw new Error(check.reason);
  const groupSize = qHeads / kvHeads;
  let kind = 'GQA';
  if (kvHeads === qHeads) kind = 'MHA';
  else if (kvHeads === 1) kind = 'MQA';
  const kvHeadForQuery = (q) => {
    if (!Number.isInteger(q) || q < 0 || q >= qHeads) throw new Error(`Query head index must be an integer in [0, ${qHeads - 1}] (got ${String(q)}).`);
    return Math.floor(q / groupSize);
  };
  const mapping = Object.freeze(Array.from({ length: qHeads }, (_, q) => Math.floor(q / groupSize)));
  const groups = Object.freeze(Array.from({ length: kvHeads }, (_, g) => Object.freeze(Array.from({ length: groupSize }, (_, i) => g * groupSize + i))));
  return Object.freeze({ qHeads, kvHeads, groupSize, kind, mapping, groups, kvHeadForQuery });
}

// ---------------------------------------------------------------- KV memory

/** Common bytes-per-element values. */
export const BYTES_PER_ELEMENT = Object.freeze({ fp32: 4, fp16: 2, bf16: 2, fp8: 1, int8: 1 });

function safeProduct(factors, label) {
  const result = factors.reduce((a, b) => a * b, 1);
  if (!Number.isSafeInteger(result)) throw new Error(`${label} (${result}) exceeds the exact integer range; reduce the inputs.`);
  return result;
}

function checkKvParams(params, keys) {
  const names = { layers: 'layers (L)', seqLen: 'sequence length (T)', kvHeads: 'KV heads (H_KV)', headDim: 'head dim (D)', bytesPerElem: 'bytes per element (B)', sequences: 'sequences (N)' };
  if (!params || typeof params !== 'object') throw new Error('KV memory functions need a parameter object.');
  for (const key of keys) assertPositiveInteger(params[key], names[key]);
}

/** Bytes per token per layer: 2 · H_KV · D · B (the 2 = one key + one value vector per head). */
export function kvBytesPerTokenLayer(params) {
  checkKvParams(params, ['kvHeads', 'headDim', 'bytesPerElem']);
  const { kvHeads, headDim, bytesPerElem } = params;
  return safeProduct([2, kvHeads, headDim, bytesPerElem], 'Bytes per token per layer');
}

/** Bytes per token across all layers: 2 · L · H_KV · D · B. */
export function kvBytesPerToken(params) {
  checkKvParams(params, ['layers', 'kvHeads', 'headDim', 'bytesPerElem']);
  return safeProduct([params.layers, kvBytesPerTokenLayer(params)], 'Bytes per token');
}

/** Raw KV storage for one sequence: M_KV = 2 · L · T · H_KV · D · B bytes. */
export function kvBytes(params) {
  checkKvParams(params, ['layers', 'seqLen', 'kvHeads', 'headDim', 'bytesPerElem']);
  return safeProduct([params.seqLen, kvBytesPerToken(params)], 'KV bytes');
}

/** K and V halves of one sequence's KV storage (equal by construction here). */
export function kvBytesBreakdown(params) {
  const total = kvBytes(params);
  return Object.freeze({
    perTokenLayer: kvBytesPerTokenLayer(params),
    perToken: kvBytesPerToken(params),
    keys: total / 2,
    values: total / 2,
    total,
  });
}

/**
 * Aggregate raw KV storage.
 * - seqLens array: M_total = Σ_i 2 · L · T_i · H_KV · D · B
 * - or { seqLen, sequences } for N equal-length sequences: N · 2 · L · T · H_KV · D · B
 */
export function kvBytesTotal(params, seqLens) {
  if (seqLens === undefined) {
    checkKvParams(params, ['layers', 'seqLen', 'kvHeads', 'headDim', 'bytesPerElem', 'sequences']);
    return safeProduct([params.sequences, kvBytes(params)], 'Total KV bytes');
  }
  if (!Array.isArray(seqLens) || seqLens.length === 0) throw new Error('Sequence lengths must be a non-empty array.');
  const perToken = kvBytesPerToken(params);
  let tokens = 0;
  seqLens.forEach((t, i) => {
    assertPositiveInteger(t, `sequence length [${i}]`);
    tokens += t;
  });
  return safeProduct([tokens, perToken], 'Total KV bytes');
}

// ---------------------------------------------------------------- Units

/** Decimal (SI) units are powers of 1000; binary (IEC) units are powers of 1024. */
export const BYTE_UNITS = Object.freeze({
  B: 1,
  KB: 1e3, MB: 1e6, GB: 1e9, TB: 1e12,
  KiB: 2 ** 10, MiB: 2 ** 20, GiB: 2 ** 30, TiB: 2 ** 40,
});

function unitFactor(unit) {
  const factor = BYTE_UNITS[unit];
  if (!factor) throw new Error(`Unknown byte unit "${String(unit)}". Use one of ${Object.keys(BYTE_UNITS).join(', ')}.`);
  return factor;
}

/** Convert a byte count to the given unit (e.g. 536870912 → 512 for 'MiB'). */
export function bytesToUnit(bytes, unit) {
  assertFiniteNumber(bytes, 'bytes');
  if (bytes < 0) throw new Error(`bytes must be non-negative (got ${bytes}).`);
  return bytes / unitFactor(unit);
}

/** Convert a value in a unit back to bytes. */
export function unitToBytes(value, unit) {
  assertFiniteNumber(value, 'value');
  if (value < 0) throw new Error(`value must be non-negative (got ${value}).`);
  return value * unitFactor(unit);
}

/** Convert between two byte units. */
export function convertBytes(value, fromUnit, toUnit) {
  return unitToBytes(value, fromUnit) / unitFactor(toUnit);
}

/** Pick the largest unit (decimal or binary system) whose value is >= 1. */
export function bestUnit(bytes, system = 'binary') {
  assertFiniteNumber(bytes, 'bytes');
  const ladder = system === 'decimal' ? ['B', 'KB', 'MB', 'GB', 'TB'] : system === 'binary' ? ['B', 'KiB', 'MiB', 'GiB', 'TiB'] : null;
  if (!ladder) throw new Error(`Unit system must be "decimal" or "binary" (got ${String(system)}).`);
  let chosen = 'B';
  for (const unit of ladder) if (Math.abs(bytes) >= BYTE_UNITS[unit]) chosen = unit;
  return chosen;
}

/**
 * Format bytes, e.g. formatBytes(536870912, { unit: 'MiB' }) → "512 MiB".
 * Options: unit (fixed) or system ('binary' | 'decimal', auto unit), digits (max fraction digits).
 */
export function formatBytes(bytes, { unit, system = 'binary', digits = 2 } = {}) {
  const chosen = unit ?? bestUnit(bytes, system);
  const value = bytesToUnit(bytes, chosen);
  return `${value.toLocaleString('en-US', { maximumFractionDigits: digits })} ${chosen}`;
}

/** True if estimate is within a relative tolerance of actual (default 1%). */
export function withinTolerance(estimate, actual, relative = 0.01) {
  assertFiniteNumber(estimate, 'estimate');
  assertFiniteNumber(actual, 'actual');
  assertFiniteNumber(relative, 'tolerance');
  if (relative < 0) throw new Error('tolerance must be non-negative.');
  if (actual === 0) return Math.abs(estimate) <= relative;
  return Math.abs(estimate - actual) <= Math.abs(actual) * relative;
}
