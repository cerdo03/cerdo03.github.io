import {writeTrace} from './events.js?v=dynamo20261023-final';
import {readTrace} from './reads.js?v=dynamo20261023-final';
export function requestLab(){
 const section=document.createElement('section');const title=document.createElement('h2');title.textContent='Choose participants, then inspect the completion boundary';
 const controls=document.createElement('div');controls.className='controls';const output=document.createElement('ol');const hosts=document.createElement('div');hosts.className='replica-grid';
 const inputs={};let visible=1;let eventCount=0;
 output.dataset.requestEvents='';
 function select(key,label,values,initial){const wrapper=document.createElement('label');wrapper.textContent=label;const input=document.createElement('select');for(const value of values){const option=document.createElement('option');option.value=value;option.textContent=value;input.append(option);}input.value=initial;input.addEventListener('change',()=>{visible=1;render();});wrapper.append(input);controls.append(wrapper);inputs[key]=input;}
 select('copies','Distinct replica targets ',[3,4,5],3);
 select('write','Write acknowledgements required ',[1,2,3],2);
 select('read','Read replies required ',[1,2,3],2);
 select('fail','Unreachable trailing hosts ',[0,1,2,3],0);
 select('ackDelay','Remote acknowledgement delay (synthetic ms) ',[0,5,20],0);
 select('operation','Operation ',['write','read'],'write');
 function render(){
  const count=Number(inputs.copies.value),required=Number(inputs[inputs.operation.value].value),failed=Number(inputs.fail.value);
  const replicas='ABCDE'.slice(0,count).split('');const times=[1,3,8,12,20];
  const delays=replicas.map((node,index)=>index>=count-failed?null:times[index]);
  output.replaceChildren();
  const lines=[`Synthetic schedule: ${replicas.map((node,index)=>`${node}: ${delays[index]===null?'unreachable':`${delays[index]} ms`}`).join('; ')}. Deadline 10 ms.`];
  let modelEvents=[];
  if(inputs.operation.value==='write'){
   modelEvents=writeTrace({replicas,delays,required,deadline:10,ackDelay:Number(inputs.ackDelay.value)});
   for(const event of modelEvents)lines.push(`${event.time} ms — ${event.text}`);
  }else{
   const replies=replicas.flatMap((node,index)=>delays[index]===null?[]:[{node,time:delays[index],version:index===0?2:1}]);
   const trace=readTrace(replies,required,10);
   modelEvents=trace.observed.map(reply=>({...reply,kind:'reply',text:`${reply.node} replies with ancestor-rank ${reply.version}.`}));
   modelEvents.push(trace.responseTime===null?{time:10,kind:'timeout',text:'Read times out: not enough responses.'}:{time:trace.responseTime,kind:'response',text:`Client receives read response after ${required} replies.`});
   modelEvents.push(...trace.repairs.map(repair=>({...repair,kind:'repair',text:`Repair ${repair.node} with ancestor-rank ${repair.version}.`})));modelEvents.sort((a,b)=>a.time-b.time);
   for(const event of modelEvents)lines.push(`${event.time} ms — ${event.text}`);
   lines.push('This teaching read waits at most five synthetic milliseconds after its response for repair replies. The paper does not specify that duration. Read versions form one causal chain in this scenario. Concurrent siblings require the version lab, not scalar ranks.');
  }
  lines.push('These targets share one fixed membership set. Sloppy failure placement uses different sets; consult the next failure lesson. Local write is counted once as A’s persistence. Persistence and acknowledgement are separate events. A’s local completion counts directly; remote acknowledgement delay can outlast the deadline even when remote bytes exist.');
  hosts.replaceChildren();
  const revealed=modelEvents.slice(0,Math.max(0,visible-1));
  for(const node of replicas){
   const relevant=revealed.filter(event=>event.node===node);
   const latest=relevant.at(-1);
   const card=document.createElement('div');card.className='replica';
   const label=document.createElement('h3');label.textContent=`Host ${node}`;
   const state=document.createElement('p');state.textContent=latest ? latest.text : delays[replicas.indexOf(node)]===null ? 'Unreachable in this scenario' : 'No completed replica event revealed';
   card.append(label,state);hosts.append(card);
  }
  const client=document.createElement('div');client.className='replica';
  const completion=revealed.find(event=>event.kind==='response'||event.kind==='timeout');
  client.textContent=completion?`Client: ${completion.text}`:'Client: waiting';hosts.append(client);
  eventCount=lines.length;
  previous.disabled=visible<=1;next.disabled=visible>=eventCount;
  for(const text of lines.slice(0,visible)){const item=document.createElement('li');item.textContent=text;output.append(item);}
 }
 const events=document.createElement('div');events.className='controls';
 const previous=document.createElement('button');previous.type='button';previous.textContent='Previous request event';previous.addEventListener('click',()=>{visible=Math.max(1,visible-1);render();});
 const next=document.createElement('button');next.type='button';next.textContent='Next request event';next.addEventListener('click',()=>{visible=Math.min(eventCount,visible+1);render();});
 const all=document.createElement('button');all.type='button';all.textContent='Show full request trace';all.addEventListener('click',()=>{visible=eventCount;render();});
 events.append(previous,next,all);section.append(title,controls,events,hosts,output);render();return section;
}
