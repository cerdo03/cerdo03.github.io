// Lesson 2.2 — Multi-head attention.
// Pure data and functions are exported for tests (no DOM access at module load).
// DOM code runs only when a document is present; each control updates only its own outputs.
import * as math from './attention-math.js';
import * as ui from './ui.js';

export const D_MODEL = 512;
/** Head counts offered by the shape explorer: the divisors of 512 from 1 to 64. */
export const HEAD_OPTIONS = Object.freeze([1, 2, 4, 8, 16, 32, 64]);
export const DEFAULT_HEADS = 8;
export const DEFAULT_T = 1024;
export const T_LIMITS = Object.freeze({ min: 1, max: 8192 });
export const HEAD_DIM_LIMITS = Object.freeze({ min: 1, max: 1024 });
/** Bytes per element used only for the "if materialized" score-tensor size (FP16/BF16). */
export const SCORE_BYTES_PER_ELEMENT = 2;

/** Parse and validate an integer field. Returns { value } or { error }. */
export function parseIntegerField(text, { name, min, max }) {
  const value = ui.parseNumber(text);
  if (value === null || !Number.isInteger(value)) return { error: `${name} must be a whole number.` };
  if (value < min || value > max) return { error: `${name} must be between ${ui.fmtInt(min)} and ${ui.fmtInt(max)} (got ${ui.fmtInt(value)}).` };
  return { value };
}

/**
 * Derived quantities for one multi-head attention layer (single sequence, no batch).
 * headDim omitted → equal partition d_head = d_model / H.
 */
export function headStats({ T, dModel = D_MODEL, heads, headDim }) {
  const shapes = math.mhaShapes({ T, dModel, heads, headDim });
  const { inner } = shapes;
  const scoreElements = heads * T * T;
  return Object.freeze({
    shapes,
    headDim: shapes.headDim,
    inner,
    conventional: shapes.conventional,
    scoreElements,
    scoreBytes: scoreElements * SCORE_BYTES_PER_ELEMENT,
    // Q_h K_h^T for every head: H · T · T · d_head multiply-adds = T² · (H · d_head).
    scoreMultiplyAdds: scoreElements * shapes.headDim,
    // W_Q, W_K, W_V are [d_model, H·d_head]; W_O is [H·d_head, d_model]. Biases omitted.
    projectionParams: 3 * dModel * inner + inner * dModel,
  });
}

/** The ordered stages of the tensor-shape diagram: symbolic and numeric shape for each. */
export function shapeStages(shapes) {
  const { T, dModel, heads: H, headDim: d, inner } = shapes;
  const innerSym = shapes.conventional ? 'd_model' : 'H·d_head';
  return [
    { id: 'input', step: 'Input', op: 'X (one row per token position)', symbolic: ['T', 'd_model'], shape: shapes.input },
    { id: 'project', step: 'Project', op: `Q = X·W_Q, K = X·W_K, V = X·W_V; each W is [${dModel}, ${inner}]`, symbolic: ['T', innerSym], shape: shapes.projected },
    { id: 'reshape', step: 'Reshape', op: `split the last axis of ${inner} into ${H} heads × ${d}`, symbolic: ['T', 'H', 'd_head'], shape: shapes.split },
    { id: 'transpose', step: 'Transpose', op: 'swap the token and head axes so each head is a separate [T, d_head] matrix', symbolic: ['H', 'T', 'd_head'], shape: shapes.perHead },
    { id: 'scores', step: 'Scores per head', op: 'S_h = Q_h·K_hᵀ / √d_head (+ causal mask M), then row-wise softmax → A_h', symbolic: ['H', 'T', 'T'], shape: shapes.scoresPerHead },
    { id: 'heads', step: 'Weighted values per head', op: 'head_h = A_h·V_h', symbolic: ['H', 'T', 'd_head'], shape: shapes.headOutput },
    { id: 'concat', step: 'Concatenate', op: `transpose back to [${T}, ${H}, ${d}], then merge the last two axes`, symbolic: ['T', innerSym], shape: shapes.concat },
    { id: 'output', step: 'Output projection', op: `multiply by W_O [${inner}, ${dModel}]`, symbolic: ['T', 'd_model'], shape: shapes.output },
  ];
}

