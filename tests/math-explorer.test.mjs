import test from 'node:test';
import assert from 'node:assert/strict';
import { stableSoftmax, resolveReturnLink, exercises, evaluateChoice } from '../labs/llm-systems/math-exercises.js';

test('stable softmax normalizes, preserves shifts and supports long rows', () => {
 const logits=[4,8,2,6], weights=stableSoftmax(logits);
 assert.ok(Math.abs(weights.reduce((a,b)=>a+b,0)-1)<1e-12);
 stableSoftmax(logits.map(x=>x+10000)).forEach((x,i)=>assert.ok(Math.abs(x-weights[i])<1e-12));
 assert.equal(stableSoftmax(Array(150000).fill(10000)).length,150000);
});
test('masked positions are exact zeros; empty and all-masked inputs reject', () => {
 assert.deepEqual(stableSoftmax([0,-Infinity]),[1,0]);
 assert.ok(stableSoftmax([0,-100])[1]>0);
 for(const row of [[],[-Infinity,-Infinity],[NaN],[Infinity]]) assert.throws(()=>stableSoftmax(row),RangeError);
});
test('return links accept only authored origin keys', () => {
 assert.equal(resolveReturnLink('?from=softmax'),'../attention/lesson-1.html#s2-1-5');
 for(const query of ['?from=https://evil.example','?from=__proto__','?from=constructor','']) assert.equal(resolveReturnLink(query),'../attention/lesson-1.html#s2-1-5');
});
test('notation checkpoint gives deterministic explanatory feedback', () => {
 assert.match(exercises.notation.prompt,/3.*4/);
 assert.match(exercises.notation.explanation,/12/);
 assert.equal(exercises.notation.answer,1);
 assert.equal(evaluateChoice('notation',1).correct,true);
 assert.equal(evaluateChoice('notation',0).correct,false);
 assert.ok(evaluateChoice('notation',0).feedback.length>30);
});

