export function kvBytes(tokens,layers,heads,dim,bytes,batch=1){return 2*tokens*layers*heads*dim*bytes*batch;}
export function reusablePrefix(a,b,block=1){let n=0;while(n<Math.min(a.length,b.length)&&a[n]===b[n])n++;return Math.floor(n/block)*block;}
// Educational model, not a hardware prediction. Prefix reuse retains logical context.
export function estimate(prompt,output,reused,heads,batch=1,bytes=2){
 const r=Math.min(reused,prompt-1),s=prompt-r;
 const prefillMs=5+s*.06+(prompt*prompt-r*r)*.000012;
 const decodeMs=Array.from({length:output-1},(_,i)=>8+(prompt+i+1)*heads*.00025).reduce((a,b)=>a+b,0);
 return {prefillMs,decodeMs,cacheBytes:kvBytes(prompt+output-1,32,heads,128,bytes,batch)};
}
