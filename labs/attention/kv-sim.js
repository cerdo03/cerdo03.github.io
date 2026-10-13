// Deterministic toy decode-cache simulation for Lesson 2.4.
//
// Assumptions (render these next to any widget that uses this module):
// - One attention layer, one KV head, head dim 2, no batch dimension.
// - Toy embeddings and projections are invented, fixed numbers (not a trained model).
// - Positions enter through a small additive toy offset; RoPE is not modelled.
// - "Sampled" tokens come from a fixed toy continuation, not from the model's output.
//
// Timing model:
// - prefill(prompt) processes every prompt position in one pass and stores K/V for each.
//   The last position's output produces the first sampled token, which is PENDING:
//   it has been sampled but not processed, so it has no K/V in the cache yet.
// - step() runs one decode forward pass on the pending token: it computes that token's
//   q, k, v, reads every previously cached K/V entry, attends over previous + current,
//   appends the new k, v, then samples the next pending token.
// - Cache length = number of positions processed, never the number of tokens sampled.
//
// Counters (per pass and cumulative):
// - projectedWithCache: token positions whose K/V projections are computed in this
//   forward pass when cached K/V is reused (prefill: prompt length; decode: 1).
// - projectedWithoutCache: the same count if no cache existed and each decode pass
//   re-ran the whole sequence processed so far (prefill: prompt length; decode: p + 1).
// - cacheReads: cached positions whose K/V is read from the cache in this pass
//   (prefill: 0; decode: p, the cache length before appending).
// - keysAttended: keys the new query(s) score against (decode: p + 1). Caching does not
//   remove this attention work; it only avoids recomputing old K/V projections.

import { dot, matmul, stableSoftmax } from './attention-math.js';
import {representations, promptTokens} from '../inference/guide-model.js';

export const SIM_ASSUMPTIONS = Object.freeze([
  'One attention layer, one KV head, head dimension 2, no batch dimension.',
  'Embeddings and projection matrices are invented toy values, not a trained model.',
  'Same first-layer toy projections as Module 1 and Lesson 2.1; normalization and positional encoding are omitted.',
  'Sampled tokens come from a fixed toy continuation, not from model probabilities.',
]);

/** Fixed toy projection matrices, shape [d_model = 2, d = 2]. */
export const TOY_WEIGHTS = Object.freeze({
  wq: Object.freeze([Object.freeze([1, 0]), Object.freeze([0, 1])]),
  wk: Object.freeze([Object.freeze([0, 1]), Object.freeze([1, 0])]),
  wv: Object.freeze([Object.freeze([2, 0]), Object.freeze([0, 1])]),
});

export const DEFAULT_PROMPT = Object.freeze(['The', 'sky', 'is', 'blue']);
export const DEFAULT_CONTINUATION = Object.freeze(['and', 'the', 'sun', 'shines', '.']);

const freezeVec = (v) => Object.freeze([...v]);

function tokenCode(token) {
  let h = 0;
  for (const ch of token) h = (h * 31 + ch.codePointAt(0)) % 9973;
  return h;
}

/** Deterministic toy lookup (2 dims): shared prompt embeddings, fixed invented rows for other tokens. */
export function toyEmbedding(token, position, embeddings = representations) {
  if (typeof token !== 'string' || token.length === 0) throw new Error('Token must be a non-empty string.');
  if (!Number.isInteger(position) || position < 0) throw new Error(`Position must be a non-negative integer (got ${String(position)}).`);
  const known = promptTokens.indexOf(token);
  if (known >= 0) return freezeVec(embeddings[known]);
  const h = tokenCode(token);
  return freezeVec([((h % 5) - 2) * 0.5, ((h % 3) - 1) * 0.5]);
}

/** Toy q, k, v for one position (row-vector convention: x · W). */
export function toyProjections(token, position, embeddings = representations) {
  const x = toyEmbedding(token, position, embeddings);
  const [q] = matmul([x], TOY_WEIGHTS.wq);
  const [k] = matmul([x], TOY_WEIGHTS.wk);
  const [v] = matmul([x], TOY_WEIGHTS.wv);
  return Object.freeze({ x, q: freezeVec(q), k: freezeVec(k), v: freezeVec(v) });
}

/**
 * Deterministic toy value for a conceptual cache tensor element
 * kind ('k' | 'v'), layer, position, head, dim. Used for hierarchy views (L × T × H_KV × D).
 */
export function toyCacheValue(kind, layer, position, head, dim) {
  if (kind !== 'k' && kind !== 'v') throw new Error(`kind must be "k" or "v" (got ${String(kind)}).`);
  for (const [name, value] of Object.entries({ layer, position, head, dim })) {
    if (!Number.isInteger(value) || value < 0) throw new Error(`${name} must be a non-negative integer (got ${String(value)}).`);
  }
  const seed = layer * 7 + position * 5 + head * 3 + dim * 2 + (kind === 'v' ? 11 : 0);
  return ((seed % 19) - 9) / 10;
}

function attendOver(q, keys, values) {
  const scale = 1 / Math.sqrt(q.length);
  const scores = keys.map((k) => dot(q, k) * scale);
  const weights = stableSoftmax(scores);
  const output = values[0].map((_, c) => values.reduce((sum, v, j) => sum + weights[j] * v[c], 0));
  return { scores: Object.freeze(scores), weights: Object.freeze(weights), output: Object.freeze(output) };
}

