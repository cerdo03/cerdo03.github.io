import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
test('prefill chart is inside the explanation that refers to bars below',()=>{const source=readFileSync(new URL('../labs/inference/app.js',import.meta.url),'utf8');assert.ok(source.includes('<p>${s.depth}</p>${s.scene===\'prefill\'?probabilityBars():\'\'}</details>'));});
