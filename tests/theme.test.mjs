import assert from 'node:assert/strict';
import test from 'node:test';

async function resolver() {
  let module;
  try { module = await import('../assets/theme-model.js'); }
  catch { assert.fail('Shared theme resolver must exist'); }
  return module.resolveTheme;
}

test('site default changes apply to visitors following the global scheme', async () => {
  const resolve = await resolver();
  assert.equal(resolve('paper', 'site'), 'paper');
  assert.equal(resolve('midnight', 'site'), 'midnight');
});

test('owner setting overrides legacy visitor preferences', async () => {
  const resolve = await resolver();
  assert.equal(resolve('paper', 'midnight'), 'paper');
  assert.equal(resolve('contrast', 'midnight'), 'contrast');
});

test('invalid or missing preferences safely follow a valid global default', async () => {
  const resolve = await resolver();
  assert.equal(resolve('contrast', null), 'contrast');
  assert.equal(resolve('midnight', 'unknown'), 'midnight');
  assert.equal(resolve('unknown', null), 'paper');
});
