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
  browser = await chromium.launch({channel:'chrome', headless:true,args:['--enable-webgl','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
});
after(async () => { await browser?.close(); await new Promise(done => server.close(done)); });
async function lesson(path, run, javaScriptEnabled = true) {
  const context = await browser.newContext({javaScriptEnabled, viewport:{width:1280, height:1000}, reducedMotion:'reduce'});
  const page = await context.newPage();page.setDefaultTimeout(5000);
  try {
    await page.goto(base + path);
    if (javaScriptEnabled) await page.locator('#components button').first().waitFor();
    await run(page);
  } finally { await context.close(); }
}
const route='/labs/attention/architecture-explorer/';
test('layout and KV sharing stay primary while scalar model sizing is optional',async()=>{
 await lesson(route,async page=>{
  const advanced=page.locator('#advanced-model');assert.equal(await advanced.getAttribute('open'),null);
  for(const id of ['query-heads','head-dim','token-count'])assert.equal(await page.locator('#'+id).isVisible(),false);
  for(const id of ['layout','kv-heads','position'])assert.ok(await page.locator('#'+id).isVisible());
  await page.locator('#layout').selectOption('GQA');assert.equal(await page.locator('#kv-heads').inputValue(),'2');
  await advanced.locator('summary').click();assert.match(await advanced.innerText(),/different model|changes model width/i);
  await page.locator('#query-heads').selectOption('16');await page.locator('#head-dim').selectOption('128');await page.locator('#token-count').selectOption('8192');
  await advanced.locator('summary').click();assert.match(await page.locator('#config-summary').innerText(),/2,048|2048/);
 });
});
test('position keyboard commits expose allowed row shapes immediately and retain valid boundaries',async()=>{
 await lesson(route,async page=>{
  const input=page.locator('#position');await input.fill('0');await input.press('Tab');
  assert.match(await page.locator('#token-context').innerText(),/query row.*1 × 64.*K.*V.*1 × 64.*1 × 1/is);
  await page.locator('#advanced-model summary').click();await page.locator('#token-count').selectOption('8192');await page.locator('#advanced-model summary').click();
  await input.fill('8191');await input.press('Tab');assert.equal(await input.inputValue(),'8191');
  assert.match(await page.locator('#token-context').innerText(),/8192 × 64.*1 × 8192/s);
  await input.fill('8192');await input.press('Tab');assert.equal(await input.inputValue(),'8191');
 });
});
test('button and direct 3D picking reach identical query inspector; orbit, zoom and keyboard remain optional',async()=>{
 await lesson(route,async page=>{
  await page.waitForFunction(()=>document.querySelector('#renderer-status').textContent.startsWith('3D ready'));
  await page.locator('#layout').selectOption('GQA');await page.locator('.view-shortcuts [data-view=heads]').click();
  await page.locator('#components [data-node=head-0]').click();
  const expected=await page.locator('#shapes').innerText();assert.match(expected,/3 × 64/);
  await page.locator('#components [data-node=head-1]').click();
  await page.locator('#scene canvas').scrollIntoViewIfNeeded();
  const label=page.locator('.scene-label').filter({hasText:/^Q0$/});await label.waitFor();const b=await label.boundingBox();
  await page.mouse.click(b.x+b.width/2,b.y+b.height/2);
  await page.waitForFunction(()=>document.querySelector('#inspector-title').textContent==='Query head 0 reads KV head 0');
  assert.equal(await page.locator('#shapes').innerText(),expected);
  const canvas=page.locator('#scene canvas');await canvas.scrollIntoViewIfNeeded();const box=await canvas.boundingBox(),before=await canvas.screenshot();
  await page.mouse.move(box.x+box.width*.5,box.y+box.height*.5);await page.mouse.down();await page.mouse.move(box.x+box.width*.7,box.y+box.height*.6,{steps:10});await page.mouse.up();
  await page.waitForTimeout(100);assert.equal((await canvas.screenshot()).equals(before),false);
  const orbited=await canvas.screenshot();await page.mouse.wheel(0,-240);await page.waitForTimeout(100);assert.equal((await canvas.screenshot()).equals(orbited),false);
  await canvas.focus();await page.keyboard.press('ArrowRight');await page.keyboard.press('+');await page.keyboard.press('Home');
  assert.equal(await page.locator('#shapes').innerText(),expected);
  await page.locator('#expand-explorer').click();assert.equal(await page.locator('#explorer-dialog').evaluate(e=>e.open),true);
  await page.keyboard.press('Escape');assert.equal(await page.locator('#explorer-dialog').evaluate(e=>e.open),false);
  assert.equal(await page.locator('#expand-explorer').evaluate(e=>e===document.activeElement),true);
 });
});
test('WebGL disabled still leaves all component explanations available',async()=>{
 const context=await browser.newContext({viewport:{width:1280,height:1000}});await context.addInitScript(()=>{const get=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(type,...args){return String(type).includes('webgl')?null:get.call(this,type,...args);};});
 const page=await context.newPage();try{
  await page.goto(base+route);await page.waitForFunction(()=>document.querySelector('#renderer-status').textContent.startsWith('3D unavailable'));
  for(const view of ['overview','block','attention','heads','qkv','ffn']){await page.locator(`.view-shortcuts [data-view="${view}"]`).click();assert.ok(await page.locator('#components button').count());}
  await page.locator('.view-shortcuts [data-view=heads]').click();await page.locator('#components [data-node=head-0]').click();assert.match(await page.locator('#shapes').innerText(),/3 × 64/);
 }finally{await context.close();}
});

test('emulated two-finger pinch changes the optional camera while preserving query information',async()=>{
 const context=await browser.newContext({hasTouch:true,viewport:{width:390,height:844},reducedMotion:'reduce'});
 const page=await context.newPage();try{
  await page.goto(base+route);await page.waitForFunction(()=>document.querySelector('#renderer-status').textContent.startsWith('3D ready'));
  await page.locator('.view-shortcuts [data-view=heads]').click();await page.locator('#components [data-node=head-0]').click();
  const canvas=page.locator('#scene canvas');await canvas.scrollIntoViewIfNeeded();
  const shape=await page.locator('#shapes').innerText(),before=await canvas.screenshot(),box=await canvas.boundingBox();
  const cdp=await context.newCDPSession(page),x=box.x+box.width/2,y=box.y+box.height/2;
  const points=d=>[{id:1,x:x-d,y},{id:2,x:x+d,y}];
  await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:points(20)});
  for(const d of [25,35,45,55,65])await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:points(d)});
  await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  await page.waitForTimeout(100);assert.equal((await canvas.screenshot()).equals(before),false);
  assert.equal(await page.locator('#shapes').innerText(),shape);
 }finally{await context.close();}
});
