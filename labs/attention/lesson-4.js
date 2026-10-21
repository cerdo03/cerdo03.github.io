import {decodeReferenceStage} from '../llm-systems/visual-model.js';
// Lesson 2.4: KV-cache internals.
// Pure view models (exported, testable in Node) + DOM mounting guarded by `typeof document`.
// Widgets: 2.4.2 indexed hierarchy example, 2.4.3 static prefill view, 2.4.4 decode step tracer
// (primary), 2.4.5 with/without-cache counts and closed-form extrapolation, knowledge check.
import * as math from './attention-math.js';
import * as ui from './ui.js';
import * as kvSim from './kv-sim.js';
import {representations} from '../inference/guide-model.js';
function sharedEmbeddings() { try { const rows = JSON.parse(localStorage.getItem('inference-course-v4'))?.embeddings;if (Array.isArray(rows) && rows.length === 3 && rows.every(row=>Array.isArray(row)&&row.length===2&&row.every(x=>Number.isFinite(x)&&Math.abs(x)<=4))) return rows; } catch { /* Optional storage. */ }return representations.map(row=>[...row]); }

const { fmtNumber, fmtWeight, fmtVector, fmtInt, el, tensorTag, renderBars, createKnowledgeCheck } = ui;
const { createKvSim, toyCacheValue, SIM_ASSUMPTIONS } = kvSim;

export const lesson = Object.freeze({ number: 4, math, ui, kvSim });

// ---------------------------------------------------------------- 2.4.2 indexed hierarchy example

/** Toy conceptual cache dimensions for the indexed hierarchy example. */
export const HIERARCHY_DIMS = Object.freeze({ layers: 4, positions: 4, kvHeads: 2, headDim: 4 });
export const HIERARCHY_BYTES_PER_ELEMENT = math.BYTES_PER_ELEMENT.fp16;

/**
 * Index the conceptual K or V cache [L, T, H_KV, D] down to one [H_KV, D] slice.
 * Values come from toyCacheValue (deterministic toy numbers).
 */
export function sliceView({ kind, layer, position, dims = HIERARCHY_DIMS, bytesPerElem = HIERARCHY_BYTES_PER_ELEMENT }) {
  if (kind !== 'k' && kind !== 'v') throw new Error(`kind must be "k" or "v" (got ${String(kind)}).`);
  const { layers, positions, kvHeads, headDim } = dims;
  if (!Number.isInteger(layer) || layer < 0 || layer >= layers) throw new Error(`layer must be an integer in 0…${layers - 1}.`);
  if (!Number.isInteger(position) || position < 0 || position >= positions) throw new Error(`position must be an integer in 0…${positions - 1}.`);
  const values = Array.from({ length: kvHeads }, (_, h) => Array.from({ length: headDim }, (_, d) => toyCacheValue(kind, layer, position, h, d)));
  const elements = kvHeads * headDim;
  const fullElements = layers * positions * kvHeads * headDim;
  const name = kind === 'k' ? 'K' : 'V';
  return Object.freeze({
    kind, layer, position, values,
    tensorName: `${name}_cache`,
    path: `${name}_cache[ℓ=${layer}, t=${position}, :, :]`,
    fullShape: [layers, positions, kvHeads, headDim],
    shape: [kvHeads, headDim],
    elements,
    bytes: elements * bytesPerElem,
    fullElements,
    fullBytes: fullElements * bytesPerElem,
    perPositionBothBytes: 2 * layers * elements * bytesPerElem,
  });
}

// ---------------------------------------------------------------- 2.4.4 decode step tracer

const STATUS_TEXT = Object.freeze({
  new: 'new: computed, appended',
  reused: 'reused: read only',
  prefill: 'from prefill',
});

/**
 * Build the render model for the decode tracer from a kv-sim snapshot.
 * Rows mirror snapshot.cache; status says whether the latest pass created or reused each row.
 */
