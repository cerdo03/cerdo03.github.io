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
  const page = await context.newPage();page.setDefaultTimeout(5000);
  try {
    await page.goto(base + path);
    if (javaScriptEnabled) await page.locator(path.includes('/kafka/')?'#article-content .article-section':'[data-math-progress] [data-progress-status]').first().waitFor();
    await run(page);
  } finally { await context.close(); }
}
function contrast(e){
 const parse=value=>{const n=value.match(/[\d.]+/g).map(Number);return [n[0],n[1],n[2],n[3]??1];};
 const composite=(front,back)=>front.slice(0,3).map((v,i)=>v*front[3]+back[i]*(1-front[3]));
 let bg=[255,255,255];const chain=[];for(let n=e;n;n=n.parentElement)chain.unshift(n);
 for(const n of chain)bg=composite(parse(getComputedStyle(n).backgroundColor),bg);
 const fg=composite(parse(getComputedStyle(e).color),bg);
 const luminance=rgb=>rgb.map(v=>v/255).map(v=>v<=0.04045?v/12.92:((v+0.055)/1.055)**2.4).reduce((sum,v,i)=>sum+v*[0.2126,0.7152,0.0722][i],0);
 const a=luminance(fg),b=luminance(bg);return {text:e.textContent.trim(),foreground:fg,background:bg,ratio:(Math.max(a,b)+0.05)/(Math.min(a,b)+0.05)};
}
test('Kafka payload values, captions, arrows, assignments and controls remain readable in every theme',async()=>{
 await lesson('/labs/kafka/',async page=>{
  const targets='.math-grid span,.math-grid strong,.architecture-strip i,.worker-grid span,#clear-events,.partition-grid b,.transaction-flow>b';
  for(const theme of ['paper','midnight','contrast']){
   await page.evaluate(t=>document.documentElement.dataset.theme=t,theme);await page.mouse.move(0,0);
   const nodes=page.locator(targets);assert.equal(await nodes.count(),19);
   const failed=[];for(let i=0;i<await nodes.count();i++){const c=await nodes.nth(i).evaluate(contrast);if(c.ratio<4.5)failed.push(c);}
   assert.deepEqual(failed,[],theme+' contrast below4.5');
  }
 });
});
test('toolkit review and reset controls retain readable hover and keyboard focus without changing progress',async()=>{
 for(const route of [...Array.from({length:6},(_,i)=>`/labs/math-fluency/lesson-${i+1}.html`),'/labs/math-fluency/'])await lesson(route,async page=>{
  const button=page.getByRole('button',{name:route.endsWith('.html')?'Mark this lesson reviewed':'Reset optional toolkit progress',exact:true});
  const before=await page.evaluate(()=>JSON.stringify({...localStorage}));
  for(const theme of ['paper','midnight','contrast']){
   await page.evaluate(t=>document.documentElement.dataset.theme=t,theme);await page.mouse.move(0,0);await button.hover();
   let c=await button.evaluate(contrast);assert.ok(c.ratio>=4.5,theme+' hover '+JSON.stringify(c));
   await page.mouse.move(0,0);await button.focus();await page.keyboard.press('Tab');await page.keyboard.press('Shift+Tab');
   assert.equal(await button.evaluate(e=>e.matches(':focus-visible')),true);
   c=await button.evaluate(contrast);assert.ok(c.ratio>=4.5,theme+' focus '+JSON.stringify(c));
   assert.notEqual(await button.evaluate(e=>getComputedStyle(e).outlineStyle),'none');
  }
  assert.equal(await page.evaluate(()=>JSON.stringify({...localStorage})),before,'QA must not mark/reset lessons');
 });
});
