// Immutable fixed-block allocator. Immediate reclamation, no prefix-cache retention policy.
const clone=p=>structuredClone(p);
const requireSequence=(p,id)=>{if(!p.sequences[id])throw new Error('Unknown sequence');return p.sequences[id];};
export function createPool(count=8,size=4){
 if(!Number.isInteger(count)||count<1||!Number.isInteger(size)||size<1)throw new Error('Positive pool and block sizes required');
 return {size,blocks:Array.from({length:count},(_,id)=>({id,refs:0,rows:[]})),sequences:{},events:[]};
}
function reserve(p){const b=p.blocks.find(b=>b.refs===0);if(!b)throw new Error('KV pool exhausted');b.rows=[];b.refs=1;return b;}
function append(p,id,row){
 const s=requireSequence(p,id);if(!row||!Array.isArray(row.key)||!Array.isArray(row.value)||[...row.key,...row.value].some(x=>!Number.isFinite(x)))throw new Error('Finite K/V row required');
 let b=p.blocks[s.blocks.at(-1)];
 if(!b||s.length%p.size===0){b=reserve(p);s.blocks.push(b.id);p.events.push({type:'allocate',id,block:b.id});}
 else if(b.refs>1){
  const source=b,dest=reserve(p);dest.rows=clone(source.rows);source.refs--;s.blocks[s.blocks.length-1]=dest.id;
  p.events.push({type:'allocate',id,block:dest.id},{type:'copy',id,from:source.id,block:dest.id,rows:source.rows.length},{type:'remap',id,from:source.id,block:dest.id});b=dest;
 }
 b.rows.push(clone(row));s.length++;p.events.push({type:'append',id,block:b.id,offset:b.rows.length-1});
}
export function createSequence(pool,id,rows=[]){
 if(!/^[A-Za-z][A-Za-z0-9]*$/.test(id)||pool.sequences[id])throw new Error('Unique sequence ID required');
 const p=clone(pool);p.events=[];p.sequences[id]={length:0,blocks:[]};rows.forEach(row=>append(p,id,row));assertPool(p);return p;
}
export function appendKV(pool,id,row){const p=clone(pool);p.events=[];append(p,id,row);assertPool(p);return p;}
export function forkSequence(pool,from,id){
 if(!/^[A-Za-z][A-Za-z0-9]*$/.test(id)||pool.sequences[id])throw new Error('Unique sequence ID required');
 const p=clone(pool),s=requireSequence(p,from);p.events=[{type:'fork',id,from}];p.sequences[id]=clone(s);s.blocks.forEach(b=>p.blocks[b].refs++);assertPool(p);return p;
}
export function releaseSequence(pool,id){
 const p=clone(pool),s=requireSequence(p,id);p.events=[{type:'release',id}];s.blocks.forEach(b=>{if(--p.blocks[b].refs===0)p.blocks[b].rows=[];});delete p.sequences[id];assertPool(p);return p;
}
export function resolveKVPosition(p,id,t){const s=requireSequence(p,id);if(!Number.isInteger(t)||t<0||t>=s.length)throw new Error('Position outside processed cache');const logical=Math.floor(t/p.size),offset=t%p.size,physical=s.blocks[logical];return {logical,offset,physical,row:clone(p.blocks[physical].rows[offset])};}
export function gatherKV(p,id){const s=requireSequence(p,id);return Array.from({length:s.length},(_,t)=>resolveKVPosition(p,id,t).row);}
export function assertPool(p){
 const counts=p.blocks.map(()=>0);
 for(const s of Object.values(p.sequences)){if(s.blocks.length!==Math.ceil(s.length/p.size)||new Set(s.blocks).size!==s.blocks.length)throw new Error('Invalid logical table');s.blocks.forEach((id,i)=>{if(!p.blocks[id])throw new Error('Invalid physical ID');counts[id]++;if(p.blocks[id].rows.length!==Math.min(p.size,s.length-i*p.size))throw new Error('Invalid valid length');});}
 p.blocks.forEach((b,i)=>{if(b.refs!==counts[i]||b.rows.length>p.size||(!b.refs&&b.rows.length))throw new Error('Invalid block ownership');});return true;
}
export function poolSummary(p){const used=p.blocks.filter(b=>b.refs);const logicalTokens=Object.values(p.sequences).reduce((n,s)=>n+s.length,0),storedTokens=used.reduce((n,b)=>n+b.rows.length,0);return {logicalTokens,storedTokens,physicalBlocks:used.length,allocatedSlots:used.length*p.size,slackSlots:used.length*p.size-storedTokens,freeBlocks:p.blocks.length-used.length,tableEntries:Object.values(p.sequences).reduce((n,s)=>n+s.blocks.length,0)};}
export function kvBytesPerToken(layers,heads,width,bytes){if(![layers,heads,width,bytes].every(x=>Number.isInteger(x)&&x>0))throw new Error('Positive dimensions required');return 2*layers*heads*width*bytes;}
export function capacity(lengths,size,q){if(!Number.isInteger(size)||size<1||lengths.some(x=>!Number.isInteger(x)||x<0))throw new Error('Nonnegative lengths and positive block size required');const tokens=lengths.reduce((n,x)=>n+x,0),blocks=lengths.reduce((n,x)=>n+Math.ceil(x/size),0);return {tokens,blocks,rawBytes:tokens*q,allocatedBytes:blocks*size*q,slackBytes:(blocks*size-tokens)*q};}
