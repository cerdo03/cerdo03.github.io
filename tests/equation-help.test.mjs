import test from 'node:test';
import assert from 'node:assert/strict';
import {equationDefinitions} from '../labs/llm-systems/equation-explorer.js';
import * as math from '../labs/llm-systems/math-exercises.js';
test('KV and mask references link to practice for their own objectives',()=>{
 assert.equal(equationDefinitions['kv-memory'].practice,'kv-memory');
 assert.equal(equationDefinitions['kv-memory'].practiceSection,'kv-practice');
 assert.equal(equationDefinitions['masked-attention'].practice,'masked-attention');
 assert.equal(equationDefinitions['masked-attention'].lesson,5);
 assert.equal(equationDefinitions['masked-attention'].practiceSection,'mask-practice');
});
test('canonical KV byte and mask checks distinguish units, exclusion and renormalization',()=>{
 for(const id of ['kv-memory','masked-attention']){
  assert.ok(math.exercises[id]);
  for(let choice=0;choice<3;choice++)assert.equal(math.evaluateChoice(id,choice).correct,choice===1);
 }
 assert.equal(math.rawKvBytes({layers:2,tokens:3,kvHeads:2,headDim:4,bytesPerElement:2}),192);
 assert.match(math.evaluateChoice('kv-memory',0).feedback,/both key and value/);
 assert.match(math.evaluateChoice('kv-memory',2).feedback,/elements.*bytes/);
 assert.match(math.evaluateChoice('masked-attention',0).feedback,/renormaliz/);
});
test('compound shape feedback identifies first wrong axis before the full reference',()=>{
 assert.equal(typeof math.evaluateShapeTrace,'function');
 const correct={q:'4,2',scores:'4,6',out:'4,3'};
 assert.equal(math.evaluateShapeTrace(correct).correct,true);
 for(const [field,wrong,expected] of [['q','8,2',/Q.*token/],['scores','2,2',/score.*key/],['out','4,6',/output.*value/]]){
  const result=math.evaluateShapeTrace({...correct,[field]:wrong});assert.equal(result.correct,false);assert.match(result.feedback.split('Reference:')[0],expected);
 }
 assert.match(math.evaluateShapeTrace({q:'',scores:'',out:''}).feedback,/Choose.*Q/);
});
test('loop translation feedback distinguishes fixed output indices and both reduction uses',()=>{
 assert.equal(typeof math.evaluateLoopTranslation,'function');
 const correct={output:'O_ij',index:'k',left:'A_ik',right:'V_kj'};
 assert.equal(math.evaluateLoopTranslation(correct).correct,true);
 for(const [field,wrong,expected] of [['output','O_ik',/Output.*i.*j/],['index','j',/Reduction.*k/],['left','A_ij',/First factor.*column/],['right','V_ij',/Second factor.*row/]]){
  const result=math.evaluateLoopTranslation({...correct,[field]:wrong});assert.equal(result.correct,false);assert.match(result.feedback.split('Reference:')[0],expected);
 }
});
test('each prediction exposes known operands before hiding the worked answer',()=>{
 const prompts={
  'softmax-stable':/4, 8, 2, 6/,
  'qkv-projection':/1, 2.*1, 0.*2, 1/,
  'attention-scores':/1, 2.*2, 0.*0, 1/,
  'masked-attention':/2, 1, 9.*third/,
  'weighted-values':/0.25, 0.75.*2, 4.*6, 0/,
  'kv-memory':/32 layers.*4096.*8 KV heads.*128.*2 bytes/,
 };
 for(const [id,operands] of Object.entries(prompts))assert.match(equationDefinitions[id].prediction||'',operands);
});
