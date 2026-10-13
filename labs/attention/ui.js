// Shared DOM helpers for the Module 2 lesson pages.
//
// Math notation convention (no math library):
// - Inline math uses plain HTML: <var>Q</var>, <var>d</var><sub>k</sub>, <var>K</var><sup>T</sup>,
//   √<var>d</var><sub>k</sub>, ∈ ℝ<sup><var>T</var>×<var>d</var><sub>model</sub></sup>, −∞, ·, ×, Σ.
// - Display equations use <div class="eq" role="math" aria-label="spoken form">…</div>.
//   Add class "eq-boxed" for the key boxed results, and follow with a <dl class="eq-vars">
//   defining every variable.
// - Shapes are written [T, d_model] in text and via fmtShape() in code.
// - Tensor roles always carry a text label (Q, K, V, A, O, M) next to any colour/border cue:
//   use tensorTag('q') or <span class="tensor-tag t-q">Q</span>.
//
// Everything here is importable in Node (no DOM access at module load) so pure helpers
// like evaluateNumeric() can be unit tested.

const MINUS = '−';

/** Format a number for display: -Infinity → "−∞", fixed digits, trailing zeros trimmed, Unicode minus. */
export function fmtNumber(x, digits = 2) {
  if (x === -Infinity) return `${MINUS}∞`;
  if (x === Infinity) return '∞';
  if (typeof x !== 'number' || Number.isNaN(x)) return String(x);
  let text = x.toFixed(digits);
  if (text.includes('.')) text = text.replace(/0+$/, '').replace(/\.$/, '');
  if (text === '-0') text = '0';
  return text.replace('-', MINUS);
}

/** Format a vector as "[1, −0.5]". */
export function fmtWeight(x, digits = 3) {
  if (x > 0 && x < 10 ** -digits) return `<${10 ** -digits}`;
  return fmtNumber(x, digits);
}

export function fmtVector(v, digits = 2) {
  return `[${v.map((x) => fmtNumber(x, digits)).join(', ')}]`;
}

/** Format a shape array as "[T, 512]" (strings or numbers allowed). */
export function fmtShape(dims) {
  return `[${dims.join(', ')}]`;
}

/** Integer with thousands separators: 536870912 → "536,870,912". */
export function fmtInt(n) {
  return Math.round(n).toLocaleString('en-US');
}

/** Small element factory: el(doc, 'td', { className, text, attrs }, children). */
export function el(doc, tag, { className, text, attrs } = {}, children = []) {
  const node = doc.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  if (attrs) for (const [key, value] of Object.entries(attrs)) if (value !== undefined && value !== null) node.setAttribute(key, value);
  for (const child of children) if (child) node.append(child);
  return node;
}

const TENSOR_LETTERS = { q: 'Q', k: 'K', v: 'V', w: 'A', o: 'O', mask: 'M' };
const TENSOR_NAMES = { q: 'query', k: 'key', v: 'value', w: 'attention weights', o: 'output', mask: 'mask' };

/** A text tensor badge, e.g. tensorTag(document, 'k') → <span class="tensor-tag t-k" title="key">K</span>. */
export function tensorTag(doc, role, text) {
  if (!TENSOR_LETTERS[role]) throw new Error(`Unknown tensor role "${role}".`);
  return el(doc, 'span', { className: `tensor-tag t-${role}`, text: text ?? TENSOR_LETTERS[role], attrs: { title: TENSOR_NAMES[role] } });
}

/**
 * Render a matrix as an accessible <table> inside el (replacing its contents).
 * options: label (caption), rowLabels, colLabels, highlightRow, highlightCol, digits,
 *          cellClass(value, i, j) → extra class string, role ('q'|'k'|'v'|'w'|'o'|'mask') adds t-<role>.
 * -Infinity cells render "−∞" with class t-mask and a visually hidden "masked" word.
 * Highlighted rows/cols get .is-highlight plus a visually hidden "(selected)" in the header.
 */
