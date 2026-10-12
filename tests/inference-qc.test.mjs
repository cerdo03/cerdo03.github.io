import {test} from 'node:test';
import assert from 'node:assert/strict';
import {diagramHTML,layerFlowHTML} from '../labs/inference/course-visuals.js';
import {attentionState,representations,traceState} from '../labs/inference/guide-model.js';
test('saved experimental x is explicitly distinguished from the unchanged starting embedding',()=>{
 for(const id of ['qkv','scores','mix']){
  const html=diagramHTML(id,{event:2,position:2,first:2});
  assert.ok(html.includes('Modified toy input'));
  assert.ok(html.includes('Starting embedding: [1, 2]'));
  assert.ok(html.includes('Current x: [2, 2]'));
  assert.ok(html.includes('Restore starting input'));
 }
 assert.deepEqual(representations[2],[1,2]);
});
test('first-token probabilities agree across prefill, trace and final-layer explanation',()=>{
 for(const html of [diagramHTML('prefill',{event:2}),diagramHTML('decode',{event:1}),layerFlowHTML({event:7})]){
  assert.ok(html.includes('60%'));assert.ok(html.includes('25%'));assert.ok(html.includes('15%'));
 }
});
test('mixing example uses value vectors and labels head result separately from layer output',()=>{
 const html=diagramHTML('prefill',{event:1});
 assert.ok(html.includes('0.5 × [4, 0] = [2, 0]'));
 assert.ok(html.includes('= [2.6, 0.8]'));
 assert.ok(html.includes('attention result'));
 assert.ok(!html.includes('← new vector'));
});
test('every allowed input variation produces consistent scores, masking and output',()=>{
 for(let p=0;p<3;p++)for(let x=0;x<=4;x+=.5){
  const a=attentionState(p,x);assert.ok(a.output.every(Number.isFinite));
  assert.ok(Math.abs(a.weights.reduce((u,v)=>u+v,0)-1)<1e-12);
  for(let j=0;j<3;j++){
   if(j>p){assert.equal(a.weights[j],0);assert.equal(a.scores[j],-Infinity)}
   else assert.equal(a.scores[j],(a.q[0]*a.keys[j][0]+a.q[1]*a.keys[j][1])/Math.sqrt(2));
  }
  for(let d=0;d<2;d++)assert.ok(Math.abs(a.output[d]-a.values.reduce((u,v,j)=>u+v[d]*a.weights[j],0))<1e-12);
 }
});
test('all request events preserve processed positions separately from chosen tokens',()=>{
 for(let event=0;event<9;event++){
  const s=traceState(event);assert.equal(s.input.length,s.pass===0?3:1);
  assert.equal(s.cache.length,s.stage===0?(s.pass===0?0:2+s.pass):3+s.pass);
  if(s.stage===2){assert.ok(!s.cache.includes(s.next));assert.equal(s.answer.at(-1),s.next)}
 }
});
