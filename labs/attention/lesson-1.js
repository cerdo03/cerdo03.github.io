// Lesson 2.1: Self-attention from first principles.
//
// Structure:
// 1. Toy data and pure functions (no DOM). Every number shown in the lesson, including the
//    numbers written into the static prose, comes from these functions and attention-math.js.
//    tests/attention-lesson-1.test.mjs imports them and checks the page against them.
// 2. DOM widgets, mounted only when a document exists. Each widget keeps its own small state and
//    re-renders only its own output region.
import * as math from './attention-math.js';
import * as ui from './ui.js';

// ---------------------------------------------------------------- Toy data (invented values)

/** Toy 2-dimensional embeddings and learned weights. Invented for teaching, not from a real model. */
export const TOY = Object.freeze({
  tokens: Object.freeze(['animal', 'was', 'tired']),
  X: Object.freeze([[1, 0], [0, 1], [1, 1]]),
  WQ: Object.freeze([[1, 0], [0, 2]]),
  WK: Object.freeze([[2, 1], [-1, 2]]),
  WV: Object.freeze([[1, -1], [0, 2]]),
  // 4-token sequence for masking and O = AV: "The" is prepended with toy embedding [0.5, 0.5];
  // the other three rows are the same as X above.
  tokens4: Object.freeze(['The', 'animal', 'was', 'tired']),
  X4: Object.freeze([[0.5, 0.5], [1, 0], [0, 1], [1, 1]]),
});

/** Word-level split of the example sentence (real tokenizers often split differently). */
export const SENTENCE = Object.freeze(['The', 'animal', 'was', 'tired', 'because', 'it', 'had', 'been', 'running', '.']);
export const SENTENCE_DEFAULT = 5; // "it"

const plain = (M) => M.map((row) => [...row]);

/** Context available to one position. causal: positions j ≤ i are visible; otherwise all positions. */
export function contextFor(position, { causal = true } = {}) {
  if (!Number.isInteger(position) || position < 0 || position >= SENTENCE.length) {
    throw new Error(`position must be an integer from 0 to ${SENTENCE.length - 1}.`);
  }
  return SENTENCE.map((token, j) => ({
    token,
    index: j,
    status: j === position ? 'query' : (!causal || j < position ? 'visible' : 'future'),
  }));
}

/** Q = X W_Q, K = X W_K, V = X W_V for the 3-token toy (biases omitted). */
export function projections(X = TOY.X) {
  return {
    Q: math.project(plain(X), plain(TOY.WQ), { nameX: 'X', nameW: 'W_Q' }),
    K: math.project(plain(X), plain(TOY.WK), { nameX: 'X', nameW: 'W_K' }),
    V: math.project(plain(X), plain(TOY.WV), { nameX: 'X', nameW: 'W_V' }),
  };
}

/** The terms of x · W column by column, for showing the arithmetic. value comes from math.project. */
export function projectionSteps(x, W) {
  const [result] = math.project([x], plain(W));
  return result.map((value, c) => ({ terms: x.map((xr, r) => [xr, W[r][c]]), value }));
}

// ---------------------------------------------------------------- Score explorer

export const QUERY_LIMIT = 4;
export const QUERY_STEP = 0.5;

/** Validate one learner-entered query component: a number in [−4, 4] in steps of 0.5. */
export function parseQueryComponent(text) {
  const value = ui.parseNumber(text);
  if (value === null) return { ok: false, error: 'Enter a number such as 1, −0.5 or 2.5.' };
  if (Math.abs(value) > QUERY_LIMIT) return { ok: false, error: `Keep each component between −${QUERY_LIMIT} and ${QUERY_LIMIT}.` };
  if (!Number.isInteger(value / QUERY_STEP)) return { ok: false, error: 'Use steps of 0.5 (for example 1.5, not 1.25).' };
  return { ok: true, value };
}

const norm = (v) => Math.sqrt(math.dot(v, v));

/** Products, raw scores, norms and cosine similarity of one query against every key. */
export function scoreBreakdown(q, K) {
  const qNorm = norm(q);
  const rows = K.map((k) => {
    const products = math.elementwiseProducts(q, k, { nameA: 'q', nameB: 'k' });
    const score = math.dot(q, k, { nameA: 'q', nameB: 'k' });
    const keyNorm = norm(k);
    return { products, score, keyNorm, cosine: qNorm > 0 && keyNorm > 0 ? score / (qNorm * keyNorm) : null };
  });
  return { qNorm, rows };
}

/** Stable softmax shown step by step: z = scale·s, m = max z, z − m, exp(z − m), sum, weights. */
export function softmaxBreakdown(scores, scale) {
  const scaled = math.scaleMatrix([scores], scale)[0];
  const max = Math.max(...scaled);
  const shifted = scaled.map((z) => z - max);
  const exps = shifted.map((z) => Math.exp(z));
  const sum = exps.reduce((a, b) => a + b, 0);
  return { scale, scaled, max, shifted, exps, sum, weights: math.stableSoftmax(scaled) };
}

