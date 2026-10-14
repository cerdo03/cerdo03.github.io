import test from 'node:test';
import assert from 'node:assert/strict';
import { visualView } from '../labs/llm-systems/learning-visuals.js';
const base={stage:0,position:2,component:0,role:'Q',key:2,pass:0,query:2,kvHeads:2,head:0,candidate:0,change:2};
test('each teaching visual has connected diagram, labelled operations and final-state explanation',()=>{
 for(const type of ['projections','scores','values','request','heads','sharing','prediction','validity','prefix']){
  const start=visualView(type,base),end=visualView(type,{...base,stage:start.max});
  assert.match(end.graph,/<svg/);assert.match(end.graph,/route-edge/);assert.ok(end.caption.length>40);
  assert.match(end.graph,/aria-label=/);assert.doesNotMatch(end.graph,/NaN|undefined/);
 }
});
test('masked key walkthrough distinguishes raw dot product from zero attention contribution',()=>{
 const view=visualView('scores',{...base,stage:4,position:1,key:2});
 assert.match(view.graph,/masked −∞/);assert.match(view.caption,/exactly zero/);
});
test('module 1 uses shared visuals instead of duplicating stacked-card diagrams',async()=>{
 const {readFile}=await import('node:fs/promises');
 const source=await readFile(new URL('../labs/inference/app.js',import.meta.url),'utf8');
 assert.match(source,/mountLearningVisual\(root/);
});
test('tiny positive shares stay visibly different from causal-mask zeros',()=>{
 const view=visualView('scores',{...base,stage:4},[[4,0],[0,1],[4,4]]);
 assert.match(view.graph,/&lt;0\.001/);
 const shared=visualView('sharing',{...base,kvHeads:1,head:3},[[4,0],[0,1],[4,4]]);
 assert.match(shared.caption,/<0\.001/);
});
