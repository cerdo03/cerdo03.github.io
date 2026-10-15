import {attentionState,promptTokens,representations} from '../inference/guide-model.js';
import {projectionTrace,valueTrace} from './visual-model.js';
const revealOrder={projections:['input','matrices','term:0','term:1','sum','outputs'],scores:['input','term:0','term:1','sum','scale','mask','normalize','weights'],values:['input','term:0','term:1','term:2','sum']};
export function studioVisibility(type,phase='input'){
 const order=revealOrder[type];if(!order)throw new RangeError('Unknown studio type.');
 const selected=phase==='overview'?'input':phase==='products'?type==='values'?'term:2':'term:1':phase;
 const index=selected==='all'?order.length-1:Math.max(0,order.indexOf(selected));
 return order.slice(0,index+1);
}
const matrices={Q:[[1,0],[0,1]],K:[[0,1],[1,0]],V:[[2,0],[0,1]]};
const n=value=>Number.isFinite(value)?String(Number(value.toFixed(3))):'−∞';
const share=value=>value>0&&value<.001?'<0.001':n(value);
const vec=values=>`[${values.map(n).join(', ')}]`;
const esc=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const symbol=key=>`<span class="sym" data-symbol="${key}" aria-describedby="sym-${key}">${key.startsWith('W_')?`W<sub>${key.slice(2)}</sub>`:key}</span>`;
export function studioModel(type,state={},rows=representations){
 const position=[0,1,2].includes(state.position)?state.position:2,component=state.component===1?1:0,role=['Q','K','V'].includes(state.role)?state.role:'V',key=[0,1,2].includes(state.key)?state.key:position;
 const a=attentionState(position,undefined,rows),outputs={Q:a.q,K:a.keys[position],V:a.values[position]};
 let terms,total,steps;
 if(type==='projections'){
  ({terms,total}=projectionTrace(a.x,matrices[role],component));
  steps=[{id:'input',label:'Incoming vector'},{id:'matrices',label:'Multiply the same input by three learned matrices'},...terms.map((_,i)=>({id:`term:${i}`,label:`Input component ${i+1} × row ${i+1}, column ${component+1} of W${role}`})),{id:'sum',label:`Add products → ${role}[${component+1}]`},{id:'outputs',label:'Repeat for every column → complete Q, K and V'}];
 }else if(type==='scores'){
  terms=a.q.map((q,i)=>q*a.keys[key][i]);total=terms.reduce((sum,x)=>sum+x,0);
  steps=[{id:'input',label:'One query and the three key vectors'},...terms.map((_,i)=>({id:`term:${i}`,label:`Multiply matching Q/K component ${i+1}`})),{id:'sum',label:'Add products for each key → dot products'},{id:'scale',label:'Divide the dot product by √2'},{id:'mask',label:key>position?'Future position → masked score −∞':'This position is allowed by the causal mask'},{id:'normalize',label:'Exponentiate masked scores and add the exponentials'},{id:'weights',label:'Divide each exponential by the shared sum → attention shares'}];
 }else if(type==='values'){
  ({terms,total}=valueTrace(a.values,a.weights,component));
  steps=[{id:'input',label:'Value vectors and their attention shares'},...terms.map((_,i)=>({id:`term:${i}`,label:`Share for “${promptTokens[i]}” × V component ${component+1}`})),{id:'sum',label:`Add contributions → head result[${component+1}]`}];
 }else throw new RangeError('Unknown studio arithmetic type.');
 return {...a,type,position,component,role,key,matrices,outputs,terms,total,steps};
}
const picks=(values,kind,role)=>`<div class="studio-vector">${values.map((v,c)=>`<button type="button" data-pick="${kind==='projection'?`projection:${role}:${c}`:`component:${c}`}" aria-label="${kind==='projection'?`${role}[${c+1}]`:`Result[${c+1}]`}" aria-pressed="false">${esc(n(v))}</button>`).join('')}</div>`;
export function studioMarkup(type,m){
 let board,equation;
 if(type==='projections'){
  equation=`${symbol('Q')} = ${symbol('x')} × ${symbol('W_Q')}; ${symbol('K')} = ${symbol('x')} × ${symbol('W_K')}; ${symbol('V')} = ${symbol('x')} × ${symbol('W_V')}`;
  board=`<div class="studio-input" data-source><strong>Incoming ${symbol('x')} · ${promptTokens[m.position]}</strong><div class="studio-vector">${m.x.map((v,i)=>`<span class="studio-number" data-input="${i}">${esc(n(v))}</span>`).join('')}</div></div><div class="studio-lanes" data-reveal="matrices">${['Q','K','V'].map(r=>`<section class="studio-lane" data-role="${r}"><div class="studio-matrix-zone" data-reveal="matrices" data-matrix><strong>${symbol(`W_${r}`)}</strong><div class="studio-matrix">${matrices[r].map((row,i)=>row.map((v,j)=>`<span data-row="${i}" data-column="${j}">${v}</span>`).join('')).join('')}</div></div><div class="studio-output" data-reveal="outputs" data-output><span class="studio-label">${{Q:'Query',K:'Key',V:'Value'}[r]}</span><div class="studio-full-vector">${symbol(r)} = ${esc(vec(m.outputs[r]))}</div>${picks(m.outputs[r],'projection',r)}</div></section>`).join('')}</div>`;
 }else if(type==='scores'){
  equation=`scoreⱼ = Σᵢ(${symbol('Q')}ᵢ × ${symbol('K')}ⱼᵢ) ÷ √2; shares = softmax(masked scores)`;
  const maximum=Math.max(...m.scores),exps=m.scores.map(s=>Math.exp(s-maximum));
  board=`<div class="studio-lanes">${m.keys.map((k,j)=>`<section class="studio-lane" data-role="K" data-index="${j}" data-score><strong>${j+1}: ${promptTokens[j]}</strong><div class="studio-full-vector">${symbol('Q')} ${esc(vec(m.q))}</div><div class="studio-full-vector">${symbol('K')} ${esc(vec(k))}</div><button type="button" data-reveal="sum" data-pick="key:${j}" aria-label="Inspect score for ${promptTokens[j]}" aria-pressed="false">dot ≈ ${n(m.q.reduce((sum,q,i)=>sum+q*k[i],0))}</button><div class="studio-score" data-reveal="scale">÷ √2 ≈ ${n(m.q.reduce((sum,q,i)=>sum+q*k[i],0)/Math.sqrt(2))}</div><div class="studio-mask" data-reveal="mask">${j>m.position?'Future key → masked −∞':'Allowed by causal mask'}</div></section>`).join('')}</div><div class="studio-normalizer" data-reveal="normalize" data-normalizer><strong>Softmax · whole allowed row</strong><div>exp(score − maximum) ≈ ${esc(vec(exps))}</div><div>Divide each by sum ≈ ${n(exps.reduce((sum,x)=>sum+x,0))}</div></div><div class="studio-weights" data-reveal="weights">${m.weights.map((w,j)=>`<div data-weight><strong>${promptTokens[j]}</strong><span>${esc(share(w))}</span></div>`).join('')}</div>`;
 }else{
  equation=`head result = Σⱼ (shareⱼ × ${symbol('V')}ⱼ)`;
  board=`<div class="studio-lanes">${m.values.map((v,j)=>`<section class="studio-lane" data-role="V" data-index="${j}" data-value><strong>${promptTokens[j]} · ${symbol('V')}</strong><div data-value-source><div class="studio-full-vector">${esc(vec(v))}</div><div class="studio-product">× share ${esc(share(m.weights[j]))}</div></div><div class="studio-output" data-reveal="term:${j}" data-contribution><span class="studio-label">Contribution${j>m.position?' · masked':''}</span><div class="studio-full-vector">≈ ${esc(vec(v.map(x=>x*m.weights[j])))}</div></div></section>`).join('')}</div><div class="studio-result" data-reveal="sum" data-result><strong>head result ≈ ${esc(vec(m.output))}</strong>${picks(m.output,'component')}</div>`;
 }
 return `<p class="studio-equation">${equation}</p>${detail(m)}<div class="studio-board studio-${type}"><svg class="studio-links" aria-hidden="true"></svg>${board}</div>`;
}
function detail(m){
 const title=m.type==='projections'?`${m.role}[${m.component+1}] · column ${m.component+1} of W${m.role}`:m.type==='scores'?`Q for “${promptTokens[m.position]}” · K for “${promptTokens[m.key]}”`:`Head result · component ${m.component+1}`;
 const expressions=m.terms.map((value,i)=>m.type==='projections'?`${n(m.x[i])} × ${n(matrices[m.role][i][m.component])} ≈ ${n(value)}`:m.type==='scores'?`${n(m.q[i])} × ${n(m.keys[m.key][i])} ≈ ${n(value)}`:`${share(m.weights[i])} × ${n(m.values[i][m.component])} ≈ ${n(value)}`);
 let terms=expressions.map((term,i)=>`<span data-reveal="term:${i}" data-step="term:${i}">${esc(term)}</span>`).join('');
 terms+=`<span data-reveal="sum" data-step="sum">${esc(m.terms.map(n).join(' + '))} ≈ ${n(m.total)}</span>`;
 if(m.type==='scores')terms+=`<span data-reveal="scale" data-step="scale">${n(m.total)} ÷ √2 ≈ ${n(m.total/Math.sqrt(2))}</span><span data-reveal="mask" data-step="mask">${m.key>m.position?'masked → −∞':'Allowed position'}</span><span data-reveal="weights" data-step="weights">share ≈ ${esc(share(m.weights[m.key]))}</span>`;
 return `<div class="studio-detail" data-reveal="term:0"><div class="studio-detail-head"><strong>${esc(title)}</strong></div><div class="studio-calculation">${terms}</div></div>`;
}
export function studioConnector(source,target,origin={left:0,top:0}){
 const start=[source.left+source.width/2-origin.left,source.bottom-origin.top];
 const end=[target.left+target.width/2-origin.left,target.top-origin.top];
 const middle=(start[1]+end[1])/2,controls=[[start[0],middle],[end[0],middle]];
 return {start,end,controls,path:`M${start[0]},${start[1]} C${controls[0].join(',')} ${controls[1].join(',')} ${end.join(',')}`};
}
export function mountStudio(root,type,options={}){
 const win=root.ownerDocument.defaultView;
 let state={position:options.position??2,role:options.role||'V',component:options.component??0,key:options.key??options.position??2},phase=options.phase||'input',model,disposed=false,drawKey='',busy=false;
 const rows=()=>options.getRows?.()||options.rows||representations;
 const reduced=()=>win.matchMedia('(prefers-reduced-motion: reduce)').matches;
 const pending=new Set();
 const later=(fn,delay)=>{const id=win.setTimeout(()=>{pending.delete(id);if(!disposed)fn();},delay);pending.add(id);};
 function cancel(){pending.forEach(id=>win.clearTimeout(id));pending.clear();root.querySelectorAll('*').forEach(el=>el.getAnimations().forEach(animation=>animation.cancel()));busy=false;}
 function activeSteps(){return phase==='products'?model.terms.map((_,i)=>`term:${i}`):[phase];}
 function draw(animate=false){
  if(disposed||!root.isConnected||!root.getClientRects().length)return;
  const board=root.querySelector('.studio-board'),svg=root.querySelector('.studio-links'),box=board.getBoundingClientRect();
  if(!box.width)return;
  // Resizing to the same geometry must not cancel an in-flight connection reveal.
  const signature=[box.width,box.height,phase,state.role,state.component,state.key].join(':');
  if(signature===drawKey&&!animate)return;drawKey=signature;
  svg.querySelectorAll('path').forEach(path=>path.getAnimations().forEach(animation=>animation.cancel()));svg.replaceChildren();svg.setAttribute('viewBox',`0 0 ${box.width} ${box.height}`);
  if(box.width<600)return;
  const visible=studioVisibility(type,phase);
  const connect=(from,to,gate,active,role='')=>{
   if(!visible.includes(gate))return;
   const curve=studioConnector(from.getBoundingClientRect(),to.getBoundingClientRect(),box);
   const path=root.ownerDocument.createElementNS('http://www.w3.org/2000/svg','path');path.setAttribute('class','route-edge');path.setAttribute('d',curve.path);
   // A newly introduced connection grows into place; no completed base line flashes underneath.
   const newly=animate&&phase===gate;
   if(!newly)svg.append(path);
   if(active||newly){const overlay=path.cloneNode(false);overlay.classList.add('studio-active-link');if(role)overlay.dataset.role=role;svg.append(overlay);
    if(animate&&!reduced()){const length=overlay.getTotalLength();overlay.style.strokeDasharray=String(length);overlay.animate([{strokeDashoffset:length},{strokeDashoffset:0}],{duration:650,easing:'cubic-bezier(.4,0,.2,1)',fill:'both'});}
   }
  };
  if(type==='projections')root.querySelectorAll('.studio-lane').forEach(lane=>{const role=lane.dataset.role;connect(root.querySelector('[data-source]'),lane,'matrices',role===state.role&&phase.startsWith('term:'),role);connect(lane.querySelector('[data-matrix]'),lane.querySelector('[data-output]'),'outputs',phase==='outputs',role);});
  if(type==='scores'){root.querySelectorAll('[data-score]').forEach(lane=>connect(lane,root.querySelector('[data-normalizer]'),'normalize',phase==='normalize','K'));root.querySelectorAll('[data-weight]').forEach(weight=>connect(root.querySelector('[data-normalizer]'),weight,'weights',phase==='weights','K'));}
  if(type==='values')root.querySelectorAll('[data-value]').forEach(lane=>{connect(lane.querySelector('[data-value-source]'),lane.querySelector('[data-contribution]'),`term:${lane.dataset.index}`,phase===`term:${lane.dataset.index}`,'V');connect(lane.querySelector('[data-contribution]'),root.querySelector('[data-result]'),'sum',phase==='sum','V');});
 }
 function update(animate=false,initial=false){
  const steps=activeSteps(),visible=studioVisibility(type,phase),delayed=animate&&!reduced();
  const linked=type==='projections'?['matrices','term:0','term:1','outputs']:type==='scores'?['normalize','weights']:['term:0','term:1','term:2','sum'];
  const travel=delayed&&root.querySelector('.studio-board').getBoundingClientRect().width>=600?650:0;
  root.querySelectorAll('[data-reveal]').forEach(el=>{
   const show=visible.includes(el.dataset.reveal),was=el.dataset.shown==='true',enter=show&&delayed&&(initial?el.dataset.reveal===phase:!was);
   el.dataset.shown=String(show);el.classList.toggle('studio-future',!show);el.classList.toggle('studio-entering',enter);el.setAttribute('aria-hidden',String(!show||enter));el.inert=!show||enter;
   if(enter)later(()=>{el.classList.remove('studio-entering');el.setAttribute('aria-hidden','false');el.inert=false;el.animate([{opacity:0},{opacity:1}],{duration:220,easing:'ease-out'});},linked.includes(el.dataset.reveal)?travel:0);
  });
  root.querySelectorAll('[data-step]').forEach(el=>el.classList.toggle('is-current',steps.includes(el.dataset.step)));
  root.querySelectorAll('[data-input]').forEach(el=>el.classList.toggle('is-current',steps.includes(`term:${el.dataset.input}`)));
  root.querySelectorAll('.studio-matrix span').forEach(el=>{const selected=el.closest('[data-role]').dataset.role===state.role&&Number(el.dataset.column)===state.component;el.classList.toggle('studio-column',selected);el.classList.toggle('is-current',selected&&steps.includes(`term:${el.dataset.row}`));});
  root.querySelectorAll('[data-pick]').forEach(button=>{const pick=button.dataset.pick,selected=pick===`projection:${state.role}:${state.component}`||pick===`component:${state.component}`||pick===`key:${state.key}`;button.setAttribute('aria-pressed',String(selected));});
  root.querySelectorAll('[data-value]').forEach(el=>el.classList.toggle('is-current',steps.includes(`term:${el.dataset.index}`)));
  const stage=root.querySelector('.studio-stage');stage.textContent=phase==='all'?'Complete calculation':`${Math.max(0,model.steps.findIndex(s=>s.id===phase))+1} / ${model.steps.length} · ${phase==='products'?'Multiply matching components':model.steps.find(s=>s.id===phase)?.label||model.steps[0].label}`;
  root.querySelector('[data-studio-back]').disabled=phase==='all'||phase===model.steps[0].id;
  root.querySelector('[data-studio-next]').disabled=phase==='all'||phase===model.steps.at(-1).id||delayed;
  root.querySelector('[data-studio-all]').textContent=phase==='all'?'Step by step':'Show all';
  if(delayed){busy=true;later(()=>{busy=false;root.querySelector('[data-studio-next]').disabled=phase===model.steps.at(-1).id||phase==='all';},(linked.includes(phase)?travel:0)+250);}
  draw(animate);
 }
 function render(focus,animate=false){
  cancel();drawKey='';
  model=studioModel(type,state,rows());state={position:model.position,component:model.component,role:model.role,key:model.key};
  if(phase==='overview')phase='input';
  root.classList.add('studio-arithmetic','teaching-visual');root.style.setProperty('--role-color',`var(--llm-${{Q:'query',K:'key',V:'value'}[type==='scores'?'K':type==='values'?'V':state.role]})`);
  root.innerHTML=`${options.embedded?'':`<div class="route-toolbar"><label>Inspect position<select data-studio-position>${promptTokens.map((t,i)=>`<option value="${i}" ${i===state.position?'selected':''}>${i+1}: ${t}</option>`).join('')}</select></label></div><div class="route-stage">Prefill · layer 1 · head 1 · ${promptTokens[state.position]}</div>`}<div class="studio-navigation"><button type="button" data-studio-back>← Previous</button><button type="button" data-studio-next>Next →</button><button type="button" data-studio-all>Show all</button></div><p class="studio-stage" role="status"></p>${studioMarkup(type,model)}<details class="visual-assumptions"><summary>Toy assumptions</summary><p>Invented first-layer, one-head example. Full-precision calculations; displayed values rounded. Earlier K/V stay unchanged. Future positions receive exactly zero share.</p></details>`;
  if(options.embedded){root.querySelector('[data-studio-next]').hidden=true;root.querySelector('[data-studio-back]').hidden=true;root.querySelector('.studio-stage').hidden=true;}
  root.querySelector('[data-studio-position]')?.addEventListener('change',event=>{state.position=Number(event.target.value);state.key=state.position;phase='input';options.onPosition?.(state.position);render('[data-studio-position]');});
  root.querySelectorAll('[data-pick]').forEach(button=>button.onclick=()=>{const [field,value,column]=button.dataset.pick.split(':');if(field==='projection'){state.role=value;state.component=Number(column);}if(field==='component')state.component=Number(value);if(field==='key')state.key=Number(value);options.onSelect?.(state);render(`[data-pick="${button.dataset.pick}"]`);});
  root.querySelector('[data-studio-next]').onclick=()=>{if(busy)return;const index=model.steps.findIndex(step=>step.id===phase);phase=model.steps[Math.min(index+1,model.steps.length-1)].id;update(true);};
  root.querySelector('[data-studio-back]').onclick=()=>{cancel();const index=model.steps.findIndex(step=>step.id===phase);phase=model.steps[Math.max(0,index-1)].id;update();};
  root.querySelector('[data-studio-all]').onclick=()=>{cancel();phase=phase==='all'?'input':'all';update();options.onOverview?.(phase==='all');};
  update(animate,true);if(focus)root.querySelector(focus)?.focus({preventScroll:true});
 }
 const observer=new win.ResizeObserver(()=>draw());
 function storage(event){if(event.key==='inference-course-v4'){phase='input';render();}}
 render(null,!!options.animate);observer.observe(root);win.addEventListener('storage',storage);
 return ()=>{cancel();root.classList.remove('studio-arithmetic');root.style.removeProperty('--role-color');disposed=true;observer.disconnect();win.removeEventListener('storage',storage);};
}
