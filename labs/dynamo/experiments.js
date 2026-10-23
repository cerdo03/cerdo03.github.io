import { percentile, readTrace } from './reads.js?v=dynamo20261023-final';
import { compareClocks } from './model.js?v=dynamo20261023-final';
import { createCluster, put, get } from './cluster.js?v=dynamo20261023-final';
export function experiment(index) {
  const root=document.createElement('section');
  const heading=document.createElement('h2');heading.textContent='Change one assumption';
  const explanation=document.createElement('p');
  const output=document.createElement('pre');output.style.whiteSpace='pre-wrap';
  const controls=document.createElement('div');controls.className='controls';
  const button=(label,action)=>{const item=document.createElement('button');item.type='button';item.textContent=label;item.addEventListener('click',action);controls.append(item);};
  root.append(heading,explanation,controls,output);
  if(index===0){
    let slow=1;
    const show=()=>{
      const times=Array(1000-slow).fill(10).concat(Array(slow).fill(500));
      const mean=times.reduce((a,b)=>a+b,0)/times.length;
      output.textContent=`1,000 synthetic requests. ${slow} take 500 ms; the rest take 10 ms.\nMean: ${mean.toFixed(2)} ms\nMedian (nearest-rank): ${percentile(times,.5)} ms\np99.9 (nearest-rank): ${percentile(times,.999)} ms\nOne wait-for-all fanout request with 149 dependencies at 10 ms and one at 500 ms completes after 500 ms, assuming parallel start and no other processing. Correlated failures and sequential dependencies need different models.`;
    };
    explanation.textContent='Small averages can hide a slow customer segment. This toy uses nearest-rank percentiles, not an interpolation convention.';
    button('One slow request',()=>{slow=1;show();});button('Two slow requests',()=>{slow=2;show();});button('Ten slow requests',()=>{slow=10;show();});show();
  }else if(index===1){
    let cluster;let context;let read=false;
    const reset=()=>{cluster=createCluster();put(cluster,['A','B','C'],{},['book'],'A');context={};read=false;output.textContent='Store contains cart {book}. Client has not read it. Context is opaque to the caller.';};
    button('Read cart and context',()=>{const result=get(cluster,['A','B']);context=result.context;read=true;output.textContent=`get(cart:42) returns ${JSON.stringify(result.versions.map(version=>version.value))} + opaque context.\nSystem inspection only: context clock ${JSON.stringify(context)}.`;});
    button('Write edited cart with carried context',()=>{const version=put(cluster,['A','B','C'],context,['book','pen'],'B');const result=get(cluster,['A','B']);output.textContent=`put(cart:42, ${read?'returned':'empty'} context, {book,pen}) produced ${JSON.stringify(version.clock)}.\nVisible versions: ${result.versions.length}. ${read?'The new clock covers the read version.':'Empty context does not cover the original version; both remain.'}`;});
    button('Restart client',reset);reset();
  }else if(index===4){
    explanation.textContent='Worked reconstruction: deleting an old clock component can destroy proof of ancestry. Physical timestamps alone are a different policy.';
    const ancestor={X:1};const descendant={X:1,Y:1};
    button('Compare complete clocks',()=>{output.textContent=`${JSON.stringify(ancestor)} vs ${JSON.stringify(descendant)} → ${compareClocks(ancestor,descendant)}. Every component of first is covered.`;});
    button('Prune oldest X entry from descendant',()=>{output.textContent=`${JSON.stringify(ancestor)} vs {Y:1} → ${compareClocks(ancestor,{Y:1})}. Actual history did not change, but metadata no longer proves ancestry.`;});
    button('Compare physical timestamps with skew',()=>{output.textContent='Synthetic event: earlier edit carries timestamp 100; later edit on a slow clock carries timestamp 90. Last-write-wins chooses timestamp 100. It does not mean latest real-world event or semantically correct cart.';});
    output.textContent='Choose complete or pruned metadata. The paper does not claim pruning preserves all causal relationships.';
  }else if(index===6){
    let lateNew=false;
    const show=()=>{
      const replies=[{node:'A',time:1,version:lateNew?1:2},{node:'B',time:3,version:lateNew?1:2},{node:'C',time:8,version:lateNew?2:1}];
      const trace=readTrace(replies,2,10);
      output.textContent=`Synthetic replies: ${replies.map(reply=>`${reply.node}: ancestor-rank ${reply.version} at ${reply.time} ms`).join('; ')}\nClient response at ${trace.responseTime} ms.\nLater repair: ${trace.repairs.map(repair=>`${repair.node} receives rank ${repair.version} at ${repair.time} ms`).join('; ')}\nOnly a single causal chain is modeled here; sibling handling uses vector-clock reconciliation instead. Repair occurs after newer data is observed.`;
    };
    button('Late stale replica',()=>{lateNew=false;show();});button('Late newer replica',()=>{lateNew=true;show();});show();
  }else if(index===7){
    const views={A:['A'],B:['B'],S:['A','B','S']};
    const show=()=>{output.textContent=Object.entries(views).map(([node,members])=>`${node} knows membership: ${members.join(', ')}`).join('\n')+'\nSeed S is a normal member with externally known address. Exchange reconciles histories; temporary reachability is a separate view.';};
    button('A exchanges with seed',()=>{views.A=[...new Set([...views.A,...views.S])];show();});
    button('B exchanges with A',()=>{const merged=[...new Set([...views.A,...views.B])];views.A=[...merged];views.B=[...merged];show();});
    button('Restart isolated views',()=>{views.A=['A'];views.B=['B'];show();});show();
  }else if(index===9){
    let race=0;
    button('Step selected durable-replica race',()=>{
      race=(race+1)%5;
      const states=[
        'Start: A/B/C target the write; C is selected for durable persistence. No new disk copy yet.',
        'A acknowledges a memory-buffer copy. A disk: old; B disk: old; C durable write still pending. One reply.',
        'B acknowledges a memory-buffer copy. Two replies meet W=2; client receives success. C durable write still pending. Zero new disk copies in this synthetic schedule.',
        'A and B crash before flushing; their buffered copies disappear. C has not completed its write. Acknowledgement was not proof of two durable copies.',
        'If C eventually persists, a new durable copy survives. If C fails before doing so, the update is lost in this schedule. Selecting C mitigated risk, but success did not wait for it.'
      ];output.textContent=`Synthetic three-replica buffered-write race. ${states[race]}`;
    });
    output.textContent='Step the buffered three-replica race below. The separate route and feedback laboratory computes synthetic schedules and resource progress.';
  }else return null;
  return root;
}
