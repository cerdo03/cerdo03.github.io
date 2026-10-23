import { replay } from './timeline.js?v=dynamo20261023-final';
import { createCluster, put, get, heal, mergeCart, changeHomes } from './cluster.js?v=dynamo20261023-final';
export function capstone() {
  const section=document.createElement('section');
  const heading=document.createElement('h2');heading.textContent='Follow one cart through partition and reconciliation';
  const explanation=document.createElement('p');
  const controls=document.createElement('div');controls.className='controls';
  const grid=document.createElement('div');grid.className='replica-grid';
  const log=document.createElement('ol');
  let step=0;let currentExport;let selected='A';
  const captions=[
    'Initial state: no cart yet. Nodes are physical hosts, not virtual tokens.',
    'Initial write stores book on A/B/C. Each stores the same causal version.',
    'Partition: A/D/E can communicate; B/C/F can communicate. Left client adds pen using initial context. D/E are fallback recipients in this simplified capstone.',
    'Right client removes book using the same old context. Its write does not include the left update. Two branches now exist.',
    'Communication restored. Confirmed handoff delivers separate fallback hints, then home-replica repair exchanges versions in one explicit step. Real repair uses multiple messages and schedules. Concurrent siblings survive.',
    'A read sees both branches. Application union preserves additions and resurrects book. Context covers both histories; new write via A supersedes both.',
    'Another teaching repair propagates the reconciled version. Convergence follows successful communication and a chosen resolver, not passage of time alone.',
    'A membership change proposes X/B/C for this key. A retains its copy while X awaits confirmed transfer. This single-key transfer abstraction does not specify concurrent-update race handling.',
    'Transfer confirmed. X/B/C now hold the reconciled version; A removes its obsolete copy. This completes the lifecycle through a membership change.'
  ];
  function render(){
    const schedule=[
      {time:1,kind:'initial-write'}, {time:2,kind:'left-write'}, {time:3,kind:'right-write'},
      {time:4,kind:'handoff-repair'}, {time:5,kind:'semantic-write'}, {time:6,kind:'repair'},
      {time:7,kind:'propose-membership'}, {time:8,kind:'confirm-transfer'}
    ];
    const reducer=(state,event)=>{
      if(event.kind==='initial-write')state.first=put(state.cluster,['A','B','C'],{},['book'],'A');
      if(event.kind==='left-write')put(state.cluster,['A','D','E'],state.first.clock,['book','pen'],'A');
      if(event.kind==='right-write')put(state.cluster,['B','C','F'],state.first.clock,[],'B');
      if(event.kind==='handoff-repair'||event.kind==='repair')heal(state.cluster);
      if(event.kind==='semantic-write'){const result=get(state.cluster,['A','B']);put(state.cluster,['A','B','C'],result.context,mergeCart(result.versions),'A');}
      if(event.kind==='propose-membership')changeHomes(state.cluster,['X','B','C'],false);
      if(event.kind==='confirm-transfer')changeHomes(state.cluster,['X','B','C'],true);
      return state;
    };
    const snapshot=replay({cluster:createCluster()},schedule,reducer,step);
    const cluster=snapshot.state.cluster;
    currentExport={assumptions:'Single-key teaching fixture. Atomic macro-events stand in for multi-message protocols; no timing measurement. Hint delivery confirmed before cleanup. Membership transfer race handling abstracted.',seed:1,events:snapshot.events,state:cluster};
    explanation.textContent=`Step ${step+1}/9. ${captions[step]} Synthetic cart and network schedule; no latency or availability measurement.`;
    grid.replaceChildren();
    for(const [node,versions] of Object.entries(cluster.stores)){
      const card=document.createElement('div');card.className='replica';
      const title=document.createElement('button');title.type='button';title.textContent=`Inspect host ${node}`;title.setAttribute('aria-pressed',String(node===selected));title.addEventListener('click',()=>{selected=node;render();});card.append(title);if(node===selected)card.dataset.selectedHost='true';
      for(const hint of cluster.hints[node]){const p=document.createElement('p');p.textContent=`Separate hint: ${hint.version.id} for home ${hint.home} · {${hint.version.value.join(', ')}}`;card.append(p);}
      for(const version of versions){const text=document.createElement('p');text.textContent=`${version.id}: {${version.value.join(', ')}} · clock ${JSON.stringify(version.clock)}`;card.append(text);}
      if(!versions.length){const text=document.createElement('p');text.textContent='No permanent cart version';card.append(text);}
      grid.append(card);
    }
    log.replaceChildren();
    for(const text of cluster.log){const row=document.createElement('li');row.textContent=text;if(new RegExp(`\\b${selected}\\b`).test(text))row.dataset.selectedHost='true';log.append(row);}
    previous.disabled=step===0;next.disabled=step===8;
  }
  const previous=document.createElement('button');previous.type='button';previous.textContent='Previous event';previous.addEventListener('click',()=>{step=Math.max(0,step-1);render();});
  const next=document.createElement('button');next.type='button';next.textContent='Next event';next.addEventListener('click',()=>{step=Math.min(8,step+1);render();});
  const reset=document.createElement('button');reset.type='button';reset.textContent='Restart cart';reset.addEventListener('click',()=>{step=0;render();});
  const exportButton=document.createElement('button');exportButton.type='button';exportButton.textContent='Export current trace and assumptions';exportButton.addEventListener('click',()=>{const url=URL.createObjectURL(new Blob([JSON.stringify(currentExport,null,2)],{type:'application/json'}));const link=document.createElement('a');link.href=url;link.download='dynamo-cart-trace.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);});
  controls.append(previous,next,reset,exportButton);section.append(heading,explanation,controls,grid,log);render();return section;
}
