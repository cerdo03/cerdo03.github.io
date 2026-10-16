import test from 'node:test';
import assert from 'node:assert/strict';
import { stableSoftmax, resolveReturnLink, exercises, evaluateChoice } from '../labs/llm-systems/math-exercises.js';

test('stable softmax normalizes, preserves shifts and supports long rows', () => {
 const logits=[4,8,2,6], weights=stableSoftmax(logits);
 assert.ok(Math.abs(weights.reduce((a,b)=>a+b,0)-1)<1e-12);
 stableSoftmax(logits.map(x=>x+10000)).forEach((x,i)=>assert.ok(Math.abs(x-weights[i])<1e-12));
 assert.equal(stableSoftmax(Array(150000).fill(10000)).length,150000);
});
test('masked positions are exact zeros; empty and all-masked inputs reject', () => {
 assert.deepEqual(stableSoftmax([0,-Infinity]),[1,0]);
 assert.ok(stableSoftmax([0,-100])[1]>0);
 for(const row of [[],[-Infinity,-Infinity],[NaN],[Infinity]]) assert.throws(()=>stableSoftmax(row),RangeError);
});
test('return links accept only authored origin keys', () => {
 assert.equal(resolveReturnLink('?from=softmax'),'../attention/lesson-1.html#s2-1-5');
 for(const query of ['?from=https://evil.example','?from=__proto__','?from=constructor','']) assert.equal(resolveReturnLink(query),'../attention/lesson-1.html#s2-1-5');
});
test('notation checkpoint gives deterministic explanatory feedback', () => {
 assert.equal(exercises.notation.answer,1);
 assert.equal(evaluateChoice('notation',1).correct,true);
 assert.equal(evaluateChoice('notation',0).correct,false);
 assert.ok(evaluateChoice('notation',0).feedback.length>30);
});
