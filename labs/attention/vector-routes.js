import {mountStudio} from '../llm-systems/studio-arithmetic.js';
import { sharedRows,disposeVisual,ownVisual } from '../llm-systems/learning-visuals.js';
// Structural dependencies, not measured attention weights or numeric embeddings.
const tokens = ['The', 'sky', 'is'];
export function routeState(layer, head, position) {
  if (![1, 2].includes(layer) || ![1, 2].includes(head) || ![0, 1, 2].includes(position)) throw new RangeError('Invalid layer, head or token position.');
  return {
    inputs: tokens.map((token, i) => ({token, position: i, sourceLayer: layer - 1, context: layer === 1 ? [i] : Array.from({length: i + 1}, (_, j) => j)})),
    rows: tokens.map((token, i) => ({token, position: i, layer, head})),
    allowed: Array.from({length: position + 1}, (_, j) => j),
  };
}
export function networkEdges() {
  return [1,2].flatMap(layer=>tokens.flatMap((_,target)=>Array.from({length:target+1},(_,source)=>({fromLayer:layer-1,toLayer:layer,fromPosition:source,toPosition:target}))));
}
const operations = [
  [0, 'Share the input', 'Same x → head 1 and head 2', 'Both heads receive the entire incoming vector. These arrows copy the input; no multiplication or addition happens yet.'],
  [1, 'Multiply by learned matrices', 'Q = x × Wq; K = x × Wₖ; V = x × Wᵥ', 'Three different learned matrices transform the same input. Q and K will determine contribution strengths; V carries the information to combine.'],
  [1, 'Multiply matching entries', 'productᵢ = xᵢ × Wᵢⱼ', 'Here i indexes input components and j selects one output component. Multiply each input component by its matching entry in matrix column j.'],
  [1, 'Add projection products', 'outputⱼ = Σᵢ productᵢ', 'Add the products to obtain one Q, K or V component. Repeat with each matrix column to form the whole vector. K/V may be stored; Q is used for this query.'],
  [2, 'Compare Q with each K', 'dot = Σᵢ (Qᵢ × Kᵢ)', 'Multiply matching query/key components, then add those products. This gives one compatibility score for one key, not a probability.'],
  [2, 'Scale and mask scores', 'score = dot ÷ √dₖ; later positions → −∞', 'dₖ is the number of query/key components. Dividing by its square root controls score magnitude. The causal mask excludes future positions even though all prompt inputs are available.'],
  [2, 'Convert scores into shares', 'shareⱼ = exp(scoreⱼ − max) ÷ Σ exp(score − max)', 'Here j indexes token positions. Softmax uses all allowed scores together. Shares sum to 1; masked positions get exactly 0. Subtracting the maximum keeps the calculation numerically stable.'],
  [3, 'Multiply values by shares', 'contributionⱼ = shareⱼ × Vⱼ', 'Here j indexes token positions. Multiply every component of each value vector by its share. A stronger share gives that position a larger contribution.'],
  [3, 'Add contribution vectors', 'head result = Σⱼ contributionⱼ', 'Add contributions component by component. This new attention vector contains the weighted information; it does not replace cached K/V.'],
  [4, 'Join head results', 'joined = [head 1 result | head 2 result]', 'Concatenation places components side by side. No addition occurs. This keeps both heads’ information for the output projection.'],
  [4, 'Project the joined result', 'update = joined × Wₒ', 'Multiply by the learned output matrix to turn the joined head results into an update with the same width as incoming x.'],
  [4, 'Add residuals and update', 'u = x + update; next x = u + FF(u)', 'Residual addition adds matching components, retaining the incoming representation. The feed-forward branch transforms each position separately, then its result is added. The next layer receives the updated vector.'],
];
export function routeOperation(index) {
  if (!Number.isInteger(index) || !operations[index]) throw new RangeError('Invalid operation.');
  const [phase,title,formula,why] = operations[index];
  return {phase,title,formula,why};
}
const textFormula = formula => formula.replace(/(WQ|WK|WV|WO|Wq|Wₒ|Wₖ|Wᵥ|\bQ\b|\bK\b|\bV\b|\bx\b)/g, value => {
  const key = {WQ:'W_Q',WK:'W_K',WV:'W_V',WO:'W_O',Wq:'W_Q',Wₒ:'W_O',Wₖ:'W_K',Wᵥ:'W_V'}[value] || value;
  return `<span class="sym" data-symbol="${key}" aria-describedby="sym-${key}">${value}</span>`;
});
let instance = 0;
const ys = [80,160,240];
const text = (x,y,label,cls='') => {
  const keys={Q:'Q',K:'K',V:'V',x:'x',Wq:'W_Q','Wₒ':'W_O','Wₖ':'W_K','Wᵥ':'W_V'};
  const content=label.split(/(WQ|WK|WV|WO|Wq|Wₒ|Wₖ|Wᵥ|\bQ\b|\bK\b|\bV\b|\bx\b)/g).map(part=>keys[part]?`<tspan class="sym" data-symbol="${keys[part]}" aria-describedby="sym-${keys[part]}">${part}</tspan>`:part).join('');
  return `<text x="${x}" y="${y}" class="${cls}" text-anchor="middle">${content}</text>`;
};
const node = (x,y,label,sub='',options={}) => {
  const {active=false,blocked=false,layer,position,head,symbol,ariaLabel,width=112} = options;
  const interactive = Number.isInteger(position);
  return `<g class="route-node ${active?'is-active':''} ${blocked?'is-blocked':''}" ${interactive?`role="button" tabindex="0" data-node-position="${position}" ${layer?`data-node-layer="${layer}"`:''} ${head?`data-node-head="${head}"`:''} aria-label="${ariaLabel || `Inspect ${layer?`layer ${layer}, `:''}${head?`head ${head}, `:''}${tokens[position]}`}"`:''}><title>${label}${sub?' — '+sub:''}</title><rect x="${x-width/2}" y="${y-23}" width="${width}" height="46" rx="7"/>${text(x,y-1,label,symbol?'sym':'')}${sub?text(x,y+14,sub,'route-node-sub'):''}</g>`;
};
const edge = (x1,y1,x2,y2,active=false,blocked=false,label='') => `<path class="route-edge ${active?'is-active':''} ${blocked?'is-blocked':''}" d="M${x1} ${y1} C${x1+(x2-x1)*.45} ${y1},${x2-(x2-x1)*.45} ${y2},${x2} ${y2}"/>${label?text((x1+x2)/2,(y1+y2)/2-8,label,'route-edge-label'):''}`;
const svg = (body,label) => `<div class="route-canvas" tabindex="0" aria-label="${label}; scroll horizontally on narrow screens"><svg viewBox="0 0 960 310" role="group" aria-label="${label}">${body}</svg></div>`;
export function mountVectorRoutes(root, initialPosition = 2) {
  disposeVisual(root);
  let layer=1,head=1,position=initialPosition,operation=0,timer=null,component=0,role='V',key=initialPosition,mapOpen=false,studioCleanup=null;
  const id=++instance, win=root.ownerDocument.defaultView;
  const stop=()=>{if(timer)win.clearInterval(timer);timer=null;};
  ownVisual(root,()=>{stop();studioCleanup?.();});
  const next=()=>{if(operation===11){if(layer===2){stop();return;}layer=2;operation=0;}else operation++;};
  function render(focus) {
    studioCleanup?.();studioCleanup=null;
    const data=routeState(layer,head,position), token=tokens[position], op=routeOperation(operation), step=op.phase;
    let whole = [100,370,640,860].map((x,i)=>text(x,24,['EMBEDDINGS','LAYER 1 OUTPUTS','LAYER 2 OUTPUTS','NEXT-TOKEN SCORES'][i],'route-column-label')).join('');
    whole += networkEdges().map(e=>edge([100,370,640][e.fromLayer]+58,ys[e.fromPosition],[100,370,640][e.toLayer]-58,ys[e.toPosition],e.toLayer===layer&&e.toPosition===position || layer===2&&e.toLayer===1&&e.toPosition<=position)).join('');
    whole += edge(698,240,802,240,layer===2&&position===2);
    for(let l=0;l<=2;l++)for(let i=0;i<3;i++) {
      const context=l===0?tokens[i]:tokens.slice(0,i+1).join(' · ');
      whole+=node([100,370,640][l],ys[i],tokens[i],context,{active:l===layer&&i===position,layer:l===0?1:l,position:i,ariaLabel:l===0?`Inspect embedding ${tokens[i]}`:`Inspect layer ${l} output, ${tokens[i]}`});
    }
    whole+=node(860,240,'Logits','vocabulary scores');
    whole+=text(100,292,'Starting vectors','route-caption')+text(505,292,'Subtitles: possible context · all heads combined','route-caption');
    let detail = text(100,24,layer===1?'EMBEDDINGS':'LAYER 1 OUTPUTS','route-column-label');
    const input = i=>node(100,ys[i],`x · ${tokens[i]}`,data.inputs[i].context.map(j=>tokens[j]).join(' · '),{active:i===position,position:i});
    if(step===0) {
      detail+=text(560,24,'PARALLEL HEAD INPUTS','route-column-label');
      detail+=edge(158,ys[position],470,90,true)+edge(158,ys[position],470,230,true);
      for(let i=0;i<3;i++)detail+=input(i);
      detail+=node(560,90,`x · ${token}`,'Head 1 · same incoming vector',{active:head===1,position,head:1,width:180})+node(560,230,`x · ${token}`,'Head 2 · same incoming vector',{active:head===2,position,head:2,width:180});
    }
    if(step===1) {
      detail+=text(440,24,`K/V CACHE · L${layer} / H${head}`,'route-column-label')+text(800,24,'CURRENT QUERY','route-column-label');
      for(let i=0;i<3;i++)detail+=edge(158,ys[i],372,ys[i],i<=position,false,'× Wₖ; × Wᵥ');
      detail+=`<path class="route-edge is-active" d="M158 ${ys[position]} C260 ${ys[position]},240 285,320 285 H744"/>`+text(555,265,'× Wq','route-edge-label');
      for(let i=0;i<3;i++)detail+=input(i)+node(440,ys[i],'K=x×Wₖ; V=x×Wᵥ',`L${layer} · H${head} · ${tokens[i]}`,{active:i<=position,width:210});
      detail+=node(800,285,'Q = x × Wq',`L${layer} · H${head} · ${token}`,{active:true});
    }
    if(step===2) {
      detail=text(100,24,'CURRENT QUERY','route-column-label')+text(390,24,'KEY ROWS','route-column-label')+text(650,24,'SCORES','route-column-label')+text(860,24,'SHARES','route-column-label');
      for(let i=0;i<3;i++)detail+=edge(158,160,332,ys[i],i<=position,i>position)+edge(448,ys[i],592,ys[i],i<=position,i>position,'dot ÷ √dₖ')+(i<=position?edge(708,ys[i],802,160,true):'');
      detail+=node(100,160,'Q',`L${layer} · H${head} · ${token}`,{active:true});
      for(let i=0;i<3;i++)detail+=node(390,ys[i],`K · ${tokens[i]}`,`L${layer} · H${head}`,{active:i<=position,blocked:i>position})+node(650,ys[i],i>position?'−∞':'score',i>position?'masked':'scaled dot product',{blocked:i>position});
      detail+=node(860,160,'Softmax','over allowed scores',{active:true});
    }
    if(step===3) {
      detail=text(100,24,'VALUE ROWS','route-column-label')+text(410,24,'CONTRIBUTIONS','route-column-label')+text(790,24,`HEAD ${head} RESULT`,'route-column-label');
      for(let i=0;i<3;i++)detail+=edge(158,ys[i],342,ys[i],i<=position,i>position,'× its share')+edge(478,ys[i],734,160,i<=position,i>position);
      for(let i=0;i<3;i++)detail+=node(100,ys[i],`V · ${tokens[i]}`,`L${layer} · H${head}`,{active:i<=position,blocked:i>position})+node(410,ys[i],i>position?'0':'share × V',tokens[i],{width:136,blocked:i>position});
      detail+=node(790,160,'Σ vectors',`L${layer} · H${head} · ${token}`,{active:true});
    }
    if(step===4) {
      detail=text(90,24,'HEAD RESULTS','route-column-label')+text(900,24,`LAYER ${layer} OUTPUT`,'route-column-label');
      detail+=edge(148,80,212,160,head===1)+edge(148,240,212,160,head===2)+edge(328,160,362,160,true)+edge(458,160,512,160,true)+edge(608,160,682,160,true)+edge(818,160,852,160,true)+edge(560,70,560,130,true);
      detail+=node(90,80,'Head 1',token,{active:head===1,position,head:1})+node(90,240,'Head 2',token,{active:head===2,position,head:2})+node(270,160,'Concat','join components')+node(410,160,'× Wₒ','matrix multiply',{width:96})+node(560,160,'+','residual addition',{width:96})+node(560,47,'Incoming x',token)+node(750,160,'FF + residual','same token',{width:136})+node(900,160,'Updated x',tokens.slice(0,position+1).join(' · '),{width:96,active:true});
    }
    if ((layer!==1 || head!==1) && step===1 && operation>=2) {
      detail = text(150,24,'INPUT × MATRIX COLUMN','route-column-label') + text(470,24,'COMPONENT PRODUCTS','route-column-label') + text(790,24,'ONE OUTPUT COMPONENT','route-column-label');
      detail += edge(260,100,360,100,true,'×') + edge(260,230,360,230,true,'×') + edge(580,100,700,160,operation===3,'+') + edge(580,230,700,160,operation===3,'+');
      detail += node(150,100,'x₁ × W₁ⱼ','input 1 · column j',{width:220}) + node(150,230,'xᵢ × Wᵢⱼ','repeat for other inputs i',{width:220});
      detail += node(470,100,'product₁','one multiplication',{width:220,active:operation===2}) + node(470,230,'productᵢ','one per input component',{width:220,active:operation===2});
      detail += node(790,160,'Σ products','component j of Q/K/V',{width:180,active:operation===3});
    }
    const numericType = step===1?'projections':step===2?'scores':step===3?'values':null;
    const numeric = layer===1 && head===1 && numericType;
    const calculation = numeric ? '<div data-studio-slot></div>' : svg(detail,'Selected head data flow');
    root.innerHTML=`<div class="route-toolbar" data-route-instance="${id}"><div class="route-playback"><button type="button" data-route-reset aria-label="Reset diagram">↺</button><button type="button" data-route-back ${operation===0?'disabled':''} aria-label="Previous operation">‹</button><button type="button" data-route-play aria-label="${timer?'Pause':'Play'} diagram" aria-pressed="${!!timer}">${timer?'Ⅱ':'▶'}</button><button type="button" data-route-next ${operation===11&&layer===2?'disabled':''} aria-label="${operation===11&&layer===1?'Follow into Layer 2':'Next operation'}">›</button></div><label>Layer<select data-route="layer">${[1,2].map(l=>`<option ${layer===l?'selected':''}>${l}</option>`).join('')}</select></label><label>Head<select data-route="head">${[1,2].map(h=>`<option ${head===h?'selected':''}>${h}</option>`).join('')}</select></label><label>Token<select data-route="position">${tokens.map((t,i)=>`<option value="${i}" ${position===i?'selected':''}>${t}</option>`).join('')}</select></label></div><details class="route-map" ${mapOpen?'open':''}><summary>Model map · layer ${layer} · ${token}</summary>${svg(whole,'Token vectors across the whole model')}</details><div class="route-stage" role="status"><span>Layer ${layer} · Head ${head} · ${token}</span><span>${operation+1}/12 · ${op.title}</span></div><div class="route-operation">${numeric&&operation===1?'':`<p class="route-formula">${textFormula(op.formula)}</p>`}<p>${op.why}</p></div>${calculation}<div class="route-legend">${numeric?'Invented 2-component example · layer 1, head 1 only · shared starting embeddings. Other heads/layers remain schematic.':'2-layer, 2-head MHA schematic · normalization omitted · lines show dependencies, not measured weights'}</div>`;
    root.classList.toggle('is-playing',!!timer);
    if(numeric)studioCleanup=mountStudio(root.querySelector('[data-studio-slot]'),numericType,{embedded:true,getRows:sharedRows,position,role,component,key,phase:({1:'overview',2:'products',3:'sum',4:'sum',5:'scale',6:'normalize',7:'products',8:'sum'})[operation],onSelect:state=>{stop();role=state.role;component=state.component;key=state.key;}});
    root.querySelector('.route-map').ontoggle=event=>{mapOpen=event.target.open;};
    root.querySelectorAll('[data-route]').forEach(select=>select.onchange=()=>{stop();const field=select.dataset.route;if(field==='layer'){layer=Number(select.value);operation=0;}if(field==='head')head=Number(select.value);if(field==='position'){position=Number(select.value);key=position;}render(`[data-route="${field}"]`);});
    root.querySelectorAll('[data-node-position]').forEach(n=>{const choose=()=>{stop();position=Number(n.dataset.nodePosition);key=position;if(n.dataset.nodeLayer){layer=Number(n.dataset.nodeLayer);operation=0;}if(n.dataset.nodeHead)head=Number(n.dataset.nodeHead);render('[data-route="position"]');};n.onclick=e=>{if(!e.target.closest('[data-symbol]'))choose();};n.onkeydown=e=>{if(e.target!==n)return;if(e.key==='Enter'||e.key===' '){e.preventDefault();choose();}};});
    root.querySelector('[data-route-back]').onclick=()=>{stop();operation=Math.max(0,operation-1);render('[data-route-back]');};
    root.querySelector('[data-route-next]').onclick=()=>{stop();next();render('[data-route-next]');};
    root.querySelector('[data-route-reset]').onclick=()=>{stop();layer=1;head=1;position=initialPosition;key=position;component=0;role='V';operation=0;render('[data-route-reset]');};
    root.querySelector('[data-route-play]').onclick=()=>{if(timer)stop();else {if(layer===2&&operation===11){layer=1;operation=0;}timer=win.setInterval(()=>{if(!root.isConnected || !root.getClientRects().length || !root.querySelector(`[data-route-instance="${id}"]`)){stop();return;}next();render();},1800);}render('[data-route-play]');};
    if(focus){const target=root.querySelector(focus);(target&&!target.disabled?target:root.querySelector('[data-route-back]:not(:disabled),[data-route-reset]'))?.focus({preventScroll:true});}
  }
  root.classList.add('vector-routes','teaching-visual');root.setAttribute('aria-label','Token vector routes through layers and heads');render();
}
