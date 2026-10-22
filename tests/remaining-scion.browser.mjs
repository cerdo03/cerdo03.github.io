import test, {before, after} from 'node:test';
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve, extname} from 'node:path';
import {lessons} from '../labs/scion/lessons.js';

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
  const page = await context.newPage();page.setDefaultTimeout(5000);
  try {
    await page.goto(base + path);
    if (javaScriptEnabled) await page.locator('#path a').first().waitFor({state:'attached'});
    await run(page);
  } finally { await context.close(); }
}
test('four fixed Scion comparisons show every original worked frame without transport controls',async()=>{
 await lesson('/labs/scion/#repo',async page=>{
  for(const id of ['repo','workload','indexes','recap']){
   await page.goto(base+'/labs/scion/#'+id);
   assert.equal(await page.locator('.scene-controls').isVisible(),false);
   assert.equal(await page.locator('#diagram .comparison-item').count(),3);
   for(const f of lessons.find(l=>l.id===id).frames){assert.ok((await page.locator('#diagram').innerText()).includes(f.caption));assert.ok(await page.getByRole('heading',{name:f.title,exact:true}).isVisible());}
  }
  await page.locator('[data-answer=wrong]').click();assert.match(await page.locator('#feedback').innerText(),/P5.*P7/s);
  await page.locator('[data-answer=right]').click();assert.match(await page.locator('#feedback').innerText(),/Exactly/);
 });
});
test('outage policy qualifier is visible before stepping and beside the blocked state',async()=>{
 await lesson('/labs/scion/#failure',async page=>{
  const scope=page.locator('#model-scope');assert.ok(await scope.isVisible());
  assert.match(await scope.innerText(),/illustrative.*no-bypass.*not.*documented.*timeouts.*retries.*recovery/is);
  await page.locator('#next-frame').click();assert.match(await page.locator('#diagram').innerText(),/Unavailable.*Not contacted/s);assert.ok(await scope.isVisible());
 });
});
test('one CAS race retains both saved changes and rejects a stale writer without winner toggles',async()=>{
 await lesson('/labs/scion/#main',async page=>{
  assert.equal(await page.locator('[data-winner]').count(),0);assert.match(await page.locator('#experiment').innerText(),/Either writer can win/);
  await page.locator('#next-frame').click();await page.locator('#next-frame').click();
  assert.match(await page.locator('#diagram').innerText(),/main → B.*D still exists/s);
  assert.match(await page.locator('#caption').innerText(),/does not delete D.*retrying.*stale/s);
 });
});
test('object/change/sparse traces and warm-cache interaction still step through meaningful state',async()=>{
 await lesson('/labs/scion/#objects',async page=>{
  for(const id of ['objects','changes','sparse','main','failure']){
   await page.goto(base+'/labs/scion/#'+id);assert.ok(await page.locator('.scene-controls').isVisible());
   const before=await page.locator('#scene-title').innerText();await page.locator('#next-frame').click();assert.notEqual(await page.locator('#scene-title').innerText(),before);
  }
  await page.goto(base+'/labs/scion/#cache');
  while(await page.locator('#next-frame').isEnabled())await page.locator('#next-frame').click();
  await page.locator('#repeat').click();assert.match(await page.locator('#diagram').innerText(),/Node cache.*HIT/is);
 });
});
