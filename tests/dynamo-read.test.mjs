import test from 'node:test';
import assert from 'node:assert/strict';
import { readTrace, percentile } from '../labs/dynamo/reads.js';
test('read returns after threshold then late repair keeps response separate',()=>{
 const result=readTrace([{node:'A',time:1,version:2},{node:'B',time:3,version:2},{node:'C',time:8,version:1}],2,10);
 assert.equal(result.responseTime,3);assert.equal(result.repairs[0].node,'C');assert.equal(result.repairs[0].time,8);
});
test('read deadline can fail despite one existing replica',()=>{
 assert.equal(readTrace([{node:'A',time:1,version:1}],2,10).responseTime,null);
});
test('nearest-rank percentile exposes rare slow samples',()=>{
 const samples=Array(999).fill(1).concat(1000);
 assert.equal(percentile(samples,.5),1);assert.equal(percentile(samples,1),1000);
});
test('late newer version cannot repair before it is observed',()=>{
 const result=readTrace([{node:'A',time:1,version:1},{node:'B',time:3,version:1},{node:'C',time:8,version:2}],2,10);
 assert.ok(result.repairs.every(repair=>repair.time>=8));
});
test('late reply outside bounded post-response wait cannot influence repair',()=>{
 const result=readTrace([{node:'A',time:1,version:1},{node:'B',time:3,version:1},{node:'C',time:100,version:9}],2,10,5);
 assert.equal(result.latest,1);assert.deepEqual(result.repairs,[]);
});
test('duplicate responder is not two read participants',()=>{
 const result=readTrace([{node:'A',time:1,version:1},{node:'A',time:2,version:1}],2,10);
 assert.equal(result.responseTime,null);
 assert.throws(()=>readTrace([],0,10),RangeError);
});
