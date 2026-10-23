import test from 'node:test';
import assert from 'node:assert/strict';
import { reconcileHistory, transferRange } from '../labs/dynamo/membership.js';
test('explicit removal converges through gossip without interpreting timeout as leave',()=>{
 const a=[{node:'B',action:'join',time:1}];const b=[{node:'B',action:'leave',time:2}];
 assert.deepEqual(reconcileHistory(a,b),b);
 assert.deepEqual(reconcileHistory(a,[]),a);
});
test('range transfer rejects duplicate offers after confirmation',()=>{
 const state={received:[],pending:[]};
 transferRange(state,'(A,X]','B',false);assert.deepEqual(state.received,[]);
 transferRange(state,'(A,X]','B',true);transferRange(state,'(A,X]','C',true);
 assert.deepEqual(state.received,['(A,X]']);
});
