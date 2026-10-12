import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as visuals from '../labs/inference/course-visuals.js';
test('layer flow reveals head results before forwarding a model-width updated representation',()=>{
 assert.equal(typeof visuals.layerFlowHTML,'function');
 const start=visuals.layerFlowHTML({event:0,heads:2});
 assert.ok(start.includes('4 components'));
 assert.ok(!start.includes('Updated x′'));
 const projected=visuals.layerFlowHTML({event:1,heads:2});
 assert.ok(projected.includes('Q · head 1'));assert.ok(projected.includes('2 components'));
 const joined=visuals.layerFlowHTML({event:3,heads:2});assert.ok(joined.includes('Joined head results'));assert.ok(joined.includes('4 components'));
 const next=visuals.layerFlowHTML({event:6,heads:2});assert.ok(next.includes('Next layer’s input'));assert.ok(next.includes('Updated x′'));assert.ok(!next.includes('Q · head 1'));
});
test('incoming representations remain per-position through the layer stack',()=>{
 const initial=visuals.diagramHTML('attention',{event:0});assert.ok(initial.includes('Embedding lookup'));assert.ok(initial.includes('One vector per position'));
 const later=visuals.diagramHTML('attention',{event:2});assert.ok(later.includes('Layer 2 input'));assert.ok(later.includes('Layer 1 output'));assert.ok(later.includes('The'));assert.ok(later.includes('is'));
});
