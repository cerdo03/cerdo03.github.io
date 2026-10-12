// Lesson 2.5: KV-cache memory and performance.
// Pure helpers (exported, Node-testable) first; DOM wiring runs only in a browser.
import * as math from './attention-math.js';
import * as ui from './ui.js';

const { kvBytesBreakdown, kvBytesTotal, formatBytes, bestUnit, bytesToUnit, BYTE_UNITS } = math;
const { el, fmtInt, fmtNumber } = ui;

// ---------------------------------------------------------------- Data

/** Element precisions offered by the calculator (bytes per stored number). */
export const PRECISIONS = Object.freeze([
  Object.freeze({ id: 'fp32', label: 'FP32 (4 bytes)', bytes: 4 }),
  Object.freeze({ id: 'bf16', label: 'BF16 / FP16 (2 bytes)', bytes: 2 }),
  Object.freeze({ id: 'fp8', label: 'FP8 / INT8 (1 byte)', bytes: 1 }),
]);

/** Hypothetical, illustrative configurations. Not specifications of any named model. */
export const PRESETS = Object.freeze([
  Object.freeze({ id: 'a', label: 'Example A (GQA-style)', layers: 32, kvHeads: 8, headDim: 128, note: '32 layers, 8 KV heads, D = 128' }),
  Object.freeze({ id: 'b', label: 'Example B (GQA-style, deeper)', layers: 40, kvHeads: 8, headDim: 128, note: '40 layers, 8 KV heads, D = 128' }),
  Object.freeze({ id: 'c', label: 'Example C (MHA-style)', layers: 32, kvHeads: 32, headDim: 128, note: '32 layers, 32 KV heads (one per query head), D = 128' }),
  Object.freeze({ id: 'd', label: 'Example D (MQA-style)', layers: 32, kvHeads: 1, headDim: 128, note: '32 layers, 1 shared KV head, D = 128' }),
]);

export const DEFAULT_CONFIG = Object.freeze({ layers: 32, kvHeads: 8, headDim: 128, seqLen: 4096, bytesPerElem: 2, sequences: 1 });

/** Accepted input ranges. Wide enough for real configurations, narrow enough to stay exact. */
export const LIMITS = Object.freeze({
  layers: Object.freeze({ min: 1, max: 1024, label: 'Layers (L)' }),
  kvHeads: Object.freeze({ min: 1, max: 1024, label: 'KV heads (H_KV)' }),
  headDim: Object.freeze({ min: 1, max: 4096, label: 'Head dimension (D)' }),
  seqLen: Object.freeze({ min: 1, max: 10_000_000, label: 'Cached tokens per sequence (T)' }),
  bytesPerElem: Object.freeze({ min: 1, max: 4, label: 'Bytes per element (B)' }),
  sequences: Object.freeze({ min: 1, max: 100_000, label: 'Concurrent sequences (N)' }),
});

/** The 2.5.5 exercise: 40 layers, 8 KV heads, D = 128, BF16, 50 requests × 8,000 tokens. */
export const EXERCISE = Object.freeze({ layers: 40, kvHeads: 8, headDim: 128, bytesPerElem: 2, seqLen: 8000, sequences: 50 });

export const EXERCISE_UNITS = Object.freeze(['B', 'MB', 'MiB', 'GB', 'GiB'].map((label) => Object.freeze({ label, factor: BYTE_UNITS[label] })));

// ---------------------------------------------------------------- Pure helpers

/** Parse one integer field ("4,096" allowed). Returns { value } or { error }. */
export function parseIntegerField(text, key) {
  const limit = LIMITS[key];
  if (!limit) throw new Error(`Unknown field "${key}".`);
  const cleaned = String(text ?? '').trim().replace(/[\s,_]/g, '');
  if (cleaned === '') return { error: `${limit.label}: enter a whole number.` };
  if (!/^\d+$/.test(cleaned)) return { error: `${limit.label}: “${String(text).trim()}” is not a whole number.` };
  const value = Number(cleaned);
  if (value < limit.min || value > limit.max) return { error: `${limit.label}: must be between ${fmtInt(limit.min)} and ${fmtInt(limit.max)} (got ${fmtInt(value)}).` };
  return { value };
}

