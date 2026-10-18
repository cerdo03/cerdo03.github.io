import test from 'node:test';
import assert from 'node:assert/strict';
const load=()=>import('../labs/attention/architecture-explorer/spatial.js');
test('nested content fits within clicked block and sits behind its entry face',async()=>{
 const {nestedSpace}=await load();
 const parent={center:[0,2.5,0],size:[5,1.05,.75]};
 const child={size:[8,14,1]};
 const result=nestedSpace(parent,child,1.5,40,[0,0,1]);
 assert.ok(child.size[0]*result.scale<parent.size[0]);
 assert.ok(child.size[1]*result.scale<parent.size[1]);
 assert.ok(result.center[2]+result.distance<parent.center[2]);
 assert.equal(result.center[1],2.5);
 assert.ok(result.distance<5);
});
test('three nested levels retain scale and positive camera precision',async()=>{
 const {nestedSpace}=await load();let size=[5,1.05,.75],center=[0,0,0],previous=1;
 for(let level=0;level<3;level++){
  const n=nestedSpace({center,size},{size:[10,14,1]},.7,40,[0,0,1]);
  assert.ok(n.scale>0&&n.scale<previous);assert.ok(n.distance>0);
  previous=n.scale;center=n.center;size=[5,1.05,.75].map(v=>v*n.scale);
 }
});
test('dolly follows one continuous inward move, reversible and without overshoot',async()=>{
 const {dollyFrame}=await load();
 const from={position:[3,2,24],target:[0,0,0]},to={position:[0,2.5,.2],target:[0,2.5,-1]};
 assert.deepEqual(dollyFrame(from,to,0),from);assert.deepEqual(dollyFrame(from,to,1),to);
 let previous=Infinity;
 for(let i=0;i<=100;i++){
  const f=dollyFrame(from,to,i/100),distance=Math.hypot(...f.position.map((v,k)=>v-f.target[k]));
  assert.ok(distance<=previous+1e-8);previous=distance;
 }
 assert.deepEqual(dollyFrame(to,from,1),from);
});
