import test from 'node:test';
import assert from 'node:assert/strict';

async function model() {
  const module = await import('../labs/gpu/execution-model.js').catch(() => null);
  assert.ok(module, 'GPU execution prototype needs a shared launch/calculation model');
  return module;
}
test('output 137 keeps its identity while block regrouping changes its address', async () => {
  const {describeLaunch} = await model();
  const a = describeLaunch(150, 64, 137), b = describeLaunch(150, 128, 137);
  assert.deepEqual(a.selected, {output:137, row:13, column:7, block:2, localThread:9, warp:0, lane:9});
  assert.deepEqual(b.selected, {...a.selected, block:1});
  assert.equal(a.blocks.length,3); assert.equal(b.blocks.length,2);
  assert.equal(a.guardedThreads,42); assert.equal(b.guardedThreads,106);
  assert.equal(a.blocks[2].valid,22); assert.equal(a.blocks[2].warps[0].valid,22);
  assert.equal(a.blocks[2].warps[1].valid,0);
});
test('every valid output occurs once and guarded threads never claim an output', async () => {
  const {describeLaunch} = await model();
  for (const items of [96,150,384]) for (const threads of [32,64,128]) {
    const launch = describeLaunch(items,threads,items-1);
    const lanes = launch.blocks.flatMap(block => block.warps.flatMap(warp => warp.lanes));
    assert.deepEqual(lanes.filter(lane=>lane.valid).map(lane=>lane.output),Array.from({length:items},(_,i)=>i));
    assert.equal(lanes.filter(lane=>!lane.valid).length,launch.guardedThreads);
    assert.ok(lanes.filter(lane=>!lane.valid).every(lane=>lane.output===null));
  }
});
test('selected matrix cell has a reproducible dot product', async () => {
  const {outputCalculation} = await model();
  assert.deepEqual(outputCalculation(137), {left:[1,14,2], right:[2,8,1], products:[2,112,2], value:116});
});
test('illustrative placement preserves a block on one SM and leaves unplaced blocks unassigned', async () => {
  const {describeLaunch, placementFor} = await model();
  const launch=describeLaunch(384,32,383);
  assert.equal(placementFor(launch,0).length,0);
  const placements=placementFor(launch,12);
  assert.equal(placements.length,12);
  assert.equal(new Set(placements.map(x=>x.block)).size,12);
  assert.deepEqual(placements.filter(x=>x.sm===3).map(x=>x.block),[3,7,11]);
  assert.deepEqual(placementFor(launch,4),placements.slice(0,4));
});
test('invalid launch parameters are rejected rather than silently creating false mappings',async()=>{
  const {describeLaunch}=await model();
  for(const args of [[0,64,0],[150,33,0],[150,64,150],[150,64,-1],[150.5,64,0]])assert.throws(()=>describeLaunch(...args),RangeError);
});
