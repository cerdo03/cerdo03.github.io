// Synthetic delay schedule and illustrative feedback law, not paper benchmark data.
export function coordinationTrace({client=false,write=false,stale=false}={}){
 const events=[];let time=0;
 const add=(kind,duration,text)=>{time+=duration;events.push({kind,time,duration,text});};
 if(!client){add('balance',2,'Load balancer selects ingress');add('coordinator',3,'Ingress forwards to coordinator');}
 if(client && stale){add('timeout',10,'Cached destination unreachable; attempt times out');add('refresh',2,'Download current membership; update cached route');}
 if(client && write)add('coordinator',3,'Forward vector-clock write to a preference-list coordinator');
 add('replicas',5,'Coordinator gathers qualifying replica replies');add('response',0,'Client receives response');return events;
}
export function controllerTick(state,baseline){
 const measured=baseline+state.slices*8;
 let next=state.slices;
 if(measured>50)next=Math.max(0,next-1);
 else if(measured<40)next=Math.min(5,next+1);
 return {slices:next,remaining:Math.max(0,state.remaining-state.slices),measured,
  completed:Math.min(state.remaining,state.slices),previousSlices:state.slices};
}