// Acceptance tests for the next gated increment: dimensions, sums and storage.
test('matrix shape rules and transpose reject invalid products', async () => {
 const math=await import('../labs/llm-systems/math-exercises.js');
 assert.deepEqual(math.matmulShape([4,8],[8,6]),[4,6]);
 assert.deepEqual(math.transposeShape([6,8]),[8,6]);
 assert.throws(()=>math.matmulShape([4,8],[6,8]),RangeError);
 assert.throws(()=>math.transposeShape([0,8]),RangeError);
});
test('dot, weighted values and storage have deterministic results', async () => {
 const math=await import('../labs/llm-systems/math-exercises.js');
 assert.equal(math.dot([1,2],[3,4]),11);
 assert.equal(math.rawKvBytes({layers:32,tokens:4096,kvHeads:8,headDim:128,bytesPerElement:2}),536870912);
 assert.equal(math.toMiB(536870912),512);
 assert.throws(()=>math.rawKvBytes({layers:32,tokens:-1,kvHeads:8,headDim:128,bytesPerElement:2}),RangeError);
 assert.throws(()=>math.dot([1],[2,3]),RangeError);
});
test('six exercises expose useful hints and deterministic feedback', () => {
 for(const id of ['notation','indices','shapes','softmax','transformer','capstone']){
  assert.ok(exercises[id],id);assert.ok(exercises[id].hints.length>=2);
  assert.ok(evaluateChoice(id,exercises[id].answer).correct);
  assert.equal(evaluateChoice(id,(exercises[id].answer+1)%exercises[id].choices.length).correct,false);
 }
});
test('progress stores lesson ids only and tolerates unavailable storage', async () => {
 const {readProgress,markLesson,resetProgress}=await import('../labs/llm-systems/math-exercises.js');
 const data=new Map(), storage={getItem:k=>data.get(k),setItem:(k,v)=>data.set(k,v),removeItem:k=>data.delete(k)};
 assert.deepEqual(markLesson('2',storage),['2']);
 markLesson('2',storage); assert.deepEqual(readProgress(storage),['2']);
 assert.throws(()=>markLesson('answer',storage),RangeError);
 resetProgress(storage);assert.deepEqual(readProgress(storage),[]);
 const blocked={getItem(){throw Error('blocked');},setItem(){throw Error('blocked');},removeItem(){throw Error('blocked');}};
 assert.deepEqual(markLesson('1',blocked),['1']);resetProgress(blocked);
});
test('all six explorers expose authored equations and calculated examples', async () => {
 const {equationDefinitions,computeExample}=await import('../labs/llm-systems/equation-explorer.js');
 const ids=['softmax-stable','qkv-projection','attention-scores','masked-attention','weighted-values','kv-memory'];
 assert.deepEqual(Object.keys(equationDefinitions).sort(),ids.sort());
 for(const id of ids){assert.ok(equationDefinitions[id].purpose);assert.ok(equationDefinitions[id].symbols);assert.ok(computeExample(id).length>30);}
 assert.match(computeExample('kv-memory'),/512 MiB/);
 assert.match(computeExample('masked-attention'),/exactly zero/);
});
test('six indexed products follow the selected row and column', async () => {
 const {indexedTerms}=await import('../labs/llm-systems/math-exercises.js');
 assert.deepEqual(indexedTerms(0,1).map(t=>t.product),[2,2,0,4,10,18]);
 assert.equal(indexedTerms(0,1).reduce((sum,t)=>sum+t.product,0),36);
 assert.throws(()=>indexedTerms(0,2),RangeError);
});
test('independent subtree mounts give radio groups independent names', async () => {
 const {mountMathExercises}=await import('../labs/llm-systems/math-exercises.js');
 const inputs=[];
 const element=()=>({dataset:{},classList:{add(){}},append(){},setAttribute(){},addEventListener(){},querySelectorAll(){return [];}});
 const previous=globalThis.document;
 globalThis.document={createElement(tag){const item=element();if(tag==='input')inputs.push(item);return item;},createTextNode(text){return {textContent:text};}};
 try{
  for(let n=0;n<2;n++){const host=element();host.dataset.mathExercise='notation';const root={querySelectorAll(selector){return selector==='[data-math-exercise]'?[host]:[];}};mountMathExercises(root);}
  assert.equal(new Set(inputs.map(input=>input.name)).size,2);
 }finally{if(previous===undefined)delete globalThis.document;else globalThis.document=previous;}
});
test('curated TeX renders as MathML without fallback', async () => {
 const {equationDefinitions}=await import('../labs/llm-systems/equation-explorer.js');
 const {renderMath}=await import('../labs/llm-systems/math-renderer.js');
 for(const definition of Object.values(equationDefinitions)){
  const attrs=new Map();const element={classList:{add(){},remove(){},toggle(){}},setAttribute:(k,v)=>attrs.set(k,v),removeAttribute:k=>attrs.delete(k)};
  renderMath(element,definition.tex,{displayMode:true,label:definition.label});
  assert.match(element.innerHTML,/<math[\s>]/);assert.equal(attrs.has('data-math-error'),false);
 }
});
test('resume remembers only allowlisted lesson ids and resets with progress', async () => {
 const {rememberLesson,readResume,resetProgress}=await import('../labs/llm-systems/math-exercises.js');
 const data=new Map(),storage={getItem:k=>data.get(k),setItem:(k,v)=>data.set(k,v),removeItem:k=>data.delete(k)};
 rememberLesson('4',storage);assert.equal(readResume(storage),'4');
 assert.throws(()=>rememberLesson('../evil',storage),RangeError);resetProgress(storage);assert.equal(readResume(storage),null);
 data.set('llm-math-resume:v1','javascript:alert(1)');assert.equal(readResume(storage),null);
 const blocked={getItem(){throw Error('blocked');},setItem(){throw Error('blocked');},removeItem(){throw Error('blocked');}};rememberLesson('2',blocked);assert.equal(readResume(blocked),null);
});