// ---------------------------------------------------------------- Scaling example

/** d_k = 16 sign vectors: each key is q with its first f signs flipped, so q · k = 16 − 2f. */
export const SCALING = Object.freeze({
  dk: 16,
  q: Object.freeze([1, -1, 1, 1, -1, 1, -1, -1, 1, 1, -1, 1, -1, 1, 1, -1]),
  flips: Object.freeze([4, 6, 8, 10]),
  labels: Object.freeze(['k₁', 'k₂', 'k₃', 'k₄']),
});

export function scalingExample() {
  const q = [...SCALING.q];
  const keys = SCALING.flips.map((f) => q.map((x, i) => (i < f ? -x : x)));
  const raw = math.rawScores([q], keys)[0];
  const scale = math.defaultScale(SCALING.dk);
  const unscaled = softmaxBreakdown(raw, 1);
  const scaled = softmaxBreakdown(raw, scale);
  // Local slope of the top weight with respect to its own raw score s₁:
  // ∂a₁/∂s₁ = scale · a₁(1 − a₁).
  const slope = (b) => b.scale * b.weights[0] * (1 - b.weights[0]);
  return { q, keys, raw, scale, unscaled, scaled, slopeUnscaled: slope(unscaled), slopeScaled: slope(scaled) };
}

// ---------------------------------------------------------------- Masking and O = AV

export function maskExample({ causal }) {
  const { Q, K, V } = projections(TOY.X4);
  return { Q, K, V, ...math.attention(Q, K, V, { causal }) };
}

/** Weighted value contributions for one row of the causal 4-token example. */
export function outputRow(i, { causal = true } = {}) {
  const ex = maskExample({ causal });
  const weights = ex.weights[i];
  const { contributions, output } = math.weightedValueContributions(weights, ex.V);
  const top = weights.indexOf(Math.max(...weights));
  const rest = output.map((x, c) => x - contributions[top][c]);
  return { weights, V: ex.V, contributions, output, top, rest, O: ex.output };
}

// ---------------------------------------------------------------- Numbers written into the prose

const f2 = (x) => ui.fmtNumber(x, 2);
const f3 = (x) => ui.fmtNumber(x, 3);
const v2 = (v) => ui.fmtVector(v, 2);
const v3 = (v) => ui.fmtVector(v, 3);

/** Every number written into lesson-1.html prose (data-num="key"), computed from the model. */
export function proseNumbers() {
  const { Q, K, V } = projections();
  const q3 = Q[2];
  const s3 = scoreBreakdown(q3, K);
  const sm = softmaxBreakdown(s3.rows.map((r) => r.score), math.defaultScale(2));
  const sc = scalingExample();
  const causal = maskExample({ causal: true });
  const bidir = maskExample({ causal: false });
  const out = outputRow(3);
  return {
    'x3': v2(TOY.X[2]),
    'q3': v2(q3), 'k3': v2(K[2]), 'v3': v2(V[2]),
    'k1': v2(K[0]), 'k2': v2(K[1]),
    's31-terms': `1·2 + 2·1 = ${f2(s3.rows[0].score)}`,
    's32-terms': `1·(−1) + 2·2 = ${f2(s3.rows[1].score)}`,
    's31': f2(s3.rows[0].score), 's32': f2(s3.rows[1].score), 's33': f2(s3.rows[2].score),
    'cos31': f2(s3.rows[0].cosine), 'cos33': f2(s3.rows[2].cosine),
    'norm-k1': f2(s3.rows[0].keyNorm), 'norm-k3': f2(s3.rows[2].keyNorm),
    'scaled3': v2(sm.scaled),
    'max3': f2(sm.max),
    'shifted3': v2(sm.shifted),
    'exps3': v3(sm.exps),
    'sum3': f3(sm.sum),
    'weights3': v3(sm.weights),
    'sc-raw': v2(sc.raw),
    'sc-scaled': v2(sc.scaled.scaled),
    'sc-w-unscaled': ui.fmtVector(sc.unscaled.weights, 6),
    'sc-w-scaled': v3(sc.scaled.weights),
    'sc-top-unscaled': f3(sc.unscaled.weights[0]),
    'sc-top-scaled': f3(sc.scaled.weights[0]),
    'sc-slope-unscaled': f3(sc.slopeUnscaled),
    'sc-slope-scaled': f3(sc.slopeScaled),
    'mask-was-causal': v3(causal.weights[2]),
    'mask-was-bidir': v3(bidir.weights[2]),
    'mask-tired': v3(causal.weights[3]),
    'out-weights': v3(out.weights),
    'out-c0': v3(out.contributions[0]), 'out-c1': v3(out.contributions[1]),
    'out-c2': v3(out.contributions[2]), 'out-c3': v3(out.contributions[3]),
    'out-o': v3(out.output),
    'out-rest': v3(out.rest),
    'v4-0': v2(causal.V[0]), 'v4-1': v2(causal.V[1]), 'v4-2': v2(causal.V[2]), 'v4-3': v2(causal.V[3]),
  };
}