export function decodeView(snapshot) {
  const pass = snapshot.lastPass;
  const isDecode = pass?.kind === 'decode';
  const newPosition = isDecode ? pass.positions[0] : null;
  const readSet = new Set(isDecode ? pass.readPositions : []);
  const rows = snapshot.cache.map((entry) => {
    let status = 'prefill';
    if (isDecode) status = entry.position === newPosition ? 'new' : readSet.has(entry.position) ? 'reused' : 'prefill';
    return Object.freeze({ position: entry.position, token: entry.token, k: entry.k, v: entry.v, createdBy: entry.createdBy, status, statusText: STATUS_TEXT[status] });
  });
  const pending = snapshot.pending ? Object.freeze({ token: snapshot.pending.token, position: snapshot.pending.position, cached: false }) : null;
  const done = snapshot.phase === 'done';
  const stages = isDecode ? decodeStages(pass, snapshot.cache) : [];
  let summary;
  if (!pass) summary = 'Cache is empty.';
  else if (!isDecode) summary = `Prefill complete: cache length ${snapshot.cacheLength}. Sampled "${pending?.token ?? 'nothing'}" waits outside the cache until the next pass processes it.`;
  else {
    const p = newPosition;
    summary = `Decode step ${pass.index}: processed "${pass.inputTokens[0]}" at position ${p + 1}, read ${pass.cacheReads} cached K/V entries, scored ${pass.keysAttended} keys, appended 1 entry, cache length ${snapshot.cacheLength}. `
      + (pending ? `Sampled "${pending.token}" (position ${pending.position + 1}), not yet cached.` : 'End of the toy continuation: nothing more to process.');
  }
  return Object.freeze({
    phase: snapshot.phase,
    cacheLength: snapshot.cacheLength,
    sampled: snapshot.sampled,
    canStep: snapshot.canStep,
    done,
    step: isDecode ? pass.index : 0,
    rows: Object.freeze(rows),
    pending,
    stages: Object.freeze(stages),
    summary,
  });
}

const SUBSCRIPT_DIGITS = '₀₁₂₃₄₅₆₇₈₉';
/** 12 → "₁₂" (Unicode subscript digits for inline vector names). */
export function subscript(n) {
  return String(n).replace(/\d/g, (d) => SUBSCRIPT_DIGITS[Number(d)]);
}

function decodeStages(pass, cache) {
  const p = pass.positions[0];
  const sp = subscript(p + 1);
  const token = pass.inputTokens[0];
  const range = p === 1 ? 'position 1' : `positions 1–${p}`;
  const weights = pass.attention.weights.map((w, j) => Object.freeze({
    position: j,
    token: cache[j].token,
    weight: w,
    score: pass.attention.scores[j],
    source: j === p ? 'new' : 'reused',
  }));
  return [
    { id: 'input', title: '1. Input token and position', text: `"${token}" at position ${p + 1}. It was sampled at the end of the previous pass and has no K/V yet.` },
    { id: 'query', title: '2. Its query', role: 'q', vector: pass.query, text: `q${sp} = x${sp}·W_Q = ${fmtVector(pass.query, 3)}. Used only in this pass; queries are never cached.` },
    { id: 'new-kv', title: '3. New key and value (new)', text: `k${sp} = ${fmtVector(pass.newKey, 3)}, v${sp} = ${fmtVector(pass.newValue, 3)}. Exactly 1 position is projected.` },
    { id: 'read', title: '4. Read previous K/V (reused)', text: `${pass.cacheReads} cached entries for ${range} are read, not recomputed.` },
    { id: 'attend', title: '5. Attention over previous + current keys', weights, text: `q${sp} scores ${pass.keysAttended} keys (${pass.cacheReads} reused + 1 new), scaled by 1/√2, softmax gives weights; output o${sp} = ${fmtVector(pass.attention.output, 3)}.` },
    { id: 'append', title: '6. Append to the cache', text: `k${sp}, v${sp} are stored at position ${p + 1}. Cache length becomes ${pass.cacheLengthAfter}.` },
    {
      id: 'predict',
      title: '7. Next-token prediction',
      text: pass.sampled === null
        ? `o${sp} would continue to next-token logits, but the fixed toy continuation has ended, so nothing more is sampled.`
        : `o${sp} continues through the rest of the model to next-token logits (not modelled; the toy uses a fixed continuation). Sampled "${pass.sampled}" for position ${p + 2}: not yet cached.`,
    },
  ].map((s) => Object.freeze(s));
}

