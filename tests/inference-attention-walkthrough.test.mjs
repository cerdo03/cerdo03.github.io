import {test} from 'node:test';
import assert from 'node:assert/strict';
import {attentionExample} from '../labs/inference/attention-walkthrough.js';
test('query and key projections are computed from position representations',()=>{const m=attentionExample();assert.deepEqual(m.q,[1,2]);assert.deepEqual(m.keys,[[0,2],[1,0],[2,1]]);});
test('attention returns normalized weighted values, not Q/K/V or a token',()=>{const m=attentionExample();assert.ok(Math.abs(m.weights.reduce((a,b)=>a+b,0)-1)<1e-10);assert.equal(m.output.length,2);assert.ok(Math.abs(m.output[0]-(4*m.weights[0]+2*m.weights[2]))<1e-10);assert.ok(Math.abs(m.output[1]-(m.weights[1]+2*m.weights[2]))<1e-10);});
