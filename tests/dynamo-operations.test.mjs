import test from 'node:test';
import assert from 'node:assert/strict';
import { coordinationTrace, controllerTick } from '../labs/dynamo/operations.js';
test('client routing removes hops but stale membership causes retry and refresh',()=>{
 assert.ok(coordinationTrace({client:true}).at(-1).time<coordinationTrace({client:false}).at(-1).time);
 assert.ok(coordinationTrace({client:true,stale:true}).some(event=>event.kind==='refresh'));
 assert.ok(coordinationTrace({client:true,write:true}).some(event=>event.kind==='coordinator'));
});
test('foreground feedback throttles background repair and recovery slows',()=>{
 const high=controllerTick({slices:5,remaining:50},45);
 const low=controllerTick({slices:5,remaining:50},10);
 assert.ok(high.slices<low.slices);
 const highNext=controllerTick(high,45);const lowNext=controllerTick(low,10);
 assert.ok(highNext.remaining>lowNext.remaining);
});
