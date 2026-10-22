import test,{before,after} from 'node:test';
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve,extname} from 'node:path';
const root=resolve(import.meta.dirname,'..');let server,browser,base;
before(async()=>{
 server=createServer(async(req,res)=>{const url=new URL(req.url,'http://localhost');const path=resolve(root,'.'+url.pathname+(url.pathname.endsWith('/')?'index.html':''));try{if(!path.startsWith(root+'/'))throw Error();const data=await readFile(path);res.writeHead(200,{'Content-Type':{'.html':'text/html','.css':'text/css','.js':'text/javascript'}[extname(path)]||'application/octet-stream'});res.end(data);}catch{res.writeHead(404);res.end();}});
 await new Promise(done=>server.listen(0,'127.0.0.1',done));base=`http://127.0.0.1:${server.address().port}`;browser=await chromium.launch({channel:'chrome',headless:true});
});
after(async()=>{await browser?.close();await new Promise(done=>server.close(done));});
test('connected scene preserves output identity through calculation, regrouping and illustrative placement',async()=>{
 const page=await browser.newPage({viewport:{width:1600,height:1100},reducedMotion:'reduce'});const errors=[];page.on('pageerror',e=>errors.push(e.message));
 try{
  const response=await page.goto(base+'/labs/gpu/execution-studio.html');assert.equal(response.status(),200,'Execution studio prototype should exist');
  await page.locator('[data-execution-ready]').waitFor();
  await page.getByRole('spinbutton',{name:'Output number'}).fill('137');await page.getByRole('spinbutton',{name:'Output number'}).press('Enter');
  await page.getByRole('button',{name:'2. Thread',exact:true}).click();
  await page.getByRole('button',{name:'Step calculation'}).click();await page.getByRole('button',{name:'Step calculation'}).click();await page.getByRole('button',{name:'Step calculation'}).click();
  assert.match(await page.locator('[data-calculation]').innerText(),/116/);
  await page.getByRole('button',{name:'4. Block',exact:true}).click();
  assert.match(await page.locator('[data-address]').innerText(),/Block 2/);
  await page.getByLabel('Threads per block').selectOption('128');
  assert.match(await page.locator('[data-address]').innerText(),/Block 1/);
  assert.equal(await page.getByRole('spinbutton',{name:'Output number'}).inputValue(),'137');
  await page.getByRole('button',{name:'5. SM',exact:true}).click();
  await page.getByRole('button',{name:'Place next block'}).click();await page.getByRole('button',{name:'Place next block'}).click();
  assert.match(await page.locator('[data-placement-status]').innerText(),/2 of 2/);
  assert.match(await page.locator('[data-address]').innerText(),/SM 1/);
  await page.getByLabel('Output count').selectOption('96');
  assert.equal(await page.getByRole('spinbutton',{name:'Output number'}).inputValue(),'95');
  assert.match(await page.locator('[data-placement-status]').innerText(),/0 of 1/);
  assert.deepEqual(errors,[]);
 }finally{await page.close();}
});
test('scene supports keyboard component inspection and narrow reduced-motion layouts',async()=>{
 const page=await browser.newPage({viewport:{width:390,height:844},reducedMotion:'reduce'});
 try{
  const response=await page.goto(base+'/labs/gpu/execution-studio.html');assert.equal(response.status(),200);
  await page.locator('[data-execution-ready]').waitFor();
  const sm=page.getByRole('button',{name:'Inspect SM 2',exact:true});await sm.focus();await page.keyboard.press('Enter');
  assert.match(await page.locator('[data-inspection]').innerText(),/SM 2/);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);
  for(const theme of ['paper','midnight','contrast']){
   await page.evaluate(t=>document.documentElement.dataset.theme=t,theme);
   await page.getByRole('button',{name:'3. Warp',exact:true}).click();
   assert.equal(await page.locator('[data-lanes] [data-lane]').count(),32);
  }
 }finally{await page.close();}
});
