export function orderedEvents(events){
 return events.map((event,id)=>({...event,id:event.id??id})).sort((a,b)=>a.time-b.time||a.id-b.id);
}
export function replay(initial,events,reducer,count=events.length){
 let state=structuredClone(initial);const applied=[];
 for(const event of orderedEvents(events).slice(0,count)){state=reducer(state,event)??state;applied.push(event);}
 return {state,events:applied};
}
export function seededRandom(seed){let state=seed>>>0;return()=>{state=(Math.imul(1664525,state)+1013904223)>>>0;return state/4294967296;};}
