// Lesson 2.3: MHA vs MQA vs GQA.
// Pure data and functions are exported for tests; DOM wiring runs only in a browser.
// One widget: the head-layout comparison tool in section 2.3.3.
import * as math from './attention-math.js';
import * as ui from './ui.js';

/** Quantities held fixed in the comparison tool so only head layout, D and T vary. */
export const FIXED = Object.freeze({ layers: 32, bytesPerElem: math.BYTES_PER_ELEMENT.bf16, dtype: 'BF16' });

export const Q_HEAD_OPTIONS = Object.freeze([4, 8, 12, 16, 24, 32, 40, 48, 64]);
export const HEAD_DIM_OPTIONS = Object.freeze([64, 96, 128, 256]);
export const SEQ_LEN_LIMITS = Object.freeze({ min: 1, max: 1048576 });

/** Presets reproduce the lesson's three reference layouts (16 query heads each). */
export const PRESETS = Object.freeze({
  mha: Object.freeze({ id: 'mha', label: 'MHA 16 / 16', qHeads: 16, kvHeads: 16 }),
  gqa: Object.freeze({ id: 'gqa', label: 'GQA 16 / 4', qHeads: 16, kvHeads: 4 }),
  mqa: Object.freeze({ id: 'mqa', label: 'MQA 16 / 1', qHeads: 16, kvHeads: 1 }),
});

export const DEFAULT_CONFIG = Object.freeze({ qHeads: 16, kvHeads: 4, headDim: 128, seqLen: 4096 });

/** KV head counts that divide qHeads evenly (the only valid choices), ascending. */
export function validKvHeads(qHeads) {
  math.assertPositiveInteger(qHeads, 'query heads');
  const out = [];
  for (let k = 1; k <= qHeads; k += 1) if (qHeads % k === 0) out.push(k);
  return out;
}

/** Largest valid KV head count that does not exceed the requested one (falls back to 1). */
export function nearestValidKv(qHeads, kvHeads) {
  const valid = validKvHeads(qHeads);
  let best = 1;
  for (const k of valid) if (k <= kvHeads) best = k;
  return best;
}

/** Validate a full tool configuration. Returns { valid, reason }. */
export function validateConfig({ qHeads, kvHeads, headDim, seqLen }) {
  const gqa = math.validateGqa(qHeads, kvHeads);
  if (!gqa.valid) return gqa;
  if (!Number.isInteger(headDim) || headDim <= 0) return { valid: false, reason: `Head dimension must be a positive integer (got ${String(headDim)}).` };
  if (!Number.isInteger(seqLen) || seqLen < SEQ_LEN_LIMITS.min || seqLen > SEQ_LEN_LIMITS.max) {
    return { valid: false, reason: `Sequence length must be a whole number from ${ui.fmtInt(SEQ_LEN_LIMITS.min)} to ${ui.fmtInt(SEQ_LEN_LIMITS.max)} tokens.` };
  }
  return { valid: true, reason: null };
}

function rangeText(heads) {
  const first = heads[0];
  const last = heads[heads.length - 1];
  return first === last ? `Q${first}` : `Q${first}–Q${last}`;
}

/** Sentence describing which KV head a query head reads, e.g. "Q5 → KV1 (group 1, shared with Q4–Q7)". */
export function describeQueryHead(qHeads, kvHeads, q) {
  const m = math.gqaMapping(qHeads, kvHeads);
  const kv = m.kvHeadForQuery(q);
  const group = m.groups[kv];
  if (m.groupSize === 1) return `Q${q} → KV${kv} (group ${kv}, not shared: each query head has its own KV head)`;
  return `Q${q} → KV${kv} (group ${kv}, shared with ${rangeText(group)})`;
}

/** Tensor shapes for one layer (no batch dimension). */
export function kvShapes({ qHeads, kvHeads, headDim, seqLen }) {
  const m = math.gqaMapping(qHeads, kvHeads);
  return Object.freeze({
    q: [seqLen, qHeads, headDim],
    kvCached: [seqLen, kvHeads, headDim],
    kvRepeated: [seqLen, qHeads, headDim],
    groupSize: m.groupSize,
  });
}

/** Percentage reduction of value relative to base: (1 − value/base) · 100. */
export function reductionPercent(base, value) {
  if (!(base > 0)) throw new Error('Base must be positive.');
  return (1 - value / base) * 100;
}

