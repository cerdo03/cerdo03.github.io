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
    if (javaScriptEnabled) await page.locator('#article-content .article-section').first().waitFor();
    await run(page);
  } finally { await context.close(); }
}
test('capacity declares client payload, shows small units and rejects invalid inputs',async()=>{
 await lesson('/labs/kafka/#capacity',async page=>{
  const panel=page.locator('#capacity');
  assert.doesNotMatch(await panel.innerText(),/total network|8 GB\/s network/);
  for(const id of ['cap-mps','cap-bytes','cap-fanout','cap-days','cap-rf'])await page.locator('#'+id).fill('1');
  await page.locator('#capacity-calc').click();
  const result=page.locator('#capacity-result');assert.match(await result.innerText(),/1 B\/s.*1 B\/s.*2 B\/s.*86\.4 kB/s);
  assert.match(await panel.innerText(),/replication.*protocol.*excluded/s);
  await page.locator('#cap-mps').fill('-1');await page.locator('#capacity-calc').click();
  assert.match(await result.innerText(),/positive|valid/i);assert.doesNotMatch(await result.innerText(),/-1 B/);
  await page.locator('#cap-mps').fill('');await page.locator('#capacity-calc').click();assert.match(await result.innerText(),/positive|valid/i);
  await page.locator('#cap-mps').fill('2');await page.locator('#capacity-calc').click();assert.match(await result.innerText(),/2 B\/s/);
 });
});
test('consumer membership changes ownership without deleting or reassigning retained records',async()=>{
 await lesson('/labs/kafka/#partitions',async page=>{
  await page.locator('#produce-form button[type=submit]').click();
  const before=await page.locator('#partition-grid').innerText();
  await page.locator('#worker-count').fill('3');
  assert.equal(await page.locator('#partition-grid').innerText(),before);
  assert.match(await page.locator('#sim-answer').innerText(),/consumer.*retained/i);
  await page.locator('#worker-count').fill('8');assert.match(await page.locator('#worker-grid').innerText(),/idle/);
  assert.equal(await page.locator('#partition-grid').innerText(),before);
  await page.locator('#produce-form button[type=submit]').click();assert.equal(await page.locator('#partition-grid span').count(),2);
 });
});
test('partition resizing compares old and new routing and explicitly scopes demo reset',async()=>{
 await lesson('/labs/kafka/#partitions',async page=>{
  await page.locator('#produce-form button[type=submit]').click();await page.locator('#partition-count').fill('8');
  const change=page.locator('#partition-transition');
  assert.match(await change.innerText(),/4 partitions: P1.*8 partitions: P5/s);
  assert.match(await change.innerText(),/existing Kafka records.*original partitions/i);
  assert.match(await change.innerText(),/demo.*clear|clear.*demo/i);
  await page.locator('#produce-form button[type=submit]').click();assert.match(await page.locator('#partition-grid').innerText(),/P5\norder-123/);
 });
});
test('read paths, retry outcomes and offset crash comparison stay visible without prose buttons',async()=>{
 await lesson('/labs/kafka/',async page=>{
  assert.equal(await page.locator('#read-leader,#read-follower,#retry-plain,#retry-idempotent,#commit-lab-run').count(),0);
  assert.match(await page.locator('#read-comparison').innerText(),/leader A.*preferred follower B.*committed/s);
  assert.match(await page.locator('#retry-comparison').innerText(),/2 records.*1 record/s);
  assert.match(await page.locator('#offset-comparison').innerText(),/40–44.*40–41.*45.*42/s);
  assert.match(await page.locator('#replication').innerText(),/external|HTTP|SMS/);
 });
});
test('replica examples distinguish ISR floor admission from waiting for the actual ISR',async()=>{
 await lesson('/labs/kafka/#replication',async page=>{
  assert.equal(await page.locator('#acks,#min-isr,#ack-check,#leader-fail,#isr-lag').count(),0);
  assert.match(await page.locator('#lag-min-2').innerText(),/ISR.*A.*B.*2.*accept|2.*accept/s);
  assert.match(await page.locator('#lag-min-3').innerText(),/3.*reject|3.*fail/s);
  assert.match(await page.locator('#replication').innerText(),/actual ISR.*minimum.*floor/s);
  assert.match(await page.locator('#election-before').innerText(),/A.*leader/s);
  assert.match(await page.locator('#election-after').innerText(),/B.*leader/s);
 });
});
test('keys display as text when entered into the partition demonstration',async()=>{
 await lesson('/labs/kafka/#partitions',async page=>{
  await page.locator('#order-key').fill('<b>literal</b>');await page.locator('#produce-form button[type=submit]').click();
  assert.equal(await page.locator('#partition-grid span').innerText(),'<b>literal</b>');assert.equal(await page.locator('#partition-grid span b').count(),0);
 });
});
