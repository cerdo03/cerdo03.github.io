import test from 'node:test';
import assert from 'node:assert/strict';
import { evolution } from '../labs/dynamo/evolution.js';
test('same seeded workload produces deterministic actual ownership movement',()=>{
 const first=evolution(1,'join',false);assert.deepEqual(first,evolution(1,'join',false));
 assert.ok(first.movedKeys.length>0);assert.ok(first.invalidatedRanges>0);
});
test('fixed partitions retain boundaries through join and removal',()=>{
 for(const strategy of [2,3])for(const operation of ['join','remove'])assert.equal(evolution(strategy,operation,false).invalidatedRanges,0);
});
