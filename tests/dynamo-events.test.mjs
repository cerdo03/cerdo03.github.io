import test from 'node:test';
import assert from 'node:assert/strict';
import { writeTrace, sloppyPartition } from '../labs/dynamo/events.js';
test('write response waits for distinct persisted replicas, not all targets', () => {
  const trace = writeTrace({ replicas: ['A','B','C'], delays: [1,3,20], required: 2, deadline: 10 });
  assert.equal(trace.find(event => event.kind === 'response').time, 3);
  assert.equal(trace.at(-1).time, 20);
});
test('insufficient responses cause timeout, no success', () => {
  const trace = writeTrace({ replicas: ['A','B','C'], delays: [1,null,null], required: 2, deadline: 10 });
  assert.equal(trace.at(-1).kind, 'timeout');
  assert.equal(trace.some(event => event.kind === 'response'), false);
});
test('sloppy thresholds do not imply intersection of actual sets', () => {
  const result = sloppyPartition();
  assert.equal(result.r + result.w > result.n, true);
  assert.deepEqual(result.intersection, []);
});
test('persisted data can exist before delayed acknowledgements cause timeout',()=>{
 const trace=writeTrace({replicas:['A','B','C'],delays:[1,3,4],required:2,deadline:10,ackDelay:20});
 assert.equal(trace.filter(event=>event.kind==='persist').length,3);
 assert.equal(trace.some(event=>event.kind==='response'),false);
 assert.equal(trace.find(event=>event.kind==='timeout').time,10);
});
test('acknowledgement never precedes its own persistence at equal time',()=>{
 const trace=writeTrace({replicas:['A','B'],delays:[1,3],required:2,deadline:10});
 for(const node of ['A','B'])assert.ok(trace.findIndex(e=>e.kind==='persist'&&e.node===node)<trace.findIndex(e=>e.kind==='ack'&&e.node===node));
});
