import {sectorModel, toyLeft, toyRight, tileTraffic} from './model.js';
// Invented examples; animation duration is reading pace, never GPU elapsed time.
const step=(title,text)=>({title,text});
export const chapters=[{
 id:'coalescing', title:'1 · Group memory requests', lesson:'lesson-2.html#coalescing',
 steps:[
 step('One instruction, 32 lane requests','A warp groups 32 threads; a lane is one thread’s position in it. Each lane requests one distinct 4-byte value. A sector here covers 32 aligned bytes. We reveal groups for reading; these are not separate GPU instructions.'),
 step('Lanes 0–7 fit in one sector','Byte addresses 0, 4, …, 28 all lie inside bytes 0–31. Eight useful 4-byte values share one 32-byte sector.'),
 step('Lanes 8–15 share the next sector','Their addresses 32, 36, …, 60 occupy bytes 32–63. Earlier requests stay visible; two sectors now cover sixteen values.'),
 step('Lanes 16–23 add one sector','Addresses 64 through 92 fit inside bytes 64–95. A lane count and a sector count are different quantities.'),
 step('Lanes 24–31 complete the request','Addresses 96 through 124 fit inside bytes 96–127. The full warp touches four sectors, containing all 128 useful bytes.'),
 step('Count the boundary, not the threads','Four sectors × 32 bytes = 128 sector bytes for 128 useful bytes. This is a request footprint; caches and actual DRAM traffic are outside the model.'),
 step('Change only the stride','Comparison: stride 8 means neighboring lanes are 32 bytes apart. Each lane now touches a different sector. Same 128 useful bytes, but 32 × 32 = 1,024 sector bytes. This is not an 8× runtime prediction.'),
 step('Restore stride 1; shift the starting address','Comparison: contiguous values start at byte 4. The last value starts at 128, so a fifth sector is needed. Five touched sectors mean 160 sector bytes for the same 128 useful bytes.')
 ]
},{
 id:'tiling',title:'2 · Reuse a matrix tile',lesson:'lesson-3.html#tiling',
 steps:[
 step('Keep four outputs together','Use the lesson’s invented 4×4 input and weight matrices. Compute the top-left 2×2 output patch. Each output needs four products. A tile is a small matrix patch; registers hold each thread’s running sum, while shared memory holds operands the block will reuse.'),
 step('Load the first input tile','Cooperating threads stage input rows 0–1, inner positions 0–1 in block-local shared memory. Four input elements are loaded; no product has been accumulated yet.'),
 step('Load the first weight tile','Stage weight rows 0–1, columns 0–1. Four more elements are loaded. This view shows a logical loading phase, not instruction order or a mandatory hardware cache route.'),
 step('Meet the load barrier','All participating block threads reach the barrier. Both operand tiles are now available to their consumers. Reading before this point could use incomplete shared-memory data.'),
 step('Use inner position 0','Each loaded input value serves two output columns; each loaded weight value serves two output rows. Add four products to four per-thread register sums. Zero products are still mathematical products.'),
 step('Use inner position 1','Reuse the same staged tiles for the next four products. The four partial sums remain in registers; no new global operand loads are needed for this operation.'),
 step('Meet the reuse barrier','All consumers finish using these shared tiles before any thread overwrites them. A load barrier alone cannot protect a slower reader from the next iteration’s writes.'),
 step('Load the second input tile','Safe overwrite: replace the shared input tile with inner positions 2–3. Preserve all four register sums. The old weight tile is marked spent until its replacement is loaded.'),
 step('Load the second weight tile','Replace the shared weight tile with rows 2–3, columns 0–1. This patch has now requested sixteen operand elements across both iterations.'),
 step('Meet the next load barrier','Consumers wait until both replacement tiles are ready. A block barrier coordinates this block; it does not synchronize separate blocks.'),
 step('Use inner position 2','Reuse the replacement tiles for four more products. Only the running sums change; input and weight matrix values stay fixed.'),
 step('Use inner position 3','Add the final four products. Each output now includes all four inner positions. The sums match independent dot products exactly for these integer examples.'),
 step('Store the completed output patch','Write the four completed register sums to global output memory. No next tile is loaded in this patch, so there is no further overwrite to protect here. A store is not a claim of an immediate HBM write.'),
 step('Scale the accounting to all sixteen outputs','Four output patches repeat this teaching algorithm: 64 operand element loads + 16 stores = 320 bytes at 4 bytes/element. Independent dot products request 128 loads + 16 stores = 576 bytes. Both perform 128 FLOPs. Logical demands are not measured DRAM traffic or speedup; shared storage and barriers also cost resources.')
 ]
}];
export function sectorFrame(step) {
 const stride=step===6?8:1,offset=step===7?4:0;
 const count=step===0?0:step<4?step*8:32;
 const full=sectorModel(stride,offset);
 const lanes=full.addresses.slice(0,count).map((address,lane)=>({lane,address,sector:Math.floor(address/32)}));
 const sectors=[...new Set(lanes.map(lane=>lane.sector))];
 return {lanes,sectors,bytes:sectors.length*32,usefulBytes:count*4,stride,offset};
}
export function tileFrame(step) {
 const tile=step>=7?1:0;
 const count=step>=11?4:step>=10?3:step>=5?2:step>=4?1:0;
 const sums=Array.from({length:2},(_,row)=>Array.from({length:2},(_,col)=>Array.from({length:count},(_,inner)=>toyLeft[row][inner]*toyRight[inner][col]).reduce((a,b)=>a+b,0)));
 const inner=step===4?0:step===5?1:step===10?2:step===11?3:null;
 return {tile,sums,inner,leftLoaded:tile===0?step>=1:step>=7,rightLoaded:tile===0?step>=2:step>=8,ready:tile===0?step>=3:step>=9,safeToOverwrite:step>=6,stored:step>=12,loads:step===0?0:step===1?4:step<7?8:step===7?12:16,tiled:tileTraffic(4,4,4,2,4),naive:tileTraffic(4,4,4,1,4)};
}
