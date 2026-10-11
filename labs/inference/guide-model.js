export function generationFrame(step){
 const n=Math.max(0,Math.min(3,Math.floor(step)));
 const prompt=['Explain','KV','caching'],answer=['It','stores','information'];
 return {phase:n===0?'Ready':n===1?'Prefill':'Decode',consumed:n===0?[]:[...prompt,...answer.slice(0,n-1)],output:answer.slice(0,n),cached:n===0?0:prompt.length+n-1};
}
export function attentionWeights(scores){const max=Math.max(...scores);const e=scores.map(x=>Math.exp(x-max)),sum=e.reduce((a,b)=>a+b,0);return e.map(x=>x/sum);}