// ---------------------------------------------------------------- DOM widgets

export const lesson = Object.freeze({ number: 1, math, ui });

const ROLE_SUB = ['₁', '₂', '₃', '₄'];

function radioGroup(doc, { legend, name, labels, checked, onChange }) {
  const fieldset = ui.el(doc, 'fieldset', { className: 'segmented' }, [ui.el(doc, 'legend', { text: legend })]);
  labels.forEach((text, i) => {
    const input = ui.el(doc, 'input', { attrs: { type: 'radio', name, value: String(i) } });
    input.checked = i === checked;
    input.addEventListener('change', () => { if (input.checked) onChange(i); });
    fieldset.append(ui.el(doc, 'label', {}, [input, doc.createTextNode(text)]));
  });
  return fieldset;
}

function simpleTable(doc, { caption, head, rows, rowHeader = true, className }) {
  const table = ui.el(doc, 'table', { className });
  if (caption) table.append(ui.el(doc, 'caption', { text: caption }));
  table.append(ui.el(doc, 'thead', {}, [ui.el(doc, 'tr', {}, head.map((h) => ui.el(doc, 'th', { text: h, attrs: { scope: 'col' } })))]));
  const body = ui.el(doc, 'tbody');
  for (const row of rows) {
    const cells = row.cells.map((c, j) => {
      const node = rowHeader && j === 0 ? ui.el(doc, 'th', { attrs: { scope: 'row' } }) : ui.el(doc, 'td');
      if (c instanceof doc.defaultView.Node) node.append(c); else node.textContent = c;
      return node;
    });
    body.append(ui.el(doc, 'tr', { className: row.className }, cells));
  }
  table.append(body);
  return ui.el(doc, 'section', { className: 'table-scroll', attrs: { tabindex: '0', 'aria-label': caption || 'Worked table' } }, [table]);
}

function para(doc, text) { return ui.el(doc, 'p', { text }); }

function withTag(doc, role, label, text) {
  return ui.el(doc, 'span', {}, [ui.tensorTag(doc, role, label), doc.createTextNode(` ${text}`)]);
}

function mountContext(root) {
  const doc = root.ownerDocument;
  const controls = root.querySelector('[data-part="controls"]');
  const body = root.querySelector('[data-part="body"]');
  const output = root.querySelector('[data-part="output"]');
  function render(position) {
    const ctx = contextFor(position, { causal: true });
    const visible = ctx.filter((c) => c.status === 'visible').length;
    const statusText = { query: 'Query position (the row being computed)', visible: 'Visible: one attention step away', future: 'Future: hidden in a causal decoder' };
    body.replaceChildren(simpleTable(doc, {
      caption: `Context for "${SENTENCE[position]}" (position ${position + 1}) in a causal decoder`,
      head: ['Position', 'Token', 'Status'],
      rows: ctx.map((c) => ({ cells: [String(c.index + 1), c.token, statusText[c.status]], className: c.status === 'query' ? 'is-highlight' : (c.status === 'future' ? 'is-reused' : undefined) })),
    }));
    const farthest = position;
    output.replaceChildren(para(doc, visible === 0
      ? `"${SENTENCE[position]}" is the first position, so in a causal decoder it can only attend to itself.`
      : `"${SENTENCE[position]}" can read from ${visible} earlier position${visible === 1 ? '' : 's'} plus itself, each in a single attention step. The farthest visible token is ${farthest} position${farthest === 1 ? '' : 's'} back; a recurrent network would need ${farthest} sequential state update${farthest === 1 ? '' : 's'} to carry information that far.`));
  }
  controls.replaceChildren(radioGroup(doc, { legend: 'Query position', name: 'l1-context', labels: SENTENCE.map((t, i) => `${i + 1} ${t}`), checked: SENTENCE_DEFAULT, onChange: render }));
  render(SENTENCE_DEFAULT);
}

