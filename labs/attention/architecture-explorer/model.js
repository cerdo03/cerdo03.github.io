// Schematic architecture, exact dimensions. No invented weights or GPU measurements.
// Reuse Module 2's tested mapping and raw KV accounting; one sequence, two layers.
import { gqaMapping, kvBytes } from '../attention-math.js';
export const OPTIONS = Object.freeze({
  qHeads: [4,8,16,32], headDim: [16,32,64,128], tokens: [3,8,128,2048,8192],
  kvHeads: q => Array.from({length:q},(_,i)=>i+1).filter(n=>q%n===0)
});
export function configuration(changes = {}) {
  const c = {qHeads:8,kvHeads:8,headDim:64,tokens:3,...changes};
  for (const key of ['qHeads','headDim','tokens']) if (!OPTIONS[key].includes(c[key])) throw new RangeError(`Unsupported ${key}`);
  const mapping = gqaMapping(c.qHeads,c.kvHeads), width = c.qHeads*c.headDim;
  const params = {layers:2,seqLen:c.tokens,kvHeads:c.kvHeads,headDim:c.headDim,bytesPerElem:2};
  return {...c,width,layers:2,bytesPerElem:2,mapping,bytes:kvBytes(params),mhaBytes:kvBytes({...params,kvHeads:c.qHeads}),shapes:{
    q:[c.tokens,c.qHeads,c.headDim],kv:[c.tokens,c.kvHeads,c.headDim],joined:[c.tokens,width],output:[c.tokens,width]
  }};
}
export function memoryComparison(c) {
  return [['MHA',c.qHeads],['GQA',Math.max(2,c.qHeads/4)],['MQA',1]].map(([kind,kvHeads])=>{
    const actual=configuration({...c,kvHeads});
    return {kind,kvHeads,bytes:actual.bytes,ratio:actual.bytes/actual.mhaBytes};
  });
}
export const shapeText = shape => `[${shape.join(' × ')}]`;
export function memoryText(bytes) {
  return bytes < 1024 ? `${bytes} B` : bytes < 1048576 ? `${Number((bytes/1024).toFixed(2))} KiB` : `${Number((bytes/1048576).toFixed(2))} MiB`;
}
export const VIEWS = Object.freeze({overview:'Model overview',block:'Decoder block',attention:'Causal attention',heads:'Query ↔ KV heads',qkv:'Q/K/V projections',ffn:'Feed-forward network'});
const node = (id,label,x,y,role='neutral',target=null) => ({id,label,x,y,role,target});
const chain = nodes => nodes.slice(1).map((n,i)=>({from:nodes[i].id,to:n.id}));
export function sceneModel(view,c,layer=0) {
  let nodes,edges;
  switch(view) {
    case 'overview':
      nodes=[node('embedding','Token + position embeddings',0,5,'query'),node('block-0','Decoder block 1',0,2.5,'key','block'),node('block-1','Decoder block 2',0,0,'key','block'),node('finalnorm','Final LayerNorm',0,-2.5),node('logits','Vocabulary projection → logits',0,-5,'value')];break;
    case 'block':
      nodes=[node('input',`Block ${layer+1} input`,0,6.3),node('norm1','1 · LayerNorm',0,4.5),node('attention','2 · Causal attention',0,2.7,'query','attention'),node('add1','3 · Add attention update',0,.9,'value'),node('norm2','4 · LayerNorm',0,-.9),node('ffn','5 · Feed-forward network',0,-2.7,'key','ffn'),node('add2','6 · Add FFN update',0,-4.5,'value'),node('output','Updated token vectors',0,-6.3)];
      edges=[...chain(nodes),{from:'input',to:'add1',residual:true,label:'input bypass'},{from:'add1',to:'add2',residual:true,label:'second bypass'}];break;
    case 'attention':
      nodes=[node('normalized','Normalized token vectors',0,5),node('qkv','Project Q / K / V',0,2.5,'query','qkv'),node('heads',`${c.qHeads} Q heads → ${c.kvHeads} KV heads`,0,0,'key','heads'),node('concat','Concatenate head results',0,-2.5),node('projection','Output projection',0,-5,'value')];break;
    case 'heads': {
      const rows=Math.ceil(c.qHeads/8),gap=2;
      nodes=Array.from({length:c.qHeads},(_,h)=>node(`head-${h}`,`Q head ${h} → KV ${c.mapping.mapping[h]}`,(h%8-3.5)*2.35,2+(rows-1-Math.floor(h/8))*gap,'query'));
      const kvRows=Math.ceil(c.kvHeads/8);
      nodes.push(...Array.from({length:c.kvHeads},(_,g)=>node(`kv-${g}`,`K${g} / V${g}`,(g%8-3.5)*2.35,-2-Math.floor(g/8)*gap,'value')));
      // Center each short row. Keep distinct physical K/V groups; never duplicate caches.
      for (const prefix of ['head-','kv-']) {
        const list=nodes.filter(n=>n.id.startsWith(prefix));
        for(let row=0;row<Math.ceil(list.length/8);row++) {
          const rowNodes=list.slice(row*8,row*8+8),offset=(8-rowNodes.length)*2.35/2;
          rowNodes.forEach(n=>n.x+=offset);
        }
      }
      edges=Array.from({length:c.qHeads},(_,h)=>({from:`head-${h}`,to:`kv-${c.mapping.mapping[h]}`,label:'reads shared K/V'}));
      break;
    }
    case 'qkv':
      nodes=[node('normalized','Same full normalized input',0,3.5),node('q','Query projections',-4,0,'query'),node('k','Key projections',0,0,'key'),node('v','Value projections',4,0,'value')];
      edges=['q','k','v'].map(to=>({from:'normalized',to}));break;
    case 'ffn':
      nodes=[node('norm2','Normalized input',0,4.5),node('linear1',`Linear · ${c.width} → ${4*c.width}`,0,1.5,'key'),node('gelu','GELU · nonlinear activation',0,-1.5),node('linear2',`Linear · ${4*c.width} → ${c.width}`,0,-4.5,'value')];break;
    default: throw new RangeError('Unknown architecture view');
  }
  return {nodes,edges:edges||chain(nodes)};
}
export function inspect(c,id,position=0,layer=0) {
  if(!Number.isInteger(position)||position<0||position>=c.tokens)throw new RangeError('Token position out of range');
  const w=c.width,t=c.tokens,d=c.headDim,h=c.qHeads,k=c.kvHeads,full=[t,w];
  const base={title:'Follow one token through the model',body:`A two-layer, pre-normalized causal decoder. Each layer keeps one vector per position; selected position ${position} may use positions 0 through ${position}. Connections show dependencies, not measured attention weights.`,formula:'tokens → embeddings + positions → 2 decoder blocks → final norm → logits',shapes:[['Token representations',full]],optional:false};
  const entries={
    embedding:{title:'Start with token and position embeddings',body:'“The sky is” names the first three schematic positions (not a tokenizer result). This GPT-style example adds learned position embeddings to token embeddings. Other models may use rotary position encoding inside attention. Every head later receives the entire normalized input vector.',formula:'token embedding + position embedding → input',shapes:[['Input to block 1',full]]},
    normalized:{title:'Same full input, separate learned projections',body:'In this pre-norm model, LayerNorm runs before Q/K/V projection. Every query head and KV group receives the same full normalized input at this layer. Head dimensions split projected outputs, not slices of the original embedding.',formula:'Q = normalized input × query matrix; K and V use their own matrices',shapes:[['Normalized input',full]]},
    qkv:{title:'Project first. Then reshape into heads.',body:`There are ${h} distinct query projections and ${k} distinct key/value projection pairs. Within a KV group, query heads share K and V, but keep their own Q and attention weights. Matrices differ between layers.`,formula:'normalized input × learned projection → projected columns → head axes',shapes:[['Q, logical token/head/component axes',c.shapes.q],['K and V, each',c.shapes.kv]]},
    q:{title:'Queries: one learned projection per query head',body:`Each query head projects the full ${w}-component normalized vector into ${d} components. Combined query columns are reshaped into ${h} query heads. Queries are transient; they are not part of the KV cache.`,formula:'Qᵢ = normalized input × query matrix for head i',shapes:[['Per-head query matrix',[w,d]],['All query heads',c.shapes.q]]},
    k:{title:'Keys: shared only within a KV group',body:`Each of the ${k} KV heads has its own key matrix. Its keys are read by ${c.mapping.groupSize} query heads. The logical cache stores one copy per KV head per position per layer.`,formula:'K𝗀 = normalized input × key matrix for group g',shapes:[['Per-group key matrix',[w,d]],['All keys at this layer',c.shapes.kv]]},
    v:{title:'Values: content mixed by attention',body:`Each KV group has a separate value projection, also shared by ${c.mapping.groupSize} query heads. Each query head weights those same values differently. Attention output does not replace cached K/V.`,formula:'V𝗀 = normalized input × value matrix for group g',shapes:[['Per-group value matrix',[w,d]],['All values at this layer',c.shapes.kv]]},
    heads:{title:'Separate questions, shared keys and values',body:`${c.mapping.kind}: ${h} query heads, ${k} KV heads, ${c.mapping.groupSize} query heads per group. Query head i reads KV head floor(i / ${c.mapping.groupSize}); indices start at zero. Each query head still produces its own ${d}-component result.`,formula:'headᵢ = softmax(Qᵢ K𝗀ᵀ / √D + causal mask) V𝗀',shapes:[['Per-head full causal score matrix',[t,t]],['All head results',c.shapes.q]]},
    concat:{title:'Concatenate results, not Q/K/V',body:`Place ${h} head results side by side. Each has ${d} components: ${h} × ${d} = ${w}. The number of KV heads changes neither the number of query-head results nor their concatenated width.`,formula:'join(head₀, …, last head) → concatenated result',shapes:[['Concatenated result',c.shapes.joined]]},
    projection:{title:'Mix head results into one attention update',body:'A learned output matrix mixes the concatenated head results. This produces one model-width update for each position, ready for the residual addition. It is not the next layer’s cached value.',formula:'attention update = concatenated results × output matrix',shapes:[['Output matrix',[w,w]],['Attention update',full]]},
    norm1:{title:'Optional · LayerNorm before attention',body:'Normalize each token vector across its model-width components; then apply learned scale and shift. It does not mix token positions. This is a pre-norm decoder: normalization sits inside the attention branch, before projections.',formula:'normalize each row: subtract mean, divide by √(variance + ε), then scale and shift',shapes:[['Before and after LayerNorm',full]],optional:true},
    norm2:{title:'Optional · LayerNorm before FFN',body:'A second, separately learned LayerNorm normalizes each position’s updated vector before the feed-forward branch. The residual bypass preserves the unnormalized vector.',formula:'FFN input = LayerNorm(after attention addition)',shapes:[['Before and after LayerNorm',full]],optional:true},
    add1:{title:'Optional · Add the attention update',body:'Add the incoming block vector and attention update component by component at the same position. The bypass skips both the first LayerNorm and attention. This keeps a direct path for the incoming representation.',formula:'after attention = block input + attention(LayerNorm(block input))',shapes:[['Both operands and result',full]],optional:true},
    add2:{title:'Optional · Add the feed-forward update',body:'Add the feed-forward result to the vector after the first addition. Both branches have identical shape. The second bypass skips the second LayerNorm and FFN; it does not start at the original embedding.',formula:'block output = after attention + FFN(LayerNorm(after attention))',shapes:[['Both operands and result',full]],optional:true},
    ffn:{title:'Optional · Feed-forward network',body:`At every position, the same learned network expands ${w} components to ${4*w}, applies GELU, then contracts to ${w}. This schematic uses a 4× hidden width. The FFN mixes components within a token; attention mixes information across allowed positions.`,formula:'FFN(input) = GELU(input × first matrix + bias) × second matrix + bias',shapes:[['FFN input',full],['Expanded features',[t,4*w]],['FFN output',full]],optional:true},
    linear1:{title:'Optional · Expand features',body:'A learned affine map expands each position independently to four times the model width. It uses the same weights at every token position.',formula:'expanded features = input × first matrix + bias',shapes:[['First matrix',[w,4*w]],['Expanded features',[t,4*w]]],optional:true},
    gelu:{title:'Optional · GELU activation',body:'A nonlinear function acts on each expanded component. Without a nonlinearity, two affine maps could collapse to one affine map. No token positions are mixed here.',formula:'GELU(component) = component × Φ(component); Φ is the standard normal CDF',shapes:[['Before and after activation',[t,4*w]]],optional:true},
    linear2:{title:'Optional · Contract to model width',body:'The second affine map returns the expanded features to model width so the FFN update can be added to the residual vector.',formula:'FFN update = activated features × second matrix + bias',shapes:[['Second matrix',[4*w,w]],['FFN update',full]],optional:true},
    finalnorm:{title:'Optional · Final normalization',body:'After both decoder blocks, apply a final LayerNorm independently to each token vector. This GPT-style pre-norm choice is one architecture variant, not a requirement shared by all transformers.',formula:'final vectors = LayerNorm(block 2 output)',shapes:[['Final vectors',full]],optional:true},
    logits:{title:'Optional · From final vectors to next-token scores',body:'A learned vocabulary projection produces one logit per vocabulary entry. Softmax converts logits to probabilities; a generation policy selects the next token using the last processed position. A selected token has no K/V until it is processed. No token is predicted by this schematic.',formula:'final vector × vocabulary matrix → logits → softmax → next-token distribution',shapes:[['All final vectors',full]],optional:true},
    input:{title:`Block ${layer+1} input`,body:layer===0?'Block 1 receives token plus position embeddings, one vector per position.':'Block 2 receives block 1’s updated vectors. It computes fresh Q/K/V with its own weights; earlier layers’ caches are separate.',formula:'one vector per token position',shapes:[['Block input',full]]},
    output:{title:'Each position keeps an updated vector',body:'This block’s output becomes the next block’s input (or final normalization after block 2). Q/K/V are intermediates inside a layer, not the final layer output.',formula:'updated vectors → next block or final normalization',shapes:[['Block output',full]]},
  };
  if(id?.startsWith('head-')) {
    const head=Number(id.slice(5)),group=c.mapping.kvHeadForQuery(head);
    return {...base,title:`Query head ${head} reads KV head ${group}`,body:`At position ${position}, this head’s own query reads KV head ${group} at positions 0 through ${position}; future positions are masked. ${c.mapping.groupSize} query heads share this K/V pair but compute their own weights. No numerical attention weights are calculated here.`,formula:'softmax(query row × allowed keysᵀ / √D) × allowed values',shapes:[['Query row',[1,d]],['Allowed K and V, each',[position+1,d]],['Score / weight row',[1,position+1]],['Head result',[1,d]]]};
  }
  if(id?.startsWith('kv-')) {
    const group=Number(id.slice(3));
    if(!c.mapping.groups[group])throw new RangeError('KV head out of range');
    return {...base,title:`KV head ${group} · stored once`,body:`Query heads ${c.mapping.groups[group].join(', ')} read this group’s keys and values. K and V are different projections, each with ${t} rows of ${d} components at this layer. Q and attention output are not cached.`,formula:'one key vector + one value vector per token, per KV head, per layer',shapes:[['Keys',[t,d]],['Values',[t,d]]]};
  }
  if(id?.startsWith('block-'))return {...base,title:`Decoder block ${Number(id.slice(6))+1}`,body:'Open this block to trace LayerNorm → attention → residual addition → LayerNorm → FFN → residual addition. Two blocks have independent weights and caches, but identical shapes.',formula:'pre-norm causal decoder block',optional:false};
  return {...base,...entries[id]};
}