export function renderMatrix(container, M, options = {}) {
  const { label, rowLabels, colLabels, highlightRow, highlightCol, digits = 2, cellClass, role } = options;
  if (!Array.isArray(M) || M.length === 0 || !Array.isArray(M[0])) throw new Error('renderMatrix needs a non-empty matrix.');
  const doc = container.ownerDocument;
  const cols = M[0].length;
  const table = el(doc, 'table', { className: `matrix${role ? ` t-${role}` : ''}` });
  if (label) table.append(el(doc, 'caption', { text: label }));
  const selected = () => el(doc, 'span', { className: 'visually-hidden', text: ' (selected)' });
  if (colLabels) {
    const head = el(doc, 'tr', {}, [el(doc, 'td', { className: 'matrix-corner' })]);
    for (let j = 0; j < cols; j += 1) {
      const th = el(doc, 'th', { text: String(colLabels[j] ?? j), attrs: { scope: 'col' } });
      if (j === highlightCol) { th.classList.add('is-highlight'); th.append(selected()); }
      head.append(th);
    }
    table.append(el(doc, 'thead', {}, [head]));
  }
  const body = el(doc, 'tbody');
  M.forEach((row, i) => {
    if (row.length !== cols) throw new Error(`renderMatrix: row ${i} has ${row.length} columns, expected ${cols}.`);
    const tr = el(doc, 'tr', { className: i === highlightRow ? 'is-highlight' : undefined });
    if (rowLabels) {
      const th = el(doc, 'th', { text: String(rowLabels[i] ?? i), attrs: { scope: 'row' } });
      if (i === highlightRow) th.append(selected());
      tr.append(th);
    }
    row.forEach((value, j) => {
      const classes = [];
      if (value === -Infinity) classes.push('t-mask');
      if (j === highlightCol) classes.push('is-highlight');
      const extra = cellClass?.(value, i, j);
      if (extra) classes.push(extra);
      const td = el(doc, 'td', { className: classes.join(' ') || undefined, text: role === 'w' ? fmtWeight(value, digits) : fmtNumber(value, digits) });
      if (value === -Infinity) td.append(el(doc, 'span', { className: 'visually-hidden', text: ' masked' }));
      tr.append(td);
    });
    body.append(tr);
  });
  table.append(body);
  const wrap = el(doc, 'div', { className: 'matrix-scroll', attrs: { tabindex: '0', role: 'region', 'aria-label': label || 'Matrix' } }, [table]);
  container.replaceChildren(wrap);
  return table;
}

/**
 * Render horizontal bars with numeric text (meaning never relies on bar length alone).
 * options: format(value) → string, max (scale reference; default max |value|), highlightIndex,
 *          label (list aria-label), role (adds t-<role> to bars).
 * Negative values draw with .is-negative and keep their minus sign in text.
 */
export function renderBars(container, values, labels, options = {}) {
  const { format = (x) => fmtNumber(x, 3), max, highlightIndex, label, role } = options;
  if (!Array.isArray(values) || values.length === 0) throw new Error('renderBars needs a non-empty array of values.');
  if (!Array.isArray(labels) || labels.length !== values.length) throw new Error('renderBars needs one label per value.');
  const doc = container.ownerDocument;
  const reference = max ?? Math.max(...values.map((v) => (Number.isFinite(v) ? Math.abs(v) : 0)), 0);
  const list = el(doc, 'ul', { className: 'bars', attrs: { 'aria-label': label } });
  values.forEach((value, i) => {
    const finite = Number.isFinite(value);
    const ratio = finite && reference > 0 ? Math.min(Math.abs(value) / reference, 1) : 0;
    const bar = el(doc, 'span', { className: `bar-fill${role ? ` t-${role}` : ''}${value < 0 ? ' is-negative' : ''}` });
    bar.style.inlineSize = `${(ratio * 100).toFixed(1)}%`;
    const li = el(doc, 'li', { className: i === highlightIndex ? 'is-highlight' : undefined }, [
      el(doc, 'span', { className: 'bar-label', text: String(labels[i]) }),
      el(doc, 'span', { className: 'bar-track', attrs: { 'aria-hidden': 'true' } }, [bar]),
      el(doc, 'span', { className: 'bar-value', text: role === 'w' && value > 0 && Number(format(value)) === 0 ? fmtWeight(value) : format(value) }),
    ]);
    if (i === highlightIndex) li.append(el(doc, 'span', { className: 'visually-hidden', text: ' (selected)' }));
    list.append(li);
  });
  container.replaceChildren(list);
  return list;
}

/** Parse a learner's number: accepts commas, spaces, Unicode minus, and e-notation. */
export function parseNumber(text) {
  const cleaned = String(text).trim().replace(/[\s,_]/g, '').replace(/−/g, '-');
  if (cleaned === '' || !/^[-+]?(\d+\.?\d*|\.\d+)(e[-+]?\d+)?$/i.test(cleaned)) return null;
  return Number(cleaned);
}

function normalizeUnits(units) {
  if (!units) return [];
  if (typeof units === 'string') return [{ label: units, factor: 1 }];
  return units.map((u) => (typeof u === 'string' ? { label: u, factor: 1 } : u));
}

/**
 * Pure numeric evaluation. correct is in base units; unit factor converts the entry.
 * misconceptions: [{ value (base units), tolerance?, message }] checked when the answer is wrong.
 * Returns { status: 'invalid' | 'correct' | 'incorrect', value, message }.
 */
export function evaluateNumeric({ text, unitLabel, correct, tolerance = 0.01, units, misconceptions = [] }) {
  const entered = parseNumber(text);
  if (entered === null) return { status: 'invalid', value: null, message: 'Enter a number (for example 65.5 or 6.55e10).' };
  const unitList = normalizeUnits(units);
  const unit = unitList.find((u) => u.label === unitLabel) ?? unitList[0] ?? { label: '', factor: 1 };
  const value = entered * unit.factor;
  const near = (target, tol) => (target === 0 ? Math.abs(value) <= tol : Math.abs(value - target) <= Math.abs(target) * tol);
  if (near(correct, tolerance)) return { status: 'correct', value, message: null };
  const hit = misconceptions.find((m) => near(m.value, m.tolerance ?? tolerance));
  return { status: 'incorrect', value, message: hit?.message ?? null };
}