function layoutRow(id, label, qHeads, kvHeads, headDim, seqLen, mhaTotal) {
  const params = { layers: FIXED.layers, seqLen, kvHeads, headDim, bytesPerElem: FIXED.bytesPerElem };
  const b = math.kvBytesBreakdown(params);
  const total = b.total;
  return Object.freeze({
    id, label, qHeads, kvHeads,
    kind: math.gqaMapping(qHeads, kvHeads).kind,
    groupSize: qHeads / kvHeads,
    perTokenLayer: b.perTokenLayer,
    perToken: b.perToken,
    total,
    readPerDecodeStep: total,
    fractionOfMha: mhaTotal === undefined ? 1 : total / mhaTotal,
    reductionVsMha: mhaTotal === undefined ? 0 : reductionPercent(mhaTotal, total),
  });
}

/**
 * Compare MHA (H_KV = H_q), the current layout and MQA (H_KV = 1) with H_q, D, T, L, B held fixed.
 * Memory per row: M_KV = 2 · L · T · H_KV · D · B (raw KV storage for one sequence).
 */
export function compareLayouts(config) {
  const check = validateConfig(config);
  if (!check.valid) throw new Error(check.reason);
  const { qHeads, kvHeads, headDim, seqLen } = config;
  const mha = layoutRow('mha', 'MHA', qHeads, qHeads, headDim, seqLen);
  return Object.freeze([
    mha,
    layoutRow('current', 'Current', qHeads, kvHeads, headDim, seqLen, mha.total),
    layoutRow('mqa', 'MQA', qHeads, 1, headDim, seqLen, mha.total),
  ]);
}

/** Format a percentage with at most two decimals: 75 → "75%", 91.666… → "91.67%". */
export function fmtPercent(p) {
  return `${ui.fmtNumber(p, 2)}%`;
}

function memText(bytes) {
  return math.formatBytes(bytes, { system: 'binary' });
}

function ratioText(before, after) {
  if (after === before) return 'unchanged';
  return after > before ? `×${ui.fmtNumber(after / before, 2)}` : `÷${ui.fmtNumber(before / after, 2)}`;
}

/**
 * Explain what a control change did to the current layout's KV memory and why.
 * field: 'qHeads' | 'kvHeads' | 'headDim' | 'seqLen' | 'preset'. adjustedKvFrom: KV count before an automatic fix.
 */
export function describeChange(prev, next, field, { adjustedKvFrom } = {}) {
  const before = math.kvBytes({ layers: FIXED.layers, seqLen: prev.seqLen, kvHeads: prev.kvHeads, headDim: prev.headDim, bytesPerElem: FIXED.bytesPerElem });
  const after = math.kvBytes({ layers: FIXED.layers, seqLen: next.seqLen, kvHeads: next.kvHeads, headDim: next.headDim, bytesPerElem: FIXED.bytesPerElem });
  const mem = `Current M_KV ${memText(before)} → ${memText(after)} (${ratioText(before, after)})`;
  const g = next.qHeads / next.kvHeads;
  switch (field) {
    case 'qHeads': {
      let text = `Query heads ${prev.qHeads} → ${next.qHeads}. Group size is now ${g}. `;
      if (adjustedKvFrom !== undefined) text += `KV heads moved ${adjustedKvFrom} → ${next.kvHeads} because ${adjustedKvFrom} does not divide ${next.qHeads}. `;
      text += adjustedKvFrom === undefined
        ? `${mem}: H_q does not appear in M_KV, so only the sharing pattern and the MHA reference row change.`
        : `${mem}: M_KV follows H_KV, not H_q.`;
      return text;
    }
    case 'kvHeads':
      return `KV heads ${prev.kvHeads} → ${next.kvHeads}; each KV head now serves ${g} query head${g === 1 ? '' : 's'}. ${mem}: M_KV is proportional to H_KV.`;
    case 'headDim':
      return `Head dimension ${prev.headDim} → ${next.headDim}. ${mem}: every cached key and value vector has D numbers, so M_KV is proportional to D.`;
    case 'seqLen':
      return `Sequence length ${ui.fmtInt(prev.seqLen)} → ${ui.fmtInt(next.seqLen)} tokens. ${mem}: one key and one value vector per KV head are cached for every token, so M_KV is proportional to T.`;
    default:
      return prev.kvHeads === next.kvHeads
        ? `Layout ${prev.qHeads}/${prev.kvHeads} → ${next.qHeads}/${next.kvHeads} (query/KV heads). ${mem}: H_KV did not change.`
        : `Layout ${prev.qHeads}/${prev.kvHeads} → ${next.qHeads}/${next.kvHeads} (query/KV heads). ${mem}: H_KV went ${prev.kvHeads} → ${next.kvHeads} and M_KV is proportional to H_KV.`;
  }
}