/** Column ranges of the projected [T, H·d_head] matrix owned by each head (0-based, inclusive). */
export function headColumnRanges(heads, headDim) {
  math.assertPositiveInteger(heads, 'heads');
  math.assertPositiveInteger(headDim, 'head dim');
  return Array.from({ length: heads }, (_, h) => ({ head: h + 1, first: h * headDim, last: (h + 1) * headDim - 1 }));
}

/** Short text description of the column partition (the SVG's text equivalent). */
export function describePartition(heads, headDim) {
  const ranges = headColumnRanges(heads, headDim);
  const fmt = (r) => `head ${r.head} owns columns ${r.first}–${r.last}`;
  const total = heads * headDim;
  if (heads === 1) return `All ${total} columns form a single head: ${fmt(ranges[0])}.`;
  const listed = heads <= 4 ? ranges.map(fmt).join('; ') : `${fmt(ranges[0])}; ${fmt(ranges[1])}; … ; ${fmt(ranges[heads - 1])}`;
  return `${total} columns split into ${heads} contiguous slices of ${headDim}: ${listed}.`;
}

// ---------------------------------------------------------------- Toy two-head example

/**
 * Hand-picked toy numbers (not learned weights): T = 3, d_model = 4, H = 2, d_head = 2.
 * W_K and W_V are identity matrices and W_Q = 2·I, so head 1 only "sees" input features 0–1
 * and head 2 only features 2–3. Real learned projections mix all features.
 */
export const TOY = Object.freeze({
  tokens: ['The', 'sky', 'is'],
  heads: 2,
  X: [[1, 0, 0, 1], [0, 1, 1, 0], [1, 0, 1, 0]],
  WQ: [[2, 0, 0, 0], [0, 2, 0, 0], [0, 0, 2, 0], [0, 0, 0, 2]],
  WK: [[1, 0, 0, 0], [0, 1, 0, 0], [0, 0, 1, 0], [0, 0, 0, 1]],
  WV: [[1, 0, 0, 0], [0, 1, 0, 0], [0, 0, 1, 0], [0, 0, 0, 1]],
  WO: [[0.5, 0, 0.5, 0], [0, 0.5, 0, 0.5], [0.5, 0, -0.5, 0], [0, 0.5, 0, -0.5]],
});

/** Run causal two-head attention on the toy data using the shared math module. */
export function toyMultiHead(toy = TOY) {
  const Q = math.project(toy.X, toy.WQ, { nameX: 'X', nameW: 'W_Q' });
  const K = math.project(toy.X, toy.WK, { nameX: 'X', nameW: 'W_K' });
  const V = math.project(toy.X, toy.WV, { nameX: 'X', nameW: 'W_V' });
  const qs = math.splitHeads(Q, toy.heads);
  const ks = math.splitHeads(K, toy.heads);
  const vs = math.splitHeads(V, toy.heads);
  const perHead = qs.map((q, h) => ({ Q: q, K: ks[h], V: vs[h], ...math.attention(q, ks[h], vs[h], { causal: true }) }));
  const concat = math.concatHeads(perHead.map((h) => h.output));
  const output = math.matmul(concat, toy.WO, { nameA: 'Concat', nameB: 'W_O' });
  return { Q, K, V, perHead, concat, output };
}

// ---------------------------------------------------------------- Knowledge check data

export const CHECK_CONFIG = Object.freeze({ dModel: 4096, heads: 32, T: 10 });

export function checkAnswers({ dModel, heads, T } = CHECK_CONFIG) {
  const stats = headStats({ T, dModel, heads });
  return Object.freeze({
    headDim: stats.headDim,
    perHeadQ: [T, stats.headDim],
    scores: stats.shapes.scoresPerHead,
    scoreElements: stats.scoreElements,
    concat: stats.shapes.concat,
    projectionParams: stats.projectionParams,
  });
}

// ---------------------------------------------------------------- DOM

const SVG_NS = 'http://www.w3.org/2000/svg';

function svgEl(doc, tag, attrs = {}) {
  const node = doc.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, String(v));
  return node;
}

