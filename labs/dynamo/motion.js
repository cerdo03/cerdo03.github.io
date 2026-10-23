import { chapters, clockHistory, motionGlossary } from './motion-content.js';
import { buildSteps, clampStep, chapterStart, replicaExperiment, reconcileCart } from './motion-model.js';
const el=id=>document.getElementById(id);
const compact=matchMedia('(max-width: 540px)');
const reduced=matchMedia('(prefers-reduced-motion: reduce)');
let level=1,steps=buildSteps(level),index=0,progress=1,transition=null,raf=0;
let transcriptKey='';
let autoAdvance=false,autoTimer=0;
const glyph={
 cart:'<svg viewBox="0 0 40 34" aria-hidden="true"><path d="M2 3h6l5 20h19l5-15H10M15 27a2 2 0 1 0 0 4 2 2 0 0 0 0-4M30 27a2 2 0 1 0 0 4 2 2 0 0 0 0-4"/></svg>',
 server:'<svg viewBox="0 0 40 34" aria-hidden="true"><rect x="5" y="2" width="30" height="12" rx="3"/><rect x="5" y="20" width="30" height="12" rx="3"/><path d="M11 8h2m3 0h2m-7 18h2m3 0h2m9-18h3m-3 18h3"/></svg>'
};
const items=values=>values.map(value=>`<span class="item item-${value}">${value}</span>`).join('');
const ease=value=>{const t=Math.max(0,Math.min(1,value));return t*t*(3-2*t);};
const clockText=clock=>['Sx','Sy','Sz'].map(key=>`${key}: ${clock[key]??0}`).join(' · ');
const clockMarkup=clock=>['Sx','Sy','Sz'].map(key=>`<span class="symbol-label" data-help="${key}">${key}</span>: ${clock[key]??0}`).join(' · ');
function card({id,title,kicker,status,values=null,current=false,stored=false,unreachable=false,clock=null,icon='server',reveal=false,emerge=false},position,transition){
 const result=ease((transition-.6)/.4);
 return `<div class="node${current?' current':''}${stored?' stored':''}${unreachable?' unreachable':''}${id==='base'?' root':''}${id==='final'?' final':''}" data-node="${id}" style="${emerge?`opacity:${result}`:''}"><div class="node-kicker"><span>${kicker}</span><span class="node-mark" aria-hidden="true">${unreachable?'×':stored?'✓':'·'}</span></div><div class="node-icon">${glyph[icon]}</div><h3>${title}</h3>${values===null?'':`<div class="node-result" style="${reveal?`opacity:${result}`:''}">${values.length?items(values):'<p>empty cart</p>'}</div>`}${status?`<p class="node-status">${status}</p>`:''}${clock?`<p class="node-clock">${clockMarkup(clock)}</p>`:''}</div>`;
}
function connection(from,to,kind='known',progress=1,label='',fromId='',toId=''){
 progress=ease(progress/.6);
 const x1=from[0]*10,y1=from[1]*5,x2=to[0]*10,y2=to[1]*5;
 const path=`M${x1},${y1} C${x1+(x2-x1)*.5},${y1} ${x1+(x2-x1)*.5},${y2} ${x2},${y2}`;
 return {wire:`<path data-from="${fromId}" data-to="${toId}" d="${path}" class="${kind}" pathLength="1" style="${kind==='active'?`stroke-dasharray:1;stroke-dashoffset:${(1-progress).toFixed(3)}`:''}"/>`,label:label?`<span class="path-label" data-from="${fromId}" data-to="${toId}" style="left:${(from[0]+to[0])/2}%;top:${(from[1]+to[1])/2}%">${label}</span>`:''};
}
function networkScene(chapter,beat,transition){
 const frame=beat.frame;
 const pos=compact.matches?{client:[24,43],A:[74,15],B:[74,43],C:[74,72],D:[24,72]}:{client:[13,46],A:[47,21],B:[81,46],C:[47,65],D:[81,80]};
 const nodes={client:{id:'client',title:'Customer cart',kicker:'One object',status:'Before the change',values:[],icon:'cart'},A:{id:'A',title:'Host A',kicker:'Home replica',status:'Waiting for request'},B:{id:'B',title:'Host B',kicker:'Home replica',status:'No new copy yet'},C:{id:'C',title:'Host C',kicker:'Home replica',status:'No new copy yet'}};
 const wires=[];let summary='',sub='',meaning='One object · three distinct physical hosts';
 const link=(a,b,kind,progress,label)=>wires.push(connection(pos[a],pos[b],kind,progress,label,a,b));
 const store=(id,values=['book'],reveal=false)=>Object.assign(nodes[id],{values,stored:true,status:'New value stored',reveal});
 if(chapter===0){
  if(frame>=1){nodes.client.values=['book'];nodes.client.current=true;nodes.client.reveal=frame===1;nodes.client.status='New object value';}
  if(frame>=2){link('client','A','active',transition,'put cart + context');nodes.A.current=true;nodes.A.status='Request arrives';}
  if(frame>=3){store('A',['book'],true);nodes.A.kicker='Coordinator / home';nodes.A.current=true;summary='First: coordinate one request';sub='Copies and replies come next.';}
 }else if(chapter===1){
  nodes.client.values=['book'];nodes.client.status=frame===3?'Success received':'Waiting for completion';store('A');nodes.A.kicker='Coordinator / home';
  link('client','A',frame===3?'done':'known',1,frame===3?'success':'request');
  link('A','B',frame===1?'active':frame>=2?'done':'known',frame===1?transition:1,frame>=2?'':'copy');
  link('A','C','known',1,'copy pending');
  if(frame>=1)store('B',['book'],frame===1);
  if(frame>=2){link('B','A','active',frame===2?transition:1,'acknowledgement');nodes.A.current=true;}
  if(frame===3){nodes.client.current=true;link('A','client','active',transition,'success');}
  nodes.B.status=frame===1?'Stored; reply not yet received':frame>=2?'Reply received at coordinator':'Waiting for copy';
  nodes.C.status='Third copy still pending';summary=frame<2?'1 confirmed host':'2 confirmed hosts';sub=frame<2?'Local write at A counts once.':'A + B meet the write threshold of two.';
 }else if(chapter===2){
  nodes.client.values=['book'];nodes.client.status=frame===1?'Success with two required':frame>=2?'Three required: no success':'Waiting for replies';store('A');store('B');nodes.A.kicker='Coordinator / home';
  Object.assign(nodes.C,{unreachable:true,status:'Unreachable · no reply',values:null});
  link('client','A','known',1);link('A','B','done',1,'two copies available');link('A','C','broken',1,'no reply');
  if(frame===1)link('A','client','active',transition,'success with two');
  summary=frame<2?'2 replies can be enough':frame===2?'3 replies cannot arrive':'Timeout ≠ no stored update';
  sub=frame<2?'Keep failure separate from the threshold.':'A and B can still hold the new value.';
  meaning=frame>=2?'Comparison: require three instead of two':'Same targets · different completion requirement';
 }else if(chapter===3){
  nodes.client.values=['book'];nodes.client.status='A new write with C unreachable';store('A');nodes.A.kicker='Coordinator / home';nodes.C.unreachable=true;nodes.C.status='Intended home unreachable';
  nodes.D={id:'D',title:'Host D',kicker:'Fallback candidate',status:'Temporary destination',current:true};
  link('client','A','known',1);link('A','C','broken',1,'home unreachable');link('A','B',frame>=2?'done':'known',1,'another target');
  if(frame>=1)link('A','D','active',frame===1?transition:1,'copy + hint for C');
  if(frame>=2){store('D');store('B');nodes.D.kicker='Fallback / hint → C';nodes.D.status='Temporary hinted copy';}
  if(frame===0)delete nodes.D;
  summary=frame>=2?'Temporary home. Same intended destination.':'Reachable candidates can participate';sub=frame>=2?'Homes A · B · C / targets A · B · D':'The preference list includes failure candidates.';
  meaning='New teaching moment · one unreachable home';
 }else{
  nodes.client.values=['pen'];nodes.client.status='Application has reconciled the cart';store('A',['pen']);nodes.A.kicker='Coordinator / home';
  Object.assign(nodes.B,{values:frame>=2?['pen']:['book'],stored:true,status:frame>=2?'Read repair updated ancestor':'Stale ancestor remains'});
  Object.assign(nodes.C,{values:frame>=1?['pen']:['book'],stored:true,status:frame>=1?'Hinted copy delivered':'Reachable again · old cart',current:frame===1,reveal:frame===1});
  nodes.D={id:'D',title:'Host D',kicker:'Fallback / hint → C',values:frame===0?['pen']:null,status:frame===0?'Temporary hinted copy':'Transfer confirmed; hint removed',stored:frame===0};
  link('client','A','known',1);if(frame>=1)link('D','C',frame===1?'active':'done',frame===1?transition:1,'hinted handoff');
  if(frame>=2)link('A','B',frame===2?'active':'done',frame===2?transition:1,'read repair');
  if(frame>=3)link('B','C','active',transition,'background comparison');
  summary=['Recovery opens a delivery path','Handoff returns the temporary copy','Read repair follows a read','Three different repair jobs'][frame];
  sub=frame===3?'Background comparison is shown schematically.':'Only stale ancestors can be discarded automatically.';
  meaning='Later teaching moment · reconciled cart contains pen';
 }
 const svg=`<svg class="wires" viewBox="0 0 1000 500" preserveAspectRatio="none" aria-hidden="true">${wires.map(wire=>wire.wire).join('')}</svg>`;
 const labels=wires.map(wire=>wire.label).join('');
 const markup=svg+labels+Object.values(nodes).map(node=>card(node,pos[node.id],transition)).join('')+(summary?`<div class="scene-callout" style="opacity:${ease((transition-.6)/.4)}"><strong>${summary}</strong><p>${sub}</p></div>`:'');
 const description=Object.values(nodes).map(node=>`${node.title}: ${node.values===null||node.values===undefined?node.status:node.values.join(' and ')||'empty cart'}. ${node.status}`).join(' ');
 return {markup,meaning,description};
}
function historyScene(chapter,beat,transition){
 const frame=beat.frame,math=level>=3,coordinates=compact.matches?{base:[50,14],left:[25,46],right:[75,46],final:[50,76]}:{base:[50,18],left:[21,48],right:[79,48],final:[50,77]};
 const reconciles=chapter===6;
 const showLeft=reconciles||frame>=1,showRight=reconciles||frame>=2,showFinal=reconciles&&frame>=1;
 const cards=[{id:'base',title:'Shared earlier cart',kicker:math?'D2 / common ancestor':'Common starting point',values:['book'],status:math?'D1 [1,0,0] → D2 [2,0,0]':'Neither edit has happened yet',clock:null,icon:'cart',stored:true}];
 const wires=[];
 if(showLeft){cards.push({id:'left',title:'Add a pen',kicker:'D3 / one history',icon:'cart',values:['book','pen'],status:'Includes the base; not D4',clock:math?clockHistory[2].clock:null,stored:true,current:!reconciles&&frame===1,emerge:!reconciles&&frame===1});wires.push(connection(coordinates.base,coordinates.left,'active',!reconciles&&frame===1?transition:1,'builds on D2','base','left'));}
 if(showRight){cards.push({id:'right',title:'Remove the book',kicker:'D4 / another history',icon:'cart',values:[],status:'Includes the base; not D3',clock:math?clockHistory[3].clock:null,stored:true,current:!reconciles&&frame===2,emerge:!reconciles&&frame===2});wires.push(connection(coordinates.base,coordinates.right,'active',!reconciles&&frame===2?transition:1,'builds on D2','base','right'));}
 if(showFinal){
  const values=frame===1?['book','pen']:['pen'];
  cards.push({id:'final',title:frame===1?'Union snapshots':frame===2?'Apply known edits':'Reconciled cart',kicker:frame===3?'D5 / new write':'Application policy',values,status:frame===1?'Book is resurrected':frame===2?'Base + intentions supplied':'Context includes both branches',clock:math&&frame===3?clockHistory[4].clock:null,icon:'cart',current:true,emerge:true});
  wires.push(connection(coordinates.left,coordinates.final,'active',transition,'','left','final'),connection(coordinates.right,coordinates.final,'active',transition,'','right','final'));
 }
 let summary=frame>=3?'Two histories. Neither includes the other.':'One common base, then independent edits.';
 let sub=math&&frame>=2?'D3: [2,1,0] / D4: [2,0,1] · compare every component':'Clocks describe history; the application decides meaning.';
 if(reconciles){summary=['Return both siblings','Union brings the removed book back','Known edits can leave only pen','New value. Both histories included.'][frame];sub=frame===2?'Requires common base + explicit edit intentions.':'The version clock does not choose the policy.';}
 return {markup:`<svg class="wires" viewBox="0 0 1000 500" preserveAspectRatio="none" aria-hidden="true">${wires.map(w=>w.wire).join('')}</svg>${wires.map(w=>w.label).join('')}${cards.map(node=>card(node,coordinates[node.id],transition)).join('')}<div class="scene-callout" style="opacity:${ease((transition-.6)/.4)}"><strong>${summary}</strong><p>${sub}</p></div>`,meaning:math?'Figure 3 clocks · invented cart contents':'History branches · versions are not physical hosts',description:cards.map(node=>`${node.title}: ${node.values.join(' and ')||'empty cart'}. ${node.status}. ${node.clock?clockText(node.clock):''}`).join(' ')};
}
function layoutWires(){
 const scene=el('scene'),bounds=scene.getBoundingClientRect();
 if(!bounds.width||!bounds.height)return;
 for(const part of scene.querySelectorAll('[data-from]')){
  const from=scene.querySelector(`[data-node="${part.dataset.from}"]`),to=scene.querySelector(`[data-node="${part.dataset.to}"]`);
  if(!from||!to)continue;
  const a=from.getBoundingClientRect(),b=to.getBoundingClientRect();
  const x1=((a.left+a.width/2-bounds.left)/bounds.width)*1000,y1=((a.top+a.height/2-bounds.top)/bounds.height)*500;
  const x2=((b.left+b.width/2-bounds.left)/bounds.width)*1000,y2=((b.top+b.height/2-bounds.top)/bounds.height)*500;
  if(part.tagName.toLowerCase()==='path'){
   const middle=(x1+x2)/2;
   part.setAttribute('d',`M${x1.toFixed(2)},${y1.toFixed(2)} C${middle.toFixed(2)},${y1.toFixed(2)} ${middle.toFixed(2)},${y2.toFixed(2)} ${x2.toFixed(2)},${y2.toFixed(2)}`);
  }else{part.style.left=`${(x1+x2)/20}%`;part.style.top=`${(y1+y2)/10}%`;}
 }
}
function render(){
 const beat=steps[index],chapter=chapters[beat.chapter];
 const visualBeat=transition?.reverse?steps[transition.from]:beat,visualChapter=chapters[visualBeat.chapter];
 const result=visualChapter.kind==='history'?historyScene(visualBeat.chapter,visualBeat,progress):networkScene(visualBeat.chapter,visualBeat,progress);
 el('scene').classList.toggle('history-scene',visualChapter.kind==='history');el('scene').innerHTML=result.markup;layoutWires();
 el('scene').dataset.frame=`${beat.chapter}-${beat.id}`;el('scene').dataset.transition=String(progress);el('scene').dataset.settled=String(!transition);el('scene').setAttribute('aria-label',result.description);
 el('scene-meaning').textContent=result.meaning;el('beat-title').textContent=beat.title;el('caption').textContent=beat.text;
 el('part').textContent=chapter.part;el('scene-counter').textContent=`Chapter ${beat.chapter+1} / 8`;
 el('beat-number').textContent=`Step ${index+1} / ${steps.length}`;
 const status=`Step ${index+1} of ${steps.length}`;if(el('step-status').textContent!==status)el('step-status').textContent=status;
 el('source').textContent=`Paper reference · ${beat.source} · ${beat.level===1?'Big picture':beat.level===2?'Mechanism':beat.level===3?'Numbers':'Fine print'}`;
 el('previous-beat').disabled=index===0;el('next-beat').disabled=index===steps.length-1;el('scene-back').disabled=index===0;el('scene-next').disabled=index===steps.length-1;
 for(const button of el('chapters').children){if(Number(button.dataset.chapter)===beat.chapter)button.setAttribute('aria-current','step');else button.removeAttribute('aria-current');}
 const key=`${beat.chapter}-${level}`;
 if(transcriptKey!==key){
  transcriptKey=key;el('transcript').replaceChildren();
  for(const item of steps.filter(item=>item.chapter===beat.chapter)){
   const row=document.createElement('li');row.dataset.beat=item.id;row.textContent=item.text;el('transcript').append(row);
  }
 }
 for(const row of el('transcript').children){if(row.dataset.beat===beat.id)row.setAttribute('aria-current','true');else row.removeAttribute('aria-current');}
}
function scheduleAdvance(){
 clearTimeout(autoTimer);
 if(autoAdvance&&!transition&&!document.hidden&&!el('watch-panel').hidden&&index<steps.length-1){
  autoTimer=setTimeout(()=>navigate(index+1),5000);
 }
}
function setAutoAdvance(enabled){
 autoAdvance=enabled&&index<steps.length-1;el('auto-advance').checked=autoAdvance;scheduleAdvance();
}
function finishTransition(){
 cancelAnimationFrame(raf);transition=null;progress=1;
 if(index===steps.length-1){autoAdvance=false;el('auto-advance').checked=false;}
 render();scheduleAdvance();
}
function navigate(target,animate=true){
 if(transition)finishTransition();
 clearTimeout(autoTimer);
 const from=index;index=clampStep(steps,target);
 if(reduced.matches||!animate||index===from){finishTransition();return;}
 const reverse=index<from&&steps[from].chapter===steps[index].chapter&&steps[from].frame>steps[index].frame;
 transition={from,reverse,start:null};progress=reverse?1:0;render();
 function draw(now){
  if(!transition)return;
  if(transition.start===null)transition.start=now;
  const fraction=Math.min(1,(now-transition.start)/1500);
  progress=transition.reverse?1-fraction:fraction;render();
  if(fraction<1)raf=requestAnimationFrame(draw);else finishTransition();
 }
 raf=requestAnimationFrame(draw);
}
function keepSceneVisible(){if(matchMedia('(max-width: 850px)').matches)el('player').scrollIntoView({block:'start'});}
function step(delta){navigate(index+delta);keepSceneVisible();}
function restartChapter(){navigate(chapterStart(steps,steps[index].chapter),false);keepSceneVisible();}
function showTab(name,focus=false){
 if(name!=='watch')setAutoAdvance(false);
 finishTransition();
 for(const id of ['watch','explore','read']){
  const selected=id===name;el(`${id}-panel`).hidden=!selected;el(`${id}-tab`).setAttribute('aria-selected',String(selected));el(`${id}-tab`).tabIndex=selected?0:-1;
 }
 if(focus)el(`${name}-tab`).focus();
}
chapters.forEach((chapter,chapterIndex)=>{
 const button=document.createElement('button');button.type='button';button.dataset.chapter=chapterIndex;
 const number=document.createElement('span');number.textContent=String(chapterIndex+1).padStart(2,'0');
 const title=document.createElement('span');title.textContent=chapter.title;button.append(number,title);
 button.addEventListener('click',()=>{showTab('watch');navigate(chapterStart(steps,chapterIndex));keepSceneVisible();});el('chapters').append(button);
});
el('auto-advance').addEventListener('change',event=>setAutoAdvance(event.target.checked));
el('scene-back').addEventListener('click',()=>step(-1));el('scene-next').addEventListener('click',()=>step(1));
el('previous-beat').addEventListener('click',()=>step(-1));el('next-beat').addEventListener('click',()=>step(1));el('restart').addEventListener('click',restartChapter);
el('detail').addEventListener('change',event=>{
 const old=steps[index];finishTransition();level=Number(event.target.value);steps=buildSteps(level);
 const retained=steps.findIndex(item=>item.chapter===old.chapter&&item.id===old.id);
 index=retained>=0?retained:steps.findLastIndex(item=>item.chapter===old.chapter);finishTransition();
});
const tabs=['watch','explore','read'];
for(const name of tabs){
 el(`${name}-tab`).addEventListener('click',()=>showTab(name));
 el(`${name}-tab`).addEventListener('keydown',event=>{
  if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;
  event.preventDefault();event.stopPropagation();const tabIndex=tabs.indexOf(name);
  showTab(event.key==='Home'?tabs[0]:event.key==='End'?tabs.at(-1):tabs[(tabIndex+(event.key==='ArrowRight'?1:2))%3],true);
 });
}
document.addEventListener('keydown',event=>{
 if(event.key==='Escape'){if(transition)finishTransition();return;}
 if(el('watch-panel').hidden||event.target.closest('input, select, textarea, button, a, summary')||event.altKey||event.ctrlKey||event.metaKey)return;
 if(['ArrowLeft','ArrowRight','Home'].includes(event.key))event.preventDefault();
 if(event.key==='ArrowLeft')step(-1);if(event.key==='ArrowRight')step(1);if(event.key==='Home')restartChapter();
});
document.addEventListener('visibilitychange',()=>{if(document.hidden){setAutoAdvance(false);finishTransition();}});
compact.addEventListener('change',render);reduced.addEventListener('change',finishTransition);
function renderExperiment(){
 const result=replicaExperiment({failed:el('failed-host').value,required:Number(el('required').value),fallback:el('fallback').checked});
 el('request-hosts').replaceChildren();
 for(const host of result.hosts){
  const card=document.createElement('div'),title=document.createElement('h3'),state=document.createElement('p'),detail=document.createElement('p');
  title.textContent=`Host ${host.id}`;state.textContent=host.time===null?'Unreachable':host.time<=result.deadline?'Stored by deadline':'Scheduled after deadline';
  detail.textContent=host.time===null?'No new copy in this scenario':`${host.time} ms${host.id==='D'?` · hint for ${result.hint}`:''}`;
  card.append(title,state,detail);el('request-hosts').append(card);
 }
 el('request-result').textContent=result.status==='success'?`Success at ${result.responseTime} ms. ${el('required').value} distinct hosts have acknowledged. Copies stored by deadline: ${result.copiesAtDeadline.join(', ')}.${result.hint?` D temporarily holds the copy intended for ${result.hint}.`:''}`:`Timeout at ${result.deadline} ms. Not enough replies; this does not undo copies already stored at ${result.copiesAtDeadline.join(', ')||'no hosts'}.`;
 el('request-trace').replaceChildren();
 for(const event of result.events){const row=document.createElement('li');row.textContent=`${event.time} ms · ${event.text}`;el('request-trace').append(row);}
 const policy=reconcileCart(el('policy').value);
 el('policy-result').textContent=el('policy').value==='union'?`Union yields book + pen. The removed book is resurrected. Both histories are included in D5: ${clockText(policy.clock)}.`:`Only pen remains when both known edit intentions are applied to the shared base. Both histories are included in D5: ${clockText(policy.clock)}.`;
}
for(const id of ['failed-host','required','fallback','policy'])el(id).addEventListener('change',renderExperiment);
renderExperiment();render();
new ResizeObserver(layoutWires).observe(el('scene'));

