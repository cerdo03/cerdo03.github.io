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
  const page = await context.newPage();
  try {
    await page.goto(base + path);
    if (javaScriptEnabled) await page.locator('body.llm-course').waitFor();
    await run(page);
  } finally { await context.close(); }
}
test('prefill and cache stay within their local operation range', async () => {
 for(const [hash,count] of [['prefill',6],['cache',4]]) await lesson(`/labs/inference/#${hash}`,async page=>{
  const lab=page.locator('#scene');
  assert.equal(await lab.locator('[data-field="pass"]').count(),0);
  assert.equal(await lab.locator('[data-command="play"]').count(),0);
  assert.match(await lab.locator('.route-stage').innerText(),new RegExp(`1 / ${count}`));
  assert.equal(await lab.locator('[data-command="back"]').isDisabled(),true);
  await lab.locator('[data-command="all"]').click();
  assert.equal(await lab.locator('[data-command="next"]').isDisabled(),true);
  assert.doesNotMatch(await lab.locator('[data-command="next"]').innerText(),/pass/);
  await lab.locator('[data-command="all"]').click();
  assert.match(await lab.locator('.route-stage').innerText(),new RegExp(`1 / ${count}`));
  for(let i=1;i<count;i++)await lab.locator('[data-command="next"]').click();
  assert.equal(await lab.locator('[data-command="next"]').isDisabled(),true);
  assert.equal(await lab.getByRole('link',{name:'Review complete request lab'}).getAttribute('href'),'#decode');
  await lab.getByRole('link',{name:'Review complete request lab'}).click();
  await page.locator('#scene [data-field="pass"]').waitFor();
  assert.equal(await page.locator('#scene [data-field="pass"] option').count(),3);
 });
});
test('recap and prefix transfer have no replay controls, retain predictions and validity link', async()=>{
 for(const hash of ['recap','prefix'])await lesson(`/labs/inference/#${hash}`,async page=>{
  const lab=page.locator('#scene');
  assert.equal(await lab.locator('select,[data-command]').count(),0);
  assert.equal(await lab.locator('.route-toolbar').count(),0,'static diagrams need no sticky empty toolbar');
  if(hash==='recap')assert.doesNotMatch(await lab.locator('.route-stage').innerText(),/Compatible requests/);
  assert.equal(await page.locator('.concept-check').count(),1);
  await page.locator('.concept-check summary').click();
  await page.locator('[data-choice="1"]').click();
  assert.match(await page.locator('#feedback').innerText(),/^Correct/);
  if(hash==='prefix'){
   assert.match(await lab.innerText(),/Request A|Request B/);
   await lab.getByRole('link',{name:'Experiment with cache validity'}).click();
   await page.locator('#scene [data-field="change"]').waitFor();
   assert.equal(await page.locator('#scene [data-field="change"] option').count(),5);
  }
 });
});
test('module 2 narrows prefill and keeps decode numeric rows/counters synchronized', async()=>{
 await lesson('/labs/attention/lesson-4.html#s2-4-3',async page=>{
  const lab=page.locator('#s2-4-3 > .teaching-visual');
  assert.equal(await lab.locator('[data-field="pass"]').count(),0);
  for(const query of ['0','1','2','3']){
   await lab.locator('[data-field="query"]').selectOption(query);
   await lab.locator('[data-command="all"]').click();
   assert.match(await lab.innerText(),/4 stored K\/V rows/);
   assert.match(await lab.innerText(),/and.*has no K\/V yet/);
   await lab.locator('[data-command="all"]').click();
  }
 });
 await lesson('/labs/attention/lesson-4.html#s2-4-4',async page=>{
  const lab=page.locator('#s2-4-4 > .teaching-visual');
  assert.deepEqual(await lab.locator('[data-field="pass"] option').evaluateAll(nodes=>nodes.map(n=>n.value)),['1','2','3','4']);
  assert.equal(await lab.locator('[data-field="query"]').count(),0);
  for(const pass of [1,2,3,4]){
   await lab.locator('[data-field="pass"]').selectOption(String(pass));
   assert.match(await lab.locator('.route-stage').innerText(),/1 \/ 6/);
   await lab.locator('[data-command="all"]').click();
   assert.match(await lab.innerText(),new RegExp(`${4+pass} stored K/V rows`));
   const detail=page.locator('#s2-4-4 > details').filter({hasText:'Detailed numeric trace and counters'});
   await detail.locator('summary').first().click();
   assert.equal(await page.locator('#decode-cache tbody tr').count(),4+pass);
   assert.match(await page.locator('#compare-table tr.is-highlight').innerText(),new RegExp(`Decode step ${pass}`));
   assert.match(await page.locator('#decode-status').innerText(),/not cached/);
   await detail.locator('summary').first().click();
   if(pass===4)assert.equal(await lab.locator('[data-command="next"]').isDisabled(),true);
  }
 });
});
test('scoped controls retain keyboard focus and full lab stops before processing final output',async()=>{
 await lesson('/labs/inference/#cache',async page=>{
  const lab=page.locator('#scene');
  const next=lab.locator('[data-command="next"]');
  await next.focus();await page.keyboard.press('Enter');
  assert.equal(await next.evaluate(e=>e===document.activeElement),true);
  await lab.locator('[data-command="all"]').focus();await page.keyboard.press('Space');
  assert.equal(await lab.locator('[data-command="all"]').evaluate(e=>e===document.activeElement),true);
  assert.match(await lab.locator('.route-stage').innerText(),/4 \/ 4/);
  await page.keyboard.press('Enter');
  assert.match(await lab.locator('.route-stage').innerText(),/1 \/ 4/);
 });
 await lesson('/labs/inference/#decode',async page=>{
  const lab=page.locator('#scene');
  for(const pass of ['0','1','2']){
   await lab.locator('[data-field="pass"]').selectOption(pass);
   for(let i=0;i<5;i++)await lab.locator('[data-command="next"]').click();
   assert.match(await lab.innerText(),new RegExp(`${3+Number(pass)} stored K/V rows`));
   if(pass==='2'){
    assert.equal(await lab.locator('[data-command="next"]').isDisabled(),true);
    assert.match(await lab.innerText(),/“\.” has no K\/V yet/);
   }else{
    await lab.locator('[data-command="next"]').click();
    assert.equal(await lab.locator('[data-field="pass"]').inputValue(),String(Number(pass)+1));
   }
  }
 });
});
test('new scoped request controls stay readable on hover/focus in every theme',async()=>{
 for(const theme of ['paper','midnight','contrast'])for(const path of ['/labs/inference/#cache','/labs/attention/lesson-4.html#s2-4-3'])await lesson(path,async page=>{
  await page.evaluate(theme=>document.documentElement.dataset.theme=theme,theme);
  const button=page.locator(path.includes('inference')?'#scene [data-command="all"]':'#s2-4-3 [data-command="all"]');await button.focus();await button.hover();
  await button.evaluate(el=>Promise.allSettled(el.getAnimations().map(animation=>animation.finished)));
  const colors=await button.evaluate(el=>({ink:getComputedStyle(el).color,background:getComputedStyle(el).backgroundColor}));
  const luminance=rgb=>rgb.match(/[\d.]+/g).slice(0,3).map(Number).map(n=>n/255).map(n=>n<=0.04045?n/12.92:((n+0.055)/1.055)**2.4).reduce((sum,n,i)=>sum+n*[0.2126,0.7152,0.0722][i],0);
  const a=luminance(colors.ink),b=luminance(colors.background),ratio=(Math.max(a,b)+0.05)/(Math.min(a,b)+0.05);
  assert.ok(ratio>=4.5,`${theme}: contrast ${ratio.toFixed(2)} must reach 4.5`);
 });
});
