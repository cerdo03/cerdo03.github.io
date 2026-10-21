import { renderMath } from './math-renderer.js';
// Pure arithmetic and authored checkpoints. Visitor answers never leave this page.
export function stableSoftmax(logits) {
 if(!Array.isArray(logits)||!logits.length||logits.some(x=>typeof x!=='number'||Number.isNaN(x)||x===Infinity)) throw new RangeError('Use a nonempty row of finite scores; −Infinity may mark blocked positions.');
 let maximum=-Infinity;
 for(const value of logits) if(value>maximum) maximum=value;
 if(maximum===-Infinity) throw new RangeError('At least one position must remain unmasked.');
 const exponents=logits.map(value=>value===-Infinity?0:Math.exp(value-maximum));
 const denominator=exponents.reduce((sum,value)=>sum+value,0);
 return exponents.map(value=>value/denominator);
}
export function matmulShape(left,right) {
 validateShape(left);validateShape(right);
 if(left[1]!==right[0])throw new RangeError(`Cannot multiply ${left.join(' × ')} by ${right.join(' × ')}: inner dimensions must match.`);
 return [left[0],right[1]];
}
function validateShape(shape){if(!Array.isArray(shape)||shape.length!==2||shape.some(n=>!Number.isSafeInteger(n)||n<1))throw new RangeError('A matrix shape needs two positive integer dimensions.');}
export function transposeShape(shape){validateShape(shape);return [shape[1],shape[0]];}
export function dot(a,b){
 if(!Array.isArray(a)||!Array.isArray(b)||!a.length||a.length!==b.length||[...a,...b].some(x=>!Number.isFinite(x)))throw new RangeError('Dot products need equally sized, nonempty finite vectors.');
 const result=a.reduce((sum,value,i)=>sum+value*b[i],0);if(!Number.isFinite(result))throw new RangeError('Dot product overflow.');return result;
}
export function rawKvBytes({layers,tokens,kvHeads,headDim,bytesPerElement}) {
 const factors=[2,layers,tokens,kvHeads,headDim,bytesPerElement];
 if(factors.some(x=>!Number.isSafeInteger(x)||x<1))throw new RangeError('KV dimensions and byte size must be positive safe integers.');
 const bytes=factors.reduce((a,b)=>a*b,1);if(!Number.isSafeInteger(bytes))throw new RangeError('KV byte count exceeds exact integer range.');return bytes;
}
export function toMiB(bytes){if(!Number.isFinite(bytes)||bytes<0)throw new RangeError('Use a finite nonnegative byte count.');return bytes/(1024*1024);}
export const indexedExample=Object.freeze({a:[[1,2,3,4,5,6],[6,5,4,3,2,1]],v:[[1,2],[2,1],[1,0],[0,1],[2,2],[1,3]]});
export function indexedTerms(i,j){
 if(!Number.isInteger(i)||!Number.isInteger(j)||i<0||i>=2||j<0||j>=2)throw new RangeError('Choose an authored row and column.');
 return indexedExample.a[i].map((value,k)=>({k:k+1,left:value,right:indexedExample.v[k][j],product:value*indexedExample.v[k][j]}));
}
const progressKey='llm-math-progress:v1';
const resumeKey='llm-math-resume:v1';
function defaultStorage(){try{return globalThis.localStorage;}catch{return undefined;}}
export function readProgress(storage=defaultStorage()){
 try{const ids=JSON.parse(storage?.getItem(progressKey)||'[]');return Array.isArray(ids)?[...new Set(ids.filter(id=>/^[1-6]$/.test(id)&&typeof id==='string'))].sort():[];}catch{return [];}
}
export function markLesson(id,storage=defaultStorage()){
 if(typeof id!=='string'||!/^[1-6]$/.test(id))throw new RangeError('Use a lesson id from 1 through 6.');
 const ids=[...new Set([...readProgress(storage),id])].sort();try{storage?.setItem(progressKey,JSON.stringify(ids));}catch{/* Optional local progress. */}return ids;
}
export function readResume(storage=defaultStorage()){try{const id=storage?.getItem(resumeKey);return typeof id==='string'&&/^[1-6]$/.test(id)?id:null;}catch{return null;}}
export function rememberLesson(id,storage=defaultStorage()){
 if(typeof id!=='string'||!/^[1-6]$/.test(id))throw new RangeError('Use a lesson id from 1 through 6.');
 try{storage?.setItem(resumeKey,id);}catch{/* Storage may be blocked. */}
}
export function resetProgress(storage=defaultStorage()){try{storage?.removeItem(progressKey);storage?.removeItem(resumeKey);}catch{/* Storage may be blocked. */}}
const returnLinks=Object.freeze({
 softmax:'../attention/lesson-1.html#s2-1-5',
 scores:'../attention/lesson-1.html#s2-1-3',
 values:'../attention/lesson-1.html#s2-1-7',
 kv:'../attention/lesson-5.html#s2-5-1',
 projections:'../attention/lesson-1.html#s2-1-2',
 masking:'../attention/lesson-1.html#s2-1-6',
});
export function resolveReturnLink(search='') {
 const key=new URLSearchParams(search).get('from');
 return Object.hasOwn(returnLinks,key)?returnLinks[key]:returnLinks.softmax;
}
export const exercises={
 'kv-memory':{prompt:'One sequence has 2 layers, 3 cached token positions, 2 KV heads, 4 elements per head and 2 bytes per element. How many bytes store both keys and values?',choices:['96 bytes: count one tensor','192 bytes: count keys and values in every layer','96 elements: stop before converting to bytes'],answer:1,hints:['The leading factor 2 counts key and value tensors.','Multiply stored-element count by bytes per element.'],responses:['Count both key and value tensors, not only one.','Correct byte count.','96 counts elements, not bytes; multiply by 2 bytes per stored element.'],explanation:'2 × 2 × 3 × 2 × 4 = 96 stored elements; 96 × 2 bytes = 192 bytes for one sequence. This raw count excludes allocator overhead, metadata, weights and activations.'},
 'masked-attention':{prompt:'Scaled scores are [2, 1, 9]. The third key is in the future and blocked. What must mask-then-softmax do?',choices:['Set its old weight to zero and leave the other weights unchanged','Make its weight exactly zero and renormalize the first two to sum to one','Keep the third key largest because its score is 9'],answer:1,hints:['Apply the mask to scores before normalization.','The denominator sums exponentials of allowed scores only.'],responses:['After exclusion, renormalize allowed scores; leaving their old shares unchanged would not sum to one.','Correct: exclude first, then normalize the allowed row.','A blocked key cannot contribute, however large its original score.'],explanation:'Mask [0, 0, −∞] changes the row to [2, 1, −∞]. Softmax gives approximately [0.731059, 0.268941, 0]. The last weight is exactly zero, and the allowed pair sums to one.'},
 notation:{prompt:'What does X ∈ ℝ^(3 × 4) declare?',choices:['Compute X by multiplying 3 and 4','X is a real matrix with 3 rows and 4 columns','Every entry of X equals 12'],answer:1,hints:['The membership symbol ∈ declares what kind of object X is.','The superscript gives two axes: rows × columns.'],explanation:'X is a real matrix with 3 rows and 4 columns: 12 entries whose values are not specified. This is a shape/type declaration, not a multiplication instruction or a computation of the entries.'},
 softmax:{prompt:'In aⱼ = exp(zⱼ − m) / Σₖ exp(zₖ − m), which index selects the single output being calculated?',choices:['k, because it appears under the sum','j, because it remains free on both sides','m, because it sets the maximum'],answer:1,hints:['Look at the subscript of the output a.','An index bound by Σ runs over many entries; a free index names one output.'],explanation:'j selects one output weight. k is bound by the sum and visits all allowed scores. m is the row maximum, a scalar value rather than an index.'},
 indices:{prompt:'For Oᵢⱼ = Σₖ₌₁⁶ Aᵢₖ Vₖⱼ, hold i=1 and j=2 fixed. What changes during the sum?',choices:['Both i and j visit six outputs','k visits six products, using one row of A and one column of V','Every entry of A is multiplied by every entry of V'],answer:1,hints:['A free index identifies the output entry.','The reduction index appears in the A column and the V row.'],explanation:'Only k runs from 1 to 6. i selects a fixed row of A; j selects a fixed column of V. Multiply paired entries and add six products to produce one scalar output.'},
 shapes:{prompt:'Q has shape 4 × 8 and K has shape 6 × 8. What is the shape of QKᵀ?',choices:['4 × 6','8 × 8','The product is impossible'],answer:0,hints:['Transpose swaps rows and columns of K.','The inner dimensions must match: (4 × 8)(8 × 6).'],explanation:'Kᵀ has shape 8 × 6. The inner dimensions 8 match, leaving 4 × 6: one score for every query-key pair. QK without transpose is incompatible because 8 does not equal 6.'},
 transformer:{prompt:'If A has shape 4 × 6 and V has shape 6 × 3, what does O = AV produce?',choices:['4 × 6 scores','6 × 3 unchanged values','4 × 3 weighted value outputs'],answer:2,hints:['Match the inner dimensions of the product.','Each query row combines six value rows, retaining three value components.'],explanation:'O has shape 4 × 3. The reduction visits six key/value positions for each of four queries and each of three output components. A row softmax creates weights, while AV mixes values.'},
 capstone:{prompt:'Read without a picture: R = softmax(PUᵀ / √d) Z. P is 2 × d, U is 5 × d and Z is 5 × 3. What shape is R?',choices:['2 × 3','5 × 3','2 × 5'],answer:0,hints:['PUᵀ forms a 2 × 5 score matrix.','Scalar division and row softmax preserve shape. Then multiply by Z.'],explanation:'R is 2 × 3: (2 × d)(d × 5) gives 2 × 5, normalization keeps that shape, and (2 × 5)(5 × 3) gives 2 × 3. This uses new symbol names but the same operations as attention.'},
};
export function evaluateChoice(id,choice) {
 const exercise=exercises[id];
 if(!exercise||!Number.isInteger(choice)||choice<0||choice>=exercise.choices.length) throw new RangeError('Choose one of the authored options.');
 return {correct:choice===exercise.answer,feedback:`${choice===exercise.answer?'Correct.':'Try tracing the symbols again.'} ${exercise.responses?.[choice]?exercise.responses[choice]+' ':''}${exercise.explanation}`};
}
export function evaluateShapeTrace({q,scores,out}){
 const mismatch=[
  [q==='4,2',q?'First mismatch: Q token-row axis. Projection preserves the four input token rows.':'Choose the Q shape first; projection preserves token rows.'],
  [scores==='4,6','First mismatch: score query/key axes. Preserve four query rows and six key columns.'],
  [out==='4,3','First mismatch: output value-feature axis. Mixing retains three value components per query.'],
 ].find(([correct])=>!correct);
 return {correct:!mismatch,feedback:`${mismatch?mismatch[1]:'All three shapes match.'} Reference: Q: (4 × 8)(8 × 2) → 4 × 2. Scores: (4 × 2)(2 × 6) → 4 × 6. Scaling, mask addition and row normalization keep 4 × 6. Values: (4 × 6)(6 × 3) → 4 × 3.`};
}
export function evaluateLoopTranslation({output,index,left,right}){
 const mismatch=[
  [output==='O_ij','Output indices: i and j stay fixed; k belongs inside the reduction.'],
  [index==='k','Reduction index: the loop changes k, while i and j stay fixed.'],
  [left==='A_ik','First factor: k selects the A column while i selects its fixed row.'],
  [right==='V_kj','Second factor: k selects the V row while j selects its fixed column.'],
 ].find(([correct])=>!correct);
 return {correct:!mismatch,feedback:`${mismatch?mismatch[1]:'The equation matches the loop.'} Reference: Oᵢⱼ = Σₖ₌₁⁶ Aᵢₖ Vₖⱼ. k is bound; i and j remain free. Writing O = AV is equivalent with compatible 2 × 6 and 6 × 2 matrices.`};
}
function node(tag,text,className){const item=document.createElement(tag);if(text)item.textContent=text;if(className)item.className=className;return item;}
function selectField(label,options){
 const wrapper=node('label',label,'math-choice-field'),select=node('select');
 for(const [value,text] of options) {const option=node('option',text);option.value=value;select.append(option);}wrapper.append(select);return {wrapper,select};
}
function activity(title){const details=node('details');details.append(node('summary',title));return details;}
function mountActivity(host,id){
 if(id==='indices'){
  const details=activity('Inspect six terms for a fixed output'),row=selectField('Fixed row i ',[['0','1'],['1','2']]),column=selectField('Fixed column j ',[['0','1'],['1','2']]),result=node('p');
  details.append(node('p','Invented numerical matrices: A rows [1,2,3,4,5,6] and [6,5,4,3,2,1]; V rows [1,2], [2,1], [1,0], [0,1], [2,2], [1,3]. A here is a general matrix, not normalized attention weights. Predict the sum before opening the terms.'),row.wrapper,column.wrapper);
  const reveal=activity('Reveal the six paired products');result.setAttribute('role','status');reveal.append(result);details.append(reveal);
  const update=()=>{const terms=indexedTerms(Number(row.select.value),Number(column.select.value));result.textContent=`O at row ${Number(row.select.value)+1}, column ${Number(column.select.value)+1}: ${terms.map(t=>`${t.left} × ${t.right}`).join(' + ')} = ${terms.reduce((sum,t)=>sum+t.product,0)}. Only k changes; this is one output entry.`;};
  row.select.addEventListener('change',update);column.select.addEventListener('change',update);update();host.append(details);
 }
 if(id==='shapes'){
  const details=activity('Test the matrix dimensions'),right=selectField('Multiply Q (4 × 8) by ',[['transpose','Kᵀ (8 × 6)'],['original','K (6 × 8)']]),result=node('p');result.setAttribute('role','status');
  const update=()=>{try{result.textContent=`Output shape: ${matmulShape([4,8],right.select.value==='transpose'?transposeShape([6,8]):[6,8]).join(' × ')}. The matching inner axes are reduced; outer axes remain.`;}catch(error){result.textContent=error.message;}};
  right.select.addEventListener('change',update);details.append(node('p','Predict whether the inner dimensions match. Compare a transposed key matrix with an unchanged key matrix.'),right.wrapper,result);update();host.append(details);
 }
 if(id==='softmax'){
  const details=activity('Compare ordinary and stable computation'),preset=selectField('Illustrative scores ',[['0','[4, 8, 2, 6]'],['1000','[1004, 1008, 1002, 1006]']]),reveal=activity('Reveal maximum and computed probabilities'),result=node('p');result.setAttribute('role','status');
  const update=()=>{const shift=Number(preset.select.value),scores=[4,8,2,6].map(x=>x+shift),ordinary=scores.map(Math.exp),denominator=ordinary.reduce((a,b)=>a+b,0),naive=ordinary.map(x=>x/denominator),stable=stableSoftmax(scores);result.textContent=`Row maximum m = ${8+shift}. Ordinary floating-point result: [${naive.map(x=>Number.isFinite(x)?x.toFixed(6):'undefined (∞ / ∞)').join(', ')}]. Stable result ≈ [${stable.map(x=>x.toFixed(6)).join(', ')}]. Both rows have the same ideal probabilities. Subtracting the maximum avoids exponential overflow. Very negative finite differences may underflow to zero in floating point; a masked −∞ position is deliberately exactly zero.`;};
  preset.select.addEventListener('change',()=>{reveal.open=false;update();});reveal.append(result);details.append(node('p','First predict the maximum, the largest weight and whether adding 1000 changes ideal probabilities. Open the result to compare actual floating-point computations.'),preset.wrapper,reveal);update();host.append(details);
 }
 if(id==='masked-attention'){
  const details=activity('Compare inclusion and causal exclusion'),mode=selectField('Third key ',[['included','Included: unmasked comparison'],['blocked','Future position: blocked']]),reveal=node('button','Reveal weights'),result=node('p');
  reveal.type='button';reveal.setAttribute('aria-expanded','false');result.hidden=true;result.dataset.maskResult='';result.setAttribute('role','status');
  const reset=()=>{result.hidden=true;result.textContent='';reveal.textContent='Reveal weights';reveal.setAttribute('aria-expanded','false');};
  mode.select.addEventListener('change',reset);
  reveal.addEventListener('click',()=>{
   if(!result.hidden){reset();return;}
   const blocked=mode.select.value==='blocked',weights=stableSoftmax([2,1,blocked?-Infinity:9]);
   result.hidden=false;result.textContent=`Weights (${blocked?'third key blocked':'unmasked'}) ≈ [${weights.map(w=>w===0?'0':w.toFixed(6)).join(', ')}]. ${blocked?'The third weight is exactly zero; the first two renormalize to sum to one.':'The largest score dominates this unmasked comparison. Predict what happens when that key is excluded.'}`;
   reveal.textContent='Hide weights';reveal.setAttribute('aria-expanded','true');
  });
  details.append(node('p','Separate invented row: scaled scores [2, 1, 9], query at the second position. First predict the shares. Including the third key is an unmasked mathematical comparison; causal attention must block that future key before softmax.'),mode.wrapper,reveal,result);host.append(details);
 }
 if(id==='transformer'){
  const details=activity('Trace three shapes through attention'),q=selectField('X is 4 × 8; W_Q is 8 × 2. Q is ',[['','Choose a shape'],['4,2','4 × 2'],['8,2','8 × 2']]),scores=selectField('K is 6 × 2. QKᵀ / √2 is ',[['','Choose a shape'],['4,6','4 × 6'],['2,2','2 × 2']]),out=selectField('V is 6 × 3. softmax(scores + mask)V is ',[['','Choose a shape'],['4,3','4 × 3'],['4,6','4 × 6']]),check=node('button','Check all three shapes'),feedback=node('p');check.type='button';feedback.setAttribute('role','status');
  check.addEventListener('click',()=>{feedback.textContent=evaluateShapeTrace({q:q.select.value,scores:scores.select.value,out:out.select.value}).feedback;});details.append(q.wrapper,scores.wrapper,out.wrapper,check,feedback);host.append(details);
 }
 if(id==='capstone'){
  const details=activity('Write an indexed equation from a loop');details.append(node('p','Without a diagram: for each fixed i,j, start out[i,j] at 0; for k from 1 through 6, add A[i,k] × V[k,j]. Build the corresponding equation.'));
  const output=selectField('Output ',[['O_ij','Oᵢⱼ'],['O_ik','Oᵢₖ']]),index=selectField('Reduction ',[['k','Σ over k = 1…6'],['j','Σ over j = 1…6']]),left=selectField('First factor ',[['A_ij','Aᵢⱼ'],['A_ik','Aᵢₖ']]),right=selectField('Second factor ',[['V_ij','Vᵢⱼ'],['V_kj','Vₖⱼ']]),check=node('button','Check translation'),feedback=node('p');check.type='button';feedback.setAttribute('role','status');
  check.addEventListener('click',()=>{feedback.textContent=evaluateLoopTranslation({output:output.select.value,index:index.select.value,left:left.select.value,right:right.select.value}).feedback;});
  const reference=activity('Reference translation and self-check');reference.append(node('p','Oᵢⱼ = Σₖ₌₁⁶ Aᵢₖ Vₖⱼ, equivalently O = AV. Self-check: one output is selected; six paired products are added; k appears in both factors; i and j remain on the output. Now write z = Σᵣ₌₁⁵ wᵣ xᵣ yourself for a length-five dot product. The bound letter r can be renamed consistently.'));
  const equation=node('div');renderMath(equation,String.raw`O_{ij}=\sum_{k=1}^{6}A_{ik}V_{kj},\qquad O=AV`,{displayMode:true,label:'Indexed weighted sum and equivalent matrix product'});reference.prepend(equation);
  details.append(output.wrapper,index.wrapper,left.wrapper,right.wrapper,check,feedback,reference);host.append(details);
 }
}
function mountProgress(root){
 const documentRoot=root.ownerDocument||root;
 const refresh=(ids=readProgress())=>{for(const host of documentRoot.querySelectorAll('[data-math-progress]')){const status=host.querySelector('[data-progress-status]');if(status)status.textContent=ids.length?`Lessons marked reviewed on this device: ${ids.map(id=>`0.${id}`).join(', ')}. This is optional; all lessons stay open.`:'No lessons marked reviewed on this device. Progress is optional.';}};
 for(const host of root.querySelectorAll('[data-math-progress]')){
  if(host.dataset.progressMounted)continue;host.dataset.progressMounted='true';const status=node('p');status.dataset.progressStatus='';host.append(status);
  const resume=readResume();if(!documentRoot.body?.dataset.mathLesson&&resume){const link=node('a',`Resume lesson 0.${resume}`);link.href=`lesson-${resume}.html`;link.dataset.mathResume='';host.append(link);}
  const id=documentRoot.body?.dataset.mathLesson;
  if(/^[1-6]$/.test(id||'')){const button=node('button','Mark this lesson reviewed');button.type='button';button.addEventListener('click',()=>refresh(markLesson(id)));host.append(button);}
 }
 for(const button of root.querySelectorAll('[data-math-reset]')){if(button.dataset.resetMounted)continue;button.dataset.resetMounted='true';button.addEventListener('click',()=>{resetProgress();refresh([]);for(const link of documentRoot.querySelectorAll('[data-math-resume]'))link.remove();});}
 refresh();
}
let exerciseGroup=0;
export function mountMathExercises(root=document) {
 const hosts=[...(root.matches?.('[data-math-exercise]')?[root]:[]),...root.querySelectorAll('[data-math-exercise]')];
 for(const host of hosts){
  const exercise=exercises[host.dataset.mathExercise];
  if(!exercise||host.dataset.exerciseMounted)continue;
  host.dataset.exerciseMounted='true';host.classList.add('math-practice');
  mountActivity(host,host.dataset.mathExercise);
  const groupName=`math-${host.dataset.mathExercise}-${++exerciseGroup}`;
  const fieldset=node('fieldset'),legend=node('legend',exercise.prompt),feedback=node('p');
  feedback.setAttribute('role','status');fieldset.append(legend);
  exercise.choices.forEach((choice,index)=>{
   const label=node('label'),input=document.createElement('input');input.type='radio';input.name=groupName;input.value=String(index);
   label.append(input,document.createTextNode(choice));fieldset.append(label);
  });
  const check=node('button','Check reasoning');check.type='button';
  check.addEventListener('click',()=>{const selected=fieldset.querySelector('input:checked');feedback.textContent=selected?evaluateChoice(host.dataset.mathExercise,Number(selected.value)).feedback:'Choose an answer first. You can reveal the explanation at any time.';});
  host.append(fieldset,check,feedback);
  for(const [index,hint] of exercise.hints.entries()){const details=node('details'),summary=node('summary',`Hint ${index+1}`);details.append(summary,node('p',hint));host.append(details);}
  const explanation=node('details');explanation.append(node('summary','Reveal explanation'),node('p',exercise.explanation));host.append(explanation);
 }
 for(const link of root.querySelectorAll('[data-math-return]'))link.setAttribute('href',resolveReturnLink(globalThis.location?.search||''));
 const lesson=(root.ownerDocument||root).body?.dataset.mathLesson;
 if(root.nodeType===9&&/^[1-6]$/.test(lesson||''))rememberLesson(lesson);
 mountProgress(root);return hosts;
}
if(typeof document!=='undefined')mountMathExercises();
