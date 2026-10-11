import {test} from 'node:test';
import assert from 'node:assert/strict';
import {visualState} from '../labs/inference/attention-visual.js';
test('selecting earlier query masks future positions',()=>{const s=visualState(0,1);assert.deepEqual(s.weights,[1,0,0]);assert.deepEqual(s.output,[4,0]);});
test('changing query changes normalized attention and mixed output',()=>{const a=visualState(2,1),b=visualState(2,4);assert.notDeepEqual(a.weights,b.weights);assert.notDeepEqual(a.output,b.output);assert.ok(Math.abs(b.weights.reduce((x,y)=>x+y,0)-1)<1e-10);});
