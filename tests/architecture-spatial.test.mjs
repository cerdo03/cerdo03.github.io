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
test('residual caption clears component labels without leaving the scene',async()=>{
 const {captionPosition}=await load();
 const bounds={width:500,height:410};
 const obstacle={x:180,y:200,width:180,height:25};
 const caption={x:325,y:205,width:95,height:25};
 const position=captionPosition(caption,[obstacle],bounds);
 assert.ok(position.x>=4&&position.x+caption.width<=bounds.width-4);
 assert.ok(position.y>=4&&position.y+caption.height<=bounds.height-4);
 assert.ok(position.x>=obstacle.x+obstacle.width+4||position.y>=obstacle.y+obstacle.height+4||position.x+caption.width<=obstacle.x-4||position.y+caption.height<=obstacle.y-4);
});
test('caption stays visible when its projected anchor is near the viewport edge',async()=>{
 const {captionPosition}=await load();
 const result=captionPosition({x:290,y:400,width:90,height:24},[],{width:320,height:410});
 assert.ok(result.x+90<=316&&result.y+24<=406);
});
test('narrow QKV view stacks readable projection blocks without changing its input',async()=>{
 const {layoutNodes}=await load();
 const {sceneModel,configuration}=await import('../labs/attention/architecture-explorer/model.js');
 const original=sceneModel('qkv',configuration()).nodes;
 const before=JSON.stringify(original),narrow=layoutNodes(original,300),wide=layoutNodes(original,1000);
 assert.equal(JSON.stringify(original),before);
 assert.equal(new Set(narrow.map(n=>n.x)).size,1);
 assert.ok(narrow.every((n,i)=>i===0||narrow[i-1].y-n.y>=2));
 const projections=wide.filter(n=>['q','k','v'].includes(n.id));
 assert.ok(projections[1].x-projections[0].x>=6&&projections[2].x-projections[1].x>=6);
});
test('tablet head layout retains each physical KV node with four well-spaced columns',async()=>{
 const {layoutNodes}=await load();
 const {sceneModel,configuration}=await import('../labs/attention/architecture-explorer/model.js');
 const original=sceneModel('heads',configuration({qHeads:32})).nodes;
 const result=layoutNodes(original,700),heads=result.filter(n=>n.id.startsWith('head-'));
 assert.equal(result.length,original.length);
 assert.equal(new Set(heads.map(n=>n.x)).size,4);
 assert.ok(heads[0].y-heads[4].y>=2);
 assert.deepEqual(result.map(n=>n.id),original.map(n=>n.id));
});
test('stacked projections each receive a direct branch clear of the other blocks',async()=>{
 const {projectionRoute}=await load(),input=[0,4,0];
 for(const y of [1.5,-1.5,-4.5]){
  const points=projectionRoute(input,[0,y,0]);
  assert.deepEqual(points[0],input);assert.deepEqual(points.at(-1),[-2.5,y,0]);
  assert.ok(points.slice(1,-1).every(point=>point[0]<-2.5));
 }
});
