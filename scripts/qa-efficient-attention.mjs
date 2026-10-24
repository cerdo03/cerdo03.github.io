import {chromium,webkit} from 'playwright';
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
const out=process.env.MODULE4_QA||'/tmp/module4-qa';await mkdir(out,{recursive:true});
const base=process.env.MODULE4_URL||'http://127.0.0.1:4216';
const browser=await chromium.launch({channel:'chrome'}),errors=[],violations=[],cases=[];
const axe=process.env.MODULE4_AXE;assert.ok(axe,'Set MODULE4_AXE to an installed axe.min.js for accessibility checks');
const routes=['/labs/llm-systems/','/labs/efficient-attention/','/labs/efficient-attention/lesson-1.html','/labs/efficient-attention/lesson-2.html','/labs/efficient-attention/lesson-3.html','/labs/efficient-attention/lesson-4.html','/labs/efficient-attention/lesson-5.html','/labs/efficient-attention/motion.html'];
async function geometry(p,label){const v=await p.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth,clipped:[...document.querySelectorAll('.ea-node,.ea-key,.ea-block')].filter(n=>n.getClientRects().length&&n.scrollWidth>n.clientWidth+2).map(n=>n.textContent.slice(0,65))}));assert.ok(v.scroll<=v.width+1,`${label}: overflow ${JSON.stringify(v)}`);assert.deepEqual(v.clipped,[],label);}
async function scan(p,label){await p.addScriptTag({path:axe});const r=await p.evaluate(async()=>{const x=await axe.run(document,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa']}});return x.violations.map(v=>({id:v.id,impact:v.impact,nodes:v.nodes.map(n=>n.target)}));});if(r.length)violations.push({label,r});}
try{
 for(const width of [390,768,1440])for(const theme of ['paper','midnight','contrast']){
  const p=await browser.newPage({viewport:{width,height:1000},reducedMotion:'reduce'});p.on('pageerror',e=>errors.push(e.message));
  for(const route of routes){
   await p.goto(base+route);await p.waitForSelector('.course-header');await p.evaluate(t=>document.documentElement.dataset.theme=t,theme);
   const sections=await p.locator('main > section[id]').evaluateAll(ns=>ns.map(n=>n.id));
   if(route.includes('lesson-')){for(const id of sections){await p.goto(base+route+'#'+id);await p.waitForSelector(`main > section[id="${id}"]:not([hidden])`);await p.evaluate(t=>document.documentElement.dataset.theme=t,theme);await geometry(p,`${route}#${id}/${width}/${theme}`);}const active=await p.locator('.course-modules [aria-current="page"]').getAttribute('href');assert.ok(active?.includes('/efficient-attention/'));}
   await geometry(p,`${route}/${width}/${theme}`);await scan(p,`${route}/${width}/${theme}`);cases.push({route,width,theme});
  }
  // Every primary operation, not only captions.
  for(const chapter of ['online','tiles','cow']){
   await p.goto(base+`/labs/efficient-attention/motion.html#${chapter}`);await p.waitForSelector('[data-scene][data-settled="true"]');await p.evaluate(t=>document.documentElement.dataset.theme=t,theme);
   const scene=p.locator('[data-scene]'),next=p.locator('[data-next]');let steps=0;
   do{await geometry(p,`${chapter}/${steps}/${width}/${theme}`);if(!(await next.isEnabled()))break;await next.click();steps++;}while(steps<40);
   if(chapter==='online')assert.match(await scene.innerText(),/1\.55677, 0\.32403/);
   if(chapter==='tiles')assert.match(await scene.innerText(),/40 logical bytes/);
   if(chapter==='cow'){assert.match(await scene.innerText(),/Request B · 7 processed/);assert.doesNotMatch(await scene.innerText(),/Request A ·/);assert.match(await scene.innerText(),/b6/);}
   await scan(p,`${chapter}/final/${width}/${theme}`);
   if(width===390&&theme==='paper')await p.evaluate(()=>window.scrollTo(0,0));
   if(width===390&&theme==='paper')await p.screenshot({path:`${out}/${chapter}-phone.png`,fullPage:true});
   if(width===1440&&theme==='paper')await p.screenshot({path:`${out}/${chapter}-desktop.png`,fullPage:true});
  }
  await p.close();
 }
 const p=await browser.newPage({reducedMotion:'reduce'});p.on('pageerror',e=>errors.push(e.message));
 await p.goto(base+'/labs/efficient-attention/lesson-4.html#mapping');await p.waitForSelector('[data-allocator] [data-pool]');
 await p.locator('[data-append]').click();assert.match(await p.locator('[data-status]').innerText(),/existing tail/);await p.locator('[data-append]').click();assert.match(await p.locator('[data-status]').innerText(),/another physical/);assert.match(await p.locator('[data-pool]').innerText(),/position 8 → logical 2/);
 await p.locator('[data-allocator] select').selectOption('0');assert.match(await p.locator('[data-pool]').innerText(),/K \[1, 1\], V \[1, 1\]/);
 for(let i=0;i<24;i++)await p.locator('[data-append]').click();assert.match(await p.locator('[data-status]').innerText(),/exhausted/);assert.match(await p.locator('[data-pool]').innerText(),/32 processed/);
 await p.locator('[data-reset]').click();assert.match(await p.locator('[data-pool]').innerText(),/7 processed/);
 await p.goto(base+'/labs/efficient-attention/motion.html#online');await p.locator('[data-mode="explore"]').click();
 for(const t of ['1','2','4'])for(const order of ['rising','falling']){await p.locator('[data-tile]').selectOption(t);await p.locator('[data-order]').selectOption(order);assert.match(await p.locator('[data-comparison]').innerText(),/Maximum absolute error/);await p.locator('[data-mode="slides"]').click();await p.locator('[data-all]').click();assert.match(await p.locator('[data-scene]').innerText(),order==='rising'?/1\.55677, 0\.32403/:/0\.79518, 0\.32403/);await p.locator('[data-mode="explore"]').click();}
 await p.locator('select[data-chapter]').selectOption('tiles');await p.locator('[data-all]').click();assert.match(await p.locator('[data-scene] [data-position="0"]').innerText(),/K ≈ \[1\.41421, 0\]/);await p.locator('[data-mode="explore"]').click();for(const br of ['1','2','4']){await p.locator('[data-br]').selectOption(br);assert.match(await p.locator('[data-traffic]').innerText(),/Peak modeled active storage/);}
 await p.locator('select[data-chapter]').selectOption('cow');await p.locator('[data-mode="explore"]').click();for(const c of ['2','4','8']){await p.locator('[data-capacity]').selectOption(c);assert.match(await p.locator('[data-cap-result]').innerText(),/fixed 4 MiB capacity/);}
 await p.goto(base+'/labs/efficient-attention/lesson-2.html#merge');await p.locator('[data-check] button').first().click();assert.match(await p.locator('[data-feedback]:visible').innerText(),/Correct/);await p.locator('[data-check] button').nth(1).click();assert.match(await p.locator('[data-feedback]:visible').innerText(),/Reconsider/);
 await p.close();
 assert.deepEqual(errors,[]);assert.deepEqual(violations,[]);
 await writeFile(`${out}/results.json`,JSON.stringify({cases,errors,violations},null,2));console.log(`PASS ${cases.length} route/theme/width cases, all primary scene operations, allocator/explore/checks; zero page errors and axe violations.`);
}finally{await browser.close();}
