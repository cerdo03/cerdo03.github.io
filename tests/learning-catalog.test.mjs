import test from 'node:test';
import assert from 'node:assert/strict';

test('sites inherit project tags and retain their own without duplicates', async () => {
  const { siteTags } = await import('../assets/learning-catalog.js');
  assert.deepEqual(siteTags({ tags: ['AI', 'Research'] }, { tags: ['AI', 'KV cache'] }), ['AI', 'Research', 'KV cache']);
  assert.deepEqual(siteTags(null, { tags: ['Systems'] }), ['Systems']);
});
