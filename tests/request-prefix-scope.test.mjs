import test from 'node:test';
import assert from 'node:assert/strict';
import {visualView} from '../labs/llm-systems/learning-visuals.js';
import {requestFrame, dependencyState} from '../labs/llm-systems/visual-model.js';
const state={stage:0,pass:0,query:2,change:2};
const text=view=>view.graph.replace(/<[^>]+>/g,'');
test('prefill view exposes prompt-query inspection without a pass selector',()=>{
 const view=visualView('request',state,undefined,{requestScope:'prefill'});
 assert.doesNotMatch(view.controls,/data-field="pass"/);
 assert.match(view.controls,/data-field="query"/);
 assert.equal(view.max,5);
});
test('cache comparison starts with known fresh projections and ends at storage',()=>{
 const options={requestScope:'cache'};
 const start=visualView('request',{...state,pass:1,stage:1},undefined,options);
 assert.doesNotMatch(start.controls,/<select/);
 assert.match(start.caption,/Known input/);
 assert.match(text(start),/cached · unchanged/);
 assert.match(text(start),/fresh from its own x/);
 assert.equal(start.max,4);
 const end=visualView('request',{...state,pass:1,stage:4},undefined,options);
 assert.match(text(end),/4 stored K\/V rows/);
 assert.doesNotMatch(text(end),/Next output token/);
});
test('decode-only selector excludes prefill and keeps successive decode passes',()=>{
 const options={requestScope:'decode',prompt:['The','sky','is','blue'],answer:['and','the','sun','shines','.']};
 const view=visualView('request',{...state,pass:1},undefined,options);
 assert.doesNotMatch(view.controls,/value="0"|data-field="query"/);
 assert.match(view.controls,/Decode 4/);
 const f=requestFrame(4,5,undefined,options.prompt,options.answer);
 assert.equal(f.cache.length,8);
 assert.equal(f.chosen,'.');
 assert.ok(!f.cache.some(r=>r.token==='.'), 'last chosen token is not processed');
});
test('fixed recap preserves exact processed/cache/chosen boundary for every pass',()=>{
 const view=visualView('recap',state);
 assert.equal(view.max,0);
 assert.equal(view.controls,'');
 assert.match(text(view),/Prefill|Decode 1|Decode 2/);
 for(const pass of [0,1,2]){
  const f=requestFrame(pass,5);
  assert.match(text(view),new RegExp(`${f.cache.length} stored K/V rows`));
  assert.ok(text(view).includes(`${f.chosen} · no K/V yet`));
 }
 assert.match(view.caption,/scripted/);
 assert.match(view.caption,/final chosen token/);
});
test('prefix transfer is fixed changed-middle comparison, validity remains experiment',()=>{
 const view=visualView('prefix',state);
 assert.equal(view.max,0);
 assert.equal(view.controls,'');
 assert.match(text(view),/Request A|Request B/);
 const d=dependencyState(2);
 assert.equal(d.match,2);
 assert.match(view.caption,/2 identical beginning positions/);
 assert.match(view.caption,/same spelling/);
 for(const qualifier of ['model','token IDs','positions','settings','blocks','boundary'])assert.ok((view.caption+' '+view.note).includes(qualifier),qualifier);
 assert.match(visualView('validity',state).controls,/Modify the sequence/);
});