/** Draw the [T, H·d_head] column strip divided into head slices. */
function drawPartition(svg, heads, headDim) {
  const doc = svg.ownerDocument;
  // Match the drawing width to the rendered width so labels keep a readable size on phones.
  const available = Math.round(svg.parentElement?.clientWidth || 640);
  const width = Math.max(300, Math.min(640, available));
  const x0 = 4;
  const barWidth = width - 2 * x0;
  const total = heads * headDim;
  svg.replaceChildren();
  svg.setAttribute('viewBox', `0 0 ${width} 74`);
  const ranges = headColumnRanges(heads, headDim);
  const slice = barWidth / heads;
  ranges.forEach((r, i) => {
    const rect = svgEl(doc, 'rect', { x: x0 + i * slice, y: 22, width: slice, height: 28, class: i % 2 === 0 ? 'mha-slice' : 'mha-slice mha-slice-alt' });
    svg.append(rect);
    if (slice >= 34) {
      const label = svgEl(doc, 'text', { x: x0 + i * slice + slice / 2, y: 41, 'text-anchor': 'middle', class: 'mha-slice-label' });
      label.textContent = `h${r.head}`;
      svg.append(label);
    }
  });
  const left = svgEl(doc, 'text', { x: x0, y: 14, class: 'mha-axis-label' });
  left.textContent = 'column 0';
  const right = svgEl(doc, 'text', { x: width - x0, y: 14, 'text-anchor': 'end', class: 'mha-axis-label' });
  right.textContent = `column ${total - 1}`;
  const below = svgEl(doc, 'text', { x: width / 2, y: 68, 'text-anchor': 'middle', class: 'mha-axis-label' });
  below.textContent = `${heads} head${heads === 1 ? '' : 's'} × ${headDim} columns = ${total}`;
  svg.append(left, right, below);
}

