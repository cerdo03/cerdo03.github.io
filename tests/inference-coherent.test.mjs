import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as model from '../labs/inference/guide-model.js';
test('live projections, masks and mixed values share the selected input',()=>{
 assert.equal(typeof model.attentionState,'function');
 const s=model.attentionState(1,4);
 assert.deepEqual(s.x,[4,1]); assert.deepEqual(s.q,[4,1]);
 assert.deepEqual(s.keys[1],[1,4]); assert.deepEqual(s.values[1],[8,1]);
 assert.equal(s.weights[2],0); assert.equal(s.scores[2],-Infinity);
 assert.ok(Math.abs(s.weights.reduce((a,b)=>a+b,0)-1)<1e-12);
 for(let d=0;d<2;d++) assert.ok(Math.abs(s.output[d]-s.values.reduce((v,x,i)=>v+x[d]*s.weights[i],0))<1e-12);
});
test('chosen output is distinct from processed and cached tokens across passes',()=>{
 assert.equal(typeof model.traceState,'function');
 const first=model.traceState(2);assert.deepEqual(first.answer,['It']);assert.equal(first.cache.length,3);assert.deepEqual(first.input,['Explain','KV','caching']);
 const next=model.traceState(3);assert.deepEqual(next.input,['It']);assert.equal(next.cache.length,3);assert.equal(next.answer.length,1);
 const processed=model.traceState(4);assert.equal(processed.cache.length,4);assert.equal(processed.answer.length,1);
 const last=model.traceState(8);assert.equal(last.cache.length,5);assert.equal(last.answer.length,3);
});
test('prefix reuse stops at first mismatch, even when later tokens match',()=>{
 assert.equal(typeof model.prefixState,'function');
 assert.equal(model.prefixState(false,1).reused,2);
 assert.equal(model.prefixState(true,1).reused,0);
 assert.equal(model.prefixState(false,3).reused,0);
});
