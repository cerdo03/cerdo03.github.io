import katex from '../../assets/vendor/katex/0.19.0/katex.js';

// This API accepts trusted, authored lesson TeX only. Never pass visitor input.
const rendered = new WeakMap();

// Measure connected equations after fonts, disclosure changes and resizing.
// No observers retain discarded simulation frames or trigger re-typesetting.
export function updateMathOverflow(root = globalThis.document) {
  if (!root) return;
  const nodes = [...(root.matches?.('.math-display') ? [root] : []), ...root.querySelectorAll('.math-display')];
  for (const element of nodes) {
    if (!element.clientWidth) continue;
    const overflow = element.scrollWidth > element.clientWidth + 1;
    let hint = element.querySelector('.math-scroll-hint');
    if (!hint && overflow) {
      hint = element.ownerDocument.createElement('span');
      hint.className = 'math-scroll-hint';
      hint.textContent = '↔ Scroll equation horizontally';
      element.append(hint);
    }
    if (hint) hint.hidden = !overflow;
    if (overflow) {
      element.setAttribute('tabindex', '0');
      element.dataset.mathOverflow = 'true';
    } else if (element.dataset.mathOverflow === 'true') {
      element.removeAttribute('tabindex');
      delete element.dataset.mathOverflow;
    }
  }
}

export function renderMath(element, tex, { displayMode = false, label, id } = {}) {
  if (!element) return element;
  const source = String(tex ?? '');
  const signature = JSON.stringify([source, displayMode, label, id]);
  if (rendered.get(element) === signature) return element;
  element.classList.add('math-expression');
  element.classList.toggle('math-display', displayMode);
  if (!displayMode && element.dataset?.mathOverflow === 'true') {
    element.removeAttribute('tabindex');
    delete element.dataset.mathOverflow;
  }
  element.classList.remove('math-fallback');
  element.removeAttribute('data-math-error');
  if (id) element.id = id;
  if (label) {
    element.setAttribute('role', 'group');
    element.setAttribute('aria-label', label);
  } else if (rendered.has(element)) {
    element.removeAttribute('role');
    element.removeAttribute('aria-label');
  }
  try {
    element.innerHTML = katex.renderToString(source, {
      displayMode,
      output: 'htmlAndMathml',
      throwOnError: true,
      trust: false,
      strict: 'error',
      maxExpand: 1000,
      maxSize: 20,
      macros: {},
    });
  } catch {
    // Text, not HTML: malformed authored equations remain legible and inert.
    element.textContent = source;
    element.classList.add('math-fallback');
    element.setAttribute('data-math-error', 'true');
  }
  element.setAttribute('data-math-rendered', 'true');
  rendered.set(element, signature);
  if (typeof window !== 'undefined') queueMicrotask(() => updateMathOverflow(element));
  return element;
}

export function renderMathIn(root = globalThis.document) {
  if (!root) return [];
  const elements = [...(root.matches?.('[data-math]') ? [root] : []), ...root.querySelectorAll('[data-math]')];
  for (const element of elements) {
    renderMath(element, element.getAttribute('data-math'), {
      displayMode: element.getAttribute('data-display') === 'true',
      label: element.getAttribute('data-math-label') || undefined,
    });
  }
  return elements;
}

if (typeof document !== 'undefined') {
  document.fonts?.ready.then(() => updateMathOverflow());
  window.addEventListener('resize', () => updateMathOverflow());
  document.addEventListener('course:section', () => updateMathOverflow());
  document.addEventListener('toggle', () => updateMathOverflow(), true);
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => renderMathIn(), { once: true });
  } else {
    renderMathIn();
  }
}
