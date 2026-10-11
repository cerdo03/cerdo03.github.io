import {test} from 'node:test';
import assert from 'node:assert/strict';
import {kvBytes, reusablePrefix, estimate} from '../labs/inference/model.js';
test('GQA cache: 32 layers, 8 KV heads, 128 dims, fp16 = 128KiB/token',()=>assert.equal(kvBytes(1,32,8,128,2),131072));
test('cache scales with batch and sequence',()=>assert.equal(kvBytes(2048,32,8,128,2,4),1073741824));
test('prefix stops at first mismatch and uses complete blocks',()=>{assert.equal(reusablePrefix(['a','b','c','d'],['a','b','x','d'],2),2);assert.equal(reusablePrefix(['a','b','c'],['a','b','c'],2),2);assert.equal(reusablePrefix(['x','b'],['a','b'],1),0)});
test('reuse reduces prefill but preserves decode work',()=>{const a=estimate(2048,128,0,8);const b=estimate(2048,128,1024,8);assert.ok(b.prefillMs<a.prefillMs);assert.equal(a.decodeMs,b.decodeMs);assert.equal(a.cacheBytes,b.cacheBytes)});
