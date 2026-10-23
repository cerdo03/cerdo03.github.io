import test from 'node:test';
import assert from 'node:assert/strict';
import { chapters, clockHistory } from '../labs/dynamo/motion-content.js';
import { buildSteps, clampStep, chapterStart, replicaExperiment, reconcileCart } from '../labs/dynamo/motion-model.js';

test('eight chapters provide cumulative ordered steps without playback timing', () => {
 assert.equal(chapters.length,8);
 let previous=[];
 for(let level=1;level<=4;level++){
  const steps=buildSteps(level);
  assert.ok(previous.every(id=>steps.some(item=>`${item.chapter}-${item.id}`===id)));
  assert.equal(steps[0].chapter,0);assert.equal(steps.at(-1).chapter,7);
  for(const step of steps){assert.ok(step.text&&step.source);assert.equal('duration'in step,false);assert.equal('start'in step,false);assert.equal('end'in step,false);}
  assert.equal(clampStep(steps,-100),0);assert.equal(clampStep(steps,Infinity),steps.length-1);
  assert.equal(clampStep(steps,NaN),0);
  previous=steps.map(item=>`${item.chapter}-${item.id}`);
 }
 assert.equal(buildSteps(1).length,32);assert.equal(buildSteps(4).length,56);
});
test('each navigation action moves at most one operation and chapter lookup returns a step index',()=>{
 const steps=buildSteps(4);let index=0;
 for(let chapter=0;chapter<8;chapter++)assert.equal(steps[chapterStart(steps,chapter)].chapter,chapter);
 for(let count=0;count<steps.length+3;count++)index=clampStep(steps,index+1);
 assert.equal(index,steps.length-1);
 const last=steps[index];index=clampStep(steps,index-1);index=clampStep(steps,index+1);assert.deepEqual(steps[index],last);
});
test('write threshold measures replies by deadline, not all eventual writes',()=>{
 const result=replicaExperiment({failed:'none',required:2,fallback:false});
 assert.equal(result.responseTime,3);assert.equal(result.status,'success');
 assert.deepEqual(result.copiesAtDeadline,['A','B']);
 const timeout=replicaExperiment({failed:'none',required:3,fallback:false});
 assert.equal(timeout.status,'timeout');assert.equal(timeout.responseTime,null);
 assert.equal(timeout.events.filter(e=>e.kind==='persist').length,3);
});
test('hinted fallback replaces one unreachable home, preserving destination',()=>{
 const unavailable=replicaExperiment({failed:'B',required:2,fallback:false});
 assert.equal(unavailable.status,'timeout');assert.deepEqual(unavailable.copiesAtDeadline,['A']);
 const replacement=replicaExperiment({failed:'B',required:2,fallback:true});
 assert.equal(replacement.responseTime,4);assert.equal(replacement.hint,'B');
 assert.deepEqual(replacement.copiesAtDeadline,['A','D']);
 assert.equal(replacement.hosts.some(h=>h.id==='B'&&h.time!==null),false);
});
test('Figure 3 history stays exact and explicit policy controls cart meaning',()=>{
 assert.deepEqual(clockHistory.map(v=>v.clock),[{Sx:1},{Sx:2},{Sx:2,Sy:1},{Sx:2,Sz:1},{Sx:3,Sy:1,Sz:1}]);
 const union=reconcileCart('union');const edits=reconcileCart('edits');
 assert.equal(union.relation,'concurrent');assert.deepEqual(union.cart,['book','pen']);
 assert.deepEqual(edits.cart,['pen']);assert.deepEqual(edits.clock,{Sx:3,Sy:1,Sz:1});
 assert.throws(()=>reconcileCart('latest'),RangeError);
});