// ---------------------------------------------------------------- 2.4.5 with vs without cache

/** Run the whole toy example once and return its pass records (deterministic). */
export function fullRunPasses(prompt = kvSim.DEFAULT_PROMPT) {
  const sim = createKvSim();
  let snap = sim.prefill(prompt);
  while (snap.canStep) snap = sim.step();
  return snap.passes;
}

/** Per-pass and cumulative counters, straight from kv-sim pass records. */
export function comparisonRows(passes) {
  let cumWith = 0;
  let cumWithout = 0;
  return passes.map((pass) => {
    cumWith += pass.projectedWithCache;
    cumWithout += pass.projectedWithoutCache;
    return Object.freeze({
      label: pass.kind === 'prefill' ? 'Prefill' : `Decode step ${pass.index}`,
      kind: pass.kind,
      index: pass.index,
      positions: pass.positions,
      projectedWith: pass.projectedWithCache,
      projectedWithout: pass.projectedWithoutCache,
      cumWith,
      cumWithout,
      cacheReads: pass.cacheReads,
      keysAttended: pass.keysAttended,
      cacheEntriesAfter: pass.cacheLengthAfter,
    });
  });
}

/**
 * Closed-form counters per layer (and per KV head) for prompt length T and n decode steps.
 * Matches comparisonRows totals for the toy run (T = 4, n = 5).
 */
export function projectionTotals({ promptLength: T, steps: n }) {
  math.assertPositiveInteger(T, 'Prompt length T');
  math.assertPositiveInteger(n, 'Decode steps n');
  const withCache = T + n;
  const withoutCache = T + n * T + (n * (n + 1)) / 2;
  const result = {
    withCache,
    withoutCache,
    avoided: withoutCache - withCache,
    cacheReads: n * T + (n * (n - 1)) / 2,
    decodeKeysAttended: n * T + (n * (n + 1)) / 2,
    prefillKeysAttended: (T * (T + 1)) / 2,
    cacheEntries: T + n,
    ratio: withoutCache / withCache,
  };
  for (const [key, value] of Object.entries(result)) {
    if (!Number.isSafeInteger(value) && key !== 'ratio') throw new Error('Counts exceed the safe integer range; use smaller values.');
  }
  return Object.freeze(result);
}

export const EXTRAPOLATION_MAX = 1000000;

/** Parse a count field; returns { value } or { error }. */
export function parseCount(text, name, max = EXTRAPOLATION_MAX) {
  const value = ui.parseNumber(text);
  if (value === null || !Number.isInteger(value) || value < 1 || value > max) return { error: `${name} must be a whole number from 1 to ${fmtInt(max)}.` };
  return { value };
}

// ---------------------------------------------------------------- Knowledge check

export const CHECK_CONFIG = Object.freeze({
  type: 'choice',
  question: 'During decode, previous keys and values are reused from the cache. Why must attention still be computed for each new token?',
  options: [
    { id: 'new-query', label: 'The new token brings a new query, and that query has never been scored against the previous keys. The cache holds K and V, not attention results, so q·k scores and the weighted sum of values must be computed now.' },
    { id: 'outputs', label: 'The cache stores attention outputs for old positions, so attention is only needed to fold in the new key.' },
    { id: 'eliminates', label: 'It does not need to: with a cache, attention is skipped and only the new token’s projections are computed.' },
    { id: 'stale', label: 'Cached keys change after every step, so attention has to refresh them.' },
    { id: 'queries', label: 'Old queries are cached too, and attention scores them against the new key.' },
  ],
  correct: 'new-query',
  misconceptions: {
    outputs: 'The cache stores keys and values, not attention outputs. The new position’s output depends on its own query, which did not exist before this pass.',
    eliminates: 'Caching removes recomputation of old K/V projections, not attention. The new query still scores all p + 1 keys.',
    stale: 'Under a causal mask, appending a token cannot change earlier positions’ inputs, so cached K/V never change.',
    queries: 'Queries are not cached: later tokens never re-query from old positions in causal decoding.',
  },
  explanation: 'Position p needs softmax(q_p Kᵀ / √d) V over all p + 1 positions. q_p exists only in this pass, so none of its p + 1 scores could have been computed earlier. The cache supplies old k_j and v_j without recomputing them (1 projection instead of p + 1), but the new query against previous keys, and the weighted sum of values, remain.',
});

