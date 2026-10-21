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
    await page.goto(base + '/labs/attention/' + path);
    if (javaScriptEnabled) await page.locator('body.llm-course').waitFor();
    await run(page);
  } finally { await context.close(); }
}
test('score concepts have local ranges, retain query selection and separate unmasked softmax', async () => {
  for (const [concept,count] of [[3,4],[4,2],[5,3],[6,4]]) await lesson(`lesson-1.html#s2-1-${concept}`, async page => {
    const lab = page.locator(`#s2-1-${concept} .studio-arithmetic`).first();
    assert.match(await lab.locator('.studio-stage').innerText(),new RegExp(`1 / ${count}`));
    await lab.getByRole('combobox',{name:'Inspect position',exact:true}).selectOption('1');
    assert.match(await lab.locator('.studio-stage').innerText(),new RegExp(`1 / ${count}`));
    assert.equal(await lab.locator('[data-studio-back]').isDisabled(),true);
    await lab.locator('[data-studio-all]').click();
    const weights=lab.locator('[data-weight] span');
    if (concept<5) assert.equal(await lab.locator('[data-reveal="normalize"]:visible').count(),0);
    if (concept===5) {
      assert.equal(await weights.count(),3);assert.ok(Number(await weights.nth(2).innerText())>0);
      assert.equal(await lab.locator('[data-reveal="mask"]').count(),0);
    }
    if (concept===6)assert.equal(await weights.nth(2).innerText(),'0');
    await lab.locator('[data-studio-all]').click();
    assert.match(await lab.locator('.studio-stage').innerText(),new RegExp(`1 / ${count}`));
    assert.equal(await lab.getByRole('link',{name:'Review complete causal score calculation',exact:true}).getAttribute('href'),'../inference/#scores');
  });
});
test('head split and join views cannot replay unrelated operations', async () => {
  for (const [concept,count] of [[2,2],[4,3]]) await lesson(`lesson-2.html#s2-2-${concept}`, async page => {
    const lab=page.locator(`#s2-2-${concept} .teaching-visual`).first();
    assert.equal(await lab.locator('[data-command="play"]').count(),0);
    assert.equal(await lab.locator('[data-command="reset"]').count(),0);
    assert.equal(await lab.locator('[data-command="back"]').isDisabled(),true);
    assert.match(await lab.locator('.route-stage').innerText(),new RegExp(`1 / ${count}`));
    if(concept===4)assert.doesNotMatch(await lab.locator('svg').textContent(),/joined × WO/);
    for(let i=1;i<count;i++)await lab.locator('[data-command="next"]').click();
    assert.equal(await lab.locator('[data-command="next"]').isDisabled(),true);
    if(concept===2){assert.doesNotMatch(await lab.locator('svg').textContent(),/Concatenate|Head 1 result/);assert.match(await lab.locator('.visual-caption').innerText(),/original embedding is never sliced/);}
    if(concept===4)assert.match(await lab.locator('.visual-caption').innerText(),/residual addition/);
    assert.equal(await lab.getByRole('link',{name:'Review complete split/join trace',exact:true}).getAttribute('href'),'#s2-2-1');
  });
});
