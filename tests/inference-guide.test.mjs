import {test} from 'node:test';
import assert from 'node:assert/strict';
import {generationFrame,attentionWeights} from '../labs/inference/guide-model.js';
test('prefill predicts first output before consuming any output',()=>assert.deepEqual(generationFrame(1),{phase:'Prefill',consumed:['Explain','KV','caching'],output:['It'],cached:3}));
test('last sampled output has no KV yet',()=>{const s=generationFrame(3);assert.equal(s.cached,5);assert.deepEqual(s.output,['It','stores','information']);assert.deepEqual(s.consumed,['Explain','KV','caching','It','stores'])});
test('attention turns score differences into normalized weights',()=>{const w=attentionWeights([0,0,0]);assert.ok(w.every(x=>Math.abs(x-1/3)<1e-9));assert.ok(Math.abs(attentionWeights([1,3,2]).reduce((a,b)=>a+b,0)-1)<1e-9)});