// ---------------------------------------------------------------- Knowledge checks

export const CHECKS = Object.freeze([
  {
    type: 'numeric',
    questionHtml: 'A GQA layer has 32 query heads and 8 KV heads. How many query heads share each KV head?',
    correct: 4,
    tolerance: 1e-9,
    units: 'query heads per KV head',
    misconceptions: [
      { value: 8, message: '8 is the number of KV heads, which is also the number of groups. Each group contains 32 / 8 query heads.' },
      { value: 0.25, message: 'That is the ratio inverted (8 / 32). Group size is query heads divided by KV heads.' },
      { value: 24, message: 'Subtracting does not give the group size. The 32 query heads are split evenly into 8 groups.' },
      { value: 256, message: 'Multiplying gives 32 × 8; the group size is 32 / 8.' },
    ],
    explanation: 'G = H_q / H_KV = 32 / 8 = 4. Query head i reads KV head ⌊i / 4⌋, so Q0–Q3 share KV0, Q4–Q7 share KV1, …, Q28–Q31 share KV7.',
  },
  {
    type: 'numeric',
    questionHtml: 'Keep L, T, D and B the same, and keep 32 query heads. If the model used 32 KV heads (MHA) instead of 8, how many times larger would the raw KV storage for one sequence be?',
    correct: 4,
    tolerance: 1e-9,
    units: '× the GQA storage',
    misconceptions: [
      { value: 1, message: 'The query head count did not change, but M_KV = 2 · L · T · H_KV · D · B depends on H_KV, which went from 8 to 32.' },
      { value: 0.25, message: 'That is the GQA size relative to MHA. MHA stores more K/V heads, so it is larger, not smaller.' },
      { value: 32, message: '32 is the new KV head count, not the ratio. Every other factor is unchanged, so the ratio is 32 / 8.' },
      { value: 8, message: 'The ratio of storage is the ratio of KV head counts: 32 / 8.' },
    ],
    explanation: 'Every factor in M_KV = 2 · L · T · H_KV · D · B is unchanged except H_KV, which grows from 8 to 32. Storage is linear in H_KV, so it is 32 / 8 = 4× larger. With L = 32, T = 4,096, D = 128 and BF16, that is 512 MiB instead of 128 MiB per sequence.',
  },
  {
    type: 'choice',
    questionHtml: 'A team replaces an MHA design (32 KV heads) with GQA (8 KV heads) in a newly trained model. Which conclusion follows from the arithmetic in this lesson alone?',
    options: [
      { id: 'a', label: 'Raw KV storage per sequence, and the KV bytes read per decode step, drop to one quarter.' },
      { id: 'b', label: 'End-to-end generation becomes 4× faster.' },
      { id: 'c', label: 'Output quality will match the MHA model.' },
      { id: 'd', label: 'Any trained MHA checkpoint can be switched to this layout without further training.' },
    ],
    correct: 'a',
    misconceptions: {
      b: 'Latency also depends on weight reads, kernels, batch size, sequence length and hardware. Smaller KV traffic does not guarantee a proportional speedup.',
      c: 'Quality has to be measured on the trained model. Published results report small losses for MQA and near-MHA quality for GQA in the settings they tested; the memory formula says nothing about quality.',
      d: 'Changing the number of KV heads changes the K and V projection weights. Ainslie et al. convert checkpoints by mean-pooling KV heads and then continuing training (uptraining).',
    },
    explanation: 'M_KV and the simplified per-step KV read are both linear in H_KV, so 8 / 32 = ¼ of the MHA value. Speed, quality and checkpoint compatibility are separate questions that need measurement or retraining.',
  },
]);

// ---------------------------------------------------------------- DOM

