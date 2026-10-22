import test, {before, after} from 'node:test';
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve, extname} from 'node:path';

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
  const page = await context.newPage();page.setDefaultTimeout(2500);
  try {
    await page.goto(base + '/labs/gpu/' + path);
    if (javaScriptEnabled) await page.locator('body.llm-course').waitFor();
    await run(page);
  } finally { await context.close(); }
}
test('concrete walkthrough precedes equations with and without JavaScript',async()=>{
 for(const scripting of [true,false])await lesson('lesson-1.html#execution',async page=>{
  assert.equal(await page.locator('[data-gpu-lab=thread]').evaluate(e=>Boolean(e.compareDocumentPosition(document.querySelector('#execution .gpu-formula'))&Node.DOCUMENT_POSITION_FOLLOWING)),true);
  assert.match(await page.locator('#execution-title').innerText(),/Follow one/);
  assert.equal(await page.getByText('Keep this picture for the next lessons:',{exact:false}).isVisible(),true);
  if(!scripting)assert.match(await page.locator('[data-gpu-lab=thread]').innerText(),/Warp.*SM/s);
 },scripting);
});
test('new terms appear with their diagram; keyboard steps retain selected output',async()=>{
 await lesson('lesson-1.html#execution',async page=>{
  const lab=page.locator('[data-gpu-lab=thread]'),next=lab.getByRole('button',{name:'Next operation',exact:true});
  assert.equal(await lab.locator('.gpu-thread-physical').isVisible(),false);
  assert.equal(await lab.getByRole('combobox',{name:'Threads per block in this trace',exact:true}).isVisible(),false);
  await next.focus();await page.keyboard.press('Enter');assert.match(await lab.locator('.gpu-thread-picked').innerText(),/999/);
  await page.keyboard.press('Enter');assert.equal(await lab.locator('.gpu-thread-block').isVisible(),true);
  assert.equal(await lab.getByRole('combobox',{name:'Threads per block in this trace',exact:true}).isVisible(),true);
  await page.keyboard.press('Enter');assert.equal(await lab.locator('.gpu-thread-lanes span').count(),32);
  await page.keyboard.press('Enter');assert.equal(await lab.locator('.gpu-thread-physical').isVisible(),true);
  assert.match(await lab.locator('.gpu-thread-physical').innerText(),/which SM|unspecified/i);
  assert.match(await lab.locator('.gpu-thread-picked').innerText(),/logical.*not.*core/is);
  assert.match(await lab.locator('.gpu-thread-warp').innerText(),/instruction/i);
 });
});
test('selected output keeps one linked block, warp and lane across regrouping',async()=>{
 await lesson('lesson-1.html#execution',async page=>{
  const lab=page.locator('[data-gpu-lab=thread]');await lab.getByRole('button',{name:'Show all',exact:true}).click();
  const size=lab.getByRole('combobox',{name:'Threads per block in this trace',exact:true});
  for(const count of [128,64,256])for(const index of [0,127,500,999]){
   await size.selectOption(String(count));await lab.getByRole('combobox',{name:'Follow output number',exact:true}).selectOption(String(index));
   const block=Math.floor(index/count),warp=Math.floor(index%count/32),lane=index%32;
   assert.equal(await lab.locator('.gpu-thread-block').getAttribute('data-block'),String(block));
   assert.equal(await lab.locator('.gpu-thread-warp').getAttribute('data-warp'),String(warp));
   const selected=lab.locator('.gpu-thread-lanes [data-selected=true]');assert.equal(await selected.count(),1);
   assert.equal(await selected.getAttribute('data-output'),String(index));assert.match(await selected.getAttribute('aria-label'),new RegExp(`Lane ${lane}:.*output ${index}`));
   assert.equal(await lab.locator('.gpu-thread-physical').isVisible(),true);
  }
  await size.focus();await size.selectOption('128');await size.selectOption('64');
  assert.equal(await lab.getByRole('combobox',{name:'Follow output number',exact:true}).inputValue(),'999');
  assert.match(await lab.locator('.gpu-thread-change').innerText(),/block 7.*block 15.*same output|same output.*block 7.*block 15/is);
  assert.equal(await size.evaluate(e=>e===document.activeElement),true);
  assert.equal(await lab.getByRole('button',{name:'Step by step',exact:true}).isVisible(),true);
 });
});
test('terminology check explains hardware distinction without blocking the lesson',async()=>{
 await lesson('lesson-1.html#execution',async page=>{
  await page.locator('[data-gpu-lab=thread]').getByRole('button',{name:'Show all',exact:true}).click();const check=page.locator('[data-thread-check]');
  await check.locator('[data-answer=wrong]').click();assert.match(await check.locator('[data-feedback]').innerText(),/Reconsider.*128.*SM/s);
  await check.locator('[data-answer=correct]').click();assert.match(await check.locator('[data-feedback]').innerText(),/Yes.*128.*SM/s);
  assert.ok(await page.getByRole('button',{name:'Next: Enough work is not enough resources →',exact:true}).isEnabled());
 });
});
