import {test} from 'node:test';
import assert from 'node:assert/strict';
import {attentionState} from '../labs/inference/guide-model.js';
import {diagramHTML} from '../labs/inference/course-visuals.js';
test('shared embeddings drive projections and value mixtures without changing fixed defaults',()=>{
 const rows=[[2,0],[0,1],[3,4]];
 const a=attentionState(2,undefined,rows);
 assert.deepEqual(a.q,[3,4]);assert.deepEqual(a.keys[2],[4,3]);assert.deepEqual(a.values[2],[6,4]);
 assert.deepEqual(attentionState().x,[1,2]);
 const input=diagramHTML('tokens',{event:1,embeddings:rows});
 const projected=diagramHTML('qkv',{event:3,embeddings:rows});
 assert.ok(input.includes('[3, 4]'));assert.ok(projected.includes('Q = [3, 4]'));assert.ok(projected.includes('V = [6, 4]'));
 assert.ok(!projected.includes('type="number"'));
});

test('introductory memory fixes architecture even when older saved controls remain',()=>{
 const html=diagramHTML('memory',{length:1024,batch:4,heads:1,bytes:1});
 assert.match(html,/536,870,912 bytes/);
 assert.match(html,/32 layers, 8 KV heads per layer, head dimension 128, 2 bytes/);
 assert.doesNotMatch(html,/id="(?:heads|bytes)"/);
});
