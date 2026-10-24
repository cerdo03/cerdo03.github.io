import {onlineTrace,tiledTraffic} from './attention-model.js';
import {attentionFixture,kvRow} from './fixtures.js';
import {createPool,createSequence,forkSequence,appendKV,releaseSequence} from './kv-model.js';
export function onlineFrames(tile=2,falling=false){const f=attentionFixture(falling);return onlineTrace(f.scores,f.values,tile).map(frame=>({...frame,fixture:f}));}
export function tileFrames(){
 const online=onlineFrames(),frames=[];let bytes=0,lastOnline=online[0];
 const add=(op,extra={})=>{if(extra.online)lastOnline=extra.online;frames.push({op,bytes,online:lastOnline,...extra});}
 add('inputs');bytes+=4;add('load-q');add('initialize');
 for(let tile=0;tile<2;tile++){
  bytes+=8;add('load-k',{tile});bytes+=8;add('load-v',{tile});
  for(const f of online.filter(f=>f.start===tile*2&&!['inputs','normalize'].includes(f.op)))add(f.op,{tile,online:f});
  add('release',{tile});
 }
 add('normalize',{online:online.at(-1),output:online.at(-1).output});bytes+=4;add('store',{output:online.at(-1).output});
 const ledger=tiledTraffic({tq:1,tk:4,dk:2,dv:2,br:1,bc:2,bytes:2});if(bytes!==ledger.totalBytes)throw new Error('Tile trace/ledger mismatch');return frames;
}
export function cowFrames(){
 const initial=createSequence(createPool(8,4),'A',Array.from({length:6},(_,i)=>kvRow(i))),shared=forkSequence(initial,'A','B'),written=appendKV(shared,'A',kvRow(6,'a'));
 const copy=written.events.find(e=>e.type==='copy'),pending=copy.block,from=copy.from;
 // Transitional visual states reserve/copy before remap; allocator commits transactionally.
 const reserved=structuredClone(shared),copied=structuredClone(shared),remapped=structuredClone(written);
 copied.blocks[pending].rows=structuredClone(shared.blocks[from].rows);
 remapped.sequences.A.length--;remapped.blocks[pending].rows.pop();
 const both=appendKV(written,'B',kvRow(6,'b'));
 return [{op:'inputs',pool:initial},{op:'fork',pool:shared},{op:'detect',pool:shared,from},{op:'reserve',pool:reserved,pending,from},{op:'copy',pool:copied,pending,from},{op:'remap',pool:remapped,pending,from},{op:'append-a',pool:written,pending,from},{op:'append-b',pool:both,from},{op:'release-a',pool:releaseSequence(both,'A')}].map((f,i)=>{const rowBytes=row=>(row.key.length+row.value.length)*2,copyBytes=shared.blocks[from].rows.reduce((n,row)=>n+rowBytes(row),0);return {...f,id:`cow-${i}`,io:{read:i>=4?copyBytes:0,write:(i>=4?copyBytes:0)+(i>=6?rowBytes(kvRow(6,'a')):0)+(i>=7?rowBytes(kvRow(6,'b')):0)}};});
}
export const operationText={
 inputs:['Known inputs','Inspect the inputs before revealing any future result.'],
 scores:['Compute the scaled scores','Multiply the selected Q row with this K tile, divide by √2. Scores belong to the current two key positions.'],
 maximum:['Update the running maximum','m′ = max(old m, tile maximum). Later larger scores change the scale used for all contributions.'],
 'rescale-denominator':['Rescale earlier denominator','Multiply the previous ℓ by α = exp(old m − new m). Empty summary uses α = 0.'],
 'rescale-numerator':['Rescale earlier weighted values','Multiply every component of u by the same α. Correcting only the denominator would change the answer.'],
 'add-denominator':['Add this tile’s denominator','Compute p = exp(score − new m); add Σp to ℓ. These p values are not independently normalized tile probabilities.'],
 'add-numerator':['Add this tile’s weighted values','Add Σ p × V to u, component by component. Earlier contributions remain in the running sum.'],
 normalize:['Normalize the completed row','Divide u by ℓ after all valid keys have contributed. This equals the dense reference within floating-point tolerance.'],
 'load-q':['Stage the query','Read Q [1, 0] into the active working set: 2 elements × 2 bytes = 4 logical input bytes.'],
 initialize:['Initialize row accumulators','m = −∞, ℓ = 0, u = [0, 0]. Accumulators use float32 in the resource model.'],
 'load-k':['Load the next key tile','Read two 2-component keys: 8 logical bytes. Earlier K scratch may be reused only after its contribution is consumed.'],
 'load-v':['Load the matching value tile','Read two 2-component values: another 8 bytes. Both operands now available to compute this contribution.'],
 release:['Reuse temporary tile storage','This tile has contributed to m, ℓ and u. Release its K/V and score scratch; retain the query and running summary.'],
 store:['Store the completed output','Write 2 output components × 2 bytes = 4 logical bytes. Total 40 bytes in this one-query teaching schedule; no full score/probability matrix stored.'],
 fork:['Share the processed prefix','B receives A’s two logical mappings. Both physical block reference counts become 2. No K/V payload copied.'],
 detect:['Inspect the shared partial tail','Position 6 belongs to logical block 1, offset 2. Its physical block has two owners: writing here directly would change B’s history.'],
 reserve:['Reserve a private destination','Reserve one free physical block for A. Source still shared and unchanged. Reservation is not yet a new logical mapping.'],
 copy:['Copy the valid tail rows','Copy the two valid K/V rows into the reserved destination. Two unused slots carry no valid data. This model copies valid rows; engines may copy whole blocks.'],
 remap:['Give A a private tail','A’s last table entry now points to the destination. Source reference count drops to 1; B retains its original mapping and rows.'],
 'append-a':['Process A’s next token','Store new K/V at offset 2 in A’s private tail. A now has 7 processed positions; B still has 6. Sample selection alone does not create K/V.'],
 'append-b':['Process B’s different continuation','Source tail now exclusive to B, so append without another copy. A and B have different new rows while their first block stays shared.'],
 'release-a':['Release A’s references','Free A’s private tail. Shared first block remains for B with reference count 1. This model immediately reclaims zero-reference blocks; prefix-cache retention is separate policy.']
};