function mountShapeExplorer(doc) {
  const root = doc.getElementById('mha-explorer');
  if (!root) return;
  const headInputs = [...root.querySelectorAll('input[name="mha-heads"]')];
  const modeInputs = [...root.querySelectorAll('input[name="mha-dhead-mode"]')];
  const tInput = doc.getElementById('mha-t');
  const dInput = doc.getElementById('mha-dhead');
  const error = doc.getElementById('mha-error');
  const svg = doc.getElementById('mha-partition');
  const partitionText = doc.getElementById('mha-partition-text');
  const stageList = doc.getElementById('mha-stages');
  const out = (id) => doc.getElementById(id);

  // Build the stage rows once; later updates only change their text.
  const initial = shapeStages(math.mhaShapes({ T: DEFAULT_T, dModel: D_MODEL, heads: DEFAULT_HEADS }));
  const rows = new Map();
  initial.forEach((stage) => {
    const op = ui.el(doc, 'span', { className: 'mha-stage-op' });
    const sym = ui.el(doc, 'span', { className: 'mha-stage-sym shape' });
    const num = ui.el(doc, 'span', { className: 'mha-stage-shape shape' });
    const li = ui.el(doc, 'li', { className: 'mha-stage', attrs: { 'data-stage': stage.id } }, [
      ui.el(doc, 'span', { className: 'mha-stage-step', text: stage.step }), op,
      ui.el(doc, 'span', { className: 'mha-stage-shapes' }, [sym, ui.el(doc, 'span', { text: ' = ', attrs: { 'aria-hidden': 'true' } }), num]),
    ]);
    if (stage.id === 'reshape') li.append(svg.closest('.mha-partition'));
    stageList.append(li);
    rows.set(stage.id, { op, sym, num });
  });

  function read() {
    const heads = Number(headInputs.find((i) => i.checked)?.value ?? DEFAULT_HEADS);
    const independent = modeInputs.find((i) => i.checked)?.value === 'independent';
    dInput.disabled = !independent;
    const t = parseIntegerField(tInput.value, { name: 'Sequence length T', ...T_LIMITS });
    if (t.error) return { error: t.error };
    if (!independent) return { heads, T: t.value };
    const d = parseIntegerField(dInput.value, { name: 'd_head', ...HEAD_DIM_LIMITS });
    if (d.error) return { error: d.error };
    return { heads, T: t.value, headDim: d.value };
  }

  function update() {
    const input = read();
    if (input.error) {
      error.textContent = input.error;
      error.hidden = false;
      root.classList.add('is-invalid');
      return;
    }
    error.hidden = true;
    root.classList.remove('is-invalid');
    const stats = headStats({ T: input.T, heads: input.heads, headDim: input.headDim });
    const { shapes } = stats;
    for (const stage of shapeStages(shapes)) {
      const row = rows.get(stage.id);
      row.op.textContent = stage.op;
      row.sym.textContent = ui.fmtShape(stage.symbolic);
      row.num.textContent = ui.fmtShape(stage.shape);
    }
    drawPartition(svg, shapes.heads, shapes.headDim);
    partitionText.textContent = describePartition(shapes.heads, shapes.headDim);
    out('mha-out-dhead').textContent = String(shapes.headDim);
    out('mha-out-inner').textContent = `${shapes.heads} × ${shapes.headDim} = ${ui.fmtInt(shapes.inner)}`;
    out('mha-out-qhead').textContent = ui.fmtShape([shapes.T, shapes.headDim]);
    out('mha-out-scores').textContent = `${shapes.heads} × ${ui.fmtInt(shapes.T)} × ${ui.fmtInt(shapes.T)} = ${ui.fmtInt(stats.scoreElements)} elements`;
    out('mha-out-scorebytes').textContent = math.formatBytes(stats.scoreBytes);
    out('mha-out-macs').textContent = `${ui.fmtInt(shapes.T)}² × ${ui.fmtInt(shapes.inner)} = ${ui.fmtInt(stats.scoreMultiplyAdds)}`;
    out('mha-out-params').textContent = `4 × ${D_MODEL} × ${ui.fmtInt(shapes.inner)} = ${ui.fmtInt(stats.projectionParams)}`;
    out('mha-out-wo').textContent = ui.fmtShape(shapes.wo);
    out('mha-out-note').textContent = shapes.conventional
      ? `Equal partition: H · d_head = ${D_MODEL} = d_model, so the projection parameter count is the same 4 · 512² = 1,048,576 for every H. Changing H only changes how the ${D_MODEL} columns are grouped.`
      : `H · d_head = ${ui.fmtInt(shapes.inner)} ≠ d_model = ${D_MODEL}. W_Q, W_K and W_V are now [512, ${ui.fmtInt(shapes.inner)}] and W_O maps ${ui.fmtInt(shapes.inner)} back to ${D_MODEL}, so parameters and per-head work change with your choice of d_head.`;
  }

  root.addEventListener('change', update);
  tInput.addEventListener('input', update);
  dInput.addEventListener('input', update);
  let lastWidth = 0;
  doc.defaultView?.addEventListener('resize', () => {
    const w = svg.parentElement?.clientWidth || 0;
    if (Math.abs(w - lastWidth) > 20 && !root.classList.contains('is-invalid')) { lastWidth = w; update(); }
  });
  update();
  lastWidth = svg.parentElement?.clientWidth || 0;
}