const help=document.createElement('div');help.id='motion-tooltip';help.className='motion-tooltip';help.hidden=true;help.setAttribute('role','tooltip');document.body.append(help);
let helpTarget=null,dismissedHelp=null;
function hideHelp(){help.hidden=true;helpTarget?.removeAttribute('aria-describedby');helpTarget=null;}
function showHelp(target,explicit=false){
 if(explicit)dismissedHelp=null;else if(target===dismissedHelp)return;
 if(!target||!motionGlossary[target.dataset.help])return;
 if(helpTarget&&helpTarget!==target)helpTarget.removeAttribute('aria-describedby');
 helpTarget=target;help.textContent=motionGlossary[target.dataset.help];help.hidden=false;target.setAttribute('aria-describedby',help.id);
 const box=target.getBoundingClientRect();help.style.left=`${Math.max(8,Math.min(box.left,innerWidth-help.offsetWidth-8))}px`;help.style.top=`${Math.max(8,Math.min(box.bottom+8,innerHeight-help.offsetHeight-8))}px`;
}
document.addEventListener('pointerover',event=>showHelp(event.target.closest('[data-help]')));
document.addEventListener('pointermove',event=>{if(dismissedHelp&&event.target.closest('[data-help]')!==dismissedHelp)dismissedHelp=null;});
document.addEventListener('pointerout',event=>{if(event.target.closest('[data-help]'))hideHelp();});
document.addEventListener('focusin',event=>{const node=event.target.closest('[data-help]');if(node)showHelp(node,true);else hideHelp();});
document.addEventListener('click',event=>{const node=event.target.closest('[data-help]');if(node)showHelp(node,true);else hideHelp();});
document.addEventListener('keydown',event=>{if(event.key==='Escape'){dismissedHelp=helpTarget||document.activeElement?.closest('[data-help]');hideHelp();}});
window.addEventListener('scroll',()=>{
 const node=document.activeElement;if(node?.matches('[data-help]')){const box=node.getBoundingClientRect();if(box.bottom>=0&&box.top<innerHeight){showHelp(node);return;}}hideHelp();
},true);
