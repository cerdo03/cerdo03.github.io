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
