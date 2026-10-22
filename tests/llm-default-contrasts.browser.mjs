import test, {before, after} from 'node:test';
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve, extname} from 'node:path';
import {attentionState} from '../labs/inference/guide-model.js';
import {fmtVector} from '../labs/attention/ui.js';

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
const reveal=async(page,id)=>{const host=page.locator(id);await host.evaluate(e=>{for(let p=e.parentElement;p;p=p.parentElement)if(p.tagName==='DETAILS')p.open=true;});return host;};
test('intro memory keeps count controls with fixed visible assumptions and canonical links',async()=>{
 await lesson('/labs/inference/#memory',async page=>{
  const lab=page.locator('#scene');
  assert.equal(await lab.locator('#heads,#bytes').count(),0);
  assert.match(await lab.innerText(),/32 layers.*8 KV heads.*128.*2 bytes/s);
  await lab.locator('#length').fill('2048');await lab.locator('#length').dispatchEvent('change');
  await lab.getByText('Add concurrent requests',{exact:true}).click();
  await lab.locator('#batch').selectOption('4');
  assert.match(await lab.innerText(),/1,073,741,824 bytes/);
  assert.equal(await lab.getByRole('link',{name:'Compare head sharing',exact:true}).getAttribute('href'),'../attention/lesson-3.html#s2-3-3');
  assert.equal(await lab.getByRole('link',{name:'Change model and precision',exact:true}).getAttribute('href'),'../attention/lesson-5.html#s2-5-2');
 });
});
test('fresh attention shows sky excluding is; chosen query persists across concepts and reload',async()=>{
 await lesson('/labs/attention/lesson-1.html#s2-1-1',async page=>{
  assert.equal(await page.locator('#s2-1-1 [data-position]').inputValue(),'1');
  assert.match(await page.locator('#s2-1-1 .shared-attention').innerText(),/is.*blocked/s);
  await page.goto(base+'/labs/attention/lesson-1.html#s2-1-6');
  const lab=page.locator('#s2-1-6 .studio-arithmetic');
  assert.equal(await lab.locator('[data-studio-position]').inputValue(),'1');
  assert.match(await lab.innerText(),/sky.*is.*itself/s);
  await lab.locator('[data-studio-all]').click();
  assert.equal(await lab.locator('[data-weight] span').nth(2).innerText(),'0');
  const shares=(await lab.locator('[data-weight] span').allTextContents()).map(Number);
  assert.ok(Math.abs(shares.reduce((a,b)=>a+b,0)-1)<.002);
  await lab.locator('[data-studio-position]').selectOption('2');
  await lab.locator('[data-studio-all]').click();
  assert.ok((await lab.locator('[data-weight] span').allTextContents()).every(v=>Number(v)>0));
  await page.goto(base+'/labs/attention/lesson-1.html#s2-1-1');
  assert.equal(await page.locator('#s2-1-1 [data-position]').inputValue(),'2');
  await page.reload();assert.equal(await page.locator('#s2-1-1 [data-position]').inputValue(),'2');
  await page.goto(base+'/labs/attention/lesson-1.html#s2-1-2');
  await page.locator('#s2-1-2 [data-route="position"]').selectOption('0');
  await page.goto(base+'/labs/attention/lesson-1.html#s2-1-6');
  assert.equal(await lab.locator('[data-studio-position]').inputValue(),'0');
  await lab.locator('[data-studio-all]').click();
  assert.deepEqual(await lab.locator('[data-weight] span').allTextContents(),['1','0','0']);
 });
});
test('saved query without custom embeddings remains selected on entry',async()=>{
 await lesson('/labs/attention/lesson-1.html#s2-1-6',async page=>{
  await page.evaluate(()=>localStorage.setItem('inference-course-v4',JSON.stringify({attention:{position:2}})));
  await page.reload();assert.equal(await page.locator('#s2-1-6 [data-studio-position]').inputValue(),'2');
  await page.goto(base+'/labs/attention/lesson-1.html#s2-1-1');
  assert.equal(await page.locator('#s2-1-1 [data-position]').inputValue(),'2');
 });
});
test('long-range context has first/last boundary choices and truthful recurrent comparison',async()=>{
 await lesson('/labs/attention/lesson-1.html#s2-1-1',async page=>{
  const lab=await reveal(page,'#lab-context');
  assert.equal(await lab.locator('input[name="l1-context"]').count(),2);
  await lab.locator('input[name="l1-context"]').first().check();
  assert.match(await lab.locator('[data-part=output]').innerText(),/only attend to itself/);
  await lab.locator('input[name="l1-context"]').last().check();
  assert.match(await lab.locator('[data-part=output]').innerText(),/9 earlier positions.*single attention step.*9 sequential state updates/s);
  assert.match(await lab.innerText(),/availability.*not.*weight/s);
 });
});
test('independent head width is optional; active invariant and generalized shapes remain visible',async()=>{
 await lesson('/labs/attention/lesson-2.html#s2-2-5',async page=>{
  const lab=page.locator('#mha-explorer'),advanced=lab.locator('#mha-advanced');
  assert.equal(await advanced.getAttribute('open'),null);
  assert.equal(await advanced.locator('#mha-dhead').isVisible(),false);
  await lab.locator('input[name="mha-heads"][value="64"]').check();
  assert.match(await lab.locator('#mha-out-inner').innerText(),/= 512/);
  assert.match(await lab.locator('#mha-out-params').innerText(),/1,048,576/);
  await advanced.locator('summary').click();
  assert.match(await advanced.innerText(),/projected width.*512/s);
  await lab.locator('input[name="mha-dhead-mode"][value="independent"]').check();
  await lab.locator('#mha-dhead').fill('128');
  assert.match(await lab.locator('#mha-out-inner').innerText(),/= 8,192/);
  assert.match(await lab.locator('#mha-out-params').innerText(),/16,777,216/);
  assert.match(await lab.locator('#mha-out-wo').innerText(),/8192.*512|8,192.*512/);
  await advanced.locator('summary').click();
  assert.ok(await lab.locator('#mha-invariant').isVisible());assert.match(await lab.locator('#mha-invariant').innerText(),/Independent.*8,192/s);
  await advanced.locator('summary').click();
  await lab.locator('input[name="mha-dhead-mode"][value="equal"]').check();
  assert.match(await lab.locator('#mha-out-inner').innerText(),/= 512/);
  await lab.locator('#mha-t').fill('0');assert.equal(await lab.locator('#mha-error').isVisible(),true);
  await lab.locator('#mha-t').fill('1');assert.equal(await lab.locator('#mha-error').isVisible(),false);
 });
});
test('head sharing starts with fixed dimensions; optional scaling preserves equal comparison and topology',async()=>{
 await lesson('/labs/attention/lesson-3.html#s2-3-3',async page=>{
  const lab=page.locator('#gqa-lab'),advanced=lab.locator('#gqa-advanced');
  assert.equal(await advanced.getAttribute('open'),null);assert.equal(await lab.locator('#gqa-d').isVisible(),false);
  assert.match(await lab.locator('#gqa-reference').innerText(),/128.*4,096/s);
  const original=await lab.locator('#gqa-table-body tr').nth(1).locator('td').last().innerText();
  await advanced.locator('summary').click();
  await lab.locator('#gqa-d').selectOption('256');await lab.locator('#gqa-t').fill('8192');await lab.locator('#gqa-t').dispatchEvent('change');
  assert.equal(await lab.locator('#gqa-table-body tr').nth(1).locator('td').last().innerText(),original);
  await advanced.locator('summary').click();assert.match(await lab.locator('#gqa-reference').innerText(),/256.*8,192/s);
  await lab.locator('#gqa-q').selectOption('12');
  await lab.locator('#gqa-kv').selectOption('3');
  assert.equal(await lab.locator('.gqa-group').count(),3);
  assert.equal(await lab.locator('.gqa-q').count(),12);
  await lab.locator('.gqa-q[data-q="11"]').click();assert.match(await lab.locator('#gqa-selection').innerText(),/KV2/);
  await lab.locator('#gqa-q').selectOption('4');assert.match(await lab.locator('#gqa-change').innerText(),/adjust|valid|divid/i);
  for(const preset of ['mha','gqa','mqa']){await lab.locator(`[data-preset="${preset}"]`).click();assert.ok(await lab.locator('#gqa-diagram').isVisible());}
  await advanced.locator('summary').click();await lab.locator('#gqa-t').fill('0');await lab.locator('#gqa-t').dispatchEvent('change');assert.equal(await lab.locator('#gqa-error').isVisible(),true);
  await lab.locator('#gqa-t').fill('4096');await lab.locator('#gqa-t').dispatchEvent('change');assert.equal(await lab.locator('#gqa-error').isVisible(),false);
 });
});
test('wide head-sharing formula can be reached and scrolled with keyboard',async()=>{
 await lesson('/labs/attention/lesson-3.html#s2-3-3',async page=>{
  await page.setViewportSize({width:320,height:844});
  const formula=page.locator('#gqa-formula');
  assert.equal(await formula.getAttribute('tabindex'),'0');
  await formula.focus();await page.keyboard.press('ArrowRight');
  await page.waitForFunction(()=>document.querySelector('#gqa-formula').scrollLeft>0);
 });
});
test('residual worked row follows weighted-value query without another selector',async()=>{
 await lesson('/labs/attention/lesson-1.html#s2-1-7',async page=>{
  const values=page.locator('#s2-1-7 .studio-arithmetic');
  for(const position of ['0','1','2']){
   await values.locator('[data-studio-position]').selectOption(position);
   await page.goto(base+'/labs/attention/lesson-1.html#s2-1-8');
   const residual=page.locator('#s2-1-8 .shared-attention');
   assert.equal(await residual.locator('select,input').count(),0);
   assert.match(await residual.innerText(),new RegExp('position '+(Number(position)+1)));
   assert.match(await residual.innerText(),/assume WO is identity only for this toy arithmetic/);
   assert.match(await residual.innerText(),/not Q\/K\/V/);
   const a=attentionState(Number(position));
   assert.ok((await residual.locator('.mechanism-node').filter({hasText:'After this residual addition'}).innerText()).includes(fmtVector(a.x.map((x,d)=>x+a.output[d]),3)));
   await residual.getByRole('link',{name:'Change query in weighted values',exact:true}).click();
   assert.equal(new URL(page.url()).hash,'#s2-1-7');
   assert.equal(await values.locator('[data-studio-position]').inputValue(),position);
  }
 });
});
test('query changes from the inference tab update the open attention walkthrough',async()=>{
 await lesson('/labs/attention/lesson-1.html#s2-1-6',async page=>{
  const peer=await page.context().newPage();
  try{
   await peer.goto(base+'/labs/inference/#scores');
   await peer.locator('[data-studio-position]').selectOption('0');
   await page.waitForFunction(()=>document.querySelector('#s2-1-6 [data-studio-position]').value==='0');
   await page.goto(base+'/labs/attention/lesson-1.html#s2-1-1');
   assert.equal(await page.locator('#s2-1-1 [data-position]').inputValue(),'0');
  }finally{await peer.close();}
 });
});
