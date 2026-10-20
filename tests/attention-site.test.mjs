import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { evaluateChoice, evaluateNumeric, fmtNumber, parseNumber } from '../labs/attention/ui.js';

const dir = 'labs/attention';
const lessonPages = [1, 2, 3, 4, 5].map((n) => `${dir}/lesson-${n}.html`);
const read = (path) => readFileSync(path, 'utf8');

test('every Module 2 page loads the shared theme and links back to the journal', () => {
  for (const page of [`${dir}/index.html`, ...lessonPages]) {
    const html = read(page);
    assert.match(html, /href="\.\.\/\.\.\/assets\/theme\.css"/, page);
    assert.match(html, /src="\.\.\/\.\.\/assets\/theme\.js"/, page);
    assert.match(html, /href="\.\.\/\.\.\/"/, page);
    assert.match(html, /href="\.\.\/inference\/"/, page);
    assert.match(html, /href="\.\.\/llm-systems\/"/, page);
    assert.doesNotMatch(html, /style="/, page);
  }
});

test('lesson pages share navigation, section anchors and one lesson script', () => {
  lessonPages.forEach((page, i) => {
    const n = i + 1;
    const html = read(page);
    assert.match(html, new RegExp(`<body data-lesson="${n}">`));
    assert.equal((html.match(/aria-current="page"/g) || []).length, 1, page);
    assert.match(html, new RegExp(`href="lesson-${n}.html" data-lesson="${n}" aria-current="page"`));
    for (let k = 1; k <= 5; k += 1) assert.match(html, new RegExp(`href="lesson-${k}.html"`));
    assert.match(html, new RegExp(`src="lesson-${n}.js"`));
    assert.match(html, /src="site\.js"/);
    const ids = [...html.matchAll(/<section id="(s2-[\w-]+)"/g)].map((m) => m[1]);
    assert.ok(ids.length >= 5, page);
    for (const id of ids) {
      assert.match(id, new RegExp(`^s2-${n}-`));
      assert.match(html, new RegExp(`<a href="#${id}">`), `TOC link for ${id}`);
    }
    assert.match(html, /class="pager"/);
  });
});

test('Module 2 styles use only shared theme tokens for colour and type', () => {
  for (const file of readdirSync(dir).filter((f) => f.endsWith('.css'))) {
    const css = read(join(dir, file)).replace(/\/\*[\s\S]*?\*\//g, '');
    assert.doesNotMatch(css, /#[0-9a-f]{3,8}\b|rgba?\(|hsla?\(|gradient\(/i, file);
    for (const match of css.matchAll(/font-family:\s*([^;]+);/g)) assert.match(match[1].trim(), /^(var\(--[\w-]+\)|inherit)$/, file);
  }
});

test('deployment versions Module 2 pages and adds one beacon to each', () => {
  const out = mkdtempSync(join(tmpdir(), 'attention-deploy-'));
  try {
    const result = spawnSync(process.execPath, ['scripts/prepare-site.mjs', out, 'rev1'], { encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr);
    for (const page of ['index.html', ...lessonPages.map((p) => p.slice(dir.length + 1))]) {
      const html = read(join(out, dir, page));
      assert.match(html, /styles\.css\?v=rev1/);
      assert.match(html, /site\.js\?v=rev1/);
      assert.equal((html.match(/data-goatcounter=/g) || []).length, 1);
    }
    assert.match(read(join(out, dir, 'lesson-1.js')), /attention-math\.js\?v=rev1/);
  } finally { rmSync(out, { recursive: true, force: true }); }
});

test('the catalog registers the site in the LLM systems collection', async () => {
  const { sites, projects, siteTags } = await import('../assets/learning-catalog.js');
  assert.equal(sites.attention.project, 'llm-systems');
  assert.equal(sites.attention.path, '/labs/attention/');
  assert.deepEqual(siteTags(projects['llm-systems'], sites.attention), ['AI', 'LLM systems', 'Attention', 'KV cache']);
  assert.match(read('labs/llm-systems/index.html'), /5 sites/);
  assert.match(read('index.html'), /Collection · 5 sites/);
});

test('knowledge-check evaluation gives feedback without scoring', () => {
  assert.equal(parseNumber('65,536,000,000'), 65536000000);
  assert.equal(parseNumber('−2.5'), -2.5);
  assert.equal(parseNumber('6.5e10'), 6.5e10);
  assert.equal(parseNumber('abc'), null);
  const units = [{ label: 'GB', factor: 1e9 }, { label: 'GiB', factor: 2 ** 30 }];
  const exercise = { correct: 65536000000, units, misconceptions: [{ value: 61.04e9, message: 'GiB/GB mix-up' }] };
  assert.equal(evaluateNumeric({ ...exercise, text: '65.54', unitLabel: 'GB' }).status, 'correct');
  assert.equal(evaluateNumeric({ ...exercise, text: '61.04', unitLabel: 'GiB' }).status, 'correct');
  const wrong = evaluateNumeric({ ...exercise, text: '61.04', unitLabel: 'GB' });
  assert.equal(wrong.status, 'incorrect');
  assert.equal(wrong.message, 'GiB/GB mix-up');
  assert.equal(evaluateNumeric({ ...exercise, text: '' }).status, 'invalid');
  assert.equal(evaluateChoice({ selected: '1', correct: 1 }).status, 'correct');
  assert.equal(evaluateChoice({ selected: '0', correct: 1, misconceptions: { 0: 'why' } }).message, 'why');
  assert.equal(evaluateChoice({ selected: null, correct: 1 }).status, 'invalid');
  assert.equal(fmtNumber(-Infinity), '−∞');
  assert.equal(fmtNumber(-0.5), '−0.5');
  assert.equal(fmtNumber(2.0), '2');
});
