// Optional real-browser QA: npm run test:architecture:browser. Does not publish.
import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { resolve, extname } from 'node:path';
const root=resolve(process.env.QA_SITE_ROOT||'.'),out=resolve(process.env.QA_OUTPUT||'/tmp/architecture-qa');
await mkdir(out,{recursive:true});
const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.woff2':'font/woff2'};
const server=createServer(async(req,res)=>{
  try {
    const path=new URL(req.url,'http://localhost').pathname;
    if(path==='/favicon.ico'){res.writeHead(204);res.end();return;}
    const target=resolve(root,'.'+decodeURIComponent(path)+(path.endsWith('/')?'index.html':''));
    if(!target.startsWith(root+'/'))throw new Error('Invalid path');
    const data=await readFile(target);res.writeHead(200,{'Content-Type':mime[extname(target)]||'application/octet-stream'});res.end(data);
  }catch{res.writeHead(404);res.end('Not found');}
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const base=`http://127.0.0.1:${server.address().port}`,route='/labs/attention/architecture-explorer/';
let browser;const report={cases:[],errors:[]};
try {
  browser=await chromium.launch({headless:true,...(process.env.QA_BROWSER_CHANNEL?{channel:process.env.QA_BROWSER_CHANNEL}:{}),args:['--enable-webgl','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
  const context=await browser.newContext({reducedMotion:'reduce'});
  await context.route('https://gc.zgo.at/**',r=>r.fulfill({body:''}));
  const page=await context.newPage();
  page.on('pageerror',e=>report.errors.push(e.message));
  page.on('response',r=>{if(r.status()>=400)report.errors.push(`${r.status()} ${r.url()}`);});
  const views=['overview','block','attention','heads','qkv','ffn'];
  for(const width of (process.env.QA_FAST?[1280]:[320,390,768,1280,1600]))for(const theme of (process.env.QA_FAST?['paper']:['paper','midnight','contrast'])){
    await page.setViewportSize({width,height:1000});await page.goto(base+route);
    await page.waitForFunction(()=>document.querySelector('#renderer-status').textContent.startsWith('3D ready'));
    await page.evaluate(theme=>document.documentElement.dataset.theme=theme,theme);
    for(const view of views){
      await page.locator(`.view-shortcuts [data-view="${view}"]`).click();
      await page.waitForTimeout(60);
      const geometry=await page.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth,labels:[...document.querySelectorAll('.scene-label')].filter(e=>!e.hidden).length}));
      assert.ok(geometry.scroll<=geometry.width+1,`overflow ${width}/${theme}/${view}: ${JSON.stringify(geometry)}`);
      assert.ok(geometry.labels>0,'visible scene labels');
      assert.ok(await page.locator('#components button').count()>0);
      const current=await page.locator('#breadcrumbs [aria-current]').textContent();assert.ok(current);
      report.cases.push({width,theme,view});
    }
    if([320,1280].includes(width))await page.screenshot({path:resolve(out,`${theme}-${width}.png`),fullPage:true});
  }
  // Dense head grids must retain readable, non-overlapping labels on phones.
  for(const count of ['8','32']) {
    await page.setViewportSize({width:320,height:1000});await page.goto(base+route);
    await page.waitForFunction(()=>document.querySelector('#renderer-status').textContent.startsWith('3D ready'));
    await page.selectOption('#query-heads',count);await page.locator('.view-shortcuts [data-view="heads"]').click();await page.waitForTimeout(120);
    const overlaps=await page.locator('.scene-label').evaluateAll(nodes=>{const boxes=nodes.filter(n=>!n.hidden).map(n=>n.getBoundingClientRect());let overlaps=0;boxes.forEach((a,i)=>boxes.slice(i+1).forEach(b=>{if(a.left<b.right&&a.right>b.left&&a.top<b.bottom&&a.bottom>b.top)overlaps++;}));return overlaps;});
    assert.equal(overlaps,0,`${count}-head phone label overlap`);
    await page.locator('#scene-wrap').screenshot({path:resolve(out,`phone-heads-${count}.png`)});
  }
  console.log(`Layout matrix: ${report.cases.length} cases passed`);
  await page.setViewportSize({width:1440,height:1100});await page.goto(base+route);
  await page.waitForFunction(()=>document.querySelector('#renderer-status').textContent.startsWith('3D ready'));
  await page.locator('[data-node="block-1"]').focus();await page.keyboard.press('Enter');
  assert.match(await page.locator('#view-title').textContent(),/2/);
  assert.equal(await page.locator('#components button').count(),8);
  await page.locator('[data-node="attention"]').click();await page.locator('[data-node="qkv"]').click();
  await page.locator('[data-node="q"]').click();assert.match(await page.locator('#inspector-title').textContent(),/Queries/);
  await page.locator('#back').click();await page.locator('[data-node="heads"]').click();
  await page.selectOption('#query-heads','32');await page.selectOption('#layout','GQA');await page.selectOption('#kv-heads','8');
  await page.selectOption('#head-dim','128');await page.selectOption('#token-count','2048');
  assert.equal(await page.locator('[data-node^="head-"]').count(),32);
  assert.equal(await page.locator('[data-node^="kv-"]').count(),8);
  assert.match(await page.locator('#memory-equation').textContent(),/16,777,216 bytes/);
  await page.locator('[data-node="head-31"]').click();assert.match(await page.locator('#explanation').textContent(),/KV head 7/);
  await page.locator('#position').fill('0');await page.locator('#position').press('Tab');assert.match(await page.locator('#explanation').textContent(),/0 through 0/);
  await page.selectOption('#layout','MQA');assert.equal(await page.locator('[data-node^="kv-"]').count(),1);
  await page.selectOption('#layout','MHA');assert.equal(await page.locator('[data-node^="kv-"]').count(),32);
  await page.selectOption('#query-heads','4');await page.selectOption('#layout','GQA');assert.equal(await page.locator('#kv-heads').inputValue(),'2');
  await page.selectOption('#token-count','3');assert.equal(await page.locator('#position').getAttribute('max'),'2');
  await page.locator('#position').fill('8');await page.locator('#position').press('Tab');assert.equal(await page.locator('#position').inputValue(),'0');
  await page.locator('.view-shortcuts [data-view="overview"]').click();
  await page.locator('.course-modules > summary').click();
  for(const href of await page.locator('.course-sidebar a').evaluateAll(a=>a.map(x=>x.href))){assert.equal((await page.request.get(href)).status(),200,href);}
  const symbol=page.locator('#head-dim').locator('..').locator('var');await symbol.focus();assert.equal(await page.locator('.symbol-tip').isVisible(),true);await page.keyboard.press('Escape');assert.equal(await page.locator('.symbol-tip').isVisible(),false);
  await page.locator('canvas').focus();await page.keyboard.press('ArrowRight');await page.keyboard.press('+');await page.keyboard.press('Home');
  // A real canvas hit must drill into the same block as its HTML equivalent.
  await page.locator('#scene-wrap').scrollIntoViewIfNeeded();await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
  const hit=await page.locator('.scene-label').filter({hasText:'Decoder block 1'}).boundingBox();await page.mouse.click(hit.x+hit.width/2,hit.y+hit.height/2);assert.match(await page.locator('#view-title').textContent(),/Decoder block 1/);
  // Immediate reconfiguration during animation must not resurrect stale nodes.
  await page.emulateMedia({reducedMotion:'no-preference'});await page.locator('[data-node="attention"]').click();await page.selectOption('#head-dim','32');await page.waitForTimeout(800);
  assert.match(await page.locator('#view-title').textContent(),/Causal attention/);assert.equal(await page.locator('.scene-label').filter({hasText:'Project Q / K / V'}).count(),1);
  // Reset/keyboard/orbit during the initial zoom must still commit the new graph.
  for(const interrupt of ['reset','keyboard','orbit']) {
    await page.locator('.view-shortcuts [data-view="overview"]').click();await page.waitForTimeout(700);
    await page.locator('#scene-wrap').scrollIntoViewIfNeeded();
    if(interrupt==='reset')await page.evaluate(()=>{document.querySelector('[data-node="block-0"]').click();document.querySelector('#reset-camera').click();});
    if(interrupt==='keyboard') {await page.evaluate(()=>document.querySelector('[data-node="block-0"]').click());await page.locator('canvas').press('ArrowRight');}
    if(interrupt==='orbit') {await page.evaluate(()=>document.querySelector('[data-node="block-0"]').click());const box=await page.locator('canvas').boundingBox();await page.mouse.move(box.x+box.width/2,box.y+box.height/2);await page.mouse.down();await page.mouse.move(box.x+box.width/2+25,box.y+box.height/2+5);await page.mouse.up();}
    await page.waitForTimeout(800);
    assert.match(await page.locator('#view-title').textContent(),/Decoder block 1/);
    assert.equal(await page.locator('.scene-label').filter({hasText:'Block 1 input'}).count(),1,`scene follows navigation after ${interrupt}`);
  }
  await page.locator('.view-shortcuts [data-view="block"]').click();await page.waitForTimeout(700);await page.screenshot({path:resolve(out,'block-desktop.png'),fullPage:true});
  await page.locator('.view-shortcuts [data-view="heads"]').click();await page.waitForTimeout(700);await page.screenshot({path:resolve(out,'heads-desktop.png'),fullPage:true});
  report.interactions='keyboard, canvas hit, both blocks, drill/back, all layouts, selected head/token, invalid token, dimensions, memory, module links, symbol focus/Escape, motion interruption';
  // Shared shell regressions: links retain mathematical-context query parameters.
  await page.goto(base+'/labs/math-fluency/lesson-4.html?from=softmax');
  assert.ok((await page.locator('.course-sidebar a').evaluateAll(a=>a.filter(x=>x.pathname.includes('/math-fluency/lesson-')).map(x=>x.search))).every(s=>s==='?from=softmax'));
  for(const path of ['/labs/attention/','/labs/attention/lesson-2.html','/labs/attention/lesson-3.html','/labs/llm-systems/']){
    await page.goto(base+path);assert.ok(await page.locator('a[href*="architecture-explorer/"]').count()>0);assert.equal(await page.locator('.course-header a').getAttribute('href'),'/labs/llm-systems/');
  }
  // Graceful graphics failure: renderer import is unavailable, core learning remains functional.
  const fallback=await context.newPage();await fallback.route('**/scene.js*',r=>r.abort());await fallback.goto(base+route);
  await fallback.waitForFunction(()=>document.querySelector('#renderer-status').textContent.startsWith('3D unavailable'));
  await fallback.locator('.view-shortcuts [data-view="heads"]').click();await fallback.locator('[data-node="head-3"]').click();assert.match(await fallback.locator('#inspector-title').textContent(),/Query head 3/);
  await fallback.close();
  const noGL=await browser.newContext({javaScriptEnabled:true});await noGL.addInitScript(()=>{const original=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(type,...args){return type==='webgl2'?null:original.call(this,type,...args);};});const glPage=await noGL.newPage();await glPage.goto(base+route);await glPage.waitForFunction(()=>document.querySelector('#renderer-status').textContent.startsWith('3D unavailable'));assert.equal(await glPage.locator('#components button').count(),5);await noGL.close();
  const noJS=await browser.newContext({javaScriptEnabled:false});const staticPage=await noJS.newPage();await staticPage.goto(base+route);assert.equal(await staticPage.locator('noscript').isVisible(),true);assert.ok(await staticPage.locator('a[href="../lesson-3.html"]').count());await noJS.close();
  const blocked=await browser.newContext({reducedMotion:'reduce'});await blocked.addInitScript(()=>{Object.defineProperty(window,'localStorage',{get(){throw new Error('Storage disabled');}});});const blockedPage=await blocked.newPage();await blockedPage.goto(base+route);await blockedPage.waitForFunction(()=>document.querySelector('#renderer-status').textContent.startsWith('3D ready'));await blockedPage.selectOption('#layout','MQA');assert.match(await blockedPage.locator('#memory-note').textContent(),/Selected MQA/);await blocked.close();
  assert.deepEqual(report.errors,[]);report.result='PASS';
  console.log(`PASS: ${report.cases.length} layout/view cases; interaction, fallback, storage, navigation checks; no page errors or failed HTTP responses.`);
} finally {
  await writeFile(resolve(out,'report.json'),JSON.stringify(report,null,2));await browser?.close();server.close();
}
