import test, {before, after} from 'node:test';
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve, extname} from 'node:path';
import {launchModel} from '../labs/gpu/model.js';

const root = resolve(import.meta.dirname, '..');
let browser, server, base;
before(async () => {
  server = createServer(async (req, res) => {
    const path = new URL(req.url, 'http://localhost').pathname;
    const file = resolve(root, '.' + path + (path.endsWith('/') ? 'index.html' : ''));
    try {
      if (!file.startsWith(root + '/')) throw Error('Invalid path');
      const data = await readFile(file);
      res.writeHead(200, {'Content-Type': {'.html':'text/html', '.css':'text/css', '.js':'text/javascript'}[extname(file)] || 'application/octet-stream'});
      res.end(data);
    } catch { res.writeHead(404); res.end(); }
  });
  await new Promise(done => server.listen(0, '127.0.0.1', done));
  base = `http://127.0.0.1:${server.address().port}`;
  browser = await chromium.launch({channel:'chrome', headless:true});
});
after(async () => { await browser?.close(); await new Promise(done => server.close(done)); });
async function lesson(path, run, javaScriptEnabled = true) {
  const context = await browser.newContext({javaScriptEnabled, viewport:{width:390, height:844}, reducedMotion:'reduce'});
  const page = await context.newPage();
  try {
    await page.goto(base + '/labs/gpu/' + path);
    if (javaScriptEnabled) await page.locator('body.llm-course').waitFor();
    await run(page);
  } finally { await context.close(); }
}
test('memory scope comparison stays visible without playback, with or without scripts', async () => {
  for (const scripting of [true, false]) await lesson('lesson-2.html#hierarchy', async page => {
    const memory = page.locator('[data-gpu-lab="memory"]');
    assert.equal(await memory.getByRole('button').count(), 0, 'static scope comparison needs no playback');
    for (const name of ['Global load', 'Optional shared-memory staging', 'Per-thread computation', 'Output store']) {
      assert.equal(await memory.getByRole('heading', {name, exact:true}).isVisible(), true);
    }
    assert.match(await memory.innerText(), /cache hit can avoid a DRAM fetch/);
    assert.match(await memory.innerText(), /not a mandatory hardware route/);
    assert.match(await memory.innerText(), /barrier/);
  }, scripting);
});
test('every resident warp has a visible parent block across all resource settings', async () => {
  await lesson('lesson-1.html#residency', async page => {
    const lab = page.locator('[data-gpu-lab="residency"]');
    for (const threads of [64,128,256,512]) for (const registers of [16,32,64,128]) for (const shared of [8,16,32,64]) {
      await lab.getByRole('combobox', {name:'Threads per block', exact:true}).selectOption(String(threads));
      await lab.getByRole('combobox', {name:'32-bit registers per thread', exact:true}).selectOption(String(registers));
      await lab.getByRole('combobox', {name:'Shared KiB per block', exact:true}).selectOption(String(shared));
      const model = launchModel(4096,threads,registers,shared);
      const labels = await lab.locator('.gpu-resident-slots > span').allTextContents();
      assert.equal(labels.length,64);
      labels.forEach((label, warp) => assert.equal(label, warp < model.residentBlocks*model.warps ? `Block ${Math.floor(warp/model.warps)} · W${warp%model.warps}` : '—'));
    }
  });
});
test('short execution trace can restart from full view using keyboard without duplicate reset', async () => {
  await lesson('lesson-1.html#execution', async page => {
    const lab = page.locator('[data-gpu-lab="execution"]');
    assert.equal(await lab.getByRole('button').count(),3);
    const review = lab.getByRole('button').nth(2);
    await review.focus(); await page.keyboard.press('Enter');
    assert.equal(await lab.locator('.gpu-stage:visible').count(),4);
    assert.equal(await lab.locator('.gpu-lanes .masked').count(),24);
    assert.match(await lab.innerText(), /SM assignment and execution order are unspecified/);
    assert.equal(await review.innerText(),'Step by step');
    await page.keyboard.press('Enter');
    assert.equal(await lab.locator('.gpu-stage:visible').count(),1);
    assert.equal(await lab.locator('.gpu-lanes span').count(),0);
    assert.equal(await review.evaluate(node => node === document.activeElement),true);
  });
});
