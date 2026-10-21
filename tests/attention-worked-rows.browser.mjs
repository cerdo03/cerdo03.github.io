import test, {before, after} from 'node:test';
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve, extname} from 'node:path';
import {projections, outputRow, softmaxBreakdown, scoreBreakdown} from '../labs/attention/lesson-1.js';
import {fmtVector, fmtNumber} from '../labs/attention/ui.js';

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
const reveal=async(page,id)=>{const host=page.locator(id);await host.evaluate(e=>{for(let p=e.parentElement;p;p=p.parentElement)if(p.tagName==='DETAILS')p.open=true;});return host;};
test('alternate projection/output references use one fixed annotated row',async()=>{
 for(const [concept,id] of [[2,'#lab-proj'],[7,'#lab-output']])await lesson(`/labs/attention/lesson-1.html#s2-1-${concept}`,async page=>{
  const host=await reveal(page,id);
  assert.equal(await host.locator('input,select,[data-part="controls"]').count(),0);
  assert.match(await host.innerText(),/Separate.*toy/);
  assert.match(await host.innerText(),/tired/);
  if(concept===2){for(const row of [projections().Q[2],projections().K[2],projections().V[2]])assert.ok((await host.locator('[data-part="output"]').innerText()).includes(fmtVector(row)));}
  else assert.ok((await host.locator('[data-part="body"]').innerText()).includes(fmtVector(outputRow(3).output,3)));
 });
});
test('softmax table follows the retained alternate score selection without another selector',async()=>{
 await lesson('/labs/attention/lesson-1.html#s2-1-5',async page=>{
  const soft=await reveal(page,'#lab-softmax');assert.equal(await soft.locator('select').count(),0);
  await soft.getByRole('link',{name:'Change alternate query',exact:true}).click();await page.locator('#s2-1-3').waitFor({state:'visible'});
  const scores=page.locator('#lab-scores');await scores.waitFor({state:'visible'});
  await scores.locator('#l1-score-query').selectOption('0');
  assert.match(await scores.innerText(),/cosine/);
  await page.goto(base+'/labs/attention/lesson-1.html#s2-1-5');await page.locator('#s2-1-5').waitFor({state:'visible'});
  assert.match(await soft.locator('caption').innerText(),/animal/);
  const p=projections(),breakdown=scoreBreakdown(p.Q[0],p.K),sm=softmaxBreakdown(breakdown.rows.map(r=>r.score),1/Math.sqrt(2));
  const rows=await soft.locator('tbody tr').evaluateAll(rows=>rows.slice(0,3).map(r=>r.lastElementChild.textContent));
  assert.deepEqual(rows,sm.weights.map(w=>fmtNumber(w,3)));
  assert.equal(await page.locator('#s2-1-5 .studio-arithmetic [data-studio-position]').count(),1);
 });
});
test('norm/cosine inspection, scaling saturation and causal-mask contrasts remain',async()=>{
 await lesson('/labs/attention/lesson-1.html#s2-1-3',async page=>{
  const scores=await reveal(page,'#lab-scores');await scores.locator('#l1-score-query').selectOption('2');
  assert.match(await scores.innerText(),/cosine|direction/);
  await page.goto(base+'/labs/attention/lesson-1.html#s2-1-4');const scale=await reveal(page,'#lab-scale');
  assert.match(await scale.locator('[data-part="output"]').innerText(),/saturation/);
  await scale.locator('input[name="l1-scale"][value="1"]').check();assert.match(await scale.locator('[data-part="output"]').innerText(),/every key keeps a share/);
  await page.goto(base+'/labs/attention/lesson-1.html#s2-1-6');const mask=await reveal(page,'#lab-mask');
  assert.match(await mask.locator('[data-part="output"]').innerText(),/6 of 16 weights are exactly 0/);
  await mask.locator('input[name="l1-mask"][value="1"]').check();assert.match(await mask.locator('[data-part="output"]').innerText(),/0 weights are 0/);
 });
});
test('retained wide worked table supports keyboard scrolling',async()=>{
 await lesson('/labs/attention/lesson-1.html#s2-1-7',async page=>{
  await page.setViewportSize({width:320,height:844});const host=await reveal(page,'#lab-output');
  const scroll=host.locator('.table-scroll').first();assert.equal(await scroll.getAttribute('tabindex'),'0');
  await scroll.focus();assert.equal(await scroll.evaluate(e=>document.activeElement===e),true);
  await page.keyboard.press('ArrowRight');
  await page.waitForFunction(()=>document.querySelector('#lab-output .table-scroll').scrollLeft>0);
 });
});
