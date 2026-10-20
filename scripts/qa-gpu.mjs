// Local browser verification; no analytics events or external mutations.
import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile, mkdir, writeFile} from 'node:fs/promises';
import {resolve,extname} from 'node:path';
const root=resolve(process.env.QA_SITE_ROOT||'.'),out=resolve(process.env.QA_OUTPUT||'/tmp/gpu-qa');
await mkdir(out,{recursive:true});
const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.woff2':'font/woff2'};
const server=createServer(async(req,res)=>{
  try{
    const path=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
    if(path==='/favicon.ico'){res.writeHead(204);res.end();return;}
    const target=resolve(root,'.'+path+(path.endsWith('/')?'index.html':''));
    if(!target.startsWith(root+'/'))throw Error('invalid path');
    res.writeHead(200,{'Content-Type':mime[extname(target)]||'application/octet-stream'});res.end(await readFile(target));
  }catch{res.writeHead(404);res.end('Not found');}
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const base=`http://127.0.0.1:${server.address().port}`;
let browser;
const report={cases:[],interactions:[],errors:[]};
try{
  browser=await chromium.launch({channel:'chrome',headless:true});
  const context=await browser.newContext();
  await context.route(/https:\/\/(gc\.zgo\.at|cerdo\.goatcounter\.com)/,route=>route.abort());
  const page=await context.newPage();
  page.on('pageerror',error=>report.errors.push(error.message));
  page.on('response',response=>{if(response.status()>=400)report.errors.push(`${response.status()} ${response.url()}`);});
  const goto=async(path)=>{const response=await page.goto(base+path);assert.equal(response.status(),200);await page.locator('body.llm-course').waitFor();};
  const geometry=async()=>{
    const issues=await page.evaluate(()=>{
      const issues=[];
      if(document.documentElement.scrollWidth>innerWidth+1)issues.push('Page overflow');
      for(const svg of document.querySelectorAll('svg'))for(const text of svg.querySelectorAll('text')){
        const a=text.getBoundingClientRect(),b=svg.getBoundingClientRect();
        if(a.left<b.left-2||a.right>b.right+2||a.top<b.top-2||a.bottom>b.bottom+2)issues.push(`SVG text clipped: ${text.textContent}`);
      }
      return issues;
    });assert.deepEqual(issues,[]);
  };
  for(const width of [320,390,820,1440])for(const theme of ['paper','midnight','contrast']){
    await page.setViewportSize({width,height:1000});
    await page.emulateMedia({reducedMotion:'reduce'});
    await page.addInitScript(theme=>{localStorage.setItem('journal-appearance',theme==='paper'?'light':'dark');},theme);
    for(let lesson=0;lesson<=5;lesson++){
      await goto(`/labs/gpu/${lesson?`lesson-${lesson}.html`:''}`);
      // Theme is applied with existing theme mechanism; direct attribute supports owner-only contrast QA.
      await page.evaluate(theme=>document.documentElement.dataset.theme=theme,theme);
      assert.equal(await page.locator('nav[aria-label="Modules"] a[href*="/gpu/"]').count(),6);
      assert.equal(await page.locator('nav[aria-label="Modules"] a[aria-current="page"]').count(),1);
      if(lesson){
        const concepts=page.locator('main > section[id]');
        for(let i=0;i<await concepts.count();i++){
          await page.evaluate(i=>document.querySelectorAll('nav[aria-label="Concepts"] button')[i].click(),i);
          assert.equal(await page.locator('main > section[id]:visible').count(),1);
          for(const details of await page.locator('main > section[id]:visible details').all())await details.evaluate(e=>e.open=true);
          for(const show of await page.locator('main > section[id]:visible button').filter({hasText:'Show all'}).all())await show.click();
          await geometry();
        }
      }else await geometry();
      report.cases.push({width,theme,lesson,status:'pass'});
      if(width!==820&&theme==='paper'&&[1,3,4,5].includes(lesson))await page.screenshot({path:resolve(out,`lesson-${lesson}-${width}.png`),fullPage:true});
    }
  }
  await page.setViewportSize({width:1440,height:1000});
  await goto('/labs/gpu/lesson-1.html');
  const execution=page.locator('[data-gpu-lab="execution"]');
  assert.equal(await execution.locator('.gpu-stage:visible').count(),1);
  await execution.getByRole('button',{name:'Next operation',exact:true}).click();
  assert.equal(await execution.locator('.gpu-stage:visible').count(),2);
  await execution.getByRole('button',{name:'Show all',exact:true}).click();
  assert.equal(await execution.locator('.gpu-lanes .masked').count(),24);
  await execution.getByRole('combobox',{name:'Output elements',exact:true}).selectOption('128');
  await execution.getByRole('combobox',{name:'Threads per block',exact:true}).selectOption('256');
  await execution.getByRole('button',{name:'Show all',exact:true}).click();
  assert.equal(await execution.locator('.gpu-lanes .masked').count(),32);
  await page.goto(base+'/labs/gpu/lesson-1.html#residency');
  const residency=page.locator('[data-gpu-lab="residency"]');
  assert.match(await residency.innerText(),/12.5%/);
  await residency.getByRole('combobox',{name:'Shared KiB per block',exact:true}).selectOption('8');
  assert.match(await residency.innerText(),/50%/);
  await goto('/labs/gpu/lesson-2.html#coalescing');
  const coal=page.locator('[data-gpu-lab="coalescing"]');
  assert.match(await coal.innerText(),/4 sectors service/);
  await coal.getByRole('combobox',{name:'Starting byte offset',exact:true}).selectOption('4');
  assert.match(await coal.innerText(),/5 sectors service/);
  await coal.getByRole('combobox',{name:'Stride (4-byte elements)',exact:true}).selectOption('8');
  assert.match(await coal.innerText(),/32 sectors service/);
  await goto('/labs/gpu/lesson-3.html');
  const product=page.locator('[data-gpu-lab="matmul"]');
  assert.match(await product.innerText(),/Future products/);assert.ok(await product.locator('th[scope="col"]').count()>=12);
  await product.getByRole('button',{name:'Show all',exact:true}).click();
  assert.match(await product.innerText(),/Y\[0,0\] = 2/);
  await product.getByRole('button',{name:'Inspect output row 1, column 1',exact:true}).click();
  assert.equal(await product.locator('button[aria-pressed="true"]').evaluate(e=>e===document.activeElement),true);
  await product.getByRole('button',{name:'Show all',exact:true}).click();
  assert.match(await product.innerText(),/Y\[1,1\] = 5/);await page.screenshot({path:resolve(out,'matmul-desktop.png'),fullPage:true});
  await page.goto(base+'/labs/gpu/lesson-3.html#tiling');
  const tile=page.locator('[data-gpu-lab="tiling"]');
  await tile.getByRole('button',{name:'Show all',exact:true}).click();assert.match(await tile.innerText(),/320 bytes versus 576/);await page.screenshot({path:resolve(out,'tiling-desktop.png'),fullPage:true});
  await tile.getByRole('combobox',{name:'Tile side (elements)',exact:true}).selectOption('4');await tile.getByRole('button',{name:'Show all',exact:true}).click();assert.match(await tile.innerText(),/192 bytes versus 576/);
  await goto('/labs/gpu/lesson-4.html#roofline');
  const roof=page.locator('[data-gpu-lab="roofline"]');assert.match(await roof.innerText(),/Model limit: bandwidth/);
  await roof.getByRole('combobox',{name:'Projection rows',exact:true}).selectOption('512');assert.match(await roof.innerText(),/Model limit: compute/);await page.screenshot({path:resolve(out,'roofline-desktop.png'),fullPage:true});
  await goto('/labs/gpu/lesson-5.html');
  const phase=page.locator('[data-gpu-lab="phases"]');assert.match(await phase.innerText(),/Decode projection: bandwidth/);
  await phase.getByRole('combobox',{name:'Active sequences',exact:true}).selectOption('512');assert.match(await phase.innerText(),/Decode projection: compute/);
  await phase.getByRole('combobox',{name:'Active sequences',exact:true}).selectOption('1');await phase.getByRole('combobox',{name:'Phase',exact:true}).selectOption('prefill');await phase.getByRole('combobox',{name:'Tokens per prefill chunk',exact:true}).selectOption('1');assert.match(await phase.innerText(),/Prefill projection: bandwidth/);
  await page.goto(base+'/labs/gpu/lesson-5.html#kv-traffic');
  const kv=page.locator('[data-gpu-lab="kv"]');assert.match(await kv.innerText(),/16,777,216/);
  await kv.getByRole('combobox',{name:'KV heads (32 query heads)',exact:true}).selectOption('32');assert.match(await kv.innerText(),/67,108,864/);
  await page.goto(base+'/labs/gpu/lesson-5.html#transfer');await page.getByRole('button',{name:'No; prediction still needs measurement',exact:true}).click();assert.match(await page.locator('[data-feedback]:visible').innerText(),/Yes/);
  // Keyboard symbol help and Escape; overview notation persists in a disclosure.
  await goto('/labs/gpu/');await page.getByText('Notation',{exact:true}).click();
  const symbol=page.locator('var[data-symbol="U"]:visible').first();await symbol.focus();assert.equal(await page.locator('.symbol-tip:visible').count(),1);await page.keyboard.press('Escape');assert.equal(await page.locator('.symbol-tip:visible').count(),0);
  // Last concept advances to the next lesson; final lesson returns to its overview.
  await goto('/labs/gpu/lesson-1.html#dependencies');await page.locator('[data-next]').click();await page.waitForURL('**/gpu/lesson-2.html*');
  await goto('/labs/gpu/lesson-5.html#transfer');await page.locator('[data-next]').click();await page.waitForURL('**/gpu/');
  // Existing module routes retain context and now include the same Module 3 hierarchy.
  for(const path of ['/labs/llm-systems/','/labs/math-fluency/lesson-1.html','/labs/inference/','/labs/attention/lesson-2.html','/labs/attention/architecture-explorer/']){
    await goto(path);assert.equal(await page.locator('nav[aria-label="Modules"] a[href*="/gpu/"]').count(),6);
    if(path.includes('attention/lesson'))assert.match(await page.locator('.course-header').innerText(),/Attention · Multi-head attention/);
  }
  report.interactions.push('progressive reveal, tail guards, resource changes, coalescing alignment/stride, exact matmul + retained focus, tile traffic, roofline crossover, phase counterexamples, KV payload, feedback, symbol keyboard/Escape, cross-lesson navigation, Modules 0–2 regression');
  await context.close();
  // Readable progressive fallback and all lesson links without scripts.
  const noJS=await browser.newContext({javaScriptEnabled:false,viewport:{width:390,height:844}}),staticPage=await noJS.newPage();
  await staticPage.goto(base+'/labs/gpu/');assert.equal(await staticPage.locator('.gpu-lesson-list a').count(),5);
  await staticPage.goto(base+'/labs/gpu/lesson-4.html');assert.equal(await staticPage.locator('main > section:visible').count(),3);assert.match(await staticPage.locator('.gpu-static').innerText(),/100 TFLOP/);
  await noJS.close();
  assert.deepEqual(report.errors,[]);
  report.status='pass';
}finally{
  await writeFile(resolve(out,'report.json'),JSON.stringify(report,null,2));await browser?.close();await new Promise(r=>server.close(r));
}
console.log(`${report.cases.length} responsive/theme/page cases passed; interaction and fallback checks passed. Evidence: ${out}`);
