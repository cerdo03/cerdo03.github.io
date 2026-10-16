import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

const root = new URL('../labs/math-fluency/', import.meta.url);
const read = (name) => readFileSync(new URL(name, root), 'utf8');

test('optional toolkit has an accessible landing and representative lesson', () => {
  assert.ok(existsSync(new URL('index.html', root)), 'Module 0 landing exists');
  const landing = read('index.html');
  assert.match(landing, /optional/i);
  assert.match(landing, /href="lesson-1.html"/);
  const lesson = read('lesson-1.html');
  assert.match(lesson, /data-math-lesson="1"/);
  assert.doesNotMatch(lesson, /\bdata-lesson=/);
  for (const asset of ['../../assets/theme.css', '../../assets/theme.js', '../llm-systems/course.css', '../llm-systems/course-shell.js', '../llm-systems/math.css', '../llm-systems/math-renderer.js', '../llm-systems/equation-explorer.js', '../llm-systems/math-exercises.js']) assert.ok(lesson.includes(asset), asset);
  assert.match(lesson, /data-math-return/);
  assert.match(lesson, /data-math-exercise="notation"/);
  assert.match(lesson, /<noscript>/);
  assert.match(lesson, /id="transfer"/);
  assert.match(lesson, /declaration[^<]*rather than a computation/);
  assert.match(lesson, /transpose/);
  assert.match(lesson, /sequence length/);
  assert.match(lesson, /<details>[\s\S]*Check the reference explanation/);
});

test('all six lessons preserve optional authored practice and independent transfer', () => {
  const ids = ['notation', 'indices', 'shapes', 'softmax', 'transformer', 'capstone'];
  for (let number = 1; number <= 6; number++) {
    assert.ok(existsSync(new URL(`lesson-${number}.html`, root)), `lesson ${number} available`);
    const lesson = read(`lesson-${number}.html`);
    assert.match(lesson, new RegExp(`data-math-lesson="${number}"`));
    assert.match(lesson, new RegExp(`data-math-exercise="${ids[number - 1]}"`));
    assert.match(lesson, /id="transfer"/);
    assert.match(lesson, /Prerequisite:/);
    assert.match(lesson, /Worked example/i);
    assert.match(lesson, /Common mistake:/);
    assert.match(lesson, /Check the reference explanation/);
    assert.match(lesson, /data-math-return/);
    assert.doesNotMatch(lesson, /\bdata-lesson=/);
    assert.ok(read('index.html').includes(`href="lesson-${number}.html"`));
  }
  assert.doesNotMatch(read('index.html'), /being prepared|review slice/);
});

test('curriculum includes independently checkable mathematical worked examples', () => {
  assert.ok(read('lesson-2.html').includes('= 24'));
  assert.ok(read('lesson-3.html').includes('4\\times6'));
  assert.match(read('lesson-4.html'), /0\.015842/);
  assert.match(read('lesson-5.html'), /536,870,912/);
  assert.match(read('lesson-5.html'), /512 MiB/);
  assert.match(read('lesson-6.html'), /<pre><code>/);
  assert.match(read('lesson-6.html'), /unfamiliar/i);
});

test('contextual equation components have a readable no-script fallback', () => {
  for (let number = 1; number <= 6; number++) {
    const placeholders = [...read(`lesson-${number}.html`).matchAll(/<div data-equation="([^"]+)">([\s\S]*?)<\/div>/g)];
    for (const [, id, content] of placeholders) assert.match(content, /<noscript><p>[^<]+/, id);
  }
});
