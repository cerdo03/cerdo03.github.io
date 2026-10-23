import test from 'node:test';
import assert from 'node:assert/strict';
import { lessons } from '../labs/dynamo/lessons.js';
test('all twelve lessons provide attributed nonempty reading content', () => {
  assert.equal(lessons.length,12);
  for(const lesson of lessons){assert.match(lesson.source,/PDF/);assert.ok(lesson.paragraphs.length>=3);}
});
test('source numerical ambiguities and availability limitations remain visible', () => {
  const text=lessons.flatMap(lesson=>lesson.paragraphs).join(' ');
  for(const term of ['99.94113%','2.35/2.12','not a perpetual guarantee','Sloppy placement','no isolation']) {
    if(term==='no isolation') assert.match(text,/isolation guarantees/);
    else assert.ok(text.includes(term),term);
  }
});