/** Pure choice evaluation. misconceptions: { [optionId]: message }. */
export function evaluateChoice({ selected, correct, misconceptions = {} }) {
  if (selected === null || selected === undefined) return { status: 'invalid', message: 'Choose an answer first.' };
  if (String(selected) === String(correct)) return { status: 'correct', message: null };
  return { status: 'incorrect', message: misconceptions[selected] ?? null };
}

let checkCounter = 0;

/**
 * Knowledge check with feedback after submit (no scores or points).
 * config: { question (text or HTML string via questionHtml), type: 'choice' | 'numeric',
 *   options: string[] | {id,label}[] (choice), correct: option id/index (choice) or base value (numeric),
 *   tolerance (relative, numeric, default 0.01), units: string | (string | {label, factor})[],
 *   explanation: string (always shown after a valid submit), explanationHtml?: string,
 *   misconceptions: {[optionId]: msg} (choice) | [{value, tolerance?, message}] (numeric) }
 * Returns { root, reset() }.
 */
export function createKnowledgeCheck(container, config) {
  const { question, questionHtml, type, options = [], correct, tolerance = 0.01, units, explanation, explanationHtml, misconceptions } = config;
  if (type !== 'choice' && type !== 'numeric') throw new Error('Knowledge check type must be "choice" or "numeric".');
  const doc = container.ownerDocument;
  checkCounter += 1;
  const id = `kc-${checkCounter}`;
  const form = el(doc, 'form', { className: 'check', attrs: { novalidate: '' } });
  const fieldset = el(doc, 'fieldset');
  const legend = el(doc, 'legend');
  if (questionHtml) legend.innerHTML = questionHtml; else legend.textContent = question;
  fieldset.append(legend);

  const normalized = options.map((o, i) => (typeof o === 'string' ? { id: String(i), label: o } : { id: String(o.id), label: o.label }));
  let input;
  let unitSelect;
  if (type === 'choice') {
    const list = el(doc, 'div', { className: 'check-options' });
    normalized.forEach((o) => {
      const optionId = `${id}-${o.id}`;
      list.append(el(doc, 'div', { className: 'check-option' }, [
        el(doc, 'input', { attrs: { type: 'radio', name: id, id: optionId, value: o.id } }),
        el(doc, 'label', { text: o.label, attrs: { for: optionId } }),
      ]));
    });
    fieldset.append(list);
  } else {
    const row = el(doc, 'div', { className: 'check-numeric' });
    input = el(doc, 'input', { attrs: { type: 'text', inputmode: 'decimal', id: `${id}-value`, autocomplete: 'off' } });
    row.append(el(doc, 'label', { text: 'Your answer', attrs: { for: `${id}-value` } }), input);
    const unitList = normalizeUnits(units);
    if (unitList.length > 1) {
      unitSelect = el(doc, 'select', { attrs: { id: `${id}-unit`, 'aria-label': 'Unit' } });
      unitList.forEach((u) => unitSelect.append(el(doc, 'option', { text: u.label, attrs: { value: u.label } })));
      row.append(unitSelect);
    } else if (unitList.length === 1 && unitList[0].label) {
      row.append(el(doc, 'span', { className: 'check-unit', text: unitList[0].label }));
    }
    fieldset.append(row);
  }
  const submit = el(doc, 'button', { className: 'button', text: 'Check answer', attrs: { type: 'submit' } });
  const feedback = el(doc, 'div', { className: 'check-feedback', attrs: { 'aria-live': 'polite' } });
  form.append(fieldset, submit, feedback);

  function show(result) {
    feedback.replaceChildren();
    feedback.dataset.status = result.status;
    if (result.status === 'invalid') {
      feedback.append(el(doc, 'p', { text: result.message }));
      return;
    }
    feedback.append(el(doc, 'p', { className: 'check-verdict', text: result.status === 'correct' ? 'Correct.' : 'Not quite.' }));
    if (result.message) feedback.append(el(doc, 'p', { className: 'check-misconception', text: result.message }));
    const why = el(doc, 'div', { className: 'check-explanation' });
    if (explanationHtml) why.innerHTML = explanationHtml; else why.append(el(doc, 'p', { text: explanation }));
    feedback.append(why);
  }

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    if (type === 'choice') {
      const picked = form.querySelector(`input[name="${id}"]:checked`);
      show(evaluateChoice({ selected: picked ? picked.value : null, correct, misconceptions }));
    } else {
      show(evaluateNumeric({ text: input.value, unitLabel: unitSelect?.value, correct, tolerance, units, misconceptions }));
    }
  });

  container.replaceChildren(form);
  return {
    root: form,
    reset() { form.reset(); feedback.replaceChildren(); delete feedback.dataset.status; },
  };
}
