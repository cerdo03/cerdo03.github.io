import {test} from 'node:test';
import assert from 'node:assert/strict';
import {probabilityBars} from '../labs/inference/probability-bars.js';
test('prefill probabilities have labeled bars and visible values',()=>{const html=probabilityBars();for(const [token,p] of [['blue',60],['gray',25],['clear',15]]){assert.ok(html.includes(`aria-label="${token}: ${p}%"`));assert.ok(html.includes(`width:${p}%`));assert.ok(html.includes(`${p}%`));}assert.ok(html.includes('Invented teaching example'));});