/**
 * Validate raw calculator input (strings or numbers).
 * Returns { ok: true, config } or { ok: false, errors: string[] }.
 */
export function validateConfig(raw) {
  const errors = [];
  const config = {};
  for (const key of Object.keys(LIMITS)) {
    const result = parseIntegerField(raw?.[key], key);
    if (result.error) errors.push(result.error); else config[key] = result.value;
  }
  if (errors.length === 0 && !PRECISIONS.some((p) => p.bytes === config.bytesPerElem)) {
    errors.push('Bytes per element (B): choose FP32 (4), BF16/FP16 (2) or FP8/INT8 (1).');
  }
  if (errors.length === 0) {
    try { computeKvMemory(config); } catch (error) { errors.push(`These inputs give a byte count too large to compute exactly: ${error.message}`); }
  }
  return errors.length ? { ok: false, errors } : { ok: true, config: Object.freeze(config) };
}

/**
 * Raw KV storage for N equal-length sequences.
 * Returns bytes per token-layer, per token, per sequence (K, V, total) and aggregate (K, V, total).
 */
export function computeKvMemory(config) {
  const b = kvBytesBreakdown(config);
  const total = kvBytesTotal(config);
  return Object.freeze({
    perTokenLayer: b.perTokenLayer,
    perToken: b.perToken,
    keysPerSequence: b.keys,
    valuesPerSequence: b.values,
    perSequence: b.total,
    keysTotal: total / 2,
    valuesTotal: total / 2,
    total,
    tokensTotal: config.seqLen * config.sequences,
  });
}

/** One byte count in three notations: exact bytes, auto decimal (SI) unit, auto binary (IEC) unit. */
export function describeBytes(bytes) {
  return Object.freeze({
    bytes: `${fmtInt(bytes)} B`,
    decimal: formatBytes(bytes, { system: 'decimal' }),
    binary: formatBytes(bytes, { system: 'binary' }),
  });
}

/** Tokens actually reserved when a sequence of T tokens is stored in fixed blocks of `blockSize` tokens. */
export function blockRoundedTokens(seqLen, blockSize = 16) {
  math.assertPositiveInteger(seqLen, 'sequence length');
  math.assertPositiveInteger(blockSize, 'block size');
  return Math.ceil(seqLen / blockSize) * blockSize;
}

/** Choose a "nice" axis step (1, 2, 2.5 or 5 × 10^k) for roughly `count` intervals over [0, max]. */
export function niceStep(max, count = 4) {
  if (!(max > 0)) return 1;
  const raw = max / count;
  const power = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * power).find((s) => s >= raw - 1e-12);
  return step;
}

export const CHART_DEFAULTS = Object.freeze({ layers: 32, headDim: 128, bytesPerElem: 2, kvHeads: 8, referenceKvHeads: 32, maxContext: 32768, sequences: 1 });
export const CHART_CONTEXTS = Object.freeze([4096, 8192, 32768, 131072]);

/**
 * Data for the memory-vs-context chart. Memory is linear in T in this model, so the
 * series are straight lines from (0, 0); points are sampled at `samples` + 1 evenly spaced T.
 * Returns { unit, yMax, yStep, xTicks, series: [{ id, kvHeads, label, points: [{ T, bytes, value }] }] }.
 */
export function chartData({ layers, headDim, bytesPerElem, kvHeads, referenceKvHeads, maxContext, sequences, samples = 4 }) {
  const make = (id, heads, label) => ({
    id,
    kvHeads: heads,
    label,
    points: Array.from({ length: samples + 1 }, (_, i) => {
      const T = Math.round((maxContext * i) / samples);
      const bytes = T === 0 ? 0 : kvBytesTotal({ layers, kvHeads: heads, headDim, bytesPerElem, seqLen: T, sequences });
      return { T, bytes };
    }),
  });
  const series = [
    make('current', kvHeads, `H_KV = ${kvHeads}`),
    make('reference', referenceKvHeads, `Reference H_KV = ${referenceKvHeads}`),
  ];
  const maxBytes = Math.max(...series.flatMap((s) => s.points.map((p) => p.bytes)));
  const unit = bestUnit(maxBytes, 'binary');
  const maxValue = bytesToUnit(maxBytes, unit);
  const yStep = niceStep(maxValue, 4);
  const yMax = Math.ceil(maxValue / yStep - 1e-9) * yStep;
  for (const s of series) for (const p of s.points) p.value = bytesToUnit(p.bytes, unit);
  return { unit, yMax, yStep, xTicks: series[0].points.map((p) => p.T), series };
}

