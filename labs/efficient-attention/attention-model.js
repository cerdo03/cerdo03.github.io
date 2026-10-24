// CPU teaching models. Byte counts are logical demands, never measured DRAM traffic.
const integer=(n)=>Number.isInteger(n)&&n>0;
export const emptySummary=width=>({m:-Infinity,l:0,u:Array(width).fill(0)});
export const normalized=s=>s.l?s.u.map(x=>x/s.l):s.u.map(()=>0);
function terms(summary,scores,values){
 if(scores.length!==values.length||values.some(v=>v.length!==summary.u.length)||scores.some(x=>!Number.isFinite(x)&&x!==-Infinity)||values.flat().some(x=>!Number.isFinite(x)))throw new Error('Finite scores/values and matching shapes required');
 const maximum=Math.max(summary.m,...scores);
 if(maximum===-Infinity)return {maximum,alpha:1,p:scores.map(()=>0)};
 return {maximum,alpha:summary.l?Math.exp(summary.m-maximum):0,p:scores.map(s=>s===-Infinity?0:Math.exp(s-maximum))};
}
export function mergeAttentionSummary(summary,scores,values){
 const {maximum,alpha,p}=terms(summary,scores,values);
 return {m:maximum,l:alpha*summary.l+p.reduce((n,x)=>n+x,0),u:summary.u.map((x,d)=>alpha*x+p.reduce((n,w,j)=>n+w*values[j][d],0))};
}
function validate(Q,K,V){
 if(!Q.length||!K.length||!V.length||K.length!==V.length||!Q[0].length||!V[0].length||Q.some(r=>r.length!==Q[0].length)||K.some(r=>r.length!==Q[0].length)||V.some(r=>r.length!==V[0].length)||[Q,K,V].flat(2).some(x=>!Number.isFinite(x)))throw new Error('Nonempty rectangular finite tensors with matching shapes required');
}
function scoreRow(q,K,row,{causal=false,prefix=0}={}){
 return K.map((k,j)=>causal&&j>prefix+row?-Infinity:q.reduce((n,x,d)=>n+x*k[d],0)/Math.sqrt(q.length));
}
export function denseAttention(Q,K,V,options={}){
 validate(Q,K,V);
 // Independent full-row reference; does not call the streaming merge.
 return Q.map((q,i)=>{const scores=scoreRow(q,K,i,options),m=Math.max(...scores);if(m===-Infinity)return V[0].map(()=>0);const p=scores.map(s=>Math.exp(s-m)),l=p.reduce((n,x)=>n+x,0);return V[0].map((_,d)=>p.reduce((n,x,j)=>n+x/l*V[j][d],0));});
}
export function streamedAttention(Q,K,V,{tile=2,...options}={}){
 validate(Q,K,V);if(!integer(tile))throw new Error('Positive integer tile required');
 return Q.map((q,i)=>{const scores=scoreRow(q,K,i,options);let s=emptySummary(V[0].length);for(let j=0;j<K.length;j+=tile)s=mergeAttentionSummary(s,scores.slice(j,j+tile),V.slice(j,j+tile));return normalized(s);});
}
export function groupedAttention(queries,keys,values,options={}){
 if(!keys.length||keys.length!==values.length||queries.length%keys.length)throw new Error('Query heads must divide into equal KV groups');
 const group=queries.length/keys.length;return queries.map((q,h)=>streamedAttention(q,keys[Math.floor(h/group)],values[Math.floor(h/group)],options));
}
export function onlineTrace(scores,values,tile=2){
 if(!integer(tile))throw new Error('Positive integer tile required');
 let s=emptySummary(values[0].length),frames=[];
 const add=(op,extra={})=>frames.push({id:`${frames.length}-${op}`,op,start:0,end:0,summary:structuredClone(s),...extra});
 add('inputs');
 for(let start=0;start<scores.length;start+=tile){
  const end=Math.min(start+tile,scores.length),z=scores.slice(start,end),v=values.slice(start,end),t=terms(s,z,v),extra={start,end,scores:z,values:v,alpha:t.alpha,p:t.p};
  const needsRescale=s.l>0&&t.alpha!==1;add('scores',extra);s={...s,m:t.maximum};add('maximum',extra);
  s={...s,l:s.l*t.alpha};if(needsRescale)add('rescale-denominator',extra);
  s={...s,u:s.u.map(x=>x*t.alpha)};if(needsRescale)add('rescale-numerator',extra);
  s={...s,l:s.l+t.p.reduce((n,x)=>n+x,0)};add('add-denominator',extra);
  s={...s,u:s.u.map((x,d)=>x+t.p.reduce((n,w,j)=>n+w*v[j][d],0))};add('add-numerator',extra);
 }
 add('normalize',{output:normalized(s),start:0,end:scores.length});return frames;
}
export function materializedTraffic(tq,tk,dk,dv,bytes=2){
 if(![tq,tk,dk,dv,bytes].every(integer))throw new Error('Positive dimensions required');
 const intermediateBytes=2*tq*tk*bytes,intermediateTraffic=2*intermediateBytes,ioBytes=(tq*dk+tk*dk+tk*dv+tq*dv)*bytes;
 return {intermediateBytes,intermediateTraffic,ioBytes,totalBytes:intermediateTraffic+ioBytes};
}
export function tiledTraffic({tq,tk,dk,dv,br,bc,bytes=2,causal=false,prefix=0}){
 if(![tq,tk,dk,dv,br,bc,bytes].every(integer)||prefix<0)throw new Error('Positive dimensions and nonnegative prefix required');
 const events=[];let qRead=0,kvRead=0,outputWrite=0,visitedTiles=0,allowedPairs=0,peakWorkspace=0;
 for(let r=0;r<tq;r+=br){
  const rows=Math.min(br,tq-r),qBytes=rows*dk*bytes;events.push({type:'load-q',row:r,bytes:qBytes});qRead+=qBytes;
  for(let c=0;c<tk;c+=bc){
   if(causal&&c>prefix+r+rows-1)continue;
   const cols=Math.min(bc,tk-c),k=cols*dk*bytes,v=cols*dv*bytes;
   events.push({type:'load-k',row:r,col:c,bytes:k},{type:'load-v',row:r,col:c,bytes:v});kvRead+=k+v;visitedTiles++;
   for(let i=r;i<r+rows;i++)for(let j=c;j<c+cols;j++)if(!causal||j<=prefix+i)allowedPairs++;
   // Q/K/V use storage precision; scores, numerator and m/l use float32.
   peakWorkspace=Math.max(peakWorkspace,(rows*dk+cols*(dk+dv))*bytes+4*(rows*cols+rows*dv+2*rows));
  }
  const out=rows*dv*bytes;events.push({type:'store-o',row:r,bytes:out});outputWrite+=out;
 }
 return {qRead,kvRead,outputWrite,visitedTiles,allowedPairs,peakWorkspace,events,totalBytes:qRead+kvRead+outputWrite};
}
