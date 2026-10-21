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
test('equation help has one reference, one numerical reveal and no embedded practice copies', async()=>{
 await lesson('/labs/attention/lesson-1.html#s2-1-5', async page=>{
  const reference=page.locator('#s2-1-5 [data-equation="softmax-stable"]');
  assert.equal(await reference.locator('details').count(),1);
  assert.equal(await reference.locator('[data-math-exercise]').count(),0);
  await reference.locator('summary').click();
  const reveal=reference.getByRole('button',{name:'Reveal numerical example',exact:true});
  assert.equal(await reference.locator('[data-equation-example]').isVisible(),false);
  await reveal.focus();await page.keyboard.press('Enter');
  assert.equal(await reference.locator('[data-equation-example]').isVisible(),true);
  assert.match(await reference.locator('[data-equation-example]').innerText(),/Maximum m = 8/);
  await reference.getByRole('link',{name:'Practice this concept',exact:true}).click();
  await page.waitForURL('**/math-fluency/lesson-4.html?from=softmax#practice');
  await page.locator('#practice').waitFor({state:'visible'});
  assert.equal(await page.locator('[data-math-return]').getAttribute('href'),'../attention/lesson-1.html#s2-1-5');
 });
});
test('dedicated canonical practice checks KV bytes and changed mask weights',async()=>{
 await lesson('/labs/math-fluency/lesson-5.html?from=kv#kv-practice',async page=>{
  const kv=page.locator('#kv-practice [data-math-exercise="kv-memory"]');
  assert.equal(await kv.count(),1);
  await kv.getByRole('radio').nth(0).check();await kv.getByRole('button',{name:'Check reasoning',exact:true}).click();
  assert.match(await kv.locator('[role="status"]').innerText(),/both key and value/);
  await kv.getByRole('radio').nth(1).check();await kv.getByRole('button',{name:'Check reasoning',exact:true}).click();
  assert.match(await kv.locator('[role="status"]').innerText(),/Correct.*192/);
 });
 await lesson('/labs/math-fluency/lesson-5.html?from=masking#mask-practice',async page=>{
  const mask=page.locator('#mask-practice [data-math-exercise="masked-attention"]');
  assert.equal(await mask.count(),1);
  await mask.getByText('Compare inclusion and causal exclusion',{exact:true}).click();
  await mask.getByRole('button',{name:'Reveal weights',exact:true}).click();
  const result=mask.locator('[data-mask-result]');
  assert.match(await result.innerText(),/unmasked/);
  await mask.getByRole('combobox',{name:'Third key',exact:true}).selectOption('blocked');
  assert.equal(await result.isVisible(),false);
  await mask.getByRole('button',{name:'Reveal weights',exact:true}).click();
  assert.match(await result.innerText(),/0.731059, 0.268941, 0/);
 });
});
test('compound checks expose the first mismatched field',async()=>{
 await lesson('/labs/math-fluency/lesson-5.html#practice',async page=>{
  const details=page.locator('#practice [data-math-exercise="transformer"] > details').first();
  await details.locator('summary').click();
  await details.getByRole('combobox').nth(0).selectOption('4,2');
  await details.getByRole('combobox').nth(1).selectOption('2,2');
  await details.getByRole('combobox').nth(2).selectOption('4,3');
  await details.getByRole('button',{name:'Check all three shapes',exact:true}).click();
  assert.match(await details.locator('[role="status"]').innerText(),/score.*key/);
 });
});
test('equation reveal keeps readable text while hovered and focused in every theme',async()=>{
 for(const theme of ['paper','midnight','contrast'])await lesson('/labs/math-fluency/lesson-4.html#stable',async page=>{
  await page.evaluate(theme=>document.documentElement.dataset.theme=theme,theme);
  const host=page.locator('[data-equation="softmax-stable"]');await host.locator('summary').click();
  const button=host.getByRole('button');await button.focus();await button.hover();
  await button.evaluate(el=>Promise.allSettled(el.getAnimations().map(animation=>animation.finished)));
  const colors=await button.evaluate(el=>({ink:getComputedStyle(el).color,background:getComputedStyle(el).backgroundColor}));
  const luminance=rgb=>rgb.match(/[\d.]+/g).slice(0,3).map(Number).map(n=>n/255).map(n=>n<=0.04045?n/12.92:((n+0.055)/1.055)**2.4).reduce((sum,n,i)=>sum+n*[0.2126,0.7152,0.0722][i],0);
  const a=luminance(colors.ink),b=luminance(colors.background),ratio=(Math.max(a,b)+0.05)/(Math.min(a,b)+0.05);
  assert.ok(ratio>=4.5,`${theme}: contrast ${ratio.toFixed(2)} must reach 4.5`);
 });
});