function mountProjections(root) {
  const doc = root.ownerDocument;
  const body = root.querySelector('[data-part="body"]');
  const output = root.querySelector('[data-part="output"]');
  const { Q, K, V } = projections();
  const weights = [['q', 'W_Q', TOY.WQ, Q], ['k', 'W_K', TOY.WK, K], ['v', 'W_V', TOY.WV, V]];
  const matrices = ui.el(doc, 'div');
  body.replaceChildren(matrices);
  function render(i) {
    const x = TOY.X[i];
    matrices.replaceChildren();
    const xWrap = ui.el(doc, 'div');
    ui.renderMatrix(xWrap, plain(TOY.X), { label: 'X (input rows, one per token) [3, 2]', rowLabels: TOY.tokens, colLabels: ['dim 1', 'dim 2'], highlightRow: i, digits: 2 });
    matrices.append(xWrap);
    const lines = [];
    for (const [role, name, W, M] of weights) {
      const wWrap = ui.el(doc, 'div');
      ui.renderMatrix(wWrap, plain(W), { label: `${name} [2, 2] (learned, toy values)`, rowLabels: ['in 1', 'in 2'], colLabels: ['out 1', 'out 2'] });
      const mWrap = ui.el(doc, 'div');
      ui.renderMatrix(mWrap, M, { label: `${role.toUpperCase()} = X${name} [3, 2]`, rowLabels: TOY.tokens, colLabels: ['dim 1', 'dim 2'], highlightRow: i, role });
      matrices.append(ui.el(doc, 'h4', { text: `${role.toUpperCase()} projection` }), wWrap, mWrap);
      const steps = projectionSteps(x, W);
      const arith = steps.map((s) => `${s.terms.map(([a, b]) => `${ui.fmtNumber(a)}·${ui.fmtNumber(b)}`).join(' + ')} = ${ui.fmtNumber(s.value)}`).join(';  ');
      lines.push(ui.el(doc, 'li', {}, [withTag(doc, role, `${role}${ROLE_SUB[i]}`, `= x${ROLE_SUB[i]}${name} = ${ui.fmtVector(steps.map((s) => s.value))}   (${arith})`)]));
    }
    output.replaceChildren(
      para(doc, `Token "${TOY.tokens[i]}" has input row x${ROLE_SUB[i]} = ${ui.fmtVector(x)}. The same row goes through three different learned matrices:`),
      ui.el(doc, 'ul', {}, lines),
    );
  }
  render(2);
}

