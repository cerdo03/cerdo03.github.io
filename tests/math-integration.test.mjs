import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('Module 0 has independent current-page and concept navigation', () => {
  const shell = read('labs/llm-systems/course-shell.js');
  assert.match(shell, /dataset\.mathLesson/);
  assert.match(shell, /0\. Optional math toolkit/);
  assert.match(shell, /math-fluency\/lesson-\$\{mathNumber\}/);
  assert.match(shell, /mathNumber \? `Mathematical notation/);
  assert.match(shell, /location\.search/);
});

test('softmax is authored as three distinct typeset stages with contextual support', () => {
  const html = read('labs/attention/lesson-1.html');
  const softmax = html.split('<section id="s2-1-5"')[1].split('<section id="s2-1-6"')[0];
  for (const label of ['Original softmax', 'Choose row maximum', 'Numerically stable form']) assert.match(softmax, new RegExp(label));
  assert.equal((softmax.match(/data-math=/g) || []).length, 2);
  assert.match(softmax, /data-equation="softmax-stable"/);
  assert.match(softmax, /lesson-4.html\?from=softmax/);
});

test('legacy symbol help excludes authored and generated mathematical markup', () => {
  assert.match(read('labs/attention/symbols.js'), /node\.closest\('\[data-math\], \.katex, math'\)/);
});

test('optional toolkit registers as third published course site', async () => {
  const { sites } = await import('../assets/learning-catalog.js');
  assert.equal(sites['math-fluency'].project, 'llm-systems');
  assert.equal(sites['math-fluency'].path, '/labs/math-fluency/');
  assert.match(read('labs/llm-systems/index.html'), /3 published sites/);
  assert.match(read('index.html'), /Collection · 3 sites/);
});

test('course context retains only encoded allowlisted equation origins', async () => {
  const shell = read('labs/llm-systems/course-shell.js');
  assert.match(shell, /course-context\.js/);
  const { equationContext } = await import('../labs/llm-systems/course-context.js');
  assert.equal(equationContext('?from=softmax&anything=%22%3E'), '?from=softmax');
  assert.equal(equationContext('?from=values'), '?from=values');
  assert.equal(equationContext('?from=https%3A%2F%2Fevil.example'), '');
  assert.equal(equationContext('?from=%22%3E'), '');
  assert.equal(equationContext(''), '');
  assert.doesNotMatch(shell, /location\.search\s*:/);
});

test('concept titles strip either module prefix before local numbering', async () => {
  const { conceptTitle } = await import('../labs/llm-systems/course-context.js');
  assert.equal(typeof conceptTitle, 'function');
  assert.equal(conceptTitle('0.1.1 A declaration'), 'A declaration');
  assert.equal(conceptTitle('2.1.5 Softmax'), 'Softmax');
  assert.equal(conceptTitle('Transfer check'), 'Transfer check');
});

test('all prioritized Module 2 authored equation blocks are typeset', () => {
  for (let lesson = 1; lesson <= 5; lesson++) {
    const html = read(`labs/attention/lesson-${lesson}.html`);
    const blocks = [...html.matchAll(/<div class="eq[^\"]*"[^>]*>/g)];
    assert.ok(blocks.length, `lesson ${lesson} equations`);
    for (const [block] of blocks) assert.match(block, /data-math=/, block);
  }
});

test('dynamic visual formulas use fixed authored math and explicit per-view mounting', () => {
  assert.match(read('labs/llm-systems/learning-visuals.js'), /renderVisualMath\(root, type\)/);
  assert.match(read('labs/inference/app.js'), /mountConceptMath\(.*lesson\.id/);
});

test('migrated equations and fixed visual identities parse with strict self-hosted KaTeX', async () => {
  const { default: katex } = await import('../assets/vendor/katex/0.19.0/katex.js');
  for (let lesson = 1; lesson <= 5; lesson++) {
    for (const [, source] of read(`labs/attention/lesson-${lesson}.html`).matchAll(/data-math="([^"]+)"/g)) {
      const tex = source.replaceAll('&gt;', '>').replaceAll('&lt;', '<').replaceAll('&amp;', '&').replaceAll('&quot;', '"');
      const rendered = katex.renderToString(tex, { strict: 'error', throwOnError: true, output: 'htmlAndMathml' });
      assert.match(rendered, /<math/);
    }
  }
});

test('explicit dynamic formula mounts are idempotent and never typeset unknown views', async () => {
  const { renderVisualMath, visualEquations } = await import('../labs/llm-systems/math-integration.js');
  const attrs = new Map();
  let writes = 0, html = '';
  const formula = {
    classList: { add() {}, toggle() {}, remove() {} },
    removeAttribute: name => attrs.delete(name),
    setAttribute: (name, value) => attrs.set(name, value),
    set innerHTML(value) { html = value; writes++; },
    get innerHTML() { return html; },
  };
  const root = { querySelector: () => formula };
  for (const type of Object.keys(visualEquations)) {
    renderVisualMath(root, type);
    assert.match(html, /<math/);
    assert.equal(attrs.has('data-math-error'), false);
    const count = writes;
    renderVisualMath(root, type);
    assert.equal(writes, count);
  }
  const count = writes;
  renderVisualMath(root, 'request');
  assert.equal(writes, count);
});
