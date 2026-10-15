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
test('projection entries are labelled as learned W matrices, separate from output vectors',()=>{
 const view=visualView('projections',{...base,role:'K'});
 assert.match(view.graph,/data-symbol="W_K"/);
 assert.match(view.graph,/data-symbol="K"/);
});
test('projection overview exposes all matrices and complete Q K V before inspection',()=>{
 const view=visualView('projections',base);
 assert.doesNotMatch(view.controls,/Follow component|Projection/);
 for(const role of ['Q','K','V']){
  assert.match(view.graph,new RegExp(`data-symbol="W_${role}"`));
  for(const component of [0,1])assert.ok(view.graph.includes(`data-pick="projection:${role}:${component}"`));
 }
 assert.match(view.graph,/\[1, 2\]/);
 assert.match(view.graph,/\[2, 1\]/);
 assert.match(view.graph,/\[2, 2\]/);
 assert.doesNotMatch(view.graph,/Pending|pending/);
 assert.match(view.equation,/Q = x × WQ/);
});
test('projection node inspection retains the whole overview and reveals its calculation',()=>{
 const view=visualView('projections',{...base,role:'V',component:1,inspect:true});
 assert.ok(view.graph.includes('data-pick="projection:Q:0"'));
 assert.match(view.graph,/row 1, column 2/);
 assert.match(view.graph,/2 × 1/);
 assert.match(view.graph,/Sum of products/);
});
test('value overview shows whole values and whole result with both components inspectable',()=>{
 const view=visualView('values',base);
 assert.doesNotMatch(view.controls,/Follow component/);
 assert.match(view.graph,/\[4, 0\]/);
 assert.match(view.graph,/\[0, 1\]/);
 assert.match(view.graph,/\[2, 2\]/);
 assert.ok(view.graph.includes('data-pick="component:0"'));
 assert.ok(view.graph.includes('data-pick="component:1"'));
 assert.doesNotMatch(view.graph,/Pending|pending/);
 assert.match(view.equation,/Σ/);
});
test('score overview shows every key and share before optional key inspection',()=>{
 const view=visualView('scores',base);
 assert.doesNotMatch(view.controls,/Compare with key/);
 for(let key=0;key<3;key++)assert.ok(view.graph.includes(`data-pick="key:${key}"`));
 assert.match(view.graph,/Softmax/);
 assert.match(view.graph,/aria-label="Inspect score for The"/);
 assert.match(view.equation,/score/);
 const detail=visualView('scores',{...base,key:0,inspect:true});
 assert.match(detail.graph.replace(/<[^>]+>/g,''),/Q\[1\] at is/);
 assert.match(detail.graph.replace(/<[^>]+>/g,''),/K\[1\] at The/);
});
test('step-through diagrams do not expose future computed nodes on their input frame',()=>{
 const text=(type,state)=>visualView(type,state).graph.replace(/<[^>]+>/g,'');
 assert.doesNotMatch(text('heads',base),/Combined Q projection|Head 1 Q|Concatenate/);
 assert.match(text('heads',{...base,stage:1}),/Combined Q projection/);
 assert.doesNotMatch(text('request',base),/Q pending|Head result|Next output token|Remaining layer/);
 assert.doesNotMatch(text('prediction',base),/Residual u|Feed-forward \+ residual|Layer 2 input/);
 assert.match(text('prediction',{...base,stage:1}),/Residual u/);
});
