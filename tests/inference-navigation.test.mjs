import {test} from 'node:test';
import assert from 'node:assert/strict';
import {guide} from '../labs/inference/guide-content.js';
test('all five attention visuals occur before cache in main lesson path',()=>{const attention=guide.filter(s=>s.scene==='attention');assert.deepEqual(attention.map(s=>s.attentionStage),[0,1,2,3,4]);assert.ok(guide.findIndex(s=>s.scene==='cache')>guide.indexOf(attention[4]));});