/** Compact token count for axis labels: 32768 → "32K" (K = 1,024 tokens, matching common context sizes). */
export function fmtTokens(T) {
  if (T >= 1024 && T % 1024 === 0) return `${T / 1024}K`;
  return fmtInt(T);
}

const exerciseTotal = kvBytesTotal(EXERCISE);

/** Wrong answers learners commonly reach, in bytes, with a targeted hint. */
export const EXERCISE_MISCONCEPTIONS = Object.freeze([
  { value: exerciseTotal / 2, message: 'That is exactly half the answer: you may have stored only keys or only values. Each token stores a key vector and a value vector, hence the factor 2.' },
  { value: exerciseTotal / EXERCISE.layers, message: 'That is the answer divided by 40: every layer keeps its own K and V, so multiply by L = 40.' },
  { value: exerciseTotal / EXERCISE.sequences, message: 'That is one request’s cache. Fifty requests each hold their own 8,000-token cache, so multiply by N = 50.' },
  { value: exerciseTotal * 2, message: 'That is twice the answer: BF16 stores 2 bytes per element, not 4 (FP32).' },
  { value: exerciseTotal / 2 ** 30 * 1e9, message: 'You entered the GiB figure but selected GB. 1 GiB = 1,073,741,824 bytes, which is larger than 1 GB = 1,000,000,000 bytes.' },
  { value: exerciseTotal / 1e9 * 2 ** 30, message: 'You entered the GB figure but selected GiB. Decimal GB and binary GiB differ by about 7.4%.' },
  { value: exerciseTotal / 2 ** 20 * 1e6, message: 'You entered the MiB figure but selected MB. 1 MiB = 1,048,576 bytes; 1 MB = 1,000,000 bytes.' },
  { value: exerciseTotal / 1e6 * 2 ** 20, message: 'You entered the MB figure but selected MiB. 1 MiB = 1,048,576 bytes; 1 MB = 1,000,000 bytes.' },
]);

// ---------------------------------------------------------------- DOM: calculator (2.5.2)

const FIELD_IDS = { layers: 'calc-layers', kvHeads: 'calc-kv-heads', headDim: 'calc-head-dim', seqLen: 'calc-seq-len', bytesPerElem: 'calc-bytes', sequences: 'calc-sequences' };

function calculatorRows(c, m) {
  const N = c.sequences;
  return [
    { name: 'Per token, per layer', formula: `2 × ${c.kvHeads} × ${c.headDim} × ${c.bytesPerElem}`, bytes: m.perTokenLayer },
    { name: 'Per token (all layers)', formula: `2 × ${c.layers} × ${c.kvHeads} × ${c.headDim} × ${c.bytesPerElem}`, bytes: m.perToken },
    { name: 'Keys (K), one sequence', formula: `${c.layers} × ${fmtInt(c.seqLen)} × ${c.kvHeads} × ${c.headDim} × ${c.bytesPerElem}`, bytes: m.keysPerSequence, role: 'k' },
    { name: 'Values (V), one sequence', formula: `${c.layers} × ${fmtInt(c.seqLen)} × ${c.kvHeads} × ${c.headDim} × ${c.bytesPerElem}`, bytes: m.valuesPerSequence, role: 'v' },
    { name: 'K + V, one sequence', formula: `2 × ${c.layers} × ${fmtInt(c.seqLen)} × ${c.kvHeads} × ${c.headDim} × ${c.bytesPerElem}`, bytes: m.perSequence, strong: true },
    { name: `Keys (K), ${fmtInt(N)} sequence${N === 1 ? '' : 's'}`, formula: `${fmtInt(N)} × K per sequence`, bytes: m.keysTotal, role: 'k' },
    { name: `Values (V), ${fmtInt(N)} sequence${N === 1 ? '' : 's'}`, formula: `${fmtInt(N)} × V per sequence`, bytes: m.valuesTotal, role: 'v' },
    { name: `Aggregate, ${fmtInt(N)} sequence${N === 1 ? '' : 's'}`, formula: `${fmtInt(N)} × K + V per sequence`, bytes: m.total, strong: true },
  ];
}

