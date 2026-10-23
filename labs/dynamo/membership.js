// Teaching arbitration: latest issue time wins; simultaneous conflicting actions
// require an explicit tie rule not specified by the paper. This toy uses leave.
export function reconcileHistory(left,right) {
 const entries=new Map();
 for(const event of [...left,...right]){
  const prior=entries.get(event.node);
  if(!prior || event.time>prior.time || (event.time===prior.time && event.action==='leave'))entries.set(event.node,{...event});
 }
 return [...entries.values()].sort((a,b)=>a.node.localeCompare(b.node));
}
export function transferRange(state,range,donor,confirmed) {
 if(state.received.includes(range))return false;
 if(!confirmed){if(!state.pending.some(item=>item.range===range))state.pending.push({range,donor});return false;}
 state.received.push(range);state.pending=state.pending.filter(item=>item.range!==range);return true;
}
