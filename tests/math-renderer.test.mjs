import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const rendererPath = resolve('labs/llm-systems/math-renderer.js');
const vendorPath = resolve('assets/vendor/katex/0.19.0');

function element(attributes = {}) {
  const attrs = new Map(Object.entries(attributes));
  const classes = new Set();
  let html = '';
  let writes = 0;
  return {
    get innerHTML() { return html; },
    set innerHTML(value) { html = value; writes += 1; },
    get writes() { return writes; },
    textContent: '', id: '',
    classList: { add: (...names) => names.forEach(name => classes.add(name)), contains: name => classes.has(name), remove: name => classes.delete(name), toggle: (name, force) => force ? classes.add(name) : classes.delete(name) },
    getAttribute: name => attrs.get(name) ?? null,
    hasAttribute: name => attrs.has(name),
    setAttribute: (name, value) => attrs.set(name, String(value)),
    removeAttribute: name => attrs.delete(name),
    matches: selector => selector === '[data-math]' && attrs.has('data-math'),
    querySelectorAll: () => [],
  };
}

async function renderer() {
  assert.ok(existsSync(rendererPath), 'shared math renderer exists');
  return import(rendererPath);
}

test('renderer produces visual HTML and accessible MathML for a real fraction', async () => {
  const { renderMath } = await renderer();
  const target = element();
  assert.equal(renderMath(target, String.raw`a_j=\frac{e^{z_j-m}}{\sum_k e^{z_k-m}}`, { displayMode: true, label: 'Stable softmax', id: 'stable' }), target);
  assert.match(target.innerHTML, /class="katex-display"/);
  assert.match(target.innerHTML, /<math[\s>]/);
  assert.match(target.innerHTML, /<mfrac>/);
  assert.equal(target.getAttribute('aria-label'), 'Stable softmax');
  assert.equal(target.id, 'stable');
  assert.equal(target.getAttribute('data-math-rendered'), 'true');
});

test('authored inline and display nodes mount once and changed TeX re-renders', async () => {
  const { renderMathIn } = await renderer();
  const inline = element({ 'data-math': 'x_i' });
  const display = element({ 'data-math': String.raw`\begin{aligned}m&=\max_k z_k\\a_j&=e^{z_j-m}\end{aligned}`, 'data-display': 'true' });
  const root = { querySelectorAll: () => [inline, display] };
  assert.equal(renderMathIn(root).length, 2);
  assert.doesNotMatch(inline.innerHTML, /katex-display/);
  assert.match(display.innerHTML, /katex-display/);
  const first = inline.innerHTML;
  const writes = inline.writes;
  renderMathIn(root);
  assert.equal(inline.innerHTML, first);
  assert.equal(inline.writes, writes);
  inline.setAttribute('data-math', 'y_j');
  renderMathIn(inline);
  assert.notEqual(inline.innerHTML, first);
  assert.match(inline.innerHTML, /y_j/);
});

test('invalid equations retain readable text without throwing or injecting markup', async () => {
  const { renderMath } = await renderer();
  const target = element();
  const tex = String.raw`\frac{<img src=x onerror=alert(1)>`;
  assert.doesNotThrow(() => renderMath(target, tex));
  assert.equal(target.textContent, tex);
  assert.equal(target.getAttribute('data-math-error'), 'true');
  assert.equal(target.classList.contains('math-fallback'), true);
  renderMath(target, 'x');
  assert.equal(target.hasAttribute('data-math-error'), false);
  assert.equal(target.classList.contains('math-fallback'), false);
});

test('HTML extensions and unsafe URLs cannot become active content', async () => {
  const { renderMath } = await renderer();
  const target = element();
  renderMath(target, String.raw`\href{javascript:alert(1)}{x}`);
  assert.doesNotMatch(target.innerHTML, /<a\b|href="javascript:/);
  renderMath(target, String.raw`\htmlClass{injected}{x}`);
  assert.doesNotMatch(target.innerHTML, /class="injected"/);
});

test('vendor runtime, license and every font URL are self hosted', async () => {
  await renderer();
  assert.ok(existsSync(resolve(vendorPath, 'katex.js')));
  assert.match(readFileSync(resolve(vendorPath, 'LICENSE'), 'utf8'), /MIT License/);
  const css = readFileSync(resolve(vendorPath, 'katex.min.css'), 'utf8');
  const urls = [...css.matchAll(/url\(([^)]+)\)/g)].map(match => match[1].replace(/["']/g, ''));
  assert.ok(urls.length > 0);
  for (const url of urls) {
    assert.doesNotMatch(url, /^(?:https?:|\/\/)/);
    assert.ok(existsSync(resolve(vendorPath, url)), `font exists: ${url}`);
  }
  assert.match(readFileSync(resolve('labs/llm-systems/math.css'), 'utf8'), /@import.*assets\/vendor\/katex\/0\.19\.0\/katex\.min\.css/);
});

test('changing options removes stale renderer labels without removing MathML', async () => {
  const { renderMath } = await renderer();
  const target = element();
  renderMath(target, 'x', { label: 'First label' });
  renderMath(target, 'y');
  assert.equal(target.hasAttribute('aria-label'), false);
  assert.equal(target.hasAttribute('role'), false);
  assert.match(target.innerHTML, /<math[\s>]/);
});

test('overflowing equations expose a scroll cue and keyboard access only when needed', async () => {
  const renderer = await import('../labs/llm-systems/math-renderer.js');
  assert.equal(typeof renderer.updateMathOverflow, 'function');
  const attrs = new Map();
  const hint = { hidden: true };
  const element = { clientWidth: 200, scrollWidth: 350, dataset: {},
    matches: () => true, querySelectorAll: () => [], querySelector: () => hint,
    setAttribute: (key, value) => attrs.set(key, value), removeAttribute: key => attrs.delete(key) };
  renderer.updateMathOverflow(element);
  assert.equal(hint.hidden, false);
  assert.equal(attrs.get('tabindex'), '0');
  element.scrollWidth = 200;
  renderer.updateMathOverflow(element);
  assert.equal(hint.hidden, true);
  assert.equal(attrs.has('tabindex'), false);
});

test('changing a scrolling display equation to inline removes owned focus state', async () => {
  const { renderMath } = await renderer();
  const target = element({ tabindex: '0' });
  target.dataset = { mathOverflow: 'true' };
  renderMath(target, 'x', { displayMode: true });
  renderMath(target, 'x', { displayMode: false });
  assert.equal(target.hasAttribute('tabindex'), false);
  assert.equal(target.dataset.mathOverflow, undefined);
});
