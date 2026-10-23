import {chapters,sectorFrame,tileFrame} from './motion-model.js';
import {sectorModel,tileTraffic,toyLeft,toyRight} from './model.js';
const el=id=>document.getElementById(id);
const reduced=matchMedia('(prefers-reduced-motion: reduce)');
let chapter=location.hash==='#tiling'?1:0,index=0,mode='slides',auto=false,timer=0,raf=0,transition=false,generation=0;
const ease=x=>{const t=Math.max(0,Math.min(1,x));return t*t*(3-2*t);};
function sectorsMarkup(frame,newSectors=[]){
 return `<div class="sector-grid${frame.sectors.length>8?' sparse':''}">${frame.sectors.map(sector=>{
  const lanes=frame.lanes.filter(lane=>lane.sector===sector);
  const fresh=newSectors.includes(sector)?' data-reveal':'';
  if(frame.sectors.length>8)return `<div class="sector-box"><strong>Sector ${sector}</strong><i class="request-link"${fresh?' data-link':''} aria-hidden="true"></i><div${fresh}>${lanes.map(lane=>`<div>Lane ${lane.lane}<br>Byte ${lane.address}</div>`).join('')}</div></div>`;
  return `<div class="sector-box"><strong>Sector ${sector}</strong><small>Bytes ${sector*32}–${sector*32+31}</small><i class="request-link"${fresh?' data-link':''} aria-hidden="true"></i><div class="lane-values"${fresh}>${lanes.map(lane=>`<span><small>Lane ${lane.lane}</small>${lane.address}</span>`).join('')}</div><small>${lanes.length*4} useful / 32 sector bytes</small></div>`;
 }).join('')}</div>`;
}
function sectorScene(){
 const f=sectorFrame(index),old=sectorFrame(Math.max(0,index-1));
 const fresh=index<=4?f.sectors.filter(s=>!old.sectors.includes(s)):index===5?[]:f.sectors;
 return `<p>Stride ${f.stride} element${f.stride===1?'':'s'} · first byte ${f.offset} · address labels in bytes</p>${index===0?'<div class="motion-metric">32 lanes → byte addresses → aligned sectors<br>Next reveals eight requests at a time. One warp instruction is being explained.</div>':sectorsMarkup(f,fresh)}<p class="motion-metric" data-reveal>${f.lanes.length} lanes shown · ${f.sectors.length} sectors${index>=5?` × 32 = <strong>${f.bytes} sector bytes</strong> · ${f.usefulBytes} useful bytes`:" · byte accounting follows after all requests"}</p>${index>=6?'<p>Aligned stride 1 baseline: 4 sectors / 128 sector bytes / 128 useful bytes.</p>':''}`;
}
function matrix(values,selected=[],output=false){return `<div class="matrix${output?' output':''}">${values.flatMap((row,r)=>row.map((v,c)=>`<span class="${selected.some(([a,b])=>a===r&&b===c)?'selected':''}">${v}</span>`)).join('')}</div>`;}
function tileScene(){
 const f=tileFrame(index),start=f.tile*2;
 const l=toyLeft.slice(0,2).map(row=>row.slice(start,start+2)),r=toyRight.slice(start,start+2).map(row=>row.slice(0,2));
 const leftSelection=f.leftLoaded?[[0,start],[0,start+1],[1,start],[1,start+1]]:[];
 const rightSelection=f.rightLoaded?[[start,0],[start,1],[start+1,0],[start+1,1]]:[];
 const prev=tileFrame(Math.max(0,index-1));
 const products=f.inner===null?'':`<div class="products">${f.sums.flatMap((row,i)=>row.map((value,j)=>`<p><strong>Output [${i},${j}]</strong><br>${prev.sums[i][j]} + ${toyLeft[i][f.inner]} × ${toyRight[f.inner][j]} → <strong data-reveal>${value}</strong></p>`)).join('')}</div>`;
 return `<p>Selected output: rows 0–1, columns 0–1 · inner positions ${start}–${start+1} · outlined cells feed this tile</p><div class="tile-layout"><div class="tile-panel"><h3>Input matrix · 4×4</h3>${matrix(toyLeft,leftSelection)}<div class="tile-stage"><i class="request-link"${index===1||index===7?' data-link':''} aria-hidden="true"></i><p>↓ Staged input · shared memory</p><div${index===1||index===7?' data-reveal':''}>${f.leftLoaded?matrix(l,[],true):'<p>Not loaded yet</p>'}</div></div></div><div class="tile-panel"><h3>Weights · 4×4</h3>${matrix(toyRight,rightSelection)}<div class="tile-stage"><i class="request-link"${index===2||index===8?' data-link':''} aria-hidden="true"></i><p>↓ Staged weights · shared memory</p><div${index===2||index===8?' data-reveal':''}>${f.rightLoaded?matrix(r,[],true):`<p class="spent">${f.tile?'Old tile spent; replacement not loaded':'Not loaded yet'}</p>`}</div></div></div><div class="tile-panel"><h3>Running sums · registers</h3><i class="request-link"${f.inner!==null||index===12?' data-link':''} aria-hidden="true"></i><div${f.inner!==null?' data-reveal':''}>${matrix(f.sums,[],true)}</div><p>${f.stored?'Global output patch stored ↓':'Partial sums; global outputs not stored yet'}</p>${f.stored?`<div${index===12?' data-reveal':''}>${matrix(f.sums,[],true)}</div>`:''}<p>${f.loads} logical operand loads for this patch</p></div></div><p class="motion-metric"${[3,6,9,13].includes(index)?' data-reveal':''}>${index===6?'Reuse barrier reached · safe to overwrite the old operands':f.ready?'Load barrier reached · both tiles available to consumers':'Load barrier pending · do not consume these tiles yet'}</p>${products}${index===13?`<p class="motion-metric" data-reveal>Whole 4×4 output: tiled ${f.tiled.loads} loads + 16 stores = ${f.tiled.bytes} bytes; independent dots ${f.naive.loads} loads + 16 stores = ${f.naive.bytes} bytes. Both: ${f.tiled.flops} FLOPs.</p>`:''}`;
}
function paint(progress){
 for(const node of el('scene').querySelectorAll('[data-link]'))node.style.transform=`scaleX(${ease(progress/.6)})`;
 for(const node of el('scene').querySelectorAll('[data-reveal]'))node.style.opacity=String(ease((progress-.6)/.4));
 el('scene').dataset.progress=String(progress);
}
function render(){
 const ch=chapters[chapter],step=ch.steps[index];
 el('chapter').value=String(chapter);el('chapter-title').textContent=ch.title;
 el('step-title').textContent=step.title;el('caption').textContent=step.text;
 el('position').textContent=`Step ${index+1} of ${ch.steps.length}`;
 el('back').disabled=index===0;el('next').disabled=index===ch.steps.length-1;
 el('return-lesson').href=ch.lesson;el('return-lesson').textContent=chapter?'Return to tiling lesson →':'Return to memory lesson →';
 el('scene').innerHTML=chapter?tileScene():sectorScene();
 el('scene').dataset.step=String(index);el('scene').dataset.chapter=String(chapter);
 el('scene').dataset.settled=String(!transition);paint(transition?0:1);
}
function schedule(){
 clearTimeout(timer);
 if(auto&&!transition&&mode==='slides'&&!document.hidden&&index<chapters[chapter].steps.length-1)timer=setTimeout(()=>navigate(index+1),5000);
}
function setAuto(enabled){auto=enabled&&index<chapters[chapter].steps.length-1;el('auto').checked=auto;schedule();}
function settle(){
 generation++;cancelAnimationFrame(raf);transition=false;paint(1);el('scene').dataset.settled='true';
 if(index===chapters[chapter].steps.length-1){auto=false;el('auto').checked=false;}
 schedule();
}
function navigate(target,animate=true){
 clearTimeout(timer);cancelAnimationFrame(raf);const old=index;index=Math.max(0,Math.min(chapters[chapter].steps.length-1,target));
 transition=animate&&index>old&&!reduced.matches;
 const token=++generation;render();
 if(!transition){settle();return;}
 let start;
 const frame=now=>{
  if(token!==generation)return;
  start??=now;const progress=Math.min(1,(now-start)/1500);paint(progress);
  if(progress<1)raf=requestAnimationFrame(frame);else settle();
 };
 raf=requestAnimationFrame(frame);
}
function keepVisible(){if(matchMedia('(max-width: 900px)').matches)el('scene-card').scrollIntoView({block:'start'});}
function manual(delta){navigate(index+delta);keepVisible();}
function showMode(value){
 mode=value;if(mode!=='slides')setAuto(false);settle();
 for(const button of document.querySelectorAll('[data-mode]'))button.setAttribute('aria-pressed',String(button.dataset.mode===mode));
 for(const name of ['slides','explore','read'])el(`${name}-panel`).hidden=name!==mode;
}
el('back').addEventListener('click',()=>manual(-1));el('next').addEventListener('click',()=>manual(1));
el('restart').addEventListener('click',()=>{navigate(0,false);keepVisible();});
el('auto').addEventListener('change',event=>setAuto(event.target.checked));
el('chapter').addEventListener('change',event=>{chapter=Number(event.target.value);index=0;location.hash=chapters[chapter].id;showMode('slides');navigate(0,false);});
window.addEventListener('hashchange',()=>{const next=location.hash==='#tiling'?1:0;if(next!==chapter){chapter=next;index=0;showMode('slides');navigate(0,false);}});
for(const button of document.querySelectorAll('[data-mode]'))button.addEventListener('click',()=>showMode(button.dataset.mode));
document.addEventListener('keydown',event=>{
 if(mode!=='slides'||event.target.closest('input,select,textarea,button,a,summary')||event.altKey||event.ctrlKey||event.metaKey)return;
 if(['ArrowLeft','ArrowRight','Home'].includes(event.key))event.preventDefault();
 if(event.key==='ArrowLeft')manual(-1);if(event.key==='ArrowRight')manual(1);if(event.key==='Home'){navigate(0,false);keepVisible();}
});
document.addEventListener('visibilitychange',()=>{if(document.hidden){setAuto(false);settle();}});
reduced.addEventListener('change',settle);
function explore(){
 const stride=Number(el('stride').value),offset=Number(el('offset').value),f=sectorModel(stride,offset);
 el('sector-result').textContent=`${f.sectors.length} sectors × 32 = ${f.bytes} sector bytes for ${f.usefulBytes} useful bytes (${(100*f.usefulBytes/f.bytes).toFixed(1)}% useful). ${stride===1&&offset===0?'Aligned neighboring requests share every touched sector fully.':'Compared with the aligned stride 1 baseline of 128 sector bytes, addresses span more sectors.'} No runtime prediction.`;
 el('sector-experiment').innerHTML=sectorsMarkup({...f,lanes:f.addresses.map((address,lane)=>({lane,address,sector:Math.floor(address/32)}))});
 const side=Number(el('tile-size').value),traffic=tileTraffic(4,4,4,side,4);
 el('tile-result').textContent=`Tile side ${side}: ${traffic.loads} operand loads + 16 stores = ${traffic.bytes} logical global bytes. ${traffic.flops} FLOPs, unchanged. Two shared operand tiles need ${traffic.sharedBytes} bytes under this staging algorithm. This excludes registers and padding; actual traffic and performance require measurement.`;
}
for(const id of ['stride','offset','tile-size'])el(id).addEventListener('change',explore);
explore();render();