// ---------------------------------------------------------------- DOM

function cacheTable(doc, rows, { caption, withStatus = true }) {
  const head = el(doc, 'tr', {}, [
    el(doc, 'th', { text: 'Position', attrs: { scope: 'col' } }),
    el(doc, 'th', { text: 'Token', attrs: { scope: 'col' } }),
    el(doc, 'th', { attrs: { scope: 'col' } }, [tensorTag(doc, 'k'), doc.createTextNode(' key k')]),
    el(doc, 'th', { attrs: { scope: 'col' } }, [tensorTag(doc, 'v'), doc.createTextNode(' value v')]),
    el(doc, 'th', { text: 'Written by', attrs: { scope: 'col' } }),
    withStatus ? el(doc, 'th', { text: 'This step', attrs: { scope: 'col' } }) : null,
  ]);
  const body = el(doc, 'tbody');
  for (const row of rows) {
    const cls = row.status === 'new' ? 'is-new' : row.status === 'reused' ? 'is-reused' : undefined;
    body.append(el(doc, 'tr', { className: cls }, [
      el(doc, 'th', { text: String(row.position + 1), attrs: { scope: 'row' } }),
      el(doc, 'td', { text: row.token }),
      el(doc, 'td', { className: 'num', text: fmtVector(row.k, 3) }),
      el(doc, 'td', { className: 'num', text: fmtVector(row.v, 3) }),
      el(doc, 'td', { text: row.createdBy }),
      withStatus ? el(doc, 'td', { text: row.statusText }) : null,
    ]));
  }
  const table = el(doc, 'table', {}, [el(doc, 'caption', { text: caption }), el(doc, 'thead', {}, [head]), body]);
  return el(doc, 'div', { className: 'table-scroll', attrs: { tabindex: '0', role: 'region', 'aria-label': caption } }, [table]);
}

function mountPrefill(doc) {
  const maskEl = doc.getElementById('prefill-mask');
  const cacheEl = doc.getElementById('prefill-cache');
  if (!maskEl || !cacheEl) return;
  const snap = createKvSim({embeddings: sharedEmbeddings()}).prefill();
  const pass = snap.lastPass;
  const T = pass.positions.length;
  const mask = math.causalMask(T);
  const head = el(doc, 'tr', {}, [el(doc, 'td', { className: 'matrix-corner' }),
    ...pass.inputTokens.map((t, j) => el(doc, 'th', { text: `k${subscript(j + 1)} "${t}"`, attrs: { scope: 'col' } }))]);
  const body = el(doc, 'tbody');
  pass.inputTokens.forEach((t, i) => {
    const tr = el(doc, 'tr', {}, [el(doc, 'th', { text: `q${subscript(i + 1)} "${t}"`, attrs: { scope: 'row' } })]);
    for (let j = 0; j < T; j += 1) {
      if (mask[i][j] === -Infinity) tr.append(el(doc, 'td', { className: 'is-masked', text: 'masked (0)' }));
      else tr.append(el(doc, 'td', { className: 'num', text: fmtWeight(pass.attention[i].weights[j], 3) }));
    }
    body.append(tr);
  });
  const caption = 'Prefill attention weights, one parallel pass (toy values). Row = query position, column = key position.';
  const table = el(doc, 'table', { className: 'matrix t-w' }, [el(doc, 'caption', { text: caption }), el(doc, 'thead', {}, [head]), body]);
  maskEl.replaceChildren(el(doc, 'div', { className: 'table-scroll', attrs: { tabindex: '0', role: 'region', 'aria-label': caption } }, [table]));
  cacheEl.replaceChildren(cacheTable(doc, decodeView(snap).rows, { caption: `Cache after prefill: ${snap.cacheLength} entries (toy values, 1 layer, 1 KV head, d = 2)`, withStatus: false }));
  const pendingEl = doc.getElementById('prefill-pending');
  if (pendingEl && snap.pending) {
    pendingEl.textContent = `Sampled first output token: "${snap.pending.token}" (it will be position ${snap.pending.position + 1}). It is pending: sampled, not yet cached. The first decode pass will compute its K/V.`;
  }
}

