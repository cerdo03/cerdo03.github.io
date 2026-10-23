import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const url=process.env.GPU_MOTION_URL||'http://127.0.0.1:4214/labs/gpu/motion.html';
const out=process.env.GPU_MOTION_QA||'/tmp/gpu-motion-qa';
await fs.mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true,channel:'chrome'});
const errors=[],network=[];let states=0,scans=0;
try {
 const page=await browser.newPage({viewport:{width:1440,height:1000}});
 await page.route('https://gc.zgo.at/**',r=>r.abort());await page.route('https://cerdo.goatcounter.com/**',r=>r.abort());
 page.on('pageerror',e=>errors.push(e.message));
 page.on('request',r=>{if(url.startsWith('file:')&&/^https?:/.test(r.url()))network.push(r.url());});
 await page.goto(url);await page.waitForSelector('#scene[data-settled="true"]');
 await page.locator('.theme-toggle').click();await page.locator('.theme-toggle').click();
 assert.equal(await page.locator('#auto').isChecked(),false);
 await page.locator('#next').click();await page.waitForTimeout(800);
 assert.equal(await page.locator('#scene').getAttribute('data-settled'),'false');
 assert.equal(await page.locator('#scene [data-reveal]').last().evaluate(n=>Number(n.style.opacity)),0);
 await page.waitForTimeout(900);
 assert.equal(await page.locator('#scene').getAttribute('data-settled'),'true');
 await page.waitForTimeout(5200);assert.equal(await page.locator('#scene').getAttribute('data-step'),'1');
 console.log('Real-clock 1.5s transition, connection before result, manual hold pass');
 await page.clock.install();
 const next=()=>page.locator('#next').click();
 const step=()=>page.locator('#scene').getAttribute('data-step');
 await page.locator('#auto').check();await page.clock.runFor(4900);assert.equal(await step(),'1');
 await page.clock.runFor(250);assert.equal(await step(),'2');
 await page.clock.runFor(1500);await page.clock.runFor(4800);assert.equal(await step(),'2');
 await page.clock.runFor(400);assert.equal(await step(),'3');
 await page.locator('#auto').uncheck();await page.clock.runFor(10000);assert.equal(await step(),'3');
 await page.locator('#auto').check();await page.clock.runFor(3000);await next();await page.clock.runFor(1700);
 await page.clock.runFor(4500);assert.equal(await step(),'4');await page.clock.runFor(700);assert.equal(await step(),'5');
 await page.locator('[data-mode="explore"]').click();assert.equal(await page.locator('#auto').isChecked(),false);
 await page.clock.runFor(10000);assert.equal(await step(),'5');await page.locator('[data-mode="slides"]').click();
 await page.locator('#auto').check();await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,get:()=>true});document.dispatchEvent(new Event('visibilitychange'));});
 assert.equal(await page.locator('#auto').isChecked(),false);await page.evaluate(()=>{delete document.hidden;document.dispatchEvent(new Event('visibilitychange'));});
 await page.locator('#auto').check();await page.locator('[data-mode="read"]').click();assert.equal(await page.locator('#auto').isChecked(),false);
 await page.locator('[data-mode="slides"]').click();await page.locator('#restart').click();
 await page.locator('#next').evaluate(n=>{n.click();n.click();n.click();});await page.clock.runFor(1800);assert.equal(await step(),'3');
 const retained=await page.locator('#scene').innerText();await page.locator('#back').click();await next();await page.clock.runFor(1800);assert.equal(await page.locator('#scene').innerText(),retained);
 await page.locator('#chapter').selectOption('1');assert.equal(await step(),'0');
 await page.locator('#auto').check();await page.locator('#chapter').focus();await page.keyboard.press('ArrowRight');assert.equal(await step(),'0');
 await page.locator('#auto').uncheck();await page.locator('h1').click();await page.keyboard.press('ArrowRight');await page.clock.runFor(1800);assert.equal(await step(),'1');
 await page.keyboard.press('Home');assert.equal(await step(),'0');
 await page.emulateMedia({reducedMotion:'reduce'});await next();assert.equal(await page.locator('#scene').getAttribute('data-settled'),'true');
 for(let n=1;n<13;n++)await next();assert.equal(await page.locator('#next').isDisabled(),true);assert.equal(await page.locator('#auto').isChecked(),false);
 await page.locator('#back').click();await page.locator('#auto').check();await page.clock.runFor(5100);assert.equal(await step(),'13');assert.equal(await page.locator('#auto').isChecked(),false);
 await page.locator('#restart').click();assert.equal(await page.locator('#back').isDisabled(),true);
 await page.reload();assert.equal(await page.locator('#auto').isChecked(),false);
 console.log('Auto reading delay/off/reset/tabs/visibility/end, rapid clicks, deterministic reversal, keyboard and reduced motion pass');
 await page.close();
 for(const width of [390,768,1440])for(const theme of ['paper','midnight','contrast']){
  const p=await browser.newPage({viewport:{width,height:1000},reducedMotion:'reduce'});p.on('pageerror',e=>errors.push(e.message));p.on('request',r=>{if(url.startsWith('file:')&&/^https?:/.test(r.url()))network.push(r.url());});
  await p.route('https://gc.zgo.at/**',r=>r.abort());await p.route('https://cerdo.goatcounter.com/**',r=>r.abort());
  await p.goto(url);await p.waitForSelector('#scene[data-settled="true"]');
  await p.locator('.theme-toggle').click();await p.locator('.theme-toggle').click();
  await p.evaluate(theme=>document.documentElement.dataset.theme=theme,theme);
  for(const ch of ['0','1']){
   await p.locator('#chapter').selectOption(ch);
   const count=ch==='0'?8:14;
   for(let i=0;i<count;i++){
    assert.equal(await p.locator('#scene').getAttribute('data-step'),String(i));
    const faults=await p.evaluate(()=>{
     const nodes=[...document.querySelectorAll('#scene .matrix span,#scene .sector-box,#transport button')];
     return {overflow:document.documentElement.scrollWidth>innerWidth+1,clipped:nodes.filter(n=>n.scrollWidth>n.clientWidth+2).map(n=>n.textContent)};
    });
    assert.equal(faults.overflow,false,`${width}/${theme}/${ch}/${i} overflow`);assert.deepEqual(faults.clipped,[]);
    if(ch==='0'&&i===6)assert.ok(await p.locator('#scene-card').evaluate(n=>n.offsetHeight)<1800,'Sparse sector view stays inspectable');
    states++;
    if([4,6,7].includes(i)&&ch==='0'||[3,5,7,11,12,13].includes(i)&&ch==='1'){
     await p.locator('#scene-card').screenshot({path:`${out}/${width}-${theme}-${ch}-${i}.png`});
    }
    if(i<count-1)await p.locator('#next').click();
   }
  }
  await p.locator('[data-mode="explore"]').click();
  for(const stride of ['1','2','4','8'])for(const offset of ['0','4','16','28']){
   await p.locator('#stride').selectOption(stride);await p.locator('#offset').selectOption(offset);
   const count=new Set(Array.from({length:32},(_,i)=>Math.floor((Number(offset)+i*Number(stride)*4)/32))).size;
   assert.match(await p.locator('#sector-result').innerText(),new RegExp(`^${count} sectors`));
   assert.equal(((await p.locator('#sector-experiment').innerText()).match(/Lane\s+\d+/g)||[]).length,32,'Every requested lane remains visible');
  }
  for(const [size,bytes] of [['1',576],['2',320],['4',192]]){await p.locator('#tile-size').selectOption(size);assert.match(await p.locator('#tile-result').innerText(),new RegExp(`${bytes} logical global bytes`));}
  if(process.env.GPU_MOTION_AXE){
   await p.addScriptTag({path:process.env.GPU_MOTION_AXE});
   for(const mode of ['slides','explore','read']){
    await p.locator(`[data-mode="${mode}"]`).click();
    const result=await p.evaluate(async()=>await axe.run(document,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21a','wcag21aa']}}));
    assert.deepEqual(result.violations.map(v=>({id:v.id,nodes:v.nodes.map(n=>n.target)})),[],`${width}/${theme}/${mode} accessibility`);scans++;
   }
  }
  await p.close();
 }
 assert.deepEqual(errors,[]);assert.deepEqual(network,[]);console.log(JSON.stringify({states,scans,pageErrors:errors.length,unexpectedNetwork:network}));
 await fs.writeFile(`${out}/results.json`,JSON.stringify({url,states,scans,pageErrors:errors.length,unexpectedNetwork:network,clock:'real transition/manual hold; virtual-clock lifecycle; synthetic visibility event'},null,2));
} finally {await browser.close();}
