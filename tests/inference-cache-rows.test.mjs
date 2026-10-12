import {test} from 'node:test';
import assert from 'node:assert/strict';
import {diagramHTML} from '../labs/inference/course-visuals.js';
test('cache row creation stays distinct from the attention result, using shared embeddings',()=>{
 const embeddings=[[2,0],[0,1],[3,4]];
 const before=diagramHTML('cache',{event:0,position:2,embeddings});
 const projected=diagramHTML('cache',{event:1,position:2,embeddings});
 const after=diagramHTML('cache',{event:4,position:2,embeddings});
 assert.ok(before.includes('2 rows in each cache'));
 assert.ok(projected.includes('K₃ = [4, 3]'));
 assert.ok(projected.includes('V₃ = [6, 4]'));
 assert.ok(after.includes('3 rows in each cache'));
 assert.ok(after.includes('does not replace the cached K/V'));
 assert.ok(!before.includes('K₃ = [4, 3]'));
});
