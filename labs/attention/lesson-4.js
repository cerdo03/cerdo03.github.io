// Lesson 2.4 entry point. Lesson agent: mount this lesson's widgets here.
// Shared building blocks: pure math (attention-math.js), DOM helpers (ui.js), toy decode simulation (kv-sim.js).
// Keep widget state local to this file; never re-render the whole page on one control change.
import * as math from './attention-math.js';
import * as ui from './ui.js';
import * as kvSim from './kv-sim.js';

export const lesson = Object.freeze({ number: 4, math, ui, kvSim });
