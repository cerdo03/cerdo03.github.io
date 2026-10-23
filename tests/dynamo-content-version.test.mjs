import test from 'node:test';
import assert from 'node:assert/strict';
import {contentURL} from '../labs/dynamo/content-url.js';
test('JSON content follows the deployed module version rather than retaining stale lessons',()=>{
 assert.equal(contentURL('./deep-reading.json','https://example.test/labs/dynamo/app.js?v=abc123'),'https://example.test/labs/dynamo/deep-reading.json?v=abc123');
});
