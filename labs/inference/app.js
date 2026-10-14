import {mountLearningVisual,disposeVisual} from '../llm-systems/learning-visuals.js';
import {mountVectorRoutes} from '../attention/vector-routes.js';
import {representations} from './guide-model.js';
import {guide} from './guide-content.js';
import {diagramHTML,eventLimits} from './course-visuals.js';
const $=selector=>document.querySelector(selector);
const storageKey='inference-course-v4';
let saved={concept:'tokens',scenes:{},checks:{}};
try{const raw=JSON.parse(localStorage.getItem(storageKey)||'null');if(raw&&typeof raw.scenes==='object'&&raw.scenes&&typeof raw.checks==='object'&&raw.checks)saved={...saved,...raw}}catch{/* Storage is optional. */}
if(!Array.isArray(saved.embeddings)||saved.embeddings.length!==3||!saved.embeddings.every(row=>Array.isArray(row)&&row.length===2&&row.every(x=>Number.isFinite(x)&&Math.abs(x)<=4)))saved.embeddings=representations.map(row=>[...row]);
let current=guide.findIndex(x=>`#${x.id}`===window.location.hash);if(current<0)current=guide.findIndex(x=>x.id===saved.concept);if(current<0)current=0;
const persist=()=>{try{localStorage.setItem(storageKey,JSON.stringify(saved))}catch{/* Storage is optional. */}};
function render(){
 if($('#scene'))disposeVisual($('#scene'));
 const lesson=guide[current];saved.concept=lesson.id;persist();window.history.replaceState(null,'',`#${lesson.id}`);
 $('#curriculum').innerHTML=guide.map((x,i)=>`<button data-concept="${i}" ${i===current?'aria-current="step" class="selected"':''}>${i+1}. ${x.short}</button>`).join('');
 document.querySelectorAll('[data-concept]').forEach(b=>b.onclick=()=>navigate(+b.dataset.concept));
 $('#lesson').innerHTML=`<p class="guide-progress">${current+1} / ${guide.length}</p><h1 tabindex="-1">${lesson.title}</h1><p class="intro guide-intro">${lesson.intro}</p><section id="scene" class="card" aria-label="${lesson.short} diagram"></section><details class="depth"><summary>${lesson.depthTitle}</summary><p>${lesson.depth}</p></details>${lesson.check?`<details class="concept-check"><summary>Check your understanding</summary><p>${lesson.check.question}</p><div class="choice-grid">${lesson.check.choices.map((x,i)=>`<button data-choice="${i}">${x}</button>`).join('')}</div><p id="feedback" role="status"></p></details>`:''}<div class="footer guide-footer"><button id="previous-concept" ${current===0?'disabled':''}>← Previous concept</button><button id="next-concept" >Next: ${guide[current+1]?.short||'Self-attention'} →</button></div><p class="sources-line">Sources: <a href="https://arxiv.org/abs/1706.03762">Attention Is All You Need</a> · <a href="https://huggingface.co/docs/transformers/cache_explanation">KV caching</a> · <a href="https://docs.vllm.ai/en/latest/features/automatic_prefix_caching.html">Prefix caching</a></p>`;
 $('#previous-concept').onclick=()=>navigate(current-1);$('#next-concept').onclick=()=>{if(current===guide.length-1)window.location.href='../attention/lesson-1.html';else navigate(current+1)};
 if(lesson.check){
 const show=i=>{$('#feedback').textContent=(i===lesson.check.correct?'Correct. ':'Consider this: ')+lesson.check.feedback;document.querySelectorAll('[data-choice]').forEach(b=>b.setAttribute('aria-pressed',String(+b.dataset.choice===i)))};
 document.querySelectorAll('[data-choice]').forEach(b=>b.onclick=()=>{saved.checks[lesson.check.id]=+b.dataset.choice;persist();show(+b.dataset.choice)});
 if(Number.isInteger(saved.checks[lesson.check.id]))show(saved.checks[lesson.check.id]);
 }
 draw();
}
function navigate(index){current=Math.max(0,Math.min(guide.length-1,index));render();$('h1').focus();window.scrollTo(0,0)}
function draw(focus){
 const id=guide[current].id;
 const version=['attention','handoff','cache'].includes(id)?2:1;
 if(saved.scenes[id]?.version!==version)saved.scenes[id]=null;
 if(!saved.scenes[id])saved.scenes[id]={event:['decode','recap'].includes(id)?(id==='decode'?2:3):0,version};
 const state=saved.scenes[id],root=$('#scene');
 disposeVisual(root);root.classList.remove('teaching-visual','is-playing');
 const visualTypes={prefill:'request',decode:'request',recap:'request',cache:'request',qkv:'projections',scores:'scores',mix:'values',handoff:'prediction',validity:'validity',prefix:'prefix'};
 if(visualTypes[id]){root.replaceChildren();mountLearningVisual(root,visualTypes[id],{rows:saved.embeddings,pass:['decode','cache'].includes(id)?1:0,onPosition:position=>{saved.attention={position};persist();}});return;}
 if(id==='attention'){root.replaceChildren();mountVectorRoutes(root);return;}
 if(['qkv','scores','mix'].includes(id)){delete state.first;state.position=saved.attention?.position??state.position??2;saved.attention={position:state.position};}
 const expanded=new Set([...root.querySelectorAll('details')].filter(d=>d.open).map(d=>d.querySelector('summary').textContent));
 root.innerHTML=diagramHTML(id,{...state,embeddings:saved.embeddings});
 root.querySelectorAll('details').forEach(d=>{if(expanded.has(d.querySelector('summary').textContent))d.open=true});
 const change=()=>{persist();draw(focus)};
 root.querySelectorAll('[data-action]').forEach(b=>b.onclick=()=>{
 focus=`[data-action="${b.dataset.action}"]`;
 if(b.dataset.action==='open-embeddings'){navigate(0);$('#embedding-editor').open=true;$('#embedding-editor summary').focus();return}
 if(b.dataset.action==='apply-embeddings'){const inputs=[...root.querySelectorAll('[data-embedding]')];if(inputs.some(input=>!input.checkValidity()||!Number.isFinite(input.valueAsNumber))){inputs.find(input=>!input.checkValidity()||!Number.isFinite(input.valueAsNumber)).reportValidity();return}saved.embeddings=representations.map((_,i)=>inputs.slice(i*2,i*2+2).map(input=>input.valueAsNumber))}
 if(b.dataset.action==='default-embeddings')saved.embeddings=representations.map(row=>[...row]);
 if(b.dataset.action==='forward')state.event=Math.min(eventLimits[id]||0,(state.event||0)+1);
 if(b.dataset.action==='back')state.event=Math.max(0,(state.event||0)-1);
 if(b.dataset.action==='append')state.changed=false;
 if(b.dataset.action==='edit')state.changed=true;
 change();
 });
 root.querySelectorAll('input,select').forEach(input=>{
 if(input.hasAttribute('data-embedding'))return;
 input[input.type==='range'?'onchange':'oninput']=()=>{
 focus=`#${input.id}`;
 const key=input.id;
 state[key]=Number(input.value);
 if(id==='cache'&&key==='position')state.event=0;
  if(['qkv','scores','mix'].includes(id))saved.attention={position:state.position??2};
 change();
 };
 });
 if(focus){const target=root.querySelector(focus);if(target&&!target.disabled){if(target.getClientRects().length)target.focus({preventScroll:true});else target.closest('details')?.querySelector('summary')?.focus({preventScroll:true});}else root.querySelector('[data-action="back"]:not(:disabled),[data-action="forward"]:not(:disabled)')?.focus({preventScroll:true})}
}
render();

window.addEventListener('storage', event => { if (event.key !== storageKey) return;try { const incoming = JSON.parse(event.newValue);if (incoming?.embeddings?.length === 3 && incoming.embeddings.every(row=>Array.isArray(row)&&row.length===2&&row.every(x=>Number.isFinite(x)&&Math.abs(x)<=4))) { saved.embeddings=incoming.embeddings;draw(); } } catch { /* Storage optional. */ } });

window.addEventListener('hashchange',()=>{const index=guide.findIndex(x=>`#${x.id}`===window.location.hash);if(index>=0&&index!==current)navigate(index)});
