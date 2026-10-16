import katex from '../../assets/vendor/katex/0.19.0/katex.js';

// This API accepts trusted, authored lesson TeX only. Never pass visitor input.
const rendered = new WeakMap();

export function renderMath(element, tex, { displayMode = false, label, id } = {}) {
  if (!element) return element;
  const source = String(tex ?? '');
  const signature = JSON.stringify([source, displayMode, label, id]);
  if (rendered.get(element) === signature) return element;
  element.classList.add('math-expression');
  element.classList.toggle('math-display', displayMode);
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
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => renderMathIn(), { once: true });
  } else {
    renderMathIn();
  }
}
