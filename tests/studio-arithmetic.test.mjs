import test from 'node:test';
import assert from 'node:assert/strict';
const moduleURL=new URL('../labs/llm-systems/studio-arithmetic.js',import.meta.url);
test('studio projections derive every output and selected product from shared embeddings',async()=>{
 const {studioModel,studioMarkup}=await import(moduleURL);
 const m=studioModel('projections',{position:2,role:'V',component:0},[[2,0],[0,1],[1.5,2]]);
 assert.deepEqual(m.outputs,{Q:[1.5,2],K:[2,1.5],V:[3,2]});
 assert.deepEqual(m.terms,[3,0]);assert.equal(m.total,3);
 const html=studioMarkup('projections',m);
 for(const role of ['Q','K','V'])assert.ok(html.includes(`data-role="${role}"`));
 assert.equal((html.match(/data-pick="projection:/g)||[]).length,6);
 assert.doesNotMatch(html,/Follow component|Pending|pending/);
 assert.match(html.replace(/<[^>]+>/g,''),/Q = x/);
});
test('studio scores normalize all allowed keys and keep masked shares exactly zero',async()=>{
 const {studioModel,studioMarkup}=await import(moduleURL);
 const m=studioModel('scores',{position:1,key:2});
 assert.equal(m.scores[2],-Infinity);assert.equal(m.weights[2],0);
 assert.ok(Math.abs(m.weights.reduce((a,b)=>a+b,0)-1)<1e-12);
 const html=studioMarkup('scores',m);
 assert.match(html,/masked/);assert.match(html,/Softmax/);assert.match(html,/Inspect score for is/);
});
test('studio weighted values preserve full vectors and use full precision in component sums',async()=>{
 const {studioModel,studioMarkup}=await import(moduleURL);
 const m=studioModel('values',{position:2,component:1});
 assert.ok(Math.abs(m.terms.reduce((a,b)=>a+b,0)-m.total)<1e-12);
 assert.equal(m.total,m.output[1]);
 const html=studioMarkup('values',m);
 assert.match(html,/head result/);assert.match(html,/data-pick="component:0"/);assert.match(html,/data-pick="component:1"/);
});
test('shared visual ownership disposes embedded observers once before reuse',async()=>{
 const {ownVisual,disposeVisual}=await import('../labs/llm-systems/learning-visuals.js');
 const root={};let calls=0;
 ownVisual(root,()=>calls++);disposeVisual(root);disposeVisual(root);
 assert.equal(calls,1);
});