function mountCalculator(doc) {
  const root = doc.getElementById('kv-calculator');
  if (!root) return;
  const fields = Object.fromEntries(Object.entries(FIELD_IDS).map(([key, id]) => [key, doc.getElementById(id)]));
  const errorBox = doc.getElementById('calc-errors');
  const summary = doc.getElementById('calc-summary');
  const tbody = doc.getElementById('calc-rows');
  const growth = doc.getElementById('calc-growth');
  const table = doc.getElementById('calc-table');
  const presetNote = doc.getElementById('calc-preset-note');

  const read = () => Object.fromEntries(Object.entries(fields).map(([key, input]) => [key, input.value]));

  function render() {
    const result = validateConfig(read());
    for (const [key, input] of Object.entries(fields)) {
      const bad = !result.ok && result.errors.some((e) => e.startsWith(LIMITS[key].label));
      input.setAttribute('aria-invalid', bad ? 'true' : 'false');
    }
    if (!result.ok) {
      errorBox.hidden = false;
      errorBox.replaceChildren(el(doc, 'strong', { text: 'Fix the inputs to update the results: ' }), el(doc, 'ul', {}, result.errors.map((e) => el(doc, 'li', { text: e }))));
      table.classList.add('is-stale');
      summary.textContent = 'Results are paused until every input is valid.';
      growth.textContent = '';
      return;
    }
    errorBox.hidden = true;
    errorBox.replaceChildren();
    table.classList.remove('is-stale');
    const c = result.config;
    const m = computeKvMemory(c);
    tbody.replaceChildren(...calculatorRows(c, m).map((row) => {
      const d = describeBytes(row.bytes);
      const nameCell = el(doc, 'th', { attrs: { scope: 'row' } });
      if (row.role) nameCell.append(ui.tensorTag(doc, row.role), ' ');
      nameCell.append(row.name);
      return el(doc, 'tr', { className: row.strong ? 'is-total' : undefined }, [
        nameCell,
        el(doc, 'td', { className: 'formula', text: row.formula }),
        el(doc, 'td', { className: 'num', text: d.bytes }),
        el(doc, 'td', { className: 'num', text: d.decimal }),
        el(doc, 'td', { className: 'num', text: d.binary }),
      ]);
    }));
    const per = describeBytes(m.perSequence);
    const agg = describeBytes(m.total);
    summary.textContent = `One ${fmtInt(c.seqLen)}-token sequence stores ${per.bytes} = ${per.binary} = ${per.decimal} of raw K/V. `
      + (c.sequences === 1 ? 'With N = 1 the aggregate equals the per-sequence figure.' : `${fmtInt(c.sequences)} such sequences store ${agg.binary} (${agg.decimal}).`);
    growth.textContent = `Growth: each extra cached token adds ${fmtInt(m.perToken)} B (${formatBytes(m.perToken)}) per sequence, `
      + `so doubling T to ${fmtInt(c.seqLen * 2)} would double the per-sequence figure to ${formatBytes(m.perSequence * 2)}.`;
  }

  root.addEventListener('input', () => { presetNote.textContent = ''; render(); });
  root.addEventListener('change', render);
  for (const button of root.querySelectorAll('[data-preset]')) {
    button.addEventListener('click', () => {
      const preset = PRESETS.find((p) => p.id === button.dataset.preset);
      fields.layers.value = preset.layers;
      fields.kvHeads.value = preset.kvHeads;
      fields.headDim.value = preset.headDim;
      presetNote.textContent = `Loaded ${preset.label}: ${preset.note}. T, B and N are unchanged.`;
      render();
    });
  }
  doc.getElementById('calc-reset').addEventListener('click', () => {
    for (const [key, input] of Object.entries(fields)) input.value = DEFAULT_CONFIG[key];
    presetNote.textContent = 'Reset to the worked example: L = 32, H_KV = 8, D = 128, BF16, T = 4,096, N = 1.';
    render();
  });
  render();
}