function deepFreeze(value) {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.values(value).forEach(deepFreeze);
    Object.freeze(value);
  }
  return value;
}

/**
 * Create a toy KV-cache decode simulation.
 * @param {{ continuation?: string[] }} [options] fixed toy "sampled" sequence.
 */
export function createKvSim({ continuation = DEFAULT_CONTINUATION, embeddings = representations } = {}) {
  const embeddingRows = embeddings.map(row => [...row]);
  if (!Array.isArray(continuation) || continuation.length === 0) throw new Error('continuation must be a non-empty array of tokens.');
  continuation.forEach((t, i) => {
    if (typeof t !== 'string' || t.length === 0) throw new Error(`continuation[${i}] must be a non-empty string.`);
  });
  const fixedContinuation = Object.freeze(continuation.slice());

  let state;
  const initial = () => ({ phase: 'empty', prompt: [], cache: [], pending: null, sampled: [], passes: [], totals: { projectedWithCache: 0, projectedWithoutCache: 0, cacheReads: 0, keysAttended: 0 } });
  state = initial();

  function addTotals(pass) {
    for (const key of Object.keys(state.totals)) state.totals[key] += pass[key];
  }

  function sampleAt(index) {
    return index < fixedContinuation.length ? fixedContinuation[index] : null;
  }

  function prefill(promptTokens = DEFAULT_PROMPT) {
    if (state.phase !== 'empty') throw new Error('prefill() can only run once; call reset() first.');
    if (!Array.isArray(promptTokens) || promptTokens.length === 0) throw new Error('Prompt must be a non-empty array of tokens.');
    promptTokens.forEach((t, i) => {
      if (typeof t !== 'string' || t.length === 0) throw new Error(`prompt[${i}] must be a non-empty string.`);
    });
    const projections = promptTokens.map((token, position) => ({ token, position, ...toyProjections(token, position, embeddingRows) }));
    const keys = projections.map((p) => p.k);
    const values = projections.map((p) => p.v);
    // Causal: position i attends to positions 0..i only.
    const rows = projections.map((p, i) => attendOver(p.q, keys.slice(0, i + 1), values.slice(0, i + 1)));
    state.cache = projections.map((p) => Object.freeze({ position: p.position, token: p.token, k: p.k, v: p.v, createdBy: 'prefill' }));
    const first = sampleAt(0);
    state.prompt = Object.freeze(promptTokens.slice());
    state.pending = first === null ? null : Object.freeze({ token: first, position: promptTokens.length });
    state.sampled = first === null ? [] : [first];
    const T = promptTokens.length;
    const pass = deepFreeze({
      kind: 'prefill', index: 0,
      positions: projections.map((p) => p.position),
      inputTokens: promptTokens.slice(),
      queries: projections.map((p) => p.q),
      attention: rows,
      projectedWithCache: T, projectedWithoutCache: T, cacheReads: 0,
      keysAttended: (T * (T + 1)) / 2,
      cacheLengthAfter: T,
      sampled: first,
    });
    state.passes.push(pass);
    addTotals(pass);
    state.phase = state.pending ? 'prefilled' : 'done';
    return snapshot();
  }

  function step() {
    if (state.phase === 'empty') throw new Error('Run prefill() before step().');
    if (!state.pending) throw new Error('No pending token: the fixed toy continuation is exhausted. Call reset().');
    const { token, position } = state.pending;
    const p = state.cache.length;
    const proj = toyProjections(token, position, embeddingRows);
    const keys = [...state.cache.map((e) => e.k), proj.k];
    const values = [...state.cache.map((e) => e.v), proj.v];
    const result = attendOver(proj.q, keys, values);
    const decodeIndex = state.passes.length;
    state.cache = [...state.cache, Object.freeze({ position, token, k: proj.k, v: proj.v, createdBy: `decode step ${decodeIndex}` })];
    const next = sampleAt(state.sampled.length);
    state.pending = next === null ? null : Object.freeze({ token: next, position: position + 1 });
    if (next !== null) state.sampled = [...state.sampled, next];
    const pass = deepFreeze({
      kind: 'decode', index: decodeIndex,
      positions: [position],
      inputTokens: [token],
      query: proj.q, newKey: proj.k, newValue: proj.v,
      readPositions: Array.from({ length: p }, (_, i) => i),
      attention: result,
      projectedWithCache: 1, projectedWithoutCache: p + 1, cacheReads: p,
      keysAttended: p + 1,
      cacheLengthAfter: p + 1,
      sampled: next,
    });
    state.passes.push(pass);
    addTotals(pass);
    state.phase = state.pending ? 'decoding' : 'done';
    return snapshot();
  }

  function reset() {
    state = initial();
    return snapshot();
  }

  /** Immutable view of the current state. Cache entry objects are shared and frozen. */
  function snapshot() {
    return Object.freeze({
      phase: state.phase,
      prompt: state.prompt,
      cache: Object.freeze(state.cache.slice()),
      cacheLength: state.cache.length,
      pending: state.pending,
      sampled: Object.freeze(state.sampled.slice()),
      passes: Object.freeze(state.passes.slice()),
      lastPass: state.passes.at(-1) ?? null,
      totals: Object.freeze({ ...state.totals }),
      assumptions: SIM_ASSUMPTIONS,
      canStep: state.phase !== 'empty' && state.pending !== null,
    });
  }

  return Object.freeze({ prefill, step, reset, snapshot });
}