function mountToyDemo(doc) {
  const root = doc.getElementById('toy-heads');
  if (!root) return;
  const result = toyMultiHead();
  const tokens = TOY.tokens;
  const explanation = ui.el(doc, 'p', {text: 'Same sentence, wider toy: 4-component inputs, two 2-component heads and new projection matrices. This is a separate model from the 2-component example. Its intentionally sparse matrices select particular features; real learned projections can mix all input features into every head.'});
  doc.getElementById('toy-query').closest('.lab-controls').before(explanation);
  const featureCols = ['f0', 'f1', 'f2', 'f3'];
  const headCols = ['h1·0', 'h1·1', 'h2·0', 'h2·1'];
  ui.renderMatrix(doc.getElementById('toy-x'), TOY.X, { label: 'X [3, 4] (toy input)', rowLabels: tokens, colLabels: featureCols, digits: 0 });
  ui.renderMatrix(doc.getElementById('toy-q'), result.Q, { label: 'Q = X·W_Q [3, 4]', rowLabels: tokens, colLabels: headCols, role: 'q' });
  ui.renderMatrix(doc.getElementById('toy-k'), result.K, { label: 'K = X·W_K [3, 4]', rowLabels: tokens, colLabels: headCols, role: 'k' });
  ui.renderMatrix(doc.getElementById('toy-v'), result.V, { label: 'V = X·W_V [3, 4]', rowLabels: tokens, colLabels: headCols, role: 'v' });
  ui.renderMatrix(doc.getElementById('toy-concat'), result.concat, { label: 'Concat(head₁, head₂) [3, 4]', rowLabels: tokens, colLabels: headCols, role: 'o', digits: 3 });
  ui.renderMatrix(doc.getElementById('toy-out'), result.output, { label: 'MHA(X) = Concat · W_O [3, 4]', rowLabels: tokens, colLabels: ['o0', 'o1', 'o2', 'o3'], role: 'o', digits: 3 });

  const select = doc.getElementById('toy-query');
  const summary = doc.getElementById('toy-summary');
  function update() {
    const i = Number(select.value);
    result.perHead.forEach((head, h) => {
      const n = h + 1;
      ui.renderMatrix(doc.getElementById(`toy-a${n}`), head.weights, { label: `A${n === 1 ? '₁' : '₂'} (head ${n} weights) [3, 3]`, rowLabels: tokens, colLabels: tokens, role: 'w', digits: 3, highlightRow: i });
      ui.renderBars(doc.getElementById(`toy-bars${n}`), head.weights[i], tokens, { label: `Head ${n} weights for query ${tokens[i]}`, role: 'w', max: 1 });
      ui.renderMatrix(doc.getElementById(`toy-o${n}`), head.output, { label: `head${n === 1 ? '₁' : '₂'} = A${n === 1 ? '₁' : '₂'}·V${n === 1 ? '₁' : '₂'} [3, 2]`, rowLabels: tokens, colLabels: ['0', '1'], role: 'o', digits: 3, highlightRow: i });
    });
    const [w1, w2] = result.perHead.map((h) => h.weights[i]);
    const fmt = (w) => w.map((x, j) => `${tokens[j]} ${ui.fmtNumber(x, 3)}`).join(', ');
    const same = w1.every((x, j) => Math.abs(x - w2[j]) < 1e-9);
    summary.textContent = `Query ${tokens[i]}: head 1 weights ${fmt(w1)}; head 2 weights ${fmt(w2)}. `
      + (same
        ? (i === 0
          ? 'Under the causal mask The can only attend to itself, so every head gives it weight 1. Its outputs still differ because each head reads a different slice of V.'
          : 'Here both heads happen to produce the same weights, because each head’s query and key slices give the same score pattern. Their outputs still differ because each head reads its own V slice.')
        : 'Same input X, different weights: each head computes scores from its own slice of Q and K, and runs its own softmax.');
  }
  select.addEventListener('change', update);
  update();
}

