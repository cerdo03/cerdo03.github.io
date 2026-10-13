import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createKvSim} from '../labs/attention/kv-sim.js';
import * as ui from '../labs/attention/ui.js';
test('decode retains normalized full-precision weights used in the value mixture',()=>{
 const sim=createKvSim();sim.prefill();const state=sim.step();const {weights,output}=state.lastPass.attention;
 assert.ok(Math.abs(weights.reduce((a,b)=>a+b,0)-1)<1e-12);
 for(let d=0;d<2;d++)assert.ok(Math.abs(output[d]-state.cache.reduce((sum,row,i)=>sum+weights[i]*row.v[d],0))<1e-12);
});
test('a small positive attention weight cannot look like a masked zero',()=>{
 assert.equal(typeof ui.fmtWeight,'function');
 assert.equal(ui.fmtWeight(0),'0');assert.equal(ui.fmtWeight(0.00042448),'<0.001');assert.equal(ui.fmtWeight(0.5),'0.5');
});
test('cache projections use the same shared starting vectors and matrices as the attention walkthrough',()=>{
 const sim=createKvSim({embeddings:[[2,0],[0,1],[3,4]]});
 const state=sim.prefill(['The','sky','is']);
 assert.deepEqual(state.lastPass.queries[2],[3,4]);
 assert.deepEqual(state.cache[2].k,[4,3]);
 assert.deepEqual(state.cache[2].v,[6,4]);
});