function mountDecode(doc, onChange) {
  const stepBtn = doc.getElementById('decode-step'), resetBtn = doc.getElementById('decode-reset');
  if (!stepBtn || !resetBtn) return;
  const statusEl = doc.getElementById('decode-status'), cacheEl = doc.getElementById('decode-cache'), stagesEl = doc.getElementById('decode-stages'), out = doc.getElementById('decode-output');
  doc.getElementById('decode-assumptions').textContent = `Assumptions: ${SIM_ASSUMPTIONS.join(' ')}`;
  const back = el(doc, 'button', {text: '← Previous operation', attrs: {type: 'button'}});stepBtn.before(back);
  let rows = sharedEmbeddings(), sim = createKvSim({embeddings: rows}), snap = sim.prefill(), preview = null, stage = -1;
  function render() {
    const shown = preview && stage >= 5 ? preview : snap;
    const view = decodeView(shown), stages = preview ? decodeView(preview).stages : [];
    statusEl.replaceChildren(
      el(doc, 'div', {}, [el(doc, 'dt', {text: 'Cached positions'}), el(doc, 'dd', {text: String(shown.cacheLength)})]),
      el(doc, 'div', {}, [el(doc, 'dt', {text: 'Current input'}), el(doc, 'dd', {text: snap.pending?.token || 'End of continuation'})]),
      el(doc, 'div', {}, [el(doc, 'dt', {text: 'Operation'}), el(doc, 'dd', {text: stage < 0 ? 'Ready' : `${stage + 1} / 7`})]),
      el(doc, 'div', {}, [el(doc, 'dt', {text: 'Next chosen token'}), el(doc, 'dd', {text: stage === 6 ? (preview.pending ? `${preview.pending.token} · not cached` : 'End of toy continuation') : 'Not chosen in this pass yet'})]),
    );
    cacheEl.replaceChildren(cacheTable(doc, view.rows, {caption: stage >= 5 ? 'Cache after appending the new K/V row' : 'Earlier K/V rows: unchanged'}));
    if (stage < 0) {
      stagesEl.replaceChildren(el(doc, 'li', {text: `Prefill cached ${snap.cacheLength} positions. “${snap.pending?.token}” was chosen, but has no K/V yet. Start its decode pass.`}));
    } else {
      stagesEl.replaceChildren(...stages.slice(0, stage + 1).map((item, i) => {
        const li = el(doc, 'li', {className: i === stage ? 'is-highlight' : undefined}, [el(doc, 'strong', {text: item.title}), el(doc, 'p', {text: item.text})]);
        if (i === 0) li.append(el(doc, 'p', {text: `Incoming x = ${fmtVector(kvSim.toyEmbedding(snap.pending.token, snap.pending.position, rows), 3)}. The fixed WQ, WK and WV create Q/K/V from this x.`}));
        if (item.weights) {
          const holder = el(doc, 'div');
          renderBars(holder, item.weights.map(w => w.weight), item.weights.map(w => `${w.position + 1} “${w.token}”`), {label: 'Attention weights', role: 'w', max: 1});li.append(holder);
          li.append(el(doc, 'p', {text: 'Compare Q with each K, divide by √2, then softmax. Multiply each corresponding V by its weight and add the contribution vectors. The result does not replace any cached K/V row.'}));
        }
        return li;
      }));
    }
    out.textContent = stage < 0 ? 'No decode operations performed yet.' : stages[stage].text;
    if (stage === 6 && !preview.canStep) out.textContent += ' This trace deliberately processes the final toy token; real generation can stop immediately after choosing a stop token, without caching it.';
    back.disabled = stage <= 0;
    stepBtn.disabled = (!snap.canStep && !preview) || (stage === 6 && !preview.canStep);
    stepBtn.textContent = stage === 6 && !preview.canStep ? 'End of toy continuation' : preview && stage < 6 ? 'Next operation →' : snap.canStep ? 'Start next decode pass →' : 'End of toy continuation';
  }
  back.onclick = () => { if (stage > 0) { stage--;render(); } };
  stepBtn.onclick = () => {
    if (preview && stage < 6) stage++;
    else {
      if (preview) { snap = preview;preview = null;onChange?.(snap); }
      if (!snap.canStep) { stage = -1;render();return; }
      preview = sim.step();stage = 0;
    }
    render();
    if (stage === 6) onChange?.(preview);
  };
  resetBtn.onclick = () => { sim.reset();snap = sim.prefill();preview = null;stage = -1;render();onChange?.(snap); };
  doc.addEventListener('course:decode-frame', event => {
    const frame=event.detail;if(frame.pass<1)return;
    sim.reset();snap=sim.prefill();
    for(let pass=1;pass<frame.pass;pass++)snap=sim.step();
    preview=sim.step();stage=decodeReferenceStage(frame.stage);
    render();onChange?.(stage>=5?preview:snap);
  });
  doc.defaultView.addEventListener('storage', event => { if (event.key !== 'inference-course-v4') return;const next = sharedEmbeddings();if (JSON.stringify(next) === JSON.stringify(rows)) return;rows = next;sim = createKvSim({embeddings: rows});snap = sim.prefill();preview = null;stage = -1;mountPrefill(doc);render();out.textContent = 'Starting embeddings changed. Earlier K/V were recomputed with prefill.'; });
  render();
}