// ---------------------------------------------------------------- DOM: chart (2.5.3)

const SVG_NS = 'http://www.w3.org/2000/svg';
/** Chart geometry in SVG user units; the viewBox follows the container width so text stays legible on phones. */
export function chartGeometry(containerWidth) {
  const width = Math.round(Math.max(340, Math.min(640, containerWidth || 640)));
  const narrow = width < 520;
  return { width, height: narrow ? 300 : 340, left: 56, right: narrow ? 118 : 150, top: 16, bottom: 48 };
}

function svg(doc, tag, attrs = {}, text) {
  const node = doc.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
  if (text !== undefined) node.textContent = text;
  return node;
}

/** Vertical label positions for the two end labels, nudged apart if they would overlap. */
export function separateLabels(yA, yB, gap = 30) {
  if (Math.abs(yA - yB) >= gap) return [yA, yB];
  const mid = (yA + yB) / 2;
  return yA <= yB ? [mid - gap / 2, mid + gap / 2] : [mid + gap / 2, mid - gap / 2];
}

function drawChart(doc, svgEl, data, maxContext) {
  const { width, height, left, right, top, bottom } = chartGeometry(svgEl.parentElement?.clientWidth);
  svgEl.setAttribute('viewBox', `0 0 ${width} ${height}`);
  const plotW = width - left - right;
  const plotH = height - top - bottom;
  const x = (T) => left + (T / maxContext) * plotW;
  const y = (v) => top + plotH - (v / data.yMax) * plotH;
  const nodes = [];
  const grid = svg(doc, 'g', { class: 'chart-grid', 'aria-hidden': 'true' });
  for (let v = 0; v <= data.yMax + 1e-9; v += data.yStep) {
    grid.append(svg(doc, 'line', { x1: left, x2: left + plotW, y1: y(v), y2: y(v) }));
    grid.append(svg(doc, 'text', { x: left - 8, y: y(v) + 4, 'text-anchor': 'end', class: 'chart-tick' }, fmtNumber(v, 2)));
  }
  for (const T of data.xTicks) {
    grid.append(svg(doc, 'text', { x: x(T), y: top + plotH + 20, 'text-anchor': 'middle', class: 'chart-tick' }, fmtTokens(T)));
  }
  grid.append(svg(doc, 'line', { class: 'chart-axis', x1: left, x2: left + plotW, y1: top + plotH, y2: top + plotH }));
  grid.append(svg(doc, 'line', { class: 'chart-axis', x1: left, x2: left, y1: top, y2: top + plotH }));
  grid.append(svg(doc, 'text', { x: left + plotW / 2, y: height - 6, 'text-anchor': 'middle', class: 'chart-axis-label' }, 'Cached tokens per sequence (T)'));
  grid.append(svg(doc, 'text', { x: 14, y: top + plotH / 2, 'text-anchor': 'middle', class: 'chart-axis-label', transform: `rotate(-90 14 ${top + plotH / 2})` }, `Raw KV memory (${data.unit})`));
  nodes.push(grid);

  // Draw the reference first so the current series sits on top; labels carry identity, not colour.
  const ordered = [data.series[1], data.series[0]];
  for (const s of ordered) {
    const g = svg(doc, 'g', { class: `chart-series series-${s.id}`, 'aria-hidden': 'true' });
    g.append(svg(doc, 'polyline', { points: s.points.map((p) => `${x(p.T)},${y(p.value)}`).join(' ') }));
    for (const p of s.points.slice(1)) {
      const marker = s.id === 'current'
        ? svg(doc, 'circle', { cx: x(p.T), cy: y(p.value), r: 4.5 })
        : svg(doc, 'rect', { x: x(p.T) - 4.5, y: y(p.value) - 4.5, width: 9, height: 9 });
      g.append(marker);
    }
    nodes.push(g);
  }
  const [cur, ref] = data.series;
  const endCur = cur.points.at(-1);
  const endRef = ref.points.at(-1);
  const [yCur, yRef] = separateLabels(y(endCur.value), y(endRef.value));
  const labels = svg(doc, 'g', { class: 'chart-end-labels', 'aria-hidden': 'true' });
  const endLabel = (s, end, yPos, cls) => {
    const t = svg(doc, 'text', { x: left + plotW + 10, y: yPos, class: cls });
    t.append(svg(doc, 'tspan', { x: left + plotW + 10, dy: -2 }, s.id === 'current' ? `● H_KV = ${s.kvHeads}` : `□ ref H_KV = ${s.kvHeads}`));
    t.append(svg(doc, 'tspan', { x: left + plotW + 10, dy: 15 }, formatBytes(end.bytes)));
    return t;
  };
  labels.append(endLabel(cur, endCur, yCur, 'chart-end current'), endLabel(ref, endRef, yRef, 'chart-end reference'));
  nodes.push(labels);
  // Keep the static <title>/<desc> (referenced by aria-labelledby); replace only the drawing.
  svgEl.replaceChildren(svgEl.querySelector('title'), svgEl.querySelector('desc'), ...nodes);
}

