import { renderMath } from './math-renderer.js';
import { glossary } from '../attention/glossary.js';
import { stableSoftmax, mountMathExercises, dot, rawKvBytes, toMiB } from './math-exercises.js';
import { projectionTrace, valueTrace } from './visual-model.js';
export const equationDefinitions={
 'softmax-stable':{
  tex:String.raw`a_j=\frac{e^{z_j-m}}{\sum_k e^{z_k-m}},\qquad m=\max_k z_k`,
  label:'Stable softmax: each shifted exponential divided by their sum',
  purpose:'Turn a row of scores into nonnegative weights that sum to one, while avoiding exponential overflow.',
  symbols:{'aⱼ':'One output weight, selected by free index j','zⱼ':'The score at position j','k':'Reduction index: visits every allowed position in the denominator','m':'Maximum score in this row'},
  steps:['Read one output first: j selects one numerator and one resulting weight.','The denominator sums the shifted exponentials over k. It is shared by every output in the row.','Subtracting m multiplies the numerator and denominator by the same factor exp(−m), so the ideal real-number ratio is unchanged. Floating-point implementations differ: shifting prevents overflow.'],
  practice:'softmax',origin:'softmax',lesson:4,
 },
 'qkv-projection':{
  tex:String.raw`Q=XW_Q,\qquad K=XW_K,\qquad V=XW_V`,label:'Queries, keys and values are learned projections of input representations',
  purpose:'Create three distinct views of the same token representations for matching and value mixing.',symbols:{X:'',Q:'',K:'',V:'',W_Q:'',W_K:'',W_V:''},
  steps:['Each row of X represents one token. Right-multiplying by a learned projection mixes its components.','For X shaped T × d_model and W_Q shaped d_model × d_k, Q has shape T × d_k. K has the same key width; V may have a different value width.','The input is shared, but the projection matrices are distinct. These equations describe a head, not three copies of one computed vector.'],practice:'transformer',origin:'projections',lesson:5,
 },
 'attention-scores':{
  tex:String.raw`S_{\mathrm{scaled}}=\frac{QK^{\mathsf T}}{\sqrt{d_k}}`,label:'Scaled query-key dot products form attention scores',
  purpose:'Compare every query with each key, scaled by the square root of the shared key width.',symbols:{Q:'',K:'',d_k:'',S_scaled:''},
  steps:['Transpose changes K from T_k × d_k into d_k × T_k.','Matrix multiplication reduces over the shared component dimension d_k. The output has shape T_q × T_k.','Divide each score by the positive scalar √d_k. This preserves shape and controls score scale; these scores are not yet probabilities.'],practice:'shapes',origin:'scores',lesson:3,
 },
 'masked-attention':{
  tex:String.raw`A=\operatorname{softmax}_{\mathrm{row}}(S_{\mathrm{scaled}}+M)`,label:'Row softmax normalizes allowed scores after adding the mask',
  purpose:'Normalize allowed key positions and assign exact zero weight to blocked positions.',symbols:{A:'',S_scaled:'',M:''},
  steps:['Add zero at allowed positions and negative infinity at blocked positions. A causal row allows keys at or before its query position.','Normalize each row independently. An allowed finite score may get a very small positive ideal weight; a masked negative-infinity score gets exactly zero.','At least one position must remain allowed. An all-masked row has no probability distribution and is rejected in this teaching implementation.'],practice:'softmax',origin:'masking',lesson:4,
 },
 'weighted-values':{
  tex:String.raw`O=AV,\qquad O_{ij}=\sum_{k=1}^{T_k}A_{ik}V_{kj}`,label:'An output component sums attention weights times corresponding value components',
  purpose:'Mix value rows using each query row’s attention weights.',symbols:{O:'',A:'',V:'','i':'Free index: selects one query row','j':'Free index: selects one output component','k':'Bound index: visits key/value positions'},
  steps:['Hold i and j fixed to read one scalar output. The sum index k visits key/value positions.','Aᵢₖ supplies one weight and Vₖⱼ the corresponding value component. Multiply paired entries and add.','If A is T_q × T_k and V is T_k × d_v, O is T_q × d_v. Values may be negative; attention weights are nonnegative.'],practice:'indices',origin:'values',lesson:2,
 },
 'kv-memory':{
  tex:String.raw`M_{\mathrm{KV}}=2\,L\,T\,H_{\mathrm{KV}}\,D\,B`,label:'Raw key-value cache bytes equal two times layers, tokens, key-value heads, head dimension and bytes per element',
  purpose:'Count the raw stored key and value elements for one sequence, then convert elements to bytes.',symbols:{M_KV:'',L:'',T:'',H_KV:'',D:'',B:''},
  steps:['The factor 2 counts both key and value tensors. Multiply by layers, cached tokens, KV heads and elements per head.','B converts stored elements to bytes. Query head count is not substituted for KV head count in grouped-query attention.','This is raw tensor storage for one sequence. Runtime allocation, metadata, fragmentation and other model memory are excluded. MiB uses 2²⁰ bytes, unlike decimal MB.'],practice:'transformer',origin:'kv',lesson:5,
 },
};
export function computeExample(id){
 if(id==='softmax-stable'){const scores=[4,8,2,6],weights=stableSoftmax(scores);return `Illustrative scores [4, 8, 2, 6]. Maximum m = 8. Shifted scores [−4, 0, −6, −2]. Computed weights ≈ [${weights.map(x=>x.toFixed(6)).join(', ')}]. Score 8 receives the largest weight; their sum is approximately 1.`;}
 if(id==='qkv-projection'){const x=[1,2],matrix=[[1,0],[2,1]],traces=[0,1].map(j=>projectionTrace(x,matrix,j));return `Separate invented 2D example, not the course model: x = [1, 2], W_Q rows [1, 0] and [2, 1]. Q components: 1 × 1 + 2 × 2 = ${traces[0].total}; 1 × 0 + 2 × 1 = ${traces[1].total}. Thus q = [${traces.map(t=>t.total).join(', ')}]. Different W_K and W_V would produce their respective projections.`;}
 if(id==='attention-scores'){const q=[1,2],keys=[[2,0],[0,1]],raw=keys.map(k=>dot(q,k));return `Separate invented 2D example: q = [1, 2], keys [2, 0] and [0, 1], d_k = 2. Dot products [${raw.join(', ')}]; scaled scores ≈ [${raw.map(x=>(x/Math.sqrt(2)).toFixed(6)).join(', ')}]. One query and two keys produce a 1 × 2 score row.`;}
 if(id==='masked-attention'){const weights=stableSoftmax([2,1,-Infinity]);return `Illustrative scaled scores [2, 1, 9], mask [0, 0, −∞]. Masked scores [2, 1, −∞]. Weights ≈ [${weights.map(x=>x.toFixed(6)).join(', ')}]. The last weight is exactly zero because it is blocked; the first two sum to approximately 1.`;}
 if(id==='weighted-values'){const weights=[.25,.75],values=[[2,4],[6,0]],traces=[0,1].map(j=>valueTrace(values,weights,j));return `Separate invented example: weights [0.25, 0.75]; value rows [2, 4] and [6, 0]. Component 1: 0.25 × 2 + 0.75 × 6 = ${traces[0].total}. Component 2: 0.25 × 4 + 0.75 × 0 = ${traces[1].total}. Output [${traces.map(t=>t.total).join(', ')}] is a weighted mixture, not a cached key or value.`;}
 if(id==='kv-memory'){const bytes=rawKvBytes({layers:32,tokens:4096,kvHeads:8,headDim:128,bytesPerElement:2});return `Illustrative dimensions: 2 × 32 × 4096 × 8 × 128 × 2 = ${bytes.toLocaleString('en-US')} bytes = ${toMiB(bytes)} MiB. Halving KV heads or bytes per element halves this raw storage. It excludes allocation overhead and all other model memory.`;}
 throw new RangeError('Unknown authored equation.');
}
function node(tag,text){const item=document.createElement(tag);if(text)item.textContent=text;return item;}
function disclosure(title){const details=node('details');details.append(node('summary',title));return details;}
export function mountEquationExplorers(root=document){
 const hosts=[...(root.matches?.('[data-equation]')?[root]:[]),...root.querySelectorAll('[data-equation]')];
 for(const host of hosts){
  const definition=equationDefinitions[host.dataset.equation];if(!definition||host.dataset.equationMounted)continue;
  host.dataset.equationMounted='true';host.replaceChildren();host.classList.add('equation-explorer');
  const equation=node('div');equation.className='explorer-equation';host.append(equation,node('p',definition.purpose));
  renderMath(equation,definition.tex,{displayMode:true,label:definition.label});
  const key=node('dl');key.className='explorer-key';
  for(const [symbol,meaning] of Object.entries(definition.symbols)){key.append(node('dt',symbol),node('dd',glossary[symbol]||meaning));}host.append(key);
  const decode=disclosure('Decode');for(const step of definition.steps)decode.append(node('p',step));
  if(host.dataset.equation==='softmax-stable'){
   for(const [title,tex] of [['Original softmax',String.raw`a_j=\frac{e^{z_j}}{\sum_k e^{z_k}}`],['Choose row maximum',String.raw`m=\max_k z_k`],['Numerically stable form',String.raw`a_j=\frac{e^{z_j-m}}{\sum_k e^{z_k-m}}`]]){
    const stage=node('div');decode.append(node('p',title),stage);renderMath(stage,tex,{displayMode:true,label:title});
   }
  }
  const compute=disclosure('Compute'),prediction=node('p',host.dataset.equation==='softmax-stable'?'Before revealing: predict m for [4, 8, 2, 6], the largest weight, and whether shifting all scores changes ideal probabilities.':'Before revealing: identify the output shape, reduced axis or storage unit, then work through the example independently.'),reveal=disclosure('Reveal numerical example');
  reveal.append(node('p',computeExample(host.dataset.equation)));compute.append(prediction,reveal);
  const practice=disclosure('Practice'),exercise=node('div');exercise.dataset.mathExercise=definition.practice;practice.append(exercise);
  const learn=node('a','Read the optional math toolkit');learn.href=`../math-fluency/lesson-${definition.lesson}.html?from=${definition.origin}`;
  const understand=disclosure('Understand this equation');understand.append(decode,compute,practice,learn);host.append(understand);mountMathExercises(host);
 }
 return hosts;
}
if(typeof document!=='undefined')mountEquationExplorers();