function mountComparison(doc) {
  const tableEl = doc.getElementById('compare-table');
  if (!tableEl) return () => {};
  const rows = comparisonRows(fullRunPasses());
  const cols = [
    ['Pass', null], ['Position(s) processed', null], ['Projected, with cache', 'projectedWith'], ['Projected, without cache', 'projectedWithout'],
    ['Cumulative with', 'cumWith'], ['Cumulative without', 'cumWithout'], ['Cache reads', 'cacheReads'],
    ['Keys attended (same either way)', 'keysAttended'], ['Cache entries after', 'cacheEntriesAfter'],
  ];
  const caption = 'Counts per layer for the toy run (exact counts, not timings)';
  const trs = rows.map((r) => {
    const positions = r.positions.length > 1 ? `${r.positions[0]}–${r.positions.at(-1)}` : String(r.positions[0]);
    return el(doc, 'tr', {}, [
      el(doc, 'th', { text: r.label, attrs: { scope: 'row' } }),
      el(doc, 'td', { className: 'num', text: positions }),
      ...cols.slice(2).map(([, key]) => el(doc, 'td', { className: 'num', text: String(r[key]) })),
    ]);
  });
  const table = el(doc, 'table', {}, [
    el(doc, 'caption', { text: caption }),
    el(doc, 'thead', {}, [el(doc, 'tr', {}, cols.map(([name]) => el(doc, 'th', { text: name, attrs: { scope: 'col' } })))]),
    el(doc, 'tbody', {}, trs),
  ]);
  tableEl.replaceChildren(el(doc, 'div', { className: 'table-scroll', attrs: { tabindex: '0', role: 'region', 'aria-label': caption } }, [table]));
  const note = doc.getElementById('compare-note');
  if (note) note.textContent = 'Prefill keys attended = 1 + 2 + 3 + 4 = 10 (every prompt query, causal). Decode keys attended = p + 1 for the single new query. Cache reads = p, the cache length before the pass. The row for the tracer’s latest pass is marked.';
  const bars = doc.getElementById('compare-bars');
  if (bars) {
    const max = rows.at(-1).cumWithout;
    const withHolder = el(doc, 'div');
    const withoutHolder = el(doc, 'div');
    const labels = rows.map((r) => r.label);
    renderBars(withHolder, rows.map((r) => r.cumWith), labels, { label: 'Cumulative projected positions with cache', format: String, max, role: 'k' });
    renderBars(withoutHolder, rows.map((r) => r.cumWithout), labels, { label: 'Cumulative projected positions without cache', format: String, max, role: 'v' });
    bars.replaceChildren(el(doc, 'h4', { text: 'With cache (grows by 1 per step)' }), withHolder, el(doc, 'h4', { text: 'Without cache (grows by p + 1 per step)' }), withoutHolder);
  }
  return (snap) => {
    const current = snap.passes.length - 1;
    trs.forEach((tr, i) => {
      tr.classList.toggle('is-highlight', i === current);
      tr.querySelector('.tracer-marker')?.remove();
      if (i === current) tr.firstChild.append(el(doc, 'span', { className: 'tracer-marker', text: ' (tracer is here)' }));
    });
  };
}

