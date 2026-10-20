import test from 'node:test';
import assert from 'node:assert/strict';
let model;
try { model = await import('../labs/gpu/model.js'); } catch { /* First run: feature absent. */ }
const ready = () => assert.ok(model, 'GPU analytical model must exist');
test('launch tail masks excess lanes and occupancy respects limiting resources', () => {
  ready();
  const launch = model.launchModel(1000, 128, 64, 32);
  assert.equal(launch.blocks, 8);
  assert.equal(launch.tailLanes, 8);
  assert.equal(model.launchModel(128,256,32,8).tailLanes,0);
  assert.equal(launch.residentBlocks, 2);
  assert.equal(launch.occupancy, 0.125);
  assert.equal(model.launchModel(1000,128,64,8).residentBlocks,8);
});
test('warp sector accounting includes stride and misalignment', () => {
  ready();
  assert.equal(model.sectorModel(1,0).sectors.length,4);
  assert.equal(model.sectorModel(1,4).sectors.length,5);
  assert.equal(model.sectorModel(8,0).sectors.length,32);
  assert.equal(model.sectorModel(32,0).bytes,1024);
});
test('tiling reduces logical operand loads but preserves exact products and total output', () => {
  ready();
  assert.deepEqual(model.multiply([[1,2],[3,4]],[[5,6],[7,8]]),[[19,22],[43,50]]);
  const one = model.tileTraffic(4,4,4,1,4), two = model.tileTraffic(4,4,4,2,4);
  assert.equal(one.flops,128);
  assert.equal(one.bytes,576);
  assert.equal(two.bytes,320);
  assert.equal(model.tileTraffic(4,4,4,4,4).bytes,192);
  assert.equal(two.sharedBytes,32);
  // Edge tiles count only valid elements; tile size need not divide dimensions.
  assert.equal(model.tileTraffic(3,5,7,2,4).bytes,592);
});
test('roofline units and independent resource improvements', () => {
  ready();
  const low = model.roofline(1e12,1e12,100,1);
  assert.equal(low.intensity,1);
  assert.equal(low.ridge,100);
  assert.equal(low.timeMs,1000);
  assert.equal(low.bound,'bandwidth');
  assert.equal(model.roofline(1e12,1e12,200,1).timeMs,1000);
  assert.equal(model.roofline(1e12,1e12,100,2).timeMs,500);
  assert.equal(model.roofline(1e12,1e9,100,1).timeMs,10);
});
test('projection row reuse changes bottleneck; KV traffic grows with context and batch', () => {
  ready();
  const small = model.projection(1,4096,4096,2), large = model.projection(512,4096,4096,2);
  assert.equal(small.flops,33554432);
  assert.equal(small.bytes,33570816);
  assert.equal(model.roofline(small.flops,small.bytes,100,1).bound,'bandwidth');
  assert.equal(model.roofline(large.flops,large.bytes,100,1).bound,'compute');
  const a=model.decodeAttention(1,4096,32,8,128,2);
  const b=model.decodeAttention(4,8192,32,8,128,2);
  assert.equal(a.kvBytes,16777216);
  assert.equal(a.flops,67108864);
  assert.equal(b.kvBytes,8*a.kvBytes);
  assert.equal(model.decodeAttention(1,4096,32,32,128,2).kvBytes,4*a.kvBytes);
});
test('tile traffic agrees with explicit valid-element enumeration for edge tiles', () => {
  ready();
  for (const rows of [1,3,4]) for (const columns of [1,5]) for (const reduction of [1,7]) for (const tile of [1,2,4]) {
    let loads=0;
    for(let row=0;row<rows;row+=tile)for(let col=0;col<columns;col+=tile)for(let p=0;p<reduction;p+=tile){
      for(let i=row;i<Math.min(row+tile,rows);i++)for(let q=p;q<Math.min(p+tile,reduction);q++)loads++;
      for(let q=p;q<Math.min(p+tile,reduction);q++)for(let j=col;j<Math.min(col+tile,columns);j++)loads++;
    }
    assert.equal(model.tileTraffic(rows,columns,reduction,tile,4).bytes,4*(loads+rows*columns));
  }
});
test('GPU-only notation cannot change symbol meanings in older modules', async () => {
  const {symbolKey}=await import('../labs/attention/glossary.js');
  assert.equal(symbolKey({textContent:'W',nextSibling:null,closest:()=>null}),null);
  assert.equal(symbolKey({textContent:'W',nextSibling:null,closest:()=>({})}),'W');
});
