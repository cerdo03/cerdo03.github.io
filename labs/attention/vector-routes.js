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
const mounts = new WeakMap();
let instance = 0;
const ys = [80,160,240];
const text = (x,y,label,cls='') => {
  const keys={Q:'Q',K:'K',V:'V',x:'x',Wq:'W_Q','Wₒ':'W_O','Wₖ':'W_K','Wᵥ':'W_V'};
  const content=label.split(/(Wq|Wₒ|Wₖ|Wᵥ|\bQ\b|\bK\b|\bV\b|\bx\b)/g).map(part=>keys[part]?`<tspan class="sym" data-symbol="${keys[part]}" aria-describedby="sym-${keys[part]}">${part}</tspan>`:part).join('');
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
  mounts.get(root)?.();
  let layer=1,head=1,position=initialPosition,step=0,timer=null;
  const id=++instance, win=root.ownerDocument.defaultView;
  const stop=()=>{if(timer)win.clearInterval(timer);timer=null;};
  mounts.set(root,stop);
  const next=()=>{if(step===4){if(layer===2){stop();return;}layer=2;step=0;}else step++;};
  function render(focus) {
    const data=routeState(layer,head,position), token=tokens[position];
    let whole = [100,370,640,860].map((x,i)=>text(x,24,['EMBEDDINGS','LAYER 1 OUTPUTS','LAYER 2 OUTPUTS','NEXT-TOKEN SCORES'][i],'route-column-label')).join('');
    whole += networkEdges().map(e=>edge([100,370,640][e.fromLayer]+58,ys[e.fromPosition],[100,370,640][e.toLayer]-58,ys[e.toPosition],e.toLayer===layer&&e.toPosition===position || layer===2&&e.toLayer===1&&e.toPosition<=position)).join('');
    whole += edge(698,240,802,240,layer===2&&position===2);
    for(let l=0;l<=2;l++)for(let i=0;i<3;i++) {
      const context=l===0?tokens[i]:tokens.slice(0,i+1).join(' · ');
      whole+=node([100,370,640][l],ys[i],tokens[i],context,{active:l===layer&&i===position,layer:l===0?1:l,position:i,ariaLabel:l===0?`Inspect embedding ${tokens[i]}`:`Inspect layer ${l} output, ${tokens[i]}`});
    }
    whole+=node(860,240,'Logits','vocabulary scores');
    whole+=text(100,292,'Starting vectors','route-caption')+text(505,292,'Completed blocks · all heads combined','route-caption');
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
      for(let i=0;i<3;i++)detail+=edge(158,ys[i],372,ys[i],i<=position,false,'Wₖ, Wᵥ');
      detail+=`<path class="route-edge is-active" d="M158 ${ys[position]} C260 ${ys[position]},240 285,320 285 H744"/>`+text(555,275,'Wq','route-edge-label');
      for(let i=0;i<3;i++)detail+=input(i)+node(440,ys[i],'K  |  V',`L${layer} · H${head} · ${tokens[i]}`,{active:i<=position,width:136});
      detail+=node(800,285,'Q',`L${layer} · H${head} · ${token}`,{active:true});
    }
    if(step===2) {
      detail=text(100,24,'CURRENT QUERY','route-column-label')+text(390,24,'KEY ROWS','route-column-label')+text(650,24,'SCORES','route-column-label')+text(860,24,'SHARES','route-column-label');
      for(let i=0;i<3;i++)detail+=edge(158,160,332,ys[i],i<=position,i>position)+edge(448,ys[i],592,ys[i],i<=position,i>position,'scaled Q · K')+(i<=position?edge(708,ys[i],802,160,true):'');
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
      detail+=node(90,80,'Head 1',token,{active:head===1,position,head:1})+node(90,240,'Head 2',token,{active:head===2,position,head:2})+node(270,160,'Concat','join components')+node(410,160,'Wₒ','output projection',{width:96})+node(560,160,'+','residual addition',{width:96})+node(560,47,'Incoming x',token)+node(750,160,'FF + residual','same token',{width:136})+node(900,160,'Updated x',tokens.slice(0,position+1).join(' · '),{width:96,active:true});
    }
    root.innerHTML=`<div class="route-toolbar" data-route-instance="${id}"><div class="route-playback"><button type="button" data-route-reset aria-label="Reset diagram">↺</button><button type="button" data-route-back ${step===0?'disabled':''} aria-label="Previous operation">‹</button><button type="button" data-route-play aria-label="${timer?'Pause':'Play'} diagram" aria-pressed="${!!timer}">${timer?'Ⅱ':'▶'}</button><button type="button" data-route-next ${step===4&&layer===2?'disabled':''} aria-label="${step===4&&layer===1?'Follow into Layer 2':'Next operation'}">›</button></div><label>Layer<select data-route="layer">${[1,2].map(l=>`<option ${layer===l?'selected':''}>${l}</option>`).join('')}</select></label><label>Head<select data-route="head">${[1,2].map(h=>`<option ${head===h?'selected':''}>${h}</option>`).join('')}</select></label><label>Token<select data-route="position">${tokens.map((t,i)=>`<option value="${i}" ${position===i?'selected':''}>${t}</option>`).join('')}</select></label></div><div class="route-map">${svg(whole,'Token vectors across the whole model')}</div><div class="route-stage" role="status"><span>Layer ${layer} · Head ${head} · ${token}</span><span>${step+1}/5 · ${['Shared inputs','Q/K/V projections','Query–key comparison','Weighted values','Complete block'][step]}</span></div>${svg(detail,'Selected head data flow')}<div class="route-legend">2-layer, 2-head MHA schematic · normalization omitted · lines show dependencies, not measured weights</div>`;
    root.classList.toggle('is-playing',!!timer);
    root.querySelectorAll('select').forEach(select=>select.onchange=()=>{stop();const key=select.dataset.route;if(key==='layer'){layer=Number(select.value);step=0;}if(key==='head')head=Number(select.value);if(key==='position')position=Number(select.value);render(`[data-route="${key}"]`);});
    root.querySelectorAll('[data-node-position]').forEach(n=>{const choose=()=>{stop();position=Number(n.dataset.nodePosition);if(n.dataset.nodeLayer){layer=Number(n.dataset.nodeLayer);step=0;}if(n.dataset.nodeHead)head=Number(n.dataset.nodeHead);render('[data-route="position"]');};n.onclick=e=>{if(!e.target.closest('[data-symbol]'))choose();};n.onkeydown=e=>{if(e.target!==n)return;if(e.key==='Enter'||e.key===' '){e.preventDefault();choose();}};});
    root.querySelector('[data-route-back]').onclick=()=>{stop();step=Math.max(0,step-1);render('[data-route-back]');};
    root.querySelector('[data-route-next]').onclick=()=>{stop();next();render('[data-route-next]');};
    root.querySelector('[data-route-reset]').onclick=()=>{stop();layer=1;head=1;position=initialPosition;step=0;render('[data-route-reset]');};
    root.querySelector('[data-route-play]').onclick=()=>{if(timer)stop();else {if(layer===2&&step===4){layer=1;step=0;}timer=win.setInterval(()=>{if(!root.querySelector(`[data-route-instance="${id}"]`)){stop();return;}next();render();},1800);}render('[data-route-play]');};
    if(focus)root.querySelector(focus)?.focus({preventScroll:true});
  }
  root.classList.add('vector-routes');root.setAttribute('aria-label','Token vector routes through layers and heads');render();
}