function mountExtrapolation(doc) {
  const promptInput = doc.getElementById('ext-prompt');
  const stepsInput = doc.getElementById('ext-steps');
  if (!promptInput || !stepsInput) return;
  const body = doc.getElementById('ext-body');
  const out = doc.getElementById('ext-output');
  function render() {
    const T = parseCount(promptInput.value, 'Prompt length T');
    const n = parseCount(stepsInput.value, 'Decode steps n');
    const error = T.error || n.error;
    if (error) {
      body.replaceChildren(el(doc, 'p', { className: 'lab-error', text: error, attrs: { role: 'alert' } }));
      out.textContent = '';
      return;
    }
    const r = projectionTotals({ promptLength: T.value, steps: n.value });
    const row = (name, a, b) => el(doc, 'tr', {}, [el(doc, 'th', { text: name, attrs: { scope: 'row' } }), el(doc, 'td', { className: 'num', text: a }), el(doc, 'td', { className: 'num', text: b })]);
    const caption = `Totals after prefill of ${fmtInt(T.value)} tokens and ${fmtInt(n.value)} decode steps (per layer)`;
    const table = el(doc, 'table', {}, [
      el(doc, 'caption', { text: caption }),
      el(doc, 'thead', {}, [el(doc, 'tr', {}, [el(doc, 'th', { text: 'Counter', attrs: { scope: 'col' } }), el(doc, 'th', { text: 'With cache', attrs: { scope: 'col' } }), el(doc, 'th', { text: 'Without cache', attrs: { scope: 'col' } })])]),
      el(doc, 'tbody', {}, [
        row('Projected positions, cumulative', `${fmtInt(r.withCache)} = T + n`, `${fmtInt(r.withoutCache)} = T + nT + n(n+1)/2`),
        row('Keys attended by decode queries', fmtInt(r.decodeKeysAttended), `${fmtInt(r.decodeKeysAttended)} (plus every earlier row, recomputed)`),
        row('Cache reads, cumulative', `${fmtInt(r.cacheReads)} = nT + n(n−1)/2`, '0 (nothing kept)'),
        row('K/V entries held at the end', fmtInt(r.cacheEntries), '0 kept between passes'),
      ]),
    ]);
    body.replaceChildren(el(doc, 'div', { className: 'table-scroll', attrs: { tabindex: '0', role: 'region', 'aria-label': caption } }, [table]));
    out.textContent = `Without a cache, ${fmtInt(r.withoutCache)} position projections; with one, ${fmtInt(r.withCache)}: ${fmtNumber(r.ratio, 1)}× fewer, avoiding ${fmtInt(r.avoided)}. Attention still scores ${fmtInt(r.decodeKeysAttended)} keys across the decode steps.`;
  }
  promptInput.addEventListener('input', render);
  stepsInput.addEventListener('input', render);
  render();
}

export function mount(doc) {
  mountPrefill(doc);
  const highlight = mountComparison(doc);
  mountDecode(doc, highlight);
  mountExtrapolation(doc);
  const check = doc.getElementById('kv-check');
  if (check) createKnowledgeCheck(check, CHECK_CONFIG);
}

if (typeof document !== 'undefined') mount(document);
