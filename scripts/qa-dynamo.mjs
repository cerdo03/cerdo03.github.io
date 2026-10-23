import assert from 'node:assert/strict';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {createServer} from 'node:http';
import {resolve,extname} from 'node:path';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=resolve(process.env.QA_SITE_ROOT||'.'),out=resolve(process.env.QA_OUTPUT||'/tmp/dynamo-qa');
let server;let base=process.env.QA_BASE;
if(!base){
 const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.woff2':'font/woff2'};
 server=createServer(async(req,res)=>{try{const path=new URL(req.url,'http://localhost').pathname;const target=resolve(root,'.'+decodeURIComponent(path)+(path.endsWith('/')?'index.html':''));if(!target.startsWith(root+'/'))throw Error('Invalid path');const data=await readFile(target);res.writeHead(200,{'Content-Type':mime[extname(target)]||'application/octet-stream'});res.end(data);}catch{res.writeHead(404);res.end('Not found');}});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));base=`http://127.0.0.1:${server.address().port}`;
}
await mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true,...(process.env.QA_CHANNEL?{channel:process.env.QA_CHANNEL}:{})});
const errors=[];let states=0,actions=0;
try{
 for(const width of [360,390,1440]){
  const page=await browser.newPage({viewport:{width,height:1000}});page.on('pageerror',error=>errors.push(error.message));
  await page.goto(`${base}/labs/dynamo/`);
  async function selectLesson(index) {
   if (!await page.locator('#contents').evaluate(element => element.open)) await page.locator('#contents summary').click();
   await page.locator('#lessons-nav button').nth(index).click();
  }
  for(const theme of ['paper','midnight','contrast']){
   await page.evaluate(theme=>document.documentElement.dataset.theme=theme,theme);
   for(let index=0;index<12;index++){
    await selectLesson(index);
    assert.match(await page.locator('#lesson h1').textContent(),new RegExp(`^${index+1}\\.`));
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,`${width}/${theme}/${index}`);
    const buttons=page.locator('#lesson button');
    for(let i=0;i<await buttons.count();i++)if(await buttons.nth(i).isEnabled()){await buttons.nth(i).click();actions++;}
    if(index===4){await page.locator('#reset').click();for(let i=0;i<4;i++)await page.locator('#next').click();assert.equal(await page.locator('#version-graph [data-edge]').count(),5);}
    states++;
   }
  }
  await selectLesson(3);
  await page.getByLabel('Unreachable trailing hosts').selectOption('3');await page.getByRole('button',{name:'Show full request trace'}).click();assert.match(await page.locator('[data-request-events]').textContent(),/Deadline reached/);
  await page.getByLabel('Operation').selectOption('read');await page.getByRole('button',{name:'Show full request trace'}).click();assert.match(await page.locator('[data-request-events]').textContent(),/Read times out/);
  await selectLesson(1);await page.getByRole('button',{name:'Write edited cart with carried context'}).click();assert.match(await page.locator('#lesson pre').textContent(),/Visible versions: 2/);
  await selectLesson(5);await page.getByRole('button',{name:'Lose fallback before delivery'}).click();await page.getByRole('button',{name:'Recover A and confirm transfer'}).click();assert.match(await page.locator('#lesson pre').textContent(),/No surviving hint/);
  await selectLesson(11);for(let i=0;i<8;i++)await page.getByRole('button',{name:'Next event',exact:true}).click();assert.match(await page.locator('.replica-grid').textContent(),/Inspect host X/);assert.match(await page.locator('.replica-grid').textContent(),/book, pen/);
  await selectLesson(3);const symbol=page.locator('[data-dynamo-symbol]').first();await symbol.focus();assert.equal(await page.locator('.symbol-help').isVisible(),true);await page.keyboard.press('Escape');assert.equal(await page.locator('.symbol-help').isVisible(),false);
  await page.screenshot({path:resolve(out,`request-${width}.png`),fullPage:true});
  await page.close();
 }
 assert.deepEqual(errors,[]);await writeFile(resolve(out,'results.json'),JSON.stringify({states,actions,errors},null,2));console.log(JSON.stringify({states,actions,errors}));
}finally{await browser.close();if(server)await new Promise(resolve=>server.close(resolve));}
