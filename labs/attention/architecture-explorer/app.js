import { mountFocusMode } from './focus.js';
import { configuration, memoryComparison, memoryText, shapeText, sceneModel, inspect, VIEWS, OPTIONS } from './model.js';

mountFocusMode();

const $=id=>document.getElementById(id),configKeys=['qHeads','kvHeads','headDim','tokens'];
let config=configuration(),view='overview',selected=null,position=2,layer=0,renderer=null,graph=null;
const paths={overview:['overview'],block:['overview','block'],attention:['overview','block','attention'],heads:['overview','block','attention','heads'],qkv:['overview','block','attention','qkv'],ffn:['overview','block','ffn']};
const option=(value,label=value)=>new Option(label,value);
function showExplanation(id){
  const data=inspect(config,id,position,layer);
  $('inspector-title').textContent=data.title;$('explanation').textContent=data.body;
  $('inspector-kind').textContent=data.optional?'Optional · architecture preview':'Architecture note';
  // Mark known tensor symbols for the shared accessible symbol-help implementation.
  $('formula').replaceChildren();
  const parts=data.formula.split(/\b(Q|K|V|D)\b/g);
  parts.forEach((part,i)=>{if(i%2){const v=document.createElement('var');v.textContent=part;$('formula').append(v);}else $('formula').append(part);});
  $('shapes').replaceChildren();
  data.shapes.forEach(([label,shape])=>{const dt=document.createElement('dt'),dd=document.createElement('dd');dt.textContent=label;dd.textContent=shapeText(shape);$('shapes').append(dt,dd);});
  const target=graph?.nodes.find(n=>n.id===id)?.target;
  $('drill').hidden=!target;
  $('drill').textContent=target?`Open ${VIEWS[target]} →`:'Open component →';
  $('drill').onclick=()=>navigate(target,id,true);
  if($('explorer-dialog').open)$('inspector').scrollTop=0;
}
function select(id,activate=false){
  selected=id;renderer?.highlight(id);
  for(const b of $('components').querySelectorAll('button'))b.setAttribute('aria-pressed',String(b.dataset.node===id));
  showExplanation(id);
  const node=graph.nodes.find(n=>n.id===id);
  if(activate&&node?.target){navigate(node.target,id,true);return;}
  if(activate&&!$('explorer-dialog').open&&!matchMedia('(min-width: 1201px)').matches){$('inspector').focus({preventScroll:true});$('inspector').scrollIntoView({block:'nearest',behavior:'instant'});}
}
function navigate(next,focusId=null,moveFocus=false){
  if(!VIEWS[next])return;
  if(focusId?.startsWith('block-'))layer=Number(focusId.slice(6));
  view=next;selected=null;graph=sceneModel(view,config,layer);
  $('view-title').textContent=VIEWS[view]+(view==='block'?` ${layer+1}`:'');
  $('breadcrumbs').replaceChildren();
  paths[view].forEach((v,i)=>{const b=document.createElement('button');b.type='button';b.textContent=v==='block'?`Block ${layer+1}`:VIEWS[v];b.dataset.view=v;if(i===paths[view].length-1)b.setAttribute('aria-current','page');$('breadcrumbs').append(b);});
  $('back').disabled=view==='overview';
  $('components').replaceChildren();
  graph.nodes.forEach(n=>{const b=document.createElement('button');b.type='button';b.dataset.node=n.id;b.dataset.role=n.role;b.setAttribute('aria-pressed','false');b.textContent=n.label+(n.target?' ↗':'');b.addEventListener('click',()=>select(n.id,true));$('components').append(b);});
  const defaultId={overview:null,block:`block-${layer}`,attention:'heads',heads:'heads',qkv:'qkv',ffn:'ffn'}[view];
  showExplanation(defaultId);
  renderer?.update(graph,{focusId,key:view==='overview'?'overview':`${layer}/${view}`});
  if(moveFocus){$('view-title').tabIndex=-1;$('view-title').focus({preventScroll:true});}
  for(const button of document.querySelectorAll('.view-shortcuts button'))button.setAttribute('aria-pressed',String(button.dataset.view===view));
}
function context(){
  const token=position<3?` · “${['The','sky','is'][position]}”`:' · schematic position (no token text assigned)';
  $('token-context').textContent=`Inspecting position ${position}${token}. May attend positions 0–${position}; ${config.tokens-position-1} later positions masked. For each head: query row ${shapeText([1,config.headDim])}; allowed K and V, each ${shapeText([position+1,config.headDim])}; score row ${shapeText([1,position+1])}. These are allowed-row shapes, not a changing 3D mask or numerical attention weights. Full-sequence view, not a decode simulation.`;
}
function renderMemory(){
  $('memory-bars').replaceChildren();
  const comparisons=memoryComparison(config);
  // If a non-reference GQA ratio is chosen, include the exact selected configuration.
  if(config.mapping.kind==='GQA'&&config.kvHeads!==Math.max(2,config.qHeads/4))comparisons.push({kind:'Chosen',kvHeads:config.kvHeads,bytes:config.bytes,ratio:config.bytes/config.mhaBytes});
  comparisons.forEach(r=>{
    const row=document.createElement('div');row.className='memory-row';
    const label=document.createElement('strong');label.textContent=r.kind;
    const meter=document.createElement('meter');meter.min=0;meter.max=config.mhaBytes;meter.value=r.bytes;meter.setAttribute('aria-label',`${r.kind}: ${r.kvHeads} KV heads; ${r.bytes} raw KV bytes, ${r.ratio*100}% of MHA`);
    const count=document.createElement('span');count.textContent=`${memoryText(r.bytes)} · ${r.kvHeads} KV`;
    row.append(label,meter,count);$('memory-bars').append(row);
  });
  $('memory-equation').textContent=`Raw KV bytes = 2 × layers × tokens × KV heads × head width × bytes/element = 2 × 2 × ${config.tokens} × ${config.kvHeads} × ${config.headDim} × 2 = ${config.bytes.toLocaleString('en-US')} bytes (${memoryText(config.bytes)}).`;
  $('memory-note').textContent=`Selected ${config.mapping.kind}: ${config.mapping.groupSize} Q heads per KV head; ${(config.bytes/config.mhaBytes*100).toLocaleString('en-US')}% of MHA’s raw KV payload. Q projection and output width stay ${config.width}; K and V projected widths are each ${config.kvHeads*config.headDim}.`;
}
function applyConfiguration(trigger){
  const previous=config,mode=$('layout').value,qHeads=Number($('query-heads').value);
  const valid=mode==='MHA'?[qHeads]:mode==='MQA'?[1]:OPTIONS.kvHeads(qHeads).filter(n=>n>1&&n<qHeads);
  const chosen=Number($('kv-heads').value);
  const kvHeads=trigger==='layout'&&mode==='GQA'?Math.max(2,qHeads/4):valid.includes(chosen)?chosen:valid[0];
  $('kv-heads').replaceChildren(...valid.map(v=>option(v)));$('kv-heads').value=String(kvHeads);$('kv-heads').disabled=mode!=='GQA';
  config=configuration({qHeads,kvHeads,headDim:Number($('head-dim').value),tokens:Number($('token-count').value)});
  const changed=configKeys.filter(k=>previous[k]!==config[k]).map(k=>`${({qHeads:'query heads',kvHeads:'KV heads',headDim:'head width',tokens:'tokens'})[k]} ${previous[k]} → ${config[k]}`);
  $('config-summary').textContent=`${changed.length?changed.join('; ')+'. ':''}Two layers · ${config.mapping.kind} · model width ${config.width} = ${config.qHeads} query heads × ${config.headDim}. ${config.mapping.groupSize} queries share each KV head. Changing query count or head width changes model width in this schematic.`;
  position=Math.min(position,config.tokens-1);$('position').max=String(config.tokens-1);$('position').value=String(position);
  const remembered=selected;navigate(view);if(remembered&&graph.nodes.some(n=>n.id===remembered))select(remembered);
  renderMemory();context();
}
for(const id of ['layout','query-heads','kv-heads','head-dim','token-count'])$(id).addEventListener('change',()=>applyConfiguration(id));
$('position').addEventListener('change',()=>{
  if(!$('position').validity.valid||$('position').value===''){$('position').reportValidity();$('position').value=String(position);return;}
  position=Number($('position').value);context();showExplanation(selected||({heads:'heads',qkv:'qkv',ffn:'ffn'}[view]));
});
document.addEventListener('click',event=>{const button=event.target.closest('button[data-view]');if(button)navigate(button.dataset.view,null,true);});
$('back').addEventListener('click',()=>{const path=paths[view];navigate(path.at(-2)||'overview',null,true);});
$('reset-camera').addEventListener('click',()=>renderer?.reset());
// UI first: WebGL failure, missing modules, blocked storage or slow graphics cannot hide learning content.
applyConfiguration('initial');
import('./scene.js').then(({mountScene})=>{
  renderer=mountScene($('scene'),$('scene-labels'),select);renderer.update(graph,{key:view==='overview'?'overview':`${layer}/${view}`});
  $('renderer-status').textContent='3D ready · arrows show dependency direction; sharing edges connect query heads to the K/V they read. In the heads view, Qn labels query head n; KVn labels one key/value head pair. Colors identify roles; labels carry the meaning.';
}).catch(()=>{
  $('renderer-status').textContent='3D unavailable in this browser. Use the equivalent component buttons below to explore every component, formula and shape.';
  $('reset-camera').disabled=true;
});
window.addEventListener('pagehide',event=>{if(!event.persisted)renderer?.dispose();});
