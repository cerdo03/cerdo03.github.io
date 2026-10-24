// Invented numerical fixtures; not learned vectors or replacements for Module 2 embeddings.
export const values=[[1,0],[0,1],[1,1],[2,0]];
export function attentionFixture(falling=false){const scores=falling?[4,3,2,1]:[1,2,3,4];return {scores,values:structuredClone(values),Q:[[1,0]],K:scores.map(s=>[s*Math.sqrt(2),0])};}
export const kvRow=(i,branch='p')=>{const component=branch==='a'?2:branch==='b'?-1:1;return {token:`${branch}${i}`,key:[i+1,component],value:[component,i+1]};};
