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
test('guided scores reveal products, dots, scaling, mask, softmax and shares in order',async()=>{
 const {studioVisibility}=await import(moduleURL);
 assert.deepEqual(studioVisibility('scores','input'),['input']);
 assert.deepEqual(studioVisibility('scores','term:0'),['input','term:0']);
 assert.ok(!studioVisibility('scores','sum').includes('scale'));
 assert.ok(!studioVisibility('scores','scale').includes('mask'));
 assert.ok(!studioVisibility('scores','mask').includes('normalize'));
 assert.ok(!studioVisibility('scores','normalize').includes('weights'));
 assert.ok(studioVisibility('scores','weights').includes('weights'));
 assert.deepEqual(studioVisibility('scores','all'),studioVisibility('scores','weights'));
});
test('guided projection and value diagrams keep future whole results concealed',async()=>{
 const {studioVisibility}=await import(moduleURL);
 assert.ok(!studioVisibility('projections','input').includes('matrices'));
 assert.ok(!studioVisibility('projections','sum').includes('outputs'));
 assert.ok(studioVisibility('projections','outputs').includes('outputs'));
 assert.ok(!studioVisibility('values','term:0').includes('term:1'));
 assert.ok(!studioVisibility('values','term:2').includes('sum'));
 assert.ok(studioVisibility('values','sum').includes('sum'));
});
test('connector curves stay in the gap between source and destination card edges',async()=>{
 const {studioConnector}=await import(moduleURL);
 for(const width of [900,1920,3000]){
  const origin={left:40,top:80};
  const source={left:width/2-60,top:100,width:120,bottom:210};
  for(const left of [50,width/2-100,width-250]){
   const target={left,top:250,width:200,bottom:450};
   const {start,end,controls}=studioConnector(source,target,origin);
   assert.deepEqual(start,[width/2-origin.left,source.bottom-origin.top]);
   assert.deepEqual(end,[left+100-origin.left,target.top-origin.top]);
   for(const point of controls){assert.ok(point[1]>=start[1]);assert.ok(point[1]<=end[1]);}
  }
 }
});
test('local score lessons carry known results and stop at their own transformation',async()=>{
 const {studioModel}=await import(moduleURL);
 const scopes={dot:['input','term:0','term:1','sum'],scale:['sum','scale'],softmax:['scale','normalize','weights'],mask:['scale','mask','normalize','weights']};
 for(const [scoreScope,expected] of Object.entries(scopes))assert.deepEqual(studioModel('scores',{position:1,scoreScope}).steps.map(step=>step.id),expected);
});
test('isolated softmax normalizes every scaled score before causal masking is introduced',async()=>{
 const {studioModel,studioMarkup}=await import(moduleURL);
 const m=studioModel('scores',{position:1,key:2,scoreScope:'softmax'});
 assert.ok(m.scores.every(Number.isFinite));assert.ok(m.weights.every(w=>w>0));
 assert.ok(Math.abs(m.weights.reduce((sum,w)=>sum+w,0)-1)<1e-12);
 const html=studioMarkup('scores',m);
 assert.doesNotMatch(html,/data-reveal="mask"|masked −∞|whole allowed row/);
 assert.match(html,/No causal mask/);
 const masked=studioModel('scores',{position:1,key:2,scoreScope:'mask'});
 assert.equal(masked.weights[2],0);assert.equal(masked.scores[2],-Infinity);
 assert.ok(masked.weights[0]>m.weights[0]);
});
