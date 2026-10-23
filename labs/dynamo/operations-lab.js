import {coordinationTrace,controllerTick} from './operations.js?v=dynamo20261023-final';
export function operationsLab(){
 const root=document.createElement('section');const title=document.createElement('h2');title.textContent='Observe route costs and resource feedback';
 const note=document.createElement('p');note.textContent='Every delay, resource unit and control formula below is invented. The paper describes the mechanisms, not this schedule or exact control law. Cache freshness can change independently of whether routing is client-driven.';
 const controls=document.createElement('div');controls.className='controls';const route=document.createElement('ol');const background=document.createElement('div');
 let client=false,stale=false,write=false,baseline=10,state={slices:5,remaining:50},ticks=[];
 const button=(label,action)=>{const item=document.createElement('button');item.type='button';item.textContent=label;item.addEventListener('click',action);controls.append(item);};
 function render(){
  route.replaceChildren();for(const event of coordinationTrace({client,stale,write})){const row=document.createElement('li');row.textContent=`${event.time} synthetic ms (+${event.duration}): ${event.text}`;route.append(row);}
  background.replaceChildren();const status=document.createElement('p');status.textContent=`Routing: ${client?'client-driven':'server-driven'} ${write?'write':'read'}; cached membership ${stale?'stale':'fresh'}. Foreground baseline ${baseline} synthetic ms; repair remaining ${state.remaining} units; next background slices ${state.slices}/5.`;background.append(status);
  const formula=document.createElement('p');formula.textContent='Toy measurement = foreground baseline + 8 × current background slices. Above 50 ms: reduce next slices by one. Below 40 ms: increase by one, up to five. Repair progresses by the slices actually used in that tick. Thresholds illustrate feedback, not production tuning advice.';background.append(formula);
  const history=document.createElement('ol');for(const tick of ticks){const row=document.createElement('li');row.textContent=`Measured ${tick.measured} ms using ${tick.previousSlices} slices → ${tick.slices} next; repaired ${tick.completed}, ${tick.remaining} remain.`;history.append(row);}background.append(history);
 }
 button('Toggle client/server route',()=>{client=!client;render();});button('Toggle stale membership',()=>{stale=!stale;render();});button('Toggle read/vector-clock write',()=>{write=!write;render();});
 button('Toggle heavy foreground load',()=>{baseline=baseline===10?45:10;render();});
 button('Run one feedback tick',()=>{state=controllerTick(state,baseline);ticks.push({...state});render();});
 button('Restart resource experiment',()=>{state={slices:5,remaining:50};ticks=[];baseline=10;render();});
 root.append(title,note,controls,route,background);render();return root;
}
