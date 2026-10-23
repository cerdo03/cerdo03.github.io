import assert from 'node:assert/strict';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { resolve, extname } from 'node:path';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root=resolve(process.env.QA_SITE_ROOT||'.'),out=resolve(process.env.QA_OUTPUT||'/tmp/dynamo-motion');
const mime={'.html':'text/html','.css':'text/css','.js':'text/javascript','.json':'application/json'};
const server=createServer(async(req,res)=>{try{const pathname=new URL(req.url,'http://localhost').pathname;const file=resolve(root,'.'+pathname+(pathname.endsWith('/')?'index.html':''));if(!file.startsWith(root+'/'))throw Error('Bad path');const data=await readFile(file);res.writeHead(200,{'Content-Type':mime[extname(file)]||'application/octet-stream'});res.end(data);}catch{res.writeHead(404);res.end('Not found');}});
await new Promise(done=>server.listen(0,'127.0.0.1',done));
const browser=await chromium.launch({headless:true,...(process.env.QA_CHANNEL?{channel:process.env.QA_CHANNEL}:{})});
await mkdir(out,{recursive:true});const errors=[];let states=0;
const settled=page=>page.waitForFunction(()=>document.querySelector('#scene')?.dataset.settled==='true');
try{
 for(const width of [360,768,1440]){
  const page=await browser.newPage({viewport:{width,height:1050},reducedMotion:'reduce'});page.on('pageerror',error=>errors.push(error.message));
  await page.goto(`http://127.0.0.1:${server.address().port}/labs/dynamo/motion.html`);
  await page.locator('#beat-title').waitFor();
  assert.equal(await page.locator('#play,#scene-play,#seek,#speed,#narration').count(),0,'No video or voice controls');
  const initial=await page.locator('#scene').getAttribute('data-frame');
  await page.waitForTimeout(1000);assert.equal(await page.locator('#scene').getAttribute('data-frame'),initial,'No automatic advancement');
  for(const theme of ['paper','midnight','contrast']){
   await page.evaluate(theme=>document.documentElement.dataset.theme=theme,theme);
   for(const level of ['1','4']){
    await page.getByLabel('Detail level').selectOption(level);await settled(page);
    for(let chapter=0;chapter<8;chapter++){
     await page.locator('[data-chapter]').nth(chapter).click();await settled(page);
     const before=await page.locator('#scene').getAttribute('data-frame');
     await page.getByRole('button',{name:'Next step',exact:true}).click();await settled(page);
     assert.notEqual(await page.locator('#scene').getAttribute('data-frame'),before);
     const state=await page.locator('#scene').innerHTML();await page.waitForTimeout(30);
     assert.equal(await page.locator('#scene').innerHTML(),state,'Completed transition holds its result');
     assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,`${width}/${theme}/${level}/${chapter}`);
     assert.equal(await page.locator('[data-chapter][aria-current="step"]').count(),1);
     const geometry=await page.locator('#scene').evaluate(scene=>{
      const bounds=scene.getBoundingClientRect(),nodes=[...scene.querySelectorAll('.node')].map(el=>({id:el.dataset.node,r:el.getBoundingClientRect()})),issues=[];
      for(const node of nodes)if(node.r.top<bounds.top-1||node.r.bottom>bounds.bottom+1||node.r.left<bounds.left-1||node.r.right>bounds.right+1)issues.push(node.id+' outside');
      for(let i=0;i<nodes.length;i++)for(let j=i+1;j<nodes.length;j++){const a=nodes[i].r,b=nodes[j].r;if(Math.min(a.right,b.right)>Math.max(a.left,b.left)+1&&Math.min(a.bottom,b.bottom)>Math.max(a.top,b.top)+1)issues.push(nodes[i].id+' overlap '+nodes[j].id);}
      return issues;
     });assert.deepEqual(geometry,[]);
     if(width<=850){const title=await page.locator('#beat-title').boundingBox();assert.ok(title.y>=0&&title.y+title.height<1050);}
     states++;
    }
   }
  }
  await page.emulateMedia({reducedMotion:'no-preference'});
  await page.getByLabel('Detail level').selectOption('1');await settled(page);await page.locator('[data-chapter]').nth(1).click();await settled(page);
  await page.getByRole('button',{name:'Next step',exact:true}).click();
  assert.equal(await page.locator('#scene').getAttribute('data-settled'),'false','Next starts a real transition');
  await settled(page);const forward=await page.locator('#scene').innerHTML();
  await page.getByRole('button',{name:'Previous step',exact:true}).click();await settled(page);
  await page.getByRole('button',{name:'Next step',exact:true}).click();await settled(page);assert.equal(await page.locator('#scene').innerHTML(),forward,'Back/Next restores identical visual state');
  await page.waitForTimeout(900);assert.equal(await page.locator('#scene').innerHTML(),forward,'No advancement after transition ends');
  await page.getByRole('tab',{name:'Explore',exact:true}).click();
  await page.getByLabel('Unreachable host').selectOption('B');await page.getByLabel('Acknowledgements required').selectOption('2');assert.match(await page.locator('#request-result').textContent(),/timeout/i);
  await page.getByLabel('Use a hinted fallback').check();assert.match(await page.locator('#request-result').textContent(),/4 ms/);
  await page.getByLabel('Reconciliation policy').selectOption('union');assert.match(await page.locator('#policy-result').textContent(),/book.*pen/);
  await page.getByLabel('Reconciliation policy').selectOption('edits');assert.match(await page.locator('#policy-result').textContent(),/Only pen/);
  await page.getByRole('tab',{name:'Read',exact:true}).click();await page.getByRole('button',{name:'Explain Sx',exact:true}).focus();assert.equal(await page.locator('#motion-tooltip').isVisible(),true);
  await page.keyboard.press('Escape');await page.evaluate(()=>window.dispatchEvent(new Event('scroll')));assert.equal(await page.locator('#motion-tooltip').isVisible(),false);
  await page.getByRole('tab',{name:'Slides',exact:true}).click();await page.emulateMedia({reducedMotion:'reduce'});
  await page.locator('[data-chapter]').first().click();await page.getByRole('button',{name:'Next step',exact:true}).click();assert.equal(await page.locator('#scene').getAttribute('data-settled'),'true');
  await page.getByRole('button',{name:'Restart chapter',exact:true}).click();assert.equal(await page.locator('#scene').getAttribute('data-frame'),'0-cart');
  await page.evaluate(()=>document.documentElement.dataset.theme='paper');await page.evaluate(()=>window.scrollTo(0,0));await page.screenshot({path:resolve(out,`overview-${width}.png`),fullPage:true});
  await page.locator('[data-chapter]').nth(6).click();for(let i=0;i<3;i++)await page.getByRole('button',{name:'Next step',exact:true}).click();await page.evaluate(()=>window.scrollTo(0,0));await page.screenshot({path:resolve(out,`reconciliation-${width}.png`),fullPage:true});
  await page.close();
 }
 assert.deepEqual(errors,[]);const result={states,errors};console.log(JSON.stringify(result));await writeFile(resolve(out,'results.json'),JSON.stringify(result,null,2));
}finally{await browser.close();await new Promise(done=>server.close(done));}
