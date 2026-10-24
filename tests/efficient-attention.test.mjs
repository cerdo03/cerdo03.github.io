import test from 'node:test';
import assert from 'node:assert/strict';
let a,k;
try {a=await import('../labs/efficient-attention/attention-model.js');}catch{}
try {k=await import('../labs/efficient-attention/kv-model.js');}catch{}
const close=(x,y)=>assert.ok(Math.abs(x-y)<1e-10,`${x} ≈ ${y}`);
const vectors=(x,y)=>x.flat(Infinity).forEach((v,i)=>close(v,y.flat(Infinity)[i]));
const Q=[[1,0],[0,1],[1,1]],K=[[1,0],[2,1],[0,2]],V=[[1,0,2],[0,1,3],[2,1,0]];
test('streaming rescales denominator and numerator when maximum changes',()=>{
 assert.ok(a,'attention model exists');
 let s=a.emptySummary(2);s=a.mergeAttentionSummary(s,[1,2],[[1,0],[0,1]]);s=a.mergeAttentionSummary(s,[3,4],[[1,1],[2,0]]);
 close(s.m,4);close(s.l,1.553001792775919);vectors(a.normalized(s),[1.55676994114594,0.32402713683194273]);
});
test('dense reference and streamed attention agree for all partitions and causal alignment',()=>{
 assert.ok(a);
 for(const causal of [false,true])for(const tile of [1,2,4])vectors(a.streamedAttention(Q,K,V,{causal,tile}),a.denseAttention(Q,K,V,{causal}));
 const query=[[1,1]];
 vectors(a.streamedAttention(query,K,V,{causal:true,prefix:2,tile:2}),a.denseAttention(query,K,V));
 assert.notDeepEqual(a.denseAttention(query,K,V,{causal:true}),a.denseAttention(query,K,V));
});
test('summaries handle masked tiles, extreme finite scores and order changes',()=>{
 assert.ok(a);const s=a.mergeAttentionSummary(a.emptySummary(1),[-Infinity,-Infinity],[[1],[2]]);assert.deepEqual(s,a.emptySummary(1));assert.deepEqual(a.normalized(s),[0]);
 const x=a.mergeAttentionSummary(a.emptySummary(1),[1000,1001],[[2],[4]]);assert.ok(Number.isFinite(x.l));
 const y=a.mergeAttentionSummary(a.mergeAttentionSummary(a.emptySummary(1),[1001],[[4]]),[1000],[[2]]);vectors(a.normalized(x),a.normalized(y));
 assert.throws(()=>a.mergeAttentionSummary(x,[NaN],[[1]]));
});
test('GQA keeps query heads separate and maps them to KV groups',()=>{
 assert.ok(a);const out=a.groupedAttention([Q,Q,Q,Q],[K,K.map(r=>r.map(x=>x+1))],[V,V.map(r=>r.map(x=>x*2))]);
 vectors(out[0],a.denseAttention(Q,K,V));vectors(out[3],a.denseAttention(Q,K.map(r=>r.map(x=>x+1)),V.map(r=>r.map(x=>x*2))));assert.throws(()=>a.groupedAttention([Q,Q,Q],[K,K],[V,V]));
});
test('online operation trace isolates each rescale and retains final result',()=>{
 assert.ok(a);const t=a.onlineTrace([1,2,3,4],[[1,0],[0,1],[1,1],[2,0]],2);
 assert.equal(t.filter(x=>x.op==='rescale-numerator').length,1);vectors(t.at(-1).output,[1.55676994114594,.32402713683194273]);assert.equal(t.at(-1).op,'normalize');
});
test('traffic ledger distinguishes intermediate footprint, transfers and peak workspace',()=>{
 assert.ok(a);const b=a.materializedTraffic(4096,4096,128,128,2);assert.equal(b.intermediateBytes,64*1024**2);assert.equal(b.intermediateTraffic,128*1024**2);
 const x=a.tiledTraffic({tq:3,tk:5,dk:2,dv:3,br:2,bc:2,bytes:2});assert.equal(x.qRead,12);assert.equal(x.kvRead,100);assert.equal(x.outputWrite,18);assert.equal(x.totalBytes,130);assert.equal(x.events.reduce((n,e)=>n+e.bytes,0),130);
 const y=a.tiledTraffic({tq:3,tk:5,dk:2,dv:3,br:1,bc:2,bytes:2});assert.ok(y.kvRead>x.kvRead);assert.ok(y.peakWorkspace<x.peakWorkspace);
 const z=a.tiledTraffic({tq:3,tk:3,dk:2,dv:2,br:2,bc:2,bytes:2,causal:true});assert.equal(z.visitedTiles,3);assert.equal(z.allowedPairs,6);
});
const row=i=>({token:`p${i}`,key:[i+1,1],value:[1,i+1]});
test('KV boundary growth and address resolution preserve logical order',()=>{
 assert.ok(k,'KV model exists');let p=k.createPool(8,4);p=k.createSequence(p,'A',Array.from({length:7},(_,i)=>row(i)));assert.equal(p.sequences.A.blocks.length,2);p=k.appendKV(p,'A',row(7));assert.equal(p.sequences.A.blocks.length,2);p=k.appendKV(p,'A',row(8));assert.equal(p.sequences.A.blocks.length,3);assert.equal(k.resolveKVPosition(p,'A',8).offset,0);assert.deepEqual(k.gatherKV(p,'A'),Array.from({length:9},(_,i)=>row(i)));assert.throws(()=>k.resolveKVPosition(p,'A',9));
});
test('fork copy-on-write preserves sibling and reference counts',()=>{
 assert.ok(k);let p=k.createSequence(k.createPool(8,4),'A',Array.from({length:6},(_,i)=>row(i)));p=k.forkSequence(p,'A','B');const old=p.sequences.B.blocks[1];p=k.appendKV(p,'A',row(6));assert.notEqual(p.sequences.A.blocks[1],old);assert.equal(p.blocks[old].rows.length,2);assert.equal(p.blocks[old].refs,1);assert.equal(p.blocks[p.sequences.A.blocks[0]].refs,2);assert.ok(p.events.some(e=>e.type==='copy'&&e.rows===2));p=k.appendKV(p,'B',{...row(6),token:'other'});assert.equal(p.sequences.B.blocks[1],old);assert.equal(k.gatherKV(p,'B').at(-1).token,'other');assert.equal(k.gatherKV(p,'A').at(-1).token,'p6');k.assertPool(p);
});
test('release frees only unreferenced blocks; reuse clears stale rows',()=>{
 assert.ok(k);let p=k.createSequence(k.createPool(4,4),'A',[row(0)]);p=k.forkSequence(p,'A','B');p=k.releaseSequence(p,'A');assert.equal(k.poolSummary(p).physicalBlocks,1);p=k.releaseSequence(p,'B');assert.equal(k.poolSummary(p).physicalBlocks,0);assert.ok(p.blocks.every(b=>b.rows.length===0));assert.throws(()=>k.releaseSequence(p,'B'));p=k.createSequence(p,'C',[]);assert.equal(k.poolSummary(p).physicalBlocks,0);k.assertPool(p);
});
test('allocation and COW exhaustion leave input state unchanged',()=>{
 assert.ok(k);let p=k.createSequence(k.createPool(1,4),'A',[row(0)]);p=k.forkSequence(p,'A','B');const before=JSON.stringify(p);assert.throws(()=>k.appendKV(p,'A',row(1)),/exhausted/);assert.equal(JSON.stringify(p),before);k.assertPool(p);
});
test('memory accounting counts unique physical storage and holds byte budget constant',()=>{
 assert.ok(k);const q=k.kvBytesPerToken(32,8,128,2);assert.equal(q,131072);const x=k.capacity([6,4],4,q);assert.equal(x.rawBytes,1310720);assert.equal(x.allocatedBytes,1572864);assert.equal(x.slackBytes,262144);assert.equal(k.capacity([6,4],2,q).slackBytes,0);assert.equal(k.capacity([6,4],8,q).slackBytes,786432);
 let p=k.createSequence(k.createPool(8,4),'A',Array.from({length:6},(_,i)=>row(i)));p=k.forkSequence(p,'A','B');assert.equal(k.poolSummary(p).logicalTokens,12);assert.equal(k.poolSummary(p).storedTokens,6);assert.equal(k.poolSummary(p).physicalBlocks,2);
});
test('seeded ragged tensors preserve dense results across widths, masks and cached prefixes',()=>{
 assert.ok(a);let seed=941;const rand=()=>{seed=(seed*1664525+1013904223)>>>0;return (seed/2**32-.5)*8;};
 for(const tq of [1,3])for(const tk of [3,5])for(const dk of [1,3])for(const dv of [1,4])for(const causal of [false,true]){
  const q=Array.from({length:tq},()=>Array.from({length:dk},rand)),key=Array.from({length:tk},()=>Array.from({length:dk},rand)),value=Array.from({length:tk},()=>Array.from({length:dv},rand));
  for(const tile of [1,2,4,8])vectors(a.streamedAttention(q,key,value,{tile,causal,prefix:tk-tq}),a.denseAttention(q,key,value,{causal,prefix:tk-tq}));
 }
});
test('permuting physical block IDs preserves gathered keys/values and attention output',()=>{
 assert.ok(k);const p=k.createSequence(k.createPool(4,2),'A',Array.from({length:5},(_,i)=>row(i))),r=structuredClone(p),permutation=[3,1,0,2];r.blocks=p.blocks.map(()=>null);p.blocks.forEach(b=>r.blocks[permutation[b.id]]={...structuredClone(b),id:permutation[b.id]});r.sequences.A.blocks=r.sequences.A.blocks.map(id=>permutation[id]);k.assertPool(r);assert.deepEqual(k.gatherKV(r,'A'),k.gatherKV(p,'A'));const attention=pool=>{const rows=k.gatherKV(pool,'A');return a.denseAttention([[1,0]],rows.map(x=>x.key),rows.map(x=>x.value));};vectors(attention(r),attention(p));
});
