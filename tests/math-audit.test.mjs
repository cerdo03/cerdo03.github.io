import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync, mkdtempSync, readdirSync, lstatSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import { stableSoftmax, resolveReturnLink, matmulShape, transposeShape, indexedTerms, rawKvBytes, toMiB, exercises, evaluateChoice, markLesson, readProgress, resetProgress, rememberLesson, readResume } from '../labs/llm-systems/math-exercises.js';

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('audit: stable softmax matches independent analytic two-class odds', () => {
  for (const difference of [-30, -4, 0, 4, 30]) {
    const actual = stableSoftmax([1000, 1000 + difference]);
    const expected = 1 / (1 + Math.exp(difference));
    assert.ok(Math.abs(actual[0] - expected) < 1e-14);
    assert.ok(Math.abs(actual[0] + actual[1] - 1) < 1e-14);
  }
  assert.equal(Math.max(...[4, 8, 2, 6]), 8);
  assert.ok(stableSoftmax([4, 8, 2, 6])[1] > 0.8);
});

test('audit: masking preserves exact zeros without rounding positive values', () => {
  const probabilities = stableSoftmax([-Infinity, -300, 0, -Infinity]);
  assert.equal(probabilities[0], 0);
  assert.equal(probabilities[3], 0);
  assert.ok(probabilities[1] > 0);
  assert.equal(probabilities[1] / probabilities[2], Math.exp(-300));
  assert.throws(() => stableSoftmax([-Infinity, -Infinity]), RangeError);
});

test('audit: every contextual return link reaches an existing attention anchor', () => {
  for (const origin of ['softmax', 'scores', 'values', 'kv', 'projections', 'masking']) {
    const target = resolveReturnLink(`?from=${origin}`);
    const [path, fragment] = target.split('#');
    const source = read(`labs/math-fluency/${path}`);
    assert.ok(source.includes(`id="${fragment}"`), `${origin}: ${target}`);
  }
  for (const key of ['javascript:alert(1)', '//example.com', '__proto__', 'constructor', '%2F%2Fevil.test']) {
    assert.equal(resolveReturnLink(`?from=${key}`), resolveReturnLink(''));
  }
});

test('audit: all six lessons retain accessible static content and optional practice', () => {
  for (let lesson = 1; lesson <= 6; lesson++) {
    const source = read(`labs/math-fluency/lesson-${lesson}.html`);
    assert.match(source, new RegExp(`data-math-lesson="${lesson}"`));
    assert.doesNotMatch(source, /\bdata-lesson=/);
    assert.match(source, /<h1[\s>]/);
    assert.match(source, /data-math-exercise=/);
    assert.match(source, /data-math-return/);
    assert.match(source, /data-math=/);
  }
});

test('audit: deployment keeps pinned renderer/fonts and excludes developer/private files', () => {
  const output = mkdtempSync(join(tmpdir(), 'math-deploy-audit-'));
  try {
    execFileSync(process.execPath, ['scripts/prepare-site.mjs', output, 'audit123'], { cwd: resolve(new URL('..', import.meta.url).pathname) });
    assert.deepEqual(readdirSync(output).sort(), ['assets', 'index.html', 'journal', 'labs', 'styles.css']);
    assert.ok(existsSync(join(output, 'assets/vendor/katex/0.19.0/katex.js')));
    const html = readFileSync(join(output, 'labs/math-fluency/lesson-4.html'), 'utf8');
    assert.equal((html.match(/data-goatcounter=/g) || []).length, 1);
    assert.match(html, /math-renderer\.js\?v=audit123/);
    const renderer = readFileSync(join(output, 'labs/llm-systems/math-renderer.js'), 'utf8');
    assert.doesNotMatch(renderer, /(?:https?:)?\/\/.*katex/);
    assert.match(renderer, /katex[^'"\n]*\.mjs\?v=audit123|katex[^'"\n]*\.js\?v=audit123/);
    let fonts = 0;
    function inspect(directory) {
      for (const item of readdirSync(directory)) {
        const path = join(directory, item), stat = lstatSync(path);
        assert.equal(stat.isSymbolicLink(), false, path);
        if (stat.isDirectory()) inspect(path);
        else if (/\.woff2?$/.test(item)) fonts++;
      }
    }
    inspect(output);
    assert.ok(fonts > 0);
  } finally { rmSync(output, { recursive: true, force: true }); }
});


test('audit: concrete matrix products, six-term sums and exact cache units', () => {
  assert.deepEqual(matmulShape([4, 8], transposeShape([6, 8])), [4, 6]);
  assert.throws(() => matmulShape([4, 8], [6, 8]), /inner dimensions/);
  assert.equal(transposeShape([4, 8]).reduce((a, b) => a * b), 32);
  assert.deepEqual(indexedTerms(0, 1).map(term => term.product), [2, 2, 0, 4, 10, 18]);
  assert.equal(indexedTerms(0, 1).reduce((sum, term) => sum + term.product, 0), 36);
  const bytes = rawKvBytes({layers: 32, tokens: 4096, kvHeads: 8, headDim: 128, bytesPerElement: 2});
  assert.equal(bytes, 536870912);
  assert.equal(toMiB(bytes), 512);
  assert.equal(rawKvBytes({layers: 32, tokens: 4096, kvHeads: 4, headDim: 128, bytesPerElement: 2}), bytes / 2);
});

test('audit: all checkpoints have reachable success, explanatory failure and opt-in hints', () => {
  for (const id of ['notation', 'indices', 'shapes', 'softmax', 'transformer', 'capstone']) {
    const exercise = exercises[id];
    assert.equal(evaluateChoice(id, exercise.answer).correct, true);
    const wrong = (exercise.answer + 1) % exercise.choices.length;
    assert.equal(evaluateChoice(id, wrong).correct, false);
    assert.ok(evaluateChoice(id, wrong).feedback.includes(exercise.explanation));
    assert.ok(exercise.hints.length >= 2);
  }
});

test('audit: progress stores lesson ids only and blocked storage cannot block lessons', () => {
  const values = new Map();
  const storage = {getItem: key => values.get(key), setItem: (key, value) => values.set(key, value), removeItem: key => values.delete(key)};
  markLesson('3', storage); markLesson('3', storage); markLesson('1', storage);
  rememberLesson('4', storage);
  assert.deepEqual(readProgress(storage), ['1', '3']);
  assert.equal(readResume(storage), '4');
  assert.deepEqual([...values.values()], ['["1","3"]', '4']);
  resetProgress(storage);
  assert.equal(values.size, 0);
  const blocked = {getItem() {throw Error('blocked');}, setItem() {throw Error('blocked');}, removeItem() {throw Error('blocked');}};
  assert.deepEqual(readProgress(blocked), []);
  assert.doesNotThrow(() => markLesson('6', blocked));
  assert.doesNotThrow(() => rememberLesson('6', blocked));
  assert.doesNotThrow(() => resetProgress(blocked));
});
