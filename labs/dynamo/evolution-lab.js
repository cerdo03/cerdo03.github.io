import {evolution} from './evolution.js?v=dynamo20261023-final';
export function evolutionLab(){
 const root=document.createElement('section');const title=document.createElement('h2');title.textContent='Compare actual key movement with one fixed workload';
 const explanation=document.createElement('p');explanation.textContent='Synthetic 100-key dataset; seed 42; twelve fixed partitions where applicable. Strategies 1/2 use two deterministic random tokens per host. Strategy 3 evenly assigns fixed tokens using a toy round-robin allocator. Metadata counts are logical entries, not bytes or the paper’s equal-budget benchmark. This small Q is for inspection, not the paper’s large-Q tuning recommendation.';
 const controls=document.createElement('div');controls.className='controls';const output=document.createElement('div');
 let strategy=1,operation='join',hot=false;
 const button=(label,action)=>{const control=document.createElement('button');control.type='button';control.textContent=label;control.addEventListener('click',action);controls.append(control);};
 function show(){
  const result=evolution(strategy,operation,hot);output.replaceChildren();
  for(const text of [
   `Strategy ${strategy}: ${operation==='join'?'X joins A/B/C':'C leaves A/B/C'}. ${result.underReplicated?'Only two physical hosts remain; a three-copy target cannot be met.':'Four distinct hosts available.'}`,
   `Primary ownership moved for ${result.movedKeys.length}/100 keys; replica sets changed for ${result.replicaChanges.length}/100 keys.`,
   `Old variable range-tree boundaries invalidated: ${result.invalidatedRanges}. Fixed partition files with changed replica ownership: ${result.fixedFilesAffected??'not applicable to variable ranges'}.`,
   `Logical placement metadata entries before/after: ${result.beforeTokens}/${result.afterTokens}. Compactness is not a byte-exact production measurement.`,
   `Same request trace ${hot?'repeats key 15 one hundred times':'accesses every integer key once'}. Primary counts before ${JSON.stringify(result.beforeLoad)} → after ${JSON.stringify(result.afterLoad)}.`,
   `Mean/maximum efficiency: ${result.beforeEfficiency.toFixed(3)} → ${result.afterEfficiency.toFixed(3)}. Counts model primary coordination only.`,
   'A changed map identifies transfers; it does not perform them. The confirmation lab models arrival separately. Fixed-file counts are whole-partition ownership changes; actual file size and network time are not modeled.'
  ]){const p=document.createElement('p');p.textContent=text;output.append(p);}
  const details=document.createElement('details');const summary=document.createElement('summary');summary.textContent='Inspect every moved key';details.append(summary);
  const table=document.createElement('table');const caption=document.createElement('caption');caption.textContent='Primary owner changes in this snapshot';const head=document.createElement('thead');head.innerHTML='<tr><th scope="col">Key</th><th scope="col">Before</th><th scope="col">After</th></tr>';const body=document.createElement('tbody');for(const item of result.movedKeys){const row=document.createElement('tr');for(const value of [item.key,item.from,item.to]){const cell=document.createElement('td');cell.textContent=value;row.append(cell);}body.append(row);}table.append(caption,head,body);details.append(table);output.append(details);
 }
 for(const value of [1,2,3])button(`Inspect strategy ${value}`,()=>{strategy=value;show();});
 button('Join X / remove C',()=>{operation=operation==='join'?'remove':'join';show();});button('Uniform / hot-key trace',()=>{hot=!hot;show();});
 root.append(title,explanation,controls,output);show();return root;
}
