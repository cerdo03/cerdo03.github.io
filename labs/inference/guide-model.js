export function generationFrame(step){
 const n=Math.max(0,Math.min(3,Math.floor(step)));
 const prompt=promptTokens,answer=answerTokens;
 return {phase:n===0?'Ready':n===1?'Prefill':'Decode',consumed:n===0?[]:[...prompt,...answer.slice(0,n-1)],output:answer.slice(0,n),cached:n===0?0:prompt.length+n-1};
}
export function attentionWeights(scores){const max=Math.max(...scores);const e=scores.map(x=>Math.exp(x-max)),sum=e.reduce((a,b)=>a+b,0);return e.map(x=>x/sum);}

export const promptTokens=['The','sky','is'];
export const answerTokens=['blue','today','.'];
export const representations=[[2,0],[0,1],[1,2]];
export function attentionState(position=2,first=representations[position][0]){
 const rows=representations.map(x=>[...x]);rows[position][0]=first;
 const keys=rows.map(([a,b])=>[b,a]),values=rows.map(([a,b])=>[2*a,b]);
 const q=[...rows[position]];
 const scores=keys.map((k,i)=>i<=position?(q[0]*k[0]+q[1]*k[1])/Math.sqrt(2):-Infinity);
 const weights=attentionWeights(scores);
 const output=[0,1].map(d=>values.reduce((sum,v,i)=>sum+weights[i]*v[d],0));
 return {rows,x:rows[position],q,keys,values,scores,weights,output};
}
export function traceState(event=0){
 const e=Math.max(0,Math.min(8,event)),pass=Math.floor(e/3),stage=e%3;
 const before=[...promptTokens,...answerTokens.slice(0,Math.max(0,pass-1))];
 return {event:e,pass,stage,phase:pass===0?'Prefill':`Decode ${pass}`,input:pass===0?promptTokens:[answerTokens[pass-1]],cache:stage===0?(pass===0?[]:before):[...promptTokens,...answerTokens.slice(0,pass)],answer:answerTokens.slice(0,pass+(stage===2?1:0)),next:answerTokens[pass],history:[...promptTokens,...answerTokens.slice(0,pass)]};
}
export function prefixState(changed=false,block=1){
 const a=promptTokens,b=[changed?'Our':'The','sky','looks'];
 let match=0;while(match<a.length&&a[match]===b[match])match++;
 const reused=Math.floor(match/block)*block;
 return {a,b,match,reused};
}

export const toyPrediction={tokens:['blue','gray','clear'],probabilities:[.6,.25,.15]};
toyPrediction.logits=toyPrediction.probabilities.map(p=>Math.log(p));
