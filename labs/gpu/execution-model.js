// A one-thread-per-output teaching mapping, not an optimized matrix kernel.
export function describeLaunch(items, threads, output) {
  if (!Number.isInteger(items) || items < 1 || items > 384 || ![32,64,128].includes(threads) || !Number.isInteger(output) || output < 0 || output >= items) throw new RangeError('Choose a valid output and a supported block size.');
  const blocks = Array.from({length:Math.ceil(items / threads)}, (_,block) => ({
    id:block, valid:Math.min(threads,items-block*threads),
    warps:Array.from({length:threads/32},(_,warp)=>{
      const lanes=Array.from({length:32},(_,lane)=>{
        const index=block*threads+warp*32+lane;
        return {lane,valid:index<items,output:index<items?index:null};
      });
      return {id:warp,valid:lanes.filter(lane=>lane.valid).length,lanes};
    })
  }));
  const localThread=output%threads;
  return {items,threads,blocks,guardedThreads:blocks.length*threads-items,selected:{output,row:Math.floor(output/10),column:output%10,block:Math.floor(output/threads),localThread,warp:Math.floor(localThread/32),lane:localThread%32}};
}
export function outputCalculation(output) {
  const left=[1,Math.floor(output/10)+1,2],right=[2,output%10+1,1];
  const products=left.map((value,index)=>value*right[index]);
  return {left,right,products,value:products.reduce((sum,value)=>sum+value,0)};
}
export function placementFor(launch, count) {
  return launch.blocks.slice(0,Math.max(0,Math.min(launch.blocks.length,count))).map(block=>({block:block.id,sm:block.id%4}));
}