/** The single score explorer. Controls live in 2.1.3; its softmax view lives in 2.1.5 and shares state. */
function mountScoreExplorer(root, softRoot) {
  const doc = root.ownerDocument;
  const { Q, K } = projections();
  const state = { query: 2, q: [...Q[2]] };
  const controls = root.querySelector('[data-part="controls"]');
  const body = root.querySelector('[data-part="body"]');
  const output = root.querySelector('[data-part="output"]');
  const softBody = softRoot?.querySelector('[data-part="body"]');
  const softOutput = softRoot?.querySelector('[data-part="output"]');

  const makeSelect = (id) => {
    const select = ui.el(doc, 'select', { attrs: { id } });
    TOY.tokens.forEach((t, i) => select.append(ui.el(doc, 'option', { text: `q${ROLE_SUB[i]} (${t})`, attrs: { value: String(i) } })));
    return select;
  };
  const select = makeSelect('l1-score-query');
  softRoot?.querySelector('[data-score-reference]')?.addEventListener('click', () => {
    for (let parent = root.parentElement; parent; parent = parent.parentElement) if (parent.tagName === 'DETAILS') parent.open = true;
  });
  controls.replaceChildren(ui.el(doc, 'label', {className: 'field', attrs: {for: 'l1-score-query'}}, [ui.el(doc, 'span', {text: 'Inspect fixed query row'}), select]));
  const scoreTable = ui.el(doc, 'div');
  const scoreBars = ui.el(doc, 'div');
  body.replaceChildren(scoreTable, ui.el(doc, 'h4', { text: 'Raw scores sⱼ = q · kⱼ' }), scoreBars);
  const softTable = ui.el(doc, 'div');
  const softBars = ui.el(doc, 'div');
  softBody?.replaceChildren(softTable, ui.el(doc, 'h4', { text: 'Attention weights aⱼ (sum to 1)' }), softBars);

  function syncInputs() {
    select.value = String(state.query);
  }

  function render() {
    const qLabel = `q${ROLE_SUB[state.query]} (${TOY.tokens[state.query]}) = ${ui.fmtVector(state.q)}`;
    const br = scoreBreakdown(state.q, K);
    const scores = br.rows.map((r) => r.score);
    scoreTable.replaceChildren(simpleTable(doc, {
      caption: `Query ${qLabel}, ‖q‖ = ${ui.fmtNumber(br.qNorm)}`,
      head: ['Key', 'kⱼ', 'q₁·kⱼ₁', 'q₂·kⱼ₂', 'Sum sⱼ', '‖kⱼ‖', 'cosine'],
      rows: br.rows.map((r, j) => ({ cells: [`k${ROLE_SUB[j]} (${TOY.tokens[j]})`, ui.fmtVector(K[j]), ui.fmtNumber(r.products[0]), ui.fmtNumber(r.products[1]), ui.fmtNumber(r.score), ui.fmtNumber(r.keyNorm), r.cosine === null ? 'undefined (q = 0)' : ui.fmtNumber(r.cosine)] })),
    }));
    const top = scores.indexOf(Math.max(...scores));
    ui.renderBars(scoreBars, scores, TOY.tokens.map((t, j) => `k${ROLE_SUB[j]} ${t}`), { format: (x) => ui.fmtNumber(x, 2), highlightIndex: top, label: 'Raw scores', role: 'k' });
    const ties = scores.filter((s) => s === scores[top]).length;
    const tied = br.rows.map((r, j) => ({ r, j })).filter(({ r }) => r.score === scores[top]);
    const sentences = [ties > 1
      ? `${ties} keys tie for the highest raw score (${ui.fmtNumber(scores[top])}): ${tied.map(({ r, j }) => `k${ROLE_SUB[j]} has cosine ${r.cosine === null ? 'undefined' : ui.fmtNumber(r.cosine)} and length ${ui.fmtNumber(r.keyNorm)}`).join('; ')}. Equal scores do not mean equal direction.`
      : `Highest raw score: k${ROLE_SUB[top]} (${TOY.tokens[top]}) with ${ui.fmtNumber(scores[top])}.`];
    const bestCos = br.rows.map((r) => r.cosine ?? -Infinity);
    const cosTop = bestCos.indexOf(Math.max(...bestCos));
    if (br.qNorm > 0 && cosTop !== top) sentences.push(`The key most aligned in direction is k${ROLE_SUB[cosTop]} (cosine ${ui.fmtNumber(bestCos[cosTop])}), so the ranking here is driven partly by key length, not direction alone.`);
    if (br.qNorm === 0) sentences.push('With q = [0, 0] every score is 0: the query expresses no preference.');
    output.replaceChildren(para(doc, sentences.join(' ')));

    if (softRoot) {
      const sm = softmaxBreakdown(scores, math.defaultScale(2));
      softTable.replaceChildren(simpleTable(doc, {
        caption: `Softmax of ${qLabel}; scale 1/√2 ≈ ${ui.fmtNumber(sm.scale, 3)}, m = max zⱼ = ${ui.fmtNumber(sm.max, 3)}`,
        head: ['Key', 'Raw sⱼ', 'zⱼ = sⱼ/√2', 'zⱼ − m', 'exp(zⱼ − m)', 'aⱼ = exp / Σ'],
        rows: [
          ...scores.map((s, j) => ({ cells: [`k${ROLE_SUB[j]} (${TOY.tokens[j]})`, ui.fmtNumber(s), ui.fmtNumber(sm.scaled[j], 3), ui.fmtNumber(sm.shifted[j], 3), ui.fmtNumber(sm.exps[j], 3), ui.fmtWeight(sm.weights[j], 3)] })),
          { cells: ['Σ', '', '', '', ui.fmtNumber(sm.sum, 3), ui.fmtNumber(sm.weights.reduce((a, b) => a + b, 0), 3)] },
        ],
      }));
      const wTop = sm.weights.indexOf(Math.max(...sm.weights));
      ui.renderBars(softBars, sm.weights, TOY.tokens.map((t, j) => `a${ROLE_SUB[j]} ${t}`), { format: (x) => ui.fmtNumber(x, 3), max: 1, highlightIndex: wTop, label: 'Attention weights', role: 'w' });
      const minW = Math.min(...sm.weights);
      softOutput.replaceChildren(para(doc, `Largest weight ${ui.fmtWeight(sm.weights[wTop], 3)} on ${TOY.tokens[wTop]}; smallest ${ui.fmtWeight(minW, 3)}. Every weight is positive: softmax never assigns exactly 0 to a finite score. The ordering of the weights matches the ordering of the raw scores.`));
    }
  }

  function chooseQuery(i) {
    state.query = i;
    state.q = [...Q[i]];
    syncInputs();
    render();
  }

  select.addEventListener('change', () => chooseQuery(Number(select.value)));
  syncInputs();
  render();
}

