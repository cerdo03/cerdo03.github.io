import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('Module 0 has independent current-page and concept navigation', () => {
  const shell = read('labs/llm-systems/course-shell.js');
  assert.match(shell, /dataset\.mathLesson/);
  assert.match(shell, /0\. Optional math toolkit/);
  assert.match(shell, /math-fluency\/lesson-\$\{mathNumber\}/);
  assert.match(shell, /mathNumber \? 'Mathematical notation/);
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
