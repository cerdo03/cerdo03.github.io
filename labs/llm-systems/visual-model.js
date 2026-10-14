import { attentionState, attentionWeights, promptTokens, answerTokens, representations } from '../inference/guide-model.js';
import { toyProjections } from '../attention/kv-sim.js';
export function projectionTrace(x, matrix, column) {
 const terms=x.map((value,i)=>value*matrix[i][column]);
 return {terms,total:terms.reduce((a,b)=>a+b,0)};
}
export function valueTrace(values, weights, component) {
 const terms=values.map((row,i)=>row[component]*weights[i]);
 return {terms,total:terms.reduce((a,b)=>a+b,0)};
}
export function requestFrame(pass=0,stage=0,rows=representations,prompt=promptTokens,answer=answerTokens) {
 const oldTokens=pass===0?[]:[...prompt,...answer.slice(0,pass-1)];
 const input=pass===0?prompt:[answer[pass-1]];
 const make=(token,position)=>({token,position,...toyProjections(token,position,rows)});
 const old=oldTokens.map(make),newRows=input.map((token,i)=>make(token,old.length+i));
 const all=[...old,...newRows];
 const queries=newRows.map(row=>{
  const allowed=all.slice(0,row.position+1),scores=allowed.map(k=>row.q.reduce((sum,x,i)=>sum+x*k.k[i],0)/Math.sqrt(2));
  const weights=attentionWeights(scores),output=[0,1].map(d=>valueTrace(allowed.map(k=>k.v),weights,d).total);
  return {...row,keys:allowed,scores,weights,output};
 });
 return {pass,stage,input,old,newRows,queries,cache:stage>=4?all:old,chosen:stage>=5?answer[pass]:null,next:answer[pass],answer:answer.slice(0,pass+(stage>=5?1:0))};
}
export function sharingState(kvHeads=2,rows=representations) {
 if(![1,2,4].includes(kvHeads))throw new RangeError('Choose 1, 2 or 4 KV heads.');
 const caches=Array.from({length:kvHeads},(_,g)=>({group:g,keys:rows.map(([a,b])=>[b*(g+1),a]),values:rows.map(([a,b])=>[2*a,b*(g+1)])}));
 const x=rows[2];
 const heads=Array.from({length:4},(_,h)=>{
  const group=Math.floor(h/(4/kvHeads)),cache=caches[group],q=[x[0],x[1]*(h+1)];
  const scores=cache.keys.map(k=>(q[0]*k[0]+q[1]*k[1])/Math.sqrt(2)),weights=attentionWeights(scores);
  return {head:h,group,cache,q,weights,output:[0,1].map(d=>valueTrace(cache.values,weights,d).total)};
 });
 return {x,caches,heads};
}
export function predictionState(rows=representations) {
 let incoming=rows.map(row=>[...row]);const layers=[];
 for(let layer=0;layer<2;layer++){
  const attention=incoming.map((_,i)=>attentionState(i,undefined,incoming).output);
  const residual=incoming.map((x,i)=>x.map((value,d)=>value+attention[i][d]));
  // Tiny linear feed-forward branch: 0.1 × u, followed by its residual.
  const outgoing=residual.map(u=>u.map(value=>value+value*.1));
  layers.push({incoming,attention,residual,outgoing});incoming=outgoing;
 }
 const final=incoming[2],vocabulary=[[.2,-.15,.1],[-.1,.2,.05]],tokens=['blue','gray','clear'];
 const logits=tokens.map((_,j)=>projectionTrace(final,vocabulary,j).total),probabilities=attentionWeights(logits);
 return {layers,final,vocabulary,tokens,logits,probabilities,greedy:tokens[logits.indexOf(Math.max(...logits))]};
}
export function dependencyState(change=2) {
 const a=['The','sky','is','blue'],b=[...a],alternates=['Our','sea','looks','gray'];
 if(change===-1)b.push('today');else b[change]=alternates[change];
 let match=0;while(match<a.length&&a[match]===b[match])match++;
 return {a,b,match,reused:b.map((_,i)=>i<match),change};
}
// The reference separates input, Q and K/V; the main diagram groups projections.
export function decodeReferenceStage(stage){return [0,2,3,4,5,6][stage];}
