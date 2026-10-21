import test, {before, after} from 'node:test';
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve, extname} from 'node:path';
import {sliceView} from '../labs/attention/lesson-4.js';
import {computeKvMemory} from '../labs/attention/lesson-5.js';

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
test('indexed cache example exposes fixed K/V slices without controls, including without scripts',async()=>{
 for(const scripts of [true,false])await lesson('/labs/attention/lesson-4.html#s2-4-2',async page=>{
  const host=page.locator('#s2-4-2 .lab').first();
  assert.equal(await host.locator('input,select').count(),0);
  for(const kind of ['k','v']){
   const view=sliceView({kind,layer:1,position:2}),table=host.locator(`#hier-${kind==='k'?'keys':'values'} table`);
   assert.deepEqual(await table.locator('tbody tr').evaluateAll(rows=>rows.map(row=>[...row.querySelectorAll('td')].map(c=>Number(c.textContent)))),view.values);
   assert.match(await table.locator('caption').innerText(),new RegExp(`${kind.toUpperCase()}_cache`));
  }
  assert.match(await host.innerText(),/128 bytes/);
  assert.match(await host.innerText(),/not.*physical|conceptual.*layout/i);
  assert.match(await host.innerText(),/placeholder|not.*trained/i);
 },scripts);
});
test('only distinct presets remain while manual forty-layer inputs and exercise survive',async()=>{
 await lesson('/labs/attention/lesson-5.html#s2-5-2',async page=>{
  assert.deepEqual(await page.locator('[data-preset]').evaluateAll(nodes=>nodes.map(n=>n.dataset.preset)),['a','c','d']);
  await page.locator('#calc-layers').fill('40');assert.match(await page.locator('#calc-summary').innerText(),/671,088,640/);
  await page.locator('[data-preset="c"]').click();assert.equal(await page.locator('#calc-kv-heads').inputValue(),'32');
  await page.locator('[data-preset="d"]').click();assert.equal(await page.locator('#calc-kv-heads').inputValue(),'1');
  await page.locator('#calc-reset').click();assert.equal(await page.locator('#calc-layers').inputValue(),'32');
  assert.match(await page.locator('#s2-5-5').textContent(),/40/);
 });
});
const fillConfig=async(page,config)=>{
 await page.goto(base+'/labs/attention/lesson-5.html#s2-5-2');
 await page.locator('#s2-5-2').waitFor({state:'visible'});
 for(const [id,value] of Object.entries(config)){
  if(id==='calc-bytes')await page.locator('#'+id).selectOption(String(value));
  else await page.locator('#'+id).fill(String(value));
 }
 await page.goto(base+'/labs/attention/lesson-5.html#s2-5-3');await page.locator('#s2-5-3').waitFor({state:'visible'});
};
test('one chart derives labels and exact table from shared calculator configuration',async()=>{
 await lesson('/labs/attention/lesson-5.html#s2-5-3',async page=>{
  const host=page.locator('#kv-chart-lab');assert.equal(await host.locator('input,select,#chart-reset').count(),0);
  assert.equal(await host.getByRole('link',{name:'Change model configuration',exact:true}).getAttribute('href'),'#s2-5-2');
  const cfg={layers:40,kvHeads:8,headDim:64,seqLen:40000,bytesPerElem:4,sequences:3};
  await fillConfig(page,{'calc-layers':40,'calc-head-dim':64,'calc-seq-len':40000,'calc-bytes':4,'calc-sequences':3});
  assert.match(await page.locator('#chart-config').innerText(),/40.*64.*4.*3/);
  assert.match(await host.innerText(),/32.*query heads/);
  const rows=await page.locator('#chart-rows tr').evaluateAll(rows=>rows.map(r=>[...r.children].map(c=>c.textContent)));
  assert.equal(rows.at(-1)[0],'40,000');
  for(const [T,cur,ref] of rows){
   const t=Number(T.replaceAll(',',''));
   const bytes=s=>Number(s.match(/\(([\d,]+) B\)/)[1].replaceAll(',',''));
   assert.equal(bytes(cur),t?computeKvMemory({...cfg,seqLen:t}).total:0);
   assert.equal(bytes(ref),t?computeKvMemory({...cfg,seqLen:t,kvHeads:32}).total:0);
  }
  await fillConfig(page,{'calc-kv-heads':32});assert.match(await page.locator('#chart-output').innerText(),/coincide/);
  assert.equal(await page.locator('.series-current polyline').getAttribute('points'),await page.locator('.series-reference polyline').getAttribute('points'));
  await fillConfig(page,{'calc-kv-heads':64});assert.match(await page.locator('#chart-output').innerText(),/0.5×/);
  assert.equal(await page.locator('#chart-errors').isVisible(),false);
 });
});
test('invalid or inexact chart comparisons hide stale results and recover',async()=>{
 await lesson('/labs/attention/lesson-5.html#s2-5-3',async page=>{
  await fillConfig(page,{'calc-layers':0});
  assert.equal(await page.locator('#chart-errors').isVisible(),true);
  assert.equal(await page.locator('#kv-chart').isVisible(),false);
  assert.equal(await page.locator('#chart-rows tr').count(),0);
  await fillConfig(page,{'calc-layers':1024,'calc-kv-heads':1,'calc-head-dim':4096,'calc-seq-len':10000000,'calc-bytes':4,'calc-sequences':10});
  assert.match(await page.locator('#chart-errors').innerText(),/exceeds exact integer arithmetic/);
  assert.equal(await page.locator('#chart-rows tr').count(),0);
  await page.goto(base+'/labs/attention/lesson-5.html#s2-5-2');await page.locator('#calc-reset').click();
  await page.goto(base+'/labs/attention/lesson-5.html#s2-5-3');await page.locator('#kv-chart').waitFor({state:'visible'});
  assert.equal(await page.locator('#chart-errors').isVisible(),false);
  assert.equal(await page.locator('#chart-rows tr').count(),5);
 });
});
test('chart labels stay inside plot frame and distinct at equal heads and long contexts',async()=>{
 await lesson('/labs/attention/lesson-5.html#s2-5-3',async page=>{
  await page.setViewportSize({width:320,height:844});
  for(const fields of [{'calc-kv-heads':32,'calc-layers':40},{'calc-layers':1,'calc-kv-heads':1,'calc-head-dim':1,'calc-bytes':1,'calc-sequences':1,'calc-seq-len':10000000}]){
   await fillConfig(page,fields);
   const issues=await page.locator('#kv-chart').evaluate(svg=>{
    const box=svg.getBoundingClientRect(),issues=[];
    const texts=[...svg.querySelectorAll('text')];
    for(const text of texts){const r=text.getBoundingClientRect();if(r.top<box.top-1||r.bottom>box.bottom+1||r.left<box.left-1||r.right>box.right+1)issues.push('clipped: '+text.textContent);}
    const ticks=texts.filter(e=>e.classList.contains('chart-tick')&&e.getAttribute('text-anchor')==='middle');
    for(let i=1;i<ticks.length;i++)if(ticks[i-1].getBoundingClientRect().right>ticks[i].getBoundingClientRect().left+1)issues.push('overlap: '+ticks[i].textContent);
    return issues;
   });
   assert.deepEqual(issues,[]);
  }
 });
});
