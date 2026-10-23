import test from 'node:test';
import assert from 'node:assert/strict';
import { sectorFrame, tileFrame, chapters } from '../labs/gpu/motion-model.js';
import { multiply, toyLeft, toyRight } from '../labs/gpu/model.js';
test('sector reveal groups lane requests into unique sectors, without counting lanes as transactions', () => {
  assert.equal(sectorFrame(0).lanes.length, 0);
  for (let step=1;step<=4;step++) {
    const frame=sectorFrame(step);
    assert.equal(frame.lanes.length,step*8);
    assert.equal(frame.sectors.length,step);
    assert.equal(frame.bytes,step*32);
  }
  assert.equal(sectorFrame(5).bytes,128);
  assert.equal(sectorFrame(6).bytes,1024);
  assert.equal(sectorFrame(7).bytes,160);
  assert.equal(sectorFrame(6).usefulBytes,128);
});
test('tile cannot contribute before both loads and barrier; overwrite waits for reuse barrier', () => {
  assert.equal(tileFrame(1).leftLoaded,true);
  assert.equal(tileFrame(1).rightLoaded,false);
  assert.equal(tileFrame(2).ready,false);
  assert.equal(tileFrame(3).ready,true);
  assert.deepEqual(tileFrame(3).sums,[[0,0],[0,0]]);
  assert.deepEqual(tileFrame(4).sums,[[1,0],[0,0]]);
  assert.deepEqual(tileFrame(5).sums,[[1,2],[0,1]]);
  assert.equal(tileFrame(6).safeToOverwrite,true);
  assert.equal(tileFrame(7).tile,1);
  assert.equal(tileFrame(8).ready,false);
  assert.equal(tileFrame(9).ready,true);
});
test('two reduction tiles preserve exact output; stores reveal only after reduction', () => {
  const expected=multiply(toyLeft,toyRight).slice(0,2).map(row=>row.slice(0,2));
  assert.deepEqual(tileFrame(11).sums,expected);
  assert.equal(tileFrame(11).stored,false);
  assert.equal(tileFrame(12).stored,true);
  assert.equal(tileFrame(13).tiled.bytes,320);
  assert.equal(tileFrame(13).naive.bytes,576);
  for(let s=0;s<chapters[1].steps.length;s++) assert.deepEqual(tileFrame(s),tileFrame(s));
});