function mountChart(doc) {
  const root = doc.getElementById('kv-chart-lab');
  if (!root) return;
  const inputs = {
    kvHeads: doc.getElementById('chart-kv-heads'),
    referenceKvHeads: doc.getElementById('chart-ref-heads'),
    maxContext: doc.getElementById('chart-max-context'),
    sequences: doc.getElementById('chart-sequences'),
  };
  const svgEl = doc.getElementById('kv-chart');
  const errorBox = doc.getElementById('chart-errors');
  const output = doc.getElementById('chart-output');
  const tableBody = doc.getElementById('chart-rows');
  const headCur = doc.getElementById('chart-col-current');
  const headRef = doc.getElementById('chart-col-ref');

  function render() {
    const errors = [];
    const parse = (input, key, label, max) => {
      const r = parseIntegerField(input.value, key);
      let error = r.error ? r.error.replace(LIMITS[key].label, label) : null;
      if (!error && r.value > max) error = `${label}: must be between 1 and ${fmtInt(max)} (got ${fmtInt(r.value)}).`;
      input.setAttribute('aria-invalid', error ? 'true' : 'false');
      if (error) { errors.push(error); return null; }
      return r.value;
    };
    const kvHeads = parse(inputs.kvHeads, 'kvHeads', 'KV heads (H_KV)', 128);
    const referenceKvHeads = parse(inputs.referenceKvHeads, 'kvHeads', 'Reference KV heads', 128);
    const sequences = parse(inputs.sequences, 'sequences', 'Concurrent sequences (N)', 1024);
    const maxContext = Number(inputs.maxContext.value);
    if (errors.length) {
      errorBox.hidden = false;
      errorBox.replaceChildren(el(doc, 'strong', { text: 'Chart paused: ' }), el(doc, 'ul', {}, errors.map((e) => el(doc, 'li', { text: e }))));
      return;
    }
    errorBox.hidden = true;
    const data = chartData({ ...CHART_DEFAULTS, kvHeads, referenceKvHeads, maxContext, sequences });
    drawChart(doc, svgEl, data, maxContext);
    const [cur, ref] = data.series;
    const endCur = cur.points.at(-1);
    const endRef = ref.points.at(-1);
    const nText = `${fmtInt(sequences)} sequence${sequences === 1 ? '' : 's'}`;
    const ratio = referenceKvHeads / kvHeads;
    const comparison = kvHeads === referenceKvHeads
      ? 'The two lines coincide because both use the same number of KV heads.'
      : `At every context length the reference needs ${fmtNumber(ratio, 3)}× the memory of H_KV = ${kvHeads}, because memory is proportional to H_KV.`;
    const desc = `Both lines are straight and start at zero. At T = ${fmtInt(maxContext)} for ${nText}: H_KV = ${kvHeads} needs ${formatBytes(endCur.bytes)}; reference H_KV = ${referenceKvHeads} needs ${formatBytes(endRef.bytes)}.`;
    svgEl.querySelector('desc').textContent = desc;
    const slope = kvBytesTotal({ ...CHART_DEFAULTS, kvHeads, sequences, seqLen: 1 });
    output.replaceChildren(
      el(doc, 'p', { text: desc }),
      el(doc, 'p', { text: `Slope: every additional cached token ${sequences === 1 ? '' : `in each of the ${nText} `}adds ${fmtInt(slope)} B = ${formatBytes(slope)} for H_KV = ${kvHeads}. ${comparison}` }),
    );
    headCur.textContent = `H_KV = ${kvHeads} (solid line, circles)`;
    headRef.textContent = `Reference H_KV = ${referenceKvHeads} (dashed line, squares)`;
    tableBody.replaceChildren(...data.xTicks.map((T, i) => el(doc, 'tr', {}, [
      el(doc, 'th', { text: fmtInt(T), attrs: { scope: 'row' } }),
      el(doc, 'td', { className: 'num', text: `${formatBytes(cur.points[i].bytes)} (${fmtInt(cur.points[i].bytes)} B)` }),
      el(doc, 'td', { className: 'num', text: `${formatBytes(ref.points[i].bytes)} (${fmtInt(ref.points[i].bytes)} B)` }),
    ])));
  }
  root.addEventListener('input', render);
  root.addEventListener('change', render);
  let lastWidth = svgEl.parentElement.clientWidth;
  doc.defaultView?.addEventListener('resize', () => {
    const w = svgEl.parentElement.clientWidth;
    if (Math.abs(w - lastWidth) > 20) { lastWidth = w; render(); }
  });
  doc.getElementById('chart-reset').addEventListener('click', () => {
    inputs.kvHeads.value = CHART_DEFAULTS.kvHeads;
    inputs.referenceKvHeads.value = CHART_DEFAULTS.referenceKvHeads;
    inputs.maxContext.value = CHART_DEFAULTS.maxContext;
    inputs.sequences.value = CHART_DEFAULTS.sequences;
    render();
  });
  render();
}