function mountScaling(root) {
  const doc = root.ownerDocument;
  const ex = scalingExample();
  const controls = root.querySelector('[data-part="controls"]');
  const body = root.querySelector('[data-part="body"]');
  const output = root.querySelector('[data-part="output"]');
  const vectors = ui.el(doc, 'div');
  ui.renderMatrix(vectors, [ex.q, ...ex.keys], {
    label: 'Query q and keys k₁–k₄ (dₖ = 16, entries ±1)',
    rowLabels: ['q', ...SCALING.flips.map((f, j) => `${SCALING.labels[j]} (${f} flipped)`)],
    colLabels: ex.q.map((_, i) => String(i + 1)),
    digits: 0,
  });
  const compare = simpleTable(doc, {
    caption: 'Side by side: the same raw scores, softmaxed with and without scaling',
    head: ['Key', 'Raw s = q · k', 'Scaled s/√16', 'Weight, unscaled', 'Weight, scaled'],
    rows: ex.raw.map((s, j) => ({ cells: [SCALING.labels[j], ui.fmtNumber(s), ui.fmtNumber(ex.scaled.scaled[j]), ui.fmtNumber(ex.unscaled.weights[j], 6), ui.fmtNumber(ex.scaled.weights[j], 6)] })),
  });
  const detail = ui.el(doc, 'div');
  body.replaceChildren(vectors, compare, ui.el(doc, 'h4', { text: 'Selected softmax input' }), detail);
  function render(mode) {
    const b = mode === 0 ? ex.unscaled : ex.scaled;
    const name = mode === 0 ? 'unscaled (z = s)' : 'scaled (z = s/4)';
    const bars = ui.el(doc, 'div');
    ui.renderBars(bars, b.weights, [...SCALING.labels], { format: (x) => ui.fmtNumber(x, 6), max: 1, highlightIndex: 0, label: `Weights, ${name}`, role: 'w' });
    detail.replaceChildren(
      para(doc, `Softmax input ${name}: z = ${ui.fmtVector(b.scaled)}, gaps between neighbouring keys = ${ui.fmtNumber(b.scaled[0] - b.scaled[1])}.`),
      bars,
    );
    const slope = mode === 0 ? ex.slopeUnscaled : ex.slopeScaled;
    output.replaceChildren(para(doc, mode === 0
      ? `Unscaled: k₁ takes ${ui.fmtNumber(b.weights[0], 3)} of the weight and k₃, k₄ are effectively ignored. The top weight's local slope with respect to its raw score, ∂a₁/∂s₁ = a₁(1 − a₁), is only ${ui.fmtNumber(slope, 3)}: the softmax is close to saturation.`
      : `Scaled by 1/4: k₁ still wins (${ui.fmtNumber(b.weights[0], 3)}), but every key keeps a share. ∂a₁/∂s₁ = (1/4)·a₁(1 − a₁) = ${ui.fmtNumber(slope, 3)}, about ${ui.fmtNumber(slope / ex.slopeUnscaled, 1)}× the unscaled slope in this example.`));
  }
  controls.replaceChildren(radioGroup(doc, { legend: 'Softmax input', name: 'l1-scale', labels: ['Unscaled QKᵀ', 'Scaled QKᵀ/√dₖ'], checked: 0, onChange: render }));
  render(0);
}

function markMasked(doc, table, causal, T) {
  if (!causal) return;
  table.querySelectorAll('tbody tr').forEach((tr, i) => {
    tr.querySelectorAll('td').forEach((td, j) => {
      if (j < T && j > i) {
        td.classList.add('is-masked');
        td.append(ui.el(doc, 'span', { text: ' ✕', attrs: { 'aria-hidden': 'true' } }), ui.el(doc, 'span', { className: 'visually-hidden', text: ' masked' }));
      }
    });
  });
}

function mountMask(root) {
  const doc = root.ownerDocument;
  const controls = root.querySelector('[data-part="controls"]');
  const body = root.querySelector('[data-part="body"]');
  const output = root.querySelector('[data-part="output"]');
  const scoresWrap = ui.el(doc, 'div');
  const weightsWrap = ui.el(doc, 'div');
  body.replaceChildren(scoresWrap, weightsWrap);
  const T = TOY.tokens4.length;
  const rowLabels = TOY.tokens4.map((t, i) => `${i + 1} ${t}`);
  function render(mode) {
    const causal = mode === 0;
    const ex = maskExample({ causal });
    ui.renderMatrix(scoresWrap, ex.masked, {
      label: causal ? 'Masked scores QKᵀ/√2 + M (rows = queries, columns = keys)' : 'Scores QKᵀ/√2, no mask (rows = queries, columns = keys)',
      rowLabels, colLabels: TOY.tokens4, digits: 2,
    });
    const withSums = ex.weights.map((row) => [...row, row.reduce((a, b) => a + b, 0)]);
    const table = ui.renderMatrix(weightsWrap, withSums, {
      label: `Attention weights A, ${causal ? 'causal' : 'bidirectional'} (✕ = masked, weight exactly 0)`,
      rowLabels, colLabels: [...TOY.tokens4, 'Row sum'], digits: 3, role: 'w',
    });
    markMasked(doc, table, causal, T);
    const zeros = ex.weights.flat().filter((w) => w === 0).length;
    output.replaceChildren(para(doc, causal
      ? `Causal: ${zeros} of ${T * T} weights are exactly 0 (every cell above the diagonal). "The" puts weight ${ui.fmtNumber(ex.weights[0][0], 3)} on itself because it is the only visible key. The last row, "tired", is identical in both modes: the last position has no future to hide.`
      : `Bidirectional: ${zeros} weights are 0; every query mixes all four positions, including later ones. Encoder models such as BERT use this; decoder-only language models do not, because during generation later tokens do not exist yet and training must match that.`));
  }
  controls.replaceChildren(radioGroup(doc, { legend: 'Mask', name: 'l1-mask', labels: ['Causal (decoder)', 'Bidirectional (no mask)'], checked: 0, onChange: render }));
  render(0);
}

