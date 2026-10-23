import test from 'node:test';
import assert from 'node:assert/strict';
import { createCluster, put, get, heal, mergeCart } from '../labs/dynamo/cluster.js';
test('one cart branches across partition, returns siblings after healing, then merges',()=>{
 const cluster=createCluster();
 const first=put(cluster,['A','B','C'],{},['book'],'A');
 put(cluster,['A','D','E'],first.clock,['book','pen'],'A');
 put(cluster,['B','C','F'],first.clock,[],'B');
 assert.equal(get(cluster,['A','D']).versions.length,1);
 assert.equal(get(cluster,['B','C']).versions.length,1);
 heal(cluster);
 const result=get(cluster,['A','B']);
 assert.equal(result.versions.length,2);
 const merged=mergeCart(result.versions);
 assert.deepEqual(merged,['book','pen']);
 put(cluster,['A','B','C'],result.context,merged,'A');
 assert.equal(get(cluster,['A','B']).versions.length,1);
});
test('coordinator counters advance even when a client repeats old context',()=>{
 const cluster=createCluster();
 const first=put(cluster,['A'],{},['book'],'A');
 const second=put(cluster,['A'],{},['pen'],'A');
 assert.equal(first.clock.A,1);assert.equal(second.clock.A,2);
});
test('fallback copies use hint storage and heal only home replicas',()=>{
 const cluster=createCluster();put(cluster,['A','D','E'],{},['book'],'A');
 assert.equal(cluster.stores.D.length,0);assert.equal(cluster.hints.D.length,1);
 heal(cluster);
 assert.equal(cluster.hints.D.length,0);assert.equal(cluster.stores.B.length,1);
 assert.equal(cluster.stores.G.length,0);
});
import { changeHomes } from '../labs/dynamo/cluster.js';
test('membership transfer retains source until confirmed then removes obsolete copy',()=>{
 const cluster=createCluster();put(cluster,['A','B','C'],{},['book'],'A');
 changeHomes(cluster,['X','B','C'],false);assert.equal(cluster.stores.X.length,0);assert.equal(cluster.stores.A.length,1);
 changeHomes(cluster,['X','B','C'],true);assert.equal(cluster.stores.X.length,1);assert.equal(cluster.stores.A.length,0);
});
