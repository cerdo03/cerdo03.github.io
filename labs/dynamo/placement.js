import { preferenceList } from './model.js?v=dynamo20261023-final';
export function strategyPlacement(strategy, key, tokens, partitions) {
  const width = 100 / partitions;
  const boundary = strategy === 1
    ? [...tokens].sort((a,b) => a.position-b.position).find(token => token.position >= key)?.position ?? tokens[0].position
    : Math.ceil(key / width) * width;
  return { boundary, replicas: preferenceList(tokens, boundary % 100) };
}
export function efficiency(loads) {
  const maximum = Math.max(...loads);
  return maximum === 0 ? 1 : loads.reduce((a,b) => a+b,0) / loads.length / maximum;
}

// Deterministic round-robin is a teaching assignment, not Amazon's unpublished algorithm.
export function balancedTokens(nodes, partitions) {
  if(partitions % nodes.length) throw new RangeError('Choose a partition count divisible by host count');
  return Array.from({length:partitions},(_,index)=>({position:(index+1)*100/partitions%100,node:nodes[index%nodes.length]}))
    .sort((a,b)=>a.position-b.position);
}
export function requestLoads(strategy, keys, tokens, partitions) {
  const counts=Object.fromEntries([...new Set(tokens.map(token=>token.node))].map(node=>[node,0]));
  for(const key of keys)counts[strategyPlacement(strategy,key,tokens,partitions).replicas[0]]++;
  return counts;
}
