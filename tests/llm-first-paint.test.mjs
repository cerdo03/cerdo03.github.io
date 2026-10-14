import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
const root = new URL('../', import.meta.url);
const pages = ['llm-systems/index', 'inference/index', 'attention/index', ...[1, 2, 3, 4, 5].map(n => `attention/lesson-${n}`)];
test('each collection entry starts the render guard before body parsing', () => {
  for (const page of pages) {
    const html = readFileSync(new URL(`labs/${page}.html`, root), 'utf8');
    const guard = html.match(/<script\b[^>]*src="[^"]*render-guard\.js"[^>]*><\/script>/);
    assert.ok(guard, `${page}: missing first-paint guard`);
    assert.ok(html.indexOf(guard[0]) < html.indexOf('</head>'));
    assert.doesNotMatch(guard[0], /\b(?:async|defer|type)\s*(?:=|>)/);
  }
});
test('body becomes visible only after all deferred lesson modules have run, including a failed-module fallback', () => {
  const source = readFileSync(new URL('labs/llm-systems/render-guard.js', root), 'utf8');
  for (const shellSucceeded of [true, false]) {
    const classes = new Set();
    let ready;
    vm.runInNewContext(source, { document: {
      documentElement: { classList: { add: value => classes.add(value), remove: value => classes.delete(value) } },
      addEventListener: (name, callback, options) => { assert.equal(name, 'DOMContentLoaded');assert.equal(options.once, true);ready = callback; }
    } });
    assert.equal(classes.has('course-pending'), true, 'hide legacy layout while modules load');
    if (shellSucceeded) classes.add('llm-course');
    ready();
    assert.equal(classes.has('course-pending'), false, 'reveal finalized shell or readable fallback');
  }
  const css = readFileSync(new URL('labs/llm-systems/course.css', root), 'utf8');
  assert.match(css, /\.course-pending body\s*\{\s*visibility:\s*hidden;/);
});