function mountChecks(doc) {
  const a = checkAnswers();
  const { dModel, heads, T } = CHECK_CONFIG;
  const setup = `A layer has d<sub>model</sub> = ${ui.fmtInt(dModel)}, <var>H</var> = ${heads} heads with equal partition, and a sequence of <var>T</var> = ${T} tokens (no batch dimension).`;
  const shapeSummary = `<p>d<sub>head</sub> = ${ui.fmtInt(dModel)} / ${heads} = ${a.headDim}. Per-head Q is ${ui.fmtShape(a.perHeadQ)}; the score tensor is ${ui.fmtShape(a.scores)} = ${ui.fmtInt(a.scoreElements)} elements; head outputs are ${ui.fmtShape([heads, T, a.headDim])}; the concatenation is ${ui.fmtShape(a.concat)}; the final output after W<sub>O</sub> ${ui.fmtShape([dModel, dModel])} is ${ui.fmtShape([T, dModel])}.</p>`;

  const target = (id) => doc.getElementById(id);
  if (target('check-dhead')) ui.createKnowledgeCheck(target('check-dhead'), {
    type: 'numeric',
    questionHtml: `${setup} What is d<sub>head</sub>?`,
    correct: a.headDim,
    tolerance: 0,
    misconceptions: [
      { value: dModel * heads, tolerance: 0, message: 'You multiplied. With equal partition the heads share d_model, so divide: d_head = d_model / H.' },
      { value: dModel / T, tolerance: 0, message: 'T is the number of token positions; it does not affect d_head.' },
    ],
    explanationHtml: shapeSummary,
  });
  if (target('check-scores')) ui.createKnowledgeCheck(target('check-scores'), {
    type: 'numeric',
    questionHtml: `${setup} How many elements does the per-head score tensor S (all heads together, one layer) contain?`,
    correct: a.scoreElements,
    tolerance: 0,
    misconceptions: [
      { value: T * T, tolerance: 0, message: `That is one head's [${T}, ${T}] matrix. Every head computes its own, so multiply by H = ${heads}.` },
      { value: heads * T * a.headDim, tolerance: 0, message: `That is the size of the per-head Q tensor [${heads}, ${T}, ${a.headDim}]. Scores compare every query position with every key position: [H, T, T].` },
      { value: heads * T, tolerance: 0, message: 'Each head has one score per (query, key) pair, so the per-head matrix is T × T, not T.' },
    ],
    explanationHtml: `${shapeSummary}<p>S has shape [H, T, T] = [${heads}, ${T}, ${T}], so ${heads} × ${T} × ${T} = ${ui.fmtInt(a.scoreElements)}. d<sub>head</sub> does not appear: it is summed over inside each dot product.</p>`,
  });
  if (target('check-params')) ui.createKnowledgeCheck(target('check-params'), {
    type: 'numeric',
    questionHtml: `${setup} How many parameters do W<sub>Q</sub>, W<sub>K</sub>, W<sub>V</sub> and W<sub>O</sub> hold together (biases omitted)?`,
    correct: a.projectionParams,
    tolerance: 0,
    misconceptions: [
      { value: dModel * dModel, tolerance: 0, message: 'That is one d_model × d_model matrix. There are four: W_Q, W_K, W_V and W_O.' },
      { value: 3 * dModel * dModel, tolerance: 0, message: 'You counted W_Q, W_K and W_V but not the output projection W_O.' },
      { value: 4 * dModel * a.headDim, tolerance: 0, message: 'That is one head’s share. Across all H heads the projections are full [d_model, H·d_head] = [d_model, d_model] matrices.' },
    ],
    explanationHtml: `<p>Each of the four matrices is ${ui.fmtShape([dModel, dModel])} = ${ui.fmtInt(dModel * dModel)} parameters, so 4 × ${ui.fmtInt(dModel)}² = ${ui.fmtInt(a.projectionParams)}. With equal partition this count does not depend on H.</p>`,
  });
  if (target('check-double')) ui.createKnowledgeCheck(target('check-double'), {
    type: 'choice',
    questionHtml: `Keep d<sub>model</sub> = ${ui.fmtInt(dModel)} and <var>T</var> = ${T} fixed, and double <var>H</var> from ${heads} to ${heads * 2} with equal partition. Which statement is true?`,
    options: [
      { id: 'a', label: 'd_head halves to 64, projection parameters stay the same, and the score tensor doubles to [64, 10, 10].' },
      { id: 'b', label: 'd_head stays 128, so projection parameters double.' },
      { id: 'c', label: 'd_head halves and the score tensor halves, because each head is smaller.' },
      { id: 'd', label: 'Everything stays the same, but the model is guaranteed to be more accurate.' },
    ],
    correct: 'a',
    misconceptions: {
      b: 'With equal partition d_head = d_model / H, so it must shrink when H grows; the total projected width stays d_model.',
      c: 'Scores are [H, T, T]: d_head is not in that shape. More heads means more T × T matrices.',
      d: 'Shapes do change (d_head and the score tensor), and no head count guarantees better quality.',
    },
    explanationHtml: '<p>d<sub>head</sub> = 4096 / 64 = 64. W<sub>Q</sub>, W<sub>K</sub>, W<sub>V</sub>, W<sub>O</sub> are still [4096, 4096], so the parameter count is unchanged. The score tensor grows to [64, 10, 10] = 6,400 elements, while the QKᵀ multiply-adds stay T² · d<sub>model</sub> = 409,600 because each of the twice-as-many dot products is half as long. Whether that helps quality is an empirical question about the trained model.</p>',
  });
}

export function mount(doc) {
  mountShapeExplorer(doc);
  mountToyDemo(doc);
  mountChecks(doc);
}

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => mount(document));
  else mount(document);
}

export const lesson = Object.freeze({ number: 2, math, ui });
