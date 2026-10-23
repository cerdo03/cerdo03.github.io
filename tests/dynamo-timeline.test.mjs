import test from 'node:test';
import assert from 'node:assert/strict';
import { replay, orderedEvents, seededRandom } from '../labs/dynamo/timeline.js';
test('replay restores deterministic snapshots without future events',()=>{
 const events=[{time:2,kind:'add',value:3},{time:1,kind:'add',value:2}];
 const reduce=(state,event)=>({value:state.value+event.value});
 assert.deepEqual(replay({value:0},events,reduce,1).state,{value:2});
 assert.deepEqual(replay({value:0},events,reduce,2).state,{value:5});
 assert.deepEqual(orderedEvents([{time:1,kind:'first'},{time:1,kind:'second'}]).map(e=>e.kind),['first','second']);
});
test('seeded randomness repeats exactly for replayable gossip choices',()=>{
 const a=seededRandom(42),b=seededRandom(42);assert.deepEqual([a(),a(),a()],[b(),b(),b()]);
});
