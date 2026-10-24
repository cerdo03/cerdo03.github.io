// Single source for inline symbol explanations across the LLM Systems collection (see AGENTS.md).
// Keys are the symbol text, with a subscript joined by "_" (<var>H</var><sub>KV</sub> → "H_KV").
// Context-dependent letters (i, j, p, q, k, v, …) are deliberately absent: their meaning
// changes between lessons, so the surrounding prose defines them instead.

export const glossary = {
  T_q: 'Number of query rows processed in this attention call',
  T_k: 'Number of key/value positions available to this attention call',
  C: 'Token positions per KV storage block; not CUDA threads',
  m: 'Running maximum among allowed attention scores seen so far',
  'ℓ': 'Sum of exponentials at the current running maximum scale',
  u: 'Unnormalized weighted-value numerator at the current running maximum scale',
  'α': 'Rescaling factor exp(old maximum minus new maximum)',

  U: 'Left matrix: input rows [r × k] in the GPU examples',
  W: 'Right matrix: projection weights [k × c] in the GPU examples',
  Y: 'Matrix product U W, with shape [r × c]',
  r_rows: 'Number of input/output rows in the GPU examples',
  c_cols: 'Number of output columns in the GPU examples',
  k_inner: 'Reduction width: input columns and weight rows in the GPU examples',
  i_row: 'Output row index in the GPU matrix product (zero-based)',
  j_col: 'Output column index in the GPU matrix product (zero-based)',
  p_sum: 'Summation index over the reduction width (zero-based)',
  b_tile: 'Square tile side length in the GPU teaching model',
  F: 'Floating-point operations; multiply-add counts as two FLOPs',
  E: 'Bytes transferred at the explicitly chosen memory boundary',
  I: 'Arithmetic intensity F / E, in FLOP per byte',
  P: 'Compute ceiling for the chosen operation and precision, in FLOP per second',
  BW: 'Bandwidth ceiling at the chosen memory boundary, in bytes per second',

  T: 'Sequence length (number of token positions)',
  T_i: 'Cached length of sequence i',
  d_model: 'Model (hidden) width',
  d_k: 'Key/query width of one head',
  d_v: 'Value width of one head',
  H: 'Query heads (in MHA, also the number of key/value heads)',
  H_q: 'Query heads',
  H_KV: 'Key/value heads',
  G: 'Group size: query heads sharing one KV head (H_q / H_KV)',
  D: 'Head dimension used in KV-memory formulas',
  L: 'Number of attention layers',
  B: 'Bytes per stored element (2 for BF16/FP16)',
  N: 'Number of concurrent sequences',
  x: 'Current vector for one token position: an embedding at the first layer, an updated representation at later layers',
  X: 'Input token representations, one row per position [T × d_model]',
  Q: 'Queries: what each position is looking for',
  K: 'Keys: what each position offers to be matched against',
  V: 'Values: the content that gets mixed into the output',
  A: 'Attention weights: softmax of the (scaled, masked) scores; each row sums to 1',
  O: 'Output: weighted sum of value vectors',
  M: 'Mask: 0 where attention is allowed, −∞ where it is blocked',
  M_ij: 'Mask entry for query i and key j: 0 if j ≤ i, −∞ if j > i',
  S: 'Attention scores QKᵀ, before softmax',
  S_scaled: 'Scores divided by √d_k',
  W_Q: 'Learned query projection [d_model × d_k]',
  W_K: 'Learned key projection [d_model × d_k]',
  W_V: 'Learned value projection [d_model × d_v]',
  W_O: 'Output projection mapping concatenated heads back to d_model',
  M_KV: 'Raw KV-cache bytes for one sequence: 2·L·T·H_KV·D·B',
  M_total: 'Raw KV-cache bytes summed over all sequences',
  K_cache: 'Cached keys, conceptually [L × T × H_KV × D]',
  V_cache: 'Cached values, conceptually [L × T × H_KV × D]',
};

// Tensor-role badges (.tensor-tag.t-<role>) share the same definitions.
export const tensorRoles = { q: 'Q', k: 'K', v: 'V', w: 'A', o: 'O', mask: 'M' };

/** Glossary key for a <var> element, or null when the symbol has no shared definition. */
const gpuSymbols = new Set(['U', 'W', 'Y', 'r_rows', 'c_cols', 'k_inner', 'i_row', 'j_col', 'p_sum', 'b_tile', 'F', 'E', 'I', 'P', 'BW']);

export function symbolKey(node) {
  const base = node.textContent.trim();
  const next = node.nextSibling;
  const sub = next && next.nodeType === 1 && next.tagName === 'SUB' ? next.textContent.trim() : '';
  const key = sub ? `${base}_${sub}` : base;
  if (gpuSymbols.has(key) && !node.closest?.('.gpu-course')) return null;
  return Object.hasOwn(glossary, key) ? key : null;
}

/** Glossary key for a tensor badge element. */
export function tensorKey(node) {
  const role = [...node.classList].find((name) => name.startsWith('t-'))?.slice(2);
  return tensorRoles[role] || null;
}
