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
    if (javaScriptEnabled) await page.locator('body.llm-course').waitFor();
    await run(page);
  } finally { await context.close(); }
}
const rows=page=>page.evaluate(()=>JSON.parse(localStorage.getItem('inference-course-v4'))?.embeddings);
test('one canonical embedding editor explains scope and prediction before Apply; drafts and invalid inputs do not propagate',async()=>{
 const context=await browser.newContext({viewport:{width:390,height:844},reducedMotion:'reduce'});
 const editor=await context.newPage(),attention=await context.newPage();
 try{
  await attention.goto(base+'/labs/attention/lesson-1.html#s2-1-2');
  const reference=attention.locator('#s2-1-2 .shared-attention');
  assert.equal(await reference.locator('input[type="number"]').count(),0);
  const link=reference.getByRole('link',{name:'Edit shared starting embeddings',exact:true});
  assert.match(await link.getAttribute('href'),/inference\/#tokens/);
  await editor.goto(new URL(await link.getAttribute('href'),attention.url()).href);
  await editor.locator('#embedding-editor summary').click();
  const box=editor.locator('#embedding-editor');
  assert.match(await box.innerText(),/Before Apply.*1.*3.*Q.*K.*V/s);
  assert.match(await box.innerText(),/numeric.*prediction.*toy/s);
  await box.locator('[data-action="default-embeddings"]').click();
  const original=await rows(editor);
  await box.locator('#embedding-2-0').fill('3');
  assert.deepEqual(await rows(editor),original);
  assert.deepEqual(await rows(attention),original);
  await box.locator('#embedding-2-0').fill('5');
  await box.locator('[data-action="apply-embeddings"]').click();
  assert.deepEqual(await rows(editor),original);
  await box.locator('#embedding-2-0').fill('3');
  await box.locator('[data-action="apply-embeddings"]').click();
  await attention.waitForFunction(()=>JSON.parse(localStorage.getItem('inference-course-v4')).embeddings[2][0]===3);
  assert.deepEqual(await rows(attention),[[2,0],[0,1],[3,2]]);
  const routes=attention.locator('#s2-1-2 .vector-routes');
  await routes.locator('[data-route="position"]').selectOption('2');
  await routes.locator('[data-route-next]').click();
  await routes.locator('[data-studio-all]').click();
  for(const [role,value]of [['Q','Q = [3, 2]'],['K','K = [2, 3]'],['V','V = [6, 2]']])assert.equal(await routes.locator(`[data-role="${role}"] .studio-full-vector`).innerText(),value);
  await box.getByRole('link',{name:'Check Q/K/V projections',exact:true}).click();
  await editor.locator('[data-studio-position]').selectOption('2');
  await editor.locator('[data-studio-all]').click();
  assert.equal(await editor.locator('[data-role="V"] .studio-full-vector').innerText(),'V = [6, 2]');
  await editor.goto(base+'/labs/inference/#tokens');
  await editor.locator('#embedding-editor summary').click();
  await box.locator('[data-action="default-embeddings"]').click();
  await attention.waitForFunction(()=>JSON.parse(localStorage.getItem('inference-course-v4')).embeddings[2][0]===1);
 }finally{await context.close();}
});
test('route scope precedes calculations; one schematic comparison and optional layer/head inspection retain all operations',async()=>{
 await lesson('/labs/attention/lesson-1.html#s2-1-2',async page=>{
  const lab=page.locator('#s2-1-2 .vector-routes');
  assert.match(await lab.locator('.route-scope').innerText(),/Numeric example.*layer 1.*head 1/);
  const advanced=lab.locator('[data-route-context]');assert.equal(await advanced.getAttribute('open'),null);
  await lab.locator('[data-route-example]').selectOption('schematic');
  assert.equal(await lab.locator('[data-route-example]').evaluate(e=>e===document.activeElement),true);
  assert.match(await lab.locator('.route-scope').innerText(),/Schematic context.*not calculated/);
  assert.equal(await lab.locator('[data-route="layer"]').inputValue(),'2');
  await advanced.locator('summary').click();
  await lab.locator('[data-route="head"]').selectOption('2');
  assert.match(await lab.locator('.route-stage').innerText(),/Layer 2 · Head 2/);
  assert.equal(await lab.locator('[data-studio-slot]').count(),0);
  await lab.locator('[data-route-example]').selectOption('numeric');
  for(let i=0;i<11;i++)await lab.locator('[data-route-next]').click();
  assert.match(await lab.locator('.route-stage').innerText(),/12\/12/);
  await lab.locator('[data-route-next]').click();
  assert.match(await lab.locator('.route-stage').innerText(),/Layer 2/);
  assert.match(await lab.locator('.route-scope').innerText(),/Schematic context/);
  await lab.locator('[data-route-reset]').click();
  assert.match(await lab.locator('.route-scope').innerText(),/Numeric example/);
 });
});
test('dense arithmetic advances only on demand; complete shared views retain final-step review and manual return',async()=>{
 await lesson('/labs/inference/#attention',async page=>{
  assert.equal(await page.locator('[data-route-play]').count(),0);
  const stage=await page.locator('#scene .route-stage').innerText();
  await page.clock.install();await page.clock.fastForward(6000);
  assert.equal(await page.locator('#scene .route-stage').innerText(),stage);
  for(const hash of ['handoff','decode','validity']){
   await page.goto(base+'/labs/inference/#'+hash);
   const lab=page.locator('#scene');
   assert.equal(await lab.locator('[data-command="play"]').count(),0);
   const start=await lab.locator('.route-stage').innerText();
   assert.equal(await lab.locator('[data-command=all]').innerText(),'Last step');
   await lab.locator('[data-command="all"]').click();
   assert.notEqual(await lab.locator('.route-stage').innerText(),start);
   await lab.locator('[data-command="all"]').click();
   assert.equal(await lab.locator('.route-stage').innerText(),start);
   await lab.locator('[data-command="next"]').click();
   await lab.locator('[data-command="back"]').click();
   assert.equal(await lab.locator('.route-stage').innerText(),start);
  }
 });
});
test('linear feed-forward limitation is visible before using the numeric prediction toy',async()=>{
 await lesson('/labs/inference/#handoff',async page=>{
  const lab=page.locator('#scene'),scope=lab.locator('.visual-scope');
  assert.match(await scope.innerText(),/linear.*0\.1u.*real.*nonlinear/i);
  assert.ok(await scope.isVisible());
  await lab.locator('[data-command="next"]').click();
  assert.match(await lab.locator('svg').textContent(),/u \+ 0\.1u/);
  assert.ok(await scope.isVisible());
  await lab.locator('[data-command="all"]').click();
  assert.match(await lab.locator('svg').textContent(),/Chosen output token/);
  assert.match(await lab.locator('details.visual-assumptions').innerText(),/Toy assumptions/);
 });
});
test('prediction layer handoff never crosses numeric labels',async()=>{
 await lesson('/labs/inference/#handoff',async page=>{
  await page.locator('#scene [data-command=next]').click();
  const crossed=await page.locator('#scene svg').evaluate(svg=>{
   const path=[...svg.querySelectorAll('.route-edge')].find(p=>p.getAttribute('d').startsWith('M 885'));
   if(!path)throw Error('Missing layer handoff');
   const matrix=path.getScreenCTM(),boxes=[...svg.querySelectorAll('.route-node text')].map(t=>({text:t.textContent,box:t.getBoundingClientRect()})),hits=new Set();
   for(let d=0;d<=path.getTotalLength();d+=1){const p=path.getPointAtLength(d),q=new DOMPoint(p.x,p.y).matrixTransform(matrix);for(const {text,box}of boxes)if(q.x>box.left&&q.x<box.right&&q.y>box.top&&q.y<box.bottom)hits.add(text);}
   return [...hits];
  });
  assert.deepEqual(crossed,[]);
 });
});
