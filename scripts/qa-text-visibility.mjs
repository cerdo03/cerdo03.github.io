// Geometry checks complement screenshots: SVG paint order, node bounds and clipped prose.
// Run from the repository root. Optional QA_BASE or QA_SITE_ROOT targets a prepared site.
import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { readFile, readdir, mkdir, writeFile } from 'node:fs/promises';
import { resolve, extname } from 'node:path';
import { createServer } from 'node:http';
import { guide } from '../labs/inference/guide-content.js';
import { lessons } from '../labs/scion/lessons.js';
import { OPTIONS } from '../labs/attention/architecture-explorer/model.js';
let server;
let base=process.env.QA_BASE;
const root=resolve(process.env.QA_SITE_ROOT||'.'),out=resolve(process.env.QA_OUTPUT||'/tmp/text-visibility-qa');
if(!base){
 const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.woff2':'font/woff2'};
 server=createServer(async(req,res)=>{
  try{
   const path=new URL(req.url,'http://localhost').pathname;
   if(path==='/favicon.ico'){res.writeHead(204);res.end();return;}
   const target=resolve(root,'.'+decodeURIComponent(path)+(path.endsWith('/')?'index.html':''));
   if(!target.startsWith(root+'/'))throw new Error('Invalid path');
   const data=await readFile(target);res.writeHead(200,{'Content-Type':mime[extname(target)]||'application/octet-stream'});res.end(data);
  }catch{res.writeHead(404);res.end('Not found');}
 });
 await new Promise(r=>server.listen(0,'127.0.0.1',r));base=`http://127.0.0.1:${server.address().port}`;
}
await mkdir(out,{recursive:true});
export function textGeometry(){
 const issues=[],visible=e=>e.checkVisibility({checkOpacity:true,checkVisibilityCSS:true})&&e.getClientRects().length;
 const intersects=(a,b)=>Math.max(0,Math.min(a.right,b.right)-Math.max(a.left,b.left))*Math.max(0,Math.min(a.bottom,b.bottom)-Math.max(a.top,b.top));
 const label=e=>e.textContent.trim().replace(/\s+/g,' ').slice(0,120);
 if(document.documentElement.scrollWidth>innerWidth+1)issues.push({kind:'page-overflow',text:`${document.documentElement.scrollWidth}px content in ${innerWidth}px viewport`});
 const sceneLabels=[...document.querySelectorAll('.scene-label')].filter(e=>visible(e)&&!e.hidden);
 for(let i=0;i<sceneLabels.length;i++)for(let j=i+1;j<sceneLabels.length;j++){
  const a=sceneLabels[i].getBoundingClientRect(),b=sceneLabels[j].getBoundingClientRect();
  if(intersects(a,b)>2)issues.push({kind:'scene-label-overlap',text:label(sceneLabels[i]),by:label(sceneLabels[j])});
 }
 const texts=[...document.querySelectorAll('svg text')].filter(e=>visible(e)&&label(e));
 for(let i=0;i<texts.length;i++)for(let j=i+1;j<texts.length;j++){
  if(texts[i].closest('svg')!==texts[j].closest('svg'))continue;
  const a=texts[i].getBoundingClientRect(),b=texts[j].getBoundingClientRect();
  const width=Math.min(a.right,b.right)-Math.max(a.left,b.left),height=Math.min(a.bottom,b.bottom)-Math.max(a.top,b.top);
  if(width>2&&height>Math.min(a.height,b.height)*.45)issues.push({kind:'text-overlap',text:label(texts[i]),by:label(texts[j])});
 }
 for(const text of document.querySelectorAll('svg text')){
  if(!visible(text)||!label(text))continue;
  const box=text.getBoundingClientRect(),svg=text.closest('svg'),frame=svg.getBoundingClientRect(),node=text.closest('.route-node'),own=node?.querySelector('rect');
  if(box.width<1||box.height<1)continue;
  if(box.left<frame.left-2||box.right>frame.right+2||box.top<frame.top-2||box.bottom>frame.bottom+2)issues.push({kind:'svg-clipping',text:label(text)});
  if(own){const rect=own.getBoundingClientRect();if(box.left<rect.left-1||box.right>rect.right+1||box.top<rect.top-1||box.bottom>rect.bottom+1)issues.push({kind:'node-overflow',text:label(text)});}
  for(const rect of svg.querySelectorAll('rect')){
   if(!visible(rect)||rect===own||node?.contains(rect)||!(text.compareDocumentPosition(rect)&Node.DOCUMENT_POSITION_FOLLOWING))continue;
   const style=getComputedStyle(rect);if(style.fill==='none'||style.fillOpacity==='0')continue;
   if(intersects(box,rect.getBoundingClientRect())>box.height*2)issues.push({kind:'covered-by-node',text:label(text),by:label(rect.closest('g')||rect)});
  }
 }
 const walker=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT);
 while(walker.nextNode()){
  const node=walker.currentNode,parent=node.parentElement;
  if(!node.textContent.trim()||!parent||parent.closest('svg, script, style, .katex-mathml, .sr-only, .visually-hidden')||!visible(parent))continue;
  const range=document.createRange();range.selectNodeContents(node);
  let scrollX=false,scrollY=false;
  for(let ancestor=parent;ancestor&&ancestor!==document.body;ancestor=ancestor.parentElement){
   const style=getComputedStyle(ancestor);
   scrollX ||= ['auto','scroll'].includes(style.overflowX);scrollY ||= ['auto','scroll'].includes(style.overflowY);
   const x=!scrollX&&['hidden','clip'].includes(style.overflowX),y=!scrollY&&['hidden','clip'].includes(style.overflowY);
   if(!x&&!y)continue;
   const frame=ancestor.getBoundingClientRect();
   if([...range.getClientRects()].some(box=>(x&&(box.left<frame.left-2||box.right>frame.right+2))||(y&&(box.top<frame.top-2||box.bottom>frame.bottom+2)))){
    issues.push({kind:'html-clipping',text:node.textContent.trim().slice(0,120),by:ancestor.id||ancestor.className});break;
   }
  }
 }
 return issues;
}
async function htmlFiles(directory){
 const result=[];
 for(const item of await readdir(directory,{withFileTypes:true})){
  if(item.name==='vendor')continue;
  const path=`${directory}/${item.name}`;
  if(item.isDirectory())result.push(...await htmlFiles(path));else if(item.name.endsWith('.html'))result.push(path);
 }
 return result;
}
const browser=await chromium.launch({channel:process.env.QA_BROWSER_CHANNEL||'chrome',headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const report={cases:[],issues:[],errors:[]};
try{
 const context=await browser.newContext({reducedMotion:'reduce'}),page=await context.newPage();
 page.on('pageerror',error=>report.errors.push({url:page.url(),message:error.message,stack:error.stack}));
 await context.route('https://gc.zgo.at/**',r=>r.fulfill({body:''}));
 async function inspect(name){
  await page.evaluate(async()=>{await document.fonts.ready;await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));});
  const issues=await page.evaluate(textGeometry);
  report.cases.push(name);if(issues.length)report.issues.push({name,issues});
 }
 async function prepare(route,width,theme){
  await page.setViewportSize({width,height:1000});await page.goto(base+route);
  await page.evaluate(t=>{document.documentElement.dataset.theme=t;document.querySelectorAll('main details, article details, #lesson details').forEach(e=>{e.open=true;});},theme);
  if(route.includes('architecture-explorer'))await page.waitForFunction(()=>/3D ready|3D unavailable/.test(document.querySelector('#renderer-status')?.textContent||''));
  await page.evaluate(()=>new Promise(requestAnimationFrame));
 }
 const widths=process.env.QA_WIDTHS?process.env.QA_WIDTHS.split(',').map(Number):process.env.QA_FAST?[1440]:[320,768,1440],themes=process.env.QA_FAST?['midnight']:['paper','midnight','contrast'];
 if(!process.env.QA_VISUALS_ONLY&&!process.env.QA_ARCHITECTURE_ONLY)for(const width of widths)for(const theme of themes){
  for(const file of ['index.html',...await htmlFiles('journal'),...await htmlFiles('labs')]){
   await prepare('/'+file,width,theme);await inspect(`${file}/${width}/${theme}`);
   const sections=await page.locator('main > section[id]').evaluateAll(nodes=>nodes.some(e=>e.hidden)?nodes.map(e=>e.id):[]);
   for(const id of sections){
    await page.goto(`${base}/${file}#${id}`);
    await page.evaluate(()=>document.querySelectorAll('main details').forEach(e=>{e.open=true;}));
    await inspect(`${file}#${id}/${width}/${theme}`);
    const widgets=page.locator('main .teaching-visual:visible');
    for(let widget=0;widget<await widgets.count();widget++){
     const root=widgets.nth(widget),all=root.locator('[data-studio-all]');
     if(await all.count()&&await all.first().textContent()==='Show all'){await all.first().click();await inspect(`${file}#${id}/widget${widget}/all/${width}/${theme}`);}
     for(let stage=0;stage<6;stage++){
      const next=root.locator('[data-command="next"]:not(:disabled)').first();if(!await next.count())break;
      await next.click();await inspect(`${file}#${id}/widget${widget}/${stage}/${width}/${theme}`);
     }
    }
   }
  }
  for(const item of guide){
   await prepare(`/labs/inference/#${item.id}`,width,theme);
   for(let stage=0;stage<24;stage++){
    await inspect(`inference/${item.id}/${stage}/${width}/${theme}`);
    const next=page.locator('#scene [data-command="next"]:not(:disabled), #scene [data-route-next]:not(:disabled)').first();
    if(!await next.count())break;await next.click();
   }
  }
  for(const item of lessons){
   await prepare(`/labs/scion/#${item.id}`,width,theme);
   for(let stage=0;stage<8;stage++){
    await inspect(`scion/${item.id}/${stage}/${width}/${theme}`);
    const next=page.locator('#next-frame:not(:disabled)');if(!await next.count())break;await next.click();
   }
  }
  console.log(`Page sections ${width}/${theme}: ${report.cases.length} states, ${report.issues.length} states with findings`);
 }
 if(!process.env.QA_VISUALS_ONLY)for(const width of widths)for(const theme of themes){
  await prepare('/labs/attention/architecture-explorer/',width,theme);
  for(const expanded of [false,true]){
   if(expanded){await page.locator('#expand-explorer').click();if(width<=800)await page.locator('#component-tools > summary').click();}
   for(const count of (process.env.QA_HEADS?process.env.QA_HEADS.split(','):OPTIONS.qHeads.map(String))){
    if(expanded&&width<=800&&await page.locator('#model-settings').evaluate(e=>!e.open))await page.locator('#model-settings > summary').click();
    await page.selectOption('#query-heads',count);
    for(const view of ['overview','block','attention','heads','qkv','ffn']){
     await page.locator(`.view-shortcuts [data-view="${view}"]`).click();await page.evaluate(()=>new Promise(requestAnimationFrame));
     await inspect(`architecture/${count}/${view}/${expanded?'expanded':'normal'}/${width}/${theme}`);
    }
   }
  }
  console.log(`Architecture ${width}/${theme}: ${report.cases.length} states, ${report.issues.length} states with findings`);
 }
 console.log(`Pages and 3D checks: ${report.cases.length} states, ${report.issues.length} states with findings`);
 // All generated stages plus architecture switches, later decode passes and inspections.
 if(!process.env.QA_ARCHITECTURE_ONLY)for(const width of widths)for(const theme of themes){
  await prepare('/',width,theme);
  await page.addStyleTag({url:base+'/labs/llm-systems/course.css'});
  await page.evaluate(()=>document.body.classList.add('llm-course'));
  for(const type of ['heads','request','sharing','prediction','validity','prefix','projections','scores','values']){
   const variants=type==='sharing'?[{kvHeads:1},{kvHeads:2},{kvHeads:4}]:type==='request'?[{pass:0},{pass:1},{pass:2},{pass:4,prompt:['The','sky','is','blue'],answer:['and','the','sun','shines','.']}]:['projections','scores','values'].includes(type)?[{inspect:true}]:[{}];
   for(const variant of variants)for(let stage=0;stage<=5;stage++){
    const rendered=await page.evaluate(async({type,stage,variant})=>{
     const {visualView}=await import('/labs/llm-systems/learning-visuals.js');
     const state={stage,position:2,component:0,role:'Q',key:2,pass:0,query:2,kvHeads:2,head:0,candidate:0,change:2,...variant};
     const max=visualView(type,{...state,stage:0},undefined,variant).max;
     if(stage>(max||(['projections','scores','values'].includes(type)?4:0)))return false;
     let root=document.getElementById('geometry-audit');
     if(!root){document.body.innerHTML='<main class="teaching-visual" id="geometry-audit"></main>';root=document.getElementById('geometry-audit');}
     root.innerHTML=visualView(type,state,undefined,variant).graph;return true;
    },{type,stage,variant});
    if(rendered){await inspect(`visual/${type}/${JSON.stringify(variant)}/${stage}/${width}/${theme}`);
     if(type==='heads'&&stage===2)await page.screenshot({path:resolve(out,`head-split-${width}-${theme}.png`)});
    }
   }
  }
 }
 console.log(`${report.cases.length} states checked; ${report.issues.length} states with geometry issues; ${report.errors.length} page errors`);
 assert.deepEqual(report.issues,[],'text must stay inside its container and clear of later diagram nodes');
 assert.deepEqual(report.errors,[]);
 report.result='PASS';
}finally{await writeFile(resolve(out,'report.json'),JSON.stringify(report,null,2));await browser.close();if(server)await new Promise(r=>server.close(r));}