function mountOutput(root) {
  const doc = root.ownerDocument;
  const body = root.querySelector('[data-part="body"]');
  const output = root.querySelector('[data-part="output"]');
  const tableWrap = ui.el(doc, 'div');
  const barsWrap = ui.el(doc, 'div');
  const oWrap = ui.el(doc, 'div');
  body.replaceChildren(tableWrap, ui.el(doc, 'h4', { text: 'Weights in the selected row' }), barsWrap, oWrap);
  function render(i) {
    const r = outputRow(i);
    const rows = r.weights.map((w, j) => ({
      cells: [`${j + 1} ${TOY.tokens4[j]}`, `${ui.fmtNumber(w, 3)}${w === 0 ? ' (masked)' : ''}`, ui.fmtVector(r.V[j]), ui.fmtVector(r.contributions[j], 3)],
      className: j === r.top ? 'is-highlight' : (w === 0 ? 'is-masked' : undefined),
    }));
    rows.push({ cells: ['Σ', ui.fmtNumber(r.weights.reduce((a, b) => a + b, 0), 3), '', `o${ROLE_SUB[i]} = ${ui.fmtVector(r.output, 3)}`] });
    tableWrap.replaceChildren(simpleTable(doc, { caption: `Row ${i + 1} ("${TOY.tokens4[i]}"): oᵢ = Σⱼ aᵢⱼ vⱼ`, head: ['Key position j', 'Weight aᵢⱼ', 'Value vⱼ', 'Contribution aᵢⱼ·vⱼ'], rows }));
    ui.renderBars(barsWrap, r.weights, TOY.tokens4.map((t, j) => `${j + 1} ${t}`), { format: (x) => ui.fmtNumber(x, 3), max: 1, highlightIndex: r.top, label: 'Weights in the selected row', role: 'w' });
    ui.renderMatrix(oWrap, r.O, { label: 'O = AV [4, 2] (causal)', rowLabels: TOY.tokens4, colLabels: ['dim 1', 'dim 2'], highlightRow: i, digits: 3, role: 'o' });
    const active = r.weights.filter((w) => w > 0).length;
    output.replaceChildren(para(doc, active === 1
      ? `Only one key is visible, so o${ROLE_SUB[i]} equals v${ROLE_SUB[i]} = ${ui.fmtVector(r.output, 3)} exactly.`
      : `The largest weight is on "${TOY.tokens4[r.top]}" (${ui.fmtNumber(r.weights[r.top], 3)}), contributing ${ui.fmtVector(r.contributions[r.top], 3)}. The other ${active - 1} visible positions still add ${ui.fmtVector(r.rest, 3)}, so the output is a blend, not a copy of one value vector.`));
  }
  render(3);
}

const MASK_WAS_BIDIR = ui.fmtVector(maskExample({ causal: false }).weights[2], 3);
const MASK_WAS_CAUSAL = ui.fmtVector(maskExample({ causal: true }).weights[2], 3);
const TOY_QKV3 = (() => { const { Q, K, V } = projections(); return { x: ui.fmtVector(TOY.X[2]), q: ui.fmtVector(Q[2]), k: ui.fmtVector(K[2]), v: ui.fmtVector(V[2]) }; })();