// ---------------------------------------------------------------- DOM: exercise (2.5.5)

function exerciseExplanationHtml() {
  const t = exerciseTotal;
  return `<p><strong>Derivation.</strong> Per token per layer: 2 × 8 × 128 × 2 = 4,096 B. Per token across 40 layers: 40 × 4,096 = 163,840 B.
  Per request: 8,000 × 163,840 = 1,310,720,000 B (≈ 1.31 GB ≈ 1.22 GiB). Fifty requests: 50 × 1,310,720,000 = <strong>${fmtInt(t)} B</strong>.</p>
  <p>In units: ${fmtInt(t)} ÷ 10<sup>9</sup> ≈ <strong>${formatBytes(t, { unit: 'GB' })}</strong>; ${fmtInt(t)} ÷ 2<sup>30</sup> ≈ <strong>${formatBytes(t, { unit: 'GiB' })}</strong>
  (= ${formatBytes(t, { unit: 'MB', digits: 0 })} = ${formatBytes(t, { unit: 'MiB', digits: 0 })}).</p>
  <p>Or in one line: 2 · <var>L</var> · <var>T</var> · <var>H</var><sub>KV</sub> · <var>D</var> · <var>B</var> · <var>N</var> = 2 · 40 · 8,000 · 8 · 128 · 2 · 50 = ${fmtInt(t)} B.</p>
  <p>This answer is the raw K/V tensor storage only. The section below explains why it does not yet tell you whether a deployment fits.</p>`;
}

function mountExercise(doc) {
  const container = doc.getElementById('kv-exercise');
  if (!container) return;
  ui.createKnowledgeCheck(container, {
    type: 'numeric',
    questionHtml: 'A hypothetical model has <var>L</var> = 40 layers, <var>H</var><sub>KV</sub> = 8 KV heads and head dimension <var>D</var> = 128, with the KV cache stored in BF16 (2 bytes per element). '
      + 'It serves 50 concurrent requests, each with 8,000 tokens already cached. How much raw KV-cache memory do these requests occupy? Enter a number and choose its unit.',
    correct: exerciseTotal,
    tolerance: 0.01,
    units: EXERCISE_UNITS,
    misconceptions: EXERCISE_MISCONCEPTIONS,
    explanationHtml: exerciseExplanationHtml(),
  });
}

// ---------------------------------------------------------------- Boot

export const lesson = Object.freeze({ number: 5, math, ui });

if (typeof document !== 'undefined') {
  mountCalculator(document);
  mountChart(document);
  mountExercise(document);
}
