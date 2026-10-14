import test from 'node:test';
import assert from 'node:assert/strict';
import { projectionTrace, valueTrace, requestFrame, sharingState, predictionState, dependencyState } from '../labs/llm-systems/visual-model.js';
const close=(a,b)=>assert.ok(Math.abs(a-b)<1e-10,`${a} != ${b}`);
test('projection follows matrix columns, not rows; value contributions preserve components',()=>{
 assert.deepEqual(projectionTrace([1,2],[[2,3],[4,5]],1),{terms:[3,10],total:13});
 const mix=valueTrace([[4,0],[0,1],[2,2]],[.5,.2,.3],1);
 assert.deepEqual(mix.terms,[0,.2,.6]);close(mix.total,.8);
});
test('prefill creates all prompt rows; decode reads old rows unchanged and samples outside cache',()=>{
 const before=requestFrame(1,0),after=requestFrame(1,4),chosen=requestFrame(1,5);
 assert.deepEqual(before.input,['blue']);assert.equal(before.cache.length,3);
 assert.equal(after.cache.length,4);assert.equal(chosen.cache.length,4);
 assert.equal(chosen.chosen,'today');assert.ok(!chosen.cache.some(r=>r.token==='today'));
 assert.deepEqual(before.old,after.old);assert.deepEqual(after.cache.slice(0,3),before.old);
 assert.equal(requestFrame(0,4).cache.length,3);
 assert.equal(requestFrame(0,2).queries[1].keys.length,2);
 assert.equal(before.newRows[0].k[0],before.newRows[0].x[1]);
});
test('GQA queries share identical cache objects, but compute their own mixtures',()=>{
 const g=sharingState(2);
 assert.equal(g.heads[0].cache,g.heads[1].cache);
 assert.notEqual(g.heads[1].cache,g.heads[2].cache);
 assert.notDeepEqual(g.heads[0].weights,g.heads[1].weights);
 assert.notDeepEqual(g.heads[0].output,g.heads[1].output);
 assert.equal(sharingState(1).caches.length,1);assert.equal(sharingState(4).caches.length,4);
});
test('vocabulary scores are calculated from final toy block output; softmax and selection match',()=>{
 const p=predictionState();
 for(let j=0;j<3;j++)close(p.logits[j],p.final.reduce((sum,x,i)=>sum+x*p.vocabulary[i][j],0));
 close(p.probabilities.reduce((a,b)=>a+b,0),1);
 assert.equal(p.greedy,p.tokens[p.logits.indexOf(Math.max(...p.logits))]);
 assert.notDeepEqual(predictionState([[1,0],[0,1],[1,1]]).logits,p.logits);
 assert.deepEqual(p.layers[1].incoming,p.layers[0].outgoing);
});
test('changing an earlier token invalidates identical suffix tokens, appending preserves prefix',()=>{
 const edit=dependencyState(1);
 assert.deepEqual(edit.reused,[true,false,false,false]);
 assert.equal(edit.a[3],edit.b[3]);assert.equal(edit.reused[3],false);
 const append=dependencyState(-1);
 assert.deepEqual(append.reused,[true,true,true,true,false]);
 assert.deepEqual(dependencyState(3).reused,[true,true,true,false]);
});