function mountTool(doc) {
  const root = doc.getElementById('gqa-lab');
  if (!root) return;
  const $ = (id) => doc.getElementById(id);
  const qSelect = $('gqa-q');
  const kvSelect = $('gqa-kv');
  const dSelect = $('gqa-d');
  const tInput = $('gqa-t');
  const error = $('gqa-error');
  const diagram = $('gqa-diagram');
  const selection = $('gqa-selection');
  const change = $('gqa-change');
  const summary = $('gqa-summary');
  const tableBody = $('gqa-table-body');
  const formula = $('gqa-formula');
  const shapes = $('gqa-shapes');

  let config = { ...DEFAULT_CONFIG };
  let selectedQ = 5;

  Q_HEAD_OPTIONS.forEach((n) => qSelect.append(ui.el(doc, 'option', { text: String(n), attrs: { value: String(n) } })));
  HEAD_DIM_OPTIONS.forEach((n) => dSelect.append(ui.el(doc, 'option', { text: String(n), attrs: { value: String(n) } })));

  function fillKvOptions() {
    kvSelect.replaceChildren();
    validKvHeads(config.qHeads).forEach((k) => {
      let label = String(k);
      if (k === config.qHeads) label += ' (MHA)';
      else if (k === 1) label += ' (MQA)';
      kvSelect.append(ui.el(doc, 'option', { text: label, attrs: { value: String(k) } }));
    });
  }

  function syncControls() {
    qSelect.value = String(config.qHeads);
    fillKvOptions();
    kvSelect.value = String(config.kvHeads);
    dSelect.value = String(config.headDim);
    tInput.value = String(config.seqLen);
  }

  function renderSelection() {
    const m = math.gqaMapping(config.qHeads, config.kvHeads);
    const kv = m.kvHeadForQuery(selectedQ);
    diagram.querySelectorAll('.gqa-q').forEach((btn) => {
      const on = Number(btn.dataset.q) === selectedQ;
      btn.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
    diagram.querySelectorAll('.gqa-group').forEach((group) => {
      const on = Number(group.dataset.group) === kv;
      group.classList.toggle('is-highlight', on);
      group.querySelector('.gqa-kv-note').textContent = on ? `← read by selected Q${selectedQ}` : '';
    });
    selection.textContent = describeQueryHead(config.qHeads, config.kvHeads, selectedQ);
  }

  function renderDiagram() {
    const m = math.gqaMapping(config.qHeads, config.kvHeads);
    diagram.setAttribute('aria-label', `${m.kind}: ${m.qHeads} query heads in ${m.kvHeads} group${m.kvHeads === 1 ? '' : 's'} of ${m.groupSize}`);
    const groups = m.groups.map((members, g) => {
      const buttons = members.map((q) => ui.el(doc, 'button', {
        className: 'gqa-q', text: `Q${q}`,
        attrs: { type: 'button', 'data-q': String(q), 'aria-pressed': 'false', 'aria-label': `Query head ${q}, group ${g}` },
      }));
      return ui.el(doc, 'li', { className: 'gqa-group', attrs: { 'data-group': String(g) } }, [
        ui.el(doc, 'p', { className: 'gqa-group-label', text: `Group ${g} · KV${g}` }),
        ui.el(doc, 'div', { className: 'gqa-queries' }, buttons),
        ui.el(doc, 'p', { className: 'gqa-connector', text: m.groupSize === 1 ? '↓ reads' : `↓ all ${m.groupSize} read`, attrs: { 'aria-hidden': 'true' } }),
        ui.el(doc, 'p', { className: 'gqa-kv' }, [
          ui.tensorTag(doc, 'k', `K${g}`), ui.tensorTag(doc, 'v', `V${g}`),
          ui.el(doc, 'span', { className: 'gqa-kv-note' }),
        ]),
      ]);
    });
    diagram.classList.toggle('is-compact', m.groupSize === 1);
    diagram.replaceChildren(...groups);
  }

  function renderNumbers() {
    $('gqa-reference').textContent = `Shared dimensions: head width ${config.headDim}, sequence length ${ui.fmtInt(config.seqLen)} positions, ${FIXED.layers} layers and ${FIXED.bytesPerElem} bytes per element in every comparison row. Grouping and percentage savings depend on head counts, not these shared dimensions.`;
    const rows = compareLayouts(config);
    const cur = rows[1];
    tableBody.replaceChildren(...rows.map((r) => {
      const name = r.id === 'current' ? `Current (${r.kind})` : r.label;
      const tr = ui.el(doc, 'tr', { className: r.id === 'current' ? 'is-highlight' : undefined }, [
        ui.el(doc, 'th', { text: name, attrs: { scope: 'row' } }),
        ui.el(doc, 'td', { className: 'num', text: `${r.qHeads} / ${r.kvHeads}` }),
        ui.el(doc, 'td', { className: 'num', text: String(r.groupSize) }),
        ui.el(doc, 'td', { className: 'num', text: `${ui.fmtInt(r.perToken)} B` }),
        ui.el(doc, 'td', { className: 'num' }, [ui.el(doc, 'strong', { text: memText(r.total) }), ui.el(doc, 'span', { className: 'gqa-bytes', text: ` ${ui.fmtInt(r.total)} B` })]),
        ui.el(doc, 'td', { className: 'num', text: r.id === 'mha' ? '— (reference)' : fmtPercent(r.reductionVsMha) }),
      ]);
      return tr;
    }));
    formula.textContent = `Current: M_KV = 2 · ${FIXED.layers} · ${ui.fmtInt(config.seqLen)} · ${config.kvHeads} · ${config.headDim} · ${FIXED.bytesPerElem} = ${ui.fmtInt(cur.total)} bytes = ${memText(cur.total)}`;
    const s = kvShapes(config);
    shapes.textContent = `Per layer: Q ${ui.fmtShape(s.q)}; cached K and V each ${ui.fmtShape(s.kvCached)}; a naive implementation that repeats K/V ${s.groupSize}× builds temporaries of ${ui.fmtShape(s.kvRepeated)}.`;
    summary.textContent = `${cur.kind}: ${config.qHeads} query heads, ${config.kvHeads} KV head${config.kvHeads === 1 ? '' : 's'}, group size ${cur.groupSize}. Raw KV storage for one ${ui.fmtInt(config.seqLen)}-token sequence: ${memText(cur.total)}, ${cur.kind === 'MHA' ? 'the same as the MHA reference' : `${fmtPercent(cur.reductionVsMha)} less than MHA`}. In this simplified model each decode step at this length also reads about ${memText(cur.readPerDecodeStep)} of cached K/V.`;
  }

  function apply(next, field, extra) {
    const check = validateConfig(next);
    if (!check.valid) {
      error.textContent = check.reason;
      error.hidden = false;
      return;
    }
    error.hidden = true;
    const prev = config;
    config = next;
    if (selectedQ >= config.qHeads) selectedQ = config.qHeads - 1;
    syncControls();
    renderDiagram();
    renderNumbers();
    renderSelection();
    if (field) change.textContent = describeChange(prev, next, field, extra);
  }

  qSelect.addEventListener('change', () => {
    const qHeads = Number(qSelect.value);
    const kvHeads = nearestValidKv(qHeads, config.kvHeads);
    apply({ ...config, qHeads, kvHeads }, 'qHeads', kvHeads !== config.kvHeads ? { adjustedKvFrom: config.kvHeads } : {});
  });
  kvSelect.addEventListener('change', () => apply({ ...config, kvHeads: Number(kvSelect.value) }, 'kvHeads'));
  dSelect.addEventListener('change', () => apply({ ...config, headDim: Number(dSelect.value) }, 'headDim'));
  tInput.addEventListener('change', () => {
    const value = ui.parseNumber(tInput.value);
    apply({ ...config, seqLen: value === null ? Number.NaN : value }, 'seqLen');
  });
  root.querySelectorAll('[data-preset]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const p = PRESETS[btn.dataset.preset];
      apply({ ...config, qHeads: p.qHeads, kvHeads: p.kvHeads }, 'preset');
    });
  });
  diagram.addEventListener('click', (event) => {
    const btn = event.target.closest('.gqa-q');
    if (!btn) return;
    selectedQ = Number(btn.dataset.q);
    renderSelection();
  });

  apply(config);
  change.textContent = 'Change a control to see what happens to the current layout and why.';
}

function mountChecks(doc) {
  CHECKS.forEach((cfg, i) => {
    const host = doc.getElementById(`gqa-check-${i + 1}`);
    if (host) ui.createKnowledgeCheck(host, cfg);
  });
}

if (typeof document !== 'undefined') {
  mountTool(document);
  mountChecks(document);
}

export const lesson = Object.freeze({ number: 3, math, ui });
