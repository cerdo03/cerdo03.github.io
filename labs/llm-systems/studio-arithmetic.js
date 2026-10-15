import {attentionState,promptTokens,representations} from '../inference/guide-model.js';
import {projectionTrace,valueTrace} from './visual-model.js';
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
  steps=[...terms.map((_,i)=>({id:`term:${i}`,label:`Input component ${i+1} × row ${i+1}, column ${component+1} of W${role}`})),{id:'sum',label:`Add products → ${role}[${component+1}]`}];
 }else if(type==='scores'){
  terms=a.q.map((q,i)=>q*a.keys[key][i]);total=terms.reduce((sum,x)=>sum+x,0);
  steps=[...terms.map((_,i)=>({id:`term:${i}`,label:`Multiply matching Q/K component ${i+1}`})),{id:'sum',label:'Add products → one dot product'},{id:'scale',label:'Divide the dot product by √2'},{id:'mask',label:key>position?'Future position → masked score −∞':'This position is allowed by the causal mask'},{id:'normalize',label:'Softmax over the whole allowed score row'}];
 }else if(type==='values'){
  ({terms,total}=valueTrace(a.values,a.weights,component));
  steps=[...terms.map((_,i)=>({id:`term:${i}`,label:`Share for “${promptTokens[i]}” × V component ${component+1}`})),{id:'sum',label:`Add contributions → head result[${component+1}]`}];
 }else throw new RangeError('Unknown studio arithmetic type.');
 return {...a,type,position,component,role,key,matrices,outputs,terms,total,steps};
}
const picks=(values,kind,role)=>`<div class="studio-vector">${values.map((v,c)=>`<button type="button" data-pick="${kind==='projection'?`projection:${role}:${c}`:`component:${c}`}" aria-label="${kind==='projection'?`${role}[${c+1}]`:`Result[${c+1}]`}" aria-pressed="false">${esc(n(v))}</button>`).join('')}</div>`;
export function studioMarkup(type,m){
 let board,equation;
 if(type==='projections'){
  equation=`${symbol('Q')} = ${symbol('x')} × ${symbol('W_Q')}; ${symbol('K')} = ${symbol('x')} × ${symbol('W_K')}; ${symbol('V')} = ${symbol('x')} × ${symbol('W_V')}`;
  board=`<div class="studio-input" data-source><strong>Incoming ${symbol('x')} · ${promptTokens[m.position]}</strong><div class="studio-vector">${m.x.map((v,i)=>`<span class="studio-number" data-input="${i}">${esc(n(v))}</span>`).join('')}</div></div><div class="studio-lanes">${['Q','K','V'].map(r=>`<section class="studio-lane" data-role="${r}"><div class="studio-matrix-zone" data-matrix><strong>${symbol(`W_${r}`)}</strong><div class="studio-matrix">${matrices[r].map((row,i)=>row.map((v,j)=>`<span data-row="${i}" data-column="${j}">${v}</span>`).join('')).join('')}</div></div><div class="studio-output" data-output><span class="studio-label">${{Q:'Query',K:'Key',V:'Value'}[r]}</span><div class="studio-full-vector">${symbol(r)} = ${esc(vec(m.outputs[r]))}</div>${picks(m.outputs[r],'projection',r)}</div></section>`).join('')}</div>`;
 }else if(type==='scores'){
  equation=`scoreⱼ = Σᵢ(${symbol('Q')}ᵢ × ${symbol('K')}ⱼᵢ) ÷ √2; shares = softmax(masked scores)`;
  const maximum=Math.max(...m.scores),exps=m.scores.map(s=>Math.exp(s-maximum));
  board=`<div class="studio-lanes">${m.keys.map((k,j)=>`<section class="studio-lane" data-role="K" data-index="${j}" data-score><strong>${j+1}: ${promptTokens[j]}</strong><div class="studio-full-vector">${symbol('Q')} ${esc(vec(m.q))}</div><div class="studio-full-vector">${symbol('K')} ${esc(vec(k))}</div><button type="button" data-pick="key:${j}" aria-label="Inspect score for ${promptTokens[j]}" aria-pressed="false">dot ≈ ${n(m.q.reduce((sum,q,i)=>sum+q*k[i],0))}</button><div class="studio-score">${j>m.position?'Future key → masked −∞':`÷ √2 ≈ ${n(m.scores[j])}`}</div></section>`).join('')}</div><div class="studio-normalizer" data-normalizer><strong>Softmax · whole allowed row</strong><div>exp(score − maximum) ≈ ${esc(vec(exps))}</div><div>Divide each by sum ≈ ${n(exps.reduce((sum,x)=>sum+x,0))}</div></div><div class="studio-weights">${m.weights.map((w,j)=>`<div data-weight><strong>${promptTokens[j]}</strong><span>${esc(share(w))}</span></div>`).join('')}</div>`;
 }else{
  equation=`head result = Σⱼ (shareⱼ × ${symbol('V')}ⱼ)`;
  board=`<div class="studio-lanes">${m.values.map((v,j)=>`<section class="studio-lane" data-role="V" data-index="${j}" data-value><strong>${promptTokens[j]} · ${symbol('V')}</strong><div class="studio-full-vector">${esc(vec(v))}</div><div class="studio-product">× share ${esc(share(m.weights[j]))}</div><div class="studio-output" data-contribution><span class="studio-label">Contribution${j>m.position?' · masked':''}</span><div class="studio-full-vector">≈ ${esc(vec(v.map(x=>x*m.weights[j])))}</div></div></section>`).join('')}</div><div class="studio-result" data-result><strong>head result ≈ ${esc(vec(m.output))}</strong>${picks(m.output,'component')}</div>`;
 }
 return `<p class="studio-equation">${equation}</p><div class="studio-board studio-${type}"><svg class="studio-links" aria-hidden="true"></svg>${board}</div>`;
}
function detail(m){
 const title=m.type==='projections'?`${m.role}[${m.component+1}] · column ${m.component+1} of W${m.role}`:m.type==='scores'?`Q for “${promptTokens[m.position]}” · K for “${promptTokens[m.key]}”`:`Head result · component ${m.component+1}`;
 const expressions=m.terms.map((value,i)=>m.type==='projections'?`${n(m.x[i])} × ${n(matrices[m.role][i][m.component])} ≈ ${n(value)}`:m.type==='scores'?`${n(m.q[i])} × ${n(m.keys[m.key][i])} ≈ ${n(value)}`:`${share(m.weights[i])} × ${n(m.values[i][m.component])} ≈ ${n(value)}`);
 let terms=expressions.map((term,i)=>`<span data-step="term:${i}">${esc(term)}</span>`).join('');
 terms+=`<span data-step="sum">${esc(m.terms.map(n).join(' + '))} ≈ ${n(m.total)}</span>`;
 if(m.type==='scores')terms+=`<span data-step="scale">${n(m.total)} ÷ √2 ≈ ${n(m.total/Math.sqrt(2))}</span><span data-step="mask">${m.key>m.position?'masked → −∞':'Allowed position'}</span><span data-step="normalize">share ≈ ${esc(share(m.weights[m.key]))}</span>`;
 return `<div class="studio-detail"><div class="studio-detail-head"><strong>${esc(title)}</strong><button type="button" data-studio-next>Next calculation →</button></div><div class="studio-calculation">${terms}</div><p class="studio-stage" role="status">Complete transformation</p></div>`;
}
export function mountStudio(root,type,options={}){
 const win=root.ownerDocument.defaultView;
 let state={position:options.position??2,role:options.role||'V',component:options.component??0,key:options.key??options.position??2},phase=options.phase||'overview',model,disposed=false;
 const rows=()=>options.getRows?.()||options.rows||representations;
 function activeSteps(){return phase==='products'?model.terms.map((_,i)=>`term:${i}`):[phase];}
 function draw(animate=false){
  if(disposed||!root.isConnected||!root.getClientRects().length)return;
  const board=root.querySelector('.studio-board'),svg=root.querySelector('.studio-links'),box=board.getBoundingClientRect();
  if(!box.width)return;
  svg.querySelectorAll('path').forEach(path=>path.getAnimations().forEach(animation=>animation.cancel()));svg.replaceChildren();svg.setAttribute('viewBox',`0 0 ${box.width} ${box.height}`);
  if(box.width<600)return;
  const point=(el,bottom)=>{const r=el.getBoundingClientRect();return [r.left+r.width/2-box.left,(bottom?r.bottom:r.top)-box.top];};
  const connect=(from,to,active,role='')=>{
   const a=point(from,true),b=point(to,false),middle=(a[1]+b[1])/2;
   const path=root.ownerDocument.createElementNS('http://www.w3.org/2000/svg','path');path.setAttribute('class','route-edge');path.setAttribute('d',`M${a[0]},${a[1]} C${a[0]},${middle} ${b[0]},${middle} ${b[0]},${b[1]}`);svg.append(path);
   if(active){const overlay=path.cloneNode(false);overlay.classList.add('studio-active-link');if(role)overlay.dataset.role=role;svg.append(overlay);
    if(animate&&!win.matchMedia('(prefers-reduced-motion: reduce)').matches){const length=overlay.getTotalLength();overlay.style.strokeDasharray=String(length);overlay.animate([{strokeDashoffset:length},{strokeDashoffset:0}],{duration:720,easing:'cubic-bezier(.4,0,.2,1)',fill:'forwards'});}
   }
  };
  if(type==='projections')root.querySelectorAll('.studio-lane').forEach(lane=>{connect(root.querySelector('[data-source]'),lane.querySelector('[data-matrix]'),lane.dataset.role===state.role&&phase!=='overview'&&phase!=='sum',state.role);connect(lane.querySelector('[data-matrix]'),lane.querySelector('[data-output]'),lane.dataset.role===state.role&&phase==='sum',state.role);});
  if(type==='scores'){root.querySelectorAll('[data-score]').forEach(lane=>connect(lane,root.querySelector('[data-normalizer]'),phase==='normalize'));root.querySelectorAll('[data-weight]').forEach(weight=>connect(root.querySelector('[data-normalizer]'),weight,phase==='normalize'));}
  if(type==='values')root.querySelectorAll('[data-contribution]').forEach(lane=>connect(lane,root.querySelector('[data-result]'),phase==='sum','V'));
 }
 function update(animate=false){
  const steps=activeSteps();
  root.querySelectorAll('[data-step]').forEach(el=>el.classList.toggle('is-current',steps.includes(el.dataset.step)));
  root.querySelectorAll('[data-input]').forEach(el=>el.classList.toggle('is-current',steps.includes(`term:${el.dataset.input}`)));
  root.querySelectorAll('.studio-matrix span').forEach(el=>{const selected=el.closest('[data-role]').dataset.role===state.role&&Number(el.dataset.column)===state.component;el.classList.toggle('studio-column',selected);el.classList.toggle('is-current',selected&&steps.includes(`term:${el.dataset.row}`));});
  root.querySelectorAll('[data-pick]').forEach(button=>{const pick=button.dataset.pick,selected=pick===`projection:${state.role}:${state.component}`||pick===`component:${state.component}`||pick===`key:${state.key}`;button.setAttribute('aria-pressed',String(selected));});
  root.querySelectorAll('[data-value]').forEach(el=>el.classList.toggle('is-current',steps.includes(`term:${el.dataset.index}`)));
  root.querySelector('.studio-stage').textContent=phase==='products'?'Multiply matching components; each product remains visible.':model.steps.find(s=>s.id===phase)?.label||'Complete transformation';
  root.querySelector('[data-studio-next]').textContent=phase===model.steps.at(-1).id?'Back to overview':'Next calculation →';
  draw(animate);
 }
 function render(focus){
  model=studioModel(type,state,rows());state={position:model.position,component:model.component,role:model.role,key:model.key};
  root.classList.add('studio-arithmetic','teaching-visual');root.style.setProperty('--role-color',`var(--llm-${{Q:'query',K:'key',V:'value'}[type==='values'?'V':state.role]})`);
  root.innerHTML=`${options.embedded?'':`<div class="route-toolbar"><label>Inspect position<select data-studio-position>${promptTokens.map((t,i)=>`<option value="${i}" ${i===state.position?'selected':''}>${i+1}: ${t}</option>`).join('')}</select></label></div><div class="route-stage">Prefill · layer 1 · head 1 · ${promptTokens[state.position]}</div>`}${studioMarkup(type,model)}${detail(model)}<details class="visual-assumptions"><summary>Toy assumptions</summary><p>Invented first-layer, one-head example. Full-precision calculations; displayed values rounded. Earlier K/V stay unchanged. Future positions receive exactly zero share.</p></details>`;
  if(options.embedded)root.querySelector('[data-studio-next]').hidden=true;
  root.querySelector('[data-studio-position]')?.addEventListener('change',event=>{state.position=Number(event.target.value);state.key=state.position;phase='overview';options.onPosition?.(state.position);render('[data-studio-position]');});
  root.querySelectorAll('[data-pick]').forEach(button=>button.onclick=()=>{const [field,value,column]=button.dataset.pick.split(':');if(field==='projection'){state.role=value;state.component=Number(column);}if(field==='component')state.component=Number(value);if(field==='key')state.key=Number(value);if(!options.embedded)phase='overview';options.onSelect?.(state);render(`[data-pick="${button.dataset.pick}"]`);});
  root.querySelector('[data-studio-next]').onclick=()=>{const index=model.steps.findIndex(step=>step.id===phase);phase=index===model.steps.length-1?'overview':model.steps[index+1].id;update(true);};
  update();if(focus)root.querySelector(focus)?.focus({preventScroll:true});
 }
 const observer=new win.ResizeObserver(()=>draw());
 function storage(event){if(event.key==='inference-course-v4'){phase='overview';render();}}
 render();observer.observe(root);win.addEventListener('storage',storage);
 return ()=>{root.classList.remove('studio-arithmetic');root.style.removeProperty('--role-color');disposed=true;observer.disconnect();win.removeEventListener('storage',storage);root.querySelectorAll('.studio-links path').forEach(path=>path.getAnimations().forEach(animation=>animation.cancel()));};
}
