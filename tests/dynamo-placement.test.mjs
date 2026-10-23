import test from 'node:test';
import assert from 'node:assert/strict';
import { strategyPlacement, efficiency } from '../labs/dynamo/placement.js';
test('strategies separate fixed partition boundaries from token ownership',()=>{
 const tokens=[{position:10,node:'A'},{position:40,node:'B'},{position:80,node:'C'}];
 assert.equal(strategyPlacement(1,15,tokens,10).boundary,40);
 assert.equal(strategyPlacement(2,15,tokens,10).boundary,20);
 assert.deepEqual(strategyPlacement(2,15,tokens,10).replicas,['B','C','A']);
 assert.equal(strategyPlacement(3,15,tokens,10).boundary,20);
});
test('efficiency exposes a hot node instead of assuming balanced keys equal balanced traffic',()=>{
 assert.equal(efficiency([10,10,10]),1);
 assert.equal(efficiency([30,0,0]),1/3);
});
import { balancedTokens, requestLoads } from '../labs/dynamo/placement.js';
test('balanced fixed partitions assign exactly Q/S tokens and survive join',()=>{
 for(const nodes of [['A','B','C'],['A','B','C','X']]){
  const tokens=balancedTokens(nodes,12);
  assert.equal(tokens.length,12);
  for(const node of nodes)assert.equal(tokens.filter(token=>token.node===node).length,12/nodes.length);
 }
});
test('request load is calculated from the actual selected placement and trace',()=>{
 const tokens=balancedTokens(['A','B','C'],12);
 const loads=requestLoads(3,[1,1,1,1],tokens,12);
 assert.equal(Object.values(loads).reduce((a,b)=>a+b,0),4);
 assert.equal(Math.max(...Object.values(loads)),4);
});
