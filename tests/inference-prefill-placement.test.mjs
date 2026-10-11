import {test} from 'node:test';
import assert from 'node:assert/strict';
import {diagramHTML} from '../labs/inference/course-visuals.js';
test('prefill reveals probability bars after processing and before selection',()=>{
 assert.ok(!diagramHTML('prefill',{event:1}).includes('prob-track'));
 const scored=diagramHTML('prefill',{event:2});
 assert.ok(scored.includes('prob-track'));assert.ok(scored.includes('60%'));
 assert.ok(!scored.includes('Chosen first answer token'));
 assert.ok(diagramHTML('prefill',{event:3}).includes('Chosen first answer token'));
});
test('projection visual reveals operations without prematurely showing attention outputs',()=>{
 const initial=diagramHTML('qkv',{event:0});assert.ok(!initial.includes('Attention output'));assert.ok(initial.includes('Q not calculated yet'));
 const live=diagramHTML('qkv',{event:3,position:1,first:4});assert.ok(live.includes('Q = [4, 1]'));assert.ok(live.includes('K = [1, 4]'));assert.ok(live.includes('V = [8, 1]'));
});
test('prefill cells name the words each position mixes and the later words it cannot see',()=>{
 const html=diagramHTML('prefill',{event:1});
 assert.ok(!html.includes('reads position'));
 assert.ok(html.includes('Mixes in: <span class="seen">Explain</span> <span class="hidden-token">KV</span> <span class="hidden-token">caching</span>'));
 assert.ok(html.includes('Mixes in: <span class="seen">Explain</span> <span class="seen">KV</span> <span class="seen">caching</span>'));
 assert.ok(html.includes('can never use later words'));
});
test('prefill explains mixing with a worked weighted sum before attention lessons',()=>{
 const html=diagramHTML('prefill',{event:1});
 assert.ok(html.includes('What does “mixing” mean?'));
 assert.ok(html.includes('0.5 × [2, 0] = [1, 0]'));
 assert.ok(html.includes('= [1.3, 0.8]'));
 assert.ok(html.includes('steps 5 and 7'));
});
