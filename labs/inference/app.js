import {guide} from './guide-content.js';
import {diagramHTML,eventLimits} from './course-visuals.js';
import {representations} from './guide-model.js';
const $=selector=>document.querySelector(selector);
const storageKey='inference-course-v4';
let saved={concept:'tokens',scenes:{},checks:{}};
try{const raw=JSON.parse(localStorage.getItem(storageKey)||'null');if(raw&&typeof raw.scenes==='object'&&raw.scenes&&typeof raw.checks==='object'&&raw.checks)saved={...saved,...raw}}catch{/* Storage is optional. */}
let current=guide.findIndex(x=>x.id===saved.concept);if(current<0)current=0;
const persist=()=>{try{localStorage.setItem(storageKey,JSON.stringify(saved))}catch{/* Storage is optional. */}};
function render(){
 const lesson=guide[current];saved.concept=lesson.id;persist();
 $('#curriculum').innerHTML=guide.map((x,i)=>`<button data-concept="${i}" ${i===current?'aria-current="step" class="selected"':''}>${i+1}. ${x.short}</button>`).join('');
 document.querySelectorAll('[data-concept]').forEach(b=>b.onclick=()=>navigate(+b.dataset.concept));
 $('#lesson').innerHTML=`<p class="guide-progress">${current+1} / ${guide.length}</p><h1 tabindex="-1">${lesson.title}</h1><p class="intro guide-intro">${lesson.intro}</p><section id="scene" class="card" aria-label="${lesson.short} diagram"></section><details class="depth"><summary>${lesson.depthTitle}</summary><p>${lesson.depth}</p></details>${lesson.check?`<details class="concept-check"><summary>Check your understanding</summary><p>${lesson.check.question}</p><div class="choice-grid">${lesson.check.choices.map((x,i)=>`<button data-choice="${i}">${x}</button>`).join('')}</div><p id="feedback" role="status"></p></details>`:''}<div class="footer guide-footer"><button id="previous-concept" ${current===0?'disabled':''}>← Previous concept</button><button id="next-concept" ${current===guide.length-1?'disabled':''}>Next: ${guide[current+1]?.short||'End'} →</button></div><p class="sources-line">Sources: <a href="https://arxiv.org/abs/1706.03762">Attention Is All You Need</a> · <a href="https://huggingface.co/docs/transformers/cache_explanation">KV caching</a> · <a href="https://docs.vllm.ai/en/latest/features/automatic_prefix_caching.html">Prefix caching</a></p>`;
 $('#previous-concept').onclick=()=>navigate(current-1);$('#next-concept').onclick=()=>navigate(current+1);
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
 const version=['attention','handoff'].includes(id)?2:1;
 if(saved.scenes[id]?.version!==version)saved.scenes[id]=null;
 if(!saved.scenes[id])saved.scenes[id]={event:['decode','cache','recap'].includes(id)?(id==='decode'?2:3):0,version};
 const state=saved.scenes[id],root=$('#scene');
 if(['qkv','scores','mix'].includes(id))Object.assign(state,saved.attention||{});
 const expanded=[...root.querySelectorAll('details')].map(d=>d.open);
 root.innerHTML=diagramHTML(id,state);
 root.querySelectorAll('details').forEach((d,i)=>{if(expanded[i])d.open=true});
 const change=()=>{persist();draw(focus)};
 root.querySelectorAll('[data-action]').forEach(b=>b.onclick=()=>{
 focus=`[data-action="${b.dataset.action}"]`;
 if(b.dataset.action==='forward')state.event=Math.min(eventLimits[id]||0,(state.event||0)+1);
 if(b.dataset.action==='back')state.event=Math.max(0,(state.event||0)-1);
 if(b.dataset.action==='append')state.changed=false;
 if(b.dataset.action==='edit')state.changed=true;
 change();
 });
 root.querySelectorAll('input,select').forEach(input=>{
 input.oninput=()=>{
 focus=`#${input.id}`;
 const key={component:'first'}[input.id]||input.id;
 state[key]=Number(input.value);
 if(key==='position')state.first=representations[state.position][0];
 if(['qkv','scores','mix'].includes(id))saved.attention={position:state.position??2,first:state.first??1};
 change();
 };
 });
 if(focus){const target=root.querySelector(focus);if(target&&!target.disabled)target.focus({preventScroll:true});else root.querySelector('[data-action="back"]:not(:disabled),[data-action="forward"]:not(:disabled)')?.focus({preventScroll:true})}
}
render();
