import {seededRandom} from './timeline.js?v=dynamo20261023-final';
import {balancedTokens,strategyPlacement,requestLoads,efficiency} from './placement.js?v=dynamo20261023-final';
function tokensFor(strategy,nodes){
 if(strategy===3)return balancedTokens(nodes,12);
 return nodes.flatMap(node=>{const random=seededRandom(node.charCodeAt(0)*42);return Array.from({length:2},()=>({node,position:random()*100}));}).sort((a,b)=>a.position-b.position);
}
function intervals(tokens){return tokens.map((token,index)=>`${tokens[(index+tokens.length-1)%tokens.length].position},${token.position}`);}
export function evolution(strategy,operation,hot){
 const before=tokensFor(strategy,['A','B','C']);
 const after=tokensFor(strategy,operation==='join'?['A','B','C','X']:['A','B']);
 const movedKeys=[],replicaChanges=[];
 for(let key=0;key<100;key++){
  const prior=strategyPlacement(strategy,key,before,12).replicas.slice(0,3);
  const next=strategyPlacement(strategy,key,after,12).replicas.slice(0,3);
  if(prior[0]!==next[0])movedKeys.push({key,from:prior[0],to:next[0]});
  if([...prior].sort().join()!==[...next].sort().join())replicaChanges.push({key,from:prior,to:next});
 }
 const oldRanges=intervals(before),newRanges=new Set(intervals(after));
 const invalidatedRanges=strategy===1?oldRanges.filter(range=>!newRanges.has(range)).length:0;
 const keys=hot?Array(100).fill(15):Array.from({length:100},(_,key)=>key);
 const beforeLoad=requestLoads(strategy,keys,before,12),afterLoad=requestLoads(strategy,keys,after,12);
 return {strategy,operation,seed:42,movedKeys,replicaChanges,invalidatedRanges,
  beforeLoad,afterLoad,beforeEfficiency:efficiency(Object.values(beforeLoad)),afterEfficiency:efficiency(Object.values(afterLoad)),
  beforeTokens:before.length,afterTokens:after.length,
  fixedFilesAffected:strategy===1?null:new Set(replicaChanges.map(item=>Math.ceil(item.key/(100/12))%12)).size,
  underReplicated:operation==='remove'};
}