const CHECKS = [
  {
    question: 'Why does self-attention compute separate queries, keys and values instead of using the input rows X directly for all three roles?',
    options: [
      { id: 'compress', label: 'Because X is too large to multiply with itself, so the projections are mainly a compression step.' },
      { id: 'norm', label: 'Because the values must be normalised to unit length before softmax, and W_V does that.' },
      { id: 'roles', label: 'Separate learned projections let what a token looks for (q), how it is matched (k) and what it passes on (v) differ, and the scores QKᵀ need not be symmetric.' },
      { id: 'same', label: 'There is no real difference; Q, K and V always end up equal after training.' },
    ],
    correct: 'roles',
    misconceptions: {
      compress: 'Projections can reduce width (d_k < d_model is common in multi-head attention), but that is not why three different matrices exist. They would be useful even with d_k = d_model.',
      norm: 'Nothing normalises V. Softmax normalises each score row into weights; values are mixed linearly.',
      same: 'Nothing forces W_Q, W_K and W_V to be equal, and in trained models they generally are not.',
    },
    explanationHtml: `<p>With <var>Q</var> = <var>K</var> = <var>X</var>, the score matrix <var>X</var><var>X</var><sup>T</sup> is symmetric and each token's score with itself is its squared norm, which is never negative and is often the largest entry in its row. Separate <var>W</var><sub>Q</sub> and <var>W</var><sub>K</sub> let the model learn an asymmetric compatibility, in which q<sub>i</sub>·k<sub>j</sub> need not equal q<sub>j</sub>·k<sub>i</sub>, and <var>W</var><sub>V</sub> lets the information that gets mixed differ from the information used for matching. In the toy example, x₃ = ${TOY_QKV3.x} becomes q₃ = ${TOY_QKV3.q}, k₃ = ${TOY_QKV3.k} and v₃ = ${TOY_QKV3.v}.</p>`,
  },
  {
    question: 'In the causal 4-token example ("The animal was tired"), what does the mask change for the query at position 3, "was"?',
    options: [
      { id: 'times-zero', label: 'Its score for position 4 is multiplied by 0 before softmax, so that key gets weight exp(0)/Σ.' },
      { id: 'renorm', label: 'Its weight on position 4 becomes exactly 0, and its weights on positions 1–3 are renormalised so they still sum to 1.' },
      { id: 'delete', label: 'Position 4 is deleted from the computation entirely, so the output row has fewer dimensions.' },
      { id: 'nothing', label: 'Nothing changes for position 3; the mask only affects the last position.' },
    ],
    correct: 'renorm',
    misconceptions: {
      'times-zero': 'Multiplying a score by 0 gives 0, and exp(0) = 1 is a positive weight. The mask adds −∞, so exp(−∞) = 0.',
      delete: 'The output row keeps shape [d_v]; only the set of positions that contribute to it shrinks.',
      nothing: 'The last position is the one row the causal mask does not change: it has no future positions.',
    },
    explanationHtml: `<p>The mask adds −∞ to scores with <var>j</var> &gt; <var>i</var>. After softmax those entries are exactly 0, and the remaining weights are exp(z<sub>j</sub> − m) divided by a sum over visible keys only, so they still sum to 1. For "was" the weights change from ${MASK_WAS_BIDIR} (bidirectional) to ${MASK_WAS_CAUSAL} (causal): the share that went to "tired" is redistributed over the visible positions in proportion to their exponentials.</p>`,
  },
  {
    question: 'The query row\'s attention weights shift from [0.8, 0.1, 0.1] to [0.4, 0.3, 0.3] while V stays the same. What happens to the output row o = Σⱼ aⱼvⱼ?',
    options: [
      { id: 'copy', label: 'It stays equal to v₁, because v₁ still has the largest weight.' },
      { id: 'shrink', label: 'It shrinks toward zero, because the largest weight halved.' },
      { id: 'undefined', label: 'It becomes undefined, because the weights no longer favour a single token.' },
      { id: 'blend', label: 'It moves from a blend dominated by v₁ toward the average of the three value vectors; it is still a weighted average of the same vectors.' },
    ],
    correct: 'blend',
    misconceptions: {
      copy: 'The output is never just the top value vector unless every other weight is exactly 0. All visible positions contribute in proportion to their weights.',
      shrink: 'Weights still sum to 1, so the output does not shrink toward zero; it moves inside the region spanned by the value vectors.',
      undefined: 'Any non-negative weights summing to 1 give a well-defined weighted average.',
    },
    explanationHtml: '<p><var>o</var> is linear in the weights: <var>o</var> = 0.8<var>v</var>₁ + 0.1<var>v</var>₂ + 0.1<var>v</var>₃ becomes 0.4<var>v</var>₁ + 0.3<var>v</var>₂ + 0.3<var>v</var>₃. Because the weights are non-negative and sum to 1, both outputs lie in the convex hull of the value vectors; flatter weights pull the output toward their mean (here 1/3 each would give the exact mean). The value vectors themselves do not change; only how much of each is mixed in.</p>',
  },
];

function mountChecks(container) {
  const doc = container.ownerDocument;
  container.replaceChildren();
  CHECKS.forEach((config) => {
    const slot = ui.el(doc, 'div');
    container.append(slot);
    ui.createKnowledgeCheck(slot, { type: 'choice', ...config });
  });
}

export const CHECK_CONFIG = CHECKS;

if (typeof document !== 'undefined') {
  const mount = (id, fn, ...extra) => {
    const node = document.getElementById(id);
    if (!node) return;
    try { fn(node, ...extra); } catch (err) {
      node.append(ui.el(document, 'p', { className: 'lab-error', text: `This widget could not load: ${err.message}`, attrs: { role: 'alert' } }));
    }
  };
  mount('lab-context', mountContext);
  mount('lab-proj', mountProjections);
  mount('lab-scores', mountScoreExplorer, document.getElementById('lab-softmax'));
  mount('lab-scale', mountScaling);
  mount('lab-mask', mountMask);
  mount('lab-output', mountOutput);
  mount('l1-checks', mountChecks);
}
